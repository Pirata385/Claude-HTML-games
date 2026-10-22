// Runtime of procedural powers. Every cast opens a cast instance (charge,
// combo bookkeeping); every form spawns objects into the battle; every
// modifier hooks into those objects' movement, impacts and hits. Épico
// payloads fire once per cast through triggerCombo.
(function (XS) {
  'use strict';

  const has = (def, m) => def.mods && def.mods.includes(m);
  const chestZ = (f) => f.z + Math.min(1.6, f.height * 0.45);
  const TAU = Math.PI * 2;
  const subCache = new WeakMap();

  // Cast instance: damage/size from charging, and whether the payload fired.
  const newCast = (def, charge, noCombo) => ({ dmg: 1 + 0.6 * charge, size: 1 + 0.4 * charge, charge, comboDone: !!noCombo || !def.combo });

  // Floor under a point (or the point itself over the void).
  function floorAt(b, x, y, z) {
    const g = b.world.groundAt(x, y, z + 0.5, 0);
    return g === -Infinity ? z : g;
  }

  // ------------------------------------------------------------ casting
  // aim: { angle, dist, charge } (charge 0..1, used by "Carregável").
  function cast(b, f, def, aim) {
    const charge = has(def, 'charge') ? XS.clamp(aim.charge || 0, 0, 1) : 0;
    const ctx = { angle: aim.angle, dist: aim.dist, ci: newCast(def, charge) };
    doCast(b, f, def, ctx);
    if (has(def, 'mirrored')) doCast(b, f, def, { angle: ctx.angle + Math.PI, dist: ctx.dist, ci: newCast(def, charge, true) });
    if (has(def, 'echo')) {
      b.schedule(0.6, () => {
        if (!f.alive) return;
        doCast(b, f, def, { angle: ctx.angle, dist: ctx.dist, ci: newCast(def, charge, true) });
        b.events.emit('echo', { f, def });
      });
    }
  }

  function pointFor(f, def, ctx) {
    const d = XS.clamp(ctx.dist != null ? ctx.dist : def.range * 0.7, 1, def.range || 6);
    return { x: f.x + Math.cos(ctx.angle) * d, y: f.y + Math.sin(ctx.angle) * d };
  }

  const fan = (n, spread, a, fn) => { for (let i = 0; i < n; i++) fn(a + (i - (n - 1) / 2) * spread, i); };

  function doCast(b, f, def, ctx) {
    const a = ctx.angle, ci = ctx.ci;
    const side = (i) => (i % 2 ? -1 : 1);
    switch (def.form) {
      case 'bolt': case 'boomerang': case 'hook':
        fan(def.count, 0.28, a, (ang, i) => spawnProjectile(b, f, def, ang, { ci, curveSign: side(i) }));
        break;
      case 'sniper': fan(def.count, 0.1, a, (ang) => spawnProjectile(b, f, def, ang, { ci })); break;
      case 'drill': fan(def.count, 0.3, a, (ang, i) => spawnProjectile(b, f, def, ang, { ci, curveSign: side(i) })); break;
      case 'shotgun': {
        const n = def.count;
        for (let i = 0; i < n; i++) {
          const ang = a + (n > 1 ? (i / (n - 1) - 0.5) * def.angle : 0) + b.rng.range(-0.04, 0.04);
          spawnProjectile(b, f, def, ang, { ci, pellet: true, speedMult: b.rng.range(0.9, 1.1) });
        }
        break;
      }
      case 'beam':
        fan(def.count, 0.3, a, (ang) => b.objects.push({ kind: 'beam', owner: f, def, ci, angle: ang, t: 0, tick: 0, ticks: 0, r: def.radius * ci.size, sx: f.x, sy: f.y, sz: chestZ(f), ex: f.x, ey: f.y, ez: chestZ(f), update: updateBeam }));
        break;
      case 'wave': fan(def.count, 0.35, a, (ang, i) => spawnWave(b, f, def, ang, ci, side(i))); break;
      case 'eruption': {
        const z = f.z;
        fan(def.count, 0.4, a, (ang) => spawnEruption(b, f, def, f.x, f.y, z, ang, def.range, ci, f.radius + 0.6));
        break;
      }
      case 'tornado': fan(def.count, 0.5, a, (ang) => spawnTornado(b, f, def, ang, ci)); break;
      case 'nova': {
        const delay = has(def, 'delay') ? 1.2 : 0;
        const r = def.radius * ci.size * (delay ? 1.2 : 1);
        const o = { kind: 'nova', owner: f, def, ci, r, t: 0.28 + delay, T: 0.28 + delay, x: f.x, y: f.y, z: f.z, dm: ci.dmg * (delay ? 1.4 : 1), update: updateNova };
        b.objects.push(o);
        o.tele = b.telegraph({ x: f.x, y: f.y, z: f.z, r, dur: o.t + 0.02, ramp: def.ramp, follow: f, team: f.team });
        break;
      }
      case 'cone': b.objects.push({ kind: 'cone', owner: f, def, ci, angle: a, t: 0, tick: 0, update: updateCone }); break;
      case 'quake': quake(b, f, def, a, ci); break;
      case 'grenade': {
        const p = pointFor(f, def, ctx);
        const px = -Math.sin(a), py = Math.cos(a);
        fan(def.count, 1.8, 0, (off) => spawnLob(b, f, def, f.x, f.y, chestZ(f), p.x + px * off, p.y + py * off, 'grenade', { ci, bounces: has(def, 'ricochet') ? 1 : 0, size: ci.size, dm: ci.dmg, tele: true }));
        break;
      }
      case 'mine': {
        const p = pointFor(f, def, ctx);
        for (let i = 0; i < def.count; i++) {
          const ang = (i / def.count) * TAU + a, rr = def.count > 1 ? 1.7 : 0;
          spawnLob(b, f, def, f.x, f.y, chestZ(f), p.x + Math.cos(ang) * rr, p.y + Math.sin(ang) * rr, 'mine', { ci, dm: ci.dmg });
        }
        break;
      }
      case 'field': case 'singularity': {
        const p = pointFor(f, def, ctx);
        spawnLob(b, f, def, f.x, f.y, chestZ(f), p.x, p.y, def.form, { ci, dm: ci.dmg, size: ci.size });
        break;
      }
      case 'summon': {
        const p = pointFor(f, def, ctx);
        const px = -Math.sin(a), py = Math.cos(a);
        fan(def.count, 2.2, 0, (off) => spawnLob(b, f, def, f.x, f.y, chestZ(f), p.x + px * off, p.y + py * off, 'summon', { ci, dm: ci.dmg }));
        break;
      }
      case 'rain': {
        const p = pointFor(f, def, ctx);
        let last = 0;
        for (let i = 0; i < def.count; i++) {
          const ang = b.rng.range(0, TAU), rr = Math.sqrt(b.rng.next()) * def.spread;
          last = 0.55 + i * 0.14;
          spawnStrike(b, f, def, p.x + Math.cos(ang) * rr, p.y + Math.sin(ang) * rr, def.radius, last, ci.dmg);
        }
        if (!ci.comboDone) b.schedule(last + 0.05, () => triggerCombo(b, f, def, p.x, p.y, f.z + 3, ci, a));
        break;
      }
      case 'meteor': {
        const p = pointFor(f, def, ctx);
        const px = -Math.sin(a), py = Math.cos(a);
        fan(def.count, 3.2, 0, (off, i) => spawnMeteor(b, f, def, p.x + px * off, p.y + py * off, ci, i * 0.3));
        break;
      }
      case 'dash': {
        const sp = def.range / 0.26 * (has(def, 'swift') ? 1.2 : 1);
        f.dash = { def, ci, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, t: def.range / sp, hit: new Set(), trailT: 0, blocked: false };
        b.events.emit('dash', { f, def });
        f.inv = Math.max(f.inv, 0.12);
        break;
      }
      case 'orbit':
        b.objects = b.objects.filter((o) => !(o.kind === 'orbit' && o.owner === f));
        b.objects.push({ kind: 'orbit', owner: f, def, ci, t: def.duration, ang: 0, last: new Map(), nibble: 0, trailT: 0, update: updateOrbit });
        break;
      case 'wall': {
        const p = pointFor(f, def, ctx);
        const g = floorAt(b, p.x, p.y, f.z + 2);
        buildWall(b, f, def, p.x, p.y, g, a, ci.dmg);
        if (!ci.comboDone) b.schedule(def.duration, () => { if (f.alive) triggerCombo(b, f, def, p.x, p.y, g, ci, a); });
        break;
      }
      case 'blink': blink(b, f, def, ctx); break;
      case 'aura': startAura(b, f, def); break;
    }
    // Payloads that go off together with the cast.
    if (def.combo && def.combo.trigger === 'cast' && def.form !== 'nova') {
      const self = def.aim === 'self';
      const sub = def.combo.form;
      const d = self ? (sub === 'wall' || sub === 'summon' ? 2.2 : 0) : Math.min((def.range || 4) * 0.6, 3.5);
      triggerCombo(b, f, def, f.x + Math.cos(a) * d, f.y + Math.sin(a) * d, f.z, ci, a);
    }
  }

  // ------------------------------------------------------------ combos
  // The payload of an Épico, as a power def of its own (cached per def).
  function subDef(def) {
    let s = subCache.get(def);
    if (!s) {
      s = Object.assign({}, def.combo, { ramp: def.ramp2 || def.ramp, ramp2: null, mods: [], blast: 0, ai: def.ai, isSub: true, name: def.name, seed: def.seed, tier: def.tier, combo: null });
      subCache.set(def, s);
    }
    return s;
  }

  function triggerCombo(b, f, def, x, y, z, ci, angle) {
    if (!ci || ci.comboDone || !def.combo) return;
    ci.comboDone = true;
    const c = subDef(def), dm = ci.dmg;
    const gz = floorAt(b, x, y, z);
    const a = angle != null ? angle : f.facing;
    switch (c.form) {
      case 'nova':
        b.explosion(x, y, gz + 0.8, c.radius, c.damage * dm, f, c, { terrain: c.terrain, terrainZ: gz + 0.2, terrainR: c.radius * 0.8 });
        extras(b, f, c, x, y, gz, 1);
        break;
      case 'field': spawnZone(b, f, c, x, y, c.radius, c.duration, dm, 'field', gz); break;
      case 'mines':
        for (let i = 0; i < c.count; i++) {
          const ang = a + 0.6 + (i / c.count) * TAU;
          spawnLob(b, f, c, x, y, gz + 0.6, x + Math.cos(ang) * 2.4, y + Math.sin(ang) * 2.4, 'mine', { T: 0.45, apex: 1.4, dm });
        }
        break;
      case 'wall': buildWall(b, f, c, x, y, gz, a, dm); break;
      case 'singularity': spawnSingularity(b, f, c, x, y, gz, dm, null, 1); break;
      case 'rain':
        for (let i = 0; i < c.count; i++) {
          const ang = b.rng.range(0, TAU), rr = Math.sqrt(b.rng.next()) * c.spread;
          spawnStrike(b, f, c, x + Math.cos(ang) * rr, y + Math.sin(ang) * rr, c.radius, 0.4 + i * 0.12, dm);
        }
        break;
      case 'summon': if (f.alive) spawnTurret(b, f, c, x, y, gz, a, null, dm); break;
      case 'eruption':
        for (let k = 0; k < c.count; k++) spawnEruption(b, f, c, x, y, gz, a + (k / c.count) * TAU, c.range, { dmg: dm, size: 1, comboDone: true }, 0.9);
        break;
      case 'shotgun':
        for (let i = 0; i < c.count; i++) spawnProjectile(b, f, c, a + (i / c.count) * TAU, { x, y, z: gz + 0.9, pellet: true, dmgMult: dm });
        break;
      case 'chain': chainFromPoint(b, f, c, x, y, gz + 1, c.count, c.range, dm); break;
    }
    b.events.emit('combo', { f, def, x, y, z: gz, form: c.form, ramp: c.ramp });
  }

  function chainFromPoint(b, f, def, x, y, z, n, range, dm) {
    const done = new Set();
    let cx = x, cy = y, cz = z;
    for (let i = 0; i < n; i++) {
      const next = b.nearestEnemy(f, cx, cy, range, done);
      if (!next) break;
      done.add(next.id);
      const nz = next.z + next.height * 0.5;
      b.events.emit('chain', { x1: cx, y1: cy, z1: cz, x2: next.x, y2: next.y, z2: nz, ramp: def.ramp });
      b.damage(next, def.damage * dm, { src: f, def, kx: next.x - cx, ky: next.y - cy, kb: def.knock });
      cx = next.x; cy = next.y; cz = nz;
    }
    if (!done.size) b.events.emit('impact', { x, y, z, ramp: def.ramp, small: true, el: def.elements[0] });
  }

  // ---------------------------------------------------------- projectiles
  // opts: { ci, child, pellet, size, speedMult, rangeMult, dmgMult, x, y, z, curveSign }
  function spawnProjectile(b, f, def, angle, opts) {
    const ci = opts.ci || null, child = !!opts.child;
    const speed = (def.speed || 14) * (opts.speedMult || 1);
    const range = (def.range || 10) * (opts.rangeMult || 1);
    const curve = has(def, 'curve') && !child ? (opts.curveSign || 1) * 1.2 : 0;
    // A curving shot starts off-line so its arc ends on the aimed line.
    if (curve) angle -= curve * (range / speed) / 2;
    const size = (opts.size || 1) * (ci && !child ? ci.size : 1);
    const o = {
      kind: 'proj', owner: f, def, ci, x: f.x + Math.cos(angle) * f.radius * 0.8, y: f.y + Math.sin(angle) * f.radius * 0.8, z: opts.z != null ? opts.z : chestZ(f),
      vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, speed, r: (def.radius || 0.4) * size,
      dist: 0, range, hit: new Set(), bounces: has(def, 'ricochet') ? 3 : 0, curve,
      ret: 0, age: 0, trailT: 0, carveT: 0, dmgMult: (opts.dmgMult || 1) * (ci ? ci.dmg : 1), child, pellet: !!opts.pellet,
      burrow: has(def, 'burrow') && !child, drill: def.form === 'drill' && !child, update: updateProjectile,
    };
    if (opts.x != null) { o.x = opts.x; o.y = opts.y; }
    if (o.burrow) {
      const g = b.world.groundAt(o.x, o.y, f.z + 0.5, 0);
      o.z = (g === -Infinity ? f.z : g) - 0.3; // a trench one voxel deep
    }
    b.objects.push(o);
    return o;
  }

  // Turn a boomerang (or a returning shot) back toward its owner.
  function turnBack(b, o) {
    o.ret = 1;
    o.hit.clear();
    if (!o.child) triggerCombo(b, o.owner, o.def, o.x, o.y, o.z, o.ci, Math.atan2(o.vy, o.vx));
  }

  function updateProjectile(b, o, dt) {
    const def = o.def, f = o.owner;
    o.age += dt;
    if (o.burrow) return updateBurrow(b, o, dt);
    if (has(def, 'homing') && o.ret === 0 && !o.child) {
      const t = b.nearestEnemy(f, o.x, o.y, 12, o.hit);
      if (t) {
        const want = Math.atan2(t.y - o.y, t.x - o.x), cur = Math.atan2(o.vy, o.vx);
        const na = XS.turnToward(cur, want, 4.5 * dt);
        o.vx = Math.cos(na) * o.speed; o.vy = Math.sin(na) * o.speed;
      }
    }
    if (o.curve && o.ret === 0) {
      const na = Math.atan2(o.vy, o.vx) + o.curve * dt;
      o.vx = Math.cos(na) * o.speed; o.vy = Math.sin(na) * o.speed;
    }
    if (o.ret === 1) {
      if (!f.alive) return false;
      const dx = f.x - o.x, dy = f.y - o.y, d = Math.hypot(dx, dy);
      if (d < 1) return false;
      o.vx = (dx / d) * o.speed; o.vy = (dy / d) * o.speed;
      o.z += (chestZ(f) - o.z) * Math.min(1, dt * 6);
    }
    let mx = o.vx * dt, my = o.vy * dt;
    if (has(def, 'spiral') && !o.child) {
      const w = Math.cos(o.age * 13) * o.speed * 0.9 * dt;
      mx += (-o.vy / o.speed) * w; my += (o.vx / o.speed) * w;
    }
    if (o.drill) {
      // Drills chew through whatever stands in the way.
      if ((o.carveT -= dt) <= 0) {
        o.carveT = 0.05;
        const ux = o.vx / o.speed, uy = o.vy / o.speed;
        if (b.world.blockedSpan(o.x + ux * 0.6, o.y + uy * 0.6, o.z - 0.6, o.z + 0.6)) {
          b.world.damageSphere(o.x + ux * 0.6, o.y + uy * 0.6, o.z, o.r + 0.7, def.terrain * 0.45, f, b.stainOf(def));
          b.events.emit('drill', { x: o.x + ux * 0.6, y: o.y + uy * 0.6, z: o.z, ramp: def.ramp });
        }
      }
    } else {
      const hit = b.world.raycast(o.x, o.y, o.z, o.x + mx, o.y + my, o.z);
      if (hit) {
        terrainHit(b, o, hit.px, hit.py, hit.pz);
        if (o.bounces > 0) {
          o.bounces--;
          if (hit.nx) o.vx = -o.vx;
          if (hit.ny) o.vy = -o.vy;
          o.x = hit.px + hit.nx * 0.05; o.y = hit.py + hit.ny * 0.05;
          b.events.emit('ricochet', { x: o.x, y: o.y, z: o.z, ramp: def.ramp, el: def.elements && def.elements[0] });
          return true;
        }
        if (o.pellet) { b.events.emit('impact', { x: hit.px, y: hit.py, z: hit.pz, ramp: def.ramp, small: true, el: def.elements[0] }); return false; }
        if (def.form === 'boomerang' && o.ret === 0) { turnBack(b, o); return true; }
        if (def.form === 'hook' && !o.child) {
          grapple(b, f, hit.px + hit.nx * 0.4, hit.py + hit.ny * 0.4);
          triggerCombo(b, f, def, hit.px + hit.nx * 0.4, hit.py + hit.ny * 0.4, o.z, o.ci, Math.atan2(o.vy, o.vx));
          return false;
        }
        if (has(def, 'returning') && o.ret === 0 && !o.child) { turnBack(b, o); return true; }
        endProjectile(b, o, hit.px, hit.py, hit.pz, null);
        return false;
      }
    }
    o.x += mx; o.y += my;
    o.dist += Math.hypot(mx, my);
    // Fighters.
    const pierces = def.form === 'boomerang' || def.form === 'sniper' || o.drill || has(def, 'pierce');
    for (const t of b.fighters) {
      if (!t.alive || t.team === f.team || o.hit.has(t.id)) continue;
      if (Math.hypot(t.x - o.x, t.y - o.y) > o.r + t.radius) continue;
      if (o.z < t.z - 0.4 || o.z > t.z + t.height + 0.4) continue;
      o.hit.add(t.id);
      hitFighter(b, f, def, t, o.vx, o.vy, o.dmgMult, o);
      if (def.form === 'hook' && !o.child) {
        pull(b, t, f);
        triggerCombo(b, f, def, t.x, t.y, t.z + 1, o.ci, Math.atan2(o.vy, o.vx));
        return false;
      }
      if (pierces) {
        if (def.form === 'sniper' && !o.child) triggerCombo(b, f, def, t.x, t.y, t.z + 1, o.ci, Math.atan2(o.vy, o.vx));
        continue;
      }
      endProjectile(b, o, o.x, o.y, o.z, t);
      return false;
    }
    // Enemy turrets block shots.
    for (const tu of b.objects) {
      if (tu.kind !== 'turret' || tu.owner.team === f.team) continue;
      if (Math.hypot(tu.x - o.x, tu.y - o.y) < o.r + 0.6 && Math.abs(tu.z - o.z) < 1.5) {
        tu.hp -= (def.damage || 1) * o.dmgMult;
        if (o.drill) continue;
        endProjectile(b, o, o.x, o.y, o.z, null);
        return false;
      }
    }
    if (has(def, 'trail') && !o.child && (o.trailT -= dt) <= 0) {
      o.trailT = 0.14;
      const g = b.world.groundAt(o.x, o.y, o.z, 0);
      if (g !== -Infinity) spawnZone(b, f, def, o.x, o.y, 0.9, 1.6, 0.25, 'trail', g);
    }
    if (o.dist >= o.range && o.ret === 0) {
      if (def.form === 'boomerang' || (has(def, 'returning') && !o.child)) { turnBack(b, o); return true; }
      endProjectile(b, o, o.x, o.y, o.z, null, true);
      return false;
    }
    if (o.age > 6) return false;
    return true;
  }

  // "Subterrâneo": travels a voxel below the surface carving a trench, passes
  // under walls, knocks up whoever stands above and bursts out at the end.
  function updateBurrow(b, o, dt) {
    const def = o.def, f = o.owner, w = b.world;
    if (o.curve) {
      const na = Math.atan2(o.vy, o.vx) + o.curve * dt;
      o.vx = Math.cos(na) * o.speed; o.vy = Math.sin(na) * o.speed;
    }
    const mx = o.vx * dt, my = o.vy * dt;
    o.x += mx; o.y += my;
    o.dist += Math.hypot(mx, my);
    // Over a hole or the rim: surface.
    if (w.groundAt(o.x, o.y, o.z + 0.3, 0) < o.z - 1.2) { endProjectile(b, o, o.x, o.y, o.z + 0.5, null); return false; }
    if ((o.carveT -= dt) <= 0) {
      o.carveT = 0.05;
      w.damageSphere(o.x, o.y, o.z, 0.75, def.terrain * 0.35, f, b.stainOf(def));
      b.events.emit('burrow', { x: o.x, y: o.y, z: o.z + 0.3, ramp: def.ramp });
    }
    for (const t of b.fighters) {
      if (!t.alive || t.team === f.team || o.hit.has(t.id)) continue;
      if (Math.hypot(t.x - o.x, t.y - o.y) > o.r + t.radius || Math.abs(t.z - o.z) > 1.6) continue;
      o.hit.add(t.id);
      hitFighter(b, f, def, t, o.vx, o.vy, o.dmgMult, o);
      if (t.alive && t.grounded) { t.vz = Math.max(t.vz, 6); t.grounded = false; }
    }
    if (o.dist >= o.range) { endProjectile(b, o, o.x, o.y, o.z + 0.6, null); return false; }
    return o.age < 6;
  }

  function endProjectile(b, o, x, y, z, direct, expired) {
    const def = o.def;
    if (def.form === 'basic') { b.events.emit('impact', { x, y, z, ramp: def.ramp, small: true, el: null }); return; }
    if (o.pellet) { if (direct) b.events.emit('impact', { x, y, z, ramp: def.ramp, small: true, el: def.elements[0] }); return; }
    const angle = Math.atan2(o.vy, o.vx);
    if (expired && !has(def, 'explosive') && !has(def, 'fractal') && !o.drill) {
      b.events.emit('fizzle', { x, y, z, ramp: def.ramp, el: def.elements[0] });
      // An Épico still delivers its payload where the shot dies.
      if (!o.child) triggerCombo(b, o.owner, def, x, y, z, o.ci, angle);
      return;
    }
    impact(b, o.owner, def, x, y, z, direct, o.dmgMult, o.child, o.child ? null : o.ci, angle);
  }

  // What happens wherever a power lands (on a fighter, a wall, or the floor).
  function impact(b, f, def, x, y, z, direct, dmgMult = 1, isChild = false, ci = null, angle = null) {
    if (has(def, 'explosive') && def.blast) {
      b.explosion(x, y, z, def.blast * (isChild ? 0.6 : 1), def.damage * 0.6 * dmgMult, f, def, { exclude: direct, terrain: def.terrain * 1.2 });
    } else {
      b.events.emit('impact', { x, y, z, ramp: def.ramp, small: isChild, el: def.elements && def.elements[0] });
    }
    extras(b, f, def, x, y, z, isChild ? 0.6 : 0.9);
    if (has(def, 'fractal') && !isChild) {
      for (let i = 0; i < 3; i++) {
        const ang = b.rng.range(0, TAU);
        if (def.form === 'rain') spawnStrike(b, f, def, x + Math.cos(ang) * 1.8, y + Math.sin(ang) * 1.8, def.radius * 0.6, 0.35 + i * 0.1, 0.4, true);
        else spawnProjectile(b, f, def, ang, { child: true, size: 0.6, rangeMult: 0.4, dmgMult: 0.4, x, y, z });
      }
    }
    if (ci) triggerCombo(b, f, def, x, y, z, ci, angle);
  }

  // Side effects of a landing shared by every form: pulls, crystals, rock.
  function extras(b, f, def, x, y, z, k = 1) {
    const els = def.elements || [];
    if (els.includes('gravity') || has(def, 'magnetic')) b.vortex(x, y, z, 3.5 * k, f, 0.5, has(def, 'magnetic') ? 20 : 14);
    if (has(def, 'crystallize')) {
      const g = b.world.groundAt(x, y, z + 0.5, 0);
      if (g !== -Infinity) b.world.growSphere(x, y, g + 0.2, 1.6 * k, b.elementMat('crystal'), 6, 0.7, b.rng);
    }
    if (els[0] === 'earth' && k >= 0.9) {
      const g = b.world.groundAt(x, y, z + 0.5, 0);
      if (g !== -Infinity) b.world.growSphere(x, y, g + 0.2, 1.1 * k, b.elementMat('earth'), 6, 0.45, b.rng);
    }
  }

  function terrainHit(b, o, x, y, z) {
    const def = o.def;
    b.world.damageSphere(x, y, z, 0.9 + (o.r || 0.4) * 0.6, (def.terrain || 0.5) * (o.child || o.pellet ? 0.5 : 1), o.owner, b.stainOf(def));
  }

  function hitFighter(b, f, def, t, kx, ky, dmgMult = 1, src) {
    b.damage(t, def.damage * dmgMult, { src: f, def, kx, ky, kb: def.knock });
    if (has(def, 'chain') && !(src && src.child)) {
      // Shotgun pellets share one chain per cast.
      const ci = src && src.pellet ? src.ci : null;
      if (!ci || !ci.chained) { if (ci) ci.chained = true; chainFrom(b, f, def, t, 2); }
    }
    if (def.elements && def.elements.includes('arc') && b.rng.chance(src && src.pellet ? 0.1 : 0.35)) chainFrom(b, f, def, t, 1, 0.3);
  }

  function chainFrom(b, f, def, from, n, mult = 0.6) {
    const done = new Set([from.id]);
    let cur = from;
    for (let i = 0; i < n; i++) {
      const next = b.nearestEnemy(f, cur.x, cur.y, 5.5, done);
      if (!next) break;
      done.add(next.id);
      b.events.emit('chain', { x1: cur.x, y1: cur.y, z1: cur.z + cur.height * 0.5, x2: next.x, y2: next.y, z2: next.z + next.height * 0.5, ramp: def.ramp });
      b.damage(next, def.damage * mult, { src: f, def: Object.assign({}, def, { mods: [] }), kx: next.x - cur.x, ky: next.y - cur.y, kb: 1 });
      cur = next;
    }
  }

  function pull(b, target, toward) {
    const dx = toward.x - target.x, dy = toward.y - target.y, d = Math.hypot(dx, dy);
    if (d < 2) return;
    const travel = d - toward.radius - target.radius - 0.5, t = 0.28;
    target.forced = { vx: (dx / d) * (travel / t), vy: (dy / d) * (travel / t), t };
    target.st.stun = Math.max(target.st.stun, 0.3);
    b.events.emit('pull', { f: target, by: toward });
  }

  function grapple(b, f, x, y) {
    const dx = x - f.x, dy = y - f.y, d = Math.hypot(dx, dy);
    if (d < 2) return;
    const travel = d - f.radius - 0.3, t = 0.3;
    f.forced = { vx: (dx / d) * (travel / t), vy: (dy / d) * (travel / t), t };
    b.events.emit('grapple', { f, x, y });
  }

  // ------------------------------------------------------------- lobbed
  // A shell thrown in an arc to a point: it flies over walls (landing on top
  // of whatever column is there) and delivers its payload on landing.
  // opts: { ci, T, apex, bounces, size, dm, tele }
  function spawnLob(b, f, def, sx, sy, sz, tx, ty, payload, opts = {}) {
    const d = Math.hypot(tx - sx, ty - sy);
    const top = b.world.topAt(tx, ty);
    const tz = top === -Infinity ? sz - 9 : top;
    const T = opts.T || 0.35 + d * 0.045;
    const o = {
      kind: 'lob', owner: f, def, payload, ci: opts.ci || null, sx, sy, sz, tx, ty, tz, T, t: 0,
      apex: opts.apex || 1.5 + d * 0.25, x: sx, y: sy, z: sz, angle: Math.atan2(ty - sy, tx - sx),
      bounces: opts.bounces || 0, size: opts.size || 1, dm: opts.dm || 1, overVoid: top === -Infinity, update: updateLob,
    };
    if (opts.tele && top !== -Infinity) o.tele = b.telegraph({ x: tx, y: ty, z: tz, r: def.radius * o.size, dur: T, ramp: def.ramp, team: f.team });
    b.objects.push(o);
    return o;
  }

  function updateLob(b, o, dt) {
    o.t += dt;
    const k = Math.min(1, o.t / o.T);
    const nx = XS.lerp(o.sx, o.tx, k), ny = XS.lerp(o.sy, o.ty, k), nz = XS.lerp(o.sz, o.tz, k) + o.apex * 4 * k * (1 - k);
    const hit = k < 0.98 ? b.world.raycast(o.x, o.y, o.z, nx, ny, nz) : null;
    if (hit) {
      // Clipped a pillar mid-flight: land right there.
      if (o.tele) o.tele.age = o.tele.dur;
      land(b, o, hit.px + hit.nx * 0.3, hit.py + hit.ny * 0.3, floorAt(b, hit.px + hit.nx * 0.3, hit.py + hit.ny * 0.3, hit.pz + 0.4));
      return false;
    }
    o.x = nx; o.y = ny; o.z = nz;
    if (k < 1) return true;
    if (o.overVoid) { b.events.emit('fizzle', { x: o.x, y: o.y, z: o.z, ramp: o.def.ramp, el: o.def.elements[0] }); return false; }
    land(b, o, o.tx, o.ty, o.tz);
    return false;
  }

  function land(b, o, x, y, z) {
    const f = o.owner, def = o.def, ci = o.ci;
    switch (o.payload) {
      case 'grenade':
        if (o.bounces > 0) {
          const d = 2.4;
          spawnLob(b, f, def, x, y, z + 0.3, x + Math.cos(o.angle) * d, y + Math.sin(o.angle) * d, 'grenade', { ci, T: 0.3, apex: 1.1, bounces: o.bounces - 1, size: o.size, dm: o.dm, tele: true });
          b.events.emit('ricochet', { x, y, z: z + 0.3, ramp: def.ramp, el: def.elements[0] });
          return;
        }
        if (has(def, 'delay')) spawnBomb(b, f, def, x, y, z, ci, o.dm, o.size);
        else detonate(b, f, def, x, y, z, ci, o.dm, o.size, o.angle);
        break;
      case 'mini':
        b.explosion(x, y, z + 0.5, def.radius * 0.55, def.damage * 0.35 * o.dm, f, def, { terrain: def.terrain * 0.5, terrainZ: z + 0.1, small: true });
        break;
      case 'mine': {
        if (!f.alive && def.isSub) return;
        b.objects.push({ kind: 'mine', owner: f, def, ci, x, y, z, arm: 0.5, t: 12, dm: o.dm, update: updateMine });
        b.events.emit('land', { x, y, z, ramp: def.ramp, small: true });
        break;
      }
      case 'field': {
        const zone = spawnZone(b, f, def, x, y, def.radius * o.size, def.duration, o.dm, 'field', z);
        zone.ci = ci;
        b.events.emit('land', { x, y, z, ramp: def.ramp, splash: def.radius * o.size });
        break;
      }
      case 'singularity': spawnSingularity(b, f, def, x, y, z, o.dm, ci, o.size); break;
      case 'summon': if (f.alive) spawnTurret(b, f, def, x, y, z, o.angle, ci, o.dm); break;
    }
  }

  // Grenade/mine/meteor blast with every modifier that rides on it.
  function detonate(b, f, def, x, y, z, ci, dm, size, angle, opts = {}) {
    const r = def.radius * size;
    b.explosion(x, y, z + 0.6, r, def.damage * dm, f, def, { terrain: def.terrain * (opts.terrainMult || 1), terrainZ: z + (opts.deep ? -1.0 : -0.3), terrainR: r * (opts.deep ? 0.9 : 0.75) });
    extras(b, f, def, x, y, z, 1);
    const minis = (has(def, 'cluster') ? 4 : 0) + (has(def, 'fractal') ? 3 : 0);
    for (let i = 0; i < minis; i++) {
      const ang = (i / minis) * TAU + b.rng.range(-0.3, 0.3), d = r * 0.8 + b.rng.range(1, 2.2);
      spawnLob(b, f, def, x, y, z + 0.6, x + Math.cos(ang) * d, y + Math.sin(ang) * d, 'mini', { T: 0.45 + i * 0.04, apex: 1.8, dm });
    }
    if (ci) triggerCombo(b, f, def, x, y, z, ci, angle);
  }

  // "Retardado": a blinking charge that goes off 1.2 s later, 40% stronger.
  function spawnBomb(b, f, def, x, y, z, ci, dm, size) {
    const r = def.radius * size * 1.2;
    const tele = b.telegraph({ x, y, z, r, dur: 1.2, ramp: def.ramp, team: f.team });
    b.objects.push({ kind: 'bomb', owner: f, def, x, y, z, t: 1.2, T: 1.2, r, ci, dm, size, tele, update: updateBomb });
    b.events.emit('land', { x, y, z, ramp: def.ramp, small: true });
  }

  function updateBomb(b, o, dt) {
    if ((o.t -= dt) > 0) return true;
    detonate(b, o.owner, o.def, o.x, o.y, o.z, o.ci, o.dm * 1.4, o.size * 1.2, null);
    return false;
  }

  // --------------------------------------------------------------- beam
  function updateBeam(b, o, dt) {
    const f = o.owner, def = o.def;
    o.t += dt;
    if (!f.alive) return false;
    o.sx = f.x + Math.cos(o.angle) * f.radius * 0.7; o.sy = f.y + Math.sin(o.angle) * f.radius * 0.7; o.sz = chestZ(f);
    const ex = o.sx + Math.cos(o.angle) * def.range, ey = o.sy + Math.sin(o.angle) * def.range;
    const pierce = has(def, 'pierce');
    const hit = pierce ? null : b.world.raycast(o.sx, o.sy, o.sz, ex, ey, o.sz);
    o.ex = hit ? hit.px : ex; o.ey = hit ? hit.py : ey; o.ez = o.sz;
    o.tick -= dt;
    if (o.tick <= 0 && o.ticks < def.ticks) {
      o.tick = 0.12;
      o.ticks++;
      const len = Math.hypot(o.ex - o.sx, o.ey - o.sy) || 1;
      const ux = (o.ex - o.sx) / len, uy = (o.ey - o.sy) / len;
      for (const t of b.fighters) {
        if (!t.alive || t.team === f.team) continue;
        const px = t.x - o.sx, py = t.y - o.sy, along = px * ux + py * uy;
        if (along < 0 || along > len + t.radius) continue;
        if (Math.abs(px * uy - py * ux) > o.r + t.radius) continue;
        if (o.sz < t.z - 0.5 || o.sz > t.z + t.height + 0.5) continue;
        hitFighter(b, f, def, t, ux, uy, o.ci.dmg, o.ticks > 1 ? { child: true } : null);
      }
      if (pierce) {
        for (let s = 1; s < len; s += 1.5) b.world.damageSphere(o.sx + ux * s, o.sy + uy * s, o.sz, 0.8, def.terrain / def.ticks * 0.6, f, b.stainOf(def));
      } else b.world.damageSphere(o.ex, o.ey, o.ez, 1.1, def.terrain / def.ticks * 1.5, f, b.stainOf(def));
      if (o.ticks === def.ticks) impact(b, f, def, o.ex, o.ey, o.ez, null, o.ci.dmg, false, o.ci, o.angle);
    }
    return o.t < 0.38;
  }

  // ------------------------------------------------------- nova & cone
  function updateNova(b, o, dt) {
    const f = o.owner, def = o.def;
    if (!f.alive) return false;
    o.x = f.x; o.y = f.y; o.z = f.z;
    if (o.tele) { o.tele.x = f.x; o.tele.y = f.y; o.tele.z = f.z; }
    if ((o.t -= dt) > 0) return true;
    b.explosion(f.x, f.y, f.z + 1, o.r, def.damage * o.dm, f, def, { terrainZ: f.z + 1.6, terrainR: o.r * 0.7, terrain: def.terrain });
    extras(b, f, def, f.x, f.y, f.z + 0.5, 1);
    triggerCombo(b, f, def, f.x, f.y, f.z, o.ci, f.facing);
    return false;
  }

  function updateCone(b, o, dt) {
    const f = o.owner, def = o.def;
    if (!f.alive) return false;
    o.t += dt;
    o.tick -= dt;
    if (o.tick <= 0) {
      o.tick = def.duration / def.ticks;
      for (const t of b.fighters) {
        if (!t.alive || t.team === f.team) continue;
        const dx = t.x - f.x, dy = t.y - f.y, d = Math.hypot(dx, dy) - t.radius;
        if (d > def.range || Math.abs(t.z - f.z) > 3) continue;
        if (Math.abs(XS.angleDiff(o.angle, Math.atan2(dy, dx))) > def.angle / 2 + 0.15) continue;
        if (b.world.raycast(f.x, f.y, chestZ(f), t.x, t.y, chestZ(f))) continue;
        hitFighter(b, f, def, t, dx, dy, o.ci.dmg, { child: true });
      }
      const rr = def.range * b.rng.range(0.4, 1), aa = o.angle + b.rng.range(-def.angle / 2, def.angle / 2);
      b.world.damageSphere(f.x + Math.cos(aa) * rr, f.y + Math.sin(aa) * rr, chestZ(f), 1, def.terrain * 0.4, f, b.stainOf(def));
    }
    return o.t < def.duration;
  }

  // Ground pound: cone of damage that stuns, lifts and cracks the floor.
  function quake(b, f, def, angle, ci) {
    const half = def.angle / 2 + 0.15;
    for (const t of b.fighters) {
      if (!t.alive || t.team === f.team) continue;
      const dx = t.x - f.x, dy = t.y - f.y, d = Math.hypot(dx, dy) - t.radius;
      if (d > def.range || Math.abs(t.z - f.z) > 2.5) continue;
      if (Math.abs(XS.angleDiff(angle, Math.atan2(dy, dx))) > half) continue;
      b.damage(t, def.damage * ci.dmg, { src: f, def, kx: dx, ky: dy, kb: def.knock });
      if (!t.alive) continue;
      if (t.st.immuneStun <= 0) { t.st.stun = Math.max(t.st.stun, 0.4); t.st.immuneStun = 1.6; b.events.emit('status', { f: t, type: 'stun' }); }
      if (t.grounded) { t.vz = Math.max(t.vz, 5); t.grounded = false; }
    }
    for (let k = 0; k < 6; k++) {
      const rr = f.radius + 0.8 + (def.range - f.radius) * (k / 6), aa = angle + b.rng.range(-def.angle / 2, def.angle / 2) * (k / 6);
      b.world.damageSphere(f.x + Math.cos(aa) * rr, f.y + Math.sin(aa) * rr, f.z - 0.2, 1.1, def.terrain * 0.6, f, b.stainOf(def));
    }
    b.events.emit('quake', { f, def, angle, range: def.range, spread: def.angle });
  }

  // ----------------------------------------------------------------- wave
  // A crest running along the ground: carves a trench, climbs one-voxel
  // steps, crashes into walls and throws whoever it meets into the air.
  function spawnWave(b, f, def, angle, ci, curveSign) {
    const curve = has(def, 'curve') ? curveSign * 1.0 : 0;
    if (curve) angle -= curve * (def.range / def.speed) / 2;
    b.objects.push({
      kind: 'wave', owner: f, def, ci, x: f.x + Math.cos(angle) * f.radius, y: f.y + Math.sin(angle) * f.radius, z: f.z,
      angle, speed: def.speed, dist: 0, range: def.range, r: def.radius * ci.size, hit: new Set(), carveT: 0, trailT: 0,
      curve, burrow: has(def, 'burrow'), age: 0, update: updateWave,
    });
  }

  function updateWave(b, o, dt) {
    const def = o.def, f = o.owner, w = b.world;
    o.age += dt;
    o.angle += o.curve * dt;
    const ux = Math.cos(o.angle), uy = Math.sin(o.angle), step = o.speed * dt;
    const nx = o.x + ux * step, ny = o.y + uy * step;
    // Read the terrain just beyond the trench it is carving, so its own
    // trench never drags it down while real steps and ledges do.
    const la = o.r * 0.55 + 0.4, ax = nx + ux * la, ay = ny + uy * la;
    const g = w.groundAt(ax, ay, o.z + 1.2, 0);
    if (g === -Infinity || g < o.z - 3) return endWave(b, o);
    if (g > o.z && !o.burrow && w.blockedSpan(ax, ay, o.z + 1.2, o.z + 2.6)) {
      w.damageSphere(ax, ay, o.z + 1.5, o.r * 0.9, def.terrain, f, b.stainOf(def));
      b.events.emit('impact', { x: ax, y: ay, z: o.z + 1.5, ramp: def.ramp, el: def.elements[0] });
      return endWave(b, o);
    }
    if (!o.burrow || g < o.z) o.z = g; // burrowing waves stay low under walls
    o.x = nx; o.y = ny;
    o.dist += step;
    if ((o.carveT -= dt) <= 0) {
      o.carveT = 0.06;
      w.damageSphere(o.x, o.y, o.z - 0.4, o.r * (o.burrow ? 0.7 : 0.55), def.terrain * (o.burrow ? 0.45 : 0.35), f, b.stainOf(def));
    }
    for (const t of b.fighters) {
      if (!t.alive || t.team === f.team || o.hit.has(t.id)) continue;
      if (Math.hypot(t.x - o.x, t.y - o.y) > o.r + t.radius || Math.abs(t.z - o.z) > 2) continue;
      o.hit.add(t.id);
      hitFighter(b, f, def, t, ux, uy, o.ci.dmg, o);
      if (t.alive) { t.vz = Math.max(t.vz, 7); t.grounded = false; }
    }
    if (has(def, 'trail') && (o.trailT -= dt) <= 0) { o.trailT = 0.12; spawnZone(b, f, def, o.x, o.y, 1, 1.6, 0.25, 'trail', o.z); }
    if (o.dist >= o.range) return endWave(b, o);
    return o.age < 6;
  }

  function endWave(b, o) {
    const def = o.def, f = o.owner;
    if (has(def, 'explosive')) b.explosion(o.x, o.y, o.z + 0.8, def.blast + 0.5, def.damage * 0.6 * o.ci.dmg, f, def, { terrain: def.terrain });
    else b.events.emit('impact', { x: o.x, y: o.y, z: o.z + 0.6, ramp: def.ramp, small: true, el: def.elements[0] });
    extras(b, f, def, o.x, o.y, o.z, 0.7);
    triggerCombo(b, f, def, o.x, o.y, o.z + 0.5, o.ci, o.angle);
    return false;
  }

  // ------------------------------------------------------------- eruption
  // A row of voxel spikes bursting out of the floor one after another.
  function spawnEruption(b, f, def, x, y, z, angle, range, ci, start) {
    b.objects.push({ kind: 'erupt', owner: f, def, ci, x, y, z, angle, range, start, step: 0, t: 0, hit: new Set(), update: updateEruption });
  }

  function updateEruption(b, o, dt) {
    if ((o.t -= dt) > 0) return true;
    o.t = 0.06;
    const def = o.def, f = o.owner, w = b.world;
    const d = o.start + o.step * 1.2;
    o.step++;
    const px = o.x + Math.cos(o.angle) * d, py = o.y + Math.sin(o.angle) * d;
    if (d > o.range + o.start) {
      triggerCombo(b, f, def, px, py, o.z + 0.5, o.ci, o.angle);
      return false;
    }
    const g = w.groundAt(px, py, o.z + 2.2, 0);
    if (g === -Infinity) return true; // chasm: the row keeps going on the other side
    o.z = g;
    w.damageSphere(px, py, g + 1.4, 0.9, def.terrain * 0.6, f, b.stainOf(def));
    const mat = b.elementMat(def.elements[0]);
    const cx = Math.floor(px), cy = Math.floor(py);
    const H = o.step % 3 === 0 ? 3 : 2;
    for (let h = 0; h < H; h++) w.setTemp(cx, cy, g + h, mat, 1.6 + o.step * 0.05 + h * 0.1);
    if (b.rng.chance(0.5)) {
      const ox = b.rng.chance(0.5) ? 1 : -1;
      w.setTemp(cx + (Math.abs(Math.sin(o.angle)) > 0.7 ? ox : 0), cy + (Math.abs(Math.sin(o.angle)) > 0.7 ? 0 : ox), g, mat, 1.4);
    }
    for (const t of b.fighters) {
      if (!t.alive || t.team === f.team || o.hit.has(t.id)) continue;
      if (Math.hypot(t.x - px, t.y - py) > def.radius + t.radius || Math.abs(t.z - g) > 2.5) continue;
      o.hit.add(t.id);
      const sx = -Math.sin(o.angle), sy = Math.cos(o.angle), s = Math.sign((t.x - px) * sx + (t.y - py) * sy) || 1;
      b.damage(t, def.damage * o.ci.dmg, { src: f, def, kx: sx * s + Math.cos(o.angle) * 0.4, ky: sy * s + Math.sin(o.angle) * 0.4, kb: def.knock });
      if (t.alive) { t.vz = Math.max(t.vz, 9); t.grounded = false; }
    }
    b.events.emit('spike', { x: cx + 0.5, y: cy + 0.5, z: g, def });
    return true;
  }

  // -------------------------------------------------------------- tornado
  function spawnTornado(b, f, def, angle, ci) {
    b.objects.push({
      kind: 'tornado', owner: f, def, ci, x: f.x + Math.cos(angle) * (f.radius + 0.6), y: f.y + Math.sin(angle) * (f.radius + 0.6), z: f.z,
      angle, t: def.duration, dur: def.duration, tick: 0.15, r: def.radius * ci.size, nibble: 0, trailT: 0, spin: 0, update: updateTornado,
    });
  }

  function updateTornado(b, o, dt) {
    const def = o.def, f = o.owner, w = b.world;
    o.t -= dt; o.tick -= dt; o.nibble -= dt;
    o.spin += dt;
    if (has(def, 'homing')) {
      const t = b.nearestEnemy(f, o.x, o.y, 10);
      if (t) o.angle = XS.turnToward(o.angle, Math.atan2(t.y - o.y, t.x - o.x), 1.8 * dt);
    }
    const nx = o.x + Math.cos(o.angle) * def.speed * dt, ny = o.y + Math.sin(o.angle) * def.speed * dt;
    if (w.blockedSpan(nx, ny, o.z + 1.1, o.z + 2.6)) {
      // Grinds through walls instead of passing them.
      if (o.nibble <= 0) { o.nibble = 0.15; w.damageSphere(nx, ny, o.z + 1.6, o.r * 0.7, def.terrain * 0.6, f, b.stainOf(def)); }
    } else {
      o.x = nx; o.y = ny;
      const g = w.groundAt(nx, ny, o.z + 1.2, 0);
      if (g !== -Infinity && g > o.z - 3) o.z = g;
    }
    for (const t of b.fighters) {
      if (!t.alive || t.team === f.team) continue;
      const dx = o.x - t.x, dy = o.y - t.y, d = Math.hypot(dx, dy);
      if (d > o.r * 1.7 + t.radius || Math.abs(t.z - o.z) > 3) continue;
      if (d > 0.5) {
        t.kx += ((dx / d) * 12 + (-dy / d) * 6) * dt;
        t.ky += ((dy / d) * 12 + (dx / d) * 6) * dt;
      }
      if (o.tick <= 0 && d < o.r + t.radius) b.damage(t, def.damage * o.ci.dmg, { src: f, def, kx: -dy, ky: dx, kb: def.knock });
    }
    if (o.tick <= 0) {
      o.tick = XS.Power.FORMS.tornado.tick;
      const a = b.rng.range(0, TAU);
      w.damageSphere(o.x + Math.cos(a) * o.r * 0.6, o.y + Math.sin(a) * o.r * 0.6, o.z + 0.4, 0.9, def.terrain * 0.4, f, b.stainOf(def));
    }
    if (has(def, 'trail') && (o.trailT -= dt) <= 0) { o.trailT = 0.2; spawnZone(b, f, def, o.x, o.y, 1.1, 1.6, 0.25, 'trail', o.z); }
    if (o.t <= 0) {
      b.events.emit('impact', { x: o.x, y: o.y, z: o.z + 1, ramp: def.ramp, el: def.elements[0] });
      triggerCombo(b, f, def, o.x, o.y, o.z + 0.5, o.ci, o.angle);
      return false;
    }
    return true;
  }

  // ---------------------------------------------------------- singularity
  function spawnSingularity(b, f, def, x, y, z, dm, ci, size) {
    b.objects.push({ kind: 'sing', owner: f, def, ci, x, y, z: z + 1.2, ground: z, r: def.radius * size, t: def.duration, dur: def.duration, tick: 0.2, dm, nibble: 0.2, update: updateSingularity });
    b.events.emit('land', { x, y, z, ramp: def.ramp, splash: def.radius * size });
  }

  function updateSingularity(b, o, dt) {
    const def = o.def, f = o.owner;
    o.t -= dt; o.tick -= dt; o.nibble -= dt;
    const reach = o.r * 1.4;
    for (const t of b.fighters) {
      if (!t.alive || t.team === f.team) continue;
      const dx = o.x - t.x, dy = o.y - t.y, d = Math.hypot(dx, dy);
      if (d > reach + t.radius || Math.abs(t.z - o.ground) > 3) continue;
      if (d > 0.7) { const s = 22 * (1 - 0.5 * d / reach); t.kx += (dx / d) * s * dt; t.ky += (dy / d) * s * dt; }
      if (o.tick <= 0 && d < o.r + t.radius) b.damage(t, def.damage * o.dm, { src: f, def, kx: dx, ky: dy, kb: 0 });
    }
    if (o.tick <= 0) o.tick = def.tick || XS.Power.FORMS.singularity.tick;
    if (o.nibble <= 0) {
      o.nibble = 0.25;
      const a = b.rng.range(0, TAU), rr = b.rng.range(0.6, o.r);
      b.world.damageSphere(o.x + Math.cos(a) * rr, o.y + Math.sin(a) * rr, o.ground + 0.3, 0.9, def.terrain * 0.3, f, b.stainOf(def));
    }
    if (o.t > 0) return true;
    // Implosion: one last crush and a crater.
    b.explosion(o.x, o.y, o.z, o.r * 0.6, def.damage * o.dm, f, def, { terrain: def.terrain * 1.4, terrainZ: o.ground - 0.4, terrainR: o.r * 0.55, kbMult: 0 });
    triggerCombo(b, f, def, o.x, o.y, o.ground + 0.5, o.ci, 0);
    return false;
  }

  // --------------------------------------------------------------- meteor
  function spawnMeteor(b, f, def, x, y, ci, extraDelay) {
    const top = b.world.topAt(x, y);
    const z = top === -Infinity ? f.z : top;
    const delayed = has(def, 'delay');
    const T = 1.2 + (delayed ? 1.2 : 0) + extraDelay;
    const r = def.radius * ci.size * (delayed ? 1.2 : 1);
    const tele = b.telegraph({ x, y, z, r, dur: T, ramp: def.ramp, team: f.team });
    b.objects.push({ kind: 'meteor', owner: f, def, ci, x, y, z, r, t: T, T, dm: ci.dmg * (delayed ? 1.4 : 1), tele, update: updateMeteor });
  }

  function updateMeteor(b, o, dt) {
    if ((o.t -= dt) > 0) return true;
    const top = b.world.topAt(o.x, o.y);
    const z = top === -Infinity ? o.z - 2 : top;
    detonate(b, o.owner, o.def, o.x, o.y, z, o.ci, o.dm, o.r / o.def.radius, null, { deep: true });
    b.events.emit('meteor', { x: o.x, y: o.y, z, r: o.r, def: o.def });
    return false;
  }

  // ------------------------------------------------------ zones & strikes
  function spawnZone(b, f, def, x, y, r, dur, dmgMult, tag, z) {
    const g = z != null ? z : b.world.groundAt(x, y, f.z + 3, 0);
    const o = { kind: 'zone', tag, owner: f, def, x, y, z: g === -Infinity ? f.z : g, r, t: dur, dur, tick: 0.25, dmgMult, ci: null, update: updateZone };
    b.objects.push(o);
    return o;
  }

  function updateZone(b, o, dt) {
    const f = o.owner, def = o.def;
    o.t -= dt;
    o.tick -= dt;
    const pulls = o.tag === 'field' && (has(def, 'magnetic') || def.elements.includes('gravity'));
    for (const t of b.fighters) {
      if (!t.alive || t.team === f.team) continue;
      const dx = o.x - t.x, dy = o.y - t.y, d = Math.hypot(dx, dy);
      if (d > o.r + t.radius * 0.5 || Math.abs(t.z - o.z) > 2.5) continue;
      if (pulls && d > 0.3) { t.kx += (dx / d) * 14 * dt; t.ky += (dy / d) * 14 * dt; }
      if (o.tick <= 0) b.damage(t, def.damage * o.dmgMult, { src: f, def: o.tag === 'trail' ? Object.assign({}, def, { status: [] }) : def, kx: -dx, ky: -dy, kb: def.knock * 0.3 });
    }
    if (o.tick <= 0) {
      o.tick = 0.5;
      if (o.tag === 'field' && def.terrain > 0) {
        const a = b.rng.range(0, TAU), rr = b.rng.range(0, o.r);
        b.world.damageSphere(o.x + Math.cos(a) * rr, o.y + Math.sin(a) * rr, o.z - 0.5, 0.9, def.terrain * 0.5, f, b.stainOf(def));
      }
    }
    if (o.t > 0) return true;
    if (o.ci) triggerCombo(b, f, def, o.x, o.y, o.z, o.ci, null);
    return false;
  }

  function spawnStrike(b, f, def, x, y, r, delay, dmgMult, isChild) {
    const g = b.world.groundAt(x, y, f.z + 6, 0);
    const z = g === -Infinity ? f.z : g;
    const tele = b.telegraph({ x, y, z, r, dur: delay, ramp: def.ramp, team: f.team });
    b.objects.push({ kind: 'strike', owner: f, def, x, y, z, r, t: delay, delay, dmgMult, child: !!isChild, tele, update: updateStrike });
  }

  function updateStrike(b, o, dt) {
    o.t -= dt;
    if (o.t > 0) return true;
    const def = o.def, f = o.owner;
    b.explosion(o.x, o.y, o.z + 0.6, o.r, def.damage * o.dmgMult, f, def, { terrain: def.terrain * (o.child ? 0.5 : 1), terrainR: o.r * 0.8, small: o.child });
    if (!o.child) {
      extras(b, f, def, o.x, o.y, o.z, 1);
      if (has(def, 'fractal')) impact(b, f, def, o.x, o.y, o.z, null, 1, false);
    }
    return false;
  }

  // --------------------------------------------------------------- dash
  function updateDash(b, f, dt) {
    const D = f.dash, def = D.def, dm = D.ci ? D.ci.dmg : 1;
    D.t -= dt;
    for (const t of b.fighters) {
      if (!t.alive || t.team === f.team || D.hit.has(t.id)) continue;
      if (Math.hypot(t.x - f.x, t.y - f.y) > def.radius + t.radius || Math.abs(t.z - f.z) > 2.5) continue;
      D.hit.add(t.id);
      hitFighter(b, f, def, t, D.vx, D.vy, dm);
    }
    if (D.blocked) {
      b.world.damageSphere(f.x + Math.sign(D.vx) * f.radius, f.y + Math.sign(D.vy) * f.radius, f.z + 1, 1.6, def.terrain, f, b.stainOf(def));
      D.t = 0;
    }
    if (has(def, 'trail') && (D.trailT -= dt) <= 0) {
      D.trailT = 0.06;
      spawnZone(b, f, def, f.x, f.y, 1, 1.8, 0.25, 'trail', f.z);
    }
    if (D.t <= 0) {
      f.dash = null;
      if (has(def, 'explosive')) b.explosion(f.x, f.y, f.z + 1, def.blast, def.damage * 0.6 * dm, f, def, { terrain: def.terrain });
      extras(b, f, def, f.x, f.y, f.z, 1);
      triggerCombo(b, f, def, f.x, f.y, f.z, D.ci, Math.atan2(D.vy, D.vx));
      return { x: 0, y: 0 };
    }
    return { x: D.vx, y: D.vy };
  }

  // -------------------------------------------------------------- orbit
  function updateOrbit(b, o, dt) {
    const f = o.owner, def = o.def;
    if (!f.alive) return false;
    o.t -= dt;
    o.ang += dt * 3.2;
    o.nibble -= dt;
    o.trailT -= dt;
    o.orbs = o.orbs || [];
    for (let i = 0; i < def.count; i++) {
      const a = o.ang + (i / def.count) * TAU;
      const x = f.x + Math.cos(a) * def.orbit, y = f.y + Math.sin(a) * def.orbit, z = chestZ(f);
      o.orbs[i] = { x, y, z };
      for (const t of b.fighters) {
        if (!t.alive || t.team === f.team) continue;
        if (Math.hypot(t.x - x, t.y - y) > def.radius + t.radius || z < t.z - 0.5 || z > t.z + t.height + 0.5) continue;
        const key = t.id * 10 + i;
        if (b.time - (o.last.get(key) || -9) < 0.6) continue;
        o.last.set(key, b.time);
        hitFighter(b, f, def, t, t.x - f.x, t.y - f.y, 1, { child: true });
      }
      if (o.nibble <= 0) b.world.damageSphere(x, y, z, def.radius + 0.4, def.terrain * 0.4, f, b.stainOf(def));
      if (has(def, 'trail') && o.trailT <= 0) spawnZone(b, f, def, x, y, 0.8, 1.2, 0.2, 'trail', f.z);
    }
    if (o.nibble <= 0) o.nibble = 0.3;
    if (o.trailT <= 0) o.trailT = 0.25;
    return o.t > 0;
  }

  // ------------------------------------------------------------- turret
  function spawnTurret(b, f, def, x, y, z, aim, ci, dm = 1) {
    const shotDef = Object.assign({}, def, { form: 'bolt', speed: 15, range: 13, radius: 0.35, mods: def.mods.filter((m) => m === 'vampiric'), combo: null });
    b.objects.push({ kind: 'turret', owner: f, def, ci, x, y, z: z + 1.2, t: def.duration, shot: 0.5, hp: Math.max(12, def.damage * 4), aim, dm, shotDef, update: updateTurret });
    b.events.emit('land', { x, y, z, ramp: def.ramp });
  }

  function updateTurret(b, o, dt) {
    const f = o.owner, def = o.def;
    o.t -= dt;
    if (o.hp <= 0 || o.t <= 0 || !f.alive) {
      b.events.emit('impact', { x: o.x, y: o.y, z: o.z, ramp: def.ramp, el: def.elements[0] });
      if (f.alive) triggerCombo(b, f, def, o.x, o.y, o.z - 1.2, o.ci, o.aim);
      return false;
    }
    const target = b.nearestEnemy(f, o.x, o.y, 13);
    if (target) o.aim = Math.atan2(target.y - o.y, target.x - o.x);
    o.shot -= dt;
    if (o.shot <= 0 && target) {
      o.shot = def.tick || XS.Power.FORMS.summon.tick;
      if (!b.world.raycast(o.x, o.y, o.z, target.x, target.y, target.z + target.height * 0.5)) {
        const lead = Math.hypot(target.x - o.x, target.y - o.y) / 15;
        const ang = Math.atan2(target.y + target.vy * lead - o.y, target.x + target.vx * lead - o.x);
        spawnProjectile(b, f, o.shotDef, ang, { x: o.x, y: o.y, z: o.z, dmgMult: o.dm });
        b.events.emit('turretShot', { o });
      }
    }
    return true;
  }

  // --------------------------------------------------------------- mine
  function updateMine(b, o, dt) {
    const f = o.owner, def = o.def;
    o.t -= dt;
    if (o.arm > 0) { o.arm -= dt; return true; }
    if (o.fuse != null) {
      if ((o.fuse -= dt) > 0) return true;
      detonate(b, f, def, o.x, o.y, o.z, o.ci, (o.dm || 1) * 1.4, 1.2, null);
      return false;
    }
    if (o.t <= 0) return false;
    if (b.world.topAt(o.x, o.y) < o.z - 0.5) return false; // floor under it destroyed
    for (const t of b.fighters) {
      if (!t.alive || t.team === f.team) continue;
      if (Math.hypot(t.x - o.x, t.y - o.y) > 1.3 + t.radius || Math.abs(t.z - o.z) > 2) continue;
      if (has(def, 'delay')) {
        o.fuse = 1.2;
        o.tele = b.telegraph({ x: o.x, y: o.y, z: o.z, r: def.radius * 1.2, dur: 1.2, ramp: def.ramp, team: f.team });
        return true;
      }
      detonate(b, f, def, o.x, o.y, o.z, o.ci, o.dm || 1, 1, null);
      return false;
    }
    return true;
  }

  // --------------------------------------------------------------- wall
  function buildWall(b, f, def, x, y, gz, angle, dm = 1) {
    const px = -Math.sin(angle), py = Math.cos(angle);
    const mat = b.elementMat(def.elements[0]);
    const H = XS.Power.FORMS.wall.height;
    const cells = new Set();
    const hitIds = new Set();
    for (let s = -def.length / 2; s <= def.length / 2; s += 0.5) {
      const cx = Math.floor(x + px * s), cy = Math.floor(y + py * s);
      if (cells.has(cx + ',' + cy)) continue;
      cells.add(cx + ',' + cy);
      const top = b.world.groundAt(cx + 0.5, cy + 0.5, gz + 2, 0);
      if (top === -Infinity) continue;
      for (let h = 0; h < H; h++) b.world.setTemp(cx, cy, top + h, mat, def.duration + h * 0.15);
      for (const t of b.fighters) {
        if (!t.alive || Math.hypot(t.x - (cx + 0.5), t.y - (cy + 0.5)) > t.radius + 0.8) continue;
        if (t.team === f.team) { t.z = top + H; continue; } // allies get lifted onto it
        if (hitIds.has(t.id)) continue;
        hitIds.add(t.id);
        const side = Math.sign((t.x - x) * Math.cos(angle) + (t.y - y) * Math.sin(angle)) || 1;
        b.damage(t, def.damage * dm, { src: f, def, kx: Math.cos(angle) * side, ky: Math.sin(angle) * side, kb: def.knock });
      }
    }
    b.events.emit('wall', { f, x, y, ramp: def.ramp });
  }

  // -------------------------------------------------------------- blink
  function blink(b, f, def, ctx) {
    const p = pointFor(f, def, ctx);
    let spot = { x: p.x, y: p.y, z: b.world.groundAt(p.x, p.y, f.z + 4, 0) };
    if (spot.z === -Infinity || b.world.blockedSpan(p.x, p.y, spot.z, spot.z + 3)) spot = b.world.findSafeSpot(p.x, p.y, 3, b.rng);
    if (Math.hypot(spot.x - f.x, spot.y - f.y) > def.range + 3) spot = { x: f.x, y: f.y, z: f.z };
    b.events.emit('blink', { f, x1: f.x, y1: f.y, z1: f.z, x2: spot.x, y2: spot.y, z2: spot.z, ramp: def.ramp });
    f.x = spot.x; f.y = spot.y; f.z = spot.z; f.vz = 0; f.kx = f.ky = 0;
    f.inv = Math.max(f.inv, 0.25);
    const ci = ctx.ci;
    if (has(def, 'delay')) { spawnBomb(b, f, def, f.x, f.y, f.z, ci, ci.dmg, 1); return; }
    b.explosion(f.x, f.y, f.z + 1, def.radius, def.damage * ci.dmg, f, def, { terrainZ: f.z + 1.5, terrainR: def.radius * 0.6, terrain: def.terrain });
    if (has(def, 'explosive')) b.explosion(f.x, f.y, f.z + 1, def.blast + 1, def.damage * 0.5 * ci.dmg, f, def, { terrain: def.terrain });
    extras(b, f, def, f.x, f.y, f.z, 1);
    triggerCombo(b, f, def, f.x, f.y, f.z, ci, ctx.angle);
  }

  // --------------------------------------------------------------- aura
  function startAura(b, f, def) {
    const e = def.elements[0], d = def.duration, s = f.st;
    f.aura = { def, t: d, pulse: 0.3 };
    if (e === 'crystal') { s.shield = Math.max(s.shield, f.maxHp * 0.25); s.shieldT = d; }
    if (e === 'cryo') s.armor = d;
    if (e === 'earth') { s.armor = d; s.heavy = d; }
    if (e === 'chrono') s.haste = d;
    if (e === 'void') s.lifesteal = d;
    if (e === 'bio') { s.regen = d; s.regenHps = (f.maxHp * 0.025); }
    b.events.emit('aura', { f, def });
  }

  function updateAura(b, f, dt) {
    const A = f.aura, def = A.def;
    A.t -= dt;
    A.pulse -= dt;
    if (A.pulse <= 0) {
      A.pulse = XS.Power.FORMS.aura.tick;
      const e = def.elements[0];
      for (const t of b.fighters) {
        if (!t.alive || t.team === f.team) continue;
        const dx = t.x - f.x, dy = t.y - f.y, d = Math.hypot(dx, dy);
        if (d > def.radius + t.radius || Math.abs(t.z - f.z) > 3) continue;
        b.damage(t, def.damage, { src: f, def, kx: dx, ky: dy, kb: e === 'sonic' ? def.knock * 2 : def.knock });
        if (e === 'gravity' && d > 0.5) { t.kx -= (dx / d) * 9; t.ky -= (dy / d) * 9; }
      }
      b.events.emit('auraPulse', { f, def });
    }
    if (A.t <= 0) f.aura = null;
  }

  function updateVortex(b, o, dt) {
    o.t -= dt;
    for (const t of b.fighters) {
      if (!t.alive || (o.owner && t.team === o.owner.team)) continue;
      const dx = o.x - t.x, dy = o.y - t.y, d = Math.hypot(dx, dy);
      if (d > o.r || d < 0.4) continue;
      t.kx += (dx / d) * o.strength * dt * 2;
      t.ky += (dy / d) * o.strength * dt * 2;
    }
    return o.t > 0;
  }

  XS.Powers = { cast, spawnProjectile, updateDash, updateAura, updateVortex, impact, triggerCombo };
})(globalThis.XS = globalThis.XS || {});
