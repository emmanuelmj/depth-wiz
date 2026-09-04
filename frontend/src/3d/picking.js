import * as THREE from 'three';

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

export function pickTerrainPixel(event, camera, terrainMesh, canvas) {
  if (!terrainMesh || !camera || !canvas) return null;

  const rect = canvas.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObject(terrainMesh);

  if (intersects.length > 0 && intersects[0].uv) {
    const uv = intersects[0].uv;
    // Map UV coordinates (origin bottom-left) to raster pixel coordinates (origin top-left)
    const pixel_x = Math.floor(THREE.MathUtils.clamp(uv.x * 1024, 0, 1023));
    const pixel_y = Math.floor(THREE.MathUtils.clamp((1.0 - uv.y) * 1024, 0, 1023));

    return {
      point: intersects[0].point,
      uv: { u: uv.x, v: uv.y },
      pixel: { x: pixel_x, y: pixel_y }
    };
  }

  return null;
}
