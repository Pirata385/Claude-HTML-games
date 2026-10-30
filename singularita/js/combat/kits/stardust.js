// Stardust: manifest the Astral and fight beside it. Spirit drains while it is out.
import { BaseKit, dirOf } from './base.js';
import { moveCircle } from '../../world/physics.js';
import { F } from '../../world/grid.js';

export class StardustKit extends BaseKit {
  constructor(g) { super(g, 'stardust'); this.moteCd = 0; }
  get astral() { return this.g.astral; }

  regen(dt) {
    const p = this.p, a = this.astral, r = this.def.resource;
    if (a?.manifested) {
      p.res -= r.drain * dt * (1 - Math.min(0.5, (this.stats.attrs.rsv || 0) * 0.004));
      if (p.res <= 0) { p.res = 0; a.manifest(false); this.warn('Your Spirit is spent; the Astral fades.'); }
    } else if (!(a?.lockT > 0)) p.res = Math.min(this.stats.resourceMax, p.res + this.stats.resourceRegen * dt);
  }

  ensureManifest() {
    const a = this.astral;
    if (a.manifested) return true;
    if (a.lockT > 0) { this.warn('Your Astral is still reforming.'); return false; }
    a.manifest(true);
    return a.manifested;
  }

  updateClass(dt, input) {
    this.moteCd -= dt;
    const a = this.astral;
    if (input.wasPressed('alt')) {
      if (a.manifested) a.manifest(false);
      else if (a.lockT > 0) this.warn(`Your Astral reforms in ${Math.ceil(a.lockT)} s.`);
      else if (this.p.res < 10) this.warn('Not enough Spirit to manifest.');
      else a.manifest(true);
    }
    if (input.isDown('attack')) {
      if (a.manifested) {
        const t = this.aimTarget(a.leash + 4);
        if (t) { a.command(t); this.face(Math.atan2(t.x - this.p.x, t.z - this.p.z), 0.2); this.play('cast', 0.2); }
      } else if (this.moteCd <= 0) this.mote();
    }
  }

  mote() {
    const s = this.basic;
    const t = this.aimTarget(22), yaw = this.aimYaw(22), d = dirOf(yaw);
    this.face(yaw); this.play('cast', 0.2);
    const sy = this.p.ry + 1.4;
    this.combat.shoot({ x: this.p.x + d.x * 0.5, y: sy, z: this.p.z + d.z * 0.5, dx: d.x, dy: t ? (t.ry + 1 - sy) / Math.max(2, Math.sqrt(t.dist2(this.p))) : 0, dz: d.z, speed: s.speed, team: 'player', kind: 'mote', life: 1.2, homing: t, turn: 3,
      onHit: (e) => this.combat.hit(e, { mult: s.dmg, ranged: true }) });
    this.moteCd = 0.4 / this.stats.attackSpeed;
    this.g.bus.emit('sfx', { id: 'mote' });
  }

  s_sd_comet(s) {
    if (!this.ensureManifest()) return false;
    const a = this.astral;
    const yaw = this.aimYaw(s.range + 3), d = dirOf(yaw);
    a.x = this.p.x + d.x; a.z = this.p.z + d.z;
    a.dive = { dx: d.x, dz: d.z, left: s.range, mult: s.dmg, hit: new Set() };
    this.face(yaw); this.play('cast', 0.25);
    this.g.bus.emit('sfx', { id: 'comet' });
  }

  s_sd_orbit(s) {
    if (!this.ensureManifest()) return false;
    this.astral.orbitT = s.duration;
    this.astral.post = null;
    this.g.overlay.text(this.p.x, this.p.ry + 2.4, this.p.z, 'Orbit Guard', 'status');
  }

  s_sd_gravity(s) {
    const pt = this.aimPoint(s.range);
    const y = this.g.grid.height(Math.floor(pt.x), Math.floor(pt.z));
    this.play('cast', 0.3);
    this.g.bus.emit('sfx', { id: 'gravity' });
    this.combat.zone({ x: pt.x, z: pt.z, y, r: s.radius, t: s.duration, interval: 0.1, team: 'player', color: '#8a5aff',
      onTick: (ts, z) => {
        this.fx.burst(z.x + (Math.random() - 0.5) * s.radius * 1.6, y + 0.5, z.z + (Math.random() - 0.5) * s.radius * 1.6, 1, { color: '#b07bff', speed: 0.5, up: 0.5, gravity: 0, life: 0.5 });
        z.n = (z.n || 0) + 1;
        for (const t of ts) {
          if (!t.boss) { const dx = z.x - t.x, dz = z.z - t.z, l = Math.hypot(dx, dz); if (l > 0.6) moveCircle(this.g.grid, t, (dx / l) * Math.min(l, 0.5), (dz / l) * Math.min(l, 0.5), t.radius * 0.8, 1.05, t.flying, F.BASE); }
          if (z.n % 5 === 0) this.combat.hit(t, { mult: s.dmg, src: 'astral', status: [{ id: 'slow', dur: 1 }], noTraits: true, from: z });
        }
      } });
  }

  s_sd_sentinel(s) {
    if (!this.ensureManifest()) return false;
    const pt = this.aimPoint(s.range);
    const a = this.astral;
    a.post = { x: pt.x, z: pt.z, ry: this.g.grid.height(Math.floor(pt.x), Math.floor(pt.z)) };
    a.postT = s.duration; a.orbitT = 0; a.target = null;
    this.fx.decal({ shape: 'ring', x: pt.x, z: pt.z, y: a.post.ry, r: 8, t: s.duration, fill: false, color: '#c48cff', alpha: 0.35 });
    this.g.overlay.text(pt.x, a.post.ry + 2, pt.z, 'Sentinel', 'status');
  }

  s_sd_starfall(s) {
    const pt = this.aimPoint(s.range);
    const y0 = this.g.grid.height(Math.floor(pt.x), Math.floor(pt.z));
    this.play('cast', 0.4);
    for (let k = 0; k < s.count; k++) {
      const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * s.radius;
      const x = pt.x + Math.cos(a) * r, z = pt.z + Math.sin(a) * r;
      const y = this.g.grid.height(Math.floor(x), Math.floor(z));
      this.combat.after(k * 0.25, () => this.fx.telegraph({ shape: 'circle', x, z, y, r: 1.7, t: 0.45, color: '#c48cff' }));
      this.combat.after(k * 0.25 + 0.45, () => {
        this.fx.burst(x, y + 0.4, z, 16, { color: '#f0e0ff', speed: 5, up: 4 });
        this.g.bus.emit('sfx', { id: 'star' });
        for (const t of this.combat.circle(x, z, 1.7, 'player')) this.combat.hit(t, { mult: s.dmg, src: 'astral', knock: 0.5, from: { x, z } });
      });
    }
    void y0;
  }

  s_sd_link(s) {
    const first = this.aimTarget(s.range + 4);
    if (!first) { this.warn('No foes to link.'); return false; }
    const list = [first, ...this.combat.circle(first.x, first.z, s.range, 'player').filter((e) => e !== first).slice(0, 2)];
    for (let i = 0; i < list.length; i++) {
      this.combat.applyStatus(list[i], 'linked', { dur: s.duration });
      const n = list[(i + 1) % list.length];
      if (list.length > 1) this.fx.beam(list[i].x, list[i].ry + 1.2, list[i].z, n.x, n.ry + 1.2, n.z, '#c48cff', 1.2);
    }
    this.g.overlay.text(first.x, first.ry + 2.6, first.z, `Linked ×${list.length}`, 'status');
    this.play('cast', 0.3);
  }
}
