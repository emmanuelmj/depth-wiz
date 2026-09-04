import { setTerrainLayer } from '../3d/terrain.js';

export function setupLayerControls() {
  const buttons = document.querySelectorAll('.layer-btn');
  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      buttons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const mode = btn.getAttribute('data-mode');
      setTerrainLayer(mode);
    });
  });
}
