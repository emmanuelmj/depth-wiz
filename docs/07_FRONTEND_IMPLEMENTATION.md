# Frontend Implementation

Vite + vanilla JS + Three.js + Chart.js. No framework, no CSS library.

## Layout
```
┌────────────────────────────────────────────────────────────────────────┐
│ Top bar: logo · telemetry (lat/lon/elev) · validation tab              │
├──────────────────┬─────────────────────────────────────────────────────┤
│ Left panel (25%) │ Viewport (75%)                                      │
│ · preset scenes  │ · Three.js WebGL canvas                             │
│ · upload tile    │ · point inspection marker + HUD badge               │
│ · layer toggles  │                                                     │
│ · [flight]       │                                                     │
├──────────────────┴─────────────────────────────────────────────────────┤
│ Slide-up drawer: Chart.js cross-section transect                       │
└────────────────────────────────────────────────────────────────────────┘
```

## Module Map
| File | Responsibility |
|---|---|
| `src/3d/terrain.js` | Scene, mesh, displacement material, lighting |
| `src/3d/cameraFlight.js` | Cinematic spline flight + orbit/WASD controls |
| `src/3d/picking.js` | Raycast → UV → raster pixel mapping |
| `src/hud/presets.js` | 4 preset scene cards |
| `src/hud/inspector.js` | Point inspection badge |
| `src/hud/layers.js` | Optical / heatmap / hillshade switch |
| `src/chart/profileChart.js` | Chart.js transect drawer |
| `src/api.js` | Backend client + mock fallback |
| `src/styles/theme.css` | CSS variables and panel styling |

---

## Terrain Mesh (`src/3d/terrain.js`)

```javascript
import * as THREE from 'three';

export function buildTerrain(scene, sceneData) {
  const geometry = new THREE.PlaneGeometry(100, 100, 512, 512);

  const loader = new THREE.TextureLoader();
  const colorTexture = loader.load(sceneData.assets.optical_texture_url);
  const displacementTexture = loader.load(sceneData.assets.height_map_url);

  colorTexture.colorSpace = THREE.SRGBColorSpace;
  displacementTexture.colorSpace = THREE.NoColorSpace;   // height data, not color

  const material = new THREE.MeshStandardMaterial({
    map: colorTexture,
    displacementMap: displacementTexture,
    displacementScale: 12.0,
    roughness: 0.8,
    metalness: 0.1
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.rotation.x = -Math.PI / 2;
  scene.add(mesh);

  scene.add(new THREE.AmbientLight(0xffffff, 0.6));
  const sun = new THREE.DirectionalLight(0xffffff, 1.2);
  sun.position.set(50, 80, 30);
  scene.add(sun);

  return mesh;
}
```

### Performance rules (integrated GPU target)
- 512×512 segments ≈ 262k vertices — the practical ceiling for Intel UHD.
  Drop to 256×256 if frame time exceeds 16 ms.
- Displacement runs in the vertex shader; never rebuild geometry on the CPU
  when switching scenes — swap `material.map` / `material.displacementMap`
  and call `material.needsUpdate = true`.
- Cap `renderer.setPixelRatio(Math.min(devicePixelRatio, 2))`.
- Disable shadow maps; they cost more than they add on this terrain.

### Vertical exaggeration
`displacementScale` is a **visual** parameter and is not tied to meters. Derive
it from the scene's elevation range so mountains and cities look comparable,
and always report real values from the API — never read heights off the mesh:

```javascript
const range = sceneData.elevation_stats.max_m - sceneData.elevation_stats.min_m;
material.displacementScale = THREE.MathUtils.clamp(600 / range, 4, 25);
```

---

## Camera Flight (`src/3d/cameraFlight.js`)

```javascript
import * as THREE from 'three';

const curve = new THREE.CatmullRomCurve3([
  new THREE.Vector3(-40, 25, 40),
  new THREE.Vector3(0, 15, 20),
  new THREE.Vector3(30, 20, -10),
  new THREE.Vector3(0, 30, -30),
  new THREE.Vector3(-40, 25, 40)
], true);   // closed loop

let flying = false, progress = 0;

export function startCinematicFlight() { flying = true; }
export function stopCinematicFlight()  { flying = false; }

export function updateFlight(camera, controls, delta) {
  if (!flying) return;
  progress = (progress + delta * 0.03) % 1.0;          // ~33s per loop
  camera.position.copy(curve.getPointAt(progress));
  camera.lookAt(curve.getPointAt((progress + 0.05) % 1.0));
  controls.enabled = false;
}
```

Drive `progress` from frame delta (not frame count) so flight speed is identical
on 30 FPS and 60 FPS machines. Re-enable `controls` on stop, and stop flight on
any manual input so the user is never fighting the camera.

