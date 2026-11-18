'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { load } = require('./load');
const PA = load('src/core/config.js', 'src/core/util.js', 'src/farm/items.js', 'src/farm/inventory.js');

test('item registry: every item has a name, a short ASCII icon and a price', () => {
  const all = PA.Items.all();
  assert.ok(all.length >= 90, 'at least 90 items, got ' + all.length);
  for (const it of all) {
    assert.ok(it.name && it.icon && it.icon.length <= 3 && /^[\x20-\x7e]+$/.test(it.icon), it.id);
    assert.ok(Number.isFinite(it.price) && it.price >= 0, it.id);
  }
  assert.strictEqual(PA.Items.get('nope'), null);
});

test('stacking to 99 and overflow returns the leftover', () => {
  const inv = new PA.Inventory(4);
  assert.strictEqual(inv.add('wood', 150), 0);
  assert.strictEqual(inv.count('wood'), 150);
  assert.strictEqual(inv.slots[0].n, 99);
  assert.strictEqual(inv.add('stone', 99 * 3), 99);
});

test('remove takes across stacks and refuses when short', () => {
  const inv = new PA.Inventory(6);
  inv.add('wood', 120);
  assert.ok(inv.remove('wood', 110));
  assert.strictEqual(inv.count('wood'), 10);
  assert.ok(!inv.remove('wood', 11));
  assert.strictEqual(inv.count('wood'), 10);
});

test('tools and drawn items never stack', () => {
  const inv = new PA.Inventory(6);
  inv.add('hoe', 1, { lvl: 0 }); inv.add('hoe', 1, { lvl: 1 });
  inv.add('drawn', 1, { drawing: 'd1' }); inv.add('drawn', 1, { drawing: 'd2' });
  assert.strictEqual(inv.slots.filter((s) => s).length, 4);
});

test('swap, sort and JSON roundtrip', () => {
  const inv = new PA.Inventory(9);
  inv.add('parsnip_seeds', 5); inv.add('hoe', 1, { lvl: 0 }); inv.add('wood', 3);
  inv.swap(0, 8);
  assert.strictEqual(inv.slots[8].id, 'parsnip_seeds');
  inv.sort();
  assert.strictEqual(inv.slots[0].id, 'hoe');
  const back = PA.Inventory.from(inv.toJSON());
  assert.deepStrictEqual(back.toJSON(), inv.toJSON());
});
