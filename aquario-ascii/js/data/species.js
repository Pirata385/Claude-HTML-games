// Água-Tinta — species roster (42 catchable) and sightings (3) (owner B). Pure data (§6.1–6.5).
// Names and flavour lines live in js/data/strings-world.js (sp.<id>.name / sp.<id>.flavor).
(function (AQ) {
  'use strict';

  var TELL = { C: 0.7, U: 0.55, R: 0.45, L: 0.4 };
  var PH = { A: 'amanhecer', D: 'dia', E: 'entardecer', N: 'noite' };
  var WE = { li: 'limpo', nu: 'nublado', ch: 'chuva', te: 'tempestade' };

  function phases(s) {
    if (!s) return null;
    return s.split(',').map(function (k) { return PH[k]; });
  }
  function weathers(s) {
    if (!s) return null;
    return s.split(',').map(function (k) { return WE[k]; });
  }

  // Columns:
  //  0 id · 1 zone · 2 rarity · 3 size · 4 kind · 5 behaviour
  //  6 fight style · 7 P · 8 stamina s · 9 V u/s · 10 depth [d0,d1] · 11 time ('A,D' | null = any) · 12 weather
  //  13 baits {bait: affinity} · 14 wariness · 15 bite window s · 16 hookMin · 17 gear tier
  //  18 value $ · 19 len cm [min,max] · 20 kgMax · 21 habitat · 22 light · 23 diet · 24 glow · 25 breeds
  //  26 fight specials · 27 extras (merged into the species object)
  var T = [
    // ------------------------------------------------------------------ Baía Rasa
    ['manjuba', 'baia', 'C', 'XS', 'fish', 'school', 'shaker', 0.60, 5, 5, [0, 0.45], null, null,
      { massa: 1.2, minhoca: 1 }, 1, 0.9, 1, 1, 9, [6, 12], 0.02, ['open'], 'day', 'prey', 0, true, {}, null],
    ['tainha', 'baia', 'C', 'S', 'fish', 'school', 'jumper', 0.80, 8, 6, [0, 0.3], 'A,D', null,
      { massa: 1, minhoca: 1 }, 1, 0.9, 1, 1, 16, [30, 60], 3.5, ['sand', 'open'], 'day', 'grazer', 0, true, {}, null],
    ['siri', 'baia', 'C', 'S', 'crustacean', 'crawl', 'deadweight', 0.75, 6, 3, [0.88, 1], null, null,
      { massa: 0.8, minhoca: 1, lula: 1.2 }, 1, 0.9, 1, 1, 14, [8, 18], 0.45, ['sand', 'rocks'], 'night', 'grazer', 0, true, {},
      { timeMul: { noite: 2 } }],
    ['camarao', 'baia', 'C', 'XS', 'crustacean', 'hover', 'drifter', 0.40, 4, 4, [0.6, 1], 'A,E,N', null,
      { massa: 1 }, 1, 0.9, 1, 1, 9, [5, 15], 0.03, ['plants', 'sand'], 'dim', 'prey', 0, true, { tear: 0.6 },
      { produces: { item: 'camarao', qty: 2, everyMin: 10, minHappy: 60 } }],
    ['baiacu', 'baia', 'U', 'S', 'fish', 'dart', 'inflater', 1.00, 10, 5, [0.3, 0.8], null, null,
      { minhoca: 1, camarao: 1.5 }, 2, 0.75, 1, 1, 42, [15, 35], 1.2, ['rocks', 'plants'], 'day', 'prey', 0, true, { inflateAt: 0.7 }, null],
    ['arraia', 'baia', 'U', 'M', 'ray', 'burrow', 'puller', 1.05, 11, 5, [0.85, 1], 'D,E', null,
      { minhoca: 1, camarao: 1.3 }, 2, 0.75, 2, 2, 64, [40, 100], 20, ['sand'], 'dim', 'predator', 0, true, { grip: true }, null],
    ['agulha', 'baia', 'U', 'S', 'fish', 'dart', 'runner', 1.05, 9, 9, [0, 0.15], 'D', null,
      { colher: 1.5, camarao: 1 }, 2, 0.75, 1, 1, 50, [40, 90], 0.9, ['open'], 'day', 'predator', 0, true, {}, null],
    ['cavalo', 'baia', 'R', 'XS', 'fish', 'hover', 'drifter', 0.40, 5, 2, [0.5, 0.9], 'A', 'li,nu',
      { camarao: 1.5 }, 3, 0.6, 1, 1, 240, [8, 18], 0.02, ['plants'], 'dim', 'prey', 0, true, { tear: 0.5 }, null],
    ['ermitao', 'baia', 'R', 'S', 'odd', 'crawl', 'deadweight', 0.90, 9, 2, [0.95, 1], 'N', null,
      { massa: 1.5 }, 3, 0.6, 1, 1, 300, [6, 14], 0.25, ['sand', 'rocks'], 'night', 'grazer', 0, false, { grip: true },
      { nearKind: 'crustacean' }],
    ['tipografo', 'baia', 'L', 'M', 'odd', 'cruise', 'shaker', 1.9, 120, 9, [0.2, 0.6], 'A', null,
      { papel: 1 }, 3, 0.55, 2, 2, 1500, [20, 40], 1.0, ['open', 'plants'], 'dim', 'grazer', 0, false, { scramble: true },
      { nearKind: 'fish' }],
    // ------------------------------------------------------------------ Recife
    ['palhaco', 'recife', 'C', 'XS', 'fish', 'hover', 'shaker', 0.80, 6, 5, [0.45, 0.85], null, null,
      { massa: 1, camarao: 1.2 }, 1, 0.9, 1, 2, 28, [6, 11], 0.03, ['coral'], 'day', 'prey', 0, true, {}, null],
    ['cirurgiao', 'recife', 'C', 'S', 'fish', 'school', 'runner', 1.10, 10, 8, [0.2, 0.6], 'D', null,
      { minhoca: 1, camarao: 1.2 }, 1, 0.9, 1, 2, 34, [15, 35], 1.0, ['coral', 'rocks'], 'day', 'grazer', 0, true, {}, null],
    ['papagaio', 'recife', 'U', 'M', 'fish', 'cruise', 'puller', 1.30, 13, 6, [0.3, 0.9], 'A,D,E', null,
      { camarao: 1.2, lula: 1 }, 2, 0.75, 2, 2, 96, [30, 70], 6, ['coral'], 'day', 'grazer', 0, true, {}, null],
    ['moreia', 'recife', 'U', 'M', 'eel', 'lurk', 'burrower', 1.45, 14, 7, [0.7, 1], 'E,N', null,
      { lula: 1.5, camarao: 0.8 }, 2, 0.75, 2, 2, 120, [60, 150], 12, ['rocks', 'cave'], 'night', 'predator', 0, true, {}, null],
    ['lagosta', 'recife', 'U', 'M', 'crustacean', 'crawl', 'deadweight', 1.30, 13, 3, [0.85, 1], 'N', null,
      { lula: 1.3, minhoca: 0.8 }, 2, 0.75, 2, 2, 140, [20, 45], 3.5, ['rocks', 'cave'], 'night', 'grazer', 0, true, { grip: true }, null],
    ['leao', 'recife', 'R', 'S', 'fish', 'hover', 'shaker', 1.45, 15, 4, [0.4, 0.9], null, null,
      { camarao: 1.3, lula: 1 }, 3, 0.6, 1, 2, 360, [20, 38], 1.3, ['coral', 'rocks'], 'dim', 'predator', 0, true, {}, null],
    ['polvo', 'recife', 'R', 'M', 'cephalopod', 'crawl', 'inker', 1.60, 18, 8, [0.8, 1], 'E,N', null,
      { lula: 1.5, camarao: 1 }, 3, 0.6, 2, 2, 420, [40, 110], 10, ['rocks', 'cave'], 'night', 'predator', 0, false,
      { grip: true, inkChance: 0.4 }, null],
    // ------------------------------------------------------------------ Floresta de Kelp
    ['sargo', 'kelp', 'C', 'S', 'fish', 'school', 'puller', 1.15, 8, 6, [0.2, 0.7], null, null,
      { minhoca: 1, camarao: 1.2 }, 1, 0.9, 1, 3, 55, [20, 40], 1.5, ['rocks', 'plants'], 'day', 'grazer', 0, true, {}, null],
    ['cavalinha', 'kelp', 'C', 'S', 'fish', 'school', 'runner', 1.25, 8, 10, [0, 0.5], 'A,D', null,
      { colher: 1.5, minhoca: 1 }, 1, 0.9, 1, 3, 50, [25, 45], 1.0, ['open'], 'day', 'predator', 0, true, {}, null],
    ['lula', 'kelp', 'U', 'S', 'cephalopod', 'dart', 'inker', 1.55, 12, 10, [0.2, 0.6], 'E,N', null,
      { jig: 1.5, luminosa: 1.3 }, 2, 0.75, 1, 3, 150, [20, 50], 1.5, ['open'], 'night', 'predator', 0, true, { inkChance: 0.5 }, null],
    ['escorpiao', 'kelp', 'U', 'S', 'fish', 'lurk', 'burrower', 1.55, 12, 6, [0.75, 1], null, null,
      { camarao: 1.3, lula: 1 }, 2, 0.75, 1, 3, 170, [15, 40], 1.8, ['rocks'], 'dim', 'predator', 0, true, {},
      { camo: { level: 3, dist: 8 } }],
    ['congro', 'kelp', 'U', 'M', 'eel', 'lurk', 'diver', 1.70, 15, 8, [0.7, 1], 'N', null,
      { lula: 1.5 }, 2, 0.75, 2, 3, 210, [60, 160], 15, ['rocks', 'cave', 'plants'], 'night', 'predator', 0, true, {}, null],
    ['garoupa', 'kelp', 'R', 'L', 'fish', 'lurk', 'burrower', 2.00, 24, 8, [0.6, 1], 'E,N', null,
      { lula: 1.5 }, 3, 0.6, 3, 3, 800, [50, 120], 30, ['cave', 'rocks'], 'dim', 'predator', 0, true, {}, null],
    ['aranha', 'kelp', 'R', 'M', 'crustacean', 'crawl', 'deadweight', 1.80, 18, 2, [0.9, 1], 'N', null,
      { lula: 1.2, massa: 1 }, 3, 0.6, 2, 3, 600, [20, 40], 4, ['rocks', 'plants'], 'night', 'grazer', 0, true, { grip: true }, null],
    // ------------------------------------------------------------------ Mar Aberto
    ['aguaviva', 'mar', 'C', 'S', 'jelly', 'drift', 'drifter', 0.55, 6, 2, [0, 0.6], null, null,
      { massa: 1, luminosa: 1.3 }, 1, 0.9, 1, 4, 70, [10, 40], 0.5, ['open'], 'dim', 'filter', 1, true, { tear: 0.5 },
      { glowAt: 'noite' }],
    ['voador', 'mar', 'U', 'S', 'fish', 'leap', 'jumper', 1.40, 10, 11, [0, 0.15], 'D', null,
      { massa: 1, minhoca: 1 }, 2, 0.75, 1, 4, 110, [20, 35], 0.4, ['open'], 'day', 'grazer', 0, true, {}, null],
    ['dourado', 'mar', 'U', 'L', 'fish', 'cruise', 'jumper', 2.00, 22, 11, [0, 0.3], 'D', null,
      { colher: 1.5, lula: 1.2 }, 2, 0.75, 3, 4, 320, [60, 150], 25, ['open'], 'day', 'predator', 0, true, {}, null],
    ['atum', 'mar', 'U', 'L', 'fish', 'school', 'runner', 2.30, 22, 13, [0.2, 0.7], 'A,D', null,
      { lula: 1.3, colher: 1.2 }, 2, 0.75, 3, 4, 420, [80, 200], 120, ['open'], 'day', 'predator', 0, true, {}, null],
    ['caravela', 'mar', 'R', 'S', 'jelly', 'drift', 'drifter', 0.60, 6, 2, [0, 0.06], null, 'ch,te',
      { luminosa: 1.5 }, 3, 0.6, 1, 4, 520, [20, 30], 0.6, ['open'], 'day', 'predator', 0, false, { tear: 0.35 },
      { floats: true }],
    ['lua', 'mar', 'R', 'L', 'fish', 'drift', 'deadweight', 2.20, 26, 3, [0, 0.3], 'D', 'li',
      { lula: 1, luminosa: 0.8 }, 3, 0.6, 3, 4, 900, [100, 250], 1000, ['open'], 'day', 'filter', 0, true, {}, null],
    ['manta', 'mar', 'R', 'XL', 'ray', 'drift', 'puller', 2.40, 28, 7, [0.1, 0.5], 'D', 'li,nu',
      { massa: 1.5 }, 3, 0.6, 4, 4, 1500, [300, 600], 1400, ['open'], 'day', 'filter', 0, true, {}, null],
    ['martelo', 'mar', 'R', 'L', 'shark', 'cruise', 'runner', 2.50, 28, 12, [0.3, 0.9], 'E,N', null,
      { lula: 1.5 }, 3, 0.6, 3, 4, 1350, [150, 350], 230, ['open'], 'dim', 'predator', 0, true, {}, null],
    ['marlim', 'mar', 'L', 'XL', 'fish', 'cruise', 'boss', 2.90, 70, 15, [0.1, 0.5], 'E', 'li',
      { colher: 1.5, lula: 1 }, 3, 0.55, 4, 5, 4500, [200, 450], 600, ['open'], 'day', 'predator', 0, false, {}, null],
    // ------------------------------------------------------------------ Abismo
    ['machado', 'abismo', 'C', 'XS', 'fish', 'school', 'shaker', 1.40, 7, 6, [0, 0.45], null, null,
      { massa: 1, luminosa: 1.3 }, 1, 0.9, 1, 5, 110, [3, 8], 0.02, ['open'], 'night', 'prey', 1, true, {}, null],
    ['vibora', 'abismo', 'U', 'S', 'fish', 'lurk', 'runner', 2.40, 14, 11, [0.2, 0.7], null, null,
      { luminosa: 1.5 }, 2, 0.75, 1, 5, 360, [20, 35], 0.4, ['open'], 'night', 'predator', 1, true, {}, null],
    ['isopode', 'abismo', 'U', 'M', 'crustacean', 'crawl', 'deadweight', 2.30, 16, 2, [0.95, 1], null, null,
      { lula: 1.3, massa: 1 }, 2, 0.75, 2, 5, 560, [20, 45], 1.7, ['sand', 'rocks'], 'night', 'grazer', 0, true, { roll: true }, null],
    ['diabo', 'abismo', 'R', 'S', 'fish', 'lurk', 'puller', 2.60, 18, 4, [0.6, 1], null, null,
      { luminosa: 1.6 }, 3, 0.6, 1, 5, 880, [15, 60], 10, ['open', 'rocks'], 'night', 'predator', 1, true, {},
      { lureLight: true }],
    ['vampira', 'abismo', 'R', 'S', 'cephalopod', 'drift', 'inker', 2.50, 16, 7, [0.4, 0.9], null, null,
      { luminosa: 1.5 }, 3, 0.6, 1, 5, 1050, [15, 30], 0.5, ['open'], 'night', 'filter', 1, true, { inkChance: 0.5, glowInk: true }, null],
    ['atolla', 'abismo', 'R', 'M', 'jelly', 'drift', 'drifter', 0.70, 9, 2, [0.3, 0.8], null, null,
      { luminosa: 1.5 }, 3, 0.6, 2, 5, 1300, [10, 20], 0.4, ['open'], 'night', 'filter', 1, true, { tear: 0.45, alarm: true }, null],
    ['pelicano', 'abismo', 'R', 'L', 'eel', 'drift', 'diver', 2.60, 20, 9, [0.5, 1], null, null,
      { lula: 1.4 }, 3, 0.6, 3, 5, 1250, [50, 100], 3, ['open'], 'night', 'predator', 1, true, {}, null],
    ['celacanto', 'abismo', 'L', 'L', 'fish', 'hover', 'boss', 3.10, 45, 7, [0.85, 1], 'N', null,
      { jig: 1.5 }, 3, 0.55, 3, 5, 6000, [120, 200], 90, ['cave', 'rocks'], 'night', 'predator', 0, false, {}, null],
    ['tinteira', 'abismo', 'L', 'XXL', 'cephalopod', 'ambient', 'boss', 3.40, 60, 12, [0.9, 1], 'N', 'te',
      { perola: 1 }, 0, 0.55, 4, 5, 0, [1200, 1800], 900, [], 'night', 'predator', 0, false, {},
      { keep: false, boss: true }]
  ];

  var list = [];
  var byId = Object.create(null);

  T.forEach(function (r) {
    var sp = {
      id: r[0],
      zones: [r[1]],
      rarity: r[2],
      size: r[3],
      kind: r[4],
      behavior: r[5],
      fight: { style: r[6], power: r[7], stamina: r[8], speed: r[9], tell: TELL[r[2]], special: r[26] },
      depth: r[10],
      time: phases(r[11]),
      weather: weathers(r[12]),
      baits: r[13],
      wariness: r[14],
      biteWindow: r[15],
      hookMin: r[16],
      gearTier: r[17],
      value: r[18],
      len: r[19],
      kgMax: r[20],
      habitat: r[21],
      light: r[22],
      diet: r[23],
      glow: r[24],
      breeds: r[25],
      produces: null,
      keep: true,
      timeMul: null,       // {phase: multiplier} on the spawn weight (siri ×2 at night)
      nearKind: null,      // 'odd' species: nearest kind for tank rules
      sprite: r[0]
    };
    var ex = r[27];
    if (ex) for (var k in ex) if (Object.prototype.hasOwnProperty.call(ex, k)) sp[k] = ex[k];
    if (!sp.nearKind) sp.nearKind = sp.kind;
    list.push(sp);
    byId[sp.id] = sp;
  });

  var zoneCache = Object.create(null);

  AQ.species = {
    list: list,
    TELL: TELL,
    get: function (id) { return byId[id] || null; },
    // inZone(zoneId) → Species[] (cached array; do not mutate)
    inZone: function (zoneId) {
      var c = zoneCache[zoneId];
      if (!c) {
        c = zoneCache[zoneId] = list.filter(function (s) { return s.zones.indexOf(zoneId) >= 0; });
      }
      return c;
    },
    ids: function () { return list.map(function (s) { return s.id; }); },
    // Size class index (XS 0 … XXL 5).
    sizeIndex: function (spOrSize) {
      var s = typeof spOrSize === 'string' ? spOrSize : spOrSize && spOrSize.size;
      return AQ.ENUM.SIZE.indexOf(s);
    },
    // Name helpers (strings live in strings-world.js).
    name: function (id) { return AQ.i18n.t('sp.' + id + '.name'); },
    flavor: function (id) { return AQ.i18n.t('sp.' + id + '.flavor'); }
  };

  // ------------------------------------------------------------------ sightings (§6.5)
  var sightings = [
    { id: 'baleia', zones: ['mar'], time: ['dia', 'entardecer'], weather: ['limpo', 'nublado'], chancePerMin: 0.03,
      sprite: 'baleia', size: 'XXL', depth: [0.3, 0.5], count: 1, speed: 2.2, path: 'pass' },
    { id: 'golfinhos', zones: ['baia', 'mar'], time: ['dia'], weather: null, chancePerMin: 0.04,
      sprite: 'golfinhos', size: 'M', depth: [0, 0.12], count: 3, speed: 9, path: 'leap' },
    { id: 'tartaruga', zones: ['recife'], time: null, weather: null, chancePerMin: 0.04,
      sprite: 'tartaruga', size: 'M', depth: [0.3, 0.7], count: 1, speed: 2.5, path: 'pass' }
  ];
  var sightById = Object.create(null);
  sightings.forEach(function (s) { sightById[s.id] = s; });

  AQ.sightings = {
    list: sightings,
    get: function (id) { return sightById[id] || null; },
    inZone: function (zoneId) { return sightings.filter(function (s) { return s.zones.indexOf(zoneId) >= 0; }); },
    name: function (id) { return AQ.i18n.t('sighting.' + id + '.name'); },
    flavor: function (id) { return AQ.i18n.t('sighting.' + id + '.flavor'); }
  };
})(window.AQ);
