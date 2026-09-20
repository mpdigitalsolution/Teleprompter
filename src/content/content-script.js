/**
 * GhostPrompter Content Script
 * Injects and manages the stealth Heads-Up Display (HUD) inside an isolated Shadow DOM.
 */

(function () {
  // Prevent duplicate injection
  if (window.__GHOST_PROMPTER_INITIALIZED__) {
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

    // Inject CSS
    const styleEl = document.createElement('style');
    fetch(typeof chrome !== 'undefined' && chrome.runtime ? chrome.runtime.getURL('src/content/overlay.css') : 'src/content/overlay.css')
      .then(res => res.text())
      .then(css => { styleEl.textContent = css; })
      .catch(() => {
        // Embedded minimal CSS fallback if fetch fails
        styleEl.textContent = `
          .gp-window { position: fixed; border-radius: 12px; backdrop-filter: blur(12px); box-shadow: 0 8px 32px rgba(0,0,0,0.7); overflow: hidden; pointer-events: auto; }
          .gp-header { display: flex; align-items: center; justify-content: space-between; padding: 6px 12px; background: rgba(10,14,24,0.9); cursor: grab; color: #fff; font-family: sans-serif; font-size: 12px; }
          .gp-viewport { padding: 20px; overflow-y: scroll; height: 180px; font-family: sans-serif; }
        `;
      });
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

    // Markup
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
            <span class="gp-badge" id="gp-mode-badge">${(currentSettings.trackingMode || 'DUAL').toUpperCase()}</span>
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
          <button class="gp-btn" id="gp-btn-ghost" title="Alt+C: Ghost Click-Through Mode">👻 Ghost</button>
          <button class="gp-btn" id="gp-btn-mirror" title="Mirror text for glass prompter">🪞 Mirror</button>
          <button class="gp-btn" id="gp-btn-tools" title="Toggle control sliders">⚙</button>
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
          <label>Opacity:</label>
          <input type="range" class="gp-range" id="gp-range-opacity" min="0" max="1" step="0.05" value="${currentSettings.opacity}">
        </div>

        <div class="gp-ctrl-group">
          <label>Font:</label>
          <input type="range" class="gp-range" id="gp-range-font" min="14" max="44" step="2" value="${currentSettings.fontSize}">
        </div>

        <div class="gp-ctrl-group">
          <label>Speed (WPM):</label>
          <input type="range" class="gp-range" id="gp-range-wpm" min="60" max="260" step="10" value="${currentSettings.wpm}">
          <span id="gp-val-wpm" style="font-size:10px; color:#00F0FF;">${currentSettings.wpm}</span>
        </div>

        <div class="gp-ctrl-group">
          <label>Mode:</label>
          <select class="gp-select" id="gp-select-mode">
            <option value="dual" ${currentSettings.trackingMode === 'dual' ? 'selected' : ''}>Dual (Gaze + Speech)</option>
            <option value="gaze" ${currentSettings.trackingMode === 'gaze' ? 'selected' : ''}>Gaze Only</option>
            <option value="speech" ${currentSettings.trackingMode === 'speech' ? 'selected' : ''}>Speech Sync</option>
            <option value="auto" ${currentSettings.trackingMode === 'auto' ? 'selected' : ''}>Auto-Scroll</option>
            <option value="manual" ${currentSettings.trackingMode === 'manual' ? 'selected' : ''}>Manual Only</option>
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
    // Format text into wrapped spans or paragraphs for speech sync
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
        // Save back into scripts array
        loadData().then(data => {
          const scripts = data.scripts || [];
          const idx = scripts.findIndex(s => s.id === currentScript.id);
          if (idx >= 0) scripts[idx] = currentScript;
          saveData({ scripts });
        });
      }
    });

    // Mouse activity resets stealth idle timer
    windowEl.addEventListener('mousemove', resetIdleTimer);
    windowEl.addEventListener('mouseenter', resetIdleTimer);
  }

  /**
   * Hotkey Controller
   */
  function setupHotkeys() {
    window.addEventListener('keydown', (e) => {
      // Don't intercept if user is typing inside the script body or another form input
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
    const playBtn = shadowRoot.getElementById('gp-btn-play');
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
    const ghostBtn = shadowRoot.getElementById('gp-btn-ghost');
    if (ghostBtn) ghostBtn.classList.toggle('active', isGhostMode);
    applyWindowAppearance();
  }

  function nudgeScroll(pixels) {
    if (!viewportEl) return;
    viewportEl.scrollTop += pixels;
  }

  function adjustSpeed(deltaWpm) {
    currentSettings.wpm = Math.max(50, Math.min(300, (currentSettings.wpm || 130) + deltaWpm));
    const slider = shadowRoot.getElementById('gp-range-wpm');
    const val = shadowRoot.getElementById('gp-val-wpm');
    if (slider) slider.value = currentSettings.wpm;
    if (val) val.textContent = currentSettings.wpm;
    saveData({ settings: currentSettings });
  }

  /**
   * Scroll Loop Animation
   */
  function startScrollLoop() {
    if (scrollAnimFrame) cancelAnimationFrame(scrollAnimFrame);

    let lastTime = performance.now();

    function frame(time) {
      if (!isPlaying || !viewportEl) return;

      const dt = (time - lastTime) / 1000;
      lastTime = time;

      // Base auto-scroll speed from WPM:
      // Approx 1 line per 10 words, each line is ~35px high
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

  // Listen for messages from background service-worker or offscreen tracker
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
          // { glanceZone: 'top'|'middle'|'lower'|'away', verticalRatio: 0.65 }
          handleGazeUpdate(message);
          break;

        case 'SPEECH_SYNC_UPDATE':
          // { recognizedText: '...', wordIndex: 45 }
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
      dot.className = 'gp-dot active-green pulse'; // Lower third: reading advancing
      scrollVelocity = 25; // Gently accelerate
    } else if (data.glanceZone === 'away') {
      dot.className = 'gp-dot active-amber'; // Looked away: hold
      scrollVelocity = -15; // Slow down/pause
    } else {
      dot.className = 'gp-dot active-cyan'; // Middle/neutral
      scrollVelocity = 0;
    }
  }

  function handleSpeechUpdate(data) {
    if (!shadowRoot) return;
    const dot = shadowRoot.getElementById('gp-speech-dot');
    if (dot) {
      dot.className = 'gp-dot active-cyan pulse';
      setTimeout(() => {
        if (dot) dot.className = 'gp-dot active-cyan';
      }, 300);
    }
    // Advance scroll smoothly if speech is actively progressing
    if (isPlaying && viewportEl && data.advancePixels) {
      viewportEl.scrollTop += data.advancePixels;
    }
  }

  // Expose global init function for manual testing
  window.GhostPrompter = {
    toggle: initOrToggleHUD,
    toggleGhostMode: toggleGhostMode,
    togglePlay: togglePlay
  };

  console.log('GhostPrompter content script loaded. Press Alt+P to activate.');
})();
