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

/* ---------- overworld ---------- */
const OW = PA.Gen.overworld(12345);
function hash(g) { let h = 0; for (let i = 0; i < g.t.length; i += 7) h = (h * 31 + g.t[i]) | 0; return h; }
// standing height at (x, z): water counts as its surface (swimming)
function stand(g, x, z) {
  for (let y = 0; y < g.h; y++) { const d = g.def(x, y, z); if (d.solid || d.water) return y; }
  return g.h;
}
function reach(map, from, extraSolid) {
  const g = map.grid, seen = new Set(), q = [[from.x, from.z]];
  const key = (x, z) => x + ',' + z;
  const headroom = (x, z, y) => { for (let k = 1; k <= 3; k++) if (g.solid(x, y - k, z)) return false; return true; };
  seen.add(key(from.x, from.z));
  while (q.length) {
    const [x, z] = q.pop(); const y = stand(g, x, z);
    const tries = [[x - 1, z, 2], [x + 1, z, 2], [x, z - 1, 1], [x, z + 1, 1]];
    for (const [nx, nz, up] of tries) {
      if (nx < 0 || nz < 0 || nx >= g.w || nz >= g.d || seen.has(key(nx, nz))) continue;
      const ny = stand(g, nx, nz);
      if (y - ny > up) continue;            // too high to climb / step up
      if (!headroom(nx, nz, ny)) continue;
      seen.add(key(nx, nz)); q.push([nx, nz]);
    }
  }
  return seen;
}

test('overworld is deterministic for a seed', () => {
  assert.strictEqual(hash(PA.Gen.overworld(12345).grid), hash(OW.grid));
  assert.notStrictEqual(hash(PA.Gen.overworld(999).grid), hash(OW.grid));
});

test('every important spot is reachable on foot from the spawn', () => {
  const seen = reach(OW, OW.spots.spawn);
  for (const name of ['bin', 'mailbox', 'board', 'dock', 'mine', 'field']) {
    const s = OW.spots[name];
    assert.ok(s, name + ' exists');
    assert.ok(seen.has(s.x + ',' + s.z), name + ' reachable');
  }
  for (const d of OW.doors) assert.ok(seen.has(d.x + ',' + (d.z - 1)), `door ${d.to} front reachable`);
  assert.ok(OW.doors.length >= 10, 'farmhouse + shops + homes');
});

test("the creek keeps grandpa's north orchard out of reach until you bridge it", () => {
  const seen = reach(OW, OW.spots.spawn);
  const o = OW.spots.orchard;
  assert.ok(!seen.has(o.x + ',' + o.z), 'orchard not reachable by walking or swimming');
  assert.ok(OW.zones.find((z) => z.name === 'town'));
});

/* ---------- interiors ---------- */
test('every overworld door leads to an interior with an exit back to that door', () => {
  for (const d of OW.doors) {
    if (d.to === 'mine') continue;
    const m = PA.Gen.interior(d.to);
    assert.strictEqual(m.kind, 'interior', d.to);
    assert.ok(m.spots.entry, d.to + ' entry');
    const e = m.spots.entry, g = m.grid;
    assert.ok(!g.solid(e.x, g.surfaceY(e.x, 0) - 1, 0), d.to + ' entry is free');
    assert.ok(g.surfaceY(e.x, 0) < g.h - 1, d.to + ' has a floor');
    assert.ok(m.props.some((p) => p.type === 'room'), d.to + ' has walls');
  }
});
test('the farmhouse has a bed and the shops have a counter', () => {
  assert.ok(PA.Gen.interior('house').props.some((p) => p.kind === 'bed'));
  for (const id of ['store', 'stationer', 'smith', 'cafe', 'clinic']) assert.ok(PA.Gen.interior(id).props.some((p) => p.kind === 'counter'), id);
});
