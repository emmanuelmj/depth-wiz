# 🛰️ DepthWizard: Single-View Height Estimation & 3D Flythrough
### Indian Space Research Organisation (ISRO) — Problem Statement 26175
*Smart India Hackathon (SIH 2026)*

---

## 📖 Overview
DepthWizard is an end-to-end geospatial artificial intelligence pipeline that transforms **single-view optical RGB satellite imagery** into high-precision **Digital Surface Models (DSMs)** and interactive, real-time **3D flythrough environments** directly in the web browser.

The platform supports two distinct remote sensing pipelines:
1. **Non-Georeferenced Imagery (`.png`, `.jpg`):** Produces a normalized **Relative Digital Surface Model ($rDSM$)** for rapid height structure inspection.
2. **Georeferenced Imagery (`.tif`, GeoTIFF):** Ingests spatial metadata and applies an **Affine Elevation Calibration Engine** against satellite radar baselines (**Copernicus DEM GLO-30 / SRTM 30m**) to generate an **Absolute Metric DSM ($Z_{metric}$ in meters)**.

---

## 📂 Project Architecture

```
DepthWizard/
├── backend/                  # Python 3.13 FastAPI Backend Service
│   ├── api/                  # REST API route handlers (/api/scenes, /api/inspect)
│   ├── core/                 # Pipeline coordinator & image ingestion
│   ├── services/             # Metric Affine Calibrator (s * d_rel + t) & AGL filter
│   ├── db/                   # SQLite database (depth.db) & query helpers
│   ├── eval/                 # Validation engine (RMSE, MAE, Pearson r calculations)
│   └── main.py               # Application entrypoint & CORS middleware
│
├── frontend/                 # High-Performance WebGL Client (Vite + Three.js)
│   ├── src/
│   │   ├── 3d/               # Three.js viewport, vertex displacement, camera flight
│   │   ├── hud/              # Telemetry banner, preset cards, layer toggles
│   │   ├── chart/            # Chart.js 2D cross-section elevation transect drawer
│   │   └── styles/           # Defense-grade ISRO dark theme palette
│   ├── package.json          # Node dependencies (Three.js, Chart.js, Vite)
│   └── index.html            # Main UI entry point
│
├── notebooks/                # Google Colab T4 ML inference & GAMUS pipelines
│   └── depth_anything_v2.ipynb
│
├── docs/                     # Comprehensive Engineering Source of Truth
│   ├── 01_PRD.md             # Product Requirements Document & Scope
│   ├── 02_ARCHITECTURE.md    # System architecture & data flow diagrams
│   ├── 03_TECH_STACK.md      # Approved packages & strict guardrails
│   ├── 04_DATABASE_AND_STORAGE.md # SQLite schema & init_db.py script
│   ├── 05_TRD_AND_API_SPECS.md    # Unbreakable API contracts & Three.js specs
│   ├── 06_TEAM_GUARDRAILS_AND_WORKFLOW.md # Squad breakdown & night-out roadmap
│   ├── 07_LEAD_PLAYBOOK.md   # Master playbook for Team Lead
│   ├── 08_AARAV_FRONTEND_PLAYBOOK.md # Frontend execution playbook for Aarav
│   └── 09_DHEER_ML_DATABASE_PLAYBOOK.md # ML & DB playbook for Dheer
│
├── data/                     # Local file storage (Git-ignored)
│   ├── optical/              # Satellite RGB input tiles
│   ├── dsm/                  # Calibrated metric DSM GeoTIFFs
│   ├── cache/                # 16-bit displacement PNG textures
│   └── ground_truth/         # Reference Copernicus / SRTM elevation tiles
│
└── README.md                 # Contribution protocol & developer quickstart
```

---

## 👥 Team Squad Allocation

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

## 🤝 Git Contribution & Workflow Protocol

To prevent merge conflicts, broken branches, or lost code, **every team member must follow this exact protocol**:

