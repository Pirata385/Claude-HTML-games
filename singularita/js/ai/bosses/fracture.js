// The Fracture: the remembering left behind when the crown broke Vael. It wears the shapes of the
// world in turn. Vael: it bounces like the Slime Prince and calls the Echoes. The Four Sigils: wind,
// tide, flame and stone, eight seconds each. The Five Shards: the rulers' moves, one after another.
// Singular: it pulls you in and bursts, and the edge of the Unmade burns away.
import { Boss } from './base.js';
import { buildFractureRig } from '../../render/models.js';
import { BOSSES } from '../../data/bosses.js';
import { moveCircle } from '../../world/physics.js';

const SIGILS = [
  { id: 'wind', name: 'Wind', color: '#cfe8ff' },
  { id: 'tide', name: 'Tide', color: '#5fb0ff' },
  { id: 'flame', name: 'Flame', color: '#ff7a3d' },
  { id: 'stone', name: 'Stone', color: '#8ad06a' },
];
const SHARDS = ['hook', 'gel', 'crown', 'reflection', 'breath'];

export class Fracture extends Boss {
  constructor(game, level, arena) {
    super(game, BOSSES.fracture, level, arena, buildFractureRig());
    this.radius = 1.0; this.height = 4.4; this.scale = 1;
    this.speed = 3.4;
    this.sigil = 0; this.sigilT = 8;
    this.shard = 0;
    this.echoT = 6;
    this.ringR = arena.r + 1;
  }

  onPhase(i) {
    const g = this.g;
    const names = ['', 'The Four Sigils', 'The Five Shards', 'Singular'];
    const say = ['', 'Wind, Tide, Flame and Stone, each in turn. Read the sky.', 'It borrows the rulers: hook, gel, crown, reflection, breath.', 'It pulls everything in. Dash out before it bursts; the edge is burning away.'];
    if (i > 0) g.ui?.banner(names[i], say[i]);
    if (i === 1) { this.sigil = 0; this.sigilT = 8; this.announceSigil(); }
  }
  onReset() { this.ringR = this.arena.r + 1; this.sigil = 0; this.sigilT = 8; this.shard = 0; this.echoT = 6; this.pullT = 0; }

  announceSigil() {
    const s = SIGILS[this.sigil];
    this.g.overlay.text(this.x, this.ry + 5.4, this.z, s.name, 'status');
    this.g.fx.column(this.x, this.ry, this.z, s.color, 24, 1);
  }

  think(dt) {
    const g = this.g, p = g.player;
    const dx = p.x - this.x, dz = p.z - this.z, dist = Math.hypot(dx, dz) || 1;
    if (this.rig.orbit) this.rig.orbit.rotation.y += dt * (0.6 + this.phase * 0.35);
    if (this.phase === 0) this.vael(dt);
    if (this.phase === 1) {
      this.sigilT -= dt;
      if (this.sigilT <= 0) { this.sigilT = 8; this.sigil = (this.sigil + 1) % SIGILS.length; this.announceSigil(); }
    }
    if (this.phase >= 3) this.singular(dt);
    // A pull in progress drags you toward it.
    if (this.pullT > 0) {
      this.pullT -= dt;
      const l = Math.hypot(this.x - p.x, this.z - p.z);
      if (l > 2.4 && p.dodgeT <= 0) moveCircle(g.grid, p, ((this.x - p.x) / l) * 6.5 * dt, ((this.z - p.z) / l) * 6.5 * dt, p.radius, 1.05);
    }
    switch (this.state) {
      case 'idle':
      case 'approach': {
        this.state = 'approach';
        if (dist > 4.5) { this.move(dx, dz, this.speed * dt); this.anim.move = 1; this.anim.phase += this.speed * dt * 1.2; } else this.anim.move = 0;
        this.face(p.x, p.z, dt, 5);
        if (this.cd > 0) break;
        this.t = 0;
        if (dist < 5 && Math.random() < 0.4) this.state = 'swipe';
        else if (this.phase === 0) this.state = 'bounce';
        else if (this.phase === 1) this.state = SIGILS[this.sigil].id;
        else if (this.phase === 2) { this.state = SHARDS[this.shard]; this.shard = (this.shard + 1) % SHARDS.length; }
        else this.state = Math.random() < 0.5 ? 'pull' : 'breath';
        break;
      }
      case 'swipe': this.swipe(dt); break;
      case 'bounce': this.bounce(dt); break;
      case 'wind': this.wind(dt); break;
      case 'tide': this.tide(dt); break;
      case 'flame': this.flame(dt); break;
      case 'stone': this.stone(dt); break;
      case 'hook': this.hook(dt); break;
      case 'gel': this.gel(dt); break;
      case 'crown': this.crown(dt); break;
      case 'reflection': this.reflect(dt); break;
      case 'breath': this.breath(dt); break;
      case 'pull': this.pull(dt); break;
      default: this.state = 'approach';
    }
  }

