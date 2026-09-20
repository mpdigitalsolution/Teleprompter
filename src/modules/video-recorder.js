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
      this.mediaStream = null;
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
    getVideoConstraints() {
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

      return {
        width: { ideal: width },
        height: { ideal: height },
        frameRate: { ideal: 30, max: 60 }
      };
    }

    /**
     * Request webcam & microphone permissions and acquire hardware MediaStream
     */
    async startCamera() {
      if (typeof navigator === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('getUserMedia is not supported in this environment');
      }

      if (this.mediaStream && this.mediaStream.active) {
        return this.mediaStream;
      }

      const videoConstraints = this.getVideoConstraints();
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
        this.setupAudioAnalyser(this.mediaStream);
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
     */
    async startRecordingWithCountdown() {
      if (this.state === 'recording' || this.state === 'counting_down') return;

      if (!this.mediaStream || !this.mediaStream.active) {
        await this.startCamera();
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

      try {
        this.mediaRecorder = new MediaRecorder(this.mediaStream, options);
      } catch (e) {
        this.mediaRecorder = new MediaRecorder(this.mediaStream);
      }

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          this.recordedChunks.push(event.data);
        }
      };

      this.mediaRecorder.onstop = () => {
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

      // Request data chunks every 1 second (ensures smooth memory management)
      this.mediaRecorder.start(1000);
      this.state = 'recording';
      this.elapsedSeconds = 0;
      this.options.onStart();
      this.options.onTimeUpdate({
        elapsedSeconds: 0,
        formattedTime: '00:00'
      });

      this.timerInterval = setInterval(() => {
        if (this.state === 'recording') {
          this.elapsedSeconds += 1;
          this.options.onTimeUpdate({
            elapsedSeconds: this.elapsedSeconds,
            formattedTime: VideoRecorder.formatTime(this.elapsedSeconds)
          });
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

      if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
        this.mediaRecorder.stop();
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

      if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
        this.mediaRecorder.ondataavailable = null;
        this.mediaRecorder.onstop = null;
        this.mediaRecorder.stop();
      }

      this.recordedChunks = [];
      this.state = 'idle';
    }

    stopCamera() {
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
    }

    destroy() {
      this.stopRecording();
      this.stopCamera();
      if (this.recordedUrl) {
        URL.revokeObjectURL(this.recordedUrl);
      }
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
