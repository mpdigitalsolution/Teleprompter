/**
 * GhostPrompter Desktop — Studio Dashboard Preload
 * Secure ContextBridge exposing window.studioAPI to the studio dashboard renderer.
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
    RECORDER_SAVE_TAKE: 'recorder:save-take',
    RECORDER_GET_SOURCES: 'recorder:get-sources',
    WINDOW_CLOSE: 'window:close',
    WINDOW_MINIMIZE: 'window:minimize',
    WINDOW_MAXIMIZE: 'window:maximize',
    APP_OPEN_PROMPTER: 'app:open-prompter',
    PROMPTER_SET_SPEED: 'prompter:set-speed',
    PROMPTER_SET_OPACITY: 'prompter:set-opacity',
    PROMPTER_SET_SCRIPT: 'prompter:set-script',
    PROMPTER_TOGGLE_PLAY: 'prompter:toggle-play',
    PROMPTER_TOGGLE_GHOST: 'prompter:toggle-ghost',
    PROMPTER_TOGGLE_COMPACT: 'prompter:toggle-compact'
  };
}

contextBridge.exposeInMainWorld('studioAPI', {
  // Storage & Scripts
  getInitialData: () => ipcRenderer.invoke(IPC_CHANNELS.STORAGE_GET_ALL),
  saveScript: (script) => ipcRenderer.invoke(IPC_CHANNELS.STORAGE_SAVE_SCRIPT, script),
  deleteScript: (id) => ipcRenderer.invoke(IPC_CHANNELS.STORAGE_DELETE_SCRIPT, id),
  saveTake: (take) => ipcRenderer.invoke(IPC_CHANNELS.RECORDER_SAVE_TAKE, take),

  // Video Capturer Sources & Export
  getSources: () => ipcRenderer.invoke(IPC_CHANNELS.RECORDER_GET_SOURCES),
  exportTake: (buffer, name) => ipcRenderer.invoke('recorder:export-file', buffer, name),

  // Window Controls
  closeWindow: () => ipcRenderer.send(IPC_CHANNELS.WINDOW_CLOSE),
  minimizeWindow: () => ipcRenderer.send(IPC_CHANNELS.WINDOW_MINIMIZE),
  maximizeWindow: () => ipcRenderer.send(IPC_CHANNELS.WINDOW_MAXIMIZE),
  openPrompter: () => ipcRenderer.send(IPC_CHANNELS.APP_OPEN_PROMPTER),

  // Prompter Remote Commands
  setSpeed: (speed) => ipcRenderer.send(IPC_CHANNELS.PROMPTER_SET_SPEED, speed),
  setOpacity: (opacity) => ipcRenderer.send(IPC_CHANNELS.PROMPTER_SET_OPACITY, opacity),
  setScript: (script) => ipcRenderer.send(IPC_CHANNELS.PROMPTER_SET_SCRIPT, script),
  togglePlay: () => ipcRenderer.send(IPC_CHANNELS.PROMPTER_TOGGLE_PLAY),
  toggleGhost: () => ipcRenderer.send(IPC_CHANNELS.PROMPTER_TOGGLE_GHOST),
  toggleCompact: () => ipcRenderer.send(IPC_CHANNELS.PROMPTER_TOGGLE_COMPACT),

  // Sync Listeners
  onScriptSaved: (cb) => {
    const sub = (e, data) => cb(data);
    ipcRenderer.on('storage:script-saved', sub);
    return () => ipcRenderer.removeListener('storage:script-saved', sub);
  },
  onScriptDeleted: (cb) => {
    const sub = (e, data) => cb(data);
    ipcRenderer.on('storage:script-deleted', sub);
    return () => ipcRenderer.removeListener('storage:script-deleted', sub);
  },
  onPrompterStateSynced: (cb) => {
    const sub = (e, data) => cb(data);
    ipcRenderer.on('prompter:state-synced', sub);
    return () => ipcRenderer.removeListener('prompter:state-synced', sub);
  }
});
