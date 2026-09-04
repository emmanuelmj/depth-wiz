import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

import { initTerrain, updateTerrainScene, getRaycastTargets } from './3d/terrain.js';
import { toggleFlight, updateFlightLoop, getIsFlying } from './3d/cameraFlight.js';
import {
  initStreetNavigator,
  enableStreetMode,
  disableStreetMode,
  updateStreetNavigator,
  getIsStreetMode,
  getStreetTelemetry
} from './3d/streetNavigator.js';
import { pickTerrainPixel } from './3d/picking.js';
import { setupLayerControls } from './hud/layers.js';
import { showInspectorBadge } from './hud/inspector.js';
import { renderElevationProfile, closeTransectDrawer } from './chart/profileChart.js';
import { fetchSceneDetails, inspectPoint, fetchTransect, fetchBenchmarks, uploadTile } from './api.js';
import { DEFAULT_SCENE, createDynamicSceneFromImage } from './mockData.js';

let scene, camera, renderer, controls;
let activeSceneData = DEFAULT_SCENE;

// Frame & Performance Tracking
let lastTime = performance.now();
let lastFrameTime = performance.now();
let frames = 0;
const fpsEl = document.getElementById('hud-fps');

async function init() {
  const canvas = document.getElementById('three-canvas');
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;

  // 1. Three.js Scene & Perspective Camera
  scene = new THREE.Scene();
  scene.background = new THREE.Color('#050811');

  camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
  camera.position.set(0, 58, 62);

  // 2. High-Performance WebGL Renderer
  renderer = new THREE.WebGLRenderer({
    canvas: canvas,
    antialias: true,
    powerPreference: 'high-performance'
  });
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  // 3. Orbit Controls (for Aerial Satellite Mode)
  controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.maxPolarAngle = Math.PI / 2.45; // ~73 degrees max tilt
  controls.minDistance = 15;
  controls.maxDistance = 220;

  // 4. Initialize Terrain (Flat ground + Volumetric 3D Buildings)
  initTerrain(scene);

  // 5. Initialize First-Person WASD Street Navigation
  initStreetNavigator(camera, controls, canvas, (isStreet) => {
    updateNavigationModeUI(isStreet);
  });

  // 6. Setup UI Events & Layers
  setupLayerControls();
  setupUIEvents();

  // 7. Load Initial Verified GAMUS Benchmark Scene (DC_03_26)
  await loadScene(DEFAULT_SCENE);

  // 8. Viewport Click Raycasting for Point Inspection
  canvas.addEventListener('click', handleViewportClick);

  // 9. Resize Listener
  window.addEventListener('resize', onWindowResize);

  // 10. Start Render Loop
  lastFrameTime = performance.now();
  requestAnimationFrame(renderLoop);
}

function updateNavigationModeUI(isStreet) {
  const orbitBtn = document.getElementById('btn-mode-orbit');
  const streetBtn = document.getElementById('btn-mode-street');
  const streetHud = document.getElementById('street-hud');

  if (orbitBtn) orbitBtn.classList.toggle('active', !isStreet);
  if (streetBtn) streetBtn.classList.toggle('active', isStreet);
  if (streetHud) streetHud.style.display = isStreet ? 'block' : 'none';
}

async function loadScene(sceneData) {
  activeSceneData = sceneData;
  updateTerrainScene(sceneData);

  // Update HUD telemetry
  const coordEl = document.getElementById('hud-coord');
  const elevEl = document.getElementById('hud-elev');
  const aglEl = document.getElementById('hud-agl');

  if (coordEl && sceneData.bounds) {
    const midLat = ((sceneData.bounds.min_lat + sceneData.bounds.max_lat) / 2).toFixed(4);
    const midLon = ((sceneData.bounds.min_lon + sceneData.bounds.max_lon) / 2).toFixed(4);
    coordEl.innerText = `${midLat}° N, ${midLon}° E`;
  }
  if (elevEl && sceneData.elevation_stats) {
    elevEl.innerText = `${sceneData.elevation_stats.max_m} m`;
  }
  if (aglEl && sceneData.elevation_stats) {
    aglEl.innerText = `${sceneData.elevation_stats.max_building_agl_m} m`;
  }

  // Update active scene card in sidebar
  const nameEl = document.getElementById('active-scene-name');
  const subEl = document.getElementById('active-scene-sub');
  const iconEl = document.getElementById('active-scene-icon');

  if (nameEl) nameEl.innerText = sceneData.name;
  const minElev = sceneData.elevation_stats?.min_m ?? sceneData.min_elevation_m ?? 0;
  const maxElev = sceneData.elevation_stats?.max_m ?? sceneData.max_elevation_m ?? 100;
  const aglVal = sceneData.elevation_stats?.max_building_agl_m ?? 35;
  if (subEl) subEl.innerText = `${minElev}m – ${maxElev}m · AGL: ${aglVal}m`;

  if (iconEl) {
    const isMountain = sceneData.landscape_type === 'mountain' || sceneData.name.toLowerCase().includes('mount');
    iconEl.innerText = isMountain ? '⛰️' : '🏙️';
  }
}

