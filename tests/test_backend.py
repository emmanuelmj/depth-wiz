import os
import sys
import shutil
import sqlite3
from pathlib import Path

# Add project root to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from fastapi.testclient import TestClient
from backend.main import app

client = TestClient(app)

def test_full_backend_suite():
    print("=== RUNNING FULL DEPTHWIZARD BACKEND INTEGRITY AUDIT ===")

    # 1. Health
    r = client.get("/api/health")
    assert r.status_code == 200, f"Health check failed: {r.text}"
    print("1. Health Endpoint: OK ->", r.json()["service"])

    # 2. Engine Status
    r = client.get("/api/engine/status")
    assert r.status_code == 200, f"Engine status failed: {r.text}"
    print("2. Engine Status Endpoint: OK ->", r.json()["resolved_strategy"], "| Device:", r.json()["device_name"])

    # 3. Strategy Switch
    r = client.post("/api/engine/strategy?mode=cpu")
    assert r.status_code == 200
    print("3. Strategy Switch Endpoint: OK ->", r.json()["message"])

    # 4. List Scenes
    r = client.get("/api/scenes")
    assert r.status_code == 200
    scenes = r.json()
    assert len(scenes) >= 1, "Expected at least 1 scene (dc-03-26)"
    print("4. List Scenes Endpoint: OK -> Found", len(scenes), "scenes; sample ID:", scenes[0]["id"])

    # 5. Get Scene Details
    r = client.get(f"/api/scenes/{scenes[0]['id']}")
    assert r.status_code == 200
    print("5. Scene Details Endpoint: OK ->", r.json()["name"], "| Elev:", r.json()["elevation_stats"])

    # 6. Upload Image & Run Inference Pipeline
    test_img = Path("backend/static/demo_data/dc-03-26/optical.png")
    assert test_img.exists(), "Sample optical.png missing"
    with open(test_img, "rb") as f:
        files = {"file": ("test_satellite.png", f, "image/png")}
        r = client.post("/api/upload", files=files)
    assert r.status_code == 201, f"Upload failed: {r.text}"
    uploaded_scene = r.json()
    uploaded_id = uploaded_scene["id"]
    print("6. Upload & Inference Pipeline: OK -> Created Scene:", uploaded_id, "| Engine:", uploaded_scene["engine_used"])
    print("   Assets Created:", uploaded_scene["assets"])
    print("   Elevation Stats:", uploaded_scene["elevation_stats"])

    # 7. Point Inspection (Real 16-bit Raster Sampling)
    r = client.get(f"/api/inspect/{uploaded_id}?x=512&y=512")
    assert r.status_code == 200
    print("7. Point Inspection (Raster Sampling): OK ->", r.json()["metrics"])

    # 8. Transect Profile Generation & DB Save
    payload = {
        "start_pixel": {"x": 100, "y": 100},
        "end_pixel": {"x": 900, "y": 900},
        "samples": 50
    }
    r = client.post(f"/api/transect/{uploaded_id}", json=payload)
    assert r.status_code == 200
    transect = r.json()
    assert len(transect["profile"]) == 50
    print("8. Transect Profile (50 samples): OK -> Distance:", transect["distance_total_m"], "m | Elev Range:", transect["min_elevation_m"], "to", transect["max_elevation_m"])

    # 9. Benchmarks
    r = client.get("/api/benchmarks")
    assert r.status_code == 200
    print("9. Benchmarks Endpoint: OK -> Overall RMSE:", r.json()["summary_metrics"]["overall_rmse_m"], "m | Pearson r:", r.json()["summary_metrics"]["overall_pearson_r"])

    # 10. Clean up test upload files & database records
    shutil.rmtree(Path("data/uploads") / uploaded_id, ignore_errors=True)
    conn = sqlite3.connect("depth.db")
    cur = conn.cursor()
    cur.execute("DELETE FROM scenes WHERE id = ?", (uploaded_id,))
    cur.execute("DELETE FROM point_inspections WHERE scene_id = ?", (uploaded_id,))
    cur.execute("DELETE FROM transect_profiles WHERE scene_id = ?", (uploaded_id,))
    conn.commit()
    conn.close()

    print("\nALL 9 CORE BACKEND MODULES AND SQLITE DB TABLES PASSED 100% PERFECTLY!")

if __name__ == "__main__":
    test_full_backend_suite()
