# GhostPrompter 👻

**Low-Resource Eye-Tracking & Speech-Sync Chrome Teleprompter**

GhostPrompter is a 100% client-side Chrome extension (Manifest V3) that provides a borderless, transparent Heads-Up Display (HUD) teleprompter overlay. Designed for low-end PCs and video calls (Google Meet, Zoom Web, Microsoft Teams, Loom, YouTube recordings).

---

## ⚡ Core Features

- **Draggable & Resizable Stealth HUD**: Position directly below your webcam lens. Freely adjust width, height, and position.
- **Glance-Driven Auto-Scroll**: Tracks your eye gaze in real-time. As your eyes read down into the lower third of the prompt box, text smoothly advances. If you look away, scrolling immediately pauses.
- **Speech-Sync Dual Scroll**: Optionally matches spoken speech cadence to script tokens using the browser's speech recognition engine.
- **Low-Resource Architecture**: Throttled 10–12 FPS processing on sub-sampled 320x240 video frames, keeping CPU load minimal on budget hardware.
- **Click-Through Ghost Mode (`Alt + C`)**: Prompter text stays visible while mouse clicks pass directly through to Google Meet or Zoom controls behind it!
- **Stealth Aesthetic Controls**: Background opacity slider (0% to 100% transparent), font size, mirror mode (for physical beamsplitter teleprompters), and auto-hiding toolbar on mouse idle.
- **100% Privacy & Local-First**: Zero external servers, zero video data transmitted. Everything runs client-side and settings are stored in `chrome.storage.local`.

---

## 🚀 Installation Guide

1. Open Google Chrome and navigate to `chrome://extensions/`.
2. Toggle **Developer mode** on (top-right corner).
3. Click **Load unpacked** (top-left corner).
4. Select the directory: `D:\TELEPROMPTER`.
5. Pin **GhostPrompter** to your Chrome toolbar.

---

## 🎯 Quick Start & Calibration

1. Click the GhostPrompter extension icon in your Chrome toolbar or open the **Setup & Calibration** page.
2. Grant camera and microphone permissions when prompted (one-time setup).
3. Calibrate your neutral gaze by looking straight into your webcam for 3 seconds.
4. Open any website (e.g. Google Meet, Zoom Web, or any tab).
5. Press **`Alt + P`** to show/hide the teleprompter HUD.

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Alt + P` | Toggle GhostPrompter HUD visibility |
| `Alt + C` | Toggle Click-Through Ghost Mode |
| `Alt + Space` or `Space` | Pause / Resume scroll |
| `Up Arrow` | Micro-nudge scroll up (30px) |
| `Down Arrow` | Micro-nudge scroll down (30px) |
| `[` / `]` | Decrease / Increase scroll speed |
| `Esc` | Hide HUD |
