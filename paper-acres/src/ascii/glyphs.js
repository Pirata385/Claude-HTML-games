/* Runtime glyph atlas: ASCII 32..126 x 3 styles (regular, bold, inverted) x 3 hand-jitter variants. */
(function (root) {
  'use strict';
  const PA = root.PA = root.PA || {};
  const FIRST = 32, ASCII = 95, STYLES = 3, VARIANTS = 3;
  const EXTRA = '\u25CB\u25CF\u2022\u00B0\u2665';  // ○ ● • ° ♥
  let CHARS = '';
  for (let i = 0; i < ASCII; i++) CHARS += String.fromCharCode(FIRST + i);
  CHARS += EXTRA;
  const COUNT = CHARS.length;
  const Q = '?'.charCodeAt(0) - FIRST;
  const EXTRA_IDX = {};
  for (let i = 0; i < EXTRA.length; i++) EXTRA_IDX[EXTRA[i]] = ASCII + i;
  const BOX_PAPER = COUNT * STYLES * VARIANTS, BOX_INK = BOX_PAPER + 1;

  function code(ch) {
    const c = ch.charCodeAt(0) - FIRST;
    if (c >= 0 && c < ASCII) return c;
    const e = EXTRA_IDX[ch];
    return e != null ? e : Q;
  }
  function box(kind) { return kind === 'ink' ? BOX_INK : BOX_PAPER; }
  function frame(ch, style, variant) {
    return ((style * VARIANTS + variant) * COUNT) + code(ch);
  }

  /** Draws the atlas on a canvas and registers it as Phaser texture 'glyphs' with numeric frames. */
  function build(scene) {
    const C = PA.C, GW = C.GW, GH = C.GH, PW = GW + 2, PH = GH + 2; // 1px gutter against texture bleeding
    const cols = 32, total = COUNT * STYLES * VARIANTS + 2, rows = Math.ceil(total / cols);
    const cv = document.createElement('canvas');
    cv.width = cols * PW; cv.height = rows * PH;
    const ctx = cv.getContext('2d');
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    const fam = '"Courier Prime", "Courier New", monospace';
    const jit = [[0, 0, 0], [0.07, 1, -1], [-0.06, -1, 1]];
    for (let style = 0; style < STYLES; style++) {
      for (let v = 0; v < VARIANTS; v++) {
        for (let i = 0; i < COUNT; i++) {
          const f = (style * VARIANTS + v) * COUNT + i;
          const x = (f % cols) * PW + 1, y = Math.floor(f / cols) * PH + 1;
          ctx.save();
          ctx.beginPath(); ctx.rect(x, y, GW, GH); ctx.clip();
          if (style === 2) { ctx.fillStyle = C.INK; ctx.fillRect(x, y, GW, GH); }
          ctx.font = (style === 0 ? '400 ' : '700 ') + '36px ' + fam;
          ctx.fillStyle = style === 2 ? C.PAPER : C.INK;
          const ch = CHARS[i];
          if (ch === '\u25CB' || ch === '\u25CF') {
            // draw round heads ourselves so their weight matches the font on every platform
            ctx.strokeStyle = ctx.fillStyle;
            ctx.lineWidth = style === 0 ? 2.6 : 3.6;
            ctx.beginPath(); ctx.arc(x + GW / 2 + jit[v][1] * 0.5, y + GH * 0.56, GW * 0.3, 0, Math.PI * 2);
            if (ch === '\u25CF') ctx.fill(); else ctx.stroke();
            ctx.restore();
            continue;
          }
          ctx.translate(x + GW / 2 + jit[v][1], y + GH * 0.74 + jit[v][2]);
          ctx.rotate(jit[v][0]);
          ctx.fillText(ch, 0, 0);
          ctx.restore();
        }
      }
    }
    for (const [f, col] of [[BOX_PAPER, C.PAPER], [BOX_INK, C.INK]]) {
      ctx.fillStyle = col;
      ctx.fillRect((f % cols) * PW, Math.floor(f / cols) * PH, PW, PH); // extruded into the gutter
    }
    // inverted glyphs are ink boxes: extrude them too so neighbours join without seams
    for (let v = 0; v < VARIANTS; v++) for (let i = 0; i < COUNT; i++) {
      const f = (2 * VARIANTS + v) * COUNT + i, x = (f % cols) * PW, y = Math.floor(f / cols) * PH;
      ctx.fillStyle = C.INK; ctx.fillRect(x, y, PW, 1); ctx.fillRect(x, y + PH - 1, PW, 1); ctx.fillRect(x, y, 1, PH); ctx.fillRect(x + PW - 1, y, 1, PH);
    }
    if (scene.textures.exists('glyphs')) scene.textures.remove('glyphs');
    const tex = scene.textures.addCanvas('glyphs', cv);
    for (let f = 0; f < total; f++) tex.add(f, 0, (f % cols) * PW + 1, Math.floor(f / cols) * PH + 1, GW, GH);
    return tex;
  }

  PA.Glyphs = { CHARS, FIRST, COUNT, STYLES, VARIANTS, frame, code, box, build };
  if (typeof module !== 'undefined' && module.exports) module.exports = PA.Glyphs;
})(typeof window !== 'undefined' ? window : globalThis);
