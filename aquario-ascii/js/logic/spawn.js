// Água-Tinta — spawn tables, legendary readiness and the specimen roll (owner B). Pure (§5.5, §6.7).
// ctx = {phase, weather, bait, luck=0, lantern=0, frenzy=false, zone?}
(function (AQ) {
  'use strict';

  var U = AQ.util;
  var RANK = { C: 0, U: 1, R: 2, L: 3 };

  function timeOK(sp, ctx) { return !sp.time || !ctx || !ctx.phase || sp.time.indexOf(ctx.phase) >= 0; }
  function weatherOK(sp, ctx) { return !sp.weather || !ctx || !ctx.weather || sp.weather.indexOf(ctx.weather) >= 0; }
  function affinity(sp, bait) { return (bait && sp.baits[bait]) || 0; }
  function asSpecies(s) { return typeof s === 'string' ? AQ.species.get(s) : s; }

  // conditionsMet(species, ctx): time and weather match; legendaries also need a bait they take.
  function conditionsMet(species, ctx) {
    var sp = asSpecies(species);
    if (!sp) return false;
    var c = ctx || {};
    if (!timeOK(sp, c) || !weatherOK(sp, c)) return false;
    if (sp.rarity === 'L') return affinity(sp, c.bait) > 0;
    return true;
  }

  function surface(sp) { return sp.depth[0] < 0.05; }

  // weatherMul: limpo ×1.2 day-light species; chuva ×1.3 predators and surface species; tempestade ×1.5 rares.
  function weatherMul(sp, w) {
    if (w === 'limpo') return sp.light === 'day' ? 1.2 : 1;
    if (w === 'chuva') return sp.diet === 'predator' || surface(sp) ? 1.3 : 1;
    if (w === 'tempestade') return sp.rarity === 'R' ? 1.5 : 1;
    return 1;
  }

  // weightOf(species, ctx) → number (0 = cannot spawn through pick(); legendaries are always 0 here).
  function weightOf(species, ctx) {
    var sp = asSpecies(species);
    if (!sp) return 0;
    var c = ctx || {};
    var base = AQ.ENUM.RARITY_W[sp.rarity] || 0;
    if (!base || !timeOK(sp, c) || !weatherOK(sp, c)) return 0;
    var w = base * weatherMul(sp, c.weather) * (1 + 0.5 * affinity(sp, c.bait));
    if (RANK[sp.rarity] >= RANK.R) w *= 1 + (c.luck || 0);
    if (sp.timeMul && c.phase && sp.timeMul[c.phase]) w *= sp.timeMul[c.phase];
    return w;
  }

  // table(zoneId, ctx) → [{id, w}] with w > 0
  function table(zoneId, ctx) {
    var list = AQ.species.inZone(zoneId), out = [];
    for (var i = 0; i < list.length; i++) {
      var w = weightOf(list[i], ctx);
      if (w > 0) out.push({ id: list[i].id, w: w });
    }
    return out;
  }

  // pick(zoneId, ctx, rng) → id | null (weighted; no allocation)
  function pick(zoneId, ctx, rng) {
    var list = AQ.species.inZone(zoneId), total = 0, i;
    for (i = 0; i < list.length; i++) total += weightOf(list[i], ctx);
    if (!(total > 0)) return null;
    var r = (rng || AQ.rng.global).next() * total;
    for (i = 0; i < list.length; i++) {
      var w = weightOf(list[i], ctx);
      if (w > 0) { r -= w; if (r < 0) return list[i].id; }
    }
    for (i = list.length - 1; i >= 0; i--) if (weightOf(list[i], ctx) > 0) return list[i].id;
    return null;
  }

  // legendaryReady(zoneId, ctx) → id | null: a legendary of this zone whose time, weather and bait all match.
  function legendaryReady(zoneId, ctx) {
    var list = AQ.species.inZone(zoneId);
    for (var i = 0; i < list.length; i++) {
      var sp = list[i];
      if (sp.rarity === 'L' && conditionsMet(sp, ctx)) return sp.id;
    }
    return null;
  }

  // schoolSize(species, rng) → int: school behaviour 4–8 (3–5 for M and larger), otherwise 1.
  function schoolSize(species, rng) {
    var sp = asSpecies(species);
    if (!sp || sp.behavior !== 'school') return 1;
    var r = rng || AQ.rng.global;
    if (AQ.species.sizeIndex(sp) >= 2) return r.irange(3, 5);
    // QA: wide sprites (≥ 10 cols: mullet, surgeon, sargo, mackerel) piled into unreadable blobs at 4–8
    var sd = AQ.sprites && AQ.sprites.get ? AQ.sprites.get(sp.id) : null;
    var f = sd && sd.frames && sd.frames[0];
    var w = f && f.lines ? f.w : (f && f[0] ? f[0].length : 0);
    return w >= 10 ? r.irange(3, 4) : r.irange(4, 8);
  }

  // kg rounding: 3 significant digits below 1 kg (so tiny fish never read 0), 2 decimals above.
  function roundKg(x) {
    if (!(x > 0)) return 0;
    if (x >= 1) return U.round2(x);
    var p = Math.pow(10, 2 - Math.floor(Math.log10 ? Math.log10(x) : Math.log(x) / Math.LN10));
    return Math.round(x * p) / p;
  }
  function kgFor(sp, len) { return roundKg(sp.kgMax * Math.pow(len / sp.len[1], 3)); }

  // rollSpecimen(id, ctx, rng) → Specimen {sp, len, kg, q, dense, trophy, zone, at}
  function rollSpecimen(id, ctx, rng) {
    var sp = asSpecies(id);
    if (!sp) return null;
    var c = ctx || {}, r = rng || AQ.rng.global;
    var qExp = c.bait === 'lula' ? 1.2 : 1.6;
    var q = Math.pow(r.next(), qExp);
    var len = U.round1(sp.len[0] + q * (sp.len[1] - sp.len[0]));
    var dense = r.chance((1 / 64) * (1 + 2 * (c.luck || 0)));
    return {
      sp: sp.id,
      len: len,
      kg: kgFor(sp, len),
      q: q,
      dense: dense,
      trophy: q >= 0.9,
      zone: c.zone || sp.zones[0],
      at: U.now()
    };
  }

  // bredSpecimen(id, parentA, parentB, rng) → Specimen-like {sp, len, kg, q, dense:false, trophy:false, zone:null, at}
  // len = clamp(avg(parents.len)·normal(1, .08), lenMin, lenMax). D decides dense (25% / 1/48) and sets bred.
  function bredSpecimen(id, a, b, rng) {
    var sp = asSpecies(id);
    if (!sp) return null;
    var r = rng || AQ.rng.global;
    var avg = ((a && a.len) || sp.len[0]) * 0.5 + ((b && b.len) || sp.len[0]) * 0.5;
    var len = U.round1(U.clamp(avg * r.normal(1, 0.08), sp.len[0], sp.len[1]));
    var q = U.clamp((len - sp.len[0]) / (sp.len[1] - sp.len[0]), 0, 1);
    return { sp: sp.id, len: len, kg: kgFor(sp, len), q: q, dense: false, trophy: false, zone: null, at: U.now() };
  }

  AQ.spawn = {
    RANK: RANK,
    conditionsMet: conditionsMet,
    weightOf: weightOf,
    weatherMul: weatherMul,
    table: table,
    pick: pick,
    legendaryReady: legendaryReady,
    schoolSize: schoolSize,
    rollSpecimen: rollSpecimen,
    bredSpecimen: bredSpecimen,
    kgFor: kgFor,
    roundKg: roundKg
  };
})(window.AQ);
