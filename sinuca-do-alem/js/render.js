/* Sinuca do Além — desenho em canvas 2D com câmera inclinada em perspectiva (2.5D).
   A mesa parada é pintada uma vez numa camada; bolas, efeitos e taco são desenhados por quadro. */
(function (g) {
  'use strict';
  const SA = g.SA, P = SA.Phys;
  const Rn = (SA.Render = {});
  const OUT = 62, CUSH = 21, NOSE_Z = 12, RAIL_Z = 18, FLOOR_Z = -300, APRON_Z = -80;
  const INK = '#1a100c';
  const EMOJI = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
  let cv, ctx, W = 0, H = 0, dpr = 1;
  const cam = { yaw: false, sinT: 0, cosT: 0, D: 2800, F: 1, cx: 0, cy: 0 };
  let staticCv = null, vigCv = null, darkCv = null, shadeCv = null, grainCv = null;
  let theme = null, tableRef = null, nearY = 0, time = 0, sx0 = 0, sy0 = 0;
  let quality = { dprCap: 2, hatch: 2600, parts: 260, vignette: true };
  const discCache = new Map();
  const parts = [], floats = [];
  let shake = 0, flashA = 0, flashC = '#fff';
  const PR = [0, 0, 0];
  Rn.cam = cam;

  // ---------- projeção ----------
  function projV(u, v, z) {
    const zc = v * cam.cosT - z * cam.sinT + cam.D, s = cam.F / zc;
    PR[0] = cam.cx + u * s; PR[1] = cam.cy - (v * cam.sinT + z * cam.cosT) * s; PR[2] = s;
    return PR;
  }
  function proj(x, y, z) { return cam.yaw ? projV(-y, x, z) : projV(x, y, z); }
  function pj(x, y, z) { const p = proj(x, y, z); return [p[0], p[1], p[2]]; }
  Rn.project = pj;
  Rn.unproject = function (sx, sy) {
    const a = (sx - cam.cx) / cam.F, b = -(sy - cam.cy) / cam.F, den = cam.sinT - b * cam.cosT;
    const v = den > 0.04 ? (b * cam.D) / den : 1e5, u = a * (v * cam.cosT + cam.D);
    return cam.yaw ? { x: v, y: -u } : { x: u, y: v };
  };
  const depthOf = (x, y) => (cam.yaw ? x : y);

  Rn.init = function (canvas) { cv = canvas; ctx = cv.getContext('2d'); };
  Rn.setQuality = function (q) { quality = q; };

  Rn.resize = function (w, h, ins) {
    W = w; H = h;
    dpr = Math.min(g.devicePixelRatio || 1, quality.dprCap);
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    const aw = W - ins.left - ins.right, ah = H - ins.top - ins.bottom;
    cam.yaw = ah > aw * 1.08;
    const th = ((cam.yaw ? 63 : 57) * Math.PI) / 180;
    cam.sinT = Math.sin(th); cam.cosT = Math.cos(th);
    cam.F = 1; cam.cx = 0; cam.cy = 0;
    const hu = (cam.yaw ? P.HH : P.HW) + OUT, hv = (cam.yaw ? P.HW : P.HH) + OUT;
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    const pts = [[-hu, -hv, RAIL_Z], [hu, -hv, RAIL_Z], [-hu, hv, RAIL_Z + 30], [hu, hv, RAIL_Z + 30], [-hu, -hv, APRON_Z * 0.6], [hu, -hv, APRON_Z * 0.6]];
    for (const p of pts) { const q = projV(p[0], p[1], p[2]); x0 = Math.min(x0, q[0]); x1 = Math.max(x1, q[0]); y0 = Math.min(y0, q[1]); y1 = Math.max(y1, q[1]); }
    cam.F = Math.min(aw / (x1 - x0), ah / (y1 - y0)) * 0.985;
    cam.cx = ins.left + aw / 2 - ((x0 + x1) / 2) * cam.F;
    cam.cy = ins.top + ah / 2 - ((y0 + y1) / 2) * cam.F;
    staticCv = document.createElement('canvas'); staticCv.width = cv.width; staticCv.height = cv.height;
    darkCv = document.createElement('canvas'); darkCv.width = Math.ceil(W / 3); darkCv.height = Math.ceil(H / 3);
    buildVignette(); buildShade();
    if (tableRef) buildStatic();
  };

  Rn.setTable = function (T, th) { tableRef = T; theme = th; if (staticCv) { buildShade(); buildStatic(); } };
  Rn.fontsReady = function () { discCache.clear(); };

  // ---------- utilidades de traço ----------
  function shadeHex(hex, k) {
    const n = parseInt(hex.slice(1), 16);
    let r = (n >> 16) & 255, gg = (n >> 8) & 255, b = n & 255;
    if (k >= 0) { r += (255 - r) * k; gg += (255 - gg) * k; b += (255 - b) * k; } else { r *= 1 + k; gg *= 1 + k; b *= 1 + k; }
    return 'rgb(' + (r | 0) + ',' + (gg | 0) + ',' + (b | 0) + ')';
  }
  Rn.shadeHex = shadeHex;
  function rgba(hex, a) { const n = parseInt(hex.slice(1), 16); return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')'; }
  function pathPts(c, pts, close) {
    c.beginPath(); c.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]);
    if (close) c.closePath();
  }
  // contorno "à mão": subdivide e treme de leve, em duas passadas
  function sketch(c, pts, close, w, color, r, amp) {
    amp = amp == null ? 0.7 : amp;
    c.strokeStyle = color || INK; c.lineJoin = 'round'; c.lineCap = 'round';
    for (let pass = 0; pass < 2; pass++) {
      c.lineWidth = pass ? w * 0.45 : w;
      c.globalAlpha = pass ? 0.55 : 1;
      c.beginPath();
      const n = pts.length, m = close ? n : n - 1;
      for (let i = 0; i < m; i++) {
        const a = pts[i], b = pts[(i + 1) % n], len = Math.hypot(b[0] - a[0], b[1] - a[1]);
        const k = Math.max(1, Math.round(len / 26));
        for (let j = 0; j <= k; j++) {
          const t = j / k, x = a[0] + (b[0] - a[0]) * t + (r() - 0.5) * amp * (1 + pass), y = a[1] + (b[1] - a[1]) * t + (r() - 0.5) * amp * (1 + pass);
          if (i === 0 && j === 0) c.moveTo(x, y); else c.lineTo(x, y);
        }
      }
      if (close) c.closePath();
      c.stroke();
    }
    c.globalAlpha = 1;
  }
  function worldPoly(pts, z) { return pts.map((p) => pj(p[0], p[1], p[2] == null ? z : p[2])); }
  function rectPts(hx, hy) { return [[-hx, -hy], [hx, -hy], [hx, hy], [-hx, hy]]; }
  function roundRectPts(hx, hy, rad, n) {
    const out = [], cs = [[hx - rad, hy - rad, 0], [-hx + rad, hy - rad, 1], [-hx + rad, -hy + rad, 2], [hx - rad, -hy + rad, 3]];
    for (const c of cs) for (let i = 0; i <= n; i++) { const a = (c[2] + i / n) * Math.PI * 0.5; out.push([c[0] + Math.cos(a) * rad, c[1] + Math.sin(a) * rad]); }
    return out;
  }
  function circlePts(x, y, r, z, n) { const o = []; for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; o.push(pj(x + Math.cos(a) * r, y + Math.sin(a) * r, z)); } return o; }
  // prisma: desenha só as faces laterais viradas para a câmera, depois o tampo
  function drawBox(c, base, z0, z1, side, top, stroke, lw) {
    const n = base.length, camV = -cam.D * cam.cosT;
    for (let i = 0; i < n; i++) {
      const a = base[i], b = base[(i + 1) % n];
      let nx = b[1] - a[1], ny = -(b[0] - a[0]), mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
      let nu, nv, mu, mv;
      if (cam.yaw) { nu = -ny; nv = nx; mu = -my; mv = mx; } else { nu = nx; nv = ny; mu = mx; mv = my; }
      if (nu * (0 - mu) + nv * (camV - mv) <= 0) continue;
      const q = [pj(a[0], a[1], z0), pj(b[0], b[1], z0), pj(b[0], b[1], z1), pj(a[0], a[1], z1)];
      pathPts(c, q, true);
      c.fillStyle = typeof side === 'function' ? side(i, nu, nv) : side; c.fill();
      if (stroke) { c.strokeStyle = stroke; c.lineWidth = lw || 1.5; c.lineJoin = 'round'; c.stroke(); }
    }
    if (top) {
      const q = base.map((p) => pj(p[0], p[1], z1));
      pathPts(c, q, true); c.fillStyle = top; c.fill();
      if (stroke) { c.strokeStyle = stroke; c.lineWidth = lw || 1.5; c.stroke(); }
    }
  }

  // ---------- camadas fixas ----------
  function buildVignette() {
    vigCv = document.createElement('canvas'); vigCv.width = vigCv.height = 256;
    const c = vigCv.getContext('2d'), gr = c.createRadialGradient(128, 118, 60, 128, 128, 182);
    gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(0.6, 'rgba(0,0,0,0.12)'); gr.addColorStop(1, 'rgba(0,0,0,0.72)');
    c.fillStyle = gr; c.fillRect(0, 0, 256, 256);
  }
  function buildGrain() {
    grainCv = document.createElement('canvas'); grainCv.width = grainCv.height = 160;
    const c = grainCv.getContext('2d'), id = c.createImageData(160, 160), r = SA.makeRng(77);
    for (let i = 0; i < id.data.length; i += 4) { const v = r() < 0.5 ? 0 : 255; id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = r() * 16; }
    c.putImageData(id, 0, 0);
  }
  // sombreado comum a todas as bolas: luz, sombra "recortada", brilho e contorno a nanquim
  const SH = 48, SHP = 8;
  function buildShade() {
    shadeCv = document.createElement('canvas'); shadeCv.width = shadeCv.height = (SH + SHP) * 2;
    const c = shadeCv.getContext('2d'), o = SH + SHP;
    c.save(); c.beginPath(); c.arc(o, o, SH, 0, 7); c.clip();
    let gr = c.createRadialGradient(o - SH * 0.34, o - SH * 0.4, SH * 0.05, o - SH * 0.1, o - SH * 0.1, SH * 1.15);
    gr.addColorStop(0, 'rgba(255,255,255,0.38)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.05)'); gr.addColorStop(0.62, 'rgba(20,8,28,0.12)'); gr.addColorStop(1, 'rgba(14,6,22,0.62)');
    c.fillStyle = gr; c.fillRect(0, 0, o * 2, o * 2);
    // sombra recortada (traço de desenho)
    c.fillStyle = 'rgba(22,10,30,0.2)';
    c.beginPath(); c.arc(o, o, SH, 0, 7); c.arc(o - SH * 0.3, o - SH * 0.34, SH * 1.02, 0, 7, true); c.fill('evenodd');
    // luz rebatida do feltro
    gr = c.createRadialGradient(o + SH * 0.2, o + SH * 1.1, SH * 0.1, o + SH * 0.2, o + SH * 1.1, SH * 0.8);
    gr.addColorStop(0, theme ? rgba(theme.felt, 0.55) : 'rgba(80,200,120,0.5)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = gr; c.fillRect(0, 0, o * 2, o * 2);
    // brilho
    c.fillStyle = 'rgba(255,255,255,0.92)';
    c.save(); c.translate(o - SH * 0.36, o - SH * 0.44); c.rotate(-0.7); c.beginPath(); c.ellipse(0, 0, SH * 0.2, SH * 0.11, 0, 0, 7); c.fill(); c.restore();
    c.beginPath(); c.arc(o - SH * 0.56, o - SH * 0.16, SH * 0.045, 0, 7); c.fill();
    c.restore();
    c.strokeStyle = INK; c.lineWidth = SH * 0.1; c.beginPath(); c.arc(o, o, SH - SH * 0.02, 0, 7); c.stroke();
    c.lineWidth = SH * 0.05; c.globalAlpha = 0.6; c.beginPath(); c.arc(o + 0.6, o + 0.8, SH + 1, 0.3, 2.6); c.stroke(); c.globalAlpha = 1;
  }
  const DISC = 30;
  function discSprite(label, cueDot) {
    const key = (cueDot ? '!' : '') + label;
    let s = discCache.get(key);
    if (s) return s;
    s = document.createElement('canvas'); s.width = s.height = DISC * 2 + 4;
    const c = s.getContext('2d'), o = DISC + 2;
    if (cueDot) {
      c.fillStyle = '#c8362e'; c.beginPath(); c.arc(o, o, DISC * 0.36, 0, 7); c.fill();
      c.strokeStyle = INK; c.lineWidth = 2; c.stroke();
    } else {
      c.fillStyle = '#f6f0df'; c.beginPath(); c.arc(o, o, DISC, 0, 7); c.fill();
      c.strokeStyle = 'rgba(26,16,12,0.75)'; c.lineWidth = 2.4; c.stroke();
      c.textAlign = 'center'; c.textBaseline = 'middle';
      if (typeof label === 'number' || /^\d+$/.test(label)) {
        c.fillStyle = INK; c.font = (String(label).length > 1 ? 30 : 38) + 'px "Lilita One", sans-serif';
        c.fillText(String(label), o, o + 2);
      } else { c.font = '34px ' + EMOJI; c.fillText(label, o, o + 3); }
    }
    discCache.set(key, s);
    return s;
  }

  function buildStatic() {
    if (!grainCv) buildGrain();
    const c = staticCv.getContext('2d'), th = theme, r = SA.makeRng(4242), T = tableRef, geom = T.geom;
    const hw = P.HW, hh = P.HH, u = cam.F / cam.D; // u: px por unidade (aprox.)
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.fillStyle = th.bg; c.fillRect(0, 0, W, H);
    // chão em ladrilhos, em perspectiva
    const TS = 150;
    for (let iv = 14; iv >= -10; iv--) {
      for (let iu = -14; iu < 14; iu++) {
        const q = [pv(iu * TS, iv * TS), pv(iu * TS + TS, iv * TS), pv(iu * TS + TS, iv * TS + TS), pv(iu * TS, iv * TS + TS)];
        if (Math.max(q[0][0], q[1][0], q[2][0], q[3][0]) < 0 || Math.min(q[0][0], q[1][0], q[2][0], q[3][0]) > W) continue;
        if (Math.max(q[0][1], q[3][1]) < 0 || Math.min(q[0][1], q[3][1]) > H + 40) continue;
        pathPts(c, q, true);
        c.fillStyle = shadeHex((iu + iv) & 1 ? th.floorA : th.floorB, (r() - 0.5) * 0.14); c.fill();
        c.strokeStyle = 'rgba(0,0,0,0.4)'; c.lineWidth = 1.2; c.stroke();
        if (r() < 0.16) { c.strokeStyle = 'rgba(0,0,0,0.25)'; c.lineWidth = 0.8; c.beginPath(); c.moveTo(q[0][0], q[0][1]); c.lineTo(q[0][0] + (q[2][0] - q[0][0]) * r(), q[0][1] + (q[2][1] - q[0][1]) * r()); c.stroke(); }
      }
    }
    function pv(uu, vv) { const p = projV(uu, vv, FLOOR_Z); return [p[0], p[1]]; }
    // luz do lustre no chão e escuridão nos cantos
    const fc = pj(0, 0, FLOOR_Z);
    let gr = c.createRadialGradient(fc[0], fc[1], 10, fc[0], fc[1], Math.max(W, H) * 0.8);
    gr.addColorStop(0, rgba(th.light, 0.16)); gr.addColorStop(0.4, 'rgba(0,0,0,0.12)'); gr.addColorStop(1, 'rgba(0,0,0,0.86)');
    c.fillStyle = gr; c.fillRect(0, 0, W, H);
    // sombra da mesa
    c.save(); c.shadowColor = 'rgba(0,0,0,0.85)'; c.shadowBlur = 40 * dpr * Math.max(0.5, u * 1.6);
    pathPts(c, worldPoly(rectPts(hw + OUT - 10, hh + OUT - 10), FLOOR_Z), true); c.fillStyle = 'rgba(0,0,0,0.62)'; c.fill(); c.restore();
    // pés
    const legs = [[1, 1], [-1, 1], [1, -1], [-1, -1]].map((s) => [s[0] * (hw + OUT - 62), s[1] * (hh + OUT - 52)]);
    legs.sort((a, b) => depthOf(b[0], b[1]) - depthOf(a[0], a[1]));
    for (const l of legs) {
      const base = [[l[0] - 24, l[1] - 24], [l[0] + 24, l[1] - 24], [l[0] + 24, l[1] + 24], [l[0] - 24, l[1] + 24]];
      drawBox(c, base, FLOOR_Z, APRON_Z, (i, nu, nv) => shadeHex(th.woodDark, nv < 0 ? -0.1 : -0.4), null, INK, 1.6);
    }
    // corpo (saia) da mesa
    const outer = roundRectPts(hw + OUT, hh + OUT, 44, 6);
    drawBox(c, outer, APRON_Z, RAIL_Z, (i, nu, nv) => shadeHex(th.woodDark, nv < -0.5 ? 0.02 : -0.25), null, null);
    {
      // saia da frente: degradê e friso
      const hu2 = (cam.yaw ? hh : hw) + OUT, hv2 = (cam.yaw ? hw : hh) + OUT;
      const a = projV(-hu2 + 40, -hv2, RAIL_Z), a0 = [a[0], a[1]], b = projV(hu2 - 40, -hv2, APRON_Z), b0 = [b[0], b[1]];
      gr = c.createLinearGradient(0, a0[1], 0, b0[1]);
      gr.addColorStop(0, shadeHex(th.wood, -0.25)); gr.addColorStop(1, shadeHex(th.woodDark, -0.35));
      c.fillStyle = gr; c.fillRect(a0[0], a0[1], b0[0] - a0[0], b0[1] - a0[1]);
      c.strokeStyle = rgba(th.metal, 0.55); c.lineWidth = Math.max(1.5, 3 * u * 1.4);
      const my = a0[1] + (b0[1] - a0[1]) * 0.55;
      c.beginPath(); c.moveTo(a0[0] + 10, my); c.lineTo(b0[0] - 10, my); c.stroke();
      sketch(c, [[a0[0] - 30, b0[1]], [b0[0] + 30, b0[1]]], false, 2.2, INK, r);
    }
    // tampo de madeira (moldura)
    const outerS = worldPoly(outer, RAIL_Z), bedS = worldPoly(rectPts(hw + CUSH, hh + CUSH), RAIL_Z);
    const framePath = () => { pathPts(c, outerS, true); c.moveTo(bedS[0][0], bedS[0][1]); for (let i = 3; i >= 1; i--) c.lineTo(bedS[i][0], bedS[i][1]); c.closePath(); };
    framePath();
    const tl = pj(-hw, hh, RAIL_Z), br = pj(hw, -hh, RAIL_Z);
    gr = c.createLinearGradient(0, Math.min(tl[1], br[1]) - 40, 0, Math.max(tl[1], br[1]) + 60);
    gr.addColorStop(0, shadeHex(th.wood, -0.18)); gr.addColorStop(0.5, shadeHex(th.wood, 0.1)); gr.addColorStop(1, shadeHex(th.wood, -0.05));
    c.fillStyle = gr; c.fill('evenodd');
    c.save(); framePath(); c.clip('evenodd');
    // veios da madeira
    for (let i = 0; i < 90; i++) {
      const horiz = i % 2 === 0, off = CUSH + 3 + r() * (OUT - CUSH - 6), sgn = r() < 0.5 ? -1 : 1, st = r(), ln = 0.15 + r() * 0.5;
      let a, b;
      if (horiz) { const y = sgn * (hh + off), x0 = -hw - OUT + st * (2 * hw + 2 * OUT) * (1 - ln); a = pj(x0, y, RAIL_Z); b = pj(x0 + ln * 2 * hw, y + (r() - 0.5) * 3, RAIL_Z); } else { const x = sgn * (hw + off), y0 = -hh - OUT + st * (2 * hh + 2 * OUT) * (1 - ln); a = pj(x, y0, RAIL_Z); b = pj(x + (r() - 0.5) * 3, y0 + ln * 2 * hh, RAIL_Z); }
      c.strokeStyle = r() < 0.6 ? rgba(th.woodDark, 0.35) : 'rgba(255,235,200,0.14)'; c.lineWidth = 0.6 + r() * 1.2;
      c.beginPath(); c.moveTo(a[0], a[1]); c.quadraticCurveTo((a[0] + b[0]) / 2 + (r() - 0.5) * 4, (a[1] + b[1]) / 2 + (r() - 0.5) * 4, b[0], b[1]); c.stroke();
    }
    // juntas em meia-esquadria
    for (const s of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
      const a = pj(s[0] * (hw + CUSH), s[1] * (hh + CUSH), RAIL_Z), b = pj(s[0] * (hw + OUT - 10), s[1] * (hh + OUT - 10), RAIL_Z);
      c.strokeStyle = rgba(th.woodDark, 0.7); c.lineWidth = 1.4; c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke();
    }
    c.restore();
    // feltro
    const bed0 = worldPoly(rectPts(hw + CUSH, hh + CUSH), 0);
    pathPts(c, bed0, true); c.fillStyle = th.felt; c.fill();
    c.save(); pathPts(c, bed0, true); c.clip();
    const cc = pj(0, 0, 0), wpx = Math.abs(pj(hw, 0, 0)[0] - pj(-hw, 0, 0)[0]) + Math.abs(pj(0, hh, 0)[1] - pj(0, -hh, 0)[1]);
    gr = c.createRadialGradient(cc[0], cc[1], 10, cc[0], cc[1], wpx * 0.62);
    gr.addColorStop(0, rgba(th.light, 0.22)); gr.addColorStop(0.55, 'rgba(255,255,255,0)'); gr.addColorStop(1, rgba(th.feltDark, 0.75));
    c.fillStyle = gr; c.fillRect(0, 0, W, H);
    // hachuras a lápis
    for (let pass = 0; pass < 2; pass++) {
      c.beginPath();
      for (let i = 0; i < quality.hatch / 2; i++) {
        const x = (r() * 2 - 1) * (hw + CUSH), y = (r() * 2 - 1) * (hh + CUSH), l = 8 + r() * 18, a = (pass ? 0.75 : -0.8) + (r() - 0.5) * 0.5;
        const p0 = pj(x, y, 0), p1 = pj(x + Math.cos(a) * l, y + Math.sin(a) * l, 0);
        c.moveTo(p0[0], p0[1]); c.lineTo(p1[0], p1[1]);
      }
      c.strokeStyle = pass ? 'rgba(255,255,255,0.055)' : 'rgba(0,0,0,0.075)'; c.lineWidth = 1; c.stroke();
    }
    // marcações a giz
    c.strokeStyle = 'rgba(255,255,255,0.2)'; c.lineWidth = 1.4; c.setLineDash([7, 6]);
    let a = pj(-250, -hh, 0), b = pj(-250, hh, 0); c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke();
    c.setLineDash([]);
    const dpts = []; for (let i = 0; i <= 18; i++) { const an = Math.PI / 2 + (i / 18) * Math.PI; dpts.push(pj(-250 + Math.cos(an) * 82, Math.sin(an) * 82, 0)); }
    sketch(c, dpts, false, 1.3, 'rgba(255,255,255,0.2)', r, 0.5);
    for (const sp of [[-250, 0], [0, 0], [250, 0]]) { pathPts(c, circlePts(sp[0], sp[1], 4, 0, 10), true); c.fillStyle = 'rgba(255,255,255,0.3)'; c.fill(); }
    // esquisitices pintadas no feltro
    if (T.features) {
      for (const p of T.features.patches || []) {
        const pts = []; const rr = SA.makeRng(p.x * 7 + p.y * 13);
        for (let i = 0; i < 22; i++) { const an = (i / 22) * Math.PI * 2, rad = p.r * (0.86 + rr() * 0.22); pts.push(pj(p.x + Math.cos(an) * rad, p.y + Math.sin(an) * rad, 0)); }
        pathPts(c, pts, true); c.fillStyle = 'rgba(214,150,40,0.3)'; c.fill();
        c.fillStyle = 'rgba(10,20,10,0.22)'; c.fill();
        sketch(c, pts, true, 1.4, 'rgba(255,225,150,0.55)', r, 0.8);
        for (let i = 0; i < 7; i++) { const q = pj(p.x + (rr() - 0.5) * p.r, p.y + (rr() - 0.5) * p.r, 0); c.fillStyle = 'rgba(255,240,200,0.5)'; c.beginPath(); c.ellipse(q[0], q[1], 2.2, 1.2, 0, 0, 7); c.fill(); }
      }
      if (T.features.tilt) {
        const t = T.features.tilt, n = Math.hypot(t.x, t.y), dx = t.x / n, dy = t.y / n;
        c.strokeStyle = 'rgba(255,255,255,0.13)'; c.lineWidth = 2;
        for (let i = -3; i <= 3; i++) for (let j = -1; j <= 1; j++) {
          const x = i * 130, y = j * 140, t0 = pj(x + dx * 22, y + dy * 22, 0), l = pj(x - dx * 6 - dy * 16, y - dy * 6 + dx * 16, 0), rr2 = pj(x - dx * 6 + dy * 16, y - dy * 6 - dx * 16, 0);
          c.beginPath(); c.moveTo(l[0], l[1]); c.lineTo(t0[0], t0[1]); c.lineTo(rr2[0], rr2[1]); c.stroke();
        }
      }
      if (T.mods.indexOf('gelo') >= 0) {
        c.fillStyle = 'rgba(200,235,255,0.22)'; c.fillRect(0, 0, W, H);
        for (let i = 0; i < 46; i++) {
          const x = (r() * 2 - 1) * hw, y = (r() * 2 - 1) * hh, l = 20 + r() * 90, p0 = pj(x, y, 0), p1 = pj(x + l, y + l * 0.3, 0);
          c.strokeStyle = 'rgba(255,255,255,' + (0.1 + r() * 0.2) + ')'; c.lineWidth = 1 + r() * 2; c.beginPath(); c.moveTo(p0[0], p0[1]); c.lineTo(p1[0], p1[1]); c.stroke();
        }
      }
    }
    // sombra das tabelas sobre o feltro
    for (const k of [18, 9]) {
      pathPts(c, bed0, true); const q = worldPoly(rectPts(hw - k, hh - k), 0);
      c.moveTo(q[0][0], q[0][1]); for (let i = 3; i >= 1; i--) c.lineTo(q[i][0], q[i][1]); c.closePath();
      c.fillStyle = 'rgba(0,0,0,0.16)'; c.fill('evenodd');
    }
    c.restore();
    // tabelas (borrachas)
    const feltLight = shadeHex(th.felt, 0.13), feltNose = shadeHex(th.feltDark, -0.28);
    const cush = [];
    for (const s of geom.segs) {
      if (s.jaw || s.wall) continue;
      const horiz = s.y1 === s.y2;
      let back;
      if (horiz) { const sy = Math.sign(s.y1), l = Math.min(s.x1, s.x2), rt = Math.max(s.x1, s.x2), le = l < -100 ? -CUSH : 9, re = rt > 100 ? CUSH : -9; back = [[rt + re, s.y1 + sy * CUSH], [l + le, s.y1 + sy * CUSH]]; cush.push({ nose: [[l, s.y1], [rt, s.y1]], back, key: depthOf(0, s.y1) + (cam.yaw ? l : 0) }); } else { const sx = Math.sign(s.x1), lo = Math.min(s.y1, s.y2), hi = Math.max(s.y1, s.y2); back = [[s.x1 + sx * CUSH, hi + CUSH], [s.x1 + sx * CUSH, lo - CUSH]]; cush.push({ nose: [[s.x1, lo], [s.x1, hi]], back, key: depthOf(s.x1, 0) }); }
    }
    cush.sort((p, q) => q.key - p.key);
    for (const k of cush) {
      const n0 = pj(k.nose[0][0], k.nose[0][1], NOSE_Z), n1 = pj(k.nose[1][0], k.nose[1][1], NOSE_Z);
      const f0 = pj(k.nose[0][0], k.nose[0][1], 0), f1 = pj(k.nose[1][0], k.nose[1][1], 0);
      pathPts(c, [n0, n1, f1, f0], true); c.fillStyle = feltNose; c.fill();
      const top = [n0, n1, pj(k.back[0][0], k.back[0][1], RAIL_Z), pj(k.back[1][0], k.back[1][1], RAIL_Z)];
      pathPts(c, top, true); c.fillStyle = feltLight; c.fill();
      sketch(c, top, true, 1.5, INK, r, 0.5);
      c.strokeStyle = 'rgba(255,255,255,0.28)'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(n0[0], n0[1]); c.lineTo(n1[0], n1[1]); c.stroke();
    }
    sketch(c, bedS, true, 1.6, rgba(th.woodDark, 0.9), r, 0.5);
    // caçapas
    const order = geom.pockets.map((p, i) => i).sort((i, j) => depthOf(geom.pockets[j].x, geom.pockets[j].y) - depthOf(geom.pockets[i].x, geom.pockets[i].y));
    for (const i of order) {
      const p = geom.pockets[i], rv = p.r + 4;
      c.save(); framePath(); c.clip('evenodd');
      const rim = circlePts(p.x, p.y, rv + 11, RAIL_Z, 26);
      pathPts(c, rim, true); c.fillStyle = shadeHex(th.metal, -0.1); c.fill();
      sketch(c, rim, true, 1.6, INK, r, 0.4);
      const rim2 = circlePts(p.x, p.y, rv + 6, RAIL_Z, 26); pathPts(c, rim2, true); c.strokeStyle = shadeHex(th.metal, 0.45); c.lineWidth = 1.4; c.stroke();
      c.restore();
      const hole = circlePts(p.x, p.y, rv, RAIL_Z * 0.5, 26);
      pathPts(c, hole, true); c.fillStyle = '#2a1a12'; c.fill();
      const deep = circlePts(p.x, p.y, rv, -16, 26);
      c.save(); pathPts(c, hole, true); c.clip(); pathPts(c, deep, true); c.fillStyle = '#050304'; c.fill(); c.restore();
      sketch(c, hole, true, 1.8, INK, r, 0.4);
    }
    // losangos de madrepérola
    const dm = [];
    for (const x of [-375, -250, -125, 125, 250, 375]) for (const s of [-1, 1]) dm.push([x, s * (hh + CUSH + (OUT - CUSH) / 2), 1]);
    for (const y of [-125, 0, 125]) for (const s of [-1, 1]) dm.push([s * (hw + CUSH + (OUT - CUSH) / 2), y, 0]);
    for (const d of dm) {
      const ax = d[2] ? 7 : 4.5, ay = d[2] ? 4.5 : 7;
      const q = [pj(d[0] - ax, d[1], RAIL_Z), pj(d[0], d[1] + ay, RAIL_Z), pj(d[0] + ax, d[1], RAIL_Z), pj(d[0], d[1] - ay, RAIL_Z)];
      pathPts(c, q, true); c.fillStyle = '#f1e7cf'; c.fill(); c.strokeStyle = INK; c.lineWidth = 1; c.stroke();
    }
    // contornos principais
    sketch(c, outerS, true, 2.6, INK, r, 0.8);
    // grão de papel
    c.globalAlpha = 0.8; c.fillStyle = c.createPattern(grainCv, 'repeat'); c.fillRect(0, 0, W, H); c.globalAlpha = 1;
    const ny = projV(0, -(cam.yaw ? hw : hh), NOSE_Z);
    nearY = ny[1];
  }

  // ---------- efeitos ----------
  Rn.burst = function (x, y, z, color, n, speed, o) {
    o = o || {};
    if (parts.length > quality.parts) n = Math.ceil(n / 3);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = speed * (0.3 + Math.random() * 0.8);
      parts.push({ x, y, z, vx: Math.cos(a) * s, vy: Math.sin(a) * s, vz: (o.up || 0.6) * speed * (0.3 + Math.random()), life: 0, max: (o.life || 0.6) * (0.6 + Math.random() * 0.7), size: (o.size || 3) * (0.6 + Math.random() * 0.8), color, type: o.type || 'spark', grav: o.grav == null ? 900 : o.grav });
    }
  };
  Rn.ring = function (x, y, color, r1, life) { parts.push({ x, y, z: 0, vx: 0, vy: 0, vz: 0, life: 0, max: life || 0.5, size: r1, color, type: 'ring', grav: 0 }); };
  Rn.bolt = function (x1, y1, x2, y2) {
    const pts = []; const n = 9;
    for (let i = 0; i <= n; i++) { const t = i / n, j = i === 0 || i === n ? 0 : 26; pts.push([x1 + (x2 - x1) * t + (Math.random() - 0.5) * j, y1 + (y2 - y1) * t + (Math.random() - 0.5) * j, 260 * (1 - t) + 14]); }
    parts.push({ x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, life: 0, max: 0.35, size: 1, color: '#fff7a8', type: 'bolt', grav: 0, pts });
  };
  Rn.float = function (x, y, text, color, size, z) { floats.push({ x, y, z: z || 30, text, color: color || '#fff', size: size || 18, life: 0, max: 1.25, dy: 0 }); if (floats.length > 24) floats.shift(); };
  Rn.shake = function (a) { shake = Math.max(shake, a); };
  Rn.flash = function (color, a) { flashC = color; flashA = Math.max(flashA, a); };
  Rn.clearFx = function () { parts.length = 0; floats.length = 0; shake = 0; flashA = 0; };

  function base() { ctx.setTransform(dpr, 0, 0, dpr, sx0 * dpr, sy0 * dpr); }

  function ellipseAt(x, y, z, r, fill, stroke, lw) {
    const p = proj(x, y, z), rs = r * p[2];
    ctx.beginPath(); ctx.ellipse(p[0], p[1], rs, rs * cam.sinT, 0, 0, 7);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw || 1.5; ctx.stroke(); }
  }

  function drawDisc(b, cxs, cys, rs, sgn, spr) {
    const px = b.px * sgn, py = b.py * sgn, pz = b.pz * sgn;
    let pu, pvv, tu, tv;
    if (cam.yaw) { pu = -py; pvv = px; tu = -b.ty; tv = b.tx; } else { pu = px; pvv = py; tu = b.tx; tv = b.ty; }
    const d = pz * cam.sinT - pvv * cam.cosT;
    if (d < 0.1) return;
    const pyc = pvv * cam.sinT + pz * cam.cosT, tz = b.tz;
    const e1x = tu, e1y = tv * cam.sinT + tz * cam.cosT;
    const c2u = tv * pz - tz * pvv, c2v = tz * pu - tu * pz, c2z = tu * pvv - tv * pu;
    const e2x = c2u, e2y = c2v * cam.sinT + c2z * cam.cosT;
    const k = (rs * 0.52) / DISC;
    ctx.setTransform(dpr * e1x * k, -dpr * e1y * k, dpr * e2x * k, -dpr * e2y * k, dpr * (cxs + pu * rs * 0.855 + sx0), dpr * (cys - pyc * rs * 0.855 + sy0));
    ctx.drawImage(spr, -DISC - 2, -DISC - 2);
  }

  function drawBall(b) {
    let z = b.z + b.r, sc = 1, al = 1;
    if (b.sink) { const k = Math.min(1, b.sink.t / 0.3); z = b.r * (1 - 2.2 * k); sc = 1 - 0.45 * k; al = 1 - k * k; }
    const p = proj(b.x, b.y, z), cxs = p[0], cys = p[1], rs = b.r * p[2] * sc;
    if (b.ghost) al *= 0.55 + Math.sin(time * 5 + b.id) * 0.1;
    if (b.type === 'cristal') al *= 0.86;
    ctx.globalAlpha = al;
    if (b.type === 'maldita') { ctx.fillStyle = 'rgba(220,30,50,' + (0.25 + Math.sin(time * 4) * 0.12) + ')'; ctx.beginPath(); ctx.arc(cxs, cys, rs * 1.35, 0, 7); ctx.fill(); }
    if (b.burning) { ctx.fillStyle = 'rgba(255,140,30,' + (0.3 + Math.sin(time * 9 + b.id) * 0.12) + ')'; ctx.beginPath(); ctx.arc(cxs, cys, rs * 1.3, 0, 7); ctx.fill(); }
    ctx.fillStyle = b.color; ctx.beginPath(); ctx.arc(cxs, cys, rs, 0, 7); ctx.fill();
    if (rs > 3) {
      const spr = b.kind === 'cue' ? discSprite('', true) : discSprite(b.glyph || b.num);
      drawDisc(b, cxs, cys, rs, 1, spr); drawDisc(b, cxs, cys, rs, -1, spr);
      base();
    }
    const k = (rs * (SH + SHP)) / SH;
    ctx.drawImage(shadeCv, cxs - k, cys - k, k * 2, k * 2);
    ctx.globalAlpha = 1;
  }

  function drawBumper(c) {
    const hot = c.hot > 0 ? c.hot / 0.18 : 0, zt = 24 + hot * 6;
    const pb = pj(c.x, c.y, 0), pt = pj(c.x, c.y, zt), rb = c.r * pb[2], rt = c.r * pt[2] * (1 + hot * 0.12);
    ctx.fillStyle = '#7d1f24'; ctx.beginPath(); ctx.ellipse(pb[0], pb[1], rb, rb * cam.sinT, 0, 0, Math.PI); ctx.lineTo(pt[0] - rt, pt[1]); ctx.lineTo(pt[0] + rt, pt[1]); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = INK; ctx.lineWidth = 1.6; ctx.stroke();
    ctx.fillStyle = hot ? '#fff3b0' : '#e2463c'; ctx.beginPath(); ctx.ellipse(pt[0], pt[1], rt, rt * cam.sinT, 0, 0, 7); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#f6efe0'; ctx.beginPath(); ctx.ellipse(pt[0], pt[1], rt * 0.62, rt * 0.62 * cam.sinT, 0, 0, 7); ctx.fill(); ctx.stroke();
    ctx.fillStyle = hot ? '#ffb020' : '#e2463c'; ctx.beginPath(); ctx.ellipse(pt[0], pt[1], rt * 0.28, rt * 0.28 * cam.sinT, 0, 0, 7); ctx.fill();
  }
  function segBase(x1, y1, x2, y2, half) {
    const dx = x2 - x1, dy = y2 - y1, l = Math.hypot(dx, dy), nx = (-dy / l) * half, ny = (dx / l) * half;
    return [[x1 - nx, y1 - ny], [x2 - nx, y2 - ny], [x2 + nx, y2 + ny], [x1 + nx, y1 + ny]];
  }
  function drawCrate(s) {
    const base0 = segBase(s.x1, s.y1, s.x2, s.y2, 6);
    drawBox(ctx, base0, 0, 30, (i, nu, nv) => (nv < -0.3 ? '#d9a02a' : '#a8741c'), '#e9b844', INK, 1.5);
    const a = pj(s.x1, s.y1, 30), b = pj(s.x2, s.y2, 30);
    ctx.strokeStyle = 'rgba(90,50,10,0.6)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
  }
  function drawSpinner(sp) {
    const e = P.spinnerEnds(sp), base0 = segBase(e[0], e[1], e[2], e[3], 5);
    drawBox(ctx, base0, 3, 22, (i, nu, nv) => (nv < -0.3 ? '#aab3c2' : '#6d7686'), '#d5dbe6', INK, 1.5);
    const pt = pj(sp.x, sp.y, 26), rt = 13 * pt[2];
    ctx.fillStyle = '#e0b24a'; ctx.beginPath(); ctx.ellipse(pt[0], pt[1], rt, rt * cam.sinT, 0, 0, 7); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.fillStyle = INK; ctx.beginPath(); ctx.ellipse(pt[0], pt[1], rt * 0.3, rt * 0.3 * cam.sinT, 0, 0, 7); ctx.fill();
  }

  function drawFlat(G) {
    const geom = G.world.geom, T = G.T;
    if (geom.well) {
      const wl = geom.well, p = pj(wl.x, wl.y, 0), s = p[2];
      ctx.save(); ctx.translate(p[0], p[1]); ctx.scale(1, cam.sinT);
      let gr = ctx.createRadialGradient(0, 0, wl.r * s * 0.6, 0, 0, wl.range * s * 0.9);
      gr.addColorStop(0, 'rgba(0,0,0,0.9)'); gr.addColorStop(0.25, 'rgba(60,20,90,0.42)'); gr.addColorStop(1, 'rgba(60,20,90,0)');
      ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(0, 0, wl.range * s * 0.9, 0, 7); ctx.fill();
      ctx.lineCap = 'round';
      for (let i = 0; i < 7; i++) {
        const rr = (wl.r + 10 + i * 13) * s, a0 = -time * (2.4 - i * 0.25) + i * 1.3;
        ctx.strokeStyle = i % 2 ? 'rgba(255,170,70,' + (0.75 - i * 0.09) + ')' : 'rgba(190,120,255,' + (0.7 - i * 0.08) + ')';
        ctx.lineWidth = Math.max(1, (3.2 - i * 0.3) * s * 1.2);
        ctx.beginPath(); ctx.arc(0, 0, rr, a0, a0 + 1.5 + i * 0.12); ctx.stroke();
      }
      ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(0, 0, wl.r * s, 0, 7); ctx.fill();
      ctx.strokeStyle = 'rgba(255,220,160,0.9)'; ctx.lineWidth = 1.6; ctx.stroke();
      ctx.restore();
    }
    if (geom.portals) {
      for (let k = 0; k < 2; k++) {
        const q = geom.portals[k], p = pj(q.x, q.y, 0), s = p[2], col = k ? '#4aa8ff' : '#ff9a3c';
        ctx.save(); ctx.translate(p[0], p[1]); ctx.scale(1, cam.sinT);
        const gr = ctx.createRadialGradient(0, 0, 2, 0, 0, q.r * s * 1.25);
        gr.addColorStop(0, '#0a0612'); gr.addColorStop(0.7, rgba(col, 0.55)); gr.addColorStop(1, rgba(col, 0));
        ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(0, 0, q.r * s * 1.25, 0, 7); ctx.fill();
        ctx.strokeStyle = col; ctx.lineCap = 'round';
        for (let i = 0; i < 4; i++) { ctx.lineWidth = Math.max(1.2, 2.6 * s * 1.3); ctx.beginPath(); const a0 = time * (k ? -3 : 3) + i * 1.57; ctx.arc(0, 0, q.r * s * (0.45 + i * 0.18), a0, a0 + 1.9); ctx.stroke(); }
        ctx.strokeStyle = INK; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(0, 0, q.r * s * 1.05, 0, 7); ctx.stroke();
        ctx.restore();
      }
    }
    const wv = T && T.windNow;
    if (wv) {
      const n = Math.hypot(wv.x, wv.y), dx = wv.x / n, dy = wv.y / n;
      ctx.strokeStyle = 'rgba(255,255,255,0.2)'; ctx.lineWidth = 1.6; ctx.lineCap = 'round';
      for (let i = 0; i < 12; i++) {
        const ph = (time * 0.5 + i * 0.37) % 1, ox = ((i * 197) % 1000) - 500, oy = ((i * 331) % 500) - 250;
        const x = ox + dx * (ph - 0.5) * 500, y = oy + dy * (ph - 0.5) * 500;
        if (Math.abs(x) > 500 || Math.abs(y) > 250) continue;
        const a = pj(x, y, 2), b = pj(x + dx * 70, y + dy * 70, 2);
        ctx.globalAlpha = Math.sin(ph * Math.PI); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
  }

  function drawPocketFx(G, far) {
    const geom = G.world.geom, T = G.T;
    for (let i = 0; i < 6; i++) {
      const p = geom.pockets[i];
      if (depthOf(p.x, p.y) >= 0 !== far) continue;
      if (p.closed) {
        const c = pj(p.x, p.y, RAIL_Z + 3), rr = (p.r + 9) * c[2];
        ctx.fillStyle = '#b9bcc4'; ctx.beginPath();
        for (let k = 0; k < 42; k++) { const a = (k / 42) * Math.PI * 2, r2 = rr * (k % 2 ? 1 : 0.9); const x = c[0] + Math.cos(a) * r2, y = c[1] + Math.sin(a) * r2 * cam.sinT; if (k) ctx.lineTo(x, y); else ctx.moveTo(x, y); }
        ctx.closePath(); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 1.6; ctx.stroke();
        ctx.fillStyle = '#c8362e'; ctx.beginPath(); ctx.ellipse(c[0], c[1], rr * 0.68, rr * 0.68 * cam.sinT, 0, 0, 7); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#f6efe0'; ctx.font = Math.round(rr * 0.6) + 'px "Lilita One", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.save(); ctx.translate(c[0], c[1]); ctx.scale(1, cam.sinT); ctx.fillText('✕', 0, 1); ctx.restore();
      } else if (T && T.golden === i) {
        const c = pj(p.x, p.y, RAIL_Z), rr = (p.r + 12) * c[2], pu = 0.5 + Math.sin(time * 5) * 0.5;
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        const gr = ctx.createRadialGradient(c[0], c[1], rr * 0.4, c[0], c[1], rr * (1.9 + pu * 0.3));
        gr.addColorStop(0, 'rgba(255,210,80,0.0)'); gr.addColorStop(0.45, 'rgba(255,200,60,' + (0.5 + pu * 0.25) + ')'); gr.addColorStop(1, 'rgba(255,180,40,0)');
        ctx.fillStyle = gr; ctx.beginPath(); ctx.ellipse(c[0], c[1], rr * 2.2, rr * 2.2 * cam.sinT, 0, 0, 7); ctx.fill();
        ctx.restore();
        ctx.strokeStyle = '#ffd766'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.ellipse(c[0], c[1], rr, rr * cam.sinT, 0, 0, 7); ctx.stroke();
      }
    }
  }

  function dashed(x1, y1, x2, y2, col, w) {
    const a = pj(x1, y1, P.R), b = pj(x2, y2, P.R);
    ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = w + 2; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
    ctx.strokeStyle = col; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
  }
  function drawGuide(G) {
    const gd = G.guide;
    if (!gd) return;
    ctx.lineCap = 'round'; ctx.setLineDash([2, 9]); ctx.lineDashOffset = -time * 26;
    for (const s of gd.segs) dashed(s[0], s[1], s[2], s[3], 'rgba(255,255,255,0.9)', 2.4);
    ctx.setLineDash([]);
    if (gd.ghost) {
      const p = pj(gd.ghost.x, gd.ghost.y, gd.ghost.r), rs = gd.ghost.r * p[2];
      ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 3.4; ctx.beginPath(); ctx.arc(p[0], p[1], rs, 0, 7); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.95)'; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.arc(p[0], p[1], rs, 0, 7); ctx.stroke();
    }
    if (gd.target) dashed(gd.target[0], gd.target[1], gd.target[2], gd.target[3], '#ffd766', 2.6);
    if (gd.deflect) dashed(gd.deflect[0], gd.deflect[1], gd.deflect[2], gd.deflect[3], 'rgba(255,255,255,0.5)', 1.8);
  }

  function drawCue(G) {
    const A = G.aim, cb = G.cueBall;
    if (!A || !A.show || !cb || !cb.alive) return;
    const dx = Math.cos(A.angle), dy = Math.sin(A.angle), cols = G.cueColors || ['#c9995a', '#5b3a1e'];
    const pull = A.strike > 0 ? A.pull * (1 - A.strike) : A.pull;
    const gap = cb.r + 5 + pull, L = 500;
    const at = (t, zoff) => pj(cb.x - dx * (gap + L * t), cb.y - dy * (gap + L * t), zoff == null ? cb.r + 2 + t * 105 : zoff);
    // sombra
    const s0 = at(0, 0), s1 = at(0.42, 0);
    ctx.strokeStyle = 'rgba(0,0,0,0.28)'; ctx.lineWidth = 6 * s0[2]; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(s0[0], s0[1]); ctx.lineTo(s1[0], s1[1]); ctx.stroke();
    const pieces = [[0, 0.012, '#4a8fd0', 4.6], [0.012, 0.045, '#f3ecd9', 5], [0.045, 0.6, cols[0], 5.2], [0.6, 0.97, cols[1], 8.2], [0.97, 1, '#2a2020', 11]];
    const p0 = at(0), p1 = at(1), ang = Math.atan2(p1[1] - p0[1], p1[0] - p0[0]), nx = -Math.sin(ang), ny = Math.cos(ang);
    let prevW = 4.6;
    for (const pc of pieces) {
      const a = at(pc[0]), b = at(pc[1]), wa = prevW * a[2] * 0.5, wb = pc[3] * b[2] * 0.5 * 1.25;
      ctx.beginPath(); ctx.moveTo(a[0] + nx * wa, a[1] + ny * wa); ctx.lineTo(b[0] + nx * wb, b[1] + ny * wb); ctx.lineTo(b[0] - nx * wb, b[1] - ny * wb); ctx.lineTo(a[0] - nx * wa, a[1] - ny * wa); ctx.closePath();
      ctx.fillStyle = pc[2]; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 1.4; ctx.lineJoin = 'round'; ctx.stroke();
      prevW = pc[3] * 1.25;
    }
    // filete de luz
    const h0 = at(0.05), h1 = at(0.58);
    ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(h0[0] - nx * 1.2, h0[1] - ny * 1.2); ctx.lineTo(h1[0] - nx * 2, h1[1] - ny * 2); ctx.stroke();
    if (A.power > 0.02) {
      // medidor de força junto à bola
      const p = pj(cb.x, cb.y, cb.r), rs = (cb.r + 9) * p[2];
      ctx.strokeStyle = 'rgba(0,0,0,0.45)'; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(p[0], p[1], rs, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * A.power); ctx.stroke();
      ctx.strokeStyle = A.power > 0.85 ? '#ff5a3c' : A.power > 0.5 ? '#ffd766' : '#8fe38a'; ctx.lineWidth = 3.4; ctx.beginPath(); ctx.arc(p[0], p[1], rs, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * A.power); ctx.stroke();
      // número da força acima da bola (vira "MÁX" no limite)
      const txt = A.power >= 0.995 ? 'MÁX' : Math.round(A.power * 100) + '%', ty = p[1] - rs - 12;
      ctx.font = (A.power >= 0.995 ? 17 : 14) + 'px "Lilita One", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
      ctx.strokeStyle = INK; ctx.lineWidth = 4; ctx.strokeText(txt, p[0], ty);
      ctx.fillStyle = A.power >= 0.995 ? '#ff7a5c' : '#fff'; ctx.fillText(txt, p[0], ty);
    }
  }

  function drawParts(dt) {
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.life += dt;
      if (p.life >= p.max) { parts[i] = parts[parts.length - 1]; parts.pop(); continue; }
      const k = p.life / p.max;
      if (p.type === 'ring') {
        const q = proj(p.x, p.y, 2), rr = p.size * (0.15 + k * 0.85) * q[2];
        ctx.globalAlpha = 1 - k; ctx.strokeStyle = p.color; ctx.lineWidth = 4 * (1 - k) + 1; ctx.beginPath(); ctx.ellipse(q[0], q[1], rr, rr * cam.sinT, 0, 0, 7); ctx.stroke();
        continue;
      }
      if (p.type === 'bolt') {
        ctx.globalAlpha = 1 - k; ctx.lineJoin = 'round';
        for (let pass = 0; pass < 2; pass++) {
          ctx.strokeStyle = pass ? '#fff' : 'rgba(255,230,90,0.8)'; ctx.lineWidth = pass ? 2 : 7; ctx.beginPath();
          for (let j = 0; j < p.pts.length; j++) { const q = proj(p.pts[j][0], p.pts[j][1], p.pts[j][2]); if (j) ctx.lineTo(q[0], q[1]); else ctx.moveTo(q[0], q[1]); }
          ctx.stroke();
        }
        continue;
      }
      p.vz -= p.grav * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      if (p.z < 0) { p.z = 0; p.vz *= -0.4; p.vx *= 0.6; p.vy *= 0.6; }
      const q = proj(p.x, p.y, p.z);
      if (p.type === 'dust' || p.type === 'smoke') {
        ctx.globalAlpha = (1 - k) * 0.5; ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(q[0], q[1], p.size * q[2] * (1 + k * 2.4), 0, 7); ctx.fill();
      } else if (p.type === 'conf') {
        ctx.globalAlpha = 1 - k * k; ctx.fillStyle = p.color; ctx.save(); ctx.translate(q[0], q[1]); ctx.rotate(p.life * 9 + p.size); ctx.fillRect(-p.size * q[2], -p.size * q[2] * 0.5, p.size * 2 * q[2], p.size * q[2]); ctx.restore();
      } else {
        ctx.globalAlpha = 1 - k; ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(q[0], q[1], Math.max(0.6, p.size * q[2] * (1 - k * 0.6)), 0, 7); ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }
  function drawFloats(dt) {
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
    for (let i = floats.length - 1; i >= 0; i--) {
      const f = floats[i];
      f.life += dt;
      if (f.life >= f.max) { floats.splice(i, 1); continue; }
      const k = f.life / f.max, q = proj(f.x, f.y, f.z), pop = k < 0.12 ? 0.6 + (k / 0.12) * 0.55 : 1.15 - Math.min(0.15, (k - 0.12) * 0.6);
      const y = q[1] - k * 46 - i * 0;
      ctx.globalAlpha = k > 0.75 ? (1 - k) / 0.25 : 1;
      ctx.font = Math.round(f.size * pop) + 'px "Lilita One", sans-serif';
      ctx.strokeStyle = INK; ctx.lineWidth = 4; ctx.strokeText(f.text, q[0], y);
      ctx.fillStyle = f.color; ctx.fillText(f.text, q[0], y);
    }
    ctx.globalAlpha = 1;
  }

  const drawList = [];
  Rn.draw = function (G, dt) {
    if (!staticCv || !tableRef) return;
    time += dt;
    if (shake > 0.2) { sx0 = (Math.random() - 0.5) * shake; sy0 = (Math.random() - 0.5) * shake; shake *= Math.pow(0.0015, dt); } else { sx0 = sy0 = 0; shake = 0; }
    base();
    if (sx0 || sy0) { ctx.fillStyle = theme.bg; ctx.fillRect(-20, -20, W + 40, H + 40); }
    ctx.drawImage(staticCv, 0, 0, W, H);
    const world = G.world, geom = world.geom, B = world.balls;
    drawFlat(G);
    drawPocketFx(G, true);
    if (G.state === 'aim') drawGuide(G);
    // sombras
    ctx.fillStyle = 'rgba(0,0,0,0.36)';
    for (let i = 0; i < B.length; i++) {
      const b = B[i];
      if (!b.alive || b.sink) continue;
      const p = proj(b.x + b.x * 0.012 + b.z * 0.25, b.y + b.y * 0.012 - b.z * 0.1, 0), k = 1 / (1 + b.z * 0.012), rs = b.r * p[2] * 1.02 * k;
      ctx.globalAlpha = (b.ghost ? 0.4 : 1) * k;
      ctx.beginPath(); ctx.ellipse(p[0] + rs * 0.12, p[1] + rs * 0.1, rs, rs * cam.sinT, 0, 0, 7); ctx.fill();
    }
    ctx.globalAlpha = 1;
    // objetos ordenados por profundidade
    drawList.length = 0;
    for (let i = 0; i < B.length; i++) if (B[i].alive) drawList.push({ d: depthOf(B[i].x, B[i].y), t: 0, o: B[i] });
    for (const c of geom.circles) if (!c.lid) drawList.push({ d: depthOf(c.x, c.y), t: 1, o: c });
    for (const s of geom.segs) if (s.wall) drawList.push({ d: depthOf((s.x1 + s.x2) / 2, (s.y1 + s.y2) / 2), t: 2, o: s });
    if (geom.spinner) drawList.push({ d: depthOf(geom.spinner.x, geom.spinner.y), t: 3, o: geom.spinner });
    drawList.sort((a, b) => b.d - a.d);
    for (let i = 0; i < drawList.length; i++) {
      const it = drawList[i];
      if (it.t === 0) drawBall(it.o); else if (it.t === 1) { if (it.o.hot > 0) it.o.hot -= dt; drawBumper(it.o); } else if (it.t === 2) drawCrate(it.o); else drawSpinner(it.o);
    }
    // a tabela de perto cobre o pé das bolas encostadas nela
    if (nearY < H) {
      const sy = Math.floor(nearY * dpr);
      ctx.setTransform(1, 0, 0, 1, sx0 * dpr, sy0 * dpr);
      ctx.drawImage(staticCv, 0, sy, staticCv.width, staticCv.height - sy, 0, sy, staticCv.width, staticCv.height - sy);
      base();
    }
    drawPocketFx(G, false);
    drawCue(G);
    drawParts(dt);
    if (geom.dark) {
      const dc = darkCv.getContext('2d');
      dc.globalCompositeOperation = 'source-over'; dc.clearRect(0, 0, darkCv.width, darkCv.height);
      dc.fillStyle = 'rgba(2,2,8,0.9)'; dc.fillRect(0, 0, darkCv.width, darkCv.height);
      dc.globalCompositeOperation = 'destination-out';
      const hole = (x, y, rad) => { const p = proj(x, y, 10), rr = (rad * p[2]) / 3, gx = p[0] / 3, gy = p[1] / 3, gr = dc.createRadialGradient(gx, gy, rr * 0.2, gx, gy, rr); gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); dc.fillStyle = gr; dc.beginPath(); dc.arc(gx, gy, rr, 0, 7); dc.fill(); };
      for (const b of B) {
        if (!b.alive) continue;
        if (b.kind === 'cue') hole(b.x, b.y, 250); else if (b.vx || b.vy || b.burning) hole(b.x, b.y, 120);
      }
      if (G.guide && G.guide.ghost && G.state === 'aim') hole(G.guide.ghost.x, G.guide.ghost.y, 70);
      for (const p of geom.pockets) hole(p.x, p.y, 42);
      ctx.drawImage(darkCv, 0, 0, W, H);
    }
    drawFloats(dt);
    if (quality.vignette) ctx.drawImage(vigCv, 0, 0, W, H);
    if (flashA > 0.01) { ctx.globalAlpha = flashA; ctx.fillStyle = flashC; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; flashA *= Math.pow(0.002, dt); }
  };

  // Ícone de bola para a interface (saco, balcão, almanaque).
  Rn.ballIcon = function (def, size) {
    const s = size || 44, c = document.createElement('canvas'), d = Math.min(2, g.devicePixelRatio || 1);
    c.width = c.height = s * d; c.style.width = c.style.height = s + 'px';
    const x = c.getContext('2d'); x.scale(d, d);
    const o = s / 2, rr = s * 0.42;
    if (!shadeCv) buildShade();
    x.fillStyle = def.color; x.beginPath(); x.arc(o, o, rr, 0, 7); x.fill();
    const spr = discSprite(def.glyph || def.num), dr = rr * 0.58;
    x.drawImage(spr, o - dr, o - dr - rr * 0.04, dr * 2, dr * 2);
    const k = (rr * (SH + SHP)) / SH; x.drawImage(shadeCv, o - k, o - k, k * 2, k * 2);
    return c;
  };
})(window);
