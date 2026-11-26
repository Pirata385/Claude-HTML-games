// Água-Tinta — AQ.items / AQ.economy tests (owner D).
'use strict';

// Fixture species (independent of B's tuning). install() makes AQ.species.get return them first.
const FX = {
  fx_a: { id: 'fx_a', zones: ['baia'], rarity: 'C', size: 'S', kind: 'fish', value: 100, len: [10, 20], kgMax: 1, habitat: ['open'], light: 'day', diet: 'prey', breeds: true, keep: true },
  fx_big: { id: 'fx_big', zones: ['baia'], rarity: 'U', size: 'L', kind: 'fish', value: 400, len: [50, 100], kgMax: 20, habitat: ['rocks'], light: 'dim', diet: 'predator', breeds: true, keep: true }
};
function install(AQ, extra) {
  const real = AQ.species.get;
  const fx = Object.assign({}, FX, extra || {});
  AQ.species.get = (id) => fx[id] || real(id);
}
function fish(AQ, sp, o) {
  const aq = AQ.state.aquarium;
  const f = Object.assign({ uid: 'f' + (aq.nextUid++), sp, len: 10, kg: 0.1, q: 0.5, dense: false, trophy: false, bred: false, growth: 1, tank: 't1', name: null, at: 1, zone: 'baia' }, o || {});
  aq.fish.push(f);
  return f;
}

