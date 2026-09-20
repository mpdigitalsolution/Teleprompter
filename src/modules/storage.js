/**
 * GhostPrompter Storage Module
 * Manages chrome.storage.local persistence with fallback to localStorage or in-memory store.
 */

const DEFAULT_SCRIPTS = [
  {
    id: 'script-default-1',
    title: 'Product Pitch & Intro',
    content: `Hi everyone, thank you so much for your time today.

I am thrilled to present GhostPrompter: the world's most lightweight, eye-tracking heads-up teleprompter designed for remote presentations and video calls.

When speaking on Zoom, Google Meet, or recording video demos, maintaining direct eye contact with the camera is vital for trust and engagement. But reading notes usually pulls your eyes downward or sideways.

GhostPrompter solves this completely. By placing a semi-transparent, borderless HUD directly underneath your webcam lens, your eyes never need to leave the audience.

Even better, our dual-tracking engine pairs real-time gaze detection with speech synchronization. As you finish reading each sentence, the prompter gently glides forward. If you pause or glance away, it holds your spot automatically.

Let us now walk through a quick live demonstration of the stealth controls, transparency sliders, and hotkey navigation.`,
    updatedAt: Date.now()
  },
  {
    id: 'script-default-2',
    title: 'Job Interview Story (STAR Method)',
    content: `Situation:
At my previous company, our team faced a critical bottleneck where our client-side video processing pipeline consumed too much CPU on budget laptops, causing video jitter during team calls.

Task:
I was tasked with optimizing the computer vision and rendering pipeline to drop CPU utilization below 10% without losing tracking responsiveness.

Action:
I decoupled the processing loop from the video capture frame rate, sub-sampled frame processing to 12 FPS using a lightweight WebAssembly pipeline, and transitioned DOM overlays to isolated Shadow DOM roots to prevent style recalculation storms.

Result:
We successfully reduced CPU usage by over 65%, eliminated frame drops across low-spec devices, and boosted customer satisfaction scores by 40% in our first post-launch survey.`,
    updatedAt: Date.now() - 3600000
  },
  {
    id: 'script-default-3',
    title: 'Short Meeting Kickoff',
    content: `Good morning everyone! Let's do a quick round of updates.

Agenda today:
1. Review yesterday's launch metrics and feedback.
2. Address open blockers on the core tracker engine.
3. Align on milestones for our upcoming release next Thursday.

Let's keep each update to two minutes so we have ample time for open discussion. Sarah, why don't you kick us off?`,
    updatedAt: Date.now() - 7200000
  }
];

const DEFAULT_SETTINGS = {
  opacity: 0.78,
  fontSize: 22,
  lineHeight: 1.6,
  textColor: '#00F0FF',
  backgroundColor: '#0A0C14',
  mirrorMode: false,
  ghostMode: false,
  scrollSpeed: 1.5,
  wpm: 130,
  trackingMode: 'dual', // 'dual' | 'gaze' | 'speech' | 'auto' | 'manual'
  gazeSensitivity: 1.2,
  speechSyncEnabled: true,
  gazeTrackingEnabled: true,
  autoHideControls: true,
  window: {
    x: null, // centered
    y: 24,
    width: 620,
    height: 250
  }
};

const _memoryStore = {};

const StorageManager = {
  isExtension() {
    return typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local;
  },

  hasLocalStorage() {
    return typeof localStorage !== 'undefined';
  },

  async get(keys) {
    if (this.isExtension()) {
      return new Promise((resolve) => {
        chrome.storage.local.get(keys, resolve);
      });
    } else if (this.hasLocalStorage()) {
      const result = {};
      const keyList = Array.isArray(keys) ? keys : typeof keys === 'string' ? [keys] : Object.keys(keys || {});
      keyList.forEach(k => {
        try {
          const val = localStorage.getItem(`ghostprompter_${k}`);
          if (val !== null) result[k] = JSON.parse(val);
        } catch (e) {
          console.warn('Storage read error:', e);
        }
      });
      return result;
    } else {
      const result = {};
      const keyList = Array.isArray(keys) ? keys : typeof keys === 'string' ? [keys] : Object.keys(keys || {});
      keyList.forEach(k => {
        if (_memoryStore[k] !== undefined) {
          result[k] = JSON.parse(JSON.stringify(_memoryStore[k]));
        }
      });
      return result;
    }
  },

  async set(items) {
    if (this.isExtension()) {
      return new Promise((resolve) => {
        chrome.storage.local.set(items, resolve);
      });
    } else if (this.hasLocalStorage()) {
      Object.entries(items).forEach(([k, v]) => {
        try {
          localStorage.setItem(`ghostprompter_${k}`, JSON.stringify(v));
        } catch (e) {
          console.warn('Storage write error:', e);
        }
      });
    } else {
      Object.entries(items).forEach(([k, v]) => {
        _memoryStore[k] = JSON.parse(JSON.stringify(v));
      });
    }
  },

  async getSettings() {
    const data = await this.get(['settings']);
    return { ...DEFAULT_SETTINGS, ...(data.settings || {}) };
  },

  async saveSettings(partialSettings) {
    const current = await this.getSettings();
    const updated = { ...current, ...partialSettings };
    await this.set({ settings: updated });
    return updated;
  },

  async getScripts() {
    const data = await this.get(['scripts']);
    if (!data.scripts || !Array.isArray(data.scripts) || data.scripts.length === 0) {
      await this.set({ scripts: DEFAULT_SCRIPTS, activeScriptId: DEFAULT_SCRIPTS[0].id });
      return DEFAULT_SCRIPTS;
    }
    return data.scripts;
  },

  async getActiveScriptId() {
    const data = await this.get(['activeScriptId']);
    return data.activeScriptId || DEFAULT_SCRIPTS[0].id;
  },

  async getActiveScript() {
    const scripts = await this.getScripts();
    const activeId = await this.getActiveScriptId();
    return scripts.find(s => s.id === activeId) || scripts[0] || DEFAULT_SCRIPTS[0];
  },

  async saveScript(script) {
    const scripts = await this.getScripts();
    const index = scripts.findIndex(s => s.id === script.id);
    const updatedScript = { ...script, updatedAt: Date.now() };
    
    if (index >= 0) {
      scripts[index] = updatedScript;
    } else {
      scripts.unshift(updatedScript);
    }
    
    await this.set({ scripts });
    return updatedScript;
  },

  async createScript(title = 'Untitled Script', content = '') {
    const newScript = {
      id: 'script_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
      title: title.trim() || 'Untitled Script',
      content: content,
      updatedAt: Date.now()
    };
    const scripts = await this.getScripts();
    scripts.unshift(newScript);
    await this.set({ scripts, activeScriptId: newScript.id });
    return newScript;
  },

  async deleteScript(id) {
    let scripts = await this.getScripts();
    scripts = scripts.filter(s => s.id !== id);
    if (scripts.length === 0) {
      scripts = [...DEFAULT_SCRIPTS];
    }
    const activeId = await this.getActiveScriptId();
    const nextActiveId = activeId === id ? scripts[0].id : activeId;
    await this.set({ scripts, activeScriptId: nextActiveId });
    return scripts;
  },

  async setActiveScript(id) {
    await this.set({ activeScriptId: id });
    return this.getActiveScript();
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { StorageManager, DEFAULT_SCRIPTS, DEFAULT_SETTINGS };
}