  done(cd) { this.state = 'approach'; this.cd = cd; this.t = 0; }

  // ------------------------------------------------------------------ shared
  swipe(dt) {
    const g = this.g;
    if (this.t === 0) { g.fx.slash(this.x, this.ry + 0.1, this.z, this.yaw, 4.5, 130, '#f4e8ff', 0.55); this.play('slash', 0.55); }
    this.t += dt;
    if (this.t >= 0.55) {
      for (const t of g.combat.arc(this.x, this.z, this.yaw, 4.5, 130, 'enemy')) g.combat.hurt(t, this.dmg * 1.1, this, { type: 'melee', knock: 6 });
      g.bus.emit('sfx', { id: 'heavy' });
      this.done(1.2);
    }
  }

  // ------------------------------------------------------------------ Vael
  vael(dt) {
    // By night's shape it calls the Echoes, a few at a time.
    const g = this.g;
    this.echoT -= dt;
    if (this.echoT <= 0) {
      this.echoT = 14;
      if (g.enemies.count((e) => e.summoned && !e.boss) < 3) {
        for (let k = 0; k < 2; k++) {
          const a = Math.random() * Math.PI * 2;
          g.enemies.spawn(k ? 'zombie_brute' : 'zombie_walker', this.arena.x + Math.cos(a) * (this.arena.r - 3), this.arena.z + Math.sin(a) * (this.arena.r - 3), { minion: true, level: this.level - 8, summoned: true });
        }
        g.overlay.text(this.x, this.ry + 5, this.z, 'Night falls on Vael', 'status');
      }
    }
  }
  bounce(dt) {
    // The Slime Prince's leap: it lands where a ring shows, and the ground ripples out.
    const g = this.g, p = g.player;
    if (this.t === 0) { this.tx = p.x; this.tz = p.z; this.sx = this.x; this.sz = this.z; g.fx.telegraph({ shape: 'circle', x: this.tx, z: this.tz, y: this.arena.h, r: 3.6, t: 1.0, color: '#ffd166' }); this.play('overhead', 1.0); }
    this.t += dt;
    const k = Math.min(1, this.t / 1.0);
    this.x = this.sx + (this.tx - this.sx) * k; this.z = this.sz + (this.tz - this.sz) * k;
    this.yOff = Math.sin(k * Math.PI) * 4;
    if (this.t >= 1.0) {
      this.yOff = 0;
      g.fx.burst(this.x, this.ry + 0.3, this.z, 30, { color: '#ffd166', speed: 7, up: 3 });
      g.cam.shake(0.5); g.bus.emit('sfx', { id: 'slam' });
      this.hurtIn(this.x, this.z, 3.6, 1.2, { knock: 7 });
      g.fx.decal({ shape: 'ring', x: this.x, z: this.z, y: this.arena.h, r: 7, t: 0.7, fill: true, color: '#ffd166' });
      const x = this.x, z = this.z;
      g.combat.after(0.7, () => { for (const t of g.combat.circle(x, z, 7, 'enemy')) if (Math.hypot(t.x - x, t.z - z) > 3.6 && t.grounded !== false) g.combat.hurt(t, this.dmg * 0.6, this, { type: 'aoe' }); });
      this.done(1.6);
    }
  }

