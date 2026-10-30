// Tears of Poseidon: three weeping spirits fought as one. While all three live the temple floods
// (stand on the raised stones); then whirlpools drag you in; the last Tear sends waves across the floor.
import { Boss } from './base.js';
import { buildTearRig } from '../../render/models.js';
import { BOSSES } from '../../data/bosses.js';
import { moveCircle } from '../../world/physics.js';

export class Tears extends Boss {
  constructor(game, level, arena, opts = {}) {
    const k = opts.index || 0;
    super(game, BOSSES.tears_of_poseidon, level, arena, buildTearRig(k), opts.group);
    this.radius = 0.7; this.height = 2.4; this.scale = 1;
    this.speed = 3.2;
    this.index = k;
    const a = (k / 3) * Math.PI * 2;
    this.home = { x: arena.x + Math.cos(a) * 5, z: arena.z + Math.sin(a) * 5 };
    this.x = this.home.x; this.z = this.home.z;
    this.yOff = 0.6;
    this.floodT = 9; this.waveT = 6;
    // The first Tear brings her sisters.
    if (!opts.group) for (let n = 1; n < (BOSSES.tears_of_poseidon.members || 3); n++) game.enemies.addBoss(new Tears(game, level, arena, { index: n, group: this.group }));
  }

  // Group-wide effects run on one Tear only: the first still standing.
  get lead() { return this.group.members.find((m) => m.alive) === this; }

  onPhase(i) {
    if (!this.lead) return;
    const g = this.g;
    if (i === 1) g.ui?.banner('Undertow', 'Whirlpools open under your feet and drag you toward their hearts.');
    if (i === 2) g.ui?.banner('The Last Tear', 'Waves sweep the temple. Jump the low ones, run from the rest.');
  }
  // A reset heals the Tears still standing; fallen sisters stay fallen.
  onReset() { this.x = this.home.x; this.z = this.home.z; this.floodT = 9; this.waveT = 6; }

  think(dt) {
    const g = this.g, p = g.player;
    const dx = p.x - this.x, dz = p.z - this.z, dist = Math.hypot(dx, dz) || 1;
    this.yOff = 0.6 + Math.sin(g.time * 2 + this.index) * 0.2;
    // Keep a weeping distance, circling the player.
    const want = 6.5, side = this.index % 2 ? 1 : -1;
    let mx = 0, mz = 0;
    if (dist > want + 1) { mx = dx; mz = dz; } else if (dist < want - 1) { mx = -dx; mz = -dz; } else { mx = -dz * side; mz = dx * side; }
    const inside = Math.hypot(this.x + mx * 0.1 - this.arena.x, this.z + mz * 0.1 - this.arena.z) < this.arena.r - 1;
    if (inside) { this.move(mx, mz, this.speed * dt); this.anim.move = 1; }
    this.face(p.x, p.z, dt, 6);
    // Water orbs.
    if (this.cd <= 0) {
      this.cd = 2.2 + this.index * 0.4;
      this.play('cast', 0.4);
      g.combat.shoot({ x: this.x, y: this.ry + 1.6, z: this.z, dx: dx / dist, dy: (p.ry + 1 - this.ry - 1.6) / dist, dz: dz / dist, speed: 13, team: 'enemy', kind: 'glob', radius: 0.45, life: 2.2,
        onHit: (t) => g.combat.hurt(t, this.dmg * 0.7, this, { type: 'ranged', status: [{ id: 'slow', chance: 0.6 }] }) });
      g.bus.emit('sfx', { id: 'enemyShoot', x: this.x, z: this.z });
    }
    if (!this.lead) return;
    const alive = this.group.members.filter((m) => m.alive).length;
    // Weeping: while all three live, the temple floods. Only the raised stones stay dry.
    if (alive === 3) {
      this.floodT -= dt;
      if (this.floodT <= 0) {
        this.floodT = 10;
        const a = this.arena;
        g.fx.telegraph({ shape: 'circle', x: a.x, z: a.z, y: a.h, r: a.r, t: 2.2, color: '#5fc8f0' });
        g.ui?.banner('The temple floods!', 'Climb onto a raised stone.');
        g.combat.after(2.2, () => {
          g.fx.burst(a.x, a.h + 0.5, a.z, 40, { color: '#7fe0ff', speed: 9, up: 3 });
          g.bus.emit('sfx', { id: 'splash' });
          if (Math.hypot(p.x - a.x, p.z - a.z) < a.r && p.ry < a.h + 1.5) g.combat.hurt(p, this.dmg * 1.6, this, { type: 'aoe', status: [{ id: 'slow', dur: 3 }] });
        });
      }
    }
    // Undertow: whirlpools that pull you toward their hearts.
    if (this.phase >= 1) {
      this.waveT -= dt;
      if (this.waveT <= 0) {
        this.waveT = this.phase >= 2 ? 5 : 7;
        if (this.phase >= 2) this.waves(); else this.whirlpool(p.x, p.z);
      }
    }
  }

  whirlpool(x, z) {
    const g = this.g, p = g.player, y = this.arena.h;
    g.fx.telegraph({ shape: 'circle', x, z, y, r: 3, t: 0.8, color: '#3a8ac8' });
    g.combat.after(0.8, () => g.combat.zone({ x, z, y, r: 3, t: 3.5, interval: 0.25, team: 'enemy', color: '#3a8ac8',
      onTick: (ts) => {
        for (const t of ts) {
          if (t === p && !p.carried) { const dx = x - p.x, dz = z - p.z, l = Math.hypot(dx, dz) || 1; if (l > 0.4) moveCircle(g.grid, p, (dx / l) * 0.45, (dz / l) * 0.45, p.radius, 1.05); }
          g.combat.hurt(t, this.dmg * 0.15, this, { type: 'hazard' });
        }
      } }));
  }

  // The last Tear: three waves sweep the temple floor in a row.
  waves() {
    const g = this.g, a = this.arena;
    const ang = Math.random() * Math.PI * 2, dx = Math.cos(ang), dz = Math.sin(ang);
    for (let k = -1; k <= 1; k++) {
      const ox = a.x - dx * a.r + -dz * k * 4.5, oz = a.z - dz * a.r + dx * k * 4.5;
      g.fx.telegraph({ shape: 'line', x: ox, z: oz, y: a.h, dx, dz, len: a.r * 2, width: 3, t: 1.2 + Math.abs(k) * 0.3, color: '#7fe0ff' });
      g.combat.after(1.2 + Math.abs(k) * 0.3, () => {
        g.fx.burst(ox + dx * a.r, a.h + 0.6, oz + dz * a.r, 20, { color: '#9fe8ff', speed: 6, up: 2 });
        for (const t of g.combat.line(ox, oz, dx, dz, a.r * 2, 3, 'enemy')) if (t.ry < a.h + 1.2) g.combat.hurt(t, this.dmg * 1.1, this, { type: 'aoe', knock: 7 });
      });
    }
    g.bus.emit('sfx', { id: 'splash' });
  }
}
