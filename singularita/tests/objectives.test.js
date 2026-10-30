import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ObjectiveTracker } from '../js/systems/objectives.js';
import { OBJECTIVES } from '../js/data/objectives.js';
import { newProfile } from '../js/systems/save.js';

const fresh = () => newProfile({ name: 'T', classId: 'archer', slot: 0, seed: 1 });

test('the chain starts with gathering wood and advances on matching events only', () => {
  const p = fresh();
  const t = new ObjectiveTracker(p);
  assert.equal(t.current.id, 'o_wood');
  assert.equal(t.handle({ type: 'gathered', material: 'stone', n: 5 }), null);
  assert.equal(p.objectives.progress, 0);
  t.handle({ type: 'gathered', material: 'wood', n: 4 });
  assert.equal(p.objectives.progress, 4);
  const done = t.handle({ type: 'gathered', material: 'wood', n: 3 });
  assert.equal(done.id, 'o_wood');
  assert.equal(t.current.id, 'o_pick');
  assert.equal(p.objectives.progress, 0);
});

test('alternatives with | match any listed target', () => {
  const p = fresh();
  p.objectives.index = OBJECTIVES.findIndex((o) => o.id === 'o_copper');
  const t = new ObjectiveTracker(p);
  t.handle({ type: 'gathered', material: 'gold', n: 6 });
  assert.equal(t.current.id, 'o_pick2');
  assert.ok(t.handle({ type: 'crafted', item: 'pickaxe_gold' }));
});

test('equip objectives respect the minimum tier', () => {
  const p = fresh();
  p.objectives.index = OBJECTIVES.findIndex((o) => o.id === 'o_weapon');
  const t = new ObjectiveTracker(p);
  assert.equal(t.handle({ type: 'equipped', slot: 'weapon', tier: 0 }), null);
  assert.ok(t.handle({ type: 'equipped', slot: 'weapon', tier: 1 }));
});

test('state objectives already satisfied complete on activation', () => {
  const p = fresh();
  p.zones.cave_2 = {};
  p.objectives.index = OBJECTIVES.findIndex((o) => o.id === 'o_layer2');
  const t = new ObjectiveTracker(p);
  const done = t.checkImmediate();
  assert.equal(done[0].id, 'o_layer2');
});

test('the chain ends gracefully', () => {
  const p = fresh();
  p.objectives.index = OBJECTIVES.length;
  const t = new ObjectiveTracker(p);
  assert.equal(t.current, null);
  assert.equal(t.handle({ type: 'kill' }), null);
});

test('reaching any elemental isle completes the isle objective, also when it was reached before', () => {
  const p = fresh();
  p.objectives.index = OBJECTIVES.findIndex((o) => o.id === 'o_isle');
  const t = new ObjectiveTracker(p);
  assert.equal(t.handle({ type: 'zone', id: 'cave_3' }), null);
  assert.equal(t.handle({ type: 'zone', id: 'isle_water' }).id, 'o_isle');
  const q = fresh();
  q.objectives.index = OBJECTIVES.findIndex((o) => o.id === 'o_isle');
  q.zones.isle_fire = { nodes: {} };
  assert.equal(new ObjectiveTracker(q).checkImmediate()[0].id, 'o_isle');
});

test('sigil objectives count the sigils you carry', () => {
  const p = fresh();
  p.objectives.index = OBJECTIVES.findIndex((o) => o.id === 'o_sigil');
  const t = new ObjectiveTracker(p);
  p.inv.stacks.sigil_wind = 1;
  assert.equal(t.handle({ type: 'sigil', id: 'sigil_wind' }).id, 'o_sigil');
  assert.equal(t.current.id, 'o_sigils');
  p.inv.stacks.sigil_tide = 1; p.inv.stacks.sigil_flame = 1;
  assert.equal(t.handle({ type: 'sigil', id: 'sigil_flame' }), null);
  p.inv.stacks.sigil_stone = 1;
  assert.equal(t.handle({ type: 'sigil', id: 'sigil_stone' }).id, 'o_sigils');
  // Sigils won before the objective came up count at once.
  const q = fresh();
  q.objectives.index = OBJECTIVES.findIndex((o) => o.id === 'o_sigils');
  for (const s of ['sigil_wind', 'sigil_tide', 'sigil_flame', 'sigil_stone']) q.inv.stacks[s] = 1;
  assert.equal(new ObjectiveTracker(q).checkImmediate()[0].id, 'o_sigils');
});

test('the gate objective completes when the gate opens', () => {
  const p = fresh();
  p.objectives.index = OBJECTIVES.findIndex((o) => o.id === 'o_open');
  const t = new ObjectiveTracker(p);
  assert.equal(t.handle({ type: 'gate' }).id, 'o_open');
  const q = fresh();
  q.objectives.index = OBJECTIVES.findIndex((o) => o.id === 'o_open');
  q.flags = { gateOpen: true };
  assert.equal(new ObjectiveTracker(q).checkImmediate()[0].id, 'o_open');
});

test('shard objectives count the Fracture Shards you carry', () => {
  const p = fresh();
  p.objectives.index = OBJECTIVES.findIndex((o) => o.id === 'o_shard');
  const t = new ObjectiveTracker(p);
  assert.equal(t.handle({ type: 'sigil', id: 'sigil_wind' }), null, 'sigils are not shards');
  p.inv.stacks.shard_gaol = 1;
  assert.equal(t.handle({ type: 'shard', id: 'shard_gaol' }).id, 'o_shard');
  const q = fresh();
  q.objectives.index = OBJECTIVES.findIndex((o) => o.id === 'o_shards');
  for (const s of ['shard_gaol', 'shard_twins', 'shard_crown', 'shard_mirror', 'shard_dragon']) q.inv.stacks[s] = 1;
  assert.equal(new ObjectiveTracker(q).checkImmediate()[0].id, 'o_shards');
});
