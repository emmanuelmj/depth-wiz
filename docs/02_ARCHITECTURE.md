# 🏗️ System Architecture & Data Flow
## Project DepthWizard — ISRO Problem Statement 26175

---

## 1. High-Level Architecture (The LEGO Block Explanation)

Think of DepthWizard like a 4-station assembly line:

```
[Satellite Image] ──▶ [Station 1: AI Depth Engine] ──▶ [Station 2: Metric Calibrator]
                                                                  │
┌─────────────────────────────────────────────────────────────────┘
▼
[Station 3: Local SQLite & File Storage] ──▶ [Station 4: 3D WebGL Flythrough Studio]
```

1. **Station 1 (AI Depth Engine):** Takes the 2D photo and creates a raw height grayscale map (where bright pixels are tall and dark pixels are low).
2. **Station 2 (Metric Calibrator):** Checks if the photo has GPS coordinates. If yes, it pulls coarse real-world elevation from satellite radar baselines (SRTM/Copernicus 30m) and converts pixel brightness into **real meters** ($s \cdot d_{rel} + t$).
3. **Station 3 (Database & Storage):** Stores the metadata, elevation grids, point annotations, and benchmark logs cleanly on your computer.
4. **Station 4 (3D Flythrough Studio):** Takes the height values and satellite photo, pushes them to your graphics chip (GPU) inside your web browser, bends a flat 3D grid into hills and skyscrapers, and lets you fly around it at 60 FPS.

---

## 2. End-to-End System Block Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                             TIER 1: USER CLIENT                             │
│                         (Web Browser - Chrome / Edge)                       │
│                                                                             │
│  ┌───────────────────────┐   ┌───────────────────────┐   ┌───────────────┐  │
│  │   2D Control HUD      │   │  Three.js 3D Canvas   │   │  Chart.js 2D  │  │
│  │ - Upload / Presets    │   │ - Terrain Mesh Shader │   │  Cross-Section│  │
│  │ - Layer Toggles       │   │ - Texture Draping     │   │  Profile View │  │
│  │ - Telemetry Readout   │   │ - Drone / Orbit Cam   │   │  Slice Tray   │  │
│  └───────────┬───────────┘   └───────────▲───────────┘   └───────▲───────┘  │
│              │                           │                       │          │
└──────────────┼───────────────────────────┼───────────────────────┼──────────┘
               │ REST HTTP (JSON)          │ Height / Texture PNGs │ Array    
┌──────────────▼───────────────────────────┴───────────────────────┴──────────┐
│                         TIER 2: LOCAL BACKEND SERVICE                       │
│                          (FastAPI / Python 3.13)                            │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │ API Routing Layer (main.py)                                           │  │
│  │ - /api/scenes             - /api/upload          - /api/predict       │  │
│  │ - /api/inspect-point      - /api/profile-slice   - /api/benchmarks    │  │
│  └───────────────┬───────────────────────────────────────┬───────────────┘  │
│                  │                                       │                  │
│  ┌───────────────▼───────────────┐       ┌───────────────▼───────────────┐  │
│  │    Geospatial Engine          │       │    Metric Calibration Core    │  │
│  │ - Rasterio (GeoTIFF metadata) │       │ - Affine Scaler: s*d + t      │  │
│  │ - H5py (HDF5 parsing)         │       │ - SRTM / Copernicus Alignment │  │
│  │ - GDAL coordinate transforms  │       │ - Above Ground Level (h_AGL)  │  │
│  └───────────────┬───────────────┘       └───────────────┬───────────────┘  │
└──────────────────┼───────────────────────────────────────┼──────────────────┘
                   │                                       │                  
┌──────────────────▼───────────────────────────────────────▼──────────────────┐
│                         TIER 3: DATA & STORAGE LAYER                        │
│                                                                             │
│  ┌───────────────────────────────┐       ┌───────────────────────────────┐  │
│  │  SQLite Database (depth.db)   │       │  Local File System Store      │  │
│  │ - scenes table                │       │  /data/optical/ (.png, .tif)  │  │
│  │ - ground_truths table         │       │  /data/dsm/ (calibrated .tif) │  │
│  │ - benchmark_results table     │       │  /data/cache/ (16-bit PNGs)   │  │
│  │ - point_inspections table     │       │  /data/baselines/ (SRTM tiles)│  │
│  └───────────────────────────────┘       └───────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Tier-by-Tier Breakdown

### Tier 1: Frontend Client (Vite + Three.js)
- **Why It's Fast:** It uses **GPU Vertex Displacement**. Instead of the CPU building thousands of 3D triangles, the frontend loads the height map as a black-and-white picture (height texture). The graphics card (Intel UHD) moves the vertices up and down in parallel in nanoseconds.
- **Dynamic Texture Draping:** The satellite color photo is passed to the fragment shader and draped over the bumps, so trees, roofs, and asphalt stick to their correct 3D elevations.

### Tier 2: Backend Service (FastAPI)
- **Why FastAPI:** It is fast, native to Python 3.13, automatically generates interactive Swagger API docs (`/docs`), and easily interfaces with scientific packages (`numpy`, `rasterio`, `scipy`).
- **Separation of Concerns:** 
  - Hasini implements the FastAPI routes and validation error formulas (`services/benchmarks.py`).
  - Dheer implements the SQLite database queries and model pipeline integration.
  - You (Lead) implement the mathematical affine calibration inside `services/calibrator.py`.

### Tier 3: Cloud ML vs Local Inference
- **In the Cloud (Google Colab T4 GPU):** Dheer runs the heavy PyTorch `Depth-Anything-V2` foundation model on satellite patches (`earthflow/GAMUS` and `DC_03_26_RGB.h5`), verifies convergence, and exports lightweight ONNX models or precomputed GeoTIFF rasters for the 4 demo scenes.
- **On the Local Laptop:** The local app runs in fast demonstration mode: it serves pre-computed calibrated models instantly or processes user uploads with an ONNX/CPU runner, guaranteeing 0 second lag in front of the judges.

---

## 4. Key Architectural Patterns (Preventing Team Chaos)

1. **The Contract-First Pattern:** The backend and frontend communicate exclusively via standard JSON contracts (detailed in `05_TRD_AND_API_SPECS.md`). Tarun, Aarav, and Spoorthy can build the entire UI and 3D viewport using mock JSON data without waiting for the Python AI pipeline to finish!
2. **Preset Caching:** All 4 benchmark scenes (Urban, Sparse, Mountain, Forest) have their textures, calibrated DSMs, and ground truth metrics stored locally. When a judge clicks "Mountain Scene", it does not run a 10-second AI calculation—it loads immediately.
3. **Stateless Processing:** Uploaded images do not rely on server session memory. Every scene gets a unique `scene_id` (UUID), and all its assets are cleanly filed in `/data/{scene_id}/`.
