# 🖥️ Aarav's Frontend Playbook: Coordination & UI Implementation
## Project DepthWizard — ISRO Problem Statement 26175
*Author: Frontend Lead & UI Engineer (Aarav)*

---

## 1. Role Overview & Your Mission
As the Frontend Lead, your mission is to deliver a **command-center grade 3D geospatial dashboard** that runs at 60 FPS in Google Chrome on ordinary student laptops.

You lead **Squad 2 (Frontend, 3D & Presentation)**:
- **You (Aarav):** Dashboard layout, telemetry controls, 4 preset cards, Chart.js 2D profile drawer, and API communication.
- **Tarun:** The Three.js 3D viewport, GPU height displacement shader, optical texture draping, and cinematic drone flight path.
- **Spoorthy:** UI theme styling (ISRO Dark Mode), 10-slide PowerPoint presentation deck, and recording 60fps backup demo videos.

---

## 2. What to Ask Tarun to Build (Exact Tasks & Specifications)

Tarun is your 3D graphics engineer. Give him these exact specifications so he has zero confusion:

### Request to Tarun #1: The 3D Canvas & Height Mesh
- **File:** `frontend/src/3d/terrain.js`
- **What to say to Tarun:**
  > *"Tarun, create a Three.js scene with a standard `PlaneGeometry(100, 100, 512, 512)`. Set its rotation to `-Math.PI / 2` so it lies flat. Connect a `MeshStandardMaterial` using the optical satellite RGB image as `map` and the 16-bit height PNG as `displacementMap` with a `displacementScale` of 12.0. Add a directional light and an ambient light."*
- **Acceptance Criteria:** The terrain looks like a real 3D landscape with hills and buildings protruding upwards.

### Request to Tarun #2: The Drone Camera Flight Spline
- **File:** `frontend/src/3d/cameraFlight.js`
- **What to say to Tarun:**
  > *"Tarun, write a function `startCinematicFlight()` that moves the camera along a smooth `THREE.CatmullRomCurve3` spline looping across the terrain. When I click the `[▶ CINEMATIC FLIGHT]` button on my UI, it should trigger your flight loop."*
- **Acceptance Criteria:** Clicking the flight button makes the camera swoop gracefully across the buildings and mountain ridges.

### Request to Tarun #3: The Shader Layer Switcher
- **What to say to Tarun:**
  > *"Tarun, give me a function `setLayer(mode)` where `mode` can be `'optical'`, `'heatmap'`, or `'hillshade'`. If it's `'heatmap'`, switch the texture to a false-color Turbo/Viridis elevation colormap."*

---

## 3. What to Ask Spoorthy to Build (Styling & Presentation)

Spoorthy handles visual polish and evaluator-facing materials:

### Request to Spoorthy #1: ISRO Command Center Dark Theme
- **File:** `frontend/src/styles/theme.css`
- **What to say to Spoorthy:**
  > *"Spoorthy, create our CSS variables and styling classes using the official color palette:
  > - Background: Deep space navy (`#0B0F19`)
  > - Panels: Translucent glassmorphism (`rgba(17, 24, 39, 0.85)` with `backdrop-filter: blur(12px)`)
  > - Accents: Radar Cyan (`#00F2FE`) and Status Emerald (`#00FFA3`)
  > - Borders: Crisp subtle lines (`1px solid rgba(255, 255, 255, 0.12)`)."*

### Request to Spoorthy #2: The 10-Slide Deck & Timed Script
- **What to say to Spoorthy:**
  > *"Spoorthy, prepare the 10-slide PowerPoint based on the template in `docs/01_PRD.md`. Write a 5-minute speaking script that walks through: the problem, the single-image AI approach, our metric calibration against Copernicus DEM, our live 3D demo, and our RMSE accuracy table."*

### Request to Spoorthy #3: Bulletproof 60fps Backup Video
- **What to say to Spoorthy:**
  > *"Spoorthy, once Tarun's 3D flythrough is working, use OBS or Windows Game Bar (`Win + G`) to record a clean, 60-second screen capture of the 3D drone flight and point inspection. Embed this video into slide 7 of your deck so we have zero risk if venue Wi-Fi or projectors fail."*

