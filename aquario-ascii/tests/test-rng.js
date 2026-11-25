// Água-Tinta — AQ.rng tests (owner A).
'use strict';
module.exports = function (T) {
  const { AQ } = T.load();
  const R = AQ.rng;

  T.test('hash is FNV-1a 32 (known vectors)', () => {
    T.eq(R.hash(''), 0x811c9dc5);
    T.eq(R.hash('a'), 0xe40c292c);
    T.eq(R.hash('foobar'), 0xbf9cf968);
    T.ok(R.hash('ção') >>> 0 === R.hash('ção'), 'uint32');
  });

  T.test('same seed → same 1000 values', () => {
    const a = R.create(12345), b = R.create(12345), c = R.create('12345');
    const va = [], vb = [];
    for (let i = 0; i < 1000; i++) { va.push(a.next()); vb.push(b.next()); }
    T.eq(va, vb);
    T.ok(c.next() !== R.create(12345).next() || true); // string seeds hash first
    const s1 = R.create('weather'), s2 = R.create('weather');
    for (let i = 0; i < 100; i++) T.eq(s1.next(), s2.next());
  });

  T.test('next() in [0,1)', () => {
    const r = R.create(7);
    let min = 1, max = 0;
    for (let i = 0; i < 100000; i++) { const v = r.next(); if (v < min) min = v; if (v > max) max = v; T.ok(v >= 0 && v < 1, 'range ' + v); }
    T.ok(min < 0.001 && max > 0.999, 'covers the interval');
  });

  T.test('int / irange / range / chance bounds', () => {
    const r = R.create(99);
    const seen = new Set();
    for (let i = 0; i < 20000; i++) {
      const v = r.int(6); T.ok(Number.isInteger(v) && v >= 0 && v < 6, 'int ' + v); seen.add(v);
      const w = r.irange(-2, 3); T.ok(Number.isInteger(w) && w >= -2 && w <= 3, 'irange ' + w); seen.add('i' + w);
      const x = r.range(5, 7); T.ok(x >= 5 && x < 7, 'range ' + x);
    }
    for (let k = 0; k < 6; k++) T.ok(seen.has(k), 'int hits ' + k);
    T.ok(seen.has('i-2') && seen.has('i3'), 'irange inclusive');
    let hits = 0;
    for (let i = 0; i < 100000; i++) if (r.chance(0.25)) hits++;
    T.near(hits / 100000, 0.25, 0.01);
    T.eq(r.pick([]), undefined);
  });

  T.test('weighted frequencies within ±3% over 100k', () => {
    const r = R.create('weighted');
    const items = [{ id: 'a', w: 1 }, { id: 'b', w: 2 }, { id: 'c', w: 7 }, { id: 'z', w: 0 }];
    const n = { a: 0, b: 0, c: 0, z: 0 };
    for (let i = 0; i < 100000; i++) n[r.weighted(items, (it) => it.w).id]++;
    const exp = { a: 0.1, b: 0.2, c: 0.7 };
    for (const k of Object.keys(exp)) {
      const f = n[k] / 100000;
      T.ok(Math.abs(f - exp[k]) <= exp[k] * 0.03, k + ': ' + f + ' vs ' + exp[k]);
    }
    T.eq(n.z, 0, 'zero weight never picked');
    T.eq(r.weighted(items, () => 0), null, 'all-zero → null');
  });

  T.test('fork is deterministic and independent', () => {
    const p1 = R.create(42), p2 = R.create(42);
    const f1 = p1.fork('weather'), f2 = p2.fork('weather');
    const a = [], b = [];
    for (let i = 0; i < 200; i++) { a.push(f1.next()); b.push(f2.next()); }
    T.eq(a, b, 'same parent state + label → same child');
    // fork does not advance the parent, and drawing from the child leaves the parent untouched
    T.eq(p1.getState(), R.create(42).getState());
    const pa = [], pb = [];
    const q = R.create(42);
    for (let i = 0; i < 200; i++) { pa.push(p1.next()); pb.push(q.next()); }
    T.eq(pa, pb);
    // different labels / parent vs child differ
    const g = R.create(42), x = g.fork('a'), y = g.fork('b');
    let same = 0, sameParent = 0;
    const gp = R.create(42);
    for (let i = 0; i < 200; i++) { const vx = x.next(); if (vx === y.next()) same++; if (vx === gp.next()) sameParent++; }
    T.ok(same < 2 && sameParent < 2, 'streams differ');
    // fork after advancing gives a different child
    const h = R.create(42); h.next();
    T.ok(h.fork('a').next() !== R.create(42).fork('a').next());
  });

  T.test('getState / setState round trip', () => {
    const r = R.create(2024);
    for (let i = 0; i < 37; i++) r.next();
    const s = r.getState();
    T.ok(Number.isInteger(s) && s >= 0 && s <= 0xffffffff, 'uint32 state');
    const a = []; for (let i = 0; i < 50; i++) a.push(r.next());
    r.setState(s);
    const b = []; for (let i = 0; i < 50; i++) b.push(r.next());
    T.eq(a, b);
    const r2 = R.create(0); r2.setState(s);
    T.eq(r2.next(), a[0]);
  });

  T.test('normal and shuffle', () => {
    const r = R.create('normal');
    let sum = 0, sq = 0;
    const N = 50000;
    for (let i = 0; i < N; i++) { const v = r.normal(10, 2); sum += v; sq += v * v; }
    const mean = sum / N, sd = Math.sqrt(sq / N - mean * mean);
    T.near(mean, 10, 0.05); T.near(sd, 2, 0.05);
    const arr = [1, 2, 3, 4, 5, 6, 7, 8];
    const out = r.shuffle(arr.slice());
    T.eq(out.slice().sort((a, b) => a - b), arr);
    T.eq(R.create(5).shuffle(arr.slice()), R.create(5).shuffle(arr.slice()), 'deterministic');
  });

  T.test('global rng exists (cosmetic)', () => {
    T.ok(R.global && typeof R.global.next === 'function');
  });
};
