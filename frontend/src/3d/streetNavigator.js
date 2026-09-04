import * as THREE from 'three';

let isStreetMode = false;
let cameraRef = null;
let controlsRef = null;
let roadMaskGrid = null; // 2D array or function (x, z) => isWalkable
let gridResolution = 64;
let planeSize = 100;

// Camera Euler angles
let yaw = 0;
let pitch = 0;
const PITCH_LIMIT = Math.PI / 2.2; // ~81 degrees

// Movement & Velocity
const velocity = new THREE.Vector3();
const direction = new THREE.Vector3();
let speed = 0;
const WALK_SPEED = 24.0; // units per second
const SPRINT_MULTIPLIER = 1.8;
const DAMPING = 8.5;
const EYE_HEIGHT = 1.2;

// Key state
const keys = {
  forward: false,
  backward: false,
  left: false,
  right: false,
  sprint: false
};

// Mouse dragging state
let isMouseDown = false;
let previousMousePosition = { x: 0, y: 0 };
let onStateChangeCallback = null;

export function initStreetNavigator(camera, controls, canvas, onStateChange) {
  cameraRef = camera;
  controlsRef = controls;
  onStateChangeCallback = onStateChange;

  // Keyboard events
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);

  // Mouse look events (click and drag to look around streets)
  canvas.addEventListener('mousedown', (e) => {
    if (!isStreetMode) return;
    if (e.button === 0) { // Left click
      isMouseDown = true;
      previousMousePosition = { x: e.clientX, y: e.clientY };
    }
  });

  window.addEventListener('mouseup', () => {
    isMouseDown = false;
  });

  window.addEventListener('mousemove', (e) => {
    if (!isStreetMode || !isMouseDown) return;

    const deltaX = e.clientX - previousMousePosition.x;
    const deltaY = e.clientY - previousMousePosition.y;

    previousMousePosition = { x: e.clientX, y: e.clientY };

    const SENSITIVITY = 0.0028;
    yaw -= deltaX * SENSITIVITY;
    pitch -= deltaY * SENSITIVITY;
    pitch = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, pitch));
  });

  // Touch look for mobile/tablet if needed
  canvas.addEventListener('touchstart', (e) => {
    if (!isStreetMode || e.touches.length === 0) return;
    isMouseDown = true;
    previousMousePosition = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  });

  window.addEventListener('touchend', () => {
    isMouseDown = false;
  });

  window.addEventListener('touchmove', (e) => {
    if (!isStreetMode || !isMouseDown || e.touches.length === 0) return;
    const deltaX = e.touches[0].clientX - previousMousePosition.x;
    const deltaY = e.touches[0].clientY - previousMousePosition.y;
    previousMousePosition = { x: e.touches[0].clientX, y: e.touches[0].clientY };

    const SENSITIVITY = 0.0035;
    yaw -= deltaX * SENSITIVITY;
    pitch -= deltaY * SENSITIVITY;
    pitch = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, pitch));
  });
}

function onKeyDown(e) {
  if (e.code === 'Escape' && isStreetMode) {
    disableStreetMode();
    return;
  }

  if (!isStreetMode) return;

  switch (e.code) {
    case 'KeyW':
    case 'ArrowUp':
      keys.forward = true;
      break;
    case 'KeyS':
    case 'ArrowDown':
      keys.backward = true;
      break;
    case 'KeyA':
    case 'ArrowLeft':
      keys.left = true;
      break;
    case 'KeyD':
    case 'ArrowRight':
      keys.right = true;
      break;
    case 'ShiftLeft':
    case 'ShiftRight':
      keys.sprint = true;
      break;
  }
}

function onKeyUp(e) {
  switch (e.code) {
    case 'KeyW':
    case 'ArrowUp':
      keys.forward = false;
      break;
    case 'KeyS':
    case 'ArrowDown':
      keys.backward = false;
      break;
    case 'KeyA':
    case 'ArrowLeft':
      keys.left = false;
      break;
    case 'KeyD':
    case 'ArrowRight':
      keys.right = false;
      break;
    case 'ShiftLeft':
    case 'ShiftRight':
      keys.sprint = false;
      break;
  }
}

export function setRoadMask(maskArray, resolution = 64, size = 100) {
  roadMaskGrid = maskArray;
  gridResolution = resolution;
  planeSize = size;
}

export function isRoadWalkable(worldX, worldZ) {
  if (!roadMaskGrid) return true;

  const halfSize = planeSize / 2;
  const gx = Math.floor(((worldX + halfSize) / planeSize) * gridResolution);
  const gz = Math.floor(((worldZ + halfSize) / planeSize) * gridResolution);

  if (gx < 0 || gx >= gridResolution || gz < 0 || gz >= gridResolution) {
    return false; // Boundary limit
  }

  const idx = gz * gridResolution + gx;
  return roadMaskGrid[idx] === 1; // 1 = road/walkable, 0 = building
}

