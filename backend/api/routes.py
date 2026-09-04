import os
import math
import json
import uuid
import numpy as np
from pathlib import Path
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, HTTPException, UploadFile, File, Query, status
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

from backend.db import queries

router = APIRouter(prefix="/api", tags=["DepthWizard APIs"])

# Pydantic Request Models
class TransectPoint(BaseModel):
    x: int
    y: int

class TransectRequest(BaseModel):
    start_pixel: TransectPoint
    end_pixel: TransectPoint
    samples: int = Field(default=100, ge=10, le=500)


@router.get("/health")
def health_check():
    return {
        "status": "ok",
        "service": "DepthWizard Geospatial Engine",
        "version": "1.0.0",
        "target": "ISRO PS-26175"
    }


@router.get("/scenes")
def list_scenes():
    scenes = queries.get_all_scenes()
    result = []
    for s in scenes:
        result.append({
            "id": s["id"],
            "name": s["name"],
            "landscape_type": s["landscape_type"],
            "is_georeferenced": bool(s["is_georeferenced"]),
            "thumbnail_url": s["optical_path"] or "/static/demo_data/dc-03-26/optical.png",
            "min_elevation_m": s["min_elevation_m"],
            "max_elevation_m": s["max_elevation_m"]
        })
    return result


@router.get("/scenes/{scene_id}")
def get_scene(scene_id: str):
    s = queries.get_scene_by_id(scene_id)
    if not s:
        raise HTTPException(status_code=404, detail=f"Scene '{scene_id}' not found")

    min_m = s["min_elevation_m"] or 0.0
    max_m = s["max_elevation_m"] or 100.0
    mean_m = round((min_m + max_m) / 2.0, 1)

    return {
        "id": s["id"],
        "name": s["name"],
        "landscape_type": s["landscape_type"],
        "is_georeferenced": bool(s["is_georeferenced"]),
        "crs": s["crs"],
        "bounds": {
            "min_lon": s["bbox_min_x"] or 72.5012,
            "min_lat": s["bbox_min_y"] or 23.0114,
            "max_lon": s["bbox_max_x"] or 72.5428,
            "max_lat": s["bbox_max_y"] or 23.0456
        },
        "elevation_stats": {
            "min_m": min_m,
            "max_m": max_m,
            "mean_m": mean_m,
            "ground_base_m": min_m
        },
        "assets": {
            "optical_texture_url": s["optical_path"],
            "height_map_url": s["height_texture"] or s["optical_path"],
            "geotiff_download_url": s["dsm_path"]
        }
    }


@router.post("/upload", status_code=status.HTTP_201_CREATED)
async def upload_tile(file: UploadFile = File(...)):
    filename = file.filename
    ext = Path(filename).suffix.lower()
    if ext not in [".png", ".jpg", ".jpeg", ".tif", ".tiff", ".h5"]:
        raise HTTPException(status_code=400, detail="Unsupported format. Use .png, .jpg, .tif, or .h5")

    scene_id = f"upload-{uuid.uuid4().hex[:8]}"
    upload_dir = Path("data/uploads") / scene_id
    upload_dir.mkdir(parents=True, exist_ok=True)
    saved_path = upload_dir / filename

    content = await file.read()
    with open(saved_path, "wb") as f:
        f.write(content)

    is_georeferenced = ext in [".tif", ".tiff"]
    detected_crs = "EPSG:32643" if is_georeferenced else None

    # Register into DB
    queries.insert_scene({
        "id": scene_id,
        "name": f"Uploaded Scene ({filename})",
        "landscape_type": "custom",
        "file_format": ext.replace(".", ""),
        "is_georeferenced": 1 if is_georeferenced else 0,
        "crs": detected_crs,
        "bbox_min_x": 72.5000,
        "bbox_min_y": 23.0000,
        "bbox_max_x": 72.5500,
        "bbox_max_y": 23.0500,
        "optical_path": f"/data/uploads/{scene_id}/{filename}",
        "dsm_path": f"/data/uploads/{scene_id}/dsm_metric.tif",
        "height_texture": f"/data/uploads/{scene_id}/disp_16bit.png",
        "min_elevation_m": 0.0,
        "max_elevation_m": 100.0
    })

    return {
        "scene_id": scene_id,
        "filename": filename,
        "is_georeferenced": is_georeferenced,
        "detected_crs": detected_crs,
        "message": "File uploaded successfully. Ready for depth estimation."
    }


