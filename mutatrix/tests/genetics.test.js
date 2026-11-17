const test = require('node:test');
const assert = require('node:assert');
const MX = require('./_load');
const { Genetics, Data } = MX;

const design = (o) => Object.assign(Genetics.emptyDesign('K7Q2M'), { slots: [{ theme: 'igneo', pot: 2 }, { theme: 'musical', pot: 1 }, { theme: 'vegetal', pot: 3 }, null, null, null] }, o || {});

test('fita vazia não gera vírus', () => {
  assert.strictEqual(Genetics.synthesize(Genetics.emptyDesign()), null);
});

test('síntese é determinística', () => {
  const a = Genetics.synthesize(design()), b = Genetics.synthesize(design());
  assert.deepStrictEqual(a, b);
  const c = Genetics.synthesize(design({ seed: 'K7Q2N' }));
  assert.notStrictEqual(a.key, c.key);
});

test('quantidade de mutações entre 1 e 4, sem arquétipo repetido', () => {
  for (let i = 0; i < 300; i++) {
    const d = design({ seed: MX.RNG.randomSeedString(5, MX.RNG.make(i).next), chaos: i % 101, virulence: (i * 7) % 101 });
    const v = Genetics.synthesize(d);
    assert.ok(v.mutations.length >= 1 && v.mutations.length <= 4);
    assert.strictEqual(new Set(v.mutations.map((m) => m.arch)).size, v.mutations.length);
    for (const m of v.mutations) {
      assert.ok(Data.ARCHS[m.arch] && Data.THEME[m.theme] && Data.SEV[m.sev]);
    }
    assert.ok(/^Cepa [A-Z]{2}-\d\d, .+ .+$/.test(v.name), v.name);
  }
});

test('código da cepa vai e volta', () => {
  for (let i = 0; i < 200; i++) {
    const r = MX.RNG.make('code' + i);
    const slots = [];
    for (let k = 0; k < 6; k++) slots.push(r.chance(0.6) ? { theme: r.pick(Data.THEMES).id, pot: r.int(1, 3) } : null);
    const d = Genetics.normalizeDesign({ capsid: r.pick(Data.CAPSIDS).id, slots, virulence: r.int(0, 100), chaos: r.int(0, 100), seed: MX.RNG.randomSeedString(5, r.next) });
    const code = Genetics.encode(d);
    assert.match(code, /^MX-[0-9A-Z]{6}-[0-9A-Z]{6}-[0-9A-Z]{6}$/);
    assert.deepStrictEqual(Genetics.decode(code), d);
    assert.deepStrictEqual(Genetics.decode(code.toLowerCase().replace(/-/g, ' ')), d);
  }
});

test('código com erro de digitação é recusado', () => {
  const code = Genetics.encode(design());
  const chars = code.split('');
  const i = 5;
  chars[i] = chars[i] === 'A' ? 'B' : 'A';
  assert.strictEqual(Genetics.decode(chars.join('')), null);
  assert.strictEqual(Genetics.decode('MX-123'), null);
  assert.strictEqual(Genetics.decode(''), null);
});

test('virulência alta deixa as mutações mais graves', () => {
  const avg = (vir) => {
    let s = 0, n = 0;
    for (let i = 0; i < 300; i++) {
      const v = Genetics.synthesize(design({ virulence: vir, seed: MX.RNG.randomSeedString(5, MX.RNG.make('v' + i).next) }));
      for (const m of v.mutations) { s += Genetics.SEV_IDS.indexOf(m.sev); n++; }
    }
    return s / n;
  };
  const low = avg(0), high = avg(100);
  assert.ok(low < 0.6, 'baixa ' + low);
  assert.ok(high > 1.8, 'alta ' + high);
});

test('previsão do analisador revela mais a cada nível', () => {
  const v = Genetics.synthesize(design({ chaos: 0 }));
  const p1 = Genetics.predict(v, 1), p3 = Genetics.predict(v, 3);
  assert.strictEqual(p1[0].sev, null);
  assert.strictEqual(p1[0].arch, null);
  assert.ok(p3[0].arch && p3[0].sev);
});
