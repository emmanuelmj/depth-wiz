import * as THREE from 'three';
import { setRoadMask } from './streetNavigator.js';

let sceneRef = null;
let groundMesh = null;
let buildingsMesh = null;
let textureLoader = null;

let currentMode = 'optical';
let currentOpticalUrl = null;
let currentHeightUrl = null;
let currentOpticalTexture = null;
let heatmapTexture = null;

const PLANE_SIZE = 100;
const GRID_RES = 64; // 64x64 grid extraction

export function initTerrain(scene) {
  sceneRef = scene;
  textureLoader = new THREE.TextureLoader();

  // 1. Flat Ground Plane (Displays Roads, Intersections, and City Floor with 0 Distortion)
  const groundGeometry = new THREE.PlaneGeometry(PLANE_SIZE, PLANE_SIZE, 1, 1);
  const groundMaterial = new THREE.MeshStandardMaterial({
    roughness: 0.9,
    metalness: 0.05,
    wireframe: false
  });

  groundMesh = new THREE.Mesh(groundGeometry, groundMaterial);
  groundMesh.rotation.x = -Math.PI / 2;
  groundMesh.position.y = 0;
  groundMesh.receiveShadow = true;
  scene.add(groundMesh);

  // 2. Cinematic Lighting for 3D City Shadows
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.75);
  scene.add(ambientLight);

  const sun = new THREE.DirectionalLight(0xffffff, 1.4);
  sun.position.set(45, 90, 35);
  sun.castShadow = true;
  scene.add(sun);

  const fillLight = new THREE.DirectionalLight(0x00F2FE, 0.35); // Subtle cyan atmospheric rim light
  fillLight.position.set(-45, 40, -35);
  scene.add(fillLight);

  return groundMesh;
}

export function updateTerrainScene(sceneData) {
  if (!groundMesh || !sceneData.assets) return;

  currentOpticalUrl = sceneData.assets.optical_texture_url;
  currentHeightUrl = sceneData.assets.height_map_url;

  // 1. Draped Ground Optical Texture
  currentOpticalTexture = textureLoader.load(currentOpticalUrl);
  currentOpticalTexture.colorSpace = THREE.SRGBColorSpace;
  currentOpticalTexture.wrapS = THREE.ClampToEdgeWrapping;
  currentOpticalTexture.wrapT = THREE.ClampToEdgeWrapping;

  groundMesh.material.map = currentOpticalTexture;
  groundMesh.material.needsUpdate = true;

  // 2. Extract and Generate Volumetric 3D Buildings from Heightmap
  extractAndBuildCity(sceneData);
}

function extractAndBuildCity(sceneData) {
  const img = new Image();
  img.crossOrigin = 'Anonymous';
  img.src = currentHeightUrl;

  img.onload = () => {
    // Offscreen canvas to sample elevation grid
    const canvas = document.createElement('canvas');
    canvas.width = GRID_RES;
    canvas.height = GRID_RES;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, GRID_RES, GRID_RES);

    const imgData = ctx.getImageData(0, 0, GRID_RES, GRID_RES).data;
    const roadMask = new Uint8Array(GRID_RES * GRID_RES);

    // Elevation parameters
    const minElev = sceneData.elevation_stats?.min_m ?? 45.0;
    const maxElev = sceneData.elevation_stats?.max_m ?? 87.6;
    const elevRange = Math.max(10.0, maxElev - minElev);

    // Building detection threshold: AGL > 3.5m (approx 0.12 of range)
    const buildingThreshold = 0.14;
    const cellSize = PLANE_SIZE / GRID_RES;
    const halfPlane = PLANE_SIZE / 2;

    const buildingInstances = [];

    for (let gy = 0; gy < GRID_RES; gy++) {
      for (let gx = 0; gx < GRID_RES; gx++) {
        const idx = (gy * GRID_RES + gx) * 4;
        const val = imgData[idx] / 255.0; // Normalized luminance

        const gridIndex = gy * GRID_RES + gx;

        if (val > buildingThreshold) {
          // Building Cell
          roadMask[gridIndex] = 0;

          const relHeight = (val - buildingThreshold) / (1.0 - buildingThreshold);
          const aglMeters = relHeight * (elevRange * 0.85);

          // Real 1:1 scale for 1200m tile mapped on 100-unit plane
          // 40m building = (40 / 1200) * 100 = 3.33 units
          const heightUnits = THREE.MathUtils.clamp((aglMeters / 1200.0) * 100.0 * 1.35, 0.9, 6.2);

          const wx = (gx / GRID_RES) * PLANE_SIZE - halfPlane + cellSize / 2;
          const wz = (gy / GRID_RES) * PLANE_SIZE - halfPlane + cellSize / 2;

          buildingInstances.push({
            x: wx,
            z: wz,
            h: heightUnits,
            w: cellSize * 0.88,
            d: cellSize * 0.88,
            relHeight: relHeight
          });
        } else {
          // Road / Street Cell
          roadMask[gridIndex] = 1;
        }
      }
    }

    // Pass walkable road mask to the first-person street navigator
    setRoadMask(roadMask, GRID_RES, PLANE_SIZE);

    // 3. Create or Update THREE.InstancedMesh for 3D Buildings
    rebuildBuildingMesh(buildingInstances);
  };
}

