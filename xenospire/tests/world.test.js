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

const settle = (w, secs = 4) => { for (let t = 0; t < secs * 60 && (w.chunks.length || w.needsSupport); t++) w.update(1 / 60); };

test('loose clusters come off as a rigid chunk and settle as rubble', () => {
  const { w, tile } = slab();
  for (let z = 3; z < 8; z++) w.set(5, 5, z, tile);
  w.set(6, 5, 7, tile); // overhang attached to the pillar top
  w.update(0);
  const chunks = [], lands = [];
  w.events.on('chunk', (e) => chunks.push(e));
  w.events.on('chunkLand', (e) => lands.push(e));
  w.set(5, 5, 4, 0);    // cut the pillar
  w.update(1 / 60);
  assert.equal(chunks.length, 1);
  assert.equal(chunks[0].n, 4); // z = 5, 6, 7 of the pillar + the overhang
  assert.ok(w.solid(5, 5, 3), 'the stump stays');
  assert.ok(!w.solid(5, 5, 6) && !w.solid(6, 5, 7), 'cluster left the grid');
  settle(w);
  assert.equal(w.chunks.length, 0);
  assert.equal(lands.length, 1);
  assert.ok(lands[0].placed >= 1, 'some of it stays as rubble');
  let rubble = 0;
  for (let z = 3; z < 10; z++) for (let y = 0; y < 12; y++) for (let x = 0; x < 12; x++) {
    const i = w.idx(x, y, z);
    if (w.mat[i] && !(x === 5 && y === 5 && z === 3)) { rubble++; assert.ok(w.hp[i] <= 0.61, 'rubble is cracked'); }
  }
  assert.equal(rubble, lands[0].placed);
});

test('a tall pillar topples and ends up lying down', () => {
  const { w, tile } = slab(16, 16, 14);
  for (let z = 3; z < 10; z++) w.set(8, 8, z, tile);
  w.update(0);
  w.damageSphere(8.1, 8.5, 3.5, 0.7, 40); // knock out the base from the -x side
  w.update(1 / 60);
  assert.equal(w.chunks.length, 1);
  assert.equal(w.chunks[0].mode, 'topple');
  settle(w);
  let maxZ = 0, n = 0;
  for (let z = 3; z < 14; z++) for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (w.solid(x, y, z) && !(x === 8 && y === 8)) { maxZ = Math.max(maxZ, z); n++; }
  assert.ok(n > 0, 'rubble landed');
  assert.ok(maxZ <= 5, `lying down (top at z ${maxZ})`);
});

test('elements stain voxels even where nothing breaks', () => {
  const { w } = slab();
  w.damageSphere(6, 6, 3.2, 1.2, 0.2, null, 1);
  let stained = 0;
  for (let i = 0; i < w.stain.length; i++) if (w.stain[i] === 1) stained++;
  assert.ok(stained > 0);
  assert.equal(w.count(), 12 * 12 * 3);
});

test('cracks run through brittle materials', () => {
  const { w } = slab();
  const glass = w.addMaterial({ kind: 'glass', color: '#aaffff' });
  for (let y = 2; y < 10; y++) for (let x = 2; x < 10; x++) w.set(x, y, 3, glass);
  w.update(0);
  const n = w.damageSphere(5.5, 5.5, 3.5, 0.6, 3);
  assert.ok(n >= 1, `shattered ${n}`);
  let cracked = 0;
  for (let y = 2; y < 10; y++) for (let x = 2; x < 10; x++) { const i = w.idx(x, y, 3); if (w.mat[i] && w.hp[i] < 1) cracked++; }
  assert.ok(cracked >= 2, 'the crack spread');
});

test('craters are ragged and plating shrugs off ordinary shots', () => {
  const { w } = slab(20, 20, 8);
  const plate2 = w.addMaterial({ kind: 'plating', color: '#333333' });
  for (let y = 0; y < 20; y++) for (let x = 0; x < 20; x++) w.set(x, y, 0, plate2);
  const shapes = new Set();
  for (let k = 0; k < 3; k++) {
    const c = slab(20, 20, 8).w;
    c.salt = k * 1000;
    c.damageSphere(10, 10, 3, 2.2, 8);
    let sig = '';
    for (let y = 7; y < 14; y++) for (let x = 7; x < 14; x++) sig += c.solid(x, y, 2) ? '1' : '0';
    shapes.add(sig);
  }
  assert.ok(shapes.size > 1, 'craters differ');
  w.damageSphere(10.5, 10.5, 0.6, 1.2, 4.8); // a bolt-sized hit
  assert.ok(w.solid(10, 10, 0), 'plating holds');
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

test('arenas leave wide open lanes', () => {
  for (let seed = 1; seed <= 12; seed++) {
    const a = XS.Arena.generate(seed * 104729, 1 + seed);
    const w = a.world, B = XS.Arena.BASE;
    let floor = 0, blocked = 0;
    for (let y = 0; y < w.D; y++) for (let x = 0; x < w.W; x++) {
      const t = w.colTop[x + y * w.W];
      if (!t) continue;
      floor++;
      if (t > B + 2) blocked++; // walls and props (hills are walkable steps)
    }
    assert.ok(blocked / floor < 0.06, `${a.theme.id}: ${(100 * blocked / floor).toFixed(1)}% blocked`);
  }
});
