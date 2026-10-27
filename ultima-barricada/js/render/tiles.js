// Terrain tiles: procedurally textured 32×16 pixel diamonds, assembled into cached chunk
// canvases (16×16 tiles) with road markings and shorelines.
(function (UB) {
  'use strict';
  const { T } = UB.DEF;
  const TW = 32, TH = 16, VARIANTS = 4, CH = 16;

  const rgb = (hex) => [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255];
  function mixHex(a, b, t) {
    const A = rgb(a), B = rgb(b);
    return (Math.round(A[0] + (B[0] - A[0]) * t) << 16) | (Math.round(A[1] + (B[1] - A[1]) * t) << 8) | Math.round(A[2] + (B[2] - A[2]) * t);
  }
  // Pixel inside the diamond?
  function inside(px, py) {
    const hw = py < 8 ? 2 + py * 2 : 2 + (15 - py) * 2;
    return px >= 16 - hw && px < 16 + hw;
  }
  // Local world coordinates (u, v) in [0,1] of a pixel inside the tile.
  function uv(px, py) {
    const x = px + 0.5 - 16, y = py + 0.5;
    return [(x / 16 + y / 8) / 2, (y / 8 - x / 16) / 2];
  }

  const PAINT = {};
  PAINT[T.GRASS] = (px, py, h, h2, v) => (h < 0.1 ? 0x62904a : h < 0.22 ? 0x45703a : h2 < 0.04 ? 0x7aa858 : v % 2 ? 0x4f7c3c : 0x4c783a);
  PAINT[T.DIRT] = (px, py, h, h2) => (h < 0.12 ? 0x6a4c30 : h < 0.2 ? 0x8a6a48 : h2 < 0.03 ? 0x8a8478 : 0x7a5a3c);
  PAINT[T.ASPHALT] = (px, py, h, h2) => (h < 0.08 ? 0x34373c : h < 0.16 ? 0x45484e : h2 < 0.02 ? 0x2a2c30 : 0x3c3f44);
  PAINT[T.SIDEWALK] = (px, py, h) => {
    const [u, v] = uv(px, py);
    if (Math.abs(u - 0.5) < 0.04 || Math.abs(v - 0.5) < 0.05 || u < 0.03 || v < 0.04) return 0x77756f;
    return h < 0.1 ? 0x9a9890 : h < 0.18 ? 0x85837d : 0x8e8c86;
  };
  PAINT[T.CONCRETE] = (px, py, h, h2, v) => {
    const s = UB.valueNoise(v * 17 + 3, px / 3, py / 2);
    return s > 0.8 ? 0x62625e : h < 0.1 ? 0x76766f : h2 < 0.015 ? 0x4a4a46 : 0x6c6c66;
  };
  PAINT[T.FOREST] = (px, py, h, h2) => (h < 0.12 ? 0x5a4a2a : h < 0.2 ? 0x6a5a30 : h2 < 0.06 ? 0x2a4422 : 0x3a5530);
  PAINT[T.WATER] = (px, py, h, h2, v) => {
    const [u, w] = uv(px, py);
    const s = Math.sin((u * 2 + w) * 9 + v * 1.7);
    return s > 0.85 ? 0x4a7a9a : h < 0.08 ? 0x24506e : 0x2a5878;
  };
  PAINT[T.RUBBLE] = (px, py, h, h2) => (h < 0.12 ? 0x8a8378 : h < 0.22 ? 0x4e4842 : h2 < 0.05 ? 0x7a5a3a : 0x6a6158);
  PAINT[T.FARM] = (px, py, h) => {
    const [u] = uv(px, py);
    const row = (u * 4) % 1;
    if (row < 0.25) return h < 0.6 ? 0x5a8a3a : 0x6a9a42;
    return h < 0.15 ? 0x5a3c22 : 0x6a4a2a;
  };
  PAINT[T.TOXIC] = (px, py, h, h2, v) => {
    const s = UB.valueNoise(v * 13 + 5, px / 4, py / 2);
    return h < 0.04 ? 0xd8f070 : s > 0.62 ? 0x3e4a1c : h2 < 0.1 ? 0x8aa83a : 0x6e8a2a;
  };
  PAINT[T.BRIDGE] = (px, py, h) => {
    const [u, v] = uv(px, py);
    if ((v * 5) % 1 < 0.15) return 0x4a3420;
    return h < 0.12 ? 0x6a4a2e : 0x7a5a3a;
  };
  PAINT[T.FLOOR] = (px, py) => {
    const [u, v] = uv(px, py);
    return (Math.floor(u * 4) + Math.floor(v * 4)) % 2 ? 0x8a8070 : 0x7a7062;
  };

  let tiles = null;
  function build() {
    tiles = [];
    for (const key of Object.keys(PAINT)) {
      const t = +key;
      tiles[t] = [];
      for (let v = 0; v < VARIANTS; v++) {
        const c = UB.Vox.makeCanvas(TW, TH);
        const ctx = c.getContext('2d');
        const img = ctx.createImageData(TW, TH);
        const d = new Uint32Array(img.data.buffer);
        for (let py = 0; py < TH; py++) for (let px = 0; px < TW; px++) {
          if (!inside(px, py)) continue;
          const h = UB.hash3(px + v * 97, py * 3 + t * 31, 7), h2 = UB.hash3(px * 5 + t, py + v * 13, 11);
          let hex = PAINT[t](px, py, h, h2, v);
          // Grass tufts: a lighter pixel above a darker one.
          if (t === T.GRASS && h2 > 0.965 && py > 1) hex = 0x86b25e;
          const [r, g, b] = rgb(hex);
          d[py * TW + px] = (255 << 24) | (b << 16) | (g << 8) | r;
        }
        ctx.putImageData(img, 0, 0);
        tiles[t].push(c);
      }
    }
  }

  // Renders chunk (cx, cy) of the map into a canvas; returns {c, x, y} with the canvas's
  // world-screen position of its top-left corner.
  function drawChunk(S, cx, cy) {
    if (!tiles) build();
    const N = S.map.w, ter = S.map.terrain;
    const tx0 = cx * CH, ty0 = cy * CH;
    const ox = (tx0 - (ty0 + CH - 1)) * 16 - 16, oy = (tx0 + ty0) * 8;
    const w = (CH * 2) * 16, h = (CH * 2) * 8;
    const c = UB.Vox.makeCanvas(w, h);
    const ctx = c.getContext('2d');
    const at = (x, y) => (x < 0 || y < 0 || x >= N || y >= N ? -1 : ter[y * N + x]);
    for (let ty = ty0; ty < Math.min(N, ty0 + CH); ty++) for (let tx = tx0; tx < Math.min(N, tx0 + CH); tx++) {
      const t = ter[ty * N + tx];
      const v = Math.floor(UB.hash3(tx, ty, 99) * VARIANTS);
      const sx = (tx - ty) * 16 - 16 - ox, sy = (tx + ty) * 8 - oy;
      ctx.drawImage(tiles[t][v], sx, sy);
      if (t === T.ASPHALT) {
        // Centre-line dashes on two-lane roads.
        ctx.fillStyle = '#c8a83a';
        if (at(tx, ty + 1) === T.ASPHALT && at(tx, ty - 1) !== T.ASPHALT && at(tx, ty + 2) !== T.ASPHALT && tx % 2 === 0) {
          for (let k = 4; k < 12; k++) ctx.fillRect(sx + k, sy + 7 + (k >> 1), 1, 1);
        }
        if (at(tx + 1, ty) === T.ASPHALT && at(tx - 1, ty) !== T.ASPHALT && at(tx + 2, ty) !== T.ASPHALT && ty % 2 === 0) {
          for (let k = 4; k < 12; k++) ctx.fillRect(sx + 16 + k, sy + 15 - (k >> 1) - 1, 1, 1);
        }
      } else if (t === T.WATER) {
        // Foam where water meets land.
        ctx.fillStyle = 'rgba(170,210,230,0.55)';
        const land = (x, y) => { const q = at(x, y); return q >= 0 && q !== T.WATER; };
        if (land(tx - 1, ty)) for (let k = 0; k < 16; k += 2) ctx.fillRect(sx + k, sy + 8 - (k >> 1), 2, 1);
        if (land(tx, ty - 1)) for (let k = 0; k < 16; k += 2) ctx.fillRect(sx + 16 + k, sy + (k >> 1), 2, 1);
        if (land(tx + 1, ty)) for (let k = 0; k < 16; k += 2) ctx.fillRect(sx + 16 + k, sy + 15 - (k >> 1), 2, 1);
        if (land(tx, ty + 1)) for (let k = 0; k < 16; k += 2) ctx.fillRect(sx + k, sy + 8 + (k >> 1), 2, 1);
      }
    }
    return { c, x: ox, y: oy };
  }

  // Average colour per terrain, for the minimap.
  const MINI = {};
  MINI[T.GRASS] = 0x4e7a3a; MINI[T.DIRT] = 0x7a5a3c; MINI[T.ASPHALT] = 0x3c3f44; MINI[T.SIDEWALK] = 0x8a8882;
  MINI[T.CONCRETE] = 0x6c6c66; MINI[T.FOREST] = 0x3a5530; MINI[T.WATER] = 0x2a5878; MINI[T.RUBBLE] = 0x6a6158;
  MINI[T.FARM] = 0x6a5a2e; MINI[T.TOXIC] = 0x7a9a2a; MINI[T.BRIDGE] = 0x7a5a3a; MINI[T.FLOOR] = 0x8a8070;

  UB.Tiles = { build, drawChunk, CH, TW, TH, MINI, mixHex, get: () => tiles };
})(globalThis.UB = globalThis.UB || {});
