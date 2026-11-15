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

  function drawLeg(ctx, P, leg, c, f, far, cl, bodyCol) {
    const l1 = P.LL * (1 - P.shin), l2 = P.LL * P.shin;
    const k = RB.pose.knee(leg.ax, leg.ay, leg.fx, leg.fy, l1, l2, P.sw.knee ? -f : f);
    if (cl) {
      const col = far ? cl.pantsDark : cl.pants;
      seg(ctx, leg.ax, leg.ay, k.x, k.y, P.LT * 1.7, col);
      seg(ctx, k.x, k.y, leg.fx, leg.fy - P.LT * 0.5, P.LT * 1.45, col);
      ctx.fillStyle = far ? '#2c2422' : '#3a2e2a';
      ell(ctx, leg.fx + f * P.FL * 0.3, leg.fy - P.LT * 0.5, P.FL * 0.62, P.LT * 0.85, 0);
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
    } else if (hat === 'star') { // sheriff
      ctx.fillStyle = '#6a5136'; ell(ctx, 0, -R * 0.82, R * 1.55, R * 0.24, 0); ctx.fillRect(-R * 0.7, -R * 1.7, R * 1.4, R * 0.9);
      ctx.fillStyle = '#f2c14e'; circ(ctx, R * 0.1, -R * 1.25, R * 0.24);
    }
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
    if (P.hasBeak) {
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
    const hat = o.hat || (cl && cl.hat);
    if (hat) drawHat(ctx, hat, R);
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
    ctx.strokeStyle = P.sw.bare || P.bareHead > 0.5 ? c.skin : bodyCol; ctx.lineWidth = P.NT;
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
  }

  function drawPass(ctx, P, pose, o, c) {
    const f = pose.f, hx = pose.hx, hy = pose.hy, cx = pose.cx, cy = pose.cy;
    const ang = Math.atan2(cy - hy, cx - hx), mx = (hx + cx) / 2, my = (hy + cy) / 2;
    const TL = P.TL, TD = P.TD, ry = TD / 2, rx = TL / 2 + TD * 0.22;
    const cl = o.clothes && c === P.css ? o.clothes : null;
    const bodyCol = P.sw.bare ? c.skin : c.body;
    if (P.sw.glow && c === P.css) {
      ctx.save(); ctx.fillStyle = c.accent;
      ctx.globalAlpha *= 0.13; circ(ctx, mx, my, TL * 1.5); ctx.globalAlpha *= 1.3; circ(ctx, mx, my, TL * 1.05);
      ctx.restore();
    }
    drawWing(ctx, P, pose, c, true, mx, my, ang);
    for (const leg of pose.legs) if (leg.side === 1) drawLeg(ctx, P, leg, c, f, true, cl, bodyCol);
    if (pose.arms) drawArm(ctx, P, pose.arms[1], c, f, true, cl);
    drawTail(ctx, P, pose, c, bodyCol);
    // torso, in its own frame: +x towards the chest, +y the belly side
    ctx.save();
    ctx.translate(mx, my); ctx.rotate(ang); if (f < 0) ctx.scale(1, -1);
    if (cl || P.person) {
      seg(ctx, -TL / 2 + TD * 0.1, 0, TL / 2, 0, TD * 0.95, cl ? cl.shirt : bodyCol);
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
    ctx.restore();
    for (const leg of pose.legs) if (leg.side === 0) drawLeg(ctx, P, leg, c, f, false, cl, bodyCol);
    if (P.twoHeads) drawNeckHead(ctx, P, pose, c, o, cl, bodyCol, -f * 0.55, 0.92);
    drawNeckHead(ctx, P, pose, c, o, cl, bodyCol, P.twoHeads ? f * 0.12 : 0, 1);
    drawWing(ctx, P, pose, c, false, mx, my, ang);
    if (pose.arms) drawArm(ctx, P, pose.arms[0], c, f, false, cl);
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

  RB.art = { drawCreature, drawShadow, drawEgg, drawFitted, drawHat, INK, BONE };
})();
