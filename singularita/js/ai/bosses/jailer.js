// The Iron-Hand Jailer: his chain hooks you to his fist; then cages slam down around the block;
// at the end he throws the cells open and the prisoners riot.
import { Boss } from './base.js';
import { buildJailerRig } from '../../render/models.js';
import { BOSSES } from '../../data/bosses.js';
import { moveCircle } from '../../world/physics.js';

export class IronJailer extends Boss {
  constructor(game, level, arena) {
    super(game, BOSSES.iron_jailer, level, arena, buildJailerRig());
    this.radius = 1.0; this.height = 3.4; this.scale = 1;
    this.speed = 3.0;
    this.riotT = 4;
  }

  onPhase(i) {
    const g = this.g;
    if (i === 1) g.ui?.banner('Solitary', 'Cages slam down. Get out from under their shadows.');
    if (i === 2) g.ui?.banner('Riot', 'The cells are open. The prisoners hate him as much as you.');
  }
  onReset() { this.riotT = 4; }

  think(dt) {
    const g = this.g, p = g.player;
    const dx = p.x - this.x, dz = p.z - this.z, dist = Math.hypot(dx, dz);
    if (this.phase >= 2) {
      this.riotT -= dt;
      if (this.riotT <= 0) {
        this.riotT = 12;
        for (let k = 0; k < 3; k++) {
          const a = Math.random() * Math.PI * 2;
          g.enemies.spawn('shackled_prisoner', this.arena.x + Math.cos(a) * (this.arena.r - 2), this.arena.z + Math.sin(a) * (this.arena.r - 2), { level: this.level - 4, summoned: true });
        }
        g.bus.emit('sfx', { id: 'unlock' });
      }
    }
    switch (this.state) {
      case 'idle':
      case 'approach': {
        this.state = 'approach';
        if (dist > 3) { this.move(dx, dz, this.speed * dt); this.anim.move = 1; this.anim.phase += this.speed * dt * 1.3; } else this.anim.move = 0;
        this.face(p.x, p.z, dt, 5);
        if (this.cd <= 0) {
          const opts = dist < 4 ? ['fist', 'fist', 'hook'] : ['hook', 'hook', 'fist'];
          if (this.phase >= 1) opts.push('cages', 'cages');
          this.state = opts[Math.floor(Math.random() * opts.length)]; this.t = 0;
        }
        break;
      }
      case 'fist': {
        if (this.t === 0) { this.fx0 = this.x + Math.sin(this.yaw) * 2.4; this.fz0 = this.z + Math.cos(this.yaw) * 2.4; g.fx.telegraph({ shape: 'circle', x: this.fx0, z: this.fz0, y: this.ry, r: 2.6, t: 0.9 }); this.play('slam', 0.9); }
        this.t += dt;
        if (this.t >= 0.9) {
          g.fx.burst(this.fx0, this.ry + 0.3, this.fz0, 26, { color: '#8a8a96', speed: 7, up: 3 });
          g.cam.shake(0.5); g.bus.emit('sfx', { id: 'boom' });
          this.hurtIn(this.fx0, this.fz0, 2.6, 1.4, { knock: 8 });
          this.state = 'approach'; this.cd = 1.8;
        }
        break;
      }
      case 'hook': {
        // The chain flies along a shown line; caught, you are dragged to his fist.
        if (this.t === 0) {
          this.hdx = dx / (dist || 1); this.hdz = dz / (dist || 1);
          this.yaw = Math.atan2(this.hdx, this.hdz);
          g.fx.telegraph({ shape: 'line', x: this.x, z: this.z, y: this.ry, dx: this.hdx, dz: this.hdz, len: 15, width: 1.6, t: 0.8, color: '#b8b8c8' });
          this.play('thrust', 0.8);
        }
        this.t += dt;
        if (this.t >= 0.8 && !this.hooked) {
          this.hooked = true;
          g.fx.beam(this.x, this.ry + 2, this.z, this.x + this.hdx * 15, this.ry + 1, this.z + this.hdz * 15, '#b8b8c8', 0.3);
          if (g.combat.line(this.x, this.z, this.hdx, this.hdz, 15, 1.6, 'enemy').includes(p)) {
            g.combat.hurt(p, this.dmg * 0.6, this, { type: 'ranged', status: [{ id: 'stun', dur: 0.5 }] });
            this.pull = 0.5;
          }
        }
        if (this.pull > 0) {
          this.pull -= dt;
          const ddx = this.x - p.x, ddz = this.z - p.z, l = Math.hypot(ddx, ddz);
          if (l > 2.2) moveCircle(g.grid, p, (ddx / l) * 20 * dt, (ddz / l) * 20 * dt, p.radius, 1.05);
        }
        if (this.t >= 1.4) { this.hooked = false; this.pull = 0; this.state = dist < 4 ? 'fist' : 'approach'; this.t = 0; this.cd = 1.2; }
        break;
      }
      case 'cages': {
        // Three cages drop: one on you, two around you.
        if (this.t === 0) {
          this.cages = [{ x: p.x, z: p.z }];
          for (let k = 0; k < 2; k++) { const a = Math.random() * Math.PI * 2; this.cages.push({ x: p.x + Math.cos(a) * 4, z: p.z + Math.sin(a) * 4 }); }
          for (const c of this.cages) g.fx.telegraph({ shape: 'circle', x: c.x, z: c.z, y: this.arena.h, r: 1.8, t: 1.2, color: '#b8b8c8' });
          this.play('overhead', 1.2);
        }
        this.t += dt;
        if (this.t >= 1.2) {
          for (const c of this.cages) {
            g.fx.column(c.x, this.arena.h, c.z, '#8a8a96', 12, 1.6);
            for (const t of g.combat.circle(c.x, c.z, 1.8, 'enemy')) g.combat.hurt(t, this.dmg * 0.9, this, { type: 'aoe', status: [{ id: 'root', dur: 2 }] });
          }
          g.bus.emit('sfx', { id: 'slam' });
          this.state = 'approach'; this.cd = 2;
        }
        break;
      }
      default: this.state = 'approach';
    }
  }
}
