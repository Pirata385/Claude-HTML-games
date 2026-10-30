// Creature behaviours. Each is a small state machine over e.ai; they share movement and attack helpers.
// ctx: { g, combat, fx, grid, flow, target, dx, dz, dist, los }
import { moveCircle } from '../world/physics.js';
import { angleDiff } from '../core/math.js';
import { F } from '../world/grid.js';

const _dir = { x: 0, z: 0 };
const PROJ_SPEED = { beam: 26, frost: 18, bolt: 20, fireball: 13, pebble: 16, glob: 12 };

export function face(e, x, z, dt, rate = 10) {
  e.yaw += angleDiff(e.yaw, Math.atan2(x - e.x, z - e.z)) * Math.min(1, dt * rate);
}

// Move toward the target, following the flow field around obstacles when possible.
export function steer(e, dt, c, mult = 1, away = false) {
  if (e.statuses.rooted || !c.target) return;
  const sp = e.speed * mult * e.statuses.slowMult;
  let dx = c.dx, dz = c.dz;
  if (!away && !e.flying && !e.boss) {
    const d = c.flow.dirAt(e.x, e.z, _dir);
    if (d) { dx = d.x; dz = d.z; }
  }
  const l = Math.hypot(dx, dz) || 1;
  const s = away ? -1 : 1;
  moveCircle(c.grid, e, (dx / l) * sp * dt * s, (dz / l) * sp * dt * s, e.radius * 0.8, 1.05, e.flying, e.boss ? 0 : F.BASE);
  e.anim.move = Math.min(1, e.anim.move + dt * 6);
  e.anim.phase += sp * dt * 2.2;
  if (!away) face(e, e.x + dx, e.z + dz, dt);
}

function strafe(e, dt, c, sign) {
  const sp = e.speed * 0.6 * e.statuses.slowMult;
  const l = c.dist || 1;
  moveCircle(c.grid, e, (-c.dz / l) * sp * dt * sign, (c.dx / l) * sp * dt * sign, e.radius * 0.8, 1.05, e.flying, F.BASE);
  e.anim.move = Math.min(1, e.anim.move + dt * 4);
  e.anim.phase += sp * dt * 2;
}

export function hurt(c, e, mult = 1, opts = {}) {
  if (!c.target) return;
  const st = e.def.onHit ? [{ id: e.def.onHit, chance: 0.5 }] : [];
  const r = c.combat.hurt(c.target, e.dmg * mult, e, { status: st, ...opts });
  if (r === 'hit' && e.affixes.vampiric) { e.hp = Math.min(e.maxHp, e.hp + e.dmg * mult * 0.3); }
  return r;
}

// Melee: approach, wind up (with a readable telegraph), strike.
function meleeCore(e, dt, c, chaseMult = 1) {
  const a = e.ai, def = e.def;
  if (a.state === 'windup') {
    a.t -= dt;
    e.anim.wind = 1 - Math.max(0, a.t) / def.windup;
    if (c.target) face(e, c.target.x, c.target.z, dt, 4);
    if (a.t <= 0) {
      e.anim.wind = 0; e.anim.atkT = 0.3;
      if (def.slam) {
        const hx = e.x + Math.sin(e.yaw) * def.range * 0.5, hz = e.z + Math.cos(e.yaw) * def.range * 0.5;
        c.fx.burst(hx, e.ry + 0.2, hz, 16, { color: '#b8a98a', speed: 6, up: 3 });
        c.g.cam.shake(0.25);
        c.g.bus.emit('sfx', { id: 'slam', x: e.x, z: e.z });
        for (const t of c.combat.circle(hx, hz, def.slam * e.scale * 0.7, 'enemy')) c.combat.hurt(t, e.dmg, e, { knock: 7, type: 'aoe' });
      } else if (c.target && c.dist < def.range + e.radius + c.target.radius + 0.4) {
        const ang = Math.abs(angleDiff(e.yaw, Math.atan2(c.dx, c.dz)));
        if (ang < 1.2) hurt(c, e, 1, { type: 'melee', knock: 3 });
        c.g.bus.emit('sfx', { id: 'enemySwing', x: e.x, z: e.z });
      }
      a.state = 'recover'; a.t = 0.35; a.cd = def.atkCd;
    }
    return true;
  }
  if (a.state === 'recover') { a.t -= dt; if (a.t <= 0) a.state = 'chase'; return true; }
  if (!c.target) return false;
  if (c.dist < def.range + e.radius + c.target.radius && a.cd <= 0 && !e.statuses.stunned) {
    a.state = 'windup'; a.t = def.windup;
    if (def.slam) {
      const hx = e.x + Math.sin(e.yaw) * def.range * 0.5, hz = e.z + Math.cos(e.yaw) * def.range * 0.5;
      c.fx.telegraph({ shape: 'circle', x: hx, z: hz, y: e.ry, r: def.slam * e.scale * 0.7, t: def.windup });
    } else c.fx.slash(e.x, e.ry + 0.1, e.z, e.yaw, def.range + e.radius + 0.5, 110, '#ff4a3a', def.windup);
    return true;
  }
  if (c.dist > def.range * 0.8 + e.radius) steer(e, dt, c, chaseMult);
  else face(e, c.target.x, c.target.z, dt);
  return false;
}

