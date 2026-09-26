/**
 * GhostPrompter Desktop — Unit Tests for StorageService
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const StorageService = require('../src/main/services/storage-service');

function testStorageService() {
  console.log('Testing Desktop StorageService...');

  const tempStorePath = path.join(__dirname, 'temp_test_store.json');
  if (fs.existsSync(tempStorePath)) {
    fs.unlinkSync(tempStorePath);
  }

  // 1. Initialization and defaults
  const storage = new StorageService(tempStorePath);
  const data = storage.getAll();
  assert.ok(Array.isArray(data.scripts), 'Scripts must be an array');
  assert.ok(data.scripts.length >= 2, 'Default scripts should be loaded');
  assert.strictEqual(storage.getSetting('scrollSpeed'), 160);
  assert.strictEqual(storage.getSetting('opacity'), 0.85);
  assert.strictEqual(storage.getSetting('fontSize'), 28);
  assert.strictEqual(storage.getSetting('textColor'), '#FFFFFF');
  assert.strictEqual(storage.getSetting('textAlign'), 'left');
  console.log('✓ Storage initialization & defaults passed.');

  // 2. Save new script
  const newScript = storage.saveScript({
    title: 'Test Keynote Script',
    content: 'This is a test speech for automated verification.'
  });
  assert.ok(newScript.id, 'Script should have generated ID');
  assert.strictEqual(storage.get('activeScriptId'), newScript.id);
  assert.strictEqual(storage.getActiveScript().title, 'Test Keynote Script');
  console.log('✓ Save new script & active script selection passed.');

  // 3. Update existing script
  const updated = storage.saveScript({
    id: newScript.id,
    title: 'Updated Test Keynote Script',
    content: 'Updated content here.'
  });
  assert.strictEqual(updated.title, 'Updated Test Keynote Script');
  assert.strictEqual(storage.getActiveScript().title, 'Updated Test Keynote Script');
  console.log('✓ Script update passed.');

  // 4. Settings update
  storage.setSetting('scrollSpeed', 210);
  assert.strictEqual(storage.getSetting('scrollSpeed'), 210);
  storage.setSetting('ghostMode', true);
  assert.strictEqual(storage.getSetting('ghostMode'), true);
  storage.setSetting('fontSize', 36);
  assert.strictEqual(storage.getSetting('fontSize'), 36);
  storage.setSetting('textColor', '#FFE600');
  assert.strictEqual(storage.getSetting('textColor'), '#FFE600');
  storage.setSetting('textAlign', 'center');
  assert.strictEqual(storage.getSetting('textAlign'), 'center');
  console.log('✓ Settings updates passed.');

  // 5. Delete script
  const delRes = storage.deleteScript(newScript.id);
  assert.strictEqual(delRes.success, true);
  const remaining = storage.getScripts();
  assert.ok(!remaining.find(s => s.id === newScript.id), 'Deleted script should no longer exist');
  console.log('✓ Script deletion passed.');

  // 6. Takes management
  const take = storage.saveTake({
    id: 'take-123',
    name: 'Pitch Rehearsal 1',
    duration: 120,
    timestamp: new Date().toISOString()
  });
  assert.strictEqual(storage.getTakes().length, 1);
  storage.deleteTake('take-123');
  assert.strictEqual(storage.getTakes().length, 0);
  console.log('✓ Take storage passed.');

  // Cleanup
  if (fs.existsSync(tempStorePath)) {
    fs.unlinkSync(tempStorePath);
  }

  console.log('✅ All Desktop StorageService unit tests passed successfully!\n');
}

testStorageService();
