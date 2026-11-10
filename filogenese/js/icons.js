/* Filogênese — ícones vetoriais próprios (viewBox 24x24), usados no HUD (SVG) e no canvas (Path2D). */
(function (FG) {
  'use strict';
  const circ = (x, y, r) => `M${x - r} ${y}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0z`;
  const ell = (x, y, rx, ry) => `M${x - rx} ${y}a${rx} ${ry} 0 1 0 ${2 * rx} 0a${rx} ${ry} 0 1 0 ${-2 * rx} 0z`;
  const poly = (...p) => 'M' + p.join(' ') + 'z';
  const star = (cx, cy, n, R, r, rot) => { const p = []; for (let i = 0; i < n * 2; i++) { const a = (rot || -Math.PI / 2) + i * Math.PI / n, q = i % 2 ? r : R; p.push((cx + Math.cos(a) * q).toFixed(2), (cy + Math.sin(a) * q).toFixed(2)); } return poly(...p); };
  const HEART = 'M12 21C5 15 3 11.5 3 8.5A4.6 4.6 0 0 1 12 6.4 4.6 4.6 0 0 1 21 8.5c0 3-2 6.5-9 12.5z';
  const DROP = 'M12 2.5C8 8 5.5 11.3 5.5 15a6.5 6.5 0 0 0 13 0c0-3.7-2.5-7-6.5-12.5z';
  const EYE = 'M2 12c3-5 6.5-7 10-7s7 2 10 7c-3 5-6.5 7-10 7s-7-2-10-7z' + circ(12, 12, 3.3);
  // d: caminho; e: preenchimento par-ímpar (furos); s: traço em vez de preenchimento
  const I = {
    sing: { d: 'M9 3h9v4h-7v10a3.5 3.5 0 1 1-2-3.16z' },
    dance: { d: ell(8, 9.5, 3, 4.5) + circ(5.4, 3.6, 1.15) + circ(8, 2.9, 1.15) + circ(10.6, 3.6, 1.15) + ell(16, 17, 3, 4.5) + circ(13.4, 11.1, 1.15) + circ(16, 10.4, 1.15) + circ(18.6, 11.1, 1.15) },
    charm: { d: HEART },
    pose: { d: star(12, 12.6, 5, 10, 4.3) },
    bite: { d: 'M3 4h18l-3 7.5-3-4.5-3 6.5-3-6.5-3 4.5zM5 20.5h14l-2.5-5.5-2.2 3-2.3-4.5-2.3 4.5-2.2-3z' },
    charge: { d: poly(13, 4, 22, 12, 13, 20, 13, 15, 8, 15, 8, 9, 13, 9) + poly(2, 9, 6, 9, 6, 11, 2, 11) + poly(3.5, 13, 6, 13, 6, 15, 3.5, 15) },
    spit: { d: DROP },
    strike: { d: poly(6, 3, 8.6, 3, 5.6, 21, 3, 21) + poly(12.4, 3, 15, 3, 12, 21, 9.4, 21) + poly(18.8, 3, 21.4, 3, 18.4, 21, 15.8, 21) },
    dna: { d: 'M7 3C7 8 17 8 17 12S7 16 7 21M17 3C17 8 7 8 7 12S17 16 17 21M9 5.5h6M9 18.5h6M10.5 9h3M10.5 15h3', s: 1 },
    heart: { d: HEART },
    meat: { d: circ(9.5, 9.5, 6.2) + poly(13, 15.2, 15.2, 13, 19.4, 17.2, 17.2, 19.4) + circ(19, 19.6, 1.9) + circ(20.2, 17.3, 1.7) },
    leaf: { d: 'M5 19.5C4 9 10.5 4 20 4c.5 9.5-5 16-15 15.5zM5 19.5 14 10', s: 0 },
    brain: { d: ell(7.9, 12, 4.4, 7.4) + circ(5.2, 8, 2.9) + circ(4.4, 12.6, 2.8) + circ(6.2, 16.8, 2.9) + ell(16.1, 12, 4.4, 7.4) + circ(18.8, 8, 2.9) + circ(19.6, 12.6, 2.8) + circ(17.8, 16.8, 2.9) },
    paw: { d: ell(12, 15.6, 5, 4.6) + circ(5.8, 10.4, 2.2) + circ(9.8, 6.3, 2.2) + circ(14.2, 6.3, 2.2) + circ(18.2, 10.4, 2.2) },
    nest: { d: 'M3 12h18c0 5-4 8.5-9 8.5S3 17 3 12z' + ell(9.3, 8.4, 2.5, 3.3) + ell(14.7, 8.4, 2.5, 3.3) },
    map: { d: poly(3, 6, 9, 3.5, 15, 6, 21, 3.5, 21, 18, 15, 20.5, 9, 18, 3, 20.5) + poly(9.6, 5.4, 9.6, 16.6, 14.4, 18.6, 14.4, 7.4), e: 1 },
    book: { d: poly(3.5, 4.5, 11, 6, 11, 20.5, 3.5, 19) + poly(20.5, 4.5, 13, 6, 13, 20.5, 20.5, 19) },
    gear: { d: star(12, 12, 8, 10.2, 7.4, 0) + circ(12, 12, 3.3), e: 1 },
    pause: { d: poly(6, 4, 10, 4, 10, 20, 6, 20) + poly(14, 4, 18, 4, 18, 20, 14, 20) },
    play: { d: poly(7, 4, 20, 12, 7, 20) },
    close: { d: poly(5, 6.6, 6.6, 5, 19, 17.4, 17.4, 19) + poly(17.4, 5, 19, 6.6, 6.6, 19, 5, 17.4) },
    check: { d: poly(4, 12.5, 6.2, 10.3, 10, 14.1, 17.8, 6.3, 20, 8.5, 10, 18.5) },
    alert: { d: poly(12, 3, 22, 20.5, 2, 20.5) + poly(11, 9.5, 13, 9.5, 13, 15, 11, 15) + circ(12, 17.6, 1.2), e: 1 },
    skull: { d: circ(12, 10.5, 7.6) + poly(8, 15, 16, 15, 16, 20.5, 8, 20.5) + circ(9.2, 10.5, 2.1) + circ(14.8, 10.5, 2.1), e: 1 },
    bone: { d: poly(6.6, 15.4, 15.4, 6.6, 17.4, 8.6, 8.6, 17.4) + circ(5.6, 16.2, 2.5) + circ(7.8, 18.4, 2.5) + circ(16.2, 5.6, 2.5) + circ(18.4, 7.8, 2.5) },
    drop: { d: DROP },
    bolt: { d: poly(13, 2, 5, 13.5, 11, 13.5, 9.5, 22, 19, 9.5, 12.5, 9.5) },
    jump: { d: poly(12, 3, 20, 12, 15, 12, 15, 21, 9, 21, 9, 12, 4, 12) },
    sense: { d: EYE, e: 1 },
    sneak: { d: EYE + poly(4.2, 3, 5.8, 1.6, 20, 20.6, 18.4, 22), e: 1 },
    target: { d: circ(12, 12, 9) + circ(12, 12, 6.6) + circ(12, 12, 2.6), e: 1 },
    hand: { d: circ(12, 12, 9.5) + circ(12, 12, 7) + circ(12, 12, 3.6), e: 1 },
    mouth: { d: ell(12, 12, 9.5, 5.5) + ell(12, 12, 6.5, 2.2), e: 1 },
    sun: { d: circ(12, 12, 4.6) + star(12, 12, 8, 11, 7.2, 0) + circ(12, 12, 6.4), e: 1 },
    moon: { d: 'M15 3a9 9 0 1 0 6 15.5A7.6 7.6 0 0 1 15 3z' },
    lock: { d: 'M8 11V8a4 4 0 0 1 8 0v3h-2V8a2 2 0 0 0-4 0v3z' + poly(5.5, 11, 18.5, 11, 18.5, 21, 5.5, 21) },
    egg: { d: 'M12 3c3.6 0 6.5 5.4 6.5 10.2a6.5 6.5 0 0 1-13 0C5.5 8.4 8.4 3 12 3z' },
    trophy: { d: 'M7 3h10v5.5a5 5 0 0 1-10 0z' + poly(11, 13, 13, 13, 13, 17, 11, 17) + poly(7.5, 17, 16.5, 17, 16.5, 20.5, 7.5, 20.5) + 'M4 4.5h2.2v4H5.5A1.5 1.5 0 0 1 4 7zM17.8 4.5H20V7a1.5 1.5 0 0 1-1.5 1.5h-.7z' },
    swim: { d: 'M2 9c2.5-3 5-3 7.5 0s5 3 7.5 0 3.5-2 5-.5M2 16c2.5-3 5-3 7.5 0s5 3 7.5 0 3.5-2 5-.5', s: 1 },
    glide: { d: 'M2.5 6C10 5.5 16.5 8 21.5 14.5c-3.5-1.2-6-1.2-8 0 .8 2 .8 3.3 0 5C11.5 14 8 10.5 2.5 6z' },
    shield: { d: 'M12 2.5l8 3v6c0 5-3.4 8.6-8 10.5-4.6-1.9-8-5.5-8-10.5v-6z' },
    full: { d: poly(3, 3, 9, 3, 9, 5.2, 5.2, 5.2, 5.2, 9, 3, 9) + poly(15, 3, 21, 3, 21, 9, 18.8, 9, 18.8, 5.2, 15, 5.2) + poly(3, 15, 5.2, 15, 5.2, 18.8, 9, 18.8, 9, 21, 3, 21) + poly(18.8, 15, 21, 15, 21, 21, 15, 21, 15, 18.8, 18.8, 18.8) },
    note: { d: 'M9 3h9v4h-7v10a3.5 3.5 0 1 1-2-3.16z' },
    info: { d: circ(12, 12, 10) + circ(12, 7.2, 1.5) + poly(10.8, 10.4, 13.2, 10.4, 13.2, 18, 10.8, 18), e: 1 },
    home: { d: poly(12, 3, 21.5, 11.5, 18.5, 11.5, 18.5, 20.5, 14, 20.5, 14, 14.5, 10, 14.5, 10, 20.5, 5.5, 20.5, 5.5, 11.5, 2.5, 11.5) },
    back: { d: poly(10.5, 4, 12.6, 6.1, 8.2, 10.5, 21, 10.5, 21, 13.5, 8.2, 13.5, 12.6, 17.9, 10.5, 20, 2.5, 12) },
    speed: { d: poly(13, 2, 5, 13.5, 11, 13.5, 9.5, 22, 19, 9.5, 12.5, 9.5) },
    stealth: { d: EYE + poly(4.2, 3, 5.8, 1.6, 20, 20.6, 18.4, 22), e: 1 },
    hp: { d: HEART },
  };
  const cache = {};
  FG.Icons = {
    defs: I,
    /** Marcação SVG de um ícone, herdando a cor do texto. */
    svg(name, cls) {
      const ic = I[name] || I.info;
      const attr = ic.s ? 'fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"' : `fill="currentColor"${ic.e ? ' fill-rule="evenodd"' : ''}`;
      return `<svg class="ic${cls ? ' ' + cls : ''}" viewBox="0 0 24 24" aria-hidden="true"><path d="${ic.d}" ${attr}/></svg>`;
    },
    /** Desenha o ícone no canvas centrado em (x, y) com o tamanho dado. */
    draw(ctx, name, x, y, size, color) {
      const ic = I[name] || I.info;
      const p = cache[name] || (cache[name] = new Path2D(ic.d));
      const k = size / 24;
      ctx.save(); ctx.translate(x - size / 2, y - size / 2); ctx.scale(k, k);
      if (ic.s) { ctx.strokeStyle = color; ctx.lineWidth = 2.2; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke(p); }
      else { ctx.fillStyle = color; ctx.fill(p, ic.e ? 'evenodd' : 'nonzero'); }
      ctx.restore();
    },
  };
})(window.FG = window.FG || {});
