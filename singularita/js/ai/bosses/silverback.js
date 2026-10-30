// The Silverback Zombie Emperor: swipes, leap slams, boulder throws, roars that summon Echoes,
// and a charge that stuns him if he is baited into a pillar.
import { Boss } from './base.js';
import { buildSilverbackRig } from '../../render/models.js';
import { BOSSES } from '../../data/bosses.js';
import { F } from '../../world/grid.js';

export class Silverback extends Boss {
  constructor(game, level, arena) {
    super(game, BOSSES.silverback_emperor, level, arena, buildSilverbackRig());
    this.radius = 1.3; this.height = 3.2; this.scale = 1.15;
    this.speed = 3.4;
    this.enraged = false;
  }

  onPhase(i) {
    const g = this.g;
    if (i === 1) g.ui?.banner('The Charge', 'Bait the Emperor into a pillar to stun him.');
    if (i === 2) { this.enraged = true; this.speed *= 1.35; this.roar(true); g.ui?.banner('Enraged!', 'Faster, angrier, and every roar calls the Echoes.'); }
  }
  onReset() { this.enraged = false; this.speed = 3.4; this.stunnedBonus = false; }

  roar(big) {
    const g = this.g;
    this.play('slam', 1.0);
    g.cam.shake(0.5);
    g.overlay.text(this.x, this.ry + 4, this.z, 'ROAR!', 'status');
    g.bus.emit('sfx', { id: 'roar' });
    g.fx.decal({ shape: 'ring', x: this.x, z: this.z, y: this.ry, r: 10, t: 0.7, fill: false, color: '#d8dde6' });
    const n = big ? 4 : this.enraged ? 3 : 2;
    for (let k = 0; k < n; k++) {
      const a = Math.random() * Math.PI * 2;
      g.enemies.spawn(Math.random() < 0.5 ? 'zombie_walker' : 'zombie_runner', this.arena.x + Math.cos(a) * (this.arena.r + 2), this.arena.z + Math.sin(a) * (this.arena.r + 2), { level: Math.max(1, this.level - 3) });
    }
    for (const e of g.enemies.active) if (e.def.family === 'zombie' && e.dist2(this) < 400) e.statuses.apply('haste', { dur: 6 });
  }

  pick() {
    const p = this.g.player, d = Math.hypot(p.x - this.x, p.z - this.z);
    const opts = ['leap', 'boulder', 'roar'];
    if (this.phase >= 1) opts.push('charge', 'charge');
    if (d > 10) opts.push('leap', 'charge');
    let s = opts[Math.floor(Math.random() * opts.length)];
    if (s === 'charge' && this.phase < 1) s = 'leap';
    if (s === this.last && s === 'roar') s = 'boulder';
    this.last = s;
    return s;
  }