  // ------------------------------------------------------------------ the Four Sigils
  wind(dt) {
    // Two gusts across the arena, through where you stand: they push hard.
    const g = this.g, p = g.player, a = this.arena;
    if (this.t === 0) {
      this.gusts = [0, 1].map((k) => { const ang = Math.random() * Math.PI * 2, ux = Math.cos(ang), uz = Math.sin(ang), off = k ? 3.5 : 0; return { ox: p.x - ux * (a.r + 4) - uz * off, oz: p.z - uz * (a.r + 4) + ux * off, ux, uz }; });
      for (const s of this.gusts) g.fx.telegraph({ shape: 'line', x: s.ox, z: s.oz, y: a.h, dx: s.ux, dz: s.uz, len: (a.r + 4) * 2, width: 3, t: 1.0, color: '#cfe8ff' });
      this.play('cast', 1.0);
    }
    this.t += dt;
    if (this.t >= 1.0) {
      for (const s of this.gusts) for (const t of g.combat.line(s.ox, s.oz, s.ux, s.uz, (a.r + 4) * 2, 3, 'enemy')) {
        g.combat.hurt(t, this.dmg * 0.6, this, { type: 'aoe' });
        if (t === p) p.knock(s.ux, s.uz, 14);
      }
      g.bus.emit('sfx', { id: 'dash' });
      this.done(1.4);
    }
  }
  tide(dt) {
    // Three swells rise around you; standing in one slows you and hurts.
    const g = this.g, p = g.player, a = this.arena;
    if (this.t === 0) {
      this.spots = [0, 1, 2].map((k) => (k ? { x: p.x + (Math.random() - 0.5) * 8, z: p.z + (Math.random() - 0.5) * 8 } : { x: p.x, z: p.z }));
      for (const s of this.spots) g.fx.telegraph({ shape: 'circle', x: s.x, z: s.z, y: a.h, r: 3, t: 1.1, color: '#5fb0ff' });
      this.play('cast', 1.1);
    }
    this.t += dt;
    if (this.t >= 1.1) {
      for (const s of this.spots) { g.fx.burst(s.x, a.h + 0.4, s.z, 16, { color: '#5fb0ff', speed: 5, up: 4 }); for (const t of g.combat.circle(s.x, s.z, 3, 'enemy')) g.combat.hurt(t, this.dmg * 0.7, this, { type: 'aoe', status: [{ id: 'slow', dur: 2 }] }); }
      g.bus.emit('sfx', { id: 'slimeLand' });
      this.done(1.3);
    }
  }
  flame(dt) {
    // Burning ground where you stand and around: it stays a while.
    const g = this.g, p = g.player, a = this.arena;
    if (this.t === 0) {
      this.spots = [0, 1, 2, 3].map((k) => (k ? { x: p.x + (Math.random() - 0.5) * 10, z: p.z + (Math.random() - 0.5) * 10 } : { x: p.x, z: p.z }));
      for (const s of this.spots) g.fx.telegraph({ shape: 'circle', x: s.x, z: s.z, y: a.h, r: 1.8, t: 0.9, color: '#ff7a3d' });
      this.play('cast', 0.9);
    }
    this.t += dt;
    if (this.t >= 0.9) {
      for (const s of this.spots) g.combat.zone({ x: s.x, z: s.z, y: a.h, r: 1.8, t: 6, interval: 0.5, team: 'enemy', color: '#ff5a1a',
        onTick: (ts) => { for (const t of ts) g.combat.hurt(t, this.dmg * 0.15, this, { type: 'hazard', status: [{ id: 'burn', chance: 0.4 }] }); } });
      g.bus.emit('sfx', { id: 'fire' });
      this.done(1.2);
    }
  }
  stone(dt) {
    // Rock falls from nowhere: five shadows, then the stones.
    const g = this.g, p = g.player, a = this.arena;
    if (this.t === 0) {
      this.spots = [0, 1, 2, 3, 4].map((k) => (k ? { x: p.x + (Math.random() - 0.5) * 12, z: p.z + (Math.random() - 0.5) * 12 } : { x: p.x, z: p.z }));
      for (const s of this.spots) g.fx.telegraph({ shape: 'circle', x: s.x, z: s.z, y: a.h, r: 1.5, t: 1.0, color: '#8ad06a' });
      this.play('overhead', 1.0);
    }
    this.t += dt;
    if (this.t >= 1.0) {
      for (const s of this.spots) { g.fx.burst(s.x, a.h + 0.3, s.z, 14, { color: '#7a6a50', speed: 5, up: 3 }); for (const t of g.combat.circle(s.x, s.z, 1.5, 'enemy')) g.combat.hurt(t, this.dmg * 0.9, this, { type: 'aoe', status: [{ id: 'stun', dur: 0.5 }] }); }
      g.cam.shake(0.35); g.bus.emit('sfx', { id: 'rockfall' });
      this.done(1.3);
    }
  }

