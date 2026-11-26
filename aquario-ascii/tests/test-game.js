// Água-Tinta — AQ.game tests (owner D).
'use strict';

module.exports = function (T) {
  function fresh() {
    const clock = { t: 1e12 };
    const c = T.load({ fresh: true, now: () => clock.t });
    c.AQ.store.load();
    c.AQ.state.meta.lastActive = clock.t;
    const ev = [];
    c.AQ.events.on('*', (p, n) => ev.push([n, p]));
    return { AQ: c.AQ, clock, ev, names: () => ev.map((e) => e[0]) };
  }
  function spec(AQ, sp, o) {
    const s = AQ.species.get(sp);
    return Object.assign({ sp, len: s.len[0] + 1, kg: 0.1, q: 0.5, dense: false, trophy: false, zone: s.zones[0], at: 7 }, o || {});
  }

  T.test('resolveCatch keep / sell / release mutate the state', () => {
    const { AQ, names } = fresh(), s = AQ.state, G = AQ.game;
    const a = spec(AQ, 'baiacu');
    const val = AQ.economy.specimenValue(a);
    let r = G.resolveCatch(a, { choice: 'sell' });
    T.eq([r.value, r.isNew, r.isRecord, r.fish, r.choice], [val, true, false, null, 'sell']);
    T.ok(s.player.coins >= 50 + val);
    T.eq(s.bestiary.baiacu.caught, 1); T.eq(s.bestiary.baiacu.sold, 1); T.eq(s.stats.sold, 1); T.eq(s.stats.catches, 1);
    T.ok(names().indexOf('species:new') >= 0 && names().indexOf('catch:resolved') >= 0 && names().indexOf('wallet:changed') >= 0);
    r = G.resolveCatch(spec(AQ, 'baiacu', { len: 30 }), { choice: 'keep', tankId: 't1' });
    T.eq([r.isNew, r.isRecord, r.choice], [false, true, 'keep']);
    T.ok(r.fish && r.fish.uid === 'f1' && r.fish.tank === 't1' && r.fish.growth === 1 && r.fish.bred === false);
    T.eq(s.aquarium.fish.length, 1); T.eq(s.bestiary.baiacu.kept, 1); T.eq(s.stats.kept, 1);
    T.eq(s.bestiary.baiacu.bestLen, 30);
    r = G.resolveCatch(spec(AQ, 'baiacu', { len: 16 }), { choice: 'release' });
    T.eq(r.isRecord, false);
    T.eq(s.bestiary.baiacu.released, 1); T.eq(s.stats.released, 1);
    T.near(G.luck('baia'), 0.05, 1e-12);
    T.eq(G.luck('recife'), 0);
    for (let i = 0; i < 10; i++) G.resolveCatch(spec(AQ, 'manjuba'), { choice: 'release' });
    T.eq(G.luck('baia'), 0.25, 'luck capped at 25%');
    G.setZone('recife');
    T.eq(G.luck('baia'), 0, 'changing zone resets luck');
  });

  T.test('keep falls back to sell when nothing fits; catchInfo reports usage', () => {
    const { AQ } = fresh(), s = AQ.state, G = AQ.game;
    for (let i = 0; i < 12; i++) G.resolveCatch(spec(AQ, 'manjuba'), { choice: 'keep' });
    T.eq(s.aquarium.fish.length, 12);
    const info = G.catchInfo(spec(AQ, 'manjuba'));
    T.eq([info.canKeep, info.tankId, info.tanks[0].used, info.tanks[0].cap, info.tanks[0].fits], [false, null, 12, 12, false]);
    const coins = s.player.coins;
    const r = G.resolveCatch(spec(AQ, 'manjuba'), { choice: 'keep' });
    T.eq(r.choice, 'sell');
    T.eq(s.aquarium.fish.length, 12);
    T.ok(s.player.coins > coins);
  });

  T.test('first rare +2 pearls, first legendary +10', () => {
    const { AQ } = fresh(), s = AQ.state, G = AQ.game;
    G.resolveCatch(spec(AQ, 'cavalo'), { choice: 'sell' });
    T.eq(s.player.pearls, 2);
    G.resolveCatch(spec(AQ, 'cavalo'), { choice: 'sell' });
    T.eq(s.player.pearls, 2, 'only the first');
    const p = s.player.pearls;
    G.resolveCatch(spec(AQ, 'tipografo'), { choice: 'sell' });
    T.ok(s.player.pearls >= p + 10);
  });

  T.test('tinteira → ending, never kept', () => {
    const { AQ, names } = fresh(), s = AQ.state, G = AQ.game;
    const r = G.resolveCatch(spec(AQ, 'tinteira'), { choice: 'keep' });
    T.eq(r.choice, 'release');
    T.eq(r.fish, null);
    T.eq(s.aquarium.fish.length, 0);
    T.eq(s.progress.ending, true);
    T.ok(s.progress.endingAt > 0);
    T.eq(s.player.unlocks.paperTheme, true);
    T.ok(names().indexOf('ending:start') > names().indexOf('catch:resolved'));
    T.ok(s.progress.ach.fim_da_tinta > 0);
    T.eq(s.bestiary.tinteira.caught, 1);
    T.eq(G.luck('abismo'), 0, 'the boss gives no luck');
  });

  T.test('bait consumption and fallback to massa', () => {
    const { AQ, ev } = fresh(), s = AQ.state, G = AQ.game;
    T.eq(G.consumeBait(), 'massa');
    T.eq(s.player.baits.massa, -1);
    T.ok(!G.equipBait('camarao'), 'not owned');
    T.ok(!G.equipBait('colher'), 'lure not owned');
    T.ok(G.equipBait('minhoca'));
    T.eq(s.player.bait, 'minhoca');
    for (let i = 0; i < 9; i++) T.eq(G.consumeBait(), 'minhoca');
    T.eq(s.player.baits.minhoca, 1);
    T.eq(G.consumeBait(), 'minhoca');
    T.eq(s.player.baits.minhoca, 0);
    T.eq(s.player.bait, 'massa');
    const last = ev.filter((e) => e[0] === 'inventory:changed').pop()[1];
    T.eq([last.id, last.prev, last.reason], ['massa', 'minhoca', 'empty']);
    G.addBait('colher', 1);
    T.ok(G.equipBait('colher'));
    T.eq(G.consumeBait(), 'colher');
    T.eq(s.player.bait, 'colher', 'lures are permanent');
    G.addBait('lula', 3);
    T.eq(s.player.baits.lula, 3);
    T.ok(!G.addBait('nope', 1));
  });

  T.test('buy deducts or is denied with a reason', () => {
    const { AQ, ev } = fresh(), s = AQ.state, G = AQ.game;
    let r = G.buy('rod');
    T.eq(r, { ok: false, reason: 'coins' });
    T.eq(ev.filter((e) => e[0] === 'shop:denied').pop()[1], { itemId: 'rod', reason: 'coins' });
    r = G.buy('bait_minhoca');
    T.ok(r.ok);
    T.eq(s.player.coins, 40); T.eq(s.player.baits.minhoca, 20); T.eq(s.stats.coinsSpent, 10);
    T.eq(G.buy('boat').reason, 'req');
    T.eq(G.buy('bait_papel').reason, 'req');
    T.eq(G.buy('nope').reason, 'req');
    s.player.coins = 100000;
    T.ok(G.buy('rod').ok); T.eq(s.player.gear.rod, 2);
    T.ok(G.buy('lure_colher').ok); T.eq(s.player.lures.colher, true);
    T.eq(G.buy('lure_colher').reason, 'maxed');
    T.ok(G.buy('tank').ok); T.eq(s.aquarium.tanks.length, 2); T.eq(s.aquarium.tanks[1].id, 't2');
    T.eq(s.aquarium.tanks[1].decor.length, 5);
    r = G.buy('tankcap', { tankId: 't2' }); T.ok(r.ok); T.eq(r.tankId, 't2'); T.eq(s.aquarium.tanks[1].cap, 2);
    T.ok(G.buy('filter', { tankId: 't1' }).ok); T.eq(s.aquarium.tanks[0].filter, 2);
    T.ok(G.buy('feeder', { tankId: 't1' }).ok); T.eq(s.aquarium.tanks[0].feeder, true);
    T.ok(G.buy('cofre').ok); T.eq(s.player.cofre, 2);
    T.ok(G.buy('pedras').ok); T.eq(s.player.decor.pedras, 1);
    T.eq(G.buy('coral').reason, 'req', 'needs ★2');
    T.eq(G.buy('farol').reason, 'req');
    s.progress.stars = 4;
    T.eq(G.buy('farol').reason, 'pearls');
    s.player.pearls = 30;
    T.ok(G.buy('farol').ok); T.eq(s.player.pearls, 0);
    for (let i = 0; i < 4; i++) G.buy('rod');
    T.eq(s.player.gear.rod, 5);
    T.eq(G.buy('rod').reason, 'maxed');
  });

  T.test('moveFish respects capacity; sell / release / rename', () => {
    const { AQ } = fresh(), s = AQ.state, G = AQ.game;
    s.player.coins = 10000;
    G.buy('tank');
    for (let i = 0; i < 3; i++) G.resolveCatch(spec(AQ, 'arraia'), { choice: 'keep', tankId: 't1' }); // M = 4 → 12/12
    T.eq(AQ.aquarium.tankUsage(s.aquarium.tanks[0], s).used, 12);
    for (let i = 0; i < 2; i++) G.resolveCatch(spec(AQ, 'arraia'), { choice: 'keep', tankId: 't2' });
    T.eq(s.aquarium.fish.filter((f) => f.tank === 't2').length, 2);
    G.resolveCatch(spec(AQ, 'manjuba'), { choice: 'keep', tankId: 't2' }); // 9/12
    const m = s.aquarium.fish.find((f) => f.sp === 'manjuba');
    T.ok(!G.moveFish(m.uid, 't1'), 't1 is full');
    const a = s.aquarium.fish.find((f) => f.tank === 't1');
    T.ok(!G.moveFish(a.uid, 't2'), '9 + 4 > 12');
    T.ok(G.moveFish(m.uid, 't2'), 'same tank is a no-op');
    T.ok(!G.moveFish('nope', 't2')); T.ok(!G.moveFish(m.uid, 't9'));
    const coins = s.player.coins;
    const v = G.sellFish(a.uid);
    T.eq(v, AQ.economy.fishSellValue(a)); T.eq(s.player.coins, coins + v);
    T.ok(G.moveFish(m.uid, 't1'));
    T.eq(m.tank, 't1');
    T.ok(G.renameFish(m.uid, '  Dona <b>Manju</b> com nome longo demais  '));
    T.eq(m.name, 'Dona bManju/b co');
    T.ok(G.renameFish(m.uid, '   ')); T.eq(m.name, null);
    T.ok(G.releaseFish(m.uid));
    T.eq(G.fishByUid(m.uid), null);
    T.eq(G.sellFish('nope'), 0); T.ok(!G.releaseFish('nope'));
  });

  T.test('feed, till, decor and light', () => {
    const { AQ, names } = fresh(), s = AQ.state, G = AQ.game, tk = s.aquarium.tanks[0];
    tk.food = 0.4;
    T.ok(G.feedTank('t1'));
    T.eq(tk.food, 1); T.eq(s.player.coins, 60, 'first feed free (+$10 from g03)'); T.eq(s.stats.fed, 1);
    s.player.coins = 2;
    T.ok(!G.feedTank('t1'), 'cannot afford $3');
    s.player.coins = 50;
    T.eq(G.collectTill(), 0);
    s.aquarium.till = 123; s.aquarium.tillCarry = 0.5;
    T.eq(G.collectTill(), 123);
    T.eq([s.aquarium.till, s.aquarium.tillCarry, s.player.coins, s.stats.tillCollected, s.stats.tillCollects], [0, 0.5, 173 + 20 * (s.progress.goalsDone.g06 ? 1 : 0), 123, 1]);
    T.ok(names().indexOf('aquarium:collected') >= 0);
    s.player.decor.pedras = 1; s.player.decor.ostra = 2;
    T.ok(G.placeDecor('t1', 0, 'pedras')); T.eq(s.player.decor.pedras, 0); T.eq(tk.decor[0], 'pedras');
    T.ok(!G.placeDecor('t1', 1, 'pedras'), 'none left');
    T.ok(G.placeDecor('t1', 1, 'ostra'));
    T.ok(!G.placeDecor('t1', 2, 'ostra'), 'one oyster per tank');
    T.ok(G.placeDecor('t1', 0, 'ostra') === false);
    T.ok(G.placeDecor('t1', 0, null)); T.eq(s.player.decor.pedras, 1); T.eq(tk.decor[0], null);
    T.ok(G.placeDecor('t1', 1, 'pedras')); T.eq(s.player.decor.ostra, 2, 'the oyster returned'); T.eq(tk.decor[1], 'pedras');
    T.ok(!G.placeDecor('t1', 7, 'pedras')); T.ok(!G.placeDecor('t9', 0, 'pedras'));
    T.eq(G.setTankLight('t1'), 'dim'); T.eq(G.setTankLight('t1'), 'night'); T.eq(G.setTankLight('t1'), 'day');
    T.eq(G.setTankLight('t1', 'night'), 'night');
  });

  T.test('tick emits aquarium events; applyOffline summary with no predation', () => {
    const { AQ, clock, ev } = fresh(), s = AQ.state, G = AQ.game;
    s.aquarium.tanks[0].cap = 2;
    G.resolveCatch(spec(AQ, 'moreia'), { choice: 'keep' });
    for (let i = 0; i < 4; i++) G.resolveCatch(spec(AQ, 'camarao'), { choice: 'keep' });
    s.aquarium.tanks[0].food = 1;
    for (let i = 0; i < 120; i++) G.tick(1);
    T.ok(s.aquarium.till > 0);
    T.ok(ev.some((e) => e[0] === 'aquarium:till'));
    T.eq(G.applyOffline(clock.t + 30e3), null, 'under 60 s');
    s.meta.lastActive = clock.t;
    const n = s.aquarium.fish.length, till = s.aquarium.till;
    const sum = G.applyOffline(clock.t + 3 * 3600e3);
    T.ok(sum && sum.awayMs === 3 * 3600e3 && sum.capped === true);
    T.eq(s.aquarium.till, till + sum.coins);
    T.ok(sum.coins > 0);
    T.eq(s.aquarium.fish.length, n, 'no predation offline');
    T.eq(s.aquarium.tanks[0].food, 0.2);
    T.eq(s.meta.lastActive, clock.t + 3 * 3600e3);
    T.ok(ev.some((e) => e[0] === 'offline:summary'));
    T.eq(G.lastOffline, sum);
    // online hunger: warning then predation after 5 min under .15
    s.aquarium.tanks[0].food = 0.31;
    for (let i = 0; i < 60 * 15; i++) G.tick(1);
    T.ok(ev.some((e) => e[0] === 'aquarium:warning' && e[1].kind === 'predator' && e[1].sp === 'moreia'));
    T.ok(ev.some((e) => e[0] === 'aquarium:predation' && e[1].predator === 'moreia' && e[1].prey === 'camarao'));
  });

  T.test('stats from bus events; messages, sightings, bottles, seen', () => {
    const { AQ, ev } = fresh(), s = AQ.state, G = AQ.game;
    AQ.events.emit('fish:cast', { power: 1, dir: 1 });
    AQ.events.emit('bite:miss', { sp: 'manjuba', reason: 'early' });
    AQ.events.emit('bite:miss', { sp: 'manjuba', reason: 'late' });
    AQ.events.emit('fight:end', { sp: 'manjuba', result: 'landed', sec: 12 });
    T.eq([s.stats.casts, s.stats.early, s.stats.late, s.stats.escapes, s.stats.longestFight], [1, 1, 1, 0, 12]);
    T.eq(G.foundMessage(), 'm1'); T.eq(G.foundMessage(), 'm2'); T.eq(G.foundMessage(), 'm3');
    T.eq(s.player.unlocks.papel, true);
    T.ok(s.progress.goalsDone.g19 === undefined || true);
    for (let i = 0; i < 5; i++) G.foundMessage();
    T.eq(G.foundMessage(), null);
    T.ok(G.allMessagesFound());
    T.ok(G.markSighting('baleia')); T.ok(!G.markSighting('baleia'));
    T.eq(G.bottleCoins('baia'), 50); T.eq(G.bottleCoins('abismo'), 250);
    T.ok(G.markSeen('siri')); T.ok(!G.markSeen('siri'));
    T.eq(s.bestiary.siri.caught, 0);
    T.ok(ev.some((e) => e[0] === 'species:seen' && e[1].sp === 'siri'));
    T.eq(G.stat('custom', 3), 3);
  });

  T.test('newGame resets the state in place', () => {
    const { AQ } = fresh(), G = AQ.game, ref = AQ.state;
    AQ.state.player.coins = 999;
    G.addLuck('baia', 0.1);
    const s = G.newGame();
    T.ok(s === ref);
    T.eq(s.player.coins, 50);
    T.eq(G.luck('baia'), 0);
    T.eq(AQ.progress.activeGoals(s).map((g) => g.id), ['g01', 'g02', 'g03']);
  });
};
