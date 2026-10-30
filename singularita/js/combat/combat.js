// Combat: area queries, the hit pipeline (crits, armour, statuses, material traits, element combos),
// damage to the player, projectiles, lingering ground zones and timed effects.
import * as THREE from 'three';
import { computeHit, defenseFactor, isInFront } from './formulas.js';
import { boxesGeometry } from '../render/voxel.js';
import { STATUS } from '../data/status.js';

const B = (x, y, z, w, h, d, c) => [x, y, z, w, h, d, c];
const PROJ = {
  arrow: { boxes: [B(0, 0, 0, 0.05, 0.05, 0.9, '#d8c8a0'), B(0, 0, 0.45, 0.09, 0.09, 0.14, '#cfd4dc'), B(0, 0, -0.42, 0.14, 0.02, 0.14, '#ffffff')], lit: true },
  bolt: { boxes: [B(0, 0, 0, 0.3, 0.3, 0.3, '#b8a0ff'), B(0, 0, 0, 0.16, 0.16, 0.5, '#e8dcff')] },
  acid: { boxes: [B(0, 0, 0, 0.32, 0.32, 0.32, '#b6f25a')] },
  glob: { boxes: [B(0, 0, 0, 0.3, 0.3, 0.3, '#5ff0c8')] },
  frost: { boxes: [B(0, 0, 0, 0.16, 0.16, 0.7, '#cfefff'), B(0, 0, 0, 0.3, 0.06, 0.3, '#9fd8ff')] },
  beam: { boxes: [B(0, 0, 0, 0.1, 0.1, 1.4, '#ff6aa8')] },
  boulder: { boxes: [B(0, 0, 0, 1.3, 1.1, 1.2, '#8e9199'), B(0.3, 0.3, 0.2, 0.8, 0.6, 0.8, '#9fa3ab')], lit: true },
  knife: { boxes: [B(0, 0, 0, 0.06, 0.03, 0.5, '#d8dde6')], lit: true },
  mote: { boxes: [B(0, 0, 0, 0.24, 0.24, 0.24, '#f0e0ff'), B(0, 0, 0, 0.4, 0.06, 0.06, '#c48cff'), B(0, 0, 0, 0.06, 0.4, 0.06, '#c48cff')] },
  shard: { boxes: [B(0, 0, 0, 0.12, 0.12, 0.5, '#e8fbff')] },
  fireball: { boxes: [B(0, 0, 0, 0.5, 0.5, 0.5, '#ff7a3d'), B(0, 0, 0, 0.3, 0.3, 0.7, '#ffd166')] },
  pebble: { boxes: [B(0, 0, 0, 0.34, 0.3, 0.34, '#b8a98a'), B(0.08, 0.1, 0, 0.2, 0.16, 0.2, '#9a8a6a')], lit: true },
};
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _f = new THREE.Vector3(), _z = new THREE.Vector3(0, 0, 1);
const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);

export class Combat {
  constructor(game) {
    this.g = game;
    this.projectiles = [];
    this.zones = [];
    this.timers = [];
    this.vis = {};
    for (const [k, def] of Object.entries(PROJ)) {
      const cap = k === 'boulder' ? 8 : 64;
      const mesh = new THREE.InstancedMesh(boxesGeometry(def.boxes), def.lit ? new THREE.MeshLambertMaterial({ vertexColors: true }) : new THREE.MeshBasicMaterial({ vertexColors: true }), cap);
      mesh.frustumCulled = false;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      for (let i = 0; i < cap; i++) mesh.setMatrixAt(i, ZERO);
      game.r.scene.add(mesh);
      this.vis[k] = { mesh, cap, used: 0 };
    }
  }

  get player() { return this.g.player; }
  // Targets for a team's attacks.
  targetsOf(team) { return team === 'player' ? this.g.enemies.active : this.g.playerSide(); }

