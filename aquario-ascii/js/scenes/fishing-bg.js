// Água-Tinta — fishing background (owner C): drawBg pieces (§15.7) and the per-zone terrain.
// Environment = luminance fields rasterised to ramps strictly on the grid (§2.4): sky, clouds, rain, water texture,
// light rays, caustics, marine snow, static terrain (precomputed per zone and width), the surface line.
// Swaying plants (kelp, seagrass, anemones) are drawn on the main layer by drawPlants().
(function (AQ) {
  'use strict';

  var U = AQ.util, ASPECT = AQ.ASPECT;
  var F = AQ.fishing = AQ.fishing || {};

  // static terrain cells (world column, world row, code, level)
  var T = { n: 0, c: new Int16Array(0), r: new Int32Array(0), code: new Uint16Array(0), level: new Uint8Array(0) };
  var floorArr = new Float32Array(0), floorX0 = 0;
  var zone = null, cols = 0;
  var covers = [], plants = [], vents = [], coverIdx = [];
  var rowLight = new Float32Array(256), rowDark = new Uint8Array(256);
  var codes = null;

  function C(ch, bold) { return AQ.render.code(ch, bold); }
  function initCodes() {
    if (codes) return;
    codes = {
      dot: C('.'), quote: C("'"), comma: C(','), star: C('*'), o: C('o'), moon: C('('), sun: C('O'),
      tilde: C('~'), slash: C('/'), back: C('\\'), bar: C('|'), caret: C('^'), us: C('_'), dash: C('-'),
      mid: C('·'), colon: C(':')
    };
  }

  // ---------------------------------------------------------------- floor and terrain
  function floorAt(x) {
    var i = Math.floor(x - floorX0);
    if (i >= 0 && i < floorArr.length - 1) { var f = x - floorX0 - i; return floorArr[i] * (1 - f) + floorArr[i + 1] * f; }
    return rawFloor(x);
  }
  function rawFloor(x) {
    if (AQ.zones && AQ.zones.floorY && zone) return AQ.zones.floorY(zone, x);
    var d = zone ? zone.depth : 70;
    return d * (0.92 + 0.06 * (U.fbm2(x * 0.05, 1.3, 3) * 2 - 1));
  }

  var tmpCells = [];
  function addCell(c, r, ch, level, bold) {
    tmpCells.push(c, r, C(ch, bold), level);
  }
  function stamp(lines, c0, rBottom, level) { // lines bottom-aligned on rBottom
    var h = lines.length;
    for (var i = 0; i < h; i++) {
      var s = lines[i];
      for (var j = 0; j < s.length; j++) if (s[j] !== ' ') addCell(c0 + j, rBottom - (h - 1 - i), s[j], level);
    }
  }

  // Art pieces (terrain decoration; sprite charset only).
  var ROCKS = [['.-.', '(__)'], [' _', '(_)'], ['.--.', '/    \\'], ['.-~-.', '(     )']];
  var CORALS = [[' Y Y', '\\|/|', ' \\|/'], ['%#%', '#@#%', '%#'], [' * *', '&*&*&', ' &&&'], ['@@', '@%@@', '%@%']];
  var BOULDERS = [['  .--.', ' /    \\', '(      )'], [' .---.', '/  .  \\', '\\_____/']];
  var CAVE = ['  .-----.', ' /       \\', '/  .---.  \\', '| |     | |'];
  var VENT = [' ^ ', '/^\\'];

  // setup(zoneDef, width cols, seed) → rebuild floor, terrain cells, covers and plants. Called on enter and resize.
  function setup(z, width, seed) {
    initCodes();
    zone = z; cols = Math.max(10, width | 0);
    var rng = AQ.rng.create('terrain:' + (z ? z.id : 'x') + ':' + (seed || 0));
    floorX0 = -30;
    var nF = cols + 61;
    if (floorArr.length !== nF) floorArr = new Float32Array(nF);
    for (var i = 0; i < nF; i++) floorArr[i] = rawFloor(floorX0 + i);
    tmpCells.length = 0; covers = []; plants = []; vents = [];
    var id = z ? z.id : 'baia';
    var depth = z ? z.depth : 70;
    var feat = (z && z.features) || [];
    function has(f) { return feat.indexOf(f) >= 0; }

    // ground: top line + fill rows below the floor (sand/rock ramp)
    for (var c = -2; c < cols + 2; c++) {
      var fy = floorAt(c + 0.5), fr = Math.floor(fy / ASPECT);
      var sl = floorAt(c + 1) - floorAt(c);
      var top = sl > 0.6 ? '\\' : sl < -0.6 ? '/' : (rng.next() < 0.2 ? '.' : rng.next() < 0.5 ? ',' : '_');
      if (id === 'recife' && rng.next() < 0.2) top = rng.pick(['%', '#', '@']);
      if (id === 'abismo' && rng.next() < 0.15) top = rng.pick(['^', '/', '\\']);
      addCell(c, fr, top, 6);
      for (var k = 1; k < 6; k++) {
        var v = U.fbm2(c * 0.3, (fr + k) * 0.5, 2);
        var ch = AQ.render.ramp(id === 'kelp' || id === 'abismo' ? 'density' : 'sand', Math.max(0, v - k * 0.07) * 0.9);
        if (ch !== ' ') addCell(c, fr + k, ch, k < 2 ? 4 : 3);
      }
    }

    function placeCover(cx, w, h, kind) {
      var fy = floorAt(cx);
      covers.push({ x0: cx - w / 2, y0: fy - h * ASPECT, x1: cx + w / 2, y1: fy + 1, kind: kind });
    }
    var x;
    // rocks (every zone but the open sea floor gets a few)
    var nRocks = id === 'mar' ? 2 : Math.round(cols / 18);
    for (i = 0; i < nRocks; i++) {
      x = rng.range(2, cols - 6);
      var rk = rng.pick(ROCKS), fr2 = Math.floor(floorAt(x + 1) / ASPECT);
      stamp(rk, Math.floor(x), fr2, 5);
      placeCover(x + rk[rk.length - 1].length / 2, rk[rk.length - 1].length + 1, rk.length, 'rock');
    }
    if (has('coral')) {
      for (i = 0; i < Math.round(cols / 12); i++) {
        x = rng.range(1, cols - 6);
        var cr = rng.pick(CORALS);
        stamp(cr, Math.floor(x), Math.floor(floorAt(x + 2) / ASPECT), 6);
        placeCover(x + 2.5, 5, cr.length, 'coral');
      }
    }
    if (has('holes')) {
      for (i = 0; i < Math.round(cols / 30) + 1; i++) {
        x = rng.range(3, cols - 6);
        stamp(['.-.', '( o )'], Math.floor(x), Math.floor(floorAt(x + 2) / ASPECT), 5);
        placeCover(x + 2.5, 5, 2, 'hole');
      }
    }
    if (has('boulders')) {
      for (i = 0; i < Math.round(cols / 25) + 1; i++) {
        x = rng.range(2, cols - 9);
        var b = rng.pick(BOULDERS);
        stamp(b, Math.floor(x), Math.floor(floorAt(x + 4) / ASPECT), 5);
        placeCover(x + 4, 8, b.length, 'boulder');
      }
    }
    if (has('caves')) {
      x = rng.range(4, cols - 14);
      stamp(CAVE, Math.floor(x), Math.floor(floorAt(x + 5) / ASPECT), 5);
      placeCover(x + 5.5, 7, 3, 'cave');
    }
    if (has('vents')) {
      for (i = 0; i < Math.max(2, Math.round(cols / 30)); i++) {
        x = rng.range(3, cols - 4);
        stamp(VENT, Math.floor(x), Math.floor(floorAt(x + 1.5) / ASPECT), 6);
        vents.push({ x: Math.floor(x) + 1.5, y: floorAt(x + 1.5) - 3, t: rng.range(0, 2) });
        placeCover(x + 1.5, 4, 2, 'vent');
      }
    }
    if (has('cliffs')) { // a cliff face on each side of the view, below a third of the depth
      for (var r0 = Math.floor(depth * 0.3 / ASPECT); r0 < Math.floor(floorAt(2) / ASPECT); r0++) {
        var wl = 1 + Math.floor(U.fbm2(r0 * 0.15, 3.1, 2) * 4);
        for (var q = 0; q < wl; q++) addCell(q, r0, q === wl - 1 ? (U.noise1(r0 * 0.7) > 0.5 ? '\\' : '|') : ':', q === wl - 1 ? 5 : 3);
        var wr = 1 + Math.floor(U.fbm2(r0 * 0.15, 8.7, 2) * 4);
        for (var q2 = 0; q2 < wr; q2++) addCell(cols - 1 - q2, r0, q2 === wr - 1 ? (U.noise1(r0 * 0.7 + 9) > 0.5 ? '/' : '|') : ':', q2 === wr - 1 ? 5 : 3);
      }
    }
    // plants (main layer, swaying)
    if (has('seagrass')) {
      for (i = 0; i < Math.round(cols / 7); i++) {
        x = rng.range(0, cols - 2);
        plants.push({ x: x, y: floorAt(x), lines: rng.pick([[' )(', ',)(;'], [',;,'], [')(', ')('], [' ,', ';;,']]), level: 6, amp: 0.8 });
      }
    }
    if (has('anemones')) {
      for (i = 0; i < Math.round(cols / 20) + 1; i++) {
        x = rng.range(2, cols - 4);
        plants.push({ x: x, y: floorAt(x), lines: ['\\|/', '\\|||/', ' (_)'], level: 7, amp: 0.6 });
      }
    }
    if (has('kelp')) {
      for (i = 0; i < Math.round(cols / 9); i++) {
        x = rng.range(1, cols - 3);
        var hRows = Math.floor(rng.range(0.35, 0.7) * floorAt(x) / ASPECT);
        var lines = [];
        for (var k2 = 0; k2 < hRows; k2++) lines.push(k2 % 3 === 0 ? ')~(' : k2 % 3 === 1 ? ' )(' : '~)(');
        plants.push({ x: x, y: floorAt(x), lines: lines, level: 6, amp: 1.4, kelp: true });
        if (i % 2 === 0) covers.push({ x0: x - 1, y0: floorAt(x) - 8, x1: x + 3, y1: floorAt(x) + 1, kind: 'kelp' });
      }
    }
    // pack cells
    var n = tmpCells.length / 4;
    if (T.c.length < n) { T.c = new Int16Array(n); T.r = new Int32Array(n); T.code = new Uint16Array(n); T.level = new Uint8Array(n); }
    for (i = 0; i < n; i++) {
      T.c[i] = tmpCells[i * 4]; T.r[i] = tmpCells[i * 4 + 1]; T.code[i] = tmpCells[i * 4 + 2]; T.level[i] = tmpCells[i * 4 + 3];
    }
    T.n = n;
    tmpCells.length = 0;
    // compile plant frames once
    for (i = 0; i < plants.length; i++) plants[i].frame = AQ.render.compile(AQ.textart.pad(plants[i].lines));
    coverIdx = [];
  }

  // ---------------------------------------------------------------- per-frame environment
  // ctx: {t, lightAt(depthFrac)→0..1, darkAt(depthFrac)→bool, hook:{x,y}|null, lantern (u), phase, minutes, weather,
  //       skyStars, thick:{y0,y1}|null, pulseCover: cover|null, frenzyX: number|null}
  function drawBg(grid, t, ctx) {
    initCodes();
    var R = AQ.render, cam = R.cam, camRow = R.camRow();
    var gc = grid.cols, gr = grid.rows;
    var depth = zone ? zone.depth : 70;
    var hc = !R.decorTextures;
    var P = AQ.perf.params;
    var motion = AQ.fx.motion();
    var tt = motion < 1 ? t * 0.3 : t;
    var hook = ctx.hook, lantern = ctx.lantern || 6;
    var weather = ctx.weather || 'limpo';

    // per-row light & darkness
    if (rowLight.length < gr) { rowLight = new Float32Array(gr * 2); rowDark = new Uint8Array(gr * 2); }
    for (var r = 0; r < gr; r++) {
      var wy = (camRow + r) * ASPECT + 1;
      var df = U.clamp(wy / depth, 0, 1);
      rowLight[r] = ctx.lightAt(df);
      rowDark[r] = wy > 0 && ctx.darkAt(df) ? 1 : 0;
    }

    // 1. sky (rows above the surface)
    var surfRow = -camRow; // grid row of world row 0
    if (surfRow > 0) drawSky(grid, Math.min(surfRow, gr), tt, ctx);

    // 3/4. water texture, rays, caustics, snow
    var thick = ctx.thick;
    var rays = P.rays && !hc && rowLight.length && weather !== 'tempestade';
    var rayMul = weather === 'nublado' || weather === 'chuva' ? 0.5 : 1;
    var caust = P.caustics && depth <= 100 && !hc;
    var snow = !hc && zone && (zone.id === 'abismo' || zone.id === 'mar');
    var phaseAng = ctx.minutes !== undefined ? ((ctx.minutes - 420) / 600) : 0.5; // 0 morning … 1 evening
    var rayDir = phaseAng < 0.5 ? 1 : -1;
    var lan2 = lantern * lantern;
    for (r = Math.max(0, surfRow + 1); r < gr; r++) {
      var wyr = (camRow + r) * ASPECT + 1;
      var L = rowLight[r], dark = rowDark[r];
      var dfr = wyr / depth;
      var thickRow = thick && wyr >= thick.y0 && wyr <= thick.y1;
      for (var c = 0; c < gc; c++) {
        var wx = c + cam.x + 0.5;
        if (wyr > floorAt(wx) + 1) continue;
        var lanternK = 0;
        if (hook && dark) {
          var dx = wx - hook.x, dy = wyr - hook.y, d2 = dx * dx + dy * dy;
          if (d2 < lan2) lanternK = U.smoothstep(lantern, lantern * 0.5, Math.sqrt(d2));
        }
        var n = U.noise2(c * 0.11 + tt * 0.05, (camRow + r) * 0.23 - tt * 0.03);
        var thr = thickRow ? 0.5 : 0.6;
        var code = 0, lvl = 0;
        if (n > thr) {
          var v = (n - thr) / (1 - thr);
          code = R.rampCode('water', 0.25 + v * 0.75);
          lvl = dark ? (lanternK > 0.05 ? 1 + Math.round(2 * lanternK) : (n > 0.8 ? 1 : 0)) : 1 + Math.round(2 * L * v);
        }
        if (!code && rays && !dark && L > 0.45 && dfr < 0.5) {
          var band = Math.sin((wx + rayDir * (camRow + r) * 1.1) * 0.33 + tt * 0.2) + Math.sin((wx * 0.7 + rayDir * (camRow + r) * 0.8) * 0.19 - tt * 0.11);
          if (band > 1.45 - 0.2 * rayMul) {
            code = rayDir > 0 ? codes.back : codes.slash;
            lvl = Math.max(1, Math.round((band - 1.25) * 3 * (1 - dfr * 2) * rayMul * L));
            if (lvl > 3) lvl = 3;
          }
        }
        if (caust && !dark && L > 0.4) {
          var fl = floorAt(wx);
          if (wyr > fl - 5 && wyr <= fl - 1) {
            var cn = U.noise2(wx * 0.35 + tt * 0.4, wyr * 0.4 - tt * 0.25) * U.noise2(wx * 0.2 - tt * 0.3, wyr * 0.3 + 4.1);
            if (cn > 0.33) { code = R.rampCode('light', Math.min(1, (cn - 0.33) * 4 + 0.34)); lvl = 2 + (cn > 0.45 ? 1 : 0); }
          }
        }
        if (!code && snow) {
          var fall = Math.floor(tt * 0.9 + R.hash01(c, 3, 7) * 40);
          if (R.hash01(c, camRow + r - fall, 13) < 0.012) { code = R.rampCode('snow', 0.4 + R.hash01(c, r, 5) * 0.6); lvl = dark ? (lanternK > 0.1 ? 3 : 1) : 2; }
        }
        if (code && lvl > 0) grid.putCode(c, r, code, lvl > 5 ? 5 : lvl);
        else if (hook && lanternK > 0.3 && dark && R.hash01(c, camRow + r, 3) < 0.05) grid.putCode(c, r, codes.mid, 1);
      }
    }

    // 5. terrain
    var fogK = 0.55, pulse = ctx.pulseCover;
    for (var i = 0; i < T.n; i++) {
      var tr = T.r[i] - camRow;
      if (tr < 0 || tr >= gr) continue;
      var tc = T.c[i];
      if (tc < 0 || tc >= gc) continue;
      var base = T.level[i];
      var wyt = T.r[i] * ASPECT + 1;
      var lv;
      if (rowDark[tr]) {
        lv = 1;
        if (hook) {
          var ddx = tc + 0.5 - hook.x, ddy = wyt - hook.y, dd = Math.sqrt(ddx * ddx + ddy * ddy);
          if (dd < lantern) lv = Math.max(1, Math.round(base * U.smoothstep(lantern, lantern * 0.5, dd)));
        }
      } else lv = Math.max(1, Math.round(base * (1 - fogK * U.clamp(wyt / depth, 0, 1)) * (0.6 + 0.4 * rowLight[tr])));
      if (pulse && tc + 0.5 >= pulse.x0 - 1 && tc + 0.5 <= pulse.x1 + 1 && wyt >= pulse.y0 - 2 && wyt <= pulse.y1 + 1) {
        lv = 5 + Math.round(2.5 + 2.5 * Math.sin(t * 9)); // burrow tell: the target cover pulses 5↔10
      }
      grid.putCode(tc, tr, T.code[i], lv);
    }

    // 6. surface line
    var S = AQ.fx.surface, cellO = drawBg._cell || (drawBg._cell = {});
    var storm = weather === 'tempestade';
    for (c = 0; c < gc; c++) {
      S.cell(c + cam.x + 0.5, cellO);
      var sr = cellO.row - camRow;
      if (sr < 0 || sr >= gr) continue;
      var code2 = cellO.code;
      if (storm && Math.abs(S.slope(c + 0.5)) > 0.35 && R.hash01(c, Math.floor(t * 6), 2) < 0.5) code2 = codes.star;
      if (ctx.frenzyX !== null && ctx.frenzyX !== undefined && Math.abs(c + 0.5 - ctx.frenzyX) < 5 && R.hash01(c, Math.floor(t * 10), 4) < 0.6) {
        code2 = R.hash01(c, Math.floor(t * 10), 9) < 0.4 ? codes.star : R.hash01(c, Math.floor(t * 10), 8) < 0.5 ? codes.quote : codes.dot;
        grid.putCode(c, sr - 1, R.hash01(c, Math.floor(t * 8), 1) < 0.3 ? codes.quote : 0, 7);
      }
      grid.putCode(c, sr, code2, 8);
      // rain rings on the surface
      if ((weather === 'chuva' || storm) && R.hash01(c, Math.floor(t * 5), 21) < (storm ? 0.06 : 0.035)) grid.putCode(c, sr + 1, codes.o, 3);
    }
  }

  var CLOUD = ['  .~~~.', '.~~   ~~.', '~~~~~~~~~~'];
  function drawSky(grid, nRows, t, ctx) {
    var R = AQ.render, gc = grid.cols, camRow = R.camRow();
    var night = ctx.phase === 'noite', dusk = ctx.phase === 'amanhecer' || ctx.phase === 'entardecer';
    var weather = ctx.weather || 'limpo';
    var overcast = weather !== 'limpo';
    // stars
    if ((night || dusk) && !overcast) {
      for (var r = 0; r < nRows; r++) for (var c = 0; c < gc; c++) {
        var h = R.hash01(c, camRow + r, 17);
        if (h < (night ? 0.035 : 0.012)) {
          var tw = 0.5 + 0.5 * Math.sin(t * (1 + h * 30) + h * 100);
          grid.putCode(c, r, h < 0.01 ? codes.quote : codes.dot, 1 + Math.round(tw * 2));
        }
      }
    }
    // sun / moon by the clock (arc across the sky)
    var m = ctx.minutes === undefined ? 720 : ctx.minutes;
    var dayFrac = (m - 300) / 900; // 05:00 → 20:00
    var isNightSky = m < 300 || m >= 1140;
    var frac = isNightSky ? (((m - 1140 + 1440) % 1440) / 600) : U.clamp(dayFrac, 0, 1);
    var sc = Math.round(2 + frac * (gc - 4));
    var srow = Math.max(0, Math.round((nRows - 1) * (1 - Math.sin(Math.PI * U.clamp(frac, 0, 1)) * 0.8)) - 1);
    if (!(overcast && weather !== 'nublado')) grid.putCode(sc, srow, isNightSky ? codes.moon : codes.sun, weather === 'nublado' ? 3 : 5);
    // clouds
    if (overcast) {
      var nC = weather === 'nublado' ? 3 : 5;
      var drift = t * (weather === 'tempestade' ? 2.2 : 0.8);
      for (var k = 0; k < nC; k++) {
        var cx = Math.floor(U.wrap(k * (gc / nC) + drift + k * 7, gc + 14)) - 12;
        var cr = Math.max(0, Math.min(nRows - 3, k % 2));
        for (var i = 0; i < CLOUD.length; i++) {
          var s = CLOUD[i];
          for (var j = 0; j < s.length; j++) if (s[j] !== ' ') grid.putMax(cx + j, cr + i, R.code(s[j]), weather === 'nublado' ? 2 : 3);
        }
      }
    }
    // rain streaks with wind slant
    if (weather === 'chuva' || weather === 'tempestade') {
      var storm = weather === 'tempestade';
      var rc = R.rampCode('rain', storm ? 0.7 : 0.4);
      var fallT = Math.floor(t * (storm ? 22 : 14));
      for (var r2 = 0; r2 < nRows; r2++) for (var c2 = 0; c2 < gc; c2++) {
        if (R.hash01(c2 + r2 * (storm ? 1 : 0), camRow + r2 - fallT, 23) < (storm ? 0.09 : 0.05)) grid.putCode(c2, r2, rc, storm ? 3 : 2);
      }
    }
  }

  // Swaying plants on the main layer (step 1 of draw).
  function drawPlants(t, ctx) {
    var R = AQ.render, motion = AQ.fx.motion();
    var depth = zone ? zone.depth : 70;
    var hook = ctx.hook, lantern = ctx.lantern || 6;
    var view = R.view(drawPlants._v || (drawPlants._v = {}));
    for (var i = 0; i < plants.length; i++) {
      var p = plants[i], f = p.frame;
      var hgt = f.h * ASPECT;
      if (p.y < view.y0 - 2 || p.y - hgt > view.y1 + 2) continue;
      var df = U.clamp(p.y / depth, 0, 1);
      var lv = p.level;
      if (ctx.darkAt(df)) {
        lv = 1;
        if (hook) { var d = Math.hypot(p.x - hook.x, p.y - hgt / 2 - hook.y); if (d < lantern) lv = Math.max(1, Math.round(p.level * U.smoothstep(lantern, lantern * 0.5, d))); }
      } else lv = Math.max(2, Math.round(lv * (1 - 0.55 * df)));
      R.sprite(f, p.x + f.w / 2, p.y - hgt / 2 + 1, { level: lv, deform: 'sway', amp: p.amp * motion, t: t + i * 0.37, knock: false });
    }
  }

  F.bg = {
    setup: setup,
    drawBg: drawBg,
    drawPlants: drawPlants,
    floorY: floorAt,
    covers: function () { return covers; },
    vents: function () { return vents; },
    plants: function () { return plants; },
    // nearest cover to a world point (for tells)
    nearestCover: function (x, y) {
      var best = null, bd = Infinity;
      for (var i = 0; i < covers.length; i++) {
        var cv = covers[i];
        var px = U.clamp(x, cv.x0, cv.x1), py = U.clamp(y, cv.y0, cv.y1), d = (px - x) * (px - x) + (py - y) * (py - y);
        if (d < bd) { bd = d; best = cv; }
      }
      return best;
    }
  };
})(window.AQ);
