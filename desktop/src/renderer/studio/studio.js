/**
 * GhostPrompter Desktop — Studio Dashboard Controller
 * Handles script management, settings, take review, and prompter synchronization.
 */

document.addEventListener('DOMContentLoaded', async () => {
  // Elements
  const tabButtons = document.querySelectorAll('.sidebar-item');
  const tabPanes = document.querySelectorAll('.tab-pane');
  const scriptsCount = document.getElementById('scripts-count');
  const takesCount = document.getElementById('takes-count');
  const scriptsListContainer = document.getElementById('scripts-list-container');
  const btnNewScript = document.getElementById('btn-new-script');
  const editorTitle = document.getElementById('editor-title');
  const editorBody = document.getElementById('editor-body');
  const metaWords = document.getElementById('meta-words');
  const metaDuration = document.getElementById('meta-duration');
  const btnSaveScript = document.getElementById('btn-save-script');
  const btnDeleteScript = document.getElementById('btn-delete-script');
  const btnFloatActive = document.getElementById('btn-float-active');
  const btnLaunchPrompter = document.getElementById('btn-launch-prompter');

  const prefSpeed = document.getElementById('pref-speed');
  const prefSpeedVal = document.getElementById('pref-speed-val');
  const prefFontSize = document.getElementById('pref-font-size');
  const prefFontSizeVal = document.getElementById('pref-font-size-val');
  const prefFocusLine = document.getElementById('pref-focus-line');

  const titlebarClose = document.getElementById('titlebar-close');
  const titlebarMin = document.getElementById('titlebar-min');
  const titlebarMax = document.getElementById('titlebar-max');

  let scripts = [];
  let activeScript = null;
  let currentWPM = 160;

  // Tab Navigation
  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      tabButtons.forEach(b => b.classList.remove('active'));
      tabPanes.forEach(p => p.classList.remove('active'));

      btn.classList.add('active');
      const targetId = btn.getAttribute('data-tab');
      const targetPane = document.getElementById(targetId);
      if (targetPane) targetPane.classList.add('active');
    });
  });

  // Calculate Metrics
  function updateMetrics() {
    const text = editorBody.value.trim();
    const words = text ? text.split(/\s+/).length : 0;
    metaWords.textContent = `${words} words`;

    const totalSeconds = words > 0 ? Math.round((words / currentWPM) * 60) : 0;
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    metaDuration.textContent = `~${mins}:${secs < 10 ? '0' : ''}${secs} min`;
  }

  editorBody.addEventListener('input', updateMetrics);

  // Render Scripts List
  function renderScriptsList() {
    scriptsListContainer.innerHTML = '';
    scriptsCount.textContent = scripts.length;

    scripts.forEach(s => {
      const card = document.createElement('div');
      card.className = `script-card ${activeScript && activeScript.id === s.id ? 'active' : ''}`;
      
      const title = document.createElement('div');
      title.className = 'script-card-title';
      title.textContent = s.title;

      const snippet = document.createElement('div');
      snippet.className = 'script-card-snippet';
      snippet.textContent = (s.content || '').slice(0, 100);

      card.appendChild(title);
      card.appendChild(snippet);

      card.addEventListener('click', () => {
        selectScript(s);
      });

      scriptsListContainer.appendChild(card);
    });
  }

  function selectScript(script) {
    activeScript = script;
    editorTitle.value = script.title || '';
    editorBody.value = script.content || '';
    updateMetrics();
    renderScriptsList();
  }

  // Load Initial Store Data
  if (window.studioAPI && window.studioAPI.getInitialData) {
    try {
      const data = await window.studioAPI.getInitialData();
      if (data) {
        scripts = data.scripts || [];
        const activeId = data.activeScriptId;
        activeScript = scripts.find(s => s.id === activeId) || scripts[0] || null;

        const settings = data.settings || {};
        currentWPM = settings.scrollSpeed || 160;
        prefSpeed.value = currentWPM;
        prefSpeedVal.textContent = `${currentWPM} WPM`;

        if (settings.fontSize) {
          prefFontSize.value = settings.fontSize;
          prefFontSizeVal.textContent = `${settings.fontSize} px`;
        }

        if (settings.focusLineVisible !== undefined) {
          prefFocusLine.checked = settings.focusLineVisible;
        }

        takesCount.textContent = (data.takes || []).length;

        if (activeScript) {
          selectScript(activeScript);
        } else {
          renderScriptsList();
        }
      }
    } catch (err) {
      console.warn('[Studio] Error loading store:', err);
    }
  }

  // New Script
  btnNewScript.addEventListener('click', () => {
    const newScript = {
      id: `script-${Date.now()}`,
      title: 'Untitled Presentation Script',
      content: '',
      updatedAt: new Date().toISOString()
    };
    scripts.unshift(newScript);
    selectScript(newScript);
    editorTitle.focus();
    editorTitle.select();
  });

  // Save Script
  btnSaveScript.addEventListener('click', async () => {
    if (!activeScript) return;
    activeScript.title = editorTitle.value.trim() || 'Untitled Script';
    activeScript.content = editorBody.value;
    activeScript.updatedAt = new Date().toISOString();

    if (window.studioAPI && window.studioAPI.saveScript) {
      await window.studioAPI.saveScript(activeScript);
    }
    renderScriptsList();
  });

  // Delete Script
  btnDeleteScript.addEventListener('click', async () => {
    if (!activeScript) return;
    const confirmDel = confirm(`Are you sure you want to delete "${activeScript.title}"?`);
    if (!confirmDel) return;

    if (window.studioAPI && window.studioAPI.deleteScript) {
      await window.studioAPI.deleteScript(activeScript.id);
    }

    scripts = scripts.filter(s => s.id !== activeScript.id);
    activeScript = scripts[0] || null;
    if (activeScript) {
      selectScript(activeScript);
    } else {
      editorTitle.value = '';
      editorBody.value = '';
      updateMetrics();
      renderScriptsList();
    }
  });

  // Float in Prompter
  btnFloatActive.addEventListener('click', () => {
    if (!activeScript) return;
    if (window.studioAPI) {
      window.studioAPI.setScript(activeScript);
      window.studioAPI.openPrompter();
    }
  });

  btnLaunchPrompter.addEventListener('click', () => {
    if (window.studioAPI) {
      if (activeScript) window.studioAPI.setScript(activeScript);
      window.studioAPI.openPrompter();
    }
  });

  // Settings Controls
  prefSpeed.addEventListener('input', (e) => {
    currentWPM = parseInt(e.target.value, 10);
    prefSpeedVal.textContent = `${currentWPM} WPM`;
    updateMetrics();
    if (window.studioAPI) window.studioAPI.setSpeed(currentWPM);
  });

  prefFontSize.addEventListener('input', (e) => {
    const size = parseInt(e.target.value, 10);
    prefFontSizeVal.textContent = `${size} px`;
  });

  // macOS Titlebar Controls
  titlebarClose.addEventListener('click', () => {
    if (window.studioAPI) window.studioAPI.closeWindow();
  });

  titlebarMin.addEventListener('click', () => {
    if (window.studioAPI) window.studioAPI.minimizeWindow();
  });

  titlebarMax.addEventListener('click', () => {
    if (window.studioAPI) window.studioAPI.maximizeWindow();
  });

  // IPC Event Sync
  if (window.studioAPI) {
    window.studioAPI.onScriptSaved((saved) => {
      const idx = scripts.findIndex(s => s.id === saved.id);
      if (idx >= 0) scripts[idx] = saved;
      else scripts.unshift(saved);
      renderScriptsList();
    });

    window.studioAPI.onScriptDeleted(({ id }) => {
      scripts = scripts.filter(s => s.id !== id);
      if (activeScript && activeScript.id === id) {
        activeScript = scripts[0] || null;
        if (activeScript) selectScript(activeScript);
      }
      renderScriptsList();
    });
  }
});
