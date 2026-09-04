import * as THREE from 'three';
import { setRoadMask } from './streetNavigator.js';

let terrainGroup = null;
let currentMode = 'optical';
let currentOpticalTex = null;
let baseScale = 25;
let currentMultiplier = 1.0;
let currentMesh = null;
let sceneRef = null;
let heatmapTexture = null;

const PLANE_SIZE = 100;
const GRID_RES = 256;

export function initTerrain(scene) {
  sceneRef = scene;
  terrainGroup = new THREE.Group();
  scene.add(terrainGroup);

  // Soft ambient + crisp directional sun for architectural shadows
  scene.add(new THREE.AmbientLight(0xffffff, 0.8));

  const sun = new THREE.DirectionalLight(0xfffdf0, 1.5);
  sun.position.set(60, 120, 40);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  scene.add(sun);

  const fill = new THREE.DirectionalLight(0xc8d8ff, 0.3);
  fill.position.set(-30, 20, -30);
  scene.add(fill);

  return terrainGroup;
}


export function setDisplacementMultiplier(multiplier) {
  currentMultiplier = Math.max(0.05, multiplier);
  // Scale the terrain mesh Y to apply height exaggeration live
  if (currentMesh) {
    currentMesh.scale.y = currentMultiplier;
  }
}

export async function updateTerrainScene(sceneData) {
  if (!terrainGroup || !sceneData.assets) return Promise.resolve();

  // Clear previous city mesh
  while (terrainGroup.children.length > 0) {
    const child = terrainGroup.children[0];
    terrainGroup.remove(child);
    if (child.geometry) child.geometry.dispose();
    if (child.material) {
      if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
      else child.material.dispose();
    }
  }
  currentMesh = null;

  const { optImg, hgtImg } = await loadImages(
    sceneData.assets.optical_texture_url,
    sceneData.assets.height_map_url
  );

  if (!optImg || !hgtImg) return;

  currentOpticalTex = new THREE.CanvasTexture(optImg);
  currentOpticalTex.colorSpace = THREE.SRGBColorSpace;
  currentOpticalTex.anisotropy = 16;

  const minElev = sceneData.elevation_stats?.min_m ?? 45.0;
  const maxElev = sceneData.elevation_stats?.max_m ?? 87.6;
  const range = Math.max(10, maxElev - minElev);

  // Realistic 1:1 geospatial vertical scale for a ~1.2km tile on 100 units
  baseScale = THREE.MathUtils.clamp((range / 1200.0) * 100.0 * 2.2, 4, 38);

  buildArchitecturalCity(optImg, hgtImg);
}

