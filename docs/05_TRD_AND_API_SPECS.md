# 📡 Technical Requirements & API Specifications (TRD)
## Project DepthWizard — ISRO Problem Statement 26175

---

## 1. Purpose of this Document
This document is the **unbreakable contract between the Backend Squad (You, Dheer, Hasini) and the Frontend Squad (Tarun, Aarav, Spoorthy)**.  
By reading this document, the Frontend Squad can build the entire Three.js viewport, HUD controls, and elevation profile charts with mock JSON data immediately, without waiting for the Python AI pipeline to finish.

---

## 2. API Endpoints Overview

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/health` | Service health status check |
| `GET` | `/api/scenes` | Get list of all available scenes (including 4 presets) |
| `GET` | `/api/scenes/{scene_id}` | Get full metadata & texture URLs for a specific scene |
| `POST` | `/api/upload` | Upload a new `.png`, `.jpg`, or `.tif` satellite file |
| `POST` | `/api/predict/{scene_id}` | Run height estimation & metric calibration on a scene |
| `GET` | `/api/inspect/{scene_id}` | Query real-world elevation and building height at pixel $(x, y)$ |
| `POST` | `/api/transect/{scene_id}` | Get 2D elevation profile array between Point A and Point B |
| `GET` | `/api/benchmarks` | Get official accuracy metrics table across all 4 terrain types |
| `GET` | `/api/export/{scene_id}` | Download calibrated GeoTIFF (`.tif`) or 3D model asset |

---

## 3. Detailed Request & Response Contracts

### 3.1 `GET /api/scenes`
Returns the list of pre-loaded benchmark scenes (Urban, Sparse, Mountain, Forest) and any uploaded scenes.

**Response `200 OK`:**
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
  },
  {
    "id": "sparse-plains-02",
    "name": "Agricultural Plains (Punjab)",
    "landscape_type": "sparse",
    "is_georeferenced": true,
    "thumbnail_url": "/static/thumbnails/sparse.jpg",
    "min_elevation_m": 210.0,
    "max_elevation_m": 235.4
  },
  {
    "id": "mountain-himalayas-03",
    "name": "Mountain Ridges (Himachal)",
    "landscape_type": "mountain",
    "is_georeferenced": true,
    "thumbnail_url": "/static/thumbnails/mountain.jpg",
    "min_elevation_m": 1420.0,
    "max_elevation_m": 3150.0
  },
  {
    "id": "forest-western-ghats-04",
    "name": "Forested Canopy (Western Ghats)",
    "landscape_type": "forest",
    "is_georeferenced": true,
    "thumbnail_url": "/static/thumbnails/forest.jpg",
    "min_elevation_m": 610.0,
    "max_elevation_m": 890.0
  }
]
```

---

### 3.2 `GET /api/scenes/{scene_id}`
Returns all assets required by the Three.js viewport to build and drape the 3D terrain.

**Response `200 OK`:**
```json
{
  "id": "urban-ahmedabad-01",
  "name": "Urban High-Rise (Ahmedabad)",
  "landscape_type": "urban",
  "is_georeferenced": true,
  "crs": "EPSG:32643",
  "bounds": {
    "min_lon": 72.5012,
    "min_lat": 23.0114,
    "max_lon": 72.5428,
    "max_lat": 23.0456
  },
  "elevation_stats": {
    "min_m": 42.5,
    "max_m": 184.2,
    "mean_m": 68.3,
    "ground_base_m": 45.0
  },
  "assets": {
    "optical_texture_url": "/static/optical/urban-ahmedabad-01.png",
    "height_map_url": "/static/dsm/urban-ahmedabad-01_disp.png",
    "geotiff_download_url": "/static/dsm/urban-ahmedabad-01_metric.tif"
  }
}
```

---

### 3.3 `POST /api/upload`
Uploads a custom image from the user's computer.

**Request:** `multipart/form-data` with field `file`.  
**Response `201 Created`:**
```json
{
  "scene_id": "custom-scene-98f2",
  "filename": "my_satellite_tile.tif",
  "is_georeferenced": true,
  "detected_crs": "EPSG:4326",
  "message": "File uploaded successfully. Ready for depth estimation."
}
```

---

### 3.4 `GET /api/inspect/{scene_id}?x=512&y=420`
Used when the user clicks a point on the 3D model.

**Query Parameters:**
- `x`: Pixel X coordinate on the $1024 \times 1024$ raster grid.
- `y`: Pixel Y coordinate on the $1024 \times 1024$ raster grid.

