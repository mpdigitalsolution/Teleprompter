/**
 * GhostPrompter Desktop — Unit Tests for ScrollerEngine
 */

const assert = require('assert');
const ScrollerEngine = require('../src/renderer/shared/engines/scroller-engine');

function testScrollerEngine() {
  console.log('Testing Desktop ScrollerEngine...');

  const mockViewport = {
    scrollTop: 0,
    scrollHeight: 1000,
    clientHeight: 400
  };

  let stateChanges = [];
  const engine = new ScrollerEngine(mockViewport, {
    speedWPM: 160,
    lineHeightPx: 40,
    onStateChange: (state) => stateChanges.push(state)
  });

  // 1. Initial State
  assert.strictEqual(engine.isPlaying, false);
  assert.strictEqual(engine.speedWPM, 160);

  // 2. Velocity Calculation
  const pxPerSec160 = engine.calculatePixelsPerSecond();
  assert.ok(pxPerSec160 > 10, 'Pixels per sec should be positive and realistic');

  engine.setSpeed(320);
  const pxPerSec320 = engine.calculatePixelsPerSecond();
  assert.ok(pxPerSec320 > pxPerSec160, 'Higher WPM must yield higher velocity');
  console.log('✓ Physics speed & velocity calculation passed.');

  // 3. Play & Pause state transitions
  engine.play();
  assert.strictEqual(engine.isPlaying, true);
  assert.strictEqual(stateChanges[stateChanges.length - 1], true);

  engine.pause();
  assert.strictEqual(engine.isPlaying, false);
  assert.strictEqual(stateChanges[stateChanges.length - 1], false);

  engine.toggle();
  assert.strictEqual(engine.isPlaying, true);
  engine.toggle();
  assert.strictEqual(engine.isPlaying, false);
  console.log('✓ State transitions (play/pause/toggle) passed.');

  // 4. Clamping Speed Limits
  engine.setSpeed(10);
  assert.strictEqual(engine.speedWPM, 20, 'Speed must clamp at lower bound 20 WPM');

  engine.setSpeed(1000);
  assert.strictEqual(engine.speedWPM, 600, 'Speed must clamp at upper bound 600 WPM');
  console.log('✓ WPM speed clamping passed.');

  // 5. Seek
  engine.seek(150);
  assert.strictEqual(mockViewport.scrollTop, 150);
  console.log('✓ Viewport seek passed.');

  engine.destroy();
  console.log('✅ All Desktop ScrollerEngine unit tests passed successfully!\n');
}

testScrollerEngine();
