/* Runtime glyph atlas: ASCII 32..126 plus a few symbols x 3 styles (regular, bold, inverted) x 3 hand-jitter variants. */
(function (root) {
  'use strict';
  const PA = root.PA = root.PA || {};
  const FIRST = 32, ASCII = 95, STYLES = 3, VARIANTS = 3;
  // ○ ● • ° ♥, then the stickman bodies: § ¶ ¤ ± ÷ (Courier Prime) and ‡ ‰ ♦ ♠ ♣ ◊ ∞ ≈ ≡ ⊕ ⊗ ☼ ※ ⌘ (drawn below)
  const EXTRA = '\u25CB\u25CF\u2022\u00B0\u2665' +
    '\u00A7\u00B6\u00A4\u00B1\u00F7' +
    '\u2021\u2030\u2666\u2660\u2663\u25CA\u221E\u2248\u2261\u2295\u2297\u263C\u203B\u2318';
  /* Symbols the font does not have are drawn by hand, so they look the same on every platform. Each draws around
   * (0, 0) in a box of half-width w and half-height h, with the current fill/stroke colour and line width. */
  const dot = (ctx, x, y, r) => { ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, Math.PI * 2); };
  const CUSTOM = {
    '\u2665'(ctx, w, h) { // ♥
      ctx.beginPath(); ctx.moveTo(0, h * 0.85);
      ctx.bezierCurveTo(-w * 0.4, h * 0.45, -w, h * 0.05, -w * 0.9, -h * 0.4);
      ctx.bezierCurveTo(-w * 0.8, -h * 0.95, -w * 0.12, -h * 0.9, 0, -h * 0.4);
      ctx.bezierCurveTo(w * 0.12, -h * 0.9, w * 0.8, -h * 0.95, w * 0.9, -h * 0.4);
      ctx.bezierCurveTo(w, h * 0.05, w * 0.4, h * 0.45, 0, h * 0.85); ctx.fill();
    },
    '\u2021'(ctx, w, h) { // ‡
      ctx.beginPath(); ctx.moveTo(0, -h); ctx.lineTo(0, h);
      ctx.moveTo(-w * 0.8, -h * 0.45); ctx.lineTo(w * 0.8, -h * 0.45); ctx.moveTo(-w * 0.8, h * 0.4); ctx.lineTo(w * 0.8, h * 0.4); ctx.stroke();
    },
    '\u2030'(ctx, w, h) { // ‰
      const r = w * 0.27;
      ctx.beginPath(); ctx.moveTo(w * 0.75, -h * 0.9); ctx.lineTo(-w * 0.75, h * 0.9);
      dot(ctx, -w * 0.5, -h * 0.55, r); dot(ctx, -w * 0.05, h * 0.55, r); dot(ctx, w * 0.68, h * 0.55, r); ctx.stroke();
    },
    '\u2666'(ctx, w, h) { // ♦
      ctx.beginPath(); ctx.moveTo(0, -h); ctx.lineTo(w * 0.85, 0); ctx.lineTo(0, h); ctx.lineTo(-w * 0.85, 0); ctx.closePath(); ctx.fill();
    },
    '\u2660'(ctx, w, h) { // ♠
      ctx.beginPath(); ctx.moveTo(0, -h);
      ctx.bezierCurveTo(w * 0.5, -h * 0.5, w * 1.05, -h * 0.1, w * 0.85, h * 0.3);
      ctx.bezierCurveTo(w * 0.7, h * 0.65, w * 0.2, h * 0.6, 0, h * 0.25);
      ctx.bezierCurveTo(-w * 0.2, h * 0.6, -w * 0.7, h * 0.65, -w * 0.85, h * 0.3);
      ctx.bezierCurveTo(-w * 1.05, -h * 0.1, -w * 0.5, -h * 0.5, 0, -h); ctx.fill();
      ctx.beginPath(); ctx.moveTo(0, h * 0.15); ctx.lineTo(w * 0.4, h); ctx.lineTo(-w * 0.4, h); ctx.closePath(); ctx.fill();
    },
    '\u2663'(ctx, w, h) { // ♣
      const r = w * 0.42;
      ctx.beginPath(); dot(ctx, 0, -h * 0.5, r); dot(ctx, -w * 0.55, h * 0.08, r); dot(ctx, w * 0.55, h * 0.08, r); ctx.fill();
      ctx.beginPath(); ctx.moveTo(0, -h * 0.2); ctx.lineTo(w * 0.4, h); ctx.lineTo(-w * 0.4, h); ctx.closePath(); ctx.fill();
    },
    '\u25CA'(ctx, w, h) { // ◊
      ctx.beginPath(); ctx.moveTo(0, -h); ctx.lineTo(w * 0.7, 0); ctx.lineTo(0, h); ctx.lineTo(-w * 0.7, 0); ctx.closePath(); ctx.stroke();
    },
    '\u221E'(ctx, w, h) { // ∞
      ctx.beginPath();
      for (let i = 0; i <= 48; i++) {
        const t = (i / 48) * Math.PI * 2, d = 1 + Math.sin(t) * Math.sin(t);
        const x = (w * Math.cos(t)) / d, y = (h * 1.2 * Math.sin(t) * Math.cos(t)) / d;
        if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
      }
      ctx.stroke();
    },
    '\u2248'(ctx, w, h) { // ≈
      ctx.beginPath();
      for (const k of [-h * 0.32, h * 0.32]) {
        ctx.moveTo(-w, k + h * 0.12); ctx.quadraticCurveTo(-w * 0.5, k - h * 0.4, 0, k); ctx.quadraticCurveTo(w * 0.5, k + h * 0.4, w, k - h * 0.12);
      }
      ctx.stroke();
    },
    '\u2261'(ctx, w, h) { // ≡
      ctx.beginPath();
      for (const k of [-h * 0.55, 0, h * 0.55]) { ctx.moveTo(-w, k); ctx.lineTo(w, k); }
      ctx.stroke();
    },
    '\u2295'(ctx, w, h) { // ⊕
      const r = Math.min(w, h) * 0.95;
      ctx.beginPath(); dot(ctx, 0, 0, r); ctx.moveTo(-r, 0); ctx.lineTo(r, 0); ctx.moveTo(0, -r); ctx.lineTo(0, r); ctx.stroke();
    },
    '\u2297'(ctx, w, h) { // ⊗
      const r = Math.min(w, h) * 0.95, d = r * 0.7;
      ctx.beginPath(); dot(ctx, 0, 0, r); ctx.moveTo(-d, -d); ctx.lineTo(d, d); ctx.moveTo(d, -d); ctx.lineTo(-d, d); ctx.stroke();
    },
    '\u263C'(ctx, w, h) { // ☼
      const r = w * 0.42;
      ctx.beginPath(); dot(ctx, 0, 0, r);
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
        ctx.moveTo(c * r * 1.45, s * r * 1.45); ctx.lineTo(c * w, s * Math.min(h, w * 1.15));
      }
      ctx.stroke();
    },
    '\u203B'(ctx, w, h) { // ※
      ctx.beginPath(); ctx.moveTo(-w * 0.8, -h * 0.7); ctx.lineTo(w * 0.8, h * 0.7); ctx.moveTo(w * 0.8, -h * 0.7); ctx.lineTo(-w * 0.8, h * 0.7); ctx.stroke();
      const r = Math.max(1.2, ctx.lineWidth * 0.7);
      ctx.beginPath(); dot(ctx, 0, -h * 0.72, r); dot(ctx, 0, h * 0.72, r); dot(ctx, -w * 0.88, 0, r); dot(ctx, w * 0.88, 0, r); ctx.fill();
    },
    '\u2318'(ctx, w) { // ⌘
      const a = w * 0.3, r = w * 0.3, e = a + r;
      ctx.beginPath();
      ctx.moveTo(-e, -a); ctx.lineTo(e, -a); ctx.moveTo(-e, a); ctx.lineTo(e, a);
      ctx.moveTo(-a, -e); ctx.lineTo(-a, e); ctx.moveTo(a, -e); ctx.lineTo(a, e);
      for (const sx of [-1, 1]) for (const sy of [-1, 1]) dot(ctx, sx * e, sy * e, r);
      ctx.stroke();
    },
  };
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
          if (CUSTOM[ch]) {
            ctx.translate(x + GW / 2 + jit[v][1] * 0.5, y + GH * 0.52 + jit[v][2] * 0.5);
            ctx.rotate(jit[v][0]);
            ctx.strokeStyle = ctx.fillStyle; ctx.lineWidth = style === 0 ? 2.4 : 3.4;
            ctx.lineCap = 'round'; ctx.lineJoin = 'round';
            CUSTOM[ch](ctx, GW * 0.38, GH * 0.27);
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

  PA.Glyphs = { CHARS, FIRST, COUNT, STYLES, VARIANTS, CUSTOM, frame, code, box, build };
  if (typeof module !== 'undefined' && module.exports) module.exports = PA.Glyphs;
})(typeof window !== 'undefined' ? window : globalThis);
