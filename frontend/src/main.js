import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

import { initTerrain, updateTerrainScene, getTerrainMesh } from './3d/terrain.js';
import { toggleFlight, updateFlightLoop, getIsFlying } from './3d/cameraFlight.js';
import { pickTerrainPixel } from './3d/picking.js';
import { setupLayerControls } from './hud/layers.js';
import { showInspectorBadge } from './hud/inspector.js';
import { renderElevationProfile, closeTransectDrawer } from './chart/profileChart.js';
import { inspectPoint, fetchTransect, fetchBenchmarks } from './api.js';
import { DEFAULT_SCENE, createDynamicSceneFromImage } from './mockData.js';

let scene, camera, renderer, controls;
let activeSceneData = DEFAULT_SCENE;

let lastTime = performance.now();
let frames = 0;
const fpsEl = document.getElementById('hud-fps');

// ─── INIT ─────────────────────────────────────────────────────────────────────
async function init() {
  const canvas = document.getElementById('three-canvas');
  const width  = canvas.clientWidth;
  const height = canvas.clientHeight;

  scene = new THREE.Scene();
  scene.background = new THREE.Color('#050811');

  camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
  camera.position.set(0, 70, 75);

  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  controls = new OrbitControls(camera, canvas);
  controls.enableDamping  = true;
  controls.dampingFactor  = 0.05;
  controls.maxPolarAngle  = Math.PI / 2.05;
  controls.minDistance    = 5;
  controls.maxDistance    = 250;

  initTerrain(scene);
  setupLayerControls();
  setupUIEvents();

  // Load anchor scene on boot
  await loadScene(DEFAULT_SCENE);

  canvas.addEventListener('click', handleViewportClick);
  window.addEventListener('resize', onWindowResize);
  requestAnimationFrame(renderLoop);
}

// ─── LOAD SCENE ───────────────────────────────────────────────────────────────
async function loadScene(sceneData) {
  activeSceneData = sceneData;

  const loader = document.getElementById('scene-loader');
  if (loader) loader.classList.add('visible');

  await updateTerrainScene(sceneData);

  if (loader) loader.classList.remove('visible');

  // ── HUD telemetry ──────────────────────────────────────────────────────────
  const coordEl = document.getElementById('hud-coord');
  const elevEl  = document.getElementById('hud-elev');
  const aglEl   = document.getElementById('hud-agl');

  if (coordEl && sceneData.bounds) {
    const midLat = ((sceneData.bounds.min_lat + sceneData.bounds.max_lat) / 2).toFixed(4);
    const midLon = ((sceneData.bounds.min_lon + sceneData.bounds.max_lon) / 2).toFixed(4);
    coordEl.innerText = `${midLat}° N, ${midLon}° E`;
    coordEl.className = 'telemetry-value val-cyan';
  }
  if (elevEl && sceneData.elevation_stats) {
    elevEl.innerText = `${sceneData.elevation_stats.max_m} m`;
  }
  if (aglEl && sceneData.elevation_stats) {
    aglEl.innerText = `${sceneData.elevation_stats.max_building_agl_m} m`;
  }

  // ── Active scene card ──────────────────────────────────────────────────────
  const nameEl = document.getElementById('active-scene-name');
  const subEl  = document.getElementById('active-scene-sub');
  const iconEl = document.getElementById('active-scene-icon');
  const icons  = { urban: '🏙️', mountain: '⛰️', sparse: '🌾', forest: '🌲', custom: '🛰️' };

  if (nameEl) nameEl.innerText = sceneData.name;
  if (subEl)  subEl.innerText  =
    `${sceneData.min_elevation_m}m – ${sceneData.max_elevation_m}m · AGL: ${sceneData.elevation_stats?.max_building_agl_m ?? '—'}m`;
  if (iconEl) iconEl.innerText = icons[sceneData.landscape_type] || '🛰️';

  // ── Scene telemetry stats panel ────────────────────────────────────────────
  const statsPanel = document.getElementById('scene-stats-panel');
  if (statsPanel && sceneData.elevation_stats) {
    const e = sceneData.elevation_stats;
    statsPanel.innerHTML = `
      <div class="stat-row"><span class="stat-label">Ground Base</span><span class="stat-value">${e.ground_base_m} m</span></div>
      <div class="stat-row"><span class="stat-label">Max AGL (GT)</span><span class="stat-value">${e.max_building_agl_m} m</span></div>
      <div class="stat-row"><span class="stat-label">Max AGL (Pred)</span><span class="stat-value">${e.predicted_building_agl_m} m</span></div>
      <div class="stat-row"><span class="stat-label">Accuracy</span><span class="stat-value val-emerald">${e.accuracy_percentage}%</span></div>
      <div class="stat-row"><span class="stat-label">RMSE</span><span class="stat-value val-cyan">1.56 m</span></div>
      <div class="stat-row"><span class="stat-label">CRS</span><span class="stat-value">${sceneData.crs || 'EPSG:32643'}</span></div>
    `;
  }
}

