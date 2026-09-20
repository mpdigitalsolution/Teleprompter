/**
 * GhostPrompter Hybrid Scroller Engine
 * Fuses Gaze Tracking and Speech Synchronization into a natural, adaptive pacing controller.
 */

(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
  } else {
    root.ScrollerEngine = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {

  let isPlaying = false;
  let currentWpm = 130;
  let trackingMode = 'dual'; // 'dual' | 'gaze' | 'speech' | 'auto' | 'manual'
  let currentGazeZone = 'middle';
  let lastGazeTime = Date.now();
  let animFrameId = null;
  let targetElement = null;

  /**
   * Calculate effective velocity in pixels per second based on mode & inputs
   */
  function calculateVelocity() {
    if (!isPlaying) return 0;
    if (trackingMode === 'manual') return 0;

    // Base speed from WPM: average 1 line per 10 words, ~32px per line
    const basePixelsPerSec = (currentWpm / 60) * 3.2;

    if (trackingMode === 'auto') {
      return basePixelsPerSec;
    }

    // Gaze-influenced velocity
    let gazeMultiplier = 1.0;
    if (trackingMode === 'dual' || trackingMode === 'gaze') {
      switch (currentGazeZone) {
        case 'lower':
          gazeMultiplier = 1.65; // User reading down: smoothly accelerate
          break;
        case 'middle':
          gazeMultiplier = 1.0;  // Balanced steady pace
          break;
        case 'top':
          gazeMultiplier = 0.6;  // Making eye contact with webcam: gentle glide
          break;
        case 'away':
          gazeMultiplier = 0.0;  // Glanced away from camera/screen: hold spot!
          break;
      }
    }

    return basePixelsPerSec * gazeMultiplier;
  }

  /**
   * Continuous smooth scroll animation loop
   */
  function startLoop(element) {
    targetElement = element || targetElement;
    isPlaying = true;
    if (typeof cancelAnimationFrame !== 'undefined' && animFrameId) {
      cancelAnimationFrame(animFrameId);
    }

    if (typeof requestAnimationFrame === 'undefined') {
      return; // Headless environment
    }

    let lastTime = performance.now();

    function step(now) {
      if (!isPlaying || !targetElement) return;

      const dt = (now - lastTime) / 1000;
      lastTime = now;

      const velocity = calculateVelocity();
      if (velocity > 0) {
        targetElement.scrollTop += velocity * dt;
      }

      animFrameId = requestAnimationFrame(step);
    }

    animFrameId = requestAnimationFrame(step);
  }

  function pause() {
    isPlaying = false;
    if (typeof cancelAnimationFrame !== 'undefined' && animFrameId) {
      cancelAnimationFrame(animFrameId);
      animFrameId = null;
    }
  }

  function resume() {
    isPlaying = true;
    if (targetElement && typeof requestAnimationFrame !== 'undefined') {
      startLoop(targetElement);
    }
  }

  function toggle() {
    if (isPlaying) {
      pause();
    } else {
      resume();
    }
    return isPlaying;
  }

  function updateGaze(zone) {
    currentGazeZone = zone;
    lastGazeTime = Date.now();
  }

  function onSpeechAdvance(advancePixels) {
    if (!isPlaying || !targetElement) return;
    if (trackingMode === 'dual' || trackingMode === 'speech') {
      // If gaze is 'away', don't advance even if background noise detected
      if (trackingMode === 'dual' && currentGazeZone === 'away') {
        return;
      }
      targetElement.scrollTop += advancePixels;
    }
  }

  function nudge(pixels) {
    if (targetElement) {
      targetElement.scrollTop += pixels;
    }
  }

  return {
    startLoop,
    pause,
    resume,
    toggle,
    updateGaze,
    onSpeechAdvance,
    nudge,
    setWpm: (wpm) => { currentWpm = Math.max(50, Math.min(300, wpm)); },
    getWpm: () => currentWpm,
    setMode: (mode) => { trackingMode = mode; },
    getMode: () => trackingMode,
    isPlaying: () => isPlaying,
    calculateVelocity
  };
});
