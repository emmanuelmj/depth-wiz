import cv2
import numpy as np
import math

img = cv2.imread('backend/static/map.jpg')
if img is None:
    print("No map.jpg found")
    exit()

h, w = img.shape[:2]
hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
debug = img.copy()

# ============================================================
# MASKS
# ============================================================
# Dense tree canopy — VERY dark green only (V max 90)
lower_tree = np.array([30, 40, 15])
upper_tree = np.array([90, 255, 90])
mask_tree_raw = cv2.inRange(hsv, lower_tree, upper_tree)
tree_k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7))
mask_tree = cv2.morphologyEx(mask_tree_raw, cv2.MORPH_OPEN, tree_k, iterations=1)
mask_tree = cv2.morphologyEx(mask_tree, cv2.MORPH_CLOSE, tree_k, iterations=5)

# Road surface — wider range to catch all road shades
lower_road = np.array([0, 0, 35])
upper_road = np.array([180, 40, 140])
mask_road = cv2.inRange(hsv, lower_road, upper_road)
road_k = cv2.getStructuringElement(cv2.MORPH_RECT, (11, 11))
mask_road = cv2.morphologyEx(mask_road, cv2.MORPH_CLOSE, road_k, iterations=4)
mask_road = cv2.morphologyEx(mask_road, cv2.MORPH_OPEN, road_k, iterations=2)

# ALL green (broad) for house exclusion
lower_allgreen = np.array([20, 20, 15])
upper_allgreen = np.array([95, 255, 255])
mask_allgreen = cv2.inRange(hsv, lower_allgreen, upper_allgreen)

# ============================================================
# 1. HOUSES — multi-channel roof color detection
# ============================================================
# Light grey roofs (brighter than road)
mask_lgrey = cv2.inRange(hsv, np.array([0, 0, 110]), np.array([180, 35, 210]))

# Medium grey roofs  
mask_mgrey = cv2.inRange(hsv, np.array([0, 0, 70]), np.array([180, 30, 130]))

# Brown roofs
mask_brown = cv2.inRange(hsv, np.array([5, 25, 40]), np.array([25, 200, 200]))

# Reddish/terracotta roofs
mask_red = cv2.inRange(hsv, np.array([0, 40, 50]), np.array([10, 200, 200]))

# Dark slate/blue-grey roofs
mask_slate = cv2.inRange(hsv, np.array([95, 10, 40]), np.array([130, 80, 150]))

# White/cream structures
mask_cream = cv2.inRange(hsv, np.array([15, 10, 160]), np.array([30, 80, 240]))

# Combine all roof types
mask_roof = mask_lgrey.copy()
for m in [mask_mgrey, mask_brown, mask_red, mask_slate, mask_cream]:
    mask_roof = cv2.bitwise_or(mask_roof, m)

# Subtract green and roads
mask_roof = cv2.bitwise_and(mask_roof, cv2.bitwise_not(mask_allgreen))

# Dilate road before subtracting to catch overlap zones
road_dilated = cv2.dilate(mask_road, np.ones((5,5), np.uint8), iterations=1)
mask_roof = cv2.bitwise_and(mask_roof, cv2.bitwise_not(road_dilated))

# Morphology: close gaps in roofs, then open to remove tiny noise
house_k = cv2.getStructuringElement(cv2.MORPH_RECT, (7, 7))
mask_roof = cv2.morphologyEx(mask_roof, cv2.MORPH_CLOSE, house_k, iterations=4)
house_k2 = cv2.getStructuringElement(cv2.MORPH_RECT, (9, 9))
mask_roof = cv2.morphologyEx(mask_roof, cv2.MORPH_OPEN, house_k2, iterations=1)

cnts, _ = cv2.findContours(mask_roof, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
house_count = 0
house_data = []
for c in cnts:
    area = cv2.contourArea(c)
    if 300 < area < 25000:
        rect = cv2.minAreaRect(c)
        (cx, cy), (bw, bh), angle = rect
        aspect = max(bw, bh) / (min(bw, bh) + 1e-5)
        if aspect < 4.0:
            icx, icy = int(cx), int(cy)
            if 0 <= icy < h and 0 <= icx < w:
                if mask_tree[icy, icx] > 0:
                    continue
            overlap = any(math.hypot(cx - d[0], cy - d[1]) < 25 for d in house_data)
            if not overlap:
                house_count += 1
                house_data.append((cx, cy))
                box = cv2.boxPoints(rect)
                box = np.intp(box)
                cv2.drawContours(debug, [box], 0, (255, 0, 0), 2)

# ============================================================
# 2. TREES — dark canopy only
# ============================================================
cnts, _ = cv2.findContours(mask_tree, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
tree_count = 0
tree_data = []
for c in cnts:
    area = cv2.contourArea(c)
    if area > 400:
        M = cv2.moments(c)
        if M["m00"] != 0:
            cx = int(M["m10"] / M["m00"])
            cy = int(M["m01"] / M["m00"])
            overlap = any(math.hypot(cx - d[0], cy - d[1]) < 35 for d in tree_data)
            if not overlap:
                tree_count += 1
                tree_data.append((cx, cy))
                cv2.circle(debug, (cx, cy), int(math.sqrt(area)/2), (0, 255, 0), 2)

# ============================================================
# 3. CARS — strictly on road only, small bright/colored
# ============================================================
# Erode road to avoid edges/sidewalks
road_strict = cv2.erode(mask_road, np.ones((5,5), np.uint8), iterations=2)

bright = cv2.threshold(gray, 160, 255, cv2.THRESH_BINARY)[1]
bright_on_road = cv2.bitwise_and(bright, road_strict)

sat = hsv[:,:,1]
colored = cv2.threshold(sat, 100, 255, cv2.THRESH_BINARY)[1]
colored_on_road = cv2.bitwise_and(colored, road_strict)

car_cands = cv2.bitwise_or(bright_on_road, colored_on_road)

cnts, _ = cv2.findContours(car_cands, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
car_count = 0
car_data = []
for c in cnts:
    area = cv2.contourArea(c)
    if 20 < area < 300:
        rect = cv2.minAreaRect(c)
        (cx, cy), (bw, bh), angle = rect
        aspect = max(bw, bh) / (min(bw, bh) + 1e-5)
        if 1.3 < aspect < 5.0:
            overlap = any(math.hypot(cx - d[0], cy - d[1]) < 15 for d in car_data)
            if not overlap:
                car_count += 1
                car_data.append((cx, cy))
                cv2.circle(debug, (int(cx), int(cy)), 5, (0, 0, 255), -1)

cv2.imwrite("backend/static/debug_v6.jpg", debug)
print(f"Trees: {tree_count}, Cars: {car_count}, Houses: {house_count}")
