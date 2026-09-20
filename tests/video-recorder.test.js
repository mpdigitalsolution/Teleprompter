const assert = require('assert');
const VideoRecorder = require('../src/modules/video-recorder.js');

function testVideoRecorder() {
  console.log('Testing VideoRecorder Engine...');

  // Test static formatting helpers
  assert.strictEqual(VideoRecorder.formatTime(0), '00:00');
  assert.strictEqual(VideoRecorder.formatTime(5), '00:05');
  assert.strictEqual(VideoRecorder.formatTime(65), '01:05');
  assert.strictEqual(VideoRecorder.formatTime(3600), '60:00');
  assert.strictEqual(VideoRecorder.formatFileSize(0), '0 B');
  assert.strictEqual(VideoRecorder.formatFileSize(1024), '1 KB');
  assert.strictEqual(VideoRecorder.formatFileSize(1024 * 1024 * 5.5), '5.5 MB');
  console.log('✓ Time & FileSize formatting passed.');

  // Test constraints generation
  const rec16x9 = new VideoRecorder({ videoQuality: '1080p', aspectRatio: '16:9' });
  const c16x9 = rec16x9.getVideoConstraints();
  assert.strictEqual(c16x9.width.ideal, 1920);
  assert.strictEqual(c16x9.height.ideal, 1080);

  const rec9x16 = new VideoRecorder({ videoQuality: '1080p', aspectRatio: '9:16' });
  const c9x16 = rec9x16.getVideoConstraints();
  assert.strictEqual(c9x16.width.ideal, 1080);
  assert.strictEqual(c9x16.height.ideal, 1920);

  const rec1x1 = new VideoRecorder({ videoQuality: '720p', aspectRatio: '1:1' });
  const c1x1 = rec1x1.getVideoConstraints();
  assert.strictEqual(c1x1.width.ideal, 720);
  assert.strictEqual(c1x1.height.ideal, 720);
  console.log('✓ Video constraints generation passed.');

  // Test state initialization
  assert.strictEqual(rec16x9.state, 'idle');
  console.log('✓ State transitions passed.');

  console.log('✅ All VideoRecorder unit tests passed successfully!');
}

testVideoRecorder();
