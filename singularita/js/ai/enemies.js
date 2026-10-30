// Creature manager: spawning, activity tiers, behaviour updates, deaths, drops and rendering.
import { Enemy } from '../entities/enemy.js';
import { ENEMIES, ELITE, ELITE_AFFIXES } from '../data/enemies.js';
import { RIGS, RigInstancer, animate } from '../render/rigs.js';
import { BEHAVIOR } from './behaviors.js';
import { FlowField } from './flowField.js';
import { lineOfSight } from '../world/physics.js';
import { moveCircle, unstick } from '../world/physics.js';
import { killXp } from '../systems/progression.js';
import { addStack } from '../systems/inventory.js';
import { MATERIALS } from '../data/materials.js';
import { F } from '../world/grid.js';

const ACTIVE = 55, REDUCED = 95;
const RIG_OF = (def) => (def.model === 'zombie' && def.helmet ? 'zombieHelmet' : def.model);
const MAKE_RIG = { zombieHelmet: () => RIGS.zombie({ helmet: true }) };
const CAP = { slime: 40, zombie: 36, zombieHelmet: 24 };

export class Enemies {
  constructor(game) {
    this.g = game;
    this.list = [];
    this.active = [];
    this.instancers = {};
    this.flow = new FlowField();
    this.ctx = { g: game, combat: null, fx: null, grid: null, flow: this.flow, target: null, dx: 0, dz: 0, dist: 0, los: true };
    this.barList = [];
  }
  get cap() { return this.g.settings.graphics.maxEnemies; }

  instancer(key) {
    if (!this.instancers[key]) {
      const rig = (MAKE_RIG[key] || RIGS[key])();
      this.instancers[key] = new RigInstancer(rig, CAP[key] || 16, this.g.r.scene);
    }
    return this.instancers[key];
  }

  count(filter) { let n = 0; for (const e of this.list) if (e.alive && (!filter || filter(e))) n++; return n; }

  spawn(id, x, z, o = {}) {
    const def = ENEMIES[id];
    if (!def) return null;
    const inst = this.instancer(RIG_OF(def));
    const slot = inst.acquire();
    if (slot < 0) return null;
    const affixes = [];
    if (o.elite) {
      const keys = Object.keys(ELITE_AFFIXES);
      affixes.push(keys[Math.floor(this.g.rng.next() * keys.length)]);
      if (o.level > 30 && this.g.rng.next() < 0.3) { const k2 = keys[Math.floor(this.g.rng.next() * keys.length)]; if (!affixes.includes(k2)) affixes.push(k2); }
    }
    const e = new Enemy(def, Math.max(1, o.level || 1), { ...o, affixes });
    e.x = x; e.z = z;
    e.y = e.ry = this.g.grid.height(Math.floor(x), Math.floor(z));
    e.yaw = Math.atan2(this.g.player.x - x, this.g.player.z - z);
    e.inst = inst; e.slot = slot;
    e.initPose(inst.rig.parts.length);
    if (o.noIntro) e.spawnT = 0;
    this.list.push(e);
    this.g.fx.burst(x, e.ry + 0.2, z, 8, { color: def.color, speed: 2, up: 2, life: 0.5 });
    this.g.bus.emit('spawned', { enemy: e });
    return e;
  }

  addBoss(b) { this.list.push(b); return b; }

