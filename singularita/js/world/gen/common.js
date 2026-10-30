// Shared generator helpers: Poisson-disk sampling, A* over the grid, terrain flattening.
import { N4 } from '../grid.js';
import { smoothstep } from '../../core/math.js';

// Bridson Poisson-disk sampling in a w×d rectangle with minimum distance r.
export function poissonDisk(w, d, r, rng, k = 20) {
  const cell = r / Math.SQRT2;
  const gw = Math.ceil(w / cell), gd = Math.ceil(d / cell);
  const gridPts = new Int32Array(gw * gd).fill(-1);
  const pts = [], active = [];
  const addPt = (x, z) => {
    pts.push([x, z]); active.push(pts.length - 1);
    gridPts[Math.floor(z / cell) * gw + Math.floor(x / cell)] = pts.length - 1;
  };
  addPt(rng.range(0, w), rng.range(0, d));
  while (active.length) {
    const ai = Math.floor(rng.next() * active.length);
    const [px, pz] = pts[active[ai]];
    let found = false;
    for (let t = 0; t < k; t++) {
      const a = rng.next() * Math.PI * 2, rad = r * (1 + rng.next());
      const x = px + Math.cos(a) * rad, z = pz + Math.sin(a) * rad;
      if (x < 0 || z < 0 || x >= w || z >= d) continue;
      const gx = Math.floor(x / cell), gz = Math.floor(z / cell);
      let ok = true;
      for (let oz = -2; oz <= 2 && ok; oz++) for (let ox = -2; ox <= 2 && ok; ox++) {
        const cx = gx + ox, cz = gz + oz;
        if (cx < 0 || cz < 0 || cx >= gw || cz >= gd) continue;
        const pi = gridPts[cz * gw + cx];
        if (pi >= 0) { const dx = pts[pi][0] - x, dz = pts[pi][1] - z; if (dx * dx + dz * dz < r * r) ok = false; }
      }
      if (ok) { addPt(x, z); found = true; break; }
    }
    if (!found) active.splice(ai, 1);
  }
  return pts;
}

// Binary-heap A*. cost(i0,j0,i1,j1) returns Infinity for blocked moves.
export function astar(grid, si, sj, gi, gj, cost) {
  const W = grid.w, n = W * grid.d;
  const g = new Float64Array(n).fill(Infinity), from = new Int32Array(n).fill(-1), closed = new Uint8Array(n);
  const heap = []; // [f, k]
  const push = (f, k) => { heap.push([f, k]); let c = heap.length - 1; while (c > 0) { const p = (c - 1) >> 1; if (heap[p][0] <= heap[c][0]) break; [heap[p], heap[c]] = [heap[c], heap[p]]; c = p; } };
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let c = 0; for (;;) { const l = 2 * c + 1, r = l + 1; let m = c; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === c) break; [heap[m], heap[c]] = [heap[c], heap[m]]; c = m; } } return top; };
  const s = grid.idx(si, sj), goal = grid.idx(gi, gj);
  g[s] = 0; push(0, s);
  while (heap.length) {
    const [, k] = pop();
    if (closed[k]) continue;
    closed[k] = 1;
    if (k === goal) break;
    const i = k % W, j = (k - i) / W;
    for (const [di, dj] of N4) {
      const ni = i + di, nj = j + dj;
      if (!grid.inside(ni, nj)) continue;
      const nk = grid.idx(ni, nj);
      if (closed[nk]) continue;
      const c = cost(i, j, ni, nj);
      if (!Number.isFinite(c)) continue;
      const ng = g[k] + c;
      if (ng < g[nk]) { g[nk] = ng; from[nk] = k; push(ng + Math.abs(ni - gi) + Math.abs(nj - gj), nk); }
    }
  }
  if (from[goal] === -1 && goal !== s) return null;
  const path = [];
  for (let k = goal; k !== -1; k = from[k]) path.push([k % W, Math.floor(k / W)]);
  return path.reverse();
}

// Flatten a disk to `height`, blending back into the terrain over `blend` cells.
export function flattenDisk(grid, cx, cz, r, blend, height, protect) {
  const R = r + blend;
  for (let j = Math.floor(cz - R); j <= Math.ceil(cz + R); j++) for (let i = Math.floor(cx - R); i <= Math.ceil(cx + R); i++) {
    if (!grid.inside(i, j)) continue;
    const k = grid.idx(i, j);
    if (protect && protect[k]) continue;
    const d = Math.hypot(i + 0.5 - cx, j + 0.5 - cz);
    if (d > R) continue;
    const t = d <= r ? 0 : smoothstep(r, R, d);
    grid.h[k] = Math.round(height + (grid.h[k] - height) * t);
  }
}

export function avgHeight(grid, cx, cz, r) {
  let s = 0, n = 0;
  for (let j = Math.floor(cz - r); j <= Math.ceil(cz + r); j++) for (let i = Math.floor(cx - r); i <= Math.ceil(cx + r); i++) {
    if (!grid.inside(i, j) || Math.hypot(i + 0.5 - cx, j + 0.5 - cz) > r) continue;
    s += grid.h[grid.idx(i, j)]; n++;
  }
  return n ? Math.round(s / n) : 0;
}

export const cellCenter = (i, j) => ({ x: i + 0.5, z: j + 0.5 });
