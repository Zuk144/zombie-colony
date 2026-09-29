// Touch-first camera and gesture handling (docs/DESIGN.md §11):
//   one finger      → pan (with inertia), or PAINT when a tool is active; tap = select/apply
//   two fingers     → pinch-zoom + pan, always; a second finger cancels any paint in progress
//   mouse           → left like one finger; right/middle drag pans; right-click drops the tool
//   wheel/trackpad  → pinch (ctrl+wheel) or mouse wheel zooms; two-finger trackpad scroll pans
//   keyboard        → WASD/arrows pan (hotkeys live in ui.js)

const SLOP = { touch: 10, pen: 6, mouse: 4 };

export function createInput(canvas, r, h) {
  const cam = r.cam;
  const pts = new Map();
  let mode = 'idle'; // idle | pending | pan | paint | pinch | locked
  let start = null, panRef = null, pinchRef = null;
  let vel = { x: 0, y: 0 }, last = null;
  const keys = new Set();

  const pos = (e) => {
    const b = canvas.getBoundingClientRect();
    return { x: e.clientX - b.left, y: e.clientY - b.top };
  };
  const clampZoom = (z) => Math.min(cam.maxZoom, Math.max(cam.minZoom, z));

  function zoomAt(sx, sy, factor) {
    const before = r.screenToWorld(sx, sy);
    cam.zoom = clampZoom(cam.zoom * factor);
    const after = r.screenToWorld(sx, sy);
    cam.x += before.x - after.x;
    cam.y += before.y - after.y;
  }
  function beginPan(p) {
    panRef = { x: p.x, y: p.y, cx: cam.x, cy: cam.y };
    last = { x: p.x, y: p.y, t: performance.now() };
    vel = { x: 0, y: 0 };
  }
  function beginPinch() {
    const [a, b] = [...pts.values()];
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    pinchRef = { dist: Math.hypot(a.x - b.x, a.y - b.y) || 1, zoom: cam.zoom, world: r.screenToWorld(mid.x, mid.y) };
  }
  function updatePinch() {
    const [a, b] = [...pts.values()];
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    cam.zoom = clampZoom(pinchRef.zoom * (Math.hypot(a.x - b.x, a.y - b.y) / pinchRef.dist));
    const { W, H } = r.size();
    cam.x = pinchRef.world.x - (mid.x - W / 2) / cam.zoom;
    cam.y = pinchRef.world.y - (mid.y - H / 2) / cam.zoom;
  }

  canvas.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    try { canvas.setPointerCapture(e.pointerId); } catch { /* synthetic or already-released pointer */ }
    const p = { ...pos(e), type: e.pointerType };
    pts.set(e.pointerId, p);
    cam.target = null;
    vel = { x: 0, y: 0 };
    if (e.pointerType === 'mouse' && e.button !== 0) {
      mode = 'pan';
      start = { ...p, t: performance.now(), button: e.button };
      beginPan(p);
      return;
    }
    if (pts.size === 1) {
      mode = 'pending';
      start = { ...p, t: performance.now(), button: 0 };
    } else if (pts.size === 2) {
      if (mode === 'paint') h.paintCancel();
      mode = 'pinch';
      beginPinch();
    } else mode = 'locked';
  });

  canvas.addEventListener('pointermove', (e) => {
    const cur = pos(e);
    if (e.pointerType === 'mouse') h.hover?.(r.screenToCell(cur.x, cur.y));
    const p = pts.get(e.pointerId);
    if (!p) return;
    Object.assign(p, cur);
    if (mode === 'pending') {
      if (Math.hypot(p.x - start.x, p.y - start.y) <= (SLOP[p.type] ?? 8)) return;
      if (h.isPainting()) {
        mode = 'paint';
        h.paintStart(r.screenToCell(start.x, start.y));
        h.paintMove(r.screenToCell(p.x, p.y));
      } else {
        mode = 'pan';
        beginPan(start);
      }
    }
    if (mode === 'paint') h.paintMove(r.screenToCell(p.x, p.y));
    else if (mode === 'pan') {
      cam.x = panRef.cx - (p.x - panRef.x) / cam.zoom;
      cam.y = panRef.cy - (p.y - panRef.y) / cam.zoom;
      const now = performance.now(), dt = Math.max(1, now - last.t);
      vel = { x: 0.6 * vel.x + 0.4 * ((p.x - last.x) / dt), y: 0.6 * vel.y + 0.4 * ((p.y - last.y) / dt) };
      last = { x: p.x, y: p.y, t: now };
    } else if (mode === 'pinch' && pts.size >= 2) updatePinch();
  });

  function release(e, cancelled) {
    if (!pts.has(e.pointerId)) return;
    pts.delete(e.pointerId);
    if (cancelled) {
      if (mode === 'paint') h.paintCancel();
      mode = pts.size ? 'locked' : 'idle';
      return;
    }
    if (mode === 'pending') {
      if (performance.now() - start.t < 600) h.tap(start.x, start.y, start.type);
    } else if (mode === 'pan' && start?.button === 2 && Math.hypot(pos(e).x - start.x, pos(e).y - start.y) < 4) {
      h.secondaryTap?.();
      vel = { x: 0, y: 0 };
    } else if (mode === 'paint') h.paintEnd();
    else if (mode === 'pan' && performance.now() - last.t > 80) vel = { x: 0, y: 0 }; // finger stopped before lifting
    else if (mode === 'pan') {
      const v = Math.hypot(vel.x, vel.y), max = 2.5; // px/ms; keeps a flick from launching the camera
      if (v > max) vel = { x: (vel.x / v) * max, y: (vel.y / v) * max };
    }

    if (mode === 'pinch' && pts.size === 1) {
      mode = 'pan'; // keep panning with the remaining finger, like a maps app
      beginPan([...pts.values()][0]);
      start = { ...[...pts.values()][0], t: 0, button: 0 };
      return;
    }
    if (!pts.size) mode = 'idle';
  }
  canvas.addEventListener('pointerup', (e) => release(e, false));
  canvas.addEventListener('pointercancel', (e) => release(e, true));
  canvas.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') h.hover?.(null); });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    cam.target = null;
    const p = pos(e);
    if (e.ctrlKey) zoomAt(p.x, p.y, Math.exp(-e.deltaY * 0.01)); // trackpad pinch
    else if (e.deltaX !== 0 || Math.abs(e.deltaY) < 40) { // trackpad two-finger scroll
      cam.x += e.deltaX / cam.zoom;
      cam.y += e.deltaY / cam.zoom;
    } else zoomAt(p.x, p.y, Math.exp(-e.deltaY * 0.0015)); // mouse wheel
  }, { passive: false });

  // iOS Safari: stop its own pinch-zoom / double-tap zoom from fighting ours.
  for (const ev of ['gesturestart', 'gesturechange', 'gestureend']) document.addEventListener(ev, (e) => e.preventDefault());
  document.addEventListener('dblclick', (e) => e.preventDefault());

  window.addEventListener('keydown', (e) => { if (!e.metaKey && !e.ctrlKey) keys.add(e.key.toLowerCase()); });
  window.addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
  window.addEventListener('blur', () => keys.clear());

  // Per-frame: inertia, keyboard pan, animated camera jumps, bounds.
  function update(dt, worldW, worldH) {
    if (mode === 'idle' && (vel.x || vel.y)) {
      cam.x -= (vel.x * dt * 1000) / cam.zoom;
      cam.y -= (vel.y * dt * 1000) / cam.zoom;
      const decay = Math.exp(-dt * 5);
      vel = { x: vel.x * decay, y: vel.y * decay };
      if (Math.hypot(vel.x, vel.y) < 0.01) vel = { x: 0, y: 0 };
    }
    const k = (600 * dt) / cam.zoom;
    if (keys.has('w') || keys.has('arrowup')) cam.y -= k;
    if (keys.has('s') || keys.has('arrowdown')) cam.y += k;
    if (keys.has('a') || keys.has('arrowleft')) cam.x -= k;
    if (keys.has('d') || keys.has('arrowright')) cam.x += k;
    if (cam.target) {
      const f = Math.min(1, dt * 7);
      cam.x += (cam.target.x - cam.x) * f;
      cam.y += (cam.target.y - cam.y) * f;
      if (cam.target.zoom) cam.zoom += (cam.target.zoom - cam.zoom) * f;
      if (Math.hypot(cam.target.x - cam.x, cam.target.y - cam.y) < 0.5) cam.target = null;
    }
    cam.x = Math.max(0, Math.min(worldW, cam.x));
    cam.y = Math.max(0, Math.min(worldH, cam.y));
  }

  return { update, keys };
}
