# 👑 Team Lead Master Playbook: Coordination & Technical Execution
## Project DepthWizard — ISRO Problem Statement 26175
*Author: Lead Architect & Chief Integrator*

---

## 1. Role Overview & Your Mission
As Team Lead, you have two distinct responsibilities:
1. **Technical Ownership (Backend & Calibration):** You write the critical mathematical core—the metric affine calibration engine ($Z = s \cdot d_{rel} + t$) and coordinate integration with Hasini and Dheer.
2. **Operational Coordination (Cross-Squad Integration):** You supervise the overall architecture, unblock Dheer on ML/data, unblock Aarav on frontend contracts, conduct 10-minute nightly syncs, and safeguard the timeline toward **September 10th**.

---

## 2. Your Technical Coding Checklist (Backend Core)

You are responsible for `backend/services/calibrator.py` and `backend/core/processor.py`.

### Task 1: The Affine Calibration Engine (`backend/services/calibrator.py`)
- **The Core Formula:**
  $$Z_{metric}(x, y) = s \cdot d_{rel}(x, y) + t$$
- **Step-by-step implementation:**
  1. Receive relative depth array $d_{rel}$ (values normalized $0.0 \to 1.0$) from Dheer's model output.
  2. Invert if necessary so that high structures have higher values: $d_{norm} = 1.0 - d_{raw}$ (if model predicted disparity).
  3. Load the corresponding coarse reference DEM (Copernicus 30m or SRTM) for the geographic bounding box.
  4. Resample the coarse DEM to match the optical image dimensions ($1024 \times 1024$).
  5. Fit scale $s$ and translation $t$ using Least Squares or RANSAC:
     ```python
     import numpy as np
     from scipy.optimize import curve_fit

     def affine_fit(d_rel, dem_coarse):
         # Flatten arrays and filter out invalid/nodata pixels
         mask = (dem_coarse > -999) & np.isfinite(d_rel)
         x_vals = d_rel[mask]
         y_vals = dem_coarse[mask]
         
         # Linear regression: y = s * x + t
         poly = np.polyfit(x_vals, y_vals, deg=1)
         scale_s, offset_t = poly[0], poly[1]
         
         # Calibrate full metric DSM
         z_metric = scale_s * d_rel + offset_t
         return z_metric, scale_s, offset_t
     ```

### Task 2: Above Ground Level (AGL) Height Calculation
- Evaluators will click a rooftop and ask: *"How tall is this building from the ground?"*
- Implement morphological ground filtering (e.g., minimum filter in a local $32 \times 32$ window) to estimate bare earth elevation:
  $$Z_{ground} = \text{MinFilter}(Z_{metric})$$
  $$h_{AGL} = \max(0, Z_{metric} - Z_{ground})$$

### Task 3: GeoTIFF Exporter (`backend/services/exporter.py`)
- Save the calibrated metric array as a real GeoTIFF using `rasterio`:
  ```python
  import rasterio

  def save_metric_geotiff(output_path, z_metric, bounds, crs):
      transform = rasterio.transform.from_bounds(*bounds, width=1024, height=1024)
      with rasterio.open(
          output_path, 'w',
          driver='GTiff',
          height=1024, width=1024,
          count=1, dtype=rasterio.float32,
          crs=crs, transform=transform
      ) as dst:
          dst.write(z_metric.astype(rasterio.float32), 1)
  ```

---

## 3. How to Coordinate Squads Step-by-Step

```
                    ┌─────────────────────────┐
                    │       YOU (LEAD)        │
                    └────────────┬────────────┘
         ┌───────────────────────┴───────────────────────┐
         ▼                                               ▼
┌─────────────────────────┐                     ┌─────────────────────────┐
│ SQUAD 1: BACKEND        │                     │ SQUAD 2: FRONTEND       │
│ • Dheer: ML & DB        │                     │ • Aarav: UI & Charts    │
│ • Hasini: APIs & Eval   │                     │ • Tarun: Three.js 3D    │
│                         │                     │ • Spoorthy: Deck/Theme  │
└─────────────────────────┘                     └─────────────────────────┘
```

### Daily Rhythm & Nightly Sync Protocol
Hold **one 10-minute sync every evening at 9:00 PM** (in person or on Discord/Google Meet).

#### The 3 Questions for Every Member:
1. *"What module did you finish today?"*
2. *"Are you blocked by any API contract or missing file?"*
3. *"What exact branch are you pushing tonight?"*

---

### Step-by-Step Guidance for Your Teammates

#### Managing Dheer (ML & Database):
1. **Night 1:** Make sure Dheer has the Google Colab link running with T4 GPU. Ask him to run inference on `DC_03_26_RGB.h5` and produce the first raw depth output.
2. **Night 2:** Ensure Dheer runs `init_db.py` on your local laptop to initialize `depth.db`.
3. **Night 3:** Verify that Dheer places the 4 precomputed benchmark scenes (`urban`, `sparse`, `mountain`, `forest`) into `/backend/static/demo_data/`.

#### Managing Hasini (API & Validation):
1. **Night 1:** Review `05_TRD_AND_API_SPECS.md` with Hasini so she understands the endpoints she is writing in `backend/api/routes.py`.
2. **Night 2:** Show Hasini how to run Uvicorn (`uvicorn backend.main:app --reload`) and test her endpoints at `http://localhost:8000/docs`.
3. **Night 3:** Help Hasini connect your `calibrator.py` to her `/api/predict` endpoint, and write the RMSE/MAE math in `backend/eval/metrics.py`.

#### Coordinating with Aarav (Frontend Lead):
1. **Night 1:** Confirm Aarav has cloned the repo and scaffolded the Vite app in `frontend/`.
2. **Night 2:** Ensure Aarav is using mock JSON data from `05_TRD_AND_API_SPECS.md` so Tarun and Spoorthy aren't waiting on the backend.
3. **Night 3:** Test the connection between Hasini's local FastAPI server (`http://localhost:8000`) and Aarav's Vite dev server (`http://localhost:5173`).
4. **Night 4:** Review the 2D cross-section chart and preset cards with Aarav.

---

## 4. Pull Request Review & Merge Protocol

You are the only person who merges code into `main`. Follow this 4-step checklist before merging any PR:

```bash
# 1. Fetch and checkout the PR branch locally
git fetch origin
git checkout feat/<branch-name>

# 2. Test Backend (if backend files changed)
python -m uvicorn backend.main:app --reload
# Verify http://localhost:8000/api/health returns {"status": "ok"}

# 3. Test Frontend (if frontend files changed)
cd frontend && npm run build
# Ensure zero build errors

# 4. Merge cleanly into main
git checkout main
git merge feat/<branch-name>
git push origin main
```

---

## 5. Defense-Day Rehearsal (Sept 9 Night)
On the night of September 9, conduct **three 7-minute dry runs**:
1. **Run 1 (Technical Sanity):** Disconnect your laptop from Wi-Fi completely. Boot the app. Click all 4 presets. Confirm 60 FPS flight.
2. **Run 2 (Slide & Pitch Integration):** Spoorthy presents the slides, you handle the live 3D demo transition, Aarav demonstrates the cross-section tool.
3. **Run 3 (Tough Questions Simulation):** You answer questions on RMSE, vertical datums (WGS84 vs EGM96), and affine calibration math.