---

## Point Inspection (`src/3d/picking.js`)

Raycast the mesh, read the UV at the hit, convert to raster pixel coordinates.
Note the Y flip: texture UV origin is bottom-left, raster origin is top-left.

```javascript
import * as THREE from 'three';

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

export function pickPixel(event, camera, mesh, size = 1024) {
  const rect = event.target.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

  raycaster.setFromCamera(pointer, camera);
  const [hit] = raycaster.intersectObject(mesh);
  if (!hit || !hit.uv) return null;

  return {
    x: Math.floor(hit.uv.x * size),
    y: Math.floor((1 - hit.uv.y) * size)
  };
}
```

Raycasting hits the **undisplaced** plane geometry — Three.js raycasts against
CPU-side vertex positions, which the GPU displacement never modifies. The UV is
still correct, so pixel lookup is accurate, but the 3D marker will float at
`y = 0`. Position the marker using the elevation returned by `/api/inspect`
rather than `hit.point.y`.

Then query the backend and render the badge:

```javascript
const px = pickPixel(event, camera, mesh);
const res = await fetch(`/api/inspect/${sceneId}?x=${px.x}&y=${px.y}`);
const { coordinates, metrics } = await res.json();
showInspector({
  lat: coordinates.latitude,
  lon: coordinates.longitude,
  elevation: metrics.absolute_elevation_m,
  agl: metrics.height_above_ground_m
});
```

For relative-mode scenes, `absolute_elevation_m` is absent — display percentage
of the normalized range and suppress the meter unit entirely.

---

## Layer Switching (`src/hud/layers.js`)

```javascript
export function setLayer(material, textures, mode) {
  material.map = textures[mode];      // 'optical' | 'heatmap' | 'hillshade'
  material.needsUpdate = true;
}
```

Heatmap and hillshade are precomputed PNGs served alongside the optical texture,
not generated in-browser — colormapping a 1024² raster in JS stalls the frame.

---

## Elevation Profile (`src/chart/profileChart.js`)

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
      animation: false,
      scales: {
        y: { title: { display: true, text: 'Elevation (m ASL)', color: '#94A3B8' } },
        x: { title: { display: true, text: 'Distance (m)', color: '#94A3B8' } }
      }
    }
  });
  document.getElementById('profileDrawer').classList.add('open');
}
```

Always `destroy()` the previous chart — leaking Chart.js instances onto the same
canvas degrades to single-digit FPS after a few transects.

---

## Preset Scenes (`src/hud/presets.js`)

Four cards load precomputed assets from `demo_data/` with no inference step:

| Card | Scene ID |
|---|---|
| Urban Core (Ahmedabad) | `urban-ahmedabad-01` |
| Sparse Plains (Punjab) | `sparse-plains-02` |
| Mountain Ridges (Himachal) | `mountain-himalayas-03` |
| Forested Canopy (Western Ghats) | `forest-western-ghats-04` |

Preload all four textures at startup so a preset click is an instant material
swap rather than a network fetch.

---

## Backend-Independent Development (`src/api.js`)

Mock responses mirror the contracts in `05_TRD_AND_API_SPECS.md`, so the UI and
3D viewport can be built before the pipeline exists:

```javascript
import { MOCK_SCENES } from './mockData.js';

const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true';
const BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:8000';

export async function fetchSceneMetadata(sceneId) {
  if (USE_MOCK) return MOCK_SCENES[sceneId];
  const res = await fetch(`${BASE}/api/scenes/${sceneId}`);
  if (!res.ok) throw new Error(`scene fetch failed: ${res.status}`);
  return res.json();
}
```

Drive the flag from an env var rather than a hardcoded constant — a `USE_MOCK =
true` accidentally left in the source will silently serve fake numbers during
evaluation.

---

## Theme Tokens (`src/styles/theme.css`)

```css
:root {
  --bg-primary: #0B0F19;
  --panel-bg: rgba(17, 24, 39, 0.85);
  --panel-blur: blur(12px);
  --accent-cyan: #00F2FE;
  --accent-emerald: #00FFA3;
  --border-subtle: 1px solid rgba(255, 255, 255, 0.12);
  --text-muted: #94A3B8;
}
```

---

## Error Handling
- Failed upload or unsupported format → inline toast, viewport keeps the last
  scene loaded. Never leave a blank canvas.
- WebGL context loss (common on integrated GPUs under memory pressure) → listen
  for `webglcontextlost`, prevent default, and rebuild the scene on
  `webglcontextrestored`.
- Backend unreachable → fall back to bundled preset assets and mark the
  telemetry bar as offline rather than throwing.
