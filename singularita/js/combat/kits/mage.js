// Mage: homing bolts, channelled mana, fire, frost and lightning that combine, a blink and a meteor.
import { BaseKit, dirOf } from './base.js';
import { moveCircle } from '../../world/physics.js';

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
      onHit: (e) => { this.combat.hit(e, { mult: s.dmg, ranged: true, knock: 0.15 }); this.fx.burst(e.x, e.ry + 1, e.z, 6, { color: '#b8a0ff', speed: 3 }); } });
    this.g.bus.emit('sfx', { id: 'bolt' });
    this.boltCd = 0.42 / this.stats.attackSpeed;
    this.p.combatT = 0;
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
      for (const t of this.combat.circle(pt.x, pt.z, s.radius, 'player')) this.combat.hit(t, { mult: s.dmg, element: 'fire', status: [{ id: 'burn' }], from: pt });
    });
  }

  s_mg_nova(s) {
    this.play('cast', 0.3);
    this.fx.decal({ shape: 'ring', x: this.p.x, z: this.p.z, y: this.p.ry, r: s.radius, t: 0.4, fill: false, color: '#9fd8ff' });
    this.fx.burst(this.p.x, this.p.ry + 0.5, this.p.z, 30, { color: '#cfefff', speed: 9, up: 1, gravity: 4 });
    this.g.bus.emit('sfx', { id: 'frost' });
    for (const t of this.combat.circle(this.p.x, this.p.z, s.radius, 'player')) this.combat.hit(t, { mult: s.dmg, element: 'frost', status: [{ id: 'chill' }], knock: 0.4 });
  }

  s_mg_chain(s) {
    let cur = this.aimTarget(18);
    if (!cur) { this.warn('No target for Chain Lightning.'); return false; }
    this.face(Math.atan2(cur.x - this.p.x, cur.z - this.p.z)); this.play('cast', 0.25);
    const hit = new Set();
    let from = { x: this.p.x, ry: this.p.ry + 0.4, z: this.p.z }, mult = s.dmg;
    for (let k = 0; k < s.bounces && cur; k++) {
      this.fx.beam(from.x, from.ry + 1.1, from.z, cur.x, cur.ry + 1, cur.z, '#ffe066', 0.25);
      this.combat.hit(cur, { mult, element: 'shock', status: [{ id: 'shock' }] });
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
    this.fx.burst(this.p.x, this.p.ry + 1, this.p.z, 14, { color: '#b8a0ff', speed: 3 });
    moveCircle(this.g.grid, this.p, (dx / l) * s.range, (dz / l) * s.range, this.p.radius, 1.05);
    this.p.iframes = Math.max(this.p.iframes, 0.2);
    this.fx.burst(this.p.x, this.p.ry + 1, this.p.z, 14, { color: '#b8a0ff', speed: 3 });
    this.g.bus.emit('sfx', { id: 'blink' });
  }

  s_mg_barrier(s) {
    const amt = this.stats.maxHp * 0.25 * (1 + (this.stats.attrs.int || 0) * 0.008);
    this.p.shield = amt;
    this.p.statuses.apply('shield', { dur: s.duration });
    this.fx.column(this.p.x, this.p.ry, this.p.z, '#7fb3ff', 20);
    this.g.overlay.text(this.p.x, this.p.ry + 2.4, this.p.z, `Barrier ${Math.round(amt)}`, 'status');
  }

  s_mg_meteor(s) {
    const pt = this.aimPoint(s.range);
    const y = this.g.grid.height(Math.floor(pt.x), Math.floor(pt.z));
    this.play('cast', 0.4);
    this.fx.telegraph({ shape: 'circle', x: pt.x, z: pt.z, y, r: s.radius, t: s.delay, color: '#ff4a3a' });
    const rock = this.combat.shoot({ x: pt.x - 6, y: y + 18, z: pt.z - 3, dx: 6, dy: -18, dz: 3, speed: Math.hypot(6, 18, 3) / s.delay, team: 'none', kind: 'fireball', life: s.delay, radius: 0 });
    rock.scale = 3;
    this.combat.after(s.delay, () => {
      this.fx.burst(pt.x, y + 0.5, pt.z, 50, { color: '#ff7a3d', speed: 10, up: 7 });
      this.fx.burst(pt.x, y + 0.5, pt.z, 24, { color: '#5a4a40', speed: 6, up: 5 });
      this.g.cam.shake(0.6); this.g.hitStop(0.06);
      this.g.bus.emit('sfx', { id: 'boom' });
      for (const t of this.combat.circle(pt.x, pt.z, s.radius, 'player')) this.combat.hit(t, { mult: s.dmg, element: 'fire', status: [{ id: 'burn' }], knock: 1.5, from: pt });
      this.combat.zone({ x: pt.x, z: pt.z, y, r: s.radius * 0.6, t: 3, interval: 0.5, team: 'player', color: '#ff7a3d', onTick: (ts) => { for (const t of ts) this.combat.applyStatus(t, 'burn', { power: this.stats.power * this.stats.dmgMult }); } });
    });
  }
}
