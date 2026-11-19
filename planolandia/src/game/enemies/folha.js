/* Folha — um disco fino e horizontal que voa. No corte vira uma lâmina estreita com nervuras,
 * larga quando o plano passa pelo meio dela e fina perto das bordas. Paira em seno e mergulha no Quadrado. */
(function (root) {
  'use strict';
  const PL = root.PL || (root.PL = {});
  const G3 = PL.G3, M = PL.M;

  class Folha extends PL.Enemy {
    constructor(G, d) {
      super(G, d);
      this.R = d.r || 14;
      this.hp = this.maxHp = d.hp || 2;
      this.drop = 2;
      this.mat = 'copa';
      this.hx = this.x; this.hy = this.y; this.hz = this.z;
      this.state = 'hover'; this.stT = Math.random() * 2;
      this.vx = 0; this.vy = 0; this.vz = 0;
      this.flap = 0;
      this.prim = G3.cyl('y', this.x, this.y, this.z, this.R, 2);
    }
    zRange() { return [this.z - this.R, this.z + this.R]; }
    sliceAt(z, out) {
      const p = this.prim;
      const th = 2 + Math.abs(Math.sin(this.flap)) * 1.5;
      p.cx = this.x; p.cy = this.y; p.cz = this.z; p.hl = th;
      p.xMin = this.x - this.R; p.xMax = this.x + this.R; p.yMin = this.y - th; p.yMax = this.y + th; p.zMin = this.z - this.R; p.zMax = this.z + this.R;
      return G3.sliceInto(p, z, out);
    }
    update(dt, G) {
      const P = G.player;
      this.t += dt; this.stT += dt;
      this.flashT = Math.max(0, this.flashT - dt);
      this.flap += dt * (this.state === 'dive' ? 22 : 9);
      const dx = P.x - this.x, dy = P.y - this.y;
      const near = !P.dead && Math.abs(dx) < 140 && dy > -30 && dy < 120;
      if (this.state === 'hover') {
        const tx = this.hx + Math.sin(this.t * 0.8) * 40, ty = this.hy + Math.sin(this.t * 1.7) * 10;
        this.x = M.damp(this.x, tx, 2, dt); this.y = M.damp(this.y, ty, 2, dt);
        // aproxima-se do plano do Quadrado devagar
        this.z = M.damp(this.z, near ? P.z : this.hz + Math.sin(this.t * 0.5) * 30, near ? 1.2 : 0.6, dt);
        if (near && this.stT > 2.2 && Math.abs(P.z - this.z) < this.R) { this.state = 'aim'; this.stT = 0; G.sfx('alert'); }
      } else if (this.state === 'aim') {
        this.y -= 20 * dt;
        if (this.stT > 0.4) {
          const l = Math.hypot(dx, dy) || 1;
          this.vx = (dx / l) * 200; this.vy = (dy / l) * 200;
          this.state = 'dive'; this.stT = 0;
        }
      } else if (this.state === 'dive') {
        this.x += this.vx * dt; this.y += this.vy * dt;
        this.vx *= Math.exp(-1.2 * dt); this.vy *= Math.exp(-1.2 * dt);
        if (this.stT > 0.9) { this.state = 'back'; this.stT = 0; }
      } else if (this.state === 'back') {
        this.x = M.damp(this.x, this.hx, 1.5, dt); this.y = M.damp(this.y, this.hy, 1.5, dt);
        if (this.stT > 1.2) { this.state = 'hover'; this.stT = 0; }
      }
      this.x = M.clamp(this.x, this.R, G.room.w - this.R);
      this.y = M.clamp(this.y, 10, G.room.h - 10);
    }
    onHurt(G, dirX, dirY) { this.x += dirX * 10; this.y += dirY * 10; this.state = 'back'; this.stT = 0; }
    draw(g, G, t) {
      this.drawGhost(g, G);
      if (!this.visible) return;
      const s = this.s, w = s.maxX - s.minX, cx = s.cx, cy = Math.round(s.cy);
      const out = 0x10261a;
      const half = w / 2;
      // lâmina em forma de folha (pontas finas), com nervura central
      g.fillStyle(out, 1);
      g.fillTriangle(cx - half - 1, cy, cx, cy - 3, cx, cy + 3); g.fillTriangle(cx + half + 1, cy, cx, cy - 3, cx, cy + 3);
      g.fillStyle(this.flashT > 0 ? 0xffffff : 0x6fc27a, 1);
      g.fillTriangle(cx - half, cy, cx, cy - 2, cx, cy + 2); g.fillTriangle(cx + half, cy, cx, cy - 2, cx, cy + 2);
      if (this.flashT > 0) return;
      g.fillStyle(0x2a6342, 1); g.fillRect(Math.round(cx - half + 2), cy, Math.max(1, Math.round(w - 4)), 1);
      if (w > 14) { g.fillStyle(0xffffff, 1); g.fillRect(Math.round(cx - 2), cy - 2, 1, 1); g.fillRect(Math.round(cx + 1), cy - 2, 1, 1); g.fillStyle(this.state === 'aim' || this.state === 'dive' ? 0xe0475b : out, 1); g.fillRect(Math.round(cx - 2), cy - 1, 1, 1); g.fillRect(Math.round(cx + 1), cy - 1, 1, 1); }
    }
  }

  PL.ENEMIES.folha = Folha;

  if (typeof module !== 'undefined' && module.exports) module.exports = PL;
})(typeof globalThis !== 'undefined' ? globalThis : this);
