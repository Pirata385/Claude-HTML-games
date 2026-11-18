'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { load } = require('./load');
const PA = load('src/core/config.js', 'src/core/util.js', 'src/core/rng.js', 'src/world/tiles.js', 'src/world/grid.js', 'src/render/sliceStack.js');
const near = (a, b, e = 1e-6) => Math.abs(a - b) < e;

test('current slice maps the camera point to the anchor at zoom scale', () => {
  const cam = { x: 500, y: 300, z: 2, zoom: 1.5 };
  const p = PA.View.slice(0, cam, 1000, 600);
  assert.ok(near(p.scale, 1.5));
  assert.ok(near(p.ox + cam.x * p.scale, 500));
  assert.ok(near(p.oy + cam.y * p.scale, 600 * PA.C.ANCHOR_Y));
});

test('farther slices shrink toward the vanishing point', () => {
  const cam = { x: 500, y: 300, z: 2, zoom: 1 };
  const p1 = PA.View.slice(1, cam, 1000, 600);
  assert.ok(near(p1.scale, 1 / 1.35));
  const vpY = 600 * PA.C.HORIZON, aY = 600 * PA.C.ANCHOR_Y;
  assert.ok(near(p1.oy + cam.y * p1.scale, vpY + (aY - vpY) / 1.35));
  const p5 = PA.View.slice(5, cam, 1000, 600);
  assert.ok(p5.scale < p1.scale);
});

test('lighten never makes a glyph denser and keeps level 0 intact', () => {
  const L = PA.SliceStack.lighten;
  assert.strictEqual(L('#', 0), '#');
  assert.strictEqual(L('#', 1), '=');
  assert.strictEqual(L(' ', 3), ' ');
  assert.strictEqual(L('a', 2), 'a');
  assert.strictEqual(L('|', 5), ':');
});

test('dropout: level 0 shows every cell, deep levels drop most', () => {
  let shown0 = 0, shown5 = 0;
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
    if (PA.SliceStack.keep(x, y, 0)) shown0++;
    if (PA.SliceStack.keep(x, y, 5)) shown5++;
  }
  assert.strictEqual(shown0, 64);
  assert.ok(shown5 <= 64 * 0.3);
});
