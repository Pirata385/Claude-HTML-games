const test = require('node:test');
const assert = require('node:assert');
const AM = require('./load.js');

test('world generation is deterministic per seed', () => {
  const a = AM.createWorld(1234), b = AM.createWorld(1234), c = AM.createWorld(99);
  const ca = a.chunk(3, -2), cb = b.chunk(3, -2);
  assert.deepStrictEqual(Array.from(ca.biome), Array.from(cb.biome));
  assert.deepStrictEqual(ca.props, cb.props);
  let diff = 0;
  for (let i = 0; i < 40; i++) if (a.biomeAt(i * 400, i * 300) !== c.biomeAt(i * 400, i * 300)) diff++;
  assert.ok(diff > 0, 'different seeds differ');
});

test('spawn is a safe meadow with a village', () => {
  for (const seed of [1, 2, 3, 77, 2024]) {
    const w = AM.createWorld(seed);
    assert.strictEqual(w.biomeAt(0, 0), 0);
    assert.strictEqual(w.waterAt(0, 0), 0);
    assert.strictEqual(w.dangerAt(5, 5), 1);
    const v = w.structuresNear(0, 0, 10).find((s) => s.type === 'village');
    assert.ok(v && v.name === 'Hearthmoor');
  }
});

test('danger rises with distance from spawn', () => {
  const w = AM.createWorld(5);
  const avg = (d) => { let s = 0; for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; s += w.dangerAt(Math.cos(a) * d, Math.sin(a) * d); } return s / 16; };
  assert.ok(avg(300) > avg(50));
  assert.ok(avg(1500) > avg(600));
  assert.ok(avg(5000) > 40);
});

test('structures never overlap and avoid deep water', () => {
  const w = AM.createWorld(31);
  for (let rx = -4; rx <= 4; rx++) for (let rz = -4; rz <= 4; rz++) {
    const list = w.region(rx, rz);
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const A = list[i], B = list[j];
        assert.ok(Math.hypot(A.x - B.x, A.z - B.z) >= A.r + B.r, `${A.id} overlaps ${B.id}`);
      }
      if (!(rx === 0 && rz === 0) && !(rx === -1 && rz === -1)) assert.strictEqual(w.rawWater(list[i].x, list[i].z), 0, list[i].id + ' in water');
    }
  }
});

test('all eight biomes appear in a large radius', () => {
  const w = AM.createWorld(8);
  const seen = new Set();
  for (let x = -4000; x <= 4000; x += 80) for (let z = -4000; z <= 4000; z += 80) seen.add(w.biomeAt(x, z));
  assert.strictEqual(seen.size, AM.BIOMES.length, 'saw ' + [...seen].join(','));
});

test('every structure type exists near spawn', () => {
  const w = AM.createWorld(12);
  const types = new Set(w.structuresNear(0, 0, 1000).map((s) => s.type));
  for (const t of ['village', 'ruin', 'cave', 'dungeon', 'camp', 'chest']) assert.ok(types.has(t), t);
});

test('wild creature rolls use biome spawns', () => {
  const w = AM.createWorld(4);
  const rng = AM.makeRng(4);
  for (let i = 0; i < 100; i++) {
    const r = w.rollWild(rng, 2, 10);
    assert.ok(AM.BIOMES[2].spawns[r.mother] && AM.BIOMES[2].spawns[r.father]);
    assert.ok(r.level >= 9 && r.level <= 11);
  }
});
