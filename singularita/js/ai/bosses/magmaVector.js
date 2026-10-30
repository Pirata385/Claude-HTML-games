// The Magma Vector: heat given direction. It shows its line, dashes along it leaving lava, and its
// core cools afterwards (strike then). Later its vectors reflect off the caldera rim, then cross.
import { Boss } from './base.js';
import { buildVectorRig } from '../../render/models.js';
import { BOSSES } from '../../data/bosses.js';

export class MagmaVector extends Boss {
  constructor(game, level, arena) {
    super(game, BOSSES.magma_vector, level, arena, buildVectorRig());
    this.radius = 1.1; this.height = 3.2; this.scale = 1;
    this.speed = 2.2;
  }

  onPhase(i) {
    const g = this.g;
    if (i === 1) g.ui?.banner('Reflection', 'Its vectors now bounce off the caldera rim.');
    if (i === 2) g.ui?.banner('Cross Product', 'Two vectors at once. Find the gap between them.');
  }
  onReset() { this.cooling = 0; }

  // A dash path from (x, z) along (dx, dz), stopped at the arena rim.
  segment(x, z, dx, dz) {
    const a = this.arena;
    const fx = x - a.x, fz = z - a.z, R = a.r - 1.2;
    const b = fx * dx + fz * dz, c = fx * fx + fz * fz - R * R;
    const len = Math.max(2, -b + Math.sqrt(Math.max(0, b * b - c)));
    return { x, z, dx, dz, len };
  }

  think(dt) {
    const g = this.g, p = g.player;
    this.yOff = 0.4 + Math.sin(g.time * 2.5) * 0.15;
    if (this.cooling > 0) {
      // The cooled core: dark, slow and open to harm.
      this.cooling -= dt;
      this.anim.wind = 0;
      if (this.cooling <= 0) this.statuses.remove('sunder');
      return;
    }
    switch (this.state) {
      case 'idle':
      case 'approach': {
        this.state = 'approach';
        const dx = p.x - this.x, dz = p.z - this.z;
        if (Math.hypot(dx, dz) > 6) this.move(dx, dz, this.speed * dt);
        this.face(p.x, p.z, dt, 4);
        if (this.cd <= 0) { this.state = 'aim'; this.t = 0; }
        break;
      }
      case 'aim': {
        if (this.t === 0) {
          const dx = p.x - this.x, dz = p.z - this.z, l = Math.hypot(dx, dz) || 1;
          this.paths = [this.segment(this.x, this.z, dx / l, dz / l)];
          if (this.phase >= 1) {
            // Reflection: the path bounces once off the rim.
            const s = this.paths[0], ex = s.x + s.dx * s.len, ez = s.z + s.dz * s.len;
            const nx = (ex - this.arena.x) / this.arena.r, nz = (ez - this.arena.z) / this.arena.r, nl = Math.hypot(nx, nz) || 1;
            const d = s.dx * nx / nl + s.dz * nz / nl;
            this.paths.push(this.segment(ex, ez, s.dx - 2 * d * nx / nl, s.dz - 2 * d * nz / nl));
          }
          if (this.phase >= 2) {
            // Cross Product: a second vector across the first, through the player.
            const cx = -dz / l, cz = dx / l;
            this.cross = this.segment(p.x - cx * 12, p.z - cz * 12, cx, cz);
          } else this.cross = null;
          for (const s of [...this.paths, this.cross].filter(Boolean)) g.fx.telegraph({ shape: 'line', x: s.x, z: s.z, y: this.ry, dx: s.dx, dz: s.dz, len: s.len, width: 2.4, t: 1.1, color: '#ff6a1a' });
          this.yaw = Math.atan2(this.paths[0].dx, this.paths[0].dz);
          this.anim.wind = 1;
          g.bus.emit('sfx', { id: 'charge' });
        }
        this.t += dt;
        if (this.t >= 1.1) { this.anim.wind = 0; this.state = 'dash'; this.leg = 0; this.ran = 0; this.hitP = false; if (this.cross) this.burnLine(this.cross, true); }
        break;
      }
      case 'dash': {
        const s = this.paths[this.leg];
        const step = Math.min(26 * dt, s.len - this.ran);
        this.x += s.dx * step; this.z += s.dz * step; this.ran += step;
        this.yaw = Math.atan2(s.dx, s.dz);
        if (!this.hitP && Math.hypot(p.x - this.x, p.z - this.z) < this.radius + 0.8) { this.hitP = true; g.combat.hurt(p, this.dmg * 1.5, this, { type: 'melee', knock: 10, status: [{ id: 'burn' }] }); }
        if (Math.random() < 0.6) g.fx.burst(this.x, this.ry + 0.8, this.z, 2, { color: '#ff8a3d', speed: 2, up: 2, life: 0.5 });
        if (this.ran >= s.len - 0.01) {
          this.burnLine(s, false);
          this.leg++; this.ran = 0;
          if (this.leg >= this.paths.length) {
            // The core cools: a window to strike.
            this.cooling = 2.6;
            this.statuses.apply('sunder', { dur: 2.6 });
            g.overlay.text(this.x, this.ry + 3.4, this.z, 'The core cools!', 'status');
            g.fx.burst(this.x, this.ry + 1.6, this.z, 24, { color: '#5a4a46', speed: 3, up: 2 });
            g.bus.emit('sfx', { id: 'boom' });
            this.state = 'approach'; this.cd = this.phase >= 2 ? 1.6 : 2.2;
          }
        }
        break;
      }
      default: this.state = 'approach';
    }
  }

  // Lava left along a vector: it burns for a few seconds. A crossing vector strikes all at once.
  burnLine(s, strike) {
    const g = this.g, y = this.arena.h;
    if (strike) {
      g.combat.after(0.2, () => {
        for (const t of g.combat.line(s.x, s.z, s.dx, s.dz, s.len, 2.4, 'enemy')) g.combat.hurt(t, this.dmg * 1.2, this, { type: 'aoe', status: [{ id: 'burn' }] });
        g.fx.beam(s.x, y + 1, s.z, s.x + s.dx * s.len, y + 1, s.z + s.dz * s.len, '#ff6a1a', 0.4);
      });
    }
    for (let d = 1; d < s.len; d += 2.4) {
      const x = s.x + s.dx * d, z = s.z + s.dz * d;
      g.combat.zone({ x, z, y, r: 1.2, t: 4, interval: 0.5, team: 'enemy', color: '#ff5a14',
        onTick: (ts) => { for (const t of ts) g.combat.hurt(t, this.dmg * 0.12, this, { type: 'hazard', status: [{ id: 'burn', chance: 0.4 }] }); } });
    }
  }
}
