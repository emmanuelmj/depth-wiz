import * as THREE from 'three';

let isStreetMode = false;
let isPointerLocked = false;
let cameraRef = null;
let controlsRef = null;
let canvasRef = null;

// Camera Euler angles
let yaw = 0;
let pitch = 0;
const PITCH_LIMIT = Math.PI / 2.15; // ~83 degrees (can look almost straight up at high-rises)

// Movement & Velocity
const velocity = new THREE.Vector3();
const direction = new THREE.Vector3();
let speed = 0;
const WALK_SPEED = 22.0; // units per second
const SPRINT_MULTIPLIER = 1.8;
const DAMPING = 8.0;
let streetElevation = 1.8; // Default eye height above street

// Key state
const keys = {
  forward: false,
  backward: false,
  left: false,
  right: false,
  sprint: false
};

let onStateChangeCallback = null;

let roadMaskGrid = null;
let gridResolution = 64;
let planeSize = 100;

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
  if (!roadMaskGrid) return new THREE.Vector3(0, streetElevation, 0);

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
            return new THREE.Vector3(wx, streetElevation, wz);
          }
        }
      }
    }
  }

  return new THREE.Vector3(0, streetElevation, 0);
}

export function initStreetNavigator(camera, controls, canvas, onStateChange) {
  cameraRef = camera;
  controlsRef = controls;
  canvasRef = canvas;
  onStateChangeCallback = onStateChange;

  // Keyboard events
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);

  // Click strictly on the right-side canvas to lock mouse pointer in Street mode
  canvas.addEventListener('click', () => {
    if (isStreetMode && !isPointerLocked) {
      canvas.requestPointerLock();
    }
  });

  // Pointer lock change listener (handles Esc natively)
  document.addEventListener('pointerlockchange', () => {
    isPointerLocked = (document.pointerLockElement === canvas);

    const lockHint = document.getElementById('lock-hint-text');
    const lockStatus = document.getElementById('street-lock-status');
    const reticle = document.getElementById('street-reticle');

    if (isPointerLocked) {
      if (lockHint) lockHint.innerText = 'Mouse Look Active · Esc to Unlock';
      if (lockStatus) {
        lockStatus.classList.remove('unlocked');
        lockStatus.classList.add('locked');
        const icon = lockStatus.querySelector('.lock-icon');
        if (icon) icon.innerText = '🔒';
      }
      if (reticle) reticle.style.display = 'block';
    } else {
      if (lockHint) lockHint.innerText = 'Click 3D view to lock cursor & look';
      if (lockStatus) {
        lockStatus.classList.remove('locked');
        lockStatus.classList.add('unlocked');
        const icon = lockStatus.querySelector('.lock-icon');
        if (icon) icon.innerText = '🔓';
      }
      if (reticle) reticle.style.display = 'none';
    }
  });

  // Mouse move event for FPS pointer look
  window.addEventListener('mousemove', (e) => {
    if (!isStreetMode) return;

    // Only rotate camera when pointer is locked strictly inside the 3D viewport canvas
    if (isPointerLocked) {
      const movementX = e.movementX || 0;
      const movementY = e.movementY || 0;

      const SENSITIVITY = 0.0022;
      yaw -= movementX * SENSITIVITY;
      pitch -= movementY * SENSITIVITY;
      pitch = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, pitch));
    }
  });
}

function onKeyDown(e) {
  if (e.code === 'Escape' && isStreetMode) {
    if (isPointerLocked) {
      if (document.exitPointerLock) {
        document.exitPointerLock();
      }
      // Do not exit street mode on first Esc: just unlock cursor
    } else {
      // If cursor is already unlocked, pressing Esc exits Street mode back to Orbit
      disableStreetMode();
    }
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

export function enableStreetMode() {
  if (!cameraRef) return;
  isStreetMode = true;

  if (controlsRef) {
    controlsRef.enabled = false;
  }

  // Spawn on a main central street avenue
  const spawnPos = findInitialRoadPosition();
  cameraRef.position.set(spawnPos.x, streetElevation, spawnPos.z);

  // Look forward north down the street corridor
  yaw = 0;
  pitch = 0;

  keys.forward = false;
  keys.backward = false;
  keys.left = false;
  keys.right = false;
  keys.sprint = false;
  velocity.set(0, 0, 0);

  // Reset lock indicator state (cursor stays free until clicking inside the right-side 3D canvas)
  const lockHint = document.getElementById('lock-hint-text');
  const lockStatus = document.getElementById('street-lock-status');
  const reticle = document.getElementById('street-reticle');
  if (lockHint) lockHint.innerText = 'Click 3D view to lock cursor & look';
  if (lockStatus) {
    lockStatus.classList.remove('locked');
    lockStatus.classList.add('unlocked');
    const icon = lockStatus.querySelector('.lock-icon');
    if (icon) icon.innerText = '🔓';
  }
  if (reticle) reticle.style.display = 'none';

  if (onStateChangeCallback) {
    onStateChangeCallback(true);
  }
}

export function disableStreetMode() {
  if (!cameraRef) return;
  isStreetMode = false;

  if (document.pointerLockElement) {
    document.exitPointerLock();
  }

  const reticle = document.getElementById('street-reticle');
  if (reticle) reticle.style.display = 'none';

  const lockHint = document.getElementById('lock-hint-text');
  const lockStatus = document.getElementById('street-lock-status');
  if (lockHint) lockHint.innerText = 'Click 3D view to lock cursor & look';
  if (lockStatus) {
    lockStatus.classList.remove('locked');
    lockStatus.classList.add('unlocked');
    const icon = lockStatus.querySelector('.lock-icon');
    if (icon) icon.innerText = '🔓';
  }

  // Restore OrbitControls to clean aerial satellite view
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

  // Calculate forward and right vectors based on current yaw heading
  const forward = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
  const right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));

  // Compute input direction from WASD
  direction.set(0, 0, 0);
  if (keys.forward) direction.add(forward);
  if (keys.backward) direction.sub(forward);
  if (keys.right) direction.add(right);
  if (keys.left) direction.sub(right);

  if (direction.lengthSq() > 0) {
    direction.normalize();
  }

  // Acceleration and damping
  const currentSpeedTarget = keys.sprint ? WALK_SPEED * SPRINT_MULTIPLIER : WALK_SPEED;
  velocity.x += direction.x * currentSpeedTarget * dt * 8.0;
  velocity.z += direction.z * currentSpeedTarget * dt * 8.0;

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
  cameraRef.position.y = streetElevation;

  // Apply FPS camera look target based on yaw and pitch
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
  if (!cameraRef) return { speedKmH: 0, isLocked: false };
  return {
    speedKmH: Math.round(speed * 3.6),
    isLocked: isPointerLocked
  };
}
