/* Esporo — projétil 3D (esferinha r=3). Só fere no seu plano: um passo na profundidade e ele passa por você.
 * Pode ser destruído com um golpe. Some ao tocar um sólido ou depois de alguns segundos. */
(function (root) {
  'use strict';
  const PL = root.PL || (root.PL = {});
  const G3 = PL.G3, Phys = PL.Phys;

  class Esporo extends PL.Enemy {
    constructor(G, d) {
      super(G, d);
      this.r = d.r || 3;
      this.vx = d.vx || 0; this.vy = d.vy || 0; this.vz = d.vz || 0;
      this.hp = 1; this.drop = 0; this.geo = false;
      this.life = d.life || 3;
      this.grav = d.grav === undefined ? 220 : d.grav;
      this.color = d.color || 0xc9f08a;
      this.mat = 'copa';
      this.prim = G3.sphere(this.x, this.y, this.z, this.r);
      this.probe = { hx: 1.5, hy: 1.5 };
    }
    zRange() { return [this.z - this.r, this.z + this.r]; }
    sliceAt(z, out) {
      const p = this.prim;
      p.cx = this.x; p.cy = this.y; p.cz = this.z; p.zMin = this.z - this.r; p.zMax = this.z + this.r;
      return G3.sliceInto(p, z, out);
    }
    update(dt, G) {
      this.t += dt;
      this.life -= dt;
      this.vy += this.grav * dt;
      this.x += this.vx * dt; this.y += this.vy * dt; this.z += this.vz * dt;
      if (this.life <= 0 || Phys.overlapAt(this.probe, G.room, this.x, this.y, this.z) || this.y > G.room.h + 20) this.pop(G, false);
    }
    pop(G, silent) {
      this.alive = false;
      this.visible = false;
      if (Math.abs(G.player.z - this.z) < 20) G.fx.burst(this.x, this.y, this.z, 4, { speed: 50, color: [this.color, 0xffffff], life: 0.25, grav: 60, size: 1 });
    }
    die(G) { this.pop(G); G.sfx('clink'); }
    draw(g, G, t) {
      this.drawGhost(g, G);
      if (!this.visible) return;
      const s = this.s;
      g.fillStyle(0x10261a, 1); g.fillCircle(Math.round(s.cx), Math.round(s.cy), s.r + 1);
      g.fillStyle(this.color, 1); g.fillCircle(Math.round(s.cx), Math.round(s.cy), s.r);
      g.fillStyle(0xffffff, 1); g.fillRect(Math.round(s.cx - 1), Math.round(s.cy - 1), 1, 1);
    }
  }

  PL.ENEMIES.esporo = Esporo;

  if (typeof module !== 'undefined' && module.exports) module.exports = PL;
})(typeof globalThis !== 'undefined' ? globalThis : this);
