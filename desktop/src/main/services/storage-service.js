/**
 * GhostPrompter Desktop — File-Backed Persistent Storage Service
 * Handles scripts, settings, and recording history with atomic writes and auto-recovery.
 */

const fs = require('fs');
const path = require('path');

const DEFAULT_SCRIPTS = [
  {
    id: 'script-welcome',
    title: '👋 Welcome to GhostPrompter Desktop',
    content: `Welcome to GhostPrompter Desktop! 

This prompter is designed to float seamlessly over your presentations, Zoom meetings, Google Meet, OBS Studio, and video recordings.

Key Features & Superpowers:
• True Ghost Mode: Press Ctrl+Shift+G to enable click-through. You can click your presentation slides right through the translucent text!
• Compact Dynamic Island: Press Ctrl+Shift+M to shrink into a slim camera pill that stays right by your webcam for 100% natural eye contact.
• Apple Frosted Glass: Smooth 60fps scrolling with Cupertino-grade design and minimal CPU usage.
• Global Shortcuts: Start/pause anywhere with Ctrl+Shift+Space, and speed up or slow down with Ctrl+Shift+Up/Down.

Enjoy presenting with confidence!`,
    updatedAt: new Date().toISOString()
  },
  {
    id: 'script-keynote',
    title: '💼 Executive Keynote & Pitch',
    content: `Good morning everyone, and thank you for joining us today.

Today, we are thrilled to unveil our breakthrough product that redefines productivity and communication.

Over the past twelve months, our team has focused on three pillars:
First, unmatched performance on every machine.
Second, an interface that feels calm, focused, and intuitive.
And third, seamless integration into your existing daily workflow.

Let us dive right into the live demonstration.`,
    updatedAt: new Date().toISOString()
  }
];

const DEFAULT_SETTINGS = {
  scrollSpeed: 160,       // Words per minute
  fontSize: 28,           // Base px font size
  textColor: '#FFFFFF',   // Teleprompter text color
  textAlign: 'left',      // left, center, right
  opacity: 0.85,          // 0.10 to 0.95
  opacityPreset: 'dark',  // solid, dark, glass, clear
  focusLineVisible: true, // Collapsible Apple focus reading guide
  mirrorMode: false,      // Mirrored hardware glass teleprompter mode
  ghostMode: false,       // Click-through pass-through mode
  compactMode: false,     // Dynamic island camera pill mode
  aspectRatio: '16:9',    // 16:9, 9:16, 1:1
  videoQuality: '1080p',  // 1080p, 720p
  trackingMode: 'speech', // speech, gaze, manual
  windowBounds: {
    prompter: { width: 560, height: 380, x: null, y: null },
    studio: { width: 1040, height: 720, x: null, y: null }
  }
};

class StorageService {
  constructor(customFilePath = null) {
    this.filePath = customFilePath || this._resolveDefaultPath();
    this.data = this._loadData();
  }

  _resolveDefaultPath() {
    let baseDir;
    try {
      const { app } = require('electron');
      baseDir = app ? app.getPath('userData') : process.cwd();
    } catch (e) {
      baseDir = process.cwd();
    }

    if (!fs.existsSync(baseDir)) {
      try { fs.mkdirSync(baseDir, { recursive: true }); } catch (err) {}
    }
    return path.join(baseDir, 'ghostprompter_desktop_store.json');
  }

  _loadData() {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf-8');
        const parsed = JSON.parse(raw);
        return {
          scripts: Array.isArray(parsed.scripts) && parsed.scripts.length > 0 ? parsed.scripts : DEFAULT_SCRIPTS,
          activeScriptId: parsed.activeScriptId || 'script-welcome',
          settings: { ...DEFAULT_SETTINGS, ...(parsed.settings || {}) },
          takes: Array.isArray(parsed.takes) ? parsed.takes : []
        };
      }
    } catch (err) {
      console.warn('[StorageService] Error loading store, restoring defaults:', err.message);
    }

    const initial = {
      scripts: DEFAULT_SCRIPTS,
      activeScriptId: 'script-welcome',
      settings: DEFAULT_SETTINGS,
      takes: []
    };
    this._saveData(initial);
    return initial;
  }

  _scheduleSave() {
    if (this._saveTimer) return;
    this._saveTimer = setTimeout(() => {
      this._saveTimer = null;
      this._saveData();
    }, 250);
  }

  _saveData(dataToSave = null) {
    try {
      const data = dataToSave || this.data;
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.filePath, JSON.stringify(data, null, 2), 'utf-8');
    } catch (err) {
      console.error('[StorageService] Error saving store to disk:', err.message);
    }
  }

  getAll() {
    return { ...this.data };
  }

  get(key, defaultValue = null) {
    return this.data[key] !== undefined ? this.data[key] : defaultValue;
  }

  set(key, value) {
    this.data[key] = value;
    this._scheduleSave();
    return value;
  }

  getSetting(settingKey, defaultValue = null) {
    if (this.data.settings && this.data.settings[settingKey] !== undefined) {
      return this.data.settings[settingKey];
    }
    return defaultValue;
  }

  setSetting(settingKey, value) {
    if (!this.data.settings) this.data.settings = { ...DEFAULT_SETTINGS };
    this.data.settings[settingKey] = value;
    this._scheduleSave();
    return this.data.settings;
  }

  getScripts() {
    return this.data.scripts || [];
  }

  getActiveScript() {
    const scripts = this.getScripts();
    const active = scripts.find(s => s.id === this.data.activeScriptId);
    return active || scripts[0] || null;
  }

  saveScript(script) {
    if (!script || !script.title) throw new Error('Script must have a title');
    const scripts = [...this.getScripts()];
    const index = scripts.findIndex(s => s.id === script.id);

    const now = new Date().toISOString();
    if (index >= 0) {
      scripts[index] = { ...scripts[index], ...script, updatedAt: now };
    } else {
      const newScript = {
        id: script.id || `script-${Date.now()}`,
        title: script.title,
        content: script.content || '',
        updatedAt: now
      };
      scripts.push(newScript);
      script = newScript;
    }

    this.data.scripts = scripts;
    this.data.activeScriptId = script.id;
    this._saveData();
    return script;
  }

  deleteScript(id) {
    let scripts = this.getScripts().filter(s => s.id !== id);
    if (scripts.length === 0) {
      scripts = [...DEFAULT_SCRIPTS];
    }
    this.data.scripts = scripts;
    if (this.data.activeScriptId === id) {
      this.data.activeScriptId = scripts[0].id;
    }
    this._saveData();
    return { success: true, remaining: scripts.length };
  }

  saveTake(take) {
    if (!this.data.takes) this.data.takes = [];
    this.data.takes.unshift(take);
    this._saveData();
    return take;
  }

  getTakes() {
    return this.data.takes || [];
  }

  deleteTake(id) {
    if (!this.data.takes) return false;
    this.data.takes = this.data.takes.filter(t => t.id !== id);
    this._saveData();
    return true;
  }
}

module.exports = StorageService;