  // ------------------------------------------------------------------ the Five Shards
  hook(dt) {
    // The Jailer's chain: a line, then you are dragged to its feet.
    const g = this.g, p = g.player;
    if (this.t === 0) {
      const l = Math.hypot(p.x - this.x, p.z - this.z) || 1;
      this.hx = (p.x - this.x) / l; this.hz = (p.z - this.z) / l;
      g.fx.telegraph({ shape: 'line', x: this.x, z: this.z, y: this.ry, dx: this.hx, dz: this.hz, len: 16, width: 1.6, t: 0.8, color: '#b8b8c8' });
      this.play('thrust', 0.8);
    }
    this.t += dt;
    if (this.t >= 0.8 && !this.hooked) {
      this.hooked = true;
      g.fx.beam(this.x, this.ry + 2, this.z, this.x + this.hx * 16, this.ry + 1, this.z + this.hz * 16, '#b8b8c8', 0.3);
      if (g.combat.line(this.x, this.z, this.hx, this.hz, 16, 1.6, 'enemy').includes(p)) { g.combat.hurt(p, this.dmg * 0.6, this, { type: 'ranged', status: [{ id: 'stun', dur: 0.5 }] }); this.pullT = 0.5; }
    }
    if (this.t >= 1.3) { this.hooked = false; this.done(1.2); }
  }
  gel(dt) {
    // The Siamese gel: globs where you stand and where you are heading.
    const g = this.g, p = g.player, a = this.arena;
    if (this.t === 0) {
      this.spots = [{ x: p.x, z: p.z }, { x: p.x + p.vx * 1.1, z: p.z + p.vz * 1.1 }, { x: p.x + (Math.random() - 0.5) * 6, z: p.z + (Math.random() - 0.5) * 6 }];
      for (const s of this.spots) g.fx.telegraph({ shape: 'circle', x: s.x, z: s.z, y: a.h, r: 1.7, t: 1.1, color: '#ff8ab0' });
      this.play('cast', 1.1);
    }
    this.t += dt;
    if (this.t >= 1.1) {
      this.spots.forEach((s, k) => { g.fx.burst(s.x, a.h + 0.4, s.z, 14, { color: k % 2 ? '#7ab8ff' : '#ff7a5a', speed: 5, up: 3 }); for (const t of g.combat.circle(s.x, s.z, 1.7, 'enemy')) g.combat.hurt(t, this.dmg * 0.6, this, { type: 'aoe', status: [{ id: k % 2 ? 'chill' : 'burn', chance: 0.6 }] }); });
      this.done(1.2);
    }
  }
  crown(dt) {
    // The crown's shards, one after another.
    const g = this.g, p = g.player;
    if (this.t === 0) { this.shots = 0; this.play('cast', 1.6); }
    this.t += dt;
    if (this.t >= 0.3 * (this.shots + 1) && this.shots < 5) {
      this.shots++;
      const l = Math.hypot(p.x - this.x, p.z - this.z) || 1, a = Math.atan2(p.x - this.x, p.z - this.z) + (Math.random() - 0.5) * 0.2;
      g.combat.shoot({ x: this.x, y: this.ry + 3.6, z: this.z, dx: Math.sin(a), dy: (p.ry + 1 - this.ry - 3.6) / l, dz: Math.cos(a), speed: 17, team: 'enemy', kind: 'shard', radius: 0.45, life: 2,
        onHit: (t) => g.combat.hurt(t, this.dmg * 0.4, this, { type: 'ranged' }) });
      g.bus.emit('sfx', { id: 'enemyShoot', x: this.x, z: this.z });
    }
    if (this.t >= 1.8) this.done(1.3);
  }
  reflect(dt) {
    // The Mirrored: a reflection steps out of the glass beside you.
    const g = this.g, p = g.player;
    if (this.t === 0) {
      if (g.enemies.count((e) => e.summoned && e.def.id === 'reflection') < 2) {
        const a = Math.random() * Math.PI * 2;
        g.enemies.spawn('reflection', p.x + Math.cos(a) * 4, p.z + Math.sin(a) * 4, { minion: true, level: this.level - 6, summoned: true });
        g.overlay.text(p.x, p.ry + 2.6, p.z, 'You?', 'status');
      }
      this.play('cast', 0.6);
    }
    this.t += dt;
    if (this.t >= 0.6) this.done(1.0);
  }
  breath(dt) {
    // The Dragon God's breath: a burning line across the arena, through where you stand.
    const g = this.g, p = g.player, a = this.arena;
    if (this.t === 0) {
      const ang = Math.random() * Math.PI * 2;
      this.ux = Math.cos(ang); this.uz = Math.sin(ang);
      this.ox = p.x - this.ux * (a.r + 4); this.oz = p.z - this.uz * (a.r + 4);
      g.fx.telegraph({ shape: 'line', x: this.ox, z: this.oz, y: a.h, dx: this.ux, dz: this.uz, len: (a.r + 4) * 2, width: 3.6, t: 1.2, color: '#ff5a1a' });
      this.play('cast', 1.2);
    }
    this.t += dt;
    if (this.t >= 1.2) {
      const len = (a.r + 4) * 2;
      for (let d = 0; d < len; d += 2) g.fx.burst(this.ox + this.ux * d, a.h + 0.8, this.oz + this.uz * d, 3, { color: d % 4 ? '#ff8a3d' : '#ffd166', speed: 3, up: 3, life: 0.6 });
      g.bus.emit('sfx', { id: 'roar' });
      for (const t of g.combat.line(this.ox, this.oz, this.ux, this.uz, len, 3.6, 'enemy')) g.combat.hurt(t, this.dmg * 1.1, this, { type: 'aoe', status: [{ id: 'burn' }] });
      this.done(1.4);
    }
  }

