/**
 * GhostPrompter Content Script
 * Injects and manages the stealth Heads-Up Display (HUD) inside an isolated Shadow DOM.
 * Works seamlessly in both Manual and Auto/Dual tracking modes.
 */

(function () {
  // Prevent duplicate injection
  if (window.__GHOST_PROMPTER_INITIALIZED__) {
    // If already initialized, trigger toggle on re-execution
    if (window.GhostPrompter && window.GhostPrompter.toggle) {
      window.GhostPrompter.toggle();
    }
    return;
  }
  window.__GHOST_PROMPTER_INITIALIZED__ = true;

  let hostEl = null;
  let shadowRoot = null;
  let windowEl = null;
  let viewportEl = null;
  let scriptBodyEl = null;
  let isPlaying = false;
  let isGhostMode = false;
  let isMirrorMode = false;
  let currentSettings = null;
  let currentScript = null;
  let idleTimer = null;
  let scrollAnimFrame = null;
  let scrollVelocity = 0; // pixels per frame

  // Default fallback settings
  const defaultState = {
    opacity: 0.78,
    fontSize: 22,
    textColor: '#00F0FF',
    lineHeight: 1.6,
    wpm: 130,
    trackingMode: 'dual',
    window: { x: null, y: 30, width: 620, height: 260 }
  };

  /**
   * Complete embedded stylesheet (guarantees 100% styled rendering even on strict CSP sites)
   */
  const EMBEDDED_STYLES = `
    :host {
      all: initial;
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 2147483647;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      box-sizing: border-box;
    }
    *, *::before, *::after {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      user-select: none;
    }
    .gp-window {
      position: fixed;
      display: flex;
      flex-direction: column;
      border-radius: 14px;
      overflow: hidden;
      box-shadow: 0 12px 40px rgba(0, 0, 0, 0.75), 0 0 0 1px rgba(0, 240, 255, 0.3);
      transition: box-shadow 0.25s ease, opacity 0.2s ease;
      pointer-events: auto;
      backdrop-filter: blur(14px);
      -webkit-backdrop-filter: blur(14px);
      background: rgba(10, 12, 20, 0.85);
    }
    .gp-window.gp-ghost-mode {
      pointer-events: none !important;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(0, 240, 255, 0.15) !important;
    }
    .gp-window.gp-ghost-mode .gp-ghost-pill {
      pointer-events: auto !important;
    }
    .gp-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 6px 12px;
      background: rgba(10, 14, 26, 0.92);
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      cursor: grab;
      height: 38px;
      transition: background 0.2s ease, opacity 0.3s ease;
    }
    .gp-header:active {
      cursor: grabbing;
    }
    .gp-brand {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .gp-logo-icon {
      width: 18px;
      height: 18px;
      fill: #00F0FF;
      filter: drop-shadow(0 0 6px rgba(0, 240, 255, 0.6));
    }
    .gp-title {
      font-size: 13px;
      font-weight: 700;
      letter-spacing: 0.5px;
      color: #FFFFFF;
      text-shadow: 0 1px 2px rgba(0, 0, 0, 0.8);
    }
    .gp-status-group {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-left: 6px;
    }
    .gp-badge {
      font-size: 10px;
      font-weight: 700;
      padding: 2px 6px;
      border-radius: 5px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      background: rgba(0, 240, 255, 0.15);
      color: #00F0FF;
      border: 1px solid rgba(0, 240, 255, 0.3);
    }
    .gp-indicator {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 10px;
      color: #8E9BAE;
    }
    .gp-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #4A5568;
      transition: all 0.2s ease;
    }
    .gp-dot.active-green {
      background: #00FF88;
      box-shadow: 0 0 8px #00FF88;
    }
    .gp-dot.active-cyan {
      background: #00F0FF;
      box-shadow: 0 0 8px #00F0FF;
    }
    .gp-dot.active-amber {
      background: #FFB703;
      box-shadow: 0 0 8px #FFB703;
    }
    .gp-actions {
      display: flex;
      align-items: center;
      gap: 4px;
    }
    .gp-btn {
      background: rgba(255, 255, 255, 0.08);
      border: 1px solid rgba(255, 255, 255, 0.12);
      color: #E2E8F0;
      border-radius: 6px;
      padding: 4px 8px;
      font-size: 11px;
      font-weight: 600;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 4px;
      transition: all 0.15s ease;
    }
    .gp-btn:hover {
      background: rgba(255, 255, 255, 0.2);
      color: #FFFFFF;
      border-color: rgba(0, 240, 255, 0.4);
    }
    .gp-btn.active {
      background: rgba(0, 240, 255, 0.25);
      color: #00F0FF;
      border-color: #00F0FF;
    }
    .gp-btn-icon {
      width: 26px;
      height: 26px;
      padding: 0;
      font-size: 12px;
    }
    .gp-toolbar {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 10px;
      padding: 6px 12px;
      background: rgba(14, 18, 32, 0.96);
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      font-size: 11px;
      color: #A0AEC0;
      transition: max-height 0.25s ease, opacity 0.25s ease, padding 0.25s ease;
      overflow: hidden;
      max-height: 90px;
    }
    .gp-toolbar.collapsed {
      max-height: 0;
      opacity: 0;
      padding: 0 12px;
      pointer-events: none;
      border-bottom: none;
    }
    .gp-ctrl-group {
      display: flex;
      align-items: center;
      gap: 5px;
    }
    .gp-ctrl-group label {
      font-size: 11px;
      color: #94A3B8;
      font-weight: 600;
    }
    .gp-range {
      -webkit-appearance: none;
      appearance: none;
      width: 65px;
      height: 4px;
      border-radius: 2px;
      background: #334155;
      outline: none;
      cursor: pointer;
    }
    .gp-range::-webkit-slider-thumb {
      -webkit-appearance: none;
      appearance: none;
      width: 12px;
      height: 12px;
      border-radius: 50%;
      background: #00F0FF;
      box-shadow: 0 0 6px #00F0FF;
      cursor: pointer;
    }
    .gp-select {
      background: #1E293B;
      border: 1px solid #334155;
      color: #E2E8F0;
      font-size: 11px;
      border-radius: 5px;
      padding: 2px 6px;
      outline: none;
      cursor: pointer;
    }
    .gp-viewport {
      position: relative;
      flex: 1;
      overflow-y: scroll;
      overflow-x: hidden;
      padding: 20px 24px 70px 24px;
      cursor: text;
      user-select: text;
    }
    .gp-viewport::-webkit-scrollbar {
      width: 5px;
    }
    .gp-viewport::-webkit-scrollbar-thumb {
      background: rgba(255, 255, 255, 0.25);
      border-radius: 3px;
    }
    .gp-viewport::-webkit-scrollbar-thumb:hover {
      background: rgba(0, 240, 255, 0.6);
    }
    .gp-script-body {
      font-weight: 500;
      color: #00F0FF;
      white-space: pre-wrap;
      word-break: break-word;
      transition: transform 0.2s ease;
      line-height: 1.6;
      outline: none;
    }
    .gp-script-body.gp-mirrored {
      transform: scaleX(-1);
    }
    .gp-focus-line {
      position: absolute;
      top: 35%;
      left: 0;
      width: 100%;
      height: 44px;
      pointer-events: none;
      background: linear-gradient(90deg, transparent, rgba(0, 240, 255, 0.08) 15%, rgba(0, 240, 255, 0.08) 85%, transparent);
      border-top: 1px dashed rgba(0, 240, 255, 0.35);
      border-bottom: 1px dashed rgba(0, 240, 255, 0.35);
      transform: translateY(-50%);
      z-index: 10;
    }
    .gp-ghost-pill {
      position: absolute;
      top: 6px;
      right: 12px;
      display: none;
      background: rgba(10, 14, 26, 0.92);
      border: 1px solid #00F0FF;
      border-radius: 20px;
      padding: 3px 10px;
      font-size: 10px;
      font-weight: 700;
      color: #00F0FF;
      cursor: pointer;
      box-shadow: 0 0 10px rgba(0, 240, 255, 0.4);
      z-index: 999;
    }
    .gp-window.gp-ghost-mode .gp-ghost-pill {
      display: block;
    }
    .gp-resize-handle {
      position: absolute;
      pointer-events: auto;
      z-index: 50;
    }
    .gp-resize-se {
      right: 0;
      bottom: 0;
      width: 16px;
      height: 16px;
      cursor: se-resize;
      background: linear-gradient(135deg, transparent 50%, rgba(0, 240, 255, 0.6) 50%);
      border-bottom-right-radius: 12px;
    }
    .gp-resize-sw {
      left: 0;
      bottom: 0;
      width: 16px;
      height: 16px;
      cursor: sw-resize;
      border-bottom-left-radius: 12px;
    }
    .gp-resize-s {
      left: 16px;
      right: 16px;
      bottom: 0;
      height: 6px;
      cursor: s-resize;
    }
    .gp-resize-e {
      top: 38px;
      bottom: 16px;
      right: 0;
      width: 6px;
      cursor: e-resize;
    }
    .gp-resize-w {
      top: 38px;
      bottom: 16px;
      left: 0;
      width: 6px;
      cursor: w-resize;
    }
    .gp-window.gp-idle .gp-header, .gp-window.gp-idle .gp-toolbar {
      opacity: 0.15;
    }
    .gp-window.gp-idle:hover .gp-header, .gp-window.gp-idle:hover .gp-toolbar {
      opacity: 1;
    }
  `;

  /**
   * Helper to load settings and scripts using chrome.storage or localStorage
   */
  async function loadData() {
    return new Promise((resolve) => {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.get(['settings', 'scripts', 'activeScriptId'], (res) => {
          resolve(res);
        });
      } else {
        const settings = localStorage.getItem('ghostprompter_settings');
        const scripts = localStorage.getItem('ghostprompter_scripts');
        const activeScriptId = localStorage.getItem('ghostprompter_activeScriptId');
        resolve({
          settings: settings ? JSON.parse(settings) : null,
          scripts: scripts ? JSON.parse(scripts) : null,
          activeScriptId: activeScriptId ? JSON.parse(activeScriptId) : null
        });
      }
    });
  }

  async function saveData(items) {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set(items);
    } else {
      Object.entries(items).forEach(([k, v]) => {
        try {
          localStorage.setItem(`ghostprompter_${k}`, JSON.stringify(v));
        } catch (e) {}
      });
    }
  }

  /**
   * Initialize or Toggle HUD
   */
  async function initOrToggleHUD() {
    if (hostEl) {
      if (hostEl.style.display === 'none') {
        hostEl.style.display = 'block';
        resetIdleTimer();
      } else {
        hostEl.style.display = 'none';
        pauseScroll();
      }
      return;
    }

    const data = await loadData();
    currentSettings = { ...defaultState, ...(data.settings || {}) };
    const scripts = data.scripts || [];
    currentScript = scripts.find(s => s.id === data.activeScriptId) || scripts[0] || {
      id: 'default',
      title: 'Welcome to GhostPrompter',
      content: `Welcome to GhostPrompter! 👻\n\nThis is your transparent, eye-tracking heads-up teleprompter.\n\n• Drag this window directly beneath your webcam lens.\n• Resize it using the bottom-right handle.\n• Press Spacebar to Pause / Resume scroll.\n• Press Alt + C to activate Click-Through Ghost Mode.\n• Press Up / Down arrows to nudge lines.\n\nStart speaking or reading, and enjoy natural eye contact!`
    };

    createHUD(data.scripts || [currentScript]);
  }

  /**
   * Build the Shadow DOM HUD Structure
   */
  function createHUD(scriptsList) {
    hostEl = document.createElement('ghost-prompter-root');
    hostEl.style.position = 'fixed';
    hostEl.style.top = '0';
    hostEl.style.left = '0';
    hostEl.style.width = '100%';
    hostEl.style.height = '100%';
    hostEl.style.pointerEvents = 'none';
    hostEl.style.zIndex = '2147483647';

    shadowRoot = hostEl.attachShadow({ mode: 'open' });

    // Inject embedded styles directly
    const styleEl = document.createElement('style');
    styleEl.textContent = EMBEDDED_STYLES;
    shadowRoot.appendChild(styleEl);

    // Initial position & dimensions
    const winConfig = currentSettings.window || defaultState.window;
    const initialWidth = winConfig.width || 620;
    const initialHeight = winConfig.height || 260;
    const initialTop = winConfig.y !== null ? winConfig.y : 30;
    const initialLeft = winConfig.x !== null ? winConfig.x : Math.max(20, (window.innerWidth - initialWidth) / 2);

    // Main window element
    windowEl = document.createElement('div');
    windowEl.className = 'gp-window';
    windowEl.style.width = `${initialWidth}px`;
    windowEl.style.height = `${initialHeight}px`;
    windowEl.style.top = `${initialTop}px`;
    windowEl.style.left = `${initialLeft}px`;
    applyWindowAppearance();

    // Markup with full manual controls
    windowEl.innerHTML = `
      <!-- Click-through Ghost Mode exit badge -->
      <button class="gp-ghost-pill" id="gp-ghost-pill">👻 Ghost Mode Active (Click to Exit)</button>

      <!-- Drag Header -->
      <div class="gp-header" id="gp-header">
        <div class="gp-brand">
          <svg class="gp-logo-icon" viewBox="0 0 24 24">
            <path d="M12 2A9 9 0 0 0 3 11c0 3.2 1.6 6 4 7.6V21a1 1 0 0 0 1.5.9L12 20l3.5 1.9A1 1 0 0 0 17 21v-2.4c2.4-1.6 4-4.4 4-7.6A9 9 0 0 0 12 2zm-3 8a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm6 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3z"/>
          </svg>
          <span class="gp-title">GhostPrompter</span>
          <div class="gp-status-group">
            <span class="gp-badge" id="gp-mode-badge">${(currentSettings.trackingMode || 'MANUAL').toUpperCase()}</span>
            <div class="gp-indicator" title="Gaze Tracking Status">
              <span class="gp-dot" id="gp-gaze-dot"></span> Gaze
            </div>
            <div class="gp-indicator" title="Speech Sync Status">
              <span class="gp-dot" id="gp-speech-dot"></span> Speech
            </div>
          </div>
        </div>

        <div class="gp-actions">
          <button class="gp-btn" id="gp-btn-play" title="Spacebar: Play/Pause">▶ Play</button>
          <button class="gp-btn gp-btn-icon" id="gp-btn-nudge-up" title="Nudge Up (Up Arrow)">▲</button>
          <button class="gp-btn gp-btn-icon" id="gp-btn-nudge-down" title="Nudge Down (Down Arrow)">▼</button>
          <button class="gp-btn gp-btn-icon" id="gp-btn-reset-top" title="Reset to Top">⏮</button>
          <button class="gp-btn" id="gp-btn-ghost" title="Alt+C: Ghost Click-Through Mode">👻 Ghost</button>
          <button class="gp-btn gp-btn-icon" id="gp-btn-mirror" title="Mirror text for glass prompter">🪞</button>
          <button class="gp-btn gp-btn-icon" id="gp-btn-tools" title="Toggle control sliders">⚙</button>
          <button class="gp-btn gp-btn-icon" id="gp-btn-close" title="Close HUD (Alt+P)">✕</button>
        </div>
      </div>

      <!-- Collapsible Settings Toolbar -->
      <div class="gp-toolbar" id="gp-toolbar">
        <div class="gp-ctrl-group">
          <label>Script:</label>
          <select class="gp-select" id="gp-select-script">
            ${scriptsList.map(s => `<option value="${s.id}" ${s.id === currentScript.id ? 'selected' : ''}>${s.title}</option>`).join('')}
          </select>
        </div>

        <div class="gp-ctrl-group">
          <label>Speed:</label>
          <button class="gp-btn gp-btn-icon" id="gp-btn-wpm-dec" style="width:20px; height:20px; font-size:10px;">-</button>
          <input type="range" class="gp-range" id="gp-range-wpm" min="50" max="260" step="10" value="${currentSettings.wpm}">
          <button class="gp-btn gp-btn-icon" id="gp-btn-wpm-inc" style="width:20px; height:20px; font-size:10px;">+</button>
          <span id="gp-val-wpm" style="font-size:10px; color:#00F0FF; min-width:26px;">${currentSettings.wpm}</span>
        </div>

        <div class="gp-ctrl-group">
          <label>Font:</label>
          <button class="gp-btn gp-btn-icon" id="gp-btn-font-dec" style="width:20px; height:20px; font-size:10px;">-</button>
          <input type="range" class="gp-range" id="gp-range-font" min="14" max="44" step="2" value="${currentSettings.fontSize}">
          <button class="gp-btn gp-btn-icon" id="gp-btn-font-inc" style="width:20px; height:20px; font-size:10px;">+</button>
        </div>

        <div class="gp-ctrl-group">
          <label>Opacity:</label>
          <input type="range" class="gp-range" id="gp-range-opacity" min="0" max="1" step="0.05" value="${currentSettings.opacity}">
        </div>

        <div class="gp-ctrl-group">
          <label>Mode:</label>
          <select class="gp-select" id="gp-select-mode">
            <option value="manual" ${currentSettings.trackingMode === 'manual' ? 'selected' : ''}>Manual (Keys/Buttons)</option>
            <option value="auto" ${currentSettings.trackingMode === 'auto' ? 'selected' : ''}>Auto-Scroll (WPM)</option>
            <option value="dual" ${currentSettings.trackingMode === 'dual' ? 'selected' : ''}>Dual (Gaze + Speech)</option>
            <option value="gaze" ${currentSettings.trackingMode === 'gaze' ? 'selected' : ''}>Gaze Only</option>
            <option value="speech" ${currentSettings.trackingMode === 'speech' ? 'selected' : ''}>Speech Sync</option>
          </select>
        </div>
      </div>

      <!-- Content Scroll Viewport -->
      <div class="gp-viewport" id="gp-viewport">
        <div class="gp-focus-line"></div>
        <div class="gp-script-body" id="gp-script-body" contenteditable="true" spellcheck="false"></div>
      </div>

      <!-- Edge & Corner Resize Handles -->
      <div class="gp-resize-handle gp-resize-se" data-dir="se"></div>
      <div class="gp-resize-handle gp-resize-sw" data-dir="sw"></div>
      <div class="gp-resize-handle gp-resize-s" data-dir="s"></div>
      <div class="gp-resize-handle gp-resize-e" data-dir="e"></div>
      <div class="gp-resize-handle gp-resize-w" data-dir="w"></div>
    `;

    shadowRoot.appendChild(windowEl);
    document.documentElement.appendChild(hostEl);

    // Cache elements
    viewportEl = shadowRoot.getElementById('gp-viewport');
    scriptBodyEl = shadowRoot.getElementById('gp-script-body');
    updateScriptContent();

    // Attach Event Listeners
    setupDragHandlers();
    setupResizeHandlers();
    setupUIControls();
    setupHotkeys();
    resetIdleTimer();

    // Notify background / offscreen that prompter is active
    sendMessageToExtension({ type: 'HUD_OPENED', trackingMode: currentSettings.trackingMode });
  }

  function applyWindowAppearance() {
    if (!windowEl) return;
    const bgAlpha = isGhostMode ? Math.min(0.2, currentSettings.opacity * 0.25) : currentSettings.opacity;
    windowEl.style.backgroundColor = `rgba(10, 12, 20, ${bgAlpha})`;
    if (scriptBodyEl) {
      scriptBodyEl.style.fontSize = `${currentSettings.fontSize}px`;
      scriptBodyEl.style.color = currentSettings.textColor || '#00F0FF';
      scriptBodyEl.style.lineHeight = currentSettings.lineHeight || 1.6;
    }
  }

  function updateScriptContent() {
    if (!scriptBodyEl || !currentScript) return;
    scriptBodyEl.textContent = currentScript.content || '';
  }

  /**
   * Drag Handling
   */
  function setupDragHandlers() {
    const header = shadowRoot.getElementById('gp-header');
    let isDragging = false;
    let startX = 0, startY = 0;
    let initialLeft = 0, initialTop = 0;

    header.addEventListener('mousedown', (e) => {
      if (e.target.closest('.gp-actions') || e.target.closest('button')) return;
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      const rect = windowEl.getBoundingClientRect();
      initialLeft = rect.left;
      initialTop = rect.top;
      e.preventDefault();
    });

    window.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      const newLeft = Math.max(0, Math.min(window.innerWidth - windowEl.offsetWidth, initialLeft + dx));
      const newTop = Math.max(0, Math.min(window.innerHeight - windowEl.offsetHeight, initialTop + dy));

      windowEl.style.left = `${newLeft}px`;
      windowEl.style.top = `${newTop}px`;
    });

    window.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
        currentSettings.window = {
          x: parseInt(windowEl.style.left, 10),
          y: parseInt(windowEl.style.top, 10),
          width: windowEl.offsetWidth,
          height: windowEl.offsetHeight
        };
        saveData({ settings: currentSettings });
      }
    });
  }

  /**
   * Resize Handling
   */
  function setupResizeHandlers() {
    const handles = shadowRoot.querySelectorAll('.gp-resize-handle');
    let isResizing = false;
    let currentDir = '';
    let startX = 0, startY = 0;
    let startWidth = 0, startHeight = 0, startLeft = 0, startTop = 0;

    handles.forEach(handle => {
      handle.addEventListener('mousedown', (e) => {
        isResizing = true;
        currentDir = handle.dataset.dir;
        startX = e.clientX;
        startY = e.clientY;
        const rect = windowEl.getBoundingClientRect();
        startWidth = rect.width;
        startHeight = rect.height;
        startLeft = rect.left;
        startTop = rect.top;
        e.preventDefault();
        e.stopPropagation();
      });
    });

    window.addEventListener('mousemove', (e) => {
      if (!isResizing) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;

      if (currentDir.includes('e')) {
        windowEl.style.width = `${Math.max(340, Math.min(window.innerWidth - startLeft, startWidth + dx))}px`;
      }
      if (currentDir.includes('s')) {
        windowEl.style.height = `${Math.max(160, Math.min(window.innerHeight - startTop, startHeight + dy))}px`;
      }
      if (currentDir.includes('w')) {
        const newW = Math.max(340, startWidth - dx);
        if (newW > 340) {
          windowEl.style.width = `${newW}px`;
          windowEl.style.left = `${startLeft + dx}px`;
        }
      }
    });

    window.addEventListener('mouseup', () => {
      if (isResizing) {
        isResizing = false;
        currentSettings.window = {
          x: parseInt(windowEl.style.left, 10),
          y: parseInt(windowEl.style.top, 10),
          width: windowEl.offsetWidth,
          height: windowEl.offsetHeight
        };
        saveData({ settings: currentSettings });
      }
    });
  }

  /**
   * UI Controls & Handlers
   */
  function setupUIControls() {
    const playBtn = shadowRoot.getElementById('gp-btn-play');
    const nudgeUpBtn = shadowRoot.getElementById('gp-btn-nudge-up');
    const nudgeDownBtn = shadowRoot.getElementById('gp-btn-nudge-down');
    const resetTopBtn = shadowRoot.getElementById('gp-btn-reset-top');
    const ghostBtn = shadowRoot.getElementById('gp-btn-ghost');
    const ghostPill = shadowRoot.getElementById('gp-ghost-pill');
    const mirrorBtn = shadowRoot.getElementById('gp-btn-mirror');
    const toolsBtn = shadowRoot.getElementById('gp-btn-tools');
    const closeBtn = shadowRoot.getElementById('gp-btn-close');
    const toolbar = shadowRoot.getElementById('gp-toolbar');
    const opacitySlider = shadowRoot.getElementById('gp-range-opacity');
    const fontSlider = shadowRoot.getElementById('gp-range-font');
    const wpmSlider = shadowRoot.getElementById('gp-range-wpm');
    const wpmVal = shadowRoot.getElementById('gp-val-wpm');
    const modeSelect = shadowRoot.getElementById('gp-select-mode');
    const scriptSelect = shadowRoot.getElementById('gp-select-script');

    // Play / Pause
    playBtn.addEventListener('click', togglePlay);

    // Manual nudges
    nudgeUpBtn.addEventListener('click', () => nudgeScroll(-32));
    nudgeDownBtn.addEventListener('click', () => nudgeScroll(32));
    resetTopBtn.addEventListener('click', () => {
      if (viewportEl) viewportEl.scrollTop = 0;
    });

    // Quick +/- WPM buttons
    const wpmDecBtn = shadowRoot.getElementById('gp-btn-wpm-dec');
    const wpmIncBtn = shadowRoot.getElementById('gp-btn-wpm-inc');
    wpmDecBtn.addEventListener('click', () => adjustSpeed(-10));
    wpmIncBtn.addEventListener('click', () => adjustSpeed(10));

    // Quick +/- Font buttons
    const fontDecBtn = shadowRoot.getElementById('gp-btn-font-dec');
    const fontIncBtn = shadowRoot.getElementById('gp-btn-font-inc');
    fontDecBtn.addEventListener('click', () => {
      currentSettings.fontSize = Math.max(14, currentSettings.fontSize - 2);
      fontSlider.value = currentSettings.fontSize;
      applyWindowAppearance();
      saveData({ settings: currentSettings });
    });
    fontIncBtn.addEventListener('click', () => {
      currentSettings.fontSize = Math.min(48, currentSettings.fontSize + 2);
      fontSlider.value = currentSettings.fontSize;
      applyWindowAppearance();
      saveData({ settings: currentSettings });
    });

    // Ghost Mode
    ghostBtn.addEventListener('click', toggleGhostMode);
    ghostPill.addEventListener('click', toggleGhostMode);

    // Mirror Mode
    mirrorBtn.addEventListener('click', () => {
      isMirrorMode = !isMirrorMode;
      mirrorBtn.classList.toggle('active', isMirrorMode);
      scriptBodyEl.classList.toggle('gp-mirrored', isMirrorMode);
      currentSettings.mirrorMode = isMirrorMode;
      saveData({ settings: currentSettings });
    });

    // Toggle Toolbar
    toolsBtn.addEventListener('click', () => {
      toolbar.classList.toggle('collapsed');
      toolsBtn.classList.toggle('active', !toolbar.classList.contains('collapsed'));
    });

    // Close HUD
    closeBtn.addEventListener('click', () => {
      hostEl.style.display = 'none';
      pauseScroll();
    });

    // Opacity
    opacitySlider.addEventListener('input', (e) => {
      currentSettings.opacity = parseFloat(e.target.value);
      applyWindowAppearance();
      saveData({ settings: currentSettings });
    });

    // Font Size
    fontSlider.addEventListener('input', (e) => {
      currentSettings.fontSize = parseInt(e.target.value, 10);
      applyWindowAppearance();
      saveData({ settings: currentSettings });
    });

    // WPM Speed
    wpmSlider.addEventListener('input', (e) => {
      currentSettings.wpm = parseInt(e.target.value, 10);
      wpmVal.textContent = currentSettings.wpm;
      saveData({ settings: currentSettings });
    });

    // Tracking Mode
    modeSelect.addEventListener('change', (e) => {
      currentSettings.trackingMode = e.target.value;
      const badge = shadowRoot.getElementById('gp-mode-badge');
      if (badge) badge.textContent = e.target.value.toUpperCase();
      saveData({ settings: currentSettings });
      sendMessageToExtension({ type: 'SET_TRACKING_MODE', mode: e.target.value });
    });

    // Script Switcher
    scriptSelect.addEventListener('change', async (e) => {
      const data = await loadData();
      const scripts = data.scripts || [];
      const found = scripts.find(s => s.id === e.target.value);
      if (found) {
        currentScript = found;
        updateScriptContent();
        saveData({ activeScriptId: found.id });
        viewportEl.scrollTop = 0;
      }
    });

    // In-place script editing
    scriptBodyEl.addEventListener('input', () => {
      if (currentScript) {
        currentScript.content = scriptBodyEl.innerText;
        currentScript.updatedAt = Date.now();
        saveData({ activeScriptId: currentScript.id });
        loadData().then(data => {
          const scripts = data.scripts || [];
          const idx = scripts.findIndex(s => s.id === currentScript.id);
          if (idx >= 0) scripts[idx] = currentScript;
          saveData({ scripts });
        });
      }
    });

    windowEl.addEventListener('mousemove', resetIdleTimer);
    windowEl.addEventListener('mouseenter', resetIdleTimer);
  }

  /**
   * Hotkey Controller
   */
  function setupHotkeys() {
    window.addEventListener('keydown', (e) => {
      const activeTag = document.activeElement ? document.activeElement.tagName.toLowerCase() : '';
      const isEditingScript = shadowRoot && shadowRoot.activeElement === scriptBodyEl;
      
      // Global toggle hotkeys
      if (e.altKey && (e.key === 'p' || e.key === 'P')) {
        e.preventDefault();
        initOrToggleHUD();
        return;
      }

      if (e.altKey && (e.key === 'c' || e.key === 'C')) {
        e.preventDefault();
        toggleGhostMode();
        return;
      }

      if (hostEl && hostEl.style.display !== 'none' && !isEditingScript && activeTag !== 'input' && activeTag !== 'textarea') {
        if (e.code === 'Space') {
          e.preventDefault();
          togglePlay();
        } else if (e.code === 'ArrowUp') {
          e.preventDefault();
          nudgeScroll(-32);
        } else if (e.code === 'ArrowDown') {
          e.preventDefault();
          nudgeScroll(32);
        } else if (e.key === '[') {
          e.preventDefault();
          adjustSpeed(-10);
        } else if (e.key === ']') {
          e.preventDefault();
          adjustSpeed(10);
        } else if (e.key === 'Escape') {
          e.preventDefault();
          hostEl.style.display = 'none';
          pauseScroll();
        }
      }
    });
  }

  function togglePlay() {
    isPlaying = !isPlaying;
    const playBtn = shadowRoot ? shadowRoot.getElementById('gp-btn-play') : null;
    if (isPlaying) {
      if (playBtn) {
        playBtn.textContent = '⏸ Pause';
        playBtn.classList.add('active');
      }
      startScrollLoop();
      resetIdleTimer();
    } else {
      if (playBtn) {
        playBtn.textContent = '▶ Play';
        playBtn.classList.remove('active');
      }
      pauseScroll();
    }
  }

  function toggleGhostMode() {
    isGhostMode = !isGhostMode;
    windowEl.classList.toggle('gp-ghost-mode', isGhostMode);
    const ghostBtn = shadowRoot ? shadowRoot.getElementById('gp-btn-ghost') : null;
    if (ghostBtn) ghostBtn.classList.toggle('active', isGhostMode);
    applyWindowAppearance();
  }

  function nudgeScroll(pixels) {
    if (!viewportEl) return;
    viewportEl.style.scrollBehavior = 'smooth';
    viewportEl.scrollTop += pixels;
  }

  function adjustSpeed(deltaWpm) {
    currentSettings.wpm = Math.max(50, Math.min(300, (currentSettings.wpm || 130) + deltaWpm));
    const slider = shadowRoot ? shadowRoot.getElementById('gp-range-wpm') : null;
    const val = shadowRoot ? shadowRoot.getElementById('gp-val-wpm') : null;
    if (slider) slider.value = currentSettings.wpm;
    if (val) val.textContent = currentSettings.wpm;
    saveData({ settings: currentSettings });
  }

  /**
   * Continuous Scroll Animation Loop
   */
  function startScrollLoop() {
    if (scrollAnimFrame) cancelAnimationFrame(scrollAnimFrame);
    if (!viewportEl) return;

    // Use auto scroll behavior during continuous animation to prevent smooth scroll fighting
    viewportEl.style.scrollBehavior = 'auto';

    let lastTime = performance.now();

    function frame(time) {
      if (!isPlaying || !viewportEl) return;

      const dt = (time - lastTime) / 1000;
      lastTime = time;

      // Base auto-scroll speed from WPM:
      const wps = (currentSettings.wpm || 130) / 60;
      const basePixelsPerSec = wps * 3.5;

      let speed = basePixelsPerSec;
      if (scrollVelocity !== 0) {
        speed += scrollVelocity;
      }

      viewportEl.scrollTop += speed * dt;

      scrollAnimFrame = requestAnimationFrame(frame);
    }

    scrollAnimFrame = requestAnimationFrame(frame);
  }

  function pauseScroll() {
    if (scrollAnimFrame) {
      cancelAnimationFrame(scrollAnimFrame);
      scrollAnimFrame = null;
    }
  }

  /**
   * Auto-hide idle timer for stealth HUD
   */
  function resetIdleTimer() {
    if (!windowEl) return;
    windowEl.classList.remove('gp-idle');
    clearTimeout(idleTimer);
    if (isPlaying) {
      idleTimer = setTimeout(() => {
        if (isPlaying && windowEl) {
          windowEl.classList.add('gp-idle');
        }
      }, 2500);
    }
  }

  /**
   * Messaging & Remote Events
   */
  function sendMessageToExtension(msg) {
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
      try {
        chrome.runtime.sendMessage(msg);
      } catch (e) {}
    }
  }

  // Listen for messages from background service-worker or popup
  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (!message || !message.type) return;

      switch (message.type) {
        case 'TOGGLE_PROMPTER':
          initOrToggleHUD();
          sendResponse({ status: 'ok' });
          break;

        case 'TOGGLE_GHOST_MODE':
          toggleGhostMode();
          sendResponse({ status: 'ok', ghostMode: isGhostMode });
          break;

        case 'TOGGLE_PAUSE':
          togglePlay();
          sendResponse({ status: 'ok', isPlaying });
          break;

        case 'GAZE_TRACKING_UPDATE':
          handleGazeUpdate(message);
          break;

        case 'SPEECH_SYNC_UPDATE':
          handleSpeechUpdate(message);
          break;
      }
    });
  }

  function handleGazeUpdate(data) {
    if (!shadowRoot) return;
    const dot = shadowRoot.getElementById('gp-gaze-dot');
    if (!dot) return;

    if (data.glanceZone === 'lower') {
      dot.className = 'gp-dot active-green';
      scrollVelocity = 25;
    } else if (data.glanceZone === 'away') {
      dot.className = 'gp-dot active-amber';
      scrollVelocity = -15;
    } else {
      dot.className = 'gp-dot active-cyan';
      scrollVelocity = 0;
    }
  }

  function handleSpeechUpdate(data) {
    if (!shadowRoot) return;
    const dot = shadowRoot.getElementById('gp-speech-dot');
    if (dot) {
      dot.className = 'gp-dot active-cyan';
      setTimeout(() => {
        if (dot) dot.className = 'gp-dot active-cyan';
      }, 300);
    }
    if (isPlaying && viewportEl && data.advancePixels) {
      viewportEl.scrollTop += data.advancePixels;
    }
  }

  // Expose global controller
  window.GhostPrompter = {
    toggle: initOrToggleHUD,
    toggleGhostMode: toggleGhostMode,
    togglePlay: togglePlay,
    nudge: nudgeScroll
  };

  console.log('GhostPrompter content script loaded. Press Alt+P or click extension icon to launch.');
})();