function rebuildBuildingMesh(instances) {
  if (buildingsMesh && sceneRef) {
    sceneRef.remove(buildingsMesh);
    buildingsMesh.geometry.dispose();
    buildingsMesh.material.dispose();
    buildingsMesh = null;
  }

  const count = instances.length;
  if (count === 0 || !sceneRef) return;

  // Box geometry unit cube centered at origin
  const boxGeometry = new THREE.BoxGeometry(1, 1, 1);

  // Modern architectural facade shader material
  const buildingMaterial = new THREE.MeshStandardMaterial({
    roughness: 0.45,
    metalness: 0.35,
    wireframe: currentMode === 'wireframe'
  });

  buildingsMesh = new THREE.InstancedMesh(boxGeometry, buildingMaterial, count);
  buildingsMesh.castShadow = true;
  buildingsMesh.receiveShadow = true;

  const dummy = new THREE.Object3D();
  const color = new THREE.Color();

  // Color palette: modern glass facades, slate high-rises, and granite blocks
  const palette = [
    new THREE.Color('#2A384C'),
    new THREE.Color('#384860'),
    new THREE.Color('#1F2A38'),
    new THREE.Color('#435670'),
    new THREE.Color('#303F54')
  ];

  for (let i = 0; i < count; i++) {
    const b = instances[i];

    // Position box so bottom sits flush on ground Y=0, top is at Y=b.h
    dummy.position.set(b.x, b.h / 2, b.z);
    dummy.scale.set(b.w, b.h, b.d);
    dummy.updateMatrix();

    buildingsMesh.setMatrixAt(i, dummy.matrix);

    if (currentMode === 'heatmap') {
      // Turbo color ramp based on height
      const t = THREE.MathUtils.clamp(b.relHeight, 0, 1);
      color.setHSL((1.0 - t) * 0.7, 0.9, 0.5);
    } else {
      // Subtle architectural facade tone variation
      const baseCol = palette[i % palette.length];
      const brightnessBoost = 1.0 + b.relHeight * 0.25;
      color.copy(baseCol).multiplyScalar(brightnessBoost);
    }

    buildingsMesh.setColorAt(i, color);
  }

  buildingsMesh.instanceMatrix.needsUpdate = true;
  if (buildingsMesh.instanceColor) {
    buildingsMesh.instanceColor.needsUpdate = true;
  }

  sceneRef.add(buildingsMesh);
}

export function setTerrainLayer(mode) {
  currentMode = mode;

  if (groundMesh) {
    const gMat = groundMesh.material;
    if (mode === 'optical') {
      gMat.map = currentOpticalTexture;
      gMat.wireframe = false;
    } else if (mode === 'wireframe') {
      gMat.wireframe = true;
    } else if (mode === 'heatmap') {
      gMat.map = getHeatmapTexture();
      gMat.wireframe = false;
    }
    gMat.needsUpdate = true;
  }

  if (buildingsMesh) {
    const bMat = buildingsMesh.material;
    if (mode === 'wireframe') {
      bMat.wireframe = true;
    } else {
      bMat.wireframe = false;
    }
    bMat.needsUpdate = true;
  }
}

export function getTerrainMesh() {
  return groundMesh;
}

export function getBuildingsMesh() {
  return buildingsMesh;
}

export function getRaycastTargets() {
  return [groundMesh, buildingsMesh].filter(Boolean);
}

function getHeatmapTexture() {
  if (heatmapTexture) return heatmapTexture;

  const canvas = document.createElement('canvas');
  canvas.width = 16;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');

  const gradient = ctx.createLinearGradient(0, 256, 0, 0);
  gradient.addColorStop(0.0, '#30123B');
  gradient.addColorStop(0.2, '#4662D8');
  gradient.addColorStop(0.4, '#36BB9B');
  gradient.addColorStop(0.6, '#A2DA37');
  gradient.addColorStop(0.8, '#F8BA2B');
  gradient.addColorStop(1.0, '#7A0403');

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 16, 256);

  heatmapTexture = new THREE.CanvasTexture(canvas);
  heatmapTexture.colorSpace = THREE.SRGBColorSpace;
  return heatmapTexture;
}
