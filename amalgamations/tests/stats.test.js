const test = require('node:test');
const assert = require('node:assert');
const AM = require('./load.js');

const g = AM.fuse('wolf', 'turtle', 0);
const base = (o) => AM.computeStats(Object.assign({ genome: g, level: 1, nodes: [], equipment: {} }, o));

test('level curve and xp grow', () => {
  for (let l = 1; l < 80; l++) assert.ok(AM.xpToNext(l + 1) > AM.xpToNext(l));
  assert.ok(AM.killXp(10, 10, 'elite') > AM.killXp(10, 10, 'normal'));
  assert.ok(AM.killXp(12, 10) > AM.killXp(8, 10));
});

test('stats scale with level', () => {
  const s1 = base({}), s10 = base({ level: 10 });
  assert.ok(s10.maxHp > s1.maxHp && s10.atk > s1.atk && s10.def > s1.def);
  assert.strictEqual(s1.powerSlots, 2);
  assert.strictEqual(base({ level: 5 }).powerSlots, 3);
});

test('gear and affixes apply', () => {
  const sword = { slot: 'weapon', base: 'sword', rarity: 'rare', ilvl: 1, plus: 0, affixes: [{ id: 'dmgPct', v: 10 }, { id: 'critChance', v: 5 }] };
  const s0 = base({}), s1 = base({ equipment: { weapon: sword } });
  assert.ok(s1.weaponDmg > 0);
  assert.ok(Math.abs(s1.critChance - s0.critChance - 0.05) < 1e-9);
  assert.ok(AM.basicDamage(s1) > 0);
  const plus = Object.assign({}, sword, { plus: 5 });
  assert.ok(base({ equipment: { weapon: plus } }).weaponDmg > s1.weaponDmg);
  const crown = { slot: 'helmet', rarity: 'legendary', unique: 'hollowcrown', ilvl: 1, plus: 0, affixes: [] };
  assert.strictEqual(base({ level: 5, equipment: { helmet: crown } }).powerSlots, 4);
});

test('skill tree mods and keystones apply', () => {
  const s = base({ nodes: ['guardian.root', 'guardian.r20'] });
  assert.ok(s.def > base({}).def);
  const chim = base({ nodes: ['primal.key'] });
  const plain = base({});
  assert.ok(chim.critChance > plain.critChance, 'Chimera Heart raises trait strength');
});

test('defence mitigates and pierce ignores it', () => {
  assert.ok(AM.mitigate(100, 50, 1) < 100);
  assert.ok(AM.mitigate(100, 50, 1, 1) === 100);
  assert.ok(AM.mitigate(100, 50, 20) > AM.mitigate(100, 50, 1));
});

test('monsters scale by rank', () => {
  const n = AM.monsterStats(g, 5, 'normal'), e = AM.monsterStats(g, 5, 'elite'), b = AM.monsterStats(g, 5, 'boss');
  assert.ok(b.maxHp > e.maxHp && e.maxHp > n.maxHp);
});

test('wild creatures attack only when provoked, guarding, or far stronger', () => {
  assert.strictEqual(AM.wildIsHostile({ level: 1 }, 1), false);
  assert.strictEqual(AM.wildIsHostile({ level: 1 + AM.HOSTILE_GAP - 1 }, 1), false);
  assert.strictEqual(AM.wildIsHostile({ level: 1 + AM.HOSTILE_GAP }, 1), true);
  assert.strictEqual(AM.wildIsHostile({ level: 3, provoked: true }, 10), true);
  assert.strictEqual(AM.wildIsHostile({ level: 3, guard: true }, 10), true);
  assert.strictEqual(AM.wildIsHostile({ level: 12 }, 10), false, 'levelling up makes creatures leave you alone again');
});
