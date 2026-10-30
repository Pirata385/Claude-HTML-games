import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ZoneGrid, F } from '../js/world/grid.js';
import { generateZone, zoneSeed, WORLD_SEED, GEN_VERSION } from '../js/world/gen/index.js';
import { validateIsland, validateCave } from '../js/world/gen/validate.js';
import { ZONES, ZONE_ORDER } from '../js/data/zones.js';

const cache = new Map();
const gen = (id) => { if (!cache.has(id)) cache.set(id, generateZone(id)); return cache.get(id); };

test('grid basics: indexing, walls, step rule and BFS', () => {
  const g = new ZoneGrid(5, 5);
  g.setWall(2, 0); g.setWall(2, 1); g.setWall(2, 2); g.setWall(2, 3);
  g.h[g.idx(0, 4)] = 3;
  assert.equal(g.walkable(2, 1), false);
  assert.equal(g.canStep(0, 3, 0, 4, 1), false);
  const d = g.bfs(0, 0, { maxStep: 1 });
  assert.ok(d[g.idx(4, 0)] > 0); // around the wall via row 4
  assert.equal(d[g.idx(0, 4)], -1); // too high to step onto
  assert.deepEqual(g.cellAt(3.7, 1.2), [3, 1]);
});

test('zone seeds are fixed and derived from WORLD_SEED', () => {
  assert.equal(WORLD_SEED, 0x51a6017a);
  assert.equal(GEN_VERSION, 1);
  assert.equal(zoneSeed('island'), zoneSeed('island'));
  assert.notEqual(zoneSeed('cave_1'), zoneSeed('cave_2'));
});

test('generation is deterministic', () => {
  for (const id of ['island', 'cave_1', 'cave_5']) {
    const a = gen(id), b = generateZone(id);
    assert.equal(a.grid.hashCode(), b.grid.hashCode(), id);
    assert.deepEqual(a.nodes.map((n) => [n.node, n.i, n.j]), b.nodes.map((n) => [n.node, n.i, n.j]));
  }
});

test('island passes every design rule', () => {
  const z = gen('island');
  const v = validateIsland(z);
  assert.deepEqual(v.errors, []);
  assert.ok(z.base && z.caveMouth && z.arenas.glade && z.arenas.crater);
  assert.equal(z.pois.filter((p) => p.type === 'lore').length, ZONES.island.lore.length);
  assert.ok(z.nodes.length > 150, `nodes ${z.nodes.length}`);
  assert.ok(z.nodes.some((n) => n.node === 'boulder'));
});

test('island has beaches, water around it and a safe base', () => {
  const z = gen('island'), g = z.grid;
  assert.ok(g.flags[g.idx(1, 1)] & F.WATER);
  const [bi, bj] = g.cellAt(z.base.x, z.base.z);
  assert.ok(g.flags[g.idx(bi, bj)] & F.BASE);
  assert.ok(g.flags[g.idx(bi, bj)] & F.NOSPAWN);
});

test('crater arena has pillars to bait the Emperor into', () => {
  const z = gen('island');
  assert.ok(z.arenas.crater.pillars.length >= 4);
});

for (const id of ZONE_ORDER.filter((x) => ZONES[x].type === 'cave')) {
  test(`${id} passes every design rule`, () => {
    const z = gen(id);
    const v = validateCave(z);
    assert.deepEqual(v.errors, []);
    assert.ok(z.nodes.length >= 30, `${id} nodes ${z.nodes.length}`);
    assert.ok(z.entry && z.exit);
    assert.equal(z.exit.type, ZONES[id].gen.gate ? 'gate' : 'shaft');
    assert.equal(z.pois.filter((p) => p.type === 'lore').length, ZONES[id].lore.length);
    const hz = ZONES[id].hazards;
    if (hz.includes('gas_vent')) assert.ok(z.hazards.some((h) => h.type === 'gas_vent'));
    if (hz.includes('stalactite')) assert.ok(z.hazards.some((h) => h.type === 'stalactite'));
  });
}

test('split rift layer keeps ruby on the hot side and sapphire on the cold side', () => {
  const z = gen('cave_5');
  for (const n of z.nodes) {
    if (n.node === 'ore_ruby') assert.equal(z.sideOf(n.i), 'hot');
    if (n.node === 'ore_sapphire') assert.equal(z.sideOf(n.i), 'cold');
  }
});

test('snapshot: the world stays the same between versions', () => {
  const hashes = Object.fromEntries(ZONE_ORDER.map((id) => [id, gen(id).grid.hashCode()]));
  // Update these only when GEN_VERSION changes.
  assert.deepEqual(hashes, SNAPSHOT);
});

const SNAPSHOT = {
  island: 2342205016,
  cave_1: 721125773,
  cave_2: 187366791,
  cave_3: 1733519886,
  cave_4: 4000703462,
  cave_5: 2709913210,
  cave_6: 1321776304,
  cave_7: 3610936536,
};
