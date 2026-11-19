/* Planolândia — namespace global PL e utilidades matemáticas.
 * Scripts clássicos (sem módulos) para abrir via file://; em Node, module.exports devolve o mesmo PL. */
(function (root) {
  'use strict';
  const PL = root.PL || (root.PL = {});

  const M = {
    TAU: Math.PI * 2,
    clamp: (v, a, b) => (v < a ? a : v > b ? b : v),
    lerp: (a, b, t) => a + (b - a) * t,
    invLerp: (a, b, v) => (b === a ? 0 : (v - a) / (b - a)),
    sign: (v) => (v > 0 ? 1 : v < 0 ? -1 : 0),
    // aproxima v de alvo em no máximo 'passo'
    approach: (v, alvo, passo) => (v < alvo ? Math.min(v + passo, alvo) : Math.max(v - passo, alvo)),
    // suavização exponencial independente do dt
    damp: (a, b, lambda, dt) => b + (a - b) * Math.exp(-lambda * dt),
    smooth: (t) => t * t * (3 - 2 * t),
    easeOut: (t) => 1 - (1 - t) * (1 - t),
    easeIn: (t) => t * t,
    wrapAngle: (a) => {
      while (a > Math.PI) a -= Math.PI * 2;
      while (a < -Math.PI) a += Math.PI * 2;
      return a;
    },
    // hash inteiro determinístico → [0,1)
    hash: (a, b, c) => {
      let h = (a | 0) * 374761393 + (b | 0) * 668265263 + (c | 0) * 2147483647;
      h = (h ^ (h >>> 13)) * 1274126177;
      h = h ^ (h >>> 16);
      return (h >>> 0) / 4294967296;
    },
    hashStr: (s) => {
      let h = 2166136261;
      for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
      return h >>> 0;
    },
    // gerador mulberry32 com semente
    rng: (seed) => {
      let a = seed >>> 0;
      return function () {
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    },
    // mistura de cores 0xRRGGBB
    mix: (c1, c2, t) => {
      const r = ((c1 >> 16) & 255) + ((((c2 >> 16) & 255) - ((c1 >> 16) & 255)) * t);
      const g = ((c1 >> 8) & 255) + ((((c2 >> 8) & 255) - ((c1 >> 8) & 255)) * t);
      const b = (c1 & 255) + (((c2 & 255) - (c1 & 255)) * t);
      return ((r & 255) << 16) | ((g & 255) << 8) | (b & 255);
    },
  };
  PL.M = M;
  PL.VERSION = '0.1.0-marco1';

  if (typeof module !== 'undefined' && module.exports) module.exports = PL;
})(typeof globalThis !== 'undefined' ? globalThis : this);
