import * as THREE from 'three';

let terrainMesh = null;
let textureLoader = null;
let currentMode = 'optical';
let currentOpticalUrl = null;
let currentHeightUrl = null;
let heatmapTexture = null;

export function initTerrain(scene) {
  textureLoader = new THREE.TextureLoader();

  // 512x512 segments is optimal for Intel UHD Graphics
  const geometry = new THREE.PlaneGeometry(100, 100, 512, 512);

  const material = new THREE.MeshStandardMaterial({
    roughness: 0.85,
    metalness: 0.1,
    wireframe: false
  });

  terrainMesh = new THREE.Mesh(geometry, material);
  terrainMesh.rotation.x = -Math.PI / 2;
  terrainMesh.receiveShadow = false;
  terrainMesh.castShadow = false;
  scene.add(terrainMesh);

  // Lighting
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
  scene.add(ambientLight);

  const sun = new THREE.DirectionalLight(0xffffff, 1.2);
  sun.position.set(50, 80, 30);
  scene.add(sun);

  return terrainMesh;
}

export function updateTerrainScene(sceneData) {
  if (!terrainMesh || !sceneData.assets) return;

  currentOpticalUrl = sceneData.assets.optical_texture_url;
  currentHeightUrl = sceneData.assets.height_map_url;

  // Load optical color texture
  const colorTexture = textureLoader.load(currentOpticalUrl);
  colorTexture.colorSpace = THREE.SRGBColorSpace;
  colorTexture.wrapS = THREE.ClampToEdgeWrapping;
  colorTexture.wrapT = THREE.ClampToEdgeWrapping;

  // Load 16-bit displacement height map
  const displacementTexture = textureLoader.load(currentHeightUrl);
  displacementTexture.colorSpace = THREE.NoColorSpace;
  displacementTexture.wrapS = THREE.ClampToEdgeWrapping;
  displacementTexture.wrapT = THREE.ClampToEdgeWrapping;
  displacementTexture.minFilter = THREE.LinearFilter;
  displacementTexture.magFilter = THREE.LinearFilter;
  displacementTexture.generateMipmaps = false;

  // Realistic vertical exaggeration:
  // On a 100-unit plane representing a ~1.2km tile, real physical elevation is (range_m / 1200m) * 100
  // Apply a natural 1.8x - 2.2x vertical exaggeration so mountains & buildings look crisp without extreme needle spikes
  const range = (sceneData.elevation_stats?.max_m || 100) - (sceneData.elevation_stats?.min_m || 0);
  const naturalScale = (range / 1200.0) * 100.0 * 2.0;
  const scale = THREE.MathUtils.clamp(naturalScale, 3.0, 9.5);

  const mat = terrainMesh.material;
  mat.displacementMap = displacementTexture;
  mat.displacementScale = scale;

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
    if (currentOpticalUrl) {
      const colorTex = textureLoader.load(currentOpticalUrl);
      colorTex.colorSpace = THREE.SRGBColorSpace;
      mat.map = colorTex;
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
