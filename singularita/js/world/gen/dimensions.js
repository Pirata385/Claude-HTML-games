// The five dimensions. Each run gets its own seed, so every visit is a new layout; each layout
// has its own shape and rule. They all return the same zone shape as the isles and caves:
// { grid, spawn, entry, exit, arena, nodes, pois, ... } plus the pieces their rule needs.
import { ZoneGrid, F, SURF, N4, N8 } from '../grid.js';
import { makeRng, hashSeed } from '../../core/rng.js';
import { dimReach } from './validate.js';
import { ZONES } from '../../data/zones.js';
import { isJailerFloor } from '../../systems/run.js';

export function generateDimension(id, { seed, floor = 1 } = {}) {
  const def = ZONES[id];
  const kind = def.gen.kind;
  const z = kind === 'floors' ? floors(def, seed, floor) : kind === 'lanes' ? lanes(def, seed) : kind === 'castle' ? castle(def, seed)
    : kind === 'mirror' ? mirror(def, seed) : peaks(def, seed);
  pruneUnreachable(z);
  return z;
}

// ------------------------------------------------------------------ shared helpers
function walled(def, seed, N, render = 'cave') {
  const g = new ZoneGrid(N, N);
  g.wallHeight = 3;
  for (let k = 0; k < N * N; k++) { g.flags[k] = F.WALL; g.surf[k] = SURF.WALL; }
  return { id: def.id, type: 'dimension', render, def, seed, grid: g, pois: [], nodes: [], hazards: [], updrafts: [], gates: [], decor: { glow: [] }, rooms: [] };
}

function carve(g, x0, z0, w, d, surf = SURF.FLOOR, h = 0) {
  for (let j = z0; j < z0 + d; j++) for (let i = x0; i < x0 + w; i++) {
    if (i < 2 || j < 2 || i >= g.w - 2 || j >= g.d - 2) continue;
    const k = g.idx(i, j);
    g.flags[k] &= ~F.WALL; g.surf[k] = surf; g.h[k] = h;
  }
}

// An L-shaped corridor `width` wide between two points.
function corridor(g, a, b, width = 3, surf = SURF.FLOOR, rng = null) {
  const half = Math.floor(width / 2);
  const hFirst = rng ? rng.chance(0.5) : true;
  const seg = (x0, z0, x1, z1) => {
    for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) for (let z = Math.min(z0, z1); z <= Math.max(z0, z1); z++) carve(g, x - half, z - half, width, width, surf);
  };
  if (hFirst) { seg(a.x, a.z, b.x, a.z); seg(b.x, a.z, b.x, b.z); } else { seg(a.x, a.z, a.x, b.z); seg(a.x, b.z, b.x, b.z); }
}

const mark = (g, cx, cz, r, flag) => {
  for (let j = Math.floor(cz - r); j <= cz + r; j++) for (let i = Math.floor(cx - r); i <= cx + r; i++)
    if (g.inside(i, j) && Math.hypot(i + 0.5 - cx, j + 0.5 - cz) <= r) g.set(i, j, flag);
};

function setArena(z, id, name, boss, x, zz, r, h) {
  z.arena = { id, name, boss, x: Math.floor(x) + 0.5, z: Math.floor(zz) + 0.5, r, h, pillars: [] };
  mark(z.grid, z.arena.x, z.arena.z, r, F.ARENA | F.NOSPAWN);
}

function setEntry(z, x, zz, yaw) {
  const g = z.grid, i = Math.floor(x), j = Math.floor(zz);
  z.entry = { i, j, x: i + 0.5, z: j + 0.5, h: g.h[g.idx(i, j)], type: 'portal' };
  z.spawn = { x: z.entry.x + Math.sin(yaw) * 4, z: z.entry.z + Math.cos(yaw) * 4 };
  z.spawnYaw = yaw;
  mark(g, z.entry.x, z.entry.z, 6, F.NOSPAWN);
}

