import * as THREE from 'three';

const M = 0.4; // 1 world unit = 2.5 meters
const cityGroup = new THREE.Group();
cityGroup.name = 'ProceduralCity';
let directionalLight;

// ── Texture Generators ────────────────────────────────────────────────────────
function createWallTexture(colorHex) {
  const canvas = document.createElement('canvas');
  canvas.width = 64; canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = colorHex;
  ctx.fillRect(0,0,64,64);
  ctx.fillStyle = 'rgba(0,0,0,0.08)';
  for(let i=0; i<64; i+=8) ctx.fillRect(0, i, 64, 1);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function createRoofTexture(colorHex) {
  const canvas = document.createElement('canvas');
  canvas.width = 64; canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = colorHex;
  ctx.fillRect(0,0,64,64);
  ctx.fillStyle = 'rgba(0,0,0,0.15)';
  for(let i=0; i<64; i+=4) {
    for(let j=0; j<64; j+=8) {
      ctx.fillRect(j + (i%8), i, 4, 2);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  return tex;
}

// ── Materials & Geometries ────────────────────────────────────────────────────
const materials = {
  wallBrick: new THREE.MeshStandardMaterial({ map: createWallTexture('#8a5a44'), roughness: 0.9 }),
  wallSidingBlue: new THREE.MeshStandardMaterial({ map: createWallTexture('#4a5e6d'), roughness: 0.9 }),
  wallSidingWhite: new THREE.MeshStandardMaterial({ map: createWallTexture('#d0d0d0'), roughness: 0.9 }),
  roofDark: new THREE.MeshStandardMaterial({ map: createRoofTexture('#2a2a2a'), roughness: 0.8 }),
  roofBrown: new THREE.MeshStandardMaterial({ map: createRoofTexture('#4e342e'), roughness: 0.8 }),
  trunk: new THREE.MeshStandardMaterial({ color: '#4e342e', roughness: 0.9 }),
  leaves: new THREE.MeshStandardMaterial({ color: '#2e7d32', roughness: 0.8 }),
  leavesDark: new THREE.MeshStandardMaterial({ color: '#1b5e20', roughness: 0.9 }),
  carBody: [
    new THREE.MeshStandardMaterial({ color: '#b71c1c', roughness: 0.4, metalness: 0.3 }),
    new THREE.MeshStandardMaterial({ color: '#0d47a1', roughness: 0.4, metalness: 0.3 }),
    new THREE.MeshStandardMaterial({ color: '#cfd8dc', roughness: 0.4, metalness: 0.3 }),
    new THREE.MeshStandardMaterial({ color: '#212121', roughness: 0.4, metalness: 0.3 }),
    new THREE.MeshStandardMaterial({ color: '#fbc02d', roughness: 0.4, metalness: 0.3 })
  ],
  carWindow: new THREE.MeshStandardMaterial({ color: '#111', roughness: 0.1, metalness: 0.8 }),
  wood: new THREE.MeshStandardMaterial({ color: '#d7ccc8', roughness: 0.9 }),
  dirt: new THREE.MeshStandardMaterial({ color: '#5d4037', roughness: 1.0 })
};

const houseGeom = new THREE.BoxGeometry(4, 1.4, 4.8); // 3.5m tall to eaves
const houseGeom2 = new THREE.BoxGeometry(4, 2.4, 4.8); // 6.0m tall to eaves

// Roof for single story (2.5m tall -> 1.0wu)
const roofShape1 = new THREE.Shape();
roofShape1.moveTo(0, 0);
roofShape1.lineTo(2, 1.0);
roofShape1.lineTo(4, 0);
roofShape1.lineTo(0, 0);
const roofGeom1 = new THREE.ExtrudeGeometry(roofShape1, { depth: 4.8, bevelEnabled: false });
roofGeom1.center();

// Roof for two story (3.0m tall -> 1.2wu)
const roofShape2 = new THREE.Shape();
roofShape2.moveTo(0, 0);
roofShape2.lineTo(2, 1.2);
roofShape2.lineTo(4, 0);
roofShape2.lineTo(0, 0);
const roofGeom2 = new THREE.ExtrudeGeometry(roofShape2, { depth: 4.8, bevelEnabled: false });
roofGeom2.center();

// ── Builders ──────────────────────────────────────────────────────────────────
function buildHouse(x, z, rotation, isTwoStory=false) {
  const group = new THREE.Group();
  
  const wallMat = Object.values(materials)[Math.floor(Math.random()*3)]; // first 3 are walls
  const roofMat = Math.random() > 0.5 ? materials.roofDark : materials.roofBrown;
  
  const body = new THREE.Mesh(isTwoStory ? houseGeom2 : houseGeom, wallMat);
  body.position.y = isTwoStory ? 1.2 : 0.7; // Half of height
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);
  
  const roof = new THREE.Mesh(isTwoStory ? roofGeom2 : roofGeom1, roofMat);
  roof.position.y = (isTwoStory ? 2.4 : 1.4) + (isTwoStory ? 0.6 : 0.5); // eaves + half roof height
  roof.castShadow = true;
  roof.receiveShadow = true;
  group.add(roof);

  // 1.8m (0.72wu) privacy fence around backyard (depth 10m = 4wu)
  const fenceMat = materials.wood;
  const fenceHeight = 0.72;
  const fenceThickness = 0.1;
  const backYardDepth = 4.0;
  
  // Left fence
  const leftFence = new THREE.Mesh(new THREE.BoxGeometry(fenceThickness, fenceHeight, backYardDepth + 4.8), fenceMat);
  leftFence.position.set(-2.5, fenceHeight/2, -backYardDepth/2);
  leftFence.castShadow = true;
  group.add(leftFence);
  
  // Right fence
  const rightFence = new THREE.Mesh(new THREE.BoxGeometry(fenceThickness, fenceHeight, backYardDepth + 4.8), fenceMat);
  rightFence.position.set(2.5, fenceHeight/2, -backYardDepth/2);
  rightFence.castShadow = true;
  group.add(rightFence);

  // Back fence
  const backFence = new THREE.Mesh(new THREE.BoxGeometry(5.0, fenceHeight, fenceThickness), fenceMat);
  backFence.position.set(0, fenceHeight/2, -backYardDepth - 2.4);
  backFence.castShadow = true;
  group.add(backFence);
  
  group.position.set(x, 0, z);
  group.rotation.y = rotation;
  return group;
}

function buildTree(x, z, scale=1, isForest=false) {
  const group = new THREE.Group();
  
  // scale is used as a base height multiplier
  // Street trees: 4-6m (1.6-2.4wu), canopy cleared to 2.5m (1.0wu)
  // Forest trees: 15-20m (6.0-8.0wu), canopy cleared to 6m (2.4wu)
  const trunkHeight = isForest ? 2.4 * scale : 1.0 * scale;
  const canopyRadius = isForest ? 2.5 * scale : 1.2 * scale;
  
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.15*scale, 0.2*scale, trunkHeight), materials.trunk);
  trunk.position.y = trunkHeight / 2;
  trunk.castShadow = true;
  group.add(trunk);
  
  const leafMat = isForest && Math.random() > 0.5 ? materials.leavesDark : materials.leaves;
  const leaves = new THREE.Mesh(new THREE.SphereGeometry(canopyRadius, 7, 7), leafMat);
  leaves.position.y = trunkHeight + canopyRadius * 0.8; 
  leaves.castShadow = true;
  group.add(leaves);
  
  group.position.set(x, 0, z);
  return group;
}

