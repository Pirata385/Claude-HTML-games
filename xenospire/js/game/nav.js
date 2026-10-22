// Navigation for the AI: a breadth-first distance field over walkable columns
// toward a goal cell. A fighter can climb one voxel and drop any height, so a
// step from column b to column a is allowed when top(a) <= top(b) + 1.
// Fields are cheap (one pass over the grid) and rebuilt every ~0.6 s or when
// the goal moves to another cell; fighters follow them when the straight line
// to their target is blocked. With `clear`, cells next to a wall are left out
// so big creatures don't get routed through gaps they can't fit in.
(function (XS) {
  'use strict';

  const N8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];

  // Cells with no wall (a column more than a step higher) around them, shared
  // by every field on the same world and refreshed at most once a second
  // while the terrain keeps changing.
  const roomyCache = new WeakMap();
  function roomyFor(w) {
    let c = roomyCache.get(w);
    if (c && (c.version === w.version || w.clock - c.clock < 1)) return c.grid;
    const W = w.W, D = w.D, top = w.colTop;
    const grid = c ? c.grid : new Uint8Array(W * D);
    for (let y = 0; y < D; y++) for (let x = 0; x < W; x++) {
      const i = x + y * W, t = top[i];
      let ok = t ? 1 : 0;
      for (let oy = -1; oy <= 1 && ok; oy++) for (let ox = -1; ox <= 1; ox++) {
        const nx = x + ox, ny = y + oy;
        if (nx >= 0 && ny >= 0 && nx < W && ny < D && top[nx + ny * W] > t + 1) { ok = 0; break; }
      }
      grid[i] = ok;
    }
    roomyCache.set(w, { grid, version: w.version, clock: w.clock });
    return grid;
  }

  class NavField {
    constructor(world, opts = {}) {
      this.w = world;
      this.clear = !!opts.clear;
      const n = world.W * world.D;
      this.dist = new Int16Array(n);
      this.queue = new Int32Array(n);
      this.gx = -1; this.gy = -1;
      this.age = Infinity;
    }

    // Rebuild if stale or the goal changed cell. Returns true when rebuilt.
    update(gx, gy, dt, maxAge = 0.6) {
      gx = Math.floor(gx); gy = Math.floor(gy);
      this.age += dt;
      if (this.age < maxAge && gx === this.gx && gy === this.gy) return false;
      this.build(gx, gy);
      return true;
    }

    build(gx, gy) {
      const w = this.w, W = w.W, D = w.D, top = w.colTop, dist = this.dist, q = this.queue;
      dist.fill(-1);
      this.gx = gx; this.gy = gy; this.age = 0;
      if (gx < 0 || gy < 0 || gx >= W || gy >= D || !top[gx + gy * W]) return;
      const roomy = this.clear ? roomyFor(w) : null;
      let head = 0, tail = 0;
      dist[gx + gy * W] = 0;
      q[tail++] = gx + gy * W;
      while (head < tail) {
        const i = q[head++];
        const x = i % W, y = (i / W) | 0, ta = top[i], d = dist[i] + 1;
        for (let k = 0; k < 8; k++) {
          const nx = x + N8[k][0], ny = y + N8[k][1];
          if (nx < 0 || ny < 0 || nx >= W || ny >= D) continue;
          const j = nx + ny * W;
          if (dist[j] >= 0 || !top[j] || ta > top[j] + 1 || (this.clear && !roomy[j])) continue;
          // No corner cutting: from j, both side cells must be passable too.
          if (k >= 4) {
            const s1 = top[x + ny * W], s2 = top[nx + y * W];
            if (!s1 || !s2 || s1 > top[j] + 1 || s2 > top[j] + 1) continue;
          }
          dist[j] = d;
          q[tail++] = j;
        }
      }
    }

    distAt(x, y) {
      x = Math.floor(x); y = Math.floor(y);
      if (x < 0 || y < 0 || x >= this.w.W || y >= this.w.D) return -1;
      return this.dist[x + y * this.w.W];
    }

    // Unit direction downhill in the field from (x, y), or null.
    dirFrom(x, y) {
      const cx = Math.floor(x), cy = Math.floor(y);
      let here = this.distAt(cx, cy);
      if (here === 0) return null;
      if (here < 0) here = Infinity; // squeezed against a wall: step to the nearest open cell
      const w = this.w, th = w.colTop[cx + cy * w.W];
      // Only cells we can actually step onto (climb at most one voxel).
      const ok = (x, y) => x >= 0 && y >= 0 && x < w.W && y < w.D && w.colTop[x + y * w.W] && w.colTop[x + y * w.W] <= th + 1;
      let best = here, bx = 0, by = 0;
      for (const [ox, oy] of N8) {
        const d = this.distAt(cx + ox, cy + oy);
        if (d < 0 || d >= best || !ok(cx + ox, cy + oy)) continue;
        if (ox && oy && (!ok(cx + ox, cy) || !ok(cx, cy + oy))) continue;
        best = d; bx = ox; by = oy;
      }
      if (!bx && !by) return null;
      // Aim at the centre of the next cell so fighters don't scrape corners.
      const tx = cx + bx + 0.5 - x, ty = cy + by + 0.5 - y, l = Math.hypot(tx, ty) || 1;
      return { x: tx / l, y: ty / l };
    }
  }

  XS.NavField = NavField;
})(globalThis.XS = globalThis.XS || {});