// The main route (spawn → target) is marked PATH so objects keep off it.
function markRoute(z, target, open = []) {
  const g = z.grid, openSet = new Set(open);
  const [si, sj] = g.cellAt(z.spawn.x, z.spawn.z);
  const d = g.bfs(si, sj, { passable: (i, j, pi, pj) => (g.walkable(i, j) || openSet.has(g.idx(i, j))) && g.height(i, j) - g.height(pi, pj) <= 1 });
  let [ci, cj] = g.cellAt(target.x, target.z);
  if (d[g.idx(ci, cj)] < 0) return;
  while (d[g.idx(ci, cj)] > 0) {
    g.set(ci, cj, F.PATH);
    for (const [di, dj] of N4) if (g.walkable(ci + di, cj + dj)) g.set(ci + di, cj + dj, F.PATH);
    const next = N4.map(([di, dj]) => [ci + di, cj + dj]).find(([i, j]) => g.inside(i, j) && d[g.idx(i, j)] === d[g.idx(ci, cj)] - 1);
    if (!next) break;
    [ci, cj] = next;
  }
}

// Spread nodes on floor cells: along walls (`wallSide`) or anywhere `ok` allows.
function placeNodes(z, rng, table, want, ok, spacing = 3) {
  const g = z.grid;
  const reach = dimReach(z);
  const cells = [];
  for (let j = 2; j < g.d - 2; j++) for (let i = 2; i < g.w - 2; i++) if (reach[g.idx(i, j)] >= 0 && ok(i, j)) cells.push([i, j]);
  rng.shuffle(cells);
  const taken = [];
  const start = z.nodes.length;
  for (const [i, j] of cells) {
    if (z.nodes.length - start >= want) break;
    if (taken.some(([a, b]) => Math.abs(a - i) < spacing && Math.abs(b - j) < spacing)) continue;
    if (N8.some(([di, dj]) => g.has(i + di, j + dj, F.PATH | F.OBSTACLE | F.POI))) continue;
    if (g.has(i, j, F.PATH | F.OBSTACLE | F.POI | F.ARENA | F.NOSPAWN)) continue;
    const pick = rng.weighted(table);
    g.set(i, j, F.OBSTACLE);
    taken.push([i, j]);
    z.nodes.push({ id: `n${z.nodes.length}`, node: pick.node, i, j, x: i + 0.5, z: j + 0.5, h: g.h[g.idx(i, j)], rot: rng.next() * Math.PI * 2, scale: 0.85 + rng.next() * 0.3 });
  }
}
const nearWall = (g, i, j) => N4.some(([di, dj]) => g.has(i + di, j + dj, F.WALL));
// A cell squeezed between two walls is a corridor: never block it.
const corridorCell = (g, i, j) => (g.has(i - 1, j, F.WALL | F.OBSTACLE) && g.has(i + 1, j, F.WALL | F.OBSTACLE)) || (g.has(i, j - 1, F.WALL | F.OBSTACLE) && g.has(i, j + 1, F.WALL | F.OBSTACLE));

function placeLore(z, rng, spots) {
  const g = z.grid;
  z.def.lore.forEach((id, n) => {
    const s = spots[n % spots.length];
    for (let t = 0; t < 40; t++) {
      const i = Math.floor(s.x + rng.range(-2, 2)), j = Math.floor(s.z + rng.range(-2, 2));
      if (!g.walkable(i, j) || g.has(i, j, F.PATH | F.OBSTACLE | F.ARENA) || corridorCell(g, i, j)) continue;
      g.set(i, j, F.POI | F.OBSTACLE);
      z.pois.push({ id, type: 'lore', i, j, x: i + 0.5, z: j + 0.5, r: 2 });
      return;
    }
  });
}

// Objects must never wall anything off: drop any that ended up out of reach.
function pruneUnreachable(z) {
  const g = z.grid;
  const open = new Set(z.gates.flatMap((gt) => gt.cells));
  for (let pass = 0; pass < 4; pass++) {
    const [si, sj] = g.cellAt(z.spawn.x, z.spawn.z);
    const d = g.bfs(si, sj, { passable: (i, j, pi, pj) => (g.walkable(i, j) || open.has(g.idx(i, j))) && g.height(i, j) - g.height(pi, pj) <= 1 });
    if (z.updrafts.length) { const r = dimReach(z); for (let k = 0; k < d.length; k++) if (d[k] < 0 && r[k] >= 0) d[k] = r[k]; }
    const ok = (o) => N4.some(([di, dj]) => g.inside(o.i + di, o.j + dj) && d[g.idx(o.i + di, o.j + dj)] >= 0);
    const bad = [...z.nodes, ...z.pois].filter((o) => !ok(o));
    if (!bad.length) break;
    for (const o of bad) g.clear(o.i, o.j, F.OBSTACLE | F.POI);
    z.nodes = z.nodes.filter((n) => !bad.includes(n));
    z.pois = z.pois.filter((n) => !bad.includes(n));
  }
  z.nodes.forEach((n, k) => { n.id = `n${k}`; });
}