  think(dt, c) {
    const g = this.g, p = g.player;
    const cdMul = this.enraged ? 0.7 : 1;
    const dx = p.x - this.x, dz = p.z - this.z, dist = Math.hypot(dx, dz);
    switch (this.state) {
      case 'idle':
      case 'approach': {
        this.state = 'approach';
        if (dist > 3.2) { this.move(dx, dz, this.speed * dt); this.anim.move = 1; this.anim.phase += this.speed * dt * 1.4; }
        else this.anim.move = 0;
        this.face(p.x, p.z, dt);
        if (dist < 3.8 && this.cd <= 0) { this.state = 'swipe'; this.t = 0.6; g.fx.slash(this.x, this.ry + 0.1, this.z, this.yaw, 4, 150, '#ff4a3a', 0.6); this.anim.wind = 0; }
        else if (this.cd <= -2.5 * cdMul || (dist > 12 && this.cd <= 0)) { this.state = this.pick(); this.t = 0; }
        break;
      }
      case 'swipe': {
        this.t -= dt; this.anim.wind = 1 - this.t / 0.6;
        if (this.t <= 0) {
          this.anim.wind = 0; this.play('slash', 0.3);
          for (const t of g.combat.arc(this.x, this.z, this.yaw, 4, 150, 'enemy')) g.combat.hurt(t, this.dmg, this, { type: 'melee', knock: 8 });
          g.bus.emit('sfx', { id: 'heavy' });
          this.state = 'approach'; this.cd = 1.4 * cdMul;
        }
        break;
      }
      case 'leap': {
        if (this.t === 0) { this.tx = p.x; this.tz = p.z; this.fx0 = this.x; this.fz0 = this.z; g.fx.telegraph({ shape: 'circle', x: p.x, z: p.z, y: p.ry, r: 4, t: 1.1 }); this.play('slam', 1.1); }
        this.t += dt;
        const k = Math.min(1, this.t / 1.1);
        if (k > 0.4) { const u = (k - 0.4) / 0.6; this.x = this.fx0 + (this.tx - this.fx0) * u; this.z = this.fz0 + (this.tz - this.fz0) * u; this.yOff = Math.sin(u * Math.PI) * 5; }
        if (k >= 1) {
          this.yOff = 0;
          g.fx.burst(this.x, this.ry + 0.3, this.z, 36, { color: '#b8a98a', speed: 8, up: 4 });
          g.cam.shake(0.6); g.hitStop(0.05);
          g.bus.emit('sfx', { id: 'boom' });
          this.hurtIn(this.x, this.z, 4, 1.4, { knock: 9 });
          this.state = 'approach'; this.cd = 2 * cdMul;
        }
        break;
      }
      case 'boulder': {
        if (this.t === 0) { this.play('overhead', 0.9); g.fx.burst(this.x, this.ry + 0.2, this.z, 14, { color: '#8e9199', speed: 3, up: 4 }); }
        this.t += dt; this.face(p.x, p.z, dt, 8);
        if (this.t >= 0.9) {
          const lead = 0.8;
          const tx = p.x + p.vx * lead, tz = p.z + p.vz * lead;
          const ty = g.grid.height(Math.floor(tx), Math.floor(tz));
          const ddx = tx - this.x, ddz = tz - this.z, l = Math.hypot(ddx, ddz) || 1;
          const T = Math.max(0.6, l / 14), sy = this.ry + 3.6;
          const tele = g.fx.telegraph({ shape: 'circle', x: tx, z: tz, y: ty, r: 2.6, t: T });
          const pr = g.combat.shoot({ x: this.x, y: sy, z: this.z, dx: ddx / l, dy: 0, dz: ddz / l, speed: l / T, team: 'none', kind: 'boulder', life: T, radius: 0, gravity: 0 });
          pr.vy = (ty - sy + 0.5 * 18 * T * T) / T; pr.gravity = 18;
          g.combat.after(T, () => {
            g.fx.release(tele);
            g.fx.burst(tx, ty + 0.4, tz, 26, { color: '#8e9199', speed: 7, up: 4 });
            g.cam.shake(0.35);
            g.bus.emit('sfx', { id: 'slam' });
            this.hurtIn(tx, tz, 2.6, 1.2, { knock: 7 });
          });
          this.state = 'approach'; this.cd = 1.8 * cdMul;
        }
        break;
      }
      case 'roar': {
        if (this.t === 0) this.roar(false);
        this.t += dt;
        if (this.t >= 1.2) { this.state = 'approach'; this.cd = 2 * cdMul; }
        break;
      }
      case 'charge': {
        if (this.t === 0) {
          this.cdx = dx / (dist || 1); this.cdz = dz / (dist || 1);
          this.yaw = Math.atan2(this.cdx, this.cdz);
          this.tele = g.fx.telegraph({ shape: 'line', x: this.x, z: this.z, y: this.ry, dx: this.cdx, dz: this.cdz, len: 24, width: 2.8, t: 1.0 });
          this.ran = 0; this.hitP = false;
          g.bus.emit('sfx', { id: 'roarShort' });
        }
        this.t += dt;
        if (this.t < 1.0) { this.anim.wind = this.t; break; }
        this.anim.wind = 0; this.anim.move = 1; this.anim.phase += dt * 30;
        const step = 17 * dt;
        const nx = this.x + this.cdx * step, nz = this.z + this.cdz * step;
        // Did he run into a pillar or wall?
        let crash = false;
        for (const [ox, oz] of [[0, 0], [this.cdx * this.radius, this.cdz * this.radius]]) {
          const i = Math.floor(nx + ox), j = Math.floor(nz + oz);
          if (!g.grid.inside(i, j) || g.grid.has(i, j, F.OBSTACLE | F.WALL) || g.grid.height(i, j) > this.y + 1.05) crash = true;
        }
        if (crash) {
          g.fx.burst(this.x + this.cdx, this.ry + 1.5, this.z + this.cdz, 30, { color: '#d8dde6', speed: 6 });
          g.cam.shake(0.7); g.hitStop(0.08);
          g.bus.emit('sfx', { id: 'boom' });
          this.statuses.apply('stun', { dur: 3.2 });
          this.stunnedBonus = true;
          g.combat.after(3.2, () => { this.stunnedBonus = false; });
          g.ui?.banner('Stunned!', 'He crashed into the pillar. Strike now!');
          this.state = 'approach'; this.cd = 3.4;
          break;
        }
        this.x = nx; this.z = nz; this.ran += step;
        if (!this.hitP && Math.hypot(p.x - this.x, p.z - this.z) < this.radius + 0.8) { this.hitP = true; g.combat.hurt(p, this.dmg * 1.8, this, { type: 'melee', knock: 12 }); }
        if (this.ran >= 24) { this.state = 'approach'; this.cd = 1.5; }
        break;
      }
      default: this.state = 'approach';
    }
  }
}
