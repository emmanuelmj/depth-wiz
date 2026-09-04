import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

import { initTerrain, updateTerrainScene, getTerrainMesh } from './3d/terrain.js';
import { toggleFlight, updateFlightLoop, getIsFlying } from './3d/cameraFlight.js';
import { pickTerrainPixel } from './3d/picking.js';
import { setupLayerControls } from './hud/layers.js';
import { showInspectorBadge } from './hud/inspector.js';
import { renderElevationProfile, closeTransectDrawer } from './chart/profileChart.js';
import { fetchSceneDetails, inspectPoint, fetchTransect, fetchBenchmarks } from './api.js';
import { DEFAULT_SCENE, createDynamicSceneFromImage } from './mockData.js';

let scene, camera, renderer, controls;
let activeSceneData = DEFAULT_SCENE;

let lastTime = performance.now();
let frames = 0;
const fpsEl = document.getElementById('hud-fps');

async function init() {
  const canvas = document.getElementById('three-canvas');
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;

  scene = new THREE.Scene();
  scene.background = new THREE.Color('#050811');

  camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
  camera.position.set(0, 70, 75);

  renderer = new THREE.WebGLRenderer({
    canvas: canvas,
    antialias: true,
    powerPreference: 'high-performance'
  });
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.maxPolarAngle = Math.PI / 2.05;
  controls.minDistance = 5;
  controls.maxDistance = 250;

  initTerrain(scene);
  setupLayerControls();
  setupUIEvents();

  // 6. Load Initial Default Scene (DC_03_26)
  await loadScene(DEFAULT_SCENE);

  canvas.addEventListener('click', handleViewportClick);
  window.addEventListener('resize', onWindowResize);

  requestAnimationFrame(renderLoop);
}

async function loadScene(sceneData) {
  activeSceneData = sceneData;
  updateTerrainScene(sceneData);

  const coordEl = document.getElementById('hud-coord');
  const elevEl = document.getElementById('hud-elev');
  const aglEl = document.getElementById('hud-agl');

  if (coordEl && sceneData.bounds) {
    const midLat = ((sceneData.bounds.min_lat + sceneData.bounds.max_lat) / 2).toFixed(4);
    const midLon = ((sceneData.bounds.min_lon + sceneData.bounds.max_lon) / 2).toFixed(4);
    coordEl.innerText = `${midLat}° N, ${midLon}° E`;
    coordEl.classList.add('val-cyan');
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
  if (subEl) subEl.innerText = `${sceneData.min_elevation_m}m – ${sceneData.max_elevation_m}m · AGL: ${sceneData.elevation_stats?.max_building_agl_m}m`;
  if (iconEl) {
    const isMountain = sceneData.landscape_type === 'mountain' || sceneData.name.toLowerCase().includes('mount');
    iconEl.innerText = isMountain ? '⛰️' : '🏙️';
  }

  const statsPanel = document.getElementById('scene-stats-panel');
  if (statsPanel && sceneData.elevation_stats) {
    statsPanel.innerHTML = `
      <div class="stat-row"><span class="stat-label">Ground Base</span><span class="stat-value">${sceneData.elevation_stats.ground_base_m} m</span></div>
      <div class="stat-row"><span class="stat-label">Max AGL (GT)</span><span class="stat-value">${sceneData.elevation_stats.max_building_agl_m} m</span></div>
      <div class="stat-row"><span class="stat-label">Max AGL (Pred)</span><span class="stat-value">${sceneData.elevation_stats.predicted_building_agl_m} m</span></div>
      <div class="stat-row"><span class="stat-label">Accuracy</span><span class="stat-value val-emerald">${sceneData.elevation_stats.accuracy_percentage}%</span></div>
      <div class="stat-row"><span class="stat-label">CRS</span><span class="stat-value">${sceneData.crs || 'EPSG:32643'}</span></div>
    `;
  }
}

async function handleViewportClick(e) {
  if (getIsFlying()) return;

  const canvas = document.getElementById('three-canvas');
  const hit = pickTerrainPixel(e, camera, getTerrainMesh(), canvas);
  if (hit) {
    const inspectResult = await inspectPoint(activeSceneData.id, hit.pixel.x, hit.pixel.y);
    showInspectorBadge(inspectResult);

    const coordEl = document.getElementById('hud-coord');
    const elevEl = document.getElementById('hud-elev');
    const aglEl = document.getElementById('hud-agl');

    if (coordEl) coordEl.innerText = `${inspectResult.coordinates.latitude}° N, ${inspectResult.coordinates.longitude}° E`;
    if (elevEl) elevEl.innerText = `${inspectResult.metrics.absolute_elevation_m} m`;
    if (aglEl) aglEl.innerText = `${inspectResult.metrics.height_above_ground_m} m`;
  }
}

function setupUIEvents() {
  const flightBtn = document.getElementById('btn-drone-flight');
  if (flightBtn) {
    flightBtn.addEventListener('click', () => {
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

  const resetBtn = document.getElementById('btn-reset-cam');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      camera.position.set(0, 70, 75);
      controls.target.set(0, 0, 0);
      controls.update();
    });
  }

  const transectBtn = document.getElementById('btn-sample-transect');
  if (transectBtn) {
    transectBtn.addEventListener('click', async () => {
<<<<<<< HEAD
      const transectData = await fetchTransect(currentSceneId, { x: 120, y: 200 }, { x: 900, y: 820 }, 120);
      const sceneData = await fetchSceneDetails(currentSceneId);
      transectData.scene_name = sceneData.name;
      transectData.ground_base_m = sceneData.elevation_stats?.ground_base_m || 0;
=======
      const transectData = await fetchTransect(
        activeSceneData.id,
        { x: 120, y: 200 },
        { x: 900, y: 820 },
        120
      );
>>>>>>> 887c46602189abed9a1b590d538c29966a3d5cc9
      renderElevationProfile(transectData);
    });
  }

  const closeDrawerBtn = document.getElementById('btn-close-drawer');
  if (closeDrawerBtn) closeDrawerBtn.addEventListener('click', closeTransectDrawer);

<<<<<<< HEAD
=======
  // Reset to Default Scene
  const resetDefaultBtn = document.getElementById('btn-reset-default-scene');
  if (resetDefaultBtn) {
    resetDefaultBtn.addEventListener('click', () => {
      loadScene(DEFAULT_SCENE);
    });
  }

  // Benchmarks Modal
>>>>>>> 887c46602189abed9a1b590d538c29966a3d5cc9
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
      <div class="upload-sub">Generating 3D elevation displacement...</div>
    `;
  }

  try {
    const dynamicScene = await createDynamicSceneFromImage(file);
    await loadScene(dynamicScene);

    // Reset camera target
    camera.position.set(0, 70, 75);
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

  frames++;
  if (time > lastTime + 1000) {
    if (fpsEl) fpsEl.innerText = Math.round((frames * 1000) / (time - lastTime));
    lastTime = time;
    frames = 0;
  }

  if (getIsFlying()) {
    updateFlightLoop(camera);
  } else {
    controls.update();
  }

  renderer.render(scene, camera);
}

window.addEventListener('DOMContentLoaded', init);
