// Água-Tinta — world clock, weather and light (owner B). §5.2–5.4, §15.11.
'use strict';
module.exports = function (T) {
  T.test('phase boundaries at 05:00, 07:00, 17:00, 19:00', () => {
    const W = T.load().AQ.world;
    T.eq([W.phaseOf(299), W.phaseOf(300), W.phaseOf(419), W.phaseOf(420)], ['noite', 'amanhecer', 'amanhecer', 'dia']);
    T.eq([W.phaseOf(1019), W.phaseOf(1020), W.phaseOf(1139), W.phaseOf(1140)], ['dia', 'entardecer', 'entardecer', 'noite']);
    T.eq([W.phaseOf(0), W.phaseOf(1440 + 600), W.phaseOf(-1)], ['noite', 'dia', 'noite']);
  });

  T.test('new game: day 0, 05:30, limpo; now() fields', () => {
    const { AQ } = T.load();
    const n = AQ.world.now(T.state());
    T.eq([n.minutes, n.day, n.hour, n.minute, n.phase, n.weather], [330, 0, 5, 30, 'amanhecer', 'limpo']);
  });

  T.test('tick adds realSec × MIN_PER_SEC minutes and emits coalesced events', () => {
    const { AQ } = T.load({ fresh: true });
    const s = AQ.store.defaults();
    s.world.rng = 12345;
    const seen = [];
    AQ.events.on('world:phase', (p) => seen.push(p.phase));
    let evs = AQ.world.tick(s, 1);
    T.eq(s.world.minutes, 331);
    T.eq(evs.length, 0);
    evs = AQ.world.tick(s, 89); // → 07:00
    T.eq(s.world.minutes, 420);
    T.ok(evs.some((e) => e.type === 'phase' && e.phase === 'dia' && e.prev === 'amanhecer'));
    T.eq(seen, ['dia']);
  });

  T.test('advanceTo lands on the next phase start', () => {
    const { AQ } = T.load();
    const s = T.state();
    T.eq(AQ.world.advanceTo(s, 'noite'), 810);
    T.eq(s.world.minutes, 1140);
    T.eq(AQ.world.now(s).phase, 'noite');
    T.eq(AQ.world.advanceTo(s, 'noite'), 0, 'already at the start');
    s.world.minutes = 1200; // 20:00
    T.eq(AQ.world.advanceTo(s, 'noite'), 1380);
    T.eq(AQ.world.now(s).minutes, 1140);
    T.eq(AQ.world.now(s).day, 1);
    T.eq(AQ.world.advanceTo(s, 'amanhecer'), 600);
  });

  function run(AQ, seed, days) {
    const s = AQ.store.defaults();
    s.world.rng = seed;
    const share = { limpo: 0, nublado: 0, chuva: 0, tempestade: 0 }, trans = [];
    let prev = s.world.weather;
    for (let m = 0; m < days * 1440; m += 10) {
      AQ.world.advance(s, 10, null, false);
      share[s.world.weather] += 10;
      if (s.world.weather !== prev) { trans.push(prev + '>' + s.world.weather); prev = s.world.weather; }
    }
    return { share, trans, s };
  }

  T.test('never limpo → tempestade directly; long-run storm share 8–18%', () => {
    const { AQ } = T.load();
    const { share, trans } = run(AQ, 777, 400);
    T.ok(!trans.includes('limpo>tempestade'), 'no limpo → tempestade');
    const total = Object.values(share).reduce((a, b) => a + b, 0);
    const storm = share.tempestade / total;
    T.ok(storm >= 0.08 && storm <= 0.18, 'storm share ' + storm.toFixed(3));
    const st = AQ.world.stationary();
    T.ok(st.tempestade >= 0.08 && st.tempestade <= 0.18);
  });

  T.test('weather and forecast are deterministic from the seed; slots 180–360 min', () => {
    const { AQ } = T.load();
    const a = run(AQ, 4242, 30), b = run(AQ, 4242, 30);
    T.eq(a.trans, b.trans);
    T.eq(a.s.world, b.s.world);
    T.eq(AQ.world.forecast(a.s), a.s.world.forecast.slice(0, 3));
    T.eq(AQ.world.forecast(a.s, 5).length, 5);
    const s = AQ.store.defaults();
    s.world.rng = 99;
    let lastEnd = s.world.slotEnd;
    for (let i = 0; i < 2000; i++) {
      AQ.world.advance(s, 30, null, false);
      if (s.world.slotEnd !== lastEnd) {
        const d = s.world.slotEnd - lastEnd;
        T.ok(d >= 180 && d <= 360, 'slot ' + d);
        lastEnd = s.world.slotEnd;
      }
      T.eq(s.world.forecast.length, 3);
    }
  });

  T.test('light and darkness', () => {
    const { AQ } = T.load();
    const s = T.state();
    s.world.minutes = 720; s.world.weather = 'limpo';
    T.near(AQ.world.light(s, 'baia', 0), 1, 1e-9);
    T.near(AQ.world.light(s, 'baia', 1), 0.45, 1e-9);
    T.ok(!AQ.world.isDark(s, 'baia', 0.5));
    T.ok(AQ.world.isDark(s, 'abismo', 0.2) && !AQ.world.isDark(s, 'abismo', 0.1));
    T.ok(AQ.world.isDark(s, 'mar', 0.75) && !AQ.world.isDark(s, 'mar', 0.5));
    s.world.weather = 'tempestade';
    T.near(AQ.world.light(s, 'baia', 0), 0.55, 1e-9);
    s.world.minutes = 1320; s.world.weather = 'limpo'; // 22:00
    T.near(AQ.world.light(s, 'baia', 0), 0.25, 1e-9);
    T.ok(!AQ.world.isDark(s, 'baia', 0.3) && AQ.world.isDark(s, 'baia', 0.6), 'night below 50%');
    T.ok(AQ.world.isDark(s, 'kelp', 0.45) && AQ.world.isDark(s, 'abismo', 0));
    s.world.minutes = 360; // dawn
    T.near(AQ.world.light(s, 'baia', 0), 0.6, 1e-9);
    for (let m = 0; m < 1440; m += 5) {
      s.world.minutes = m;
      const v = AQ.world.light(s, 'recife', 0.3);
      T.ok(v >= 0 && v <= 1);
    }
  });
};
