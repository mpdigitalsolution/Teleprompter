/**
 * GhostPrompter Offscreen Media Controller
 * Runs inside the Chrome Extension Offscreen Document to process video & audio
 * without being blocked by host-page Content Security Policies.
 */

let mediaStream = null;
let videoEl = null;
let canvasEl = null;
let canvasCtx = null;
let isTracking = false;
let trackingInterval = null;
let trackingMode = 'dual'; // 'dual' | 'gaze' | 'speech' | 'auto'

const FPS = 12; // Sub-sampled 12 FPS for ultra-low CPU load (< 5-8%)
const FRAME_INTERVAL_MS = 1000 / FPS;

document.addEventListener('DOMContentLoaded', () => {
  videoEl = document.getElementById('gp-offscreen-video');
  canvasEl = document.getElementById('gp-offscreen-canvas');
  if (canvasEl) {
    canvasCtx = canvasEl.getContext('2d', { willReadFrequently: true });
  }

  // Listen for control messages from background service worker
  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (!message || message.target !== 'offscreen') return;

      switch (message.type) {
        case 'START_TRACKING':
          trackingMode = message.trackingMode || 'dual';
          startCameraAndProcessing()
            .then(() => sendResponse({ success: true }))
            .catch(err => sendResponse({ success: false, error: err.message }));
          return true; // async response

        case 'STOP_TRACKING':
          stopCameraAndProcessing();
          sendResponse({ success: true });
          break;

        case 'SET_TRACKING_MODE':
          trackingMode = message.mode;
          sendResponse({ success: true, trackingMode });
          break;

        case 'CALIBRATE_BASELINE':
          calibrateNeutralGaze()
            .then(res => sendResponse({ success: true, baseline: res }))
            .catch(err => sendResponse({ success: false, error: err.message }));
          return true;
      }
    });
  }

  console.log('GhostPrompter offscreen media host initialized.');
});

/**
 * Acquire webcam stream and start processing loop
 */
async function startCameraAndProcessing() {
  if (isTracking) return;

  try {
    mediaStream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: 320 },
        height: { ideal: 240 },
        frameRate: { ideal: FPS, max: 15 }
      },
      audio: trackingMode === 'dual' || trackingMode === 'speech'
    });

    videoEl.srcObject = mediaStream;
    await videoEl.play();

    isTracking = true;

    // Start Gaze Tracking loop (10-12 FPS)
    if (trackingMode === 'dual' || trackingMode === 'gaze') {
      startGazeLoop();
    }

    // Start Speech Recognition
    if ((trackingMode === 'dual' || trackingMode === 'speech') && window.SpeechTracker) {
      window.SpeechTracker.start((speechEvent) => {
        broadcastEvent({
          type: 'SPEECH_SYNC_UPDATE',
          ...speechEvent
        });
      });
    }

    console.log('GhostPrompter media streams active.');
  } catch (err) {
    console.error('Failed to start camera/audio in offscreen:', err);
    throw err;
  }
}

/**
 * Sub-sampled 10-12 FPS frame analysis loop
 */
function startGazeLoop() {
  if (trackingInterval) clearInterval(trackingInterval);

  trackingInterval = setInterval(() => {
    if (!isTracking || !videoEl || videoEl.readyState < 2) return;

    if (canvasCtx && canvasEl) {
      canvasCtx.drawImage(videoEl, 0, 0, 320, 240);
      const frameData = canvasCtx.getImageData(0, 0, 320, 240);

      // Run lightweight client-side gaze estimation
      if (window.GazeTracker) {
        const gazeResult = window.GazeTracker.analyzeFrame(frameData, 320, 240);
        if (gazeResult) {
          broadcastEvent({
            type: 'GAZE_TRACKING_UPDATE',
            glanceZone: gazeResult.zone, // 'top' | 'middle' | 'lower' | 'away'
            verticalRatio: gazeResult.verticalRatio,
            confidence: gazeResult.confidence
          });
        }
      }
    }
  }, FRAME_INTERVAL_MS);
}

/**
 * Calibrate neutral gaze baseline
 */
async function calibrateNeutralGaze() {
  if (!window.GazeTracker) return null;
  return new Promise((resolve) => {
    let samples = [];
    const sampleInterval = setInterval(() => {
      if (canvasCtx && videoEl && videoEl.readyState >= 2) {
        canvasCtx.drawImage(videoEl, 0, 0, 320, 240);
        const frameData = canvasCtx.getImageData(0, 0, 320, 240);
        const res = window.GazeTracker.detectEyeFeatures(frameData, 320, 240);
        if (res && res.verticalRatio) {
          samples.push(res.verticalRatio);
        }
      }
      if (samples.length >= 15) {
        clearInterval(sampleInterval);
        const avg = samples.reduce((a, b) => a + b, 0) / samples.length;
        window.GazeTracker.setBaseline(avg);
        resolve(avg);
      }
    }, 100);
  });
}

/**
 * Stop media stream and cleanup
 */
function stopCameraAndProcessing() {
  isTracking = false;
  if (trackingInterval) {
    clearInterval(trackingInterval);
    trackingInterval = null;
  }
  if (window.SpeechTracker) {
    window.SpeechTracker.stop();
  }
  if (mediaStream) {
    mediaStream.getTracks().forEach(track => track.stop());
    mediaStream = null;
  }
  if (videoEl) {
    videoEl.srcObject = null;
  }
  console.log('GhostPrompter media streams stopped.');
}

/**
 * Helper to dispatch events to background service worker and content script
 */
function broadcastEvent(eventPayload) {
  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
    chrome.runtime.sendMessage({
      target: 'content',
      ...eventPayload
    });
  }
}
