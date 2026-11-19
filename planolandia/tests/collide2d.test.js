'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
require('../src/core/ns.js');
require('../src/core/geom3d.js');
require('../src/core/collide2d.js');
const { G3, C2 } = globalThis.PL;

const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) <= eps, `${a} ≉ ${b}`);
const rect = (x0, y0, x1, y1) => G3.setRect(G3.newShape(), x0, y0, x1, y1);
const circ = (x, y, r) => G3.setCircle(G3.newShape(), x, y, r);

test('AABB contra retângulo: MTV pelo eixo de menor sobreposição, apontando para fora', () => {
  const out = {};
  assert.equal(C2.aabbShape(5, 0, 6, 6, rect(10, -10, 30, 10), out), true);
  near(out.nx, -1); near(out.ny, 0); near(out.depth, 1);
  assert.equal(C2.aabbShape(0, 0, 6, 6, rect(6, -10, 30, 10), out), false, 'só encostar não conta');
});

test('AABB contra rampa de 45°: normal da rampa', () => {
  // triângulo com hipotenusa de (0,100) a (100,0); a rampa sobe para a direita
  const tri = G3.prism([0, 100, 100, 0, 100, 100], 0, 10);
  const s = G3.slice(tri, 5);
  const out = {};
  assert.equal(C2.aabbShape(50, 46, 6, 6, s, out), true);
  near(out.nx, -Math.SQRT1_2, 1e-9);
  near(out.ny, -Math.SQRT1_2, 1e-9);
});

test('AABB contra círculo, de fora e com o centro dentro', () => {
  const out = {};
  assert.equal(C2.aabbShape(0, -14, 6, 6, circ(0, 0, 10), out), true);
  near(out.ny, -1); near(out.depth, 2);
  assert.equal(C2.aabbShape(0, 0, 6, 6, circ(1, 0, 3), out), true);
  assert.ok(out.depth > 0);
  assert.equal(C2.aabbShape(0, -20, 6, 6, circ(0, 0, 10), out), false);
});

test('separação direcional: empurrar só para cima ignora o eixo x (sem prender nas emendas)', () => {
  const out = {};
  // corpo afundou 0,1 no chão e mal entrou 0,05 na caixa vizinha
  // corpo: x ∈ [-0,05; 11,95], y ∈ [88,1; 100,1]; caixa começa em x = 11,9
  const t = C2.aabbSepDir(5.95, 94.1, 6, 6, rect(11.9, 100, 50, 120), 0, -1, out);
  near(t, 0.1, 1e-9);
  near(out.ny, -1);
  const slope = G3.slice(G3.prism([0, 100, 100, 0, 100, 100], 0, 10), 5);
  const t2 = C2.aabbSepDir(50, 46, 6, 6, slope, 0, -1, out);
  // no ponto x=56 (canto inferior direito) a rampa está em y=44; base do corpo em 52 → sobe 8
  near(t2, 8, 1e-9);
});

test('sobreposição genérica entre formas (golpe contra inimigo)', () => {
  assert.equal(C2.overlap(rect(0, 0, 10, 10), circ(14, 5, 5)), true);
  assert.equal(C2.overlap(rect(0, 0, 10, 10), circ(16, 5, 5)), false);
  assert.equal(C2.overlap(circ(0, 0, 5), circ(9, 0, 5)), true);
  const tri = G3.slice(G3.prism([0, 10, 10, 0, 10, 10], 0, 1), 0.5);
  assert.equal(C2.overlap(rect(-5, -5, 3, 3), tri), false);
  assert.equal(C2.overlap(rect(6, 6, 12, 12), tri), true);
});

test('ponto dentro de formas', () => {
  assert.equal(C2.pointIn(5, 5, rect(0, 0, 10, 10)), true);
  assert.equal(C2.pointIn(15, 5, rect(0, 0, 10, 10)), false);
  assert.equal(C2.pointIn(3, 0, circ(0, 0, 4)), true);
});
