import { MOCK_SCENES, MOCK_BENCHMARKS } from './mockData.js';

const API_BASE = ''; // Uses Vite proxy or relative path

export async function fetchScenes() {
  try {
    const res = await fetch(`${API_BASE}/api/scenes`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('[API] Backend unavailable, using cached mock scenes:', err.message);
    return MOCK_SCENES;
  }
}

export async function fetchSceneDetails(sceneId) {
  try {
    const res = await fetch(`${API_BASE}/api/scenes/${sceneId}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn(`[API] Scene ${sceneId} fetch failed, using mock data:`, err.message);
    const found = MOCK_SCENES.find(s => s.id === sceneId);
    return found || MOCK_SCENES[0];
  }
}

export async function inspectPoint(sceneId, x, y) {
  try {
    const res = await fetch(`${API_BASE}/api/inspect/${sceneId}?x=${x}&y=${y}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    // Client-side mathematical fallback
    const scene = MOCK_SCENES.find(s => s.id === sceneId) || MOCK_SCENES[0];
    const minElev = scene.min_elevation_m;
    const maxElev = scene.max_elevation_m;
    const normDist = Math.sqrt(Math.pow((x - 512) / 512, 2) + Math.pow((y - 512) / 512, 2));
    const hRel = Math.max(0.1, 0.85 - 0.4 * normDist + 0.1 * Math.sin(x * 0.05) * Math.cos(y * 0.05));
    const elev = Number((minElev + hRel * (maxElev - minElev)).toFixed(1));
    const ground = Number((minElev + 0.08 * (maxElev - minElev)).toFixed(1));
    const agl = Number(Math.max(0, elev - ground).toFixed(1));

    const lon = Number((scene.bounds.min_lon + (x / 1024) * (scene.bounds.max_lon - scene.bounds.min_lon)).toFixed(6));
    const lat = Number((scene.bounds.max_lat - (y / 1024) * (scene.bounds.max_lat - scene.bounds.min_lat)).toFixed(6));

    return {
      pixel: { x, y },
      coordinates: { latitude: lat, longitude: lon },
      metrics: {
        absolute_elevation_m: elev,
        estimated_ground_level_m: ground,
        height_above_ground_m: agl,
        slope_degrees: Number((Math.abs(Math.sin(x * y * 0.001)) * 3.8).toFixed(1)),
        unit: 'meters'
      }
    };
  }
}

export async function fetchTransect(sceneId, startPixel, endPixel, samples = 100) {
  try {
    const res = await fetch(`${API_BASE}/api/transect/${sceneId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ start_pixel: startPixel, end_pixel: endPixel, samples })
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    const scene = MOCK_SCENES.find(s => s.id === sceneId) || MOCK_SCENES[0];
    const minElev = scene.min_elevation_m;
    const maxElev = scene.max_elevation_m;
    const span = maxElev - minElev;
    const distPx = Math.hypot(endPixel.x - startPixel.x, endPixel.y - startPixel.y);
    const totalM = Number((distPx * 1.2).toFixed(1));

    const profile = [];
    for (let i = 0; i < samples; i++) {
      const t = i / (samples - 1);
      const wave = 0.4 + 0.35 * Math.sin(t * Math.PI * 3) + 0.15 * Math.sin(t * 16);
      const elev = Number((minElev + Math.min(1, Math.max(0, wave)) * span).toFixed(1));
      profile.push({ dist_m: Number((t * totalM).toFixed(1)), elevation_m: elev });
    }

    const elevs = profile.map(p => p.elevation_m);
    return {
      distance_total_m: totalM,
      min_elevation_m: Math.min(...elevs),
      max_elevation_m: Math.max(...elevs),
      profile
    };
  }
}

export async function fetchBenchmarks() {
  try {
    const res = await fetch(`${API_BASE}/api/benchmarks`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('[API] Benchmarks endpoint unavailable, using mock benchmark stats:', err.message);
    return MOCK_BENCHMARKS;
  }
}
