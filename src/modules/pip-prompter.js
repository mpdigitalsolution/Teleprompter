/**
 * GhostPrompter Picture-in-Picture & Floating Controller
 * Uses the native Chromium Document Picture-in-Picture API to create an
 * Always-On-Top floating OS window that persists across all tabs, external monitors,
 * and desktop applications (PowerPoint, Zoom, Teams, Word, etc.).
 */

class PiPPrompterManager {
  constructor() {
    this.activePiPWindow = null;
    this.isScrolling = false;
    this.scrollAnimId = null;
    this.scrollAccumulator = 0;
    this.currentWpm = 130;
    this.currentFontSize = 24;
    this.isTransparent = false;
    this.currentScript = null;
    this.scriptsList = [];
    this.onCloseCallback = null;
  }

  /**
   * Check if Document Picture-in-Picture is supported by current browser
   */
  static isSupported() {
    return typeof window !== 'undefined' &&
           'documentPictureInPicture' in window &&
           typeof window.documentPictureInPicture.requestWindow === 'function';
  }

  /**
   * Open or focus the floating Always-On-Top Document PiP Teleprompter
   */
  async openPiP(options = {}) {
    if (this.activePiPWindow && !this.activePiPWindow.closed) {
      this.activePiPWindow.focus();
      return this.activePiPWindow;
    }

    if (!PiPPrompterManager.isSupported()) {
      console.warn('Document Picture-in-Picture API not supported. Falling back to popup window.');
      this.openFallbackWindow();
      return null;
    }

    try {
      const width = options.width || 680;
      const height = options.height || 340;

      this.currentWpm = options.wpm || 130;
      this.currentFontSize = options.fontSize || 24;
      this.isTransparent = !!options.isTransparent;
      this.currentScript = options.script || {
        id: 'default',
        title: 'GhostPrompter Script',
        content: 'Welcome to your Always-On-Top Floating Teleprompter! 👻\n\nThis window stays on top across all your Chrome tabs, PowerPoint slides, and desktop windows!'
      };
      this.scriptsList = options.scripts || [this.currentScript];
      this.onCloseCallback = options.onClose || null;

      const pipWin = await window.documentPictureInPicture.requestWindow({
        width,
        height
      });

      this.activePiPWindow = pipWin;
      this.setupPiPDocument(pipWin, options.initialScrollTop || 0);

      pipWin.addEventListener('pagehide', () => {
        this.handlePiPClose();
      });

      return pipWin;
    } catch (err) {
      console.warn('Failed to open Document PiP window:', err);
      this.openFallbackWindow();
      return null;
    }
  }

