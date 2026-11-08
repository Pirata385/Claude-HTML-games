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
ok(Object.keys(N.CHARS).length === 4, '4 heroes');
for (const [id, c] of Object.entries(N.CHARS)) {
  ok(c.abilities.length === 4, `${id} has 4 abilities`);
  ok(N.WEAPONS[c.weapon], `${id} preferred weapon exists`);
  for (const a of c.abilities) {
    const ab = N.ABILITIES[a];
    ok(ab && ab.char === id, `ability ${a} belongs to ${id}`);
    ok(ab && ab.mods.length === 3, `ability ${a} has 3 passives`);
  }
}
ok(Object.keys(N.ABILITIES).length === 16, '16 abilities');
ok(Object.keys(N.WEAPONS).length === 16, '16 weapons');
ok(Object.keys(N.EQUIPS).length === 20, '20 equipment');
ok(N.WORLDS.length === 3, '3 worlds');
for (const [wi, w] of N.WORLDS.entries()) {
  ok(w.enemies.length >= 6, `${w.id} has at least 6 enemies`);
  for (const e of w.enemies) ok(N.ENEMIES[e] && N.ENEMIES[e].world === wi, `enemy ${e} defined for world ${wi}`);
  ok(N.BOSSES[w.boss] && N.BOSSES[w.boss].world === wi, `boss of ${w.id}`);
}
ok(Object.keys(N.BOSSES).length === 3, '3 bosses');
ok(Object.keys(N.ENEMIES).length >= 18, '18+ enemies');

// ---- level generation
const T = N.TILE;
for (let seed = 1; seed <= 400; seed++) {
  const boss = seed % 3 === 0;
  const m = N.genLevel(seed * 7919, { boss });
  const rooms = m.rooms.filter((r) => r.type !== 'start' && r.type !== 'boss');
  ok(rooms.length >= 9 && rooms.length <= 15, `seed ${seed}: 9-15 rooms (got ${rooms.length})`);
  const special = rooms.filter((r) => r.type !== 'enemy');
  ok(special.length >= 2 && special.length <= 3, `seed ${seed}: 2-3 non-enemy rooms (got ${special.length})`);
  ok(new Set(special.map((r) => r.type)).size === special.length, `seed ${seed}: special rooms are distinct kinds`);
  ok(m.exit && m.exit.type === 'enemy', `seed ${seed}: exit is an enemy room`);
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
