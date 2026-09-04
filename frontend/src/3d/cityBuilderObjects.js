/**
 * cityBuilderObjects.js
 * ─────────────────────────────────────────────────────────────────
 * Injects city-builder game elements directly into the Three.js scene:
 *
 *   • Floating 3D "R" zone badge sprites (texture-based billboard)
 *     — hover above the terrain with a bob animation
 *   • Road name text sprites (Oakland Blvd, Sycamore Crescent)
 *     — rendered as canvas-texture billboards
 *   • A thin drop-shadow "pin pole" under each R badge
 *
 * All objects are added to a dedicated THREE.Group so they can be
 * toggled or cleared without touching the terrain mesh.
 * ─────────────────────────────────────────────────────────────────
 */

import * as THREE from 'three';

// ── Group that lives inside the main THREE.Scene ──────────────────
let cityOverlayGroup = null;
let _clock           = null;
let _badges          = [];   // { mesh, baseY } — for animation loop

// ── Terrain coordinate space ──────────────────────────────────────
// terrain.js uses a 100×100 plane (PLANE_SIZE=100) centred at origin.
// Positions below are in that local space.
// X: -50 (left/west) → +50 (right/east)
// Z: -50 (top/north) → +50 (bottom/south)

const R_BADGE_POSITIONS = [
  { x:  2,  z: -5,  y: 3.5 },   // centre — unbuilt plot near Oakland Blvd
  { x: 20,  z: -8,  y: 3.0 },   // right block, upper row
  { x: 34,  z: -5,  y: 3.5 },   // far right — first "R"
  { x: 38,  z:  0,  y: 3.0 },   // far right — second "R"
];

const ROAD_LABELS = [
  { text: 'OAKLAND BLVD',      x: -10, z: -14, y: 1.2, rotY:  0.52 },
  { text: 'SYCAMORE CRESCENT', x:  12, z:  -2, y: 1.0, rotY:  0.0  },
  { text: 'SYCAMORE CRESCENT', x:  10, z:  20, y: 1.0, rotY: -0.07 },
];

// ── Public API ────────────────────────────────────────────────────

export function initCityBuilderObjects(scene) {
  // Remove previous group if any
  clearCityBuilderObjects(scene);

  _clock = new THREE.Clock();
  cityOverlayGroup = new THREE.Group();
  cityOverlayGroup.name = 'cityBuilderOverlay';
  scene.add(cityOverlayGroup);

  _badges = [];

  R_BADGE_POSITIONS.forEach((pos, i) => {
    const badge = _makeRBadge(i);
    badge.position.set(pos.x, pos.y, pos.z);
    cityOverlayGroup.add(badge);
    _badges.push({ mesh: badge, baseY: pos.y });

    // Thin vertical pole below the badge
    const pole = _makePole();
    pole.position.set(pos.x, pos.y / 2 - 0.5, pos.z);
    cityOverlayGroup.add(pole);
  });

  ROAD_LABELS.forEach(r => {
    const sprite = _makeRoadLabel(r.text);
    sprite.position.set(r.x, r.y, r.z);
    sprite.rotation.y = r.rotY;
    cityOverlayGroup.add(sprite);
  });
}

export function clearCityBuilderObjects(scene) {
  if (cityOverlayGroup && scene) {
    scene.remove(cityOverlayGroup);
    cityOverlayGroup.traverse(obj => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        if (obj.material.map) obj.material.map.dispose();
        obj.material.dispose();
      }
    });
  }
  cityOverlayGroup = null;
  _badges = [];
}

/** Call once per frame from the main render loop */
export function updateCityBuilderObjects() {
  if (!_clock || _badges.length === 0) return;
  const t = _clock.getElapsedTime();
  _badges.forEach(({ mesh, baseY }, i) => {
    // Staggered gentle float: ±0.25 units
    mesh.position.y = baseY + Math.sin(t * 1.6 + i * 1.1) * 0.25;
    // Slow billboard spin (optional subtle pulse)
    mesh.rotation.y = Math.sin(t * 0.4 + i * 0.8) * 0.06;
  });
}

// ── R Badge Sprite ────────────────────────────────────────────────

