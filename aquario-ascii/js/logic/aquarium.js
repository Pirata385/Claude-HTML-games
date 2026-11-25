// Água-Tinta — aquarium simulation: capacity, happiness, attraction, stars, food, breeding, growth, production,
// pearls, predation and the till (owner D, §7). Pure: mutates only the state object it is given.
(function (AQ) {
  'use strict';

  var E = AQ.ENUM, U = AQ.util;
  var K = {
    FOOD_DECAY_MIN: 45,       // food 1 → 0 in 45 real minutes (§7.3)
    OFFLINE_FOOD_FLOOR: 0.2,
    FEEDER_BELOW: 0.3,
    WARN_FOOD: 0.3,
    PREDATION_FOOD: 0.15,
    PREDATION_SEC: 300,
    BREED_EVERY: 480,         // s (8 real minutes, online only)
    BREED_CHANCE: 0.30,
    BREED_HAPPY: 70,
    BREED_DENSE_PARENT: 0.25,
    BREED_DENSE: 1 / 48,
    JUV_GROWTH: 0.2,
    GROWTH_PER_SEC: 1 / 1200, // +1/20 per minute
    PEARL_EVERY: 720,         // s (12 min)
    PEARL_HAPPY: 60,
    PRODUCE_HAPPY: 60,
    OPEN_MAX_DECOR: 2,        // 'open' tag while ≤ 2 slots are used
    SPECIES_BONUS: 0.04,
    STARS: E.STARS            // [0, 100, 600, 2500, 7000]
  };
  var LIGHTS = E.LIGHT, SIZES = E.SIZE;
  var LIGHT_F = [1, 0.85, 0.7];

  function species(id) { return (AQ.species && AQ.species.get) ? AQ.species.get(id) : null; }
  function sizeCost(sp) { var c = sp ? E.SIZE_COST[sp.size] : 1; return c === undefined ? 1 : c; }
  function sizeIdx(sp) { var i = sp ? SIZES.indexOf(sp.size) : 1; return i < 0 ? 1 : i; }
  function capOf(tank) { return E.TANK_CAP[U.clamp((tank.cap || 1) - 1, 0, E.TANK_CAP.length - 1)]; }
  function filterOf(tank) { return E.TANK_FILTER[U.clamp((tank.filter || 1) - 1, 0, E.TANK_FILTER.length - 1)]; }
  function decorDef(id) { return AQ.items && AQ.items.DECOR ? AQ.items.DECOR[id] : null; }
  function isAdult(f) { return !(typeof f.growth === 'number' && f.growth < 1); }

  function hasOyster(tank) {
    var d = tank && tank.decor;
    if (!d) return false;
    for (var i = 0; i < d.length; i++) if (d[i] === 'ostra') return true;
    return false;
  }

  // ---------------------------------------------------------------- per-tank context (reused, no allocation)
  // tags: bitmask over ENUM.HABITAT; topPred: largest size index among adult predators (−1 none).
  var HAB_BIT = {};
  E.HABITAT.forEach(function (h, i) { HAB_BIT[h] = 1 << i; });
  var ctxPool = {};
  function tankCtx(tank, state) {
    var c = ctxPool[tank.id] || (ctxPool[tank.id] = { used: 0, cap: 0, bioload: 0, filterCap: 0, tags: 0, topPred: -1, n: 0, distinct: 0, attract: 0, decorN: 0, seen: Object.create(null) });
    c.cap = capOf(tank); c.filterCap = filterOf(tank);
    c.used = 0; c.bioload = 0; c.topPred = -1; c.n = 0; c.distinct = 0; c.attract = 0; c.decorN = 0;
    var seen = c.seen, k;
    for (k in seen) seen[k] = 0;
    var tags = HAB_BIT.sand;
    var d = tank.decor || [];
    for (var i = 0; i < d.length; i++) {
      if (!d[i]) continue;
      c.decorN++;
      var dd = decorDef(d[i]);
      if (!dd) continue;
      c.attract += dd.attract || 0;
      for (var j = 0; j < dd.tags.length; j++) tags |= HAB_BIT[dd.tags[j]] || 0;
    }
    if (c.decorN <= K.OPEN_MAX_DECOR) tags |= HAB_BIT.open;
    c.tags = tags;
    var fish = state.aquarium.fish;
    for (i = 0; i < fish.length; i++) {
      var f = fish[i];
      if (f.tank !== tank.id) continue;
      var sp = species(f.sp), cost = sizeCost(sp);
      c.used += cost; c.bioload += cost; c.n++;
      if (!seen[f.sp]) { seen[f.sp] = 1; c.distinct++; }
      if (sp && sp.diet === 'predator' && isAdult(f)) c.topPred = Math.max(c.topPred, sizeIdx(sp));
    }
    return c;
  }

  // ---------------------------------------------------------------- capacity
  function tankUsage(tank, state) {
    if (!tank) return { used: 0, cap: 0, bioload: 0, filterCap: 0 };
    var c = tankCtx(tank, state);
    return { used: c.used, cap: c.cap, bioload: c.bioload, filterCap: c.filterCap };
  }
  function spOf(x) {
    if (!x) return null;
    if (typeof x === 'string') return species(x);
    if (x.sp) return species(x.sp);
    if (x.id && x.size) return x; // a Species object
    return null;
  }
  function keepable(sp) { return !!sp && sp.keep !== false && E.SIZE_COST[sp.size] !== Infinity && isFinite(sizeCost(sp)); }
  // canFit(speciesId | Specimen | Fish | Species, tank, state). A fish already in this tank always fits.
  function canFit(x, tank, state) {
    if (!tank) return false;
    var sp = spOf(x);
    if (!keepable(sp)) return false;
    if (x && x.uid && x.tank === tank.id) return true;
    var c = tankCtx(tank, state);
    return c.used + sizeCost(sp) <= c.cap;
  }
  // bestTankFor(specimen, state) → tankId | null: the fitting tank where the fish would be happiest, then most free.
  function bestTankFor(specimen, state) {
    var sp = spOf(specimen);
    if (!keepable(sp)) return null;
    var tanks = state.aquarium.tanks, best = null, bestScore = -1;
    for (var i = 0; i < tanks.length; i++) {
      var tk = tanks[i];
      if (!canFit(sp, tk, state)) continue;
      var c = tankCtx(tk, state);
      var score = habitatF(sp, c) * lightF(sp, tk) * (sizeIdx(sp) <= c.topPred - 2 && sp.diet !== 'predator' ? 0.6 : 1);
      score = score * 1000 + (c.cap - c.used - sizeCost(sp));
      if (score > bestScore) { bestScore = score; best = tk.id; }
    }
    return best;
  }

  // ---------------------------------------------------------------- happiness (§7.2)
  function habitatF(sp, c) {
    var h = sp && sp.habitat;
    if (!h || !h.length) return 1;
    for (var i = 0; i < h.length; i++) if (c.tags & (HAB_BIT[h[i]] || 0)) return 1;
    return 0.6;
  }
  function lightF(sp, tank) {
    var a = LIGHTS.indexOf(sp && sp.light), b = LIGHTS.indexOf(tank.light || 'day');
    if (a < 0 || b < 0) return 1;
    return LIGHT_F[Math.abs(a - b)];
  }
  function spaceF(c) {
    if (!(c.cap > 0)) return 1;
    var u = c.used / c.cap;
    return u <= 0.75 ? 1 : Math.max(0.3, 1 - 2 * (u - 0.75));
  }
  function qualityF(c) { return c.bioload <= 0 ? 1 : Math.pow(Math.min(1, c.filterCap / c.bioload), 0.7); }
  function foodF(tank) { return Math.pow(0.3 + 0.7 * U.clamp(tank.food, 0, 1), 0.6); }
  function stressed(sp, c) { return c.topPred >= 0 && c.topPred - sizeIdx(sp) >= 2; }

  // Happiness 0..100 using a prepared context (no allocation).
  function happyIn(fish, tank, c) {
    var sp = species(fish.sp);
    var v = foodF(tank) * spaceF(c) * habitatF(sp, c) * lightF(sp, tank) * (stressed(sp, c) ? 0.6 : 1) * qualityF(c);
    return Math.round(100 * v);
  }

  // fishHappiness(fish, tank, state) → {value, factors:{food, space, habitat, light, harmony, quality}}
  // Each factor is the multiplier actually applied (food = (0.3 + 0.7·food)^.6), so value = 100 · Π factors.
  function fishHappiness(fish, tank, state) {
    if (!fish || !tank) return { value: 0, factors: { food: 0, space: 0, habitat: 0, light: 0, harmony: 0, quality: 0 } };
    var c = tankCtx(tank, state), sp = species(fish.sp);
    var f = {
      food: foodF(tank), space: spaceF(c), habitat: habitatF(sp, c), light: lightF(sp, tank),
      harmony: stressed(sp, c) ? 0.6 : 1, quality: qualityF(c)
    };
    return { value: happyIn(fish, tank, c), factors: f };
  }

  function tankHappinessCtx(tank, state, c) {
    if (!c.n) return 100;
    var fish = state.aquarium.fish, sum = 0, n = 0;
    for (var i = 0; i < fish.length; i++) {
      if (fish[i].tank !== tank.id) continue;
      sum += happyIn(fish[i], tank, c); n++;
    }
    return n ? Math.round(sum / n) : 100;
  }
  function tankHappiness(tank, state) {
    if (!tank) return 100;
    return tankHappinessCtx(tank, state, tankCtx(tank, state));
  }

  // ---------------------------------------------------------------- attraction (§7.4)
  // appeal(f) = value^.75 · (0.8 + 0.5q) · (dense ? 3 : 1) · (bred ? .7 : 1) · happy/100 · juvenile factor
  function appealIn(fish, tank, c) {
    var sp = species(fish.sp);
    if (!sp || !(sp.value > 0)) return 0;
    var q = typeof fish.q === 'number' ? U.clamp(fish.q, 0, 1) : 0.5;
    var juv = AQ.economy ? AQ.economy.juvFactor(fish) : 1;
    return Math.pow(sp.value, 0.75) * (0.8 + 0.5 * q) * (fish.dense ? 3 : 1) * (fish.bred ? 0.7 : 1) *
      happyIn(fish, tank, c) / 100 * juv;
  }
  function appeal(fish, state) {
    var tank = findTank(state, fish && fish.tank);
    return tank ? appealIn(fish, tank, tankCtx(tank, state)) : 0;
  }
  function tankAttractionCtx(tank, state, c) {
    if (!c.n) return 0;
    var fish = state.aquarium.fish, sum = 0;
    for (var i = 0; i < fish.length; i++) if (fish[i].tank === tank.id) sum += appealIn(fish[i], tank, c);
    return sum * (1 + K.SPECIES_BONUS * c.distinct) * (1 + c.attract);
  }
  function tankAttraction(tank, state) {
    if (!tank) return 0;
    return tankAttractionCtx(tank, state, tankCtx(tank, state));
  }
  function attraction(state) {
    var tanks = state.aquarium.tanks, sum = 0;
    for (var i = 0; i < tanks.length; i++) sum += tankAttraction(tanks[i], state);
    return sum;
  }
  function starsFor(attr) {
    var s = 1;
    for (var i = 1; i < K.STARS.length; i++) if (attr >= K.STARS[i]) s = i + 1;
    return s;
  }
  // stars(state) → 1..5 from the current attraction. state.progress.stars keeps the best ever reached (unlocks).
  function stars(state) { return starsFor(attraction(state)); }
  function face(h) { return h >= 80 ? ':D' : h >= 60 ? ':)' : h >= 40 ? ':|' : ':('; }
  function visitors(state) { return Math.min(8, Math.floor(attraction(state) / 40)); }

  function findTank(state, id) {
    var tanks = state.aquarium.tanks;
    for (var i = 0; i < tanks.length; i++) if (tanks[i].id === id) return tanks[i];
    return null;
  }

  // ---------------------------------------------------------------- predation (§7.8)
  // → {pred: Fish, prey: Fish} | null. Prey: size ≤ predator − 2 classes, rarity C/U, never dense, never named.
  function predationPair(tank, state) {
    var fish = state.aquarium.fish, best = null, bestIdx = -1, i, j;
    for (i = 0; i < fish.length; i++) {
      var p = fish[i];
      if (p.tank !== tank.id || !isAdult(p)) continue;
      var ps = species(p.sp);
      if (!ps || ps.diet !== 'predator') continue;
      var pi = sizeIdx(ps);
      if (pi <= bestIdx) continue;
      for (j = 0; j < fish.length; j++) {
        var q = fish[j];
        if (q === p || q.tank !== tank.id || q.dense || q.name) continue;
        var qs = species(q.sp);
        if (!qs || (qs.rarity !== 'C' && qs.rarity !== 'U')) continue;
        if (sizeIdx(qs) > pi - 2) continue;
        if (!best || best.pred !== p) best = { pred: p, prey: q };
        else if (sizeIdx(qs) < sizeIdx(species(best.prey.sp))) best.prey = q;
      }
      if (best && best.pred === p) bestIdx = pi;
    }
    return best;
  }

  // ---------------------------------------------------------------- breeding helpers (§6.7, §7.6)
  function makeJuvenile(sp, a, b, tank, state, rng) {
    var lo = sp.len[0], hi = sp.len[1];
    var len = U.round1(U.clamp((a.len + b.len) / 2 * rng.normal(1, 0.08), lo, hi));
    var q = hi > lo ? U.clamp((len - lo) / (hi - lo), 0, 1) : 0.5;
    var dense = rng.chance(a.dense || b.dense ? K.BREED_DENSE_PARENT : K.BREED_DENSE);
    var aq = state.aquarium;
    var fish = {
      uid: 'f' + (aq.nextUid++), sp: sp.id, len: len, kg: U.round2(sp.kgMax * Math.pow(len / hi, 3)), q: U.round2(q),
      dense: dense, trophy: q >= 0.9, bred: true, growth: K.JUV_GROWTH, tank: tank.id, name: null,
      at: U.now(), zone: a.zone || (sp.zones && sp.zones[0]) || null
    };
    aq.fish.push(fish);
    return fish;
  }

  var adultsBuf = [];
  function breedTank(tank, state, rng, c, events) {
    var fish = state.aquarium.fish, done = Object.create(null);
    for (var i = 0; i < fish.length; i++) {
      var f = fish[i];
      if (f.tank !== tank.id || done[f.sp] || !isAdult(f)) continue;
      done[f.sp] = 1;
      var sp = species(f.sp);
      if (!sp || !sp.breeds || !keepable(sp)) continue;
      adultsBuf.length = 0;
      for (var j = 0; j < fish.length; j++) {
        if (fish[j].tank === tank.id && fish[j].sp === f.sp && isAdult(fish[j])) adultsBuf.push(fish[j]);
      }
      if (adultsBuf.length < 2) continue;
      if (c.cap - c.used < sizeCost(sp)) continue;
      if (!rng.chance(K.BREED_CHANCE)) continue;
      var ia = rng.int(adultsBuf.length), ib = rng.int(adultsBuf.length - 1);
      if (ib >= ia) ib++;
      var juv = makeJuvenile(sp, adultsBuf[ia], adultsBuf[ib], tank, state, rng);
      c.used += sizeCost(sp); c.bioload += sizeCost(sp);
      state.stats.bred = (state.stats.bred || 0) + 1;
      events.push({ type: 'bred', tankId: tank.id, uid: juv.uid, sp: sp.id, dense: juv.dense });
    }
    adultsBuf.length = 0;
  }

  function produceTank(tank, state, c, fromMin, toMin, events) {
    var fish = state.aquarium.fish;
    for (var m = fromMin + 1; m <= toMin; m++) {
      for (var i = 0; i < fish.length; i++) {
        var f = fish[i];
        if (f.tank !== tank.id || !isAdult(f)) continue;
        var sp = species(f.sp), pr = sp && sp.produces;
        if (!pr || !pr.item || !(pr.everyMin > 0) || m % pr.everyMin !== 0) continue;
        if (happyIn(f, tank, c) < (pr.minHappy || K.PRODUCE_HAPPY)) continue;
        var baits = state.player.baits;
        if (baits[pr.item] !== -1) baits[pr.item] = (baits[pr.item] || 0) + (pr.qty || 1);
        events.push({ type: 'produced', tankId: tank.id, item: pr.item, qty: pr.qty || 1, uid: f.uid });
      }
    }
  }

  // Auto-feeder: refills when food < .3, paying from coins; skips if coins are short (§7.3). → cost | 0
  function autoFeed(tank, state) {
    if (!tank.feeder || tank.food >= K.FEEDER_BELOW) return 0;
    var cost = AQ.economy ? AQ.economy.feedCost(tank, state, { auto: true }) : 3;
    if (state.player.coins < cost) return 0;
    state.player.coins -= cost;
    state.stats.coinsSpent = (state.stats.coinsSpent || 0) + cost;
    tank.food = 1;
    tank.foodLowSec = 0;
    return cost;
  }

  function accrueTill(state, coins) {
    var aq = state.aquarium;
    var total = (aq.tillCarry || 0) + coins;
    var whole = Math.floor(total);
    aq.till = (aq.till || 0) + whole;
    aq.tillCarry = total - whole;
    return whole;
  }

  // ---------------------------------------------------------------- tick
  // tick(state, dtSec, rng, opts:{offline:bool}) → events[]
  //   {type:'fed', tankId, auto:true, cost, n?} {type:'warning', tankId, kind:'predator'|'hungry', sp?, prey?}
  //   {type:'predation', tankId, predator, prey, uid} {type:'grown', uid, sp, tankId} {type:'bred', tankId, uid, sp}
  //   {type:'produced', tankId, item, qty} {type:'pearl', tankId, qty} {type:'till', till, add}
  function tick(state, dtSec, rng, opts) {
    var events = [];
    var dt = Math.max(0, Number(dtSec) || 0);
    if (!state || !state.aquarium || dt <= 0) return events;
    if (!rng) rng = AQ.rng.create('aq:' + (state.meta && state.meta.seed || 0) + ':' + (state.meta && state.meta.playSec || 0));
    if (opts && opts.offline) return offlineTick(state, dt, events);

    var tanks = state.aquarium.tanks, fish = state.aquarium.fish;
    var decay = dt / 60 / K.FOOD_DECAY_MIN, attr = 0, i, j;
    for (i = 0; i < tanks.length; i++) {
      var tk = tanks[i];
      var before = typeof tk.food === 'number' ? tk.food : 1;
      tk.food = Math.max(0, before - decay);
      var cost = autoFeed(tk, state);
      if (cost) events.push({ type: 'fed', tankId: tk.id, auto: true, cost: cost });
      var c = tankCtx(tk, state);

      // Warning when food crosses below .3 (and again below .15), never offline.
      if (c.n && ((before >= K.WARN_FOOD && tk.food < K.WARN_FOOD) || (before >= K.PREDATION_FOOD && tk.food < K.PREDATION_FOOD))) {
        var pair = predationPair(tk, state);
        events.push(pair
          ? { type: 'warning', tankId: tk.id, kind: 'predator', sp: pair.pred.sp, prey: pair.prey.sp }
          : { type: 'warning', tankId: tk.id, kind: 'hungry' });
      }
      // Predation after 5 continuous online minutes below .15.
      if (tk.food < K.PREDATION_FOOD && c.n) {
        tk.foodLowSec = (tk.foodLowSec || 0) + dt;
        if (tk.foodLowSec >= K.PREDATION_SEC) {
          var pp = predationPair(tk, state);
          tk.foodLowSec = 0;
          if (pp) {
            var idx = fish.indexOf(pp.prey);
            if (idx >= 0) fish.splice(idx, 1);
            events.push({ type: 'predation', tankId: tk.id, predator: pp.pred.sp, prey: pp.prey.sp, uid: pp.prey.uid, predUid: pp.pred.uid });
            c = tankCtx(tk, state);
          }
        }
      } else {
        tk.foodLowSec = 0;
      }

      // Growth.
      for (j = 0; j < fish.length; j++) {
        var f = fish[j];
        if (f.tank !== tk.id || isAdult(f)) continue;
        f.growth = Math.min(1, f.growth + dt * K.GROWTH_PER_SEC);
        if (f.growth >= 1) { f.growth = 1; events.push({ type: 'grown', uid: f.uid, sp: f.sp, tankId: tk.id }); c = tankCtx(tk, state); }
      }

      var happy = tankHappinessCtx(tk, state, c);

      // Breeding (every 8 min, online only).
      tk.breedSec = (tk.breedSec || 0) + dt;
      while (tk.breedSec >= K.BREED_EVERY) {
        tk.breedSec -= K.BREED_EVERY;
        if (happy >= K.BREED_HAPPY) breedTank(tk, state, rng, c, events);
      }

      // Production (shrimp → camarão bait), online only. produceSec counts seconds, wraps at one day.
      var p0 = tk.produceSec || 0, p1 = p0 + dt;
      produceTank(tk, state, c, Math.floor(p0 / 60), Math.floor(p1 / 60), events);
      tk.produceSec = p1 >= 86400 ? p1 - 86400 : p1;

      // Pearls (oyster at happiness ≥ 60).
      if (hasOyster(tk) && happy >= K.PEARL_HAPPY) {
        tk.pearlSec = (tk.pearlSec || 0) + dt;
        var n = 0;
        while (tk.pearlSec >= K.PEARL_EVERY) { tk.pearlSec -= K.PEARL_EVERY; n++; }
        if (n) { state.player.pearls += n; events.push({ type: 'pearl', tankId: tk.id, qty: n }); }
      }

      c = tankCtx(tk, state);
      attr += tankAttractionCtx(tk, state, c);
    }

    // Till.
    var add = AQ.economy.K.INCOME_K * attr * dt / 60;
    var whole = accrueTill(state, add);
    if (whole) events.push({ type: 'till', till: state.aquarium.till, add: whole });
    return events;
  }

  // Offline (§7.3, §7.4, §7.7): till and pearls at 50% within the cofre cap, using the rates at the start of the
  // absence; food decays to a .2 floor; the auto-feeder works within the cap; juveniles grow. Never breeding,
  // production, warnings or predation.
  function offlineTick(state, awaySec, events) {
    var earn = AQ.economy.offlineEarnings(state, awaySec * 1000);
    var cap = AQ.economy.cofreSec(state), eff = Math.min(awaySec, cap);
    var tanks = state.aquarium.tanks, fish = state.aquarium.fish, i;
    // pearls (happiness at the start)
    for (i = 0; i < tanks.length; i++) {
      var tk = tanks[i];
      if (hasOyster(tk) && tankHappiness(tk, state) >= K.PEARL_HAPPY) {
        tk.pearlSec = (tk.pearlSec || 0) + AQ.economy.K.OFFLINE_RATE * eff;
        var n = 0;
        while (tk.pearlSec >= K.PEARL_EVERY) { tk.pearlSec -= K.PEARL_EVERY; n++; }
        if (n) { state.player.pearls += n; events.push({ type: 'pearl', tankId: tk.id, qty: n }); }
      }
    }
    // till
    var whole = accrueTill(state, earn.raw);
    if (whole) events.push({ type: 'till', till: state.aquarium.till, add: whole });
    // food + feeder
    var perSec = 1 / 60 / K.FOOD_DECAY_MIN;
    for (i = 0; i < tanks.length; i++) {
      var t2 = tanks[i], food = typeof t2.food === 'number' ? t2.food : 1, rest = awaySec;
      if (t2.feeder) {
        var fedN = 0, fedCost = 0, step = 60;
        for (var s = 0; s < eff; s += step) {
          var d = Math.min(step, eff - s);
          food = Math.max(0, food - d * perSec);
          if (food < K.FEEDER_BELOW) {
            t2.food = food;
            var cst = autoFeed(t2, state);
            if (!cst) break;
            food = t2.food; fedN++; fedCost += cst;
          }
          rest -= d;
        }
        if (fedN) events.push({ type: 'fed', tankId: t2.id, auto: true, cost: fedCost, n: fedN });
        rest = Math.max(0, awaySec - (awaySec - rest));
      }
      if (food >= K.OFFLINE_FOOD_FLOOR) food = Math.max(K.OFFLINE_FOOD_FLOOR, food - rest * perSec);
      t2.food = food;
      t2.foodLowSec = 0;
    }
    // growth
    for (i = 0; i < fish.length; i++) {
      var f = fish[i];
      if (isAdult(f)) continue;
      f.growth = Math.min(1, f.growth + awaySec * K.GROWTH_PER_SEC);
      if (f.growth >= 1) events.push({ type: 'grown', uid: f.uid, sp: f.sp, tankId: f.tank });
    }
    return events;
  }

  AQ.aquarium = {
    K: K,
    tankUsage: tankUsage,
    canFit: canFit,
    bestTankFor: bestTankFor,
    fishHappiness: fishHappiness,
    tankHappiness: tankHappiness,
    tankAttraction: tankAttraction,
    attraction: attraction,
    stars: stars,
    starsFor: starsFor,
    face: face,
    tick: tick,
    // extras
    appeal: appeal,
    visitors: visitors,
    hasOyster: hasOyster,
    predationPair: predationPair,
    findTank: findTank,
    keepable: keepable,
    tankTags: function (tank, state) {
      var c = tankCtx(tank, state), out = [];
      E.HABITAT.forEach(function (h) { if (c.tags & HAB_BIT[h]) out.push(h); });
      return out;
    },
    capOf: capOf,
    filterOf: filterOf,
    sizeCost: function (spId) { return sizeCost(species(spId)); }
  };
})(window.AQ);
