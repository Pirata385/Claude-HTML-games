// Água-Tinta — AQ.game: every player-state mutation, with its §15.9 events (owner D).
// Pure at load time (only registers AQ.events listeners). C (fishing) and E (UI) call these; nobody else writes
// state.player / aquarium / bestiary / sightings / messages / progress / stats.
(function (AQ) {
  'use strict';

  var E = AQ.ENUM, U = AQ.util;
  var RANK = { C: 0, U: 1, R: 2, L: 3 };
  var NAME_MAX = 16;

  function S() { return AQ.state; }
  function species(id) { return (AQ.species && AQ.species.get) ? AQ.species.get(id) : null; }
  function emit(name, payload) { if (AQ.events) AQ.events.emit(name, payload); }
  function dirty() { if (AQ.store && AQ.store.markDirty) AQ.store.markDirty(); }
  function now() { return U.now(); }
  function st(key, d) { var s = S().stats; s[key] = (typeof s[key] === 'number' ? s[key] : 0) + (d === undefined ? 1 : d); }

  function wallet(dc, dp, reason) {
    if (!dc && !dp) return;
    var p = S().player;
    emit('wallet:changed', { coins: p.coins, pearls: p.pearls, dCoins: dc || 0, dPearls: dp || 0, reason: reason || '' });
  }

  function tankById(id) {
    var tanks = S().aquarium.tanks;
    for (var i = 0; i < tanks.length; i++) if (tanks[i].id === id) return tanks[i];
    return null;
  }
  function fishByUid(uid) {
    var fish = S().aquarium.fish;
    for (var i = 0; i < fish.length; i++) if (fish[i].uid === uid) return fish[i];
    return null;
  }
  function removeFish(f) {
    var fish = S().aquarium.fish, i = fish.indexOf(f);
    if (i >= 0) fish.splice(i, 1);
  }
  function bestEntry(spId) {
    var b = S().bestiary;
    if (!b[spId]) b[spId] = { seen: true, caught: 0, kept: 0, sold: 0, released: 0, bestLen: 0, bestKg: 0, first: 0, dense: 0 };
    return b[spId];
  }

  function worldNow() {
    var s = S(), w = null;
    try { w = AQ.world && AQ.world.now ? AQ.world.now(s) : null; } catch (e) { w = null; }
    var phase = w && w.phase, weather = (w && w.weather) || s.world.weather;
    if (!phase) {
      var m = ((s.world.minutes % 1440) + 1440) % 1440;
      phase = m >= 300 && m < 420 ? 'amanhecer' : m >= 420 && m < 1020 ? 'dia' : m >= 1020 && m < 1140 ? 'entardecer' : 'noite';
    }
    return { phase: phase, weather: weather };
  }

  // Runs AQ.progress.check and emits its events. Called after every mutation.
  function postCheck() {
    if (!AQ.progress || !AQ.progress.check) return [];
    var evs = AQ.progress.check(S());
    for (var i = 0; i < evs.length; i++) {
      var e = evs[i];
      if (e.type === 'zone') emit('zone:unlocked', { zone: e.zone });
      else if (e.type === 'stars') emit('stars:changed', { stars: e.stars, prev: e.prev });
      else if (e.type === 'goal') emit('goal:done', { id: e.id, reward: e.reward });
      else if (e.type === 'achievement') emit('achievement:unlocked', { id: e.id, reward: e.reward });
    }
    if (evs.dCoins || evs.dPearls) wallet(evs.dCoins, evs.dPearls, 'reward');
    if (evs.length) dirty();
    return evs;
  }

  // ---------------------------------------------------------------- luck (session only, §8.5)
  var luckZone = null, luckV = 0;
  function luck(zoneId) { return zoneId === undefined || zoneId === luckZone ? luckV : 0; }
  function addLuck(zoneId, v) {
    if (zoneId !== luckZone) { luckZone = zoneId; luckV = 0; }
    luckV = Math.min(0.25, Math.max(0, luckV + (v === undefined ? 0.05 : v)));
    return luckV;
  }
  function resetLuck() { luckZone = null; luckV = 0; }

  // ---------------------------------------------------------------- frenzy tracking (achievement frenesi)
  var frenzy = { on: false, n: 0 };

  // ---------------------------------------------------------------- new game
  function newGame() {
    var Sx = AQ.store;
    if (Sx.backup) Sx.backup();
    Sx.replaceState(Sx.fresh ? Sx.fresh() : Sx.defaults());
    resetLuck();
    frenzy.on = false; frenzy.n = 0;
    postCheck();
    Sx.save('newGame');
    return S();
  }

  // ---------------------------------------------------------------- catches
  // catchInfo(specimen) → {isNew, isRecord, value, keepable, canKeep, tankId (best), tanks:[{id, index, used, cap, fits}]}
  // What the catch card needs before AQ.game.resolveCatch (D extension).
  function catchInfo(specimen) {
    var s = S(), sp = species(specimen && specimen.sp), b = s.bestiary[specimen && specimen.sp];
    var isNew = !(b && b.caught > 0);
    var isRecord = !isNew && !specimen.bred && specimen.len > (b.bestLen || 0);
    var keepable = AQ.aquarium.keepable(sp);
    var tanks = s.aquarium.tanks.map(function (tk, i) {
      var u = AQ.aquarium.tankUsage(tk, s);
      return { id: tk.id, index: i, used: u.used, cap: u.cap, fits: keepable && AQ.aquarium.canFit(sp, tk, s) };
    });
    var best = keepable ? AQ.aquarium.bestTankFor(specimen, s) : null;
    return {
      isNew: isNew, isRecord: isRecord, value: AQ.economy.specimenValue(specimen), keepable: keepable,
      canKeep: !!best, tankId: best, tanks: tanks, size: sp ? sp.size : null, cost: sp ? AQ.aquarium.sizeCost(sp.id) : 0
    };
  }

  // resolveCatch(specimen, {choice:'keep'|'sell'|'release', tankId?}) → {value, isNew, isRecord, fish?, choice}
  // keep that does not fit falls back to sell; species with keep:false (tinteira) are always released.
  function resolveCatch(specimen, opts) {
    var s = AQ.state, o = opts || {};
    if (!specimen || !specimen.sp) return { value: 0, isNew: false, isRecord: false, fish: null, choice: 'release' };
    var sp = species(specimen.sp);
    var info = catchInfo(specimen);
    var choice = E.CHOICES.indexOf(o.choice) >= 0 ? o.choice : 'sell';
    var value = info.value;
    var dCoins = 0, dPearls = 0, fish = null, wn = worldNow();
    var isEnding = !!(sp && sp.keep === false && (sp.boss || specimen.sp === 'tinteira'));

    if (sp && sp.keep === false && choice === 'keep') choice = 'release';
    if (isEnding) choice = 'release';
    var tank = null;
    if (choice === 'keep') {
      tank = o.tankId ? tankById(o.tankId) : null;
      if (!tank || !AQ.aquarium.canFit(specimen, tank, s)) tank = info.tankId ? tankById(info.tankId) : null;
      if (!tank) choice = 'sell';
    }

    // bestiary + stats
    var b = bestEntry(specimen.sp);
    b.seen = true;
    b.caught++;
    if (!b.first) b.first = specimen.at || now();
    if (!specimen.bred && specimen.len > (b.bestLen || 0)) { b.bestLen = specimen.len; b.bestKg = specimen.kg || 0; }
    if (specimen.dense) { b.dense = (b.dense || 0) + 1; st('denseCatches'); }
    st('catches');
    if (wn.phase === 'noite') st('nightCatches');
    if (wn.weather === 'tempestade') st('stormCatches');
    if (specimen.trophy) st('trophies');
    var rank = sp ? RANK[sp.rarity] || 0 : 0;
    if (rank >= 2) { st('rareCatches'); if (wn.weather === 'tempestade') st('stormRares'); }
    if (sp && sp.rarity === 'L') st('legendaries');
    if (sp && sp.kind === 'jelly') st('jelliesClean');
    if (frenzy.on) { frenzy.n++; if (frenzy.n > (s.stats.frenzyBest || 0)) s.stats.frenzyBest = frenzy.n; }
    if (info.isNew && sp) {
      if (sp.rarity === 'R') dPearls += 2;
      else if (sp.rarity === 'L') dPearls += 10;
    }

    if (choice === 'keep') {
      var aq = s.aquarium;
      fish = {
        uid: 'f' + (aq.nextUid++), sp: specimen.sp, len: specimen.len, kg: specimen.kg, q: specimen.q,
        dense: !!specimen.dense, trophy: !!specimen.trophy, bred: false, growth: 1, tank: tank.id, name: null,
        at: specimen.at || now(), zone: specimen.zone || (sp && sp.zones && sp.zones[0]) || null
      };
      aq.fish.push(fish);
      b.kept++; st('kept');
    } else if (choice === 'sell') {
      dCoins += value;
      b.sold++; st('sold');
      st('coinsEarned', value);
    } else {
      b.released++; st('released');
      if (!isEnding) addLuck(specimen.zone || s.player.zone, 0.05);
    }
    s.player.coins += dCoins;
    s.player.pearls += dPearls;

    if (isEnding) {
      s.progress.ending = true;
      s.progress.endingAt = now();
      s.player.unlocks.paperTheme = true;
    }
    dirty();
    if (info.isNew) emit('species:new', { sp: specimen.sp });
    wallet(dCoins, dPearls, choice === 'sell' ? 'sell' : 'catch');
    if (fish) emit('aquarium:changed', { tankId: fish.tank });
    emit('catch:resolved', { specimen: specimen, choice: choice, value: value, isNew: info.isNew, isRecord: info.isRecord, fish: fish });
    postCheck();
    if (isEnding) emit('ending:start', {});
    return { value: value, isNew: info.isNew, isRecord: info.isRecord, fish: fish, choice: choice, pearls: dPearls };
  }

  function markSeen(spId) {
    if (!spId) return false;
    var b = S().bestiary;
    if (b[spId] && b[spId].seen) return false;
    bestEntry(spId).seen = true;
    dirty();
    emit('species:seen', { sp: spId });
    return true;
  }

  function markSighting(id) {
    var s = S();
    if (!id || s.sightings[id]) return false;
    s.sightings[id] = now() || 1;
    dirty();
    emit('sighting:new', { id: id });
    postCheck();
    return true;
  }

  // foundMessage() → the next unread message id (m1..m8) or null when all are found.
  function foundMessage() {
    var s = S(), list = AQ.goals.messages;
    for (var i = 0; i < list.length; i++) {
      var m = list[i];
      if (s.messages[m.id]) continue;
      s.messages[m.id] = now() || 1;
      if (m.unlock) s.player.unlocks[m.unlock] = true;
      dirty();
      emit('message:found', { id: m.id });
      if (m.unlock) emit('inventory:changed', { kind: 'unlock', id: m.unlock });
      postCheck();
      return m.id;
    }
    return null;
  }
  function allMessagesFound() {
    var s = S(), list = AQ.goals.messages;
    for (var i = 0; i < list.length; i++) if (!s.messages[list[i].id]) return false;
    return true;
  }

  // bottleCoins(zoneId) → coins ($50 × zone order, baia = 1). Adds them to the wallet.
  function bottleCoins(zoneId) {
    var order = E.ZONES.indexOf(zoneId) + 1;
    if (order <= 0) order = 1;
    var amount = 50 * order, s = S();
    s.player.coins += amount;
    st('coinsEarned', amount);
    dirty();
    wallet(amount, 0, 'bottle');
    return amount;
  }

  // ---------------------------------------------------------------- shop
  function deny(itemId, reason) {
    emit('shop:denied', { itemId: itemId, reason: reason });
    return { ok: false, reason: reason };
  }
  // buy(itemId, opts?{tankId}) → {ok, reason?:'coins'|'pearls'|'req'|'maxed', tier?, tankId?}
  function buy(itemId, opts) {
    var s = S(), I = AQ.items, it = I.get(itemId);
    if (!it) return deny(itemId, 'req');
    var price = AQ.economy.priceOf(itemId, s, opts);
    if (!price) return deny(itemId, 'maxed');
    if (!AQ.economy.requirementsMet(itemId, s, opts).ok) return deny(itemId, 'req');
    if (s.player.coins < price.coins) return deny(itemId, 'coins');
    if (s.player.pearls < price.pearls) return deny(itemId, 'pearls');
    var p = s.player, res = { ok: true, price: price }, kind = it.cat, id = itemId, tankId = null;
    p.coins -= price.coins;
    p.pearls -= price.pearls;
    st('coinsSpent', price.coins);
    switch (it.cat) {
      case 'gear':
        p.gear[it.slot] = (p.gear[it.slot] || I.GEAR_MIN[it.slot]) + 1;
        res.tier = p.gear[it.slot];
        st('gearBought');
        break;
      case 'bait':
        addBaitRaw(it.bait, it.qty);
        id = it.bait;
        break;
      case 'lure':
        p.lures[it.bait] = true;
        id = it.bait;
        break;
      case 'decor':
        p.decor[it.decor] = (p.decor[it.decor] || 0) + 1;
        break;
      case 'tank': {
        if (it.id === 'tank') {
          var tanks = s.aquarium.tanks, n = 0;
          for (var i = 0; i < tanks.length; i++) n = Math.max(n, parseInt(String(tanks[i].id).replace(/\D/g, ''), 10) || 0);
          var tk = {
            id: 't' + (n + 1), cap: 1, filter: 1, feeder: false, light: 'day', food: 1,
            decor: [null, null, null, null, null], foodLowSec: 0, breedSec: 0, produceSec: 0, pearlSec: 0
          };
          tanks.push(tk);
          tankId = tk.id;
          res.tier = tanks.length;
        } else {
          var t = AQ.economy.targetTank(it, s, opts);
          tankId = t.id;
          if (it.id === 'tankcap') res.tier = ++t.cap;
          else if (it.id === 'filter') res.tier = ++t.filter;
          else if (it.id === 'feeder') t.feeder = true;
        }
        res.tankId = tankId;
        break;
      }
      case 'misc':
        if (it.id === 'cofre') res.tier = ++p.cofre;
        break;
    }
    dirty();
    emit('shop:bought', { itemId: itemId, tankId: tankId, tier: res.tier });
    wallet(-price.coins, -price.pearls, 'buy');
    emit('inventory:changed', { kind: kind, id: id });
    if (tankId) emit('aquarium:changed', { tankId: tankId });
    postCheck();
    return res;
  }

  // ---------------------------------------------------------------- baits
  function ownsBait(baitId) {
    var p = S().player;
    if (E.LURES.indexOf(baitId) >= 0) return !!(p.lures && p.lures[baitId]);
    var n = p.baits[baitId];
    return n === -1 || n > 0;
  }
  function equipBait(baitId) {
    if (E.BAITS.indexOf(baitId) < 0 || !ownsBait(baitId)) return false;
    var p = S().player;
    if (p.bait === baitId) return true;
    p.bait = baitId;
    dirty();
    emit('inventory:changed', { kind: 'bait', id: baitId });
    return true;
  }
  // consumeBait() → the bait id used for this cast. A finite bait loses one; at 0 the equipped bait falls back to
  // massa and 'inventory:changed' {kind:'bait', id:'massa', prev, reason:'empty'} is emitted (E toasts it).
  function consumeBait() {
    var p = S().player, b = p.bait;
    if (!ownsBait(b)) {
      var prev = b;
      p.bait = 'massa';
      dirty();
      emit('inventory:changed', { kind: 'bait', id: 'massa', prev: prev, reason: 'empty' });
      return 'massa';
    }
    if (E.LURES.indexOf(b) >= 0 || p.baits[b] === -1) return b;
    p.baits[b] = Math.max(0, (p.baits[b] || 0) - 1);
    dirty();
    if (p.baits[b] === 0) {
      p.bait = 'massa';
      emit('inventory:changed', { kind: 'bait', id: 'massa', prev: b, reason: 'empty' });
    } else {
      emit('inventory:changed', { kind: 'bait', id: b });
    }
    return b;
  }
  function addBaitRaw(baitId, n) {
    var p = S().player;
    if (E.LURES.indexOf(baitId) >= 0) { p.lures[baitId] = true; return; }
    if (p.baits[baitId] === -1) return;
    p.baits[baitId] = Math.max(0, (p.baits[baitId] || 0) + (n === undefined ? 1 : n));
  }
  function addBait(baitId, n) {
    if (E.BAITS.indexOf(baitId) < 0) return false;
    addBaitRaw(baitId, n);
    dirty();
    emit('inventory:changed', { kind: 'bait', id: baitId });
    return true;
  }

  // ---------------------------------------------------------------- fish in tanks
  function sellFish(uid) {
    var s = S(), f = fishByUid(uid);
    if (!f) return 0;
    var v = AQ.economy.fishSellValue(f);
    removeFish(f);
    s.player.coins += v;
    st('sold'); st('coinsEarned', v);
    if (s.bestiary[f.sp]) s.bestiary[f.sp].sold++;
    dirty();
    wallet(v, 0, 'sell');
    emit('aquarium:changed', { tankId: f.tank, uid: uid, removed: true });
    postCheck();
    return v;
  }
  function releaseFish(uid) {
    var s = S(), f = fishByUid(uid);
    if (!f) return false;
    removeFish(f);
    st('released');
    if (s.bestiary[f.sp]) s.bestiary[f.sp].released++;
    dirty();
    emit('aquarium:changed', { tankId: f.tank, uid: uid, removed: true });
    postCheck();
    return true;
  }
  function moveFish(uid, tankId) {
    var s = S(), f = fishByUid(uid), tk = tankById(tankId);
    if (!f || !tk) return false;
    if (f.tank === tankId) return true;
    if (!AQ.aquarium.canFit(f.sp, tk, s)) return false;
    var from = f.tank;
    f.tank = tankId;
    dirty();
    emit('aquarium:changed', { tankId: from, uid: uid, removed: true });
    emit('aquarium:changed', { tankId: tankId, uid: uid });
    postCheck();
    return true;
  }
  function renameFish(uid, name) {
    var f = fishByUid(uid);
    if (!f) return false;
    var n = name === null || name === undefined ? '' : String(name).replace(/[\u0000-\u001f<>]/g, '').trim();
    if (n.length > NAME_MAX) n = n.slice(0, NAME_MAX);
    f.name = n || null;
    dirty();
    emit('aquarium:changed', { tankId: f.tank, uid: uid });
    return true;
  }

  // ---------------------------------------------------------------- tanks
  function feedTank(tankId) {
    var s = S(), tk = tankById(tankId);
    if (!tk) return false;
    var cost = AQ.economy.feedCost(tk, s);
    if (s.player.coins < cost) { emit('shop:denied', { itemId: 'feed', reason: 'coins', tankId: tankId }); return false; }
    s.player.coins -= cost;
    st('coinsSpent', cost);
    tk.food = 1;
    tk.foodLowSec = 0;
    st('fed');
    dirty();
    emit('aquarium:fed', { tankId: tankId, cost: cost });
    wallet(-cost, 0, 'feed');
    postCheck();
    return true;
  }
  function collectTill() {
    var s = S(), amount = Math.floor(s.aquarium.till || 0);
    if (amount <= 0) return 0;
    s.aquarium.till = 0;
    s.player.coins += amount;
    st('tillCollected', amount); st('tillCollects'); st('coinsEarned', amount);
    dirty();
    emit('aquarium:collected', { amount: amount });
    emit('aquarium:till', { till: 0 });
    wallet(amount, 0, 'till');
    postCheck();
    return amount;
  }
  // placeDecor(tankId, slot 0..4, decorId|null) → bool. The replaced item returns to the inventory.
  function placeDecor(tankId, slot, decorId) {
    var s = S(), tk = tankById(tankId), p = s.player;
    if (!tk || !(slot >= 0 && slot < E.TANK_SLOTS) || (slot | 0) !== slot) return false;
    var old = tk.decor[slot] || null;
    if (decorId) {
      if (!AQ.items.DECOR[decorId]) return false;
      if (decorId === old) return true;
      if (!(p.decor[decorId] > 0)) return false;
      if (decorId === 'ostra') for (var i = 0; i < tk.decor.length; i++) if (i !== slot && tk.decor[i] === 'ostra') return false;
      p.decor[decorId]--;
    } else if (!old) {
      return true;
    }
    if (old) p.decor[old] = (p.decor[old] || 0) + 1;
    tk.decor[slot] = decorId || null;
    dirty();
    emit('aquarium:changed', { tankId: tankId, slot: slot });
    emit('inventory:changed', { kind: 'decor', id: decorId || old });
    postCheck();
    return true;
  }
  // setTankLight(tankId, light?) → the new light. Without a valid light it cycles day → dim → night.
  function setTankLight(tankId, light) {
    var tk = tankById(tankId);
    if (!tk) return null;
    var L = E.LIGHT;
    tk.light = L.indexOf(light) >= 0 ? light : L[(L.indexOf(tk.light) + 1) % L.length];
    dirty();
    emit('aquarium:changed', { tankId: tankId, light: tk.light });
    return tk.light;
  }

  // ---------------------------------------------------------------- tick / offline
  var aqRng = null, aqSeed = null;
  function rng() {
    var seed = (S().meta && S().meta.seed) || 1;
    if (!aqRng || aqSeed !== seed) { aqSeed = seed; aqRng = AQ.rng.create((seed ^ AQ.rng.hash('aquarium')) >>> 0); }
    return aqRng;
  }

  // Emits the bus events for AQ.aquarium.tick results. Returns the wallet delta.
  function emitTick(evs, reason) {
    var dc = 0, dp = 0, changed = {}, k;
    for (var i = 0; i < evs.length; i++) {
      var e = evs[i];
      switch (e.type) {
        case 'fed': dc -= e.cost || 0; emit('aquarium:fed', { tankId: e.tankId, auto: true, cost: e.cost, n: e.n || 1 }); break;
        case 'warning': emit('aquarium:warning', { tankId: e.tankId, kind: e.kind, sp: e.sp, prey: e.prey }); break;
        case 'predation':
          emit('aquarium:predation', { tankId: e.tankId, predator: e.predator, prey: e.prey, uid: e.uid });
          changed[e.tankId] = 1; break;
        case 'bred': emit('aquarium:bred', { tankId: e.tankId, uid: e.uid, sp: e.sp, dense: e.dense }); changed[e.tankId] = 1; break;
        case 'grown': changed[e.tankId] = 1; break;
        case 'produced':
          emit('aquarium:produced', { tankId: e.tankId, item: e.item, qty: e.qty });
          emit('inventory:changed', { kind: 'bait', id: e.item }); break;
        case 'pearl': dp += e.qty; emit('aquarium:produced', { tankId: e.tankId, item: 'pearl', qty: e.qty }); break;
        case 'till': emit('aquarium:till', { till: e.till }); break;
      }
    }
    for (k in changed) emit('aquarium:changed', { tankId: k });
    if (dc || dp) wallet(dc, dp, reason);
    return { dCoins: dc, dPearls: dp };
  }

  // tick(dtSec): online simulation step (A's loop calls it every second in map / fishing / aquarium).
  function tick(dtSec) {
    var s = S();
    if (!s || !s.aquarium) return [];
    var evs = AQ.aquarium.tick(s, dtSec, rng(), { offline: false });
    emitTick(evs, 'aquarium');
    postCheck();
    return evs;
  }

  // applyOffline(nowMs) → summary | null. away = now − meta.lastActive; nothing under 60 s.
  // summary = {awayMs, coins (added to the till), pearls, capped, feedCost, events}; also emits 'offline:summary'.
  function applyOffline(nowMs) {
    var s = S(), t = typeof nowMs === 'number' ? nowMs : now();
    var last = s.meta.lastActive || 0;
    if (!last) { s.meta.lastActive = t; return null; }
    var away = t - last;
    if (!(away >= 60000)) return null;
    var earn = AQ.economy.offlineEarnings(s, away);
    var till0 = s.aquarium.till || 0, pearls0 = s.player.pearls;
    var evs = AQ.aquarium.tick(s, away / 1000, rng(), { offline: true });
    s.meta.lastActive = t;
    var w = emitTick(evs, 'offline');
    var summary = {
      awayMs: away, coins: (s.aquarium.till || 0) - till0, pearls: s.player.pearls - pearls0,
      capped: earn.capped, feedCost: -w.dCoins, events: evs
    };
    G.lastOffline = summary;
    dirty();
    emit('offline:summary', summary);
    postCheck();
    return summary;
  }

  function stat(name, delta) {
    if (!name) return 0;
    st(name, delta === undefined ? 1 : delta);
    dirty();
    postCheck();
    return S().stats[name];
  }

  function wait(phase) {
    var m = AQ.world && AQ.world.advanceTo ? AQ.world.advanceTo(S(), phase) : 0;
    dirty();
    return m || 0;
  }

  // setZone(zoneId): the current fishing zone (persisted in player.zone); changing zone resets luck (D extension).
  function setZone(zoneId) {
    var p = S().player;
    if (E.ZONES.indexOf(zoneId) < 0) return false;
    if (p.zone !== zoneId) { p.zone = zoneId; dirty(); }
    if (luckZone !== zoneId) resetLuck();
    return true;
  }

  // ---------------------------------------------------------------- bus listeners (stats from C's events)
  function listen() {
    var ev = AQ.events;
    if (!ev) return;
    ev.on('fish:cast', function () { st('casts'); dirty(); });
    ev.on('bite:miss', function (p) { if (p && (p.reason === 'early' || p.reason === 'late')) { st(p.reason); dirty(); } });
    ev.on('fight:start', function () { st('bites'); dirty(); postCheck(); });
    ev.on('fight:end', function (p) {
      if (!p) return;
      var s = S();
      if (E.ESCAPE.indexOf(p.result) >= 0) { st('escapes'); if (p.result === 'snap') st('snaps'); }
      if (typeof p.sec === 'number' && p.sec > (s.stats.longestFight || 0)) s.stats.longestFight = Math.round(p.sec * 10) / 10;
      dirty();
      postCheck();
    });
    ev.on('fish:stop', function (p) {
      var s = S();
      if (p && typeof p.depthM === 'number' && p.depthM > (s.progress.maxDepthM || 0)) {
        s.progress.maxDepthM = Math.round(p.depthM);
        dirty();
        postCheck();
      }
    });
    ev.on('frenzy:start', function () { frenzy.on = true; frenzy.n = 0; });
    ev.on('frenzy:end', function () { frenzy.on = false; frenzy.n = 0; });
    ev.on('app:ready', function () { applyOffline(now()); postCheck(); });
    ev.on('app:visible', function (p) { if (!p || !(p.awayMs < 60000)) applyOffline(now()); });
    ev.on('save:reset', function () { resetLuck(); frenzy.on = false; frenzy.n = 0; postCheck(); });
  }

  var G = AQ.game = {
    newGame: newGame,
    resolveCatch: resolveCatch,
    markSeen: markSeen,
    markSighting: markSighting,
    foundMessage: foundMessage,
    bottleCoins: bottleCoins,
    buy: buy,
    equipBait: equipBait,
    consumeBait: consumeBait,
    addBait: addBait,
    sellFish: sellFish,
    releaseFish: releaseFish,
    moveFish: moveFish,
    renameFish: renameFish,
    feedTank: feedTank,
    collectTill: collectTill,
    placeDecor: placeDecor,
    setTankLight: setTankLight,
    tick: tick,
    applyOffline: applyOffline,
    stat: stat,
    wait: wait,
    luck: luck,
    addLuck: addLuck,
    resetLuck: resetLuck,
    // extensions (see notes/D.md)
    catchInfo: catchInfo,
    setZone: setZone,
    ownsBait: ownsBait,
    allMessagesFound: allMessagesFound,
    fishByUid: fishByUid,
    tankById: tankById,
    fishIn: function (tankId) { return S().aquarium.fish.filter(function (f) { return f.tank === tankId; }); },
    check: postCheck,
    inFrenzy: function () { return frenzy.on; },
    lastOffline: null,
    NAME_MAX: NAME_MAX
  };
  listen();
})(window.AQ);
