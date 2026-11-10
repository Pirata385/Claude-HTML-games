/* Filogênese — sprites procedurais do cenário (árvores, arbustos, rochas, flores…), pintados uma vez em canvases. */
(function (FG) {
  'use strict';
  const U = FG.U, TAU = U.TAU, B = FG.B;
  const SS = 2;   // os sprites são pintados com o dobro da resolução

  function mk(w, h, fn) {
    const cv = document.createElement('canvas');
    cv.width = Math.ceil(w * SS); cv.height = Math.ceil(h * SS);
    const ctx = cv.getContext('2d');
    ctx.scale(SS, SS); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    fn(ctx, w, h);
    return { cv, w, h };
  }
  const hsl = (h, s, l, a) => (a == null ? `hsl(${h} ${s}% ${l}%)` : `hsl(${h} ${s}% ${l}% / ${a})`);
  function blob(ctx, x, y, r) { ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, TAU); }

  /** Copa de folhas: aglomerado de bolhas com três tons e luz vindo de cima à esquerda. */
  function leafy(r, R, hue, sat, lum, n, squash) {
    return mk(R * 2.3, R * 2.3, (ctx, w) => {
      const c = w / 2, bl = [];
      for (let i = 0; i < n; i++) { const a = r() * TAU, d = Math.sqrt(r()) * R * 0.6; bl.push([c + Math.cos(a) * d, c + Math.sin(a) * d * (squash || 1), R * (0.3 + r() * 0.2)]); }
      ctx.fillStyle = hsl(hue, sat, lum - 16); ctx.beginPath(); for (const b of bl) blob(ctx, b[0] + 2, b[1] + 3, b[2] * 1.06); ctx.fill();
      ctx.fillStyle = hsl(hue, sat, lum); ctx.beginPath(); for (const b of bl) blob(ctx, b[0], b[1], b[2]); ctx.fill();
      ctx.fillStyle = hsl(hue - 6, sat + 4, lum + 9); ctx.beginPath(); for (const b of bl) blob(ctx, b[0] - b[2] * 0.25, b[1] - b[2] * 0.28, b[2] * 0.62); ctx.fill();
      ctx.fillStyle = hsl(hue - 10, sat + 6, lum + 17, 0.8); ctx.beginPath(); for (let i = 0; i < n; i += 2) { const b = bl[i]; blob(ctx, b[0] - b[2] * 0.4, b[1] - b[2] * 0.42, b[2] * 0.28); } ctx.fill();
    });
  }
  function pine(r, R, hue, snow) {
    return mk(R * 2.2, R * 2.2, (ctx, w) => {
      const c = w / 2, pts = 9 + ((r() * 3) | 0), rot = r() * TAU;
      for (let k = 0; k < 4; k++) {
        const rad = R * (1 - k * 0.24);
        ctx.fillStyle = hsl(hue, 34, 20 + k * 6); ctx.beginPath();
        for (let i = 0; i < pts * 2; i++) { const a = rot + k * 0.4 + i * Math.PI / pts, q = i % 2 ? rad * 0.62 : rad; ctx.lineTo(c + Math.cos(a) * q, c + Math.sin(a) * q); }
        ctx.closePath(); ctx.fill();
      }
      if (snow) { ctx.fillStyle = 'rgba(244,248,252,0.75)'; ctx.beginPath(); for (let i = 0; i < 7; i++) blob(ctx, c - R * 0.15 + (r() - 0.5) * R * 1.1, c - R * 0.18 + (r() - 0.5) * R * 1.1, R * (0.08 + r() * 0.1)); ctx.fill(); }
    });
  }
  function palm(r, R) {
    return mk(R * 2.3, R * 2.3, (ctx, w) => {
      const c = w / 2, n = 7 + ((r() * 3) | 0), rot = r() * TAU;
      for (let pass = 0; pass < 2; pass++) for (let i = 0; i < n; i++) {
        const a = rot + i * TAU / n + (r() - 0.5) * 0.2, L = R * (0.82 + r() * 0.2), wd = R * 0.2;
        const ex = c + Math.cos(a) * L, ey = c + Math.sin(a) * L, nx = -Math.sin(a) * wd, ny = Math.cos(a) * wd;
        const mx = c + Math.cos(a) * L * 0.5, my = c + Math.sin(a) * L * 0.5;
        ctx.fillStyle = pass ? hsl(96, 46, 40) : hsl(110, 44, 24);
        const o = pass ? 0 : 2.5;
        ctx.beginPath(); ctx.moveTo(c + o, c + o); ctx.quadraticCurveTo(mx + nx + o, my + ny + o, ex + o, ey + o); ctx.quadraticCurveTo(mx - nx + o, my - ny + o, c + o, c + o); ctx.fill();
        if (pass) { ctx.strokeStyle = hsl(84, 50, 56); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(c, c); ctx.lineTo(ex, ey); ctx.stroke(); }
      }
      ctx.fillStyle = '#6b4a2b'; ctx.beginPath(); blob(ctx, c, c, R * 0.12); ctx.fill();
    });
  }
  function willow(r, R) {
    return mk(R * 2.3, R * 2.3, (ctx, w) => {
      const c = w / 2;
      ctx.fillStyle = hsl(96, 30, 20); ctx.beginPath(); blob(ctx, c + 2, c + 3, R * 0.95); ctx.fill();
      ctx.fillStyle = hsl(92, 32, 30); ctx.beginPath(); blob(ctx, c, c, R * 0.93); ctx.fill();
      for (let i = 0; i < 46; i++) {
        const a = r() * TAU, d0 = R * (0.1 + r() * 0.3), d1 = R * (0.75 + r() * 0.3);
        ctx.strokeStyle = hsl(84 + r() * 20, 36, 30 + r() * 16); ctx.lineWidth = 1.6 + r() * 1.6;
        ctx.beginPath(); ctx.moveTo(c + Math.cos(a) * d0, c + Math.sin(a) * d0); ctx.quadraticCurveTo(c + Math.cos(a + 0.25) * d1 * 0.6, c + Math.sin(a + 0.25) * d1 * 0.6, c + Math.cos(a) * d1, c + Math.sin(a) * d1); ctx.stroke();
      }
    });
  }
  function cactus(r, R) {
    return mk(R * 3, R * 3, (ctx, w) => {
      const c = w / 2, arms = 1 + ((r() * 3) | 0), rot = r() * TAU;
      const body = (x, y, q) => {
        ctx.fillStyle = hsl(130, 34, 22); ctx.beginPath(); blob(ctx, x + 1.5, y + 2, q); ctx.fill();
        ctx.fillStyle = hsl(128, 38, 36); ctx.beginPath(); blob(ctx, x, y, q); ctx.fill();
        ctx.strokeStyle = hsl(120, 36, 26); ctx.lineWidth = 1; ctx.beginPath();
        for (let i = 0; i < 6; i++) { const a = i * TAU / 6; ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * q * 0.9, y + Math.sin(a) * q * 0.9); } ctx.stroke();
        ctx.fillStyle = hsl(118, 40, 48); ctx.beginPath(); blob(ctx, x - q * 0.3, y - q * 0.3, q * 0.3); ctx.fill();
      };
      for (let i = 0; i < arms; i++) { const a = rot + i * TAU / arms; body(c + Math.cos(a) * R * 0.9, c + Math.sin(a) * R * 0.9, R * 0.45); }
      body(c, c, R * 0.7);
      ctx.fillStyle = hsl(330, 80, 68); ctx.beginPath(); blob(ctx, c + R * 0.15, c - R * 0.1, R * 0.16); ctx.fill();
    });
  }
  function deadTree(r, R) {
    return mk(R * 2.4, R * 2.4, (ctx, w) => {
      const c = w / 2;
      const branch = (x, y, a, L, wd, depth) => {
        const ex = x + Math.cos(a) * L, ey = y + Math.sin(a) * L;
        ctx.strokeStyle = depth > 1 ? '#5b4a3a' : '#7a6650'; ctx.lineWidth = wd; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(ex, ey); ctx.stroke();
        if (depth > 0) for (let i = 0; i < 2; i++) branch(ex, ey, a + (r() - 0.5) * 1.6, L * 0.62, wd * 0.6, depth - 1);
      };
      for (let i = 0; i < 4; i++) branch(c, c, r() * TAU, R * 0.5, 3.4, 2);
      ctx.fillStyle = '#4a3b2c'; ctx.beginPath(); blob(ctx, c, c, 5); ctx.fill();
    });
  }
  function bush(r, hue, sat, lum, R) { return leafy(r, R, hue, sat, lum, 7, 0.85); }
  function rock(r, R) {
    return mk(R * 2.6, R * 2.6, (ctx, w) => {
      const c = w / 2, n = 7 + ((r() * 3) | 0), pts = [];
      for (let i = 0; i < n; i++) { const a = i * TAU / n + (r() - 0.5) * 0.4, q = R * (0.75 + r() * 0.35); pts.push([c + Math.cos(a) * q, c + Math.sin(a) * q * 0.86]); }
      const path = (ox, oy, k) => { ctx.beginPath(); for (const p of pts) ctx.lineTo(c + (p[0] - c) * k + ox, c + (p[1] - c) * k + oy); ctx.closePath(); };
      ctx.fillStyle = 'rgba(10,16,10,0.22)'; path(3, 5, 1.02); ctx.fill();
      const g = 108 + r() * 20;
      ctx.fillStyle = `rgb(${g - 30},${g - 32},${g - 30})`; path(0, 0, 1); ctx.fill();
      ctx.fillStyle = `rgb(${g},${g - 2},${g - 6})`; path(-R * 0.08, -R * 0.1, 0.8); ctx.fill();
      ctx.fillStyle = `rgb(${g + 30},${g + 28},${g + 22})`; path(-R * 0.2, -R * 0.24, 0.42); ctx.fill();
    });
  }
  function tuft(r, hue, sat, lum) {
    return mk(26, 22, (ctx) => {
      for (let i = 0; i < 7; i++) {
        const x = 13 + (r() - 0.5) * 12, a = -Math.PI / 2 + (r() - 0.5) * 1.3, L = 7 + r() * 8;
        ctx.strokeStyle = hsl(hue + (r() - 0.5) * 14, sat, lum + (r() - 0.5) * 14); ctx.lineWidth = 1.5 + r();
        ctx.beginPath(); ctx.moveTo(x, 19); ctx.quadraticCurveTo(x + Math.cos(a) * L * 0.4, 19 + Math.sin(a) * L * 0.7, x + Math.cos(a) * L, 19 + Math.sin(a) * L); ctx.stroke();
      }
    });
  }
  function flower(r, hue) {
    return mk(16, 16, (ctx) => {
      const n = 5 + ((r() * 2) | 0);
      ctx.fillStyle = hsl(hue, 78, 68); ctx.beginPath();
      for (let i = 0; i < n; i++) { const a = i * TAU / n; blob(ctx, 8 + Math.cos(a) * 3.4, 8 + Math.sin(a) * 3.4, 2.5); } ctx.fill();
      ctx.fillStyle = hsl((hue + 40) % 360, 90, 60); ctx.beginPath(); blob(ctx, 8, 8, 2); ctx.fill();
    });
  }
  const MISC = {
    shell(r) { return mk(14, 12, (ctx) => { ctx.fillStyle = hsl(20 + r() * 30, 50, 82); ctx.beginPath(); ctx.ellipse(7, 6, 5.5, 4.2, r() * 3, 0, TAU); ctx.fill(); ctx.strokeStyle = hsl(18, 40, 60); ctx.lineWidth = 0.8; ctx.beginPath(); for (let i = -1; i <= 1; i++) { ctx.moveTo(7, 9.5); ctx.lineTo(7 + i * 3.5, 2.5); } ctx.stroke(); }); },
    pebble(r) { return mk(14, 12, (ctx) => { const g = 120 + r() * 50; ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.beginPath(); ctx.ellipse(8, 7.5, 4.8, 3.4, 0, 0, TAU); ctx.fill(); ctx.fillStyle = `rgb(${g},${g - 4},${g - 10})`; ctx.beginPath(); ctx.ellipse(7, 6, 4.8, 3.4, r(), 0, TAU); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.beginPath(); ctx.ellipse(5.8, 5, 2, 1.2, 0, 0, TAU); ctx.fill(); }); },
    mush(r) { return mk(18, 18, (ctx) => { const h = r() < 0.5 ? 8 : 28; for (let i = 0; i < 2; i++) { const x = 6 + i * 6, y = 8 + i * 3, q = 4.5 - i; ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.beginPath(); blob(ctx, x + 1, y + 2, q); ctx.fill(); ctx.fillStyle = hsl(h, 70, 52); ctx.beginPath(); blob(ctx, x, y, q); ctx.fill(); ctx.fillStyle = '#fff5e0'; ctx.beginPath(); blob(ctx, x - 1.4, y - 1, 1); blob(ctx, x + 1.6, y + 0.6, 0.8); ctx.fill(); } }); },
    bones(r) { return mk(26, 20, (ctx) => { ctx.strokeStyle = '#e8dfc8'; ctx.lineWidth = 2.2; ctx.beginPath(); for (let i = 0; i < 4; i++) { ctx.moveTo(5 + i * 5, 5 + r() * 2); ctx.quadraticCurveTo(7 + i * 5, 12, 5 + i * 5, 16); } ctx.stroke(); ctx.lineWidth = 1.8; ctx.beginPath(); ctx.moveTo(3, 10); ctx.lineTo(23, 11); ctx.stroke(); }); },
    reed(r) { return mk(22, 30, (ctx) => { for (let i = 0; i < 5; i++) { const x = 5 + r() * 12, top = 4 + r() * 8; ctx.strokeStyle = hsl(84 + r() * 20, 38, 34); ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(x, 28); ctx.quadraticCurveTo(x + (r() - 0.5) * 6, 16, x + (r() - 0.5) * 5, top); ctx.stroke(); if (r() < 0.6) { ctx.strokeStyle = '#6b4a2b'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x, top + 5); ctx.lineTo(x, top + 1); ctx.stroke(); } } }); },
    lily(r) { return mk(26, 26, (ctx) => { ctx.fillStyle = hsl(118, 42, 34); ctx.beginPath(); ctx.moveTo(13, 13); ctx.arc(13, 13, 10, 0.4, TAU - 0.1); ctx.closePath(); ctx.fill(); ctx.fillStyle = hsl(110, 46, 44); ctx.beginPath(); ctx.moveTo(13, 13); ctx.arc(12, 12, 7, 0.6, TAU - 0.3); ctx.closePath(); ctx.fill(); if (r() < 0.5) { ctx.fillStyle = '#ffd1e6'; ctx.beginPath(); for (let i = 0; i < 6; i++) blob(ctx, 14 + Math.cos(i) * 2.6, 11 + Math.sin(i) * 2.6, 2); ctx.fill(); ctx.fillStyle = '#ffe27a'; ctx.beginPath(); blob(ctx, 14, 11, 1.6); ctx.fill(); } }); },
  };
  function fossil(r) {
    return mk(64, 54, (ctx) => {
      ctx.fillStyle = 'rgba(60,44,26,0.3)'; ctx.beginPath(); ctx.ellipse(32, 30, 28, 20, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#3c2c1a'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(12, 30); ctx.quadraticCurveTo(30, 20, 52, 28); ctx.stroke();
      for (let i = 0; i < 5; i++) { const x = 18 + i * 7; ctx.beginPath(); ctx.moveTo(x, 26 - i % 2); ctx.quadraticCurveTo(x + 4, 38, x - 1, 44); ctx.stroke(); }
      ctx.strokeStyle = '#f0e8d2'; ctx.lineWidth = 3.4; ctx.beginPath(); ctx.moveTo(12, 30); ctx.quadraticCurveTo(30, 20, 52, 28); ctx.stroke();
      for (let i = 0; i < 5; i++) { const x = 18 + i * 7; ctx.beginPath(); ctx.moveTo(x, 26 - i % 2); ctx.quadraticCurveTo(x + 4, 38, x - 1, 44); ctx.stroke(); }
      ctx.fillStyle = '#3c2c1a'; ctx.beginPath(); blob(ctx, 52, 25, 9); ctx.fill();
      ctx.fillStyle = '#f0e8d2'; ctx.beginPath(); blob(ctx, 52, 25, 7.2); ctx.fill();
      ctx.fillStyle = '#3c2c1a'; ctx.beginPath(); blob(ctx, 54, 23, 2); ctx.fill();
    });
  }

  // tons por bioma: [matiz, saturação, luminosidade]
  const LEAF = { [B.GRASS]: [104, 42, 34], [B.FOREST]: [124, 40, 27], [B.SAVANNA]: [78, 40, 38], [B.DESERT]: [72, 26, 42], [B.SWAMP]: [96, 30, 26], [B.TUNDRA]: [150, 22, 36], [B.BEACH]: [96, 44, 40] };
  const FRUIT = { [B.GRASS]: '#e8455e', [B.FOREST]: '#b64fe0', [B.SAVANNA]: '#f0962e', [B.DESERT]: '#ff5aa8', [B.SWAMP]: '#4ac0e0', [B.TUNDRA]: '#5a7cf0', [B.BEACH]: '#ffb52e' };

  FG.Sprites = {
    SS, LEAF, FRUIT, built: false,
    build(seed) {
      const r = U.rng(U.hash(seed, 3, 777));
      const S = this, v3 = (fn) => [fn(), fn(), fn()];
      S.canopy = {
        leaf: v3(() => leafy(r, 50 + r() * 8, 118 + r() * 14, 40, 28 + r() * 5, 15)),
        leafL: v3(() => leafy(r, 46 + r() * 8, 100 + r() * 12, 44, 35 + r() * 5, 13)),
        acacia: v3(() => leafy(r, 54 + r() * 8, 76 + r() * 10, 40, 36, 20, 0.72)),
        pine: v3(() => pine(r, 40 + r() * 8, 150, true)),
        palm: v3(() => palm(r, 50 + r() * 8)),
        willow: v3(() => willow(r, 48 + r() * 8)),
      };
      S.cactus = v3(() => cactus(r, 13));
      S.dead = v3(() => deadTree(r, 34));
      S.bush = {}; S.fbush = {}; S.grass = {};
      for (const b in LEAF) {
        const c = LEAF[b];
        S.bush[b] = v3(() => bush(r, c[0], c[1], c[2] + 4, 15 + r() * 3));
        S.fbush[b] = v3(() => bush(r, c[0] - 8, c[1] + 8, c[2] + 9, 21 + r() * 2));
        S.grass[b] = v3(() => tuft(r, c[0] - 14, c[1] + 4, c[2] + 14));
      }
      S.rock = v3(() => rock(r, 15));
      S.flower = [48, 330, 0, 265, 200].map((h) => flower(r, h));
      S.misc = {};
      for (const k in MISC) S.misc[k] = v3(() => MISC[k](r));
      S.fossil = fossil(r);
      // textura de ondas para a água animada
      const wv = document.createElement('canvas'); wv.width = wv.height = 256;
      const wc = wv.getContext('2d');
      wc.strokeStyle = 'rgba(255,255,255,0.5)'; wc.lineWidth = 2; wc.lineCap = 'round';
      for (let i = 0; i < 46; i++) {
        const x = r() * 256, y = r() * 256, L = 14 + r() * 26;
        for (const ox of [0, -256, 256]) for (const oy of [0, -256, 256]) { wc.beginPath(); wc.moveTo(x + ox, y + oy); wc.quadraticCurveTo(x + ox + L / 2, y + oy - 5, x + ox + L, y + oy); wc.stroke(); }
      }
      S.waves = wv;
      S.built = true;
    },
    /** Desenha um sprite centrado em (x, y) com escala s. */
    draw(ctx, sp, x, y, s) { const w = sp.w * s, h = sp.h * s; ctx.drawImage(sp.cv, x - w / 2, y - h / 2, w, h); },
  };
})(window.FG = window.FG || {});
