// Amalgamations — core utilities shared by every module.
// Classic script: attaches to the global AM namespace (window in the browser, globalThis in Node tests).
(function (root) {
  'use strict';
  const AM = root.AM || (root.AM = {});

  // ---------- hashing & seeded randomness ----------
  function hashStr(str) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    h ^= h >>> 13; h = Math.imul(h, 0x5bd1e995); h ^= h >>> 15;
    return h >>> 0;
  }
  function hash2(x, y, seed) {
    let h = (seed | 0) ^ Math.imul(x | 0, 0x27d4eb2d) ^ Math.imul(y | 0, 0x165667b1);
    h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
    h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
    return (h ^ (h >>> 16)) >>> 0;
  }
  function hash01(x, y, seed) { return hash2(x, y, seed) / 4294967296; }

  function mulberry32(a) {
    a = a >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  // RNG object with helpers. Accepts a number or a string seed.
  function makeRng(seed) {
    const next = mulberry32(typeof seed === 'string' ? hashStr(seed) : seed >>> 0);
    const r = {
      next,
      range: (a, b) => a + (b - a) * next(),
      int: (a, b) => a + Math.floor(next() * (b - a + 1)),
      chance: (p) => next() < p,
      pick: (arr) => arr[Math.floor(next() * arr.length)],
      // U-shaped value in [0,1]: usually close to 0 or 1, rarely 0.5. Used so a fused feature
      // leans clearly towards one parent instead of an obvious average.
      ushape: () => { const u = next(); const k = next() * 0.42; return u < 0.5 ? k * k * 1.2 : 1 - k * k * 1.2; },
      weighted: (items, wfn) => {
        let total = 0;
        for (const it of items) total += Math.max(0, wfn(it));
        if (total <= 0) return items[Math.floor(next() * items.length)];
        let x = next() * total;
        for (const it of items) { x -= Math.max(0, wfn(it)); if (x <= 0) return it; }
        return items[items.length - 1];
      },
      shuffle: (arr) => {
        for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(next() * (i + 1)); const t = arr[i]; arr[i] = arr[j]; arr[j] = t; }
        return arr;
      },
    };
    return r;
  }

  // ---------- 2D simplex noise (seeded) ----------
  function createNoise2D(seed) {
    const rng = mulberry32(seed >>> 0);
    const perm = new Uint8Array(512);
    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) p[i] = i;
    for (let i = 255; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); const t = p[i]; p[i] = p[j]; p[j] = t; }
    for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
    const grad = [[1, 1], [-1, 1], [1, -1], [-1, -1], [1, 0], [-1, 0], [0, 1], [0, -1]];
    const F2 = 0.5 * (Math.sqrt(3) - 1), G2 = (3 - Math.sqrt(3)) / 6;
    return function (xin, yin) {
      const s = (xin + yin) * F2;
      const i = Math.floor(xin + s), j = Math.floor(yin + s);
      const t = (i + j) * G2;
      const x0 = xin - (i - t), y0 = yin - (j - t);
      const i1 = x0 > y0 ? 1 : 0, j1 = x0 > y0 ? 0 : 1;
      const x1 = x0 - i1 + G2, y1 = y0 - j1 + G2;
      const x2 = x0 - 1 + 2 * G2, y2 = y0 - 1 + 2 * G2;
      const ii = i & 255, jj = j & 255;
      let n0 = 0, n1 = 0, n2 = 0;
      let t0 = 0.5 - x0 * x0 - y0 * y0;
      if (t0 > 0) { const g = grad[perm[ii + perm[jj]] & 7]; t0 *= t0; n0 = t0 * t0 * (g[0] * x0 + g[1] * y0); }
      let t1 = 0.5 - x1 * x1 - y1 * y1;
      if (t1 > 0) { const g = grad[perm[ii + i1 + perm[jj + j1]] & 7]; t1 *= t1; n1 = t1 * t1 * (g[0] * x1 + g[1] * y1); }
      let t2 = 0.5 - x2 * x2 - y2 * y2;
      if (t2 > 0) { const g = grad[perm[ii + 1 + perm[jj + 1]] & 7]; t2 *= t2; n2 = t2 * t2 * (g[0] * x2 + g[1] * y2); }
      return 70 * (n0 + n1 + n2); // roughly [-1, 1]
    };
  }
  function fbm(noise, x, y, octaves, lac, gain) {
    let a = 1, f = 1, s = 0, n = 0;
    for (let i = 0; i < octaves; i++) { s += a * noise(x * f, y * f); n += a; a *= gain || 0.5; f *= lac || 2; }
    return s / n;
  }

  // ---------- math ----------
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const invLerp = (a, b, v) => (v - a) / (b - a);
  const smooth = (t) => t * t * (3 - 2 * t);
  const dist = (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz);
  const dist2 = (ax, az, bx, bz) => (ax - bx) * (ax - bx) + (az - bz) * (az - bz);
  function wrapAngle(a) { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; }
  function approachAngle(a, b, step) { const d = wrapAngle(b - a); return Math.abs(d) <= step ? b : a + Math.sign(d) * step; }
  const logLerp = (a, b, t) => Math.exp(lerp(Math.log(Math.max(1e-4, a)), Math.log(Math.max(1e-4, b)), t));
  const round2 = (v) => Math.round(v * 100) / 100;

  // ---------- colour (sRGB <-> OKLab) ----------
  function hexToRgb(hex) {
    const h = hex.replace('#', '');
    const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => v / 255);
  }
  function rgbToHex(rgb) {
    return '#' + rgb.map((v) => Math.round(clamp(v, 0, 1) * 255).toString(16).padStart(2, '0')).join('');
  }
  const toLin = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  const toSrgb = (c) => (c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(Math.max(0, c), 1 / 2.4) - 0.055);
  function rgbToOklab(rgb) {
    const r = toLin(rgb[0]), g = toLin(rgb[1]), b = toLin(rgb[2]);
    const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
    const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
    const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
    return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
  }
  function oklabToRgb(lab) {
    const l = Math.pow(lab[0] + 0.3963377774 * lab[1] + 0.2158037573 * lab[2], 3);
    const m = Math.pow(lab[0] - 0.1055613458 * lab[1] - 0.0638541728 * lab[2], 3);
    const s = Math.pow(lab[0] - 0.0894841775 * lab[1] - 1.291485548 * lab[2], 3);
    return [toSrgb(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s), toSrgb(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s), toSrgb(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s)];
  }
  const hexToLab = (h) => rgbToOklab(hexToRgb(h));
  const labToHex = (l) => rgbToHex(oklabToRgb(l));
  function mixColor(a, b, t) { const A = hexToLab(a), B = hexToLab(b); return labToHex([lerp(A[0], B[0], t), lerp(A[1], B[1], t), lerp(A[2], B[2], t)]); }
  function lightness(hex) { return hexToLab(hex)[0]; }
  // Changing lightness can push a saturated colour out of the sRGB gamut, so chroma is limited too.
  function limitChroma(c) {
    const ch = Math.hypot(c[1], c[2]);
    const max = 0.04 + 0.5 * c[0] * (1 - c[0]);
    if (ch > max) { c[1] *= max / ch; c[2] *= max / ch; }
    return c;
  }
  function setLightness(hex, L) { const c = hexToLab(hex); c[0] = clamp(L, 0, 1); return labToHex(limitChroma(c)); }
  function shade(hex, dl) { const c = hexToLab(hex); c[0] = clamp(c[0] + dl, 0, 1); return labToHex(limitChroma(c)); }
  // Rotate hue towards another colour's hue by fraction t (keeps chroma and lightness).
  function hueToward(hex, target, t) {
    const a = hexToLab(hex), b = hexToLab(target);
    const ca = Math.hypot(a[1], a[2]), cb = Math.hypot(b[1], b[2]);
    if (ca < 0.02 || cb < 0.02) return hex;
    const ha = Math.atan2(a[2], a[1]), hb = Math.atan2(b[2], b[1]);
    const h = ha + wrapAngle(hb - ha) * t;
    return labToHex([a[0], Math.cos(h) * ca, Math.sin(h) * ca]);
  }
  const isHex = (s) => typeof s === 'string' && /^#[0-9a-f]{6}$/i.test(s);

  // ---------- events ----------
  function makeBus() {
    const map = new Map();
    return {
      on(ev, fn) { if (!map.has(ev)) map.set(ev, new Set()); map.get(ev).add(fn); return () => map.get(ev).delete(fn); },
      emit(ev, a, b, c) { const s = map.get(ev); if (s) for (const fn of s) fn(a, b, c); },
      clear() { map.clear(); },
    };
  }

  // ---------- formatting ----------
  function fmt(n) {
    n = Math.round(n);
    const a = Math.abs(n);
    if (a >= 1e9) return (n / 1e9).toFixed(1).replace(/\.0$/, '') + 'B';
    if (a >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
    if (a >= 1e4) return (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'k';
    return String(n);
  }
  function fmtTime(sec) {
    sec = Math.floor(sec);
    const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
    return h > 0 ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m ${String(s).padStart(2, '0')}s`;
  }
  let uidCounter = 1;
  const uid = (p) => (p || 'u') + (uidCounter++).toString(36) + Math.floor(Math.random() * 1e6).toString(36);
  const deepCopy = (o) => JSON.parse(JSON.stringify(o));

  Object.assign(AM, {
    hashStr, hash2, hash01, mulberry32, makeRng, createNoise2D, fbm,
    clamp, lerp, invLerp, smooth, dist, dist2, wrapAngle, approachAngle, logLerp, round2,
    hexToRgb, rgbToHex, rgbToOklab, oklabToRgb, hexToLab, labToHex, mixColor, lightness, setLightness, shade, hueToward, isHex,
    makeBus, fmt, fmtTime, uid, deepCopy,
  });
  if (typeof module !== 'undefined' && module.exports) module.exports = AM;
})(typeof window !== 'undefined' ? window : globalThis);
