# System Architecture

## Pipeline
```
Satellite Image -> AI Depth Engine -> Metric Calibrator -> SQLite + File Storage -> 3D WebGL Viewport
```
1. **Depth Engine:** Monocular depth model produces a raw relative height map
   from the RGB image.
2. **Metric Calibrator:** If the image is georeferenced, aligns relative depth
   to a real elevation baseline (SRTM 30m / Copernicus GLO-30) via affine
   scaling `Z_metric = s * d_rel + t`.
3. **Storage:** Scene metadata, elevation stats, benchmark scores, and point
   annotations are persisted in SQLite; raster/texture files live on disk.
4. **3D Viewport:** Loads the height map and optical texture, displaces a
   plane mesh on the GPU, and renders a flyable terrain at 60 FPS.

## Block Diagram
```
┌───────────────────────────── TIER 1: Browser Client ─────────────────────────────┐
│  HUD (upload/presets/toggles)   Three.js 3D canvas   Chart.js 2D cross-section    │
└──────────────┬─────────────────────────┬─────────────────────────┬───────────────┘
               │ REST (JSON)             │ Height/texture PNG      │ Profile array
┌──────────────▼─────────────────────────┴─────────────────────────┴───────────────┐
│                     TIER 2: FastAPI Backend (Python 3.13)                        │
│  Routes: /api/scenes /api/upload /api/predict /api/inspect /api/transect         │
│          /api/benchmarks /api/export                                             │
│  ┌─────────────────────────────┐   ┌─────────────────────────────┐               │
│  │ Geospatial engine           │   │ Metric calibration core      │               │
│  │ rasterio, h5py, GDAL        │   │ affine scaler s*d + t,       │               │
│  │ CRS/bbox/GSD parsing        │   │ SRTM/Copernicus alignment,   │               │
│  │                             │   │ AGL computation              │               │
│  └─────────────────────────────┘   └─────────────────────────────┘               │
└──────────────┬─────────────────────────────────────────┬─────────────────────────┘
               │                                          │
┌──────────────▼──────────────────────────┐   ┌───────────▼────────────────────────┐
│ SQLite (depth.db)                       │   │ File system (/data)                │
│ scenes, ground_truths,                  │   │ optical/, dsm/, cache/,             │
│ benchmark_metrics, point_inspections,    │   │ ground_truth/                      │
│ transect_profiles                       │   │                                     │
└──────────────────────────────────────────┘   └─────────────────────────────────────┘
```

## Design Notes
- **GPU vertex displacement:** The height map is loaded as a texture and the
  GPU displaces mesh vertices in the vertex shader — avoids building the mesh
  on the CPU.
- **Texture draping:** The optical RGB image is applied as the color map in
  the fragment shader over the displaced geometry.
- **Contract-first:** Frontend and backend communicate only through the JSON
  contracts in `05_TRD_AND_API_SPECS.md`, so frontend work can proceed against
  mock data independent of backend/model progress.
- **Preset caching:** The 4 benchmark scenes ship with precomputed textures,
  DSMs, and ground-truth metrics so they load instantly (no on-demand inference).
- **Stateless scenes:** Each uploaded scene gets a UUID `scene_id`; all its
  assets are stored under `/data/{scene_id}/` with no server session state.
- **Training vs. inference split:** Model training/inference for generating
  the benchmark DSMs happens offline (e.g. Colab with a T4 GPU running
  Depth-Anything-V2); the shipped app only serves precomputed or
  ONNX/CPU-inferred results, keeping the runtime demo lightweight.

## Module Responsibilities
| Module | Owns | Key detail |
|---|---|---|
| `backend/core/processor.py` | Ingestion + pipeline orchestration | Detects georeferencing, routes to metric or relative path |
| `backend/services/calibrator.py` | Affine fit `Z = s·d + t` | Least squares / RANSAC against coarse DEM |
| `backend/services/agl.py` | Bare-earth estimate, `h_AGL` | Morphological min-filter + smoothing |
| `backend/services/exporter.py` | GeoTIFF writer | float32, CRS + transform from bounds |
| `backend/db/queries.py` | SQLite access layer | Only module issuing SQL |
| `backend/eval/metrics.py` | RMSE / MAE / Pearson r / bias | Stratified by landscape type |
| `backend/api/routes.py` | HTTP surface | Validation + serialization only, no math |
| `frontend/src/3d/` | Terrain, camera, picking | GPU displacement, raycast → pixel |
| `frontend/src/hud/`, `chart/` | Controls, inspector, transect | Consumes API contracts only |

Implementation detail lives in `06_ELEVATION_PIPELINE.md` (backend/ML) and
`07_FRONTEND_IMPLEMENTATION.md` (client).

## Request Sequences

### Load a preset scene
```
Client                     API                    DB / Disk
  │  GET /api/scenes         │                        │
  │─────────────────────────▶│  SELECT * FROM scenes  │
  │                          │───────────────────────▶│
  │◀── scene list ───────────│                        │
  │  GET /api/scenes/{id}    │                        │
  │─────────────────────────▶│  scene row + asset paths
  │◀── metadata + asset URLs │                        │
  │  GET /static/optical.png, /static/disp_16bit.png  │
  │──────────────────────────────────────────────────▶│
  │  build mesh, drape texture, render                │
```
No inference runs on this path — assets are precomputed, which is what keeps
scene load under the 2s budget.

### Upload → predict
```
POST /api/upload      -> store file, parse CRS/bounds/GSD, insert scenes row
                         returns scene_id, is_georeferenced
POST /api/predict/{id}-> depth inference (ONNX/CPU or precomputed)
                         -> normalize + invert -> d_rel
                         -> if georeferenced: affine calibrate vs. DEM -> Z_metric
                            else: relative mode, no meters reported
                         -> compute h_AGL, write 16-bit PNG + GeoTIFF
                         -> update scenes row with paths + elevation stats
```

### Point inspection
```
Client raycast -> UV -> pixel (x, y)
GET /api/inspect/{id}?x&y
  -> read Z_metric[y, x], Z_ground[y, x]
  -> h_AGL = Z_metric - Z_ground
  -> pixel -> lat/lon via affine transform (georeferenced scenes only)
  -> return coordinates + metrics
```

## Coordinate Conventions
Getting these wrong is the most common source of misaligned inspection results:

- Raster arrays are indexed `[row, col]` = `[y, x]`, origin **top-left**.
- Texture UVs have origin **bottom-left** → `pixel_y = (1 - uv.y) * height`.
- Pixel → world coordinates uses the rasterio affine transform from the source
  GeoTIFF; it is undefined for non-georeferenced input, which must report pixel
  coordinates only.
- All rasters in a scene (optical, DSM, ground truth) are resampled to a common
  1024×1024 grid before any pixel-wise comparison.
