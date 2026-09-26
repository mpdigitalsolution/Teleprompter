/**
 * GhostPrompter Floating Window Controller
 * Renders the full modern prompter interface with Screen Share & Collapsible Controls.
 */

document.addEventListener('DOMContentLoaded', async () => {
  const Storage = window.GhostStorage;
  let settings = {};
  let scripts = [];
  let activeScriptId = 'default';

  if (Storage) {
    settings = await Storage.getSettings();
    scripts = await Storage.getScripts();
    activeScriptId = await Storage.getActiveScriptId();
  }

  const currentScript = scripts.find(s => s.id === activeScriptId) || scripts[0] || {
    id: 'default',
    title: 'GhostPrompter Script',
    content: 'Welcome to your Floating Teleprompter! 👻\n\n• Press Spacebar to play/pause auto-scroll.\n• Click [🔴 Rec] to record your screen or camera.\n• Click [⚙ Controls] to customize speed, font, opacity, and scripts.'
  };

  const pipManager = new PiPPrompterManager();
  let videoRecorder = null;

  function getRecorder() {
    if (videoRecorder) return videoRecorder;
    const RecClass = window.VideoRecorder || (typeof VideoRecorder !== 'undefined' ? VideoRecorder : null);
    if (!RecClass) return null;

    videoRecorder = new RecClass({
      videoQuality: '1080p',
      aspectRatio: '16:9',
      mirror: true,
      onStart: () => {
        pipManager.updateRecordingState(true, '00:00');
      },
      onTimeUpdate: (elapsed, formattedTime) => {
        const timeStr = typeof elapsed === 'object' && elapsed !== null
          ? (elapsed.formattedTime || (typeof VideoRecorder !== 'undefined' ? VideoRecorder.formatTime(elapsed.elapsedSeconds || 0) : '00:00'))
          : (formattedTime || (typeof VideoRecorder !== 'undefined' ? VideoRecorder.formatTime(typeof elapsed === 'number' ? elapsed : 0) : '00:00'));
        pipManager.updateRecordingState(true, timeStr);
      },
      onStop: (take) => {
        pipManager.updateRecordingState(false);
        pipManager.showRecordingModal(take);
      },
      onError: (err) => {
        pipManager.updateRecordingState(false);
        alert('Recording error: ' + (err.message || err));
      }
    });
    return videoRecorder;
  }

  pipManager.currentWpm = settings.wpm || 130;
  pipManager.currentFontSize = settings.fontSize || 24;
  pipManager.isTransparent = !!settings.isTransparentMode;
  pipManager.currentOpacity = typeof settings.opacity === 'number' ? settings.opacity : (pipManager.isTransparent ? 0.35 : 0.94);
  pipManager.currentTextColor = settings.textColor || '#00F0FF';
  pipManager.currentTrackingMode = settings.trackingMode || 'auto';
  pipManager.isGhostMode = false;
  pipManager.isToolbarCollapsed = true;
  pipManager.currentScript = currentScript;
  pipManager.scriptsList = scripts.length ? scripts : [currentScript];

  pipManager.onStartScreenRecording = async () => {
    const rec = getRecorder();
    if (rec) await rec.startRecordingWithCountdown('screen');
  };
  pipManager.onStartCameraRecording = async () => {
    const rec = getRecorder();
    if (rec) await rec.startRecordingWithCountdown('camera');
  };
  pipManager.onStopRecording = () => {
    if (videoRecorder) videoRecorder.stopRecording();
  };
  pipManager.isRecordingFn = () => (videoRecorder && videoRecorder.state === 'recording');

  // Initialize unified modern prompter interface inside this window
  const urlParams = new URLSearchParams(window.location.search);
  const isCompactOnly = urlParams.get('compact') === 'true';

  pipManager.activePiPWindow = window;
  pipManager.setupPiPDocument(window, 0, isCompactOnly);
});
