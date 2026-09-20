/**
 * GhostPrompter Test Page Controller
 * Simulates Google Meet / Zoom environment without violating Extension Content Security Policy.
 */

document.addEventListener('DOMContentLoaded', () => {
  const togglePrompterBtn = document.getElementById('test-btn-toggle-prompter');
  const toggleGhostBtn = document.getElementById('test-btn-ghost-toggle');
  const toggleTransBtn = document.getElementById('test-btn-transparency');
  const toggleScrollBtn = document.getElementById('test-btn-autoscroll');
  const simGazeBtn = document.getElementById('test-btn-sim-gaze');
  const camBtn = document.getElementById('meet-btn-cam');
  const webcamVideo = document.getElementById('user-webcam');
  const webcamAvatar = document.getElementById('webcam-avatar');

  if (togglePrompterBtn) {
    togglePrompterBtn.addEventListener('click', () => {
      if (window.GhostPrompter && window.GhostPrompter.toggle) {
        window.GhostPrompter.toggle();
      }
    });
  }

  if (toggleTransBtn) {
    toggleTransBtn.addEventListener('click', () => {
      if (window.GhostPrompter && window.GhostPrompter.toggleTransparency) {
        window.GhostPrompter.toggleTransparency();
      }
    });
  }

  if (toggleScrollBtn) {
    toggleScrollBtn.addEventListener('click', () => {
      if (window.GhostPrompter && window.GhostPrompter.toggleAutoScroll) {
        window.GhostPrompter.toggleAutoScroll();
      }
    });
  }

  const toggleToolbarBtn = document.getElementById('test-btn-toolbar');
  if (toggleToolbarBtn) {
    toggleToolbarBtn.addEventListener('click', () => {
      if (window.GhostPrompter && window.GhostPrompter.toggleToolbar) {
        window.GhostPrompter.toggleToolbar();
      }
    });
  }

  const testBtnRec = document.getElementById('test-btn-rec');
  if (testBtnRec) {
    testBtnRec.addEventListener('click', () => {
      if (window.GhostPrompter && window.GhostPrompter.toggleRecording) {
        window.GhostPrompter.toggleRecording();
      }
    });
  }

  const testBtnPip = document.getElementById('test-btn-pip');
  if (testBtnPip) {
    testBtnPip.addEventListener('click', () => {
      if (window.GhostPrompter && window.GhostPrompter.openPiP) {
        window.GhostPrompter.openPiP();
      } else if (typeof PiPPrompterManager !== 'undefined' && PiPPrompterManager.isSupported()) {
        const mgr = new PiPPrompterManager();
        mgr.openPiP();
      } else {
        window.open('src/floating/floating.html', 'GhostPrompterFloating', 'width=700,height=360,menubar=no,toolbar=no');
      }
    });
  }

  if (toggleGhostBtn) {
    toggleGhostBtn.addEventListener('click', () => {
      if (window.GhostPrompter && window.GhostPrompter.toggleGhostMode) {
        window.GhostPrompter.toggleGhostMode();
      }
    });
  }

  // Simulate eye glance cycling for testing scroll behavior
  let simIndex = 0;
  const simZones = ['lower', 'middle', 'top', 'away'];
  if (simGazeBtn) {
    simGazeBtn.addEventListener('click', () => {
      const zone = simZones[simIndex % simZones.length];
      simIndex++;
      simGazeBtn.textContent = `👁️ Simulated Gaze: ${zone.toUpperCase()}`;
      window.postMessage({ type: 'GAZE_SIMULATION', zone }, '*');

      const evt = new CustomEvent('ghost-prompter-gaze', { detail: { glanceZone: zone } });
      window.dispatchEvent(evt);
    });
  }

  // Toggle real webcam in participant card
  let webcamActive = false;
  if (camBtn) {
    camBtn.addEventListener('click', async () => {
      if (!webcamActive) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: true });
          webcamVideo.srcObject = stream;
          webcamVideo.style.display = 'block';
          webcamAvatar.style.display = 'none';
          camBtn.classList.add('active');
          webcamActive = true;
        } catch (e) {
          alert('Could not access webcam: ' + e.message);
        }
      } else {
        if (webcamVideo.srcObject) {
          webcamVideo.srcObject.getTracks().forEach(t => t.stop());
          webcamVideo.srcObject = null;
        }
        webcamVideo.style.display = 'none';
        webcamAvatar.style.display = 'flex';
        camBtn.classList.remove('active');
        webcamActive = false;
      }
    });
  }

  // Meeting button click alerts to demonstrate Click-Through Ghost Mode
  document.querySelectorAll('.ctrl-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn !== camBtn) {
        console.log(`Meeting button clicked: ${btn.title || btn.textContent}`);
      }
    });
  });

  // Automatically launch prompter on test page if opened directly
  setTimeout(() => {
    if (window.GhostPrompter && window.GhostPrompter.toggle) {
      window.GhostPrompter.toggle();
    }
  }, 400);
});
