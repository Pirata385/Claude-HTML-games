// Água-Tinta — in-canvas fishing HUD (owner C, §4.8): depth ruler, tension and stamina meters, rod indicator.
// Screen-fixed (grid cells), drawn on the main layer after particles (§15.7 step 8). Avoids the DOM HUD using
// AQ.ui.hudInsets(). Two colours: emphasis through glyph choice, bold and alpha levels only.
(function (AQ) {
  'use strict';

  var U = AQ.util, ASPECT = AQ.ASPECT;
  var F = AQ.fishing = AQ.fishing || {};
  var STEPS = [0.5, 1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000];

  var lay = { topRow: 1, botRow: 20, rulerCol: 60, portrait: false, cols: 80, rows: 24, meterW: 30, insetT: 0, insetB: 0, insetR: 0 };
  var insetsAt = -1;
  var labels = { tension: '', stamina: '', rod: '', middle: '', lang: '' };
  var box = { c: 0, r: 0, w: 0 };

  function t(k, v) { return AQ.i18n.t(k, v); }
  function refreshLabels() {
    if (labels.lang === AQ.i18n.lang) return;
    labels.lang = AQ.i18n.lang;
    labels.tension = t('fish.hud.tension');
    labels.stamina = t('fish.hud.stamina');
    labels.rod = t('fish.hud.rod');
    labels.middle = t('fish.hud.keepMiddle');
  }

  // layout(): recomputes rows/cols that are free of the DOM HUD (cheap; re-read insets twice a second).
  function layout(force) {
    var D = AQ.display;
    var now = AQ.loop ? AQ.loop.time : 0;
    if (!force && now - insetsAt < 0.5 && lay.cols === D.cols && lay.rows === D.rows) return lay;
    insetsAt = now;
    var ins = { top: 0, bottom: 0, right: 0, left: 0 };
    try { if (AQ.ui && AQ.ui.hudInsets) ins = AQ.ui.hudInsets() || ins; } catch (e) { /* stub */ }
    var cw = D.cellW || 10, ch = D.cellH || 20;
    lay.cols = D.cols; lay.rows = D.rows;
    lay.portrait = D.orientation === 'portrait';
    lay.insetT = Math.ceil(Math.max(0, (ins.top || 0) - D.originY) / ch);
    lay.insetB = Math.ceil(Math.max(0, (ins.bottom || 0) - D.originY) / ch);
    lay.insetR = Math.ceil(Math.max(0, (ins.right || 0) - D.originX) / cw);
    lay.topRow = Math.min(D.rows - 4, lay.insetT);
    lay.botRow = Math.max(lay.topRow + 3, D.rows - 1 - lay.insetB);
    lay.rulerCol = Math.max(10, D.cols - 1 - lay.insetR);
    lay.meterW = lay.portrait ? U.clamp(D.cols - 14, 12, 26) : U.clamp(Math.floor(D.cols * 0.22), 16, 32);
    return lay;
  }

  // ---------------------------------------------------------------- depth ruler (right edge)
  function drawRuler(s) {
    var R = AQ.render, z = s.zone;
    if (!z) return;
    var mpu = z.mPerUnit || 0.2, camRow = R.camRow(), fr = R.cam.y / ASPECT - camRow;
    var rowsPerM = 1 / (mpu * ASPECT);
    var step = STEPS[STEPS.length - 1], lstep = step;
    for (var i = 0; i < STEPS.length; i++) if (STEPS[i] * rowsPerM >= 3) { step = STEPS[i]; break; }
    for (var j = 0; j < STEPS.length; j++) if (STEPS[j] >= step && STEPS[j] * rowsPerM >= 6) { lstep = STEPS[j]; break; }
    var col = lay.rulerCol;
    var D = AQ.display;
    var y0 = Math.max(0, R.cam.y), y1 = R.cam.y + D.rows * ASPECT;
    var m0 = Math.ceil(y0 * mpu / step) * step;
    var maxM = z.depth * mpu;
    for (var m = m0; m <= Math.min(maxM, y1 * mpu); m += step) {
      var wy = m / mpu, row = wy / ASPECT - camRow - fr;
      var rr = Math.round(row);
      if (rr < lay.topRow || rr > lay.botRow - 1) continue;
      if (Math.abs(m / lstep - Math.round(m / lstep)) < 1e-6) {
        var lab = t('fish.hud.depth', { n: AQ.i18n.num(m, m < 10 && step < 1 ? 1 : 0) });
        R.text(lab, col, rr, 9, { align: 'right' });
      } else R.text('-', col, rr, 5);
    }
    // hook marker
    if (s.hookY !== null && s.hookY !== undefined && s.hookY > 0) {
      var hr = Math.round(s.hookY / ASPECT - camRow - fr);
      if (hr >= lay.topRow && hr <= lay.botRow - 1) {
        var dm = s.hookY * mpu;
        var txt = '< ' + t('fish.hud.depth', { n: AQ.i18n.num(dm, dm < 10 ? 1 : 0) });
        R.text(txt, col, hr, 14, { align: 'right', knock: 0.85, bold: true });
      }
    }
  }

  // ---------------------------------------------------------------- meters
  var TBAR_MAX = 1.2;
  function barChar(v) { return v < 0.12 ? '.' : v < 0.35 ? ':' : v <= 0.85 ? '=' : v < 1 ? '#' : '!'; }

  function drawTension(c, r, T, danger, time, middle) {
    var R = AQ.render, D = AQ.display, W = lay.meterW;
    var hot = T > 0.85;
    var lab = labels.tension + ' ';
    R.text(lab, c, r, 12, { knock: 0.7 });
    var c0 = c + lab.length;
    R.knockC(c0, r, W + 2, 1, 0.7);
    var amp = hot ? (T - 0.85) * 12 * AQ.fx.motion() : 0;
    var codeL = R.code('['), codeR = R.code(']');
    R.glyphC(codeL, c0, r, 12);
    var fillTo = U.clamp(T / TBAR_MAX, 0, 1) * W;
    for (var i = 0; i < W; i++) {
      var v = (i + 0.5) / W * TBAR_MAX;
      var ch = barChar(v);
      var lit = i < fillTo;
      var lvl = lit ? (ch === '!' || ch === '#' ? 15 : 13) : (ch === '=' ? 7 : 5);
      if (!lit && ch === '!' && danger > 0.3 && Math.sin(time * 20) > 0) lvl = 12;
      var code = R.code(ch, lit && hot);
      var px = D.originX + (c0 + 1 + i) * D.cellW, py = D.originY + r * D.cellH;
      if (amp > 0 && lit) { px += (U.noise2(i * 3.1, time * 30) - 0.5) * amp; py += (U.noise2(i * 1.7 + 9, time * 30) - 0.5) * amp; }
      R.glyph(code, px, py, lvl);
    }
    R.glyphC(codeR, c0 + W + 1, r, 12);
    // ^ marker under the bar
    var mc = c0 + 1 + Math.min(W - 1, Math.floor(fillTo));
    R.glyphC(R.code('^', hot), mc, r + 1, hot ? 15 : 13);
    if (middle) {
      var gc0 = c0 + 1 + Math.floor(0.35 / TBAR_MAX * W), gc1 = c0 + 1 + Math.floor(0.85 / TBAR_MAX * W);
      var ml = labels.middle;
      var mcc = Math.floor((gc0 + gc1) / 2);
      R.text(ml, mcc, r - 1, 11, { align: 'center', knock: 0.6 });
    }
    box.c = c0; box.r = r; box.w = W + 2;
  }

  function drawStamina(c, r, S) {
    var R = AQ.render;
    var lab = labels.stamina + ' ';
    R.text(lab, c, r, 12, { knock: 0.7 });
    var n = Math.round(U.clamp(S, 0, 1) * 10);
    var s = '';
    for (var i = 0; i < 10; i++) s += i < n ? ')' : '-';
    R.knockC(c + lab.length, r, 10, 1, 0.7);
    R.text(s.slice(0, n), c + lab.length, r, 13);
    R.text(s.slice(n), c + lab.length + n, r, 5);
  }

  function drawRod(c, r, rod, auto) {
    var R = AQ.render;
    var lab = labels.rod + ' ';
    R.text(lab, c, r, 12, { knock: 0.7 });
    var c0 = c + lab.length;
    R.knockC(c0, r, 9, 1, 0.7);
    var left = rod < -0.2, right = rod > 0.2;
    R.text('<--', c0, r, left ? 15 : 6, { bold: rod < -0.7 });
    R.text('[', c0 + 3, r, 12);
    R.text(rod < -0.35 ? '\\' : rod > 0.35 ? '/' : '|', c0 + 4, r, 15, { bold: true });
    R.text(']', c0 + 5, r, 12);
    R.text('-->', c0 + 6, r, right ? 15 : 6, { bold: rod > 0.7 });
    if (auto !== null && auto !== undefined && Math.abs(auto) > 0.2) {
      // autoSteer assist: a small hint of where the assist pulls
      R.text(auto < 0 ? '<' : '>', auto < 0 ? c0 - 1 : c0 + 9, r, 8);
    }
  }

  // draw(t, s): s = {phase, fs|null, rod, autoRod, hookY, zone, middle}
  function draw(time, s) {
    refreshLabels();
    layout(false);
    if (s.phase !== 'idle' && s.phase !== 'aiming' && s.phase !== 'landing') drawRuler(s);
    if (s.phase !== 'fight' || !s.fs) return;
    var fs = s.fs;
    var danger = AQ.fight.danger ? AQ.fight.danger(fs) : 0;
    var b = lay.botRow;
    if (lay.portrait) {
      // FÔLEGO / TENSÃO (+ ^ row) / VARA, stacked above the DOM bottom bar
      var c = 1;
      drawRod(c, b, s.rod, s.autoRod);
      drawTension(c, b - 2, fs.T, danger, time, s.middle);
      drawStamina(c, b - 3, fs.S);
    } else {
      var c1 = 2;
      drawRod(c1, b - 1, s.rod, s.autoRod);
      var sc = c1 + labels.rod.length + 12;
      drawStamina(sc, b - 1, fs.S);
      var tc = sc + labels.stamina.length + 14;
      drawTension(Math.min(tc, lay.cols - lay.meterW - labels.tension.length - 4), b - 1, fs.T, danger, time, s.middle);
    }
  }

  // Anchor of the tension meter (CSS px) for hints.
  function anchorTension() {
    var D = AQ.display;
    return { x: D.originX + (box.c + box.w / 2) * D.cellW, y: D.originY + box.r * D.cellH };
  }

  F.hud = { draw: draw, layout: layout, anchorTension: anchorTension, lay: lay };
  AQ.events.on('lang:changed', function () { labels.lang = ''; });
  AQ.events.on('display:resize', function () { insetsAt = -1; });
})(window.AQ);
