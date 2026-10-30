// Circle-versus-grid movement shared by the player and creatures.
import { F } from './grid.js';

const BLOCK = F.WALL | F.DEEP | F.OBSTACLE;

export function blockedAt(grid, x, z, r, feetY, maxStep, flying = false, extraMask = 0) {
  const i0 = Math.floor(x - r), i1 = Math.floor(x + r), j0 = Math.floor(z - r), j1 = Math.floor(z + r);
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
    if (!grid.inside(i, j)) return true;
    const k = grid.idx(i, j);
    if (grid.flags[k] & (BLOCK | extraMask)) return true;
    if (!flying && grid.h[k] > feetY + maxStep) return true;
  }
  return false;
}

// Moves an entity { x, z, y } by (dx, dz), sliding along obstacles. Returns true if anything blocked.
export function moveCircle(grid, e, dx, dz, r, maxStep, flying = false, extraMask = 0) {
  let hit = false;
  // Sub-steps keep fast movers (dashes) from tunnelling through thin walls.
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dz)) / 0.3));
  const sx = dx / steps, sz = dz / steps;
  for (let s = 0; s < steps; s++) {
    if (sx && !blockedAt(grid, e.x + sx, e.z, r, e.y, maxStep, flying, extraMask)) e.x += sx; else if (sx) hit = true;
    if (sz && !blockedAt(grid, e.x, e.z + sz, r, e.y, maxStep, flying, extraMask)) e.z += sz; else if (sz) hit = true;
  }
  return hit;
}

export function groundAt(grid, x, z) {
  const i = Math.floor(x), j = Math.floor(z);
  return grid.inside(i, j) ? grid.h[grid.idx(i, j)] : -50;
}

// Line of sight over the grid (walls and tall terrain block it).
export function lineOfSight(grid, ax, ay, az, bx, by, bz) {
  const d = Math.hypot(bx - ax, bz - az);
  const n = Math.ceil(d / 0.5);
  for (let s = 1; s < n; s++) {
    const t = s / n;
    const x = ax + (bx - ax) * t, z = az + (bz - az) * t, y = ay + (by - ay) * t;
    const i = Math.floor(x), j = Math.floor(z);
    if (!grid.inside(i, j)) return false;
    if (grid.top(i, j) > y) return false;
  }
  return true;
}

// Safety net: if an entity ends up inside a blocked cell (after a teleport or a pull),
// move it to the nearest free cell. Returns true if it moved.
export function unstick(grid, e, extraMask = 0) {
  const i0 = Math.floor(e.x), j0 = Math.floor(e.z);
  const bad = (i, j) => !grid.inside(i, j) || (grid.flags[grid.idx(i, j)] & (BLOCK | extraMask)) !== 0;
  if (!bad(i0, j0)) return false;
  for (let r = 1; r <= 5; r++) {
    let best = null, bd = Infinity;
    for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) {
      if (Math.max(Math.abs(di), Math.abs(dj)) !== r || bad(i0 + di, j0 + dj)) continue;
      const d = (i0 + di + 0.5 - e.x) ** 2 + (j0 + dj + 0.5 - e.z) ** 2;
      if (d < bd) { bd = d; best = [i0 + di, j0 + dj]; }
    }
    if (best) { e.x = best[0] + 0.5; e.z = best[1] + 0.5; return true; }
  }
  return false;
}
