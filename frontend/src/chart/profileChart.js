import Chart from 'chart.js/auto';

let profileChart = null;

export function renderElevationProfile(transectData) {
  const canvas = document.getElementById('profileChartCanvas');
  const drawer = document.getElementById('transectDrawer');
  if (!canvas || !drawer) return;

  const ctx = canvas.getContext('2d');
  if (profileChart) {
    profileChart.destroy();
  }

  const profile = transectData.profile || [];
  const labels = profile.map(p => `${Math.round(p.distance_m ?? p.dist_m ?? 0)}m`);
  const dataPoints = profile.map(p => p.elevation_m);

  // Update header stats
  const distEl = document.getElementById('drawer-stat-dist');
  const minEl = document.getElementById('drawer-stat-min');
  const maxEl = document.getElementById('drawer-stat-max');

  if (distEl) distEl.innerText = `${transectData.distance_total_m} m`;
  if (minEl) minEl.innerText = `${transectData.min_elevation_m} m`;
  if (maxEl) maxEl.innerText = `${transectData.max_elevation_m} m`;

  profileChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: 'Elevation (m ASL)',
        data: dataPoints,
        borderColor: '#00F2FE',
        borderWidth: 2,
        backgroundColor: 'rgba(0, 242, 254, 0.15)',
        fill: true,
        tension: 0.25,
        pointRadius: 1,
        pointHoverRadius: 4,
        pointHoverBackgroundColor: '#00FFA3'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        intersect: false,
        mode: 'index'
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(15, 23, 42, 0.9)',
          titleColor: '#94A3B8',
          bodyColor: '#00FFA3',
          borderColor: 'rgba(255, 255, 255, 0.15)',
          borderWidth: 1,
          padding: 8,
          displayColors: false,
          callbacks: {
            label: (ctx) => `Elevation: ${ctx.parsed.y} m ASL`
          }
        }
      },
      scales: {
        x: {
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: { color: '#64748B', maxTicksLimit: 12, font: { family: 'JetBrains Mono', size: 10 } }
        },
        y: {
          grid: { color: 'rgba(255, 255, 255, 0.08)' },
          ticks: { color: '#94A3B8', font: { family: 'JetBrains Mono', size: 10 } }
        }
      }
    }
  });

  drawer.classList.add('open');
}

export function closeTransectDrawer() {
  const drawer = document.getElementById('transectDrawer');
  if (drawer) drawer.classList.remove('open');
}
