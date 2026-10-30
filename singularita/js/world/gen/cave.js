// The Hollow Deep: each layer is a cellular-automata cave with one connected floor,
// stairs up and a shaft down at opposite ends, ore veins along the walls and layer hazards.
import { ZoneGrid, F, SURF, N4, N8 } from '../grid.js';
import { makeRng, hashSeed } from '../../core/rng.js';
import { makeNoise2D } from '../../core/noise.js';

export function generateCave(def, seed) {
  for (let attempt = 0; attempt < 8; attempt++) {
    const z = tryCave(def, hashSeed(seed, attempt));
    if (z) return z;
  }
  throw new Error(`cave generation failed for ${def.id}`);
}

function tryCave(def, seed) {
  const N = def.gen.size;
  const rng = makeRng(seed);
  const g = new ZoneGrid(N, N);
  g.wallHeight = def.gen.wallHeight;
  // The automaton runs at half resolution and is upscaled, so passages are 3–6 m wide:
  // room to fight and for the camera.
  const H = N / 2;
  let small = new Uint8Array(H * H);
  for (let j = 0; j < H; j++) for (let i = 0; i < H; i++) {
    const edge = i < 1 || j < 1 || i >= H - 1 || j >= H - 1;
    small[j * H + i] = edge || rng.next() < def.gen.fill ? 1 : 0;
  }
  small = automaton(small, H, def.gen.steps, true);
  let wall = new Uint8Array(N * N);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) wall[j * N + i] = small[(j >> 1) * H + (i >> 1)];
  wall = automaton(wall, N, 2, false);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) if (i < 2 || j < 2 || i >= N - 2 || j >= N - 2) wall[j * N + i] = 1;

  // Keep one connected floor: join big pockets to the main cave, fill the small ones.
  const regions = floodRegions(wall, N);
  if (!regions.length) return null;
  regions.sort((a, b) => b.length - a.length);
  const main = regions[0];
  const inMain = new Uint8Array(N * N);
  for (const k of main) inMain[k] = 1;
  for (const r of regions.slice(1)) {
    if (r.length < 40) { for (const k of r) wall[k] = 1; continue; }
    const a = r[Math.floor(rng.next() * r.length)];
    let best = -1, bd = Infinity;
    for (let t = 0; t < 300; t++) {
      const b = main[Math.floor(rng.next() * main.length)];
      const d = Math.abs((a % N) - (b % N)) + Math.abs(Math.floor(a / N) - Math.floor(b / N));
      if (d < bd) { bd = d; best = b; }
    }
    carveTunnel(wall, N, a % N, Math.floor(a / N), best % N, Math.floor(best / N));
    for (const k of r) inMain[k] = 1;
  }
  let floor = 0;
  for (let k = 0; k < N * N; k++) if (!wall[k]) floor++;
  const frac = floor / (N * N);
  if (frac < 0.3 || frac > 0.7) return null;

  // Heights: gentle one-block terraces so the floor reads as rock, never a cliff.
  const nH = makeNoise2D(hashSeed(seed, 5));
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const k = g.idx(i, j);
    g.h[k] = nH(i / 16, j / 16) > 0.25 ? 1 : 0;
    if (wall[k]) g.flags[k] |= F.WALL;
  }

  // Stairs up and the way down sit at the two ends of the cave's longest walk.
  const open = (i, j, r) => { for (let oj = -r; oj <= r; oj++) for (let oi = -r; oi <= r; oi++) if (!g.inside(i + oi, j + oj) || g.has(i + oi, j + oj, F.WALL)) return false; return true; };
  const anyFloor = main[Math.floor(rng.next() * main.length)];
  const far = (k) => { const d = g.bfs(k % N, Math.floor(k / N), { maxStep: 1 }); let bk = k, bd = -1; for (let x = 0; x < d.length; x++) if (d[x] > bd) { bd = d[x]; bk = x; } return [bk, d, bd]; };
  let [ek] = far(anyFloor);
  let [xk, dFromEntry, diameter] = far(ek);
  const clearAround = (k, r) => {
    const ci = k % N, cj = Math.floor(k / N);
    for (let oj = -r; oj <= r; oj++) for (let oi = -r; oi <= r; oi++) {
      const i = ci + oi, j = cj + oj;
      if (i < 2 || j < 2 || i >= N - 2 || j >= N - 2) continue;
      if (oi * oi + oj * oj <= r * r) { g.clear(i, j, F.WALL); g.h[g.idx(i, j)] = g.h[k]; }
    }
  };
  if (!open(ek % N, Math.floor(ek / N), 2)) clearAround(ek, 3);
  clearAround(xk, def.gen.gate || def.gen.heart ? 5 : 3);
  // Recompute after clearing.
  dFromEntry = g.bfs(ek % N, Math.floor(ek / N), { maxStep: 1 });
  diameter = 0;
  for (let k = 0; k < dFromEntry.length; k++) diameter = Math.max(diameter, dFromEntry[k]);
  const entry = { i: ek % N, j: Math.floor(ek / N), type: 'stairs' };
  const exit = { i: xk % N, j: Math.floor(xk / N), type: def.gen.heart ? 'heart' : def.gen.gate ? 'gate' : 'shaft' };
  for (const p of [entry, exit]) { p.x = p.i + 0.5; p.z = p.j + 0.5; p.h = g.h[g.idx(p.i, p.j)]; }
  if (dFromEntry[g.idx(exit.i, exit.j)] < diameter * 0.6) return null;

  // Main route: walk back down the distance field from the exit.
  const route = [];
  {
    let ci = exit.i, cj = exit.j;
    route.push([ci, cj]);
    while (dFromEntry[g.idx(ci, cj)] > 0) {
      let moved = false;
      for (const [di, dj] of N4) {
        const ni = ci + di, nj = cj + dj;
        if (g.inside(ni, nj) && dFromEntry[g.idx(ni, nj)] === dFromEntry[g.idx(ci, cj)] - 1) { ci = ni; cj = nj; moved = true; break; }
      }
      if (!moved) break;
      route.push([ci, cj]);
    }
  }
  for (const [i, j] of route) { g.set(i, j, F.PATH); for (const [di, dj] of N4) if (g.walkable(i + di, j + dj)) g.set(i + di, j + dj, F.PATH); }
  for (const p of [entry, exit]) for (let oj = -3; oj <= 3; oj++) for (let oi = -3; oi <= 3; oi++) g.set(p.i + oi, p.j + oj, F.NOSPAWN);

  // Split layers have two halves; the first side uses the hot surface and flag, the second the cold one.
  const split = !!def.gen.split;
  const sides = def.gen.sides || ['hot', 'cold'];
  const sideOf = (i) => (split ? (i < N / 2 ? sides[0] : sides[1]) : null);

  // Surfaces.
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const k = g.idx(i, j);
    if (g.flags[k] & F.WALL) g.surf[k] = SURF.WALL;
    else if (split) { g.surf[k] = i < N / 2 ? SURF.HOT : SURF.COLD; g.flags[k] |= i < N / 2 ? F.HOT : F.COLD; }
    else g.surf[k] = SURF.FLOOR;
  }

  const reach = dFromEntry;
  const isReachable = (i, j) => g.inside(i, j) && reach[g.idx(i, j)] >= 0;
  const wallAdjacent = (i, j) => N4.some(([di, dj]) => g.has(i + di, j + dj, F.WALL));
  // A cell squeezed between two walls is a corridor: blocking it would cut the cave in two.
  const corridor = (i, j) => (g.has(i - 1, j, F.WALL | F.OBSTACLE) && g.has(i + 1, j, F.WALL | F.OBSTACLE)) || (g.has(i, j - 1, F.WALL | F.OBSTACLE) && g.has(i, j + 1, F.WALL | F.OBSTACLE));
  const farFrom = (i, j, pts, r) => pts.every((p) => Math.hypot(p.i - i, p.j - j) >= r);
  const candidates = [];
  for (let j = 2; j < N - 2; j++) for (let i = 2; i < N - 2; i++) {
    const k = g.idx(i, j);
    if (!(g.flags[k] & (F.WALL | F.PATH)) && reach[k] > 0) candidates.push([i, j]);
  }
  rng.shuffle(candidates);

  // Lore stones at the quieter ends of the cave.
  const pois = [];
  for (const id of def.lore) {
    for (const [i, j] of candidates) {
      if (reach[g.idx(i, j)] < diameter * 0.35 || !open(i, j, 1) || g.has(i, j, F.OBSTACLE)) continue;
      if (!farFrom(i, j, [entry, exit, ...pois], 14)) continue;
      g.set(i, j, F.POI | F.OBSTACLE);
      pois.push({ id, type: 'lore', i, j, x: i + 0.5, z: j + 0.5, r: 2 });
      break;
    }
  }

  // Ore veins hug the walls, spaced out and never on the main route.
  const nodes = [];
  const want = Math.round(floor / 85);
  const occupied = [];
  for (const [i, j] of candidates) {
    if (nodes.length >= want) break;
    if (g.has(i, j, F.OBSTACLE) || !wallAdjacent(i, j) || corridor(i, j)) continue;
    if (!farFrom(i, j, [entry, exit], 6) || !farFrom(i, j, occupied, 3.5)) continue;
    const side = sideOf(i);
    const table = def.nodes.filter((n) => !n.side || n.side === side);
    const node = rng.weighted(table).node;
    g.set(i, j, F.OBSTACLE);
    occupied.push({ i, j });
    nodes.push({ id: `n${nodes.length}`, node, i, j, x: i + 0.5, z: j + 0.5, h: g.h[g.idx(i, j)], rot: rng.next() * Math.PI * 2, scale: 0.85 + rng.next() * 0.3 });
  }

  // Hazards.
  const hazards = [];
  const placeVents = (type, count, side, solid = true) => {
    let n = 0;
    for (const [i, j] of candidates) {
      if (n >= count) break;
      if (side && sideOf(i) !== side) continue;
      if (g.has(i, j, F.OBSTACLE | F.PATH) || corridor(i, j) || !farFrom(i, j, [entry, exit], 10) || !farFrom(i, j, [...occupied, ...hazards], 6)) continue;
      g.set(i, j, solid ? F.OBSTACLE | F.HAZARD : F.HAZARD);
      hazards.push({ type, i, j, x: i + 0.5, z: j + 0.5, r: 3, period: rng.range(5, 9), phase: rng.range(0, 5) });
      n++;
    }
  };
  for (const hz of def.hazards) {
    if (hz === 'stalactite') {
      let n = 0;
      for (const [i, j] of candidates) {
        if (n >= 9) break;
        if (!farFrom(i, j, [entry, exit], 10) || !farFrom(i, j, hazards.filter((h) => h.type === 'stalactite'), 16)) continue;
        hazards.push({ type: 'stalactite', i, j, x: i + 0.5, z: j + 0.5, r: 6 });
        for (let oj = -6; oj <= 6; oj++) for (let oi = -6; oi <= 6; oi++) if (oi * oi + oj * oj <= 36 && g.inside(i + oi, j + oj)) g.set(i + oi, j + oj, F.HAZARD);
        n++;
      }
    } else if (hz === 'gas_vent') placeVents('gas_vent', 7);
    else if (hz === 'heat_vent') placeVents('heat_vent', 6, 'hot');
    else if (hz === 'frost_vent') placeVents('frost_vent', 6, 'cold');
    else if (hz === 'radiance') placeVents('radiance', 6, sides[0]);
    else if (hz === 'umbral') placeVents('umbral', 6, sides[1], false);
  }

  // Obstacles must never wall anything off: drop any object that ended up unreachable.
  for (let pass = 0; pass < 4; pass++) {
    const d = g.bfs(entry.i, entry.j, { maxStep: 1 });
    const ok = (o) => N4.some(([di, dj]) => g.inside(o.i + di, o.j + dj) && d[g.idx(o.i + di, o.j + dj)] >= 0);
    const bad = [...nodes, ...pois, ...hazards.filter((h) => h.type !== 'stalactite')].filter((o) => !ok(o));
    if (!bad.length) break;
    for (const o of bad) g.clear(o.i, o.j, F.OBSTACLE);
    for (const list of [nodes, pois, hazards]) for (let n = list.length - 1; n >= 0; n--) if (bad.includes(list[n])) list.splice(n, 1);
  }
  nodes.forEach((n, k) => { n.id = `n${k}`; });

  // Decoration: glowing growths along the walls, rails in the Ironworks.
  const glow = [];
  for (const [i, j] of candidates) if (wallAdjacent(i, j) && !g.has(i, j, F.OBSTACLE) && rng.chance(0.06)) glow.push({ x: i + 0.5, z: j + 0.5, h: g.h[g.idx(i, j)], c: rng.int(0, 2) });
  const rails = def.gen.rails ? route.filter((_, n) => n > 4 && n < route.length - 4).map(([i, j]) => ({ i, j })) : [];

  const spawnCell = N4.map(([di, dj]) => [entry.i + di * 2, entry.j + dj * 2]).find(([i, j]) => g.walkable(i, j)) || [entry.i, entry.j];
  return {
    id: def.id, type: 'cave', layer: def.layer, def, seed, grid: g,
    entry, exit, route, pois, nodes, hazards, split, sides, sideOf,
    spawn: { x: spawnCell[0] + 0.5, z: spawnCell[1] + 0.5 },
    spawnYaw: Math.atan2(spawnCell[0] - entry.i, spawnCell[1] - entry.j),
    diameter, floorFrac: frac, isReachable,
    decor: { glow, rails },
  };
}

