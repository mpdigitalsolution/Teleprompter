/**
 * GhostPrompter Desktop — Floating Prompter Overlay Window
 * Frameless, transparent, always-on-top, click-through visionOS glass surface.
 */

const path = require('path');
let electronModule;
try {
  electronModule = require('electron');
} catch (e) {
  electronModule = null;
}

class PrompterWindow {
  constructor(windowManager, storageService) {
    this.windowManager = windowManager;
    this.storage = storageService;
    this.win = null;
    this.isGhost = false;
    this.isCompact = false;
    this.savedHeightBeforeCompact = 380;
  }

  create() {
    if (!electronModule || !electronModule.BrowserWindow) {
      console.log('[PrompterWindow] Electron BrowserWindow not available (test mode).');
      return null;
    }

    const { BrowserWindow, screen } = electronModule;
    const bounds = this.storage.getSetting('windowBounds')?.prompter || { width: 560, height: 380 };

    // Default positioning: top center below webcam
    let x = bounds.x;
    let y = bounds.y;
    if (x === null || y === null || x === undefined || y === undefined) {
      const primaryDisplay = screen.getPrimaryDisplay();
      const { width: screenWidth } = primaryDisplay.workAreaSize;
      x = Math.round((screenWidth - bounds.width) / 2);
      y = 40; // right beneath top webcam
    }

    this.win = new BrowserWindow({
      width: bounds.width,
      height: bounds.height,
      minWidth: 320,
      minHeight: 42,
      x,
      y,
      frame: false,
      transparent: true,
      alwaysOnTop: true,
      hasShadow: false,
      roundedCorners: true,
      backgroundColor: '#00000000',
      webPreferences: {
        preload: path.join(__dirname, '..', '..', 'preload', 'prompter-preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false,
        backgroundThrottling: false // Don't throttle 60fps scrolling when PowerPoint/Zoom has focus
      }
    });

    // Load prompter HTML
    const htmlPath = path.join(__dirname, '..', '..', 'renderer', 'prompter', 'prompter.html');
    this.win.loadFile(htmlPath);

    // Debounced bounds saving to prevent disk thrashing and Win32 GetWindowRect calls during dragging/resizing
    let saveBoundsTimer = null;
    const saveBounds = () => {
      if (!this.win || this.win.isDestroyed() || this.isCompact || this.win.isMaximized()) return;
      if (saveBoundsTimer) clearTimeout(saveBoundsTimer);
      saveBoundsTimer = setTimeout(() => {
        saveBoundsTimer = null;
        if (!this.win || this.win.isDestroyed()) return;
        const currentBounds = this.win.getBounds();
        const allBounds = this.storage.getSetting('windowBounds') || {};
        allBounds.prompter = currentBounds;
        this.storage.setSetting('windowBounds', allBounds);
      }, 500);
    };

    this.win.on('moved', saveBounds);
    this.win.on('resized', saveBounds);

    this.win.on('maximize', () => {
      if (this.win && !this.win.isDestroyed()) {
        this.win.webContents.send('window:maximized-changed', true);
      }
    });

    this.win.on('unmaximize', () => {
      if (this.win && !this.win.isDestroyed()) {
        this.win.webContents.send('window:maximized-changed', false);
      }
    });

    this.win.on('closed', () => {
      this.win = null;
    });

    return this.win;
  }

  setGhostMode(enabled) {
    this.isGhost = !!enabled;
    if (this.win && !this.win.isDestroyed()) {
      // In transparent ghost mode, allow the user to interact with the header, controls, and exit pill
      this.win.webContents.send('prompter:ghost-mode-changed', { isGhost: this.isGhost });
    }
    return this.isGhost;
  }

  setCompactMode(compact) {
    if (!this.win || this.win.isDestroyed()) return;
    this.isCompact = !!compact;
    const [width, height] = this.win.getSize();

    if (this.isCompact) {
      this.savedHeightBeforeCompact = height > 100 ? height : 380;
      this.win.setSize(width, 42);
    } else {
      this.win.setSize(width, this.savedHeightBeforeCompact || 380);
    }

    this.win.webContents.send('prompter:compact-mode-changed', { isCompact: this.isCompact });
    return this.isCompact;
  }

  show() {
    if (this.win && !this.win.isDestroyed()) {
      this.win.show();
      this.win.focus();
    } else {
      this.create();
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

  close() {
    if (this.win && !this.win.isDestroyed()) {
      this.win.close();
    }
  }

  send(channel, data) {
    if (this.win && !this.win.isDestroyed()) {
      this.win.webContents.send(channel, data);
    }
  }
}

module.exports = PrompterWindow;