// ------------------------------------------------------------------ The Endless Dungeon
// Rooms joined by corridors. The stair down is locked; the Warden carries the key.
// Every fifth floor, the far room is the Jailer's block instead.
function floors(def, seed, floor) {
  const N = def.gen.size;
  const rng = makeRng(hashSeed(seed, floor));
  const z = walled(def, seed, N);
  const g = z.grid;
  z.floor = floor;
  const boss = isJailerFloor(floor);
  const rooms = [];
  // The far room first: the stair room, or the Jailer's block on boss floors.
  const far = boss ? { x: 34, z: 6, w: 28, d: 26 } : { x: rng.int(30, 54), z: 6, w: rng.int(12, 16), d: rng.int(11, 14) };
  rooms.push(far);
  for (let t = 0; t < 400 && rooms.length < 9; t++) {
    const w = rng.int(9, 16), d = rng.int(8, 14);
    const r = { x: rng.int(4, N - w - 4), z: rng.int(4, N - d - 4), w, d };
    if (rooms.some((o) => r.x < o.x + o.w + 4 && o.x < r.x + r.w + 4 && r.z < o.z + o.d + 4 && o.z < r.z + r.d + 4)) continue;
    rooms.push(r);
  }
  for (const r of rooms) carve(g, r.x, r.z, r.w, r.d, SURF.FLOOR);
  const center = (r) => ({ x: Math.floor(r.x + r.w / 2), z: Math.floor(r.z + r.d / 2) });
  // Spanning tree over room centres, plus two loops.
  const inTree = [0], edges = [];
  while (inTree.length < rooms.length) {
    let best = null;
    for (const a of inTree) for (let b = 0; b < rooms.length; b++) {
      if (inTree.includes(b)) continue;
      const d = Math.hypot(center(rooms[a]).x - center(rooms[b]).x, center(rooms[a]).z - center(rooms[b]).z);
      if (!best || d < best.d) best = { a, b, d };
    }
    inTree.push(best.b); edges.push(best);
  }
  for (let k = 0; k < 2; k++) { const a = rng.int(1, rooms.length - 1), b = rng.int(1, rooms.length - 1); if (a !== b) edges.push({ a, b }); }
  for (const e of edges) corridor(g, center(rooms[e.a]), center(rooms[e.b]), 3, SURF.PATH, rng);
  // The entrance: the room farthest from the far room.
  const fc = center(far);
  const startRoom = rooms.slice(1).reduce((b, r) => (Math.hypot(center(r).x - fc.x, center(r).z - fc.z) > Math.hypot(center(b).x - fc.x, center(b).z - fc.z) ? r : b));
  const sc = center(startRoom);
  setEntry(z, sc.x, sc.z, Math.atan2(fc.x - sc.x, fc.z - sc.z));
  z.rooms = rooms.map((r, n) => ({ ...r, name: r === far ? (boss ? 'The Jailer\'s Block' : 'Stair Room') : r === startRoom ? 'Holding Cell' : `Cell Block ${n}` }));
  if (boss) {
    setArena(z, 'block', 'The Jailer\'s Block', 'iron_jailer', fc.x, fc.z, 11, 0);
    // Cell pillars the Jailer's cages drop between.
    for (const [ox, oz] of [[-7, -6], [7, -6], [-7, 6], [7, 6]]) {
      const i = fc.x + ox, j = fc.z + oz;
      for (const [di, dj] of [[0, 0], [1, 0], [0, 1], [1, 1]]) g.set(i + di, j + dj, F.OBSTACLE);
      z.arena.pillars.push({ x: i + 1, z: j + 1, i, j });
    }
    z.exit = { i: fc.x, j: far.z + 2, x: fc.x + 0.5, z: far.z + 2.5, h: 0, type: 'stair', locked: true };
  } else {
    z.exit = { i: fc.x, j: fc.z, x: fc.x + 0.5, z: fc.z + 0.5, h: 0, type: 'stair', locked: true };
    // The Warden waits in a room off the main way, so finding him is part of the floor.
    const others = rooms.filter((r) => r !== far && r !== startRoom);
    const wr = others.length ? others[rng.int(0, others.length - 1)] : far;
    const wc = center(wr);
    z.warden = { x: wc.x + 0.5, z: wc.z + 0.5 };
  }
  g.set(z.exit.i, z.exit.j, F.OBSTACLE);
  mark(g, z.exit.x, z.exit.z, 3, F.NOSPAWN);
  markRoute(z, { x: z.exit.x + 1.5, z: z.exit.z });
  z.modifier = floor === 1 || boss ? 'none' : ['none', 'dark', 'swarm', 'elite', 'traps'][rng.int(0, 4)];
  if (z.modifier === 'traps') {
    for (const r of rooms) if (r !== startRoom && rng.chance(0.6)) {
      const c = center(r);
      z.hazards.push({ type: 'stalactite', i: c.x, j: c.z, x: c.x + 0.5, z: c.z + 0.5, r: 4 });
      mark(g, c.x + 0.5, c.z + 0.5, 4, F.HAZARD);
    }
  }
  const table = def.nodes.filter((n) => n.node !== 'ore_chromantite' || floor >= 5);
  placeNodes(z, rng, table.map((n) => (n.node === 'ore_chromantite' ? { ...n, w: 2 } : n)), 12, (i, j) => nearWall(g, i, j) && !corridorCell(g, i, j), 4);
  if (floor >= 5) placeNodes(z, rng, [{ node: 'ore_chromantite', w: 1 }], 2, (i, j) => Math.hypot(i - fc.x, j - fc.z) < 14 && nearWall(g, i, j) && !corridorCell(g, i, j), 4);
  if (floor === 1) placeLore(z, rng, rooms.filter((r) => r !== far).map(center));
  for (const r of rooms) if (rng.chance(0.7)) z.decor.glow.push({ x: r.x + 1.5, z: r.z + 1.5, h: 0, c: 0 }, { x: r.x + r.w - 1.5, z: r.z + 1.5, h: 0, c: 1 });
  return z;
}

