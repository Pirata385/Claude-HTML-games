// The four elemental isles. Each has its own generator, but they all return the same shape:
// { grid, spawn, landing, arena, pois, nodes, ... } so the rest of the game treats them alike.
import { ZoneGrid, F, SURF, N4, N8 } from '../grid.js';
import { makeRng, hashSeed } from '../../core/rng.js';
import { makeNoise2D, fbm2D } from '../../core/noise.js';
import { astar, flattenDisk } from './common.js';
import { smoothRamp } from './island.js';
import { applyTide, TIDE, SEA } from '../tide.js';
import { isleReach } from './validate.js';

export function generateIsle(def, seed) {
  const kind = def.gen.kind;
  const z = kind === 'spires' ? spires(def, seed) : kind === 'atoll' ? atoll(def, seed) : kind === 'volcano' ? volcano(def, seed) : mesas(def, seed);
  pruneUnreachable(z);
  return z;
}

// Nodes must never wall anything off: drop any that ended up out of reach.
function pruneUnreachable(z) {
  const g = z.grid;
  for (let pass = 0; pass < 4; pass++) {
    const d = isleReach(z);
    const ok = (o) => N4.some(([di, dj]) => g.inside(o.i + di, o.j + dj) && d[g.idx(o.i + di, o.j + dj)] >= 0);
    const bad = z.nodes.filter((n) => !ok(n));
    if (!bad.length) break;
    for (const n of bad) g.clear(n.i, n.j, F.OBSTACLE);
    z.nodes = z.nodes.filter((n) => !bad.includes(n));
  }
  z.nodes.forEach((n, k) => { n.id = `n${k}`; });
}

// ------------------------------------------------------------------ shared helpers
function base(def, seed, N) {
  const g = new ZoneGrid(N, N);
  g.seaLevel = SEA;
  return { id: def.id, type: 'isle', def, seed, grid: g, pois: [], nodes: [], updrafts: [], tidal: [], worldroot: [], decor: {}, paths: [] };
}

const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

function markDisk(g, cx, cz, r, flag) {
  for (let j = Math.floor(cz - r); j <= cz + r; j++) for (let i = Math.floor(cx - r); i <= cx + r; i++)
    if (g.inside(i, j) && Math.hypot(i + 0.5 - cx, j + 0.5 - cz) <= r) g.set(i, j, flag);
}

function protectDisk(protect, g, cx, cz, r) {
  for (let j = Math.floor(cz - r); j <= cz + r; j++) for (let i = Math.floor(cx - r); i <= cx + r; i++)
    if (g.inside(i, j) && Math.hypot(i + 0.5 - cx, j + 0.5 - cz) <= r) protect[g.idx(i, j)] = 1;
}

// A walkable path between two points: A* (steep steps allowed but costly) then smoothed into ramps.
function carvePath(z, from, to, protect, extraCost) {
  const g = z.grid;
  const cost = (i0, j0, i1, j1) => {
    const k = g.idx(i1, j1);
    if (g.flags[k] & (F.VOID | F.DEEP)) return Infinity;
    const dh = Math.abs(g.h[k] - g.h[g.idx(i0, j0)]);
    return 1 + (dh > 1 ? 10 * dh : dh * 2) + (extraCost ? extraCost(k) : 0);
  };
  const p = astar(g, Math.floor(from.x), Math.floor(from.z), Math.floor(to.x), Math.floor(to.z), cost);
  if (!p) return null;
  smoothRamp(g, p, protect);
  for (const [i, j] of p) g.set(i, j, F.PATH);
  z.paths.push(p);
  return p;
}

