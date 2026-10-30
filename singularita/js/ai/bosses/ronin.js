// The Ronin of the East Wind: iai dashes along a shown line, crescents of wind, a counter stance
// that punishes careless strikes, then Gale Steps (he blinks around you) and the Eastwind Storm.
import { Boss } from './base.js';
import { buildRoninRig } from '../../render/models.js';
import { BOSSES } from '../../data/bosses.js';

export class Ronin extends Boss {
  constructor(game, level, arena) {
    super(game, BOSSES.ronin_east_wind, level, arena, buildRoninRig());
    this.radius = 0.7; this.height = 2.4; this.scale = 1;
    this.speed = 4.6;
    this.storm = false;
  }

  onPhase(i) {
    const g = this.g;
    if (i === 1) g.ui?.banner('Gale Steps', 'He flickers around you before he strikes. Watch where he lands.');
    if (i === 2) { this.storm = true; this.speed = 5.6; g.ui?.banner('Eastwind Storm', 'Tornadoes sweep the summit. Keep moving.'); }
  }
  onReset() { this.storm = false; this.speed = 4.6; this.stance = null; }

  pick() {
    const p = this.g.player, d = Math.hypot(p.x - this.x, p.z - this.z);
    const opts = ['iai', 'crescent', 'counter'];
    if (d < 4) opts.push('slash', 'slash');
    if (this.phase >= 1) opts.push('blink', 'blink');
    if (this.storm) opts.push('tornado');
    let s = opts[Math.floor(Math.random() * opts.length)];
    if (s === this.last && s !== 'slash') s = 'slash';
    this.last = s;
    return s;
  }

