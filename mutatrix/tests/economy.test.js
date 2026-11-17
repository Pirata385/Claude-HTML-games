const test = require('node:test');
const assert = require('node:assert');
const MX = require('./_load');
const { Economy, Data } = MX;

test('estado inicial', () => {
  const s = Economy.newState();
  assert.strictEqual(s.credits, 150);
  assert.strictEqual(s.unlocked.slots, 3);
  assert.strictEqual(s.unlocked.themes.length, 6);
  assert.strictEqual(s.unlocked.capsids.length, 4);
});

test('comprar desconta, aplica e respeita requisitos', () => {
  const s = Economy.newState();
  assert.ok(!Economy.buy(s, 'slot5').ok, 'precisa do slot4');
  assert.ok(Economy.buy(s, 'tema_cosmico').ok);
  assert.ok(s.unlocked.themes.includes('cosmico'));
  assert.strictEqual(s.credits, 10);
  assert.ok(!Economy.buy(s, 'tema_cosmico').ok, 'já tem');
  assert.ok(!Economy.buy(s, 'slot4').ok, 'sem créditos');
  s.credits = 1000;
  assert.ok(!Economy.buy(s, 'cap_cubo').ok, 'sem reputação');
  s.rep = 10;
  assert.ok(Economy.buy(s, 'cap_cubo').ok);
  const st0 = s.stabilizers;
  assert.ok(Economy.buy(s, 'estabilizador').ok);
  assert.ok(Economy.buy(s, 'estabilizador').ok);
  assert.strictEqual(s.stabilizers, st0 + 2);
});

test('todo item da loja pode ser comprado com verba e reputação', () => {
  const s = Economy.newState();
  s.credits = 1e6; s.rep = 99;
  for (const it of Data.SHOP) {
    const r = Economy.buy(s, it.id);
    assert.ok(r.ok || r.reason === 'Adquirido', it.id + ' ' + r.reason);
  }
});

test('custos de síntese e conserto', () => {
  const s = Economy.newState();
  assert.strictEqual(Economy.synthCost({ slots: [{ theme: 'igneo', pot: 1 }, { theme: 'igneo', pot: 3 }, null] }), 2 + 2 + 4);
  Economy.addDamage(s, 40, { type: 'crack', x: 0.5, y: 0.5 });
  assert.strictEqual(Economy.repairCost(s), 40);
  s.unlocked.armored = true;
  assert.strictEqual(Economy.repairCost(s), 20);
  assert.ok(Economy.repair(s).ok);
  assert.strictEqual(s.damage.total, 0);
});

test('Mutapédia e marcos', () => {
  const s = Economy.newState();
  for (let i = 0; i < 10; i++) assert.ok(Economy.discover(s, 'arch', 'a' + i, {}));
  assert.ok(!Economy.discover(s, 'arch', 'a0', {}));
  const got = Economy.checkMilestones(s);
  assert.strictEqual(got.length, 1);
  assert.strictEqual(s.credits, 250);
  assert.strictEqual(Economy.checkMilestones(s).length, 0);
  assert.ok(Economy.catalogTotal() > 200);
});
