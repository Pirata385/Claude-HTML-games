// Resources, storage, power, production, healing and the dawn upkeep (food, hunger, morale).
(function (UB) {
  'use strict';
  const { RES, RES_NAME, BUILDINGS, BAL, CRAFT } = UB.DEF;

  const lvl = (b) => BUILDINGS[b.type].levels[b.level - 1];
  const done = (b) => b.built >= 1 && !b.dead;

  function cap(S) {
    let c = 0;
    for (const b of S.buildings) {
      if (!done(b)) continue;
      if (b.type === 'hq' || b.type === 'depot') c += lvl(b).cap;
    }
    return c;
  }
  function beds(S) {
    let c = 0;
    for (const b of S.buildings) if (done(b) && (b.type === 'hq' || b.type === 'shelter')) c += lvl(b).beds;
    return c;
  }
  function population(S) { return S.units.filter((u) => !u.dead).length; }

  // Adds up to n of a resource, limited by storage. Returns the amount actually stored.
  function add(S, res, n) {
    if (n <= 0) return 0;
    const room = Math.max(0, cap(S) - S.res[res]);
    const got = Math.min(room, n);
    S.res[res] += got;
    if (got < n && S.tick - (S._fullMsgT || -9999) > 200) {
      S._fullMsgT = S.tick;
      UB.Game.msg(S, `Estoque de ${RES_NAME[res].toLowerCase()} cheio: construa ou melhore depósitos.`, 'warn');
    }
    return got;
  }
  function can(S, cost) {
    for (const k in cost) if ((S.res[k] || 0) < cost[k]) return false;
    return true;
  }
  function spend(S, cost) {
    if (!can(S, cost)) return false;
    for (const k in cost) S.res[k] -= cost[k];
    return true;
  }
  function refund(S, cost, frac) {
    for (const k in cost) add(S, k, Math.floor(cost[k] * frac));
  }
  function missing(S, cost) {
    const out = [];
    for (const k in cost) if ((S.res[k] || 0) < cost[k]) out.push(`${cost[k] - S.res[k]} ${RES_NAME[k].toLowerCase()}`);
    return out.join(', ');
  }

  // Morale multiplier on work speed and a small accuracy effect.
  function moraleMul(S) { return S.morale < 30 ? 0.75 : S.morale > 80 ? 1.15 : 1; }
  function changeMorale(S, d) { S.morale = Math.max(0, Math.min(100, S.morale + d)); }

  // Power: generators supply, consumers are served in priority order.
  const POWER_ORDER = ['turret', 'spotlight', 'infirmary', 'workshop', 'radio'];
  function updatePower(S) {
    let supply = 0;
    for (const b of S.buildings) {
      if (b.type !== 'generator' || !done(b)) continue;
      b.running = b.on && (S.res.fuel > 0 || b.burnT > 0);
      if (b.running) supply += lvl(b).supply;
    }
    let demand = 0, used = 0;
    const consumers = S.buildings.filter((b) => done(b) && lvl(b).power && b.on !== false);
    consumers.sort((a, b) => POWER_ORDER.indexOf(a.type) - POWER_ORDER.indexOf(b.type) || a.id - b.id);
    for (const b of S.buildings) if (lvl(b) && lvl(b).power) b.powered = false;
    for (const b of consumers) {
      const p = lvl(b).power;
      demand += p;
      if (used + p <= supply) { used += p; b.powered = true; }
    }
    S.power = { supply, demand, used };
  }

  function tick(S, dt) {
    if (S.tick % 10 === 0) updatePower(S);
    const mm = moraleMul(S);
    for (const b of S.buildings) {
      if (!done(b)) continue;
      const L = lvl(b);
      switch (b.type) {
        case 'generator':
          if (b.running && S.power.demand > 0) {
            b.burnT = (b.burnT || 0) - dt;
            if (b.burnT <= 0) {
              if (S.res.fuel > 0) { S.res.fuel -= 1; b.burnT += L.burn; }
              else { b.burnT = 0; if (S.tick - (S._fuelMsgT || -9999) > 600) { S._fuelMsgT = S.tick; UB.Game.msg(S, 'Gerador sem combustível: holofotes e metralhadoras desligados.', 'bad', b.tx + 1, b.ty + 1); } }
            }
          }
          break;
        case 'garden': {
          const w = b.workers.length;
          if (!w) break;
          b.prodT = (b.prodT || 0) + (dt * w * L.mult * mm) / BAL.gardenFoodEvery;
          while (b.prodT >= 1) { b.prodT -= 1; add(S, 'food', 1); S.stats.produced = (S.stats.produced || 0) + 1; }
          break;
        }
        case 'workshop': {
          const w = b.workers.length;
          if (!w) break;
          const rate = dt * mm * (b.powered ? 1 : 0.5);
          if (b.craft) {
            b.craft.t -= rate * w;
            if (b.craft.t <= 0) {
              S.armory[b.craft.item] = (S.armory[b.craft.item] || 0) + 1;
              UB.Game.msg(S, `${CRAFT[b.craft.item].name} fabricada. Equipe um sobrevivente no painel dele.`, 'good', b.tx + 1, b.ty + 1);
              b.craft = null;
            }
            break;
          }
          b.prodT = (b.prodT || 0) + (rate * w) / BAL.workshopCycle;
          while (b.prodT >= 1) {
            b.prodT -= 1;
            if (S.res.scrap >= BAL.workshopBatch.scrap && S.res.ammo < cap(S)) {
              S.res.scrap -= BAL.workshopBatch.scrap;
              add(S, 'ammo', BAL.workshopBatch.ammo);
            }
          }
          break;
        }
        case 'infirmary': {
          for (const id of b.patients) {
            const u = UB.World.get(S, id);
            if (!u) continue;
            const heal = b.powered ? L.heal : L.heal * 0.35;
            u.hp = Math.min(u.maxHp, u.hp + heal * dt);
            if (u.infected >= 0 && S.res.meds >= 1) {
              S.res.meds -= 1;
              u.infected = -1;
              UB.Game.msg(S, `${u.name} foi tratado(a) na enfermaria.`, 'good');
            }
          }
          break;
        }
        default: break;
      }
    }
    // Rest: survivors inside the territory heal slowly when there is a shelter.
    if (S.tick % 20 === 0) {
      const shelter = S.buildings.some((b) => done(b) && b.type === 'shelter');
      if (shelter) {
        for (const u of S.units) {
          if (u.dead || u.infected >= 0 || u.starving) continue;
          if (UB.World.inTerritory(S, u.x, u.y)) u.hp = Math.min(u.maxHp, u.hp + BAL.restHeal);
        }
      }
    }
  }

  // Dawn upkeep: everyone eats; shortages starve people, which drains morale and can cost lives.
  function dawn(S) {
    const alive = S.units.filter((u) => !u.dead);
    const need = alive.length * BAL.eatPerDay;
    const lines = [];
    let fed = Math.min(alive.length, Math.floor(S.res.food / BAL.eatPerDay));
    S.res.food -= fed * BAL.eatPerDay;
    S.stats.eaten = (S.stats.eaten || 0) + Math.min(need, fed * BAL.eatPerDay);
    const order = alive.slice().sort((a, b) => b.starving - a.starving || a.id - b.id);
    let hungry = 0;
    for (const u of order) {
      if (fed > 0) { fed--; u.starving = 0; continue; }
      u.starving++;
      hungry++;
    }
    if (hungry) {
      changeMorale(S, -8 * hungry);
      lines.push(`${hungry} sobrevivente(s) passaram fome.`);
      for (const u of alive) {
        if (u.starving >= 3 && S.rng.chance(0.5)) {
          UB.Combat.killUnit(S, u, 'fome');
        } else if (u.starving >= 2 && S.rng.chance(0.35)) {
          desert(S, u, 'fome');
        }
      }
    }
    const pop = population(S), bedCount = beds(S);
    if (pop > bedCount) { changeMorale(S, -3 * (pop - bedCount)); lines.push(`Faltam ${pop - bedCount} cama(s).`); }
    if (!S._diedTonight) changeMorale(S, 5);
    if (S.morale >= 60) changeMorale(S, 1);
    S._diedTonight = false;
    if (S.morale < 15) {
      const living = S.units.filter((u) => !u.dead);
      if (living.length > 1 && S.rng.chance(0.3)) desert(S, S.rng.pick(living), 'moral');
    }
    return lines;
  }

  function desert(S, u, why) {
    u.dead = true;
    u.deserted = true;
    UB.Units.leaveBuilding(S, u);
    S.stats.deserted = (S.stats.deserted || 0) + 1;
    S.memorial.push({ name: u.name, role: u.role, day: S.day, cause: why === 'fome' ? 'Partiu em busca de comida' : 'Abandonou o grupo' });
    UB.Game.msg(S, `${u.name} abandonou a base (${why === 'fome' ? 'fome' : 'moral baixa'}).`, 'bad');
  }

  UB.Eco = { cap, beds, population, add, can, spend, refund, missing, moraleMul, changeMorale, updatePower, tick, dawn, lvl, done };
})(globalThis.UB = globalThis.UB || {});
