/**
 * GhostPrompter Desktop — Prompter Overlay Preload
 * Secure ContextBridge exposing window.prompterAPI to the prompter renderer.
 */

const { contextBridge, ipcRenderer } = require('electron');

let IPC_CHANNELS;
try {
  IPC_CHANNELS = require('../main/ipc/ipc-channels');
} catch (e) {
  IPC_CHANNELS = {
    STORAGE_GET_ALL: 'storage:get-all',
    STORAGE_SAVE_SCRIPT: 'storage:save-script',
    STORAGE_DELETE_SCRIPT: 'storage:delete-script',
    WINDOW_CLOSE: 'window:close',
    WINDOW_MINIMIZE: 'window:minimize',
    WINDOW_MAXIMIZE: 'window:maximize',
    WINDOW_MOVE_BY: 'window:move-by',
    WINDOW_SET_POSITION: 'window:set-position',
    WINDOW_SET_SIZE: 'window:set-size',
    WINDOW_RESIZE: 'window:resize',
    WINDOW_SET_IGNORE_MOUSE: 'window:set-ignore-mouse',
    APP_OPEN_STUDIO: 'app:open-studio',
    RECORDER_GET_SOURCES: 'recorder:get-sources',
    RECORDER_START_SESSION: 'recorder:start-session',
    RECORDER_APPEND_CHUNK: 'recorder:append-chunk',
    RECORDER_FINISH_SESSION: 'recorder:finish-session',
    RECORDER_DISCARD_SESSION: 'recorder:discard-session',
    RECORDER_EXPORT_SESSION: 'recorder:export-session',
    RECORDER_SAVE_TAKE: 'recorder:save-take',
    PROMPTER_TOGGLE_PLAY: 'prompter:toggle-play',
    PROMPTER_SET_SPEED: 'prompter:set-speed',
    PROMPTER_SET_OPACITY: 'prompter:set-opacity',
    PROMPTER_TOGGLE_GHOST: 'prompter:toggle-ghost',
    PROMPTER_TOGGLE_COMPACT: 'prompter:toggle-compact',
    PROMPTER_TOGGLE_FOCUS_LINE: 'prompter:toggle-focus-line',
    PROMPTER_SET_SCRIPT: 'prompter:set-script',
    PROMPTER_STATE_CHANGED: 'prompter:state-changed'
  };
}