// ------------------------------------------------------------------ The Twin Slimes
// Two lanes side by side. Each lane's gates open from a lever in the other lane, so the way
// north means crossing back and forth over the gel bridges.
function lanes(def, seed) {
  const N = def.gen.size;
  const rng = makeRng(seed);
  const z = walled(def, seed, N);
  const g = z.grid;
  const L = { x: 22, w: 16 }, R = { x: N - 38, w: 16 };
  carve(g, 20, 98, N - 40, 16, SURF.GEL);                 // the twin hall at the south
  carve(g, L.x, 30, L.w, 70, SURF.GEL);
  carve(g, R.x, 30, R.w, 70, SURF.GEL);
  carve(g, 16, 4, N - 32, 28, SURF.GEL);                  // the throne at the north
  const gateZ = [84, 62, 40];
  const bridgeZ = [rng.int(73, 78), rng.int(50, 56)];
  for (const bz of bridgeZ) carve(g, L.x + L.w, bz, R.x - (L.x + L.w), 4, SURF.BRIDGE);
  // Gates: a row of solid gel across each lane, opened from the other side.
  for (const [lane, side] of [['left', L], ['right', R]]) {
    gateZ.forEach((gz, n) => {
      const cells = [];
      for (let i = side.x; i < side.x + side.w; i++) for (const j of [gz, gz + 1]) { g.set(i, j, F.OBSTACLE); cells.push(g.idx(i, j)); }
      z.gates.push({ id: `${lane}${n}`, lane, cells, x: side.x + side.w / 2, z: gz + 1, open: false });
    });
  }
  // Levers sit in the other lane, between that lane's gates, so each crossing pays off.
  z.levers = [];
  for (const gate of z.gates) {
    const other = gate.lane === 'left' ? R : L;
    const n = Number(gate.id.slice(-1));
    const lo = n === 0 ? 86 : gateZ[n - 1] + 3, hi = n === 0 ? 96 : gateZ[n - 1] + 18;
    const j = rng.int(Math.min(lo, hi - 1), hi - 1);
    const i = rng.chance(0.5) ? other.x + 1 : other.x + other.w - 2;
    g.set(i, j, F.OBSTACLE);
    z.levers.push({ id: `lever_${gate.id}`, gate: gate.id, lane: gate.lane === 'left' ? 'right' : 'left', i, j, x: i + 0.5, z: j + 0.5 });
  }
  setEntry(z, N / 2, 106, Math.PI);
  setArena(z, 'throne', 'The Twin Throne', 'siamese', N / 2, 17, 11, 0);
  z.rooms = [{ name: 'Twin Hall' }, { name: 'Left Lane' }, { name: 'Right Lane' }, { name: 'The Twin Throne' }];
  const open = z.gates.flatMap((gt) => gt.cells);
  markRoute(z, { x: L.x + L.w / 2, z: 30 }, open);
  markRoute(z, { x: R.x + R.w / 2, z: 30 }, open);
  placeNodes(z, rng, def.nodes, 10, (i, j) => nearWall(g, i, j) && !corridorCell(g, i, j) && j > 30, 5);
  placeLore(z, rng, [{ x: 30, z: 100 }, { x: N - 30, z: 100 }]);
  for (let k = 0; k < 30; k++) { const i = rng.int(20, N - 20), j = rng.int(30, 110); if (g.walkable(i, j) && nearWall(g, i, j)) z.decor.glow.push({ x: i + 0.5, z: j + 0.5, h: 0, c: rng.int(0, 1) }); }
  return z;
}

