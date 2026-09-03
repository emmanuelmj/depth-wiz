# DepthWizard: Single-View Height Estimation & 3D Flythrough
ISRO Problem Statement 26175 · Smart India Hackathon 2026

## Overview
DepthWizard turns a single optical RGB satellite image into a calibrated
Digital Surface Model (DSM) and an interactive 3D flythrough in the browser.

- **Non-georeferenced imagery** (`.png`, `.jpg`) → normalized relative DSM
  (`rDSM`) for height structure inspection.
- **Georeferenced imagery** (`.tif`/GeoTIFF) → absolute metric DSM
  (`Z_metric`, in meters) via affine calibration against SRTM 30m /
  Copernicus GLO-30 elevation baselines.

## Project Layout
```
DepthWizard/
├── backend/            # FastAPI service (Python 3.13)
│   ├── api/             # Route handlers (/api/scenes, /api/inspect, ...)
│   ├── core/             # Pipeline coordinator & image ingestion
│   ├── services/          # Affine metric calibrator, AGL computation
│   ├── db/                 # SQLite (depth.db) & query helpers
│   ├── eval/                # RMSE/MAE/Pearson r validation
│   └── main.py                # Entrypoint & CORS middleware
├── frontend/            # Vite + Three.js client
│   ├── src/3d/           # Terrain viewport, displacement, camera flight
│   ├── src/hud/           # Controls, presets, layer toggles
│   ├── src/chart/          # Chart.js elevation cross-section
│   └── src/styles/          # UI theme
├── notebooks/           # Colab ML inference / GAMUS pipelines
├── docs/                # Technical reference docs (see below)
└── data/                # Local file storage (git-ignored)
    ├── optical/           # Input RGB tiles
    ├── dsm/                # Calibrated metric DSM GeoTIFFs
    ├── cache/               # 16-bit displacement PNG textures
    └── ground_truth/         # Reference elevation tiles
```

## Docs
- `docs/01_PRD.md` — scope, requirements, acceptance criteria
- `docs/02_ARCHITECTURE.md` — architecture, request sequences, coordinate conventions
- `docs/03_TECH_STACK.md` — approved stack, rationale, constraints
- `docs/04_DATABASE_AND_STORAGE.md` — SQLite schema, access layer, storage layout
- `docs/05_TRD_AND_API_SPECS.md` — API contracts, validation rules, error codes
- `docs/06_ELEVATION_PIPELINE.md` — inference, affine calibration, AGL, export, metrics
- `docs/07_FRONTEND_IMPLEMENTATION.md` — Three.js terrain, flight, picking, charts

## Team
| Member | Owns | Branch |
|---|---|---|
| Lead | Calibration engine, architecture, merges | `feat/backend-calibrator` |
| Dheer | ML inference pipeline, SQLite database | `feat/backend-ml-db` |
| Hasini | FastAPI endpoints, validation metrics | `feat/backend-api` |
| Tarun | Three.js viewport, camera flight | `feat/frontend-3d` |
| Aarav | Dashboard, presets, Chart.js transect | `feat/frontend-hud-chart` |
| Spoorthy | Theme, deck, demo video | `docs/presentation` |

## Never Commit
- Model checkpoints (`*.pth`, `*.pt`, `*.bin`, `*.onnx`)
- Heavy geospatial rasters (`*.tif`, `*.tiff`, `*.h5`, `*.hdf5`)
- Local databases (`*.db`, `*.sqlite`, `depth.db`)
- `node_modules/`, `__pycache__/`, `.venv/`

## Quickstart

### Backend (Python 3.13)
```bash
pip install fastapi uvicorn pydantic rasterio scipy h5py pillow
python backend/db/init_db.py
uvicorn backend.main:app --reload --port 8000
```
API docs: `http://localhost:8000/docs`

### Frontend (Node.js 24)
```bash
cd frontend
npm install
npm run dev
```
App: `http://localhost:5173`

## Milestones (target: Sept 10)
- [x] Architecture, PRD, tech stack, DB schema, API spec locked (`/docs`)
- [ ] Database initialized & ML inference pipeline running
- [ ] Height displacement shader & texture draping
- [ ] Camera flight & point inspection
- [ ] Validation dashboard & 2D elevation transect
- [ ] Offline test pass, deck, and backup demo video ready
