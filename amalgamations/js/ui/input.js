// Amalgamations — unified input: keyboard + mouse, touch (floating joystick, hold/drag-to-aim buttons, pinch zoom)
// and gamepad. The game reads AM.Input each frame and calls endFrame() afterwards.
(function (root) {
  'use strict';
  const AM = root.AM || (root.AM = {});

  const KEYMAP = {
    KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down', KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right',
    Space: 'dodge', ShiftLeft: 'dodge', ShiftRight: 'dodge', KeyF: 'interact', KeyH: 'potion', KeyJ: 'quests', KeyI: 'inventory', KeyB: 'inventory',
    KeyP: 'powers', KeyK: 'skills', KeyM: 'map', Tab: 'map', Escape: 'pause', KeyZ: 'camL', KeyX: 'camR', Minus: 'zoomOut', Equal: 'zoomIn', NumpadSubtract: 'zoomOut', NumpadAdd: 'zoomIn',
    Digit1: 'p0', Digit2: 'p1', Digit3: 'p2', Digit4: 'p3', KeyQ: 'p0', KeyE: 'p1', KeyR: 'p2', KeyT: 'p3', KeyL: 'attackKey', KeyV: 'camView',
  };

  const I = {
    move: { x: 0, y: 0 }, mouse: { x: 0, y: 0, inside: false }, hasMouse: false, device: 'kb',
    attack: false, pressed: new Set(), keys: new Set(), zoomDelta: 0,
    stick: null, aimDrag: null, padAim: null, touchUsed: false, enabled: true,
    camDX: 0, camDY: 0, look: null, drag: null,
    onAction: null,
  };

  function press(a) { if (I.enabled) { I.pressed.add(a); if (I.onAction) I.onAction(a); } }
  // Third-person camera: dragging (right/middle mouse, one finger on the right side, right stick) orbits it.
  const thirdPerson = () => !!(AM.settings && AM.settings.camera === 'third-person');

  function init(canvas, touchRoot) {
    I.canvas = canvas;
    root.addEventListener('keydown', (e) => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT')) return;
      const a = KEYMAP[e.code];
      if (!a) return;
      if (a === 'pause' || a === 'map' || /^p\d/.test(a) || a === 'dodge') e.preventDefault();
      I.device = 'kb';
      if (!I.keys.has(e.code)) { I.keys.add(e.code); if (!['up', 'down', 'left', 'right', 'attackKey'].includes(a)) press(a); }
    });
    root.addEventListener('keyup', (e) => { I.keys.delete(e.code); });
    root.addEventListener('blur', () => { I.keys.clear(); I.attack = false; });
    canvas.addEventListener('mousemove', (e) => {
      if (I.drag) { const dx = e.clientX - I.drag.x, dy = e.clientY - I.drag.y; I.camDX += dx; I.camDY += dy; I.drag.moved += Math.abs(dx) + Math.abs(dy); I.drag.x = e.clientX; I.drag.y = e.clientY; }
      I.mouse.x = e.clientX; I.mouse.y = e.clientY; I.mouse.inside = true; I.hasMouse = true; if (I.device !== 'kb') I.device = 'kb';
    });
    canvas.addEventListener('mouseleave', () => { I.mouse.inside = false; });
    canvas.addEventListener('mousedown', (e) => {
      I.hasMouse = true; I.device = 'kb';
      if (e.button === 0) I.attack = true;
      else if (thirdPerson() && (e.button === 2 || e.button === 1)) { I.drag = { x: e.clientX, y: e.clientY, moved: 0, button: e.button }; e.preventDefault(); }
      else if (e.button === 2) press('dodge');
    });
    root.addEventListener('mouseup', (e) => {
      if (e.button === 0) I.attack = false;
      if (I.drag && e.button === I.drag.button) {
        // in third person a right click without dragging is still a dodge
        if (I.drag.button === 2 && I.drag.moved < 6) press('dodge');
        I.drag = null;
      }
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('wheel', (e) => { I.zoomDelta += e.deltaY > 0 ? -1 : 1; e.preventDefault(); }, { passive: false });

    // ---------- touch ----------
    const pinch = { active: false, d: 0, ids: [] };
    canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      I.device = 'touch'; I.touchUsed = true; I.hasMouse = false;
      for (const t of e.changedTouches) {
        const leftSide = t.clientX < root.innerWidth * (AM.settings && AM.settings.leftHanded ? 0.55 : 0.45);
        const onJoySide = AM.settings && AM.settings.leftHanded ? !leftSide : leftSide;
        if (onJoySide && !I.stick) {
          I.stick = { id: t.identifier, x0: t.clientX, y0: t.clientY, x: t.clientX, y: t.clientY };
          showStick(true);
        } else if (!onJoySide) {
          pinch.ids.push(t.identifier);
          if (thirdPerson() && !I.look) I.look = { id: t.identifier, x: t.clientX, y: t.clientY };
        }
      }
      if (pinch.ids.length >= 2) { pinch.active = true; const ts = touchesById(e, pinch.ids); if (ts.length >= 2) pinch.d = Math.hypot(ts[0].clientX - ts[1].clientX, ts[0].clientY - ts[1].clientY); }
    }, { passive: false });
    canvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
      for (const t of e.changedTouches) {
        if (I.stick && t.identifier === I.stick.id) { I.stick.x = t.clientX; I.stick.y = t.clientY; showStick(true); }
        if (I.look && t.identifier === I.look.id && pinch.ids.length < 2) { I.camDX += (t.clientX - I.look.x) * 1.3; I.camDY += (t.clientY - I.look.y) * 1.3; I.look.x = t.clientX; I.look.y = t.clientY; }
      }
      if (pinch.active) {
        const ts = touchesById(e, pinch.ids);
        if (ts.length >= 2) {
          const d = Math.hypot(ts[0].clientX - ts[1].clientX, ts[0].clientY - ts[1].clientY);
          if (Math.abs(d - pinch.d) > 24) { I.zoomDelta += d > pinch.d ? 1 : -1; pinch.d = d; }
        }
      }
    }, { passive: false });
    const endTouch = (e) => {
      for (const t of e.changedTouches) {
        if (I.stick && t.identifier === I.stick.id) { I.stick = null; showStick(false); }
        const k = pinch.ids.indexOf(t.identifier);
        if (k >= 0) pinch.ids.splice(k, 1);
        if (I.look && t.identifier === I.look.id) I.look = null;
      }
      if (pinch.ids.length < 2) pinch.active = false;
    };
    canvas.addEventListener('touchend', endTouch);
    canvas.addEventListener('touchcancel', endTouch);
    if (touchRoot) bindTouchButtons(touchRoot);
  }
  function touchesById(e, ids) { const out = []; for (const t of e.touches) if (ids.includes(t.identifier)) out.push(t); return out; }

  let stickEl = null, knobEl = null;
  function showStick(on) {
    if (!stickEl) { stickEl = document.getElementById('stick'); knobEl = document.getElementById('stick-knob'); }
    if (!stickEl) return;
    stickEl.style.display = on ? 'block' : 'none';
    if (on && I.stick) {
      stickEl.style.left = I.stick.x0 + 'px'; stickEl.style.top = I.stick.y0 + 'px';
      const dx = I.stick.x - I.stick.x0, dy = I.stick.y - I.stick.y0, d = Math.hypot(dx, dy), max = 46;
      const k = d > max ? max / d : 1;
      knobEl.style.transform = `translate(${dx * k}px, ${dy * k}px)`;
    }
  }

  // Touch buttons: elements with data-act. Power buttons support drag-to-aim.
  function bindTouchButtons(rootEl) {
    rootEl.addEventListener('touchstart', (e) => {
      const el = e.target.closest('[data-act]');
      if (!el) return;
      e.preventDefault(); e.stopPropagation();
      I.device = 'touch'; I.touchUsed = true;
      const act = el.dataset.act, t = e.changedTouches[0];
      el.classList.add('down');
      if (act === 'attack') { I.attack = true; I.attackTouch = t.identifier; }
      else if (/^p\d$/.test(act)) { I.aimDrag = { act, id: t.identifier, x0: t.clientX, y0: t.clientY, dx: 0, dy: 0, el }; }
      else press(act);
    }, { passive: false });
    rootEl.addEventListener('touchmove', (e) => {
      if (!I.aimDrag) return;
      for (const t of e.changedTouches) if (t.identifier === I.aimDrag.id) { I.aimDrag.dx = t.clientX - I.aimDrag.x0; I.aimDrag.dy = t.clientY - I.aimDrag.y0; e.preventDefault(); }
    }, { passive: false });
    const end = (e) => {
      for (const t of e.changedTouches) {
        if (I.attackTouch === t.identifier) { I.attack = false; I.attackTouch = null; }
        if (I.aimDrag && t.identifier === I.aimDrag.id) {
          const a = I.aimDrag;
          I.castAim = Math.hypot(a.dx, a.dy) > 22 ? { dx: a.dx, dy: a.dy } : null;
          press(a.act);
          I.aimDrag = null;
        }
      }
      for (const el of rootEl.querySelectorAll('.down')) el.classList.remove('down');
    };
    rootEl.addEventListener('touchend', end);
    rootEl.addEventListener('touchcancel', end);
    // mouse clicks on the same buttons (desktop users clicking the HUD)
    rootEl.addEventListener('mousedown', (e) => {
      const el = e.target.closest('[data-act]');
      if (!el) return;
      e.preventDefault(); e.stopPropagation();
      const act = el.dataset.act;
      if (act === 'attack') { I.attack = true; return; }
      I.castAim = null;
      press(act);
    });
  }

  // ---------- gamepad ----------
  const prevPad = [];
  function pollPad() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const p = pads && [...pads].find((x) => x && x.connected);
    if (!p) { I.padAim = null; return null; }
    const dz = (v) => (Math.abs(v) < 0.18 ? 0 : v);
    const lx = dz(p.axes[0] || 0), ly = dz(p.axes[1] || 0), rx = dz(p.axes[2] || 0), ry = dz(p.axes[3] || 0);
    const btn = (i) => !!(p.buttons[i] && p.buttons[i].pressed);
    const any = lx || ly || rx || ry || p.buttons.some((b) => b.pressed);
    if (any) { I.device = 'pad'; I.hasMouse = false; }
    const map = { 1: 'dodge', 2: 'interact', 3: 'potion', 4: 'p0', 5: 'p1', 6: 'p2', 7: 'p3', 9: 'pause', 8: 'map', 14: 'camL', 15: 'camR', 12: 'zoomIn', 13: 'zoomOut' };
    for (const k in map) { const b = btn(+k); if (b && !prevPad[k]) press(map[k]); prevPad[k] = b; }
    I.padAttack = btn(0);
    if (thirdPerson()) { I.padAim = null; I.camDX += rx * 9; I.camDY += ry * 6; }
    else I.padAim = rx || ry ? { x: rx, y: ry } : null;
    return { x: lx, y: -ly };
  }

  function update() {
    let x = 0, y = 0;
    if (I.keys.size) {
      for (const k of I.keys) {
        const a = KEYMAP[k];
        if (a === 'up') y += 1; else if (a === 'down') y -= 1; else if (a === 'left') x -= 1; else if (a === 'right') x += 1;
      }
    }
    if (I.stick) {
      const dx = I.stick.x - I.stick.x0, dy = I.stick.y - I.stick.y0, d = Math.hypot(dx, dy);
      if (d > 8) { const k = Math.min(1, d / 46); x += (dx / d) * k; y -= (dy / d) * k; }
    }
    const pad = pollPad();
    if (pad) { x += pad.x; y += pad.y; }
    const len = Math.hypot(x, y);
    if (len > 1) { x /= len; y /= len; }
    I.move.x = x; I.move.y = y;
    I.attackHeld = I.attack || I.padAttack || I.keys.has('KeyL');
  }
  function endFrame() { I.pressed.clear(); I.zoomDelta = 0; I.castAim = null; I.camDX = 0; I.camDY = 0; }
  function reset() { I.keys.clear(); I.attack = false; I.stick = null; I.aimDrag = null; I.look = null; I.drag = null; I.pressed.clear(); showStick(false); }

  Object.assign(I, { init, update, endFrame, reset, KEYMAP });
  AM.Input = I;
})(typeof window !== 'undefined' ? window : globalThis);
