/* Planolândia — controles de toque: joystick flutuante (andar + profundidade ou mira),
 * botões PULO, GOLPE (arraste para cima/baixo para mirar), INVESTIDA, FOCO, contexto, mapa e pausa. */
(function (root) {
  'use strict';
  const PL = root.PL || (root.PL = {});

  class Touch {
    constructor(scene) {
      this.scene = scene;
      this.g = scene.add.graphics().setDepth(150).setScrollFactor(0);
      this.labels = {};
      this.enabled = false;
      this.joy = null;          // { id, ox, oy, x, y }
      this.held = {};           // pointerId → nome do botão
      this.atk = null;          // golpe pendente { id, x, y, t }
      this.pulse = {};          // botões pressionados por poucos quadros
      this.buttons = [];
      this.showContext = false;
      scene.input.addPointer(3);
      scene.input.on('pointerdown', (p) => this.down(p));
      scene.input.on('pointermove', (p) => this.move(p));
      scene.input.on('pointerup', (p) => this.up(p));
      scene.input.on('pointerupoutside', (p) => this.up(p));
      const isTouch = (root.matchMedia && root.matchMedia('(pointer: coarse)').matches) || ('ontouchstart' in root);
      if (isTouch) this.enable();
      root.addEventListener('touchstart', () => { if (!this.enabled) this.enable(); PL.Input.last = 'toque'; }, { passive: true });
      this.layout();
    }
    enable() { this.enabled = true; PL.Input.virt.active = true; this.layout(); }
    layout() {
      const W = this.scene.scale.width, H = this.scene.scale.height;
      const S = PL.Save.settings();
      this.opacity = S.touchOpacity;
      this.depthMode = S.touchDepth;
      const k = S.touchScale;
      const r = 17 * k, R = 21 * k;
      const bx = W - 34 * k, by = H - 34 * k;
      this.buttons = [
        { name: 'jump', x: bx, y: by, r: R, label: 'PULO' },
        { name: 'attack', x: bx - 50 * k, y: by + 4 * k, r: R, label: 'GOLPE', swipe: true },
        { name: 'dash', x: bx - 6 * k, y: by - 48 * k, r, label: 'INVEST.' },
        { name: 'focus', x: bx - 56 * k, y: by - 44 * k, r, label: 'FOCO' },
        { name: 'pause', x: W - 16, y: 16, r: 11, label: '❚❚', small: true },
        { name: 'map', x: W - 42, y: 16, r: 11, label: 'MAPA', small: true },
        { name: 'context', x: bx - 26 * k, y: by - 92 * k, r: 15 * k, label: '▲', ctx: true },
      ];
      if (this.depthMode === 'botoes') {
        this.buttons.push({ name: 'zf', x: bx - 100 * k, y: by - 30 * k, r: r * 0.9, label: '▲F' }, { name: 'zb', x: bx - 100 * k, y: by + 8 * k, r: r * 0.9, label: '▼T' });
      }
      for (const b of this.buttons) b.hidden = false;
      this.joyZone = { x: 0, y: H * 0.25, w: W * 0.45, h: H * 0.75 };
    }
    hit(p) {
      for (const b of this.buttons) {
        if (b.ctx && !this.showContext) continue;
        const dx = p.x - b.x, dy = p.y - b.y, rr = (b.r + 6) * (b.r + 6);
        if (dx * dx + dy * dy <= rr) return b;
      }
      return null;
    }
    blocked() { const hud = this.scene; return !this.enabled || (hud.menuOpen && hud.menuOpen()); }
    down(p) {
      if (!p.wasTouch && p.pointerType !== 'touch') return;
      if (!this.enabled) this.enable();
      PL.Input.last = 'toque';
      const hud = this.scene;
      if (hud.dialogOpen && hud.dialogOpen()) { hud.advanceDialog(); return; }
      if (this.blocked()) return;
      const b = this.hit(p);
      if (b) {
        if (b.name === 'pause') { hud.togglePause(); return; }
        if (b.name === 'map') { hud.toggleMap(); return; }
        if (b.name === 'context') { this.pulse.up = 3; return; }
        if (b.swipe) { this.atk = { id: p.id, x: p.x, y: p.y, t: performance.now() }; return; }
        this.held[p.id] = b.name;
        return;
      }
      const z = this.joyZone;
      if (!this.joy && p.x >= z.x && p.x <= z.x + z.w && p.y >= z.y) this.joy = { id: p.id, ox: p.x, oy: p.y, x: p.x, y: p.y };
    }
    move(p) {
      if (this.joy && p.id === this.joy.id) { this.joy.x = p.x; this.joy.y = p.y; }
      if (this.atk && p.id === this.atk.id) {
        const dy = p.y - this.atk.y;
        if (Math.abs(dy) > 10) this.fireAttack(dy < 0 ? 'up' : 'down');
      }
    }
    up(p) {
      if (this.joy && p.id === this.joy.id) this.joy = null;
      if (this.atk && p.id === this.atk.id) this.fireAttack(null);
      delete this.held[p.id];
    }
    fireAttack(dir) {
      this.atk = null;
      this.pulse.attack = 3;
      if (dir) this.pulse[dir] = 6;
    }
    update() {
      const v = PL.Input.virt;
      v.buttons = {};
      if (!this.enabled) return;
      if (this.atk && performance.now() - this.atk.t > 90) this.fireAttack(null);
      for (const id in this.held) v.buttons[this.held[id]] = true;
      for (const k in this.pulse) { if (this.pulse[k] > 0) { v.buttons[k] = true; this.pulse[k]--; } }
      v.axisX = 0; v.axisY = 0; v.axisZ = 0;
      if (this.joy) {
        const dx = this.joy.x - this.joy.ox, dy = this.joy.y - this.joy.oy;
        const max = 26;
        v.axisX = Math.max(-1, Math.min(1, dx / max));
        const ay = Math.max(-1, Math.min(1, dy / max));
        if (this.depthMode === 'joystick') v.axisZ = Math.abs(ay) > 0.3 ? -ay : 0;
        else v.axisY = ay;
        // a mira para cima também serve para interagir quando o joystick controla a mira
        if (this.joy && Math.hypot(dx, dy) > max) { const a = Math.atan2(dy, dx); this.joy.ox = this.joy.x - Math.cos(a) * max; this.joy.oy = this.joy.y - Math.sin(a) * max; }
      }
    }
    draw() {
      const g = this.g;
      g.clear();
      for (const k in this.labels) this.labels[k].setVisible(false);
      if (!this.enabled || this.blocked()) return;
      const a = this.opacity;
      if (this.joy) {
        g.lineStyle(2, 0xffffff, a * 0.6); g.strokeCircle(this.joy.ox, this.joy.oy, 26);
        g.fillStyle(0xffffff, a * 0.5); g.fillCircle(this.joy.x, this.joy.y, 10);
        if (this.depthMode === 'joystick') {
          g.fillStyle(0xffa65c, a * 0.8); g.fillTriangle(this.joy.ox, this.joy.oy - 34, this.joy.ox - 4, this.joy.oy - 29, this.joy.ox + 4, this.joy.oy - 29);
          g.fillStyle(0x6fb6ff, a * 0.8); g.fillTriangle(this.joy.ox, this.joy.oy + 34, this.joy.ox - 4, this.joy.oy + 29, this.joy.ox + 4, this.joy.oy + 29);
        }
      } else {
        const z = this.joyZone;
        g.lineStyle(1, 0xffffff, a * 0.25); g.strokeCircle(z.x + 54, z.y + z.h - 50, 26);
      }
      const v = PL.Input.virt.buttons;
      for (const b of this.buttons) {
        if (b.ctx && !this.showContext) continue;
        const on = v[b.name] || (b.swipe && this.atk);
        g.fillStyle(on ? 0xf6d55c : 0x150f29, a * (on ? 0.8 : 0.55));
        g.fillCircle(b.x, b.y, b.r);
        g.lineStyle(1, b.ctx ? 0xf6d55c : 0xffffff, a);
        g.strokeCircle(b.x, b.y, b.r);
        let t = this.labels[b.name];
        if (!t) t = this.labels[b.name] = this.scene.add.bitmapText(0, 0, 'pxo', b.label).setDepth(151).setScrollFactor(0);
        t.setText(b.label).setVisible(true).setAlpha(Math.min(1, a + 0.3));
        t.setPosition(Math.round(b.x - t.width / 2), Math.round(b.y - 6));
      }
    }
  }

  PL.Touch = Touch;

  if (typeof module !== 'undefined' && module.exports) module.exports = PL;
})(typeof globalThis !== 'undefined' ? globalThis : this);
