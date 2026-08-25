const viewerConfigs = [
  { id: 'viewer1', webm: 'PCBvideo/stm32_fc.webm',     mp4: 'PCBvideo/stm32_fc.mp4'     },
  { id: 'viewer2', webm: 'PCBvideo/esp32_fc.webm',     mp4: 'PCBvideo/esp32_fc.mp4'     },
  { id: 'viewer3', webm: 'PCBvideo/diff_breakout.webm', mp4: 'PCBvideo/diff_breakout.mp4' },
  { id: 'viewer4', webm: 'PCBvideo/coil_driver.webm',  mp4: 'PCBvideo/coil_driver.mp4'  },
  { id: 'viewer5', webm: 'PCBvideo/cm4_interface.webm', mp4: 'PCBvideo/cm4_interface.mp4' },
  { id: 'viewer6', webm: 'PCBvideo/fc4.webm',          mp4: 'PCBvideo/fc4.mp4'          },
  { id: 'viewer7', webm: 'PCBvideo/mini_fc.webm',      mp4: 'PCBvideo/mini_fc.mp4'      },
];

const viewers = [];

const observer = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      const idxStr = entry.target.dataset.viewerIndex;
      if (idxStr == null) continue;
      const viewer = viewers[parseInt(idxStr, 10)];
      if (viewer) viewer.setVisible(entry.isIntersecting);
    }
  },
  { threshold: 0.25 }
);

function createViewer(videoEl, webmSrc, mp4Src, sensitivity = 300) {
  if (!videoEl) return;

  // Set video sources
  const srcWebm = document.createElement('source');
  srcWebm.src = webmSrc;
  srcWebm.type = 'video/webm';
  const srcMp4 = document.createElement('source');
  srcMp4.src = mp4Src;
  srcMp4.type = 'video/mp4';
  videoEl.appendChild(srcWebm);
  videoEl.appendChild(srcMp4);

  videoEl.muted = true;
  videoEl.loop = true;
  videoEl.playsInline = true;
  videoEl.preload = 'auto';

  let autoEnabledByUser = true;
  let isVisible = false;
  let isDragging = false;
  let startX = 0;

  // sensitivity = pixels of drag per full video duration
  // lower = more sensitive, higher = takes more dragging

  function setVisible(visible) {
    isVisible = visible;
    if (visible && autoEnabledByUser) {
      videoEl.play();
    } else {
      videoEl.pause();
    }
  }

  // Mouse drag
  videoEl.addEventListener('mousedown', (e) => {
    isDragging = true;
    startX = e.clientX;
    autoEnabledByUser = false;
    videoEl.pause();
    updateToggleButton(viewerIndex, false);
  });

  window.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    const deltaX = e.clientX - startX;
    startX = e.clientX;
    scrub(deltaX);
  });

  window.addEventListener('mouseup', () => { isDragging = false; });

  videoEl.ondragstart = () => false;

  // Touch drag
  videoEl.addEventListener('touchstart', (e) => {
    startX = e.touches[0].clientX;
    autoEnabledByUser = false;
    videoEl.pause();
    updateToggleButton(viewerIndex, false);
  }, { passive: true });

  videoEl.addEventListener('touchmove', (e) => {
    const deltaX = e.touches[0].clientX - startX;
    startX = e.touches[0].clientX;
    scrub(deltaX);
  }, { passive: true });

  function scrub(deltaX) {
    if (!videoEl.duration) return;
    const deltaTime = (deltaX / sensitivity) * videoEl.duration;
    let newTime = videoEl.currentTime + deltaTime;
    // Wrap around
    if (newTime < 0) newTime += videoEl.duration;
    if (newTime >= videoEl.duration) newTime -= videoEl.duration;
    videoEl.currentTime = newTime;
  }

  const viewerIndex = viewers.length;

  const viewerObj = {
    el: videoEl,
    reset: () => {
      autoEnabledByUser = false;
      videoEl.pause();
      videoEl.currentTime = 0;
      updateToggleButton(viewerIndex, false);
    },
    toggle: () => {
      autoEnabledByUser = !autoEnabledByUser;
      if (autoEnabledByUser && isVisible) {
        videoEl.play();
      } else {
        videoEl.pause();
      }
      updateToggleButton(viewerIndex, autoEnabledByUser);
    },
    setVisible,
  };

  viewers.push(viewerObj);
  videoEl.dataset.viewerIndex = String(viewerIndex);
  observer.observe(videoEl);
}

function updateToggleButton(viewerIndex, isOn) {
  const button = document.getElementById(`toggle-rotate-${viewerIndex}`);
  if (button) button.textContent = isOn ? 'Stop Rotation' : 'Auto Rotate';
}

function resetViewer(index) {
  if (viewers[index]) viewers[index].reset();
}

function toggleRotation(index) {
  if (viewers[index]) viewers[index].toggle();
}

for (const config of viewerConfigs) {
  const el = document.getElementById(config.id);
  if (el) createViewer(el, config.webm, config.mp4);
}

function showModal(id) {
  const modal = document.getElementById(id);
  modal.style.display = 'flex';
  function outsideClickHandler(e) {
    if (e.target === modal) {
      hideModal(id);
      modal.removeEventListener('click', outsideClickHandler);
    }
  }
  setTimeout(() => modal.addEventListener('click', outsideClickHandler), 0);
}

function hideModal(id) {
  document.getElementById(id).style.display = 'none';
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    const openModal = document.querySelector('.modal[style*="display: flex"]');
    if (openModal) openModal.style.display = 'none';
  }
});

window.resetViewer = resetViewer;
window.toggleRotation = toggleRotation;
