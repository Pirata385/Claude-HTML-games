/* Rabisco — um achatado como o Quadrado, mas sem a "dobra": vive num único z e some quando você sai dele.
 * Desenhado com traço fervilhante (linhas que tremem, como animação feita à mão). */
(function (root) {
  'use strict';
  const PL = root.PL || (root.PL = {});
  const G3 = PL.G3, M = PL.M, Phys = PL.Phys;

  class Rabisco extends PL.Enemy {
    constructor(G, d) {
      super(G, d);
      this.hp = this.maxHp = d.hp || 2;
      this.drop = 1;
      this.mat = 'pedraEsc';
      this.body = Phys.body(this.x, this.y, this.z, 6, 5);
      this.dir = Math.random() < 0.5 ? -1 : 1;
      this.wanderT = 1;
      this.kbT = 0;
      this.flat = true;
    }
    zRange() { return [this.z, this.z]; }
    sliceAt(z, out) {
      if (Math.abs(z - this.z) > 1.6) return false;
      G3.setRect(out, this.x - 6, this.y - 5, this.x + 6, this.y + 5);
      return true;
    }
    updateSlice(pz, eco) {
      super.updateSlice(pz, eco);
      if (!this.visible && this.alive && Math.abs(pz - this.z) <= (eco ? 48 : 10)) {
        G3.setRect(this.ghost, this.x - 6, this.y - 5, this.x + 6, this.y + 5);
        this.ghostDir = this.z > pz ? 1 : -1;
      }
    }
    update(dt, G) {
      const b = this.body, P = G.player;
      this.t += dt;
      this.flashT = Math.max(0, this.flashT - dt);
      this.kbT = Math.max(0, this.kbT - dt);
      b.vy = Math.min(b.vy + Phys.GRAV * dt, Phys.MAX_FALL);
      const sees = !P.dead && Math.abs(P.z - this.z) < 1.6 && Math.abs(P.x - this.x) < 130 && Math.abs(P.y - this.y) < 50;
      if (this.kbT <= 0) {
        if (sees) {
          this.dir = Math.sign(P.x - this.x) || this.dir;
          b.vx = M.approach(b.vx, this.dir * 78, 500 * dt);
          if (b.grounded && Math.abs(P.x - this.x) < 46 && Math.random() < 3 * dt) { b.vy = -230; b.vx = this.dir * 110; }
        } else {
          this.wanderT -= dt;
          if (this.wanderT <= 0) { this.dir = Math.random() < 0.5 ? -1 : 1; this.wanderT = 1 + Math.random() * 2; }
          b.vx = M.approach(b.vx, this.dir * 30, 300 * dt);
        }
      }
      Phys.move(b, G.room, dt);
      if (b.wall) this.dir = -b.wall;
      b.x = M.clamp(b.x, 8, G.room.w - 8);
      if (b.y > G.room.h + 40) this.alive = false;
      this.x = b.x; this.y = b.y;
    }
    onHurt(G, dirX) { this.body.vx = dirX * 170; this.body.vy = -110; this.kbT = 0.25; }
    scribble(g, color, alpha, cx, cy, seed) {
      const rnd = M.rng(seed);
      g.lineStyle(1, color, alpha);
      g.beginPath();
      const n = 8;
      for (let i = 0; i <= n + 2; i++) {
        const a = (i / n) * Math.PI * 2 + rnd() * 0.5;
        const r = 4.5 + rnd() * 2.5;
        const x = cx + Math.cos(a) * r * 1.15, y = cy + Math.sin(a) * r * 0.85;
        if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
      }
      g.strokePath();
    }
    draw(g, G, t) {
      const fr = Math.floor(t * 12);
      if (!this.visible) {
        if (this.ghostDir) {
          const R = PL.REGIONS[G.room.def.region] || PL.REGIONS.borda;
          this.scribble(g, this.ghostDir > 0 ? R.ghostFront : R.ghostBack, 0.4, this.x, this.y, fr * 31 + 7);
        }
        return;
      }
      const ink = this.flashT > 0 ? 0xffffff : 0x1a1426;
      this.scribble(g, ink, 1, this.x, this.y, fr * 17 + 1);
      this.scribble(g, this.flashT > 0 ? 0xffffff : 0xe0475b, 0.8, this.x + 0.5, this.y, fr * 23 + 5);
      // perninhas em zigue-zague
      const ph = Math.sin(this.t * 18) * (Math.abs(this.body.vx) > 5 ? 2 : 0);
      g.lineStyle(1, ink, 1);
      g.lineBetween(this.x - 2, this.y + 4, this.x - 3 + ph, this.y + 5);
      g.lineBetween(this.x + 2, this.y + 4, this.x + 3 - ph, this.y + 5);
      g.fillStyle(0xffffff, 1);
      g.fillRect(Math.round(this.x + this.dir * 1 - 2), Math.round(this.y - 2), 2, 2);
      g.fillRect(Math.round(this.x + this.dir * 1 + 1), Math.round(this.y - 2), 2, 2);
      g.fillStyle(0x1a1426, 1);
      g.fillRect(Math.round(this.x + this.dir * 2 - 2), Math.round(this.y - 1), 1, 1);
      g.fillRect(Math.round(this.x + this.dir * 2 + 1), Math.round(this.y - 1), 1, 1);
    }
  }

  PL.ENEMIES.rabisco = Rabisco;

  if (typeof module !== 'undefined' && module.exports) module.exports = PL;
})(typeof globalThis !== 'undefined' ? globalThis : this);
