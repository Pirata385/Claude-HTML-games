// The Slime Prince: bouncing shockwave rings, a crown slam, royal guards he absorbs to heal,
// and a split into two halves that must both fall.
import { Boss } from './base.js';
import { buildPrinceRig } from '../../render/models.js';
import { BOSSES } from '../../data/bosses.js';

export class SlimePrince extends Boss {
  constructor(game, level, arena, opts = {}) {
    super(game, BOSSES.slime_prince, level, arena, buildPrinceRig(), opts.group);
    this.baseScale = opts.half ? 1.7 : 2.4;
    this.scale = this.baseScale;
    this.radius = 0.56 * this.scale;
    this.height = 1.0;
    this.half = !!opts.half;
    this.hops = 0;
    this.speed = opts.half ? 4.2 : 3.2;
    this.absorbT = 12;
    if (opts.half) { this.maxHp = opts.hp; this.hp = opts.hp; }
  }

  onPhase(i) {
    const g = this.g;
    if (i === 1 && !this.half) { this.summonGuards(4); g.ui?.banner('The Royal Guard!', 'He absorbs his guards to heal. Strike them first.'); }
    if (i === 2 && !this.half && !this.split) this.doSplit();
  }
  onReset() { this.scale = this.baseScale; for (const m of [...this.group.members]) if (m !== this && m.half) { m.alive = false; m.dyingT = 0; } this.group.members = [this]; this.split = false; }

  summonGuards(n) {
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2;
      const e = this.g.enemies.spawn('royal_guard', this.x + Math.cos(a) * 3.5, this.z + Math.sin(a) * 3.5, { level: this.level, noIntro: false });
      if (e) e.royal = this;
    }
    this.g.bus.emit('sfx', { id: 'fanfare' });
  }

  doSplit() {
    this.split = true;
    const half = this.hp / 2;
    this.hp = half; this.maxHp = Math.max(half, this.maxHp / 2);
    this.baseScale = 1.7; this.scale = 1.7; this.speed = 4.2; this.half = true;
    const twin = new SlimePrince(this.g, this.level, this.arena, { half: true, hp: half, group: this.group });
    twin.maxHp = this.maxHp;
    twin.x = this.x + 2; twin.z = this.z;
    twin.phase = this.phase;
    this.g.enemies.addBoss(twin);
    this.g.fx.burst(this.x, this.ry + 1, this.z, 40, { color: '#ffd166', speed: 8 });
    this.g.ui?.banner('Royal Division!', 'The Prince splits in two. Both halves must fall.');
  }

  think(dt, c) {
    const g = this.g, p = g.player;
    const a = this.anim;
    if (this.state === 'idle') {
      this.state = 'hop'; this.t = 0; this.hops = 0;
    }
    if (this.state === 'hop') {
      // Three hops toward the player; every landing sends out a ring to jump or dodge.
      this.t += dt * (this.half ? 1.4 : 1.1);
      const ph = this.t % 1;
      const air = ph < 0.6;
      this.yOff = air ? Math.sin((ph / 0.6) * Math.PI) * (this.half ? 1.6 : 2.2) : 0;
      a.squash = air ? 0.15 : -0.25 * Math.sin(((ph - 0.6) / 0.4) * Math.PI);
      if (air) { this.move(p.x - this.x, p.z - this.z, this.speed * dt * 1.6); this.face(p.x, p.z, dt); }
      if (!air && this.wasAir) {
        this.hops++;
        this.ring(this.half ? 7 : 9);
        g.cam.shake(0.25);
        g.bus.emit('sfx', { id: 'slimeLand' });
      }
      this.wasAir = air;
      if (this.hops >= 3 && !air) { this.state = this.phase >= 1 && !this.half && this.absorbT <= 0 ? 'absorb' : 'slamPrep'; this.t = 0; this.yOff = 0; }
      this.absorbT -= dt;
      return;
    }
    if (this.state === 'slamPrep') {
      // Crown slam: leap onto the player's spot after a readable telegraph.
      if (this.t === 0) { this.target = { x: p.x, z: p.z }; g.fx.telegraph({ shape: 'circle', x: p.x, z: p.z, y: p.ry, r: 4.5, t: 1.2 }); this.from = { x: this.x, z: this.z }; }
      this.t += dt;
      const k = Math.min(1, this.t / 1.2);
      a.squash = -0.3 * Math.min(1, this.t * 3);
      if (k > 0.35) {
        const u = (k - 0.35) / 0.65;
        this.x = this.from.x + (this.target.x - this.from.x) * u; this.z = this.from.z + (this.target.z - this.from.z) * u;
        this.yOff = Math.sin(u * Math.PI) * 6;
      }
      if (k >= 1) {
        this.yOff = 0;
        g.fx.burst(this.x, this.ry + 0.4, this.z, 40, { color: '#ffd166', speed: 9, up: 4 });
        g.cam.shake(0.6); g.hitStop(0.06);
        g.bus.emit('sfx', { id: 'boom' });
        this.hurtIn(this.x, this.z, 4.5, 1.6, { knock: 10 });
        this.state = 'rest'; this.t = 1.4;
      }
      return;
    }
    if (this.state === 'absorb') {
      // Pull nearby guards in; any that arrive heal him and make him grow.
      if (this.t === 0) { g.ui?.banner('The Prince calls his guard!', 'Kill the golden guards before they reach him.'); this.summonGuards(this.half ? 0 : 3); }
      this.t += dt;
      a.squash = 0.1 * Math.sin(this.t * 10);
      for (const e of g.enemies.active) {
        if (!e.alive || e.royal !== this) continue;
        const dx = this.x - e.x, dz = this.z - e.z, l = Math.hypot(dx, dz);
        e.x += (dx / l) * Math.min(l, 2.2 * dt); e.z += (dz / l) * Math.min(l, 2.2 * dt);
        if (l < this.radius + 0.8) {
          e.alive = false; e.dyingT = 0.2;
          this.hp = Math.min(this.maxHp, this.hp + this.maxHp * 0.06);
          this.scale = Math.min(this.baseScale * 1.35, this.scale + 0.12);
          g.fx.burst(this.x, this.ry + 1.5, this.z, 16, { color: '#6fe08a', speed: 4 });
          g.overlay.text(this.x, this.ry + 3, this.z, 'Absorbed!', 'heal');
        }
      }
      if (this.t > 3.2) { this.state = 'hop'; this.t = 0; this.hops = 0; this.absorbT = 12; }
      return;
    }
    if (this.state === 'rest') {
      this.t -= dt;
      a.squash = -0.1;
      if (this.t <= 0) { this.state = 'hop'; this.t = 0; this.hops = 0; }
    }
  }

  ring(maxR) {
    const g = this.g, x = this.x, z = this.z, y = this.ry;
    const d = g.fx.decal({ shape: 'ring', x, z, y, r: 1, t: 0.9, fill: false, color: '#ffd166', alpha: 0.9 });
    let R = 1, hit = false;
    const step = () => {
      R += 0.45;
      d.mesh.scale.set(R, 1, R);
      const p = g.player;
      const dist = Math.hypot(p.x - x, p.z - z);
      if (!hit && Math.abs(dist - R) < 0.7 && p.grounded && p.y < y + 0.5) { hit = true; g.combat.hurt(p, this.dmg * 0.8, this, { type: 'aoe', knock: 6 }); }
      if (R < maxR) g.combat.after(0.04, step);
    };
    step();
  }
}
