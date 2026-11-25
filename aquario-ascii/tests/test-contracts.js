// Água-Tinta — contract tests (owner A): §15.5 pure namespaces exist with the right member types;
// pure files load without document and define no globals other than AQ.
'use strict';
module.exports = function (T) {
  function typeOk(v, type) {
    if (type === 'any') return v !== undefined;
    if (type === 'array') return Array.isArray(v);
    if (type === 'object') return v !== null && typeof v === 'object';
    return typeof v === type;
  }

  T.test('pure files load in a bare context (no document) without throwing', () => {
    const ctx = T.load({ fresh: true });
    T.ok(ctx.AQ, 'AQ defined');
    T.ok(ctx.scripts.length >= 26, 'core + data + logic scripts: ' + ctx.scripts.length);
    T.ok(!('document' in ctx.window), 'no document');
  });

  T.test('no pure file defines globals other than AQ', () => {
    const ctx = T.load({ fresh: true });
    T.eq(ctx.globals, ['AQ']);
  });

  T.test('every pure namespace in §15.5 has its contract members', () => {
    const { AQ } = T.load();
    const missing = [];
    for (const ns of Object.keys(AQ.CONTRACTS)) {
      const spec = AQ.CONTRACTS[ns];
      if (!spec.pure) continue;
      const obj = AQ[ns];
      if (obj === undefined || obj === null || typeof obj !== 'object') { missing.push(ns); continue; }
      if (!spec.api) continue;
      for (const entry of spec.api.split(/\s+/)) {
        const [name, type = 'function'] = entry.split(':');
        if (!typeOk(obj[name], type)) missing.push(ns + '.' + name + ' (' + type + ')');
      }
    }
    T.eq(missing, [], 'missing or mistyped');
  });

  T.test('Rng instances expose the full API', () => {
    const { AQ } = T.load();
    const r = AQ.rng.create(1);
    for (const m of 'next int irange range chance pick weighted normal shuffle fork getState setState'.split(' ')) {
      T.ok(typeof r[m] === 'function', 'Rng.' + m);
    }
    T.ok(typeof AQ.rng.global.next === 'function');
  });

  T.test('namespace constants (§15.4)', () => {
    const { AQ } = T.load();
    T.eq(AQ.VERSION, '1.0.0'); T.eq(AQ.SAVE_VERSION, 1); T.eq(AQ.ASPECT, 2);
    T.eq(AQ.STORAGE_KEYS, { save: 'aquario-ascii.save', backup: 'aquario-ascii.save.bak', settings: 'aquario-ascii.settings' });
    T.eq(Object.keys(AQ.THEMES).sort(), ['noite', 'noiteHC', 'papel', 'papelHC']);
    for (const k of ['RARITY', 'RARITY_W', 'SIZE', 'SIZE_COST', 'SIZE_MAX', 'ZONES', 'PHASES', 'WEATHER', 'BAITS', 'LURES', 'HABITAT',
      'LIGHT', 'DIET', 'KIND', 'BEHAVIOR', 'FIGHT', 'GEAR', 'ESCAPE', 'SIGHTINGS', 'QUALITY', 'SCENES']) {
      T.ok(AQ.ENUM[k] !== undefined, 'ENUM.' + k);
    }
    T.eq(AQ.ENUM.SPECIES.length, 42);
    T.eq(new Set(AQ.ENUM.SPECIES).size, 42, 'unique species ids');
    T.eq(AQ.ENUM.SIZE_COST.XXL, Infinity);
    T.ok(Object.isFrozen(AQ.ENUM) && Object.isFrozen(AQ.ENUM.ZONES), 'ENUM frozen');
    T.eq(AQ.CHARSET.sprite.length, 95 + 14);
    T.ok(AQ.CHARSET.sprite.indexOf('°') >= 0 && AQ.CHARSET.sprite.indexOf('\t') < 0);
  });

  T.test('util basics', () => {
    const { AQ } = T.load();
    const U = AQ.util;
    T.eq(U.clamp(5, 0, 3), 3); T.eq(U.lerp(0, 10, 0.25), 2.5); T.eq(U.invLerp(0, 10, 5), 0.5);
    T.eq(U.smoothstep(0, 1, 0.5), 0.5); T.eq(U.wrap(-1, 5), 4); T.eq(U.sign(-3), -1);
    T.near(U.damp(0, 10, 6, 10), 10, 1e-6);
    T.eq(U.fmtClock(330), '05:30'); T.eq(U.fmtClock(1440 + 61), '01:01'); T.eq(U.fmtClock(-1), '23:59');
    for (let i = 0; i < 500; i++) {
      const a = U.noise1(i * 0.37), b = U.noise2(i * 0.31, i * 0.17), c = U.noise3(i * 0.2, i * 0.3, i * 0.1), d = U.fbm2(i * 0.1, i * 0.07);
      T.ok(a >= 0 && a <= 1 && b >= 0 && b <= 1 && c >= 0 && c <= 1 && d >= 0 && d <= 1, 'noise in [0,1]');
    }
    T.eq(U.noise2(1.5, 2.5), U.noise2(1.5, 2.5), 'fixed seed');
    const acc = { t: 0 };
    let steps = 0;
    T.eq(U.fixedStep(acc, 0.05, 1 / 60, () => steps++), 3);
    T.eq(U.fixedStep(acc, 10, 1 / 60, () => steps++), 8, 'max 8 per call');
    T.ok(acc.t < 1 / 60);
    T.eq(U.utf8Decode(U.utf8Bytes('ção 🐟 °')), 'ção 🐟 °');
    T.eq(U.b64encode(U.utf8Bytes('Man')), 'TWFu');
    T.eq(U.b64encode(U.utf8Bytes('Ma')), 'TWE=');
    T.eq(U.utf8Decode(U.b64decode('TWE=')), 'Ma');
    T.eq(U.hex8(U.crc32('123456789')), 'cbf43926', 'crc32 check value');
    const o = { a: [1, { b: 2 }] }, c2 = U.deepClone(o);
    T.eq(c2, o); T.ok(c2.a[1] !== o.a[1]);
  });

  T.test('textart', () => {
    const { AQ } = T.load();
    const X = AQ.textart;
    const atum = [
      '        __/\\__     ',
      ' \\\\  _.-\'      \'-._',
      "  >=(    )))    ° >",
      ' //  \'-.__    __.-\'',
      '        \\/  \\/     ',
    ];
    const m = X.mirror(atum);
    T.eq(X.mirror(m), X.pad(atum), 'mirror(mirror) === original');
    T.eq(m[2].trim().slice(0, 3), '< °'.slice(0, 3));
    T.eq(X.mirrorLine('><°>'), '<°><');
    T.eq(X.mirrorLine('(d[{`'), '´}]b)');
    T.eq(X.width(['a', 'abc']), 3); T.eq(X.height(['a', 'b']), 2);
    T.eq(X.pad(['a', 'abc']), ['a  ', 'abc']);
    T.eq(X.silhouette([' ab ', 'c d']), [' ·· ', '· ·']);
    T.eq(X.densify(['.,-\'`~o']), [':;="\"=O']);
    T.eq(X.autoMask([' ab c ', '      ', 'x']), ['.xxxx.', '......', 'x.....']);
    T.eq(X.badChars(['ok°', 'tab\there', '─']), ['\t', '─']);
    T.eq(X.badChars(['ação'], AQ.CHARSET.text), []);
  });

  T.test('events', () => {
    const { AQ } = T.load({ fresh: true });
    const E = AQ.events, log = [];
    const off = E.on('x', (p) => log.push('a' + p.v));
    E.once('x', (p) => log.push('once' + p.v));
    E.on('x', () => { throw new Error('boom'); });
    E.on('x', (p) => log.push('c' + p.v));
    const origErr = console.error; console.error = () => {};
    try { E.emit('x', { v: 1 }); E.emit('x', { v: 2 }); } finally { console.error = origErr; }
    T.eq(log, ['a1', 'once1', 'c1', 'a2', 'c2'], 'errors are isolated; once fires once');
    off();
    const f = () => log.push('f');
    E.on('y', f); E.off('y', f); E.emit('y', {});
    T.eq(log.indexOf('f'), -1);
    E.clear(); E.emit('x', { v: 3 });
    T.eq(log.length, 5);
  });

  T.test('i18n', () => {
    const { AQ } = T.load({ fresh: true });
    const I = AQ.i18n;
    I.add('pt-BR', { test: { hello: 'Olá, {name}!', fish: { one: '{n} peixe', other: '{n} peixes' }, only: 'só pt' } });
    I.add('en', { 'test.hello': 'Hello, {name}!', 'test.fish.one': '{n} fish', 'test.fish.other': '{n} fish' });
    T.eq(I.t('test.hello', { name: 'Iara' }), 'Olá, Iara!');
    T.eq(I.t('test.missing'), '[test.missing]');
    T.eq(I.tn('test.fish', 1), '1 peixe'); T.eq(I.tn('test.fish', 3), '3 peixes');
    T.eq(I.num(1250.5, 1), '1.250,5'); T.eq(I.money(1250), '$ 1.250'); T.eq(I.pearls(12), '@ 12'); T.eq(I.pct(0.78), '78%');
    T.ok(I.has('test.only') && !I.has('test.only', 'en'));
    let ev = null;
    AQ.events.on('lang:changed', (p) => { ev = p; });
    T.ok(I.setLang('en')); T.eq(ev, { lang: 'en' });
    T.eq(I.setLang('xx'), false);
    T.eq(I.t('test.hello', { name: 'Iara' }), 'Hello, Iara!');
    T.eq(I.t('test.only'), 'só pt', 'falls back to pt-BR');
    T.eq(I.num(1250.5, 1), '1,250.5'); T.eq(I.money(1234567), '$ 1,234,567');
    T.eq(I.tn('test.fish', 2000), '2,000 fish');
    T.ok(typeof I.date(Date.UTC(2026, 0, 2, 12)) === 'string');
    T.ok(I.keys('en').indexOf('test.hello') >= 0);
  });
};
