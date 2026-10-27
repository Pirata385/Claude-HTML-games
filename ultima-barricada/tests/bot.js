// Scripted players used by the headless tests and for balancing. They only use the public
// command API, like the UI does.
(function (UB) {
  'use strict';
  const W = UB.World;

  function spotFor(S, type, rMin, rMax) {
    const hq = W.hq(S);
    const cx = hq.tx + 1, cy = hq.ty + 1;
    for (let r = rMin; r <= rMax; r++) {
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        if (UB.Buildings.canPlace(S, type, cx + dx, cy + dy).ok) return { x: cx + dx, y: cy + dy };
      }
    }
    return null;
  }

  const PLAN = [
    ['garden', 4, 8], ['tower', 4, 6], ['tower', 4, 6], ['workshop', 4, 9], ['shelter', 4, 9],
    ['barricade', 6, 7], ['barricade', 6, 7], ['barricade', 6, 7], ['barricade', 6, 7], ['depot', 4, 10], ['tower', 5, 7],
  ];

  function active(S) {
    if (S.tick % 60 !== 0 || S.over) return;
    const hq = W.hq(S);
    if (!hq) return;
    const have = {};
    for (const b of S.buildings) have[b.type] = (have[b.type] || 0) + 1;
    const want = {};
    for (const [type, r0, r1] of PLAN) {
      want[type] = (want[type] || 0) + 1;
      if ((have[type] || 0) >= want[type]) continue;
      if (!UB.Eco.can(S, UB.DEF.BUILDINGS[type].levels[0].cost)) break;
      const p = spotFor(S, type, r0, r1);
      if (p) UB.Game.command(S, { type: 'build', build: type, x: p.x, y: p.y });
      break;
    }
    const night = S.clock.phase !== 'day' || S.clock.t > UB.Waves.phaseLen(S, 'day') - 40;
    const free = S.units.filter((u) => !u.dead && !u.inside && !u.order && (!u.task || u.task.type === 'idle'));
    // Staff production.
    for (const b of S.buildings) {
      if (b.built < 1 || (b.type !== 'garden' && b.type !== 'workshop')) continue;
      if (b.workers.length >= 1) continue;
      const u = S.units.find((x) => !x.dead && !x.inside && !x.order && x.role !== 'scout');
      if (!u) continue;
      UB.Game.command(S, { type: 'work', ids: [u.id], id: b.id });
    }
    if (night) {
      for (const u of S.units) if (!u.dead && u.order && !W.inTerritory(S, u.x, u.y)) UB.Game.command(S, { type: 'return', ids: [u.id] });
      return;
    }
    for (const u of free) {
      if (u.role === 'scout') {
        const p = S.pois.filter((q) => q.discovered && q.searchesLeft > 0 && UB.DEF.POIS[q.type].danger <= 2 && !UB.DEF.POIS[q.type].nest)
          .sort((a, b) => UB.U.dist2(a.ex, a.ey, u.x, u.y) - UB.U.dist2(b.ex, b.ey, u.x, u.y))[0];
        if (p) { UB.Game.command(S, { type: 'loot', ids: [u.id], id: p.id }); continue; }
      }
      const res = S.res.wood < 120 ? 'wood' : 'scrap';
      const i = UB.Units.findNode(S, Math.floor(u.x), Math.floor(u.y), res, 16);
      if (i >= 0) UB.Game.command(S, { type: 'gather', ids: [u.id], x: i % S.map.w, y: (i / S.map.w) | 0 });
    }
  }

  // A stronger scripted player for balance runs: staffs production, walls the base in with
  // gates, mans towers, scavenges by day with a looting team and rescues survivors.
  function strong(S) {
    if (S.tick % 40 !== 0 || S.over) return;
    const hq = W.hq(S);
    if (!hq) return;
    const cx = hq.tx + 1, cy = hq.ty + 1;
    const count = (t) => S.buildings.filter((b) => b.type === t).length;
    const afford = (t) => UB.Eco.can(S, UB.DEF.BUILDINGS[t].levels[0].cost);
    const tryBuild = (t, r0, r1) => { if (!afford(t)) return false; const p = spotFor(S, t, r0, r1); return !!(p && UB.Game.command(S, { type: 'build', build: t, x: p.x, y: p.y }).ok); };
    const pop = S.units.length;
    // Production staffing.
    for (const b of S.buildings) {
      if (b.built < 1) continue;
      const want = b.type === 'garden' ? (pop >= 6 ? 2 : 1) : b.type === 'workshop' ? (pop >= 7 ? 2 : 1) : 0;
      if (b.workers.length >= Math.min(want, UB.Buildings.slots(b))) continue;
      const u = S.units.find((x) => !x.dead && !x.inside && !x.order && x.role !== 'scout' && x.role !== 'soldier');
      if (u) UB.Game.command(S, { type: 'work', ids: [u.id], id: b.id });
    }
    // Construction plan.
    if (count('tower') < 2) tryBuild('tower', 3, 5);
    else if (!count('workshop')) tryBuild('workshop', 3, 6);
    else if (!count('garden')) tryBuild('garden', 3, 6);
    else if (!count('shelter')) tryBuild('shelter', 3, 6);
    else {
      // Perimeter at radius 7 with a gate in the middle of each side.
      let placed = 0;
      for (let d = -7; d <= 7 && placed < 4; d++) for (const [x, y] of [[cx + d, cy - 7], [cx + d, cy + 7], [cx - 7, cy + d], [cx + 7, cy + d]]) {
        if (placed >= 4 || S.res.wood < 40) break;
        const type = d === 0 ? 'gate' : 'wall';
        if (!UB.Buildings.canPlace(S, type, x, y).ok || !afford(type)) continue;
        if (UB.Game.command(S, { type: 'build', build: type, x, y }).ok) placed++;
      }
      if (!placed) {
        if (count('depot') < 1) tryBuild('depot', 3, 6);
        else if (hq.level < 2 && S.day >= 3 && UB.Eco.can(S, UB.DEF.BUILDINGS.hq.levels[1].cost)) UB.Game.command(S, { type: 'upgrade', id: hq.id });
        else if (count('tower') < 4) tryBuild('tower', 4, 6);
        else if (count('infirmary') < 1 && S.res.meds >= 4) tryBuild('infirmary', 3, 6);
        else if (count('shelter') < 2 && pop >= UB.Eco.beds(S) - 1) tryBuild('shelter', 3, 7);
        else if (S.unlocked.bp_turret && count('generator') < 1) tryBuild('generator', 3, 6);
        else if (S.unlocked.bp_turret && count('turret') < 4 && S.res.fuel > 4) tryBuild('turret', 5, 6);
        else if (hq.level < 3 && UB.Eco.can(S, UB.DEF.BUILDINGS.hq.levels[2].cost)) UB.Game.command(S, { type: 'upgrade', id: hq.id });
        else {
          const weak = S.buildings.find((b) => b.built >= 1 && (b.type === 'wall' || b.type === 'gate' || b.type === 'tower') && b.level < 2 && UB.Eco.can(S, UB.DEF.BUILDINGS[b.type].levels[1].cost));
          if (weak && S.res.scrap > 80) UB.Game.command(S, { type: 'upgrade', id: weak.id });
        }
      }
    }
    // Field work during the day; everyone home before dusk.
    const late = S.clock.phase !== 'day' || S.clock.t > UB.Waves.phaseLen(S, 'day') - 55;
    if (late) {
      for (const u of S.units) if (!u.dead && u.order && u.order.type !== 'return' && !W.inTerritory(S, u.x, u.y)) UB.Game.command(S, { type: 'return', ids: [u.id] });
      return;
    }
    const free = S.units.filter((u) => !u.dead && !u.inside && !u.order && (!u.task || u.task.type === 'idle'));
    const looters = free.filter((u) => u.role === 'scout' || u.role === 'soldier');
    if (looters.length) {
      const beds = UB.Eco.beds(S) - pop;
      const pois = S.pois.filter((q) => q.discovered && q.searchesLeft > 0 && !UB.DEF.POIS[q.type].nest && (q.type !== 'camp' || beds > 0) && UB.DEF.POIS[q.type].danger <= (S.day >= 3 ? 4 : 2))
        .sort((a, b) => (b.type === 'camp') - (a.type === 'camp') || UB.U.dist2(a.ex, a.ey, cx, cy) - UB.U.dist2(b.ex, b.ey, cx, cy));
      if (pois[0]) UB.Game.command(S, { type: 'loot', ids: looters.map((u) => u.id), id: pois[0].id });
    }
    let k = 0;
    for (const u of free) {
      if (looters.includes(u)) continue;
      const res = (k++ % 2 === 0) === (S.res.wood < S.res.scrap * 1.5) ? 'wood' : 'scrap';
      let i = UB.Units.findNode(S, Math.floor(u.x), Math.floor(u.y), res, 14);
      if (i < 0) i = UB.Units.findNode(S, Math.floor(u.x), Math.floor(u.y), res === 'wood' ? 'scrap' : 'wood', 14);
      if (i >= 0) UB.Game.command(S, { type: 'gather', ids: [u.id], x: i % S.map.w, y: (i / S.map.w) | 0 });
    }
  }

  // Runs a game for up to `days` days (or until it ends) with the given strategy.
  function run(S, strategy, days, maxTicks) {
    const limit = maxTicks || days * 7600;
    for (let t = 0; t < limit && !S.over && S.day <= days; t++) {
      if (strategy) strategy(S);
      UB.Game.tick(S);
      if (S.fx.length > 500) S.fx.length = 0;
    }
    return S;
  }

  UB.Bot = { active, strong, run, spotFor };
})(globalThis.UB = globalThis.UB || {});
