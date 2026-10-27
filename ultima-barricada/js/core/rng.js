// Seeded randomness: every random decision of the simulation goes through Rng so a seed
// always produces the same map and, given the same commands, the same match.
(function (UB) {
  'use strict';

  // FNV-1a hash of a string to a uint32 (seeds can be typed as text).
  function hashStr(str) {
    let h = 2166136261 >>> 0;
    const s = String(str);
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return h >>> 0;
  }

  // Integer hash of up to three ints, used for stateless per-tile noise.
  function hash3(a, b, c) {
    let h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263) + Math.imul(c | 0, 2147483647)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }

  // mulberry32: tiny, fast, good enough for games; the whole state is one uint32.
  function Rng(seed) {
    this.s = (seed >>> 0) || 0x9e3779b9;
  }
  Rng.prototype.next = function () {
    let t = (this.s = (this.s + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  Rng.prototype.range = function (a, b) { return a + (b - a) * this.next(); };
  Rng.prototype.int = function (a, b) { return a + Math.floor((b - a + 1) * this.next()); };
  Rng.prototype.chance = function (p) { return this.next() < p; };
  Rng.prototype.pick = function (arr) { return arr[Math.floor(this.next() * arr.length)]; };
  Rng.prototype.shuffle = function (arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  };
  // Weighted pick from [[item, weight], ...].
  Rng.prototype.weighted = function (pairs) {
    let total = 0;
    for (const p of pairs) total += p[1];
    let r = this.next() * total;
    for (const p of pairs) { r -= p[1]; if (r <= 0) return p[0]; }
    return pairs[pairs.length - 1][0];
  };

  // Smooth value noise in [0, 1] on a lattice, with fractal sum helper.
  function valueNoise(seed, x, y) {
    const xi = Math.floor(x), yi = Math.floor(y);
    const fx = x - xi, fy = y - yi;
    const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    const a = hash3(xi, yi, seed), b = hash3(xi + 1, yi, seed);
    const c = hash3(xi, yi + 1, seed), d = hash3(xi + 1, yi + 1, seed);
    return (a + (b - a) * sx) + ((c + (d - c) * sx) - (a + (b - a) * sx)) * sy;
  }
  function fbm(seed, x, y, octaves) {
    let sum = 0, amp = 1, norm = 0, f = 1;
    for (let o = 0; o < (octaves || 3); o++) {
      sum += valueNoise(seed + o * 101, x * f, y * f) * amp;
      norm += amp; amp *= 0.5; f *= 2;
    }
    return sum / norm;
  }

  UB.hashStr = hashStr;
  UB.hash3 = hash3;
  UB.Rng = Rng;
  UB.valueNoise = valueNoise;
  UB.fbm = fbm;
})(globalThis.UB = globalThis.UB || {});
