/* Seeded randomness: mulberry32, integer hashes and 1D/2D value noise. */
(function (root) {
  'use strict';
  const PA = root.PA = root.PA || {};
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function hash3(x, y, z, seed) {
    let h = (seed | 0) ^ 0x9E3779B9;
    h = Math.imul(h ^ (x | 0), 0x85EBCA6B);
    h = Math.imul(h ^ (h >>> 13) ^ (y | 0), 0xC2B2AE35);
    h = Math.imul(h ^ (h >>> 16) ^ (z | 0), 0x27D4EB2F);
    h ^= h >>> 15;
    return h >>> 0;
  }
  const h01 = (x, y, z, s) => hash3(x, y, z, s) / 4294967296;
  function noise1(x, seed) {
    const i = Math.floor(x), f = x - i, t = f * f * (3 - 2 * f);
    return h01(i, 0, 0, seed) * (1 - t) + h01(i + 1, 0, 0, seed) * t;
  }
  function noise2(x, y, seed) {
    const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
    const tx = fx * fx * (3 - 2 * fx), ty = fy * fy * (3 - 2 * fy);
    const a = h01(ix, iy, 1, seed), b = h01(ix + 1, iy, 1, seed), c = h01(ix, iy + 1, 1, seed), d = h01(ix + 1, iy + 1, 1, seed);
    return (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty;
  }
  function fbm1(x, seed, oct = 3) {
    let s = 0, amp = 1, tot = 0, f = 1;
    for (let o = 0; o < oct; o++) { s += noise1(x * f, seed + o * 101) * amp; tot += amp; amp *= 0.5; f *= 2; }
    return s / tot;
  }
  function seedFrom(str) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  class Rng {
    constructor(seed) { this.f = mulberry32(seed); }
    next() { return this.f(); }
    int(a, b) { return a + Math.floor(this.f() * (b - a + 1)); }
    range(a, b) { return a + this.f() * (b - a); }
    pick(arr) { return arr[Math.floor(this.f() * arr.length)]; }
    chance(p) { return this.f() < p; }
  }
  PA.RNG = { mulberry32, hash3, h01, noise1, noise2, fbm1, seedFrom, Rng };
  if (typeof module !== 'undefined' && module.exports) module.exports = PA.RNG;
})(typeof window !== 'undefined' ? window : globalThis);
