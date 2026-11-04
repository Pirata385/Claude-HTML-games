import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canAscend, ascend, ascendLevel, ascendBonus, ASCENSION } from '../js/systems/ascension.js';
import { chooseEnding } from '../js/systems/ending.js';
import { eliteChance } from '../js/systems/horde.js';
import { newProfile } from '../js/systems/save.js';
import { addItem } from '../js/systems/inventory.js';
import { OBJECTIVES } from '../js/data/objectives.js';
import { ZONES } from '../js/data/zones.js';
import { WAVES } from '../js/data/waves.js';
import { SIGILS, SHARDS } from '../js/data/materials.js';

const finished = () => {
  const p = newProfile({ name: 'Tess', classId: 'assassin', slot: 0, seed: 3 });
  p.level = 280; p.xp = 1234; p.attrs.agi = 300;
  for (const s of [...SIGILS, ...SHARDS, 'singular_key']) p.inv.stacks[s] = 1;
  p.inv.stacks.singularita = 40;
  addItem(p.inv, 'crown_of_vael');
  (p.flags ||= {}).gateOpen = true;
  p.objectives.index = OBJECTIVES.length;
  p.dims = { dim_unmade: { runs: 1, cleared: 1, bestFloor: 1, bestTime: 300 } };
  p.lore.push('lore_seal');
  chooseEnding(p, 'mend');
  return p;
};

test('Ascension waits for an ending', () => {
  const p = newProfile({ name: 'Tess', classId: 'assassin', slot: 0, seed: 3 });
  assert.equal(canAscend(p), false);
  assert.throws(() => ascend(p));
  assert.equal(canAscend(finished()), true);
});

test('Ascension: the story begins again, you do not', () => {
  const p = finished();
  ascend(p);
  assert.equal(p.cycle, 1);
  // You keep yourself: level, attributes, gear and materials, what you learned and your records.
  assert.equal(p.level, 280); assert.equal(p.xp, 1234); assert.equal(p.attrs.agi, 300);
  assert.equal(p.inv.stacks.singularita, 40);
  assert.ok(p.inv.items.some((it) => it.id === 'crown_of_vael'));
  assert.ok(p.lore.includes('lore_seal') && p.lore.includes('lore_mend'));
  assert.deepEqual(p.endings, { mend: 1 });
  assert.equal(p.dims.dim_unmade.bestTime, 300);
  // The story's keys are gone, the gate is shut, and the tale picks up at the isles.
  for (const s of [...SIGILS, ...SHARDS, 'singular_key']) assert.ok(!p.inv.stacks[s], s);
  assert.equal(p.flags.gateOpen, false);
  assert.equal(p.ending, null);
  assert.equal(OBJECTIVES[p.objectives.index].id, ASCENSION.resumeAt);
  // And it can be done again once this cycle ends.
  chooseEnding(p, 'end');
  ascend(p);
  assert.equal(p.cycle, 2);
});

test('Ascension makes the world tougher and richer, up to the level cap', () => {
  assert.equal(ascendLevel(10, 0), 10);
  assert.equal(ascendLevel(10, 1), 10 + ASCENSION.levels);
  assert.equal(ascendLevel(290, 2), 300);
  assert.deepEqual(ascendBonus(0), { xp: 1, loot: 1, elite: 0 });
  const b = ascendBonus(2);
  assert.ok(b.xp > 1 && b.loot > 1 && b.elite > 0);
  const zone = { type: 'cave', layer: 3 };
  assert.ok(eliteChance(ZONES.cave_3, zone, WAVES, 2) > eliteChance(ZONES.cave_3, zone, WAVES, 0));
});
