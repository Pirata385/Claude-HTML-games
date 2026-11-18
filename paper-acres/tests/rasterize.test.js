'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { load } = require('./load');
const PA = load('src/core/config.js', 'src/core/util.js', 'src/ascii/rasterize.js', 'src/ascii/glyphs.js');
const R = PA.Rasterize;
const P = (x, y) => ({ x, y });
const at = (rows, c, r) => rows[r][c];

test('horizontal stroke becomes dashes', () => {
  const rows = R.strokesToCells([[P(0.5, 1.5), P(5.5, 1.5)]], 7, 3);
  assert.strictEqual(rows[1].trim(), '------');
  assert.strictEqual(rows[0].trim(), '');
});

test('stroke near the bottom of the cell becomes underscores', () => {
  const rows = R.strokesToCells([[P(0.5, 1.85), P(4.5, 1.85)]], 6, 3);
  assert.strictEqual(rows[1].trim(), '_____');
});

test('vertical stroke becomes pipes', () => {
  const rows = R.strokesToCells([[P(2.5, 0.2), P(2.5, 3.8)]], 5, 4);
  for (let r = 0; r < 4; r++) assert.strictEqual(at(rows, 2, r), '|');
});

test('up-right diagonal becomes slashes', () => {
  const rows = R.strokesToCells([[P(0.5, 3.5), P(3.5, 0.5)]], 4, 4);
  for (let i = 0; i < 4; i++) assert.strictEqual(at(rows, i, 3 - i), '/');
  assert.ok(rows.join('').replace(/[ /]/g, '') === '');
});

test('down-right diagonal becomes backslashes', () => {
  const rows = R.strokesToCells([[P(0.5, 0.5), P(3.5, 3.5)]], 4, 4);
  for (let i = 0; i < 4; i++) assert.strictEqual(at(rows, i, i), '\\');
});

test('crossing strokes make a plus', () => {
  const rows = R.strokesToCells([[P(0.5, 2.5), P(4.5, 2.5)], [P(2.5, 0.5), P(2.5, 4.5)]], 5, 5);
  assert.strictEqual(at(rows, 2, 2), '+');
  assert.strictEqual(at(rows, 0, 2), '-');
  assert.strictEqual(at(rows, 2, 0), '|');
});

test('crossing diagonals make an x', () => {
  const rows = R.strokesToCells([[P(0.5, 0.5), P(4.5, 4.5)], [P(0.5, 4.5), P(4.5, 0.5)]], 5, 5);
  assert.strictEqual(at(rows, 2, 2), 'x');
});

test('a tap becomes a dot', () => {
  const rows = R.strokesToCells([[P(1.5, 1.5), P(1.55, 1.52)]], 3, 3);
  assert.strictEqual(at(rows, 1, 1), '.');
});

test('a small closed loop becomes o', () => {
  const loop = [];
  for (let i = 0; i <= 16; i++) { const a = i / 16 * Math.PI * 2; loop.push(P(2.5 + Math.cos(a) * 0.3, 1.5 + Math.sin(a) * 0.3)); }
  const rows = R.strokesToCells([loop], 5, 3);
  assert.strictEqual(at(rows, 2, 1), 'o');
});

test('rectangle corners: dots on top, apostrophes on the bottom', () => {
  const rows = R.strokesToCells([[P(0.5, 0.5), P(5.5, 0.5), P(5.5, 3.5), P(0.5, 3.5), P(0.5, 0.5)]], 6, 4);
  assert.strictEqual(rows[0], '.----.');
  assert.strictEqual(rows[3], "'----'");
  assert.strictEqual(at(rows, 0, 1), '|');
  assert.strictEqual(at(rows, 5, 2), '|');
});

test('segmentsToCells matches strokesToCells for a single segment', () => {
  const a = R.segmentsToCells([{ x1: 0.5, y1: 1.5, x2: 3.5, y2: 1.5 }], 5, 3);
  assert.strictEqual(a[1].trim(), '----');
});

test('glyph frames are unique per char/style/variant and unknown maps to ?', () => {
  const G = PA.Glyphs;
  const seen = new Set();
  for (const ch of 'aZ#-/') for (let s = 0; s < 3; s++) for (let v = 0; v < 3; v++) seen.add(G.frame(ch, s, v));
  assert.strictEqual(seen.size, 5 * 9);
  assert.strictEqual(G.frame('é', 0, 0), G.frame('?', 0, 0));
});
