/**
 * Ghost Studio Controller
 * Coordinates hardware-accelerated video recording, half-body safe zones, and integrated teleprompter auto-scroll.
 */

document.addEventListener('DOMContentLoaded', async () => {
  // DOM Elements
  const videoEl = document.getElementById('studio-camera');
  const cameraContainer = document.getElementById('camera-container');
  const framingOverlay = document.getElementById('framing-overlay');
  const vuFill = document.getElementById('vu-bar-fill');
  const vuStatus = document.getElementById('vu-status');
  const prompterViewport = document.getElementById('prompter-viewport');
  const prompterText = document.getElementById('prompter-text');
  const studioPrompter = document.getElementById('studio-prompter');
  const prompterHeader = document.getElementById('prompter-header');
  const prompterResizeHandles = document.querySelectorAll('.prompter-resize-handle');
  const countdownOverlay = document.getElementById('studio-countdown');
  const countdownDigit = document.getElementById('countdown-digit');

  // Controls
  const btnStudioRec = document.getElementById('btn-studio-rec');
  const recDot = document.getElementById('rec-dot');
  const recText = document.getElementById('rec-text');
  const recTimer = document.getElementById('rec-timer');

  const btnStudioScroll = document.getElementById('btn-studio-scroll');
  const scrollIcon = document.getElementById('scroll-icon');
  const scrollLabel = document.getElementById('scroll-label');

  const btnWpmDec = document.getElementById('btn-wpm-dec');
  const btnWpmInc = document.getElementById('btn-wpm-inc');
  const labelWpm = document.getElementById('label-wpm');
  const btnPrompterReset = document.getElementById('btn-prompter-reset');
  const btnPrompterPip = document.getElementById('btn-prompter-pip');

  const selectScript = document.getElementById('select-studio-script');
  const btnFontDec = document.getElementById('btn-font-dec');
  const btnFontInc = document.getElementById('btn-font-inc');
  const labelFont = document.getElementById('label-font');
  const selectColor = document.getElementById('select-font-color');

  const ratioBtns = document.querySelectorAll('.ratio-btn');
  const btnToggleGuides = document.getElementById('btn-toggle-guides');
  const btnToggleMirror = document.getElementById('btn-toggle-mirror');
  const btnToggleEnhance = document.getElementById('btn-toggle-enhance');
  const selectCameraDevice = document.getElementById('select-camera-device');
  const btnCloseStudio = document.getElementById('btn-close-studio');
  const btnToggleOverlayHUD = document.getElementById('btn-toggle-hud-prompter');

  // Modal Elements
  const reviewModal = document.getElementById('review-modal');
  const reviewVideo = document.getElementById('review-video-player');
  const metaDuration = document.getElementById('meta-duration');
  const metaSize = document.getElementById('meta-size');
  const metaStorageDest = document.getElementById('meta-storage-dest');
  const btnCloseReview = document.getElementById('btn-close-review');
  const btnSaveVideo = document.getElementById('btn-save-video');
  const btnRetake = document.getElementById('btn-retake');
  const btnSelectStorageDir = document.getElementById('btn-select-storage-dir');
  const storageDirLabel = document.getElementById('storage-dir-label');

  // State
  let currentRatio = '16:9';
  let currentWpm = 130;
  let currentFontSize = 26;
  let currentColor = '#00F0FF';
  let isMirror = true;
  let showGuides = true;

  let isScrolling = false;
  let isRecording = false;
  let isCountingDown = false;
  let scrollAnimId = null;
  let scrollAccumulator = 0;

  let currentTake = null;
  let recorder = null;

  // Initialize Storage and Settings
  const Storage = window.GhostStorage;
  let scriptsList = [];
  let currentScript = null;

  if (Storage) {
    const settings = await Storage.getSettings();
    if (settings.wpm) currentWpm = settings.wpm;
    if (settings.fontSize) currentFontSize = settings.fontSize;
    if (settings.textColor) currentColor = settings.textColor;

    scriptsList = await Storage.getScripts();
    const activeId = await Storage.getActiveScriptId();
    currentScript = scriptsList.find(s => s.id === activeId) || scriptsList[0];
  }

  // Populate Script Select
  if (scriptsList.length > 0) {
    selectScript.innerHTML = scriptsList.map(s => 
      `<option value="${s.id}" ${currentScript && s.id === currentScript.id ? 'selected' : ''}>${s.title}</option>`
    ).join('');
    if (currentScript && currentScript.content) {
      prompterText.innerText = currentScript.content;
    }
  }

  // Initialize UI Values
  labelWpm.textContent = `${currentWpm} WPM`;
  labelFont.textContent = `${currentFontSize}px`;
  if (studioPrompter) {
    studioPrompter.style.setProperty('--sp-base-font-size', `${currentFontSize}px`);
  }
  prompterText.style.color = currentColor;
  selectColor.value = currentColor;

  setupStudioPrompterDrag();
  setupStudioPrompterResize();
  applyRatioToPrompter(currentRatio, true);
  setTimeout(() => {
    applyRatioToPrompter(currentRatio, true);
  }, 100);

  // Instantiate VideoRecorder Engine
  recorder = new VideoRecorder({
    videoQuality: '1080p',
    aspectRatio: currentRatio,
    mirror: isMirror,
    countdownSeconds: 3,
    onCountdown: (remaining) => {
      isCountingDown = remaining > 0;
      if (remaining > 0) {
        countdownOverlay.style.display = 'flex';
        countdownDigit.textContent = remaining;
      } else {
        countdownOverlay.style.display = 'none';
      }
    },
    onStart: () => {
      isRecording = true;
      isCountingDown = false;
      countdownOverlay.style.display = 'none';
      updateRecButtonUI(true);
      // Auto-start prompter scroll when recording rolls!
      if (!isScrolling) {
        startScroll();
      }
    },
    onTimeUpdate: (elapsedSeconds, formattedTime) => {
      const timeStr = typeof elapsedSeconds === 'object' && elapsedSeconds !== null
        ? (elapsedSeconds.formattedTime || (typeof VideoRecorder !== 'undefined' ? VideoRecorder.formatTime(elapsedSeconds.elapsedSeconds || 0) : '00:00'))
        : (formattedTime || (typeof VideoRecorder !== 'undefined' ? VideoRecorder.formatTime(typeof elapsedSeconds === 'number' ? elapsedSeconds : 0) : '00:00'));
      if (recTimer) recTimer.textContent = timeStr;
    },
    onStop: (take) => {
      isRecording = false;
      isCountingDown = false;
      updateRecButtonUI(false);
      currentTake = take;
      showReviewModal(take);
    },
    onError: (err) => {
      console.error('Studio camera error:', err);
      isRecording = false;
      isCountingDown = false;
      countdownOverlay.style.display = 'none';
      updateRecButtonUI(false);
      vuStatus.textContent = 'Mic Error';
      vuStatus.style.color = '#FF4444';
      alert('Camera / Mic Access Error: ' + (err.message || 'Check camera permissions.'));
    },
    onAudioLevel: (level) => {
      if (vuFill) {
        vuFill.style.width = `${level}%`;
      }
      if (level > 10) {
        vuStatus.textContent = 'Active 🎤';
        vuStatus.style.color = '#00FF88';
      }
    }
  });

  // Source Switcher (Camera vs Screen/Tab)
  const btnSourceCam = document.getElementById('btn-source-cam');
  const btnSourceScreen = document.getElementById('btn-source-screen');
  let currentSource = 'camera';

  async function switchToSource(sourceType) {
    if (isRecording || isCountingDown) {
      alert('Please stop recording before switching video source.');
      return;
    }

    if (sourceType === 'screen') {
      try {
        const stream = await recorder.startScreenCapture();
        currentSource = 'screen';
        videoEl.srcObject = stream;
        videoEl.classList.remove('mirrored');
        if (btnSourceCam) btnSourceCam.classList.remove('active');
        if (btnSourceScreen) btnSourceScreen.classList.add('active');

        // Track user clicking Chrome's native "Stop sharing" bar
        const screenTrack = stream.getVideoTracks()[0];
        if (screenTrack) {
          screenTrack.addEventListener('ended', () => {
            if (!isRecording) {
              switchToSource('camera');
            }
          });
        }
      } catch (err) {
        console.warn('Screen capture cancelled or error:', err);
      }
    } else {
      try {
        const stream = await recorder.startCamera();
        currentSource = 'camera';
        videoEl.srcObject = stream;
        if (isMirror) {
          videoEl.classList.add('mirrored');
        } else {
          videoEl.classList.remove('mirrored');
        }
        if (btnSourceScreen) btnSourceScreen.classList.remove('active');
        if (btnSourceCam) btnSourceCam.classList.add('active');
      } catch (err) {
        console.warn('Camera switch error:', err);
      }
    }
  }

  if (btnSourceCam) {
    btnSourceCam.addEventListener('click', () => switchToSource('camera'));
  }
  if (btnSourceScreen) {
    btnSourceScreen.addEventListener('click', () => switchToSource('screen'));
  }

  // Auto-Enhance Button Logic
  let isEnhanced = true;
  if (btnToggleEnhance) {
    videoEl.classList.add('enhanced');
    btnToggleEnhance.classList.add('active');

    btnToggleEnhance.addEventListener('click', () => {
      isEnhanced = !isEnhanced;
      videoEl.classList.toggle('enhanced', isEnhanced);
      btnToggleEnhance.classList.toggle('active', isEnhanced);
    });
  }

  // Camera Device Enumeration
  async function populateCameraDevices() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return;
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(d => d.kind === 'videoinput');
      if (videoDevices.length > 1 && selectCameraDevice) {
        selectCameraDevice.innerHTML = videoDevices.map((d, i) => 
          `<option value="${d.deviceId}">📹 ${d.label || `Camera ${i + 1}`}</option>`
        ).join('');
        selectCameraDevice.style.display = 'inline-block';

        selectCameraDevice.addEventListener('change', async () => {
          const chosenId = selectCameraDevice.value;
          try {
            const stream = await recorder.startCamera(chosenId);
            videoEl.srcObject = stream;
            videoEl.play().catch(() => {});
          } catch (err) {
            console.warn('Device switch error:', err);
          }
        });
      }
    } catch (e) {}
  }

  // Start Hardware Camera Stream
  try {
    const stream = await recorder.startCamera();
    videoEl.srcObject = stream;
    videoEl.play().catch(() => {});
    populateCameraDevices();
    updateStorageDirectoryUI();
  } catch (err) {
    console.warn('Camera could not start automatically:', err);
  }

  // Storage Directory UI and Handler (D:\facescreen recording)
  async function updateStorageDirectoryUI() {
    if (!VideoRecorder || !VideoRecorder.getSavedDirectoryHandle) return;
    const handle = await VideoRecorder.getSavedDirectoryHandle();
    if (handle && handle.name) {
      if (storageDirLabel) storageDirLabel.textContent = `Storage: ${handle.name} (Linked ✓)`;
      if (btnSelectStorageDir) {
        btnSelectStorageDir.classList.add('active');
        btnSelectStorageDir.title = `Direct storage linked to "${handle.name}". Click to change folder.`;
      }
      if (metaStorageDest) metaStorageDest.textContent = `📁 Target: ${handle.name} (Direct Disk)`;
    } else {
      if (storageDirLabel) storageDirLabel.textContent = `Storage: D:\\facescreen recording`;
      if (btnSelectStorageDir) {
        btnSelectStorageDir.classList.remove('active');
        btnSelectStorageDir.title = `Click to link folder (select D:\\facescreen recording) for direct saving`;
      }
    }
  }

  if (btnSelectStorageDir) {
    btnSelectStorageDir.addEventListener('click', async () => {
      const handle = await VideoRecorder.selectStorageDirectory();
      if (handle) {
        await updateStorageDirectoryUI();
        alert(`Storage folder linked: ${handle.name}!\nAll recordings will now be saved directly to this folder on your computer.`);
      }
    });
  }

  // Record Button
  btnStudioRec.addEventListener('click', () => {
    toggleRecording();
  });

  function toggleRecording() {
    if (isRecording || isCountingDown) {
      stopRecording();
    } else {
      startRecording();
    }
  }

  async function startRecording() {
    if (reviewModal.style.display === 'flex') {
      closeReview();
    }
    try {
      await recorder.startRecordingWithCountdown(currentSource);
    } catch (e) {
      console.warn('Recording start aborted:', e);
    }
  }

  function stopRecording() {
    if (recorder) {
      recorder.stopRecording();
    }
    if (isScrolling) {
      pauseScroll();
    }
  }

  function updateRecButtonUI(recording) {
    if (recording) {
      btnStudioRec.classList.add('recording');
      recDot.textContent = '⏹';
      recText.textContent = 'STOP RECORDING';
      recTimer.style.display = 'inline-block';
      recTimer.textContent = '00:00';
    } else {
      btnStudioRec.classList.remove('recording');
      recDot.textContent = '🔴';
      recText.textContent = 'START RECORDING';
      recTimer.style.display = 'none';
    }
  }

  // Auto-Scroll Button
  btnStudioScroll.addEventListener('click', () => {
    toggleScroll();
  });

  function toggleScroll() {
    if (isScrolling) {
      pauseScroll();
    } else {
      startScroll();
    }
  }

  function startScroll() {
    if (isScrolling) return;

    // If near bottom, reset to top
    const maxScroll = prompterViewport.scrollHeight - prompterViewport.clientHeight;
    if (maxScroll > 20 && prompterViewport.scrollTop >= maxScroll - 20) {
      prompterViewport.scrollTop = 0;
    }

    isScrolling = true;
    scrollIcon.textContent = '⏸';
    scrollLabel.textContent = 'Pause';
    btnStudioScroll.classList.add('scrolling');

    scrollAccumulator = prompterViewport.scrollTop;
    let lastTime = performance.now();

    function frame(time) {
      if (!isScrolling) return;

      const dt = Math.min((time - lastTime) / 1000, 0.1);
      lastTime = time;

      // Pacing formula: (wpm / 60) * (fontSize * 0.42)
      const speed = Math.max(8, (currentWpm / 60) * (currentFontSize * 0.42));

      // Re-sync if user manually dragged
      if (Math.abs(prompterViewport.scrollTop - scrollAccumulator) > 6) {
        scrollAccumulator = prompterViewport.scrollTop;
      }

      scrollAccumulator += speed * dt;
      prompterViewport.scrollTop = scrollAccumulator;

      // Check if finished
      const currentMax = prompterViewport.scrollHeight - prompterViewport.clientHeight;
      if (currentMax > 20 && prompterViewport.scrollTop >= currentMax - 3) {
        pauseScroll();
        if (isRecording) {
          stopRecording();
        }
        return;
      }

      scrollAnimId = requestAnimationFrame(frame);
    }

    scrollAnimId = requestAnimationFrame(frame);
  }

  function pauseScroll() {
    if (!isScrolling) return;
    isScrolling = false;
    scrollIcon.textContent = '▶';
    scrollLabel.textContent = 'Auto-Scroll';
    btnStudioScroll.classList.remove('scrolling');
    if (scrollAnimId) {
      cancelAnimationFrame(scrollAnimId);
      scrollAnimId = null;
    }
  }

  // WPM adjustments
  btnWpmDec.addEventListener('click', () => adjustWpm(-10));
  btnWpmInc.addEventListener('click', () => adjustWpm(10));

  function adjustWpm(delta) {
    currentWpm = Math.max(50, Math.min(320, currentWpm + delta));
    labelWpm.textContent = `${currentWpm} WPM`;
    if (Storage) Storage.saveSettings({ wpm: currentWpm });
  }

  btnPrompterReset.addEventListener('click', () => {
    prompterViewport.scrollTop = 0;
    scrollAccumulator = 0;
  });

  const btnStudioFocus = document.getElementById('btn-studio-focus-toggle');
  const studioFocusBar = document.getElementById('studio-focus-bar');
  if (btnStudioFocus && studioFocusBar) {
    btnStudioFocus.addEventListener('click', () => {
      const isHidden = studioFocusBar.classList.toggle('hidden');
      btnStudioFocus.classList.toggle('active', !isHidden);
    });
  }

  const btnStudioPrompterMin = document.getElementById('btn-studio-prompter-min');
  if (btnStudioPrompterMin && studioPrompter) {
    btnStudioPrompterMin.addEventListener('click', () => {
      studioPrompter.classList.toggle('minimized');
    });
  }

  if (btnPrompterPip) {
    const pipManager = new PiPPrompterManager();
    btnPrompterPip.addEventListener('click', async () => {
      if (isScrolling) toggleScroll();

      await pipManager.openPiP({
        width: 680,
        height: 340,
        wpm: currentWpm,
        fontSize: currentFontSize,
        isTransparent: false,
        script: currentScript,
        scripts: scriptsList,
        initialScrollTop: prompterViewport.scrollTop,
        onClose: (res) => {
          if (res && typeof res.finalScrollTop === 'number') {
            prompterViewport.scrollTop = res.finalScrollTop;
          }
          if (res && res.wpm) {
            adjustWpm(res.wpm - currentWpm);
          }
        }
      });
    });
  }

  // Font size adjustments
  btnFontDec.addEventListener('click', () => {
    currentFontSize = Math.max(16, currentFontSize - 2);
    labelFont.textContent = `${currentFontSize}px`;
    if (studioPrompter) {
      studioPrompter.style.setProperty('--sp-base-font-size', `${currentFontSize}px`);
    }
    updateStudioPrompterScale();
    if (Storage) Storage.saveSettings({ fontSize: currentFontSize });
  });

  btnFontInc.addEventListener('click', () => {
    currentFontSize = Math.min(48, currentFontSize + 2);
    labelFont.textContent = `${currentFontSize}px`;
    if (studioPrompter) {
      studioPrompter.style.setProperty('--sp-base-font-size', `${currentFontSize}px`);
    }
    updateStudioPrompterScale();
    if (Storage) Storage.saveSettings({ fontSize: currentFontSize });
  });

  // Color selection
  selectColor.addEventListener('change', (e) => {
    currentColor = e.target.value;
    prompterText.style.color = currentColor;
    if (Storage) Storage.saveSettings({ textColor: currentColor });
  });

  // Script selection
  selectScript.addEventListener('change', (e) => {
    const s = scriptsList.find(x => x.id === e.target.value);
    if (s) {
      currentScript = s;
      prompterText.innerText = s.content;
      prompterViewport.scrollTop = 0;
      scrollAccumulator = 0;
      if (Storage) Storage.setActiveScript(s.id);
    }
  });

  // Inline script edit saving
  prompterText.addEventListener('input', () => {
    if (currentScript) {
      currentScript.content = prompterText.innerText;
      if (Storage) {
        const idx = scriptsList.findIndex(s => s.id === currentScript.id);
        if (idx >= 0) scriptsList[idx] = currentScript;
        Storage.saveScript(currentScript);
      }
    }
  });

  // Aspect ratio switcher
  ratioBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      ratioBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentRatio = btn.dataset.ratio;

      cameraContainer.className = 'camera-container';
      if (currentRatio === '16:9') cameraContainer.classList.add('ratio-16-9');
      else if (currentRatio === '9:16') cameraContainer.classList.add('ratio-9-16');
      else if (currentRatio === '1:1') cameraContainer.classList.add('ratio-1-1');

      if (recorder) {
        recorder.setAspectRatio(currentRatio);
      }

      // Reset manual overrides so prompter dynamically snaps and elastically follows the new aspect ratio
      if (studioPrompter) {
        delete studioPrompter.dataset.manualSized;
        delete studioPrompter.dataset.manualMoved;
      }

      // Apply immediately and on subsequent layout paint frames for fluid elastic adaptation
      applyRatioToPrompter(currentRatio, true);
      setTimeout(() => {
        applyRatioToPrompter(currentRatio, true);
      }, 50);
      setTimeout(() => {
        applyRatioToPrompter(currentRatio, true);
      }, 180);
    });
  });

  // Framing Guides toggle
  btnToggleGuides.addEventListener('click', () => {
    showGuides = !showGuides;
    btnToggleGuides.classList.toggle('active', showGuides);
    framingOverlay.classList.toggle('hidden', !showGuides);
  });

  // Mirror toggle
  btnToggleMirror.addEventListener('click', () => {
    isMirror = !isMirror;
    btnToggleMirror.classList.toggle('active', isMirror);
    videoEl.classList.toggle('mirrored', isMirror);
    if (recorder) {
      recorder.setMirror(isMirror);
    }
  });

  // Exit Studio
  btnCloseStudio.addEventListener('click', () => {
    if (recorder) {
      recorder.stopCamera();
    }
    window.close();
  });

  // Overlay Prompter HUD toggle on browser tabs
  btnToggleOverlayHUD.addEventListener('click', () => {
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
      chrome.runtime.sendMessage({ type: 'LAUNCH_PROMPTER_ON_ACTIVE_TAB' });
    }
  });

  // Review Modal Controls
  function showReviewModal(take) {
    if (reviewVideo && take.url) {
      reviewVideo.src = take.url;
      reviewVideo.play().catch(() => {});
    }
    metaDuration.textContent = `⏱ ${take.formattedTime || '00:00'}`;
    metaSize.textContent = `💾 ${take.fileSizeFormatted || '0 MB'}`;
    reviewModal.style.display = 'flex';
  }

  function closeReview() {
    reviewModal.style.display = 'none';
    if (reviewVideo) {
      reviewVideo.pause();
      reviewVideo.removeAttribute('src');
      reviewVideo.load();
    }
  }

  btnCloseReview.addEventListener('click', closeReview);

  btnSaveVideo.addEventListener('click', async () => {
    if (currentTake && currentTake.blob) {
      const dateStr = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const filename = `ghostprompter-studio-${dateStr}.webm`;

      btnSaveVideo.disabled = true;
      btnSaveVideo.innerHTML = '<span>💾</span> Saving to D:\\facescreen recording...';

      try {
        const res = await VideoRecorder.saveVideoFile(currentTake.blob, filename);
        if (res && res.success) {
          const dir = res.directory ? res.directory : 'D:\\facescreen recording';
          btnSaveVideo.innerHTML = `<span>✓</span> Saved to ${dir}!`;
          if (metaStorageDest) {
            metaStorageDest.textContent = `✓ Saved: ${res.filename} in ${dir}`;
            metaStorageDest.style.color = '#00FF88';
          }
          setTimeout(() => {
            btnSaveVideo.disabled = false;
            btnSaveVideo.innerHTML = '<span>💾</span> Save Video (.webm)';
          }, 3000);
        } else if (res && res.aborted) {
          btnSaveVideo.disabled = false;
          btnSaveVideo.innerHTML = '<span>💾</span> Save Video (.webm)';
        } else {
          VideoRecorder.downloadBlob(currentTake.blob, filename);
          btnSaveVideo.disabled = false;
          btnSaveVideo.innerHTML = '<span>💾</span> Save Video (.webm)';
        }
      } catch (err) {
        VideoRecorder.downloadBlob(currentTake.blob, filename);
        btnSaveVideo.disabled = false;
        btnSaveVideo.innerHTML = '<span>💾</span> Save Video (.webm)';
      }
    }
  });

  btnRetake.addEventListener('click', () => {
    closeReview();
    prompterViewport.scrollTop = 0;
    scrollAccumulator = 0;
    setTimeout(() => {
      startRecording();
    }, 200);
  });

  // ==========================================================================
  // Studio Teleprompter Dragging & Elastic Resizing (Bidirectional Elastic)
  // ==========================================================================

  /**
   * Bidirectional elastic sizing and positioning for Studio Prompter.
   * Dynamically adapts to aspect ratios (16:9, 9:16, 1:1) and container size changes.
   * Shrinks on narrow/mobile ratios and expands on wider landscape/square ratios.
   * @param {string} ratio - '16:9', '9:16', or '1:1'
   * @param {boolean} forceReset - whether to reset to ratio defaults (e.g. on ratio button click)
   */
  function applyRatioToPrompter(ratio, forceReset = false) {
    if (!studioPrompter || !cameraContainer) return;

    const containerW = cameraContainer.clientWidth;
    const containerH = cameraContainer.clientHeight;
    if (!containerW || !containerH) return;

    let targetW, targetH, targetTop, targetLeft;

    if (ratio === '9:16') {
      // Portrait / Shorts / Reels (e.g. 350x620)
      // Narrow canvas: prompter occupies ~92% width, centered
      targetW = Math.max(240, Math.min(containerW - 16, Math.round(containerW * 0.92)));
      targetH = Math.max(140, Math.min(220, Math.round(containerH * 0.30)));
      targetTop = Math.max(10, Math.round(containerH * 0.20));
    } else if (ratio === '1:1') {
      // Square / Feed (e.g. 620x620)
      // Medium canvas: prompter occupies ~82% width, up to 540px
      targetW = Math.max(260, Math.min(containerW - 24, Math.round(containerW * 0.82), 540));
      targetH = Math.max(150, Math.min(240, Math.round(containerH * 0.35)));
      targetTop = Math.max(14, Math.round(containerH * 0.22));
    } else {
      // 16:9 Landscape / Desktop / YouTube (e.g. 1000x562)
      // Wide canvas: prompter occupies ~76% width, up to 780px
      targetW = Math.max(280, Math.min(containerW - 32, Math.round(containerW * 0.76), 780));
      targetH = Math.max(160, Math.min(270, Math.round(containerH * 0.40)));
      targetTop = Math.max(16, Math.round(containerH * 0.23));
    }

    targetLeft = Math.max(8, Math.round((containerW - targetW) / 2));

    if (forceReset || !studioPrompter.dataset.manualSized) {
      studioPrompter.style.width = `${targetW}px`;
      studioPrompter.style.height = `${targetH}px`;
    } else {
      // Keep manual size within new container bounds
      const maxW = Math.max(240, containerW - 16);
      const maxH = Math.max(120, containerH - 20);
      const curW = studioPrompter.offsetWidth;
      const curH = studioPrompter.offsetHeight;
      if (curW > maxW) studioPrompter.style.width = `${maxW}px`;
      if (curH > maxH) studioPrompter.style.height = `${maxH}px`;
    }

    if (forceReset || !studioPrompter.dataset.manualMoved) {
      studioPrompter.style.left = `${targetLeft}px`;
      studioPrompter.style.top = `${targetTop}px`;
    } else {
      // Keep manual position within new container bounds
      const maxLeft = Math.max(8, containerW - studioPrompter.offsetWidth - 8);
      const maxTop = Math.max(10, containerH - studioPrompter.offsetHeight - 10);
      const curLeft = studioPrompter.offsetLeft;
      const curTop = studioPrompter.offsetTop;
      studioPrompter.style.left = `${Math.max(8, Math.min(maxLeft, curLeft))}px`;
      studioPrompter.style.top = `${Math.max(10, Math.min(maxTop, curTop))}px`;
    }

    studioPrompter.style.transform = 'none';
    studioPrompter.dataset.positioned = 'true';
    updateStudioPrompterScale();
  }

  function setupStudioPrompterDrag() {
    if (!prompterHeader || !studioPrompter || !cameraContainer) return;

    let isDragging = false;
    let startX = 0, startY = 0;
    let initialLeft = 0, initialTop = 0;
    let hasMoved = false;

    prompterHeader.addEventListener('mousedown', (e) => {
      // Ignore clicks on buttons or input controls inside header
      if (e.target.tagName.toLowerCase() === 'button' || e.target.closest('button')) {
        return;
      }
      e.preventDefault();

      isDragging = true;
      hasMoved = false;
      studioPrompter.classList.add('dragging');

      // Normalize CSS transform if still present
      if (studioPrompter.style.transform !== 'none' && !studioPrompter.dataset.positioned) {
        const rect = studioPrompter.getBoundingClientRect();
        const parentRect = cameraContainer.getBoundingClientRect();
        studioPrompter.style.transform = 'none';
        studioPrompter.style.left = `${rect.left - parentRect.left}px`;
        studioPrompter.style.top = `${rect.top - parentRect.top}px`;
        studioPrompter.dataset.positioned = 'true';
      }

      startX = e.clientX;
      startY = e.clientY;
      initialLeft = studioPrompter.offsetLeft;
      initialTop = studioPrompter.offsetTop;

      const onMouseMove = (moveEvent) => {
        if (!isDragging) return;
        const dx = moveEvent.clientX - startX;
        const dy = moveEvent.clientY - startY;

        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
          hasMoved = true;
        }

        const maxLeft = Math.max(8, cameraContainer.clientWidth - studioPrompter.offsetWidth - 8);
        const maxTop = Math.max(10, cameraContainer.clientHeight - studioPrompter.offsetHeight - 10);

        const newLeft = Math.max(8, Math.min(maxLeft, initialLeft + dx));
        const newTop = Math.max(10, Math.min(maxTop, initialTop + dy));

        studioPrompter.style.left = `${newLeft}px`;
        studioPrompter.style.top = `${newTop}px`;
      };

      const onMouseUp = () => {
        isDragging = false;
        studioPrompter.classList.remove('dragging');
        if (hasMoved) {
          studioPrompter.dataset.manualMoved = 'true';
        }
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
      };

      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    });
  }

  function setupStudioPrompterResize() {
    if (!studioPrompter || !cameraContainer) return;

    prompterResizeHandles.forEach(handle => {
      handle.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();

        const dir = handle.dataset.dir; // 'se', 's', 'e', 'sw', 'w'
        let isResizing = true;
        let hasResized = false;
        studioPrompter.classList.add('resizing');

        // Normalize transform
        if (studioPrompter.style.transform !== 'none' && !studioPrompter.dataset.positioned) {
          const rect = studioPrompter.getBoundingClientRect();
          const parentRect = cameraContainer.getBoundingClientRect();
          studioPrompter.style.transform = 'none';
          studioPrompter.style.left = `${rect.left - parentRect.left}px`;
          studioPrompter.style.top = `${rect.top - parentRect.top}px`;
          studioPrompter.dataset.positioned = 'true';
        }

        const startX = e.clientX;
        const startY = e.clientY;
        const startWidth = studioPrompter.offsetWidth;
        const startHeight = studioPrompter.offsetHeight;
        const startLeft = studioPrompter.offsetLeft;
        const startTop = studioPrompter.offsetTop;

        const onMouseMove = (moveEvent) => {
          if (!isResizing) return;
          const dx = moveEvent.clientX - startX;
          const dy = moveEvent.clientY - startY;

          if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
            hasResized = true;
          }

          const maxW = Math.max(240, cameraContainer.clientWidth - 16);
          const maxH = Math.max(120, cameraContainer.clientHeight - 20);

          if (dir === 'se' || dir === 'e') {
            const newW = Math.max(240, Math.min(maxW - startLeft, startWidth + dx));
            studioPrompter.style.width = `${newW}px`;
          }
          if (dir === 'se' || dir === 's' || dir === 'sw') {
            const newH = Math.max(120, Math.min(maxH - startTop, startHeight + dy));
            studioPrompter.style.height = `${newH}px`;
          }
          if (dir === 'w' || dir === 'sw') {
            const targetW = startWidth - dx;
            if (targetW >= 240 && startLeft + dx >= 8) {
              studioPrompter.style.width = `${targetW}px`;
              studioPrompter.style.left = `${startLeft + dx}px`;
            }
          }

          updateStudioPrompterScale();
        };

        const onMouseUp = () => {
          isResizing = false;
          studioPrompter.classList.remove('resizing');
          if (hasResized) {
            studioPrompter.dataset.manualSized = 'true';
          }
          updateStudioPrompterScale();
          window.removeEventListener('mousemove', onMouseMove);
          window.removeEventListener('mouseup', onMouseUp);
        };

        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
      });
    });

    if (window.ResizeObserver) {
      let lastCW = 0;
      let lastCH = 0;
      const ro = new ResizeObserver((entries) => {
        for (const entry of entries) {
          if (entry.target === cameraContainer) {
            const cw = cameraContainer.clientWidth;
            const ch = cameraContainer.clientHeight;
            if (cw && ch && (Math.abs(cw - lastCW) > 4 || Math.abs(ch - lastCH) > 4)) {
              lastCW = cw;
              lastCH = ch;
              applyRatioToPrompter(currentRatio, false);
            }
          } else if (entry.target === studioPrompter) {
            updateStudioPrompterScale();
          }
        }
      });
      ro.observe(cameraContainer);
      ro.observe(studioPrompter);
    }

    window.addEventListener('resize', () => {
      applyRatioToPrompter(currentRatio, false);
    });
  }

  function updateStudioPrompterScale() {
    if (!studioPrompter) return;
    const w = studioPrompter.offsetWidth || 600;
    const h = studioPrompter.offsetHeight || 220;

    const baseWidth = 600;
    const baseHeight = 220;

    const widthRatio = w / baseWidth;
    const heightRatio = h / baseHeight;

    // Responsive elastic dampening factor
    const scale = Math.max(0.68, Math.min(1.40, (widthRatio * 0.65 + heightRatio * 0.35)));
    const fontScale = Math.max(0.68, Math.min(1.45, widthRatio));

    studioPrompter.style.setProperty('--sp-scale', scale.toFixed(3));
    studioPrompter.style.setProperty('--sp-font-scale', fontScale.toFixed(3));
    studioPrompter.style.setProperty('--sp-base-font-size', `${currentFontSize}px`);

    // Responsive title and controls density
    if (w < 315) {
      studioPrompter.classList.add('prompter-compact', 'prompter-xs');
    } else if (w < 395) {
      studioPrompter.classList.add('prompter-compact');
      studioPrompter.classList.remove('prompter-xs');
    } else {
      studioPrompter.classList.remove('prompter-compact', 'prompter-xs');
    }
  }

  // Global Keyboard Shortcuts inside Studio
  window.addEventListener('keydown', (e) => {
    const tag = document.activeElement ? document.activeElement.tagName.toLowerCase() : '';
    const isEditing = document.activeElement === prompterText;

    if (e.altKey && (e.key === 'r' || e.key === 'R')) {
      e.preventDefault();
      toggleRecording();
      return;
    }

    if (!isEditing && tag !== 'input' && tag !== 'select') {
      if (e.code === 'Space') {
        e.preventDefault();
        toggleScroll();
      } else if (e.key === '[') {
        e.preventDefault();
        adjustWpm(-10);
      } else if (e.key === ']') {
        e.preventDefault();
        adjustWpm(10);
      } else if (e.key === 'Escape') {
        if (reviewModal.style.display === 'flex') {
          closeReview();
        }
      }
    }
  });

  console.log('Ghost Studio initialized. Ratio: 16:9 | 9:16 | 1:1. Hotkey: Alt+R: Record | Space: Auto-Scroll.');
});