  think(dt) {
    const g = this.g, p = g.player;
    const cdMul = this.storm ? 0.7 : 1;
    const dx = p.x - this.x, dz = p.z - this.z, dist = Math.hypot(dx, dz);
    switch (this.state) {
      case 'idle':
      case 'approach': {
        this.state = 'approach';
        if (dist > 3) { this.move(dx, dz, this.speed * dt); this.anim.move = 1; this.anim.phase += this.speed * dt * 1.6; } else this.anim.move = 0;
        this.face(p.x, p.z, dt, 8);
        if (this.cd <= 0) { this.state = dist < 3.2 && Math.random() < 0.5 ? 'slash' : this.pick(); this.t = 0; }
        break;
      }
      case 'slash': {
        if (this.t === 0) { g.fx.slash(this.x, this.ry + 0.1, this.z, this.yaw, 3.4, 130, '#cfe8ff', 0.45); this.anim.wind = 0; }
        this.t += dt; this.anim.wind = Math.min(1, this.t / 0.45);
        if (this.t >= 0.45) {
          this.anim.wind = 0; this.play('slash', 0.25);
          for (const t of g.combat.arc(this.x, this.z, this.yaw, 3.4, 130, 'enemy')) g.combat.hurt(t, this.dmg, this, { type: 'melee', knock: 5 });
          g.bus.emit('sfx', { id: 'heavy' });
          this.state = 'approach'; this.cd = 1.1 * cdMul;
        }
        break;
      }
      case 'iai': {
        // The line is shown first; then he is simply at its end, and everything on it is cut.
        if (this.t === 0) {
          this.ldx = dx / (dist || 1); this.ldz = dz / (dist || 1);
          this.yaw = Math.atan2(this.ldx, this.ldz);
          this.len = Math.min(14, dist + 5);
          g.fx.telegraph({ shape: 'line', x: this.x, z: this.z, y: this.ry, dx: this.ldx, dz: this.ldz, len: this.len, width: 2, t: 0.85, color: '#cfe8ff' });
          this.anim.wind = 1;
        }
        this.t += dt;
        if (this.t >= 0.85) {
          const x0 = this.x, z0 = this.z;
          for (const t of g.combat.line(x0, z0, this.ldx, this.ldz, this.len, 2, 'enemy')) g.combat.hurt(t, this.dmg * 1.5, this, { type: 'melee', knock: 6, status: [{ id: 'bleed', chance: 0.5 }] });
          this.move(this.ldx, this.ldz, this.len);
          g.fx.beam(x0, this.ry + 1.2, z0, this.x, this.ry + 1.2, this.z, '#e8f6ff', 0.25);
          g.bus.emit('sfx', { id: 'dash' });
          this.anim.wind = 0; this.play('slash', 0.25);
          this.state = 'approach'; this.cd = 1.6 * cdMul;
        }
        break;
      }
      case 'crescent': {
        if (this.t === 0) { this.play('slash2', 0.5); this.face(p.x, p.z, 1, 20); }
        this.t += dt;
        if (this.t >= 0.5) {
          for (const off of [-0.3, 0, 0.3]) {
            const a = Math.atan2(dx, dz) + off;
            g.combat.shoot({ x: this.x, y: this.ry + 1.2, z: this.z, dx: Math.sin(a), dy: 0, dz: Math.cos(a), speed: 15, team: 'enemy', kind: 'shard', radius: 0.6, life: 1.6,
              onHit: (t) => g.combat.hurt(t, this.dmg * 0.8, this, { type: 'ranged', knock: 4 }) });
          }
          g.bus.emit('sfx', { id: 'gust' });
          this.state = 'approach'; this.cd = 1.4 * cdMul;
        }
        break;
      }
      case 'counter': {
        // Blue stance: strike him now and he answers with a cut of his own.
        if (this.t === 0) {
          this.stance = { hp: this.hp };
          this.ring = g.fx.decal({ shape: 'ring', x: this.x, z: this.z, y: this.ry, r: 1.6, t: 1.6, fill: false, color: '#5fb0ff', follow: this });
          g.overlay.text(this.x, this.ry + 3.2, this.z, 'Counter stance', 'status');
          this.anim.wind = 0.4;
        }
        this.t += dt;
        this.face(p.x, p.z, dt, 6);
        if (this.hp < this.stance.hp) {
          g.fx.release(this.ring);
          g.fx.burst(this.x, this.ry + 1.4, this.z, 20, { color: '#5fb0ff', speed: 6 });
          const a = Math.atan2(dx, dz);
          const bx = p.x + Math.sin(a) * 1.4, bz = p.z + Math.cos(a) * 1.4;
          if (g.grid.walkable(Math.floor(bx), Math.floor(bz))) { this.x = bx; this.z = bz; }
          this.face(p.x, p.z, 1, 30);
          g.combat.hurt(p, this.dmg * 1.4, this, { type: 'melee', knock: 6 });
          this.play('slash', 0.25); g.bus.emit('sfx', { id: 'parry' });
          this.stance = null; this.anim.wind = 0;
          this.state = 'approach'; this.cd = 1.2;
        } else if (this.t >= 1.6) { this.stance = null; this.anim.wind = 0; this.state = 'approach'; this.cd = 0.6; }
        break;
      }
      case 'blink': {
        // Three flickers around you, then the strike from the last one.
        if (this.t === 0) this.blinks = 0;
        this.t += dt;
        if (this.t >= 0.35 * (this.blinks + 1) && this.blinks < 3) {
          this.blinks++;
          g.fx.burst(this.x, this.ry + 1.2, this.z, 10, { color: '#e8f6ff', speed: 4 });
          const a = Math.random() * Math.PI * 2;
          const tx = p.x + Math.cos(a) * 3, tz = p.z + Math.sin(a) * 3;
          if (g.grid.walkable(Math.floor(tx), Math.floor(tz)) && Math.hypot(tx - this.arena.x, tz - this.arena.z) < this.arena.r) { this.x = tx; this.z = tz; }
          this.face(p.x, p.z, 1, 30);
          g.bus.emit('sfx', { id: 'blink' });
          if (this.blinks === 3) g.fx.slash(this.x, this.ry + 0.1, this.z, this.yaw, 3.4, 140, '#cfe8ff', 0.35);
        }
        if (this.t >= 1.4) {
          for (const t of g.combat.arc(this.x, this.z, this.yaw, 3.4, 140, 'enemy')) g.combat.hurt(t, this.dmg * 1.2, this, { type: 'melee', knock: 6 });
          this.play('slash', 0.25); g.bus.emit('sfx', { id: 'heavy' });
          this.state = 'approach'; this.cd = 1.3 * cdMul;
        }
        break;
      }
      case 'tornado': {
        if (this.t === 0) {
          this.play('spin', 0.8);
          for (let k = 0; k < 3; k++) {
            const a = Math.random() * Math.PI * 2, r = Math.random() * (this.arena.r - 3);
            const x = this.arena.x + Math.cos(a) * r, z = this.arena.z + Math.sin(a) * r;
            g.fx.telegraph({ shape: 'circle', x, z, y: this.arena.h, r: 2.2, t: 0.8, color: '#e8f6ff' });
            g.combat.after(0.8, () => g.combat.zone({ x, z, y: this.arena.h, r: 2.2, t: 5, interval: 0.4, team: 'enemy', color: '#e8f6ff',
              onTick: (ts, zn) => { g.fx.burst(zn.x, this.arena.h + 0.5, zn.z, 3, { color: '#ffffff', speed: 3, up: 4, life: 0.6 }); for (const t of ts) g.combat.hurt(t, this.dmg * 0.25, this, { type: 'hazard', knock: 5 }); } }));
          }
          g.bus.emit('sfx', { id: 'gust' });
        }
        this.t += dt;
        if (this.t >= 0.8) { this.state = 'approach'; this.cd = 1.0; }
        break;
      }
      default: this.state = 'approach';
    }
  }
}
