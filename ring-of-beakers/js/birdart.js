// birdart.js — flat geometric vector art for every creature (birds, hybrids, people), drawn from a
// phenotype and a pose (see pose.js). Solid fills, no outlines. Draws in world units on a 2D context.
(function () {
  'use strict';
  const RB = globalThis.RB;
  const { TAU, clamp, Rng } = RB.core;
  const INK = '#23314a', BONE = '#f4ead2', WHITE = '#ffffff';

  function ell(ctx, x, y, rx, ry, rot) { ctx.beginPath(); ctx.ellipse(x, y, Math.max(0.01, rx), Math.max(0.01, ry), rot || 0, 0, TAU); ctx.fill(); }
  function circ(ctx, x, y, r) { ctx.beginPath(); ctx.arc(x, y, Math.max(0.01, r), 0, TAU); ctx.fill(); }
  function tri(ctx, x0, y0, x1, y1, x2, y2) { ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.lineTo(x2, y2); ctx.closePath(); ctx.fill(); }
  function seg(ctx, x0, y0, x1, y1, w, col) { ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); }

  // One-colour palette, for silhouettes and hit flashes.
  const silCache = {};
  function silPalette(P, col) {
    let s = silCache[col];
    if (!s) { s = silCache[col] = new Proxy({}, { get: () => col }); }
    return s;
  }

  function patternData(P) {
    if (P._pat) return P._pat;
    const rng = new Rng(RB.genome.hash(P.g));
    const dots = [], blobs = [];
    for (let i = 0; i < 16; i++) { const a = rng.range(0, TAU), r = Math.sqrt(rng.next()) * 0.92; dots.push([Math.cos(a) * r, Math.sin(a) * r, rng.range(0.7, 1.3)]); }
    for (let i = 0; i < 3; i++) blobs.push([rng.range(-0.7, 0.7), rng.range(-0.5, 0.6), rng.range(0.28, 0.5), rng.range(0, 3)]);
    return (P._pat = { dots, blobs });
  }

  function drawWing(ctx, P, pose, c, far, mx, my, ang) {
    if (P.WL < 2.5) return;
    const f = pose.f, ry = P.TD / 2, w = Math.max(0, pose.wing + (far ? -0.14 : 0));
    const spread = clamp(w, 0, 1);
    const L = P.WL * (far ? 0.94 : 1) * (1 + 0.25 * spread), wd = clamp(P.TD * 0.34, P.WL * 0.13, P.WL * 0.5) * (1 + 0.2 * spread), pt = P.wingPoint;
    ctx.save();
    ctx.translate(mx, my); ctx.rotate(ang); if (f < 0) ctx.scale(1, -1);
    ctx.translate(P.TL * 0.2, -ry * 0.3); ctx.rotate(Math.PI - 0.22 + w);
    // wing frame: +x along the wing, +y is the leading (upper) edge
    ctx.fillStyle = P.sw.bare ? c.skinDark : far ? c.wingDark : c.wing;
    ctx.beginPath();
    ctx.moveTo(-0.06 * L, wd * 0.25);
    ctx.quadraticCurveTo(0.35 * L, wd * 1.2, L, 0);
    ctx.quadraticCurveTo(0.45 * L * (1 - 0.3 * pt), -wd * (1.7 - 0.9 * pt), -0.06 * L, -wd * 0.6);
    ctx.closePath(); ctx.fill();
    if (!P.sw.bare) {
      ctx.fillStyle = c.wingTip;
      ctx.beginPath();
      ctx.moveTo(0.36 * L, -wd * 0.3);
      ctx.quadraticCurveTo(0.7 * L, wd * 0.12, L, 0);
      ctx.quadraticCurveTo(0.6 * L, -wd * (1.05 - 0.5 * pt), 0.36 * L, -wd * 0.3);
      ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }

  function drawTail(ctx, P, pose, c, bodyCol) {
    if (!(pose.tx === pose.tx) || P.tailL < 1) return;
    const dir = Math.atan2(pose.ty - pose.hy, pose.tx - pose.hx);
    const dx = Math.cos(dir), dy = Math.sin(dir);
    let ox = pose.hx - dx * P.TD * 0.12, oy = pose.hy - dy * P.TD * 0.12, len0 = P.tailL;
    if (P.sw.tailBone) {
      const px = -dy * P.TD * 0.22, py = dx * P.TD * 0.22;
      ctx.fillStyle = bodyCol;
      tri(ctx, ox + px, oy + py, ox - px, oy - py, ox + dx * P.tailL, oy + dy * P.tailL);
      ox += dx * P.tailL * 0.6; oy += dy * P.tailL * 0.6; len0 = P.tailL * 0.42;
    }
    if (P.sw.bare) return;
    const n = Math.max(2, 3 + Math.round(P.tailFan * 6)), spread = 0.2 + P.tailFan * 1.3;
    const wF = clamp(len0 * 0.13, 1.2 * P.S, P.TD * 0.3) * (1 + 0.6 * P.tailFan);
    const eyes = P.tailFan > 0.8 && P.sheen > 0.6 && len0 > 20 * P.S;
    for (let i = 0; i < n; i++) {
      const u = i / (n - 1) - 0.5, a = dir + u * spread;
      const len = len0 * (1 - 0.3 * Math.abs(u) * 2 * (1 - P.tailFan));
      ctx.fillStyle = i % 2 ? c.tailDark : c.tail;
      ell(ctx, ox + Math.cos(a) * len / 2, oy + Math.sin(a) * len / 2, len / 2, wF, a);
      if (eyes) {
        const ex = ox + Math.cos(a) * len * 0.86, ey = oy + Math.sin(a) * len * 0.86;
        ctx.fillStyle = c.accent; circ(ctx, ex, ey, wF * 0.95);
        ctx.fillStyle = INK; circ(ctx, ex, ey, wF * 0.45);
      }
    }
  }

  function drawLeg(ctx, P, leg, c, f, far, cl, bodyCol, feet) {
    const l1 = P.LL * (1 - P.shin), l2 = P.LL * P.shin;
    const k = RB.pose.knee(leg.ax, leg.ay, leg.fx, leg.fy, l1, l2, P.sw.knee ? -f : f);
    if (cl) {
      const col = far ? cl.pantsDark : cl.pants;
      seg(ctx, leg.ax, leg.ay, k.x, k.y, P.LT * 1.7, col);
      seg(ctx, k.x, k.y, leg.fx, leg.fy - P.LT * 0.5, P.LT * 1.45, col);
      ctx.fillStyle = far ? '#2c2422' : '#3a2e2a';
      ell(ctx, leg.fx + f * P.FL * 0.3, leg.fy - P.LT * 0.5, P.FL * 0.62, P.LT * 0.85, 0);
      if (feet) { ctx.save(); ctx.translate(leg.fx, leg.fy - P.LT * 0.4); if (f < 0) ctx.scale(-1, 1); drawFeetAcc(ctx, feet, P.FL * 0.9, P.LT); ctx.restore(); }
      return;
    }
    const legCol = P.sw.bare ? (far ? c.skinDark : c.skin) : far ? c.legDark : c.leg;
    seg(ctx, k.x, k.y, leg.fx, leg.fy, P.LT, legCol);
    if (P.sw.bare) seg(ctx, leg.ax, leg.ay, k.x, k.y, P.LT * 1.5, legCol);
    else {
      // feathered thigh ("drumstick")
      const ta = Math.atan2(k.y - leg.ay, k.x - leg.ax);
      ctx.fillStyle = far ? c.bodyDark : bodyCol;
      ell(ctx, leg.ax + (k.x - leg.ax) * 0.52, leg.ay + (k.y - leg.ay) * 0.52, l1 * 0.6, clamp(P.TD * 0.2, P.LT * 1.2, P.TD * 0.32), ta);
    }
    // spur
    if (P.spur > 0.25) {
      const qx = leg.fx + (k.x - leg.fx) * 0.3, qy = leg.fy + (k.y - leg.fy) * 0.3, sl = P.LT * (1.3 + 2.8 * P.spur);
      ctx.fillStyle = BONE;
      tri(ctx, qx, qy - P.LT * 0.5, qx, qy + P.LT * 0.5, qx - f * sl * 0.88, qy - sl * 0.48);
    }
    // foot
    const lift = leg.lift || 0;
    ctx.save();
    ctx.translate(leg.fx, leg.fy); ctx.rotate(f > 0 ? lift * 0.9 : Math.PI - lift * 0.9); if (f < 0) ctx.scale(1, -1);
    const FL = P.FL, LT = P.LT;
    ctx.fillStyle = legCol;
    if (P.web > 0.5) tri(ctx, -FL * 0.1, -LT * 1.0, FL * 1.0, LT * 0.25, -FL * 0.1, LT * 0.5);
    else { tri(ctx, -FL * 0.12, -LT * 0.6, FL, LT * 0.12, -FL * 0.12, LT * 0.5); }
    tri(ctx, 0, -LT * 0.4, -FL * 0.38, LT * 0.3, 0, LT * 0.48);
    if (P.talon > 0.45) {
      ctx.fillStyle = INK;
      tri(ctx, FL * 0.82, -LT * 0.3, FL * (1.05 + 0.4 * P.talon), LT * 0.4, FL * 0.78, LT * 0.42);
      tri(ctx, -FL * 0.3, -LT * 0.1, -FL * (0.42 + 0.25 * P.talon), LT * 0.42, -FL * 0.22, LT * 0.4);
    }
    if (feet) drawFeetAcc(ctx, feet, FL, LT);
    ctx.restore();
    if (P.sw.fluff) { ctx.fillStyle = far ? c.bodyDark : bodyCol; ell(ctx, leg.fx, leg.fy - P.LT * 0.9, P.FL * 0.55, P.LT * 1.7, 0); }
  }

  function drawArm(ctx, P, a, c, f, far, cl) {
    const l = P.armL / 2, e = RB.pose.knee(a.sx, a.sy, a.x, a.y, l, l, f);
    const skin = far ? c.skinDark : c.skin;
    const upper = cl ? (far ? cl.shirtDark : cl.shirt) : P.sw.bare ? skin : far ? c.wingDark : c.wing;
    const w = P.LT * (P.person ? 1.25 : 1.1);
    seg(ctx, a.sx, a.sy, e.x, e.y, w * 1.15, upper);
    seg(ctx, e.x, e.y, a.x, a.y, w, P.sw.bare ? skin : upper);
    ctx.fillStyle = P.sw.bare ? skin : c.leg; circ(ctx, a.x, a.y, w * 0.8);
    if (P.talon > 0.5) { ctx.fillStyle = INK; tri(ctx, a.x, a.y - w * 0.5, a.x + f * w * 1.9, a.y + w * 0.3, a.x, a.y + w * 0.6); }
  }

  function drawHat(ctx, hat, R) {
    if (hat === 'tophat') {
      ctx.fillStyle = INK; ctx.fillRect(-R * 1.15, -R * 0.98, R * 2.3, R * 0.24); ctx.fillRect(-R * 0.72, -R * 2.25, R * 1.44, R * 1.35);
      ctx.fillStyle = '#e76f51'; ctx.fillRect(-R * 0.72, -R * 1.22, R * 1.44, R * 0.24);
    } else if (hat === 'cowboy') {
      ctx.fillStyle = '#9a5a3c'; ell(ctx, 0, -R * 0.82, R * 1.6, R * 0.26, 0);
      ctx.beginPath(); ctx.moveTo(-R * 0.75, -R * 0.85); ctx.lineTo(-R * 0.55, -R * 1.75); ctx.lineTo(0, -R * 1.55); ctx.lineTo(R * 0.55, -R * 1.75); ctx.lineTo(R * 0.75, -R * 0.85); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#e9b44c'; ctx.fillRect(-R * 0.72, -R * 1.08, R * 1.44, R * 0.18);
    } else if (hat === 'party') {
      ctx.fillStyle = '#e9b44c'; tri(ctx, -R * 0.55, -R * 0.78, R * 0.55, -R * 0.78, 0, -R * 2.35);
      ctx.fillStyle = '#2a9d8f'; tri(ctx, -R * 0.3, -R * 1.45, R * 0.3, -R * 1.45, 0, -R * 2.35);
      ctx.fillStyle = '#e76f51'; circ(ctx, 0, -R * 2.38, R * 0.22);
    } else if (hat === 'crown') {
      ctx.fillStyle = '#f2c14e';
      ctx.beginPath(); ctx.moveTo(-R * 0.8, -R * 0.75); ctx.lineTo(-R * 0.9, -R * 1.7); ctx.lineTo(-R * 0.4, -R * 1.25); ctx.lineTo(0, -R * 1.85); ctx.lineTo(R * 0.4, -R * 1.25); ctx.lineTo(R * 0.9, -R * 1.7); ctx.lineTo(R * 0.8, -R * 0.75); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#e76f51'; circ(ctx, 0, -R * 1.05, R * 0.16);
    } else if (hat === 'bandana') {
      ctx.fillStyle = '#e76f51'; ctx.fillRect(-R * 1.02, -R * 0.78, R * 2.04, R * 0.4);
      tri(ctx, -R * 0.95, -R * 0.7, -R * 1.75, -R * 0.35, -R * 1.5, -R * 1.0);
    } else if (hat === 'helmet') {
      ctx.fillStyle = '#8b97a8'; ctx.beginPath(); ctx.arc(0, -R * 0.2, R * 1.12, Math.PI, 0); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#6b7686'; ctx.fillRect(-R * 1.2, -R * 0.32, R * 2.4, R * 0.2);
    } else if (hat === 'bucket') { // the BFC loyalty reward, worn upside down
      ctx.fillStyle = WHITE; ctx.beginPath(); ctx.moveTo(-R * 0.7, -R * 2.0); ctx.lineTo(R * 0.7, -R * 2.0); ctx.lineTo(R * 1.0, -R * 0.7); ctx.lineTo(-R * 1.0, -R * 0.7); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#d7372f';
      for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo((i * 0.42 - 0.12) * R, -R * 2.0); ctx.lineTo((i * 0.42 + 0.12) * R, -R * 2.0); ctx.lineTo((i * 0.6 + 0.17) * R, -R * 0.7); ctx.lineTo((i * 0.6 - 0.17) * R, -R * 0.7); ctx.closePath(); ctx.fill(); }
      ctx.fillRect(-R * 1.08, -R * 0.86, R * 2.16, R * 0.22);
    } else if (hat === 'star') { // sheriff
      ctx.fillStyle = '#6a5136'; ell(ctx, 0, -R * 0.82, R * 1.55, R * 0.24, 0); ctx.fillRect(-R * 0.7, -R * 1.7, R * 1.4, R * 0.9);
      ctx.fillStyle = '#f2c14e'; circ(ctx, R * 0.1, -R * 1.25, R * 0.24);
    } else if (hat === 'planter') { // the Coronel's: a white planter's hat with a black band, worn over the comb
      ctx.fillStyle = '#f7f4ea'; ell(ctx, 0, -R * 1.02, R * 1.85, R * 0.3, 0);
      ctx.beginPath(); ctx.moveTo(-R * 0.82, -R * 1.05); ctx.quadraticCurveTo(-R * 0.86, -R * 2.1, 0, -R * 2.12); ctx.quadraticCurveTo(R * 0.86, -R * 2.1, R * 0.82, -R * 1.05); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#23314a'; ctx.fillRect(-R * 0.84, -R * 1.42, R * 1.68, R * 0.26);
      ctx.strokeStyle = 'rgba(35,49,74,0.18)'; ctx.lineWidth = R * 0.08; ctx.beginPath(); ctx.moveTo(-R * 0.3, -R * 2.06); ctx.lineTo(-R * 0.18, -R * 1.5); ctx.stroke();
    }
  }


  // ---- accessories (all for show; see items.js). Each draws in the frame of the body part it sits on.
  const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now()) / 1000;
  function ring(ctx, x, y, r, w, col) { ctx.strokeStyle = col; ctx.lineWidth = w; ctx.beginPath(); ctx.arc(x, y, Math.max(0.01, r), 0, TAU); ctx.stroke(); }
  function heart(ctx, x, y, r) { ctx.beginPath(); ctx.arc(x - r * 0.45, y - r * 0.2, r * 0.5, Math.PI, 0); ctx.arc(x + r * 0.45, y - r * 0.2, r * 0.5, Math.PI, 0); ctx.lineTo(x, y + r * 0.85); ctx.closePath(); ctx.fill(); }
  // The newer hats, in the head's frame (as drawHat).
  function drawHat2(ctx, hat, R) {
    const T = now();
    if (hat === 'sombrero') {
      ctx.fillStyle = '#e2b862'; ell(ctx, 0, -R * 0.8, R * 2.3, R * 0.32, 0);
      ctx.beginPath(); ctx.moveTo(-R * 0.7, -R * 0.85); ctx.quadraticCurveTo(-R * 0.6, -R * 2.1, 0, -R * 2.05); ctx.quadraticCurveTo(R * 0.6, -R * 2.1, R * 0.7, -R * 0.85); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#d7372f'; ctx.fillRect(-R * 0.68, -R * 1.12, R * 1.36, R * 0.2); ctx.fillStyle = '#2a9d8f'; ctx.fillRect(-R * 2.2, -R * 0.86, R * 4.4, R * 0.08);
    } else if (hat === 'viking') {
      ctx.fillStyle = BONE;
      ctx.beginPath(); ctx.moveTo(R * 0.55, -R * 0.75); ctx.quadraticCurveTo(R * 1.45, -R * 0.95, R * 1.3, -R * 2.0); ctx.quadraticCurveTo(R * 1.1, -R * 1.2, R * 0.45, -R * 1.2); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-R * 0.55, -R * 0.75); ctx.quadraticCurveTo(-R * 1.45, -R * 0.95, -R * 1.3, -R * 2.0); ctx.quadraticCurveTo(-R * 1.1, -R * 1.2, -R * 0.45, -R * 1.2); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#8b97a8'; ctx.beginPath(); ctx.arc(0, -R * 0.45, R * 1.05, Math.PI, 0); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#c9a227'; ctx.fillRect(-R * 1.08, -R * 0.55, R * 2.16, R * 0.2); ctx.fillRect(-R * 0.1, -R * 1.5, R * 0.2, R * 1.0);
    } else if (hat === 'propeller') {
      const cols = ['#e76f51', '#e9b44c', '#2a9d8f', '#3d6fa5'];
      for (let i = 0; i < 4; i++) { ctx.fillStyle = cols[i]; ctx.beginPath(); ctx.moveTo(0, -R * 0.55); ctx.arc(0, -R * 0.55, R * 0.95, Math.PI + i * Math.PI / 4, Math.PI + (i + 1) * Math.PI / 4); ctx.closePath(); ctx.fill(); }
      seg(ctx, 0, -R * 1.45, 0, -R * 1.9, R * 0.1, INK);
      const k = Math.cos(T * 18);
      ctx.fillStyle = '#d7372f'; ell(ctx, 0, -R * 1.95, R * 1.1 * Math.abs(k) + R * 0.08, R * 0.12, 0);
    } else if (hat === 'flowers') {
      const cols = ['#e76f51', '#f2c14e', '#d98cab', '#ffffff', '#6d4c7d'];
      for (let i = 0; i < 7; i++) { const a = Math.PI + 0.25 + i * (Math.PI - 0.5) / 6, x = Math.cos(a) * R * 0.95, y = Math.sin(a) * R * 0.95 - R * 0.1; ctx.fillStyle = '#7fb069'; ell(ctx, x, y + R * 0.08, R * 0.24, R * 0.1, a + 1.57); ctx.fillStyle = cols[i % cols.length]; circ(ctx, x, y, R * 0.2); ctx.fillStyle = '#f2c14e'; circ(ctx, x, y, R * 0.08); }
    } else if (hat === 'wizard') {
      ctx.fillStyle = '#3d4fa5'; ell(ctx, 0, -R * 0.8, R * 1.45, R * 0.24, 0);
      ctx.beginPath(); ctx.moveTo(-R * 0.75, -R * 0.82); ctx.quadraticCurveTo(-R * 0.3, -R * 2.0, -R * 0.75, -R * 2.9); ctx.lineTo(R * 0.75, -R * 0.82); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#f2c14e'; circ(ctx, -R * 0.05, -R * 1.45, R * 0.12); circ(ctx, R * 0.3, -R * 1.05, R * 0.09); circ(ctx, -R * 0.4, -R * 2.05, R * 0.08);
      ctx.beginPath(); ctx.arc(-R * 0.25, -R * 1.75, R * 0.18, 0.6, 5.0); ctx.arc(-R * 0.17, -R * 1.78, R * 0.14, 5.0, 0.6, true); ctx.closePath(); ctx.fill();
    } else if (hat === 'pirate') {
      ctx.fillStyle = INK; ctx.beginPath(); ctx.moveTo(-R * 1.5, -R * 0.75); ctx.quadraticCurveTo(-R * 1.0, -R * 1.25, -R * 0.75, -R * 1.85); ctx.quadraticCurveTo(0, -R * 1.45, R * 0.75, -R * 1.85); ctx.quadraticCurveTo(R * 1.0, -R * 1.25, R * 1.5, -R * 0.75); ctx.quadraticCurveTo(0, -R * 0.55, -R * 1.5, -R * 0.75); ctx.fill();
      ctx.fillStyle = WHITE; circ(ctx, 0, -R * 1.2, R * 0.22); seg(ctx, -R * 0.3, -R * 0.9, R * 0.3, -R * 0.75, R * 0.07, WHITE); seg(ctx, R * 0.3, -R * 0.9, -R * 0.3, -R * 0.75, R * 0.07, WHITE);
      ctx.fillStyle = '#c9a227'; ctx.fillRect(-R * 1.45, -R * 0.82, R * 2.9, R * 0.08);
    } else if (hat === 'cone') {
      ctx.fillStyle = '#f08a2b'; ctx.beginPath(); ctx.moveTo(-R * 0.8, -R * 0.75); ctx.lineTo(-R * 0.18, -R * 2.6); ctx.lineTo(R * 0.18, -R * 2.6); ctx.lineTo(R * 0.8, -R * 0.75); ctx.closePath(); ctx.fill();
      ctx.fillStyle = WHITE; ctx.fillRect(-R * 0.6, -R * 1.35, R * 1.2, R * 0.22); ctx.fillRect(-R * 0.4, -R * 1.95, R * 0.8, R * 0.18);
      ctx.fillStyle = '#d06a1c'; ctx.fillRect(-R * 1.05, -R * 0.82, R * 2.1, R * 0.16);
    } else if (hat === 'fez') {
      ctx.fillStyle = '#b5232f'; ctx.beginPath(); ctx.moveTo(-R * 0.62, -R * 0.75); ctx.lineTo(-R * 0.48, -R * 1.65); ctx.lineTo(R * 0.48, -R * 1.65); ctx.lineTo(R * 0.62, -R * 0.75); ctx.closePath(); ctx.fill();
      const sw = Math.sin(T * 3) * 0.5;
      seg(ctx, 0, -R * 1.65, -R * 0.7 + sw * R * 0.4, -R * 1.1, R * 0.07, INK); ctx.fillStyle = INK; ell(ctx, -R * 0.72 + sw * R * 0.4, -R * 1.0, R * 0.1, R * 0.22, sw);
    } else if (hat === 'chef') {
      ctx.fillStyle = WHITE; ctx.fillRect(-R * 0.65, -R * 1.45, R * 1.3, R * 0.7);
      circ(ctx, -R * 0.45, -R * 1.75, R * 0.45); circ(ctx, R * 0.45, -R * 1.75, R * 0.45); circ(ctx, 0, -R * 2.05, R * 0.55);
      ctx.fillStyle = '#e4e0d6'; ctx.fillRect(-R * 0.68, -R * 0.95, R * 1.36, R * 0.2);
    } else if (hat === 'halo') {
      ctx.save(); ctx.strokeStyle = '#f2c14e'; ctx.lineWidth = R * 0.18; ctx.shadowColor = 'rgba(242,193,78,0.8)'; ctx.shadowBlur = R * 0.8;
      ctx.beginPath(); ctx.ellipse(0, -R * 1.7 + Math.sin(T * 2) * R * 0.08, R * 0.85, R * 0.24, 0, 0, TAU); ctx.stroke(); ctx.restore();
    } else if (hat === 'laurel') {
      ctx.fillStyle = '#5c9a4a';
      for (let i = 0; i < 6; i++) { const a = Math.PI + 0.35 + i * 0.42; ell(ctx, Math.cos(a) * R * 0.98, Math.sin(a) * R * 0.98, R * 0.26, R * 0.11, a + 1.2); ell(ctx, Math.cos(a + 0.2) * R * 1.08, Math.sin(a + 0.2) * R * 1.08, R * 0.2, R * 0.09, a + 0.4); }
    } else if (hat === 'bonnet') {
      ctx.fillStyle = '#f2b8c6'; ctx.beginPath(); ctx.arc(-R * 0.12, -R * 0.05, R * 1.12, Math.PI * 0.62, Math.PI * 1.85); ctx.closePath(); ctx.fill();
      ctx.fillStyle = WHITE; for (let i = 0; i < 6; i++) { const a = Math.PI * 0.68 + i * 0.37; circ(ctx, -R * 0.12 + Math.cos(a) * R * 1.12, -R * 0.05 + Math.sin(a) * R * 1.12, R * 0.13); }
      seg(ctx, R * 0.2, R * 0.6, R * 0.45, R * 1.05, R * 0.1, '#d98cab');
    }
  }
  // Glasses and such, in the head's frame: (ex, ey, er) the eye; P for the beak.
  function drawFace(ctx, id, P, R, ex, ey, er) {
    const lw = Math.max(0.6, R * 0.09), BD = P.BD || R * 0.4, xt = R * 0.85 + (P.BL || 0);
    const temple = (col) => seg(ctx, ex - er * 1.2, ey, -R * 0.85, ey - R * 0.05, lw, col);
    if (id === 'shades') { temple(INK); ctx.fillStyle = '#1b2236'; ctx.beginPath(); ctx.ellipse(ex + er * 0.15, ey + er * 0.1, er * 1.45, er * 1.05, 0, 0, TAU); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,0.35)'; ell(ctx, ex - er * 0.35, ey - er * 0.35, er * 0.35, er * 0.18, -0.5); seg(ctx, ex + er * 1.5, ey, R * 0.62, ey + R * 0.05, lw, INK); }
    else if (id === 'specs') { temple('#6b4a2e'); ring(ctx, ex, ey, er * 1.3, lw, '#6b4a2e'); seg(ctx, ex + er * 1.3, ey, R * 0.62, ey + R * 0.05, lw, '#6b4a2e'); }
    else if (id === 'monocle') { ring(ctx, ex, ey, er * 1.35, lw * 1.2, '#c9a227'); ctx.strokeStyle = '#c9a227'; ctx.lineWidth = lw * 0.6; ctx.beginPath(); ctx.moveTo(ex - er * 0.6, ey + er * 1.25); ctx.quadraticCurveTo(ex - R * 0.4, ey + R * 1.1, ex - R * 0.9, ey + R * 0.9); ctx.stroke(); }
    else if (id === 'hearts') { temple('#d7372f'); ctx.fillStyle = '#e8456a'; heart(ctx, ex, ey + er * 0.1, er * 1.5); ctx.fillStyle = 'rgba(255,255,255,0.4)'; circ(ctx, ex - er * 0.5, ey - er * 0.3, er * 0.25); }
    else if (id === 'patch') { seg(ctx, -R * 0.9, -R * 0.75, R * 0.6, R * 0.45, lw * 1.2, INK); ctx.fillStyle = INK; ell(ctx, ex, ey, er * 1.25, er * 1.1, 0); }
    else if (id === 'tache') { const mx = R * 0.6, my = BD * 0.35 + R * 0.08; ctx.fillStyle = '#4a3020'; ell(ctx, mx - R * 0.08, my, R * 0.3, R * 0.11, 0.35); ell(ctx, mx + R * 0.28, my + R * 0.02, R * 0.26, R * 0.1, -0.3); circ(ctx, mx - R * 0.36, my - R * 0.08, R * 0.08); }
    else if (id === 'nose') { ctx.fillStyle = '#e0242c'; circ(ctx, P.hasBeak ? xt - R * 0.05 : R * 1.05, P.hasBeak ? BD * 0.05 : R * 0.05, R * 0.3); ctx.fillStyle = 'rgba(255,255,255,0.5)'; circ(ctx, (P.hasBeak ? xt : R * 1.1) - R * 0.12, -R * 0.06, R * 0.08); }
    else if (id === 'goggles') { seg(ctx, -R * 0.95, ey - R * 0.05, ex, ey, R * 0.22, '#3a6b5e'); ctx.fillStyle = 'rgba(160,220,230,0.55)'; circ(ctx, ex, ey, er * 1.55); ring(ctx, ex, ey, er * 1.55, R * 0.14, '#2f4a3a'); }
    else if (id === 'mask') { ctx.fillStyle = INK; ctx.beginPath(); ctx.moveTo(-R * 0.75, ey - er * 0.7); ctx.lineTo(R * 0.72, ey - er * 0.8); ctx.lineTo(R * 0.72, ey + er * 0.9); ctx.lineTo(-R * 0.75, ey + er * 0.8); ctx.closePath(); ctx.fill(); ctx.fillStyle = WHITE; circ(ctx, ex, ey, er * 0.85); ctx.fillStyle = INK; circ(ctx, ex + er * 0.18, ey, er * 0.45); seg(ctx, -R * 0.75, ey, -R * 1.25, ey + R * 0.25, lw, INK); }
  }
  // Round the neck, in the world's frame at (x, y): w is the neck's thickness, f the facing.
  function drawNeckAcc(ctx, id, x, y, w, f) {
    ctx.save(); ctx.translate(x, y); ctx.scale(f, 1);
    const T = now(), u = Math.max(1.5, w);
    if (id === 'bowtie') { ctx.fillStyle = '#d7372f'; tri(ctx, 0, 0, u * 0.9, -u * 0.55, u * 0.9, u * 0.55); tri(ctx, 0, 0, -u * 0.9, -u * 0.55, -u * 0.9, u * 0.55); ctx.fillStyle = '#a3222b'; circ(ctx, 0, 0, u * 0.25); }
    else if (id === 'necktie') { ctx.fillStyle = '#3d6fa5'; tri(ctx, -u * 0.25, -u * 0.2, u * 0.25, -u * 0.2, 0, u * 0.25); ctx.beginPath(); ctx.moveTo(-u * 0.12, u * 0.15); ctx.lineTo(u * 0.12, u * 0.15); ctx.lineTo(u * 0.32, u * 1.9); ctx.lineTo(0, u * 2.25); ctx.lineTo(-u * 0.32, u * 1.9); ctx.closePath(); ctx.fill(); ctx.fillStyle = '#e9b44c'; ctx.fillRect(-u * 0.2, u * 0.8, u * 0.4, u * 0.12); ctx.fillRect(-u * 0.25, u * 1.3, u * 0.5, u * 0.12); }
    else if (id === 'pearls' || id === 'goldchain' || id === 'bones') {
      const col = id === 'pearls' ? '#f5f1e8' : id === 'goldchain' ? '#e3b23c' : BONE, n = 7;
      for (let i = 0; i < n; i++) { const a = Math.PI * 0.15 + i * Math.PI * 0.7 / (n - 1), bx = Math.cos(a) * u * 0.75, by = Math.sin(a) * u * 0.55 - u * 0.1; ctx.fillStyle = col; if (id === 'bones') { ell(ctx, bx, by, u * 0.22, u * 0.08, a); circ(ctx, bx - u * 0.2, by, u * 0.07); circ(ctx, bx + u * 0.2, by, u * 0.07); } else circ(ctx, bx, by, u * (id === 'pearls' ? 0.17 : 0.13)); }
      if (id === 'goldchain') { ctx.fillStyle = '#e3b23c'; circ(ctx, 0, u * 0.75, u * 0.3); ctx.fillStyle = '#c9922a'; circ(ctx, 0, u * 0.75, u * 0.15); }
    } else if (id === 'cowbell') { seg(ctx, -u * 0.6, -u * 0.1, u * 0.6, -u * 0.1, u * 0.2, '#6b4a2e'); const sw = Math.sin(T * 4) * 0.15; ctx.save(); ctx.rotate(sw); ctx.fillStyle = '#c9a227'; ctx.beginPath(); ctx.moveTo(-u * 0.25, 0); ctx.lineTo(u * 0.25, 0); ctx.lineTo(u * 0.4, u * 0.75); ctx.lineTo(-u * 0.4, u * 0.75); ctx.closePath(); ctx.fill(); ctx.fillStyle = INK; circ(ctx, 0, u * 0.8, u * 0.1); ctx.restore(); }
    else if (id === 'ruff') { ctx.fillStyle = '#f5f1e8'; for (let i = 0; i < 9; i++) { const a = i * TAU / 9; circ(ctx, Math.cos(a) * u * 0.8, Math.sin(a) * u * 0.35, u * 0.3); } ctx.fillStyle = '#e4ddcc'; ell(ctx, 0, 0, u * 0.5, u * 0.2, 0); }
    else if (id === 'medal') { ctx.fillStyle = '#3d6fa5'; tri(ctx, -u * 0.5, -u * 0.1, -u * 0.05, -u * 0.1, -u * 0.1, u * 0.9); ctx.fillStyle = '#d7372f'; tri(ctx, u * 0.5, -u * 0.1, u * 0.05, -u * 0.1, u * 0.1, u * 0.9); ctx.fillStyle = '#f2c14e'; circ(ctx, 0, u * 1.05, u * 0.38); ctx.fillStyle = '#c9922a'; circ(ctx, 0, u * 1.05, u * 0.18); }
    else if (id === 'binoculars') { seg(ctx, -u * 0.6, -u * 0.1, -u * 0.2, u * 0.6, u * 0.1, INK); seg(ctx, u * 0.6, -u * 0.1, u * 0.2, u * 0.6, u * 0.1, INK); ctx.fillStyle = '#2b2f3a'; ctx.fillRect(-u * 0.45, u * 0.55, u * 0.38, u * 0.65); ctx.fillRect(u * 0.07, u * 0.55, u * 0.38, u * 0.65); ctx.fillStyle = '#6fa8c9'; circ(ctx, -u * 0.26, u * 1.2, u * 0.13); circ(ctx, u * 0.26, u * 1.2, u * 0.13); }
    ctx.restore();
  }
  // On the back, in the torso's frame (+x the chest, -y the back). behind: the pieces drawn behind the body.
  function drawBackAcc(ctx, id, rx, ry, behind) {
    const T = now();
    if (behind) {
      if (id === 'cape') { const fl = Math.sin(T * 5) * ry * 0.18; ctx.fillStyle = '#c0262d'; ctx.beginPath(); ctx.moveTo(rx * 0.55, -ry * 0.75); ctx.quadraticCurveTo(-rx * 0.2, -ry * 1.25 + fl, -rx * 1.6, -ry * 0.2 + fl); ctx.quadraticCurveTo(-rx * 1.1, ry * 0.4, -rx * 0.3, ry * 0.2); ctx.lineTo(rx * 0.4, -ry * 0.3); ctx.closePath(); ctx.fill(); ctx.fillStyle = '#8f1c22'; ell(ctx, rx * 0.5, -ry * 0.7, ry * 0.2, ry * 0.12, 0); }
      else if (id === 'angel') { const fl = Math.sin(T * 3) * 0.08; ctx.fillStyle = '#ffffff'; for (let i = 0; i < 4; i++) ell(ctx, -rx * 0.15 - i * rx * 0.18, -ry * (1.05 + i * 0.12), ry * (0.9 - i * 0.12), ry * 0.32, -0.7 - i * 0.12 + fl); ctx.fillStyle = '#e8eef5'; ell(ctx, -rx * 0.1, -ry * 0.9, ry * 0.55, ry * 0.3, -0.5 + fl); }
      return;
    }
    if (id === 'backpack') { ctx.fillStyle = '#e76f51'; ctx.beginPath(); ctx.ellipse(-rx * 0.15, -ry * 0.95, rx * 0.42, ry * 0.42, 0, 0, TAU); ctx.fill(); ctx.fillStyle = '#c4553b'; ctx.fillRect(-rx * 0.4, -ry * 0.98, rx * 0.5, ry * 0.18); seg(ctx, rx * 0.15, -ry * 0.8, rx * 0.25, ry * 0.2, ry * 0.08, '#6b4a2e'); }
    else if (id === 'saddle') { ctx.fillStyle = '#8a5a3a'; ctx.beginPath(); ctx.moveTo(-rx * 0.55, -ry * 0.85); ctx.quadraticCurveTo(-rx * 0.6, -ry * 1.35, -rx * 0.35, -ry * 1.25); ctx.quadraticCurveTo(0, -ry * 0.95, rx * 0.25, -ry * 1.35); ctx.quadraticCurveTo(rx * 0.45, -ry * 1.2, rx * 0.35, -ry * 0.85); ctx.closePath(); ctx.fill(); seg(ctx, 0, -ry * 0.9, -rx * 0.05, ry * 0.7, ry * 0.06, '#5a3a24'); ctx.fillStyle = '#c9a227'; ctx.fillRect(-rx * 0.15, ry * 0.65, rx * 0.2, ry * 0.12); }
    else if (id === 'jetpack') { ctx.fillStyle = '#9aa6b5'; ctx.fillRect(-rx * 0.55, -ry * 1.45, rx * 0.28, ry * 0.85); ctx.fillRect(-rx * 0.22, -ry * 1.45, rx * 0.28, ry * 0.85); ctx.fillStyle = '#d7372f'; ctx.fillRect(-rx * 0.55, -ry * 1.5, rx * 0.61, ry * 0.12); const fz = 0.6 + 0.4 * Math.sin(T * 30); ctx.fillStyle = '#f2a541'; tri(ctx, -rx * 0.55, -ry * 0.62, -rx * 0.27, -ry * 0.62, -rx * 0.41, -ry * (0.62 - 0.55 * fz)); tri(ctx, -rx * 0.22, -ry * 0.62, rx * 0.06, -ry * 0.62, -rx * 0.08, -ry * (0.62 - 0.55 * fz)); }
    else if (id === 'shell') { ctx.fillStyle = '#5c8a4a'; ctx.beginPath(); ctx.ellipse(-rx * 0.05, -ry * 0.55, rx * 0.85, ry * 0.75, 0, Math.PI, 0); ctx.closePath(); ctx.fill(); ctx.strokeStyle = '#3f6a33'; ctx.lineWidth = ry * 0.07; for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.arc(-rx * 0.05 + i * rx * 0.45, -ry * 0.75, ry * 0.25, 0, TAU); ctx.stroke(); } ctx.fillStyle = '#a3b86c'; ctx.fillRect(-rx * 0.9, -ry * 0.62, rx * 1.7, ry * 0.12); }
  }
  // On each foot, in the foot's frame (+x the toes): FL the foot's length, LT the leg's thickness.
  function drawFeetAcc(ctx, id, FL, LT) {
    if (id === 'sneakers') { ctx.fillStyle = WHITE; ell(ctx, FL * 0.4, -LT * 0.1, FL * 0.72, LT * 0.95, 0); ctx.fillStyle = '#d7372f'; ell(ctx, FL * 0.3, -LT * 0.25, FL * 0.32, LT * 0.3, -0.2); ctx.fillStyle = '#c9c2b2'; ctx.fillRect(-FL * 0.3, LT * 0.55, FL * 1.4, LT * 0.3); }
    else if (id === 'rainboots') { ctx.fillStyle = '#f2c14e'; ctx.fillRect(-LT * 1.1, -LT * 4.2, LT * 2.2, LT * 4.4); ell(ctx, FL * 0.35, LT * 0.1, FL * 0.68, LT * 0.85, 0); ctx.fillStyle = '#d9a21b'; ctx.fillRect(-LT * 1.2, -LT * 4.3, LT * 2.4, LT * 0.5); }
    else if (id === 'socks') { for (let i = 0; i < 5; i++) { ctx.fillStyle = i % 2 ? WHITE : '#e76f51'; ctx.fillRect(-LT * 0.85, -LT * (0.6 + i * 0.75), LT * 1.7, LT * 0.78); } ctx.fillStyle = '#e76f51'; ell(ctx, FL * 0.15, 0, FL * 0.4, LT * 0.7, 0); }
    else if (id === 'skates') { ctx.fillStyle = '#6d4c7d'; ell(ctx, FL * 0.35, -LT * 0.2, FL * 0.72, LT * 1.0, 0); ctx.fillRect(-LT, -LT * 2.4, LT * 2, LT * 2.2); ctx.fillStyle = '#f2c14e'; for (let i = 0; i < 3; i++) circ(ctx, -FL * 0.15 + i * FL * 0.5, LT * 1.1, LT * 0.5); }
    else if (id === 'slippers') { ctx.fillStyle = '#f7c6d4'; ell(ctx, FL * 0.4, -LT * 0.15, FL * 0.8, LT * 1.15, 0); ell(ctx, FL * 0.85, -LT * 1.4, LT * 0.35, LT * 1.0, -0.3); ell(ctx, FL * 0.6, -LT * 1.4, LT * 0.35, LT * 1.0, 0.2); ctx.fillStyle = INK; circ(ctx, FL * 0.95, -LT * 0.25, LT * 0.18); }
  }
  // At the base of the tail, in the world's frame: f the facing (the tail points the other way).
  function drawTailAcc(ctx, id, x, y, f, s) {
    ctx.save(); ctx.translate(x, y); ctx.scale(-f, 1);
    const T = now();
    if (id === 'ribbon') { ctx.fillStyle = '#e8456a'; ell(ctx, s * 0.25, -s * 0.18, s * 0.28, s * 0.16, -0.6); ell(ctx, s * 0.25, s * 0.18, s * 0.28, s * 0.16, 0.6); circ(ctx, s * 0.05, 0, s * 0.1); tri(ctx, 0, 0, s * 0.45, s * 0.55, s * 0.3, s * 0.6); }
    else if (id === 'flag') { seg(ctx, 0, 0, s * 0.35, -s * 1.6, s * 0.06, '#6b4a2e'); const wv = Math.sin(T * 6) * s * 0.08; ctx.fillStyle = '#2a9d8f'; ctx.beginPath(); ctx.moveTo(s * 0.33, -s * 1.55); ctx.quadraticCurveTo(s * 0.7, -s * 1.5 + wv, s * 0.95, -s * 1.38); ctx.quadraticCurveTo(s * 0.7, -s * 1.2 - wv, s * 0.28, -s * 1.2); ctx.closePath(); ctx.fill(); ctx.fillStyle = '#f2c14e'; circ(ctx, s * 0.58, -s * 1.38, s * 0.07); }
    else if (id === 'pompom') { const b = Math.sin(T * 6) * s * 0.05, cols = ['#e8456a', '#f2c14e', '#2a9d8f', '#6d4c7d', '#e76f51']; for (let i = 0; i < 7; i++) { const a = i * TAU / 7; ctx.fillStyle = cols[i % cols.length]; circ(ctx, s * 0.32 + Math.cos(a) * s * 0.16, -s * 0.05 + b + Math.sin(a) * s * 0.16, s * 0.14); } ctx.fillStyle = WHITE; circ(ctx, s * 0.32, -s * 0.05 + b, s * 0.1); }
    else if (id === 'streamers') { const cols = ['#e8456a', '#f2c14e', '#2a9d8f']; ctx.lineWidth = s * 0.07; ctx.lineCap = 'round'; for (let i = 0; i < 3; i++) { ctx.strokeStyle = cols[i]; ctx.beginPath(); ctx.moveTo(0, -s * 0.05 * i); for (let k = 1; k <= 8; k++) ctx.lineTo(k * s * 0.14, -s * 0.05 * i + Math.sin(T * 7 + k * 0.9 + i * 2) * s * 0.1 + k * s * 0.03); ctx.stroke(); } }
    else if (id === 'sparkler') { seg(ctx, 0, 0, s * 0.55, -s * 0.9, s * 0.05, '#8b97a8'); const cx = s * 0.55, cy = -s * 0.9; ctx.strokeStyle = '#ffd54a'; ctx.lineWidth = s * 0.04; for (let i = 0; i < 9; i++) { const a = i * TAU / 9 + T * 7, l = s * (0.15 + 0.15 * Math.abs(Math.sin(T * 13 + i))); ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a) * l, cy + Math.sin(a) * l); ctx.stroke(); } ctx.fillStyle = WHITE; circ(ctx, cx, cy, s * 0.06); }
    ctx.restore();
  }
  // A little picture of an accessory, for shop and wardrobe lists.
  function accIcon(ctx, id, x, y, s) {
    const kind = (RB.items.ITEMS[id] || {}).kind;
    ctx.save(); ctx.translate(x, y);
    const R = s * (kind === 'face' ? 0.36 : 0.26);
    if (kind === 'hat' || kind === 'face') {
      ctx.translate(0, kind === 'hat' ? s * 0.22 : 0);
      ctx.fillStyle = '#e9dcc0'; circ(ctx, 0, 0, R); ctx.fillStyle = '#d9a21b'; tri(ctx, R * 0.6, -R * 0.25, R * 1.5, R * 0.1, R * 0.6, R * 0.35);
      if (kind === 'hat') { drawHat(ctx, id, R); drawHat2(ctx, id, R); }
      else drawFace(ctx, id, { BD: R * 0.5, BL: R * 0.6, hasBeak: true }, R, R * 0.28, -R * 0.18, R * 0.3);
    } else if (kind === 'neck') { seg(ctx, 0, -s * 0.45, 0, s * 0.1, s * 0.26, '#e9dcc0'); drawNeckAcc(ctx, id, 0, -s * 0.22, s * 0.34, 1); }
    else if (kind === 'back') { ctx.translate(s * 0.05, s * 0.18); drawBackAcc(ctx, id, s * 0.3, s * 0.22, true); ctx.fillStyle = '#e9dcc0'; ell(ctx, 0, 0, s * 0.32, s * 0.22, 0); drawBackAcc(ctx, id, s * 0.3, s * 0.22, false); }
    else if (kind === 'feet') { ctx.translate(-s * 0.2, s * 0.25); seg(ctx, 0, -s * 0.6, 0, 0, s * 0.1, '#e9b44c'); drawFeetAcc(ctx, id, s * 0.55, s * 0.14); }
    else if (kind === 'tail') { ctx.translate(-s * 0.15, s * 0.3); ctx.fillStyle = '#e9dcc0'; ell(ctx, s * 0.15, 0, s * 0.25, s * 0.15, 0); drawTailAcc(ctx, id, -s * 0.05, 0, 1, s * 0.55); }
    ctx.restore();
  }


  // ---- bills of other shapes (genome.js: billShape), in the head's frame like the plain one:
  // +x the way the bill points, +y the chin side; x0 where it leaves the face, xt its tip.
  function drawShapedBill(ctx, P, c, R, x0, xt, BD, gape, headCol) {
    const L = xt - x0, sh = P.shape, poly = (pts, col) => { ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]); ctx.closePath(); ctx.fill(); };
    const teeth = (xa, xb, y0, y1, n, up, size) => { ctx.fillStyle = WHITE; for (let i = 0; i < n; i++) { const u = (i + 0.5) / n, x = xa + (xb - xa) * u, y = y0 + (y1 - y0) * u, w = size * (1 - 0.35 * u); tri(ctx, x - w, y, x + w, y, x, y + (up ? -w * 2.2 : w * 2.2)); } };
    if (sh === 'spoon') { // a long flat bill ending in a round spoon
      const sR = Math.max(BD * 0.55, L * 0.11), xs = xt - sR * 1.5;
      poly([x0, BD * 0.1, xs, BD * 0.14 + gape, x0, BD * 0.5 + gape * 0.5], c.beakDark);
      poly([x0, -BD * 0.5, xs, -BD * 0.22, xs, BD * 0.14, x0, BD * 0.16], c.beak);
      ctx.fillStyle = c.beak; ell(ctx, xt - sR, 0, sR * 1.15, sR * 0.65, 0);
      ctx.strokeStyle = c.beakDark; ctx.lineWidth = Math.max(0.4, BD * 0.08); ctx.beginPath(); ctx.ellipse(xt - sR, 0, sR * 1.15, sR * 0.65, 0, 0, TAU); ctx.stroke();
    } else if (sh === 'down' || sh === 'up') { // a sickle curved down (ibis, curlew) or an awl curved up (avocet)
      const dn = sh === 'down', ty = dn ? L * 0.42 : -L * 0.3, tx = x0 + L * (dn ? 0.9 : 0.95);
      const curve = (dy, col, w) => {
        ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(x0, -BD * w + dy);
        ctx.quadraticCurveTo(x0 + L * (dn ? 0.72 : 0.55), (dn ? -BD * 0.45 : ty * 0.2 - BD * 0.4) + dy, tx, ty + dy);
        ctx.quadraticCurveTo(x0 + L * (dn ? 0.6 : 0.7), (dn ? ty * 0.25 + BD * 0.5 : BD * 0.35) + dy, x0, BD * w + dy); ctx.closePath(); ctx.fill();
      };
      curve(gape * 0.6, c.beakDark, 0.42); curve(0, c.beak, 0.5);
    } else if (sh === 'crossed') { // the tips cross over: the upper hooks down past the lower, the lower turns up
      poly([x0, BD * 0.15, xt - BD * 0.3, BD * 0.2 + gape * 0.5, xt - BD * 0.05, -BD * 0.5 + gape * 0.5, xt - BD * 0.4, BD * 0.05 + gape * 0.5, x0 - R * 0.05, BD * 0.62 + gape * 0.4], c.beakDark);
      ctx.fillStyle = c.beak; ctx.beginPath(); ctx.moveTo(x0, -BD * 0.62);
      ctx.quadraticCurveTo(x0 + L * 0.75, -BD * 0.85, xt, BD * 0.7); ctx.quadraticCurveTo(xt - BD * 0.35, BD * 0.2, x0, BD * 0.18); ctx.closePath(); ctx.fill();
    } else if (sh === 'casque') { // a big bill with a hollow helmet on top (hornbill)
      poly([x0, BD * 0.1, x0 + L * 0.85, BD * 0.22 + gape, x0 - R * 0.05, BD * 0.62 + gape * 0.4], c.beakDark);
      ctx.fillStyle = c.beak; ctx.beginPath(); ctx.moveTo(x0, -BD * 0.62); ctx.quadraticCurveTo(x0 + L * 0.7, -BD * 0.7, xt, BD * 0.25); ctx.lineTo(x0, BD * 0.18); ctx.closePath(); ctx.fill();
      ctx.fillStyle = c.beak; ctx.beginPath(); ctx.moveTo(x0 - R * 0.12, -BD * 0.6); ctx.quadraticCurveTo(x0 - R * 0.05, -BD * 1.75, x0 + L * 0.3, -BD * 1.55);
      ctx.quadraticCurveTo(x0 + L * 0.62, -BD * 1.25, x0 + L * 0.66, -BD * 0.68); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = c.beakDark; ctx.lineWidth = Math.max(0.4, BD * 0.1); ctx.beginPath(); ctx.moveTo(x0 + L * 0.52, -BD * 1.38); ctx.lineTo(x0 + L * 0.6, -BD * 0.7); ctx.stroke();
    } else if (sh === 'skimmer') { // the lower half longer than the upper, a black tip on each
      poly([x0, BD * 0.05, xt + L * 0.15, BD * 0.2 + gape, x0, BD * 0.55 + gape * 0.5], c.beak);
      poly([xt - L * 0.12, BD * 0.12 + gape * 0.8, xt + L * 0.15, BD * 0.2 + gape, xt - L * 0.1, BD * 0.32 + gape * 0.85], INK);
      poly([x0, -BD * 0.55, xt - L * 0.14, -BD * 0.05, x0, BD * 0.05], c.beak);
      poly([xt - L * 0.32, -BD * 0.18, xt - L * 0.14, -BD * 0.05, xt - L * 0.3, BD * 0.03], INK);
    } else if (sh === 'sword') { // a needle, longer than the bird
      poly([x0, BD * 0.05, xt - BD * 0.4, BD * 0.04 + gape * 0.3, x0, BD * 0.4 + gape * 0.3], c.beakDark);
      poly([x0, -BD * 0.45, xt, -BD * 0.02, x0, BD * 0.06], c.beak);
    } else if (sh === 'jaws' || sh === 'snout') {
      // toothy reptile jaws in the face's own skin: deep and heavy (tyrannosaur), or long and narrow
      // with a knob at the tip, like a crocodile's (spinosaur)
      const croc = sh === 'snout', dark = P.sw.bare ? c.skinDark : c.bodyDark, d = croc ? BD * 0.55 : BD * 0.8, jl = BD * (croc ? 0.12 : 0.2);
      // lower jaw
      poly([R * 0.25, jl + gape * 0.15, xt - d * (croc ? 0.25 : 0.45), jl + gape, xt - d * (croc ? 0.4 : 0.7), jl + d * (croc ? 0.55 : 0.85) + gape, R * 0.2, R * 0.8], dark);
      // upper jaw and snout
      ctx.fillStyle = headCol; ctx.beginPath(); ctx.moveTo(R * 0.15, -R * 0.62);
      if (croc) { ctx.lineTo(x0 + L * 0.35, -d * 0.55); ctx.lineTo(xt - d * 0.9, -d * 0.45); ctx.quadraticCurveTo(xt + d * 0.15, -d * 0.75, xt, jl * 0.5); }
      else { ctx.quadraticCurveTo(x0 + L * 0.45, -d * 0.95, xt - d * 0.35, -d * 0.45); ctx.quadraticCurveTo(xt + d * 0.05, -d * 0.2, xt - d * 0.05, jl); }
      ctx.lineTo(R * 0.35, jl); ctx.closePath(); ctx.fill();
      // both rows of teeth, over the lips: they interlock when the mouth is shut
      teeth(R * 0.5, xt - d * (croc ? 0.3 : 0.4), jl, jl, croc ? 10 : 8, false, Math.max(0.5, d * (croc ? 0.17 : 0.17)));
      teeth(R * 0.6, xt - d * (croc ? 0.45 : 0.6), jl + gape, jl + gape, croc ? 9 : 7, true, Math.max(0.5, d * (croc ? 0.15 : 0.15)));
      ctx.fillStyle = dark; ell(ctx, xt - d * (croc ? 0.25 : 0.45), -d * (croc ? 0.35 : 0.45), Math.max(0.4, d * 0.1), Math.max(0.3, d * 0.06), 0); // nostril
      ctx.strokeStyle = dark; ctx.lineWidth = Math.max(0.4, d * 0.06); ctx.beginPath(); ctx.moveTo(R * 0.4, jl); ctx.lineTo(xt - d * 0.1, jl); ctx.stroke(); // the lips
    }
  }
  // A sail along the back (genome.js: sail), in the torso's frame (-y is the back): skin stretched over
  // long spines, highest in the middle, coloured like a comb.
  function drawSail(ctx, P, c, rx, ry) {
    const xa = -rx * 0.8, xb = rx * 0.55, base = -ry * 0.55, H = Math.max(3, P.TD * 1.15), n = 10, tops = [];
    for (let i = 0; i <= n; i++) { const u = i / n; tops.push([xa + (xb - xa) * u, base - H * Math.pow(Math.sin(Math.PI * u), 0.8) * (0.9 + 0.1 * Math.sin(u * 17))]); }
    ctx.fillStyle = c.comb; ctx.beginPath(); ctx.moveTo(xa, base);
    for (const [x, y] of tops) ctx.lineTo(x, y);
    ctx.lineTo(xb, base); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(35,49,74,0.32)'; ctx.lineWidth = Math.max(0.5, P.TD * 0.04); ctx.lineCap = 'round';
    ctx.beginPath(); for (const [x, y] of tops.slice(1, -1)) { ctx.moveTo(x, base); ctx.lineTo(x, y - H * 0.04); } ctx.stroke();
  }
  // Head in its own frame: +x is the beak direction, +y is the chin side.
  function drawHead(ctx, P, c, o, pose, cl) {
    const R = P.HR, bare = P.sw.bare, eyeState = pose.eye || '', open = (pose.beakOpen || 0);
    const headCol = bare || P.bareHead > 0.5 ? c.skin : c.head;
    // behind the head: comb, crest, tufts, wattles, long hair
    if (P.comb > 0.12 && !P.person) {
      const cs = P.comb;
      ctx.fillStyle = c.comb; ctx.strokeStyle = c.comb; ctx.lineJoin = 'round'; ctx.lineWidth = R * 0.14;
      if (P.combType === 'single') {
        for (let i = 0; i < 4; i++) {
          const bx = R * (0.72 - i * 0.42);
          ctx.beginPath(); ctx.moveTo(bx - R * 0.3, -R * 0.55); ctx.lineTo(bx + R * 0.3, -R * 0.55);
          ctx.lineTo(bx - R * 0.06, -R * (0.8 + 0.8 * cs * (1 - 0.2 * Math.abs(i - 1.2)))); ctx.closePath(); ctx.fill(); ctx.stroke();
        }
      } else if (P.combType === 'rose') {
        ell(ctx, R * 0.1, -R * 0.94, R * 0.75 * cs + R * 0.1, R * 0.28 * cs + R * 0.08, 0);
        tri(ctx, -R * 0.4, -R * 1.05, -R * 0.4, -R * 0.75, -R * (0.9 + 0.5 * cs), -R * 1.0);
      } else if (P.combType === 'pea') {
        for (let i = 0; i < 3; i++) circ(ctx, R * (0.55 - i * 0.4), -R * 0.98, R * (0.14 + 0.1 * cs));
      } else if (P.combType === 'knob') circ(ctx, R * 0.72, -R * 0.62, R * (0.22 + 0.3 * cs));
      else {
        ctx.beginPath(); ctx.moveTo(R * 0.75, -R * 0.45); ctx.lineTo(R * 0.05, -R * (1.0 + 1.2 * cs)); ctx.lineTo(-R * 0.65, -R * 0.55); ctx.closePath(); ctx.fill(); ctx.stroke();
      }
    }
    if (P.sw.earTuft && !P.person) {
      ctx.fillStyle = c.head;
      tri(ctx, -R * 0.6, -R * 0.65, -R * 0.2, -R * 1.75, R * 0.05, -R * 0.8);
      tri(ctx, R * 0.2, -R * 0.82, R * 0.55, -R * 1.7, R * 0.78, -R * 0.55);
    }
    if (P.crest > 0.3 && !P.person) {
      const n = 3 + Math.round(P.crest * 2);
      for (let i = 0; i < n; i++) {
        const a = -Math.PI / 2 - 0.35 - i * 0.3, len = R * (0.7 + 1.7 * P.crest) * (1 - i * 0.08);
        ctx.fillStyle = i % 2 && P.sheen > 0.5 ? c.accent : c.head;
        ell(ctx, -R * 0.1 + Math.cos(a) * len * 0.45, -R * 0.6 + Math.sin(a) * len * 0.45, len / 2, R * 0.17, a);
      }
    }
    if (P.person && P.crest > 0.7) { ctx.fillStyle = c.hair; ell(ctx, -R * 0.72, R * 0.55, R * 0.48, R * (0.5 + P.crest), 0.1); }
    if (P.wattle > 0.2 && !P.person) { ctx.fillStyle = c.comb; ell(ctx, R * 0.42, R * 0.95, R * 0.22 * P.wattle + R * 0.05, R * 0.55 * P.wattle + R * 0.1, 0.15); }
    ctx.fillStyle = headCol; circ(ctx, 0, 0, R);
    if (P.person && P.crest > 0.3) {
      ctx.fillStyle = c.hair; ctx.beginPath(); ctx.arc(0, 0, R * 1.07, -Math.PI / 2 + 0.75, -Math.PI - 0.5, true); ctx.closePath(); ctx.fill();
    }
    // beak, or a nose and mouth
    const BL = P.BL, BD = P.BD, hk = P.hook, x0 = R * 0.55, xt = R * 0.85 + BL, gape = open * (BL * 0.3 + R * 0.25);
    if (P.hasBeak && P.shape && P.shape !== 'plain') drawShapedBill(ctx, P, c, R, x0, xt, BD, gape, headCol);
    else if (P.hasBeak) {
      if (P.pouch > 0.4) {
        ctx.fillStyle = c.beakDark; ctx.beginPath(); ctx.moveTo(x0, BD * 0.3);
        ctx.quadraticCurveTo((x0 + xt) / 2, BD * 0.3 + BL * 0.55 * P.pouch, xt - BD * 0.3, BD * 0.25); ctx.closePath(); ctx.fill();
      }
      ctx.fillStyle = c.beakDark;
      if (P.flat > 0.5) {
        tri(ctx, x0, BD * 0.12, xt - BD * 0.5, BD * 0.32 + gape, x0, BD * 0.58 + gape * 0.5);
        ctx.fillStyle = c.beak;
        ctx.beginPath(); ctx.moveTo(x0, -BD * 0.5); ctx.lineTo(xt - BD * 0.45, -BD * 0.46);
        ctx.quadraticCurveTo(xt + BD * 0.2, -BD * 0.1, xt - BD * 0.12, BD * 0.26); ctx.lineTo(x0, BD * 0.2); ctx.closePath(); ctx.fill();
      } else {
        tri(ctx, x0, BD * 0.1, x0 + (xt - x0) * (0.92 - 0.3 * hk), BD * 0.22 + gape, x0 - R * 0.05, BD * 0.62 + gape * 0.4);
        ctx.fillStyle = c.beak;
        ctx.beginPath(); ctx.moveTo(x0, -BD * 0.62);
        ctx.quadraticCurveTo(x0 + (xt - x0) * 0.7, -BD * (0.62 + 0.25 * hk), xt, BD * (0.75 * hk - 0.05));
        ctx.lineTo(x0, BD * 0.18); ctx.closePath(); ctx.fill();
      }
      if (P.sw.teeth) {
        ctx.fillStyle = WHITE;
        const n = 5, y0 = BD * 0.18, y1 = BD * (0.75 * hk - 0.05), tw = Math.max(0.5, BL * 0.07);
        for (let i = 0; i < n; i++) {
          const u = 0.15 + 0.7 * i / (n - 1), x = x0 + (xt - x0) * u, y = y0 + (y1 - y0) * u;
          tri(ctx, x - tw, y - tw * 0.2, x + tw, y - tw * 0.2, x, y + tw * 2.2);
        }
      }
    } else {
      ctx.fillStyle = c.skinDark; tri(ctx, R * 0.9, -R * 0.12, R * 1.28, R * 0.2, R * 0.88, R * 0.3);
      if (open > 0.3) { ctx.fillStyle = INK; ell(ctx, R * 0.62, R * 0.52, R * 0.2, R * 0.2 * open + R * 0.06, 0); }
      else seg(ctx, R * 0.45, R * 0.52, R * 0.85, R * 0.5, R * 0.09, INK);
      if (P.sw.teeth) { ctx.fillStyle = WHITE; tri(ctx, R * 0.6, R * 0.5, R * 0.72, R * 0.5, R * 0.66, R * 0.72); }
    }
    // eye
    let ex = R * 0.28, ey = -R * 0.18, er = clamp(R * 0.34 * P.eye, R * 0.14, R * 0.72);
    if (P.sw.cyclops) { ex = R * 0.36; ey = -R * 0.05; er = Math.min(R * 0.8, er * 1.5); }
    if (P.person) er *= 0.8;
    if (eyeState === 'ko') {
      seg(ctx, ex - er * 0.8, ey - er * 0.8, ex + er * 0.8, ey + er * 0.8, er * 0.36, INK);
      seg(ctx, ex - er * 0.8, ey + er * 0.8, ex + er * 0.8, ey - er * 0.8, er * 0.36, INK);
    } else if (eyeState === 'blink' || eyeState === 'sleep') {
      seg(ctx, ex - er * 0.9, ey + er * 0.1, ex + er * 0.9, ey + er * 0.1, er * 0.34, INK);
    } else {
      ctx.fillStyle = P.t.eyeTone > 0.75 ? c.iris : WHITE; circ(ctx, ex, ey, er);
      ctx.fillStyle = INK; circ(ctx, ex + er * 0.18, ey, er * (eyeState === 'scared' ? 0.3 : 0.55));
      ctx.fillStyle = WHITE; circ(ctx, ex + er * 0.32, ey - er * 0.26, er * 0.16);
      if (eyeState === 'angry') { ctx.fillStyle = INK; tri(ctx, ex - er * 1.25, ey - er * 1.35, ex + er * 1.35, ey - er * 0.3, ex + er * 0.6, ey - er * 1.3); }
    }
    if (o.acc && o.acc.face) drawFace(ctx, o.acc.face, P, R, ex, ey, er);
    const hat = o.hat || (cl && cl.hat);
    if (hat) { drawHat(ctx, hat, R); drawHat2(ctx, hat, R); }
  }

  function drawNeckHead(ctx, P, pose, c, o, cl, bodyCol, rot, scale) {
    const f = pose.f, n = pose.neck.length;
    const bx = pose.cx, by = pose.cy;
    const pts = [bx, by];
    const cr = Math.cos(rot), sr = Math.sin(rot);
    for (let i = 0; i < n; i += 2) {
      const dx = (pose.neck[i] - bx) * scale, dy = (pose.neck[i + 1] - by) * scale;
      pts.push(bx + dx * cr - dy * sr, by + dx * sr + dy * cr);
    }
    const m = pts.length, hx = pts[m - 2], hy = pts[m - 1];
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.strokeStyle = P.sw.bare || P.bareHead > 0.5 ? c.skin : bodyCol; ctx.lineWidth = P.person ? Math.min(P.NT, P.HR * 0.95) : P.NT;
    ctx.beginPath(); ctx.moveTo(pts[0], pts[1]);
    for (let i = 2; i < m; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
    ctx.stroke();
    if (!P.sw.bare && P.bareHead <= 0.5 && m >= 6) { // head-coloured top of the neck
      ctx.strokeStyle = c.head; ctx.beginPath(); ctx.moveTo((pts[m - 4] + hx) / 2, (pts[m - 3] + hy) / 2); ctx.lineTo(hx, hy); ctx.stroke();
    }
    if (P.sheen > 0.5 && !P.sw.bare && m >= 4) {
      const ax = pts[m - 4], ay = pts[m - 3];
      ctx.strokeStyle = c.accent; ctx.lineCap = 'butt'; ctx.beginPath();
      ctx.moveTo(ax + (hx - ax) * 0.25, ay + (hy - ay) * 0.25); ctx.lineTo(ax + (hx - ax) * 0.6, ay + (hy - ay) * 0.6); ctx.stroke(); ctx.lineCap = 'round';
    }
    ctx.save();
    ctx.translate(hx, hy); ctx.rotate(pose.headAng + rot); if (f < 0) ctx.scale(1, -1);
    drawHead(ctx, P, c, o, pose, cl);
    ctx.restore();
    if (o.acc && o.acc.neck && scale === 1 && m >= 4) { // at the throat, just under the head
      const want = P.HR * 1.05;
      let left = want, i = m - 2;
      while (i > 0) { const d = Math.hypot(pts[i] - pts[i - 2], pts[i + 1] - pts[i - 1]); if (d >= left) break; left -= d; i -= 2; }
      const px = pts[Math.max(0, i - 2)], py = pts[Math.max(0, i - 1)], d = Math.hypot(pts[i] - px, pts[i + 1] - py) || 1, k = Math.min(1, left / d);
      drawNeckAcc(ctx, o.acc.neck, pts[i] + (px - pts[i]) * k, pts[i + 1] + (py - pts[i + 1]) * k, Math.max(P.NT * 0.9, P.HR * 0.55), f);
    }
  }

  function drawPass(ctx, P, pose, o, c) {
    const f = pose.f, hx = pose.hx, hy = pose.hy, cx = pose.cx, cy = pose.cy;
    const ang = Math.atan2(cy - hy, cx - hx), mx = (hx + cx) / 2, my = (hy + cy) / 2;
    const TL = P.TL, TD = P.TD, ry = TD / 2, rx = TL / 2 + TD * 0.22;
    const cl = o.clothes && c === P.css ? o.clothes : null;
    const acc = c === P.css && o.acc ? o.acc : {}, oo = c === P.css ? o : Object.assign({}, o, { acc: null });
    o = oo;
    const bodyCol = P.sw.bare ? c.skin : c.body;
    if (P.sw.glow && c === P.css) {
      ctx.save(); ctx.fillStyle = c.accent;
      ctx.globalAlpha *= 0.1; circ(ctx, mx, my, TL * 1.15); ctx.globalAlpha *= 1.3; circ(ctx, mx, my, TL * 0.8);
      ctx.restore();
    }
    drawWing(ctx, P, pose, c, true, mx, my, ang);
    for (const leg of pose.legs) if (leg.side === 1) drawLeg(ctx, P, leg, c, f, true, cl, bodyCol, acc.feet);
    if (pose.arms) drawArm(ctx, P, pose.arms[1], c, f, true, cl);
    drawTail(ctx, P, pose, c, bodyCol);
    if (acc.tail) drawTailAcc(ctx, acc.tail, hx, hy, f, Math.max(TD * 0.6, 4));
    // torso, in its own frame: +x towards the chest, +y the belly side
    ctx.save();
    ctx.translate(mx, my); ctx.rotate(ang); if (f < 0) ctx.scale(1, -1);
    if (acc.back) drawBackAcc(ctx, acc.back, rx, ry, true);
    if (P.sw.sail && !P.person && !cl) drawSail(ctx, P, c, rx, ry);
    if (cl || P.person) {
      // a person's trunk: rounded at the hips, square at the shoulders, which end where the neck begins
      const hw = TD * 0.475, x0 = -TL / 2 + TD * 0.1 - hw, x1 = TL / 2, rr0 = hw, rr1 = TD * 0.28;
      ctx.fillStyle = cl ? cl.shirt : bodyCol;
      ctx.beginPath(); ctx.moveTo(x1 - rr1, -hw); ctx.arcTo(x1, -hw, x1, -hw + rr1, rr1); ctx.lineTo(x1, hw - rr1); ctx.arcTo(x1, hw, x1 - rr1, hw, rr1);
      ctx.lineTo(x0 + rr0, hw); ctx.arc(x0 + rr0, 0, hw, Math.PI / 2, Math.PI * 1.5); ctx.closePath(); ctx.fill();
      if (cl && cl.tie) { // a black string tie, down the front from the collar
        ctx.fillStyle = INK; const ty = hw * 0.55;
        tri(ctx, x1, ty - TD * 0.06, x1, ty + TD * 0.06, x1 - TD * 0.12, ty);
        ctx.strokeStyle = INK; ctx.lineWidth = Math.max(0.6, TD * 0.035); ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(x1 - TD * 0.1, ty); ctx.lineTo(x1 - TD * 0.62, ty + TD * 0.08); ctx.moveTo(x1 - TD * 0.1, ty); ctx.lineTo(x1 - TD * 0.6, ty - TD * 0.04); ctx.stroke();
      }
    } else {
      const chestR = ry * (0.9 + 0.16 * P.chest);
      ctx.fillStyle = bodyCol;
      ell(ctx, 0, 0, rx, ry, 0); circ(ctx, TL / 2 - TD * 0.1, ry * 0.08, chestR);
      if (!P.sw.bare && (P.belly > 0.25 || P.pattern !== 'solid')) {
        ctx.save();
        ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, 0, TAU); ctx.arc(TL / 2 - TD * 0.1, ry * 0.08, chestR, 0, TAU); ctx.clip();
        if (P.belly > 0.25) { ctx.fillStyle = c.belly; ell(ctx, TL * 0.1, ry * (1.15 - 0.55 * P.belly), rx * 0.95, ry * 0.9, 0); }
        const pat = patternData(P);
        ctx.fillStyle = c.pat; ctx.strokeStyle = c.pat;
        if (P.pattern === 'barred') {
          const st = TD * 0.28;
          for (let x = -rx; x < rx + ry; x += st) ctx.fillRect(x, -ry * 1.2, st * 0.4, ry * 2.6);
        } else if (P.pattern === 'speckled') {
          for (const d of pat.dots) circ(ctx, d[0] * rx, d[1] * ry, TD * 0.065 * d[2]);
        } else if (P.pattern === 'laced') {
          ctx.lineWidth = TD * 0.04; ctx.lineCap = 'butt';
          let row = 0;
          for (let y = -ry * 0.7; y < ry * 1.1; y += TD * 0.23, row++) {
            for (let x = -rx + (row % 2) * TD * 0.15; x < rx + ry; x += TD * 0.3) { ctx.beginPath(); ctx.arc(x, y, TD * 0.12, 0, Math.PI); ctx.stroke(); }
          }
        } else if (P.pattern === 'pied') {
          for (const b of pat.blobs) ell(ctx, b[0] * rx, b[1] * ry, b[2] * rx, b[2] * ry * 1.3, b[3]);
        }
        ctx.restore();
      }
    }
    if (acc.back) drawBackAcc(ctx, acc.back, rx, ry, false);
    ctx.restore();
    for (const leg of pose.legs) if (leg.side === 0) drawLeg(ctx, P, leg, c, f, false, cl, bodyCol, acc.feet);
    if (P.twoHeads) drawNeckHead(ctx, P, pose, c, o, cl, bodyCol, -f * 0.55, 0.92);
    drawNeckHead(ctx, P, pose, c, o, cl, bodyCol, P.twoHeads ? f * 0.12 : 0, 1);
    drawWing(ctx, P, pose, c, false, mx, my, ang);
    if (pose.arms) drawArm(ctx, P, pose.arms[0], c, f, false, cl);
    if (cl && cl.cane && pose.arms) drawCane(ctx, P, pose, f);
  }
  // A walking cane in the near hand, its tip on the ground: dark wood, a crook and a gold band.
  function drawCane(ctx, P, pose, f) {
    const h = pose.arms[0], gy = Math.max(...pose.legs.map((l) => l.fy)), w = Math.max(1.2, P.LT * 0.55);
    const tx = h.x + f * P.LT * 1.2, ty = h.y;
    if (gy - ty < P.LT * 2) return; // the hand is down by the feet (a punch, a fall): no room for it
    ctx.strokeStyle = '#5a3a22'; ctx.lineWidth = w; ctx.lineCap = 'round';
    const r = w * 2.2;
    ctx.beginPath(); ctx.moveTo(tx, gy); ctx.lineTo(tx, ty);
    if (f > 0) ctx.arc(tx - r, ty, r, 0, Math.PI, true); else ctx.arc(tx + r, ty, r, Math.PI, 0, false); // the crook arches over the hand
    ctx.stroke();
    ctx.fillStyle = '#e9b44c'; ctx.fillRect(tx - w * 0.75, ty + w * 1.4, w * 1.5, w * 1.1);
  }

  // o: { clothes: { shirt, shirtDark, pants, pantsDark, hat }, hat, sil (colour: draw a silhouette), flash (0..1 white) }
  function drawCreature(ctx, P, pose, o) {
    o = o || {};
    drawPass(ctx, P, pose, o, o.sil ? silPalette(P, o.sil) : P.css);
    if (o.flash > 0) { ctx.save(); ctx.globalAlpha *= clamp(o.flash, 0, 1); drawPass(ctx, P, pose, o, silPalette(P, WHITE)); ctx.restore(); }
  }

  function drawShadow(ctx, x, y, w) {
    ctx.save(); ctx.globalAlpha *= 0.16; ctx.fillStyle = INK; ell(ctx, x, y, w, w * 0.2, 0); ctx.restore();
  }

  // An egg tinted by the parents' colours. col = css fill, spot = css speckle colour.
  function drawEgg(ctx, x, y, r, col, spot, seed) {
    ctx.fillStyle = col; ell(ctx, x, y, r * 0.78, r, 0);
    const rng = new Rng(seed || 1);
    ctx.fillStyle = spot;
    for (let i = 0; i < 6; i++) { const a = rng.range(0, TAU), d = Math.sqrt(rng.next()) * 0.6; circ(ctx, x + Math.cos(a) * d * r * 0.7, y + Math.sin(a) * d * r * 0.9, r * rng.range(0.06, 0.13)); }
    ctx.save(); ctx.globalAlpha *= 0.35; ctx.fillStyle = WHITE; ell(ctx, x - r * 0.25, y - r * 0.4, r * 0.16, r * 0.3, 0.4); ctx.restore();
  }

  // Draw a creature fitted into a box (for cards, lists and the codex). Returns the scale used.
  function drawFitted(ctx, P, x, y, w, h, o) {
    o = o || {};
    const pose = RB.pose.animPose(P, { x: 0, y: 0, f: o.f || 1, time: o.time || 0, phase: o.phase || 0, speed: o.speed || 0 });
    if (o.eye) pose.eye = o.eye;
    const b = RB.pose.bounds(P, pose);
    const bw = b.x1 - b.x0, bh = b.y1 - b.y0;
    const sc = Math.min(w / bw, h / bh) * (o.fill || 0.92);
    ctx.save();
    ctx.translate(x + w / 2 - (b.x0 + bw / 2) * sc, y + h / 2 - (b.y0 + bh / 2) * sc + (o.dy || 0));
    ctx.scale(sc, sc);
    drawCreature(ctx, P, pose, o);
    ctx.restore();
    return sc;
  }

  RB.art = { drawCreature, drawShadow, drawEgg, drawFitted, drawHat, drawHat2, accIcon, INK, BONE };
})();
