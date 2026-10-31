// Ragnarok, the Dragon God: in the sky he circles the summit and strafes it with breath; on the
// ground he claws, sweeps his tail and roars you back; at the twilight of the gods meteors fall and
// fire closes in from the summit's edge.
import { Boss } from './base.js';
import { buildRagnarokRig } from '../../render/models.js';
import { BOSSES } from '../../data/bosses.js';

export class Ragnarok extends Boss {
  constructor(game, level, arena) {
    super(game, BOSSES.ragnarok, level, arena, buildRagnarokRig());
    this.radius = 1.8; this.height = 4.5; this.scale = 1;
    this.speed = 5;
    this.ang = 0;
    this.ringR = arena.r + 1;
  }

  get flying() { return this.phase === 0; }
  onPhase(i) {
    const g = this.g;
    if (i === 1) { g.ui?.banner('Earthbound', 'He lands. Claws, tail and a roar that throws you back.'); this.yOff = 0; }
    if (i === 2) { g.ui?.banner('Twilight of the Gods', 'Meteors fall and the fire closes in from the edge.'); this.ringR = this.arena.r; }
  }
  onReset() { this.ringR = this.arena.r + 1; this.yOff = 0; }

  think(dt) {
    const g = this.g, p = g.player, a = this.arena;
    const dx = p.x - this.x, dz = p.z - this.z, dist = Math.hypot(dx, dz) || 1;
    this.anim.t += dt * 0.5;
    if (this.flying) {
      // Circle the summit, high, and strafe it.
      this.ang += dt * 0.5;
      const tx = a.x + Math.cos(this.ang) * (a.r - 2), tz = a.z + Math.sin(this.ang) * (a.r - 2);
      this.x += (tx - this.x) * Math.min(1, dt * 2); this.z += (tz - this.z) * Math.min(1, dt * 2);
      this.yOff += (5 - (this.yOff || 0)) * Math.min(1, dt * 2);
      this.yaw = this.ang + Math.PI / 2;
      if (this.cd <= 0) { this.cd = 3.2; this.strafe(); }
      return;
    }
    this.yOff = Math.max(0, (this.yOff || 0) - dt * 6);
    if (this.phase >= 2) this.twilight(dt);
    switch (this.state) {
      case 'idle':
      case 'approach': {
        this.state = 'approach';
        if (dist > 4) { this.move(dx, dz, this.speed * 0.7 * dt); this.anim.move = 1; } else this.anim.move = 0;
        this.face(p.x, p.z, dt, 4);
        if (this.cd <= 0) { this.state = dist < 5 ? (Math.random() < 0.5 ? 'claw' : 'tail') : Math.random() < 0.5 ? 'roar' : 'strafe'; this.t = 0; }
        break;
      }
      case 'claw': {
        if (this.t === 0) g.fx.slash(this.x, this.ry + 0.1, this.z, this.yaw, 5.5, 120, '#ff6a2a', 0.7);
        this.t += dt;
        if (this.t >= 0.7) {
          for (const t of g.combat.arc(this.x, this.z, this.yaw, 5.5, 120, 'enemy')) g.combat.hurt(t, this.dmg * 1.3, this, { type: 'melee', knock: 8, status: [{ id: 'bleed', chance: 0.5 }] });
          g.bus.emit('sfx', { id: 'heavy' });
          this.state = 'approach'; this.cd = 1.6;
        }
        break;
      }
      case 'tail': {
        if (this.t === 0) g.fx.decal({ shape: 'ring', x: this.x, z: this.z, y: this.ry, r: 6, t: 0.9, fill: true, color: '#ff8a3d', follow: this });
        this.t += dt;
        if (this.t >= 0.9) {
          g.fx.burst(this.x, this.ry + 0.6, this.z, 30, { color: '#a83a1a', speed: 8, up: 2 });
          for (const t of g.combat.circle(this.x, this.z, 6, 'enemy')) g.combat.hurt(t, this.dmg, this, { type: 'aoe', knock: 10 });
          g.cam.shake(0.5); g.bus.emit('sfx', { id: 'slam' });
          this.state = 'approach'; this.cd = 1.8;
        }
        break;
      }
      case 'roar': {
        if (this.t === 0) { g.overlay.text(this.x, this.ry + 6, this.z, 'ROAR!', 'status'); g.bus.emit('sfx', { id: 'roar' }); g.cam.shake(0.8); }
        this.t += dt;
        if (this.t >= 0.6) {
          g.fx.decal({ shape: 'ring', x: this.x, z: this.z, y: this.ry, r: 12, t: 0.6, fill: false, color: '#ffd166' });
          for (const t of g.combat.circle(this.x, this.z, 12, 'enemy')) g.combat.hurt(t, this.dmg * 0.5, this, { type: 'aoe', knock: 14 });
          this.state = 'approach'; this.cd = 1.4;
        }
        break;
      }
      case 'strafe': {
        if (this.t === 0) this.strafe();
        this.t += dt;
        if (this.t >= 1.2) { this.state = 'approach'; this.cd = 1.8; }
        break;
      }
      default: this.state = 'approach';
    }
  }

