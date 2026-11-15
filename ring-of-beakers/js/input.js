// input.js — one model for mouse, touch and keyboard. Positions are in UI points (see main.js).
// ptrs: pointers that are down. taps: quick releases this frame. hits: keys pressed this frame.
(function () {
  'use strict';
  const RB = globalThis.RB;
  const input = { ptrs: [], taps: [], ups: [], keys: {}, hits: {}, wheel: 0, mx: 0, my: 0, hasMouse: false, touch: false, onFirst: null };
  let view = null, canvas = null, first = false;

  function pos(e) { const r = canvas.getBoundingClientRect(); return { x: (e.clientX - r.left) / view.s, y: (e.clientY - r.top) / view.s }; }
  function down(e) {
    if (!first) { first = true; if (input.onFirst) input.onFirst(); }
    const p = pos(e);
    input.touch = e.pointerType === 'touch'; if (e.pointerType === 'mouse') input.hasMouse = true;
    input.ptrs.push({ id: e.pointerId, x: p.x, y: p.y, sx: p.x, sy: p.y, t0: performance.now(), moved: 0, fresh: true, mouse: e.pointerType === 'mouse', button: e.button, ui: RB.ui ? RB.ui.over(p.x, p.y) : false, owner: null });
    input.mx = p.x; input.my = p.y;
    try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* not capturable */ }
    canvas.focus({ preventScroll: true });
    e.preventDefault();
  }
  function move(e) {
    const p = pos(e);
    if (e.pointerType === 'mouse') { input.mx = p.x; input.my = p.y; input.hasMouse = true; }
    const ptr = input.ptrs.find((q) => q.id === e.pointerId);
    if (ptr) { ptr.x = p.x; ptr.y = p.y; ptr.moved = Math.max(ptr.moved, Math.hypot(p.x - ptr.sx, p.y - ptr.sy)); }
  }
  function up(e) {
    const i = input.ptrs.findIndex((q) => q.id === e.pointerId);
    if (i < 0) return;
    const ptr = input.ptrs[i], p = pos(e);
    input.ptrs.splice(i, 1);
    ptr.x = p.x; ptr.y = p.y; ptr.dur = performance.now() - ptr.t0;
    ptr.cancelled = e.type === 'pointercancel';
    input.ups.push(ptr);
    if (!ptr.cancelled && ptr.moved < 12 && ptr.dur < 700 && ptr.button !== 2) input.taps.push({ x: ptr.x, y: ptr.y, sx: ptr.sx, sy: ptr.sy, used: false, ui: ptr.ui });
  }
  function attach(cv, v) {
    canvas = cv; view = v;
    cv.addEventListener('pointerdown', down);
    cv.addEventListener('pointermove', move);
    cv.addEventListener('pointerup', up);
    cv.addEventListener('pointercancel', up);
    cv.addEventListener('contextmenu', (e) => e.preventDefault());
    cv.addEventListener('wheel', (e) => { input.wheel += Math.sign(e.deltaY); e.preventDefault(); }, { passive: false });
    window.addEventListener('keydown', (e) => {
      if (e.repeat) { if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault(); return; }
      if (!first) { first = true; if (input.onFirst) input.onFirst(); }
      input.keys[e.code] = true; input.hits[e.code] = true;
      if (e.code.startsWith('Arrow') || e.code === 'Space' || e.code === 'Tab') e.preventDefault();
    });
    window.addEventListener('keyup', (e) => { input.keys[e.code] = false; });
    window.addEventListener('blur', () => { input.keys = {}; input.ptrs.length = 0; });
  }
  function endFrame() {
    input.taps.length = 0; input.ups.length = 0; input.hits = {}; input.wheel = 0;
    for (const p of input.ptrs) p.fresh = false;
  }
  // First unused tap that is not over the UI, for the world under it.
  function worldTap() { for (const t of input.taps) if (!t.used && !t.ui) { t.used = true; return t; } return null; }
  const key = (...codes) => codes.some((c) => input.keys[c]);
  const hit = (...codes) => codes.some((c) => input.hits[c]);

  input.attach = attach; input.endFrame = endFrame; input.worldTap = worldTap; input.key = key; input.hit = hit;
  RB.input = input;
})();
