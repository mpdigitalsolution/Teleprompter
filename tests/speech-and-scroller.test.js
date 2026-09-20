const assert = require('assert');
const SpeechTracker = require('../src/modules/speech-tracker.js');
const ScrollerEngine = require('../src/modules/scroller.js');

function testSpeechTracker() {
  console.log('Testing SpeechTracker...');

  const tokens = SpeechTracker.tokenize("Hello, World! Welcome to GhostPrompter.");
  assert.deepStrictEqual(tokens, ['hello', 'world', 'welcome', 'to', 'ghostprompter']);

  SpeechTracker.setScript("Welcome to GhostPrompter. The world's most lightweight eye-tracking teleprompter.");
  const res = SpeechTracker.matchTranscript("welcome to ghostprompter");
  assert.strictEqual(res.matched, true, 'Speech should match script tokens');
  assert(res.advancePixels >= 0, 'Advance pixels should be >= 0');
  console.log('✓ SpeechTracker tests passed.');
}

function testScrollerEngine() {
  console.log('Testing ScrollerEngine...');

  ScrollerEngine.setWpm(120);
  ScrollerEngine.setMode('dual');

  // When paused: velocity should be 0
  assert.strictEqual(ScrollerEngine.calculateVelocity(), 0, 'Velocity should be 0 when paused');

  // When playing with neutral gaze:
  // Fake playing state
  ScrollerEngine.resume();
  ScrollerEngine.updateGaze('middle');
  const midVel = ScrollerEngine.calculateVelocity();
  assert(midVel > 0, 'Mid gaze velocity should be positive');

  // Lower gaze: should be faster
  ScrollerEngine.updateGaze('lower');
  const lowVel = ScrollerEngine.calculateVelocity();
  assert(lowVel > midVel, `Lower gaze (${lowVel}) should be faster than mid (${midVel})`);

  // Away gaze: should drop to 0
  ScrollerEngine.updateGaze('away');
  const awayVel = ScrollerEngine.calculateVelocity();
  assert.strictEqual(awayVel, 0, 'Away gaze velocity should be 0 (holding spot)');

  // Top gaze: should be slower than mid
  ScrollerEngine.updateGaze('top');
  const topVel = ScrollerEngine.calculateVelocity();
  assert(topVel < midVel && topVel > 0, `Top gaze (${topVel}) should be slower than mid (${midVel})`);

  // Auto-scroll mode tests
  ScrollerEngine.resume();
  ScrollerEngine.setMode('auto');
  ScrollerEngine.setWpm(120);
  const autoVel120 = ScrollerEngine.calculateVelocity();
  assert(autoVel120 > 0, 'Auto scroll velocity should be positive');

  ScrollerEngine.setWpm(180);
  const autoVel180 = ScrollerEngine.calculateVelocity();
  assert(autoVel180 > autoVel120, 'Higher WPM should produce higher velocity');

  // In auto mode, gaze shouldn't alter velocity
  ScrollerEngine.updateGaze('away');
  assert.strictEqual(ScrollerEngine.calculateVelocity(), autoVel180, 'Auto mode velocity should remain steady regardless of gaze away');

  ScrollerEngine.pause();
  assert.strictEqual(ScrollerEngine.calculateVelocity(), 0, 'Auto mode paused should be 0');

  console.log('✓ ScrollerEngine tests passed.');
}

try {
  testSpeechTracker();
  testScrollerEngine();
  console.log('✅ All Speech and Scroller tests passed successfully!');
} catch (e) {
  console.error('❌ Test failed:', e);
  process.exit(1);
}
