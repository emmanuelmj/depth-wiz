import * as THREE from 'three';

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

export function pickTerrainPixel(event, camera, targets, canvas) {
  if (!targets || !camera || !canvas) return null;

  const rect = canvas.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);
  const targetList = Array.isArray(targets) ? targets.filter(Boolean) : [targets];
  const intersects = raycaster.intersectObjects(targetList, false);

  if (intersects.length > 0) {
    const hit = intersects[0];
    let px, py;

    if (hit.uv) {
      px = Math.floor(THREE.MathUtils.clamp(hit.uv.x * 1024, 0, 1023));
      py = Math.floor(THREE.MathUtils.clamp((1.0 - hit.uv.y) * 1024, 0, 1023));
    } else {
      // Direct world coordinate projection for 100x100 plane [-50, 50]
      px = Math.floor(THREE.MathUtils.clamp(((hit.point.x + 50) / 100.0) * 1024, 0, 1023));
      py = Math.floor(THREE.MathUtils.clamp(((hit.point.z + 50) / 100.0) * 1024, 0, 1023));
    }

    return {
      point: hit.point,
      uv: hit.uv || { u: (hit.point.x + 50) / 100, v: (hit.point.z + 50) / 100 },
      pixel: { x: px, y: py }
    };
  }

  return null;
}
