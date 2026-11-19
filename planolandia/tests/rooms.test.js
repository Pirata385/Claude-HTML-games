'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const files = [
  'core/ns', 'core/geom3d', 'core/collide2d', 'core/world', 'core/physics', 'data/materials',
  'game/enemies/base', 'game/enemies/esferoide', 'game/enemies/cubo-sentinela', 'game/enemies/agulha', 'game/enemies/rabisco',
  'game/bosses/cubo-carcereiro', 'game/entities', 'game/save', 'data/rooms/borda',
];
for (const f of files) require('../src/' + f + '.js');
const { World, Phys, ENEMIES, ENTS, Save } = globalThis.PL;
const defs = Object.values(World.defs);

test('todas as salas existem e as conexões batem (bordas, aberturas e profundidade)', () => {
  assert.ok(defs.length >= 10);
  assert.deepEqual(World.validate(defs), []);
});

test('cada sala constrói, e toda entidade é de um tipo conhecido', () => {
  for (const d of defs) {
    const r = new World.Room(d, Save.fresh());
    assert.ok(r.prims.length > 0, d.id + ' sem sólidos');
    for (const e of r.ents) assert.ok(ENEMIES[e.type] || ENTS[e.type], `${d.id}: tipo desconhecido ${e.type}`);
  }
});

test('o ponto de partida e os Pontos Fixos não ficam dentro de sólidos e têm chão embaixo', () => {
  for (const d of defs) {
    const r = new World.Room(d, Save.fresh());
    const spots = r.ents.filter((e) => e.type === 'bench').map((e) => ({ x: e.x, y: e.y - 8, z: e.z }));
    if (d.spawn) spots.push(d.spawn);
    for (const s of spots) {
      const b = Phys.body(s.x, s.y, s.z, 6, 6);
      assert.equal(Phys.overlapAt(b, r, b.x, b.y, b.z), null, `${d.id}: ponto dentro de sólido`);
      for (let i = 0; i < 240; i++) { b.vy = Math.min(b.vy + Phys.GRAV / 120, Phys.MAX_FALL); Phys.move(b, r, 1 / 120); }
      assert.equal(b.grounded, true, `${d.id}: sem chão sob ${JSON.stringify(s)}`);
    }
  }
});

test('em cada saída lateral existe chão logo ao lado, para quem chega não cair no vazio', () => {
  for (const d of defs) {
    const r = new World.Room(d, Save.fresh());
    for (const e of d.exits) {
      if (e.side !== 'left' && e.side !== 'right') continue;
      const x = e.side === 'left' ? 8 : r.w - 8;
      const z = e.zr ? (e.zr[0] + e.zr[1]) / 2 : r.d / 2;
      const b = Phys.body(x, e.range[1] - 10, z, 6, 6);
      for (let i = 0; i < 240; i++) { b.vy = Math.min(b.vy + Phys.GRAV / 120, Phys.MAX_FALL); Phys.move(b, r, 1 / 120); }
      assert.equal(b.grounded, true, `${d.id}: saída ${e.side} sem chão`);
      assert.ok(Math.abs(b.y + 6 - e.range[1]) < 2, `${d.id}: o chão da saída ${e.side} deveria estar em ${e.range[1]} (está em ${b.y + 6})`);
    }
  }
});

test('salvamento: ida e volta preserva o estado; espaço vazio devolve null', () => {
  const st = Save.fresh();
  st.vert = 42; st.flags.boss_cubo = true; st.abilities.dash = true;
  Save.write(2, st);
  const back = Save.load(2);
  assert.equal(back.vert, 42);
  assert.equal(back.flags.boss_cubo, true);
  assert.equal(back.abilities.dash, true);
  assert.equal(back.abilities.garra, false);
  Save.remove(2);
  assert.equal(Save.load(2), null);
});

test('a arena tem chão em ladrilhos com faixas de profundidade para a fase 2', () => {
  const r = new World.Room(World.defs.borda_arena, Save.fresh());
  const tiles = r.prims.filter((p) => p.tile);
  assert.equal(tiles.length, 16);
  assert.equal(new Set(tiles.map((p) => p.band)).size, 4);
});
