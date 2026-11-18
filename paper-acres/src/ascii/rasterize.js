/* Turns vector strokes / segments into ASCII cells.
 * Coordinates are in cell units: cell (c, r) covers [c, c+1) x [r, r+1); y grows downward. */
(function (root) {
  'use strict';
  const PA = root.PA = root.PA || {};
  const STEP = 0.2;
  const H = 0, BS = 1, V = 2, FS = 3; // bins: '-', '\', '|', '/'
  const PI8 = Math.PI / 8;

  function binOf(dx, dy) {
    let a = Math.atan2(dy, dx);
    if (a < 0) a += Math.PI;
    if (a >= Math.PI) a -= Math.PI;
    if (a < PI8 || a >= 7 * PI8) return H;
    if (a < 3 * PI8) return BS;
    if (a < 5 * PI8) return V;
    return FS;
  }

  function makeAcc(cols, rows) {
    const n = cols * rows;
    return { cols, rows, cnt: new Uint16Array(n * 4), sy: new Float32Array(n * 4), total: new Uint16Array(n), fixed: new Array(n).fill(null) };
  }

  function addSample(acc, x, y, bin) {
    const c = Math.floor(x), r = Math.floor(y);
    if (c < 0 || r < 0 || c >= acc.cols || r >= acc.rows) return;
    const i = r * acc.cols + c;
    acc.cnt[i * 4 + bin]++;
    acc.sy[i * 4 + bin] += y - r;
    acc.total[i]++;
  }

  function addSegment(acc, x1, y1, x2, y2) {
    const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy);
    if (len < 1e-6) return;
    const bin = binOf(dx, dy);
    const n = Math.max(1, Math.ceil(len / STEP));
    // Skip the very first point so joints between segments are not double counted.
    for (let k = 1; k <= n; k++) addSample(acc, x1 + dx * k / n, y1 + dy * k / n, bin);
  }

  function charFor(acc, i) {
    if (acc.fixed[i]) return acc.fixed[i];
    const tot = acc.total[i];
    if (tot < 2) return ' ';
    const b = i * 4;
    let max = 0;
    for (let k = 0; k < 4; k++) max = Math.max(max, acc.cnt[b + k]);
    const sig = [];
    for (let k = 0; k < 4; k++) { const c = acc.cnt[b + k]; if (c >= 2 && c >= max * 0.3) sig.push(k); }
    if (sig.length === 0) return ' ';
    if (sig.length >= 3) return '#';
    const meanY = (k) => acc.sy[b + k] / Math.max(1, acc.cnt[b + k]);
    if (sig.length === 1) {
      const k = sig[0];
      if (k === H) return meanY(H) > 0.72 ? '_' : '-';
      if (k === V) return '|';
      if (k === FS) return '/';
      return '\\';
    }
    const has = (k) => sig.includes(k);
    if (has(H) && has(V)) {
      const d = meanY(V) - meanY(H);
      if (d > 0.15) return '.';
      if (d < -0.15) return "'";
      return '+';
    }
    if (has(FS) && has(BS)) return 'x';
    if (has(H) && (has(FS) || has(BS))) return max === acc.cnt[b + H] ? '-' : (has(FS) ? '/' : '\\');
    // vertical with a diagonal
    return max === acc.cnt[b + V] ? '|' : (has(FS) ? '/' : '\\');
  }

  function finish(acc) {
    const out = [];
    for (let r = 0; r < acc.rows; r++) {
      let s = '';
      for (let c = 0; c < acc.cols; c++) s += charFor(acc, r * acc.cols + c);
      out.push(s);
    }
    return out;
  }

  function strokeInfo(st) {
    let len = 0, x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (let i = 0; i < st.length; i++) {
      const p = st[i];
      if (p.x < x0) x0 = p.x; if (p.y < y0) y0 = p.y; if (p.x > x1) x1 = p.x; if (p.y > y1) y1 = p.y;
      if (i) len += Math.hypot(p.x - st[i - 1].x, p.y - st[i - 1].y);
    }
    const first = st[0], last = st[st.length - 1];
    const closed = st.length >= 4 && Math.hypot(first.x - last.x, first.y - last.y) < 0.5 && len > 1.2;
    return { len, x0, y0, x1, y1, closed };
  }

  /** strokes: array of arrays of {x,y}; fills: optional [{c, r, ch}] for empty cells. */
  function strokesToCells(strokes, cols, rows, fills) {
    const acc = makeAcc(cols, rows);
    for (const st of strokes) {
      if (!st || !st.length) continue;
      const info = strokeInfo(st);
      const cx = (info.x0 + info.x1) / 2, cy = (info.y0 + info.y1) / 2;
      const c = Math.floor(cx), r = Math.floor(cy);
      const inside = c >= 0 && r >= 0 && c < cols && r < rows;
      if (info.len < 0.35) { if (inside) acc.fixed[r * cols + c] = acc.fixed[r * cols + c] || '.'; continue; }
      const size = Math.max(info.x1 - info.x0, info.y1 - info.y0);
      if (info.closed && size < 1.2) { if (inside) acc.fixed[r * cols + c] = 'o'; continue; }
      if (info.closed && size < 2) { if (inside) acc.fixed[r * cols + c] = 'O'; continue; }
      for (let i = 1; i < st.length; i++) addSegment(acc, st[i - 1].x, st[i - 1].y, st[i].x, st[i].y);
    }
    const out = finish(acc);
    if (fills && fills.length) {
      for (const f of fills) {
        if (f.r < 0 || f.r >= rows || f.c < 0 || f.c >= cols) continue;
        const row = out[f.r];
        if (row[f.c] === ' ') out[f.r] = row.slice(0, f.c) + f.ch + row.slice(f.c + 1);
      }
    }
    return out;
  }

  function segmentsToCells(segs, cols, rows) {
    const acc = makeAcc(cols, rows);
    for (const s of segs) addSegment(acc, s.x1, s.y1, s.x2, s.y2);
    return finish(acc);
  }

  /** Count non-space cells. */
  function filled(rows) { let n = 0; for (const r of rows) for (const ch of r) if (ch !== ' ') n++; return n; }

  /** Trim empty border rows/cols; returns {rows, ox, oy}. */
  function trim(rows) {
    let top = 0, bot = rows.length - 1, left = Infinity, right = -1;
    while (top <= bot && !rows[top].trim()) top++;
    while (bot >= top && !rows[bot].trim()) bot--;
    if (top > bot) return { rows: [], ox: 0, oy: 0 };
    for (let r = top; r <= bot; r++) {
      const row = rows[r];
      const l = row.search(/\S/); if (l >= 0 && l < left) left = l;
      const rr = row.length - 1 - row.split('').reverse().join('').search(/\S/);
      if (row.trim() && rr > right) right = rr;
    }
    const out = [];
    for (let r = top; r <= bot; r++) out.push(rows[r].slice(left, right + 1).padEnd(right - left + 1, ' '));
    return { rows: out, ox: left, oy: top };
  }

  PA.Rasterize = { strokesToCells, segmentsToCells, filled, trim, binOf };
  if (typeof module !== 'undefined' && module.exports) module.exports = PA.Rasterize;
})(typeof window !== 'undefined' ? window : globalThis);
