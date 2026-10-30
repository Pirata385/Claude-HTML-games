// Shared boss machinery: arena engagement and leash, phases, rewards, rendering through a RigMesh.
import { Entity } from '../../entities/entity.js';
import { enemyHp, enemyDmg } from '../../systems/scaling.js';
import { moveCircle } from '../../world/physics.js';
import { animate } from '../../render/rigs.js';
import { angleDiff } from '../../core/math.js';
import { addStack, addItem } from '../../systems/inventory.js';
import { MATERIALS } from '../../data/materials.js';
import { ITEMS } from '../../data/items.js';

export class Boss extends Entity {
  constructor(game, def, level, arena, rig, group) {
    super({ team: 'enemy' });
    this.g = game;
    this.bossDef = def;
    this.def = { id: def.id, name: def.name, color: def.color, family: 'boss', drops: [], frontArmor: 0, behavior: 'boss' };
    this.boss = true;
    this.level = level;
    this.maxHp = this.hp = Math.round(enemyHp(def.hp, level));
    this.dmg = enemyDmg(def.dmg, level);
    this.defense = 4 + level * 1.6;
    this.arena = arena;
    this.affixes = {};
    this.scale = 1; this.kbRes = 0.9;
    this.rig = rig;
    this.group = group || { def, members: [], engaged: false, defeated: false };
    this.group.members.push(this);
    game.r.scene.add(rig.root);
    this.x = arena.x; this.z = arena.z; this.y = this.ry = arena.h;
    this.state = 'idle'; this.t = 0; this.cd = 2;
    this.ai = { cd: 0 }; this.hitT = 99; this.dormantT = 0; this.kbt = 0;
    this.phase = 0;
    this.leaveT = 0;
    this.anim = { t: 0, move: 0, phase: 0, atk: 0, wind: 0, squash: 0, style: 'slam' };
    this.atkT = 0; this.atkDur = 0;
    this.bloodColor = def.color;
    this.tag = def.name;
    this.statusIcons = [];
  }
  get engaged() { return this.group.engaged; }

  play(style, dur) { this.anim.style = style; this.atkT = 0; this.atkDur = dur; }
  face(x, z, dt, rate = 6) { this.yaw += angleDiff(this.yaw, Math.atan2(x - this.x, z - this.z)) * Math.min(1, dt * rate); }
  move(dx, dz, dist) { const l = Math.hypot(dx, dz) || 1; return moveCircle(this.g.grid, this, (dx / l) * dist, (dz / l) * dist, this.radius * 0.7, 1.05); }
  hurtIn(x, z, r, mult, opts = {}) { for (const t of this.g.combat.circle(x, z, r, 'enemy')) this.g.combat.hurt(t, this.dmg * mult, this, { type: 'aoe', ...opts }); }

  update(dt, c) {
    const g = this.g, p = g.player;
    const inArena = Math.hypot(p.x - this.arena.x, p.z - this.arena.z) < this.arena.r + 2;
    if (!this.group.engaged) {
      this.anim.move = 0;
      this.face(p.x, p.z, dt, 2);
      if (inArena && p.alive) { this.group.engaged = true; g.bus.emit('bossEngage', { boss: this, def: this.bossDef }); }
      return;
    }
    // Leash: leaving the arena for long resets the fight.
    if (Math.hypot(p.x - this.arena.x, p.z - this.arena.z) > this.arena.r + 14 || !p.alive) {
      this.leaveT += dt;
      if (this.leaveT > 8) { for (const m of [...this.group.members]) if (m.alive) m.resetFight(); g.bus.emit('bossReset', { def: this.bossDef }); return; }
    } else this.leaveT = 0;
    const frac = this.group.members.reduce((a, m) => a + Math.max(0, m.hp), 0) / this.group.members.reduce((a, m) => a + m.maxHp, 0);
    const phases = this.bossDef.phases;
    while (this.phase + 1 < phases.length && frac <= phases[this.phase + 1].at) { this.phase++; this.onPhase(this.phase); g.bus.emit('bossPhase', { def: this.bossDef, phase: phases[this.phase] }); }
    this.cd -= dt;
    if (this.atkDur > 0) { this.atkT += dt; this.anim.atk = Math.min(1, this.atkT / this.atkDur); if (this.atkT >= this.atkDur) { this.atkDur = 0; this.anim.atk = 0; } }
    if (this.statuses.stunned) { this.anim.wind = 0; return; }
    this.think(dt, c);
  }
  resetFight() {
    this.hp = this.maxHp; this.x = this.arena.x; this.z = this.arena.z; this.state = 'idle'; this.cd = 2; this.phase = 0; this.leaveT = 0;
    this.group.engaged = false; this.statuses.clear(); this.stunnedBonus = false;
    this.onReset?.();
  }
  onPhase() {}
  think() {}

  // Rewards once every member of the group has fallen.
  onDefeat() {
    const grp = this.group;
    if (grp.defeated || grp.members.some((m) => m.alive)) return;
    grp.defeated = true;
    const g = this.g, p = g.profile, def = this.bossDef;
    const first = !p.stats.bosses[def.id];
    p.stats.bosses[def.id] = (p.stats.bosses[def.id] || 0) + 1;
    const loot = [];
    for (const r of def.rewards) {
      if (r.material) { const n = g.rng.int(r.min, r.max); addStack(p.inv, r.material, n); loot.push(`${n} ${MATERIALS[r.material].name}`); g.bus.emit('itemGained', { id: r.material, n, source: 'boss' }); }
      else if (r.item && ((r.firstKill && first) || g.rng.next() < r.chance)) { addItem(p.inv, r.item); loot.push(ITEMS[r.item].name); }
    }
    g.grantXp(def.xp * (1 + 0.08 * this.level), this);
    g.fx.column(this.x, this.ry, this.z, def.color, 50, 2);
    g.bus.emit('bossDefeated', { def, loot, first });
  }

  render(dt) {
    const a = this.anim;
    a.t += dt;
    if (this.alive || this.dyingT > 0) {
      animate(this.rig.rig, a, this.rig.pose);
      this.rig.applyPose();
    }
    let s = this.scale;
    if (!this.alive) { const k = Math.max(0, this.dyingT / 0.45); s *= 0.2 + 0.8 * k; }
    this.rig.root.position.set(this.x, this.ry + (this.yOff || 0), this.z);
    this.rig.root.rotation.y = this.yaw;
    this.rig.root.scale.setScalar(s * (this.rig.rig.scale || 1));
    this.rig.setFlash(this.flash);
    this.flash = Math.max(0, this.flash - dt * 5);
  }
  dispose() { this.rig.dispose(); }
}
