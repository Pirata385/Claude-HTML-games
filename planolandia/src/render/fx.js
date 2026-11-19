/* Planolândia — partículas 3D baratas: cada partícula tem z e encolhe/some ao sair do plano do jogador. */
(function (root) {
  'use strict';
  const PL = root.PL || (root.PL = {});

  const MAX = 420;

  class FX {
    constructor(scene) {
      this.g = scene.add.graphics().setDepth(40);
      this.back = scene.add.graphics().setDepth(19);
      this.pool = [];
      for (let i = 0; i < MAX; i++) this.pool.push({ on: false });
      this.rings = [];
      this.texts = [];
      this.scale = 1;
    }
    destroy() { this.g.destroy(); this.back.destroy(); }
    clear() { for (const p of this.pool) p.on = false; this.rings.length = 0; }

    spawn(o) {
      if (this.scale < 1 && Math.random() > this.scale) return null;
      for (let i = 0; i < MAX; i++) {
        const p = this.pool[i];
        if (p.on) continue;
        p.on = true;
        p.x = o.x; p.y = o.y; p.z = o.z || 0;
        p.vx = o.vx || 0; p.vy = o.vy || 0; p.vz = o.vz || 0;
        p.life = p.max = o.life || 0.5;
        p.size = o.size || 2; p.color = o.color === undefined ? 0xffffff : o.color;
        p.grav = o.grav === undefined ? 300 : o.grav;
        p.drag = o.drag === undefined ? 1.5 : o.drag;
        p.kind = o.kind || 'sq';
        p.back = !!o.back;
        p.ang = o.ang || 0; p.spin = o.spin || 0;
        return p;
      }
      return null;
    }

    burst(x, y, z, n, o) {
      for (let i = 0; i < n; i++) {
        const a = (o.ang0 !== undefined ? o.ang0 : 0) + (o.spread !== undefined ? (Math.random() - 0.5) * o.spread : Math.random() * Math.PI * 2);
        const sp = (o.speed || 120) * (0.4 + Math.random() * 0.8);
        this.spawn({
          x, y, z: z + (Math.random() - 0.5) * (o.zSpread || 0),
          vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, vz: (Math.random() - 0.5) * (o.vz || 0),
          life: (o.life || 0.5) * (0.6 + Math.random() * 0.6), size: o.size || 2,
          color: Array.isArray(o.color) ? o.color[(Math.random() * o.color.length) | 0] : o.color,
          grav: o.grav, drag: o.drag, kind: o.kind, spin: (Math.random() - 0.5) * 20, ang: Math.random() * 6,
        });
      }
    }

    ring(x, y, z, r0, r1, life, color, width) {
      this.rings.push({ x, y, z, r0, r1, t: 0, life, color: color === undefined ? 0xffffff : color, w: width || 1 });
    }

    update(dt) {
      for (let i = 0; i < MAX; i++) {
        const p = this.pool[i];
        if (!p.on) continue;
        p.life -= dt;
        if (p.life <= 0) { p.on = false; continue; }
        p.vy += p.grav * dt;
        const k = Math.exp(-p.drag * dt);
        p.vx *= k; p.vy *= k; p.vz *= k;
        p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
        p.ang += p.spin * dt;
      }
      for (let i = this.rings.length - 1; i >= 0; i--) {
        const r = this.rings[i];
        r.t += dt;
        if (r.t >= r.life) this.rings.splice(i, 1);
      }
    }

    draw(pz) {
      const g = this.g, b = this.back;
      g.clear(); b.clear();
      for (let i = 0; i < MAX; i++) {
        const p = this.pool[i];
        if (!p.on) continue;
        const dz = Math.abs(p.z - pz);
        if (dz > 24) continue;
        const fade = 1 - dz / 24;
        const lifeK = p.life / p.max;
        const s = Math.max(1, Math.round(p.size * fade * (0.5 + 0.5 * lifeK)));
        const t = p.back ? b : g;
        t.fillStyle(p.color, Math.min(1, 0.35 + fade));
        if (p.kind === 'shard') {
          const c = Math.cos(p.ang) * s * 1.5, sn = Math.sin(p.ang) * s * 1.5;
          t.lineStyle(1, p.color, Math.min(1, 0.35 + fade));
          t.lineBetween(p.x - c, p.y - sn, p.x + c, p.y + sn);
        } else if (p.kind === 'streak') {
          t.fillRect(Math.round(p.x), Math.round(p.y), s + 2, 1);
        } else {
          t.fillRect(Math.round(p.x - s / 2), Math.round(p.y - s / 2), s, s);
        }
      }
      for (const r of this.rings) {
        const dz = Math.abs(r.z - pz);
        if (dz > 30) continue;
        const k = r.t / r.life;
        const rad = r.r0 + (r.r1 - r.r0) * PL.M.easeOut(k);
        g.lineStyle(r.w, r.color, (1 - k) * (1 - dz / 30));
        g.strokeCircle(Math.round(r.x), Math.round(r.y), rad);
      }
    }
  }

  PL.FX = FX;

  if (typeof module !== 'undefined' && module.exports) module.exports = PL;
})(typeof globalThis !== 'undefined' ? globalThis : this);