function shootAt(e, c, kind, speed, opts = {}) {
  const t = c.target;
  const lead = c.dist / speed;
  const tx = t.x + (t.vx || 0) * lead * 0.6, tz = t.z + (t.vz || 0) * lead * 0.6;
  const sy = e.ry + e.height * e.scale * 0.6;
  const dx = tx - e.x, dz = tz - e.z, l = Math.hypot(dx, dz) || 1;
  const dy = (t.ry + 1 - sy) / l;
  c.combat.shoot({ x: e.x + (dx / l) * e.radius, y: sy, z: e.z + (dz / l) * e.radius, dx: dx / l, dy, dz: dz / l, speed, team: 'enemy', kind, radius: 0.35, life: 2.5,
    onHit: (target) => c.combat.hurt(target, e.dmg * (opts.mult || 1), e, { type: 'ranged', status: e.def.onHit ? [{ id: e.def.onHit, chance: 0.6 }] : [] }) });
  c.g.bus.emit('sfx', { id: 'enemyShoot', x: e.x, z: e.z });
}

export const BEHAVIOR = {
  hopper(e, dt, c) {
    const a = e.ai;
    a.hop += dt * (e.speed / 2.6) * 1.2 * e.statuses.slowMult;
    const ph = a.hop % 1;
    const air = ph < 0.55 && !e.statuses.rooted;
    e.yOff = air ? Math.sin((ph / 0.55) * Math.PI) * 0.8 * Math.sqrt(e.scale) : 0;
    e.anim.squash = air ? 0.16 * Math.sin((ph / 0.55) * Math.PI) : -0.22 * Math.sin(((ph - 0.55) / 0.45) * Math.PI);
    if (air && c.target) steer(e, dt, c, 1.7);
    if (!air && a.lastAir) {
      c.fx.burst(e.x, e.ry + 0.1, e.z, 3, { color: e.def.color, speed: 2, up: 1, life: 0.3, size: 0.1 });
      if (c.target && c.dist < e.radius + c.target.radius + 0.6 && a.cd <= 0) { hurt(c, e, 1, { type: 'melee', knock: 2.5 }); a.cd = e.def.atkCd; }
    }
    a.lastAir = air;
  },

  melee(e, dt, c) { meleeCore(e, dt, c); },
  golem(e, dt, c) { meleeCore(e, dt, c); },

  ranged(e, dt, c) {
    const a = e.ai, def = e.def;
    if (!c.target) return;
    if (a.state === 'windup') {
      a.t -= dt; e.anim.wind = 1 - a.t / def.windup;
      face(e, c.target.x, c.target.z, dt, 8);
      if (a.t <= 0) { e.anim.wind = 0; e.anim.atkT = 0.3; shootAt(e, c, def.proj, PROJ_SPEED[def.proj] || 14); a.state = 'chase'; a.cd = def.atkCd; }
      return;
    }
    const want = def.range * 0.7;
    if (c.dist > def.range || !c.los) steer(e, dt, c, 1);
    else if (c.dist < want * 0.6) steer(e, dt, c, 0.8, true);
    else { strafe(e, dt, c, Math.sin(a.phase + c.g.time * 0.7) > 0 ? 1 : -1); face(e, c.target.x, c.target.z, dt); }
    if (c.dist <= def.range && c.los && a.cd <= 0) { a.state = 'windup'; a.t = def.windup; c.fx.beam(e.x, e.ry + 1, e.z, c.target.x, c.target.ry + 1, c.target.z, '#ff4a3a', def.windup); }
  },

  sentry(e, dt, c) {
    const a = e.ai, def = e.def;
    if (!c.target) return;
    face(e, c.target.x, c.target.z, dt, 3);
    if (a.state === 'windup') { a.t -= dt; if (a.t <= 0) { shootAt(e, c, 'beam', 26); a.state = 'idle'; a.cd = def.atkCd; } return; }
    if (c.dist < def.range && c.los && a.cd <= 0) { a.state = 'windup'; a.t = def.windup; c.fx.beam(e.x, e.ry + 2.1, e.z, c.target.x, c.target.ry + 1, c.target.z, '#ff6aa8', def.windup); }
  },

  support_heal(e, dt, c) {
    const a = e.ai;
    let sx = 0, sz = 0, n = 0;
    for (const o of c.g.enemies.active) if (o !== e && o.alive && o.dist2(e) < 144 && o.def.family === e.def.family) { sx += o.x; sz += o.z; n++; }
    if (c.target && c.dist < 6) steer(e, dt, c, 1, true);
    else if (n) {
      const cx = sx / n, cz = sz / n, dx = cx - e.x, dz = cz - e.z, l = Math.hypot(dx, dz);
      if (l > 3) moveCircle(c.grid, e, (dx / l) * e.speed * dt, (dz / l) * e.speed * dt, e.radius * 0.8, 1.05, false, F.BASE);
    } else if (c.target) steer(e, dt, c, 0.8);
    BEHAVIOR.hopperVisual(e, dt);
    if (a.cd <= 0 && n) {
      a.cd = e.def.atkCd;
      const r = e.def.auraRadius;
      c.fx.decal({ shape: 'ring', x: e.x, z: e.z, y: e.ry, r, t: 0.6, fill: false, color: '#6fe08a' });
      for (const o of c.g.enemies.active) if (o.alive && o !== e && o.dist2(e) < r * r && o.hp < o.maxHp) {
        const amt = o.maxHp * e.def.heal;
        o.hp = Math.min(o.maxHp, o.hp + amt);
        c.fx.column(o.x, o.ry, o.z, '#6fe08a', 6, 0.4);
      }
      c.g.bus.emit('sfx', { id: 'heal', x: e.x, z: e.z });
    }
  },
  hopperVisual(e, dt) {
    e.ai.hop += dt * 1.1;
    const ph = e.ai.hop % 1;
    e.yOff = ph < 0.5 ? Math.sin((ph / 0.5) * Math.PI) * 0.4 : 0;
    e.anim.squash = ph < 0.5 ? 0.1 : -0.12 * Math.sin(((ph - 0.5) / 0.5) * Math.PI);
  },

  support_buff(e, dt, c) {
    const a = e.ai;
    if (!c.target) return;
    if (c.dist > 9) steer(e, dt, c, 1); else if (c.dist < 6) steer(e, dt, c, 0.8, true); else face(e, c.target.x, c.target.z, dt);
    e.anim.reach = true;
    if (a.cd <= 0) {
      a.cd = e.def.atkCd;
      const r = e.def.auraRadius;
      // Screamers and Ash Shamans hasten their kin; Cloud Sprites wrap them in shields.
      const shield = e.def.buff === 'shield';
      c.fx.decal({ shape: 'ring', x: e.x, z: e.z, y: e.ry, r, t: 0.8, fill: false, color: shield ? '#7fb3ff' : '#ffe17a' });
      c.g.overlay.text(e.x, e.ry + 2.4, e.z, shield ? 'SHIELD!' : e.def.family === 'zombie' ? 'SCREAM!' : 'HASTE!', 'status');
      c.g.bus.emit('sfx', { id: shield ? 'heal' : 'scream', x: e.x, z: e.z });
      for (const o of c.g.enemies.active) if (o.alive && o.dist2(e) < r * r) {
        if (shield) { o.shield = Math.max(o.shield || 0, o.maxHp * 0.2); c.fx.column(o.x, o.ry, o.z, '#7fb3ff', 5, 0.4); }
        else o.statuses.apply('haste', { dur: 5 });
      }
    }
  },

  bomber(e, dt, c) {
    const a = e.ai, def = e.def;
    if (a.state === 'fuse') {
      a.t -= dt; e.anim.wind = 1 - a.t / 0.9;
      if (a.t <= 0) { BEHAVIOR.explode(e, c); c.g.enemies.kill(e, 'self'); }
      return;
    }
    if (!c.target) return;
    steer(e, dt, c, 1);
    if (c.dist < 2.2) { a.state = 'fuse'; a.t = 0.9; c.fx.telegraph({ shape: 'circle', x: e.x, z: e.z, y: e.ry, r: def.explode, t: 0.9, color: '#9be15d', follow: e }); }
  },
  explode(e, c) {
    const def = e.def;
    if (e.exploded) return;
    e.exploded = true;
    c.fx.burst(e.x, e.ry + 0.6, e.z, 26, { color: def.cloud === 'poison' ? '#9be15d' : '#ff8a3d', speed: 7, up: 3 });
    c.g.cam.shake(0.3);
    c.g.bus.emit('sfx', { id: 'explode', x: e.x, z: e.z });
    for (const t of c.combat.circle(e.x, e.z, def.explode || 3, 'enemy')) c.combat.hurt(t, e.dmg, e, { type: 'aoe', knock: 6 });
    if (def.cloud) {
      const dmg = e.dmg * 0.15;
      c.combat.zone({ x: e.x, z: e.z, r: (def.explode || 3) * 0.9, t: 4, interval: 0.5, team: 'enemy', color: '#9be15d',
        onTick: (ts) => { for (const t of ts) c.combat.hurt(t, dmg, null, { type: 'hazard', status: [{ id: 'poison', chance: 0.5 }] }); } });
    }
  },

  swoop(e, dt, c) {
    const a = e.ai;
    if (!c.target) return;
    const t = c.target;
    if (a.state === 'dive') {
      a.t -= dt;
      const sp = e.speed * 1.9;
      const l = c.dist || 1;
      moveCircle(c.grid, e, (c.dx / l) * sp * dt, (c.dz / l) * sp * dt, e.radius, 9, true);
      e.yOff = Math.max(0.6, e.yOff - dt * 5);
      face(e, t.x, t.z, dt, 12);
      if (c.dist < e.radius + t.radius + 0.4 && !a.hitDone) { hurt(c, e, 1, { type: 'melee', knock: e.def.gust || 0 }); a.hitDone = true; }
      if (a.t <= 0 || a.hitDone) { a.state = 'circle'; a.cd = e.def.atkCd + Math.random(); }
      return;
    }
    a.ang = (a.ang ?? Math.random() * 6) + dt * 1.4;
    const r = 4.5, gx = t.x + Math.cos(a.ang) * r, gz = t.z + Math.sin(a.ang) * r;
    const dx = gx - e.x, dz = gz - e.z, l = Math.hypot(dx, dz) || 1;
    const sp = Math.min(e.speed, l * 3);
    moveCircle(c.grid, e, (dx / l) * sp * dt, (dz / l) * sp * dt, e.radius, 9, true);
    e.yOff += (2.2 - e.yOff) * Math.min(1, dt * 3);
    face(e, t.x, t.z, dt);
    if (a.cd <= 0 && c.dist < 9 && c.los) { a.state = 'dive'; a.t = 0.8; a.hitDone = false; c.g.bus.emit('sfx', { id: 'screech', x: e.x, z: e.z }); }
  },

  burrow(e, dt, c) {
    const a = e.ai;
    if (a.state === 'idle' || (a.state === 'chase' && !(a.surf > 0))) { a.state = 'under'; }
    if (a.state === 'under') {
      e.untargetable = true; e.alpha = 0;
      a.aux -= dt;
      if (a.aux <= 0) { a.aux = 0.15; c.fx.burst(e.x, e.ry + 0.05, e.z, 2, { color: '#8a6a4a', speed: 1.5, up: 1.5, life: 0.4, size: 0.12 }); }
      if (c.target) steer(e, dt, c, 1.5);
      if (c.target && c.dist < 2.6) { a.state = 'emerge'; a.t = 0.9; c.fx.telegraph({ shape: 'circle', x: e.x, z: e.z, y: e.ry, r: 2.4, t: 0.9 }); }
      return;
    }
    if (a.state === 'emerge') {
      a.t -= dt;
      if (a.t <= 0) {
        e.untargetable = false; e.alpha = 1;
        c.fx.burst(e.x, e.ry + 0.3, e.z, 22, { color: '#8a6a4a', speed: 6, up: 4 });
        c.g.cam.shake(0.2);
        for (const t of c.combat.circle(e.x, e.z, 2.4, 'enemy')) c.combat.hurt(t, e.dmg * 1.2, e, { type: 'aoe', knock: 6 });
        a.state = 'chase'; a.surf = 6; a.cd = 0.8;
      }
      return;
    }
    // Surfaced: fight in melee for a while, then dive again.
    a.surf -= dt;
    meleeCore(e, dt, c);
    if (a.surf <= 0 && a.state !== 'windup') { a.state = 'under'; c.fx.burst(e.x, e.ry + 0.2, e.z, 14, { color: '#8a6a4a', speed: 4 }); }
  },

  // Glass Jelly: drifts at you and pulses a shocking aura.
  aura(e, dt, c) {
    const a = e.ai, def = e.def;
    if (!c.target) return;
    if (a.state === 'charge') {
      a.t -= dt; e.anim.wind = 1 - a.t / 0.6;
      if (a.t <= 0) {
        e.anim.wind = 0; a.state = 'chase'; a.cd = def.atkCd + 0.6;
        c.fx.burst(e.x, e.ry + 1.6, e.z, 14, { color: def.color, speed: 4, up: 1 });
        for (const t of c.combat.circle(e.x, e.z, def.auraRadius, 'enemy')) c.combat.hurt(t, e.dmg, e, { type: 'aoe', status: def.onHit ? [{ id: def.onHit, chance: 0.6 }] : [] });
      }
      return;
    }
    if (c.dist > 1.2) steer(e, dt, c, 1);
    if (a.cd <= 0 && c.dist < def.auraRadius + 0.8) { a.state = 'charge'; a.t = 0.6; c.fx.telegraph({ shape: 'circle', x: e.x, z: e.z, y: e.ry, r: def.auraRadius, t: 0.6, color: def.color, follow: e }); }
  },

  // Root Lasher: rooted in place, it whips a thorned tip along a line.
  lasher(e, dt, c) {
    const a = e.ai, def = e.def;
    if (!c.target) return;
    if (a.state === 'windup') {
      a.t -= dt; e.anim.wind = 1 - a.t / def.windup;
      if (a.t <= 0) {
        e.anim.wind = 0; e.anim.atkT = 0.3; a.state = 'idle'; a.cd = def.atkCd;
        c.g.bus.emit('sfx', { id: 'heavy', x: e.x, z: e.z });
        for (const t of c.combat.line(e.x, e.z, a.ldx, a.ldz, def.range, 1.6, 'enemy')) c.combat.hurt(t, e.dmg, e, { type: 'melee', knock: 6, status: [{ id: 'root', chance: 0.4, dur: 1 }] });
        c.fx.burst(e.x + a.ldx * def.range * 0.6, e.ry + 0.5, e.z + a.ldz * def.range * 0.6, 12, { color: '#7a5a3a', speed: 4, up: 3 });
      }
      return;
    }
    face(e, c.target.x, c.target.z, dt, 4);
    if (c.dist <= def.range && c.los && a.cd <= 0) {
      const l = c.dist || 1;
      a.ldx = c.dx / l; a.ldz = c.dz / l;
      e.yaw = Math.atan2(a.ldx, a.ldz);
      a.state = 'windup'; a.t = def.windup;
      c.fx.telegraph({ shape: 'line', x: e.x, z: e.z, y: e.ry, dx: a.ldx, dz: a.ldz, len: def.range, width: 1.6, t: def.windup, color: '#c8885a' });
    }
  },

  // Allele seedling: rooted, it feeds the golem that sprouted it with a thin green beam.
  seedling(e, dt, c) {
    const b = e.golem;
    if (!b?.alive) { c.g.enemies.kill(e, 'despawn'); return; }
    e.ai.aux -= dt;
    if (e.ai.aux > 0) return;
    e.ai.aux = 1;
    b.hp = Math.min(b.maxHp, b.hp + b.maxHp * e.def.heal);
    c.fx.beam(e.x, e.ry + 1, e.z, b.x, b.ry + 2.5, b.z, '#8ad06a', 0.4);
  },

  lurker(e, dt, c) {
    const a = e.ai;
    const revealed = e.hitT < 4 || (c.target && c.dist < 6);
    e.alpha += ((revealed ? 1 : 0.07) - e.alpha) * Math.min(1, dt * 6);
    if (!a.revealed && revealed) { a.revealed = true; c.g.bus.emit('sfx', { id: 'screech', x: e.x, z: e.z }); }
    if (!revealed) a.revealed = false;
    meleeCore(e, dt, c, revealed ? 1.15 : 0.7);
  },
};
