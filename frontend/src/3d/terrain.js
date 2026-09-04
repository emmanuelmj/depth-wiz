import * as THREE from 'three';

let terrainMesh = null;
let textureLoader = null;
let currentMode = 'optical';
let currentOpticalUrl = null;
let currentHeightUrl = null;
let colorTexture = null;
let displacementTexture = null;
let heatmapTexture = null;

const CALIBRATED_URBAN_SCALE = 2.2; // Optimal, rock-solid physical building extrusion ratio

export function initTerrain(scene) {
  textureLoader = new THREE.TextureLoader();

  // High-density 384x384 geometry for crisp urban building contours
  const geometry = new THREE.PlaneGeometry(100, 100, 384, 384);

  const material = new THREE.MeshStandardMaterial({
    roughness: 0.75,
    metalness: 0.15,
    wireframe: false
  });

  terrainMesh = new THREE.Mesh(geometry, material);
  terrainMesh.rotation.x = -Math.PI / 2;
  terrainMesh.receiveShadow = true;
  terrainMesh.castShadow = true;
  scene.add(terrainMesh);

  // Lighting tuned for sharp 3D building shadows and relief
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
  scene.add(ambientLight);

  const sun = new THREE.DirectionalLight(0xffffff, 1.35);
  sun.position.set(40, 85, 30);
  sun.castShadow = true;
  scene.add(sun);

  const skyLight = new THREE.DirectionalLight(0x00F2FE, 0.25);
  skyLight.position.set(-40, 30, -30);
  scene.add(skyLight);

  return terrainMesh;
}

export function updateTerrainScene(sceneData) {
  if (!terrainMesh || !sceneData.assets) return;

  currentOpticalUrl = sceneData.assets.optical_texture_url;
  currentHeightUrl = sceneData.assets.height_map_url;

  // 1. Load optical color texture with crisp linear filtering
  colorTexture = textureLoader.load(currentOpticalUrl);
  colorTexture.colorSpace = THREE.SRGBColorSpace;
  colorTexture.wrapS = THREE.ClampToEdgeWrapping;
  colorTexture.wrapT = THREE.ClampToEdgeWrapping;
  colorTexture.minFilter = THREE.LinearFilter;
  colorTexture.magFilter = THREE.LinearFilter;
  colorTexture.generateMipmaps = false;

  // 2. Load 16-bit elevation displacement map
  displacementTexture = textureLoader.load(currentHeightUrl);
  displacementTexture.colorSpace = THREE.NoColorSpace;
  displacementTexture.wrapS = THREE.ClampToEdgeWrapping;
  displacementTexture.wrapT = THREE.ClampToEdgeWrapping;
  displacementTexture.minFilter = THREE.LinearFilter;
  displacementTexture.magFilter = THREE.LinearFilter;
  displacementTexture.generateMipmaps = false;

  // 3. Apply calibrated vertical displacement scale
  // On a 100-unit plane representing a 1.2km tile, real 40m buildings = 3.3 units
  // Scale 2.2 provides sharp, distinct 3D buildings without melted side-extrusion
  const mat = terrainMesh.material;
  mat.displacementMap = displacementTexture;
  mat.displacementScale = CALIBRATED_URBAN_SCALE;

  if (currentMode === 'optical') {
    mat.map = colorTexture;
    mat.wireframe = false;
  } else if (currentMode === 'wireframe') {
    mat.map = colorTexture;
    mat.wireframe = true;
  } else if (currentMode === 'heatmap') {
    mat.map = getHeatmapTexture();
    mat.wireframe = false;
  }

  mat.needsUpdate = true;
}

export function setTerrainLayer(mode) {
  if (!terrainMesh) return;
  currentMode = mode;
  const mat = terrainMesh.material;

  if (mode === 'optical') {
    if (colorTexture) {
      mat.map = colorTexture;
    }
    mat.wireframe = false;
  } else if (mode === 'wireframe') {
    mat.wireframe = true;
  } else if (mode === 'heatmap') {
    mat.map = getHeatmapTexture();
    mat.wireframe = false;
  }
  mat.needsUpdate = true;
}

export function getTerrainMesh() {
  return terrainMesh;
}

export function getRaycastTargets() {
  return [terrainMesh].filter(Boolean);
}

// Procedural Turbo/Elevation Heatmap Texture
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
