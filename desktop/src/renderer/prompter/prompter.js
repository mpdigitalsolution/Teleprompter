/**
 * GhostPrompter Desktop — Prompter Overlay Renderer Controller
 * Coordinates physics scrolling, ghost mode, Apple visionOS UI, and IPC.
 */

document.addEventListener('DOMContentLoaded', async () => {
  const prompterWindow = document.getElementById('prompter-window');
  const viewport = document.getElementById('prompter-viewport');
  const scriptContent = document.getElementById('script-content');
  const btnPlay = document.getElementById('btn-play-toggle');
  const playIcon = document.getElementById('play-icon');
  const playText = document.getElementById('play-text');
  const btnRecord = document.getElementById('btn-record-toggle');
  const recordDot = document.getElementById('record-dot');
  const recordLabel = document.getElementById('record-label');
  const recordTimer = document.getElementById('record-timer');
  const speedDisplay = document.getElementById('speed-display');
  const btnSpeedDown = document.getElementById('btn-speed-down');
  const btnSpeedUp = document.getElementById('btn-speed-up');
  const fontDisplay = document.getElementById('font-display');
  const btnFontDown = document.getElementById('btn-font-down');
  const btnFontUp = document.getElementById('btn-font-up');
  const opacitySelect = document.getElementById('opacity-select');
  const btnFocusToggle = document.getElementById('btn-focus-toggle');
  const focusBar = document.getElementById('focus-reading-bar');
  const brandBadge = document.getElementById('brand-badge');
  const btnGhostToggle = document.getElementById('btn-ghost-toggle');
  const ghostFloatingPill = document.getElementById('ghost-floating-pill');
  const btnOpenStudio = document.getElementById('btn-open-studio');
  const btnModalOpenStudio = document.getElementById('btn-modal-open-studio');
  const btnSettingsToggle = document.getElementById('btn-settings-toggle');
  const prompterHeader = document.getElementById('prompter-header');
  const headerDragHandle = document.getElementById('header-drag-handle');
  const trafficClose = document.getElementById('traffic-close');
  const trafficMin = document.getElementById('traffic-min');
  const trafficMax = document.getElementById('traffic-max');
  const btnIslandExpand = document.getElementById('btn-island-expand');
  const btnCompactToggle = document.getElementById('btn-compact-toggle');
  const btnWinMin = document.getElementById('btn-win-min');
  const btnWinMax = document.getElementById('btn-win-max');
  const winMaxIcon = document.getElementById('win-max-icon');

  // Settings Modal Elements (Speed, Font Size, Color)
  const settingsOverlay = document.getElementById('settings-overlay');
  const btnSettingsClose = document.getElementById('btn-settings-close');
  const btnSettingsDone = document.getElementById('btn-settings-done');
  const btnSettingsReset = document.getElementById('btn-settings-reset');
  const settingsSpeedSlider = document.getElementById('settings-speed-slider');
  const settingsSpeedBadge = document.getElementById('settings-speed-badge');
  const settingsSpeedMinus = document.getElementById('settings-speed-minus');
  const settingsSpeedPlus = document.getElementById('settings-speed-plus');
  const settingsFontSlider = document.getElementById('settings-font-slider');
  const settingsFontBadge = document.getElementById('settings-font-badge');
  const settingsFontMinus = document.getElementById('settings-font-minus');
  const settingsFontPlus = document.getElementById('settings-font-plus');
  const settingsColorBadge = document.getElementById('settings-color-badge');
  const settingsCustomColor = document.getElementById('settings-custom-color');
  const settingsOpacitySelect = document.getElementById('settings-opacity-select');
  const btnAlignLeft = document.getElementById('btn-align-left');
  const btnAlignCenter = document.getElementById('btn-align-center');
  const btnAlignRight = document.getElementById('btn-align-right');

  // Studio Mode Elements
  const modeBadge = document.getElementById('mode-badge');
  const studioStage = document.getElementById('studio-stage');
  const studioWebcam = document.getElementById('studio-webcam');
  const studioFramingGuides = document.getElementById('studio-framing-guides');
  const btnStudioGuides = document.getElementById('btn-studio-guides');
  const btnStudioMirror = document.getElementById('btn-studio-mirror');
  const btnStudioExit = document.getElementById('btn-studio-exit');
  const tabBtnStudio = document.getElementById('tab-btn-studio');

  // Movable & Resizable Teleprompter Card Elements
  const prompterCardContainer = document.getElementById('prompter-card-container');
  const cardDragBar = document.getElementById('card-drag-bar');
  const cardDragDots = document.getElementById('card-drag-dots');
  const cardResizeBar = document.getElementById('card-resize-bar');
  const cardResizeCorner = document.getElementById('card-resize-corner');
  const cardResizeEdgeRight = document.getElementById('card-resize-edge-right');
  const btnCardLeft = document.getElementById('btn-card-left');
  const btnCardCenter = document.getElementById('btn-card-center');
  const btnCardRight = document.getElementById('btn-card-right');
  const btnCardTop = document.getElementById('btn-card-top');
  const btnCardMid = document.getElementById('btn-card-mid');
  const btnCardBot = document.getElementById('btn-card-bot');
  const btnCardTextLeft = document.getElementById('btn-card-text-left');
  const btnCardTextCenter = document.getElementById('btn-card-text-center');
  const btnCardTextRight = document.getElementById('btn-card-text-right');
  const btnCardFontDown = document.getElementById('btn-card-font-down');
  const btnCardFontUp = document.getElementById('btn-card-font-up');

  // Source Picker Modal Elements
  const pickerOverlay = document.getElementById('picker-overlay');
  const btnPickerClose = document.getElementById('btn-picker-close');
  const btnPickerCancel = document.getElementById('btn-picker-cancel');
  const btnPickerShare = document.getElementById('btn-picker-share');
  const tabBtnChrome = document.getElementById('tab-btn-chrome');
  const tabBtnWindows = document.getElementById('tab-btn-windows');
  const tabBtnScreens = document.getElementById('tab-btn-screens');
  const pickerSourceList = document.getElementById('picker-source-list');
  const previewPlaceholder = document.getElementById('picker-preview-placeholder');
  const previewPlaceholderText = document.getElementById('preview-placeholder-text');
  const previewImage = document.getElementById('picker-preview-image');
  const previewName = document.getElementById('picker-preview-name');
  const chkMic = document.getElementById('picker-chk-mic');
  const pickerAudioLabel = document.getElementById('picker-audio-label');

  // Take Export Modal Elements
  const takeOverlay = document.getElementById('take-modal-overlay');
  const takeStatDuration = document.getElementById('take-stat-duration');
  const takeStatSize = document.getElementById('take-stat-size');
  const btnTakeDiscard = document.getElementById('btn-take-discard');
  const btnTakeSave = document.getElementById('btn-take-save');

  // 5-Second Countdown Elements
  const countdownOverlay = document.getElementById('countdown-overlay');
  const countdownNumber = document.getElementById('countdown-number');
  const countdownSourceLabel = document.getElementById('countdown-source-label');
  const countdownCircleProgress = document.getElementById('countdown-circle-progress');
  const btnCountdownCancel = document.getElementById('btn-countdown-cancel');
  let countdownInterval = null;

  let currentSpeed = 160;
  let currentScript = null;
  let isGhost = false;
  let isCompact = false;

  // Studio Mode State (Half-Body Webcam with Teleprompter on Top)
  let isStudioMode = false;
  let studioWebcamStream = null;
  let isGuidesVisible = true;
  let isWebcamMirrored = true;

  // Recording State
  let isRecording = false;
  let mediaRecorder = null;
  let recordedChunks = [];
  let recordSeconds = 0;
  let recordTimerInterval = null;
  let activeStream = null;
  let currentTakeBlob = null;
  let currentTakeSessionPath = null;
  let currentTakeSessionStats = null;
  let sessionActive = false;
  let availableSources = [];
  let selectedSource = null;
  let currentTabType = 'window';

  // Initialize Physics Scroller
  const scroller = new ScrollerEngine(viewport, {
    speedWPM: currentSpeed,
    onStateChange: (isPlaying) => {
      updatePlayButtonUI(isPlaying);
      syncStateToMain(isPlaying);
    }
  });

  function updatePlayButtonUI(isPlaying) {
    if (isPlaying) {
      btnPlay.classList.remove('btn-apple-green');
      btnPlay.classList.add('btn-apple-danger');
      playIcon.textContent = '⏸';
      playText.textContent = 'Pause';
    } else {
      btnPlay.classList.remove('btn-apple-danger');
      btnPlay.classList.add('btn-apple-green');
      playIcon.textContent = '▶';
      playText.textContent = 'Start';
    }
  }

  function syncStateToMain(isPlaying) {
    if (window.prompterAPI && window.prompterAPI.notifyStateChanged) {
      window.prompterAPI.notifyStateChanged({
        isPlaying,
        speed: currentSpeed,
        isGhost,
        isCompact,
        activeScriptId: currentScript ? currentScript.id : null
      });
    }
  }

  let currentFontSize = 28;
  let currentTextColor = '#FFFFFF';
  let currentTextAlign = 'left';

  const COLOR_PRESETS = [
    { color: '#FFFFFF', name: 'White' },
    { color: '#FFD60A', name: 'Studio Yellow' },
    { color: '#30D158', name: 'High-Vis Green' },
    { color: '#00F0FF', name: 'Electric Cyan' },
    { color: '#FF9F0A', name: 'Warm Amber' },
    { color: '#FF375F', name: 'Vivid Rose' }
  ];

  function updateSpeedPresetUI(speed) {
    document.querySelectorAll('#speed-presets .btn-preset-pill').forEach(btn => {
      const s = parseInt(btn.dataset.speed, 10);
      btn.classList.toggle('active', s === speed);
    });
  }

  function updateFontPresetUI(size) {
    document.querySelectorAll('#font-presets .btn-preset-pill').forEach(btn => {
      const f = parseInt(btn.dataset.font, 10);
      btn.classList.toggle('active', f === size);
    });
  }

  function updateColorSwatchUI(color) {
    document.querySelectorAll('#color-swatches .color-swatch-btn').forEach(btn => {
      const c = btn.dataset.color;
      btn.classList.toggle('active', c && c.toLowerCase() === color.toLowerCase());
    });
    if (settingsCustomColor) {
      settingsCustomColor.value = color;
    }
  }

  function updateAlignSegmentUI(align) {
    [btnAlignLeft, btnAlignCenter, btnAlignRight].forEach(btn => {
      if (btn) btn.classList.toggle('active', btn.dataset.align === align);
    });
    if (btnCardTextLeft) btnCardTextLeft.classList.toggle('active', align === 'left');
    if (btnCardTextCenter) btnCardTextCenter.classList.toggle('active', align === 'center');
    if (btnCardTextRight) btnCardTextRight.classList.toggle('active', align === 'right');
  }

  function setSpeed(wpm, fromRemote = false) {
    currentSpeed = Math.max(20, Math.min(600, wpm));
    scroller.setSpeed(currentSpeed);
    speedDisplay.innerHTML = `${currentSpeed}<span class="wpm-unit"> WPM</span>`;
    if (settingsSpeedBadge) settingsSpeedBadge.textContent = `${currentSpeed} WPM`;
    if (settingsSpeedSlider) settingsSpeedSlider.value = String(currentSpeed);
    updateSpeedPresetUI(currentSpeed);
    if (!fromRemote && window.prompterAPI) {
      window.prompterAPI.setSpeed(currentSpeed);
    }
  }

  function setFontSize(size, fromRemote = false) {
    currentFontSize = Math.max(16, Math.min(72, parseInt(size, 10) || 28));
    document.documentElement.style.setProperty('--prompter-font-size', `${currentFontSize}px`);
    if (scriptContent) {
      scriptContent.style.fontSize = `${currentFontSize}px`;
    }
    if (fontDisplay) fontDisplay.innerHTML = `${currentFontSize}<span class="font-unit"> px</span>`;
    if (settingsFontBadge) settingsFontBadge.textContent = `${currentFontSize} px`;
    if (settingsFontSlider) settingsFontSlider.value = String(currentFontSize);
    updateFontPresetUI(currentFontSize);
    if (!fromRemote && window.prompterAPI && window.prompterAPI.setFontSize) {
      window.prompterAPI.setFontSize(currentFontSize);
    }
  }

  function setTextColor(color, fromRemote = false) {
    if (!color) return;
    currentTextColor = color;
    document.documentElement.style.setProperty('--prompter-text-color', currentTextColor);
    if (scriptContent) {
      scriptContent.style.color = currentTextColor;
    }
    if (settingsColorBadge) {
      const found = COLOR_PRESETS.find(p => p.color.toLowerCase() === color.toLowerCase());
      settingsColorBadge.textContent = found ? found.name : color.toUpperCase();
    }
    updateColorSwatchUI(currentTextColor);
    if (!fromRemote && window.prompterAPI && window.prompterAPI.setTextColor) {
      window.prompterAPI.setTextColor(currentTextColor);
    }
  }

  function setTextAlign(align, fromRemote = false) {
    currentTextAlign = align || 'left';
    document.documentElement.style.setProperty('--prompter-text-align', currentTextAlign);
    if (scriptContent) {
      scriptContent.style.textAlign = currentTextAlign;
    }
    updateAlignSegmentUI(currentTextAlign);
    if (!fromRemote && window.prompterAPI && window.prompterAPI.setTextAlign) {
      window.prompterAPI.setTextAlign(currentTextAlign);
    }
  }

  function toggleSettingsModal(open) {
    if (!settingsOverlay) return;
    const shouldOpen = open !== undefined ? !!open : settingsOverlay.classList.contains('hidden');
    if (shouldOpen) {
      settingsOverlay.classList.remove('hidden');
      if (settingsSpeedSlider) settingsSpeedSlider.value = String(currentSpeed);
      if (settingsSpeedBadge) settingsSpeedBadge.textContent = `${currentSpeed} WPM`;
      if (settingsFontSlider) settingsFontSlider.value = String(currentFontSize);
      if (settingsFontBadge) settingsFontBadge.textContent = `${currentFontSize} px`;
      if (settingsOpacitySelect) {
        settingsOpacitySelect.value = opacitySelect ? opacitySelect.value : (document.documentElement.style.getPropertyValue('--prompter-opacity') || '0.85');
      }
      updateSpeedPresetUI(currentSpeed);
      updateFontPresetUI(currentFontSize);
      updateColorSwatchUI(currentTextColor);
      updateAlignSegmentUI(currentTextAlign);
    } else {
      settingsOverlay.classList.add('hidden');
    }
  }

  function setOpacity(val, fromRemote = false) {
    document.documentElement.style.setProperty('--prompter-opacity', val);
    if (opacitySelect) opacitySelect.value = String(val);
    if (settingsOpacitySelect) settingsOpacitySelect.value = String(val);
    if (!fromRemote && window.prompterAPI) {
      window.prompterAPI.setOpacity(parseFloat(val));
    }
  }

  function setFocusLine(visible) {
    if (visible) {
      focusBar.classList.remove('hidden');
    } else {
      focusBar.classList.add('hidden');
    }
  }

  function renderScript(script) {
    if (!script) return;
    currentScript = script;
    scriptContent.textContent = script.content || '';
    viewport.scrollTop = 0;
  }

  function updateMaximizedUI(isMax) {
    if (isMax) {
      prompterWindow.classList.add('is-maximized');
      if (winMaxIcon) winMaxIcon.textContent = '❐';
      if (btnWinMax) btnWinMax.title = 'Restore Window';
      if (trafficMax) trafficMax.title = 'Restore Window';
    } else {
      prompterWindow.classList.remove('is-maximized');
      if (winMaxIcon) winMaxIcon.textContent = '⤢';
      if (btnWinMax) btnWinMax.title = 'Maximize / Restore Window';
      if (trafficMax) trafficMax.title = 'Maximize / Restore Window';
    }
  }

  function updateCountdownCircle(remaining, total = 5) {
    if (!countdownCircleProgress) return;
    const circumference = 276.46;
    const progress = Math.max(0, Math.min(1, remaining / total));
    const offset = circumference * (1 - progress);
    countdownCircleProgress.style.strokeDashoffset = String(offset);
  }

  // Load Initial Store State
  if (window.prompterAPI && window.prompterAPI.getInitialData) {
    try {
      const data = await window.prompterAPI.getInitialData();
      if (data) {
        const settings = data.settings || {};
        currentSpeed = settings.scrollSpeed || 160;
        setSpeed(currentSpeed, true);

        const opacity = settings.opacity || 0.85;
        setOpacity(opacity, true);

        const focusVisible = settings.focusLineVisible !== false;
        setFocusLine(focusVisible);

        const fontSize = settings.fontSize || 28;
        setFontSize(fontSize, true);

        const textColor = settings.textColor || '#FFFFFF';
        setTextColor(textColor, true);

        const textAlign = settings.textAlign || 'left';
        setTextAlign(textAlign, true);

        const active = (data.scripts || []).find(s => s.id === data.activeScriptId) || data.scripts?.[0];
        if (active) renderScript(active);
      }
    } catch (err) {
      console.warn('[Prompter] Error loading initial data:', err);
    }
  }

  // Controls Event Listeners
  btnPlay.addEventListener('click', () => scroller.toggle());

  function formatTime(totalSecs) {
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }

  function formatFileSize(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  }

  function isBrowserWindow(name) {
    if (!name) return false;
    const lower = name.toLowerCase();
    return lower.includes('chrome') || 
           lower.includes('edge') || 
           lower.includes('brave') || 
           lower.includes('firefox') || 
           lower.includes('opera') || 
           lower.includes('vivaldi');
  }

  function getCleanBrowserTitle(name) {
    if (!name) return 'Untitled Tab';
    return name
      .replace(/\s*-\s*Google Chrome$/i, '')
      .replace(/\s*-\s*Microsoft​? Edge$/i, '')
      .replace(/\s*-\s*Brave$/i, '')
      .replace(/\s*-\s*Mozilla Firefox$/i, '')
      .replace(/\s*-\s*Opera$/i, '')
      .trim() || name;
  }

  function getBrowserBadge(name) {
    const lower = (name || '').toLowerCase();
    if (lower.includes('chrome')) return 'Chrome Tab';
    if (lower.includes('edge')) return 'Edge Tab';
    if (lower.includes('brave')) return 'Brave Tab';
    if (lower.includes('firefox')) return 'Firefox Tab';
    if (lower.includes('opera')) return 'Opera Tab';
    return 'Web Tab';
  }

  async function openSourcePicker() {
    pickerOverlay.classList.remove('hidden');
    selectedSource = null;
    btnPickerShare.setAttribute('disabled', 'true');
    previewImage.classList.add('hidden');
    previewName.classList.add('hidden');
    previewPlaceholder.classList.remove('hidden');
    pickerSourceList.innerHTML = '<div class="picker-loading">Scanning available tabs, windows & screens...</div>';

    try {
      if (window.prompterAPI && window.prompterAPI.getSources) {
        availableSources = await window.prompterAPI.getSources();
      } else {
        availableSources = [];
      }

      // Check if browser tabs are active; if so, default to Chrome Tab
      const hasBrowserTabs = availableSources.some(s => !s.isScreen && isBrowserWindow(s.name));
      currentTabType = hasBrowserTabs ? 'chrome' : 'window';

      renderSourceList();
    } catch (err) {
      pickerSourceList.innerHTML = `<div class="picker-loading" style="color: #FF453A;">Error fetching sources: ${err.message}</div>`;
    }
  }

  function closeSourcePicker() {
    pickerOverlay.classList.add('hidden');
    selectedSource = null;
  }

  function renderSourceList() {
    pickerSourceList.innerHTML = '';

    // Update active tab buttons
    [tabBtnChrome, tabBtnWindows, tabBtnScreens].forEach(btn => {
      if (btn) btn.classList.remove('active');
    });

    if (currentTabType === 'chrome') {
      if (tabBtnChrome) tabBtnChrome.classList.add('active');
      if (previewPlaceholderText) previewPlaceholderText.textContent = 'Select a tab to share';
      if (pickerAudioLabel) pickerAudioLabel.textContent = 'Share tab audio';
    } else if (currentTabType === 'window') {
      if (tabBtnWindows) tabBtnWindows.classList.add('active');
      if (previewPlaceholderText) previewPlaceholderText.textContent = 'Select a window to share';
      if (pickerAudioLabel) pickerAudioLabel.textContent = 'Record microphone voiceover';
    } else if (currentTabType === 'screen') {
      if (tabBtnScreens) tabBtnScreens.classList.add('active');
      if (previewPlaceholderText) previewPlaceholderText.textContent = 'Select a screen to share';
      if (pickerAudioLabel) pickerAudioLabel.textContent = 'Share system audio & microphone';
    }

    let filtered = [];
    if (currentTabType === 'chrome') {
      filtered = availableSources.filter(s => !s.isScreen && isBrowserWindow(s.name));
    } else if (currentTabType === 'window') {
      filtered = availableSources.filter(s => !s.isScreen && !isBrowserWindow(s.name));
      // Fallback if user only has browser windows open
      if (filtered.length === 0) {
        filtered = availableSources.filter(s => !s.isScreen);
      }
    } else {
      filtered = availableSources.filter(s => s.isScreen);
    }

    if (filtered.length === 0) {
      if (currentTabType === 'chrome') {
        pickerSourceList.innerHTML = `
          <div class="picker-loading">
            <p>No active Chrome or browser tabs detected.</p>
            <p style="margin-top: 5px; font-size: 10px; color: rgba(235, 235, 245, 0.45);">Open Google Chrome or click the <strong>Window</strong> tab above.</p>
          </div>`;
      } else {
        pickerSourceList.innerHTML = `<div class="picker-loading">No ${currentTabType === 'screen' ? 'screens' : 'windows'} found.</div>`;
      }
      return;
    }

    filtered.forEach(source => {
      const item = document.createElement('div');
      item.className = 'picker-source-item' + (selectedSource && selectedSource.id === source.id ? ' selected' : '');

      const thumb = document.createElement('img');
      thumb.className = 'source-item-thumb';
      thumb.src = source.thumbnail || '';
      thumb.alt = source.name;

      const name = document.createElement('span');
      name.className = 'source-item-name';
      const cleanTitle = currentTabType === 'chrome' ? getCleanBrowserTitle(source.name) : (source.name || 'Untitled');
      name.textContent = cleanTitle;
      name.title = source.name || '';

      item.appendChild(thumb);
      item.appendChild(name);

      if (currentTabType === 'chrome') {
        const badge = document.createElement('span');
        badge.className = 'source-item-badge';
        badge.textContent = getBrowserBadge(source.name);
        item.appendChild(badge);
      }

      item.addEventListener('click', () => {
        document.querySelectorAll('.picker-source-item').forEach(el => el.classList.remove('selected'));
        item.classList.add('selected');
        selectedSource = source;

        previewPlaceholder.classList.add('hidden');
        previewImage.src = source.thumbnail || '';
        previewImage.classList.remove('hidden');
        previewName.textContent = cleanTitle;
        previewName.classList.remove('hidden');
        btnPickerShare.removeAttribute('disabled');
      });

      item.addEventListener('dblclick', () => {
        selectedSource = source;
        startRecording();
      });

      pickerSourceList.appendChild(item);
    });
  }

  if (tabBtnChrome) {
    tabBtnChrome.addEventListener('click', () => {
      currentTabType = 'chrome';
      selectedSource = null;
      btnPickerShare.setAttribute('disabled', 'true');
      previewImage.classList.add('hidden');
      previewName.classList.add('hidden');
      previewPlaceholder.classList.remove('hidden');
      renderSourceList();
    });
  }

  if (tabBtnWindows) {
    tabBtnWindows.addEventListener('click', () => {
      currentTabType = 'window';
      selectedSource = null;
      if (btnPickerShare) btnPickerShare.setAttribute('disabled', 'true');
      if (previewImage) previewImage.classList.add('hidden');
      if (previewName) previewName.classList.add('hidden');
      if (previewPlaceholder) previewPlaceholder.classList.remove('hidden');
      renderSourceList();
    });
  }

  if (tabBtnScreens) {
    tabBtnScreens.addEventListener('click', () => {
      currentTabType = 'screen';
      selectedSource = null;
      if (btnPickerShare) btnPickerShare.setAttribute('disabled', 'true');
      if (previewImage) previewImage.classList.add('hidden');
      if (previewName) previewName.classList.add('hidden');
      if (previewPlaceholder) previewPlaceholder.classList.remove('hidden');
      renderSourceList();
    });
  }

  if (btnPickerClose) btnPickerClose.addEventListener('click', closeSourcePicker);
  if (btnPickerCancel) btnPickerCancel.addEventListener('click', closeSourcePicker);

  // Studio Mode: Record Half-Body on Webcam with Teleprompter on the Top
  async function toggleStudioMode(forceState) {
    const nextState = forceState !== undefined ? !!forceState : !isStudioMode;
    if (nextState === isStudioMode) return;

    if (nextState) {
      // 1. Immediately activate Studio Mode UI layout
      isStudioMode = true;
      prompterWindow.classList.add('studio-mode');
      applyCardBounds();
      if (btnFocusToggle) {
        btnFocusToggle.classList.add('studio-active');
        btnFocusToggle.title = 'Exit Studio Mode (Ctrl+Shift+F)';
      }
      if (modeBadge) modeBadge.textContent = 'STUDIO';

      // Ensure window height accommodates half-body framing comfortably
      if (window.prompterAPI && window.prompterAPI.getBounds && window.prompterAPI.setBounds) {
        try {
          const bounds = await window.prompterAPI.getBounds();
          if (bounds && bounds.height < 450) {
            window.prompterAPI.setBounds({
              x: bounds.x,
              y: Math.max(10, bounds.y - 60),
              width: Math.max(bounds.width, 600),
              height: 520
            });
          }
        } catch (e) {}
      }

      // 2. Concurrently acquire presenter webcam feed with timeout
      try {
        const timeoutPromise = (promise, ms = 2500) => Promise.race([
          promise,
          new Promise((_, reject) => setTimeout(() => reject(new Error('Camera timeout')), ms))
        ]);

        let stream = null;
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
          try {
            stream = await timeoutPromise(navigator.mediaDevices.getUserMedia({
              video: {
                width: { ideal: 1920, min: 1280 },
                height: { ideal: 1080, min: 720 },
                frameRate: { ideal: 30 }
              },
              audio: false
            }), 2500);
          } catch (camErr) {
            console.warn('[Prompter] High-res camera request failed, retrying generic video:', camErr);
            try {
              stream = await timeoutPromise(navigator.mediaDevices.getUserMedia({ video: true, audio: false }), 2000);
            } catch (camErr2) {
              console.warn('[Prompter] Generic video capture also unavailable:', camErr2);
            }
          }
        }

        // If user exited studio mode while camera was initializing, stop tracks immediately
        if (!isStudioMode) {
          if (stream) stream.getTracks().forEach(t => t.stop());
          return;
        }

        studioWebcamStream = stream;
        if (studioWebcam) {
          studioWebcam.srcObject = stream;
          if (stream) {
            try {
              await studioWebcam.play();
            } catch (e) {}
          }
        }
      } catch (err) {
        console.warn('[Prompter] Studio webcam init note:', err.message);
      }
    } else {
      // Exit Studio Mode: cleanly release camera tracks
      isStudioMode = false;
      if (studioWebcamStream) {
        try {
          studioWebcamStream.getTracks().forEach(track => track.stop());
        } catch (e) {}
        studioWebcamStream = null;
      }
      if (studioWebcam) {
        studioWebcam.srcObject = null;
      }
      prompterWindow.classList.remove('studio-mode');
      if (btnFocusToggle) {
        btnFocusToggle.classList.remove('studio-active');
        btnFocusToggle.title = 'Studio Mode: Record Half-Body on Webcam with Teleprompter on Top (Ctrl+Shift+F)';
      }
      if (modeBadge) modeBadge.textContent = 'HUD';
    }
  }

  // Studio Quick Toolbar Handlers
  if (btnStudioGuides) {
    btnStudioGuides.addEventListener('click', () => {
      isGuidesVisible = !isGuidesVisible;
      if (studioFramingGuides) {
        if (isGuidesVisible) {
          studioFramingGuides.classList.remove('hidden');
          btnStudioGuides.classList.add('active');
        } else {
          studioFramingGuides.classList.add('hidden');
          btnStudioGuides.classList.remove('active');
        }
      }
    });
  }

  if (btnStudioMirror) {
    btnStudioMirror.addEventListener('click', () => {
      isWebcamMirrored = !isWebcamMirrored;
      if (studioWebcam) {
        if (isWebcamMirrored) {
          studioWebcam.classList.remove('unmirrored');
          btnStudioMirror.classList.add('active');
        } else {
          studioWebcam.classList.add('unmirrored');
          btnStudioMirror.classList.remove('active');
        }
      }
    });
  }

  if (btnStudioExit) {
    btnStudioExit.addEventListener('click', () => {
      toggleStudioMode(false);
    });
  }

  if (tabBtnStudio) {
    tabBtnStudio.addEventListener('click', () => {
      closeSourcePicker();
      toggleStudioMode(true);
    });
  }

  // Teleprompter Card Repositioning (2D Dragging Anywhere) & Resizing Engine
  let cardLeft = 14;
  let cardTop = 46;
  let cardWidth = 0;
  let cardHeight = 190;

  function applyCardBounds() {
    if (!prompterCardContainer) return;
    const winW = prompterWindow.clientWidth || window.innerWidth;
    const winH = prompterWindow.clientHeight || window.innerHeight;

    const minW = Math.min(260, winW - 28);
    const maxW = Math.max(minW, winW - 28);
    if (!cardWidth || cardWidth <= 0) {
      cardWidth = Math.min(540, maxW);
    }
    cardWidth = Math.max(minW, Math.min(maxW, cardWidth));

    const minH = 80;
    const maxH = Math.max(minH, winH - 90);
    cardHeight = Math.max(minH, Math.min(maxH, cardHeight));

    const minLeft = 10;
    const maxLeft = Math.max(minLeft, winW - cardWidth - 10);
    cardLeft = Math.max(minLeft, Math.min(maxLeft, cardLeft));

    const minTop = 44;
    const maxTop = Math.max(minTop, winH - cardHeight - 48);
    cardTop = Math.max(minTop, Math.min(maxTop, cardTop));

    prompterCardContainer.style.setProperty('--studio-card-left', `${cardLeft}px`);
    prompterCardContainer.style.setProperty('--studio-card-top', `${cardTop}px`);
    prompterCardContainer.style.setProperty('--studio-card-width', `${cardWidth}px`);
    prompterCardContainer.style.setProperty('--studio-card-height', `${cardHeight}px`);
  }

  // Quick Snap Position Buttons: Horizontal & Vertical
  if (btnCardLeft) {
    btnCardLeft.addEventListener('click', (e) => {
      e.stopPropagation();
      cardLeft = 14;
      applyCardBounds();
    });
  }

  if (btnCardCenter) {
    btnCardCenter.addEventListener('click', (e) => {
      e.stopPropagation();
      const winW = prompterWindow.clientWidth || window.innerWidth;
      cardLeft = Math.max(10, Math.round((winW - cardWidth) / 2));
      applyCardBounds();
    });
  }

  if (btnCardRight) {
    btnCardRight.addEventListener('click', (e) => {
      e.stopPropagation();
      const winW = prompterWindow.clientWidth || window.innerWidth;
      cardLeft = Math.max(10, winW - cardWidth - 14);
      applyCardBounds();
    });
  }

  if (btnCardTop) {
    btnCardTop.addEventListener('click', (e) => {
      e.stopPropagation();
      cardTop = 46;
      applyCardBounds();
    });
  }

  if (btnCardMid) {
    btnCardMid.addEventListener('click', (e) => {
      e.stopPropagation();
      const winH = prompterWindow.clientHeight || window.innerHeight;
      cardTop = Math.max(44, Math.round((winH - cardHeight) / 2));
      applyCardBounds();
    });
  }

  if (btnCardBot) {
    btnCardBot.addEventListener('click', (e) => {
      e.stopPropagation();
      const winH = prompterWindow.clientHeight || window.innerHeight;
      cardTop = Math.max(44, winH - cardHeight - 54);
      applyCardBounds();
    });
  }

  // Quick Text Alignment from Teleprompter Card
  if (btnCardTextLeft) {
    btnCardTextLeft.addEventListener('click', (e) => {
      e.stopPropagation();
      setTextAlign('left');
    });
  }

  if (btnCardTextCenter) {
    btnCardTextCenter.addEventListener('click', (e) => {
      e.stopPropagation();
      setTextAlign('center');
    });
  }

  if (btnCardTextRight) {
    btnCardTextRight.addEventListener('click', (e) => {
      e.stopPropagation();
      setTextAlign('right');
    });
  }

  // 1. Drag Header Bar to Move Anywhere in 2D Space
  let isDraggingCard = false;
  let cardDragStartX = 0;
  let cardDragStartY = 0;
  let cardDragInitialLeft = 14;
  let cardDragInitialTop = 46;

  if (cardDragBar) {
    cardDragBar.addEventListener('mousedown', (e) => {
      if (e.target.closest('button')) return;
      if (e.button !== 0) return;
      isDraggingCard = true;
      cardDragStartX = e.clientX;
      cardDragStartY = e.clientY;
      cardDragInitialLeft = cardLeft;
      cardDragInitialTop = cardTop;
      prompterCardContainer.classList.add('is-dragging');
      document.body.style.cursor = 'grabbing';
      e.preventDefault();
      e.stopPropagation();
    });
  }

  // 2. Drag Bottom Handle Bar to Resize Height
  let isResizingCardHeight = false;
  let cardResizeStartY = 0;
  let cardResizeInitialH = 190;

  if (cardResizeBar) {
    cardResizeBar.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      isResizingCardHeight = true;
      cardResizeStartY = e.clientY;
      cardResizeInitialH = cardHeight;
      prompterCardContainer.classList.add('is-resizing');
      document.body.style.cursor = 'ns-resize';
      e.preventDefault();
      e.stopPropagation();
    });
  }

  // 3. Drag Right Edge Handle to Resize Width
  let isResizingCardWidth = false;
  let cardResizeStartX = 0;
  let cardResizeInitialW = 460;

  if (cardResizeEdgeRight) {
    cardResizeEdgeRight.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      isResizingCardWidth = true;
      cardResizeStartX = e.clientX;
      cardResizeInitialW = cardWidth;
      prompterCardContainer.classList.add('is-resizing');
      document.body.style.cursor = 'ew-resize';
      e.preventDefault();
      e.stopPropagation();
    });
  }

  // 4. Drag Bottom-Right Corner to Resize Height & Width
  let isResizingCardCorner = false;
  let cardCornerStartX = 0;
  let cardCornerStartY = 0;

  if (cardResizeCorner) {
    cardResizeCorner.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      isResizingCardCorner = true;
      cardCornerStartX = e.clientX;
      cardCornerStartY = e.clientY;
      cardResizeInitialW = cardWidth;
      cardResizeInitialH = cardHeight;
      prompterCardContainer.classList.add('is-resizing');
      document.body.style.cursor = 'nwse-resize';
      e.preventDefault();
      e.stopPropagation();
    });
  }

  // Unified MouseMove for Teleprompter Card
  window.addEventListener('mousemove', (e) => {
    if (isDraggingCard) {
      const deltaX = e.clientX - cardDragStartX;
      const deltaY = e.clientY - cardDragStartY;
      cardLeft = cardDragInitialLeft + deltaX;
      cardTop = cardDragInitialTop + deltaY;
      applyCardBounds();
    } else if (isResizingCardHeight) {
      const deltaY = e.clientY - cardResizeStartY;
      cardHeight = cardResizeInitialH + deltaY;
      applyCardBounds();
    } else if (isResizingCardWidth) {
      const deltaX = e.clientX - cardResizeStartX;
      cardWidth = cardResizeInitialW + deltaX;
      applyCardBounds();
    } else if (isResizingCardCorner) {
      const deltaX = e.clientX - cardCornerStartX;
      const deltaY = e.clientY - cardCornerStartY;
      cardWidth = cardResizeInitialW + deltaX;
      cardHeight = cardResizeInitialH + deltaY;
      applyCardBounds();
    }
  });

  window.addEventListener('mouseup', () => {
    if (isDraggingCard || isResizingCardHeight || isResizingCardWidth || isResizingCardCorner) {
      isDraggingCard = false;
      isResizingCardHeight = false;
      isResizingCardWidth = false;
      isResizingCardCorner = false;
      if (prompterCardContainer) {
        prompterCardContainer.classList.remove('is-dragging', 'is-resizing');
      }
      document.body.style.cursor = '';
    }
  });

  // Re-check card bounds on window resize
  window.addEventListener('resize', () => {
    if (isStudioMode) {
      applyCardBounds();
    }
  });

  // Unified Recording Engine: supports Screen, Window, Chrome Tab & Studio Mode
  async function executeRecordingPipeline(stream, sourceDisplayName) {
    try {
      activeStream = stream;
      recordedChunks = [];
      currentTakeBlob = null;
      currentTakeSessionPath = null;
      currentTakeSessionStats = null;
      sessionActive = false;

      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.addEventListener('ended', () => {
          if (isRecording) stopRecording();
        });
      }

      // Prioritize lightweight VP8 / standard WebM for smooth long-duration recordings with low CPU usage
      const hasAudio = stream.getAudioTracks().length > 0;
      const preferredCodecs = hasAudio
        ? [
            'video/webm;codecs=vp8,opus',
            'video/webm;codecs=h264,opus',
            'video/webm;codecs=vp9,opus',
            'video/webm'
          ]
        : [
            'video/webm;codecs=vp8',
            'video/webm;codecs=h264',
            'video/webm;codecs=vp9',
            'video/webm'
          ];
      let mimeType = preferredCodecs.find(t => {
        try { return MediaRecorder.isTypeSupported(t); } catch (e) { return false; }
      }) || '';

      try {
        if (mimeType) {
          mediaRecorder = new MediaRecorder(stream, {
            mimeType,
            videoBitsPerSecond: 2500000
          });
        } else {
          mediaRecorder = new MediaRecorder(stream);
        }
      } catch (recErr) {
        console.warn('[Prompter] MediaRecorder construction with options failed, retrying default:', recErr);
        mediaRecorder = new MediaRecorder(stream);
      }

      mediaRecorder.ondataavailable = async (e) => {
        if (e.data && e.data.size > 0) {
          if (sessionActive && window.prompterAPI && window.prompterAPI.appendRecordingChunk) {
            try {
              const arrayBuffer = await e.data.arrayBuffer();
              window.prompterAPI.appendRecordingChunk(new Uint8Array(arrayBuffer));
            } catch (chunkErr) {
              console.warn('[Prompter] Error streaming chunk to disk, buffering to memory:', chunkErr);
              recordedChunks.push(e.data);
            }
          } else {
            recordedChunks.push(e.data);
          }
        }
      };

      mediaRecorder.onstop = async () => {
        let stats = null;
        if (sessionActive && window.prompterAPI && window.prompterAPI.finishRecordingSession) {
          try {
            stats = await window.prompterAPI.finishRecordingSession();
          } catch (err) {
            console.warn('[Prompter] Error closing recording session stream:', err);
          }
        }

        if (stats && stats.success) {
          currentTakeSessionPath = stats.tempPath;
          currentTakeSessionStats = stats;
          onRecordingFinished(null, stats);
        } else if (recordedChunks.length > 0) {
          const blob = new Blob(recordedChunks, { type: 'video/webm' });
          currentTakeBlob = blob;
          onRecordingFinished(blob, null);
        } else {
          console.warn('[Prompter] Recording finished with 0 chunks.');
          onRecordingFinished(new Blob([], { type: 'video/webm' }), null);
        }
      };

      // 5-Second Countdown Before Recording Starts
      let countdownRemaining = 5;
      countdownOverlay.classList.remove('hidden');
      countdownNumber.textContent = '5';
      countdownSourceLabel.textContent = `Recording: ${sourceDisplayName}`;
      updateCountdownCircle(5, 5);

      btnRecord.classList.add('is-recording');
      recordLabel.textContent = '5s';
      recordTimer.classList.add('hidden');
      btnRecord.title = 'Starting in 5s... Click to Cancel';

      let countdownCancelled = false;

      const cancelCountdown = () => {
        if (countdownCancelled) return;
        countdownCancelled = true;
        if (countdownInterval) {
          clearInterval(countdownInterval);
          countdownInterval = null;
        }
        countdownOverlay.classList.add('hidden');
        if (stream) {
          try {
            stream.getTracks().forEach(t => t.stop());
          } catch (e) {}
        }
        activeStream = null;
        mediaRecorder = null;
        selectedSource = null;
        btnRecord.classList.remove('is-recording');
        recordLabel.textContent = 'Record';
        recordTimer.classList.add('hidden');
        btnRecord.title = isStudioMode 
          ? 'Record Studio Mode (Ctrl+Shift+R)'
          : 'Record Screen or Window (Ctrl+Shift+R)';
      };

      btnCountdownCancel.onclick = cancelCountdown;

      // Escape key cancels countdown
      const onKeyDownCountdown = (e) => {
        if (e.key === 'Escape' && !countdownOverlay.classList.contains('hidden')) {
          window.removeEventListener('keydown', onKeyDownCountdown);
          cancelCountdown();
        }
      };
      window.addEventListener('keydown', onKeyDownCountdown);

      countdownInterval = setInterval(() => {
        if (countdownCancelled) return;
        countdownRemaining -= 1;

        if (countdownRemaining > 0) {
          countdownNumber.textContent = String(countdownRemaining);
          recordLabel.textContent = `${countdownRemaining}s`;
          updateCountdownCircle(countdownRemaining, 5);

          // Pop animation
          countdownNumber.style.animation = 'none';
          void countdownNumber.offsetWidth;
          countdownNumber.style.animation = '';
        } else {
          clearInterval(countdownInterval);
          countdownInterval = null;
          window.removeEventListener('keydown', onKeyDownCountdown);

          countdownNumber.textContent = 'GO!';
          recordLabel.textContent = 'REC';
          updateCountdownCircle(0, 5);

          setTimeout(async () => {
            if (countdownCancelled) return;
            countdownOverlay.classList.add('hidden');

            // Initialize real-time disk streaming session to handle 1+ hour continuous recordings
            if (window.prompterAPI && window.prompterAPI.startRecordingSession) {
              try {
                const sessionRes = await window.prompterAPI.startRecordingSession(`rec_${Date.now()}`);
                if (sessionRes && sessionRes.success) {
                  currentTakeSessionPath = sessionRes.tempPath;
                  sessionActive = true;
                }
              } catch (err) {
                console.warn('[Prompter] Disk streaming session unavailable, falling back to memory chunks:', err);
              }
            }

            mediaRecorder.start(1000); // 1-second chunks streamed straight to disk
            isRecording = true;
            recordSeconds = 0;

            btnRecord.classList.add('is-recording');
            recordLabel.textContent = '';
            recordTimer.classList.remove('hidden');
            recordTimer.textContent = '00:00';
            btnRecord.title = 'Stop Recording (Ctrl+Shift+R)';

            // Auto-start prompter scroll if paused
            if (!scroller.isPlaying) {
              scroller.play();
            }

            recordTimerInterval = setInterval(() => {
              recordSeconds += 1;
              recordTimer.textContent = formatTime(recordSeconds);
            }, 1000);
          }, 350);
        }
      }, 1000);

    } catch (err) {
      console.error('[Prompter] Pipeline start error:', err);
      alert('Could not start recording session: ' + err.message);
    }
  }

  // Studio Mode Recording: Records presenter webcam feed + microphone with teleprompter on top
  async function startStudioRecording() {
    if (!isStudioMode) {
      await toggleStudioMode(true);
    }

    if (!studioWebcamStream) {
      // If live webcam feed is not active, gracefully switch to source picker
      openSourcePicker();
      return;
    }

    try {
      const videoTrack = studioWebcamStream.getVideoTracks()[0];
      if (!videoTrack) {
        openSourcePicker();
        return;
      }

      // Clone track so stopping recording does not kill live camera preview
      const clonedVideoTrack = videoTrack.clone();
      const combinedStream = new MediaStream([clonedVideoTrack]);

      // Add microphone voiceover
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        try {
          const micStream = await navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true
            }
          });
          const audioTrack = micStream.getAudioTracks()[0];
          if (audioTrack) {
            combinedStream.addTrack(audioTrack);
          }
        } catch (micErr) {
          console.warn('[Prompter] Studio microphone capture skipped or unavailable:', micErr);
        }
      }

      await executeRecordingPipeline(combinedStream, 'Studio Half-Body Webcam');
    } catch (err) {
      console.error('[Prompter] Studio recording failed:', err);
      alert('Could not start Studio recording: ' + err.message);
    }
  }

  // Screen / Window / Chrome Tab Recording
  async function startRecording() {
    if (!selectedSource) return;
    const sourceToRecord = selectedSource;
    pickerOverlay.classList.add('hidden');

    try {
      let stream = null;

      // Notify main process of selected source for display media requests
      if (window.prompterAPI && window.prompterAPI.selectCaptureSource) {
        try {
          await window.prompterAPI.selectCaptureSource(sourceToRecord.id);
        } catch (e) {}
      }

      // 1. Primary capture: getUserMedia with desktopCapturer source ID
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            mandatory: {
              chromeMediaSource: 'desktop',
              chromeMediaSourceId: sourceToRecord.id,
              minWidth: 1280,
              maxWidth: 1920,
              minHeight: 720,
              maxHeight: 1080,
              maxFrameRate: 30
            }
          }
        });
      } catch (gumErr) {
        console.warn('[Prompter] Direct getUserMedia capture failed, attempting getDisplayMedia fallback:', gumErr);
        if (navigator.mediaDevices.getDisplayMedia) {
          stream = await navigator.mediaDevices.getDisplayMedia({
            video: true,
            audio: false
          });
        } else {
          throw gumErr;
        }
      }

      if (!stream) {
        throw new Error('Unable to acquire media stream from chosen source.');
      }

      // Gracefully capture microphone voiceover if requested
      if (chkMic && chkMic.checked && navigator.mediaDevices.getUserMedia) {
        try {
          const micStream = await navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true
            }
          });
          const audioTrack = micStream.getAudioTracks()[0];
          if (audioTrack) {
            stream.addTrack(audioTrack);
          }
        } catch (micErr) {
          console.warn('[Prompter] Microphone capture skipped or unavailable:', micErr);
        }
      }

      const cleanTitle = currentTabType === 'chrome' ? getCleanBrowserTitle(sourceToRecord.name) : (sourceToRecord.name || 'Screen');
      await executeRecordingPipeline(stream, cleanTitle);
    } catch (err) {
      console.error('[Prompter] Recording failed to start:', err);
      alert('Could not start screen recording: ' + err.message);
      selectedSource = null;
    }
  }

  function stopRecording() {
    selectedSource = null;
    if (countdownInterval) {
      clearInterval(countdownInterval);
      countdownInterval = null;
      countdownOverlay.classList.add('hidden');
    }

    if (!isRecording) return;
    isRecording = false;

    if (recordTimerInterval) {
      clearInterval(recordTimerInterval);
      recordTimerInterval = null;
    }

    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      try { mediaRecorder.stop(); } catch (e) {}
    }

    if (activeStream) {
      try {
        activeStream.getTracks().forEach(t => t.stop());
      } catch (e) {}
      activeStream = null;
    }

    if (btnRecord) btnRecord.classList.remove('is-recording');
    if (recordTimer) recordTimer.classList.add('hidden');
    if (recordLabel) recordLabel.textContent = 'Record';
    if (btnRecord) {
      btnRecord.title = isStudioMode 
        ? 'Record Studio Mode (Ctrl+Shift+R)'
        : 'Record Screen or Window (Ctrl+Shift+R)';
    }
  }

  const takeDestPath = document.getElementById('take-dest-path');
  const btnTakeChangeDir = document.getElementById('btn-take-change-dir');

  async function updateTakeDestUI() {
    if (window.prompterAPI && window.prompterAPI.getStorageDir) {
      try {
        const dir = await window.prompterAPI.getStorageDir();
        if (takeDestPath) takeDestPath.textContent = dir || 'D:\\facescreen recording';
        if (btnTakeSave) btnTakeSave.textContent = `💾 Save to ${dir || 'D:\\facescreen recording'}`;
      } catch (e) {}
    }
  }

  if (btnTakeChangeDir) {
    btnTakeChangeDir.addEventListener('click', async () => {
      if (window.prompterAPI && window.prompterAPI.selectStorageDir) {
        const selected = await window.prompterAPI.selectStorageDir();
        if (selected) {
          await updateTakeDestUI();
        }
      }
    });
  }

  function onRecordingFinished(blob, stats) {
    const duration = formatTime(stats?.duration || recordSeconds);
    const size = formatFileSize(stats?.size || blob?.size || 0);

    if (takeStatDuration) takeStatDuration.textContent = duration;
    if (takeStatSize) takeStatSize.textContent = size;
    updateTakeDestUI();
    if (takeOverlay) takeOverlay.classList.remove('hidden');
  }

  if (btnPickerShare) {
    btnPickerShare.addEventListener('click', () => {
      startRecording();
    });
  }

  if (btnRecord) {
    btnRecord.addEventListener('click', () => {
      if (isRecording || countdownInterval) {
        stopRecording();
      } else {
        if (isStudioMode) {
          startStudioRecording();
        } else {
          openSourcePicker();
        }
      }
    });
  }

  // Take export modal actions
  btnTakeDiscard.addEventListener('click', async () => {
    takeOverlay.classList.add('hidden');
    if (currentTakeSessionPath && window.prompterAPI && window.prompterAPI.discardRecordingSession) {
      await window.prompterAPI.discardRecordingSession(currentTakeSessionPath);
    }
    currentTakeSessionPath = null;
    currentTakeSessionStats = null;
    currentTakeBlob = null;
    recordedChunks = [];
  });

  btnTakeSave.addEventListener('click', async () => {
    const defaultName = `GhostPrompter_${new Date().toISOString().slice(0, 10)}_${Date.now().toString().slice(-4)}.webm`;

    if (currentTakeSessionPath && window.prompterAPI && window.prompterAPI.exportRecordingSession) {
      const res = await window.prompterAPI.exportRecordingSession(currentTakeSessionPath, defaultName);
      if (res && res.success) {
        if (window.prompterAPI.saveTake) {
          window.prompterAPI.saveTake({
            id: `take-${Date.now()}`,
            filePath: res.filePath,
            duration: currentTakeSessionStats?.duration || recordSeconds,
            size: currentTakeSessionStats?.size || 0,
            createdAt: new Date().toISOString()
          });
        }
        takeOverlay.classList.add('hidden');
        currentTakeSessionPath = null;
        currentTakeSessionStats = null;
        currentTakeBlob = null;
        recordedChunks = [];
      }
      return;
    }

    // Fallback for direct memory blob
    if (currentTakeBlob) {
      const arrayBuffer = await currentTakeBlob.arrayBuffer();
      if (window.prompterAPI && window.prompterAPI.exportTake) {
        const res = await window.prompterAPI.exportTake(new Uint8Array(arrayBuffer), defaultName);
        if (res && res.success) {
          if (window.prompterAPI.saveTake) {
            window.prompterAPI.saveTake({
              id: `take-${Date.now()}`,
              filePath: res.filePath,
              duration: recordSeconds,
              size: currentTakeBlob.size,
              createdAt: new Date().toISOString()
            });
          }
          takeOverlay.classList.add('hidden');
          currentTakeBlob = null;
          recordedChunks = [];
        }
      }
    }
  });
  if (btnSpeedDown) btnSpeedDown.addEventListener('click', () => setSpeed(currentSpeed - 5));
  if (btnSpeedUp) btnSpeedUp.addEventListener('click', () => setSpeed(currentSpeed + 5));

  // Quick Font Size Steppers (Prompter & Live Studio)
  if (btnFontDown) btnFontDown.addEventListener('click', () => setFontSize(currentFontSize - 2));
  if (btnFontUp) btnFontUp.addEventListener('click', () => setFontSize(currentFontSize + 2));
  if (fontDisplay) fontDisplay.addEventListener('click', () => toggleSettingsModal());

  // Quick Font Size Stepper inside Studio Mode Card
  if (btnCardFontDown) {
    btnCardFontDown.addEventListener('click', (e) => {
      e.stopPropagation();
      setFontSize(currentFontSize - 2);
    });
  }
  if (btnCardFontUp) {
    btnCardFontUp.addEventListener('click', (e) => {
      e.stopPropagation();
      setFontSize(currentFontSize + 2);
    });
  }

  if (opacitySelect) opacitySelect.addEventListener('change', (e) => setOpacity(e.target.value));

  btnFocusToggle.addEventListener('click', () => {
    toggleStudioMode();
  });

  // ⠿ Header Drag Handle: Click for Settings (Speed, Font Size, Color), Drag to Move Window
  if (headerDragHandle) {
    let handleDownX = 0;
    let handleDownY = 0;
    let handleDragging = false;
    let handleMoved = false;
    let clickSuppressed = false;

    headerDragHandle.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      handleDragging = true;
      handleMoved = false;
      handleDownX = e.screenX;
      handleDownY = e.screenY;
    });

    window.addEventListener('mousemove', (e) => {
      if (!handleDragging) return;
      const deltaX = e.screenX - handleDownX;
      const deltaY = e.screenY - handleDownY;
      if (Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3) {
        handleMoved = true;
        if (window.prompterAPI && window.prompterAPI.moveWindow) {
          window.prompterAPI.moveWindow(deltaX, deltaY);
        }
        handleDownX = e.screenX;
        handleDownY = e.screenY;
      }
    });

    window.addEventListener('mouseup', () => {
      if (handleDragging) {
        handleDragging = false;
        if (!handleMoved) {
          clickSuppressed = true;
          toggleSettingsModal();
          setTimeout(() => { clickSuppressed = false; }, 300);
        }
      }
    });

    headerDragHandle.addEventListener('click', (e) => {
      e.preventDefault();
      if (!clickSuppressed && !handleMoved) {
        toggleSettingsModal();
      }
    });
  }

  // ⚙️ Dedicated Settings Button
  if (btnSettingsToggle) {
    btnSettingsToggle.addEventListener('click', () => toggleSettingsModal());
  }

  // ⠿ Studio Mode Card Dots: Click for Settings
  if (cardDragDots) {
    cardDragDots.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleSettingsModal(true);
    });
  }

  // Settings Modal Close & Done Buttons
  if (btnSettingsClose) {
    btnSettingsClose.addEventListener('click', () => toggleSettingsModal(false));
  }

  if (btnSettingsDone) {
    btnSettingsDone.addEventListener('click', () => toggleSettingsModal(false));
  }

  if (btnSettingsReset) {
    btnSettingsReset.addEventListener('click', () => {
      setSpeed(160);
      setFontSize(28);
      setTextColor('#FFFFFF');
      setTextAlign('left');
      setOpacity(0.85);
    });
  }

  // Speed Slider & Steppers in Settings
  if (settingsSpeedSlider) {
    settingsSpeedSlider.addEventListener('input', (e) => {
      setSpeed(parseInt(e.target.value, 10));
    });
  }

  if (settingsSpeedMinus) {
    settingsSpeedMinus.addEventListener('click', () => setSpeed(currentSpeed - 5));
  }

  if (settingsSpeedPlus) {
    settingsSpeedPlus.addEventListener('click', () => setSpeed(currentSpeed + 5));
  }

  document.querySelectorAll('#speed-presets .btn-preset-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      const s = parseInt(btn.dataset.speed, 10);
      if (s) setSpeed(s);
    });
  });

  // Font Size Slider & Steppers in Settings
  if (settingsFontSlider) {
    settingsFontSlider.addEventListener('input', (e) => {
      setFontSize(parseInt(e.target.value, 10));
    });
  }

  if (settingsFontMinus) {
    settingsFontMinus.addEventListener('click', () => setFontSize(currentFontSize - 2));
  }

  if (settingsFontPlus) {
    settingsFontPlus.addEventListener('click', () => setFontSize(currentFontSize + 2));
  }

  document.querySelectorAll('#font-presets .btn-preset-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      const f = parseInt(btn.dataset.font, 10);
      if (f) setFontSize(f);
    });
  });

  // Color Swatches in Settings
  document.querySelectorAll('#color-swatches .color-swatch-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const color = btn.dataset.color;
      if (color) setTextColor(color);
    });
  });

  if (settingsCustomColor) {
    settingsCustomColor.addEventListener('input', (e) => {
      setTextColor(e.target.value);
    });
  }

  // Text Alignment in Settings
  [btnAlignLeft, btnAlignCenter, btnAlignRight].forEach(btn => {
    if (btn) {
      btn.addEventListener('click', () => {
        setTextAlign(btn.dataset.align);
      });
    }
  });

  // Background Opacity in Settings
  if (settingsOpacitySelect) {
    settingsOpacitySelect.addEventListener('change', (e) => {
      setOpacity(e.target.value);
    });
  }

  if (brandBadge) {
    brandBadge.addEventListener('click', () => {
      if (window.prompterAPI) window.prompterAPI.toggleGhost();
    });
  }

  if (btnGhostToggle) {
    btnGhostToggle.addEventListener('click', () => {
      if (window.prompterAPI) window.prompterAPI.toggleGhost();
    });
  }

  if (ghostFloatingPill) {
    ghostFloatingPill.addEventListener('click', () => {
      if (window.prompterAPI) window.prompterAPI.toggleGhost();
    });
  }

  if (btnOpenStudio) {
    btnOpenStudio.addEventListener('click', () => {
      if (window.prompterAPI) window.prompterAPI.openStudio();
    });
  }

  if (btnModalOpenStudio) {
    btnModalOpenStudio.addEventListener('click', () => {
      if (window.prompterAPI && window.prompterAPI.openStudio) window.prompterAPI.openStudio();
    });
  }

  // Window Minimize & Maximize Handlers
  const handleMinimize = () => {
    if (window.prompterAPI && window.prompterAPI.minimizeWindow) {
      window.prompterAPI.minimizeWindow();
    }
  };

  const handleMaximize = () => {
    if (window.prompterAPI && window.prompterAPI.maximizeWindow) {
      window.prompterAPI.maximizeWindow();
    }
  };

  // macOS Traffic Lights
  if (trafficClose) {
    trafficClose.addEventListener('click', () => {
      if (window.prompterAPI && window.prompterAPI.closeWindow) window.prompterAPI.closeWindow();
    });
  }
  if (trafficMin) trafficMin.addEventListener('click', handleMinimize);
  if (trafficMax) trafficMax.addEventListener('click', handleMaximize);

  // Dedicated Window Action Buttons (Minimize, Maximize / Restore)
  if (btnWinMin) btnWinMin.addEventListener('click', handleMinimize);
  if (btnWinMax) btnWinMax.addEventListener('click', handleMaximize);

  // Dynamic Island Compact Pill Toggle
  if (btnCompactToggle) {
    btnCompactToggle.addEventListener('click', () => {
      if (window.prompterAPI && window.prompterAPI.toggleCompact) window.prompterAPI.toggleCompact();
    });
  }

  if (btnIslandExpand) {
    btnIslandExpand.addEventListener('click', () => {
      if (window.prompterAPI && window.prompterAPI.toggleCompact) window.prompterAPI.toggleCompact();
    });
  }

  // Double click header to maximize / restore
  if (prompterHeader) {
    prompterHeader.addEventListener('dblclick', (e) => {
      if (e.target.closest('button, select, input, .header-drag-handle, .pill-stepper')) return;
      handleMaximize();
    });
  }

  // Sync manual wheel/touchpad scrolling with physics engine
  viewport.addEventListener('scroll', () => {
    if (!scroller.isPlaying) {
      scroller.syncScroll();
    }
  }, { passive: true });

  // 8-Directional Frameless Window Resizing
  const resizeGrips = document.querySelectorAll('.window-resize-grip');
  let isResizing = false;
  let resizeDir = 'se';
  let resizeStartX = 0;
  let resizeStartY = 0;
  let resizeStartW = 0;
  let resizeStartH = 0;
  let resizeStartMouseX = 0;
  let resizeStartMouseY = 0;
  let pendingBounds = null;
  let resizeRafId = null;

  resizeGrips.forEach(grip => {
    grip.addEventListener('mousedown', async (e) => {
      if (e.button !== 0) return;
      isResizing = true;
      resizeDir = grip.dataset.dir || 'se';
      resizeStartMouseX = e.screenX;
      resizeStartMouseY = e.screenY;

      let bounds = null;
      if (window.prompterAPI && window.prompterAPI.getBounds) {
        try {
          bounds = await window.prompterAPI.getBounds();
        } catch (err) {}
      }
      resizeStartX = bounds?.x ?? (window.screenX || 0);
      resizeStartY = bounds?.y ?? (window.screenY || 0);
      resizeStartW = bounds?.width ?? (window.outerWidth || 560);
      resizeStartH = bounds?.height ?? (window.outerHeight || 380);

      e.preventDefault();
      e.stopPropagation();
    });
  });

  window.addEventListener('mousemove', (e) => {
    if (!isResizing) return;
    const deltaX = e.screenX - resizeStartMouseX;
    const deltaY = e.screenY - resizeStartMouseY;

    let newX = resizeStartX;
    let newY = resizeStartY;
    let newW = resizeStartW;
    let newH = resizeStartH;

    // East (right)
    if (resizeDir.includes('e')) {
      newW = Math.max(320, resizeStartW + deltaX);
    }
    // South (bottom)
    if (resizeDir.includes('s')) {
      newH = Math.max(42, resizeStartH + deltaY);
    }
    // West (left)
    if (resizeDir.includes('w')) {
      newW = Math.max(320, resizeStartW - deltaX);
      newX = resizeStartX + (resizeStartW - newW);
    }
    // North (top)
    if (resizeDir.includes('n')) {
      newH = Math.max(42, resizeStartH - deltaY);
      newY = resizeStartY + (resizeStartH - newH);
    }

    pendingBounds = { x: newX, y: newY, width: newW, height: newH };

    if (!resizeRafId) {
      resizeRafId = requestAnimationFrame(() => {
        resizeRafId = null;
        if (pendingBounds && isResizing) {
          if (window.prompterAPI && window.prompterAPI.setBounds) {
            window.prompterAPI.setBounds(pendingBounds);
          } else if (window.prompterAPI && window.prompterAPI.setSize) {
            window.prompterAPI.setSize(pendingBounds.width, pendingBounds.height);
          }
        }
      });
    }
  });

  window.addEventListener('mouseup', () => {
    if (isResizing) {
      isResizing = false;
      if (resizeRafId) {
        cancelAnimationFrame(resizeRafId);
        resizeRafId = null;
      }
      pendingBounds = null;
    }
  });

  // In-Window Keyboard Shortcuts
  window.addEventListener('keydown', (e) => {
    // Escape closes any active overlay (Settings modal, source picker, countdown)
    if (e.key === 'Escape' || e.code === 'Escape') {
      if (settingsOverlay && !settingsOverlay.classList.contains('hidden')) {
        e.preventDefault();
        toggleSettingsModal(false);
        return;
      }
      if (pickerOverlay && !pickerOverlay.classList.contains('hidden')) {
        e.preventDefault();
        closeSourcePicker();
        return;
      }
      if (countdownInterval) {
        e.preventDefault();
        stopRecording();
        return;
      }
      if (takeOverlay && !takeOverlay.classList.contains('hidden')) {
        e.preventDefault();
        takeOverlay.classList.add('hidden');
        return;
      }
    }

    // Ctrl+, or Cmd+, toggles the Settings Modal
    if ((e.ctrlKey || e.metaKey) && (e.key === ',' || e.code === 'Comma')) {
      e.preventDefault();
      toggleSettingsModal();
      return;
    }

    // Ctrl + Plus/Equal to increase font size, Ctrl + Minus to decrease font size
    if ((e.ctrlKey || e.metaKey) && (e.key === '=' || e.key === '+' || e.code === 'Equal' || e.code === 'NumpadAdd')) {
      e.preventDefault();
      setFontSize(currentFontSize + 2);
      return;
    }
    if ((e.ctrlKey || e.metaKey) && (e.key === '-' || e.key === '_' || e.code === 'Minus' || e.code === 'NumpadSubtract')) {
      e.preventDefault();
      setFontSize(currentFontSize - 2);
      return;
    }
    if ((e.ctrlKey || e.metaKey) && (e.key === '0' || e.code === 'Digit0' || e.code === 'Numpad0')) {
      e.preventDefault();
      setFontSize(28);
      return;
    }

    if (e.target === scriptContent && !e.ctrlKey && !e.metaKey) return;

    if (e.code === 'Space') {
      e.preventDefault();
      scroller.toggle();
    } else if (e.code === 'ArrowUp') {
      e.preventDefault();
      setSpeed(currentSpeed + 5);
    } else if (e.code === 'ArrowDown') {
      e.preventDefault();
      setSpeed(currentSpeed - 5);
    } else if (e.ctrlKey && e.shiftKey && e.code === 'KeyR') {
      e.preventDefault();
      if (isRecording || countdownInterval) stopRecording();
      else if (isStudioMode) startStudioRecording();
      else openSourcePicker();
    } else if (e.ctrlKey && e.shiftKey && e.code === 'KeyF') {
      e.preventDefault();
      toggleStudioMode();
    } else if (e.ctrlKey && e.shiftKey && e.code === 'KeyG') {
      e.preventDefault();
      if (window.prompterAPI) window.prompterAPI.toggleGhost();
    }
  });

  // Listen to Global Shortcuts / Main Process Dispatches
  if (window.prompterAPI) {
    window.prompterAPI.onTogglePlay(() => scroller.toggle());

    if (window.prompterAPI.onToggleRecord) {
      window.prompterAPI.onToggleRecord(() => {
        if (isRecording || countdownInterval) stopRecording();
        else if (isStudioMode) startStudioRecording();
        else openSourcePicker();
      });
    }

    window.prompterAPI.onSetSpeed((data) => {
      const delta = data?.delta || 0;
      const speed = data?.speed || (currentSpeed + delta);
      setSpeed(speed, true);
    });

    window.prompterAPI.onOpacityChanged((data) => {
      if (data?.opacity) setOpacity(data.opacity, true);
    });

    if (window.prompterAPI.onFontSizeChanged) {
      window.prompterAPI.onFontSizeChanged((data) => {
        const size = data?.fontSize || data;
        if (size) setFontSize(Number(size), true);
      });
    }

    if (window.prompterAPI.onTextColorChanged) {
      window.prompterAPI.onTextColorChanged((data) => {
        const color = data?.textColor || data;
        if (color) setTextColor(color, true);
      });
    }

    if (window.prompterAPI.onTextAlignChanged) {
      window.prompterAPI.onTextAlignChanged((data) => {
        const align = data?.textAlign || data;
        if (align) setTextAlign(align, true);
      });
    }

    window.prompterAPI.onGhostModeChanged((data) => {
      isGhost = !!data?.isGhost;
      if (isGhost) {
        prompterWindow.classList.add('ghost-mode');
        if (brandBadge) brandBadge.classList.add('active');
        if (btnGhostToggle) btnGhostToggle.classList.add('active');
      } else {
        prompterWindow.classList.remove('ghost-mode');
        if (brandBadge) brandBadge.classList.remove('active');
        if (btnGhostToggle) btnGhostToggle.classList.remove('active');
      }
      syncStateToMain(scroller.isPlaying);
    });

    window.prompterAPI.onCompactModeChanged((data) => {
      isCompact = !!data?.isCompact;
      if (isCompact) {
        prompterWindow.classList.add('compact-mode');
      } else {
        prompterWindow.classList.remove('compact-mode');
      }
      syncStateToMain(scroller.isPlaying);
    });

    window.prompterAPI.onToggleFocusLine(() => {
      toggleStudioMode();
    });

    window.prompterAPI.onSetScript((script) => {
      renderScript(script);
    });

    if (window.prompterAPI.onMaximizedChanged) {
      window.prompterAPI.onMaximizedChanged((isMax) => {
        updateMaximizedUI(isMax);
      });
    }

    if (window.prompterAPI.isMaximized) {
      try {
        const res = window.prompterAPI.isMaximized();
        if (res && typeof res.then === 'function') {
          res.then((isMax) => {
            updateMaximizedUI(isMax);
          }).catch(() => {});
        } else if (typeof res === 'boolean') {
          updateMaximizedUI(res);
        }
      } catch (e) {}
    }
  }
});
