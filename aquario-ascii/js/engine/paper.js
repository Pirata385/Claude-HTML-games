// Água-Tinta — the ruled notebook page of the Paper theme (owner A).
// A screen-fixed, mostly transparent canvas over the game canvases, composited with mix-blend-mode: multiply, so
// what it holds reads as printed on the paper under the ink: faint grain, a soft vignette, a faded blue-grey rule
// under every glyph row, a faded red margin line near the left and three punched holes. Multiply never lightens,
// so near-black ink stays near-black and knockouts (sprites cut out of the water) keep their rules. The rules
// follow the screen rows (originY + r·cellH): they stay on the page while the water scrolls. Drawn once per
// resize / theme change; the canvas is shrunk to 0×0 in the other themes.
(function (AQ) {
  'use strict';

  var cv = null, ctx = null, lastKey = '';

  function ensure() {
    if (cv || typeof document === 'undefined') return cv;
    var stage = document.getElementById('stage');
    if (!stage) return null;
    cv = document.createElement('canvas');
    cv.id = 'cv-paper';
    cv.setAttribute('aria-hidden', 'true');
    stage.appendChild(cv);
    ctx = cv.getContext('2d');
    return cv;
  }

  // paint(color, alpha): theme-table colours at an alpha (no colour literals here)
  function paint(color, a) { ctx.globalAlpha = a; ctx.fillStyle = color; ctx.strokeStyle = color; }
  function hash(a, b) {
    var h = Math.imul(a * 374761393 + b * 668265263, 1274126177);
    h = (h ^ (h >>> 13)) >>> 0;
    return ((Math.imul(h, 0x85ebca6b) >>> 0) ^ (h >>> 16)) / 4294967296;
  }

  function draw() {
    var D = AQ.display, T = AQ.theme, P = T.paper;
    var W = D.widthD || Math.round(D.width * D.dpr), H = D.heightD || Math.round(D.height * D.dpr);
    if (!W || !H) return;
    if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
    cv.style.width = D.width + 'px';
    cv.style.height = D.height + 'px';
    var dpr = D.dpr, hc = T.highContrast;
    ctx.globalAlpha = 1;
    ctx.clearRect(0, 0, W, H);

    // grain: sparse specks and short fibres (deterministic)
    var n = Math.floor(W * H / (420 * dpr * dpr)), px = Math.max(1, Math.round(dpr));
    paint(P.shadow, hc ? 0.035 : 0.06);
    for (var i = 0; i < n; i++) ctx.fillRect(Math.floor(hash(i, 1) * W), Math.floor(hash(i, 2) * H), px, px);
    paint(P.shadow, hc ? 0.02 : 0.035);
    for (i = 0; i < n / 12; i++) ctx.fillRect(Math.floor(hash(i, 3) * W), Math.floor(hash(i, 4) * H), px * (2 + Math.floor(hash(i, 5) * 4)), px);
    // soft vignette (the sheet curls a little toward the edges)
    var g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.hypot(W, H) * 0.62);
    g.addColorStop(0, 'transparent');
    g.addColorStop(1, P.shadow);
    ctx.globalAlpha = hc ? 0.04 : 0.08;
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // rules: under every glyph row (row r's text sits on its rule), across the whole sheet
    var ch = D.cellHd, cw = D.cellWd, oy = D.originYd, ox = D.originXd;
    var lw = Math.max(1, Math.round(dpr));
    paint(P.rule, hc ? 0.24 : 0.28);
    for (var y = oy + ch; y < H; y += ch) ctx.fillRect(0, y - lw, W, lw);
    for (y = oy; y > 0; y -= ch) ctx.fillRect(0, y - lw, W, lw);
    // a slightly stronger header rule under the first row
    paint(P.rule, hc ? 0.16 : 0.2);
    ctx.fillRect(0, oy + ch - lw * 2, W, lw);

    // margin: faded red line ~5 columns in (fewer on narrow grids)
    var mc = D.cols >= 70 ? 6 : D.cols >= 50 ? 5 : 4;
    var mx = ox + mc * cw - Math.round(cw * 0.35);
    paint(P.margin, hc ? 0.4 : 0.42);
    ctx.fillRect(mx, 0, Math.max(1, Math.round(dpr * 1.25)), H);

    // punched holes in the margin, centred between the edge and the margin line
    var r = Math.max(3 * dpr, Math.min(cw * 0.9, H * 0.028)), hx = Math.max(r + 2 * dpr, mx * 0.45);
    [0.16, 0.5, 0.84].forEach(function (f) {
      var hy = Math.round(H * f);
      ctx.beginPath(); ctx.arc(hx, hy, r, 0, Math.PI * 2);
      paint(P.shadow, hc ? 0.16 : 0.13); ctx.fill();
      ctx.beginPath(); ctx.arc(hx, hy - r * 0.18, r * 0.86, Math.PI * 1.05, Math.PI * 1.95);
      paint(P.shadow, 0.2); ctx.lineWidth = Math.max(1, dpr * 1.2); ctx.stroke();
    });
    ctx.globalAlpha = 1;
  }

  var paper = AQ.paper = {
    canvas: function () { return cv; },
    active: function () { return !!(AQ.theme && AQ.theme.paper); },
    // refresh(): (re)draws the page in the Paper theme, hides and frees it otherwise.
    refresh: function () {
      if (!ensure()) return;
      var D = AQ.display;
      if (!paper.active()) {
        if (cv.style.display !== 'none') { cv.style.display = 'none'; cv.width = 0; cv.height = 0; lastKey = ''; }
        return;
      }
      if (!D || !D.ready) return;
      var key = [D.widthD, D.heightD, D.cellWd, D.cellHd, D.originXd, D.originYd, D.cols, AQ.theme.key].join('|');
      cv.style.display = '';
      if (key === lastKey) return;
      lastKey = key;
      draw();
    }
  };

  AQ.events.on('display:resize', function () { paper.refresh(); });
  AQ.events.on('app:ready', function () { paper.refresh(); });
})(window.AQ);
