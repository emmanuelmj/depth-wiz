# Elevation Pipeline: Inference, Calibration & Export

End-to-end reference for turning an RGB tile into a calibrated DSM, an AGL
height field, a Three.js displacement texture, and a GeoTIFF.

```
RGB tile ──▶ depth inference ──▶ normalize + invert ──▶ affine calibration ──▶ Z_metric
                                        │                                        │
                                        ▼                                        ▼
                            16-bit displacement PNG                  AGL field + GeoTIFF
```

---

## Stage 1 — Depth Inference (cloud GPU)

Run inference off the presentation machine. `Depth-Anything-V2-Small` (ViT-S)
gives sharp building boundaries at low cost and exports cleanly to ONNX.

```bash
!pip install torch torchvision transformers datasets h5py pillow rasterio scipy
!git clone https://github.com/DepthAnything/Depth-Anything-V2.git
```

```python
import h5py, numpy as np, torch
from PIL import Image
from depth_anything_v2.dpt import DepthAnythingV2

device = 'cuda' if torch.cuda.is_available() else 'cpu'
model = DepthAnythingV2(encoder='vits', features=64,
                        out_channels=[48, 96, 192, 384])
model.load_state_dict(torch.load('checkpoints/depth_anything_v2_vits.pth',
                                 map_location='cpu'))
model.to(device).eval()

with h5py.File('DC_03_26_RGB.h5', 'r') as f:
    rgb = f['image'][:]              # (1024, 1024, 3) uint8

with torch.no_grad():
    depth_raw = model.infer_image(rgb)   # (1024, 1024) float32
```

### Nadir inversion
The model predicts **disparity** (near = large). For nadir satellite imagery
"near the camera" means "tall", but the sign convention must be checked per
model — verify against a known tall structure before trusting the output.

```python
d_norm = (depth_raw - depth_raw.min()) / (depth_raw.max() - depth_raw.min())
d_rel  = 1.0 - d_norm      # ground -> 0.0, rooftops/canopy -> 1.0
```

> Validate the inversion on one scene manually: sample a known rooftop pixel and
> a known road pixel. If `d_rel[roof] < d_rel[road]`, drop the inversion.

### Export artifacts
```python
# 16-bit displacement texture for Three.js (8-bit banding is visible on terrain)
Image.fromarray((d_rel * 65535.0).astype(np.uint16)).save('disp_16bit.png')

# Optical texture for draping
Image.fromarray(rgb).save('optical.png')

# Raw array for downstream calibration
np.save('d_rel.npy', d_rel.astype(np.float32))
```

---

## Stage 2 — Metric Calibration (`backend/services/calibrator.py`)

Maps unitless relative depth onto real elevation using a coarse reference DEM:

```
Z_metric(x, y) = s · d_rel(x, y) + t
```

### Procedure
1. Read the scene bounding box and CRS from the GeoTIFF.
2. Load the reference DEM tile (Copernicus GLO-30 / SRTM 30m) for that bbox.
3. Resample the coarse DEM to the optical grid (1024×1024, bilinear).
4. Mask nodata and non-finite pixels.
5. Fit `s` and `t` by least squares; use RANSAC when the scene contains large
   outlier regions (water bodies, cloud, nodata gores).

```python
import numpy as np

def affine_fit(d_rel, dem_coarse, nodata=-9999.0):
    mask = (dem_coarse > nodata) & np.isfinite(d_rel) & np.isfinite(dem_coarse)
    if mask.sum() < 100:
        raise ValueError("insufficient valid pixels for calibration")

    s, t = np.polyfit(d_rel[mask], dem_coarse[mask], deg=1)
    z_metric = s * d_rel + t
    return z_metric.astype(np.float32), float(s), float(t)
```

```python
from sklearn.linear_model import RANSACRegressor  # optional, outlier-heavy scenes

def affine_fit_ransac(d_rel, dem_coarse, nodata=-9999.0):
    mask = (dem_coarse > nodata) & np.isfinite(d_rel) & np.isfinite(dem_coarse)
    X = d_rel[mask].reshape(-1, 1)
    y = dem_coarse[mask]

    est = RANSACRegressor(residual_threshold=5.0, random_state=0).fit(X, y)
    s = float(est.estimator_.coef_[0])
    t = float(est.estimator_.intercept_)
    return (s * d_rel + t).astype(np.float32), s, t
```

### Notes & failure modes
- A 30m DEM cannot resolve individual buildings. It constrains the **regional
  trend** (valley floor vs. ridge), not per-structure height. Expect a strong
  fit on mountain scenes and a weak, near-degenerate fit on flat urban scenes.
- If `s` is near zero or negative, the fit failed — the scene is likely flat
  (no elevation gradient to regress against) or the inversion sign is wrong.
  Fall back to relative mode and flag the scene as non-metric.
