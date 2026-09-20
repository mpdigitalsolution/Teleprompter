/**
 * GhostPrompter Setup, Calibration & Script Manager Controller
 */

let activeStream = null;
let currentScripts = [];
let selectedScript = null;
let isCalibrating = false;
let animFrame = null;

document.addEventListener('DOMContentLoaded', async () => {
  initScriptManager();
  checkExistingPermissions();
  setupEventListeners();
});

async function checkExistingPermissions() {
  if (navigator.permissions && navigator.permissions.query) {
    try {
      const cam = await navigator.permissions.query({ name: 'camera' });
      const mic = await navigator.permissions.query({ name: 'microphone' });
      if (cam.state === 'granted' && mic.state === 'granted') {
        updatePermStatusBadge(true);
        startPreviewStream();
      }
    } catch (e) {
      // Some browsers don't support camera/mic in permissions.query
    }
  }
}

function updatePermStatusBadge(granted) {
  const badge = document.getElementById('perm-status-badge');
  const grantBtn = document.getElementById('btn-request-perm');
  const calBtn = document.getElementById('btn-calibrate');
  const micBtn = document.getElementById('btn-test-speech');

  if (granted) {
    badge.textContent = '● Permissions Active';
    badge.style.background = 'rgba(0, 255, 136, 0.15)';
    badge.style.borderColor = 'rgba(0, 255, 136, 0.4)';
    badge.style.color = '#00FF88';
    grantBtn.textContent = '✓ Access Granted';
    grantBtn.disabled = true;
    grantBtn.classList.add('btn-secondary');
    calBtn.disabled = false;
    micBtn.disabled = false;
  }
}

function setupEventListeners() {
  document.getElementById('btn-request-perm').addEventListener('click', requestPermissions);
  document.getElementById('btn-calibrate').addEventListener('click', startCalibration);
  document.getElementById('btn-test-speech').addEventListener('click', toggleSpeechTest);
}

async function requestPermissions() {
  try {
    activeStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    updatePermStatusBadge(true);
    startPreviewStream();
  } catch (err) {
    alert('Permission request failed or was cancelled: ' + err.message);
  }
}

async function startPreviewStream() {
  if (!activeStream) {
    try {
      activeStream = await navigator.mediaDevices.getUserMedia({
        video: { width: 320, height: 240, frameRate: 12 },
        audio: true
      });
    } catch (e) {
      return;
    }
  }

  const video = document.getElementById('setup-video');
  const placeholder = document.getElementById('video-placeholder');
  const canvas = document.getElementById('setup-canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  video.srcObject = activeStream;
  await video.play();
  placeholder.style.display = 'none';

  canvas.width = 320;
  canvas.height = 240;

  function renderLoop() {
    if (video.readyState >= 2) {
      ctx.drawImage(video, 0, 0, 320, 240);

      // Run gaze detection preview
      if (window.GazeTracker) {
        const frameData = ctx.getImageData(0, 0, 320, 240);
        const result = window.GazeTracker.analyzeFrame(frameData, 320, 240);

        if (result && result.eyeRect) {
          // Draw eye box overlay
          ctx.strokeStyle = '#00F0FF';
          ctx.lineWidth = 2;
          ctx.strokeRect(result.eyeRect.x, result.eyeRect.y, result.eyeRect.w, result.eyeRect.h);

          // Draw pupil crosshair
          if (result.pupil) {
            ctx.fillStyle = result.zone === 'lower' ? '#00FF88' : '#FF007A';
            ctx.beginPath();
            ctx.arc(result.pupil.x, result.pupil.y, 4, 0, Math.PI * 2);
            ctx.fill();
          }

          // Update zone indicator meter
          updateZoneMeter(result.zone);
        }
      }
    }
    animFrame = requestAnimationFrame(renderLoop);
  }

  renderLoop();
}

function updateZoneMeter(zone) {
  const zones = ['high', 'mid', 'low', 'away'];
  zones.forEach(z => {
    const el = document.getElementById(`zone-${z}`);
    if (el) el.classList.remove('active');
  });

  const zoneMap = {
    top: 'high',
    middle: 'mid',
    lower: 'low',
    away: 'away'
  };

  const activeId = `zone-${zoneMap[zone] || 'mid'}`;
  const target = document.getElementById(activeId);
  if (target) target.classList.add('active');
}

/**
 * 3-second neutral gaze calibration
 */
async function startCalibration() {
  const btn = document.getElementById('btn-calibrate');
  btn.disabled = true;
  let countdown = 3;
  btn.textContent = `Look at webcam... (${countdown}s)`;

  const samples = [];
  const canvas = document.getElementById('setup-canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  const interval = setInterval(() => {
    countdown--;
    if (canvas && window.GazeTracker) {
      const frameData = ctx.getImageData(0, 0, 320, 240);
      const res = window.GazeTracker.detectEyeFeatures(frameData, 320, 240);
      if (res && res.verticalRatio) {
        samples.push(res.verticalRatio);
      }
    }

    if (countdown > 0) {
      btn.textContent = `Look at webcam... (${countdown}s)`;
    } else {
      clearInterval(interval);
      const avg = samples.length ? samples.reduce((a, b) => a + b, 0) / samples.length : 0.5;
      if (window.GazeTracker) window.GazeTracker.setBaseline(avg);
      if (window.StorageManager) {
        window.StorageManager.saveSettings({ baselineGazeRatio: avg });
      }
      btn.textContent = '✓ Calibration Saved!';
      setTimeout(() => {
        btn.disabled = false;
        btn.textContent = 'Re-Calibrate Baseline (3s)';
      }, 2000);
    }
  }, 1000);
}

