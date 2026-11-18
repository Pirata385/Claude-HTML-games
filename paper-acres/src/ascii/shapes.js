/* Shape features of a vector sketch and a ranking of the words that fit it. */
(function (root) {
  'use strict';
  const PA = root.PA = root.PA || {};
  function features(strokes) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity, L = 0, H = 0, V = 0, D = 0, hSeg = 0, vSeg = 0;
    let closed = false, round = 0;
    for (const st of strokes) {
      let sl = 0, area = 0;
      for (let i = 0; i < st.length; i++) {
        const p = st[i];
        x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y);
        if (!i) continue;
        const q = st[i - 1], dx = p.x - q.x, dy = p.y - q.y, l = Math.hypot(dx, dy);
        sl += l; area += q.x * p.y - p.x * q.y;
        const a = Math.abs(Math.atan2(dy, dx)) * 180 / Math.PI, d = a > 90 ? 180 - a : a;
        if (d < 22.5) H += l; else if (d > 67.5) V += l; else D += l;
      }
      L += sl;
      // whole-stroke direction for counting rungs / rails
      const f = st[0], e = st[st.length - 1];
      if (st.length >= 2) {
        const a = Math.abs(Math.atan2(e.y - f.y, e.x - f.x)) * 180 / Math.PI, d = a > 90 ? 180 - a : a;
        if (d < 25) hSeg++; else if (d > 65) vSeg++;
      }
      if (st.length >= 4 && sl > 30 && Math.hypot(e.x - f.x, e.y - f.y) < sl * 0.12) {
        closed = true;
        const A = Math.abs(area) / 2, circ = 4 * Math.PI * A / (sl * sl);
        round = Math.max(round, circ);
      }
    }
    const w = Math.max(8, x1 - x0), h = Math.max(8, y1 - y0);
    const tot = Math.max(1e-6, H + V + D);
    return { w, h, aspect: w / h, L, H: H / tot, V: V / tot, D: D / tot, closed, round, hSeg, vSeg, strokes: strokes.length };
  }
  function score(f, w) {
    let s = 0;
    const [lo, hi] = w.aspect;
    if (f.aspect >= lo && f.aspect <= hi) s += 2;
    else s -= Math.min(2.5, Math.abs(Math.log(f.aspect < lo ? lo / f.aspect : f.aspect / hi)));
    const boxy = f.closed && f.round < 0.88 && f.H + f.V > 0.7;
    switch (w.dom) {
      case 'h': s += 2.2 * f.H; break;
      case 'v': s += 2.2 * f.V; break;
      case 'd': s += 2.2 * f.D; break;
      case 'round': s += f.closed ? 3.2 * f.round : -1; break;
      case 'box': s += boxy ? 2.6 : f.H + f.V > 0.8 ? 0.6 : -0.5; break;
      default: s += 0.4;
    }
    if (w.closed === true && !f.closed) s -= 1.5;
    if (w.closed === false && f.closed) s -= 0.8;
    if (w.rungs) s += (f.hSeg >= 2 && f.vSeg >= 2) ? 2.2 : -0.6;
    return s;
  }
  function rank(f, ids) {
    const list = ids.map((id) => PA.Words.get(id)).filter(Boolean).map((w, i) => ({ id: w.id, score: score(f, w), i }));
    list.sort((a, b) => b.score - a.score || a.i - b.i);
    return list;
  }
  PA.Shapes = { features, rank, score };
  if (typeof module !== 'undefined' && module.exports) module.exports = PA.Shapes;
})(typeof window !== 'undefined' ? window : globalThis);
