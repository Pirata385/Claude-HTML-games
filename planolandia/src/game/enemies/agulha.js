/* Agulha — cone que atravessa o plano ao longo de z: no corte, um ponto que vira disco e some.
 * Avisa com um anel pulsante; fere ao toque e serve de apoio para o pogo. Não pode ser destruída. */
(function (root) {
  'use strict';
  const PL = root.PL || (root.PL = {});
  const G3 = PL.G3, M = PL.M;

  class Agulha extends PL.Enemy {
    constructor(G, d) {
      super(G, d);
      this.invuln = true;
      this.hp = Infinity;
      this.drop = 0;
      this.geo = false;
      this.pogo = true;
      this.mat = 'espinho';
      this.r = d.r || 8;
      this.len = d.len || 64;
      this.dirZ = d.dir || 1;
      this.period = d.period || 2.6;
      this.phase = d.phase || 0;
      this.zc = this.z;
      this.prim = G3.cone('z', this.x, this.y, 0, this.r, this.len, this.dirZ);
      this.cz = 0;
      this.warn = 0;
      this.setBase(this.zc - this.dirZ * (this.len + 50));
    }
    setBase(cz) {
      this.cz = cz;
      const p = this.prim;
      p.cz = cz; p.cx = this.x; p.cy = this.y;
      p.zMin = Math.min(cz, cz + this.dirZ * this.len); p.zMax = Math.max(cz, cz + this.dirZ * this.len);
    }
    zRange() { return [this.prim.zMin, this.prim.zMax]; }
    sliceAt(z, out) { return G3.sliceInto(this.prim, z, out); }
    update(dt, G) {
      this.t += dt;
      const ph = ((this.t + this.phase) % this.period) / this.period;
      // 0–0.55 recolhida · 0.55–0.75 aviso · 0.75–0.8 estocada · 0.8–0.9 parada · 0.9–1 recolhe
      const out = this.zc - this.dirZ * (this.len + 50), inn = this.zc - this.dirZ * this.len * 0.25;
      let cz = out;
      this.warn = 0;
      if (ph < 0.55) cz = out;
      else if (ph < 0.75) { cz = out; this.warn = (ph - 0.55) / 0.2; }
      else if (ph < 0.8) { cz = M.lerp(out, inn, M.easeOut((ph - 0.75) / 0.05)); if (!this.sfxDone) { this.sfxDone = true; if (Math.abs(G.player.z - this.zc) < 40 && Math.abs(G.player.x - this.x) < 200) G.sfx('stab'); } }
      else if (ph < 0.9) cz = inn;
      else { cz = M.lerp(inn, out, (ph - 0.9) / 0.1); this.sfxDone = false; }
      this.setBase(cz);
    }
    draw(g, G, t) {
      const P = G.player;
      // aviso: anel pulsante onde a ponta vai atravessar (só perto da faixa de profundidade)
      if (this.warn > 0 && Math.abs(P.z - this.zc) < this.len * 0.8 + 12) {
        const a = 0.35 + 0.65 * Math.abs(Math.sin(this.warn * Math.PI * 4));
        g.lineStyle(1, 0xe0475b, a);
        g.strokeCircle(Math.round(this.x), Math.round(this.y), 2 + this.warn * (this.r - 2));
        g.fillStyle(0xe0475b, a);
        g.fillRect(Math.round(this.x), Math.round(this.y), 1, 1);
      }
      this.drawGhost(g, G);
      if (!this.visible) return;
      const s = this.s;
      const cx = Math.round(s.cx), cy = Math.round(s.cy), r = s.r;
      g.fillStyle(0x2a2140, 1); g.fillCircle(cx, cy, r + 1);
      g.fillStyle(0xd8dbe8, 1); g.fillCircle(cx, cy, r);
      g.fillStyle(0x9aa0b8, 1); g.fillCircle(cx + 1, cy + 1, r * 0.6);
      g.fillStyle(0xffffff, 1); g.fillRect(cx - Math.round(r * 0.4), cy - Math.round(r * 0.5), 1, 1);
      g.fillStyle(0xe0475b, 1); if (r < 3) g.fillRect(cx, cy, 1, 1);
    }
  }

  PL.ENEMIES.agulha = Agulha;

  if (typeof module !== 'undefined' && module.exports) module.exports = PL;
})(typeof globalThis !== 'undefined' ? globalThis : this);
