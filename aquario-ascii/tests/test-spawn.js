// Água-Tinta — spawn tables, specimen roll and creature behaviour (owner B). §5.5, §6.7, §6.8, §4.5, §15.11.
'use strict';
module.exports = function (T) {
  const ctxs = (AQ) => {
    const out = [];
    for (const phase of AQ.ENUM.PHASES) for (const weather of AQ.ENUM.WEATHER) for (const bait of ['massa', 'minhoca', 'lula', 'luminosa', 'colher', 'jig', 'papel', 'perola']) out.push({ phase, weather, bait, luck: 0 });
    return out;
  };

  T.test('pick returns only valid, non-legendary species of the zone whose conditions are met', () => {
    const { AQ } = T.load();
    const rng = AQ.rng.create('pick');
    const bad = [];
    for (const z of AQ.ENUM.ZONES) for (const ctx of ctxs(AQ)) for (let i = 0; i < 30; i++) {
      const id = AQ.spawn.pick(z, ctx, rng);
      if (id === null) continue;
      const sp = AQ.species.get(id);
      if (!sp || !sp.zones.includes(z) || sp.rarity === 'L' || !AQ.spawn.conditionsMet(sp, ctx)) bad.push(z + ':' + id);
    }
    T.eq(bad, []);
    T.ok(AQ.spawn.table('baia', { phase: 'dia', weather: 'limpo', bait: 'massa' }).every((r) => r.w > 0));
  });

  T.test('rarity ratios within ±15% of the weights over 50k picks', () => {
    const { AQ } = T.load();
    const rng = AQ.rng.create('ratio');
    for (const [z, ctx] of [['baia', { phase: 'dia', weather: 'limpo', bait: 'minhoca' }], ['mar', { phase: 'dia', weather: 'tempestade', bait: 'lula', luck: 0.2 }], ['abismo', { phase: 'noite', weather: 'chuva', bait: 'luminosa' }]]) {
      const tbl = AQ.spawn.table(z, ctx), total = tbl.reduce((a, r) => a + r.w, 0), exp = {}, got = {};
      for (const r of tbl) { const k = AQ.species.get(r.id).rarity; exp[k] = (exp[k] || 0) + r.w / total; }
      const N = 50000;
      for (let i = 0; i < N; i++) { const k = AQ.species.get(AQ.spawn.pick(z, ctx, rng)).rarity; got[k] = (got[k] || 0) + 1 / N; }
      for (const k of Object.keys(exp)) T.ok(Math.abs(got[k] - exp[k]) <= 0.15 * exp[k], z + ' ' + k + ' ' + got[k].toFixed(4) + ' vs ' + exp[k].toFixed(4));
      T.ok(!got.L, 'no legendary from pick');
    }
  });

  T.test('weights: rarity, weather multipliers, bait, luck, siri at night', () => {
    const { AQ } = T.load();
    const w = (id, ctx) => AQ.spawn.weightOf(id, ctx);
    T.eq(w('manjuba', { phase: 'dia', weather: 'nublado', bait: 'papel' }), 100);
    T.near(w('manjuba', { phase: 'dia', weather: 'limpo', bait: 'massa' }), 100 * 1.2 * 1.6, 1e-9);
    T.near(w('agulha', { phase: 'dia', weather: 'chuva', bait: 'colher' }), 35 * 1.3 * 1.75, 1e-9);
    T.near(w('leao', { phase: 'dia', weather: 'tempestade', bait: 'massa', luck: 0.25 }), 8 * 1.5 * 1.25, 1e-9);
    T.near(w('siri', { phase: 'noite', weather: 'nublado', bait: 'massa' }), 100 * 1.4 * 2, 1e-9);
    T.eq(w('tainha', { phase: 'noite', weather: 'limpo', bait: 'massa' }), 0);
    T.eq(w('marlim', { phase: 'entardecer', weather: 'limpo', bait: 'colher' }), 0);
  });

  T.test('legendaryReady needs bait, time and weather', () => {
    const { AQ } = T.load();
    const r = (z, c) => AQ.spawn.legendaryReady(z, c);
    T.eq(r('baia', { phase: 'amanhecer', weather: 'chuva', bait: 'papel' }), 'tipografo');
    T.eq(r('baia', { phase: 'dia', weather: 'limpo', bait: 'papel' }), null);
    T.eq(r('baia', { phase: 'amanhecer', weather: 'limpo', bait: 'massa' }), null);
    T.eq(r('mar', { phase: 'entardecer', weather: 'limpo', bait: 'colher' }), 'marlim');
    T.eq(r('mar', { phase: 'entardecer', weather: 'nublado', bait: 'colher' }), null);
    T.eq(r('abismo', { phase: 'noite', weather: 'limpo', bait: 'jig' }), 'celacanto');
    T.eq(r('abismo', { phase: 'noite', weather: 'tempestade', bait: 'perola' }), 'tinteira');
    T.eq(r('abismo', { phase: 'noite', weather: 'chuva', bait: 'perola' }), null);
    T.eq(r('abismo', { phase: 'dia', weather: 'tempestade', bait: 'perola' }), null);
  });

  T.test('schoolSize', () => {
    const { AQ } = T.load();
    const rng = AQ.rng.create(5);
    for (let i = 0; i < 200; i++) {
      const a = AQ.spawn.schoolSize('manjuba', rng), b = AQ.spawn.schoolSize('atum', rng);
      T.ok(a >= 4 && a <= 8 && b >= 3 && b <= 5);
    }
    T.eq(AQ.spawn.schoolSize('baiacu', rng), 1);
  });

  T.test('rollSpecimen: length range, kg formula, trophy ⇔ q ≥ .9, deterministic', () => {
    const { AQ } = T.load();
    for (const sp of AQ.species.list) {
      const rng = AQ.rng.create('spec:' + sp.id);
      for (let i = 0; i < 200; i++) {
        const s = AQ.spawn.rollSpecimen(sp.id, { bait: i % 2 ? 'lula' : 'massa', zone: sp.zones[0] }, rng);
        T.ok(s.sp === sp.id && s.len >= sp.len[0] && s.len <= sp.len[1], sp.id + ' len');
        const kg = sp.kgMax * Math.pow(s.len / sp.len[1], 3);
        T.ok(s.kg > 0 && Math.abs(s.kg - kg) <= Math.max(0.006, kg * 0.006), sp.id + ' kg ' + s.kg + ' vs ' + kg);
        T.eq(s.trophy, s.q >= 0.9);
        T.ok(s.q >= 0 && s.q < 1 && typeof s.dense === 'boolean' && s.zone === sp.zones[0] && typeof s.at === 'number');
      }
    }
    const a = AQ.spawn.rollSpecimen('baiacu', { bait: 'massa' }, AQ.rng.create(9));
    const b = AQ.spawn.rollSpecimen('baiacu', { bait: 'massa' }, AQ.rng.create(9));
    a.at = b.at = 0;
    T.eq(a, b);
  });

  T.test('dense rate ≈ 1/64 ±20% over 200k; trophy rate ≈ 6% at qExp 1.6', () => {
    const { AQ } = T.load();
    const rng = AQ.rng.create('dense');
    let dense = 0, trophy = 0;
    const N = 200000;
    for (let i = 0; i < N; i++) { const s = AQ.spawn.rollSpecimen('manjuba', { bait: 'massa' }, rng); if (s.dense) dense++; if (s.trophy) trophy++; }
    T.ok(Math.abs(dense / N - 1 / 64) <= 0.2 / 64, 'dense ' + dense / N);
    T.ok(Math.abs(trophy / N - Math.pow(0.9, 1 / 1.6) * 0 - (1 - Math.pow(0.9, 1 / 1.6))) < 0.005, 'trophy ' + trophy / N);
  });

  // ------------------------------------------------------------------ creatures
  function wildEnv(AQ, extra) {
    const ev = [];
    const env = Object.assign({
      mode: 'wild', t: 0, rng: AQ.rng.create('env'), bounds: { x0: 0, y0: 0, x1: 60, y1: 70 }, surfaceY: 0, depth: 70,
      floorY: (x) => AQ.zones.floorY('baia', x), covers: [{ x0: 20, y0: 58, x1: 28, y1: 66, kind: 'rocks' }],
      hook: null, food: [], visibility: () => 1, phase: 'dia', frenzy: false,
      onEvent: (type, c, data) => ev.push({ type, sp: c.sp, data }),
    }, extra || {});
    return { env, ev };
  }

  T.test('every species and sighting creates, updates and stays finite in wild, tank and title modes', () => {
    const { AQ } = T.load();
    const C = AQ.creatures;
    const ids = AQ.species.ids().concat(AQ.ENUM.SIGHTINGS);
    for (const mode of ['wild', 'tank', 'title']) {
      const rng = AQ.rng.create('modes:' + mode);
      const { env } = wildEnv(AQ, { mode, food: mode === 'tank' ? [{ x: 30, y: 30, id: 1 }] : [], light: 'night' });
      const list = ids.map((id, i) => C.create(id, { x: 5 + (i % 10) * 5, y: 10 + (i % 5) * 10, mode }, rng));
      for (const c of list) {
        T.ok(c.uid > 0 && c.w >= 1 && c.h >= 1 && (c.dir === 1 || c.dir === -1), c.sp);
        T.ok(typeof c.data === 'object' && c.hooked === false);
      }
      for (let i = 0; i < 600; i++) C.update(list, 1 / 60, env);
      for (const c of list) T.ok(isFinite(c.x) && isFinite(c.y) && isFinite(c.vx) && isFinite(c.vy), mode + ' ' + c.sp);
      if (mode !== 'wild') T.eq(list.length, ids.length, mode + ': nobody despawns');
      const b = C.bounds(list[0], {});
      T.ok(b.x1 - b.x0 === list[0].w && C.hitTest(list[0], list[0].x, list[0].y));
    }
  });

  T.test('school + hook: notice → nibble(s) → bite; setHooked; spook spreads to the school', () => {
    const { AQ } = T.load();
    const C = AQ.creatures, rng = AQ.rng.create(3);
    const list = C.createSchool('manjuba', 6, { x: 10, y: 20, dir: 1, mode: 'wild' }, rng);
    T.eq(list.length, 6);
    T.ok(list.every((c) => c.data.school === list[0].data.school));
    const { env, ev } = wildEnv(AQ, { hook: { x: 22, y: 20, bait: 'massa', moving: false, active: true } });
    let bitten = null;
    for (let i = 0; i < 60 * 30 && !bitten; i++) {
      C.update(list, 1 / 60, env);
      if (ev.some((e) => e.type === 'bite')) bitten = C.engaged(list);
    }
    T.ok(ev.some((e) => e.type === 'notice'), 'noticed');
    T.ok(bitten && bitten.state === 'bite', 'bit');
    const firstBite = ev.findIndex((e) => e.type === 'bite');
    T.ok(ev.slice(0, firstBite).filter((e) => e.type === 'nibble').length <= 1, 'wariness 1 → at most 1 nibble');
    C.setHooked(bitten, true);
    T.ok(bitten.hooked && C.engaged(list) === bitten);
    for (let i = 0; i < 120; i++) C.update(list, 1 / 60, env);
    T.eq(ev.filter((e) => e.type === 'bite').length, 1, 'no second bite while one is hooked');
    C.setHooked(bitten, false);
    T.eq(bitten.state, 'flee');
    const other = list.find((c) => c !== bitten);
    C.spook(other, 8);
    T.ok(other.data.ignoreT >= 8 && list.filter((c) => c !== other && c.data.ignoreT >= 4).length >= 4, 'school spooked');
  });

  T.test('ignores baits with no affinity; frenzy skips nibbles; static lure does not bite', () => {
    const { AQ } = T.load();
    const C = AQ.creatures;
    const run = (id, hook, extra, secs) => {
      const rng = AQ.rng.create('aff:' + id + hook.bait);
      const c = C.create(id, { x: 25, y: 30, mode: 'wild', dir: 1 }, rng);
      const { env, ev } = wildEnv(AQ, Object.assign({ hook }, extra));
      const list = [c];
      for (let i = 0; i < 60 * secs; i++) C.update(list, 1 / 60, env);
      return ev;
    };
    T.ok(!run('baiacu', { x: 28, y: 30, bait: 'massa', moving: false, active: true }, {}, 10).some((e) => e.type === 'notice'), 'massa ignored by baiacu');
    const fr = run('baiacu', { x: 28, y: 30, bait: 'camarao', moving: false, active: true }, { frenzy: true }, 15);
    T.ok(fr.some((e) => e.type === 'bite') && !fr.some((e) => e.type === 'nibble'), 'frenzy: immediate bite');
    const st = run('agulha', { x: 28, y: 5, bait: 'colher', moving: false, active: true }, {}, 15);
    T.ok(!st.some((e) => e.type === 'bite'), 'static lure: no bite');
  });

  T.test('wild creatures leave and are removed; tank fish eat flakes once', () => {
    const { AQ } = T.load();
    const C = AQ.creatures, rng = AQ.rng.create(11);
    const c = C.create('agulha', { x: 30, y: 5, mode: 'wild', dir: 1 }, rng);
    const list = [c];
    const { env, ev } = wildEnv(AQ);
    for (let i = 0; i < 60 * 150 && list.length; i++) C.update(list, 1 / 60, env);
    T.eq(list.length, 0, 'despawned');
    T.ok(ev.some((e) => e.type === 'leave' && e.data.reason === 'despawn'));
    const tank = [C.create('palhaco', { x: 10, y: 10, mode: 'tank' }, rng), C.create('palhaco', { x: 12, y: 10, mode: 'tank' }, rng)];
    const food = [{ x: 20, y: 12, id: 7 }];
    const t = wildEnv(AQ, { mode: 'tank', bounds: { x0: 0, y0: 0, x1: 40, y1: 24 }, depth: 24, floorY: () => 22, food,
      onEvent: (type, cc, d) => { if (type === 'eat') { t.ev.push(d.id); food.length = 0; } } });
    for (let i = 0; i < 60 * 20 && food.length; i++) C.update(tank, 1 / 60, t.env);
    T.eq(t.ev, [7]);
  });

  T.test('update stays cheap: 60 creatures × 600 frames', () => {
    const { AQ } = T.load();
    const C = AQ.creatures, rng = AQ.rng.create(1);
    const ids = ['manjuba', 'tainha', 'baiacu', 'siri', 'arraia', 'agulha', 'aguaviva', 'atum', 'lula', 'leao'];
    const list = [];
    for (let i = 0; i < 60; i++) list.push(C.create(ids[i % ids.length], { x: rng.range(0, 60), y: rng.range(5, 60), mode: 'wild' }, rng));
    list.forEach((c) => { c.data.leaveAt = 1e9; });
    const { env } = wildEnv(AQ, { hook: { x: 30, y: 30, bait: 'minhoca', moving: true, active: true } });
    const t0 = Date.now();
    for (let i = 0; i < 600; i++) C.update(list, 1 / 60, env);
    const ms = (Date.now() - t0) / 600;
    T.ok(ms < 1.5, 'ms per update ' + ms.toFixed(3));
  });
};
