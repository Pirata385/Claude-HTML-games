// Low-resolution pixel buffer and drawing primitives: shaded balls, discs,
// ellipses, lines, polygons, dithering and a 3x5 bitmap font.
(function (XS) {
  'use strict';

  // ---------------------------------------------------------------- screen
  class Screen {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d', { alpha: false });
      this.W = 320; this.H = 180; this.scale = 1;
    }
    // Pick an integer scale so the short side is ~targetShort pixels.
    resize(cssW, cssH, targetShort = 215) {
      const short = Math.min(cssW, cssH);
      const scale = Math.max(1, Math.round(short / targetShort));
      this.scale = scale;
      this.W = Math.ceil(cssW / scale);
      this.H = Math.ceil(cssH / scale);
      this.canvas.width = this.W;
      this.canvas.height = this.H;
      this.canvas.style.width = this.W * scale + 'px';
      this.canvas.style.height = this.H * scale + 'px';
      this.ctx.imageSmoothingEnabled = false;
    }
    // CSS pixel -> buffer pixel.
    toBuffer(cssX, cssY) { return { x: cssX / this.scale, y: cssY / this.scale }; }
  }

  function makeCanvas(w, h) {
    if (typeof OffscreenCanvas !== 'undefined' && typeof document === 'undefined') return new OffscreenCanvas(w, h);
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    return c;
  }

  // --------------------------------------------------------------- dithering
  const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  const bayer = (x, y) => (BAYER4[(y & 3) * 4 + (x & 3)] + 0.5) / 16;

  const patternCache = new Map();
  // A repeating 4x4 pattern of `color` with coverage `level` (0..1).
  function ditherPattern(ctx, color, level) {
    const q = Math.max(0, Math.min(16, Math.round(level * 16)));
    const key = color + '|' + q;
    let p = patternCache.get(key);
    if (!p) {
      const c = makeCanvas(4, 4), g = c.getContext('2d');
      g.fillStyle = color;
      for (let i = 0; i < 16; i++) if (BAYER4[i] < q) g.fillRect(i % 4, i >> 2, 1, 1);
      p = ctx.createPattern(c, 'repeat');
      patternCache.set(key, p);
    }
    return p;
  }

  // ------------------------------------------------------------------ discs
  const inDisc = (dx, dy, r) => dx * dx + dy * dy < r * r + r * 0.8;
  const discCache = new Map();
  function discSprite(color, r) {
    const r2 = Math.max(1, Math.round(r * 2));
    const key = color + '|' + r2;
    let s = discCache.get(key);
    if (s) return s;
    const rr = r2 / 2, c = Math.ceil(rr), size = c * 2 + 1;
    const cv = makeCanvas(size, size), g = cv.getContext('2d');
    g.fillStyle = color;
    for (let y = -c; y <= c; y++) for (let x = -c; x <= c; x++) if (inDisc(x, y, rr)) g.fillRect(x + c, y + c, 1, 1);
    s = { cv, c };
    discCache.set(key, s);
    return s;
  }
  function disc(ctx, x, y, r, color) {
    const s = discSprite(color, r);
    ctx.drawImage(s.cv, Math.round(x) - s.c, Math.round(y) - s.c);
  }

  // Lit sphere using a 4-colour ramp (dark .. highlight), light from top-left.
  const ballCache = new Map();
  const L = (() => { const v = [-0.45, -0.62, 0.64], l = Math.hypot(...v); return v.map((a) => a / l); })();
  function ballSprite(ramp, r) {
    const r2 = Math.max(1, Math.round(r * 2));
    const key = ramp.join(',') + '|' + r2;
    let s = ballCache.get(key);
    if (s) return s;
    const rr = r2 / 2, c = Math.ceil(rr), size = c * 2 + 1;
    const cv = makeCanvas(size, size), g = cv.getContext('2d');
    for (let y = -c; y <= c; y++) {
      for (let x = -c; x <= c; x++) {
        if (!inDisc(x, y, rr)) continue;
        let col;
        if (rr <= 1) col = ramp[1];
        else {
          const nx = x / (rr + 0.5), ny = y / (rr + 0.5);
          const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
          const lam = nx * L[0] + ny * L[1] + nz * L[2] + (bayer(x + 8, y + 8) - 0.5) * 0.12;
          col = lam < 0.12 ? ramp[0] : lam < 0.55 ? ramp[1] : lam < 0.9 ? ramp[2] : ramp[3];
        }
        g.fillStyle = col;
        g.fillRect(x + c, y + c, 1, 1);
      }
    }
    s = { cv, c };
    ballCache.set(key, s);
    return s;
  }
  function ball(ctx, x, y, r, ramp) {
    const s = ballSprite(ramp, r);
    ctx.drawImage(s.cv, Math.round(x) - s.c, Math.round(y) - s.c);
  }

  // Filled ellipse (row spans). Used for iso shadows and telegraphs.
  function ellipse(ctx, cx, cy, rx, ry, fill) {
    if (rx < 0.5 || ry < 0.5) return;
    ctx.fillStyle = fill;
    const R = Math.ceil(ry);
    cx = Math.round(cx); cy = Math.round(cy);
    for (let dy = -R; dy <= R; dy++) {
      const t = 1 - (dy * dy) / (ry * ry);
      if (t < 0) continue;
      const hw = Math.round(rx * Math.sqrt(t));
      ctx.fillRect(cx - hw, cy + dy, hw * 2 + 1, 1);
    }
  }
  // Ellipse outline, optionally dashed (dash > 0 = segment length in steps).
  function ellipseRing(ctx, cx, cy, rx, ry, color, dash = 0, phase = 0) {
    ctx.fillStyle = color;
    const n = Math.max(16, Math.round((rx + ry) * 2.2));
    for (let i = 0; i < n; i++) {
      if (dash && Math.floor((i + phase) / dash) % 2) continue;
      const a = (i / n) * Math.PI * 2;
      ctx.fillRect(Math.round(cx + Math.cos(a) * rx), Math.round(cy + Math.sin(a) * ry), 1, 1);
    }
  }

  function line(ctx, x0, y0, x1, y1, color) {
    ctx.fillStyle = color;
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (let guard = 0; guard < 2000; guard++) {
      ctx.fillRect(x0, y0, 1, 1);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }
  function thickLine(ctx, x0, y0, x1, y1, r, color) {
    const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / Math.max(1, r * 0.8)));
    for (let i = 0; i <= n; i++) disc(ctx, x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n, r, color);
  }

  // Scanline polygon fill (even-odd), pts = [[x, y], ...].
  function poly(ctx, pts, color) {
    let minY = Infinity, maxY = -Infinity;
    for (const p of pts) { minY = Math.min(minY, p[1]); maxY = Math.max(maxY, p[1]); }
    ctx.fillStyle = color;
    for (let y = Math.ceil(minY - 0.5); y <= Math.floor(maxY - 0.5) + 1; y++) {
      const cy = y + 0.5, xs = [];
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const [xi, yi] = pts[i], [xj, yj] = pts[j];
        if ((yi > cy) !== (yj > cy)) xs.push(xi + ((cy - yi) / (yj - yi)) * (xj - xi));
      }
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        const a = Math.round(xs[k]), b = Math.round(xs[k + 1]);
        if (b > a) ctx.fillRect(a, y, b - a, 1);
      }
    }
  }

  // ------------------------------------------------------------------- font
  const GLYPHS = {
    '0': '111101101101111', '1': '010110010010111', '2': '111001111100111', '3': '111001111001111',
    '4': '101101111001001', '5': '111100111001111', '6': '111100111101111', '7': '111001010010010',
    '8': '111101111101111', '9': '111101111001111',
    A: '010101111101101', B: '110101110101110', C: '011100100100011', D: '110101101101110',
    E: '111100110100111', F: '111100110100100', G: '011100101101011', H: '101101111101101',
    I: '111010010010111', J: '001001001101010', K: '101101110101101', L: '100100100100111',
    M: '101111111101101', N: '110101101101101', O: '010101101101010', P: '110101110100100',
    Q: '010101101110011', R: '110101110101101', S: '011100010001110', T: '111010010010010',
    U: '101101101101111', V: '101101101101010', W: '101101111111101', X: '101101010101101',
    Y: '101101010010010', Z: '111001010100111',
    '+': '000010111010000', '-': '000000111000000', '!': '010010010000010', '?': '110001010000010',
    '.': '000000000000010', ',': '000000000010100', ':': '000010000010000', '%': '101001010100101',
    '/': '001001010100100', '×': '000101010101000', "'": '010010000000000', ' ': '000000000000000',
  };
  const ACCENTS = { Á: 'A', À: 'A', Â: 'A', Ã: 'A', É: 'E', Ê: 'E', Í: 'I', Ó: 'O', Ô: 'O', Õ: 'O', Ú: 'U', Ç: 'C' };
  const fontCache = new Map();
  function glyphSprite(ch, color) {
    const key = ch + color;
    let s = fontCache.get(key);
    if (s) return s;
    const bits = GLYPHS[ch] || GLYPHS['?'];
    s = makeCanvas(3, 5);
    const g = s.getContext('2d');
    g.fillStyle = color;
    for (let i = 0; i < 15; i++) if (bits[i] === '1') g.fillRect(i % 3, Math.floor(i / 3), 1, 1);
    fontCache.set(key, s);
    return s;
  }
  const textWidth = (str, k = 1) => Math.max(0, String(str).length * 4 - 1) * k;
  // Draw pixel text; align 'left' | 'center' | 'right'; outline colour
  // optional; k = integer glyph scale.
  function text(ctx, str, x, y, color, align = 'left', outline = null, k = 1) {
    const s = String(str).toUpperCase().replace(/[ÁÀÂÃÉÊÍÓÔÕÚÇ]/g, (c) => ACCENTS[c]);
    const x0 = Math.round(x - (align === 'center' ? textWidth(s, k) / 2 : align === 'right' ? textWidth(s, k) : 0));
    y = Math.round(y);
    if (outline) {
      for (const [ox, oy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [1, 1]]) {
        for (let i = 0; i < s.length; i++) ctx.drawImage(glyphSprite(s[i], outline), x0 + i * 4 * k + ox, y + oy, 3 * k, 5 * k);
      }
    }
    for (let i = 0; i < s.length; i++) ctx.drawImage(glyphSprite(s[i], color), x0 + i * 4 * k, y, 3 * k, 5 * k);
  }

  XS.Screen = Screen;
  XS.gfx = { makeCanvas, bayer, BAYER4, ditherPattern, disc, discSprite, ball, ballSprite, ellipse, ellipseRing, line, thickLine, poly, text, textWidth };
})(globalThis.XS = globalThis.XS || {});
