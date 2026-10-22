// Touch (floating joystick + Brawl Stars-style aim pads on the power and
// attack buttons), keyboard + mouse and gamepad, merged into one per-frame
// "intent" the game turns into a fighter controller. Screen-space directions
// are converted to world space by main.js. Holding a power's aim charges it
// (for "Carregável" powers).
(function (XS) {
  'use strict';

  const DRAG_MANUAL = 16;   // CSS px before a press on a power becomes manual aim
  const DRAG_FULL = 80;     // CSS px of drag = full range
  const CHARGE_TIME = 1;    // seconds of aiming for a full charge
  const chargeSince = (t0) => Math.max(0, Math.min(1, ((performance.now() - t0) / 1000 - 0.15) / CHARGE_TIME));
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
      this.aiming = null;     // { slot, source, dx, dy, manual, cancel, t0 }
      this.castQueue = [];    // { slot, manual, dx, dy, dist, charge } (touch) or { slot, mouse: true, charge }
      this.atkAim = null;     // dragging the attack button: { dx, dy, manual, cancel }
      this.atkQueue = [];     // aimed basic attacks: { dx, dy }
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
        if (k[0] === 'p') this.aiming = { slot: +k[1], source: 'key', manual: true, cancel: false, t0: performance.now() };
      });
      this.on(window, 'keyup', (e) => {
        const k = KEYMAP[e.code];
        if (!k) return;
        this.keys.delete(k);
        if (k[0] === 'p' && this.aiming && this.aiming.source === 'key' && this.aiming.slot === +k[1]) {
          this.castQueue.push({ slot: this.aiming.slot, mouse: true, charge: chargeSince(this.aiming.t0) });
          this.aiming = null;
        }
      });
      this.on(window, 'blur', () => { this.keys.clear(); this.attackHeld = false; this.mouse.down = false; this.joy.id = null; this.aiming = null; this.atkAim = null; this.hidePad(); });
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
        this.on(el, 'pointercancel', (e) => { el.classList.remove('down'); if (this.aiming) this.aiming.cancel = true; if (this.atkAim) this.atkAim.cancel = true; up(e); });
      };
      // The aim pad: a ring around the pressed button with a knob that follows
      // the finger. Dragging aims (and sets the distance for thrown powers);
      // coming back to the centre cancels.
      this.pad2 = els.aimPad;
      const track = (a, e, sx, sy) => {
        a.dx = e.clientX - sx; a.dy = e.clientY - sy;
        const d = Math.hypot(a.dx, a.dy);
        if (d > DRAG_MANUAL) a.manual = true;
        a.cancel = a.manual && d < DRAG_MANUAL * 0.6;
        this.movePad(a);
      };
      press(els.dodge, () => { this.edges.dodge = true; }, () => {});
      let atx = 0, aty = 0;
      // Tap = one auto-aimed attack; hold still = keep attacking; drag = aim,
      // release to strike that way.
      press(els.attack, (e) => {
        atx = e.clientX; aty = e.clientY;
        this.atkAim = { dx: 0, dy: 0, manual: false, cancel: false, t0: performance.now() };
        this.showPad(els.attack, '#ffd166');
      }, () => {
        const a = this.atkAim;
        this.attackHeld = false; this.atkAim = null; this.hidePad();
        if (!a || a.cancel) return;
        if (a.manual) this.atkQueue.push({ dx: a.dx, dy: a.dy });
        else if (performance.now() - a.t0 < 180) this.atkQueue.push({ auto: true });
      });
      this.on(els.attack, 'pointermove', (e) => {
        const a = this.atkAim;
        if (!a) return;
        track(a, e, atx, aty);
        if (a.manual) this.attackHeld = false; // aimed attacks fire on release
      });
      els.powers.forEach((btn, slot) => {
        let sx = 0, sy = 0;
        press(btn, (e) => {
          sx = e.clientX; sy = e.clientY;
          this.aiming = { slot, source: 'touch', dx: 0, dy: 0, manual: false, cancel: false, t0: performance.now() };
          this.showPad(btn, getComputedStyle(btn).getPropertyValue('--glow') || '#ffffff');
        }, () => {
          const a = this.aiming;
          this.hidePad();
          if (!a || a.slot !== slot || a.source !== 'touch') return;
          this.aiming = null;
          if (a.cancel) return;
          this.castQueue.push({ slot, manual: a.manual, dx: a.dx, dy: a.dy, dist: Math.min(1, Math.hypot(a.dx, a.dy) / DRAG_FULL), charge: chargeSince(a.t0) });
        });
        this.on(btn, 'pointermove', (e) => {
          const a = this.aiming;
          if (!a || a.slot !== slot || a.source !== 'touch') return;
          track(a, e, sx, sy);
        });
      });
    }

    showPad(btn, color) {
      const p = this.pad2;
      if (!p) return;
      const r = btn.getBoundingClientRect();
      p.style.left = r.left + r.width / 2 + 'px';
      p.style.top = r.top + r.height / 2 + 'px';
      p.style.setProperty('--glow', color.trim() || '#ffffff');
      p.classList.remove('hidden', 'cancel');
      this.movePad({ dx: 0, dy: 0 });
    }
    movePad(a) {
      const p = this.pad2;
      if (!p) return;
      const d = Math.hypot(a.dx, a.dy), k = d > DRAG_FULL ? DRAG_FULL / d : 1;
      p.querySelector('.aim-knob').style.transform = `translate(${a.dx * k}px, ${a.dy * k}px)`;
      p.classList.toggle('cancel', !!a.cancel);
    }
    hidePad() { if (this.pad2) this.pad2.classList.add('hidden'); }

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
      if (this.atkAim && !this.atkAim.manual && performance.now() - this.atkAim.t0 >= 180) this.attackHeld = true;
      const intent = {
        mode: this.mode, mx, my,
        attack: this.attackHeld || this.keys.has('atk') || this.mouse.down || !!(pad && pad.attack),
        dodge: this.edges.dodge || !!(pad && pad.dodge),
        pause: this.edges.pause || !!(pad && pad.pause),
        casts: this.castQueue.splice(0),
        aiming: this.aiming, mouse: this.mouse, pad,
        basicAim: this.atkAim, basicCasts: this.atkQueue.splice(0),
      };
      // Gamepad powers: hold to aim with the right stick, release to cast.
      if (pad) {
        pad.powers.forEach((down, slot) => {
          const key = 'padp' + slot;
          if (down && !this[key]) this.aiming = { slot, source: 'pad', manual: false, cancel: false, t0: performance.now() };
          if (!down && this[key] && this.aiming && this.aiming.source === 'pad' && this.aiming.slot === slot) {
            intent.casts.push({ slot, pad: true, dx: pad.ax, dy: pad.ay, manual: Math.hypot(pad.ax, pad.ay) > 0.3, charge: chargeSince(this.aiming.t0) });
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
      this.atkAim = null; this.atkQueue.length = 0; this.hidePad();
      this.edges.dodge = false; this.edges.pause = false;
      this.joy.x = this.joy.y = 0;
    }
  }

  Input.DRAG_FULL = DRAG_FULL;
  Input.chargeSince = chargeSince;
  XS.Input = Input;
})(globalThis.XS = globalThis.XS || {});
