// core.js — namespace, seeded RNG and math helpers. No DOM: also loaded by the Node tests.
(function () {
  'use strict';
  const RB = (globalThis.RB = globalThis.RB || {});
  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (t) => { t = clamp01(t); return t * t * (3 - 2 * t); };
  const wrapAngle = (a) => { a = (a + Math.PI) % TAU; if (a < 0) a += TAU; return a - Math.PI; };
  const dist = (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay);
  const approach = (v, target, step) => (v < target ? Math.min(target, v + step) : Math.max(target, v - step));

  function hashStr(str) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  // Integer hash of a 2D cell and a seed, as a float in [0, 1).
  function hash2(x, y, seed) {
    let h = (Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul((seed | 0) + 1, 1274126177)) >>> 0;
    h = Math.imul(h ^ (h >>> 13), 1103515245) >>> 0;
    h = (h ^ (h >>> 16)) >>> 0;
    return h / 4294967296;
  }

  // mulberry32: small, fast and good enough; the whole state is one uint32, so it serialises.
  class Rng {
    constructor(seed) { this.s = (seed >>> 0) || 0x9e3779b9; }
    next() {
      this.s = (this.s + 0x6d2b79f5) >>> 0;
      let t = this.s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
    range(a, b) { return a + (b - a) * this.next(); }
    int(a, b) { return a + Math.floor(this.next() * (b - a + 1)); } // inclusive
    chance(p) { return this.next() < p; }
    pick(arr) { return arr[Math.floor(this.next() * arr.length)]; }
    gauss() { // Box–Muller
      let u = 0; while (u < 1e-9) u = this.next();
      return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * this.next());
    }
    shuffle(arr) {
      for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(this.next() * (i + 1)); const t = arr[i]; arr[i] = arr[j]; arr[j] = t; }
      return arr;
    }
    weighted(items, weightOf) {
      let total = 0; for (const it of items) total += Math.max(0, weightOf(it));
      if (total <= 0) return items[0];
      let r = this.next() * total;
      for (const it of items) { r -= Math.max(0, weightOf(it)); if (r <= 0) return it; }
      return items[items.length - 1];
    }
    fork(tag) { return new Rng((this.s ^ hashStr(String(tag))) >>> 0); }
  }

  // hsl in 0..1 each -> css string
  function hsl(h, s, l, a) {
    h = ((h % 1) + 1) % 1;
    const H = Math.round(h * 360), S = Math.round(clamp01(s) * 100), L = Math.round(clamp01(l) * 100);
    return a === undefined ? `hsl(${H},${S}%,${L}%)` : `hsla(${H},${S}%,${L}%,${a})`;
  }

  let uidCounter = 1;
  const uid = (prefix) => (prefix || 'id') + (uidCounter++).toString(36) + Math.floor(Math.random() * 1e6).toString(36);

  RB.core = { TAU, clamp, clamp01, lerp, smooth, wrapAngle, dist, approach, hashStr, hash2, Rng, hsl, uid };
})();
