/**
 * GhostPrompter Test Page Controller
 * Simulates Google Meet / Zoom environment without violating Extension Content Security Policy.
 */

document.addEventListener('DOMContentLoaded', () => {
  const togglePrompterBtn = document.getElementById('test-btn-toggle-prompter');
  const toggleGhostBtn = document.getElementById('test-btn-ghost-toggle');
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
