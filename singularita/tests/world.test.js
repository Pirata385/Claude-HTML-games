import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ZoneGrid, F } from '../js/world/grid.js';
import { generateZone, zoneSeed, WORLD_SEED, GEN_VERSION } from '../js/world/gen/index.js';
import { validateIsland, validateCave, validateIsle, validateDimension } from '../js/world/gen/validate.js';
import { generateDimension } from '../js/world/gen/dimensions.js';
import { runSeed } from '../js/systems/run.js';
import { placeWayshrine } from '../js/world/gen/island.js';
import { applyTide, TIDE } from '../js/world/tide.js';
import { NODES } from '../js/data/nodes.js';
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
  for (const id of ['island', 'cave_1', 'cave_5', 'isle_air', 'isle_water', 'cave_8']) {
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

test('the Wayshrine stands in camp, clear of the stations, and can be reached', () => {
  const z = generateZone('island'), g = z.grid;
  const w = placeWayshrine(z);
  assert.equal(placeWayshrine(z), w, 'placing twice keeps one shrine');
  assert.ok(Math.hypot(w.x - z.base.x, w.z - z.base.z) < z.base.r - 3);
  for (const s of Object.values(z.base.stations)) assert.ok(Math.hypot(w.x - s.x, w.z - s.z) > 4);
  assert.ok(g.has(Math.floor(w.x), Math.floor(w.z), F.OBSTACLE));
  const [si, sj] = g.cellAt(z.spawn.x, z.spawn.z);
  const d = g.bfs(si, sj, { maxStep: 1 });
  const i = Math.floor(w.x), j = Math.floor(w.z);
  assert.ok([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([di, dj]) => d[g.idx(i + di, j + dj)] >= 0));
});

test('crater arena has pillars to bait the Emperor into', () => {
  const z = gen('island');
  assert.ok(z.arenas.crater.pillars.length >= 4);
});

for (const id of ['isle_air', 'isle_water', 'isle_fire', 'isle_earth']) {
  test(`${id} passes every design rule`, () => {
    const z = gen(id);
    assert.deepEqual(validateIsle(z).errors, []);
    assert.ok(z.arena && z.landing && z.spawn);
    assert.equal(z.pois.filter((p) => p.type === 'lore').length, ZONES[id].lore.length);
    assert.ok(z.nodes.length >= 60, `${id} nodes ${z.nodes.length}`);
    for (const m of ZONES[id].exclusive.filter((m) => !m.includes('feather') && !m.includes('silk') && !m.includes('scale') && !m.includes('shard')))
      assert.ok(z.nodes.some((n) => NODES[n.node].material === m), `${id} has ${m} nodes`);
  });
}

test('air: floating spires over the void, linked by bridges and updrafts', () => {
  const z = gen('isle_air'), g = z.grid;
  let voids = 0;
  for (let k = 0; k < g.flags.length; k++) if (g.flags[k] & F.VOID) voids++;
  assert.ok(voids > g.flags.length * 0.4);
  assert.ok(z.updrafts.length >= 2);
  for (const u of z.updrafts) assert.ok(g.walkable(Math.floor(u.x), Math.floor(u.z)) && g.walkable(Math.floor(u.to.x), Math.floor(u.to.z)));
});

test('water: the tide uncovers sandbars and pearl beds, and swallows them again', () => {
  const z = gen('isle_water'), g = z.grid;
  const pearls = z.nodes.filter((n) => n.node === 'pearl_bed');
  assert.ok(pearls.length >= 6);
  for (const n of pearls) assert.ok(g.has(n.i, n.j, F.TIDAL));
  const reachArena = () => {
    const [si, sj] = g.cellAt(z.spawn.x, z.spawn.z);
    const d = g.bfs(si, sj, { maxStep: 1 });
    const [ai, aj] = g.cellAt(z.arena.x, z.arena.z);
    return d[g.idx(ai, aj)] >= 0;
  };
  applyTide(z, TIDE.low);
  assert.equal(reachArena(), true);
  applyTide(z, TIDE.high);
  assert.equal(reachArena(), false);
  applyTide(z, TIDE.low);
});

test('fire: lava rivers flow, and every path crosses them on basalt', () => {
  const z = gen('isle_fire'), g = z.grid;
  let lava = 0;
  for (let k = 0; k < g.flags.length; k++) if (g.flags[k] & F.LAVA) { lava++; assert.equal(g.flags[k] & F.PATH, 0); }
  assert.ok(lava > 150, `lava ${lava}`);
});

test('earth: terraced mesas with the Worldroot carrying amber', () => {
  const z = gen('isle_earth'), g = z.grid;
  const heights = new Set();
  for (let k = 0; k < g.h.length; k++) if (!(g.flags[k] & F.WATER)) heights.add(g.h[k]);
  assert.ok(heights.size >= 8);
  assert.ok(z.worldroot.length > 40);
  assert.ok(z.nodes.filter((n) => n.node === 'amber_root').length >= 8);
});

test('the Core layer splits into dawn and dusk and ends at a second seal', () => {
  const z = gen('cave_8');
  assert.equal(z.exit.type, 'heart');
  for (const n of z.nodes) {
    if (n.node === 'ore_dawndosite') assert.equal(z.sideOf(n.i), 'dawn');
    if (n.node === 'ore_escuresite') assert.equal(z.sideOf(n.i), 'dusk');
  }
});

for (const id of ZONE_ORDER.filter((x) => ZONES[x].type === 'cave')) {
  test(`${id} passes every design rule`, () => {
    const z = gen(id);
    const v = validateCave(z);
    assert.deepEqual(v.errors, []);
    assert.ok(z.nodes.length >= 30, `${id} nodes ${z.nodes.length}`);
    assert.ok(z.entry && z.exit);
    assert.equal(z.exit.type, ZONES[id].gen.core ? 'core' : ZONES[id].gen.heart ? 'heart' : ZONES[id].gen.gate ? 'gate' : 'shaft');
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

const DIMS = ['dim_dungeon', 'dim_twins', 'dim_king', 'dim_mirror', 'dim_dragons'];
const reachable = (z, extraOpen) => {
  const g = z.grid, open = new Set(extraOpen || []);
  const [si, sj] = g.cellAt(z.spawn.x, z.spawn.z);
  return g.bfs(si, sj, { passable: (i, j, pi, pj) => (g.walkable(i, j) || open.has(g.idx(i, j))) && g.height(i, j) - g.height(pi, pj) <= 1 });
};

for (const id of DIMS) {
  test(`${id}: every run's layout passes the design rules`, () => {
    const layouts = new Set();
    for (let n = 0; n < 6; n++) {
      const z = generateDimension(id, { seed: runSeed(id, n), floor: id === 'dim_dungeon' ? 1 + n * 2 : 1 });
      assert.deepEqual(validateDimension(z).errors, [], `${id} run ${n}`);
      assert.ok(z.spawn && z.entry && z.nodes.length >= 6, `${id} run ${n}: ${z.nodes.length} nodes`);
      layouts.add(z.grid.hashCode());
    }
    assert.ok(layouts.size >= 5, 'runs differ');
  });
}

test('the Endless Dungeon: a locked stair and a Warden on every floor, the Jailer every fifth', () => {
  const f1 = generateDimension('dim_dungeon', { seed: runSeed('dim_dungeon', 0), floor: 1 });
  assert.equal(f1.exit.type, 'stair');
  assert.ok(f1.warden && !f1.arena, 'a warden and no boss on floor 1');
  assert.equal(f1.pois.filter((p) => p.type === 'lore').length, 2);
  const f5 = generateDimension('dim_dungeon', { seed: runSeed('dim_dungeon', 0), floor: 5 });
  assert.ok(f5.arena && f5.arena.boss === 'iron_jailer' && !f5.warden);
  assert.ok(f5.nodes.some((n) => n.node === 'ore_chromantite'), 'chromantite from floor 5');
  assert.ok(!f1.nodes.some((n) => n.node === 'ore_chromantite'));
});

test('the Twin Slimes: every gate is opened by a lever in the other lane', () => {
  const z = generateDimension('dim_twins', { seed: runSeed('dim_twins', 1) });
  assert.ok(z.gates.length >= 4);
  for (const gate of z.gates) {
    const lever = z.levers.find((l) => l.gate === gate.id);
    assert.ok(lever && lever.lane !== gate.lane, `${gate.id} lever in the other lane`);
  }
  const [ai, aj] = z.grid.cellAt(z.arena.x, z.arena.z);
  assert.equal(reachable(z)[z.grid.idx(ai, aj)], -1, 'closed gates bar the way');
  assert.ok(reachable(z, z.gates.flatMap((gt) => gt.cells))[z.grid.idx(ai, aj)] >= 0, 'open gates lead to the throne');
});

test('the Corrupted King: corrupted ground, cleansing braziers, rooms in a row', () => {
  const z = generateDimension('dim_king', { seed: runSeed('dim_king', 2) });
  let corrupt = 0;
  for (let k = 0; k < z.grid.flags.length; k++) if (z.grid.flags[k] & F.CORRUPT) corrupt++;
  assert.ok(corrupt > 200, `corrupt ${corrupt}`);
  assert.ok(z.braziers.length >= 4);
  assert.deepEqual(z.rooms.map((r) => r.name), ['Gatehouse', 'Courtyard', 'Great Hall', 'Throne Room']);
});

test('the Mirrored: a glass line splits the halves, plates come in mirrored pairs, and the reflection can reach its plates', () => {
  const z = generateDimension('dim_mirror', { seed: runSeed('dim_mirror', 3) });
  const g = z.grid, N = g.w;
  assert.ok(z.plates.length >= 3);
  for (const pl of z.plates) {
    assert.equal(pl.left.i + pl.right.i, N - 1, 'mirrored');
    assert.equal(pl.left.j, pl.right.j);
  }
  // With the gates still shut, there is no walking over to the reflection's side.
  const d = reachable(z);
  const firstRight = z.plates[0].right;
  assert.equal(d[g.idx(firstRight.i, firstRight.j)], -1, 'you cannot walk to the reflection\'s side');
  for (const pl of z.plates) assert.ok(z.reflectionReach[g.idx(pl.right.i, pl.right.j)] >= 0, 'the reflection can get there');
});

test('the Dragons\' Roost climbs high above the void to the summit', () => {
  const z = generateDimension('dim_dragons', { seed: runSeed('dim_dragons', 4) });
  const g = z.grid;
  let voids = 0;
  for (let k = 0; k < g.flags.length; k++) if (g.flags[k] & F.VOID) voids++;
  assert.ok(voids > g.flags.length * 0.3);
  assert.ok(z.arena.h - z.landing.h >= 20, `climb ${z.arena.h - z.landing.h}`);
  assert.ok(z.rocks.length >= 6 && z.nests.length >= 2);
});

test('the Singular Heart ends at the heart of Singularita', () => {
  assert.equal(gen('cave_9').exit.type, 'core');
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
  isle_air: 864389213,
  isle_water: 1510201923,
  isle_fire: 3261711635,
  isle_earth: 1606759553,
  cave_8: 1470528535,
  dim_dungeon: 3338211100,
  dim_twins: 4190279646,
  dim_king: 4209598902,
  dim_mirror: 2559964178,
  dim_dragons: 2075933498,
  cave_9: 487881930,
};
