import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeRng, hashSeed, hashStr } from '../js/core/rng.js';
import { makeNoise2D, fbm2D } from '../js/core/noise.js';
import { EventBus } from '../js/core/events.js';
import { Pool } from '../js/core/pool.js';
import { clamp, lerp, smoothstep, angleDiff } from '../js/core/math.js';

test('rng: the same seed gives the same sequence', () => {
  const a = makeRng(1234), b = makeRng(1234);
  for (let i = 0; i < 100; i++) assert.equal(a.next(), b.next());
});

test('rng: different seeds diverge', () => {
  const a = makeRng(1), b = makeRng(2);
  let same = 0;
  for (let i = 0; i < 50; i++) if (a.next() === b.next()) same++;
  assert.ok(same < 2);
});

test('rng: next() stays in [0,1) and is roughly uniform', () => {
  const r = makeRng(99);
  const buckets = new Array(10).fill(0);
  for (let i = 0; i < 20000; i++) {
    const v = r.next();
    assert.ok(v >= 0 && v < 1);
    buckets[Math.floor(v * 10)]++;
  }
  for (const b of buckets) assert.ok(b > 1700 && b < 2300, `bucket ${b}`);
});

test('rng: int, range, pick and weighted helpers respect bounds', () => {
  const r = makeRng(7);
  for (let i = 0; i < 500; i++) {
    const n = r.int(3, 9);
    assert.ok(Number.isInteger(n) && n >= 3 && n <= 9);
    const f = r.range(-2, 5);
    assert.ok(f >= -2 && f < 5);
  }
  assert.ok(['a', 'b'].includes(r.pick(['a', 'b'])));
  const counts = { x: 0, y: 0 };
  for (let i = 0; i < 4000; i++) counts[r.weighted([{ v: 'x', w: 3 }, { v: 'y', w: 1 }]).v]++;
  assert.ok(counts.x > counts.y * 2.4 && counts.x < counts.y * 3.6);
});

test('hashSeed is stable across runs and order-sensitive', () => {
  assert.equal(hashSeed(0x51a6017a, hashStr('island'), 1), hashSeed(0x51a6017a, hashStr('island'), 1));
  assert.notEqual(hashSeed(1, 2), hashSeed(2, 1));
  // Snapshot: changing the hash would silently change every generated world.
  assert.equal(hashStr('dawnreach'), 1281399622);
});

test('noise: deterministic and bounded', () => {
  const n1 = makeNoise2D(42), n2 = makeNoise2D(42), n3 = makeNoise2D(43);
  let diff = 0;
  for (let i = 0; i < 200; i++) {
    const x = i * 0.37, y = i * 0.11;
    const v = n1(x, y);
    assert.equal(v, n2(x, y));
    assert.ok(v >= -1 && v <= 1);
    if (Math.abs(v - n3(x, y)) > 1e-6) diff++;
  }
  assert.ok(diff > 150);
});

test('noise: continuous (small steps give small changes)', () => {
  const n = makeNoise2D(5);
  for (let i = 0; i < 100; i++) {
    const x = i * 0.73, y = i * 0.29;
    assert.ok(Math.abs(n(x, y) - n(x + 0.001, y)) < 0.02);
  }
});

test('fbm2D stays bounded', () => {
  const n = makeNoise2D(5);
  for (let i = 0; i < 100; i++) {
    const v = fbm2D(n, i * 0.1, i * 0.05, 5);
    assert.ok(v >= -1 && v <= 1);
  }
});

test('EventBus: on/emit/off', () => {
  const bus = new EventBus();
  const got = [];
  const off = bus.on('hit', (e) => got.push(e.n));
  bus.emit('hit', { n: 1 });
  off();
  bus.emit('hit', { n: 2 });
  assert.deepEqual(got, [1]);
});

test('EventBus: a throwing listener does not stop the others', () => {
  const bus = new EventBus();
  let ok = false;
  bus.on('x', () => { throw new Error('boom'); });
  bus.on('x', () => { ok = true; });
  const origErr = console.error; console.error = () => {};
  try { bus.emit('x', {}); } finally { console.error = origErr; }
  assert.ok(ok);
});

test('Pool reuses released objects', () => {
  let made = 0;
  const pool = new Pool(() => ({ id: ++made }), (o) => { o.reset = true; });
  const a = pool.get();
  pool.release(a);
  const b = pool.get();
  assert.equal(a, b);
  assert.equal(b.reset, true);
  assert.equal(made, 1);
});

test('math helpers', () => {
  assert.equal(clamp(5, 0, 3), 3);
  assert.equal(lerp(0, 10, 0.5), 5);
  assert.equal(smoothstep(0, 1, 0.5), 0.5);
  assert.ok(Math.abs(angleDiff(Math.PI - 0.1, -Math.PI + 0.1) - 0.2) < 1e-9);
});
