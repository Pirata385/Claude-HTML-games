const test = require('node:test');
const assert = require('node:assert');
const MX = require('./_load');

test('mesma semente gera a mesma sequência', () => {
  const a = MX.RNG.make('abc'), b = MX.RNG.make('abc');
  for (let i = 0; i < 100; i++) assert.strictEqual(a.next(), b.next());
});

test('sementes diferentes divergem', () => {
  const a = MX.RNG.make('abc'), b = MX.RNG.make('abd');
  let same = 0;
  for (let i = 0; i < 50; i++) if (a.next() === b.next()) same++;
  assert.ok(same < 2);
});

test('int fica dentro dos limites e cobre o intervalo', () => {
  const r = MX.RNG.make(7);
  const seen = new Set();
  for (let i = 0; i < 2000; i++) { const v = r.int(2, 6); assert.ok(v >= 2 && v <= 6); seen.add(v); }
  assert.strictEqual(seen.size, 5);
});

test('weighted respeita pesos e ignora zeros', () => {
  const r = MX.RNG.make(11);
  const items = [{ id: 'a', w: 0 }, { id: 'b', w: 1 }, { id: 'c', w: 3 }];
  const cnt = { a: 0, b: 0, c: 0 };
  for (let i = 0; i < 4000; i++) cnt[r.weighted(items).id]++;
  assert.strictEqual(cnt.a, 0);
  assert.ok(cnt.c > cnt.b * 2 && cnt.c < cnt.b * 4.5);
  assert.strictEqual(r.weighted([{ w: 0 }]), null);
});

test('hash32 é estável', () => {
  assert.strictEqual(MX.RNG.hash32('mutatrix'), MX.RNG.hash32('mutatrix'));
  assert.notStrictEqual(MX.RNG.hash32('mutatrix'), MX.RNG.hash32('Mutatrix'));
});
