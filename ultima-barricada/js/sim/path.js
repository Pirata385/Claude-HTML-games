// Pathfinding: A* for individual moves (with a per-tick expansion budget) and a Dijkstra
// flow field toward the HQ that hordes follow, treating player structures as costly tiles
// to break through instead of walls to walk around forever.
(function (UB) {
  'use strict';
  const SQ2 = Math.SQRT2;
  const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];

  // Scratch buffers shared by all searches (the simulation is single-threaded).
  let scratch = null;
  function buffers(n) {
    if (!scratch || scratch.n !== n) {
      scratch = { n, g: new Float32Array(n), from: new Int32Array(n), stamp: new Uint32Array(n), closed: new Uint32Array(n), gen: 1, heap: new UB.U.Heap(4096) };
    }
    if (++scratch.gen > 0xfffffff0) { scratch.stamp.fill(0); scratch.closed.fill(0); scratch.gen = 1; }
    return scratch;
  }

  function octile(dx, dy) {
    dx = Math.abs(dx); dy = Math.abs(dy);
    return dx > dy ? dx + (SQ2 - 1) * dy : dy + (SQ2 - 1) * dx;
  }

  // A* from (sx, sy) to a goal. opts: zombie (use zombie blocking), limit (max expansions),
  // rect {x0,y0,x1,y1} (goal = any free tile touching the rectangle), range (goal = within
  // range of gx, gy), partial (return the path to the closest node when the goal is not found).
  // Returns an array of tile indices excluding the start, or null. Sets lastExpanded.
  function find(S, sx, sy, gx, gy, opts) {
    opts = opts || {};
    const N = S.map.w, n = N * N;
    const block = opts.zombie ? S._blockZ : S._blockU;
    const limit = opts.limit || 6000;
    const B = buffers(n);
    const gen = B.gen, g = B.g, from = B.from, stamp = B.stamp, closed = B.closed, heap = B.heap;
    heap.clear();
    sx = Math.floor(sx); sy = Math.floor(sy); gx = Math.floor(gx); gy = Math.floor(gy);
    const rect = opts.rect;
    const range2 = opts.range ? opts.range * opts.range : 0;
    const isGoal = (x, y) => {
      if (rect) return x >= rect.x0 - 1 && x <= rect.x1 + 1 && y >= rect.y0 - 1 && y <= rect.y1 + 1 && !(x >= rect.x0 && x <= rect.x1 && y >= rect.y0 && y <= rect.y1);
      if (range2) return (x - gx) * (x - gx) + (y - gy) * (y - gy) <= range2;
      return x === gx && y === gy;
    };
    const h = (x, y) => {
      if (rect) {
        const dx = x < rect.x0 ? rect.x0 - x : x > rect.x1 ? x - rect.x1 : 0;
        const dy = y < rect.y0 ? rect.y0 - y : y > rect.y1 ? y - rect.y1 : 0;
        return octile(dx, dy);
      }
      return octile(gx - x, gy - y);
    };
    const s = sy * N + sx;
    stamp[s] = gen; g[s] = 0; from[s] = -1;
    heap.push(s, h(sx, sy));
    let best = s, bestH = h(sx, sy), expanded = 0, found = -1;
    while (heap.size && expanded < limit) {
      const i = heap.pop();
      if (closed[i] === gen) continue;
      closed[i] = gen;
      expanded++;
      const x = i % N, y = (i / N) | 0;
      if (isGoal(x, y)) { found = i; break; }
      const hi = h(x, y);
      if (hi < bestH) { bestH = hi; best = i; }
      for (let d = 0; d < 8; d++) {
        const dx = DIRS[d][0], dy = DIRS[d][1];
        const xx = x + dx, yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= N || yy >= N) continue;
        const j = yy * N + xx;
        if (block[j] && !(rect || range2 ? false : (xx === gx && yy === gy && opts.allowBlockedGoal))) continue;
        if (dx && dy && (block[y * N + xx] || block[yy * N + x])) continue;
        const c = UB.World.costU(S, j);
        const step = (dx && dy ? SQ2 : 1) * (c === Infinity ? 1 : c);
        const ng = g[i] + step;
        if (stamp[j] !== gen || ng < g[j]) {
          stamp[j] = gen; g[j] = ng; from[j] = i;
          heap.push(j, ng + h(xx, yy) * 1.001);
        }
      }
    }
    find.lastExpanded = expanded;
    let end = found;
    if (end < 0) {
      if (!opts.partial || best === s) return null;
      end = best;
    }
    const path = [];
    for (let i = end; i !== s && i >= 0; i = from[i]) path.push(i);
    path.reverse();
    return path;
  }
  find.lastExpanded = 0;

  // Path requests are queued and served with a budget of node expansions per tick so that
  // many simultaneous orders never stall a frame.
  function request(S, e, goal) {
    e.pathGoal = goal;
    if (!e.pathQueued) { e.pathQueued = true; S.pathQ.push(e.id); }
  }
  function process(S, budget) {
    let left = budget || 9000;
    while (S.pathQ.length && left > 0) {
      const id = S.pathQ.shift();
      const e = UB.World.get(S, id);
      if (!e || e.dead || !e.pathGoal) { if (e) e.pathQueued = false; continue; }
      e.pathQueued = false;
      const goal = e.pathGoal;
      e.pathGoal = null;
      const p = find(S, e.x, e.y, goal.x, goal.y, goal);
      left -= find.lastExpanded + 20;
      e.path = p;
      e.pathI = 0;
      e.pathFail = !p;
    }
  }

  // Cost for a zombie to step onto tile j: terrain cost, or the effort of breaking a structure.
  function flowEnterCost(S, j) {
    const st = S._struct[j];
    if (st) {
      const b = S._ents.get(st);
      if (b && b.type === 'hq') return 1;
      return 1 + (b ? b.hp : 300) / 12;
    }
    if (S._blockZ[j]) return Infinity;
    return UB.DEF.TERRAIN[S.map.terrain[j]].cost;
  }

  // Flow field: distance-to-HQ for zombies. Player structures cost extra in proportion to
  // their hit points, so hordes walk around strong walls when a gap exists and break the
  // weakest point when the base is closed.
  function updateFlow(S, force) {
    const hq = UB.World.hq(S);
    if (!hq) return;
    if (!force && S._flowVer === S._structVersion) return;
    if (!force && S._flowTick !== undefined && S.tick - S._flowTick < 20) return;
    S._flowVer = S._structVersion;
    S._flowTick = S.tick;
    const N = S.map.w, n = N * N;
    if (!S._flow || S._flow.length !== n) S._flow = new Float32Array(n);
    const dist = S._flow;
    dist.fill(Infinity);
    const heap = new UB.U.Heap(8192);
    for (let y = hq.ty; y < hq.ty + hq.h; y++) for (let x = hq.tx; x < hq.tx + hq.w; x++) { dist[y * N + x] = 0; heap.push(y * N + x, 0); }
    const enterCost = (j) => flowEnterCost(S, j);
    const blockedCorner = (j) => S._blockZ[j] === 1;
    while (heap.size) {
      const i = heap.pop();
      const x = i % N, y = (i / N) | 0;
      const di = dist[i];
      const ci = enterCost(i);
      if (ci === Infinity) continue;
      for (let d = 0; d < 8; d++) {
        const dx = DIRS[d][0], dy = DIRS[d][1];
        const xx = x + dx, yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= N || yy >= N) continue;
        const j = yy * N + xx;
        if (S._blockZ[j] && !S._struct[j]) continue;
        if (dx && dy && (blockedCorner(y * N + xx) || blockedCorner(yy * N + x))) continue;
        const nd = di + ci * (dx && dy ? SQ2 : 1);
        if (nd < dist[j]) { dist[j] = nd; heap.push(j, nd); }
      }
    }
  }

  // Best neighbouring tile index along the flow field from (x, y), or -1.
  function flowNext(S, x, y) {
    const N = S.map.w;
    const tx = Math.floor(x), ty = Math.floor(y);
    const i0 = ty * N + tx;
    if (!S._flow) return -1;
    let best = -1, bd = Infinity;
    if (S._flow[i0] === 0) return -1;
    for (let d = 0; d < 8; d++) {
      const dx = DIRS[d][0], dy = DIRS[d][1];
      const xx = tx + dx, yy = ty + dy;
      if (xx < 0 || yy < 0 || xx >= N || yy >= N) continue;
      const j = yy * N + xx;
      if (dx && dy && (S._blockZ[ty * N + xx] || S._blockZ[yy * N + tx])) continue;
      // Remaining distance plus the cost of entering the neighbour (a wall is expensive).
      const c = S._flow[j] + flowEnterCost(S, j) * (dx && dy ? SQ2 : 1);
      if (c < bd) { bd = c; best = j; }
    }
    return best;
  }

  // Straight-line walkability check between two points (for skipping waypoints).
  function lineClear(S, x0, y0, x1, y1, zombie) {
    const block = zombie ? S._blockZ : S._blockU;
    const N = S.map.w;
    const d = Math.hypot(x1 - x0, y1 - y0);
    const steps = Math.ceil(d * 3);
    for (let k = 1; k <= steps; k++) {
      const t = k / steps;
      const x = Math.floor(x0 + (x1 - x0) * t), y = Math.floor(y0 + (y1 - y0) * t);
      if (x < 0 || y < 0 || x >= N || y >= N || block[y * N + x]) return false;
    }
    return true;
  }

  UB.Path = { find, request, process, updateFlow, flowNext, lineClear, DIRS };
})(globalThis.UB = globalThis.UB || {});
