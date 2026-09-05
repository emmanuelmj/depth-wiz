import cv2
import numpy as np
import json
import sys

image_path = "c:/Users/mituk/OneDrive/Desktop/SIH26/depth-wiz/frontend/public/demo_data/dc-03-26/optical.jpg"
img = cv2.imread(image_path)
if img is None:
    print("Error loading image")
    sys.exit(1)

h, w = img.shape[:2]

# Convert to HSV for better color segmentation
hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)

# --- 1. TREES ---
# Dark green
lower_green = np.array([35, 40, 20])
upper_green = np.array([85, 255, 200])
mask_green = cv2.inRange(hsv, lower_green, upper_green)

# Find tree contours
tree_coords = []
contours, _ = cv2.findContours(mask_green, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
for cnt in contours:
    area = cv2.contourArea(cnt)
    if area > 20: # skip tiny noise
        M = cv2.moments(cnt)
        if M["m00"] != 0:
            cx = int(M["m10"] / M["m00"])
            cy = int(M["m01"] / M["m00"])
            # Map pixel (cx, cy) to world (-50 to 50)
            wx = (cx / w) * 100 - 50
            wz = (cy / h) * 100 - 50
            tree_coords.append({"x": round(wx, 2), "z": round(wz, 2)})

# --- 2. ROADS & CARS ---
# Roads are dark gray.
lower_gray = np.array([0, 0, 20])
upper_gray = np.array([180, 50, 100])
mask_road = cv2.inRange(hsv, lower_gray, upper_gray)

car_coords = []
contours, _ = cv2.findContours(mask_road, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
for cnt in contours:
    area = cv2.contourArea(cnt)
    if area > 1000: # large road blobs
        # generate random points inside the road mask for cars
        mask_single = np.zeros_like(mask_road)
        cv2.drawContours(mask_single, [cnt], -1, 255, -1)
        pts = np.column_stack(np.where(mask_single == 255))
        if len(pts) > 0:
            np.random.shuffle(pts)
            for i in range(min(15, len(pts)//1000)):
                cy, cx = pts[i]
                wx = (cx / w) * 100 - 50
                wz = (cy / h) * 100 - 50
                car_coords.append({"x": round(wx, 2), "z": round(wz, 2), "r": 1.57})

# --- 3. HOUSES ---
# To find houses, we can mask out trees and roads, and grass.
# Grass is light green / yellow green.
lower_grass = np.array([25, 40, 100])
upper_grass = np.array([55, 255, 255])
mask_grass = cv2.inRange(hsv, lower_grass, upper_grass)

# Combine masks to find background
background_mask = cv2.bitwise_or(mask_green, mask_road)
background_mask = cv2.bitwise_or(background_mask, mask_grass)

# Houses are the remaining foreground
mask_houses = cv2.bitwise_not(background_mask)

# Morphological operations to clean up
kernel = np.ones((5,5), np.uint8)
mask_houses = cv2.erode(mask_houses, kernel, iterations=1)
mask_houses = cv2.dilate(mask_houses, kernel, iterations=2)

house_coords = []
contours, _ = cv2.findContours(mask_houses, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
for cnt in contours:
    area = cv2.contourArea(cnt)
    if 200 < area < 4000: # filter out noise and massive blobs
        rect = cv2.minAreaRect(cnt)
        (cx, cy), (width, height), angle = rect
        wx = (cx / w) * 100 - 50
        wz = (cy / h) * 100 - 50
        
        # Determine rotation in radians
        rad = np.deg2rad(angle)
        house_coords.append({"x": round(wx, 2), "z": round(wz, 2), "r": round(rad, 2)})

data = {
    "trees": tree_coords,
    "cars": car_coords,
    "houses": house_coords
}
import os
out_path = os.path.join(os.path.dirname(__file__), "frontend/src/3d/mapData.js")
with open(out_path, "w", encoding="utf-8") as f:
    f.write("export const mapData = " + json.dumps(data, indent=2) + ";\n")
print(f"Saved to {out_path}")

# --- SAVE VISUAL DEBUG IMAGE ---
debug_img = img.copy()

# Draw trees (Green dots)
for t in tree_coords:
    # Convert world coords back to pixels
    cx = int((t["x"] + 50) / 100 * w)
    cy = int((t["z"] + 50) / 100 * h)
    cv2.circle(debug_img, (cx, cy), 5, (0, 255, 0), -1)

# Draw cars (Red dots)
for c in car_coords:
    cx = int((c["x"] + 50) / 100 * w)
    cy = int((c["z"] + 50) / 100 * h)
    cv2.circle(debug_img, (cx, cy), 3, (0, 0, 255), -1)

# Draw houses (Blue dots/boxes approx)
for h_coord in house_coords:
    cx = int((h_coord["x"] + 50) / 100 * w)
    cy = int((h_coord["z"] + 50) / 100 * h)
    cv2.rectangle(debug_img, (cx-10, cy-10), (cx+10, cy+10), (255, 0, 0), 2)

debug_path = os.path.join(os.path.dirname(__file__), "debug_cv.jpg")
cv2.imwrite(debug_path, debug_img)
print(f"Saved visual debug map to {debug_path}")
