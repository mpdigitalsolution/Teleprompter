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
  assert.strictEqual(rec16x9.sourceType, 'camera');
  rec16x9.setSourceType('screen');
  assert.strictEqual(rec16x9.sourceType, 'screen');
  rec16x9.setSourceType('camera');
  assert.strictEqual(rec16x9.sourceType, 'camera');
  console.log('✓ State transitions and sourceType switching passed.');

  // Test screen capture and audio mixing mock
  let displayMediaCalled = false;
  let userMediaCalled = false;
  let trackEndedListener = null;

  const mockVideoTrack = {
    kind: 'video',
    readyState: 'live',
    stop: () => {},
    addEventListener: (evt, cb) => {
      if (evt === 'ended') trackEndedListener = cb;
    }
  };
  const mockAudioTrack = {
    kind: 'audio',
    readyState: 'live',
    stop: () => {}
  };

  const mockDisplayStream = {
    getTracks: () => [mockVideoTrack],
    getVideoTracks: () => [mockVideoTrack],
    getAudioTracks: () => []
  };

  const mockMicStream = {
    getTracks: () => [mockAudioTrack],
    getAudioTracks: () => [mockAudioTrack]
  };

  global.MediaStream = class MockMediaStream {
    constructor(tracks = []) {
      this.tracks = tracks;
    }
    getTracks() { return this.tracks; }
    getVideoTracks() { return this.tracks.filter(t => t.kind === 'video'); }
    getAudioTracks() { return this.tracks.filter(t => t.kind === 'audio'); }
  };

  const mockMediaDevices = {
    getDisplayMedia: async (constraints) => {
      displayMediaCalled = true;
      assert.ok(constraints.video, 'getDisplayMedia must request video');
      return mockDisplayStream;
    },
    getUserMedia: async (constraints) => {
      userMediaCalled = true;
      assert.ok(constraints.audio, 'getUserMedia must request microphone audio');
      return mockMicStream;
    }
  };

  if (typeof navigator !== 'undefined') {
    Object.defineProperty(navigator, 'mediaDevices', {
      value: mockMediaDevices,
      configurable: true,
      writable: true
    });
  } else {
    global.navigator = { mediaDevices: mockMediaDevices };
  }

  const screenRec = new VideoRecorder({
    videoQuality: '1080p',
    sourceType: 'screen'
  });

  screenRec.startScreenCapture().then(async (stream) => {
    assert.strictEqual(displayMediaCalled, true, 'getDisplayMedia was called');
    assert.strictEqual(userMediaCalled, true, 'getUserMedia for mic audio was called');
    assert.ok(stream, 'Returned active media stream');
    assert.strictEqual(screenRec.sourceType, 'screen');
    assert.strictEqual(screenRec.state, 'idle');

    // Test stopCapture
    screenRec.stopCapture();
    assert.strictEqual(screenRec.mediaStream, null);
    assert.strictEqual(screenRec.micStream, null);
    assert.strictEqual(screenRec.displayStream, null);
    assert.strictEqual(screenRec.state, 'idle');
    // Test direct disk saving with directory handle
    let fileWritten = false;
    const mockWritable = {
      write: async () => { fileWritten = true; },
      close: async () => {}
    };
    const mockFileHandle = {
      createWritable: async () => mockWritable
    };
    const mockDirHandle = {
      name: 'facescreen recording',
      queryPermission: async () => 'granted',
      getFileHandle: async () => mockFileHandle
    };

    const mockBlob = { size: 1024, type: 'video/webm' };
    const saveRes = await VideoRecorder.saveVideoFile(mockBlob, 'test-rec.webm', mockDirHandle);
    assert.strictEqual(saveRes.success, true);
    assert.strictEqual(saveRes.method, 'direct_disk');
    assert.strictEqual(saveRes.directory, 'facescreen recording');
    // Test storage configuration retrieval and persistence
    const initialConfig = await VideoRecorder.getStorageConfig();
    assert.ok(initialConfig, 'Storage config returned');
    assert.strictEqual(typeof initialConfig.recordingStorageMode, 'string');

    await VideoRecorder.setStorageConfig({ recordingStorageMode: 'downloads' });
    const updatedConfig = await VideoRecorder.getStorageConfig();
    assert.strictEqual(updatedConfig.recordingStorageMode, 'downloads');

    // Test download fallback mode
    let downloadedBlob = null;
    let downloadedName = null;
    const origDownloadBlob = VideoRecorder.downloadBlob;
    VideoRecorder.downloadBlob = (b, name) => {
      downloadedBlob = b;
      downloadedName = name;
    };

    const dlRes = await VideoRecorder.saveVideoFile(mockBlob, 'test-download.webm');
    assert.strictEqual(dlRes.success, true);
    assert.strictEqual(dlRes.method, 'browser_download');
    assert.strictEqual(downloadedName, 'test-download.webm');
    VideoRecorder.downloadBlob = origDownloadBlob;

    // Reset mode to direct
    await VideoRecorder.setStorageConfig({ recordingStorageMode: 'direct' });

    console.log('✓ Storage options configuration and mode switching verified.');
    console.log('✅ All VideoRecorder unit tests passed successfully!');
  }).catch((err) => {
    console.error('Test failed:', err);
    process.exit(1);
  });
}

testVideoRecorder();

