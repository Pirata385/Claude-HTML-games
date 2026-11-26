// Água-Tinta — AQ.progress tests (owner D).
'use strict';

module.exports = function (T) {
  function fresh() {
    const clock = { t: 1e12 };
    const c = T.load({ fresh: true, now: () => clock.t });
    c.AQ.store.load();
    c.AQ.game.check();
    return { AQ: c.AQ, clock };
  }
  function spec(AQ, sp, o) {
    const s = AQ.species.get(sp);
    return Object.assign({ sp, len: s.len[0], kg: 0.1, q: 0.3, dense: false, trophy: false, zone: s.zones[0], at: 1 }, o || {});
  }
  function caught(AQ, ids) { ids.forEach((id) => { AQ.state.bestiary[id] = { seen: true, caught: 1, kept: 0, sold: 1, released: 0, bestLen: 1, bestKg: 1, first: 1, dense: 0 }; }); }

  T.test('zone requirements (§5.1)', () => {
    const { AQ } = fresh(), s = AQ.state, P = AQ.progress;
    T.ok(P.zoneUnlocked('baia', s)); T.ok(!P.zoneUnlocked('recife', s));
    T.eq(P.zoneRequirements('baia', s), { ok: true, items: [] });
    let r = P.zoneRequirements('recife', s);
    T.eq(r.ok, false);
    T.eq(r.items.map((i) => [i.key, i.ok]), [['item.req.gear', false], ['item.req.species', false]]);
    T.eq(r.items[0].vars.price, 400);
    const baia = AQ.species.inZone('baia').map((x) => x.id);
    caught(AQ, baia.slice(0, 5));
    T.eq(P.zoneRequirements('recife', s).items[1].ok, true);
    s.player.gear.boat = 2;
    T.eq(P.zoneRequirements('recife', s).ok, true);
    const evs = P.check(s);
    T.ok(evs.some((e) => e.type === 'zone' && e.zone === 'recife'));
    T.ok(P.zoneUnlocked('recife', s));
    T.ok(!P.check(s).some((e) => e.type === 'zone'), 'only once');
    // mar needs Linha III, abismo Lanterna I
    r = P.zoneRequirements('mar', s);
    T.ok(r.items.some((i) => i.vars.slot === 'line' && i.vars.tier === 3));
    r = P.zoneRequirements('abismo', s);
    T.ok(r.items.some((i) => i.vars.slot === 'lantern' && i.vars.tier === 1));
    T.eq(r.items.find((i) => i.key === 'item.req.species').vars.n, 6);
  });

  T.test('goal chain: 3 active, advances with simulated actions, rewards granted', () => {
    const { AQ } = fresh(), s = AQ.state, P = AQ.progress, G = AQ.game;
    T.eq(P.activeGoals(s).map((g) => g.id), ['g01', 'g02', 'g03']);
    T.eq(P.goalProgress(AQ.goals.get('g05'), s), { cur: 0, max: 5 });
    const done = [];
    AQ.events.on('goal:done', (p) => done.push(p.id));
    const coins0 = s.player.coins;
    G.resolveCatch(spec(AQ, 'manjuba'), { choice: 'sell' });
    T.eq(done, ['g01']);
    T.eq(P.activeGoals(s).map((g) => g.id), ['g02', 'g03', 'g04']);
    T.ok(s.player.coins >= coins0 + 20);
    G.resolveCatch(spec(AQ, 'manjuba'), { choice: 'keep' });
    G.feedTank('t1');
    T.eq(done, ['g01', 'g02', 'g03']);
    T.eq(P.activeGoals(s).map((g) => g.id), ['g04', 'g05', 'g06']);
    T.eq(s.progress.goal, 3);
    s.player.coins += 1000;
    G.buy('rod');
    T.eq(done.slice(-1), ['g04']);
    T.eq(s.player.pearls >= 1, true);
    // g06 collect till
    s.aquarium.till = 12;
    G.collectTill();
    T.ok(done.indexOf('g06') >= 0);
    T.ok(s.progress.goalsDone.g06 > 0);
  });

  T.test('goalBase: counter goals count from activation', () => {
    const { AQ } = fresh(), s = AQ.state, P = AQ.progress, G = AQ.game;
    s.player.coins = 5000;
    G.buy('rod'); G.buy('line'); // before g04 is active
    T.eq(s.progress.goalsDone.g04, undefined);
    G.resolveCatch(spec(AQ, 'manjuba'), { choice: 'sell' }); // g01 done → g04 active with base = 2
    T.eq(s.progress.goalBase.g04, 2);
    T.eq(P.goalProgress(AQ.goals.get('g04'), s), { cur: 0, max: 1 });
    G.buy('reel');
    T.ok(s.progress.goalsDone.g04 > 0);
    // a collection goal (discover) is absolute
    T.eq(P.goalProgress('g05', s).cur, 1);
  });

  T.test('achievements fire once and grant pearls', () => {
    const { AQ } = fresh(), s = AQ.state, G = AQ.game;
    const got = [];
    AQ.events.on('achievement:unlocked', (p) => got.push(p.id));
    AQ.events.emit('fight:start', { sp: 'manjuba' });
    T.eq(got, ['primeira_fisgada']);
    AQ.events.emit('fight:start', { sp: 'manjuba' });
    T.eq(got, ['primeira_fisgada'], 'once');
    T.ok(s.progress.ach.primeira_fisgada > 0);
    AQ.events.emit('fight:end', { sp: 'manjuba', result: 'snap', sec: 61 });
    T.ok(got.indexOf('linha_partida') >= 0 && got.indexOf('paciencia') >= 0);
    T.eq(s.stats.snaps, 1); T.eq(s.stats.escapes, 1); T.eq(s.stats.longestFight, 61);
    AQ.events.emit('fish:stop', { depthM: 1520 });
    T.ok(got.indexOf('abissal') >= 0);
    const p0 = s.player.pearls;
    G.resolveCatch(spec(AQ, 'polvo'), { choice: 'release' });
    T.ok(got.indexOf('tres_coracoes') >= 0);
    T.ok(s.player.pearls >= p0 + 2 + 2, 'first rare +2 and the achievement reward');
    const n = got.length;
    AQ.progress.check(s);
    T.eq(got.length, n);
    // frenzy
    AQ.events.emit('frenzy:start', { zone: 'baia' });
    for (let i = 0; i < 3; i++) G.resolveCatch(spec(AQ, 'manjuba'), { choice: 'sell' });
    AQ.events.emit('frenzy:end', { zone: 'baia' });
    T.eq(s.stats.frenzyBest, 3);
    T.ok(got.indexOf('frenesi') >= 0);
  });

  T.test('stars: best ever kept in progress.stars; ★4 unlocks the Pérola Negra', () => {
    const { AQ } = fresh(), s = AQ.state, G = AQ.game;
    const ev = [];
    AQ.events.on('stars:changed', (p) => ev.push(p));
    s.aquarium.tanks[0].cap = 4;
    // Add valuable fish until ★2
    for (let i = 0; i < 6; i++) G.resolveCatch(spec(AQ, 'cavalo', { q: 1 }), { choice: 'keep' });
    T.ok(AQ.aquarium.attraction(s) >= 100, 'attraction ' + AQ.aquarium.attraction(s));
    T.ok(s.progress.stars >= 2);
    T.eq(ev[0].prev, 1);
    const best = s.progress.stars;
    s.aquarium.tanks[0].food = 0; // happiness drops, current stars may drop
    G.tick(1);
    T.eq(s.progress.stars, best, 'never decreases');
    s.progress.stars = 3;
    T.ok(!s.player.unlocks.perola);
    s.progress.stars = 4;
    AQ.progress.check(s);
    T.ok(s.player.unlocks.perola);
  });

  T.test('completion = (caught species + seen sightings) / 45', () => {
    const { AQ } = fresh(), s = AQ.state, P = AQ.progress;
    T.eq(P.completion(s), { caught: 0, seen: 0, total: 45, pct: 0, frac: 0 });
    caught(AQ, ['manjuba', 'tainha', 'siri']);
    s.bestiary.baiacu = { seen: true, caught: 0 };
    AQ.game.markSighting('baleia');
    AQ.game.markSighting('baleia');
    const c = P.completion(s);
    T.eq([c.caught, c.seen, c.total], [3, 1, 45]);
    T.near(c.frac, 4 / 45, 1e-12);
    T.eq(c.pct, Math.floor(400 / 45));
    caught(AQ, AQ.ENUM.SPECIES);
    AQ.ENUM.SIGHTINGS.forEach((id) => AQ.game.markSighting(id));
    T.eq(P.completion(s).pct, 100);
    AQ.progress.check(s);
    T.ok(s.progress.ach.enciclopedia > 0 && s.progress.ach.colecionador > 0);
  });

  T.test('every goal type has a progress reading and strings', () => {
    const { AQ } = fresh(), s = AQ.state;
    for (const g of AQ.goals.chain) {
      const p = AQ.progress.goalProgress(g, s);
      T.ok(Number.isFinite(p.cur) && p.max >= 1, g.id);
      T.ok(AQ.ENUM.GOAL_TYPES.indexOf(g.type) >= 0, g.id + ' type');
      T.ok(AQ.i18n.has('goal.' + g.id, 'pt-BR') && AQ.i18n.has('goal.' + g.id, 'en'), g.id + ' strings');
    }
    T.eq(AQ.goals.chain.map((g) => g.id), AQ.ENUM.GOALS);
    T.eq(AQ.goals.achievements.map((a) => a.id), AQ.ENUM.ACHIEVEMENTS);
    T.eq(AQ.goals.messages.map((m) => m.id), AQ.ENUM.MESSAGES);
    for (const a of AQ.goals.achievements) {
      const p = AQ.progress.achProgress(a, s);
      T.ok(Number.isFinite(p.cur) && p.max >= 1, a.id);
    }
  });
};
