/* Mutatrix: vírus procedurais e frascos em pixel art (PixiJS). */
(function (root) {
  'use strict';
  const MX = root.MX || (root.MX = {});
  const X = MX.Pix, PAL = X.PAL;
  const TAU = Math.PI * 2;
  const R = Math.round;

  function spikes(g, x, y, r, n, len, rot, col, t, wob) {
    for (let i = 0; i < n; i++) {
      const a = rot + (i / n) * TAU;
      const l = r * (1 + len * (1 + 0.15 * Math.sin(t * 3 * wob + i)));
      const ex = x + Math.cos(a) * l, ey = y + Math.sin(a) * l;
      X.line(g, [[x + Math.cos(a) * r * 0.85, y + Math.sin(a) * r * 0.85], [ex, ey]], 1, PAL.ink);
      X.circ(g, ex, ey, Math.max(1, r * 0.12), col, { flat: true });
    }
  }
  function ngon(x, y, r, n, rot) { const p = []; for (let i = 0; i < n; i++) { const a = rot + (i / n) * TAU; p.push([x + Math.cos(a) * r, y + Math.sin(a) * r]); } return p; }

  // vis: visual do vírus (Genetics.synthesize().visual). r: raio em px.
  function draw(g, x, y, r, vis, t) {
    t = t || 0;
    const rot = vis.rot + t * 0.35;
    const Rr = Math.max(3, r * (Math.sin(t * 2 * vis.wobble) > 0.7 ? 1.06 : 1));
    const c1 = X.num(vis.color), c2 = X.num(vis.color2), acc = X.num(vis.accent);
    switch (vis.capsid) {
      case 'helice': {
        const pts = [];
        for (let i = 0; i <= 8; i++) { const k = i / 8; pts.push([x - Rr * 1.1 + k * Rr * 2.2, y + Math.sin(k * TAU * 1.5 + t * 2) * Rr * 0.18]); }
        X.tube(g, pts, Rr * 0.75, Rr * 0.75, c1);
        for (let i = 0; i < 6; i++) { const k = (i + 0.5) / 6; const px = x - Rr + k * Rr * 2; const py = y + Math.sin(k * TAU * 1.5 + t * 2) * Rr * 0.18; X.line(g, [[px - Rr * 0.12, py - Rr * 0.3], [px + Rr * 0.12, py + Rr * 0.3]], Math.max(1, R(Rr * 0.15)), c2); }
        spikes(g, x - Rr * 1.15, y, Rr * 0.3, 4, 0.9, Math.PI * 0.6, acc, t, vis.wobble);
        spikes(g, x + Rr * 1.15, y, Rr * 0.3, 4, 0.9, -Math.PI * 0.4, acc, t, vis.wobble);
        return;
      }
      case 'bacteriofago': {
        const hy = y - Rr * 0.45;
        for (let i = 0; i < 3; i++) for (const s of [-1, 1]) {
          const k = (i - 1) * 0.55, kx = x + s * Rr * (0.5 + Math.abs(k) * 0.4), ky = y + Rr * 0.8, kick = Math.sin(t * 4 + i) * 0.08;
          X.line(g, [[x, y + Rr * 0.6], [kx, ky - Rr * (0.2 + kick)], [kx + s * Rr * 0.2, ky + Rr * 0.25]], 1, PAL.ink);
        }
        X.rect(g, x - Rr * 0.12, hy + Rr * 0.45, Math.max(2, Rr * 0.24), Rr * 0.6, X.light(c2, 0.2));
        X.poly(g, ngon(x, hy, Rr * 0.62, 6, Math.PI / 6 + rot * 0.2), c1);
        X.px(g, x - Rr * 0.2, hy - Rr * 0.25, X.light(c1, 0.5), 1);
        return;
      }
      case 'gota': {
        const pts = [[x, y - Rr * 1.15]];
        for (let i = 0; i <= 10; i++) { const a = -0.25 + (i / 10) * (Math.PI + 0.5); pts.push([x + Math.cos(a) * Rr * 0.95, y + Rr * 0.3 + Math.sin(a) * Rr * 0.95]); }
        X.poly(g, pts, c1);
        X.ell(g, x - Rr * 0.35, y + Rr * 0.1, Math.max(1, Rr * 0.14), Math.max(1, Rr * 0.28), X.light(c1, 0.6), { flat: true, noOutline: true });
        for (let i = 0; i < Math.min(5, vis.dots); i++) { const a = i * 2.4 + rot; X.px(g, x + Math.cos(a) * Rr * 0.45, y + Rr * 0.4 + Math.sin(a) * Rr * 0.4, X.light(c2, 0.3), Rr > 8 ? 2 : 1); }
        return;
      }
      case 'estrela': {
        spikes(g, x, y, Rr * 0.55, 5, 1.3, rot - Math.PI / 2, acc, t, vis.wobble);
        const pts = [];
        for (let i = 0; i < 10; i++) { const a = rot - Math.PI / 2 + (i / 10) * TAU; const rr = i % 2 ? Rr * 0.5 : Rr * 1.05; pts.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr]); }
        X.poly(g, pts, c1);
        X.circ(g, x, y, Math.max(1.5, Rr * 0.26), c2, { flat: true });
        return;
      }
      case 'fractal': {
        const ring = (cx, cy, rr, depth) => {
          X.circ(g, cx, cy, Math.max(1, rr), depth === 0 ? c1 : depth === 1 ? c2 : acc, { flat: depth > 0 });
          if (depth >= 2 || rr < 2) return;
          for (let i = 0; i < 6; i++) { const a = rot * (depth ? -1.5 : 1) + i / 6 * TAU; ring(cx + Math.cos(a) * rr * 1.35, cy + Math.sin(a) * rr * 1.35, rr * 0.36, depth + 1); }
        };
        ring(x, y, Rr * 0.55, 0);
        return;
      }
      case 'cubo': {
        const s = Rr * 0.6;
        const top = [[x, y - s * 1.2], [x + s, y - s * 0.7], [x, y - s * 0.2], [x - s, y - s * 0.7]];
        const left = [[x - s, y - s * 0.7], [x, y - s * 0.2], [x, y + s * 0.9], [x - s, y + s * 0.4]];
        const right = [[x, y - s * 0.2], [x + s, y - s * 0.7], [x + s, y + s * 0.4], [x, y + s * 0.9]];
        X.poly(g, top, X.light(c1, 0.3)); X.poly(g, left, c1); X.poly(g, right, c2);
        X.line(g, [[x - s, y - s * 0.7], [x + s, y + s * 0.4]], 1, PAL.ink);
        X.line(g, [[x, y - s * 1.2], [x + Math.sin(t * 3) * s * 0.4, y - s * 1.7]], 1, acc);
        return;
      }
      case 'envelopado': {
        spikes(g, x, y, Rr * 0.85, Math.min(14, vis.spikes + 3), vis.spikeLen * 0.6, rot, acc, t, vis.wobble);
        X.circ(g, x, y, Rr * 0.98, X.light(c1, 0.25));
        X.circ(g, x, y, Rr * 0.62, c1, { noHi: true });
        for (let i = 0; i < Math.min(6, vis.dots); i++) { const a = i * 2.4 + rot; X.px(g, x + Math.cos(a) * Rr * 0.35, y + Math.sin(a) * Rr * 0.35, X.light(c2, 0.35), 1); }
        return;
      }
      default: {
        spikes(g, x, y, Rr * 0.85, vis.spikes, vis.spikeLen, rot, acc, t, vis.wobble);
        const hex = ngon(x, y, Rr, 6, rot * 0.5);
        X.poly(g, hex, c1);
        X.poly(g, [hex[0], hex[2], hex[4]], X.light(c1, 0.25), { noOutline: true });
        X.line(g, [hex[0], hex[2], hex[4], hex[0]], 1, X.dark(c1, 0.35));
        for (let i = 0; i < 3; i++) { const a = rot * 0.5 + (i * 2 + 1) / 6 * TAU; X.px(g, x + Math.cos(a) * Rr * 0.55, y + Math.sin(a) * Rr * 0.55, X.light(c2, 0.3), Rr > 8 ? 2 : 1); }
      }
    }
  }

  // Frasco de vidro com o vírus flutuando no líquido.
  function vial(g, x, y, h, vis, t) {
    h = Math.max(14, R(h));
    const w = R(h * 0.46), nw = Math.max(3, R(w * 0.42));
    const top = R(y - h / 2), bot = R(y + h / 2);
    const neckB = top + R(h * 0.36);
    const body = [[x - nw / 2, top + R(h * 0.1)], [x - nw / 2, neckB], [x - w / 2, neckB + R(h * 0.14)], [x - w / 2, bot - 2], [x - w / 2 + 2, bot], [x + w / 2 - 2, bot], [x + w / 2, bot - 2], [x + w / 2, neckB + R(h * 0.14)], [x + nw / 2, neckB], [x + nw / 2, top + R(h * 0.1)]];
    X.poly(g, body, PAL.cyan, { alpha: 0.25, noOutline: true });
    if (vis) {
      const lvl = R(top + h * (0.55 - (Math.sin(t * 2) > 0 ? 0.02 : 0)));
      X.scanFill(g, { t: 'poly', pts: body }, (px, py) => (py >= lvl ? (py === lvl ? X.light(vis.color, 0.4) : X.num(vis.color)) : null), 0.7);
      for (let i = 0; i < 3; i++) { const k = ((t * 0.4 + i * 0.33) % 1); X.px(g, x - w * 0.2 + i * w * 0.2, bot - 2 - k * (bot - lvl - 3), PAL.white, 1); }
      draw(g, x, R(top + h * 0.74), Math.max(3, h * 0.13), vis, t);
    }
    X.line(g, body.concat([body[0]]), 1, PAL.ink);
    X.rect(g, x - w / 2 + 2, neckB + h * 0.2, 1, h * 0.3, PAL.white, { noOutline: true, alpha: 0.7 });
    X.rect(g, x - nw * 0.65, top, nw * 1.3, Math.max(2, h * 0.11), 0xc9573f, { bevel: true });
  }

  MX.VirusArt = { draw, vial };
})(typeof window !== 'undefined' ? window : globalThis);
