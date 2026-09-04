export function renderPresets(container, scenes, activeSceneId, onSelectScene) {
  container.innerHTML = '';
  const icons = { urban: '🏙️', sparse: '🌾', mountain: '⛰️', forest: '🌲' };

  scenes.forEach(scene => {
    const card = document.createElement('div');
    card.className = `preset-card ${scene.id === activeSceneId ? 'active' : ''}`;
    card.setAttribute('data-id', scene.id);

    const icon = icons[scene.landscape_type] || '🛰️';
    const accuracy = scene.elevation_stats?.accuracy_percentage || 90;

    card.innerHTML = `
      <div class="preset-icon">${icon}</div>
      <div class="preset-info">
        <div class="preset-name">${scene.name}</div>
        <div class="preset-sub">${scene.min_elevation_m}m – ${scene.max_elevation_m}m · ${scene.landscape_type.toUpperCase()}</div>
        <div class="accuracy-track" title="Accuracy: ${accuracy}%">
          <div class="accuracy-fill" style="width: ${accuracy}%"></div>
        </div>
      </div>
    `;

    card.addEventListener('click', () => {
      document.querySelectorAll('.preset-card').forEach(c => c.classList.remove('active'));
      card.classList.add('active');
      if (onSelectScene) onSelectScene(scene.id);
    });

    container.appendChild(card);
  });
}