// 4-5 rule: a cell becomes rock with 5+ rock neighbours and stays rock with 4+.
function automaton(wall, N, steps, pillars) {
  for (let s = 0; s < steps; s++) {
    const next = new Uint8Array(N * N);
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      if (i < 1 || j < 1 || i >= N - 1 || j >= N - 1) { next[j * N + i] = 1; continue; }
      let n = 0;
      for (const [di, dj] of N8) n += wall[(j + dj) * N + i + di];
      next[j * N + i] = n >= 5 || (wall[j * N + i] && n >= 4) || (pillars && s < 2 && n === 0) ? 1 : 0;
    }
    wall = next;
  }
  return wall;
}

function floodRegions(wall, N) {
  const seen = new Uint8Array(N * N), regions = [];
  for (let s = 0; s < N * N; s++) {
    if (wall[s] || seen[s]) continue;
    const q = [s]; seen[s] = 1;
    for (let h = 0; h < q.length; h++) {
      const k = q[h], i = k % N, j = (k - i) / N;
      for (const [di, dj] of N4) {
        const ni = i + di, nj = j + dj;
        if (ni < 0 || nj < 0 || ni >= N || nj >= N) continue;
        const nk = nj * N + ni;
        if (!wall[nk] && !seen[nk]) { seen[nk] = 1; q.push(nk); }
      }
    }
    regions.push(q);
  }
  return regions;
}

function carveTunnel(wall, N, i0, j0, i1, j1) {
  let i = i0, j = j0;
  const dig = () => { for (let oj = -1; oj <= 1; oj++) for (let oi = -1; oi <= 1; oi++) { const a = i + oi, b = j + oj; if (a > 1 && b > 1 && a < N - 2 && b < N - 2) wall[b * N + a] = 0; } };
  while (i !== i1) { dig(); i += Math.sign(i1 - i); }
  while (j !== j1) { dig(); j += Math.sign(j1 - j); }
  dig();
}
