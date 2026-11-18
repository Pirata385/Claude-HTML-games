'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { load } = require('./load');
const PA = load('src/core/config.js', 'src/core/util.js', 'src/ascii/matcher.js');
const M = PA.Matcher;
// build a key from a 4x6 picture ('#' = ink)
const pic = (...rows) => M.keyFromRows(rows);

test('empty and full cells', () => {
  assert.strictEqual(M.classify(0), ' ');
  assert.strictEqual(M.classify(pic('####', '####', '####', '####', '####', '####')), '#');
});
test('horizontal lines: middle is a dash, bottom is an underscore', () => {
  assert.strictEqual(M.classify(pic('....', '....', '####', '....', '....', '....')), '-');
  assert.strictEqual(M.classify(pic('....', '....', '....', '....', '....', '####')), '_');
});
test('vertical line is a pipe', () => {
  assert.strictEqual(M.classify(pic('.#..', '.#..', '.#..', '.#..', '.#..', '.#..')), '|');
  assert.strictEqual(M.classify(pic('..#.', '..#.', '..#.', '..#.', '..#.', '..#.')), '|');
});
test('diagonals', () => {
  assert.strictEqual(M.classify(pic('...#', '..#.', '..#.', '.#..', '.#..', '#...')), '/');
  assert.strictEqual(M.classify(pic('#...', '.#..', '.#..', '..#.', '..#.', '...#')), '\\');
});
test('small ring is an o, a dot at the bottom is a period', () => {
  assert.strictEqual(M.classify(pic('....', '....', '.##.', '#..#', '#..#', '.##.')), 'o');
  assert.strictEqual(M.classify(pic('....', '....', '....', '....', '.#..', '....')), '.');
});
test('cross makes a plus', () => {
  assert.strictEqual(M.classify(pic('.#..', '.#..', '####', '.#..', '.#..', '.#..')), '+');
});
test('classification is memoised and stable', () => {
  const k = pic('....', '....', '####', '....', '....', '....');
  assert.strictEqual(M.classify(k), M.classify(k));
  assert.ok(M.cacheSize() > 0);
});

test('pick: solid cells become #, partly solid cells fall back to the stroke matcher', () => {
  const full = M.FULL;
  assert.strictEqual(M.pick(full, 24), '#');
  const k = pic('....', '....', '####', '....', '....', '....');
  assert.strictEqual(M.pick(k, 7), M.classify(k), '30% solid keeps the stroke glyph');
  assert.strictEqual(M.pick(k, 0), '-');
  assert.strictEqual(M.pick(0, 0), ' ');
});
