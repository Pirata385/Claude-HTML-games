const test = require('node:test');
const assert = require('node:assert');
const MX = require('./_load');
const { Subject, Genetics, Data } = MX;

const virus = (themes, o) => Genetics.synthesize(Object.assign(Genetics.emptyDesign('AB123'), { slots: themes.map((t) => ({ theme: t, pot: 2 })).concat([null, null, null, null, null, null]).slice(0, 6) }, o || {}));

test('cobaias são determinísticas e têm nome', () => {
  for (const h of Data.HOSTS) {
    const a = Subject.create(h.id, 'x1', 1), b = Subject.create(h.id, 'x1', 1);
    assert.deepStrictEqual(a, b);
    assert.ok(a.name.length > 2 && a.trait);
  }
});

test('injeção acumula mutações e instabilidade, até colapsar', () => {
  const s = Subject.create('ameba', 'seed', 1);
  let collapsed = null, doses = 0;
  while (!collapsed && doses < 60) {
    const r = Subject.inject(s, virus(['igneo', 'vegetal', 'musical'], { virulence: 70, seed: 'S' + String(doses).padStart(4, '0') }));
    doses++;
    if (!r.rejected) assert.ok(r.added.length + r.intensified.length >= 1);
    if (r.collapse) collapsed = r.collapse;
  }
  assert.ok(collapsed, 'deveria colapsar');
  assert.ok(s.instab >= 100 && !s.alive);
  assert.ok(Data.COLLAPSE[collapsed.id]);
  assert.ok(collapsed.desc.includes(s.name));
  assert.ok(collapsed.payout > 15);
});

test('estabilizador reduz 25 sem ficar negativo', () => {
  const s = Subject.create('rato', 'q', 1);
  s.instab = 30;
  Subject.stabilize(s);
  assert.strictEqual(s.instab, 5);
  Subject.stabilize(s);
  assert.strictEqual(s.instab, 0);
});

test('sinergia é detectada uma vez', () => {
  const s = Subject.create('robo', 'syn', 1);
  const m1 = MX.Mutations.instantiate({ theme: 'musical', group: 'parte', arch: 'olhos', sev: 'inofensiva', seed: 1 }, 'robo', {});
  s.mutations.push(m1);
  let found = false;
  for (let i = 0; i < 40 && !found; i++) {
    const r = Subject.inject(s, virus(['eletrico'], { virulence: 0, seed: 'E' + String(i).padStart(4, '0') }));
    if (r.synergies.some((x) => x.id === 'dj')) found = true;
    s.instab = 0; s.alive = true;
  }
  assert.ok(found);
  assert.strictEqual(s.synergies.filter((x) => x === 'dj').length, 1);
});

test('chance de rejeição respeita afinidades e limites', () => {
  const s = Subject.create('planta', 'r', 1);
  const liked = Subject.rejectChance(s, virus(['vegetal', 'aquatico', 'acucarado']));
  const hated = Subject.rejectChance(s, virus(['igneo', 'sombrio', 'igneo']));
  assert.ok(liked < hated);
  assert.ok(liked >= 0.02 && hated <= 0.5);
});

test('estimativa é positiva', () => {
  const s = Subject.create('rato', 'e', 1);
  assert.ok(Subject.estimate(s, virus(['igneo'])) > 0);
});
