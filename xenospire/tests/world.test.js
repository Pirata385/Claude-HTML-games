'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const XS = require('./load.js');

function slab(W = 12, D = 12, H = 10) {
  const w = new XS.VoxelWorld(W, D, H);
  const plate = w.addMaterial({ kind: 'plating', color: '#333333', indestructible: true });
  const tile = w.addMaterial({ kind: 'tile', color: '#aaaaaa' });
  for (let y = 0; y < D; y++) for (let x = 0; x < W; x++) { w.set(x, y, 0, plate); w.set(x, y, 1, tile); w.set(x, y, 2, tile); }
  return { w, plate, tile };
}

test('column tops and ground queries', () => {
  const { w, tile } = slab();
  assert.equal(w.topAt(3.4, 5.9), 3);
  assert.equal(w.topAt(-1, 2), -Infinity);
  for (let z = 3; z < 7; z++) w.set(4, 4, z, tile);
  assert.equal(w.topAt(4, 4), 7);
  assert.equal(w.groundAt(4.5, 4.5, 3.2), 3); // below the pillar base
  assert.equal(w.groundAt(4.5, 4.5, 7.2), 7); // on top of the pillar
  assert.ok(w.blockedSpan(4, 4, 4, 6));
  assert.ok(!w.blockedSpan(5, 5, 3, 8));
});

test('damageSphere breaks soft voxels, spares indestructible ones', () => {
  const { w } = slab();
  let breaks = 0;
  w.events.on('break', () => breaks++);
  const before = w.count();
  const n = w.damageSphere(6, 6, 2.5, 2.5, 50);
  assert.ok(n > 0);
  assert.equal(breaks, n);
  assert.equal(w.count(), before - n);
  for (let y = 0; y < 12; y++) for (let x = 0; x < 12; x++) assert.ok(w.solid(x, y, 0), 'plating must survive');
});

test('weak hits accumulate damage instead of breaking at once', () => {
  const { w } = slab();
  assert.equal(w.damageSphere(6.5, 6.5, 2.5, 0.6, 0.5), 0);
  let total = 0;
  for (let i = 0; i < 10; i++) total += w.damageSphere(6.5, 6.5, 2.5, 0.6, 0.5);
  assert.ok(total >= 1);
});

test('explosive voxels chain into blasts', () => {
  const { w } = slab();
  const core = w.addMaterial({ kind: 'core', color: '#ffee00' });
  w.set(3, 3, 3, core);
  w.set(8, 8, 3, core);
  let blasts = 0;
  w.events.on('blast', () => blasts++);
  w.damageSphere(3.5, 3.5, 3.5, 1, 10);
  assert.ok(blasts >= 1);
  assert.ok(!w.solid(3, 3, 3));
});

test('unsupported clusters collapse', () => {
  const { w, tile } = slab();
  for (let z = 3; z < 8; z++) w.set(5, 5, z, tile);
  w.set(6, 5, 7, tile); // overhang attached to the pillar top
  w.set(5, 5, 4, 0);    // cut the pillar
  let fell = 0;
  w.events.on('fall', () => fell++);
  w.checkSupport();
  assert.equal(fell, 4); // z = 5, 6, 7 of the pillar + the overhang
  assert.ok(w.solid(5, 5, 3));
  assert.ok(!w.solid(5, 5, 6) && !w.solid(6, 5, 7));
});

test('temporary voxels expire', () => {
  const { w } = slab();
  const ice = w.addMaterial({ kind: 'ice', color: '#ccffff' });
  assert.ok(w.setTemp(2, 2, 3, ice, 1));
  w.update(0.5);
  assert.ok(w.solid(2, 2, 3));
  w.update(0.6);
  assert.ok(!w.solid(2, 2, 3));
});

test('raycast hits walls with the correct face normal', () => {
  const { w, tile } = slab();
  for (let z = 3; z < 6; z++) w.set(8, 4, z, tile);
  const hit = w.raycast(2.5, 4.5, 4.5, 11.5, 4.5, 4.5);
  assert.ok(hit);
  assert.deepEqual([hit.x, hit.y, hit.z], [8, 4, 4]);
  assert.deepEqual([hit.nx, hit.ny, hit.nz], [-1, 0, 0]);
  assert.ok(Math.abs(hit.px - 8) < 1e-9);
  assert.equal(w.raycast(2.5, 2.5, 4.5, 6.5, 2.5, 4.5), null);
});

test('arenas: spawns on solid ground and mutually reachable', () => {
  for (let seed = 1; seed <= 40; seed++) {
    for (const fighters of [2, 3, 4]) {
      const a = XS.Arena.generate(seed * 7919, seed % 13 + 1, { fighters });
      assert.equal(a.spawns.length, fighters);
      const seen = XS.Arena.reachableFrom(a.world, a.spawns[0].x, a.spawns[0].y);
      for (const s of a.spawns) {
        assert.ok(a.world.topAt(s.x, s.y) > 0, `spawn on ground (seed ${seed})`);
        assert.ok(!a.world.blockedSpan(s.x, s.y, s.z, s.z + 4), 'spawn has headroom');
        assert.ok(seen[Math.floor(s.x) + Math.floor(s.y) * a.world.W], `spawn reachable (seed ${seed}, ${a.theme.id}/${a.shape})`);
      }
    }
  }
});

test('arena generation is deterministic', () => {
  const a = XS.Arena.generate(555, 3), b = XS.Arena.generate(555, 3);
  assert.equal(a.theme.id, b.theme.id);
  assert.deepEqual(Array.from(a.world.mat), Array.from(b.world.mat));
  assert.deepEqual(a.spawns, b.spawns);
});
