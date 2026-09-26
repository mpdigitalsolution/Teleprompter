/**
 * GhostPrompter Video Recorder Engine
 * Hardware-accelerated webcam & microphone recording with stealth separation (teleprompter text is never recorded).
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.VideoRecorder = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {

  class VideoRecorder {
    constructor(options = {}) {
      this.options = {
        videoQuality: options.videoQuality || '1080p', // '1080p' | '720p'
        aspectRatio: options.aspectRatio || '16:9',    // '16:9' | '9:16' | '1:1'
        mirror: options.mirror !== undefined ? options.mirror : true,
        countdownSeconds: options.countdownSeconds !== undefined ? options.countdownSeconds : 3,
        onCountdown: options.onCountdown || (() => {}),
        onStart: options.onStart || (() => {}),
        onTimeUpdate: options.onTimeUpdate || (() => {}),
        onStop: options.onStop || (() => {}),
        onError: options.onError || (() => {}),
        onAudioLevel: options.onAudioLevel || (() => {}),
        ...options
      };

      this.state = 'idle'; // 'idle' | 'counting_down' | 'recording' | 'paused' | 'stopped'
      this.sourceType = options.sourceType || 'camera'; // 'camera' | 'screen'
      this.mediaStream = null;
      this.micStream = null;
      this.mediaRecorder = null;
      this.recordedChunks = [];
      this.recordedBlob = null;
      this.recordedUrl = null;

      this.timerInterval = null;
      this.elapsedSeconds = 0;
      this.countdownInterval = null;

      this.audioContext = null;
      this.analyser = null;
      this.audioLevelInterval = null;
    }

    /**
     * Switch active source type ('camera' or 'screen')
     */
    setSourceType(sourceType) {
      if (sourceType === 'screen' || sourceType === 'camera') {
        this.sourceType = sourceType;
      }
      return this.sourceType;
    }

    /**
     * Determine best supported MIME type for hardware-accelerated encoding
     */
    static getSupportedMimeType() {
      if (typeof MediaRecorder === 'undefined' || !MediaRecorder.isTypeSupported) {
        return 'video/webm';
      }

      const candidateTypes = [
        'video/webm;codecs=vp9,opus',
        'video/webm;codecs=vp8,opus',
        'video/webm;codecs=h264,opus',
        'video/webm',
        'video/mp4;codecs=avc1,mp4a.40.2',
        'video/mp4'
      ];

      for (const type of candidateTypes) {
        if (MediaRecorder.isTypeSupported(type)) {
          return type;
        }
      }

      return '';
    }

    /**
     * Compute video resolution constraints based on quality and aspect ratio
     */
    getVideoConstraints(preferredDeviceId = null) {
      const is1080 = this.options.videoQuality === '1080p';
      const baseLong = is1080 ? 1920 : 1280;
      const baseShort = is1080 ? 1080 : 720;

      let width = baseLong;
      let height = baseShort;

      if (this.options.aspectRatio === '9:16') {
        width = baseShort;
        height = baseLong;
      } else if (this.options.aspectRatio === '1:1') {
        width = baseShort;
        height = baseShort;
      }

      const constraints = {
        width: { ideal: width },
        height: { ideal: height },
        frameRate: { ideal: 30, max: 30 }
      };

      const devId = preferredDeviceId || this.options.deviceId;
      if (devId) {
        constraints.deviceId = { exact: devId };
      }

      return constraints;
    }

    /**
     * Request webcam & microphone permissions and acquire hardware MediaStream
     */
    async startCamera(preferredDeviceId = null) {
      if (typeof navigator === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('getUserMedia is not supported in this environment');
      }

      if (preferredDeviceId && this.mediaStream) {
        this.stopCamera();
      }

      if (this.mediaStream && this.mediaStream.active) {
        return this.mediaStream;
      }

      const videoConstraints = this.getVideoConstraints(preferredDeviceId);
      const constraints = {
        video: videoConstraints,
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      };

      try {
        this.mediaStream = await navigator.mediaDevices.getUserMedia(constraints);

        // Hardware auto-enhancement: continuous focus & exposure if supported by sensor
        const track = this.mediaStream.getVideoTracks()[0];
        if (track && typeof track.getCapabilities === 'function' && typeof track.applyConstraints === 'function') {
          try {
            const caps = track.getCapabilities();
            const advanced = [];
            if (caps.focusMode && Array.isArray(caps.focusMode) && caps.focusMode.includes('continuous')) {
              advanced.push({ focusMode: 'continuous' });
            }
            if (caps.exposureMode && Array.isArray(caps.exposureMode) && caps.exposureMode.includes('continuous')) {
              advanced.push({ exposureMode: 'continuous' });
            }
            if (caps.whiteBalanceMode && Array.isArray(caps.whiteBalanceMode) && caps.whiteBalanceMode.includes('continuous')) {
              advanced.push({ whiteBalanceMode: 'continuous' });
            }
            if (advanced.length > 0) {
              await track.applyConstraints({ advanced });
            }
          } catch (e) {}
        }

        this.setupAudioAnalyser(this.mediaStream);
        return this.mediaStream;
      } catch (err) {
        this.options.onError(err);
        throw err;
      }
    }

    /**
     * Request Tab, Window, or Screen sharing via Chrome's native getDisplayMedia picker
     */
    async startScreenCapture(options = {}) {
      if (typeof navigator === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
        throw new Error('getDisplayMedia is not supported in this environment');
      }

      if (this.mediaStream && this.mediaStream.active && this.sourceType === 'screen') {
        return this.mediaStream;
      }

      const captureMic = options.captureMic !== undefined ? options.captureMic : true;
      const captureSystemAudio = options.captureSystemAudio !== undefined ? options.captureSystemAudio : true;

      try {
        // 1. Trigger Chrome's native "Choose what to share" picker
        const displayStream = await navigator.mediaDevices.getDisplayMedia({
          video: {
            cursor: 'always',
            displaySurface: 'monitor',
            frameRate: { max: 30, ideal: 30 }
          },
          audio: captureSystemAudio
        });
        this.displayStream = displayStream;

        const screenVideoTrack = displayStream.getVideoTracks()[0];
        if (!screenVideoTrack) {
          throw new Error('No video track acquired from screen capture');
        }

        // Handle when user clicks Chrome's native "Stop sharing" blue bar
        screenVideoTrack.addEventListener('ended', () => {
          if (this.state === 'recording') {
            this.stopRecording();
          }
        });

        let finalAudioTracks = [];

        // 2. Optionally capture presenter's microphone voiceover and mix with tab audio
        if (captureMic && navigator.mediaDevices.getUserMedia) {
          try {
            this.micStream = await navigator.mediaDevices.getUserMedia({
              audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true
              }
            });

            this.setupAudioAnalyser(this.micStream);

            const displayAudioTracks = displayStream.getAudioTracks();
            const micAudioTracks = this.micStream.getAudioTracks();

            if (displayAudioTracks.length > 0 && (typeof AudioContext !== 'undefined' || typeof webkitAudioContext !== 'undefined')) {
              // Mix both tab/system audio and mic audio into a unified audio track
              if (this.mixAudioContext && this.mixAudioContext.state !== 'closed') {
                try { this.mixAudioContext.close(); } catch (e) {}
              }
              const AudioCtx = window.AudioContext || window.webkitAudioContext;
              this.mixAudioContext = new AudioCtx();
              const dest = this.mixAudioContext.createMediaStreamDestination();

              const displaySource = this.mixAudioContext.createMediaStreamSource(new MediaStream([displayAudioTracks[0]]));
              const micSource = this.mixAudioContext.createMediaStreamSource(new MediaStream([micAudioTracks[0]]));

              displaySource.connect(dest);
              micSource.connect(dest);

              finalAudioTracks = dest.stream.getAudioTracks();
            } else if (micAudioTracks.length > 0) {
              finalAudioTracks = micAudioTracks;
            } else if (displayAudioTracks.length > 0) {
              finalAudioTracks = displayAudioTracks;
            }
          } catch (micErr) {
            console.warn('Microphone capture failed or denied, recording system audio only:', micErr);
            finalAudioTracks = displayStream.getAudioTracks();
          }
        } else {
          finalAudioTracks = displayStream.getAudioTracks();
        }

        // 3. Assemble combined MediaStream (Screen video + mixed/mic audio)
        if (typeof MediaStream !== 'undefined') {
          this.mediaStream = new MediaStream([screenVideoTrack, ...finalAudioTracks]);
        } else {
          this.mediaStream = displayStream;
        }
        this.sourceType = 'screen';
        return this.mediaStream;
      } catch (err) {
        this.options.onError(err);
        throw err;
      }
    }

    /**
     * Setup audio visualizer analyzer using Web Audio API
     */
    setupAudioAnalyser(stream) {
      if (typeof AudioContext === 'undefined' && typeof webkitAudioContext === 'undefined') {
        return;
      }

      const audioTracks = stream.getAudioTracks();
      if (!audioTracks || audioTracks.length === 0) return;

      try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        this.audioContext = new AudioCtx();
        const source = this.audioContext.createMediaStreamSource(stream);
        this.analyser = this.audioContext.createAnalyser();
        this.analyser.fftSize = 64;
        source.connect(this.analyser);

        const dataArray = new Uint8Array(this.analyser.frequencyBinCount);

        this.audioLevelInterval = setInterval(() => {
          if (!this.analyser) return;
          this.analyser.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
          }
          const avg = sum / dataArray.length;
          const level = Math.min(100, Math.round((avg / 128) * 100));
          this.options.onAudioLevel(level);
        }, 80);
      } catch (e) {
        // Audio analyser optional fallback
      }
    }

    /**
     * Start recording with a 3... 2... 1... countdown
     * @param {string|null} sourceType - 'camera' | 'screen' | null
     */
    async startRecordingWithCountdown(sourceType = null) {
      if (this.state === 'recording' || this.state === 'counting_down') return;

      if (sourceType) {
        this.sourceType = sourceType;
      }

      if (!this.mediaStream || !this.mediaStream.active) {
        if (this.sourceType === 'screen') {
          await this.startScreenCapture();
        } else {
          await this.startCamera();
        }
      }

      this.state = 'counting_down';
      let remaining = this.options.countdownSeconds;
      this.options.onCountdown(remaining);

      return new Promise((resolve) => {
        this.countdownInterval = setInterval(() => {
          remaining -= 1;
          if (remaining > 0) {
            this.options.onCountdown(remaining);
          } else {
            clearInterval(this.countdownInterval);
            this.countdownInterval = null;
            this.options.onCountdown(0);
            this.startRecordingInternal();
            resolve();
          }
        }, 1000);
      });
    }

    /**
     * Immediate recording trigger
     */
    async startRecording() {
      if (this.state === 'recording') return;

      if (!this.mediaStream || !this.mediaStream.active) {
        await this.startCamera();
      }

      this.startRecordingInternal();
    }

    startRecordingInternal() {
      this.recordedChunks = [];
      this.recordedBlob = null;
      if (this.recordedUrl) {
        URL.revokeObjectURL(this.recordedUrl);
        this.recordedUrl = null;
      }

      const mimeType = VideoRecorder.getSupportedMimeType();
      const options = mimeType ? { mimeType } : {};

      // Ultra-efficient bitrate for low-end hardware: prevents CPU spikes, encoder freezes, and memory bloat
      if (this.sourceType === 'screen') {
        options.videoBitsPerSecond = 1500000; // 1.5 Mbps: Crisp 1080p screen capture with ultra-low CPU load
      } else {
        options.videoBitsPerSecond = 1200000; // 1.2 Mbps: Crisp webcam stream
      }

      try {
        this.mediaRecorder = new MediaRecorder(this.mediaStream, options);
      } catch (e) {
        try {
          this.mediaRecorder = new MediaRecorder(this.mediaStream, mimeType ? { mimeType } : {});
        } catch (e2) {
          this.mediaRecorder = new MediaRecorder(this.mediaStream);
        }
      }

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          this.recordedChunks.push(event.data);
        }
      };

      this.mediaRecorder.onstop = () => {
        // Automatically stop screen sharing immediately so the shared tab indicator stops
        if (this.sourceType === 'screen') {
          this.stopScreenShare();
        }

        const type = this.mediaRecorder.mimeType || 'video/webm';
        this.recordedBlob = new Blob(this.recordedChunks, { type });
        if (typeof URL !== 'undefined' && URL.createObjectURL) {
          this.recordedUrl = URL.createObjectURL(this.recordedBlob);
        }

        const durationSeconds = this.elapsedSeconds;
        const fileSizeFormatted = VideoRecorder.formatFileSize(this.recordedBlob.size);

        this.options.onStop({
          blob: this.recordedBlob,
          url: this.recordedUrl,
          durationSeconds,
          formattedTime: VideoRecorder.formatTime(durationSeconds),
          fileSizeFormatted,
          fileSizeBytes: this.recordedBlob.size,
          mimeType: type
        });
      };

      // Request data chunks every 1 second (ensures progressive streaming and instant assembly)
      this.mediaRecorder.start(1000);
      this.state = 'recording';
      this.elapsedSeconds = 0;
      this.options.onStart();
      if (typeof this.options.onTimeUpdate === 'function') {
        this.options.onTimeUpdate(0, '00:00');
      }

      this.timerInterval = setInterval(() => {
        if (this.state === 'recording') {
          this.elapsedSeconds += 1;
          const formatted = VideoRecorder.formatTime(this.elapsedSeconds);
          if (typeof this.options.onTimeUpdate === 'function') {
            this.options.onTimeUpdate(this.elapsedSeconds, formatted);
          }
        }
      }, 1000);
    }

    pauseRecording() {
      if (this.state === 'recording' && this.mediaRecorder && this.mediaRecorder.state === 'recording') {
        this.mediaRecorder.pause();
        this.state = 'paused';
      }
    }

    resumeRecording() {
      if (this.state === 'paused' && this.mediaRecorder && this.mediaRecorder.state === 'paused') {
        this.mediaRecorder.resume();
        this.state = 'recording';
      }
    }

    stopRecording() {
      if (this.countdownInterval) {
        clearInterval(this.countdownInterval);
        this.countdownInterval = null;
      }

      if (this.timerInterval) {
        clearInterval(this.timerInterval);
        this.timerInterval = null;
      }

      if (this.audioLevelInterval) {
        clearInterval(this.audioLevelInterval);
        this.audioLevelInterval = null;
      }

      if (this.mixAudioContext && this.mixAudioContext.state !== 'closed') {
        try { this.mixAudioContext.close(); } catch (e) {}
        this.mixAudioContext = null;
      }

      if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
        try {
          this.mediaRecorder.stop();
        } catch (e) {}
      }

      // Automatically terminate screen share session so Chrome stops sharing the tab
      if (this.sourceType === 'screen') {
        this.stopScreenShare();
      }

      this.state = 'stopped';
    }

    cancelRecording() {
      if (this.countdownInterval) {
        clearInterval(this.countdownInterval);
        this.countdownInterval = null;
      }

      if (this.timerInterval) {
        clearInterval(this.timerInterval);
        this.timerInterval = null;
      }

      if (this.audioLevelInterval) {
        clearInterval(this.audioLevelInterval);
        this.audioLevelInterval = null;
      }

      if (this.mixAudioContext && this.mixAudioContext.state !== 'closed') {
        try { this.mixAudioContext.close(); } catch (e) {}
        this.mixAudioContext = null;
      }

      if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
        this.mediaRecorder.ondataavailable = null;
        this.mediaRecorder.onstop = null;
        try { this.mediaRecorder.stop(); } catch (e) {}
      }

      if (this.sourceType === 'screen') {
        this.stopScreenShare();
      }

      this.recordedChunks = [];
      this.state = 'idle';
    }

    /**
     * Stop and release active screen sharing session (tab, window, or monitor)
     */
    stopScreenShare() {
      if (this.mixAudioContext && this.mixAudioContext.state !== 'closed') {
        try { this.mixAudioContext.close(); } catch (e) {}
        this.mixAudioContext = null;
      }

      if (this.displayStream) {
        try {
          this.displayStream.getTracks().forEach(track => {
            track.stop();
          });
        } catch (e) {}
        this.displayStream = null;
      }

      if (this.mediaStream && this.sourceType === 'screen') {
        try {
          this.mediaStream.getTracks().forEach(track => {
            track.stop();
          });
        } catch (e) {}
        this.mediaStream = null;
      }

      if (this.micStream && this.sourceType === 'screen') {
        try {
          this.micStream.getTracks().forEach(track => {
            track.stop();
          });
        } catch (e) {}
        this.micStream = null;
      }
    }

    stopCamera() {
      this.stopScreenShare();

      if (this.audioLevelInterval) {
        clearInterval(this.audioLevelInterval);
        this.audioLevelInterval = null;
      }

      if (this.audioContext && this.audioContext.state !== 'closed') {
        try {
          this.audioContext.close();
        } catch (e) {}
      }

      if (this.mediaStream) {
        this.mediaStream.getTracks().forEach(track => track.stop());
        this.mediaStream = null;
      }

      if (this.micStream) {
        this.micStream.getTracks().forEach(track => track.stop());
        this.micStream = null;
      }
    }

    stopCapture() {
      this.stopScreenShare();
      this.stopCamera();
    }

    destroy() {
      this.stopRecording();
      this.stopCamera();
      if (this.recordedUrl) {
        URL.revokeObjectURL(this.recordedUrl);
      }
    }

    /**
     * Retrieve stored FileSystemDirectoryHandle from IndexedDB
     */
    static async getSavedDirectoryHandle() {
      if (typeof indexedDB === 'undefined') return null;
      return new Promise((resolve) => {
        try {
          const req = indexedDB.open('GhostPrompterFS', 1);
          req.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains('handles')) {
              db.createObjectStore('handles');
            }
          };
          req.onsuccess = (e) => {
            const db = e.target.result;
            try {
              const tx = db.transaction('handles', 'readonly');
              const store = tx.objectStore('handles');
              const getReq = store.get('recordingDirectory');
              getReq.onsuccess = () => resolve(getReq.result || null);
              getReq.onerror = () => resolve(null);
            } catch (err) {
              resolve(null);
            }
          };
          req.onerror = () => resolve(null);
        } catch (err) {
          resolve(null);
        }
      });
    }

    /**
     * Store FileSystemDirectoryHandle into IndexedDB for persistent saving to D:\facescreen recording
     */
    static async saveDirectoryHandle(handle) {
      if (typeof indexedDB === 'undefined' || !handle) return false;
      return new Promise((resolve) => {
        try {
          const req = indexedDB.open('GhostPrompterFS', 1);
          req.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains('handles')) {
              db.createObjectStore('handles');
            }
          };
          req.onsuccess = (e) => {
            const db = e.target.result;
            try {
              const tx = db.transaction('handles', 'readwrite');
              const store = tx.objectStore('handles');
              const putReq = store.put(handle, 'recordingDirectory');
              putReq.onsuccess = () => resolve(true);
              putReq.onerror = () => resolve(false);
            } catch (err) {
              resolve(false);
            }
          };
          req.onerror = () => resolve(false);
        } catch (err) {
          resolve(false);
        }
      });
    }

    /**
     * Trigger native folder picker to select storage directory (e.g. D:\facescreen recording)
     */
    static async selectStorageDirectory() {
      if (typeof window === 'undefined' || !window.showDirectoryPicker) {
        return null;
      }
      try {
        const dirHandle = await window.showDirectoryPicker({
          id: 'facescreen-recordings',
          mode: 'readwrite',
          startIn: 'documents'
        });
        if (dirHandle) {
          await VideoRecorder.saveDirectoryHandle(dirHandle);
          return dirHandle;
        }
      } catch (err) {
        // User cancelled or browser rejected
      }
      return null;
    }

    /**
     * Save recording directly to target storage (e.g. D:\facescreen recording)
     */
    static async saveVideoFile(blob, filename, preferredHandle = null) {
      if (!blob) return { success: false, error: 'No blob provided' };

      const dateStr = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const ext = blob.type && blob.type.includes('mp4') ? 'mp4' : 'webm';
      const finalFilename = filename || `ghostprompter-video-${dateStr}.${ext}`;

      // 1. Try File System Access API with stored directory handle (D:\facescreen recording)
      let dirHandle = preferredHandle || await VideoRecorder.getSavedDirectoryHandle();

      if (dirHandle) {
        try {
          let perm = typeof dirHandle.queryPermission === 'function' ?
            await dirHandle.queryPermission({ mode: 'readwrite' }) : 'granted';

          if (perm !== 'granted' && typeof dirHandle.requestPermission === 'function') {
            perm = await dirHandle.requestPermission({ mode: 'readwrite' });
          }

          if (perm === 'granted') {
            const fileHandle = await dirHandle.getFileHandle(finalFilename, { create: true });
            const writable = await fileHandle.createWritable();
            await writable.write(blob);
            await writable.close();
            return {
              success: true,
              method: 'direct_disk',
              directory: dirHandle.name || 'facescreen recording',
              filename: finalFilename
            };
          }
        } catch (err) {
          console.warn('Failed to write directly to directory handle, falling back:', err);
        }
      }

      // 2. If no directory handle or permission denied, check if showSaveFilePicker is available
      if (typeof window !== 'undefined' && window.showSaveFilePicker) {
        try {
          const fileHandle = await window.showSaveFilePicker({
            suggestedName: finalFilename,
            types: [{
              description: 'Video File',
              accept: { [blob.type || 'video/webm']: ['.webm', '.mp4'] }
            }]
          });
          const writable = await fileHandle.createWritable();
          await writable.write(blob);
          await writable.close();
          return {
            success: true,
            method: 'file_picker',
            directory: 'Selected Folder',
            filename: fileHandle.name || finalFilename
          };
        } catch (pickerErr) {
          if (pickerErr.name === 'AbortError') {
            return { success: false, aborted: true };
          }
        }
      }

      // 3. Fallback to standard browser download
      VideoRecorder.downloadBlob(blob, finalFilename);
      return {
        success: true,
        method: 'browser_download',
        directory: 'Downloads',
        filename: finalFilename
      };
    }

    /**
     * Download helper
     */
    static downloadBlob(blob, filename) {
      if (!blob || typeof document === 'undefined') return;

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;

      const dateStr = new Date().toISOString().slice(0, 10);
      const timeStr = new Date().toTimeString().slice(0, 5).replace(':', '');
      const ext = blob.type.includes('mp4') ? 'mp4' : 'webm';

      a.download = filename || `ghostprompter-video-${dateStr}-${timeStr}.${ext}`;
      document.body.appendChild(a);
      a.click();

      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 500);
    }

    static formatTime(totalSeconds) {
      const mins = Math.floor(totalSeconds / 60);
      const secs = totalSeconds % 60;
      return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }

    static formatFileSize(bytes) {
      if (!bytes || bytes === 0) return '0 B';
      const k = 1024;
      const sizes = ['B', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
    }
  }

  return VideoRecorder;
});