  // Death: drops, XP, splits and the death effect.
  kill(e, by = 'player') {
    if (!e.alive) return;
    e.alive = false;
    e.dyingT = 0.45;
    const g = this.g;
    g.fx.burst(e.x, e.ry + 0.6 * e.height * e.scale, e.z, e.elite ? 26 : 14, { color: e.def.color, speed: 5, up: 3, life: 0.7 });
    if (e.affixes.volatile) {
      g.fx.telegraph({ shape: 'circle', x: e.x, z: e.z, y: e.ry, r: 3, t: 0.7, color: '#ff8a3d' });
      const x = e.x, z = e.z, dmg = e.dmg;
      g.combat.after(0.7, () => { g.fx.burst(x, e.ry + 0.5, z, 20, { color: '#ff8a3d', speed: 7 }); for (const t of g.combat.circle(x, z, 3, 'enemy')) g.combat.hurt(t, dmg, null, { type: 'aoe', knock: 5 }); });
    }
    if (e.def.behavior === 'bomber' && !e.exploded && e.def.cloud) BEHAVIOR.explode(e, this.ctx);
    if (by === 'despawn') return;
    if (e.boss) { e.onDefeat?.(by); return; }
    // Rewards.
    const p = g.profile;
    const xp = killXp(e.def.xp, e.level, p.level) * (e.elite ? ELITE.xp : 1);
    g.grantXp(xp, e);
    const luck = g.stats.luck + (e.elite ? ELITE.dropBonus : 0);
    let lootY = e.ry + e.height * e.scale + 0.6;
    for (const d of e.def.drops) {
      if (g.rng.next() > d.chance + luck) continue;
      const n = g.rng.int(d.min, d.max) + (e.elite ? 1 : 0);
      addStack(p.inv, d.id, n);
      g.overlay.text(e.x, lootY, e.z, `+${n} ${MATERIALS[d.id].name}`, 'loot');
      lootY += 0.4;
      g.bus.emit('itemGained', { id: d.id, n, source: 'drop' });
    }
    if (e.def.split) for (let k = 0; k < e.def.split.count; k++) {
      const a = (k / e.def.split.count) * Math.PI * 2;
      const c = this.spawn(e.def.split.into, e.x + Math.cos(a) * 0.8, e.z + Math.sin(a) * 0.8, { level: e.level, horde: e.horde, noIntro: true });
      if (c) { c.ai.hop = 0.1; c.knock(Math.cos(a), Math.sin(a), 6); }
    }
    p.stats.kills++;
    p.stats.killsBy[e.def.id] = (p.stats.killsBy[e.def.id] || 0) + 1;
    g.bus.emit('kill', { enemy: e, by });
  }

  remove(e) {
    e.inst?.release(e.slot);
    e.slot = -1;
    const i = this.list.indexOf(e);
    if (i >= 0) this.list.splice(i, 1);
  }

  update(dt) {
    const g = this.g, p = g.player, grid = g.grid;
    const c = this.ctx;
    c.combat = g.combat; c.fx = g.fx; c.grid = grid;
    this.flow.update(dt, grid, p.x, p.z);
    this.active.length = 0;
    const astral = g.astral?.manifested ? g.astral : null;
    for (let i = this.list.length - 1; i >= 0; i--) {
      const e = this.list[i];
      if (!e.alive) {
        e.dyingT -= dt;
        if (e.dyingT <= 0) { if (e.boss) e.dispose?.(); this.remove(e); }
        continue;
      }
      const d2 = e.dist2(p);
      e.tier = e.boss ? 'active' : d2 < ACTIVE * ACTIVE ? 'active' : d2 < REDUCED * REDUCED ? 'reduced' : 'dormant';
      if (e.tier === 'dormant') { e.dormantT += dt; continue; }
      e.dormantT = 0;
      let step = dt;
      if (e.tier === 'reduced') { e.accum += dt; if (e.accum < 0.2) { this.active.push(e); continue; } step = e.accum; e.accum = 0; }
      this.active.push(e);
      // Status effects tick (damage over time from the player's effects).
      e.statuses.update(step, (amt) => g.combat.applyRaw(e, amt, 'status'));
      if (!e.alive) continue;
      e.flash = Math.max(0, e.flash - step * 5);
      e.hitT += step;
      e.ai.cd -= step;
      if (e.spawnT > 0) { e.spawnT -= step; continue; }
      // Targeting: the player, unless veiled; a nearby or posted Astral draws creatures too.
      let target = p.alive && !p.statuses.has('invisible') ? p : null;
      if (astral && !e.statuses.has('taunt') && (!target || astral.dist2(e) < Math.min(9, d2 * 0.5))) target = astral;
      c.target = target;
      if (target) {
        c.dx = target.x - e.x; c.dz = target.z - e.z; c.dist = Math.hypot(c.dx, c.dz);
        c.los = c.dist < 18 && lineOfSight(grid, e.x, e.ry + 1, e.z, target.x, target.ry + 1, target.z);
      }
      if (e.boss) { e.update(step, c); }
      else if (!e.statuses.stunned) {
        BEHAVIOR[e.def.behavior](e, step, c);
        if (e.affixes.shielding) { e.ai.aux2 = (e.ai.aux2 || 0) - step; if (e.ai.aux2 <= 0) { e.ai.aux2 = 6; for (const o of this.list) if (o.alive && o !== e && o.dist2(e) < 64) o.shield = o.maxHp * 0.15; g.fx.decal({ shape: 'ring', x: e.x, z: e.z, y: e.ry, r: 8, t: 0.6, fill: false, color: '#7fb3ff' }); } }
      }
      // Knockback and ground; never left inside rock, trees or the camp.
      if (!e.flying && !e.boss) unstick(grid, e, F.BASE);
      if (e.kbt > 0) { e.kbt -= step; moveCircle(grid, e, e.kbx * step, e.kbz * step, e.radius * 0.8, 1.05, e.flying, e.boss ? 0 : F.BASE); }
      const gh = grid.height(Math.floor(e.x), Math.floor(e.z));
      e.y = gh;
      e.ry += (gh - e.ry) * Math.min(1, step * 12);
      e.anim.move = Math.max(0, e.anim.move - step * 3);
    }
    // Light separation so crowds do not stack.
    const A = this.active;
    for (let i = 0; i < A.length; i++) for (let j = i + 1; j < A.length; j++) {
      const a = A[i], b = A[j];
      if (a.boss || b.boss || a.untargetable || b.untargetable) continue;
      const dx = b.x - a.x, dz = b.z - a.z, rr = (a.radius + b.radius) * 0.85, d2 = dx * dx + dz * dz;
      if (d2 > rr * rr || d2 < 1e-6) continue;
      const d = Math.sqrt(d2), push = (rr - d) * 0.5;
      moveCircle(grid, a, (-dx / d) * push, (-dz / d) * push, a.radius * 0.8, 1.05, a.flying, F.BASE);
      moveCircle(grid, b, (dx / d) * push, (dz / d) * push, b.radius * 0.8, 1.05, b.flying, F.BASE);
    }
    // Controlled recall of long-dormant regular creatures when the population is over the cap.
    if (this.list.length > this.cap) {
      const dormant = this.list.filter((e) => e.alive && !e.boss && !e.elite && e.dormantT > 30).sort((a, b) => b.dormantT - a.dormantT);
      for (const e of dormant.slice(0, this.list.length - this.cap)) { e.alive = false; e.dyingT = 0; }
    }
  }

