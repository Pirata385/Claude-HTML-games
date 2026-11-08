// Niryk — pixel art, painted in code at startup (no image files).
// Art direction: Otherworld Legends — taller heroes with realistic proportions, dark ambient palettes with vibrant
// accents, cel shading lit from the top-left, dark outlines, 2.5D scenery (tall walls, props with volume) and
// painterly dithered floors. Sprites are painted at RS (2) pixels per world unit; each canvas carries .rs/.W/.H.
'use strict';
(function () {
  const N = window.N;
  const RS = N.RS = 2;
  const S = N.S = { ch: {}, en: {}, boss: {}, wp: {}, eq: {}, ab: {}, misc: {}, proj: {}, tiles: {}, deco: {}, hero: {} };
  const OUT = '#120a12';

  const cv = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  const hexRgb = (h) => { if (h[0] !== '#') { const m = h.match(/\d+(\.\d+)?/g).map(Number); return [m[0], m[1], m[2]]; } const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const rgbHex = (r, g, b) => '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
  const mix = (a, b, t) => { const A = hexRgb(a), B = hexRgb(b); return rgbHex(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t); };
  N.mix = mix;
  const fin = (c) => { c.rs = RS; c.W = c.width / RS; c.H = c.height / RS; return c; };
  N.fin = fin;
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => v / 16 - 0.5);
  const bayer = (x, y) => BAYER[(y & 3) * 4 + (x & 3)];

  class Painter {
    constructor(w, h) { this.w = w; this.h = h; this.c = cv(w, h); this.x = this.c.getContext('2d'); }
    px(x, y, c) { this.x.fillStyle = c; this.x.fillRect(Math.floor(x), Math.floor(y), 1, 1); return this; }
    rect(x, y, w, h, c) { this.x.fillStyle = c; this.x.fillRect(Math.floor(x), Math.floor(y), Math.round(w), Math.round(h)); return this; }
    circ(cx, cy, r, c) { return this.ell(cx, cy, r, r, c); }
    ell(cx, cy, rx, ry, c) {
      this.x.fillStyle = c;
      for (let y = Math.floor(cy - ry - 1); y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - rx - 1); x <= Math.ceil(cx + rx); x++) {
        const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry; if (dx * dx + dy * dy <= 1) this.x.fillRect(x, y, 1, 1);
      }
      return this;
    }
    ring(cx, cy, r, c, t = 1) {
      this.x.fillStyle = c;
      for (let y = Math.floor(cy - r - 1); y <= Math.ceil(cy + r); y++) for (let x = Math.floor(cx - r - 1); x <= Math.ceil(cx + r); x++) { const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy); if (d <= r && d > r - t) this.x.fillRect(x, y, 1, 1); }
      return this;
    }
    line(x0, y0, x1, y1, c, t = 1) {
      if (t > 1) { const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 2) + 1; for (let i = 0; i <= n; i++) { const k = i / n; this.circ(x0 + (x1 - x0) * k, y0 + (y1 - y0) * k, t / 2, c); } return this; }
      x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
      const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
      let err = dx + dy; this.x.fillStyle = c;
      for (;;) { this.x.fillRect(x0, y0, 1, 1); if (x0 === x1 && y0 === y1) break; const e2 = 2 * err; if (e2 >= dy) { err += dy; x0 += sx; } if (e2 <= dx) { err += dx; y0 += sy; } }
      return this;
    }
    // Tapered brush stroke along a polyline (width w0 -> w1).
    stroke(pts, w0, w1, c) {
      let tot = 0; const seg = []; for (let i = 1; i < pts.length; i++) { const l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); seg.push(l); tot += l; }
      let acc = 0;
      for (let i = 1; i < pts.length; i++) {
        const [ax, ay] = pts[i - 1], [bx, by] = pts[i], n = Math.ceil(seg[i - 1] * 2) + 1;
        for (let k = 0; k <= n; k++) { const f = k / n, d = (acc + seg[i - 1] * f) / tot; this.circ(ax + (bx - ax) * f, ay + (by - ay) * f, Math.max(0.5, (w0 + (w1 - w0) * d) / 2), c); }
        acc += seg[i - 1];
      }
      return this;
    }
    poly(pts, c) {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const [x, y] of pts) { minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y); }
      this.x.fillStyle = c;
      for (let y = Math.floor(minY); y <= Math.ceil(maxY); y++) for (let x = Math.floor(minX); x <= Math.ceil(maxX); x++) {
        const px = x + 0.5, py = y + 0.5; let ins = false;
        for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const [xi, yi] = pts[i], [xj, yj] = pts[j]; if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) ins = !ins; }
        if (ins) this.x.fillRect(x, y, 1, 1);
      }
      return this;
    }
    map(rows, pal, ox = 0, oy = 0) { rows.forEach((row, y) => { for (let x = 0; x < row.length; x++) { const ch = row[x]; if (pal[ch]) { this.x.fillStyle = pal[ch]; this.x.fillRect(ox + x, oy + y, 1, 1); } } }); return this; }
    // Cel shading of everything painted so far: each pixel is lit by how far it sits from the silhouette edge
    // toward and away from the light (top-left), quantised into 4 tones with ordered dithering.
    cel(mat, o = {}) {
      const w = this.w, h = this.h, id = this.x.getImageData(0, 0, w, h), d = id.data, A = new Uint8Array(w * h);
      for (let i = 0; i < w * h; i++) A[i] = d[i * 4 + 3] > 20 ? 1 : 0;
      const R = o.r || 6, lx = o.lx === undefined ? 0.55 : o.lx, ly = o.ly === undefined ? 0.85 : o.ly, cols = mat.map(hexRgb), rim = o.rim ? hexRgb(o.rim) : null;
      const inside = (x, y) => x >= 0 && y >= 0 && x < w && y < h && A[y * w + x] === 1;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const i = y * w + x; if (!A[i]) continue;
        let da = 0; while (da < R && inside(Math.round(x + lx * (da + 1)), Math.round(y + ly * (da + 1)))) da++;
        let dt = 0; while (dt < R && inside(Math.round(x - lx * (dt + 1)), Math.round(y - ly * (dt + 1)))) dt++;
        let t = (da + 0.5) / (da + dt + 1) + bayer(x, y) * 0.12;
        if (o.grad) t -= (y / h - 0.4) * o.grad;
        let k = t < 0.3 ? 0 : t < 0.6 ? 1 : t < 0.84 ? 2 : (o.spec !== false && dt <= 1 ? 3 : 2);
        k = Math.min(k, cols.length - 1);
        let [r, g, b] = cols[k];
        if (rim && da === 0 && dt > 1) { r = (r + rim[0]) / 2; g = (g + rim[1]) / 2; b = (b + rim[2]) / 2; }
        d[i * 4] = r; d[i * 4 + 1] = g; d[i * 4 + 2] = b; d[i * 4 + 3] = 255;
      }
      this.x.putImageData(id, 0, 0); return this;
    }
    // Paint one volume on its own layer, cel-shade it, then composite it.
    layer(mat, fn, o) { const q = new Painter(this.w, this.h); fn(q); q.cel(mat, o); this.x.drawImage(q.c, 0, 0); return this; }
    out(col = OUT) { return fin(outline(this.c, col)); }
    done() { return fin(this.c); }
  }
  N.Painter = Painter;

  function outline(src, col = OUT) {
    const w = src.width + 2, h = src.height + 2, c = cv(w, h), x = c.getContext('2d');
    const sd = src.getContext('2d').getImageData(0, 0, src.width, src.height).data, od = x.createImageData(w, h), o = od.data;
    const [r, g, b] = hexRgb(col), sw = src.width, sh = src.height;
    const al = (sx, sy) => (sx < 0 || sy < 0 || sx >= sw || sy >= sh ? 0 : sd[(sy * sw + sx) * 4 + 3]);
    for (let y = 0; y < h; y++) for (let xx = 0; xx < w; xx++) {
      const sx = xx - 1, sy = y - 1, oi = (y * w + xx) * 4;
      if (al(sx, sy) > 40) { const si = (sy * sw + sx) * 4; o[oi] = sd[si]; o[oi + 1] = sd[si + 1]; o[oi + 2] = sd[si + 2]; o[oi + 3] = sd[si + 3]; }
      else if (al(sx - 1, sy) > 40 || al(sx + 1, sy) > 40 || al(sx, sy - 1) > 40 || al(sx, sy + 1) > 40) { o[oi] = r; o[oi + 1] = g; o[oi + 2] = b; o[oi + 3] = 255; }
    }
    x.putImageData(od, 0, 0); return c;
  }
  N.outline = outline;

  // Cached solid-colour silhouettes (hit flash, elite outline, cast shadows).
  const silCache = new Map();
  N.silhouette = (c, color = '#ffffff') => {
    let m = silCache.get(c); if (!m) { m = {}; silCache.set(c, m); }
    if (!m[color]) { const s = cv(c.width, c.height), x = s.getContext('2d'); x.drawImage(c, 0, 0); x.globalCompositeOperation = 'source-in'; x.fillStyle = color; x.fillRect(0, 0, s.width, s.height); s.rs = c.rs || 1; s.W = c.W || c.width; s.H = c.H || c.height; m[color] = s; }
    return m[color];
  };
  // Soft radial glow textures used by the lighting pass.
  const glowCache = {};
  N.glow = (color) => {
    if (glowCache[color]) return glowCache[color];
    const c = cv(64, 64), x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32), [r, gg, b] = hexRgb(color);
    g.addColorStop(0, `rgba(${r},${gg},${b},1)`); g.addColorStop(0.35, `rgba(${r},${gg},${b},0.55)`); g.addColorStop(1, `rgba(${r},${gg},${b},0)`);
    x.fillStyle = g; x.fillRect(0, 0, 64, 64); glowCache[color] = c; return c;
  };

  // Soft contact shadow (an ellipse that fades out at the rim).
  N.shadowTex = (() => { const c = cv(64, 26), x = c.getContext('2d'); x.setTransform(1, 0, 0, 26 / 64, 0, 0); const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(4,2,10,0.9)'); g.addColorStop(0.6, 'rgba(4,2,10,0.6)'); g.addColorStop(1, 'rgba(4,2,10,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); return c; })();

  // ================================================================ MATERIALS (shadow, base, light, highlight)
  const M = {
    red: ['#6e1426', '#b02438', '#e2463f', '#ff9a7a'], ember: ['#8a2a14', '#d0561e', '#f59a3c', '#ffe08a'],
    slime: ['#165034', '#2f8f4c', '#5cc65e', '#c8ffaa'], green: ['#1d4a2c', '#2f7040', '#4f9a4a', '#a8e078'], moss: ['#1f4a24', '#356f2e', '#5a9a3a', '#a8d868'],
    leaf: ['#173a20', '#24562c', '#3a7a36', '#7cb850'], stone: ['#3a3a44', '#5a5a66', '#7e7e8a', '#b4b4c0'], mossStone: ['#2e3a30', '#4a5a48', '#6e7e66', '#a0b090'],
    steel: ['#3a4256', '#6a7690', '#a4b0c6', '#eef4ff'], dsteel: ['#1c2030', '#2e3448', '#4a536c', '#8a96b4'], gold: ['#7a4e14', '#b8862a', '#e8c050', '#fff2b0'],
    wood: ['#3a2216', '#5e3a22', '#86562e', '#b8844a'], dwood: ['#22140e', '#3a2418', '#58382a', '#7a5238'], leather: ['#3a2014', '#5e361e', '#8a5430', '#b8804a'],
    bone: ['#8a7a64', '#c8b898', '#e8dcc0', '#fffaf0'], purple: ['#2a1640', '#4a2a6a', '#7a4aa8', '#c08aff'], violet: ['#3a1a5a', '#6a3a9a', '#a070e0', '#e8c8ff'],
    crystal: ['#1a5a8a', '#2e94c8', '#62d0f4', '#e0fbff'], pink: ['#7a2a5a', '#b84a8a', '#e87ac0', '#ffd0f0'], teal: ['#0e4a4a', '#1a7a72', '#34b8a6', '#a8fff0'],
    sand: ['#6a4426', '#9a6a3a', '#c8955a', '#ecc488'], rust: ['#4a1e10', '#7a361c', '#a8542e', '#d88a52'], cloth: ['#7a6a4a', '#b8a47a', '#e0d0a8', '#fff6dc'],
    skinG: ['#2a5a24', '#4a8a32', '#76b84a', '#bce68a'], skinO: ['#7a3a1a', '#b05a2a', '#d8803e', '#f4b878'], dark: ['#120c1a', '#22182e', '#342642', '#56406a'],
    white: ['#8a8aa0', '#c8c8dc', '#ececf6', '#ffffff'], blue: ['#16264a', '#28427a', '#3e64b0', '#7aa6ea'], fire: ['#a02a10', '#e0561a', '#ffa030', '#fff2a0'],
    grey: ['#2e2e38', '#4a4a56', '#6a6a78', '#9a9aa8'], fur: ['#3a3a4a', '#5e5e72', '#8a8aa0', '#c4c4d4'], bark: ['#24160e', '#3e2818', '#5a3c24', '#7a5634'],
  };
  N.MAT = M;

  // ================================================================ HEROES (hand-placed pixel maps, 28x39)
  const HERO = {
    emberian: {
      hand: [20, 23], legs: { x0: 10, x1: 20, y0: 25, split: 15 },
      pal: { r: '#f4ead2', R: '#b8a07a', h: '#d22a3e', H: '#8a1430', i: '#ff6a5a', s: '#fde0c8', S: '#f0b090', T: '#c87a66', e: '#2a1020', y: '#ffb21e', Y: '#d07a10', w: '#ffffff', p: '#f49090', m: '#a83040', c: '#3fa07a', C: '#257058', D: '#163f38', g: '#f2c14e', l: '#8a5232', L: '#55301e', k: '#3a2a3a', K: '#24182a', b: '#5a3426', B: '#36201a', t: '#d22a3e', u: '#8a1430', v: '#f5a040' },
      rows: [
        '......r....r................', '......Rr...Rr...............', '.......Rr...Rr..............', '........Rr..hRrhhh..........',
        '.......hhRrhhhhhiihhh.......', '......HhhhhhhhiiiihhhH......', '......Hhhhhhhhhhhhhhhh......', '.....HhhhhhhHsshssshsh......',
        '.....HhhhhhHSeesseessS......', '.....HhhhhhHSywssywssS......', '.....hhhhhhHSYyssYysSs......', '.....hhhhhhHsspssspssS......',
        '......hhhhhHSsssssmsS.......', '......hhhhhHHTsssssS........', '......hhhhhH..TSS...........', '......hhhhHDCcgsgccCcC......',
        '......hhhhHDCccgcccCsS......', '......hhhhHDCcccgccCsS......', '......hhhhHDCccccgcCsS......', '.......hhhHDCcccccgCsS......',
        '.......hhhHTlllglllLsS......', '........hhH.kkkkkkkKlL......', '........tu.kkkkkkkkKlL......', '......ttu..kkkkKkkkKsS......',
        '....tttuv.kkkkkKkkkkK.......', '...ttuv....TsS..sss.........', '..ttu......TsS..ssS.........', '.ttv.......TsS..ssS.........',
        '..vt.......TsS..ssS.........', '...........TsS..ssS.........', '...........TsS..ssS.........', '...........bbB..bbB.........',
        '...........bgB..bgB.........', '...........bbB..bbB.........', '...........bbB..bbB.........', '...........bbB..bbB.........',
        '...........bbB..bbB.........', '..........bbbB..bbbB........', '..........BBBB..BBBB........',
      ],
    },
    sylvar: {
      hand: [20, 23], legs: { x0: 11, x1: 19, y0: 24, split: 15 },
      pal: { h: '#e8eef8', H: '#a8b2cc', i: '#ffffff', E: '#f7d6bc', F: '#d8a088', s: '#f7d6bc', S: '#e0aa8c', T: '#b87c66', e: '#13283a', y: '#3fe0cc', Y: '#1f9a8c', w: '#ffffff', p: '#f0a8a0', m: '#a85050', a: '#e8c860', g: '#5fe3d6', c: '#3e8a4a', C: '#25603a', D: '#163c28', v: '#9fd36a', V: '#6aa848', l: '#8a5a36', L: '#5a3620', n: '#3a3f66', N: '#262a48', b: '#5a3a28', B: '#3a2418' },
      rows: [
        '............................', '............................', '...........hhhhh............', '.........hhhhhhhhh..........',
        '........hhhhiiiihhhh........', '.......HhhhhhhiiihhhhH......', '....E.Hhhhaaaagaaaahhh......', '.....EEhhhhhHsshssshsh......',
        '......EFEhhHSeesseessS......', '.....hhFEEhHSywssywssS......', '.....hhhhFEHSYyssYysSs......', '.....hhhhhhHsspssspssS......',
        '.....hhhhhhHSsssssmsS.......', '.....hhhhhhHHTsssssS........', '.....hhhhhhH..TSS...........', '.....hhhhhcDCvvavvvCvC......',
        '.....hhhhccDCvvlvvvVsS......', '.....hhhcccDCvvvlvvVsS......', '.....hhhcccDCvvvvlvVsS......', '......hccccDCvvvvvlVsS......',
        '......cccccDLlllalllsS......', '......cccccD.vvVvvvVlL......', '.......ccccD.vvVvvvVlL......', '.......cccC.nnnNnnnNsS......',
        '........ccCnnN..nnN.........', '.........cCnnN..nnN.........', '...........nnN..nnN.........', '...........nnN..nnN.........',
        '...........NnN..nnN.........', '...........NnN..nnN.........', '...........bbB..bbB.........', '...........bbB..bbB.........',
        '...........lbB..lbB.........', '...........bbB..bbB.........', '...........bbB..bbB.........', '...........bbB..bbB.........',
        '...........bbB..bbB.........', '..........bbbB..bbbB........', '..........BBBB..BBBB........',
      ],
    },
    kestrus: {
      hand: [20, 23], legs: { x0: 10, x1: 20, y0: 24, split: 15 },
      pal: { f: '#6a9ae8', F: '#3f68b8', G: '#253f80', i: '#b8d8ff', q: '#f4ead2', Q: '#cdbb98', k: '#ffbe3a', K: '#c87a1a', e: '#1a1020', y: '#ffd23a', Y: '#c89010', w: '#ffffff', c: '#e8dcc0', C: '#bfa880', a: '#d04040', A: '#902a30', n: '#2c3a66', N: '#1c2648', t: '#f0b040', T: '#b07020', x: '#2a2020', W: '#3a5a9c', V: '#8ab0e8', X: '#223a70' },
      rows: [
        '............................', '......fF....................', '.......fFF..fF..............', '........fFFFfFFff...........',
        '.........FFfffiiiff.........', '........GFFffffiiiff........', '.......GFFFfffffffff........', '.......GFFFFffffqqqff.......',
        '......GGFFFFfffqqeeqqf......', '......GFFFFFffqqqywqqkk.....', '......GFFFFffqqqqYeqkkkk....', '.......GFFFffqqqqqqKkkK.....',
        '........GFFfQqqqqqQ.KK......', '.........GFFfQQQQQ..........', '..........GFffff............', '.....XWWWVV.CcccaccCcC......',
        '....XWWWWVVCccaacccCfF......', '....XWWWWVVCcccaaccCfF......', '....XWWWWVVCccccaacCfF......', '....XWWWWVVCccccccaaCfF.....',
        '....XWWWWVVAaaaaaaaAfF......', '....XWWWVVVCcccCcccCfF......', '.....XWWVVVCcccCcccCtT......', '.....XWVVV..nnnNnnnNtT......',
        '......XVVV.nnN..nnN.........', '.......VV..nnN..nnN.........', '........V..nnN..nnN.........', '...........nnN..nnN.........',
        '...........NnN..NnN.........', '...........TtT..TtT.........', '............tT...tT.........', '............tT...tT.........',
        '............tT...tT.........', '............tT...tT.........', '............tT...tT.........', '............tT...tT.........',
        '...........ttT..ttT.........', '..........xttTx.xttTx.......', '..........x.x.x.x.x.x.......',
      ],
    },
    haldor: {
      hand: [22, 23], legs: { x0: 10, x1: 19, y0: 24, split: 15 },
      pal: { f: '#a0582e', F: '#6e3a1e', p: '#e89a8a', m: '#3a2620', M: '#22160f', i: '#7a5a48', s: '#e8b48a', S: '#c88c64', T: '#9a6448', e: '#1a1010', y: '#a0682a', Y: '#6a4018', w: '#ffffff', o: '#8a3a32', c: '#c8d0dc', C: '#8a96aa', D: '#556074', v: '#3a6ac8', V: '#244a96', a: '#e8b84a', l: '#7a4a2a', L: '#4a2a16', n: '#3a3040', N: '#241c2a', r: '#2e2018', R: '#1a120c', K: '#4a4044', H: '#2a2226' },
      rows: [
        '........f...f...............', '........fF..fF..............', '........fpF.fpF.............', '........mfFmmfFmm...........',
        '.......mmmmmmmmiimm.........', '......Mmmmmmmmmiiimmm.......', '......Mmmmmmmmmmmmmmmm......', '.....MmmmmmmMssmsssmsm......',
        '.....MmmmmmMSeesseessS......', '.....MmmmmmMSywssywssS......', '.....mmmmmmMSYyssYysSs......', '.....mmmmmmMsssssssssS......',
        '......mmmmmMSssssoosS.......', '......mmmmmMMTsssssS........', '......mmmmmM..TSS...........', '.....mmmmmDcCCvvavvCCcD.....',
        '.....mmmmDccCvvvavvvCccD....', '.....mmmmDDCcvvvavvvcCsS....', '.....mmmm.DCcvvvavvvcCsS....', '.....mmm..DCcvvvavvvcCsS....',
        '.....mmm..DLllllallllLsS....', '......mm..DvvvvVvvvvV.lL....', '.......mmrDvvvvVvvvvV.lL....', '........MrDvvvvVvvvvV.sS....',
        '.......rrr.nnN..nnN.........', '......rrR..nnN..nnN.........', '.....rrR...nnN..nnN.........', '.....rRR...nnN..nnN.........',
        '.....rR....nnN..nnN.........', '....rrR....cCD..cCD.........', '....rR.....cCD..cCD.........', '....rR.....cCD..cCD.........',
        '.....R.....fFf..fFf.........', '..........fffF.fffF.........', '...........fF...fF..........', '...........fF...fF..........',
        '...........KH...KH..........', '..........KKHH.KKHH.........', '..........HHHH.HHHH.........',
      ],
    },
  };
  // Rim light on the top-left silhouette edge, shade on the bottom-right edge, and a slow fall-off toward the feet.
  function volume(P, dark, light, fall) {
    const w = P.w, h = P.h, id = P.x.getImageData(0, 0, w, h), d = id.data, src = new Uint8ClampedArray(d);
    const a = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : src[(y * w + x) * 4 + 3]);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4; if (!src[i + 3]) continue;
      let m = 1 - Math.max(0, y / h - 0.45) * fall;
      if (!a(x + 1, y) || !a(x, y + 1)) m *= dark;
      if (!a(x - 1, y) || !a(x, y - 1)) { for (let k = 0; k < 3; k++) d[i + k] = d[i + k] + (255 - d[i + k]) * light; }
      for (let k = 0; k < 3; k++) d[i + k] *= m;
    }
    P.x.putImageData(id, 0, 0);
  }
  // Walk cycle: legs move independently, the upper body bobs by stretching the hip row.
  function heroFrames(def) {
    const rows = ['............................'].concat(def.rows), H = rows.length, W = 28, L = def.legs, y0 = L.y0 + 1;
    const at = (x, y) => (y >= 0 && y < H && rows[y][x]) || '.';
    const isLeg = (x, y) => y >= y0 && x >= L.x0 && x <= L.x1;
    const frame = (lx, ly, rx, ry, bob) => {
      const g = []; for (let y = 0; y < H; y++) g.push(new Array(W).fill('.'));
      const put = (x, y, ch) => { if (ch !== '.' && x >= 0 && x < W && y >= 0 && y < H) g[y][x] = ch; };
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { if (!isLeg(x, y)) continue; const ch = at(x, y); if (x < L.split) put(x + lx, y + ly, ch); else put(x + rx, y + ry, ch); }
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        if (isLeg(x, y)) continue;
        if (bob < 0) { if (y < y0 - 1) put(x, y, at(x, y + 1)); else put(x, y, at(x, y)); }
        else put(x, y, at(x, y));
      }
      const P = new Painter(W, H).map(g.map((r) => r.join('')), def.pal);
      volume(P, 0.78, 0.16, 0.2);
      return P.out();
    };
    return [frame(0, 0, 0, 0, 0), frame(1, -2, -1, 0, -1), frame(0, 0, 0, 0, 0), frame(-1, 0, 1, -2, -1), frame(0, 0, 0, 0, -1)];
  }
  for (const k in HERO) { S.ch[k] = heroFrames(HERO[k]); S.hero[k] = { hand: [HERO[k].hand[0] + 1, HERO[k].hand[1] + 2] }; }
  // Portrait: the head, cropped for the HUD.
  for (const k in HERO) { const src = S.ch[k][0], c = cv(20, 18); c.getContext('2d').drawImage(src, -4, 0); S.hero[k].face = fin(c); }

  // Emberian's dragon form (cel-shaded volumes), three walk frames.
  function dragon(step) {
    const P = new Painter(62, 46);
    const leg = (i) => (step === 0 ? 0 : (i % 2 === (step === 1 ? 0 : 1) ? -2 : 0));
    P.layer(['#4a0c1c', '#7a1a2a', '#9a2434', '#c03a40'], (q) => { q.ell(22, 36 + leg(1), 3.5, 7, '#fff'); q.ell(42, 36 + leg(3), 3.5, 7, '#fff'); });
    P.layer(M.red, (q) => q.stroke([[3, 16], [6, 24], [12, 30], [20, 32]], 2, 9, '#fff'), { r: 4 });
    P.poly([[0, 14], [3, 8], [6, 15]], '#f59a3c');
    P.layer(['#4a0a1a', '#7a1428', '#a0283a', '#d04a50'], (q) => q.poly([[22, 24], [28, 4], [36, 10], [44, 3], [44, 22]], '#fff'), { r: 4 });
    P.line(28, 4, 31, 22, '#3a0612').line(44, 3, 41, 22, '#3a0612');
    P.layer(M.red, (q) => q.ell(32, 30, 16, 9.5, '#fff'), { r: 8, rim: '#ff8a5a' });
    P.layer(M.ember, (q) => q.ell(32, 35.5, 11, 3.6, '#fff'), { r: 3 });
    for (const sx of [19, 25, 31, 37]) P.poly([[sx, 22], [sx + 2.5, 15.5], [sx + 5, 22]], '#f59a3c');
    P.layer(M.red, (q) => { q.ell(46, 20, 5.5, 9, '#fff'); }, { r: 5 });
    P.layer(M.red, (q) => { q.ell(51, 12, 8.5, 7, '#fff'); q.poly([[52, 8], [62, 12], [61, 17], [50, 18]], '#fff'); }, { r: 6, rim: '#ff8a5a' });
    P.layer(M.bone, (q) => { q.stroke([[47, 7], [43, 3], [40, 0]], 3, 1, '#fff'); q.stroke([[51, 6], [49, 2], [48, 0]], 2.6, 1, '#fff'); }, { r: 2 });
    P.rect(52, 9, 3, 2, '#1a0810').px(53, 9, '#ffd23a').px(54, 9, '#ffd23a').px(60, 12, '#3a0612');
    P.rect(53, 17, 1, 2, '#ffffff').rect(57, 17, 1, 2, '#ffffff').line(51, 16, 61, 16, '#5a0c1c');
    P.layer(M.red, (q) => { q.ell(25, 37 + leg(0), 4, 7, '#fff'); q.ell(45, 37 + leg(2), 4, 7, '#fff'); }, { r: 4 });
    P.rect(22, 43 + leg(0), 7, 2, '#efe3c8').rect(42, 43 + leg(2), 7, 2, '#efe3c8');
    return P.out();
  }
  S.ch.dragon = [dragon(0), dragon(1), dragon(0), dragon(2), dragon(0)];

  // ================================================================ ENEMIES (cel-shaded volumes, 2 frames)
  const E = {};
  const eyes = (P, pts, c = '#ffe066', r = 1.4) => { for (const [x, y] of pts) { P.circ(x, y, r + 0.6, '#120a12').circ(x, y, r, c); P.px(x - 0.5, y - 0.8, '#ffffff'); } };
  E.gosmo = (f) => {
    const P = new Painter(30, 24), s = f ? 1.6 : 0;
    P.layer(M.slime, (q) => q.ell(15, 15 + s * 0.4, 13.5 + s, 8.5 - s), { r: 7, rim: '#a8ff8a' });
    P.layer(['#123a26', '#1f5a34', '#2f7a44', '#4a9a5a'], (q) => q.ell(15, 17 + s * 0.4, 6, 3.5 - s * 0.3), { r: 3 });
    P.ell(9, 10 + s, 3.5, 1.6, 'rgba(230,255,220,0.75)');
    P.ell(10, 13 + s * 0.6, 2.6, 3, '#f4fff0').ell(20, 13 + s * 0.6, 2.6, 3, '#f4fff0').rect(10, 13 + s * 0.6, 2, 3, '#0e1a10').rect(20, 13 + s * 0.6, 2, 3, '#0e1a10');
    P.line(7, 9 + s, 12, 11 + s, '#0e2a14', 1.5).line(23, 9 + s, 18, 11 + s, '#0e2a14', 1.5).line(13, 18 + s * 0.5, 17, 18 + s * 0.5, '#0e2a14');
    return P.out();
  };
  E.cogumelo = (f) => {
    const P = new Painter(30, 32), d = f ? 2 : 0;
    P.layer(M.cloth, (q) => { q.ell(15, 22, 7, 9, '#fff'); q.ell(11, 30, 3, 2, '#fff'); q.ell(19, 30, 3, 2, '#fff'); }, { r: 5 });
    eyes(P, [[12.5, 22], [18.5, 22]], '#ff5a3a', 1.2);
    P.line(13, 26, 17, 26, '#4a2a20');
    P.layer(M.red, (q) => q.ell(15, 11 + d, 14.5, 9 - d * 0.5), { r: 8, rim: '#ff9a8a' });
    P.layer(['#6a4a3a', '#8a6a52', '#a88a6a', '#c8a888'], (q) => q.ell(15, 17 + d * 0.6, 10, 2), { r: 2 });
    for (const [x, y, r] of [[8, 9, 2.4], [15, 5, 2.8], [21, 10, 2], [24, 14, 1.5], [11, 15, 1.4]]) P.circ(x, y + d, r, '#f4ead8').circ(x - 0.5, y + d - 0.5, r * 0.5, '#ffffff');
    return P.out();
  };
  E.goblin = (f) => {
    const P = new Painter(32, 38), a = f ? 1 : 0;
    P.layer(M.wood, (q) => q.line(26, 4, 25, 37, '#fff', 2), { r: 2 });
    P.layer(M.steel, (q) => q.poly([[23.5, 6], [26, -1], [28.5, 6], [26, 8]], '#fff'), { r: 3 });
    P.layer(M.leather, (q) => { q.rect(10, 28 + a, 4, 9 - a, '#fff'); q.rect(16, 28 - a, 4, 9 + a, '#fff'); }, { r: 2 });
    P.rect(9, 35 + a, 6, 2, '#2a1a10').rect(15, 35, 6, 2, '#2a1a10');
    P.layer(M.leather, (q) => { q.poly([[8, 18], [22, 18], [21, 30], [9, 30]], '#fff'); }, { r: 4 });
    P.rect(8, 25, 14, 2, '#3a2010').rect(14, 25, 2, 2, '#e8c050');
    P.layer(M.skinG, (q) => { q.ell(23, 22, 2.6, 5, '#fff'); q.ell(8, 22, 2.4, 5, '#fff'); }, { r: 2 });
    P.layer(M.skinG, (q) => { q.ell(16, 11, 7, 7, '#fff'); q.poly([[10, 9], [1, 4], [10, 13]], '#fff'); q.poly([[22, 9], [30, 3], [22, 13]], '#fff'); q.ell(21, 13, 3, 2.4, '#fff'); }, { r: 5, rim: '#c8ff8a' });
    P.rect(13, 8, 4, 1, '#1a2a10').rect(18, 8, 4, 1, '#1a2a10');
    eyes(P, [[15, 11], [20, 11]], '#ffe066', 1.1);
    P.rect(15, 16, 6, 1, '#2a1a10').px(16, 17, '#fff').px(19, 17, '#fff');
    P.layer(M.skinG, (q) => q.ell(25, 21, 2.5, 2.5, '#fff'), { r: 2 });
    return P.out();
  };
  E.lobo = (f) => {
    const P = new Painter(46, 28), dk = ['#1e1e2a', '#2e2e40', '#44445a', '#6a6a84'];
    P.layer(M.fur, (q) => q.stroke([[8, 12], [4, 7], [1, 3]], 6, 3, '#fff'), { r: 3 });
    const legs = f ? [[10, 18, 2], [17, 17, -2], [27, 18, 2], [33, 17, -2]] : [[11, 17, 0], [16, 18, 0], [28, 17, 0], [32, 18, 0]];
    P.layer(dk, (q) => { for (const [x, y, k] of legs) q.poly([[x, y], [x + 4, y], [x + 4 + k, y + 9], [x + 1 + k, y + 9]], '#fff'); }, { r: 2 });
    P.layer(M.fur, (q) => q.ell(21, 13, 14, 7, '#fff'), { r: 6, rim: '#9aa8ff' });
    P.layer(['#1a1a26', '#2a2a3c', '#3c3c52', '#5a5a74'], (q) => q.ell(20, 9, 11, 3, '#fff'), { r: 3 });
    P.layer(M.fur, (q) => { q.ell(36, 9, 6.5, 6, '#fff'); q.poly([[38, 7], [46, 10], [45, 14], [37, 14]], '#fff'); q.poly([[31, 5], [32, -1], [36, 4]], '#fff'); q.poly([[35, 4], [38, -1], [39, 5]], '#fff'); }, { r: 4, rim: '#9aa8ff' });
    P.px(45, 10, '#120a12').px(44, 10, '#120a12');
    eyes(P, [[38, 8]], '#ffcf3a', 1.1);
    P.line(39, 14, 44, 13, '#ffffff');
    return P.out();
  };
  E.kobold = (f) => {
    const P = new Painter(32, 36), a = f ? 1 : 0;
    P.layer(M.skinO, (q) => q.stroke([[9, 26], [4, 30], [1, 34]], 4, 1.5, '#fff'), { r: 2 });
    P.layer(M.leather, (q) => { q.rect(10, 27 + a, 4, 8 - a, '#fff'); q.rect(16, 27 - a, 4, 8 + a, '#fff'); }, { r: 2 });
    P.layer(M.green, (q) => q.poly([[8, 15], [22, 15], [23, 29], [7, 29]], '#fff'), { r: 4 });
    P.rect(7, 23, 16, 2, '#3a2010');
    P.layer(M.skinO, (q) => { q.ell(15, 10, 6, 6, '#fff'); q.poly([[18, 8], [27, 10], [26, 14], [17, 14]], '#fff'); }, { r: 4 });
    P.layer(M.green, (q) => { q.ell(14, 7, 7.5, 5.5, '#fff'); q.poly([[8, 8], [3, 18], [9, 14]], '#fff'); }, { r: 4 });
    eyes(P, [[20, 10]], '#ffe066', 1.1);
    P.px(26, 11, '#2a1010');
    P.layer(M.wood, (q) => q.stroke([[25, 6], [29, 12], [29, 22], [25, 30]], 2.2, 2.2, '#fff'), { r: 2 });
    P.line(25, 6, 25, 30, '#e8e0c8');
    P.layer(M.skinO, (q) => q.ell(25, 18, 2.2, 2.2, '#fff'), { r: 2 });
    return P.out();
  };
  E.besouro = (f) => {
    const P = new Painter(40, 30), o = f ? 2 : 0, lg = '#1e1a18';
    for (const x of [9, 17, 25]) { P.line(x, 20, x - 4 + o, 29, lg, 2).line(x + 2, 20, x + 6 - o, 29, lg, 2); }
    P.layer(M.mossStone, (q) => q.ell(18, 15, 16, 11, '#fff'), { r: 8, rim: '#a8c8a0' });
    P.line(18, 4, 18, 26, '#2a3028', 1.4);
    P.layer(M.stone, (q) => { q.circ(10, 11, 2.6, '#fff'); q.circ(25, 9, 3, '#fff'); q.circ(26, 19, 2, '#fff'); }, { r: 2 });
    for (const [x, y] of [[12, 6], [14, 5], [22, 5], [23, 6], [8, 9]]) P.rect(x, y, 2, 1, '#6fb04a');
    P.layer(M.dark, (q) => q.ell(34, 18, 5, 5, '#fff'), { r: 3 });
    P.layer(M.bone, (q) => q.stroke([[35, 15], [38, 10], [40, 6]], 3, 1, '#fff'), { r: 2 });
    eyes(P, [[36, 18]], '#ff6a3a', 1.1);
    return P.out();
  };
  E.imp = (f) => {
    const P = new Painter(32, 32), w = f ? 3 : 0;
    P.layer(['#120818', '#24122e', '#3a1e48', '#5a3070'], (q) => { q.poly([[10, 15], [0, 6 + w], [2, 20 + w * 0.5]], '#fff'); q.poly([[22, 15], [32, 6 + w], [30, 20 + w * 0.5]], '#fff'); }, { r: 3 });
    P.layer(M.purple, (q) => q.stroke([[16, 26], [22, 29], [27, 28]], 2.4, 1.2, '#fff'), { r: 2 });
    P.poly([[26, 26], [30, 28], [26, 30]], '#ff4ad0');
    P.layer(M.purple, (q) => { q.ell(16, 21, 7, 7.5, '#fff'); q.ell(12, 29, 2.5, 2, '#fff'); q.ell(20, 29, 2.5, 2, '#fff'); }, { r: 5, rim: '#c87aff' });
    P.layer(M.purple, (q) => q.ell(16, 11, 7.5, 7, '#fff'), { r: 5, rim: '#c87aff' });
    P.layer(M.bone, (q) => { q.stroke([[11, 6], [8, 2], [6, 0]], 3, 1, '#fff'); q.stroke([[21, 6], [24, 2], [26, 0]], 3, 1, '#fff'); }, { r: 2 });
    P.ell(13, 11, 1.8, 1.2, '#ff4ad0').ell(20, 11, 1.8, 1.2, '#ff4ad0').px(13, 11, '#ffffff').px(20, 11, '#ffffff');
    P.rect(13, 15, 7, 1, '#1a0a1a').px(14, 16, '#ffd0f0').px(18, 16, '#ffd0f0');
    return P.out();
  };
  E.olho = (f) => {
    const P = new Painter(38, 34), w = f ? 3 : -1;
    P.layer(['#1a0a24', '#2e1640', '#46245e', '#6a3a88'], (q) => { q.poly([[11, 14], [0, 6 + w], [2, 20 + w], [9, 21]], '#fff'); q.poly([[27, 14], [38, 6 + w], [36, 20 + w], [29, 21]], '#fff'); }, { r: 3 });
    P.layer(M.purple, (q) => { q.stroke([[16, 26], [15, 30], [17, 34]], 2.4, 1, '#fff'); q.stroke([[22, 26], [23, 30], [21, 34]], 2.4, 1, '#fff'); }, { r: 2 });
    P.layer(M.white, (q) => q.circ(19, 16, 11.5, '#fff'), { r: 9, rim: '#d8b8ff' });
    for (const [a, b, c2, d] of [[9, 18, 12, 16], [10, 22, 14, 21], [28, 20, 25, 19]]) P.line(a, b, c2, d, '#d84a6a');
    P.layer(M.violet, (q) => q.circ(21, 16, 6, '#fff'), { r: 4 });
    P.circ(21.5, 16, 3, '#120818').circ(19, 13, 1.6, '#ffffff');
    return P.out();
  };
  E.cavaleiro = (f) => {
    const P = new Painter(34, 44), a = f ? 1 : 0;
    P.layer(M.dsteel, (q) => { q.rect(11, 32 + a, 5, 11 - a, '#fff'); q.rect(18, 32 - a, 5, 11 + a, '#fff'); }, { r: 3 });
    P.layer(['#3a2a5a', '#5a3a8a', '#7a5ab8', '#a88aff'], (q) => q.poly([[9, 17], [25, 17], [27, 34], [7, 34]], '#fff'), { r: 4 });
    P.layer(M.steel, (q) => { q.poly([[9, 16], [25, 16], [24, 28], [10, 28]], '#fff'); q.ell(8, 18, 4, 3.5, '#fff'); q.ell(26, 18, 4, 3.5, '#fff'); }, { r: 5, rim: '#c8b8ff' });
    P.rect(10, 27, 14, 2, '#d0a840');
    P.layer(M.steel, (q) => { q.ell(17, 9, 7, 8, '#fff'); q.rect(10, 9, 14, 6, '#fff'); }, { r: 5, rim: '#c8b8ff' });
    P.rect(13, 10, 10, 2, '#120818').px(17, 11, '#d05aff').px(21, 11, '#d05aff');
    P.layer(M.pink, (q) => q.stroke([[13, 2], [8, 0], [3, 3], [1, 8]], 4, 1.5, '#fff'), { r: 2 });
    P.layer(['#4a3a7a', '#8a7ac8', '#c8b8ff', '#ffffff'], (q) => q.ell(28, 24, 5.5, 9.5, '#fff'), { r: 6 });
    P.ring(28, 24, 5.5, '#d0a840', 1.2);
    P.line(26, 18, 30, 29, '#ffffff').line(27, 18, 31, 28, '#e8e0ff');
    return P.out();
  };
  E.morcego = (f) => {
    const P = new Painter(36, 22), m = ['#120818', '#22102e', '#36204a', '#563a70'];
    if (f) P.layer(m, (q) => { q.poly([[13, 9], [0, 16], [5, 20], [12, 14]], '#fff'); q.poly([[23, 9], [36, 16], [31, 20], [24, 14]], '#fff'); }, { r: 3 });
    else P.layer(m, (q) => { q.poly([[13, 10], [0, 0], [2, 9], [5, 8], [7, 14]], '#fff'); q.poly([[23, 10], [36, 0], [34, 9], [31, 8], [29, 14]], '#fff'); }, { r: 3 });
    P.layer(M.purple, (q) => { q.ell(18, 11, 6, 6, '#fff'); q.poly([[13, 7], [13, 0], [16, 5]], '#fff'); q.poly([[23, 7], [23, 0], [20, 5]], '#fff'); }, { r: 4, rim: '#c87aff' });
    P.px(15, 10, '#ff5ad0').px(16, 10, '#ff5ad0').px(20, 10, '#ff5ad0').px(21, 10, '#ff5ad0').px(17, 14, '#fff').px(19, 14, '#fff');
    return P.out();
  };
  E.mago = (f) => {
    const P = new Painter(32, 40), fl = f ? 2 : 0;
    P.layer(M.wood, (q) => q.line(27, 12, 27, 39, '#fff', 2), { r: 2 });
    P.layer(M.teal, (q) => q.poly([[15, 11], [4, 38], [27, 38]], '#fff'), { r: 6, rim: '#a8fff0' });
    P.layer(['#0a2a2a', '#124444', '#1a5c58', '#2a7a72'], (q) => q.poly([[15, 18], [10, 38], [20, 38]], '#fff'), { r: 3 });
    P.rect(4, 36, 23, 2, '#e8c050');
    P.layer(M.teal, (q) => q.ell(15, 13, 7, 7, '#fff'), { r: 5 });
    P.ell(16.5, 14.5, 4.5, 4, '#0a0610');
    P.px(15, 14, '#ffe066').px(18, 14, '#ffe066');
    P.layer(M.ember, (q) => q.poly([[9, 0 + fl], [22, 0 + fl], [15.5, 6 + fl]], '#fff'), { r: 3 });
    P.layer(M.ember, (q) => q.circ(27, 10, 3.2, '#fff'), { r: 3 });
    return P.out();
  };
  E.aranha = (f) => {
    const P = new Painter(40, 28), lg = '#2a3448', o = f ? 2 : -2;
    for (let i = 0; i < 4; i++) { const x = 13 + i * 5, k = i % 2 ? o : -o; P.line(x, 14, x - 6, 4 + k, lg, 2).line(x - 6, 4 + k, x - 9, 9, lg, 1.5); P.line(x, 16, x - 4, 27 - k, lg, 2); }
    P.layer(M.crystal, (q) => q.ell(13, 15, 10, 8.5, '#fff'), { r: 7, rim: '#c8f8ff' });
    P.layer(M.pink, (q) => { q.poly([[10, 9], [12, 0], [15, 9]], '#fff'); q.poly([[4, 12], [1, 4], [8, 10]], '#fff'); q.poly([[16, 9], [21, 3], [20, 11]], '#fff'); }, { r: 2 });
    P.line(7, 12, 16, 20, '#e0fbff').line(9, 18, 14, 10, '#1a5a8a');
    P.layer(M.dark, (q) => q.ell(27, 15, 6.5, 5.5, '#fff'), { r: 4 });
    for (const [x, y] of [[29, 13], [31, 14], [29, 17], [32, 16]]) P.px(x, y, '#ff5ad0');
    P.line(32, 18, 35, 21, '#c8b8ff').line(31, 19, 33, 22, '#c8b8ff');
    return P.out();
  };
  E.escorpiao = (f) => {
    const P = new Painter(44, 30), o = f ? 2 : 0;
    for (const x of [13, 18, 23, 28]) P.line(x, 22, x - 3 + o, 29, '#3a1a0c', 2);
    P.layer(M.rust, (q) => { for (const [x, y, r] of [[9, 16, 4], [7, 10, 3.6], [9, 5, 3.2], [14, 2.5, 2.8]]) q.circ(x, y, r, '#fff'); }, { r: 3, rim: '#ffb07a' });
    P.layer(M.gold, (q) => q.poly([[16, 1], [22, 3], [17, 6]], '#fff'), { r: 2 });
    P.layer(M.rust, (q) => q.ell(20, 20, 12, 6.5, '#fff'), { r: 6, rim: '#ffb07a' });
    for (const x of [14, 19, 24]) P.line(x, 15, x, 25, '#4a1e10');
    P.layer(M.rust, (q) => { q.ell(35, 18 - o * 0.5, 5, 3.5, '#fff'); q.poly([[38, 15 - o], [44, 13 - o], [41, 17 - o]], '#fff'); q.poly([[38, 20 - o], [44, 22 - o], [40, 21 - o]], '#fff'); }, { r: 3 });
    eyes(P, [[30, 17], [30, 21]], '#ffe066', 0.9);
    return P.out();
  };
  E.verme = (f) => {
    const P = new Painter(36, 38), m = f ? 2 : 0;
    P.layer(M.sand, (q) => q.ell(18, 31, 14, 7, '#fff'), { r: 6 });
    P.layer(['#6a4426', '#9a6a3a', '#c08a52', '#e0b07a'], (q) => q.ell(18, 23 - m * 0.5, 12, 7, '#fff'), { r: 6 });
    P.layer(['#7a5030', '#b07a48', '#d8a06a', '#f4c890'], (q) => q.ell(18, 13 - m, 11, 10, '#fff'), { r: 7, rim: '#ffd8a0' });
    P.rect(7, 21, 22, 1, '#6a4020').rect(6, 29, 24, 1, '#6a4020');
    P.circ(18, 11 - m, 6.5, '#2a0e0e').circ(18, 11 - m, 4, '#5a1a1a');
    for (let a = 0; a < 10; a++) P.px(18 + Math.cos(a * 0.628) * 5.6, 11 - m + Math.sin(a * 0.628) * 5.6, '#fff4e0');
    P.circ(18, 11 - m, 1.8, '#ff6a3a');
    return P.out();
  };
  E.verme_mound = (f) => {
    const P = new Painter(38, 18);
    P.layer(M.sand, (q) => q.ell(19, 12, 17, 6 + (f ? 1 : 0), '#fff'), { r: 5 });
    for (const [x, y] of [[8, 10], [27, 12], [18, 7], [12, 14]]) P.rect(x, y, 2, 2, '#6a4020');
    return P.out();
  };
  E.golem = (f) => {
    const P = new Painter(48, 48), a = f ? -3 : 0;
    P.layer(M.dsteel, (q) => { q.rect(13, 36, 8, 12, '#fff'); q.rect(27, 36, 8, 12, '#fff'); }, { r: 4 });
    P.layer(M.rust, (q) => { q.ell(6, 26 + a, 6, 11, '#fff'); q.ell(42, 26 + a, 6, 11, '#fff'); }, { r: 5 });
    P.layer(M.dsteel, (q) => { q.rect(1, 33 + a, 10, 7, '#fff'); q.rect(37, 33 + a, 10, 7, '#fff'); }, { r: 3 });
    P.layer(['#3a2a20', '#6a4e36', '#8a6a4a', '#b08a62'], (q) => q.poly([[9, 15], [39, 15], [37, 38], [11, 38]], '#fff'), { r: 8, rim: '#e8b070' });
    P.layer(M.rust, (q) => { q.rect(13, 19, 9, 7, '#fff'); q.rect(27, 28, 7, 6, '#fff'); }, { r: 3 });
    for (const [x, y] of [[11, 17], [36, 17], [12, 35], [35, 35], [24, 25]]) P.circ(x, y, 1.2, '#e8c890');
    P.layer(M.grey, (q) => q.rect(16, 2, 16, 14, '#fff'), { r: 5 });
    P.rect(19, 7, 10, 4, '#1a0a08').rect(21, 8, 6, 2, '#ffb02e').px(22, 8, '#fff6c0');
    P.line(32, 4, 38, 0, '#2a2420', 2);
    return P.out();
  };
  E.poeira = (f) => {
    const P = new Painter(34, 34);
    P.layer(M.sand, (q) => q.circ(17, 18, 13, '#fff'), { r: 8 });
    for (let i = 0; i < 4; i++) { const a0 = i * 1.57 + (f ? 0.7 : 0); const pts = []; for (let t = 0; t < 2.2; t += 0.2) pts.push([17 + Math.cos(a0 + t) * (3 + t * 4.5), 18 + Math.sin(a0 + t) * (3 + t * 4.5)]); P.stroke(pts, 1.5, 2.5, '#f4dcb0'); }
    P.rect(10, 16, 5, 2, '#2a1408').rect(19, 16, 5, 2, '#2a1408').rect(12, 17, 2, 1, '#ff6a3a').rect(21, 17, 2, 1, '#ff6a3a');
    P.poly([[12, 30], [17, 34], [22, 30]], '#c89a5a');
    return P.out();
  };
  E.abutre = (f) => {
    const P = new Painter(50, 32), w = f ? 6 : 0, m = ['#1a1214', '#2e2224', '#463638', '#6a5254'];
    P.layer(m, (q) => { q.poly([[24, 14], [0, 4 + w], [4, 16 + w], [18, 20]], '#fff'); q.poly([[26, 14], [50, 4 + w], [46, 16 + w], [32, 20]], '#fff'); }, { r: 4 });
    for (const k of [0, 1, 2]) { P.line(5 + k * 5, 7 + w + k, 20, 17, '#e8dcc8').line(45 - k * 5, 7 + w + k, 30, 17, '#e8dcc8'); }
    P.layer(['#2a1e20', '#463436', '#5e4a4c', '#806668'], (q) => q.ell(25, 18, 7, 8.5, '#fff'), { r: 5 });
    P.layer(M.bone, (q) => q.rect(19, 12, 12, 3, '#fff'), { r: 2 });
    P.layer(M.pink, (q) => q.circ(25, 7, 4.6, '#fff'), { r: 3 });
    P.layer(M.gold, (q) => q.poly([[28, 7], [33, 9], [28, 11]], '#fff'), { r: 2 });
    eyes(P, [[26, 6]], '#120a12', 0.6);
    P.rect(21, 27, 2, 4, '#e8dcc8').rect(27, 27, 2, 4, '#e8dcc8');
    return P.out();
  };
  E.sentinela = (f) => {
    const P = new Painter(38, 48);
    P.layer(['#4a3420', '#7a5a38', '#9a7a52', '#c0a070'], (q) => q.poly([[2, 47], [36, 47], [30, 32], [8, 32]], '#fff'), { r: 6 });
    P.layer(M.sand, (q) => q.rect(10, 14, 18, 20, '#fff'), { r: 6 });
    P.rect(10, 23, 18, 2, '#5fe3d6');
    P.layer(['#8a6a48', '#b89470', '#d8b890', '#f4e0b8'], (q) => q.ell(19, 13, 11, 9, '#fff'), { r: 7 });
    P.circ(19, 19, 5.5, '#1a0e08').circ(19, 19, 3.4, f ? '#fff2c0' : '#5fe3d6').circ(18, 18, 1, '#ffffff');
    for (const [x, y] of [[6, 41], [31, 41], [19, 6]]) P.rect(x, y, 2, 2, '#5fe3d6');
    return P.out();
  };
  for (const k in E) S.en[k] = [E[k](0), E[k](1)];

  // ================================================================ BOSSES
  function musgo(f) {
    const P = new Painter(104, 92), a = f ? -4 : 0;
    P.layer(M.mossStone, (q) => { q.rect(26, 72, 18, 20, '#fff'); q.rect(60, 72, 18, 20, '#fff'); }, { r: 6 });
    P.layer(M.mossStone, (q) => { q.ell(12, 56 + a, 12, 19, '#fff'); q.ell(92, 56 + a, 12, 19, '#fff'); }, { r: 9, rim: '#a0c890' });
    P.layer(M.moss, (q) => { q.ell(12, 42 + a, 12, 8, '#fff'); q.ell(92, 42 + a, 12, 8, '#fff'); }, { r: 5 });
    P.layer(M.mossStone, (q) => q.ell(52, 50, 40, 31, '#fff'), { r: 14, rim: '#a0c890' });
    for (const [x0, y0, x1, y1] of [[28, 58, 40, 72], [70, 54, 80, 70], [50, 70, 54, 80]]) P.line(x0, y0, x1, y1, '#24301e', 1.5);
    P.layer(M.moss, (q) => { q.ell(52, 28, 38, 17, '#fff'); for (const [x, h] of [[20, 14], [30, 10], [42, 16], [64, 12], [76, 14], [86, 8]]) q.ell(x, 34 + h / 2, 3.5, h / 2 + 2, '#fff'); }, { r: 9, rim: '#c8ff9a' });
    P.layer(M.red, (q) => { q.ell(38, 15, 8, 4.6, '#fff'); q.ell(72, 18, 6, 3.6, '#fff'); }, { r: 3 });
    P.layer(M.cloth, (q) => { q.rect(36, 17, 4, 6, '#fff'); q.rect(70, 20, 3, 4, '#fff'); }, { r: 2 });
    for (const [x, y] of [[34, 13], [41, 14], [70, 17]]) P.circ(x, y, 1.2, '#fff4e0');
    const fl = ['#ffe066', '#ff8ad0', '#ffffff', '#8ad0ff'];
    for (let i = 0; i < 22; i++) { const x = 18 + ((i * 37) % 68), y = 20 + ((i * 13) % 22); P.rect(x, y, 2, 2, fl[i % 4]); }
    P.layer(M.gold, (q) => { q.ell(38, 50, 5.5, 3.5, '#fff'); q.ell(64, 50, 5.5, 3.5, '#fff'); }, { r: 3, spec: true });
    P.rect(36, 49, 3, 2, '#ffffff').rect(62, 49, 3, 2, '#ffffff');
    P.rect(42, 64, 18, 3, '#141a10').rect(44, 63, 2, 1, '#e8dcc0').rect(55, 63, 2, 1, '#e8dcc0');
    return P.out();
  }
  function nyxara(f) {
    const P = new Painter(84, 100);
    P.layer(M.purple, (q) => { q.poly([[26, 80], [42, 99 - (f ? 4 : 0)], [58, 80]], '#fff'); q.poly([[18, 76], [8, 94], [30, 84]], '#fff'); q.poly([[66, 76], [76, 94], [54, 84]], '#fff'); }, { r: 5 });
    P.layer(M.gold, (q) => q.ell(42, 46, 31, 41, '#fff'), { r: 10, rim: '#fff2b0' });
    P.ell(42, 46, 26, 36, '#120818');
    P.layer(['#2a1648', '#46287a', '#6a44b0', '#a07ae8'], (q) => q.ell(42, 46, 24, 34, '#fff'), { r: 16 });
    P.layer(['#6a4ab0', '#9a7ae0', '#c8b0ff', '#ffffff'], (q) => q.poly([[26, 22], [34, 16], [24, 52], [20, 48]], '#fff'), { r: 3 });
    P.layer(M.gold, (q) => { q.poly([[30, 4], [42, 0], [54, 4], [48, 8], [36, 8]], '#fff'); }, { r: 3 });
    P.circ(42, 4, 3.4, '#ff4ad0').px(41, 3, '#ffffff');
    const eo = f ? 0.8 : 0;
    P.ell(32, 40, 5, 2.6 + eo, '#ff4ad0').ell(52, 40, 5, 2.6 + eo, '#ff4ad0').ell(32, 40, 2, 1.4, '#ffffff').ell(52, 40, 2, 1.4, '#ffffff');
    P.poly([[34, 56], [50, 56], [46, 60], [38, 60]], '#0a0414').px(40, 58, '#ff9ae8').px(44, 58, '#ff9ae8');
    P.line(24, 16, 42, 46, '#ffffff', 1.4).line(42, 46, 58, 74, '#ffffff', 1.4).line(42, 46, 64, 36, '#e8d8ff').line(42, 46, 30, 62, '#e8d8ff');
    return P.out();
  }
  function kharun(f) {
    const P = new Painter(136, 104);
    P.layer(['#3a2e24', '#5e4e3e', '#86745e', '#b4a084'], (q) => { q.poly([[16, 26], [6, 0], [30, 18]], '#fff'); q.poly([[120, 26], [130, 0], [106, 18]], '#fff'); }, { r: 5 });
    P.layer(['#3e3428', '#66584a', '#8a7a68', '#b8a68e'], (q) => q.ell(68, 52, 60, 46, '#fff'), { r: 22, rim: '#e8c890' });
    P.layer(['#2e261e', '#4e4236', '#6e5e4e', '#8e7c68'], (q) => q.rect(20, 26, 96, 12, '#fff'), { r: 5 });
    P.layer(['#342a20', '#5a4a3c', '#7a6a58', '#9e8c76'], (q) => q.rect(30, 68, 76, 30, '#fff'), { r: 8 });
    P.rect(30, 68, 76, 5, '#1a120c');
    for (let x = 34; x < 102; x += 10) P.layer(M.bone, (q) => q.rect(x, 72, 7, 9, '#fff'), { r: 3 });
    P.ell(68, 48, 19, 14, '#100806');
    P.layer(M.ember, (q) => q.circ(68, 48, 11.5, '#fff'), { r: 8, spec: true });
    P.circ(68, 48, f ? 5.5 : 4.2, '#fff6c0').circ(65, 45, 1.6, '#ffffff');
    P.line(40, 8, 52, 24, '#5fe3d6', 2).line(96, 8, 84, 24, '#5fe3d6', 2).line(56, 14, 80, 14, '#5fe3d6', 2).line(64, 20, 72, 20, '#5fe3d6', 1.5);
    P.line(16, 50, 28, 70, '#2a2018', 2).line(118, 46, 106, 66, '#2a2018', 2).line(58, 92, 62, 102, '#2a2018', 2);
    for (const [x, y] of [[24, 58], [108, 62], [82, 90], [44, 88]]) P.rect(x, y, 3, 2, '#c8955a');
    return P.out();
  }
  function fist(f) {
    const P = new Painter(54, 46);
    P.layer(['#3e3428', '#66584a', '#8a7a68', '#b8a68e'], (q) => { q.rect(4, 8, 46, 30, '#fff'); q.rect(0, 18, 9, 16, '#fff'); }, { r: 8, rim: '#e8c890' });
    for (let x = 14; x < 50; x += 10) P.line(x, 8, x, 24, '#2a2018', 1.5);
    P.line(16, 32, 38, 32, f ? '#ffb02e' : '#5fe3d6', 2);
    return P.out();
  }
  S.boss.musgo = [musgo(0), musgo(1)];
  S.boss.nyxara = [nyxara(0), nyxara(1)];
  S.boss.kharun = [kharun(0), kharun(1)];
  S.boss.fist = [fist(0), fist(1)];

  // ================================================================ WEAPONS (pointing right; grip = hand point)
  const WD = {
    tronco: [38, 16, [4, 8], (P) => {
      P.layer(M.wood, (q) => q.rect(0, 6, 14, 4, '#fff'), { r: 2 });
      P.layer(M.bark, (q) => q.poly([[11, 4], [33, 1], [37, 8], [33, 15], [11, 12]], '#fff'), { r: 4, rim: '#a87a4a' });
      P.layer(['#8a6a40', '#b8905a', '#e0c08a', '#f4dcae'], (q) => q.ell(34.5, 8, 3, 6.5, '#fff'), { r: 3 });
      P.ring(34.5, 8, 3.5, '#7a5230', 1).circ(34.5, 8, 1, '#7a5230');
      P.circ(20, 9, 1.6, '#1a0e08').circ(27, 5, 1.2, '#1a0e08');
      P.layer(M.leaf, (q) => { q.ell(24, 1.5, 2.5, 1.5, '#fff'); q.ell(28, 2, 2, 1.3, '#fff'); }, { r: 2 });
    }],
    arco_lunar: [16, 36, [11, 18], (P) => {
      P.layer(M.white, (q) => q.stroke([[2, 1], [8, 4], [12, 12], [13, 18], [12, 24], [8, 32], [2, 35]], 2, 3, '#fff'), { r: 2 });
      P.line(2, 1, 2, 35, '#cfe8ff');
      P.layer(M.blue, (q) => q.rect(10, 15, 5, 7, '#fff'), { r: 2 });
      P.circ(8, 4, 1.4, '#5fe3d6').circ(8, 32, 1.4, '#5fe3d6');
    }],
    penas: [26, 12, [3, 6], (P) => {
      P.layer(M.dark, (q) => q.rect(0, 5, 7, 3, '#fff'), { r: 2 });
      P.rect(5, 4, 2, 5, '#d04040');
      P.layer(M.blue, (q) => q.poly([[7, 6], [14, 1], [26, 6], [14, 11]], '#fff'), { r: 3, rim: '#cfe2ff' });
      P.line(8, 6, 25, 6, '#e4f0ff');
    }],
    lanca: [50, 14, [14, 7], (P) => {
      P.layer(M.wood, (q) => q.rect(0, 6, 34, 3, '#fff'), { r: 2 });
      P.layer(M.gold, (q) => q.rect(32, 3, 4, 9, '#fff'), { r: 2 });
      P.layer(M.steel, (q) => q.poly([[36, 3], [44, 4], [50, 7.5], [44, 11], [36, 12]], '#fff'), { r: 3, rim: '#ffffff' });
      P.line(37, 7, 48, 7, '#ffffff');
      P.line(40, 1, 42, 4, '#ffe066').line(42, 4, 40, 6, '#ffe066').line(40, 13, 42, 10, '#ffe066');
    }],
    espada_bronze: [32, 12, [3, 6], (P) => {
      P.layer(M.leather, (q) => q.rect(0, 5, 6, 3, '#fff'), { r: 2 });
      P.layer(M.gold, (q) => q.rect(5, 1, 3, 11, '#fff'), { r: 2 });
      P.layer(['#8a5a20', '#c8862e', '#eab25a', '#fff0c0'], (q) => q.poly([[8, 3], [28, 4], [32, 6.5], [28, 9], [8, 10]], '#fff'), { r: 3 });
      P.line(9, 5, 29, 6, '#fff6d0');
    }],
    funda: [22, 14, [3, 7], (P) => {
      P.layer(M.wood, (q) => { q.rect(0, 6, 10, 3, '#fff'); q.stroke([[9, 7], [14, 3], [20, 1]], 3, 2, '#fff'); q.stroke([[9, 8], [14, 11], [20, 13]], 3, 2, '#fff'); }, { r: 2 });
      P.line(20, 1, 17, 7, '#c86a5a').line(17, 7, 20, 13, '#c86a5a').circ(17, 7, 1.5, '#8a8a92');
    }],
    machado: [34, 24, [5, 12], (P) => {
      P.layer(M.wood, (q) => q.rect(0, 10, 32, 4, '#fff'), { r: 2 });
      P.layer(M.stone, (q) => { q.poly([[22, 10], [30, 0], [34, 2], [32, 10]], '#fff'); q.poly([[22, 14], [30, 24], [34, 22], [32, 14]], '#fff'); }, { r: 4, rim: '#e8e8f4' });
      P.layer(M.leather, (q) => q.rect(24, 9, 6, 6, '#fff'), { r: 2 });
    }],
    besta: [32, 20, [7, 10], (P) => {
      P.layer(M.wood, (q) => q.poly([[0, 8], [26, 8], [26, 12], [6, 13], [0, 12]], '#fff'), { r: 3 });
      P.layer(M.dsteel, (q) => q.rect(16, 7, 14, 4, '#fff'), { r: 2 });
      P.layer(M.wood, (q) => q.stroke([[24, 0], [27, 6], [27, 14], [24, 20]], 2.4, 2.4, '#fff'), { r: 2 });
      P.line(24, 0, 20, 10, '#e0e0e0').line(20, 10, 24, 20, '#e0e0e0');
    }],
    cajado_brasa: [40, 14, [9, 7], (P) => {
      P.layer(M.wood, (q) => q.rect(0, 5, 30, 4, '#fff'), { r: 2 });
      P.layer(M.dark, (q) => { q.poly([[28, 2], [32, 6], [28, 12]], '#fff'); }, { r: 2 });
      P.layer(M.fire, (q) => q.circ(34, 7, 5.5, '#fff'), { r: 4 });
      P.circ(35, 6, 2, '#fff2a0');
    }],
    cajado_gelo: [40, 16, [9, 8], (P) => {
      P.layer(['#6a7890', '#a8b4c8', '#d8e0ec', '#ffffff'], (q) => q.rect(0, 6, 30, 4, '#fff'), { r: 2 });
      P.layer(M.crystal, (q) => q.poly([[30, 8], [35, 0], [40, 8], [35, 16]], '#fff'), { r: 4 });
      P.line(35, 2, 35, 14, '#ffffff');
    }],
    martelo: [34, 20, [5, 10], (P) => {
      P.layer(M.wood, (q) => q.rect(0, 8, 22, 4, '#fff'), { r: 2 });
      P.layer(['#1a1218', '#2e2430', '#4a3a48', '#6a5a68'], (q) => q.rect(18, 0, 16, 20, '#fff'), { r: 6 });
      P.line(22, 4, 26, 10, '#ff8a3a').line(26, 10, 24, 16, '#ff8a3a').line(29, 3, 31, 9, '#ffb03a');
    }],
    katana: [44, 10, [4, 5], (P) => {
      P.layer(M.dark, (q) => q.rect(0, 3, 9, 4, '#fff'), { r: 2 });
      for (let x = 1; x < 9; x += 3) P.px(x, 4, '#c84a5a').px(x + 1, 5, '#c84a5a');
      P.layer(M.gold, (q) => q.ell(10, 5, 1.5, 4, '#fff'), { r: 2 });
      P.layer(['#4a8a9a', '#9fe6f0', '#d8fbff', '#ffffff'], (q) => q.poly([[12, 3], [38, 2], [44, 3], [38, 6], [12, 7]], '#fff'), { r: 2 });
      P.line(12, 3, 40, 2, '#ffffff');
    }],
    orbe: [28, 14, [5, 7], (P) => {
      P.layer(M.gold, (q) => q.rect(0, 5, 16, 3, '#fff'), { r: 2 });
      P.layer(M.violet, (q) => q.circ(21, 7, 6.2, '#fff'), { r: 5 });
      P.circ(19, 5, 1.8, '#ffffff');
    }],
    tomo: [22, 22, [6, 12], (P) => {
      P.layer(['#123a16', '#24602a', '#3a8a3e', '#6ab860'], (q) => q.rect(1, 2, 19, 18, '#fff'), { r: 5 });
      P.rect(2, 19, 18, 2, '#efe2c0');
      P.layer(M.gold, (q) => { q.ell(10, 10, 3, 5, '#fff'); }, { r: 2 });
      P.line(10, 5, 10, 15, '#3a8a3e');
      P.line(2, 1, 6, 4, '#7ed05a', 1.5).line(19, 18, 21, 22, '#7ed05a', 1.5);
    }],
    mosquete: [48, 14, [12, 8], (P) => {
      P.layer(M.wood, (q) => q.poly([[0, 4], [16, 6], [18, 12], [0, 12]], '#fff'), { r: 3 });
      P.layer(M.dsteel, (q) => q.rect(14, 3, 34, 4, '#fff'), { r: 2 });
      P.layer(M.gold, (q) => q.rect(14, 7, 20, 3, '#fff'), { r: 2 });
      for (const x of [22, 30, 38]) P.rect(x, 1, 2, 2, '#5fe3d6');
    }],
    bacamarte: [40, 18, [12, 9], (P) => {
      P.layer(['#1e1430', '#3a2a50', '#5a4474', '#7a6498'], (q) => q.poly([[0, 6], [16, 7], [18, 14], [0, 14]], '#fff'), { r: 3 });
      P.layer(M.dark, (q) => q.poly([[14, 6], [30, 6], [30, 12], [14, 12]], '#fff'), { r: 2 });
      P.layer(M.pink, (q) => q.poly([[28, 3], [40, 0], [40, 18], [28, 15]], '#fff'), { r: 4 });
      P.line(33, 3, 35, 14, '#ffffff');
    }],
  };
  for (const k in WD) { const [w, h, grip, fn] = WD[k]; const P = new Painter(w, h); fn(P); S.wp[k] = P.out(); S.wp[k].grip = [grip[0] + 1, grip[1] + 1]; }

  // ================================================================ EQUIPMENT ICONS (24x24)
  const QD = {
    coracao: (P) => { P.layer(M.red, (q) => { q.circ(7.5, 8.5, 6, '#fff'); q.circ(16.5, 8.5, 6, '#fff'); q.poly([[1.6, 10], [12, 22], [22.4, 10]], '#fff'); }, { r: 6 }); P.layer(M.gold, (q) => q.poly([[12, 8], [14, 12], [12, 16], [10, 12]], '#fff'), { r: 2 }); },
    casco: (P) => { P.layer(['#2a3a1e', '#4a6a30', '#6a8e44', '#a8c878'], (q) => q.ell(12, 13, 11, 9, '#fff'), { r: 7 }); P.line(12, 4, 12, 22, '#24301a', 1.5).line(2, 14, 22, 14, '#24301a', 1.5).line(5, 7, 19, 20, '#24301a').line(19, 7, 5, 20, '#24301a'); },
    botas: (P) => { P.layer(M.leather, (q) => { q.rect(6, 2, 8, 16, '#fff'); q.rect(6, 15, 15, 6, '#fff'); }, { r: 5 }); P.rect(6, 20, 15, 2, '#24140a').rect(6, 6, 8, 2, '#e8c050'); P.layer(M.red, (q) => q.poly([[14, 3], [20, 1], [16, 8]], '#fff'), { r: 2 }); },
    garra: (P) => { P.layer(M.dark, (q) => q.rect(2, 17, 20, 5, '#fff'), { r: 2 }); for (let i = 0; i < 3; i++) P.layer(M.bone, (q) => q.stroke([[4 + i * 6, 18], [6 + i * 6, 10], [4 + i * 6, 2]], 4, 1, '#fff'), { r: 2 }); },
    luva: (P) => { P.layer(M.steel, (q) => { q.rect(4, 6, 16, 13, '#fff'); q.ell(12, 6, 8, 3, '#fff'); }, { r: 6 }); for (const x of [8, 12, 16]) P.line(x, 4, x, 12, '#3a4256'); P.layer(M.leather, (q) => q.rect(6, 19, 12, 4, '#fff'), { r: 2 }); },
    aljava: (P) => { for (const x of [8, 12, 16]) { P.line(x, 0, x, 9, '#e8e0c8'); P.poly([[x - 2, 0], [x + 2, 0], [x, 3]], '#d04040'); } P.layer(M.leather, (q) => q.poly([[6, 8], [18, 8], [17, 23], [7, 23]], '#fff'), { r: 4 }); P.rect(6, 12, 12, 2, '#e8c050'); },
    ampulheta: (P) => { P.layer(M.gold, (q) => { q.rect(4, 0, 16, 3, '#fff'); q.rect(4, 21, 16, 3, '#fff'); }, { r: 2 }); P.layer(['#6a90b0', '#a8d0ec', '#dcf0ff', '#ffffff'], (q) => { q.poly([[6, 3], [18, 3], [12, 12]], '#fff'); q.poly([[6, 21], [18, 21], [12, 12]], '#fff'); }, { r: 4 }); P.layer(M.sand, (q) => q.poly([[8, 21], [16, 21], [12, 15]], '#fff'), { r: 2 }); P.line(14, 5, 10, 18, '#ffffff'); },
    tambor: (P) => { P.layer(M.red, (q) => q.rect(3, 7, 18, 12, '#fff'), { r: 6 }); P.layer(M.cloth, (q) => q.ell(12, 7, 9, 3.5, '#fff'), { r: 3 }); P.line(3, 9, 21, 17, '#e8c050').line(3, 17, 21, 9, '#e8c050'); P.line(4, 0, 9, 6, '#8a5a34', 2).line(20, 0, 15, 6, '#8a5a34', 2); },
    moeda: (P) => { P.layer(M.gold, (q) => q.circ(12, 12, 11, '#fff'), { r: 8 }); P.ring(12, 12, 8, '#b8862a', 1.2); P.layer(M.green, (q) => { q.circ(9.5, 10, 2.2, '#fff'); q.circ(14.5, 10, 2.2, '#fff'); q.circ(12, 14.5, 2.2, '#fff'); }, { r: 2 }); },
    olho_cristal: (P) => { P.layer(M.crystal, (q) => q.poly([[12, 0], [23, 12], [12, 24], [1, 12]], '#fff'), { r: 7 }); P.ell(12, 12, 6, 4, '#ffffff').circ(12, 12, 2.8, '#173040').px(11, 11, '#ffffff'); },
    amuleto_brasa: (P) => { P.line(2, 0, 12, 10, '#c9a040', 1.5).line(22, 0, 12, 10, '#c9a040', 1.5); P.layer(M.gold, (q) => q.circ(12, 15, 7.5, '#fff'), { r: 5 }); P.layer(M.fire, (q) => q.circ(12, 15, 5, '#fff'), { r: 4 }); },
    cristal_gelo: (P) => { P.layer(M.crystal, (q) => q.poly([[12, 0], [18, 8], [16, 23], [8, 23], [6, 8]], '#fff'), { r: 6 }); P.line(12, 2, 12, 21, '#e0fbff'); },
    chifre_trovao: (P) => { P.layer(M.bone, (q) => q.stroke([[3, 22], [5, 12], [10, 5], [18, 1]], 6, 2, '#fff'), { r: 4 }); P.stroke([[16, 8], [12, 14], [18, 14], [13, 22]], 2, 2, '#ffe066'); },
    cacto: (P) => { P.layer(M.green, (q) => q.ell(12, 13, 9, 10.5, '#fff'), { r: 7 }); P.line(12, 4, 12, 22, '#1d4a2c'); for (const [x, y] of [[3, 8], [21, 9], [4, 18], [20, 18], [12, 1], [8, 12], [16, 14]]) P.rect(x, y, 2, 2, '#fff3c8'); },
    lanterna: (P) => { P.layer(M.dwood, (q) => { q.rect(10, 0, 4, 3, '#fff'); q.rect(4, 3, 16, 3, '#fff'); q.rect(4, 20, 16, 3, '#fff'); q.rect(4, 3, 2, 20, '#fff'); q.rect(18, 3, 2, 20, '#fff'); }, { r: 2 }); P.rect(6, 6, 12, 14, '#0e2030'); P.layer(M.crystal, (q) => q.ell(12, 14, 4, 5, '#fff'), { r: 3 }); },
    anel_vamp: (P) => { P.layer(M.steel, (q) => { q.ring(12, 14, 9, '#fff', 3.5); }, { r: 3 }); P.layer(M.red, (q) => q.circ(12, 5, 4.5, '#fff'), { r: 4 }); },
    fenix: (P) => { P.layer(M.fire, (q) => q.poly([[2, 23], [8, 11], [18, 1], [22, 4], [15, 16]], '#fff'), { r: 5 }); P.layer(['#c86a10', '#ffb030', '#ffe080', '#ffffff'], (q) => q.poly([[6, 18], [12, 10], [18, 4], [14, 14]], '#fff'), { r: 3 }); P.line(2, 23, 15, 10, '#7a1a0a'); },
    capa: (P) => { P.layer(M.purple, (q) => q.poly([[6, 2], [18, 2], [23, 23], [12, 19], [1, 23]], '#fff'), { r: 7 }); P.layer(M.gold, (q) => q.rect(7, 1, 10, 3, '#fff'), { r: 2 }); },
    ima: (P) => { P.layer(M.red, (q) => { q.ring(12, 11, 10, '#fff', 6); }, { r: 4 }); P.x.clearRect(0, 12, 24, 12); P.layer(M.red, (q) => { q.rect(2, 11, 6, 6, '#fff'); q.rect(16, 11, 6, 6, '#fff'); }, { r: 3 }); P.layer(M.steel, (q) => { q.rect(2, 17, 6, 5, '#fff'); q.rect(16, 17, 6, 5, '#fff'); }, { r: 2 }); },
    orvalho: (P) => { P.layer(M.cloth, (q) => q.rect(9, 0, 6, 5, '#fff'), { r: 2 }); P.layer(['#6a90b0', '#b8d8f0', '#e4f4ff', '#ffffff'], (q) => q.circ(12, 15, 8.5, '#fff'), { r: 6 }); P.layer(M.pink, (q) => q.ell(12, 17, 6.5, 5, '#fff'), { r: 4 }); },
  };
  for (const k in QD) { const P = new Painter(24, 24); QD[k](P); S.eq[k] = P.out(); }

  // ================================================================ ABILITY ICONS (ink brush: white strokes on a black disc)
  const ink = '#f4efe6';
  const AB = {
    forma: (P) => { P.poly([[5, 26], [9, 14], [17, 10], [26, 13], [27, 17], [20, 18], [17, 26]], ink); P.stroke([[12, 12], [8, 6], [5, 3]], 3, 1, ink); P.stroke([[16, 10], [15, 5], [16, 2]], 2.6, 1, ink); P.x.clearRect(18, 12, 3, 2); },
    rugido: (P) => { P.stroke([[6, 12], [8, 16], [6, 20]], 4, 4, ink); for (const r of [7, 12, 17]) { const pts = []; for (let a = -0.9; a <= 0.9; a += 0.15) pts.push([6 + Math.cos(a) * r, 16 + Math.sin(a) * r]); P.stroke(pts, 2.6, 1, ink); } },
    investida: (P) => { P.poly([[14, 6], [28, 16], [14, 26], [18, 16]], ink); P.stroke([[2, 12], [14, 15]], 1, 3, ink); P.stroke([[4, 20], [15, 17]], 1, 3, ink); P.stroke([[1, 16], [16, 16]], 1, 4, ink); },
    pancada: (P) => { P.stroke([[19, 3], [17, 18]], 6, 4, ink); P.stroke([[3, 26], [29, 26]], 2, 2, ink); P.stroke([[17, 22], [12, 29]], 2, 1, ink); P.stroke([[17, 22], [23, 29]], 2, 1, ink); P.stroke([[8, 20], [4, 16]], 2, 1, ink); P.stroke([[26, 20], [29, 16]], 2, 1, ink); },
    chuva: (P) => { for (const [x, y] of [[8, 3], [16, 8], [24, 2]]) { P.stroke([[x, y], [x, y + 14]], 1.4, 1.4, ink); P.poly([[x - 3, y + 13], [x + 3, y + 13], [x, y + 19]], ink); } P.stroke([[3, 28], [29, 28]], 2, 2, ink); },
    espirito: (P) => { const pts = []; for (let t = 0; t < 4.5; t += 0.2) pts.push([16 + Math.cos(t * 1.6) * (2 + t * 2.2), 15 + Math.sin(t * 1.6) * (2 + t * 2.2)]); P.stroke(pts, 4, 1, ink); P.circ(16, 15, 3, ink); },
    passo: (P) => { P.poly([[20, 4], [27, 12], [20, 22], [14, 13]], ink); P.stroke([[2, 18], [13, 15]], 1, 3, ink); P.stroke([[4, 25], [15, 20]], 1, 3, ink); P.px(6, 6, ink).px(9, 9, ink).rect(25, 25, 2, 2, ink); },
    raizes: (P) => { P.stroke([[16, 30], [16, 14], [10, 6], [7, 2]], 4, 1, ink); P.stroke([[16, 18], [24, 10], [27, 4]], 3, 1, ink); P.stroke([[16, 24], [7, 20], [3, 14]], 3, 1, ink); P.stroke([[16, 24], [26, 22], [29, 17]], 2.5, 1, ink); },
    tempestade: (P) => { for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; P.stroke([[16 + Math.cos(a) * 5, 16 + Math.sin(a) * 5], [16 + Math.cos(a + 0.4) * 13, 16 + Math.sin(a + 0.4) * 13]], 3, 1, ink); } P.circ(16, 16, 3, ink); },
    mergulho: (P) => { P.poly([[2, 6], [16, 13], [30, 6], [16, 28]], ink); P.x.clearRect(14, 13, 4, 3); P.stroke([[16, 0], [16, 8]], 1, 3, ink); },
    rajada: (P) => { P.stroke([[2, 8], [20, 8], [25, 5], [22, 2]], 3, 1, ink); P.stroke([[2, 16], [28, 16]], 3.4, 1, ink); P.stroke([[2, 24], [18, 24], [23, 27], [20, 30]], 3, 1, ink); },
    olho: (P) => { P.stroke([[2, 16], [9, 9], [16, 7], [23, 9], [30, 16]], 3, 3, ink); P.stroke([[2, 16], [9, 22], [16, 24], [23, 22], [30, 16]], 3, 3, ink); P.circ(16, 16, 5, ink); P.circ(16, 16, 2, '#000'); },
    galope: (P) => { P.ring(18, 13, 10, ink, 5); P.x.clearRect(8, 15, 20, 17); P.rect(8, 13, 5, 7, ink).rect(23, 13, 5, 7, ink); P.stroke([[1, 24], [12, 24]], 1, 3, ink); P.stroke([[3, 29], [18, 29]], 1, 3, ink); },
    coice: (P) => { P.stroke([[10, 3], [12, 16]], 8, 7, ink); P.poly([[4, 16], [20, 16], [21, 23], [3, 23]], ink); for (const [x, y] of [[24, 8], [27, 15], [24, 22]]) P.stroke([[x, y], [x + 5, y]], 2.4, 1, ink); },
    relincho: (P) => { P.poly([[5, 30], [8, 14], [15, 5], [25, 6], [27, 11], [24, 16], [16, 15], [17, 30]], ink); P.poly([[8, 12], [10, 3], [14, 6]], ink); P.x.clearRect(20, 9, 2, 2); P.stroke([[28, 2], [31, 0]], 2, 1, ink); P.stroke([[29, 18], [31, 21]], 2, 1, ink); },
    ferradura: (P) => { P.ring(16, 13, 11, ink, 5); P.x.clearRect(5, 15, 22, 17); P.rect(5, 13, 6, 9, ink).rect(21, 13, 6, 9, ink); P.stroke([[18, 4], [13, 13], [19, 13], [14, 22]], 2.2, 2.2, '#000'); },
  };
  for (const k in AB) {
    const P = new Painter(36, 36), r = N.makeRng(k.length * 31 + 7);
    for (let a = 0; a < 6.3; a += 0.05) { const rr = 16.4 + (r() - 0.5) * 1.6; P.line(18, 18, 18 + Math.cos(a) * rr, 18 + Math.sin(a) * rr, '#0c0a0e'); }
    P.circ(18, 18, 15.5, '#0c0a0e');
    for (let i = 0; i < 5; i++) { const a = r() * 6.3; P.circ(18 + Math.cos(a) * 17.5, 18 + Math.sin(a) * 17.5, 0.6 + r(), '#0c0a0e'); }
    const g = new Painter(32, 32); AB[k](g);
    P.x.drawImage(g.c, 2, 2);
    S.ab[k] = P.done();
  }

  // ================================================================ PROJECTILES
  const PR = S.proj;
  const bullet = (c, r) => { const s = Math.ceil(r * 4) + 4, P = new Painter(s, s); P.circ(s / 2, s / 2, r * 2 + 0.5, mix(c, '#000000', 0.25)).circ(s / 2, s / 2, r * 2 - 0.6, c).circ(s / 2 - r * 0.4, s / 2 - r * 0.4, r * 0.9, mix(c, '#ffffff', 0.75)); return P.out('#16060e'); };
  N.bulletSprite = (() => { const cache = {}; return (c, r) => cache[c + r] || (cache[c + r] = bullet(c, r)); })();
  const pj = (w, h, fn, out) => { const P = new Painter(w, h); fn(P); return out === false ? P.done() : P.out(out); };
  PR.arrow = pj(24, 6, (P) => { P.line(0, 3, 18, 3, '#e8e0c8', 1.5); P.poly([[16, 0], [24, 3], [16, 6]], '#cfe8ff'); P.poly([[0, 0], [4, 3], [0, 6]], '#5fe3d6'); });
  PR.feather = pj(20, 8, (P) => { P.layer(M.blue, (q) => q.ell(10, 4, 10, 3.2, '#fff'), { r: 2 }); P.line(1, 4, 19, 4, '#e4f0ff'); });
  PR.bolt = pj(18, 6, (P) => { P.line(0, 3, 13, 3, '#c8a060', 1.5); P.poly([[12, 0], [18, 3], [12, 6]], '#d8d8e0'); });
  PR.stone = pj(10, 10, (P) => P.layer(M.stone, (q) => q.circ(5, 5, 4.6, '#fff'), { r: 3 }));
  PR.fireball = pj(18, 18, (P) => { P.circ(9, 9, 8.6, '#e0561a').circ(10, 9, 6, '#ffa030').circ(11, 9, 3, '#fff2a0'); }, '#5a1006');
  PR.ice = pj(18, 10, (P) => { P.layer(M.crystal, (q) => q.poly([[0, 5], [10, 0], [18, 5], [10, 10]], '#fff'), { r: 3 }); P.line(2, 5, 16, 5, '#ffffff'); }, '#0a3050');
  PR.orb = pj(16, 16, (P) => { P.circ(8, 8, 7.6, '#9a4ad8').circ(8, 8, 5, '#d8a0ff').circ(7, 7, 2.4, '#ffffff'); }, '#2a0a40');
  PR.rune = pj(28, 10, (P) => { P.rect(0, 3, 20, 4, '#34b8a6').poly([[18, 0], [28, 5], [18, 10]], '#a8fff0').rect(0, 4, 24, 2, '#ffffff'); }, '#0a3a3a');
  PR.shard = pj(14, 8, (P) => { P.layer(M.pink, (q) => q.poly([[0, 4], [8, 0], [14, 4], [8, 8]], '#fff'), { r: 2 }); }, '#3a0a50');
  PR.seedP = pj(10, 10, (P) => P.layer(M.gold, (q) => q.circ(5, 5, 4.4, '#fff'), { r: 3 }), '#3a2a10');
  PR.leaf = pj(16, 8, (P) => { P.layer(M.leaf, (q) => q.ell(8, 4, 8, 3.4, '#fff'), { r: 2 }); P.line(0, 4, 15, 4, '#a8e078'); }, '#0a2a0a');
  PR.wave = pj(16, 32, (P) => { P.ring(-4, 16, 18, '#9ff6ff', 4); P.ring(-4, 16, 14, '#e8ffff', 2); }, false);

  // ================================================================ MISC: pickups, NPCs, camp props (2.5D)
  const X = S.misc;
  const sp = (w, h, fn) => { const P = new Painter(w, h); fn(P); return P.out(); };
  X.coin = [0, 1, 2].map((f) => sp(12, 12, (P) => { const w = [5.5, 3.6, 1.6][f]; P.layer(M.gold, (q) => q.ell(6, 6, w, 5.5, '#fff'), { r: 3 }); if (f < 2) P.rect(6 - w * 0.3, 3, 1, 6, '#b8862a'); }));
  X.crystal = [0, 1].map((f) => sp(12, 18, (P) => { P.layer(M.teal, (q) => q.poly([[6, 0], [12, 7], [6, 18], [0, 7]], '#fff'), { r: 4 }); P.line(6, 1, 6, 16, f ? '#ffffff' : '#a8fff0'); }));
  X.potion = sp(16, 20, (P) => { P.layer(M.cloth, (q) => q.rect(6, 0, 4, 4, '#fff'), { r: 2 }); P.layer(['#6a90b0', '#b8d8f0', '#e4f4ff', '#ffffff'], (q) => q.circ(8, 12, 7.5, '#fff'), { r: 5 }); P.layer(M.red, (q) => q.ell(8, 14, 6, 4.6, '#fff'), { r: 3 }); P.rect(4, 4, 8, 2, '#d8c8a8'); });
  X.chest = [0, 1].map((open) => sp(32, 26, (P) => {
    P.layer(M.wood, (q) => q.rect(2, 11, 28, 14, '#fff'), { r: 5 });
    P.layer(M.gold, (q) => { q.rect(2, 11, 28, 2, '#fff'); q.rect(14, 11, 4, 8, '#fff'); q.rect(2, 23, 28, 2, '#fff'); }, { r: 2 });
    if (open) { P.rect(4, 4, 24, 8, '#1a0e08'); P.layer(M.gold, (q) => q.ell(16, 10, 10, 3, '#fff'), { r: 2 }); }
    else { P.layer(M.wood, (q) => { q.ell(16, 9, 14, 6, '#fff'); q.rect(2, 9, 28, 4, '#fff'); }, { r: 4 }); P.layer(M.gold, (q) => q.rect(14, 5, 4, 7, '#fff'), { r: 2 }); }
  }));
  X.gift = [0, 1].map((open) => sp(40, 34, (P) => {
    P.layer(M.purple, (q) => q.rect(2, 13, 36, 20, '#fff'), { r: 7, rim: '#d8a8ff' });
    P.layer(M.gold, (q) => { q.rect(2, 13, 36, 3, '#fff'); q.rect(18, 13, 4, 20, '#fff'); }, { r: 2 });
    if (open) { P.rect(4, 4, 32, 10, '#120820'); P.layer(['#c8a020', '#ffe066', '#fff6b0', '#ffffff'], (q) => q.ell(20, 12, 14, 4, '#fff'), { r: 2 }); }
    else { P.layer(M.violet, (q) => q.rect(0, 6, 40, 8, '#fff'), { r: 3 }); P.layer(M.gold, (q) => { q.rect(18, 6, 4, 8, '#fff'); q.ell(14, 4, 6, 4, '#fff'); q.ell(26, 4, 6, 4, '#fff'); }, { r: 3 }); }
  }));
  // Pedestal in the Otherworld Legends style: blue-grey stone, gold posts and two candles.
  X.pedestal = sp(32, 24, (P) => {
    P.layer(['#2a3448', '#46546e', '#6a7a96', '#9aaac4'], (q) => q.poly([[3, 8], [29, 8], [27, 24], [5, 24]], '#fff'), { r: 6 });
    P.layer(['#3a4660', '#5a6a88', '#8696b4', '#c0ccdf'], (q) => q.rect(1, 6, 30, 5, '#fff'), { r: 3 });
    P.layer(M.gold, (q) => { q.rect(0, 0, 3, 11, '#fff'); q.rect(29, 0, 3, 11, '#fff'); q.rect(1, 10, 30, 2, '#fff'); }, { r: 2 });
  });
  X.altar = sp(48, 32, (P) => {
    P.layer(['#2a2a40', '#46466a', '#6a6a94', '#9a9ac4'], (q) => q.poly([[4, 30], [44, 30], [38, 12], [10, 12]], '#fff'), { r: 8 });
    P.layer(['#3a3a58', '#5a5a86', '#8a8ab4', '#c4c4e8'], (q) => q.rect(8, 8, 32, 6, '#fff'), { r: 3 });
    P.rect(12, 18, 24, 2, '#c66bff').rect(16, 22, 16, 1, '#c66bff');
  });
  X.merchant = [0, 1].map((f) => sp(44, 46, (P) => {
    P.layer(M.leather, (q) => q.rect(2, 10, 16, 26, '#fff'), { r: 6 });
    P.layer(M.red, (q) => q.rect(4, 4, 12, 7, '#fff'), { r: 3 });
    P.rect(2, 16, 16, 2, '#e8c050');
    P.layer(M.skinG, (q) => { q.ell(26, 31 + f * 0.5, 14, 12, '#fff'); q.ell(16, 44, 4, 2, '#fff'); q.ell(34, 44, 4, 2, '#fff'); }, { r: 8 });
    P.layer(M.cloth, (q) => q.ell(26, 34, 9, 7, '#fff'), { r: 4 });
    P.layer(M.skinG, (q) => { q.ell(26, 16 - f * 0.5, 13, 9, '#fff'); q.circ(19, 9 - f * 0.5, 4.5, '#fff'); q.circ(33, 9 - f * 0.5, 4.5, '#fff'); }, { r: 7, rim: '#c8ff9a' });
    P.circ(19, 9, 2.4, '#120a10').circ(33, 9, 2.4, '#120a10').px(18, 8, '#fff').px(32, 8, '#fff');
    P.line(19, 20, 33, 20, '#1a3a14', 1.5);
    P.layer(M.purple, (q) => q.poly([[13, 6], [26, -1], [39, 6]], '#fff'), { r: 3 });
  }));
  X.dummy = [0, 1].map((f) => sp(30, 46, (P) => {
    const t = f ? 2 : 0;
    P.layer(M.wood, (q) => { q.rect(13, 22, 4, 22, '#fff'); q.rect(6, 41, 18, 4, '#fff'); }, { r: 2 });
    P.layer(M.wood, (q) => q.rect(1 + t, 16, 28, 4, '#fff'), { r: 2 });
    P.layer(['#8a6a2a', '#c8a050', '#e8cc7a', '#fff0b0'], (q) => q.ell(15 + t * 0.5, 23, 8, 9, '#fff'), { r: 5 });
    P.rect(8, 21, 15, 2, '#7a4a2a');
    P.layer(['#9a7a3a', '#d8b868', '#f0d890', '#fff6c8'], (q) => q.circ(15 + t, 9, 7.5, '#fff'), { r: 5 });
    P.rect(12 + t, 8, 2, 2, '#3a2a10').rect(18 + t, 8, 2, 2, '#3a2a10').line(12 + t, 12, 19 + t, 12, '#c86a5a');
  }));
  X.bookshelf = sp(52, 58, (P) => {
    P.layer(M.dwood, (q) => q.rect(0, 0, 52, 58, '#fff'), { r: 10 });
    P.rect(4, 4, 44, 50, '#140c08');
    const cols = [M.red, M.blue, M.gold, M.green, M.purple, M.cloth];
    for (const y of [5, 22, 39]) { P.layer(M.wood, (q) => q.rect(3, y + 13, 46, 3, '#fff'), { r: 2 }); for (let x = 6; x < 46; x += 5) P.layer(cols[(x + y) % cols.length], (q) => q.rect(x, y + (x % 3), 4, 13 - (x % 3), '#fff'), { r: 2 }); }
    P.circ(26, 1, 3, '#5fe3d6');
  });
  X.trophy = sp(34, 54, (P) => {
    P.layer(['#2a2a40', '#46466a', '#6a6a94', '#9a9ac4'], (q) => { q.rect(4, 40, 26, 14, '#fff'); q.rect(8, 36, 18, 5, '#fff'); }, { r: 5 });
    P.layer(M.gold, (q) => { q.rect(15, 24, 4, 13, '#fff'); q.ell(17, 14, 11, 11, '#fff'); q.ring(4, 14, 5, '#fff', 2.5); q.ring(30, 14, 5, '#fff', 2.5); q.rect(10, 34, 14, 3, '#fff'); }, { r: 7, spec: true });
    P.ell(17, 9, 7, 3, '#fff8d0');
  });
  X.starAltar = sp(54, 44, (P) => {
    P.layer(['#22223a', '#3a3a5e', '#5a5a86', '#8a8ab4'], (q) => q.poly([[4, 43], [50, 43], [42, 20], [12, 20]], '#fff'), { r: 9 });
    P.layer(['#3a3a58', '#5a5a86', '#8a8ab4', '#c4c4e8'], (q) => q.rect(10, 16, 34, 6, '#fff'), { r: 3 });
    P.circ(27, 8, 8, '#120a24');
    P.layer(M.teal, (q) => q.circ(27, 8, 5.6, '#fff'), { r: 4 });
    for (const [x, y] of [[12, 32], [26, 28], [40, 33], [20, 38]]) P.rect(x, y, 2, 2, '#ffe066');
    P.line(12, 32, 26, 28, '#8a8acc').line(26, 28, 40, 33, '#8a8acc').line(20, 38, 26, 28, '#8a8acc');
  });
  X.grimoire = sp(40, 46, (P) => {
    P.layer(M.dwood, (q) => { q.rect(18, 20, 4, 24, '#fff'); q.rect(10, 41, 20, 5, '#fff'); }, { r: 3 });
    P.layer(M.red, (q) => q.poly([[1, 18], [20, 12], [39, 18], [39, 24], [20, 18], [1, 24]], '#fff'), { r: 4 });
    P.layer(M.cloth, (q) => { q.poly([[3, 16], [20, 10], [20, 16], [3, 20]], '#fff'); q.poly([[37, 16], [20, 10], [20, 16], [37, 20]], '#fff'); }, { r: 3 });
    for (let i = 0; i < 4; i++) P.line(6 + i * 3, 16 - i, 16, 13 - i * 0.6, '#8a7a5a');
    P.layer(M.fire, (q) => q.circ(20, 4, 3.6, '#fff'), { r: 3 });
  });
  // Training gate: a torii-like arch with a dark passage.
  X.gate = sp(76, 64, (P) => {
    P.rect(12, 18, 52, 46, '#08060c');
    P.layer(M.red, (q) => { q.rect(10, 14, 8, 50, '#fff'); q.rect(58, 14, 8, 50, '#fff'); }, { r: 5, rim: '#ff9a7a' });
    P.layer(M.red, (q) => q.rect(4, 16, 68, 6, '#fff'), { r: 3 });
    P.layer(M.dark, (q) => q.poly([[0, 4], [76, 4], [72, 12], [4, 12]], '#fff'), { r: 3 });
    P.layer(M.gold, (q) => q.rect(32, 9, 12, 10, '#fff'), { r: 2 });
    P.layer(M.stone, (q) => { q.rect(8, 58, 12, 6, '#fff'); q.rect(56, 58, 12, 6, '#fff'); }, { r: 2 });
  });
  X.campfire = sp(38, 18, (P) => {
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; P.layer(M.stone, (q) => q.circ(19 + Math.cos(a) * 15, 11 + Math.sin(a) * 5, 3.2, '#fff'), { r: 2 }); }
    P.layer(M.wood, (q) => { q.line(6, 14, 32, 6, '#fff', 3); q.line(6, 6, 32, 14, '#fff', 3); }, { r: 2 });
  });
  X.banner = (c) => sp(22, 50, (P) => {
    P.layer(M.dwood, (q) => q.rect(9, 0, 4, 50, '#fff'), { r: 2 });
    P.layer(M.gold, (q) => q.rect(0, 4, 22, 3, '#fff'), { r: 2 });
    P.layer([mix(c, '#000000', 0.55), mix(c, '#000000', 0.25), c, mix(c, '#ffffff', 0.45)], (q) => q.poly([[1, 7], [21, 7], [21, 36], [11, 31], [1, 36]], '#fff'), { r: 6 });
    P.circ(11, 18, 4.5, '#ffe9b0').circ(11, 18, 2.4, mix(c, '#000000', 0.2));
  });
  X.tent = sp(70, 52, (P) => {
    P.layer(M.red, (q) => q.poly([[35, 0], [70, 50], [0, 50]], '#fff'), { r: 12, rim: '#ff9a7a' });
    P.poly([[35, 18], [44, 50], [26, 50]], '#120808');
    P.layer(M.gold, (q) => q.rect(33, 0, 4, 6, '#fff'), { r: 2 });
  });
  X.skull = sp(16, 14, (P) => { P.layer(M.bone, (q) => { q.circ(8, 6, 6.5, '#fff'); q.rect(4, 9, 8, 4, '#fff'); }, { r: 4 }); P.rect(4, 6, 3, 2, '#2a1a10').rect(9, 6, 3, 2, '#2a1a10'); });
  X.rock = sp(24, 22, (P) => { P.layer(M.sand, (q) => q.ell(12, 12, 11, 9.5, '#fff'), { r: 7 }); P.rect(16, 14, 2, 2, '#6a4426'); });
  X.horseshoe = sp(24, 24, (P) => { P.layer(M.steel, (q) => { q.ring(12, 11, 11, '#fff', 4.6); }, { r: 3 }); P.x.clearRect(3, 14, 18, 10); P.layer(M.steel, (q) => { q.rect(1, 12, 6, 9, '#fff'); q.rect(17, 12, 6, 9, '#fff'); }, { r: 2 }); for (const [x, y] of [[4, 8], [20, 8], [12, 2]]) P.px(x, y, '#3a4256'); });
  X.ent = [0, 1].map((f) => sp(30, 36, (P) => { P.layer(M.bark, (q) => q.rect(11, 16, 8, 20, '#fff'), { r: 3 }); P.layer(M.leaf, (q) => { q.poly([[2, 20], [15, 0 + f], [28, 20]], '#fff'); q.circ(8, 15, 6, '#fff'); q.circ(22, 15, 6, '#fff'); }, { r: 7, rim: '#a8e078' }); P.rect(12, 22, 2, 2, '#ffe066').rect(17, 22, 2, 2, '#ffe066'); }));
  X.wisp = sp(16, 16, (P) => { P.circ(8, 8, 7.4, '#2aa898').circ(8, 8, 5, '#5fe3d6').circ(8, 8, 2.6, '#f0fffa'); });
  X.spirit = sp(16, 16, (P) => { P.circ(8, 8, 7, '#4a7ad8').circ(8, 8, 4.6, '#9ad8ff').circ(8, 8, 2.2, '#ffffff'); });
  X.bone = sp(18, 10, (P) => P.layer(M.bone, (q) => { q.rect(4, 4, 10, 2, '#fff'); q.circ(3, 3, 2.6, '#fff'); q.circ(3, 7, 2.6, '#fff'); q.circ(15, 3, 2.6, '#fff'); q.circ(15, 7, 2.6, '#fff'); }, { r: 3 }));
  X.shard = sp(16, 24, (P) => { P.layer(['#4a3a8a', '#8a7ad8', '#c8b8ff', '#ffffff'], (q) => q.poly([[8, 0], [16, 10], [8, 24], [0, 10]], '#fff'), { r: 4 }); P.line(8, 2, 8, 22, '#ffffff'); });
  X.seed = PR.seedP;
  X.horse = [0, 1].map((f) => sp(48, 32, (P) => {
    const c = ['#3a6a9a', '#7ab0e0', '#bfe8ff', '#ffffff'];
    P.layer(c, (q) => { q.ell(20, 16, 14, 7, '#fff'); q.ell(36, 9, 5.5, 5, '#fff'); q.poly([[38, 7], [48, 9], [47, 13], [37, 13]], '#fff'); q.poly([[30, 7], [33, 0], [36, 7]], '#fff'); for (const [x, y] of (f ? [[8, 21], [16, 22], [24, 21], [30, 22]] : [[10, 22], [14, 21], [26, 22], [28, 21]])) q.rect(x, y, 4, 10, '#fff'); q.poly([[6, 12], [0, 6], [0, 18]], '#fff'); }, { r: 5 });
    P.px(40, 9, '#1a3a5a');
  }));
  X.paperLantern = sp(20, 54, (P) => {
    P.layer(M.dwood, (q) => { q.rect(8, 18, 4, 36, '#fff'); q.rect(3, 50, 14, 4, '#fff'); }, { r: 2 });
    P.layer(M.dark, (q) => q.rect(4, 2, 12, 3, '#fff'), { r: 2 });
    P.layer(['#c86a20', '#f0a040', '#ffd890', '#fff6d8'], (q) => q.ell(10, 11, 8, 7.5, '#fff'), { r: 5 });
    P.line(3, 9, 17, 9, '#8a4a20').line(3, 13, 17, 13, '#8a4a20');
    P.layer(M.dark, (q) => q.rect(5, 17, 10, 2, '#fff'), { r: 2 });
  });

  // ================================================================ 2.5D SCENERY PROPS (per theme)
  const D = S.deco;
  D.tree = sp(76, 96, (P) => {
    P.layer(M.bark, (q) => { q.poly([[32, 96], [30, 50], [36, 30], [44, 30], [46, 50], [46, 96]], '#fff'); q.poly([[30, 96], [22, 92], [32, 86]], '#fff'); q.poly([[46, 96], [54, 92], [44, 86]], '#fff'); }, { r: 6, rim: '#8a6a4a' });
    P.layer(['#0e2414', '#183a20', '#24542c', '#3e7a3a'], (q) => { q.circ(22, 38, 18, '#fff'); q.circ(54, 38, 18, '#fff'); q.circ(38, 22, 22, '#fff'); q.circ(38, 46, 16, '#fff'); }, { r: 14, rim: '#5aa050' });
    P.layer(['#183a20', '#24542c', '#3a7a36', '#6ab050'], (q) => { q.circ(30, 16, 10, '#fff'); q.circ(48, 22, 9, '#fff'); q.circ(20, 30, 8, '#fff'); }, { r: 8 });
  });
  D.bush = sp(34, 30, (P) => { P.layer(M.leaf, (q) => { q.circ(10, 18, 9, '#fff'); q.circ(24, 18, 9, '#fff'); q.circ(17, 11, 10, '#fff'); q.rect(4, 18, 26, 10, '#fff'); }, { r: 8, rim: '#7cc060' }); for (const [x, y, c] of [[9, 12, '#ff8ad0'], [22, 9, '#ffe066'], [26, 18, '#ffffff']]) P.rect(x, y, 2, 2, c); });
  D.rock = sp(32, 26, (P) => { P.layer(M.mossStone, (q) => { q.ell(16, 16, 15, 10, '#fff'); q.ell(12, 10, 8, 7, '#fff'); }, { r: 8, rim: '#c0d0b0' }); P.layer(M.moss, (q) => q.ell(12, 6, 6, 3, '#fff'), { r: 2 }); });
  D.stump = sp(30, 26, (P) => { P.layer(M.bark, (q) => q.rect(4, 8, 22, 17, '#fff'), { r: 6 }); P.layer(['#8a6a40', '#b8905a', '#e0c08a', '#f4dcae'], (q) => q.ell(15, 8, 11, 5, '#fff'), { r: 3 }); P.ring(15, 8, 6, '#8a6440').ring(15, 8, 3, '#8a6440'); P.layer(M.red, (q) => q.ell(24, 20, 3, 2, '#fff'), { r: 2 }); });
  D.stoneLantern = sp(26, 52, (P) => {
    P.layer(M.mossStone, (q) => { q.rect(6, 44, 14, 8, '#fff'); q.rect(10, 26, 6, 20, '#fff'); q.rect(4, 22, 18, 5, '#fff'); }, { r: 4 });
    P.layer(M.mossStone, (q) => q.rect(6, 12, 14, 11, '#fff'), { r: 4 });
    P.rect(9, 14, 8, 7, '#2a1a08').rect(10, 15, 6, 5, '#ffcf6a').rect(11, 16, 4, 3, '#fff6d0');
    P.layer(M.mossStone, (q) => q.poly([[0, 12], [13, 2], [26, 12]], '#fff'), { r: 4 });
    P.layer(M.moss, (q) => q.ell(10, 6, 5, 2.5, '#fff'), { r: 2 });
  });
  D.mushrooms = sp(22, 16, (P) => { for (const [x, y, s] of [[6, 10, 4], [15, 8, 5], [19, 12, 3]]) { P.layer(M.cloth, (q) => q.rect(x - 1, y, 2.5, s, '#fff'), { r: 2 }); P.layer(M.red, (q) => q.ell(x, y, s, s * 0.6, '#fff'), { r: 2 }); } });
  D.crystals = sp(34, 44, (P) => {
    P.layer(M.violet, (q) => { q.poly([[6, 44], [9, 18], [14, 44]], '#fff'); q.poly([[22, 44], [27, 10], [31, 44]], '#fff'); }, { r: 4, rim: '#ffffff' });
    P.layer(['#4a2a8a', '#8a5ad8', '#c8a0ff', '#ffffff'], (q) => q.poly([[12, 44], [17, 0], [24, 44]], '#fff'), { r: 5, rim: '#ffffff' });
    P.line(17, 3, 18, 40, '#f0e0ff');
  });
  D.pillar = sp(30, 62, (P) => {
    P.layer(['#1e1830', '#3a3054', '#584a7a', '#8a7aac'], (q) => { q.rect(3, 54, 24, 8, '#fff'); q.rect(6, 10, 18, 46, '#fff'); }, { r: 6, rim: '#a08ad0' });
    P.layer(['#1e1830', '#3a3054', '#584a7a', '#8a7aac'], (q) => q.poly([[4, 12], [26, 12], [24, 4], [16, 8], [10, 2], [6, 6]], '#fff'), { r: 3 });
    for (const x of [10, 15, 20]) P.line(x, 14, x, 52, '#241c38');
    P.rect(6, 30, 18, 2, '#d0a840');
  });
  D.statue = sp(32, 62, (P) => {
    P.layer(['#1e1830', '#3a3054', '#584a7a', '#8a7aac'], (q) => q.rect(2, 48, 28, 14, '#fff'), { r: 5 });
    P.layer(['#3a3a4a', '#6a6a7e', '#9a9aae', '#d0d0e0'], (q) => { q.poly([[8, 48], [10, 22], [22, 22], [24, 48]], '#fff'); q.circ(16, 15, 6, '#fff'); q.poly([[10, 24], [2, 34], [6, 36], [12, 30]], '#fff'); q.poly([[22, 24], [30, 14], [27, 12], [20, 22]], '#fff'); }, { r: 7, rim: '#c8b8ff' });
    P.rect(13, 14, 2, 1, '#d05aff').rect(18, 14, 2, 1, '#d05aff');
  });
  D.candles = sp(18, 40, (P) => {
    P.layer(M.gold, (q) => { q.rect(8, 10, 2, 30, '#fff'); q.rect(3, 36, 12, 4, '#fff'); q.rect(1, 12, 16, 2, '#fff'); }, { r: 2 });
    P.layer(M.cloth, (q) => { q.rect(1, 5, 3, 7, '#fff'); q.rect(14, 5, 3, 7, '#fff'); q.rect(7, 2, 4, 9, '#fff'); }, { r: 2 });
  });
  D.mirror = sp(26, 40, (P) => {
    P.layer(M.gold, (q) => q.ell(13, 18, 12, 17, '#fff'), { r: 6 });
    P.layer(['#2a1648', '#46287a', '#6a44b0', '#c8b0ff'], (q) => q.ell(13, 18, 9, 14, '#fff'), { r: 8 });
    P.line(7, 8, 18, 28, '#ffffff').line(13, 18, 20, 12, '#e8d8ff');
    P.layer(M.dark, (q) => q.rect(9, 34, 8, 6, '#fff'), { r: 2 });
  });
  D.rockPile = sp(34, 28, (P) => { P.layer(M.sand, (q) => { q.ell(10, 18, 9, 8, '#fff'); q.ell(24, 19, 9, 7, '#fff'); q.ell(17, 10, 8, 7, '#fff'); }, { r: 7, rim: '#ffd8a0' }); });
  D.rib = sp(44, 56, (P) => { P.layer(M.bone, (q) => { q.stroke([[6, 56], [4, 30], [12, 10], [26, 2], [38, 4]], 7, 3, '#fff'); q.stroke([[32, 56], [34, 36], [40, 22]], 5, 2, '#fff'); }, { r: 5, rim: '#ffffff' }); });
  D.sandPillar = sp(30, 60, (P) => {
    P.layer(['#5a3a20', '#8a6038', '#b88a54', '#e0b47a'], (q) => { q.rect(2, 52, 26, 8, '#fff'); q.poly([[6, 54], [6, 12], [12, 8], [18, 14], [24, 10], [24, 54]], '#fff'); }, { r: 7, rim: '#ffd8a0' });
    for (const y of [22, 34, 46]) P.line(6, y, 24, y + 1, '#5a3a20');
    P.rect(10, 28, 10, 2, '#5fe3d6');
  });
  D.brazier = sp(24, 40, (P) => {
    P.layer(M.dsteel, (q) => { q.rect(10, 16, 4, 22, '#fff'); q.rect(4, 36, 16, 4, '#fff'); q.poly([[0, 8], [24, 8], [20, 18], [4, 18]], '#fff'); }, { r: 3 });
    P.layer(M.fire, (q) => { q.poly([[3, 9], [8, 0], [12, 4], [16, -1], [21, 9]], '#fff'); }, { r: 3 });
  });
  D.crate = sp(30, 30, (P) => {
    P.layer(M.wood, (q) => q.rect(1, 9, 28, 20, '#fff'), { r: 6 });
    P.layer(['#5e3a22', '#86562e', '#a87240', '#d0a060'], (q) => q.poly([[1, 9], [6, 1], [29, 1], [29, 9]], '#fff'), { r: 3 });
    P.line(1, 9, 29, 29, '#3a2216').line(29, 9, 1, 29, '#3a2216').rect(1, 18, 28, 1, '#3a2216');
  });
  D.torch = sp(14, 30, (P) => { P.layer(M.dwood, (q) => q.rect(5, 10, 4, 20, '#fff'), { r: 2 }); P.layer(M.dsteel, (q) => q.rect(2, 8, 10, 4, '#fff'), { r: 2 }); P.layer(M.fire, (q) => q.poly([[2, 8], [7, -1], [12, 8]], '#fff'), { r: 3 }); });
  D.window = sp(24, 34, (P) => {
    P.layer(M.dark, (q) => q.rect(0, 4, 24, 30, '#fff'), { r: 3 });
    P.ell(12, 8, 12, 8, '#120a1a');
    const cols = ['#d05aff', '#5fe3d6', '#ff6a8a', '#ffd166'];
    for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) P.rect(3 + x * 6, 6 + y * 9, 5, 8, cols[(x + y) % 4]);
    P.ell(12, 6, 9, 4, '#d05aff');
    P.line(12, 2, 12, 33, '#2a1a3a').line(1, 15, 23, 15, '#2a1a3a').line(1, 24, 23, 24, '#2a1a3a');
  });
  D.shoji = sp(32, 40, (P) => {
    P.layer(M.dwood, (q) => q.rect(0, 0, 32, 40, '#fff'), { r: 4 });
    P.rect(3, 3, 26, 34, '#f0dcae');
    for (let x = 3; x < 29; x += 6.5) P.rect(Math.round(x), 3, 1, 34, '#5a3824');
    for (let y = 3; y < 37; y += 8.5) P.rect(3, Math.round(y), 26, 1, '#5a3824');
  });
  D.wallBanner = (c) => sp(18, 38, (P) => {
    P.layer(M.gold, (q) => q.rect(0, 0, 18, 3, '#fff'), { r: 2 });
    P.layer([mix(c, '#000000', 0.55), mix(c, '#000000', 0.25), c, mix(c, '#ffffff', 0.4)], (q) => q.poly([[1, 3], [17, 3], [17, 34], [9, 29], [1, 34]], '#fff'), { r: 5 });
    P.layer(M.gold, (q) => q.circ(9, 15, 4.4, '#fff'), { r: 3 });
  });
  D.table = sp(42, 26, (P) => {
    P.layer(M.dwood, (q) => { q.rect(3, 12, 4, 14, '#fff'); q.rect(35, 12, 4, 14, '#fff'); }, { r: 2 });
    P.layer(M.wood, (q) => q.rect(0, 6, 42, 8, '#fff'), { r: 4 });
    P.layer(['#3a2216', '#5e3a22', '#86562e', '#b8844a'], (q) => q.poly([[0, 6], [5, 0], [37, 0], [42, 6]], '#fff'), { r: 3 });
    P.layer(['#c86a20', '#f0a040', '#ffd890', '#fff6d8'], (q) => q.rect(10, 0, 6, 4, '#fff'), { r: 2 });
  });
  D.barrel = sp(24, 30, (P) => { P.layer(M.wood, (q) => q.ell(12, 16, 11, 13.5, '#fff'), { r: 7 }); P.rect(1, 9, 22, 2, '#3a2a2a').rect(1, 21, 22, 2, '#3a2a2a'); P.layer(['#5e3a22', '#86562e', '#a87240', '#d0a060'], (q) => q.ell(12, 4, 9, 3, '#fff'), { r: 2 }); });

  // ================================================================ SURFACES: tileable floors, wall faces/caps, void
  const TEX = 256;
  function tnoise(seed, cells) {
    const r = N.makeRng(seed), g = []; for (let i = 0; i < cells * cells; i++) g.push(r());
    const at = (i, j) => g[(((j % cells) + cells) % cells) * cells + (((i % cells) + cells) % cells)];
    return (x, y) => { const fx = x / TEX * cells, fy = y / TEX * cells, x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0, sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty); return N.lerp(N.lerp(at(x0, y0), at(x0 + 1, y0), sx), N.lerp(at(x0, y0 + 1), at(x0 + 1, y0 + 1), sx), sy); };
  }
  const fbm = (seed) => { const a = tnoise(seed, 4), b = tnoise(seed + 1, 8), c = tnoise(seed + 2, 16), d = tnoise(seed + 3, 32); return (x, y) => a(x, y) * 0.45 + b(x, y) * 0.28 + c(x, y) * 0.17 + d(x, y) * 0.1; };
  function texture(w, h, fn) { const c = cv(w, h), x = c.getContext('2d'), id = x.createImageData(w, h); for (let y = 0; y < h; y++) for (let xx = 0; xx < w; xx++) { const [r, g, b] = fn(xx, y); const i = (y * w + xx) * 4; id.data[i] = r; id.data[i + 1] = g; id.data[i + 2] = b; id.data[i + 3] = 255; } x.putImageData(id, 0, 0); return c; }
  const quant = (pal) => { const P = pal.map(hexRgb); return (v, x, y) => P[Math.max(0, Math.min(P.length - 1, Math.floor(v * P.length + bayer(x, y) * 0.9)))]; };

  function floorGrass(seed) {
    const n = fbm(seed), m = fbm(seed + 9), q = quant(['#152c1a', '#1b3820', '#224626', '#2b552c', '#356432', '#427538', '#548a40']);
    const c = texture(TEX, TEX, (x, y) => { let v = n(x, y) * 0.85 + m(x * 3 % TEX, y * 3 % TEX) * 0.15; v = (v - 0.25) * 1.5; return q(N.clamp(v, 0, 0.999), x, y); });
    const ctx = c.getContext('2d'), r = N.makeRng(seed + 3);
    for (let i = 0; i < 900; i++) { const x = r() * TEX, y = r() * TEX, v = n(x, y); ctx.fillStyle = v > 0.5 ? '#6a9e48' : '#3e6e34'; ctx.fillRect(Math.floor(x), Math.floor(y), 1, 2 + Math.floor(r() * 2)); }
    return c;
  }
  function floorStone(seed, pal, size, grout, crack) {
    const n = fbm(seed), q = quant(pal), r = N.makeRng(seed + 5);
    const shade = []; for (let i = 0; i < 256; i++) shade.push(r() * 0.3 - 0.15);
    const c = texture(TEX, TEX, (x, y) => {
      const row = Math.floor(y / size), ox = row % 2 ? size / 2 : 0, col = Math.floor(((x + ox) % TEX) / size), lx = (x + ox) % size, ly = y % size;
      if (lx < 1 || ly < 1) return hexRgb(grout);
      let v = 0.5 + shade[(row * 17 + col) & 255] + (n(x, y) - 0.5) * 0.7;
      if (lx < 3 || ly < 3) v += 0.18; if (lx > size - 3 || ly > size - 3) v -= 0.2;
      return q(N.clamp(v, 0, 0.999), x, y);
    });
    const x = c.getContext('2d'); x.strokeStyle = crack; x.lineWidth = 1;
    for (let i = 0; i < 26; i++) { let px = r() * TEX, py = r() * TEX; x.beginPath(); x.moveTo(px, py); for (let k = 0; k < 4; k++) { px += (r() - 0.5) * 18; py += (r() - 0.5) * 18; x.lineTo(px, py); } x.stroke(); }
    return c;
  }
  function floorSand(seed) {
    const n = fbm(seed), q = quant(['#5e3a22', '#74482a', '#8a5a32', '#9e6a3a', '#b07a44', '#c08a50', '#cc9a5e']), r = N.makeRng(seed + 2);
    const c = texture(TEX, TEX, (x, y) => q(N.clamp((n(x, y) - 0.2) * 1.5 + Math.sin((x + y * 0.3) * 0.12) * 0.04, 0, 0.999), x, y));
    const x = c.getContext('2d'); x.strokeStyle = '#4a2c18'; x.lineWidth = 1;
    for (let i = 0; i < 40; i++) { let px = r() * TEX, py = r() * TEX; x.beginPath(); x.moveTo(px, py); for (let k = 0; k < 5; k++) { px += (r() - 0.5) * 22; py += (r() - 0.5) * 14; x.lineTo(px, py); } x.stroke(); }
    for (let i = 0; i < 160; i++) { x.fillStyle = r() < 0.5 ? '#5a3a24' : '#d8aa6a'; x.fillRect(Math.floor(r() * TEX), Math.floor(r() * TEX), 2, 1); }
    return c;
  }
  function floorWood(seed) {
    const n = tnoise(seed, 64), r = N.makeRng(seed), q = quant(['#3e2418', '#4a2c1e', '#583624', '#66402a', '#744a30']), H = 16;
    const rowsCut = []; for (let row = 0; row < TEX / H; row++) { const cuts = []; let p = r() * 60; while (p < TEX) { cuts.push(Math.floor(p)); p += 50 + r() * 70; } rowsCut.push({ cuts, tone: [] }); }
    return texture(TEX, TEX, (x, y) => {
      const row = Math.floor(y / H), ly = y % H, rc = rowsCut[row];
      let k = 0; for (const c of rc.cuts) if (x >= c) k++;
      if (rc.cuts.includes(x) || ly === 0) return hexRgb('#1e120a');
      if (rc.tone[k] === undefined) rc.tone[k] = r() * 0.3 - 0.15;
      let v = 0.5 + rc.tone[k] + (n(x * 0.25 + row * 31, ly * 4) - 0.5) * 0.5 + Math.sin(x * 0.35 + row * 7 + n(x, y) * 6) * 0.06;
      if (ly === 1) v += 0.15; if (ly === H - 1) v -= 0.15;
      return q(N.clamp(v, 0, 0.999), x, y);
    });
  }
  // Wall faces are 32x48 (one tile wide, WH tall); caps are 32x32.
  function wallFace(kind, v, seed) {
    const P = new Painter(32, 48), r = N.makeRng(seed + v * 13);
    if (kind === 'overworld') {
      P.rect(0, 0, 32, 48, '#0e1e12');
      P.layer(M.bark, (q) => { q.rect(4 + v * 3, 14, 7, 34, '#fff'); q.rect(20 - v * 2, 20, 6, 28, '#fff'); }, { r: 3 });
      P.layer(['#0a1a0e', '#12301a', '#1c4424', '#2c5e30'], (q) => { for (let i = 0; i < 7; i++) q.circ(r() * 32, r() * 22, 6 + r() * 5, '#fff'); q.rect(0, 0, 32, 12, '#fff'); }, { r: 6 });
      for (let i = 0; i < 10; i++) P.rect(Math.floor(r() * 32), 40 + Math.floor(r() * 8), 1, 3, '#2a4a24');
    } else if (kind === 'reverso') {
      P.layer(['#120c1e', '#1e1630', '#2a2042', '#3a2e58'], (q) => q.rect(0, 0, 32, 48, '#fff'), { r: 3 });
      for (let y = 6; y < 48; y += 7) { P.rect(0, y, 32, 1, '#0c0814'); const o = (y / 7) % 2 ? 8 : 0; for (let x = o; x < 32; x += 16) P.rect(x, y - 6, 1, 6, '#0c0814'); }
      P.rect(0, 2, 32, 2, '#c09a40');
      if (v === 3) P.x.drawImage(D.window, 4, 10);
    } else if (kind === 'wasteland') {
      const bands = ['#4a2c18', '#5e3a20', '#744a28', '#5a3820', '#6e4424'];
      for (let y = 0; y < 48; y++) { const b = bands[Math.floor((y + Math.sin(y * 0.4 + v) * 2) / 7) % bands.length]; P.rect(0, y, 32, 1, b); }
      for (let i = 0; i < 6; i++) P.line(r() * 32, r() * 48, r() * 32, r() * 48, '#2e1a0e');
      P.layer(M.sand, (q) => q.rect(0, 0, 32, 5, '#fff'), { r: 2 });
    } else if (kind === 'lobby') {
      P.layer(M.dwood, (q) => q.rect(0, 0, 32, 48, '#fff'), { r: 4 });
      if (v % 2) P.x.drawImage(D.shoji, 0, 4); else { P.rect(14, 0, 4, 48, '#22140c'); for (let y = 6; y < 48; y += 10) P.rect(0, y, 32, 1, '#22140c'); }
      P.rect(0, 0, 32, 3, '#120a06');
    } else {
      P.layer(['#1c1e28', '#2a2e3c', '#3a3f52', '#4e5468'], (q) => q.rect(0, 0, 32, 48, '#fff'), { r: 3 });
      for (let y = 8; y < 48; y += 8) { P.rect(0, y, 32, 1, '#12141c'); const o = (y / 8) % 2 ? 10 : 0; for (let x = o; x < 32; x += 20) P.rect(x, y - 7, 1, 7, '#12141c'); }
      P.rect(0, 0, 32, 3, '#4e5468');
    }
    const g = P.x.createLinearGradient(0, 0, 0, 48); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.45)');
    P.x.fillStyle = g; P.x.fillRect(0, 0, 32, 48);
    return P.c;
  }
  function wallCap(kind, seed) {
    const P = new Painter(32, 32), r = N.makeRng(seed);
    if (kind === 'overworld') { P.rect(0, 0, 32, 32, '#14301a'); P.layer(['#122a16', '#1c3e20', '#2a5a2c', '#4a8040'], (q) => { for (let i = 0; i < 9; i++) q.circ(r() * 32, r() * 32, 5 + r() * 5, '#fff'); }, { r: 6 }); }
    else if (kind === 'reverso') { P.layer(['#1a1228', '#2a2040', '#3a2e58', '#56467c'], (q) => q.rect(0, 0, 32, 32, '#fff'), { r: 4 }); P.rect(0, 30, 32, 2, '#c09a40'); }
    else if (kind === 'wasteland') { P.layer(['#6a4426', '#8a5a32', '#a87240', '#c89458'], (q) => q.rect(0, 0, 32, 32, '#fff'), { r: 4 }); for (let i = 0; i < 6; i++) P.rect(Math.floor(r() * 30), Math.floor(r() * 30), 3, 2, '#5a3820'); }
    else if (kind === 'lobby') { P.layer(['#1e1210', '#2e1c16', '#42281e', '#5a3828'], (q) => q.rect(0, 0, 32, 32, '#fff'), { r: 4 }); for (let y = 0; y < 32; y += 6) P.rect(0, y, 32, 1, '#140a08'); }
    else { P.layer(['#262a36', '#363b4c', '#4a5066', '#646c86'], (q) => q.rect(0, 0, 32, 32, '#fff'), { r: 4 }); P.rect(0, 0, 32, 1, '#7a84a0'); }
    return P.c;
  }
  function voidTex(kind, seed) {
    const n = fbm(seed), r = N.makeRng(seed);
    if (kind === 'overworld') {
      const q = quant(['#050c07', '#08120a', '#0c1a0f', '#112414', '#163018']);
      return texture(TEX, TEX, (x, y) => { const k = Math.sin(x * 0.11 + n(x, y) * 8) * Math.cos(y * 0.13 + n(y, x) * 8); return q(N.clamp(n(x, y) * 0.8 + k * 0.15, 0, 0.999), x, y); });
    }
    const base = { reverso: ['#06040c', '#0a0614', '#100a1e'], wasteland: ['#0c0604', '#140a06', '#1c0e08'], lobby: ['#060408', '#0a070c', '#0e0a10'], training: ['#06070a', '#0a0b10', '#0e1016'] }[kind];
    const q = quant(base), c = texture(TEX, TEX, (x, y) => q(N.clamp(n(x, y), 0, 0.999), x, y)), x = c.getContext('2d');
    if (kind === 'reverso') for (let i = 0; i < 90; i++) { x.fillStyle = r() < 0.7 ? '#3a2a6a' : '#d05aff'; x.fillRect(Math.floor(r() * TEX), Math.floor(r() * TEX), 1, 1); }
    return c;
  }
  // Floor decals (small, drawn by hash) and big room patches.
  function decals(kind) {
    const out = [], P = (w, h, fn) => { const p = new Painter(w, h); fn(p); out.push(fin(p.c)); };
    if (kind === 'overworld') {
      for (let k = 0; k < 3; k++) P(14, 10, (p) => { for (let i = 0; i < 5; i++) p.line(3 + i * 2, 10, 2 + i * 2.5 + (i % 2), 3 + (i % 3), i % 2 ? '#5e9a44' : '#78b452'); });
      P(10, 10, (p) => { p.circ(5, 5, 2.6, '#ffe066').circ(5, 5, 1, '#ff8a3a'); p.circ(2, 8, 1.2, '#ffffff'); });
      P(10, 10, (p) => { p.circ(5, 5, 2.4, '#ff8ad0').circ(5, 5, 0.9, '#ffe0f0'); });
      P(12, 8, (p) => p.layer(M.mossStone, (q) => q.ell(6, 4, 5, 3, '#fff'), { r: 2 }));
    } else if (kind === 'reverso') {
      P(16, 16, (p) => { p.ring(8, 8, 7, '#5a3a9a', 1).line(3, 8, 13, 8, '#7a4ac0').line(8, 3, 8, 13, '#7a4ac0'); });
      P(10, 12, (p) => p.layer(M.violet, (q) => q.poly([[5, 0], [9, 7], [5, 12], [1, 7]], '#fff'), { r: 2 }));
      P(14, 8, (p) => p.layer(['#3a2a5a', '#5a4a7a', '#7a6a9a', '#a090c0'], (q) => q.ell(7, 4, 6, 3, '#fff'), { r: 2 }));
    } else if (kind === 'wasteland') {
      P(16, 14, (p) => p.layer(M.bone, (q) => { q.circ(8, 6, 5.5, '#fff'); q.rect(5, 9, 6, 4, '#fff'); }, { r: 3 }));
      P(18, 8, (p) => p.layer(M.bone, (q) => q.stroke([[1, 6], [9, 3], [17, 2]], 2.6, 2, '#fff'), { r: 2 }));
      P(12, 8, (p) => p.layer(M.sand, (q) => q.ell(6, 4, 5, 3, '#fff'), { r: 2 }));
      P(10, 16, (p) => p.layer(M.green, (q) => { q.rect(4, 2, 3, 13, '#fff'); q.rect(0, 6, 3, 4, '#fff'); q.rect(7, 4, 3, 4, '#fff'); }, { r: 2 }));
    } else if (kind === 'lobby') {
      P(12, 6, (p) => p.rect(0, 2, 12, 2, '#2a180e'));
    } else {
      P(12, 8, (p) => p.layer(M.stone, (q) => q.ell(6, 4, 5, 3, '#fff'), { r: 2 }));
    }
    return out;
  }
  function patch(kind, seed) {
    const w = 96, h = 64, P = new Painter(w, h), id = P.x.createImageData(w, h), n = fbm(seed);
    const col = { overworld: ['#5a4a2e', '#6e5a36', '#4a3c26'], reverso: ['#3a1e5a', '#4a2a72', '#2a1442'], wasteland: ['#7a4a26', '#94602e', '#5a3418'], lobby: ['#5a1a22', '#7a2a2e', '#3e1018'], training: ['#3a3f52', '#464e62', '#2e3242'] }[kind].map(hexRgb);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const dx = (x - w / 2) / (w / 2), dy = (y - h / 2) / (h / 2), d = Math.sqrt(dx * dx + dy * dy) + (n(x * 2.6, y * 2.6) - 0.5) * 0.6;
      if (kind !== 'lobby' && d > 0.95 + bayer(x, y) * 0.15) continue;
      if (kind === 'lobby' && (x < 6 || y < 6 || x >= w - 6 || y >= h - 6)) continue;
      const k = n(x * 4, y * 4) > 0.55 ? 1 : n(x * 4 + 50, y * 4) < 0.35 ? 2 : 0, i = (y * w + x) * 4;
      id.data[i] = col[k][0]; id.data[i + 1] = col[k][1]; id.data[i + 2] = col[k][2]; id.data[i + 3] = kind === 'lobby' ? 255 : 210;
    }
    P.x.putImageData(id, 0, 0);
    if (kind === 'lobby') { P.x.strokeStyle = '#e8b84a'; P.x.lineWidth = 2; P.x.strokeRect(11, 11, w - 22, h - 22); }
    if (kind === 'reverso') { P.ring(w / 2, h / 2, 26, '#d05aff', 1); P.ring(w / 2, h / 2, 20, '#7a4ac0', 1); }
    return fin(P.c);
  }

  const THEMES = N.THEMES = {
    lobby: { void: '#060408', ambient: '#8c7c98', light: '#ffb060', floor: () => floorWood(11) },
    overworld: { void: '#050c07', ambient: '#7a88a6', light: '#ffcf7a', floor: () => floorGrass(21) },
    reverso: { void: '#06040c', ambient: '#6e5e90', light: '#d05aff', floor: () => floorStone(31, ['#140e22', '#1a1430', '#221a3c', '#2c224a', '#382c5a', '#46386c'], 32, '#0a0612', '#0c0816') },
    wasteland: { void: '#0c0604', ambient: '#a08070', light: '#ffa040', floor: () => floorSand(41) },
    training: { void: '#06070a', ambient: '#7e7e9a', light: '#ffb060', floor: () => floorStone(51, ['#1e222e', '#262a38', '#2e3444', '#3a4152', '#464e62', '#565f76'], 32, '#14161e', '#181a24') },
  };
  for (const k in THEMES) {
    const t = THEMES[k], seed = k.length * 101;
    S.tiles[k] = { floor: t.floor(), faces: [0, 1, 2, 3].map((v) => wallFace(k, v, seed)), cap: wallCap(k, seed + 5), void: voidTex(k, seed + 9), decals: decals(k), patches: [0, 1, 2].map((i) => patch(k, seed + i * 7)) };
  }
})();
