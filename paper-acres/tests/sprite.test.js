'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { load } = require('./load');
const PA = load('src/core/config.js', 'src/core/util.js', 'src/physics/stickman.js');

test('idle stickman is the classic 3x3 figure', () => {
  assert.deepStrictEqual(PA.Stick.sprite('idle', 0, 1), [' \u25CB ', '/|\\', '/ \\']);
});

test('facing left mirrors slashes', () => {
  const r = PA.Stick.sprite('jump', 0, 1), l = PA.Stick.sprite('jump', 0, -1);
  assert.strictEqual(r[1], '\\|/');
  assert.strictEqual(l[1], '\\|/');
  assert.deepStrictEqual(PA.Stick.mirror(['/| ']), [' |\\']);
});

test('walk animates the legs over its cycle', () => {
  const rows = new Set();
  for (let t = 0; t < 1; t += 0.1) rows.add(PA.Stick.sprite('walk', t, 1)[2]);
  assert.ok(rows.size >= 2);
  for (const r of rows) assert.strictEqual(r.length, 3);
});
