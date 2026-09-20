/**
 * GhostPrompter Floating Window Controller
 * Manages standalone window auto-scrolling, speed, transparency, and
 * 1-click upgrade to native OS Always-On-Top Document Picture-in-Picture.
 */

document.addEventListener('DOMContentLoaded', async () => {
  const bodyRoot = document.getElementById('body-root');
  const btnPip = document.getElementById('btn-pip-toggle');
  const btnPlay = document.getElementById('btn-play-toggle');
  const playIcon = document.getElementById('play-icon');
  const playLabel = document.getElementById('play-label');
  const btnWpmDec = document.getElementById('btn-wpm-dec');
  const btnWpmInc = document.getElementById('btn-wpm-inc');
  const labelWpm = document.getElementById('label-wpm');
  const btnTrans = document.getElementById('btn-trans-toggle');
  const transIcon = document.getElementById('trans-icon');
  const transLabel = document.getElementById('trans-label');
  const btnFontDec = document.getElementById('btn-font-dec');
  const btnFontInc = document.getElementById('btn-font-inc');
  const labelFont = document.getElementById('label-font');
  const btnRewind = document.getElementById('btn-rewind');
  const selectScript = document.getElementById('select-script');
  const viewport = document.getElementById('float-viewport');
  const textEl = document.getElementById('float-text');

  let currentWpm = 130;
  let currentFontSize = 24;
  let isTransparent = false;
  let isScrolling = false;
  let scrollAnimId = null;
  let scrollAccumulator = 0;

  let scriptsList = [];
  let currentScript = null;

  const Storage = window.GhostStorage;
  const pipManager = new PiPPrompterManager();

  // Load Saved Data
  if (Storage) {
    const settings = await Storage.getSettings();
    if (settings.wpm) currentWpm = settings.wpm;
    if (settings.fontSize) currentFontSize = settings.fontSize;
    if (typeof settings.isTransparentMode === 'boolean') isTransparent = settings.isTransparentMode;

    scriptsList = await Storage.getScripts();
    const activeId = await Storage.getActiveScriptId();
    currentScript = scriptsList.find(s => s.id === activeId) || scriptsList[0];
  } else {
    currentScript = {
      id: 'default',
      title: 'Welcome Script',
      content: 'Welcome to your Floating GhostPrompter Window! 👻\n\n• Use this window on secondary screens or beside slides.\n• Click "📌 Always-On-Top (PiP)" to keep it floating above ALL desktop apps!\n• Press Spacebar to play/pause auto-scrolling.'
    };
    scriptsList = [currentScript];
  }

  // Initialize UI Values
  labelWpm.textContent = `${currentWpm} WPM`;
  labelFont.textContent = `${currentFontSize}px`;
  document.documentElement.style.setProperty('--sp-font-size', `${currentFontSize}px`);

  if (isTransparent) {
    bodyRoot.className = 'mode-transparent';
    transIcon.textContent = '⬛';
    transLabel.textContent = 'Solid';
  } else {
    bodyRoot.className = 'mode-solid';
    transIcon.textContent = '🪟';
    transLabel.textContent = 'Transparent';
  }

  // Populate Script Select
  if (scriptsList.length > 0) {
    selectScript.innerHTML = scriptsList.map(s =>
      `<option value="${s.id}" ${currentScript && s.id === currentScript.id ? 'selected' : ''}>${s.title}</option>`
    ).join('');
    if (currentScript && currentScript.content) {
      textEl.innerText = currentScript.content;
    }
  }

  // Auto-Scroll Engine
  function stepScroll() {
    if (!isScrolling) return;

    const pixelsPerSecond = (currentWpm * 22) / 60;
    scrollAccumulator += pixelsPerSecond / 60;

    if (scrollAccumulator >= 1) {
      const toMove = Math.floor(scrollAccumulator);
      viewport.scrollTop += toMove;
      scrollAccumulator -= toMove;

      if (viewport.scrollTop + viewport.clientHeight >= viewport.scrollHeight - 5) {
        setScrolling(false);
        return;
      }
    }

    scrollAnimId = requestAnimationFrame(stepScroll);
  }

  function setScrolling(active) {
    isScrolling = active;
    btnPlay.classList.toggle('active', active);
    playIcon.textContent = active ? '⏸' : '▶';
    playLabel.textContent = active ? 'Pause' : 'Play';

    if (active) {
      scrollAnimId = requestAnimationFrame(stepScroll);
    } else if (scrollAnimId) {
      cancelAnimationFrame(scrollAnimId);
      scrollAnimId = null;
    }
  }

  btnPlay.addEventListener('click', () => {
    setScrolling(!isScrolling);
  });

  // WPM adjustments
  btnWpmDec.addEventListener('click', () => {
    currentWpm = Math.max(50, currentWpm - 10);
    labelWpm.textContent = `${currentWpm} WPM`;
    if (Storage) Storage.saveSettings({ wpm: currentWpm });
  });

  btnWpmInc.addEventListener('click', () => {
    currentWpm = Math.min(350, currentWpm + 10);
    labelWpm.textContent = `${currentWpm} WPM`;
    if (Storage) Storage.saveSettings({ wpm: currentWpm });
  });

  // Font adjustments
  btnFontDec.addEventListener('click', () => {
    currentFontSize = Math.max(16, currentFontSize - 2);
    labelFont.textContent = `${currentFontSize}px`;
    document.documentElement.style.setProperty('--sp-font-size', `${currentFontSize}px`);
    if (Storage) Storage.saveSettings({ fontSize: currentFontSize });
  });

  btnFontInc.addEventListener('click', () => {
    currentFontSize = Math.min(48, currentFontSize + 2);
    labelFont.textContent = `${currentFontSize}px`;
    document.documentElement.style.setProperty('--sp-font-size', `${currentFontSize}px`);
    if (Storage) Storage.saveSettings({ fontSize: currentFontSize });
  });

  // Transparency toggle
  btnTrans.addEventListener('click', () => {
    isTransparent = !isTransparent;
    bodyRoot.className = isTransparent ? 'mode-transparent' : 'mode-solid';
    transIcon.textContent = isTransparent ? '⬛' : '🪟';
    transLabel.textContent = isTransparent ? 'Solid' : 'Transparent';
    if (Storage) Storage.saveSettings({ isTransparentMode: isTransparent });
  });

  // Rewind
  btnRewind.addEventListener('click', () => {
    viewport.scrollTop = 0;
    scrollAccumulator = 0;
  });

  // Script selection
  selectScript.addEventListener('change', (e) => {
    const id = e.target.value;
    const found = scriptsList.find(s => s.id === id);
    if (found) {
      currentScript = found;
      textEl.innerText = found.content || '';
      viewport.scrollTop = 0;
      scrollAccumulator = 0;
      if (Storage) Storage.setActiveScriptId(id);
    }
  });

  // Text autosave on edit
  textEl.addEventListener('input', () => {
    if (currentScript) {
      currentScript.content = textEl.innerText;
      if (Storage) {
        const idx = scriptsList.findIndex(s => s.id === currentScript.id);
        if (idx >= 0) scriptsList[idx] = currentScript;
        Storage.saveScript(currentScript);
      }
    }
  });

  // 1-Click Always-On-Top Document Picture-in-Picture
  btnPip.addEventListener('click', async () => {
    if (isScrolling) setScrolling(false);

    await pipManager.openPiP({
      width: 680,
      height: 340,
      wpm: currentWpm,
      fontSize: currentFontSize,
      isTransparent: isTransparent,
      script: currentScript,
      scripts: scriptsList,
      initialScrollTop: viewport.scrollTop,
      onClose: (result) => {
        if (result && typeof result.finalScrollTop === 'number') {
          viewport.scrollTop = result.finalScrollTop;
        }
        if (result && result.wpm) {
          currentWpm = result.wpm;
          labelWpm.textContent = `${currentWpm} WPM`;
        }
      }
    });
  });

  // Global Keyboard Shortcuts
  window.addEventListener('keydown', (e) => {
    if (e.target === textEl && (e.key.length === 1 || e.key === 'Backspace' || e.key === 'Enter')) {
      return;
    }

    if (e.code === 'Space') {
      e.preventDefault();
      setScrolling(!isScrolling);
    } else if (e.key === '[') {
      e.preventDefault();
      btnWpmDec.click();
    } else if (e.key === ']') {
      e.preventDefault();
      btnWpmInc.click();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      viewport.scrollTop = Math.max(0, viewport.scrollTop - 40);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      viewport.scrollTop += 40;
    }
  });

  // Real-time Storage Sync from other tabs
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'local') return;

      if (changes.settings && changes.settings.newValue) {
        const s = changes.settings.newValue;
        if (s.wpm && s.wpm !== currentWpm) {
          currentWpm = s.wpm;
          labelWpm.textContent = `${currentWpm} WPM`;
        }
        if (s.fontSize && s.fontSize !== currentFontSize) {
          currentFontSize = s.fontSize;
          labelFont.textContent = `${currentFontSize}px`;
          document.documentElement.style.setProperty('--sp-font-size', `${currentFontSize}px`);
        }
        if (typeof s.isTransparentMode === 'boolean' && s.isTransparentMode !== isTransparent) {
          isTransparent = s.isTransparentMode;
          bodyRoot.className = isTransparent ? 'mode-transparent' : 'mode-solid';
          transIcon.textContent = isTransparent ? '⬛' : '🪟';
          transLabel.textContent = isTransparent ? 'Solid' : 'Transparent';
        }
      }

      if (changes.activeScriptId && changes.activeScriptId.newValue) {
        const newId = changes.activeScriptId.newValue;
        if (selectScript.value !== newId) {
          selectScript.value = newId;
          const found = scriptsList.find(s => s.id === newId);
          if (found) {
            currentScript = found;
            textEl.innerText = found.content || '';
          }
        }
      }
    });
  }

  console.log('GhostPrompter Floating Window ready.');
});
