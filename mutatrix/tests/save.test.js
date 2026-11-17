const test = require('node:test');
const assert = require('node:assert');
const MX = require('./_load');
const { Save, Economy, Subject } = MX;

function mem() { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }; }

test('salvar e carregar mantém o estado', () => {
  const st = mem();
  const s = Economy.newState();
  s.credits = 999; s.subject = Subject.create('rato', 'z', 3);
  assert.ok(Save.save(s, st));
  assert.deepStrictEqual(Save.load(st), s);
  Save.wipe(st);
  assert.strictEqual(Save.load(st), null);
});

test('exportar e importar com acentos', () => {
  const s = Economy.newState();
  s.subject = Subject.create('planta', 'ç', 1);
  s.subject.name = 'Dona Açaí Ômega';
  const code = Save.exportCode(s);
  assert.ok(code.startsWith('MUTATRIX1:'));
  assert.deepStrictEqual(Save.importCode(code), s);
  assert.strictEqual(Save.importCode('lixo'), null);
  assert.strictEqual(Save.importCode('MUTATRIX1:@@@'), null);
});

test('migração preenche campos ausentes', () => {
  const m = Save.migrate({ credits: 5, unlocked: { slots: 5 } });
  assert.strictEqual(m.credits, 5);
  assert.strictEqual(m.unlocked.slots, 5);
  assert.ok(Array.isArray(m.unlocked.themes) && m.unlocked.themes.length === 6);
  assert.ok(m.catalog.arch && m.stats);
  assert.ok(Save.migrate(null).credits === 150);
});

test('ajustes têm padrões', () => {
  const st = mem();
  const s = Save.loadSettings(st);
  assert.strictEqual(s.quality, 'auto');
  s.music = 0.1;
  Save.saveSettings(s, st);
  assert.strictEqual(Save.loadSettings(st).music, 0.1);
});
