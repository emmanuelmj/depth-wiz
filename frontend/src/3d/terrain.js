import * as THREE from 'three';

let terrainGroup = null;
let buildingMesh = null;
let groundMesh = null;
let currentMode = 'optical';
let currentOpticalTex = null;

let baseScale = 25;

export function initTerrain(scene) {
  terrainGroup = new THREE.Group();
  scene.add(terrainGroup);

  // Soft ambient lighting, crisp sun
  scene.add(new THREE.AmbientLight(0xffffff, 0.8));
  const sun = new THREE.DirectionalLight(0xfffdf0, 1.2);
  sun.position.set(60, 100, 40);
  scene.add(sun);
  
  return terrainGroup;
}

export async function updateTerrainScene(sceneData) {
  if (!terrainGroup || !sceneData.assets) return;

  // Clear previous city
  while (terrainGroup.children.length > 0) {
    const child = terrainGroup.children[0];
    terrainGroup.remove(child);
    if (child.geometry) child.geometry.dispose();
    if (child.material) child.material.dispose();
  }

  const { optImg, hgtImg } = await loadImages(
    sceneData.assets.optical_texture_url,
    sceneData.assets.height_map_url
  );

  if (!optImg || !hgtImg) return;

  currentOpticalTex = new THREE.CanvasTexture(optImg);
  currentOpticalTex.colorSpace = THREE.SRGBColorSpace;
  // High quality texture mapping
  currentOpticalTex.anisotropy = 16; 

  const range = (sceneData.elevation_stats?.max_m || 100) - (sceneData.elevation_stats?.min_m || 0);
  baseScale = THREE.MathUtils.clamp(600 / Math.max(10, range), 10, 40);

  buildExtrudedCity(optImg, hgtImg);
  setTerrainLayer(currentMode);
}

// ─── EXACT 2.5D EXTRUSION ENGINE ──────────────────────────────────────────────
// This guarantees perfect 1:1 photographic top-down view, with crisp vertical walls.
function buildExtrudedCity(optImg, hgtImg) {
  const gridSize = 256; 
  const cellSize = 100 / gridSize;

  const hgtCanvas = document.createElement('canvas');
  hgtCanvas.width = hgtCanvas.height = gridSize;
  const hgtCtx = hgtCanvas.getContext('2d', { willReadFrequently: true });
  hgtCtx.drawImage(hgtImg, 0, 0, gridSize, gridSize);
  const hgtData = hgtCtx.getImageData(0, 0, gridSize, gridSize).data;

  // 1. PERFECTLY FLAT GROUND PLANE (Fixes elevated roads)
  const groundGeo = new THREE.PlaneGeometry(100, 100);
  const groundMat = new THREE.MeshStandardMaterial({ 
    map: currentOpticalTex, roughness: 0.9, metalness: 0.1 
  });
  groundMesh = new THREE.Mesh(groundGeo, groundMat);
  groundMesh.rotation.x = -Math.PI / 2;
  // Push ground down a tiny bit to prevent z-fighting with flat cells
  groundMesh.position.y = -0.05;
  terrainGroup.add(groundMesh);

  // 2. CUSTOM BUFFER GEOMETRY FOR CRISP BUILDINGS
  const positions = [];
  const uvs = [];
  const indices = [];
  let vOff = 0;

  function pushQuad(p0, p1, p2, p3, uv0, uv1, uv2, uv3) {
    positions.push(...p0, ...p1, ...p2, ...p3);
    uvs.push(...uv0, ...uv1, ...uv2, ...uv3);
    indices.push(
      vOff, vOff+2, vOff+1,
      vOff+1, vOff+2, vOff+3
    );
    vOff += 4;
  }

  // Threshold: anything darker than 12% grey is considered completely flat (roads)
  const HEIGHT_THRESHOLD = 0.12; 

  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < gridSize; x++) {
      const hNorm = hgtData[(y * gridSize + x) * 4] / 255.0;
      
      // Flatten roads
      if (hNorm < HEIGHT_THRESHOLD) continue; 
      
      const h = hNorm * baseScale; 
      
      const wx = -50 + x * cellSize; 
      const wz = -50 + y * cellSize; 
      const w = cellSize;
      const d = cellSize;

      const t0 = [wx, h, wz];
      const t1 = [wx + w, h, wz];
      const t2 = [wx, h, wz + d];
      const t3 = [wx + w, h, wz + d];

      const b0 = [wx, 0, wz];
      const b1 = [wx + w, 0, wz];
      const b2 = [wx, 0, wz + d];
      const b3 = [wx + w, 0, wz + d];

      // Exact UVs for the top face to perfectly match the photographic image
      const u0 = x / gridSize;
      const v0 = 1.0 - (y / gridSize);
      const u1 = (x + 1) / gridSize;
      const v1 = 1.0 - (y + 1) / gridSize;

      const uvT0 = [u0, v0];
      const uvT1 = [u1, v0];
      const uvT2 = [u0, v1];
      const uvT3 = [u1, v1];

      // Walls are solidly colored based on the roof's center pixel
      const uc = (u0 + u1) / 2;
      const vc = (v0 + v1) / 2;
      const uvC = [uc, vc];

      // Top roof
      pushQuad(t0, t1, t2, t3, uvT0, uvT1, uvT2, uvT3);

      // Vertical walls
      pushQuad(b2, b3, t2, t3, uvC, uvC, uvC, uvC); // Front
      pushQuad(b1, b0, t1, t0, uvC, uvC, uvC, uvC); // Back
      pushQuad(b0, b2, t0, t2, uvC, uvC, uvC, uvC); // Left
      pushQuad(b3, b1, t3, t1, uvC, uvC, uvC, uvC); // Right
    }
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geom.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geom.setIndex(indices);
  geom.computeVertexNormals();

  // DoubleSide ensures walls are visible regardless of quad winding order
  const bMat = new THREE.MeshStandardMaterial({ 
    map: currentOpticalTex, 
    roughness: 0.9, 
    metalness: 0.0,
    side: THREE.DoubleSide
  });

  buildingMesh = new THREE.Mesh(geom, bMat);
  terrainGroup.add(buildingMesh);
}

export function setTerrainLayer(mode) {
  if (!terrainGroup) return;
  currentMode = mode;

  const isWire = mode === 'wireframe';
  if (groundMesh) groundMesh.material.wireframe = isWire;
  if (buildingMesh) buildingMesh.material.wireframe = isWire;

  if (mode === 'heatmap') {
    // Heatmap mode fallback
    if (groundMesh) groundMesh.material.color.setHex(0x222222);
    if (buildingMesh) buildingMesh.material.color.setHex(0xff5500);
  } else {
    if (groundMesh) groundMesh.material.color.setHex(0xffffff);
    if (buildingMesh) buildingMesh.material.color.setHex(0xffffff);
  }
}

export function getTerrainMesh() { return terrainGroup; }

// ─── IMAGE LOADING ────────────────────────────────────────────────────────────
async function loadImages(optUrl, hgtUrl) {
  const [optImg, hgtImg] = await Promise.all([
    loadImage(optUrl),
    loadImage(hgtUrl)
  ]);
  return { optImg, hgtImg };
}

function loadImage(url) {
  return new Promise(resolve => {
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}
