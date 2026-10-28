// Exploration: fog of war, discovering places, searching POIs for loot, recruits and
// blueprints, nests, supply crates, environmental hazards and the dawn world update.
(function (UB) {
  'use strict';
  const { POIS, ROLES, BAL, WEATHER, DIFFICULTY, BUILDINGS, F, T, RES_NAME, BLUEPRINTS } = UB.DEF;
  const W = UB.World;

  function vision(S) {
    const N = S.map.w;
    const vis = S._vis, exp = S.map.explored;
    vis.fill(0);
    const wv = (WEATHER[S.weather] || WEATHER.clear).vision;
    const night = UB.Waves.isNight(S);
    const stamp = (cx, cy, r) => {
      r *= wv * (night ? 0.75 : 1);
      const r2 = r * r;
      const x0 = Math.max(0, Math.floor(cx - r)), x1 = Math.min(N - 1, Math.ceil(cx + r));
      const y0 = Math.max(0, Math.floor(cy - r)), y1 = Math.min(N - 1, Math.ceil(cy + r));
      for (let y = y0; y <= y1; y++) {
        const dy = y + 0.5 - cy;
        for (let x = x0; x <= x1; x++) {
          const dx = x + 0.5 - cx;
          if (dx * dx + dy * dy <= r2) { const i = y * N + x; vis[i] = 1; exp[i] = 1; }
        }
      }
    };
    for (const u of S.units) {
      if (u.dead) continue;
      if (u.inside) {
        const b = W.get(S, u.inside);
        if (b && (b.type === 'tower' || b.type === 'hq')) stamp(b.tx + b.w / 2, b.ty + b.h / 2, BUILDINGS[b.type].vision + UB.Buildings.lvl(b).range);
        continue;
      }
      stamp(u.x, u.y, ROLES[u.role].vision);
    }
    for (const b of S.buildings) {
      if (b.dead || b.built < 1) continue;
      const def = BUILDINGS[b.type];
      const r = def.vision || (b.w > 1 ? 4 : 0);
      if (r) stamp(b.tx + b.w / 2, b.ty + b.h / 2, r);
    }
    // Lights reveal what they illuminate near the base at night.
    if (night) for (let i = 0; i < vis.length; i++) if (S._light[i] && exp[i]) vis[i] = 1;
    for (const p of S.pois) {
      if (p.discovered || p.dead) continue;
      let seen = vis[p.ey * N + p.ex] === 1;
      for (let y = p.ty; y < p.ty + p.h && !seen; y++) for (let x = p.tx; x < p.tx + p.w; x++) if (vis[y * N + x]) { seen = true; break; }
      if (seen) {
        p.discovered = true;
        S.stats.discovered = (S.stats.discovered || 0) + 1;
        const def = POIS[p.type];
        if (p.type !== 'house' && p.type !== 'ruin') UB.Game.msg(S, `Descoberto: ${def.name} (perigo ${'☠'.repeat(def.danger)}).`, 'info', p.tx + p.w / 2, p.ty + p.h / 2);
      }
    }
  }

  function recruit(S, role, x, y, why) {
    if (UB.Eco.population(S) >= UB.Eco.beds(S)) {
      UB.Game.msg(S, `${why}, mas não há camas livres na base. Construa um abrigo.`, 'warn', x, y);
      return null;
    }
    const p = W.nearestOpen(S, x, y, false, 4) || { x: Math.floor(x), y: Math.floor(y) };
    const roles = Object.keys(ROLES);
    const u = UB.Units.create(S, role || S.rng.pick(roles), p.x + 0.5, p.y + 0.5);
    u.ammo = Math.min(u.ammo, 12);
    S.stats.recruits++;
    UB.Eco.changeMorale(S, 4);
    UB.Units.order(S, u, { type: 'return' });
    UB.Game.msg(S, `${why}: ${u.name} (${ROLES[u.role].name}) se juntou ao grupo!`, 'good', u.x, u.y);
    UB.Game.fx(S, { t: 'recruit', x: u.x, y: u.y });
    return u;
  }

  // One finished search of a point of interest.
  function searchComplete(S, p, u) {
    const def = POIS[p.type];
    if (p.searchesLeft <= 0) return;
    const room = () => Math.max(0, BAL.backpackCap - UB.Units.packTotal(u));
    const got = [];
    if (def.recruitCamp) {
      const free = UB.Eco.beds(S) - UB.Eco.population(S);
      if (free <= 0) { UB.Game.msg(S, 'Os sobreviventes do acampamento só virão se houver camas livres.', 'warn', p.ex, p.ey); return; }
      const n = Math.min(free, S.rng.int(1, 2));
      for (let k = 0; k < n; k++) recruit(S, null, p.ex + 0.5, p.ey + 0.5, 'Resgate no acampamento');
    }
    p.searchesLeft--;
    p.looted++;
    S.stats.loots++;
    for (const [res, mn, mx, ch] of def.loot) {
      if (!S.rng.chance(ch)) continue;
      const amt = Math.min(room(), S.rng.int(mn, mx));
      if (amt <= 0) continue;
      u.pack[res] = (u.pack[res] || 0) + amt;
      got.push(`+${amt} ${RES_NAME[res].toLowerCase()}`);
    }
    if (def.special === 'police') {
      if (!S.unlocked.bp_turret) { S.unlocked.bp_turret = true; got.push(BLUEPRINTS.bp_turret); }
      else if (!S.unlocked.bp_radio) { S.unlocked.bp_radio = true; got.push(BLUEPRINTS.bp_radio); }
      if (S.rng.chance(0.5)) { S.armory.shotgun++; got.push('uma espingarda'); }
      if (S.rng.chance(0.3)) { S.armory.rifle++; got.push('um rifle'); }
    } else if (def.special && !S.unlocked[def.special]) {
      S.unlocked[def.special] = true;
      got.push(BLUEPRINTS[def.special]);
    }
    if (def.recruit && S.rng.chance(def.recruit)) recruit(S, 'medic', p.ex + 0.5, p.ey + 0.5, 'Sobrevivente encontrado no hospital');
    UB.Game.msg(S, `${def.name}: ${got.length ? got.join(', ') : 'nada útil desta vez'}.${p.searchesLeft <= 0 ? ' Esgotado.' : ''}`, got.length ? 'good' : 'info', p.ex, p.ey);
    UB.Game.fx(S, { t: 'loot', x: p.ex + 0.5, y: p.ey + 0.5 });
    UB.Combat.noise(S, p.ex + 0.5, p.ey + 0.5, 7);
    // Searching can disturb what is still inside.
    if (S.rng.chance(def.danger * 0.07)) {
      const n = S.rng.int(1, Math.min(3, def.danger));
      const pairs = Object.entries(def.guards);
      for (let k = 0; k < n; k++) {
        const z = UB.Zombies.spawn(S, S.rng.weighted(pairs), p.ex + 0.5 + S.rng.range(-0.4, 0.4), p.ey + 0.5 + S.rng.range(-0.4, 0.4), { state: 'chase', home: p.id });
        z.target = u.id;
      }
      UB.Game.msg(S, `Algo se mexe dentro do(a) ${def.name.toLowerCase()}!`, 'bad', p.ex, p.ey);
    }
  }

  function pickupCrate(S, u, i) {
    if (S.map.feature[i] !== F.CRATE) return;
    const kind = S.map.famt[i];
    let items = {};
    if (kind === 2 && S.drops[i]) items = S.drops[i];
    else {
      const table = kind === 1 ? [['ammo', 15, 30, 1], ['meds', 1, 2, 0.6]]
        : kind === 3 ? [['food', 10, 20, 1], ['ammo', 20, 40, 1], ['meds', 3, 6, 1], ['fuel', 4, 8, 0.6]]
          : [['food', 4, 10, 0.6], ['ammo', 6, 15, 0.6], ['meds', 1, 3, 0.35], ['scrap', 4, 10, 0.5], ['fuel', 3, 6, 0.3]];
      for (const [res, mn, mx, ch] of table) if (S.rng.chance(ch)) items[res] = (items[res] || 0) + S.rng.int(mn, mx);
      if (!Object.keys(items).length) items.food = 4;
    }
    for (const k in items) u.pack[k] = (u.pack[k] || 0) + items[k];
    delete S.drops[i];
    const x = i % S.map.w, y = (i / S.map.w) | 0;
    W.setFeature(S, x, y, F.NONE, 0);
    UB.Game.msg(S, `${u.name} abriu uma caixa: ${Object.entries(items).map(([k, v]) => `+${v} ${RES_NAME[k].toLowerCase()}`).join(', ')}.`, 'good', x, y);
    UB.Game.fx(S, { t: 'loot', x: x + 0.5, y: y + 0.5 });
  }

  function randomFarTile(S, minD, maxD, notVisible) {
    const N = S.map.w, b = S.base;
    for (let t = 0; t < 300; t++) {
      const x = S.rng.int(1, N - 2), y = S.rng.int(1, N - 2);
      const d = Math.hypot(x - b.x, y - b.y);
      if (d < minD || d > maxD) continue;
      const i = y * N + x;
      if (S._blockZ[i] || S._occ[i] || S.map.feature[i]) continue;
      if (notVisible && S._vis[i]) continue;
      return { x, y };
    }
    return null;
  }

  function dawn(S) {
    // Weather for the new day.
    const old = S.weather;
    S.weather = S.rng.weighted([['clear', 60], ['rain', 25], ['fog', 15]]);
    if (S.weather !== old) UB.Game.msg(S, `Clima: ${WEATHER[S.weather].name}.${S.weather === 'rain' ? ' A chuva abafa o barulho.' : S.weather === 'fog' ? ' A neblina reduz a visão.' : ''}`, 'info');
    // The dead keep coming: the wandering population recovers and grows.
    const diff = DIFFICULTY[S.difficulty] || DIFFICULTY.normal;
    const target = Math.min(BAL.wanderMax, (BAL.wanderBase + BAL.wanderPerDay * S.day) * diff.wander);
    const roaming = S.zombies.filter((z) => !z.dead && z.state !== 'horde' && z.state !== 'attackS').length;
    const add = Math.min(40, Math.max(0, Math.round(target - roaming)));
    const types = [['walker', 10], ['runner', S.day >= 3 ? 3 : 0], ['bloater', S.day >= 6 ? 1 : 0], ['armored', S.day >= 10 ? 1 : 0]];
    for (let k = 0; k < add && S.zombies.length < BAL.maxZombies; k++) {
      const p = randomFarTile(S, 30, 999, true);
      if (p) UB.Zombies.spawn(S, S.rng.weighted(types), p.x + 0.5, p.y + 0.5, { state: 'wander' });
    }
    // Radio: refugees answer the broadcast.
    for (const b of S.buildings) {
      if (b.dead || b.built < 1 || b.type !== 'radio' || !b.powered) continue;
      if (!S.rng.chance(UB.Buildings.lvl(b).chance)) continue;
      const sp = S.rng.pick(S.spawns);
      if (sp) recruit(S, null, sp.x + 0.5, sp.y + 0.5, `Um refugiado respondeu ao rádio pelo ${sp.side}`);
    }
    // Supply drop somewhere out there.
    if (S.rng.chance(0.35)) {
      const p = randomFarTile(S, 16, 42, false);
      if (p) {
        W.setFeature(S, p.x, p.y, F.CRATE, 3);
        UB.Game.msg(S, 'Um avião soltou suprimentos! Veja o sinal no mapa.', 'good', p.x, p.y);
        UB.Game.fx(S, { t: 'drop', x: p.x + 0.5, y: p.y + 0.5 });
        S.dropMark = { x: p.x, y: p.y, day: S.day };
      }
    }
  }

  function tick(S, dt) {
    if (S.tick % 4 === 0) vision(S);
    const N = S.map.w;
    // Nests breed zombies until destroyed.
    for (const p of S.pois) {
      if (p.dead || !POIS[p.type].nest) continue;
      p.spawnT += dt;
      if (p.spawnT < BAL.nestEvery) continue;
      p.spawnT = 0;
      let mine = 0;
      for (const z of S.zombies) if (!z.dead && z.home === p.id) mine++;
      if (mine >= BAL.nestCap || S.zombies.length >= BAL.maxZombies) continue;
      const type = S.day >= 4 && S.rng.chance(0.3) ? 'runner' : 'walker';
      UB.Zombies.spawn(S, type, p.ex + 0.5, p.ey + 0.5, { state: 'wander', home: p.id });
    }
    if (S.tick % 10 === 0) {
      for (const u of S.units) {
        if (u.dead || u.hidden) continue;
        const i = Math.floor(u.y) * N + Math.floor(u.x);
        const t = UB.DEF.TERRAIN[S.map.terrain[i]];
        const f = UB.DEF.FEATURE[S.map.feature[i]];
        const hz = (t.hazard || 0) + (f && f.hazard ? f.hazard : 0);
        if (hz) {
          UB.Combat.hurtUnit(S, u, hz * 0.5, null, true);
          if (S.tick - (u.hazMsgT || -9999) > 200) { u.hazMsgT = S.tick; UB.Game.msg(S, `${u.name} está se ferindo no(a) ${(f && f.hazard ? f.name : t.name).toLowerCase()}!`, 'warn', u.x, u.y); }
        }
        if (S.map.feature[i] === F.CRATE) pickupCrate(S, u, i);
      }
    }
  }

  UB.Explore = { vision, searchComplete, pickupCrate, recruit, dawn, tick, randomFarTile };
})(globalThis.UB = globalThis.UB || {});