  /**
   * Open standalone fallback popup window via background service worker
   */
  openFallbackWindow() {
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
      chrome.runtime.sendMessage({ type: 'OPEN_FLOATING_PROMPTER_WINDOW' });
    } else {
      window.open(
        'src/floating/floating.html',
        'GhostPrompterFloating',
        'width=680,height=340,menubar=no,toolbar=no,location=no,status=no'
      );
    }
  }

  /**
   * Close PiP window if open
   */
  closePiP() {
    if (this.activePiPWindow && !this.activePiPWindow.closed) {
      this.activePiPWindow.close();
    }
    this.activePiPWindow = null;
  }

  /**
   * Render styles and DOM elements into the Document PiP window
   */
  setupPiPDocument(pipWin, initialScrollTop = 0) {
    const doc = pipWin.document;

    // Reset title
    doc.title = 'GhostPrompter (Always-On-Top Floating Prompter)';

    // Inject CSS
    const styleEl = doc.createElement('style');
    styleEl.textContent = this.getPiPStyles();
    doc.head.appendChild(styleEl);

    // Render HTML structure
    doc.body.innerHTML = `
      <div class="pip-prompter ${this.isTransparent ? 'pip-transparent' : 'pip-solid'}" id="pip-container">
        <!-- Floating Header -->
        <header class="pip-header" id="pip-header">
          <div class="pip-brand">
            <span class="pip-logo">👻</span>
            <span class="pip-title">GhostPrompter <span class="pip-pill">Always-On-Top</span></span>
          </div>

          <div class="pip-actions">
            <button class="pip-btn pip-btn-play" id="pip-btn-play" title="Spacebar: Play/Pause Auto-Scroll">
              <span id="pip-play-icon">▶</span> <span id="pip-play-label">Play</span>
            </button>

            <div class="pip-speed-pill" title="Scroll Speed">
              <button class="pip-btn-step" id="pip-btn-wpm-dec">-</button>
              <span id="pip-label-wpm">${this.currentWpm} WPM</span>
              <button class="pip-btn-step" id="pip-btn-wpm-inc">+</button>
            </div>

            <button class="pip-btn pip-btn-glass ${this.isTransparent ? 'active' : ''}" id="pip-btn-trans" title="Toggle Transparent Glass Mode">
              <span id="pip-trans-icon">${this.isTransparent ? '⬛' : '🪟'}</span>
              <span id="pip-trans-label">${this.isTransparent ? 'Solid' : 'Glass'}</span>
            </button>

            <div class="pip-font-steppers" title="Adjust Text Size">
              <button class="pip-btn-step" id="pip-btn-font-dec" title="Smaller Font">A-</button>
              <span id="pip-label-font">${this.currentFontSize}px</span>
              <button class="pip-btn-step" id="pip-btn-font-inc" title="Larger Font">A+</button>
            </div>

            <button class="pip-btn pip-btn-ghost" id="pip-btn-rewind" title="Rewind to Top">⏮ Top</button>

            <select class="pip-select-script" id="pip-select-script" title="Switch Presentation Script">
              ${this.scriptsList.map(s => `<option value="${s.id}" ${s.id === this.currentScript.id ? 'selected' : ''}>${s.title}</option>`).join('')}
            </select>

            <button class="pip-btn-close" id="pip-btn-close" title="Close and Return to Tab">✕</button>
          </div>
        </header>

        <!-- Scrolling Body & Eye-Line Guide -->
        <main class="pip-viewport" id="pip-viewport">
          <div class="pip-focus-line" id="pip-focus-line"></div>
          <div class="pip-text" id="pip-text" contenteditable="true" spellcheck="false"></div>
        </main>
      </div>
    `;

    // References
    const container = doc.getElementById('pip-container');
    const viewport = doc.getElementById('pip-viewport');
    const textEl = doc.getElementById('pip-text');
    const btnPlay = doc.getElementById('pip-btn-play');
    const playIcon = doc.getElementById('pip-play-icon');
    const playLabel = doc.getElementById('pip-play-label');
    const btnWpmDec = doc.getElementById('pip-btn-wpm-dec');
    const btnWpmInc = doc.getElementById('pip-btn-wpm-inc');
    const labelWpm = doc.getElementById('pip-label-wpm');
    const btnTrans = doc.getElementById('pip-btn-trans');
    const transIcon = doc.getElementById('pip-trans-icon');
    const transLabel = doc.getElementById('pip-trans-label');
    const btnFontDec = doc.getElementById('pip-btn-font-dec');
    const btnFontInc = doc.getElementById('pip-btn-font-inc');
    const labelFont = doc.getElementById('pip-label-font');
    const btnRewind = doc.getElementById('pip-btn-rewind');
    const selectScript = doc.getElementById('pip-select-script');
    const btnClose = doc.getElementById('pip-btn-close');

    // Populate script content
    textEl.innerText = this.currentScript.content || '';
    textEl.style.fontSize = `${this.currentFontSize}px`;

    // Restore scroll position
    if (initialScrollTop > 0) {
      setTimeout(() => {
        viewport.scrollTop = initialScrollTop;
      }, 50);
    }

    // Auto-Scroll Loop
    const stepScroll = () => {
      if (!this.isScrolling) return;

      const pixelsPerSecond = (this.currentWpm * 22) / 60;
      this.scrollAccumulator += pixelsPerSecond / 60;

      if (this.scrollAccumulator >= 1) {
        const toMove = Math.floor(this.scrollAccumulator);
        viewport.scrollTop += toMove;
        this.scrollAccumulator -= toMove;

        // Check if finished
        if (viewport.scrollTop + viewport.clientHeight >= viewport.scrollHeight - 5) {
          this.setScrolling(false, btnPlay, playIcon, playLabel);
          return;
        }
      }

      this.scrollAnimId = pipWin.requestAnimationFrame(stepScroll);
    };

    // Toggle Play/Pause
    const togglePlay = () => {
      this.setScrolling(!this.isScrolling, btnPlay, playIcon, playLabel, pipWin, stepScroll);
    };

    btnPlay.addEventListener('click', togglePlay);

    // Speed controls
    btnWpmDec.addEventListener('click', () => {
      this.currentWpm = Math.max(50, this.currentWpm - 10);
      labelWpm.textContent = `${this.currentWpm} WPM`;
      this.syncStorage({ wpm: this.currentWpm });
    });

    btnWpmInc.addEventListener('click', () => {
      this.currentWpm = Math.min(350, this.currentWpm + 10);
      labelWpm.textContent = `${this.currentWpm} WPM`;
      this.syncStorage({ wpm: this.currentWpm });
    });

    // Font size controls
    btnFontDec.addEventListener('click', () => {
      this.currentFontSize = Math.max(16, this.currentFontSize - 2);
      textEl.style.fontSize = `${this.currentFontSize}px`;
      labelFont.textContent = `${this.currentFontSize}px`;
      this.syncStorage({ fontSize: this.currentFontSize });
    });

    btnFontInc.addEventListener('click', () => {
      this.currentFontSize = Math.min(48, this.currentFontSize + 2);
      textEl.style.fontSize = `${this.currentFontSize}px`;
      labelFont.textContent = `${this.currentFontSize}px`;
      this.syncStorage({ fontSize: this.currentFontSize });
    });

    // Transparency toggle
    btnTrans.addEventListener('click', () => {
      this.isTransparent = !this.isTransparent;
      container.className = `pip-prompter ${this.isTransparent ? 'pip-transparent' : 'pip-solid'}`;
      btnTrans.classList.toggle('active', this.isTransparent);
      transIcon.textContent = this.isTransparent ? '⬛' : '🪟';
      transLabel.textContent = this.isTransparent ? 'Solid' : 'Glass';
      this.syncStorage({ isTransparentMode: this.isTransparent });
    });

    // Rewind
    btnRewind.addEventListener('click', () => {
      viewport.scrollTop = 0;
      this.scrollAccumulator = 0;
    });

    // Script switch
    selectScript.addEventListener('change', (e) => {
      const id = e.target.value;
      const found = this.scriptsList.find(s => s.id === id);
      if (found) {
        this.currentScript = found;
        textEl.innerText = found.content || '';
        viewport.scrollTop = 0;
        this.scrollAccumulator = 0;
        this.syncStorage({ activeScriptId: id });
      }
    });

    // Text edit autosave
    textEl.addEventListener('input', () => {
      if (this.currentScript) {
        this.currentScript.content = textEl.innerText;
        const idx = this.scriptsList.findIndex(s => s.id === this.currentScript.id);
        if (idx >= 0) this.scriptsList[idx] = this.currentScript;
        this.syncStorage({ scripts: this.scriptsList });
      }
    });

    // Close button
    btnClose.addEventListener('click', () => {
      pipWin.close();
    });

    // Keyboard Shortcuts inside PiP Window
    pipWin.addEventListener('keydown', (e) => {
      if (e.target === textEl && (e.key.length === 1 || e.key === 'Backspace' || e.key === 'Enter')) {
        return; // Typing in script
      }

      if (e.code === 'Space') {
        e.preventDefault();
        togglePlay();
      } else if (e.key === '[') {
        e.preventDefault();
        btnWpmDec.click();
      } else if (e.key === ']') {
        e.preventDefault();
        btnWpmInc.click();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        viewport.scrollTop = Math.max(0, viewport.scrollTop - 40);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        viewport.scrollTop += 40;
      } else if (e.key === 'Escape') {
        pipWin.close();
      }
    });

    // Cross-tab storage synchronization listener
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
      const storageListener = (changes, area) => {
        if (area !== 'local') return;

        if (changes.settings && changes.settings.newValue) {
          const s = changes.settings.newValue;
          if (s.wpm && s.wpm !== this.currentWpm) {
            this.currentWpm = s.wpm;
            labelWpm.textContent = `${this.currentWpm} WPM`;
          }
          if (s.fontSize && s.fontSize !== this.currentFontSize) {
            this.currentFontSize = s.fontSize;
            textEl.style.fontSize = `${this.currentFontSize}px`;
            labelFont.textContent = `${this.currentFontSize}px`;
          }
          if (typeof s.isTransparentMode === 'boolean' && s.isTransparentMode !== this.isTransparent) {
            this.isTransparent = s.isTransparentMode;
            container.className = `pip-prompter ${this.isTransparent ? 'pip-transparent' : 'pip-solid'}`;
            btnTrans.classList.toggle('active', this.isTransparent);
            transIcon.textContent = this.isTransparent ? '⬛' : '🪟';
            transLabel.textContent = this.isTransparent ? 'Solid' : 'Glass';
          }
        }

        if (changes.activeScriptId && changes.activeScriptId.newValue) {
          const newId = changes.activeScriptId.newValue;
          if (selectScript.value !== newId) {
            selectScript.value = newId;
            const scr = this.scriptsList.find(s => s.id === newId);
            if (scr) {
              this.currentScript = scr;
              textEl.innerText = scr.content || '';
            }
          }
        }
      };

      chrome.storage.onChanged.addListener(storageListener);
      pipWin.addEventListener('pagehide', () => {
        chrome.storage.onChanged.removeListener(storageListener);
      });
    }
  }

  setScrolling(active, btnPlay, playIcon, playLabel, pipWin, stepScroll) {
    this.isScrolling = active;
    if (btnPlay) {
      btnPlay.classList.toggle('active', active);
    }
    if (playIcon) {
      playIcon.textContent = active ? '⏸' : '▶';
    }
    if (playLabel) {
      playLabel.textContent = active ? 'Pause' : 'Play';
    }

    if (active && pipWin && stepScroll) {
      this.scrollAnimId = pipWin.requestAnimationFrame(stepScroll);
    } else if (!active && pipWin && this.scrollAnimId) {
      pipWin.cancelAnimationFrame(this.scrollAnimId);
      this.scrollAnimId = null;
    }
  }

  handlePiPClose() {
    let finalScroll = 0;
    if (this.activePiPWindow && this.activePiPWindow.document) {
      const vp = this.activePiPWindow.document.getElementById('pip-viewport');
      if (vp) finalScroll = vp.scrollTop;
    }

    this.isScrolling = false;
    this.activePiPWindow = null;

    if (typeof this.onCloseCallback === 'function') {
      this.onCloseCallback({
        finalScrollTop: finalScroll,
        script: this.currentScript,
        wpm: this.currentWpm,
        fontSize: this.currentFontSize,
        isTransparent: this.isTransparent
      });
    }
  }

  syncStorage(data) {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      if (data.wpm || data.fontSize || typeof data.isTransparentMode === 'boolean') {
        chrome.storage.local.get('settings', (res) => {
          const settings = res.settings || {};
          if (data.wpm) settings.wpm = data.wpm;
          if (data.fontSize) settings.fontSize = data.fontSize;
          if (typeof data.isTransparentMode === 'boolean') settings.isTransparentMode = data.isTransparentMode;
          chrome.storage.local.set({ settings });
        });
      }
      if (data.activeScriptId) {
        chrome.storage.local.set({ activeScriptId: data.activeScriptId });
      }
      if (data.scripts) {
        chrome.storage.local.set({ scripts: data.scripts });
      }
    }
  }

  getPiPStyles() {
    return `
      * {
        box-sizing: border-box;
        margin: 0;
        padding: 0;
      }
      html, body {
        width: 100%;
        height: 100%;
        overflow: hidden;
        background: #000;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
        color: #FFF;
      }
      .pip-prompter {
        display: flex;
        flex-direction: column;
        width: 100%;
        height: 100%;
        transition: background 0.25s ease;
      }
      .pip-prompter.pip-solid {
        background: #0A0D18;
      }
      .pip-prompter.pip-transparent {
        background: rgba(10, 14, 24, 0.35);
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
      }
      .pip-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 6px 12px;
        background: rgba(16, 22, 38, 0.95);
        border-bottom: 1.5px solid rgba(0, 240, 255, 0.4);
        gap: 8px;
        flex-shrink: 0;
      }
      .pip-transparent .pip-header {
        background: rgba(12, 16, 30, 0.75);
      }
      .pip-brand {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 12px;
        font-weight: 800;
        color: #00F0FF;
        white-space: nowrap;
      }
      .pip-pill {
        background: rgba(0, 255, 136, 0.15);
        border: 1px solid rgba(0, 255, 136, 0.4);
        color: #00FF88;
        font-size: 9px;
        padding: 2px 6px;
        border-radius: 10px;
        text-transform: uppercase;
      }
      .pip-actions {
        display: flex;
        align-items: center;
        gap: 5px;
        flex-wrap: nowrap;
        overflow-x: auto;
        scrollbar-width: none;
        -ms-overflow-style: none;
      }
      .pip-actions::-webkit-scrollbar {
        display: none;
        width: 0;
        height: 0;
      }
      .pip-btn {
        background: rgba(255, 255, 255, 0.1);
        border: 1px solid rgba(255, 255, 255, 0.2);
        color: #FFF;
        font-size: 11px;
        font-weight: 700;
        padding: 3px 8px;
        border-radius: 5px;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        gap: 4px;
        white-space: nowrap;
        transition: all 0.15s ease;
      }
      .pip-btn:hover {
        background: rgba(0, 240, 255, 0.2);
        border-color: #00F0FF;
        color: #00F0FF;
      }
      .pip-btn-play {
        background: #00F0FF;
        color: #080C16;
        border-color: #00F0FF;
        font-weight: 800;
      }
      .pip-btn-play:hover {
        background: #33F5FF;
        color: #000;
      }
      .pip-btn-play.active {
        background: #FF0055;
        border-color: #FF0055;
        color: #FFF;
      }
      .pip-speed-pill, .pip-font-steppers {
        display: flex;
        align-items: center;
        gap: 3px;
        background: rgba(0, 0, 0, 0.5);
        border: 1px solid rgba(0, 240, 255, 0.4);
        padding: 2px 6px;
        border-radius: 5px;
        font-size: 11px;
        color: #00F0FF;
        font-weight: 700;
        white-space: nowrap;
      }
      .pip-btn-step {
        width: 18px;
        height: 18px;
        background: rgba(255, 255, 255, 0.1);
        border: 1px solid rgba(255, 255, 255, 0.2);
        color: #FFF;
        border-radius: 3px;
        cursor: pointer;
        font-size: 11px;
        font-weight: 800;
        display: inline-flex;
        align-items: center;
        justify-content: center;
      }
      .pip-btn-step:hover {
        background: #00F0FF;
        color: #0A0D18;
      }
      .pip-select-script {
        background: #151C2F;
        border: 1px solid rgba(0, 240, 255, 0.35);
        color: #FFF;
        font-size: 11px;
        padding: 2px 6px;
        border-radius: 5px;
        max-width: 130px;
        outline: none;
        cursor: pointer;
      }
      .pip-btn-close {
        background: transparent;
        border: none;
        color: #94A3B8;
        font-size: 14px;
        font-weight: 800;
        cursor: pointer;
        padding: 2px 6px;
        border-radius: 4px;
      }
      .pip-btn-close:hover {
        background: rgba(239, 68, 68, 0.3);
        color: #EF4444;
      }
      .pip-viewport {
        flex: 1;
        position: relative;
        overflow-y: scroll;
        overflow-x: hidden;
        scrollbar-width: none;
        padding: 16px 20px 120px 20px;
      }
      .pip-viewport::-webkit-scrollbar {
        display: none;
      }
      .pip-focus-line {
        position: sticky;
        top: 24px;
        height: 40px;
        border-top: 1.5px solid rgba(0, 240, 255, 0.6);
        border-bottom: 1.5px solid rgba(0, 240, 255, 0.6);
        background: rgba(0, 240, 255, 0.08);
        border-radius: 6px;
        pointer-events: none;
        margin-bottom: -40px;
        z-index: 10;
      }
      .pip-text {
        font-weight: 800;
        line-height: 1.6;
        color: #00F0FF;
        white-space: pre-wrap;
        word-break: break-word;
        outline: none;
        user-select: text;
        text-shadow: 
          0 0 16px rgba(0, 0, 0, 1),
          0 2px 4px rgba(0, 0, 0, 1),
          -1.5px -1.5px 0 #000,
           1.5px -1.5px 0 #000,
          -1.5px  1.5px 0 #000,
           1.5px  1.5px 0 #000;
      }
      .pip-transparent .pip-text {
        color: #00F0FF !important;
        text-shadow: 
          0 0 16px #000,
          0 0 8px #000,
          0 2px 4px #000,
          -2px -2px 0 #000,
           2px -2px 0 #000,
          -2px  2px 0 #000,
           2px  2px 0 #000 !important;
      }
    `;
  }
}

// Export for module and global usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { PiPPrompterManager };
}
if (typeof window !== 'undefined') {
  window.PiPPrompterManager = PiPPrompterManager;
}
