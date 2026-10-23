// Colour utilities. Ramps hue-shift like hand-made pixel art palettes:
// shadows drift toward violet-blue, highlights toward warm yellow.
(function (XS) {
  'use strict';

  const clamp255 = (v) => Math.max(0, Math.min(255, Math.round(v)));

  function hexToRgb(hex) {
    let h = hex.replace('#', '');
    if (h.length === 3) h = h.split('').map((c) => c + c).join('');
    const n = parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function rgbToHex(rgb) {
    return '#' + ((1 << 24) | (clamp255(rgb[0]) << 16) | (clamp255(rgb[1]) << 8) | clamp255(rgb[2])).toString(16).slice(1);
  }
  function mix(a, b, t) {
    const A = hexToRgb(a), B = hexToRgb(b);
    return rgbToHex([A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t]);
  }
  const lighten = (c, t) => mix(c, '#ffffff', t);
  const darken = (c, t) => mix(c, '#000000', t);
  function scale(c, f) {
    const A = hexToRgb(c);
    return rgbToHex([A[0] * f, A[1] * f, A[2] * f]);
  }

  function rgbToHsl([r, g, b]) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0;
    const l = (max + min) / 2;
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
      else if (max === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h *= 60;
    }
    return [h, s, l];
  }
  function hsl(h, s, l) {
    h = ((h % 360) + 360) % 360;
    s = Math.max(0, Math.min(1, s)); l = Math.max(0, Math.min(1, l));
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = l - c / 2;
    let r, g, b;
    if (h < 60) [r, g, b] = [c, x, 0];
    else if (h < 120) [r, g, b] = [x, c, 0];
    else if (h < 180) [r, g, b] = [0, c, x];
    else if (h < 240) [r, g, b] = [0, x, c];
    else if (h < 300) [r, g, b] = [x, 0, c];
    else [r, g, b] = [c, 0, x];
    return rgbToHex([(r + m) * 255, (g + m) * 255, (b + m) * 255]);
  }
  const toHsl = (hex) => rgbToHsl(hexToRgb(hex));

  // Move hue h toward target by `amount` degrees along the shortest arc.
  function hueToward(h, target, amount) {
    let d = ((target - h + 540) % 360) - 180;
    const step = Math.sign(d) * Math.min(Math.abs(d), amount);
    return h + step;
  }

  // n-step ramp around a base colour, dark -> light.
  function ramp(base, n = 4, spread = 1) {
    const [h, s, l] = toHsl(base);
    const out = [];
    for (let i = 0; i < n; i++) {
      const t = n === 1 ? 0.5 : i / (n - 1);
      const k = (t - 0.5) * 2; // -1 (shadow) .. 1 (highlight)
      const ll = Math.max(0.06, Math.min(0.95, l + k * 0.28 * spread));
      const hh = k < 0 ? hueToward(h, 250, -k * 22 * spread) : hueToward(h, 55, k * 16 * spread);
      const ss = Math.max(0, Math.min(1, s * (1 - Math.abs(k) * 0.18) + (k < 0 ? 0.05 : 0)));
      out.push(hsl(hh, ss, ll));
    }
    return out;
  }

  // Random harmonious palette for a creature.
  function creaturePalette(rng) {
    const h = rng.range(0, 360);
    const scheme = rng.pick(['analog', 'complement', 'triad', 'split']);
    const off = { analog: 35, complement: 180, triad: 120, split: 150 }[scheme] * rng.sign();
    const s = rng.range(0.35, 0.8);
    const l = rng.range(0.42, 0.62);
    const body = ramp(hsl(h, s, l), 4);
    const belly = ramp(hsl(h + rng.range(-20, 20), s * 0.6, Math.min(0.8, l + 0.2)), 4);
    const accent = ramp(hsl(h + off, Math.min(1, s + 0.15), rng.range(0.45, 0.65)), 4);
    const glow = rng.chance(0.55) ? hsl(h + off + rng.range(-30, 30), 1, 0.7) : null;
    const eye = rng.pick(['#fff6d6', '#f2fbff', '#ffe066', '#ff7aa8', '#b8ff6a', '#ffffff']);
    return { body, belly, accent, glow, eye, outline: '#0c0816' };
  }

  XS.color = { hexToRgb, rgbToHex, mix, lighten, darken, scale, hsl, toHsl, ramp, creaturePalette };
})(globalThis.XS = globalThis.XS || {});
