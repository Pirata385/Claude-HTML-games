const test = require('node:test');
const assert = require('node:assert');
const AM = require('./load.js');

test('skill tree: 6 roots, at least 60 nodes, all reachable from a root', () => {
  const nodes = Object.values(AM.SKILL_NODES);
  assert.ok(nodes.length >= 60);
  const roots = nodes.filter((n) => n.kind === 'root');
  assert.strictEqual(roots.length, 6);
  for (const r of roots) assert.ok(AM.POWERS[r.power], r.id + ' grants a power');
  const seen = new Set(roots.map((r) => r.id));
  const q = [...seen];
  while (q.length) { const id = q.pop(); for (const o of AM.SKILL_ADJ[id]) if (!seen.has(o)) { seen.add(o); q.push(o); } }
  assert.strictEqual(seen.size, nodes.length);
  const branches = new Set(nodes.map((n) => n.branch));
  assert.strictEqual(branches.size, 6);
});

test('buying rules', () => {
  const owned = new Set();
  assert.ok(AM.canBuySkill(owned, 'ranger.root', 1));
  assert.ok(!AM.canBuySkill(owned, 'ranger.r20', 1));
  owned.add('ranger.root');
  assert.ok(AM.canBuySkill(owned, 'ranger.r20', 1));
  assert.ok(!AM.canBuySkill(owned, 'ranger.r20', 0));
  assert.ok(!AM.canBuySkill(owned, 'ranger.key', 5));
});

test('village quests are generated', () => {
  const w = AM.createWorld(21);
  const v = w.structuresNear(0, 0, 5).find((s) => s.type === 'village');
  const qs = AM.villageQuests(w, v, 0, 1, ['shark', 'dragon']);
  assert.strictEqual(qs.length, 3);
  for (const q of qs) { assert.ok(q.title && q.desc && q.need >= 1 && q.reward.xp > 0); }
  assert.deepStrictEqual(AM.villageQuests(w, v, 0, 1, ['shark']).map((q) => q.id), AM.villageQuests(w, v, 0, 1, ['shark']).map((q) => q.id));
  assert.notDeepStrictEqual(AM.villageQuests(w, v, 0, 1, []).map((q) => q.type), AM.villageQuests(w, v, 3, 1, []).map((q) => q.type));
});

test('save round trip', () => {
  const state = { seed: 5, level: 7, nodes: new Set(['brawler.root']), explored: new Set(['0,0', '1,0', '2,0', '-3,5', '7,5']), inv: AM.newInventory(), form: { mother: 'wolf', father: 'eagle', variant: 2 } };
  const back = AM.deserialize(AM.serialize(state));
  assert.strictEqual(back.level, 7);
  assert.ok(back.nodes instanceof Set && back.nodes.has('brawler.root'));
  assert.deepStrictEqual([...back.explored].sort(), [...state.explored].sort());
  assert.deepStrictEqual(AM.importCode(AM.exportCode(state)).form, state.form);
  assert.throws(() => AM.importCode('nope'));
  assert.strictEqual(AM.encodeChunks(new Set(['0,0', '1,0', '2,0'])), '0:0_2');
});