async function handleViewportClick(e) {
  // In street drive mode or drone flight, mouse interaction is for steering/looking
  if (getIsFlying() || getIsStreetMode()) return;

  const canvas = document.getElementById('three-canvas');
  const hit = pickTerrainPixel(e, camera, getRaycastTargets(), canvas);
  if (hit) {
    const inspectResult = await inspectPoint(activeSceneData.id, hit.pixel.x, hit.pixel.y);
    showInspectorBadge(inspectResult);

    // Update top telemetry
    const coordEl = document.getElementById('hud-coord');
    const elevEl = document.getElementById('hud-elev');
    const aglEl = document.getElementById('hud-agl');

    if (coordEl) coordEl.innerText = `${inspectResult.coordinates.latitude}° N, ${inspectResult.coordinates.longitude}° E`;
    if (elevEl) elevEl.innerText = `${inspectResult.metrics.absolute_elevation_m} m`;
    if (aglEl) aglEl.innerText = `${inspectResult.metrics.height_above_ground_m} m`;
  }
}

function setupUIEvents() {
  // Navigation Mode: Orbit (Satellite)
  const modeOrbitBtn = document.getElementById('btn-mode-orbit');
  if (modeOrbitBtn) {
    modeOrbitBtn.addEventListener('click', () => {
      disableStreetMode();
      updateNavigationModeUI(false);
    });
  }

  // Navigation Mode: Street (WASD)
  const modeStreetBtn = document.getElementById('btn-mode-street');
  if (modeStreetBtn) {
    modeStreetBtn.addEventListener('click', () => {
      enableStreetMode();
      updateNavigationModeUI(true);
    });
  }

  // Autonomous Drone Flight button
  const flightBtn = document.getElementById('btn-drone-flight');
  if (flightBtn) {
    flightBtn.addEventListener('click', () => {
      if (getIsStreetMode()) {
        disableStreetMode();
        updateNavigationModeUI(false);
      }
      toggleFlight(camera, controls, (isFlying) => {
        flightBtn.innerHTML = isFlying
          ? '<span>⏸</span> STOP FLIGHT'
          : '<span>▶</span> CINEMATIC FLIGHT';
        flightBtn.style.background = isFlying
          ? 'linear-gradient(135deg, #F43F5E, #E11D48)'
          : 'linear-gradient(135deg, #00F2FE, #00A3FE)';
      });
    });
  }

  // Camera Reset
  const resetBtn = document.getElementById('btn-reset-cam');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      if (getIsStreetMode()) {
        disableStreetMode();
        updateNavigationModeUI(false);
      }
      camera.position.set(0, 58, 62);
      controls.target.set(0, 0, 0);
      controls.update();
    });
  }

  // Sample 2D Cross-Section Transect Button
  const transectBtn = document.getElementById('btn-sample-transect');
  if (transectBtn) {
    transectBtn.addEventListener('click', async () => {
      const transectData = await fetchTransect(
        activeSceneData.id,
        { x: 120, y: 200 },
        { x: 900, y: 820 },
        120
      );
      renderElevationProfile(transectData);
    });
  }

  // Drawer Close Button
  const closeDrawerBtn = document.getElementById('btn-close-drawer');
  if (closeDrawerBtn) {
    closeDrawerBtn.addEventListener('click', closeTransectDrawer);
  }

  // Reset to Default Scene
  const resetDefaultBtn = document.getElementById('btn-reset-default-scene');
  if (resetDefaultBtn) {
    resetDefaultBtn.addEventListener('click', () => {
      if (getIsStreetMode()) {
        disableStreetMode();
        updateNavigationModeUI(false);
      }
      loadScene(DEFAULT_SCENE);
    });
  }

  // Benchmarks Modal
  const openModalBtn = document.getElementById('btn-open-benchmarks');
  const closeModalBtn = document.getElementById('btn-close-modal');
  const modal = document.getElementById('benchmarkModal');

  if (openModalBtn && modal) {
    openModalBtn.addEventListener('click', async () => {
      const data = await fetchBenchmarks();
      const tbody = document.getElementById('benchmark-tbody');
      if (tbody && data.stratified_results) {
        tbody.innerHTML = data.stratified_results.map(row => `
          <tr>
            <td style="color: #FFFFFF; font-weight: 600;">${row.landscape_type}</td>
            <td>${row.dynamic_range}</td>
            <td class="metric-pill">${row.rmse_m} m</td>
            <td>${row.mae_m} m</td>
            <td>${row.pearson_r}</td>
          </tr>
        `).join('');
      }
      modal.classList.add('open');
    });
  }

  if (closeModalBtn && modal) {
    closeModalBtn.addEventListener('click', () => modal.classList.remove('open'));
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.classList.remove('open');
    });
  }

  // 🛰️ DYNAMIC FILE UPLOAD & INGESTION HUB
  const dropzone = document.getElementById('upload-dropzone');
  const fileInput = document.getElementById('file-input');

  if (dropzone && fileInput) {
    dropzone.addEventListener('click', () => fileInput.click());

    // Drag and drop handlers
    dropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropzone.style.borderColor = '#00F2FE';
      dropzone.style.background = 'rgba(0, 242, 254, 0.08)';
    });

    dropzone.addEventListener('dragleave', () => {
      dropzone.style.borderColor = 'rgba(255, 255, 255, 0.12)';
      dropzone.style.background = 'transparent';
    });

    dropzone.addEventListener('drop', async (e) => {
      e.preventDefault();
      dropzone.style.borderColor = 'rgba(255, 255, 255, 0.12)';
      dropzone.style.background = 'transparent';
      if (e.dataTransfer.files.length > 0) {
        await handleUploadedFile(e.dataTransfer.files[0]);
      }
    });

    fileInput.addEventListener('change', async (e) => {
      if (e.target.files.length > 0) {
        await handleUploadedFile(e.target.files[0]);
      }
    });
  }
}

