import cv2
import numpy as np
import math

img = cv2.imread('backend/static/map.jpg')
if img is None:
    print("NO IMAGE")
    exit()

h, w = img.shape[:2]
hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
debug_img = img.copy()

# 1. TREES
lower_tree = np.array([35, 40, 20])
upper_tree = np.array([85, 255, 120]) # Value up to 120 (darker)
mask_tree = cv2.inRange(hsv, lower_tree, upper_tree)
kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
mask_tree = cv2.morphologyEx(mask_tree, cv2.MORPH_OPEN, kernel, iterations=1)
mask_tree = cv2.morphologyEx(mask_tree, cv2.MORPH_CLOSE, kernel, iterations=3)

cnts, _ = cv2.findContours(mask_tree, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
tree_count = 0
for c in cnts:
    if cv2.contourArea(c) > 100:
        tree_count += 1

# 2. CARS
lower_road = np.array([0, 0, 0])
upper_road = np.array([180, 50, 100])
mask_road = cv2.inRange(hsv, lower_road, upper_road)
mask_road = cv2.morphologyEx(mask_road, cv2.MORPH_CLOSE, kernel, iterations=2)

gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
edges = cv2.Canny(gray, 100, 200)
car_edges = cv2.bitwise_and(edges, mask_road)
cnts, _ = cv2.findContours(car_edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
car_count = 0
for c in cnts:
    x,y,w_box,h_box = cv2.boundingRect(c)
    area = w_box * h_box
    if 20 < area < 300:
        car_count += 1

# 3. HOUSES
lower_grass = np.array([25, 40, 120])
upper_grass = np.array([85, 255, 255])
mask_grass = cv2.inRange(hsv, lower_grass, upper_grass)

bg_mask = cv2.bitwise_or(mask_tree, mask_grass)
bg_mask = cv2.bitwise_or(bg_mask, mask_road)

mask_houses = cv2.bitwise_not(bg_mask)
kernel_sq = cv2.getStructuringElement(cv2.MORPH_RECT, (7, 7))
mask_houses = cv2.morphologyEx(mask_houses, cv2.MORPH_OPEN, kernel_sq, iterations=1)
mask_houses = cv2.morphologyEx(mask_houses, cv2.MORPH_CLOSE, kernel_sq, iterations=3)

cnts, _ = cv2.findContours(mask_houses, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
house_count = 0
for c in cnts:
    area = cv2.contourArea(c)
    if 400 < area < 10000:
        rect = cv2.minAreaRect(c)
        (cx, cy), (width, height), angle = rect
        aspect = max(width, height) / (min(width, height) + 1e-5)
        if aspect < 3.5:
            house_count += 1

print(f"Trees: {tree_count}, Cars: {car_count}, Houses: {house_count}")