// Spread resource nodes over candidate cells with a minimum spacing.
// Only cells the player can walk to from the landing are used.
function placeNodes(z, rng, table, want, ok, spacing = 3) {
  const g = z.grid;
  const reach = isleReach(z);
  const cells = [];
  for (let j = 2; j < g.d - 2; j++) for (let i = 2; i < g.w - 2; i++) if (reach[g.idx(i, j)] >= 0 && ok(i, j)) cells.push([i, j]);
  rng.shuffle(cells);
  const taken = [];
  const occupied = (i, j) => taken.some(([a, b]) => Math.abs(a - i) < spacing && Math.abs(b - j) < spacing);
  for (const [i, j] of cells) {
    if (z.nodes.length >= want) break;
    if (occupied(i, j)) continue;
    let near = false;
    for (const [di, dj] of N8) if (g.has(i + di, j + dj, F.PATH | F.OBSTACLE | F.POI)) near = true;
    if (near) continue;
    const pick = rng.weighted(table.filter((t) => !t.when || t.when(i, j)));
    if (!pick) continue;
    g.set(i, j, F.OBSTACLE);
    taken.push([i, j]);
    z.nodes.push({ id: `n${z.nodes.length}`, node: pick.node, i, j, x: i + 0.5, z: j + 0.5, h: g.h[g.idx(i, j)], rot: rng.next() * Math.PI * 2, scale: 0.85 + rng.next() * 0.3 });
  }
}

function placeLore(z, spots) {
  const g = z.grid;
  z.def.lore.forEach((id, n) => {
    const s = spots[n];
    const i = Math.floor(s.x), j = Math.floor(s.z);
    g.set(i, j, F.POI | F.OBSTACLE);
    z.pois.push({ id, type: 'lore', i, j, x: i + 0.5, z: j + 0.5, r: 2 });
  });
}

function arena(z, id, name, boss, x, zz, r, h) {
  const g = z.grid;
  z.arena = { id, name, boss, x: Math.floor(x) + 0.5, z: Math.floor(zz) + 0.5, r, h, pillars: [] };
  markDisk(g, z.arena.x, z.arena.z, r, F.ARENA | F.NOSPAWN);
}

function landing(z, x, zz, yaw) {
  const g = z.grid;
  z.landing = { x: Math.floor(x) + 0.5, z: Math.floor(zz) + 0.5, h: g.h[g.idx(Math.floor(x), Math.floor(zz))] };
  z.spawn = { x: z.landing.x + Math.sin(yaw) * 3, z: z.landing.z + Math.cos(yaw) * 3 };
  z.spawnYaw = yaw;
  markDisk(g, z.landing.x, z.landing.z, 7, F.NOSPAWN);
  g.set(Math.floor(x), Math.floor(zz), F.OBSTACLE); // the return stone
}

