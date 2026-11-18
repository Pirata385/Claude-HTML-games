'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { load } = require('./load');
const PA = load('src/core/config.js', 'src/core/util.js', 'src/core/rng.js', 'src/farm/items.js', 'src/farm/crops.js');
const Cr = PA.Crops;
const mk = (id) => ({ id, x: 1, z: 2, days: 0, wet: false, dead: false });

test('16 crops, four per season, each with seeds sold and a harvest item', () => {
  assert.strictEqual(Object.keys(Cr.DEFS).length, 16);
  for (let s = 0; s < 4; s++) assert.strictEqual(Object.values(Cr.DEFS).filter((d) => d.seasons.includes(s)).length >= 4, true);
  for (const id in Cr.DEFS) { assert.ok(PA.Items.get(id), id); assert.ok(PA.Items.get(id + '_seeds'), id + ' seeds'); }
});

test('crops grow only on watered days', () => {
  const c = mk('parsnip');
  Cr.grow(c, 0, false); assert.strictEqual(c.days, 0);
  c.wet = true; Cr.grow(c, 0, false); assert.strictEqual(c.days, 1);
  assert.strictEqual(c.wet, false, 'soil dries overnight');
});

test('rain waters everything', () => {
  const c = mk('parsnip');
  Cr.grow(c, 0, true); assert.strictEqual(c.days, 1);
  assert.strictEqual(c.wet, true, 'still wet after a rainy morning');
});

test('ready after its growth days; regrowing crops come back', () => {
  const c = mk('parsnip');
  for (let i = 0; i < Cr.DEFS.parsnip.days; i++) { c.wet = true; Cr.grow(c, 0, false); }
  assert.ok(Cr.ready(c));
  const s = mk('strawberry');
  for (let i = 0; i < Cr.DEFS.strawberry.days; i++) { s.wet = true; Cr.grow(s, 0, false); }
  assert.ok(Cr.ready(s));
  const out = Cr.harvest(s);
  assert.strictEqual(out.id, 'strawberry');
  assert.ok(!out.remove, 'regrows');
  assert.ok(!Cr.ready(s));
  assert.ok(Cr.harvest(mk('parsnip')) === null, 'not ready');
});

test('out of season crops wither', () => {
  const c = mk('parsnip'); c.wet = true;
  Cr.grow(c, 1, false);
  assert.ok(c.dead);
});
