'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { load } = require('./load');
const PA = load('src/core/config.js', 'src/core/util.js', 'src/core/rng.js');

test('rng determinism: same seed same sequence, other seed differs', () => {
  const a = new PA.RNG.Rng(42), b = new PA.RNG.Rng(42), c = new PA.RNG.Rng(43);
  const sa = [], sb = [], sc = [];
  for (let i = 0; i < 100; i++) { sa.push(a.next()); sb.push(b.next()); sc.push(c.next()); }
  assert.deepStrictEqual(sa, sb);
  assert.notDeepStrictEqual(sa, sc);
  assert.ok(sa.every((v) => v >= 0 && v < 1));
});

test('rng int and pick stay in range', () => {
  const r = new PA.RNG.Rng(7);
  for (let i = 0; i < 500; i++) {
    const v = r.int(3, 9);
    assert.ok(v >= 3 && v <= 9 && Number.isInteger(v));
  }
  const arr = ['a', 'b', 'c'];
  for (let i = 0; i < 50; i++) assert.ok(arr.includes(r.pick(arr)));
});

test('noise1 is continuous and bounded', () => {
  for (let x = 0; x < 50; x += 0.37) {
    const n = PA.RNG.noise1(x, 99);
    assert.ok(n >= 0 && n <= 1);
    assert.ok(Math.abs(n - PA.RNG.noise1(x + 0.01, 99)) < 0.05);
  }
});

test('hash3 deterministic and seedFrom stable', () => {
  assert.strictEqual(PA.RNG.hash3(1, 2, 3, 4), PA.RNG.hash3(1, 2, 3, 4));
  assert.notStrictEqual(PA.RNG.hash3(1, 2, 3, 4), PA.RNG.hash3(1, 2, 3, 5));
  assert.strictEqual(PA.RNG.seedFrom('paper'), PA.RNG.seedFrom('paper'));
});

test('bayer4 covers 16 distinct thresholds', () => {
  const s = new Set();
  for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) s.add(PA.U.bayer4(x, y));
  assert.strictEqual(s.size, 16);
});
