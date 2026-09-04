import * as THREE from 'three';

// ─── STATE ────────────────────────────────────────────────────────────────────
let flying   = false;
let yawDeg   = 0;   // horizontal heading in degrees
let pitchDeg = -18; // looking slightly downward (drone tilt)
let prevTime = performance.now();

// Held keys
const KEYS = new Set();

// ─── KEY LISTENERS ────────────────────────────────────────────────────────────
function onKeyDown(e) {
  KEYS.add(e.code);
  // Prevent page scroll for arrow keys only when flying
  if (flying && ['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)) {
    e.preventDefault();
  }
}
function onKeyUp(e) { KEYS.delete(e.code); }

// ─── PUBLIC API ───────────────────────────────────────────────────────────────
export function toggleFlight(camera, controls, onStateChange) {
  flying = !flying;

  if (flying) {
    // Derive initial yaw from current camera look direction
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    yawDeg   = THREE.MathUtils.radToDeg(Math.atan2(-dir.x, -dir.z));
    pitchDeg = -18;
    prevTime = performance.now();

    controls.enabled = false;
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup',   onKeyUp);

    // Show control hint
    const hint = document.getElementById('flight-hint');
    if (hint) hint.style.display = 'flex';

  } else {
    controls.enabled = true;
    KEYS.clear();
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup',   onKeyUp);

    // Restore camera up & hide hint
    camera.up.set(0, 1, 0);
    camera.rotation.order = 'XYZ';
    const hint = document.getElementById('flight-hint');
    if (hint) hint.style.display = 'none';
  }

  if (onStateChange) onStateChange(flying);
}

export function getIsFlying() { return flying; }

// ─── PER-FRAME UPDATE (called from renderLoop) ────────────────────────────────
export function updateFlightLoop(camera) {
  if (!flying) return;

  const now   = performance.now();
  const delta = Math.min((now - prevTime) / 1000, 0.05); // cap at 50 ms
  prevTime = now;

  const MOVE_SPD = 22;  // units / second forward/back
  const YAW_SPD  = 75;  // degrees / second rotation
  const ALT_SPD  = 14;  // units / second up/down

  // ── Rotation (yaw) ──────────────────────────────────────────────────────────
  if (KEYS.has('ArrowLeft'))  yawDeg = (yawDeg + YAW_SPD  * delta) % 360;
  if (KEYS.has('ArrowRight')) yawDeg = (yawDeg - YAW_SPD  * delta + 360) % 360;

  // Optional pitch look with Q / E
  if (KEYS.has('KeyQ')) pitchDeg = Math.min(pitchDeg + 40 * delta,  35);
  if (KEYS.has('KeyE')) pitchDeg = Math.max(pitchDeg - 40 * delta, -70);

  // ── Apply rotation to camera (YXZ Euler = FPS-style) ───────────────────────
  camera.rotation.order = 'YXZ';
  camera.rotation.y = THREE.MathUtils.degToRad(yawDeg);
  camera.rotation.x = THREE.MathUtils.degToRad(pitchDeg);
  camera.rotation.z = 0;

  // ── Movement vectors (horizontal plane) ─────────────────────────────────────
  const yR = THREE.MathUtils.degToRad(yawDeg);
  const fwd = new THREE.Vector3(-Math.sin(yR), 0, -Math.cos(yR));  // forward
  // right = fwd × up
  const right = new THREE.Vector3(Math.cos(yR), 0, -Math.sin(yR));

  if (KEYS.has('ArrowUp'))   camera.position.addScaledVector(fwd,   MOVE_SPD * delta);
  if (KEYS.has('ArrowDown')) camera.position.addScaledVector(fwd,  -MOVE_SPD * delta);

  // ── Altitude  (Space = ascend, Ctrl = descend; also Shift+Arrow Up/Down) ────
  const goUp   = KEYS.has('Space') || (KEYS.has('ShiftLeft') && KEYS.has('ArrowUp'));
  const goDown = KEYS.has('ControlLeft') || KEYS.has('ControlRight') ||
                 (KEYS.has('ShiftLeft') && KEYS.has('ArrowDown'));

  if (goUp)   camera.position.y += ALT_SPD * delta;
  if (goDown) camera.position.y -= ALT_SPD * delta;

  // ── Safety clamp ─────────────────────────────────────────────────────────────
  camera.position.y = Math.max(2, Math.min(200, camera.position.y));
}
