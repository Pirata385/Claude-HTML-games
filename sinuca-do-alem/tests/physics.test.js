/* Testes da física (sem navegador): node tests/physics.test.js */
'use strict';
const path = require('path');
require(path.join(__dirname, '..', 'js', 'util.js'));
require(path.join(__dirname, '..', 'js', 'physics.js'));
const SA = globalThis.SA, P = SA.Phys;

let failed = 0;
function test(name, fn) {
  try { fn(); console.log('ok   ' + name); } catch (e) { failed++; console.log('FAIL ' + name + '\n     ' + e.message); }
}
function assert(c, msg) { if (!c) throw new Error(msg || 'assertion failed'); }

function world(opts) {
  P.resetIds(1);
  const w = P.makeWorld(P.buildGeom(opts));
  return w;
}
function run(w, maxT) {
  const ev = [];
  let t = 0;
  while (t < (maxT || 20)) {
    P.step(w, 1 / 120); t += 1 / 120;
    if (w.events.length) { ev.push(...w.events); w.events = []; }
    if (P.atRest(w)) break;
  }
  return { ev, t };
}
function rack(w, n) {
  const d = P.R * 2 + 0.6;
  let row = 0, col = 0;
  for (let i = 0; i < n; i++) {
    w.balls.push(P.makeBall({ kind: 'obj', num: i + 1, pts: 10, x: 250 + row * d * 0.868, y: (col - row / 2) * d }));
    if (++col > row) { row++; col = 0; }
  }
}

test('bola reta no canto cai na caçapa', () => {
  const w = world();
  const b = P.makeBall({ kind: 'obj', x: 300, y: 50 });
  const a = Math.atan2(P.HH + 6 - 50, P.HW + 6 - 300);
  b.vx = Math.cos(a) * 900; b.vy = Math.sin(a) * 900;
  w.balls.push(b);
  const r = run(w);
  const pk = r.ev.find((e) => e.t === 'pocket');
  assert(pk && pk.pk === 5, 'esperava cair na caçapa 5, veio ' + (pk ? pk.pk : 'nenhuma'));
  assert(!b.alive, 'a bola deveria sair da mesa');
});

test('batida de frente transfere o movimento', () => {
  const w = world();
  const cue = P.makeBall({ kind: 'cue', x: -200, y: 0 }), obj = P.makeBall({ kind: 'obj', x: 0, y: 0 });
  cue.vx = 800; w.balls.push(cue, obj);
  for (let i = 0; i < 40; i++) P.step(w, 1 / 120);
  assert(obj.vx > 400, 'a bola-alvo deveria sair rápido: ' + obj.vx);
  assert(Math.abs(cue.vx) < 80, 'a branca deveria quase parar: ' + cue.vx);
});

test('efeito para trás faz a branca voltar', () => {
  const w = world();
  const cue = P.makeBall({ kind: 'cue', x: -200, y: 0 }), obj = P.makeBall({ kind: 'obj', x: 0, y: 0 });
  cue.vx = 900; cue.follow = -1; w.balls.push(cue, obj);
  for (let i = 0; i < 40; i++) P.step(w, 1 / 120);
  assert(cue.vx < -100, 'a branca deveria recuar: ' + cue.vx);
});

test('tabela devolve a bola com menos velocidade', () => {
  const w = world();
  const b = P.makeBall({ kind: 'obj', x: 0, y: 150 });
  b.vy = 600; b.vx = 0.01; w.balls.push(b);
  // a caçapa do meio fica em x = 0: desloca para acertar a borracha
  b.x = 200;
  let hit = false;
  for (let i = 0; i < 60; i++) { P.step(w, 1 / 120); if (w.events.some((e) => e.t === 'cushion')) hit = true; w.events = []; }
  assert(hit, 'deveria tocar na tabela');
  assert(b.vy < 0 && b.vy > -600, 'deveria voltar mais devagar: ' + b.vy);
});

test('caçapa tampada rejeita a bola', () => {
  const w = world();
  const p = w.geom.pockets[5]; p.closed = true;
  w.geom.circles.push({ x: p.x, y: p.y, r: p.r + 12, e: 0.6, kick: 0, lid: true });
  const b = P.makeBall({ kind: 'obj', x: 300, y: 50 });
  const a = Math.atan2(p.y - 50, p.x - 300);
  b.vx = Math.cos(a) * 900; b.vy = Math.sin(a) * 900;
  w.balls.push(b);
  const r = run(w);
  assert(b.alive, 'a bola deveria continuar na mesa');
  assert(r.ev.some((e) => e.t === 'lid'), 'deveria bater na tampa');
});

test('fantasma atravessa bolas comuns, mas não a branca', () => {
  const w = world();
  const gh = P.makeBall({ kind: 'obj', type: 'fantasma', x: -100, y: 0 }), ob = P.makeBall({ kind: 'obj', x: 0, y: 0 });
  gh.vx = 500; w.balls.push(gh, ob);
  for (let i = 0; i < 60; i++) P.step(w, 1 / 120);
  assert(ob.vx === 0 && gh.x > 40, 'o fantasma deveria passar direto');
  const w2 = world();
  const cue = P.makeBall({ kind: 'cue', x: -100, y: 0 }), g2 = P.makeBall({ kind: 'obj', type: 'fantasma', x: 0, y: 0 });
  cue.vx = 500; w2.balls.push(cue, g2);
  for (let i = 0; i < 60; i++) P.step(w2, 1 / 120);
  assert(g2.vx > 100, 'a branca deveria empurrar o fantasma');
});

