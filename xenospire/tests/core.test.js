'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const XS = require('./load.js');

test('RNG is deterministic per seed and differs across seeds', () => {
  const a = new XS.RNG(1234), b = new XS.RNG(1234), c = new XS.RNG(1235);
  const sa = Array.from({ length: 20 }, () => a.u32());
  const sb = Array.from({ length: 20 }, () => b.u32());
  const sc = Array.from({ length: 20 }, () => c.u32());
  assert.deepEqual(sa, sb);
  assert.notDeepEqual(sa, sc);
});

test('RNG helpers stay in range', () => {
  const r = new XS.RNG('range');
  for (let i = 0; i < 5000; i++) {
    const f = r.next();
    assert.ok(f >= 0 && f < 1);
    const n = r.int(-3, 7);
    assert.ok(Number.isInteger(n) && n >= -3 && n <= 7);
  }
  const counts = { a: 0, b: 0 };
  for (let i = 0; i < 4000; i++) counts[r.weighted([{ k: 'a', w: 3 }, { k: 'b', w: 1 }]).k]++;
  assert.ok(counts.a > counts.b * 2 && counts.a < counts.b * 4);
});

test('forked streams are reproducible', () => {
  const x = new XS.RNG(99).fork('power'), y = new XS.RNG(99).fork('power');
  assert.equal(x.u32(), y.u32());
});

test('seed codes round-trip and any text maps to a seed', () => {
  for (const s of [0, 1, 42, 123456789, 4294967295]) {
    const code = XS.seedToCode(s);
    assert.match(code, /^[A-Z2-9]{4}-[A-Z2-9]{3}$/);
    assert.equal(XS.codeToSeed(code), s >>> 0);
    assert.equal(XS.codeToSeed(code.toLowerCase()), s >>> 0);
  }
  assert.equal(XS.codeToSeed('banana'), XS.codeToSeed('  Banana '));
});

test('iso projection and its inverse agree', () => {
  for (const [x, y, z] of [[0, 0, 0], [3.5, 7.25, 3], [20, 4, 1]]) {
    const sx = XS.isoX(x, y), sy = XS.isoY(x, y, z);
    const w = XS.screenToWorld(sx, sy, z);
    assert.ok(Math.abs(w.x - x) < 1e-9 && Math.abs(w.y - y) < 1e-9);
  }
  // Screen "up" is the far corner of the arena (-x, -y).
  const d = XS.screenDirToWorld(0, -1);
  assert.ok(d.x < 0 && d.y < 0 && Math.abs(d.x - d.y) < 1e-9);
});

test('colour ramps go dark to light', () => {
  const r = XS.color.ramp('#5a8ad0', 4);
  const lum = (h) => { const [a, b, c] = XS.color.hexToRgb(h); return a * 0.3 + b * 0.59 + c * 0.11; };
  for (let i = 1; i < r.length; i++) assert.ok(lum(r[i]) > lum(r[i - 1]));
});
