// Água-Tinta — debug helpers (owner A). Defined only with ?debug=1. Debug output may use literals.
(function (AQ) {
  'use strict';

  var on = false;
  try { on = /[?&]debug=1\b/.test(window.location.search); } catch (e) { on = false; }
  if (!on) return;

  function typeOk(v, type) {
    if (type === 'any') return v !== undefined;
    if (type === 'array') return Array.isArray(v);
    if (type === 'object') return v !== null && typeof v === 'object';
    return typeof v === type;
  }

  function wallet(dc, dp, reason) {
    var p = AQ.state.player;
    AQ.events.emit('wallet:changed', { coins: p.coins, pearls: p.pearls, dCoins: dc, dPearls: dp, reason: reason });
    AQ.store.markDirty();
  }

  AQ.debug = {
    enabled: true,

    give: function (coins, pearls) {
      var p = AQ.state.player;
      p.coins += coins || 0;
      p.pearls += pearls || 0;
      wallet(coins || 0, pearls || 0, 'debug');
      return { coins: p.coins, pearls: p.pearls };
    },

    unlockAll: function () {
      var s = AQ.state;
      s.progress.zones = AQ.ENUM.ZONES.slice();
      s.player.gear = { rod: 5, line: 5, reel: 5, hook: 4, lantern: 3, boat: 5 };
      s.player.unlocks.papel = true; s.player.unlocks.perola = true; s.player.unlocks.paperTheme = true;
      s.player.lures.colher = true; s.player.lures.jig = true;
      AQ.ENUM.BAITS.forEach(function (b) { if (b in s.player.baits && s.player.baits[b] !== -1) s.player.baits[b] += 50; });
      AQ.store.markDirty();
      AQ.events.emit('inventory:changed', { kind: 'all', id: null });
      return true;
    },

    setTime: function (phase) { return AQ.world.advanceTo(AQ.state, phase); },

    setWeather: function (w) {
      var prev = AQ.state.world.weather;
      AQ.state.world.weather = w;
      AQ.events.emit('world:weather', { weather: w, prev: prev });
      AQ.store.markDirty();
      return w;
    },

    spawn: function (id) { return AQ.fishing && AQ.fishing.debugSpawn ? AQ.fishing.debugSpawn(id) : null; },
    land: function (id) { return AQ.fishing && AQ.fishing.debugLand ? AQ.fishing.debugLand(id) : Promise.resolve(null); },

    // Lands every species in sequence via the fishing scene. → Promise<{ok:[], failed:[]}>
    catchAll: function () {
      var ids = AQ.species.ids(), report = { ok: [], failed: [] };
      return ids.reduce(function (p, id) {
        return p.then(function () {
          return Promise.resolve(AQ.debug.land(id)).then(function () { report.ok.push(id); }, function (e) { report.failed.push({ id: id, error: String(e) }); });
        });
      }, Promise.resolve()).then(function () { return report; });
    },

    // Picks n times across every phase × weather with the current bait → [{id, n, pct}]
    spawnStats: function (zone, n) {
      var rng = AQ.rng.create('spawnStats:' + zone), counts = {}, total = 0;
      var N = n || 10000;
      for (var i = 0; i < N; i++) {
        var ctx = { phase: AQ.ENUM.PHASES[i % 4], weather: AQ.ENUM.WEATHER[(i >> 2) % 4], bait: AQ.state.player.bait, luck: 0, lantern: 0, frenzy: false };
        var id = AQ.spawn.pick(zone, ctx, rng);
        if (id) { counts[id] = (counts[id] || 0) + 1; total++; }
      }
      var table = Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a]; })
        .map(function (id) { return { id: id, n: counts[id], pct: +(100 * counts[id] / Math.max(1, total)).toFixed(2) }; });
      if (console.table) console.table(table);
      return table;
    },

    // → ['ns.fn', ...] missing or mistyped contract members (§15.5)
    checkContracts: function () {
      var missing = [];
      Object.keys(AQ.CONTRACTS).forEach(function (ns) {
        var obj = AQ[ns];
        if (obj === undefined || obj === null) { missing.push(ns); return; }
        var api = AQ.CONTRACTS[ns].api;
        if (!api) return;
        api.split(/\s+/).forEach(function (entry) {
          var parts = entry.split(':'), name = parts[0], type = parts[1] || 'function';
          if (!typeOk(obj[name], type)) missing.push(ns + '.' + name);
        });
      });
      return missing;
    },

    // Autopilot fight with gear at the given tier → result string | null
    fight: function (id, tier) {
      var sp = AQ.species.get(id);
      if (!sp) return null;
      var st = AQ.util.deepClone(AQ.state);
      var t = tier || sp.gearTier || 1;
      st.player.gear = { rod: t, line: t, reel: t, hook: Math.min(4, t), lantern: 0, boat: 5 };
      var gear = AQ.economy.gear(st);
      var rng = AQ.rng.create('debugFight:' + id + ':' + t);
      var spec = AQ.spawn.rollSpecimen(id, { phase: 'dia', weather: 'limpo', bait: 'minhoca' }, rng) || { sp: id, q: 0.5 };
      var fs = AQ.fight.create(sp, spec, gear, { rng: rng, start: { x: 10, y: 20 }, floorY: function () { return 1e9; }, covers: [] });
      if (!fs) return null;
      for (var i = 0; i < 60 * 300; i++) {
        var evs = AQ.fight.step(fs, AQ.fight.autopilot(fs), 1 / 60) || [];
        for (var k = 0; k < evs.length; k++) if (evs[k].type === 'end') return { result: evs[k].result, sec: +(i / 60).toFixed(1) };
      }
      return { result: 'timeout', sec: 300 };
    }
  };
})(window.AQ);
