/* Cubo Sentinela — patrulha e gira ao virar (o corte muda de largura); avista o Quadrado e investe.
 * Como é 3D, dá para escapar da investida saindo do seu volume na profundidade. */
(function (root) {
  'use strict';
  const PL = root.PL || (root.PL = {});
  const G3 = PL.G3, M = PL.M, Phys = PL.Phys;

  class CuboSentinela extends PL.Enemy {
    constructor(G, d) {
      super(G, d);
      this.size = d.size || 18;
      this.hp = this.maxHp = d.hp || 5;
      this.drop = 3;
      this.mat = 'lilas';
      const h = this.size / 2;
      this.body = Phys.body(this.x, this.y, this.z, h, h);
      this.dir = d.dir || 1;
      this.yaw = 0; this.yawTarget = 0;
      this.state = 'patrol';
      this.stT = 0;
      this.x0 = d.x0 === undefined ? this.x - 80 : d.x0;
      this.x1 = d.x1 === undefined ? this.x + 80 : d.x1;
      this.base = G3.cuboidVerts(this.size, this.size, this.size);
      this.prim = G3.cuboid(this.x, this.y, this.z, this.size, this.size, this.size);
      this.shake = 0;
      this.kbT = 0;
    }
    zRange() { return [this.prim.zMin, this.prim.zMax]; }
    syncPrim() {
      G3.setHull(this.prim, this.base, G3.rotMatrix(this.yaw, 0, 0), this.x + (this.shake ? (Math.random() - 0.5) * 2 : 0), this.y, this.z);
    }
    sliceAt(z, out) {
      return G3.sliceInto(this.prim, z, out);
    }
    sees(P) {
      const h = this.size * 0.75;
      return !P.dead && Math.abs(P.z - this.z) < h && Math.abs(P.y - this.y) < 34 && Math.abs(P.x - this.x) < 140 && Math.sign(P.x - this.x) === this.dir;
    }
    update(dt, G) {
      const b = this.body, P = G.player;
      this.t += dt; this.stT += dt;
      this.flashT = Math.max(0, this.flashT - dt);
      this.kbT = Math.max(0, this.kbT - dt);
      b.vy = Math.min(b.vy + Phys.GRAV * dt, Phys.MAX_FALL);
      this.shake = 0;
      switch (this.state) {
        case 'patrol':
          b.vx = this.kbT > 0 ? b.vx : this.dir * 32;
          if ((this.dir > 0 && b.x >= this.x1) || (this.dir < 0 && b.x <= this.x0) || b.wall === this.dir || this.edgeAhead(G)) this.turn();
          if (this.sees(P)) { this.state = 'warn'; this.stT = 0; G.sfx('alert'); }
          break;
        case 'turn':
          b.vx = 0;
          if (this.stT > 0.5) { this.state = 'patrol'; this.stT = 0; }
          break;
        case 'warn':
          b.vx = 0; this.shake = 1;
          if (this.stT > 0.45) { this.state = 'charge'; this.stT = 0; }
          break;
        case 'charge':
          b.vx = this.dir * 175;
          if (this.stT > 0.9 || b.wall === this.dir || this.edgeAhead(G)) { this.state = 'stun'; this.stT = 0; if (b.wall) { G.shake(2, 0.1); G.sfx('thud'); } }
          if (Math.random() < 0.5) G.fx.spawn({ x: b.x - this.dir * 8, y: b.y + this.size / 2, z: this.z, vx: -this.dir * 40, vy: -20, life: 0.3, color: 0xc7b693, grav: 80 });
          break;
        case 'stun':
          b.vx = M.approach(b.vx, 0, 900 * dt);
          if (this.stT > 0.7) { this.state = 'patrol'; this.stT = 0; if (this.sees(P) === false) this.turn(); }
          break;
      }
      this.yaw = M.damp(this.yaw, this.yawTarget, 9, dt);
      Phys.move(b, G.room, dt);
      b.x = M.clamp(b.x, this.size, G.room.w - this.size);
      this.x = b.x; this.y = b.y;
      this.syncPrim();
    }
    turn() {
      this.dir *= -1;
      this.yawTarget += Math.PI / 2;
      this.state = 'turn'; this.stT = 0;
    }
    edgeAhead(G) {
      // sem chão logo à frente → vira (não cai de plataformas)
      const b = this.body;
      const probe = { x: b.x + this.dir * (this.size / 2 + 3), y: b.y + 6, z: b.z, hx: 2, hy: b.hy };
      return !Phys.overlapAt(probe, G.room, probe.x, probe.y + 4, b.z);
    }
    onHurt(G, dirX) {
      if (this.state !== 'charge') { this.body.vx = dirX * 140; this.kbT = 0.15; }
      if (this.state === 'patrol' && Math.sign(G.player.x - this.x) !== this.dir) this.turn();
    }
    draw(g, G, t) {
      this.drawGhost(g, G);
      if (!this.visible) return;
      const s = this.s;
      PL.Slices.drawSolid(g, { mat: 'lilas', seed: 3 }, s, G.player.z, { speck: false, deco: false, lip: true, flash: this.flashT > 0 });
      if (this.flashT > 0) return;
      const w = s.maxX - s.minX;
      if (w > 8) this.drawEyes(g, s.cx + this.dir * Math.min(3, w * 0.15), s.cy - 1, Math.min(w, this.size), this.state === 'warn' || this.state === 'charge');
    }
  }

  PL.ENEMIES.cuboSentinela = CuboSentinela;

  if (typeof module !== 'undefined' && module.exports) module.exports = PL;
})(typeof globalThis !== 'undefined' ? globalThis : this);
