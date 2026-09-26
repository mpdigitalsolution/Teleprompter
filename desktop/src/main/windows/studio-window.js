/**
 * GhostPrompter Desktop — Studio Dashboard Window
 * Apple macOS Sequoia Pro App interface for scripts, takes, settings, and calibration.
 */

const path = require('path');
let electronModule;
try {
  electronModule = require('electron');
} catch (e) {
  electronModule = null;
}

class StudioWindow {
  constructor(windowManager, storageService) {
    this.windowManager = windowManager;
    this.storage = storageService;
    this.win = null;
  }

  create() {
    if (!electronModule || !electronModule.BrowserWindow) {
      console.log('[StudioWindow] Electron BrowserWindow not available (test mode).');
      return null;
    }

    const { BrowserWindow, screen } = electronModule;
    const bounds = this.storage.getSetting('windowBounds')?.studio || { width: 1040, height: 720 };

    let x = bounds.x;
    let y = bounds.y;
    if (x === null || y === null || x === undefined || y === undefined) {
      const primaryDisplay = screen.getPrimaryDisplay();
      const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;
      x = Math.max(20, Math.round((screenWidth - bounds.width) / 2));
      y = Math.max(20, Math.round((screenHeight - bounds.height) / 2));
    }

    this.win = new BrowserWindow({
      width: bounds.width,
      height: bounds.height,
      minWidth: 800,
      minHeight: 560,
      x,
      y,
      frame: false,
      show: false,
      transparent: false,
      backgroundColor: '#161618',
      webPreferences: {
        preload: path.join(__dirname, '..', '..', 'preload', 'studio-preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false
      }
    });

    const htmlPath = path.join(__dirname, '..', '..', 'renderer', 'studio', 'studio.html');
    this.win.loadFile(htmlPath);

    const saveBounds = () => {
      if (!this.win || this.win.isDestroyed()) return;
      const currentBounds = this.win.getBounds();
      const allBounds = this.storage.getSetting('windowBounds') || {};
      allBounds.studio = currentBounds;
      this.storage.setSetting('windowBounds', allBounds);
    };

    this.win.on('moved', saveBounds);
    this.win.on('resized', saveBounds);

    this.win.on('closed', () => {
      this.win = null;
    });

    return this.win;
  }

  show() {
    if (this.win && !this.win.isDestroyed()) {
      if (this.win.isMinimized()) this.win.restore();
      this.win.show();
      this.win.focus();
    } else {
      this.create();
      if (this.win) {
        this.win.show();
        this.win.focus();
      }
    }
  }

  hide() {
    if (this.win && !this.win.isDestroyed()) {
      this.win.hide();
    }
  }

  toggle() {
    if (this.win && !this.win.isDestroyed() && this.win.isVisible()) {
      this.hide();
    } else {
      this.show();
    }
  }

  send(channel, data) {
    if (this.win && !this.win.isDestroyed()) {
      this.win.webContents.send(channel, data);
    }
  }
}

module.exports = StudioWindow;
