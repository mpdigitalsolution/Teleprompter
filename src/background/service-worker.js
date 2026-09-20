/**
 * GhostPrompter Background Service Worker (Manifest V3)
 * Coordinates the offscreen tracking document, hotkey shortcuts, and message routing.
 */

const OFFSCREEN_PATH = 'src/offscreen/offscreen.html';
let isOffscreenCreating = null;

/**
 * Ensure the offscreen document is created for webcam/mic capture
 */
async function setupOffscreenDocument() {
  if (await hasOffscreenDocument()) {
    return;
  }

  if (isOffscreenCreating) {
    await isOffscreenCreating;
    return;
  }

  try {
    isOffscreenCreating = chrome.offscreen.createDocument({
      url: OFFSCREEN_PATH,
      reasons: ['USER_MEDIA'],
      justification: 'Capture webcam stream for low-resource eye gaze and speech sync tracking'
    });

    await isOffscreenCreating;
    console.log('GhostPrompter offscreen document created.');
  } catch (err) {
    console.warn('Could not create offscreen document (prompter will operate in manual mode):', err);
  } finally {
    isOffscreenCreating = null;
  }
}

async function hasOffscreenDocument() {
  if ('getContexts' in chrome.runtime) {
    try {
      const contexts = await chrome.runtime.getContexts({
        contextTypes: ['OFFSCREEN_DOCUMENT'],
        documentUrls: [chrome.runtime.getURL(OFFSCREEN_PATH)]
      });
      return contexts.length > 0;
    } catch (e) {
      return false;
    }
  } else {
    try {
      const matched = await chrome.extension.getViews({ type: 'tab' });
      return matched.some(v => v.location.pathname.includes('offscreen.html'));
    } catch (e) {
      return false;
    }
  }
}

async function closeOffscreenDocument() {
  if (await hasOffscreenDocument()) {
    try {
      await chrome.offscreen.closeDocument();
      console.log('GhostPrompter offscreen document closed.');
    } catch (e) {}
  }
}

/**
 * Launch or Toggle Prompter on a specific tab with automatic fallback
 */
async function togglePrompterOnTab(tabId, tabUrl) {
  // If user is on our own test-page, directly toggle it without reopening
  if (tabUrl && tabUrl.includes('test-page.html')) {
    try {
      await chrome.tabs.sendMessage(tabId, { type: 'TOGGLE_PROMPTER' });
      return { status: 'toggled' };
    } catch (e) {}
  }

  // If user is on an internal browser URL where scripting is prohibited, open test page
  const isRestrictedUrl = !tabUrl || 
    tabUrl.startsWith('chrome://') || 
    tabUrl.startsWith('edge://') || 
    tabUrl.startsWith('about:') || 
    (tabUrl.startsWith('chrome-extension://') && !tabUrl.includes(chrome.runtime.id));

  if (isRestrictedUrl) {
    const testPageUrl = chrome.runtime.getURL('test-page.html');
    await chrome.tabs.create({ url: testPageUrl });
    return { status: 'opened_test_page' };
  }

  // Try injecting content script if not already present
  if (chrome.scripting) {
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tabId },
        files: ['src/content/content-script.js']
      });
    } catch (e) {
      // Script might already be running or tab restricted
    }
  }

  // Send toggle message
  try {
    await chrome.tabs.sendMessage(tabId, { type: 'TOGGLE_PROMPTER' });
    return { status: 'toggled' };
  } catch (err) {
    // If connection failed on first attempt, reinject and retry once
    if (chrome.scripting) {
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tabId },
          files: ['src/content/content-script.js']
        });
        await chrome.tabs.sendMessage(tabId, { type: 'TOGGLE_PROMPTER' });
        return { status: 'toggled' };
      } catch (retryErr) {}
    }
    return { status: 'error', error: err.message };
  }
}

/**
 * Helper to dispatch message to the active browser tab
 */
async function sendToActiveTab(message) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.id) return;
  return togglePrompterOnTab(tab.id, tab.url);
}

/**
 * Global Keyboard Shortcut Listeners
 */
chrome.commands.onCommand.addListener(async (command) => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.id) return;

  switch (command) {
    case 'toggle-prompter':
      await togglePrompterOnTab(tab.id, tab.url);
      break;

    case 'toggle-ghost-mode':
      try {
        await chrome.tabs.sendMessage(tab.id, { type: 'TOGGLE_GHOST_MODE' });
      } catch (e) {}
      break;

    case 'toggle-pause':
      try {
        await chrome.tabs.sendMessage(tab.id, { type: 'TOGGLE_PAUSE' });
      } catch (e) {}
      break;
  }
});

/**
 * Message Broker
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || !message.type) return;

  // 1. Launch / Toggle prompter request from popup
  if (message.type === 'LAUNCH_PROMPTER_ON_ACTIVE_TAB') {
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      if (tabs && tabs[0]) {
        const res = await togglePrompterOnTab(tabs[0].id, tabs[0].url);
        sendResponse(res);
      } else {
        sendResponse({ status: 'no_active_tab' });
      }
    });
    return true; // Async response
  }

  // 2. Content Script notifies HUD opened -> optionally start offscreen tracking
  if (message.type === 'HUD_OPENED') {
    if (message.trackingMode === 'dual' || message.trackingMode === 'gaze' || message.trackingMode === 'speech') {
      setupOffscreenDocument().then(() => {
        chrome.runtime.sendMessage({
          target: 'offscreen',
          type: 'START_TRACKING',
          trackingMode: message.trackingMode
        });
      });
    }
    sendResponse({ status: 'ready' });
    return true;
  }

  // 3. Offscreen sends gaze or speech update -> forward to active tab
  if (message.target === 'content') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs && tabs[0] && tabs[0].id) {
        chrome.tabs.sendMessage(tabs[0].id, message).catch(() => {});
      }
    });
    return;
  }

  // 4. Mode or configuration changes
  if (message.type === 'SET_TRACKING_MODE') {
    if (message.mode === 'manual' || message.mode === 'auto') {
      closeOffscreenDocument();
    } else {
      setupOffscreenDocument().then(() => {
        chrome.runtime.sendMessage({
          target: 'offscreen',
          type: 'SET_TRACKING_MODE',
          mode: message.mode
        });
      });
    }
    sendResponse({ status: 'mode_updated' });
    return;
  }

  // 5. Popup queries status
  if (message.type === 'GET_STATUS') {
    hasOffscreenDocument().then(hasDoc => {
      sendResponse({
        offscreenActive: hasDoc
      });
    });
    return true;
  }
});

console.log('GhostPrompter service worker active.');
