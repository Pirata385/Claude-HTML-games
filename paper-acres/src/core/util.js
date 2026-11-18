/* Small helpers shared everywhere. */
(function (root) {
  'use strict';
  const PA = root.PA = root.PA || {};
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  const U = PA.U = {
    clamp: (v, a, b) => (v < a ? a : v > b ? b : v),
    lerp: (a, b, t) => a + (b - a) * t,
    sign: (v) => (v > 0 ? 1 : v < 0 ? -1 : 0),
    bayer4: (x, y) => BAYER[((y & 3) << 2) | (x & 3)] / 16,
    dist: (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by),
    smooth: (t) => t * t * (3 - 2 * t),
    approach: (v, target, step) => (v < target ? Math.min(v + step, target) : Math.max(v - step, target)),
    pad: (s, n, ch = ' ') => { s = String(s); while (s.length < n) s += ch; return s; },
    padL: (s, n, ch = ' ') => { s = String(s); while (s.length < n) s = ch + s; return s; },
    esc: (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])),
    fmtTime(mins) {
      const h24 = Math.floor(mins / 60) % 24, m = Math.floor(mins % 60 / 10) * 10;
      const ap = h24 < 12 ? 'am' : 'pm';
      const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
      return h12 + ':' + String(m).padStart(2, '0') + ap;
    },
    shuffle(arr, rnd) { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); const t = arr[i]; arr[i] = arr[j]; arr[j] = t; } return arr; },
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = U;
})(typeof window !== 'undefined' ? window : globalThis);
