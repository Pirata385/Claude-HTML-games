'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { load } = require('./load');
const PA = load('src/core/config.js', 'src/core/util.js', 'src/core/rng.js', 'src/world/tiles.js', 'src/world/grid.js', 'src/physics/terrain.js', 'src/physics/stickman.js');

test('Terrain.rects covers every solid cell exactly once', () => {
  const g = new PA.Grid(40, 30, 2);
  const r = PA.RNG.mulberry32(5);
  for (let y = 0; y < 30; y++) for (let x = 0; x < 40; x++) if (r() < 0.45 || y > 20) g.set(x, y, 1, PA.T.STONE, false);
  const rects = PA.Terrain.rects(g, 1, 0, 0, 40, 30);
  const cover = new Uint8Array(40 * 30);
  for (const q of rects) for (let y = q.y; y < q.y + q.h; y++) for (let x = q.x; x < q.x + q.w; x++) cover[y * 40 + x]++;
  for (let y = 0; y < 30; y++) for (let x = 0; x < 40; x++) assert.strictEqual(cover[y * 40 + x], g.solid(x, y, 1) ? 1 : 0, `cell ${x},${y}`);
  assert.ok(rects.length < 40 * 30 * 0.4, 'rects are merged');
});

test('Terrain.rects merges a flat floor into few rectangles', () => {
  const g = new PA.Grid(32, 20, 1);
  for (let y = 10; y < 20; y++) for (let x = 0; x < 32; x++) g.set(x, y, 0, PA.T.DIRT, false);
  assert.strictEqual(PA.Terrain.rects(g, 0, 0, 0, 32, 20).length, 1);
});

test('collision bits: slice and actor bits separate', () => {
  assert.strictEqual(PA.sliceBit(3), 8);
  assert.strictEqual(PA.actorBit(0), 1 << 16);
  assert.notStrictEqual(PA.sliceBit(3) & PA.actorBit(3), PA.sliceBit(3));
});

test('walk pose keeps feet on the ground at contact phases', () => {
  for (const t of [0, 0.5]) {
    const j = PA.Stick.pose('walk', t, {});
    const lowest = Math.max(j.footL.y, j.footR.y);
    assert.ok(Math.abs(lowest) <= 2, `phase ${t} lowest foot ${lowest}`);
    assert.ok(j.footL.y > -3 && j.footR.y > -3);
    assert.ok(j.head.y < -38 && j.head.y > -50);
  }
});

test('toSegs returns limb segments with finite coordinates', () => {
  const segs = PA.Stick.toSegs(PA.Stick.pose('idle', 0, {}));
  assert.ok(segs.length >= 9);
  for (const s of segs) for (const k of ['x1', 'y1', 'x2', 'y2']) assert.ok(Number.isFinite(s[k]));
});
