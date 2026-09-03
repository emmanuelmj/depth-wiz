# 🧠 Dheer's ML & Database Playbook: Foundation Models & Data Engineering
## Project DepthWizard — ISRO Problem Statement 26175
*Author: ML Foundation & Database Lead (Dheer)*

---

## 1. Role Overview & Your Mission
As the ML Foundation & Database Lead, your mission is twofold:
1. **Machine Learning Pipeline (Cloud Colab):** Deploy `Depth-Anything-V2-Small` on Google Colab (with free NVIDIA T4 GPU) to generate high-resolution, boundary-sharp height maps for satellite imagery (`earthflow/GAMUS` dataset and `DC_03_26_RGB.h5`).
2. **Data & Database Persistence (Local):** Build and maintain the SQLite database (`depth.db`) and manage the file storage directories for optical tiles, height textures, and ground truth baselines.

---

## 2. Machine Learning: The Google Colab T4 Pipeline

> [!IMPORTANT]
> **Why Cloud Colab?** Our local presentation laptop runs an Intel Core i3 with integrated Intel UHD Graphics. Running heavy Vision Transformer inference or fine-tuning locally will freeze the machine. Always execute your ML scripts in Google Colab with a free T4 GPU!

### Step 1: Setting up the Google Colab Notebook
1. Open [Google Colab](https://colab.research.google.com).
2. Go to **Runtime $\rightarrow$ Change runtime type $\rightarrow$ Hardware accelerator: T4 GPU**.
3. Install required libraries:
   ```python
   !pip install torch torchvision transformers datasets h5py pillow rasterio scipy
   !git clone https://github.com/DepthAnything/Depth-Anything-V2.git
   ```

### Step 2: Running Inference on `DC_03_26_RGB.h5`
Upload `DC_03_26_RGB.h5` to your Colab session and run this inference cell:
```python
import h5py
import numpy as np
import torch
from PIL import Image
from depth_anything_v2.dpt import DepthAnythingV2

# 1. Load the model (small model is ultra-fast and sharp)
device = 'cuda' if torch.cuda.is_available() else 'cpu'
model = DepthAnythingV2(encoder='vits', features=64, out_channels=[48, 96, 192, 384])
model.load_state_dict(torch.load('checkpoints/depth_anything_v2_vits.pth', map_location='cpu'))
model.to(device).eval()

# 2. Extract optical RGB array from H5
with h5py.File('DC_03_26_RGB.h5', 'r') as f:
    rgb_array = f['image'][:] # shape (1024, 1024, 3)

# 3. Predict Depth
with torch.no_grad():
    depth_raw = model.infer_image(rgb_array) # 2D numpy array

# 4. Nadir Remote Sensing Inversion & Normalization
# High structures must be high elevation values (0.0 to 1.0)
depth_norm = (depth_raw - depth_raw.min()) / (depth_raw.max() - depth_raw.min())
depth_inverted = 1.0 - depth_norm  # Invert so ground=0, roofs=1.0

# 5. Export 16-bit Grayscale Displacement Texture for Three.js
depth_uint16 = (depth_inverted * 65535.0).astype(np.uint16)
Image.fromarray(depth_uint16).save('sample_displacement_16bit.png')

# 6. Export Optical PNG for Texture Draping
Image.fromarray(rgb_array).save('sample_optical.png')
print("Successfully generated optical and 16-bit displacement textures!")
```

### Step 3: Preparing the 4 Precomputed Benchmark Scenes
You must prepare and save the demonstration package for the 4 core ISRO landscape categories:
1. 🏙️ `urban-ahmedabad-01` (Dense high-rises and buildings)
2. 🌾 `sparse-plains-02` (Open fields, flat roads, sparse trees)
3. ⛰️ `mountain-himalayas-03` (Steep peaks, ridges, valleys)
4. 🌲 `forest-western-ghats-04` (Dense canopy height variation)

For each scene, you will provide:
- `optical.png` ($1024 \times 1024$ optical satellite color image)
- `disp_16bit.png` (16-bit normalized height texture for Three.js)
- `calibrated_metric.tif` (GeoTIFF calibrated in real meters)
- `ground_truth.tif` (Reference Copernicus 30m / SRTM elevation tile)

---

## 3. Database Engineering: SQLite (`depth.db`)

You own `backend/db/init_db.py` and `backend/db/queries.py`.

### Task 1: Database Initialization (`backend/db/init_db.py`)
Run the schema script from `docs/04_DATABASE_AND_STORAGE.md` to create the 5 tables:
- `scenes` (Metadata, bounding boxes, file paths)
- `ground_truths` (Reference DEM paths, datum, resolution)
- `benchmark_metrics` (RMSE, MAE, Pearson $r$ scores)
- `point_inspections` (Clicked landmark heights and coordinates)
- `transect_profiles` (2D elevation cross-section arrays)

### Task 2: Database Query Helper Functions (`backend/db/queries.py`)
Write clean Python helper functions for Hasini and Aarav:

```python
import sqlite3
import json

DB_PATH = "depth.db"

def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def get_all_scenes():
    conn = get_db_connection()
    rows = conn.execute("SELECT * FROM scenes").fetchall()
    conn.close()
    return [dict(r) for r in rows]

def get_scene_by_id(scene_id: str):
    conn = get_db_connection()
    row = conn.execute("SELECT * FROM scenes WHERE id = ?", (scene_id,)).fetchone()
    conn.close()
    return dict(row) if row else None

def get_benchmarks():
    conn = get_db_connection()
    rows = conn.execute("""
        SELECT b.*, s.name as scene_name 
        FROM benchmark_metrics b
        JOIN scenes s ON b.scene_id = s.id
    """).fetchall()
    conn.close()
    return [dict(r) for r in rows]

def save_point_inspection(scene_id, label, x, y, lat, lon, elev, h_agl):
    conn = get_db_connection()
    conn.execute("""
        INSERT INTO point_inspections 
        (scene_id, label, pixel_x, pixel_y, lat, lon, elevation_z_m, height_agl_m)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, (scene_id, label, x, y, lat, lon, elev, h_agl))
    conn.commit()
    conn.close()
```

---

## 4. Handoff & Integration Checklist

Once you complete your tasks, hand off assets cleanly:
1. **Handoff to Hasini:** Tell Hasini that `queries.py` is ready and that she can call `get_all_scenes()` and `get_benchmarks()` directly inside her FastAPI endpoints.
2. **Handoff to Aarav:** Place the 4 precomputed scene folders into `backend/static/demo_data/` so the frontend can load them via HTTP.
3. **Handoff to Team Lead:** Provide the raw depth array NumPy files (`.npy`) so the Lead can calibrate them against Copernicus DEM baselines.
4. **Secondary Project Support:** Once your DepthWizard ML and DB deliverables are tested and committed, you can assist the team's cyber attack forecasting project!
