// Água-Tinta — economy: gear stats, values, prices, requirements, income, offline earnings, feed cost (owner D).
// Pure: no DOM; reads AQ.items / AQ.species / AQ.aquarium at call time.
(function (AQ) {
  'use strict';

  var K = {
    INCOME_K: 0.06,          // incomePerMinute = INCOME_K · attraction (§7.4)
    OFFLINE_RATE: 0.5,       // offline till and pearls run at 50% (§7.4, §7.7)
    BRED_SELL: 0.6,          // bred fish sell × .6 (§7.6)
    JUV_MIN: 0.4             // juveniles sell / appeal × (JUV_MIN + (1 − JUV_MIN)·growth)   (D addition, tunable)
  };

  function items() { return AQ.items; }
  function species(id) { return (AQ.species && AQ.species.get) ? AQ.species.get(id) : null; }
  function t(key, vars) { return AQ.i18n ? AQ.i18n.t(key, vars) : key; }

  // ---------------------------------------------------------------- gear
  // gear(state) → {cast, window, St, Ls, maxLen, snapGrace, reelSpeed, riseRate, hookClass, H, lantern (radius u),
  //                lanternTier, boat, tiers:{rod,line,reel,hook,lantern,boat}}
  function gear(state) {
    var g = (state && state.player && state.player.gear) || {};
    var I = items();
    function at(slot) {
      var tier = typeof g[slot] === 'number' ? g[slot] : I.GEAR_MIN[slot];
      return I.gearAt(slot, tier) || I.GEAR[slot][0];
    }
    var rod = at('rod').stats, line = at('line').stats, reel = at('reel').stats, hook = at('hook').stats;
    var lan = at('lantern'), boat = at('boat');
    return {
      cast: rod.cast, window: rod.window, St: rod.St,
      Ls: line.Ls, maxLen: line.maxLen, snapGrace: line.snapGrace,
      reelSpeed: reel.reelSpeed, riseRate: reel.riseRate,
      hookClass: hook.hookClass, H: hook.H,
      lantern: lan.stats.radius, lanternTier: lan.tier,
      boat: boat.tier,
      tiers: { rod: at('rod').tier, line: at('line').tier, reel: at('reel').tier, hook: at('hook').tier, lantern: lan.tier, boat: boat.tier }
    };
  }

  // ---------------------------------------------------------------- values (§8.5)
  // specimenValue(specimen) = round(value · (0.7 + 0.6q) · (dense ? 4 : 1) · (trophy ? 1.25 : 1) · (bred ? .6 : 1))
  function rawValue(o) {
    var sp = species(o && o.sp);
    if (!sp || !(sp.value > 0)) return 0;
    var q = typeof o.q === 'number' && isFinite(o.q) ? AQ.util.clamp(o.q, 0, 1) : 0.5;
    return sp.value * (0.7 + 0.6 * q) * (o.dense ? 4 : 1) * (o.trophy ? 1.25 : 1) * (o.bred ? K.BRED_SELL : 1);
  }
  function specimenValue(specimen) { return Math.round(rawValue(specimen)); }
  function juvFactor(fish) {
    var g = fish && typeof fish.growth === 'number' ? fish.growth : 1;
    return g >= 1 ? 1 : K.JUV_MIN + (1 - K.JUV_MIN) * Math.max(0, g);
  }
  // Fish in a tank: as specimenValue (bred × .6) and juveniles scaled by growth.
  function fishSellValue(fish) { return Math.round(rawValue(fish) * juvFactor(fish)); }

  // ---------------------------------------------------------------- shop
  function findTank(state, id) {
    var tanks = state.aquarium.tanks;
    for (var i = 0; i < tanks.length; i++) if (tanks[i].id === id) return tanks[i];
    return null;
  }
  function perTankMaxed(item, tank) {
    if (!tank) return true;
    if (item.id === 'tankcap') return tank.cap >= AQ.ENUM.TANK_CAP.length;
    if (item.id === 'filter') return tank.filter >= AQ.ENUM.TANK_FILTER.length;
    if (item.id === 'feeder') return !!tank.feeder;
    return false;
  }
  // Target tank of a per-tank item: opts.tankId, else the first tank where the item is not maxed, else t1.
  function targetTank(item, state, opts) {
    if (opts && opts.tankId) return findTank(state, opts.tankId);
    var tanks = state.aquarium.tanks;
    for (var i = 0; i < tanks.length; i++) if (!perTankMaxed(item, tanks[i])) return tanks[i];
    return tanks[0] || null;
  }
  function priceObj(pr) { return { coins: pr.coins || 0, pearls: pr.pearls || 0 }; }

  // priceOf(itemId, state, opts?{tankId}) → {coins, pearls} | null (null = maxed, unknown or unavailable)
  function priceOf(itemId, state, opts) {
    var I = items(), it = I.get(itemId);
    if (!it || !state) return null;
    var p = state.player;
    switch (it.cat) {
      case 'gear': {
        var cur = typeof p.gear[it.slot] === 'number' ? p.gear[it.slot] : I.GEAR_MIN[it.slot];
        var next = I.gearAt(it.slot, cur + 1);
        return next ? { coins: next.price, pearls: 0 } : null;
      }
      case 'lure':
        return p.lures && p.lures[it.bait] ? null : priceObj(it.price);
      case 'bait':
      case 'decor':
        return priceObj(it.price);
      case 'tank': {
        if (it.id === 'tank') {
          var n = state.aquarium.tanks.length;
          return n >= AQ.ENUM.MAX_TANKS ? null : priceObj(it.price[n - 1]);
        }
        var tank = targetTank(it, state, opts);
        if (!tank || perTankMaxed(it, tank)) return null;
        if (it.id === 'tankcap') return priceObj(it.price[tank.cap - 1]);
        if (it.id === 'filter') return priceObj(it.price[tank.filter - 1]);
        return priceObj(it.price);
      }
      case 'misc':
        if (it.id === 'cofre') return p.cofre >= I.COFRE_HOURS.length ? null : priceObj(it.price[p.cofre - 1]);
        return priceObj(it.price);
    }
    return null;
  }

  function zoneName(id) {
    if (!AQ.i18n) return id;
    if (AQ.i18n.has('zone.' + id + '.name')) return t('zone.' + id + '.name');
    if (AQ.i18n.has('zone.' + id)) return t('zone.' + id);
    return id;
  }
  function gearName(slot, tier) { return t('item.' + slot + '.' + tier); }

  // Species caught (caught > 0) whose zones include zoneId.
  function caughtInZone(state, zoneId) {
    var n = 0, b = state.bestiary || {};
    for (var id in b) {
      if (!b[id] || !(b[id].caught > 0)) continue;
      var sp = species(id);
      if (sp && sp.zones && sp.zones.indexOf(zoneId) >= 0) n++;
    }
    return n;
  }

  // requirementsMet(itemId, state, opts?) → {ok, missing:[{key, vars}]}   keys are i18n keys (item.req.*)
  function requirementsMet(itemId, state, opts) {
    var I = items(), it = I.get(itemId), missing = [];
    if (!it || !state) return { ok: false, missing: [{ key: 'item.req.unknown', vars: { id: String(itemId) } }] };
    var r = it.req || {}, pr = state.progress, p = state.player;
    if (r.zone && pr.zones.indexOf(r.zone) < 0) missing.push({ key: 'item.req.zone', vars: { zone: zoneName(r.zone), id: r.zone } });
    var unlocked = !!(r.unlock && p.unlocks && p.unlocks[r.unlock]); // an unlock flag satisfies stars/message reqs
    if (r.stars && (pr.stars || 1) < r.stars && !unlocked) {
      missing.push({ key: 'item.req.stars', vars: { n: r.stars, stars: '*'.repeat(r.stars) } });
    }
    if (r.message && !(state.messages && state.messages[r.message]) && !unlocked) {
      missing.push({ key: 'item.req.message', vars: { id: r.message, title: t('msg.' + r.message + '.title') } });
    }
    if (it.cat === 'gear' && it.slot === 'boat') {
      var next = (p.gear.boat || 1) + 1, need = I.BOAT_SPECIES[next];
      if (need) {
        var have = caughtInZone(state, need.zone);
        if (have < need.n) missing.push({ key: 'item.req.species', vars: { n: need.n, have: have, zone: zoneName(need.zone), id: need.zone } });
      }
    }
    if (it.per === 'tank') {
      var tank = targetTank(it, state, opts);
      if (!tank) missing.push({ key: 'item.req.tank', vars: { id: String(opts && opts.tankId) } });
    }
    return { ok: missing.length === 0, missing: missing };
  }

  function canAfford(price, state) {
    if (!price || !state) return false;
    return state.player.coins >= (price.coins || 0) && state.player.pearls >= (price.pearls || 0);
  }

  // ---------------------------------------------------------------- income (§7.4)
  function incomePerMinute(state) {
    return K.INCOME_K * (AQ.aquarium ? AQ.aquarium.attraction(state) : 0);
  }
  function cofreSec(state) {
    var h = items().COFRE_HOURS, i = AQ.util.clamp((state.player.cofre || 1) - 1, 0, h.length - 1);
    return h[i] * 3600;
  }

  // offlineEarnings(state, awayMs) → {coins, pearls, capped, effSec}
  // coins = whole coins added to the till: floor(tillCarry + 50% · rate · min(away, cap)); rate and happiness are
  // taken at the start of the absence. pearls: tanks with an oyster at happiness ≥ 60, 50% speed, within the cap.
  function offlineEarnings(state, awayMs) {
    var awaySec = Math.max(0, (Number(awayMs) || 0) / 1000);
    var cap = cofreSec(state), eff = Math.min(awaySec, cap);
    var add = K.OFFLINE_RATE * incomePerMinute(state) * eff / 60;
    var coins = Math.floor((state.aquarium.tillCarry || 0) + add);
    var pearls = 0, A = AQ.aquarium;
    if (A) {
      var tanks = state.aquarium.tanks;
      for (var i = 0; i < tanks.length; i++) {
        if (A.hasOyster(tanks[i]) && A.tankHappiness(tanks[i], state) >= A.K.PEARL_HAPPY) {
          pearls += Math.floor(((tanks[i].pearlSec || 0) + K.OFFLINE_RATE * eff) / A.K.PEARL_EVERY);
        }
      }
    }
    return { coins: coins, pearls: pearls, capped: awaySec > cap, effSec: eff, raw: add };
  }

  // feedCost(tank, state) = max(3, ceil(.5 · bioload)); the very first feed of a save is free (tutorial, §10).
  function feedCost(tank, state, opts) {
    if (!tank) return 0;
    if (!(opts && opts.auto) && state && state.stats && !(state.stats.fed > 0)) return 0;
    var bio = AQ.aquarium ? AQ.aquarium.tankUsage(tank, state).bioload : 0;
    return Math.max(3, Math.ceil(0.5 * bio));
  }

  AQ.economy = {
    K: K,
    gear: gear,
    specimenValue: specimenValue,
    fishSellValue: fishSellValue,
    juvFactor: juvFactor,
    priceOf: priceOf,
    requirementsMet: requirementsMet,
    canAfford: canAfford,
    incomePerMinute: incomePerMinute,
    offlineEarnings: offlineEarnings,
    feedCost: feedCost,
    cofreSec: cofreSec,
    caughtInZone: caughtInZone,
    zoneName: zoneName,
    targetTank: targetTank
  };
})(window.AQ);
