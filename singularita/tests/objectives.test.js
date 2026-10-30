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
