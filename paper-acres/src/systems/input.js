/* Unified input: keyboard, mouse, touch overlay and gamepad -> one action snapshot per frame. */
(function (root) {
  'use strict';
  const PA = root.PA = root.PA || {};
  const held = new Set();      // logical actions currently held (keyboard/mouse)
  const pressed = new Set();   // edges since last poll
  const virt = { moveX: 0, up: false, down: false, run: false, held: new Set() }; // touch overlay state
  let wheel = 0, hotbar = -1;
  const pointer = { x: 0, y: 0, down: false, inside: false, moved: false };
  const KEYMAP = {
    KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right',
    KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down',
    Space: 'jump', ShiftLeft: 'run', ShiftRight: 'run',
    KeyJ: 'use', KeyF: 'use', KeyE: 'interact', KeyK: 'interact', KeyQ: 'draw',
    Tab: 'menu', KeyI: 'menu', KeyM: 'map', Escape: 'pause', KeyP: 'pause', KeyR: 'eraser',
  };
  const NO_EDGES = { upP: false, downP: false, jumpP: false, useP: false, interactP: false, drawP: false, menuP: false, mapP: false, pauseP: false, eraserP: false, hotbar: -1, wheel: 0 };
  const padPrev = {};

  function press(a) { if (!held.has(a)) pressed.add(a); held.add(a); }
  function release(a) { held.delete(a); }

  const Input = PA.Input = {
    NO_EDGES, pointer, virt, blocked: false, uiTyping: false,
    init() {
      if (this.ready) return;
      this.ready = true;
      window.addEventListener('keydown', (e) => {
        if (Input.uiTyping) return;
        const a = KEYMAP[e.code];
        if (e.code.startsWith('Digit')) { const n = +e.code.slice(5); if (n >= 1 && n <= 9) { hotbar = n - 1; e.preventDefault(); } }
        if (a) { press(a); if (a !== 'pause' || !e.repeat) e.preventDefault(); }
        PA.Bus.emit('key', e);
      });
      window.addEventListener('keyup', (e) => { const a = KEYMAP[e.code]; if (a) release(a); });
      window.addEventListener('blur', () => { held.clear(); PA.Bus.emit('blur'); });
      const cv = () => document.querySelector('#game canvas');
      window.addEventListener('pointermove', (e) => { if (e.pointerType === 'mouse') { pointer.x = e.clientX; pointer.y = e.clientY; pointer.moved = true; } });
      window.addEventListener('pointerdown', (e) => {
        if (e.pointerType !== 'mouse' || e.target !== cv()) return;
        pointer.x = e.clientX; pointer.y = e.clientY; pointer.moved = true;
        if (e.button === 0) { press('use'); pointer.down = true; }
        if (e.button === 2) press('interact');
      });
      window.addEventListener('pointerup', (e) => { if (e.pointerType !== 'mouse') return; if (e.button === 0) { release('use'); pointer.down = false; } if (e.button === 2) release('interact'); });
      window.addEventListener('wheel', (e) => { if (e.target === cv()) wheel += Math.sign(e.deltaY); }, { passive: true });
    },
    /** Virtual buttons from the touch overlay. */
    vpress(a) { if (!virt.held.has(a)) pressed.add(a); virt.held.add(a); },
    vrelease(a) { virt.held.delete(a); },
    setHotbar(n) { hotbar = n; },
    clearAll() { held.clear(); pressed.clear(); virt.held.clear(); virt.moveX = 0; virt.up = virt.down = false; },
    isHeld(a) { return held.has(a) || virt.held.has(a); },
    gamepad() {
      const pads = navigator.getGamepads ? navigator.getGamepads() : [];
      const gp = pads && [...pads].find((p) => p && p.connected);
      if (!gp) return null;
      const b = (i) => !!(gp.buttons[i] && gp.buttons[i].pressed);
      const out = { moveX: Math.abs(gp.axes[0]) > 0.25 ? gp.axes[0] : (b(15) ? 1 : 0) - (b(14) ? 1 : 0), up: gp.axes[1] < -0.6 || b(12), down: gp.axes[1] > 0.6 || b(13),
        jump: b(0), use: b(2), interact: b(3), run: b(1) || b(10), draw: b(4) && !b(5) ? false : false, menu: b(9), pause: b(8), lb: b(4), rb: b(5),
        aim: Math.hypot(gp.axes[2] || 0, gp.axes[3] || 0) > 0.4 ? Math.atan2(gp.axes[3], gp.axes[2]) : null };
      const edge = (k, v) => { const e = v && !padPrev[k]; padPrev[k] = v; return e; };
      out.upP = edge('up', out.up); out.downP = edge('down', out.down); out.jumpP = edge('jump', out.jump); out.useP = edge('use', out.use);
      out.interactP = edge('interact', out.interact); out.menuP = edge('menu', out.menu); out.pauseP = edge('pause', out.pause);
      out.hot = edge('rb', out.rb) ? 1 : edge('lb', out.lb) ? -1 : 0;
      out.drawP = edge('draw', b(6) || b(7));
      return out;
    },
    poll() {
      const h = (a) => held.has(a) || virt.held.has(a);
      const p = (a) => pressed.has(a);
      const gp = this.gamepad();
      let moveX = (h('right') ? 1 : 0) - (h('left') ? 1 : 0);
      if (virt.moveX) moveX = virt.moveX;
      if (gp && gp.moveX) moveX = gp.moveX;
      const snap = {
        moveX,
        up: h('up') || virt.up || !!(gp && gp.up), down: h('down') || virt.down || !!(gp && gp.down),
        upP: p('up') || !!(gp && gp.upP), downP: p('down') || !!(gp && gp.downP),
        jump: h('jump') || !!(gp && gp.jump), jumpP: p('jump') || !!(gp && gp.jumpP),
        run: h('run') || virt.run || !!(gp && gp.run),
        use: h('use') || !!(gp && gp.use), useP: p('use') || !!(gp && gp.useP),
        interactP: p('interact') || !!(gp && gp.interactP), drawP: p('draw') || !!(gp && gp.drawP),
        menuP: p('menu') || !!(gp && gp.menuP), mapP: p('map'), pauseP: p('pause') || !!(gp && gp.pauseP), eraserP: p('eraser'),
        hotbar, wheel: wheel + (gp ? gp.hot : 0),
        aimPad: gp ? gp.aim : null, aimTouch: virt.aim != null ? virt.aim : null,
      };
      pressed.clear(); wheel = 0; hotbar = -1;
      if (this.blocked) {
        return Object.assign({}, snap, NO_EDGES, { moveX: 0, up: false, down: false, jump: false, run: false, use: false, menuP: snap.menuP, pauseP: snap.pauseP, mapP: snap.mapP });
      }
      return snap;
    },
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = Input;
})(typeof window !== 'undefined' ? window : globalThis);
