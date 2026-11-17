/* Mutatrix: base de pixel art sobre PixiJS (paleta, pincéis com contorno de 1 pixel e sombreamento chapado,
   preenchimento por varredura para estampas, fonte em pixel 5x7 com acentos, ícones e miniaturas). */
(function (root) {
  'use strict';
  const MX = root.MX || (root.MX = {});

  // Paleta base (inspirada em paletas de 16 cores de pixel art) com alguns tons extras.
  const PAL = {
    ink: 0x1a1c2c, plum: 0x5d275d, red: 0xb13e53, orange: 0xef7d57, yellow: 0xffcd75, lime: 0xa7f070,
    green: 0x38b764, teal: 0x257179, navy: 0x29366f, blue: 0x3b5dc9, sky: 0x41a6f6, cyan: 0x73eff7,
    white: 0xf4f4f4, silver: 0x94b0c2, slate: 0x566c86, dark: 0x333c57,
    pink: 0xff77a8, cream: 0xfff1d6, tan: 0xd4a373, wood: 0xb07a4f, brown: 0x7a4b31, mint: 0x9fe2bf, purple: 0x8a5cc9,
  };
  const CSS = Object.fromEntries(Object.entries(PAL).map(([k, v]) => [k, '#' + v.toString(16).padStart(6, '0')]));

  // ---------------------------------------------------------------- cor
  const cache = new Map();
  function num(c) {
    if (typeof c === 'number') return c;
    let h = String(c).replace('#', '');
    if (h.length === 3) h = h.split('').map((x) => x + x).join('');
    return parseInt(h, 16);
  }
  function mix(a, b, t) {
    a = num(a); b = num(b);
    const k = a * 131 + b * 7 + Math.round(t * 100);
    let v = cache.get(k);
    if (v !== undefined) return v;
    const r = ((a >> 16) & 255) + ((((b >> 16) & 255) - ((a >> 16) & 255)) * t);
    const g = ((a >> 8) & 255) + ((((b >> 8) & 255) - ((a >> 8) & 255)) * t);
    const bl = (a & 255) + (((b & 255) - (a & 255)) * t);
    v = (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(bl);
    if (cache.size > 6000) cache.clear();
    cache.set(k, v);
    return v;
  }
  const light = (c, t) => mix(c, 0xffffff, t);
  const dark = (c, t) => mix(c, PAL.ink, t);
  const hex = (c) => '#' + num(c).toString(16).padStart(6, '0');

  // ---------------------------------------------------------------- qualidade
  const Q = { level: 2, particles: 1 };
  function setQuality(level) { Q.level = level; Q.particles = level === 0 ? 0.45 : level === 1 ? 0.75 : 1; }

  // ---------------------------------------------------------------- pincéis
  const R = Math.round;
  const fillc = (c, a) => (a === undefined || a >= 1 ? num(c) : { color: num(c), alpha: a });

  // Elipse com contorno e sombreamento em 3 tons (sombra embaixo à direita, brilho em cima à esquerda).
  function ell(g, x, y, rx, ry, col, o) {
    o = o || {};
    x = R(x); y = R(y); rx = Math.max(1, R(rx)); ry = Math.max(1, R(ry));
    const a = o.alpha;
    if (!o.noOutline) g.ellipse(x, y, rx + 1, ry + 1).fill(fillc(o.ink === undefined ? PAL.ink : o.ink, a === undefined ? 1 : Math.min(1, a + 0.3)));
    if (o.flat || rx < 3 || ry < 3) { g.ellipse(x, y, rx, ry).fill(fillc(col, a)); return; }
    g.ellipse(x, y, rx, ry).fill(fillc(o.shadow === undefined ? dark(col, 0.3) : o.shadow, a));
    g.ellipse(R(x - rx * 0.13), R(y - ry * 0.15), Math.max(1, R(rx * 0.85)), Math.max(1, R(ry * 0.83))).fill(fillc(col, a));
    if (!o.noHi && rx >= 4 && ry >= 4) g.ellipse(R(x - rx * 0.42), R(y - ry * 0.45), Math.max(1, R(rx * 0.2)), Math.max(1, R(ry * 0.15))).fill(fillc(o.hi === undefined ? light(col, 0.5) : o.hi, a));
  }
  function circ(g, x, y, r, col, o) { ell(g, x, y, r, r, col, o); }

  // Polígono com contorno por deslocamento de 1 pixel (funciona para qualquer forma).
  function poly(g, pts, col, o) {
    o = o || {};
    const flat = [];
    for (const p of pts) flat.push(R(p[0]), R(p[1]));
    if (!o.noOutline) {
      const ink = o.ink === undefined ? PAL.ink : o.ink;
      for (const [dx, dy] of OFFS) g.poly(shift(flat, dx, dy)).fill(fillc(ink, o.alpha === undefined ? 1 : Math.min(1, o.alpha + 0.3)));
    }
    g.poly(flat).fill(fillc(col, o.alpha));
    if (o.hiEdge) { // filete de brilho
      const p0 = pts[0], p1 = pts[1];
      g.moveTo(R(p0[0]) + 1, R(p0[1]) + 1).lineTo(R(p1[0]) + 1, R(p1[1]) + 1).stroke({ width: 1, color: light(col, 0.45) });
    }
  }
  const OFFS = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  function shift(flat, dx, dy) { const o = new Array(flat.length); for (let i = 0; i < flat.length; i += 2) { o[i] = flat[i] + dx; o[i + 1] = flat[i + 1] + dy; } return o; }

  // Tubo afunilado (tentáculos, caudas, caules) com contorno, sombra e faixa de luz.
  function tubePts(pts, w0, w1, off) {
    const n = pts.length, L = [], Rr = [];
    for (let i = 0; i < n; i++) {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
      let dx = b[0] - a[0], dy = b[1] - a[1];
      const len = Math.hypot(dx, dy) || 1;
      dx /= len; dy /= len;
      const w = (w0 + (w1 - w0) * (i / Math.max(1, n - 1))) / 2;
      const ox = -dy * (off || 0), oy = dx * (off || 0);
      L.push(pts[i][0] - dy * w + ox, pts[i][1] + dx * w + oy);
      Rr.push(pts[i][0] + dy * w + ox, pts[i][1] - dx * w + oy);
    }
    const out = L.slice();
    for (let i = Rr.length - 2; i >= 0; i -= 2) out.push(Rr[i], Rr[i + 1]);
    return out.map(R);
  }
  function tube(g, pts, w0, w1, col, o) {
    o = o || {};
    if (!o.noOutline) g.poly(tubePts(pts, w0 + 2, w1 + 2)).fill(fillc(PAL.ink, o.alpha === undefined ? 1 : Math.min(1, o.alpha + 0.3)));
    if (o.flat || w0 < 3) { g.poly(tubePts(pts, w0, w1)).fill(fillc(col, o.alpha)); return; }
    g.poly(tubePts(pts, w0, w1)).fill(fillc(dark(col, 0.3), o.alpha));
    g.poly(tubePts(pts, w0 * 0.6, w1 * 0.6, -w0 * 0.14)).fill(fillc(col, o.alpha));
    if (w0 >= 5) g.poly(tubePts(pts, Math.max(1, w0 * 0.16), Math.max(1, w1 * 0.16), -w0 * 0.26)).fill(fillc(light(col, 0.45), o.alpha));
  }
  // Linha grossa (com contorno opcional).
  function line(g, pts, w, col, o) {
    o = o || {};
    if (pts.length < 2) return;
    const draw = (ww, c) => { g.moveTo(R(pts[0][0]), R(pts[0][1])); for (let i = 1; i < pts.length; i++) g.lineTo(R(pts[i][0]), R(pts[i][1])); g.stroke({ width: ww, color: num(c), alpha: o.alpha === undefined ? 1 : o.alpha, cap: 'round', join: 'round' }); };
    if (o.outline) draw(w + 2, PAL.ink);
    draw(w, col);
  }
  function rect(g, x, y, w, h, col, o) {
    o = o || {};
    x = R(x); y = R(y); w = Math.max(1, R(w)); h = Math.max(1, R(h));
    if (!o.noOutline) g.rect(x - 1, y - 1, w + 2, h + 2).fill(fillc(o.ink === undefined ? PAL.ink : o.ink, o.alpha));
    g.rect(x, y, w, h).fill(fillc(col, o.alpha));
    if (o.bevel && w > 2 && h > 2) {
      g.rect(x, y, w, 1).fill(fillc(light(col, 0.35), o.alpha)); g.rect(x, y, 1, h).fill(fillc(light(col, 0.2), o.alpha));
      g.rect(x, y + h - 1, w, 1).fill(fillc(dark(col, 0.3), o.alpha)); g.rect(x + w - 1, y, 1, h).fill(fillc(dark(col, 0.2), o.alpha));
    }
  }
  function rrect(g, x, y, w, h, r, col, o) {
    o = o || {};
    x = R(x); y = R(y); w = Math.max(2, R(w)); h = Math.max(2, R(h)); r = Math.min(R(r), Math.floor(Math.min(w, h) / 2));
    if (!o.noOutline) g.roundRect(x - 1, y - 1, w + 2, h + 2, r + 1).fill(fillc(o.ink === undefined ? PAL.ink : o.ink, o.alpha));
    g.roundRect(x, y, w, h, r).fill(fillc(col, o.alpha));
    if (o.bevel && h > 3) {
      g.rect(x + r, y + 1, w - r * 2, 1).fill(fillc(light(col, 0.35), o.alpha));
      g.rect(x + r, y + h - 2, w - r * 2, 1).fill(fillc(dark(col, 0.28), o.alpha));
    }
  }
  function px(g, x, y, col, s, a) { g.rect(R(x), R(y), s || 1, s || 1).fill(fillc(col, a)); }

  // ---------------------------------------------------------------- varredura (estampas dentro de formas)
  // shape: { t: 'ell', x, y, rx, ry } ou { t: 'poly', pts }. fn(x, y) -> cor (número) ou null.
  function scanFill(g, shape, fn, alpha) {
    const rows = [];
    if (shape.t === 'ell') {
      const cx = R(shape.x), cy = R(shape.y), rx = Math.max(1, shape.rx), ry = Math.max(1, shape.ry);
      for (let y = Math.ceil(cy - ry); y <= Math.floor(cy + ry); y++) {
        const k = 1 - ((y - cy) * (y - cy)) / (ry * ry);
        if (k <= 0) continue;
        const hw = rx * Math.sqrt(k);
        rows.push([y, Math.ceil(cx - hw + 0.5), Math.floor(cx + hw - 0.5)]);
      }
    } else {
      const pts = shape.pts;
      let y0 = Infinity, y1 = -Infinity;
      for (const p of pts) { y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
      for (let y = Math.ceil(y0); y <= Math.floor(y1); y++) {
        const xs = [];
        for (let i = 0; i < pts.length; i++) {
          const a = pts[i], b = pts[(i + 1) % pts.length];
          if ((a[1] <= y && b[1] > y) || (b[1] <= y && a[1] > y)) xs.push(a[0] + ((y - a[1]) / (b[1] - a[1])) * (b[0] - a[0]));
        }
        xs.sort((p, q) => p - q);
        for (let i = 0; i + 1 < xs.length; i += 2) rows.push([y, Math.ceil(xs[i]), Math.floor(xs[i + 1])]);
      }
    }
    for (const [y, xa, xb] of rows) {
      let runC = null, runX = 0;
      for (let x = xa; x <= xb + 1; x++) {
        const c = x <= xb ? fn(x, y) : null;
        if (c !== runC) {
          if (runC !== null && runC !== undefined) g.rect(runX, y, x - runX, 1).fill(fillc(runC, alpha));
          runC = c; runX = x;
        }
      }
    }
  }

  // ---------------------------------------------------------------- fonte em pixel 5x7
  const GLYPH = {
    A: [14, 17, 17, 31, 17, 17, 17], B: [30, 17, 17, 30, 17, 17, 30], C: [14, 17, 16, 16, 16, 17, 14], D: [30, 17, 17, 17, 17, 17, 30],
    E: [31, 16, 16, 30, 16, 16, 31], F: [31, 16, 16, 30, 16, 16, 16], G: [14, 17, 16, 23, 17, 17, 15], H: [17, 17, 17, 31, 17, 17, 17],
    I: [14, 4, 4, 4, 4, 4, 14], J: [7, 2, 2, 2, 2, 18, 12], K: [17, 18, 20, 24, 20, 18, 17], L: [16, 16, 16, 16, 16, 16, 31],
    M: [17, 27, 21, 21, 17, 17, 17], N: [17, 17, 25, 21, 19, 17, 17], O: [14, 17, 17, 17, 17, 17, 14], P: [30, 17, 17, 30, 16, 16, 16],
    Q: [14, 17, 17, 17, 21, 18, 13], R: [30, 17, 17, 30, 20, 18, 17], S: [15, 16, 16, 14, 1, 1, 30], T: [31, 4, 4, 4, 4, 4, 4],
    U: [17, 17, 17, 17, 17, 17, 14], V: [17, 17, 17, 17, 17, 10, 4], W: [17, 17, 17, 21, 21, 21, 10], X: [17, 17, 10, 4, 10, 17, 17],
    Y: [17, 17, 17, 10, 4, 4, 4], Z: [31, 1, 2, 4, 8, 16, 31],
    0: [14, 17, 19, 21, 25, 17, 14], 1: [4, 12, 4, 4, 4, 4, 14], 2: [14, 17, 1, 2, 4, 8, 31], 3: [31, 2, 4, 2, 1, 17, 14],
    4: [2, 6, 10, 18, 31, 2, 2], 5: [31, 16, 30, 1, 1, 17, 14], 6: [6, 8, 16, 30, 17, 17, 14], 7: [31, 1, 2, 4, 8, 8, 8],
    8: [14, 17, 17, 14, 17, 17, 14], 9: [14, 17, 17, 15, 1, 2, 12],
    ' ': [0, 0, 0, 0, 0, 0, 0], '.': [0, 0, 0, 0, 0, 12, 12], ',': [0, 0, 0, 0, 12, 4, 8], '!': [4, 4, 4, 4, 4, 0, 4],
    '?': [14, 17, 1, 2, 4, 0, 4], ':': [0, 12, 12, 0, 12, 12, 0], ';': [0, 12, 12, 0, 12, 4, 8], '-': [0, 0, 0, 31, 0, 0, 0],
    '+': [0, 4, 4, 31, 4, 4, 0], '=': [0, 0, 31, 0, 31, 0, 0], '/': [0, 1, 2, 4, 8, 16, 0], '%': [24, 25, 2, 4, 8, 19, 3],
    '(': [2, 4, 8, 8, 8, 4, 2], ')': [8, 4, 2, 2, 2, 4, 8], "'": [4, 4, 8, 0, 0, 0, 0], '"': [10, 10, 0, 0, 0, 0, 0],
    '’': [4, 4, 8, 0, 0, 0, 0], '#': [10, 10, 31, 10, 31, 10, 10], '*': [0, 4, 21, 14, 21, 4, 0], 'º': [6, 9, 6, 0, 15, 0, 0], '&': [12, 18, 20, 8, 21, 18, 13], '_': [0, 0, 0, 0, 0, 0, 31],
  };
  const ACC = { acute: [2, 4], grave: [8, 4], circ: [4, 10], tilde: [13, 22], diaer: [10, 0] };
  const DECOMP = {
    'Á': ['A', 'acute'], 'À': ['A', 'grave'], 'Â': ['A', 'circ'], 'Ã': ['A', 'tilde'], 'É': ['E', 'acute'], 'Ê': ['E', 'circ'],
    'Í': ['I', 'acute'], 'Ó': ['O', 'acute'], 'Ô': ['O', 'circ'], 'Õ': ['O', 'tilde'], 'Ú': ['U', 'acute'], 'Ü': ['U', 'diaer'], 'Ç': ['C', 'cedil'],
  };
  const ADV = 6, LH = 10;
  function supports(ch) { ch = String(ch).toUpperCase(); return !!(GLYPH[ch] || DECOMP[ch]); }
  function measure(str, scale) { return Math.max(0, String(str).length * ADV - 1) * (scale || 1); }
  // Desenha texto (sempre em maiúsculas). o: { scale, align: 'left'|'center'|'right', shadow (cor), alpha }
  function text(g, str, x, y, col, o) {
    o = o || {};
    const s = o.scale || 1;
    str = String(str).toUpperCase();
    const w = measure(str, s);
    let cx = R(o.align === 'center' ? x - w / 2 : o.align === 'right' ? x - w : x);
    y = R(y);
    const draw = (ox, oy, c) => {
      let xx = cx + ox;
      for (const chRaw of str) {
        let ch = chRaw, acc = null;
        if (DECOMP[ch]) { acc = DECOMP[ch][1]; ch = DECOMP[ch][0]; }
        const gl = GLYPH[ch] || GLYPH['?'];
        for (let r = 0; r < 7; r++) {
          const bits = gl[r];
          if (!bits) continue;
          let run = -1;
          for (let b = 0; b <= 5; b++) {
            const on = b < 5 && (bits >> (4 - b)) & 1;
            if (on && run < 0) run = b;
            if (!on && run >= 0) { g.rect(xx + run * s, y + oy + r * s, (b - run) * s, s).fill(fillc(c, o.alpha)); run = -1; }
          }
        }
        if (acc === 'cedil') g.rect(xx + 2 * s, y + oy + 7 * s, s, s).fill(fillc(c, o.alpha));
        else if (acc) {
          const ab = ACC[acc];
          for (let r = 0; r < 2; r++) for (let b = 0; b < 5; b++) if ((ab[r] >> (4 - b)) & 1) g.rect(xx + b * s, y + oy - (2 - r) * s - s, s, s).fill(fillc(c, o.alpha));
        }
        xx += ADV * s;
      }
    };
    if (o.shadow !== undefined) draw(s, s, o.shadow);
    draw(0, 0, col);
    return w;
  }
  // Quebra texto em linhas que caibam em maxW pixels.
  function wrap(str, maxW, scale) {
    const words = String(str).split(/\s+/);
    const lines = [];
    let cur = '';
    for (const w of words) {
      const t = cur ? cur + ' ' + w : w;
      if (measure(t, scale) > maxW && cur) { lines.push(cur); cur = w; } else cur = t;
    }
    if (cur) lines.push(cur);
    return lines;
  }

  // ---------------------------------------------------------------- PixiJS
  let app = null;
  async function init(canvas) {
    if (!root.PIXI) throw new Error('PixiJS não carregou');
    PIXI.TextureSource.defaultOptions.scaleMode = 'nearest';
    app = new PIXI.Application();
    await app.init({ canvas: canvas || undefined, width: 320, height: 200, autoStart: false, antialias: false, resolution: 1, autoDensity: false, background: CSS.navy, preference: 'webgl', powerPreference: 'high-performance', hello: false });
    return app;
  }
  // Desenha com fn(g) e devolve um canvas w x h (para miniaturas na interface).
  function snapshot(fn, w, h) {
    const g = new PIXI.Graphics();
    fn(g);
    const c = app.renderer.extract.canvas({ target: g, frame: new PIXI.Rectangle(0, 0, w, h), clearColor: [0, 0, 0, 0] });
    g.destroy();
    return c;
  }
  function snapshotURL(fn, w, h) { return snapshot(fn, w, h).toDataURL(); }

  // ---------------------------------------------------------------- ícones em pixel art (11x11)
  // Letras: k tinta, w branco, y amarelo, o laranja, r vermelho, g verde, b azul, c ciano, s prata, p rosa, d escuro, t marrom.
  const ICON_COL = { k: PAL.ink, w: PAL.white, y: PAL.yellow, o: PAL.orange, r: PAL.red, g: PAL.green, b: PAL.sky, c: PAL.cyan, s: PAL.silver, p: PAL.pink, d: PAL.slate, t: PAL.wood, l: PAL.lime, u: PAL.purple };
  const ICONS = {
    coin: ['...kkkkk...', '..kyyyyyk..', '.kyywwyyyk.', 'kyywyyyyyok', 'kyywyyyyyok', 'kyywyyyyyok', 'kyyywyyyook', 'kyyyyyyyook', '.kyyyyyook.', '..kooooook.', '...kkkkk...'],
    medal: ['.kkk...kkk.', '.kbk...krk.', '..kbk.krk..', '...kbkrk...', '...kkkkk...', '..kyyyyyk..', '.kyywyyyyk.', '.kyywyyyok.', '.kyyyyyook.', '..kooooook.', '...kkkkk...'],
    pill: ['......kkk..', '.....kwwwk.', '....kwrrrk.', '...kwrrrrk.', '..kwrrrrk..', '.kkkkkkk...', 'kwwwwwk....', 'kwwwwk.....', 'kwwwk......', '.kkk.......', '...........'],
    letter: ['...........', 'kkkkkkkkkkk', 'kkwwwwwwwkk', 'kwkwwwwwkwk', 'kwwkwwwkwwk', 'kwwwkkkwwwk', 'kwwwwwwwwwk', 'kwwwwwwwwwk', 'kwwwwwwwwwk', 'kkkkkkkkkkk', '...........'],
    cart: ['kk.........', '.k.........', '.kkkkkkkkkk', '.kyyyyyyyk.', '..kyyyyyyk.', '..kyyyyyk..', '..kkkkkkk..', '..k........', '..kkkkkkk..', '..kk...kk..', '...........'],
    book: ['...........', 'kkkkk.kkkkk', 'kbbbbkpppwk', 'kbbbbkpppwk', 'kbwbbkpwppk', 'kbbbbkpppwk', 'kbbwbkppppk', 'kbbbbkpppwk', 'kbbbbkpppwk', 'kkkkkkkkkkk', '...........'],
    camera: ['...........', '...kkkk....', '..kssssk...', 'kkkkkkkkkkk', 'kdddkkkdddk', 'kddkcwckddk', 'kddkccckddk', 'kdddkkkdddk', 'kdddddddddk', 'kkkkkkkkkkk', '...........'],
    full: ['kkkk...kkkk', 'kwwk...kwwk', 'kwk.....kwk', 'kk.......kk', '...........', '...........', '...........', 'kk.......kk', 'kwk.....kwk', 'kwwk...kwwk', 'kkkk...kkkk'],
    menu: ['...........', 'kkkkkkkkkkk', 'kwwwwwwwwwk', 'kkkkkkkkkkk', '...........', 'kkkkkkkkkkk', 'kwwwwwwwwwk', 'kkkkkkkkkkk', '...........', 'kkkkkkkkkkk', 'kwwwwwwwwwk'],
    dice: ['kkkkkkkkkkk', 'kwwwwwwwwwk', 'kwkkwwwkkwk', 'kwkkwwwkkwk', 'kwwwwwwwwwk', 'kwwwwkwwwwk', 'kwwwwwwwwwk', 'kwkkwwwkkwk', 'kwkkwwwkkwk', 'kwwwwwwwwwk', 'kkkkkkkkkkk'],
    copy: ['kkkkkkk....', 'kwwwwwk....', 'kwkkkkkkkkk', 'kwkwwwwwwwk', 'kwkwkkkkwwk', 'kwkwwwwwwwk', 'kkkwkkkkwwk', '..kwwwwwwwk', '..kwkkkwwwk', '..kwwwwwwwk', '..kkkkkkkkk'],
    paste: ['...kkkkk...', 'kkkkyyykkkk', 'ktttkkktttk', 'ktwwwwwwwtk', 'ktwkkkkkwtk', 'ktwwwwwwwtk', 'ktwkkkkwwtk', 'ktwwwwwwwtk', 'ktwkkkwwwtk', 'ktwwwwwwwtk', 'kkkkkkkkkkk'],
    close: ['kk.......kk', 'kwk.....kwk', '.kwk...kwk.', '..kwk.kwk..', '...kwkwk...', '....kwk....', '...kwkwk...', '..kwk.kwk..', '.kwk...kwk.', 'kwk.....kwk', 'kk.......kk'],
    check: ['.........kk', '........kgk', '.......kgk.', '......kgk..', 'kk...kgk...', 'kgk.kgk....', '.kgkgk.....', '..kgk......', '...k.......', '...........', '...........'],
    cross: ['...........', 'kk.......kk', 'krk.....krk', '.krk...krk.', '..krk.krk..', '...krrrk...', '..krk.krk..', '.krk...krk.', 'krk.....krk', 'kk.......kk', '...........'],
    lock: ['...kkkkk...', '..kk...kk..', '..k.....k..', '..k.....k..', 'kkkkkkkkkkk', 'kyyyyyyyyyk', 'kyyyykyyyyk', 'kyyyykyyyyk', 'kyyyyyyyyyk', 'koooooooook', 'kkkkkkkkkkk'],
    syringe: ['.........kk', '........kwk', '.......kwk.', '...kkkkkk..', '..kccccck..', '.kpppcck...', 'kpppppk....', 'kpppppk....', '.kkpppk....', '.k.kkk.....', 'k..........'],
    flask: ['...kkkkk...', '....kwk....', '....kwk....', '....kwk....', '...kwwwk...', '..kwwwwwk..', '.kgggggggk.', '.kgglggggk.', 'kgggggglggk', 'kgggggggggk', '.kkkkkkkkk.'],
    jar: ['..kkkkkkk..', '..krrrrrk..', '.kkkkkkkkk.', '.kcwccccck.', '.kcwcpccck.', '.kcwppppck.', '.kccpppcck.', '.kcccpccck.', '.kccccccck.', '.kkkkkkkkk.', '...........'],
    house: ['.....k.....', '....krk....', '...krrrk...', '..krrrrrk..', '.krrrrrrrk.', 'kkkkkkkkkkk', '.kwwwwwwwk.', '.kwkkwkkwk.', '.kwkkwkkwk.', '.kwwwkkwwk.', '.kkkkkkkkk.'],
    shuffle: ['.......k...', 'kkk....kk..', '...k.kkkkk.', '....k..kk..', '.....k.k...', '....k......', '...k.k.k...', 'kkk...kkk..', '......kkkk.', '.......kk..', '.......k...'],
    wrench: ['......kkk..', '.....kssk..', '.....ksk...', '.....kssk.k', '....kssssk.', '...ksssk...', '..ksssk....', '.ksssk.....', 'kssk.......', 'ksk........', 'kk.........'],
    trash: ['...kkkkk...', 'kkkkkkkkkkk', 'kssssssssk.', '.kdsdsdsdk.', '.kdsdsdsdk.', '.kdsdsdsdk.', '.kdsdsdsdk.', '.kdsdsdsdk.', '.kdsdsdsdk.', '.kkkkkkkkk.', '...........'],
    spark: ['.....k.....', '....kyk....', '....kyk....', '.kk.kyk.kk.', 'kyyykwkyyyk', '.kk.kyk.kk.', '....kyk....', '....kyk....', '.....k.....', '...........', '...........'],
    download: ['....kkk....', '....kwk....', '....kwk....', '....kwk....', '.kkkkwkkkk.', '..kwwwwwk..', '...kwwwk...', '....kwk....', '.....k.....', 'kkkkkkkkkkk', 'kwwwwwwwwwk'],
    chevron: ['...........', '...........', 'kk.......kk', 'kwk.....kwk', '.kwk...kwk.', '..kwk.kwk..', '...kwkwk...', '....kwk....', '.....k.....', '...........', '...........'],
    play: ['kk.........', 'kwkk.......', 'kwwwkk.....', 'kwwwwwkk...', 'kwwwwwwwkk.', 'kwwwwwwwwwk', 'kwwwwwwwkk.', 'kwwwwwkk...', 'kwwwkk.....', 'kwkk.......', 'kk.........'],
    info: ['...kkkkk...', '..kbbbbbk..', '.kbbbwbbbk.', 'kbbbbbbbbbk', 'kbbbwwbbbbk', 'kbbbbwbbbbk', 'kbbbbwbbbbk', 'kbbbwwwbbbk', '.kbbbbbbbk.', '..kbbbbbk..', '...kkkkk...'],
    star: ['.....k.....', '....kyk....', '....kyk....', 'kkkkkyykkkk', '.kyyyyyyyk.', '..kyyyyyk..', '..kyyyyyk..', '.kyyykyyyk.', '.kyk...kyk.', 'kk.......kk', '...........'],
  };
  const iconCache = {};
  function icon(name, scale) {
    const key = name + ':' + (scale || 2);
    if (iconCache[key]) return iconCache[key];
    const rows = ICONS[name] || ICONS.info;
    const s = scale || 2;
    const url = snapshotURL((g) => {
      rows.forEach((row, y) => { for (let x = 0; x < row.length; x++) { const c = ICON_COL[row[x]]; if (c !== undefined) g.rect(x * s, y * s, s, s).fill(c); } });
    }, 11 * s, 11 * s);
    iconCache[key] = url;
    return url;
  }

  MX.Pix = {
    PAL, CSS, Q, setQuality, num, mix, light, dark, hex,
    ell, circ, poly, tube, tubePts, line, rect, rrect, px, scanFill,
    text, measure, wrap, supports, LH, init, snapshot, snapshotURL, icon, ICONS,
    get app() { return app; },
  };
})(typeof window !== 'undefined' ? window : globalThis);
