'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { load } = require('./load');
const PA = load('src/core/config.js', 'src/core/util.js', 'src/core/rng.js', 'src/world/tiles.js', 'src/world/grid.js', 'src/render/props.js', 'src/world/gen.js', 'src/combat/combat.js');

function stand(g, x, z) { for (let y = 0; y < g.h; y++) { const d = g.def(x, y, z); if (d.solid || d.water) return y; } return g.h; }
function reach(g, from, up) {
  const seen = new Set([from.x + ',' + from.z]), q = [[from.x, from.z]];
  while (q.length) {
    const [x, z] = q.pop(), y = stand(g, x, z);
    for (const [nx, nz, u] of [[x - 1, z, up], [x + 1, z, up], [x, z - 1, 1], [x, z + 1, 1]]) {
      if (nx < 0 || nz < 0 || nx >= g.w || nz >= g.d || seen.has(nx + ',' + nz)) continue;
      const ny = stand(g, nx, nz);
      if (y - ny > u || ny >= g.h) continue;
      let room = true; for (let k = 1; k <= 4; k++) if (g.solid(nx, ny - k, nz)) room = false;
      if (!room) continue;
      seen.add(nx + ',' + nz); q.push([nx, nz]);
    }
  }
  return seen;
}

test('mine floors are deterministic and the way down is reachable from the entry', () => {
  for (const n of [1, 4, 9, 13, 27]) {
    const a = PA.Gen.mineFloor(77, n), b = PA.Gen.mineFloor(77, n);
    assert.deepStrictEqual(Array.from(a.grid.t), Array.from(b.grid.t));
    const seen = reach(a.grid, a.spots.entry, 3);
    assert.ok(seen.has(a.spots.down.x + ',' + a.spots.down.z), 'floor ' + n + ' exit reachable');
  }
});

test('deeper floors have more enemies, richer ores, and bosses every 10', () => {
  const f2 = PA.Gen.mineFloor(77, 2), f25 = PA.Gen.mineFloor(77, 25);
  assert.ok(f25.enemies.length > f2.enemies.length);
  const count = (m, t) => Array.from(m.grid.t).filter((v) => v === t).length;
  assert.ok(count(f25, PA.T.ORE_GOLD) > count(f2, PA.T.ORE_GOLD));
  for (const n of [10, 20, 30]) assert.ok(PA.Gen.mineFloor(77, n).boss, 'boss on ' + n);
  assert.ok(!PA.Gen.mineFloor(77, 11).boss);
});

test('damage grows with impact speed and weapon mass', () => {
  const D = PA.Combat.damage;
  assert.ok(D(6, 1) > D(3, 1));
  assert.ok(D(6, 2) > D(6, 1));
  assert.strictEqual(D(0.2, 1), 0, 'a touch does nothing');
});
