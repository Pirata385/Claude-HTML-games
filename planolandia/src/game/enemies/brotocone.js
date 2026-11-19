/* Brotocone — um cone em pé que anda aos pulinhos. O corte é um triângulo que afina fora do eixo.
 * De tempos em tempos "planta", treme e cospe três esporos em arco. */
(function (root) {
  'use strict';
  const PL = root.PL || (root.PL = {});
  const G3 = PL.G3, M = PL.M, Phys = PL.Phys;

  class Brotocone extends PL.Enemy {
    constructor(G, d) {
      super(G, d);
      this.r = d.r || 12; this.h = d.h || 26;
      this.hp = this.maxHp = d.hp || 3;
      this.drop = 3;
      this.mat = 'copa';
      this.body = Phys.body(this.x, this.y, this.z, this.r * 0.6, this.h / 2);
      this.prim = G3.cone('y', this.x, this.y, this.z, this.r, this.h, -1);
      this.state = 'walk'; this.stT = Math.random();
      this.dir = Math.random() < 0.5 ? -1 : 1;
      this.shootT = 1.5 + Math.random();
      this.kbT = 0;
    }
    zRange() { return [this.z - this.r, this.z + this.r]; }
    sync() {
      const p = this.prim, base = this.y + this.h / 2;
      const sq = this.state === 'plant' ? 1 - Math.min(0.25, this.stT * 0.5) : 1;
      p.cx = this.x + (this.state === 'plant' ? (Math.random() - 0.5) * 1.5 : 0); p.cy = base; p.cz = this.z; p.h = this.h * sq * this.sqy;
      p.xMin = this.x - this.r; p.xMax = this.x + this.r; p.zMin = this.z - this.r; p.zMax = this.z + this.r; p.yMin = base - p.h; p.yMax = base;
    }
    sliceAt(z, out) { return G3.sliceInto(this.prim, z, out); }
    update(dt, G) {
      const b = this.body, P = G.player;
      this.t += dt; this.stT += dt;
      this.flashT = Math.max(0, this.flashT - dt);
      this.kbT = Math.max(0, this.kbT - dt);
      this.springSquash(dt);
      b.vy = Math.min(b.vy + Phys.GRAV * dt, Phys.MAX_FALL);
      const dx = P.x - this.x, near = Math.abs(dx) < 170 && Math.abs(P.y - this.y) < 90 && !P.dead;
      if (this.state === 'walk') {
        if (b.grounded && this.kbT <= 0) {
          b.vx = M.approach(b.vx, 0, 500 * dt);
          if (this.stT > 0.9) {
            this.stT = 0;
            if (near && Math.abs(P.z - this.z) < 60) this.dir = Math.sign(dx) || this.dir;
            else if (Math.random() < 0.35) this.dir *= -1;
            b.vy = -150; b.vx = this.dir * 50;
            this.sqy = 1.25; this.vsq = 0;
          }
        }
        this.shootT -= dt;
        if (near && this.shootT <= 0 && b.grounded) { this.state = 'plant'; this.stT = 0; G.sfx('alert'); }
      } else if (this.state === 'plant') {
        b.vx = 0;
        if (this.stT > 0.55) {
          // cospe esporos em leque, mirando o Quadrado
          const dir = Math.sign(dx) || this.dir;
          for (let i = 0; i < 3; i++) {
            const sp = 95 + i * 30;
            G.spawnEnemy('esporo', { x: this.x, y: this.y - this.h / 2, z: this.z, vx: dir * sp * (0.6 + i * 0.25), vy: -190 + i * 30, vz: (P.z - this.z) * 0.3 });
          }
          G.sfx('spore');
          this.sqy = 1.4; this.vsq = 0;
          this.state = 'walk'; this.stT = 0; this.shootT = 2.2 + Math.random() * 0.8;
        }
      }
      const was = b.grounded;
      Phys.move(b, G.room, dt);
      if (b.wall) this.dir = -b.wall;
      if (b.grounded && !was) { this.sqy = 0.7; this.vsq = 0; }
      b.x = M.clamp(b.x, this.r, G.room.w - this.r);
      if (b.y > G.room.h + 40) this.alive = false;
      this.x = b.x; this.y = b.y;
      this.sync();
    }
    onHurt(G, dirX) { this.body.vx = dirX * 150; this.body.vy = -100; this.kbT = 0.25; if (this.state === 'plant') { this.state = 'walk'; this.shootT = 1.2; } }
    draw(g, G, t) {
      this.drawGhost(g, G);
      if (!this.visible) return;
      const s = this.s;
      PL.Slices.drawSolid(g, { mat: 'copa', seed: 5 }, s, G.player.z, { speck: false, deco: false, lip: true, flash: this.flashT > 0 });
      if (this.flashT > 0) return;
      // tronquinho e olhos
      const w = s.maxX - s.minX;
      g.fillStyle(0x5a3826, 1); g.fillRect(Math.round(s.cx - 2), Math.round(s.maxY - 1), 4, 2);
      if (w > 9) this.drawEyes(g, s.cx, s.maxY - (s.maxY - s.minY) * 0.35, Math.min(w, 16), this.state === 'plant');
      if (this.state === 'plant') { g.fillStyle(0xc9f08a, 0.5 + 0.5 * Math.sin(t * 30)); g.fillRect(Math.round(s.cx - 1), Math.round(s.minY - 2), 2, 2); }
    }
  }

  PL.ENEMIES.brotocone = Brotocone;

  if (typeof module !== 'undefined' && module.exports) module.exports = PL;
})(typeof globalThis !== 'undefined' ? globalThis : this);
