import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startRun, nextFloor, endRun, runLevel, isJailerFloor, runSeed } from '../js/systems/run.js';
import { canEnter } from '../js/systems/travel.js';
import { newProfile } from '../js/systems/save.js';
import { ZONES } from '../js/data/zones.js';

const fresh = (level = 150) => { const p = newProfile({ name: 'Tess', classId: 'swordsman', slot: 0, seed: 77 }); p.level = level; return p; };

test('a run starts fresh, remembers where you came from, and varies between runs', () => {
  const p = fresh();
  p.zones.dim_king = { nodes: { n3: 999 }, fog: 'old' };
  const r1 = startRun(p, 'dim_king', { zone: 'island', x: 10, z: 20 });
  assert.equal(p.run, r1);
  assert.equal(r1.dim, 'dim_king');
  assert.equal(r1.floor, 1);
  assert.deepEqual(r1.returnTo, { zone: 'island', x: 10, z: 20 });
  assert.deepEqual(p.zones.dim_king, { nodes: {}, fog: null }, 'each run starts unexplored');
  endRun(p, 'complete');
  const r2 = startRun(p, 'dim_king', { zone: 'island', x: 0, z: 0 });
  assert.notEqual(r1.seed, r2.seed, 'a new layout each run');
  assert.equal(runSeed('dim_king', 0), r1.seed, 'seeds are reproducible');
});

test('the Endless Dungeon goes deeper and harder, with the Jailer every fifth floor', () => {
  const p = fresh();
  const def = ZONES.dim_dungeon;
  startRun(p, 'dim_dungeon', { zone: 'island', x: 0, z: 0 });
  assert.equal(runLevel(def, p.run), 100);
  for (let k = 0; k < 4; k++) nextFloor(p.run);
  assert.equal(p.run.floor, 5);
  assert.ok(isJailerFloor(5) && isJailerFloor(10) && !isJailerFloor(4));
  assert.ok(runLevel(def, p.run) > 100);
  for (let k = 0; k < 60; k++) nextFloor(p.run);
  assert.equal(runLevel(def, p.run), 300, 'levels cap at 300');
  const sum = endRun(p, 'leave');
  assert.equal(sum.floor, 65);
  assert.equal(p.dims.dim_dungeon.bestFloor, 65);
  assert.equal(p.run, null);
  startRun(p, 'dim_dungeon', { zone: 'island', x: 0, z: 0 });
  endRun(p, 'fail');
  assert.equal(p.dims.dim_dungeon.bestFloor, 65, 'a failed shallow run keeps the record');
});

test('other dimensions use their own level band, and completions are counted', () => {
  const p = fresh();
  startRun(p, 'dim_mirror', { zone: 'island', x: 0, z: 0 });
  const lv = runLevel(ZONES.dim_mirror, p.run);
  assert.ok(lv >= 140 && lv <= 170);
  endRun(p, 'complete');
  assert.equal(p.dims.dim_mirror.cleared, 1);
  assert.equal(p.dims.dim_mirror.runs, 1);
});

test('dimensions need their level; the Singular Heart needs the five shards', () => {
  assert.equal(canEnter(fresh(99), 'dim_dungeon').ok, false);
  assert.equal(canEnter(fresh(100), 'dim_dungeon').ok, true);
  const p = fresh(220);
  assert.match(canEnter(p, 'cave_9').reason, /Fracture Shard/);
  for (const s of ['shard_gaol', 'shard_twins', 'shard_crown', 'shard_mirror', 'shard_dragon']) p.inv.stacks[s] = 1;
  assert.equal(canEnter(p, 'cave_9').ok, true);
});
