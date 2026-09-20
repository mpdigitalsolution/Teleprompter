/**
 * GhostPrompter Extension Popup Controller
 */

document.addEventListener('DOMContentLoaded', async () => {
  const toggleBtn = document.getElementById('popup-btn-toggle');
  const scriptSelect = document.getElementById('popup-select-script');
  const modeSelect = document.getElementById('popup-select-mode');
  const opacityRange = document.getElementById('popup-range-opacity');
  const fontRange = document.getElementById('popup-range-font');
  const wpmRange = document.getElementById('popup-range-wpm');
  const setupLink = document.getElementById('link-setup');
  const testLink = document.getElementById('link-mock-test');
  const statusPill = document.getElementById('popup-status');

  // Load storage
  if (window.StorageManager) {
    const settings = await window.StorageManager.getSettings();
    const scripts = await window.StorageManager.getScripts();
    const activeScriptId = await window.StorageManager.getActiveScriptId();

    // Populate scripts
    scriptSelect.innerHTML = scripts.map(s => 
      `<option value="${s.id}" ${s.id === activeScriptId ? 'selected' : ''}>${s.title}</option>`
    ).join('');

    // Set initial values
    modeSelect.value = settings.trackingMode || 'dual';
    opacityRange.value = settings.opacity !== undefined ? settings.opacity : 0.78;
    fontRange.value = settings.fontSize || 22;
    wpmRange.value = settings.wpm || 130;

    // Listeners
    scriptSelect.addEventListener('change', async (e) => {
      await window.StorageManager.setActiveScript(e.target.value);
      sendToActiveTab({ type: 'SCRIPT_CHANGED', scriptId: e.target.value });
    });

    modeSelect.addEventListener('change', async (e) => {
      await window.StorageManager.saveSettings({ trackingMode: e.target.value });
      chrome.runtime.sendMessage({ type: 'SET_TRACKING_MODE', mode: e.target.value });
    });

    opacityRange.addEventListener('input', async (e) => {
      await window.StorageManager.saveSettings({ opacity: parseFloat(e.target.value) });
    });

    fontRange.addEventListener('input', async (e) => {
      await window.StorageManager.saveSettings({ fontSize: parseInt(e.target.value, 10) });
    });

    wpmRange.addEventListener('input', async (e) => {
      await window.StorageManager.saveSettings({ wpm: parseInt(e.target.value, 10) });
    });
  }

  // Toggle HUD button
  toggleBtn.addEventListener('click', async () => {
    sendToActiveTab({ type: 'TOGGLE_PROMPTER' });
    window.close();
  });

  // Links
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

function sendToActiveTab(msg) {
  if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.query) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0] && tabs[0].id) {
        chrome.tabs.sendMessage(tabs[0].id, msg);
      }
    });
  }
}
