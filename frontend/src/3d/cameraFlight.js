import * as THREE from 'three';

let isFlying = false;
let flightProgress = 0.0;
const flightSpeed = 0.0007;

// Smooth 3D drone flight curve sweeping across the terrain
const flightSpline = new THREE.CatmullRomCurve3([
  new THREE.Vector3(-45, 28, 45),
  new THREE.Vector3(-15, 18, 30),
  new THREE.Vector3(20, 22, 10),
  new THREE.Vector3(35, 25, -25),
  new THREE.Vector3(0, 32, -40),
  new THREE.Vector3(-35, 26, -10),
  new THREE.Vector3(-45, 28, 45)
]);

export function toggleFlight(camera, controls, onStateChange) {
  isFlying = !isFlying;
  if (controls) {
    controls.enabled = !isFlying;
  }
  if (onStateChange) {
    onStateChange(isFlying);
  }
}

export function updateFlightLoop(camera) {
  if (!isFlying || !camera) return;

  flightProgress = (flightProgress + flightSpeed) % 1.0;
  const currentPos = flightSpline.getPoint(flightProgress);
  const lookAtPos = flightSpline.getPoint((flightProgress + 0.04) % 1.0);

  camera.position.copy(currentPos);
  camera.lookAt(lookAtPos);
}

export function getIsFlying() {
  return isFlying;
}
