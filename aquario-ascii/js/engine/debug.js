// Água-Tinta — debug helpers (owner A). Defined only with ?debug=1. Debug output may use literals.
// AQ.debug.help() lists the commands. The ` (backquote) key toggles the extended FPS meter.
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
  function S() { return AQ.state; }
  function wallet(dc, dp, reason) {
    var p = S().player;
    AQ.events.emit('wallet:changed', { coins: p.coins, pearls: p.pearls, dCoins: dc, dPearls: dp, reason: reason });
    AQ.store.markDirty();
  }
  function inv(kind, id) { AQ.events.emit('inventory:changed', { kind: kind, id: id }); AQ.store.markDirty(); }
  function yieldTick() { return new Promise(function (r) { setTimeout(r, 0); }); }

  function specimenFor(id, rng) {
    var sp = AQ.species.get(id) || {};
    var ctx = { phase: 'noite', weather: 'tempestade', bait: 'minhoca', luck: 0, lantern: 3, frenzy: false };
    var spec = null;
    try { spec = AQ.spawn.rollSpecimen(id, ctx, rng); } catch (e) { spec = null; }
    if (!spec) {
      var len = sp.len ? (sp.len[0] + sp.len[1]) / 2 : 10;
      spec = { sp: id, len: len, kg: sp.kgMax ? +(sp.kgMax * Math.pow(len / sp.len[1], 3)).toFixed(2) : 0.1, q: 0.5, dense: false, trophy: false, zone: (sp.zones && sp.zones[0]) || 'baia', at: AQ.util.now() };
    }
    return spec;
  }

  var HELP = [
    'help()                         this list',
    'go(scene, params?)             jump to a scene (title|map|fishing|aquarium|ending)',
    'zone(id)                       unlock a zone and go fishing there',
    'give(coins, pearls)            add currency',
    'giveItem(id, n=10)             bait (minhoca | bait_minhoca), lure (colher), decor (pedras), "rod:3" gear tier',
    'gear(tier|{rod:..})            set gear tiers (lantern 0–3, hook ≤ 4)',
    'unlockAll()                    all zones, top gear, lures, special baits, papel theme',
    'setTime(phase) / setWeather(w) world clock and weather',
    'spawn(id) / land(id)           in the fishing scene (C)',
    'catchAll({viaScene, choice, skip, fight}) → Promise<report>   records every species',
    'spawnStats(zone, n=10000)      pick table over phase × weather × bait (+ legendaryReady)',
    'checkContracts()               missing / mistyped §15.5 members',
    'fight(id, tier?)               autopilot fight → {result, sec}',
    'fx(kind, opts?)                emit an effect at the screen centre (or "wipe", "lightning", "shake")',
    'quality(p) / motion(on)        force a preset (or "auto") / reduced motion on|off|auto',
    'grid()                         display metrics',
    'pause() / step(n=1) / resume() freeze the loop and advance frames',
    'reset()                        wipe the save (keeps settings)'
  ];

  var D = AQ.debug = {
    enabled: true,

    help: function () { console.log('AQ.debug\n  ' + HELP.join('\n  ')); return HELP.length; },

    go: function (scene, params) { return AQ.scenes.go(scene, params || null); },

    zone: function (id) {
      var z = id || 'baia';
      var pz = S().progress.zones;
      if (pz.indexOf(z) < 0) pz.push(z);
      S().player.zone = z;
      AQ.store.markDirty();
      AQ.events.emit('zone:unlocked', { zone: z });
      return AQ.scenes.go('fishing', { zone: z });
    },

    give: function (coins, pearls) {
      var p = S().player;
      p.coins += coins || 0;
      p.pearls += pearls || 0;
      wallet(coins || 0, pearls || 0, 'debug');
      return { coins: p.coins, pearls: p.pearls };
    },

    giveItem: function (id, n) {
      var p = S().player, k = n === undefined ? 10 : n, s = String(id);
      var gm = /^(rod|line|reel|hook|lantern|boat):(\d)$/.exec(s);
      if (gm) { p.gear[gm[1]] = +gm[2]; inv('gear', gm[1]); return p.gear; }
      var b = s.replace(/^bait_/, '').replace(/^lure_/, '');
      if (AQ.ENUM.LURES.indexOf(b) >= 0) { p.lures[b] = true; inv('lure', b); return p.lures; }
      if (b in p.baits) {
        var before = p.baits[b];
        try { AQ.game.addBait(b, k); } catch (e) { /* fall back below */ }
        if (p.baits[b] === before && before !== -1) p.baits[b] += k; // owner stub did nothing
        if (b === 'papel') p.unlocks.papel = true;
        if (b === 'perola') p.unlocks.perola = true;
        inv('bait', b);
        return p.baits;
      }
      if (b in p.decor) { p.decor[b] += k; inv('decor', b); return p.decor; }
      console.warn('[AQ.debug] unknown item ' + id);
      return null;
    },

    gear: function (tier) {
      var g = S().player.gear;
      if (typeof tier === 'object') Object.assign(g, tier);
      else {
        var t = AQ.util.clamp(tier | 0, 1, 5);
        Object.assign(g, { rod: t, line: t, reel: t, hook: Math.min(4, t), lantern: Math.min(3, t - 1), boat: t });
      }
      inv('gear', 'all');
      return g;
    },

    unlockAll: function () {
      var s = S();
      s.progress.zones = AQ.ENUM.ZONES.slice();
      s.player.gear = { rod: 5, line: 5, reel: 5, hook: 4, lantern: 3, boat: 5 };
      s.player.unlocks.papel = true; s.player.unlocks.perola = true; s.player.unlocks.paperTheme = true;
      s.player.lures.colher = true; s.player.lures.jig = true;
      Object.keys(s.player.baits).forEach(function (b) { if (s.player.baits[b] !== -1) s.player.baits[b] += 50; });
      AQ.ENUM.ZONES.forEach(function (z) { AQ.events.emit('zone:unlocked', { zone: z }); });
      inv('all', null);
      return true;
    },

    setTime: function (phase) {
      var m = AQ.world.advanceTo(S(), phase);
      AQ.store.markDirty();
      return m;
    },

    setWeather: function (w) {
      if (AQ.ENUM.WEATHER.indexOf(w) < 0) return null;
      var prev = S().world.weather;
      S().world.weather = w;
      AQ.events.emit('world:weather', { weather: w, prev: prev });
      AQ.store.markDirty();
      return w;
    },

    spawn: function (id) {
      if (AQ.scenes.current !== 'fishing') console.warn('[AQ.debug] spawn works in the fishing scene');
      return AQ.fishing && AQ.fishing.debugSpawn ? AQ.fishing.debugSpawn(id) : null;
    },
    land: function (id) { return AQ.fishing && AQ.fishing.debugLand ? AQ.fishing.debugLand(id) : Promise.resolve(null); },

    // Records every species (bestiary 42/42). Default: an autopilot fight per species (if AQ.fight is there),
    // then AQ.game.resolveCatch(specimen, {choice}) — tinteira goes last with 'release' (it triggers the ending).
    // {viaScene:true} lands each one through the fishing scene instead (AQ.fishing.debugLand).
    catchAll: function (opts) {
      var o = opts || {};
      var ids = AQ.species.ids().slice();
      if (o.skip) ids = ids.filter(function (id) { return o.skip.indexOf(id) < 0; });
      ids.sort(function (a, b) { return (a === 'tinteira') - (b === 'tinteira'); });
      var rng = AQ.rng.create('catchAll');
      var report = { ok: [], failed: [], fights: {} };
      return ids.reduce(function (p, id) {
        return p.then(function () {
          if (o.viaScene) {
            return Promise.resolve(D.land(id)).then(function () { report.ok.push(id); }, function (e) { report.failed.push({ id: id, error: String(e) }); });
          }
          try {
            if (o.fight !== false) {
              var fr = D.fight(id);
              if (fr) { report.fights[id] = fr; if (fr.result !== 'landed') report.failed.push({ id: id, error: 'fight: ' + fr.result }); }
            }
            var spec = specimenFor(id, rng);
            AQ.game.markSeen(id);
            AQ.game.resolveCatch(spec, { choice: id === 'tinteira' ? 'release' : (o.choice || 'sell') });
            report.ok.push(id);
          } catch (e) { report.failed.push({ id: id, error: String(e && e.message || e) }); }
          return yieldTick();
        });
      }, Promise.resolve()).then(function () {
        var c = null;
        try { c = AQ.progress.completion(S()); } catch (e) { c = null; }
        report.completion = c;
        console.log('[AQ.debug] catchAll: ' + report.ok.length + ' ok, ' + report.failed.length + ' failed', report);
        return report;
      });
    },

    // Pick table for a zone over every phase × weather × bait (n picks in total), plus legendaries via
    // legendaryReady. Every zone species gets a row (n = 0 when never picked). → [{id, rarity, n, pct, ready}]
    spawnStats: function (zone, n) {
      var N = n || 10000, rng = AQ.rng.create('spawnStats:' + zone), counts = {}, total = 0, ready = {};
      var P = AQ.ENUM.PHASES, W = AQ.ENUM.WEATHER, B = AQ.ENUM.BAITS, combos = P.length * W.length * B.length;
      for (var i = 0; i < N; i++) {
        var k = i % combos;
        var ctx = { phase: P[k % 4], weather: W[(k >> 2) % 4], bait: B[Math.floor(k / 16) % B.length], luck: 0, lantern: 3, frenzy: false };
        var id = AQ.spawn.pick(zone, ctx, rng);
        if (id) { counts[id] = (counts[id] || 0) + 1; total++; }
        if (i < combos) {
          var lid = AQ.spawn.legendaryReady(zone, ctx);
          if (lid) (ready[lid] || (ready[lid] = [])).push(ctx.phase + '/' + ctx.weather + '/' + ctx.bait);
        }
      }
      var ids = (AQ.species.inZone(zone) || []).map(function (s) { return s.id; });
      Object.keys(counts).forEach(function (id) { if (ids.indexOf(id) < 0) ids.push(id); });
      var table = ids.map(function (id) {
        var sp = AQ.species.get(id) || {};
        return { id: id, rarity: sp.rarity || '?', n: counts[id] || 0, pct: +(100 * (counts[id] || 0) / Math.max(1, total)).toFixed(2), ready: ready[id] ? ready[id].length + ' combos (e.g. ' + ready[id][0] + ')' : '' };
      }).sort(function (a, b) { return b.n - a.n; });
      if (console.table) console.table(table);
      return table;
    },

    // → ['ns.fn (type)', ...] missing or mistyped contract members (§15.5)
    checkContracts: function () {
      var missing = [];
      Object.keys(AQ.CONTRACTS).forEach(function (ns) {
        var obj = AQ[ns];
        if (obj === undefined || obj === null) { missing.push(ns); return; }
        var api = AQ.CONTRACTS[ns].api;
        if (!api) return;
        api.split(/\s+/).forEach(function (entry) {
          var parts = entry.split(':'), name = parts[0], type = parts[1] || 'function';
          if (!typeOk(obj[name], type)) missing.push(ns + '.' + name + ' (' + type + ')');
        });
      });
      return missing;
    },

    // Autopilot fight with gear at the given tier (default: the species' gearTier) → {result, sec} | null
    fight: function (id, tier) {
      var sp = AQ.species.get(id);
      if (!sp) return null;
      var st = AQ.util.deepClone(S());
      var t = tier || sp.gearTier || 1;
      st.player.gear = { rod: t, line: t, reel: t, hook: Math.max(Math.min(4, t), sp.hookMin || 1), lantern: Math.min(3, t - 1), boat: 5 };
      var gear = AQ.economy.gear(st);
      var rng = AQ.rng.create('debugFight:' + id + ':' + t);
      var spec = specimenFor(id, rng);
      var fs = AQ.fight.create(sp, spec, gear, { rng: rng, start: { x: 10, y: 20 }, floorY: function () { return 1e9; }, covers: [] });
      if (!fs || typeof fs !== 'object' || fs.t === undefined) return null;
      var limit = 60 * (sp.rarity === 'L' ? 300 : 120);
      for (var i = 0; i < limit; i++) {
        var evs = AQ.fight.step(fs, AQ.fight.autopilot(fs), 1 / 60) || [];
        for (var k = 0; k < evs.length; k++) if (evs[k].type === 'end') return { result: evs[k].result, sec: +(i / 60).toFixed(1) };
      }
      return { result: 'timeout', sec: limit / 60 };
    },

    fx: function (kind, opts) {
      var w = AQ.render.screenToWorld(AQ.display.width / 2, AQ.display.height / 2, {});
      if (kind === 'wipe') return AQ.fx.inkWipe('out').then(function () { return AQ.fx.inkWipe('in'); });
      if (kind === 'lightning') return AQ.fx.lightning();
      if (kind === 'shake') { AQ.fx.shake(4, 0.4); return true; }
      if (kind === 'flash') { AQ.fx.flash(6, 0.3); return true; }
      return AQ.fx.emit(kind || 'splash', w.x, w.y, opts || (kind === 'text' ? { text: 'NOVO!' } : kind === 'coin' ? { n: 14 } : null));
    },

    quality: function (p) { return AQ.settings.set('quality', p || 'auto'); },
    motion: function (v) { return AQ.settings.set('reducedMotion', v === true ? 'on' : v === false ? 'off' : (v || 'auto')); },
    grid: function () { var m = AQ.display.metrics(); m.gridRows = AQ.render.grid.rows; m.preset = AQ.perf.preset(); return m; },

    pause: function () { AQ.loop.stop(); return true; },
    resume: function () { AQ.loop.start(); return true; },
    step: function (n) { for (var i = 0; i < (n || 1); i++) AQ.loop.step(); return AQ.loop.frame; },

    reset: function () { return AQ.store.reset(); },

    overlay: function (show) {
      var want = show === undefined ? !overlayOn : !!show;
      overlayOn = want;
      AQ.perf.showMeter(want || AQ.settings.get('showFps'));
      return want;
    }
  };

  var overlayOn = false;
  AQ.perf.meterExtra = function () {
    var m = AQ.display, st = AQ.render.stats(), w = S().world;
    return (AQ.scenes.current || '-') + (AQ.scenes.paused ? ' (paused)' : '') + '  ' + m.cols + 'x' + m.rows + ' @' + m.fontPx + 'px dpr ' + m.dpr +
      '\nglyphs ' + st.glyphs + '  bg Δ ' + st.bgChanged + '  fx ' + AQ.fx.count + '  atlas ' + st.atlas +
      '\n' + AQ.util.fmtClock(w.minutes) + ' ' + w.weather + '  cam ' + AQ.render.cam.x.toFixed(1) + ',' + AQ.render.cam.y.toFixed(1);
  };
  window.addEventListener('keydown', function (e) {
    if (e.key === '`' && !(e.target && /INPUT|TEXTAREA/.test(e.target.tagName))) D.overlay();
  });
  console.log('[AQ.debug] enabled — AQ.debug.help() lists the commands');
})(window.AQ);
