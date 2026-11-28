/*
 * Compositor 16-bit — deterministic random number generator.
 *
 * Every random decision in the generator flows through this module so that the
 * same seed (and the same parameters) always produce exactly the same song.
 * Math.random and Date must never be used on the generation path.
 *
 * Hash: cyrb128 (string -> 4 x uint32). Generator: sfc32 (Small Fast Counter).
 * fork(label) derives an independent stream from the seed and a label, so a
 * change in one part of the composer (e.g. melody) never shifts another (drums).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else { root.C16 = root.C16 || {}; root.C16.RNG = factory(); }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function hashString(str) {
    str = String(str);
    let h1 = 1779033703, h2 = 3144134277, h3 = 1013904242, h4 = 2773480762;
    for (let i = 0; i < str.length; i++) {
      const k = str.charCodeAt(i);
      h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
      h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
      h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
      h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
    }
    h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
    h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
    h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
    h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
    h1 ^= (h2 ^ h3 ^ h4); h2 ^= h1; h3 ^= h1; h4 ^= h1;
    return [h1 >>> 0, h2 >>> 0, h3 >>> 0, h4 >>> 0];
  }

  // Short hex fingerprint of any string (e.g. JSON of a song) for display.
  function fingerprint(str) {
    const h = hashString(str);
    return (h[0].toString(16).padStart(8, '0') + h[1].toString(16).padStart(8, '0')).toUpperCase();
  }

  function sfc32(a, b, c, d) {
    return function () {
      a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0;
      let t = (a + b) | 0;
      a = b ^ (b >>> 9);
      b = (c + (c << 3)) | 0;
      c = (c << 21) | (c >>> 11);
      d = (d + 1) | 0;
      t = (t + d) | 0;
      c = (c + t) | 0;
      return (t >>> 0) / 4294967296;
    };
  }

  function create(seed) {
    const seedStr = String(seed);
    const s = hashString(seedStr);
    const gen = sfc32(s[0], s[1], s[2], s[3]);
    for (let i = 0; i < 15; i++) gen();

    const rng = {
      seed: seedStr,
      /** float in [0, 1) */
      next: gen,
      /** float in [min, max) */
      float(min, max) { return min + gen() * (max - min); },
      /** integer in [min, max] (inclusive) */
      int(min, max) { return min + Math.floor(gen() * (max - min + 1)); },
      /** true with probability p */
      chance(p) { return gen() < p; },
      /** uniform element of a non-empty array */
      pick(arr) {
        if (!arr || !arr.length) throw new Error('RNG.pick: empty array');
        return arr[Math.floor(gen() * arr.length)];
      },
      /**
       * Weighted choice. Accepts an object {value: weight} (returns the key as a
       * string) or an array of [value, weight] pairs (returns value as-is).
       * Object keys are iterated in insertion order, which is deterministic.
       */
      weighted(entries) {
        const pairs = Array.isArray(entries) ? entries : Object.keys(entries).map((k) => [k, entries[k]]);
        let total = 0;
        for (const p of pairs) total += Math.max(0, p[1]);
        if (total <= 0) throw new Error('RNG.weighted: no positive weights');
        let r = gen() * total;
        for (const p of pairs) {
          const w = Math.max(0, p[1]);
          if (r < w) return p[0];
          r -= w;
        }
        return pairs[pairs.length - 1][0];
      },
      /** new shuffled copy (Fisher–Yates) */
      shuffle(arr) {
        const a = arr.slice();
        for (let i = a.length - 1; i > 0; i--) {
          const j = Math.floor(gen() * (i + 1));
          const t = a[i]; a[i] = a[j]; a[j] = t;
        }
        return a;
      },
      /** normal distribution (Box–Muller) */
      gaussian(mean = 0, sd = 1) {
        let u = 0;
        while (u === 0) u = gen();
        const v = gen();
        return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
      },
      /** independent stream derived from this seed and a label */
      fork(label) { return create(seedStr + '::' + label); },
    };
    return rng;
  }

  return { create, hashString, fingerprint };
});
