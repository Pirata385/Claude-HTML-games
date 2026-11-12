// Amalgamations — interior layouts for caves (cellular automata) and dungeons (rooms + corridors). Pure.
// Cells: 0 wall, 1 floor, 2 spike trap, 3 boss-room door (sealed until the dungeon's other rooms are cleared).
// Cell size is 2 m. Output coordinates are in cells; the game converts them to metres.
(function (root) {
  'use strict';
  const AM = root.AM || (root.AM = {});
  const CELL = 2;

  function bfs(w, h, cells, sx, sz) {
    const dist = new Int32Array(w * h).fill(-1);
    const q = [sz * w + sx];
    dist[q[0]] = 0;
    for (let qi = 0; qi < q.length; qi++) {
      const i = q[qi], x = i % w, z = (i / w) | 0;
      const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]];
      for (const [dx, dz] of nb) {
        const nx = x + dx, nz = z + dz;
        if (nx < 0 || nz < 0 || nx >= w || nz >= h) continue;
        const j = nz * w + nx;
        if (dist[j] >= 0 || cells[j] === 0) continue;
        dist[j] = dist[i] + 1;
        q.push(j);
      }
    }
    return dist;
  }

  function cave(seed, level) {
    const rng = AM.makeRng(seed ^ 0xca7e);
    const w = 46, h = 46;
    let cells = new Uint8Array(w * h);
    for (let z = 0; z < h; z++) for (let x = 0; x < w; x++) {
      const edge = x < 2 || z < 2 || x >= w - 2 || z >= h - 2;
      cells[z * w + x] = edge ? 0 : rng.next() < 0.54 ? 1 : 0;
    }
    for (let it = 0; it < 5; it++) {
      const next = new Uint8Array(w * h);
      for (let z = 1; z < h - 1; z++) for (let x = 1; x < w - 1; x++) {
        let walls = 0;
        for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) if (cells[(z + dz) * w + x + dx] === 0) walls++;
        next[z * w + x] = walls >= 5 ? 0 : 1;
      }
      for (let z = 0; z < h; z++) for (let x = 0; x < w; x++) if (x < 2 || z < 2 || x >= w - 2 || z >= h - 2) next[z * w + x] = 0;
      cells = next;
    }
    // keep the largest connected region
    let bestStart = -1, bestSize = 0;
    const seen = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) {
      if (!cells[i] || seen[i]) continue;
      const d = bfs(w, h, cells, i % w, (i / w) | 0);
      let size = 0;
      for (let j = 0; j < w * h; j++) if (d[j] >= 0) { seen[j] = 1; size++; }
      if (size > bestSize) { bestSize = size; bestStart = i; }
    }
    const d0 = bfs(w, h, cells, bestStart % w, (bestStart / w) | 0);
    for (let i = 0; i < w * h; i++) if (d0[i] < 0) cells[i] = 0;
    // entrance: the floor cell closest to the bottom edge
    let entrance = null;
    for (let z = h - 1; z >= 0 && !entrance; z--) for (let x = (w / 2) | 0, k = 0; k < w; k++) {
      const xx = (x + (k % 2 ? -1 : 1) * Math.ceil(k / 2) + w) % w;
      if (cells[z * w + xx]) { entrance = { x: xx, z }; break; }
    }
    const dist = bfs(w, h, cells, entrance.x, entrance.z);
    const floors = [];
    for (let i = 0; i < w * h; i++) if (cells[i]) floors.push(i);
    const wallNeighbours = (i) => { const x = i % w, z = (i / w) | 0; let n = 0; for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (!cells[(z + dz) * w + x + dx]) n++; return n; };
    const ores = [], spawns = [], chests = [];
    rng.shuffle(floors);
    for (const i of floors) {
      if (dist[i] < 6) continue;
      const wn = wallNeighbours(i);
      const x = i % w, z = (i / w) | 0;
      if (wn >= 1 && ores.length < 14 && rng.chance(0.08)) ores.push({ x, z, ore: rng.weighted(['iron', 'goldore', 'crystal', 'stone'], (o) => ({ iron: 4, goldore: 2, crystal: 2.5, stone: 2 })[o]), id: `co:${seed}:${i}` });
      else if (wn === 0 && spawns.length < 9 + Math.min(6, level >> 2) && rng.chance(0.05) && !spawns.some((s) => Math.abs(s.x - x) + Math.abs(s.z - z) < 5)) spawns.push({ x, z });
    }
    // the chest goes in the far corner
    let far = 0, farI = 0;
    for (let i = 0; i < w * h; i++) if (dist[i] > far) { far = dist[i]; farI = i; }
    chests.push({ x: farI % w, z: (farI / w) | 0, big: false, id: `cc:${seed}` });
    return { kind: 'cave', w, h, cells, entrance, ores, spawns, chests, boss: null, rooms: [], cellSize: CELL, level };
  }

  function dungeon(seed, level) {
    const rng = AM.makeRng(seed ^ 0xd00d);
    const w = 64, h = 64;
    const cells = new Uint8Array(w * h);
    const rooms = [];
    const want = 6 + rng.int(0, 3);
    for (let tries = 0; tries < 400 && rooms.length < want; tries++) {
      const rw = rng.int(6, 11), rh = rng.int(6, 11);
      const x = rng.int(2, w - rw - 3), z = rng.int(2, h - rh - 3);
      if (rooms.some((r) => x < r.x + r.w + 3 && x + rw + 3 > r.x && z < r.z + r.h + 3 && z + rh + 3 > r.z)) continue;
      rooms.push({ x, z, w: rw, h: rh, cx: x + (rw >> 1), cz: z + (rh >> 1) });
    }
    for (const r of rooms) for (let z = r.z; z < r.z + r.h; z++) for (let x = r.x; x < r.x + r.w; x++) cells[z * w + x] = 1;
    const carve = (x, z) => { if (x > 0 && z > 0 && x < w - 1 && z < h - 1 && cells[z * w + x] === 0) cells[z * w + x] = 4; };
    // connect each room to its nearest already-connected room with an L-shaped 2-wide corridor
    const connected = [0];
    const edges = [];
    for (let i = 1; i < rooms.length; i++) {
      let best = 0, bd = Infinity;
      for (const j of connected) { const d = Math.abs(rooms[i].cx - rooms[j].cx) + Math.abs(rooms[i].cz - rooms[j].cz); if (d < bd) { bd = d; best = j; } }
      connected.push(i);
      edges.push([best, i]);
    }
    if (rooms.length > 3) edges.push([rooms.length - 1, 1 + rng.int(0, rooms.length - 3)]);
    for (const [a, b] of edges) {
      const A = rooms[a], B = rooms[b];
      const horizFirst = rng.chance(0.5);
      let x = A.cx, z = A.cz;
      const stepX = () => { while (x !== B.cx) { carve(x, z); carve(x, z + 1); x += Math.sign(B.cx - x); } };
      const stepZ = () => { while (z !== B.cz) { carve(x, z); carve(x + 1, z); z += Math.sign(B.cz - z); } };
      if (horizFirst) { stepX(); stepZ(); } else { stepZ(); stepX(); }
      carve(x, z);
    }
    for (let i = 0; i < w * h; i++) if (cells[i] === 4) cells[i] = rng.chance(0.06) ? 2 : 1;
    const entranceRoom = rooms[0];
    const entrance = { x: entranceRoom.cx, z: entranceRoom.cz };
    const dist = bfs(w, h, cells, entrance.x, entrance.z);
    // boss room: the room farthest from the entrance
    let bossI = 1, bd = -1;
    for (let i = 1; i < rooms.length; i++) { const d = dist[rooms[i].cz * w + rooms[i].cx]; if (d > bd) { bd = d; bossI = i; } }
    const boss = rooms[bossI];
    boss.boss = true;
    // seal the boss room: corridor cells touching it become doors
    for (let z = boss.z - 1; z <= boss.z + boss.h; z++) for (let x = boss.x - 1; x <= boss.x + boss.w; x++) {
      const inside = x >= boss.x && x < boss.x + boss.w && z >= boss.z && z < boss.z + boss.h;
      if (inside) continue;
      const i = z * w + x;
      if (cells[i] === 1 || cells[i] === 2) cells[i] = 3;
    }
    const spawns = [], chests = [];
    rooms.forEach((r, i) => {
      if (i === 0 || i === bossI) return;
      const n = 2 + rng.int(0, 2) + (level > 15 ? 1 : 0);
      for (let k = 0; k < n; k++) spawns.push({ x: r.x + 1 + rng.int(0, r.w - 3), z: r.z + 1 + rng.int(0, r.h - 3), room: i });
      if (rng.chance(0.35)) chests.push({ x: r.x + 1, z: r.z + 1, big: false, id: `dc:${seed}:${i}` });
    });
    chests.push({ x: boss.cx, z: boss.z + boss.h - 2, big: true, id: `db:${seed}` });
    // spawns reachable without passing the sealed doors must be cleared to open the boss room
    const closed = bfs(w, h, Uint8Array.from(cells, (c) => (c === 0 || c === 3 ? 0 : 1)), entrance.x, entrance.z);
    for (const sp of spawns) sp.gate = closed[sp.z * w + sp.x] >= 0;
    return { kind: 'dungeon', w, h, cells, entrance, rooms, boss: { x: boss.cx, z: boss.cz, room: bossI }, spawns, chests, ores: [], cellSize: CELL, level };
  }

  // Every walkable cell (doors count as walkable once opened) reachable from the entrance?
  function allReachable(L) {
    const open = Uint8Array.from(L.cells, (c) => (c === 0 ? 0 : 1));
    const d = bfs(L.w, L.h, open, L.entrance.x, L.entrance.z);
    for (let i = 0; i < open.length; i++) if (open[i] && d[i] < 0) return false;
    return true;
  }

  Object.assign(AM, { DUNGEON_CELL: CELL, genCave: cave, genDungeon: dungeon, interiorBfs: bfs, interiorAllReachable: allReachable });
  if (typeof module !== 'undefined' && module.exports) module.exports = AM;
})(typeof window !== 'undefined' ? window : globalThis);
