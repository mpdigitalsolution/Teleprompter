/**
 * GhostPrompter Desktop — Central Window Manager
 * Coordinates multi-window states, broadcasts events, and manages Ghost / Compact modes.
 */

const PrompterWindow = require('./prompter-window');
const StudioWindow = require('./studio-window');

class WindowManager {
  constructor(storageService) {
    this.storage = storageService;
    this.prompter = new PrompterWindow(this, storageService);
    this.studio = new StudioWindow(this, storageService);
    this.trayService = null;

    this.state = {
      isPlaying: false,
      isGhost: false,
      isCompact: false,
      speed: storageService.getSetting('scrollSpeed', 160),
      opacity: storageService.getSetting('opacity', 0.85)
    };
  }

  setTrayService(trayService) {
    this.trayService = trayService;
  }

  initWindows() {
    this.prompter.create();
    // Studio window is created on-demand only when requested by user
  }

  showPrompter() {
    this.prompter.show();
  }

  hidePrompter() {
    this.prompter.hide();
  }

  togglePrompter() {
    this.prompter.toggle();
  }

  showStudio() {
    this.studio.show();
  }

  hideStudio() {
    this.studio.hide();
  }

  toggleStudio() {
    this.studio.toggle();
  }

  toggleGhostMode() {
    this.state.isGhost = !this.state.isGhost;
    this.prompter.setGhostMode(this.state.isGhost);
    this.storage.setSetting('ghostMode', this.state.isGhost);
    this.broadcast('prompter:ghost-mode-changed', { isGhost: this.state.isGhost });
    if (this.trayService) this.trayService.updateMenu(this.state);
    return this.state.isGhost;
  }

  toggleCompactMode() {
    this.state.isCompact = !this.state.isCompact;
    this.prompter.setCompactMode(this.state.isCompact);
    this.storage.setSetting('compactMode', this.state.isCompact);
    this.broadcast('prompter:compact-mode-changed', { isCompact: this.state.isCompact });
    if (this.trayService) this.trayService.updateMenu(this.state);
    return this.state.isCompact;
  }

  cycleOpacity() {
    const presets = [
      { name: 'solid', val: 0.95 },
      { name: 'dark', val: 0.85 },
      { name: 'glass', val: 0.40 },
      { name: 'clear', val: 0.15 }
    ];
    const current = this.state.opacity;
    const currentIndex = presets.findIndex(p => Math.abs(p.val - current) < 0.08);
    const nextIndex = (currentIndex + 1) % presets.length;
    const next = presets[nextIndex];

    this.state.opacity = next.val;
    this.storage.setSetting('opacity', next.val);
    this.storage.setSetting('opacityPreset', next.name);
    this.broadcast('prompter:opacity-changed', { opacity: next.val, preset: next.name });
    return next;
  }

  updateState(partial) {
    this.state = { ...this.state, ...partial };
    if (this.trayService) {
      this.trayService.updateMenu(this.state);
    }
  }

  broadcast(channel, data = {}) {
    this.prompter.send(channel, data);
    this.studio.send(channel, data);
  }
}

module.exports = WindowManager;