  render(dt) {
    const g = this.g, p = g.player;
    this.barList.length = 0;
    for (const e of this.list) {
      if (e.boss) { e.render?.(dt); continue; }
      if (e.slot < 0) continue;
      if (e.tier === 'dormant') { e.inst.write(e.slot, 0, 0, 0, 0, 1, e.pose, e.tints, 0, 0); continue; }
      const st = e.anim;
      st.t += dt;
      st.atkT = Math.max(0, (st.atkT || 0) - dt);
      st.atk = st.atkT > 0 ? 1 - st.atkT / 0.3 : 0;
      st.style = e.def.slam ? 'slam' : 'slash';
      if (e.tier === 'active') animate(e.inst.rig, st, e.pose);
      let s = e.scale, y = e.ry + e.yOff, alpha = e.alpha;
      if (!e.alive) { const k = Math.max(0, e.dyingT / 0.45); s *= 0.3 + 0.7 * k; y -= (1 - k) * 0.6; }
      if (e.spawnT > 0) { const k = 1 - e.spawnT / 0.6; y -= (1 - k) * 1.2; }
      if (e.flying && e.def.behavior !== 'swoop') y += 1.6 + Math.sin(st.t * 2) * 0.2;
      const frozen = e.statuses.has('freeze');
      const tints = frozen ? FROZEN : e.tints;
      e.inst.write(e.slot, e.x, y, e.z, e.yaw, s, e.pose, tints, e.flash * 0.8, alpha < 0.3 ? 0 : 1);
      if (e.alive && !e.untargetable && alpha > 0.3 && (e.hp < e.maxHp || e.elite) && e.dist2(p) < 900) {
        e.statusIcons = statusIcons(e);
        this.barList.push(e);
      }
    }
    g.overlay.setBars(this.barList);
  }

  clear() {
    for (const e of this.list) if (e.boss) e.dispose?.();
    this.list.length = 0;
    this.active.length = 0;
    for (const inst of Object.values(this.instancers)) inst.dispose();
    this.instancers = {};
    this.flow.valid = false;
  }
}

const FROZEN = { a: '#cfefff', b: '#cfefff', c: '#cfefff' };
import { STATUS } from '../data/status.js';
function statusIcons(e) {
  const out = [];
  for (const id of e.statuses.map.keys()) if (STATUS[id]?.harmful) out.push(STATUS[id]);
  return out;
}
