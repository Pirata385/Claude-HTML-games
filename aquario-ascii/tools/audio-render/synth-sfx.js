// Água-Tinta — audio render tool: SFX and jingle recipes (moved here from the game's old js/audio/sfx.js).
// Each recipe(ctx, out, opts, t0) schedules its nodes into `out` and returns its end time. Rendered once each by
// render-page.js into ../../audio/sfx/ and ../../audio/jingles/ (the game varies pitch slightly at playback).
// Palette: 2-op FM (bells, wood-blocks, brass), pulse blips, noise bursts; energy between ~250 Hz and 5 kHz.
(function (G) {
  'use strict';

  var A = G.SYN;
  var R = A.recipes = A.recipes || {};
  var M = A.mtof;

  function P(o) { return (o && o.pitch) || 1; }
  // raw percussive tone with optional glide; type may be an oscillator type or a PeriodicWave
  function tone(out, type, f0, f1, t0, a, d, peak, glide) {
    var g = A.gain(0.0001, out);
    var o = A.ctx.createOscillator();
    if (typeof type === 'string') o.type = type; else o.setPeriodicWave(type);
    o.frequency.setValueAtTime(f0, t0);
    if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + (glide || a + d));
    o.connect(g);
    var end = A.env(g, t0, a, d, peak);
    o.start(t0);
    o.stop(end + 0.03);
    o.onended = function () { try { g.disconnect(); } catch (e) { /* ignore */ } };
    return end;
  }
  function pls(out, f0, f1, t0, d, peak, duty, glide) { return tone(out, A.wave(duty || 0.25), f0, f1, t0, 0.003, d, peak, glide); }
  // filtered noise burst with optional sweep
  function nz(out, ftype, f0, f1, q, t0, a, d, peak, kind) {
    var g = A.gain(0.0001, out);
    var f = A.filter(ftype, f0, q, g);
    if (f1 && f1 !== f0) f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t0 + a + d);
    var src = A.noise(kind || 'white', f, false);
    var end = A.env(g, t0, a, d, peak);
    src.start(t0, A.rand() * 1.2);
    src.stop(end + 0.03);
    src.onended = function () { try { g.disconnect(); f.disconnect(); } catch (e) { /* ignore */ } };
    return end;
  }
  function bell(out, f, t, peak, d) { return A.fm(out, f, t, { r: 3.5, i0: 1.6, i1: 0.15, id: 0.35, d: d || 1.2, peak: peak || 0.2 }); }
  function marimba(out, f, t, peak, d) { return A.fm(out, f, t, { r: 4, i0: 1.8, i1: 0.05, id: 0.05, d: d || 0.35, peak: peak || 0.25 }); }
  function ep(out, f, t, peak, d) { return A.fm(out, f, t, { r: 1, i0: 1.8, i1: 0.2, id: 0.4, d: d || 0.8, peak: peak || 0.2 }); }
  function brass(out, f, t, dur, peak) { return A.fm(out, f, t, { r: 1, i0: 0.4, i1: 1.7, id: 0.09, a: 0.05, dur: dur, sus: 0.8, rel: 0.25, d: 0.5, peak: peak || 0.18 }); }
  function seq(out, notes, t, step, fn) {
    var end = t;
    notes.forEach(function (n, i) { end = Math.max(end, fn(out, n, t + i * step, i)); });
    return end;
  }

  // ---------------------------------------------------------------- fishing
  R.cast = function (ctx, out, o, t) {
    nz(out, 'bandpass', 450 * P(o), 2600 * P(o), 1.3, t, 0.05, 0.28, 0.4);
    return pls(out, 330 * P(o), 1050 * P(o), t, 0.2, 0.07, 0.125, 0.18);
  };
  R.splashSmall = function (ctx, out, o, t) {
    nz(out, 'lowpass', 3400 * P(o), 450, 0.8, t, 0.004, 0.15, 0.5);
    A.fm(out, 520 * P(o), t + 0.02, { r: 1, i0: 1, i1: 0.1, id: 0.05, d: 0.09, peak: 0.12, bend: 1.5, bt: 0.06 });
    return t + 0.2;
  };
  R.splashBig = function (ctx, out, o, t) {
    nz(out, 'lowpass', 2800 * P(o), 300, 0.7, t, 0.006, 0.34, 0.6);
    nz(out, 'bandpass', 1100, 500, 0.9, t + 0.05, 0.02, 0.3, 0.28, 'pink');
    A.fm(out, 180 * P(o), t, { r: 1, i0: 2.5, i1: 0.2, id: 0.12, d: 0.22, peak: 0.4, bend: 1.8, bt: 0.1 });
    A.fm(out, 700 * P(o), t + 0.12, { r: 1, i0: 1, i1: 0.1, id: 0.05, d: 0.08, peak: 0.1, bend: 1.5, bt: 0.06 });
    return t + 0.45;
  };
  R['splash-jump'] = function (ctx, out, o, t) { return R.splashBig(ctx, out, o, t); };
  R.reel = function (ctx, out, o, t) {
    nz(out, 'highpass', 3200 * P(o), 0, 0.7, t, 0.001, 0.008, 0.2);
    return pls(out, 1500 * P(o), 0, t, 0.015, 0.06, 0.125);
  };
  R.reelClick = R.reel;
  R.nibble = function (ctx, out, o, t) {
    pls(out, 1900 * P(o), 0, t, 0.025, 0.14, 0.125);
    return pls(out, 2400 * P(o), 0, t + 0.04, 0.02, 0.08, 0.125);
  };
  // "tok": wood-block FM knock + a body thump
  R.bite = function (ctx, out, o, t) {
    A.fm(out, 420 * P(o), t, { r: 1.41, i0: 5, i1: 0.3, id: 0.04, d: 0.13, peak: 0.55 });
    A.fm(out, 190 * P(o), t, { r: 1, i0: 2, i1: 0.3, id: 0.05, d: 0.1, peak: 0.3, bend: 1.5, bt: 0.05 });
    return t + 0.2;
  };
  R.hook = function (ctx, out, o, t) {
    nz(out, 'highpass', 2500, 0, 0.7, t, 0.001, 0.03, 0.25);
    return seq(out, [67, 74, 79], t, 0.045, function (d, n, tt, i) { return A.fm(d, M(n) * P(o), tt, { r: 2, i0: 3, i1: 0.3, id: 0.1, d: 0.3 - i * 0.04, peak: 0.34 }); });
  };
  // line-tension warning: two soft descending beeps
  R.tension = function (ctx, out, o, t) {
    var f = 988 * P(o);
    A.pulse(out, f, t, 0.07, { duty: 0.25, cut: 2600, a: 0.004, peak: 0.2, rel: 0.03 });
    return A.pulse(out, f * 0.7492, t + 0.1, 0.09, { duty: 0.25, cut: 2400, a: 0.004, peak: 0.2, rel: 0.04 });
  };
  R.snap = function (ctx, out, o, t) {
    nz(out, 'highpass', 2200, 0, 0.7, t, 0.001, 0.06, 0.5);
    pls(out, 1400 * P(o), 140 * P(o), t, 0.3, 0.2, 0.125, 0.28);
    return A.fm(out, 160, t, { r: 1, i0: 3, i1: 0.3, id: 0.1, d: 0.18, peak: 0.35, bend: 1.6, bt: 0.08 });
  };
  R.escape = function (ctx, out, o, t) {
    return seq(out, [72, 67, 64, 60], t, 0.11, function (d, n, tt, i) { return A.pulse(d, M(n) * P(o), tt, 0.1 + i * 0.03, { duty: 0.25, cut: 2000, a: 0.008, peak: 0.2, rel: 0.1 }); });
  };

  // ---------------------------------------------------------------- jingles
  R.catch = function (ctx, out, o, t) {
    var p = P(o);
    seq(out, [72, 76, 79], t, 0.075, function (d, n, tt) { return A.pulse(d, M(n) * p, tt, 0.1, { duty: 0.25, cut: 3200, a: 0.005, peak: 0.2, rel: 0.05 }); });
    A.pulse(out, M(84) * p, t + 0.225, 0.45, { duty: 0.5, cut: 3500, a: 0.005, peak: 0.2, rel: 0.25 });
    return Math.max(bell(out, M(84) * p, t + 0.225, 0.2, 1.1), ep(out, M(76) * p, t + 0.225, 0.14, 0.9));
  };
  R.newSpecies = function (ctx, out, o, t) {
    var p = P(o);
    seq(out, [72, 76, 79, 84, 88], t, 0.07, function (d, n, tt) { return A.pulse(d, M(n) * p, tt, 0.09, { duty: 0.25, cut: 3400, a: 0.004, peak: 0.19, rel: 0.05 }); });
    var e = 0;
    [72, 76, 79, 84].forEach(function (n) { e = Math.max(e, ep(out, M(n) * p, t + 0.4, 0.1, 1.4)); });
    return Math.max(e, bell(out, M(91) * p, t + 0.4, 0.2, 1.8), brass(out, M(79) * p, t + 0.4, 0.6, 0.1));
  };
  R.rare = function (ctx, out, o, t) {
    var p = P(o);
    return seq(out, [79, 84, 88, 91, 96], t, 0.075, function (d, n, tt, i) { return bell(d, M(n) * p, tt, 0.18 - i * 0.01, 1.2 + i * 0.1); });
  };
  R.legendary = function (ctx, out, o, t) {
    var p = P(o);
    // brass swell on a minor-major chord, deep drum, shimmering bells over the top
    A.fm(out, 150, t, { r: 1, i0: 2.5, i1: 0.2, id: 0.2, d: 0.5, peak: 0.45, bend: 1.8, bt: 0.12 });
    [[50, 0], [57, 0.12], [62, 0.24], [65, 0.36]].forEach(function (x) {
      A.fm(out, M(x[0]) * p, t + x[1], { r: 1, i0: 0.3, i1: 1.8, id: 0.9, a: 0.35, dur: 1.9, sus: 0.8, rel: 0.7, d: 0.8, peak: 0.16 });
    });
    [74, 77, 81, 86, 89].forEach(function (n, i) { bell(out, M(n) * p, t + 0.7 + i * 0.18, 0.15, 2.2); });
    return t + 3.6;
  };
  R.coin = function (ctx, out, o, t) {
    pls(out, 1976 * P(o), 0, t, 0.07, 0.11, 0.25);
    return pls(out, 2637 * P(o), 0, t + 0.07, 0.32, 0.11, 0.25);
  };
  R.pearl = function (ctx, out, o, t) {
    var p = P(o);
    return seq(out, [84, 88, 91, 96], t, 0.07, function (d, n, tt, i) { return bell(d, M(n) * p, tt, 0.14, 1.0 + i * 0.2); });
  };
  R.feed = function (ctx, out, o, t) {
    var end = t;
    for (var i = 0; i < 5; i++) {
      var f = (900 + A.rand() * 900) * P(o);
      end = Math.max(end, A.fm(out, f, t + i * 0.06 + A.rand() * 0.02, { r: 1, i0: 1.4, i1: 0.1, id: 0.03, d: 0.06, peak: 0.12, bend: 1.4, bt: 0.04 }));
    }
    return end;
  };
  R.bubble = function (ctx, out, o, t) {
    return A.fm(out, 500 * P(o), t, { r: 1, i0: 0.8, i1: 0.1, id: 0.06, d: 0.09, peak: 0.22, bend: 0.6, bt: 0.07 });
  };
  // till: drawer click + two high bells
  R.buy = function (ctx, out, o, t) {
    nz(out, 'bandpass', 1900, 1000, 2, t, 0.002, 0.05, 0.25);
    bell(out, M(91) * P(o), t + 0.05, 0.2, 0.7);
    return bell(out, M(96) * P(o), t + 0.12, 0.2, 1.1);
  };
  R.goal = function (ctx, out, o, t) {
    var p = P(o);
    seq(out, [67, 72, 76, 79, 84], t, 0.1, function (d, n, tt, i) { return A.pulse(d, M(n) * p, tt, 0.12, { duty: 0.25, cut: 3300, a: 0.005, peak: 0.19, rel: 0.06 }); });
    brass(out, M(72) * p, t + 0.5, 0.6, 0.12);
    brass(out, M(76) * p, t + 0.5, 0.6, 0.1);
    return Math.max(bell(out, M(84) * p, t + 0.5, 0.18, 1.4), brass(out, M(79) * p, t + 0.5, 0.6, 0.1));
  };

  // ---------------------------------------------------------------- UI
  R.uiTap = function (ctx, out, o, t) { return A.fm(out, 1568 * P(o), t, { r: 2, i0: 1.4, i1: 0.1, id: 0.02, d: 0.05, peak: 0.13 }); };
  R.uiMove = function (ctx, out, o, t) { return A.fm(out, 1175 * P(o), t, { r: 2, i0: 1, i1: 0.1, id: 0.02, d: 0.04, peak: 0.1 }); };
  R.uiConfirm = function (ctx, out, o, t) {
    A.fm(out, 1319 * P(o), t, { r: 2, i0: 1.2, i1: 0.1, id: 0.03, d: 0.07, peak: 0.14 });
    return A.fm(out, 1976 * P(o), t + 0.06, { r: 2, i0: 1.2, i1: 0.1, id: 0.04, d: 0.16, peak: 0.14 });
  };
  R.uiBack = function (ctx, out, o, t) {
    A.fm(out, 1319 * P(o), t, { r: 2, i0: 1, i1: 0.1, id: 0.03, d: 0.06, peak: 0.11 });
    return A.fm(out, 880 * P(o), t + 0.05, { r: 2, i0: 1, i1: 0.1, id: 0.04, d: 0.12, peak: 0.11 });
  };
  R.uiOpen = function (ctx, out, o, t) {
    return seq(out, [76, 83, 88], t, 0.04, function (d, n, tt) { return A.fm(d, M(n) * P(o), tt, { r: 2, i0: 1.2, i1: 0.1, id: 0.03, d: 0.1, peak: 0.11 }); });
  };
  // notebook page: paper swish + soft tick
  R.page = function (ctx, out, o, t) {
    nz(out, 'bandpass', 3200 * P(o), 1400, 0.9, t, 0.02, 0.13, 0.22);
    return A.fm(out, 1047 * P(o), t + 0.1, { r: 2, i0: 1, i1: 0.1, id: 0.02, d: 0.07, peak: 0.09 });
  };
  R.error = function (ctx, out, o, t) {
    A.pulse(out, 196 * P(o), t, 0.08, { duty: 0.25, cut: 1500, a: 0.004, peak: 0.2, rel: 0.03 });
    return A.pulse(out, 156 * P(o), t + 0.1, 0.12, { duty: 0.25, cut: 1400, a: 0.004, peak: 0.2, rel: 0.05 });
  };

  // ---------------------------------------------------------------- fight tells
  R.tellRun = function (ctx, out, o, t) {
    var end = t;
    for (var i = 0; i < 6; i++) end = Math.max(end, A.pulse(out, M(60 + i * 2) * P(o), t + i * 0.07, 0.06, { duty: 0.25, cut: 2400, a: 0.004, peak: 0.17, rel: 0.03 }));
    return end;
  };
  R.tellDive = function (ctx, out, o, t) {
    A.fm(out, 330 * P(o), t, { r: 1, i0: 3, i1: 0.3, id: 0.2, d: 0.3, peak: 0.45, bend: 1.9, bt: 0.22 });
    return pls(out, 700 * P(o), 200 * P(o), t, 0.25, 0.1, 0.25, 0.22);
  };
  R.tellJump = function (ctx, out, o, t) {
    nz(out, 'bandpass', 600, 2800, 1.2, t, 0.2, 0.2, 0.3, 'pink');
    return pls(out, 400 * P(o), 1600 * P(o), t, 0.4, 0.1, 0.125, 0.36);
  };
  R.tellShake = function (ctx, out, o, t) {
    var end = t;
    for (var i = 0; i < 6; i++) end = Math.max(end, pls(out, (i % 2 ? 1500 : 1900) * P(o), 0, t + i * 0.045, 0.03, 0.14, 0.125));
    return end;
  };
  R.tellBurrow = function (ctx, out, o, t) {
    var end = t;
    for (var i = 0; i < 7; i++) end = Math.max(end, nz(out, 'bandpass', 900 + A.rand() * 700, 0, 1.4, t + i * 0.055, 0.004, 0.05, 0.2 + A.rand() * 0.12));
    return end;
  };
  R.tellGrip = function (ctx, out, o, t) {
    return A.fm(out, 150 * P(o), t, { r: 1, i0: 1, i1: 3, id: 0.3, a: 0.08, dur: 0.3, sus: 0.9, rel: 0.15, d: 0.5, peak: 0.3, wave: 'sine' });
  };
  R.tellInk = function (ctx, out, o, t) {
    nz(out, 'lowpass', 900, 250, 0.7, t, 0.004, 0.22, 0.45, 'pink');
    return A.fm(out, 300 * P(o), t, { r: 1, i0: 1.5, i1: 0.1, id: 0.1, d: 0.16, peak: 0.28, bend: 1.6, bt: 0.12 });
  };
  // ambience bloop (also used by music.js): soft FM bubble
  R.bloop = function (ctx, out, o, t) {
    var f = ((o && o.f) || (380 + A.rand() * 520)) * P(o);
    return A.fm(out, f, t, { r: 1, i0: 0.6, i1: 0.05, id: 0.04, d: 0.07, peak: (o && o.peak) || 0.1, bend: 0.7, bt: 0.06 });
  };
})(window);
