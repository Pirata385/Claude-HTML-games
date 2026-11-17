const test = require('node:test');
const assert = require('node:assert');
const MX = require('./_load');
const { Mutations, Data } = MX;

test('todo arquétipo x espécie x tema x classe gera mutação válida', () => {
  let n = 0;
  for (const a of Data.ARCH) for (const h of Data.HOSTS) for (const t of Data.THEMES) for (const s of Data.SEVS) {
    const m = Mutations.instantiate({ theme: t.id, group: a.group, arch: a.id, sev: s.id, seed: n * 2654435761 >>> 0, wild: false }, h.id, { name: 'Dona Pipoca', partScale: 1.35 });
    n++;
    for (const txt of [m.name, m.desc]) {
      assert.ok(txt && !/undefined|NaN|null|\{|\}/.test(txt), a.id + ' ' + txt);
    }
    for (const [k, v] of Object.entries(m.render)) if (typeof v === 'number') assert.ok(isFinite(v), k);
    assert.ok(m.render.part || m.render.body || m.render.beh);
    if (s.id === 'destrutiva') assert.ok(m.render.event);
    if (m.render.part) assert.ok(m.n >= 1 && m.n <= Mutations.partCap(m.render.part));
  }
  assert.ok(n > 9000);
});

test('intensificar aumenta nível e nunca rebaixa a classe', () => {
  const m = Mutations.instantiate({ theme: 'igneo', group: 'parte', arch: 'tentaculos', sev: 'perigosa', seed: 5, wild: false }, 'rato', {});
  const n0 = m.n;
  Mutations.intensify(m, 'inofensiva');
  assert.strictEqual(m.level, 2);
  assert.strictEqual(m.sev, 'perigosa');
  assert.ok(m.n >= n0);
  Mutations.intensify(m, 'destrutiva');
  assert.strictEqual(m.sev, 'destrutiva');
});
