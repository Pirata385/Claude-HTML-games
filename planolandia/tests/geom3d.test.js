'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
require('../src/core/ns.js');
require('../src/core/geom3d.js');
const { G3 } = globalThis.PL;

const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) <= eps, `${a} ≉ ${b}`);
const bounds = (s) => [s.minX, s.minY, s.maxX, s.maxY];

test('box: retângulo dentro da faixa de z e nada fora dela', () => {
  const p = G3.box(10, 20, 30, 40, 0, 100);
  const s = G3.slice(p, 50);
  assert.equal(s.type, 'poly');
  assert.deepEqual(bounds(s), [10, 20, 40, 60]);
  assert.equal(G3.slice(p, 101), null);
  assert.equal(G3.slice(p, -1), null);
  assert.ok(G3.slice(p, 0) !== null, 'face z0 inclusiva');
});

test('esfera: raio do corte = sqrt(r² − dz²)', () => {
  const p = G3.sphere(0, 0, 100, 10);
  near(G3.slice(p, 106).r, 8);
  near(G3.slice(p, 100).r, 10);
  assert.equal(G3.slice(p, 111), null);
  assert.equal(p.zMin, 90);
  assert.equal(p.zMax, 110);
});

test('loft: retângulo interpolado entre as duas faces (elevador de profundidade)', () => {
  const p = G3.loft([0, 100, 50, 110], 0, [0, 50, 50, 60], 100);
  const s = G3.slice(p, 50);
  assert.deepEqual(bounds(s), [0, 75, 50, 85]);
  assert.equal(G3.slice(p, 120), null);
});

test('cuboide sem rotação corta em quadrado; girado 45° no eixo vertical alarga √2', () => {
  const a = G3.cuboid(0, 0, 0, 20, 20, 20);
  const sa = G3.slice(a, 0);
  near(sa.maxX - sa.minX, 20);
  const b = G3.cuboid(0, 0, 0, 20, 20, 20, { yaw: Math.PI / 4 });
  const sb = G3.slice(b, 0);
  near(sb.maxX - sb.minX, 20 * Math.SQRT2, 1e-6);
  near(sb.maxY - sb.minY, 20);
});

test('cubo com a diagonal principal no eixo z corta em hexágono no centro e triângulo perto da ponta', () => {
  const c = G3.cuboid(0, 0, 0, 30, 30, 30, G3.diagRot());
  const center = G3.slice(c, 0);
  assert.equal(center.n, 6);
  const nearTip = G3.slice(c, c.zMax - 3);
  assert.equal(nearTip.n, 3);
  near(c.zMax, 15 * Math.sqrt(3), 1e-6);
});

test('cone ao longo de z: círculo encolhe linearmente até a ponta', () => {
  const p = G3.cone('z', 0, 0, 0, 10, 40, 1); // base em z=0, ponta em z=40
  near(G3.slice(p, 0).r, 10);
  near(G3.slice(p, 20).r, 5);
  assert.equal(G3.slice(p, 41), null);
});

test('cone em pé: base larga embaixo, ponta em cima, polígono convexo', () => {
  const p = G3.cone('y', 100, 200, 50, 20, 60, -1); // base y=200, ponta y=140
  const s = G3.slice(p, 50);
  near(s.maxX - s.minX, 40, 1e-6);
  near(s.minY, 140, 1e-6);
  near(s.maxY, 200, 1e-6);
  const off = G3.slice(p, 65); // dz = 15 → meia-largura na base = sqrt(400-225)
  near((off.maxX - off.minX) / 2, Math.sqrt(175), 1e-6);
  assert.ok(off.minY > 140, 'longe do eixo, o topo do corte fica mais baixo');
});

test('pirâmide de base quadrada: triângulo no centro, trapézio mais baixo fora dele', () => {
  const p = G3.pyramid(0, 100, 0, 40, 40, 30);
  const s = G3.slice(p, 0);
  assert.equal(s.n, 3);
  near(s.maxX - s.minX, 40, 1e-6);
  near(s.minY, 70, 1e-6);
  const e = G3.slice(p, 15);
  assert.equal(e.n, 4);
  near(e.minY, 100 - 30 * (5 / 20), 1e-6);
});

test('cilindros: eixo z dá círculo, eixo x dá faixa de altura variável', () => {
  const z = G3.cyl('z', 0, 0, 50, 8, 20);
  assert.equal(G3.slice(z, 60).type, 'circle');
  assert.equal(G3.slice(z, 75), null);
  const x = G3.cyl('x', 0, 0, 0, 10, 50);
  const s = G3.slice(x, 6);
  near(s.maxY - s.minY, 16, 1e-6);
  near(s.maxX - s.minX, 100, 1e-6);
});

test('prisma arbitrário: o polígono é mantido e as caixas são calculadas', () => {
  const p = G3.prism([0, 10, 10, 0, 10, 10], 0, 20);
  const s = G3.slice(p, 5);
  assert.equal(s.n, 3);
  assert.deepEqual(bounds(s), [0, 0, 10, 10]);
});

test('setHull atualiza vértices e limites (cubo dinâmico do chefão)', () => {
  const c = G3.cuboid(0, 0, 0, 20, 20, 20);
  const base = G3.cuboidVerts(20, 20, 20);
  const m = G3.rotMatrix(0, 0, 0);
  G3.setHull(c, base, m, 100, 50, 30);
  assert.equal(c.zMin, 20);
  assert.equal(c.zMax, 40);
  const s = G3.slice(c, 30);
  assert.deepEqual(bounds(s).map(Math.round), [90, 40, 110, 60]);
});

test('sliceInto escreve num formato temporário sem tocar o cache do primitivo', () => {
  const p = G3.box(0, 0, 10, 10, 0, 10);
  const cached = G3.slice(p, 5);
  const tmp = G3.newShape();
  assert.equal(G3.sliceInto(p, 5, tmp), true);
  assert.notEqual(tmp, cached);
  assert.equal(G3.sliceInto(p, 50, tmp), false);
});

test('zEdge: distância até o fim do volume (aviso de que a forma vai sumir)', () => {
  const p = G3.box(0, 0, 10, 10, 0, 100);
  assert.equal(G3.zEdge(p, 3), 3);
  assert.equal(G3.zEdge(p, 50), 50);
  assert.equal(G3.zEdge(p, 98), 2);
});
