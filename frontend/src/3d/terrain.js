import * as THREE from 'three';

let terrainMesh = null;
let textureLoader = null;
let currentMode = 'optical';
let heatmapTexture = null;
let currentOpticalTex = null;

export function initTerrain(scene) {
  textureLoader = new THREE.TextureLoader();
  const geometry = new THREE.PlaneGeometry(100, 100, 512, 512);
  const material = new THREE.MeshStandardMaterial({
    roughness: 0.85, metalness: 0.05, wireframe: false
  });
  terrainMesh = new THREE.Mesh(geometry, material);
  terrainMesh.rotation.x = -Math.PI / 2;
  scene.add(terrainMesh);
  scene.add(new THREE.AmbientLight(0xffffff, 0.75));
  const sun = new THREE.DirectionalLight(0xfffdf0, 1.3);
  sun.position.set(60, 100, 40);
  scene.add(sun);
  const fill = new THREE.DirectionalLight(0xc8d8ff, 0.25);
  fill.position.set(-30, -20, -30);
  scene.add(fill);
  return terrainMesh;
}

export async function updateTerrainScene(sceneData) {
  if (!terrainMesh || !sceneData.assets) return;
  const type = sceneData.landscape_type || 'urban';
  const { colorTex, dispTex } = await loadTerrainTextures(
    sceneData.assets.optical_texture_url,
    sceneData.assets.height_map_url,
    type
  );
  currentOpticalTex = colorTex;
  const range = (sceneData.elevation_stats?.max_m || 100) - (sceneData.elevation_stats?.min_m || 0);
  const scale = THREE.MathUtils.clamp(600 / Math.max(10, range), 4, 22);
  const mat = terrainMesh.material;
  mat.displacementMap = dispTex;
  mat.displacementScale = scale;
  setTerrainLayer(currentMode);
}

export function setTerrainLayer(mode) {
  if (!terrainMesh) return;
  currentMode = mode;
  const mat = terrainMesh.material;
  if (mode === 'optical') {
    mat.map = currentOpticalTex;
    mat.wireframe = false;
  } else if (mode === 'wireframe') {
    mat.map = currentOpticalTex;
    mat.wireframe = true;
  } else if (mode === 'heatmap') {
    mat.map = getHeatmapTexture();
    mat.wireframe = false;
  }
  mat.needsUpdate = true;
}

export function getTerrainMesh() { return terrainMesh; }

// ─── TEXTURE LOADING ──────────────────────────────────────────────────────────
async function loadTerrainTextures(optUrl, hgtUrl, type) {
  const [colorResult, dispResult] = await Promise.all([
    tryLoadTexture(optUrl),
    tryLoadTexture(hgtUrl)
  ]);
  if (colorResult && dispResult) {
    colorResult.colorSpace = THREE.SRGBColorSpace;
    colorResult.wrapS = colorResult.wrapT = THREE.ClampToEdgeWrapping;
    dispResult.colorSpace = THREE.NoColorSpace;
    dispResult.wrapS = dispResult.wrapT = THREE.ClampToEdgeWrapping;
    return { colorTex: colorResult, dispTex: dispResult };
  }
  return buildProceduralTextures(type);
}

function tryLoadTexture(url) {
  return new Promise(resolve => {
    textureLoader.load(url, tex => resolve(tex), undefined, () => resolve(null));
  });
}

// ─── PROCEDURAL TEXTURE GENERATOR ─────────────────────────────────────────────
const proceduralCache = {};

function buildProceduralTextures(type) {
  if (proceduralCache[type]) return proceduralCache[type];
  const S = 512;
  const cc = makeCtx(S);
  const dc = makeCtx(S);
  const rng = seededRNG(type);

  if (type === 'urban')         genUrban(cc, dc, rng, S);
  else if (type === 'sparse')   genSparse(cc, dc, rng, S);
  else if (type === 'mountain') genMountain(cc, dc, rng, S);
  else if (type === 'forest')   genForest(cc, dc, rng, S);
  else                          genUrban(cc, dc, rng, S);

  const colorTex = ctxToTexture(cc.canvas, false);
  const dispTex  = ctxToTexture(dc.canvas, true);
  const result = { colorTex, dispTex };
  proceduralCache[type] = result;
  return result;
}

function makeCtx(S) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = S;
  return canvas.getContext('2d');
}

function ctxToTexture(canvas, isHeight) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = isHeight ? THREE.NoColorSpace : THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

// Deterministic PRNG — same seed → same texture every call
function seededRNG(type) {
  let s = type.split('').reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 0x12345678);
  return function() {
    s ^= s << 13; s ^= s >> 17; s ^= s << 5;
    return ((s >>> 0) / 0xFFFFFFFF);
  };
}