// ─── VIEWPORT CLICK → POINT INSPECTION ───────────────────────────────────────
async function handleViewportClick(e) {
  if (getIsFlying()) return;
  const canvas = document.getElementById('three-canvas');
  const hit = pickTerrainPixel(e, camera, getTerrainMesh(), canvas);
  if (!hit) return;

  const inspectResult = await inspectPoint(activeSceneData.id, hit.pixel.x, hit.pixel.y);
  showInspectorBadge(inspectResult);

  const coordEl = document.getElementById('hud-coord');
  const elevEl  = document.getElementById('hud-elev');
  const aglEl   = document.getElementById('hud-agl');
  if (coordEl) coordEl.innerText = `${inspectResult.coordinates.latitude}° N, ${inspectResult.coordinates.longitude}° E`;
  if (elevEl)  elevEl.innerText  = `${inspectResult.metrics.absolute_elevation_m} m`;
  if (aglEl)   aglEl.innerText   = `${inspectResult.metrics.height_above_ground_m} m`;
}

// ─── UI EVENTS ────────────────────────────────────────────────────────────────
function setupUIEvents() {
  // Drone flight toggle
  const flightBtn = document.getElementById('btn-drone-flight');
  if (flightBtn) {
    flightBtn.addEventListener('click', () => {
      toggleFlight(camera, controls, (isFlying) => {
        flightBtn.innerHTML   = isFlying ? '<span>⏸</span> STOP FLIGHT' : '<span>▶</span> CINEMATIC FLIGHT';
        flightBtn.style.background = isFlying
          ? 'linear-gradient(135deg, #F43F5E, #E11D48)'
          : 'linear-gradient(135deg, #00F2FE, #00A3FE)';
      });
    });
  }

  // Camera reset
  const resetCamBtn = document.getElementById('btn-reset-cam');
  if (resetCamBtn) {
    resetCamBtn.addEventListener('click', () => {
      camera.position.set(0, 70, 75);
      controls.target.set(0, 0, 0);
      controls.update();
    });
  }

  // Reset to anchor (DC_03_26)
  const resetDefaultBtn = document.getElementById('btn-reset-default-scene');
  if (resetDefaultBtn) {
    resetDefaultBtn.addEventListener('click', () => {
      resetDropzoneUI();
      loadScene(DEFAULT_SCENE);
    });
  }

  // 2D cross-section transect
  const transectBtn = document.getElementById('btn-sample-transect');
  if (transectBtn) {
    transectBtn.addEventListener('click', async () => {
      const transectData = await fetchTransect(
        activeSceneData.id,
        { x: 120, y: 200 },
        { x: 900, y: 820 },
        120
      );
      transectData.scene_name   = activeSceneData.name;
      transectData.ground_base_m = activeSceneData.elevation_stats?.ground_base_m ?? 0;
      renderElevationProfile(transectData);
    });
  }

  // Transect drawer close
  const closeDrawerBtn = document.getElementById('btn-close-drawer');
  if (closeDrawerBtn) closeDrawerBtn.addEventListener('click', closeTransectDrawer);

  // Benchmarks modal
  const openModalBtn  = document.getElementById('btn-open-benchmarks');
  const closeModalBtn = document.getElementById('btn-close-modal');
  const modal         = document.getElementById('benchmarkModal');

  if (openModalBtn && modal) {
    openModalBtn.addEventListener('click', async () => {
      const data  = await fetchBenchmarks();
      const tbody = document.getElementById('benchmark-tbody');
      if (tbody && data.stratified_results) {
        tbody.innerHTML = data.stratified_results.map(row => `
          <tr>
            <td style="color:#FFFFFF;font-weight:600;">${row.landscape_type}</td>
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
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.classList.remove('open'); });
  }

  // ── Upload / Drag & Drop ───────────────────────────────────────────────────
  setupUploadZone();
}

// ─── UPLOAD DROPZONE ─────────────────────────────────────────────────────────
function setupUploadZone() {
  const dropzone  = document.getElementById('upload-dropzone');
  const fileInput = document.getElementById('file-input');
  if (!dropzone || !fileInput) return;

  dropzone.addEventListener('click', (e) => {
    if (e.target !== fileInput) fileInput.click();
  });

  dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('drag-over');
  });

  dropzone.addEventListener('dragleave', (e) => {
    if (!dropzone.contains(e.relatedTarget)) dropzone.classList.remove('drag-over');
  });

  dropzone.addEventListener('drop', async (e) => {
    e.preventDefault();
    dropzone.classList.remove('drag-over');
    if (e.dataTransfer.files.length > 0) {
      await handleUploadedFiles(Array.from(e.dataTransfer.files));
    }
  });

  fileInput.addEventListener('change', async (e) => {
    if (e.target.files.length > 0) {
      await handleUploadedFiles(Array.from(e.target.files));
    }
  });
}

async function handleUploadedFiles(files) {
  // Filter for images
  const validFiles = files.filter(f => f.type.startsWith('image/') || /\.(png|jpe?g|tiff?)$/i.test(f.name));
  
  if (validFiles.length === 0) {
    setDropzoneStatus('error', '❌ Unsupported format — use PNG, JPG, or TIF', files[0]?.name || '');
    return;
  }
  if (validFiles.length > 2) {
    setDropzoneStatus('error', '❌ Please drop only 1 or 2 images (Optical + Depth)', '');
    return;
  }

  const name = validFiles.map(f => f.name).join(' + ');
  setDropzoneStatus('loading', `⚙️  Processing ${validFiles.length > 1 ? 'files' : 'file'}…`, name);

  try {
    const dynamicScene = await createDynamicSceneFromImage(validFiles);
    await loadScene(dynamicScene);

    camera.position.set(0, 70, 75);
    controls.target.set(0, 0, 0);
    controls.update();

    setDropzoneStatus('success', `✓ Loaded`, name);
  } catch (err) {
    console.error('[Upload] Error:', err);
    setDropzoneStatus('error', `❌ Failed: ${err.message}`, name);
  }
}

function setDropzoneStatus(type, msg, filename) {
  const statusEl = document.getElementById('upload-status-msg');
  const filenameEl = document.getElementById('upload-filename');
  const dotEl = document.getElementById('upload-status-dot');
  if (!statusEl) return;

  const colorMap = { loading: '#F59E0B', success: '#00FFA3', error: '#F43F5E' };
  statusEl.innerText = msg;
  statusEl.style.color = colorMap[type] || '#94A3B8';
  if (dotEl) { dotEl.style.background = colorMap[type]; dotEl.style.display = 'inline-block'; }
  if (filenameEl) filenameEl.innerText = filename;
}

function resetDropzoneUI() {
  setDropzoneStatus('idle', 'Ready for upload', '');
  const dotEl = document.getElementById('upload-status-dot');
  if (dotEl) dotEl.style.display = 'none';
}

// ─── RESIZE ──────────────────────────────────────────────────────────────────
function onWindowResize() {
  const canvas = document.getElementById('three-canvas');
  if (!canvas || !renderer || !camera) return;
  camera.aspect = canvas.clientWidth / canvas.clientHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(canvas.clientWidth, canvas.clientHeight);
}

// ─── RENDER LOOP ─────────────────────────────────────────────────────────────
function renderLoop(time) {
  requestAnimationFrame(renderLoop);

  frames++;
  if (time > lastTime + 1000) {
    if (fpsEl) fpsEl.innerText = Math.round((frames * 1000) / (time - lastTime));
    lastTime = time;
    frames   = 0;
  }

  getIsFlying() ? updateFlightLoop(camera) : controls.update();
  renderer.render(scene, camera);
}

window.addEventListener('DOMContentLoaded', init);
