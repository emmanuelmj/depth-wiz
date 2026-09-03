# Product Requirements Document (PRD)
## DepthWizard — Single-View Height Estimation and 3D Flythrough
ISRO Problem Statement 26175 · Target milestone: Sept 10, 2026

## Summary
DepthWizard converts a single optical satellite image into a calibrated Digital
Surface Model (DSM) and renders it as an interactive 3D terrain in the browser.

1. Estimate relative height from one RGB image (monocular depth).
2. Calibrate relative height into real-world meters using open elevation
   baselines (SRTM 30m / Copernicus GLO-30) when the image is georeferenced.
3. Render the result as a flyable 3D terrain with the original imagery draped
   on top, plus point/height inspection and cross-section tools.

## Target Users
- Remote sensing analysts needing elevation profiles without stereo passes.
- Disaster management teams needing rapid 3D terrain/slope views.
- Urban planners measuring building heights from aerial imagery.
- Hackathon evaluators (live demo must be stable, offline-capable, accurate).

## Scope

### P0 — Required
- Dual input pipelines:
  - Non-georeferenced (`.png`, `.jpg`) → relative DSM (0–100% normalized).
  - Georeferenced (`.tif`/GeoTIFF) → absolute metric DSM via affine
    calibration against SRTM/Copernicus baselines.
- 3D WebGL viewport at 45–60 FPS on integrated GPUs (e.g. Intel UHD).
- Optical texture draping onto the height-displaced terrain mesh.
- Camera navigation: scripted cinematic flythrough + manual orbit/WASD.
- 4 preloaded benchmark scenes: Urban, Sparse Plains, Mountains, Forest.
- Point inspection: click → lat/lon, elevation (Z), height above ground (AGL).
- Validation dashboard: RMSE, MAE, Pearson r vs. ground truth.
- Fully offline/air-gapped operation (no external network calls at runtime).

### P1 — Planned after P0 is stable
- 2D cross-section (transect) elevation profile tool.
- Layer toggle: RGB / elevation heatmap / hillshade-slope.
- GeoTIFF export of the calibrated DSM.

### P2 — Out of scope for this milestone
- Multi-temporal stereo fusion.
- SAR interferometry.
- Multi-user/cloud accounts.

## Functional Requirements
- **FR-1 Ingestion:** Accept `.png`, `.jpg`, `.tif` up to 20MB. Extract CRS,
  bounding box, and ground sample distance from GeoTIFFs; treat non-georeferenced
  files as relative-mode without error.
- **FR-2 Depth estimation:** Produce edge-preserving relative height from RGB
  input; invert so ground = 0 and structures extrude upward.
- **FR-3 Metric calibration:** For GeoTIFFs, align relative depth `d_rel` to a
  real elevation baseline `Z_base` via affine scaling:
  `Z_metric = s * d_rel + t`.
- **FR-4 3D rendering:** WebGL (Three.js) rendering, GPU vertex displacement,
  optical texture draped on the displaced mesh, 45–60 FPS target.
- **FR-5 Validation:** Compute and display, per scene category:
  - `RMSE = sqrt(mean((Z_pred - Z_gt)^2))`
  - `MAE = mean(|Z_pred - Z_gt|)`

## Non-Functional Requirements
1. Scene load time under 2.0s for any of the 4 benchmark presets.
2. Invalid/corrupted uploads show a UI error state, never a blank crash screen.
3. No runtime dependency on internet access (all assets/models bundled locally).
4. No CLI interaction required during a live demo — UI-only workflow.

## Acceptance Criteria
Each P0 item is considered done only when it meets a measurable check:

| Feature | Passing condition |
|---|---|
| Preset load | All 4 scenes render textured terrain in < 2.0s from click |
| Frame rate | ≥ 45 FPS sustained during flight on integrated graphics |
| Texture draping | Roads/roofs align with their displaced geometry, no visible offset |
| Point inspection | Clicked rooftop reports AGL within ±15% of the reference AGL raster |
| Metric mode | Exported GeoTIFF opens in QGIS with correct CRS and meter values |
| Relative mode | `.png`/`.jpg` input completes without error and reports no meters |
| Validation table | RMSE/MAE/Pearson r populated for all 4 landscape types |
| Offline | Full demo completes with the network adapter disabled |
| Error handling | Uploading a `.webp` or corrupt file shows a toast, viewport survives |

## Known Constraints
- A 30m reference DEM cannot resolve individual buildings; absolute accuracy on
  urban scenes is bounded by the baseline, and RMSE is expected to be worst on
  urban and best on sparse plains.
- Monocular depth is scale-ambiguous by construction — without georeferencing
  there is no way to recover meters, which is why relative mode never reports
  metric units.
- Shadowed facades and dense canopy have weakly constrained depth; canopy AGL
  reflects the top of the canopy surface, not the ground beneath it.
