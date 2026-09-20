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

  const selectScript = document.getElementById('select-studio-script');
  const btnFontDec = document.getElementById('btn-font-dec');
  const btnFontInc = document.getElementById('btn-font-inc');
  const labelFont = document.getElementById('label-font');
  const selectColor = document.getElementById('select-font-color');

  const ratioBtns = document.querySelectorAll('.ratio-btn');
  const btnToggleGuides = document.getElementById('btn-toggle-guides');
  const btnToggleMirror = document.getElementById('btn-toggle-mirror');
  const btnCloseStudio = document.getElementById('btn-close-studio');
  const btnToggleOverlayHUD = document.getElementById('btn-toggle-hud-prompter');

  // Modal Elements
  const reviewModal = document.getElementById('review-modal');
  const reviewVideo = document.getElementById('review-video-player');
  const metaDuration = document.getElementById('meta-duration');
  const metaSize = document.getElementById('meta-size');
  const btnCloseReview = document.getElementById('btn-close-review');
  const btnSaveVideo = document.getElementById('btn-save-video');
  const btnRetake = document.getElementById('btn-retake');

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

  updateStudioPrompterScale();
  setupStudioPrompterDrag();
  setupStudioPrompterResize();

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
      recTimer.textContent = formattedTime;
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

  // Start Hardware Camera Stream
  try {
    const stream = await recorder.startCamera();
    videoEl.srcObject = stream;
    videoEl.play().catch(() => {});
  } catch (err) {
    console.warn('Camera could not start automatically:', err);
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
      await recorder.startRecordingWithCountdown();
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

      // Re-center prompter inside new aspect container and adapt size
      setTimeout(() => {
        if (studioPrompter && cameraContainer) {
          const containerW = cameraContainer.clientWidth;
          const containerH = cameraContainer.clientHeight;
          if (studioPrompter.offsetWidth > containerW - 20) {
            studioPrompter.style.width = Math.max(260, containerW - 30) + 'px';
          }
          studioPrompter.style.transform = 'none';
          studioPrompter.dataset.positioned = 'true';
          const newLeft = Math.max(10, (containerW - studioPrompter.offsetWidth) / 2);
          const currentTop = parseInt(studioPrompter.style.top, 10) || 100;
          const newTop = Math.max(20, Math.min(containerH - studioPrompter.offsetHeight - 20, currentTop));
          studioPrompter.style.left = `${newLeft}px`;
          studioPrompter.style.top = `${newTop}px`;
          updateStudioPrompterScale();
        }
      }, 100);
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

  btnSaveVideo.addEventListener('click', () => {
    if (currentTake && currentTake.blob) {
      const dateStr = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const filename = `ghostprompter-studio-${dateStr}.webm`;
      VideoRecorder.downloadBlob(currentTake.blob, filename);
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
  // Studio Teleprompter Dragging & Elastic Resizing
  // ==========================================================================

  function setupStudioPrompterDrag() {
    if (!prompterHeader || !studioPrompter || !cameraContainer) return;

    let isDragging = false;
    let startX = 0, startY = 0;
    let initialLeft = 0, initialTop = 0;

    prompterHeader.addEventListener('mousedown', (e) => {
      // Ignore clicks on buttons or input controls inside header
      if (e.target.tagName.toLowerCase() === 'button' || e.target.closest('button')) {
        return;
      }
      e.preventDefault();

      isDragging = true;
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

        const maxLeft = Math.max(10, cameraContainer.clientWidth - studioPrompter.offsetWidth - 10);
        const maxTop = Math.max(10, cameraContainer.clientHeight - studioPrompter.offsetHeight - 10);

        const newLeft = Math.max(10, Math.min(maxLeft, initialLeft + dx));
        const newTop = Math.max(10, Math.min(maxTop, initialTop + dy));

        studioPrompter.style.left = `${newLeft}px`;
        studioPrompter.style.top = `${newTop}px`;
      };

      const onMouseUp = () => {
        isDragging = false;
        studioPrompter.classList.remove('dragging');
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

          const maxW = Math.max(260, cameraContainer.clientWidth - 20);
          const maxH = Math.max(120, cameraContainer.clientHeight - 20);

          if (dir === 'se' || dir === 'e') {
            const newW = Math.max(260, Math.min(maxW - startLeft, startWidth + dx));
            studioPrompter.style.width = `${newW}px`;
          }
          if (dir === 'se' || dir === 's' || dir === 'sw') {
            const newH = Math.max(120, Math.min(maxH - startTop, startHeight + dy));
            studioPrompter.style.height = `${newH}px`;
          }
          if (dir === 'w' || dir === 'sw') {
            const targetW = startWidth - dx;
            if (targetW >= 260 && startLeft + dx >= 10) {
              studioPrompter.style.width = `${targetW}px`;
              studioPrompter.style.left = `${startLeft + dx}px`;
            }
          }

          updateStudioPrompterScale();
        };

        const onMouseUp = () => {
          isResizing = false;
          studioPrompter.classList.remove('resizing');
          updateStudioPrompterScale();
          window.removeEventListener('mousemove', onMouseMove);
          window.removeEventListener('mouseup', onMouseUp);
        };

        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
      });
    });

    if (window.ResizeObserver) {
      const ro = new ResizeObserver(() => {
        updateStudioPrompterScale();
      });
      ro.observe(studioPrompter);
      ro.observe(cameraContainer);
    }
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
