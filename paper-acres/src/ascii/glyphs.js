/* Runtime glyph atlas: ASCII 32..126 x 3 styles (regular, bold, inverted) x 3 hand-jitter variants. */
(function (root) {
  'use strict';
  const PA = root.PA = root.PA || {};
  const FIRST = 32, COUNT = 95, STYLES = 3, VARIANTS = 3;
  let CHARS = '';
  for (let i = 0; i < COUNT; i++) CHARS += String.fromCharCode(FIRST + i);
  const Q = '?'.charCodeAt(0) - FIRST;

  function code(ch) {
    const c = ch.charCodeAt(0) - FIRST;
    return c >= 0 && c < COUNT ? c : Q;
  }
  function frame(ch, style, variant) {
    return ((style * VARIANTS + variant) * COUNT) + code(ch);
  }

  /** Draws the atlas on a canvas and registers it as Phaser texture 'glyphs' with numeric frames. */
  function build(scene) {
    const C = PA.C, GW = C.GW, GH = C.GH;
    const cols = 32, total = COUNT * STYLES * VARIANTS, rows = Math.ceil(total / cols);
    const cv = document.createElement('canvas');
    cv.width = cols * GW; cv.height = rows * GH;
    const ctx = cv.getContext('2d');
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    const fam = '"Courier Prime", "Courier New", monospace';
    const jit = [[0, 0, 0], [0.07, 1, -1], [-0.06, -1, 1]];
    for (let style = 0; style < STYLES; style++) {
      for (let v = 0; v < VARIANTS; v++) {
        for (let i = 0; i < COUNT; i++) {
          const f = (style * VARIANTS + v) * COUNT + i;
          const x = (f % cols) * GW, y = Math.floor(f / cols) * GH;
          ctx.save();
          ctx.beginPath(); ctx.rect(x, y, GW, GH); ctx.clip();
          if (style === 2) { ctx.fillStyle = C.INK; ctx.fillRect(x, y, GW, GH); }
          ctx.font = (style === 0 ? '400 ' : '700 ') + '36px ' + fam;
          ctx.fillStyle = style === 2 ? C.PAPER : C.INK;
          ctx.translate(x + GW / 2 + jit[v][1], y + GH * 0.74 + jit[v][2]);
          ctx.rotate(jit[v][0]);
          ctx.fillText(CHARS[i], 0, 0);
          ctx.restore();
        }
      }
    }
    if (scene.textures.exists('glyphs')) scene.textures.remove('glyphs');
    const tex = scene.textures.addCanvas('glyphs', cv);
    for (let f = 0; f < total; f++) tex.add(f, 0, (f % cols) * GW, Math.floor(f / cols) * GH, GW, GH);
    return tex;
  }

  PA.Glyphs = { CHARS, FIRST, COUNT, STYLES, VARIANTS, frame, code, build };
  if (typeof module !== 'undefined' && module.exports) module.exports = PA.Glyphs;
})(typeof window !== 'undefined' ? window : globalThis);
