// Objectives: a chain of optional goals that point new players at each system (defence, food,
// exploration, rescue, power, nests) and pay small rewards plus score when completed.
// Their texts live in the dictionaries as obj.<id>.
(function (UB) {
  'use strict';
  const done = (b) => b.built >= 1 && !b.dead;
  const LIST = [
    { id: 'tower', reward: { ammo: 20 }, check: (S) => S.buildings.some((b) => b.type === 'tower' && done(b)) },
    { id: 'garden', reward: { food: 12 }, check: (S) => S.buildings.some((b) => b.type === 'garden' && b.workers.length) },
    { id: 'loot5', reward: { scrap: 15 }, check: (S) => S.stats.loots >= 5 },
    { id: 'night3', reward: { ammo: 30 }, check: (S) => S.nights >= 3 },
    { id: 'camp', reward: { meds: 2 }, morale: 8, check: (S) => S.stats.recruits >= 1 },
    { id: 'blueprint', reward: { scrap: 25 }, check: (S) => !!S.unlocked.bp_turret },
    { id: 'power', reward: { fuel: 10 }, check: (S) => S.power.supply > 0 },
    { id: 'nest', reward: { ammo: 40 }, check: (S) => (S.stats.nests || 0) >= 1 },
    { id: 'blood', reward: { scrap: 40, wood: 40 }, morale: 10, check: (S) => S.nights >= 5 },
    { id: 'hq2', reward: { meds: 4 }, check: (S) => { const h = UB.World.hq(S); return !!h && h.level >= 2; } },
    { id: 'pop8', reward: { food: 30 }, morale: 6, check: (S) => S.units.filter((u) => !u.dead).length >= 8 },
    { id: 'nests', reward: { ammo: 80 }, check: (S) => !S.pois.some((p) => UB.DEF.POIS[p.type].nest && !p.dead) },
    { id: 'night10', reward: { ammo: 60, meds: 5 }, morale: 10, check: (S) => S.nights >= 10 },
    { id: 'night20', reward: { ammo: 100 }, morale: 10, check: (S) => S.nights >= 20 },
  ];
  const BONUS = 300;

  function tick(S) {
    if (S.tick % 40 !== 7) return;
    S.objectives = S.objectives || {};
    for (const o of LIST) {
      if (S.objectives[o.id] || !o.check(S)) continue;
      S.objectives[o.id] = S.day;
      for (const k in o.reward) UB.Eco.add(S, k, o.reward[k]);
      if (o.morale) UB.Eco.changeMorale(S, o.morale);
      const items = Object.entries(o.reward).map(([res, n]) => ({ res, n }));
      UB.Game.msg(S, 'msg.objective', { o: o.id, items, bonus: BONUS }, 'good');
      UB.Game.fx(S, { t: 'objective' });
    }
  }
  // Next few open objectives, for the HUD.
  function open(S, n) {
    const done = S.objectives || {};
    return LIST.filter((o) => !done[o.id]).slice(0, n || 3);
  }
  const count = (S) => Object.keys(S.objectives || {}).length;

  UB.Objectives = { LIST, BONUS, tick, open, count };
})(globalThis.UB = globalThis.UB || {});
