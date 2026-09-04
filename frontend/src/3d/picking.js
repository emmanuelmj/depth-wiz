import * as THREE from 'three';

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

export function pickTerrainPixel(event, camera, terrainMesh, canvas) {
  if (!terrainMesh || !camera || !canvas) return null;

  const rect = canvas.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObject(terrainMesh, true);

  if (intersects.length > 0) {
    const pt = intersects[0].point;
    // Map world coordinates (-50 to 50) to UV (0 to 1)
    const u = THREE.MathUtils.clamp((pt.x + 50) / 100, 0, 1);
    const v = THREE.MathUtils.clamp((pt.z + 50) / 100, 0, 1); // Z is inverted relative to standard Y up

    // Assuming 1024x1024 base image for inspection coordinates
    const pixel_x = Math.floor(u * 1023);
    const pixel_y = Math.floor(v * 1023);

    return {
      point: pt,
      uv: { u, v },
      pixel: { x: pixel_x, y: pixel_y }
    };
  }

  return null;
}
