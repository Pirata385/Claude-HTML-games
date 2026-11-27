// Água-Tinta — renderer (owner A): 16 ink levels, ramps, the cell-diffed bg grid (with row-scroll blit and a
// sub-row CSS camera), coordinate transforms, glyph/text/sprite drawing on the main (or top) layer, knockout,
// per-glyph deformers, dense/bold variants, rare shimmer, legendary halo, inverted text, high-contrast remap and
// the 'grid' motion style.
//
// Tints (colourful theme): every glyph carries a tint role (AQ.TINT_ROLES; 0 = ink). R.tint(role) sets the role
// for the draws that follow (reset at the start of each layer); grid puts, glyph/text calls and sprites also take
// an explicit tint; sprites default to the tint registered for their art (AQ.TINTS, by frame data). Themes without
// a palette resolve every role to 0, so they render exactly as the two-colour game.
//
// Anchors: screen (CSS px) and grid-cell calls take the TOP-LEFT of the cell box; world calls
// (glyphW, textW, sprite) take the CENTRE (textW: vertical centre, x per opts.align).
(function (AQ) {
  'use strict';

  var U = AQ.util, ASPECT = AQ.ASPECT, PI2 = Math.PI * 2;
  var D = AQ.display, A = AQ.atlas;

  var R = AQ.render = {};

  // ================================================================ levels
  R.ALPHA = new Float32Array([0, 0.06, 0.10, 0.14, 0.19, 0.24, 0.30, 0.36, 0.43, 0.50, 0.58, 0.66, 0.75, 0.84, 0.92, 1]);
  var LV_ID = new Uint8Array(16), LV_HC = new Uint8Array(16);
  for (var l = 0; l < 16; l++) { LV_ID[l] = l; LV_HC[l] = l === 0 ? 0 : Math.min(15, Math.round(4 + l * 11 / 15)); }
  R.LEVEL_HC = LV_HC;
  var lvMap = LV_ID;
  // Alpha actually used per nominal level after the high-contrast remap (plain array: exact globalAlpha compares).
  var ALPHA_EFF = new Array(16);
  R.highContrast = false;
  R.decorTextures = true; // false in high contrast: pure-decoration layers (rays, snow) are skipped (§2.2)
  function rebuildAlpha() {
    var hc = !!(AQ.theme && AQ.theme.highContrast);
    lvMap = hc ? LV_HC : LV_ID;
    R.highContrast = hc;
    R.decorTextures = !hc;
    for (var i = 0; i < 16; i++) ALPHA_EFF[i] = R.ALPHA[lvMap[i]];
  }
  rebuildAlpha();
  // levelOf(nominal) → level actually drawn (after the high-contrast remap).
  R.levelOf = function (level) { return lvMap[level | 0] || 0; };

  // lv(alpha 0..1) → nearest level.
  R.lv = function (a) {
    var best = 0, bd = 2;
    for (var i = 0; i < 16; i++) { var d = Math.abs(R.ALPHA[i] - a); if (d < bd) { bd = d; best = i; } }
    return best;
  };

  // ================================================================ ramps
  R.RAMPS = {
    density: ' .·:-=+*#%@',
    water: ' .-~=',
    wave: "_.-~^'",
    light: ' .·:',
    sand: ' .,:;',
    bubble: '·°oO',
    foam: ".,'\"*",
    ink: ' .:*#%@',
    snow: " .·'",
    rain: "|'/,"
  };
  // ramp(name, v 0..1) → ch
  R.ramp = function (name, v) {
    var s = R.RAMPS[name];
    if (!s) return ' ';
    return s[Math.floor(U.clamp(v, 0, 1) * (s.length - 1))];
  };
  var rampCodes = {};
  // rampCode(name, v, bold?) → atlas code (cached per ramp).
  R.rampCode = function (name, v, bold) {
    var codes = rampCodes[name];
    if (!codes) {
      var s = R.RAMPS[name] || ' ';
      codes = rampCodes[name] = [];
      for (var i = 0; i < s.length; i++) codes.push(A.code(s[i]));
    }
    var c = codes[Math.floor(U.clamp(v, 0, 1) * (codes.length - 1))];
    return bold && c && c < A.OVERFLOW ? c | A.BOLD : c;
  };
  // Field shading helper (§2.4): v 0..1 → {code, level} with level = base·(0.75 + 0.25·frac).
  var shadeOut = { code: 0, level: 0 };
  R.shade = function (name, v, base, out) {
    var o = out || shadeOut, s = R.RAMPS[name] || ' ';
    var x = U.clamp(v, 0, 1) * (s.length - 1), i = Math.floor(x), frac = x - i;
    o.code = R.rampCode(name, i / Math.max(1, s.length - 1));
    o.level = Math.round(base * (0.75 + 0.25 * frac));
    return o;
  };
  R.code = function (ch, bold) { return A.code(ch, bold); };

  // ================================================================ tints
  var ROLES = AQ.TINT_ROLES, NROLES = ROLES.length;
  var TINT = R.TINT = Object.create(null);
  for (var ti = 0; ti < NROLES; ti++) TINT[ROLES[ti]] = ti;
  var colorful = false, curTint = 0;
  // tintIdx(role name | index) → palette index actually drawn (0 = ink; always 0 without a palette).
  function tintOf(t) {
    if (!colorful || !t) return 0;
    if (typeof t === 'number') return t > 0 && t < NROLES ? t | 0 : 0;
    return TINT[t] || 0;
  }
  R.tintIdx = tintOf;
  // tint(role): role for the following draws on the current layer and grid puts. → previous index.
  R.tint = function (t) { var p = curTint; curTint = tintOf(t); return p; };
  R.isColorful = function () { return colorful; };
  // tintCss(idx) → css colour of a palette index (the ink for 0 / no palette).
  function tintCss(idx) { var pal = AQ.theme && AQ.theme.palette; return idx && pal && pal[idx] ? pal[idx] : AQ.theme.ink; }
  R.tintCss = tintCss;
  // Art → tint registry (lines arrays by identity): AQ.TINTS maps sprite keys / art paths to roles.
  var tintByLines = typeof WeakMap === 'function' ? new WeakMap() : null;
  function isLines(v) { return Array.isArray(v) && v.length > 0 && typeof v[0] === 'string'; }
  function walkTint(v, role, depth) {
    if (!v || depth > 6 || typeof v !== 'object') return;
    if (isLines(v)) { tintByLines.set(v, role); return; }
    if (Array.isArray(v)) { for (var i = 0; i < v.length; i++) walkTint(v[i], role, depth + 1); return; }
    for (var k in v) if (Object.prototype.hasOwnProperty.call(v, k) && k !== 'masks' && k !== 'extraMasks') walkTint(v[k], role, depth + 1);
  }
  // registerTint(objOrLines, role): every lines array under obj draws in `role` by default.
  R.registerTint = function (obj, role) { if (tintByLines && TINT[role]) walkTint(obj, TINT[role], 0); };
  R.tintOfArt = function (lines) { return (tintByLines && lines && tintByLines.get(lines)) || 0; };
  // tintFor(spriteKey) → role index from AQ.TINTS.sprites (species, sightings…), 0 when none.
  R.tintFor = function (key) { var m = AQ.TINTS && AQ.TINTS.sprites; return (m && TINT[m[key]]) || 0; };
  function registerTintData() {
    var T = AQ.TINTS;
    if (!T || !tintByLines) return;
    var k;
    if (T.sprites && AQ.sprites) for (k in T.sprites) if (AQ.sprites[k]) R.registerTint(AQ.sprites[k], T.sprites[k]);
    if (T.art && AQ.art) {
      for (k in T.art) {
        var path = k.split('.'), v = AQ.art;
        for (var i = 0; i < path.length && v; i++) v = v[path[i]];
        if (v) R.registerTint(v, T.art[k]);
      }
    }
  }
  registerTintData();

  // ================================================================ motion style
  var gridStyle = false;
  function readMotionStyle() { gridStyle = AQ.settings.get('motionStyle') === 'grid'; }
  readMotionStyle();
  R.isGridStyle = function () { return gridStyle; };

  // ================================================================ camera
  var shake = { x: 0, y: 0 };
  R.cam = {
    x: 0, y: 0,
    shake: shake, // written by AQ.fx; read-only for everyone else
    set: function (x, y) { this.x = x; this.y = y; }
  };
  function camRow() { return Math.floor(R.cam.y / ASPECT); }
  R.camRow = camRow;
  // Column-snapped camera (horizontal scroll, e.g. the sailing boat): the bg canvas carries the fractional column
  // as a CSS translate, exactly like the fractional row.
  function camCol() { return Math.floor(R.cam.x); }
  R.camCol = camCol;

  // ================================================================ coordinates
  R.worldToScreen = function (wx, wy, out) {
    var o = out || {};
    o.x = D.originX + (wx - R.cam.x) * D.cellW + shake.x;
    o.y = D.originY + (wy - R.cam.y) / ASPECT * D.cellH + shake.y;
    return o;
  };
  R.screenToWorld = function (px, py, out) {
    var o = out || {};
    o.x = (px - D.originX - shake.x) / D.cellW + R.cam.x;
    o.y = (py - D.originY - shake.y) / D.cellH * ASPECT + R.cam.y;
    return o;
  };
  // World → bg grid cell, using the row/column-snapped camera (the bg canvas carries the fractions as a CSS translate).
  R.worldToCell = function (wx, wy, out) {
    var o = out || {};
    o.c = Math.floor(wx) - camCol();
    o.r = Math.floor(wy / ASPECT) - camRow();
    return o;
  };
  // Grid cell → CSS px (top-left), screen-fixed (no camera, no shake): HUD, map and title cells.
  R.cellToScreen = function (c, r, out) {
    var o = out || {};
    o.x = D.originX + c * D.cellW;
    o.y = D.originY + r * D.cellH;
    return o;
  };
  // Screen px → grid cell (screen-fixed).
  R.screenToCell = function (px, py, out) {
    var o = out || {};
    o.c = Math.floor((px - D.originX) / D.cellW);
    o.r = Math.floor((py - D.originY) / D.cellH);
    return o;
  };
  // Visible world rect {x0, y0, x1, y1} (whole canvas, incl. the centring margins).
  R.view = function (out) {
    var o = out || {};
    o.x0 = R.cam.x - D.originX / D.cellW;
    o.x1 = R.cam.x + (D.width - D.originX) / D.cellW;
    o.y0 = R.cam.y - D.originY / D.cellH * ASPECT;
    o.y1 = R.cam.y + (D.height - D.originY) / D.cellH * ASPECT;
    return o;
  };

  // ================================================================ bg grid (cell-diffed)
  var BLANK = 0xffff;
  var byLevelCount = new Int32Array(16), byLevelStart = new Int32Array(16), byLevelFill = new Int32Array(16);
  var bucket = new Int32Array(0);
  var committedRow = null, committedCol = null;

  var grid = R.grid = {
    cols: 0, rows: 0, viewRows: 0, viewCols: 0, // cols = view cols + 1 (room for the sub-column scroll)
    code: new Uint16Array(0), level: new Uint8Array(0), color: new Uint8Array(0),
    _fcode: new Uint16Array(0), _flevel: new Uint8Array(0), _fcolor: new Uint8Array(0),
    _full: true,
    lastChanged: 0,

    clear: function () { this.code.fill(0); this.level.fill(0); this.color.fill(0); curTint = 0; },

    // putCode(c, r, code, level, tint?) — tint defaults to the current R.tint().
    putCode: function (c, r, code, level, tint) {
      c |= 0; r |= 0;
      if (c < 0 || r < 0 || c >= this.cols || r >= this.rows) return;
      var i = r * this.cols + c;
      if (!code || level <= 0) { this.code[i] = 0; this.level[i] = 0; this.color[i] = 0; return; }
      this.code[i] = code;
      this.level[i] = level > 15 ? 15 : level | 0;
      this.color[i] = tint === undefined ? curTint : tintOf(tint);
    },
    put: function (c, r, ch, level, bold, tint) { this.putCode(c, r, A.code(ch, bold), level, tint); },
    // Writes only when level is higher than what the cell holds.
    putMax: function (c, r, code, level, tint) {
      c |= 0; r |= 0;
      if (c < 0 || r < 0 || c >= this.cols || r >= this.rows || !code) return;
      var i = r * this.cols + c;
      if (level > this.level[i]) {
        this.code[i] = code; this.level[i] = level > 15 ? 15 : level | 0;
        this.color[i] = tint === undefined ? curTint : tintOf(tint);
      }
    },
    _cell: { code: 0, level: 0, tint: 0 },
    // get(c,r) → {code, level, tint} (a shared object: copy the fields if you need to keep them).
    get: function (c, r) {
      var o = this._cell;
      c |= 0; r |= 0;
      if (c < 0 || r < 0 || c >= this.cols || r >= this.rows) { o.code = 0; o.level = 0; o.tint = 0; return o; }
      var i = r * this.cols + c;
      o.code = this.code[i]; o.level = this.level[i]; o.tint = this.color[i];
      return o;
    },
    // text(c, r, str, level, opts?{bold, align, tint}) → cols written
    text: function (c, r, str, level, opts) {
      var s = String(str), bold = opts && opts.bold, align = opts && opts.align, tint = opts ? opts.tint : undefined;
      var c0 = align === 'center' ? c - Math.floor(s.length / 2) : align === 'right' ? c - s.length + 1 : c;
      for (var i = 0; i < s.length; i++) if (s[i] !== ' ') this.putCode(c0 + i, r, A.code(s[i], bold), level, tint);
      return s.length;
    },
    fill: function (c0, r0, w, h, ch, level, tint) {
      var code = A.code(ch);
      for (var r = r0; r < r0 + h; r++) for (var c = c0; c < c0 + w; c++) this.putCode(c, r, code, level, tint);
    },
    // Blits a compiled frame/lines into the grid (top-left at c0, r0); spaces are skipped. tint defaults to the
    // art's registered tint, else the current one.
    blit: function (frame, c0, r0, level, bold, tint) {
      var f = R.compile(frame), w = f.w;
      if (tint === undefined && f.tint) tint = f.tint;
      for (var r = 0; r < f.h; r++) for (var c = 0; c < w; c++) {
        var code = f.codes[r * w + c];
        if (code) this.putCode(c0 + c, r0 + r, bold ? code | A.BOLD : code, level, tint);
      }
    },
    invalidate: function () { this._full = true; },
    // True when the row-snapped camera moved since the last commit (the loop then commits this frame).
    camMoved: function () { return committedRow !== null && (committedRow !== camRow() || committedCol !== camCol()); },

    // Draws changed cells onto the bg canvas: row-scroll blit when the camera moved by whole rows, one clear pass
    // (merged runs), then glyphs grouped by level (one globalAlpha per level). → number of changed cells
    commit: function () {
      var ctx = D.ctx.bg;
      if (!ctx || !this.cols) return 0;
      var cols = this.cols, rows = this.rows, n = cols * rows;
      var code = this.code, level = this.level, color = this.color, fc = this._fcode, fl = this._flevel, fk = this._fcolor;
      var cw = D.cellWd, chh = D.cellHd, ox = D.originXd, oy = D.originYd;
      var cr = camRow(), cc = camCol();
      ctx.globalAlpha = 1;
      if (!this._full && committedRow !== null && cr !== committedRow) {
        var k = cr - committedRow;
        if (Math.abs(k) < rows - 1) scrollRows(ctx, k, cols, rows, fc, fl, fk);
        else this._full = true;
      }
      if (!this._full && committedCol !== null && cc !== committedCol) {
        var kc = cc - committedCol;
        if (Math.abs(kc) < cols - 1) scrollCols(ctx, kc, cols, rows, fc, fl, fk);
        else this._full = true;
      }
      committedRow = cr; committedCol = cc;
      ctx.fillStyle = AQ.theme.bg;
      if (this._full) {
        ctx.fillRect(0, 0, D.canvases.bg.width, D.canvases.bg.height);
        fc.fill(BLANK);
        this._full = false;
      }
      var changed = 0, r, c, i, lv;
      for (r = 0; r < rows; r++) {
        var runStart = -1, base = r * cols;
        for (c = 0; c <= cols; c++) {
          var diff = false;
          if (c < cols) {
            i = base + c;
            if (code[i] !== fc[i] || level[i] !== fl[i] || color[i] !== fk[i]) {
              diff = true;
              changed++;
              if (code[i]) byLevelCount[lvMap[level[i]]]++;
            }
          }
          if (diff) { if (runStart < 0) runStart = c; }
          else if (runStart >= 0) {
            ctx.fillRect(ox + runStart * cw, oy + r * chh, (c - runStart) * cw, chh);
            runStart = -1;
          }
        }
      }
      if (changed) {
        var off = 0;
        for (lv = 0; lv < 16; lv++) { byLevelStart[lv] = off; byLevelFill[lv] = off; off += byLevelCount[lv]; }
        if (bucket.length < off) bucket = new Int32Array(Math.max(off, n));
        for (i = 0; i < n; i++) {
          if (code[i] && (code[i] !== fc[i] || level[i] !== fl[i] || color[i] !== fk[i])) bucket[byLevelFill[lvMap[level[i]]]++] = i;
        }
        for (lv = 1; lv < 16; lv++) {
          var s0 = byLevelStart[lv], s1 = byLevelFill[lv];
          if (s1 <= s0) continue;
          ctx.globalAlpha = R.ALPHA[lv];
          for (var q = s0; q < s1; q++) {
            i = bucket[q];
            var rr = (i / cols) | 0;
            A.draw(ctx, code[i], ox + (i - rr * cols) * cw, oy + rr * chh, color[i]);
          }
        }
        ctx.globalAlpha = 1;
        fc.set(code);
        fl.set(level);
        fk.set(color);
        for (lv = 0; lv < 16; lv++) byLevelCount[lv] = 0;
      }
      this.lastChanged = changed;
      return changed;
    }
  };

  // Self-blit the bg canvas by k rows and shift the front buffers, so only genuinely new cells redraw.
  function scrollRows(ctx, k, cols, rows, fc, fl, fk) {
    var cv = D.canvases.bg, W = cv.width, chh = D.cellHd, oy = D.originYd;
    var m = Math.abs(k), keep = rows - m;
    if (k > 0) { // camera moved down: content moves up
      ctx.drawImage(cv, 0, oy + m * chh, W, keep * chh, 0, oy, W, keep * chh);
      fc.copyWithin(0, m * cols); fl.copyWithin(0, m * cols); fk.copyWithin(0, m * cols);
      fc.fill(BLANK, keep * cols);
    } else {
      ctx.drawImage(cv, 0, oy, W, keep * chh, 0, oy + m * chh, W, keep * chh);
      fc.copyWithin(m * cols, 0, keep * cols); fl.copyWithin(m * cols, 0, keep * cols); fk.copyWithin(m * cols, 0, keep * cols);
      fc.fill(BLANK, 0, m * cols);
    }
  }

  // Same by k columns (horizontal camera): only the newly exposed columns redraw.
  function scrollCols(ctx, k, cols, rows, fc, fl, fk) {
    var cv = D.canvases.bg, H = cv.height, cw = D.cellWd, ox = D.originXd;
    var m = Math.abs(k), keep = cols - m, r, base;
    if (k > 0) { // camera moved right: content moves left
      ctx.drawImage(cv, ox + m * cw, 0, keep * cw, H, ox, 0, keep * cw, H);
      for (r = 0; r < rows; r++) {
        base = r * cols;
        fc.copyWithin(base, base + m, base + cols); fl.copyWithin(base, base + m, base + cols); fk.copyWithin(base, base + m, base + cols);
        fc.fill(BLANK, base + keep, base + cols);
      }
    } else {
      ctx.drawImage(cv, ox, 0, keep * cw, H, ox + m * cw, 0, keep * cw, H);
      for (r = 0; r < rows; r++) {
        base = r * cols;
        fc.copyWithin(base + m, base, base + keep); fl.copyWithin(base + m, base, base + keep); fk.copyWithin(base + m, base, base + keep);
        fc.fill(BLANK, base, base + m);
      }
    }
  }

  // ================================================================ layers / frame
  var target = 'main';
  function ctxOf() { return D.ctx[target]; }
  R.setTarget = function (name) { target = name === 'top' ? 'top' : 'main'; return R; };
  R.target = function () { return target; };
  R.ctx = function () { return ctxOf(); };

  var lastBgTransform = '';
  R.bgOffset = { x: 0, y: 0 }; // CSS px translate currently applied to the bg canvas (page-turn snapshots)
  // Sub-row scroll + shake on the bg canvas (GPU translate). Uses the row the grid was committed with.
  R.applyBgTransform = function () {
    var cv = D.canvases.bg;
    if (!cv) return;
    var row = committedRow === null ? camRow() : committedRow;
    var col = committedCol === null ? camCol() : committedCol;
    var frac = U.clamp(R.cam.y / ASPECT - row, -1, 2);
    var fracX = U.clamp(R.cam.x - col, -1, 2);
    var tx = Math.round((-fracX * D.cellW + shake.x) * D.dpr) / D.dpr;
    var ty = Math.round((-frac * D.cellH + shake.y) * D.dpr) / D.dpr;
    var t = 'translate3d(' + tx + 'px,' + ty + 'px,0)';
    R.bgOffset.x = tx; R.bgOffset.y = ty;
    if (t !== lastBgTransform) { cv.style.transform = t; lastBgTransform = t; }
  };

  var topDirty = true;
  R.beginFrame = function () {
    var m = D.ctx.main;
    if (m) { m.setTransform(1, 0, 0, 1, 0, 0); m.globalAlpha = 1; m.clearRect(0, 0, D.canvases.main.width, D.canvases.main.height); }
    target = 'main';
    curTint = 0;
    frameGlyphs = 0;
  };
  R.beginTop = function () {
    var t = D.ctx.top;
    if (t && topDirty) { t.setTransform(1, 0, 0, 1, 0, 0); t.globalAlpha = 1; t.clearRect(0, 0, D.canvases.top.width, D.canvases.top.height); topDirty = false; }
    target = 'top';
    curTint = 0;
  };
  R.markTopDirty = function () { topDirty = true; };
  R.endFrame = function () { target = 'main'; R.applyBgTransform(); };
  R.invalidate = function () { grid.invalidate(); topDirty = true; };

  // Called by AQ.display.refresh(): (re)allocates the grid (view rows + 2) and invalidates every layer.
  R.resize = function () {
    var cols = D.cols + 1, rows = D.rows + 2, n = cols * rows;
    grid.cols = cols; grid.rows = rows; grid.viewRows = D.rows; grid.viewCols = D.cols;
    if (grid.code.length !== n) {
      grid.code = new Uint16Array(n); grid.level = new Uint8Array(n); grid.color = new Uint8Array(n);
      grid._fcode = new Uint16Array(n); grid._flevel = new Uint8Array(n); grid._fcolor = new Uint8Array(n);
      bucket = new Int32Array(n);
    }
    committedRow = null; committedCol = null;
    lastBgTransform = '';
    R.invalidate();
  };
  // Called by AQ.theme (apply, and fast = a ciclo step: the atlas is re-tinted in place).
  R.onTheme = function (fast) {
    rebuildAlpha();
    colorful = !!AQ.theme.palette;
    A.setPalette(AQ.theme.palette);
    if (A.ready && D.ready) {
      if (!(fast && A.retint(AQ.theme.ink, AQ.theme.bg))) A.build(D.fontPx, D.dpr, AQ.theme.ink, D.family, { w: D.cellWd, h: D.cellHd });
    }
    R.invalidate();
  };

  // ================================================================ primitive drawing (main/top layer)
  var frameGlyphs = 0;
  R.stats = function () { return { glyphs: frameGlyphs, bgChanged: grid.lastChanged, atlas: A.count }; };

  function setAlpha(ctx, level) {
    var a = ALPHA_EFF[level];
    if (ctx.globalAlpha !== a) ctx.globalAlpha = a;
  }
  function lvClamp(level) { level = level | 0; return level < 0 ? 0 : level > 15 ? 15 : level; }

  // glyph(code, x, y, level, tint?): CSS px, top-left of the cell box.
  R.glyph = function (code, x, y, level, tint) {
    level = lvClamp(level);
    if (!code || !level) return;
    var ctx = ctxOf();
    setAlpha(ctx, level);
    A.draw(ctx, code, Math.round(x * D.dpr), Math.round(y * D.dpr), tint === undefined ? curTint : tintOf(tint));
    frameGlyphs++;
  };
  var tmp = { x: 0, y: 0 }, tmpC = { c: 0, r: 0 };
  function snapWorld(wx, wy) { // grid style: world point → top-left CSS px of its bg cell
    R.worldToCell(wx, wy, tmpC);
    var fr = R.cam.y / ASPECT - camRow();
    tmp.x = D.originX + (tmpC.c - (R.cam.x - camCol())) * D.cellW + shake.x;
    tmp.y = D.originY + (tmpC.r - fr) * D.cellH + shake.y;
    return tmp;
  }
  // glyphW(code, wx, wy, level): world point = centre of the glyph box. Snaps to cells in grid motion style.
  R.glyphW = function (code, wx, wy, level, tint) {
    if (gridStyle) { snapWorld(wx, wy); R.glyph(code, tmp.x, tmp.y, level, tint); return; }
    R.worldToScreen(wx, wy, tmp);
    R.glyph(code, tmp.x - D.cellW / 2, tmp.y - D.cellH / 2, level, tint);
  };
  // glyphC(code, c, r, level, tint?): screen grid cell.
  R.glyphC = function (code, c, r, level, tint) {
    R.glyph(code, D.originX + c * D.cellW, D.originY + r * D.cellH, level, tint);
  };

  function drawStr(str, x, y, level, bold, invert, tint) {
    var ctx = ctxOf(), cw = D.cellW, dpr = D.dpr;
    level = lvClamp(level);
    if (!level) return;
    var tk = tint === undefined ? curTint : tintOf(tint);
    if (invert) {
      // Inversion is the only highlight: ink fill at the level's alpha, glyphs in the bg colour.
      setAlpha(ctx, level);
      ctx.fillStyle = tintCss(tk);
      var x0 = Math.round(x * dpr), y0 = Math.round(y * dpr);
      ctx.fillRect(x0, y0, Math.round((x + str.length * cw) * dpr) - x0, Math.round((y + D.cellH) * dpr) - y0);
      ctx.globalAlpha = 1;
      for (var j = 0; j < str.length; j++) {
        if (str[j] !== ' ') A.drawInv(ctx, A.code(str[j], bold), Math.round((x + j * cw) * dpr), y0);
      }
      frameGlyphs += str.length;
      return;
    }
    setAlpha(ctx, level);
    for (var i = 0; i < str.length; i++) {
      var ch = str[i];
      if (ch === ' ') continue;
      A.draw(ctx, A.code(ch, bold), Math.round((x + i * cw) * dpr), Math.round(y * dpr), tk);
      frameGlyphs++;
    }
  }
  function alignOffset(len, align) { return align === 'center' ? Math.floor(len / 2) : align === 'right' ? len - 1 : 0; }

  // text(str, c, r, level, opts?{bold, align:'left'|'center'|'right', knock:false|alpha, invert, tint}) → cols drawn.
  // 'right': the last char lands in column c.
  R.text = function (str, c, r, level, opts) {
    var s = String(str);
    var c0 = c - alignOffset(s.length, opts && opts.align);
    if (opts && opts.knock) R.knockC(c0, r, s.length, 1, typeof opts.knock === 'number' ? opts.knock : 0.92);
    drawStr(s, D.originX + c0 * D.cellW, D.originY + r * D.cellH, level, opts && opts.bold, opts && opts.invert, opts ? opts.tint : undefined);
    return s.length;
  };
  // textW(str, wx, wy, level, opts?): wy = vertical centre; wx = left edge / centre / right edge per align.
  R.textW = function (str, wx, wy, level, opts) {
    var s = String(str), align = opts && opts.align, w = s.length * D.cellW, x, y;
    if (gridStyle) {
      var off = align === 'center' ? s.length / 2 : align === 'right' ? s.length : 0;
      snapWorld(wx - off + 0.5, wy);
      x = tmp.x; y = tmp.y;
    } else {
      R.worldToScreen(wx, wy, tmp);
      x = align === 'center' ? tmp.x - w / 2 : align === 'right' ? tmp.x - w : tmp.x;
      y = tmp.y - D.cellH / 2;
    }
    if (opts && opts.knock) R.knock(x, y, w, D.cellH, typeof opts.knock === 'number' ? opts.knock : 0.92);
    drawStr(s, x, y, level, opts && opts.bold, opts && opts.invert, opts ? opts.tint : undefined);
    return s.length;
  };

  // knock(x, y, w, h, alpha=.92): CSS px rect in the bg colour.
  R.knock = function (x, y, w, h, alpha) {
    var ctx = ctxOf(), dpr = D.dpr;
    var a = alpha === undefined ? 0.92 : alpha;
    if (ctx.globalAlpha !== a) ctx.globalAlpha = a;
    ctx.fillStyle = AQ.theme.bg;
    var x0 = Math.round(x * dpr), y0 = Math.round(y * dpr);
    ctx.fillRect(x0, y0, Math.round((x + w) * dpr) - x0, Math.round((y + h) * dpr) - y0);
  };
  R.knockC = function (c, r, w, h, alpha) {
    R.knock(D.originX + c * D.cellW, D.originY + r * D.cellH, w * D.cellW, h * D.cellH, alpha);
  };
  // rect(x, y, w, h, level) / rectC(c, r, w, h, level): ink-filled rect at a level's alpha (meters, inversion).
  R.rect = function (x, y, w, h, level, tint) {
    level = lvClamp(level);
    if (!level) return;
    var ctx = ctxOf(), dpr = D.dpr;
    setAlpha(ctx, level);
    ctx.fillStyle = tintCss(tint === undefined ? curTint : tintOf(tint));
    var x0 = Math.round(x * dpr), y0 = Math.round(y * dpr);
    ctx.fillRect(x0, y0, Math.round((x + w) * dpr) - x0, Math.round((y + h) * dpr) - y0);
  };
  R.rectC = function (c, r, w, h, level, tint) { R.rect(D.originX + c * D.cellW, D.originY + r * D.cellH, w * D.cellW, h * D.cellH, level, tint); };

  // ================================================================ frames
  var frameCache = typeof WeakMap === 'function' ? new WeakMap() : null;

  function Frame(lines, maskLines) {
    var p = AQ.textart.pad(lines);
    var w = p.length ? p[0].length : 0, h = p.length;
    var m = maskLines ? AQ.textart.pad(maskLines) : AQ.textart.autoMask(p);
    this.w = w; this.h = h; this.lines = p; this.maskLines = m;
    this.codes = new Uint16Array(w * h);
    this.mask = new Uint8Array(w * h);
    var spans = [], nonBlank = [];
    for (var r = 0; r < h; r++) {
      var runStart = -1;
      for (var c = 0; c <= w; c++) {
        var on = false;
        if (c < w) {
          var code = A.code(p[r][c]);
          this.codes[r * w + c] = code;
          if (code) nonBlank.push(r * w + c);
          on = !!(m[r] && m[r][c] === 'x');
          this.mask[r * w + c] = on ? 1 : 0;
        }
        if (on && runStart < 0) runStart = c;
        else if (!on && runStart >= 0) { spans.push(r, runStart, c - runStart); runStart = -1; }
      }
    }
    this.spans = spans;       // [r, c0, len, ...] knockout row spans
    this.nonBlank = nonBlank; // indices of drawable glyphs (shimmer picks one)
    this._flipped = null;
    this._dense = null;
    this._halo = null;
    this.tint = 0;            // default tint role (AQ.TINTS), set by compile()
    this.isFlipped = false;
    this.isDense = false;
  }
  Frame.prototype.flipped = function () {
    if (!this._flipped) {
      var f = new Frame(AQ.textart.mirror(this.lines), AQ.textart.mirror(this.maskLines));
      f._flipped = this;
      f.isFlipped = !this.isFlipped;
      f.isDense = this.isDense;
      f.tint = this.tint;
      this._flipped = f;
    }
    return this._flipped;
  };
  // Densified glyphs (Tinta Densa), same mask.
  Frame.prototype.densified = function () {
    if (this.isDense) return this;
    if (!this._dense) {
      var f = new Frame(AQ.textart.densify(this.lines), this.maskLines);
      f.isDense = true;
      f.isFlipped = this.isFlipped;
      f.tint = this.tint;
      this._dense = f;
    }
    return this._dense;
  };
  // Halo cells: empty cells (incl. a 1-cell border) touching a glyph, as [c, r, ...] in this frame's coords.
  Frame.prototype.halo = function () {
    if (this._halo) return this._halo;
    var w = this.w, h = this.h, out = [], codes = this.codes;
    for (var r = -1; r <= h; r++) {
      for (var c = -1; c <= w; c++) {
        if (r >= 0 && r < h && c >= 0 && c < w && codes[r * w + c]) continue;
        var near = false;
        for (var dr = -1; dr <= 1 && !near; dr++) for (var dc = -1; dc <= 1; dc++) {
          var rr = r + dr, cc = c + dc;
          if (rr >= 0 && rr < h && cc >= 0 && cc < w && codes[rr * w + cc]) { near = true; break; }
        }
        if (near) out.push(c, r);
      }
    }
    this._halo = out;
    return out;
  };
  R.Frame = Frame;

  // compile(lines, mask?) → Frame (cached by array identity).
  R.compile = function (lines, mask) {
    if (lines instanceof Frame) return lines;
    if (frameCache) {
      var hit = frameCache.get(lines);
      if (hit && hit._maskSrc === (mask || null)) return hit;
    }
    var f = new Frame(lines, mask || null);
    f._maskSrc = mask || null;
    f.tint = R.tintOfArt(lines);
    if (frameCache) frameCache.set(lines, f);
    return f;
  };

  // ================================================================ sprites
  var dout = [0, 0];
  function hash01(a, b, c) {
    var h = Math.imul((a | 0) * 374761393 + (b | 0) * 668265263 + (c | 0) * 362437, 1274126177);
    h = (h ^ (h >>> 13)) >>> 0;
    h = Math.imul(h, 0x85ebca6b) >>> 0;
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }
  R.hash01 = hash01;
  var box = { x: 0, y: 0, w: 0, h: 0 };
  var CODE_STAR = A.code('*'), CODE_DOT = A.code('.');

  // sprite(frame|lines, wx, wy, opts?) → {x, y, w, h} CSS px box (shared object) or null when culled.
  // (wx, wy) = centre of the sprite box in world units.
  // opts: {flip, level=12, bold, dense, deform='none', amp=1, t=0, knock=true|'bbox'|false, glyphMap, levelMap,
  //        dissolve=0..1, seed, shimmer:bool, halo:bool|level, time, tint (default: the art's tint, else the
  //        current R.tint()), tintMap(c, r, tint) → tint per glyph}
  // glyphMap(ch, c, r) / levelMap(c, r, level) receive RIGHT-FACING frame coordinates (as in sprite data).
  R.sprite = function (frame, wx, wy, opts) {
    var f = frame instanceof Frame ? frame : R.compile(frame);
    var o = opts || {};
    var flip = !!o.flip;
    if (flip) f = f.flipped();
    if (o.dense) f = f.densified();
    var w = f.w, h = f.h;
    if (!w || !h) return null;
    var level = o.level === undefined ? 12 : o.level;
    var bold = !!(o.bold || o.dense), amp = o.amp === undefined ? 1 : o.amp, t = o.t || 0;
    var knock = o.knock === undefined ? true : o.knock;
    var dissolve = o.dissolve || 0, seed = o.seed | 0;
    var perfP = AQ.perf && AQ.perf.params;
    var defFn = (!gridStyle && o.deform && o.deform !== 'none' && !(perfP && perfP.deform === false)) ? R.DEFORMERS[o.deform] : null;
    var cw = D.cellW, chh = D.cellH;

    var x0 = wx - w / 2, y0 = wy - h * ASPECT / 2, sx, sy;
    if (gridStyle) {
      var cr = camRow(), fr = R.cam.y / ASPECT - cr;
      sx = D.originX + (Math.round(x0) - R.cam.x) * cw + shake.x;
      sy = D.originY + (Math.round(y0 / ASPECT) - cr - fr) * chh + shake.y;
    } else {
      sx = D.originX + (x0 - R.cam.x) * cw + shake.x;
      sy = D.originY + (y0 - R.cam.y) / ASPECT * chh + shake.y;
    }
    // cull (1-cell margin for halo and deform)
    if (sx + (w + 1) * cw < 0 || sy + (h + 1) * chh < 0 || sx - cw > D.width || sy - chh > D.height) return null;
    box.x = sx; box.y = sy; box.w = w * cw; box.h = h * chh;

    var time = o.time !== undefined ? o.time : (AQ.loop ? AQ.loop.time : 0);
    var motion = AQ.fx ? AQ.fx.motion() : 1;
    var tint = o.tint !== undefined ? tintOf(o.tint) : f.tint ? tintOf(f.tint) : curTint;
    var tintMap = colorful ? o.tintMap : null;

    if (o.halo) {
      var hl = o.halo === true ? 2 : lvClamp(o.halo), hc = f.halo(), tick = Math.floor(time * (motion < 1 ? 0.5 : 1.5));
      var ctxh = ctxOf();
      setAlpha(ctxh, hl);
      for (var hi = 0; hi < hc.length; hi += 2) {
        if (hash01(hc[hi] + 64, hc[hi + 1] + 64, tick + seed) < 0.45) continue;
        A.draw(ctxh, CODE_DOT, Math.round((sx + hc[hi] * cw) * D.dpr), Math.round((sy + hc[hi + 1] * chh) * D.dpr), tint);
      }
    }

    if (knock) {
      if (knock === 'bbox' || (perfP && perfP.knock === 'bbox')) R.knock(sx, sy, w * cw, h * chh, 0.92);
      else {
        var sp = f.spans;
        for (var k = 0; k < sp.length; k += 3) R.knock(sx + sp[k + 1] * cw, sy + sp[k] * chh, sp[k + 2] * cw, chh, 0.92);
      }
    }

    // Rare shimmer: one glyph shows '*' for 0.1 s, every ~0.6–1.2 s (every ~2 s with reduced motion).
    var shimIdx = -1;
    if (o.shimmer && f.nonBlank.length) {
      var P = motion < 1 ? 2 : 0.9, tt = time + hash01(seed, 7, 3) * P;
      var kk = Math.floor(tt / P), local = tt - kk * P, start = hash01(kk, seed, 11) * (P - 0.1);
      if (local >= start && local < start + 0.1) shimIdx = f.nonBlank[Math.floor(hash01(kk, seed, 5) * f.nonBlank.length)];
    }

    var ctx = ctxOf(), dpr = D.dpr, codes = f.codes, lines = f.lines;
    var glyphMap = o.glyphMap, levelMap = o.levelMap;
    var curLevel = -1;
    for (var r = 0; r < h; r++) {
      for (var c = 0; c < w; c++) {
        var idx = r * w + c, code = codes[idx];
        if (!code) continue;
        var cR = flip ? w - 1 - c : c; // right-facing column
        if (dissolve > 0 && hash01(cR, r, seed) < dissolve) continue;
        if (glyphMap) {
          var ch0 = lines[r][c], ch1 = glyphMap(ch0, cR, r);
          if (ch1 === null || ch1 === '' || ch1 === ' ') continue;
          if (ch1 !== undefined && ch1 !== ch0) code = A.code(ch1);
        }
        var lvl = levelMap ? levelMap(cR, r, level) : level;
        if (idx === shimIdx) { code = CODE_STAR; lvl = Math.min(15, lvl + 2); }
        lvl = lvClamp(lvl);
        if (!lvl) continue;
        if (bold && code < A.OVERFLOW) code |= A.BOLD;
        var dx = 0, dy = 0;
        if (defFn) {
          dout[0] = 0; dout[1] = 0;
          defFn(cR, r, w, h, t, amp, dout);
          dx = flip ? -dout[0] : dout[0]; dy = dout[1];
        }
        if (lvl !== curLevel) { setAlpha(ctx, lvl); curLevel = lvl; }
        A.draw(ctx, code, Math.round((sx + (c + dx) * cw) * dpr), Math.round((sy + (r + dy) * chh) * dpr), tintMap ? tintOf(tintMap(cR, r, tint)) : tint);
        frameGlyphs++;
      }
    }
    return box;
  };

  // ================================================================ deformers: (c, r, w, h, t, amp, out[dx,dy]) in cells
  R.DEFORMERS = {
    // body wave: the tail (column 0 in right-facing data) lags the head
    swim: function (c, r, w, h, t, amp, out) {
      var k = Math.pow(Math.max(0, (w - c) / w), 1.5);
      var s = Math.sin(PI2 * 1.6 * t - 0.5 * c) * k;
      out[0] = 0.05 * amp * s;
      out[1] = 0.12 * amp * s;
      return out;
    },
    // bell pulse (jellies): rows ripple downward, the bell (top half) breathes sideways
    pulse: function (c, r, w, h, t, amp, out) {
      out[1] = 0.15 * amp * Math.sin(PI2 * 0.8 * t - 0.8 * r) * (r / h);
      out[0] = r < h / 2 ? (c - w / 2) * 0.04 * amp * Math.sin(PI2 * 0.8 * t) : 0;
      return out;
    },
    // plants: tips sway, the base stays put
    sway: function (c, r, w, h, t, amp, out) {
      out[0] = 0.35 * amp * Math.sin(PI2 * 0.4 * t + c * 0.3) * Math.pow(Math.max(0, (h - r) / h), 1.3);
      out[1] = 0;
      return out;
    },
    crawl: function (c, r, w, h, t, amp, out) {
      out[0] = 0;
      out[1] = 0.06 * amp * Math.abs(Math.sin(PI2 * 2 * t));
      return out;
    },
    // line tension / tells
    jitter: function (c, r, w, h, t, amp, out) {
      out[0] = amp * (U.noise3(c * 1.7, r * 2.3, t * 25) - 0.5) * 0.3;
      out[1] = amp * (U.noise3(c * 1.7 + 31.4, r * 2.3 + 17.1, t * 25) - 0.5) * 0.3;
      return out;
    },
    none: function (c, r, w, h, t, amp, out) { out[0] = 0; out[1] = 0; return out; }
  };

  AQ.events.on('settings:changed', function (p) {
    if (p.key === 'motionStyle') readMotionStyle();
  });
})(window.AQ);
