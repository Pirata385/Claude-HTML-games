/* Planolândia — sólidos 3D e seus cortes pelo plano z = constante.
 * O mundo é 3D de verdade; o Quadrado só enxerga a fatia em z = jogador.z.
 * Sistema: x → direita, y → baixo, z → para dentro da tela ("frente").
 * Todos os cortes resultam em polígonos convexos ou círculos. */
(function (root) {
  'use strict';
  const PL = root.PL || (root.PL = {});

  function newShape(cap) {
    cap = cap || 24;
    return { type: 'poly', n: 0, pts: new Float64Array(cap * 2), cx: 0, cy: 0, r: 0, minX: 0, minY: 0, maxX: 0, maxY: 0 };
  }

  function ensureCap(s, n) {
    if (s.pts.length < n * 2) s.pts = new Float64Array(n * 2 + 16);
  }

  function finishPoly(s) {
    const p = s.pts;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity, sx = 0, sy = 0;
    for (let i = 0; i < s.n; i++) {
      const x = p[i * 2], y = p[i * 2 + 1];
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
      sx += x; sy += y;
    }
    s.type = 'poly';
    s.minX = minX; s.minY = minY; s.maxX = maxX; s.maxY = maxY;
    s.cx = sx / s.n; s.cy = sy / s.n;
    return s;
  }

  function setRect(s, x0, y0, x1, y1) {
    ensureCap(s, 4);
    const p = s.pts;
    p[0] = x0; p[1] = y0; p[2] = x1; p[3] = y0; p[4] = x1; p[5] = y1; p[6] = x0; p[7] = y1;
    s.n = 4;
    s.type = 'poly';
    s.minX = x0; s.minY = y0; s.maxX = x1; s.maxY = y1;
    s.cx = (x0 + x1) / 2; s.cy = (y0 + y1) / 2;
    return s;
  }

  function setCircle(s, x, y, r) {
    s.type = 'circle';
    s.n = 0;
    s.cx = x; s.cy = y; s.r = r;
    s.minX = x - r; s.maxX = x + r; s.minY = y - r; s.maxY = y + r;
    return s;
  }

  // ---------- fecho convexo (cadeia monótona de Andrew) ----------
  const tmpX = new Float64Array(256), tmpY = new Float64Array(256), idx = new Int32Array(256), hullI = new Int32Array(512);
  function cross(o, a, b) {
    return (tmpX[a] - tmpX[o]) * (tmpY[b] - tmpY[o]) - (tmpY[a] - tmpY[o]) * (tmpX[b] - tmpX[o]);
  }
  function hullInto(count, s) {
    if (count < 3) return false;
    for (let i = 0; i < count; i++) idx[i] = i;
    // ordenação por inserção (poucos pontos)
    for (let i = 1; i < count; i++) {
      const v = idx[i];
      let j = i - 1;
      while (j >= 0 && (tmpX[idx[j]] > tmpX[v] || (tmpX[idx[j]] === tmpX[v] && tmpY[idx[j]] > tmpY[v]))) { idx[j + 1] = idx[j]; j--; }
      idx[j + 1] = v;
    }
    let k = 0;
    for (let i = 0; i < count; i++) {
      while (k >= 2 && cross(hullI[k - 2], hullI[k - 1], idx[i]) <= 1e-9) k--;
      hullI[k++] = idx[i];
    }
    for (let i = count - 2, t = k + 1; i >= 0; i--) {
      while (k >= t && cross(hullI[k - 2], hullI[k - 1], idx[i]) <= 1e-9) k--;
      hullI[k++] = idx[i];
    }
    const n = k - 1;
    if (n < 3) return false;
    ensureCap(s, n);
    for (let i = 0; i < n; i++) { s.pts[i * 2] = tmpX[hullI[i]]; s.pts[i * 2 + 1] = tmpY[hullI[i]]; }
    s.n = n;
    finishPoly(s);
    return (s.maxX - s.minX) > 1e-6 && (s.maxY - s.minY) > 1e-6;
  }

  // ---------- rotações ----------
  function mul3(a, b) {
    const o = new Array(9);
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
      o[r * 3 + c] = a[r * 3] * b[c] + a[r * 3 + 1] * b[3 + c] + a[r * 3 + 2] * b[6 + c];
    }
    return o;
  }
  function rotMatrix(yaw, pitch, roll) {
    const cy = Math.cos(yaw || 0), sy = Math.sin(yaw || 0);
    const cp = Math.cos(pitch || 0), sp = Math.sin(pitch || 0);
    const cr = Math.cos(roll || 0), sr = Math.sin(roll || 0);
    const Ry = [cy, 0, sy, 0, 1, 0, -sy, 0, cy];
    const Rx = [1, 0, 0, 0, cp, -sp, 0, sp, cp];
    const Rz = [cr, -sr, 0, sr, cr, 0, 0, 0, 1];
    return mul3(mul3(Ry, Rx), Rz);
  }
  // rotação que leva a diagonal principal (1,1,1) do cubo ao eixo z
  function diagRot() {
    const a = 1 / Math.SQRT2, b = 1 / Math.sqrt(6), c = 1 / Math.sqrt(3);
    return [a, -a, 0, b, b, -2 * b, c, c, c];
  }
  function toMatrix(rot) {
    if (!rot) return null;
    if (Array.isArray(rot) || rot.length === 9) return rot;
    return rotMatrix(rot.yaw, rot.pitch, rot.roll);
  }

  // ---------- criação de primitivos ----------
  function base(kind, opts) {
    const p = { kind, zMin: 0, zMax: 0, xMin: 0, xMax: 0, yMin: 0, yMax: 0, solid: true, mat: 'pedra', _s: newShape() };
    if (opts) for (const k in opts) p[k] = opts[k];
    return p;
  }

  function prism(pts, z0, z1, opts) {
    const p = base('prism', opts);
    p.pts = Float64Array.from(pts);
    p.zMin = Math.min(z0, z1); p.zMax = Math.max(z0, z1);
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (let i = 0; i < pts.length; i += 2) {
      minX = Math.min(minX, pts[i]); maxX = Math.max(maxX, pts[i]);
      minY = Math.min(minY, pts[i + 1]); maxY = Math.max(maxY, pts[i + 1]);
    }
    p.xMin = minX; p.xMax = maxX; p.yMin = minY; p.yMax = maxY;
    return p;
  }

  // caixa alinhada aos eixos: canto superior esquerdo (x,y), largura w, altura h, de z0 a z1
  function box(x, y, w, h, z0, z1, opts) {
    const p = prism([x, y, x + w, y, x + w, y + h, x, y + h], z0, z1, opts);
    p.rect = true;
    return p;
  }

  // retângulo A em zA que vira retângulo B em zB (plataformas que sobem, descem ou deslizam com a profundidade)
  function loft(a, zA, b, zB, opts) {
    const p = base('loft', opts);
    if (zA > zB) { const t = a; a = b; b = t; const tz = zA; zA = zB; zB = tz; }
    p.a = a.slice(); p.b = b.slice(); p.zA = zA; p.zB = zB;
    p.zMin = zA; p.zMax = zB;
    p.xMin = Math.min(a[0], b[0]); p.xMax = Math.max(a[2], b[2]);
    p.yMin = Math.min(a[1], b[1]); p.yMax = Math.max(a[3], b[3]);
    return p;
  }

  function hullFrom(verts, opts) {
    const p = base('hull', opts);
    p.verts = Float64Array.from(verts);
    p.nv = verts.length / 3;
    hullBounds(p);
    return p;
  }

  function hullBounds(p) {
    const v = p.verts;
    let a = Infinity, b = -Infinity, c = Infinity, d = -Infinity, e = Infinity, f = -Infinity;
    for (let i = 0; i < p.nv; i++) {
      const x = v[i * 3], y = v[i * 3 + 1], z = v[i * 3 + 2];
      if (x < a) a = x; if (x > b) b = x;
      if (y < c) c = y; if (y > d) d = y;
      if (z < e) e = z; if (z > f) f = z;
    }
    p.xMin = a; p.xMax = b; p.yMin = c; p.yMax = d; p.zMin = e; p.zMax = f;
  }

  function cuboidVerts(w, h, d) {
    const x = w / 2, y = h / 2, z = d / 2;
    return [-x, -y, -z, x, -y, -z, x, y, -z, -x, y, -z, -x, -y, z, x, -y, z, x, y, z, -x, y, z];
  }

  function transformInto(out, baseV, m, tx, ty, tz) {
    for (let i = 0; i < baseV.length; i += 3) {
      const x = baseV[i], y = baseV[i + 1], z = baseV[i + 2];
      if (m) {
        out[i] = m[0] * x + m[1] * y + m[2] * z + tx;
        out[i + 1] = m[3] * x + m[4] * y + m[5] * z + ty;
        out[i + 2] = m[6] * x + m[7] * y + m[8] * z + tz;
      } else { out[i] = x + tx; out[i + 1] = y + ty; out[i + 2] = z + tz; }
    }
    return out;
  }

  // paralelepípedo centrado em (cx,cy,cz) com rotação opcional {yaw,pitch,roll} ou matriz 3×3
  function cuboid(cx, cy, cz, w, h, d, rot, opts) {
    const bv = cuboidVerts(w, h, d);
    const v = transformInto(new Array(24), bv, toMatrix(rot), cx, cy, cz);
    const p = hullFrom(v, opts);
    p.size = [w, h, d];
    return p;
  }

  // atualiza um sólido convexo dinâmico (vértices de base, matriz e translação)
  function setHull(p, baseV, m, tx, ty, tz) {
    if (!p.verts || p.verts.length !== baseV.length) { p.verts = new Float64Array(baseV.length); p.nv = baseV.length / 3; }
    transformInto(p.verts, baseV, m, tx, ty, tz);
    hullBounds(p);
    return p;
  }

  // pirâmide de base retangular apoiada em y = yBase, ponta para cima
  function pyramid(cx, yBase, cz, w, d, h, opts) {
    const x = w / 2, z = d / 2;
    return hullFrom([cx - x, yBase, cz - z, cx + x, yBase, cz - z, cx + x, yBase, cz + z, cx - x, yBase, cz + z, cx, yBase - h, cz], opts);
  }

  // haste: cuboide fino entre dois pontos 3D (pode atravessar o plano na diagonal)
  function rod(x0, y0, z0, x1, y1, z1, thick, opts) {
    const dx = x1 - x0, dy = y1 - y0, dz = z1 - z0;
    const len = Math.hypot(dx, dy, dz) || 1;
    const ux = dx / len, uy = dy / len, uz = dz / len;
    // base ortonormal (u, v, w)
    let vx = -uy, vy = ux, vz = 0;
    if (Math.abs(uz) > 0.9) { vx = 1; vy = 0; vz = 0; }
    let vl = Math.hypot(vx, vy, vz); vx /= vl; vy /= vl; vz /= vl;
    const wx = uy * vz - uz * vy, wy = uz * vx - ux * vz, wz = ux * vy - uy * vx;
    const t = thick / 2, verts = [];
    for (const s of [0, 1]) for (const a of [-1, 1]) for (const b of [-1, 1]) {
      const bx = s ? x1 : x0, by = s ? y1 : y0, bz = s ? z1 : z0;
      verts.push(bx + (vx * a + wx * b) * t, by + (vy * a + wy * b) * t, bz + (vz * a + wz * b) * t);
    }
    return hullFrom(verts, opts);
  }

  function sphere(cx, cy, cz, r, opts) {
    const p = base('sphere', opts);
    p.cx = cx; p.cy = cy; p.cz = cz; p.r = r;
    p.xMin = cx - r; p.xMax = cx + r; p.yMin = cy - r; p.yMax = cy + r; p.zMin = cz - r; p.zMax = cz + r;
    return p;
  }

  // cilindro com eixo 'x', 'y' ou 'z'; hl = metade do comprimento
  function cyl(axis, cx, cy, cz, r, hl, opts) {
    const p = base('cyl', opts);
    p.axis = axis; p.cx = cx; p.cy = cy; p.cz = cz; p.r = r; p.hl = hl;
    p.xMin = cx - (axis === 'x' ? hl : r); p.xMax = cx + (axis === 'x' ? hl : r);
    p.yMin = cy - (axis === 'y' ? hl : r); p.yMax = cy + (axis === 'y' ? hl : r);
    p.zMin = cz - (axis === 'z' ? hl : r); p.zMax = cz + (axis === 'z' ? hl : r);
    return p;
  }

  // cone: base circular de raio r centrada em (cx,cy,cz); ponta a distância h ao longo do eixo, no sentido dir (±1)
  function cone(axis, cx, cy, cz, r, h, dir, opts) {
    const p = base('cone', opts);
    p.axis = axis; p.cx = cx; p.cy = cy; p.cz = cz; p.r = r; p.h = h; p.dir = dir || 1;
    if (axis === 'z') {
      p.xMin = cx - r; p.xMax = cx + r; p.yMin = cy - r; p.yMax = cy + r;
      p.zMin = Math.min(cz, cz + p.dir * h); p.zMax = Math.max(cz, cz + p.dir * h);
    } else {
      p.xMin = cx - r; p.xMax = cx + r; p.zMin = cz - r; p.zMax = cz + r;
      p.yMin = Math.min(cy, cy + p.dir * h); p.yMax = Math.max(cy, cy + p.dir * h);
    }
    return p;
  }

  // ---------- corte ----------
  function sliceInto(p, z, s) {
    if (z < p.zMin || z > p.zMax) return false;
    switch (p.kind) {
      case 'prism': {
        const n = p.pts.length / 2;
        if (p.rect) { setRect(s, p.xMin, p.yMin, p.xMax, p.yMax); return true; }
        ensureCap(s, n);
        for (let i = 0; i < p.pts.length; i++) s.pts[i] = p.pts[i];
        s.n = n;
        finishPoly(s);
        return true;
      }
      case 'loft': {
        const t = p.zB === p.zA ? 0 : (z - p.zA) / (p.zB - p.zA), a = p.a, b = p.b;
        setRect(s, a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t, a[3] + (b[3] - a[3]) * t);
        return true;
      }
      case 'hull': {
        const v = p.verts, nv = p.nv;
        let c = 0;
        for (let i = 0; i < nv; i++) {
          const zi = v[i * 3 + 2];
          for (let j = i + 1; j < nv; j++) {
            const zj = v[j * 3 + 2];
            const di = zi - z, dj = zj - z;
            if (di * dj > 0) continue;
            if (di === 0 && dj === 0) {
              tmpX[c] = v[i * 3]; tmpY[c++] = v[i * 3 + 1];
              tmpX[c] = v[j * 3]; tmpY[c++] = v[j * 3 + 1];
            } else {
              const t = di / (di - dj);
              tmpX[c] = v[i * 3] + (v[j * 3] - v[i * 3]) * t;
              tmpY[c++] = v[i * 3 + 1] + (v[j * 3 + 1] - v[i * 3 + 1]) * t;
            }
            if (c > 250) break;
          }
        }
        return hullInto(c, s);
      }
      case 'sphere': {
        const dz = z - p.cz, rr = p.r * p.r - dz * dz;
        if (rr <= 0.25) return false;
        setCircle(s, p.cx, p.cy, Math.sqrt(rr));
        return true;
      }
      case 'cyl': {
        if (p.axis === 'z') { setCircle(s, p.cx, p.cy, p.r); return true; }
        const dz = z - p.cz, rr = p.r * p.r - dz * dz;
        if (rr <= 0.25) return false;
        const hr = Math.sqrt(rr);
        if (p.axis === 'x') setRect(s, p.cx - p.hl, p.cy - hr, p.cx + p.hl, p.cy + hr);
        else setRect(s, p.cx - hr, p.cy - p.hl, p.cx + hr, p.cy + p.hl);
        return true;
      }
      case 'cone': {
        if (p.axis === 'z') {
          const t = ((z - p.cz) * p.dir) / p.h;
          const r = p.r * (1 - t);
          if (r <= 0.5) return false;
          setCircle(s, p.cx, p.cy, r);
          return true;
        }
        // cone em pé: seção cônica amostrada (convexa)
        const adz = Math.abs(z - p.cz);
        if (adz >= p.r - 0.25) return false;
        const tMax = 1 - adz / p.r, STEPS = 6;
        ensureCap(s, STEPS * 2 + 2);
        let n = 0;
        const pts = s.pts;
        for (let i = 0; i <= STEPS; i++) {
          const t = (tMax * i) / STEPS, rr = p.r * (1 - t);
          const hw = Math.sqrt(Math.max(0, rr * rr - adz * adz));
          pts[n * 2] = p.cx + hw; pts[n * 2 + 1] = p.cy + p.dir * p.h * t; n++;
        }
        for (let i = STEPS; i >= 0; i--) {
          const t = (tMax * i) / STEPS, rr = p.r * (1 - t);
          const hw = Math.sqrt(Math.max(0, rr * rr - adz * adz));
          if (i === STEPS && hw < 1e-6) continue; // ponta compartilhada
          pts[n * 2] = p.cx - hw; pts[n * 2 + 1] = p.cy + p.dir * p.h * t; n++;
        }
        s.n = n;
        finishPoly(s);
        if (p.dir > 0) reverse(s);
        return (s.maxX - s.minX) > 0.5;
      }
    }
    return false;
  }

  function reverse(s) {
    const p = s.pts;
    for (let i = 0, j = s.n - 1; i < j; i++, j--) {
      const x = p[i * 2], y = p[i * 2 + 1];
      p[i * 2] = p[j * 2]; p[i * 2 + 1] = p[j * 2 + 1];
      p[j * 2] = x; p[j * 2 + 1] = y;
    }
  }

  // corta e guarda no formato próprio do primitivo (cache); devolve o formato ou null
  function slice(p, z) {
    return sliceInto(p, z, p._s) ? p._s : null;
  }

  // distância de z até a borda mais próxima do volume do sólido (0 = prestes a sumir)
  function zEdge(p, z) {
    return Math.min(z - p.zMin, p.zMax - z);
  }

  function copyShape(src, dst) {
    dst.type = src.type; dst.n = src.n; dst.cx = src.cx; dst.cy = src.cy; dst.r = src.r;
    dst.minX = src.minX; dst.minY = src.minY; dst.maxX = src.maxX; dst.maxY = src.maxY;
    if (src.type === 'poly') { ensureCap(dst, src.n); for (let i = 0; i < src.n * 2; i++) dst.pts[i] = src.pts[i]; }
    return dst;
  }

  PL.G3 = {
    newShape, setRect, setCircle, finishPoly, copyShape,
    prism, box, loft, hull: hullFrom, cuboid, cuboidVerts, setHull, pyramid, rod, sphere, cyl, cone,
    rotMatrix, diagRot, mul3, transformInto,
    slice, sliceInto, zEdge,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = PL;
})(typeof globalThis !== 'undefined' ? globalThis : this);
