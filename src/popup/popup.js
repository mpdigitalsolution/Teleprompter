/**
 * GhostPrompter Extension Popup Controller
 * Manages rapid HUD launch, auto-scroll initiation, transparency presets, and speed control.
 */

document.addEventListener('DOMContentLoaded', async () => {
  const toggleBtn = document.getElementById('popup-btn-toggle');
  const autoscrollBtn = document.getElementById('popup-btn-autoscroll');
  const scriptSelect = document.getElementById('popup-select-script');
  const modeSelect = document.getElementById('popup-select-mode');
  const opacityRange = document.getElementById('popup-range-opacity');
  const fontRange = document.getElementById('popup-range-font');
  const wpmRange = document.getElementById('popup-range-wpm');
  const wpmVal = document.getElementById('pop-val-wpm');
  const wpmDecBtn = document.getElementById('pop-btn-wpm-dec');
  const wpmIncBtn = document.getElementById('pop-btn-wpm-inc');
  const setupLink = document.getElementById('link-setup');
  const testLink = document.getElementById('link-mock-test');
  const studioLink = document.getElementById('link-studio');
  const studioBtn = document.getElementById('popup-btn-studio');
  const recordBtn = document.getElementById('popup-btn-record');
  const statusPill = document.getElementById('popup-status');

  const presetBtns = {
    solid: document.getElementById('pop-preset-solid'),
    dark: document.getElementById('pop-preset-dark'),
    glass: document.getElementById('pop-preset-glass'),
    clear: document.getElementById('pop-preset-clear')
  };

  const Storage = window.GhostStorage;
  let currentSettings = {};

  if (Storage) {
    currentSettings = await Storage.getSettings();
    const scripts = await Storage.getScripts();
    const activeScriptId = await Storage.getActiveScriptId();

    // Populate script list
    scriptSelect.innerHTML = scripts.map(s => 
      `<option value="${s.id}" ${s.id === activeScriptId ? 'selected' : ''}>${s.title}</option>`
    ).join('');

    // Set initial values
    modeSelect.value = currentSettings.trackingMode || 'auto';
    const initialOpacity = currentSettings.opacity !== undefined ? currentSettings.opacity : 0.94;
    opacityRange.value = initialOpacity;
    fontRange.value = currentSettings.fontSize || 24;
    
    const initialWpm = currentSettings.wpm || 130;
    wpmRange.value = initialWpm;
    if (wpmVal) wpmVal.textContent = `${initialWpm} WPM`;

    updatePresetUI(initialOpacity, currentSettings.isTransparentMode);

    // Event: Script Change
    scriptSelect.addEventListener('change', async (e) => {
      await Storage.setActiveScript(e.target.value);
      notifyActiveTab({ type: 'SCRIPT_CHANGED', scriptId: e.target.value });
    });

    // Event: Mode Change
    modeSelect.addEventListener('change', async (e) => {
      await Storage.saveSettings({ trackingMode: e.target.value });
      notifyActiveTab({ type: 'SET_TRACKING_MODE', mode: e.target.value });
      chrome.runtime.sendMessage({ type: 'SET_TRACKING_MODE', mode: e.target.value });
    });

    // Event: Opacity Range
    opacityRange.addEventListener('input', async (e) => {
      const val = parseFloat(e.target.value);
      const isTrans = val < 0.65;
      await Storage.saveSettings({ opacity: val, isTransparentMode: isTrans });
      updatePresetUI(val, isTrans);
      notifyActiveTab({ type: 'SET_TRANSPARENCY_MODE', opacity: val });
    });

    // Event: Font Size
    fontRange.addEventListener('input', async (e) => {
      const size = parseInt(e.target.value, 10);
      await Storage.saveSettings({ fontSize: size });
      notifyActiveTab({ type: 'SET_FONT_SIZE', fontSize: size });
    });

    // Event: WPM Slider
    wpmRange.addEventListener('input', async (e) => {
      const wpm = parseInt(e.target.value, 10);
      if (wpmVal) wpmVal.textContent = `${wpm} WPM`;
      await Storage.saveSettings({ wpm });
      notifyActiveTab({ type: 'SET_WPM', wpm });
    });

    // Event: WPM Step Buttons
    if (wpmDecBtn) {
      wpmDecBtn.addEventListener('click', async () => {
        const wpm = Math.max(50, (parseInt(wpmRange.value, 10) || 130) - 10);
        wpmRange.value = wpm;
        if (wpmVal) wpmVal.textContent = `${wpm} WPM`;
        await Storage.saveSettings({ wpm });
        notifyActiveTab({ type: 'SET_WPM', wpm });
      });
    }

    if (wpmIncBtn) {
      wpmIncBtn.addEventListener('click', async () => {
        const wpm = Math.min(300, (parseInt(wpmRange.value, 10) || 130) + 10);
        wpmRange.value = wpm;
        if (wpmVal) wpmVal.textContent = `${wpm} WPM`;
        await Storage.saveSettings({ wpm });
        notifyActiveTab({ type: 'SET_WPM', wpm });
      });
    }

    // Event: Transparency Presets
    Object.entries(presetBtns).forEach(([preset, btn]) => {
      if (!btn) return;
      btn.addEventListener('click', async () => {
        let op = 0.95;
        let isTrans = false;
        if (preset === 'solid') { op = 0.95; isTrans = false; }
        else if (preset === 'dark') { op = 0.75; isTrans = false; }
        else if (preset === 'glass') { op = 0.35; isTrans = true; }
        else if (preset === 'clear') { op = 0.02; isTrans = true; }

        opacityRange.value = op;
        updatePresetUI(op, isTrans);
        await Storage.saveSettings({ opacity: op, isTransparentMode: isTrans, transparencyPreset: preset });
        notifyActiveTab({ type: 'SET_TRANSPARENCY_MODE', preset, opacity: op });
      });
    });
  }

  function updatePresetUI(op, isTrans) {
    Object.values(presetBtns).forEach(b => { if (b) b.classList.remove('active'); });
    if (op >= 0.85 && !isTrans) {
      if (presetBtns.solid) presetBtns.solid.classList.add('active');
    } else if (op >= 0.65 && op < 0.85) {
      if (presetBtns.dark) presetBtns.dark.classList.add('active');
    } else if (op >= 0.2 && op < 0.65) {
      if (presetBtns.glass) presetBtns.glass.classList.add('active');
    } else if (op < 0.2) {
      if (presetBtns.clear) presetBtns.clear.classList.add('active');
    }
  }

  // Toggle HUD button
  toggleBtn.addEventListener('click', () => {
    toggleBtn.disabled = true;
    toggleBtn.innerHTML = '<span>⏳</span> Launching...';

    chrome.runtime.sendMessage({ type: 'LAUNCH_PROMPTER_ON_ACTIVE_TAB' }, (res) => {
      if (chrome.runtime.lastError) {
        console.warn('Launch message notice:', chrome.runtime.lastError.message);
      }
      if (res && res.status === 'opened_test_page') {
        toggleBtn.innerHTML = '<span>🧪</span> Opened Test Tab!';
      } else {
        toggleBtn.innerHTML = '<span>✓</span> Prompter Active!';
      }
      setTimeout(() => { window.close(); }, 400);
    });
  });

  // Start Auto-Scroll button
  if (autoscrollBtn) {
    autoscrollBtn.addEventListener('click', () => {
      autoscrollBtn.disabled = true;
      autoscrollBtn.innerHTML = '<span>⏳</span> Starting...';

      chrome.runtime.sendMessage({ type: 'LAUNCH_PROMPTER_ON_ACTIVE_TAB' }, () => {
        setTimeout(() => {
          notifyActiveTab({ type: 'START_AUTO_SCROLL' });
          autoscrollBtn.innerHTML = '<span>▶</span> Auto-Scrolling!';
          setTimeout(() => { window.close(); }, 400);
        }, 150);
      });
    });
  }

  // Studio Mode button
  if (studioBtn) {
    studioBtn.addEventListener('click', () => {
      chrome.tabs.create({ url: chrome.runtime.getURL('src/studio/studio.html') });
      window.close();
    });
  }

  // Quick Record Button on active tab
  if (recordBtn) {
    recordBtn.addEventListener('click', () => {
      recordBtn.disabled = true;
      recordBtn.innerHTML = '<span>⏳</span> Starting...';

      chrome.runtime.sendMessage({ type: 'LAUNCH_PROMPTER_ON_ACTIVE_TAB' }, () => {
        setTimeout(() => {
          notifyActiveTab({ type: 'TOGGLE_RECORDING' });
          recordBtn.innerHTML = '<span>🔴</span> Recording...';
          setTimeout(() => { window.close(); }, 400);
        }, 150);
      });
    });
  }

  // Float Across Tabs & Windows (PiP)
  const pipBtn = document.getElementById('popup-btn-pip');
  if (pipBtn) {
    pipBtn.addEventListener('click', () => {
      pipBtn.innerHTML = '<span>⏳</span> Floating...';
      chrome.runtime.sendMessage({ type: 'LAUNCH_PROMPTER_ON_ACTIVE_TAB' }, () => {
        setTimeout(() => {
          notifyActiveTab({ type: 'OPEN_PIP' });
          setTimeout(() => { window.close(); }, 300);
        }, 150);
      });
    });
  }

  // Links
  const floatingLink = document.getElementById('link-floating');
  if (floatingLink) {
    floatingLink.addEventListener('click', () => {
      chrome.runtime.sendMessage({ type: 'OPEN_FLOATING_PROMPTER_WINDOW' });
      window.close();
    });
  }

  const allTabsLink = document.getElementById('link-all-tabs');
  if (allTabsLink) {
    allTabsLink.addEventListener('click', () => {
      allTabsLink.textContent = 'Launching... 🚀';
      chrome.runtime.sendMessage({ type: 'LAUNCH_PROMPTER_ON_ALL_TABS' }, (res) => {
        allTabsLink.textContent = `Launched on ${res && res.count ? res.count : 'All'} Tabs!`;
        setTimeout(() => { window.close(); }, 700);
      });
    });
  }

  if (studioLink) {
    studioLink.addEventListener('click', () => {
      chrome.tabs.create({ url: chrome.runtime.getURL('src/studio/studio.html') });
    });
  }

  setupLink.addEventListener('click', () => {
    if (chrome.runtime.openOptionsPage) {
      chrome.runtime.openOptionsPage();
    } else {
      chrome.tabs.create({ url: chrome.runtime.getURL('src/setup/setup.html') });
    }
  });

  testLink.addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('test-page.html') });
  });

  // Query background status
  try {
    chrome.runtime.sendMessage({ type: 'GET_STATUS' }, (res) => {
      if (res && res.offscreenActive) {
        statusPill.textContent = 'Active 👁️';
        statusPill.style.color = '#00F0FF';
      }
    });
  } catch (e) {}
});

function notifyActiveTab(msg) {
  if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.query) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs && tabs[0] && tabs[0].id) {
        chrome.tabs.sendMessage(tabs[0].id, msg).catch(() => {});
      }
    });
  }
}
