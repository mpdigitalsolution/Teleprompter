/**
 * GhostPrompter Desktop — Unit Tests for WindowManager
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const StorageService = require('../src/main/services/storage-service');
const WindowManager = require('../src/main/windows/window-manager');

function testWindowManager() {
  console.log('Testing Desktop WindowManager...');

  const tempStore = path.join(__dirname, 'temp_wm_test.json');
  if (fs.existsSync(tempStore)) fs.unlinkSync(tempStore);

  const storage = new StorageService(tempStore);
  const wm = new WindowManager(storage);

  // Mock window send methods
  let prompterSent = [];
  let studioSent = [];
  wm.prompter.send = (ch, data) => prompterSent.push({ ch, data });
  wm.studio.send = (ch, data) => studioSent.push({ ch, data });

  // 1. Initial State
  assert.strictEqual(wm.state.isGhost, false);
  assert.strictEqual(wm.state.isCompact, false);
  assert.strictEqual(wm.state.speed, 160);
  assert.strictEqual(wm.state.opacity, 0.85);
  console.log('✓ Initial window manager state verified.');

  // 2. Toggle Ghost Mode
  const ghost1 = wm.toggleGhostMode();
  assert.strictEqual(ghost1, true);
  assert.strictEqual(wm.state.isGhost, true);
  assert.strictEqual(storage.getSetting('ghostMode'), true);

  const ghost2 = wm.toggleGhostMode();
  assert.strictEqual(ghost2, false);
  assert.strictEqual(wm.state.isGhost, false);
  assert.strictEqual(storage.getSetting('ghostMode'), false);
  console.log('✓ Ghost mode click-through toggle passed.');

  // 3. Toggle Compact Mode (Dynamic Island)
  const compact1 = wm.toggleCompactMode();
  assert.strictEqual(compact1, true);
  assert.strictEqual(wm.state.isCompact, true);
  assert.strictEqual(storage.getSetting('compactMode'), true);

  const compact2 = wm.toggleCompactMode();
  assert.strictEqual(compact2, false);
  assert.strictEqual(wm.state.isCompact, false);
  console.log('✓ Compact Dynamic Island toggle passed.');

  // 4. Cycle Opacity
  const initialOpacity = wm.state.opacity;
  const nextPreset = wm.cycleOpacity();
  assert.notStrictEqual(nextPreset.val, initialOpacity);
  assert.strictEqual(wm.state.opacity, nextPreset.val);
  assert.strictEqual(storage.getSetting('opacity'), nextPreset.val);
  console.log('✓ Opacity preset cycling passed.');

  // 5. Broadcast to All Windows
  prompterSent = [];
  studioSent = [];
  wm.broadcast('test:channel', { payload: 42 });
  assert.strictEqual(prompterSent.length, 1);
  assert.strictEqual(studioSent.length, 1);
  assert.strictEqual(prompterSent[0].ch, 'test:channel');
  assert.strictEqual(prompterSent[0].data.payload, 42);
  console.log('✓ Multi-window event broadcasting passed.');

  // Cleanup
  if (fs.existsSync(tempStore)) fs.unlinkSync(tempStore);

  console.log('✅ All Desktop WindowManager unit tests passed successfully!\n');
}

testWindowManager();
