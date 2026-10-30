// Design-rule validation for generated zones. Run by the tests, and cheap enough for debug builds.
import { F, N4 } from '../grid.js';

const reachableNeighbour = (g, dist, i, j) => N4.some(([di, dj]) => g.inside(i + di, j + dj) && dist[g.idx(i + di, j + dj)] >= 0);

export function validateIsland(z) {
  const errors = [];
  const g = z.grid;
  const [si, sj] = g.cellAt(z.spawn.x, z.spawn.z);
  const dist = g.bfs(si, sj, { maxStep: 1 });
  const reach = (p, what) => {
    const [i, j] = g.cellAt(p.x, p.z);
    if (dist[g.idx(i, j)] < 0 && !reachableNeighbour(g, dist, i, j)) errors.push(`${what} unreachable from the base`);
  };
  reach(z.caveMouth, 'cave mouth');
  for (const a of Object.values(z.arenas)) reach(a, `arena ${a.id}`);
  for (const p of z.pois) reach(p, `poi ${p.id}`);
  for (const s of Object.entries(z.base.stations)) {
    const [i, j] = g.cellAt(s[1].x, s[1].z);
    if (!reachableNeighbour(g, dist, i, j)) errors.push(`station ${s[0]} unreachable`);
  }
  // Footprints must not overlap.
  const fp = [{ id: 'base', x: z.base.x, z: z.base.z, r: z.base.r }, ...Object.values(z.arenas).map((a) => ({ id: a.id, x: a.x, z: a.z, r: a.r })),
    { id: 'cave', x: z.caveMouth.x, z: z.caveMouth.z, r: z.caveMouth.r }, ...z.pois.map((p) => ({ id: p.id, x: p.x, z: p.z, r: p.r }))];
  for (let a = 0; a < fp.length; a++) for (let b = a + 1; b < fp.length; b++) {
    if (Math.hypot(fp[a].x - fp[b].x, fp[a].z - fp[b].z) < fp[a].r + fp[b].r) errors.push(`${fp[a].id} overlaps ${fp[b].id}`);
  }
  // Arenas are flat and clear (pillars excepted).
  for (const a of Object.values(z.arenas)) {
    const pillar = new Set(a.pillars.flatMap((p) => [[p.i, p.j], [p.i + 1, p.j], [p.i, p.j + 1], [p.i + 1, p.j + 1]].map(([i, j]) => g.idx(i, j))));
    for (let j = Math.floor(a.z - a.r + 1); j <= a.z + a.r - 1; j++) for (let i = Math.floor(a.x - a.r + 1); i <= a.x + a.r - 1; i++) {
      if (Math.hypot(i + 0.5 - a.x, j + 0.5 - a.z) > a.r - 1) continue;
      const k = g.idx(i, j);
      if (g.h[k] !== a.h) { errors.push(`arena ${a.id} not flat at ${i},${j}`); return { ok: false, errors }; }
      if ((g.flags[k] & F.OBSTACLE) && !pillar.has(k)) errors.push(`arena ${a.id} blocked at ${i},${j}`);
    }
  }
  // Nodes stay off paths and out of features.
  for (const n of z.nodes) {
    const k = g.idx(n.i, n.j);
    if (g.flags[k] & (F.PATH | F.BASE | F.ARENA | F.WATER)) errors.push(`node ${n.id} on a reserved cell`);
  }
  const ids = new Set(z.nodes.map((n) => `${n.i},${n.j}`));
  if (ids.size !== z.nodes.length) errors.push('two nodes share a cell');
  return { ok: errors.length === 0, errors };
}

export function validateCave(z) {
  const errors = [];
  const g = z.grid;
  const dist = g.bfs(z.entry.i, z.entry.j, { maxStep: 1 });
  if (!g.walkable(z.entry.i, z.entry.j)) errors.push('entry blocked');
  if (!g.walkable(z.exit.i, z.exit.j)) errors.push('exit blocked');
  const dx = dist[g.idx(z.exit.i, z.exit.j)];
  if (dx < 0) errors.push('exit unreachable');
  let diameter = 0;
  for (const d of dist) diameter = Math.max(diameter, d);
  if (dx < diameter * 0.6) errors.push(`exit too close to entry (${dx} of ${diameter})`);
  for (const n of z.nodes) {
    if (g.has(n.i, n.j, F.PATH)) errors.push(`node ${n.id} on the main route`);
    if (!reachableNeighbour(g, dist, n.i, n.j)) errors.push(`node ${n.id} unreachable`);
  }
  for (const p of z.pois) if (!reachableNeighbour(g, dist, p.i, p.j)) errors.push(`poi ${p.id} unreachable`);
  for (const h of z.hazards) if (h.type !== 'stalactite' && g.has(h.i, h.j, F.PATH)) errors.push(`vent on the main route`);
  if (z.floorFrac < 0.3 || z.floorFrac > 0.7) errors.push(`floor fraction ${z.floorFrac}`);
  const cells = new Set([...z.nodes, ...z.pois].map((n) => `${n.i},${n.j}`));
  if (cells.size !== z.nodes.length + z.pois.length) errors.push('objects share a cell');
  return { ok: errors.length === 0, errors };
}
