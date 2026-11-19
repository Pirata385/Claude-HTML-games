'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
for (const f of ['core/ns', 'game/save', 'game/teoremas', 'game/shop']) require('../src/' + f + '.js');
const { Save, Teoremas, TEOREMAS, Shop, SHOPS } = globalThis.PL;

test('salvamento novo traz Teoremas, encaixes e mapas', () => {
  const st = Save.fresh();
  assert.deepEqual(st.teoremas, {});
  assert.deepEqual(st.equip, []);
  assert.equal(st.postulados, 3);
  assert.deepEqual(st.mapas, {});
});

test('sem Teoremas, os modificadores são neutros', () => {
  const m = Teoremas.mods(Save.fresh());
  assert.deepEqual(m, { atkCd: 1, reach: 0, magnet: 44, depth: 1, focusT: 1, atkDepth: 0 });
});

test('equipar respeita posse e o limite de Postulados', () => {
  const st = Save.fresh();
  assert.equal(Teoremas.toggle(st, 'pitagoras'), false, 'não tem');
  st.teoremas.pitagoras = true; st.teoremas.angulo_reto = true; st.teoremas.bissetriz = true;
  assert.equal(Teoremas.toggle(st, 'pitagoras'), true);  // 2
  assert.equal(Teoremas.toggle(st, 'angulo_reto'), true); // 3
  assert.equal(Teoremas.used(st), 3);
  assert.equal(Teoremas.toggle(st, 'bissetriz'), false, 'não cabe');
  assert.equal(Teoremas.toggle(st, 'pitagoras'), true, 'desequipar sempre pode');
  assert.deepEqual(st.equip, ['angulo_reto']);
});

test('modificadores somam os efeitos equipados', () => {
  const st = Save.fresh();
  for (const id of Object.keys(TEOREMAS)) st.teoremas[id] = true;
  st.postulados = 10;
  for (const id of ['angulo_reto', 'pitagoras', 'ima', 'paralelas', 'lema_foco', 'bissetriz']) Teoremas.toggle(st, id);
  const m = Teoremas.mods(st);
  assert.equal(m.atkCd, 0.72);
  assert.equal(m.reach, 9);
  assert.equal(m.magnet, 120);
  assert.equal(m.depth, 1.4);
  assert.equal(m.focusT, 0.65);
  assert.equal(m.atkDepth, 12);
});

test('loja: compra desconta, entrega, marca e não vende duas vezes', () => {
  const st = Save.fresh();
  st.vert = 100;
  assert.equal(Shop.buy(st, 'pentagono', 'pitagoras').ok, false, 'sem saldo');
  assert.equal(st.vert, 100);
  const r = Shop.buy(st, 'pentagono', 'angulo_reto');
  assert.equal(r.ok, true);
  assert.equal(st.vert, 10);
  assert.equal(st.teoremas.angulo_reto, true);
  assert.equal(st.flags.buy_angulo_reto, true);
  st.vert = 999;
  assert.equal(Shop.buy(st, 'pentagono', 'angulo_reto').ok, false, 'já vendido');
  assert.equal(Shop.buy(st, 'pentagono', 'mapa_bosque').ok, true);
  assert.equal(st.mapas.bosque, true);
  const before = st.frags;
  assert.equal(Shop.buy(st, 'pentagono', 'frag_loja').ok, true);
  assert.equal(st.frags, before + 1);
  assert.ok(SHOPS.pentagono.every((it) => it.nome && it.preco > 0 && it.desc));
});
