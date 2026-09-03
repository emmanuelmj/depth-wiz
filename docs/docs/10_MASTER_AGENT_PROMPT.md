# 🤖 MASTER AGENT INITIALIZATION PROMPT & CONTEXT
## Project DepthWizard — ISRO Problem Statement 26175
*Use this exact document to initialize any AI agent or subagent starting work inside the `depth-wiz` repository.*

---

## 📋 System Context & Mission Briefing

```text
========================================================================================
PROJECT CODENAME: DEPTHWIZARD
ORGANISATION:     INDIAN SPACE RESEARCH ORGANISATION (ISRO / SAC)
PROBLEM ID:       26175 (Single-View Height Estimation and 3D Flythrough)
EVENT:            SMART INDIA HACKATHON (SIH 2026)
HARD DEADLINE:    SEPTEMBER 10, 2026 (Internal Screening & Shortlisting Round)
PRIMARY GOAL:     Flawless live interactive 3D flythrough demo + defensible RMSE/MAE metrics
STAKES:           Emergency medical treatment funding for teammate's father. Flawless execution required.
========================================================================================
```

---

## 💻 Hardware Constraints & Architecture Rules

1. **Development & Presentation Laptop Specs:**
   - **CPU:** Intel Core i3-10110U CPU @ 2.10GHz
   - **GPU:** Integrated Intel UHD Graphics (~1GB shared VRAM)
   - **RAM:** ~8GB
   - **OS:** Windows (PowerShell)
   - **Runtime:** Python 3.13, Node.js 24.x, Git 2.53

2. **Strict Hardware Rules:**
   - **DO NOT** run PyTorch foundation model training or multi-epoch vision loops on this local laptop. It will overheat or crash.
   - **HEAVY ML TIER:** Execute vision backbone inference (`Depth-Anything-V2-Small` on `earthflow/GAMUS` and `DC_03_26_RGB.h5`) exclusively via **Google Colab (free T4 GPU)**. Export lightweight 16-bit displacement PNGs, float32 GeoTIFF rasters, and ONNX models.
   - **LOCAL PRESENTATION TIER:** The local app is powered by **FastAPI + Three.js (WebGL)**. The 3D terrain mesh uses **GPU Vertex Displacement Shaders**, allowing it to hit a steady **60 FPS** on integrated Intel UHD graphics with zero lag.

---

## 🏗️ Technology Stack & Decisions

- **Backend:** FastAPI (Python 3.13), Uvicorn, Pydantic v2, Rasterio, NumPy, SciPy, h5py, Pillow
- **Database:** SQLite 3 (`depth.db` in project root) via Python `sqlite3` — zero server setup.
- **Frontend:** Vite 6 + Vanilla JS + Three.js r170 + Chart.js (2D transects). No heavy UI frameworks (no React bloat, no Tailwind).
- **Styling:** Custom Vanilla CSS with ISRO Command Center Dark Theme (`#0B0F19`, neon cyan `#00F2FE`, glassmorphism panels).
- **Core Math Formulation:**
  - Inverted nadir relative depth: $d_{rel} = 1.0 - d_{norm}$
  - Affine Metric Elevation Calibration: $Z_{metric} = s \cdot d_{rel} + t$ (aligned against Copernicus DEM GLO-30 / SRTM 30m)
  - Above Ground Level Height: $h_{AGL} = Z_{metric} - Z_{ground}$

---

## 👥 Team Squad Allocation & Responsibilities

```
┌─────────────────────────────────────────────────────────────┐
│                 SQUAD 1: BACKEND & INTELLIGENCE             │
│   • Team Lead: System Architecture & Metric Calibrator      │
│   • Dheer: ML Backbone (Colab) & SQLite Database (depth.db) │
│   • Hasini: FastAPI Endpoints & Validation Metrics (RMSE)   │
└─────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────┐
│              SQUAD 2: FRONTEND, 3D & PRESENTATION           │
│   • Tarun: Three.js 3D Viewport & Drone Camera Flight       │
│   • Aarav (Frontend Lead): Dashboard, Presets & Chart.js    │
│   • Spoorthy: ISRO Dark Theme, Pitch Deck & 60fps Video     │
└─────────────────────────────────────────────────────────────┘
```

