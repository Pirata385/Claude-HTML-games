/* Filogênese — utilitários: matemática, RNG com semente, ruído, cores e barramento de eventos. */
(function (FG) {
  'use strict';
  const U = FG.U = {};
  const TAU = U.TAU = Math.PI * 2;

  U.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  U.lerp = (a, b, t) => a + (b - a) * t;
  U.smooth = (t) => t * t * (3 - 2 * t);
  U.sstep = (a, b, x) => { const t = U.clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  U.dist = (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay);
  U.dist2 = (ax, ay, bx, by) => { const dx = bx - ax, dy = by - ay; return dx * dx + dy * dy; };
  U.angNorm = (a) => { a = (a + Math.PI) % TAU; if (a < 0) a += TAU; return a - Math.PI; };
  U.angDiff = (a, b) => U.angNorm(b - a);
  U.angTo = (a, b, max) => { const d = U.angDiff(a, b); return Math.abs(d) <= max ? b : a + Math.sign(d) * max; };
  U.approach = (v, target, step) => (v < target ? Math.min(target, v + step) : Math.max(target, v - step));

  U.ease = {
    outCubic: (t) => 1 - Math.pow(1 - t, 3),
    inOut: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
    outBack: (t) => { const c = 1.70158; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); },
    bump: (t) => Math.sin(Math.PI * U.clamp(t, 0, 1)),
  };

  // ---- hashing e RNG determinístico ----
  U.hash = (x, y, s) => {
    let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(s | 0, 1274126177);
    h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16;
    h = Math.imul(h, 2246822519);
    return (h ^ (h >>> 15)) >>> 0;
  };
  U.hashStr = (str) => {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  };
  U.rng = (seed) => {
    let s = seed >>> 0;
    const r = () => {
      s = (s + 0x6D2B79F5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    r.range = (a, b) => a + r() * (b - a);
    r.int = (a, b) => Math.floor(a + r() * (b - a + 1));
    r.pick = (arr) => arr[Math.floor(r() * arr.length)];
    r.chance = (p) => r() < p;
    r.shuffle = (arr) => { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); const t = arr[i]; arr[i] = arr[j]; arr[j] = t; } return arr; };
    return r;
  };

  // ---- ruído de gradiente 2D + fbm ----
  const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
  const K = TAU / 4294967296;
  function grad(ix, iy, dx, dy, seed) { const a = U.hash(ix, iy, seed) * K; return Math.cos(a) * dx + Math.sin(a) * dy; }
  U.noise = (x, y, seed) => {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const u = fade(xf), v = fade(yf);
    const a = grad(xi, yi, xf, yf, seed), b = grad(xi + 1, yi, xf - 1, yf, seed);
    const c = grad(xi, yi + 1, xf, yf - 1, seed), d = grad(xi + 1, yi + 1, xf - 1, yf - 1, seed);
    return U.clamp((a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v) * 0.7071 + 0.5, 0, 1);
  };
  /** Ruído de valor (sem trigonometria): mais barato, usado por pixel na textura do chão. */
  U.vnoise = (x, y, seed) => {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const a = U.hash(xi, yi, seed), b = U.hash(xi + 1, yi, seed), c = U.hash(xi, yi + 1, seed), d = U.hash(xi + 1, yi + 1, seed);
    return (a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v) / 4294967296;
  };
  U.fbm = (x, y, seed, oct) => {
    let amp = 0.5, f = 1, sum = 0, norm = 0;
    for (let i = 0; i < oct; i++) { sum += amp * U.noise(x * f, y * f, seed + i * 131); norm += amp; amp *= 0.5; f *= 2.02; }
    return sum / norm;
  };

  // ---- cores (HSL em arrays [h, s, l]) ----
  U.hsl = (c, dl, a) => {
    const l = U.clamp(c[2] + (dl || 0), 0, 100);
    return a == null || a >= 1 ? `hsl(${c[0] | 0} ${c[1] | 0}% ${l | 0}%)` : `hsl(${c[0] | 0} ${c[1] | 0}% ${l | 0}% / ${a})`;
  };
  U.hslMix = (a, b, t) => {
    const dh = ((b[0] - a[0] + 540) % 360) - 180;
    return [(a[0] + dh * t + 360) % 360, U.lerp(a[1], b[1], t), U.lerp(a[2], b[2], t)];
  };

  U.fmtTime = (sec) => {
    sec = Math.floor(sec);
    const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
    return (h ? h + ':' + String(m).padStart(2, '0') : String(m)) + ':' + String(s).padStart(2, '0');
  };
  U.cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

  // ---- barramento de eventos simples ----
  const handlers = {};
  FG.bus = {
    on(ev, fn) { (handlers[ev] = handlers[ev] || []).push(fn); },
    emit(ev, a, b, c, d) { const h = handlers[ev]; if (h) for (let i = 0; i < h.length; i++) h[i](a, b, c, d); },
  };
})(window.FG = window.FG || {});
