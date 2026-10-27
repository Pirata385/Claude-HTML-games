// Player structures: placement on the grid, construction, upgrades, repairs, demolition,
// damage and the behaviour of defensive buildings (turrets, spike traps, radio, lights).
(function (UB) {
  'use strict';
  const { BUILDINGS, BAL, FEATURE, T, CRAFT, BLUEPRINTS } = UB.DEF;
  const W = UB.World;
  const lvl = (b) => BUILDINGS[b.type].levels[b.level - 1];
  const done = (b) => b.built >= 1 && !b.dead;
  const center = (b) => ({ x: b.tx + b.w / 2, y: b.ty + b.h / 2 });

  function addCost(into, cost) { for (const k in cost) into[k] = (into[k] || 0) + cost[k]; return into; }

  function create(S, type, tx, ty, opts) {
    const def = BUILDINGS[type];
    const L = def.levels[0];
    const built = opts && opts.built;
    const b = {
      id: W.nextId(S), kind: 'bld', type, tx, ty, w: def.size, h: def.size, level: 1,
      hp: built ? L.hp : 1, maxHp: L.hp, built: built ? 1 : 0, prog: 0,
      workers: [], garrison: [], patients: [], on: true, cd: 0, prodT: 0, burnT: 0, craft: null,
      powered: false, invested: addCost({}, L.cost), dir: 0, repDebt: {}, dead: false,
    };
    S.buildings.push(b);
    W.register(S, b);
    W.stampFootprint(S, b, b.id);
    W.refreshArea(S, tx, ty, b.w, b.h);
    return b;
  }

  // Returns {ok, reason} for placing a structure with its top-left tile at (tx, ty).
  function canPlace(S, type, tx, ty) {
    const def = BUILDINGS[type];
    if (!def || type === 'hq') return { ok: false, reason: 'Inválido' };
    if (def.requires && !S.unlocked[def.requires]) return { ok: false, reason: `Requer ${BLUEPRINTS[def.requires]} (explore)` };
    const n = def.size;
    for (let y = ty; y < ty + n; y++) for (let x = tx; x < tx + n; x++) {
      if (!W.inb(S, x, y)) return { ok: false, reason: 'Fora do mapa' };
      const i = W.idx(S, x, y);
      if (!S.map.explored[i]) return { ok: false, reason: 'Área inexplorada' };
      if (!W.inTerritory(S, x + 0.5, y + 0.5)) return { ok: false, reason: 'Fora do território (melhore o QG)' };
      if (S._occ[i]) return { ok: false, reason: 'Espaço ocupado' };
      const t = S.map.terrain[i];
      if (t === T.WATER || t === T.TOXIC) return { ok: false, reason: 'Terreno impróprio' };
      const f = FEATURE[S.map.feature[i]];
      if (f && (f.block || f.hazard)) return { ok: false, reason: `Remova: ${f.name.toLowerCase()}` };
    }
    return { ok: true };
  }

  function place(S, type, tx, ty) {
    const chk = canPlace(S, type, tx, ty);
    if (!chk.ok) return chk;
    const cost = BUILDINGS[type].levels[0].cost;
    if (!UB.Eco.spend(S, cost)) return { ok: false, reason: `Falta ${UB.Eco.missing(S, cost)}` };
    const n = BUILDINGS[type].size;
    for (let y = ty; y < ty + n; y++) for (let x = tx; x < tx + n; x++) {
      const i = W.idx(S, x, y);
      if (S.map.feature[i]) W.setFeature(S, x, y, 0, 0);
    }
    const b = create(S, type, tx, ty, { built: false });
    return { ok: true, b };
  }

  // Tiles of a 4-connected line, so walls drawn diagonally still form a solid barrier.
  function lineTiles(x0, y0, x1, y1) {
    const out = [];
    let x = x0, y = y0;
    const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0), sx = Math.sign(x1 - x0), sy = Math.sign(y1 - y0);
    let err = dx - dy;
    out.push([x, y]);
    let guard = 0;
    while ((x !== x1 || y !== y1) && guard++ < 400) {
      const e2 = 2 * err;
      if (e2 > -dy) { err -= dy; x += sx; } else { err += dx; y += sy; }
      out.push([x, y]);
    }
    return out;
  }
  function placeLine(S, type, x0, y0, x1, y1) {
    let placed = 0, reason = '';
    for (const [x, y] of lineTiles(x0, y0, x1, y1)) {
      const r = place(S, type, x, y);
      if (r.ok) placed++;
      else if (!reason && r.reason !== 'Espaço ocupado') reason = r.reason;
    }
    return { ok: placed > 0, placed, reason };
  }

  const buildNeed = (b) => Math.max(20, b.maxHp * 0.2);
  // Construction progress from a worker. Hit points grow with progress.
  function addBuild(S, b, pts) {
    if (b.built >= 1) return true;
    const need = buildNeed(b);
    b.prog += pts;
    b.hp = Math.min(b.maxHp, b.hp + (b.maxHp * pts) / need);
    b.built = Math.min(1, b.prog / need);
    if (b.built >= 1) complete(S, b);
    return b.built >= 1;
  }
  function complete(S, b) {
    b.built = 1;
    W.refreshArea(S, b.tx, b.ty, b.w, b.h);
    // Survivors standing inside a new blocking structure step out.
    for (const u of S.units) {
      if (u.dead || u.inside) continue;
      if (u.x >= b.tx && u.x < b.tx + b.w && u.y >= b.ty && u.y < b.ty + b.h) {
        const p = W.nearestOpen(S, u.x, u.y, false, 4);
        if (p) { u.x = p.x + 0.5; u.y = p.y + 0.5; u.path = null; }
      }
    }
    S.stats.built++;
    UB.Game.fx(S, { t: 'built', id: b.id, x: b.tx + b.w / 2, y: b.ty + b.h / 2 });
    UB.Eco.updatePower(S);
    if (BUILDINGS[b.type].size > 1) UB.Game.msg(S, `${BUILDINGS[b.type].name} concluído(a).`, 'good', b.tx + b.w / 2, b.ty + b.h / 2);
  }

  // Repairs `amount` hit points, paying a share of the build cost. Returns false when broke.
  function repair(S, b, amount) {
    if (b.hp >= b.maxHp) return true;
    amount = Math.min(amount, b.maxHp - b.hp);
    const base = BUILDINGS[b.type].levels[0].cost;
    const perHp = {};
    for (const k in base) perHp[k] = (base[k] * BAL.repairCostFactor * b.level) / b.maxHp;
    for (const k in perHp) {
      b.repDebt[k] = (b.repDebt[k] || 0) + perHp[k] * amount;
      const whole = Math.floor(b.repDebt[k]);
      if (whole > 0) {
        if (S.res[k] < whole) { b.repDebt[k] -= perHp[k] * amount; return false; }
        S.res[k] -= whole;
        b.repDebt[k] -= whole;
      }
    }
    b.hp = Math.min(b.maxHp, b.hp + amount);
    return true;
  }

  function upgrade(S, b) {
    const def = BUILDINGS[b.type];
    if (!done(b)) return { ok: false, reason: 'Ainda em construção' };
    if (b.level >= def.levels.length) return { ok: false, reason: 'Nível máximo' };
    const next = def.levels[b.level];
    if (!UB.Eco.spend(S, next.cost)) return { ok: false, reason: `Falta ${UB.Eco.missing(S, next.cost)}` };
    const old = lvl(b);
    b.level++;
    b.maxHp = next.hp;
    b.hp = Math.min(b.maxHp, b.hp + (next.hp - old.hp));
    addCost(b.invested, next.cost);
    UB.Game.fx(S, { t: 'built', id: b.id, x: b.tx + b.w / 2, y: b.ty + b.h / 2 });
    UB.Eco.updatePower(S);
    S._structVersion++;
    return { ok: true };
  }

  function demolish(S, b) {
    if (b.type === 'hq') return { ok: false, reason: 'O QG não pode ser demolido' };
    UB.Eco.refund(S, b.invested, b.built >= 1 ? BAL.demolishRefund : 1);
    remove(S, b);
    return { ok: true };
  }

  function evict(S, b, hurt) {
    for (const id of [...b.garrison, ...b.workers, ...b.patients]) {
      const u = W.get(S, id);
      if (!u) continue;
      UB.Units.leaveBuilding(S, u);
      if (hurt) UB.Combat.hurtUnit(S, u, hurt, null);
    }
    b.garrison = []; b.workers = []; b.patients = [];
  }

  function remove(S, b) {
    evict(S, b, 0);
    b.dead = true;
    for (let y = b.ty; y < b.ty + b.h; y++) for (let x = b.tx; x < b.tx + b.w; x++) {
      const i = W.idx(S, x, y);
      if (S._occ[i] === b.id) S._occ[i] = 0;
    }
    W.refreshArea(S, b.tx, b.ty, b.w, b.h);
    UB.Eco.updatePower(S);
  }

  function damage(S, b, dmg) {
    if (b.dead) return;
    b.hp -= dmg;
    b.hitT = S.time;
    if (b.type !== 'hq' && b.hp < b.maxHp * 0.35 && !b.warned) {
      b.warned = true;
      UB.Game.msg(S, `${BUILDINGS[b.type].name} muito danificado(a)!`, 'warn', b.tx + b.w / 2, b.ty + b.h / 2);
    }
    if (b.hp > b.maxHp * 0.5) b.warned = false;
    if (b.type === 'hq' && b.hp < b.maxHp * 0.5 && S.tick - (S._hqMsgT || -9999) > 300) {
      S._hqMsgT = S.tick;
      UB.Game.msg(S, 'O QG está sob ataque!', 'bad', b.tx + 1.5, b.ty + 1.5);
    }
    if (b.hp <= 0) destroy(S, b);
  }

  function destroy(S, b) {
    const c = center(b);
    UB.Game.fx(S, { t: 'collapse', x: c.x, y: c.y, w: b.w });
    if (b.type === 'hq') {
      S.over = S.over || 'hq';
      UB.Game.msg(S, 'O QG caiu. A base foi tomada.', 'bad', c.x, c.y);
    } else if (b.built >= 1) {
      UB.Game.msg(S, `${BUILDINGS[b.type].name} destruído(a)!`, 'bad', c.x, c.y);
    }
    evict(S, b, 15);
    remove(S, b);
  }

  function craft(S, b, item) {
    const c = CRAFT[item];
    if (!c || b.type !== 'workshop') return { ok: false, reason: 'Inválido' };
    if (b.level < c.level) return { ok: false, reason: `Requer Oficina nível ${c.level}` };
    if (b.craft) return { ok: false, reason: 'A oficina já está fabricando' };
    if (!UB.Eco.spend(S, c.cost)) return { ok: false, reason: `Falta ${UB.Eco.missing(S, c.cost)}` };
    b.craft = { item, t: c.time };
    return { ok: true };
  }

  function slots(b) {
    const L = lvl(b);
    if (b.type === 'tower') return L.slots;
    if (b.type === 'infirmary') return L.patients;
    return L.workers || 0;
  }

  // Lit tiles at night: the HQ's lamps, powered spotlights and fires.
  function computeLights(S) {
    const N = S.map.w;
    S._light.fill(0);
    const stamp = (cx, cy, r) => {
      const r2 = r * r;
      for (let y = Math.max(0, Math.floor(cy - r)); y <= Math.min(N - 1, Math.ceil(cy + r)); y++)
        for (let x = Math.max(0, Math.floor(cx - r)); x <= Math.min(N - 1, Math.ceil(cx + r)); x++)
          if ((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= r2) S._light[y * N + x] = 1;
    };
    for (const b of S.buildings) {
      if (!done(b)) continue;
      const c = center(b);
      if (b.type === 'hq') stamp(c.x, c.y, BUILDINGS.hq.light);
      else if (b.type === 'spotlight' && b.powered) stamp(c.x, c.y, lvl(b).light);
    }
    const f = S.map.feature;
    for (let i = 0; i < f.length; i++) if (f[i] === UB.DEF.F.FIRE) stamp((i % N) + 0.5, ((i / N) | 0) + 0.5, 4);
  }

  function tick(S, dt) {
    if (S.tick % 20 === 0) computeLights(S);
    for (const b of S.buildings) {
      if (b.dead || b.built < 1) continue;
      const L = lvl(b);
      if (b.type === 'turret') {
        b.cd -= dt;
        if (!b.powered || !b.on) continue;
        const c = center(b);
        const tgt = S._zgrid.nearest(c.x, c.y, L.range, (z) => !z.dead);
        if (!tgt) continue;
        b.dir = UB.Units.facingOf(tgt.x - c.x, tgt.y - c.y);
        if (b.cd > 0) continue;
        if (S.res.ammo <= 0) {
          if (S.tick - (S._ammoMsgT || -9999) > 400) { S._ammoMsgT = S.tick; UB.Game.msg(S, 'Metralhadoras sem munição!', 'bad', c.x, c.y); }
          continue;
        }
        S.res.ammo -= 1;
        b.cd = L.cd;
        const hit = S.rng.chance(0.8);
        UB.Game.fx(S, { t: 'shot', w: 'turret', x0: c.x, y0: c.y, x1: tgt.x, y1: tgt.y, hit, z: 0.9 });
        if (hit) UB.Combat.hurtZombie(S, tgt, L.dmg, null, false);
        if (S.tick % 10 === 0) UB.Combat.noise(S, c.x, c.y, 9);
      } else if (b.type === 'spikes') {
        const c = center(b);
        S._zgrid.query(c.x, c.y, 0.75, (z) => {
          if (z.dead) return false;
          UB.Combat.hurtZombie(S, z, L.dps * dt, null, false);
          b.hp -= 2.5 * dt * (UB.DEF.ZOMBIES[z.type].boss ? 4 : 1);
          return false;
        });
        if (b.hp <= 0) destroy(S, b);
      } else if (b.type === 'gate') {
        if (S.tick % 5 === 0) b.open = !!S._ugrid.nearest(b.tx + 0.5, b.ty + 0.5, 1.3, (u) => !u.dead);
      } else if (b.type === 'radio') {
        if (b.powered && UB.Waves.isNight(S)) {
          b.prodT = (b.prodT || 0) + dt;
          if (b.prodT >= 25) {
            b.prodT = 0;
            UB.Combat.noise(S, b.tx + 1, b.ty + 1, 30);
            UB.Game.fx(S, { t: 'radio', x: b.tx + 1, y: b.ty + 1 });
          }
        }
      }
    }
  }

  UB.Buildings = { create, canPlace, place, placeLine, lineTiles, addBuild, buildNeed, complete, repair, upgrade, demolish, remove, damage, destroy, craft, slots, computeLights, tick, lvl, done, center };
})(globalThis.UB = globalThis.UB || {});
