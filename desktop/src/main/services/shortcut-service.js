/**
 * GhostPrompter Desktop — Universal Global Shortcut Service
 * Enables instant control over presentations, Zoom calls, and streams.
 */

let electronGlobalShortcut;
try {
  const electron = require('electron');
  electronGlobalShortcut = electron.globalShortcut;
} catch (e) {
  electronGlobalShortcut = null;
}

class ShortcutService {
  constructor(windowManager, storageService) {
    this.windowManager = windowManager;
    this.storage = storageService;
    this.registeredShortcuts = new Map();
  }

  registerAll() {
    if (!electronGlobalShortcut) {
      console.log('[ShortcutService] Electron globalShortcut unavailable (test environment).');
      return;
    }

    this.unregisterAll();

    const shortcuts = [
      {
        accelerator: 'CommandOrControl+Shift+Space',
        action: 'toggle-play',
        handler: () => this.windowManager.broadcast('prompter:toggle-play')
      },
      {
        accelerator: 'CommandOrControl+Shift+R',
        action: 'toggle-record',
        handler: () => this.windowManager.broadcast('prompter:toggle-record')
      },
      {
        accelerator: 'CommandOrControl+Shift+Up',
        action: 'speed-up',
        handler: () => this.windowManager.broadcast('prompter:set-speed', { delta: 5 })
      },
      {
        accelerator: 'CommandOrControl+Shift+Down',
        action: 'speed-down',
        handler: () => this.windowManager.broadcast('prompter:set-speed', { delta: -5 })
      },
      {
        accelerator: 'CommandOrControl+Shift+G',
        action: 'toggle-ghost',
        handler: () => this.windowManager.toggleGhostMode()
      },
      {
        accelerator: 'CommandOrControl+Shift+M',
        action: 'toggle-compact',
        handler: () => this.windowManager.toggleCompactMode()
      },
      {
        accelerator: 'CommandOrControl+Shift+F',
        action: 'toggle-focus-line',
        handler: () => this.windowManager.broadcast('prompter:toggle-focus-line')
      },
      {
        accelerator: 'CommandOrControl+Shift+O',
        action: 'cycle-opacity',
        handler: () => this.windowManager.cycleOpacity()
      },
      {
        accelerator: 'CommandOrControl+Shift+H',
        action: 'toggle-prompter',
        handler: () => this.windowManager.togglePrompter()
      }
    ];

    for (const item of shortcuts) {
      try {
        const success = electronGlobalShortcut.register(item.accelerator, item.handler);
        if (success) {
          this.registeredShortcuts.set(item.accelerator, item);
        } else {
          console.warn(`[ShortcutService] Failed to register global shortcut: ${item.accelerator}`);
        }
      } catch (err) {
        console.warn(`[ShortcutService] Error registering ${item.accelerator}:`, err.message);
      }
    }

    console.log(`[ShortcutService] Registered ${this.registeredShortcuts.size} global shortcuts.`);
  }

  unregisterAll() {
    if (electronGlobalShortcut && typeof electronGlobalShortcut.unregisterAll === 'function') {
      electronGlobalShortcut.unregisterAll();
    }
    this.registeredShortcuts.clear();
  }
}

module.exports = ShortcutService;
