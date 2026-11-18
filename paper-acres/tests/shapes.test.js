'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { load } = require('./load');
const PA = load('src/core/config.js', 'src/core/util.js', 'src/draw/words.js', 'src/ascii/shapes.js', 'src/draw/ink.js');
const P = (x, y) => ({ x, y });
const ALL = PA.Words.ALL.map((w) => w.id);
const top = (strokes, n) => PA.Shapes.rank(PA.Shapes.features(strokes), ALL).slice(0, n).map((r) => r.id);
const circle = (cx, cy, r) => { const s = []; for (let i = 0; i <= 24; i++) { const a = i / 24 * Math.PI * 2; s.push(P(cx + Math.cos(a) * r, cy + Math.sin(a) * r)); } return [s]; };

test('words: about 44, all inanimate things, each with a category and a multiplier', () => {
  assert.ok(PA.Words.ALL.length >= 40);
  const cats = new Set(['structure', 'physics', 'tool', 'combat', 'home']);
  for (const w of PA.Words.ALL) { assert.ok(cats.has(w.cat), w.id); assert.ok(w.mult > 0, w.id); }
  for (const bad of ['dog', 'cat', 'cow', 'chicken', 'bird', 'fish', 'person', 'tree', 'flower', 'horse']) assert.ok(!PA.Words.get(bad), bad + ' must not exist');
  for (const id of PA.START_WORDS_LIST) assert.ok(PA.Words.get(id), id);
});
test('a long horizontal line reads as a bridge or plank', () => {
  const t = top([[P(0, 50), P(200, 52)]], 2);
  assert.ok(t.includes('bridge') || t.includes('plank'), t.join());
});
test('a box reads as a crate', () => {
  assert.ok(top([[P(0, 0), P(60, 0), P(60, 60), P(0, 60), P(0, 0)]], 3).includes('crate'));
});
test('a tall thin drawing reads as a ladder or spear', () => {
  const t = top([[P(0, 0), P(0, 160)], [P(20, 0), P(20, 160)], [P(0, 40), P(20, 40)], [P(0, 80), P(20, 80)], [P(0, 120), P(20, 120)]], 3);
  assert.ok(t.includes('ladder'), t.join());
});
test('a circle reads as something round', () => {
  const t = top(circle(40, 40, 30), 3);
  assert.ok(t.some((id) => ['boulder', 'ball', 'wheel'].includes(id)), t.join());
});
test('ink: cost grows with the drawing, pen costs ink, short supply refuses, eraser refunds half', () => {
  const s = { ink: { graphite: 10, ink: 2 } };
  const inv = { c: { graphite: 1, ink: 0 }, count(id) { return this.c[id] || 0; }, remove(id, n) { if (this.c[id] < n) return false; this.c[id] -= n; return true; } };
  const small = PA.Ink.cost([[P(0, 0), P(60, 0)]], 'plank'), big = PA.Ink.cost([[P(0, 0), P(240, 0)]], 'plank');
  assert.ok(big > small && small >= 1);
  assert.strictEqual(PA.Ink.cost([], 'plank'), 0);
  assert.ok(!PA.Ink.valid([]) && !PA.Ink.valid([[P(0, 0), P(1, 1)]]), 'empty sketch rejected');
  assert.ok(PA.Ink.charge(s, inv, 15, 'pencil'), 'graphite item tops up the lead');
  assert.strictEqual(inv.c.graphite, 0);
  assert.ok(!PA.Ink.charge(s, inv, 5, 'pen'), 'not enough ink');
  const before = s.ink.graphite;
  PA.Ink.refund(s, { cost: 8, medium: 'pencil' });
  assert.strictEqual(s.ink.graphite, before + 4);
});
