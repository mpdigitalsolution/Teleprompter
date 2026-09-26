/**
 * GhostPrompter Content Script
 * Injects and manages the high-contrast stealth Heads-Up Display (HUD) inside an isolated Shadow DOM.
 * Features solid high-visibility theme with one-click transparency controls.
 */

(function () {
  // Prevent duplicate injection
  if (window.__GHOST_PROMPTER_INITIALIZED__) {
    if (window.GhostPrompter && window.GhostPrompter.toggle) {
      window.GhostPrompter.toggle();
    }
    return;
  }
  window.__GHOST_PROMPTER_INITIALIZED__ = true;

  let hostEl = null;
  let shadowRoot = null;
  let windowEl = null;
  let viewportEl = null;
  let scriptBodyEl = null;
  let isPlaying = false;
  let isGhostMode = false;
  let isMirrorMode = false;
  let isSolidMode = true; // High visibility solid mode by default
  let isTransparentMode = false; // Dedicated transparent glass mode
  let currentSettings = null;
  let currentScript = null;
  let scrollAnimFrame = null;
  let scrollVelocity = 0;
  let videoRecorderInstance = null;
  let activePiPInstance = null;
  let isRecording = false;
  let isCountingDown = false;
  let currentRecordedBlob = null;
  let currentRecordedUrl = null;

  // High-visibility default settings
  const defaultState = {
    opacity: 0.94, // 94% solid dark background by default
    fontSize: 24,
    textColor: '#00F0FF',
    lineHeight: 1.6,
    wpm: 130,
    trackingMode: 'auto',
    isTransparentMode: false,
    transparencyPreset: 'solid',
    isToolbarCollapsed: true,
    window: { x: null, y: 24, width: 680, height: 290 }
  };

  /**
   * Complete embedded stylesheet (guarantees 100% styled rendering even on strict CSP sites)
   */
  const EMBEDDED_STYLES = `
/* GhostPrompter Isolated Shadow DOM Stylesheet — Apple Design Language (macOS / visionOS) */

:host {
  all: initial;
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 2147483647;
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "Helvetica Neue", Roboto, sans-serif;
  -webkit-font-smoothing: antialiased;
  box-sizing: border-box;
}

*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
  user-select: none;
}

/* Floating Prompter Window — macOS / visionOS Frosted Vibrancy */
.gp-window {
  position: fixed;
  display: flex;
  flex-direction: column;
  border-radius: 16px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.15);
  box-shadow: 
    0 24px 60px rgba(0, 0, 0, 0.6),
    0 4px 16px rgba(0, 0, 0, 0.35),
    inset 0 1px 0 rgba(255, 255, 255, 0.18);
  transition: box-shadow 0.25s ease, opacity 0.2s ease, background-color 0.2s ease, border-color 0.2s ease, border-radius 0.2s ease;
  pointer-events: auto;
  background-color: rgba(28, 28, 30, 0.88);
  backdrop-filter: blur(12px) saturate(160%);
  -webkit-backdrop-filter: blur(12px) saturate(160%);
  transform: translateZ(0);
  backface-visibility: hidden;
  will-change: transform;
}

.gp-window.gp-transparent-mode {
  background-color: rgba(18, 18, 20, 0.24) !important;
  backdrop-filter: blur(14px) saturate(180%) !important;
  -webkit-backdrop-filter: blur(14px) saturate(180%) !important;
  border: 1px solid rgba(255, 255, 255, 0.22) !important;
  box-shadow: 
    0 16px 40px rgba(0, 0, 0, 0.4),
    inset 0 1px 0 rgba(255, 255, 255, 0.18) !important;
}

.gp-window.gp-transparent-mode .gp-viewport {
  background-color: transparent !important;
}

.gp-window.gp-transparent-mode .gp-header {
  background: rgba(30, 30, 34, 0.5) !important;
  backdrop-filter: blur(16px) !important;
  -webkit-backdrop-filter: blur(16px) !important;
  border-bottom: 1px solid rgba(255, 255, 255, 0.12) !important;
}

.gp-window.gp-transparent-mode .gp-toolbar {
  background: rgba(30, 30, 34, 0.6) !important;
  backdrop-filter: blur(16px) !important;
  -webkit-backdrop-filter: blur(16px) !important;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1) !important;
}

.gp-window.gp-transparent-mode .gp-script-body {
  font-weight: 600 !important;
  text-shadow: 
    0 1px 3px rgba(0, 0, 0, 0.95),
    0 2px 8px rgba(0, 0, 0, 0.85),
    -1px -1px 0 rgba(0, 0, 0, 0.8),
     1px -1px 0 rgba(0, 0, 0, 0.8),
    -1px  1px 0 rgba(0, 0, 0, 0.8),
     1px  1px 0 rgba(0, 0, 0, 0.8) !important;
}

.gp-window.gp-ghost-mode {
  pointer-events: none !important;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4), inset 0 0 0 1px rgba(10, 132, 255, 0.4) !important;
  background-color: rgba(18, 18, 20, 0.2) !important;
}

.gp-window.gp-ghost-mode .gp-ghost-pill {
  pointer-events: auto !important;
}

/* Minimized Compact Floating Pill Mode */
.gp-window.gp-minimized {
  height: auto !important;
  min-height: 38px !important;
  max-height: 40px !important;
  border-radius: 980px !important;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.22) !important;
  overflow: hidden !important;
}

.gp-window.gp-minimized .gp-viewport,
.gp-window.gp-minimized .gp-toolbar,
.gp-window.gp-minimized .gp-resize-handle,
.gp-window.gp-minimized .gp-countdown-overlay,
.gp-window.gp-minimized .gp-rec-modal,
.gp-window.gp-minimized .gp-rec-choice-modal {
  display: none !important;
}

.gp-window.gp-minimized #gp-btn-minimize {
  display: none !important;
}

.gp-window.gp-minimized .gp-header {
  border-bottom: none !important;
  border-radius: 980px !important;
}

.gp-window.gp-minimized .gp-expand-indicator {
  display: inline-flex !important;
}

/* Header & macOS Traffic Lights */
.gp-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: calc(4px * var(--gp-scale, 1)) calc(12px * var(--gp-scale, 1));
  background: rgba(38, 38, 42, 0.65);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  cursor: grab;
  height: calc(38px * var(--gp-scale, 1));
  min-height: 26px;
  transition: background 0.2s ease;
  gap: calc(6px * var(--gp-scale, 1));
  overflow-x: hidden;
  box-sizing: border-box;
}

.gp-header:active {
  cursor: grabbing;
}

.gp-traffic-group {
  display: flex;
  align-items: center;
  gap: calc(5px * var(--gp-scale, 1));
  margin-right: calc(4px * var(--gp-scale, 1));
  flex-shrink: 0;
}

.gp-traffic-dot {
  width: calc(11px * var(--gp-scale, 1));
  height: calc(11px * var(--gp-scale, 1));
  border-radius: 50%;
  border: none;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: calc(8px * var(--gp-scale, 1));
  color: transparent;
  transition: transform 0.1s ease, color 0.1s ease;
  box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.15);
  padding: 0;
}

.gp-traffic-dot:hover {
  color: rgba(0, 0, 0, 0.65);
  transform: scale(1.08);
}

.gp-dot-close {
  background: #FF5F57;
}

.gp-dot-min {
  background: #FEBC2E;
}

.gp-dot-expand {
  background: #28C840;
}

.gp-brand {
  display: flex;
  align-items: center;
  gap: calc(6px * var(--gp-scale, 1));
  flex-shrink: 0;
  min-width: 0;
}

.gp-logo-icon {
  width: calc(18px * var(--gp-scale, 1));
  height: calc(18px * var(--gp-scale, 1));
  flex-shrink: 0;
  fill: #0A84FF;
  filter: drop-shadow(0 1px 4px rgba(10, 132, 255, 0.4));
}

.gp-title {
  font-size: calc(12.5px * var(--gp-scale, 1));
  font-weight: 600;
  letter-spacing: -0.01em;
  color: #FFFFFF;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.6);
  white-space: nowrap;
  flex-shrink: 1;
}

.gp-status-group {
  display: flex;
  align-items: center;
  gap: calc(5px * var(--gp-scale, 1));
  margin-left: calc(3px * var(--gp-scale, 1));
  margin-right: calc(4px * var(--gp-scale, 1));
  flex-shrink: 0;
}

.gp-badge {
  font-size: calc(9.5px * var(--gp-scale, 1));
  font-weight: 600;
  padding: calc(2px * var(--gp-scale, 1)) calc(6px * var(--gp-scale, 1));
  border-radius: calc(980px * var(--gp-scale, 1));
  text-transform: uppercase;
  letter-spacing: 0.3px;
  background: rgba(10, 132, 255, 0.15);
  color: #0A84FF;
  border: 1px solid rgba(10, 132, 255, 0.3);
  white-space: nowrap;
}

.gp-badge .gp-badge-short {
  display: none;
}

/* Indicators */
.gp-indicator {
  display: inline-flex;
  align-items: center;
  gap: calc(3px * var(--gp-scale, 1));
  font-size: calc(9.5px * var(--gp-scale, 1));
  color: rgba(235, 235, 245, 0.6);
  font-weight: 500;
  white-space: nowrap;
}

.gp-dot {
  width: calc(7px * var(--gp-scale, 1));
  height: calc(7px * var(--gp-scale, 1));
  border-radius: 50%;
  background: #636366;
  transition: all 0.2s ease;
  flex-shrink: 0;
}

.gp-dot.active-green {
  background: #30D158;
  box-shadow: 0 0 8px rgba(48, 209, 88, 0.7);
}

.gp-dot.active-cyan {
  background: #64D2FF;
  box-shadow: 0 0 8px rgba(100, 210, 255, 0.7);
}

.gp-dot.active-amber {
  background: #FFD60A;
  box-shadow: 0 0 8px rgba(255, 214, 10, 0.7);
}

/* Actions Header Bar */
.gp-actions {
  display: flex;
  align-items: center;
  gap: calc(4px * var(--gp-scale, 1));
  flex-shrink: 0;
  min-width: 0;
}

.gp-btn {
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.14);
  color: #FFFFFF;
  border-radius: calc(7px * var(--gp-scale, 1));
  padding: calc(3px * var(--gp-scale, 1)) calc(8px * var(--gp-scale, 1));
  font-size: calc(10.5px * var(--gp-scale, 1));
  font-weight: 600;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: calc(3px * var(--gp-scale, 1));
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
  transition: all 0.15s cubic-bezier(0.2, 0.8, 0.2, 1);
  white-space: nowrap;
  height: calc(24px * var(--gp-scale, 1));
  box-sizing: border-box;
  line-height: 1;
}

.gp-btn:hover {
  background: rgba(255, 255, 255, 0.16);
  border-color: rgba(255, 255, 255, 0.26);
}

.gp-btn:active {
  transform: scale(0.96);
}

.gp-btn.active {
  background: rgba(10, 132, 255, 0.25);
  color: #64D2FF;
  border-color: rgba(10, 132, 255, 0.5);
}

.gp-btn-icon {
  width: calc(24px * var(--gp-scale, 1));
  height: calc(24px * var(--gp-scale, 1));
  padding: 0;
  font-size: calc(11px * var(--gp-scale, 1));
  flex-shrink: 0;
}

/* Apple Play / Pause Button */
.gp-btn-autoscroll {
  background: linear-gradient(180deg, #30D158 0%, #24A143 100%) !important;
  color: #FFFFFF !important;
  font-weight: 700 !important;
  border: 1px solid rgba(255, 255, 255, 0.25) !important;
  box-shadow: 0 2px 8px rgba(48, 209, 88, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.3) !important;
  padding: calc(3px * var(--gp-scale, 1)) calc(8.5px * var(--gp-scale, 1)) !important;
  font-size: calc(10.5px * var(--gp-scale, 1)) !important;
  height: calc(24px * var(--gp-scale, 1)) !important;
}

.gp-btn-autoscroll:hover {
  filter: brightness(1.08) !important;
  box-shadow: 0 3px 12px rgba(48, 209, 88, 0.5) !important;
}

.gp-btn-autoscroll.gp-scrolling {
  background: linear-gradient(180deg, #FF9F0A 0%, #D97706 100%) !important;
  color: #FFFFFF !important;
  border-color: rgba(255, 255, 255, 0.3) !important;
  box-shadow: 0 2px 10px rgba(255, 159, 10, 0.45) !important;
  animation: gp-pulse 1.8s infinite;
}

.gp-btn-icon-symbol {
  font-size: calc(9.5px * var(--gp-scale, 1));
  line-height: 1;
  display: inline-flex;
  align-items: center;
}

.gp-btn-label {
  line-height: 1;
  display: inline-block;
}

@keyframes gp-pulse {
  0% { box-shadow: 0 0 6px rgba(255, 159, 10, 0.4); }
  50% { box-shadow: 0 0 16px rgba(255, 159, 10, 0.8); }
  100% { box-shadow: 0 0 6px rgba(255, 159, 10, 0.4); }
}

/* Speed Pill */
.gp-speed-pill {
  display: inline-flex;
  align-items: center;
  gap: calc(2px * var(--gp-scale, 1));
  background: rgba(118, 118, 128, 0.24);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: calc(6px * var(--gp-scale, 1));
  padding: calc(1.5px * var(--gp-scale, 1)) calc(5px * var(--gp-scale, 1));
  font-size: calc(10.5px * var(--gp-scale, 1));
  color: #FFFFFF;
  font-weight: 600;
  user-select: none;
  white-space: nowrap;
  height: calc(24px * var(--gp-scale, 1));
  box-sizing: border-box;
  font-family: -apple-system, "SF Mono", Monaco, monospace;
}

.gp-btn-tiny {
  width: calc(16px * var(--gp-scale, 1));
  height: calc(16px * var(--gp-scale, 1));
  padding: 0;
  background: rgba(255, 255, 255, 0.12);
  border: none;
  border-radius: calc(4px * var(--gp-scale, 1));
  color: #FFFFFF;
  font-size: calc(11px * var(--gp-scale, 1));
  font-weight: 700;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: all 0.1s ease;
}

.gp-btn-tiny:hover {
  background: rgba(255, 255, 255, 0.25);
}

.gp-btn-tiny:active {
  transform: scale(0.92);
}

/* Toolbar Panel */
.gp-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: calc(10px * var(--gp-scale, 1));
  padding: calc(8px * var(--gp-scale, 1)) calc(14px * var(--gp-scale, 1));
  background: rgba(30, 30, 32, 0.7);
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  font-size: calc(11px * var(--gp-scale, 1));
  color: rgba(235, 235, 245, 0.75);
  transition: max-height 0.25s ease, opacity 0.2s ease, padding 0.25s ease;
  overflow: hidden;
  max-height: 240px;
}

.gp-toolbar.collapsed {
  max-height: 0 !important;
  opacity: 0 !important;
  padding-top: 0 !important;
  padding-bottom: 0 !important;
  pointer-events: none !important;
  border-bottom: none !important;
  overflow: hidden !important;
}

.gp-preset-btn {
  background: rgba(255, 255, 255, 0.08) !important;
  border: 1px solid rgba(255, 255, 255, 0.12) !important;
  color: rgba(235, 235, 245, 0.8) !important;
  padding: calc(3px * var(--gp-scale, 1)) calc(8px * var(--gp-scale, 1)) !important;
  font-size: calc(10px * var(--gp-scale, 1)) !important;
  border-radius: calc(6px * var(--gp-scale, 1)) !important;
}

.gp-preset-btn.active {
  background: rgba(255, 255, 255, 0.22) !important;
  color: #FFFFFF !important;
  border-color: rgba(255, 255, 255, 0.3) !important;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.2) !important;
  font-weight: 700 !important;
}

.gp-ctrl-group {
  display: flex;
  align-items: center;
  gap: calc(6px * var(--gp-scale, 1));
}

.gp-ctrl-group label {
  font-size: calc(11px * var(--gp-scale, 1));
  color: rgba(235, 235, 245, 0.6);
  font-weight: 500;
}

.gp-range {
  -webkit-appearance: none;
  appearance: none;
  width: calc(70px * var(--gp-scale, 1));
  height: calc(4px * var(--gp-scale, 1));
  border-radius: 2px;
  background: rgba(255, 255, 255, 0.18);
  outline: none;
  cursor: pointer;
}

.gp-range::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: calc(12px * var(--gp-scale, 1));
  height: calc(12px * var(--gp-scale, 1));
  border-radius: 50%;
  background: #FFFFFF;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.4);
  cursor: pointer;
}

.gp-select {
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.14);
  color: #FFFFFF;
  font-size: calc(11px * var(--gp-scale, 1));
  border-radius: calc(6px * var(--gp-scale, 1));
  padding: calc(3px * var(--gp-scale, 1)) calc(7px * var(--gp-scale, 1));
  outline: none;
  cursor: pointer;
  font-family: inherit;
}

.gp-select option {
  background: #1C1C1E;
  color: #FFFFFF;
}

/* Teleprompter Content Scroll Viewport */
.gp-viewport {
  position: relative;
  flex: 1;
  overflow-y: scroll;
  overflow-x: hidden;
  padding: calc(20px * var(--gp-scale, 1)) calc(24px * var(--gp-scale, 1)) calc(80px * var(--gp-scale, 1)) calc(24px * var(--gp-scale, 1));
  cursor: text;
  user-select: text;
  background: transparent;
  contain: content;
  will-change: scroll-position;
  transform: translateZ(0);
}

.gp-viewport::-webkit-scrollbar {
  width: calc(6px * var(--gp-scale, 1));
}

.gp-viewport::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.22);
  border-radius: 3px;
}

.gp-viewport::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.4);
}

/* Script Text Content */
.gp-script-body {
  font-size: calc(var(--gp-base-font-size, 24px) * var(--gp-font-scale, 1));
  font-weight: 500;
  color: #64D2FF;
  letter-spacing: -0.01em;
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.85);
  white-space: pre-wrap;
  word-break: break-word;
  line-height: 1.6;
  outline: none;
  min-height: 140px;
  padding-bottom: 240px;
}

.gp-script-body.gp-mirrored {
  transform: scaleX(-1);
}

/* Apple Focus Reading Bar (Collapsible Spotlight Guide) */
.gp-focus-line {
  position: absolute;
  top: 35%;
  left: 0;
  width: 100%;
  height: calc(48px * var(--gp-font-scale, 1));
  pointer-events: none;
  background: linear-gradient(90deg, 
    transparent 0%, 
    rgba(100, 210, 255, 0.08) 10%, 
    rgba(100, 210, 255, 0.15) 50%, 
    rgba(100, 210, 255, 0.08) 90%, 
    transparent 100%
  );
  border-top: 1px solid rgba(100, 210, 255, 0.28);
  border-bottom: 1px solid rgba(100, 210, 255, 0.28);
  transform: translateY(-50%);
  z-index: 10;
  transition: opacity 0.2s ease;
}

/* When Collapsed / Hidden */
.gp-focus-line.hidden,
.gp-hide-focus-line .gp-focus-line {
  display: none !important;
  opacity: 0 !important;
}

/* Ghost Mode Exit Pill */
.gp-ghost-pill {
  position: absolute;
  top: 8px;
  right: 14px;
  display: none;
  background: rgba(30, 30, 32, 0.9);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid #0A84FF;
  border-radius: 980px;
  padding: 4px 12px;
  font-size: 11px;
  font-weight: 600;
  color: #0A84FF;
  cursor: pointer;
  box-shadow: 0 4px 14px rgba(0, 122, 255, 0.35);
  z-index: 999;
}

.gp-window.gp-ghost-mode .gp-ghost-pill {
  display: block;
}

/* Expand Indicator on Minimized Window */
.gp-expand-indicator {
  display: none;
  align-items: center;
  gap: 4px;
  font-size: 10.5px;
  color: #0A84FF;
  font-weight: 600;
  cursor: pointer;
  padding: 2px 8px;
  background: rgba(10, 132, 255, 0.15);
  border-radius: 980px;
}

/* Resize Handles */
.gp-resize-handle {
  position: absolute;
  pointer-events: auto;
  z-index: 50;
}

.gp-resize-se {
  right: 0;
  bottom: 0;
  width: 16px;
  height: 16px;
  cursor: se-resize;
  background: radial-gradient(circle at 100% 100%, rgba(255, 255, 255, 0.4) 30%, transparent 60%);
  border-bottom-right-radius: 16px;
}

.gp-resize-sw {
  left: 0;
  bottom: 0;
  width: 16px;
  height: 16px;
  cursor: sw-resize;
  border-bottom-left-radius: 16px;
}

.gp-resize-s {
  left: 16px;
  right: 16px;
  bottom: 0;
  height: 6px;
  cursor: s-resize;
}

.gp-resize-e {
  top: 42px;
  bottom: 16px;
  right: 0;
  width: 6px;
  cursor: e-resize;
}

.gp-resize-w {
  top: 42px;
  bottom: 16px;
  left: 0;
  width: 6px;
  cursor: w-resize;
}

/* Stealth Video Recorder — Apple Camera Controls */
.gp-btn-rec {
  background: rgba(255, 69, 58, 0.16) !important;
  color: #FF453A !important;
  border: 1px solid rgba(255, 69, 58, 0.4) !important;
  box-shadow: 0 1px 4px rgba(255, 69, 58, 0.2) !important;
  font-weight: 700 !important;
  padding: calc(3px * var(--gp-scale, 1)) calc(8px * var(--gp-scale, 1)) !important;
  font-size: calc(10.5px * var(--gp-scale, 1)) !important;
  height: calc(24px * var(--gp-scale, 1)) !important;
}

.gp-btn-rec:hover {
  background: rgba(255, 69, 58, 0.28) !important;
  color: #FFFFFF !important;
  border-color: #FF453A !important;
}

.gp-btn-rec.gp-recording {
  background: linear-gradient(180deg, #FF453A 0%, #D70015 100%) !important;
  color: #FFFFFF !important;
  border-color: rgba(255, 255, 255, 0.3) !important;
  box-shadow: 0 2px 12px rgba(255, 69, 58, 0.6) !important;
  animation: gp-rec-pulse 1.4s infinite !important;
}

@keyframes gp-rec-pulse {
  0% { box-shadow: 0 0 6px rgba(255, 69, 58, 0.4); }
  50% { box-shadow: 0 0 16px rgba(255, 69, 58, 0.9); }
  100% { box-shadow: 0 0 6px rgba(255, 69, 58, 0.4); }
}

/* 3-2-1 Countdown Overlay — Apple Frosted Sheet */
.gp-countdown-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(20, 20, 22, 0.85);
  backdrop-filter: blur(12px) saturate(160%);
  -webkit-backdrop-filter: blur(12px) saturate(160%);
  transform: translateZ(0);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  border-radius: 16px;
  animation: gp-fade-in 0.2s ease;
}

.gp-countdown-inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: calc(8px * var(--gp-scale, 1));
  text-align: center;
  padding: calc(16px * var(--gp-scale, 1));
}

.gp-countdown-num {
  font-size: calc(64px * var(--gp-scale, 1));
  font-weight: 800;
  line-height: 1;
  color: #FFFFFF;
  text-shadow: 0 2px 14px rgba(0, 0, 0, 0.6);
  animation: gp-num-pop 0.9s cubic-bezier(0.175, 0.885, 0.32, 1.275) infinite;
}

@keyframes gp-num-pop {
  0% { transform: scale(0.6); opacity: 0; }
  50% { transform: scale(1.08); opacity: 1; }
  100% { transform: scale(1); opacity: 1; }
}

.gp-countdown-msg {
  font-size: calc(14px * var(--gp-scale, 1));
  font-weight: 600;
  color: #FFFFFF;
}

.gp-countdown-badge {
  font-size: calc(10px * var(--gp-scale, 1));
  font-weight: 600;
  color: #30D158;
  background: rgba(48, 209, 88, 0.15);
  border: 1px solid rgba(48, 209, 88, 0.35);
  padding: calc(3px * var(--gp-scale, 1)) calc(10px * var(--gp-scale, 1));
  border-radius: 980px;
}

/* Modals & Choice Sheets */
.gp-rec-modal, .gp-rec-choice-modal {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(18, 18, 20, 0.82);
  backdrop-filter: blur(12px) saturate(160%);
  -webkit-backdrop-filter: blur(12px) saturate(160%);
  transform: translateZ(0);
  backface-visibility: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 200;
  border-radius: 16px;
  padding: calc(12px * var(--gp-scale, 1));
}

.gp-rec-modal-card, .gp-rec-choice-card {
  width: 100%;
  max-width: 480px;
  background: rgba(36, 36, 40, 0.92);
  border: 1px solid rgba(255, 255, 255, 0.16);
  box-shadow: 0 20px 48px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.18);
  border-radius: calc(14px * var(--gp-scale, 1));
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.gp-rec-choice-header, .gp-rec-modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: calc(10px * var(--gp-scale, 1)) calc(14px * var(--gp-scale, 1));
  background: rgba(48, 48, 52, 0.6);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.gp-rec-choice-title, .gp-rec-modal-title {
  font-size: calc(13px * var(--gp-scale, 1));
  font-weight: 600;
  color: #FFFFFF;
}

.gp-rec-choice-btn {
  display: flex;
  align-items: center;
  gap: calc(12px * var(--gp-scale, 1));
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: calc(10px * var(--gp-scale, 1));
  padding: calc(10px * var(--gp-scale, 1)) calc(12px * var(--gp-scale, 1));
  cursor: pointer;
  text-align: left;
  transition: all 0.15s ease;
  color: #FFFFFF;
  font-family: inherit;
}

.gp-rec-choice-btn:hover {
  background: rgba(255, 255, 255, 0.16);
  border-color: rgba(255, 255, 255, 0.28);
  transform: translateY(-0.5px);
}

.gp-choice-name {
  font-size: calc(12px * var(--gp-scale, 1));
  font-weight: 600;
  color: #FFFFFF;
}

.gp-choice-sub {
  font-size: calc(10px * var(--gp-scale, 1));
  color: rgba(235, 235, 245, 0.65);
}

@keyframes gp-fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}
`;

  /**
   * Helper to load settings and scripts using chrome.storage or localStorage
   */
  async function loadData() {
    return new Promise((resolve) => {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.get(['settings', 'scripts', 'activeScriptId'], (res) => {
          resolve(res);
        });
      } else {
        const settings = localStorage.getItem('ghostprompter_settings');
        const scripts = localStorage.getItem('ghostprompter_scripts');
        const activeScriptId = localStorage.getItem('ghostprompter_activeScriptId');
        resolve({
          settings: settings ? JSON.parse(settings) : null,
          scripts: scripts ? JSON.parse(scripts) : null,
          activeScriptId: activeScriptId ? JSON.parse(activeScriptId) : null
        });
      }
    });
  }

  async function saveData(items) {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set(items);
    } else {
      Object.entries(items).forEach(([k, v]) => {
        try {
          localStorage.setItem(`ghostprompter_${k}`, JSON.stringify(v));
        } catch (e) {}
      });
    }
  }

  /**
   * Initialize or Toggle HUD
   */
  async function initOrToggleHUD() {
    if (hostEl) {
      if (hostEl.style.display === 'none') {
        hostEl.style.display = 'block';
        applyWindowAppearance();
      } else {
        hostEl.style.display = 'none';
        pauseScroll();
      }
      return;
    }

    const data = await loadData();
    currentSettings = { ...defaultState, ...(data.settings || {}) };
    
    // Check transparent mode setting
    if (typeof currentSettings.isTransparentMode === 'boolean') {
      isTransparentMode = currentSettings.isTransparentMode;
      isSolidMode = !isTransparentMode;
    } else {
      isTransparentMode = currentSettings.opacity !== undefined && currentSettings.opacity < 0.65;
      isSolidMode = !isTransparentMode;
    }

    if (!currentSettings.opacity) {
      currentSettings.opacity = isTransparentMode ? 0.35 : 0.94;
    }

    const scripts = data.scripts || [];
    currentScript = scripts.find(s => s.id === data.activeScriptId) || scripts[0] || {
      id: 'default',
      title: 'Welcome to GhostPrompter',
      content: `Welcome to GhostPrompter! 👻\n\nThis is your high-visibility heads-up teleprompter.\n\n• Drag this window directly beneath your webcam lens.\n• Resize it using the bottom-right cyan handle.\n• Click "▶ Auto-Scroll" (or Spacebar) for continuous smooth scrolling.\n• Adjust scroll speed using "-" / "+" in the header at any time.\n• Click "🪟 Transparent" to switch between Solid Dark and Floating Glass.\n• Click "👻 Ghost" (Alt + C) to click right through the window.\n\nEnjoy seamless eye contact on every call!`
    };

    createHUD(data.scripts || [currentScript]);
  }

  /**
   * Build the Shadow DOM HUD Structure
   */
  function createHUD(scriptsList) {
    hostEl = document.createElement('ghost-prompter-root');
    hostEl.style.position = 'fixed';
    hostEl.style.top = '0';
    hostEl.style.left = '0';
    hostEl.style.width = '100%';
    hostEl.style.height = '100%';
    hostEl.style.pointerEvents = 'none';
    hostEl.style.zIndex = '2147483647';

    shadowRoot = hostEl.attachShadow({ mode: 'open' });

    // Inject embedded styles directly
    const styleEl = document.createElement('style');
    styleEl.textContent = EMBEDDED_STYLES;
    shadowRoot.appendChild(styleEl);

    // Initial position & dimensions
    const winConfig = currentSettings.window || defaultState.window;
    const initialWidth = winConfig.width || 680;
    const initialHeight = winConfig.height || 290;
    const initialTop = winConfig.y !== null ? winConfig.y : 24;
    const initialLeft = winConfig.x !== null ? winConfig.x : Math.max(20, (window.innerWidth - initialWidth) / 2);

    // Main window element
    windowEl = document.createElement('div');
    windowEl.className = `gp-window ${isTransparentMode ? 'gp-transparent-mode' : 'gp-solid-mode'} ${currentSettings.isWindowMinimized ? 'gp-minimized' : ''}`;
    windowEl.style.width = `${initialWidth}px`;
    windowEl.style.height = `${initialHeight}px`;
    windowEl.style.top = `${initialTop}px`;
    windowEl.style.left = `${initialLeft}px`;

    const isToolbarCollapsed = currentSettings.isToolbarCollapsed !== false;

    // Markup with high-visibility auto-scroll & transparent mode controls
    windowEl.innerHTML = `
      <!-- Click-through Ghost Mode exit badge -->
      <button class="gp-ghost-pill" id="gp-ghost-pill">👻 Ghost Mode Active (Click to Exit)</button>

      <!-- Drag Header -->
      <div class="gp-header" id="gp-header">
        <div class="gp-brand">
          <div class="gp-traffic-group">
            <button class="gp-traffic-dot gp-dot-close" id="gp-btn-close-traffic" title="Close Prompter (Alt+P)"></button>
            <button class="gp-traffic-dot gp-dot-min" id="gp-btn-min-traffic" title="Minimize / Collapse Prompter">−</button>
            <button class="gp-traffic-dot gp-dot-expand" id="gp-btn-expand-traffic" title="Expand Prompter">+</button>
          </div>
          <svg class="gp-logo-icon" viewBox="0 0 24 24">
            <path d="M12 2A9 9 0 0 0 3 11c0 3.2 1.6 6 4 7.6V21a1 1 0 0 0 1.5.9L12 20l3.5 1.9A1 1 0 0 0 17 21v-2.4c2.4-1.6 4-4.4 4-7.6A9 9 0 0 0 12 2zm-3 8a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm6 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3z"/>
          </svg>
          <span class="gp-title">GhostPrompter</span>
          <div class="gp-status-group">
            <span class="gp-badge" id="gp-mode-badge"><span class="gp-badge-long">${(currentSettings.trackingMode || 'AUTO').toUpperCase()}</span><span class="gp-badge-short">${(currentSettings.trackingMode || 'AUTO').substring(0, 4).toUpperCase()}</span></span>
            <div class="gp-indicator" title="Gaze Tracking Status">
              <span class="gp-dot" id="gp-gaze-dot"></span><span class="gp-indicator-text"> Gaze</span>
            </div>
            <div class="gp-indicator" title="Speech Sync Status">
              <span class="gp-dot" id="gp-speech-dot"></span><span class="gp-indicator-text"> Speech</span>
            </div>
          </div>
        </div>

        <div class="gp-actions">
          <button class="gp-btn gp-btn-rec" id="gp-btn-rec" title="Alt+R: Stealth Record Webcam (Prompter is 100% hidden in video!)">
            <span class="gp-rec-icon" id="gp-rec-icon">🔴</span><span class="gp-rec-label" id="gp-rec-label"> Rec</span>
          </button>
          <button class="gp-btn gp-btn-rec-stop" id="gp-btn-rec-stop" style="display: none;" title="Stop Recording & Download Video">
            <span class="gp-stop-icon">⏹</span><span class="gp-stop-label"> Stop</span>
          </button>
          <button class="gp-btn gp-btn-autoscroll" id="gp-btn-play" title="Spacebar: Play / Pause Auto-Scroll">
            <span class="gp-btn-icon-symbol">▶</span><span class="gp-btn-label"> Play</span>
          </button>
          <div class="gp-speed-pill" title="Live Auto-Scroll Speed (WPM)">
            <button class="gp-btn-tiny" id="gp-btn-hdr-wpm-dec" title="Slower (-10 WPM)">-</button>
            <span id="gp-hdr-wpm-val">${currentSettings.wpm} WPM</span>
            <button class="gp-btn-tiny" id="gp-btn-hdr-wpm-inc" title="Faster (+10 WPM)">+</button>
          </div>
          <button class="gp-btn ${currentSettings.showFocusLine !== false ? 'active' : ''}" id="gp-btn-focus-toggle" title="Toggle Reading Focus Highlight Bar">
            <span>🎯</span><span class="gp-focus-label"> Focus</span>
          </button>
          <button class="gp-btn ${isTransparentMode ? 'active' : ''}" id="gp-btn-transparency" title="Alt+T: Toggle Transparent Glass / Solid mode">
            <span class="gp-trans-icon">${isTransparentMode ? '⬛' : '🪟'}</span><span class="gp-trans-label"> ${isTransparentMode ? 'Solid' : 'Transparent'}</span>
          </button>
          <button class="gp-btn gp-btn-icon gp-btn-nudge" id="gp-btn-nudge-up" title="Nudge Up (Up Arrow)">▲</button>
          <button class="gp-btn gp-btn-icon gp-btn-nudge" id="gp-btn-nudge-down" title="Nudge Down (Down Arrow)">▼</button>
          <button class="gp-btn gp-btn-icon gp-btn-nudge" id="gp-btn-reset-top" title="Reset to Top">⏮</button>
          <button class="gp-btn" id="gp-btn-ghost" title="Alt+C: Ghost Click-Through Mode">
            <span>👻</span><span class="gp-ghost-label"> Ghost</span>
          </button>
          <button class="gp-btn gp-btn-icon" id="gp-btn-mirror" title="Mirror text for glass prompter">🪞</button>
          <button class="gp-btn gp-btn-popout" id="gp-btn-popout" title="Float on top of ALL tabs, PowerPoint, Zoom, and Desktop Windows (Always-On-Top PiP)">
            <span>📌</span><span class="gp-popout-label"> PiP Mode</span>
          </button>
          <button class="gp-btn gp-btn-tools ${!isToolbarCollapsed ? 'active' : ''}" id="gp-btn-tools" title="Alt+S: Toggle Settings Toolbar">
            <span>⚙</span><span class="gp-tools-label"> Controls</span> <span class="gp-tools-arrow">${isToolbarCollapsed ? '▼' : '▲'}</span>
          </button>
          <button class="gp-btn gp-btn-icon" id="gp-btn-minimize" title="Minimize / Collapse to Compact Floating Pill">
            <span>⇲</span>
          </button>
          <span class="gp-expand-indicator" id="gp-btn-expand-pill" title="Click to Expand Full Prompter">
            <span>⇱</span> Expand
          </span>
          <button class="gp-btn gp-btn-icon" id="gp-btn-close" title="Close HUD (Alt+P)">✕</button>
        </div>
      </div>

      <!-- Collapsible Settings Toolbar -->
      <div class="gp-toolbar ${isToolbarCollapsed ? 'collapsed' : ''}" id="gp-toolbar">
        <div class="gp-ctrl-group">
          <label>Script:</label>
          <select class="gp-select" id="gp-select-script">
            ${scriptsList.map(s => `<option value="${s.id}" ${s.id === currentScript.id ? 'selected' : ''}>${s.title}</option>`).join('')}
          </select>
        </div>

        <div class="gp-ctrl-group">
          <label>Speed (WPM):</label>
          <button class="gp-btn gp-btn-icon" id="gp-btn-wpm-dec" style="width:22px; height:22px; font-size:11px;">-</button>
          <input type="range" class="gp-range" id="gp-range-wpm" min="50" max="300" step="10" value="${currentSettings.wpm}">
          <button class="gp-btn gp-btn-icon" id="gp-btn-wpm-inc" style="width:22px; height:22px; font-size:11px;">+</button>
          <span id="gp-val-wpm" style="font-size:11px; color:#00F0FF; min-width:28px; font-weight:700;">${currentSettings.wpm}</span>
        </div>

        <div class="gp-ctrl-group">
          <label>Transparency Presets:</label>
          <button class="gp-btn gp-preset-btn ${currentSettings.opacity >= 0.85 && !isTransparentMode ? 'active' : ''}" id="gp-preset-solid" data-preset="solid">⬛ Solid 95%</button>
          <button class="gp-btn gp-preset-btn ${currentSettings.opacity >= 0.65 && currentSettings.opacity < 0.85 ? 'active' : ''}" id="gp-preset-dark" data-preset="dark">🌓 Dark 75%</button>
          <button class="gp-btn gp-preset-btn ${currentSettings.opacity >= 0.2 && currentSettings.opacity < 0.65 && isTransparentMode ? 'active' : ''}" id="gp-preset-glass" data-preset="glass">🪟 Glass 35%</button>
          <button class="gp-btn gp-preset-btn ${currentSettings.opacity < 0.2 && isTransparentMode ? 'active' : ''}" id="gp-preset-clear" data-preset="clear">👻 Clear 0%</button>
          <input type="range" class="gp-range" id="gp-range-opacity" min="0" max="1" step="0.05" value="${currentSettings.opacity}">
        </div>

        <div class="gp-ctrl-group">
          <label>Font:</label>
          <button class="gp-btn gp-btn-icon" id="gp-btn-font-dec" style="width:22px; height:22px; font-size:11px;">-</button>
          <input type="range" class="gp-range" id="gp-range-font" min="16" max="44" step="2" value="${currentSettings.fontSize}">
          <button class="gp-btn gp-btn-icon" id="gp-btn-font-inc" style="width:22px; height:22px; font-size:11px;">+</button>
        </div>

        <div class="gp-ctrl-group">
          <label>Color:</label>
          <select class="gp-select" id="gp-select-color">
            <option value="#00F0FF" ${currentSettings.textColor === '#00F0FF' ? 'selected' : ''}>⚡ Neon Cyan</option>
            <option value="#FFEA00" ${currentSettings.textColor === '#FFEA00' ? 'selected' : ''}>☀️ Bright Yellow</option>
            <option value="#00FF88" ${currentSettings.textColor === '#00FF88' ? 'selected' : ''}>💚 Emerald Green</option>
            <option value="#FFFFFF" ${currentSettings.textColor === '#FFFFFF' ? 'selected' : ''}>⚪ Crisp White</option>
          </select>
        </div>

        <div class="gp-ctrl-group">
          <label>Mode:</label>
          <select class="gp-select" id="gp-select-mode">
            <option value="auto" ${currentSettings.trackingMode === 'auto' ? 'selected' : ''}>Auto-Scroll (WPM)</option>
            <option value="manual" ${currentSettings.trackingMode === 'manual' ? 'selected' : ''}>Manual (Keys/Buttons)</option>
            <option value="dual" ${currentSettings.trackingMode === 'dual' ? 'selected' : ''}>Dual (Gaze + Speech)</option>
            <option value="gaze" ${currentSettings.trackingMode === 'gaze' ? 'selected' : ''}>Gaze Only</option>
            <option value="speech" ${currentSettings.trackingMode === 'speech' ? 'selected' : ''}>Speech Sync</option>
          </select>
        </div>

        <div class="gp-ctrl-group" style="margin-left: auto;">
          <button class="gp-btn gp-btn-collapse" id="gp-btn-collapse-toolbar" title="Hide this section (Alt+S)">▲ Hide Controls</button>
        </div>
      </div>

      <!-- Content Scroll Viewport -->
      <div class="gp-viewport" id="gp-viewport">
        <div class="gp-focus-line ${currentSettings.showFocusLine === false ? 'hidden' : ''}" id="gp-focus-line"></div>
        <div class="gp-script-body" id="gp-script-body" contenteditable="true" spellcheck="false"></div>
      </div>

      <!-- 3-2-1 Countdown Overlay -->
      <div class="gp-countdown-overlay" id="gp-countdown-overlay" style="display: none;">
        <div class="gp-countdown-inner">
          <div class="gp-countdown-num" id="gp-countdown-num">3</div>
          <div class="gp-countdown-msg">Get Ready to Present!</div>
          <div class="gp-countdown-badge">🛡 100% Stealth: Prompter invisible in video</div>
        </div>
      </div>

      <!-- Instant Preview & Save Modal -->
      <div class="gp-rec-modal" id="gp-rec-modal" style="display: none;">
        <div class="gp-rec-modal-card">
          <div class="gp-rec-modal-header">
            <div class="gp-rec-modal-title">
              <span class="gp-rec-modal-ico">🎬</span>
              <span>Stealth Video Recorded</span>
            </div>
            <button class="gp-btn gp-btn-icon" id="gp-rec-modal-close" title="Close Preview">✕</button>
          </div>
          <div class="gp-rec-modal-body">
            <video id="gp-rec-preview-video" class="gp-rec-video" controls autoplay playsinline></video>
            <div class="gp-rec-stats-row">
              <span class="gp-rec-stat-pill" id="gp-rec-stat-duration">⏱ 00:00</span>
              <span class="gp-rec-stat-pill" id="gp-rec-stat-size">💾 0 MB</span>
              <span class="gp-rec-stat-pill gp-rec-clean-pill">🛡 100% Prompter-Free</span>
            </div>
          </div>
          <div class="gp-rec-modal-footer">
            <button class="gp-btn gp-btn-retake" id="gp-rec-btn-retake" title="Discard & Record Fresh Take">
              <span>🔄</span> Retake
            </button>
            <button class="gp-btn gp-btn-save" id="gp-rec-btn-save" title="Save recording to computer">
              <span>💾</span> Save Video (.webm)
            </button>
          </div>
        </div>
      </div>

      <!-- Recording Source Choice Modal: Screen, Tab, or Window vs Webcam -->
      <div class="gp-rec-choice-modal" id="gp-rec-choice-modal" style="display: none;">
        <div class="gp-rec-choice-card">
          <div class="gp-rec-choice-header">
            <div class="gp-rec-choice-title">
              <span>🎙️ Choose Recording Mode</span>
            </div>
            <button class="gp-btn gp-btn-icon" id="gp-rec-choice-close" title="Cancel">✕</button>
          </div>
          <div class="gp-rec-choice-desc">
            Your teleprompter stays on top and auto-scrolls while recording!
          </div>
          <div class="gp-rec-choice-grid">
            <button class="gp-rec-choice-btn gp-choice-highlight" id="gp-choice-screen" title="Share Screen, Chrome Tab, or App Window">
              <span class="gp-choice-icon">🖥️</span>
              <div class="gp-choice-info">
                <span class="gp-choice-name">Share Screen, Tab, or Window</span>
                <span class="gp-choice-sub">Present slides or apps (Tip: Choose "Entire Screen" for Chrome's native [Hide] button)</span>
              </div>
            </button>
            <button class="gp-rec-choice-btn" id="gp-choice-cam" title="Record Webcam Only">
              <span class="gp-choice-icon">📹</span>
              <div class="gp-choice-info">
                <span class="gp-choice-name">Camera Only (Stealth Webcam)</span>
                <span class="gp-choice-sub">Record yourself speaking while reading the prompter (100% prompter-free)</span>
              </div>
            </button>
          </div>
        </div>
      </div>

      <!-- Edge & Corner Resize Handles -->
      <div class="gp-resize-handle gp-resize-se" data-dir="se"></div>
      <div class="gp-resize-handle gp-resize-sw" data-dir="sw"></div>
      <div class="gp-resize-handle gp-resize-s" data-dir="s"></div>
      <div class="gp-resize-handle gp-resize-e" data-dir="e"></div>
      <div class="gp-resize-handle gp-resize-w" data-dir="w"></div>
    `;

    shadowRoot.appendChild(windowEl);
    document.documentElement.appendChild(hostEl);

    // Cache elements
    viewportEl = shadowRoot.getElementById('gp-viewport');
    scriptBodyEl = shadowRoot.getElementById('gp-script-body');
    updateScriptContent();

    // Now apply appearance with guaranteed elements present!
    applyWindowAppearance();

    // Attach Event Listeners
    setupDragHandlers();
    setupResizeHandlers();
    setupUIControls();
    setupHotkeys();
    updateWindowScale();

    // Notify background / offscreen that prompter is active
    sendMessageToExtension({ type: 'HUD_OPENED', trackingMode: currentSettings.trackingMode });
  }

  function applyWindowAppearance() {
    if (!windowEl) return;

    if (isTransparentMode) {
      windowEl.classList.add('gp-transparent-mode');
      windowEl.classList.remove('gp-solid-mode');
    } else {
      windowEl.classList.remove('gp-transparent-mode');
      windowEl.classList.add('gp-solid-mode');
    }

    let bgAlpha = 0.94;
    if (isGhostMode) {
      bgAlpha = 0.15;
    } else if (isTransparentMode) {
      bgAlpha = typeof currentSettings.opacity === 'number' ? Math.min(0.5, currentSettings.opacity) : 0.25;
    } else {
      bgAlpha = typeof currentSettings.opacity === 'number' ? Math.max(0.75, currentSettings.opacity) : 0.94;
    }

    windowEl.style.backgroundColor = `rgba(12, 16, 28, ${bgAlpha})`;
    
    if (viewportEl) {
      if (isTransparentMode || isGhostMode) {
        viewportEl.style.backgroundColor = 'transparent';
      } else {
        viewportEl.style.backgroundColor = `rgba(11, 14, 24, ${bgAlpha * 0.98})`;
      }
    }

    if (scriptBodyEl) {
      scriptBodyEl.style.setProperty('--gp-base-font-size', `${currentSettings.fontSize || 24}px`);
      scriptBodyEl.style.fontSize = `calc(var(--gp-base-font-size, 24px) * var(--gp-font-scale, 1))`;
      scriptBodyEl.style.color = currentSettings.textColor || '#00F0FF';
      scriptBodyEl.style.lineHeight = currentSettings.lineHeight || 1.6;
      if (isTransparentMode) {
        scriptBodyEl.style.fontWeight = '700';
        scriptBodyEl.style.textShadow = '0 0 14px rgba(0, 0, 0, 1), 0 0 6px rgba(0, 0, 0, 1), 0 2px 4px rgba(0, 0, 0, 1), -1.5px -1.5px 0 #000, 1.5px -1.5px 0 #000, -1.5px 1.5px 0 #000, 1.5px 1.5px 0 #000';
      } else {
        scriptBodyEl.style.fontWeight = '600';
        scriptBodyEl.style.textShadow = '0 2px 8px rgba(0, 0, 0, 0.95)';
      }
    }

    // Update preset buttons and toggle button active state
    if (shadowRoot) {
      const presetBtns = shadowRoot.querySelectorAll('.gp-preset-btn');
      presetBtns.forEach(btn => {
        const p = btn.dataset.preset;
        const op = currentSettings.opacity;
        let isAct = false;
        if (p === 'solid' && op >= 0.85 && !isTransparentMode) isAct = true;
        else if (p === 'dark' && op >= 0.65 && op < 0.85) isAct = true;
        else if (p === 'glass' && op >= 0.2 && op < 0.65 && isTransparentMode) isAct = true;
        else if (p === 'clear' && op < 0.2 && isTransparentMode) isAct = true;
        btn.classList.toggle('active', isAct);
      });

      const transBtn = shadowRoot.getElementById('gp-btn-transparency');
      if (transBtn) {
        transBtn.innerHTML = `<span class="gp-trans-icon">${isTransparentMode ? '⬛' : '🪟'}</span><span class="gp-trans-label"> ${isTransparentMode ? 'Solid' : 'Transparent'}</span>`;
        transBtn.classList.toggle('active', isTransparentMode);
      }
    }
    updateWindowScale();
  }

  function updateScriptContent() {
    if (!scriptBodyEl || !currentScript) return;
    scriptBodyEl.textContent = currentScript.content || '';
  }

  /**
   * Drag Handling
   */
  function setupDragHandlers() {
    const header = shadowRoot.getElementById('gp-header');
    let isDragging = false;
    let startX = 0, startY = 0;
    let initialLeft = 0, initialTop = 0;

    header.addEventListener('mousedown', (e) => {
      if (e.target.closest('.gp-actions') || e.target.closest('button')) return;
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      const rect = windowEl.getBoundingClientRect();
      initialLeft = rect.left;
      initialTop = rect.top;
      e.preventDefault();
    });

    window.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      const newLeft = Math.max(0, Math.min(window.innerWidth - windowEl.offsetWidth, initialLeft + dx));
      const newTop = Math.max(0, Math.min(window.innerHeight - windowEl.offsetHeight, initialTop + dy));

      windowEl.style.left = `${newLeft}px`;
      windowEl.style.top = `${newTop}px`;
    });

    window.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
        currentSettings.window = {
          x: parseInt(windowEl.style.left, 10),
          y: parseInt(windowEl.style.top, 10),
          width: windowEl.offsetWidth,
          height: windowEl.offsetHeight
        };
        saveData({ settings: currentSettings });
      }
    });
  }

  /**
   * Elastic UI Scaler
   * Dynamically adapts fonts, padding, buttons, and badges based on HUD window size.
   */
  function updateWindowScale() {
    if (!windowEl) return;
    const width = windowEl.offsetWidth;
    const height = windowEl.offsetHeight;
    if (!width || !height) return;

    // Elastic scale factor: reference width 680px
    // Smooth elastic range: ~0.52 (at 300px) to ~1.25 (at 1200px+)
    const ratio = width / 680;
    const scale = Math.max(0.52, Math.min(1.25, Math.pow(ratio, 0.78)));

    // Font scale factor for script text: range ~0.72 to ~1.25
    const fontScale = Math.max(0.72, Math.min(1.25, Math.pow(ratio, 0.52)));

    windowEl.style.setProperty('--gp-scale', scale.toFixed(3));
    windowEl.style.setProperty('--gp-font-scale', fontScale.toFixed(3));
    windowEl.style.setProperty('--gp-width', `${width}px`);
    windowEl.style.setProperty('--gp-height', `${height}px`);

    // Responsive sizing classes
    windowEl.classList.toggle('gp-size-xs', width < 480);
    windowEl.classList.toggle('gp-size-sm', width >= 480 && width < 620);
    windowEl.classList.toggle('gp-size-md', width >= 620 && width < 820);
    windowEl.classList.toggle('gp-size-lg', width >= 820 && width < 1050);
    windowEl.classList.toggle('gp-size-xl', width >= 1050);
  }

  /**
   * Resize Handling
   */
  function setupResizeHandlers() {
    const handles = shadowRoot.querySelectorAll('.gp-resize-handle');
    let isResizing = false;
    let currentDir = '';
    let startX = 0, startY = 0;
    let startWidth = 0, startHeight = 0, startLeft = 0, startTop = 0;

    handles.forEach(handle => {
      handle.addEventListener('mousedown', (e) => {
        isResizing = true;
        currentDir = handle.dataset.dir;
        startX = e.clientX;
        startY = e.clientY;
        const rect = windowEl.getBoundingClientRect();
        startWidth = rect.width;
        startHeight = rect.height;
        startLeft = rect.left;
        startTop = rect.top;
        e.preventDefault();
        e.stopPropagation();
      });
    });

    window.addEventListener('mousemove', (e) => {
      if (!isResizing) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;

      if (currentDir.includes('e')) {
        windowEl.style.width = `${Math.max(300, Math.min(window.innerWidth - startLeft, startWidth + dx))}px`;
      }
      if (currentDir.includes('s')) {
        windowEl.style.height = `${Math.max(150, Math.min(window.innerHeight - startTop, startHeight + dy))}px`;
      }
      if (currentDir.includes('w')) {
        const newW = Math.max(300, startWidth - dx);
        if (newW >= 300) {
          windowEl.style.width = `${newW}px`;
          windowEl.style.left = `${startLeft + dx}px`;
        }
      }
      updateWindowScale();
    });

    window.addEventListener('mouseup', () => {
      if (isResizing) {
        isResizing = false;
        currentSettings.window = {
          x: parseInt(windowEl.style.left, 10),
          y: parseInt(windowEl.style.top, 10),
          width: windowEl.offsetWidth,
          height: windowEl.offsetHeight
        };
        saveData({ settings: currentSettings });
        updateWindowScale();
      }
    });

    if (window.ResizeObserver) {
      const ro = new ResizeObserver(() => {
        updateWindowScale();
      });
      ro.observe(windowEl);
    }

    window.addEventListener('resize', () => {
      updateWindowScale();
    });
  }

  /**
   * UI Controls & Handlers
   */
  function setupUIControls() {
    const playBtn = shadowRoot.getElementById('gp-btn-play') || shadowRoot.getElementById('gp-btn-autoscroll');
    const hdrWpmDec = shadowRoot.getElementById('gp-btn-hdr-wpm-dec');
    const hdrWpmInc = shadowRoot.getElementById('gp-btn-hdr-wpm-inc');
    const transBtn = shadowRoot.getElementById('gp-btn-transparency');
    const nudgeUpBtn = shadowRoot.getElementById('gp-btn-nudge-up');
    const nudgeDownBtn = shadowRoot.getElementById('gp-btn-nudge-down');
    const resetTopBtn = shadowRoot.getElementById('gp-btn-reset-top');
    const ghostBtn = shadowRoot.getElementById('gp-btn-ghost');
    const ghostPill = shadowRoot.getElementById('gp-ghost-pill');
    const mirrorBtn = shadowRoot.getElementById('gp-btn-mirror');
    const toolsBtn = shadowRoot.getElementById('gp-btn-tools');
    const collapseToolbarBtn = shadowRoot.getElementById('gp-btn-collapse-toolbar');
    const closeBtn = shadowRoot.getElementById('gp-btn-close');
    const toolbar = shadowRoot.getElementById('gp-toolbar');
    const opacitySlider = shadowRoot.getElementById('gp-range-opacity');
    const fontSlider = shadowRoot.getElementById('gp-range-font');
    const wpmSlider = shadowRoot.getElementById('gp-range-wpm');
    const wpmVal = shadowRoot.getElementById('gp-val-wpm');
    const modeSelect = shadowRoot.getElementById('gp-select-mode');
    const scriptSelect = shadowRoot.getElementById('gp-select-script');
    const colorSelect = shadowRoot.getElementById('gp-select-color');
    const presetBtns = shadowRoot.querySelectorAll('.gp-preset-btn');
    const recBtn = shadowRoot.getElementById('gp-btn-rec');
    const recStopBtn = shadowRoot.getElementById('gp-btn-rec-stop');
    const recModalClose = shadowRoot.getElementById('gp-rec-modal-close');
    const recModalRetake = shadowRoot.getElementById('gp-rec-btn-retake');
    const recModalSave = shadowRoot.getElementById('gp-rec-btn-save');

    // Video Recording Trigger & Stop Button
    if (recBtn) {
      recBtn.addEventListener('click', (e) => {
        e.preventDefault();
        toggleRecording();
      });
    }

    if (recStopBtn) {
      recStopBtn.addEventListener('click', (e) => {
        e.preventDefault();
        stopRecordingFlow();
      });
    }

    // Modal Events
    if (recModalClose) {
      recModalClose.addEventListener('click', () => {
        closeRecordingModal();
      });
    }

    if (recModalRetake) {
      recModalRetake.addEventListener('click', () => {
        retakeRecording();
      });
    }

    if (recModalSave) {
      recModalSave.addEventListener('click', () => {
        saveRecording();
      });
    }

    // Recording Source Choice Modal Controls
    const choiceScreenBtn = shadowRoot.getElementById('gp-choice-screen');
    const choiceCamBtn = shadowRoot.getElementById('gp-choice-cam');
    const choiceCloseBtn = shadowRoot.getElementById('gp-rec-choice-close');

    if (choiceScreenBtn) {
      choiceScreenBtn.addEventListener('click', () => {
        closeRecordingChoiceModal();
        startRecordingFlow('screen');
      });
    }

    if (choiceCamBtn) {
      choiceCamBtn.addEventListener('click', () => {
        closeRecordingChoiceModal();
        startRecordingFlow('camera');
      });
    }

    if (choiceCloseBtn) {
      choiceCloseBtn.addEventListener('click', () => {
        closeRecordingChoiceModal();
      });
    }

    // Play / Auto-Scroll Toggle
    if (playBtn) {
      playBtn.addEventListener('click', (e) => {
        e.preventDefault();
        toggleAutoScroll();
      });
    }

    // Header Fast Speed Adjusters
    if (hdrWpmDec) {
      hdrWpmDec.addEventListener('click', () => adjustSpeed(-10));
    }
    if (hdrWpmInc) {
      hdrWpmInc.addEventListener('click', () => adjustSpeed(10));
    }

    // Transparent / Solid Toggle
    if (transBtn) {
      transBtn.addEventListener('click', toggleTransparency);
    }

    // Reading Focus Highlight Line Toggle
    const focusToggleBtn = shadowRoot.getElementById('gp-btn-focus-toggle');
    if (focusToggleBtn) {
      focusToggleBtn.addEventListener('click', () => {
        const isCurrentlyVisible = currentSettings.showFocusLine !== false;
        const newVisible = !isCurrentlyVisible;
        setFocusLineVisible(newVisible);
        saveData({ settings: { ...currentSettings, showFocusLine: newVisible } });
      });
    }

    // Window Minimize / Collapse Controls
    const minBtn = shadowRoot.getElementById('gp-btn-minimize');
    const minTrafficBtn = shadowRoot.getElementById('gp-btn-min-traffic');
    const closeTrafficBtn = shadowRoot.getElementById('gp-btn-close-traffic');
    const expandTrafficBtn = shadowRoot.getElementById('gp-btn-expand-traffic');
    const expandPill = shadowRoot.getElementById('gp-btn-expand-pill');

    if (minBtn) minBtn.addEventListener('click', () => toggleMinimize());
    if (minTrafficBtn) minTrafficBtn.addEventListener('click', () => toggleMinimize());
    if (expandTrafficBtn) expandTrafficBtn.addEventListener('click', () => toggleMinimize(false));
    if (expandPill) expandPill.addEventListener('click', () => toggleMinimize(false));
    if (closeTrafficBtn) {
      closeTrafficBtn.addEventListener('click', () => {
        if (hostEl) hostEl.style.display = 'none';
        pauseScroll();
      });
    }

    // Transparency Preset Buttons
    presetBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        setTransparencyPreset(btn.dataset.preset);
      });
    });

    // Manual nudges
    if (nudgeUpBtn) nudgeUpBtn.addEventListener('click', () => nudgeScroll(-40));
    if (nudgeDownBtn) nudgeDownBtn.addEventListener('click', () => nudgeScroll(40));
    if (resetTopBtn) {
      resetTopBtn.addEventListener('click', () => {
        if (viewportEl) {
          viewportEl.scrollTop = 0;
          scrollAccumulator = 0;
        }
      });
    }

    // Color Selector
    if (colorSelect) {
      colorSelect.addEventListener('change', (e) => {
        currentSettings.textColor = e.target.value;
        applyWindowAppearance();
        saveData({ settings: currentSettings });
      });
    }

    // Toolbar WPM buttons
    const wpmDecBtn = shadowRoot.getElementById('gp-btn-wpm-dec');
    const wpmIncBtn = shadowRoot.getElementById('gp-btn-wpm-inc');
    if (wpmDecBtn) wpmDecBtn.addEventListener('click', () => adjustSpeed(-10));
    if (wpmIncBtn) wpmIncBtn.addEventListener('click', () => adjustSpeed(10));

    // Font buttons
    const fontDecBtn = shadowRoot.getElementById('gp-btn-font-dec');
    const fontIncBtn = shadowRoot.getElementById('gp-btn-font-inc');
    if (fontDecBtn) {
      fontDecBtn.addEventListener('click', () => {
        currentSettings.fontSize = Math.max(16, (currentSettings.fontSize || 24) - 2);
        if (fontSlider) fontSlider.value = currentSettings.fontSize;
        applyWindowAppearance();
        saveData({ settings: currentSettings });
      });
    }
    if (fontIncBtn) {
      fontIncBtn.addEventListener('click', () => {
        currentSettings.fontSize = Math.min(48, (currentSettings.fontSize || 24) + 2);
        if (fontSlider) fontSlider.value = currentSettings.fontSize;
        applyWindowAppearance();
        saveData({ settings: currentSettings });
      });
    }

    // Ghost Mode
    if (ghostBtn) ghostBtn.addEventListener('click', toggleGhostMode);
    if (ghostPill) ghostPill.addEventListener('click', toggleGhostMode);

    // Mirror Mode
    if (mirrorBtn) {
      mirrorBtn.addEventListener('click', () => {
        isMirrorMode = !isMirrorMode;
        mirrorBtn.classList.toggle('active', isMirrorMode);
        if (scriptBodyEl) scriptBodyEl.classList.toggle('gp-mirrored', isMirrorMode);
        currentSettings.mirrorMode = isMirrorMode;
        saveData({ settings: currentSettings });
      });
    }

    // Always-on-Top Floating Pop-Out (Picture-in-Picture & Standalone)
    const popoutBtn = shadowRoot.getElementById('gp-btn-popout');
    if (popoutBtn) {
      let pipInstance = null;
      popoutBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        pauseAutoScroll();

        if (typeof PiPPrompterManager !== 'undefined' && PiPPrompterManager.isSupported()) {
          pipInstance = new PiPPrompterManager();
          activePiPInstance = pipInstance;

          // Temporarily hide in-tab prompter while floating in PiP
          windowEl.style.display = 'none';

          const data = await loadData();
          const scripts = data.scripts || [currentScript];

          const isCompactBar = windowEl.classList.contains('gp-minimized') || popoutBtn.dataset.compact === 'true';
          await pipInstance.openPiP({
            width: windowEl.offsetWidth || 680,
            height: isCompactBar ? 76 : (windowEl.offsetHeight || 320),
            compactBarOnly: isCompactBar,
            wpm: currentSettings.wpm || 130,
            fontSize: currentSettings.fontSize || 24,
            isTransparent: isTransparentMode,
            opacity: typeof currentSettings.opacity === 'number' ? currentSettings.opacity : (isTransparentMode ? 0.35 : 0.94),
            textColor: currentSettings.textColor || '#00F0FF',
            trackingMode: currentSettings.trackingMode || 'auto',
            script: currentScript,
            scripts: scripts,
            initialScrollTop: viewportEl ? viewportEl.scrollTop : 0,
            onToggleRecord: (source) => toggleRecording(source),
            onStartScreenRecording: () => startRecordingFlow('screen'),
            onStartCameraRecording: () => startRecordingFlow('camera'),
            onStopRecording: () => stopRecordingFlow(),
            isRecording: () => isRecording,
            onClose: (res) => {
              activePiPInstance = null;
              // Restore in-tab prompter when PiP closes
              windowEl.style.display = 'flex';
              if (res) {
                if (typeof res.finalScrollTop === 'number' && viewportEl) {
                  viewportEl.scrollTop = res.finalScrollTop;
                }
                if (res.wpm && res.wpm !== currentSettings.wpm) {
                  currentSettings.wpm = res.wpm;
                  const wpmVal = shadowRoot.getElementById('gp-val-wpm');
                  const hdrWpmVal = shadowRoot.getElementById('gp-hdr-wpm-val');
                  const rangeWpm = shadowRoot.getElementById('gp-range-wpm');
                  if (wpmVal) wpmVal.textContent = res.wpm;
                  if (hdrWpmVal) hdrWpmVal.textContent = `${res.wpm} WPM`;
                  if (rangeWpm) rangeWpm.value = res.wpm;
                }
                if (typeof res.isTransparent === 'boolean' && res.isTransparent !== isTransparentMode) {
                  isTransparentMode = res.isTransparent;
                  isSolidMode = !isTransparentMode;
                  applyWindowAppearance();
                }
                if (res.textColor && res.textColor !== currentSettings.textColor) {
                  currentSettings.textColor = res.textColor;
                  const colorSel = shadowRoot.getElementById('gp-select-color');
                  if (colorSel) colorSel.value = res.textColor;
                  applyWindowAppearance();
                }
                if (res.trackingMode && res.trackingMode !== currentSettings.trackingMode) {
                  currentSettings.trackingMode = res.trackingMode;
                  const modeSel = shadowRoot.getElementById('gp-select-mode');
                  if (modeSel) modeSel.value = res.trackingMode;
                }
                if (typeof res.fontSize === 'number' && res.fontSize !== currentSettings.fontSize) {
                  currentSettings.fontSize = res.fontSize;
                  const fontRange = shadowRoot.getElementById('gp-range-font');
                  if (fontRange) fontRange.value = res.fontSize;
                  applyWindowAppearance();
                }
                saveData({ settings: currentSettings });
              }
            }
          });
        } else {
          // Open fallback standalone window via background service worker
          if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
            chrome.runtime.sendMessage({ type: 'OPEN_FLOATING_PROMPTER_WINDOW' });
          } else {
            window.open(
              'src/floating/floating.html',
              'GhostPrompterFloating',
              'width=700,height=360,menubar=no,toolbar=no'
            );
          }
        }
      });
    }

    // Toggle Toolbar Header Button
    if (toolsBtn) {
      toolsBtn.addEventListener('click', (e) => {
        e.preventDefault();
        toggleToolbar();
      });
    }

    // Collapse Toolbar Button (inside settings section)
    if (collapseToolbarBtn) {
      collapseToolbarBtn.addEventListener('click', (e) => {
        e.preventDefault();
        toggleToolbar(true);
      });
    }

    // Close HUD
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        hostEl.style.display = 'none';
        pauseAutoScroll();
      });
    }

    // Opacity Slider
    if (opacitySlider) {
      opacitySlider.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        currentSettings.opacity = val;
        isTransparentMode = val < 0.65;
        isSolidMode = !isTransparentMode;
        currentSettings.isTransparentMode = isTransparentMode;
        applyWindowAppearance();
        saveData({ settings: currentSettings });
      });
    }

    // Font Size Slider
    if (fontSlider) {
      fontSlider.addEventListener('input', (e) => {
        currentSettings.fontSize = parseInt(e.target.value, 10);
        applyWindowAppearance();
        saveData({ settings: currentSettings });
      });
    }

    // WPM Speed Slider
    if (wpmSlider) {
      wpmSlider.addEventListener('input', (e) => {
        adjustSpeed(parseInt(e.target.value, 10) - (currentSettings.wpm || 130));
      });
    }

    // Tracking Mode
    if (modeSelect) {
      modeSelect.addEventListener('change', (e) => {
        currentSettings.trackingMode = e.target.value;
        const badge = shadowRoot.getElementById('gp-mode-badge');
        if (badge && !isPlaying) badge.textContent = e.target.value.toUpperCase();
        saveData({ settings: currentSettings });
        sendMessageToExtension({ type: 'SET_TRACKING_MODE', mode: e.target.value });
      });
    }

    // Script Switcher
    if (scriptSelect) {
      scriptSelect.addEventListener('change', async (e) => {
        const data = await loadData();
        const scripts = data.scripts || [];
        const found = scripts.find(s => s.id === e.target.value);
        if (found) {
          currentScript = found;
          updateScriptContent();
          saveData({ activeScriptId: found.id });
          if (viewportEl) viewportEl.scrollTop = 0;
        }
      });
    }

    // In-place script editing
    if (scriptBodyEl) {
      scriptBodyEl.addEventListener('input', () => {
        if (currentScript) {
          currentScript.content = scriptBodyEl.innerText;
          currentScript.updatedAt = Date.now();
          saveData({ activeScriptId: currentScript.id });
          loadData().then(data => {
            const scripts = data.scripts || [];
            const idx = scripts.findIndex(s => s.id === currentScript.id);
            if (idx >= 0) scripts[idx] = currentScript;
            saveData({ scripts });
          });
        }
      });
    }
  }

  /**
   * Transparency Controls
   */
  function toggleTransparency() {
    isTransparentMode = !isTransparentMode;
    isSolidMode = !isTransparentMode;
    if (isTransparentMode) {
      if (!currentSettings.opacity || currentSettings.opacity >= 0.7) {
        currentSettings.opacity = 0.35;
      }
    } else {
      currentSettings.opacity = 0.94;
    }
    currentSettings.isTransparentMode = isTransparentMode;
    const opacitySlider = shadowRoot ? shadowRoot.getElementById('gp-range-opacity') : null;
    if (opacitySlider) opacitySlider.value = currentSettings.opacity;
    applyWindowAppearance();
    saveData({ settings: currentSettings });
  }

  function setTransparencyPreset(preset) {
    if (preset === 'solid') {
      isTransparentMode = false;
      isSolidMode = true;
      currentSettings.opacity = 0.95;
    } else if (preset === 'dark') {
      isTransparentMode = false;
      isSolidMode = true;
      currentSettings.opacity = 0.75;
    } else if (preset === 'glass') {
      isTransparentMode = true;
      isSolidMode = false;
      currentSettings.opacity = 0.35;
    } else if (preset === 'clear') {
      isTransparentMode = true;
      isSolidMode = false;
      currentSettings.opacity = 0.02;
    }
    currentSettings.isTransparentMode = isTransparentMode;
    const opacitySlider = shadowRoot ? shadowRoot.getElementById('gp-range-opacity') : null;
    if (opacitySlider) opacitySlider.value = currentSettings.opacity;
    applyWindowAppearance();
    saveData({ settings: currentSettings });
  }

  /**
   * Toolbar Collapse / Expand Controller
   */
  function toggleToolbar(forceState) {
    if (!shadowRoot) return;
    const toolbar = shadowRoot.getElementById('gp-toolbar');
    const toolsBtn = shadowRoot.getElementById('gp-btn-tools');
    if (!toolbar) return;

    const isCurrentlyCollapsed = toolbar.classList.contains('collapsed');
    const shouldCollapse = forceState !== undefined ? forceState : !isCurrentlyCollapsed;

    toolbar.classList.toggle('collapsed', shouldCollapse);
    if (toolsBtn) {
      toolsBtn.classList.toggle('active', !shouldCollapse);
      toolsBtn.innerHTML = `<span>⚙</span><span class="gp-tools-label"> Controls</span> <span class="gp-tools-arrow">${shouldCollapse ? '▼' : '▲'}</span>`;
      toolsBtn.title = shouldCollapse ? 'Show Controls Toolbar (Alt+S)' : 'Hide Controls Toolbar (Alt+S)';
    }
    currentSettings.isToolbarCollapsed = shouldCollapse;
    saveData({ settings: currentSettings });
  }

  /**
   * Focus Highlight Bar Visibility Controller
   */
  function setFocusLineVisible(visible) {
    if (!shadowRoot) return;
    const focusLine = shadowRoot.getElementById('gp-focus-line');
    const focusBtn = shadowRoot.getElementById('gp-btn-focus-toggle');
    const shouldShow = visible !== undefined ? visible : (currentSettings.showFocusLine === false);
    currentSettings.showFocusLine = shouldShow;
    if (focusLine) {
      focusLine.classList.toggle('hidden', !shouldShow);
    }
    if (focusBtn) {
      focusBtn.classList.toggle('active', shouldShow);
    }
    saveData({ settings: currentSettings });
  }

  /**
   * Prompter Window Minimize to Pill Controller
   */
  function toggleMinimize(forceState) {
    if (!windowEl) return;
    const isCurrentlyMin = windowEl.classList.contains('gp-minimized');
    const shouldMin = forceState !== undefined ? forceState : !isCurrentlyMin;
    windowEl.classList.toggle('gp-minimized', shouldMin);
    currentSettings.isWindowMinimized = shouldMin;
    saveData({ settings: currentSettings });
  }

  /**
   * Hotkey Controller
   */
  function setupHotkeys() {
    window.addEventListener('keydown', (e) => {
      const activeTag = document.activeElement ? document.activeElement.tagName.toLowerCase() : '';
      const isEditingScript = shadowRoot && shadowRoot.activeElement === scriptBodyEl;
      
      // Global toggle HUD hotkey: Alt + P
      if (e.altKey && (e.key === 'p' || e.key === 'P')) {
        e.preventDefault();
        initOrToggleHUD();
        return;
      }

      // Global toggle Minimize Pill hotkey: Alt + M
      if (e.altKey && (e.key === 'm' || e.key === 'M')) {
        e.preventDefault();
        toggleMinimize();
        return;
      }

      // Global toggle Focus Bar hotkey: Alt + F
      if (e.altKey && (e.key === 'f' || e.key === 'F')) {
        e.preventDefault();
        setFocusLineVisible();
        return;
      }

      // Global click-through Ghost Mode hotkey: Alt + C
      if (e.altKey && (e.key === 'c' || e.key === 'C')) {
        e.preventDefault();
        toggleGhostMode();
        return;
      }

      // Global Transparent Mode hotkey: Alt + T
      if (e.altKey && (e.key === 't' || e.key === 'T')) {
        e.preventDefault();
        toggleTransparency();
        return;
      }

      // Global toggle Controls Toolbar hotkey: Alt + S
      if (e.altKey && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        toggleToolbar();
        return;
      }

      // Global stealth video recording hotkey: Alt + R
      if (e.altKey && (e.key === 'r' || e.key === 'R')) {
        e.preventDefault();
        toggleRecording();
        return;
      }

      if (hostEl && hostEl.style.display !== 'none' && !isEditingScript && activeTag !== 'input' && activeTag !== 'textarea') {
        if (e.code === 'Space') {
          e.preventDefault();
          toggleAutoScroll();
        } else if (e.code === 'ArrowUp') {
          e.preventDefault();
          nudgeScroll(-40);
        } else if (e.code === 'ArrowDown') {
          e.preventDefault();
          nudgeScroll(40);
        } else if (e.key === '[') {
          e.preventDefault();
          adjustSpeed(-10);
        } else if (e.key === ']') {
          e.preventDefault();
          adjustSpeed(10);
        } else if (e.key === 'Escape') {
          e.preventDefault();
          hostEl.style.display = 'none';
          pauseAutoScroll();
        }
      }
    });
  }

  /**
   * Stealth Video Recorder Controller
   */
  function getOrCreateRecorder() {
    if (videoRecorderInstance) return videoRecorderInstance;

    const RecClass = (typeof window !== 'undefined' && window.VideoRecorder) || 
                     (typeof self !== 'undefined' && self.VideoRecorder) || 
                     (typeof VideoRecorder !== 'undefined' ? VideoRecorder : null);

    if (!RecClass) {
      console.warn('GhostPrompter: VideoRecorder module not found yet.');
      return null;
    }

    videoRecorderInstance = new RecClass({
      videoQuality: '1080p',
      aspectRatio: '16:9',
      mirror: true,
      countdownSeconds: 3,
      onCountdown: (remaining) => {
        isCountingDown = remaining > 0;
        updateCountdownUI(remaining);
      },
      onStart: () => {
        isRecording = true;
        isCountingDown = false;
        updateCountdownUI(0);
        updateRecordingButtonUI(true, '00:00');
        // Automatically start prompter scrolling for seamless reading!
        if (!isPlaying) {
          startAutoScroll();
        }
      },
      onTimeUpdate: (elapsedSeconds, formattedTime) => {
        const timeStr = typeof elapsedSeconds === 'object' && elapsedSeconds !== null
          ? (elapsedSeconds.formattedTime || (typeof VideoRecorder !== 'undefined' ? VideoRecorder.formatTime(elapsedSeconds.elapsedSeconds || 0) : '00:00'))
          : (formattedTime || (typeof VideoRecorder !== 'undefined' ? VideoRecorder.formatTime(typeof elapsedSeconds === 'number' ? elapsedSeconds : 0) : '00:00'));
        updateRecordingButtonUI(true, timeStr);
      },
      onStop: (take) => {
        isRecording = false;
        isCountingDown = false;
        updateRecordingButtonUI(false);
        currentRecordedBlob = take.blob;
        currentRecordedUrl = take.url;
        showRecordingModal(take);
        if (activePiPInstance && typeof activePiPInstance.showRecordingModal === 'function') {
          activePiPInstance.showRecordingModal(take);
        }
      },
      onError: (err) => {
        console.error('GhostPrompter recording error:', err);
        isRecording = false;
        isCountingDown = false;
        updateCountdownUI(0);
        updateRecordingButtonUI(false);
        alert('Could not record webcam video: ' + (err.message || 'Permission denied or camera in use.'));
      }
    });

    return videoRecorderInstance;
  }

    let activeRecordingSource = 'camera';

    function toggleRecording(preferredSource) {
      if (!hostEl || hostEl.style.display === 'none') {
        initOrToggleHUD().then(() => {
          toggleRecordingInternal(preferredSource);
        });
      } else {
        toggleRecordingInternal(preferredSource);
      }
    }

    function toggleRecordingInternal(preferredSource) {
      const recorder = getOrCreateRecorder();
      if (!recorder) {
        alert('Video recorder module is initializing. Please try again in a moment or reload the page.');
        return;
      }

      if (isRecording || isCountingDown) {
        stopRecordingFlow();
        return;
      }

      if (preferredSource === 'screen' || preferredSource === 'camera') {
        startRecordingFlow(preferredSource);
      } else {
        showRecordingChoiceModal();
      }
    }

    function showRecordingChoiceModal() {
      if (!shadowRoot) return;
      const modal = shadowRoot.getElementById('gp-rec-choice-modal');
      if (modal) modal.style.display = 'flex';
    }

    function closeRecordingChoiceModal() {
      if (!shadowRoot) return;
      const modal = shadowRoot.getElementById('gp-rec-choice-modal');
      if (modal) modal.style.display = 'none';
    }

    async function startRecordingFlow(sourceType = 'camera') {
      closeRecordingChoiceModal();
      const recorder = getOrCreateRecorder();
      if (!recorder) return;

      activeRecordingSource = sourceType;
      // Dismiss preview modal if currently open
      closeRecordingModal();

      try {
        await recorder.startRecordingWithCountdown(sourceType);
      } catch (e) {
        console.warn('Recording start cancelled or error:', e);
      }
    }

    function stopRecordingFlow() {
      if (videoRecorderInstance) {
        videoRecorderInstance.stopRecording();
        if (typeof videoRecorderInstance.stopScreenShare === 'function') {
          videoRecorderInstance.stopScreenShare();
        }
      }
      if (isPlaying) {
        pauseAutoScroll();
      }
    }

  function updateCountdownUI(remaining) {
    if (!shadowRoot) return;
    const overlay = shadowRoot.getElementById('gp-countdown-overlay');
    const numEl = shadowRoot.getElementById('gp-countdown-num');
    if (!overlay || !numEl) return;

    if (remaining > 0) {
      overlay.style.display = 'flex';
      numEl.textContent = remaining;
    } else {
      overlay.style.display = 'none';
    }
  }

  let recordingTimerInterval = null;
  let recordingStartTime = 0;

  function updateRecordingButtonUI(recording, timeStr = null) {
    if (activePiPInstance) {
      try {
        activePiPInstance.updateRecordingState(recording, timeStr);
      } catch (e) {
        console.warn('Could not update PiP recording state:', e);
      }
    }

    if (!shadowRoot) return;
    const recBtn = shadowRoot.getElementById('gp-btn-rec');
    const stopBtn = shadowRoot.getElementById('gp-btn-rec-stop');
    if (!recBtn) return;

    const icon = recBtn.querySelector('.gp-rec-icon');
    const label = recBtn.querySelector('.gp-rec-label');

    if (recording) {
      recBtn.classList.add('gp-recording');
      recBtn.title = 'Recording active. Click Rec or Stop button to finish.';
      if (icon) icon.textContent = '🔴';

      if (!recordingTimerInterval) {
        recordingStartTime = Date.now();
        recordingTimerInterval = setInterval(() => {
          if (!isRecording) {
            clearInterval(recordingTimerInterval);
            recordingTimerInterval = null;
            return;
          }
          const elapsed = Math.floor((Date.now() - recordingStartTime) / 1000);
          const mins = String(Math.floor(elapsed / 60)).padStart(2, '0');
          const secs = String(elapsed % 60).padStart(2, '0');
          const tStr = `${mins}:${secs}`;
          if (shadowRoot) {
            const currentLabel = shadowRoot.querySelector('#gp-btn-rec .gp-rec-label');
            if (currentLabel) currentLabel.textContent = ` ${tStr}`;
          }
          if (activePiPInstance) {
            try {
              activePiPInstance.updateRecordingState(true, tStr);
            } catch (e) {}
          }
        }, 1000);
      }

      if (timeStr) {
        if (label) label.textContent = ` ${timeStr}`;
      } else if (label && (!label.textContent || label.textContent === ' Rec' || label.textContent === 'Rec')) {
        label.textContent = ' 00:00';
      }
      if (stopBtn) stopBtn.style.display = 'inline-flex';
    } else {
      if (recordingTimerInterval) {
        clearInterval(recordingTimerInterval);
        recordingTimerInterval = null;
      }
      recBtn.classList.remove('gp-recording');
      recBtn.title = 'Alt+R: Stealth Record Webcam or Screen';
      if (icon) icon.textContent = '🔴';
      if (label) label.textContent = ' Rec';
      if (stopBtn) stopBtn.style.display = 'none';
    }
  }

  function showRecordingModal(take) {
    if (!shadowRoot) return;
    const modal = shadowRoot.getElementById('gp-rec-modal');
    const video = shadowRoot.getElementById('gp-rec-preview-video');
    const durEl = shadowRoot.getElementById('gp-rec-stat-duration');
    const sizeEl = shadowRoot.getElementById('gp-rec-stat-size');

    if (!modal) return;

    if (video && take && take.url) {
      video.src = take.url;
      video.pause();
      video.preload = 'metadata';
    }

    if (durEl) durEl.textContent = `⏱ ${take.formattedTime || '00:00'}`;
    if (sizeEl) sizeEl.textContent = `💾 ${take.fileSizeFormatted || '0 MB'}`;

    modal.style.display = 'flex';
  }

  function closeRecordingModal() {
    if (!shadowRoot) return;
    const modal = shadowRoot.getElementById('gp-rec-modal');
    const video = shadowRoot.getElementById('gp-rec-preview-video');
    if (modal) modal.style.display = 'none';
    if (video) {
      video.pause();
      video.removeAttribute('src');
      video.load();
    }
  }

  async function saveRecording() {
    if (!currentRecordedBlob) return;
    const RecClass = (typeof window !== 'undefined' && window.VideoRecorder) || 
                     (typeof self !== 'undefined' && self.VideoRecorder) || 
                     (typeof VideoRecorder !== 'undefined' ? VideoRecorder : null);

    const dateStr = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `ghostprompter-take-${dateStr}.webm`;

    if (RecClass && RecClass.saveVideoFile) {
      try {
        const res = await RecClass.saveVideoFile(currentRecordedBlob, filename);
        if (res && res.success) {
          closeRecordingModal();
          return;
        } else if (res && res.aborted) {
          return;
        }
      } catch (err) {
        console.warn('saveVideoFile error:', err);
      }
    }

    if (RecClass && RecClass.downloadBlob) {
      RecClass.downloadBlob(currentRecordedBlob, filename);
    } else {
      const a = document.createElement('a');
      a.href = currentRecordedUrl || URL.createObjectURL(currentRecordedBlob);
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
    closeRecordingModal();
  }

  function retakeRecording() {
    closeRecordingModal();
    if (viewportEl) {
      viewportEl.scrollTop = 0;
      scrollAccumulator = 0;
    }
    setTimeout(() => {
      startRecordingFlow(activeRecordingSource);
    }, 250);
  }

  /**
   * Auto-Scroll Engine & Pacing
   */
  function toggleAutoScroll() {
    if (!hostEl || hostEl.style.display === 'none') {
      initOrToggleHUD().then(() => {
        isPlaying = true;
        updateAutoScrollUI();
        startScrollLoop();
      });
      return;
    }

    isPlaying = !isPlaying;
    updateAutoScrollUI();
    if (isPlaying) {
      startScrollLoop();
    } else {
      pauseScroll();
    }
  }

  function startAutoScroll() {
    if (!hostEl || hostEl.style.display === 'none') {
      initOrToggleHUD().then(() => {
        isPlaying = true;
        updateAutoScrollUI();
        startScrollLoop();
      });
      return;
    }

    if (!isPlaying) {
      isPlaying = true;
      updateAutoScrollUI();
      startScrollLoop();
    }
  }

  function pauseAutoScroll() {
    if (isPlaying) {
      isPlaying = false;
      updateAutoScrollUI();
      pauseScroll();
    }
  }

  function updateAutoScrollUI() {
    if (!shadowRoot) return;
    const playBtn = shadowRoot.getElementById('gp-btn-play') || shadowRoot.getElementById('gp-btn-autoscroll');
    const modeBadge = shadowRoot.getElementById('gp-mode-badge');
    const hdrWpm = shadowRoot.getElementById('gp-hdr-wpm-val');

    if (hdrWpm) {
      hdrWpm.textContent = `${currentSettings.wpm || 130} WPM`;
    }

    if (playBtn) {
      if (isPlaying) {
        playBtn.innerHTML = '<span class="gp-btn-icon-symbol">⏸</span><span class="gp-btn-label"> Pause</span>';
        playBtn.classList.add('gp-scrolling');
        playBtn.classList.add('active');
        playBtn.title = 'Spacebar: Pause Auto-Scroll';
      } else {
        playBtn.innerHTML = '<span class="gp-btn-icon-symbol">▶</span><span class="gp-btn-label"> Play</span>';
        playBtn.classList.remove('gp-scrolling');
        playBtn.classList.remove('active');
        playBtn.title = 'Spacebar: Start Auto-Scroll';
      }
    }

    if (modeBadge) {
      if (isPlaying) {
        modeBadge.innerHTML = `<span class="gp-badge-long">● SCROLLING (${currentSettings.wpm || 130} WPM)</span><span class="gp-badge-short">● ${currentSettings.wpm || 130} WPM</span>`;
        modeBadge.className = 'gp-badge gp-badge-scrolling';
      } else {
        const modeStr = (currentSettings.trackingMode || 'AUTO').toUpperCase();
        modeBadge.innerHTML = `<span class="gp-badge-long">${modeStr}</span><span class="gp-badge-short">${modeStr.substring(0, 4)}</span>`;
        modeBadge.className = 'gp-badge';
      }
    }
  }

  function toggleGhostMode() {
    isGhostMode = !isGhostMode;
    windowEl.classList.toggle('gp-ghost-mode', isGhostMode);
    const ghostBtn = shadowRoot ? shadowRoot.getElementById('gp-btn-ghost') : null;
    if (ghostBtn) ghostBtn.classList.toggle('active', isGhostMode);
    applyWindowAppearance();
  }

  let scrollAccumulator = 0;

  function nudgeScroll(pixels) {
    if (!viewportEl) return;
    viewportEl.style.scrollBehavior = 'smooth';
    viewportEl.scrollTop += pixels;
    scrollAccumulator = viewportEl.scrollTop + pixels;
  }

  function adjustSpeed(deltaWpm) {
    currentSettings.wpm = Math.max(50, Math.min(320, (currentSettings.wpm || 130) + deltaWpm));
    const slider = shadowRoot ? shadowRoot.getElementById('gp-range-wpm') : null;
    const val = shadowRoot ? shadowRoot.getElementById('gp-val-wpm') : null;
    const hdrVal = shadowRoot ? shadowRoot.getElementById('gp-hdr-wpm-val') : null;
    if (slider) slider.value = currentSettings.wpm;
    if (val) val.textContent = currentSettings.wpm;
    if (hdrVal) hdrVal.textContent = `${currentSettings.wpm} WPM`;
    updateAutoScrollUI();
    saveData({ settings: currentSettings });
  }

  /**
   * Continuous Smooth Scroll Animation Loop
   */
  function startScrollLoop() {
    if (scrollAnimFrame) cancelAnimationFrame(scrollAnimFrame);
    if (!viewportEl) return;

    viewportEl.style.scrollBehavior = 'auto';

    // If user is already near the bottom, rewind to top so they can play smoothly
    const maxScroll = viewportEl.scrollHeight - viewportEl.clientHeight;
    if (maxScroll > 20 && viewportEl.scrollTop >= maxScroll - 20) {
      viewportEl.scrollTop = 0;
    }

    scrollAccumulator = viewportEl.scrollTop;
    let lastTime = performance.now();

    function frame(time) {
      if (!isPlaying || !viewportEl) return;

      const dt = Math.min((time - lastTime) / 1000, 0.1);
      lastTime = time;

      // Teleprompter pacing:
      // At 130 WPM (standard conversational pace), speed is ~22 pixels per second.
      // Formula: (wpm / 60) * pixelsPerWord
      const wpm = currentSettings.wpm || 130;
      const fontSize = currentSettings.fontSize || 24;
      const basePixelsPerSec = (wpm / 60) * (fontSize * 0.42);

      let speed = Math.max(8, basePixelsPerSec);
      if (scrollVelocity !== 0) {
        speed += scrollVelocity;
      }

      // Sync accumulator if user manually scrolled (mouse wheel, touch, or drag)
      if (Math.abs(viewportEl.scrollTop - scrollAccumulator) > 6) {
        scrollAccumulator = viewportEl.scrollTop;
      }

      if (speed > 0) {
        scrollAccumulator += speed * dt;
        viewportEl.scrollTop = scrollAccumulator;
      }

      // Check if reached end of script (only when there is actual scrollable overflow)
      const currentMax = viewportEl.scrollHeight - viewportEl.clientHeight;
      if (currentMax > 20 && viewportEl.scrollTop >= currentMax - 3) {
        isPlaying = false;
        updateAutoScrollUI();
        pauseScroll();
        if (isRecording) {
          stopRecordingFlow();
        }
        return;
      }

      scrollAnimFrame = requestAnimationFrame(frame);
    }

    scrollAnimFrame = requestAnimationFrame(frame);
  }

  function pauseScroll() {
    if (scrollAnimFrame) {
      cancelAnimationFrame(scrollAnimFrame);
      scrollAnimFrame = null;
    }
  }

  /**
   * Messaging & Remote Events
   */
  function sendMessageToExtension(msg) {
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
      try {
        chrome.runtime.sendMessage(msg);
      } catch (e) {}
    }
  }

  // Listen for messages from background service-worker or popup
  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (!message || !message.type) return;

      if (message.type === 'TOGGLE_PROMPTER') {
        initOrToggleHUD().then(() => {
          sendResponse({ status: 'ok', isPlaying, isTransparentMode });
        }).catch(err => {
          sendResponse({ status: 'error', error: err.message });
        });
        return true; // Keep port open for async response
      }

      if (message.type === 'TOGGLE_GHOST_MODE') {
        toggleGhostMode();
        sendResponse({ status: 'ok', ghostMode: isGhostMode });
        return true;
      }

      if (message.type === 'TOGGLE_PAUSE' || message.type === 'TOGGLE_AUTO_SCROLL') {
        toggleAutoScroll();
        sendResponse({ status: 'ok', isPlaying });
        return true;
      }

      if (message.type === 'START_AUTO_SCROLL') {
        if (!hostEl || hostEl.style.display === 'none') {
          initOrToggleHUD().then(() => {
            startAutoScroll();
            sendResponse({ status: 'ok', isPlaying: true });
          });
          return true;
        } else {
          startAutoScroll();
          sendResponse({ status: 'ok', isPlaying: true });
          return true;
        }
      }

      if (message.type === 'STOP_AUTO_SCROLL') {
        pauseAutoScroll();
        sendResponse({ status: 'ok', isPlaying: false });
        return true;
      }

      if (message.type === 'TOGGLE_TRANSPARENCY') {
        toggleTransparency();
        sendResponse({ status: 'ok', isTransparentMode });
        return true;
      }

      if (message.type === 'SET_TRANSPARENCY_MODE') {
        if (message.preset) {
          setTransparencyPreset(message.preset);
        } else if (typeof message.opacity === 'number') {
          currentSettings.opacity = message.opacity;
          isTransparentMode = message.opacity < 0.65;
          isSolidMode = !isTransparentMode;
          currentSettings.isTransparentMode = isTransparentMode;
          applyWindowAppearance();
          saveData({ settings: currentSettings });
        }
        sendResponse({ status: 'ok', isTransparentMode, opacity: currentSettings.opacity });
        return true;
      }

      if (message.type === 'SET_WPM') {
        if (typeof message.wpm === 'number') {
          adjustSpeed(message.wpm - (currentSettings.wpm || 130));
        }
        sendResponse({ status: 'ok', wpm: currentSettings.wpm });
        return true;
      }

      if (message.type === 'TOGGLE_TOOLBAR') {
        toggleToolbar(message.forceState);
        sendResponse({ status: 'ok', isToolbarCollapsed: currentSettings.isToolbarCollapsed });
        return true;
      }

      if (message.type === 'TOGGLE_RECORDING') {
        toggleRecording(message.sourceType);
        sendResponse({ status: 'ok', isRecording });
        return true;
      }

      if (message.type === 'START_SCREEN_RECORDING') {
        if (!hostEl || hostEl.style.display === 'none') {
          initOrToggleHUD().then(() => {
            startRecordingFlow('screen');
            sendResponse({ status: 'ok', isRecording: true });
          });
        } else {
          startRecordingFlow('screen');
          sendResponse({ status: 'ok', isRecording: true });
        }
        return true;
      }

      if (message.type === 'START_CAMERA_RECORDING') {
        if (!hostEl || hostEl.style.display === 'none') {
          initOrToggleHUD().then(() => {
            startRecordingFlow('camera');
            sendResponse({ status: 'ok', isRecording: true });
          });
        } else {
          startRecordingFlow('camera');
          sendResponse({ status: 'ok', isRecording: true });
        }
        return true;
      }

      if (message.type === 'OPEN_PIP' || message.type === 'TOGGLE_PIP') {
        const triggerOpen = () => {
          if (shadowRoot) {
            const btn = shadowRoot.getElementById('gp-btn-popout');
            if (btn) {
              btn.dataset.compact = message.compactBarOnly ? 'true' : 'false';
              btn.click();
            }
          }
        };
        if (shadowRoot) {
          triggerOpen();
        } else {
          initOrToggleHUD().then(() => {
            setTimeout(triggerOpen, 100);
          });
        }
        sendResponse({ status: 'ok' });
        return true;
      }

      if (message.type === 'GAZE_TRACKING_UPDATE') {
        handleGazeUpdate(message);
        return;
      }

      if (message.type === 'SET_FOCUS_LINE_VISIBLE') {
        setFocusLineVisible(message.visible);
        sendResponse({ status: 'ok' });
        return true;
      }

      if (message.type === 'TOGGLE_MINIMIZE') {
        toggleMinimize();
        sendResponse({ status: 'ok' });
        return true;
      }

      if (message.type === 'SPEECH_SYNC_UPDATE') {
        handleSpeechUpdate(message);
        return;
      }
    });
  }

  // Cross-Tab Realtime Synchronization via chrome.storage.onChanged
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'local') return;

      if (changes.settings && changes.settings.newValue) {
        const s = changes.settings.newValue;
        currentSettings = { ...currentSettings, ...s };
        if (s.wpm && shadowRoot) {
          const wpmVal = shadowRoot.getElementById('gp-val-wpm');
          const hdrWpmVal = shadowRoot.getElementById('gp-hdr-wpm-val');
          if (wpmVal) wpmVal.textContent = s.wpm;
          if (hdrWpmVal) hdrWpmVal.textContent = `${s.wpm} WPM`;
        }
        if (s.fontSize && scriptBodyEl) {
          scriptBodyEl.style.fontSize = `${s.fontSize}px`;
        }
        if (typeof s.isTransparentMode === 'boolean' && s.isTransparentMode !== isTransparentMode) {
          isTransparentMode = s.isTransparentMode;
          isSolidMode = !isTransparentMode;
          applyWindowAppearance();
        }
        if (typeof s.showFocusLine === 'boolean') {
          setFocusLineVisible(s.showFocusLine);
        }
        if (typeof s.isWindowMinimized === 'boolean') {
          toggleMinimize(s.isWindowMinimized);
        }
      }

      if (changes.activeScriptId && changes.activeScriptId.newValue) {
        const newId = changes.activeScriptId.newValue;
        loadData().then(data => {
          const scr = (data.scripts || []).find(s => s.id === newId);
          if (scr && scriptBodyEl) {
            currentScript = scr;
            scriptBodyEl.innerText = scr.content || '';
            const scriptSelect = shadowRoot ? shadowRoot.getElementById('gp-select-script') : null;
            if (scriptSelect) scriptSelect.value = newId;
          }
        });
      }
    });
  }

  function handleGazeUpdate(data) {
    if (!shadowRoot) return;
    const dot = shadowRoot.getElementById('gp-gaze-dot');
    if (!dot) return;

    if (data.direction === 'down' || data.glanceZone === 'lower') {
      dot.className = 'gp-dot active-green';
      scrollVelocity = 25;
    } else if (data.direction === 'up' || data.glanceZone === 'top') {
      dot.className = 'gp-dot active-green';
      scrollVelocity = -15;
    } else if (data.glanceZone === 'away') {
      dot.className = 'gp-dot active-amber';
      scrollVelocity = 0;
    } else {
      dot.className = 'gp-dot active-cyan';
      scrollVelocity = 0;
    }
  }

  function handleSpeechUpdate(data) {
    if (!shadowRoot) return;
    const dot = shadowRoot.getElementById('gp-speech-dot');
    if (dot) {
      dot.className = 'gp-dot active-cyan';
      setTimeout(() => {
        if (dot) dot.className = 'gp-dot active-cyan';
      }, 300);
    }
    if (isPlaying && viewportEl && data.advancePixels) {
      viewportEl.scrollTop += data.advancePixels;
    }
  }

  // Expose global controller
  window.GhostPrompter = {
    toggle: initOrToggleHUD,
    openPiP: () => {
      if (shadowRoot) {
        const btn = shadowRoot.getElementById('gp-btn-popout');
        if (btn) btn.click();
      } else {
        initOrToggleHUD().then(() => {
          setTimeout(() => {
            if (shadowRoot) {
              const btn = shadowRoot.getElementById('gp-btn-popout');
              if (btn) btn.click();
            }
          }, 100);
        });
      }
    },
    toggleAutoScroll: toggleAutoScroll,
    startAutoScroll: startAutoScroll,
    pauseAutoScroll: pauseAutoScroll,
    togglePlay: toggleAutoScroll,
    toggleTransparency: toggleTransparency,
    setTransparencyPreset: setTransparencyPreset,
    toggleGhostMode: toggleGhostMode,
    toggleToolbar: toggleToolbar,
    toggleRecording: toggleRecording,
    startScreenRecording: () => toggleRecording('screen'),
    startCameraRecording: () => toggleRecording('camera'),
    nudge: nudgeScroll,
    adjustSpeed: adjustSpeed,
    isPlaying: () => isPlaying,
    isRecording: () => isRecording,
    isTransparent: () => isTransparentMode,
    isToolbarCollapsed: () => currentSettings ? currentSettings.isToolbarCollapsed : true
  };

  console.log('GhostPrompter content script loaded. Alt+P: Toggle Prompter | Alt+R: Record | Alt+S: Controls | Alt+T: Transparent | Space: Auto-Scroll');
})();