async function handleUploadedFile(file) {
  const dropzone = document.getElementById('upload-dropzone');
  if (dropzone) {
    dropzone.innerHTML = `
      <div style="font-size: 20px;">⚙️ 🛰️</div>
      <div class="upload-text" style="color: #00FFA3; font-weight: 600;">Processing ${file.name}...</div>
      <div class="upload-sub">Extracting 3D urban architecture...</div>
    `;
  }

  try {
    let uploadedSceneData;
    try {
      uploadedSceneData = await uploadTile(file);
    } catch (apiErr) {
      console.warn("[DepthWizard] Backend upload error, using local fallback:", apiErr.message);
      uploadedSceneData = await createDynamicSceneFromImage(file);
    }

    if (getIsStreetMode()) {
      disableStreetMode();
      updateNavigationModeUI(false);
    }

    await loadScene(uploadedSceneData);

    camera.position.set(0, 58, 62);
    controls.target.set(0, 0, 0);
    controls.update();

    if (dropzone) {
      dropzone.innerHTML = `
        <div style="font-size: 24px;">🛰️ 📤</div>
        <div class="upload-text" style="font-weight: 600; color: #FFFFFF; margin-top: 6px;">
          Upload Another Tile
        </div>
        <div class="upload-sub" style="margin-top: 4px;">
          Loaded ${file.name} successfully!
        </div>
        <input type="file" id="file-input" style="display: none;" accept=".png,.jpg,.jpeg,.tif,.tiff,.h5">
      `;
      const newFileInput = document.getElementById('file-input');
      dropzone.onclick = () => newFileInput.click();
      newFileInput.onchange = (e) => {
        if (e.target.files.length > 0) handleUploadedFile(e.target.files[0]);
      };
    }
  } catch (err) {
    console.error("Error processing uploaded image:", err);
    alert(`Failed to load ${file.name}: ${err.message}`);
  }
}

function onWindowResize() {
  const canvas = document.getElementById('three-canvas');
  if (!canvas || !renderer || !camera) return;
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
}

function renderLoop(time) {
  requestAnimationFrame(renderLoop);

  const delta = Math.min((time - lastFrameTime) / 1000, 0.1);
  lastFrameTime = time;

  // FPS calculation
  frames++;
  if (time > lastTime + 1000) {
    if (fpsEl) {
      fpsEl.innerText = Math.round((frames * 1000) / (time - lastTime));
    }
    lastTime = time;
    frames = 0;
  }

  // Active Controller
  if (getIsStreetMode()) {
    updateStreetNavigator(delta);
    const speedEl = document.getElementById('street-speed');
    if (speedEl) {
      speedEl.innerText = getStreetTelemetry().speedKmH;
    }
  } else if (getIsFlying()) {
    updateFlightLoop(camera);
  } else {
    controls.update();
  }

  renderer.render(scene, camera);
}

window.addEventListener('DOMContentLoaded', init);
