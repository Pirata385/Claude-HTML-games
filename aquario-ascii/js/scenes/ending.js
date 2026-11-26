// Água-Tinta — ending scene (owner E), §9.6. ~45 s: ink blooms from the squid and fills the screen → the theme
// inverts to Papel (temporary) → credits scroll as canvas text while caught species parade by → Vó Iara's last
// note → the theme reverts → map + toast "Tema Papel desbloqueado". Tap / Esc / [Pular] skips ahead.
(function (AQ) {
  'use strict';

  var R = AQ.render, D = AQ.display, U = AQ.util;
  var rng = AQ.rng.create('ending');
  var T = 0, phase = 'ink', inverted = false, finishing = false, noteShown = false;
  var parade = [], paradeIdx = 0, nextParade = 0, swimmers = [];
  var creditLines = [];
  var skipBtn = null, offs = [];
  var INK_END = 5.5, CREDITS_START = 7, CREDITS_DUR = 30, NOTE_AT = 39;
  var squid = null;

  function buildCredits() {
    var t = AQ.i18n.t;
    creditLines = [
      { s: t('credits.title'), lv: 15, bold: true }, { s: t('credits.subtitle'), lv: 10 }, { s: '' },
      { s: t('credits.l1'), lv: 12 }, { s: '' }, { s: '' }
    ];
    ['2', '3', '4', '5', '6'].forEach(function (n) {
      creditLines.push({ s: t('credits.h' + n), lv: 9 });
      creditLines.push({ s: t('credits.l' + n), lv: 13 });
      creditLines.push({ s: '' });
      creditLines.push({ s: '' });
    });
    creditLines.push({ s: '~ ' + t('credits.end') + ' ~', lv: 14, bold: true });
  }

  function buildParade() {
    var s = AQ.state;
    var ids = [];
    var list = (AQ.species && AQ.species.list) || [];
    list.forEach(function (sp) {
      var b = s.bestiary && s.bestiary[sp.id];
      if (b && b.caught > 0 && sp.id !== 'tinteira') ids.push(sp.id);
    });
    if (!ids.length) ids = ['manjuba', 'baiacu', 'tainha'];
    parade = ids.map(function (id) {
      var sp = AQ.species && AQ.species.get ? AQ.species.get(id) : null;
      var def = AQ.sprites && AQ.sprites[(sp && sp.sprite) || id];
      return def && def.frames ? def.frames.map(function (f) { return R.compile(f); }) : null;
    }).filter(Boolean);
    paradeIdx = 0;
    nextParade = CREDITS_START + 1;
    swimmers = [];
    var sq = AQ.sprites && AQ.sprites.tinteira;
    squid = sq && sq.frames ? sq.frames.map(function (f) { return R.compile(f); }) : null;
  }

  function skip() {
    if (finishing) return;
    if (T < NOTE_AT - 0.5) {
      if (!inverted) invert();
      T = NOTE_AT - 0.5;
    }
  }
  function invert() {
    inverted = true;
    AQ.fx.flash(8, 0.5);
    AQ.theme.apply('papel', { persist: false });
    if (AQ.audio) AQ.audio.sfx('legendary', { vol: 0.6 });
  }
  function finish() {
    if (finishing) return;
    finishing = true;
    AQ.theme.apply();
    AQ.scenes.go('map').then(function () {
      if (AQ.ui && AQ.ui.toast) AQ.ui.toast({ key: 'ui.toast.paper' }, { kind: 'rare', ms: 4200 });
    });
  }

  AQ.scenes.register('ending', {
    enter: function () {
      T = 0; phase = 'ink'; inverted = false; finishing = false; noteShown = false;
      buildCredits();
      buildParade();
      if (AQ.ui && AQ.ui.layer && AQ.ui.layer('hud')) {
        skipBtn = AQ.ui.dom.btn(AQ.i18n.t('ui.ending.skip'), skip, { cls: 'aq-ending-skip', fid: 'skip' });
        AQ.ui.layer('hud').appendChild(skipBtn);
      }
      if (AQ.input && AQ.input.on) {
        offs = [AQ.input.on('tap', function () { if (T > 2) skip(); }), AQ.input.on('action:back', skip), AQ.input.on('action:confirm', skip)];
      }
      AQ.fx.shake(3, 0.6);
    },
    exit: function () {
      offs.forEach(function (o) { o(); });
      offs = [];
      if (skipBtn && skipBtn.parentNode) skipBtn.parentNode.removeChild(skipBtn);
      skipBtn = null;
      if (AQ.theme.temporary) AQ.theme.apply();
    },
    update: function (dt) {
      T += dt;
      if (!inverted && T >= INK_END) invert();
      if (T < INK_END && Math.floor((T - dt) / 0.18) !== Math.floor(T / 0.18)) {
        AQ.fx.emit('ink', D.cols / 2 + rng.range(-3, 3), D.rows * AQ.ASPECT * 0.55 + rng.range(-2, 2), { n: 6, power: 1 + T * 0.4 });
      }
      // parade
      if (T >= nextParade && T < NOTE_AT && parade.length) {
        var frames = parade[paradeIdx % parade.length];
        paradeIdx++;
        nextParade = T + 1.4 + rng.range(0, 0.8);
        var dir = paradeIdx % 2 ? 1 : -1;
        var w = frames[0].w;
        var band = paradeIdx % 3;
        var row = band === 0 ? D.rows * 0.12 : band === 1 ? D.rows * 0.82 : D.rows * 0.9;
        swimmers.push({ frames: frames, dir: dir, x: dir > 0 ? -w : D.cols + w, y: row * AQ.ASPECT, sp: rng.range(4, 8), t: 0, w: w });
      }
      for (var i = swimmers.length - 1; i >= 0; i--) {
        var s = swimmers[i];
        s.t += dt;
        s.x += s.dir * s.sp * dt;
        if ((s.dir > 0 && s.x - s.w > D.cols + 2) || (s.dir < 0 && s.x + s.w < -2)) swimmers.splice(i, 1);
      }
      if (T >= NOTE_AT && !noteShown) {
        noteShown = true;
        var p = AQ.ui && AQ.ui.note ? AQ.ui.note('ending', { ms: 9000 }) : Promise.resolve();
        p.then(function () { setTimeout(finish, 600); });
      }
      if (T > NOTE_AT + 20) finish();
    },
    drawBg: function (grid, t) {
      var cols = D.cols, rows = D.rows;
      var cx = cols / 2, cy = rows * 0.55;
      var ramp = R.RAMPS.ink, n = ramp.length;
      if (!inverted) {
        // ink field growing from the squid
        var maxR = Math.sqrt(cx * cx + (rows * 2) * (rows * 2));
        var rad = U.easeOutCubic(U.clamp(T / INK_END, 0, 1)) * maxR * 1.05;
        for (var r = 0; r < rows; r++) {
          for (var c = 0; c < cols; c++) {
            var dx = c - cx, dy = (r - cy) * 2;
            var d = Math.sqrt(dx * dx + dy * dy);
            var noise = AQ.util.noise3(c * 0.12, r * 0.25, t * 0.4) * 6;
            var v = U.clamp((rad - d + noise) / 10, 0, 1);
            if (v <= 0) continue;
            grid.put(c, r, ramp[Math.min(n - 1, 1 + Math.floor(v * (n - 2)))], Math.min(5, 1 + Math.round(v * 4)));
          }
        }
      } else {
        // paper: a faint receding ink wash, then clean
        var fade = U.clamp(1 - (T - INK_END) / 3, 0, 1);
        if (fade > 0) {
          for (var r2 = 0; r2 < rows; r2++) {
            for (var c2 = 0; c2 < cols; c2++) {
              var nv = AQ.util.noise3(c2 * 0.1, r2 * 0.2, t * 0.3);
              if (nv < 1 - fade * 0.8) continue;
              grid.put(c2, r2, ramp[1 + Math.floor(nv * (n - 2))], Math.max(1, Math.round(fade * 3)));
            }
          }
        }
      }
    },
    draw: function () {
      var AS = AQ.ASPECT;
      // the squid sinking into her ink
      if (!inverted && squid) {
        var fr = squid[Math.floor(T * 2) % squid.length];
        R.sprite(fr, D.cols / 2, D.rows * AS * 0.55 + T * 0.6, { level: 12, dissolve: U.clamp(T / INK_END, 0, 1) * 0.9, knock: false, deform: 'pulse', t: T, amp: AQ.fx.motion() });
      }
      // parade
      for (var i = 0; i < swimmers.length; i++) {
        var s = swimmers[i];
        R.sprite(s.frames[Math.floor(s.t * 2) % s.frames.length], s.x, s.y, { flip: s.dir < 0, level: 9, deform: 'swim', t: s.t, amp: AQ.fx.motion() });
      }
      // credits
      if (T >= CREDITS_START) {
        var lineGap = 1;
        var total = creditLines.length * lineGap;
        var prog = (T - CREDITS_START) / CREDITS_DUR;
        var startRow = D.rows - prog * (D.rows + total) * 0.9;
        for (var k = 0; k < creditLines.length; k++) {
          var L = creditLines[k];
          if (!L.s) continue;
          var row = Math.round(startRow + k * lineGap);
          if (row < 1 || row >= D.rows - 1) continue;
          var edge = Math.min(row, D.rows - 1 - row);
          var lv = Math.max(1, Math.min(L.lv || 12, 3 + edge * 2));
          R.text(L.s, Math.floor(D.cols / 2), row, lv, { align: 'center', bold: !!L.bold, knock: 0.85 });
        }
      }
      AQ.fx.draw();
    }
  });
})(window.AQ);
