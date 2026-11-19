/* Esferóide — esfera saltitante que oscila na profundidade: seu círculo cresce, encolhe e some. */
(function (root) {
  'use strict';
  const PL = root.PL || (root.PL = {});
  const G3 = PL.G3, M = PL.M, Phys = PL.Phys;

  class Esferoide extends PL.Enemy {
    constructor(G, d) {
      super(G, d);
      this.r = d.r || 10;
      this.hp = this.maxHp = d.hp || 3;
      this.drop = 2;
      this.mat = 'coral';
      this.z0 = this.z;
      this.za = d.za === undefined ? 22 : d.za;
      this.zw = d.zw || 1.7;
      this.body = Phys.body(this.x, this.y, this.z, this.r - 2, this.r - 1);
      this.hopT = 0.5 + Math.random();
      this.dir = Math.random() < 0.5 ? -1 : 1;
      this.prim = G3.sphere(this.x, this.y, this.z, this.r);
      this.chase = false;
      this.kbT = 0;
    }
    zRange() { return [this.z - this.r, this.z + this.r]; }
    sliceAt(z, out) {
      const p = this.prim;
      p.cx = this.x; p.cy = this.y; p.cz = this.z;
      p.zMin = this.z - this.r; p.zMax = this.z + this.r;
      p.r = this.r;
      return G3.sliceInto(p, z, out);
    }
    update(dt, G) {
      const b = this.body, P = G.player;
      this.t += dt;
      this.flashT = Math.max(0, this.flashT - dt);
      this.kbT = Math.max(0, this.kbT - dt);
      this.springSquash(dt);
      const dx = P.x - this.x, dy = P.y - this.y, dz = P.z - this.z;
      this.chase = Math.abs(dx) < 120 && Math.abs(dy) < 70 && Math.abs(dz) < 50 && !P.dead;
      // profundidade: oscila; quando caça, puxa o centro para o plano do Quadrado
      if (this.chase) this.z0 = M.approach(this.z0, P.z, 18 * dt);
      this.z = M.clamp(this.z0 + Math.sin(this.t * this.zw) * this.za, 2, G.room.d - 2);
      b.z = this.z;
      // pulos
      b.vy = Math.min(b.vy + Phys.GRAV * 0.8 * dt, Phys.MAX_FALL);
      if (b.grounded && this.kbT <= 0) {
        b.vx = M.approach(b.vx, 0, 600 * dt);
        this.hopT -= dt;
        if (this.hopT <= 0) {
          if (this.chase) this.dir = Math.sign(dx) || this.dir;
          else if (Math.random() < 0.3) this.dir *= -1;
          b.vy = -170 - Math.random() * 60;
          b.vx = this.dir * (this.chase ? 85 : 45);
          this.hopT = this.chase ? 0.55 + Math.random() * 0.3 : 1 + Math.random() * 1.2;
          this.sqy = 1.3; this.vsq = 0;
        }
      }
      const was = b.grounded;
      Phys.move(b, G.room, dt);
      if (b.wall) this.dir = -b.wall;
      if (b.grounded && !was) { this.sqy = 0.65; this.vsq = 0; }
      if (b.x < this.r || b.x > G.room.w - this.r) { this.dir *= -1; b.x = M.clamp(b.x, this.r, G.room.w - this.r); }
      if (b.y > G.room.h + 40) { this.alive = false; }
      this.x = b.x; this.y = b.y + 1;
    }
    onHurt(G, dirX) {
      this.body.vx = dirX * 180; this.body.vy = -120; this.kbT = 0.25;
      this.sqy = 0.7; this.vsq = 0;
    }
    draw(g, G, t) {
      this.drawGhost(g, G);
      if (!this.visible) return;
      const s = this.s, r = s.r;
      const w = r * 2 * this.sqx, h = r * 2 * this.sqy;
      const cx = Math.round(s.cx), cy = Math.round(s.cy + r - h / 2);
      const mat = PL.MATS.coral;
      g.fillStyle(mat.out, 1);
      g.fillEllipse(cx, cy, w + 2, h + 2);
      g.fillStyle(this.flashT > 0 ? 0xffffff : mat.fill, 1);
      g.fillEllipse(cx, cy, w, h);
      if (this.flashT > 0) return;
      // terminador (sombra) e brilho
      g.fillStyle(mat.dark, 1);
      g.fillEllipse(cx + w * 0.12, cy + h * 0.12, w * 0.78, h * 0.78);
      g.fillStyle(mat.fill, 1);
      g.fillEllipse(cx - w * 0.06, cy - h * 0.06, w * 0.8, h * 0.8);
      g.fillStyle(mat.hi, 1);
      if (r > 3) g.fillRect(Math.round(cx - w * 0.28), Math.round(cy - h * 0.3), Math.max(1, Math.round(r * 0.3)), 1);
      // olhos só aparecem quando o corte passa perto do "rosto" (centro da esfera)
      if (r > this.r * 0.65) this.drawEyes(g, cx, cy, r, this.chase);
    }
  }

  PL.ENEMIES.esferoide = Esferoide;

  if (typeof module !== 'undefined' && module.exports) module.exports = PL;
})(typeof globalThis !== 'undefined' ? globalThis : this);