- Non-georeferenced input skips this stage entirely: `Z = d_rel` scaled to
  0–100% and reported as relative, never in meters.

---

## Stage 3 — Above Ground Level (`h_AGL`)

Point inspection must answer "how tall is this building from the ground?", so a
bare-earth surface is estimated from the DSM by morphological opening:

```
Z_ground = MinFilter(Z_metric, window)   then smoothed
h_AGL    = max(0, Z_metric - Z_ground)
```

```python
import numpy as np
from scipy.ndimage import minimum_filter, uniform_filter

def compute_agl(z_metric, window=32, smooth=16):
    ground = minimum_filter(z_metric, size=window)   # erode structures away
    ground = uniform_filter(ground, size=smooth)     # remove blocky artifacts
    return np.maximum(0.0, z_metric - ground).astype(np.float32), ground
```

Window sizing: the window must exceed the widest structure, or the roof itself
becomes "ground" and its height collapses to 0. At ~0.5 m GSD on a 1024×1024
tile, 32 px ≈ 16 m — adequate for houses, too small for large warehouses or
dense high-rise blocks. Tune per landscape type and record the value used.

---

## Stage 4 — GeoTIFF Export (`backend/services/exporter.py`)

```python
import rasterio
from rasterio.transform import from_bounds

def save_metric_geotiff(path, z_metric, bounds, crs, size=1024):
    transform = from_bounds(*bounds, width=size, height=size)
    profile = dict(driver='GTiff', height=size, width=size, count=1,
                   dtype=rasterio.float32, crs=crs, transform=transform,
                   compress='deflate', nodata=-9999.0)
    with rasterio.open(path, 'w', **profile) as dst:
        dst.write(z_metric.astype(rasterio.float32), 1)
```

Output must open in QGIS/ArcGIS with correct georeferencing. Record the vertical
datum (`EGM96` vs `WGS84 ellipsoid`) in `ground_truths.vertical_datum` — mixing
datums introduces a constant offset of tens of meters and will invalidate RMSE.

---

## Stage 5 — Validation (`backend/eval/metrics.py`)

```python
import numpy as np

def evaluate(z_pred, z_gt, nodata=-9999.0):
    mask = np.isfinite(z_pred) & np.isfinite(z_gt) & (z_gt > nodata)
    p, g = z_pred[mask], z_gt[mask]

    rmse = float(np.sqrt(np.mean((p - g) ** 2)))
    mae  = float(np.mean(np.abs(p - g)))
    r    = float(np.corrcoef(p, g)[0, 1])
    bias = float(np.mean(p - g))
    return {"rmse_m": rmse, "mae_m": mae, "pearson_r": r, "bias_m": bias}
```

Report metrics **stratified by landscape type**, not just pooled — a single
pooled RMSE dominated by mountain scenes hides urban performance. Both must
compare against the same vertical datum and resolution; resample the prediction
to the ground-truth grid, not the reverse.

---

## Stage 6 — Benchmark Scene Packaging

Four scenes ship precomputed so no inference runs during a demo:

| Scene ID | Landscape | Characteristic |
|---|---|---|
| `urban-ahmedabad-01` | urban | Dense high-rise, sharp roof edges |
| `sparse-plains-02` | sparse | Flat fields, low dynamic range |
| `mountain-himalayas-03` | mountain | Steep ridges, wide elevation range |
| `forest-western-ghats-04` | forest | Continuous canopy, soft boundaries |

Each scene directory under `backend/static/demo_data/{scene_id}/` contains:

| File | Purpose |
|---|---|
| `optical.png` | 1024×1024 RGB texture for draping |
| `disp_16bit.png` | 16-bit normalized height texture for displacement |
| `calibrated_metric.tif` | float32 DSM in meters |
| `ground_truth.tif` | Reference Copernicus/SRTM tile |
| `meta.json` | CRS, bounds, elevation stats, calibration `s`/`t`, AGL window |

Insert one `scenes` row, one `ground_truths` row, and one `benchmark_metrics`
row per scene so `/api/scenes` and `/api/benchmarks` serve immediately.

---

## Reading HDF5 Tiles

Dataset tiles (GAMUS-style) store rasters under the `image` key:

```python
import h5py

with h5py.File('DC_01_25_RGB.h5', 'r') as f:
    rgb = f['image'][:]      # (1024, 1024, 3) uint8

with h5py.File('DC_01_25_AGL.h5', 'r') as f:
    agl = f['image'][:]      # (1024, 1024) float32, meters above ground
```

`*_AGL.h5` files are ground-truth **AGL** (already ground-relative, ~0–45 m),
not absolute elevation. Validate `h_AGL` output against these directly; do not
compare them to `Z_metric`. Negative values occur at edges and should be masked.