**Response `200 OK`:**
```json
{
  "pixel": {"x": 512, "y": 420},
  "coordinates": {
    "latitude": 23.022514,
    "longitude": 72.571408
  },
  "metrics": {
    "absolute_elevation_m": 418.2,
    "estimated_ground_level_m": 363.6,
    "height_above_ground_m": 54.6,
    "slope_degrees": 1.8,
    "unit": "meters"
  }
}
```

---

### 3.5 `POST /api/transect/{scene_id}`
Used when the user draws a cross-section line across the terrain.

**Request Body:**
```json
{
  "start_pixel": {"x": 100, "y": 150},
  "end_pixel": {"x": 900, "y": 850},
  "samples": 100
}
```

**Response `200 OK`:**
```json
{
  "distance_total_m": 1240.5,
  "min_elevation_m": 45.2,
  "max_elevation_m": 184.2,
  "profile": [
    {"dist_m": 0.0, "elevation_m": 45.2},
    {"dist_m": 12.4, "elevation_m": 45.8},
    {"dist_m": 24.8, "elevation_m": 46.5},
    {"dist_m": 37.2, "elevation_m": 120.4},
    {"dist_m": 49.6, "elevation_m": 184.2}
  ]
}
```

---

### 3.6 `GET /api/benchmarks`
Returns the accuracy metrics table for the 50% ISRO evaluation rubric.

**Response `200 OK`:**
```json
{
  "validation_dataset": "GAMUS + Copernicus DEM GLO-30 Ground Truth",
  "evaluated_at": "2026-09-04T12:00:00Z",
  "summary_metrics": {
    "overall_rmse_m": 3.58,
    "overall_mae_m": 2.60,
    "overall_pearson_r": 0.902
  },
  "stratified_results": [
    {
      "landscape_type": "Urban High-Rise",
      "rmse_m": 3.82,
      "mae_m": 2.61,
      "pearson_r": 0.89,
      "dynamic_range": "50m - 184m"
    },
    {
      "landscape_type": "Sparse Plains",
      "rmse_m": 1.94,
      "mae_m": 1.42,
      "pearson_r": 0.94,
      "dynamic_range": "210m - 235m"
    },
    {
      "landscape_type": "Hilly Mountains",
      "rmse_m": 5.11,
      "mae_m": 3.88,
      "pearson_r": 0.91,
      "dynamic_range": "1420m - 3150m"
    },
    {
      "landscape_type": "Forested Canopy",
      "rmse_m": 3.45,
      "mae_m": 2.50,
      "pearson_r": 0.87,
      "dynamic_range": "610m - 890m"
    }
  ]
}
```

---

## 4. Three.js Technical Implementation Specs (For Tarun)

### Terrain Mesh Creation
Tarun will create the 3D surface using a standard Three.js `PlaneGeometry`:
```javascript
import * as THREE from 'three';

// 1. Create a high-density plane grid (512x512 segments)
const geometry = new THREE.PlaneGeometry(100, 100, 512, 512);

// 2. Load the Optical Satellite RGB texture
const textureLoader = new THREE.TextureLoader();
const colorTexture = textureLoader.load(sceneData.assets.optical_texture_url);

// 3. Load the 16-bit Height displacement texture
const displacementTexture = textureLoader.load(sceneData.assets.height_map_url);

// 4. Create standard physical material with height displacement
const material = new THREE.MeshStandardMaterial({
  map: colorTexture,
  displacementMap: displacementTexture,
  displacementScale: 15.0, // Scaled visual amplitude
  roughness: 0.8,
  metalness: 0.1
});

const terrainMesh = new THREE.Mesh(geometry, material);
terrainMesh.rotation.x = -Math.PI / 2; // Lay flat like earth
scene.add(terrainMesh);
```

### Drone Camera Flight Spline
To implement the **"▶ CINEMATIC FLIGHT"** button without manual piloting:
```javascript
// Define a smooth 3D flight path above the terrain
const curve = new THREE.CatmullRomCurve3([
  new THREE.Vector3(-40, 25, 40),
  new THREE.Vector3(0, 15, 20),
  new THREE.Vector3(30, 20, -10),
  new THREE.Vector3(0, 30, -30),
  new THREE.Vector3(-40, 25, 40)
]);

// Inside the render loop:
function updateDroneFlight(progress) {
  const point = curve.getPoint(progress);
  const lookAtPoint = curve.getPoint((progress + 0.05) % 1.0);
  camera.position.copy(point);
  camera.lookAt(lookAtPoint);
}
```
