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
