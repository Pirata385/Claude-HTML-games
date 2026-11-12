const test = require('node:test');
const assert = require('node:assert');
const AM = require('./load.js');

test('items roll with valid rarity, affixes and names', () => {
  const rng = AM.makeRng(42);
  for (let i = 0; i < 500; i++) {
    const it = AM.rollItem(rng, { ilvl: 1 + (i % 30) });
    assert.ok(AM.RARITY[it.rarity]);
    assert.ok(it.affixes.length <= 3);
    assert.strictEqual(new Set(it.affixes.map((a) => a.id)).size, it.affixes.length);
    for (const a of it.affixes) assert.ok(AM.AFFIXES[a.id].slots.includes(it.slot));
    assert.ok(it.name && it.name.length > 2);
    if (it.slot === 'weapon') assert.ok(AM.WEAPONS[it.base]);
    assert.ok(AM.itemLines(it).length > 0);
  }
});

test('legendaries carry unique effects', () => {
  const rng = AM.makeRng(7);
  const it = AM.rollItem(rng, { slot: 'ring', rarity: 'legendary', ilvl: 5 });
  assert.strictEqual(it.unique, 'echoring');
});

test('crafting consumes materials and fails without them', () => {
  const rng = AM.makeRng(1);
  const inv = AM.newInventory();
  const r = AM.RECIPES.find((x) => x.id === 'potion');
  assert.strictEqual(AM.craft(inv, r, { gold: 0, level: 1 }, rng).ok, false);
  AM.addMats(inv, { herb: 2, gel: 1 });
  const before = inv.cons.potion;
  assert.strictEqual(AM.craft(inv, r, { gold: 0, level: 1 }, rng).ok, true);
  assert.strictEqual(inv.cons.potion, before + 2);
  assert.strictEqual(inv.mats.herb, 0);
  const sw = AM.RECIPES.find((x) => x.id === 'w_sword');
  AM.addMats(inv, sw.cost);
  const res = AM.craft(inv, sw, { gold: 100, level: 4 }, rng);
  assert.ok(res.ok && res.made.base === 'sword' && res.made.ilvl === 4 && res.made.rarity !== 'common');
});

test('drops scale with rank', () => {
  const g = AM.fuse('wolf', 'frog', 0);
  const rng = AM.makeRng(3);
  let normal = 0, boss = 0;
  for (let i = 0; i < 200; i++) {
    normal += AM.rollDrops(rng, { genome: g, level: 5, rank: 'normal' }, {}).gold;
    boss += AM.rollDrops(rng, { genome: g, level: 5, rank: 'boss' }, {}).gold;
  }
  assert.ok(boss > normal * 5);
  const d = AM.rollDrops(rng, { genome: g, level: 5, rank: 'boss' }, {});
  assert.ok(d.items.length >= 1 && Object.keys(d.dna).length >= 1);
});

test('salvage and upgrades', () => {
  const it = AM.rollItem(AM.makeRng(9), { slot: 'armor', rarity: 'epic', ilvl: 3 });
  assert.ok(AM.salvageYield(it).essence > 0);
  const c1 = AM.upgradeCost(it);
  it.plus = 4;
  assert.ok(AM.upgradeCost(it).gold > c1.gold);
  assert.ok(AM.sellValue(it) > 0);
});