// ------------------------------------------------------------------ Air: the Galeforge Spires
function spires(def, seed) {
  const N = def.gen.size, c = N / 2;
  const rng = makeRng(seed), nE = makeNoise2D(hashSeed(seed, 2)), nH = makeNoise2D(hashSeed(seed, 3));
  const z = base(def, seed, N), g = z.grid;
  for (let k = 0; k < N * N; k++) { g.h[k] = -24; g.flags[k] = F.VOID | F.DEEP; g.surf[k] = SURF.ROCK; }
  const land = { x: c, z: c + 72, r: 12, h: 8 }, top = { x: c, z: c - 70, r: 14, h: 30 };
  const plats = [land, top];
  for (let t = 0; t < 5000 && plats.length < 12; t++) {
    const x = rng.range(26, N - 26), zz = rng.range(26, N - 26), r = rng.int(9, 15);
    if (plats.some((p) => dist(p, { x, z: zz }) < p.r + r + 11)) continue;
    const h = Math.round(8 + (1 - (zz - top.z) / (land.z - top.z)) * 18 + rng.int(-3, 3));
    plats.push({ x, z: zz, r, h });
  }
  // Raise the plateaus: flat tops with a wind-carved rim.
  for (const p of plats) {
    for (let j = Math.floor(p.z - p.r - 3); j <= p.z + p.r + 3; j++) for (let i = Math.floor(p.x - p.r - 3); i <= p.x + p.r + 3; i++) {
      if (!g.inside(i, j)) continue;
      const a = Math.atan2(j - p.z, i - p.x), d = Math.hypot(i + 0.5 - p.x, j + 0.5 - p.z);
      const edge = p.r * (1 + 0.16 * nE(Math.cos(a) * 1.5 + p.x, Math.sin(a) * 1.5 + p.z));
      if (d > edge) continue;
      const k = g.idx(i, j);
      g.flags[k] &= ~(F.VOID | F.DEEP);
      const flat = p === land || p === top;
      g.h[k] = p.h + (!flat && d < edge - 3 && nH(i / 8, j / 8) > 0.45 ? 1 : 0);
      g.surf[k] = d > edge - 2 ? SURF.ROCK : SURF.GRASS;
    }
  }
  // Link the plateaus: a minimum spanning tree plus two extra links.
  const inTree = [0], edges = [];
  while (inTree.length < plats.length) {
    let best = null;
    for (const a of inTree) for (let b = 0; b < plats.length; b++) {
      if (inTree.includes(b)) continue;
      const d = dist(plats[a], plats[b]) - plats[a].r - plats[b].r;
      if (!best || d < best.d) best = { a, b, d };
    }
    inTree.push(best.b); edges.push(best);
  }
  const extra = [];
  for (let a = 0; a < plats.length; a++) for (let b = a + 1; b < plats.length; b++) {
    if (edges.some((e) => (e.a === a && e.b === b) || (e.a === b && e.b === a))) continue;
    extra.push({ a, b, d: dist(plats[a], plats[b]) - plats[a].r - plats[b].r });
  }
  extra.sort((x, y) => x.d - y.d);
  edges.push(...extra.slice(0, 2));
  const pads = [];
  for (const e of edges) {
    const A = plats[e.a], B = plats[e.b];
    const dx = B.x - A.x, dz = B.z - A.z, l = Math.hypot(dx, dz), ux = dx / l, uz = dz / l;
    const pa = { x: A.x + ux * (A.r - 2), z: A.z + uz * (A.r - 2) }, pb = { x: B.x - ux * (B.r - 2), z: B.z - uz * (B.r - 2) };
    const span = dist(pa, pb), dh = Math.abs(B.h - A.h);
    if (dh <= span * 0.7 && dh <= 8 && e.b !== 1 && e.a !== 1) {
      // A plank bridge rising one block at a time.
      const steps = Math.ceil(span * 2);
      for (let s = 0; s <= steps; s++) {
        const t = s / steps, x = pa.x + (pb.x - pa.x) * t, zz = pa.z + (pb.z - pa.z) * t;
        for (let w = -1; w <= 1; w++) {
          const i = Math.floor(x - uz * w), j = Math.floor(zz + ux * w);
          if (!g.inside(i, j)) continue;
          const k = g.idx(i, j);
          if (!(g.flags[k] & F.VOID)) continue;
          g.flags[k] &= ~(F.VOID | F.DEEP);
          g.h[k] = Math.round(A.h + (B.h - A.h) * t);
          g.surf[k] = SURF.BRIDGE;
          g.flags[k] |= F.PATH;
        }
      }
    } else {
      // An updraft vent carries you across; another brings you back.
      const ia = { x: A.x + ux * (A.r - 4), z: A.z + uz * (A.r - 4) }, ib = { x: B.x - ux * (B.r - 4), z: B.z - uz * (B.r - 4) };
      pads.push({ x: Math.floor(ia.x) + 0.5, z: Math.floor(ia.z) + 0.5, to: { x: Math.floor(ib.x) + 0.5, z: Math.floor(ib.z) + 0.5 } });
      pads.push({ x: Math.floor(ib.x) + 0.5, z: Math.floor(ib.z) + 0.5, to: { x: Math.floor(ia.x) + 0.5, z: Math.floor(ia.z) + 0.5 } });
    }
  }
  for (const p of pads) {
    p.h = g.h[g.idx(Math.floor(p.x), Math.floor(p.z))];
    p.to.h = g.h[g.idx(Math.floor(p.to.x), Math.floor(p.to.z))];
    markDisk(g, p.x, p.z, 1.6, F.PATH | F.NOSPAWN);
    markDisk(g, p.to.x, p.to.z, 1.6, F.NOSPAWN);
  }
  z.updrafts = pads;
  arena(z, 'shrine', 'The Windward Shrine', 'ronin_east_wind', top.x, top.z, 12, top.h);
  landing(z, land.x, land.z, Math.PI);
  const others = plats.slice(2).sort((a, b) => b.r - a.r);
  placeLore(z, [{ x: others[0].x + 2, z: others[0].z }, { x: others[1].x - 2, z: others[1].z }]);
  const rngN = makeRng(hashSeed(seed, 9));
  placeNodes(z, rngN, def.nodes, 110, (i, j) => {
    const k = g.idx(i, j);
    if (g.flags[k] & (F.VOID | F.PATH | F.ARENA | F.NOSPAWN | F.OBSTACLE)) return false;
    for (let dj = -2; dj <= 2; dj++) for (let di = -2; di <= 2; di++) if (g.has(i + di, j + dj, F.VOID)) return false;
    return true;
  }, 4);
  z.decor.chimes = others.slice(2, 6).map((p) => ({ x: Math.floor(p.x) + 0.5, z: Math.floor(p.z) + 0.5 }));
  for (const ch of z.decor.chimes) { const i = Math.floor(ch.x), j = Math.floor(ch.z); if (!g.has(i, j, F.OBSTACLE)) { g.set(i, j, F.OBSTACLE); ch.h = g.h[g.idx(i, j)]; } else ch.skip = true; }
  z.decor.chimes = z.decor.chimes.filter((ch) => !ch.skip);
  return z;
}

