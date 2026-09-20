/**
 * GhostPrompter Gaze Tracking Engine
 * Ultra-lightweight, sub-sampled client-side iris/pupil displacement tracker.
 * Optimized to run on budget hardware at 10-12 FPS with < 5% CPU usage.
 */

(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
  } else {
    root.GazeTracker = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {

  let baselineRatio = 0.50; // Neutral camera gaze baseline
  let smoothedRatio = 0.50;
  let smoothedPresence = 1.0;
  const SMOOTH_ALPHA = 0.40; // Exponential moving average smoothing factor
  let consecutiveAwayCount = 0;

  /**
   * Helper to compute luminance from RGBA
   */
  function getLuminance(r, g, b) {
    return 0.299 * r + 0.587 * g + 0.114 * b;
  }

  /**
   * Detect eye region and pupil centroid from ImageData
   */
  function detectEyeFeatures(imageData, width, height) {
    const data = imageData.data;

    // Head typically occupies center 60% of frame, upper 20%-60%
    const minX = Math.floor(width * 0.22);
    const maxX = Math.floor(width * 0.78);

    // Eye socket band boundaries within frame
    const eyeSocketTop = Math.floor(height * 0.30);
    const eyeSocketBottom = Math.floor(height * 0.50);
    const eyeSocketHeight = eyeSocketBottom - eyeSocketTop;

    let minLum = 255;
    let pupilX = -1;
    let pupilY = -1;
    let totalLum = 0;
    let pixelCount = 0;

    // Pass 1: Find darkest centroid (pupil candidate) in eye socket band
    for (let y = eyeSocketTop; y < eyeSocketBottom; y += 2) {
      for (let x = minX; x < maxX; x += 2) {
        const idx = (y * width + x) * 4;
        const lum = getLuminance(data[idx], data[idx + 1], data[idx + 2]);
        totalLum += lum;
        pixelCount++;

        if (lum < minLum) {
          minLum = lum;
          pupilX = x;
          pupilY = y;
        }
      }
    }

    const avgLum = pixelCount > 0 ? totalLum / pixelCount : 128;

    // Face / Eye presence check:
    // If scene is completely dark or contrast between minLum and avgLum is too low, user is away
    if (pixelCount === 0 || minLum > 180 || (avgLum - minLum) < 25) {
      return {
        detected: false,
        zone: 'away',
        verticalRatio: baselineRatio,
        confidence: 0
      };
    }

    // Refine pupil centroid using center-of-mass of pixels near minLum
    const searchRadius = 12;
    let sumX = 0, sumY = 0, weightSum = 0;
    const thresh = minLum + (avgLum - minLum) * 0.25;

    const rMinX = Math.max(minX, pupilX - searchRadius);
    const rMaxX = Math.min(maxX, pupilX + searchRadius);
    const rMinY = Math.max(eyeSocketTop, pupilY - searchRadius);
    const rMaxY = Math.min(eyeSocketBottom, pupilY + searchRadius);

    for (let y = rMinY; y <= rMaxY; y++) {
      for (let x = rMinX; x <= rMaxX; x++) {
        const idx = (y * width + x) * 4;
        const lum = getLuminance(data[idx], data[idx + 1], data[idx + 2]);
        if (lum <= thresh) {
          const weight = (thresh - lum + 1);
          sumX += x * weight;
          sumY += y * weight;
          weightSum += weight;
        }
      }
    }

    if (weightSum > 0) {
      pupilX = Math.round(sumX / weightSum);
      pupilY = Math.round(sumY / weightSum);
    }

    // Eye socket bounding box for visual display
    const eyeBox = {
      x: Math.max(0, pupilX - 22),
      y: eyeSocketTop,
      w: 44,
      h: eyeSocketHeight
    };

    // Calculate vertical ratio within anchored eye socket: 0.0 (top) to 1.0 (bottom)
    const rawRatio = Math.max(0, Math.min(1, (pupilY - eyeSocketTop) / eyeSocketHeight));

    return {
      detected: true,
      pupil: { x: pupilX, y: pupilY },
      eyeRect: eyeBox,
      verticalRatio: rawRatio,
      confidence: Math.min(1, (avgLum - minLum) / 100)
    };
  }

  /**
   * High-level frame analysis with smoothing and zone classification
   */
  function analyzeFrame(imageData, width, height) {
    const raw = detectEyeFeatures(imageData, width, height);

    if (!raw.detected) {
      consecutiveAwayCount++;
      smoothedPresence = Math.max(0, smoothedPresence - 0.3);
      return {
        detected: false,
        zone: 'away',
        verticalRatio: baselineRatio,
        confidence: 0,
        awayDuration: consecutiveAwayCount
      };
    }

    consecutiveAwayCount = 0;
    smoothedPresence = Math.min(1, smoothedPresence + 0.3);

    // Apply exponential smoothing
    smoothedRatio = SMOOTH_ALPHA * raw.verticalRatio + (1 - SMOOTH_ALPHA) * smoothedRatio;

    // Zone classification relative to calibrated neutral baseline:
    // Neutral is baselineRatio (default ~0.50).
    // Looking higher (towards camera): ratio < baselineRatio - 0.075
    // Looking lower (reading bottom 35% of prompter): ratio > baselineRatio + 0.075
    let zone = 'middle';
    const delta = smoothedRatio - baselineRatio;

    if (delta > 0.075) {
      zone = 'lower'; // Reading lower third: auto-scroll trigger!
    } else if (delta < -0.075) {
      zone = 'top';   // Direct eye contact with webcam lens
    } else {
      zone = 'middle'; // Center reading band
    }

    return {
      detected: true,
      zone: zone,
      verticalRatio: parseFloat(smoothedRatio.toFixed(3)),
      pupil: raw.pupil,
      eyeRect: raw.eyeRect,
      confidence: raw.confidence
    };
  }

  return {
    setBaseline: function (val) {
      if (typeof val === 'number' && val > 0.1 && val < 0.9) {
        baselineRatio = val;
        smoothedRatio = val;
      }
    },
    getBaseline: function () {
      return baselineRatio;
    },
    detectEyeFeatures: detectEyeFeatures,
    analyzeFrame: analyzeFrame
  };
});
