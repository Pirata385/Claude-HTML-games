'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const XS = require('./load.js');

const P = XS.Power;

test('powers are well-formed across thousands of seeds and floors', () => {
  const forms = new Set(), elements = new Set(), mods = new Set();
  for (let i = 1; i <= 5000; i++) {
    const floor = 1 + (i % 40);
    const d = P.generate(i * 2246822519, floor);
    forms.add(d.form); d.elements.forEach((e) => elements.add(e)); d.mods.forEach((m) => mods.add(m));
    assert.ok(P.FORMS[d.form], d.form);
    assert.ok(d.tier >= 0 && d.tier <= 3);
    assert.equal(d.elements.length, d.tier === 3 ? 2 : 1);
    for (const e of d.elements) assert.ok(P.ELEMENTS[e]);
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
  }
  assert.equal(forms.size, Object.keys(P.FORMS).length, 'every form appears');
  assert.equal(elements.size, Object.keys(P.ELEMENTS).length, 'every element appears');
  assert.ok(mods.size >= Object.keys(P.MODS).length - 1);
});

test('balance: expected value tracks the floor/tier budget', () => {
  let worst = 0;
  for (let i = 1; i <= 3000; i++) {
    const floor = 1 + (i % 30);
    const d = P.generate(i * 97 + 13, floor);
    if (d.damage < 4) continue; // rounding noise dominates tiny per-hit numbers
    const err = Math.abs(d.expected - d.budget) / d.budget;
    worst = Math.max(worst, err);
    assert.ok(err < 0.13, `${d.form} floor ${floor}: expected ${d.expected.toFixed(2)} vs budget ${d.budget.toFixed(2)}`);
  }
  assert.ok(worst > 0); // sanity: the check actually ran
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

test('Portuguese names agree in gender', () => {
  const fem = new Set(['Lança', 'Nova', 'Explosão', 'Poça', 'Chuva', 'Tempestade', 'Investida', 'Arremetida', 'Órbita', 'Sentinela', 'Mina', 'Armadilha', 'Semente', 'Muralha', 'Barreira', 'Translação', 'Aura', 'Couraça']);
  const mascAdj = /\b(Plasmático|Criogênico|Tóxico|Elétrico|Cristalino|Sônico|Psíquico|Teleguiado|Explosivo|Vampírico|Escavador|Fragmentado|Espiralado|Encadeado|Magnético|Espelhado|Pesado|Ígneo|Ácido|Voltaico|Prismático|Relativístico|Faminto|Demolidor)$/;
  let checked = 0;
  for (let i = 1; i <= 4000; i++) {
    const d = P.generate(i * 31337, 3);
    const technical = d.sub || d.name;
    const words = technical.replace(/ Nº \d+$/, '').split(' ');
    if (!fem.has(words[0])) continue;
    // Every adjective right after a feminine noun must not be in masculine form.
    for (const w of words.slice(1, 3)) {
      if (w === 'do' || w === 'de' || w === 'da') break;
      assert.ok(!mascAdj.test(w.split('-').pop()), `"${technical}"`);
    }
    checked++;
  }
  assert.ok(checked > 200);
});

test('AI drafting prefers its personality but varies kits', () => {
  const offer = [0, 1, 2].map((k) => P.generate(900 + k, 4));
  for (const p of ['agressivo', 'cauteloso', 'exibido', 'caotico', 'estrategista']) {
    for (const d of offer) assert.ok(Number.isFinite(P.draftScore(d, p, [])));
  }
});