contextBridge.exposeInMainWorld('prompterAPI', {
  // Storage APIs
  getInitialData: () => ipcRenderer.invoke(IPC_CHANNELS.STORAGE_GET_ALL),
  saveScript: (script) => ipcRenderer.invoke(IPC_CHANNELS.STORAGE_SAVE_SCRIPT, script),
  deleteScript: (id) => ipcRenderer.invoke(IPC_CHANNELS.STORAGE_DELETE_SCRIPT, id),

  // Window Controls
  closeWindow: () => ipcRenderer.send(IPC_CHANNELS.WINDOW_CLOSE),
  minimizeWindow: () => ipcRenderer.send(IPC_CHANNELS.WINDOW_MINIMIZE),
  maximizeWindow: () => ipcRenderer.send(IPC_CHANNELS.WINDOW_MAXIMIZE),
  isMaximized: () => ipcRenderer.invoke('window:is-maximized'),
  moveWindow: (deltaX, deltaY) => ipcRenderer.send(IPC_CHANNELS.WINDOW_MOVE_BY, { deltaX, deltaY }),
  setPosition: (x, y) => ipcRenderer.send(IPC_CHANNELS.WINDOW_SET_POSITION, { x, y }),
  setSize: (width, height) => ipcRenderer.send(IPC_CHANNELS.WINDOW_SET_SIZE, { width, height }),
  getBounds: () => ipcRenderer.invoke('window:get-bounds'),
  setBounds: (bounds) => ipcRenderer.send('window:set-bounds', bounds),
  resizeWindow: (deltaW, deltaH) => ipcRenderer.send(IPC_CHANNELS.WINDOW_RESIZE, { deltaW, deltaH }),
  setIgnoreMouse: (ignore) => ipcRenderer.send(IPC_CHANNELS.WINDOW_SET_IGNORE_MOUSE, ignore),
  openStudio: () => ipcRenderer.send(IPC_CHANNELS.APP_OPEN_STUDIO),

  // Video Capturer & Recording APIs
  getSources: () => ipcRenderer.invoke(IPC_CHANNELS.RECORDER_GET_SOURCES),
  selectCaptureSource: (sourceId) => ipcRenderer.invoke('recorder:select-source', sourceId),
  startRecordingSession: (sessionId) => ipcRenderer.invoke(IPC_CHANNELS.RECORDER_START_SESSION, sessionId),
  appendRecordingChunk: (chunkBuffer) => ipcRenderer.invoke(IPC_CHANNELS.RECORDER_APPEND_CHUNK, chunkBuffer),
  finishRecordingSession: () => ipcRenderer.invoke(IPC_CHANNELS.RECORDER_FINISH_SESSION),
  discardRecordingSession: (tempPath) => ipcRenderer.invoke(IPC_CHANNELS.RECORDER_DISCARD_SESSION, tempPath),
  exportRecordingSession: (tempPath, name) => ipcRenderer.invoke(IPC_CHANNELS.RECORDER_EXPORT_SESSION, tempPath, name),
  saveTake: (take) => ipcRenderer.invoke(IPC_CHANNELS.RECORDER_SAVE_TAKE, take),
  exportTake: (buffer, name) => ipcRenderer.invoke('recorder:export-file', buffer, name),
  getStorageDir: () => ipcRenderer.invoke('recorder:get-storage-dir'),
  selectStorageDir: () => ipcRenderer.invoke('recorder:select-storage-dir'),
  resetStorageDir: () => ipcRenderer.invoke('recorder:reset-storage-dir'),
  openStorageDir: () => ipcRenderer.invoke('recorder:open-storage-dir'),

  // Prompter Action Dispatches
  togglePlay: () => ipcRenderer.send(IPC_CHANNELS.PROMPTER_TOGGLE_PLAY),
  setSpeed: (speed) => ipcRenderer.send(IPC_CHANNELS.PROMPTER_SET_SPEED, speed),
  setOpacity: (opacity) => ipcRenderer.send(IPC_CHANNELS.PROMPTER_SET_OPACITY, opacity),
  toggleGhost: () => ipcRenderer.send(IPC_CHANNELS.PROMPTER_TOGGLE_GHOST),
  toggleCompact: () => ipcRenderer.send(IPC_CHANNELS.PROMPTER_TOGGLE_COMPACT),
  toggleFocusLine: () => ipcRenderer.send(IPC_CHANNELS.PROMPTER_TOGGLE_FOCUS_LINE),
  setFontSize: (fontSize) => ipcRenderer.send('prompter:set-font-size', fontSize),
  setTextColor: (textColor) => ipcRenderer.send('prompter:set-text-color', textColor),
  setTextAlign: (textAlign) => ipcRenderer.send('prompter:set-text-align', textAlign),
  setScript: (script) => ipcRenderer.send(IPC_CHANNELS.PROMPTER_SET_SCRIPT, script),
  notifyStateChanged: (state) => ipcRenderer.send(IPC_CHANNELS.PROMPTER_STATE_CHANGED, state),

  // Event Listeners from Main / Shortcuts
  onTogglePlay: (cb) => {
    const sub = () => cb();
    ipcRenderer.on('prompter:toggle-play', sub);
    return () => ipcRenderer.removeListener('prompter:toggle-play', sub);
  },
  onToggleRecord: (cb) => {
    const sub = () => cb();
    ipcRenderer.on('prompter:toggle-record', sub);
    return () => ipcRenderer.removeListener('prompter:toggle-record', sub);
  },
  onSetSpeed: (cb) => {
    const sub = (e, data) => cb(data);
    ipcRenderer.on('prompter:set-speed', sub);
    return () => ipcRenderer.removeListener('prompter:set-speed', sub);
  },
  onOpacityChanged: (cb) => {
    const sub = (e, data) => cb(data);
    ipcRenderer.on('prompter:opacity-changed', sub);
    return () => ipcRenderer.removeListener('prompter:opacity-changed', sub);
  },
  onGhostModeChanged: (cb) => {
    const sub = (e, data) => cb(data);
    ipcRenderer.on('prompter:ghost-mode-changed', sub);
    return () => ipcRenderer.removeListener('prompter:ghost-mode-changed', sub);
  },
  onCompactModeChanged: (cb) => {
    const sub = (e, data) => cb(data);
    ipcRenderer.on('prompter:compact-mode-changed', sub);
    return () => ipcRenderer.removeListener('prompter:compact-mode-changed', sub);
  },
  onToggleFocusLine: (cb) => {
    const sub = (e, data) => cb(data);
    ipcRenderer.on('prompter:toggle-focus-line', sub);
    return () => ipcRenderer.removeListener('prompter:toggle-focus-line', sub);
  },
  onSetScript: (cb) => {
    const sub = (e, data) => cb(data);
    ipcRenderer.on('prompter:set-script', sub);
    return () => ipcRenderer.removeListener('prompter:set-script', sub);
  },
  onFontSizeChanged: (cb) => {
    const sub = (e, data) => cb(data);
    ipcRenderer.on('prompter:font-size-changed', sub);
    return () => ipcRenderer.removeListener('prompter:font-size-changed', sub);
  },
  onTextColorChanged: (cb) => {
    const sub = (e, data) => cb(data);
    ipcRenderer.on('prompter:text-color-changed', sub);
    return () => ipcRenderer.removeListener('prompter:text-color-changed', sub);
  },
  onTextAlignChanged: (cb) => {
    const sub = (e, data) => cb(data);
    ipcRenderer.on('prompter:text-align-changed', sub);
    return () => ipcRenderer.removeListener('prompter:text-align-changed', sub);
  },
  onMaximizedChanged: (cb) => {
    const sub = (e, isMax) => cb(isMax);
    ipcRenderer.on('window:maximized-changed', sub);
    return () => ipcRenderer.removeListener('window:maximized-changed', sub);
  }
});
