/**
 * cityBuilderHUD.js  (v2 — Three.js integrated)
 * ──────────────────────────────────────────────────────────────────
 * Manages ONLY the HTML game-toolbar that overlays the 3D scene.
 *
 * The actual 3D content (floating R badges, road labels, animated
 * bobbing sprites) lives in  3d/cityBuilderObjects.js  and is
 * driven from the main Three.js render loop.
 *
 * HUD elements (no population counter):
 *   • Budget bar  $$/$$$$ with animated meter
 *   • Tool buttons: Build Road / Place Tree / Zone
 *   • "2D City View" mode badge label
 *   • Minimap with compass rose  (bottom-left)
 * ──────────────────────────────────────────────────────────────────
 */

let _active     = false;
let _activeTool = 'zone';
let _minimapImg = null;

// ── Public API ────────────────────────────────────────────────────

export function showCityBuilderHUD(imageUrl) {
  _minimapImg = imageUrl;
  _activeTool = 'zone';
  _active     = true;

  _buildDOM();

  const hud = document.getElementById('city-builder-hud');
  if (hud) hud.classList.add('cb-active');
}

export function hideCityBuilderHUD() {
  if (!_active) return;
  _active = false;

  const hud = document.getElementById('city-builder-hud');
  if (hud) {
    hud.classList.remove('cb-active');
    hud.innerHTML = '';
  }
}

export function isCityBuilderActive() { return _active; }

// ── DOM Construction ─────────────────────────────────────────────

function _buildDOM() {
  const hud = document.getElementById('city-builder-hud');
  if (!hud) return;
  hud.innerHTML = '';

  // Only the minimap (bottom-left) — no top bar, no labels
  hud.appendChild(_buildMinimap());
}

// ── Top Bar ───────────────────────────────────────────────────────

function _buildTopBar() {
  const bar = document.createElement('div');
  bar.id = 'cb-top-bar';

  // Left: home icon
  const homeBtn = document.createElement('div');
  homeBtn.className = 'cb-home-btn';
  homeBtn.title = 'Home';
  homeBtn.innerHTML = '🏠';
  bar.appendChild(homeBtn);

  // Centre: budget meter
  const budgetArea = document.createElement('div');
  budgetArea.id = 'cb-budget-area';

  budgetArea.innerHTML = `
    <span class="cb-budget-label">BUDGET</span>
    <div class="cb-budget-meter">
      <div class="cb-budget-fill"></div>
    </div>
    <span class="cb-budget-text">$$ / $$$$</span>
  `;
  bar.appendChild(budgetArea);

  // Right: tool buttons
  const tools = document.createElement('div');
  tools.id = 'cb-tools';

  [
    { id: 'road', icon: '🛣️',  label: 'Build Road'  },
    { id: 'tree', icon: '🌳',  label: 'Place Tree'  },
    { id: 'zone', icon: '🗺️', label: 'Zone'        },
  ].forEach(t => {
    const btn = document.createElement('div');
    btn.className = 'cb-tool-btn' + (t.id === _activeTool ? ' cb-active-tool' : '');
    btn.dataset.tool = t.id;
    btn.innerHTML = `<span class="cb-tool-icon">${t.icon}</span><span class="cb-tool-label">${t.label}</span>`;
    btn.addEventListener('click', () => _selectTool(t.id));
    tools.appendChild(btn);
  });

  bar.appendChild(tools);
  return bar;
}

// ── Minimap ───────────────────────────────────────────────────────

function _buildMinimap() {
  const mm = document.createElement('div');
  mm.id = 'cb-minimap';

  // Thumbnail image
  if (_minimapImg) {
    const mmImg = document.createElement('img');
    mmImg.id  = 'cb-minimap-img';
    mmImg.src = _minimapImg;
    mmImg.alt = 'minimap';
    mmImg.draggable = false;
    mm.appendChild(mmImg);
  }

  // Schematic SVG road overlay
  const overlay = document.createElement('div');
  overlay.id = 'cb-minimap-overlay';
  overlay.innerHTML = `
    <svg width="100%" height="100%" viewBox="0 0 180 180" xmlns="http://www.w3.org/2000/svg"
         style="position:absolute;inset:0;opacity:0.6;">
      <!-- Oakland Blvd diagonal -->
      <line x1="0" y1="95" x2="180" y2="50" stroke="#d4cca0" stroke-width="3.5"/>
      <!-- Sycamore Crescent top arc -->
      <path d="M 35 105 Q 90 70 155 85" stroke="#d4cca0" stroke-width="2.5" fill="none"/>
      <!-- Sycamore Crescent bottom arc -->
      <path d="M 30 145 Q 90 125 160 145" stroke="#d4cca0" stroke-width="2.5" fill="none"/>
      <!-- Left fork road -->
      <line x1="0" y1="130" x2="45" y2="155" stroke="#d4cca0" stroke-width="2"/>
      <!-- R badge dots on minimap -->
      <circle cx="92" cy="80" r="5" fill="#f0c030" stroke="#8a6000" stroke-width="1.5"/>
      <circle cx="115" cy="74" r="5" fill="#f0c030" stroke="#8a6000" stroke-width="1.5"/>
      <circle cx="135" cy="72" r="5" fill="#f0c030" stroke="#8a6000" stroke-width="1.5"/>
      <circle cx="144" cy="78" r="5" fill="#f0c030" stroke="#8a6000" stroke-width="1.5"/>
    </svg>
  `;
  mm.appendChild(overlay);

  // Compass rose
  mm.innerHTML += `
    <div id="cb-compass">
      <div class="cb-compass-ring">
        <div class="cb-compass-n"></div>
        <div class="cb-compass-s"></div>
        <span class="cb-compass-label">N</span>
      </div>
    </div>
  `;

  return mm;
}

// ── Tool selection ────────────────────────────────────────────────

function _selectTool(toolId) {
  _activeTool = toolId;
  document.querySelectorAll('.cb-tool-btn').forEach(btn => {
    btn.classList.toggle('cb-active-tool', btn.dataset.tool === toolId);
  });
}