  // ------------------------------------------------------------------ Singular
  pull(dt) {
    // Everything is drawn in; a ring shows the burst. Dash out of it in time.
    const g = this.g;
    if (this.t === 0) {
      this.pullT = 1.4;
      g.fx.telegraph({ shape: 'circle', x: this.x, z: this.z, y: this.ry, r: 4.5, t: 1.6, color: '#f4e8ff', follow: this });
      g.overlay.text(this.x, this.ry + 5, this.z, 'Collapse', 'status');
      this.play('overhead', 1.6);
    }
    this.t += dt;
    if (this.t >= 1.6) {
      g.fx.burst(this.x, this.ry + 1.5, this.z, 40, { color: '#f4e8ff', speed: 9, up: 3 });
      g.fx.burst(this.x, this.ry + 1.5, this.z, 20, { color: '#ff7ad8', speed: 5, up: 4 });
      g.cam.shake(0.6); g.bus.emit('sfx', { id: 'boom' });
      this.hurtIn(this.x, this.z, 4.5, 1.4, { knock: 9 });
      this.done(1.6);
    }
  }
  singular(dt) {
    // The edge of the Unmade burns inward to a last small circle.
    const g = this.g, p = g.player, a = this.arena;
    this.ringT = (this.ringT || 0) - dt;
    if (this.ringT > 0) return;
    this.ringT = 1;
    this.ringR = Math.max(7, this.ringR - 0.45);
    if (Math.hypot(p.x - a.x, p.z - a.z) > this.ringR) g.combat.hurt(p, this.dmg * 0.3, this, { type: 'hazard' });
    for (let k = 0; k < 14; k++) { const t = (k / 14) * Math.PI * 2; g.fx.burst(a.x + Math.cos(t) * this.ringR, a.h + 0.3, a.z + Math.sin(t) * this.ringR, 2, { color: '#c890e0', speed: 1, up: 3, life: 0.8 }); }
  }
}
