// Combat rules: shooting with accuracy rolls, damage, deaths, bites and infection, noise that
// draws zombies, explosions, acid projectiles and the gas-station hazard.
(function (UB) {
  'use strict';
  const { WEAPONS, ROLES, RANKS, ZOMBIES, BAL, WEATHER, POIS } = UB.DEF;
  const W = UB.World;

  // Noise makes nearby wandering or idle zombies come and investigate.
  function noise(S, x, y, r) {
    r *= (WEATHER[S.weather] || WEATHER.clear).noise;
    S._zgrid.query(x, y, r, (z) => {
      if (z.dead || z.state === 'chase' || z.state === 'attackS' || z.state === 'horde') return false;
      z.state = 'investigate';
      z.gx = x + S.rng.range(-1.5, 1.5);
      z.gy = y + S.rng.range(-1.5, 1.5);
      z.path = null;
      return false;
    });
  }

  function isLit(S, x, y) {
    if (UB.Waves.daylight(S) > 0.5) return true;
    const i = W.idx(S, Math.floor(x), Math.floor(y));
    return !!S._light[i];
  }

  function hitChance(S, u, w, tx, ty, moving) {
    let p = w.acc + (ROLES[u.role].acc || 0) + RANKS[u.rank].acc;
    if (!w.melee && !isLit(S, tx, ty)) p *= 0.75;
    if (moving) p *= 0.8;
    if (S.morale < 30) p *= 0.9;
    const d = Math.hypot(tx - u.x, ty - u.y);
    if (!w.melee && d > w.range * 0.7) p *= 0.85;
    return Math.max(0.05, Math.min(0.97, p));
  }

  // A survivor attacks a zombie (or a nest POI). Returns true when an attack was made.
  function attack(S, u, target, moving) {
    const w = WEAPONS[u.weapon];
    const melee = w.melee || u.ammo <= 0;
    const wpn = melee ? WEAPONS.bat : w;
    const tx = target.kind === 'poi' ? target.tx + target.w / 2 : target.x;
    const ty = target.kind === 'poi' ? target.ty + target.h / 2 : target.y;
    u.cd = wpn.cd;
    u.facing = UB.Units.facingOf(tx - u.x, ty - u.y);
    u.shootT = S.time;
    if (melee) {
      UB.Game.fx(S, { t: 'melee', x: tx, y: ty });
      if (target.kind === 'poi') hurtPoi(S, target, wpn.dmg, u);
      else if (S.rng.chance(hitChance(S, u, wpn, tx, ty, false))) hurtZombie(S, target, wpn.dmg + RANKS[u.rank].hp * 0.1, u, false);
      return true;
    }
    u.ammo -= 1;
    S.stats.shots = (S.stats.shots || 0) + 1;
    const ox = u.inside ? 0 : 0, sz = u.inside ? 1.6 : 0.55;
    if (target.kind === 'poi') {
      const hit = S.rng.chance(0.9);
      UB.Game.fx(S, { t: 'shot', w: u.weapon, x0: u.x + ox, y0: u.y, x1: tx, y1: ty, hit, z: sz });
      if (hit) hurtPoi(S, target, wpn.dmg * (wpn.pellets || 1) * 0.6, u);
    } else if (wpn.pellets) {
      // Shotgun: pellets spread over zombies inside a cone toward the target.
      const ang = Math.atan2(ty - u.y, tx - u.x);
      const victims = [target];
      S._zgrid.query(u.x, u.y, wpn.range, (z) => {
        if (z === target || z.dead || victims.length >= 3) return false;
        let da = Math.atan2(z.y - u.y, z.x - u.x) - ang;
        while (da > Math.PI) da -= Math.PI * 2;
        while (da < -Math.PI) da += Math.PI * 2;
        if (Math.abs(da) < wpn.cone) victims.push(z);
        return false;
      });
      for (let k = 0; k < wpn.pellets; k++) {
        const z = victims[k % victims.length];
        if (z.dead) continue;
        const d = Math.hypot(z.x - u.x, z.y - u.y);
        const hit = S.rng.chance(hitChance(S, u, wpn, z.x, z.y, moving));
        if (k < victims.length) UB.Game.fx(S, { t: 'shot', w: 'shotgun', x0: u.x, y0: u.y, x1: z.x, y1: z.y, hit, z: sz });
        if (hit) hurtZombie(S, z, wpn.dmg * (1 - 0.45 * (d / wpn.range)), u, false);
      }
    } else {
      const hit = S.rng.chance(hitChance(S, u, wpn, tx, ty, moving));
      UB.Game.fx(S, { t: 'shot', w: u.weapon, x0: u.x, y0: u.y, x1: tx, y1: ty, hit, z: sz });
      if (hit) hurtZombie(S, target, wpn.dmg, u, !!wpn.pierce);
    }
    if (S.time - (u.noiseT || -99) > 0.5) { u.noiseT = S.time; noise(S, u.x, u.y, wpn.noise); }
    gasHazard(S, tx, ty);
    if (u.ammo === 0 && !u.inside) UB.Game.msg(S, `${u.name} ficou sem munição e passou para o taco.`, 'warn', u.x, u.y);
    return true;
  }

  // Shots near the pumps of an intact gas station can set it off.
  function gasHazard(S, x, y) {
    for (const p of S.pois) {
      if (p.type !== 'gas' || p.exploded || p.dead) continue;
      const cx = p.tx + p.w / 2, cy = p.ty + p.h / 2;
      if (Math.hypot(cx - x, cy - y) > 3.2) continue;
      if (!S.rng.chance(0.035)) continue;
      p.exploded = true;
      p.searchesLeft = Math.min(p.searchesLeft, 1);
      UB.Game.msg(S, 'O posto de combustível explodiu!', 'bad', cx, cy);
      explode(S, cx, cy, 4.5, 140, null);
    }
  }

  function hurtZombie(S, z, dmg, src, pierce) {
    if (z.dead) return;
    const def = ZOMBIES[z.type];
    if (def.armor && !pierce) dmg *= 1 - def.armor;
    z.hp -= dmg;
    z.hitT = S.time;
    if (src && src.kind === 'unit' && !src.inside && !src.dead && z.state !== 'attackS' && z.state !== 'chase') {
      z.state = 'chase'; z.target = src.id; z.path = null;
    }
    if (z.hp <= 0) killZombie(S, z, src);
  }

  function killZombie(S, z, src) {
    if (z.dead) return;
    z.dead = true;
    S.stats.kills++;
    const def = ZOMBIES[z.type];
    if (src && src.kind === 'unit') {
      src.kills++;
      src.xp += def.cost;
      UB.Units.checkRank(S, src);
    }
    UB.Game.fx(S, { t: 'zdie', x: z.x, y: z.y, type: z.type, f: z.facing });
    if (def.explode) explode(S, z.x, z.y, def.explode.r, def.explode.dmg, null);
    if (def.boss) UB.Game.msg(S, 'O Colosso caiu!', 'good', z.x, z.y);
  }

  function hurtPoi(S, p, dmg, src) {
    if (p.dead || !POIS[p.type].nest) return;
    p.hp -= dmg;
    p.hitT = S.time;
    if (p.hp <= 0) {
      p.dead = true;
      S.stats.nests = (S.stats.nests || 0) + 1;
      for (let y = p.ty; y < p.ty + p.h; y++) for (let x = p.tx; x < p.tx + p.w; x++) {
        const i = W.idx(S, x, y);
        if (S._occ[i] === p.id) S._occ[i] = 0;
        S.map.terrain[i] = UB.DEF.T.RUBBLE;
      }
      W.refreshArea(S, p.tx, p.ty, p.w, p.h);
      UB.Game.fx(S, { t: 'terrain', x: p.tx, y: p.ty, w: p.w, h: p.h });
      UB.Game.fx(S, { t: 'explode', x: p.tx + 1, y: p.ty + 1, r: 2, gore: true });
      UB.Game.msg(S, 'Ninho destruído! (+500 pontos)', 'good', p.tx + 1, p.ty + 1);
      if (src && src.kind === 'unit') { src.xp += 10; UB.Units.checkRank(S, src); }
    }
  }

  function hurtUnit(S, u, dmg, z, ranged) {
    if (u.dead) return;
    if (u.inside) {
      const b = W.get(S, u.inside);
      if (b && b.type === 'tower') dmg *= 0.4;
    } else if (ranged && UB.Units.inCover(S, u)) dmg *= 0.7;
    u.hp -= dmg;
    u.hitT = S.time;
    if (z && !ranged && u.infected < 0 && S.rng.chance(ZOMBIES[z.type].bite)) {
      u.infected = BAL.infectTime;
      UB.Game.msg(S, `${u.name} foi mordido(a)! Trate com remédios (médico ou enfermaria) em até 5 min.`, 'bad', u.x, u.y);
    }
    if (u.hp <= 0) killUnit(S, u, z ? `Morto(a) por um ${ZOMBIES[z.type].name.toLowerCase()}` : 'Ferimentos');
  }

  function killUnit(S, u, cause) {
    if (u.dead) return;
    u.dead = true;
    UB.Units.leaveBuilding(S, u);
    S.stats.deaths++;
    S._diedTonight = true;
    UB.Eco.changeMorale(S, -10);
    S.memorial.push({ name: u.name, role: u.role, day: S.day, cause: cause || 'Desconhecida', kills: u.kills });
    UB.Game.fx(S, { t: 'udie', x: u.x, y: u.y, role: u.role, f: u.facing });
    UB.Game.msg(S, `${u.name} morreu (${(cause || '').toLowerCase()}).`, 'bad', u.x, u.y);
    dropPack(S, u);
    if (u.infected >= 0) {
      UB.Zombies.spawn(S, 'walker', u.x, u.y, { state: 'wander', turned: u.name });
      UB.Game.msg(S, `${u.name} se transformou!`, 'bad', u.x, u.y);
    }
  }

  // A fallen survivor's backpack stays on the ground as a crate that can be recovered.
  function dropPack(S, u) {
    const total = Object.values(u.pack).reduce((a, b) => a + b, 0) + (u.carry ? u.carry.amt : 0);
    if (!total) return;
    const contents = Object.assign({}, u.pack);
    if (u.carry) contents[u.carry.res] = (contents[u.carry.res] || 0) + u.carry.amt;
    const p = W.nearestOpen(S, u.x, u.y, false, 3);
    if (!p) return;
    const i = W.idx(S, p.x, p.y);
    if (S.map.feature[i]) return;
    W.setFeature(S, p.x, p.y, UB.DEF.F.CRATE, 2);
    S.drops[i] = contents;
  }

  function explode(S, x, y, r, dmg, src) {
    UB.Game.fx(S, { t: 'explode', x, y, r });
    S._zgrid.query(x, y, r, (z, d2) => { if (!z.dead) hurtZombie(S, z, dmg * (1 - 0.5 * Math.sqrt(d2) / r), src, true); return false; });
    S._ugrid.query(x, y, r, (u, d2) => { if (!u.dead) hurtUnit(S, u, dmg * 0.6 * (1 - 0.5 * Math.sqrt(d2) / r), null, true); return false; });
    for (const b of S.buildings) {
      if (b.dead) continue;
      const cx = Math.max(b.tx, Math.min(x, b.tx + b.w)), cy = Math.max(b.ty, Math.min(y, b.ty + b.h));
      if (Math.hypot(cx - x, cy - y) <= r) UB.Buildings.damage(S, b, dmg * 1.2);
    }
    noise(S, x, y, r * 6);
  }

  // Acid globs from spitters arc over walls and land after a short flight.
  function spit(S, z, tx, ty) {
    const d = Math.hypot(tx - z.x, ty - z.y);
    S.proj.push({ x0: z.x, y0: z.y, x1: tx, y1: ty, t: 0, T: Math.max(0.25, d / 6), dmg: ZOMBIES[z.type].dmg });
    UB.Game.fx(S, { t: 'spit', x: z.x, y: z.y });
  }
  function tickProjectiles(S, dt) {
    for (const p of S.proj) {
      p.t += dt;
      if (p.t < p.T) continue;
      p.done = true;
      UB.Game.fx(S, { t: 'acid', x: p.x1, y: p.y1 });
      S._ugrid.query(p.x1, p.y1, 0.8, (u) => { hurtUnit(S, u, p.dmg, null, true); return false; });
      const i = W.idx(S, Math.floor(p.x1), Math.floor(p.y1));
      const occ = S._occ[i];
      if (occ) {
        const b = W.get(S, occ);
        if (b && b.kind === 'bld') {
          UB.Buildings.damage(S, b, p.dmg * 1.5);
          for (const id of b.garrison) { const u = W.get(S, id); if (u) hurtUnit(S, u, p.dmg * 0.6, null, true); }
        }
      }
    }
    if (S.proj.some((p) => p.done)) S.proj = S.proj.filter((p) => !p.done);
  }

  UB.Combat = { noise, isLit, hitChance, attack, hurtZombie, killZombie, hurtPoi, hurtUnit, killUnit, explode, spit, tickProjectiles, gasHazard };
})(globalThis.UB = globalThis.UB || {});
