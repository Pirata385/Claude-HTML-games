/* Mutatrix: gerador pseudoaleatório com semente, hash de texto e utilidades de sorteio. Lógica pura. */
(function (root) {
  'use strict';
  const MX = root.MX || (root.MX = {});

  // Hash de texto de 32 bits (variante de cyrb53 reduzida), estável entre navegadores e Node.
  function hash32(str) {
    str = String(str);
    let h1 = 0xdeadbeef ^ str.length, h2 = 0x41c6ce57 ^ str.length;
    for (let i = 0; i < str.length; i++) {
      const ch = str.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (h1 ^ h2) >>> 0;
  }

  // sfc32: rápido e com boa distribuição.
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

  function make(seed) {
    const s = typeof seed === 'number' ? seed >>> 0 : hash32(seed);
    const raw = sfc32(s ^ 0x9e3779b9, hash32('a' + s), hash32('b' + s), hash32('c' + s));
    for (let i = 0; i < 12; i++) raw();
    const r = {
      seed: s,
      next: raw,
      range(a, b) { return a + raw() * (b - a); },
      int(a, b) { return a + Math.floor(raw() * (b - a + 1)); },
      chance(p) { return raw() < p; },
      pick(arr) { return arr[Math.floor(raw() * arr.length)]; },
      sign() { return raw() < 0.5 ? -1 : 1; },
      u32() { return (raw() * 4294967296) >>> 0; },
      // items: array; weightFn(item) -> peso >= 0. Retorna null se todos os pesos forem zero.
      weighted(items, weightFn) {
        let total = 0;
        const ws = items.map((it) => { const w = Math.max(0, weightFn ? weightFn(it) : it.w || 0); total += w; return w; });
        if (total <= 0) return null;
        let x = raw() * total;
        for (let i = 0; i < items.length; i++) { x -= ws[i]; if (x < 0) return items[i]; }
        return items[items.length - 1];
      },
      shuffle(arr) {
        const a = arr.slice();
        for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(raw() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; }
        return a;
      },
      fork(label) { return make(hash32(String(s) + ':' + label + ':' + r.u32())); },
    };
    return r;
  }

  // Alfabeto base32 de Crockford (sem I, L, O, U) para sementes e códigos legíveis.
  const B32 = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  function randomSeedString(len, rnd) {
    const f = rnd || Math.random;
    let s = '';
    for (let i = 0; i < (len || 5); i++) s += B32[Math.floor(f() * 32)];
    return s;
  }
  function normalizeB32(str) {
    return String(str || '').toUpperCase().replace(/[\s-]/g, '').replace(/O/g, '0').replace(/[IL]/g, '1').replace(/U/g, 'V');
  }

  MX.RNG = { hash32, make, B32, randomSeedString, normalizeB32 };
  if (typeof module === 'object' && module.exports) module.exports = MX.RNG;
})(typeof window !== 'undefined' ? window : globalThis);
