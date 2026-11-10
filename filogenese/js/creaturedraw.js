/* Filogênese — desenho procedural de criaturas (vista de cima) a partir do genoma e da pose. */
(function (FG) {
  'use strict';
  const U = FG.U, Parts = FG.Parts, TAU = U.TAU;

  const HEADS = {
    round: { L: 1.05, W: 1.0, tp: 0.72 },
    long: { L: 1.65, W: 0.82, tp: 0.5 },
    wide: { L: 0.95, W: 1.3, tp: 0.85 },
    wedge: { L: 1.4, W: 1.05, tp: 0.22 },
    flat: { L: 1.2, W: 1.15, tp: 1.05 },
  };
  const BONE = '#efe6cf', BONE_D = '#a99c78', MOUTH = '#4a1626', TOXIC = '#9be04a', TOXIC_D = '#4f8a1f';

  /** Estrutura derivada do genoma, calculada uma vez (raios, cores, marcas, partes resolvidas). */
  function blueprint(g, mul, baby) {
    const size = g.size * (mul || 1);
    const n = g.segs, sp = 8.5 * size * g.len, baseR = 10.5 * size;
    const r = new Float32Array(n);
    const tailN = U.clamp(Math.round((n - 1) * g.tailLen), 1, n - 3);
    const torsoN = n - 1 - tailN;
    for (let i = 1; i < n; i++) {
      if (i <= torsoN) {
        const t = torsoN > 1 ? (i - 1) / (torsoN - 1) : 0.5;
        const girth = t < 0.5 ? U.lerp(g.prof[0], g.prof[1], U.smooth(t * 2)) : U.lerp(g.prof[1], g.prof[2], U.smooth((t - 0.5) * 2));
        r[i] = baseR * girth;
      } else {
        const t = (i - torsoN) / tailN;
        r[i] = U.lerp(r[torsoN] * 0.78, baseR * 0.14, Math.pow(t, 0.75));
      }
    }
    r[1] *= 0.88;
    const hs = HEADS[g.head.shape] || HEADS.round;
    const hr = baseR * 0.92 * g.head.size * (baby ? 1.3 : 1);
    r[0] = hr;
    const pv = {};
    for (const cat of Parts.CATS) pv[cat] = Parts.get(g.parts[cat]);
    const P = g.legs.pairs, legIdx = [];
    for (let j = 0; j < P; j++) {
      const t = P === 1 ? 0.38 : U.lerp(0.08, 0.94, j / (P - 1));
      legIdx.push(U.clamp(1 + Math.round(t * (torsoN - 1)), 1, torsoN));
    }
    const girth = (g.prof[0] + g.prof[1] * 2 + g.prof[2]) / 4;
    const c1 = g.skin.c1, c2 = g.skin.c2, c3 = g.skin.c3;
    const col = {
      base: U.hsl(c1), dark: U.hsl(c1, -13), light: U.hsl(c1, 12), lightA: U.hsl(c1, 16, 0.45),
      line: U.hsl([c1[0], c1[1] * 0.7, Math.max(8, c1[2] - 34)]),
      pat: U.hsl(c2), patD: U.hsl(c2, -12), acc: U.hsl(c3), accD: U.hsl(c3, -20), accL: U.hsl(c3, 16), accA: U.hsl(c3, 4, 0.6),
      leg: U.hsl(c1, -9), legD: U.hsl(c1, -24), belly: U.hsl(c1, 22), iris: U.hsl([c3[0], Math.min(95, c3[1] + 10), 48]),
    };
    // marcas do padrão de pele
    const rr = U.rng(g.seed ^ 0x9e37), marks = [];
    const pat = g.skin.pattern;
    if (pat === 'stripes' || pat === 'rings') {
      const step = pat === 'rings' ? 2 : 1;
      for (let i = 1 + (rr() < 0.5 ? 1 : 0); i < n - 1; i += step) marks.push({ i, w: pat === 'rings' ? 0.5 : rr.range(0.2, 0.34) });
    } else if (pat === 'spots' || pat === 'patches') {
      const big = pat === 'patches';
      for (let i = 1; i < n - 1; i++) {
        const k = big ? (rr() < 0.6 ? 1 : 0) : rr.int(1, 2);
        for (let j = 0; j < k; j++) marks.push({ i, off: rr.range(-0.55, 0.55), s: big ? rr.range(0.38, 0.6) : rr.range(0.16, 0.3), f: rr.range(-0.4, 0.4) });
      }
    }
    let maxR = hr;
    for (let i = 1; i < n; i++) if (r[i] > maxR) maxR = r[i];
    return {
      g, n, sp, r, hr, hs, size, baby: !!baby, tailN, torsoN, pv, legIdx, girth,
      headGap: sp * 0.55 + hr * 0.55 + r[1] * 0.3,
      legLen: (15 + 15 * g.legs.len) * size, legW: (2.6 + 2 * girth) * size,
      armLen: (13 + 5 * girth) * size,
      lw: Math.max(1, 1.5 * Math.sqrt(size)),
      col, marks, pattern: pat, maxR, eyePairs: g.eyePairs,
      bodyLen: sp * (n - 1) + hr * hs.L,
      radius: Math.max(maxR, r[Math.min(2, n - 1)]) * 1.05,
    };
  }

  // ---- quadros (tangente para frente e normal) e casco do corpo ----
  const TX = new Float32Array(48), TY = new Float32Array(48), NX = new Float32Array(48), NY = new Float32Array(48);
  const HX = new Float32Array(100), HY = new Float32Array(100);
  function frames(S, n) {
    for (let i = 0; i < n; i++) {
      const a = i === 0 ? 0 : i - 1, b = i === n - 1 ? n - 1 : i + 1;
      let tx = S[a * 2] - S[b * 2], ty = S[a * 2 + 1] - S[b * 2 + 1];
      const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l;
      TX[i] = tx; TY[i] = ty; NX[i] = -ty; NY[i] = tx;
    }
  }
  /** Caminho suave e fechado em volta dos pontos a..b da espinha. */
  function hullPath(ctx, S, r, a, b, k, ox, oy, capF, capB) {
    let m = 0;
    HX[m] = S[a * 2] + TX[a] * r[a] * k * capF + ox; HY[m++] = S[a * 2 + 1] + TY[a] * r[a] * k * capF + oy;
    for (let i = a; i <= b; i++) { HX[m] = S[i * 2] + NX[i] * r[i] * k + ox; HY[m++] = S[i * 2 + 1] + NY[i] * r[i] * k + oy; }
    HX[m] = S[b * 2] - TX[b] * r[b] * k * capB + ox; HY[m++] = S[b * 2 + 1] - TY[b] * r[b] * k * capB + oy;
    for (let i = b; i >= a; i--) { HX[m] = S[i * 2] - NX[i] * r[i] * k + ox; HY[m++] = S[i * 2 + 1] - NY[i] * r[i] * k + oy; }
    ctx.beginPath();
    ctx.moveTo((HX[m - 1] + HX[0]) / 2, (HY[m - 1] + HY[0]) / 2);
    for (let i = 0; i < m; i++) { const j = (i + 1) % m; ctx.quadraticCurveTo(HX[i], HY[i], (HX[i] + HX[j]) / 2, (HY[i] + HY[j]) / 2); }
    ctx.closePath();
  }

  function dot(ctx, x, y, rad) { ctx.moveTo(x + rad, y); ctx.arc(x, y, rad, 0, TAU); }

  // ---- pés ----
  function drawFoot(ctx, kind, x, y, ang, s, col) {
    const c = Math.cos(ang), sn = Math.sin(ang);
    const fx = (d) => x + c * d, fy = (d) => y + sn * d;
    ctx.fillStyle = col.legD;
    switch (kind) {
      case 'pad': case 'tapper': case 'rhythm':
        ctx.beginPath(); dot(ctx, x, y, s * 0.85);
        for (let k = -1; k <= 1; k++) dot(ctx, x + Math.cos(ang + k * 0.7) * s * 1.15, y + Math.sin(ang + k * 0.7) * s * 1.15, s * 0.36);
        ctx.fill();
        if (kind !== 'pad') { ctx.fillStyle = kind === 'rhythm' ? col.accL : col.acc; ctx.beginPath(); dot(ctx, x, y, s * 0.45); ctx.fill(); }
        break;
      case 'hoof': case 'runner':
        ctx.fillStyle = '#2a2420';
        ctx.beginPath(); ctx.ellipse(fx(s * 0.3), fy(s * 0.3), s * (kind === 'runner' ? 1.5 : 1.05), s * 0.72, ang, 0, TAU); ctx.fill();
        ctx.strokeStyle = '#6b5f52'; ctx.lineWidth = Math.max(0.8, s * 0.22);
        ctx.beginPath(); ctx.moveTo(fx(s * 0.2), fy(s * 0.2)); ctx.lineTo(fx(s * 1.5), fy(s * 1.5)); ctx.stroke();
        break;
      case 'web': case 'flipper': {
        const L = s * (kind === 'flipper' ? 2.6 : 1.9), sp = kind === 'flipper' ? 0.55 : 0.75;
        ctx.fillStyle = col.accA;
        ctx.beginPath(); ctx.moveTo(x, y);
        ctx.lineTo(x + Math.cos(ang - sp) * L, y + Math.sin(ang - sp) * L);
        ctx.quadraticCurveTo(fx(L * 1.15), fy(L * 1.15), x + Math.cos(ang + sp) * L, y + Math.sin(ang + sp) * L);
        ctx.closePath(); ctx.fill();
        ctx.strokeStyle = col.legD; ctx.lineWidth = Math.max(0.8, s * 0.3);
        ctx.beginPath();
        for (let k = -1; k <= 1; k++) { ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(ang + k * sp) * L, y + Math.sin(ang + k * sp) * L); }
        ctx.stroke();
        break;
      }
      case 'spring': case 'jumper':
        ctx.beginPath(); ctx.ellipse(fx(s * 0.7), fy(s * 0.7), s * (kind === 'jumper' ? 2 : 1.5), s * 0.62, ang, 0, TAU); ctx.fill();
        ctx.fillStyle = col.acc; ctx.beginPath(); dot(ctx, fx(-s * 0.3), fy(-s * 0.3), s * 0.5); ctx.fill();
        break;
      case 'dancer':
        ctx.beginPath(); ctx.ellipse(fx(s * 0.4), fy(s * 0.4), s * 1.3, s * 0.7, ang, 0, TAU); ctx.fill();
        ctx.strokeStyle = col.accL; ctx.lineWidth = Math.max(1, s * 0.4);
        ctx.beginPath(); ctx.moveTo(x - sn * s * 0.6, y + c * s * 0.6); ctx.lineTo(x + sn * s * 0.6, y - c * s * 0.6); ctx.stroke();
        break;
      case 'stomper':
        ctx.beginPath(); dot(ctx, x, y, s * 1.25); ctx.fill();
        ctx.fillStyle = BONE; ctx.beginPath();
        for (let k = -1; k <= 1; k++) dot(ctx, x + Math.cos(ang + k * 0.6) * s * 1.15, y + Math.sin(ang + k * 0.6) * s * 1.15, s * 0.3);
        ctx.fill();
        break;
      case 'talon':
        ctx.beginPath(); dot(ctx, x, y, s * 0.7); ctx.fill();
        ctx.strokeStyle = BONE; ctx.lineWidth = Math.max(1, s * 0.34); ctx.lineCap = 'round';
        ctx.beginPath();
        for (let k = -1; k <= 1; k++) { ctx.moveTo(x + Math.cos(ang + k * 0.5) * s * 0.6, y + Math.sin(ang + k * 0.5) * s * 0.6); ctx.lineTo(x + Math.cos(ang + k * 0.42) * s * 2, y + Math.sin(ang + k * 0.42) * s * 2); }
        ctx.stroke();
        break;
      default:
        ctx.beginPath(); dot(ctx, x, y, s * 0.8); ctx.fill();
    }
  }

  function drawLegs(ctx, c, bp, S, lod) {
    const L = c.legs, col = bp.col, r = bp.r;
    const a = bp.legLen * 0.52, b = bp.legLen * 0.52;
    const foot = bp.pv.feet ? bp.pv.feet.vis.k : 'stub';
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (let q = 0; q < L.length; q++) {
      const lg = L[q], i = lg.idx;
      const hx = S[i * 2] + NX[i] * lg.side * r[i] * 0.55, hy = S[i * 2 + 1] + NY[i] * lg.side * r[i] * 0.55;
      const lift = lg.st >= 0 ? Math.sin(lg.st * Math.PI) : 0;
      let fx = lg.fx, fy = lg.fy - lift * bp.legW * 0.9;
      let dx = fx - hx, dy = fy - hy, d = Math.hypot(dx, dy) || 0.001;
      const maxD = (a + b) * 0.98;
      if (d > maxD) { fx = hx + dx / d * maxD; fy = hy + dy / d * maxD; dx = fx - hx; dy = fy - hy; d = maxD; }
      const ca = U.clamp((d * d + a * a - b * b) / (2 * d * a), -1, 1);
      const base = Math.atan2(dy, dx), ka = base + lg.side * Math.acos(ca) * (lg.back ? -1 : 1);
      const kx = hx + Math.cos(ka) * a, ky = hy + Math.sin(ka) * a;
      const w = bp.legW * (1 + lift * 0.12);
      ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(kx, ky); ctx.lineTo(fx, fy);
      ctx.strokeStyle = col.line; ctx.lineWidth = w + bp.lw * 1.6; ctx.stroke();
      ctx.strokeStyle = col.leg; ctx.lineWidth = w; ctx.stroke();
      if (lod < 2) drawFoot(ctx, foot, fx, fy, Math.atan2(TY[i], TX[i]) + lg.side * 0.25, w * 0.62 * (1 + lift * 0.2), col);
    }
  }

  function drawArms(ctx, c, bp, S) {
    const col = bp.col, i = Math.min(2, bp.torsoN), k = bp.pv.arms.vis.k;
    const body = Math.atan2(TY[i], TX[i]), sw = c.armSwing || 0, L = bp.armLen;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (let side = -1; side <= 1; side += 2) {
      const sx = S[i * 2] + NX[i] * side * bp.r[i] * 0.7, sy = S[i * 2 + 1] + NY[i] * side * bp.r[i] * 0.7;
      // repouso: para frente e para fora; golpe: varre pela frente
      const rest = 0.85 + Math.sin(c.time * 1.3 + side) * 0.05;
      const a1 = body + side * (rest + sw * 0.9 - Math.sin(sw * Math.PI) * 1.7);
      const reach = L * (0.55 + Math.sin(sw * Math.PI) * 0.25);
      const ex = sx + Math.cos(a1) * reach, ey = sy + Math.sin(a1) * reach;
      const a2 = a1 - side * (0.9 - Math.sin(sw * Math.PI) * 0.7);
      const hx = ex + Math.cos(a2) * L * 0.55, hy = ey + Math.sin(a2) * L * 0.55;
      const w = bp.legW * 0.8;
      ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex, ey); ctx.lineTo(hx, hy);
      ctx.strokeStyle = col.line; ctx.lineWidth = w + bp.lw * 1.6; ctx.stroke();
      ctx.strokeStyle = col.leg; ctx.lineWidth = w; ctx.stroke();
      const s = w * 1.1, ca = Math.cos(a2), sa = Math.sin(a2);
      ctx.strokeStyle = BONE; ctx.fillStyle = BONE; ctx.lineWidth = Math.max(1, s * 0.4);
      ctx.beginPath();
      if (k === 'pincer') {
        ctx.arc(hx + ca * s * 0.9, hy + sa * s * 0.9, s * 0.9, a2 - 2.2, a2 + 2.2); ctx.stroke();
      } else if (k === 'claw') {
        for (let q = -1; q <= 1; q++) { ctx.moveTo(hx, hy); ctx.lineTo(hx + Math.cos(a2 + q * 0.45) * s * 2, hy + Math.sin(a2 + q * 0.45) * s * 2); }
        ctx.stroke();
      } else if (k === 'hammer') {
        ctx.fillStyle = col.legD; dot(ctx, hx + ca * s * 0.6, hy + sa * s * 0.6, s * 1.5); ctx.fill();
        ctx.fillStyle = col.light; ctx.beginPath(); dot(ctx, hx + ca * s * 0.3, hy + sa * s * 0.3, s * 0.5); ctx.fill();
      } else if (k === 'scythe') {
        ctx.lineWidth = Math.max(1.2, s * 0.6);
        ctx.moveTo(hx, hy); ctx.quadraticCurveTo(hx + ca * s * 3.2 + sa * side * s * 1.6, hy + sa * s * 3.2 - ca * side * s * 1.6, hx + Math.cos(a2 - side * 1.1) * s * 3.4, hy + Math.sin(a2 - side * 1.1) * s * 3.4);
        ctx.stroke();
      } else {
        ctx.lineWidth = Math.max(1.2, s * 0.5);
        for (let q = -1; q <= 1; q += 2) { ctx.moveTo(hx, hy); ctx.lineTo(hx + Math.cos(a2 + q * 0.22) * s * 3.6, hy + Math.sin(a2 + q * 0.22) * s * 3.6); }
        ctx.stroke();
      }
    }
  }

  function drawTail(ctx, c, bp, S) {
    const n = bp.n, col = bp.col, k = bp.pv.tail.vis.k, e = n - 1;
    const x = S[e * 2], y = S[e * 2 + 1], bx = -TX[e], by = -TY[e], ang = Math.atan2(by, bx);
    const s = bp.r[bp.torsoN] * 0.55 + bp.size * 2, fl = c.flare || 0;
    ctx.lineCap = 'round';
    if (k === 'whip') {
      const sw = Math.sin(c.time * 3) * s * 0.8;
      ctx.strokeStyle = col.dark; ctx.lineWidth = Math.max(1, bp.size * 1.6);
      ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + bx * s * 1.5 - by * sw, y + by * s * 1.5 + bx * sw, x + bx * s * 3.2 + by * sw, y + by * s * 3.2 - bx * sw); ctx.stroke();
    } else if (k === 'club' || k === 'star') {
      const cx = x + bx * s * 0.7, cy = y + by * s * 0.7;
      if (k === 'star') {
        ctx.fillStyle = BONE; ctx.beginPath();
        for (let q = 0; q < 6; q++) { const a = ang + q * TAU / 6 + 0.5; ctx.moveTo(cx + Math.cos(a - 0.3) * s * 0.7, cy + Math.sin(a - 0.3) * s * 0.7); ctx.lineTo(cx + Math.cos(a) * s * 1.7, cy + Math.sin(a) * s * 1.7); ctx.lineTo(cx + Math.cos(a + 0.3) * s * 0.7, cy + Math.sin(a + 0.3) * s * 0.7); }
        ctx.fill();
      }
      ctx.fillStyle = col.dark; ctx.strokeStyle = col.line; ctx.lineWidth = bp.lw;
      ctx.beginPath(); dot(ctx, cx, cy, s * 0.95); ctx.fill(); ctx.stroke();
      ctx.fillStyle = col.lightA; ctx.beginPath(); dot(ctx, cx - s * 0.2, cy - s * 0.25, s * 0.4); ctx.fill();
    } else if (k === 'fan' || k === 'aurora') {
      const big = k === 'aurora', nf = big ? 9 : 5, spread = (big ? 0.55 : 0.4) + fl * (big ? 1.15 : 0.9);
      const L = s * (big ? 4.2 : 2.8) * (1 + fl * 0.25);
      for (let q = 0; q < nf; q++) {
        const t = nf === 1 ? 0 : q / (nf - 1) * 2 - 1, a = ang + t * spread + Math.sin(c.time * 2 + q) * 0.03;
        const ex = x + Math.cos(a) * L, ey = y + Math.sin(a) * L;
        ctx.strokeStyle = q % 2 ? col.acc : col.accD; ctx.lineWidth = Math.max(1.5, s * (big ? 0.55 : 0.6));
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(ex, ey); ctx.stroke();
        if (big) { ctx.fillStyle = col.pat; ctx.beginPath(); dot(ctx, ex, ey, s * 0.42); ctx.fill(); ctx.fillStyle = col.accL; ctx.beginPath(); dot(ctx, ex, ey, s * 0.2); ctx.fill(); }
      }
    } else if (k === 'rattle') {
      const sh = Math.sin(c.time * 30) * (fl > 0.1 ? s * 0.35 : 0);
      ctx.fillStyle = BONE; ctx.strokeStyle = BONE_D; ctx.lineWidth = 1;
      for (let q = 0; q < 3; q++) { ctx.beginPath(); dot(ctx, x + bx * s * (0.5 + q * 0.75) - by * sh * q, y + by * s * (0.5 + q * 0.75) + bx * sh * q, s * (0.55 - q * 0.1)); ctx.fill(); ctx.stroke(); }
    } else if (k === 'stinger') {
      ctx.fillStyle = TOXIC; ctx.beginPath(); dot(ctx, x + bx * s * 0.5, y + by * s * 0.5, s * 0.6); ctx.fill();
      ctx.strokeStyle = BONE; ctx.lineWidth = Math.max(1.4, s * 0.4);
      ctx.beginPath(); ctx.moveTo(x + bx * s * 0.9, y + by * s * 0.9); ctx.quadraticCurveTo(x + bx * s * 2.4 - by * s, y + by * s * 2.4 + bx * s, x + bx * s * 1.5 - by * s * 1.7, y + by * s * 1.5 + bx * s * 1.7); ctx.stroke();
    } else if (k === 'rudder') {
      ctx.fillStyle = col.accA; ctx.strokeStyle = col.accD; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x - bx * s, y - by * s); ctx.quadraticCurveTo(x + bx * s - by * s * 0.9, y + by * s + bx * s * 0.9, x + bx * s * 3.2, y + by * s * 3.2);
      ctx.quadraticCurveTo(x + bx * s + by * s * 0.9, y + by * s - bx * s * 0.9, x - bx * s, y - by * s); ctx.fill(); ctx.stroke();
    }
  }

  function drawWing(ctx, x, y, ang, side, L, col, spread) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.scale(1, side);
    ctx.beginPath(); ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(L * 0.5, -L * 0.12, L, 0);
    ctx.lineTo(L * 0.82, L * (0.1 + 0.16 * spread)); ctx.lineTo(L * 0.7, L * 0.07);
    ctx.lineTo(L * 0.55, L * (0.12 + 0.22 * spread)); ctx.lineTo(L * 0.42, L * 0.08);
    ctx.lineTo(L * 0.28, L * (0.12 + 0.2 * spread)); ctx.lineTo(0, L * 0.12);
    ctx.closePath();
    ctx.fillStyle = col.acc; ctx.fill(); ctx.strokeStyle = col.accD; ctx.lineWidth = 1; ctx.stroke();
    ctx.strokeStyle = col.accL; ctx.beginPath(); ctx.moveTo(L * 0.05, L * 0.03); ctx.lineTo(L * 0.9, L * 0.02); ctx.stroke();
    ctx.restore();
  }

  function drawBack(ctx, c, bp, S, lod) {
    const k = bp.pv.back.vis.k, col = bp.col, r = bp.r, tn = bp.torsoN, fl = c.flare || 0;
    if (k === 'spikes') {
      ctx.fillStyle = BONE; ctx.strokeStyle = BONE_D; ctx.lineWidth = 0.8; ctx.beginPath();
      for (let i = 1; i <= tn + 1 && i < bp.n - 1; i++) {
        const x = S[i * 2], y = S[i * 2 + 1], l = r[i] * 0.75, w = r[i] * 0.22;
        ctx.moveTo(x + TX[i] * l * 0.4, y + TY[i] * l * 0.4); ctx.lineTo(x + NX[i] * w, y + NY[i] * w);
        ctx.lineTo(x - TX[i] * l, y - TY[i] * l); ctx.lineTo(x - NX[i] * w, y - NY[i] * w); ctx.closePath();
      }
      ctx.fill(); ctx.stroke();
    } else if (k === 'sail') {
      const a = 1, b = Math.min(tn + 1, bp.n - 2), w = 0.3 + fl * 0.35;
      ctx.fillStyle = col.accA; ctx.strokeStyle = col.accD; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(S[a * 2], S[a * 2 + 1]);
      for (let i = a; i <= b; i++) { const t = (i - a) / (b - a), h = Math.sin(t * Math.PI) * r[i] * (w + 0.25); ctx.lineTo(S[i * 2] + NX[i] * h, S[i * 2 + 1] + NY[i] * h); }
      for (let i = b; i >= a; i--) { const t = (i - a) / (b - a), h = Math.sin(t * Math.PI) * r[i] * (w + 0.25); ctx.lineTo(S[i * 2] - NX[i] * h, S[i * 2 + 1] - NY[i] * h); }
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = col.accL; ctx.lineWidth = Math.max(1, bp.size * 1.4); ctx.beginPath();
      ctx.moveTo(S[a * 2], S[a * 2 + 1]); for (let i = a + 1; i <= b; i++) ctx.lineTo(S[i * 2], S[i * 2 + 1]); ctx.stroke();
    } else if (k === 'plates') {
      ctx.fillStyle = col.patD; ctx.strokeStyle = col.line; ctx.lineWidth = 1;
      for (let i = 1; i <= tn; i++) {
        const sd = i % 2 ? 1 : -1, x = S[i * 2] + NX[i] * sd * r[i] * 0.22, y = S[i * 2 + 1] + NY[i] * sd * r[i] * 0.22, q = r[i] * 0.5;
        const a = Math.atan2(TY[i], TX[i]);
        ctx.beginPath(); for (let h = 0; h < 6; h++) { const aa = a + h * TAU / 6; ctx.lineTo(x + Math.cos(aa) * q, y + Math.sin(aa) * q); } ctx.closePath(); ctx.fill(); ctx.stroke();
      }
    } else if (k === 'carapace') {
      const a = Math.min(2, tn), b = tn;
      if (b > a) {
        hullPath(ctx, S, r, a, b, 0.9, 0, 0, 0.9, 0.9);
        ctx.fillStyle = col.patD; ctx.fill(); ctx.strokeStyle = col.line; ctx.lineWidth = bp.lw; ctx.stroke();
        if (lod < 1) {
          ctx.strokeStyle = col.pat; ctx.lineWidth = 1; ctx.beginPath();
          for (let i = a; i <= b; i++) { ctx.moveTo(S[i * 2] + NX[i] * r[i] * 0.78, S[i * 2 + 1] + NY[i] * r[i] * 0.78); ctx.lineTo(S[i * 2] - NX[i] * r[i] * 0.78, S[i * 2 + 1] - NY[i] * r[i] * 0.78); }
          ctx.stroke();
        }
      }
    } else if (k === 'mane') {
      ctx.strokeStyle = col.pat; ctx.lineWidth = Math.max(1.2, bp.size * 1.8); ctx.lineCap = 'round'; ctx.beginPath();
      const e = Math.min(3, tn);
      for (let i = 1; i <= e; i++) for (let q = -2; q <= 2; q++) {
        const x = S[i * 2] + NX[i] * q * r[i] * 0.2, y = S[i * 2 + 1] + NY[i] * q * r[i] * 0.2, l = r[i] * (0.65 + fl * 0.3);
        ctx.moveTo(x, y); ctx.lineTo(x - TX[i] * l + NX[i] * q * l * 0.35, y - TY[i] * l + NY[i] * q * l * 0.35);
      }
      ctx.stroke();
    } else if (k === 'bulbs') {
      const pulse = 0.8 + Math.sin(c.time * 3) * 0.2;
      for (let i = 2; i <= tn + 1 && i < bp.n - 1; i += 2) {
        const x = S[i * 2], y = S[i * 2 + 1], q = r[i] * 0.3 * pulse;
        ctx.fillStyle = col.accA; ctx.beginPath(); dot(ctx, x, y, q * 1.9); ctx.fill();
        ctx.fillStyle = col.accL; ctx.beginPath(); dot(ctx, x, y, q); ctx.fill();
      }
    } else if (k === 'winglets' || k === 'wings') {
      const i = Math.min(2, tn), sp = U.clamp(c.wing || 0, 0, 1);
      const L = bp.sp * (k === 'wings' ? 6.2 : 3.4) * (0.7 + 0.3 * sp), back = Math.atan2(-TY[i], -TX[i]);
      for (let side = -1; side <= 1; side += 2) {
        const a = back + side * (0.28 + sp * 1.15 + Math.sin(c.time * 16) * 0.2 * sp);
        drawWing(ctx, S[i * 2] + NX[i] * side * r[i] * 0.35, S[i * 2 + 1] + NY[i] * side * r[i] * 0.35, a, side, L, col, sp);
      }
    }
  }

  function drawMarks(ctx, bp, S) {
    const M = bp.marks, col = bp.col, r = bp.r, n = bp.n, pat = bp.pattern;
    if (pat === 'stripes' || pat === 'rings') {
      ctx.strokeStyle = col.pat; ctx.lineCap = 'round';
      for (let q = 0; q < M.length; q++) {
        const m = M[q], i = m.i, k = 0.74;
        ctx.lineWidth = Math.max(1, bp.sp * m.w); ctx.beginPath();
        ctx.moveTo(S[i * 2] + NX[i] * r[i] * k, S[i * 2 + 1] + NY[i] * r[i] * k);
        ctx.quadraticCurveTo(S[i * 2] - TX[i] * r[i] * 0.3, S[i * 2 + 1] - TY[i] * r[i] * 0.3, S[i * 2] - NX[i] * r[i] * k, S[i * 2 + 1] - NY[i] * r[i] * k);
        ctx.stroke();
      }
    } else if (pat === 'spots' || pat === 'patches') {
      ctx.fillStyle = col.pat; ctx.beginPath();
      for (let q = 0; q < M.length; q++) {
        const m = M[q], i = m.i, rad = r[i] * m.s, lim = Math.max(0, r[i] * 0.82 - rad);
        dot(ctx, S[i * 2] + NX[i] * m.off * 1.6 * lim + TX[i] * m.f * bp.sp, S[i * 2 + 1] + NY[i] * m.off * 1.6 * lim + TY[i] * m.f * bp.sp, rad);
      }
      ctx.fill();
    } else if (pat === 'dorsal') {
      ctx.strokeStyle = col.pat; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.lineWidth = bp.r[Math.min(2, n - 1)] * 0.55;
      ctx.beginPath(); ctx.moveTo(S[2], S[3]); for (let i = 2; i < n - 1; i++) ctx.lineTo(S[i * 2], S[i * 2 + 1]); ctx.stroke();
    }
  }

  // ---- cabeça ----
  function headPath(ctx, L, W, tp) {
    const bx = -0.78 * W;
    ctx.beginPath(); ctx.moveTo(bx, 0);
    ctx.bezierCurveTo(bx, W * 0.85, -0.25 * W, W, 0.1 * L, W);
    ctx.bezierCurveTo(0.5 * L, W, 0.75 * L, W * tp * 1.05, 0.9 * L, W * tp * 0.85);
    ctx.quadraticCurveTo(L * 1.03, W * tp * 0.5, L, 0);
    ctx.quadraticCurveTo(L * 1.03, -W * tp * 0.5, 0.9 * L, -W * tp * 0.85);
    ctx.bezierCurveTo(0.75 * L, -W * tp * 1.05, 0.5 * L, -W, 0.1 * L, -W);
    ctx.bezierCurveTo(-0.25 * W, -W, bx, -W * 0.85, bx, 0);
    ctx.closePath();
  }

  function drawEye(ctx, kind, x, y, rad, c, col, side) {
    const bl = c.blink || 0, lx = (c.lookX || 0) * rad * 0.32, ly = (c.lookY || 0) * rad * 0.32;
    if (kind === 'bead') {
      ctx.fillStyle = '#17141c'; ctx.beginPath(); ctx.ellipse(x, y, rad * 0.75, rad * 0.75 * (1 - bl * 0.9), 0, 0, TAU); ctx.fill();
      if (bl < 0.5) { ctx.fillStyle = '#fff'; ctx.beginPath(); dot(ctx, x + rad * 0.2, y - rad * 0.25, rad * 0.22); ctx.fill(); }
      return;
    }
    if (kind === 'compound') {
      ctx.fillStyle = col.iris; ctx.strokeStyle = '#17141c'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.ellipse(x, y, rad * 1.25, rad * 0.95, side * 0.5, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath();
      for (let q = 0; q < 5; q++) dot(ctx, x + Math.cos(q * 1.9) * rad * 0.55, y + Math.sin(q * 1.9) * rad * 0.45, rad * 0.2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.beginPath(); dot(ctx, x + rad * 0.3, y - rad * 0.3, rad * 0.22); ctx.fill();
      return;
    }
    const lantern = kind === 'lantern';
    if (lantern) { ctx.fillStyle = col.accA; ctx.beginPath(); dot(ctx, x, y, rad * 1.7); ctx.fill(); }
    ctx.fillStyle = lantern ? col.accL : '#f6f3ea'; ctx.strokeStyle = '#17141c'; ctx.lineWidth = Math.max(0.8, rad * 0.14);
    ctx.beginPath(); ctx.ellipse(x, y, rad, rad * Math.max(0.08, 1 - bl), 0, 0, TAU); ctx.fill(); ctx.stroke();
    if (bl > 0.6) return;
    if (kind === 'slit') {
      ctx.fillStyle = col.iris; ctx.beginPath(); dot(ctx, x + lx, y + ly, rad * 0.72); ctx.fill();
      ctx.fillStyle = '#14121a'; ctx.beginPath(); ctx.ellipse(x + lx, y + ly, rad * 0.62, rad * 0.2, 0, 0, TAU); ctx.fill();
    } else {
      if (!lantern) { ctx.fillStyle = col.iris; ctx.beginPath(); dot(ctx, x + lx, y + ly, rad * 0.66); ctx.fill(); }
      ctx.fillStyle = '#14121a'; ctx.beginPath(); dot(ctx, x + lx * 1.2, y + ly * 1.2, rad * 0.38); ctx.fill();
    }
    ctx.fillStyle = '#fff'; ctx.beginPath(); dot(ctx, x + rad * 0.28, y - rad * 0.3, rad * 0.2); ctx.fill();
  }

  function drawHead(ctx, c, bp, S, lod) {
    const col = bp.col, pv = bp.pv, hr = bp.hr, hs = bp.hs;
    const L = hs.L * hr, W = hs.W * hr, tp = hs.tp;
    const jaw = c.jaw || 0, fl = c.flare || 0, sing = c.sing || 0;
    ctx.save();
    ctx.translate(S[0], S[1]); ctx.rotate(c.headA);
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    const mk = pv.mouth ? pv.mouth.vis.k : 'snout', ms = pv.mouth ? pv.mouth.vis.s : 1;
    // --- atrás/abaixo da cabeça ---
    if (pv.voice) {
      const k = pv.voice.vis.k, s = pv.voice.vis.s, q = W * (0.42 + sing * 0.5) * s;
      if (k === 'sac' || k === 'choir') {
        ctx.fillStyle = col.belly; ctx.strokeStyle = col.line; ctx.lineWidth = 1;
        ctx.beginPath(); dot(ctx, -W * 0.25, W * 0.82, q); dot(ctx, -W * 0.25, -W * 0.82, q);
        if (k === 'choir') dot(ctx, -W * 0.95, 0, q * 0.9);
        ctx.fill(); ctx.stroke();
      }
    }
    if (pv.adorn) {
      const k = pv.adorn.vis.k;
      if (k === 'frill') {
        const R = W * (1.25 + fl * 0.75);
        ctx.fillStyle = col.acc; ctx.strokeStyle = col.accD; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(-W * 0.2, 0);
        for (let q = 0; q <= 8; q++) { const a = Math.PI * 0.5 + (q / 8) * Math.PI, rr2 = R * (q % 2 ? 0.86 : 1); ctx.lineTo(-W * 0.2 + Math.cos(a) * rr2 * 0.8, Math.sin(a) * rr2); }
        ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.strokeStyle = col.accL; ctx.beginPath();
        for (let q = 1; q < 8; q += 2) { const a = Math.PI * 0.5 + (q / 8) * Math.PI; ctx.moveTo(-W * 0.2, 0); ctx.lineTo(-W * 0.2 + Math.cos(a) * R * 0.66, Math.sin(a) * R * 0.82); }
        ctx.stroke();
      } else if (k === 'halo') {
        const R = W * (1.25 + fl * 0.9), nf = 11;
        for (let q = 0; q < nf; q++) {
          const a = Math.PI * 0.42 + (q / (nf - 1)) * Math.PI * 1.16;
          ctx.strokeStyle = q % 2 ? col.acc : col.accL; ctx.lineWidth = Math.max(1.5, W * 0.2);
          ctx.beginPath(); ctx.moveTo(-W * 0.3 + Math.cos(a) * W * 0.6, Math.sin(a) * W * 0.6); ctx.lineTo(-W * 0.3 + Math.cos(a) * R, Math.sin(a) * R); ctx.stroke();
        }
      }
    }
    if (pv.horn && pv.horn.vis.k === 'crown') {
      const R = W * (1.35 + fl * 0.3);
      ctx.fillStyle = BONE; ctx.strokeStyle = BONE_D; ctx.lineWidth = 1; ctx.beginPath();
      for (let q = 0; q < 5; q++) { const a = Math.PI * 0.6 + (q / 4) * Math.PI * 0.8; ctx.moveTo(Math.cos(a - 0.16) * W * 0.7, Math.sin(a - 0.16) * W * 0.7); ctx.lineTo(Math.cos(a) * R, Math.sin(a) * R); ctx.lineTo(Math.cos(a + 0.16) * W * 0.7, Math.sin(a + 0.16) * W * 0.7); }
      ctx.fill(); ctx.stroke();
    }
    // --- peças bucais por baixo da cabeça ---
    if (mk === 'mandibles') {
      const op = 0.25 + jaw * 0.7, ml = W * 1.15 * ms;
      ctx.strokeStyle = BONE; ctx.lineWidth = Math.max(1.6, W * 0.24);
      for (let sd = -1; sd <= 1; sd += 2) {
        ctx.beginPath(); ctx.moveTo(L * 0.6, sd * W * tp * 0.6);
        ctx.quadraticCurveTo(L * 0.6 + ml * 0.7, sd * (W * tp * 0.6 + ml * op), L * 0.6 + ml, sd * ml * (op - 0.22)); ctx.stroke();
      }
    } else if (mk === 'proboscis') {
      const pl = L * (0.55 + jaw * 0.9) * ms;
      ctx.strokeStyle = col.line; ctx.lineWidth = W * 0.42 + bp.lw * 1.6; ctx.beginPath(); ctx.moveTo(L * 0.8, 0); ctx.lineTo(L + pl, 0); ctx.stroke();
      ctx.strokeStyle = col.dark; ctx.lineWidth = W * 0.42; ctx.stroke();
      ctx.fillStyle = col.acc; ctx.beginPath(); dot(ctx, L + pl, 0, W * 0.26); ctx.fill();
    } else if (mk === 'trumpet') {
      const fl2 = W * (0.75 + sing * 0.35 + jaw * 0.2) * ms, tl = L * 0.55;
      ctx.fillStyle = col.dark; ctx.strokeStyle = col.line; ctx.lineWidth = bp.lw;
      ctx.beginPath(); ctx.moveTo(L * 0.7, -W * tp * 0.5); ctx.lineTo(L + tl, -fl2); ctx.quadraticCurveTo(L + tl * 1.25, 0, L + tl, fl2); ctx.lineTo(L * 0.7, W * tp * 0.5); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = MOUTH; ctx.beginPath(); ctx.ellipse(L + tl * 0.98, 0, tl * 0.2, fl2 * 0.8, 0, 0, TAU); ctx.fill();
    }
    // --- crânio ---
    headPath(ctx, L, W, tp);
    ctx.fillStyle = col.base; ctx.fill(); ctx.strokeStyle = col.line; ctx.lineWidth = bp.lw; ctx.stroke();
    if (lod < 2) { ctx.fillStyle = col.lightA; ctx.beginPath(); ctx.ellipse(L * 0.05, 0, L * 0.45 + W * 0.2, W * 0.5, 0, 0, TAU); ctx.fill(); }
    // --- boca por cima ---
    if (lod < 2) {
      if (mk === 'beak') {
        const bl = L * 0.62 * ms, bw = W * Math.max(0.45, tp) * 0.8, op = jaw * 0.3;
        ctx.fillStyle = '#e9a23b'; ctx.strokeStyle = '#8a5514'; ctx.lineWidth = 1;
        for (let sd = -1; sd <= 1; sd += 2) {
          ctx.beginPath(); ctx.moveTo(L * 0.55, 0); ctx.lineTo(L * 0.55, sd * bw);
          ctx.quadraticCurveTo(L * 0.55 + bl * 0.6, sd * (bw * 0.8 + op * bl), L * 0.55 + bl * Math.cos(op), sd * bl * Math.sin(op) * 1.2 + sd * 0.4); ctx.closePath(); ctx.fill(); ctx.stroke();
        }
      } else if (mk === 'muzzle' || mk === 'snout') {
        const mw = W * Math.max(0.5, tp) * 0.82 * ms;
        ctx.fillStyle = mk === 'muzzle' ? col.belly : col.dark;
        ctx.beginPath(); ctx.ellipse(L * 0.78, 0, L * 0.26, mw, 0, 0, TAU); ctx.fill();
        if (jaw > 0.05) { ctx.fillStyle = MOUTH; ctx.beginPath(); ctx.ellipse(L * 0.93, 0, L * 0.1 + jaw * L * 0.1, mw * (0.35 + jaw * 0.5), 0, 0, TAU); ctx.fill(); }
        ctx.fillStyle = '#1a1418'; ctx.beginPath(); dot(ctx, L * 0.86, mw * 0.4, Math.max(0.8, W * 0.07)); dot(ctx, L * 0.86, -mw * 0.4, Math.max(0.8, W * 0.07)); ctx.fill();
      } else if (mk === 'fangs' || mk === 'maw') {
        const op = (mk === 'maw' ? 0.16 : 0.07) + jaw * 0.4, x0 = L * (mk === 'maw' ? 0.18 : 0.38), hw = W * Math.max(0.42, tp) * (0.4 + op) * ms;
        ctx.fillStyle = MOUTH; ctx.beginPath(); ctx.moveTo(x0, 0); ctx.quadraticCurveTo(L * 0.7, hw * 1.2, L * 1.0, hw * 0.75); ctx.lineTo(L * 1.0, -hw * 0.75); ctx.quadraticCurveTo(L * 0.7, -hw * 1.2, x0, 0); ctx.fill();
        ctx.fillStyle = '#fbf6e6'; ctx.beginPath();
        const nt = mk === 'maw' ? 4 : 3, ts = W * 0.17 * ms;
        for (let q = 0; q < nt; q++) {
          const t = (q + 0.6) / nt, x = U.lerp(x0, L, t), yy = hw * (0.25 + t * 0.75) * (1 - (t - 0.6) * (t - 0.6) * 0.5);
          for (let sd = -1; sd <= 1; sd += 2) { ctx.moveTo(x - ts * 0.6, sd * yy); ctx.lineTo(x, sd * (yy - ts * 1.5)); ctx.lineTo(x + ts * 0.6, sd * yy); }
        }
        ctx.fill();
      }
    }
    // --- glândulas ---
    if (pv.gland && lod < 2) {
      const s = pv.gland.vis.s, q = W * 0.3 * s * (1 + Math.sin(c.time * 2.2) * 0.06);
      ctx.fillStyle = TOXIC; ctx.strokeStyle = TOXIC_D; ctx.lineWidth = 1;
      ctx.beginPath(); dot(ctx, L * 0.28, W * 0.86, q); dot(ctx, L * 0.28, -W * 0.86, q);
      if (pv.gland.vis.k === 'cannon') dot(ctx, L * 0.5, 0, q * 0.9);
      ctx.fill(); ctx.stroke();
      if (pv.gland.vis.k === 'cannon') { ctx.fillStyle = '#1d3008'; ctx.beginPath(); dot(ctx, L * 0.5, 0, q * 0.45); ctx.fill(); }
    }
    // --- voz por cima ---
    if (pv.voice && lod < 2) {
      const k = pv.voice.vis.k;
      if (k === 'resonator') {
        ctx.fillStyle = col.pat; ctx.strokeStyle = col.line; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.ellipse(-W * 0.55, 0, W * (0.75 + sing * 0.2), W * (0.26 + sing * 0.12), 0, 0, TAU); ctx.fill(); ctx.stroke();
        ctx.fillStyle = MOUTH; ctx.beginPath(); dot(ctx, -W * 1.1, 0, W * 0.13); ctx.fill();
      } else if (k === 'flutes') {
        ctx.strokeStyle = col.pat; ctx.lineWidth = Math.max(1.6, W * (0.2 + sing * 0.08));
        ctx.beginPath(); for (let sd = -1; sd <= 1; sd += 2) { ctx.moveTo(L * 0.2, sd * W * 0.38); ctx.lineTo(L * 0.82, sd * W * tp * 0.5); } ctx.stroke();
      }
    }
    // --- olhos ---
    const ek = pv.eyes ? pv.eyes.vis.k : 'bead', pairs = bp.eyePairs;
    const er = hr * (ek === 'bead' ? 0.17 : ek === 'compound' ? 0.24 : 0.23) * (bp.baby ? 1.25 : 1);
    for (let p = 0; p < pairs; p++) {
      const ex = L * (0.36 - p * 0.3), ey = W * (0.6 - p * 0.04) * (ek === 'stalk' ? 1.25 : 1);
      for (let sd = -1; sd <= 1; sd += 2) {
        if (ek === 'stalk') { ctx.strokeStyle = col.dark; ctx.lineWidth = Math.max(1.2, hr * 0.13); ctx.beginPath(); ctx.moveTo(ex - L * 0.1, sd * W * 0.5); ctx.lineTo(ex, sd * ey); ctx.stroke(); }
        if (lod >= 2) { ctx.fillStyle = '#17141c'; ctx.beginPath(); dot(ctx, ex, sd * ey, er * 0.8); ctx.fill(); } else drawEye(ctx, ek === 'stalk' ? 'round' : ek, ex, sd * ey, er, c, col, sd);
      }
    }
    // --- chifres ---
    if (pv.horn) {
      const k = pv.horn.vis.k;
      ctx.fillStyle = BONE; ctx.strokeStyle = BONE_D; ctx.lineWidth = 1;
      if (k === 'bump') { ctx.beginPath(); dot(ctx, L * 0.62, 0, W * 0.2); ctx.fill(); ctx.stroke(); }
      else if (k === 'nasal') { ctx.beginPath(); ctx.moveTo(L * 0.5, -W * 0.2); ctx.lineTo(L * 1.45, 0); ctx.lineTo(L * 0.5, W * 0.2); ctx.closePath(); ctx.fill(); ctx.stroke(); }
      else if (k === 'ram') { ctx.beginPath(); ctx.ellipse(L * 0.55, 0, L * 0.22, W * 0.78, 0, 0, TAU); ctx.fill(); ctx.stroke(); ctx.strokeStyle = BONE_D; ctx.beginPath(); ctx.moveTo(L * 0.55, -W * 0.6); ctx.lineTo(L * 0.55, W * 0.6); ctx.stroke(); }
      else if (k === 'trident') {
        ctx.beginPath();
        for (let q = -1; q <= 1; q++) { ctx.moveTo(L * 0.45, q * W * 0.42 - W * 0.13); ctx.lineTo(L * (q ? 1.35 : 1.6), q * W * 0.62); ctx.lineTo(L * 0.45, q * W * 0.42 + W * 0.13); ctx.closePath(); }
        ctx.fill(); ctx.stroke();
      } else if (k === 'antlers') {
        ctx.strokeStyle = BONE; ctx.lineWidth = Math.max(1.6, W * 0.2);
        for (let sd = -1; sd <= 1; sd += 2) {
          ctx.beginPath(); ctx.moveTo(L * 0.05, sd * W * 0.3); ctx.quadraticCurveTo(-W * 0.2, sd * W * 1.2, W * 0.5, sd * W * 1.9);
          ctx.moveTo(-W * 0.05, sd * W * 1.0); ctx.lineTo(-W * 0.75, sd * W * 1.45);
          ctx.moveTo(W * 0.15, sd * W * 1.45); ctx.lineTo(W * 0.9, sd * W * 1.35); ctx.stroke();
        }
      }
    }
    // --- adornos por cima ---
    if (pv.adorn && lod < 2) {
      const k = pv.adorn.vis.k;
      if (k === 'tuft') {
        ctx.strokeStyle = col.acc; ctx.lineWidth = Math.max(1.4, W * 0.16); ctx.beginPath();
        for (let q = -1; q <= 1; q++) { ctx.moveTo(-W * 0.2, q * W * 0.12); ctx.lineTo(-W * (0.95 + fl * 0.4), q * W * (0.32 + fl * 0.3) + Math.sin(c.time * 3 + q) * W * 0.05); }
        ctx.stroke();
      } else if (k === 'crest') {
        ctx.fillStyle = col.acc; ctx.strokeStyle = col.accD; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(L * 0.3, 0); ctx.quadraticCurveTo(-W * 0.2, W * (0.24 + fl * 0.22), -W * 1.1, 0); ctx.quadraticCurveTo(-W * 0.2, -W * (0.24 + fl * 0.22), L * 0.3, 0); ctx.fill(); ctx.stroke();
      } else if (k === 'plumes') {
        for (let sd = -1; sd <= 1; sd += 2) {
          const sw = Math.sin(c.time * 2.4 + sd) * W * 0.25, pl = W * (2.3 + fl * 0.6);
          ctx.strokeStyle = col.acc; ctx.lineWidth = Math.max(1.3, W * 0.14);
          ctx.beginPath(); ctx.moveTo(L * 0.1, sd * W * 0.25); ctx.quadraticCurveTo(L * 0.5, sd * W * (1.3 + fl * 0.5), L * 0.1 - pl * 0.5, sd * W * (1.5 + fl * 0.7) + sw); ctx.stroke();
          ctx.fillStyle = col.accL; ctx.beginPath(); dot(ctx, L * 0.1 - pl * 0.5, sd * W * (1.5 + fl * 0.7) + sw, W * 0.2); ctx.fill();
        }
      }
    }
    ctx.restore();
  }

  const NO = {};
  /** Desenha a criatura `c` (com c.bp, c.rs, c.legs…) no contexto, em coordenadas de mundo. */
  function drawCreature(ctx, c, o) {
    o = o || NO;
    const bp = c.bp, n = bp.n, S = c.rs, r = bp.r, col = bp.col, lod = o.lod || 0;
    frames(S, n);
    const z = c.z || 0, sm = c.scaleMul || 1, deep = c.wet >= 2;
    if (o.shadow !== false && !deep) {
      const ox = 3 * bp.size + z * 0.3, oy = 5 * bp.size + z * 0.55;
      ctx.fillStyle = 'rgba(8,18,10,0.2)';
      hullPath(ctx, S, r, 1, n - 1, 0.96, ox, oy, 0.8, 1.1); ctx.fill();
      ctx.beginPath(); dot(ctx, S[0] + ox, S[1] + oy, bp.hr * 0.95); ctx.fill();
    }
    const tr = z > 0.5 || sm !== 1;
    if (tr) { ctx.save(); ctx.translate(c.x, c.y - z); const k = sm * (1 + z * 0.0016); ctx.scale(k, k); ctx.translate(-c.x, -c.y); }
    const ga = ctx.globalAlpha;
    let al = c.alpha == null ? 1 : c.alpha;
    if (deep) al *= 0.82;
    if (al < 1) ctx.globalAlpha = ga * al;
    if (bp.pv.tail && lod < 2) drawTail(ctx, c, bp, S);
    if (!deep && c.legs.length) drawLegs(ctx, c, bp, S, lod);
    if (bp.pv.arms && lod < 2 && !deep) drawArms(ctx, c, bp, S);
    hullPath(ctx, S, r, 1, n - 1, 1, 0, 0, 0.8, 1.15);
    ctx.fillStyle = col.base; ctx.fill();
    ctx.lineWidth = bp.lw; ctx.strokeStyle = col.line; ctx.stroke();
    // pescoço: liga o tronco à cabeça (estica nos botes)
    const nw = Math.min(r[1], bp.hr * bp.hs.W) * 1.45, ndx = S[0] - S[2], ndy = S[1] - S[3], nl = Math.hypot(ndx, ndy) || 1;
    ctx.lineCap = 'butt'; ctx.beginPath(); ctx.moveTo(S[2] + ndx / nl * r[1] * 0.7, S[3] + ndy / nl * r[1] * 0.7); ctx.lineTo(S[0], S[1]);
    ctx.lineWidth = nw + bp.lw * 2; ctx.stroke();
    ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(S[2], S[3]); ctx.lineTo(S[0], S[1]);
    ctx.strokeStyle = col.base; ctx.lineWidth = nw; ctx.stroke();
    if (lod < 2) { hullPath(ctx, S, r, 1, n - 2, 0.5, 0, 0, 0.6, 1); ctx.fillStyle = col.lightA; ctx.fill(); }
    if (lod < 1) drawMarks(ctx, bp, S);
    if (bp.pv.back && lod < 2) drawBack(ctx, c, bp, S, lod);
    drawHead(ctx, c, bp, S, lod);
    const tint = c.dead ? 'rgba(40,30,34,0.5)' : c.flash > 0.02 ? `rgba(255,255,255,${Math.min(0.75, c.flash * 0.75)})` : c.poison > 0 ? 'rgba(120,220,60,0.22)' : null;
    if (tint) {
      ctx.fillStyle = tint;
      hullPath(ctx, S, r, 1, n - 1, 1, 0, 0, 0.8, 1.15); ctx.fill();
      ctx.beginPath(); dot(ctx, S[0], S[1], bp.hr * 1.05); ctx.fill();
    }
    ctx.globalAlpha = ga;
    if (tr) ctx.restore();
  }

  FG.Draw = {
    blueprint, creature: drawCreature, HEADS,
    /** Blueprint em cache por espécie (adulto e filhote); refeito quando a espécie muda (sp.rev). */
    bpFor(sp, baby) {
      const key = baby ? '_bpB' : '_bpA';
      if (!sp[key] || sp[key].rev !== sp.rev) { sp[key] = blueprint(sp.genome, baby ? 0.55 : 1, baby); sp[key].rev = sp.rev; }
      return sp[key];
    },
    /** Retrato de uma espécie num canvas (usado na enciclopédia, HUD e editor). */
    portrait(canvas, sp, o) {
      o = o || {};
      const ctx = canvas.getContext('2d'), w = canvas.width, h = canvas.height;
      ctx.clearRect(0, 0, w, h);
      const c = new FG.Creature(sp, 0, 0, { angle: o.angle == null ? -0.5 : o.angle });
      c.settle();
      const bp = c.bp, len = bp.bodyLen + bp.legLen * 0.6, wid = (bp.maxR + bp.legLen * 0.85) * 2;
      const ca = Math.abs(Math.cos(c.angle)), sa = Math.abs(Math.sin(c.angle));
      const bw = len * ca + wid * sa, bh = len * sa + wid * ca;
      let k = Math.min(w / bw, h / bh) * (o.fit || 0.86);
      // centro do corpo: meio da espinha
      let mx = (c.rs[0] + c.rs[(bp.n - 1) * 2]) / 2, my = (c.rs[1] + c.rs[(bp.n - 1) * 2 + 1]) / 2;
      if (o.focus && o.focus !== 'mid') {
        // zoom numa região (miniaturas do editor)
        let i = 0, rad = bp.hr * 3.4;
        if (o.focus === 'tail') { i = bp.n - 1; rad = bp.r[bp.torsoN] * 3 + bp.sp * 2.5; }
        else if (o.focus === 'arms') { i = 1; rad = bp.armLen * 1.7 + bp.hr; }
        mx = c.rs[i * 2]; my = c.rs[i * 2 + 1];
        if (o.focus === 'head') { mx += Math.cos(c.angle) * bp.hr * 0.5; my += Math.sin(c.angle) * bp.hr * 0.5; }
        if (o.focus === 'feet' && c.legs.length) { const lg = c.legs[0], j = lg.idx; mx = (lg.fx + c.rs[j * 2]) / 2; my = (lg.fy + c.rs[j * 2 + 1]) / 2; rad = bp.legLen * 0.95 + bp.r[j] * 0.6; }
        k = Math.min(w, h * 1.3) / (rad * 2);
      }
      ctx.save(); ctx.translate(w / 2, h / 2); ctx.scale(k, k); ctx.translate(-mx, -my);
      if (o.silhouette) {
        drawCreature(ctx, c, { shadow: false, lod: 1 });
        ctx.restore(); ctx.globalCompositeOperation = 'source-in'; ctx.fillStyle = o.silhouette; ctx.fillRect(0, 0, w, h); ctx.globalCompositeOperation = 'source-over';
      } else { drawCreature(ctx, c, { shadow: o.shadow !== false }); ctx.restore(); }
      return canvas;
    },
  };
})(window.FG = window.FG || {});