// ------------------------------------------------------------------ The Corrupted King
// Gatehouse, Courtyard, Great Hall and the Throne Room, one after another. Purple Adamite has
// grown across the floors; braziers burn it back.
function castle(def, seed) {
  const N = def.gen.size;
  const rng = makeRng(seed);
  const z = walled(def, seed, N);
  const g = z.grid;
  const c = N / 2;
  const rooms = [
    { name: 'Gatehouse', x: c - 12, z: 96, w: 24, d: 16 },
    { name: 'Courtyard', x: c - 32, z: 58, w: 64, d: 30 },
    { name: 'Great Hall', x: c - 20, z: 28, w: 40, d: 22 },
    { name: 'Throne Room', x: c - 16, z: 3, w: 32, d: 22 },
  ];
  rooms[1].x += rng.int(-6, 6); rooms[2].x += rng.int(-6, 6);
  for (const r of rooms) carve(g, r.x, r.z, r.w, r.d, r.name === 'Courtyard' ? SURF.GRASS : r.name === 'Throne Room' ? SURF.CARPET : SURF.FLOOR);
  const mid = (r) => ({ x: Math.floor(r.x + r.w / 2), z: Math.floor(r.z + r.d / 2) });
  for (let n = 0; n < rooms.length - 1; n++) corridor(g, { x: mid(rooms[n]).x, z: rooms[n].z + 1 }, { x: mid(rooms[n + 1]).x, z: rooms[n + 1].z + rooms[n + 1].d - 2 }, 5, SURF.PATH, rng);
  z.rooms = rooms;
  setEntry(z, mid(rooms[0]).x, 108, Math.PI);
  const t = mid(rooms[3]);
  setArena(z, 'throne', 'The Amethyst Throne', 'adamite_king', t.x, t.z + 1, 10, 0);
  markRoute(z, { x: z.arena.x, z: z.arena.z + 9 });
  // Corruption: blobs of adamite ground in the courtyard and the hall.
  for (const r of rooms.slice(1, 3)) {
    for (let b = 0; b < 7; b++) {
      const bx = rng.range(r.x + 3, r.x + r.w - 3), bz = rng.range(r.z + 3, r.z + r.d - 3), br = rng.range(2.5, 5);
      for (let j = Math.floor(bz - br); j <= bz + br; j++) for (let i = Math.floor(bx - br); i <= bx + br; i++) {
        if (!g.walkable(i, j) || Math.hypot(i + 0.5 - bx, j + 0.5 - bz) > br) continue;
        g.set(i, j, F.CORRUPT); g.surf[g.idx(i, j)] = SURF.ADAMITE;
      }
    }
  }
  // The throne room is corrupted all around its edge.
  for (let j = rooms[3].z; j < rooms[3].z + rooms[3].d; j++) for (let i = rooms[3].x; i < rooms[3].x + rooms[3].w; i++) {
    if (!g.walkable(i, j) || Math.hypot(i + 0.5 - z.arena.x, j + 0.5 - z.arena.z) < 7) continue;
    g.set(i, j, F.CORRUPT); g.surf[g.idx(i, j)] = SURF.ADAMITE;
  }
  // Braziers: two along the walls of every room but the gatehouse.
  z.braziers = [];
  for (const r of rooms.slice(1)) {
    for (const side of [r.x + 2, r.x + r.w - 3]) {
      const j = rng.int(r.z + 3, r.z + r.d - 4), i = side;
      if (!g.walkable(i, j) || g.has(i, j, F.PATH | F.ARENA)) continue;
      g.set(i, j, F.OBSTACLE); g.clear(i, j, F.CORRUPT);
      z.braziers.push({ i, j, x: i + 0.5, z: j + 0.5, r: 3.2 });
    }
  }
  placeNodes(z, rng, def.nodes, 12, (i, j) => j < 92 && !g.has(i, j, F.ARENA) && !corridorCell(g, i, j) && (nearWall(g, i, j) || g.has(i, j, F.CORRUPT)), 4);
  placeLore(z, rng, [mid(rooms[0]), mid(rooms[2])]);
  for (const r of rooms) for (let k = 0; k < 4; k++) z.decor.glow.push({ x: r.x + 1.5 + rng.next() * (r.w - 3), z: r.z + 1.5, h: 0, c: rng.int(0, 1) });
  return z;
}