module.exports = function (T) {
  function fresh() { const c = T.load({ fresh: true, now: () => 1e12 }); c.AQ.store.load(); install(c.AQ); return c.AQ; }

  T.test('items: catalogue shape, tiers and prices increase', () => {
    const AQ = fresh(), I = AQ.items;
    for (const slot of AQ.ENUM.GEAR) {
      const arr = I.GEAR[slot];
      T.ok(arr.length >= 4, slot);
      for (let i = 1; i < arr.length; i++) {
        T.ok(arr[i].price > arr[i - 1].price, slot + ' price increases');
        T.eq(arr[i].tier, arr[i - 1].tier + 1);
      }
      T.eq(I.gearAt(slot, I.GEAR_MIN[slot]).price, 0, slot + ' starting tier is free');
      T.ok(I.get(slot) && I.get(slot).cat === 'gear');
    }
    T.eq(I.gearAt('rod', 2).price, 120); T.eq(I.gearAt('boat', 2).price, I.get('boat').price[0].coins);
    for (const id of AQ.ENUM.ITEMS_BAIT.concat(AQ.ENUM.ITEMS_LURE, AQ.ENUM.ITEMS_AQUA, AQ.ENUM.DECOR)) T.ok(I.get(id), 'item ' + id);
    for (const it of I.list) {
      T.ok(AQ.ENUM.ITEM_CATS.indexOf(it.cat) >= 0, it.id + ' cat');
      T.ok(AQ.i18n.has(it.name, 'en'), it.id + ' name strings');
      if (Array.isArray(it.price)) for (let i = 1; i < it.price.length; i++) T.ok(it.price[i].coins > it.price[i - 1].coins, it.id + ' tiers increase');
    }
    for (const b of AQ.ENUM.BAITS) T.ok(I.BAITS[b], 'BAITS.' + b);
    T.eq(I.byCat('decor').length, 12);
    T.eq(I.DECOR.coral.attract, 0.04);
  });

  T.test('gear(state) reads the tier tables', () => {
    const AQ = fresh();
    const g = AQ.economy.gear(AQ.state);
    T.eq([g.cast, g.window, g.St, g.Ls, g.maxLen, g.reelSpeed, g.hookClass, g.H, g.lantern], [26, 0, 0.55, 1.0, 90, 7, 1, 0, 6]);
    AQ.state.player.gear = { rod: 5, line: 3, reel: 4, hook: 4, lantern: 2, boat: 5 };
    const h = AQ.economy.gear(AQ.state);
    T.eq([h.cast, h.window, h.Ls, h.maxLen, h.snapGrace, h.reelSpeed, h.riseRate, h.hookClass, h.H, h.lantern, h.lanternTier],
      [70, 0.2, 1.55, 180, 0.35, 13, 5.5, 4, 0.75, 22, 2]);
  });

  T.test('specimenValue is exact on fixtures', () => {
    const AQ = fresh(), V = AQ.economy.specimenValue;
    T.eq(V({ sp: 'fx_a', q: 0 }), 70);
    T.eq(V({ sp: 'fx_a', q: 1 }), 130);
    T.eq(V({ sp: 'fx_a', q: 0.5 }), 100);
    T.eq(V({ sp: 'fx_a', q: 0.5, dense: true }), 400);
    T.eq(V({ sp: 'fx_a', q: 1, trophy: true }), 163); // 162.5 → 163
    T.eq(V({ sp: 'fx_a', q: 0.5, bred: true }), 60);
    T.eq(V({ sp: 'fx_a', q: 1, dense: true, trophy: true }), 650);
    T.eq(V({ sp: 'nope', q: 1 }), 0);
    T.eq(V({ sp: 'tinteira', q: 1 }), 0);
    // juveniles in a tank sell scaled by growth
    T.eq(AQ.economy.fishSellValue({ sp: 'fx_a', q: 0.5, growth: 1 }), 100);
    T.eq(AQ.economy.fishSellValue({ sp: 'fx_a', q: 0.5, bred: true, growth: 0.2 }), Math.round(60 * (0.4 + 0.6 * 0.2)));
  });

  T.test('priceOf follows tiers and returns null when maxed', () => {
    const AQ = fresh(), s = AQ.state, P = (id, o) => AQ.economy.priceOf(id, s, o);
    T.eq(P('rod'), { coins: 120, pearls: 0 });
    T.eq(P('lantern'), { coins: AQ.items.gearAt('lantern', 1).price, pearls: 0 });
    s.player.gear.rod = 5; T.eq(P('rod'), null);
    s.player.gear.hook = 4; T.eq(P('hook'), null);
    s.player.gear.lantern = 3; T.eq(P('lantern'), null);
    T.eq(P('lure_colher'), { coins: 250, pearls: 0 });
    s.player.lures.colher = true; T.eq(P('lure_colher'), null);
    T.eq(P('bait_perola'), { coins: 0, pearls: 20 });
    T.eq(P('farol'), { coins: 0, pearls: 30 });
    T.eq(P('tank'), { coins: 500, pearls: 0 });
    s.aquarium.tanks.push({ id: 't2', cap: 1, filter: 1, feeder: false, light: 'day', food: 1, decor: [null, null, null, null, null] });
    T.eq(P('tank'), AQ.items.get('tank').price[1]);
    s.aquarium.tanks.push({ id: 't3' }, { id: 't4' });
    T.eq(P('tank'), null);
    const t1 = s.aquarium.tanks[0];
    T.eq(P('tankcap', { tankId: 't1' }), { coins: 250, pearls: 0 });
    t1.cap = 3; T.eq(P('tankcap', { tankId: 't1' }), AQ.items.get('tankcap').price[2]);
    t1.cap = 4; T.eq(P('tankcap', { tankId: 't1' }), null);
    T.eq(P('tankcap'), { coins: 250, pearls: 0 }, 'without tankId → first tank not maxed (t2)');
    t1.filter = 3; T.eq(P('filter', { tankId: 't1' }), null);
    t1.feeder = true; T.eq(P('feeder', { tankId: 't1' }), null);
    T.eq(P('feeder', { tankId: 't2' }), { coins: 1200, pearls: 0 });
    T.eq(P('cofre'), AQ.items.get('cofre').price[0]);
    s.player.cofre = 3; T.eq(P('cofre'), null);
    T.eq(P('nope'), null);
  });

  T.test('requirements: boats need species of the previous zone; zone, stars and message gates', () => {
    const AQ = fresh(), s = AQ.state, R = (id) => AQ.economy.requirementsMet(id, s);
    let r = R('boat');
    T.eq(r.ok, false);
    T.eq(r.missing[0].key, 'item.req.species');
    T.eq(r.missing[0].vars.n, 5); T.eq(r.missing[0].vars.have, 0);
    const baia = AQ.species.inZone('baia').map((x) => x.id);
    T.ok(baia.length >= 5, 'B published the Baía roster');
    for (let i = 0; i < 4; i++) s.bestiary[baia[i]] = { seen: true, caught: 1 };
    T.eq(R('boat').ok, false);
    s.bestiary[baia[4]] = { seen: true, caught: 0 };
    T.eq(R('boat').ok, false, 'seen does not count');
    s.bestiary[baia[4]].caught = 2;
    T.eq(R('boat').ok, true);
    T.eq(R('rod').ok, true);
    T.eq(R('bait_lula').ok, false); T.eq(R('bait_lula').missing[0].key, 'item.req.zone');
    s.progress.zones.push('recife');
    T.eq(R('bait_lula').ok, true);
    T.eq(R('coral').ok, false); T.eq(R('coral').missing[0].key, 'item.req.stars');
    s.progress.stars = 2; T.eq(R('coral').ok, true);
    T.eq(R('bait_papel').ok, false); T.eq(R('bait_papel').missing[0].key, 'item.req.message');
    s.messages.m3 = 5; T.eq(R('bait_papel').ok, true);
    T.eq(R('bait_perola').ok, false);
    s.progress.stars = 4; T.eq(R('bait_perola').ok, true);
    T.ok(AQ.economy.canAfford({ coins: 50, pearls: 0 }, s));
    T.ok(!AQ.economy.canAfford({ coins: 51, pearls: 0 }, s));
    T.ok(!AQ.economy.canAfford({ coins: 0, pearls: 1 }, s));
  });

  T.test('income: empty aquarium is 0; rate = INCOME_K · attraction', () => {
    const AQ = fresh(), s = AQ.state;
    T.eq(AQ.economy.incomePerMinute(s), 0);
    T.eq(AQ.aquarium.attraction(s), 0);
    fish(AQ, 'fx_a');
    const attr = AQ.aquarium.attraction(s);
    T.ok(attr > 0);
    T.near(AQ.economy.incomePerMinute(s), AQ.economy.K.INCOME_K * attr, 1e-9);
  });

  T.test('offline = 50% × rate × min(away, cap)', () => {
    const AQ = fresh(), s = AQ.state;
    for (let i = 0; i < 4; i++) fish(AQ, 'fx_a', { q: 1 });
    const rate = AQ.economy.incomePerMinute(s);
    let e = AQ.economy.offlineEarnings(s, 3600e3);
    T.eq(e.coins, Math.floor(0.5 * rate * 60)); T.eq(e.capped, false);
    e = AQ.economy.offlineEarnings(s, 5 * 3600e3);
    T.eq(e.coins, Math.floor(0.5 * rate * 120)); T.eq(e.capped, true, 'cofre I caps at 2 h');
    s.player.cofre = 3;
    e = AQ.economy.offlineEarnings(s, 24 * 3600e3);
    T.eq(e.coins, Math.floor(0.5 * rate * 480));
    T.eq(AQ.economy.offlineEarnings(s, 0).coins, 0);
    T.eq(AQ.economy.offlineEarnings(s, -5).coins, 0);
  });

  T.test('feedCost = max(3, ceil(.5 · bioload)); the first feed is free', () => {
    const AQ = fresh(), s = AQ.state, tk = s.aquarium.tanks[0];
    T.eq(AQ.economy.feedCost(tk, s), 0, 'first feed free');
    s.stats.fed = 1;
    T.eq(AQ.economy.feedCost(tk, s), 3);
    for (let i = 0; i < 5; i++) fish(AQ, 'fx_a'); // S = 2 each → 10
    T.eq(AQ.economy.feedCost(tk, s), 5);
    fish(AQ, 'manjuba'); // XS = 1 → 11
    T.eq(AQ.economy.feedCost(tk, s), 6);
    s.stats.fed = 0;
    T.eq(AQ.economy.feedCost(tk, s, { auto: true }), 6, 'the auto-feeder always pays');
  });

  T.test('no NaN across all species × q × dense', () => {
    const AQ = fresh(), s = AQ.state;
    s.aquarium.tanks[0].cap = 4;
    for (const sp of AQ.species.list) {
      for (const q of [0, 0.5, 1]) for (const dense of [false, true]) {
        const v = AQ.economy.specimenValue({ sp: sp.id, q, dense, trophy: q >= 0.9 });
        T.ok(Number.isInteger(v) && v >= 0, sp.id + ' value ' + v);
        const f = { uid: 'x', sp: sp.id, q, dense, bred: false, growth: 1, tank: 't1' };
        T.ok(Number.isFinite(AQ.economy.fishSellValue(f)), sp.id + ' sell');
      }
      if (sp.keep !== false && sp.size !== 'XXL') fish(AQ, sp.id, { q: 0.5 });
    }
    T.ok(Number.isFinite(AQ.aquarium.attraction(s)));
    T.ok(Number.isFinite(AQ.economy.incomePerMinute(s)));
    const h = AQ.aquarium.tankHappiness(s.aquarium.tanks[0], s);
    T.ok(Number.isFinite(h) && h >= 0 && h <= 100);
  });
};
module.exports.FX = FX;
module.exports.install = install;
