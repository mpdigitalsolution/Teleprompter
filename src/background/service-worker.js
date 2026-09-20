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

  isOffscreenCreating = chrome.offscreen.createDocument({
    url: OFFSCREEN_PATH,
    reasons: ['USER_MEDIA'],
    justification: 'Capture webcam stream for low-resource eye gaze and speech sync tracking'
  });

  await isOffscreenCreating;
  isOffscreenCreating = null;
  console.log('GhostPrompter offscreen document created.');
}

async function hasOffscreenDocument() {
  if ('getContexts' in chrome.runtime) {
    const contexts = await chrome.runtime.getContexts({
      contextTypes: ['OFFSCREEN_DOCUMENT'],
      documentUrls: [chrome.runtime.getURL(OFFSCREEN_PATH)]
    });
    return contexts.length > 0;
  } else {
    // Fallback for earlier Chrome versions
    const matched = await chrome.extension.getViews({ type: 'tab' });
    return matched.some(v => v.location.pathname.includes('offscreen.html'));
  }
}

async function closeOffscreenDocument() {
  if (await hasOffscreenDocument()) {
    await chrome.offscreen.closeDocument();
    console.log('GhostPrompter offscreen document closed.');
  }
}

/**
 * Helper to dispatch message to the active browser tab
 */
async function sendToActiveTab(message) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.id) return;

  try {
    return await chrome.tabs.sendMessage(tab.id, message);
  } catch (err) {
    // Content script might not be injected yet (e.g. on newly opened tab)
    if (chrome.scripting) {
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['src/content/content-script.js']
        });
        return await chrome.tabs.sendMessage(tab.id, message);
      } catch (e) {
        console.warn('Could not inject content script:', e);
      }
    }
  }
}

/**
 * Global Keyboard Shortcut Listeners
 */
chrome.commands.onCommand.addListener(async (command) => {
  switch (command) {
    case 'toggle-prompter':
      await sendToActiveTab({ type: 'TOGGLE_PROMPTER' });
      break;

    case 'toggle-ghost-mode':
      await sendToActiveTab({ type: 'TOGGLE_GHOST_MODE' });
      break;

    case 'toggle-pause':
      await sendToActiveTab({ type: 'TOGGLE_PAUSE' });
      break;
  }
});

/**
 * Message Broker
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || !message.type) return;

  // 1. Content Script notifies HUD opened -> start offscreen tracking
  if (message.type === 'HUD_OPENED') {
    setupOffscreenDocument().then(() => {
      chrome.runtime.sendMessage({
        target: 'offscreen',
        type: 'START_TRACKING',
        trackingMode: message.trackingMode || 'dual'
      });
    });
    sendResponse({ status: 'starting_tracker' });
    return true;
  }

  // 2. Offscreen sends gaze or speech update -> forward to active tab
  if (message.target === 'content') {
    sendToActiveTab(message);
    return;
  }

  // 3. Mode or configuration changes
  if (message.type === 'SET_TRACKING_MODE') {
    chrome.runtime.sendMessage({
      target: 'offscreen',
      type: 'SET_TRACKING_MODE',
      mode: message.mode
    });
    sendResponse({ status: 'mode_updated' });
    return;
  }

  // 4. Popup queries status
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
