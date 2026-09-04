import cv2
import numpy as np
import math
import os

class MapAnalyzerService:
    def __init__(self):
        self.yolo_model = None
        self.yolo_loaded = False

    def load_yolo(self):
        if not self.yolo_loaded:
            try:
                from ultralytics import YOLO
                self.yolo_model = YOLO("yolov8n.pt")
                self.yolo_loaded = True
            except Exception as e:
                print(f"Error loading YOLO: {e}")

    def analyze_image(self, image_path: str):
        self.load_yolo()
        
        img = cv2.imread(image_path)
        if img is None:
            raise ValueError(f"Could not read image at {image_path}")
            
        debug_img = img.copy()
        h, w = img.shape[:2]
        hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        
        tree_coords = []
        car_coords = []
        house_coords = []
        
        def is_overlapping(cx, cy, existing_list, min_dist):
            for item in existing_list:
                if math.hypot(cx - item['cx'], cy - item['cy']) < min_dist:
                    return True
            return False

        # ============================================================
        # STEP 1: Build core masks
        # ============================================================
        
        # DENSE FOREST mask — truly dark canopy only
        # V max 70 to strictly exclude ANY lawn grass (lawns are V>100)
        # S min 60 for strong green saturation
        lower_forest = np.array([30, 60, 15])
        upper_forest = np.array([90, 255, 70])
        mask_forest = cv2.inRange(hsv, lower_forest, upper_forest)
        forest_k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (11, 11))
        mask_forest = cv2.morphologyEx(mask_forest, cv2.MORPH_CLOSE, forest_k, iterations=6)
        mask_forest = cv2.morphologyEx(mask_forest, cv2.MORPH_OPEN, forest_k, iterations=3)
        # Only keep MASSIVE forest blobs (>15000 px) — ONLY the actual forest
        cnts_forest, _ = cv2.findContours(mask_forest, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        mask_forest_clean = np.zeros_like(mask_forest)
        for c in cnts_forest:
            if cv2.contourArea(c) > 15000:
                cv2.drawContours(mask_forest_clean, [c], -1, 255, -1)
        mask_forest = mask_forest_clean

        # ROAD mask
        lower_road = np.array([0, 0, 35])
        upper_road = np.array([180, 40, 140])
        mask_road = cv2.inRange(hsv, lower_road, upper_road)
        road_k = cv2.getStructuringElement(cv2.MORPH_RECT, (11, 11))
        mask_road = cv2.morphologyEx(mask_road, cv2.MORPH_CLOSE, road_k, iterations=4)
        mask_road = cv2.morphologyEx(mask_road, cv2.MORPH_OPEN, road_k, iterations=2)

        # ALL GREEN mask (trees + lawns) — for subtracting from houses
        lower_allgreen = np.array([20, 20, 15])
        upper_allgreen = np.array([95, 255, 255])
        mask_allgreen = cv2.inRange(hsv, lower_allgreen, upper_allgreen)

        # DRIVEWAY/SIDEWALK mask — light grey, low saturation, bright
        # These look like roofs but are flat ground surfaces
        lower_driveway = np.array([0, 0, 150])
        upper_driveway = np.array([180, 25, 235])
        mask_driveway = cv2.inRange(hsv, lower_driveway, upper_driveway)

        # ============================================================
        # STEP 2: HOUSES — roof detection
        # Strategy: find roof-colored pixels, subtract green/road/driveway,
        # then only keep blobs with HOUSE-sized area (not tiny not huge)
        # ============================================================
        
        # Grey roofs (brighter than road, darker than sidewalk)
        mask_lgrey = cv2.inRange(hsv, np.array([0, 0, 100]), np.array([180, 30, 185]))
        # Brown roofs
        mask_brown = cv2.inRange(hsv, np.array([5, 30, 40]), np.array([25, 200, 200]))
        # Reddish/terracotta roofs
        mask_red = cv2.inRange(hsv, np.array([0, 40, 50]), np.array([10, 200, 200]))
        # Dark slate/blue-grey roofs
        mask_slate = cv2.inRange(hsv, np.array([95, 10, 40]), np.array([130, 80, 150]))

        # Combine all roof colors
        mask_roof = mask_lgrey.copy()
        for m in [mask_brown, mask_red, mask_slate]:
            mask_roof = cv2.bitwise_or(mask_roof, m)

        # SUBTRACT everything that is NOT a roof
        mask_roof = cv2.bitwise_and(mask_roof, cv2.bitwise_not(mask_allgreen))
        road_dilated = cv2.dilate(mask_road, np.ones((7,7), np.uint8), iterations=2)
        mask_roof = cv2.bitwise_and(mask_roof, cv2.bitwise_not(road_dilated))
        driveway_dilated = cv2.dilate(mask_driveway, np.ones((5,5), np.uint8), iterations=1)
        mask_roof = cv2.bitwise_and(mask_roof, cv2.bitwise_not(driveway_dilated))
        mask_roof = cv2.bitwise_and(mask_roof, cv2.bitwise_not(mask_forest))

        # Morphology — close gaps within a single roof, open to kill noise
        house_close_k = cv2.getStructuringElement(cv2.MORPH_RECT, (7, 7))
        mask_roof = cv2.morphologyEx(mask_roof, cv2.MORPH_CLOSE, house_close_k, iterations=4)
        house_open_k = cv2.getStructuringElement(cv2.MORPH_RECT, (11, 11))
        mask_roof = cv2.morphologyEx(mask_roof, cv2.MORPH_OPEN, house_open_k, iterations=1)

        contours, _ = cv2.findContours(mask_roof, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        house_pixel_data = []
        for cnt in contours:
            area = cv2.contourArea(cnt)
            # A house roof is roughly 30-60px on each side = 900-3600 area
            # Allow some range: 500 to 15000
            if 500 < area < 15000:
                rect = cv2.minAreaRect(cnt)
                (cx, cy), (bw, bh), angle = rect
                aspect = max(bw, bh) / (min(bw, bh) + 1e-5)
                if aspect < 3.0:  # houses are roughly square/rectangular
                    icx, icy = int(cx), int(cy)
                    # Skip if center is in forest
                    if 0 <= icy < h and 0 <= icx < w:
                        if mask_forest[icy, icx] > 0:
                            continue
                    
                    if not is_overlapping(cx, cy, house_pixel_data, 30):
                        house_pixel_data.append({'cx': cx, 'cy': cy})
                        wx = (cx / w) * 100 - 50
                        wz = (cy / h) * 100 - 50
                        rad = np.deg2rad(angle)
                        house_coords.append({"x": round(wx, 2), "z": round(wz, 2), "r": round(-rad, 2)})
                        
                        box = cv2.boxPoints(rect)
                        box = np.intp(box)
                        cv2.drawContours(debug_img, [box], 0, (255, 0, 0), 2)

        # ============================================================
        # STEP 3: TREES — ONLY from large forest canopy blobs
        # Each large forest blob gets sampled into multiple tree points
        # Small isolated green patches (yard trees) are IGNORED
        # ============================================================
        contours, _ = cv2.findContours(mask_forest, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        tree_pixel_data = []
        for cnt in contours:
            area = cv2.contourArea(cnt)
            if area > 2000:
                # For large forest blobs, place trees at regular intervals
                x_pts, y_pts, bw, bh = cv2.boundingRect(cnt)
                # Space trees every ~60 pixels apart within the forest blob
                step = 60
                for ty in range(y_pts, y_pts + bh, step):
                    for tx in range(x_pts, x_pts + bw, step):
                        if 0 <= ty < h and 0 <= tx < w:
                            if mask_forest[ty, tx] > 0:
                                # Add some jitter
                                jx = tx + np.random.randint(-8, 8)
                                jy = ty + np.random.randint(-8, 8)
                                jx = max(0, min(w-1, jx))
                                jy = max(0, min(h-1, jy))
                                
                                if not is_overlapping(jx, jy, tree_pixel_data, 20):
                                    tree_pixel_data.append({'cx': jx, 'cy': jy})
                                    wx = (jx / w) * 100 - 50
                                    wz = (jy / h) * 100 - 50
                                    tree_coords.append({"x": round(wx, 2), "z": round(wz, 2)})
                                    cv2.circle(debug_img, (jx, jy), 8, (0, 255, 0), 2)

        # ============================================================
        # STEP 4: CARS — YOLO first, then limited OpenCV on road
        # ============================================================
        car_pixel_data = []
        
        # YOLO pass
        if self.yolo_loaded and self.yolo_model is not None:
            results = self.yolo_model(img, verbose=False)
            for r in results:
                boxes = r.boxes
                for box in boxes:
                    cls_id = int(box.cls[0])
                    conf = float(box.conf[0])
                    # Only cars/trucks/buses with decent confidence
                    if cls_id in [2, 3, 5, 7] and conf > 0.3:
                        x1, y1, x2, y2 = box.xyxy[0].tolist()
                        cx = (x1 + x2) / 2
                        cy = (y1 + y2) / 2
                        
                        car_pixel_data.append({'cx': cx, 'cy': cy})
                        wx = (cx / w) * 100 - 50
                        wz = (cy / h) * 100 - 50
                        car_coords.append({"x": round(wx, 2), "z": round(wz, 2), "r": 1.57})
                        cv2.rectangle(debug_img, (int(x1), int(y1)), (int(x2), int(y2)), (0, 0, 255), 2)

        # OpenCV pass: bright/colored spots STRICTLY on the road core
        # Erode road very heavily to avoid any sidewalk/driveway overlap
        road_core = cv2.erode(mask_road, np.ones((9,9), np.uint8), iterations=3)
        
        bright = cv2.threshold(gray, 175, 255, cv2.THRESH_BINARY)[1]
        bright_on_road = cv2.bitwise_and(bright, road_core)

        sat = hsv[:,:,1]
        colored = cv2.threshold(sat, 120, 255, cv2.THRESH_BINARY)[1]
        colored_on_road = cv2.bitwise_and(colored, road_core)

        car_cands = cv2.bitwise_or(bright_on_road, colored_on_road)

        contours, _ = cv2.findContours(car_cands, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        for cnt in contours:
            area = cv2.contourArea(cnt)
            # Cars: tight area range
            if 50 < area < 200:
                rect = cv2.minAreaRect(cnt)
                (cx, cy), (bw, bh), angle = rect
                aspect = max(bw, bh) / (min(bw, bh) + 1e-5)
                # Cars are elongated rectangles
                if 1.5 < aspect < 4.0:
                    if not is_overlapping(cx, cy, car_pixel_data, 18):
                        car_pixel_data.append({'cx': cx, 'cy': cy})
                        wx = (cx / w) * 100 - 50
                        wz = (cy / h) * 100 - 50
                        car_coords.append({"x": round(wx, 2), "z": round(wz, 2), "r": round(np.deg2rad(angle), 2)})
                        cv2.circle(debug_img, (int(cx), int(cy)), 5, (0, 0, 255), -1)

        # Save debug image
        debug_dir = os.path.dirname(image_path)
        debug_path = os.path.join(debug_dir, "debug_cv.jpg")
        cv2.imwrite(debug_path, debug_img)
        
        print(f"[MapAnalyzer] Trees: {len(tree_coords)}, Cars: {len(car_coords)}, Houses: {len(house_coords)}")

        return {
            "trees": tree_coords,
            "cars": car_coords,
            "houses": house_coords
        }

analyzer = MapAnalyzerService()