  circle(x, z, r, team, out = []) {
    for (const e of this.targetsOf(team)) if (e.alive && !e.untargetable) { const dx = e.x - x, dz = e.z - z, rr = r + e.radius; if (dx * dx + dz * dz <= rr * rr) out.push(e); }
    return out;
  }
  arc(x, z, yaw, range, arcDeg, team) {
    const fx = Math.sin(yaw), fz = Math.cos(yaw), cosA = Math.cos((arcDeg * Math.PI) / 360);
    return this.circle(x, z, range, team).filter((e) => {
      const dx = e.x - x, dz = e.z - z, l = Math.hypot(dx, dz);
      return l < e.radius + 0.6 || (fx * dx + fz * dz) / l >= cosA;
    });
  }
  line(x, z, dx, dz, len, width, team) {
    const out = [];
    for (const e of this.targetsOf(team)) {
      if (!e.alive || e.untargetable) continue;
      const rx = e.x - x, rz = e.z - z;
      const t = rx * dx + rz * dz;
      if (t < -e.radius || t > len + e.radius) continue;
      const px = rx - dx * t, pz = rz - dz * t;
      if (px * px + pz * pz <= (width / 2 + e.radius) ** 2) out.push(e);
    }
    return out;
  }
  nearest(x, z, range, team, filter) {
    let best = null, bd = range * range;
    for (const e of this.targetsOf(team)) {
      if (!e.alive || e.untargetable || (filter && !filter(e))) continue;
      const d = (e.x - x) ** 2 + (e.z - z) ** 2;
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }

  // ------------------------------------------------------------------ player side → enemies
  // spec: { mult, src ('player'|'astral'), status: [{ id, chance, dur, stacks }], knock, forceCrit, element,
  //         backstab (multiplier), pierceArmor, noTraits, noLink, from: {x,z}, ranged }
  hit(target, spec) {
    if (!target?.alive || target.untargetable) return null;
    const g = this.g, st = g.stats, p = this.player;
    const from = spec.from || p;
    let mult = spec.mult;
    let critChance = st.critChance, critMult = st.critMult;
    if (p.statuses.has('hawkeye')) { critChance += 0.25; critMult += 0.5; }
    let forceCrit = !!spec.forceCrit;
    if (p.statuses.has('empower')) { forceCrit = true; p.statuses.remove('empower'); }
    if (spec.element === 'fire') mult *= 1 + st.fireBonus;
    if (spec.backstab) mult *= spec.backstab;
    let deflected = false;
    if (target.def.frontArmor && !spec.pierceArmor && !spec.backstab && isInFront(target, from)) { mult *= 1 - target.def.frontArmor; deflected = true; }
    const dmgMult = st.dmgMult * (spec.src === 'astral' ? st.spiPower : 1);
    let vuln = target.statuses.vulnFrom('player');
    if (target.stunnedBonus) vuln *= 1.5;
    if (target.affixes?.armoured) vuln *= 0.65;
    const r = computeHit({ power: st.power, dmgMult, mult, critChance, critMult, forceCrit, def: target.defense, pen: st.armorPen, defMult: target.statuses.defMult, vuln, rng: g.rng });
    let dmg = r.dmg;
    if (target.shield > 0) { const a = Math.min(target.shield, dmg); target.shield -= a; dmg -= a; }
    target.hp -= dmg;
    target.flash = 1;
    target.hitT = 0;
    target.aggro = true;
    const ty = target.ry + target.height * target.scale * 0.8;
    g.overlay.text(target.x, ty, target.z, deflected && !r.crit ? `${dmg} ⛨` : String(dmg), r.crit ? 'crit' : 'dmg');
    g.fx.burst(target.x, ty - 0.3, target.z, r.crit ? 10 : 5, { color: target.bloodColor || '#ffffff', speed: 4, life: 0.4, size: 0.12 });
    if (r.crit) { g.cam.shake(0.18); g.hitStop(0.045); }
    if (spec.knock) {
      const kb = spec.knock * st.knockback * (1 - (target.kbRes || 0));
      if (kb > 0.05) target.knock(target.x - from.x, target.z - from.z, kb * 6);
    }
    // Statuses from the skill.
    for (const s of spec.status || []) if (!s.chance || g.rng.next() < s.chance) this.applyStatus(target, s.id, { dur: s.dur, stacks: s.stacks, power: dmg });
    // Material traits on the weapon.
    if (!spec.noTraits) {
      if (st.burnChance && g.rng.next() < st.burnChance) this.applyStatus(target, 'burn', { power: dmg });
      if (st.chillChance && g.rng.next() < st.chillChance) this.applyStatus(target, 'chill', { power: dmg });
      if (st.shockChance && g.rng.next() < st.shockChance) this.arcLightning(target, dmg * 0.35, 2);
      if (st.prismatic && r.crit) this.prismBurst(target, spec.ranged);
    }
    if (st.lifesteal > 0) this.healPlayer(dmg * st.lifesteal, true);
    if (r.crit && st.critLifesteal > 0) this.healPlayer(dmg * st.critLifesteal, true);
    if (!spec.noTraits && st.blindChance && g.rng.next() < st.blindChance) target.statuses.apply('blind', { dur: 2.5 });
    if (!spec.noLink && target.statuses.has('linked')) {
      for (const o of this.g.enemies.active) if (o !== target && o.alive && o.statuses.has('linked')) this.applyRaw(o, dmg * 0.5, 'status');
    }
    g.bus.emit('damage', { target, dmg, crit: r.crit, src: spec.src });
    if (target.hp <= 0) { g.enemies.kill(target, spec.src); if (st.killHeal > 0) this.healPlayer(g.stats.maxHp * st.killHeal); }
    return { dmg, crit: r.crit };
  }

  applyStatus(target, id, o = {}) {
    if (!target.alive) return;
    if (id === 'burn' && target.def?.fireproof) return;
    if (id === 'chill' && target.statuses.get('chill')?.stacks >= 1) {
      target.statuses.remove('chill');
      target.statuses.apply('freeze', { dur: STATUS.freeze.duration * (target.boss ? 0.35 : 1) });
      this.g.overlay.text(target.x, target.ry + 2, target.z, 'Frozen!', 'status');
      return;
    }
    if (id === 'shock' && target.statuses.has('chill')) {
      target.statuses.remove('chill');
      this.g.overlay.text(target.x, target.ry + 2.2, target.z, 'Shatter!', 'status');
      this.g.fx.burst(target.x, target.ry + 1, target.z, 14, { color: '#cfefff', speed: 6 });
      this.applyRaw(target, (o.power || 10) * 0.8, 'dmg');
    }
    if (id === 'burn' && target.statuses.has('chill')) {
      target.statuses.remove('chill');
      target.statuses.apply('blind', { dur: 3 });
      this.g.overlay.text(target.x, target.ry + 2.2, target.z, 'Steam!', 'status');
      this.g.fx.burst(target.x, target.ry + 1, target.z, 12, { color: '#e8eef2', speed: 2, up: 2, gravity: -1, life: 1 });
    }
    if (target.boss && (id === 'stun' || id === 'root')) o = { ...o, dur: (o.dur ?? STATUS[id].duration) * 0.35 };
    if (id === 'taunt') o = { ...o, src: 'player' };
    if (id === 'marked') o = { ...o, src: 'player' };
    const potency = this.g.stats.statusPotency;
    target.statuses.apply(id, { ...o, power: (o.power || 0) * potency, dur: o.dur != null ? o.dur * Math.min(1.5, potency) : undefined });
  }

  applyRaw(target, amount, kind = 'dmg') {
    if (!target.alive) return;
    const dmg = Math.max(1, Math.round(amount));
    target.hp -= dmg;
    target.flash = Math.max(target.flash, 0.5);
    this.g.overlay.text(target.x, target.ry + target.height * target.scale * 0.8, target.z, String(dmg), kind === 'status' ? 'status' : 'dmg');
    if (target.hp <= 0) this.g.enemies.kill(target, 'player');
  }

  arcLightning(from, amount, count) {
    let cur = from;
    const hit = new Set([from]);
    for (let i = 0; i < count; i++) {
      const next = this.nearest(cur.x, cur.z, 6, 'player', (e) => !hit.has(e));
      if (!next) break;
      this.g.fx.beam(cur.x, cur.ry + 1, cur.z, next.x, next.ry + 1, next.z, '#ffe066', 0.2);
      this.applyRaw(next, amount, 'status');
      hit.add(next); cur = next;
    }
  }

  prismBurst(target, ranged) {
    const g = this.g;
    if (ranged) {
      for (const a of [-0.5, 0.5]) {
        const yaw = Math.atan2(target.x - this.player.x, target.z - this.player.z) + a;
        this.shoot({ x: target.x, y: target.ry + 1, z: target.z, dx: Math.sin(yaw), dz: Math.cos(yaw), speed: 26, team: 'player', kind: 'shard', life: 0.5, onHit: (e) => this.hit(e, { mult: 0.4, noTraits: true }) });
      }
    } else {
      g.fx.decal({ shape: 'ring', x: target.x, z: target.z, y: target.ry, r: 3, t: 0.3, fill: false, color: '#bff6ff' });
      for (const e of this.circle(target.x, target.z, 3, 'player')) if (e !== target) this.hit(e, { mult: 0.4, noTraits: true });
    }
  }

  healPlayer(amount, quiet = false) {
    const p = this.player;
    if (!p.alive) return 0;
    const a = Math.min(p.maxHp - p.hp, amount * this.g.stats.healMult);
    if (a <= 0) return 0;
    p.hp += a;
    if (!quiet && a >= 1) this.g.overlay.text(p.x, p.ry + 2.2, p.z, `+${Math.round(a)}`, 'heal');
    return a;
  }

  // ------------------------------------------------------------------ enemies → player side
  hurt(target, amount, source, opts = {}) {
    if (target === this.player) return this.hurtPlayer(amount, source, opts);
    return target?.takeDamage?.(amount, source, opts) || 'none';
  }

  // opts: { status: [{ id, chance, dur }], knock, type ('melee'|'ranged'|'aoe'|'hazard'), unblockable, from }
  hurtPlayer(amount, source, opts = {}) {
    const g = this.g, p = this.player;
    if (!p.alive || g.godMode) return 'none';
    if (p.iframes > 0) { g.overlay.text(p.x, p.ry + 2, p.z, 'Dodged', 'info'); return 'evaded'; }
    if (source?.statuses?.missChance && g.rng.next() < source.statuses.missChance) { g.overlay.text(p.x, p.ry + 2, p.z, 'Miss', 'info'); return 'missed'; }
    let amt = amount;
    const res = p.kit?.onIncoming?.({ amount: amt, source, opts });
    if (res?.parried) return 'parried';
    if (res?.blocked) amt *= 1 - res.blocked;
    let dmg = amt * defenseFactor(g.stats.def, 0) * p.statuses.vulnFrom(null);
    if (p.shield > 0) { const a = Math.min(p.shield, dmg); p.shield -= a; dmg -= a; if (p.shield <= 0) p.statuses.remove('shield'); }
    dmg = Math.round(dmg);
    if (dmg > 0) {
      p.hp -= dmg;
      p.flash = 1;
      g.overlay.text(p.x, p.ry + 2.1, p.z, `-${dmg}`, 'hurt');
      g.cam.shake(0.15 + Math.min(0.5, dmg / p.maxHp));
    }
    p.combatT = 0;
    for (const s of opts.status || []) {
      if (s.chance && g.rng.next() > s.chance) continue;
      if (s.id === 'poison' && p.statuses.has('antidote')) continue;
      if (STATUS[s.id]?.harmful && g.rng.next() < g.stats.statusRes) continue;
      p.statuses.apply(s.id, { dur: s.dur, power: Math.max(4, amount * 0.6), src: 'enemy' });
      if (s.id === 'chill' && p.statuses.get('chill')?.stacks >= 2) { p.statuses.remove('chill'); p.statuses.apply('freeze', { dur: 1.0 }); }
    }
    if (opts.knock && source && !p.kit?.animState?.guard) p.knock(p.x - source.x, p.z - source.z, opts.knock);
    g.bus.emit('playerHurt', { dmg, source });
    if (p.hp <= 0) { p.hp = 0; g.bus.emit('playerDeath', { source }); }
    return 'hit';
  }

  // ------------------------------------------------------------------ projectiles
  // o: { x,y,z, dx,dy,dz, speed, team, kind, radius, life, pierce, onHit(target, proj), homing, turn, gravity, onExpire(proj), owner }
  shoot(o) {
    const l = Math.hypot(o.dx, o.dy || 0, o.dz) || 1;
    const pr = { radius: 0.35, life: 2, pierce: 0, gravity: 0, turn: 0, ...o, vx: (o.dx / l) * o.speed, vy: ((o.dy || 0) / l) * o.speed, vz: (o.dz / l) * o.speed, hitSet: new Set(), alive: true };
    this.projectiles.push(pr);
    return pr;
  }

  // ------------------------------------------------------------------ ground zones and timers
  // o: { x, z, r, t, interval, team, onTick(targets, zone), color, follow, onEnd }
  zone(o) {
    const z = { interval: 0.5, tick: 0, ...o, age: 0 };
    z.decal = this.g.fx.decal({ shape: 'circle', x: o.x, z: o.z, y: o.y ?? this.g.grid.height(Math.floor(o.x), Math.floor(o.z)), r: o.r, t: o.t, fill: false, persist: true, color: o.color || '#ff4a3a', alpha: 0.32, pulse: true });
    this.zones.push(z);
    return z;
  }
  after(t, fn) { this.timers.push({ t, fn }); }

  update(dt) {
    const g = this.g;
    // Timers.
    for (let i = this.timers.length - 1; i >= 0; i--) {
      const tm = this.timers[i];
      tm.t -= dt;
      if (tm.t <= 0) { this.timers.splice(i, 1); try { tm.fn(); } catch (e) { console.error(e); } }
    }
    // Zones.
    for (let i = this.zones.length - 1; i >= 0; i--) {
      const z = this.zones[i];
      z.age += dt; z.tick -= dt;
      if (z.follow) { z.x = z.follow.x; z.z = z.follow.z; z.decal.mesh.position.set(z.x, z.follow.ry + 0.06, z.z); }
      if (z.tick <= 0) { z.tick = z.interval; z.onTick?.(z.team ? this.circle(z.x, z.z, z.r, z.team) : [], z); }
      if (z.age >= z.t) { g.fx.release(z.decal); this.zones.splice(i, 1); z.onEnd?.(z); }
    }
    // Projectiles.
    const grid = g.grid;
    for (const v of Object.values(this.vis)) v.used = 0;
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const pr = this.projectiles[i];
      pr.life -= dt;
      if (pr.homing?.alive && pr.turn) {
        const tx = pr.homing.x - pr.x, ty = pr.homing.ry + 1 - pr.y, tz = pr.homing.z - pr.z, tl = Math.hypot(tx, ty, tz) || 1;
        const sp = Math.hypot(pr.vx, pr.vy, pr.vz);
        const k = Math.min(1, pr.turn * dt);
        pr.vx += ((tx / tl) * sp - pr.vx) * k; pr.vy += ((ty / tl) * sp - pr.vy) * k; pr.vz += ((tz / tl) * sp - pr.vz) * k;
      }
      pr.vy -= pr.gravity * dt;
      pr.x += pr.vx * dt; pr.y += pr.vy * dt; pr.z += pr.vz * dt;
      let dead = pr.life <= 0;
      const ci = Math.floor(pr.x), cj = Math.floor(pr.z);
      if (!dead && (!grid.inside(ci, cj) || grid.top(ci, cj) > pr.y)) dead = true;
      // The Stardust's Orbit Guard swats enemy projectiles near the player.
      if (!dead && pr.team === 'enemy' && g.astral?.orbitT > 0 && Math.hypot(pr.x - this.player.x, pr.z - this.player.z) < 2.2) { dead = true; g.fx.burst(pr.x, pr.y, pr.z, 6, { color: '#c48cff', speed: 3 }); }
      if (!dead && pr.team !== 'none') {
        for (const e of pr.team === 'player' ? g.enemies.active : g.playerSide()) {
          if (!e.alive || e.untargetable || pr.hitSet.has(e)) continue;
          const rr = pr.radius + e.radius;
          const dx = e.x - pr.x, dz = e.z - pr.z;
          if (dx * dx + dz * dz > rr * rr) continue;
          if (pr.y < e.ry - 0.3 || pr.y > e.ry + e.height * (e.scale || 1) + 0.5) continue;
          pr.hitSet.add(e);
          pr.onHit?.(e, pr);
          if (pr.hitSet.size > pr.pierce) { dead = true; break; }
        }
      }
      if (dead) {
        pr.onExpire?.(pr);
        this.projectiles.splice(i, 1);
        continue;
      }
      const v = this.vis[pr.kind];
      if (v && v.used < v.cap) {
        _f.set(pr.vx, pr.vy, pr.vz).normalize();
        _q.setFromUnitVectors(_z, _f);
        if (pr.kind === 'boulder' || pr.kind === 'mote') _q.setFromAxisAngle(_f, pr.life * 6);
        v.mesh.setMatrixAt(v.used++, _m.compose(_p.set(pr.x, pr.y, pr.z), _q, _s.set(pr.scale || 1, pr.scale || 1, pr.scale || 1)));
      }
    }
    for (const v of Object.values(this.vis)) {
      for (let i = v.used; i < v.mesh.count && i < v.cap; i++) v.mesh.setMatrixAt(i, ZERO);
      v.mesh.count = Math.max(v.used, 1);
      if (v.used === 0) v.mesh.setMatrixAt(0, ZERO);
      v.mesh.instanceMatrix.needsUpdate = true;
    }
  }

  clear() {
    this.projectiles.length = 0;
    for (const z of this.zones) this.g.fx.release(z.decal);
    this.zones.length = 0;
    this.timers.length = 0;
  }
  dispose() { for (const v of Object.values(this.vis)) { v.mesh.parent?.remove(v.mesh); v.mesh.geometry.dispose(); v.mesh.material.dispose(); v.mesh.dispose(); } }
}