// ─── URBAN (Ahmedabad-style city satellite view) ───────────────────────────────
function genUrban(cc, dc, rng, S) {
  const BLOCK = 64, ROAD = 5;

  // Asphalt base
  cc.fillStyle = '#484340';
  cc.fillRect(0, 0, S, S);
  dc.fillStyle = '#060504';
  dc.fillRect(0, 0, S, S);

  // Road grid on color map
  cc.strokeStyle = '#2e2b27';
  cc.lineWidth = ROAD;
  for (let i = 0; i <= S; i += BLOCK) {
    cc.beginPath(); cc.moveTo(i, 0); cc.lineTo(i, S); cc.stroke();
    cc.beginPath(); cc.moveTo(0, i); cc.lineTo(S, i); cc.stroke();
  }

  // Build layout with one RNG stream → identical positions on both canvases
  const buildings = [];
  for (let bx = ROAD; bx < S; bx += BLOCK) {
    for (let by = ROAD; by < S; by += BLOCK) {
      const W = BLOCK - ROAD, H = BLOCK - ROAD;
      let px = bx;
      while (px < bx + W - 3) {
        const bW = Math.floor(6 + rng() * 16);
        let py = by;
        while (py < by + H - 3) {
          const bH = Math.floor(6 + rng() * 16);
          const floors = Math.floor(1 + rng() * 7);
          const shade  = Math.floor(148 + rng() * 72);
          const warm   = Math.floor(rng() * 22 - 8);
          buildings.push({
            x: px, y: py,
            w: Math.min(bW - 1, bx + W - px - 1),
            h: Math.min(bH - 1, by + H - py - 1),
            floors, shade, warm
          });
          py += bH;
        }
        px += bW;
      }
    }
  }

  for (const b of buildings) {
    if (b.w <= 0 || b.h <= 0) continue;
    const r = Math.min(255, b.shade + b.warm);
    const g = Math.min(255, b.shade);
    const bl = Math.min(255, b.shade - 12);
    cc.fillStyle = `rgb(${r},${g},${bl})`;
    cc.fillRect(b.x, b.y, b.w, b.h);
    const brt = Math.min(245, b.floors * 32 + 10);
    dc.fillStyle = `rgb(${brt},${brt},${brt})`;
    dc.fillRect(b.x, b.y, b.w, b.h);
  }

  // Vegetation scatter (parks, trees)
  for (let i = 0; i < 22; i++) {
    const gx = rng() * S, gy = rng() * S, gr = 4 + rng() * 9;
    const cg = cc.createRadialGradient(gx, gy, 0, gx, gy, gr);
    cg.addColorStop(0, 'rgba(48, 96, 40, 0.95)');
    cg.addColorStop(1, 'rgba(30, 70, 28, 0)');
    cc.fillStyle = cg; cc.beginPath(); cc.arc(gx, gy, gr, 0, Math.PI * 2); cc.fill();
    dc.fillStyle = 'rgba(32, 32, 32, 0.75)';
    dc.beginPath(); dc.arc(gx, gy, gr * 0.7, 0, Math.PI * 2); cc.fill();
  }
}

// ─── SPARSE AGRICULTURAL (Punjab fields) ─────────────────────────────────────
function genSparse(cc, dc, rng, S) {
  const COLS = ['#c4be52','#aab840','#d2c85a','#b0c248','#c8ce58','#96a838','#dcd268','#b4c84a'];
  cc.fillStyle = '#c0b84c'; cc.fillRect(0, 0, S, S);
  dc.fillStyle = '#080808'; dc.fillRect(0, 0, S, S);

  let fx = 0;
  while (fx < S) {
    const fw = Math.floor(28 + rng() * 55);
    let fy = 0;
    while (fy < S) {
      const fh  = Math.floor(22 + rng() * 48);
      const col = COLS[Math.floor(rng() * COLS.length)];
      cc.fillStyle = col; cc.fillRect(fx, fy, fw, fh);
      const sub = Math.floor(4 + rng() * 14);
      dc.fillStyle = `rgb(${sub},${sub},${sub})`; dc.fillRect(fx, fy, fw, fh);
      fy += fh;
    }
    fx += fw;
  }

  // Irrigation channels
  cc.strokeStyle = '#7898a8'; cc.lineWidth = 1.5;
  for (let i = 0; i < 8; i++) {
    const x = rng() * S;
    cc.beginPath(); cc.moveTo(x, 0); cc.lineTo(x + rng() * 20 - 10, S); cc.stroke();
  }
  // Dirt roads
  cc.strokeStyle = '#9a8840'; cc.lineWidth = 2;
  for (let j = 0; j < 6; j++) {
    const y = rng() * S;
    cc.beginPath(); cc.moveTo(0, y); cc.lineTo(S, y + rng() * 30 - 15); cc.stroke();
  }
}

