/* ASCII matcher: a screen cell is sampled as a 4x6 binary pattern (bit = row*4 + col) and mapped to the
 * nearest character template by Hamming distance. Templates are generated from simple vector shapes in a
 * 12x20 px cell, so the table is pure and testable. Results are memoised per pattern. */
(function (root) {
  'use strict';
  const PA = root.PA = root.PA || {};
  const SX = 4, SY = 6, CW = 12, CH = 20;
  const sx = (c) => (c + 0.5) * (CW / SX), sy = (r) => (r + 0.5) * (CH / SY);

  function bitsFrom(test) {
    let k = 0;
    for (let r = 0; r < SY; r++) for (let c = 0; c < SX; c++) if (test(sx(c), sy(r))) k |= 1 << (r * SX + c);
    return k >>> 0;
  }
  function segDist(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1, dy = y2 - y1, l2 = dx * dx + dy * dy;
    let t = l2 ? ((px - x1) * dx + (py - y1) * dy) / l2 : 0;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    return Math.hypot(px - (x1 + dx * t), py - (y1 + dy * t));
  }
  const line = (x1, y1, x2, y2, w = 1.75) => bitsFrom((x, y) => segDist(x, y, x1, y1, x2, y2) <= w);
  const lines = (segs, w) => segs.reduce((k, s) => (k | line(s[0], s[1], s[2], s[3], w)) >>> 0, 0);
  const ring = (cx, cy, rx, ry, tol = 0.24) => bitsFrom((x, y) => Math.abs(Math.hypot((x - cx) / rx, (y - cy) / ry) - 1) < tol);
  const dot = (cx, cy, r = 1.7) => bitsFrom((x, y) => Math.hypot(x - cx, y - cy) <= r);

  const T = []; // [key, char]
  const add = (k, ch) => { if (k) T.push([k >>> 0, ch]); };

  // straight strokes at many angles and offsets
  for (let deg = 0; deg < 180; deg += 6) {
    const a = deg * Math.PI / 180, dx = Math.cos(a), dy = Math.sin(a);
    for (let off = -9; off <= 9; off += 1.5) {
      const cx = CW / 2 - dy * off, cy = CH / 2 + dx * off;
      for (const len of [30, 14]) {
        for (const shift of len === 30 ? [0] : [-6, 6]) {
          const mx = cx + dx * shift, my = cy + dy * shift;
          const k = line(mx - dx * len / 2, my - dy * len / 2, mx + dx * len / 2, my + dy * len / 2);
          if (!k) continue;
          let ch;
          const d = deg > 90 ? 180 - deg : deg; // 0 = horizontal, 90 = vertical
          if (d < 24) ch = cy > CH * 0.72 ? '_' : '-';
          else if (d > 68) ch = '|';
          else ch = deg < 90 ? '\\' : '/'; // y grows downward: 0..90 goes down-right
          add(k, ch);
        }
      }
    }
  }
  // dots and short marks
  for (let r = 0; r < SY; r++) for (let c = 0; c < SX; c++) add(1 << (r * SX + c), r <= 1 ? "'" : '.');
  add(dot(6, 6) | dot(6, 15), ':');
  add(dot(4.5, 5) | dot(4.5, 15), ':');
  add(dot(6, 16) | dot(4, 19), ',');
  // shapes
  add(ring(6, 13.3, 4.5, 5), 'o');
  add(ring(6, 12, 4.5, 4.4), 'o');
  add(ring(6, 10, 4.6, 8), 'O');
  add(ring(6, 10, 4.2, 7), 'O');
  for (const hy of [8.33, 11.67]) for (const vx of [4.5, 7.5]) add(line(0, hy, 12, hy) | line(vx, 0, vx, 20), '+');
  for (const hy of [8.33, 11.67]) for (const vx of [4.5, 7.5]) add(line(1.5, hy, 10.5, hy) | line(vx, 4, vx, 16), '+');
  add(lines([[0, 2, 12, 18], [12, 2, 0, 18]]), 'x');
  add(lines([[1, 6, 11, 18], [11, 6, 1, 18]]), 'x');
  add(lines([[0, 5, 12, 5], [0, 15, 12, 15]]), '=');
  add(lines([[0, 8.3, 12, 8.3], [0, 15, 12, 15]]), '=');
  add(lines([[0, 14, 6, 4], [6, 4, 12, 14]]), '^');
  add(lines([[0, 6, 6, 16], [6, 16, 12, 6]]), 'v');
  add(lines([[11, 3, 1, 10], [1, 10, 11, 17]]), '<');
  add(lines([[1, 3, 11, 10], [11, 10, 1, 17]]), '>');
  add(bitsFrom((x, y) => Math.abs(Math.hypot((x - 12) / 8, (y - 10) / 9.5) - 1) < 0.22), '(');
  add(bitsFrom((x, y) => Math.abs(Math.hypot((x - 0) / 8, (y - 10) / 9.5) - 1) < 0.22), ')');
  add(bitsFrom((x, y) => Math.abs(y - (10 + Math.sin(x / 12 * Math.PI * 2) * 2.5)) < 1.8), '~');
  add(lines([[6, 4, 6, 16], [1, 10, 11, 10], [2, 5, 10, 15], [10, 5, 2, 15]], 1.4), '*');
  add(lines([[2.5, 0, 2.5, 20], [9.5, 0, 9.5, 20], [2.5, 10, 9.5, 10]]), 'H');
  add(lines([[1.5, 0, 1.5, 20], [10.5, 0, 10.5, 20], [1.5, 10, 10.5, 10]]), 'H');
  add(0xFFFFFF, '#');
  add(0xFFFFFF & ~0x000009, '#');

  const FULL = (1 << (SX * SY)) - 1;
  function popcount(v) { v = v - ((v >>> 1) & 0x55555555); v = (v & 0x33333333) + ((v >>> 2) & 0x33333333); return (((v + (v >>> 4)) & 0x0F0F0F0F) * 0x01010101) >>> 24; }
  const memo = new Map();

  function classify(key) {
    key = key >>> 0;
    if (key === 0) return ' ';
    let m = memo.get(key);
    if (m !== undefined) return m;
    const n = popcount(key);
    if (n >= 18) m = '#';
    else {
      let best = ' ', bd = n; // distance to blank
      for (let i = 0; i < T.length; i++) {
        const d = popcount(key ^ T[i][0]);
        if (d < bd) { bd = d; best = T[i][1]; if (d === 0) break; }
      }
      m = best;
    }
    memo.set(key, m);
    return m;
  }

  function keyFromRows(rows) {
    let k = 0;
    for (let r = 0; r < SY; r++) for (let c = 0; c < SX; c++) if (rows[r][c] === '#') k |= 1 << (r * SX + c);
    return k >>> 0;
  }

  PA.Matcher = { SX, SY, FULL, classify, keyFromRows, popcount, templates: T, cacheSize: () => memo.size };
  if (typeof module !== 'undefined' && module.exports) module.exports = PA.Matcher;
})(typeof window !== 'undefined' ? window : globalThis);
