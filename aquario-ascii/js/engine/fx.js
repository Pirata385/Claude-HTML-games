// Água-Tinta — effects (owner A): pooled particles, camera shake, flash, ink-wipe transitions, motion().
// Phase-0 version: complete API, simple visuals (refined in the engine pass).
(function (AQ) {
  'use strict';

  var U = AQ.util, R = AQ.render, D = AQ.display;
  var POOL = 400;
  var rnd = AQ.rng.create('fx');

  function P() {
    this.alive = false; this.kind = ''; this.x = 0; this.y = 0; this.vx = 0; this.vy = 0;
    this.g = 0; this.drag = 0; this.life = 0; this.max = 1; this.level = 10; this.code = 0;
    this.ramp = ''; this.text = ''; this.wobble = 0; this.t = 0;
  }
  var pool = [];
  for (var i = 0; i < POOL; i++) pool.push(new P());

  // Per-kind presets: n, speed, gravity (u/s²), life (s), glyph or ramp.
  var KINDS = {
    splash: { n: 14, sp: 14, g: 40, life: 0.7, ramp: 'foam', up: true, level: 11 },
    drop: { n: 4, sp: 3, g: 30, life: 0.6, ch: "'", level: 10 },
    bubble: { n: 3, sp: 1, g: -8, life: 1.6, ramp: 'bubble', grow: true, level: 9, wobble: 1 },
    spark: { n: 8, sp: 10, g: 0, life: 0.45, ch: '*', level: 13, drag: 3 },
    ink: { n: 18, sp: 4, g: 0, life: 2.5, ramp: 'ink', level: 9, drag: 1.5, shrink: true },
    coin: { n: 1, sp: 0, g: -6, life: 1.1, ch: '$', level: 14, vy0: -4 },
    flake: { n: 6, sp: 1.5, g: 2, life: 3, ramp: 'bubble', level: 8, drag: 2, rampIdx: [0, 1] },
    dust: { n: 8, sp: 3, g: -1, life: 0.8, ramp: 'density', level: 7, drag: 3, shrink: true },
    pop: { n: 1, sp: 0, g: 0, life: 0.12, ch: '*', level: 12 },
    ripple: { n: 2, sp: 6, g: 0, life: 0.7, ch: '(', level: 8, ring: true },
    text: { n: 1, sp: 0, g: -3, life: 1.4, level: 14, vy0: -3 }
  };

  var motionVal = 1, mql = null;
  function readMotion() {
    var s = AQ.settings.get('reducedMotion');
    var reduce = s === 'on' || (s === 'auto' && mql && mql.matches);
    motionVal = reduce ? 0.3 : 1;
  }
  try {
    if (typeof window !== 'undefined' && window.matchMedia) {
      mql = window.matchMedia('(prefers-reduced-motion: reduce)');
      if (mql.addEventListener) mql.addEventListener('change', readMotion);
    }
  } catch (e) { mql = null; }
  readMotion();

  var shakeAmp = 0, shakeT = 0, shakeDur = 0;
  var flashLevel = 0, flashT = 0, flashDur = 0;
  var wipe = null; // {dir, t, dur, resolve, fade}

  function alloc() {
    var cap = (AQ.perf && AQ.perf.params && AQ.perf.params.maxParticles) || POOL;
    if (fx.count >= cap) return null;
    for (var i = 0; i < POOL; i++) if (!pool[i].alive) return pool[i];
    return null;
  }

  var fx = AQ.fx = {
    count: 0,
    KINDS: KINDS,

    // emit(kind, wx, wy, opts?{n, power, dir, text, level, life})
    emit: function (kind, wx, wy, opts) {
      var k = KINDS[kind];
      if (!k) return 0;
      var o = opts || {};
      var reduced = motionVal < 1;
      var n = o.n !== undefined ? o.n : k.n;
      if (reduced && kind === 'splash') n = Math.min(n, 4);
      if (reduced && kind === 'ripple') n = 0;
      var power = o.power === undefined ? 1 : o.power;
      var made = 0;
      for (var i = 0; i < n; i++) {
        var p = alloc();
        if (!p) break;
        p.alive = true; fx.count++; made++;
        p.kind = kind; p.x = wx; p.y = wy; p.t = 0;
        p.life = p.max = (o.life || k.life) * (0.75 + rnd.next() * 0.5);
        p.level = o.level || k.level;
        p.g = k.g; p.drag = k.drag || 0; p.wobble = k.wobble ? rnd.range(0, 6.28) : 0;
        p.ramp = k.ramp || ''; p.text = kind === 'text' ? String(o.text || '') : '';
        p.code = k.ch ? AQ.atlas.code(k.ch) : (p.ramp ? R.rampCode(p.ramp, k.grow ? 0 : rnd.next()) : 0);
        var ang, sp = k.sp * power * (0.5 + rnd.next() * 0.7);
        if (k.ring) {
          var side = i % 2 ? 1 : -1;
          p.vx = side * sp; p.vy = 0;
          p.code = AQ.atlas.code(side > 0 ? ')' : '(');
        } else if (k.up) {
          ang = -Math.PI / 2 + (rnd.next() - 0.5) * 1.6 + (o.dir || 0) * 0.4;
          p.vx = Math.cos(ang) * sp; p.vy = Math.sin(ang) * sp * 1.4;
        } else {
          ang = rnd.next() * Math.PI * 2;
          p.vx = Math.cos(ang) * sp; p.vy = Math.sin(ang) * sp;
        }
        if (k.vy0) { p.vx = 0; p.vy = k.vy0; }
        if (reduced && (kind === 'coin' || kind === 'text')) { p.vy = 0; p.g = 0; }
      }
      return made;
    },

    update: function (dt) {
      for (var i = 0; i < POOL; i++) {
        var p = pool[i];
        if (!p.alive) continue;
        p.t += dt;
        p.life -= dt;
        if (p.life <= 0) { p.alive = false; fx.count--; continue; }
        if (p.drag) { var d = Math.exp(-p.drag * dt); p.vx *= d; p.vy *= d; }
        p.vy += p.g * dt;
        p.x += p.vx * dt + (p.wobble && motionVal === 1 ? Math.sin(p.t * 6 + p.wobble) * 0.6 * dt : 0);
        p.y += p.vy * dt;
        var k = KINDS[p.kind], f = 1 - p.life / p.max;
        if (k.grow) p.code = R.rampCode('bubble', f);
        else if (k.shrink && p.ramp) p.code = R.rampCode(p.ramp, 1 - f);
      }
      // shake
      if (shakeT > 0) {
        shakeT -= dt;
        var a = shakeT > 0 ? shakeAmp * (shakeT / shakeDur) : 0;
        R.cam.shake.x = (rnd.next() * 2 - 1) * a;
        R.cam.shake.y = (rnd.next() * 2 - 1) * a;
      } else if (R.cam.shake.x || R.cam.shake.y) { R.cam.shake.x = 0; R.cam.shake.y = 0; }
    },

    // Draws particles on the current layer (scenes call this inside draw()).
    draw: function () {
      for (var i = 0; i < POOL; i++) {
        var p = pool[i];
        if (!p.alive) continue;
        var f = p.life / p.max;
        var lvl = Math.max(1, Math.round(p.level * Math.min(1, f * 2)));
        if (p.text) R.textW(p.text, p.x, p.y, lvl, { align: 'center' });
        else R.glyphW(p.code, p.x, p.y, lvl);
      }
    },

    clear: function () {
      for (var i = 0; i < POOL; i++) pool[i].alive = false;
      fx.count = 0;
    },

    shake: function (px, sec) {
      if (motionVal < 1) return;
      shakeAmp = Math.max(shakeAmp * (shakeT > 0 ? 1 : 0), px);
      shakeDur = shakeT = sec || 0.25;
    },

    flash: function (level, sec) {
      flashLevel = U.clamp(level | 0, 0, 15);
      if (motionVal < 1) flashLevel = Math.min(flashLevel, 1);
      flashDur = flashT = sec || 0.12;
      R.markTopDirty();
    },

    // inkWipe('out'|'in', sec) → Promise. 'out' covers the screen, 'in' reveals it. Reduced motion: cross-fade.
    inkWipe: function (dir, sec) {
      if (wipe && wipe.resolve) wipe.resolve();
      var fade = motionVal < 1;
      return new Promise(function (resolve) {
        wipe = { dir: dir === 'in' ? 'in' : 'out', t: 0, dur: fade ? 0.2 : (sec || 0.4), resolve: resolve, fade: fade };
        R.markTopDirty();
      });
    },
    // True while the screen is fully covered after an 'out' wipe (until the next 'in').
    covered: false,

    motion: function () { return motionVal; },

    // Loop step 7 (real time, also while paused): transitions and flash on the top layer.
    drawTop: function (dtReal) {
      var ctx = D.ctx.top;
      if (!ctx) return;
      if (flashT > 0) {
        flashT -= dtReal;
        if (flashT > 0 && flashLevel) {
          R.markTopDirty();
          ctx.globalAlpha = R.ALPHA[flashLevel] * (flashT / flashDur);
          ctx.fillStyle = AQ.theme.ink;
          ctx.fillRect(0, 0, D.canvases.top.width, D.canvases.top.height);
        } else R.markTopDirty();
      }
      if (wipe) {
        wipe.t += dtReal;
        var p = U.clamp(wipe.t / wipe.dur, 0, 1);
        var cover = wipe.dir === 'out' ? p : 1 - p;
        R.markTopDirty();
        drawCover(ctx, cover, wipe.fade);
        if (p >= 1) {
          var res = wipe.resolve, d = wipe.dir;
          wipe = null;
          fx.covered = d === 'out';
          if (res) res();
        }
      } else if (fx.covered) {
        R.markTopDirty();
        drawCover(ctx, 1, true);
      }
      ctx.globalAlpha = 1;
    }
  };

  // Ink wipe: columns sweep the density ramp from left to right.
  function drawCover(ctx, cover, fade) {
    var W = D.canvases.top.width, H = D.canvases.top.height;
    ctx.fillStyle = AQ.theme.bg;
    if (fade || !D.cols) {
      ctx.globalAlpha = cover;
      ctx.fillRect(0, 0, W, H);
      return;
    }
    var cols = D.cols, cw = D.cellWd, ramp = R.RAMPS.density, n = ramp.length;
    var edge = cover * (cols + 8) - 4;
    ctx.globalAlpha = 1;
    var full = Math.max(0, Math.floor(edge - 4));
    if (full > 0) ctx.fillRect(0, 0, D.originXd + full * cw, H);
    R.setTarget('top');
    for (var c = Math.max(0, full); c < cols && c < edge + 1; c++) {
      var v = U.clamp(edge - c, 0, 4) / 4;
      if (v <= 0) continue;
      var code = AQ.atlas.code(ramp[Math.min(n - 1, Math.floor(v * (n - 1)))]);
      for (var r = 0; r < D.rows; r++) {
        ctx.globalAlpha = 1;
        R.glyph(code, D.originX + c * D.cellW, D.originY + r * D.cellH, 15);
      }
    }
    R.setTarget('main');
  }

  AQ.events.on('settings:changed', function (p) { if (p.key === 'reducedMotion') readMotion(); });
})(window.AQ);
