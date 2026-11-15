/* Sinuca do Além — utilidades: RNG com semente, matemática e armazenamento. */
(function (g) {
  'use strict';
  const SA = (g.SA = g.SA || {});

  // RNG determinístico (mulberry32) com estado exportável, para salvar e retomar uma noite.
  SA.makeRng = function (seed) {
    const r = function () {
      r.s = (r.s + 0x6d2b79f5) | 0;
      let t = Math.imul(r.s ^ (r.s >>> 15), 1 | r.s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    r.s = seed | 0;
    r.int = (n) => Math.floor(r() * n);
    r.range = (a, b) => a + r() * (b - a);
    r.pick = (arr) => arr[Math.floor(r() * arr.length)];
    r.shuffle = (arr) => {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(r() * (i + 1));
        const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
      }
      return arr;
    };
    return r;
  };

  SA.hashStr = function (str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h | 0;
  };

  SA.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  SA.lerp = (a, b, t) => a + (b - a) * t;
  SA.fmt = (n) => {
    n = Math.round(n);
    if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(2).replace(/\.?0+$/, '') + 'M';
    return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  };
  SA.fmtMult = (m) => (Math.round(m * 100) / 100).toString().replace('.', ',');

  const KEY = 'sinuca-do-alem:v1';
  SA.store = {
    load() {
      try { return JSON.parse(g.localStorage.getItem(KEY)) || {}; } catch (e) { return {}; }
    },
    save(data) {
      try { g.localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { /* armazenamento indisponível */ }
    },
  };
})(typeof window !== 'undefined' ? window : globalThis);
