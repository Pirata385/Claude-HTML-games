// Água-Tinta — AQ.aquarium tests (owner D).
'use strict';
const { install } = require('./test-economy.js');

// Fixture species for tank rules.
const FX = {
  fx_xs: { id: 'fx_xs', zones: ['baia'], rarity: 'C', size: 'XS', kind: 'fish', value: 10, len: [5, 10], kgMax: 0.1, habitat: ['open'], light: 'day', diet: 'prey', breeds: true, keep: true },
  fx_s: { id: 'fx_s', zones: ['baia'], rarity: 'C', size: 'S', kind: 'fish', value: 20, len: [10, 20], kgMax: 0.5, habitat: ['rocks'], light: 'dim', diet: 'grazer', breeds: true, keep: true },
  fx_pred: { id: 'fx_pred', zones: ['baia'], rarity: 'U', size: 'M', kind: 'eel', value: 100, len: [50, 100], kgMax: 10, habitat: ['cave'], light: 'night', diet: 'predator', breeds: false, keep: true },
  fx_rare: { id: 'fx_rare', zones: ['baia'], rarity: 'R', size: 'XS', kind: 'fish', value: 200, len: [5, 10], kgMax: 0.1, habitat: ['open'], light: 'day', diet: 'prey', breeds: true, keep: true },
  fx_l: { id: 'fx_l', zones: ['mar'], rarity: 'U', size: 'L', kind: 'fish', value: 300, len: [80, 200], kgMax: 100, habitat: ['open'], light: 'day', diet: 'grazer', breeds: true, keep: true },
  fx_xxl: { id: 'fx_xxl', zones: ['abismo'], rarity: 'L', size: 'XXL', kind: 'cephalopod', value: 0, len: [1000, 2000], kgMax: 900, habitat: [], light: 'night', diet: 'predator', breeds: false, keep: false },
  fx_shrimp: { id: 'fx_shrimp', zones: ['baia'], rarity: 'C', size: 'XS', kind: 'crustacean', value: 9, len: [5, 15], kgMax: 0.03, habitat: ['open'], light: 'day', diet: 'prey', breeds: false, keep: true, produces: { item: 'camarao', qty: 2, everyMin: 10 } }
};

