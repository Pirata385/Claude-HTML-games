// Shared class-kit machinery: cooldowns, resource, aim assist, hotbar casting and common moves.
import { SKILLS, skillsOf } from '../../data/skills.js';
import { CLASSES } from '../../data/classes.js';
import { angleDiff } from '../../core/math.js';
import { moveCircle } from '../../world/physics.js';

export class BaseKit {
  constructor(game, cls) {
    this.g = game;
    this.cls = cls;
    this.def = CLASSES[cls];
    this.cd = {};
    this.animState = { atk: 0, style: 'slash', aim: false, guard: false, wind: 0 };
    this.atkT = 0; this.atkDur = 0;
    this.moveMult = 1;
    this.faceYaw = null; this.faceT = 0;
    this.lastWarn = 0;
    this.basic = skillsOf(cls).find((s) => s.kind === 'basic');
    this.alt = skillsOf(cls).find((s) => s.kind === 'alt');
  }
  get p() { return this.g.player; }
  get stats() { return this.g.stats; }
  get combat() { return this.g.combat; }
  get fx() { return this.g.fx; }
  get hotbar() { return this.g.profile.hotbars[this.cls]; }

  unlocked(id) { return this.g.profile.level >= SKILLS[id].unlock; }
  cdLeft(id) { return Math.max(0, this.cd[id] || 0); }
  cdFrac(id) { const s = SKILLS[id]; return s.cd ? this.cdLeft(id) / (s.cd * (1 - this.stats.cdr)) : 0; }

  warn(msg) {
    if (this.g.time - this.lastWarn < 0.8) return;
    this.lastWarn = this.g.time;
    this.g.ui?.toast(msg, 'warn');
    this.g.bus.emit('sfx', { id: 'denied' });
  }

  canCast(id) {
    const s = SKILLS[id];
    if (!s) return 'No skill in this slot.';
    if (!this.unlocked(id)) return `${s.name} unlocks at level ${s.unlock}.`;
    if (this.cdLeft(id) > 0) return `${s.name} is recharging.`;
    if (this.p.res < s.cost) return `Not enough ${this.def.resource.name}.`;
    if (this.p.statuses.stunned) return 'You are stunned.';
    return null;
  }

  tryCast(id) {
    const why = this.canCast(id);
    if (why) { this.warn(why); return false; }
    const s = SKILLS[id];
    const fn = this[`s_${id}`];
    if (!fn) return false;
    if (fn.call(this, s) === false) return false;
    this.p.res -= s.cost;
    this.cd[id] = s.cd * (1 - this.stats.cdr);
    this.p.combatT = 0;
    this.g.bus.emit('skill', { id, cls: this.cls });
    return true;
  }

  // Direction to attack: locked target, then a target in front (aim assist), then the camera.
  aimTarget(range = 20) {
    const lock = this.g.lockTarget;
    if (lock?.alive && !lock.untargetable && lock.dist2(this.p) < (range + 4) ** 2) return lock;
    const f = this.g.cam.forward;
    const cone = this.g.input.lastDevice === 'touch' ? 0.55 : 0.8; // cos of half-angle
    let best = null, bs = -Infinity;
    for (const e of this.g.enemies.active) {
      if (!e.alive || e.untargetable) continue;
      const dx = e.x - this.p.x, dz = e.z - this.p.z, d = Math.hypot(dx, dz);
      if (d > range || d < 0.01) continue;
      const dot = (dx * f.x + dz * f.z) / d;
      if (dot < cone && d > 2.5) continue;
      const score = dot * 2 - d / range + (e.boss ? 0.5 : 0);
      if (score > bs) { bs = score; best = e; }
    }
    return best;
  }
  aimYaw(range = 20) {
    const t = this.aimTarget(range);
    if (t) return Math.atan2(t.x - this.p.x, t.z - this.p.z);
    const f = this.g.cam.forward;
    return Math.atan2(f.x, f.z);
  }
  // Ground point for area skills: the target's feet, or a point ahead, stopped by walls.
  aimPoint(range) {
    const t = this.aimTarget(range);
    if (t) return { x: t.x, z: t.z, target: t };
    const yaw = this.aimYaw(range);
    const dx = Math.sin(yaw), dz = Math.cos(yaw);
    let d = Math.min(range, 9);
    for (let s = 1; s <= d; s += 0.5) { const i = Math.floor(this.p.x + dx * s), j = Math.floor(this.p.z + dz * s); if (this.g.grid.top(i, j) > this.p.y + 1.5) { d = Math.max(1, s - 1); break; } }
    return { x: this.p.x + dx * d, z: this.p.z + dz * d, target: null };
  }

  face(yaw, hold = 0.35) { this.faceYaw = yaw; this.faceT = hold; this.p.yaw = yaw; }
  play(style, dur) { this.animState.style = style; this.atkT = 0; this.atkDur = dur; }

  // Melee swing in front of the player.
  melee(range, arcDeg, mult, opts = {}) {
    const yaw = opts.yaw ?? this.aimYaw(range + 3);
    this.face(yaw);
    const targets = this.combat.arc(this.p.x, this.p.z, yaw, range, arcDeg, 'player');
    this.fx.slash(this.p.x, this.p.ry + 0.9, this.p.z, yaw, range, arcDeg, opts.color || '#fff4d0', 0.16);
    let hits = 0;
    for (const t of targets) { if (this.combat.hit(t, { mult, ...opts })) hits++; }
    this.g.bus.emit('sfx', { id: hits ? 'hit' : 'swing', x: this.p.x, z: this.p.z });
    return targets;
  }

  // Short dash along a direction, sliding on walls. Returns the distance covered.
  dash(dx, dz, dist, iframes = 0.2) {
    const x0 = this.p.x, z0 = this.p.z;
    moveCircle(this.g.grid, this.p, dx * dist, dz * dist, this.p.radius, 1.05);
    this.p.iframes = Math.max(this.p.iframes, iframes);
    this.p.vx = this.p.vz = 0;
    return Math.hypot(this.p.x - x0, this.p.z - z0);
  }

  regen(dt) {
    const p = this.p;
    p.res = Math.min(this.stats.resourceMax, p.res + this.stats.resourceRegen * dt * (p.statuses.has('guarded') ? 2 : 1));
  }

  // Called every frame by the player system.
  update(dt, input) {
    for (const k in this.cd) if (this.cd[k] > 0) this.cd[k] -= dt;
    if (this.atkDur > 0) {
      this.atkT += dt;
      this.animState.atk = Math.min(1, this.atkT / this.atkDur);
      if (this.atkT >= this.atkDur) { this.atkDur = 0; this.animState.atk = 0; }
    }
    if (this.faceT > 0) { this.faceT -= dt; if (this.faceT <= 0) this.faceYaw = null; }
    this.regen(dt);
    if (this.p.statuses.stunned || this.g.inputBlocked) { this.animState.guard = false; this.animState.aim = false; this.moveMult = 1; return; }
    const hb = this.hotbar;
    for (let k = 0; k < 4; k++) if (input.wasPressed(`skill${k + 1}`) && hb[k]) this.tryCast(hb[k]);
    this.updateClass(dt, input);
  }
  updateClass() {}
  onIncoming() { return null; }
  dispose() {}
}

export const yawTo = (a, b) => Math.atan2(b.x - a.x, b.z - a.z);
export const dirOf = (yaw) => ({ x: Math.sin(yaw), z: Math.cos(yaw) });
export { angleDiff };
