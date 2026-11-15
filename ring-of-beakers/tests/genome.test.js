'use strict';
const test = require('node:test');
const assert = require('node:assert');
const RB = require('./load.js');
const G = RB.genome, { Rng } = RB.core;

test('gene layout fills every locus exactly once', () => {
  assert.strictEqual(G.GENES.length, G.N_GENES);
  const seen = new Set();
  for (const def of G.TRAIT_LIST) for (const gi of def.genes) { assert.ok(!seen.has(gi), 'locus reused'); seen.add(gi); assert.strictEqual(G.GENES[gi].trait, def.id); }
  for (const def of G.TRAIT_LIST) assert.strictEqual(def.genes.length, def.n);
  const zLinked = G.GENES.filter((g) => g.chr === G.Z_CHR && g.trait).map((g) => g.trait);
  for (const id of ['spur', 'tailLen', 'comb', 'aggression']) assert.ok(zLinked.includes(id), id + ' should have a Z-linked gene');
});

test('trait mapping round-trips', () => {
  for (const def of G.TRAIT_LIST) {
    if (def.switch) continue;
    for (const v of [0, 0.2, 0.5, 0.8, 1]) {
      const back = G.unmapTrait(def, G.mapTrait(def, v));
      assert.ok(Math.abs(back - v) < 1e-9, def.id + ' ' + v + ' -> ' + back);
    }
  }
});

test('fromTargets lands near its targets', () => {
  const rng = new Rng(7);
  const targets = { size: 2.2, legLen: 0.4, neckLen: 2.0, beakHook: 0.9, lit: 0.9 };
  const g = G.fromTargets(targets, ['teeth'], rng, { variation: 0, sex: 'M' });
  for (const id of Object.keys(targets)) {
    const def = G.TRAITS[id], got = G.traitValue(g, id);
    assert.ok(Math.abs(G.unmapTrait(def, got) - G.unmapTrait(def, targets[id])) < 0.06, id + ' got ' + got);
  }
  assert.ok(G.switchOn(g, 'teeth'));
  assert.ok(!G.switchOn(g, 'arms'));
});

test('breeding keeps the layout, gives both sexes and females are hemizygous on Z', () => {
  const rng = new Rng(11);
  const mom = G.random(rng, 'F'), dad = G.random(rng, 'M');
  let males = 0;
  const n = 400;
  for (let i = 0; i < n; i++) {
    const kid = G.breed(mom, dad, rng, { mutRate: 0 });
    assert.strictEqual(kid.a.length, G.N_BASES);
    if (kid.sex === 'M') males++;
    for (let b = 0; b < G.N_BASES; b++) {
      const c = Math.floor(b / G.CHR_LEN);
      // paternal copy comes from one of the father's two copies
      assert.ok(kid.a[b] === dad.a[b] || kid.a[b] === dad.b[b]);
      if (c === G.Z_CHR) { if (kid.sex === 'M') assert.strictEqual(kid.b[b], mom.a[b]); }
      else assert.ok(kid.b[b] === mom.a[b] || kid.b[b] === mom.b[b]);
    }
  }
  assert.ok(males > n * 0.4 && males < n * 0.6, 'sex ratio ' + males / n);
});

test('mutation changes about as many bases as asked', () => {
  const rng = new Rng(3);
  // mutate(): at most n bases change (two hits on the same base can cancel or overlap)
  const g = G.random(rng, 'M'), before = G.clone(g);
  G.mutate(g, rng, 25);
  let changed = 0;
  for (let b = 0; b < G.N_BASES; b++) { if (g.a[b] !== before.a[b]) changed++; if (g.b[b] !== before.b[b]) changed++; }
  assert.ok(changed > 15 && changed <= 25, 'changed ' + changed);
  // breed(): a clone-like cross (both parents homozygous and identical) shows only the mutations
  const flat = G.blank('M');
  const mom = { a: flat.a, b: flat.b, sex: 'F' };
  let muts = 0;
  const kids = 200, rate = 0.01;
  for (let i = 0; i < kids; i++) {
    const kid = G.breed(mom, flat, rng, { mutRate: rate });
    for (let b = 0; b < G.N_BASES; b++) { if (kid.a[b] !== 0) muts++; if (kid.b[b] !== 0) muts++; }
  }
  const expected = kids * G.N_BASES * 2 * rate;
  assert.ok(muts > expected * 0.8 && muts < expected * 1.2, muts + ' mutations, expected about ' + expected);
});

test('serialisation round-trips', () => {
  const rng = new Rng(5);
  const g = G.random(rng, 'F');
  const back = G.deserialize(JSON.parse(JSON.stringify(G.serialize(g))));
  assert.deepStrictEqual(Array.from(back.a), Array.from(g.a));
  assert.deepStrictEqual(Array.from(back.b), Array.from(g.b));
  assert.strictEqual(back.sex, 'F');
  assert.strictEqual(G.hash(back), G.hash(g));
});

test('wild animals classify as their own species', () => {
  const S = RB.species;
  const rng = new Rng(21);
  let ok = 0, n = 0;
  const misses = {};
  for (const id of S.IDS) {
    for (let i = 0; i < 40; i++) {
      const g = S.make(id, rng, { sport: 0 });
      const c = S.classify(g);
      n++;
      if (c.id === id && c.pure) ok++; else misses[id] = (misses[id] || 0) + 1;
    }
  }
  assert.ok(ok / n > 0.93, 'only ' + (100 * ok / n).toFixed(1) + '% classified: ' + JSON.stringify(misses));
});

test('phenotype is deterministic and sane for every species', () => {
  const S = RB.species;
  const rng = new Rng(33);
  for (const id of S.IDS) {
    for (const sex of ['M', 'F']) {
      const g = S.make(id, rng, { sex, sport: 0 });
      const p1 = RB.pheno.express(g), p2 = RB.pheno.express(g);
      for (const key of ['TL', 'TD', 'NL', 'HR', 'LL', 'massRel', 'hpMax', 'speedMax', 'jumpV', 'weightKg']) {
        assert.ok(Number.isFinite(p1[key]) && p1[key] >= 0, id + ' ' + key + ' = ' + p1[key]);
        assert.strictEqual(p1[key], p2[key]);
      }
      assert.ok(p1.hpMax > 5 && p1.hpMax < 900, id + ' hp ' + p1.hpMax);
    }
  }
  const chick = RB.pheno.express(S.make('chicken', rng, { sex: 'M', sport: 0 }), { age: 0 });
  assert.strictEqual(chick.stage, 'chick');
  assert.ok(chick.S < 0.6);
});

test('hybrids blend, and species distance orders sensibly', () => {
  const S = RB.species, rng = new Rng(4);
  const hen = S.make('chicken', rng, { sex: 'F', sport: 0 }), cock = S.make('chicken', rng, { sex: 'M', sport: 0 });
  const ostrich = S.make('ostrich', rng, { sex: 'M', sport: 0 });
  assert.ok(G.distance(hen, cock) < G.distance(hen, ostrich));
  const kid = G.breed(hen, ostrich, rng);
  const size = G.traitValue(kid, 'size');
  assert.ok(size > G.traitValue(hen, 'size') * 0.95 && size < G.traitValue(ostrich, 'size') * 1.05, 'hybrid size ' + size);
  assert.strictEqual(S.blendNames('Ostrich', 'Duck'), 'Ostruck');
});
