/**
 * GhostPrompter Desktop — Main Process Entry Point
 * High-performance, cross-platform teleprompter with true click-through ghost mode.
 */

const { app } = require('electron');
const path = require('path');
const StorageService = require('./services/storage-service');
const WindowManager = require('./windows/window-manager');
const ShortcutService = require('./services/shortcut-service');
const TrayService = require('./services/tray-service');
const RecorderService = require('./services/recorder-service');
const { registerIpcHandlers } = require('./ipc/ipc-handlers');

// Enforce single instance lock
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  console.log('[GhostPrompter] Another instance is already running. Exiting.');
  app.quit();
  process.exit(0);
}

// Hardware Stability Flags for AMD Ryzen APU / Intel UHD & Low-End Laptops
// Note: enable-zero-copy and ignore-gpu-blocklist are omitted to avoid
// D3D11 driver deadlocks on AMD Vega 8 integrated graphics.
app.commandLine.appendSwitch('disable-background-timer-throttling');
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('disable-features', 'CalculateNativeWinOcclusion,HardwareMediaKeyHandling');
app.commandLine.appendSwitch('disable-direct-composition-video-overlays');
app.commandLine.appendSwitch('disable-gpu-memory-buffer-video-frames');
app.commandLine.appendSwitch('force-color-profile', 'srgb');

// Graceful child process & GPU crash logging
app.on('child-process-gone', (event, details) => {
  console.warn('[GhostPrompter] Subprocess status:', details.reason);
});

// Initialize Services
const storageService = new StorageService();
const windowManager = new WindowManager(storageService);
const shortcutService = new ShortcutService(windowManager, storageService);
const trayService = new TrayService(windowManager, storageService);
const recorderService = new RecorderService(storageService);

windowManager.setTrayService(trayService);

// Register IPC handlers
registerIpcHandlers(windowManager, storageService, recorderService);

// Second-instance focus handler
app.on('second-instance', () => {
  windowManager.showPrompter();
});

// App Lifecycle
app.whenReady().then(() => {
  console.log('[GhostPrompter Desktop] App ready. Initializing windows & services...');

  // Ensure media capture permissions are granted for prompter
  const { session, desktopCapturer } = require('electron');
  if (session && session.defaultSession) {
    session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
      callback(true);
    });
    session.defaultSession.setPermissionCheckHandler(() => true);

    if (session.defaultSession.setDisplayMediaRequestHandler) {
      session.defaultSession.setDisplayMediaRequestHandler(async (request, callback) => {
        try {
          const sources = await desktopCapturer.getSources({ types: ['screen', 'window'] });
          let chosen = sources[0];
          if (recorderService && recorderService.selectedSourceId) {
            const match = sources.find(s => s.id === recorderService.selectedSourceId);
            if (match) chosen = match;
          }
          callback({ video: chosen, audio: 'loopback' });
        } catch (e) {
          callback({});
        }
      });
    }
  }

  // Initialize both Prompter and Studio windows
  windowManager.initWindows();

  // Create system tray
  trayService.createTray();

  // Register universal global shortcuts
  shortcutService.registerAll();

  // By default, display the floating prompter HUD
  windowManager.showPrompter();

  app.on('activate', () => {
    windowManager.showPrompter();
  });
});

app.on('will-quit', () => {
  shortcutService.unregisterAll();
  trayService.destroy();
});

app.on('window-all-closed', () => {
  // On Windows/Linux, keep running in background tray unless user explicitly quits
  // This allows global hotkeys to summon the prompter instantly at any time
});