function _makeRBadge(index) {
  // Draw the badge on a canvas, then use as a sprite texture
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width  = size;
  canvas.height = Math.round(size * 1.2);   // slightly taller for the pointer
  const ctx = canvas.getContext('2d');

  const w = size;
  const h = size;
  const r = 28;   // corner radius

  // Badge body with rounded corners
  ctx.beginPath();
  ctx.moveTo(r, 0);
  ctx.lineTo(w - r, 0);
  ctx.quadraticCurveTo(w, 0, w, r);
  ctx.lineTo(w, h - r);
  ctx.quadraticCurveTo(w, h, w - r, h);
  // Bottom centre pointer
  const midX = w / 2;
  ctx.lineTo(midX + 22, h);
  ctx.lineTo(midX, h + 30);
  ctx.lineTo(midX - 22, h);
  ctx.lineTo(r, h);
  ctx.quadraticCurveTo(0, h, 0, h - r);
  ctx.lineTo(0, r);
  ctx.quadraticCurveTo(0, 0, r, 0);
  ctx.closePath();

  // Golden gradient fill
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0,   '#ffe066');
  grad.addColorStop(0.5, '#f0c030');
  grad.addColorStop(1,   '#c89010');
  ctx.fillStyle = grad;
  ctx.fill();

  // Dark amber border
  ctx.strokeStyle = '#8a6000';
  ctx.lineWidth = 8;
  ctx.stroke();

  // Inner bevel highlight
  ctx.beginPath();
  ctx.moveTo(r + 4, 4);
  ctx.lineTo(w - r - 4, 4);
  ctx.quadraticCurveTo(w - 4, 4, w - 4, r + 4);
  ctx.lineTo(w - 4, h - r - 10);
  ctx.strokeStyle = 'rgba(255,255,200,0.45)';
  ctx.lineWidth = 4;
  ctx.stroke();

  // "R" text
  ctx.font = `bold ${Math.round(size * 0.58)}px 'Inter', Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#2a1800';
  ctx.fillText('R', w / 2 + 2, h / 2 + 4);  // slight shadow offset
  ctx.fillStyle = '#3a2800';
  ctx.fillText('R', w / 2, h / 2);

  const texture  = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;

  // Use a Sprite so it always faces the camera (billboard)
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false,        // always visible above terrain
    sizeAttenuation: true,
  });

  const sprite = new THREE.Sprite(material);
  sprite.scale.set(3.5, 4.2, 1);   // ~3.5 world-units wide
  sprite.renderOrder = 10;
  sprite.name = `r-badge-${index}`;
  return sprite;
}

// ── Vertical pin pole ─────────────────────────────────────────────

function _makePole() {
  const geom = new THREE.CylinderGeometry(0.06, 0.06, 2.5, 6);
  const mat  = new THREE.MeshStandardMaterial({
    color: 0x8a6000,
    roughness: 0.6,
    metalness: 0.3,
    transparent: true,
    opacity: 0.7,
  });
  return new THREE.Mesh(geom, mat);
}

// ── Road name label sprite ────────────────────────────────────────

function _makeRoadLabel(text) {
  const paddingX = 24;
  const paddingY = 14;
  const fontSize = 22;

  // Measure text first
  const tmp = document.createElement('canvas');
  const tmpCtx = tmp.getContext('2d');
  tmpCtx.font = `bold ${fontSize}px 'Inter', Arial, sans-serif`;
  const measured = tmpCtx.measureText(text).width;

  const cw = Math.ceil(measured + paddingX * 2);
  const ch = fontSize + paddingY * 2;

  const canvas = document.createElement('canvas');
  canvas.width  = cw;
  canvas.height = ch;
  const ctx = canvas.getContext('2d');

  // Background pill
  const br = ch / 2;
  ctx.beginPath();
  ctx.moveTo(br, 0);
  ctx.lineTo(cw - br, 0);
  ctx.arc(cw - br, br, br, -Math.PI / 2, Math.PI / 2);
  ctx.lineTo(br, ch);
  ctx.arc(br, br, br, Math.PI / 2, -Math.PI / 2);
  ctx.closePath();
  ctx.fillStyle = 'rgba(240,235,200,0.88)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(100,90,50,0.6)';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Text
  ctx.font = `bold ${fontSize}px 'Inter', Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#2a2510';
  ctx.letterSpacing = '1px';
  ctx.fillText(text, cw / 2, ch / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;

  const mat = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
    sizeAttenuation: true,
  });

  // Scale in world units — proportional to canvas aspect ratio
  const aspect = cw / ch;
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(aspect * 2.5, 2.5, 1);
  sprite.renderOrder = 9;
  sprite.name = `road-label-${text.replace(/\s+/g, '-')}`;
  return sprite;
}