// ------------------------------------------------------------------ Water: Tidecrown Atoll
function atoll(def, seed) {
  const N = def.gen.size, c = N / 2;
  const rng = makeRng(seed), nW = makeNoise2D(hashSeed(seed, 2)), nH = makeNoise2D(hashSeed(seed, 3));
  const z = base(def, seed, N), g = z.grid;
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const k = g.idx(i, j);
    const d = Math.hypot(i + 0.5 - c, j + 0.5 - c) + nW(i / 30, j / 30) * 5;
    let h, s;
    if (d < 17) { h = SEA + 2; s = d < 14 ? SURF.ARENA : SURF.SAND; }
    else if (d < 58) { h = SEA - 3; s = SURF.SEABED; }
    else if (d < 63) { h = SEA - 1; s = SURF.SAND; }
    else if (d < 80) { h = SEA + 2 + (nH(i / 14, j / 14) > 0.2 ? 1 : 0) + (nH(i / 7, j / 7) > 0.6 ? 1 : 0); s = d > 77 || d < 65 ? SURF.SAND : SURF.GRASS; }
    else if (d < 84) { h = SEA + 1; s = SURF.SAND; }
    else { h = Math.max(SEA - 7, SEA - 1 - Math.round((d - 84) / 3)); s = SURF.SEABED; }
    g.h[k] = h; g.surf[k] = s;
  }
  // Sandbars from the ring to the temple islet, revealed only at low tide.
  const a0 = rng.range(0, Math.PI * 2);
  const bars = [0, 1, 2].map((n) => a0 + (n * Math.PI * 2) / 3);
  const protect = new Uint8Array(N * N);
  for (const a of bars) {
    for (let r = 15; r <= 66; r += 0.5) {
      const x = c + Math.cos(a) * r, zz = c + Math.sin(a) * r;
      for (let w = -1.5; w <= 1.5; w += 0.5) {
        const i = Math.floor(x - Math.sin(a) * w), j = Math.floor(zz + Math.cos(a) * w);
        const k = g.idx(i, j);
        if (g.h[k] < SEA - 1) { g.h[k] = SEA - 1; g.surf[k] = SURF.SAND; }
      }
    }
  }
  // Ramps where the sandbars meet the islet and the ring.
  protectDisk(protect, g, c, c, 13);
  for (const a of bars) {
    const p = [];
    for (let r = 10; r <= 70; r++) p.push([Math.floor(c + Math.cos(a) * r), Math.floor(c + Math.sin(a) * r)]);
    smoothRamp(g, p, protect);
    for (const w of [-1, 1]) smoothRamp(g, p.map(([i, j]) => [i + Math.round(-Math.sin(a) * w), j + Math.round(Math.cos(a) * w)]), protect);
  }
  // Tidal cells.
  for (let k = 0; k < N * N; k++) if (g.h[k] >= SEA - 2 && g.h[k] <= SEA + 1) { z.tidal.push(k); g.flags[k] |= F.TIDAL; }
  for (let k = 0; k < N * N; k++) if (g.h[k] < SEA - 1) g.flags[k] |= F.WATER | F.DEEP;
  for (let i = 0; i < N; i++) for (const k of [g.idx(i, 0), g.idx(i, N - 1), g.idx(0, i), g.idx(N - 1, i)]) g.flags[k] |= F.WATER | F.DEEP;
  applyTide(z, TIDE.low);
  // The temple: flat floor with raised stones to stand on when the water rises.
  arena(z, 'temple', 'The Drowned Temple', 'tears_of_poseidon', c, c, 12, SEA + 2);
  for (let n = 0; n < 6; n++) {
    const a = (n / 6) * Math.PI * 2 + 0.4, x = Math.floor(c + Math.cos(a) * 8), zz = Math.floor(c + Math.sin(a) * 8);
    for (let oj = 0; oj < 2; oj++) for (let oi = 0; oi < 2; oi++) g.h[g.idx(x + oi, zz + oj)] = SEA + 4;
    z.arena.pillars.push({ x: x + 1, z: zz + 1, i: x, j: zz, raised: true });
  }
  landing(z, c, c + 72, Math.PI);
  // Lore on the ring.
  const ringSpot = (a) => ({ x: c + Math.cos(a) * 71, z: c + Math.sin(a) * 71 });
  placeLore(z, [ringSpot(-0.6), ringSpot(Math.PI + 0.7)]);
  const rngN = makeRng(hashSeed(seed, 9));
  // Pearl beds on the shallows that only low tide uncovers.
  const pearlTable = [{ node: 'pearl_bed', w: 1 }];
  placeNodes(z, rngN, pearlTable, 14, (i, j) => {
    const k = g.idx(i, j);
    if (g.h[k] !== SEA - 1 || g.flags[k] & (F.PATH | F.OBSTACLE)) return false;
    return N4.some(([di, dj]) => g.walkable(i + di, j + dj));
  }, 5);
  const before = z.nodes.length;
  placeNodes(z, rngN, def.nodes.filter((n) => !n.low), before + 90, (i, j) => {
    const k = g.idx(i, j);
    return g.h[k] >= SEA + 2 && !(g.flags[k] & (F.PATH | F.ARENA | F.NOSPAWN | F.OBSTACLE | F.TIDAL));
  }, 4);
  z.decor.coral = [];
  for (let t = 0; t < 400; t++) {
    const i = rngN.int(2, N - 3), j = rngN.int(2, N - 3), k = g.idx(i, j);
    if (g.h[k] === SEA - 3 && !(g.flags[k] & F.OBSTACLE)) z.decor.coral.push({ x: i + 0.5, z: j + 0.5, h: g.h[k], c: rngN.int(0, 2) });
  }
  z.sandbars = bars;
  return z;
}

