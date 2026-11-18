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

  Gen.tree = function (g, x, groundY, z, h, rnd) {
    for (let y = groundY - h; y < groundY; y++) g.put(x, y, z, PA.T.TRUNK, 0, false);
    const top = groundY - h;
    const r = 2 + Math.floor(rnd() * 2);
    for (let dy = -r; dy <= 1; dy++) for (let dx = -r - 1; dx <= r + 1; dx++) {
      if ((dx * dx) / ((r + 1.5) * (r + 1.5)) + (dy * dy) / (r * r) > 1) continue;
      const xx = x + dx, yy = top + dy;
      if (g.get(xx, yy, z) === PA.T.AIR) g.put(xx, yy, z, PA.T.LEAVES, 0, false);
    }
  };

  Gen.testWorld = function (seed) {
    const W = 200, H = 40, D = 8, T = PA.T;
    const g = new PA.Grid(W, H, D);
    const rnd = PA.RNG.mulberry32(seed);
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
      for (let i = 0; i < 6; i++) {
        const x = 5 + Math.floor(rnd() * (W - 10));
        if (z === 3 && x > 55 && x < 95) continue;
        Gen.tree(g, x, g.surfaceY(x, z), z, 3 + Math.floor(rnd() * 3), rnd);
      }
      for (let x = 2; x < W - 2; x++) {
        const sy = g.surfaceY(x, z);
        if (g.get(x, sy - 1, z) !== T.AIR) continue;
        const r = rnd();
        if (r < 0.05) g.put(x, sy - 1, z, T.WEED, 0, false);
        else if (r < 0.07) g.put(x, sy - 1, z, T.FLOWER, 0, false);
        else if (r < 0.085) g.put(x, sy - 1, z, T.ROCK, 0, false);
      }
    }
    // a little shed in slice 5
    const sy = g.surfaceY(40, 5);
    Gen.paint(g, 36, sy - 6, 5, [
      '   /\\   ',
      '  /  \\  ',
      ' /____\\ ',
      ' |[]  | ',
      ' |  []| ',
      ' |____| ',
    ], T.ART);
    for (let y = sy; y < sy + 2; y++) for (let x = 36; x < 44; x++) g.put(x, y, 5, T.DIRT, 0, false);
    // a ladder up a little cliff in slice 1
    for (let x = 100; x < 120; x++) for (let y = 18; y < 26; y++) g.put(x, y, 1, y === 18 ? T.GRASS : T.STONE, 0, false);
    for (let y = 18; y < g.surfaceY(99, 1); y++) g.put(99, y, 1, T.LADDER, 0, false);
    return { id: 'test', kind: 'overworld', grid: g, doors: [], spots: { spawn: { x: 20, z: 2 } }, zones: [], props: [] };
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = Gen;
})(typeof window !== 'undefined' ? window : globalThis);
