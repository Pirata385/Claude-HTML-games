import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isDebug, setLevel, giveItem, searchItems, bossHome, teleportSpots, DEBUG_NAME } from '../js/systems/debug.js';
import { newProfile } from '../js/systems/save.js';
import { BOSSES } from '../js/data/bosses.js';
import { ZONES, ZONE_ORDER } from '../js/data/zones.js';
import { generateZone } from '../js/world/gen/index.js';
import { MAX_LEVEL, POINTS_PER_LEVEL } from '../js/systems/progression.js';

const fresh = (name = DEBUG_NAME) => newProfile({ name, classId: 'mage', slot: 0, seed: 3 });

test('only a character named exactly "DeBug" is in debug mode', () => {
  assert.equal(DEBUG_NAME, 'DeBug');
  assert.equal(isDebug(fresh('DeBug')), true);
  for (const n of ['debug', 'Debug', 'DEBUG', 'DeBugger', 'Tess']) assert.equal(isDebug(fresh(n)), false, n);
  assert.equal(isDebug(null), false);
});

test('setting the level clamps it, clears the bar and gives that level\'s attribute points', () => {
  const p = fresh();
  p.attrs.str = 10; p.xp = 55;
  assert.equal(setLevel(p, 50), 50);
  assert.equal(p.level, 50); assert.equal(p.xp, 0);
  assert.equal(p.attrPoints, 49 * POINTS_PER_LEVEL - 10, 'points already spent stay spent');
  assert.equal(setLevel(p, 9999), MAX_LEVEL);
  assert.equal(setLevel(p, -4), 1);
  assert.equal(p.attrPoints, 0, 'never negative');
  assert.equal(setLevel(p, 'x'), 1, 'nonsense is level 1');
});

test('giving items: materials and consumables stack, gear and tools come as pieces', () => {
  const p = fresh();
  assert.equal(giveItem(p, 'diamond', 25), true);
  assert.equal(p.inv.stacks.diamond, 25);
  assert.equal(giveItem(p, 'emblem_king', 2), true);
  assert.equal(p.inv.stacks.emblem_king, 2);
  const before = p.inv.items.length;
  assert.equal(giveItem(p, 'mage_weapon_singularita', 2), true);
  assert.equal(p.inv.items.filter((i) => i.id === 'mage_weapon_singularita').length, 2);
  assert.equal(p.inv.items.length, before + 2);
  assert.equal(new Set(p.inv.items.map((i) => i.uid)).size, p.inv.items.length, 'every piece has its own uid');
  assert.equal(giveItem(p, 'no_such_thing', 1), false);
  assert.equal(giveItem(p, 'wood', 0), false);
});

test('the item search finds materials, consumables, gear and tools by name or id', () => {
  const kinds = new Set(searchItems('', 1000).map((r) => r.kind));
  for (const k of ['material', 'consumable', 'gear', 'tool']) assert.ok(kinds.has(k), k);
  const em = searchItems('emblem');
  assert.ok(em.length >= 5 && em.every((r) => /emblem/i.test(r.name + r.id)));
  assert.ok(searchItems('singularita').some((r) => r.id === 'mage_weapon_singularita'));
  assert.equal(searchItems('', 10).length, 10);
});

test('every boss has a home the debug menu can take you to', () => {
  for (const [id, b] of Object.entries(BOSSES)) {
    const home = bossHome(id);
    assert.ok(home && ZONES[home.zone], `${id}: ${JSON.stringify(home)}`);
    if (!b.zone) assert.equal(home.zone, 'island', id);
  }
  assert.deepEqual(bossHome('ronin_east_wind'), { zone: 'isle_air', kind: 'isle' });
  assert.deepEqual(bossHome('iron_jailer'), { zone: 'dim_dungeon', kind: 'dimension', floor: 5 });
  assert.equal(bossHome('siamese').zone, 'dim_twins');
  assert.equal(bossHome('fracture').zone, 'dim_unmade');
  assert.equal(bossHome('nobody'), null);
});

test('every zone offers named teleport spots, each on open ground', () => {
  for (const id of ZONE_ORDER) {
    const z = generateZone(id), spots = teleportSpots(z);
    assert.ok(spots.length >= 2, `${id}: ${spots.length} spots`);
    for (const s of spots) {
      assert.ok(s.label, `${id}: a spot without a name`);
      assert.ok(z.grid.walkable(Math.floor(s.x), Math.floor(s.z)), `${id}: ${s.label} at ${s.x},${s.z} is not open ground`);
    }
  }
});
