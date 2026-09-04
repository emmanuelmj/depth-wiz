# 🛰️ DepthWizard — ISRO Problem Statement 26175
### Single-View Height Estimation and 3D Flythrough
**Smart India Hackathon (SIH 2026) · Target: September 10**

---

## ⚡ Quick Start Runbook

### 1. Backend & Database Setup (Python 3.13)
```powershell
# 1. Install backend dependencies
pip install -r backend/requirements.txt

# 2. Initialize the SQLite database & seed presets
python backend/db/init_db.py

# 3. Generate initial demo textures (if not already built)
python backend/utils/generate_mock_textures.py

# 4. Start the FastAPI backend server
python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload
```
- Interactive API Swagger Docs: `http://127.0.0.1:8000/docs`
- Health Check: `http://127.0.0.1:8000/api/health`

---

### 2. Frontend 3D Dashboard (Vite + Three.js + Chart.js)
```powershell
# 1. Move to frontend directory & install dependencies
cd frontend
npm install

# 2. Launch Vite dev server
npm run dev
```
- Open in browser: `http://localhost:5173`
- *Note:* The frontend has an automatic mock data fallback in `src/mockData.js`. The 3D viewport, drone flight, and 2D charts work immediately at 60 FPS even if the backend is offline.

---

### 3. ML Track & Dual Benchmark Run (Google Colab T4)
We run dual parallel inference/fine-tuning pipelines to select the champion model with the lowest RMSE/MAE:
1. Open [Google Colab](https://colab.research.google.com).
2. Upload `notebooks/depth_anything_colab.ipynb`.
3. Set **Runtime → Change runtime type → T4 GPU**.
4. Run all cells to execute `Depth-Anything-V2-Small` inference on `DC_03_26_RGB.h5`, apply nadir inversion ($1.0 - d$), and export `disp_16bit.png` and `d_rel.npy`.
5. Drop exported outputs into `backend/static/demo_data/`.

---

## 📁 Repository Structure
```
depth-wiz/
├── backend/
│   ├── api/routes.py            # FastAPI REST API endpoints
│   ├── db/
│   │   ├── init_db.py           # SQLite schema creation & seed data
│   │   └── queries.py           # Parameterized SQL query helpers
│   ├── services/
│   │   ├── calibrator.py        # Affine least-squares & RANSAC calibration
│   │   ├── agl.py               # Bare-earth morphological filter & AGL height
│   │   └── exporter.py          # 16-bit PNG & GeoTIFF exporters
│   ├── static/demo_data/        # 4 Precomputed demo scene bundles
│   ├── utils/
│   │   └── generate_mock_textures.py
│   ├── main.py                  # FastAPI application entrypoint
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── 3d/
│   │   │   ├── terrain.js       # Three.js GPU vertex displacement & draping
│   │   │   ├── cameraFlight.js  # Catmull-Rom drone flight spline
│   │   │   └── picking.js       # Raycast UV-to-raster pixel mapper
│   │   ├── chart/profileChart.js# Chart.js 2D transect drawer
│   │   ├── hud/
│   │   │   ├── presets.js       # 4 Preset cards UI
│   │   │   ├── inspector.js     # Floating point inspection HUD badge
│   │   │   └── layers.js        # Optical / Heatmap / Wireframe switcher
│   │   ├── styles/theme.css     # ISRO dark theme (#0B0F19, #00F2FE)
│   │   ├── api.js               # API client with offline fallback
│   │   ├── mockData.js          # Contract-compliant mock data
│   │   └── main.js              # Viewport orchestration & render loop
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
├── notebooks/
│   └── depth_anything_colab.ipynb # Google Colab T4 inference & validation
├── data/
│   └── sample/DC_03_26_RGB.h5   # Sample satellite RGB tile
├── docs/                        # Complete technical architecture & PRD
├── depth.db                     # SQLite database catalog
├── AGENT_PROMPT.md              # Master agent initialization prompt
└── README.md
```

---

## 🎯 Verification & Acceptance Checklist
- [x] SQLite database `depth.db` initialized with 5 tables & seeded presets.
- [x] FastAPI server active with `/api/health`, `/api/scenes`, `/api/benchmarks`.
- [x] Three.js terrain displacement shader rendering at 60 FPS on integrated graphics.
- [x] Cinematic drone camera flight path functioning.
- [x] Point elevation inspection & Chart.js 2D cross-section profile functional.
- [x] Google Colab notebook ready for Dual Run model benchmarking.
