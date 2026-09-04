export function showInspectorBadge(data) {
  const badge = document.getElementById('inspector-badge');
  if (!badge) return;

  const lat = data.coordinates?.latitude?.toFixed(5) || '—';
  const lon = data.coordinates?.longitude?.toFixed(5) || '—';
  const elev = data.metrics?.absolute_elevation_m !== undefined ? `${data.metrics.absolute_elevation_m} m` : '—';
  const agl = data.metrics?.height_above_ground_m !== undefined ? `${data.metrics.height_above_ground_m} m` : '—';
  const slope = data.metrics?.slope_degrees !== undefined ? `${data.metrics.slope_degrees}°` : '—';
  const pixel = `(${data.pixel?.x}, ${data.pixel?.y})`;

  badge.innerHTML = `
    <div class="inspector-title">
      <span>📍 Point Inspection</span>
      <span class="inspector-close" id="inspector-close-btn">&times;</span>
    </div>
    <div class="inspector-grid">
      <div>
        <div class="inspector-metric-label">Elevation (ASL)</div>
        <div class="inspector-metric-value val-cyan">${elev}</div>
      </div>
      <div>
        <div class="inspector-metric-label">Height (AGL)</div>
        <div class="inspector-metric-value val-emerald">${agl}</div>
      </div>
      <div>
        <div class="inspector-metric-label">Coordinates</div>
        <div class="inspector-metric-value">${lat}, ${lon}</div>
      </div>
      <div>
        <div class="inspector-metric-label">Pixel (X, Y)</div>
        <div class="inspector-metric-value">${pixel}</div>
      </div>
      <div>
        <div class="inspector-metric-label">Slope</div>
        <div class="inspector-metric-value" style="color: #F59E0B;">${slope}</div>
      </div>
    </div>
  `;

  badge.classList.add('visible');

  const closeBtn = document.getElementById('inspector-close-btn');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      badge.classList.remove('visible');
    });
  }
}

export function hideInspectorBadge() {
  const badge = document.getElementById('inspector-badge');
  if (badge) badge.classList.remove('visible');
}