// ─── SMOOTH DISPLACEMENT WITH SLOPE-BASED MATERIALS ──────────────────────────
function buildArchitecturalCity(optImg, hgtImg) {
  const gridSize = GRID_RES;

  const hgtCanvas = document.createElement('canvas');
  hgtCanvas.width = hgtCanvas.height = gridSize;
  const hgtCtx = hgtCanvas.getContext('2d', { willReadFrequently: true });
  hgtCtx.drawImage(hgtImg, 0, 0, gridSize, gridSize);
  const hgtData = hgtCtx.getImageData(0, 0, gridSize, gridSize).data;

  // Build road mask for street navigator (256x256 → sample at 64x64)
  const maskRes = 64;
  const roadMask = new Uint8Array(maskRes * maskRes);
  const buildingThreshold = 0.14;

  for (let gy = 0; gy < maskRes; gy++) {
    for (let gx = 0; gx < maskRes; gx++) {
      // Sample the 256-grid at corresponding position
      const sx = Math.floor((gx / maskRes) * gridSize);
      const sy = Math.floor((gy / maskRes) * gridSize);
      const val = hgtData[(sy * gridSize + sx) * 4] / 255.0;
      roadMask[gy * maskRes + gx] = val <= buildingThreshold ? 1 : 0;
    }
  }
  setRoadMask(roadMask, maskRes, PLANE_SIZE);

  // 1. Create dense continuous plane (segments = gridSize - 1)
  const segments = gridSize - 1;
  const geom = new THREE.PlaneGeometry(PLANE_SIZE, PLANE_SIZE, segments, segments);
  geom.rotateX(-Math.PI / 2); // Orient so Y is up

  const pos = geom.attributes.position;
  const effectiveScale = baseScale * currentMultiplier;

  // 2. Displace vertices smoothly based on heightmap luminance
  for (let i = 0; i < pos.count; i++) {
    const px = i % gridSize;
    const py = Math.floor(i / gridSize);

    let hNorm = hgtData[(py * gridSize + px) * 4] / 255.0;
    if (hNorm < buildingThreshold) hNorm = 0; // Flatten roads/ground noise

    pos.setY(i, hNorm * effectiveScale);
  }

  geom.computeVertexNormals();

  // 3. Classify triangles by slope into roof vs wall groups
  const indices = geom.getIndex().array;
  geom.clearGroups();

  const roofIndices = [];
  const wallIndices = [];

  const vA = new THREE.Vector3();
  const vB = new THREE.Vector3();
  const vC = new THREE.Vector3();
  const cb = new THREE.Vector3();
  const ab = new THREE.Vector3();

  for (let i = 0; i < indices.length; i += 3) {
    const a = indices[i];
    const b = indices[i + 1];
    const c = indices[i + 2];

    vA.fromBufferAttribute(pos, a);
    vB.fromBufferAttribute(pos, b);
    vC.fromBufferAttribute(pos, c);

    cb.subVectors(vC, vB);
    ab.subVectors(vA, vB);
    cb.cross(ab);
    cb.normalize();

    // cb.y > 0.6 → mostly flat (roof / road)
    // cb.y ≤ 0.6 → steep face (building wall)
    if (cb.y > 0.6) {
      roofIndices.push(a, b, c);
    } else {
      wallIndices.push(a, b, c);
    }
  }

  // Reconstruct index buffer grouped for multi-material
  const newIndices = new Uint32Array(roofIndices.length + wallIndices.length);
  newIndices.set(roofIndices, 0);
  newIndices.set(wallIndices, roofIndices.length);
  geom.setIndex(new THREE.BufferAttribute(newIndices, 1));

  geom.addGroup(0, roofIndices.length, 0);                   // Material 0: Rooftops/roads — optical texture
  geom.addGroup(roofIndices.length, wallIndices.length, 1);  // Material 1: Building walls — grey

  // 4. Two-material mesh: optical draped on flat, grey with flatShading on steep walls
  const materials = [
    new THREE.MeshStandardMaterial({
      map: currentOpticalTex,
      roughness: 0.85,
      metalness: 0.02,
    }),
    new THREE.MeshStandardMaterial({
      color: 0x8a9096,    // Clean architectural concrete grey
      roughness: 0.75,
      metalness: 0.05,
      flatShading: true   // Crisp faceted wall look
    })
  ];

  currentMesh = new THREE.Mesh(geom, materials);
  currentMesh.castShadow = true;
  currentMesh.receiveShadow = true;
  currentMesh.scale.y = currentMultiplier;
  currentMesh.position.y = -0.01; // Roads rest exactly on Y=0

  terrainGroup.add(currentMesh);
}

export function setTerrainLayer(mode) {
  currentMode = mode;
  if (!terrainGroup) return;

  const isWire = mode === 'wireframe';

  terrainGroup.children.forEach(child => {
    if (!child.isMesh) return;

    if (Array.isArray(child.material)) {
      child.material.forEach(m => {
        m.wireframe = isWire;
        m.needsUpdate = true;
      });

      if (mode === 'heatmap') {
        // Tint walls warm orange, remove optical texture from roof to show heat tint
        if (child.material[1]) child.material[1].color.setHex(0xff6600);
        if (child.material[0]) {
          child.material[0].map = null;
          child.material[0].color.setHex(0xcc3300);
          child.material[0].needsUpdate = true;
        }
      } else if (mode === 'optical') {
        if (child.material[0]) {
          child.material[0].map = currentOpticalTex;
          child.material[0].color.setHex(0xffffff);
          child.material[0].needsUpdate = true;
        }
        if (child.material[1]) child.material[1].color.setHex(0x8a9096);
      }
    } else {
      child.material.wireframe = isWire;
      child.material.needsUpdate = true;
    }
  });
}

export function getTerrainMesh() {
  return terrainGroup;
}

export function getBuildingsMesh() {
  return currentMesh;
}

export function getRaycastTargets() {
  return currentMesh ? [currentMesh] : [];
}

// ─── IMAGE LOADERS ────────────────────────────────────────────────────────────
async function loadImages(optUrl, hgtUrl) {
  const [optImg, hgtImg] = await Promise.all([loadImage(optUrl), loadImage(hgtUrl)]);
  return { optImg, hgtImg };
}

function loadImage(url) {
  return new Promise(resolve => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

