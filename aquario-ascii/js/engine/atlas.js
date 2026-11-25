// Água-Tinta — glyph atlas (owner A). One canvas per weight, 16×16 slots of cellWd × cellHd device px.
// Glyphs are drawn once in full-opacity ink; alpha is applied at draw time from the 16-level table.
// Codes: slot index (0..255) | 512 for bold. Code 0 is the blank (space). Codes ≥ 1024 are overflow
// glyphs drawn with fillText (one warning). The char → slot mapping is stable across rebuilds.
(function (AQ) {
  'use strict';

  var BOLD = 512, OVERFLOW = 1024, CAP = 256;
  var slotOf = Object.create(null); // ch → slot
  var chars = [' '];                // slot → ch
  slotOf[' '] = 0;
  var overflow = [];                // (code - 1024) → ch
  var overflowOf = Object.create(null);
  var warned = false;
  var canvases = [null, null], ctxs = [null, null];
  var baseline = 0, family = 'monospace', ink = AQ.THEMES.noite.ink, fontPx = 16;

  var A = AQ.atlas = {
    BOLD: BOLD,
    OVERFLOW: OVERFLOW,
    capacity: CAP,
    count: 1,
    ready: false,
    cellWd: 0, cellHd: 0, fontPx: 0, dpr: 1,
    canvases: canvases,

    // build(fontPx, dpr, inkCss, family, cell?{w,h} device px). Re-renders every known glyph.
    build: function (px, dpr, inkCss, fam, cell) {
      fontPx = px; family = fam || family; ink = inkCss || ink;
      A.fontPx = px; A.dpr = dpr;
      if (cell) { A.cellWd = cell.w; A.cellHd = cell.h; }
      else {
        var m = document.createElement('canvas').getContext('2d');
        m.font = px + 'px ' + family;
        A.cellWd = Math.max(1, Math.round(m.measureText('M').width * dpr));
        A.cellHd = Math.max(1, Math.round(px * 1.2 * dpr));
      }
      for (var wgt = 0; wgt < 2; wgt++) {
        if (!canvases[wgt]) { canvases[wgt] = document.createElement('canvas'); }
        var cv = canvases[wgt];
        cv.width = A.cellWd * 16;
        cv.height = A.cellHd * 16;
        var c = ctxs[wgt] = cv.getContext('2d');
        c.imageSmoothingEnabled = false;
        c.clearRect(0, 0, cv.width, cv.height);
        c.font = (wgt ? 'bold ' : '') + Math.round(px * dpr) + 'px ' + family;
        c.textAlign = 'center';
        c.textBaseline = 'alphabetic';
        c.fillStyle = ink;
      }
      // Vertical placement: centre the font's ascent+descent box in the cell.
      var mt = ctxs[0].measureText('Mg|');
      var asc = mt.fontBoundingBoxAscent || mt.actualBoundingBoxAscent || px * dpr * 0.8;
      var desc = mt.fontBoundingBoxDescent || mt.actualBoundingBoxDescent || px * dpr * 0.2;
      baseline = Math.round((A.cellHd - (asc + desc)) / 2 + asc);
      for (var s = 1; s < chars.length; s++) { renderSlot(0, s); renderSlot(1, s); }
      A.ready = true;
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

    // draw(ctx, code, xDev, yDev): blits the glyph's slot; caller sets globalAlpha.
    draw: function (ctx, code, xDev, yDev) {
      if (!code) return;
      if (code >= OVERFLOW) {
        ctx.font = Math.round(fontPx * A.dpr) + 'px ' + family;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'alphabetic';
        ctx.fillStyle = ink;
        ctx.fillText(overflow[code - OVERFLOW] || '?', xDev + A.cellWd / 2, yDev + baseline);
        return;
      }
      var slot = code & 511, w = A.cellWd, h = A.cellHd;
      var cv = canvases[(code & BOLD) ? 1 : 0];
      if (!cv) return;
      ctx.drawImage(cv, (slot & 15) * w, (slot >> 4) * h, w, h, xDev, yDev, w, h);
    }
  };

  function add(ch) {
    if (chars.length >= CAP) {
      if (overflowOf[ch] !== undefined) return overflowOf[ch];
      if (!warned) { warned = true; console.warn('[AQ.atlas] atlas full; drawing extra glyphs with fillText'); }
      var oc = OVERFLOW + overflow.length;
      overflow.push(ch);
      overflowOf[ch] = oc;
      slotOf[ch] = oc;
      return oc;
    }
    var s = chars.length;
    chars.push(ch);
    slotOf[ch] = s;
    A.count = chars.length;
    if (A.ready) { renderSlot(0, s); renderSlot(1, s); }
    return s;
  }

  function renderSlot(wgt, s) {
    var c = ctxs[wgt];
    if (!c) return;
    var w = A.cellWd, h = A.cellHd, x = (s & 15) * w, y = (s >> 4) * h;
    var ch = chars[s];
    c.clearRect(x, y, w, h);
    c.save();
    c.beginPath();
    c.rect(x, y, w, h);
    c.clip();
    var tw = c.measureText(ch).width;
    if (tw > w) {
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
