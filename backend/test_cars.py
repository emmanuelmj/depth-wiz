import cv2
import numpy as np

img = cv2.imread('backend/static/map.jpg')
if img is None:
    print("No map.jpg found")
    exit()

h, w = img.shape[:2]
hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
debug = img.copy()

# ============================================================
# STEP 1: ROAD MASK — cars live on roads
# Roads are low saturation, medium brightness grey
# ============================================================
lower_road = np.array([0, 0, 40])
upper_road = np.array([180, 40, 120])
mask_road = cv2.inRange(hsv, lower_road, upper_road)
kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (7, 7))
mask_road = cv2.morphologyEx(mask_road, cv2.MORPH_CLOSE, kernel, iterations=3)

# ============================================================
# STEP 2: CARS — bright/colored spots ON the road
# Cars are small, bright, and often colored (red, white, blue)
# ============================================================
gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

# Cars are brighter than the dark road. Threshold bright spots on road.
# Dilate road mask slightly so cars at road edges are included
road_dilated = cv2.dilate(mask_road, np.ones((9,9), np.uint8), iterations=1)

# Find bright spots within the road region
bright = cv2.threshold(gray, 140, 255, cv2.THRESH_BINARY)[1]
car_candidates = cv2.bitwise_and(bright, road_dilated)

# Also look for colored spots (high saturation) on roads — red/blue cars
sat = hsv[:,:,1]
colored = cv2.threshold(sat, 80, 255, cv2.THRESH_BINARY)[1]
colored_on_road = cv2.bitwise_and(colored, road_dilated)
car_candidates = cv2.bitwise_or(car_candidates, colored_on_road)

# Clean up
car_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3))
car_candidates = cv2.morphologyEx(car_candidates, cv2.MORPH_OPEN, car_kernel, iterations=1)
car_candidates = cv2.morphologyEx(car_candidates, cv2.MORPH_CLOSE, car_kernel, iterations=1)

cnts, _ = cv2.findContours(car_candidates, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
car_count = 0
for c in cnts:
    area = cv2.contourArea(c)
    # Cars are small — roughly 8x16 pixels = 128 area
    if 40 < area < 600:
        rect = cv2.minAreaRect(c)
        (cx, cy), (bw, bh), angle = rect
        aspect = max(bw, bh) / (min(bw, bh) + 1e-5)
        if 1.3 < aspect < 4.0:
            car_count += 1
            cv2.circle(debug, (int(cx), int(cy)), 5, (0, 0, 255), -1)

print(f"Cars found: {car_count}")
cv2.imwrite("backend/static/debug_cars2.jpg", debug)