---

## 4. Your Own Technical Checklist (Aarav's Coding Tasks)

You own the application shell, UI controls, and analytical graphs:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                             UI DASHBOARD LAYOUT                             │
├─────────────────────────────────────────────────────────────────────────────┤
│ Top Bar: [ISRO DEPTHWIZARD LOGO]  [Telemetry: Lat/Lon/Elev] [Validation Tab]│
├───────────────────┬─────────────────────────────────────────────────────────┤
│ Left Panel (25%)  │ Center Viewport (75%)                                   │
│ • Preset Scenes   │ • Tarun's Three.js 3D WebGL Canvas                      │
│ • Upload Tile     │ • Point Inspection HUD Marker                           │
│ • Layer Toggles   │                                                         │
│ • [▶ FLIGHT]      │                                                         │
├───────────────────┴─────────────────────────────────────────────────────────┤
│ Slide-Up Tray (Bottom): Chart.js 2D Cross-Section Elevation Transect Graph  │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Task 1: The 4 Preset Buttons (Your Secret Demo Weapon)
- **File:** `frontend/src/hud/presets.js`
- Create 4 clickable card buttons:
  1. 🏙️ **Urban Core (Ahmedabad)**
  2. 🌾 **Sparse Plains (Punjab)**
  3. ⛰️ **Mountain Ridges (Himachal)**
  4. 🌲 **Forested Canopy (Western Ghats)**
- When clicked, load the corresponding pre-packaged assets from `demo_data/` so the demo works instantly with **0 second loading delay**!

### Task 2: The 2D Elevation Profile Chart (`frontend/src/chart/profileChart.js`)
- Use **Chart.js** inside a slide-up drawer at the bottom of the screen.
- When the user draws a 2-point transect line across the terrain:
  ```javascript
  import Chart from 'chart.js/auto';

  let profileChart = null;

  export function renderElevationProfile(distanceArray, elevationArray) {
    const ctx = document.getElementById('profileChartCanvas').getContext('2d');
    if (profileChart) profileChart.destroy();

    profileChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: distanceArray.map(d => `${Math.round(d)}m`),
        datasets: [{
          label: 'Elevation Profile (m)',
          data: elevationArray,
          borderColor: '#00F2FE',
          backgroundColor: 'rgba(0, 242, 254, 0.15)',
          fill: true,
          tension: 0.2,
          pointRadius: 1
        }]
      },
      options: {
        responsive: true,
        scales: {
          y: { title: { display: true, text: 'Elevation (m ASL)', color: '#94A3B8' } },
          x: { title: { display: true, text: 'Distance along Transect (m)', color: '#94A3B8' } }
        }
      }
    });
    document.getElementById('profileDrawer').classList.add('open');
  }
  ```

### Task 3: The Point Inspection Card (`frontend/src/hud/inspector.js`)
- When the user clicks a point on the 3D surface, call `/api/inspect/{scene_id}?x=...&y=...` (or use local cached array).
- Display a sleek HUD badge:
  - 📍 Coordinates: `Lat: 23.0225° N, Lon: 72.5714° E`
  - 🏔️ Absolute Elevation: `418.2 m`
  - 🏢 Structure Height (AGL): `54.6 m`

---

## 5. How to Build Everything Without Waiting for the Backend
Do **NOT** wait for Hasini or Dheer to finish the backend before coding!  
Create a `frontend/src/mockData.js` file with the exact JSON data from `docs/05_TRD_AND_API_SPECS.md`.

Write an API service with an instant fallback switch:
```javascript
const USE_MOCK = true; // Toggle to false when backend is running!

export async function fetchSceneMetadata(sceneId) {
  if (USE_MOCK) {
    return MOCK_SCENES[sceneId];
  }
  const response = await fetch(`http://localhost:8000/api/scenes/${sceneId}`);
  return await response.json();
}
```
This lets you, Tarun, and Spoorthy build and test the entire user interface and 3D terrain viewer immediately!