// ------------------------------------------------------------------ The Mirrored
// A glass line runs down the middle. You walk the left; your Reflection walks the right, at your
// mirrored position. Each gate opens while both of you stand on mirrored plates. The right side has
// walls of its own, so you must lead the Reflection around them.
function mirror(def, seed) {
  const N = def.gen.size;
  const rng = makeRng(seed);
  const z = walled(def, seed, N);
  const g = z.grid;
  const ax = N / 2; // cells ax-1 | ax are the glass line
  // Each gate row sits right between two chambers.
  const chambers = [{ z: 92, d: 14 }, { z: 68, d: 22 }, { z: 42, d: 24 }];
  const lo = 8, hi = ax - 2;
  for (const ch of chambers) { carve(g, lo, ch.z, hi - lo, ch.d, SURF.GLASS); carve(g, N - hi, ch.z, hi - lo, ch.d, SURF.GLASS); }
  carve(g, lo, 6, N - 2 * lo, 34, SURF.GLASS); // the hall of mirrors: both sides meet
  z.axis = ax;
  // Gates between chambers: a gap in the left half and its mirror in the right half.
  const gateRows = [chambers[0].z - 2, chambers[1].z - 2, chambers[2].z - 2];
  z.plates = [];
  gateRows.forEach((gz, n) => {
    const gapL = rng.int(lo + 3, hi - 7);
    const cells = [];
    for (const x0 of [gapL, N - gapL - 4]) for (let i = x0; i < x0 + 4; i++) for (const j of [gz, gz + 1]) { carve(g, i, j, 1, 1, SURF.GLASS); g.set(i, j, F.OBSTACLE); cells.push(g.idx(i, j)); }
    z.gates.push({ id: `gate${n}`, cells, x: ax, z: gz + 1, open: false });
    const ch = chambers[n];
    const pi = rng.int(lo + 2, hi - 3), pj = rng.int(ch.z + 2, ch.z + ch.d - 3);
    z.plates.push({ gate: `gate${n}`, left: { i: pi, j: pj, x: pi + 0.5, z: pj + 0.5 }, right: { i: N - 1 - pi, j: pj, x: N - 1 - pi + 0.5, z: pj + 0.5 } });
  });
  // The Reflection's side has walls the left does not: a short wall across its chamber,
  // with a gap that is not where yours would be.
  z.mirrorWalls = [];
  chambers.forEach((ch, n) => {
    if (n === 0) return;
    const wz = ch.z + Math.floor(ch.d / 2) + rng.int(-2, 2);
    const plate = z.plates[n];
    if (Math.abs(wz - plate.right.j) < 2) return;
    const gap = rng.chance(0.5) ? N - hi + 1 : N - lo - 6;
    for (let i = N - hi; i < N - lo; i++) {
      if (i >= gap && i < gap + 5) continue;
      g.setWall(i, wz); g.surf[g.idx(i, wz)] = SURF.WALL;
      z.mirrorWalls.push(g.idx(i, wz));
    }
  });
  setEntry(z, lo + (hi - lo) / 2, chambers[0].z + chambers[0].d - 4, Math.PI);
  setArena(z, 'hall', 'The Hall of Mirrors', 'you', ax, 22, 12, 0);
  const open = z.gates.flatMap((gt) => gt.cells);
  markRoute(z, { x: z.arena.x - 6, z: z.arena.z + 6 }, open);
  // Where can the Reflection go? From its start, over the right half, gates open.
  const rs = { i: N - 1 - Math.floor(z.spawn.x), j: Math.floor(z.spawn.z) };
  const openSet = new Set(open);
  z.reflectionStart = { x: N - z.spawn.x, z: z.spawn.z };
  z.reflectionReach = g.bfs(rs.i, rs.j, { passable: (i, j) => i >= ax && (g.walkable(i, j) || openSet.has(g.idx(i, j))) });
  placeNodes(z, rng, def.nodes, 10, (i, j) => i < ax - 2 && j > 38 && nearWall(g, i, j) && !corridorCell(g, i, j) && !z.plates.some((p) => Math.abs(p.left.i - i) + Math.abs(p.left.j - j) < 3), 4);
  placeLore(z, rng, [{ x: lo + 4, z: chambers[0].z + 3 }, { x: lo + 6, z: chambers[1].z + 4 }]);
  for (let k = 0; k < 24; k++) { const i = rng.int(lo, N - lo), j = rng.int(6, 104); if (g.walkable(i, j) && nearWall(g, i, j)) z.decor.glow.push({ x: i + 0.5, z: j + 0.5, h: 0, c: rng.int(0, 1) }); }
  return z;
}

