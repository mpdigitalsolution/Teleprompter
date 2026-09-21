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
    this.currentOpacity = 0.94;
    this.currentTextColor = '#00F0FF';
    this.currentTrackingMode = 'auto';
    this.isGhostMode = false;
    this.isToolbarCollapsed = true;
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
      this.currentOpacity = typeof options.opacity === 'number' ? options.opacity : (this.isTransparent ? 0.35 : 0.94);
      this.currentTextColor = options.textColor || '#00F0FF';
      this.currentTrackingMode = options.trackingMode || 'auto';
      this.isGhostMode = false;
      this.isToolbarCollapsed = options.isToolbarCollapsed !== false;
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
      <div class="pip-prompter ${this.isTransparent ? 'pip-transparent' : 'pip-solid'}${this.isGhostMode ? ' pip-ghost' : ''}" id="pip-container">
        <!-- Floating Header -->
        <header class="pip-header" id="pip-header">
          <div class="pip-brand">
            <span class="pip-logo">👻</span>
            <span class="pip-title"><span class="pip-title-text">GhostPrompter</span></span>
          </div>

          <div class="pip-actions">
            <button class="pip-btn pip-btn-rec" id="pip-btn-rec" title="Record Screen / Window / Tab or Camera">
              <span id="pip-rec-icon">🔴</span> <span id="pip-rec-label">Rec</span>
            </button>
            <button class="pip-btn pip-btn-rec-stop" id="pip-btn-rec-stop" style="display: none;" title="Stop Recording & Download Video">
              <span id="pip-stop-icon">⏹</span> <span id="pip-stop-label">Stop</span>
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

            <button class="pip-btn pip-btn-nudge" id="pip-btn-nudge-up" title="Nudge Up (↑)">▲</button>
            <button class="pip-btn pip-btn-nudge" id="pip-btn-nudge-down" title="Nudge Down (↓)">▼</button>
            <button class="pip-btn pip-btn-rewind" id="pip-btn-rewind" title="Rewind to Top">⏮</button>

            <button class="pip-btn pip-btn-ghost-toggle ${this.isGhostMode ? 'active' : ''}" id="pip-btn-ghost" title="Ghost Click-Through Mode">
              👻 <span class="pip-ghost-label">Ghost</span>
            </button>

            <button class="pip-btn pip-btn-controls ${!this.isToolbarCollapsed ? 'active' : ''}" id="pip-btn-controls" title="Toggle Settings (Alt+S)">
              ⚙ <span class="pip-ctrl-label">Controls</span> <span id="pip-ctrl-arrow">${this.isToolbarCollapsed ? '▼' : '▲'}</span>
            </button>

            <button class="pip-btn-close" id="pip-btn-close" title="Close and Return to Tab">✕</button>
          </div>
        </header>

        <!-- Collapsible Settings Toolbar -->
        <div class="pip-toolbar ${this.isToolbarCollapsed ? 'pip-toolbar-collapsed' : ''}" id="pip-toolbar">

          <!-- Row 1: Script & Mode -->
          <div class="pip-tb-row">
            <div class="pip-tb-cell">
              <span class="pip-tb-label">📄 Script</span>
              <select class="pip-select pip-select-script" id="pip-select-script" title="Switch Script">
                ${this.scriptsList.map(s => `<option value="${s.id}" ${s.id === this.currentScript.id ? 'selected' : ''}>${s.title}</option>`).join('')}
              </select>
            </div>
            <div class="pip-tb-cell">
              <span class="pip-tb-label">🎬 Mode</span>
              <select class="pip-select" id="pip-select-mode">
                <option value="auto" ${this.currentTrackingMode === 'auto' ? 'selected' : ''}>Auto-Scroll (WPM)</option>
                <option value="manual" ${this.currentTrackingMode === 'manual' ? 'selected' : ''}>Manual (Keys)</option>
                <option value="dual" ${this.currentTrackingMode === 'dual' ? 'selected' : ''}>Dual (Gaze + Speech)</option>
                <option value="gaze" ${this.currentTrackingMode === 'gaze' ? 'selected' : ''}>Gaze Only</option>
                <option value="speech" ${this.currentTrackingMode === 'speech' ? 'selected' : ''}>Speech Sync</option>
              </select>
            </div>
          </div>

          <div class="pip-tb-divider"></div>

          <!-- Row 2: Speed & Opacity -->
          <div class="pip-tb-row">
            <div class="pip-tb-cell">
              <span class="pip-tb-label">⚡ Speed</span>
              <div class="pip-tb-controls">
                <button class="pip-btn-step" id="pip-btn-wpm-dec2">−</button>
                <input type="range" class="pip-range" id="pip-range-wpm" min="50" max="300" step="10" value="${this.currentWpm}">
                <button class="pip-btn-step" id="pip-btn-wpm-inc2">+</button>
                <span id="pip-val-wpm" class="pip-tb-val">${this.currentWpm} WPM</span>
              </div>
            </div>
            <div class="pip-tb-cell">
              <span class="pip-tb-label">🌗 Opacity</span>
              <div class="pip-tb-controls">
                <button class="pip-preset-btn ${this.currentOpacity >= 0.85 && !this.isTransparent ? 'active' : ''}" id="pip-preset-solid" data-preset="solid">Solid</button>
                <button class="pip-preset-btn ${this.currentOpacity >= 0.65 && this.currentOpacity < 0.85 ? 'active' : ''}" id="pip-preset-dark" data-preset="dark">Dark</button>
                <button class="pip-preset-btn ${this.currentOpacity >= 0.2 && this.currentOpacity < 0.65 && this.isTransparent ? 'active' : ''}" id="pip-preset-glass" data-preset="glass">Glass</button>
                <button class="pip-preset-btn ${this.currentOpacity < 0.2 && this.isTransparent ? 'active' : ''}" id="pip-preset-clear" data-preset="clear">Clear</button>
                <input type="range" class="pip-range" id="pip-range-opacity" min="0" max="1" step="0.05" value="${this.currentOpacity}">
              </div>
            </div>
          </div>

          <div class="pip-tb-divider"></div>

          <!-- Row 3: Font & Color -->
          <div class="pip-tb-row">
            <div class="pip-tb-cell">
              <span class="pip-tb-label">🔤 Font</span>
              <div class="pip-tb-controls">
                <button class="pip-btn-step" id="pip-btn-font-dec">A−</button>
                <input type="range" class="pip-range" id="pip-range-font" min="16" max="44" step="2" value="${this.currentFontSize}">
                <button class="pip-btn-step" id="pip-btn-font-inc">A+</button>
                <span id="pip-val-font" class="pip-tb-val">${this.currentFontSize}px</span>
              </div>
            </div>
            <div class="pip-tb-cell">
              <span class="pip-tb-label">🎨 Color</span>
              <select class="pip-select" id="pip-select-color">
                <option value="#00F0FF" ${this.currentTextColor === '#00F0FF' ? 'selected' : ''}>⚡ Neon Cyan</option>
                <option value="#FFEA00" ${this.currentTextColor === '#FFEA00' ? 'selected' : ''}>☀️ Yellow</option>
                <option value="#00FF88" ${this.currentTextColor === '#00FF88' ? 'selected' : ''}>💚 Green</option>
                <option value="#FFFFFF" ${this.currentTextColor === '#FFFFFF' ? 'selected' : ''}>⚪ White</option>
              </select>
            </div>
          </div>

        </div>


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

        <!-- Fast Video Preview & Download Modal -->
        <div class="pip-modal-overlay" id="pip-preview-modal" style="display:none;">
          <div class="pip-choice-card pip-preview-card">
            <div class="pip-choice-header">
              <span class="pip-choice-title">🎬 Video Ready for Download</span>
              <button class="pip-choice-close" id="pip-preview-close" title="Close">✕</button>
            </div>
            <div class="pip-preview-body">
              <video id="pip-preview-video" class="pip-preview-video" controls autoplay playsinline></video>
              <div class="pip-preview-stats">
                <span id="pip-stat-dur" class="pip-stat-tag">⏱ 00:00</span>
                <span id="pip-stat-size" class="pip-stat-tag">💾 0 MB</span>
                <span class="pip-stat-tag pip-stat-shield">🛡 Prompter-Free</span>
              </div>
            </div>
            <div class="pip-preview-footer">
              <button class="pip-btn pip-btn-preview-dl" id="pip-btn-download" title="Download video to computer">
                <span>💾</span> Download Video (.webm)
              </button>
            </div>
          </div>
        </div>

        <!-- Scrolling Body & Eye-Line Guide -->
        <main class="pip-viewport" id="pip-viewport">
          <div class="pip-focus-line" id="pip-focus-line"></div>
          <div class="pip-text" id="pip-text" contenteditable="true" spellcheck="false"></div>
        </main>

        <!-- Ghost pill shown when ghost mode is on -->
        <button class="pip-ghost-pill" id="pip-ghost-pill">👻 Ghost Mode (Click to Exit)</button>
      </div>
    `;

    // References
    const container = doc.getElementById('pip-container');
    const viewport = doc.getElementById('pip-viewport');
    const textEl = doc.getElementById('pip-text');
    const btnRec = doc.getElementById('pip-btn-rec');
    const btnStopRec = doc.getElementById('pip-btn-rec-stop');
    const recIcon = doc.getElementById('pip-rec-icon');
    const recLabel = doc.getElementById('pip-rec-label');
    const choiceModal = doc.getElementById('pip-choice-modal');
    const choiceScreen = doc.getElementById('pip-choice-screen');
    const choiceCam = doc.getElementById('pip-choice-cam');
    const choiceClose = doc.getElementById('pip-choice-close');
    const previewModal = doc.getElementById('pip-preview-modal');
    const previewVideo = doc.getElementById('pip-preview-video');
    const previewClose = doc.getElementById('pip-preview-close');
    const previewDlBtn = doc.getElementById('pip-btn-download');
    const statDur = doc.getElementById('pip-stat-dur');
    const statSize = doc.getElementById('pip-stat-size');
    const btnPlay = doc.getElementById('pip-btn-play');
    const playIcon = doc.getElementById('pip-play-icon');
    const playLabel = doc.getElementById('pip-play-label');
    const btnWpmDec = doc.getElementById('pip-btn-wpm-dec');
    const btnWpmInc = doc.getElementById('pip-btn-wpm-inc');
    const labelWpm = doc.getElementById('pip-label-wpm');
    const btnTrans = doc.getElementById('pip-btn-trans');
    const transIcon = doc.getElementById('pip-trans-icon');
    const transLabel = doc.getElementById('pip-trans-label');
    const btnNudgeUp = doc.getElementById('pip-btn-nudge-up');
    const btnNudgeDown = doc.getElementById('pip-btn-nudge-down');
    const btnRewind = doc.getElementById('pip-btn-rewind');
    const btnGhost = doc.getElementById('pip-btn-ghost');
    const ghostPill = doc.getElementById('pip-ghost-pill');
    const btnControls = doc.getElementById('pip-btn-controls');
    const ctrlArrow = doc.getElementById('pip-ctrl-arrow');
    const toolbar = doc.getElementById('pip-toolbar');
    const selectScript = doc.getElementById('pip-select-script');
    const btnClose = doc.getElementById('pip-btn-close');
    // Toolbar controls
    const btnWpmDec2 = doc.getElementById('pip-btn-wpm-dec2');
    const btnWpmInc2 = doc.getElementById('pip-btn-wpm-inc2');
    const rangeWpm = doc.getElementById('pip-range-wpm');
    const valWpm = doc.getElementById('pip-val-wpm');
    const btnFontDec = doc.getElementById('pip-btn-font-dec');
    const btnFontInc = doc.getElementById('pip-btn-font-inc');
    const rangeFont = doc.getElementById('pip-range-font');
    const valFont = doc.getElementById('pip-val-font');
    const rangeOpacity = doc.getElementById('pip-range-opacity');
    const selectColor = doc.getElementById('pip-select-color');
    const selectMode = doc.getElementById('pip-select-mode');
    const presetBtns = doc.querySelectorAll('.pip-preset-btn');


    // Elastic Dynamic UI Resizer - adjusts scale and responsive layout in sync with window resize
    const updatePipScale = () => {
      const w = pipWin.innerWidth || doc.documentElement.clientWidth || 600;
      const h = pipWin.innerHeight || doc.documentElement.clientHeight || 300;

      // Calculate responsive ratio from baseline 620w x 300h
      const ratioW = w / 620;
      const ratioH = h / 300;
      // Fluid responsive factor blending width and height
      const blendedRatio = (ratioW * 0.75) + (ratioH * 0.25);
      const scale = Math.max(0.48, Math.min(1.45, Math.pow(blendedRatio, 0.82)));
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

    if (typeof pipWin.ResizeObserver !== 'undefined') {
      const ro = new pipWin.ResizeObserver(() => {
        updatePipScale();
      });
      ro.observe(doc.documentElement);
      ro.observe(doc.body);
    }
    pipWin.addEventListener('resize', updatePipScale);
    updatePipScale();

    // Populate script content & set initial responsive font size
    textEl.innerText = this.currentScript.content || '';
    textEl.style.setProperty('--pip-font-size', `${this.currentFontSize}px`);

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

    if (btnStopRec) {
      btnStopRec.addEventListener('click', () => {
        if (this.onStopRecording) {
          this.onStopRecording();
        } else if (this.onToggleRecord) {
          this.onToggleRecord();
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

    if (previewClose) {
      previewClose.addEventListener('click', () => {
        if (previewModal) previewModal.style.display = 'none';
        if (previewVideo) {
          previewVideo.pause();
          previewVideo.removeAttribute('src');
          previewVideo.load();
        }
      });
    }

    if (previewDlBtn) {
      previewDlBtn.addEventListener('click', () => {
        if (this.currentTake && this.currentTake.blob) {
          const dateStr = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
          const filename = `ghostprompter-video-${dateStr}.webm`;
          const url = this.currentTake.url || URL.createObjectURL(this.currentTake.blob);
          const a = doc.createElement('a');
          a.style.display = 'none';
          a.href = url;
          a.download = filename;
          doc.body.appendChild(a);
          a.click();
          setTimeout(() => {
            try { doc.body.removeChild(a); } catch (e) {}
          }, 300);
        }
      });
    }

    // Helper: update container class reflecting transparent/ghost state
    const updateContainerClass = () => {
      let cls = `pip-prompter ${this.isTransparent ? 'pip-transparent' : 'pip-solid'}`;
      if (this.isGhostMode) cls += ' pip-ghost';
      container.className = cls;
    };

    // Helper: sync all preset button active states
    const syncPresetBtns = () => {
      presetBtns.forEach(b => b.classList.remove('active'));
      if (!this.isTransparent && this.currentOpacity >= 0.85) {
        const btn = doc.getElementById('pip-preset-solid');
        if (btn) btn.classList.add('active');
      } else if (this.currentOpacity >= 0.65 && this.currentOpacity < 0.85) {
        const btn = doc.getElementById('pip-preset-dark');
        if (btn) btn.classList.add('active');
      } else if (this.isTransparent && this.currentOpacity >= 0.2 && this.currentOpacity < 0.65) {
        const btn = doc.getElementById('pip-preset-glass');
        if (btn) btn.classList.add('active');
      } else if (this.isTransparent && this.currentOpacity < 0.2) {
        const btn = doc.getElementById('pip-preset-clear');
        if (btn) btn.classList.add('active');
      }
    };

    // Speed controls (header steppers)
    btnWpmDec.addEventListener('click', () => {
      this.currentWpm = Math.max(50, this.currentWpm - 10);
      labelWpm.textContent = `${this.currentWpm} WPM`;
      if (rangeWpm) rangeWpm.value = this.currentWpm;
      if (valWpm) valWpm.textContent = `${this.currentWpm} WPM`;
      this.syncStorage({ wpm: this.currentWpm });
    });

    btnWpmInc.addEventListener('click', () => {
      this.currentWpm = Math.min(350, this.currentWpm + 10);
      labelWpm.textContent = `${this.currentWpm} WPM`;
      if (rangeWpm) rangeWpm.value = this.currentWpm;
      if (valWpm) valWpm.textContent = `${this.currentWpm} WPM`;
      this.syncStorage({ wpm: this.currentWpm });
    });

    // Toolbar WPM slider & steppers
    if (rangeWpm) {
      rangeWpm.addEventListener('input', () => {
        this.currentWpm = parseInt(rangeWpm.value, 10);
        labelWpm.textContent = `${this.currentWpm} WPM`;
        if (valWpm) valWpm.textContent = `${this.currentWpm} WPM`;
        this.syncStorage({ wpm: this.currentWpm });
      });
    }
    if (btnWpmDec2) {
      btnWpmDec2.addEventListener('click', () => { btnWpmDec.click(); });
    }
    if (btnWpmInc2) {
      btnWpmInc2.addEventListener('click', () => { btnWpmInc.click(); });
    }

    // Font size controls
    const applyFontSize = () => {
      textEl.style.setProperty('--pip-font-size', `${this.currentFontSize}px`);
      if (valFont) valFont.textContent = `${this.currentFontSize}px`;
      if (rangeFont) rangeFont.value = this.currentFontSize;
      this.syncStorage({ fontSize: this.currentFontSize });
    };

    if (btnFontDec) {
      btnFontDec.addEventListener('click', () => {
        this.currentFontSize = Math.max(16, this.currentFontSize - 2);
        applyFontSize();
      });
    }

    if (btnFontInc) {
      btnFontInc.addEventListener('click', () => {
        this.currentFontSize = Math.min(48, this.currentFontSize + 2);
        applyFontSize();
      });
    }

    if (rangeFont) {
      rangeFont.addEventListener('input', () => {
        this.currentFontSize = parseInt(rangeFont.value, 10);
        applyFontSize();
      });
    }

    // Transparency toggle (header button)
    btnTrans.addEventListener('click', () => {
      this.isTransparent = !this.isTransparent;
      this.currentOpacity = this.isTransparent ? 0.35 : 0.94;
      updateContainerClass();
      btnTrans.classList.toggle('active', this.isTransparent);
      transIcon.textContent = this.isTransparent ? '⬛' : '🪟';
      transLabel.textContent = this.isTransparent ? 'Solid' : 'Glass';
      if (rangeOpacity) rangeOpacity.value = this.currentOpacity;
      syncPresetBtns();
      this.syncStorage({ isTransparentMode: this.isTransparent, opacity: this.currentOpacity });
    });

    // Opacity presets
    presetBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const preset = btn.dataset.preset;
        switch (preset) {
          case 'solid':
            this.isTransparent = false;
            this.currentOpacity = 0.94;
            break;
          case 'dark':
            this.isTransparent = false;
            this.currentOpacity = 0.75;
            break;
          case 'glass':
            this.isTransparent = true;
            this.currentOpacity = 0.35;
            break;
          case 'clear':
            this.isTransparent = true;
            this.currentOpacity = 0.05;
            break;
        }
        updateContainerClass();
        btnTrans.classList.toggle('active', this.isTransparent);
        transIcon.textContent = this.isTransparent ? '⬛' : '🪟';
        transLabel.textContent = this.isTransparent ? 'Solid' : 'Glass';
        if (rangeOpacity) rangeOpacity.value = this.currentOpacity;
        syncPresetBtns();
        this.syncStorage({ isTransparentMode: this.isTransparent, opacity: this.currentOpacity });
      });
    });

    // Opacity slider
    if (rangeOpacity) {
      rangeOpacity.addEventListener('input', () => {
        this.currentOpacity = parseFloat(rangeOpacity.value);
        this.isTransparent = this.currentOpacity < 0.65;
        updateContainerClass();
        btnTrans.classList.toggle('active', this.isTransparent);
        transIcon.textContent = this.isTransparent ? '⬛' : '🪟';
        transLabel.textContent = this.isTransparent ? 'Solid' : 'Glass';
        syncPresetBtns();
        this.syncStorage({ isTransparentMode: this.isTransparent, opacity: this.currentOpacity });
      });
    }

    // Color picker
    if (selectColor) {
      selectColor.addEventListener('change', () => {
        this.currentTextColor = selectColor.value;
        textEl.style.color = this.currentTextColor;
        this.syncStorage({ textColor: this.currentTextColor });
      });
      // Apply initial color
      textEl.style.color = this.currentTextColor;
    }

    // Mode dropdown
    if (selectMode) {
      selectMode.addEventListener('change', () => {
        this.currentTrackingMode = selectMode.value;
        this.syncStorage({ trackingMode: this.currentTrackingMode });
      });
    }

    // Ghost mode toggle
    const toggleGhost = () => {
      this.isGhostMode = !this.isGhostMode;
      updateContainerClass();
      if (btnGhost) btnGhost.classList.toggle('active', this.isGhostMode);
    };
    if (btnGhost) btnGhost.addEventListener('click', toggleGhost);
    if (ghostPill) ghostPill.addEventListener('click', toggleGhost);

    // Toolbar toggle
    if (btnControls) {
      btnControls.addEventListener('click', () => {
        this.isToolbarCollapsed = !this.isToolbarCollapsed;
        if (toolbar) toolbar.classList.toggle('pip-toolbar-collapsed', this.isToolbarCollapsed);
        if (ctrlArrow) ctrlArrow.textContent = this.isToolbarCollapsed ? '▼' : '▲';
        btnControls.classList.toggle('active', !this.isToolbarCollapsed);
      });
    }

    // Nudge up / down
    if (btnNudgeUp) {
      btnNudgeUp.addEventListener('click', () => {
        viewport.scrollTop = Math.max(0, viewport.scrollTop - 40);
      });
    }
    if (btnNudgeDown) {
      btnNudgeDown.addEventListener('click', () => {
        viewport.scrollTop += 40;
      });
    }

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
      } else if (e.altKey && e.key === 's') {
        e.preventDefault();
        if (btnControls) btnControls.click();
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
            if (rangeWpm) rangeWpm.value = this.currentWpm;
            if (valWpm) valWpm.textContent = `${this.currentWpm} WPM`;
          }
          if (s.fontSize && s.fontSize !== this.currentFontSize) {
            this.currentFontSize = s.fontSize;
            textEl.style.setProperty('--pip-font-size', `${this.currentFontSize}px`);
            if (rangeFont) rangeFont.value = this.currentFontSize;
            if (valFont) valFont.textContent = `${this.currentFontSize}px`;
          }
          if (typeof s.isTransparentMode === 'boolean' && s.isTransparentMode !== this.isTransparent) {
            this.isTransparent = s.isTransparentMode;
            updateContainerClass();
            btnTrans.classList.toggle('active', this.isTransparent);
            transIcon.textContent = this.isTransparent ? '⬛' : '🪟';
            transLabel.textContent = this.isTransparent ? 'Solid' : 'Glass';
          }
          if (s.textColor && s.textColor !== this.currentTextColor) {
            this.currentTextColor = s.textColor;
            textEl.style.color = this.currentTextColor;
            if (selectColor) selectColor.value = this.currentTextColor;
          }
          if (s.trackingMode && s.trackingMode !== this.currentTrackingMode) {
            this.currentTrackingMode = s.trackingMode;
            if (selectMode) selectMode.value = this.currentTrackingMode;
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
    const stopBtn = doc.getElementById('pip-btn-rec-stop');
    const icon = doc.getElementById('pip-rec-icon');
    const label = doc.getElementById('pip-rec-label');

    if (!recBtn) return;
    if (isRecording) {
      recBtn.classList.add('pip-recording');
      recBtn.title = 'Recording active. Click Stop to finish.';
      if (icon) icon.textContent = '🔴';
      if (label) label.textContent = ` ${timeStr}`;
      if (stopBtn) stopBtn.style.display = 'inline-flex';
    } else {
      recBtn.classList.remove('pip-recording');
      recBtn.title = 'Record Screen / Window / Tab or Camera';
      if (icon) icon.textContent = '🔴';
      if (label) label.textContent = 'Rec';
      if (stopBtn) stopBtn.style.display = 'none';
    }
  }

  /**
   * Display instant video preview & download modal inside PiP window
   */
  showRecordingModal(take) {
    this.currentTake = take;
    if (!this.activePiPWindow || this.activePiPWindow.closed) return;
    const doc = this.activePiPWindow.document;
    const previewModal = doc.getElementById('pip-preview-modal');
    const previewVideo = doc.getElementById('pip-preview-video');
    const statDur = doc.getElementById('pip-stat-dur');
    const statSize = doc.getElementById('pip-stat-size');

    if (statDur) statDur.textContent = `⏱ ${take.formattedTime || '00:00'}`;
    if (statSize) statSize.textContent = `💾 ${take.fileSizeFormatted || '0 MB'}`;

    if (previewVideo && take.url) {
      previewVideo.src = take.url;
      previewVideo.play().catch(() => {});
    }

    if (previewModal) previewModal.style.display = 'flex';
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
        isTransparent: this.isTransparent,
        opacity: this.currentOpacity,
        textColor: this.currentTextColor,
        trackingMode: this.currentTrackingMode
      });
    }
  }

  syncStorage(data) {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      if (data.wpm || data.fontSize || typeof data.isTransparentMode === 'boolean' ||
          data.textColor || data.trackingMode || typeof data.opacity === 'number') {
        chrome.storage.local.get('settings', (res) => {
          const settings = res.settings || {};
          if (data.wpm) settings.wpm = data.wpm;
          if (data.fontSize) settings.fontSize = data.fontSize;
          if (typeof data.isTransparentMode === 'boolean') settings.isTransparentMode = data.isTransparentMode;
          if (data.textColor) settings.textColor = data.textColor;
          if (data.trackingMode) settings.trackingMode = data.trackingMode;
          if (typeof data.opacity === 'number') settings.opacity = data.opacity;
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
        padding: calc(3.5px * var(--pip-scale, 1)) calc(8px * var(--pip-scale, 1));
        background: rgba(16, 22, 38, 0.95);
        border: none !important;
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
        gap: calc(4px * var(--pip-scale, 1));
        flex-shrink: 0;
        min-height: calc(28px * var(--pip-scale, 1));
        box-sizing: border-box;
      }
      .pip-transparent .pip-header {
        background: rgba(12, 16, 30, 0.75);
      }
      .pip-brand {
        display: flex;
        align-items: center;
        gap: calc(3.5px * var(--pip-scale, 1));
        font-size: calc(10.5px * var(--pip-scale, 1));
        font-weight: 800;
        color: #00F0FF;
        white-space: nowrap;
        flex-shrink: 0;
      }
      .pip-logo {
        font-size: calc(12px * var(--pip-scale, 1));
      }
      .pip-pill {
        background: rgba(0, 255, 136, 0.15);
        border: none !important;
        color: #00FF88;
        font-size: calc(8.5px * var(--pip-scale, 1));
        padding: calc(1.5px * var(--pip-scale, 1)) calc(5px * var(--pip-scale, 1));
        border-radius: 20px;
        text-transform: uppercase;
        font-weight: 700;
      }
      .pip-actions {
        display: flex;
        align-items: center;
        gap: calc(3px * var(--pip-scale, 1));
        flex-wrap: nowrap;
        overflow-x: auto;
        scrollbar-width: none;
        -ms-overflow-style: none;
        flex-shrink: 0;
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
        font-size: calc(9px * var(--pip-scale, 1));
        font-weight: 700;
        padding: 0 calc(6px * var(--pip-scale, 1));
        border-radius: calc(20px * var(--pip-scale, 1));
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: calc(3px * var(--pip-scale, 1));
        white-space: nowrap;
        transition: all 0.15s ease;
        height: calc(19px * var(--pip-scale, 1));
        box-sizing: border-box;
        flex-shrink: 0;
        line-height: 1;
      }
      .pip-btn:hover {
        background: rgba(0, 240, 255, 0.25);
        color: #00F0FF;
      }
      /* Compact Rec & Play Buttons - Uniform 19px */
      .pip-btn-rec, .pip-btn-play {
        padding: 0 calc(6px * var(--pip-scale, 1));
        font-size: calc(9px * var(--pip-scale, 1));
        height: calc(19px * var(--pip-scale, 1));
        font-weight: 800;
        gap: calc(3px * var(--pip-scale, 1));
        box-sizing: border-box;
        flex-shrink: 0;
      }
      .pip-btn-rec {
        background: rgba(239, 68, 68, 0.22);
        color: #FF6B6B;
      }
      .pip-btn-rec:hover {
        background: rgba(239, 68, 68, 0.4);
        color: #FFF;
      }
      .pip-btn-rec.pip-recording {
        background: #EF4444 !important;
        color: #FFF !important;
        box-shadow: 0 0 10px rgba(239, 68, 68, 0.8);
        animation: pipPulseRec 1.2s infinite ease-in-out;
      }
      .pip-btn-rec-stop {
        padding: 0 calc(6px * var(--pip-scale, 1));
        font-size: calc(9px * var(--pip-scale, 1));
        height: calc(19px * var(--pip-scale, 1));
        font-weight: 900;
        background: linear-gradient(135deg, #DC2626, #991B1B) !important;
        color: #FFFFFF !important;
        border: none !important;
        border-radius: calc(20px * var(--pip-scale, 1)) !important;
        cursor: pointer !important;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: calc(3px * var(--pip-scale, 1));
        box-shadow: 0 0 10px rgba(239, 68, 68, 0.85);
        animation: pipPulseRec 1.1s infinite ease-in-out;
        box-sizing: border-box;
        flex-shrink: 0;
      }
      .pip-btn-rec-stop:hover {
        background: #EF4444 !important;
        box-shadow: 0 0 16px rgba(239, 68, 68, 1);
        transform: scale(1.04);
      }
      #pip-stop-icon {
        font-size: calc(7.5px * var(--pip-scale, 1));
        line-height: 1;
      }
      @keyframes pipPulseRec {
        0%, 100% { opacity: 1; transform: scale(1); }
        50% { opacity: 0.88; transform: scale(0.97); }
      }
      .pip-btn-play {
        background: #00F0FF;
        color: #080C16;
      }
      .pip-btn-play:hover {
        background: #33F5FF;
        color: #000;
      }
      .pip-btn-play.active {
        background: #FF0055;
        color: #FFF;
      }
      #pip-rec-icon {
        font-size: calc(7.5px * var(--pip-scale, 1));
        line-height: 1;
        display: inline-flex;
        align-items: center;
        justify-content: center;
      }
      #pip-play-icon {
        font-size: calc(7.5px * var(--pip-scale, 1));
        line-height: 1;
        display: inline-flex;
        align-items: center;
        justify-content: center;
      }
      .pip-speed-pill, .pip-font-steppers {
        display: inline-flex;
        align-items: center;
        gap: calc(2px * var(--pip-scale, 1));
        background: rgba(255, 255, 255, 0.08);
        border: none !important;
        padding: 0 calc(4px * var(--pip-scale, 1));
        border-radius: calc(20px * var(--pip-scale, 1));
        font-size: calc(9px * var(--pip-scale, 1));
        color: #00F0FF;
        font-weight: 700;
        white-space: nowrap;
        height: calc(19px * var(--pip-scale, 1));
        box-sizing: border-box;
        flex-shrink: 0;
        line-height: 1;
      }
      .pip-btn-step {
        width: calc(14px * var(--pip-scale, 1));
        height: calc(14px * var(--pip-scale, 1));
        background: rgba(255, 255, 255, 0.12);
        border: none !important;
        color: #FFF;
        border-radius: 50%;
        cursor: pointer;
        font-size: calc(8px * var(--pip-scale, 1));
        font-weight: 800;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        transition: all 0.15s ease;
        box-sizing: border-box;
        flex-shrink: 0;
        padding: 0;
        line-height: 1;
      }
      .pip-btn-step:hover {
        background: #00F0FF;
        color: #0A0D18;
      }
      .pip-select-script {
        background: rgba(255, 255, 255, 0.08);
        border: none !important;
        color: #FFF;
        font-size: calc(9px * var(--pip-scale, 1));
        padding: 0 calc(5px * var(--pip-scale, 1));
        border-radius: calc(16px * var(--pip-scale, 1));
        max-width: calc(115px * var(--pip-scale, 1));
        height: calc(19px * var(--pip-scale, 1));
        outline: none;
        cursor: pointer;
        box-sizing: border-box;
        flex-shrink: 0;
      }
      .pip-btn-close {
        background: transparent;
        border: none !important;
        color: #94A3B8;
        font-size: calc(9.5px * var(--pip-scale, 1));
        font-weight: 800;
        cursor: pointer;
        padding: 0;
        border-radius: 50%;
        transition: all 0.15s ease;
        height: calc(19px * var(--pip-scale, 1));
        width: calc(19px * var(--pip-scale, 1));
        min-width: calc(19px * var(--pip-scale, 1));
        display: inline-flex;
        align-items: center;
        justify-content: center;
        box-sizing: border-box;
        flex-shrink: 0;
        line-height: 1;
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
        padding: calc(14px * var(--pip-scale, 1)) calc(18px * var(--pip-scale, 1)) calc(120px * var(--pip-scale, 1)) calc(18px * var(--pip-scale, 1));
        border: none !important;
      }
      .pip-viewport::-webkit-scrollbar {
        display: none;
      }
      .pip-focus-line {
        position: sticky;
        top: calc(24px * var(--pip-scale, 1));
        height: calc(1.5 * var(--pip-font-size, 24px) * var(--pip-scale, 1));
        border: none !important;
        background: rgba(0, 240, 255, 0.1);
        box-shadow: 0 0 calc(12px * var(--pip-scale, 1)) rgba(0, 240, 255, 0.25);
        border-radius: calc(8px * var(--pip-scale, 1));
        pointer-events: none;
        margin-bottom: calc(-1.5 * var(--pip-font-size, 24px) * var(--pip-scale, 1));
        z-index: 10;
      }
      .pip-text {
        font-size: calc(var(--pip-font-size, 24px) * var(--pip-scale, 1));
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

      /* Fast Preview & Download Modal Styles */
      .pip-preview-card {
        max-width: calc(380px * var(--pip-scale, 1)) !important;
      }
      .pip-preview-body {
        display: flex;
        flex-direction: column;
        gap: calc(8px * var(--pip-scale, 1));
      }
      .pip-preview-video {
        width: 100%;
        max-height: calc(140px * var(--pip-scale, 1));
        border-radius: calc(8px * var(--pip-scale, 1));
        background: #000;
        outline: none;
      }
      .pip-preview-stats {
        display: flex;
        align-items: center;
        gap: calc(6px * var(--pip-scale, 1));
        flex-wrap: wrap;
      }
      .pip-stat-tag {
        font-size: calc(9.5px * var(--pip-scale, 1));
        font-weight: 700;
        background: rgba(255, 255, 255, 0.08);
        color: #CBD5E1;
        padding: calc(2px * var(--pip-scale, 1)) calc(8px * var(--pip-scale, 1));
        border-radius: 12px;
      }
      .pip-stat-shield {
        color: #00FF88 !important;
        background: rgba(0, 255, 136, 0.15) !important;
      }
      .pip-preview-footer {
        display: flex;
        justify-content: flex-end;
        margin-top: calc(4px * var(--pip-scale, 1));
      }
      .pip-btn-preview-dl {
        background: linear-gradient(135deg, #00F0FF, #0099FF) !important;
        color: #080C16 !important;
        font-weight: 900 !important;
        font-size: calc(10.5px * var(--pip-scale, 1)) !important;
        height: calc(26px * var(--pip-scale, 1)) !important;
        padding: 0 calc(14px * var(--pip-scale, 1)) !important;
        border-radius: 20px !important;
        border: none !important;
        cursor: pointer !important;
        box-shadow: 0 0 12px rgba(0, 240, 255, 0.6) !important;
        transition: transform 0.15s ease, box-shadow 0.15s ease !important;
        display: inline-flex;
        align-items: center;
        gap: 5px;
      }
      .pip-btn-preview-dl:hover {
        transform: scale(1.04);
        box-shadow: 0 0 18px rgba(0, 240, 255, 0.9) !important;
      }

      /* Responsive Elastic Classes */
      .pip-size-xs .pip-title-text,
      .pip-size-xs .pip-pill,
      .pip-size-xs #pip-play-label,
      .pip-size-xs #pip-rec-label,
      .pip-size-xs #pip-stop-label,
      .pip-size-xs #pip-trans-label,
      .pip-size-xs .pip-ghost-label,
      .pip-size-xs .pip-ctrl-label {
        display: none !important;
      }
      .pip-size-xs .pip-header {
        padding: calc(3px * var(--pip-scale, 1)) calc(5px * var(--pip-scale, 1));
        gap: calc(3px * var(--pip-scale, 1));
      }
      .pip-size-xs .pip-select-script {
        max-width: 80px;
      }
      .pip-size-sm .pip-pill {
        display: none !important;
      }
      .pip-size-sm .pip-select-script {
        max-width: 100px;
      }

      /* Nudge + Rewind buttons - Completely Borderless Circular Pills (Uniform 19px) */
      .pip-btn-nudge, .pip-btn-rewind {
        width: calc(19px * var(--pip-scale, 1));
        min-width: calc(19px * var(--pip-scale, 1));
        height: calc(19px * var(--pip-scale, 1));
        padding: 0;
        font-size: calc(8px * var(--pip-scale, 1));
        border: none !important;
        outline: none !important;
        border-radius: 50%;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        box-sizing: border-box;
        flex-shrink: 0;
        line-height: 1;
      }

      /* Ghost Mode Toggle Button - Borderless (Uniform 19px) */
      .pip-btn-ghost-toggle {
        background: rgba(255, 255, 255, 0.08);
        color: #CBD5E1;
        border: none !important;
        outline: none !important;
        border-radius: calc(20px * var(--pip-scale, 1));
        height: calc(19px * var(--pip-scale, 1));
        font-size: calc(9px * var(--pip-scale, 1));
        padding: 0 calc(6px * var(--pip-scale, 1));
        box-sizing: border-box;
        flex-shrink: 0;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: calc(3px * var(--pip-scale, 1));
        line-height: 1;
      }
      .pip-btn-ghost-toggle:hover {
        background: rgba(0, 240, 255, 0.15);
        color: #00F0FF;
      }
      .pip-btn-ghost-toggle.active {
        background: rgba(0, 240, 255, 0.2);
        color: #00F0FF;
        box-shadow: 0 0 8px rgba(0, 240, 255, 0.3);
      }

      /* Controls Toggle Button - Borderless (Uniform 19px) */
      .pip-btn-controls {
        background: rgba(255, 255, 255, 0.08);
        color: #CBD5E1;
        font-size: calc(9px * var(--pip-scale, 1));
        border: none !important;
        outline: none !important;
        border-radius: calc(20px * var(--pip-scale, 1));
        height: calc(19px * var(--pip-scale, 1));
        padding: 0 calc(6px * var(--pip-scale, 1));
        box-sizing: border-box;
        flex-shrink: 0;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: calc(3px * var(--pip-scale, 1));
        line-height: 1;
      }
      .pip-btn-controls:hover {
        background: rgba(0, 240, 255, 0.15);
        color: #00F0FF;
      }
      .pip-btn-controls.active {
        background: rgba(0, 240, 255, 0.22);
        color: #00F0FF;
        box-shadow: 0 0 8px rgba(0, 240, 255, 0.3);
      }

      /* Collapsible Toolbar - Clean Organized Grid */
      .pip-toolbar {
        display: flex;
        flex-direction: column;
        gap: calc(7px * var(--pip-scale, 1));
        padding: calc(9px * var(--pip-scale, 1)) calc(12px * var(--pip-scale, 1));
        background: rgba(12, 16, 28, 0.96);
        border: none !important;
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.05), 0 8px 24px rgba(0, 0, 0, 0.6);
        flex-shrink: 0;
        overflow: hidden;
        max-height: 280px;
        transition: max-height 0.25s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.2s ease, padding 0.25s ease;
      }
      .pip-toolbar.pip-toolbar-collapsed {
        max-height: 0 !important;
        opacity: 0 !important;
        padding-top: 0 !important;
        padding-bottom: 0 !important;
        pointer-events: none !important;
        border: none !important;
        overflow: hidden !important;
      }

      .pip-tb-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: calc(10px * var(--pip-scale, 1));
        width: 100%;
      }

      .pip-tb-cell {
        display: flex;
        align-items: center;
        gap: calc(6px * var(--pip-scale, 1));
        flex: 1;
        min-width: 0;
      }

      .pip-tb-controls {
        display: flex;
        align-items: center;
        gap: calc(4px * var(--pip-scale, 1));
        flex: 1;
        min-width: 0;
      }

      .pip-tb-divider {
        height: 1px;
        background: rgba(255, 255, 255, 0.06);
        width: 100%;
        margin: calc(1px * var(--pip-scale, 1)) 0;
      }

      .pip-tb-label {
        font-size: calc(10px * var(--pip-scale, 1));
        color: #94A3B8;
        font-weight: 700;
        white-space: nowrap;
        display: inline-flex;
        align-items: center;
        gap: 3px;
      }
      .pip-tb-val {
        font-size: calc(10px * var(--pip-scale, 1));
        color: #00F0FF;
        font-weight: 800;
        min-width: calc(36px * var(--pip-scale, 1));
        white-space: nowrap;
      }

      /* Range Sliders - Modern Borderless Glass Track */
      .pip-range {
        -webkit-appearance: none;
        appearance: none;
        flex: 1;
        min-width: calc(50px * var(--pip-scale, 1));
        height: calc(4px * var(--pip-scale, 1));
        border-radius: 10px;
        background: rgba(255, 255, 255, 0.15);
        outline: none !important;
        cursor: pointer;
        border: none !important;
      }
      .pip-range::-webkit-slider-thumb {
        -webkit-appearance: none;
        appearance: none;
        width: calc(13px * var(--pip-scale, 1));
        height: calc(13px * var(--pip-scale, 1));
        border-radius: 50%;
        background: #00F0FF;
        box-shadow: 0 0 8px rgba(0, 240, 255, 0.8);
        cursor: pointer;
        border: none !important;
        transition: transform 0.15s ease, box-shadow 0.15s ease;
      }
      .pip-range::-webkit-slider-thumb:hover {
        transform: scale(1.2);
        box-shadow: 0 0 12px #00F0FF;
      }

      /* Preset Buttons - Borderless Rounded Pills */
      .pip-preset-btn {
        height: calc(21px * var(--pip-scale, 1)) !important;
        padding: calc(2px * var(--pip-scale, 1)) calc(8px * var(--pip-scale, 1)) !important;
        font-size: calc(9.5px * var(--pip-scale, 1)) !important;
        background: rgba(255, 255, 255, 0.08) !important;
        color: #CBD5E1 !important;
        border: none !important;
        outline: none !important;
        border-radius: 20px !important;
        cursor: pointer;
        font-weight: 700 !important;
        transition: all 0.15s ease;
        white-space: nowrap;
      }
      .pip-preset-btn:hover {
        background: rgba(0, 240, 255, 0.2) !important;
        color: #00F0FF !important;
      }
      .pip-preset-btn.active {
        background: #00F0FF !important;
        color: #0A0E1A !important;
        box-shadow: 0 0 10px rgba(0, 240, 255, 0.6) !important;
        font-weight: 900 !important;
      }

      /* Toolbar Selects - Borderless Rounded Glass Dropdown */
      .pip-select {
        background: rgba(255, 255, 255, 0.08);
        border: none !important;
        outline: none !important;
        color: #E2E8F0;
        font-size: calc(10px * var(--pip-scale, 1));
        font-weight: 600;
        border-radius: 20px;
        padding: calc(2.5px * var(--pip-scale, 1)) calc(8px * var(--pip-scale, 1));
        cursor: pointer;
        height: calc(22px * var(--pip-scale, 1));
        flex: 1;
        min-width: 0;
        transition: background 0.15s ease, box-shadow 0.15s ease;
      }
      .pip-select:hover {
        background: rgba(255, 255, 255, 0.14);
        color: #00F0FF;
      }
      .pip-select:focus {
        background: rgba(20, 28, 50, 0.95);
        box-shadow: 0 0 8px rgba(0, 240, 255, 0.4);
      }
      .pip-select option {
        background: #101628;
        color: #FFF;
      }

      /* Ghost Mode click-through styles */
      .pip-ghost {
        pointer-events: none !important;
      }
      .pip-ghost .pip-header,
      .pip-ghost .pip-toolbar {
        pointer-events: none !important;
      }
      .pip-ghost-pill {
        display: none;
        position: absolute;
        top: calc(8px * var(--pip-scale, 1));
        right: calc(12px * var(--pip-scale, 1));
        background: #111728;
        border: none !important;
        border-radius: 20px;
        padding: calc(4px * var(--pip-scale, 1)) calc(12px * var(--pip-scale, 1));
        font-size: calc(10px * var(--pip-scale, 1));
        font-weight: 700;
        color: #00F0FF;
        cursor: pointer;
        box-shadow: 0 0 12px rgba(0, 240, 255, 0.5);
        z-index: 999;
        pointer-events: auto !important;
      }
      .pip-ghost .pip-ghost-pill {
        display: block;
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
