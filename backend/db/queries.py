import sqlite3
from pathlib import Path
from typing import List, Optional, Dict, Any

DB_PATH = Path(__file__).resolve().parent.parent.parent / "depth.db"

def get_db_connection(db_path=DB_PATH):
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    return conn

def get_all_scenes() -> List[Dict[str, Any]]:
    conn = get_db_connection()
    rows = conn.execute("SELECT * FROM scenes ORDER BY created_at ASC").fetchall()
    conn.close()
    return [dict(r) for r in rows]

def get_scene_by_id(scene_id: str) -> Optional[Dict[str, Any]]:
    conn = get_db_connection()
    row = conn.execute("SELECT * FROM scenes WHERE id = ?", (scene_id,)).fetchone()
    conn.close()
    return dict(row) if row else None

def get_benchmarks() -> List[Dict[str, Any]]:
    conn = get_db_connection()
    rows = conn.execute("""
        SELECT b.*, s.name as scene_name 
        FROM benchmark_metrics b
        JOIN scenes s ON b.scene_id = s.id
        ORDER BY b.id ASC
    """).fetchall()
    conn.close()
    return [dict(r) for r in rows]

def insert_scene(scene_data: Dict[str, Any]):
    conn = get_db_connection()
    conn.execute("""
        INSERT INTO scenes 
        (id, name, landscape_type, file_format, is_georeferenced, crs,
         bbox_min_x, bbox_min_y, bbox_max_x, bbox_max_y,
         optical_path, dsm_path, height_texture, min_elevation_m, max_elevation_m)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        scene_data["id"],
        scene_data["name"],
        scene_data.get("landscape_type", "custom"),
        scene_data.get("file_format", "png"),
        scene_data.get("is_georeferenced", 0),
        scene_data.get("crs"),
        scene_data.get("bbox_min_x"),
        scene_data.get("bbox_min_y"),
        scene_data.get("bbox_max_x"),
        scene_data.get("bbox_max_y"),
        scene_data["optical_path"],
        scene_data["dsm_path"],
        scene_data.get("height_texture"),
        scene_data.get("min_elevation_m", 0.0),
        scene_data.get("max_elevation_m", 100.0)
    ))
    conn.commit()
    conn.close()

def save_point_inspection(scene_id: str, label: Optional[str], x: int, y: int,
                          lat: Optional[float], lon: Optional[float],
                          elev: float, h_agl: float) -> int:
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO point_inspections 
        (scene_id, label, pixel_x, pixel_y, lat, lon, elevation_z_m, height_agl_m)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, (scene_id, label, x, y, lat, lon, elev, h_agl))
    inserted_id = cur.lastrowid
    conn.commit()
    conn.close()
    return inserted_id

def save_transect_profile(scene_id: str, start_x: int, start_y: int,
                          end_x: int, end_y: int, profile_json: str) -> int:
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO transect_profiles 
        (scene_id, start_x, start_y, end_x, end_y, profile_json)
        VALUES (?, ?, ?, ?, ?, ?)
    """, (scene_id, start_x, start_y, end_x, end_y, profile_json))
    inserted_id = cur.lastrowid
    conn.commit()
    conn.close()
    return inserted_id