// ------------------------------------------------------------------ The Dragons' Roost
// A spiral of floating plateaus climbing to the summit; ramps where the climb is gentle,
// updrafts where it is not. Standing rocks shelter you from the breath sweeping the paths.
function peaks(def, seed) {
  const N = def.gen.size, c = N / 2;
  const rng = makeRng(seed);
  const g = new ZoneGrid(N, N);
  g.seaLevel = -30;
  const z = { id: def.id, type: 'dimension', render: 'isle', def, seed, grid: g, pois: [], nodes: [], hazards: [], updrafts: [], gates: [], decor: {}, rooms: [], rocks: [], nests: [] };
  for (let k = 0; k < N * N; k++) { g.h[k] = -24; g.flags[k] = F.VOID | F.DEEP; g.surf[k] = SURF.ROCK; }
  // Seven plateaus spiral inward, each a fixed gap from the last; the summit stands in the middle.
  let a = rng.range(0, Math.PI * 2);
  const plats = [];
  const n = 8;
  for (let k = 0; k < n - 1; k++) {
    const rad = 64 - k * 4.5, r = rng.int(9, 12);
    if (k > 0) a += (plats[k - 1].r + r + 9) / rad;
    plats.push({ x: c + Math.cos(a) * rad, z: c + Math.sin(a) * rad, r, h: Math.round(6 + k * 4.6) });
  }
  plats.push({ x: c, z: c, r: 15, h: 40 });
  const top = plats[n - 1];
  for (const p of plats) {
    for (let j = Math.floor(p.z - p.r - 2); j <= p.z + p.r + 2; j++) for (let i = Math.floor(p.x - p.r - 2); i <= p.x + p.r + 2; i++) {
      if (!g.inside(i, j) || Math.hypot(i + 0.5 - p.x, j + 0.5 - p.z) > p.r) continue;
      const k = g.idx(i, j);
      g.flags[k] &= ~(F.VOID | F.DEEP); g.h[k] = p.h;
      g.surf[k] = Math.hypot(i + 0.5 - p.x, j + 0.5 - p.z) > p.r - 1.5 ? SURF.ROCK : p === top ? SURF.BASALT : SURF.DIRT;
    }
  }
  // Links: a stone ramp when the climb is gentle, an updraft pair when it is steep.
  for (let k = 0; k < n - 1; k++) {
    const A = plats[k], B = plats[k + 1];
    const dx = B.x - A.x, dz = B.z - A.z, l = Math.hypot(dx, dz), ux = dx / l, uz = dz / l;
    const pa = { x: A.x + ux * (A.r - 1), z: A.z + uz * (A.r - 1) }, pb = { x: B.x - ux * (B.r - 1), z: B.z - uz * (B.r - 1) };
    const span = Math.hypot(pb.x - pa.x, pb.z - pa.z), dh = B.h - A.h;
    if (dh <= span * 0.8) {
      // A stone ramp: every cell's height follows its position along the link, so no step
      // between neighbours is ever more than one block.
      const x0 = Math.floor(Math.min(pa.x, pb.x) - 3), x1 = Math.ceil(Math.max(pa.x, pb.x) + 3);
      const z0 = Math.floor(Math.min(pa.z, pb.z) - 3), z1 = Math.ceil(Math.max(pa.z, pb.z) + 3);
      for (let j = z0; j <= z1; j++) for (let i = x0; i <= x1; i++) {
        if (!g.inside(i, j)) continue;
        const rx = i + 0.5 - pa.x, rz = j + 0.5 - pa.z;
        const along = rx * ux + rz * uz, perp = Math.abs(rx * uz - rz * ux);
        if (perp > 1.6 || along < -0.5 || along > span + 0.5) continue;
        const kk = g.idx(i, j), t = Math.max(0, Math.min(1, along / span));
        g.flags[kk] &= ~(F.VOID | F.DEEP);
        g.h[kk] = Math.round(A.h + dh * t);
        if (g.surf[kk] === SURF.ROCK) g.surf[kk] = SURF.BASALT;
        g.flags[kk] |= F.PATH;
      }
    } else {
      const ia = { x: Math.floor(A.x + ux * (A.r - 3)) + 0.5, z: Math.floor(A.z + uz * (A.r - 3)) + 0.5 }, ib = { x: Math.floor(B.x - ux * (B.r - 3)) + 0.5, z: Math.floor(B.z - uz * (B.r - 3)) + 0.5 };
      z.updrafts.push({ ...ia, h: A.h, to: { ...ib, h: B.h } }, { ...ib, h: B.h, to: { ...ia, h: A.h } });
      mark(g, ia.x, ia.z, 1.6, F.PATH | F.NOSPAWN); mark(g, ib.x, ib.z, 1.6, F.PATH | F.NOSPAWN);
    }
  }
  const start = plats[0];
  z.landing = { x: Math.floor(start.x) + 0.5, z: Math.floor(start.z) + 0.5, h: start.h };
  setEntry(z, start.x, start.z, Math.atan2(plats[1].x - start.x, plats[1].z - start.z));
  setArena(z, 'summit', 'The Summit of Ragnarok', 'ragnarok', top.x, top.z, 13, top.h);
  // Standing rocks to hide behind, and nests on the middle plateaus.
  for (const p of plats.slice(1, n - 1)) {
    for (let k = 0; k < 2; k++) {
      const a = rng.range(0, Math.PI * 2), r = rng.range(3, p.r - 3);
      const i = Math.floor(p.x + Math.cos(a) * r), j = Math.floor(p.z + Math.sin(a) * r);
      if ([[0, 0], [1, 0], [0, 1], [1, 1]].some(([di, dj]) => !g.walkable(i + di, j + dj) || g.has(i + di, j + dj, F.PATH | F.NOSPAWN))) continue;
      for (const [di, dj] of [[0, 0], [1, 0], [0, 1], [1, 1]]) g.set(i + di, j + dj, F.OBSTACLE);
      z.rocks.push({ i, j, x: i + 1, z: j + 1, h: p.h });
    }
    if ([2, 4, 5].includes(plats.indexOf(p))) z.nests.push({ x: p.x, z: p.z, h: p.h, plat: plats.indexOf(p) });
  }
  z.plats = plats;
  placeNodes(z, rng, def.nodes, 14, (i, j) => {
    if (g.has(i, j, F.VOID | F.ARENA)) return false;
    for (const [di, dj] of N8) if (g.has(i + di, j + dj, F.VOID)) return false;
    return !z.nests.some((ns) => Math.hypot(ns.x - i, ns.z - j) < 3);
  }, 4);
  placeLore(z, rng, [plats[2], plats[5]]);
  return z;
}
