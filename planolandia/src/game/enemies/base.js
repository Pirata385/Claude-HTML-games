/* Planolândia — base dos inimigos. Cada inimigo é um objeto 3D (ou achatado num único z);
 * só pode ferir ou ser ferido quando o seu corte existe no plano do Quadrado. */
(function (root) {
  'use strict';
  const PL = root.PL || (root.PL = {});
  const G3 = PL.G3;
  PL.ENEMIES = PL.ENEMIES || {};

  class Enemy {
    constructor(G, d) {
      this.G = G;
      this.def = d;
      this.x = d.x; this.y = d.y; this.z = d.z === undefined ? G.room.d / 2 : d.z;
      this.hp = this.maxHp = d.hp || 3;
      this.alive = true;
      this.flashT = 0;
      this.s = G3.newShape();
      this.visible = false;
      this.contact = 1;
      this.drop = 2;
      this.geo = true;
      this.t = Math.random() * 10;
      this.sqx = 1; this.sqy = 1; this.vsq = 0;
      this.ghost = G3.newShape();
      this.ghostDir = 0;
      this.mat = 'coral';
    }
    // corte do inimigo no plano z → preenche out; true se existir
    sliceAt(z, out) { return false; }
    zRange() { return [this.z - 10, this.z + 10]; }

    updateSlice(pz, eco) {
      this.visible = this.alive && this.sliceAt(pz, this.s);
      this.ghostDir = 0;
      if (!this.visible && this.alive) {
        const [z0, z1] = this.zRange();
        const range = eco ? 48 : 10;
        if (z0 > pz && z0 - pz <= range && this.sliceAt(z0 + 0.5, this.ghost)) this.ghostDir = 1;
        else if (z1 < pz && pz - z1 <= range && this.sliceAt(z1 - 0.5, this.ghost)) this.ghostDir = -1;
      }
    }

    // golpe recebido; devolve true se contou como acerto
    hit(G, dmg, dirX, dirY, info) {
      if (!this.alive || this.invuln) return false;
      this.hp -= dmg;
      this.flashT = 0.1;
      this.onHurt(G, dirX, dirY, info);
      if (this.hp <= 0) this.die(G);
      return true;
    }
    onHurt(G, dirX, dirY) {}

    die(G) {
      this.alive = false;
      this.visible = false;
      const c = this.s;
      const cx = c.cx, cy = c.cy;
      const mat = PL.MATS[this.mat] || PL.MATS.coral;
      G.fx.burst(cx, cy, G.player.z, 14, { speed: 170, color: [mat.fill, mat.top, mat.out], life: 0.6, grav: 400, kind: 'shard', vz: 40 });
      G.fx.ring(cx, cy, G.player.z, 3, 26, 0.35, 0xffffff, 2);
      G.sfx('kill');
      G.shake(2, 0.12);
      if (this.drop > 0) G.dropVerts(cx, cy, this.drop);
      this.onDie(G);
    }
    onDie(G) {}

    update(dt, G) {}

    drawGhost(g, G) {
      if (!this.ghostDir) return;
      const R = PL.REGIONS[G.room.def.region] || PL.REGIONS.borda;
      PL.Slices.dotted(g, this.ghost, this.ghostDir > 0 ? R.ghostFront : R.ghostBack, 0.5, 2);
    }

    // olhos genéricos (dois pontinhos brancos com pupila) olhando para o Quadrado
    drawEyes(g, cx, cy, size, angry) {
      const p = this.G.player;
      const dx = Math.sign(p.x - cx) || 1, dy = Math.sign(p.y - cy);
      const sp = Math.max(2, Math.round(size * 0.3));
      for (const s of [-1, 1]) {
        const ex = Math.round(cx + s * sp), ey = Math.round(cy - 1);
        g.fillStyle(0xffffff, 1); g.fillRect(ex - 1, ey - 1, 3, 3);
        g.fillStyle(angry ? 0xe0475b : 0x1a1426, 1); g.fillRect(ex + dx, ey + (dy > 0 ? 1 : 0), 1, 1);
        if (angry) { g.fillStyle(0x1a1426, 1); g.fillRect(ex - 1 + (s > 0 ? 0 : 1), ey - 2, 2, 1); }
      }
    }

    springSquash(dt) {
      this.vsq += (-(this.sqy - 1) * 260 - this.vsq * 12) * dt;
      this.sqy += this.vsq * dt;
      this.sqx = 1 / Math.max(0.4, this.sqy);
    }

    draw(g, G, t) {}
  }

  PL.Enemy = Enemy;

  if (typeof module !== 'undefined' && module.exports) module.exports = PL;
})(typeof globalThis !== 'undefined' ? globalThis : this);