### 1. Do We Fork or Branch?
👉 **DO NOT FORK.**  
Because this is a **Private Repository**, forking causes permission sync issues and prevents teammates from testing each other's branches.  
Everyone has direct collaborator access to this repository. You will work on **dedicated feature branches** directly inside this repo.

### 2. Official Branch Naming Standard
Every member has an assigned branch name:
- `feat/backend-calibrator` $\rightarrow$ Team Lead
- `feat/backend-ml-db` $\rightarrow$ Dheer
- `feat/backend-api` $\rightarrow$ Hasini
- `feat/frontend-3d` $\rightarrow$ Tarun
- `feat/frontend-hud-chart` $\rightarrow$ Aarav
- `docs/presentation` $\rightarrow$ Spoorthy

> [!CAUTION]
> **NEVER PUSH DIRECTLY TO `main`!**  
> The `main` branch is protected. It must always contain working, bootable code for the evaluation demo.

---

### 3. The Daily 5-Step Coding Routine

#### Step 1: Pull Latest Updates Before Touching Code
Always pull the latest stable code into your local branch before starting work:
```bash
git checkout main
git pull origin main
git checkout <your-branch-name>
git merge main
```

#### Step 2: Write Code & Test Locally
Work exclusively inside your assigned directory (e.g., `frontend/src/` or `backend/`).

#### Step 3: Commit and Push to Your Remote Branch
```bash
git add .
git commit -m "feat(api): implement /api/scenes endpoint and mock response"
git push origin <your-branch-name>
```

#### Step 4: Open a Pull Request (PR) on GitHub
1. Go to the GitHub repository page.
2. Click **"Compare & pull request"**.
3. Set base branch to `main` and compare branch to your feature branch.
4. Set **Team Lead** as the Reviewer.

#### Step 5: Notify the Team in the Chat Group
GitHub notifications can be missed. Whenever you open a PR or need a merge, post a message in the team WhatsApp / Discord group:

```markdown
📢 [PULL REQUEST OPENED]
• Branch: feat/backend-api
• Author: @Hasini
• Changes: Added /api/scenes and /api/inspect endpoints
• Reviewer: @Lead (Ready for local verification and merge!)
```

When the Lead reviews, tests, and merges your code, the Lead will announce:
```markdown
✅ [MERGED TO MAIN]
• Branch: feat/backend-api has been merged into main!
• Action for Everyone: Run `git checkout main && git pull origin main`!
```

---

### 4. Strict `.gitignore` Rules (Never Commit Heavy Files!)
To avoid exceeding GitHub file limits or bloating the repository, **never** commit:
- Model checkpoints (`*.pth`, `*.pt`, `*.bin`, `*.onnx`)
- Heavy geospatial rasters (`*.tif`, `*.tiff`, `*.h5`, `*.hdf5`)
- Local databases (`*.db`, `*.sqlite`, `depth.db`)
- Package folders (`node_modules/`, `__pycache__/`, `.venv/`)

---

## ⚡ Quickstart: Running Locally

### Backend Setup (Python 3.13)
```bash
# 1. Install dependencies
pip install fastapi uvicorn pydantic rasterio scipy h5py pillow

# 2. Initialize the SQLite database
python backend/db/init_db.py

# 3. Start the FastAPI development server
uvicorn backend.main:app --reload --port 8000
```
- Interactive API Docs: `http://localhost:8000/docs`

### Frontend Setup (Node.js 24)
```bash
# 1. Navigate to frontend directory
cd frontend

# 2. Install dependencies
npm install

# 3. Start Vite local server
npm run dev
```
- Web Application: `http://localhost:5173`

---

## 🎯 Evaluation Milestones (Internal Deadline: Sept 10)
- [x] Architecture, TRD, PRD, and Team Playbooks Locked (`/docs`)
- [ ] Phase 1: Database initialized & Colab ML inference running
- [ ] Phase 2: Height displacement shader & texture draping active
- [ ] Phase 3: Drone camera flight & point inspection working
- [ ] Phase 4: Validation dashboard & 2D elevation transect complete
- [ ] Phase 5: Air-gapped offline test, 10-slide deck, and 60fps backup video ready
