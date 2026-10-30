// The Adamite King: a crystal blade; adamite pillars that corrupt the floor around them until they
// are broken; the shards of his crown flying at you in turn; and at the end the whole throne room
// corrupts, and only the braziers keep you clean.
import { Boss } from './base.js';
import { buildAdamiteKingRig } from '../../render/models.js';
import { BOSSES } from '../../data/bosses.js';
import { F, SURF } from '../../world/grid.js';

export class AdamiteKing extends Boss {
  constructor(game, level, arena) {
    super(game, BOSSES.adamite_king, level, arena, buildAdamiteKingRig());
    this.radius = 0.9; this.height = 3.2; this.scale = 1;
    this.speed = 3.2;
    this.pillarT = 3;
  }

  onPhase(i) {
    const g = this.g;
    if (i === 1) g.ui?.banner('Shattered Crown', 'Shards of his crown fly at you, one after another.');
    if (i === 2) {
      g.ui?.banner('Purple Tyranny', 'The whole throne room corrupts. Stand by a brazier to cleanse yourself.');
      this.corruptAround(this.arena.x, this.arena.z, this.arena.r + 6);
    }
  }
  onReset() { this.pillarT = 3; }

  corruptAround(x, z, r) {
    const grid = this.g.grid, braziers = this.g.zone.braziers || [];
    for (let j = Math.floor(z - r); j <= z + r; j++) for (let i = Math.floor(x - r); i <= x + r; i++) {
      if (!grid.walkable(i, j) || Math.hypot(i + 0.5 - x, j + 0.5 - z) > r) continue;
      if (braziers.some((b) => Math.hypot(b.x - i, b.z - j) < 2.5)) continue;
      grid.set(i, j, F.CORRUPT);
      grid.surf[grid.idx(i, j)] = SURF.ADAMITE;
    }
  }

  think(dt) {
    const g = this.g, p = g.player;
    const dx = p.x - this.x, dz = p.z - this.z, dist = Math.hypot(dx, dz);
    // His pillars keep the ground around them corrupted while they stand.
    this.pillarT -= dt;
    if (this.pillarT <= 0) {
      this.pillarT = 1;
      for (const e of g.enemies.list) if (e.alive && e.def.id === 'adamite_pillar') this.corruptAround(e.x, e.z, 2.5);
    }
    switch (this.state) {
      case 'idle':
      case 'approach': {
        this.state = 'approach';
        if (dist > 2.8) { this.move(dx, dz, this.speed * dt); this.anim.move = 1; this.anim.phase += this.speed * dt * 1.4; } else this.anim.move = 0;
        this.face(p.x, p.z, dt, 6);
        if (this.cd <= 0) {
          const opts = dist < 4 ? ['blade', 'blade', 'pillars'] : ['pillars', 'blade'];
          if (this.phase >= 1) opts.push('shards', 'shards');
          this.state = opts[Math.floor(Math.random() * opts.length)]; this.t = 0;
          if (this.state === 'pillars' && g.enemies.count((e) => e.def.id === 'adamite_pillar') >= 3) this.state = 'blade';
        }
        break;
      }
      case 'blade': {
        if (this.t === 0) { g.fx.slash(this.x, this.ry + 0.1, this.z, this.yaw, 4, 140, '#b46aff', 0.55); this.anim.wind = 0; }
        this.t += dt; this.anim.wind = Math.min(1, this.t / 0.55);
        if (this.t >= 0.55) {
          this.anim.wind = 0; this.play('slash', 0.3);
          for (const t of g.combat.arc(this.x, this.z, this.yaw, 4, 140, 'enemy')) g.combat.hurt(t, this.dmg * 1.2, this, { type: 'melee', knock: 6, status: [{ id: 'bleed', chance: 0.4 }] });
          g.bus.emit('sfx', { id: 'heavy' });
          this.state = 'approach'; this.cd = 1.4;
        }
        break;
      }
      case 'pillars': {
        if (this.t === 0) {
          this.play('overhead', 1.0);
          g.overlay.text(this.x, this.ry + 4.2, this.z, 'Kneel.', 'status');
          for (let k = 0; k < 2; k++) {
            const a = Math.random() * Math.PI * 2, r = 4 + Math.random() * (this.arena.r - 5);
            const x = Math.floor(this.arena.x + Math.cos(a) * r) + 0.5, z = Math.floor(this.arena.z + Math.sin(a) * r) + 0.5;
            if (g.grid.walkable(Math.floor(x), Math.floor(z))) g.enemies.spawn('adamite_pillar', x, z, { level: this.level - 2, summoned: true });
          }
        }
        this.t += dt;
        if (this.t >= 1.0) { this.state = 'approach'; this.cd = 1.6; }
        break;
      }
      case 'shards': {
        // The crown's shards, one after another.
        if (this.t === 0) { this.shots = 0; this.play('cast', 1.6); }
        this.t += dt;
        if (this.t >= 0.3 * (this.shots + 1) && this.shots < 5) {
          this.shots++;
          const a = Math.atan2(dx, dz) + (Math.random() - 0.5) * 0.2;
          g.combat.shoot({ x: this.x, y: this.ry + 3.2, z: this.z, dx: Math.sin(a), dy: (p.ry + 1 - this.ry - 3.2) / (dist || 1), dz: Math.cos(a), speed: 17, team: 'enemy', kind: 'shard', radius: 0.45, life: 2,
            onHit: (t) => g.combat.hurt(t, this.dmg * 0.4, this, { type: 'ranged' }) });
          g.bus.emit('sfx', { id: 'enemyShoot', x: this.x, z: this.z });
        }
        if (this.t >= 1.8) { this.state = 'approach'; this.cd = 1.5; }
        break;
      }
      default: this.state = 'approach';
    }
  }
}
