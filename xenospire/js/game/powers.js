// Runtime of procedural powers: every form spawns objects into the battle and
// every modifier hooks into those objects' movement, impacts and hits.
(function (XS) {
  'use strict';

  const has = (def, m) => def.mods && def.mods.includes(m);
  const chestZ = (f) => f.z + Math.min(1.6, f.height * 0.45);

  // ------------------------------------------------------------ casting
  function cast(b, f, def, aim) {
    const ctx = { angle: aim.angle, dist: aim.dist };
    doCast(b, f, def, ctx);
    if (has(def, 'mirrored')) doCast(b, f, def, { angle: ctx.angle + Math.PI, dist: ctx.dist, mirrored: true });
    if (has(def, 'echo')) {
      b.schedule(0.6, () => {
        if (!f.alive) return;
        doCast(b, f, def, { angle: ctx.angle, dist: ctx.dist, echo: true });
        b.events.emit('echo', { f, def });
      });
    }
  }

  function pointFor(f, def, ctx) {
    const d = XS.clamp(ctx.dist != null ? ctx.dist : def.range * 0.7, 1, def.range || 6);
    return { x: f.x + Math.cos(ctx.angle) * d, y: f.y + Math.sin(ctx.angle) * d };
  }

  function doCast(b, f, def, ctx) {
    const a = ctx.angle;
    switch (def.form) {
      case 'bolt': case 'boomerang': case 'hook': {
        const n = def.count, spread = n > 1 ? 0.28 : 0;
        for (let i = 0; i < n; i++) spawnProjectile(b, f, def, a + (i - (n - 1) / 2) * spread, {});
        break;
      }
      case 'beam': {
        const n = def.count;
        for (let i = 0; i < n; i++) b.objects.push({ kind: 'beam', owner: f, def, angle: a + (i - (n - 1) / 2) * 0.3, t: 0, tick: 0, ticks: 0, sx: f.x, sy: f.y, sz: chestZ(f), ex: f.x, ey: f.y, ez: chestZ(f), update: updateBeam });
        break;
      }
      case 'nova': {
        const o = { kind: 'nova', owner: f, def, t: 0.28, x: f.x, y: f.y, z: f.z, update: updateNova };
        b.objects.push(o);
        o.tele = b.telegraph({ x: f.x, y: f.y, z: f.z, r: def.radius, dur: 0.3, ramp: def.ramp, follow: f, team: f.team });
        break;
      }
      case 'cone':
        b.objects.push({ kind: 'cone', owner: f, def, angle: a, t: 0, tick: 0, update: updateCone });
        break;
      case 'field': {
        const p = pointFor(f, def, ctx);
        spawnZone(b, f, def, p.x, p.y, def.radius, def.duration, 1, 'field');
        break;
      }
      case 'rain': {
        const p = pointFor(f, def, ctx);
        for (let i = 0; i < def.count; i++) {
          const ang = b.rng.range(0, Math.PI * 2), rr = Math.sqrt(b.rng.next()) * def.spread;
          spawnStrike(b, f, def, p.x + Math.cos(ang) * rr, p.y + Math.sin(ang) * rr, def.radius, 0.55 + i * 0.14, 1);
        }
        break;
      }
      case 'dash': {
        const sp = def.range / 0.26 * (has(def, 'swift') ? 1.2 : 1);
        f.dash = { def, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, t: def.range / sp, hit: new Set(), trailT: 0, blocked: false };
        f.inv = Math.max(f.inv, 0.12);
        break;
      }
      case 'orbit':
        b.objects = b.objects.filter((o) => !(o.kind === 'orbit' && o.owner === f));
        b.objects.push({ kind: 'orbit', owner: f, def, t: def.duration, ang: 0, last: new Map(), nibble: 0, trailT: 0, update: updateOrbit });
        break;
      case 'summon': {
        const p = pointFor(f, def, ctx);
        for (let i = 0; i < def.count; i++) {
          const ox = def.count > 1 ? (i - 0.5) * 2.2 : 0;
          const x = p.x + Math.cos(a + Math.PI / 2) * ox, y = p.y + Math.sin(a + Math.PI / 2) * ox;
          const g = b.world.groundAt(x, y, f.z + 3, 0);
          b.objects.push({ kind: 'turret', owner: f, def, x, y, z: (g === -Infinity ? f.z : g) + 1.2, t: def.duration, shot: 0.5, hp: def.damage * 4, aim: a, update: updateTurret });
        }
        break;
      }
      case 'mine': {
        const p = pointFor(f, def, ctx);
        for (let i = 0; i < def.count; i++) {
          const ang = (i / def.count) * Math.PI * 2 + a, rr = def.count > 1 ? 1.7 : 0;
          const x = p.x + Math.cos(ang) * rr, y = p.y + Math.sin(ang) * rr;
          const g = b.world.groundAt(x, y, f.z + 2, 0);
          if (g === -Infinity) continue;
          b.objects.push({ kind: 'mine', owner: f, def, x, y, z: g, arm: 0.6, t: 12, update: updateMine });
        }
        break;
      }
      case 'wall': buildWall(b, f, def, ctx); break;
      case 'blink': blink(b, f, def, ctx); break;
      case 'aura': startAura(b, f, def); break;
    }
  }

  // ---------------------------------------------------------- projectiles
  function spawnProjectile(b, f, def, angle, opts) {
    const speed = (def.speed || 14) * (opts.speedMult || 1);
    const o = {
      kind: 'proj', owner: f, def, x: f.x + Math.cos(angle) * f.radius * 0.8, y: f.y + Math.sin(angle) * f.radius * 0.8, z: opts.z != null ? opts.z : chestZ(f),
      vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, speed, r: (def.radius || 0.4) * (opts.size || 1),
      dist: 0, range: (def.range || 10) * (opts.rangeMult || 1), hit: new Set(), bounces: has(def, 'ricochet') ? 3 : 0,
      ret: 0, age: 0, trailT: 0, dmgMult: opts.dmgMult || 1, child: !!opts.child, update: updateProjectile,
    };
    if (opts.x != null) { o.x = opts.x; o.y = opts.y; }
    b.objects.push(o);
    return o;
  }

  function updateProjectile(b, o, dt) {
    const def = o.def, f = o.owner;
    o.age += dt;
    if (has(def, 'homing') && o.ret === 0 && !o.child) {
      const t = b.nearestEnemy(f, o.x, o.y, 12, o.hit);
      if (t) {
        const want = Math.atan2(t.y - o.y, t.x - o.x), cur = Math.atan2(o.vy, o.vx);
        const na = XS.turnToward(cur, want, 4.5 * dt);
        o.vx = Math.cos(na) * o.speed; o.vy = Math.sin(na) * o.speed;
      }
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
    // Voxel collision.
    const hit = b.world.raycast(o.x, o.y, o.z, o.x + mx, o.y + my, o.z);
    if (hit) {
      terrainHit(b, o, hit.px, hit.py, hit.pz);
      if (o.bounces > 0) {
        o.bounces--;
        if (hit.nx) o.vx = -o.vx;
        if (hit.ny) o.vy = -o.vy;
        o.x = hit.px + hit.nx * 0.05; o.y = hit.py + hit.ny * 0.05;
        b.events.emit('ricochet', { x: o.x, y: o.y, z: o.z, ramp: def.ramp });
        return true;
      }
      if (def.form === 'boomerang' && o.ret === 0) { o.ret = 1; o.hit.clear(); return true; }
      if (def.form === 'hook' && !o.child) { grapple(b, f, hit.px + hit.nx * 0.4, hit.py + hit.ny * 0.4); return false; }
      if (has(def, 'returning') && o.ret === 0 && !o.child) { o.ret = 1; o.hit.clear(); return true; }
      endProjectile(b, o, hit.px, hit.py, hit.pz, null);
      return false;
    }
    o.x += mx; o.y += my;
    o.dist += Math.hypot(mx, my);
    // Fighters.
    for (const t of b.fighters) {
      if (!t.alive || t.team === f.team || o.hit.has(t.id)) continue;
      if (Math.hypot(t.x - o.x, t.y - o.y) > o.r + t.radius) continue;
      if (o.z < t.z - 0.4 || o.z > t.z + t.height + 0.4) continue;
      o.hit.add(t.id);
      hitFighter(b, f, def, t, o.vx, o.vy, o.dmgMult, o);
      if (def.form === 'hook' && !o.child) { pull(b, t, f); return false; }
      if (def.form === 'boomerang' || has(def, 'pierce')) continue;
      endProjectile(b, o, o.x, o.y, o.z, t);
      return false;
    }
    // Enemy turrets block shots.
    for (const tu of b.objects) {
      if (tu.kind !== 'turret' || tu.owner.team === f.team || o.hit.has('t' + tu.x)) continue;
      if (Math.hypot(tu.x - o.x, tu.y - o.y) < o.r + 0.6 && Math.abs(tu.z - o.z) < 1.5) {
        tu.hp -= def.damage * o.dmgMult;
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
      if (def.form === 'boomerang' || (has(def, 'returning') && !o.child)) { o.ret = 1; o.hit.clear(); return true; }
      endProjectile(b, o, o.x, o.y, o.z, null, true);
      return false;
    }
    if (o.age > 6) return false;
    return true;
  }

  function endProjectile(b, o, x, y, z, direct, expired) {
    const def = o.def;
    if (def.form === 'basic') { b.events.emit('impact', { x, y, z, ramp: def.ramp, small: true }); return; }
    if (expired && !has(def, 'explosive') && !has(def, 'fractal')) { b.events.emit('fizzle', { x, y, z, ramp: def.ramp }); return; }
    impact(b, o.owner, def, x, y, z, direct, o.dmgMult, o.child);
  }

  // What happens wherever a power lands (on a fighter, a wall, or the floor).
  function impact(b, f, def, x, y, z, direct, dmgMult = 1, isChild = false) {
    if (has(def, 'explosive') && def.blast) {
      b.explosion(x, y, z, def.blast * (isChild ? 0.6 : 1), def.damage * 0.6 * dmgMult, f, def, { exclude: direct, terrain: def.terrain * 1.2 });
    } else {
      b.events.emit('impact', { x, y, z, ramp: def.ramp, small: isChild });
    }
    if (def.elements && def.elements.includes('gravity') || has(def, 'magnetic')) b.vortex(x, y, z, 3.4, f, 0.5, has(def, 'magnetic') ? 20 : 13);
    if (has(def, 'crystallize')) {
      const g = b.world.groundAt(x, y, z + 0.5, 0);
      if (g !== -Infinity) b.world.growSphere(x, y, g + 0.2, isChild ? 0.9 : 1.4, b.elementMat('crystal'), 6, 0.75, b.rng);
    }
    if (has(def, 'fractal') && !isChild) {
      for (let i = 0; i < 3; i++) {
        const ang = b.rng.range(0, Math.PI * 2);
        if (def.form === 'rain' || def.form === 'mine') spawnStrike(b, f, def, x + Math.cos(ang) * 1.8, y + Math.sin(ang) * 1.8, def.radius * 0.6, 0.35 + i * 0.1, 0.4, true);
        else spawnProjectile(b, f, def, ang, { child: true, size: 0.6, rangeMult: 0.4, dmgMult: 0.4, x, y, z });
      }
    }
  }

  function terrainHit(b, o, x, y, z) {
    const def = o.def;
    b.world.damageSphere(x, y, z, 0.9 + (o.r || 0.4) * 0.6, (def.terrain || 0.5) * (o.child ? 0.5 : 1), o.owner);
  }

  function hitFighter(b, f, def, t, kx, ky, dmgMult = 1, src) {
    b.damage(t, def.damage * dmgMult, { src: f, def, kx, ky, kb: def.knock });
    if (has(def, 'chain') && !(src && src.child)) chainFrom(b, f, def, t, 2);
    if (def.elements && def.elements.includes('arc') && b.rng.chance(0.35)) chainFrom(b, f, def, t, 1, 0.3);
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
        if (Math.abs(px * uy - py * ux) > def.radius + t.radius) continue;
        if (o.sz < t.z - 0.5 || o.sz > t.z + t.height + 0.5) continue;
        hitFighter(b, f, def, t, ux, uy, 1, o.ticks > 1 ? { child: true } : null);
      }
      if (pierce) {
        for (let s = 1; s < len; s += 1.5) b.world.damageSphere(o.sx + ux * s, o.sy + uy * s, o.sz, 0.8, def.terrain / def.ticks * 0.6, f);
      } else b.world.damageSphere(o.ex, o.ey, o.ez, 1.1, def.terrain / def.ticks * 1.5, f);
      if (o.ticks === def.ticks) impact(b, f, def, o.ex, o.ey, o.ez, null);
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
    b.explosion(f.x, f.y, f.z + 1, def.radius, def.damage, f, def, { terrainZ: f.z + 1.6, terrainR: def.radius * 0.7, terrain: def.terrain });
    impactExtras(b, f, def, f.x, f.y, f.z + 0.5);
    return false;
  }

  // Modifier side effects for forms whose main hit is already area damage.
  function impactExtras(b, f, def, x, y, z) {
    if (def.elements.includes('gravity') || has(def, 'magnetic')) b.vortex(x, y, z, 3.6, f, 0.5, 18);
    if (has(def, 'crystallize')) {
      const g = b.world.groundAt(x, y, z + 1, 0);
      if (g !== -Infinity) b.world.growSphere(x, y, g + 0.2, 1.6, b.elementMat('crystal'), 6, 0.6, b.rng);
    }
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
        hitFighter(b, f, def, t, dx, dy, 1, { child: true });
      }
      const rr = def.range * b.rng.range(0.4, 1), aa = o.angle + b.rng.range(-def.angle / 2, def.angle / 2);
      b.world.damageSphere(f.x + Math.cos(aa) * rr, f.y + Math.sin(aa) * rr, chestZ(f), 1, def.terrain * 0.4, f);
    }
    return o.t < def.duration;
  }

  // ------------------------------------------------------ zones & strikes
  function spawnZone(b, f, def, x, y, r, dur, dmgMult, tag, z) {
    const g = z != null ? z : b.world.groundAt(x, y, f.z + 3, 0);
    const o = { kind: 'zone', tag, owner: f, def, x, y, z: g === -Infinity ? f.z : g, r, t: dur, dur, tick: 0.25, dmgMult, update: updateZone };
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
        const a = b.rng.range(0, Math.PI * 2), rr = b.rng.range(0, o.r);
        b.world.damageSphere(o.x + Math.cos(a) * rr, o.y + Math.sin(a) * rr, o.z - 0.5, 0.9, def.terrain * 0.5, f);
      }
    }
    return o.t > 0;
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
      impactExtras(b, f, def, o.x, o.y, o.z);
      if (has(def, 'fractal')) impact(b, f, def, o.x, o.y, o.z, null, 1, false);
    }
    return false;
  }

  // --------------------------------------------------------------- dash
  function updateDash(b, f, dt) {
    const D = f.dash, def = D.def;
    D.t -= dt;
    for (const t of b.fighters) {
      if (!t.alive || t.team === f.team || D.hit.has(t.id)) continue;
      if (Math.hypot(t.x - f.x, t.y - f.y) > def.radius + t.radius || Math.abs(t.z - f.z) > 2.5) continue;
      D.hit.add(t.id);
      hitFighter(b, f, def, t, D.vx, D.vy);
    }
    if (D.blocked) {
      b.world.damageSphere(f.x + Math.sign(D.vx) * f.radius, f.y + Math.sign(D.vy) * f.radius, f.z + 1, 1.6, def.terrain, f);
      D.t = 0;
    }
    if (has(def, 'trail') && (D.trailT -= dt) <= 0) {
      D.trailT = 0.06;
      spawnZone(b, f, def, f.x, f.y, 1, 1.8, 0.25, 'trail', f.z);
    }
    if (D.t <= 0) {
      f.dash = null;
      if (has(def, 'explosive')) b.explosion(f.x, f.y, f.z + 1, def.blast, def.damage * 0.6, f, def, { terrain: def.terrain });
      impactExtras(b, f, def, f.x, f.y, f.z);
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
      const a = o.ang + (i / def.count) * Math.PI * 2;
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
      if (o.nibble <= 0) b.world.damageSphere(x, y, z, def.radius + 0.4, def.terrain * 0.4, f);
      if (has(def, 'trail') && o.trailT <= 0) spawnZone(b, f, def, x, y, 0.8, 1.2, 0.2, 'trail', f.z);
    }
    if (o.nibble <= 0) o.nibble = 0.3;
    if (o.trailT <= 0) o.trailT = 0.25;
    return o.t > 0;
  }

  // ------------------------------------------------------------- turret
  function updateTurret(b, o, dt) {
    const f = o.owner, def = o.def;
    o.t -= dt;
    if (o.hp <= 0 || o.t <= 0 || !f.alive) { b.events.emit('impact', { x: o.x, y: o.y, z: o.z, ramp: def.ramp }); return false; }
    const target = b.nearestEnemy(f, o.x, o.y, 13);
    if (target) o.aim = Math.atan2(target.y - o.y, target.x - o.x);
    o.shot -= dt;
    if (o.shot <= 0 && target) {
      o.shot = XS.Power.FORMS.summon.tick;
      if (!b.world.raycast(o.x, o.y, o.z, target.x, target.y, target.z + target.height * 0.5)) {
        const lead = Math.hypot(target.x - o.x, target.y - o.y) / 15;
        const ang = Math.atan2(target.y + target.vy * lead - o.y, target.x + target.vx * lead - o.x);
        const shotDef = Object.assign({}, def, { form: 'bolt', speed: 15, range: 13, radius: 0.35, mods: def.mods.filter((m) => m === 'vampiric') });
        spawnProjectile(b, f, shotDef, ang, { x: o.x, y: o.y, z: o.z });
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
    if (o.t <= 0) return false;
    if (b.world.topAt(o.x, o.y) < o.z - 0.5) return false; // floor under it destroyed
    for (const t of b.fighters) {
      if (!t.alive || t.team === f.team) continue;
      if (Math.hypot(t.x - o.x, t.y - o.y) > 1.3 + t.radius || Math.abs(t.z - o.z) > 2) continue;
      if (has(def, 'magnetic')) b.vortex(o.x, o.y, o.z, 3.5, f, 0.4, 22);
      b.explosion(o.x, o.y, o.z + 0.6, def.radius, def.damage, f, def, { terrain: def.terrain });
      impactExtras(b, f, def, o.x, o.y, o.z);
      if (has(def, 'fractal')) impact(b, f, def, o.x, o.y, o.z, null);
      return false;
    }
    return true;
  }

  // --------------------------------------------------------------- wall
  function buildWall(b, f, def, ctx) {
    const p = pointFor(f, def, ctx);
    const px = -Math.sin(ctx.angle), py = Math.cos(ctx.angle);
    const mat = b.elementMat(def.elements[0]);
    const H = XS.Power.FORMS.wall.height;
    const cells = new Set();
    for (let s = -def.length / 2; s <= def.length / 2; s += 0.5) {
      const x = Math.floor(p.x + px * s), y = Math.floor(p.y + py * s);
      if (cells.has(x + ',' + y)) continue;
      cells.add(x + ',' + y);
      const top = b.world.groundAt(x + 0.5, y + 0.5, f.z + 2, 0);
      if (top === -Infinity) continue;
      for (let h = 0; h < H; h++) b.world.setTemp(x, y, top + h, mat, def.duration + h * 0.15);
      for (const t of b.fighters) {
        if (!t.alive || Math.hypot(t.x - (x + 0.5), t.y - (y + 0.5)) > t.radius + 0.8) continue;
        if (t.team === f.team) { t.z = top + H; continue; } // allies get lifted onto it
        const side = Math.sign((t.x - p.x) * Math.cos(ctx.angle) + (t.y - p.y) * Math.sin(ctx.angle)) || 1;
        b.damage(t, def.damage, { src: f, def, kx: Math.cos(ctx.angle) * side, ky: Math.sin(ctx.angle) * side, kb: def.knock });
      }
    }
    b.events.emit('wall', { f, x: p.x, y: p.y, ramp: def.ramp });
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
    b.explosion(f.x, f.y, f.z + 1, def.radius, def.damage, f, def, { terrainZ: f.z + 1.5, terrainR: def.radius * 0.6, terrain: def.terrain });
    if (has(def, 'explosive')) b.explosion(f.x, f.y, f.z + 1, def.blast + 1, def.damage * 0.5, f, def, { terrain: def.terrain });
    impactExtras(b, f, def, f.x, f.y, f.z);
  }

  // --------------------------------------------------------------- aura
  function startAura(b, f, def) {
    const e = def.elements[0], d = def.duration, s = f.st;
    f.aura = { def, t: d, pulse: 0.3 };
    if (e === 'crystal') { s.shield = Math.max(s.shield, f.maxHp * 0.25); s.shieldT = d; }
    if (e === 'cryo') s.armor = d;
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

  XS.Powers = { cast, spawnProjectile, updateDash, updateAura, updateVortex, impact };
})(globalThis.XS = globalThis.XS || {});
