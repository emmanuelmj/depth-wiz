import * as THREE from 'three';

let terrainGroup = null;
let currentMode = 'optical';
let currentOpticalTex = null;
let baseScale = 25;

export function initTerrain(scene) {
  terrainGroup = new THREE.Group();
  scene.add(terrainGroup);

  // Soft ambient lighting, crisp sun for architectural shadows
  scene.add(new THREE.AmbientLight(0xffffff, 0.8));
  const sun = new THREE.DirectionalLight(0xfffdf0, 1.5);
  sun.position.set(60, 120, 40);
  sun.castShadow = true;
  scene.add(sun);
  
  const fill = new THREE.DirectionalLight(0xc8d8ff, 0.3);
  fill.position.set(-30, 20, -30);
  scene.add(fill);
  
  return terrainGroup;
}

export async function updateTerrainScene(sceneData) {
  if (!terrainGroup || !sceneData.assets) return;

  // Clear previous city
  while (terrainGroup.children.length > 0) {
    const child = terrainGroup.children[0];
    terrainGroup.remove(child);
    if (child.geometry) child.geometry.dispose();
    if (child.material) {
      if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
      else child.material.dispose();
    }
  }

  const { optImg, hgtImg } = await loadImages(
    sceneData.assets.optical_texture_url,
    sceneData.assets.height_map_url
  );

  if (!optImg || !hgtImg) return;

  currentOpticalTex = new THREE.CanvasTexture(optImg);
  currentOpticalTex.colorSpace = THREE.SRGBColorSpace;
  currentOpticalTex.anisotropy = 16;

  const range = (sceneData.elevation_stats?.max_m || 100) - (sceneData.elevation_stats?.min_m || 0);
  baseScale = THREE.MathUtils.clamp(600 / Math.max(10, range), 10, 40);

  buildArchitecturalCity(optImg, hgtImg);
}

// ─── SMOOTH DISPLACEMENT WITH SLOPE-BASED MATERIALS ──────────────────────────
function buildArchitecturalCity(optImg, hgtImg) {
  const gridSize = 256; 
  
  const hgtCanvas = document.createElement('canvas');
  hgtCanvas.width = hgtCanvas.height = gridSize;
  const hgtCtx = hgtCanvas.getContext('2d', { willReadFrequently: true });
  hgtCtx.drawImage(hgtImg, 0, 0, gridSize, gridSize);
  const hgtData = hgtCtx.getImageData(0, 0, gridSize, gridSize).data;

  const threshold = 0.15; 

  // 1. Create a dense continuous plane
  const segments = gridSize - 1;
  const geom = new THREE.PlaneGeometry(100, 100, segments, segments);
  geom.rotateX(-Math.PI / 2); // Orient so Y is up

  const pos = geom.attributes.position;
  
  // 2. Displace vertices smoothly
  for (let i = 0; i < pos.count; i++) {
    // PlaneGeometry vertices go row by row
    const px = i % gridSize;
    const py = Math.floor(i / gridSize);
    
    let hNorm = hgtData[(py * gridSize + px) * 4] / 255.0;
    if (hNorm < threshold) hNorm = 0; // Flatten roads and noise
    
    pos.setY(i, hNorm * baseScale);
  }
  
  geom.computeVertexNormals();

  // 3. Assign Materials based on Slope (Face Normals)
  const indices = geom.getIndex().array;
  geom.clearGroups(); // Clear default groups
  
  const roofIndices = [];
  const wallIndices = [];
  
  const vA = new THREE.Vector3();
  const vB = new THREE.Vector3();
  const vC = new THREE.Vector3();
  const cb = new THREE.Vector3();
  const ab = new THREE.Vector3();

  for (let i = 0; i < indices.length; i += 3) {
    const a = indices[i];
    const b = indices[i+1];
    const c = indices[i+2];

    vA.fromBufferAttribute(pos, a);
    vB.fromBufferAttribute(pos, b);
    vC.fromBufferAttribute(pos, c);

    cb.subVectors(vC, vB);
    ab.subVectors(vA, vB);
    cb.cross(ab);
    cb.normalize(); 

    // cb.y is the vertical component of the face normal.
    // > 0.6 means the face is mostly flat (roof or road).
    // <= 0.6 means the face is steep (a vertical wall).
    if (cb.y > 0.6) {
      roofIndices.push(a, b, c);
    } else {
      wallIndices.push(a, b, c);
    }
  }

  // Reconstruct the index buffer to group them for the multi-material array
  const newIndices = new Uint32Array(roofIndices.length + wallIndices.length);
  newIndices.set(roofIndices, 0);
  newIndices.set(wallIndices, roofIndices.length);
  geom.setIndex(new THREE.BufferAttribute(newIndices, 1));
  
  geom.addGroup(0, roofIndices.length, 0); // Material 0: Roofs
  geom.addGroup(roofIndices.length, wallIndices.length, 1); // Material 1: Walls

  // 4. Create Mesh
  const materials = [
    new THREE.MeshStandardMaterial({ map: currentOpticalTex, roughness: 0.9 }),
    new THREE.MeshStandardMaterial({ 
      color: 0x8a9096, // Clean architectural grey
      roughness: 0.8, 
      flatShading: true // Gives crisp facets to the walls
    }) 
  ];

  const mesh = new THREE.Mesh(geom, materials);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  
  // Lower it slightly so roads rest exactly on 0
  mesh.position.y = -0.01;
  terrainGroup.add(mesh);
}

export function setTerrainLayer(mode) {
  currentMode = mode;
  if (!terrainGroup) return;

  const isWire = mode === 'wireframe';
  
  terrainGroup.children.forEach(child => {
    if (child.isMesh) {
      if (Array.isArray(child.material)) {
        child.material.forEach(m => m.wireframe = isWire);
      } else {
        child.material.wireframe = isWire;
      }

      if (mode === 'heatmap') {
        if (Array.isArray(child.material)) {
           child.material.forEach(m => m.color?.setHex(0xff5500));
        } else {
           child.material.color?.setHex(0x222222);
        }
      } else {
        if (Array.isArray(child.material)) {
           // Material 1 is walls, Material 0 is roof
           if (child.material[1]) child.material[1].color?.setHex(0xdcdcdc); 
           if (child.material[0]) child.material[0].color?.setHex(0xffffff); 
        } else {
           child.material.color?.setHex(0xffffff);
        }
      }
    }
  });
}

export function getTerrainMesh() { return terrainGroup; }

async function loadImages(optUrl, hgtUrl) {
  const [optImg, hgtImg] = await Promise.all([loadImage(optUrl), loadImage(hgtUrl)]);
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
