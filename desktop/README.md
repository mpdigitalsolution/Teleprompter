# 👻 GhostPrompter Desktop

> **Universal Apple HIG Teleprompter with True Click-Through Ghost Mode & Global Hotkeys**  
> Built for Windows, macOS, and Linux using Electron & Web Standards.

---

## 🌟 Desktop Superpowers

* **Universal Desktop Overlay**: Floats on top of **ANY** desktop application — Zoom, Microsoft Teams, Google Meet, PowerPoint, Keynote, OBS Studio, Discord, Word, and VS Code.
* **True Ghost Mode (`Ctrl+Shift+G`)**: Native click-through pass-through using `win.setIgnoreMouseEvents(true, { forward: true })`. Advance your PowerPoint slides right through the translucent teleprompter text!
* **Compact Dynamic Island Mode (`Ctrl+Shift+M`)**: Collapses down to a sleek 38px pill positioned right below your webcam, maintaining 100% natural eye contact with your audience.
* **Apple Human Interface Design (macOS Sequoia / visionOS)**:
  * Multi-layer frosted glass vibrancy with specular border rim lighting.
  * Authentic macOS traffic lights (Close, Minimize, Studio).
  * Cupertino segmented controls, sliders, and San Francisco typography.
* **Universal Global Hotkeys**: Controls work even when presentation or meeting apps are running full-screen.
* **Low-End PC Hardware Optimizations**: 12px blur compositing, GPU layer isolation (`contain: content; transform: translateZ(0)`), zero-copy video pipeline, and 60fps smooth scrolling.

---

## ⌨️ Global System Hotkeys

| Hotkey | Action | Behavior |
|---|---|---|
| `Ctrl+Shift+Space` | **Play / Pause** | Toggle 60fps script auto-scroll |
| `Ctrl+Shift+Up` / `Down` | **Adjust Speed** | Increment / decrement speed by 5 WPM |
| `Ctrl+Shift+G` | **Toggle Ghost Mode** | Enable / disable click-through over slides & calls |
| `Ctrl+Shift+M` | **Dynamic Island** | Toggle between full prompter and camera pill |
| `Ctrl+Shift+F` | **Toggle Focus Line** | Toggle spotlight reading guide line |
| `Ctrl+Shift+O` | **Cycle Opacity** | Cycle presets: Solid (95%) → Dark (85%) → Glass (40%) → Clear (15%) |
| `Ctrl+Shift+H` | **Hide / Show Overlay** | Summon or dismiss floating prompter instantly |

---

## 🚀 Getting Started

### 1. Install Dependencies
```bash
cd D:\TELEPROMPTER\desktop
npm install
```

### 2. Start in Development Mode
```bash
npm start
```

### 3. Run Automated Tests
```bash
npm test
```

### 4. Build Executables / Installers
```bash
# Package portable folder
npm run pack

# Build Windows installer (.exe)
npm run dist
```

---

## 🏗️ Architecture & Folder Structure

```
D:\TELEPROMPTER\desktop\
├── src/
│   ├── main/                    # Main Process (Node.js)
│   │   ├── index.js             # App lifecycle & hardware flags
│   │   ├── windows/
│   │   │   ├── window-manager.js# Window coordinator & state broadcaster
│   │   │   ├── prompter-window.js# Frameless visionOS glass overlay window
│   │   │   └── studio-window.js # macOS Sequoia Pro Studio Dashboard
│   │   ├── services/
│   │   │   ├── storage-service.js # Persistent file storage (scripts, settings)
│   │   │   ├── shortcut-service.js# Global hotkey registration
│   │   │   ├── tray-service.js    # System tray menu & quick switcher
│   │   │   └── recorder-service.js# Desktop screen & window capture bridge
│   │   └── ipc/
│   │       ├── ipc-channels.js  # Type-safe IPC channel constants
│   │       └── ipc-handlers.js  # Main process message dispatcher
│   ├── preload/                 # Secure ContextBridge isolation
│   │   ├── prompter-preload.js  # window.prompterAPI
│   │   └── studio-preload.js    # window.studioAPI
│   └── renderer/                # Front-End UI
│       ├── shared/
│       │   ├── css/             # Apple HIG design tokens & components
│       │   └── engines/         # 60fps ScrollerEngine
│       ├── prompter/            # Floating HUD Window
│       └── studio/              # Studio Dashboard
└── tests/                       # Unit tests (storage, scroller, window-manager)
```
