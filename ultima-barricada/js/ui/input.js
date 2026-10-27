// Input: mouse, keyboard and touch all translate to the same App actions (and through them to
// simulation commands), so rules are identical on every device.
(function (UB) {
  'use strict';
  const I = {};
  const pointers = new Map();
  let drag = null, longT = null, cv = null;
  I.keys = new Set();
  I.mouse = { x: -1, y: -1, inside: false };
  let lastClick = { t: 0, x: 0, y: 0 };

  const art = (e) => {
    const r = cv.getBoundingClientRect();
    return UB.Render.cssToArt(e.clientX - r.left, e.clientY - r.top);
  };

  I.init = function (canvas) {
    cv = canvas;
    cv.addEventListener('pointerdown', down);
    cv.addEventListener('pointermove', move);
    cv.addEventListener('pointerup', up);
    cv.addEventListener('pointercancel', cancel);
    cv.addEventListener('pointerleave', () => { I.mouse.inside = false; });
    cv.addEventListener('contextmenu', (e) => e.preventDefault());
    cv.addEventListener('wheel', wheel, { passive: false });
    window.addEventListener('keydown', keydown);
    window.addEventListener('keyup', (e) => I.keys.delete(e.key.toLowerCase()));
    window.addEventListener('blur', () => I.keys.clear());
  };

  function down(e) {
    UB.Audio.init();
    const A = UB.App;
    if (!A.inGame) return;
    A.touch = e.pointerType !== 'mouse';
    cv.setPointerCapture(e.pointerId);
    const p = { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t: performance.now(), type: e.pointerType, button: e.button, moved: false };
    pointers.set(e.pointerId, p);
    if (pointers.size === 2) {
      clearTimeout(longT);
      const [a, b] = [...pointers.values()];
      drag = { kind: 'pinch', d0: Math.hypot(a.x - b.x, a.y - b.y), s0: UB.Render.getScale(), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 };
      return;
    }
    if (pointers.size > 2) return;
    if (e.pointerType === 'mouse') {
      if (e.button === 1) { drag = { kind: 'pan' }; return; }
      if (e.button === 0 && A.mode && A.mode.kind === 'build' && A.lineCapable()) {
        const g = UB.Render.s2w(art(e).x, art(e).y);
        drag = { kind: 'line', a: { x: Math.floor(g.x), y: Math.floor(g.y) } };
        A.lineDrag(drag.a, drag.a);
        return;
      }
      drag = null;
      return;
    }
    // Touch: long press starts a box selection; moving pans the camera.
    drag = null;
    if (!A.mode) {
      longT = setTimeout(() => {
        if (!p.moved && pointers.size === 1) {
          const s0 = art(e);
          drag = { kind: 'box', x0: s0.x, y0: s0.y };
          if (navigator.vibrate) navigator.vibrate(15);
          A.boxPreview(drag.x0, drag.y0, drag.x0, drag.y0);
        }
      }, 420);
    }
  }

  function move(e) {
    const A = UB.App;
    const a = art(e);
    if (e.pointerType === 'mouse') { I.mouse.x = a.x; I.mouse.y = a.y; I.mouse.inside = true; I.mouse.cx = e.clientX; I.mouse.cy = e.clientY; }
    if (!A.inGame) return;
    const p = pointers.get(e.pointerId);
    if (!p) { if (e.pointerType === 'mouse') A.hover(a.x, a.y); return; }
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    p.x = e.clientX; p.y = e.clientY;
    if (Math.hypot(p.x - p.sx, p.y - p.sy) > (p.type === 'mouse' ? 5 : 10)) p.moved = true;
    if (drag && drag.kind === 'pinch') {
      const [q, r] = [...pointers.values()];
      if (!q || !r) return;
      const d = Math.hypot(q.x - r.x, q.y - r.y);
      const mx = (q.x + r.x) / 2, my = (q.y + r.y) / 2;
      UB.Render.pan(mx - drag.mx, my - drag.my);
      drag.mx = mx; drag.my = my;
      const target = Math.round(drag.s0 * (d / drag.d0));
      if (target !== UB.Render.getScale()) UB.Render.setScale(target, mx, my);
      return;
    }
    if (drag && drag.kind === 'pan') { UB.Render.pan(dx, dy); return; }
    if (drag && drag.kind === 'line') {
      const g = UB.Render.s2w(a.x, a.y);
      A.lineDrag(drag.a, { x: Math.floor(g.x), y: Math.floor(g.y) });
      return;
    }
    if (drag && drag.kind === 'box') { A.boxPreview(drag.x0, drag.y0, a.x, a.y); drag.x1 = a.x; drag.y1 = a.y; return; }
    if (p.type === 'mouse') {
      A.hover(a.x, a.y);
      if (p.button === 0 && p.moved && !A.mode) {
        const s = UB.Render.cssToArt(p.sx - cv.getBoundingClientRect().left, p.sy - cv.getBoundingClientRect().top);
        drag = { kind: 'box', x0: s.x, y0: s.y, x1: a.x, y1: a.y };
        A.boxPreview(s.x, s.y, a.x, a.y);
      }
      return;
    }
    // Touch drag: pan (or drag the build ghost).
    if (p.moved) {
      clearTimeout(longT);
      if (A.mode && A.mode.kind === 'build' && A.ghostNear(a.x, a.y) && !drag) drag = { kind: 'ghost' };
      if (drag && drag.kind === 'ghost') { A.ghostTo(a.x, a.y); return; }
      UB.Render.pan(dx, dy);
    }
  }

  function up(e) {
    const A = UB.App;
    clearTimeout(longT);
    const p = pointers.get(e.pointerId);
    pointers.delete(e.pointerId);
    if (!A.inGame || !p) { drag = null; return; }
    const a = art(e);
    if (drag && drag.kind === 'pinch') { if (pointers.size === 0) drag = null; return; }
    if (drag && drag.kind === 'box') {
      A.boxSelect(drag.x0, drag.y0, drag.x1 !== undefined ? drag.x1 : a.x, drag.y1 !== undefined ? drag.y1 : a.y, e.shiftKey);
      drag = null; return;
    }
    if (drag && drag.kind === 'line') { A.lineCommit(); drag = null; return; }
    if (drag && (drag.kind === 'pan' || drag.kind === 'ghost')) { drag = null; return; }
    drag = null;
    if (p.moved) return;
    const now = performance.now();
    const dbl = now - lastClick.t < 320 && Math.hypot(lastClick.x - a.x, lastClick.y - a.y) < 6;
    lastClick = { t: now, x: a.x, y: a.y };
    if (p.type === 'mouse') {
      if (e.button === 2) { if (A.mode) A.cancelMode(); else A.contextOrder(a.x, a.y); return; }
      if (e.button !== 0) return;
      if (A.mode && A.mode.kind === 'build') { A.placeAtCursor(a.x, a.y, e.shiftKey); return; }
      if (A.mode && A.mode.kind === 'amove') { A.amoveAt(a.x, a.y); return; }
      if (dbl) { A.selectSameOnScreen(a.x, a.y); return; }
      A.clickSelect(a.x, a.y, e.shiftKey);
      return;
    }
    // Touch tap.
    if (A.mode && A.mode.kind === 'build') { A.touchPlace(a.x, a.y); return; }
    if (A.mode && A.mode.kind === 'amove') { A.amoveAt(a.x, a.y); return; }
    if (dbl) { A.selectSameOnScreen(a.x, a.y); return; }
    A.tap(a.x, a.y);
  }
  function cancel(e) { pointers.delete(e.pointerId); clearTimeout(longT); drag = null; }

  function wheel(e) {
    e.preventDefault();
    if (!UB.App.inGame) return;
    const r = cv.getBoundingClientRect();
    const s = UB.Render.getScale() + (e.deltaY < 0 ? 1 : -1);
    UB.Render.setScale(s, e.clientX - r.left, e.clientY - r.top);
  }

  function keydown(e) {
    const A = UB.App;
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    const k = e.key.toLowerCase();
    if (!A.inGame) { if (k === 'escape') UB.Menus.back(); return; }
    if (A.menuOpen()) { if (k === 'escape') A.closeMenus(); return; }
    I.keys.add(k);
    const ctrl = e.ctrlKey || e.metaKey;
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' ', 'tab'].includes(k)) e.preventDefault();
    if (!ctrl && UB.HUD && !document.getElementById('buildMenu').hidden) {
      const t = Object.keys(UB.DEF.BUILDINGS).find((b) => UB.DEF.BUILDINGS[b].key === k);
      if (t) { A.startBuild(t); return; }
    }
    switch (k) {
      case ' ': A.togglePause(); break;
      case '+': case '=': A.setSpeed(Math.min(3, A.speed + 1)); break;
      case '-': case '_': A.setSpeed(Math.max(1, A.speed - 1)); break;
      case '1': case '2': case '3': case '4': if (ctrl) e.preventDefault(); A.squadButton(k, ctrl); break;
      case 'b': A.toggleBuild(); break;
      case 'escape': A.escape(); break;
      case 'h': A.action('goBase'); break;
      case 'tab': A.action('idle'); break;
      case 'a': if (A.sel.units.length) A.action('amove'); break;
      case 's': if (A.sel.units.length && !ctrl) A.action('hold'); break;
      case 'r': if (A.sel.bld) A.action('repair'); break;
      case 'delete': case 'backspace': if (A.sel.bld) A.action('demolish'); break;
      case 'u': if (A.sel.bld) A.action('upgrade'); break;
      case 'f6': e.preventDefault(); UB.Menus.quickSave(); break;
      case 'f9': e.preventDefault(); UB.Menus.quickLoad(); break;
      default: break;
    }
  }

  // Held keys and edge scrolling: called every frame.
  I.update = function (dt) {
    const A = UB.App;
    if (!A.inGame || A.menuOpen()) return;
    const sp = 520 * dt;
    let dx = 0, dy = 0;
    if (I.keys.has('w') || I.keys.has('arrowup')) dy += sp;
    if (I.keys.has('s') && !A.sel.units.length || I.keys.has('arrowdown')) dy -= sp;
    if (I.keys.has('a') && !A.sel.units.length || I.keys.has('arrowleft')) dx += sp;
    if (I.keys.has('d') || I.keys.has('arrowright')) dx -= sp;
    if (A.settings.edgeScroll && I.mouse.inside && !pointers.size) {
      const m = 6, W = window.innerWidth, H = window.innerHeight;
      if (I.mouse.cx < m) dx += sp; else if (I.mouse.cx > W - m) dx -= sp;
      if (I.mouse.cy < m) dy += sp; else if (I.mouse.cy > H - m) dy -= sp;
    }
    if (dx || dy) UB.Render.pan(dx, dy);
  };

  UB.Input = I;
})(globalThis.UB = globalThis.UB || {});