function buildCar(x, z, rotation) {
  const group = new THREE.Group();
  const mat = materials.carBody[Math.floor(Math.random()*materials.carBody.length)];
  
  // 1.8m wide (0.72wu), 4.5m long (1.8wu), 1.45m tall (0.58wu)
  // chassis clearance 20cm (0.08wu)
  const bodyHeight = 0.3;
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.72, bodyHeight, 1.8), mat);
  body.position.y = 0.08 + bodyHeight/2; // 0.23
  body.castShadow = true;
  group.add(body);
  
  const topHeight = 0.28;
  const top = new THREE.Mesh(new THREE.BoxGeometry(0.6, topHeight, 0.9), materials.carWindow);
  top.position.y = 0.08 + bodyHeight + topHeight/2; // 0.52
  top.position.z = -0.1;
  top.castShadow = true;
  group.add(top);
  
  group.position.set(x, 0, z);
  group.rotation.y = rotation;
  return group;
}

function buildConstruction(x, z, type) {
  const group = new THREE.Group();
  if (type === 'foundation') {
    const dirt = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.2, 5.0), materials.dirt);
    dirt.position.y = 0.1;
    group.add(dirt);
  } else if (type === 'framed') {
    const frame = new THREE.Mesh(new THREE.BoxGeometry(4, 2.4, 4.8), materials.wood);
    frame.position.y = 1.2;
    frame.castShadow = true;
    group.add(frame);
  } else {
    const supplies = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1, 2), materials.wood);
    supplies.position.set(1, 0.5, 1);
    supplies.castShadow = true;
    group.add(supplies);
  }
  group.position.set(x, 0, z);
  return group;
}

