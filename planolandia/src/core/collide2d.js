/* Planolândia — colisão 2D na fatia: SAT entre a caixa do jogador (AABB) e polígonos convexos/círculos. */
(function (root) {
  'use strict';
  const PL = root.PL || (root.PL = {});
  const EPS = 1e-4;

  // projeta polígono em um eixo → [min, max] em pr
  const pr = [0, 0], pr2 = [0, 0];
  function projPoly(s, ax, ay, o) {
    const p = s.pts;
    let mn = Infinity, mx = -Infinity;
    for (let i = 0; i < s.n; i++) {
      const d = p[i * 2] * ax + p[i * 2 + 1] * ay;
      if (d < mn) mn = d; if (d > mx) mx = d;
    }
    o[0] = mn; o[1] = mx;
  }
  function projBox(cx, cy, hx, hy, ax, ay, o) {
    const c = cx * ax + cy * ay, e = hx * Math.abs(ax) + hy * Math.abs(ay);
    o[0] = c - e; o[1] = c + e;
  }

  // círculo → polígono temporário de 16 lados (para separação direcional)
  const circPoly = { type: 'poly', n: 16, pts: new Float64Array(32), cx: 0, cy: 0, minX: 0, minY: 0, maxX: 0, maxY: 0 };
  function polyOfCircle(s) {
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      circPoly.pts[i * 2] = s.cx + Math.cos(a) * s.r;
      circPoly.pts[i * 2 + 1] = s.cy + Math.sin(a) * s.r;
    }
    circPoly.cx = s.cx; circPoly.cy = s.cy;
    circPoly.minX = s.minX; circPoly.maxX = s.maxX; circPoly.minY = s.minY; circPoly.maxY = s.maxY;
    return circPoly;
  }

  function boundsOverlap(cx, cy, hx, hy, s) {
    return cx + hx > s.minX + EPS && cx - hx < s.maxX - EPS && cy + hy > s.minY + EPS && cy - hy < s.maxY - EPS;
  }

  // MTV para tirar a AABB (centro cx,cy; meias-medidas hx,hy) de dentro de s. out = {nx, ny, depth}
  function aabbShape(cx, cy, hx, hy, s, out) {
    if (!boundsOverlap(cx, cy, hx, hy, s)) return false;
    if (s.type === 'circle') return aabbCircle(cx, cy, hx, hy, s, out);
    let best = Infinity, bx = 0, by = 0;
    // eixos x e y
    for (let k = 0; k < 2; k++) {
      const ax = k === 0 ? 1 : 0, ay = k === 0 ? 0 : 1;
      projBox(cx, cy, hx, hy, ax, ay, pr);
      const pmn = k === 0 ? s.minX : s.minY, pmx = k === 0 ? s.maxX : s.maxY;
      const o = Math.min(pr[1] - pmn, pmx - pr[0]);
      if (o <= EPS) return false;
      if (o < best) { best = o; bx = ax; by = ay; }
    }
    const p = s.pts, n = s.n;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      let ax = p[j * 2 + 1] - p[i * 2 + 1], ay = -(p[j * 2] - p[i * 2]);
      const l = Math.hypot(ax, ay);
      if (l < 1e-9) continue;
      ax /= l; ay /= l;
      if (Math.abs(ax) > 0.99999 || Math.abs(ay) > 0.99999) continue; // já testados
      projBox(cx, cy, hx, hy, ax, ay, pr);
      projPoly(s, ax, ay, pr2);
      const o = Math.min(pr[1] - pr2[0], pr2[1] - pr[0]);
      if (o <= EPS) return false;
      if (o < best) { best = o; bx = ax; by = ay; }
    }
    // orienta do polígono para a caixa
    if ((cx - s.cx) * bx + (cy - s.cy) * by < 0) { bx = -bx; by = -by; }
    out.nx = bx; out.ny = by; out.depth = best;
    return true;
  }

  function aabbCircle(cx, cy, hx, hy, s, out) {
    const qx = Math.max(cx - hx, Math.min(s.cx, cx + hx));
    const qy = Math.max(cy - hy, Math.min(s.cy, cy + hy));
    const dx = qx - s.cx, dy = qy - s.cy, d2 = dx * dx + dy * dy;
    if (d2 > 1e-12) {
      if (d2 >= s.r * s.r - EPS) return false;
      const d = Math.sqrt(d2);
      out.nx = dx / d; out.ny = dy / d; out.depth = s.r - d;
      return true;
    }
    // centro do círculo dentro da caixa: empurra pelo lado mais curto
    const opts = [
      [1, 0, s.cx + s.r - (cx - hx)], [-1, 0, (cx + hx) - (s.cx - s.r)],
      [0, 1, s.cy + s.r - (cy - hy)], [0, -1, (cy + hy) - (s.cy - s.r)],
    ];
    let b = opts[0];
    for (const o of opts) if (o[2] < b[2]) b = o;
    out.nx = b[0]; out.ny = b[1]; out.depth = b[2];
    return true;
  }

  // distância t ≥ 0 ao longo de (dx,dy) (unitário) para a caixa deixar de sobrepor s; Infinity se impossível; 0 se não sobrepõe
  function aabbSepDir(cx, cy, hx, hy, s, dx, dy, out) {
    if (!boundsOverlap(cx, cy, hx, hy, s)) return 0;
    const poly = s.type === 'circle' ? polyOfCircle(s) : s;
    let best = Infinity, bx = 0, by = 0, overlapping = true;
    const p = poly.pts, n = poly.n;
    for (let i = -2; i < n; i++) {
      let ax, ay;
      if (i === -2) { ax = 1; ay = 0; } else if (i === -1) { ax = 0; ay = 1; } else {
        const j = (i + 1) % n;
        ax = p[j * 2 + 1] - p[i * 2 + 1]; ay = -(p[j * 2] - p[i * 2]);
        const l = Math.hypot(ax, ay);
        if (l < 1e-9) continue;
        ax /= l; ay /= l;
      }
      projBox(cx, cy, hx, hy, ax, ay, pr);
      projPoly(poly, ax, ay, pr2);
      if (pr[1] - pr2[0] <= EPS || pr2[1] - pr[0] <= EPS) { overlapping = false; break; }
      const k = ax * dx + ay * dy;
      let t;
      if (k > 1e-6) t = (pr2[1] - pr[0]) / k;
      else if (k < -1e-6) t = (pr2[0] - pr[1]) / k;
      else continue;
      if (t < best) {
        best = t;
        // normal da superfície empurrando no sentido de (dx,dy)
        bx = k > 0 ? ax : -ax; by = k > 0 ? ay : -ay;
      }
    }
    if (!overlapping) return 0;
    if (out) { out.nx = bx; out.ny = by; }
    return best;
  }

  // ---------- testes gerais entre formas ----------
  function overlapPolyPoly(a, b) {
    for (let pass = 0; pass < 2; pass++) {
      const s = pass ? b : a, p = s.pts, n = s.n;
      for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        const ax = p[j * 2 + 1] - p[i * 2 + 1], ay = -(p[j * 2] - p[i * 2]);
        projPoly(a, ax, ay, pr); projPoly(b, ax, ay, pr2);
        if (pr[1] <= pr2[0] + EPS || pr2[1] <= pr[0] + EPS) return false;
      }
    }
    return true;
  }
  function overlapPolyCircle(a, c) {
    const p = a.pts, n = a.n;
    // eixo do vértice mais próximo
    let bd = Infinity, vx = 0, vy = 0;
    for (let i = 0; i < n; i++) {
      const dx = p[i * 2] - c.cx, dy = p[i * 2 + 1] - c.cy, d = dx * dx + dy * dy;
      if (d < bd) { bd = d; vx = dx; vy = dy; }
    }
    const axes = [];
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      axes.push(p[j * 2 + 1] - p[i * 2 + 1], -(p[j * 2] - p[i * 2]));
    }
    axes.push(vx, vy);
    for (let k = 0; k < axes.length; k += 2) {
      let ax = axes[k], ay = axes[k + 1];
      const l = Math.hypot(ax, ay);
      if (l < 1e-9) continue;
      ax /= l; ay /= l;
      projPoly(a, ax, ay, pr);
      const cc = c.cx * ax + c.cy * ay;
      if (pr[1] <= cc - c.r + EPS || cc + c.r <= pr[0] + EPS) return false;
    }
    return true;
  }
  function overlap(a, b) {
    if (a.maxX <= b.minX || b.maxX <= a.minX || a.maxY <= b.minY || b.maxY <= a.minY) return false;
    if (a.type === 'circle' && b.type === 'circle') {
      const dx = a.cx - b.cx, dy = a.cy - b.cy, r = a.r + b.r;
      return dx * dx + dy * dy < r * r;
    }
    if (a.type === 'circle') return overlapPolyCircle(b, a);
    if (b.type === 'circle') return overlapPolyCircle(a, b);
    return overlapPolyPoly(a, b);
  }

  function pointIn(x, y, s) {
    if (x < s.minX || x > s.maxX || y < s.minY || y > s.maxY) return false;
    if (s.type === 'circle') { const dx = x - s.cx, dy = y - s.cy; return dx * dx + dy * dy <= s.r * s.r; }
    const p = s.pts, n = s.n;
    let sign = 0;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const c = (p[j * 2] - p[i * 2]) * (y - p[i * 2 + 1]) - (p[j * 2 + 1] - p[i * 2 + 1]) * (x - p[i * 2]);
      if (Math.abs(c) < 1e-9) continue;
      const sg = c > 0 ? 1 : -1;
      if (sign === 0) sign = sg; else if (sg !== sign) return false;
    }
    return true;
  }

  PL.C2 = { aabbShape, aabbSepDir, overlap, pointIn, boundsOverlap };

  if (typeof module !== 'undefined' && module.exports) module.exports = PL;
})(typeof globalThis !== 'undefined' ? globalThis : this);
