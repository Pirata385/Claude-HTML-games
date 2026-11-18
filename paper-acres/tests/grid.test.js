'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { load } = require('./load');
const PA = load('src/core/config.js', 'src/core/util.js', 'src/core/rng.js', 'src/world/tiles.js', 'src/world/grid.js');
const T = PA.T;

test('set/get roundtrip with meta', () => {
  const g = new PA.Grid(10, 8, 3);
  g.set(3, 4, 1, T.STONE);
  g.setMeta(3, 4, 1, 65);
  assert.strictEqual(g.get(3, 4, 1), T.STONE);
  assert.strictEqual(g.meta(3, 4, 1), 65);
  assert.strictEqual(g.get(3, 4, 0), T.AIR);
});

test('out of bounds: sides are stone, above is air, below is bedrock', () => {
  const g = new PA.Grid(10, 8, 3);
  assert.strictEqual(g.get(-1, 3, 0), T.STONE);
  assert.strictEqual(g.get(10, 3, 0), T.STONE);
  assert.strictEqual(g.get(4, -2, 0), T.AIR);
  assert.strictEqual(g.get(4, 8, 0), T.BEDROCK);
  assert.strictEqual(g.get(4, 3, -1), T.AIR);
  assert.ok(g.solid(4, 8, 0));
});

test('surfaceY finds the first solid cell from the top', () => {
  const g = new PA.Grid(6, 10, 1);
  for (let x = 0; x < 6; x++) for (let y = 6; y < 10; y++) g.set(x, y, 0, T.DIRT);
  g.set(2, 5, 0, T.GRASS);
  assert.strictEqual(g.surfaceY(0, 0), 6);
  assert.strictEqual(g.surfaceY(2, 0), 5);
});

test('decor tiles are not solid; ART tiles are solid and draw their meta char', () => {
  const g = new PA.Grid(4, 4, 1);
  g.set(1, 1, 0, T.DECO); g.setMeta(1, 1, 0, '#'.charCodeAt(0));
  g.set(2, 1, 0, T.ART); g.setMeta(2, 1, 0, '@'.charCodeAt(0));
  assert.ok(!g.solid(1, 1, 0));
  assert.ok(g.solid(2, 1, 0));
  assert.strictEqual(PA.tileGlyph(g, 1, 1, 0), '#');
  assert.strictEqual(PA.tileGlyph(g, 2, 1, 0), '@');
});

test('edits are recorded and re-imported onto a fresh grid', () => {
  const g = new PA.Grid(8, 8, 2);
  g.set(1, 1, 0, T.DIRT, false); // generation, not logged
  g.set(2, 2, 1, T.SOIL);
  g.set(3, 3, 1, T.CROP); g.setMeta(3, 3, 1, 118);
  const edits = g.exportEdits();
  assert.strictEqual(edits.length, 2);
  const h = new PA.Grid(8, 8, 2);
  h.importEdits(edits);
  assert.strictEqual(h.get(2, 2, 1), T.SOIL);
  assert.strictEqual(h.get(3, 3, 1), T.CROP);
  assert.strictEqual(h.meta(3, 3, 1), 118);
  assert.strictEqual(h.get(1, 1, 0), T.AIR);
});

test('onChange fires with coordinates', () => {
  const g = new PA.Grid(4, 4, 1);
  const seen = [];
  g.onChange((x, y, z) => seen.push([x, y, z]));
  g.set(1, 2, 0, T.STONE);
  assert.deepStrictEqual(seen, [[1, 2, 0]]);
});

test('ground is drawn as an outline: a line in the air cell above, a pipe at step sides', () => {
  const g = new PA.Grid(10, 10, 1);
  for (let x = 0; x < 10; x++) for (let y = (x < 5 ? 6 : 5); y < 10; y++) g.set(x, y, 0, T.DIRT, false);
  assert.strictEqual(PA.airGlyph(g, 2, 5, 0), '_');     // above low ground
  assert.strictEqual(PA.airGlyph(g, 7, 4, 0), '_');     // above high ground
  assert.strictEqual(PA.airGlyph(g, 2, 3, 0), ' ');     // open sky
  assert.strictEqual(PA.tileGlyph(g, 5, 5, 0), '|');    // left side of the step
  const inner = PA.tileGlyph(g, 7, 8, 0);
  assert.ok(inner === ' ' || inner === '.' || inner === ',');
});