export function findInitialRoadPosition() {
  if (!roadMaskGrid) return new THREE.Vector3(0, EYE_HEIGHT, 0);

  // Search near center for a true road coordinate
  const halfSize = planeSize / 2;
  const centerG = Math.floor(gridResolution / 2);

  for (let radius = 0; radius < gridResolution / 2; radius++) {
    for (let dx = -radius; dx <= radius; dx++) {
      for (let dz = -radius; dz <= radius; dz++) {
        const gx = centerG + dx;
        const gz = centerG + dz;
        if (gx >= 0 && gx < gridResolution && gz >= 0 && gz < gridResolution) {
          if (roadMaskGrid[gz * gridResolution + gx] === 1) {
            const wx = (gx / gridResolution) * planeSize - halfSize;
            const wz = (gz / gridResolution) * planeSize - halfSize;
            return new THREE.Vector3(wx, EYE_HEIGHT, wz);
          }
        }
      }
    }
  }

  return new THREE.Vector3(0, EYE_HEIGHT, 0);
}

export function enableStreetMode() {
  if (!cameraRef) return;
  isStreetMode = true;

  if (controlsRef) {
    controlsRef.enabled = false; // Disable orbit controls in street mode
  }

  // Find a clear road intersection to spawn
  const spawnPos = findInitialRoadPosition();
  cameraRef.position.set(spawnPos.x, EYE_HEIGHT, spawnPos.z);

  // Look toward north down the street corridor
  yaw = 0;
  pitch = 0;

  keys.forward = false;
  keys.backward = false;
  keys.left = false;
  keys.right = false;
  keys.sprint = false;
  velocity.set(0, 0, 0);

  if (onStateChangeCallback) {
    onStateChangeCallback(true);
  }
}

export function disableStreetMode() {
  if (!cameraRef) return;
  isStreetMode = false;

  // Restore orbit controls
  if (controlsRef) {
    controlsRef.enabled = true;
    controlsRef.target.set(0, 0, 0);
    cameraRef.position.set(0, 58, 62);
    controlsRef.update();
  }

  keys.forward = false;
  keys.backward = false;
  keys.left = false;
  keys.right = false;
  keys.sprint = false;
  velocity.set(0, 0, 0);

  if (onStateChangeCallback) {
    onStateChangeCallback(false);
  }
}

export function toggleStreetMode() {
  if (isStreetMode) {
    disableStreetMode();
  } else {
    enableStreetMode();
  }
  return isStreetMode;
}

export function updateStreetNavigator(delta) {
  if (!isStreetMode || !cameraRef) return;

  const dt = Math.min(delta, 0.1);

  // Calculate forward and right vectors based on yaw
  const forward = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
  const right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));

  // Compute input direction
  direction.set(0, 0, 0);
  if (keys.forward) direction.add(forward);
  if (keys.backward) direction.sub(forward);
  if (keys.right) direction.add(right);
  if (keys.left) direction.sub(right);

  if (direction.lengthSq() > 0) {
    direction.normalize();
  }

  // Apply acceleration
  const currentSpeedTarget = keys.sprint ? WALK_SPEED * SPRINT_MULTIPLIER : WALK_SPEED;
  velocity.x += direction.x * currentSpeedTarget * dt * 8.0;
  velocity.z += direction.z * currentSpeedTarget * dt * 8.0;

  // Apply friction damping
  velocity.x -= velocity.x * DAMPING * dt;
  velocity.z -= velocity.z * DAMPING * dt;

  speed = Math.hypot(velocity.x, velocity.z);

  // Proposed new position
  const nextX = cameraRef.position.x + velocity.x * dt;
  const nextZ = cameraRef.position.z + velocity.z * dt;

  // Collision handling: check X movement
  if (isRoadWalkable(nextX, cameraRef.position.z)) {
    cameraRef.position.x = nextX;
  } else {
    velocity.x = 0; // stop against wall
  }

  // Check Z movement
  if (isRoadWalkable(cameraRef.position.x, nextZ)) {
    cameraRef.position.z = nextZ;
  } else {
    velocity.z = 0; // stop against wall
  }

  // Clamp camera height strictly to road eye level
  cameraRef.position.y = EYE_HEIGHT;

  // Apply camera rotation: yaw (heading) + pitch (elevation look)
  const targetLook = new THREE.Vector3(
    cameraRef.position.x - Math.sin(yaw) * Math.cos(pitch),
    cameraRef.position.y + Math.sin(pitch),
    cameraRef.position.z - Math.cos(yaw) * Math.cos(pitch)
  );

  cameraRef.lookAt(targetLook);
}

export function getIsStreetMode() {
  return isStreetMode;
}

export function getStreetTelemetry() {
  if (!cameraRef) return { speedKmH: 0, x: 0, z: 0 };
  return {
    speedKmH: Math.round(speed * 3.6),
    x: Math.round(cameraRef.position.x * 10) / 10,
    z: Math.round(cameraRef.position.z * 10) / 10
  };
}
