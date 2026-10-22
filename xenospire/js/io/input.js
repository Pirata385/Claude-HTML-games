// Touch (floating joystick + drag-to-aim buttons), keyboard + mouse and
// gamepad, merged into one per-frame "intent" the game turns into a fighter
// controller. Screen-space directions are converted to world space by main.js.
(function (XS) {
  'use strict';

  const DRAG_MANUAL = 16;   // CSS px before a press on a power becomes manual aim
  const DRAG_FULL = 80;     // CSS px of drag = full range
  const KEYMAP = {
    KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down', KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right',
    Digit1: 'p0', Digit2: 'p1', Digit3: 'p2', KeyQ: 'p0', KeyE: 'p1', KeyR: 'p2', KeyJ: 'atk', KeyK: 'dodge', Space: 'dodge', ShiftLeft: 'dodge',
    Escape: 'pause', KeyP: 'pause',
  };

  class Input {
    constructor(canvas, settings) {
      this.canvas = canvas;
      this.settings = settings;
      this.mode = matchMedia && matchMedia('(pointer: coarse)').matches ? 'touch' : 'kb';
      this.keys = new Set();
      this.mouse = { x: 0, y: 0, down: false, moved: false };
      this.joy = { id: null, ox: 0, oy: 0, x: 0, y: 0 };
      this.attackHeld = false;
      this.edges = { dodge: false, pause: false };
      this.aiming = null;     // { slot, source, dx, dy, manual, cancel }
      this.castQueue = [];    // { slot, manual, dx, dy, dist } (touch) or { slot, mouse: true }
      this.pad = { prev: [] };
      this.enabled = false;
      this.listeners = [];
      this.bind();
    }

    on(el, type, fn, opts) { el.addEventListener(type, fn, opts); this.listeners.push(() => el.removeEventListener(type, fn, opts)); }

    bind() {
      this.on(window, 'keydown', (e) => {
        const k = KEYMAP[e.code];
        if (!k) return;
        if (e.target && /INPUT|TEXTAREA/.test(e.target.tagName)) return;
        this.mode = 'kb';
        if (k === 'pause') { this.edges.pause = true; return; }
        if (!this.enabled) return;
        e.preventDefault();
        if (this.keys.has(k)) return;
        this.keys.add(k);
        if (k === 'dodge') this.edges.dodge = true;
        if (k[0] === 'p') this.aiming = { slot: +k[1], source: 'key', manual: true, cancel: false };
      });
      this.on(window, 'keyup', (e) => {
        const k = KEYMAP[e.code];
        if (!k) return;
        this.keys.delete(k);
        if (k[0] === 'p' && this.aiming && this.aiming.source === 'key' && this.aiming.slot === +k[1]) {
          this.castQueue.push({ slot: this.aiming.slot, mouse: true });
          this.aiming = null;
        }
      });
      this.on(window, 'blur', () => { this.keys.clear(); this.attackHeld = false; this.mouse.down = false; this.joy.id = null; this.aiming = null; });
      this.on(this.canvas, 'pointermove', (e) => {
        if (e.pointerType === 'mouse') { this.mouse.x = e.clientX; this.mouse.y = e.clientY; this.mouse.moved = true; this.mode = 'kb'; }
      });
      this.on(this.canvas, 'pointerdown', (e) => {
        if (e.pointerType !== 'mouse' || !this.enabled) return;
        this.mode = 'kb';
        if (e.button === 0) this.mouse.down = true;
        if (e.button === 2) this.edges.dodge = true;
      });
      this.on(window, 'pointerup', (e) => { if (e.pointerType === 'mouse' && e.button === 0) this.mouse.down = false; });
      this.on(this.canvas, 'contextmenu', (e) => e.preventDefault());
    }

    // Wire the touch controls created by the HUD.
    bindTouch(els) {
      const joyZone = els.joyZone, base = els.joyBase, knob = els.joyKnob;
      const radius = () => 42 * (this.settings.buttonSize || 1);
      const placeBase = (x, y) => { base.style.left = x + 'px'; base.style.top = y + 'px'; };
      this.on(joyZone, 'pointerdown', (e) => {
        if (this.joy.id !== null || !this.enabled) return;
        e.preventDefault();
        this.mode = 'touch';
        joyZone.setPointerCapture(e.pointerId);
        this.joy.id = e.pointerId;
        const rect = joyZone.getBoundingClientRect();
        if (this.settings.joystick === 1) {
          const br = base.getBoundingClientRect();
          this.joy.ox = br.left + br.width / 2; this.joy.oy = br.top + br.height / 2;
        } else {
          this.joy.ox = e.clientX; this.joy.oy = e.clientY;
          placeBase(e.clientX - rect.left, e.clientY - rect.top);
        }
        base.classList.add('active');
        this.moveJoy(e, knob, radius());
      });
      this.on(joyZone, 'pointermove', (e) => { if (e.pointerId === this.joy.id) this.moveJoy(e, knob, radius()); });
      const endJoy = (e) => {
        if (e.pointerId !== this.joy.id) return;
        this.joy.id = null; this.joy.x = 0; this.joy.y = 0;
        knob.style.transform = 'translate(-50%, -50%)';
        base.classList.remove('active');
      };
      this.on(joyZone, 'pointerup', endJoy);
      this.on(joyZone, 'pointercancel', endJoy);

      const press = (el, down, up) => {
        this.on(el, 'pointerdown', (e) => { e.preventDefault(); if (!this.enabled) return; this.mode = 'touch'; el.setPointerCapture(e.pointerId); el.classList.add('down'); down(e); });
        const end = (e) => { el.classList.remove('down'); up(e); };
        this.on(el, 'pointerup', end);
        this.on(el, 'pointercancel', (e) => { el.classList.remove('down'); if (this.aiming) this.aiming.cancel = true; up(e); });
      };
      press(els.attack, () => { this.attackHeld = true; }, () => { this.attackHeld = false; });
      press(els.dodge, () => { this.edges.dodge = true; }, () => {});
      els.powers.forEach((btn, slot) => {
        let sx = 0, sy = 0;
        press(btn, (e) => {
          sx = e.clientX; sy = e.clientY;
          this.aiming = { slot, source: 'touch', dx: 0, dy: 0, manual: false, cancel: false };
        }, () => {
          const a = this.aiming;
          if (!a || a.slot !== slot || a.source !== 'touch') return;
          this.aiming = null;
          if (a.cancel) return;
          this.castQueue.push({ slot, manual: a.manual, dx: a.dx, dy: a.dy, dist: Math.min(1, Math.hypot(a.dx, a.dy) / DRAG_FULL) });
        });
        this.on(btn, 'pointermove', (e) => {
          const a = this.aiming;
          if (!a || a.slot !== slot || a.source !== 'touch') return;
          a.dx = e.clientX - sx; a.dy = e.clientY - sy;
          const d = Math.hypot(a.dx, a.dy);
          if (d > DRAG_MANUAL) a.manual = true;
          a.cancel = a.manual && d < DRAG_MANUAL * 0.6;
        });
      });
    }

    moveJoy(e, knob, R) {
      let dx = e.clientX - this.joy.ox, dy = e.clientY - this.joy.oy;
      const d = Math.hypot(dx, dy);
      if (d > R) { dx *= R / d; dy *= R / d; }
      knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
      const m = Math.min(1, d / R);
      const dead = 0.12;
      const k = m < dead ? 0 : (m - dead) / (1 - dead);
      this.joy.x = d > 0 ? (dx / d) * k : 0;
      this.joy.y = d > 0 ? (dy / d) * k : 0;
    }

    pollPad() {
      const pads = navigator.getGamepads ? navigator.getGamepads() : [];
      const p = pads && [...pads].find((x) => x && x.connected);
      if (!p) return null;
      const dz = (v) => (Math.abs(v) < 0.18 ? 0 : v);
      const btn = (i) => !!(p.buttons[i] && p.buttons[i].pressed);
      const prev = this.pad.prev;
      const edge = (i) => btn(i) && !prev[i];
      const out = {
        mx: dz(p.axes[0] || 0), my: dz(p.axes[1] || 0), ax: dz(p.axes[2] || 0), ay: dz(p.axes[3] || 0),
        attack: btn(0) || btn(7), dodge: edge(5) || edge(4) || edge(6), pause: edge(9),
        powers: [btn(2), btn(3), btn(1)],
      };
      if (out.mx || out.my || out.attack || out.powers.some(Boolean)) this.mode = 'pad';
      this.pad.prev = p.buttons.map((b) => b.pressed);
      return out;
    }

    // Intent for this frame (screen-space vectors; consumed once).
    poll() {
      const pad = this.pollPad();
      let mx = this.joy.x, my = this.joy.y;
      if (this.keys.has('left')) mx -= 1;
      if (this.keys.has('right')) mx += 1;
      if (this.keys.has('up')) my -= 1;
      if (this.keys.has('down')) my += 1;
      if (pad && (pad.mx || pad.my)) { mx = pad.mx; my = pad.my; }
      const ml = Math.hypot(mx, my);
      if (ml > 1) { mx /= ml; my /= ml; }
      const intent = {
        mode: this.mode, mx, my,
        attack: this.attackHeld || this.keys.has('atk') || this.mouse.down || !!(pad && pad.attack),
        dodge: this.edges.dodge || !!(pad && pad.dodge),
        pause: this.edges.pause || !!(pad && pad.pause),
        casts: this.castQueue.splice(0),
        aiming: this.aiming, mouse: this.mouse, pad,
      };
      // Gamepad powers: hold to aim with the right stick, release to cast.
      if (pad) {
        pad.powers.forEach((down, slot) => {
          const key = 'padp' + slot;
          if (down && !this[key]) this.aiming = { slot, source: 'pad', manual: false, cancel: false };
          if (!down && this[key] && this.aiming && this.aiming.source === 'pad' && this.aiming.slot === slot) {
            intent.casts.push({ slot, pad: true, dx: pad.ax, dy: pad.ay, manual: Math.hypot(pad.ax, pad.ay) > 0.3 });
            this.aiming = null;
          }
          this[key] = down;
        });
        if (this.aiming && this.aiming.source === 'pad') { this.aiming.dx = pad.ax * DRAG_FULL; this.aiming.dy = pad.ay * DRAG_FULL; this.aiming.manual = Math.hypot(pad.ax, pad.ay) > 0.3; }
        intent.aiming = this.aiming;
      }
      this.edges.dodge = false;
      this.edges.pause = false;
      return intent;
    }

    reset() {
      this.keys.clear(); this.attackHeld = false; this.mouse.down = false; this.aiming = null; this.castQueue.length = 0;
      this.joy.x = this.joy.y = 0;
    }
  }

  Input.DRAG_FULL = DRAG_FULL;
  XS.Input = Input;
})(globalThis.XS = globalThis.XS || {});
