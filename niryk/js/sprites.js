// Niryk — pixel art. Every sprite is painted once at startup into small offscreen canvases with
// pixel maps (heroes, weapons) or pixel shapes (creatures, bosses, items), then auto-shaded and outlined.
'use strict';
(function () {
  const N = window.N;
  const S = N.S = { ch: {}, en: {}, boss: {}, wp: {}, eq: {}, ab: {}, misc: {}, tiles: {} };
  const OUT = '#170f1f';

  const cv = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  const hexRgb = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };

  class Painter {
    constructor(w, h) { this.w = w; this.h = h; this.c = cv(w, h); this.x = this.c.getContext('2d'); }
    px(x, y, c) { this.x.fillStyle = c; this.x.fillRect(Math.floor(x), Math.floor(y), 1, 1); return this; }
    rect(x, y, w, h, c) { this.x.fillStyle = c; this.x.fillRect(Math.floor(x), Math.floor(y), w, h); return this; }
    circ(cx, cy, r, c) { return this.ell(cx, cy, r, r, c); }
    ell(cx, cy, rx, ry, c) {
      this.x.fillStyle = c;
      for (let y = Math.floor(cy - ry - 1); y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - rx - 1); x <= Math.ceil(cx + rx); x++) {
        const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
        if (dx * dx + dy * dy <= 1) this.x.fillRect(x, y, 1, 1);
      }
      return this;
    }
    ring(cx, cy, r, c, t = 1) {
      this.x.fillStyle = c;
      for (let y = Math.floor(cy - r - 1); y <= Math.ceil(cy + r); y++) for (let x = Math.floor(cx - r - 1); x <= Math.ceil(cx + r); x++) {
        const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy); if (d <= r && d > r - t) this.x.fillRect(x, y, 1, 1);
      }
      return this;
    }
    line(x0, y0, x1, y1, c) {
      x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
      const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
      let err = dx + dy; this.x.fillStyle = c;
      for (;;) { this.x.fillRect(x0, y0, 1, 1); if (x0 === x1 && y0 === y1) break; const e2 = 2 * err; if (e2 >= dy) { err += dy; x0 += sx; } if (e2 <= dx) { err += dx; y0 += sy; } }
      return this;
    }
    poly(pts, c) {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const [x, y] of pts) { minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y); }
      this.x.fillStyle = c;
      for (let y = Math.floor(minY); y <= Math.ceil(maxY); y++) for (let x = Math.floor(minX); x <= Math.ceil(maxX); x++) {
        const px = x + 0.5, py = y + 0.5; let ins = false;
        for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
          const [xi, yi] = pts[i], [xj, yj] = pts[j];
          if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) ins = !ins;
        }
        if (ins) this.x.fillRect(x, y, 1, 1);
      }
      return this;
    }
    map(rows, pal, ox = 0, oy = 0) {
      rows.forEach((row, y) => { for (let x = 0; x < row.length; x++) { const ch = row[x]; if (ch !== '.' && ch !== ' ' && pal[ch]) { this.x.fillStyle = pal[ch]; this.x.fillRect(ox + x, oy + y, 1, 1); } } });
      return this;
    }
    // Volume: light the top/left rim, darken the bottom/right rim of the silhouette.
    shade(dark = 0.7, light = 0.22) {
      const id = this.x.getImageData(0, 0, this.w, this.h), d = id.data, src = new Uint8ClampedArray(d), w = this.w, h = this.h;
      const a = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : src[(y * w + x) * 4 + 3]);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4; if (!src[i + 3]) continue;
        if (!a(x, y + 1) || !a(x + 1, y)) { d[i] *= dark; d[i + 1] *= dark; d[i + 2] *= dark; }
        else if (!a(x, y - 1) || !a(x - 1, y)) { d[i] += (255 - d[i]) * light; d[i + 1] += (255 - d[i + 1]) * light; d[i + 2] += (255 - d[i + 2]) * light; }
      }
      this.x.putImageData(id, 0, 0); return this;
    }
    out(col = OUT) { return outline(this.c, col); }
  }
  N.Painter = Painter;

  function outline(src, col = OUT) {
    const w = src.width + 2, h = src.height + 2, c = cv(w, h), x = c.getContext('2d');
    const sd = src.getContext('2d').getImageData(0, 0, src.width, src.height).data, od = x.createImageData(w, h), o = od.data;
    const [r, g, b] = hexRgb(col);
    const al = (sx, sy) => (sx < 0 || sy < 0 || sx >= src.width || sy >= src.height ? 0 : sd[(sy * src.width + sx) * 4 + 3]);
    for (let y = 0; y < h; y++) for (let xx = 0; xx < w; xx++) {
      const sx = xx - 1, sy = y - 1, oi = (y * w + xx) * 4;
      if (al(sx, sy) > 40) { const si = (sy * src.width + sx) * 4; o[oi] = sd[si]; o[oi + 1] = sd[si + 1]; o[oi + 2] = sd[si + 2]; o[oi + 3] = 255; }
      else if (al(sx - 1, sy) > 40 || al(sx + 1, sy) > 40 || al(sx, sy - 1) > 40 || al(sx, sy + 1) > 40) { o[oi] = r; o[oi + 1] = g; o[oi + 2] = b; o[oi + 3] = 255; }
    }
    x.putImageData(od, 0, 0); return c;
  }
  N.outline = outline;
  const fromMap = (rows, pal, col) => { const w = Math.max(...rows.map((r) => r.length)); return new Painter(w, rows.length).map(rows, pal).out(col); };

  // Cached solid-colour silhouettes (hit flash, elite tint, shadows).
  const silCache = new Map();
  N.silhouette = (c, color = '#ffffff') => {
    let m = silCache.get(c); if (!m) { m = {}; silCache.set(c, m); }
    if (!m[color]) { const s = cv(c.width, c.height), x = s.getContext('2d'); x.drawImage(c, 0, 0); x.globalCompositeOperation = 'source-in'; x.fillStyle = color; x.fillRect(0, 0, s.width, s.height); m[color] = s; }
    return m[color];
  };

  // ================================================================ HEROES
  const HERO_MAPS = {
    emberian: {
      pal: { r: '#efe3c8', R: '#b39874', h: '#d8364a', H: '#8c1d36', i: '#ff7d7d', s: '#f7cfa8', S: '#dba07e', e: '#2b1631', w: '#ffffff', y: '#ffb21e', p: '#f39191', m: '#a2393f', c: '#3e9a6f', C: '#286a52', a: '#e6b53e', A: '#fff1a6', l: '#8d5733', L: '#5f3920', b: '#4a2b23', t: '#d8364a', T: '#f59a3c' },
      rows: [
        '......r........r....',
        '......rr......rr....',
        '.......RhhhhhhR.....',
        '......hhhhhhhhhh....',
        '.....hhhiihhhhhhh...',
        '.....hhhhhhhhhhhh...',
        '.....hhhHsssssHhh...',
        '.....hhsssssssssh...',
        '.....hsssewssewsh...',
        '.....hsssyyssyysh...',
        '.....hSpssssmspsh...',
        '.....HhSsssssSShH...',
        '......HHcccccccHH...',
        '.......scccCcccs....',
        '.....ttsaaaAaaas....',
        '...tttt.lllLlll.....',
        '.tttT...lLl.lLl.....',
        'tTT.....bb..bb......',
        '........bb..bb......',
      ],
    },
    sylvar: {
      pal: { h: '#e4ebf5', i: '#ffffff', H: '#a3adc8', E: '#f3d2b4', s: '#f3d2b4', S: '#d6a88c', e: '#173040', w: '#ffffff', y: '#43d6c6', p: '#f0a0a0', m: '#a04848', a: '#d9b65a', g: '#5fe3d6', A: '#fff3b0', c: '#3e7d3f', C: '#285429', v: '#86c75a', l: '#4a4f78', L: '#33365a', b: '#5b3b2a' },
      rows: [
        '....................',
        '....................',
        '........hhhhhh......',
        '......hhhhhhhhhh....',
        '.....hhhiihhhhhhh...',
        '.....haaaagaaaaah...',
        '...E.hhhHsssssHhh.E.',
        '...EEhhssssssssshEE.',
        '....EhsssewssewshE..',
        '.....hsssyyssyysh...',
        '.....hSpssssmspsh...',
        '.....hhSsssssSShh...',
        '.....hhCcvvvvvcChh..',
        '......hCsvvavvsCh...',
        '.......CaaaAaaaC....',
        '.......CllllLllC....',
        '........lll.lll.....',
        '........bb..bb......',
        '........bb..bb......',
      ],
    },
    kestrus: {
      pal: { f: '#4f7cc4', F: '#2c4a85', i: '#9cc8ff', q: '#f4ead2', e: '#1d1830', w: '#ffffff', y: '#ffd23a', k: '#ffb63a', K: '#d0781c', W: '#3a5d9c', V: '#cfe2ff', s: '#f4ead2', c: '#e7d6ac', C: '#bfa77a', a: '#d0463c', l: '#2e3a62', L: '#222a48', t: '#f0a63a' },
      rows: [
        '.........f..f.......',
        '........fF.fF.......',
        '.......fffffff......',
        '......fffffffff.....',
        '.....ffffffffffff...',
        '.....ffiiffffffff...',
        '.....fFqqqqqqqqFf...',
        '.....fqqqqqqqqqqf...',
        '.....fqqqewqqewqf...',
        '.....fqqqyyqqyyqf...',
        '.....fFqqqqqkkkFf...',
        '......FFqqqqqKkFF...',
        '....WWW.ccccccc.WWW.',
        '...WWWVscaaaaacsVWWW',
        '...WWV.scccCcccsVWW.',
        '....WV..lllLlll.VW..',
        '.....V..lll.lll.V...',
        '........tt..tt......',
        '.......ttt.ttt......',
      ],
    },
    haldor: {
      pal: { f: '#9a5530', F: '#6e3a1e', p: '#e89a8a', m: '#2e211e', M: '#1c1412', i: '#5a4038', s: '#e4ad80', S: '#c48a62', e: '#2a1a14', w: '#ffffff', y: '#b07a2a', o: '#8a3a32', c: '#aab6c6', v: '#2f62b8', a: '#e0b040', A: '#fff0a0', T: '#2e211e', b: '#2a2224' },
      rows: [
        '.......f.....f......',
        '.......fp...pf......',
        '......mffmmmffm.....',
        '.....mmmmmmmmmmm....',
        '.....mmmiimmmmmmm...',
        '.....mmmmmmmmmmmm...',
        '.....mmmMsssssMmm...',
        '.....mmsssssssssm...',
        '.....msssewssewsm...',
        '.....msssyyssyysm...',
        '.....mSpssssospsm...',
        '.....MmSsssssSSmM...',
        '......MMcvvvvvcMM...',
        '.......scvvavvcs....',
        '.....TTsaaaAaaas....',
        '....TTT.fffFfff.....',
        '...TTT..fFf.fFf.....',
        '....T...ff...ff.....',
        '........bb...bb.....',
      ],
    },
  };
  // Hand position (relative to the sprite's top-left, before the outline) where weapons are held.
  N.HAND = { x: 15, y: 13 };
  function heroFrames(def) {
    const rows = def.rows, last = rows.length - 1, mid = 11;
    const strip = (keepLeft) => rows.map((r, i) => (i === last ? r.split('').map((ch, x) => ((keepLeft ? x >= mid : x < mid) ? '.' : ch)).join('') : r));
    return [fromMap(rows, def.pal), fromMap(strip(false), def.pal), fromMap(strip(true), def.pal)];
  }
  for (const k in HERO_MAPS) S.ch[k] = heroFrames(HERO_MAPS[k]);

  // Emberian's dragon form: a quadruped dragon, three frames (stand, step, step).
  function dragon(step) {
    const P = new Painter(32, 23);
    const R = '#d8364a', D = '#a3243a', O = '#f59a3c', H = '#efe3c8';
    const ly = (i) => (step === 0 ? 0 : (i % 2 === (step === 1 ? 0 : 1) ? -1 : 0));
    // far legs
    P.rect(10, 15 + ly(1), 3, 5, D).rect(20, 15 + ly(3), 3, 5, D);
    // tail
    [[1, 8, 1.2], [2.5, 10.5, 1.6], [4.5, 12.5, 2], [7, 13.5, 2.6], [9.5, 13.5, 3]].forEach(([x, y, r]) => P.circ(x, y, r, R));
    P.poly([[0, 8], [1, 4], [3, 8]], O);
    // wing (behind)
    P.poly([[12, 11], [14, 2], [17, 4], [20, 2], [20, 10]], '#9c2238');
    P.line(14, 2, 15, 10, '#6a1428').line(20, 2, 19, 10, '#6a1428');
    // body
    P.ell(16, 13, 7.5, 4.6, R);
    P.ell(16, 15.6, 5.8, 2, O);
    // spikes along the back
    for (const sx of [10, 13, 16]) P.poly([[sx, 9.5], [sx + 1.5, 6.5], [sx + 3, 9.5]], O);
    // neck + head
    P.ell(22.5, 9.5, 2.8, 4, R);
    P.ell(25, 6.5, 4.2, 3.4, R);
    P.rect(27, 6, 4, 3, R).rect(27, 8, 4, 1, O);
    P.px(30, 6, '#5a1020');
    // horns
    P.line(23, 4, 20, 0, H).line(24, 4, 22, 1, H).line(26, 3, 25, 0, H);
    // eye + teeth
    P.rect(26, 5, 2, 2, '#2b1631').px(27, 5, '#ffd23a');
    P.px(28, 9, '#ffffff').px(30, 9, '#ffffff');
    // near legs with claws
    P.rect(12, 16 + ly(0), 3, 5, R).rect(22, 16 + ly(2), 3, 5, R);
    for (const lx of [12, 22]) P.rect(lx - 0, 21 + ly(lx === 12 ? 0 : 2), 4, 1, H);
    P.shade(0.75, 0.18);
    return P.out();
  }
  S.ch.dragon = [dragon(0), dragon(1), dragon(2)];

  // ================================================================ ENEMIES
  const E = {};
  E.gosmo = (f) => {
    const P = new Painter(15, 12), sq = f ? 0.8 : 0;
    P.ell(7.5, 7 + sq * 0.6, 6.5 + sq * 0.5, 4.8 - sq, '#5fcf4f');
    P.ell(5, 4.6 + sq, 2.2, 1.2, '#c4ff9e');
    P.rect(4, 6 + sq, 2, 2, '#173018').rect(9, 6 + sq, 2, 2, '#173018').px(4, 6 + sq, '#ffffff').px(9, 6 + sq, '#ffffff');
    P.rect(6, 9, 3, 1, '#2b5a26');
    return P.shade().out();
  };
  E.cogumelo = (f) => {
    const P = new Painter(15, 15), d = f ? 1 : 0;
    P.rect(4, 8, 7, 6, '#efe2c4').rect(4, 13, 2, 1, '#c8b896').rect(9, 13, 2, 1, '#c8b896');
    P.ell(7.5, 5 + d, 7, 4.6 - d * 0.5, '#d8463c');
    P.ell(7.5, 8 + d, 5, 1, '#f6e0b8');
    P.circ(4, 3.5 + d, 1.3, '#ffffff').circ(9.5, 2.6 + d, 1.4, '#ffffff').circ(12, 5.5 + d, 1, '#ffffff');
    P.rect(6, 10, 1, 2, '#2a1a1a').rect(9, 10, 1, 2, '#2a1a1a');
    return P.shade().out();
  };
  E.goblin = (f) => {
    const P = new Painter(16, 17), g = '#7cc04a';
    P.line(13, 3, 13, 16, '#8a6a40').poly([[12, 3.5], [13.5, 0], [15, 3.5]], '#d0d8e0');
    P.rect(5, f ? 14 : 15, 2, 2, '#4f7a2e').rect(9, f ? 15 : 14, 2, 2, '#4f7a2e');
    P.rect(4, 10, 8, 5, '#8a5a34').rect(4, 12, 8, 1, '#4a3020');
    P.circ(8, 6.2, 4.3, g);
    P.poly([[4, 5], [0, 2.5], [4, 8]], g).poly([[12, 5], [16, 2.5], [12, 8]], g);
    P.rect(7, 5, 2, 2, '#ffe066').rect(10, 5, 2, 2, '#ffe066').px(8, 6, '#1a1a10').px(11, 6, '#1a1a10');
    P.rect(7, 8, 4, 1, '#2a1a10').px(8, 8, '#ffffff').px(10, 8, '#ffffff');
    P.rect(12, 10, 2, 2, g);
    return P.shade().out();
  };
  E.lobo = (f) => {
    const P = new Painter(21, 14), c = '#8a8a9a', dk = '#62627a';
    P.poly([[3, 6], [0, 2], [1, 6.5], [4, 8.5]], '#7a7a8c');
    const legs = f ? [[4, 10], [8, 9], [12, 10], [15, 9]] : [[5, 9], [7, 10], [13, 9], [14, 10]];
    for (const [x, y] of legs) P.rect(x, y, 2, 4, dk);
    P.ell(9.5, 7, 6.5, 3.6, c).ell(9.5, 5.4, 5, 1.6, dk).ell(9.5, 8.6, 4.5, 1.5, '#c8c8d4');
    P.ell(16, 5, 3.6, 3, c).rect(17, 5, 4, 2, '#9a9aac').px(20, 5, '#1a1a1a');
    P.poly([[13.5, 3], [14.5, 0], [15.5, 3]], dk).poly([[15.5, 3], [17, 0], [17.5, 3]], dk);
    P.px(17, 4, '#ffe066').px(18, 7, '#ffffff');
    return P.shade().out();
  };
  E.kobold = (f) => {
    const P = new Painter(16, 16), sk = '#d07a3a';
    P.line(4, 12, 1, 15, sk);
    P.rect(5, f ? 13 : 14, 2, 2, '#8a4a20').rect(8, f ? 14 : 13, 2, 2, '#8a4a20');
    P.rect(4, 9, 7, 5, '#5a7a3a').rect(4, 11, 7, 1, '#3a5020');
    P.circ(7, 6, 4, sk).rect(9, 6, 4, 2, sk).px(12, 6, '#2a1a10');
    P.ell(6.5, 3.6, 4.4, 2.6, '#4a6a3a');
    P.px(9, 5, '#ffe066').px(10, 5, '#1a1a10');
    // bow
    P.line(13, 4, 14, 7, '#8a5a30').line(14, 7, 14, 11, '#8a5a30').line(14, 11, 13, 14, '#8a5a30').line(13, 4, 13, 14, '#e8e0c8');
    return P.shade().out();
  };
  E.besouro = (f) => {
    const P = new Painter(20, 16), lg = '#2e2824';
    const o = f ? 1 : 0;
    for (const x of [4, 8, 12]) { P.line(x, 11, x - 2 + o, 15, lg); P.line(x + 1, 11, x + 3 - o, 15, lg); }
    P.ell(9, 8, 8, 5.6, '#7a7068').line(9, 3, 9, 13, '#4a4440');
    P.circ(5, 6, 1.3, '#9a9088').circ(12, 5, 1.6, '#9a9088').circ(13, 10, 1, '#9a9088');
    P.px(6, 4, '#6fb04a').px(7, 3, '#6fb04a').px(11, 3, '#6fb04a');
    P.ell(16.5, 9, 2.8, 2.6, '#3a3430').line(17, 8, 19.5, 4.5, '#d8cfbc').px(18, 9, '#ff6a3a');
    return P.shade().out();
  };
  E.imp = (f) => {
    const P = new Painter(16, 16), b = '#4a2a66';
    if (f) { P.poly([[4, 8], [0, 9], [2, 12]], '#2a1640').poly([[12, 8], [16, 9], [14, 12]], '#2a1640'); }
    else { P.poly([[4, 8], [0, 4], [1, 10]], '#2a1640').poly([[12, 8], [16, 4], [15, 10]], '#2a1640'); }
    P.line(8, 13, 12, 15, '#3a2050').px(13, 15, '#ff4ad0');
    P.ell(8, 10, 4, 4, '#3a2050');
    P.circ(8, 5.5, 4.2, b);
    P.poly([[5, 3], [3.5, 0], [6.5, 2]], '#c8b8e8').poly([[10, 2], [12.5, 0], [11, 3.5]], '#c8b8e8');
    P.rect(7, 5, 2, 1, '#ff4ad0').rect(10, 5, 2, 1, '#ff4ad0');
    P.rect(7, 7, 4, 1, '#ff9ae8');
    return P.shade().out();
  };
  E.olho = (f) => {
    const P = new Painter(20, 17);
    const wy = f ? 2 : -1;
    P.poly([[5, 7], [0, 4 + wy], [1, 9 + wy], [4, 10]], '#3a2050').poly([[15, 7], [20, 4 + wy], [19, 9 + wy], [16, 10]], '#3a2050');
    P.line(10, 13, 9, 16, '#5a3a7a').line(11, 13, 12, 16, '#5a3a7a');
    P.circ(10, 8, 6.2, '#f2ecf8');
    P.px(5, 9, '#d84a6a').px(6, 11, '#d84a6a').px(14, 11, '#d84a6a');
    P.circ(11, 8, 3.2, '#8a3ad0').circ(11.4, 8, 1.6, '#1a0a2a').px(10, 6, '#ffffff');
    return P.shade(0.75, 0.1).out();
  };
  E.cavaleiro = (f) => {
    const P = new Painter(19, 21);
    P.rect(6, f ? 16 : 17, 3, 4, '#4a4a6a').rect(10, f ? 17 : 16, 3, 4, '#4a4a6a');
    P.rect(5, 9, 9, 8, '#b8b8d8').rect(6, 10, 2, 5, '#e0e0f4').rect(5, 13, 9, 1, '#8a6ad0');
    P.circ(9.5, 6, 4.6, '#c8c8e8').rect(9, 5, 5, 2, '#1a1030').px(10, 5, '#d05aff').px(12, 5, '#d05aff');
    P.poly([[7, 2], [3, 0], [9, 1.5]], '#d05aff');
    P.ell(15, 11.5, 3.6, 5.6, '#8a6ad0').ell(15, 11.5, 2.6, 4.6, '#e8e0ff').line(14, 8, 16, 14, '#ffffff');
    return P.shade().out();
  };
  E.morcego = (f) => {
    const P = new Painter(18, 12);
    if (f) P.poly([[6, 5], [0, 9], [3, 11], [6, 8]], '#2a1a48').poly([[12, 5], [18, 9], [15, 11], [12, 8]], '#2a1a48');
    else P.poly([[6, 5], [0, 0], [1, 6], [4, 8]], '#2a1a48').poly([[12, 5], [18, 0], [17, 6], [14, 8]], '#2a1a48');
    P.ell(9, 6, 3.4, 3.4, '#3e2c62').px(7, 2, '#3e2c62').px(11, 2, '#3e2c62');
    P.px(8, 5, '#ff5ad0').px(10, 5, '#ff5ad0').px(9, 8, '#ffffff');
    return P.shade().out();
  };
  E.mago = (f) => {
    const P = new Painter(17, 19), fl = f ? 1 : 0;
    P.poly([[8.5, 5], [2, 18], [15, 18]], '#2a8a8a').poly([[8.5, 9], [5, 18], [12, 18]], '#1f6a6a').rect(2, 17, 13, 1, '#ffe066');
    P.circ(8.5, 6, 4, '#1f6a6a').circ(9.3, 6.6, 2.5, '#120a1a').px(8, 6, '#ffe066').px(10, 6, '#ffe066');
    P.poly([[5, 0 + fl], [12, 0 + fl], [8.5, 3 + fl]], '#ff9a3a');
    P.line(15, 6, 15, 17, '#8a6a40').circ(15, 4.5, 1.8, '#ff9a3a').px(15, 4, '#fff2c0');
    return P.shade().out();
  };
  E.aranha = (f) => {
    const P = new Painter(19, 14), lg = '#4a5a7a', o = f ? 1 : -1;
    for (let i = 0; i < 4; i++) { const x = 6 + i * 2.5; P.line(x, 7, x - 3, 2 + (i % 2 ? o : -o), lg).line(x - 3, 2 + (i % 2 ? o : -o), x - 4, 0 + 3, lg); P.line(x, 8, x - 2, 13 - (i % 2 ? o : -o), lg); }
    P.ell(6, 7.5, 4.6, 4, '#5ad0ff').line(4, 5, 8, 10, '#c0f4ff').line(3, 8, 6, 4, '#2a90c0');
    P.poly([[5, 4], [6, 0], [7, 4]], '#c0f4ff').poly([[2, 6], [1, 2], [4, 5]], '#ff9ae8');
    P.ell(12.5, 7.5, 3.2, 2.6, '#3a4a6a').px(14, 6, '#ff5ad0').px(14, 8, '#ff5ad0').px(13, 7, '#ff5ad0');
    return P.shade().out();
  };
  E.escorpiao = (f) => {
    const P = new Painter(22, 16), b = '#a8542e', o = f ? 1 : 0;
    for (const x of [6, 9, 12]) { P.line(x, 12, x - 2 + o, 15, '#6a3018'); }
    [[4, 8, 2.2], [3, 5, 1.9], [4.5, 2.5, 1.7], [7.5, 1.6, 1.5]].forEach(([x, y, r]) => P.circ(x, y, r, b));
    P.poly([[8.5, 0.5], [12, 2], [8.5, 3]], '#ffe066');
    P.ell(10, 10.5, 6, 3.2, b).line(7, 9, 7, 13, '#7a3818').line(10, 9, 10, 13, '#7a3818');
    P.ell(17, 9.6 - o, 2.6, 1.8, '#c86a3a').line(18, 8 - o, 21, 7 - o, '#c86a3a').line(18, 11 - o, 21, 11 - o, '#c86a3a');
    P.px(15, 9, '#ffe066').px(15, 11, '#ffe066');
    return P.shade().out();
  };
  E.verme = (f) => {
    const P = new Painter(17, 19), m = f ? 1 : 0;
    P.ell(8.5, 15, 6.5, 3.6, '#b8865a').ell(8.5, 11 - m * 0.5, 5.8, 3.6, '#c8966a').ell(8.5, 6.5 - m, 5.2, 4.8, '#d8aa7a');
    P.rect(3, 10, 11, 1, '#9a6a42').rect(3, 14, 11, 1, '#9a6a42');
    P.circ(8.5, 5.5 - m, 3.2, '#3a1a1a');
    for (let a = 0; a < 8; a++) P.px(8.5 + Math.cos(a * 0.785) * 2.6, 5.5 - m + Math.sin(a * 0.785) * 2.6, '#ffffff');
    P.circ(8.5, 5.5 - m, 1.2, '#ff6a3a');
    return P.shade().out();
  };
  E.verme_mound = (f) => {
    const P = new Painter(18, 9);
    P.ell(9, 6, 8, 3.2 + (f ? 0.6 : 0), '#a8743e').ell(9, 5, 5, 2, '#c08c52');
    P.px(4, 5, '#7a5028').px(13, 6, '#7a5028').px(9, 3, '#e8c890');
    return P.shade().out();
  };
  E.golem = (f) => {
    const P = new Painter(24, 24), a = f ? -2 : 0;
    P.rect(6, 18, 4, 6, '#5a5048').rect(14, 18, 4, 6, '#5a5048');
    P.rect(0, 9 + a, 5, 9, '#7a5a3a').rect(19, 9 + a, 5, 9, '#7a5a3a').rect(0, 16 + a, 5, 3, '#5a4030').rect(19, 16 + a, 5, 3, '#5a4030');
    P.rect(4, 8, 16, 11, '#8a6a4a').rect(6, 10, 5, 4, '#a8542e').rect(14, 14, 4, 3, '#a8542e');
    for (const [x, y] of [[5, 9], [18, 9], [5, 17], [18, 17], [12, 12]]) P.px(x, y, '#d8b080');
    P.rect(8, 1, 8, 8, '#6a5a4a').rect(10, 3, 4, 2, '#ffb02e').px(11, 3, '#fff2c0');
    P.line(16, 2, 19, 0, '#4a4038');
    return P.shade().out();
  };
  E.poeira = (f) => {
    const P = new Painter(17, 17);
    P.circ(8.5, 9, 6.4, '#d8b080');
    for (let i = 0; i < 3; i++) { const a0 = i * 2.09 + (f ? 0.6 : 0); for (let t = 0; t < 1.6; t += 0.12) P.px(8.5 + Math.cos(a0 + t) * (2 + t * 2.6), 9 + Math.sin(a0 + t) * (2 + t * 2.6), '#f0dcb0'); }
    P.rect(5, 8, 3, 1, '#3a2010').rect(10, 8, 3, 1, '#3a2010').px(6, 9, '#ff6a3a').px(11, 9, '#ff6a3a');
    P.poly([[6, 15], [8.5, 17], [11, 15]], '#c89a5a');
    return P.shade(0.8, 0.15).out();
  };
  E.abutre = (f) => {
    const P = new Painter(24, 16), w = f ? 3 : 0;
    P.poly([[12, 7], [0, 2 + w], [2, 8 + w], [9, 10]], '#4a3a3a').poly([[12, 7], [24, 2 + w], [22, 8 + w], [15, 10]], '#4a3a3a');
    P.line(3, 4 + w, 9, 8, '#e8dcc8').line(21, 4 + w, 15, 8, '#e8dcc8');
    P.ell(12, 9, 3.6, 4.2, '#5a4848').rect(9, 6, 7, 1, '#e8dcc8');
    P.circ(12, 4, 2.3, '#e8a0a0').rect(14, 4, 2, 1, '#ffe066').px(13, 3, '#1a1010');
    P.rect(10, 13, 1, 2, '#e8dcc8').rect(13, 13, 1, 2, '#e8dcc8');
    return P.shade().out();
  };
  E.sentinela = (f) => {
    const P = new Painter(19, 23);
    P.poly([[1, 22], [18, 22], [15, 15], [4, 15]], '#8a7050');
    P.rect(5, 7, 9, 9, '#a88a62').rect(5, 11, 9, 1, '#5fe3d6');
    P.ell(9.5, 6.5, 5.5, 4.4, '#c8a878');
    P.circ(9.5, 9.5, 2.8, '#2a1a10').circ(9.5, 9.5, 1.6, f ? '#fff2c0' : '#ffb02e');
    P.px(3, 19, '#5fe3d6').px(15, 19, '#5fe3d6');
    return P.shade().out();
  };
  for (const k in E) S.en[k] = [E[k](0), E[k](1)];

  // ================================================================ BOSSES
  function musgo(f) {
    const P = new Painter(54, 48), a = f ? -2 : 0;
    P.rect(13, 37, 9, 10, '#5e5e50').rect(32, 37, 9, 10, '#5e5e50').rect(12, 45, 11, 2, '#4a4a3e').rect(31, 45, 11, 2, '#4a4a3e');
    P.ell(6.5, 29 + a, 6.5, 9.5, '#6e6e5e').ell(47.5, 29 + a, 6.5, 9.5, '#6e6e5e');
    P.ell(6.5, 22 + a, 6, 4, '#4f9a3c').ell(47.5, 22 + a, 6, 4, '#4f9a3c');
    P.ell(27, 26, 20, 15.5, '#7a7a6a');
    P.line(14, 30, 20, 36, '#55554a').line(35, 28, 40, 35, '#55554a').line(25, 36, 27, 40, '#55554a');
    P.ell(27, 15, 19, 8.5, '#4f9a3c');
    for (const [x, h] of [[11, 7], [16, 5], [22, 8], [33, 6], [39, 7], [43, 4]]) P.rect(x, 17, 3, h, '#4f9a3c');
    P.ell(20, 9, 4, 2.2, '#d8463c').rect(19, 10, 2, 3, '#efe2c4').px(18, 8, '#ffffff').px(21, 8, '#ffffff');
    P.ell(37, 10, 3, 1.8, '#d8463c').rect(36, 11, 2, 2, '#efe2c4');
    const fl = ['#ffe066', '#ff8ad0', '#ffffff'];
    for (let i = 0; i < 14; i++) P.px(10 + ((i * 37) % 34), 10 + ((i * 13) % 12), fl[i % 3]);
    P.rect(18, 25, 5, 3, '#ffe066').rect(31, 25, 5, 3, '#ffe066').px(19, 25, '#ffffff').px(32, 25, '#ffffff');
    P.rect(22, 33, 10, 2, '#2a2a22');
    return P.shade(0.75, 0.15).out();
  }
  function nyxara(f) {
    const P = new Painter(42, 50);
    P.poly([[13, 40], [21, 49 - (f ? 2 : 0)], [29, 40]], '#5a3a9a').poly([[16, 40], [21, 46], [26, 40]], '#8a5ad0');
    P.ell(21, 23, 15.5, 20.5, '#c8a040');
    P.ell(21, 23, 13, 18, '#2a1a4a').ell(21, 23, 11.5, 16.5, '#5a3a9a');
    P.ell(17, 15, 4, 6, '#7a5ac0').line(13, 10, 17, 30, '#d0b0ff');
    P.poly([[15, 2], [21, 0], [27, 2], [24, 4], [18, 4]], '#c8a040').circ(21, 2, 1.6, '#ff4ad0');
    P.ell(16, 20, 2.4, 1.4 + (f ? 0.4 : 0), '#ff4ad0').ell(26, 20, 2.4, 1.4 + (f ? 0.4 : 0), '#ff4ad0').px(16, 20, '#ffffff').px(26, 20, '#ffffff');
    P.rect(17, 28, 8, 1, '#1a0a2a').px(19, 29, '#1a0a2a').px(23, 29, '#1a0a2a');
    P.line(12, 8, 21, 23, '#ffffff').line(21, 23, 29, 37, '#ffffff').line(21, 23, 32, 18, '#e8d8ff');
    return P.shade(0.75, 0.12).out();
  }
  function kharun(f) {
    const P = new Painter(66, 52);
    P.ell(33, 26, 29, 22, '#8a7a6a');
    P.poly([[8, 12], [4, 0], [14, 8]], '#6a5a4a').poly([[58, 12], [62, 0], [52, 8]], '#6a5a4a');
    P.rect(10, 13, 46, 6, '#6a5a4a');
    P.rect(15, 34, 36, 14, '#7a6a5a').rect(15, 34, 36, 2, '#4a3e34');
    for (let x = 17; x < 50; x += 5) P.rect(x, 36, 3, 4, '#e8dcc8');
    P.ell(33, 24, 9, 7, '#1a1010').circ(33, 24, 5.4, '#ffb02e').circ(33, 24, f ? 2.6 : 2, '#fff6c0');
    P.line(20, 4, 26, 12, '#5fe3d6').line(46, 4, 40, 12, '#5fe3d6').line(28, 7, 38, 7, '#5fe3d6');
    P.line(8, 24, 14, 34, '#5a4a3a').line(55, 22, 50, 32, '#5a4a3a').line(28, 45, 30, 50, '#5a4a3a');
    P.px(12, 28, '#c8955a').px(52, 30, '#c8955a').px(40, 44, '#c8955a');
    return P.shade(0.78, 0.12).out();
  }
  function fist(f) {
    const P = new Painter(26, 22);
    P.rect(2, 4, 22, 15, '#8a7a6a').rect(2, 4, 22, 3, '#a8987e');
    for (let x = 7; x < 24; x += 5) P.line(x, 4, x, 12, '#5a4a3a');
    P.rect(0, 9, 4, 8, '#7a6a5a').line(8, 15, 18, 15, f ? '#ffb02e' : '#5fe3d6');
    return P.shade().out();
  }
  S.boss.musgo = [musgo(0), musgo(1)];
  S.boss.nyxara = [nyxara(0), nyxara(1)];
  S.boss.kharun = [kharun(0), kharun(1)];
  S.boss.fist = [fist(0), fist(1)];

  // ================================================================ WEAPONS (pointing right; grip = hand position)
  const W = {
    tronco: { grip: [2, 3], pal: { b: '#a8743e', B: '#6e4626', k: '#4a2c18', g: '#7ed05a', G: '#3e8a2e', r: '#e6c08a' }, rows: [
      '............gG....', '........bbbbbbbbbr', '....bbbbBbbbbkbbbr', 'bbbbbbbbbbbbbbbbbr', 'BBBBBbbbbBbbbbbbBr', '....BBBBbbbbBbbbbr', '........BBBBBBBBB.'] },
    arco_lunar: { grip: [5, 7], pal: { w: '#eef4ff', W: '#93a6d6', s: '#d0dcff', g: '#3b5fae' }, rows: [
      'ww.....', '.Ww....', '.s.Ww..', '.s..Ww.', '.s...W.', '.s...Ww', '.s...gg', '.s..ggg', '.s...gg', '.s...Ww', '.s...W.', '.s..Ww.', '.s.Ww..', '.Ww....', 'ww.....'] },
    penas: { grip: [1, 2], pal: { k: '#2a2440', a: '#d0463c', v: '#6f9ae0', V: '#2c4a85', w: '#e4f0ff' }, rows: [
      '......vV....', '..aavvvvvV..', 'kkaawwwwwwwV', '..aavvvvvV..', '......vV....'] },
    lanca: { grip: [7, 2], pal: { g: '#8a5a34', G: '#5e3a1e', a: '#e0b040', s: '#d8e0ec', S: '#8a96aa', w: '#ffffff', y: '#ffe066' }, rows: [
      '...................yy...', '..................sssS..', 'GgggggggggggggggaassssSw', '..................sssS..', '...................yy...'] },
    espada_bronze: { grip: [1, 2], pal: { h: '#5a3a20', a: '#c9a040', G: '#ffd890', B: '#e0a050', D: '#a86a2a', w: '#fff6d0' }, rows: [
      '..a...........', '..aGGGGGGGGGG.', 'hhaBBBBBBBBBBw', '..aDDDDDDDDDD.', '..a...........'] },
    funda: { grip: [1, 2], pal: { y: '#a07040', s: '#c86a5a', h: '#5a3a20', H: '#3a2410' }, rows: [
      '......yyy.', '.....y..sy', 'hhhhyy..s.', 'HHHHyy..s.', '.....y..sy', '......yyy.'] },
    machado: { grip: [2, 4], pal: { s: '#c8ccd8', S: '#8a90a0', k: '#5a5f70', h: '#9a6a3a', H: '#6a4424' }, rows: [
      '..........ssss..', '.........sSSSSs.', '..........sSSs..', '...........kk...', 'hhhhhhhhhhhkkhhh', 'HHHHHHHHHHHkkHHH', '...........kk...', '..........sSSs..', '.........sSSSSs.', '..........ssss..'] },
    besta: { grip: [3, 3], pal: { h: '#7a5030', H: '#54341c', k: '#5a5a6a', W: '#c8a060', w: '#e8d0a0', s: '#e0e0e0' }, rows: [
      '..........Ww...', '..........sW...', '..........s.W..', 'hhhhhhhhhhkkkkk', 'HHHHHHHHkkkkkkk', '..........s.W..', '..........sW...', '..........Ww...'] },
    cajado_brasa: { grip: [4, 2], pal: { o: '#ff6a2a', O: '#ffb03a', Y: '#fff2a0', k: '#3a2a2a', g: '#7a4a2a', G: '#4e2e18' }, rows: [
      '..............ooo.', '.............oOOOo', 'gggggggggggkkoOYOo', 'GGGGGGGGGGGkkoOOOo', '..............ooo.'] },
    cajado_gelo: { grip: [4, 2], pal: { c: '#5ad0ff', C: '#a8ecff', W: '#ffffff', g: '#cfd8e8', G: '#8a98b0', k: '#5a6a8a' }, rows: [
      '...............c..', '..............cCc.', 'gggggggggggkk.cWCc', 'GGGGGGGGGGGkkcCCCc', '..............cCc.', '...............c..'] },
    martelo: { grip: [2, 3], pal: { m: '#4a3a48', M: '#2e2430', o: '#ff8a3a', h: '#9a6a3a', H: '#6a4424' }, rows: [
      '..........mmmmmm', '.........mMMMMMm', '.........mMoMMoM', 'hhhhhhhhhmMMoMMM', 'HHHHHHHHHmMoMMMm', '.........mMMMoMm', '.........mMMMMMm', '..........mmmmmm'] },
    katana: { grip: [2, 2], pal: { k: '#2a2a40', K: '#c84a5a', a: '#e0c060', W: '#ffffff', c: '#9ff6ff', w: '#e8ffff' }, rows: [
      '....a...............', 'kKkKaWWWWWWWWWWWWWw.', 'kKkKacccccccccccccww', '....a...............'] },
    orbe: { grip: [2, 2], pal: { o: '#7a3ad0', O: '#c66bff', W: '#ffffff', h: '#e0c060', H: '#a08030', k: '#5a3a90' }, rows: [
      '.........oo.', '........oOOo', 'hhhhhhk.oOWo', 'HHHHHHk.oOOo', '.........oo.'] },
    tomo: { grip: [3, 5], pal: { b: '#2a5a2c', B: '#3e8a3f', a: '#ffd860', w: '#efe2c0', v: '#7ed05a' }, rows: [
      '.v.......v..', 'bbbbbbbbbbv.', 'bBBBBBBBBbb.', 'bBBaBBBBBb..', 'bBaaaBBBBbv.', 'bBBaBBBBBb..', 'bBBBBBBBBbb.', 'bbbbbbbbbb..', 'wwwwwwwwww..', '.v...v......'] },
    mosquete: { grip: [5, 3], pal: { h: '#8a5a34', H: '#5e3a1e', g: '#c9a040', k: '#4a5060', K: '#2a2e3a', r: '#5fe3d6' }, rows: [
      '...............r..r....', 'hhh..gkkkkkkkkkkkkkkkkK', 'hhhhhhgkkrkkkrkkkrkkkkK', 'HHHHHHgggggggggg.......', 'HHH....H...............'] },
    bacamarte: { grip: [5, 3], pal: { c: '#d05aff', C: '#f0a8ff', W: '#ffffff', k: '#3a2a50', h: '#4a3a6a', H: '#2e2246' }, rows: [
      '..............cc..', '.............cCWc.', 'hhh..kkkkkkkkcCCc.', 'hhhhhhkkkkkkkcCCCc', 'HHHHHHkkkkkkkcCCc.', 'HHH....H.....cCWc.', '..............cc..'] },
  };
  for (const k in W) { S.wp[k] = fromMap(W[k].rows, W[k].pal); S.wp[k].grip = [W[k].grip[0] + 1, W[k].grip[1] + 1]; }

  // ================================================================ EQUIPMENT ICONS (12x12)
  const Q = {
    coracao: (P) => { P.circ(3.5, 4, 3, '#ff4a5e').circ(8.5, 4, 3, '#ff4a5e').poly([[0.5, 5], [6, 11], [11.5, 5]], '#ff4a5e').px(3, 3, '#ffd0d8').px(6, 5, '#fff3b0').px(6, 6, '#ffe066'); },
    casco: (P) => { P.ell(6, 6.5, 5.6, 4.5, '#6a8a4a').line(6, 2, 6, 11, '#3e5a2a').line(1, 7, 11, 7, '#3e5a2a').px(3, 4, '#9ac06a').px(9, 4, '#9ac06a'); },
    botas: (P) => { P.rect(3, 1, 4, 8, '#8a4a30').rect(3, 8, 8, 3, '#8a4a30').rect(3, 10, 8, 1, '#3a2010').rect(3, 3, 4, 1, '#d8b060').px(9, 8, '#c86a4a'); },
    garra: (P) => { for (let i = 0; i < 3; i++) P.line(2 + i * 3, 1, 4 + i * 3, 10, '#f0e8d8').px(2 + i * 3, 1, '#ffffff'); P.rect(1, 9, 10, 2, '#6a4a3a'); },
    luva: (P) => { P.rect(2, 3, 8, 7, '#9aa6b8').rect(2, 3, 8, 2, '#c8d0dc').line(4, 3, 4, 7, '#5a6478').line(7, 3, 7, 7, '#5a6478').rect(3, 10, 6, 2, '#6a4a2a'); },
    aljava: (P) => { P.rect(3, 4, 6, 8, '#8a5a34').rect(3, 6, 6, 1, '#e0b040'); for (const x of [4, 6, 8]) P.line(x, 0, x, 4, '#e8e0c8').px(x, 0, '#d0463c'); },
    ampulheta: (P) => { P.rect(2, 0, 8, 2, '#e0b040').rect(2, 10, 8, 2, '#e0b040').poly([[3, 2], [9, 2], [6, 6]], '#cfe8ff').poly([[3, 10], [9, 10], [6, 6]], '#cfe8ff').poly([[4, 10], [8, 10], [6, 7]], '#ffd890').line(7, 3, 5, 9, '#ffffff'); },
    tambor: (P) => { P.ell(6, 3, 5, 2, '#f0e0c0').rect(1, 3, 10, 6, '#c8463c').ell(6, 9, 5, 2, '#c8463c').line(1, 4, 11, 8, '#e0b040').line(1, 8, 11, 4, '#e0b040').line(2, 0, 5, 3, '#8a5a34').line(10, 0, 7, 3, '#8a5a34'); },
    moeda: (P) => { P.circ(6, 6, 5.5, '#e0a020').circ(6, 6, 4, '#ffd040').circ(4.8, 5, 1.1, '#3e9a3f').circ(7.2, 5, 1.1, '#3e9a3f').circ(6, 7.3, 1.1, '#3e9a3f').px(4, 3, '#ffffff'); },
    olho_cristal: (P) => { P.poly([[6, 0], [11.5, 6], [6, 12], [0.5, 6]], '#5ad0ff').ell(6, 6, 3, 2, '#ffffff').circ(6, 6, 1.4, '#173040').px(4, 3, '#e0faff'); },
    amuleto_brasa: (P) => { P.line(1, 0, 6, 5, '#c9a040').line(11, 0, 6, 5, '#c9a040').circ(6, 7.5, 3.6, '#c9a040').circ(6, 7.5, 2.6, '#ff6a2a').px(5, 6, '#fff2a0'); },
    cristal_gelo: (P) => { P.poly([[6, 0], [9, 4], [8, 11], [4, 11], [3, 4]], '#7ad8ff').line(6, 1, 6, 10, '#d8f6ff').px(5, 3, '#ffffff'); },
    chifre_trovao: (P) => { P.poly([[1, 11], [3, 4], [7, 0], [9, 1], [5, 5], [4, 11]], '#efe3c8').line(8, 4, 6, 7, '#ffe066').line(6, 7, 9, 7, '#ffe066').line(9, 7, 7, 11, '#ffe066'); },
    cacto: (P) => { P.ell(6, 6.5, 4.5, 5.2, '#4f9a3c').line(6, 2, 6, 11, '#3a7a2c'); for (const [x, y] of [[1, 4], [11, 5], [2, 9], [10, 9], [6, 0], [4, 6], [8, 7]]) P.px(x, y, '#fff3c8'); },
    lanterna: (P) => { P.rect(5, 0, 2, 2, '#5a4a3a').rect(2, 2, 8, 9, '#6a5a4a').rect(3, 3, 6, 7, '#173040').ell(6, 7, 2, 2.6, '#5ad0ff').px(6, 6, '#e0faff').rect(2, 10, 8, 2, '#5a4a3a'); },
    anel_vamp: (P) => { P.ring(6, 7, 4.6, '#c0c0d0', 1.6).circ(6, 2.4, 2.2, '#d0203a').px(5, 2, '#ff9aa8'); },
    fenix: (P) => { P.poly([[1, 11], [4, 5], [9, 0], [11, 2], [7, 8]], '#ff6a2a').poly([[3, 9], [6, 5], [9, 2], [7, 7]], '#ffd040').line(1, 11, 7, 5, '#c8303a'); },
    capa: (P) => { P.poly([[3, 1], [9, 1], [11, 11], [6, 9], [1, 11]], '#3a2a5a').poly([[4, 1], [8, 1], [9, 6], [6, 5], [3, 6]], '#5a4a8a').rect(4, 1, 4, 1, '#e0b040'); },
    ima: (P) => { P.ring(6, 6, 5.5, '#d0303a', 3).rect(0, 6, 12, 6, 'rgba(0,0,0,0)'); P.x.clearRect(0, 6, 12, 6); P.rect(0.5, 6, 3, 3, '#d0303a').rect(8.5, 6, 3, 3, '#d0303a').rect(0.5, 9, 3, 2, '#d8d8e0').rect(8.5, 9, 3, 2, '#d8d8e0'); },
    orvalho: (P) => { P.rect(4, 0, 4, 3, '#c8b898').circ(6, 7.5, 4.3, '#cfe8ff').ell(6, 8.5, 3.3, 2.6, '#ff8ad0').px(4, 6, '#ffffff'); },
  };
  for (const k in Q) { const P = new Painter(12, 12); Q[k](P); P.shade(0.78, 0.15); S.eq[k] = P.out(); }

  // ================================================================ ABILITY ICONS (16x16)
  const AB = {
    forma: (P) => { P.poly([[2, 13], [5, 5], [10, 4], [14, 8], [10, 9], [9, 13]], '#d8364a').line(6, 5, 4, 1, '#efe3c8').line(8, 4, 8, 1, '#efe3c8').px(10, 6, '#ffe066').rect(11, 9, 3, 1, '#ffffff'); },
    rugido: (P) => { P.circ(4, 8, 2.5, '#ffb03a'); for (const r of [5, 8, 11]) P.ring(3, 8, r, '#ff6a2a', 1); P.x.clearRect(0, 0, 4, 16); P.circ(4, 8, 2.5, '#ffb03a'); },
    investida: (P) => { P.poly([[7, 3], [14, 8], [7, 13], [9, 8]], '#ffe066').rect(1, 6, 7, 4, '#ff6a2a').rect(0, 7, 4, 2, '#ffb03a'); },
    pancada: (P) => { P.rect(9, 1, 4, 9, '#a8743e').rect(10, 9, 2, 2, '#6e4626').poly([[1, 13], [15, 13], [12, 15], [4, 15]], '#ff8a3a').line(8, 12, 5, 15, '#2a1a10').line(8, 12, 11, 15, '#2a1a10'); },
    chuva: (P) => { for (const [x, y] of [[3, 1], [8, 4], [12, 0]]) { P.line(x, y, x, y + 8, '#e8e0c8').poly([[x - 1.5, y + 8], [x + 2.5, y + 8], [x + 0.5, y + 11]], '#cfe8ff'); } P.rect(1, 14, 14, 1, '#5fe3d6'); },
    espirito: (P) => { P.poly([[2, 13], [6, 8], [8, 11]], '#3e9a6f').circ(9, 7, 4.5, '#5fe3d6').circ(9, 7, 2.5, '#e0fff8').px(8, 6, '#ffffff'); },
    passo: (P) => { P.ell(5, 9, 2.6, 4, '#86c75a').ell(11, 6, 2.6, 4, '#c0f4d0'); for (const [x, y] of [[13, 13], [2, 2], [14, 2]]) { P.px(x, y, '#ffffff').px(x - 1, y, '#5fe3d6').px(x + 1, y, '#5fe3d6').px(x, y - 1, '#5fe3d6').px(x, y + 1, '#5fe3d6'); } },
    raizes: (P) => { P.line(8, 15, 8, 3, '#8a5a34').line(8, 10, 3, 4, '#8a5a34').line(8, 8, 13, 3, '#8a5a34').line(3, 4, 2, 1, '#7ed05a').line(13, 3, 14, 1, '#7ed05a').circ(8, 3, 1.5, '#7ed05a'); },
    tempestade: (P) => { for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; P.line(8 + Math.cos(a) * 2.5, 8 + Math.sin(a) * 2.5, 8 + Math.cos(a) * 7, 8 + Math.sin(a) * 7, i % 2 ? '#cfe2ff' : '#6f9ae0'); } P.circ(8, 8, 2, '#ffffff'); },
    mergulho: (P) => { P.poly([[1, 3], [8, 7], [15, 3], [8, 14]], '#6f9ae0').poly([[5, 6], [8, 8], [11, 6], [8, 12]], '#cfe2ff').rect(7, 0, 2, 4, '#ffe066'); },
    rajada: (P) => { P.line(1, 4, 11, 4, '#cfe2ff').line(11, 4, 13, 6, '#cfe2ff').line(3, 8, 14, 8, '#ffffff').line(1, 12, 10, 12, '#9cc8ff').line(10, 12, 12, 10, '#9cc8ff'); },
    olho: (P) => { P.ell(8, 8, 7, 4.5, '#ffe066').circ(8, 8, 3, '#d0781c').circ(8, 8, 1.5, '#1d1830').px(7, 7, '#ffffff'); },
    galope: (P) => { P.ring(9, 7, 5.5, '#c8ccd8', 2.5); P.x.clearRect(5, 9, 9, 7); P.rect(4, 9, 3, 3, '#c8ccd8').rect(11, 9, 3, 3, '#c8ccd8'); P.line(0, 13, 6, 13, '#ffe066').line(1, 15, 9, 15, '#ffb03a'); },
    coice: (P) => { P.rect(3, 2, 6, 8, '#9a5530').rect(2, 9, 8, 4, '#2a2224').rect(2, 9, 8, 1, '#4a4044'); for (const [x, y] of [[12, 4], [13, 9], [11, 13]]) P.line(x - 1, y, x + 2, y, '#ffe066'); },
    relincho: (P) => { P.poly([[3, 15], [5, 6], [9, 2], [13, 4], [12, 8], [8, 9], [9, 15]], '#9a5530').poly([[4, 6], [6, 2], [9, 2], [5, 9]], '#2e211e').px(10, 4, '#ffffff').line(14, 1, 15, 0, '#ffe066').line(14, 7, 15, 8, '#ffe066'); },
    ferradura: (P) => { P.ring(8, 7, 6, '#c8ccd8', 2.5); P.x.clearRect(3, 9, 10, 7); P.rect(2, 9, 3, 4, '#c8ccd8').rect(11, 9, 3, 4, '#c8ccd8').line(9, 3, 7, 7, '#ffe066').line(7, 7, 10, 7, '#ffe066').line(10, 7, 8, 11, '#ffe066'); },
  };
  for (const k in AB) {
    const P = new Painter(16, 16); AB[k](P); P.shade(0.8, 0.12);
    S.ab[k] = P.out();
  }

  // ================================================================ MISC: pickups, props, NPCs
  const M = S.misc;
  M.coin = [0, 1, 2].map((f) => { const P = new Painter(6, 6), w = [3, 2, 1][f]; P.ell(3, 3, w, 3, '#e0a020').ell(3, 3, Math.max(0.6, w - 1), 2, '#ffd040'); if (f === 0) P.px(2, 1, '#ffffff'); return P.out(); });
  M.crystal = [0, 1].map((f) => { const P = new Painter(6, 9); P.poly([[3, 0], [6, 4], [3, 9], [0, 4]], '#5fe3d6').poly([[3, 0], [3, 9], [0, 4]], '#a8fff4'); if (f) P.px(2, 2, '#ffffff'); return P.out(); });
  M.potion = (() => { const P = new Painter(8, 10); P.rect(3, 0, 2, 2, '#c8b898').circ(4, 6, 3.6, '#ff4a5e').px(3, 4, '#ffd0d8').rect(2, 2, 4, 1, '#ffffff'); return P.shade().out(); })();
  M.chest = [0, 1].map((open) => {
    const P = new Painter(16, 12);
    P.rect(1, 5, 14, 7, '#8a5a30').rect(1, 5, 14, 1, '#e0b040').rect(1, 11, 14, 1, '#5a3a20').rect(7, 5, 2, 4, '#e0b040');
    if (open) P.rect(1, 0, 14, 4, '#3a2410').rect(2, 2, 12, 3, '#ffd040');
    else P.ell(8, 4, 7, 3.4, '#9a6a3a').rect(1, 4, 14, 2, '#9a6a3a').rect(7, 2, 2, 3, '#e0b040');
    return P.shade().out();
  });
  M.gift = [0, 1].map((open) => {
    const P = new Painter(20, 16);
    P.rect(1, 6, 18, 10, '#6a3aa0').rect(1, 6, 18, 2, '#ffd040').rect(9, 6, 2, 10, '#ffd040').rect(1, 15, 18, 1, '#3a1a60');
    if (open) P.rect(1, 1, 18, 4, '#2a1040').ell(10, 4, 7, 2, '#fff2a0');
    else { P.rect(0, 3, 20, 4, '#8a5ad0').rect(9, 3, 2, 4, '#ffd040').ell(7, 2, 3, 2, '#ffd040').ell(13, 2, 3, 2, '#ffd040'); }
    return P.shade().out();
  });
  M.altar = (() => { const P = new Painter(24, 16); P.poly([[2, 15], [22, 15], [19, 6], [5, 6]], '#6a6a8a').rect(4, 4, 16, 3, '#8a8aaa').rect(6, 9, 12, 1, '#c66bff').rect(4, 15, 16, 1, '#3a3a5a'); return P.shade().out(); })();
  M.pedestal = (() => { const P = new Painter(14, 8); P.rect(2, 2, 10, 6, '#7a6a5a').rect(0, 0, 14, 3, '#a8987e').rect(2, 7, 10, 1, '#4a3e34'); return P.shade().out(); })();
  M.merchant = [0, 1].map((f) => {
    const P = new Painter(22, 22);
    P.rect(1, 5, 8, 13, '#8a5a34').rect(1, 8, 8, 1, '#e0b040').rect(2, 2, 6, 3, '#d8463c').circ(3, 2, 1.4, '#5fe3d6');
    P.ell(13, 15 + f * 0.3, 7, 6, '#6aa84a').ell(13, 17, 5, 3.4, '#e8e0a8');
    P.ell(13, 8 - f * 0.3, 6.5, 4.5, '#6aa84a');
    P.circ(9.5, 5 - f * 0.3, 2.2, '#6aa84a').circ(16.5, 5 - f * 0.3, 2.2, '#6aa84a').circ(9.5, 4.6, 1.2, '#1a1a10').circ(16.5, 4.6, 1.2, '#1a1a10').px(9, 4, '#ffffff').px(16, 4, '#ffffff');
    P.rect(10, 10 - f * 0.3, 7, 1, '#2a4a20').poly([[7, 3], [13, -1], [19, 3]], '#3a2a5a');
    P.rect(7, 21, 4, 1, '#4a7a30').rect(15, 21, 4, 1, '#4a7a30');
    return P.shade().out();
  });
  M.dummy = [0, 1].map((f) => {
    const P = new Painter(16, 22), t = f ? 1 : 0;
    P.rect(7, 12, 2, 10, '#6e4626').rect(3, 20, 10, 2, '#5a3a20');
    P.rect(1 + t, 8, 14, 2, '#8a6a40');
    P.ell(8 + t * 0.5, 11, 4, 4.5, '#e0c070').rect(5, 10, 6, 1, '#a8743e');
    P.circ(8 + t, 4.5, 3.6, '#e8d090').px(7 + t, 4, '#3a2a10').px(10 + t, 4, '#3a2a10').line(6 + t, 6, 10 + t, 6, '#c86a5a');
    return P.shade().out();
  });
  M.bookshelf = (() => {
    const P = new Painter(26, 26);
    P.rect(0, 0, 26, 26, '#5a3a24').rect(2, 2, 22, 22, '#3a2416');
    const cols = ['#c8463c', '#3e7d9f', '#e0b040', '#5a9a4a', '#8a5ad0', '#d8d0c0'];
    for (const y of [3, 11, 19]) { P.rect(1, y + 6, 24, 2, '#6e4a30'); for (let x = 3; x < 23; x += 3) P.rect(x, y + (x % 2), 2, 6 - (x % 2), cols[(x + y) % cols.length]); }
    P.circ(13, 1, 2, '#5fe3d6');
    return P.shade(0.8, 0.12).out();
  })();
  M.trophy = (() => {
    const P = new Painter(18, 26);
    P.rect(2, 20, 14, 6, '#6a6a8a').rect(4, 18, 10, 2, '#8a8aaa');
    P.rect(8, 12, 2, 6, '#e0b040').ell(9, 7, 6, 5.5, '#ffd040').ell(9, 5, 4, 2.2, '#fff2a0');
    P.ring(2.5, 7, 2.5, '#e0b040', 1).ring(15.5, 7, 2.5, '#e0b040', 1).rect(6, 17, 6, 1, '#e0b040');
    return P.shade().out();
  })();
  M.starAltar = (() => {
    const P = new Painter(26, 20);
    P.poly([[2, 19], [24, 19], [20, 9], [6, 9]], '#4a4a6a').rect(5, 7, 16, 3, '#6a6a8a');
    P.circ(13, 4, 4, '#2a1a4a').circ(13, 4, 2.6, '#5fe3d6').px(12, 3, '#ffffff');
    P.px(6, 14, '#ffe066').px(13, 13, '#ffe066').px(19, 15, '#ffe066').line(6, 14, 13, 13, '#8a8acc').line(13, 13, 19, 15, '#8a8acc');
    return P.shade().out();
  })();
  M.grimoire = (() => {
    const P = new Painter(20, 22);
    P.rect(9, 10, 2, 11, '#6e4626').rect(5, 20, 10, 2, '#5a3a20');
    P.poly([[1, 9], [10, 6], [19, 9], [19, 12], [10, 9], [1, 12]], '#8a3a3a').poly([[2, 8], [10, 5], [10, 8], [2, 10]], '#f2e6cc').poly([[18, 8], [10, 5], [10, 8], [18, 10]], '#e8dcc0');
    P.circ(10, 2, 2, '#ff8a3a').px(10, 1, '#fff2a0');
    return P.shade().out();
  })();
  M.gate = (() => {
    const P = new Painter(36, 30);
    P.rect(0, 4, 6, 26, '#6a6a8a').rect(30, 4, 6, 26, '#6a6a8a').rect(0, 0, 36, 6, '#8a8aaa').rect(0, 5, 36, 1, '#4a4a6a');
    P.rect(6, 6, 24, 24, '#1a1424').rect(14, 1, 8, 3, '#e0b040');
    for (const x of [1, 31]) for (let y = 8; y < 28; y += 5) P.rect(x, y, 4, 1, '#4a4a6a');
    return P.shade(0.8, 0.12).out();
  })();
  M.campfire = (() => { const P = new Painter(18, 8); P.line(1, 7, 16, 3, '#6e4626').line(1, 3, 16, 7, '#8a5a34'); for (let i = 0; i < 6; i++) P.circ(2 + i * 2.8, 6.5, 1.4, '#7a7a8a'); return P.shade().out(); })();
  M.banner = (c) => { const P = new Painter(10, 22); P.rect(4, 0, 2, 22, '#5a3a20').rect(0, 2, 10, 1, '#e0b040').poly([[0, 3], [10, 3], [10, 16], [5, 13], [0, 16]], c).circ(5, 8, 2, '#ffe9b0'); return P.shade().out(); };
  M.tent = (() => { const P = new Painter(34, 24); P.poly([[17, 0], [34, 23], [0, 23]], '#8a3a3a').poly([[17, 0], [24, 23], [10, 23]], '#5a2424').poly([[17, 8], [21, 23], [13, 23]], '#1a1010').line(17, 0, 17, 3, '#e0b040'); return P.shade(0.8, 0.12).out(); })();
  M.skull = (() => { const P = new Painter(8, 7); P.circ(4, 3, 3.2, '#e8dcc8').rect(2, 5, 4, 2, '#e8dcc8').px(3, 3, '#2a1a10').px(5, 3, '#2a1a10'); return P.out(); })();
  M.rock = (() => { const P = new Painter(12, 11); P.ell(6, 6, 5.6, 4.8, '#a88a62').ell(4.5, 4.5, 2.4, 1.8, '#c8a878').px(8, 7, '#6a5038').px(3, 8, '#6a5038'); return P.shade().out(); })();
  M.seed = (() => { const P = new Painter(5, 5); P.circ(2.5, 2.5, 2.4, '#8a5a30').px(1, 1, '#d8a868'); return P.out(); })();
  M.horseshoe = (() => { const P = new Painter(12, 12); P.ring(6, 5.5, 5.5, '#d8dde8', 2.4); P.x.clearRect(2, 7, 8, 5); P.rect(1, 6, 3, 5, '#d8dde8').rect(8, 6, 3, 5, '#d8dde8').px(2, 3, '#ffffff').px(9, 3, '#8a96aa'); return P.out(); })();
  M.ent = [0, 1].map((f) => { const P = new Painter(14, 16); P.rect(5, 8, 4, 8, '#7a4a2a').poly([[1, 9], [7, 0 + f], [13, 9]], '#4f9a3c').circ(4, 7, 3, '#5fb04a').circ(10, 7, 3, '#5fb04a').px(5, 11, '#ffe066').px(8, 11, '#ffe066'); return P.shade().out(); });
  M.wisp = (() => { const P = new Painter(8, 8); P.circ(4, 4, 3.6, '#5fe3d6').circ(4, 4, 2, '#e0fff8'); return P.out('#0f3a3a'); })();
  M.spirit = (() => { const P = new Painter(8, 8); P.circ(4, 4, 3.4, '#9ad8ff').circ(4, 4, 1.8, '#ffffff'); return P.out('#1a2a5a'); })();
  M.bone = (() => { const P = new Painter(9, 5); P.rect(2, 2, 5, 1, '#e8dcc8').circ(1.5, 1.5, 1.4, '#e8dcc8').circ(1.5, 3.5, 1.4, '#e8dcc8').circ(7.5, 1.5, 1.4, '#e8dcc8').circ(7.5, 3.5, 1.4, '#e8dcc8'); return P.out(); })();
  M.shard = (() => { const P = new Painter(8, 12); P.poly([[4, 0], [8, 5], [4, 12], [0, 5]], '#c8b8ff').line(4, 1, 4, 11, '#ffffff'); return P.out('#3a1a6a'); })();
  M.clone = (k) => N.silhouette(S.ch[k][0], 'rgba(160,240,220,0.75)');
  M.horse = [0, 1].map((f) => {
    const P = new Painter(24, 16), c = '#bfe8ff';
    P.ell(10, 8, 7, 3.6, c).ell(18, 4.6, 2.8, 2.5, c).rect(19, 4, 5, 2, c).poly([[15, 4], [17, 0], [18, 4]], c);
    for (const [x, y] of (f ? [[4, 10], [8, 11], [12, 10], [15, 11]] : [[5, 11], [7, 10], [13, 11], [14, 10]])) P.rect(x, y, 2, 5, c);
    P.poly([[3, 6], [0, 3], [0, 9]], '#e8f8ff').px(20, 4, '#1a3a5a');
    return P.out('#2a5a8a');
  });

  // ================================================================ PROJECTILES
  const PR = S.proj = {};
  const bullet = (c, r) => { const s = r * 2 + 2, P = new Painter(s, s); P.circ(s / 2, s / 2, r + 0.4, c).circ(s / 2 - r * 0.3, s / 2 - r * 0.3, Math.max(1, r * 0.45), '#ffffff'); return P.out('#1a0a14'); };
  N.bulletSprite = (() => { const cache = {}; return (c, r) => cache[c + r] || (cache[c + r] = bullet(c, r)); })();
  PR.arrow = (() => { const P = new Painter(12, 3); P.line(0, 1, 9, 1, '#e8e0c8').poly([[8, -0.2], [12, 1.5], [8, 3.2]], '#cfe8ff').px(0, 0, '#5fe3d6').px(0, 2, '#5fe3d6'); return P.out(); })();
  PR.feather = (() => { const P = new Painter(10, 4); P.ell(5, 2, 5, 1.6, '#6f9ae0').line(0, 2, 9, 2, '#e4f0ff'); return P.out(); })();
  PR.bolt = (() => { const P = new Painter(9, 3); P.line(0, 1, 7, 1, '#c8a060').poly([[6, 0], [9, 1.5], [6, 3]], '#d8d8e0'); return P.out(); })();
  PR.stone = (() => { const P = new Painter(5, 5); P.circ(2.5, 2.5, 2.4, '#9a9088').px(1, 1, '#d8d0c8'); return P.out(); })();
  PR.fireball = (() => { const P = new Painter(9, 9); P.circ(4.5, 4.5, 4.4, '#ff6a2a').circ(5, 4.5, 2.8, '#ffb03a').circ(5.5, 4.5, 1.4, '#fff2a0'); return P.out('#4a1008'); })();
  PR.ice = (() => { const P = new Painter(9, 5); P.poly([[0, 2.5], [5, 0], [9, 2.5], [5, 5]], '#7ad8ff').line(1, 2, 8, 2, '#ffffff'); return P.out('#0a3050'); })();
  PR.orb = (() => { const P = new Painter(8, 8); P.circ(4, 4, 3.8, '#c66bff').circ(4, 4, 2, '#ffe0ff'); return P.out('#2a0a40'); })();
  PR.rune = (() => { const P = new Painter(14, 5); P.rect(0, 1, 10, 3, '#5fe3d6').poly([[9, 0], [14, 2.5], [9, 5]], '#e0fffa').rect(0, 2, 12, 1, '#ffffff'); return P.out('#0a3a3a'); })();
  PR.shard = (() => { const P = new Painter(7, 4); P.poly([[0, 2], [4, 0], [7, 2], [4, 4]], '#e08aff').px(3, 1, '#ffffff'); return P.out('#3a0a50'); })();
  PR.seedP = (() => { const P = new Painter(5, 5); P.circ(2.5, 2.5, 2.3, '#c8a050').px(1, 1, '#fff2a0'); return P.out('#3a2a10'); })();
  PR.leaf = (() => { const P = new Painter(8, 4); P.ell(4, 2, 4, 1.7, '#7ed05a').line(0, 2, 7, 2, '#3e8a2e'); return P.out('#173a10'); })();
  PR.wave = (() => { const P = new Painter(8, 16); P.ring(-2, 8, 9, '#9ff6ff', 2.2); P.ring(-2, 8, 7, '#e8ffff', 1); return P.c; })();

  // ================================================================ TILES (per theme)
  const THEMES = N.THEMES = {
    lobby: { void: '#0d0a14', floor: ['#6e5240', '#755845'], spots: ['#8a6c52', '#5a4232'], grout: '#55402f', wallTop: '#7a6a8a', wallHi: '#9a8aaa', face: '#4a3e5a', faceDk: '#33293f', block: ['#6a5a7a', '#8a7a9a', '#4a3e5a'], decor: ['rug', 'pebble'] },
    overworld: { void: '#0f1a12', floor: ['#4f8a3c', '#56923f'], spots: ['#6aa84a', '#3e7230'], grout: null, wallTop: '#7d8a6a', wallHi: '#a0ad88', face: '#55604a', faceDk: '#3c4536', block: ['#3e7a32', '#5fa04a', '#2c5a24'], decor: ['grass', 'flower', 'flower2', 'stone', 'mush'] },
    reverso: { void: '#08050f', floor: ['#2e2348', '#342852'], spots: ['#4a3a72', '#23193a'], grout: '#251c3c', wallTop: '#5a4a8a', wallHi: '#7e6eb4', face: '#3a2c5e', faceDk: '#261c40', block: ['#7a4ac0', '#c08aff', '#4a2a80'], decor: ['rune', 'crystal', 'eye', 'pebble'] },
    wasteland: { void: '#140c08', floor: ['#c8955a', '#c18e54'], spots: ['#d8a86a', '#a87440'], grout: null, wallTop: '#8a6040', wallHi: '#aa7e56', face: '#5e3e28', faceDk: '#45291a', block: ['#9a7a5a', '#c8a878', '#6a5038'], decor: ['bone', 'skull', 'crack', 'pebble', 'cactus'] },
    training: { void: '#0d0a14', floor: ['#4a4a5a', '#505062'], spots: ['#5e5e72', '#3e3e4c'], grout: '#3a3a48', wallTop: '#6a6a7e', wallHi: '#8a8aa0', face: '#3e3e50', faceDk: '#2c2c3a', block: ['#8a6a40', '#b08a5a', '#5a4428'], decor: ['pebble'] },
  };
  function themeTiles(name) {
    const th = THEMES[name], t = { floor: [], decor: [] };
    for (let v = 0; v < 4; v++) {
      const P = new Painter(16, 16), r = N.makeRng(v * 97 + name.length * 13 + 1);
      P.rect(0, 0, 16, 16, th.floor[v % 2]);
      for (let i = 0; i < 10; i++) P.px(r.int(0, 15), r.int(0, 15), th.spots[i % 2]);
      if (th.grout) { P.rect(0, 15, 16, 1, th.grout).rect(15, 0, 1, 16, th.grout); if (v === 3) P.rect(0, 7, 16, 1, th.grout); }
      if (name === 'overworld' && v >= 2) { for (let i = 0; i < 3; i++) { const x = r.int(1, 13), y = r.int(2, 13); P.px(x, y, '#78b85a').px(x + 1, y - 1, '#78b85a').px(x + 2, y, '#78b85a'); } }
      if (name === 'wasteland' && v === 3) P.line(2, 3, 7, 8, '#a87440').line(7, 8, 12, 7, '#a87440');
      if (name === 'reverso' && v === 2) P.px(4, 4, '#7a5ac0').px(11, 10, '#7a5ac0');
      t.floor.push(P.c);
    }
    // wall top & face
    let P = new Painter(16, 16); P.rect(0, 0, 16, 16, th.wallTop).rect(0, 0, 16, 1, th.wallHi).rect(0, 15, 16, 1, th.faceDk); t.top = P.c;
    P = new Painter(16, 16); P.rect(0, 0, 16, 16, th.face).rect(0, 0, 16, 4, th.wallTop).rect(0, 0, 16, 1, th.wallHi).rect(0, 4, 16, 1, th.faceDk);
    for (let y = 5; y < 16; y += 4) { P.rect(0, y + 3, 16, 1, th.faceDk); const off = ((y - 5) / 4) % 2 ? 4 : 10; P.rect(off, y, 1, 3, th.faceDk); P.rect((off + 8) % 16, y, 1, 3, th.faceDk); }
    t.face = P.c;
    // obstacle block
    P = new Painter(16, 16);
    const [b0, b1, b2] = th.block;
    if (name === 'overworld') { P.ell(8, 8, 8, 7.5, b0).ell(6, 6, 4, 3, b1).ell(11, 9, 3, 2.5, b1).px(4, 5, '#ff8ad0').px(11, 7, '#ffe066'); P.shade(0.7, 0.15); }
    else if (name === 'reverso') { P.poly([[8, 0], [14, 6], [12, 16], [4, 16], [2, 6]], b0).poly([[8, 0], [8, 16], [4, 16], [2, 6]], b1).line(8, 1, 8, 15, '#ffffff'); P.shade(0.7, 0.1); }
    else { P.rect(0, 4, 16, 12, b2).rect(0, 0, 16, 11, b0).rect(0, 0, 16, 1, b1).rect(2, 3, 5, 1, b1).rect(9, 6, 4, 1, b1); if (name === 'wasteland') P.rect(10, 12, 3, 1, '#e8dcc8'); }
    t.block = outline(P.c, OUT);
    // floor decorations
    const D = {
      grass: (p) => p.px(2, 4, '#7cc45a').px(3, 3, '#7cc45a').px(4, 4, '#7cc45a').px(3, 5, '#5a9a3e'),
      flower: (p) => p.px(3, 2, '#ffe066').px(2, 3, '#ffffff').px(4, 3, '#ffffff').px(3, 4, '#ffffff').px(3, 3, '#ff8a3a').px(3, 5, '#3e7230'),
      flower2: (p) => p.px(3, 3, '#ff8ad0').px(2, 3, '#ffb0e0').px(4, 3, '#ffb0e0').px(3, 2, '#ffb0e0').px(3, 4, '#d05a9a'),
      stone: (p) => p.ell(3.5, 4, 2.5, 1.6, '#8a9a7a').px(2, 3, '#b8c8a8'),
      mush: (p) => p.ell(3.5, 3, 2.4, 1.5, '#d8463c').rect(3, 4, 1, 2, '#efe2c4').px(2, 2, '#ffffff'),
      rune: (p) => p.line(1, 1, 5, 5, '#7a5ac0').line(5, 1, 1, 5, '#7a5ac0').px(3, 3, '#d05aff'),
      crystal: (p) => p.poly([[3, 0], [5, 4], [3, 6], [1, 4]], '#c08aff').px(3, 2, '#ffffff'),
      eye: (p) => p.ell(3.5, 3.5, 2.6, 1.5, '#d0c8f0').px(3, 3, '#5a1a8a').px(4, 3, '#5a1a8a'),
      bone: (p) => p.line(1, 5, 5, 1, '#e8dcc8').px(0, 5, '#e8dcc8').px(1, 6, '#e8dcc8').px(5, 0, '#e8dcc8').px(6, 1, '#e8dcc8'),
      skull: (p) => p.circ(3.5, 3, 2.5, '#e8dcc8').px(2, 3, '#3a2010').px(4, 3, '#3a2010').rect(2, 5, 3, 1, '#d8ccb8'),
      crack: (p) => p.line(0, 3, 3, 2, '#8a5a30').line(3, 2, 6, 5, '#8a5a30'),
      pebble: (p) => p.px(2, 4, th.spots[0]).px(4, 3, th.spots[1]).px(5, 5, th.spots[0]),
      cactus: (p) => p.rect(3, 1, 2, 6, '#4f9a3c').rect(1, 3, 1, 2, '#4f9a3c').rect(6, 2, 1, 2, '#4f9a3c').px(3, 1, '#7cc45a'),
      rug: (p) => p.px(3, 3, '#7a5e48'),
    };
    for (const k of th.decor) { const p = new Painter(7, 7); D[k](p); t.decor.push(p.c); }
    return t;
  }
  for (const k in THEMES) S.tiles[k] = themeTiles(k);
})();
