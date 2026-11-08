// Niryk — procedural level generation (pure logic, no DOM; covered by tests/run.js).
// A level is a tree of rooms on a grid of cells joined by 3-tile corridors, carved into one tile map.
'use strict';
(function () {
  const root = typeof window !== 'undefined' ? window : globalThis;
  const N = root.N = root.N || {};

  const T = N.TILE = { VOID: 0, FLOOR: 1, WALL: 2, DOOR: 3, BLOCK: 4 };
  const CS = 34; // cell size in tiles
  const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  N.ROOM_TYPES = { start: 'Início', enemy: 'Inimigos', chest: 'Presente', upgrade: 'Upgrade', shop: 'Loja', boss: 'Chefe' };

  function makeMap(W, H) {
    return { W, H, tiles: new Uint8Array(W * H), roomIdx: new Int16Array(W * H).fill(-1), rooms: [] };
  }
  N.tileAt = (map, tx, ty) => (tx < 0 || ty < 0 || tx >= map.W || ty >= map.H ? T.VOID : map.tiles[ty * map.W + tx]);

  function carveRoom(map, room) {
    const { x0, y0, w, h } = room;
    for (let y = y0 - 1; y <= y0 + h; y++) {
      for (let x = x0 - 1; x <= x0 + w; x++) {
        const i = y * map.W + x;
        const inside = x >= x0 && x < x0 + w && y >= y0 && y < y0 + h;
        if (inside) { map.tiles[i] = T.FLOOR; map.roomIdx[i] = room.id; } else if (map.tiles[i] === T.VOID) map.tiles[i] = T.WALL;
      }
    }
  }

  function carveCorridor(map, a, b) {
    if (a.gy === b.gy) { // horizontal
      const [l, r] = a.gx < b.gx ? [a, b] : [b, a];
      const cy = l.cy, xs = l.x0 + l.w, xe = r.x0 - 1;
      for (let x = xs; x <= xe; x++) {
        for (let dy = -2; dy <= 2; dy++) {
          const i = (cy + dy) * map.W + x;
          if (Math.abs(dy) <= 1) map.tiles[i] = T.FLOOR; else if (map.tiles[i] === T.VOID) map.tiles[i] = T.WALL;
        }
      }
      for (let dy = -1; dy <= 1; dy++) {
        const il = (cy + dy) * map.W + xs, ir = (cy + dy) * map.W + xe;
        map.tiles[il] = T.DOOR; map.tiles[ir] = T.DOOR; l.doors.push(il); r.doors.push(ir);
      }
    } else { // vertical
      const [t, btm] = a.gy < b.gy ? [a, b] : [b, a];
      const cx = t.cx, ys = t.y0 + t.h, ye = btm.y0 - 1;
      for (let y = ys; y <= ye; y++) {
        for (let dx = -2; dx <= 2; dx++) {
          const i = y * map.W + cx + dx;
          if (Math.abs(dx) <= 1) map.tiles[i] = T.FLOOR; else if (map.tiles[i] === T.VOID) map.tiles[i] = T.WALL;
        }
      }
      for (let dx = -1; dx <= 1; dx++) {
        const it = ys * map.W + cx + dx, ib = ye * map.W + cx + dx;
        map.tiles[it] = T.DOOR; map.tiles[ib] = T.DOOR; t.doors.push(it); btm.doors.push(ib);
      }
    }
  }

  // Flood fill over walkable room tiles; true if every floor tile of the room is reachable.
  function roomConnected(map, room) {
    const seen = new Set(), stack = [room.cy * map.W + room.cx];
    let total = 0;
    for (let y = room.y0; y < room.y0 + room.h; y++) for (let x = room.x0; x < room.x0 + room.w; x++) if (map.tiles[y * map.W + x] === T.FLOOR) total++;
    if (map.tiles[stack[0]] !== T.FLOOR) return false;
    while (stack.length) {
      const i = stack.pop(); if (seen.has(i)) continue; seen.add(i);
      const x = i % map.W, y = (i / map.W) | 0;
      for (const [dx, dy] of DIRS) {
        const nx = x + dx, ny = y + dy;
        if (nx < room.x0 || ny < room.y0 || nx >= room.x0 + room.w || ny >= room.y0 + room.h) continue;
        const j = ny * map.W + nx; if (map.tiles[j] === T.FLOOR && !seen.has(j)) stack.push(j);
      }
    }
    return seen.size === total;
  }

  const PATTERNS = ['none', 'pillars', 'center', 'rows', 'scatter', 'corners', 'cross'];
  function placeObstacles(map, room, r) {
    const pat = room.type === 'boss' ? 'pillars' : r.pick(PATTERNS);
    const set = [];
    const add = (x, y) => { if (x >= room.x0 + 2 && y >= room.y0 + 2 && x < room.x0 + room.w - 2 && y < room.y0 + room.h - 2) set.push(y * map.W + x); };
    const { x0, y0, w, h, cx, cy } = room;
    if (pat === 'pillars') { for (const [fx, fy] of [[0.25, 0.3], [0.75, 0.3], [0.25, 0.7], [0.75, 0.7]]) { const px = x0 + Math.round(w * fx) - 1, py = y0 + Math.round(h * fy) - 1; add(px, py); add(px + 1, py); add(px, py + 1); add(px + 1, py + 1); } }
    else if (pat === 'center') { for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (dx || dy || r() < 0.5) add(cx + dx, cy + dy); }
    else if (pat === 'rows') { for (const fy of [0.3, 0.7]) { const py = y0 + Math.round(h * fy); for (let x = x0 + 4; x < x0 + w - 4; x++) if ((x - x0) % 3 !== 0) add(x, py); } }
    else if (pat === 'scatter') { const n = r.int(5, 9); for (let k = 0; k < n; k++) add(r.int(x0 + 2, x0 + w - 3), r.int(y0 + 2, y0 + h - 3)); }
    else if (pat === 'corners') { for (const [sx, sy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) { const px = sx > 0 ? x0 + 3 : x0 + w - 4, py = sy > 0 ? y0 + 3 : y0 + h - 4; add(px, py); add(px + sx, py); add(px, py + sy); } }
    else if (pat === 'cross') { for (let k = -3; k <= 3; k++) { if (Math.abs(k) < 2) continue; add(cx + k, cy); add(cx, cy + k); } }
    for (const i of set) { const x = i % map.W, y = (i / map.W) | 0; if (Math.abs(x - cx) <= 1 && Math.abs(y - cy) <= 1 && room.type === 'boss') continue; map.tiles[i] = T.BLOCK; }
    if (!roomConnected(map, room)) for (const i of set) map.tiles[i] = T.FLOOR; // never seal a pocket off
    room.pattern = pat;
  }

  function roomSize(type, r) {
    if (type === 'start') return [11, 9];
    if (type === 'boss') return [27, 19];
    if (type === 'chest' || type === 'upgrade' || type === 'shop') return [13, 11];
    return [r.pick([15, 17, 19, 21]), r.pick([11, 13, 15])];
  }

  /**
   * Generate one level.
   * opts.boss: append a boss room after the deepest room.
   * opts.rooms: force the number of rooms (otherwise 7..10, start room not counted).
   */
  N.genLevel = function (seed, opts = {}) {
    const r = N.makeRng(seed);
    const count = opts.rooms || r.int(7, 10);
    const cells = new Map(), rooms = [];
    const key = (x, y) => x + ',' + y;
    const occupiedAround = (x, y) => DIRS.reduce((n, [dx, dy]) => n + (cells.has(key(x + dx, y + dy)) ? 1 : 0), 0);
    const addRoom = (gx, gy, parent) => {
      const room = { id: rooms.length, gx, gy, links: [], doors: [], type: 'enemy', depth: 0 };
      rooms.push(room); cells.set(key(gx, gy), room);
      if (parent) { room.links.push(parent.id); parent.links.push(room.id); }
      return room;
    };
    addRoom(0, 0, null).type = 'start';
    let guard = 0;
    while (rooms.length < count + 1 && guard++ < 5000) {
      const base = r() < 0.55 ? rooms[rooms.length - 1] : r.pick(rooms);
      if (base.links.length >= 3) continue;
      const dirs = N.shuffle(DIRS.slice(), r);
      for (const [dx, dy] of dirs) {
        const nx = base.gx + dx, ny = base.gy + dy;
        if (cells.has(key(nx, ny))) continue;
        if (occupiedAround(nx, ny) > 1 && guard < 4000) continue;
        addRoom(nx, ny, base); break;
      }
    }
    // depth (BFS from the start)
    const bfs = () => {
      for (const rm of rooms) rm.depth = -1;
      rooms[0].depth = 0; const q = [rooms[0]];
      while (q.length) { const c = q.shift(); for (const l of c.links) if (rooms[l].depth < 0) { rooms[l].depth = c.depth + 1; q.push(rooms[l]); } }
    };
    bfs();
    const byDepth = rooms.slice(1).sort((a, b) => b.depth - a.depth || a.id - b.id);
    let exit = byDepth[0], bossRoom = null;
    if (opts.boss) {
      outer: for (const cand of byDepth) {
        for (const [dx, dy] of N.shuffle(DIRS.slice(), r)) {
          const nx = cand.gx + dx, ny = cand.gy + dy;
          if (cells.has(key(nx, ny)) || occupiedAround(nx, ny) > 1) continue;
          bossRoom = addRoom(nx, ny, cand); bossRoom.type = 'boss'; exit = cand; break outer;
        }
      }
      if (!bossRoom) { // extremely unlikely: fall back to any free neighbour
        for (const cand of byDepth) for (const [dx, dy] of DIRS) { const nx = cand.gx + dx, ny = cand.gy + dy; if (!bossRoom && !cells.has(key(nx, ny))) { bossRoom = addRoom(nx, ny, cand); bossRoom.type = 'boss'; exit = cand; } }
      }
      bfs();
    }
    // special rooms: 2..3, different kinds, preferably dead ends, never the exit/boss path end
    const nSpecial = r.int(2, 3);
    const kinds = N.shuffle(['chest', 'upgrade', 'shop'], r).slice(0, nSpecial);
    const cands = N.shuffle(rooms.filter((rm) => rm.type === 'enemy' && rm !== exit && !(bossRoom && rm.links.includes(bossRoom.id))), r)
      .sort((a, b) => (a.links.length === 1 ? 0 : 1) - (b.links.length === 1 ? 0 : 1));
    kinds.forEach((k, i) => { if (cands[i]) cands[i].type = k; });
    // geometry
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const rm of rooms) { minX = Math.min(minX, rm.gx); minY = Math.min(minY, rm.gy); maxX = Math.max(maxX, rm.gx); maxY = Math.max(maxY, rm.gy); }
    const map = makeMap((maxX - minX + 1) * CS + 2, (maxY - minY + 1) * CS + 2);
    for (const rm of rooms) {
      const [w, h] = roomSize(rm.type, r);
      rm.w = w; rm.h = h;
      const ox = (rm.gx - minX) * CS + 1, oy = (rm.gy - minY) * CS + 1;
      rm.x0 = ox + ((CS - w) >> 1); rm.y0 = oy + ((CS - h) >> 1);
      rm.cx = ox + (CS >> 1); rm.cy = oy + (CS >> 1);
      rm.cleared = rm.type !== 'enemy' && rm.type !== 'boss';
      carveRoom(map, rm);
    }
    for (const rm of rooms) for (const l of rm.links) if (l > rm.id) carveCorridor(map, rm, rooms[l]);
    for (const rm of rooms) if (rm.type === 'enemy' || rm.type === 'boss') placeObstacles(map, rm, r);
    map.rooms = rooms;
    map.start = rooms[0]; map.exit = exit; map.boss = bossRoom;
    map.seed = seed;
    return map;
  };

  // A single closed room (lobby, training ground).
  N.genSingleRoom = function (w, h, pad = 3) {
    const map = makeMap(w + pad * 2, h + pad * 2);
    const room = { id: 0, gx: 0, gy: 0, links: [], doors: [], type: 'start', x0: pad, y0: pad, w, h, cx: pad + (w >> 1), cy: pad + (h >> 1), cleared: true };
    carveRoom(map, room);
    map.rooms = [room]; map.start = room;
    return map;
  };

  // Is the tile a solid obstacle for walkers? Door tiles are solid while their room is locked.
  N.isSolid = (map, tx, ty, flying) => {
    const t = N.tileAt(map, tx, ty);
    if (t === T.FLOOR) return false;
    if (t === T.DOOR) return !!(map.locked && map.locked.has(ty * map.W + tx));
    if (t === T.BLOCK) return !flying;
    return true;
  };
})();
