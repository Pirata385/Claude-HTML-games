// Seeded randomness: every procedural thing in Xenospire (beings, powers,
// arenas, lines of the Curator) is derived from a 32-bit seed so runs can be
// replayed and shared.
(function (XS) {
  'use strict';

  // FNV-1a string hash.
  function hashStr(str) {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return h >>> 0;
  }

  // Avalanche mixer (murmur3 finaliser).
  function mix32(h) {
    h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b);
    h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35);
    h ^= h >>> 16;
    return h >>> 0;
  }

  // Combine any number of integers / strings into one well-mixed seed.
  function hash(...parts) {
    let h = 0x9e3779b9;
    for (const p of parts) {
      const v = typeof p === 'number' ? (p | 0) : hashStr(String(p));
      h = mix32(h ^ v ^ (h << 6) ^ (h >>> 2));
    }
    return h;
  }

  // Cheap positional hash -> [0, 1) used for per-voxel / per-pixel variation.
  function hash3f(x, y, z) {
    return mix32(Math.imul(x | 0, 73856093) ^ Math.imul(y | 0, 19349663) ^ Math.imul(z | 0, 83492791)) / 4294967296;
  }

  // sfc32 generator seeded through splitmix32.
  class RNG {
    constructor(seed) {
      let s = (typeof seed === 'string' ? hashStr(seed) : seed) >>> 0;
      const sm = () => {
        s = (s + 0x9e3779b9) | 0;
        let z = s;
        z = Math.imul(z ^ (z >>> 16), 0x85ebca6b);
        z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35);
        return (z ^ (z >>> 16)) >>> 0;
      };
      this.a = sm(); this.b = sm(); this.c = sm(); this.d = sm();
      for (let i = 0; i < 12; i++) this.u32();
    }
    u32() {
      let { a, b, c, d } = this;
      const t = (((a + b) | 0) + d) | 0;
      d = (d + 1) | 0;
      a = b ^ (b >>> 9);
      b = (c + (c << 3)) | 0;
      c = (c << 21) | (c >>> 11);
      c = (c + t) | 0;
      this.a = a; this.b = b; this.c = c; this.d = d;
      return t >>> 0;
    }
    next() { return this.u32() / 4294967296; }
    range(a, b) { return a + (b - a) * this.next(); }
    int(a, b) { return a + Math.floor(this.next() * (b - a + 1)); }
    chance(p) { return this.next() < p; }
    sign() { return this.next() < 0.5 ? -1 : 1; }
    pick(arr) { return arr[Math.floor(this.next() * arr.length)]; }
    gauss(mean = 0, sd = 1) {
      const u = 1 - this.next(), v = this.next();
      return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    }
    // items: array of objects with a numeric weight (key `w` by default) or a
    // weight function.
    weighted(items, weight = 'w') {
      const wf = typeof weight === 'function' ? weight : (it) => it[weight];
      let total = 0;
      for (const it of items) total += Math.max(0, wf(it));
      let r = this.next() * total;
      for (const it of items) {
        r -= Math.max(0, wf(it));
        if (r < 0) return it;
      }
      return items[items.length - 1];
    }
    shuffle(arr) {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(this.next() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return arr;
    }
    // Independent sub-stream: forking with the same label from the same state
    // always gives the same stream.
    fork(label) { return new RNG(mix32(this.u32() ^ hashStr(String(label)))); }
  }

  // Human friendly seed codes ("K7QZ-9XA"): 7 base-32 symbols cover 32 bits.
  const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  function seedToCode(seed) {
    let n = seed >>> 0, out = '';
    for (let i = 0; i < 7; i++) {
      out = ALPHABET[n % 32] + out;
      n = Math.floor(n / 32);
    }
    return out.slice(0, 4) + '-' + out.slice(4);
  }
  // Accepts a code produced by seedToCode, or any text (hashed).
  function codeToSeed(text) {
    const clean = String(text || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (clean.length === 7 && [...clean].every((c) => ALPHABET.includes(c))) {
      let n = 0;
      for (const c of clean) n = n * 32 + ALPHABET.indexOf(c);
      return n >>> 0;
    }
    return hashStr(String(text || '').trim().toLowerCase());
  }
  function randomSeed() {
    return (Math.floor(Math.random() * 4294967296) ^ Date.now()) >>> 0;
  }

  // Smooth 2D value noise in [0, 1).
  function noise2(x, y, seed = 0) {
    const xi = Math.floor(x), yi = Math.floor(y);
    const fx = x - xi, fy = y - yi;
    const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    const a = hash3f(xi, yi, seed), b = hash3f(xi + 1, yi, seed);
    const c = hash3f(xi, yi + 1, seed), d = hash3f(xi + 1, yi + 1, seed);
    return (a + (b - a) * sx) + ((c + (d - c) * sx) - (a + (b - a) * sx)) * sy;
  }

  XS.hashStr = hashStr;
  XS.mix32 = mix32;
  XS.hash = hash;
  XS.hash3f = hash3f;
  XS.RNG = RNG;
  XS.seedToCode = seedToCode;
  XS.codeToSeed = codeToSeed;
  XS.randomSeed = randomSeed;
  XS.noise2 = noise2;
})(globalThis.XS = globalThis.XS || {});
