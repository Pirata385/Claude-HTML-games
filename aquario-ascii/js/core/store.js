// Água-Tinta — persistence: AQ.store (save), AQ.settings, AQ.state (owner A). Pure at load time:
// storage is only touched at call time, through AQ.store.backend (localStorage or an in-memory fallback).
(function (AQ) {
  'use strict';

  var U = AQ.util;
  var KEYS = AQ.STORAGE_KEYS;

  // ================================================================ backend
  function memoryBackend() {
    var m = Object.create(null);
    return {
      kind: 'memory',
      getItem: function (k) { return k in m ? m[k] : null; },
      setItem: function (k, v) { m[k] = String(v); },
      removeItem: function (k) { delete m[k]; }
    };
  }
  var resolved = null;
  function resolveBackend() {
    if (resolved) return resolved;
    try {
      var ls = (typeof window !== 'undefined') ? window.localStorage : null;
      if (ls) {
        var probe = '__aq_probe__';
        ls.setItem(probe, '1');
        ls.removeItem(probe);
        resolved = ls;
        return resolved;
      }
    } catch (e) { /* blocked (file://, privacy mode) → memory */ }
    resolved = memoryBackend();
    return resolved;
  }
  // Lazy wrapper; tests may replace AQ.store.backend with any {getItem,setItem,removeItem}.
  var lazyBackend = {
    getItem: function (k) { try { return resolveBackend().getItem(k); } catch (e) { return null; } },
    setItem: function (k, v) { resolveBackend().setItem(k, v); },
    removeItem: function (k) { try { resolveBackend().removeItem(k); } catch (e) { /* ignore */ } }
  };
  function be() { return store.backend || lazyBackend; }
  function getRaw(k) { try { return be().getItem(k); } catch (e) { return null; } }
  function setRaw(k, v) { try { be().setItem(k, v); return true; } catch (e) { return false; } }

  // ================================================================ save schema v1 (§15.8)
  function defaults() {
    return {
      v: 1,
      meta: { created: 0, lastSaved: 0, lastActive: 0, playSec: 0, seed: 0, build: AQ.VERSION },
      player: {
        coins: 50, pearls: 0,
        gear: { rod: 1, line: 1, reel: 1, hook: 1, lantern: 0, boat: 1 },
        baits: { massa: -1, minhoca: 10, camarao: 0, lula: 0, luminosa: 0, papel: 0, perola: 0 },
        lures: { colher: false, jig: false },
        bait: 'massa',
        decor: {
          pedras: 0, algas: 0, coral: 0, anemona: 0, kelp: 0, gruta: 0, castelo: 0, ostra: 0,
          bau: 0, naufragio: 0, ruina: 0, farol: 0
        },
        unlocks: { papel: false, perola: false, paperTheme: false },
        cofre: 1,
        zone: 'baia'
      },
      world: { minutes: 330, weather: 'limpo', slotEnd: 600, forecast: ['limpo', 'nublado', 'limpo'], rng: 0 },
      aquarium: {
        tanks: [{
          id: 't1', cap: 1, filter: 1, feeder: false, light: 'day', food: 1,
          decor: [null, null, null, null, null], foodLowSec: 0, breedSec: 0, produceSec: 0, pearlSec: 0
        }],
        fish: [],
        till: 0, tillCarry: 0, nextUid: 1
      },
      bestiary: {},
      sightings: {},
      messages: {},
      progress: { zones: ['baia'], goal: 0, goalsDone: {}, goalBase: {}, ach: {}, stars: 1, ending: false, endingAt: 0, maxDepthM: 0 },
      stats: {
        casts: 0, bites: 0, early: 0, late: 0, catches: 0, escapes: 0, snaps: 0, kept: 0, sold: 0, released: 0,
        coinsEarned: 0, coinsSpent: 0, tillCollected: 0, fed: 0, bred: 0, legendaries: 0, longestFight: 0,
        nightCatches: 0, stormCatches: 0, frenzyBest: 0, jelliesClean: 0
      },
      tutorial: { step: 0, done: false, notes: {}, hints: {} }
    };
  }

  function randomSeed() {
    return (AQ.rng.hash(String(U.now()) + ':' + Math.random()) ^ (Math.floor(Math.random() * 4294967296) >>> 0)) >>> 0;
  }

  // Fresh state for a new game: defaults with created/lastActive/seed filled in.
  function fresh() {
    var s = defaults(), t = U.now();
    s.meta.created = t;
    s.meta.lastActive = t;
    s.meta.seed = randomSeed();
    s.world.rng = AQ.rng.hash('world:' + s.meta.seed);
    return s;
  }

  // Replace AQ.state's contents in place, so references held by other modules stay valid.
  function replaceState(next) {
    var cur = AQ.state;
    Object.keys(cur).forEach(function (k) { delete cur[k]; });
    Object.keys(next).forEach(function (k) { cur[k] = next[k]; });
    return cur;
  }

  // ================================================================ migrations
  // MIGRATIONS[toVersion] = fn(obj) → obj. migrate() runs them in order and sets obj.v after each step.
  var MIGRATIONS = {
    1: function (obj) { return obj; } // unversioned (v0) → v1: deepMerge with defaults fills the rest
  };
  function migrate(obj, toVersion) {
    var target = toVersion === undefined ? AQ.SAVE_VERSION : toVersion;
    var v = typeof obj.v === 'number' ? obj.v : 0;
    while (v < target) {
      var fn = store.MIGRATIONS[v + 1];
      if (typeof fn !== 'function') throw new Error('missing migration to v' + (v + 1));
      obj = fn(obj) || obj;
      v = v + 1;
      obj.v = v;
    }
    return obj;
  }

  // ================================================================ load / save
  // Parses and upgrades a raw save string. → {ok, state?, error?:'json'|'shape'|'future'|'migrate'}
  function parseSave(raw) {
    var obj;
    try { obj = JSON.parse(raw); } catch (e) { return { ok: false, error: 'json' }; }
    if (!U.isPlainObject(obj)) return { ok: false, error: 'shape' };
    if (typeof obj.v === 'number' && obj.v > AQ.SAVE_VERSION) return { ok: false, error: 'future' };
    var needsMigration = typeof obj.v !== 'number' || obj.v < AQ.SAVE_VERSION;
    try { obj = migrate(obj); } catch (e) { return { ok: false, error: 'migrate' }; }
    U.deepMerge(obj, defaults());
    return { ok: true, state: obj, migrated: needsMigration };
  }

  // load() → SaveState. Sets AQ.state (in place). Corrupt or future saves: raw copied to .bak, fresh state,
  // store.loadError = 'json'|'shape'|'future'|'migrate' and 'save:invalid' {error} is emitted (E toasts it).
  function load() {
    var raw = getRaw(KEYS.save);
    store.loadError = null;
    store.dirty = false;
    if (raw === null || raw === undefined || raw === '') {
      store.existed = false;
      replaceState(fresh());
      return AQ.state;
    }
    store.existed = true;
    var res = parseSave(raw);
    if (!res.ok) {
      setRaw(KEYS.backup, raw);
      store.loadError = res.error;
      store.existed = false;
      replaceState(fresh());
      if (AQ.events) AQ.events.emit('save:invalid', { error: res.error });
      return AQ.state;
    }
    if (res.migrated) setRaw(KEYS.backup, raw); // before any migration is persisted, keep the original
    if (!res.state.meta.seed) res.state.meta.seed = randomSeed();
    replaceState(res.state);
    return AQ.state;
  }

  function save(reason) {
    var s = AQ.state;
    if (!s || !s.meta) return false;
    var t = U.now();
    s.meta.lastSaved = t;
    s.meta.lastActive = t;
    s.meta.build = AQ.VERSION;
    var str;
    try { str = JSON.stringify(s); } catch (e) { return false; }
    if (!setRaw(KEYS.save, str)) return false;
    store.dirty = false;
    store.existed = true;
    if (AQ.events) AQ.events.emit('save:written', { reason: reason || 'manual' });
    return true;
  }

  function markDirty() { store.dirty = true; }
  function flush(reason) { return store.dirty ? save(reason) : false; }
  function hasSave() { var r = getRaw(KEYS.save); return r !== null && r !== undefined && r !== ''; }

  // Copies the current persisted save string to .bak. → bool
  function backup() {
    var raw = getRaw(KEYS.save);
    if (raw === null || raw === undefined || raw === '') return false;
    return setRaw(KEYS.backup, raw);
  }
  function readBackup() { return getRaw(KEYS.backup); }

  // reset() → SaveState. Keeps settings; backs up the old save; emits 'save:reset'.
  function reset() {
    backup();
    replaceState(fresh());
    save('reset');
    if (AQ.events) AQ.events.emit('save:reset', {});
    return AQ.state;
  }

  // ================================================================ export / import
  function exportString() {
    var json = JSON.stringify(AQ.state);
    var bytes = U.utf8Bytes(json);
    return 'AT1:' + U.b64encode(bytes) + ':' + U.hex8(U.crc32(bytes));
  }
  // → {ok:true} | {ok:false, error:'format'|'checksum'|'json'|'shape'|'future'|'migrate'}
  function importString(str) {
    if (typeof str !== 'string') return { ok: false, error: 'format' };
    var s = str.replace(/\s+/g, '');
    var m = /^AT1:([A-Za-z0-9+/=]+):([0-9a-fA-F]{8})$/.exec(s);
    if (!m) return { ok: false, error: 'format' };
    var bytes = U.b64decode(m[1]);
    if (!bytes) return { ok: false, error: 'format' };
    if (U.hex8(U.crc32(bytes)) !== m[2].toLowerCase()) return { ok: false, error: 'checksum' };
    var res = parseSave(U.utf8Decode(bytes));
    if (!res.ok) return { ok: false, error: res.error };
    backup();
    replaceState(res.state);
    save('import');
    return { ok: true };
  }

  // ================================================================ autosave (browser; main.js calls start)
  var autosaveTimer = null, autosaveOffs = [];
  function startAutosave(intervalMs) {
    stopAutosave();
    if (typeof setInterval === 'function') {
      autosaveTimer = setInterval(function () { flush('auto'); }, intervalMs || 15000);
    }
    if (AQ.events) autosaveOffs.push(AQ.events.on('app:hidden', function () { save('hidden'); }));
  }
  function stopAutosave() {
    if (autosaveTimer !== null && typeof clearInterval === 'function') clearInterval(autosaveTimer);
    autosaveTimer = null;
    autosaveOffs.forEach(function (off) { off(); });
    autosaveOffs = [];
  }

  var store = AQ.store = {
    backend: lazyBackend,
    MIGRATIONS: MIGRATIONS,
    dirty: false,
    existed: false,      // true when a valid save was loaded or written
    loadError: null,     // set by load(): null | 'json' | 'shape' | 'future' | 'migrate'
    defaults: defaults,
    fresh: fresh,
    load: load,
    save: save,
    markDirty: markDirty,
    flush: flush,
    hasSave: hasSave,
    backup: backup,
    readBackup: readBackup,
    reset: reset,
    migrate: migrate,
    parseSave: parseSave,
    exportString: exportString,
    importString: importString,
    startAutosave: startAutosave,
    stopAutosave: stopAutosave,
    memoryBackend: memoryBackend,
    replaceState: replaceState
  };

  // The live SaveState (defaults until load()). Its identity never changes: load/reset/import replace contents.
  AQ.state = defaults();

  // ================================================================ settings (§14)
  var DEFAULTS = {
    lang: 'pt-BR',
    volMaster: 0.8, volMusic: 0.55, volSfx: 0.8, volAmbience: 0.6,
    quality: 'auto',
    reducedMotion: 'auto',
    motionStyle: 'fluid',
    glyphSize: 'auto',
    uiScale: 1,
    highContrast: false,
    theme: 'noite',
    haptics: true,
    showFps: false,
    hints: true,
    handedness: 'right',
    autoSteer: false,
    wideWindows: false
  };
  Object.freeze(DEFAULTS);
  var SCHEMA = {
    lang: { e: ['pt-BR', 'en'] },
    volMaster: { n: [0, 1] }, volMusic: { n: [0, 1] }, volSfx: { n: [0, 1] }, volAmbience: { n: [0, 1] },
    quality: { e: ['auto', 'high', 'medium', 'low'] },
    reducedMotion: { e: ['auto', 'on', 'off'] },
    motionStyle: { e: ['fluid', 'grid'] },
    glyphSize: { e: ['auto', 11, 12, 14, 16, 18, 20] },
    uiScale: { snap: [0.85, 1, 1.15, 1.3] },
    highContrast: { b: 1 }, theme: { e: ['noite', 'papel'] }, haptics: { b: 1 }, showFps: { b: 1 }, hints: { b: 1 },
    handedness: { e: ['right', 'left'] },
    autoSteer: { b: 1 }, wideWindows: { b: 1 }
  };

  // → {ok, value}
  function validate(key, value) {
    var sc = SCHEMA[key];
    if (!sc) return { ok: false };
    if (sc.b) {
      if (typeof value === 'boolean') return { ok: true, value: value };
      if (value === 'true' || value === 1) return { ok: true, value: true };
      if (value === 'false' || value === 0) return { ok: true, value: false };
      return { ok: false };
    }
    if (sc.n) {
      var n = typeof value === 'number' ? value : (typeof value === 'string' && value.trim() !== '' ? Number(value) : NaN);
      if (!isFinite(n)) return { ok: false };
      return { ok: true, value: U.clamp(n, sc.n[0], sc.n[1]) };
    }
    if (sc.snap) {
      var x = typeof value === 'number' ? value : (typeof value === 'string' && value.trim() !== '' ? Number(value) : NaN);
      if (!isFinite(x)) return { ok: false };
      var best = sc.snap[0];
      for (var i = 1; i < sc.snap.length; i++) if (Math.abs(sc.snap[i] - x) < Math.abs(best - x)) best = sc.snap[i];
      return { ok: true, value: best };
    }
    if (sc.e) {
      for (var j = 0; j < sc.e.length; j++) {
        var opt = sc.e[j];
        if (opt === value) return { ok: true, value: opt };
        if (typeof opt === 'number' && typeof value === 'string' && value.trim() !== '' && Number(value) === opt) return { ok: true, value: opt };
      }
      return { ok: false };
    }
    return { ok: false };
  }

  var values = U.deepClone(DEFAULTS);

  function persistSettings() {
    var out = { v: AQ.SETTINGS_VERSION };
    for (var k in values) out[k] = values[k];
    return setRaw(KEYS.settings, JSON.stringify(out));
  }

  function paperUnlocked() {
    return !!(AQ.state && AQ.state.player && AQ.state.player.unlocks && AQ.state.player.unlocks.paperTheme);
  }

  function applySideEffects(key, value) {
    if (key === 'lang' && AQ.i18n) AQ.i18n.setLang(value);
  }

  // set(key, value) → the stored value after validation (unchanged when invalid). Persists and emits
  // 'settings:changed' {key, value} when the value changes. theme 'papel' needs player.unlocks.paperTheme.
  function set(key, value) {
    if (!Object.prototype.hasOwnProperty.call(DEFAULTS, key)) return undefined;
    var r = validate(key, value);
    if (!r.ok) return values[key];
    if (key === 'theme' && r.value === 'papel' && !paperUnlocked()) return values[key];
    if (values[key] === r.value) return values[key];
    values[key] = r.value;
    persistSettings();
    applySideEffects(key, r.value);
    if (AQ.events) AQ.events.emit('settings:changed', { key: key, value: r.value });
    return r.value;
  }
  function get(key) { return values[key]; }
  function all() { return U.deepClone(values); }

  // Loads persisted settings: unknown keys dropped, invalid values → defaults. Does not emit events.
  function loadSettings() {
    values = U.deepClone(DEFAULTS);
    var raw = getRaw(KEYS.settings);
    if (raw) {
      var obj = null;
      try { obj = JSON.parse(raw); } catch (e) { obj = null; }
      if (U.isPlainObject(obj)) {
        for (var k in DEFAULTS) {
          if (!Object.prototype.hasOwnProperty.call(obj, k)) continue;
          var r = validate(k, obj[k]);
          if (r.ok) values[k] = r.value;
        }
      }
    }
    if (AQ.i18n) AQ.i18n.setLang(values.lang, { silent: true });
    return all();
  }

  // reset() → defaults; persists; emits 'settings:changed' for every key that changed.
  function resetSettings() {
    var prev = values;
    values = U.deepClone(DEFAULTS);
    persistSettings();
    for (var k in values) {
      if (prev[k] !== values[k]) {
        applySideEffects(k, values[k]);
        if (AQ.events) AQ.events.emit('settings:changed', { key: k, value: values[k] });
      }
    }
    return all();
  }

  AQ.settings = {
    DEFAULTS: DEFAULTS,
    SCHEMA: SCHEMA,
    validate: validate,
    get: get,
    set: set,
    all: all,
    reset: resetSettings,
    load: loadSettings,
    persist: persistSettings
  };
})(window.AQ);
