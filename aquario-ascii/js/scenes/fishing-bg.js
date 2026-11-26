// Água-Tinta — fishing background (owner C): drawBg pieces (§15.7) and the per-zone terrain.
// Environment = luminance fields rasterised to ramps strictly on the grid (§2.4): sky, clouds, rain, water texture,
// light rays, caustics, marine snow, static terrain (precomputed per zone and width), the surface line.
// Swaying plants (kelp, seagrass, anemones) are drawn on the main layer by drawPlants().
(function (AQ) {
  'use strict';

  var U = AQ.util, ASPECT = AQ.ASPECT;
  var F = AQ.fishing = AQ.fishing || {};

  // The seabed is endless and deterministic by world x: it is generated in chunks of CHUNK columns from
  // rng('terrain:zone:seed:k'), so the same place always gets the same floor, rocks, coral, kelp and vents.
  // Chunks around the view are kept (generated on demand while the camera scrolls), far ones are dropped.
  var CHUNK = 32, KEEP = 2; // KEEP: chunks of hysteresis beyond the needed range before one is dropped
  var chunks = Object.create(null), kLo = 0, kHi = -1;
  var floorArr = new Float64Array(0), floorX0 = 0;
  var zone = null, cols = 0, seedV = 0;
  var covers = [], plants = [], vents = []; // flat views of the loaded chunks (covers is updated in place)
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
  // floorAt(x): linear interpolation of the integer samples rawFloor(i) — identical whether or not the sample is in
  // the cache window (the window only saves time), so terrain placement never depends on where the camera is.
  function floorAt(x) {
    var xi = Math.floor(x), f = x - xi, i = xi - floorX0, a, b;
    if (i >= 0 && i < floorArr.length - 1) { a = floorArr[i]; b = floorArr[i + 1]; }
    else { a = rawFloor(xi); b = rawFloor(xi + 1); }
    return a + (b - a) * f;
  }
  function rawFloor(x) {
    if (AQ.zones && AQ.zones.floorY && zone) return AQ.zones.floorY(zone, x);
    var d = zone ? zone.depth : 70;
    return d * (0.92 + 0.06 * (U.fbm2(x * 0.05, 1.3, 3) * 2 - 1));
  }
  // keeps the floor cache on [x0, x0 + n): slides it (only new columns are sampled)
  function cacheFloor(x0, width) {
    var n = Math.max(64, (width | 0) + 96);
    x0 = Math.floor(x0);
    if (floorArr.length !== n) { floorArr = new Float64Array(n); floorX0 = x0; for (var i = 0; i < n; i++) floorArr[i] = rawFloor(x0 + i); return; }
    var k = x0 - floorX0;
    if (!k) return;
    if (Math.abs(k) >= n) { for (var j = 0; j < n; j++) floorArr[j] = rawFloor(x0 + j); }
    else if (k > 0) { floorArr.copyWithin(0, k); for (var q = n - k; q < n; q++) floorArr[q] = rawFloor(x0 + q); }
    else { floorArr.copyWithin(-k, 0, n + k); for (var w = 0; w < -k; w++) floorArr[w] = rawFloor(x0 + w); }
    floorX0 = x0;
  }

  // Art pieces (terrain decoration; sprite charset only).
  var ROCKS = [['.-.', '(__)'], [' _', '(_)'], ['.--.', '/    \\'], ['.-~-.', '(     )']];
  var CORALS = [[' Y Y', '\\|/|', ' \\|/'], ['%#%', '#@#%', '%#'], [' * *', '&*&*&', ' &&&'], ['@@', '@%@@', '%@%']];
  var BOULDERS = [['  .--.', ' /    \\', '(      )'], [' .---.', '/  .  \\', '\\_____/']];
  var CAVE = ['  .-----.', ' /       \\', '/  .---.  \\', '| |     | |'];
  var VENT = [' ^ ', '/^\\'];

  // feature density per column (the old one-screen layout's counts per view width)
  function count(rng, perCol) { var m = perCol * CHUNK, n = Math.floor(m); return n + (rng.next() < m - n ? 1 : 0); }

  // Builds chunk k (world columns [k·CHUNK, (k+1)·CHUNK)): terrain cells, covers, plants, vents.
  function buildChunk(k) {
    var rng = AQ.rng.create('terrain:' + (zone ? zone.id : 'x') + ':' + (seedV || 0) + ':' + k);
    var x0 = k * CHUNK, x1 = x0 + CHUNK;
    var cells = [], ch = { k: k, n: 0, c: null, r: null, code: null, level: null, covers: [], plants: [], vents: [] };
    var id = zone ? zone.id : 'baia';
    var depth = zone ? zone.depth : 70;
    var feat = (zone && zone.features) || [];
    function has(f) { return feat.indexOf(f) >= 0; }
    function addCell(c, r, chr, level, bold) { cells.push(c, r, C(chr, bold), level); }
    function stamp(lines, c0, rBottom, level) { // lines bottom-aligned on rBottom
      var h = lines.length;
      for (var i = 0; i < h; i++) {
        var s = lines[i];
        for (var j = 0; j < s.length; j++) if (s[j] !== ' ') addCell(c0 + j, rBottom - (h - 1 - i), s[j], level);
      }
    }
    function placeCover(cx, w, h, kind) {
      var fy = floorAt(cx);
      ch.covers.push({ x0: cx - w / 2, y0: fy - h * ASPECT, x1: cx + w / 2, y1: fy + 1, kind: kind });
    }
    function at(margin) { return rng.range(x0, x1 - (margin || 0)); }
    var i, x, c;

    // ground: top line + fill rows below the floor (sand/rock ramp)
    for (c = x0; c < x1; c++) {
      var fy = floorAt(c + 0.5), fr = Math.floor(fy / ASPECT);
      var sl = floorAt(c + 1) - floorAt(c);
      var top = sl > 0.6 ? '\\' : sl < -0.6 ? '/' : (rng.next() < 0.2 ? '.' : rng.next() < 0.5 ? ',' : '_');
      if (id === 'recife' && rng.next() < 0.2) top = rng.pick(['%', '#', '@']);
      if (id === 'abismo' && rng.next() < 0.15) top = rng.pick(['^', '/', '\\']);
      addCell(c, fr, top, 6);
      for (var q = 1; q < 6; q++) {
        var v = U.fbm2(c * 0.3, (fr + q) * 0.5, 2);
        var chr = AQ.render.ramp(id === 'kelp' || id === 'abismo' ? 'density' : 'sand', Math.max(0, v - q * 0.07) * 0.9);
        if (chr !== ' ') addCell(c, fr + q, chr, q < 2 ? 4 : 3);
      }
    }
    // rocks (every zone; the open sea floor gets only a few)
    var nRocks = count(rng, id === 'mar' ? 1 / 45 : 1 / 18);
    for (i = 0; i < nRocks; i++) {
      x = at(4);
      var rk = rng.pick(ROCKS), fr2 = Math.floor(floorAt(x + 1) / ASPECT);
      stamp(rk, Math.floor(x), fr2, 5);
      placeCover(x + rk[rk.length - 1].length / 2, rk[rk.length - 1].length + 1, rk.length, 'rock');
    }
    if (has('coral')) {
      for (i = count(rng, 1 / 12); i > 0; i--) {
        x = at(5);
        var cr = rng.pick(CORALS);
        stamp(cr, Math.floor(x), Math.floor(floorAt(x + 2) / ASPECT), 6);
        placeCover(x + 2.5, 5, cr.length, 'coral');
      }
    }
    if (has('holes')) {
      for (i = count(rng, 1 / 24); i > 0; i--) {
        x = at(5);
        stamp(['.-.', '( o )'], Math.floor(x), Math.floor(floorAt(x + 2) / ASPECT), 5);
        placeCover(x + 2.5, 5, 2, 'hole');
      }
    }
    if (has('boulders')) {
      for (i = count(rng, 1 / 20); i > 0; i--) {
        x = at(8);
        var b = rng.pick(BOULDERS);
        stamp(b, Math.floor(x), Math.floor(floorAt(x + 4) / ASPECT), 5);
        placeCover(x + 4, 8, b.length, 'boulder');
      }
    }
    if (has('caves') && rng.next() < 0.4) {
      x = at(11);
      stamp(CAVE, Math.floor(x), Math.floor(floorAt(x + 5) / ASPECT), 5);
      placeCover(x + 5.5, 7, 3, 'cave');
    }
    if (has('vents')) {
      for (i = count(rng, 1 / 30); i > 0; i--) {
        x = at(3);
        stamp(VENT, Math.floor(x), Math.floor(floorAt(x + 1.5) / ASPECT), 6);
        ch.vents.push({ x: Math.floor(x) + 1.5, y: floorAt(x + 1.5) - 3, t: rng.range(0, 2) });
        placeCover(x + 1.5, 4, 2, 'vent');
      }
    }
    if (has('cliffs') && rng.next() < 0.35) { // a rock spire rising from the abyss floor (was: walls at the view edges)
      var sx = Math.floor(at(6)), r0 = Math.floor(depth * rng.range(0.3, 0.55) / ASPECT), rB = Math.floor(floorAt(sx + 2) / ASPECT);
      var ph = rng.range(0, 50);
      for (var rr = r0; rr <= rB; rr++) {
        var grow = (rr - r0) / Math.max(1, rB - r0);
        var wl = 1 + Math.floor((U.fbm2(rr * 0.15, ph, 2) * 2 + grow * 3)), half = Math.floor(wl / 2);
        for (var qq = -half; qq <= wl - half - 1; qq++) {
          var edgeL = qq === -half, edgeR = qq === wl - half - 1;
          addCell(sx + qq, rr, edgeL ? (U.noise1(rr * 0.7 + ph) > 0.5 ? '/' : '|') : edgeR ? (U.noise1(rr * 0.7 + ph + 9) > 0.5 ? '\\' : '|') : ':', edgeL || edgeR ? 5 : 3);
        }
      }
      placeCover(sx + 0.5, Math.max(3, half * 2 + 1), Math.min(8, rB - r0), 'rock');
    }
    // plants (main layer, swaying)
    if (has('seagrass')) {
      for (i = count(rng, 1 / 7); i > 0; i--) {
        x = at(2);
        ch.plants.push({ x: x, y: floorAt(x), lines: rng.pick([[' )(', ',)(;'], [',;,'], [')(', ')('], [' ,', ';;,']]), level: 6, amp: 0.8 });
      }
    }
    if (has('anemones')) {
      for (i = count(rng, 1 / 16); i > 0; i--) {
        x = at(4);
        ch.plants.push({ x: x, y: floorAt(x), lines: ['\\|/', '\\|||/', ' (_)'], level: 7, amp: 0.6 });
      }
    }
    if (has('kelp')) {
      for (i = count(rng, 1 / 9); i > 0; i--) {
        x = at(3);
        var hRows = Math.floor(rng.range(0.35, 0.7) * floorAt(x) / ASPECT);
        var lines = [];
        for (var k2 = 0; k2 < hRows; k2++) lines.push(k2 % 3 === 0 ? ')~(' : k2 % 3 === 1 ? ' )(' : '~)(');
        ch.plants.push({ x: x, y: floorAt(x), lines: lines, level: 6, amp: 1.4, kelp: true });
        if (rng.next() < 0.5) ch.covers.push({ x0: x - 1, y0: floorAt(x) - 8, x1: x + 3, y1: floorAt(x) + 1, kind: 'kelp' });
      }
    }
    // pack cells
    var n = cells.length / 4;
    ch.n = n; ch.c = new Int32Array(n); ch.r = new Int32Array(n); ch.code = new Uint16Array(n); ch.level = new Uint8Array(n);
    for (i = 0; i < n; i++) { ch.c[i] = cells[i * 4]; ch.r[i] = cells[i * 4 + 1]; ch.code[i] = cells[i * 4 + 2]; ch.level[i] = cells[i * 4 + 3]; }
    // compile plant frames once
    for (i = 0; i < ch.plants.length; i++) ch.plants[i].frame = AQ.render.compile(AQ.textart.pad(ch.plants[i].lines));
    return ch;
  }

  function relink() {
    covers.length = 0; plants.length = 0; vents.length = 0;
    for (var k = kLo; k <= kHi; k++) {
      var ch = chunks[k];
      if (!ch) continue;
      var i;
      for (i = 0; i < ch.covers.length; i++) covers.push(ch.covers[i]);
      for (i = 0; i < ch.plants.length; i++) plants.push(ch.plants[i]);
      for (i = 0; i < ch.vents.length; i++) vents.push(ch.vents[i]);
    }
  }

  // ensure(x0, x1): the view spans world columns [x0, x1]; loads the chunks it needs (+ a margin), drops far ones.
  // → true when the loaded set (covers / plants / vents) changed.
  function ensure(x0, x1) {
    if (!zone && !cols) return false;
    cols = Math.max(10, Math.ceil(x1 - x0));
    cacheFloor(x0 - 48, cols);
    var a = Math.floor((x0 - 24) / CHUNK), b = Math.floor((x1 + 24) / CHUNK);
    var changed = false, k;
    for (k = a; k <= b; k++) if (!chunks[k]) { chunks[k] = buildChunk(k); changed = true; }
    var lo = Math.min(a, kLo), hi = Math.max(b, kHi);
    if (kHi < kLo) { lo = a; hi = b; }
    for (k = lo; k <= hi; k++) {
      if (chunks[k] && (k < a - KEEP || k > b + KEEP)) { delete chunks[k]; changed = true; }
    }
    var nLo = a, nHi = b;
    for (k = a - KEEP; k < a; k++) if (chunks[k]) { nLo = k; break; }
    for (k = b + KEEP; k > b; k--) if (chunks[k]) { nHi = k; break; }
    if (nLo !== kLo || nHi !== kHi) changed = true;
    kLo = nLo; kHi = nHi;
    if (changed) relink();
    return changed;
  }

  // setup(zoneDef, view width cols, seed, x0?) → resets the chunk cache (enter / resize / zone change) and loads the
  // chunks around the view that starts at world column x0 (default 0).
  function setup(z, width, seed, x0) {
    initCodes();
    zone = z; cols = Math.max(10, width | 0); seedV = seed || 0;
    chunks = Object.create(null); kLo = 0; kHi = -1;
    floorArr = new Float64Array(0);
    covers.length = 0; plants.length = 0; vents.length = 0;
    var vx = +x0 || 0;
    ensure(vx, vx + cols);
  }

  // ---------------------------------------------------------------- per-frame environment
  // ctx: {t, lightAt(depthFrac)→0..1, darkAt(depthFrac)→bool, hook:{x,y}|null, lantern (u), phase, minutes, weather,
  //       skyStars, thick:{y0,y1}|null, pulseCover: cover|null, frenzyX: number|null}
  function drawBg(grid, t, ctx) {
    initCodes();
    var R = AQ.render, camRow = R.camRow(), camCol = R.camCol();
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
    var night = ctx.phase === 'noite' && (weather === 'limpo' || weather === 'nublado');
    var moonCol = moonColumn(grid.viewCols || gc, ctx.minutes);
    var rim0 = (lantern - 1.2) * (lantern - 1.2);
    for (r = Math.max(0, surfRow + 1); r < gr; r++) {
      var wyr = (camRow + r) * ASPECT + 1;
      var L = rowLight[r], dark = rowDark[r];
      var dfr = wyr / depth;
      var thickRow = thick && wyr >= thick.y0 && wyr <= thick.y1;
      for (var c = 0; c < gc; c++) {
        var wc = c + camCol, wx = wc + 0.5; // world column (texture, snow and glints scroll with the world)
        if (wyr > floorAt(wx) + 1) continue;
        var lanternK = 0, rim = false;
        if (hook && dark) {
          var dx = wx - hook.x, dy = (wyr - hook.y) * 0.75, d2 = dx * dx + dy * dy;
          if (d2 < lan2) { lanternK = U.smoothstep(lantern, lantern * 0.5, Math.sqrt(d2)); rim = d2 > rim0; }
        }
        var n = U.noise2(wc * 0.11 + tt * 0.05, (camRow + r) * 0.23 - tt * 0.03);
        var thr = thickRow ? 0.56 : 0.68;
        var code = 0, lvl = 0;
        if (n > thr) {
          var v = (n - thr) / (1 - thr);
          code = R.rampCode('water', 0.25 + v * 0.75);
          // QA: the floor was 1 (6 % ink) — water now reads at 2–4 lit, 1–2 in the dark, up to 5 in the lantern
          lvl = dark ? (lanternK > 0.05 ? 2 + Math.round(3 * lanternK) : (n > 0.9 ? 3 : n > 0.74 ? 2 : 0)) : 2 + Math.round(2 * L * v);
        }
        if (!code && rays && !dark && L > 0.45 && dfr < 0.38) {
          var band = Math.sin((wx + rayDir * (camRow + r) * 1.1) * 0.33 + tt * 0.2) + Math.sin((wx * 0.7 + rayDir * (camRow + r) * 0.8) * 0.19 - tt * 0.11);
          if (band > 1.72 - 0.12 * rayMul) {
            code = rayDir > 0 ? codes.back : codes.slash;
            lvl = Math.max(1, Math.round((band - 1.6) * 4 * (1 - dfr * 2.5) * rayMul * L));
            if (lvl > 2) lvl = 2;
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
          var fall = Math.floor(tt * 0.9 + R.hash01(wc, 3, 7) * 40);
          if (R.hash01(wc, camRow + r - fall, 13) < 0.012) { code = R.rampCode('snow', 0.4 + R.hash01(wc, camRow + r, 5) * 0.6); lvl = dark ? (lanternK > 0.1 ? 3 : 1) : 2; }
        }
        // moonlight: slow glints in the top of the water column under the moon
        if (!code && night && wyr < 10 && Math.abs(c - moonCol) < 9 && R.hash01(c, camRow + r + Math.floor(tt * 1.5 + R.hash01(c, r, 2) * 9), 23) < 0.05) {
          code = R.hash01(c, r, 4) < 0.5 ? codes.quote : codes.dot; lvl = 3 + (Math.abs(c - moonCol) < 4 ? 2 : 0);
        }
        if (code && lvl > 0) grid.putCode(c, r, code, lvl > 5 ? 5 : lvl);
        else if (lanternK > 0.12 && R.hash01(wc, camRow + r, 3) < 0.04 + 0.1 * lanternK) grid.putCode(c, r, codes.mid, 1 + Math.round(2 * lanternK));
        else if (rim && R.hash01(wc, camRow + r, 11) < 0.35) grid.putCode(c, r, codes.dot, 2);
      }
    }

    // 5. terrain
    var fogK = 0.45, pulse = ctx.pulseCover;
    var kA = Math.floor((camCol - 12) / CHUNK), kB = Math.floor((camCol + gc) / CHUNK);
    for (var k = kA; k <= kB; k++) {
      var T = chunks[k];
      if (!T) continue;
      for (var i = 0; i < T.n; i++) {
        var tr = T.r[i] - camRow;
        if (tr < 0 || tr >= gr) continue;
        var wct = T.c[i], tc = wct - camCol;
        if (tc < 0 || tc >= gc) continue;
        var base = T.level[i];
        var wyt = T.r[i] * ASPECT + 1;
        var lv;
        if (rowDark[tr]) {
          lv = 2;
          if (hook) {
            var ddx = wct + 0.5 - hook.x, ddy = wyt - hook.y, dd = Math.sqrt(ddx * ddx + ddy * ddy);
            if (dd < lantern) lv = Math.max(2, Math.round(base * U.smoothstep(lantern, lantern * 0.5, dd)));
          }
        } else lv = Math.max(3, Math.round(base * (1 - fogK * U.clamp(wyt / depth, 0, 1)) * (0.65 + 0.35 * rowLight[tr])));
        if (pulse && wct + 0.5 >= pulse.x0 - 1 && wct + 0.5 <= pulse.x1 + 1 && wyt >= pulse.y0 - 2 && wyt <= pulse.y1 + 1) {
          lv = 5 + Math.round(2.5 + 2.5 * Math.sin(t * 9)); // burrow tell: the target cover pulses 5↔10
        }
        grid.putCode(tc, tr, T.code[i], lv);
      }
    }

    // 6. surface line
    var S = AQ.fx.surface, cellO = drawBg._cell || (drawBg._cell = {});
    var storm = weather === 'tempestade';
    for (c = 0; c < gc; c++) {
      // the mean surface sits mid-row (y + 1), so calm water reads as '-' / '~' and waves reach '^' / '_'
      var wcs = c + camCol, wxs = wcs + 0.5, hy = S.height(wxs) + 1, srow = Math.floor(hy / ASPECT), pp = hy / ASPECT - srow;
      var vv = U.clamp((1 - pp) - S.slope(wxs) * 0.25, 0, 0.999);
      var sr = srow - camRow;
      if (sr < 0 || sr >= gr) continue;
      var code2 = R.rampCode('wave', vv);
      if (storm && Math.abs(S.slope(wxs)) > 0.35 && R.hash01(wcs, Math.floor(t * 6), 2) < 0.5) code2 = codes.star;
      if (ctx.frenzyX !== null && ctx.frenzyX !== undefined && Math.abs(wxs - ctx.frenzyX) < 5 && R.hash01(wcs, Math.floor(t * 10), 4) < 0.6) {
        code2 = R.hash01(wcs, Math.floor(t * 10), 9) < 0.4 ? codes.star : R.hash01(wcs, Math.floor(t * 10), 8) < 0.5 ? codes.quote : codes.dot;
        grid.putCode(c, sr - 1, R.hash01(wcs, Math.floor(t * 8), 1) < 0.3 ? codes.quote : 0, 7);
      }
      var slv = 8;
      if (night && Math.abs(c - moonCol) < 7 && R.hash01(c, Math.floor(t * 3 + R.hash01(c, 1, 1) * 5), 31) < 0.4) { code2 = R.hash01(c, Math.floor(t * 3), 5) < 0.5 ? codes.star : codes.quote; slv = 11; }
      grid.putCode(c, sr, code2, slv);
      // rain rings on the surface
      if ((weather === 'chuva' || storm) && R.hash01(wcs, Math.floor(t * 5), 21) < (storm ? 0.06 : 0.035)) grid.putCode(c, sr + 1, codes.o, 3);
    }
  }

  function moonColumn(gc, minutes) {
    var m = minutes === undefined ? 720 : minutes;
    var isNightSky = m < 300 || m >= 1140;
    var frac = isNightSky ? (((m - 1140 + 1440) % 1440) / 600) : U.clamp((m - 300) / 900, 0, 1);
    return Math.round(2 + frac * (gc - 4));
  }
  var CLOUD = ['  .~~~.', '.~~   ~~.', '~~~~~~~~~~'];
  function drawSky(grid, nRows, t, ctx) {
    var R = AQ.render, gc = grid.cols, camRow = R.camRow();
    var vc = grid.viewCols || gc;
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
    var sc = Math.round(2 + frac * (vc - 4));
    var srow = Math.max(0, Math.round((nRows - 1) * (1 - Math.sin(Math.PI * U.clamp(frac, 0, 1)) * 0.8)) - 1);
    if (!(overcast && weather !== 'nublado')) grid.putCode(sc, srow, isNightSky ? codes.moon : codes.sun, weather === 'nublado' ? 3 : 5);
    // clouds
    if (overcast) {
      var nC = weather === 'nublado' ? 3 : 5;
      var drift = t * (weather === 'tempestade' ? 2.2 : 0.8);
      for (var k = 0; k < nC; k++) {
        // clouds drift with the wind and slide slowly against the boat (parallax)
        var cx = Math.floor(U.wrap(k * (gc / nC) + drift - R.cam.x * 0.25 + k * 7, gc + 14)) - 12;
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
      if (p.y < view.y0 - 2 || p.y - hgt > view.y1 + 2 || p.x + f.w < view.x0 - 2 || p.x > view.x1 + 2) continue;
      var df = U.clamp(p.y / depth, 0, 1);
      var lv = p.level;
      if (ctx.darkAt(df)) {
        lv = 2;
        if (hook) { var d = Math.hypot(p.x - hook.x, p.y - hgt / 2 - hook.y); if (d < lantern) lv = Math.max(2, Math.round(p.level * U.smoothstep(lantern, lantern * 0.5, d))); }
      } else lv = Math.max(3, Math.round(lv * (1 - 0.45 * df)));
      R.sprite(f, p.x + f.w / 2, p.y - hgt / 2 + 1, { level: lv, deform: 'sway', amp: p.amp * motion, t: t + i * 0.37, knock: false });
    }
  }

  F.bg = {
    CHUNK: CHUNK,
    setup: setup,
    ensure: ensure,
    drawBg: drawBg,
    drawPlants: drawPlants,
    floorY: floorAt,
    covers: function () { return covers; },
    vents: function () { return vents; },
    plants: function () { return plants; },
    // debug / tests: the terrain glyphs of world column x as 'row:char' strings (deterministic by world x)
    columnAt: function (x) {
      var k = Math.floor(x / CHUNK), out = [];
      if (!chunks[k] || !chunks[k - 1]) return null;
      for (var kk = k - 1; kk <= k; kk++) {
        var ch = chunks[kk];
        for (var i = 0; i < ch.n; i++) if (ch.c[i] === x) out.push(ch.r[i] + ':' + AQ.atlas.char(ch.code[i]));
      }
      return out.sort().join(' ');
    },
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
