# 👥 Team Guardrails, Roles & Git Workflow
## Project DepthWizard — ISRO Problem Statement 26175

---

## 1. Squad Structure & Zone of Ownership

To maximize velocity and ensure modular execution, the team is split into two focused 3-person squads:  
**Backend & Intelligence Squad** and **Frontend, 3D & Presentation Squad**.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       SQUAD 1: BACKEND & INTELLIGENCE                       │
├──────────────┬──────────────────┬──────────────────────┬────────────────────┤
│ Member       │ Role Title       │ Assigned Directory   │ Primary Deliverable│
├──────────────┼──────────────────┼──────────────────────┼────────────────────┤
│ You (Lead)   │ Chief Architect  │ `backend/services/`  │ Metric Calibrator  │
│              │ & Integrator     │ `backend/core/`      │ & Final Merge      │
├──────────────┼──────────────────┼──────────────────────┼────────────────────┤
│ Dheer        │ ML Foundation &  │ `notebooks/`         │ Colab Pipeline,    │
│              │ Database Lead    │ `backend/db/`        │ SQLite & Models    │
├──────────────┼──────────────────┼──────────────────────┼────────────────────┤
│ Hasini       │ API & Validation │ `backend/api/`       │ FastAPI Endpoints, │
│              │ Engineer         │ `backend/eval/`      │ Metrics (RMSE/MAE) │
└──────────────┴──────────────────┴──────────────────────┴────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                 SQUAD 2: FRONTEND, 3D & PRESENTATION                        │
├──────────────┬──────────────────┬──────────────────────┬────────────────────┤
│ Member       │ Role Title       │ Assigned Directory   │ Primary Deliverable│
├──────────────┼──────────────────┼──────────────────────┼────────────────────┤
│ Tarun        │ 3D Graphics      │ `frontend/src/3d/`   │ Three.js Viewport, │
│              │ Engineer         │                      │ Shaders & Drone Cam│
├──────────────┼──────────────────┼──────────────────────┼────────────────────┤
│ Aarav        │ UI Engineering & │ `frontend/src/hud/`  │ Dashboard, Presets,│
│              │ Analytics Dev    │ `frontend/src/chart/`│ Chart.js Profile   │
├──────────────┼──────────────────┼──────────────────────┼────────────────────┤
│ Spoorthy     │ UI Polish, Deck  │ `frontend/src/styles`│ UI Theme, 10-Slide │
│              │ & Media Lead     │ `presentation/`      │ Deck & Backup Video│
└──────────────┴──────────────────┴──────────────────────┴────────────────────┘
```

---

## 2. Squad 1: Backend & Intelligence Breakdown

### 👑 You (Team Lead & Chief Integrator)
- **Primary Ownership:** System architecture, scientific accuracy, and end-to-end integration.
- **Key Tasks:**
  - Build the **Metric Elevation Calibration Math** (`backend/services/calibrator.py`): Mapping relative depth $d_{rel}$ to Copernicus 30m / SRTM elevation using the affine formula $Z = s \cdot d_{rel} + t$.
  - Review and merge all pull requests from both squads.
  - Ensure the local system runs 100% offline without internet dependencies on your presentation laptop.

### 👨‍💻 Dheer (ML Foundation & Database Lead)
- **Primary Ownership:** The AI model backbone and data persistence layer.
- **Key Tasks:**
  - **Machine Learning:** Setup Google Colab notebook running `Depth-Anything-V2-Small` on the `earthflow/GAMUS` dataset and the local `DC_03_26_RGB.h5` satellite tile.
  - Export lightweight ONNX models and precomputed demonstration rasters for the 4 core landscape types (Urban, Sparse, Mountain, Forest).
  - **Database:** Implement the SQLite database (`depth.db`) and initialization script (`backend/db/init_db.py`) defined in `04_DATABASE_AND_STORAGE.md`.
  - Write database query helper functions (`get_scene`, `save_inspection`, `get_benchmarks`).
  - Assist the secondary cyber attack forecasting project when ML/DB tasks are completed.

### 👩‍💻 Hasini (API & Validation Engineer)
- **Primary Ownership:** Core REST APIs and evaluation metrics.
- **Key Tasks:**
  - **FastAPI Endpoints:** Build the REST API routes (`backend/api/routes.py`) defined in `05_TRD_AND_API_SPECS.md` (`/api/scenes`, `/api/inspect`, `/api/transect`, `/api/benchmarks`).
  - Test every endpoint interactively at `http://localhost:8000/docs` using Swagger UI.
  - **Accuracy Metrics (`backend/eval/metrics.py`):** Implement standard formulas for **RMSE**, **MAE**, and **Pearson $r$** using NumPy to validate predictions against ground truth tiles.