// ------------------------------------------------------------------ Fire: Cinderspine
function volcano(def, seed) {
  const N = def.gen.size, c = N / 2;
  const rng = makeRng(seed), nH = makeNoise2D(hashSeed(seed, 2)), nW = makeNoise2D(hashSeed(seed, 4));
  const z = base(def, seed, N), g = z.grid;
  const R = 88;
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const k = g.idx(i, j);
    const d = (Math.hypot(i + 0.5 - c, j + 0.5 - c) + nW(i / 25, j / 25) * 6) / R;
    let h;
    if (d < 1) h = Math.round(SEA + 1 + 22 * Math.pow(1 - d, 1.35) + fbm2D(nH, i / 20, j / 20, 3) * 2.5);
    else h = Math.max(SEA - 6, Math.round(SEA - (d - 1) * 30));
    g.h[k] = h;
    g.surf[k] = h <= SEA ? SURF.SEABED : d > 0.85 ? SURF.SAND : nH(i / 12, j / 12) > 0.3 ? SURF.ROCK : SURF.DIRT;
    if (h <= SEA) g.flags[k] |= F.WATER;
    if (h <= SEA - 2) g.flags[k] |= F.DEEP;
  }
  // The caldera: a flat floor ringed by a rim with two openings.
  const protect = new Uint8Array(N * N);
  const ch = Math.round(SEA + 1 + 22 * Math.pow(1 - 0.17, 1.35));
  flattenDisk(g, c, c, 14, 0, ch);
  protectDisk(protect, g, c, c, 14);
  for (let j = c - 20; j <= c + 20; j++) for (let i = c - 20; i <= c + 20; i++) {
    const d = Math.hypot(i + 0.5 - c, j + 0.5 - c);
    if (d < 14.5 || d > 18) continue;
    const a = Math.atan2(j + 0.5 - c, i + 0.5 - c);
    const gap = Math.abs(Math.atan2(Math.sin(a - Math.PI / 2), Math.cos(a - Math.PI / 2))) < 0.22 || Math.abs(Math.atan2(Math.sin(a), Math.cos(a))) < 0.22;
    g.h[g.idx(i, j)] = gap ? ch : ch + 4;
    g.surf[g.idx(i, j)] = SURF.BASALT;
  }
  arena(z, 'caldera', 'The Caldera', 'magma_vector', c, c, 13, ch);
  for (let j = c - 13; j <= c + 13; j++) for (let i = c - 13; i <= c + 13; i++) if (g.has(i, j, F.ARENA)) g.surf[g.idx(i, j)] = SURF.BASALT;
  // Lava rivers run downhill from the rim to the sea.
  const starts = [0.7, 2.0, 2.6, 3.7, 4.4, 5.4].map((a) => a + rng.range(-0.15, 0.15));
  for (const a of starts) {
    let i = Math.floor(c + Math.cos(a) * 20), j = Math.floor(c + Math.sin(a) * 20);
    for (let step = 0; step < 90; step++) {
      if (!g.inside(i, j) || g.flags[g.idx(i, j)] & F.WATER) break;
      for (const [di, dj] of [[0, 0], [1, 0], [0, 1]]) {
        const k = g.idx(i + di, j + dj);
        if (g.inside(i + di, j + dj) && !(g.flags[k] & (F.WATER | F.ARENA))) { g.flags[k] |= F.LAVA; g.surf[k] = SURF.LAVA; }
      }
      let best = null, bh = Infinity;
      for (const [di, dj] of N8) {
        const ni = i + di, nj = j + dj;
        if (!g.inside(ni, nj)) continue;
        const outward = (ni - c) * Math.cos(a) + (nj - c) * Math.sin(a) > (i - c) * Math.cos(a) + (j - c) * Math.sin(a);
        const hh = g.h[g.idx(ni, nj)] + rng.next() * 0.9 - (outward ? 0.6 : 0);
        if (hh < bh) { bh = hh; best = [ni, nj]; }
      }
      [i, j] = best;
    }
  }
  // Paths: around lava where possible; where they must cross, the lava is bridged with basalt.
  landing(z, c, c + 86, Math.PI);
  const shore = z.landing;
  for (let k = 0; k < N * N; k++) if (Math.hypot((k % N) + 0.5 - shore.x, Math.floor(k / N) + 0.5 - shore.z) < 6 && g.h[k] <= SEA) { g.h[k] = SEA + 1; g.flags[k] &= ~(F.WATER | F.DEEP); g.surf[k] = SURF.SAND; }
  z.landing.h = g.h[g.idx(Math.floor(shore.x), Math.floor(shore.z))];
  const lavaCost = (k) => (g.flags[k] & F.LAVA ? 40 : 0);
  const spots = [{ x: c - 48, z: c + 20 }, { x: c + 46, z: c - 30 }];
  for (const s of spots) { const i = Math.floor(s.x), j = Math.floor(s.z); flattenDisk(g, i + 0.5, j + 0.5, 2, 2, g.h[g.idx(i, j)], protect); protectDisk(protect, g, i + 0.5, j + 0.5, 2); for (let dj = -2; dj <= 2; dj++) for (let di = -2; di <= 2; di++) { const k = g.idx(i + di, j + dj); g.flags[k] &= ~F.LAVA; if (g.surf[k] === SURF.LAVA) g.surf[k] = SURF.BASALT; } }
  for (const t of [{ x: c, z: c + 10 }, ...spots]) carvePath(z, z.spawn, t, protect, lavaCost);
  for (const p of z.paths) for (const [i, j] of p) {
    for (const [di, dj] of [[0, 0], ...N4]) {
      const k = g.idx(i + di, j + dj);
      if (g.inside(i + di, j + dj) && g.flags[k] & F.LAVA) { g.flags[k] &= ~F.LAVA; g.surf[k] = SURF.BASALT; }
    }
    g.surf[g.idx(i, j)] = g.surf[g.idx(i, j)] === SURF.BASALT ? SURF.BASALT : SURF.PATH;
  }
  placeLore(z, spots);
  const rngN = makeRng(hashSeed(seed, 9));
  const nearLava = (i, j) => N8.some(([di, dj]) => g.has(i + di, j + dj, F.LAVA));
  const table = def.nodes.map((n) => (n.node === 'ore_obsidian' ? { ...n, w: 6, when: nearLava } : n));
  placeNodes(z, rngN, table, 100, (i, j) => {
    const k = g.idx(i, j);
    return g.h[k] > SEA && !(g.flags[k] & (F.LAVA | F.PATH | F.ARENA | F.NOSPAWN | F.OBSTACLE | F.WATER)) && Math.hypot(i - c, j - c) > 20;
  }, 4);
  // Every obsidian node must sit by lava; most others away from it.
  return z;
}

