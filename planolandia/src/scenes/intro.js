/* Planolândia — introdução: Planolândia vista de cima, a voz que vem de "cima" e o Quadrado arrancado do plano.
 * O plano inclina até virar uma linha (Planolândia vista de lado) enquanto o Quadrado sobe. */
(function (root) {
  'use strict';
  const PL = root.PL || (root.PL = {});
  const M = PL.M;

  const LINES = [
    [0, 'Em Planolândia, tudo é chato: comprimento e largura, nada mais.'],
    [4.5, 'Lá vivia um Quadrado, professor de geometria. Ele nunca tinha olhado para cima, porque "cima" não existia.'],
    [10, 'Até a noite em que um círculo surgiu do nada no meio da sala, cresceu… e falou.'],
    [15, '— Para cima. Não para o norte.'],
    [19, 'E o Quadrado foi arrancado do plano.'],
  ];
  const END = 25;

  class IntroScene extends Phaser.Scene {
    constructor() { super('Intro'); }
    init(data) { this.data_ = data; }
    create() {
      this.t = 0;
      this.g = this.add.graphics();
      this.txt = this.add.bitmapText(0, 0, 'pxo', '').setDepth(10).setTint(0xf3e7cf);
      this.skipT = this.add.bitmapText(0, 0, 'pxo', '').setDepth(10).setTint(0x6a5aa8);
      this.done = false;
      const rnd = M.rng(5);
      this.folks = [];
      for (let i = 0; i < 14; i++) this.folks.push({ x: rnd() * 600 - 300, y: rnd() * 200 - 100, a: rnd() * 6, s: rnd() < 0.5 ? 'linha' : rnd() < 0.5 ? 'tri' : 'hex', sp: 6 + rnd() * 10 });
      this.houses = [];
      for (let i = 0; i < 7; i++) this.houses.push({ x: -260 + i * 90 + (rnd() - 0.5) * 30, y: (i % 2 ? -60 : 50) + (rnd() - 0.5) * 20, r: 22 + rnd() * 8, a: rnd() });
      this.input.on('pointerdown', () => this.skip());
      PL.Audio.music('title');
      this.cameras.main.fadeIn(500, 7, 4, 15);
    }
    skip() {
      if (this.done) return;
      this.done = true;
      this.cameras.main.fadeOut(400, 255, 255, 255);
      this.time.delayedCall(420, () => this.scene.start('Game', this.data_));
    }
    update(time, delta) {
      const dt = Math.min(delta / 1000, 1 / 20);
      this.t += dt;
      PL.Input.update();
      const I = PL.Input;
      if (I.pressed.confirm || I.pressed.pause || I.pressed.jump || I.pressed.attack) this.skip();
      if (this.t > END) this.skip();
      this.draw();
    }
    draw() {
      const g = this.g, W = this.scale.width, H = this.scale.height, t = this.t;
      g.clear();
      g.fillStyle(0x07040f, 1); g.fillRect(0, 0, W, H);
      const cx = W / 2, cy = H * 0.42;
      // inclinação do plano: 0 (visto de cima) → 1 (de lado: vira uma linha)
      const tilt = M.smooth(M.clamp((t - 18.5) / 3, 0, 1));
      const sy = Math.max(0.004, Math.cos(tilt * Math.PI / 2));
      const P = (x, y) => [cx + x, cy + y * sy + tilt * 40];
      // o plano
      const pw = 340, ph = 130;
      g.fillStyle(M.mix(0xe8dcc0, 0xf3e7cf, tilt), 1);
      const a = P(-pw, -ph), b = P(pw, ph);
      g.fillRect(Math.round(a[0]), Math.round(a[1]), Math.round(b[0] - a[0]), Math.max(1, Math.round(b[1] - a[1])));
      if (sy > 0.05) {
        // quadriculado leve
        g.fillStyle(0xd9c9b0, 1);
        for (let x = -pw; x <= pw; x += 20) { const p = P(x, -ph); g.fillRect(Math.round(p[0]), Math.round(p[1]), 1, Math.round(ph * 2 * sy)); }
        // casas pentagonais (em Planolândia as casas são pentágonos)
        for (const h of this.houses) this.poly(g, h.x, h.y, h.r, 5, h.a, 0xa8957a, 0x2a2140, P);
        // habitantes
        for (const f of this.folks) {
          f.x += Math.cos(f.a) * f.sp * 0.016; f.y += Math.sin(f.a) * f.sp * 0.016;
          if (Math.abs(f.x) > 300) f.a = Math.PI - f.a;
          if (Math.abs(f.y) > 110) f.a = -f.a;
          if (f.s === 'linha') { const p = P(f.x, f.y), q = P(f.x + Math.cos(f.a) * 8, f.y + Math.sin(f.a) * 8); g.lineStyle(1, 0x2a2140, 1); g.lineBetween(p[0], p[1], q[0], q[1]); }
          else this.poly(g, f.x, f.y, 5, f.s === 'tri' ? 3 : 6, f.a, f.s === 'tri' ? 0xe0475b : 0x5fb7a8, 0x2a2140, P);
        }
        // a casa do Quadrado e o Quadrado
        this.poly(g, 0, 0, 34, 5, -Math.PI / 2, 0xc4b5ea, 0x2a2140, P);
      }
      // o círculo que cresce: o visitante atravessando o plano
      if (t > 10 && t < 19.5) {
        const k = M.clamp((t - 10) / 3, 0, 1) * (t > 17 ? M.clamp((19.5 - t) / 2.5, 0, 1) : 1);
        const r = 6 + 28 * Math.sin(k * Math.PI / 2);
        const wob = t > 14.5 ? Math.sin(t * 30) * 2 : 0;
        const p = P(-70, 0);
        g.fillStyle(0x2a2140, 1); g.fillEllipse(p[0], p[1], (r + 2) * 2 + wob, (r + 2) * 2 * sy);
        g.fillStyle(t > 14.5 ? 0xff5fa2 : 0xe97c6b, 1); g.fillEllipse(p[0], p[1], r * 2 + wob, r * 2 * sy);
      }
      // o Quadrado sobe quando o plano vira linha
      const lift = M.clamp((t - 19) / 4, 0, 1);
      const qp = P(0, 0);
      const qy = qp[1] - M.easeOut(lift) * 90 - (lift > 0 ? 6 : 0);
      const shake = t > 15 && t < 19 ? Math.sin(t * 50) * 1 : 0;
      g.fillStyle(0x2a1e3b, 1); g.fillRect(Math.round(qp[0] - 7 + shake), Math.round(qy - 7 * Math.max(sy, lift)), 14, Math.max(2, Math.round(14 * Math.max(sy, lift))));
      g.fillStyle(0xf6d55c, 1); g.fillRect(Math.round(qp[0] - 6 + shake), Math.round(qy - 6 * Math.max(sy, lift)), 12, Math.max(1, Math.round(12 * Math.max(sy, lift))));
      if (lift > 0.3) {
        g.fillStyle(0xffffff, 1); g.fillRect(Math.round(qp[0] - 4), Math.round(qy - 3), 3, 3); g.fillRect(Math.round(qp[0] + 1), Math.round(qy - 3), 3, 3);
        g.fillStyle(0x2a1e3b, 1); g.fillRect(Math.round(qp[0] - 3), Math.round(qy - 3), 1, 2); g.fillRect(Math.round(qp[0] + 2), Math.round(qy - 3), 1, 2);
        // raios de luz vindos de cima
        g.fillStyle(0xfff1a8, 0.15 * lift);
        g.fillTriangle(qp[0] - 30, 0, qp[0] + 30, 0, qp[0], qy);
      }
      // texto
      let cur = '';
      for (const [t0, s] of LINES) if (t >= t0) cur = s.slice(0, Math.floor((t - t0) * 40));
      const lines = PL.Font.wrap(cur, Math.min(380, W - 40));
      this.txt.setText(lines.join('\n'));
      this.txt.setPosition(Math.round(W / 2 - this.txt.width / 2), Math.round(H - 26 - lines.length * 13));
      this.skipT.setText(PL.UI.keys('[confirm] ou toque: pular')).setPosition(W - this.skipT.width - 6, 6);
      if (t > END - 1.2) { g.fillStyle(0xffffff, M.clamp((t - (END - 1.2)) / 1.2, 0, 1)); g.fillRect(0, 0, W, H); }
    }
    poly(g, x, y, r, n, a0, fill, out, P) {
      const pts = [];
      for (let i = 0; i < n; i++) { const a = a0 + (i / n) * Math.PI * 2; pts.push(P(x + Math.cos(a) * r, y + Math.sin(a) * r)); }
      g.fillStyle(out, 1);
      for (const [ox, oy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) { g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(p[0] + ox, p[1] + oy) : g.moveTo(p[0] + ox, p[1] + oy))); g.closePath(); g.fillPath(); }
      g.fillStyle(fill, 1);
      g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.closePath(); g.fillPath();
    }
  }

  PL.IntroScene = IntroScene;
})(typeof globalThis !== 'undefined' ? globalThis : this);
