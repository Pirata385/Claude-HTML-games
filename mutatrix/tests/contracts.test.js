const test = require('node:test');
const assert = require('node:assert');
const MX = require('./_load');
const { Contracts, Economy, Subject, Mutations, Data, RNG } = MX;

// Monta uma cobaia que satisfaz os requisitos colocando mutações diretamente (prova que não se contradizem).
function build(c) {
  const s = Subject.create(c.host, 'build' + c.id, 1);
  const add = (theme, sev, arch) => {
    const a = arch ? Data.ARCHS[arch] : Data.ARCH.find((x) => !s.mutations.some((m) => m.arch === x.id));
    s.mutations.push(Mutations.instantiate({ theme, group: a.group, arch: a.id, sev, seed: s.mutations.length + 1 }, s.host, {}));
  };
  const mildCap = c.reqs.some((r) => r.t === 'sevMax' && r.sev === 'perigosa') ? 'bizarra' : c.reqs.some((r) => r.t === 'sevMax') ? 'perigosa' : 'destrutiva';
  const theme0 = (c.reqs.find((r) => r.t === 'theme') || { theme: 'igneo' }).theme;
  for (const r of c.reqs) {
    if (r.t === 'theme') add(r.theme, 'inofensiva');
    if (r.t === 'synergy') { add(Data.SYNERGY[r.id].a, 'inofensiva'); add(Data.SYNERGY[r.id].b, 'inofensiva'); s.synergies.push(r.id); }
    if (r.t === 'sevMin') for (let i = 0; i < r.n; i++) add(theme0, r.sev);
    if (r.t === 'arch') add(theme0, 'inofensiva', r.arch);
    if (r.t === 'group') add(theme0, 'inofensiva', Data.ARCH.find((a) => a.group === r.group && !s.mutations.some((m) => m.arch === a.id)).id);
  }
  const count = c.reqs.find((r) => r.t === 'count');
  while (count && s.mutations.length < count.n) add(theme0, 'inofensiva');
  if (!s.mutations.length) add(theme0, 'inofensiva');
  const biz = c.reqs.find((r) => r.t === 'biz');
  while (biz && Subject.computeBiz(s) < biz.v) add(theme0, mildCap === 'bizarra' ? 'bizarra' : 'perigosa');
  s.biz = Subject.computeBiz(s);
  const mx = c.reqs.find((r) => r.t === 'instabMax');
  const mn = c.reqs.find((r) => r.t === 'instabMin');
  s.instab = mn ? mn.v + 5 : mx ? mx.v - 5 : 20;
  return s;
}

test('contratos gerados são cumpríveis e usam só temas liberados', () => {
  for (const rep of [0, 5, 12]) {
    const state = Economy.newState();
    state.rep = rep;
    if (rep >= 5) state.unlocked.themes.push('cosmico', 'sombrio', 'cristalino');
    if (rep >= 12) state.unlocked.themes.push('gasoso', 'magnetico', 'acucarado');
    const rng = RNG.make('contracts' + rep);
    for (let i = 0; i < 400; i++) {
      const c = Contracts.generate(rng, state, i + 1);
      assert.ok(c.reward > 0 && c.client.name && c.letter);
      assert.ok(Contracts.feasible(c, state));
      for (const r of c.reqs.concat(c.bonus)) {
        if (r.t === 'theme') assert.ok(state.unlocked.themes.includes(r.theme));
        assert.ok(!Contracts.reqText(r).includes('?'));
      }
      const ev = Contracts.evaluate(c, build(c));
      assert.ok(ev.ok, JSON.stringify(c.reqs) + ' ' + JSON.stringify(ev.reqs));
    }
  }
});

test('avaliação recusa cobaia errada ou morta', () => {
  const state = Economy.newState();
  const c = Contracts.generate(RNG.make('one'), state, 1);
  const s = build(c);
  assert.ok(Contracts.evaluate(c, s).ok);
  s.alive = false;
  assert.ok(!Contracts.evaluate(c, s).ok);
  const other = Subject.create(Data.HOSTS.find((h) => h.id !== c.host).id, 'x', 2);
  assert.ok(!Contracts.evaluate(c, other).ok);
});