module.exports = function (T) {
  function fresh() {
    const c = T.load({ fresh: true, now: () => 1e12 });
    c.AQ.store.load();
    install(c.AQ, FX);
    return c.AQ;
  }
  function add(AQ, sp, o) {
    const aq = AQ.state.aquarium;
    const f = Object.assign({ uid: 'f' + (aq.nextUid++), sp, len: 8, kg: 0.05, q: 0.5, dense: false, trophy: false, bred: false, growth: 1, tank: 't1', name: null, at: 1, zone: 'baia' }, o || {});
    aq.fish.push(f);
    return f;
  }
  function tank(AQ, i) { return AQ.state.aquarium.tanks[i || 0]; }

  T.test('happiness factors on fixtures', () => {
    const AQ = fresh(), s = AQ.state, tk = tank(AQ);
    const f = add(AQ, 'fx_xs');
    let h = AQ.aquarium.fishHappiness(f, tk, s);
    T.eq(h.value, 100);
    T.eq(h.factors, { food: 1, space: 1, habitat: 1, light: 1, harmony: 1, quality: 1 });
    tk.food = 0;
    h = AQ.aquarium.fishHappiness(f, tk, s);
    T.near(h.factors.food, Math.pow(0.3, 0.6), 1e-12);
    T.eq(h.value, Math.round(100 * Math.pow(0.3, 0.6)));
    tk.food = 1;
    // habitat: 'open' only while ≤ 2 decor slots are used; sand is always present
    tk.decor = ['pedras', 'algas', 'coral', null, null];
    T.eq(AQ.aquarium.fishHappiness(f, tk, s).factors.habitat, 0.6);
    T.eq(AQ.aquarium.tankTags(tk, s).sort(), ['coral', 'plants', 'rocks', 'sand']);
    tk.decor = ['pedras', null, null, null, null];
    T.eq(AQ.aquarium.fishHappiness(f, tk, s).factors.habitat, 1);
    // space: u = 12/12 → .5
    for (let i = 0; i < 11; i++) add(AQ, 'fx_xs');
    T.eq(AQ.aquarium.tankUsage(tk, s), { used: 12, cap: 12, bioload: 12, filterCap: 14 });
    T.eq(AQ.aquarium.fishHappiness(f, tk, s).factors.space, 0.5);
    T.eq(AQ.aquarium.fishHappiness(f, tk, s).value, 50);
    // quality: bioload over the filter
    tk.cap = 2; // cap 20, bioload 12 → u .6
    for (let i = 0; i < 8; i++) add(AQ, 'fx_xs'); // bioload 20 vs filter 14
    const q = AQ.aquarium.fishHappiness(f, tk, s).factors.quality;
    T.near(q, Math.pow(14 / 20, 0.7), 1e-12);
    T.eq(AQ.aquarium.tankHappiness({ id: 'tx', decor: [], food: 1, cap: 1, filter: 1, light: 'day' }, s), 100, 'empty tank → 100');
    T.eq(AQ.aquarium.face(80), ':D'); T.eq(AQ.aquarium.face(79), ':)'); T.eq(AQ.aquarium.face(60), ':)');
    T.eq(AQ.aquarium.face(40), ':|'); T.eq(AQ.aquarium.face(39), ':(');
  });

  T.test('light adjacency: exact 1, adjacent .85, opposite .7', () => {
    const AQ = fresh(), s = AQ.state, tk = tank(AQ);
    const day = add(AQ, 'fx_xs'), dim = add(AQ, 'fx_s'), night = add(AQ, 'fx_pred', { tank: 'tz' });
    night.tank = 't1';
    const L = (f) => AQ.aquarium.fishHappiness(f, tk, s).factors.light;
    tk.light = 'day'; T.eq([L(day), L(dim), L(night)], [1, 0.85, 0.7]);
    tk.light = 'dim'; T.eq([L(day), L(dim), L(night)], [0.85, 1, 0.85]);
    tk.light = 'night'; T.eq([L(day), L(dim), L(night)], [0.7, 0.85, 1]);
  });

  T.test('canFit uses size costs; XXL and keep:false never fit', () => {
    const AQ = fresh(), s = AQ.state, tk = tank(AQ);
    T.ok(AQ.aquarium.canFit('fx_l', tk, s));
    add(AQ, 'fx_l'); // 8
    T.ok(AQ.aquarium.canFit({ sp: 'fx_pred' }, tk, s)); // +4 = 12
    add(AQ, 'fx_pred');
    T.ok(!AQ.aquarium.canFit('fx_xs', tk, s), 'full');
    T.ok(!AQ.aquarium.canFit('fx_xxl', tk, s));
    T.ok(!AQ.aquarium.canFit('tinteira', tk, s));
    const t2 = { id: 't2', cap: 4, filter: 1, decor: [], food: 1, light: 'day' };
    s.aquarium.tanks.push(t2);
    T.eq(AQ.aquarium.bestTankFor({ sp: 'fx_xs' }, s), 't2');
    T.eq(AQ.aquarium.bestTankFor({ sp: 'fx_xxl' }, s), null);
    for (let i = 0; i < 48; i++) add(AQ, 'fx_xs', { tank: 't2' });
    T.eq(AQ.aquarium.bestTankFor({ sp: 'fx_xs' }, s), null);
    const inTank = s.aquarium.fish.find((f) => f.tank === 't2');
    T.ok(AQ.aquarium.canFit(inTank, t2, s), 'a fish already in the tank fits');
  });

  T.test('predator stress: ≥ 2 size classes smaller', () => {
    const AQ = fresh(), s = AQ.state, tk = tank(AQ);
    const xs = add(AQ, 'fx_xs'), sm = add(AQ, 'fx_s');
    T.eq(AQ.aquarium.fishHappiness(xs, tk, s).factors.harmony, 1);
    const p = add(AQ, 'fx_pred'); // M = class 2
    T.eq(AQ.aquarium.fishHappiness(xs, tk, s).factors.harmony, 0.6, 'XS vs M');
    T.eq(AQ.aquarium.fishHappiness(sm, tk, s).factors.harmony, 1, 'S vs M');
    T.eq(AQ.aquarium.fishHappiness(p, tk, s).factors.harmony, 1, 'not stressed by itself');
    p.growth = 0.5;
    T.eq(AQ.aquarium.fishHappiness(xs, tk, s).factors.harmony, 1, 'juvenile predators do not stress');
  });

  T.test('stars thresholds and attraction', () => {
    const AQ = fresh(), A = AQ.aquarium;
    const ST = AQ.ENUM.STARS; // [0, 100, 600, 1500, 5000] after the QA balance pass
    T.eq([A.starsFor(0), A.starsFor(ST[1] - 0.1), A.starsFor(ST[1]), A.starsFor(ST[2] - 1), A.starsFor(ST[2]), A.starsFor(ST[3]), A.starsFor(ST[4] - 1), A.starsFor(ST[4])], [1, 1, 2, 2, 3, 4, 4, 5]);
    T.eq(A.stars(AQ.state), 1);
    const s = AQ.state, tk = tank(AQ);
    const f = add(AQ, 'fx_xs', { q: 0 });
    const ap = Math.pow(10, 0.75) * 0.8;
    T.near(A.tankAttraction(tk, s), ap * 1.04, 1e-9);
    tk.decor = ['coral', null, null, null, null];
    T.near(A.tankAttraction(tk, s), ap * 1.04 * 1.04, 1e-9, 'one decor keeps open water and adds +4%');
    tk.decor = ['coral', 'pedras', 'algas', null, null];
    T.near(A.tankAttraction(tk, s), ap * 0.6 * 1.04 * 1.08, 1e-9, 'three decor remove open water (.6)');
    tk.decor = ['bau', null, null, null, null];
    T.near(A.tankAttraction(tk, s), ap * 1.04 * 1.08, 1e-9);
    f.dense = true;
    T.near(A.tankAttraction(tk, s), ap * 3 * 1.04 * 1.08, 1e-9);
    add(AQ, 'fx_rare', { q: 0 });
    T.ok(A.attraction(s) > A.tankAttraction(tk, s) - 1e-9);
  });

  T.test('breeding needs ≥ 2 adults, happiness ≥ 70 and space; rate ≈ .30', () => {
    const AQ = fresh(), s = AQ.state, tk = tank(AQ);
    const rng = AQ.rng.create('breed');
    add(AQ, 'fx_xs');
    let evs = AQ.aquarium.tick(s, 480, rng, {});
    T.ok(!evs.some((e) => e.type === 'bred'), 'one adult never breeds');
    const b = add(AQ, 'fx_xs', { growth: 0.2 });
    let any = false;
    for (let i = 0; i < 30; i++) { tk.food = 1; b.growth = 0.2; if (AQ.aquarium.tick(s, 480, rng, {}).some((e) => e.type === 'bred')) any = true; }
    T.ok(!any, 'a juvenile is not a parent');
    b.growth = 1;
    // unhappy tank (no food) → no breeding
    for (let i = 0; i < 30; i++) { tk.food = 0; tk.foodLowSec = 0; if (AQ.aquarium.tick(s, 480, rng, {}).some((e) => e.type === 'bred')) any = true; }
    T.ok(!any, 'happiness < 70 blocks breeding');
    // rate: reset the juveniles each time
    let births = 0;
    const N = 3000;
    for (let i = 0; i < N; i++) {
      tk.food = 1;
      s.aquarium.fish = s.aquarium.fish.filter((f) => !f.bred);
      evs = AQ.aquarium.tick(s, 480, rng, {});
      births += evs.filter((e) => e.type === 'bred').length;
    }
    T.near(births / N, 0.30, 0.035, 'birth rate');
    const juv = s.aquarium.fish.find((f) => f.bred) || (() => { tk.food = 1; for (let i = 0; i < 50 && !s.aquarium.fish.some((f) => f.bred); i++) { tk.food = 1; AQ.aquarium.tick(s, 480, rng, {}); } return s.aquarium.fish.find((f) => f.bred); })();
    T.ok(juv, 'a juvenile exists');
    T.eq([juv.bred, juv.growth, juv.tank, juv.name], [true, 0.2, 't1', null]);
    T.ok(juv.len >= 5 && juv.len <= 10);
    // no space → no birth
    s.aquarium.fish = s.aquarium.fish.filter((f) => !f.bred);
    for (let i = 0; i < 10; i++) add(AQ, 'fx_xs', { name: 'x' + i }); // 12/12
    let full = 0;
    for (let i = 0; i < 40; i++) { tk.food = 1; full += AQ.aquarium.tick(s, 480, rng, {}).filter((e) => e.type === 'bred').length; }
    T.eq(full, 0, 'no free capacity');
  });

  T.test('juveniles grow to adults in 16 min (+1/20 per min)', () => {
    const AQ = fresh(), s = AQ.state, tk = tank(AQ);
    const j = add(AQ, 'fx_xs', { bred: true, growth: 0.2 });
    const rng = AQ.rng.create('g');
    for (let i = 0; i < 8 * 60; i++) { tk.food = 1; AQ.aquarium.tick(s, 1, rng, {}); }
    T.near(j.growth, 0.6, 1e-6);
    let grown = 0;
    for (let i = 0; i < 12 * 60; i++) { tk.food = 1; grown += AQ.aquarium.tick(s, 1, rng, {}).filter((e) => e.type === 'grown').length; }
    T.eq(j.growth, 1);
    T.eq(grown, 1, 'one grown event');
  });

  T.test('oyster pearls every 12 min at happiness ≥ 60', () => {
    const AQ = fresh(), s = AQ.state, tk = tank(AQ);
    const rng = AQ.rng.create('p');
    tk.decor = ['ostra', null, null, null, null];
    add(AQ, 'fx_xs');
    for (let i = 0; i < 12 * 60; i++) { tk.food = 1; AQ.aquarium.tick(s, 1, rng, {}); }
    T.eq(s.player.pearls, 1);
    // unhappy: no pearls accrue
    const before = s.player.pearls;
    for (let i = 0; i < 30 * 60; i++) { tk.food = 0; tk.foodLowSec = 0; AQ.aquarium.tick(s, 1, rng, {}); }
    T.eq(s.player.pearls, before);
    // no oyster → nothing
    tk.decor = [null, null, null, null, null];
    for (let i = 0; i < 30; i++) { tk.food = 1; AQ.aquarium.tick(s, 60, rng, {}); }
    T.eq(s.player.pearls, before);
  });

  T.test('happy shrimp produce 2 camarão baits every 10 min (online)', () => {
    const AQ = fresh(), s = AQ.state, tk = tank(AQ);
    const rng = AQ.rng.create('s');
    add(AQ, 'fx_shrimp'); add(AQ, 'fx_shrimp');
    for (let i = 0; i < 10 * 60; i++) { tk.food = 1; AQ.aquarium.tick(s, 1, rng, {}); }
    T.eq(s.player.baits.camarao, 4);
    AQ.aquarium.tick(s, 3 * 3600, rng, { offline: true });
    T.eq(s.player.baits.camarao, 4, 'never offline');
  });

  T.test('predation: after 5 min below .15 food; never rare, dense or named', () => {
    const AQ = fresh(), s = AQ.state, tk = tank(AQ);
    const rng = AQ.rng.create('pr');
    add(AQ, 'fx_pred');
    const rare = add(AQ, 'fx_rare'), dense = add(AQ, 'fx_xs', { dense: true }), named = add(AQ, 'fx_xs', { name: 'Zé' });
    tk.food = 0.14;
    let evs = [];
    for (let i = 0; i < 299; i++) evs = evs.concat(AQ.aquarium.tick(s, 1, rng, {}));
    T.ok(!evs.some((e) => e.type === 'predation'), 'not before 5 min');
    for (let i = 0; i < 600; i++) evs = evs.concat(AQ.aquarium.tick(s, 1, rng, {}));
    T.ok(!evs.some((e) => e.type === 'predation'), 'protected fish are never eaten');
    T.eq(s.aquarium.fish.length, 4);
    const prey = add(AQ, 'fx_xs');
    add(AQ, 'fx_s'); // S vs M: too big
    tk.foodLowSec = 0;
    evs = [];
    for (let i = 0; i < 300; i++) evs = evs.concat(AQ.aquarium.tick(s, 1, rng, {}));
    const p = evs.filter((e) => e.type === 'predation');
    T.eq(p.length, 1);
    T.eq([p[0].predator, p[0].prey, p[0].uid], ['fx_pred', 'fx_xs', prey.uid]);
    T.ok(s.aquarium.fish.indexOf(prey) < 0 && s.aquarium.fish.indexOf(rare) >= 0 && s.aquarium.fish.indexOf(dense) >= 0 && s.aquarium.fish.indexOf(named) >= 0);
    // warning when food crosses .3
    tk.food = 0.3005; add(AQ, 'fx_xs');
    evs = AQ.aquarium.tick(s, 2, rng, {});
    const w = evs.find((e) => e.type === 'warning');
    T.ok(w && w.kind === 'predator' && w.sp === 'fx_pred' && w.prey === 'fx_xs');
    // feeding resets the timer
    tk.food = 0.1; tk.foodLowSec = 290;
    tk.food = 1; AQ.aquarium.tick(s, 1, rng, {});
    T.eq(tk.foodLowSec, 0);
  });

  T.test('offline: no predation, no breeding, .2 food floor, till capped at 50%', () => {
    const AQ = fresh(), s = AQ.state, tk = tank(AQ);
    const rng = AQ.rng.create('off');
    add(AQ, 'fx_pred'); add(AQ, 'fx_xs'); add(AQ, 'fx_xs'); add(AQ, 'fx_s'); add(AQ, 'fx_s');
    tk.food = 1;
    const rate = AQ.economy.incomePerMinute(s);
    const evs = AQ.aquarium.tick(s, 10 * 3600, rng, { offline: true });
    T.eq(tk.food, 0.2, 'floor');
    T.eq(s.aquarium.fish.length, 5, 'no predation');
    T.ok(!evs.some((e) => e.type === 'bred' || e.type === 'predation' || e.type === 'warning'));
    T.eq(s.aquarium.till, Math.floor(0.5 * rate * 120));
    tk.food = 0.1;
    AQ.aquarium.tick(s, 3600, rng, { offline: true });
    T.eq(tk.food, 0.1, 'below the floor stays put');
    tk.food = 0.5;
    AQ.aquarium.tick(s, 45 * 60 * 0.1, rng, { offline: true });
    T.near(tk.food, 0.4, 1e-9);
    // juveniles grow offline
    const j = add(AQ, 'fx_xs', { bred: true, growth: 0.2 });
    AQ.aquarium.tick(s, 3600, rng, { offline: true });
    T.eq(j.growth, 1);
  });

  T.test('auto-feeder refills below .3 and pays; skips without coins', () => {
    const AQ = fresh(), s = AQ.state, tk = tank(AQ);
    const rng = AQ.rng.create('af');
    tk.feeder = true;
    for (let i = 0; i < 6; i++) add(AQ, 'fx_s'); // bioload 12 → cost 6
    s.player.coins = 10;
    tk.food = 0.3005;
    let evs = AQ.aquarium.tick(s, 2, rng, {});
    const fed = evs.find((e) => e.type === 'fed');
    T.ok(fed && fed.auto && fed.cost === 6);
    T.eq(tk.food, 1); T.eq(s.player.coins, 4);
    tk.food = 0.29;
    evs = AQ.aquarium.tick(s, 1, rng, {});
    T.ok(!evs.some((e) => e.type === 'fed'));
    T.ok(tk.food < 0.3);
    // offline: refills within the cap
    s.player.coins = 1000; tk.food = 1;
    evs = AQ.aquarium.tick(s, 2 * 3600, rng, { offline: true });
    const f2 = evs.find((e) => e.type === 'fed');
    T.ok(f2 && f2.n >= 3, 'several refills in 2 h');
    T.ok(tk.food >= 0.3);
  });

  T.test('till accrues INCOME_K · attraction per minute online', () => {
    const AQ = fresh(), s = AQ.state, tk = tank(AQ);
    const rng = AQ.rng.create('t');
    for (let i = 0; i < 6; i++) add(AQ, 'fx_l', { tank: 't1', q: 1 });
    tk.cap = 4;
    const rate = AQ.economy.incomePerMinute(s);
    let total = 0;
    for (let i = 0; i < 60; i++) { tk.food = 1; AQ.aquarium.tick(s, 1, rng, {}); }
    total = s.aquarium.till + s.aquarium.tillCarry;
    T.near(total, rate, rate * 0.02);
  });
};