  // A burning line across the summit, through where you stand.
  strafe() {
    const g = this.g, p = g.player, a = this.arena;
    const ang = Math.random() * Math.PI * 2, ux = Math.cos(ang), uz = Math.sin(ang);
    const ox = p.x - ux * (a.r + 4), oz = p.z - uz * (a.r + 4), len = (a.r + 4) * 2;
    g.fx.telegraph({ shape: 'line', x: ox, z: oz, y: a.h, dx: ux, dz: uz, len, width: 3.6, t: 1.2, color: '#ff5a1a' });
    g.combat.after(1.2, () => {
      if (!this.alive) return;
      for (let d = 0; d < len; d += 2) g.fx.burst(ox + ux * d, a.h + 0.8, oz + uz * d, 3, { color: d % 4 ? '#ff8a3d' : '#ffd166', speed: 3, up: 3, life: 0.6 });
      g.bus.emit('sfx', { id: 'roar' });
      for (const t of g.combat.line(ox, oz, ux, uz, len, 3.6, 'enemy')) g.combat.hurt(t, this.dmg * 1.1, this, { type: 'aoe', status: [{ id: 'burn' }] });
    });
  }

  // Twilight: meteors, and a ring of fire that creeps inward to a last small circle.
  twilight(dt) {
    const g = this.g, p = g.player, a = this.arena;
    this.meteorT = (this.meteorT || 0) - dt;
    if (this.meteorT <= 0) {
      this.meteorT = 2;
      for (let k = 0; k < 3; k++) {
        const x = p.x + (Math.random() - 0.5) * 8, z = p.z + (Math.random() - 0.5) * 8;
        g.fx.telegraph({ shape: 'circle', x, z, y: a.h, r: 2, t: 1.2, color: '#ff5a1a' });
        g.combat.after(1.2, () => { g.fx.burst(x, a.h + 0.4, z, 18, { color: '#ff7a1a', speed: 6, up: 5 }); for (const t of g.combat.circle(x, z, 2, 'enemy')) g.combat.hurt(t, this.dmg * 0.8, this, { type: 'aoe', status: [{ id: 'burn' }] }); });
      }
    }
    this.ringT = (this.ringT || 0) - dt;
    if (this.ringT <= 0) {
      this.ringT = 1;
      this.ringR = Math.max(6, this.ringR - 0.4);
      // Anyone outside the ring burns.
      if (Math.hypot(p.x - a.x, p.z - a.z) > this.ringR) g.combat.hurt(p, this.dmg * 0.3, this, { type: 'hazard', status: [{ id: 'burn' }] });
      for (let k = 0; k < 12; k++) { const t = (k / 12) * Math.PI * 2; g.fx.burst(a.x + Math.cos(t) * this.ringR, a.h + 0.3, a.z + Math.sin(t) * this.ringR, 2, { color: '#ff6a1a', speed: 1, up: 3, life: 0.8 }); }
    }
  }
}
