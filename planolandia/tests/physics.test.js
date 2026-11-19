'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
require('../src/core/ns.js');
require('../src/core/geom3d.js');
require('../src/core/collide2d.js');
require('../src/core/world.js');
require('../src/core/physics.js');
const { World, Phys } = globalThis.PL;

const near = (a, b, eps = 1e-3) => assert.ok(Math.abs(a - b) <= eps, `${a} ≉ ${b}`);
function room(build, size) {
  return new World.Room({ id: 't' + Math.random(), pos: [0, 0, 0], size: size || [800, 400, 100], build });
}
function run(body, r, secs, each) {
  const dt = 1 / 120;
  for (let t = 0; t < secs; t += dt) {
    body.vy = Math.min(body.vy + Phys.GRAV * dt, Phys.MAX_FALL);
    if (each) each(body);
    Phys.move(body, r, dt);
  }
}

test('cai e pousa no chão, ficando apoiado', () => {
  const r = room((B) => B.box(0, 300, 800, 50));
  const b = Phys.body(100, 200, 50, 6, 6);
  run(b, r, 1.5);
  near(b.y, 294);
  assert.equal(b.grounded, true);
  assert.equal(b.vy, 0);
});

test('anda sobre caixas emendadas sem tropeçar na emenda', () => {
  const r = room((B) => { B.box(0, 300, 100, 50); B.box(100, 300, 100, 50); B.box(200, 300, 300, 50); });
  const b = Phys.body(50, 294, 50, 6, 6);
  run(b, r, 2, (x) => { x.vx = 110; });
  assert.ok(b.x > 250, 'percorreu as emendas: x=' + b.x);
  near(b.y, 294);
});

test('sobe rampa de 45° e desce grudado nela', () => {
  const r = room((B) => {
    B.box(0, 300, 800, 50);
    B.prism([200, 300, 300, 200, 300, 300], 0, 100);
    B.box(300, 200, 100, 100);
    B.prism([400, 200, 500, 300, 400, 300], 0, 100);
  });
  const b = Phys.body(100, 294, 50, 6, 6);
  let maxUp = 0;
  run(b, r, 4.5, (x) => { x.vx = 110; maxUp = Math.max(maxUp, 294 - x.y); });
  assert.ok(maxUp > 95, 'subiu a rampa: ' + maxUp);
  assert.ok(b.x > 500, 'passou pela descida: x=' + b.x);
  near(b.y, 294, 0.5);
  assert.equal(b.grounded, true);
});

test('bate na parede e para', () => {
  const r = room((B) => { B.box(0, 300, 800, 50); B.box(300, 100, 40, 200); });
  const b = Phys.body(100, 294, 50, 6, 6);
  run(b, r, 3, (x) => { x.vx = 110; });
  near(b.x, 294);
  assert.equal(b.wall, 1);
});

test('degrau de 3 px é subido sozinho; de 12 px, não', () => {
  const r = room((B) => { B.box(0, 300, 800, 50); B.box(200, 297, 600, 3); B.box(400, 285, 400, 12); });
  const b = Phys.body(100, 294, 50, 6, 6);
  run(b, r, 3, (x) => { x.vx = 110; });
  near(b.x, 394, 0.01);
  near(b.y, 291, 0.01);
});

test('plataforma atravessável: passa por baixo pulando, apoia por cima e desce com dropT', () => {
  const r = room((B) => { B.box(0, 300, 800, 50); B.box(50, 240, 200, 6, 0, 100, { oneWay: true }); });
  const b = Phys.body(100, 294, 50, 6, 6);
  b.vy = -380;
  run(b, r, 1.2);
  near(b.y, 234);
  assert.equal(b.grounded, true);
  b.dropT = 0.2;
  run(b, r, 1);
  near(b.y, 294);
});

test('teto interrompe o pulo', () => {
  const r = room((B) => { B.box(0, 300, 800, 50); B.box(0, 250, 800, 10); });
  const b = Phys.body(100, 294, 50, 6, 6);
  b.vy = -300;
  let minY = 999, stopped = false;
  run(b, r, 0.2, (x) => { minY = Math.min(minY, x.y); if (x.ceil) stopped = true; });
  assert.ok(minY >= 266 - 0.01, 'não atravessou o teto: ' + minY);
  assert.equal(stopped, true);
});

test('troca de profundidade bloqueada por sólido que só existe mais à frente', () => {
  const r = room((B) => { B.box(0, 300, 800, 50); B.box(80, 200, 40, 100, 60, 100); });
  const b = Phys.body(100, 294, 30, 6, 6);
  const res = Phys.tryDepth(b, r, 40);
  assert.ok(res.blocker, 'deveria bloquear');
  assert.ok(b.z < 60 && b.z > 55, 'avançou até perto do obstáculo: z=' + b.z);
});

test('elevador de profundidade: sobe junto com a plataforma inclinada', () => {
  const r = room((B) => { B.box(0, 300, 800, 50); B.loft([60, 300, 200, 316], 0, [60, 230, 200, 246], 100); });
  const b = Phys.body(100, 294, 1, 6, 6);
  for (let i = 0; i < 160; i++) {
    const res = Phys.tryDepth(b, r, 0.6);
    assert.equal(res.blocker, null, 'não deveria bloquear em z=' + b.z);
    run(b, r, 1 / 120);
  }
  assert.ok(b.z > 90);
  assert.ok(b.y < 240, 'subiu com a plataforma: y=' + b.y);
});

test('chão some ao trocar de profundidade: o corpo cai', () => {
  const r = room((B) => { B.box(0, 300, 800, 50, 0, 50); B.box(0, 380, 800, 20); }, [800, 400, 100]);
  const b = Phys.body(100, 294, 40, 6, 6);
  run(b, r, 0.2);
  assert.equal(b.grounded, true);
  Phys.tryDepth(b, r, 20);
  run(b, r, 1);
  near(b.y, 374);
});

test('perigos: overlapHazard encontra espinhos na fatia', () => {
  const r = room((B) => { B.box(0, 300, 800, 50); B.spikes(200, 260, 300, 0, 100); });
  const b = Phys.body(230, 294, 50, 6, 6);
  assert.ok(Phys.hazardAt(b, r));
  b.x = 100;
  assert.equal(Phys.hazardAt(b, r), null);
});

test('esmagamento: sólido surgindo dentro do corpo é detectado', () => {
  const r = room((B) => { B.box(0, 300, 800, 50); });
  const b = Phys.body(100, 294, 50, 6, 6);
  r.addPrim(PL.G3.box(60, 200, 80, 98, 0, 100));
  const d = Phys.depenetrate(b, r);
  assert.ok(d > 4);
});
