// The Siamese: two slime monarchs, fire and ice, fought as one. While conjoined, hurting one side
// much more than the other lets the other mend it: keep them even. Then they tear apart and
// circle you, trailing their elements; at the end they fuse again and swap elements on every slam.
import { Boss } from './base.js';
import { buildSiameseRig } from '../../render/models.js';
import { BOSSES } from '../../data/bosses.js';

const ELEMENT = { fire: { color: '#ff7a5a', status: 'burn' }, ice: { color: '#7ab8ff', status: 'chill' } };

export class Siamese extends Boss {
  constructor(game, level, arena, opts = {}) {
    const element = opts.element || 'fire';
    super(game, BOSSES.siamese, level, arena, buildSiameseRig(element), opts.group);
    this.element = element;
    this.scale = 2.2; this.radius = 0.56 * 2.2; this.height = 1;
    this.speed = 3.0;
    this.side = element === 'fire' ? 1 : -1;
    this.x = arena.x + this.side * 1.4;
    this.hop = 0;
    // The fire monarch brings the ice monarch with it.
    if (!opts.group) { this.twin = new Siamese(game, level, arena, { element: 'ice', group: this.group }); this.twin.twin = this; game.enemies.addBoss(this.twin); }
  }

  get lead() { return this.group.members.find((m) => m.alive) === this; }
  get conjoined() { return this.phase === 0 || this.phase >= 2; }

  onPhase(i) {
    if (!this.lead) return;
    const g = this.g;
    if (i === 1) g.ui?.banner('Severed', 'They tear apart. Each leaves a trail of its element.');
    if (i === 2) g.ui?.banner('Reunion', 'They fuse again, swapping elements on every slam.');
  }
  onReset() { this.x = this.arena.x + this.side * 1.4; this.z = this.arena.z; }

  think(dt) {
    const g = this.g, p = g.player, tw = this.twin;
    const dx = p.x - this.x, dz = p.z - this.z, dist = Math.hypot(dx, dz) || 1;
    // Hopping body.
    this.hop += dt * 1.3;
    const ph = this.hop % 1;
    this.yOff = ph < 0.5 ? Math.sin((ph / 0.5) * Math.PI) * 0.7 : 0;
    this.anim.squash = ph < 0.5 ? 0.1 : -0.15 * Math.sin(((ph - 0.5) / 0.5) * Math.PI);
    if (this.conjoined && tw?.alive) {
      // Joined at the side: the lead moves, the other keeps to its flank.
      if (this.lead) { if (dist > 3.5) this.move(dx, dz, this.speed * dt); }
      else { const lx = tw.x - tw.side * 2.6, lz = tw.z; this.move(lx - this.x, lz - this.z, Math.min(Math.hypot(lx - this.x, lz - this.z), 8 * dt)); }
      // Keep them even: the healthier half mends the more hurt one.
      const fa = this.hp / this.maxHp, fb = tw.hp / tw.maxHp;
      if (this.phase === 0 && fb - fa > 0.15) { this.hp = Math.min(this.maxHp, this.hp + this.maxHp * 0.04 * dt); if (Math.random() < dt * 3) g.fx.beam(tw.x, tw.ry + 1.5, tw.z, this.x, this.ry + 1.5, this.z, '#ffd166', 0.2); }
    } else {
      // Severed: circle opposite sides of you, trailing the element.
      this.ang = (this.ang ?? (this.side > 0 ? 0 : Math.PI)) + dt * 0.9;
      const tx = p.x + Math.cos(this.ang) * 6, tz = p.z + Math.sin(this.ang) * 6;
      if (Math.hypot(tx - this.arena.x, tz - this.arena.z) < this.arena.r - 1) this.move(tx - this.x, tz - this.z, Math.min(Math.hypot(tx - this.x, tz - this.z), this.speed * 1.3 * dt));
      this.trailT = (this.trailT || 0) - dt;
      if (this.trailT <= 0) {
        this.trailT = 0.5;
        const el = ELEMENT[this.element];
        g.combat.zone({ x: this.x, z: this.z, y: this.ry, r: 1.3, t: 4, interval: 0.5, team: 'enemy', color: el.color,
          onTick: (ts) => { for (const t of ts) g.combat.hurt(t, this.dmg * 0.12, this, { type: 'hazard', status: [{ id: el.status, chance: 0.5 }] }); } });
      }
    }
    this.face(p.x, p.z, dt, 5);
    if (this.cd <= 0) {
      this.cd = this.conjoined ? 2.6 : 2.2;
      this.slam();
    }
  }

  slam() {
    const g = this.g, el = ELEMENT[this.element];
    const r = this.conjoined ? 4 : 3;
    g.fx.telegraph({ shape: 'circle', x: this.x, z: this.z, y: this.ry, r, t: 0.8, color: el.color, follow: this });
    g.combat.after(0.8, () => {
      if (!this.alive) return;
      g.fx.burst(this.x, this.ry + 0.4, this.z, 26, { color: el.color, speed: 7, up: 3 });
      g.cam.shake(0.35); g.bus.emit('sfx', { id: 'slam' });
      for (const t of g.combat.circle(this.x, this.z, r, 'enemy')) g.combat.hurt(t, this.dmg, this, { type: 'aoe', knock: 6, status: [{ id: el.status, chance: 0.7 }] });
      // Reunion: every slam swaps the two elements.
      if (this.phase >= 2) this.element = this.element === 'fire' ? 'ice' : 'fire';
    });
  }
}
