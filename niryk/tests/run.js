// Niryk — logic tests (Node, no dependencies): content counts and level generation rules.
// Run: node niryk/tests/run.js
'use strict';
const path = require('path');
const js = (f) => require(path.join(__dirname, '..', 'js', f));
js('core.js'); js('data.js'); js('gen.js');
const N = globalThis.N;
let fails = 0, passes = 0;
const ok = (cond, msg) => { if (cond) passes++; else { fails++; console.error('FAIL:', msg); } };

// ---- content
ok(Object.keys(N.CHARS).length === 5, '5 heroes');
for (const [id, c] of Object.entries(N.CHARS)) {
  ok(c.abilities.length === 4, `${id} has 4 abilities`);
  ok(N.WEAPONS[c.weapon], `${id} preferred weapon exists`);
  for (const a of c.abilities) {
    const ab = N.ABILITIES[a];
    ok(ab && ab.char === id, `ability ${a} belongs to ${id}`);
    ok(ab && ab.mods.length === 3, `ability ${a} has 3 passives`);
  }
}
ok(Object.keys(N.ABILITIES).length === 20, '20 abilities');
ok(Object.keys(N.WEAPONS).length >= 25, '25+ weapons');
ok(Object.keys(N.EQUIPS).length >= 30, '30+ equipment');
ok(N.WORLDS.length === 6, '6 worlds');
for (const pair of N.LAYER_WORLDS) ok(pair.length === 2 && pair.every((i) => N.WORLDS[i].layer === N.LAYER_WORLDS.indexOf(pair)), 'two worlds per layer');
ok(N.DIFFICULTIES.length === 4, '4 difficulties');
for (const [wi, w] of N.WORLDS.entries()) {
  ok(w.enemies.length >= 6, `${w.id} has at least 6 enemies`);
  for (const e of w.enemies) ok(N.ENEMIES[e] && N.ENEMIES[e].world === wi, `enemy ${e} defined for world ${wi}`);
  ok(N.BOSSES[w.boss] && N.BOSSES[w.boss].world === wi, `boss of ${w.id}`);
}
ok(Object.keys(N.BOSSES).length === 6, '6 bosses');
ok(Object.keys(N.ENEMIES).length >= 36, '36+ enemies');

// ---- level generation
const T = N.TILE;
for (let seed = 1; seed <= 400; seed++) {
  const boss = seed % 3 === 0;
  const m = N.genLevel(seed * 7919, { boss });
  const rooms = m.rooms.filter((r) => r.type !== 'start' && r.type !== 'boss');
  ok(rooms.length >= 7 && rooms.length <= 10, `seed ${seed}: 7-10 rooms (got ${rooms.length})`);
  const special = rooms.filter((r) => r.type !== 'enemy');
  ok(special.length >= 2 && special.length <= 3, `seed ${seed}: 2-3 non-enemy rooms (got ${special.length})`);
  ok(new Set(special.map((r) => r.type)).size === special.length, `seed ${seed}: special rooms are distinct kinds`);
  ok(m.exit && m.exit.type === 'enemy', `seed ${seed}: exit is an enemy room`);
  ok(rooms.filter((r) => r.type === 'enemy').length >= 4, `seed ${seed}: at least 4 enemy rooms`);
  ok(!!m.boss === boss, `seed ${seed}: boss room only on boss levels`);
  if (boss) ok(m.boss.links.length === 1 && m.boss.links[0] === m.exit.id, `seed ${seed}: boss hangs off the exit room`);
  // every room reachable through the tile map from the start room
  const seen = new Uint8Array(m.W * m.H), st = [m.start.cy * m.W + m.start.cx];
  while (st.length) {
    const i = st.pop(); if (seen[i]) continue; seen[i] = 1;
    const x = i % m.W, y = (i / m.W) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const j = (y + dy) * m.W + x + dx, t = m.tiles[j];
      if ((t === T.FLOOR || t === T.DOOR) && !seen[j]) st.push(j);
    }
  }
  for (const r of m.rooms) {
    let all = true;
    for (let y = r.y0; y < r.y0 + r.h; y++) for (let x = r.x0; x < r.x0 + r.w; x++) if (m.tiles[y * m.W + x] === T.FLOOR && !seen[y * m.W + x]) all = false;
    ok(all, `seed ${seed}: room ${r.id} (${r.type}) fully reachable`);
    ok(r.doors.length === r.links.length * 3, `seed ${seed}: room ${r.id} has 3 door tiles per link`);
  }
}
console.log(`${passes} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);
