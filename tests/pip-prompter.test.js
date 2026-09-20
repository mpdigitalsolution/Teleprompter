const assert = require('assert');
const { PiPPrompterManager } = require('../src/modules/pip-prompter.js');

async function testPiPPrompter() {
  console.log('Testing PiPPrompterManager Engine...');

  // 1. Test isSupported in standard Node environment (should be false)
  assert.strictEqual(PiPPrompterManager.isSupported(), false);
  console.log('✓ Environment feature detection passed.');

  // 2. Test manager instance initialization
  const mgr = new PiPPrompterManager();
  assert.strictEqual(mgr.currentWpm, 130);
  assert.strictEqual(mgr.currentFontSize, 24);
  assert.strictEqual(mgr.isTransparent, false);
  assert.strictEqual(mgr.isScrolling, false);
  assert.strictEqual(mgr.activePiPWindow, null);
  console.log('✓ Instance initialization & defaults passed.');

  // 3. Test styles generation
  const css = mgr.getPiPStyles();
  assert(css.includes('.pip-prompter'), 'Should contain container styles');
  assert(css.includes('.pip-focus-line'), 'Should contain focus bar styles');
  assert(css.includes('.pip-transparent'), 'Should contain transparency rules');
  console.log('✓ Dynamic CSS stylesheet generation passed.');

  // 4. Test scrolling state toggle
  const mockBtn = { classList: { toggle: (cls, val) => {} } };
  const mockIcon = { textContent: '' };
  const mockLabel = { textContent: '' };

  mgr.setScrolling(true, mockBtn, mockIcon, mockLabel);
  assert.strictEqual(mgr.isScrolling, true);
  assert.strictEqual(mockIcon.textContent, '⏸');
  assert.strictEqual(mockLabel.textContent, 'Pause');

  mgr.setScrolling(false, mockBtn, mockIcon, mockLabel);
  assert.strictEqual(mgr.isScrolling, false);
  assert.strictEqual(mockIcon.textContent, '▶');
  assert.strictEqual(mockLabel.textContent, 'Play');
  console.log('✓ Auto-scroll state & button feedback passed.');

  // 5. Test close callback and state extraction
  let closeResult = null;
  mgr.onCloseCallback = (res) => {
    closeResult = res;
  };
  mgr.currentWpm = 170;
  mgr.currentFontSize = 28;
  mgr.isTransparent = true;
  mgr.handlePiPClose();

  assert(closeResult !== null, 'onCloseCallback should be invoked');
  assert.strictEqual(closeResult.wpm, 170);
  assert.strictEqual(closeResult.fontSize, 28);
  assert.strictEqual(closeResult.isTransparent, true);
  console.log('✓ PiP window close and state sync passed.');

  // 6. Test fallback mechanism when PiP API is unavailable
  let fallbackInvoked = false;
  mgr.openFallbackWindow = () => {
    fallbackInvoked = true;
  };
  const win = await mgr.openPiP();
  assert.strictEqual(win, null);
  assert.strictEqual(fallbackInvoked, true);
  console.log('✓ Fallback to standalone floating window passed.');

  console.log('✅ All PiPPrompterManager unit tests passed successfully!');
}

testPiPPrompter();