function buildEstate(x, z) {
  const group = new THREE.Group();
  const mat = materials.wallSidingWhite;
  
  const main = new THREE.Mesh(new THREE.BoxGeometry(8, 5.6, 6), mat);
  main.position.y = 2.8;
  main.castShadow = true;
  group.add(main);
  
  const wing = new THREE.Mesh(new THREE.BoxGeometry(4, 4, 8), mat);
  wing.position.set(-4, 2.0, 2);
  wing.castShadow = true;
  group.add(wing);
  
  group.position.set(x, 0, z);
  return group;
}

// ── Population ────────────────────────────────────────────────────────────────
export async function populateCity(imageUrl = "/demo_data/dc-03-26/optical.jpg") {
  // Clear existing items in cityGroup
  while(cityGroup.children.length > 0) {
    cityGroup.remove(cityGroup.children[0]);
  }

  try {
    console.log("Fetching map data from YOLO backend...");
    // 1. Fetch the image blob from the frontend URL
    const imgResponse = await fetch(imageUrl);
    const blob = await imgResponse.blob();

    // 2. Send to backend /api/analyze-map
    const formData = new FormData();
    formData.append("file", blob, "map.jpg");

    const response = await fetch("http://127.0.0.1:8000/api/analyze-map", {
      method: "POST",
      body: formData
    });
    
    if (!response.ok) {
      throw new Error("Failed to analyze map");
    }

    const data = await response.json();
    console.log("YOLO/CV Analysis received:", data);

    // 3. Plop houses based on detection
    data.houses.forEach(h => {
      cityGroup.add(buildHouse(h.x, h.z, h.r, Math.random() > 0.6));
    });

    // 4. Plop trees — all come from forest detection now
    data.trees.forEach(t => {
      // All detected trees are from forest blobs — smaller scale for dense canopy
      cityGroup.add(buildTree(t.x, t.z, 0.5 + Math.random() * 0.4, true));
    });

    // 5. Plop cars (YOLO detections)
    data.cars.forEach(c => {
      cityGroup.add(buildCar(c.x, c.z, c.r || 1.57));
    });

  } catch (error) {
    console.error("Error analyzing map dynamically. Falling back to hardcoded layout.", error);
    populateCityFallback();
  }
}

