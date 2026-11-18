'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { load } = require('./load');
const PA = load('src/core/config.js', 'src/core/util.js', 'src/core/rng.js', 'src/farm/items.js', 'src/farm/animals.js', 'src/life/wildlife.js', 'src/life/fishing.js');

test('fed animals produce, hungry ones do not and get sad', () => {
  const a = { kind: 'chicken', happy: 50, fed: true, petted: true, age: 5 };
  const out = PA.Animals.overnight(a);
  assert.strictEqual(out, 'egg');
  assert.ok(a.happy > 50);
  const b = { kind: 'cow', happy: 50, fed: false, petted: false, age: 5 };
  assert.strictEqual(PA.Animals.overnight(b), null);
  assert.ok(b.happy < 50);
  const s = { kind: 'sheep', happy: 90, fed: true, petted: true, age: 5, since: 0 };
  const got = [1, 2, 3].map(() => { s.fed = true; return PA.Animals.overnight(s); });
  assert.deepStrictEqual(got.filter(Boolean), ['wool'], 'sheep give wool every few days');
});

test('crows only eat crops a scarecrow does not cover', () => {
  const crops = []; for (let x = 0; x < 40; x++) crops.push({ map: 'overworld', x: 40 + x, z: 3, id: 'parsnip' });
  const scare = [{ id: 'scarecrow', map: 'overworld', x: 44, z: 3 }];
  const eaten = PA.Wildlife.crowTargets(crops, scare, () => 0); // rng always 0 -> every unprotected crop is hit
  assert.ok(eaten.length > 0);
  for (const c of eaten) assert.ok(Math.abs(c.x - 44) > 8, 'protected crops are safe');
  assert.strictEqual(PA.Wildlife.crowTargets(crops.slice(0, 10), [], () => 0).length, 0, 'small farms are left alone');
});

test('fishing: the catch depends on the water, season and time', () => {
  const r = PA.RNG.mulberry32(3);
  for (let i = 0; i < 30; i++) {
    const f = PA.Fishing.pick('lake', 1, 600, r);
    const def = PA.Fishing.FISH.find((q) => q[0] === f);
    assert.ok(def[1].includes('lake') && def[2].includes(1), f);
  }
  const m = PA.Fishing.pick('mine', 0, 900, r);
  assert.ok(['inkfish', 'eel', 'catfish'].includes(m), m);
});
