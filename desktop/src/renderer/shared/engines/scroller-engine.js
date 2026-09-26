/**
 * GhostPrompter Desktop — 60fps Physics Autoscroll Engine
 * Low-resource, sub-pixel interpolated smooth scrolling for desktop teleprompting.
 */

const _raf = typeof requestAnimationFrame !== 'undefined' 
  ? requestAnimationFrame 
  : (cb) => setTimeout(() => cb(Date.now()), 16);

const _caf = typeof cancelAnimationFrame !== 'undefined' 
  ? cancelAnimationFrame 
  : (id) => clearTimeout(id);

class ScrollerEngine {
  constructor(viewportEl, options = {}) {
    this.viewport = viewportEl;
    this.speedWPM = options.speedWPM || 160;
    this.isPlaying = false;
    this.rafId = null;
    this.lastTimestamp = null;
    this.currentScrollY = 0;
    this.avgCharsPerWord = 5;
    this.avgWordsPerLine = 8;
    this.lineHeightPx = options.lineHeightPx || 40;

    this.onStateChange = options.onStateChange || (() => {});
    this.onProgress = options.onProgress || (() => {});
  }

  calculatePixelsPerSecond() {
    // 160 WPM ≈ 2.67 words/sec. With ~8 words/line and 40px lineHeight ≈ 13.3 px/sec
    const wordsPerSecond = this.speedWPM / 60;
    const linesPerSecond = wordsPerSecond / this.avgWordsPerLine;
    return Math.max(10, linesPerSecond * this.lineHeightPx);
  }

  play() {
    if (this.isPlaying) return;
    this.isPlaying = true;
    this.lastTimestamp = null;
    if (this.viewport) {
      this.currentScrollY = this.viewport.scrollTop;
    }
    this.onStateChange(true);
    this._tick = this._tick.bind(this);
    this.rafId = _raf(this._tick);
  }

  pause() {
    if (!this.isPlaying) return;
    this.isPlaying = false;
    if (this.rafId) {
      _caf(this.rafId);
      this.rafId = null;
    }
    this.lastTimestamp = null;
    this.onStateChange(false);
  }

  toggle() {
    if (this.isPlaying) this.pause();
    else this.play();
    return this.isPlaying;
  }

  setSpeed(wpm) {
    this.speedWPM = Math.max(20, Math.min(600, wpm));
    return this.speedWPM;
  }

  syncScroll() {
    if (this.viewport) {
      this.currentScrollY = this.viewport.scrollTop;
    }
  }

  seek(scrollTop) {
    if (!this.viewport) return;
    this.currentScrollY = scrollTop;
    this.viewport.scrollTop = scrollTop;
  }

  _tick(timestamp) {
    if (!this.isPlaying || !this.viewport) return;

    if (!this.lastTimestamp) {
      this.lastTimestamp = timestamp;
      this.rafId = _raf(this._tick);
      return;
    }

    // Clamp delta to prevent jump after background tabs or window drag
    const deltaMs = Math.min(100, timestamp - this.lastTimestamp);
    this.lastTimestamp = timestamp;

    const pxPerSec = this.calculatePixelsPerSecond();
    const scrollDelta = (pxPerSec * deltaMs) / 1000;

    // Detect user manual wheel or touchpad intervention during playback
    if (Math.abs(this.viewport.scrollTop - this.currentScrollY) > 8) {
      this.currentScrollY = this.viewport.scrollTop;
    }

    this.currentScrollY += scrollDelta;

    const maxScroll = Math.max(0, this.viewport.scrollHeight - this.viewport.clientHeight);
    if (this.currentScrollY >= maxScroll - 1) {
      this.viewport.scrollTop = maxScroll;
      this.currentScrollY = maxScroll;
      this.pause();
      return;
    }

    this.viewport.scrollTop = this.currentScrollY;
    this.onProgress(this.viewport.scrollTop, maxScroll);

    this.rafId = _raf(this._tick);
  }

  destroy() {
    this.pause();
    this.viewport = null;
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = ScrollerEngine;
}
