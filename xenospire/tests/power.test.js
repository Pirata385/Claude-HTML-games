'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const XS = require('./load.js');

const P = XS.Power;

test('powers are well-formed across thousands of seeds and floors', () => {
  const forms = new Set(), elements = new Set(), mods = new Set(), combos = new Set();
  for (let i = 1; i <= 6000; i++) {
    const floor = 1 + (i % 40);
    const d = P.generate(i * 2246822519, floor);
    forms.add(d.form); d.elements.forEach((e) => elements.add(e)); d.mods.forEach((m) => mods.add(m));
    if (d.combo) combos.add(d.combo.form);
    assert.ok(P.FORMS[d.form], d.form);
    assert.ok(['line', 'cone', 'lob', 'zone', 'dash', 'self', 'wall'].includes(d.aim), d.aim);
    assert.ok(d.tier >= 0 && d.tier <= 3);
    assert.equal(d.elements.length, d.tier === 3 ? 2 : 1);
    for (const e of d.elements) assert.ok(P.ELEMENTS[e]);
    // Tier rules.
    if (d.tier === 0) { assert.equal(d.mods.length, 0); assert.ok(!d.combo); }
    if (d.tier === 1) { assert.ok(d.mods.length >= 1 && d.mods.length <= 2, `raro ${d.mods}`); assert.ok(!d.combo); }
    if (d.tier >= 2) { assert.ok(d.combo && P.SUBS[d.combo.form], 'épico has a combo'); assert.ok(d.combo.damage >= 1); }
    // Modifiers: compatible with the form, no duplicates, no mutual exclusions.
    assert.equal(new Set(d.mods).size, d.mods.length);
    for (const m of d.mods) {
      assert.ok(P.MODS[m].forms.includes(d.form), `${m} on ${d.form}`);
      for (const x of P.MODS[m].excludes || []) assert.ok(!d.mods.includes(x), `${m} with ${x}`);
      if (P.MODS[m].anomalous) assert.equal(d.tier, 3);
    }
    for (const k of ['cooldown', 'damage', 'radius', 'knock', 'terrain', 'expected', 'budget']) assert.ok(Number.isFinite(d[k]) && d[k] >= 0, `${k}=${d[k]}`);
    assert.ok(d.damage >= 1 && d.cooldown > 0.5);
    // Text: no unfilled placeholders, nothing undefined.
    const text = [d.name, d.sub || '', d.flavor, ...d.desc].join(' | ');
    assert.ok(!/undefined|NaN|\{|\}/.test(text), text);
    assert.ok(d.name.length > 3);
    assert.ok(d.desc.length >= 2);
    if (d.combo) assert.match(d.sub || d.name, / com /);
  }
  assert.equal(forms.size, Object.keys(P.FORMS).length, 'every form appears');
  assert.equal(elements.size, Object.keys(P.ELEMENTS).length, 'every element appears');
  assert.ok(mods.size >= Object.keys(P.MODS).length - 1);
  assert.equal(combos.size, Object.keys(P.SUBS).length, 'every combo payload appears');
});

test('tiers: common is most frequent, anomalous is very rare', () => {
  const n = [0, 0, 0, 0];
  for (let i = 1; i <= 4000; i++) n[P.tierFor(i * 7, 1)]++;
  assert.ok(n[0] > n[1] && n[1] > n[2] && n[2] > n[3]);
  assert.ok(n[3] / 4000 < 0.05 && n[3] > 0);
});

test('balance: expected value tracks the floor/tier budget (combos included)', () => {
  let checked = 0;
  for (let i = 1; i <= 4000; i++) {
    const floor = 1 + (i % 30);
    const d = P.generate(i * 97 + 13, floor);
    if (d.damage < 4 || (d.combo && d.combo.damage < 5)) continue; // rounding noise dominates tiny numbers
    const err = Math.abs(d.expected - d.budget) / d.budget;
    assert.ok(err < 0.13, `${d.form}${d.combo ? '+' + d.combo.form : ''} floor ${floor}: expected ${d.expected.toFixed(2)} vs budget ${d.budget.toFixed(2)}`);
    checked++;
  }
  assert.ok(checked > 2500);
  assert.ok(P.budget(10, 0) > P.budget(1, 0) && P.budget(1, 3) > P.budget(1, 0));
});

test('generation is deterministic and re-weaving keeps identity', () => {
  const a = P.generate(4242, 5), b = P.generate(4242, 5);
  assert.deepEqual(a, b);
  const up = P.generate(4242, 12, { tier: a.tier, reinforced: true });
  assert.equal(up.form, a.form);
  assert.deepEqual(up.elements, a.elements);
  assert.deepEqual(up.mods, a.mods);
  assert.equal(up.name, a.name);
  assert.ok(up.damage >= a.damage);
  assert.match(up.flavor, /^Re-tecido no andar 12/);
});

test('filters: forms, elements and tier can be forced (Test Room)', () => {
  for (let i = 0; i < 200; i++) {
    const d = P.generate(i * 31 + 7, 5, { tier: 2, forms: ['grenade', 'meteor'], elements: ['earth'] });
    assert.ok(['grenade', 'meteor'].includes(d.form));
    assert.equal(d.elements[0], 'earth');
    assert.equal(d.tier, 2);
    assert.ok(d.combo);
  }
});

test('Portuguese names agree in gender', () => {
  const fem = new Set();
  for (const F of Object.values(P.FORMS)) for (const [noun, g] of F.nouns) if (g === 'f' && !noun.includes(' ')) fem.add(noun);
  const mascAdj = /^(Plasmático|Criogênico|Tóxico|Elétrico|Cristalino|Sônico|Psíquico|Teleguiado|Explosivo|Vampírico|Escavador|Múltiplo|Espiralado|Encadeado|Magnético|Espelhado|Pesado|Ígneo|Ácido|Voltaico|Prismático|Relativístico|Faminto|Demolidor|Telúrico|Rochoso|Luminoso|Curvo|Sinuoso|Subterrâneo|Fragmentário|Retardado)$/;
  let checked = 0;
  for (let i = 1; i <= 5000; i++) {
    const d = P.generate(i * 31337, 3);
    const technical = (d.sub || d.name).replace(/ Nº \d+$/, '').replace(/ com .*$/, '');
    const words = technical.split(' ');
    if (!fem.has(words[0])) continue;
    for (const w of words.slice(1, 3)) {
      if (w === 'do' || w === 'de' || w === 'da') break;
      assert.ok(!mascAdj.test(w.split('-').pop()), `"${technical}"`);
    }
    checked++;
  }
  assert.ok(checked > 300);
});

test('AI drafting scores are finite for every personality', () => {
  const offer = [0, 1, 2].map((k) => P.generate(900 + k, 4));
  for (const p of ['agressivo', 'cauteloso', 'exibido', 'caotico', 'estrategista']) {
    for (const d of offer) assert.ok(Number.isFinite(P.draftScore(d, p, [])));
  }
});
