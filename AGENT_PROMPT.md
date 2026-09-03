# Agent Context: DepthWizard
ISRO Problem Statement 26175 · Smart India Hackathon 2026 · Target: Sept 10

## Mission
Single-view optical satellite imagery → calibrated Digital Surface Model (DSM)
→ interactive 3D flythrough in the browser, with defensible RMSE/MAE accuracy
metrics.

## Hardware Constraints
- Presentation machine: Intel Core i3-10110U, integrated Intel UHD Graphics
  (~1GB shared VRAM), ~8GB RAM, Windows/PowerShell.
- Runtime: Python 3.13, Node.js 24.x, Git 2.53.
- Do not run PyTorch training or multi-epoch vision loops on this machine —
  it will overheat/crash. Run heavy inference (e.g. Depth-Anything-V2-Small
  on GAMUS / HDF5 tiles) on a cloud GPU (Colab T4) and export lightweight
  16-bit displacement PNGs, float32 GeoTIFF rasters, or ONNX models.
- The local app (FastAPI + Three.js) only serves precomputed/lightweight
  inference results; GPU vertex displacement shaders keep the 3D viewport at
  a steady 60 FPS on integrated graphics.

## Stack
FastAPI (Python 3.13), Uvicorn, Pydantic v2, Rasterio, NumPy, SciPy, h5py,
Pillow · SQLite (`depth.db`) · Vite 6 + vanilla JS + Three.js r170 + Chart.js.
No heavy frontend frameworks (no React, no Tailwind).

## Core Math
- Inverted relative depth: `d_rel = 1.0 - d_norm`
- Metric elevation calibration: `Z_metric = s * d_rel + t` (aligned against
  Copernicus DEM GLO-30 / SRTM 30m)
- Height above ground: `h_AGL = Z_metric - Z_ground`

## Reference Docs
Consult `/docs` before making architectural changes:
- `docs/01_PRD.md` — requirements, scope, acceptance criteria
- `docs/02_ARCHITECTURE.md` — architecture, request sequences, module ownership
- `docs/03_TECH_STACK.md` — stack and constraints
- `docs/04_DATABASE_AND_STORAGE.md` — SQLite schema, access layer, storage layout
- `docs/05_TRD_AND_API_SPECS.md` — API contracts, validation, error codes
- `docs/06_ELEVATION_PIPELINE.md` — inference, calibration, AGL, export, metrics
- `docs/07_FRONTEND_IMPLEMENTATION.md` — Three.js terrain, flight, picking, charts

Implementation code belongs in the modules listed in `02_ARCHITECTURE.md`;
`06` and `07` carry the reference implementations for each stage.

## Roadmap
- [ ] **Phase 1 — Data & DB scaffolding:** initialize `depth.db`
      (`backend/db/init_db.py`); set up Colab notebook for ML inference;
      scaffold Vite + Three.js frontend.
- [ ] **Phase 2 — Core elevation & 3D displacement:** implement
      `backend/services/calibrator.py` (`Z = s*d + t`); implement Three.js
      vertex displacement + texture draping (`frontend/src/3d/terrain.js`).
- [ ] **Phase 3 — Flight & inspection tools:** camera flight spline
      (`frontend/src/3d/cameraFlight.js`); point inspection (`/api/inspect`)
      and cross-section transect (`/api/transect` + Chart.js).
- [ ] **Phase 4 — Validation & presets:** package the 4 demo scenes (Urban,
      Sparse Plains, Mountains, Forest); compute RMSE/MAE/Pearson r in
      `backend/eval/metrics.py`.
- [ ] **Phase 5 — Offline lock & rehearsal:** verify fully air-gapped
      operation; finalize presentation deck and backup demo video.
