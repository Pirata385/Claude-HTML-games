import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rollRewards } from '../js/systems/rewards.js';
import { BOSSES } from '../js/data/bosses.js';
import { newProfile } from '../js/systems/save.js';
import { addStack } from '../js/systems/inventory.js';
import { makeRng } from '../js/core/rng.js';

const fresh = () => newProfile({ name: 'Tess', classId: 'swordsman', slot: 0, seed: 77 });
const mats = (loot) => Object.fromEntries(loot.filter((l) => l.material).map((l) => [l.material, l.n]));

test('a guardian gives its sigil on the first victory', () => {
  const loot = rollRewards(BOSSES.ronin_east_wind, fresh(), makeRng(1), true);
  const m = mats(loot);
  assert.equal(m.sigil_wind, 1);
  assert.ok(m.eastwind_silk >= 2 && m.eastwind_silk <= 4);
  assert.ok(loot.some((l) => l.item === 'ronin_sash'), 'first kill unique');
});

test('a sigil already carried is never given again', () => {
  const p = fresh();
  addStack(p.inv, 'sigil_wind', 1);
  const never = { next: () => 0.999, int: (lo) => lo, range: (lo) => lo, chance: () => false, pick: (a) => a[0], weighted: (a) => a[0], shuffle: (a) => a };
  const loot = rollRewards(BOSSES.ronin_east_wind, p, never, false);
  assert.equal(mats(loot).sigil_wind, undefined);
  assert.ok(mats(loot).eastwind_silk >= 2, 'the rest of the loot still comes');
  assert.ok(!loot.some((l) => l.item === 'ronin_sash'), 'no unique when the roll misses');
});

test('island bosses keep their materials', () => {
  for (const id of ['slime_prince', 'silverback_emperor']) {
    const loot = rollRewards(BOSSES[id], fresh(), makeRng(4), true);
    assert.ok(loot.some((l) => l.material), id);
  }
});
