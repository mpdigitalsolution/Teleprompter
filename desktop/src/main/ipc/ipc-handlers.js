/**
 * GhostPrompter Desktop — Central IPC Message Handlers
 * Routes messages between renderer processes, storage, window manager, and tray.
 */

const IPC_CHANNELS = require('./ipc-channels');

let electronIpc;
try {
  electronIpc = require('electron').ipcMain;
} catch (e) {
  electronIpc = null;
}

function registerIpcHandlers(windowManager, storageService, recorderService) {
  if (!electronIpc) {
    console.log('[IpcHandlers] electron.ipcMain unavailable in this environment.');
    return;
  }

  // Storage Handlers
  electronIpc.handle(IPC_CHANNELS.STORAGE_GET_ALL, async () => {
    return storageService.getAll();
  });

  electronIpc.handle(IPC_CHANNELS.STORAGE_GET, async (evt, key, def) => {
    return storageService.get(key, def);
  });

  electronIpc.handle(IPC_CHANNELS.STORAGE_SET, async (evt, key, val) => {
    return storageService.set(key, val);
  });

  electronIpc.handle(IPC_CHANNELS.STORAGE_SAVE_SCRIPT, async (evt, script) => {
    const saved = storageService.saveScript(script);
    windowManager.broadcast('storage:script-saved', saved);
    if (windowManager.trayService) {
      windowManager.trayService.updateMenu(windowManager.state);
    }
    return saved;
  });

  electronIpc.handle(IPC_CHANNELS.STORAGE_DELETE_SCRIPT, async (evt, id) => {
    const res = storageService.deleteScript(id);
    windowManager.broadcast('storage:script-deleted', { id });
    if (windowManager.trayService) {
      windowManager.trayService.updateMenu(windowManager.state);
    }
    return res;
  });

  // Prompter Controls Handlers
  electronIpc.on(IPC_CHANNELS.PROMPTER_TOGGLE_PLAY, () => {
    windowManager.broadcast('prompter:toggle-play');
  });

  electronIpc.on(IPC_CHANNELS.PROMPTER_SET_SPEED, (evt, speed) => {
    storageService.setSetting('scrollSpeed', speed);
    windowManager.updateState({ speed });
    if (windowManager.studio) {
      windowManager.studio.send('prompter:set-speed', { speed });
    }
  });

  electronIpc.on(IPC_CHANNELS.PROMPTER_SET_OPACITY, (evt, opacity) => {
    storageService.setSetting('opacity', opacity);
    windowManager.updateState({ opacity });
    if (windowManager.studio) {
      windowManager.studio.send('prompter:opacity-changed', { opacity });
    }
  });

  electronIpc.on('prompter:set-font-size', (evt, fontSize) => {
    storageService.setSetting('fontSize', fontSize);
    windowManager.updateState({ fontSize });
    windowManager.broadcast('prompter:font-size-changed', { fontSize });
  });

  electronIpc.on('prompter:set-text-color', (evt, textColor) => {
    storageService.setSetting('textColor', textColor);
    windowManager.updateState({ textColor });
    windowManager.broadcast('prompter:text-color-changed', { textColor });
  });

  electronIpc.on('prompter:set-text-align', (evt, textAlign) => {
    storageService.setSetting('textAlign', textAlign);
    windowManager.updateState({ textAlign });
    windowManager.broadcast('prompter:text-align-changed', { textAlign });
  });

  electronIpc.on(IPC_CHANNELS.PROMPTER_TOGGLE_GHOST, () => {
    windowManager.toggleGhostMode();
  });

  electronIpc.on(IPC_CHANNELS.PROMPTER_TOGGLE_COMPACT, () => {
    windowManager.toggleCompactMode();
  });

  electronIpc.on(IPC_CHANNELS.PROMPTER_TOGGLE_FOCUS_LINE, () => {
    const curr = storageService.getSetting('focusLineVisible', true);
    storageService.setSetting('focusLineVisible', !curr);
    windowManager.broadcast('prompter:toggle-focus-line', { visible: !curr });
  });

  electronIpc.on(IPC_CHANNELS.PROMPTER_SET_SCRIPT, (evt, script) => {
    storageService.set('activeScriptId', script.id);
    windowManager.broadcast('prompter:set-script', script);
  });

  electronIpc.on(IPC_CHANNELS.PROMPTER_STATE_CHANGED, (evt, state) => {
    windowManager.updateState(state);
    // Broadcast state to other windows (e.g. Studio playback status updates)
    windowManager.broadcast('prompter:state-synced', state);
  });

  // Window Actions
  electronIpc.on(IPC_CHANNELS.WINDOW_CLOSE, (evt) => {
    const win = electronIpc ? require('electron').BrowserWindow.fromWebContents(evt.sender) : null;
    if (win) win.close();
  });

  electronIpc.on(IPC_CHANNELS.WINDOW_MINIMIZE, (evt) => {
    const win = electronIpc ? require('electron').BrowserWindow.fromWebContents(evt.sender) : null;
    if (win) win.minimize();
  });

  electronIpc.handle('window:is-maximized', (evt) => {
    const win = electronIpc ? require('electron').BrowserWindow.fromWebContents(evt.sender) : null;
    return win && !win.isDestroyed() ? win.isMaximized() : false;
  });

  electronIpc.on(IPC_CHANNELS.WINDOW_MAXIMIZE, (evt) => {
    const win = electronIpc ? require('electron').BrowserWindow.fromWebContents(evt.sender) : null;
    if (win && !win.isDestroyed()) {
      if (win.isMaximized()) {
        win.unmaximize();
      } else {
        win.maximize();
      }
      win.webContents.send('window:maximized-changed', win.isMaximized());
    }
  });

  electronIpc.on(IPC_CHANNELS.WINDOW_MOVE_BY, (evt, { deltaX, deltaY }) => {
    const win = electronIpc ? require('electron').BrowserWindow.fromWebContents(evt.sender) : null;
    if (win && !win.isDestroyed()) {
      const [x, y] = win.getPosition();
      win.setPosition(Math.round(x + deltaX), Math.round(y + deltaY));
    }
  });

  electronIpc.on(IPC_CHANNELS.WINDOW_SET_POSITION, (evt, { x, y }) => {
    const win = electronIpc ? require('electron').BrowserWindow.fromWebContents(evt.sender) : null;
    if (win && !win.isDestroyed()) {
      win.setPosition(Math.round(x), Math.round(y));
    }
  });

  electronIpc.on(IPC_CHANNELS.WINDOW_RESIZE, (evt, { deltaW, deltaH }) => {
    const win = electronIpc ? require('electron').BrowserWindow.fromWebContents(evt.sender) : null;
    if (win && !win.isDestroyed()) {
      const [w, h] = win.getSize();
      win.setSize(Math.max(320, Math.round(w + deltaW)), Math.max(42, Math.round(h + deltaH)));
    }
  });

  electronIpc.on(IPC_CHANNELS.WINDOW_SET_SIZE, (evt, { width, height }) => {
    const win = electronIpc ? require('electron').BrowserWindow.fromWebContents(evt.sender) : null;
    if (win && !win.isDestroyed()) {
      win.setSize(Math.max(320, Math.round(width)), Math.max(42, Math.round(height)));
    }
  });

  electronIpc.handle('window:get-bounds', (evt) => {
    const win = electronIpc ? require('electron').BrowserWindow.fromWebContents(evt.sender) : null;
    return win && !win.isDestroyed() ? win.getBounds() : null;
  });

  electronIpc.on('window:set-bounds', (evt, bounds) => {
    const win = electronIpc ? require('electron').BrowserWindow.fromWebContents(evt.sender) : null;
    if (win && !win.isDestroyed() && bounds) {
      const current = win.getBounds();
      const x = bounds.x !== undefined ? Math.round(bounds.x) : current.x;
      const y = bounds.y !== undefined ? Math.round(bounds.y) : current.y;
      const width = bounds.width !== undefined ? Math.max(320, Math.round(bounds.width)) : current.width;
      const height = bounds.height !== undefined ? Math.max(42, Math.round(bounds.height)) : current.height;
      win.setBounds({ x, y, width, height });
    }
  });

  electronIpc.on(IPC_CHANNELS.WINDOW_SET_IGNORE_MOUSE, (evt, ignore) => {
    const win = electronIpc ? require('electron').BrowserWindow.fromWebContents(evt.sender) : null;
    if (win) {
      win.setIgnoreMouseEvents(!!ignore, { forward: true });
    }
  });

  // Recorder Handlers
  electronIpc.handle(IPC_CHANNELS.RECORDER_GET_SOURCES, async () => {
    return recorderService.getSources();
  });

  electronIpc.handle('recorder:select-source', (evt, sourceId) => {
    if (recorderService) {
      recorderService.selectedSourceId = sourceId;
    }
    return true;
  });

  electronIpc.handle(IPC_CHANNELS.RECORDER_START_SESSION, async (evt, sessionId) => {
    return recorderService.startSession(sessionId);
  });

  electronIpc.handle(IPC_CHANNELS.RECORDER_APPEND_CHUNK, async (evt, chunkBuffer) => {
    return recorderService.appendChunk(chunkBuffer);
  });

  electronIpc.handle(IPC_CHANNELS.RECORDER_FINISH_SESSION, async () => {
    return recorderService.finishSession();
  });

  electronIpc.handle(IPC_CHANNELS.RECORDER_DISCARD_SESSION, async (evt, tempPath) => {
    return recorderService.discardSession(tempPath);
  });

  electronIpc.handle(IPC_CHANNELS.RECORDER_EXPORT_SESSION, async (evt, tempPath, defaultName) => {
    return recorderService.exportSessionToFile(tempPath, defaultName);
  });

  electronIpc.handle(IPC_CHANNELS.RECORDER_SAVE_TAKE, async (evt, takeData) => {
    return storageService.saveTake(takeData);
  });

  electronIpc.handle('recorder:export-file', async (evt, buffer, defaultName) => {
    return recorderService.exportTakeToFile(buffer, defaultName);
  });

  // App Navigation Handlers
  electronIpc.on(IPC_CHANNELS.APP_OPEN_PROMPTER, () => {
    windowManager.showPrompter();
  });

  electronIpc.on(IPC_CHANNELS.APP_OPEN_STUDIO, () => {
    windowManager.showStudio();
  });

  electronIpc.on(IPC_CHANNELS.APP_QUIT, () => {
    const { app } = require('electron');
    if (app) app.quit();
  });
}

module.exports = { registerIpcHandlers };
