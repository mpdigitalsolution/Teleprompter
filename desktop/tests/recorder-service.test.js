/**
 * GhostPrompter Desktop — Unit Tests for RecorderService
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const RecorderService = require('../src/main/services/recorder-service');
const StorageService = require('../src/main/services/storage-service');

async function testRecorderService() {
  console.log('Testing Desktop RecorderService...');

  const tempStorePath = path.join(__dirname, 'temp_test_recorder_store.json');
  if (fs.existsSync(tempStorePath)) {
    fs.unlinkSync(tempStorePath);
  }

  const storage = new StorageService(tempStorePath);
  const recorder = new RecorderService(storage);

  // 1. Initial State
  assert.strictEqual(recorder.activeSession, null);
  console.log('✓ Initial recorder state verified.');

  // 2. Start Session (mock app.getPath('temp') via os.tmpdir())
  const sessionRes = await recorder.startSession('test_run_123');
  assert.strictEqual(sessionRes.success, true);
  assert.ok(sessionRes.tempPath, 'tempPath must be returned');
  assert.ok(fs.existsSync(sessionRes.tempPath), 'Temp file should be created on disk');
  console.log('✓ Recording session started and temp file created on disk.');

  // 3. Append streaming chunks
  const chunk1 = Buffer.from('RIFF_MOCK_WEBM_CHUNK_PART_1');
  const chunk2 = Buffer.from('MOCK_WEBM_CHUNK_PART_2');
  const append1 = recorder.appendChunk(chunk1);
  const append2 = recorder.appendChunk(chunk2);
  assert.strictEqual(append1, true);
  assert.strictEqual(append2, true);
  assert.strictEqual(recorder.activeSession.totalBytes, chunk1.length + chunk2.length);
  console.log('✓ Real-time disk-streaming chunk appending passed.');

  // 4. Finish Session
  const finishRes = await recorder.finishSession();
  assert.strictEqual(finishRes.success, true);
  assert.strictEqual(finishRes.size, chunk1.length + chunk2.length);
  assert.strictEqual(recorder.activeSession, null);
  assert.ok(fs.existsSync(finishRes.tempPath));
  console.log('✓ Recording session finish & stream closure passed.');

  // 5. Save Take in Storage
  const takeData = {
    id: 'take_test_1',
    filePath: finishRes.tempPath,
    duration: finishRes.duration,
    size: finishRes.size,
    createdAt: new Date().toISOString()
  };
  const saveRes = storage.saveTake(takeData);
  assert.strictEqual(saveRes.id, 'take_test_1');
  const savedTakes = storage.getTakes();
  assert.strictEqual(savedTakes.length, 1);
  assert.strictEqual(savedTakes[0].id, 'take_test_1');
  console.log('✓ Take metadata persisted to storage passed.');

  // 6. Discard Session
  const discardRes = recorder.discardSession(finishRes.tempPath);
  assert.strictEqual(discardRes.success, true);
  assert.strictEqual(fs.existsSync(finishRes.tempPath), false, 'Temp file should be deleted');
  console.log('✓ Discard session & temp file cleanup passed.');

  // Cleanup
  if (fs.existsSync(tempStorePath)) {
    fs.unlinkSync(tempStorePath);
  }

  console.log('✅ All Desktop RecorderService unit tests passed successfully!\n');
}

testRecorderService().catch(err => {
  console.error('❌ RecorderService test failed:', err);
  process.exit(1);
});
