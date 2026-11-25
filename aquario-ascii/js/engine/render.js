// Água-Tinta — renderer (owner A): 16 ink levels, ramps, the cell-diffed bg grid, camera and coordinate
// transforms, glyph/text/sprite drawing on the main (or top) layer, knockout and per-glyph deformers.
//
// Anchors: screen (CSS px) and grid-cell calls take the TOP-LEFT of the cell box; world calls
// (glyphW, textW, sprite) take the CENTRE (textW: vertical centre, x per opts.align).
(function (AQ) {
  'use strict';

  var U = AQ.util, ASPECT = AQ.ASPECT, PI2 = Math.PI * 2;
  var D = AQ.display, A = AQ.atlas;

  var R = AQ.render = {};

  // ---------------------------------------------------------------- levels
  R.ALPHA = new Float32Array([0, 0.06, 0.10, 0.14, 0.19, 0.24, 0.30, 0.36, 0.43, 0.50, 0.58, 0.66, 0.75, 0.84, 0.92, 1]);
  var LV_ID = new Uint8Array(16), LV_HC = new Uint8Array(16);
  for (var l = 0; l < 16; l++) { LV_ID[l] = l; LV_HC[l] = l === 0 ? 0 : Math.min(15, Math.round(4 + l * 11 / 15)); }
  R.LEVEL_HC = LV_HC;
  var lvMap = LV_ID;
  // Alpha actually used per level after the high-contrast remap (plain array for exact globalAlpha compares).
  var ALPHA_EFF = new Array(16);
  function rebuildAlpha() {
    lvMap = AQ.theme && AQ.theme.highContrast ? LV_HC : LV_ID;
    for (var i = 0; i < 16; i++) ALPHA_EFF[i] = R.ALPHA[lvMap[i]];
  }
  rebuildAlpha();
  R.levelOf = function (level) { return lvMap[level | 0] || 0; };

  // lv(alpha 0..1) → nearest level.
  R.lv = function (a) {
    var best = 0, bd = 2;
    for (var i = 0; i < 16; i++) { var d = Math.abs(R.ALPHA[i] - a); if (d < bd) { bd = d; best = i; } }
    return best;
  };

  // ---------------------------------------------------------------- ramps
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
    var n = s.length, i = Math.floor(U.clamp(v, 0, 1) * (n - 1));
    return s[i];
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
    return bold && c ? c | A.BOLD : c;
  };
  R.code = function (ch, bold) { return A.code(ch, bold); };

  // ---------------------------------------------------------------- motion style
  var gridStyle = false;
  function readMotionStyle() { gridStyle = AQ.settings.get('motionStyle') === 'grid'; }
  readMotionStyle();
  R.isGridStyle = function () { return gridStyle; };

  // ---------------------------------------------------------------- camera
  var shake = { x: 0, y: 0 };
  R.cam = {
    x: 0, y: 0,
    shake: shake, // written by AQ.fx; read-only for everyone else
    set: function (x, y) { this.x = x; this.y = y; }
  };
  function camRow() { return Math.floor(R.cam.y / ASPECT); }
  R.camRow = camRow;

  // ---------------------------------------------------------------- coordinates
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
  // World → bg grid cell. Uses the row-snapped camera (the bg canvas carries the fractional row as a CSS translate).
  R.worldToCell = function (wx, wy, out) {
    var o = out || {};
    o.c = Math.floor(wx - R.cam.x);
    o.r = Math.floor(wy / ASPECT) - camRow();
    return o;
  };
  // Grid cell → CSS px (top-left), screen-fixed (no camera, no shake): HUD and map/title cells.
  R.cellToScreen = function (c, r, out) {
    var o = out || {};
    o.x = D.originX + c * D.cellW;
    o.y = D.originY + r * D.cellH;
    return o;
  };

  // ---------------------------------------------------------------- bg grid (cell-diffed)
  var BLANK = 0xffff;
  var grid = R.grid = {
    cols: 0, rows: 0, viewRows: 0,
    code: new Uint16Array(0), level: new Uint8Array(0),
    _fcode: new Uint16Array(0), _flevel: new Uint8Array(0),
    _full: true,

    clear: function () { this.code.fill(0); this.level.fill(0); },

    putCode: function (c, r, code, level) {
      c |= 0; r |= 0;
      if (c < 0 || r < 0 || c >= this.cols || r >= this.rows) return;
      var i = r * this.cols + c;
      if (!code || level <= 0) { this.code[i] = 0; this.level[i] = 0; return; }
      this.code[i] = code;
      this.level[i] = level > 15 ? 15 : level | 0;
    },
    put: function (c, r, ch, level, bold) { this.putCode(c, r, A.code(ch, bold), level); },
    // Writes only when level is higher than what the cell holds.
    putMax: function (c, r, code, level) {
      c |= 0; r |= 0;
      if (c < 0 || r < 0 || c >= this.cols || r >= this.rows) return;
      var i = r * this.cols + c;
      if (level > this.level[i] && code) { this.code[i] = code; this.level[i] = level > 15 ? 15 : level | 0; }
    },
    _cell: { code: 0, level: 0 },
    // get(c,r) → {code, level} (a shared object: copy the fields if you need to keep them).
    get: function (c, r) {
      var o = this._cell;
      c |= 0; r |= 0;
      if (c < 0 || r < 0 || c >= this.cols || r >= this.rows) { o.code = 0; o.level = 0; return o; }
      var i = r * this.cols + c;
      o.code = this.code[i]; o.level = this.level[i];
      return o;
    },
    // text(c, r, str, level, opts?{bold, align}) → cols written
    text: function (c, r, str, level, opts) {
      var s = String(str), bold = opts && opts.bold, align = opts && opts.align;
      var c0 = align === 'center' ? c - Math.floor(s.length / 2) : align === 'right' ? c - s.length + 1 : c;
      for (var i = 0; i < s.length; i++) if (s[i] !== ' ') this.putCode(c0 + i, r, A.code(s[i], bold), level);
      return s.length;
    },
    fill: function (c0, r0, w, h, ch, level) {
      var code = A.code(ch);
      for (var r = r0; r < r0 + h; r++) for (var c = c0; c < c0 + w; c++) this.putCode(c, r, code, level);
    },
    invalidate: function () { this._full = true; },

    // Draws changed cells onto the bg canvas: one clear pass, then glyphs grouped by level.
    commit: function () {
      var ctx = D.ctx.bg;
      if (!ctx || !this.cols) return 0;
      var cols = this.cols, rows = this.rows, n = cols * rows;
      var code = this.code, level = this.level, fc = this._fcode, fl = this._flevel;
      var cw = D.cellWd, ch = D.cellHd, ox = D.originXd, oy = D.originYd;
      ctx.globalAlpha = 1;
      ctx.fillStyle = AQ.theme.bg;
      if (this._full) {
        ctx.fillRect(0, 0, D.canvases.bg.width, D.canvases.bg.height);
        fc.fill(BLANK);
        this._full = false;
      }
      var changed = 0, r, c, i;
      for (r = 0; r < rows; r++) {
        var runStart = -1;
        for (c = 0; c <= cols; c++) {
          var diff = false;
          if (c < cols) {
            i = r * cols + c;
            diff = code[i] !== fc[i] || level[i] !== fl[i];
            if (diff) {
              if (code[i] && level[i]) {
                var lvl = lvMap[level[i]];
                byLevelCount[lvl]++;
              }
              changed++;
            }
          }
          if (diff && runStart < 0) runStart = c;
          else if (!diff && runStart >= 0) {
            ctx.fillRect(ox + runStart * cw, oy + r * ch, (c - runStart) * cw, ch);
            runStart = -1;
          }
        }
      }
      if (changed) {
        // bucket changed, non-empty cells by effective level
        var off = 0, lv;
        for (lv = 0; lv < 16; lv++) { byLevelStart[lv] = off; off += byLevelCount[lv]; byLevelFill[lv] = byLevelStart[lv]; }
        if (bucket.length < off) bucket = new Int32Array(Math.max(off, n));
        for (i = 0; i < n; i++) {
          if ((code[i] !== fc[i] || level[i] !== fl[i]) && code[i] && level[i]) {
            lv = lvMap[level[i]];
            bucket[byLevelFill[lv]++] = i;
          }
        }
        for (lv = 1; lv < 16; lv++) {
          var s0 = byLevelStart[lv], s1 = byLevelFill[lv];
          if (s1 <= s0) continue;
          ctx.globalAlpha = R.ALPHA[lv];
          for (var k = s0; k < s1; k++) {
            i = bucket[k];
            A.draw(ctx, code[i], ox + (i % cols) * cw, oy + Math.floor(i / cols) * ch);
          }
        }
        ctx.globalAlpha = 1;
        fc.set(code);
        fl.set(level);
        for (lv = 0; lv < 16; lv++) byLevelCount[lv] = 0;
      }
      return changed;
    }
  };
  var byLevelCount = new Int32Array(16), byLevelStart = new Int32Array(16), byLevelFill = new Int32Array(16);
  var bucket = new Int32Array(0);

  // ---------------------------------------------------------------- layers / frame
  var target = 'main';
  function ctxOf() { return D.ctx[target]; }
  R.setTarget = function (name) { target = name === 'top' ? 'top' : 'main'; return R; };
  R.target = function () { return target; };
  R.ctx = function () { return ctxOf(); };

  var lastBgTransform = '';
  // Sub-row scroll + shake on the bg canvas (GPU translate).
  R.applyBgTransform = function () {
    var cv = D.canvases.bg;
    if (!cv) return;
    var frac = R.cam.y / ASPECT - camRow();
    var tx = Math.round(shake.x * D.dpr) / D.dpr;
    var ty = Math.round((-frac * D.cellH + shake.y) * D.dpr) / D.dpr;
    var t = 'translate3d(' + tx + 'px,' + ty + 'px,0)';
    if (t !== lastBgTransform) { cv.style.transform = t; lastBgTransform = t; }
  };

  var topDirty = true;
  R.beginFrame = function () {
    var m = D.ctx.main;
    if (m) { m.setTransform(1, 0, 0, 1, 0, 0); m.globalAlpha = 1; m.clearRect(0, 0, D.canvases.main.width, D.canvases.main.height); }
    target = 'main';
  };
  R.beginTop = function () {
    var t = D.ctx.top;
    if (t && topDirty) { t.setTransform(1, 0, 0, 1, 0, 0); t.globalAlpha = 1; t.clearRect(0, 0, D.canvases.top.width, D.canvases.top.height); topDirty = false; }
    target = 'top';
  };
  R.markTopDirty = function () { topDirty = true; };
  R.endFrame = function () { target = 'main'; R.applyBgTransform(); };

  R.invalidate = function () { grid.invalidate(); topDirty = true; };

  // Called by AQ.display.refresh().
  R.resize = function () {
    var cols = D.cols, rows = D.rows + 2, n = cols * rows;
    grid.cols = cols; grid.rows = rows; grid.viewRows = D.rows;
    if (grid.code.length !== n) {
      grid.code = new Uint16Array(n); grid.level = new Uint8Array(n);
      grid._fcode = new Uint16Array(n); grid._flevel = new Uint8Array(n);
      bucket = new Int32Array(n);
    }
    lastBgTransform = '';
    R.invalidate();
  };
  // Called by AQ.theme.apply().
  R.onTheme = function () {
    rebuildAlpha();
    if (A.ready && D.ready) A.build(D.fontPx, D.dpr, AQ.theme.ink, D.family, { w: D.cellWd, h: D.cellHd });
    R.invalidate();
  };

  // ---------------------------------------------------------------- primitive drawing (main/top layer)
  function setAlpha(ctx, level) {
    var a = ALPHA_EFF[level];
    if (ctx.globalAlpha !== a) ctx.globalAlpha = a;
  }
  function lvClamp(level) { level = level | 0; return level < 0 ? 0 : level > 15 ? 15 : level; }

  // glyph(code, x, y, level): CSS px, top-left of the cell box.
  R.glyph = function (code, x, y, level) {
    level = lvClamp(level);
    if (!code || !level) return;
    var ctx = ctxOf();
    setAlpha(ctx, level);
    A.draw(ctx, code, Math.round(x * D.dpr), Math.round(y * D.dpr));
  };
  var tmp = { x: 0, y: 0 }, tmpC = { c: 0, r: 0 };
  // glyphW(code, wx, wy, level): world point = centre of the glyph box. Snaps to cells in grid motion style.
  R.glyphW = function (code, wx, wy, level) {
    if (gridStyle) {
      R.worldToCell(wx, wy, tmpC);
      var fr = R.cam.y / ASPECT - camRow();
      R.glyph(code, D.originX + tmpC.c * D.cellW + shake.x, D.originY + (tmpC.r - fr) * D.cellH + shake.y, level);
      return;
    }
    R.worldToScreen(wx, wy, tmp);
    R.glyph(code, tmp.x - D.cellW / 2, tmp.y - D.cellH / 2, level);
  };
  // glyphC(code, c, r, level): screen grid cell.
  R.glyphC = function (code, c, r, level) {
    R.glyph(code, D.originX + c * D.cellW, D.originY + r * D.cellH, level);
  };

  function drawStr(str, x, y, level, bold) {
    var ctx = ctxOf(), cw = D.cellW;
    level = lvClamp(level);
    if (!level) return;
    setAlpha(ctx, level);
    for (var i = 0; i < str.length; i++) {
      var ch = str[i];
      if (ch === ' ') continue;
      A.draw(ctx, A.code(ch, bold), Math.round((x + i * cw) * D.dpr), Math.round(y * D.dpr));
    }
  }
  function alignOffset(len, align) { return align === 'center' ? Math.floor(len / 2) : align === 'right' ? len - 1 : 0; }

  // text(str, c, r, level, opts?{bold, align:'left'|'center'|'right', knock:false}) → cols drawn. 'right': last char at c.
  R.text = function (str, c, r, level, opts) {
    var s = String(str);
    var c0 = c - alignOffset(s.length, opts && opts.align);
    if (opts && opts.knock) R.knockC(c0, r, s.length, 1, typeof opts.knock === 'number' ? opts.knock : 0.92);
    drawStr(s, D.originX + c0 * D.cellW, D.originY + r * D.cellH, level, opts && opts.bold);
    return s.length;
  };
  // textW(str, wx, wy, level, opts?): wy = vertical centre; wx = left edge / centre / right edge per align.
  R.textW = function (str, wx, wy, level, opts) {
    var s = String(str), align = opts && opts.align;
    R.worldToScreen(wx, wy, tmp);
    var w = s.length * D.cellW;
    var x = align === 'center' ? tmp.x - w / 2 : align === 'right' ? tmp.x - w : tmp.x;
    var y = tmp.y - D.cellH / 2;
    if (opts && opts.knock) R.knock(x, y, w, D.cellH, typeof opts.knock === 'number' ? opts.knock : 0.92);
    drawStr(s, x, y, level, opts && opts.bold);
    return s.length;
  };

  // knock(x, y, w, h, alpha=.92): CSS px rect in bg colour.
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

  // ---------------------------------------------------------------- frames & sprites
  var frameCache = typeof WeakMap === 'function' ? new WeakMap() : null;

  function Frame(lines, maskLines) {
    var p = AQ.textart.pad(lines);
    var w = p.length ? p[0].length : 0, h = p.length;
    var m = maskLines ? AQ.textart.pad(maskLines) : AQ.textart.autoMask(p);
    this.w = w; this.h = h; this.lines = p; this.maskLines = m;
    this.codes = new Uint16Array(w * h);
    this.mask = new Uint8Array(w * h);
    var spans = [];
    for (var r = 0; r < h; r++) {
      var runStart = -1;
      for (var c = 0; c <= w; c++) {
        var on = false;
        if (c < w) {
          this.codes[r * w + c] = A.code(p[r][c]);
          on = (m[r] && m[r][c] === 'x');
          this.mask[r * w + c] = on ? 1 : 0;
        }
        if (on && runStart < 0) runStart = c;
        else if (!on && runStart >= 0) { spans.push(r, runStart, c - runStart); runStart = -1; }
      }
    }
    this.spans = spans; // [r, c0, len, ...] knockout row spans
    this._flipped = null;
    this.isFlipped = false;
  }
  Frame.prototype.flipped = function () {
    if (!this._flipped) {
      var f = new Frame(AQ.textart.mirror(this.lines), AQ.textart.mirror(this.maskLines));
      f._flipped = this;
      f.isFlipped = !this.isFlipped;
      this._flipped = f;
    }
    return this._flipped;
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
    if (frameCache) frameCache.set(lines, f);
    return f;
  };

  var dout = [0, 0];
  function hash01(c, r, seed) {
    var h = Math.imul(c * 374761393 + r * 668265263 + (seed | 0) * 2246822519, 1274126177);
    h = (h ^ (h >>> 13)) >>> 0;
    return (h % 10007) / 10007;
  }

  // sprite(frame|lines, wx, wy, opts?): (wx, wy) = centre of the sprite box in world units.
  // opts: {flip, level=12, bold, deform='none', amp=1, t=0, knock=true|'bbox'|false, glyphMap, levelMap, dissolve, seed}
  // glyphMap(ch, c, r) / levelMap(c, r, level) receive RIGHT-FACING frame coordinates (as in sprite data).
  R.sprite = function (frame, wx, wy, opts) {
    var f = frame instanceof Frame ? frame : R.compile(frame);
    var o = opts || {};
    var flip = !!o.flip;
    if (flip) f = f.flipped();
    var w = f.w, h = f.h;
    if (!w || !h) return;
    var level = o.level === undefined ? 12 : o.level;
    var bold = !!o.bold, amp = o.amp === undefined ? 1 : o.amp, t = o.t || 0;
    var knock = o.knock === undefined ? true : o.knock;
    var dissolve = o.dissolve || 0, seed = o.seed || 0;
    var perfP = AQ.perf && AQ.perf.params;
    var defFn = (!gridStyle && o.deform && o.deform !== 'none' && !(perfP && perfP.deform === false)) ? R.DEFORMERS[o.deform] : null;
    var cw = D.cellW, chh = D.cellH;

    var x0 = wx - w / 2, y0 = wy - h * ASPECT / 2, sx, sy;
    if (gridStyle) {
      var cr = camRow(), fr = R.cam.y / ASPECT - cr;
      var c0 = Math.round(x0 - R.cam.x), r0 = Math.round(y0 / ASPECT) - cr;
      sx = D.originX + c0 * cw + shake.x;
      sy = D.originY + (r0 - fr) * chh + shake.y;
    } else {
      sx = D.originX + (x0 - R.cam.x) * cw + shake.x;
      sy = D.originY + (y0 - R.cam.y) / ASPECT * chh + shake.y;
    }

    if (knock) {
      if (knock === 'bbox' || (perfP && perfP.knock === 'bbox')) R.knock(sx, sy, w * cw, h * chh, 0.92);
      else {
        var sp = f.spans;
        for (var k = 0; k < sp.length; k += 3) R.knock(sx + sp[k + 1] * cw, sy + sp[k] * chh, sp[k + 2] * cw, chh, 0.92);
      }
    }

    var ctx = ctxOf(), dpr = D.dpr, codes = f.codes, lines = f.lines;
    var glyphMap = o.glyphMap, levelMap = o.levelMap;
    var curLevel = -1;
    for (var r = 0; r < h; r++) {
      for (var c = 0; c < w; c++) {
        var code = codes[r * w + c];
        if (!code) continue;
        var cR = flip ? w - 1 - c : c; // right-facing column
        if (dissolve > 0 && hash01(cR, r, seed) < dissolve) continue;
        if (glyphMap) {
          var ch0 = lines[r][c], ch1 = glyphMap(ch0, cR, r);
          if (ch1 === null || ch1 === '' || ch1 === ' ') continue;
          if (ch1 !== undefined && ch1 !== ch0) code = A.code(ch1);
        }
        var lvl = levelMap ? levelMap(cR, r, level) : level;
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
        A.draw(ctx, code, Math.round((sx + (c + dx) * cw) * dpr), Math.round((sy + (r + dy) * chh) * dpr));
      }
    }
  };

  // ---------------------------------------------------------------- deformers: (c, r, w, h, t, amp, out[dx,dy]) in cells
  R.DEFORMERS = {
    swim: function (c, r, w, h, t, amp, out) {
      var k = Math.pow(Math.max(0, (w - c) / w), 1.5);
      var s = Math.sin(PI2 * 1.6 * t - 0.5 * c) * k;
      out[0] = 0.05 * amp * s;
      out[1] = 0.12 * amp * s;
      return out;
    },
    pulse: function (c, r, w, h, t, amp, out) {
      out[1] = 0.15 * amp * Math.sin(PI2 * 0.8 * t - 0.8 * r) * (r / h);
      out[0] = r < h / 2 ? (c - w / 2) * 0.04 * amp * Math.sin(PI2 * 0.8 * t) : 0;
      return out;
    },
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
    jitter: function (c, r, w, h, t, amp, out) {
      out[0] = amp * (U.noise3(c * 1.7, r * 2.3, t * 25) - 0.5) * 0.3;
      out[1] = amp * (U.noise3(c * 1.7 + 31.4, r * 2.3 + 17.1, t * 25) - 0.5) * 0.3;
      return out;
    },
    none: function (c, r, w, h, t, amp, out) { out[0] = 0; out[1] = 0; return out; }
  };

  AQ.events.on('settings:changed', function (p) {
    if (p.key === 'motionStyle') readMotionStyle();
    if (p.key === 'highContrast') rebuildAlpha();
  });
})(window.AQ);