function populateCityFallback() {
  // Exact coordinates mapped to the 2D optical map footprints
  const houses = [
    {x: -6, z: 15, r: 1.3}, {x: 2, z: 13, r: 1.4}, {x: 10, z: 11, r: 1.57},
    {x: 18, z: 10, r: 1.57}, {x: 26, z: 9.5, r: 1.57}, {x: 34, z: 9, r: 1.57},
    {x: 42, z: 8.5, r: 1.57}, {x: 50, z: 8, r: 1.57},
    {x: -6, z: 27, r: 1.3}, {x: 2, z: 25, r: 1.4}, {x: 10, z: 24, r: 1.57},
    {x: 18, z: 23, r: 1.57}, {x: 26, z: 22, r: 1.57}, {x: 34, z: 21, r: 1.57},
    {x: 42, z: 20, r: 1.57}, {x: 50, z: 19, r: 1.57},
    {x: -12, z: 42, r: 1.3}, {x: -4, z: 40, r: 1.4}, {x: 4, z: 38, r: 1.57},
    {x: 12, z: 37, r: 1.57}, {x: 20, z: 36, r: 1.57}, {x: 28, z: 35, r: 1.57},
    {x: 36, z: 34, r: 1.57}, {x: 44, z: 33, r: 1.57},
    {x: -18, z: 35, r: 1.0}, {x: -25, z: 28, r: 0.7}, 
    {x: -30, z: 20, r: 0.4}, {x: -32, z: 12, r: 0.1},
    {x: 30, z: -4, r: 1.57}, {x: 38, z: -4.5, r: 1.57}, {x: 46, z: -5, r: 1.57},
    {x: -15, z: 0, r: 1.0}, {x: -5, z: -6, r: 1.0}, {x: 5, z: -8, r: 1.57}
  ];

  houses.forEach(h => {
    cityGroup.add(buildHouse(h.x, h.z, h.r, Math.random() > 0.6));
  });

  for(let i=0; i<300; i++) {
    const x = -50 + Math.random()*60;
    const z = -50 + Math.random()*60;
    if (x + z < -35) cityGroup.add(buildTree(x, z, 1.8 + Math.random() * 1.5, true));
  }
  
  const streetTrees = [{z: -1}, {z: 14}, {z: 18}, {z: 30}];
  streetTrees.forEach(row => {
    for(let x=0; x<=45; x+=7) cityGroup.add(buildTree(x, row.z - (x*0.05), 0.7)); 
  });

  for(let i=0; i<40; i++) {
    const x = -10 + Math.random()*60;
    const z = 20 + Math.random()*30;
    if (x + z > 40) cityGroup.add(buildTree(x, z, 1.0 + Math.random(), false));
  }
  
  const cars = [
    {x: -40, z: 5, r: 0.8}, {x: -30, z: -5, r: 0.8}, {x: -20, z: -15, r: 0.8}, 
    {x: -10, z: -25, r: 0.8}, {x: 0, z: -35, r: 0.8},
    {x: 5, z: 5, r: 1.57}, {x: 18, z: 4.5, r: 1.57}, {x: 32, z: 4, r: 1.57},
    {x: -2, z: 7, r: -1.57}, {x: 12, z: 6.5, r: -1.57}, {x: 25, z: 6, r: -1.57}, {x: 40, z: 5.5, r: -1.57},
    {x: 2, z: 22, r: 1.57}, {x: 15, z: 21.5, r: 1.57}, {x: 28, z: 21, r: 1.57}, {x: 45, z: 20, r: 1.57},
    {x: 8, z: 24, r: -1.57}, {x: 22, z: 23.5, r: -1.57}, {x: 35, z: 23, r: -1.57},
    {x: -12, z: 32, r: 0.8}, {x: -18, z: 25, r: 0.5}, {x: -22, z: 15, r: 0.2}
  ];
  cars.forEach(c => {
    cityGroup.add(buildCar(c.x, c.z, c.r));
  });
}

// ── API ───────────────────────────────────────────────────────────────────────
export function buildCity(scene, parentMesh, optUrl) {
  clearCity(scene, parentMesh);
  
  populateCity(optUrl);
  parentMesh.add(cityGroup);
  
  // Golden hour lighting
  directionalLight = new THREE.DirectionalLight(0xffedd6, 3.0);
  directionalLight.position.set(-40, 35, 15);
  directionalLight.castShadow = true;
  directionalLight.shadow.mapSize.width = 2048;
  directionalLight.shadow.mapSize.height = 2048;
  directionalLight.shadow.camera.near = 1;
  directionalLight.shadow.camera.far = 150;
  
  const d = 55;
  directionalLight.shadow.camera.left = -d;
  directionalLight.shadow.camera.right = d;
  directionalLight.shadow.camera.top = d;
  directionalLight.shadow.camera.bottom = -d;
  directionalLight.shadow.bias = -0.0005;
  
  scene.add(directionalLight);
  
  const ambient = new THREE.AmbientLight(0x7393b3, 0.7); // blueish ambient fill
  ambient.name = 'CityAmbient';
  scene.add(ambient);
}

export function clearCity(scene, parentMesh) {
  if (parentMesh && parentMesh.children.includes(cityGroup)) {
    parentMesh.remove(cityGroup);
  }
  while(cityGroup.children.length > 0) {
    const child = cityGroup.children[0];
    cityGroup.remove(child);
  }
  if (directionalLight) {
    scene.remove(directionalLight);
    directionalLight = null;
  }
  const ambient = scene.getObjectByName('CityAmbient');
  if (ambient) scene.remove(ambient);
}
