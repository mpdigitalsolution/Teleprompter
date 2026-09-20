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
  assert.strictEqual(mgr.currentTextColor, '#00F0FF', 'Default text color should be cyan');
  assert.strictEqual(mgr.currentTrackingMode, 'auto', 'Default tracking mode should be auto');
  assert.strictEqual(mgr.currentOpacity, 0.94, 'Default opacity should be 0.94');
  assert.strictEqual(mgr.isGhostMode, false, 'Default ghost mode should be false');
  assert.strictEqual(mgr.isToolbarCollapsed, true, 'Default toolbar should be collapsed');
  console.log('✓ Instance initialization & defaults passed.');

  // 3. Test styles generation
  const css = mgr.getPiPStyles();
  assert(css.includes('.pip-prompter'), 'Should contain container styles');
  assert(css.includes('.pip-focus-line'), 'Should contain focus bar styles');
  assert(css.includes('.pip-transparent'), 'Should contain transparency rules');
  assert(css.includes('--pip-scale'), 'Should contain elastic scaling variable');
  assert(css.includes('border: none !important'), 'Should contain borderless styling');
  assert(css.includes('.pip-btn-rec'), 'Should contain record button styles');
  assert(css.includes('.pip-recording'), 'Should contain recording pulse styles');
  assert(css.includes('.pip-choice-card'), 'Should contain choice modal card styles');
  assert(css.includes('.pip-toolbar'), 'Should contain collapsible toolbar styles');
  assert(css.includes('.pip-toolbar-collapsed'), 'Should contain collapsed toolbar state');
  assert(css.includes('.pip-preset-btn'), 'Should contain opacity preset button styles');
  assert(css.includes('.pip-range'), 'Should contain slider range styles');
  assert(css.includes('.pip-ghost-pill'), 'Should contain ghost mode pill styles');
  assert(css.includes('.pip-btn-ghost-toggle'), 'Should contain ghost toggle button styles');
  assert(css.includes('.pip-btn-controls'), 'Should contain controls toggle button styles');
  console.log('✓ Dynamic CSS stylesheet & elastic borderless styling generation passed.');

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
  mgr.currentTextColor = '#FFEA00';
  mgr.currentTrackingMode = 'gaze';
  mgr.currentOpacity = 0.35;
  mgr.handlePiPClose();

  assert(closeResult !== null, 'onCloseCallback should be invoked');
  assert.strictEqual(closeResult.wpm, 170);
  assert.strictEqual(closeResult.fontSize, 28);
  assert.strictEqual(closeResult.isTransparent, true);
  assert.strictEqual(closeResult.textColor, '#FFEA00', 'Should return textColor');
  assert.strictEqual(closeResult.trackingMode, 'gaze', 'Should return trackingMode');
  assert.strictEqual(closeResult.opacity, 0.35, 'Should return opacity');
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

  // 7. Test recording state updater in PiP window
  let addedClass = false;
  let removedClass = false;
  const mockRecBtn = {
    classList: {
      add: (c) => { if (c === 'pip-recording') addedClass = true; },
      remove: (c) => { if (c === 'pip-recording') removedClass = true; }
    },
    title: ''
  };
  const mockRecIcon = { textContent: '' };
  const mockRecLabel = { textContent: '' };
  mgr.activePiPWindow = {
    closed: false,
    document: {
      getElementById: (id) => {
        if (id === 'pip-btn-rec') return mockRecBtn;
        if (id === 'pip-rec-icon') return mockRecIcon;
        if (id === 'pip-rec-label') return mockRecLabel;
        return null;
      }
    }
  };

  mgr.updateRecordingState(true, '00:15');
  assert.strictEqual(mgr.isRecording, true);
  assert.strictEqual(addedClass, true);
  assert.strictEqual(mockRecIcon.textContent, '⏹');
  assert.strictEqual(mockRecLabel.textContent, ' 00:15');

  mgr.updateRecordingState(false);
  assert.strictEqual(mgr.isRecording, false);
  assert.strictEqual(removedClass, true);
  assert.strictEqual(mockRecIcon.textContent, '🔴');
  assert.strictEqual(mockRecLabel.textContent, 'Rec');
  console.log('✓ Recording status UI synchronization in PiP passed.');

  console.log('✅ All PiPPrompterManager unit tests passed successfully!');
}

testPiPPrompter();
