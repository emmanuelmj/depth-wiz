# 📋 Product Requirements Document (PRD)
## Project DepthWizard — ISRO Problem Statement 26175
**Single-View Height Estimation and 3D Flythrough**  
*Target Milestone: Internal Hackathon Screening (September 10, 2026)*

---

## 1. Executive Summary & Plain-English Explanation
Imagine taking a flat, top-down satellite photo of a city or a mountain range taken by an Indian Space Research Organisation (ISRO) satellite. Usually, to know how tall a building or mountain is, you need expensive LiDAR laser planes or two satellite pictures taken from different angles (stereo photogrammetry). 

**DepthWizard solves this with single-image artificial intelligence:**
You feed in **one single optical satellite picture**, and the software:
1. Figures out the heights of buildings, trees, and mountain slopes.
2. Calibrates those heights into **actual real-world meters** (using open elevation baselines like SRTM or Copernicus).
3. Turns that flat image into an interactive **3D terrain world in your web browser**, allowing you to fly a virtual drone through the city or over mountains like a video game, while letting you click on any building to see its exact height in meters.

---

## 2. Who is this for? (User Personas)
1. **ISRO Remote Sensing Analyst:** Wants to verify elevation profiles across India without waiting months for expensive stereo satellite passes.
2. **Disaster Management Commander (NDRF):** Needs instant 3D terrain and slope analysis after a landslide, flood, or earthquake to plan helicopter landing zones and evacuation paths.
3. **Urban Town Planner:** Wants to measure skyscraper heights, roof slopes, and building densities from regular aerial imagery.
4. **Hackathon Evaluator (The Immediate Judge):** Wants to see a stable, responsive, scientifically sound demonstration that works live without crashing, showing clear quantitative accuracy (RMSE/MAE).

---

## 3. Scope & Feature Prioritization (MoSCoW Matrix)

To make sure our 6-person student team finishes by September 10th without burning out, we strictly prioritize what gets built:

### P0: Must Have (Non-Negotiable for Sept 10)
- [x] **Dual Input Processing:**
  - **Pipeline A (Non-georeferenced images: `.png`, `.jpg`):** Produces a Relative Digital Surface Model ($rDSM$) normalized between 0 and 100%.
  - **Pipeline B (Georeferenced images: `.tif`, GeoTIFF):** Reads geographic coordinates, fetches/matches regional baseline elevation (Copernicus 30m / SRTM), and outputs an Absolute Metric Digital Surface Model ($DSM$) in real meters.
- [x] **High-Performance 3D Viewport:** Runs smoothly at 60 FPS in Chrome on ordinary student laptops (Intel Core i3 with integrated Intel UHD Graphics).
- [x] **Optical Texture Draping:** The original color satellite photo is projected perfectly onto the 3D height-displaced terrain.
- [x] **Dual Flight Navigation:**
  - **Cinematic Auto-Flythrough:** A single button click takes the evaluators on a smooth, automated camera sweep across the terrain.
  - **Manual Drone Flight:** Orbit controls (mouse drag/zoom) + First-person WASD navigation.
- [x] **4 Pre-Loaded Benchmark Scenes:** Instant one-click presets for **Urban Core, Sparse Plains, Hilly Mountains, and Forested Canopy** (so a live demo never fails due to slow file uploads).
- [x] **Point Height Inspection:** Click any building or point on the 3D map $\rightarrow$ displays latitude/longitude, elevation above sea level ($Z$), and height above ground level ($h_{AGL}$).
- [x] **Validation Dashboard:** Defensible accuracy table displaying **RMSE, MAE, and Pearson Correlation ($r$)** against reference ground truth.
- [x] **Air-Gapped Offline Mode:** Zero dependencies on hall Wi-Fi during the presentation.

### P1: Should Have (Added once P0 is stable)
- [ ] **2D Cross-Section Profile Tool:** Draw a 2-point transect line across a mountain or street $\rightarrow$ displays a 2D height cross-section graph.
- [ ] **Multi-Layer Shader Toggle:** Switch between Natural Optical RGB, False-Color Elevation Heatmap (Turbo/Viridis), and Hillshade/Slope Hazard map.
- [ ] **Geospatial Export:** Download the generated height map as a calibrated GeoTIFF (`.tif`) that can be opened in QGIS or ArcGIS.

### P2: Won't Have for Sept 10 (Future Finale Scope)
- [ ] Multi-temporal stereo imagery fusion.
- [ ] Synthetic Aperture Radar (SAR) interferometry integration.
- [ ] Multi-user cloud collaboration accounts.

---

## 4. Functional Requirements

### FR-1: Image Ingestion & Metadata Parsing
- The system must accept `.png`, `.jpg`, and `.tif` files up to 20MB.
- If the file is a GeoTIFF (`.tif`), the system extracts its Coordinate Reference System (CRS, e.g., EPSG:4326 or EPSG:32643), spatial bounding box, and ground sample distance (GSD).
- If the file is a standard `.png` or `.jpg`, the system flags it as relative mode without throwing errors.

### FR-2: Elevation Extraction & Inversion
- Ingest optical RGB channels.
- Generate edge-preserving relative depth where building boundaries and mountain ridges remain crisp.
- Automatically invert depth so flat ground is at elevation 0 and tall structures extrude upwards.

### FR-3: Metric Elevation Calibration (Affine Alignment)
- For GeoTIFFs, align predicted relative height $d_{rel}$ to real-world elevation baseline $Z_{base}$ using linear affine scaling:
  $$Z_{metric} = s \cdot d_{rel} + t$$
- Scale $s$ and translation offset $t$ must map the dynamic range realistically to regional sea-level and ground heights.

### FR-4: Interactive 3D WebGL Visualization
- Must render in WebGL using Three.js without requiring browser plugins.
- Must achieve at least 45–60 FPS on integrated Intel UHD graphics.
- Drapes the RGB optical texture directly on top of the displaced terrain vertices.

### FR-5: Quantitative Validation Engine
- For evaluation scenes with reference data, compute:
  $$\text{RMSE} = \sqrt{\frac{1}{N}\sum_{i=1}^N (Z_{pred}^{(i)} - Z_{gt}^{(i)})^2}$$
  $$\text{MAE} = \frac{1}{N}\sum_{i=1}^N |Z_{pred}^{(i)} - Z_{gt}^{(i)}|$$
- Display the results clearly in a table categorized across the 4 ISRO terrain categories.

---

## 5. Non-Functional Requirements
1. **Performance & Lightweight Execution:** The web application must initialize and load any of the 4 benchmark scenes in under 2.0 seconds.
2. **Crash Resilience:** If an invalid file or corrupted image is uploaded, the UI must show a friendly error toast rather than a white blank screen.
3. **Zero-Internet Presentation Safety:** All models, scripts, 3D libraries, and sample tiles must be stored locally on the presentation machine.
4. **Intuitive Student/Evaluator Usability:** No command-line commands during the live demo; everything is accessible via clear buttons and toggles on the web UI.
