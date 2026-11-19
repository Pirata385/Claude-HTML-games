'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
for (const f of ['core/ns', 'core/geom3d', 'core/collide2d', 'core/world', 'core/physics', 'game/input', 'game/save', 'game/teoremas', 'game/player']) require('../src/' + f + '.js');
const { World, Player, Input, Save, Teoremas, G3 } = globalThis.PL;

function room(build) {
  return new World.Room({ id: 'p' + Math.random(), pos: [0, 0, 0], size: [800, 400, 100], build });
}
function stubG(r, abilities, equip) {
  const save = Save.fresh();
  Object.assign(save.abilities, abilities || {});
  for (const id of equip || []) { save.teoremas[id] = true; save.equip.push(id); }
  const noop = () => {};
  return {
    room: r, save, mods: Teoremas.mods(save), hud: null, hasDyn: false,
    fx: { burst: noop, spawn: noop, ring: noop }, sfx: noop,
    depthLimit: (b, dir) => (dir > 0 ? r.d : 0), onDepth: noop, playerAttack: noop, hurtPlayer: noop,
  };
}
// avança n quadros com as teclas dadas; 'tap' = apertadas só no primeiro quadro
function run(P, frames, hold, tap) {
  const prev = {};
  for (let i = 0; i < frames; i++) {
    for (const a of Input.ACTIONS) {
      const d = (hold || []).includes(a) || (i === 0 && (tap || []).includes(a));
      Input.pressed[a] = d && !prev[a];
      Input.down[a] = d;
      prev[a] = d;
    }
    Input.axisZ = (Input.down.zf ? 1 : 0) - (Input.down.zb ? 1 : 0);
    P.update(1 / 60);
  }
  for (const a of Input.ACTIONS) { Input.down[a] = false; Input.pressed[a] = false; }
}
const wallRoom = () => room((B) => { B.box(0, 360, 800, 40); B.box(300, 0, 40, 360); });

test('Garra: grudado na parede, o Quadrado cai devagar; sem ela, despenca', () => {
  const r = wallRoom();
  const a = new Player(stubG(r, { garra: true }), 293, 150, 50);
  const b = new Player(stubG(r, {}), 293, 150, 50);
  run(a, 30, ['right']); run(b, 30, ['right']);
  assert.ok(a.cling === 1, 'agarrado');
  assert.ok(a.b.vy <= 60.01, 'queda limitada: ' + a.b.vy);
  assert.ok(a.y < b.y - 40, `caiu bem menos (${a.y.toFixed(0)} × ${b.y.toFixed(0)})`);
});

test('Garra: pular da parede lança para longe dela e para cima', () => {
  const r = wallRoom();
  const P = new Player(stubG(r, { garra: true }), 293, 150, 50);
  run(P, 20, ['right']);
  const y0 = P.y;
  run(P, 1, ['right', 'jump']);
  assert.ok(P.b.vx < -150, 'afasta da parede: ' + P.b.vx);
  assert.ok(P.b.vy < -250, 'sobe: ' + P.b.vy);
  run(P, 12, ['right', 'jump']);
  assert.ok(P.x < 280, 'mesmo segurando em direção à parede, o impulso leva para longe: x=' + P.x);
  assert.ok(P.y < y0 - 20);
});

test('cogumelo: cair nele lança bem mais alto que um pulo', () => {
  const r = room((B) => { B.box(0, 360, 800, 40); B.box(200, 340, 60, 20, 0, 100, { bounce: 430 }); });
  const P = new Player(stubG(r, {}), 230, 200, 50);
  let minY = 999, bounced = false;
  for (let i = 0; i < 120; i++) { run(P, 1, []); if (P.b.vy < -400) bounced = true; if (bounced) minY = Math.min(minY, P.y); }
  assert.ok(bounced, 'quicou');
  assert.ok(minY < 334 - 80, 'subiu mais de 80 px acima do cogumelo: ' + minY);
});

test('Ângulo Reto encurta a recarga do golpe; Pitágoras alonga o alcance', () => {
  const r = room((B) => B.box(0, 360, 800, 40));
  const base = new Player(stubG(r, {}), 100, 354, 50);
  const fast = new Player(stubG(r, {}, ['angulo_reto', 'pitagoras']), 100, 354, 50);
  run(base, 1, [], ['attack']); run(fast, 1, [], ['attack']);
  assert.ok(fast.atkCd < base.atkCd * 0.8, `${fast.atkCd} < ${base.atkCd}`);
  const hb0 = base.atkHitbox(), hb1 = fast.atkHitbox();
  assert.equal(Math.round((hb1.maxX - hb1.minX) - (hb0.maxX - hb0.minX)), 9);
});

test('Paralelas: desliza na profundidade mais rápido', () => {
  const r = room((B) => B.box(0, 360, 800, 40));
  const a = new Player(stubG(r, {}), 100, 354, 10);
  const b = new Player(stubG(r, {}, ['paralelas']), 100, 354, 10);
  run(a, 40, ['zf']); run(b, 40, ['zf']);
  assert.ok(b.z > a.z + 15, `${b.z.toFixed(1)} > ${a.z.toFixed(1)}`);
});

// escalada por pulos na parede numa sala real do jogo (alterna lados ao agarrar)
function climb(P, maxFrames) {
  let dir = 1, minY = P.y, jumpNext = 0;
  run(P, 2, []);
  run(P, 14, ['jump', 'right']);
  for (let f = 0; f < maxFrames; f++) {
    const hold = [dir > 0 ? 'right' : 'left'];
    const tap = [];
    if (P.cling === dir && jumpNext <= 0) { tap.push('jump'); jumpNext = 6; dir = -dir; }
    jumpNext--;
    run(P, 1, hold.concat(jumpNext > 2 ? ['jump'] : []), tap);
    minY = Math.min(minY, P.y);
  }
  return minY;
}
for (const f of ['data/materials', 'game/enemies/base', 'game/entities', 'data/rooms/borda', 'data/rooms/bosque']) require('../src/' + f + '.js');

test('Copa Alta: o poço sobe inteiro com a Garra e não sobe sem ela', () => {
  const def = PL.World.defs.bosque_alto;
  const rA = new World.Room(def, Save.fresh()), rB = new World.Room(def, Save.fresh());
  const a = new Player(stubG(rA, { garra: true }), 272, 454, 80);
  const b = new Player(stubG(rB, {}), 272, 454, 80);
  const ya = climb(a, 600), yb = climb(b, 600);
  assert.ok(ya < 120, 'com Garra chega ao topo: ' + ya.toFixed(0));
  assert.ok(yb > 380, 'sem Garra fica embaixo: ' + yb.toFixed(0));
});

test('Ninho: o poço de Garra leva até a abertura do teto', () => {
  const def = PL.World.defs.bosque_ninho;
  const st = Save.fresh(); st.flags.boss_mae = true;
  const r = new World.Room(def, st);
  const a = new Player(stubG(r, { garra: true }), 462, 294, 120);
  const y = climb(a, 600);
  assert.ok(y < 20, 'chegou a ' + y.toFixed(0));
});
