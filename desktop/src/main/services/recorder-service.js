/**
 * GhostPrompter Desktop — Native Screen & Video Recorder Service
 * Handles desktopCapturer source enumeration and native file export.
 */

const fs = require('fs');
const path = require('path');
let electronModule;
try {
  electronModule = require('electron');
} catch (e) {
  electronModule = null;
}

class RecorderService {
  constructor(storageService) {
    this.storage = storageService;
    this.activeSession = null;
  }

  async getSources() {
    if (!electronModule || !electronModule.desktopCapturer) {
      return [];
    }

    try {
      const sources = await electronModule.desktopCapturer.getSources({
        types: ['screen', 'window'],
        thumbnailSize: { width: 320, height: 180 },
        fetchWindowIcons: true
      });

      return sources.map(s => ({
        id: s.id,
        name: s.name,
        thumbnail: s.thumbnail ? s.thumbnail.toDataURL() : null,
        isScreen: s.id.startsWith('screen:')
      }));
    } catch (err) {
      console.warn('[RecorderService] Error acquiring desktopCapturer sources:', err.message);
      return [];
    }
  }

  async startSession(sessionId) {
    const tempDir = (electronModule && electronModule.app)
      ? electronModule.app.getPath('temp')
      : require('os').tmpdir();
    const safeName = `ghostprompter_take_${Date.now()}_${sessionId || 'rec'}.webm`;
    const tempPath = path.join(tempDir, safeName);

    try {
      const fileStream = fs.createWriteStream(tempPath, { flags: 'w' });
      this.activeSession = {
        id: sessionId,
        path: tempPath,
        stream: fileStream,
        totalBytes: 0,
        startTime: Date.now()
      };
      return { success: true, tempPath };
    } catch (err) {
      console.error('[RecorderService] Failed to start recording session:', err);
      return { success: false, error: err.message };
    }
  }

  appendChunk(buffer) {
    if (!this.activeSession || !this.activeSession.stream) {
      return false;
    }
    try {
      const nodeBuf = Buffer.from(buffer);
      this.activeSession.stream.write(nodeBuf);
      this.activeSession.totalBytes += nodeBuf.length;
      return true;
    } catch (err) {
      console.warn('[RecorderService] Error appending chunk:', err);
      return false;
    }
  }

  async finishSession() {
    if (!this.activeSession) {
      return { success: false, error: 'No active session' };
    }

    return new Promise((resolve) => {
      const session = this.activeSession;
      this.activeSession = null;

      session.stream.end(() => {
        resolve({
          success: true,
          tempPath: session.path,
          size: session.totalBytes,
          duration: Math.max(1, Math.round((Date.now() - session.startTime) / 1000))
        });
      });
    });
  }

  _getDefaultExportDir(app) {
    let customDir = null;
    try {
      if (this.storage && typeof this.storage.get === 'function') {
        const settings = this.storage.get('settings') || {};
        customDir = settings.recordingStoragePath;
      }
    } catch (e) {}

    const targetDir = customDir || 'D:\\facescreen recording';
    try {
      if (fs.existsSync(targetDir)) {
        return targetDir;
      }
      const rootDir = path.parse(targetDir).root;
      if (rootDir && fs.existsSync(rootDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
        return targetDir;
      }
    } catch (e) {
      // Fallback if drive/path is not writable or not available
    }
    return (app && app.getPath) ? (app.getPath('videos') || app.getPath('documents')) : '.';
  }

  async selectCustomExportDir() {
    if (!electronModule || !electronModule.dialog) return null;
    const { dialog } = electronModule;
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: 'Select Recording Storage Folder',
      properties: ['openDirectory', 'createDirectory']
    });
    if (!canceled && filePaths && filePaths[0]) {
      const selectedPath = filePaths[0];
      if (this.storage && typeof this.storage.set === 'function') {
        const settings = this.storage.get('settings') || {};
        settings.recordingStoragePath = selectedPath;
        settings.recordingStorageName = path.basename(selectedPath);
        this.storage.set('settings', settings);
      }
      return selectedPath;
    }
    return null;
  }

  resetExportDir() {
    if (this.storage && typeof this.storage.set === 'function') {
      const settings = this.storage.get('settings') || {};
      settings.recordingStoragePath = 'D:\\facescreen recording';
      settings.recordingStorageName = 'facescreen recording';
      this.storage.set('settings', settings);
    }
    return this._getDefaultExportDir();
  }

  async exportSessionToFile(tempPath, defaultName = 'GhostPrompter_Take.webm') {
    if (!electronModule || !electronModule.dialog) {
      return { success: false, error: 'dialog not available' };
    }

    const { dialog, app } = electronModule;
    const baseDir = this._getDefaultExportDir(app);
    const { canceled, filePath } = await dialog.showSaveDialog({
      title: 'Export Recording Take',
      defaultPath: path.join(baseDir, defaultName),
      filters: [
        { name: 'WebM Video', extensions: ['webm'] },
        { name: 'MP4 Video', extensions: ['mp4'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    });

    if (canceled || !filePath) {
      return { success: false, canceled: true };
    }

    try {
      if (tempPath && fs.existsSync(tempPath)) {
        fs.copyFileSync(tempPath, filePath);
        try { fs.unlinkSync(tempPath); } catch (e) {}
      }
      return { success: true, filePath };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  discardSession(tempPath) {
    try {
      if (tempPath && fs.existsSync(tempPath)) {
        fs.unlinkSync(tempPath);
      }
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  async exportTakeToFile(buffer, defaultName = 'GhostPrompter_Take.webm') {
    if (!electronModule || !electronModule.dialog) {
      return { success: false, error: 'dialog not available' };
    }

    const { dialog, app } = electronModule;
    const baseDir = this._getDefaultExportDir(app);
    const { canceled, filePath } = await dialog.showSaveDialog({
      title: 'Export Recording Take',
      defaultPath: path.join(baseDir, defaultName),
      filters: [
        { name: 'WebM Video', extensions: ['webm'] },
        { name: 'MP4 Video', extensions: ['mp4'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    });

    if (canceled || !filePath) {
      return { success: false, canceled: true };
    }

    try {
      fs.writeFileSync(filePath, Buffer.from(buffer));
      return { success: true, filePath };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
}

module.exports = RecorderService;
