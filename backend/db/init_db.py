import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).resolve().parent.parent.parent / "depth.db"

def init_database(db_path=DB_PATH):
    conn = sqlite3.connect(db_path)
    cur = conn.cursor()

    cur.executescript("""
    CREATE TABLE IF NOT EXISTS scenes (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        landscape_type TEXT NOT NULL,
        file_format TEXT NOT NULL,
        is_georeferenced INTEGER DEFAULT 0,
        crs TEXT,
        bbox_min_x REAL,
        bbox_min_y REAL,
        bbox_max_x REAL,
        bbox_max_y REAL,
        optical_path TEXT NOT NULL,
        dsm_path TEXT NOT NULL,
        height_texture TEXT,
        min_elevation_m REAL,
        max_elevation_m REAL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS ground_truths (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        scene_id TEXT NOT NULL,
        gt_source TEXT NOT NULL,
        gt_dsm_path TEXT NOT NULL,
        vertical_datum TEXT,
        resolution_m REAL,
        FOREIGN KEY(scene_id) REFERENCES scenes(id)
    );

    CREATE TABLE IF NOT EXISTS benchmark_metrics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        scene_id TEXT NOT NULL,
        landscape_type TEXT NOT NULL,
        rmse_m REAL NOT NULL,
        mae_m REAL NOT NULL,
        pearson_r REAL NOT NULL,
        dynamic_range TEXT,
        evaluated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(scene_id) REFERENCES scenes(id)
    );

    CREATE TABLE IF NOT EXISTS point_inspections (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        scene_id TEXT NOT NULL,
        label TEXT,
        pixel_x INTEGER NOT NULL,
        pixel_y INTEGER NOT NULL,
        lat REAL,
        lon REAL,
        elevation_z_m REAL NOT NULL,
        height_agl_m REAL NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(scene_id) REFERENCES scenes(id)
    );

    CREATE TABLE IF NOT EXISTS transect_profiles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        scene_id TEXT NOT NULL,
        start_x INTEGER NOT NULL,
        start_y INTEGER NOT NULL,
        end_x INTEGER NOT NULL,
        end_y INTEGER NOT NULL,
        profile_json TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(scene_id) REFERENCES scenes(id)
    );
    """)

    # Seed 4 Core Presets
    presets = [
        (
            "urban-ahmedabad-01",
            "Urban High-Rise (Ahmedabad)",
            "urban",
            "tif",
            1,
            "EPSG:32643",
            72.5012, 23.0114, 72.5428, 23.0456,
            "/static/demo_data/urban-ahmedabad-01/optical.png",
            "/static/demo_data/urban-ahmedabad-01/dsm_metric.tif",
            "/static/demo_data/urban-ahmedabad-01/disp_16bit.png",
            42.5, 184.2
        ),
        (
            "sparse-plains-02",
            "Agricultural Plains (Punjab)",
            "sparse",
            "tif",
            1,
            "EPSG:32643",
            75.8012, 30.9014, 75.8428, 30.9456,
            "/static/demo_data/sparse-plains-02/optical.png",
            "/static/demo_data/sparse-plains-02/dsm_metric.tif",
            "/static/demo_data/sparse-plains-02/disp_16bit.png",
            210.0, 235.4
        ),
        (
            "mountain-himalayas-03",
            "Mountain Ridges (Himachal)",
            "mountain",
            "tif",
            1,
            "EPSG:32643",
            77.1012, 32.2014, 77.1428, 32.2456,
            "/static/demo_data/mountain-himalayas-03/optical.png",
            "/static/demo_data/mountain-himalayas-03/dsm_metric.tif",
            "/static/demo_data/mountain-himalayas-03/disp_16bit.png",
            1420.0, 3150.0
        ),
        (
            "forest-western-ghats-04",
            "Forested Canopy (Western Ghats)",
            "forest",
            "tif",
            1,
            "EPSG:32643",
            75.3012, 12.5014, 75.3428, 12.5456,
            "/static/demo_data/forest-western-ghats-04/optical.png",
            "/static/demo_data/forest-western-ghats-04/dsm_metric.tif",
            "/static/demo_data/forest-western-ghats-04/disp_16bit.png",
            610.0, 890.0
        )
    ]

    for p in presets:
        cur.execute("""
        INSERT OR REPLACE INTO scenes 
        (id, name, landscape_type, file_format, is_georeferenced, crs,
         bbox_min_x, bbox_min_y, bbox_max_x, bbox_max_y,
         optical_path, dsm_path, height_texture, min_elevation_m, max_elevation_m)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, p)

    # Seed Benchmark Scorecard
    benchmarks = [
        ("urban-ahmedabad-01", "Urban High-Rise", 3.82, 2.61, 0.89, "50m - 184m"),
        ("sparse-plains-02", "Sparse Plains", 1.94, 1.42, 0.94, "210m - 235m"),
        ("mountain-himalayas-03", "Hilly Mountains", 5.11, 3.88, 0.91, "1420m - 3150m"),
        ("forest-western-ghats-04", "Forested Canopy", 3.45, 2.50, 0.87, "610m - 890m")
    ]

    for b in benchmarks:
        cur.execute("""
        INSERT OR REPLACE INTO benchmark_metrics
        (id, scene_id, landscape_type, rmse_m, mae_m, pearson_r, dynamic_range)
        VALUES (
            (SELECT id FROM benchmark_metrics WHERE scene_id = ?),
            ?, ?, ?, ?, ?, ?
        )
        """, (b[0], b[0], b[1], b[2], b[3], b[4], b[5]))

    conn.commit()
    conn.close()
    print(f"DepthWizard SQLite database initialized successfully at: {db_path}")

if __name__ == "__main__":
    init_database()
