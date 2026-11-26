// Água-Tinta — title scene (owner E), §11.1 / §10. Canvas: twinkling sky, the ASCII logo (AQ.art.logo, per-row
// sine ripple), the spaced subtitle on a wave row, a faint water field with fish swimming behind the menu, kelp and
// sand at the bottom. The HTML menu (menus.js 'title' screen) is placed under the logo through ui.titleLayout.
(function (AQ) {
  'use strict';

  var R = AQ.render, D = AQ.display, U = AQ.util;
  var rng = AQ.rng.create('title');
  var L = { cols: 0, rows: 0, logo: [], logoRows: [], logoX: 0, logoTop: 2, subRow: 8, waterTop: 10, sandRow: 30, side: false, footRows: 4 };
  var fish = [];
  var stars = [];
  var kelp = [];
  var FALLBACK_FISH = [[['><>'], ['><>']], [['><°>'], ['><°>']]];
  var SPECIES = ['manjuba', 'tainha', 'baiacu', 'palhaco', 'cavalinha', 'agulha', 'cirurgiao', 'sargo'];

  function logoLines() {
    var lg = AQ.art && AQ.art.logo;
    var wide = lg && Array.isArray(lg.wide) && lg.wide.length ? lg.wide : null;
    var tall = lg && Array.isArray(lg.tall) && lg.tall.length ? lg.tall : null;
    var w = function (ls) { return ls ? ls.reduce(function (m, s) { return Math.max(m, s.length); }, 0) : 0; };
    if (wide && L.cols >= 70 && w(wide) <= L.cols - 4) return { lines: wide, kind: 'wide' };
    if (tall && w(tall) <= L.cols - 2) return { lines: tall, kind: 'tall' };
    if (wide && w(wide) <= L.cols - 2) return { lines: wide, kind: 'wide' };
    // fallback: the title name, spaced, drawn bold
    var name = AQ.i18n.t('ui.title.name').toUpperCase();
    var spaced = name.split('').join(' ');
    return { lines: [spaced.length <= L.cols - 4 ? spaced : name], kind: 'text' };
  }

  function spriteFrames(id) {
    var s = AQ.sprites && AQ.sprites[id];
    if (s && s.frames && s.frames.length) return s.frames;
    return null;
  }

  function layout() {
    L.cols = D.cols; L.rows = D.rows;
    var lg = logoLines();
    L.logo = lg.lines;
    L.logoKind = lg.kind;
    L.logoW = L.logo.reduce(function (m, s) { return Math.max(m, s.length); }, 0);
    L.logoRows = L.logo.map(function (s) { return [s]; }); // stable arrays → compile cache
    var footPx = 56;
    L.footRows = Math.ceil(footPx / Math.max(1, D.cellH));
    L.sandRow = L.rows - L.footRows - 1;
    // side layout: landscape phone with a tall logo (no room for the wide one)
    L.side = D.orientation === 'landscape' && L.logoKind === 'tall' && D.height < 480 && L.cols >= 60;
    var menuPx = (AQ.ui && AQ.ui.root && AQ.ui.root() && AQ.ui.root().classList.contains('is-short')) ? 120 : 4 * 54;
    if (L.side) {
      L.logoTop = Math.max(1, Math.floor((L.sandRow - L.logo.length - 2) / 2));
      L.logoX = Math.floor(L.cols * 0.3);
      L.subRow = L.logoTop + L.logo.length + 1;
    } else {
      var free = L.sandRow - L.logo.length - 2 - Math.ceil(menuPx / Math.max(1, D.cellH));
      L.logoTop = U.clamp(Math.floor(free * 0.35), 1, 6);
      L.logoX = Math.floor(L.cols / 2);
      L.subRow = L.logoTop + L.logo.length + 1;
    }
    L.waterTop = L.subRow + 1;
    // HTML menu placement
    var ui = AQ.ui;
    if (ui && ui.titleLayout) {
      if (L.side) {
        ui.titleLayout.side = true;
        ui.titleLayout.menuLeft = D.originX + L.cols * 0.58 * D.cellW;
        ui.titleLayout.menuWidth = Math.min(340, L.cols * 0.38 * D.cellW);
        ui.titleLayout.menuTop = Math.max(D.safe.top + 12, D.originY + (L.sandRow * D.cellH - menuPx) / 2);
      } else {
        ui.titleLayout.side = false;
        ui.titleLayout.menuLeft = null;
        ui.titleLayout.menuWidth = null;
        ui.titleLayout.menuTop = D.originY + (L.subRow + 1.6) * D.cellH;
      }
      if (ui.layoutTitle) ui.layoutTitle();
    }
    // sky stars
    stars = [];
    var skyRows = Math.max(2, L.subRow);
    var n = Math.floor(L.cols * skyRows / 28);
    for (var i = 0; i < n; i++) stars.push({ c: rng.int(L.cols), r: rng.int(skyRows), ph: rng.range(0, 6.28), sp: rng.range(0.3, 1.1), ch: rng.pick(['.', '.', "'", '´', '·']) });
    // kelp columns
    kelp = [];
    var k = Math.max(3, Math.floor(L.cols / 16));
    for (var j = 0; j < k; j++) kelp.push({ c: Math.floor((j + 0.5) * L.cols / k + rng.range(-2, 2)), h: rng.irange(2, 4), ph: rng.range(0, 6.28), plant: rng.chance(0.5) });
    spawnFish();
  }

  function spawnFish() {
    fish = [];
    var top = L.waterTop + 1, bottom = L.sandRow - 2;
    if (bottom <= top) return;
    var count = U.clamp(Math.floor(L.cols / 22), 3, 6);
    for (var i = 0; i < count; i++) {
      var id = SPECIES[i % SPECIES.length];
      var frames = spriteFrames(id) || FALLBACK_FISH[i % 2];
      var w = frames[0].reduce(function (m, s) { return Math.max(m, s.length); }, 0);
      var dir = rng.chance(0.5) ? 1 : -1;
      fish.push({
        frames: frames.map(function (f) { return R.compile(f); }), w: w, h: frames[0].length,
        x: rng.range(0, L.cols), row: rng.range(top, bottom), dir: dir, sp: rng.range(2.2, 5.5) * (w > 8 ? 0.6 : 1),
        t: rng.range(0, 10), bob: rng.range(0, 6.28), fps: 2
      });
    }
  }

  AQ.scenes.register('title', {
    enter: function () {
      layout();
      if (AQ.ui && AQ.ui.show && !AQ.ui.isOpen('title')) AQ.ui.show('title');
    },
    exit: function () { if (AQ.ui && AQ.ui.hide) AQ.ui.hide('title'); },
    resize: function () { layout(); },
    update: function (dt) {
      var m = AQ.fx.motion();
      for (var i = 0; i < fish.length; i++) {
        var f = fish[i];
        f.t += dt;
        f.x += f.dir * f.sp * dt * (m < 1 ? 0.5 : 1);
        if (f.dir > 0 && f.x - f.w > L.cols + 2) { f.x = -f.w; f.row = rng.range(L.waterTop + 1, Math.max(L.waterTop + 2, L.sandRow - 2)); }
        if (f.dir < 0 && f.x + f.w < -2) { f.x = L.cols + f.w; f.row = rng.range(L.waterTop + 1, Math.max(L.waterTop + 2, L.sandRow - 2)); }
      }
    },
    drawBg: function (grid, t) {
      var m = AQ.fx.motion();
      // stars
      for (var i = 0; i < stars.length; i++) {
        var s = stars[i];
        var v = 0.5 + 0.5 * Math.sin(t * s.sp * (m < 1 ? 0.2 : 1) + s.ph);
        grid.put(s.c, s.r, s.ch, 1 + Math.round(v * 2));
      }
      // wave row around the subtitle
      var r = L.subRow;
      for (var c = 0; c < L.cols; c++) {
        var wv = AQ.util.noise2(c * 0.18 + t * 0.5 * m, t * 0.15);
        grid.put(c, r, R.ramp('wave', 0.15 + wv * 0.5), 3 + (wv > 0.6 ? 1 : 0));
      }
      // water texture
      for (var rr = L.waterTop; rr < L.sandRow; rr++) {
        for (var cc = 0; cc < L.cols; cc++) {
          var n = AQ.util.noise3(cc * 0.09, rr * 0.22, t * 0.12 * m);
          if (n > 0.62) grid.put(cc, rr, R.ramp('water', (n - 0.62) * 2.2), 1 + (n > 0.75 ? 1 : 0));
        }
      }
      // sand
      var sand = L.sandRow;
      for (var sc = 0; sc < L.cols; sc++) {
        var sv = AQ.util.noise1(sc * 0.37 + 3.1);
        grid.put(sc, sand, R.ramp('sand', 0.3 + sv * 0.7), 4);
        if (sand + 1 < L.rows) grid.put(sc, sand + 1, R.ramp('sand', sv * 0.6), 2);
      }
    },
    draw: function (t) {
      var m = AQ.fx.motion();
      var AS = AQ.ASPECT;
      // kelp and plants (swaying)
      for (var k = 0; k < kelp.length; k++) {
        var kp = kelp[k];
        for (var h = 0; h < kp.h; h++) {
          var row = L.sandRow - 1 - h;
          var sway = Math.sin(t * 0.8 + kp.ph + h * 0.5) * 0.35 * (h / kp.h) * m;
          var ch = kp.plant ? (h === kp.h - 1 ? ',;,' : ';:;') : ')(';
          R.textW(ch, kp.c + sway, row * AS + 1, 5, { align: 'center' });
        }
      }
      // fish
      for (var i = 0; i < fish.length; i++) {
        var f = fish[i];
        var fr = f.frames[Math.floor(f.t * f.fps) % f.frames.length];
        var y = (f.row + Math.sin(f.t * 0.9 + f.bob) * 0.25 * m) * AS + 1;
        R.sprite(fr, f.x, y, { flip: f.dir < 0, level: 6, deform: 'swim', amp: m, t: f.t, knock: true });
      }
      // logo with per-row ripple
      var top = L.logoTop;
      for (var r = 0; r < L.logoRows.length; r++) {
        var off = Math.sin(t * 1.3 + r * 0.7) * 0.4 * (m < 1 ? 0 : 1);
        var fw = L.logoRows[r][0].length;
        R.sprite(L.logoRows[r], L.logoX + off + (fw % 2 ? 0 : 0), (top + r) * AS + 1, { level: 14, knock: false, bold: L.logoKind === 'text' });
      }
      // subtitle
      var sub = AQ.i18n.t('ui.title.subtitle');
      var spaced = sub.split('').join(' ');
      var text = spaced.length + 6 <= L.cols ? spaced : sub;
      var cx = L.side ? L.logoX : Math.floor(L.cols / 2);
      R.text(' ' + text + ' ', cx, L.subRow, 11, { align: 'center', knock: true });
      AQ.fx.draw();
    }
  });
})(window.AQ);
