// Mage: crowd control. Bolts that burst over a pack, fire that throws foes back, frost that freezes
// them, lightning that stuns them; a blink that leaves a moment of sure evasion, a barrier that
// shatters into ice, and the Arcane Lance for the one foe that matters.
import { BaseKit, dirOf } from './base.js';
import { moveCircle } from '../../world/physics.js';
import { SKILLS } from '../../data/skills.js';

export class MageKit extends BaseKit {
  constructor(g) { super(g, 'mage'); this.boltCd = 0; this.channel = false; }

  regen(dt) {
    const p = this.p;
    const mult = this.channel ? 3 : 1;
    p.res = Math.min(this.stats.resourceMax, p.res + this.stats.resourceRegen * dt * mult);
  }

  updateClass(dt, input) {
    this.boltCd -= dt;
    const moving = Math.hypot(this.p.vx, this.p.vz) > 0.5;
    this.channel = input.isDown('alt') && !moving;
    this.animState.aim = this.channel;
    if (this.channel && Math.random() < dt * 20) this.fx.burst(this.p.x + (Math.random() - 0.5), this.p.ry + 0.2, this.p.z + (Math.random() - 0.5), 1, { color: '#6fa8ff', speed: 0.2, up: 2, gravity: -1, life: 0.8, size: 0.1 });
    if (input.isDown('attack') && this.boltCd <= 0) this.bolt();
    // When the Arcane Barrier breaks or fades, it shatters into frost.
    if (this.ward && !(this.p.shield > 0 && this.p.statuses.has('shield'))) { this.ward = false; this.wardBurst(); }
  }

  bolt() {
    const s = this.basic;
    if (this.p.res < s.cost) { this.warn('Not enough Mana. Hold right click (or the alt button) still to channel.'); this.boltCd = 0.3; return; }
    this.p.res -= s.cost;
    const t = this.aimTarget(26);
    const yaw = this.aimYaw(26), d = dirOf(yaw);
    this.face(yaw); this.play('cast', 0.22);
    const sy = this.p.ry + 1.5;
    this.combat.shoot({ x: this.p.x + d.x * 0.6, y: sy, z: this.p.z + d.z * 0.6, dx: d.x, dy: t ? (t.ry + 1 - sy) / Math.max(2, Math.sqrt(t.dist2(this.p))) : 0, dz: d.z, speed: s.speed, team: 'player', kind: 'bolt', radius: 0.4, life: 1.6, homing: t, turn: 5,
      onHit: (e) => this.burst(e, s) });
    this.g.bus.emit('sfx', { id: 'bolt' });
    this.boltCd = 0.42 / this.stats.attackSpeed;
    this.p.combatT = 0;
  }

  // The bolt bursts where it lands: the struck foe takes it all, those around it a share; all are slowed.
  burst(e, s) {
    const slow = [{ id: 'slow', dur: s.slow }];
    this.combat.hit(e, { mult: s.dmg, ranged: true, knock: 0.15, status: slow });
    for (const o of this.combat.circle(e.x, e.z, s.splash, 'player')) if (o !== e) this.combat.hit(o, { mult: s.dmg * s.splashDmg, ranged: true, noTraits: true, status: slow, from: e });
    this.fx.burst(e.x, e.ry + 1, e.z, 10, { color: '#b8a0ff', speed: 4 });
    this.fx.decal({ shape: 'ring', x: e.x, z: e.z, y: e.ry, r: s.splash, t: 0.25, fill: false, color: '#b8a0ff' });
  }

  s_mg_flame(s) {
    const pt = this.aimPoint(s.range);
    const y = this.g.grid.height(Math.floor(pt.x), Math.floor(pt.z));
    this.face(Math.atan2(pt.x - this.p.x, pt.z - this.p.z)); this.play('cast', s.cast + 0.1);
    this.fx.telegraph({ shape: 'circle', x: pt.x, z: pt.z, y, r: s.radius, t: s.cast, color: '#ff7a3d' });
    this.combat.after(s.cast, () => {
      this.fx.burst(pt.x, y + 0.3, pt.z, 30, { color: '#ff7a3d', speed: 6, up: 5 });
      this.fx.burst(pt.x, y + 0.3, pt.z, 14, { color: '#ffd166', speed: 3, up: 6 });
      this.g.bus.emit('sfx', { id: 'fire' });
      for (const t of this.combat.circle(pt.x, pt.z, s.radius, 'player')) this.combat.hit(t, { mult: s.dmg, element: 'fire', status: [{ id: 'burn' }], knock: s.knock, from: pt });
    });
  }

  s_mg_nova(s) {
    this.play('cast', 0.3);
    this.fx.decal({ shape: 'ring', x: this.p.x, z: this.p.z, y: this.p.ry, r: s.radius, t: 0.4, fill: false, color: '#9fd8ff' });
    this.fx.burst(this.p.x, this.p.ry + 0.5, this.p.z, 30, { color: '#cfefff', speed: 9, up: 1, gravity: 4 });
    this.g.bus.emit('sfx', { id: 'frost' });
    for (const t of this.combat.circle(this.p.x, this.p.z, s.radius, 'player')) this.combat.hit(t, { mult: s.dmg, element: 'frost', status: [{ id: 'freeze', dur: s.freeze }] });
  }

