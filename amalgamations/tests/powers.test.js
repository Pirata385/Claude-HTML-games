const test = require('node:test');
const assert = require('node:assert');
const AM = require('./load.js');

test('at least 16 base powers and a complete element table', () => {
  assert.ok(AM.POWER_IDS.length >= 16);
  const els = Object.keys(AM.ELEMENTS);
  assert.strictEqual(Object.keys(AM.ELEMENT_COMBOS).length, (els.length * (els.length - 1)) / 2);
  for (const id of AM.POWER_IDS) assert.ok(els.includes(AM.POWERS[id].element), id);
});

test('every ordered power fusion is valid and named uniquely', () => {
  const names = new Set();
  let n = 0;
  for (const a of AM.POWER_IDS) for (const b of AM.POWER_IDS) {
    if (a === b) continue;
    const s = AM.fusePowers(a, b);
    n++;
    const where = `${a}+${b}`;
    for (const k of ['dmg', 'cd', 'energy']) assert.ok(Number.isFinite(s[k]) && s[k] >= 0, `${where} ${k}`);
    assert.ok(s.cd >= 1 && s.cd <= 30, where + ' cd');
    assert.ok(s.energy <= 80, where + ' energy');
    assert.ok(s.effects.length <= 4, where + ' effects');
    for (const e of s.effects) assert.ok(AM.POWER_EFFECT_TEXT[e.type], `${where} effect ${e.type}`);
    assert.ok(s.combo && s.name && s.desc, where + ' text');
    assert.ok(AM.isHex(s.color), where + ' colour');
    assert.strictEqual(s.shape, AM.POWERS[a].shape);
    for (const v of Object.values(s.params)) assert.ok(Number.isFinite(v), where + ' param');
    names.add(s.name);
  }
  assert.strictEqual(n, AM.POWER_IDS.length * (AM.POWER_IDS.length - 1));
  assert.strictEqual(names.size, n);
});

test('fusion order matters', () => {
  const a = AM.fusePowers('fireball', 'frostnova'), b = AM.fusePowers('frostnova', 'fireball');
  assert.notStrictEqual(a.shape, b.shape);
  assert.notStrictEqual(a.name, b.name);
  assert.throws(() => AM.fusePowers('fireball', 'fireball'));
});

test('powerSpec resolves base and fused ids', () => {
  assert.strictEqual(AM.powerSpec('fireball').fused, false);
  assert.strictEqual(AM.powerSpec('fireball+chainlightning').fused, true);
  assert.ok(AM.powerFusionCost('fireball', 'chainlightning') > 0);
});
