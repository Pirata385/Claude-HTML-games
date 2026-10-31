// The Siamese: two slime monarchs, fire and ice. They fight side by side, each with its own life,
// slamming, spilling their element and lobbing gel at anyone who keeps away. When one falls, or both
// are worn to half, they merge for good into one slime of fire and ice; bringing it down wins.
import { Boss } from './base.js';
import { buildSiameseRig } from '../../render/models.js';
import { BOSSES } from '../../data/bosses.js';

const ELEMENT = { fire: { color: '#ff7a5a', status: 'burn' }, ice: { color: '#7ab8ff', status: 'chill' } };
const MERGED = 0.5; // the united slime's health, as a share of the twins' joined health

export class Siamese extends Boss {
  // opts: { element: 'fire' | 'ice', group, merged, withTwin }
  constructor(game, level, arena, opts = {}) {
    const merged = !!opts.merged, element = merged ? 'fire' : opts.element || 'fire';
    super(game, BOSSES.siamese, level, arena, buildSiameseRig(merged ? 'united' : element), opts.group);
    this.merged = merged;
    this.element = element;
    this.scale = merged ? 3.2 : 2.0; this.radius = 0.56 * this.scale; this.height = 1;
    this.speed = merged ? 2.6 : 3.0;
    this.side = element === 'fire' ? 1 : -1;
    if (!merged) this.x = arena.x + this.side * 2;
    this.hop = 0;
    this.globCd = merged ? 2 : this.side > 0 ? 1.5 : 2.9;
    // The fire monarch brings the ice monarch with it.
    if (!merged && (!opts.group || opts.withTwin)) game.enemies.addBoss(new Siamese(game, level, arena, { element: 'ice', group: this.group }));
  }

  // The twins never change phase by health: merging is their change. The united slime counts its own.
  phaseFrac() { return this.merged ? this.hp / this.maxHp : 1.01; }
  onPhase(i) {
    if (this.merged && i === 2) this.g.ui?.banner('Boiling Point', 'It boils over: quicker slams that leave fire and ice around it.');
  }
  onReset() {
    if (!this.merged) { this.x = this.arena.x + this.side * 2; this.z = this.arena.z; return; }
    // A reset parts them again.
    const g = this.g, grp = this.group;
    this.alive = false; this.dyingT = 0;
    grp.members.length = 0; grp.merged = false;
    g.enemies.addBoss(new Siamese(g, this.level, this.arena, { element: 'fire', group: grp, withTwin: true }));
  }

  shouldMerge() {
    const ms = this.group.members;
    return ms.some((m) => !m.alive) || ms.every((m) => m.hp <= m.maxHp * 0.5);
  }

  merge() {
    const g = this.g, grp = this.group;
    if (grp.merged) return;
    grp.merged = true;
    const live = grp.members.filter((m) => m.alive);
    const x = live.reduce((a, m) => a + m.x, 0) / live.length, z = live.reduce((a, m) => a + m.z, 0) / live.length;
    const total = grp.members.reduce((a, m) => a + m.maxHp, 0);
    for (const m of live) { m.alive = false; m.dyingT = 0.45; g.fx.burst(m.x, m.ry + 1, m.z, 20, { color: ELEMENT[m.element].color, speed: 5, up: 3 }); }
    grp.members.length = 0;
    const u = new Siamese(g, this.level, this.arena, { merged: true, group: grp });
    u.maxHp = u.hp = Math.round(total * MERGED);
    u.x = x; u.z = z; u.phase = 1; u.cd = 1.5;
    g.enemies.addBoss(u);
    if (g.lockTarget && !g.lockTarget.alive) g.lockTarget = u;
    g.fx.column(x, this.ry, z, '#c890e0', 30, 1.4);
    g.cam.shake(0.6); g.bus.emit('sfx', { id: 'slam' });
    g.ui?.banner('United', 'They merge into one slime of fire and ice. Bring it down to win.');
    g.bus.emit('bossPhase', { def: this.bossDef, phase: this.bossDef.phases[1] });
  }

