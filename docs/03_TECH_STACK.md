# Technology Stack

| Component | Technology | Purpose |
|---|---|---|
| Backend language | Python 3.13.x | Core logic & APIs |
| Web framework | FastAPI 0.115.x + Uvicorn | REST API server |
| Geospatial I/O | Rasterio 1.4.x / GDAL | GeoTIFF CRS & bounds |
| Numerical core | NumPy 2.3.x + SciPy 1.15.x | Affine math, RANSAC |
| HDF5 I/O | h5py 3.16.x | Satellite raster data |
| Image utilities | Pillow (PIL) 12.3.x | Image normalization |
| Database | SQLite 3 (stdlib) | Scene & metric store |
| Model inference | PyTorch (training) / ONNX Runtime (serving) | Depth foundation model |
| Frontend runtime | Node.js 24.x + Vite 6.x | Dev server & bundling |
| 3D engine | Three.js r170+ | WebGL terrain render |
| 2D charting | Chart.js 4.x | Elevation profile |
| Styling | Vanilla CSS3 | UI theme |

## Rationale
- **FastAPI** over Django/Flask: lighter weight, async-native, auto-generates
  interactive docs at `/docs` for manual endpoint testing.
- **Three.js** over Unity/CesiumJS: pure JS, runs in-browser at 60 FPS on
  integrated GPUs with no install; CesiumJS is overkill for fixed
  1024×1024 local tiles, Unity requires a heavy engine/build step.
- **SQLite** over PostgreSQL/PostGIS: single-file, zero server setup, ships
  inside the repo.
- **Cloud training / local inference:** Model training (Depth-Anything-V2)
  runs on a cloud GPU (e.g. Colab T4); the local app only runs
  lightweight ONNX/CPU inference or serves precomputed results.

## Constraints
- Do not add heavy UI component libraries (Material-UI, Tailwind, Chakra) —
  use vanilla CSS with CSS variables.
- Do not run multi-epoch PyTorch training locally — train on a cloud GPU only.
- Do not introduce PostgreSQL/MySQL/MongoDB — all relational data goes in
  the local `depth.db` SQLite file.
- Do not commit `.tif`, `.pth`, `.h5`, or `.onnx` files >10MB to git — keep
  them in `.gitignore` and distribute separately.

## Setup

### Backend
```bash
pip install fastapi uvicorn pydantic rasterio scipy h5py pillow
```

### Frontend
```bash
cd frontend
npm install three chart.js
npm run dev
```

### Model training (cloud GPU, e.g. Colab)
```bash
!pip install torch torchvision transformers datasets h5py pillow
```
