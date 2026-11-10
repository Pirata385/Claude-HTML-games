/* Filogênese — entrada unificada: teclado, mouse, toque (direcional virtual, pinça) e gamepad. */
(function (FG) {
  'use strict';
  const U = FG.U;
  const KEYMAP = {
    Digit1: 'a1', Digit2: 'a2', Digit3: 'a3', Digit4: 'a4', Numpad1: 'a1', Numpad2: 'a2', Numpad3: 'a3', Numpad4: 'a4',
    KeyQ: 'stance', Tab: 'stance', KeyE: 'interact', KeyF: 'interact', Enter: 'interact', Space: 'jump', KeyR: 'next', KeyX: 'clear',
  };
  const UIKEY = { KeyM: 'map', KeyB: 'book', Escape: 'pause', KeyP: 'pause', KeyH: 'help' };
  const PADMAP = { 0: 'interact', 1: 'jump', 2: 'a1', 3: 'a2', 4: 'stance', 5: 'a3', 6: 'a4', 11: 'next' };

  const I = FG.Input = {
    mx: 0, my: 0, sprint: false, sneak: false, events: [], tap: null,
    enabled: false, keys: {}, touch: false, sprintHeld: false, sprintTog: false, sneakTog: false,
    joy: { on: false, id: -1, ox: 0, oy: 0, dx: 0, dy: 0 }, pinch: null, pts: new Map(), pad: {}, padSprint: false, usedPad: false,
    onUi: null,

    init(canvas) {
      I.canvas = canvas;
      I.touch = FG.Settings.data.touchUi === 'on' || (FG.Settings.data.touchUi === 'auto' && (navigator.maxTouchPoints > 0 || 'ontouchstart' in window));
      window.addEventListener('keydown', (e) => {
        if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT')) return;
        if (UIKEY[e.code]) { if (!e.repeat && I.onUi) I.onUi(UIKEY[e.code]); if (e.code === 'Escape') e.preventDefault(); return; }
        if (!I.enabled) return;
        if (e.code === 'Tab' || e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
        if (e.repeat) return;
        I.keys[e.code] = true;
        if (KEYMAP[e.code]) I.events.push(KEYMAP[e.code]);
        if (e.code === 'KeyC' || e.code === 'ControlLeft') I.toggleSneak();
        if ((e.code === 'ShiftLeft' || e.code === 'ShiftRight') && !FG.Settings.data.holdSprint) I.sprintTog = !I.sprintTog;
      });
      window.addEventListener('keyup', (e) => { I.keys[e.code] = false; });
      window.addEventListener('blur', () => { I.keys = {}; I.endJoy(); I.sprintHeld = false; });
      canvas.addEventListener('contextmenu', (e) => { e.preventDefault(); if (I.enabled) I.events.push('clear'); });
      canvas.addEventListener('wheel', (e) => {
        if (!I.enabled) return;
        e.preventDefault();
        const S = FG.Settings; S.set('zoom', U.clamp(+(S.data.zoom * (e.deltaY > 0 ? 0.93 : 1.07)).toFixed(3), 0.6, 1.6));
      }, { passive: false });
      canvas.addEventListener('pointerdown', I.down);
      canvas.addEventListener('pointermove', I.move);
      canvas.addEventListener('pointerup', I.up);
      canvas.addEventListener('pointercancel', I.up);
    },

    toggleSneak(v) { I.sneakTog = v == null ? !I.sneakTog : v; FG.bus.emit('inputstate'); },
    press(ev) { if (I.enabled) I.events.push(ev); },
    clear() { I.events.length = 0; I.tap = null; I.keys = {}; I.endJoy(); I.sprintHeld = false; I.mx = I.my = 0; },

    down(e) {
      if (!I.enabled) return;
      const r = I.canvas.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
      if (e.pointerType === 'mouse') {
        if (e.button === 0) I.tap = FG.Render.toWorld(x, y);
        return;
      }
      if (!I.touch) { I.touch = true; FG.bus.emit('touchmode', true); }
      e.preventDefault();
      try { I.canvas.setPointerCapture(e.pointerId); } catch (err) { /* ok */ }
      I.pts.set(e.pointerId, { x, y, sx: x, sy: y, t: performance.now(), moved: false });
      const left = FG.Settings.data.joySide !== 'right';
      const onJoySide = left ? x < r.width * 0.45 : x > r.width * 0.55;
      if (!I.joy.on && onJoySide) {
        const j = I.joy; j.on = true; j.id = e.pointerId; j.ox = x; j.oy = y; j.dx = j.dy = 0;
        FG.bus.emit('joy', true, x, y, 0, 0);
      } else {
        const others = [...I.pts.entries()].filter(([id]) => id !== I.joy.id);
        if (others.length === 2) { const a = others[0][1], b = others[1][1]; I.pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), z: FG.Settings.data.zoom }; }
      }
    },
    move(e) {
      const p = I.pts.get(e.pointerId);
      if (!p) return;
      const r = I.canvas.getBoundingClientRect();
      p.x = e.clientX - r.left; p.y = e.clientY - r.top;
      if (Math.hypot(p.x - p.sx, p.y - p.sy) > 12) p.moved = true;
      const j = I.joy;
      if (j.on && e.pointerId === j.id) {
        const R = 56 * FG.Settings.data.btnScale;
        let dx = p.x - j.ox, dy = p.y - j.oy;
        const d = Math.hypot(dx, dy);
        if (d > R) { j.ox += dx - dx / d * R; j.oy += dy - dy / d * R; dx = dx / d * R; dy = dy / d * R; }
        j.dx = dx / R; j.dy = dy / R;
        FG.bus.emit('joy', true, j.ox, j.oy, dx, dy);
      } else if (I.pinch) {
        const others = [...I.pts.entries()].filter(([id]) => id !== j.id);
        if (others.length >= 2) {
          const a = others[0][1], b = others[1][1], d = Math.hypot(a.x - b.x, a.y - b.y);
          FG.Settings.data.zoom = U.clamp(I.pinch.z * d / Math.max(20, I.pinch.d), 0.6, 1.6);
        }
      }
    },
    up(e) {
      const p = I.pts.get(e.pointerId);
      if (!p) return;
      I.pts.delete(e.pointerId);
      if (I.joy.on && e.pointerId === I.joy.id) {
        // toque curto e parado no lado do direcional também vale como toque de mira
        const quick = !p.moved && performance.now() - p.t < 350;
        I.endJoy();
        if (quick && I.enabled) I.tap = FG.Render.toWorld(p.x, p.y);
        return;
      }
      if (I.pinch) { if (I.pts.size - (I.joy.on ? 1 : 0) < 2) { I.pinch = null; FG.Settings.save(); } return; }
      if (!p.moved && performance.now() - p.t < 450 && I.enabled) I.tap = FG.Render.toWorld(p.x, p.y);
    },
    endJoy() { const j = I.joy; if (!j.on) return; j.on = false; j.id = -1; j.dx = j.dy = 0; FG.bus.emit('joy', false); },

    /** Lê teclas, direcional virtual e gamepad e produz mx/my/sprint/sneak. */
    update() {
      const K = I.keys;
      let mx = 0, my = 0;
      if (K.KeyA || K.ArrowLeft) mx -= 1; if (K.KeyD || K.ArrowRight) mx += 1;
      if (K.KeyW || K.ArrowUp) my -= 1; if (K.KeyS || K.ArrowDown) my += 1;
      const j = I.joy;
      if (j.on) { const d = Math.hypot(j.dx, j.dy); if (d > 0.18) { mx = j.dx; my = j.dy; } }
      let padSprint = false;
      const pads = navigator.getGamepads ? navigator.getGamepads() : [];
      for (const gp of pads) {
        if (!gp || !gp.connected) continue;
        const ax = gp.axes[0] || 0, ay = gp.axes[1] || 0;
        if (Math.hypot(ax, ay) > 0.22) { mx = ax; my = ay; I.usedPad = true; }
        gp.buttons.forEach((b, i) => {
          const was = I.pad[i]; I.pad[i] = b.pressed;
          if (b.pressed && !was) {
            I.usedPad = true;
            if (PADMAP[i]) { if (I.enabled) I.events.push(PADMAP[i]); }
            else if (i === 9 && I.onUi) I.onUi('pause');
            else if (i === 8 && I.onUi) I.onUi('map');
            else if (i === 10) I.toggleSneak();
          }
        });
        if (gp.buttons[7] && gp.buttons[7].pressed) padSprint = true;
        break;
      }
      const l = Math.hypot(mx, my);
      if (l > 1) { mx /= l; my /= l; }
      I.mx = mx; I.my = my;
      const hold = FG.Settings.data.holdSprint;
      I.sprint = padSprint || I.sprintHeld || (hold ? !!(K.ShiftLeft || K.ShiftRight) : I.sprintTog);
      if (!hold && l < 0.1 && I.sprintTog && !I.joy.on) { /* mantém ligado até desligar */ }
      I.sneak = I.sneakTog;
    },
  };
})(window.FG = window.FG || {});
