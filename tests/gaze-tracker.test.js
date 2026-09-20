const assert = require('assert');
const GazeTracker = require('../src/modules/gaze-tracker.js');

function createMockImageData(width, height, pupilOffsetY = 0) {
  const data = new Uint8ClampedArray(width * height * 4);

  // Fill background skin/face tone (~180 luminance)
  for (let i = 0; i < data.length; i += 4) {
    data[i] = 190;     // R
    data[i + 1] = 170; // G
    data[i + 2] = 160; // B
    data[i + 3] = 255; // A
  }

  // Draw dark pupil spot in the eye band
  const centerX = Math.floor(width * 0.5);
  const centerY = Math.floor(height * 0.40) + pupilOffsetY;
  const radius = 6;

  for (let y = centerY - radius; y <= centerY + radius; y++) {
    for (let x = centerX - radius; x <= centerX + radius; x++) {
      if (x >= 0 && x < width && y >= 0 && y < height) {
        const dist = Math.hypot(x - centerX, y - centerY);
        if (dist <= radius) {
          const idx = (y * width + x) * 4;
          data[idx] = 20;     // R (dark pupil)
          data[idx + 1] = 20; // G
          data[idx + 2] = 25; // B
        }
      }
    }
  }

  return { data, width, height };
}

function runTests() {
  console.log('Testing GazeTracker...');

  // 1. Baseline settings
  GazeTracker.setBaseline(0.52);
  assert.strictEqual(GazeTracker.getBaseline(), 0.52, 'Baseline should be 0.52');

  // 2. Blank frame detection (away)
  const blankFrame = {
    data: new Uint8ClampedArray(320 * 240 * 4), // all black
    width: 320,
    height: 240
  };
  const blankRes = GazeTracker.analyzeFrame(blankFrame, 320, 240);
  assert.strictEqual(blankRes.zone, 'away', 'Blank frame should be classified as away');

  // 3. Lower gaze simulation (reading downward)
  GazeTracker.setBaseline(0.50);
  const lowerFrame = createMockImageData(320, 240, 8); // pupil shifted down
  // Run several frames to let exponential smoothing settle
  let lowerRes;
  for (let i = 0; i < 6; i++) {
    lowerRes = GazeTracker.analyzeFrame(lowerFrame, 320, 240);
  }
  assert(lowerRes.detected, 'Pupil should be detected');
  assert.strictEqual(lowerRes.zone, 'lower', `Should be lower zone, got ${lowerRes.zone}`);

  // 4. Upper gaze simulation (looking directly at camera)
  const upperFrame = createMockImageData(320, 240, -8); // pupil shifted up
  let upperRes;
  for (let i = 0; i < 8; i++) {
    upperRes = GazeTracker.analyzeFrame(upperFrame, 320, 240);
  }
  assert(upperRes.detected, 'Pupil should be detected');
  assert.strictEqual(upperRes.zone, 'top', `Should be top zone, got ${upperRes.zone}`);

  console.log('✅ All GazeTracker unit tests passed successfully!');
}

runTests();
