// Flow field toward the player over a window of the grid, rebuilt a few times per second.
// Creatures inside the window follow it around walls; outside they steer directly.
import { F } from '../world/grid.js';

const W = 80, HALF = W / 2;
// Distances flow through the camp, but creatures are kept out of it by their movement mask.
const BLOCK = F.WALL | F.DEEP | F.OBSTACLE | F.VOID;

export class FlowField {
  constructor() {
    this.dist = new Int16Array(W * W);
    this.queue = new Int32Array(W * W);
    this.ox = 0; this.oz = 0; this.t = 0; this.valid = false;
  }
  update(dt, grid, px, pz) {
    this.t -= dt;
    if (this.t > 0 && this.valid) return;
    this.t = 0.4;
    const pi = Math.floor(px), pj = Math.floor(pz);
    this.ox = pi - HALF; this.oz = pj - HALF;
    this.dist.fill(-1);
    let head = 0, tail = 0;
    const s = HALF * W + HALF;
    this.dist[s] = 0; this.queue[tail++] = s;
    while (head < tail) {
      const k = this.queue[head++];
      const li = k % W, lj = (k - li) / W;
      const gi = li + this.ox, gj = lj + this.oz;
      const h0 = grid.height(gi, gj), d = this.dist[k] + 1;
      for (let n = 0; n < 4; n++) {
        const ni = li + (n === 0 ? 1 : n === 1 ? -1 : 0), nj = lj + (n === 2 ? 1 : n === 3 ? -1 : 0);
        if (ni < 0 || nj < 0 || ni >= W || nj >= W) continue;
        const nk = nj * W + ni;
        if (this.dist[nk] !== -1) continue;
        const ggi = ni + this.ox, ggj = nj + this.oz;
        if (!grid.inside(ggi, ggj)) continue;
        if (grid.flags[grid.idx(ggi, ggj)] & BLOCK) continue;
        if (Math.abs(grid.height(ggi, ggj) - h0) > 1) continue;
        this.dist[nk] = d; this.queue[tail++] = nk;
      }
    }
    this.valid = true;
  }
  distAt(x, z) {
    const li = Math.floor(x) - this.ox, lj = Math.floor(z) - this.oz;
    if (li < 0 || lj < 0 || li >= W || lj >= W) return -2;
    return this.dist[lj * W + li];
  }
  // Unit direction toward the player, or null if outside the window or unreachable.
  dirAt(x, z, out) {
    const li = Math.floor(x) - this.ox, lj = Math.floor(z) - this.oz;
    if (li < 1 || lj < 1 || li >= W - 1 || lj >= W - 1) return null;
    const d0 = this.dist[lj * W + li];
    if (d0 < 0) return null;
    let bx = 0, bz = 0, best = d0;
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      if (!di && !dj) continue;
      const d = this.dist[(lj + dj) * W + li + di];
      if (d < 0 || d >= best) continue;
      if (di && dj && (this.dist[lj * W + li + di] < 0 || this.dist[(lj + dj) * W + li] < 0)) continue; // no corner cutting
      best = d; bx = di; bz = dj;
    }
    if (!bx && !bz) return null;
    // Aim at the centre of the next cell for smooth corners.
    const tx = Math.floor(x) + bx + 0.5 - x, tz = Math.floor(z) + bz + 0.5 - z, l = Math.hypot(tx, tz) || 1;
    out.x = tx / l; out.z = tz / l;
    return out;
  }
}