/**
 * Speech Recognition Tester
 */
let isTestingSpeech = false;
function toggleSpeechTest() {
  const btn = document.getElementById('btn-test-speech');
  const preview = document.getElementById('speech-preview');

  if (!window.SpeechTracker) {
    preview.textContent = 'Speech tracker module not loaded.';
    return;
  }

  if (!isTestingSpeech) {
    isTestingSpeech = true;
    btn.textContent = 'Stop Mic Test';
    btn.classList.add('btn');
    btn.classList.remove('btn-secondary');
    preview.textContent = 'Listening... Speak into your microphone now.';

    window.SpeechTracker.start((event) => {
      if (event && event.transcript) {
        preview.textContent = `"${event.transcript}"`;
      }
    });
  } else {
    isTestingSpeech = false;
    window.SpeechTracker.stop();
    btn.textContent = 'Test Microphone';
    btn.classList.remove('btn');
    btn.classList.add('btn-secondary');
  }
}

/**
 * Script Library Manager UI
 */
async function initScriptManager() {
  if (!window.StorageManager) return;
  currentScripts = await window.StorageManager.getScripts();
  selectedScript = await window.StorageManager.getActiveScript();
  renderScriptList();
  renderActiveScript();

  // Script actions
  document.getElementById('btn-new-script').addEventListener('click', async () => {
    const newScript = await window.StorageManager.createScript('New Script ' + (currentScripts.length + 1), '');
    currentScripts = await window.StorageManager.getScripts();
    selectedScript = newScript;
    renderScriptList();
    renderActiveScript();
  });

  document.getElementById('btn-save-script').addEventListener('click', async () => {
    if (!selectedScript) return;
    const titleInput = document.getElementById('script-title').value;
    const contentInput = document.getElementById('script-content').value;
    selectedScript.title = titleInput.trim() || 'Untitled Script';
    selectedScript.content = contentInput;
    await window.StorageManager.saveScript(selectedScript);
    currentScripts = await window.StorageManager.getScripts();
    renderScriptList();
    const saveBtn = document.getElementById('btn-save-script');
    saveBtn.textContent = '✓ Saved!';
    setTimeout(() => { saveBtn.textContent = 'Save Script'; }, 1500);
  });

  document.getElementById('btn-delete-script').addEventListener('click', async () => {
    if (!selectedScript) return;
    if (confirm(`Delete "${selectedScript.title}"?`)) {
      currentScripts = await window.StorageManager.deleteScript(selectedScript.id);
      selectedScript = currentScripts[0] || null;
      renderScriptList();
      renderActiveScript();
    }
  });

  // Import / Export
  const importInput = document.getElementById('file-import');
  document.getElementById('btn-import-script').addEventListener('click', () => importInput.click());
  importInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      const text = evt.target.result;
      const title = file.name.replace(/\.[^/.]+$/, '');
      const newScript = await window.StorageManager.createScript(title, text);
      currentScripts = await window.StorageManager.getScripts();
      selectedScript = newScript;
      renderScriptList();
      renderActiveScript();
    };
    reader.readAsText(file);
  });

  document.getElementById('btn-export-script').addEventListener('click', () => {
    if (!selectedScript) return;
    const blob = new Blob([selectedScript.content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedScript.title.toLowerCase().replace(/[^a-z0-9]/g, '-')}.md`;
    a.click();
    URL.revokeObjectURL(url);
  });
}

function renderScriptList() {
  const listEl = document.getElementById('script-list');
  listEl.innerHTML = '';
  currentScripts.forEach(script => {
    const item = document.createElement('div');
    item.className = `script-item ${selectedScript && selectedScript.id === script.id ? 'active' : ''}`;
    item.innerHTML = `<span>${script.title}</span>`;
    item.addEventListener('click', async () => {
      selectedScript = script;
      await window.StorageManager.setActiveScript(script.id);
      renderScriptList();
      renderActiveScript();
    });
    listEl.appendChild(item);
  });
}

function renderActiveScript() {
  if (!selectedScript) return;
  document.getElementById('script-title').value = selectedScript.title || '';
  document.getElementById('script-content').value = selectedScript.content || '';
}
