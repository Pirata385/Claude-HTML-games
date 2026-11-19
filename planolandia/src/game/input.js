/* Planolândia — camada de entrada: teclado (2 esquemas), mouse, gamepad e toque → ações.
 * Independente do Phaser; o toque escreve em Input.virt a partir da cena do HUD. */
(function (root) {
  'use strict';
  const PL = root.PL || (root.PL = {});

  const ACTIONS = ['left', 'right', 'up', 'down', 'zf', 'zb', 'jump', 'attack', 'dash', 'focus', 'map', 'pause', 'confirm', 'back'];

  const PRESETS = {
    wasd: {
      left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'], up: ['KeyW', 'ArrowUp'], down: ['KeyS', 'ArrowDown'],
      zb: ['KeyQ'], zf: ['KeyE'], jump: ['Space'], attack: ['KeyJ'], dash: ['KeyK', 'ShiftLeft', 'ShiftRight'], focus: ['KeyL'],
      map: ['Tab', 'KeyM'], pause: ['Escape', 'KeyP'], confirm: ['Enter', 'Space', 'KeyJ'], back: ['Escape', 'Backspace'],
    },
    setas: {
      left: ['ArrowLeft'], right: ['ArrowRight'], up: ['ArrowUp'], down: ['ArrowDown'],
      zb: ['KeyA'], zf: ['KeyS'], jump: ['KeyZ'], attack: ['KeyX'], dash: ['KeyC'], focus: ['KeyV'],
      map: ['KeyM', 'Tab'], pause: ['Escape'], confirm: ['Enter', 'KeyZ'], back: ['Escape', 'KeyX'],
    },
  };
  const LABELS = {
    wasd: { left: 'A', right: 'D', up: 'W', down: 'S', zb: 'Q', zf: 'E', jump: 'Espaço', attack: 'J', dash: 'K', focus: 'L', map: 'M', pause: 'Esc' },
    setas: { left: '←', right: '→', up: '↑', down: '↓', zb: 'A', zf: 'S', jump: 'Z', attack: 'X', dash: 'C', focus: 'V', map: 'M', pause: 'Esc' },
    pad: { left: '◄', right: '►', up: '▲', down: '▼', zb: 'LB', zf: 'RB', jump: 'A', attack: 'X', dash: 'B', focus: 'Y', map: 'Select', pause: 'Start' },
    toque: { zb: '▼ joystick', zf: '▲ joystick', jump: 'PULO', attack: 'GOLPE', dash: 'INVESTIDA', focus: 'FOCO', map: 'MAPA', pause: '❚❚' },
  };

  const keys = Object.create(null);
  const mouse = { l: false, r: false };
  const state = {};
  const prev = {};
  for (const a of ACTIONS) { state[a] = false; prev[a] = false; }

  const Input = {
    ACTIONS, PRESETS, LABELS,
    preset: 'wasd',
    down: state,
    pressed: {},
    released: {},
    axisZ: 0,          // −1..1 (analógico: gamepad direito, joystick de toque)
    axisX: 0,
    last: 'teclado',   // último dispositivo usado (para textos de ajuda)
    virt: { buttons: {}, axisX: 0, axisY: 0, axisZ: 0, active: false },
    padIndex: -1,
    enabled: true,
    gameMouse: false,

    init(target) {
      const t = target || window;
      const block = ['Space', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
      t.addEventListener('keydown', (e) => {
        keys[e.code] = true;
        Input.last = 'teclado';
        if (block.includes(e.code)) e.preventDefault();
      });
      t.addEventListener('keyup', (e) => { keys[e.code] = false; });
      t.addEventListener('blur', () => { for (const k in keys) keys[k] = false; mouse.l = mouse.r = false; });
      window.addEventListener('mousedown', (e) => {
        if (!Input.gameMouse || e.target.tagName !== 'CANVAS') return;
        if (e.button === 0) mouse.l = true;
        if (e.button === 2) mouse.r = true;
        Input.last = 'teclado';
      });
      window.addEventListener('mouseup', (e) => { if (e.button === 0) mouse.l = false; if (e.button === 2) mouse.r = false; });
      window.addEventListener('contextmenu', (e) => { if (e.target.tagName === 'CANVAS') e.preventDefault(); });
      window.addEventListener('gamepadconnected', (e) => { Input.padIndex = e.gamepad.index; });
    },

    setPreset(p) { if (PRESETS[p]) Input.preset = p; },

    label(action) {
      const dev = Input.last === 'pad' ? 'pad' : Input.last === 'toque' ? 'toque' : Input.preset;
      return (LABELS[dev] && LABELS[dev][action]) || LABELS[Input.preset][action] || action;
    },

    update() {
      const map = PRESETS[Input.preset];
      for (const a of ACTIONS) {
        let v = false;
        const ks = map[a];
        for (let i = 0; i < ks.length; i++) if (keys[ks[i]]) { v = true; break; }
        state[a] = v;
      }
      if (mouse.l) state.attack = true;
      if (mouse.r) state.focus = true;
      let az = 0, ax = 0;
      // gamepad (mapeamento padrão)
      const pads = navigator.getGamepads ? navigator.getGamepads() : [];
      for (let i = 0; i < pads.length; i++) {
        const gp = pads[i];
        if (!gp || !gp.connected) continue;
        const b = (n) => !!(gp.buttons[n] && gp.buttons[n].pressed);
        const lx = gp.axes[0] || 0, ly = gp.axes[1] || 0, ry = gp.axes[3] || 0;
        let any = false;
        const set = (a, val) => { if (val) { state[a] = true; any = true; } };
        set('jump', b(0)); set('dash', b(1)); set('attack', b(2)); set('focus', b(3));
        set('zb', b(4) || b(6)); set('zf', b(5) || b(7));
        set('map', b(8)); set('pause', b(9));
        set('up', b(12) || ly < -0.5); set('down', b(13) || ly > 0.5);
        set('left', b(14) || lx < -0.35); set('right', b(15) || lx > 0.35);
        set('confirm', b(0)); set('back', b(1));
        if (Math.abs(ry) > 0.25) { az = -ry; any = true; }
        if (Math.abs(lx) > 0.2) ax = lx;
        if (any) Input.last = 'pad';
      }
      // toque
      const v = Input.virt;
      if (v.active) {
        for (const k in v.buttons) if (v.buttons[k]) state[k] = true;
        if (v.axisX < -0.35) state.left = true;
        if (v.axisX > 0.35) state.right = true;
        if (Math.abs(v.axisZ) > 0.2) az = v.axisZ;
        if (v.axisY < -0.6) state.up = true;
        if (v.axisY > 0.6) state.down = true;
      }
      if (!Input.enabled) for (const a of ACTIONS) state[a] = false;
      for (const a of ACTIONS) {
        Input.pressed[a] = state[a] && !prev[a];
        Input.released[a] = !state[a] && prev[a];
        prev[a] = state[a];
      }
      // eixo de profundidade final: digital (teclas) ou analógico
      let dz = (state.zf ? 1 : 0) - (state.zb ? 1 : 0);
      if (dz === 0) dz = az;
      Input.axisZ = Input.enabled ? dz : 0;
      Input.axisX = ax;
    },

    // consome um "pressed" (para menus não reagirem duas vezes)
    eat(a) { Input.pressed[a] = false; },
    clearAll() { for (const k in keys) keys[k] = false; for (const a of ACTIONS) { state[a] = false; Input.pressed[a] = false; } mouse.l = mouse.r = false; Input.virt.buttons = {}; },
  };

  PL.Input = Input;

  if (typeof module !== 'undefined' && module.exports) module.exports = PL;
})(typeof globalThis !== 'undefined' ? globalThis : this);