  s_mg_chain(s) {
    let cur = this.aimTarget(18);
    if (!cur) { this.warn('No target for Chain Lightning.'); return false; }
    this.face(Math.atan2(cur.x - this.p.x, cur.z - this.p.z)); this.play('cast', 0.25);
    const hit = new Set();
    let from = { x: this.p.x, ry: this.p.ry + 0.4, z: this.p.z }, mult = s.dmg;
    for (let k = 0; k < s.bounces && cur; k++) {
      this.fx.beam(from.x, from.ry + 1.1, from.z, cur.x, cur.ry + 1, cur.z, '#ffe066', 0.25);
      this.combat.hit(cur, { mult, element: 'shock', status: [{ id: 'shock' }, { id: 'stun', dur: s.stun }] });
      hit.add(cur); from = cur; mult *= 0.85;
      cur = this.combat.nearest(cur.x, cur.z, s.range, 'player', (e) => !hit.has(e));
    }
    this.g.bus.emit('sfx', { id: 'zap' });
  }

  s_mg_blink(s) {
    const ax = this.g.input.axes();
    const f = this.g.cam.forward, r = this.g.cam.right;
    let dx = f.x * ax.y + r.x * ax.x, dz = f.z * ax.y + r.z * ax.x;
    if (Math.hypot(dx, dz) < 0.1) { dx = Math.sin(this.p.yaw); dz = Math.cos(this.p.yaw); }
    const l = Math.hypot(dx, dz);
    const x0 = this.p.x, z0 = this.p.z;
    this.fx.burst(this.p.x, this.p.ry + 1, this.p.z, 14, { color: '#b8a0ff', speed: 3 });
    moveCircle(this.g.grid, this.p, (dx / l) * s.range, (dz / l) * s.range, this.p.radius, 1.05);
    // A moment in which every blow misses, and a trail of frost that slows whoever follows.
    this.p.iframes = Math.max(this.p.iframes, s.evade);
    for (let k = 0; k < 3; k++) {
      const x = x0 + (this.p.x - x0) * (k / 3), z = z0 + (this.p.z - z0) * (k / 3);
      this.combat.zone({ x, z, r: 1.6, t: 3, interval: 0.4, team: 'player', color: '#9fd8ff', onTick: (ts) => { for (const t of ts) this.combat.applyStatus(t, 'slow', { dur: 1 }); } });
    }
    this.fx.burst(this.p.x, this.p.ry + 1, this.p.z, 14, { color: '#b8a0ff', speed: 3 });
    this.g.bus.emit('sfx', { id: 'blink' });
  }

  s_mg_barrier(s) {
    const amt = this.stats.maxHp * s.shield * (1 + (this.stats.attrs.int || 0) * 0.008);
    this.p.shield = amt;
    this.p.statuses.apply('shield', { dur: s.duration });
    this.ward = true;
    this.fx.column(this.p.x, this.p.ry, this.p.z, '#7fb3ff', 20);
    this.g.overlay.text(this.p.x, this.p.ry + 2.4, this.p.z, `Barrier ${Math.round(amt)}`, 'status');
  }
  wardBurst() {
    const s = SKILLS.mg_barrier, p = this.p;
    this.fx.decal({ shape: 'ring', x: p.x, z: p.z, y: p.ry, r: s.pulse, t: 0.5, fill: false, color: '#cfefff' });
    this.fx.burst(p.x, p.ry + 0.8, p.z, 30, { color: '#cfefff', speed: 8, up: 2 });
    this.g.bus.emit('sfx', { id: 'frost' });
    for (const t of this.combat.circle(p.x, p.z, s.pulse, 'player')) this.combat.applyStatus(t, 'freeze', { dur: 1.6 });
  }

  // The Arcane Lance: a breath to gather, then one foe pierced for enormous damage, and stunned.
  s_mg_lance(s) {
    const t = this.aimTarget(s.range);
    if (!t) { this.warn('No target for the Arcane Lance.'); return false; }
    this.face(Math.atan2(t.x - this.p.x, t.z - this.p.z), s.cast + 0.2); this.play('cast', s.cast + 0.2);
    this.fx.burst(this.p.x, this.p.ry + 1.4, this.p.z, 18, { color: '#e8d8ff', speed: 1.5, up: 1, gravity: -2, life: s.cast });
    this.combat.after(s.cast, () => {
      if (!t.alive || !this.p.alive) return;
      this.fx.beam(this.p.x, this.p.ry + 1.4, this.p.z, t.x, t.ry + 1, t.z, '#e8d8ff', 0.35);
      this.fx.beam(this.p.x, this.p.ry + 1.45, this.p.z, t.x, t.ry + 1.05, t.z, '#9f7aff', 0.5);
      this.fx.burst(t.x, t.ry + 1, t.z, 30, { color: '#e8d8ff', speed: 8, up: 3 });
      this.g.cam.shake(0.5); this.g.hitStop(0.07);
      this.g.bus.emit('sfx', { id: 'boom' });
      this.combat.hit(t, { mult: s.dmg, ranged: true, knock: 1, status: [{ id: 'stun', dur: s.stun }] });
    });
  }
}
