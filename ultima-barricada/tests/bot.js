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

  UB.Bot = { active, run, spotFor };
})(globalThis.UB = globalThis.UB || {});
