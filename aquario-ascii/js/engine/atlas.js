// Água-Tinta — glyph atlas (owner A). One canvas per weight (regular, bold), 16×16 slots of cellWd × cellHd
// device px. Glyphs are drawn once in full-opacity ink; alpha is NOT baked (§15.6): it is applied at draw time
// from the 16-level table, so one atlas serves every level. An inverse (bg-coloured) pair is built lazily for
// inverted text. Codes: slot (0..255) | 512 for bold. Code 0 is the blank. Codes ≥ 1024 are overflow glyphs
// drawn with fillText (one warning). The char → slot mapping is stable across rebuilds.
(function (AQ) {
  'use strict';

  var BOLD = 512, OVERFLOW = 1024, CAP = 256;
  var slotOf = Object.create(null); // ch → slot (or overflow code)
  var chars = [' '];                // slot → ch
  slotOf[' '] = 0;
  var overflow = [];                // (code - 1024) → ch
  var warned = false;
  // sets[0] = ink atlas, sets[1] = inverse (bg colour) atlas, built on first use. Each: [regular, bold].
  var sets = [{ cv: [null, null], ctx: [null, null], built: false }, { cv: [null, null], ctx: [null, null], built: false }];
  var baseline = 0, family = 'monospace', ink = AQ.THEMES.noite.ink, fontPx = 16, buildKey = '';

  var A = AQ.atlas = {
    BOLD: BOLD,
    OVERFLOW: OVERFLOW,
    capacity: CAP,
    count: 1,
    ready: false,
    builds: 0,
    cellWd: 0, cellHd: 0, fontPx: 0, dpr: 1,
    canvases: sets[0].cv,

    // build(fontPx, dpr, inkCss, family, cell?{w,h} device px, force?). Skips work when nothing changed.
    build: function (px, dpr, inkCss, fam, cell, force) {
      var cw, chh;
      if (cell) { cw = cell.w; chh = cell.h; }
      else {
        var m = document.createElement('canvas').getContext('2d');
        m.font = px + 'px ' + (fam || family);
        cw = Math.max(1, Math.round(m.measureText('M').width * dpr));
        chh = Math.max(1, Math.round(px * 1.2 * dpr));
      }
      var key = [px, dpr, inkCss, fam, cw, chh, AQ.theme ? AQ.theme.bg : ''].join('|');
      if (!force && A.ready && key === buildKey) return false;
      buildKey = key;
      fontPx = px; family = fam || family; ink = inkCss || ink;
      A.fontPx = px; A.dpr = dpr; A.cellWd = cw; A.cellHd = chh;
      prepare(0, ink);
      // Vertical placement: centre the font's ascent+descent box in the cell.
      var mt = sets[0].ctx[0].measureText('Mg|');
      var asc = mt.fontBoundingBoxAscent || mt.actualBoundingBoxAscent || px * dpr * 0.8;
      var desc = mt.fontBoundingBoxDescent || mt.actualBoundingBoxDescent || px * dpr * 0.2;
      baseline = Math.round((chh - (asc + desc)) / 2 + asc);
      for (var s = 1; s < chars.length; s++) { renderSlot(0, 0, s); renderSlot(0, 1, s); }
      sets[1].built = false; // inverse rebuilt lazily
      A.ready = true;
      A.builds++;
      return true;
    },

    // code(ch, bold=false) → int. Adds the glyph lazily.
    code: function (ch, bold) {
      if (ch === undefined || ch === null || ch === '' || ch === ' ') return 0;
      var s = slotOf[ch];
      if (s === undefined) s = add(ch);
      if (s >= OVERFLOW) return s; // overflow codes carry no bold bit
      return bold ? s | BOLD : s;
    },

    char: function (code) {
      if (code >= OVERFLOW) return overflow[code - OVERFLOW] || ' ';
      return chars[code & 511] || ' ';
    },

    // draw(ctx, code, xDev, yDev): blits the glyph's slot in ink; the caller sets globalAlpha.
    draw: function (ctx, code, xDev, yDev) { blit(0, ctx, code, xDev, yDev); },
    // drawInv(ctx, code, xDev, yDev): same glyph in the bg colour (inverted text on an ink fill).
    drawInv: function (ctx, code, xDev, yDev) {
      if (!sets[1].built) buildInverse();
      blit(1, ctx, code, xDev, yDev);
    }
  };

  function blit(set, ctx, code, xDev, yDev) {
    if (!code) return;
    if (code >= OVERFLOW) {
      ctx.font = Math.round(fontPx * A.dpr) + 'px ' + family;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = set ? AQ.theme.bg : ink;
      ctx.fillText(overflow[code - OVERFLOW] || '?', xDev + A.cellWd / 2, yDev + baseline);
      return;
    }
    var cv = sets[set].cv[(code & BOLD) ? 1 : 0];
    if (!cv) return;
    var slot = code & 511, w = A.cellWd, h = A.cellHd;
    ctx.drawImage(cv, (slot & 15) * w, (slot >> 4) * h, w, h, xDev, yDev, w, h);
  }

  function prepare(set, color) {
    var st = sets[set];
    for (var wgt = 0; wgt < 2; wgt++) {
      if (!st.cv[wgt]) st.cv[wgt] = document.createElement('canvas');
      var cv = st.cv[wgt];
      cv.width = A.cellWd * 16;
      cv.height = A.cellHd * 16;
      var c = st.ctx[wgt] = cv.getContext('2d');
      c.imageSmoothingEnabled = false;
      c.clearRect(0, 0, cv.width, cv.height);
      c.font = (wgt ? 'bold ' : '') + Math.round(fontPx * A.dpr) + 'px ' + family;
      c.textAlign = 'center';
      c.textBaseline = 'alphabetic';
      c.fillStyle = color;
    }
    st.built = true;
  }

  function buildInverse() {
    prepare(1, AQ.theme ? AQ.theme.bg : AQ.THEMES.noite.bg);
    for (var s = 1; s < chars.length; s++) { renderSlot(1, 0, s); renderSlot(1, 1, s); }
  }

  function add(ch) {
    if (chars.length >= CAP) {
      if (!warned) { warned = true; console.warn('[AQ.atlas] atlas full; drawing extra glyphs with fillText'); }
      var oc = OVERFLOW + overflow.length;
      overflow.push(ch);
      slotOf[ch] = oc;
      return oc;
    }
    var s = chars.length;
    chars.push(ch);
    slotOf[ch] = s;
    A.count = chars.length;
    if (A.ready) {
      renderSlot(0, 0, s); renderSlot(0, 1, s);
      if (sets[1].built) { renderSlot(1, 0, s); renderSlot(1, 1, s); }
    }
    return s;
  }

  function renderSlot(set, wgt, s) {
    var c = sets[set].ctx[wgt];
    if (!c) return;
    var w = A.cellWd, h = A.cellHd, x = (s & 15) * w, y = (s >> 4) * h;
    var ch = chars[s];
    c.clearRect(x, y, w, h);
    c.save();
    c.beginPath();
    c.rect(x, y, w, h);
    c.clip();
    var tw = c.measureText(ch).width;
    if (tw > w) { // fallback fonts: squeeze wide glyphs into the cell
      c.translate(x + w / 2, 0);
      c.scale(w / tw, 1);
      c.fillText(ch, 0, y + baseline);
    } else {
      c.fillText(ch, x + w / 2, y + baseline);
    }
    c.restore();
  }

  // Preload ASCII, the Latin-1 whitelist and the pt-BR letters (same slot order everywhere).
  var pre = AQ.CHARSET.text;
  for (var i = 0; i < pre.length; i++) A.code(pre[i]);
})(window.AQ);