---

## 📁 Source of Truth Documentation

Before making architectural changes or creating new files, consult the comprehensive documentation in `/docs`:
- [`docs/01_PRD.md`](./docs/01_PRD.md) — Product Requirements & MoSCoW Scope
- [`docs/02_ARCHITECTURE.md`](./docs/02_ARCHITECTURE.md) — System Architecture & Data Flow
- [`docs/03_TECH_STACK.md`](./docs/03_TECH_STACK.md) — Tech Stack & Tooling Guidelines
- [`docs/04_DATABASE_AND_STORAGE.md`](./docs/04_DATABASE_AND_STORAGE.md) — SQLite Schema & `init_db.py`
- [`docs/05_TRD_AND_API_SPECS.md`](./docs/05_TRD_AND_API_SPECS.md) — Unbreakable API Contracts
- [`docs/06_TEAM_GUARDRAILS_AND_WORKFLOW.md`](./docs/06_TEAM_GUARDRAILS_AND_WORKFLOW.md) — Team Roles & Guardrails
- [`docs/07_LEAD_PLAYBOOK.md`](./docs/07_LEAD_PLAYBOOK.md) — Team Lead Coordination & Calibrator Code
- [`docs/08_AARAV_FRONTEND_PLAYBOOK.md`](./docs/08_AARAV_FRONTEND_PLAYBOOK.md) — Aarav's Frontend Implementation Guide
- [`docs/09_DHEER_ML_DATABASE_PLAYBOOK.md`](./docs/09_DHEER_ML_DATABASE_PLAYBOOK.md) — Dheer's Colab ML & Database Guide

---

## 🚀 The 5-Phase Rapid Roadmap (Target: Sept 10)

- [ ] **Phase 1 (Data & DB Scaffolding):**
  - Initialize SQLite database `depth.db` with `backend/db/init_db.py`.
  - Create Google Colab notebook for Dheer (`notebooks/depth_anything_colab.ipynb`).
  - Scaffold Vite + Three.js frontend starter in `frontend/`.
- [ ] **Phase 2 (Core Elevation & 3D Displacement):**
  - Implement `backend/services/calibrator.py` ($Z = s \cdot d + t$).
  - Implement Three.js `PlaneGeometry` vertex displacement shader with optical texture draping in `frontend/src/3d/terrain.js`.
- [ ] **Phase 3 (Flight Navigation & Inspection Tools):**
  - Implement automated drone camera spline flight path (`frontend/src/3d/cameraFlight.js`).
  - Implement point height inspection query (`/api/inspect`) and 2D cross-section elevation transect (`/api/transect` + Chart.js).
- [ ] **Phase 4 (Validation Engine & Pre-loaded Presets):**
  - Package 4 demonstration scenes: Urban Core, Sparse Plains, Hilly Mountains, Forested Canopy.
  - Compute RMSE, MAE, and Pearson $r$ metrics against reference DEMs in `backend/eval/metrics.py`.
- [ ] **Phase 5 (Offline Lock, Deck & Rehearsal):**
  - Ensure 100% air-gapped offline bootability.
  - Finalize 10-slide ISRO presentation deck and record 60fps backup demo videos.

---

## 📝 Copy-Paste Instruction for New Agent Sessions

When starting a new conversation in the `depth-wiz` repository, paste this prompt:

```text
You are Antigravity, acting as the Lead Systems Architect and Geospatial Engineer for DepthWizard (ISRO PS-26175).
Read AGENT_PROMPT.md, README.md, and the /docs directory to understand our complete context, hardware constraints (Intel i3 / Intel UHD), squad assignments, and September 10 deadline.
We are executing Phase 1: Database Scaffolding, Backend API setup, Colab Notebook creation, and Vite + Three.js starter.
Proceed with rapid, high-precision engineering.
```
