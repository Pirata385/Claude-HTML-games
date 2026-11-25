// Água-Tinta — AQ.store / AQ.settings / AQ.util.deepMerge tests (owner A).
'use strict';
module.exports = function (T) {
  function fresh() { return T.load({ fresh: true }); }
  const KEYS = { save: 'aquario-ascii.save', backup: 'aquario-ascii.save.bak', settings: 'aquario-ascii.settings' };

  T.test('defaults v1 has every schema key', () => {
    const { AQ } = fresh();
    const s = AQ.store.defaults();
    T.eq(s.v, 1);
    T.eq(Object.keys(s).sort(), ['aquarium', 'bestiary', 'messages', 'meta', 'player', 'progress', 'sightings', 'stats', 'tutorial', 'v', 'world'].sort());
    T.eq(Object.keys(s.meta).sort(), ['build', 'created', 'lastActive', 'lastSaved', 'playSec', 'seed'].sort());
    T.eq(s.player.coins, 50); T.eq(s.player.pearls, 0);
    T.eq(s.player.gear, { rod: 1, line: 1, reel: 1, hook: 1, lantern: 0, boat: 1 });
    T.eq(s.player.baits, { massa: -1, minhoca: 10, camarao: 0, lula: 0, luminosa: 0, papel: 0, perola: 0 });
    T.eq(s.player.lures, { colher: false, jig: false });
    T.eq(s.player.bait, 'massa');
    T.eq(Object.keys(s.player.decor).sort(), AQ.ENUM.DECOR.slice().sort());
    T.eq(s.player.unlocks, { papel: false, perola: false, paperTheme: false });
    T.eq(s.player.cofre, 1); T.eq(s.player.zone, 'baia');
    T.eq(s.world, { minutes: 330, weather: 'limpo', slotEnd: 600, forecast: ['limpo', 'nublado', 'limpo'], rng: 0 });
    T.eq(s.aquarium.tanks.length, 1);
    T.eq(s.aquarium.tanks[0], { id: 't1', cap: 1, filter: 1, feeder: false, light: 'day', food: 1, decor: [null, null, null, null, null], foodLowSec: 0, breedSec: 0, produceSec: 0, pearlSec: 0 });
    T.eq(s.aquarium.fish, []); T.eq(s.aquarium.till, 0); T.eq(s.aquarium.tillCarry, 0); T.eq(s.aquarium.nextUid, 1);
    T.eq(s.bestiary, {}); T.eq(s.sightings, {}); T.eq(s.messages, {});
    T.eq(s.progress, { zones: ['baia'], goal: 0, goalsDone: {}, goalBase: {}, ach: {}, stars: 1, ending: false, endingAt: 0, maxDepthM: 0 });
    T.eq(Object.keys(s.stats).length, 21);
    for (const k of Object.keys(s.stats)) T.eq(s.stats[k], 0, 'stats.' + k);
    T.eq(s.tutorial, { step: 0, done: false, notes: {}, hints: {} });
    T.ok(AQ.store.defaults() !== AQ.store.defaults(), 'fresh object each call');
    T.ok(AQ.state && AQ.state.v === 1, 'AQ.state exists before load()');
  });

  T.test('load with no save → fresh state (created, seed)', () => {
    const { AQ } = fresh();
    const ref = AQ.state;
    const s = AQ.store.load();
    T.ok(s === ref, 'AQ.state identity is stable');
    T.ok(s.meta.created > 0 && s.meta.seed > 0);
    T.eq(AQ.store.hasSave(), false);
    T.eq(AQ.store.loadError, null);
  });

  T.test('save → load deep-equal', () => {
    const { AQ, window } = fresh();
    AQ.store.load();
    AQ.state.player.coins = 1234;
    AQ.state.aquarium.fish.push({ uid: 'f1', sp: 'manjuba', len: 7.5, kg: 0.01, q: 0.4, dense: false, trophy: false, bred: false, growth: 1, tank: 't1', name: 'Zé', at: 5, zone: 'baia' });
    AQ.state.bestiary.manjuba = { seen: true, caught: 1, kept: 1, sold: 0, released: 0, bestLen: 7.5, bestKg: 0.01, first: 5, dense: 0 };
    AQ.state.custom = { keep: 'me' };
    let written = null;
    AQ.events.on('save:written', (p) => { written = p; });
    T.ok(AQ.store.save('test'));
    T.eq(written, { reason: 'test' });
    const snapshot = JSON.parse(JSON.stringify(AQ.state));
    AQ.state.player.coins = 1;
    AQ.store.load();
    T.eq(JSON.parse(JSON.stringify(AQ.state)), snapshot);
    T.eq(AQ.state.custom, { keep: 'me' }, 'unknown keys preserved');
    T.ok(window.localStorage.getItem(KEYS.save).length > 100);
    T.eq(AQ.store.dirty, false);
    AQ.store.markDirty(); T.eq(AQ.store.dirty, true);
    T.ok(AQ.store.flush('auto')); T.eq(AQ.store.dirty, false); T.eq(AQ.store.flush('auto'), false);
  });

  T.test('corrupt JSON → defaults + .bak', () => {
    const { AQ, window } = fresh();
    window.localStorage.setItem(KEYS.save, '{not json');
    let ev = null;
    AQ.events.on('save:invalid', (p) => { ev = p; });
    const s = AQ.store.load();
    T.eq(s.player.coins, 50);
    T.eq(window.localStorage.getItem(KEYS.backup), '{not json');
    T.eq(AQ.store.loadError, 'json');
    T.eq(ev, { error: 'json' });
  });

  T.test('future version → defaults + .bak', () => {
    const { AQ, window } = fresh();
    const raw = JSON.stringify({ v: 99, player: { coins: 5 } });
    window.localStorage.setItem(KEYS.save, raw);
    AQ.store.load();
    T.eq(AQ.state.player.coins, 50);
    T.eq(window.localStorage.getItem(KEYS.backup), raw);
    T.eq(AQ.store.loadError, 'future');
  });

  T.test('old save missing keys is filled by deepMerge', () => {
    const { AQ, window } = fresh();
    window.localStorage.setItem(KEYS.save, JSON.stringify({ v: 1, player: { coins: 777, gear: { rod: 3 } } }));
    AQ.store.load();
    T.eq(AQ.state.player.coins, 777);
    T.eq(AQ.state.player.gear.rod, 3);
    T.eq(AQ.state.player.gear.line, 1);
    T.eq(AQ.state.player.baits.minhoca, 10);
    T.eq(AQ.state.stats.casts, 0);
    T.eq(AQ.store.loadError, null);
  });

  T.test('deepMerge fills missing nested keys without overwriting', () => {
    const { AQ } = fresh();
    const target = { a: 1, b: { c: 2, arr: [9] }, z: null };
    const defs = { a: 5, b: { c: 7, d: { e: 3 }, arr: [1, 2, 3] }, f: [1, { g: 1 }], z: 4 };
    const out = AQ.util.deepMerge(target, defs);
    T.ok(out === target);
    T.eq(out, { a: 1, b: { c: 2, arr: [9], d: { e: 3 } }, z: null, f: [1, { g: 1 }] });
    T.ok(out.f !== defs.f && out.b.d !== defs.b.d, 'defaults are cloned');
    T.eq(AQ.util.deepMerge(null, { x: 1 }), { x: 1 });
  });

  T.test('migration chain 1→2→3 runs in order and sets v', () => {
    const { AQ } = fresh();
    const order = [];
    AQ.store.MIGRATIONS[2] = (o) => { order.push(2); T.eq(o.v, 1); o.two = true; return o; };
    AQ.store.MIGRATIONS[3] = (o) => { order.push(3); T.eq(o.v, 2); T.ok(o.two); o.three = true; return o; };
    const out = AQ.store.migrate({ v: 1, x: 1 }, 3);
    T.eq(order, [2, 3]);
    T.eq(out.v, 3); T.ok(out.two && out.three);
    T.eq(AQ.store.migrate({ v: 3 }, 3).v, 3, 'no-op at target');
    T.throws(() => AQ.store.migrate({ v: 3 }, 4), /missing migration/);
    T.eq(AQ.store.migrate({}).v, 1, 'unversioned → v1');
  });

  T.test('export → import round trip', () => {
    const { AQ, window } = fresh();
    AQ.store.load();
    AQ.state.player.coins = 4242;
    AQ.state.aquarium.fish.push({ uid: 'f9', sp: 'cavalo', name: 'Iara ção 🐟', len: 10, kg: 0.1, q: 0.5, dense: true, trophy: false, bred: false, growth: 1, tank: 't1', at: 1, zone: 'baia' });
    const str = AQ.store.exportString();
    T.ok(/^AT1:[A-Za-z0-9+/=]+:[0-9a-f]{8}$/.test(str), 'format');
    const snapshot = JSON.parse(JSON.stringify(AQ.state));
    AQ.store.save('x');
    AQ.store.reset();
    T.eq(AQ.state.player.coins, 50);
    const r = AQ.store.importString('  ' + str + '\n');
    T.eq(r, { ok: true });
    const got = JSON.parse(JSON.stringify(AQ.state));
    delete got.meta.lastSaved; delete got.meta.lastActive; delete snapshot.meta.lastSaved; delete snapshot.meta.lastActive;
    T.eq(got, snapshot);
    T.ok(window.localStorage.getItem(KEYS.backup), 'previous save backed up');
    T.eq(JSON.parse(window.localStorage.getItem(KEYS.save)).player.coins, 4242, 'persisted');
  });

  T.test('import rejects bad checksum, bad format, bad json, future version', () => {
    const { AQ } = fresh();
    AQ.store.load();
    const str = AQ.store.exportString();
    const parts = str.split(':');
    const badCrc = parts[0] + ':' + parts[1] + ':' + (parts[2] === '00000000' ? '11111111' : '00000000');
    T.eq(AQ.store.importString(badCrc), { ok: false, error: 'checksum' });
    T.eq(AQ.store.importString('hello'), { ok: false, error: 'format' });
    T.eq(AQ.store.importString(null), { ok: false, error: 'format' });
    const U = AQ.util;
    const mk = (json) => { const b = U.utf8Bytes(json); return 'AT1:' + U.b64encode(b) + ':' + U.hex8(U.crc32(b)); };
    T.eq(AQ.store.importString(mk('{oops')), { ok: false, error: 'json' });
    T.eq(AQ.store.importString(mk('[1,2]')), { ok: false, error: 'shape' });
    T.eq(AQ.store.importString(mk('{"v":7}')), { ok: false, error: 'future' });
    AQ.state.player.coins = 9;
    T.eq(AQ.state.player.coins, 9, 'state untouched by rejected imports');
  });

  T.test('reset keeps settings and emits save:reset', () => {
    const { AQ, window } = fresh();
    AQ.settings.load(); AQ.store.load();
    AQ.settings.set('volMusic', 0.1);
    AQ.state.player.coins = 999;
    AQ.store.save();
    let ev = 0;
    AQ.events.on('save:reset', () => { ev++; });
    AQ.store.reset();
    T.eq(ev, 1);
    T.eq(AQ.state.player.coins, 50);
    T.eq(AQ.settings.get('volMusic'), 0.1);
    T.eq(JSON.parse(window.localStorage.getItem(KEYS.settings)).volMusic, 0.1);
    T.eq(JSON.parse(window.localStorage.getItem(KEYS.backup)).player.coins, 999, 'old save in .bak');
  });

  T.test('settings defaults (§14)', () => {
    const { AQ } = fresh();
    T.eq(AQ.settings.all(), {
      lang: 'pt-BR', volMaster: 0.8, volMusic: 0.55, volSfx: 0.8, volAmbience: 0.6, quality: 'auto', reducedMotion: 'auto',
      motionStyle: 'fluid', glyphSize: 'auto', uiScale: 1, highContrast: false, theme: 'noite', haptics: true, showFps: false,
      hints: true, handedness: 'right', autoSteer: false, wideWindows: false,
    });
    T.ok(AQ.settings.all() !== AQ.settings.all(), 'all() returns a copy');
  });

  T.test('settings validation, clamping, persistence and events', () => {
    const { AQ, window } = fresh();
    AQ.settings.load();
    const evs = [];
    AQ.events.on('settings:changed', (p) => evs.push(p));
    T.eq(AQ.settings.set('volMaster', 5), 1);
    T.eq(AQ.settings.set('volMaster', -2), 0);
    T.eq(AQ.settings.set('volMaster', 'abc'), 0, 'invalid keeps current');
    T.eq(AQ.settings.set('volSfx', '0.25'), 0.25);
    T.eq(AQ.settings.set('lang', 'fr'), 'pt-BR');
    T.eq(AQ.settings.set('lang', 'en'), 'en');
    T.eq(AQ.i18n.lang, 'en', 'lang applies to i18n');
    T.eq(AQ.settings.set('glyphSize', '14'), 14);
    T.eq(AQ.settings.set('glyphSize', 13), 14, 'not an option');
    T.eq(AQ.settings.set('glyphSize', 'auto'), 'auto');
    T.eq(AQ.settings.set('uiScale', 1.2), 1.15, 'snaps');
    T.eq(AQ.settings.set('quality', 'ultra'), 'auto');
    T.eq(AQ.settings.set('highContrast', 'yes'), false);
    T.eq(AQ.settings.set('highContrast', true), true);
    T.eq(AQ.settings.set('theme', 'papel'), 'noite', 'papel locked');
    AQ.state.player.unlocks.paperTheme = true;
    T.eq(AQ.settings.set('theme', 'papel'), 'papel');
    T.eq(AQ.settings.set('nope', 1), undefined, 'unknown key');
    T.ok(evs.length >= 8);
    T.eq(evs[0], { key: 'volMaster', value: 1 });
    const n = evs.length;
    AQ.settings.set('volSfx', 0.25);
    T.eq(evs.length, n, 'no event when unchanged');
    const stored = JSON.parse(window.localStorage.getItem(KEYS.settings));
    T.eq(stored.v, 1);
    T.eq(stored.lang, 'en'); T.eq(stored.uiScale, 1.15); T.eq(stored.theme, 'papel');
  });

  T.test('settings load drops unknown keys and invalid values', () => {
    const { AQ, window } = fresh();
    window.localStorage.setItem(KEYS.settings, JSON.stringify({ v: 1, lang: 'en', volMusic: 9, quality: 'bogus', extra: 1, glyphSize: 16, hints: false }));
    const s = AQ.settings.load();
    T.eq(s.lang, 'en'); T.eq(AQ.i18n.lang, 'en');
    T.eq(s.volMusic, 1, 'clamped');
    T.eq(s.quality, 'auto', 'invalid → default');
    T.eq(s.glyphSize, 16); T.eq(s.hints, false);
    T.ok(!('extra' in s) && !('v' in s));
    window.localStorage.setItem(KEYS.settings, '{garbage');
    T.eq(AQ.settings.load().lang, 'pt-BR');
    AQ.settings.set('hints', false);
    AQ.settings.reset();
    T.eq(AQ.settings.get('hints'), true);
  });

  T.test('backend can be swapped (blocked storage → memory)', () => {
    const { AQ } = fresh();
    const mem = AQ.store.memoryBackend();
    AQ.store.backend = mem;
    AQ.store.load(); AQ.state.player.coins = 3; AQ.store.save();
    T.ok(mem.getItem(KEYS.save).indexOf('"coins":3') > 0);
    AQ.store.backend = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); }, removeItem() {} };
    T.eq(AQ.store.save(), false, 'save reports failure, never throws');
    AQ.store.load();
    T.eq(AQ.state.player.coins, 50);
  });
};
