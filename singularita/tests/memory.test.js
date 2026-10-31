import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MEMORY_TRAITS, memoryOf, setMemory, withMemory } from '../js/systems/memory.js';
import { computeStats } from '../js/systems/stats.js';
import { ITEMS } from '../js/data/items.js';
import { newProfile } from '../js/systems/save.js';

const fresh = (cls = 'mage') => { const p = newProfile({ name: 'Tess', classId: cls, slot: 0, seed: 7 }); p.level = 250; return p; };
const sword = ITEMS.swordsman_weapon_singularita, staff = ITEMS.mage_weapon_singularita;

test('Singularita remembers the traits of every lower material, but not its own', () => {
  assert.ok(MEMORY_TRAITS.includes('ember') && MEMORY_TRAITS.includes('chromatic') && MEMORY_TRAITS.includes('light'));
  assert.ok(!MEMORY_TRAITS.includes('singular'));
  const p = fresh();
  const m = memoryOf(p, staff);
  assert.equal(m.length, 2);
  assert.notEqual(m[0], m[1]);
  assert.deepEqual(memoryOf(p, ITEMS.mage_weapon_diamond), [], 'other gear remembers nothing');
});

test('choosing what it remembers: two different known traits, at any time', () => {
  const p = fresh();
  assert.equal(setMemory(p, staff, ['ember', 'rime']).ok, true);
  assert.deepEqual(memoryOf(p, staff), ['ember', 'rime']);
  assert.equal(setMemory(p, staff, ['ember', 'ember']).ok, false);
  assert.equal(setMemory(p, staff, ['ember', 'singular']).ok, false);
  assert.equal(setMemory(p, staff, ['ember', 'nonsense']).ok, false);
  assert.equal(setMemory(p, staff, ['ember']).ok, false);
  assert.equal(setMemory(p, ITEMS.mage_weapon_diamond, ['ember', 'rime']).ok, false, 'only Singularita remembers');
  assert.deepEqual(memoryOf(p, staff), ['ember', 'rime'], 'failed choices change nothing');
});

test('the remembered traits really change the stats, and changing them changes the stats again', () => {
  const p = fresh('swordsman');
  setMemory(p, sword, ['ember', 'rime']);
  let st = computeStats(p, withMemory(p, [sword]));
  assert.ok(st.burnChance > 0 && st.chillChance > 0);
  assert.ok(st.collapse >= 1, 'Singularita collapses');
  setMemory(p, sword, ['umbral', 'featherweight']);
  st = computeStats(p, withMemory(p, [sword]));
  assert.equal(st.burnChance, 0);
  assert.ok(st.critLifesteal > 0 && st.attackSpeed > computeStats(p, [sword]).attackSpeed);
  // Other gear passes through untouched.
  const d = ITEMS.swordsman_weapon_diamond;
  assert.equal(withMemory(p, [d])[0], d);
});