---

## 3. Squad 2: Frontend, 3D & Presentation Breakdown

### 👨‍💻 Tarun (3D Graphics Engineer — WebGL & Three.js)
- **Primary Ownership:** 3D viewport, shaders, and camera navigation.
- **Key Tasks:**
  - Create the Three.js viewport in `frontend/src/3d/terrain.js` using `PlaneGeometry`.
  - Implement GPU vertex displacement using the 16-bit height map texture.
  - Implement satellite optical texture draping over the displaced 3D terrain.
  - Implement the **"▶ CINEMATIC FLIGHT"** smooth drone camera path using Three.js `CatmullRomCurve3` spline animation.

### 👨‍💻 Aarav (UI Engineering & Analytics Dev)
- **Primary Ownership:** Dashboard interactions, HUD telemetry, and analytical charts.
- **Key Tasks:**
  - Build the dashboard layout: top telemetry bar, left-side control panel, and preset cards.
  - Implement the 4 one-click preset buttons (**Urban, Sparse, Mountain, Forest**) that trigger scene loading.
  - Integrate **Chart.js** in a slide-up tray to display the 2D cross-section elevation profile when the user slices through terrain.
  - Build the Point Inspection popup modal displaying lat/lon, elevation, and height above ground level (AGL).

### 👩‍💼 Spoorthy (UI Polish, Pitch Deck & Backup Media Lead)
- **Primary Ownership:** Visual design polish, presentation narrative, and fail-safe video backups.
- **Key Tasks:**
  - **UI Polish:** Style the application in `frontend/src/styles/` with the defense-grade ISRO dark theme (deep slate `#0B0F19`, glowing cyan telemetry accents `#00F2FE`).
  - **Presentation Deck:** Create the winning 10-slide PowerPoint following the official ISRO problem statement rubric.
  - **Timed Pitch Script:** Write and rehearse the 5-to-7 minute presentation script answering all expected evaluator questions.
  - **Bulletproof Video Fallback:** Screen-record high-bitrate 60 FPS video walkthroughs of the 3D flythrough and measurement tools to embed directly into the slide deck in case presentation hardware or projectors fail.

---

## 4. Git Protocol & Branching Standard

```
main (Protected: tested, bootable code only)
 ├── feat/backend-ml-db      (Dheer)
 ├── feat/backend-api-eval   (Hasini)
 ├── feat/frontend-3d        (Tarun)
 ├── feat/frontend-hud-chart (Aarav)
 └── docs/presentation       (Spoorthy)
```

### Team Rules for Git
1. **Never commit large files:** Keep all `.tif`, `.h5`, `.pth`, `.onnx`, and `.db` files in `.gitignore`.
2. **Never push directly to `main`:** All merges are tested locally and merged by the Team Lead.
3. **Daily Sync (10 Minutes):** Quick check-in every evening to verify API contracts and unblock any dependencies.

---

## 5. Phase-by-Phase Night-Out Execution Timeline

| Phase | Milestone | Backend Squad | Frontend Squad | Target |
| :--- | :--- | :--- | :--- | :--- |
| **Phase 1** | Scaffolding & Data Plumbing | Dheer sets up Colab & `depth.db`; Hasini scaffolds FastAPI | Tarun creates Three.js plane; Aarav builds HUD layout | Night 1 (Sept 4) |
| **Phase 2** | Depth Inference & 3D Displacement | Dheer exports demo rasters; Lead codes metric calibrator | Tarun completes height displacement & texture draping | Night 2 (Sept 5) |
| **Phase 3** | Inspection Tools & UI Integration | Hasini connects `/api/inspect` & `/api/transect` endpoints | Aarav connects Chart.js profile; Tarun adds drone spline | Night 3 (Sept 6) |
| **Phase 4** | Validation Benchmarks & UI Polish | Hasini runs RMSE/MAE benchmarks; Dheer finalizes DB cache | Aarav adds preset cards; Spoorthy polishes dark theme | Night 4 (Sept 7) |
| **Phase 5** | Rehearsal, Offline Lock & Slides | Lead & Backend team lock offline air-gapped demo | Spoorthy completes 10-slide deck & records 60fps video | Night 5 (Sept 8-9) |
| **D-Day** | Internal Screening Evaluation | **Flawless Live Demo & Shortlisting Victory** | **Flawless Live Demo & Shortlisting Victory** | **Sept 10** |
