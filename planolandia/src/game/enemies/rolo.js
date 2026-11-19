/* Rolo — um tronco curto deitado ao longo de z. No corte, um círculo com anéis de madeira girando.
 * Rola de um lado para o outro e dispara quando avista o Quadrado; bate na parede e fica tonto. */
(function (root) {
  'use strict';
  const PL = root.PL || (root.PL = {});
  const G3 = PL.G3, M = PL.M, Phys = PL.Phys;

  class Rolo extends PL.Enemy {
    constructor(G, d) {
      super(G, d);
      this.r = d.r || 11; this.len = d.len || 28;
      this.hp = this.maxHp = d.hp || 4;
      this.drop = 3;
      this.mat = 'casca';
      this.body = Phys.body(this.x, this.y, this.z, this.r - 1, this.r);
      this.prim = G3.cyl('z', this.x, this.y, this.z, this.r, this.len / 2);
      this.dir = d.dir || (Math.random() < 0.5 ? -1 : 1);
      this.state = 'roll'; this.stT = 0;
      this.ang = 0;
      this.kbT = 0;
    }
    zRange() { return [this.z - this.len / 2, this.z + this.len / 2]; }
    sliceAt(z, out) {
      const p = this.prim;
      p.cx = this.x; p.cy = this.y; p.cz = this.z; p.zMin = this.z - this.len / 2; p.zMax = this.z + this.len / 2;
      return G3.sliceInto(p, z, out);
    }
    update(dt, G) {
      const b = this.body, P = G.player;
      this.t += dt; this.stT += dt;
      this.flashT = Math.max(0, this.flashT - dt);
      this.kbT = Math.max(0, this.kbT - dt);
      b.vy = Math.min(b.vy + Phys.GRAV * dt, Phys.MAX_FALL);
      const sees = !P.dead && Math.abs(P.z - this.z) < this.len / 2 + 4 && Math.abs(P.y - this.y) < 30 && Math.abs(P.x - this.x) < 150 && Math.sign(P.x - this.x) === this.dir;
      if (this.state === 'roll') {
        if (this.kbT <= 0) b.vx = M.approach(b.vx, this.dir * 40, 300 * dt);
        if (b.wall === this.dir) { this.dir *= -1; }
        if (sees) { this.state = 'rev'; this.stT = 0; G.sfx('alert'); }
      } else if (this.state === 'rev') {
        b.vx = M.approach(b.vx, -this.dir * 10, 400 * dt);
        if (Math.random() < 0.5) G.fx.spawn({ x: b.x - this.dir * this.r, y: b.y + this.r, z: this.z, vx: -this.dir * 40, vy: -30, life: 0.3, color: 0xb07a52, grav: 100 });
        if (this.stT > 0.45) { this.state = 'charge'; this.stT = 0; }
      } else if (this.state === 'charge') {
        b.vx = this.dir * 190;
        if (b.wall === this.dir || this.stT > 1.4) {
          this.state = 'dizzy'; this.stT = 0;
          if (b.wall) { G.shake(2, 0.12); G.sfx('thud'); b.vx = -this.dir * 60; b.vy = -120; }
        }
      } else if (this.state === 'dizzy') {
        b.vx = M.approach(b.vx, 0, 300 * dt);
        if (this.stT > 0.9) { this.state = 'roll'; this.stT = 0; this.dir *= -1; }
      }
      Phys.move(b, G.room, dt);
      b.x = M.clamp(b.x, this.r, G.room.w - this.r);
      if (b.y > G.room.h + 40) this.alive = false;
      this.x = b.x; this.y = b.y;
      this.ang += (b.vx / this.r) * dt;
    }
    onHurt(G, dirX) { if (this.state !== 'charge') { this.body.vx = dirX * 120; this.kbT = 0.2; } }
    draw(g, G, t) {
      this.drawGhost(g, G);
      if (!this.visible) return;
      const s = this.s, cx = Math.round(s.cx), cy = Math.round(s.cy), r = s.r;
      const mat = PL.MATS.casca;
      g.fillStyle(mat.out, 1); g.fillCircle(cx, cy, r + 1);
      g.fillStyle(this.flashT > 0 ? 0xffffff : 0xd9a37a, 1); g.fillCircle(cx, cy, r);
      if (this.flashT > 0) return;
      // anéis de crescimento e raios girando (a face do tronco cortado)
      g.lineStyle(1, 0xa8743f, 1); g.strokeCircle(cx, cy, r * 0.65); g.strokeCircle(cx, cy, r * 0.32);
      g.lineStyle(1, 0x8a5a3c, 1);
      for (let i = 0; i < 3; i++) { const a = this.ang + (i * Math.PI * 2) / 3; g.lineBetween(cx, cy, cx + Math.cos(a) * (r - 1), cy + Math.sin(a) * (r - 1)); }
      g.lineStyle(1, mat.dark, 1); g.strokeCircle(cx, cy, r - 0.5);
      const angry = this.state === 'rev' || this.state === 'charge';
      if (this.state === 'dizzy') { g.fillStyle(0xfff1a8, 1); for (let i = 0; i < 3; i++) { const a = t * 6 + i * 2.1; g.fillRect(Math.round(cx + Math.cos(a) * 8), Math.round(cy - r - 4 + Math.sin(a) * 2), 1, 1); } }
      else this.drawEyes(g, cx + this.dir * 2, cy - 2, r * 1.6, angry);
    }
  }

  PL.ENEMIES.rolo = Rolo;

  if (typeof module !== 'undefined' && module.exports) module.exports = PL;
})(typeof globalThis !== 'undefined' ? globalThis : this);
