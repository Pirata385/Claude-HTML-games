/* World generation. testWorld is a small sandbox used during engine bring-up. */
(function (root) {
  'use strict';
  const PA = root.PA = root.PA || {};
  const Gen = PA.Gen = PA.Gen || {};

  /** Paint ASCII art into the grid. lines[0] is the top row; tile = ART (solid) or DECO; spaces skipped. */
  Gen.paint = function (g, x0, y0, z, lines, tile, opts) {
    const o = opts || {};
    for (let r = 0; r < lines.length; r++) {
      for (let c = 0; c < lines[r].length; c++) {
        const ch = lines[r][c];
        if (ch === ' ' && !o.fillSpaces) continue;
        const t = (o.map && o.map[ch] != null) ? o.map[ch] : tile;
        g.put(x0 + c, y0 + r, z, t, ch === ' ' ? 32 : ch.charCodeAt(0), false);
      }
    }
  };

  /** Add a tree prop standing on the ground at column x (gy = first solid row). */
  Gen.addTree = function (map, x, z, kind, seed) {
    const gy = map.grid.surfaceY(x, z);
    const p = { type: 'tree', x, gy, z, kind, seed: seed >>> 0 };
    map.props.push(p);
    return p;
  };
  Gen.addBush = function (map, x, z, seed) {
    const p = { type: 'bush', x, gy: map.grid.surfaceY(x, z), z, seed: seed >>> 0 };
    map.props.push(p);
    return p;
  };

  Gen.testWorld = function (seed) {
    const W = 200, H = 40, D = 8, T = PA.T;
    const g = new PA.Grid(W, H, D);
    const rnd = PA.RNG.mulberry32(seed);
    const map = { id: 'test', kind: 'overworld', grid: g, doors: [], spots: { spawn: { x: 20, z: 2 } }, zones: [], props: [] };
    for (let z = 0; z < D; z++) {
      for (let x = 0; x < W; x++) {
        let top = 26 + Math.round((PA.RNG.fbm1(x * 0.04 + z * 0.7, seed + z) - 0.5) * (4 + z * 1.6));
        if (z === 3 && x > 60 && x < 90) top = 30;
        for (let y = top; y < H; y++) {
          let t = y === top ? T.GRASS : (y > top + 5 ? T.STONE : T.DIRT);
          if (y >= H - 2) t = T.BEDROCK;
          g.put(x, y, z, t, 0, false);
        }
        if (z === 3 && x > 60 && x < 90) for (let y = 27; y < 30; y++) g.put(x, y, z, T.WATER, 0, false);
      }
    }
    for (let z = 0; z < D; z++) {
      for (let x = 2; x < W - 2; x++) {
        const sy = g.surfaceY(x, z);
        if (g.get(x, sy - 1, z) !== T.AIR) continue;
        const r = rnd();
        if (r < 0.05) g.put(x, sy - 1, z, T.WEED, 0, false);
        else if (r < 0.07) g.put(x, sy - 1, z, T.FLOWER, 0, false);
        else if (r < 0.085) g.put(x, sy - 1, z, T.ROCK, 0, false);
      }
    }
    // a ladder up a little cliff in slice 1
    for (let x = 100; x < 120; x++) for (let y = 18; y < 26; y++) g.put(x, y, 1, y === 18 ? T.GRASS : T.STONE, 0, false);
    for (let y = 18; y < g.surfaceY(99, 1); y++) g.put(99, y, 1, T.LADDER, 0, false);
    // props last, once the terrain is final
    for (let z = 0; z < D; z++) {
      for (let i = 0; i < 3; i++) {
        const x = 5 + Math.floor(rnd() * (W - 10));
        if (z === 3 && x > 55 && x < 95) continue;
        if (z === 1 && x > 95 && x < 122) continue;
        Gen.addTree(map, x, z, ['oak', 'fruit', 'pine', 'birch'][Math.floor(rnd() * 4)], Math.floor(rnd() * 1e9));
      }
      for (let i = 0; i < 2; i++) Gen.addBush(map, 5 + Math.floor(rnd() * (W - 10)), z, Math.floor(rnd() * 1e9));
    }
    return map;
  };
  /* ======================= Overworld: farm, Marginton, forest & lake, mountain ======================= */
  const GY = Gen.GY = 34;           // ground surface row of the flat areas
  Gen.W = 480; Gen.H = 48; Gen.D = 12;

  Gen.overworld = function (seed) {
    const W = Gen.W, H = Gen.H, D = Gen.D, T = PA.T;
    const g = new PA.Grid(W, H, D);
    const rnd = PA.RNG.mulberry32(seed);
    const map = {
      id: 'overworld', kind: 'overworld', seed, grid: g, doors: [], spots: {}, props: [],
      zones: [{ name: 'farm', x0: 0, x1: 160 }, { name: 'meadow', x0: 160, x1: 186 }, { name: 'town', x0: 186, x1: 334 }, { name: 'forest', x0: 334, x1: 420 }, { name: 'mountain', x0: 420, x1: 480 }],
    };
    const top = (x, z) => {
      const n = PA.RNG.fbm1(x * 0.045 + z * 3.7, seed + z * 13) - 0.5;
      if (z === 0) return x < 456 ? GY : GY - 8;                      // the road
      if (x >= 420) {                                                   // mountain rises to the east
        const rise = Math.min(14, Math.round((x - 420) * 0.32 + (z - 1) * 0.6));
        return z <= 1 ? (x < 456 ? GY : GY - 8) : GY - 2 - rise + Math.round(n * 2);
      }
      if (z >= 9) {
        if (x < 160) return z === 11 ? GY - 3 : GY - 2;                // grandpa's orchard plateau
        if (x < 167) return GY - 10;                                    // cliff that seals it from the east
        return GY - 1 - (z - 9) - Math.round((n + 0.5) * 3);           // far hills
      }
      if (x < 186 || (x >= 186 && x < 334)) return GY;                  // farm, meadow, town: flat
      return GY + Math.round(n * 1.6);                                  // forest floor
    };
    // terrain columns
    for (let z = 0; z < D; z++) {
      for (let x = 0; x < W; x++) {
        let t0 = top(x, z);
        const mountain = x >= 420 && z >= 2;
        for (let y = t0; y < H; y++) {
          let t = y === t0 ? (z === 0 ? T.DIRT : mountain ? T.STONE : T.GRASS) : y < t0 + 4 && !mountain ? T.DIRT : T.STONE;
          if (y >= H - 2) t = T.BEDROCK;
          g.put(x, y, z, t, 0, false);
        }
      }
    }
    const flat = (x0, x1, z, y) => { for (let x = x0; x <= x1; x++) { for (let yy = 0; yy < y; yy++) g.put(x, yy, z, T.AIR, 0, false); for (let yy = y; yy < Math.min(H - 2, y + 4); yy++) g.put(x, yy, z, yy === y ? T.GRASS : T.DIRT, 0, false); } };
    const water = (x0, x1, z, surf, depth) => {
      for (let x = x0; x <= x1; x++) {
        for (let y = 0; y < surf; y++) g.put(x, y, z, T.AIR, 0, false);
        for (let y = surf; y < surf + depth; y++) g.put(x, y, z, T.WATER, 0, false);
        g.put(x, surf + depth, z, T.SAND, 0, false);
      }
    };
    // the creek behind the farm (2 deep; the north bank is 2 rows higher than the water)
    water(0, 168, 8, GY, 2);
    // the lake in the forest
    for (let z = 4; z <= 7; z++) water(352, 398 - (z - 4) * 2, z, GY, 3 + (z > 4 ? 1 : 0));
    for (let x = 349; x <= 363; x++) g.put(x, GY, 3, T.PLANK, 0, false);

    /* ---- buildings: solid walls in their slices, drawn by the building prop ---- */
    const building = (id, x0, w, zf, h, o) => {
      const depth = o.depth || 2;
      for (let z = zf; z < zf + depth; z++) {
        flat(x0 - 1, x0 + w, z, GY);
        for (let x = x0; x < x0 + w; x++) for (let y = GY - h; y < GY; y++) g.put(x, y, z, T.WALL, 0, false);
      }
      const door = x0 + (o.door != null ? o.door : Math.floor(w / 2) - 1);
      map.props.push({ type: 'building', id, x0, w, z: zf, h, roof: o.roof || 'gable', door, sign: o.sign || '', chimney: !!o.chimney, windows: o.windows != null ? o.windows : 2 });
      map.doors.push({ x: door, z: zf, w: 2, to: id });
      flat(x0 - 1, x0 + w, zf - 1, GY);
    };
    building('house', 8, 20, 6, 6, { door: 9, sign: '', chimney: true });
    building('ranch', 168, 15, 2, 6, { sign: 'RANCH', roof: 'barn' });
    building('store', 190, 16, 2, 6, { sign: 'SEEDS & GOODS' });
    building('stationer', 210, 13, 2, 6, { sign: 'INK & PAPER', roof: 'shed' });
    building('smith', 227, 14, 2, 5, { sign: 'SMITHY', roof: 'flat', chimney: true });
    building('cafe', 245, 14, 2, 6, { sign: 'CAFE' });
    building('clinic', 263, 13, 2, 6, { sign: 'CLINIC', roof: 'flat' });
    building('hall', 280, 20, 2, 8, { sign: 'TOWN HALL', windows: 3 });
    building('library', 304, 16, 2, 7, { sign: 'LIBRARY', roof: 'shed' });
    building('carpenter', 192, 16, 5, 6, { sign: 'CARPENTRY', chimney: true });
    building('home_pip', 212, 12, 5, 5, {});
    building('home_rule', 228, 12, 5, 5, { roof: 'shed' });
    building('home_quill', 244, 14, 5, 6, { chimney: true });
    building('home_sepia', 297, 12, 5, 5, { roof: 'flat' });
    building('inn', 312, 16, 5, 7, { sign: 'INN', windows: 3 });
    building('hut', 336, 10, 2, 5, { sign: 'BAIT', roof: 'shed' });
    // the mine mouth in the mountain face
    map.props.push({ type: 'mine', x: 446, z: 2, w: 6 });
    map.doors.push({ x: 448, z: 2, w: 2, to: 'mine' });
    for (let x = 440; x < 456; x++) { for (let y = 0; y < GY; y++) g.put(x, y, 1, T.AIR, 0, false); g.put(x, GY, 1, T.DIRT, 0, false); }

    /* ---- spots ---- */
    Object.assign(map.spots, {
      spawn: { x: 18, z: 5 }, bin: { x: 34, z: 1 }, mailbox: { x: 30, z: 1 }, field: { x: 60, z: 3 }, well: { x: 4, z: 1 },
      board: { x: 274, z: 1 }, fountain: { x: 268, z: 7 }, dock: { x: 356, z: 3 }, mine: { x: 448, z: 1 }, orchard: { x: 60, z: 10 },
    });

    /* ---- small props ---- */
    const P = (o) => { map.props.push(o); return o; };
    P({ type: 'bin', x: 34, z: 1 }); P({ type: 'mailbox', x: 30, z: 1 }); P({ type: 'well', x: 4, z: 1 });
    P({ type: 'fence', x0: 38, x1: 134, z: 1 }); P({ type: 'fence', x0: 160, x1: 186, z: 1 });
    P({ type: 'board', x: 274, z: 1 }); P({ type: 'fountain', x: 268, z: 7 });
    P({ type: 'sign', x: 150, z: 0, text: 'MARGINTON ->' }); P({ type: 'sign', x: 40, z: 0, text: '<- PAPER ACRES' });
    P({ type: 'sign', x: 430, z: 0, text: 'MINE ^' });
    for (let x = 192; x <= 330; x += 18) P({ type: 'lamp', x, z: 1 });
    P({ type: 'bench', x: 256, z: 7 }); P({ type: 'bench', x: 280, z: 7 });

    /* ---- debris on the field (weeds, rocks, branches) ---- */
    for (let z = 2; z <= 5; z++) for (let x = 40; x <= 132; x++) {
      const r = rnd();
      const t = r < 0.12 ? T.WEED : r < 0.17 ? T.ROCK : r < 0.21 ? T.BRANCH : 0;
      if (t) g.put(x, GY - 1, z, t, 0, false);
    }

    /* ---- trees ---- */
    const free = (x, z) => !map.props.some((p) => p.type === 'building' && p.z <= z && z < p.z + 2 && x >= p.x0 - 4 && x <= p.x0 + p.w + 3);
    const plant = (x, z, kind) => { if (free(x, z) && !g.def(x, g.surfaceY(x, z) - 1, z).water && g.surfaceY(x, z) < H - 2) Gen.addTree(map, x, z, kind, Math.floor(rnd() * 1e9)); };
    for (let i = 0; i < 12; i++) plant(12 + Math.floor(rnd() * 140), 9 + Math.floor(rnd() * 3), 'fruit');
    plant(4, 6, 'oak'); plant(36, 7, 'oak'); plant(140, 7, 'birch'); plant(150, 4, 'oak');
    for (let i = 0; i < 16; i++) plant(160 + Math.floor(rnd() * 26), 3 + Math.floor(rnd() * 9), ['oak', 'birch', 'pine'][Math.floor(rnd() * 3)]);
    for (let i = 0; i < 8; i++) plant(190 + Math.floor(rnd() * 140), 8 + Math.floor(rnd() * 4), ['oak', 'birch'][Math.floor(rnd() * 2)]);
    plant(250, 7, 'oak'); plant(292, 7, 'birch');
    for (let z = 1; z < D; z++) for (let i = 0; i < 5; i++) {
      const x = 340 + Math.floor(rnd() * 78);
      if (z >= 3 && z <= 7 && x > 346 && x < 402) continue;
      if (z === 1 && x > 330 && x < 348) continue;
      plant(x, z, ['oak', 'pine', 'birch', 'pine'][Math.floor(rnd() * 4)]);
    }
    for (let z = 3; z < D; z++) for (let i = 0; i < 2; i++) plant(424 + Math.floor(rnd() * 50), z, 'pine');
    for (let i = 0; i < 26; i++) {
      const x = Math.floor(rnd() * W), z = 1 + Math.floor(rnd() * 10);
      if ((z >= 2 && z <= 5 && x >= 38 && x <= 134) || !free(x, z)) continue;
      if (!g.def(x, g.surfaceY(x, z) - 1, z).water) Gen.addBush(map, x, z, Math.floor(rnd() * 1e9));
    }
    return map;
  };

  /* ======================= Interiors ======================= */
  // furniture: [kind, x, z, extra]; z0 = where you walk, z1 = behind (keepers, counters), z2 = back wall
  const ROOMS = {
    house:     { w: 30, win: [6, 21], pic: [14], clock: 26, furn: [['bed', 2, 1], ['table', 11, 0], ['chair', 9, 0], ['fireplace', 14, 1], ['stove', 20, 1], ['workbench', 24, 1], ['plant', 28, 0]] },
    store:     { w: 28, win: [4, 22], furn: [['shelf', 2, 1], ['counter', 10, 1, 9], ['shelf', 21, 1], ['crate', 24, 0], ['barrel', 3, 0]], keeper: 14 },
    stationer: { w: 24, win: [18], pic: [4], furn: [['bookshelf', 1, 1], ['counter', 8, 1, 8], ['shelf', 18, 1], ['plant', 22, 0]], keeper: 12 },
    smith:     { w: 26, win: [20], furn: [['forge', 2, 1], ['anvil', 9, 0], ['counter', 13, 1, 7], ['barrel', 22, 0]], keeper: 16 },
    cafe:      { w: 28, win: [4, 12, 20], furn: [['counter', 2, 1, 8], ['table', 13, 0], ['chair', 11, 0], ['chair', 18, 0], ['table', 21, 0], ['chair', 25, 0], ['plant', 26, 1]], keeper: 5 },
    clinic:    { w: 24, win: [12], pic: [4], furn: [['counter', 2, 1, 6], ['bed', 15, 1], ['shelf', 9, 1], ['plant', 21, 0]], keeper: 5 },
    hall:      { w: 32, win: [3, 26], clock: 16, furn: [['board', 11, 1, 10], ['desk', 22, 1], ['chair', 24, 1], ['plant', 2, 0], ['plant', 29, 0]], keeper: 23 },
    library:   { w: 30, win: [14], furn: [['bookshelf', 1, 1], ['bookshelf', 6, 1], ['desk', 13, 1], ['bookshelf', 20, 1], ['bookshelf', 25, 1], ['table', 15, 0], ['chair', 13, 0]], keeper: 15 },
    carpenter: { w: 28, win: [6, 20], furn: [['workbench', 2, 1], ['crate', 9, 0], ['counter', 12, 1, 7], ['crate', 22, 1], ['crate', 24, 0]], keeper: 15 },
    ranch:     { w: 26, win: [12], furn: [['hay', 1, 1], ['counter', 8, 1, 7], ['hay', 19, 1], ['barrel', 22, 0]], keeper: 11 },
    inn:       { w: 30, win: [5, 16], pic: [24], furn: [['counter', 2, 1, 7], ['stairs', 24, 1], ['table', 13, 0], ['chair', 11, 0], ['chair', 17, 0]], keeper: 5 },
    hut:       { w: 18, win: [12], furn: [['counter', 2, 1, 6], ['barrel', 11, 0], ['crate', 14, 1]], keeper: 5 },
    home:      { w: 22, win: [5, 16], pic: [11], furn: [['bed', 1, 1], ['table', 9, 0], ['chair', 7, 0], ['shelf', 16, 1], ['plant', 20, 0]] },
  };
  Gen.ROOMS = ROOMS;
  Gen.FY = 11; // interior floor row
  Gen.interior = function (id) {
    const R0 = ROOMS[id] || ROOMS[id.startsWith('home') ? 'home' : 'home'];
    const W = R0.w, H = 14, D = 3, FY = Gen.FY, T = PA.T;
    const g = new PA.Grid(W, H, D);
    for (let z = 0; z < D; z++) {
      for (let x = 0; x < W; x++) for (let y = FY; y < H; y++) g.put(x, y, z, T.PLANK, 0, false);
      for (let y = 0; y < FY; y++) { g.put(0, y, z, T.WALL, 0, false); g.put(W - 1, y, z, T.WALL, 0, false); }
    }
    for (let x = 0; x < W; x++) for (let y = 0; y < FY; y++) g.put(x, y, 2, T.WALL, 0, false);
    const exitX = Math.floor(W / 2);
    const map = {
      id, kind: 'interior', grid: g, doors: [], props: [], zones: [],
      spots: { entry: { x: exitX, z: 0 } },
      exit: { x: exitX },
    };
    if (R0.keeper != null) map.spots.keeper = { x: R0.keeper, z: 1 };
    map.props.push({ type: 'room', x0: 0, w: W, z: 2, gy: FY, h: FY - 2, win: R0.win || [], pic: R0.pic || [], clock: R0.clock });
    map.props.push({ type: 'walls', x0: 0, w: W, z: 0, gy: FY, h: FY - 2 });
    map.props.push({ type: 'furniture', kind: 'mat', x: exitX - 1, z: 0, gy: FY });
    for (const f of R0.furn) {
      const pr = { type: 'furniture', kind: f[0], x: f[1], z: f[2], gy: FY };
      if (f[3]) pr.w = f[3];
      if (f[0] === 'counter') pr.front = true;
      map.props.push(pr);
    }
    return map;
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = Gen;
})(typeof window !== 'undefined' ? window : globalThis);
