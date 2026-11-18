'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { load } = require('./load');
const store = {};
globalThis.localStorage = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } };
const PA = load('src/core/config.js', 'src/core/util.js', 'src/core/rng.js', 'src/systems/state.js', 'src/systems/save.js');

test('save roundtrip keeps the whole state', () => {
  const s = PA.newState(42, { name: 'Ada', farm: 'Inkwood' });
  s.gold = 1234; s.words.push('boat'); s.crops.push({ x: 50, z: 3, id: 'parsnip', days: 2, wet: true });
  s.maps.overworld = { edits: [[10, 15, 0], [99, 16, 0]] };
  PA.Save.write(1, s);
  const r = PA.Save.read(1);
  assert.deepStrictEqual(r, JSON.parse(JSON.stringify(s)));
});
test('load tolerates garbage and missing slots', () => {
  store['paperacres.slot2'] = '{bad';
  assert.strictEqual(PA.Save.read(2), null);
  assert.strictEqual(PA.Save.read(3), null);
});
test('list summarises slots; export/import roundtrip', () => {
  const s = PA.newState(7, { name: 'Bo', farm: 'Dot Farm' });
  PA.Save.write(3, s);
  const l = PA.Save.list();
  assert.ok(l.find((e) => e.slot === 3 && e.summary.includes('Dot Farm')));
  const json = PA.Save.exportJSON(3);
  delete store['paperacres.slot3'];
  assert.ok(PA.Save.importJSON(3, json));
  assert.strictEqual(PA.Save.read(3).farm, 'Dot Farm');
  assert.ok(!PA.Save.importJSON(3, '{"nope":1}'));
});
