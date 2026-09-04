import os
import h5py
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
STATIC_DIR = BASE_DIR / "static"
DEMO_DIR = STATIC_DIR / "demo_data"
SAMPLE_H5 = BASE_DIR.parent / "data" / "sample" / "DC_03_26_RGB.h5"

def generate_textures():
    DEMO_DIR.mkdir(parents=True, exist_ok=True)
    dc_folder = DEMO_DIR / "dc-03-26"
    dc_folder.mkdir(parents=True, exist_ok=True)

    optical_path = dc_folder / "optical.png"
    disp_path = dc_folder / "disp_16bit.png"

    # Extract or create GAMUS DC_03_26 textures
    if SAMPLE_H5.exists():
        with h5py.File(SAMPLE_H5, 'r') as f:
            base_rgb = f['image'][:]
        rgb_img = Image.fromarray(base_rgb)
        rgb_img.save(optical_path)
        print(f"Extracted real optical texture from {SAMPLE_H5} -> {optical_path}")
    elif not optical_path.exists():
        base_rgb = np.zeros((1024, 1024, 3), dtype=np.uint8)
        base_rgb[:, :, 0] = 70
        base_rgb[:, :, 1] = 110
        base_rgb[:, :, 2] = 80
        rgb_img = Image.fromarray(base_rgb)
        rgb_img.save(optical_path)

    # Displacement map (16-bit)
    if not disp_path.exists():
        # High dynamic range urban grid baseline
        y, x = np.mgrid[0:1024, 0:1024]
        disp_arr = np.zeros((1024, 1024), dtype=np.float32)
        for bx in range(100, 924, 80):
            for by in range(100, 924, 80):
                h_val = 0.3 + 0.6 * np.sin(bx * 0.05) * np.cos(by * 0.05)
                disp_arr[by:by+50, bx:bx+50] = max(0.1, h_val)
        disp_arr = np.clip(disp_arr, 0.0, 1.0)
        disp_u16 = (disp_arr * 65535.0).astype(np.uint16)
        Image.fromarray(disp_u16).save(disp_path)
        print(f"Generated default 16-bit displacement map -> {disp_path}")

    print("Anchor scene DC_03_26 textures verified in backend/static/demo_data/dc-03-26/")

if __name__ == "__main__":
    generate_textures()

