import os
import h5py
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
STATIC_DIR = BASE_DIR / "static"
DEMO_DIR = STATIC_DIR / "demo_data"
THUMBNAIL_DIR = STATIC_DIR / "thumbnails"
SAMPLE_H5 = BASE_DIR.parent / "data" / "sample" / "DC_03_26_RGB.h5"

def generate_textures():
    DEMO_DIR.mkdir(parents=True, exist_ok=True)
    THUMBNAIL_DIR.mkdir(parents=True, exist_ok=True)

    # 1. Load sample optical image if present, else generate procedural
    if SAMPLE_H5.exists():
        with h5py.File(SAMPLE_H5, 'r') as f:
            base_rgb = f['image'][:]
    else:
        base_rgb = np.zeros((1024, 1024, 3), dtype=np.uint8)
        base_rgb[:, :, 0] = 70
        base_rgb[:, :, 1] = 110
        base_rgb[:, :, 2] = 80

    presets = [
        ("urban-ahmedabad-01", "urban", 42.5, 184.2),
        ("sparse-plains-02", "sparse", 210.0, 235.4),
        ("mountain-himalayas-03", "mountain", 1420.0, 3150.0),
        ("forest-western-ghats-04", "forest", 610.0, 890.0)
    ]

    for scene_id, landscape, min_m, max_m in presets:
        scene_folder = DEMO_DIR / scene_id
        scene_folder.mkdir(parents=True, exist_ok=True)

        optical_path = scene_folder / "optical.png"
        disp_path = scene_folder / "disp_16bit.png"
        thumb_path = THUMBNAIL_DIR / f"{landscape}.jpg"

        # Generate stylized optical RGB
        rgb_img = Image.fromarray(base_rgb).copy()
        if landscape == "urban":
            # Add grid structures
            draw = ImageDraw.Draw(rgb_img)
            for x in range(100, 924, 80):
                for y in range(100, 924, 80):
                    draw.rectangle([x, y, x + 50, y + 50], fill=(180, 185, 190), outline=(220, 220, 230))
        elif landscape == "sparse":
            # Earthy agricultural tones
            tint = np.array([190, 175, 130], dtype=np.float32)
            arr = np.clip(base_rgb.astype(np.float32) * 0.4 + tint * 0.6, 0, 255).astype(np.uint8)
            rgb_img = Image.fromarray(arr)
        elif landscape == "mountain":
            # High-contrast rocky ridges
            gray = np.mean(base_rgb, axis=2, keepdims=True).astype(np.uint8)
            mountain_arr = np.concatenate([gray + 20, gray + 25, gray + 40], axis=2)
            rgb_img = Image.fromarray(np.clip(mountain_arr, 0, 255).astype(np.uint8))
        elif landscape == "forest":
            # Deep lush green canopy
            arr = np.copy(base_rgb)
            arr[:, :, 0] = np.clip(arr[:, :, 0] * 0.3, 0, 255)
            arr[:, :, 1] = np.clip(arr[:, :, 1] * 1.3, 0, 255)
            arr[:, :, 2] = np.clip(arr[:, :, 2] * 0.4, 0, 255)
            rgb_img = Image.fromarray(arr)

        rgb_img.save(optical_path)
        rgb_img.resize((256, 256)).save(thumb_path, quality=85)

        # Generate 16-bit displacement map
        y, x = np.mgrid[0:1024, 0:1024]
        if landscape == "urban":
            # High-rise towers with sharp rectangular steps
            disp_arr = np.zeros((1024, 1024), dtype=np.float32)
            for bx in range(100, 924, 80):
                for by in range(100, 924, 80):
                    h_val = 0.3 + 0.6 * np.sin(bx * 0.05) * np.cos(by * 0.05)
                    disp_arr[by:by+50, bx:bx+50] = max(0.1, h_val)
        elif landscape == "mountain":
            # Smooth dramatic ridge
            d1 = np.sin(x / 140.0) * np.cos(y / 140.0)
            d2 = np.sin((x + y) / 80.0) * 0.5
            disp_arr = (d1 + d2 + 1.5) / 3.0
        elif landscape == "forest":
            # Bumpy canopy texture
            noise_u8 = (np.random.uniform(0.3, 0.7, (1024, 1024)) * 255.0).astype(np.uint8)
            im_noise = Image.fromarray(noise_u8, mode='L').filter(ImageFilter.GaussianBlur(radius=8))
            disp_arr = np.array(im_noise).astype(np.float32) / 255.0
        else: # sparse plains
            # Very gentle tilt
            disp_arr = 0.2 + 0.1 * (x / 1024.0) + 0.05 * (y / 1024.0)

        disp_arr = np.clip(disp_arr, 0.0, 1.0)
        disp_u16 = (disp_arr * 65535.0).astype(np.uint16)
        Image.fromarray(disp_u16).save(disp_path)

    print("All preset optical and 16-bit displacement textures generated successfully in backend/static/demo_data/")

if __name__ == "__main__":
    generate_textures()
