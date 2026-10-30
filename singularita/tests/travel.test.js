import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canEnter, isleList, openGate, ownedSigils } from '../js/systems/travel.js';
import { updraftArc, FLIGHT_TIME } from '../js/world/updraft.js';
import { newProfile } from '../js/systems/save.js';
import { addStack } from '../js/systems/inventory.js';
import { SIGILS } from '../js/data/materials.js';
import { ISLES } from '../js/data/zones.js';

const fresh = (level = 1) => { const p = newProfile({ name: 'Tess', classId: 'swordsman', slot: 0, seed: 77 }); p.level = level; return p; };

test('isles open by level', () => {
  const r = canEnter(fresh(50), 'isle_air');
  assert.equal(r.ok, false);
  assert.match(r.reason, /level 66/);
  assert.equal(canEnter(fresh(66), 'isle_air').ok, true);
  assert.equal(canEnter(fresh(70), 'isle_fire').ok, false);
});

test('the Core needs all four sigils and an opened gate', () => {
  const p = fresh(110);
  assert.match(canEnter(p, 'cave_8').reason, /sigil/i);
  for (const s of SIGILS.slice(0, 3)) addStack(p.inv, s, 1);
  assert.equal(ownedSigils(p).length, 3);
  const r = openGate(p);
  assert.equal(r.ok, false);
  assert.deepEqual(r.missing, ['sigil_stone']);
  assert.equal(canEnter(p, 'cave_8').ok, false);
  addStack(p.inv, 'sigil_stone', 1);
  assert.equal(canEnter(p, 'cave_8').ok, false, 'the gate must be opened first');
  assert.equal(openGate(p).ok, true);
  assert.equal(p.flags.gateOpen, true);
  assert.equal(canEnter(p, 'cave_8').ok, true);
  assert.equal(canEnter(fresh(90), 'cave_8').ok, false);
});

test('the Wayshrine lists every isle with its boss and sigil', () => {
  const p = fresh(80);
  addStack(p.inv, 'sigil_tide', 1);
  const list = isleList(p);
  assert.deepEqual(list.map((x) => x.id), ISLES);
  const water = list.find((x) => x.id === 'isle_water');
  assert.equal(water.sigil, 'sigil_tide');
  assert.equal(water.hasSigil, true);
  assert.ok(water.boss && water.name);
  assert.equal(list.find((x) => x.id === 'isle_fire').ok, true);
  assert.equal(list.find((x) => x.id === 'isle_air').hasSigil, false);
});

test('updraft flight arcs from pad to pad above both', () => {
  const u = { x: 10.5, z: 20.5, h: 8, to: { x: 40.5, z: 8.5, h: 14 } };
  const a = updraftArc(u, 0), b = updraftArc(u, 1), mid = updraftArc(u, 0.5);
  assert.deepEqual([a.x, a.y, a.z], [10.5, 8, 20.5]);
  assert.deepEqual([b.x, b.y, b.z], [40.5, 14, 8.5]);
  assert.ok(mid.y > 14 + 3);
  for (let t = 0; t <= 1; t += 0.05) assert.ok(updraftArc(u, t).y >= 8 - 1e-9);
  assert.ok(FLIGHT_TIME > 1 && FLIGHT_TIME < 4);
});
