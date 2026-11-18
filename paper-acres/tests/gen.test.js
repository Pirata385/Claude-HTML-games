'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { load } = require('./load');
const PA = load('src/core/config.js', 'src/core/util.js', 'src/core/rng.js', 'src/world/tiles.js', 'src/world/grid.js', 'src/render/props.js', 'src/world/gen.js');
const C = PA.C;

for (const kind of ['oak', 'fruit', 'birch']) {
  test(`${kind}: canopy lobes above a trunk that reaches the ground`, () => {
    const g = PA.Props.treeGeom({ kind, seed: 3 }, 'summer');
    assert.ok(g.lobes.length >= 3);
    assert.ok(g.trunk.h >= 2 * C.CELL_H);
    for (const L of g.lobes) assert.ok(L.y + L.r <= -g.trunk.h + C.CELL_H, 'lobes sit above the trunk top');
  });
}

test('oak canopies are broad and vary by seed', () => {
  const sigs = new Set();
  for (const seed of [1, 2, 3, 4]) {
    const g = PA.Props.treeGeom({ kind: 'oak', seed }, 'summer');
    const x0 = Math.min(...g.lobes.map((L) => L.x - L.r)), x1 = Math.max(...g.lobes.map((L) => L.x + L.r));
    assert.ok((x1 - x0) / C.CELL_W >= 11, 'at least 11 cells wide');
    sigs.add(JSON.stringify(g.lobes.map((L) => [Math.round(L.x), Math.round(L.y)])));
  }
  assert.ok(sigs.size >= 3);
});

test('winter deciduous trees are bare branches; pines keep their tiers', () => {
  const w = PA.Props.treeGeom({ kind: 'oak', seed: 3 }, 'winter');
  assert.strictEqual(w.lobes.length, 0);
  assert.ok(w.branches.length >= 6);
  const p = PA.Props.treeGeom({ kind: 'pine', seed: 3 }, 'winter');
  assert.ok(p.tiers.length >= 2);
});

test('geometry is deterministic for a seed', () => {
  assert.deepStrictEqual(PA.Props.treeGeom({ kind: 'oak', seed: 9 }, 'fall'), PA.Props.treeGeom({ kind: 'oak', seed: 9 }, 'fall'));
});

test('testWorld places tree props standing on the ground', () => {
  const map = PA.Gen.testWorld(7);
  const trees = map.props.filter((p) => p.type === 'tree');
  assert.ok(trees.length >= 8);
  for (const t of trees) assert.strictEqual(map.grid.surfaceY(t.x, t.z), t.gy);
});