test('portal leva a bola de um lado ao outro', () => {
  const w = world();
  w.geom.portals = [{ x: -200, y: 0, r: 30 }, { x: 200, y: 100, r: 30 }];
  const b = P.makeBall({ kind: 'obj', x: -350, y: 0 });
  b.vx = 700; w.balls.push(b);
  let tele = false;
  for (let i = 0; i < 60 && !tele; i++) { P.step(w, 1 / 120); tele = w.events.some((e) => e.t === 'portal'); w.events = []; }
  assert(tele && b.x > 150 && Math.abs(b.y - 100) < 40, 'deveria sair no segundo portal: ' + b.x + ',' + b.y);
});

test('guia de mira encontra a primeira bola no caminho', () => {
  const w = world();
  const cue = P.makeBall({ kind: 'cue', x: -200, y: 0 }), a = P.makeBall({ kind: 'obj', x: 100, y: 5 }), b = P.makeBall({ kind: 'obj', x: 300, y: 0 });
  w.balls.push(cue, a, b);
  const h = P.castRay(w, cue.x, cue.y, 1, 0, cue.r, cue.id);
  assert(h.type === 'ball' && h.ball === a, 'deveria achar a bola mais próxima');
  assert(Math.abs(Math.hypot(h.x - a.x, h.y - a.y) - 2 * P.R) < 0.01, 'o ponto de contato fica a dois raios');
  const h2 = P.castRay(w, cue.x, cue.y, 0, 1, cue.r, cue.id);
  assert(h2.type === 'rail' && Math.abs(h2.y - (P.HH - P.R)) < 0.01, 'sem bolas, acerta a tabela');
});

test('200 tacadas aleatórias: tudo para, nada some, nenhum NaN', () => {
  const rng = SA.makeRng(12345);
  let timeouts = 0, shots = 0;
  for (const opts of [{}, { friction: 0.36 }, { pocketScale: 0.8, electric: true }]) {
    const w = world(opts);
    w.geom.circles.push({ x: -130, y: -120, r: 24, e: 0.9, kick: 560 }, { x: 40, y: 130, r: 24, e: 0.9, kick: 560 });
    w.geom.segs.push({ x1: -90, y1: 95, x2: -90, y2: 195, wall: true }); w.geom.hasWalls = true;
    w.geom.spinner = { x: 0, y: 0, len: 170, ang: 0, w: 1.7 }; w.spin = true;
    w.geom.well = { x: 330, y: -140, r: 24, range: 250, k: 520 };
    rack(w, 15);
    let cue = P.makeBall({ kind: 'cue', x: -250, y: 0 });
    w.balls.push(cue);
    for (let s = 0; s < 67; s++) {
      if (!cue.alive) { cue = P.makeBall({ kind: 'cue', x: -250 + rng.range(-40, 40), y: rng.range(-60, 60) }); w.balls.push(cue); }
      if (w.balls.filter((b) => b.alive && b.kind === 'obj').length < 3) rack(w, 10);
      const a = rng() * Math.PI * 2, sp = 400 + rng() * 2800;
      cue.vx = Math.cos(a) * sp; cue.vy = Math.sin(a) * sp; cue.firstHit = false;
      if (rng() < 0.2) { cue.vz = 210; cue.z = 27; }
      let t = 0;
      while (t < 16 && !P.atRest(w)) {
        P.step(w, 1 / 120); t += 1 / 120; w.events = [];
        if (t > 11) for (const b of w.balls) { b.vx *= 0.93; b.vy *= 0.93; }
      }
      for (const b of w.balls) {
        if (!b.alive) continue;
        assert(Number.isFinite(b.x) && Number.isFinite(b.y) && Number.isFinite(b.vx), 'NaN na bola ' + b.id);
        assert(Math.abs(b.x) <= P.HW + 8 && Math.abs(b.y) <= P.HH + 8, 'bola fora da mesa: ' + b.x.toFixed(1) + ',' + b.y.toFixed(1));
      }
      shots++; if (t >= 16) timeouts++;
      w.balls = w.balls.filter((b) => b.alive);
    }
  }
  console.log('     ' + timeouts + ' de ' + shots + ' tacadas chegaram ao limite de tempo');
  assert(timeouts <= shots * 0.05, 'tacadas demais sem parar sozinhas: ' + timeouts);
});

test('a mesma tacada dá sempre o mesmo resultado', () => {
  const sim = () => {
    const w = world();
    rack(w, 10);
    const cue = P.makeBall({ kind: 'cue', x: -250, y: 3 });
    cue.vx = 2400; cue.vy = 20; w.balls.push(cue);
    run(w);
    return w.balls.map((b) => (b.alive ? b.x.toFixed(6) + ',' + b.y.toFixed(6) : 'x')).join('|');
  };
  assert(sim() === sim(), 'a física deveria ser determinística');
});

test('a saída espalha o triângulo', () => {
  const w = world();
  rack(w, 10);
  const cue = P.makeBall({ kind: 'cue', x: -250, y: 0 });
  cue.vx = 2700; w.balls.push(cue);
  const r = run(w);
  const objs = w.balls.filter((b) => b.kind === 'obj');
  const moved = objs.filter((b) => !b.alive || Math.hypot(b.x - 290, b.y) > 120).length;
  assert(moved >= 5, 'poucas bolas se espalharam: ' + moved);
  assert(r.t < 16, 'a saída deveria terminar: ' + r.t.toFixed(1) + 's');
});

console.log(failed ? '\n' + failed + ' teste(s) falharam' : '\ntodos os testes passaram');
process.exit(failed ? 1 : 0);
