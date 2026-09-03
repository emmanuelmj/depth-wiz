# Database & Storage

## Pattern
Heavy raster/texture files are stored on the file system; SQLite (`depth.db`)
stores only metadata, paths, and computed metrics.

```
/data/optical/scene_01.png       ─┐
/data/dsm/scene_01_metric.tif     ├─ paths referenced by scenes table
/data/ground_truth/scene_01_gt.tif┘
```

## Schema

### `scenes` — primary scene registry
| Column | Type | Description |
|---|---|---|
| `id` | TEXT PK | Unique scene ID |
| `name` | TEXT | Display name |
| `landscape_type` | TEXT | `urban` / `sparse` / `mountain` / `forest` |
| `file_format` | TEXT | `png` / `jpg` / `tif` / `h5` |
| `is_georeferenced` | INTEGER | 1 = metric DSM, 0 = relative DSM |
| `crs` | TEXT | e.g. `EPSG:32643`, or NULL |
| `bbox_min_x/min_y/max_x/max_y` | REAL | Bounding box (lon/lat) |
| `optical_path` | TEXT | Path to optical RGB image |
| `dsm_path` | TEXT | Path to estimated DSM |
| `height_texture` | TEXT | Path to 16-bit displacement PNG |
| `min_elevation_m` / `max_elevation_m` | REAL | Elevation range |
| `created_at` | TEXT | ISO timestamp |

### `ground_truths` — reference elevation sources
| Column | Type | Description |
|---|---|---|
| `id` | INTEGER PK | |
| `scene_id` | TEXT FK → scenes.id | |
| `gt_source` | TEXT | `Copernicus-GLO-30` / `SRTM-30m` / `LiDAR` |
| `gt_dsm_path` | TEXT | Path to reference GeoTIFF |
| `vertical_datum` | TEXT | e.g. `EGM96`, `WGS84 Ellipsoid` |
| `resolution_m` | REAL | Grid pixel size in meters |

### `benchmark_metrics` — accuracy scores
| Column | Type | Description |
|---|---|---|
| `id` | INTEGER PK | |
| `scene_id` | TEXT FK → scenes.id | |
| `landscape_type` | TEXT | |
| `rmse_m` / `mae_m` / `pearson_r` | REAL | Accuracy metrics |
| `evaluated_at` | TEXT | Timestamp |

### `point_inspections` — saved click queries
| Column | Type | Description |
|---|---|---|
| `id` | INTEGER PK | |
| `scene_id` | TEXT FK → scenes.id | |
| `label` | TEXT | Landmark name |
| `pixel_x` / `pixel_y` | INTEGER | Image pixel coords |
| `lat` / `lon` | REAL | Estimated geographic coords |
| `elevation_z_m` | REAL | Elevation above sea level |
| `height_agl_m` | REAL | Height above ground |

### `transect_profiles` — 2D cross-sections
| Column | Type | Description |
|---|---|---|
| `id` | INTEGER PK | |
| `scene_id` | TEXT FK → scenes.id | |
| `start_x` / `start_y` / `end_x` / `end_y` | INTEGER | Line endpoints (pixels) |
| `profile_json` | TEXT | JSON array of elevation samples along the line |

## Init Script (`backend/db/init_db.py`)
```python
import sqlite3

def init_database(db_path="depth.db"):
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
    conn.commit()
    conn.close()

if __name__ == "__main__":
    init_database()
    print("Initialized depth.db")
```

## Access Layer (`backend/db/queries.py`)
All SQL lives here; API routes and services call these helpers instead of
opening their own connections.

```python
import sqlite3

DB_PATH = "depth.db"

def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def get_all_scenes():
    conn = get_db_connection()
    rows = conn.execute("SELECT * FROM scenes ORDER BY created_at").fetchall()
    conn.close()
    return [dict(r) for r in rows]

def get_scene_by_id(scene_id: str):
    conn = get_db_connection()
    row = conn.execute("SELECT * FROM scenes WHERE id = ?", (scene_id,)).fetchone()
    conn.close()
    return dict(row) if row else None

def get_benchmarks():
    conn = get_db_connection()
    rows = conn.execute("""
        SELECT b.*, s.name AS scene_name
        FROM benchmark_metrics b
        JOIN scenes s ON b.scene_id = s.id
    """).fetchall()
    conn.close()
    return [dict(r) for r in rows]

def save_point_inspection(scene_id, label, x, y, lat, lon, elev, h_agl):
    conn = get_db_connection()
    conn.execute("""
        INSERT INTO point_inspections
        (scene_id, label, pixel_x, pixel_y, lat, lon, elevation_z_m, height_agl_m)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, (scene_id, label, x, y, lat, lon, elev, h_agl))
    conn.commit()
    conn.close()
```

Rules:
- Always use parameterized queries (`?`), never string interpolation.
- `conn.row_factory = sqlite3.Row` so rows serialize directly to JSON dicts.
- SQLite connections are not thread-safe across threads — open per request,
  close in the same scope. Do not cache a module-level connection under Uvicorn.

## Storage Conventions
```
data/
├── optical/{scene_id}.png            # RGB input, 1024×1024
├── dsm/{scene_id}_metric.tif         # float32 calibrated DSM (meters)
├── cache/{scene_id}_disp.png         # 16-bit displacement texture
└── ground_truth/{scene_id}_gt.tif    # Reference Copernicus/SRTM tile
```

- `scene_id` is a UUID for uploads and a readable slug for the 4 presets.
- Preset assets live under `backend/static/demo_data/{scene_id}/` and are the
  only rasters committed to the repo (kept small); everything in `data/` is
  git-ignored.
- Store **relative** paths in the DB so the project stays portable across
  machines; resolve against a configured data root at read time.
- Deleting a scene row must also remove its files — orphaned rasters are the
  main source of disk bloat during iteration.
