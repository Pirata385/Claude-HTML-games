'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { load } = require('./load');
const PA = load('src/core/config.js', 'src/core/util.js', 'src/core/rng.js', 'src/systems/state.js', 'src/farm/items.js', 'src/farm/inventory.js', 'src/draw/words.js', 'src/town/npcs.js', 'src/town/dialogue.js', 'src/town/shops.js', 'src/town/quests.js');

test('13 townsfolk with homes, birthdays and gift tastes that exist', () => {
  assert.strictEqual(PA.NPC_DATA.length, 13);
  const days = new Set();
  for (const n of PA.NPC_DATA) {
    assert.ok(n.name && n.home, n.id);
    for (const id of [...n.loves, ...n.likes, ...n.hates]) assert.ok(PA.Items.get(id), n.id + ' gift ' + id);
    const k = n.birthday[0] + ':' + n.birthday[1]; assert.ok(!days.has(k), 'unique birthday ' + k); days.add(k);
  }
});

test('schedules place everyone somewhere at any time of day', () => {
  for (const n of PA.NPC_DATA) for (let t = 360; t <= 1560; t += 30) {
    const at = PA.Dialogue.whereAt(n, t, { season: 0, day: 3, weather: 'sun', seasonDays: 28 });
    assert.ok(at && at.map && Number.isFinite(at.x) && Number.isFinite(at.z), n.id + ' at ' + t);
  }
});

test('friendship: talking, gifts by taste, birthday bonus, one gift a day', () => {
  const s = PA.newState(1, {});
  const clem = PA.NPC_DATA.find((n) => n.id === 'clem');
  assert.strictEqual(PA.Dialogue.talk(s, 'clem'), 20);
  assert.strictEqual(PA.Dialogue.talk(s, 'clem'), 0, 'only once a day');
  const loved = PA.Dialogue.gift(s, clem, clem.loves[0]);
  assert.strictEqual(loved.points, 80);
  assert.strictEqual(PA.Dialogue.gift(s, clem, clem.likes[0]).points, 0, 'one gift per day');
  s.npcs.clem.giftedToday = false; s.season = clem.birthday[0]; s.day = clem.birthday[1];
  assert.strictEqual(PA.Dialogue.gift(s, clem, clem.hates[0]).points, -320);
  assert.strictEqual(PA.Dialogue.hearts(s, 'clem'), 0);
  s.npcs.clem.pts = 760;
  assert.strictEqual(PA.Dialogue.hearts(s, 'clem'), 3);
});

test('shops: buying spends gold and adds items; you cannot overspend; word cards teach words', () => {
  const s = PA.newState(1, {}); s.gold = 100;
  const inv = new PA.Inventory(12);
  const stock = PA.Shops.stock('store', s);
  const seeds = stock.find((e) => e.id === 'parsnip_seeds');
  assert.ok(seeds);
  assert.ok(PA.Shops.buy(s, inv, seeds, 2));
  assert.strictEqual(s.gold, 100 - seeds.price * 2);
  assert.strictEqual(inv.count('parsnip_seeds'), 2);
  assert.ok(!PA.Shops.buy(s, inv, seeds, 100));
  s.gold = 5000;
  const card = PA.Shops.stock('stationer', s).find((e) => e.word);
  assert.ok(PA.Shops.buy(s, inv, card, 1));
  assert.ok(s.words.includes(card.word));
});

test('torn pages: completing every bundle of a page restores it and unlocks its reward', () => {
  const s = PA.newState(1, {});
  const inv = new PA.Inventory(36);
  const page = PA.Quests.PAGES[0];
  for (const b of page.bundles) for (const [id, n] of b.items) inv.add(id, n);
  for (let i = 0; i < page.bundles.length; i++) assert.ok(PA.Quests.donate(s, inv, 0, i));
  assert.ok(PA.Quests.pageDone(s, 0));
  assert.ok(s.flags[page.unlock]);
});
