'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { load } = require('./load');
const PA = load('src/core/config.js', 'src/core/util.js', 'src/render/view.js');
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
  assert.ok(PA.View.slice(5, cam, 1000, 600).scale < p1.scale);
});

test('levelOf: slices behind the camera are ghosts (-1)', () => {
  assert.strictEqual(PA.View.levelOf(0.2), 0);
  assert.strictEqual(PA.View.levelOf(-0.7), -1);
  assert.strictEqual(PA.View.levelOf(2.6), 3);
});
