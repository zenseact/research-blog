// Keyboard + drag-to-look mouse input. No pointer-lock — cursor stays
// visible, look is engaged only while a mouse button is held. Listens on
// `window` for mouseup/mousemove so dragging continues even when the
// pointer leaves the canvas bounds.

export function createInput(canvas) {
  const keys = new Set();
  let mouseDx = 0;
  let mouseDy = 0;
  let wheelDelta = 0;
  let dragging = false;
  let dragButton = -1; // 0 = left (orbit), 2 = right (pan); -1 = none
  const oneShot = new Set();

  canvas.addEventListener('mousedown', (e) => {
    e.preventDefault();
    dragging = true;
    dragButton = e.button;
    canvas.classList.add('grabbing');
  });

  window.addEventListener('mouseup', () => {
    if (!dragging) return;
    dragging = false;
    dragButton = -1;
    canvas.classList.remove('grabbing');
  });

  window.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    mouseDx += e.movementX;
    mouseDy += e.movementY;
  });

  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    keys.add(e.code);
    oneShot.add(e.code);
  });

  window.addEventListener('keyup', (e) => {
    keys.delete(e.code);
  });

  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    wheelDelta += e.deltaY;
  }, { passive: false });

  // Suppress the browser context menu so RMB-drag works too.
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  return {
    isDragging: () => dragging,
    // Right-button drag → pan. Anything else that's dragging → orbit/look.
    isPanning:  () => dragging && dragButton === 2,
    isDown:     (code) => keys.has(code),
    consumePress: (code) => {
      if (!oneShot.has(code)) return false;
      oneShot.delete(code);
      return true;
    },
    consumeMouse: () => {
      const r = { dx: mouseDx, dy: mouseDy };
      mouseDx = 0;
      mouseDy = 0;
      return r;
    },
    consumeWheel: () => {
      const r = wheelDelta;
      wheelDelta = 0;
      return r;
    },
  };
}