// ------------------------------------------------------------------ Earth: the Rootdeep Mesas
function mesas(def, seed) {
  const N = def.gen.size, c = N / 2;
  const rng = makeRng(seed), nH = makeNoise2D(hashSeed(seed, 2)), nW = makeNoise2D(hashSeed(seed, 4));
  const z = base(def, seed, N), g = z.grid;
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const k = g.idx(i, j);
    const d = (Math.hypot(i + 0.5 - c, j + 0.5 - c) + nW(i / 28, j / 28) * 8) / 86;
    let h, s;
    if (d < 1) {
      const v = (fbm2D(nH, i / 42, j / 42, 4) * 0.5 + 0.5) * (1 - Math.pow(d, 3));
      const terrace = Math.max(0, Math.min(6, Math.floor(v * 8)));
      h = SEA + 1 + terrace * 3;
      s = terrace === 0 ? SURF.SAND : terrace <= 1 ? SURF.DIRT : SURF.GRASS;
    } else { h = Math.max(SEA - 6, Math.round(SEA - (d - 1) * 30)); s = SURF.SEABED; }
    g.h[k] = h; g.surf[k] = s;
    if (h <= SEA) g.flags[k] |= F.WATER;
    if (h <= SEA - 2) g.flags[k] |= F.DEEP;
  }
  const protect = new Uint8Array(N * N);
  // The grove on the highest mesa in the north.
  let best = { h: -1 };
  for (let j = 30; j < c - 20; j++) for (let i = 50; i < N - 50; i++) { const h = g.h[g.idx(i, j)]; if (h > best.h) best = { i, j, h }; }
  flattenDisk(g, best.i + 0.5, best.j + 0.5, 14, 6, best.h);
  protectDisk(protect, g, best.i + 0.5, best.j + 0.5, 14);
  arena(z, 'grove', 'The Seed Grove', 'allele_golem', best.i, best.j, 12, best.h);
  for (let j = best.j - 14; j <= best.j + 14; j++) for (let i = best.i - 14; i <= best.i + 14; i++) if (g.has(i, j, F.ARENA)) g.surf[g.idx(i, j)] = SURF.GRASS;
  landing(z, c, c + 84, Math.PI);
  for (let k = 0; k < N * N; k++) if (Math.hypot((k % N) + 0.5 - z.landing.x, Math.floor(k / N) + 0.5 - z.landing.z) < 6) { g.h[k] = Math.max(g.h[k], SEA + 1); g.flags[k] &= ~(F.WATER | F.DEEP); g.surf[k] = SURF.SAND; }
  z.landing.h = g.h[g.idx(Math.floor(z.landing.x), Math.floor(z.landing.z))];
  protectDisk(protect, g, z.landing.x, z.landing.z, 4);
  // The Worldroot: a great fallen root ridge winding across the isle.
  const pts = [];
  const sa = rng.range(-0.3, 0.3);
  for (let t = 0; t <= 1; t += 0.004) {
    const x = c - 70 + 140 * t + Math.sin(t * 6 + sa * 5) * 10, zz = c + 20 - 40 * t + Math.sin(t * 4.3 + 1) * 12;
    pts.push([x, zz]);
  }
  const rootCells = new Map();
  for (const [x, zz] of pts) for (let dj = -2; dj <= 2; dj++) for (let di = -2; di <= 2; di++) {
    const i = Math.floor(x) + di, j = Math.floor(zz) + dj;
    if (!g.inside(i, j) || g.flags[g.idx(i, j)] & (F.WATER | F.ARENA)) continue;
    rootCells.set(g.idx(i, j), [i, j]);
  }
  const centre = [];
  for (const [x, zz] of pts) { const i = Math.floor(x), j = Math.floor(zz); if (g.inside(i, j) && !(g.flags[g.idx(i, j)] & (F.WATER | F.ARENA))) centre.push([i, j]); }
  for (const [k, [i, j]] of rootCells) { g.h[k] = g.h[k] + 2; g.surf[k] = SURF.ROOT; }
  smoothRamp(g, centre, protect);
  for (const [i, j] of centre) { for (const [di, dj] of [[0, 0], ...N8]) { const k = g.idx(i + di, j + dj); if (rootCells.has(k)) g.h[k] = Math.max(g.h[k], g.h[g.idx(i, j)] - 1); } }
  z.worldroot = centre.map(([i, j]) => ({ i, j }));
  for (const [i, j] of centre) g.set(i, j, F.PATH);
  // Paths to the grove, the lore and both ends of the root.
  const loreSpots = [{ x: c - 50, z: c + 40 }, { x: c + 52, z: c + 30 }];
  for (const s of loreSpots) { const i = Math.floor(s.x), j = Math.floor(s.z); flattenDisk(g, i + 0.5, j + 0.5, 2, 2, g.h[g.idx(i, j)], protect); protectDisk(protect, g, i + 0.5, j + 0.5, 2); }
  for (const t of [{ x: z.arena.x, z: z.arena.z + 10 }, ...loreSpots, { x: centre[3][0] + 0.5, z: centre[3][1] + 0.5 }, { x: centre[centre.length - 4][0] + 0.5, z: centre[centre.length - 4][1] + 0.5 }])
    carvePath(z, z.spawn, t, protect);
  for (const p of z.paths) for (const [i, j] of p) if (g.surf[g.idx(i, j)] !== SURF.ROOT) g.surf[g.idx(i, j)] = SURF.PATH;
  placeLore(z, loreSpots);
  const rngN = makeRng(hashSeed(seed, 9));
  // Amber roots grow along the Worldroot's flanks.
  const byRoot = (i, j) => !rootCells.has(g.idx(i, j)) && N8.some(([di, dj]) => rootCells.has(g.idx(i + di, j + dj)));
  placeNodes(z, rngN, [{ node: 'amber_root', w: 1 }], 14, (i, j) => byRoot(i, j) && g.walkable(i, j) && !(g.flags[g.idx(i, j)] & (F.PATH | F.ARENA | F.NOSPAWN)), 6);
  const before = z.nodes.length;
  placeNodes(z, rngN, def.nodes.filter((n) => n.node !== 'amber_root'), before + 90, (i, j) => {
    const k = g.idx(i, j);
    return !(g.flags[k] & (F.WATER | F.PATH | F.ARENA | F.NOSPAWN | F.OBSTACLE)) && !rootCells.has(k);
  }, 4);
  return z;
}
