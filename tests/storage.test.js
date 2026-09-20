const assert = require('assert');
const { GhostStorage, DEFAULT_SCRIPTS, DEFAULT_SETTINGS } = require('../src/modules/storage.js');

async function testStorage() {
  console.log('Testing GhostStorage...');

  // 1. Check default scripts
  assert(Array.isArray(DEFAULT_SCRIPTS) && DEFAULT_SCRIPTS.length > 0, 'Default scripts should exist');
  assert(DEFAULT_SETTINGS.opacity > 0, 'Default opacity should be > 0');

  // 2. Settings test
  const settings = await GhostStorage.getSettings();
  assert.strictEqual(typeof settings.fontSize, 'number', 'Font size should be a number');
  assert.strictEqual(typeof settings.opacity, 'number', 'Opacity should be a number');

  // 3. Save settings test
  const updatedSettings = await GhostStorage.saveSettings({ fontSize: 28, opacity: 0.85 });
  assert.strictEqual(updatedSettings.fontSize, 28, 'Font size should update to 28');
  assert.strictEqual(updatedSettings.opacity, 0.85, 'Opacity should update to 0.85');

  // 4. Create script test
  const testScript = await GhostStorage.createScript('My Test Script', 'Hello world teleprompter test.');
  assert(testScript.id, 'New script should have an ID');
  assert.strictEqual(testScript.title, 'My Test Script');

  // 5. Active script test
  const activeScript = await GhostStorage.getActiveScript();
  assert.strictEqual(activeScript.id, testScript.id, 'Active script should match newly created script');

  // 6. Delete script test
  await GhostStorage.deleteScript(testScript.id);
  const remainingScripts = await GhostStorage.getScripts();
  assert(!remainingScripts.find(s => s.id === testScript.id), 'Deleted script should no longer exist');

  console.log('✅ All GhostStorage unit tests passed successfully!');
}

testStorage().catch(err => {
  console.error('❌ Storage test failed:', err);
  process.exit(1);
});
