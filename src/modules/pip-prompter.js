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
      this.onToggleRecord = options.onToggleRecord || null;
      this.onStartScreenRecording = options.onStartScreenRecording || null;
      this.onStartCameraRecording = options.onStartCameraRecording || null;
      this.onStopRecording = options.onStopRecording || null;
      this.isRecordingFn = options.isRecording || (() => false);

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
            <span class="pip-title"><span class="pip-title-text">GhostPrompter</span> <span class="pip-pill">Always-On-Top</span></span>
          </div>

          <div class="pip-actions">
            <button class="pip-btn pip-btn-rec" id="pip-btn-rec" title="Record Screen / Window / Tab or Camera">
              <span id="pip-rec-icon">🔴</span> <span id="pip-rec-label">Rec</span>
            </button>

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

        <!-- Recording Source Selection Modal -->
        <div class="pip-modal-overlay" id="pip-choice-modal" style="display:none;">
          <div class="pip-choice-card">
            <div class="pip-choice-header">
              <span class="pip-choice-title">🎥 Select Recording Source</span>
              <button class="pip-choice-close" id="pip-choice-close" title="Close">✕</button>
            </div>
            <div class="pip-choice-grid">
              <button class="pip-source-btn" id="pip-choice-screen">
                <span class="pip-source-icon">🖥️</span>
                <div class="pip-source-text">
                  <div class="pip-source-name">Screen / Window / Tab</div>
                  <div class="pip-source-desc">Share multi-tab, window, or full screen</div>
                </div>
              </button>
              <button class="pip-source-btn" id="pip-choice-cam">
                <span class="pip-source-icon">📷</span>
                <div class="pip-source-text">
                  <div class="pip-source-name">Webcam Camera</div>
                  <div class="pip-source-desc">Prompter is 100% invisible in recording</div>
                </div>
              </button>
            </div>
          </div>
        </div>

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
    const btnRec = doc.getElementById('pip-btn-rec');
    const recIcon = doc.getElementById('pip-rec-icon');
    const recLabel = doc.getElementById('pip-rec-label');
    const choiceModal = doc.getElementById('pip-choice-modal');
    const choiceScreen = doc.getElementById('pip-choice-screen');
    const choiceCam = doc.getElementById('pip-choice-cam');
    const choiceClose = doc.getElementById('pip-choice-close');
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

    // Elastic Dynamic UI Resizer - adjusts scale and responsive layout in sync with window resize
    const updatePipScale = () => {
      const w = pipWin.innerWidth || 600;
      const scale = Math.max(0.55, Math.min(1.25, Math.pow(w / 600, 0.72)));
      doc.documentElement.style.setProperty('--pip-scale', scale.toFixed(3));

      if (w < 440) {
        container.classList.add('pip-size-xs');
        container.classList.remove('pip-size-sm', 'pip-size-md');
      } else if (w < 600) {
        container.classList.add('pip-size-sm');
        container.classList.remove('pip-size-xs', 'pip-size-md');
      } else {
        container.classList.add('pip-size-md');
        container.classList.remove('pip-size-xs', 'pip-size-sm');
      }
    };
    pipWin.addEventListener('resize', updatePipScale);
    updatePipScale();

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

    // Recording controls & Screen Share Flow
    if (this.isRecordingFn && this.isRecordingFn()) {
      this.updateRecordingState(true, '00:00');
    }

    if (btnRec) {
      btnRec.addEventListener('click', () => {
        const isRec = this.isRecordingFn ? this.isRecordingFn() : this.isRecording;
        if (isRec) {
          if (this.onStopRecording) {
            this.onStopRecording();
          } else if (this.onToggleRecord) {
            this.onToggleRecord();
          }
        } else {
          // Open source choice modal
          if (choiceModal) choiceModal.style.display = 'flex';
        }
      });
    }

    if (choiceClose) {
      choiceClose.addEventListener('click', () => {
        if (choiceModal) choiceModal.style.display = 'none';
      });
    }

    if (choiceScreen) {
      choiceScreen.addEventListener('click', () => {
        if (choiceModal) choiceModal.style.display = 'none';
        if (this.onStartScreenRecording) {
          this.onStartScreenRecording();
        } else if (this.onToggleRecord) {
          this.onToggleRecord('screen');
        }
      });
    }

    if (choiceCam) {
      choiceCam.addEventListener('click', () => {
        if (choiceModal) choiceModal.style.display = 'none';
        if (this.onStartCameraRecording) {
          this.onStartCameraRecording();
        } else if (this.onToggleRecord) {
          this.onToggleRecord('camera');
        }
      });
    }

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

  /**
   * Update recording status indicator in Document PiP window
   */
  updateRecordingState(isRecording, timeStr = '00:00') {
    this.isRecording = isRecording;
    if (!this.activePiPWindow || this.activePiPWindow.closed) return;
    const doc = this.activePiPWindow.document;
    const recBtn = doc.getElementById('pip-btn-rec');
    const icon = doc.getElementById('pip-rec-icon');
    const label = doc.getElementById('pip-rec-label');

    if (!recBtn) return;
    if (isRecording) {
      recBtn.classList.add('pip-recording');
      recBtn.title = 'Stop Recording';
      if (icon) icon.textContent = '⏹';
      if (label) label.textContent = ` ${timeStr}`;
    } else {
      recBtn.classList.remove('pip-recording');
      recBtn.title = 'Record Screen / Window / Tab or Camera';
      if (icon) icon.textContent = '🔴';
      if (label) label.textContent = 'Rec';
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
      :root {
        --pip-scale: 1;
      }
      * {
        box-sizing: border-box;
        margin: 0;
        padding: 0;
        border: none;
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
        border: none !important;
        border-radius: calc(14px * var(--pip-scale, 1));
        overflow: hidden;
        position: relative;
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
        padding: calc(6px * var(--pip-scale, 1)) calc(10px * var(--pip-scale, 1));
        background: rgba(16, 22, 38, 0.95);
        border: none !important;
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
        gap: calc(6px * var(--pip-scale, 1));
        flex-shrink: 0;
      }
      .pip-transparent .pip-header {
        background: rgba(12, 16, 30, 0.75);
      }
      .pip-brand {
        display: flex;
        align-items: center;
        gap: calc(5px * var(--pip-scale, 1));
        font-size: calc(12px * var(--pip-scale, 1));
        font-weight: 800;
        color: #00F0FF;
        white-space: nowrap;
      }
      .pip-logo {
        font-size: calc(14px * var(--pip-scale, 1));
      }
      .pip-pill {
        background: rgba(0, 255, 136, 0.15);
        border: none !important;
        color: #00FF88;
        font-size: calc(9px * var(--pip-scale, 1));
        padding: calc(2px * var(--pip-scale, 1)) calc(6px * var(--pip-scale, 1));
        border-radius: 20px;
        text-transform: uppercase;
        font-weight: 700;
      }
      .pip-actions {
        display: flex;
        align-items: center;
        gap: calc(5px * var(--pip-scale, 1));
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
        border: none !important;
        color: #FFF;
        font-size: calc(11px * var(--pip-scale, 1));
        font-weight: 700;
        padding: calc(4px * var(--pip-scale, 1)) calc(9px * var(--pip-scale, 1));
        border-radius: 20px;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: calc(4px * var(--pip-scale, 1));
        white-space: nowrap;
        transition: all 0.15s ease;
      }
      .pip-btn:hover {
        background: rgba(0, 240, 255, 0.25);
        color: #00F0FF;
      }
      .pip-btn-rec {
        background: rgba(239, 68, 68, 0.2);
        color: #FF6B6B;
        font-weight: 800;
      }
      .pip-btn-rec:hover {
        background: rgba(239, 68, 68, 0.4);
        color: #FFF;
      }
      .pip-btn-rec.pip-recording {
        background: #EF4444 !important;
        color: #FFF !important;
        box-shadow: 0 0 12px rgba(239, 68, 68, 0.8);
        animation: pipPulseRec 1.2s infinite ease-in-out;
      }
      @keyframes pipPulseRec {
        0%, 100% { opacity: 1; transform: scale(1); }
        50% { opacity: 0.88; transform: scale(0.97); }
      }
      .pip-btn-play {
        background: #00F0FF;
        color: #080C16;
        font-weight: 800;
      }
      .pip-btn-play:hover {
        background: #33F5FF;
        color: #000;
      }
      .pip-btn-play.active {
        background: #FF0055;
        color: #FFF;
      }
      .pip-speed-pill, .pip-font-steppers {
        display: flex;
        align-items: center;
        gap: calc(3px * var(--pip-scale, 1));
        background: rgba(255, 255, 255, 0.08);
        border: none !important;
        padding: calc(3px * var(--pip-scale, 1)) calc(7px * var(--pip-scale, 1));
        border-radius: 20px;
        font-size: calc(11px * var(--pip-scale, 1));
        color: #00F0FF;
        font-weight: 700;
        white-space: nowrap;
      }
      .pip-btn-step {
        width: calc(18px * var(--pip-scale, 1));
        height: calc(18px * var(--pip-scale, 1));
        background: rgba(255, 255, 255, 0.12);
        border: none !important;
        color: #FFF;
        border-radius: 50%;
        cursor: pointer;
        font-size: calc(10px * var(--pip-scale, 1));
        font-weight: 800;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        transition: all 0.15s ease;
      }
      .pip-btn-step:hover {
        background: #00F0FF;
        color: #0A0D18;
      }
      .pip-select-script {
        background: rgba(255, 255, 255, 0.08);
        border: none !important;
        color: #FFF;
        font-size: calc(11px * var(--pip-scale, 1));
        padding: calc(3px * var(--pip-scale, 1)) calc(8px * var(--pip-scale, 1));
        border-radius: 16px;
        max-width: calc(120px * var(--pip-scale, 1));
        outline: none;
        cursor: pointer;
      }
      .pip-btn-close {
        background: transparent;
        border: none !important;
        color: #94A3B8;
        font-size: calc(13px * var(--pip-scale, 1));
        font-weight: 800;
        cursor: pointer;
        padding: calc(2px * var(--pip-scale, 1)) calc(6px * var(--pip-scale, 1));
        border-radius: 50%;
        transition: all 0.15s ease;
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
        padding: calc(16px * var(--pip-scale, 1)) calc(20px * var(--pip-scale, 1)) calc(120px * var(--pip-scale, 1)) calc(20px * var(--pip-scale, 1));
        border: none !important;
      }
      .pip-viewport::-webkit-scrollbar {
        display: none;
      }
      .pip-focus-line {
        position: sticky;
        top: calc(24px * var(--pip-scale, 1));
        height: calc(38px * var(--pip-scale, 1));
        border: none !important;
        background: rgba(0, 240, 255, 0.1);
        box-shadow: 0 0 calc(12px * var(--pip-scale, 1)) rgba(0, 240, 255, 0.25);
        border-radius: calc(8px * var(--pip-scale, 1));
        pointer-events: none;
        margin-bottom: calc(-38px * var(--pip-scale, 1));
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

      /* Modal Overlay & Card (Borderless Rounded Glass) */
      .pip-modal-overlay {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.78);
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
        padding: calc(12px * var(--pip-scale, 1));
        border: none !important;
      }
      .pip-choice-card {
        background: #101626;
        border-radius: calc(14px * var(--pip-scale, 1));
        box-shadow: 0 16px 40px rgba(0, 0, 0, 0.75);
        width: 100%;
        max-width: calc(340px * var(--pip-scale, 1));
        padding: calc(14px * var(--pip-scale, 1));
        display: flex;
        flex-direction: column;
        gap: calc(10px * var(--pip-scale, 1));
        border: none !important;
      }
      .pip-choice-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
      }
      .pip-choice-title {
        font-size: calc(12px * var(--pip-scale, 1));
        font-weight: 700;
        color: #00F0FF;
      }
      .pip-choice-close {
        background: transparent;
        border: none !important;
        color: #94A3B8;
        font-size: calc(13px * var(--pip-scale, 1));
        cursor: pointer;
        border-radius: 50%;
        padding: 2px 6px;
      }
      .pip-choice-close:hover {
        color: #FFF;
        background: rgba(255, 255, 255, 0.1);
      }
      .pip-choice-grid {
        display: flex;
        flex-direction: column;
        gap: calc(8px * var(--pip-scale, 1));
      }
      .pip-source-btn {
        display: flex;
        align-items: center;
        gap: calc(10px * var(--pip-scale, 1));
        background: rgba(255, 255, 255, 0.06);
        border: none !important;
        border-radius: calc(10px * var(--pip-scale, 1));
        padding: calc(9px * var(--pip-scale, 1)) calc(12px * var(--pip-scale, 1));
        color: #FFF;
        cursor: pointer;
        text-align: left;
        transition: all 0.15s ease;
      }
      .pip-source-btn:hover {
        background: rgba(0, 240, 255, 0.2);
        transform: translateY(-1px);
      }
      .pip-source-icon {
        font-size: calc(20px * var(--pip-scale, 1));
      }
      .pip-source-name {
        font-size: calc(12px * var(--pip-scale, 1));
        font-weight: 700;
        color: #FFF;
      }
      .pip-source-desc {
        font-size: calc(10px * var(--pip-scale, 1));
        color: #94A3B8;
        margin-top: 2px;
      }

      /* Responsive Elastic Classes */
      .pip-size-xs .pip-title-text,
      .pip-size-xs .pip-pill,
      .pip-size-xs #pip-play-label,
      .pip-size-xs #pip-trans-label {
        display: none !important;
      }
      .pip-size-xs .pip-header {
        padding: 4px 6px;
      }
      .pip-size-xs .pip-select-script {
        max-width: 85px;
      }
      .pip-size-sm .pip-pill {
        display: none !important;
      }
      .pip-size-sm .pip-select-script {
        max-width: 100px;
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
