/**
 * GhostPrompter Desktop — Centralized IPC Channel Constants
 */

const IPC_CHANNELS = {
  // Prompter Controls & State
  PROMPTER_TOGGLE_PLAY: 'prompter:toggle-play',
  PROMPTER_SET_SPEED: 'prompter:set-speed',
  PROMPTER_SET_OPACITY: 'prompter:set-opacity',
  PROMPTER_TOGGLE_GHOST: 'prompter:toggle-ghost',
  PROMPTER_TOGGLE_COMPACT: 'prompter:toggle-compact',
  PROMPTER_TOGGLE_FOCUS_LINE: 'prompter:toggle-focus-line',
  PROMPTER_SET_SCRIPT: 'prompter:set-script',
  PROMPTER_STATE_CHANGED: 'prompter:state-changed',
  PROMPTER_SEEK: 'prompter:seek',

  // Window Management
  WINDOW_CLOSE: 'window:close',
  WINDOW_MINIMIZE: 'window:minimize',
  WINDOW_MAXIMIZE: 'window:maximize',
  WINDOW_RESIZE: 'window:resize',
  WINDOW_MOVE_BY: 'window:move-by',
  WINDOW_SET_POSITION: 'window:set-position',
  WINDOW_SET_SIZE: 'window:set-size',
  WINDOW_SET_IGNORE_MOUSE: 'window:set-ignore-mouse',
  WINDOW_SET_ALWAYS_ON_TOP: 'window:set-always-on-top',

  // Persistent Storage
  STORAGE_GET_ALL: 'storage:get-all',
  STORAGE_GET: 'storage:get',
  STORAGE_SET: 'storage:set',
  STORAGE_SAVE_SCRIPT: 'storage:save-script',
  STORAGE_DELETE_SCRIPT: 'storage:delete-script',
  STORAGE_EXPORT_DATA: 'storage:export-data',
  STORAGE_IMPORT_DATA: 'storage:import-data',

  // Video & Audio Recorder
  RECORDER_GET_SOURCES: 'recorder:get-sources',
  RECORDER_START_SESSION: 'recorder:start-session',
  RECORDER_APPEND_CHUNK: 'recorder:append-chunk',
  RECORDER_FINISH_SESSION: 'recorder:finish-session',
  RECORDER_DISCARD_SESSION: 'recorder:discard-session',
  RECORDER_EXPORT_SESSION: 'recorder:export-session',
  RECORDER_SAVE_TAKE: 'recorder:save-take',
  RECORDER_GET_TAKES: 'recorder:get-takes',
  RECORDER_DELETE_TAKE: 'recorder:delete-take',

  // App & Navigation
  APP_OPEN_PROMPTER: 'app:open-prompter',
  APP_OPEN_STUDIO: 'app:open-studio',
  APP_TOGGLE_PROMPTER: 'app:toggle-prompter',
  APP_QUIT: 'app:quit',

  // Global Shortcuts Event
  SHORTCUT_TRIGGERED: 'shortcut:triggered'
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = IPC_CHANNELS;
}
