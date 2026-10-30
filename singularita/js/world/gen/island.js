// Dawnreach: a seeded island with a central base, a cave hill, two boss arenas,
// ruins with Echo Stones, forests and boulders, linked by walkable paths.
import { ZoneGrid, F, SURF, N4, N8 } from '../grid.js';
import { makeRng, hashSeed } from '../../core/rng.js';
import { makeNoise2D, fbm2D } from '../../core/noise.js';
import { smoothstep } from '../../core/math.js';
import { poissonDisk, astar, flattenDisk, avgHeight } from './common.js';

export const SEA = 3;

export function generateIsland(def, seed) {
  const N = def.gen.size, R = def.gen.radius, c = N / 2;
  const rng = makeRng(seed);
  const nH = makeNoise2D(hashSeed(seed, 1)), nW = makeNoise2D(hashSeed(seed, 2)), nF = makeNoise2D(hashSeed(seed, 3));
  const g = new ZoneGrid(N, N);
  g.seaLevel = SEA;

  // Feature anchors: the cave hill to the north-east, the glade to the west, the crater to the south-east.
  const polar = (ang, rad) => ({ x: c + Math.cos(ang) * rad, z: c + Math.sin(ang) * rad });
  const hillAng = -Math.PI / 4 + rng.range(-0.25, 0.25);
  const hillTop = polar(hillAng, R * 0.6);
  // The cave mouth opens on the hill's flank, facing the base.
  const cave = polar(hillAng, R * 0.6 - 13);
  const glade = polar(Math.PI * 0.85 + rng.range(-0.2, 0.2), R * 0.5);
  const crater = polar(Math.PI * 0.3 + rng.range(-0.2, 0.2), R * 0.55);

  // Height field.
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const dx = (i - c) / R, dz = (j - c) / R;
    const d = Math.sqrt(dx * dx + dz * dz) + nW(i / 60, j / 60) * 0.17;
    const e = fbm2D(nH, i / 58, j / 58, 5) * 0.5 + 0.5;
    const land = 1 - smoothstep(0.6, 1.02, d);
    const hd = Math.hypot(i - hillTop.x, j - hillTop.z) / 26;
    const hill = Math.exp(-hd * hd) * 0.5;
    const v = (0.18 + e * 0.5 + hill) * land - (1 - land) * 0.4;
    g.h[g.idx(i, j)] = Math.max(SEA - 6, Math.min(SEA + 26, Math.round(SEA + (v - 0.1) * 24)));
  }

  // Flatten the base plateau, the arenas and the cave pad.
  const protect = new Uint8Array(N * N);
  const markProtect = (cx, cz, r) => {
    for (let j = Math.floor(cz - r); j <= Math.ceil(cz + r); j++) for (let i = Math.floor(cx - r); i <= Math.ceil(cx + r); i++)
      if (g.inside(i, j) && Math.hypot(i + 0.5 - cx, j + 0.5 - cz) <= r) protect[g.idx(i, j)] = 1;
  };
  const baseH = Math.max(SEA + 4, avgHeight(g, c, c, 8));
  flattenDisk(g, c, c, 16, 10, baseH); markProtect(c, c, 16);
  const gladeH = Math.max(SEA + 3, avgHeight(g, glade.x, glade.z, 10));
  flattenDisk(g, glade.x, glade.z, 15, 8, gladeH, protect); markProtect(glade.x, glade.z, 15);
  const craterH = Math.max(SEA + 3, avgHeight(g, crater.x, crater.z, 10) - 2);
  flattenDisk(g, crater.x, crater.z, 15, 8, craterH, protect); markProtect(crater.x, crater.z, 15);
  const caveH = Math.max(SEA + 4, avgHeight(g, cave.x, cave.z, 4));
  flattenDisk(g, cave.x, cave.z, 5, 5, caveH, protect); markProtect(cave.x, cave.z, 5);

  // Echo Stone ruins: spread out, away from everything else and from the shore.
  const pois = [];
  const keepOut = [{ x: c, z: c, r: 34 }, { x: cave.x, z: cave.z, r: 22 }, { x: glade.x, z: glade.z, r: 26 }, { x: crater.x, z: crater.z, r: 26 }];
  for (let tries = 0; pois.length < def.lore.length && tries < 4000; tries++) {
    const a = rng.next() * Math.PI * 2, rad = rng.range(0.2, 0.78) * R;
    const x = c + Math.cos(a) * rad, z = c + Math.sin(a) * rad;
    const i = Math.floor(x), j = Math.floor(z);
    if (g.h[g.idx(i, j)] < SEA + 3) continue;
    if (keepOut.some((k) => Math.hypot(k.x - x, k.z - z) < k.r)) continue;
    if (pois.some((p) => Math.hypot(p.x - x, p.z - z) < 30)) continue;
    let nearWater = false;
    for (let oz = -6; oz <= 6 && !nearWater; oz += 3) for (let ox = -6; ox <= 6; ox += 3) if (g.height(i + ox, j + oz) <= SEA) { nearWater = true; break; }
    if (nearWater) continue;
    const h = avgHeight(g, x, z, 3);
    flattenDisk(g, x, z, 4, 3, h, protect); markProtect(x, z, 4);
    pois.push({ id: def.lore[pois.length], type: 'lore', x: i + 0.5, z: j + 0.5, i, j, r: 4 });
  }

  // Water.
  for (let k = 0; k < N * N; k++) {
    if (g.h[k] <= SEA) g.flags[k] |= F.WATER;
    if (g.h[k] <= SEA - 2) g.flags[k] |= F.DEEP;
  }
  for (let i = 0; i < N; i++) for (const k of [g.idx(i, 0), g.idx(i, N - 1), g.idx(0, i), g.idx(N - 1, i)]) g.flags[k] |= F.WATER | F.DEEP;

  // Paths from the base to every point of interest. Steep steps are allowed in the search
  // but then smoothed into ramps, so every path is walkable without jumping.
  const targets = [{ x: cave.x, z: cave.z }, glade, crater, ...pois];
  const paths = [];
  const cost = (i0, j0, i1, j1) => {
    const k = g.idx(i1, j1);
    if (g.flags[k] & F.DEEP) return Infinity;
    const dh = Math.abs(g.h[k] - g.h[g.idx(i0, j0)]);
    return 1 + (g.flags[k] & F.WATER ? 8 : 0) + (dh > 1 ? 12 * dh : dh * 2);
  };
  for (const t of targets) {
    const p = astar(g, Math.floor(c), Math.floor(c + 14), Math.floor(t.x), Math.floor(t.z), cost);
    if (!p) continue;
    smoothRamp(g, p, protect);
    for (const [i, j] of p) {
      const k = g.idx(i, j);
      if (g.h[k] <= SEA) { g.h[k] = SEA + 1; g.flags[k] &= ~(F.WATER | F.DEEP); }
      g.flags[k] |= F.PATH;
    }
    paths.push(p);
  }

  // Base layout.
  const base = {
    x: c, z: c, r: 20, h: baseH,
    stations: {
      beacon: { x: c, z: c - 1 },
      forge: { x: c - 6, z: c - 4 },
      altar: { x: c + 6, z: c - 4 },
      bed: { x: c - 6, z: c + 4 },
      lume: { x: c + 4, z: c + 3 },
    },
  };
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const d = Math.hypot(i + 0.5 - c, j + 0.5 - c);
    if (d < base.r) g.flags[g.idx(i, j)] |= F.BASE | F.NOSPAWN;
  }
  for (const s of Object.values(base.stations)) g.set(Math.floor(s.x), Math.floor(s.z), F.OBSTACLE);

  // Arenas: flat rings; the crater gets pillars the Emperor can be baited into.
  const arenas = {
    glade: { id: 'glade', name: 'Sunlit Glade', x: glade.x, z: glade.z, r: 14, h: gladeH, boss: 'slime_prince', pillars: [] },
    crater: { id: 'crater', name: 'Bone Ridge Crater', x: crater.x, z: crater.z, r: 14, h: craterH, boss: 'silverback_emperor', pillars: [] },
  };
  for (const a of Object.values(arenas)) {
    for (let j = Math.floor(a.z - a.r); j <= a.z + a.r; j++) for (let i = Math.floor(a.x - a.r); i <= a.x + a.r; i++)
      if (Math.hypot(i + 0.5 - a.x, j + 0.5 - a.z) <= a.r) g.set(i, j, F.ARENA | F.NOSPAWN);
  }
  for (let p = 0; p < 5; p++) {
    const ang = (p / 5) * Math.PI * 2 + 0.3;
    const px = Math.floor(crater.x + Math.cos(ang) * 8.5), pz = Math.floor(crater.z + Math.sin(ang) * 8.5);
    arenas.crater.pillars.push({ x: px + 1, z: pz + 1, i: px, j: pz });
    for (let oj = 0; oj < 2; oj++) for (let oi = 0; oi < 2; oi++) { g.set(px + oi, pz + oj, F.OBSTACLE); g.h[g.idx(px + oi, pz + oj)] = craterH; }
  }

  const caveMouth = { x: Math.floor(cave.x) + 0.5, z: Math.floor(cave.z) + 0.5, i: Math.floor(cave.x), j: Math.floor(cave.z), r: 5, h: caveH };
  g.set(caveMouth.i, caveMouth.j, F.POI | F.NOSPAWN);
  for (const p of pois) { g.set(p.i, p.j, F.POI | F.OBSTACLE); }
  for (let j = Math.floor(cave.z - 6); j <= cave.z + 6; j++) for (let i = Math.floor(cave.x - 6); i <= cave.x + 6; i++) g.set(i, j, F.NOSPAWN);

  // Surfaces.
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const k = g.idx(i, j), h = g.h[k], f = g.flags[k];
    let slope = 0;
    for (const [di, dj] of N4) slope = Math.max(slope, Math.abs(h - g.height(i + di, j + dj)));
    let s;
    if (f & F.WATER) s = SURF.SEABED;
    else if (f & F.PATH) s = SURF.PATH;
    else if (Math.hypot(i + 0.5 - c, j + 0.5 - c) < 13) s = SURF.BASE;
    else if (f & F.ARENA) s = Math.hypot(i - crater.x, j - crater.z) < 16 ? SURF.DIRT : SURF.ARENA;
    else if (h <= SEA + 1) s = SURF.SAND;
    else if (h >= SEA + 19) s = SURF.SNOW;
    else if (h >= SEA + 14 || slope >= 3) s = SURF.ROCK;
    else if (nF(i / 40, j / 40) > 0.1) s = SURF.FOREST;
    else s = SURF.GRASS;
    g.surf[k] = s;
  }

  // Trees and boulders by Poisson-disk sampling.
  const nodes = [];
  const near = (x, z, list, pad) => list.some((o) => Math.hypot(o.x - x, o.z - z) < o.r + pad);
  const features = [{ x: c, z: c, r: base.r + 3 }, { ...arenas.glade, r: 17 }, { ...arenas.crater, r: 17 }, { x: caveMouth.x, z: caveMouth.z, r: 7 }, ...pois.map((p) => ({ ...p, r: 6 }))];
  for (const [x, z] of poissonDisk(N, N, 3.1, makeRng(hashSeed(seed, 9)))) {
    const i = Math.floor(x), j = Math.floor(z);
    if (i < 1 || j < 1 || i >= N - 1 || j >= N - 1) continue;
    const k = g.idx(i, j), f = g.flags[k], s = g.surf[k], h = g.h[k];
    if (f & (F.WATER | F.PATH | F.OBSTACLE | F.BASE | F.ARENA)) continue;
    let pathNear = false;
    for (const [di, dj] of N8) if (g.has(i + di, j + dj, F.PATH | F.OBSTACLE)) pathNear = true;
    if (pathNear || near(x, z, features, 0)) continue;
    const r = rng.next();
    let node = null;
    if (s === SURF.ROCK || s === SURF.SNOW) node = r < 0.65 ? 'boulder' : r < 0.85 ? 'tree_pine' : null;
    else if (s === SURF.FOREST) node = r < 0.82 ? (h > SEA + 10 ? 'tree_pine' : rng.chance(0.72) ? 'tree_oak' : 'tree_birch') : r < 0.88 ? 'boulder' : null;
    else if (s === SURF.GRASS) node = r < 0.05 ? 'boulder' : r < 0.11 ? 'tree_oak' : r < 0.15 ? 'tree_birch' : null;
    if (!node) continue;
    g.flags[k] |= F.OBSTACLE;
    nodes.push({ id: `n${nodes.length}`, node, i, j, x: i + 0.5, z: j + 0.5, h, rot: rng.next() * Math.PI * 2, scale: 0.85 + rng.next() * 0.35 });
  }

  // A ring of boulders near the base so the first pickaxe has something to do.
  for (let a = 0; a < 10; a++) {
    const ang = rng.next() * Math.PI * 2, rad = rng.range(base.r + 6, base.r + 18);
    const i = Math.floor(c + Math.cos(ang) * rad), j = Math.floor(c + Math.sin(ang) * rad);
    const k = g.idx(i, j);
    if (g.flags[k] & (F.WATER | F.PATH | F.OBSTACLE | F.BASE | F.ARENA)) continue;
    let pathNear = false;
    for (const [di, dj] of N8) if (g.has(i + di, j + dj, F.PATH | F.OBSTACLE)) pathNear = true;
    if (pathNear) continue;
    g.flags[k] |= F.OBSTACLE;
    nodes.push({ id: `n${nodes.length}`, node: 'boulder', i, j, x: i + 0.5, z: j + 0.5, h: g.h[k], rot: rng.next() * 6.28, scale: 0.9 + rng.next() * 0.3 });
  }

  // Decorations (not interactive): flowers in the glade and meadows.
  const flowers = [];
  const dr = makeRng(hashSeed(seed, 11));
  for (let t = 0; t < 900; t++) {
    const i = dr.int(1, N - 2), j = dr.int(1, N - 2), k = g.idx(i, j);
    if (g.flags[k] & (F.WATER | F.OBSTACLE | F.PATH)) continue;
    const s = g.surf[k];
    if (s !== SURF.GRASS && s !== SURF.ARENA && s !== SURF.FOREST) continue;
    flowers.push({ x: i + dr.range(0.2, 0.8), z: j + dr.range(0.2, 0.8), h: g.h[k], c: dr.int(0, 3) });
  }

  return {
    id: def.id, type: 'island', def, seed, grid: g,
    base, arenas, caveMouth, pois, nodes, paths,
    spawn: { x: c + 0.5, z: c + 8.5 },
    decor: { flowers },
  };
}

// Make consecutive path cells differ by at most one block, preferring to cut into terrain
// that is not protected (plateaus, arenas and pads keep their heights).
function smoothRamp(g, path, protect) {
  for (let pass = 0; pass < 12; pass++) {
    let changed = false;
    for (let dir = 0; dir < 2; dir++) {
      const seq = dir ? [...path].reverse() : path;
      for (let n = 1; n < seq.length; n++) {
        const a = g.idx(...seq[n - 1]), b = g.idx(...seq[n]);
        const diff = g.h[b] - g.h[a];
        if (diff > 1) { if (!protect[b]) g.h[b] = g.h[a] + 1; else if (!protect[a]) g.h[a] = g.h[b] - 1; changed = true; }
      }
    }
    if (!changed) break;
  }
}
