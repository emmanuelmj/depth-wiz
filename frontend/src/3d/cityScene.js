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
function populateCity() {
  // Houses along pseudo-lines to match texture
  const lines = [
    { start: [-20, 42], end: [48, 32], rot: -0.15 }, // Bottom low
    { start: [-25, 27], end: [48, 17], rot: Math.PI - 0.15 }, // Bottom high
    { start: [-10, 15], end: [48, 4], rot: -0.2 }, // Mid low
    { start: [2, 0], end: [48, -9], rot: Math.PI - 0.2 }, // Mid high
    { start: [20, -13], end: [48, -20], rot: -0.25 } // Top low
  ];
  
  lines.forEach(l => {
    const dx = l.end[0] - l.start[0];
    const dz = l.end[1] - l.start[1];
    const dist = Math.hypot(dx, dz);
    const steps = Math.floor(dist / 5.5); // Spacing 5.5 wu
    for(let i=0; i<=steps; i++) {
      const t = i / steps;
      const x = l.start[0] + dx * t;
      const z = l.start[1] + dz * t;
      
      // Skip construction sites
      if ((Math.abs(x - 5) < 3 && Math.abs(z - 12) < 3) || 
          (Math.abs(x - 15) < 3 && Math.abs(z - 10) < 3) ||
          (Math.abs(x - 22) < 3 && Math.abs(z - 8) < 3)) {
        continue;
      }
      
      cityGroup.add(buildHouse(x, z, l.rot, Math.random() > 0.6));
    }
  });

  // Curve houses (bottom left)
  for(let i=0; i<6; i++) {
    const angle = 0.5 + i * 0.25;
    const x = -30 + 15 * Math.cos(angle);
    const z = 25 + 15 * Math.sin(angle);
    cityGroup.add(buildHouse(x, z, -angle));
  }

  // Estate
  cityGroup.add(buildEstate(-35, -25));
  
  // Construction sites
  cityGroup.add(buildConstruction(5, 12, 'foundation'));
  cityGroup.add(buildConstruction(15, 10, 'framed'));
  cityGroup.add(buildConstruction(22, 8, 'supplies'));
  
  // Trees
  for(let i=0; i<150; i++) {
    const x = -50 + Math.random()*100;
    const z = -50 + Math.random()*100;
    
    // Forest divider (diagonal)
    if (z < x - 10 && z > x - 25) {
      cityGroup.add(buildTree(x, z, 1.5 + Math.random()*1.2, true));
    }
    // Deep forest (top left)
    if (x < -20 && z < -30) {
      cityGroup.add(buildTree(x, z, 2 + Math.random(), true));
    }
  }
  
  // Street Trees (Sycamore crescent roughly)
  for(let x=-15; x<=45; x+=6) {
    cityGroup.add(buildTree(x, 34.5 - (x+15)*0.15, 0.7));
    cityGroup.add(buildTree(x, 24.5 - (x+15)*0.15, 0.7));
  }
  
  // Cars
  for(let x=-10; x<40; x+=12) {
    cityGroup.add(buildCar(x, 30 - (x+10)*0.15, -0.15 + Math.PI/2));
    cityGroup.add(buildCar(x+4, 20 - (x+14)*0.15, -0.15 - Math.PI/2));
  }
}

// ── API ───────────────────────────────────────────────────────────────────────
export function buildCity(scene, parentMesh) {
  clearCity(scene, parentMesh);
  
  populateCity();
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
