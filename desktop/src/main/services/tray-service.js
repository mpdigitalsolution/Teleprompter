/**
 * GhostPrompter Desktop — System Tray Integration
 * Provides native menu-bar access, script switching, and quick status controls.
 */

const path = require('path');
let electronModule;
try {
  electronModule = require('electron');
} catch (e) {
  electronModule = null;
}

class TrayService {
  constructor(windowManager, storageService) {
    this.windowManager = windowManager;
    this.storage = storageService;
    this.tray = null;
  }

  createTray() {
    if (!electronModule || !electronModule.Tray) {
      console.log('[TrayService] Electron Tray not available in this environment.');
      return;
    }

    const { Tray, Menu, nativeImage, app } = electronModule;
    
    // Resolve icon path or generate a fallback 16x16 RGBA image
    const iconPath = path.join(__dirname, '..', '..', '..', 'assets', 'tray', 'tray-idle.png');
    let icon;
    try {
      icon = nativeImage.createFromPath(iconPath);
      if (icon.isEmpty()) {
        icon = nativeImage.createEmpty();
      }
    } catch (e) {
      icon = nativeImage.createEmpty();
    }

    try {
      this.tray = new Tray(icon);
      this.tray.setToolTip('GhostPrompter Desktop — Universal Teleprompter');
      this.updateMenu();

      this.tray.on('double-click', () => {
        this.windowManager.togglePrompter();
      });
    } catch (err) {
      console.warn('[TrayService] Failed to initialize system tray:', err.message);
    }
  }

  updateMenu(currentState = {}) {
    if (!this.tray || !electronModule) return;
    const { Menu, app } = electronModule;

    const scripts = this.storage.getScripts();
    const activeId = this.storage.get('activeScriptId');
    const isPlaying = !!currentState.isPlaying;
    const isGhost = !!currentState.isGhost;
    const isCompact = !!currentState.isCompact;

    const scriptMenuItems = scripts.slice(0, 5).map(s => ({
      label: s.title.length > 28 ? s.title.slice(0, 25) + '...' : s.title,
      type: 'radio',
      checked: s.id === activeId,
      click: () => {
        this.storage.set('activeScriptId', s.id);
        this.windowManager.broadcast('prompter:set-script', s);
        this.updateMenu(currentState);
      }
    }));

    const contextMenu = Menu.buildFromTemplate([
      { label: 'GhostPrompter Desktop', enabled: false },
      { label: isPlaying ? '🟢 Prompter Active' : '⚪ Prompter Idle', enabled: false },
      { type: 'separator' },
      {
        label: isPlaying ? '⏸ Pause Scrolling' : '▶ Start Scrolling',
        accelerator: 'CommandOrControl+Shift+Space',
        click: () => this.windowManager.broadcast('prompter:toggle-play')
      },
      {
        label: isGhost ? '👻 Disable Ghost Mode' : '👻 Enable Ghost Mode (Click-Through)',
        accelerator: 'CommandOrControl+Shift+G',
        click: () => this.windowManager.toggleGhostMode()
      },
      {
        label: isCompact ? '⇱ Expand Full Prompter' : '⇲ Minimize to Dynamic Island',
        accelerator: 'CommandOrControl+Shift+M',
        click: () => this.windowManager.toggleCompactMode()
      },
      { type: 'separator' },
      {
        label: '🖥 Open Floating Prompter',
        click: () => this.windowManager.showPrompter()
      },
      {
        label: '🎛 Open Studio Dashboard',
        click: () => this.windowManager.showStudio()
      },
      { type: 'separator' },
      {
        label: '📜 Select Script',
        submenu: scriptMenuItems.length > 0 ? scriptMenuItems : [{ label: 'No scripts found', enabled: false }]
      },
      { type: 'separator' },
      {
        label: 'Quit GhostPrompter',
        click: () => app.quit()
      }
    ]);

    this.tray.setContextMenu(contextMenu);
  }

  destroy() {
    if (this.tray) {
      this.tray.destroy();
      this.tray = null;
    }
  }
}

module.exports = TrayService;
