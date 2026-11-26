// Água-Tinta — shop items: gear tiers, baits and lures, aquarium items, decor (owner D). Pure data (§8.2–8.4).
// Names are i18n keys (strings-economy.js): item.<id>.name, gear tiers item.<slot>.<tier>.
(function (AQ) {
  'use strict';

  // ---------------------------------------------------------------- gear (§8.2)
  // GEAR[slot] is ordered by tier; each entry carries its own `tier`. rod/line/reel/hook/boat start at tier 1,
  // lantern at tier 0. Use AQ.items.gearAt(slot, tier) rather than indexing by hand.
  // `price` is what it costs to BUY that tier (the starting tier costs 0). Prices tuned by tests/balance-pacing.js
  // (see notes/D.md); §8.2 lists the first-pass values.
  function tiers(slot, first, prices, stats) {
    return prices.map(function (p, i) {
      var t = first + i;
      return { slot: slot, tier: t, name: 'item.' + slot + '.' + t, price: p, stats: stats[i] };
    });
  }

  var GEAR = {
    rod: tiers('rod', 1, [0, 120, 600, 2000, 8000], [
      { cast: 26, window: 0, St: 0.55 },
      { cast: 34, window: 0.05, St: 0.65 },
      { cast: 44, window: 0.10, St: 0.75 },
      { cast: 56, window: 0.15, St: 0.88 },
      { cast: 70, window: 0.20, St: 1.0 }
    ]),
    line: tiers('line', 1, [0, 75, 450, 1800, 6500], [
      { Ls: 1.0, maxLen: 90, snapGrace: 0.25 },
      { Ls: 1.25, maxLen: 130, snapGrace: 0.30 },
      { Ls: 1.55, maxLen: 180, snapGrace: 0.35 },
      { Ls: 1.9, maxLen: 250, snapGrace: 0.40 },
      { Ls: 2.3, maxLen: 360, snapGrace: 0.45 }
    ]),
    reel: tiers('reel', 1, [0, 150, 700, 2200, 8000], [
      { reelSpeed: 7, riseRate: 7 },
      { reelSpeed: 9, riseRate: 6.5 },
      { reelSpeed: 11, riseRate: 6 },
      { reelSpeed: 13, riseRate: 5.5 },
      { reelSpeed: 16, riseRate: 5 }
    ]),
    hook: tiers('hook', 1, [0, 100, 500, 2000], [
      { hookClass: 1, H: 0 },
      { hookClass: 2, H: 0.25 },
      { hookClass: 3, H: 0.5 },
      { hookClass: 4, H: 0.75 }
    ]),
    lantern: tiers('lantern', 0, [0, 1000, 4000, 10000], [
      { radius: 6 }, { radius: 14 }, { radius: 22 }, { radius: 30 }
    ]),
    boat: tiers('boat', 1, [0, 300, 1200, 3500, 5000], [
      { zone: 'baia' }, { zone: 'recife' }, { zone: 'kelp' }, { zone: 'mar' }, { zone: 'abismo' }
    ])
  };
  var GEAR_MIN = { rod: 1, line: 1, reel: 1, hook: 1, lantern: 0, boat: 1 };

  function gearAt(slot, tier) {
    var arr = GEAR[slot];
    if (!arr) return null;
    return arr[tier - GEAR_MIN[slot]] || null;
  }
  function gearMax(slot) { var arr = GEAR[slot]; return arr ? arr[arr.length - 1].tier : 0; }

  // ---------------------------------------------------------------- baits (§8.3)
  // BAITS[baitId] = {packItem, glyph, lure}. massa is infinite (no pack); lures are permanent.
  var BAITS = {
    massa: { packItem: null, glyph: 'o', lure: false },
    minhoca: { packItem: 'bait_minhoca', glyph: 's', lure: false },
    camarao: { packItem: 'bait_camarao', glyph: ',', lure: false },
    lula: { packItem: 'bait_lula', glyph: '~', lure: false },
    luminosa: { packItem: 'bait_luminosa', glyph: '*', lure: false },
    colher: { packItem: 'lure_colher', glyph: ')', lure: true },
    jig: { packItem: 'lure_jig', glyph: 'J', lure: true },
    papel: { packItem: 'bait_papel', glyph: '#', lure: false },
    perola: { packItem: 'bait_perola', glyph: '@', lure: false }
  };

  // ---------------------------------------------------------------- decor (§8.4)
  // attract is a fraction (+4% → .04). stars = minimum stars ever reached (progress.stars).
  var DECOR = {
    pedras: { tags: ['rocks'], attract: 0.02, price: { coins: 60, pearls: 0 }, stars: 1 },
    algas: { tags: ['plants'], attract: 0.02, price: { coins: 80, pearls: 0 }, stars: 1 },
    coral: { tags: ['coral'], attract: 0.04, price: { coins: 300, pearls: 0 }, stars: 2 },
    anemona: { tags: ['coral'], attract: 0.04, price: { coins: 450, pearls: 0 }, stars: 2 },
    kelp: { tags: ['plants'], attract: 0.04, price: { coins: 400, pearls: 0 }, stars: 2 },
    gruta: { tags: ['cave', 'rocks'], attract: 0.03, price: { coins: 500, pearls: 0 }, stars: 2 },
    castelo: { tags: ['cave'], attract: 0.06, price: { coins: 900, pearls: 0 }, stars: 3 },
    ostra: { tags: ['sand'], attract: 0.02, price: { coins: 1200, pearls: 0 }, stars: 3, pearls: true },
    bau: { tags: [], attract: 0.08, price: { coins: 1800, pearls: 0 }, stars: 3, bubbles: true },
    naufragio: { tags: ['cave', 'rocks'], attract: 0.10, price: { coins: 2500, pearls: 0 }, stars: 4 },
    ruina: { tags: ['rocks', 'cave'], attract: 0.08, price: { coins: 0, pearls: 15 }, stars: 4 },
    farol: { tags: [], attract: 0.12, price: { coins: 0, pearls: 30 }, stars: 4, lights: true }
  };

  // ---------------------------------------------------------------- shop items
  // Item = {id, cat, price:{coins,pearls} | tiers[] (tiered:true; index = tier you buy − first buyable), req, per, icon, ...}
  // req keys: zone (zone unlocked), stars (progress.stars ≥), message (message found), unlock (player.unlocks flag),
  //           species (boat: caught species of the previous zone, see AQ.items.BOAT_SPECIES).
  function c(n) { return { coins: n, pearls: 0 }; }
  function p(n) { return { coins: 0, pearls: n }; }

  var list = [];
  function add(it) {
    if (it.per === undefined) it.per = null;
    if (!it.req) it.req = {};
    if (!it.icon) it.icon = it.id;
    it.name = 'item.' + it.id + '.name';
    it.desc = 'item.' + it.id + '.desc';
    list.push(it);
    return it;
  }

  // Gear: one shop item per slot; buying gives the next tier. price[] lists the purchasable tiers in order.
  AQ.ENUM.GEAR.forEach(function (slot) {
    var buyable = GEAR[slot].filter(function (g) { return g.tier > GEAR_MIN[slot]; });
    add({
      id: slot, cat: 'gear', slot: slot, tiered: true,
      price: buyable.map(function (g) { return c(g.price); }),
      tierOf: buyable.map(function (g) { return g.tier; })
    });
  });

  // Species caught in the previous zone needed to buy each boat tier (= the zone requirement of §5.1).
  var BOAT_SPECIES = { 2: { zone: 'baia', n: 5 }, 3: { zone: 'recife', n: 5 }, 4: { zone: 'kelp', n: 5 }, 5: { zone: 'mar', n: 6 } };

  // Baits and lures.
  add({ id: 'bait_minhoca', cat: 'bait', bait: 'minhoca', qty: 10, price: c(10) });
  add({ id: 'bait_camarao', cat: 'bait', bait: 'camarao', qty: 10, price: c(30) });
  add({ id: 'bait_lula', cat: 'bait', bait: 'lula', qty: 10, price: c(80), req: { zone: 'recife' } });
  add({ id: 'bait_luminosa', cat: 'bait', bait: 'luminosa', qty: 5, price: c(150), req: { zone: 'mar' } });
  add({ id: 'lure_colher', cat: 'lure', bait: 'colher', qty: 1, price: c(250) });
  add({ id: 'lure_jig', cat: 'lure', bait: 'jig', qty: 1, price: c(1500), req: { zone: 'kelp' } });
  add({ id: 'bait_papel', cat: 'bait', bait: 'papel', qty: 3, price: p(5), req: { message: 'm3', unlock: 'papel' } });
  add({ id: 'bait_perola', cat: 'bait', bait: 'perola', qty: 1, price: p(20), req: { stars: 4, unlock: 'perola' } });

  // Aquarium items.
  add({ id: 'tank', cat: 'tank', tiered: true, price: [c(500), c(2500), c(8000)] });      // 2nd / 3rd / 4th tank
  add({ id: 'tankcap', cat: 'tank', tiered: true, per: 'tank', price: [c(250), c(1200), c(4500)] }); // cap 20/32/48
  add({ id: 'filter', cat: 'tank', tiered: true, per: 'tank', price: [c(300), c(2000)] });  // filter 28/56
  add({ id: 'feeder', cat: 'tank', per: 'tank', price: c(1200) });
  add({ id: 'cofre', cat: 'misc', tiered: true, price: [c(2000), c(8000)] });             // offline cap 4 h / 8 h

  // Decor: item id = decor id.
  AQ.ENUM.DECOR.forEach(function (id) {
    var d = DECOR[id];
    add({ id: id, cat: 'decor', decor: id, price: d.price, req: { stars: d.stars } });
  });

  var byId = Object.create(null);
  list.forEach(function (it) { byId[it.id] = it; });

  AQ.items = {
    list: list,
    get: function (id) { return byId[id] || null; },
    byCat: function (cat) { return list.filter(function (it) { return it.cat === cat; }); },
    GEAR: GEAR,
    GEAR_MIN: GEAR_MIN,
    BAITS: BAITS,
    DECOR: DECOR,
    BOAT_SPECIES: BOAT_SPECIES,
    COFRE_HOURS: [2, 4, 8],
    gearAt: gearAt,
    gearMax: gearMax
  };
})(window.AQ);