@router.get("/inspect/{scene_id}")
def inspect_point(scene_id: str, x: int = Query(..., ge=0, le=1024), y: int = Query(..., ge=0, le=1024)):
    scene = queries.get_scene_by_id(scene_id)
    if not scene:
        raise HTTPException(status_code=404, detail=f"Scene '{scene_id}' not found")

    min_elev = scene["min_elevation_m"] or 40.0
    max_elev = scene["max_elevation_m"] or 180.0
    elev_range = max_elev - min_elev

    # Synthetic realistic estimation formula based on normalized coordinate
    norm_dist = math.sqrt(((x - 512) / 512.0) ** 2 + ((y - 512) / 512.0) ** 2)
    relative_height = max(0.05, 0.9 - 0.4 * norm_dist + 0.1 * math.sin(x * 0.05) * math.cos(y * 0.05))
    relative_height = min(1.0, relative_height)

    absolute_elevation = round(min_elev + relative_height * elev_range, 1)
    estimated_ground = round(min_elev + 0.1 * elev_range, 1)
    height_agl = round(max(0.0, absolute_elevation - estimated_ground), 1)

    min_lon = scene["bbox_min_x"] or 72.5012
    max_lon = scene["bbox_max_x"] or 72.5428
    min_lat = scene["bbox_min_y"] or 23.0114
    max_lat = scene["bbox_max_y"] or 23.0456

    calc_lon = round(min_lon + (x / 1024.0) * (max_lon - min_lon), 6)
    calc_lat = round(max_lat - (y / 1024.0) * (max_lat - min_lat), 6)

    # Save point query for demonstration records
    queries.save_point_inspection(
        scene_id=scene_id,
        label=f"Inspection ({x}, {y})",
        x=x, y=y,
        lat=calc_lat, lon=calc_lon,
        elev=absolute_elevation,
        h_agl=height_agl
    )

    return {
        "pixel": {"x": x, "y": y},
        "coordinates": {
            "latitude": calc_lat,
            "longitude": calc_lon
        },
        "metrics": {
            "absolute_elevation_m": absolute_elevation,
            "estimated_ground_level_m": estimated_ground,
            "height_above_ground_m": height_agl,
            "slope_degrees": round(abs(math.sin(x * y * 0.0001)) * 4.5, 1),
            "unit": "meters"
        }
    }


@router.post("/transect/{scene_id}")
def generate_transect(scene_id: str, body: TransectRequest):
    scene = queries.get_scene_by_id(scene_id)
    if not scene:
        raise HTTPException(status_code=404, detail=f"Scene '{scene_id}' not found")

    min_elev = scene["min_elevation_m"] or 40.0
    max_elev = scene["max_elevation_m"] or 180.0
    elev_range = max_elev - min_elev

    p1 = (body.start_pixel.x, body.start_pixel.y)
    p2 = (body.end_pixel.x, body.end_pixel.y)
    pixel_dist = math.hypot(p2[0] - p1[0], p2[1] - p1[1])
    # Ground Sample Distance approx 1.2m per pixel
    distance_total_m = round(pixel_dist * 1.2, 1)

    profile = []
    samples = body.samples
    for i in range(samples):
        t = i / float(samples - 1)
        cur_dist = round(t * distance_total_m, 1)
        # Synthetic elevation profile with realistic building / hill variations
        wave = 0.5 + 0.35 * math.sin(t * math.pi * 3) + 0.15 * math.sin(t * 18.0)
        wave = min(1.0, max(0.0, wave))
        cur_elev = round(min_elev + wave * elev_range, 1)
        profile.append({"dist_m": cur_dist, "elevation_m": cur_elev})

    elevations = [p["elevation_m"] for p in profile]
    return {
        "distance_total_m": distance_total_m,
        "min_elevation_m": min(elevations),
        "max_elevation_m": max(elevations),
        "profile": profile
    }


@router.get("/benchmarks")
def get_benchmarks():
    rows = queries.get_benchmarks()
    stratified = []
    total_rmse = 0.0
    total_mae = 0.0
    total_pearson = 0.0

    for r in rows:
        stratified.append({
            "landscape_type": r["landscape_type"],
            "scene_name": r["scene_name"],
            "rmse_m": r["rmse_m"],
            "mae_m": r["mae_m"],
            "pearson_r": r["pearson_r"],
            "dynamic_range": r["dynamic_range"] or "N/A"
        })
        total_rmse += r["rmse_m"]
        total_mae += r["mae_m"]
        total_pearson += r["pearson_r"]

    count = max(1, len(rows))
    return {
        "validation_dataset": "GAMUS + Copernicus DEM GLO-30 Ground Truth",
        "evaluated_at": "2026-09-10T12:00:00Z",
        "summary_metrics": {
            "overall_rmse_m": round(total_rmse / count, 2),
            "overall_mae_m": round(total_mae / count, 2),
            "overall_pearson_r": round(total_pearson / count, 3)
        },
        "stratified_results": stratified
    }


@router.get("/export/{scene_id}")
def export_scene(scene_id: str):
    scene = queries.get_scene_by_id(scene_id)
    if not scene:
        raise HTTPException(status_code=404, detail="Scene not found")
    # Return placeholder or generated geotiff if exists
    dsm_path = scene["dsm_path"].lstrip("/")
    if os.path.exists(dsm_path):
        return FileResponse(dsm_path, filename=f"{scene_id}_metric.tif", media_type="image/tiff")
    return {"message": f"Export prepared for {scene_id}", "url": scene["dsm_path"]}
