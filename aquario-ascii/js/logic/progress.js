// Água-Tinta — progression: zone unlocks, goal chain (3 active), achievements, stars, completion (owner D, §5.1, §9).
// Pure. check(state) mutates state (rewards, unlocks) and returns events for AQ.game to emit.
(function (AQ) {
  'use strict';

  var E = AQ.ENUM;
  var RANK = { C: 0, U: 1, R: 2, L: 3 };

  // Zone requirements (§5.1). boat tier, extra gear, species caught in the previous zone.
  var ZONE_REQ = {
    baia: null,
    recife: { boat: 2, species: { zone: 'baia', n: 5 } },
    kelp: { boat: 3, species: { zone: 'recife', n: 5 } },
    mar: { boat: 4, gear: { line: 3 }, species: { zone: 'kelp', n: 5 } },
    abismo: { boat: 5, gear: { lantern: 1 }, species: { zone: 'mar', n: 6 } }
  };

  function species(id) { return (AQ.species && AQ.species.get) ? AQ.species.get(id) : null; }
  function t(key, vars) { return AQ.i18n ? AQ.i18n.t(key, vars) : key; }
  function now() { return AQ.util.now(); }

  function zoneUnlocked(zoneId, state) {
    return !!(state && state.progress && state.progress.zones.indexOf(zoneId) >= 0);
  }

  function gearItem(slot, tier, state) {
    var have = state.player.gear[slot] || 0;
    var g = AQ.items.gearAt(slot, tier);
    return {
      key: 'item.req.gear', ok: have >= tier,
      vars: { name: t('item.' + slot + '.' + tier), slot: slot, tier: tier, price: g ? g.price : 0, have: have }
    };
  }

  // zoneRequirements(zoneId, state) → {ok, items:[{key, vars, ok}]}
  function zoneRequirements(zoneId, state) {
    var r = ZONE_REQ[zoneId], items = [];
    if (r === undefined) return { ok: false, items: [{ key: 'item.req.unknown', vars: { id: String(zoneId) }, ok: false }] };
    if (!r) return { ok: true, items: items };
    items.push(gearItem('boat', r.boat, state));
    if (r.gear) for (var slot in r.gear) items.push(gearItem(slot, r.gear[slot], state));
    if (r.species) {
      var have = AQ.economy.caughtInZone(state, r.species.zone);
      items.push({
        key: 'item.req.species', ok: have >= r.species.n,
        vars: { n: r.species.n, have: Math.min(have, r.species.n), zone: AQ.economy.zoneName(r.species.zone), id: r.species.zone }
      });
    }
    var ok = true;
    for (var i = 0; i < items.length; i++) if (!items[i].ok) ok = false;
    return { ok: ok, items: items };
  }

  // ---------------------------------------------------------------- counters
  function caughtSpecies(state) {
    var n = 0, b = state.bestiary || {};
    for (var id in b) if (b[id] && b[id].caught > 0 && E.SPECIES.indexOf(id) >= 0) n++;
    return n;
  }
  function seenSightings(state) {
    var n = 0, s = state.sightings || {};
    for (var id in s) if (s[id] && E.SIGHTINGS.indexOf(id) >= 0) n++;
    return n;
  }
  function denseCaught(state) {
    var n = 0, b = state.bestiary || {};
    for (var id in b) if (b[id]) n += b[id].dense || 0;
    return n;
  }
  function caughtOfRarity(state, rarity) {
    var n = 0, b = state.bestiary || {}, min = RANK[rarity] || 0;
    for (var id in b) {
      var sp = species(id);
      if (sp && b[id] && (RANK[sp.rarity] || 0) >= min) n += b[id].caught || 0;
    }
    return n;
  }
  function gearSum(state) {
    var g = state.player.gear, n = 0;
    for (var slot in AQ.items.GEAR_MIN) n += Math.max(0, (g[slot] || 0) - AQ.items.GEAR_MIN[slot]);
    return n;
  }
  function maxDecor(state) {
    var best = 0, tanks = state.aquarium.tanks;
    for (var i = 0; i < tanks.length; i++) {
      var n = 0, d = tanks[i].decor || [];
      for (var j = 0; j < d.length; j++) if (d[j]) n++;
      best = Math.max(best, n);
    }
    return best;
  }
  function stat(state, key) { var v = state.stats[key]; return typeof v === 'number' ? v : 0; }
  function count(o) { var n = 0; for (var k in (o || {})) if (o[k]) n++; return n; }

  // completion(state) → {caught, seen, total:45, pct (0..100, floored), frac (0..1)}
  function completion(state) {
    var caught = caughtSpecies(state), seen = seenSightings(state), total = E.BESTIARY_TOTAL || 45;
    var frac = Math.min(1, (caught + seen) / total);
    return { caught: caught, seen: seen, total: total, pct: Math.floor(frac * 100 + 1e-9), frac: frac };
  }

  // Relative goal types count from activation (goalBase); the rest read absolute values.
  var RELATIVE = { catch: 1, keep: 1, feed: 1, buy: 1, collectTill: 1, catchRarity: 1, catchAt: 1, breed: 1, trophy: 1, catchIn: 1 };

  function goalValue(goal, state) {
    var p = goal.params || {};
    switch (goal.type) {
      case 'catch': return stat(state, 'catches');
      case 'keep': return stat(state, 'kept');
      case 'feed': return stat(state, 'fed');
      case 'buy': return p.cat === 'gear' || !p.cat ? gearSum(state) : stat(state, 'bought_' + p.cat);
      case 'collectTill': return stat(state, 'tillCollects');
      case 'catchRarity': return caughtOfRarity(state, p.rarity || 'R');
      case 'catchAt': return p.phase === 'noite' ? stat(state, 'nightCatches') : stat(state, 'phase_' + p.phase);
      case 'breed': return stat(state, 'bred');
      case 'trophy': return stat(state, 'trophies');
      case 'catchIn': return p.weather === 'tempestade' ? stat(state, 'stormCatches') : stat(state, 'weather_' + p.weather);
      case 'discover': return caughtSpecies(state);
      case 'unlockZone': return zoneUnlocked(p.zone, state) ? 1 : 0;
      case 'decorTank': return maxDecor(state);
      case 'fishInAquarium': return state.aquarium.fish.length;
      case 'tanks': return state.aquarium.tanks.length;
      case 'stars': return state.progress.stars || 1;
      case 'messages': return count(state.messages);
      case 'sighting': return state.sightings && state.sightings[p.id] ? 1 : 0;
      case 'catchSpecies': return state.bestiary[p.sp] && state.bestiary[p.sp].caught > 0 ? 1 : 0;
      case 'ending': return state.progress.ending ? 1 : 0;
      case 'completion': return completion(state).pct;
      case 'dense': return denseCaught(state);
    }
    return 0;
  }
  function goalMax(goal) {
    var p = goal.params || {};
    switch (goal.type) {
      case 'unlockZone': case 'sighting': case 'catchSpecies': case 'ending': return 1;
      case 'completion': return p.pct || 100;
    }
    return p.n || 1;
  }

  // goalProgress(goal, state) → {cur, max}
  function goalProgress(goal, state) {
    if (typeof goal === 'string') goal = AQ.goals.get(goal);
    if (!goal) return { cur: 0, max: 1 };
    var max = goalMax(goal), v = goalValue(goal, state);
    if (RELATIVE[goal.type]) {
      var base = state.progress.goalBase[goal.id];
      v -= typeof base === 'number' ? base : 0;
    }
    return { cur: Math.max(0, Math.min(max, v)), max: max };
  }

  // activeGoals(state) → up to 3 Goals: the first not-done goals in chain order.
  function activeGoals(state) {
    var out = [], done = state.progress.goalsDone || {}, chain = AQ.goals.chain;
    for (var i = 0; i < chain.length && out.length < AQ.goals.ACTIVE; i++) if (!done[chain[i].id]) out.push(chain[i]);
    return out;
  }

  function snapshotBases(state) {
    var act = activeGoals(state), base = state.progress.goalBase;
    for (var i = 0; i < act.length; i++) {
      var g = act[i];
      if (RELATIVE[g.type] && typeof base[g.id] !== 'number') {
        // The opening goals (fresh save) count from zero; later ones from the moment they become active.
        base[g.id] = state.progress.goal === 0 && countDone(state) === 0 ? 0 : goalValue(g, state);
      }
    }
  }
  function countDone(state) { return count(state.progress.goalsDone); }

  function grant(state, reward, ev) {
    if (!reward) return;
    var p = state.player;
    if (reward.coins) { p.coins += reward.coins; state.stats.coinsEarned = (state.stats.coinsEarned || 0) + reward.coins; ev.dCoins += reward.coins; }
    if (reward.pearls) { p.pearls += reward.pearls; ev.dPearls += reward.pearls; }
    if (reward.unlock) p.unlocks[reward.unlock] = true;
  }

  // ---------------------------------------------------------------- achievements
  function achMet(a, state) {
    var p = a.params || {};
    switch (a.type) {
      case 'stat': return p.gt ? stat(state, p.key) > p.n : stat(state, p.key) >= p.n;
      case 'catchSpecies': return !!(state.bestiary[p.sp] && state.bestiary[p.sp].caught > 0);
      case 'catchSize': {
        var b = state.bestiary;
        for (var id in b) { var sp = species(id); if (sp && sp.size === p.size && b[id].caught > 0) return true; }
        return false;
      }
      case 'completion': return completion(state).pct >= p.pct;
      case 'dense': return denseCaught(state) >= p.n;
      case 'depth': return (state.progress.maxDepthM || 0) >= p.m;
      case 'ending': return !!state.progress.ending;
    }
    return false;
  }
  function achProgress(a, state) {
    if (typeof a === 'string') a = AQ.goals.ach(a);
    if (!a) return { cur: 0, max: 1 };
    var p = a.params || {}, cur = 0, max = 1;
    switch (a.type) {
      case 'stat': max = p.gt ? p.n + 1 : p.n; cur = stat(state, p.key); break;
      case 'completion': max = p.pct; cur = completion(state).pct; break;
      case 'dense': max = p.n; cur = denseCaught(state); break;
      case 'depth': max = p.m; cur = Math.round(state.progress.maxDepthM || 0); break;
      default: cur = achMet(a, state) ? 1 : 0;
    }
    if (state.progress.ach[a.id]) cur = max;
    return { cur: Math.max(0, Math.min(max, cur)), max: max };
  }

  // ---------------------------------------------------------------- check
  // check(state) → events[]: {type:'zone', zone} {type:'stars', stars, prev} {type:'goal', id, reward}
  //   {type:'achievement', id, reward} — plus .dCoins/.dPearls on the array (wallet delta of all rewards).
  function check(state) {
    var events = [];
    events.dCoins = 0; events.dPearls = 0;
    if (!state || !state.progress) return events;
    var pr = state.progress;
    if (!pr.goalBase) pr.goalBase = {};
    if (!pr.goalsDone) pr.goalsDone = {};
    if (!pr.ach) pr.ach = {};

    // zones
    var zones = E.ZONES;
    for (var z = 0; z < zones.length; z++) {
      if (zoneUnlocked(zones[z], state)) continue;
      if (zoneRequirements(zones[z], state).ok) {
        pr.zones.push(zones[z]);
        events.push({ type: 'zone', zone: zones[z] });
      }
    }

    // stars (best ever)
    var cur = AQ.aquarium.stars(state), prev = pr.stars || 1;
    if (cur > prev) {
      pr.stars = cur;
      events.push({ type: 'stars', stars: cur, prev: prev });
    }
    if (pr.stars >= 4) state.player.unlocks.perola = true;

    // goals
    snapshotBases(state);
    for (var guard = 0; guard < 40; guard++) {
      var act = activeGoals(state), any = false;
      for (var i = 0; i < act.length; i++) {
        var g = act[i], gp = goalProgress(g, state);
        if (gp.cur >= gp.max) {
          pr.goalsDone[g.id] = now() || 1;
          grant(state, g.reward, events);
          events.push({ type: 'goal', id: g.id, reward: g.reward });
          any = true;
        }
      }
      pr.goal = firstNotDone(state);
      if (!any) break;
      snapshotBases(state);
    }
    pr.goal = firstNotDone(state);

    // achievements
    var achs = AQ.goals.achievements;
    for (var k = 0; k < achs.length; k++) {
      var a = achs[k];
      if (pr.ach[a.id]) continue;
      if (achMet(a, state)) {
        pr.ach[a.id] = now() || 1;
        grant(state, a.reward, events);
        events.push({ type: 'achievement', id: a.id, reward: a.reward });
      }
    }
    return events;
  }
  function firstNotDone(state) {
    var chain = AQ.goals.chain, done = state.progress.goalsDone;
    for (var i = 0; i < chain.length; i++) if (!done[chain[i].id]) return i;
    return chain.length;
  }

  AQ.progress = {
    ZONE_REQ: ZONE_REQ,
    zoneUnlocked: zoneUnlocked,
    zoneRequirements: zoneRequirements,
    activeGoals: activeGoals,
    goalProgress: goalProgress,
    check: check,
    completion: completion,
    // extras
    achProgress: achProgress,
    goalValue: goalValue,
    caughtSpecies: caughtSpecies,
    denseCaught: denseCaught,
    nextZone: function (state) {
      for (var i = 0; i < E.ZONES.length; i++) if (!zoneUnlocked(E.ZONES[i], state)) return E.ZONES[i];
      return null;
    }
  };
})(window.AQ);
