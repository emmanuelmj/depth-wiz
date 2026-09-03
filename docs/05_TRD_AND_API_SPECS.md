# API Specification

## Endpoints
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/health` | Service health check |
| GET | `/api/scenes` | List all scenes (presets + uploaded) |
| GET | `/api/scenes/{scene_id}` | Full metadata + asset URLs for one scene |
| POST | `/api/upload` | Upload a `.png`/`.jpg`/`.tif` file |
| POST | `/api/predict/{scene_id}` | Run depth estimation + calibration |
| GET | `/api/inspect/{scene_id}` | Elevation/height at pixel (x, y) |
| POST | `/api/transect/{scene_id}` | Elevation profile between two points |
| GET | `/api/benchmarks` | Accuracy metrics across all terrain types |
| GET | `/api/export/{scene_id}` | Download calibrated GeoTIFF |

## Contracts

### `GET /api/scenes` → `200 OK`
```json
[
  {
    "id": "urban-ahmedabad-01",
    "name": "Urban High-Rise (Ahmedabad)",
    "landscape_type": "urban",
    "is_georeferenced": true,
    "thumbnail_url": "/static/thumbnails/urban.jpg",
    "min_elevation_m": 42.5,
    "max_elevation_m": 184.2
  }
]
```

### `GET /api/scenes/{scene_id}` → `200 OK`
```json
{
  "id": "urban-ahmedabad-01",
  "name": "Urban High-Rise (Ahmedabad)",
  "landscape_type": "urban",
  "is_georeferenced": true,
  "crs": "EPSG:32643",
  "bounds": {
    "min_lon": 72.5012, "min_lat": 23.0114,
    "max_lon": 72.5428, "max_lat": 23.0456
  },
  "elevation_stats": {
    "min_m": 42.5, "max_m": 184.2, "mean_m": 68.3, "ground_base_m": 45.0
  },
  "assets": {
    "optical_texture_url": "/static/optical/urban-ahmedabad-01.png",
    "height_map_url": "/static/dsm/urban-ahmedabad-01_disp.png",
    "geotiff_download_url": "/static/dsm/urban-ahmedabad-01_metric.tif"
  }
}
```

### `POST /api/upload` (multipart/form-data, field `file`) → `201 Created`
```json
{
  "scene_id": "custom-scene-98f2",
  "filename": "my_satellite_tile.tif",
  "is_georeferenced": true,
  "detected_crs": "EPSG:4326",
  "message": "File uploaded successfully. Ready for depth estimation."
}
```

### `GET /api/inspect/{scene_id}?x=512&y=420` → `200 OK`
`x`/`y` are pixel coordinates on the 1024×1024 raster grid.
```json
{
  "pixel": {"x": 512, "y": 420},
  "coordinates": {"latitude": 23.022514, "longitude": 72.571408},
  "metrics": {
    "absolute_elevation_m": 418.2,
    "estimated_ground_level_m": 363.6,
    "height_above_ground_m": 54.6,
    "slope_degrees": 1.8,
    "unit": "meters"
  }
}
```

### `POST /api/transect/{scene_id}` → `200 OK`
Request:
```json
{
  "start_pixel": {"x": 100, "y": 150},
  "end_pixel": {"x": 900, "y": 850},
  "samples": 100
}
```
Response:
```json
{
  "distance_total_m": 1240.5,
  "min_elevation_m": 45.2,
  "max_elevation_m": 184.2,
  "profile": [
    {"dist_m": 0.0, "elevation_m": 45.2},
    {"dist_m": 12.4, "elevation_m": 45.8}
  ]
}
```

### `GET /api/benchmarks` → `200 OK`
```json
{
  "validation_dataset": "GAMUS + Copernicus DEM GLO-30 Ground Truth",
  "evaluated_at": "2026-09-04T12:00:00Z",
  "summary_metrics": {
    "overall_rmse_m": 3.58, "overall_mae_m": 2.60, "overall_pearson_r": 0.902
  },
  "stratified_results": [
    {
      "landscape_type": "Urban High-Rise",
      "rmse_m": 3.82, "mae_m": 2.61, "pearson_r": 0.89,
      "dynamic_range": "50m - 184m"
    }
  ]
}
```


### `POST /api/predict/{scene_id}` → `200 OK`
Runs inference + calibration. Idempotent: re-running overwrites derived assets.
```json
{
  "scene_id": "custom-scene-98f2",
  "mode": "metric",
  "calibration": {"scale_s": 142.7, "offset_t": 38.4, "reference": "SRTM-30m"},
  "elevation_stats": {"min_m": 42.5, "max_m": 184.2, "mean_m": 68.3},
  "assets": {
    "height_map_url": "/static/cache/custom-scene-98f2_disp.png",
    "geotiff_download_url": "/static/dsm/custom-scene-98f2_metric.tif"
  },
  "processing_time_s": 4.2
}
```
For non-georeferenced input, `mode` is `"relative"`, `calibration` is `null`,
and `elevation_stats` are reported as normalized `0.0–1.0` under
`relative_stats` instead of meters.

## Validation Rules
| Field | Rule |
|---|---|
| upload `file` | `.png`, `.jpg`, `.tif` only; ≤ 20MB |
| `x`, `y` | integers within `[0, 1023]` |
| `samples` (transect) | integer `2–1000`, default `100` |
| `scene_id` | must exist in `scenes`, else `404` |

## Error Contract
All errors return this shape with the appropriate status code:
```json
{
  "error": "unsupported_format",
  "message": "Only .png, .jpg and .tif files are accepted.",
  "detail": {"received": "image/webp"}
}
```

| Status | `error` | Cause |
|---|---|---|
| `400` | `unsupported_format` | Extension/MIME not in the allowed set |
| `400` | `invalid_pixel` | `x`/`y` outside the raster grid |
| `404` | `scene_not_found` | Unknown `scene_id` |
| `409` | `not_predicted` | Inspect/transect called before `/api/predict` |
| `413` | `file_too_large` | Upload exceeds 20MB |
| `422` | `calibration_failed` | Degenerate affine fit (flat scene, no DEM overlap) |
| `500` | `internal_error` | Unhandled server fault |

The client must render every one of these as an inline toast and keep the
current scene on screen — see the error handling notes in
`07_FRONTEND_IMPLEMENTATION.md`.

## Conventions
- Metric fields are suffixed `_m` and are **only** present for georeferenced
  scenes. Clients must branch on `is_georeferenced` rather than assuming meters.
- Pixel coordinates are always on the 1024×1024 raster grid, origin top-left.
- Timestamps are ISO 8601 UTC.
- Static assets are served under `/static/`; the API never returns file system
  paths.

## Client Reference
Three.js terrain, camera flight, raycast picking, and Chart.js transect
implementations live in `07_FRONTEND_IMPLEMENTATION.md`.