// ─── MOUNTAIN (Himachal ridges + snow) ───────────────────────────────────────
function genMountain(cc, dc, rng, S) {
  cc.fillStyle = '#7e6a58'; cc.fillRect(0, 0, S, S);
  dc.fillStyle = '#141414'; dc.fillRect(0, 0, S, S);

  for (let i = 0; i < 18; i++) {
    const cx = rng() * S, cy = rng() * S;
    const r  = 90 + rng() * 160;
    const h  = 0.35 + rng() * 0.65;
    const cGrad = cc.createRadialGradient(cx, cy, 0, cx, cy, r);
    cGrad.addColorStop(0,    `rgba(225, 220, 215, ${h})`);
    cGrad.addColorStop(0.35, `rgba(175, 160, 145, ${h * 0.85})`);
    cGrad.addColorStop(0.65, `rgba(130, 110, 90,  ${h * 0.5})`);
    cGrad.addColorStop(1,    'rgba(80, 65, 50, 0)');
    cc.fillStyle = cGrad; cc.fillRect(0, 0, S, S);
    const brt = Math.floor(h * 230);
    const dGrad = dc.createRadialGradient(cx, cy, 0, cx, cy, r);
    dGrad.addColorStop(0, `rgba(${brt},${brt},${brt},1)`);
    dGrad.addColorStop(1, 'rgba(0,0,0,0)');
    dc.fillStyle = dGrad; dc.fillRect(0, 0, S, S);
  }

  // Pine forest patches in valleys
  for (let i = 0; i < 12; i++) {
    const gx = rng() * S, gy = rng() * S, gr = 15 + rng() * 35;
    const cg = cc.createRadialGradient(gx, gy, 0, gx, gy, gr);
    cg.addColorStop(0, 'rgba(35, 70, 35, 0.7)');
    cg.addColorStop(1, 'rgba(20, 50, 20, 0)');
    cc.fillStyle = cg; cc.beginPath(); cc.arc(gx, gy, gr, 0, Math.PI * 2); cc.fill();
  }
}

// ─── FOREST (Western Ghats canopy) ────────────────────────────────────────────
function genForest(cc, dc, rng, S) {
  cc.fillStyle = '#1c4220'; cc.fillRect(0, 0, S, S);
  dc.fillStyle = '#151515'; dc.fillRect(0, 0, S, S);

  for (let i = 0; i < 450; i++) {
    const tx = rng() * S, ty = rng() * S, tr = 3 + rng() * 10;
    const g  = Math.floor(90 + rng() * 70);
    const r  = Math.floor(8  + rng() * 28);
    const b  = Math.floor(8  + rng() * 18);
    const a  = 0.7 + rng() * 0.3;
    const cg = cc.createRadialGradient(tx, ty, 0, tx, ty, tr);
    cg.addColorStop(0,    `rgba(${r+24},${g+12},${b+6},${a})`);
    cg.addColorStop(0.5,  `rgba(${r+10},${g},${b},${a*0.8})`);
    cg.addColorStop(1,    `rgba(${r},${g-10},${b-5},0)`);
    cc.fillStyle = cg; cc.beginPath(); cc.arc(tx, ty, tr, 0, Math.PI * 2); cc.fill();
    const ch = Math.floor(18 + rng() * 58);
    dc.fillStyle = `rgba(${ch},${ch},${ch},0.8)`;
    dc.beginPath(); dc.arc(tx, ty, tr * 0.75, 0, Math.PI * 2); dc.fill();
  }
  // Clearings (bare earth patches)
  for (let i = 0; i < 8; i++) {
    const cx = rng() * S, cy = rng() * S, cr = 5 + rng() * 12;
    cc.fillStyle = 'rgba(110, 80, 55, 0.6)';
    cc.beginPath(); cc.arc(cx, cy, cr, 0, Math.PI * 2); cc.fill();
    dc.fillStyle = 'rgba(5, 5, 5, 0.8)';
    dc.beginPath(); dc.arc(cx, cy, cr, 0, Math.PI * 2); dc.fill();
  }
}

// ─── TURBO HEATMAP ────────────────────────────────────────────────────────────
function getHeatmapTexture() {
  if (heatmapTexture) return heatmapTexture;
  const canvas = document.createElement('canvas');
  canvas.width = 16; canvas.height = 256;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createLinearGradient(0, 256, 0, 0);
  grad.addColorStop(0.0, '#30123B'); grad.addColorStop(0.2, '#4662D8');
  grad.addColorStop(0.4, '#36BB9B'); grad.addColorStop(0.6, '#A2DA37');
  grad.addColorStop(0.8, '#F8BA2B'); grad.addColorStop(1.0, '#7A0403');
  ctx.fillStyle = grad; ctx.fillRect(0, 0, 16, 256);
  heatmapTexture = new THREE.CanvasTexture(canvas);
  heatmapTexture.colorSpace = THREE.SRGBColorSpace;
  return heatmapTexture;
}