  think(dt) {
    const g = this.g, p = g.player;
    if (!this.merged && this.shouldMerge()) { this.merge(); return; }
    const dx = p.x - this.x, dz = p.z - this.z, dist = Math.hypot(dx, dz) || 1;
    // Hopping body.
    this.hop += dt * (this.merged ? 1.0 : 1.3);
    const ph = this.hop % 1;
    this.yOff = ph < 0.5 ? Math.sin((ph / 0.5) * Math.PI) * (this.merged ? 1.0 : 0.7) : 0;
    this.anim.squash = ph < 0.5 ? 0.1 : -0.15 * Math.sin(((ph - 0.5) / 0.5) * Math.PI);
    // The twins come at you from either side; the united slime straight on.
    const reach = this.merged ? 3.4 : 2.6;
    const off = this.merged ? 0 : 1.6 * this.side;
    const tx = p.x - (dz / dist) * off, tz = p.z + (dx / dist) * off;
    if (dist > reach) this.move(tx - this.x, tz - this.z, this.speed * dt);
    this.face(p.x, p.z, dt, 5);
    // They spill their element as they go.
    this.trailT = (this.trailT || 0) - dt;
    if (!this.merged && dist > reach && this.trailT <= 0) { this.trailT = 0.7; this.puddle(this.x, this.z, this.element, 1.2); }
    // Gel for anyone keeping their distance.
    this.globCd -= dt;
    if (dist > 6 && this.globCd <= 0) { this.globCd = this.merged ? 2.8 : 3.2; this.lob(this.merged ? 3 : 2); }
    if (this.cd <= 0 && dist < reach + 1.2) {
      this.cd = this.merged && this.phase >= 2 ? 1.9 : 2.4;
      this.slam();
    }
  }

  slam() {
    const g = this.g, el = ELEMENT[this.element];
    const r = this.merged ? 4.5 : 3;
    g.fx.telegraph({ shape: 'circle', x: this.x, z: this.z, y: this.ry, r, t: 0.8, color: el.color, follow: this });
    g.combat.after(0.8, () => {
      if (!this.alive) return;
      g.fx.burst(this.x, this.ry + 0.4, this.z, 26, { color: el.color, speed: 7, up: 3 });
      g.cam.shake(0.35); g.bus.emit('sfx', { id: 'slam' });
      for (const t of g.combat.circle(this.x, this.z, r, 'enemy')) g.combat.hurt(t, this.dmg * (this.merged ? 1.2 : 1), this, { type: 'aoe', knock: 6, status: [{ id: el.status, chance: 0.7 }] });
      if (!this.merged) return;
      // Boiling over: fire and ice left all around.
      if (this.phase >= 2) for (let k = 0; k < 4; k++) { const a = (k * Math.PI) / 2 + this.hop; this.puddle(this.x + Math.cos(a) * 3.2, this.z + Math.sin(a) * 3.2, k % 2 ? 'ice' : 'fire', 1.5); }
      // Every slam of the united slime swaps its element.
      this.element = this.element === 'fire' ? 'ice' : 'fire';
    });
  }

  // Globs of gel: each lands where a ring shows, a moment later. The first falls where you stand,
  // the second where you are heading, the rest around you.
  lob(n) {
    const g = this.g, p = g.player, el = ELEMENT[this.element];
    for (let k = 0; k < n; k++) {
      const x = k === 0 ? p.x : k === 1 ? p.x + p.vx * 1.1 : p.x + (g.rng.next() - 0.5) * 5;
      const z = k === 0 ? p.z : k === 1 ? p.z + p.vz * 1.1 : p.z + (g.rng.next() - 0.5) * 5;
      const y = g.grid.height(Math.floor(x), Math.floor(z));
      g.fx.telegraph({ shape: 'circle', x, z, y, r: 1.6, t: 1.1, color: el.color });
      g.combat.after(1.1, () => {
        if (!this.alive) return;
        g.fx.burst(x, y + 0.4, z, 14, { color: el.color, speed: 5, up: 3 });
        for (const t of g.combat.circle(x, z, 1.6, 'enemy')) g.combat.hurt(t, this.dmg * 0.6, this, { type: 'aoe', status: [{ id: el.status, chance: 0.5 }] });
      });
    }
    g.bus.emit('sfx', { id: 'enemyShoot', x: this.x, z: this.z });
  }

  puddle(x, z, element, r) {
    const g = this.g, el = ELEMENT[element];
    g.combat.zone({ x, z, y: g.grid.height(Math.floor(x), Math.floor(z)), r, t: 3.5, interval: 0.5, team: 'enemy', color: el.color,
      onTick: (ts) => { for (const t of ts) g.combat.hurt(t, this.dmg * 0.1, this, { type: 'hazard', status: [{ id: el.status, chance: 0.4 }] }); } });
  }
}
