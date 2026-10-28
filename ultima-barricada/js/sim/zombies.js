// Zombie behaviour: idle guards, wanderers, noise investigation, chasing survivors, and hordes
// that follow the flow field to the HQ and tear down whatever stands in the way.
// AI "thinks" on a staggered schedule (more often near the player) while movement runs every tick.
(function (UB) {
  'use strict';
  const { ZOMBIES, DIFFICULTY, WEATHER, BUILDINGS } = UB.DEF;
  const W = UB.World;

  function spawn(S, type, x, y, opts) {
    opts = opts || {};
    const def = ZOMBIES[type];
    const diff = DIFFICULTY[S.difficulty] || DIFFICULTY.normal;
    const hpMul = diff.zhp * (1 + Math.max(0, S.day - 1) * 0.025);
    const id = W.nextId(S);
    const z = {
      id, kind: 'zom', type, x, y, hp: Math.round(def.hp * hpMul), maxHp: Math.round(def.hp * hpMul),
      state: opts.state || 'wander', target: 0, sid: 0, gx: x, gy: y, path: null, pathI: 0,
      cd: 0, facing: (id * 7) % 4, buffT: 0, home: opts.home || 0, think: id % 20, dead: false,
      speedMul: 0.9 + ((id * 2654435761) % 1000) / 5000, scream: 0, turned: opts.turned || '', moving: false, attackT: -9, noChase: 0,
    };
    S.zombies.push(z);
    W.register(S, z);
    return z;
  }

  const isNight = (S) => UB.Waves.isNight(S);

  function sightOf(S, z) {
    const w = WEATHER[S.weather] || WEATHER.clear;
    return ZOMBIES[z.type].sight * w.vision * (isNight(S) ? 1.15 : 1);
  }

  // Think interval: busy or nearby zombies decide often, distant idle ones rarely.
  function interval(S, z) {
    if (z.state === 'chase' || z.state === 'attackS' || z.state === 'horde') return 3;
    if (z.state === 'investigate') return 6;
    return z.near ? 6 : 20;
  }

  function think(S, z) {
    const def = ZOMBIES[z.type];
    // Spot survivors.
    if (z.state !== 'chase' && z.noChase <= S.tick) {
      const u = S._ugrid.nearest(z.x, z.y, sightOf(S, z), (a) => !a.dead);
      if (u) { z.state = 'chase'; z.target = u.id; z.path = null; z.sid = 0; }
    }
    // Screamers call the horde and hasten nearby zombies.
    if (def.scream && S.time >= z.scream && (z.state === 'chase' || z.state === 'horde' || z.state === 'attackS')) {
      z.scream = S.time + def.scream.cd;
      z.attackT = S.time;
      UB.Game.fx(S, { t: 'scream', x: z.x, y: z.y });
      UB.Combat.noise(S, z.x, z.y, def.scream.r);
      S._zgrid.query(z.x, z.y, 6, (o) => { o.buffT = S.time + def.scream.dur; return false; });
    }
    switch (z.state) {
      case 'chase': {
        const u = W.get(S, z.target);
        if (!u || u.dead || u.hidden || UB.U.dist(z.x, z.y, u.x, u.y) > sightOf(S, z) * 1.6) {
          z.target = 0;
          z.state = z.wasHorde ? 'horde' : 'wander';
          z.path = null;
          return;
        }
        // Spitters keep their distance and lob acid.
        if (def.range && UB.U.dist(z.x, z.y, u.x, u.y) <= def.range) { z.path = null; z.steer = null; return; }
        if (UB.U.dist(z.x, z.y, u.x, u.y) < 6 && UB.Path.lineClear(S, z.x, z.y, u.x, u.y, true)) { z.steer = { x: u.x, y: u.y }; z.path = null; return; }
        z.steer = null;
        if (!z.path || z.pathI >= z.path.length || S.tick - (z.pathT || 0) > 30) {
          const p = UB.Path.find(S, z.x, z.y, u.x, u.y, { zombie: true, limit: 350, range: 1 });
          z.pathT = S.tick;
          if (p) { z.path = p; z.pathI = 0; }
          else {
            // Out of reach (survivor behind walls): go break into the base instead.
            z.path = null; z.target = 0; z.state = 'horde'; z.wasHorde = true; z.noChase = S.tick + 100;
          }
        }
        return;
      }
      case 'horde': {
        z.wasHorde = true;
        z.steer = null;
        z.path = null;
        // Ranged zombies spit at structures or survivors within reach.
        if (def.range) {
          const st = nearestStruct(S, z, def.range);
          if (st) { z.state = 'attackS'; z.sid = st.id; return; }
        }
        const next = UB.Path.flowNext(S, z.x, z.y);
        if (next < 0) {
          // Already next to the HQ (or nowhere to go): attack the HQ if adjacent.
          const hq = W.hq(S);
          if (hq && UB.Units.distToRect(z.x, z.y, UB.Units.rectOf(hq)) < 1.2) { z.state = 'attackS'; z.sid = hq.id; }
          return;
        }
        const st = S._struct[next];
        if (st) { z.state = 'attackS'; z.sid = st; return; }
        const N = S.map.w;
        z.steer = { x: (next % N) + 0.5, y: ((next / N) | 0) + 0.5 };
        return;
      }
      case 'attackS': {
        const b = W.get(S, z.sid);
        if (!b || b.dead) { z.sid = 0; z.state = 'horde'; return; }
        z.steer = null;
        return;
      }
      case 'investigate': {
        z.steer = null;
        if (UB.U.dist(z.x, z.y, z.gx, z.gy) < 1.2) { z.state = 'wander'; z.path = null; return; }
        if (!z.path) {
          const p = UB.Path.find(S, z.x, z.y, z.gx, z.gy, { zombie: true, limit: 500, range: 1, partial: true });
          if (p && p.length) { z.path = p; z.pathI = 0; } else z.state = 'wander';
        } else if (z.pathI >= z.path.length) { z.state = 'wander'; z.path = null; }
        return;
      }
      case 'wander': {
        if (z.path && z.pathI < z.path.length) return;
        z.path = null;
        if (S.rng.chance(z.near ? 0.25 : 0.12)) {
          const gx = z.x + S.rng.range(-6, 6), gy = z.y + S.rng.range(-6, 6);
          if (W.inb(S, Math.floor(gx), Math.floor(gy)) && !S._blockZ[W.idx(S, Math.floor(gx), Math.floor(gy))] && UB.Path.lineClear(S, z.x, z.y, gx, gy, true)) {
            z.steer = { x: gx, y: gy };
          }
        }
        return;
      }
      default: z.steer = null; return; // idle guards wait for noise or prey
    }
  }

  function nearestStruct(S, z, r) {
    let best = null, bd = Infinity;
    for (const b of S.buildings) {
      if (b.dead || b.built < 1 || BUILDINGS[b.type].walkable) continue;
      const d = UB.Units.distToRect(z.x, z.y, UB.Units.rectOf(b));
      if (d <= r && d < bd) { bd = d; best = b; }
    }
    return best;
  }

  function speedOf(S, z) {
    let s = ZOMBIES[z.type].speed * z.speedMul;
    if (isNight(S)) s *= 1.12;
    if (z.buffT > S.time) s *= 1 + ZOMBIES.screamer.scream.buff;
    if (z.state === 'wander' || z.state === 'idle') s *= 0.6;
    const i = W.idx(S, Math.floor(z.x), Math.floor(z.y));
    const occ = S._occ[i];
    if (occ) { const b = W.get(S, occ); if (b && b.type === 'spikes' && b.built >= 1) s *= 0.5; }
    return s / (UB.DEF.TERRAIN[S.map.terrain[i]].cost || 1);
  }

  // Moves with axis-separated collision against blocked tiles.
  function moveBy(S, z, dx, dy) {
    const N = S.map.w;
    const nx = z.x + dx, ny = z.y + dy;
    const r = 0.22;
    const blocked = (x, y) => {
      const tx = Math.floor(x), ty = Math.floor(y);
      return tx < 0 || ty < 0 || tx >= N || ty >= N || S._blockZ[ty * N + tx] === 1;
    };
    if (!blocked(nx + Math.sign(dx) * r, z.y)) z.x = nx;
    if (!blocked(z.x, ny + Math.sign(dy) * r)) z.y = ny;
  }

  function act(S, z, dt) {
    const def = ZOMBIES[z.type];
    z.moving = false;
    // Attacks.
    if (z.state === 'chase') {
      const u = W.get(S, z.target);
      if (u && !u.dead) {
        const d = UB.U.dist(z.x, z.y, u.x, u.y);
        z.facing = UB.Units.facingOf(u.x - z.x, u.y - z.y);
        if (def.range && d <= def.range) {
          if (z.cd <= 0) { z.cd = def.cd; z.attackT = S.time; UB.Combat.spit(S, z, u.x, u.y); }
          return;
        }
        const reach = def.boss ? 1.3 : 0.75;
        if (d <= reach) {
          if (z.cd <= 0) { z.cd = def.cd; z.attackT = S.time; UB.Combat.hurtUnit(S, u, def.dmg, z, false); }
          return;
        }
      }
    } else if (z.state === 'attackS') {
      const b = W.get(S, z.sid);
      if (b && !b.dead) {
        const rect = UB.Units.rectOf(b);
        const d = UB.Units.distToRect(z.x, z.y, rect);
        z.facing = UB.Units.facingOf(b.tx + b.w / 2 - z.x, b.ty + b.h / 2 - z.y);
        if (def.range && d <= def.range) {
          if (z.cd <= 0) { z.cd = def.cd; z.attackT = S.time; UB.Combat.spit(S, z, b.tx + b.w / 2, b.ty + b.h / 2); }
          return;
        }
        if (d <= (def.boss ? 1.1 : 0.6)) {
          if (z.cd <= 0) {
            z.cd = def.cd; z.attackT = S.time;
            UB.Buildings.damage(S, b, def.dmg * def.struct);
            if (S.rng.chance(0.15)) UB.Game.fx(S, { t: 'bang', x: z.x, y: z.y, id: b.id });
          }
          return;
        }
        // Walk up to the structure.
        const cx = Math.max(rect.x0, Math.min(z.x, rect.x1 + 1)), cy = Math.max(rect.y0, Math.min(z.y, rect.y1 + 1));
        z.steer = { x: cx, y: cy };
      }
    }
    // Movement.
    let tx, ty;
    if (z.steer) { tx = z.steer.x; ty = z.steer.y; }
    else if (z.path && z.pathI < z.path.length) {
      const N = S.map.w, i = z.path[z.pathI];
      tx = (i % N) + 0.5; ty = ((i / N) | 0) + 0.5;
      if (Math.hypot(tx - z.x, ty - z.y) < 0.2) { z.pathI++; return; }
    } else if (z.state === 'chase') {
      const u = W.get(S, z.target);
      if (u) { tx = u.x; ty = u.y; }
    }
    if (tx === undefined) return;
    const dx = tx - z.x, dy = ty - z.y, d = Math.hypot(dx, dy);
    if (d < 0.05) { if (z.steer && z.state === 'wander') z.steer = null; return; }
    const sp = Math.min(d, speedOf(S, z) * dt);
    moveBy(S, z, (dx / d) * sp, (dy / d) * sp);
    z.moving = true;
    z.facing = UB.Units.facingOf(dx, dy);
  }

  // Crowds: push overlapping zombies apart (every other tick, alternating halves).
  function separate(S) {
    const list = S.zombies;
    const half = S.tick & 1;
    for (let k = half; k < list.length; k += 2) {
      const z = list[k];
      if (z.dead) continue;
      const big = ZOMBIES[z.type].boss ? 0.7 : 0.38;
      let px = 0, py = 0;
      S._zgrid.query(z.x, z.y, big, (o, d2) => {
        if (o === z || o.dead || d2 < 1e-6) return false;
        const d = Math.sqrt(d2);
        const push = (big - d) / big;
        px += ((z.x - o.x) / d) * push;
        py += ((z.y - o.y) / d) * push;
        return false;
      });
      if (px || py) moveBy(S, z, px * 0.06, py * 0.06);
    }
  }

  function tick(S, dt) {
    const hq = W.hq(S);
    for (const z of S.zombies) {
      if (z.dead) continue;
      z.cd -= dt;
      if ((S.tick + z.think) % 20 === 0) {
        // "Near" = within reach of the base or a survivor; refreshed occasionally.
        z.near = (hq && Math.abs(z.x - hq.tx) + Math.abs(z.y - hq.ty) < 40) || !!S._ugrid.nearest(z.x, z.y, 18, (u) => !u.dead);
      }
      if ((S.tick + z.think) % interval(S, z) === 0) think(S, z);
      act(S, z, dt);
    }
    separate(S);
  }

  UB.Zombies = { spawn, tick, think };
})(globalThis.UB = globalThis.UB || {});
