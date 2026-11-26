// Água-Tinta — SFX recipes (owner E), §13. Each recipe(ctx, out, opts, t0) schedules its nodes into `out`
// (already routed to the sfx bus, with volume and pan applied) and returns its end time. opts.pitch scales pitch.
(function (AQ) {
  'use strict';

  var A = AQ.audio = AQ.audio || {};
  var R = A.recipes = A.recipes || {};

  function P(o) { return (o && o.pitch) || 1; }
  // percussive tone
  function tone(out, type, f0, f1, t0, a, d, peak, glide) {
    var g = A.gain(0.0001, out);
    var o = A.osc(type, f0, g);
    if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + (glide || a + d));
    var end = A.env(g, t0, a, d, peak);
    o.start(t0);
    A.stopAt(o, end + 0.05);
    return end;
  }
  // filtered noise burst with a frequency sweep
  function noiseBurst(out, kind, ftype, f0, f1, q, t0, a, d, peak) {
    var g = A.gain(0.0001, out);
    var f = A.filter(ftype, f0, q, g);
    if (f1 && f1 !== f0) f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t0 + a + d);
    var src = A.noise(kind || 'white', f, false);
    var end = A.env(g, t0, a, d, peak);
    src.start(t0, Math.random() * 1.2);
    A.stopAt(src, end + 0.05);
    return end;
  }
  function pluck(out, freq, t0, peak, decay) {
    var g = A.gain(0.0001, out);
    var lp = A.filter('lowpass', Math.min(9000, freq * 6), 0.7, g);
    var o = A.osc('triangle', freq, lp);
    var end = A.env(g, t0, 0.005, decay || 0.6, peak || 0.3);
    o.start(t0);
    A.stopAt(o, end + 0.05);
    return end;
  }
  function bell(out, freq, t0, peak, decay) {
    var end = t0;
    [[1, 1], [1.004, 0.8], [2.76, 0.25]].forEach(function (pp) {
      end = Math.max(end, tone(out, 'sine', freq * pp[0], 0, t0, 0.004, decay || 1.6, (peak || 0.2) * pp[1]));
    });
    return end;
  }
  function ks(out, buf, t0, peak, rate0, rate1) {
    var src = A.ctx.createBufferSource();
    src.buffer = A.buffers[buf];
    src.playbackRate.value = rate0 || 1;
    if (rate1 && rate1 !== rate0) src.playbackRate.linearRampToValueAtTime(rate1, t0 + src.buffer.duration * 0.8);
    var g = A.gain(peak || 0.5, out);
    src.connect(g);
    src.start(t0);
    return t0 + src.buffer.duration / Math.min(rate0 || 1, rate1 || rate0 || 1);
  }
  var M = A.mtof;

  R.cast = function (ctx, out, o, t) { return noiseBurst(out, 'white', 'bandpass', 400 * P(o), 2000 * P(o), 1.4, t, 0.04, 0.3, 0.35); };
  R.splashSmall = function (ctx, out, o, t) {
    noiseBurst(out, 'white', 'lowpass', 3200 * P(o), 380, 0.8, t, 0.004, 0.14, 0.5);
    return tone(out, 'sine', 180 * P(o), 90, t, 0.004, 0.09, 0.18);
  };
  R.splashBig = function (ctx, out, o, t) {
    noiseBurst(out, 'white', 'lowpass', 2600 * P(o), 260, 0.7, t, 0.006, 0.32, 0.62);
    noiseBurst(out, 'pink', 'bandpass', 900, 500, 0.9, t + 0.05, 0.02, 0.28, 0.25);
    return tone(out, 'sine', 95 * P(o), 48, t, 0.005, 0.25, 0.4);
  };
  R['splash-jump'] = function (ctx, out, o, t) { return R.splashBig(ctx, out, o, t); };
  R.reel = function (ctx, out, o, t) { return noiseBurst(out, 'white', 'highpass', 3500 * P(o), 0, 0.7, t, 0.001, 0.004, 0.18); };
  R.nibble = function (ctx, out, o, t) { return tone(out, 'sine', 1200 * P(o), 0, t, 0.002, 0.015, 0.28); };
  R.bite = function (ctx, out, o, t) { return tone(out, 'sine', 140 * P(o), 90 * P(o), t, 0.003, 0.12, 0.7, 0.1); };
  R.hook = function (ctx, out, o, t) { return ks(out, 'ks220', t, 0.55, P(o), P(o)); };
  R.tension = function (ctx, out, o, t) {
    var g = A.gain(0.0001, out);
    var f = A.filter('bandpass', 520 * P(o), 9, g);
    f.frequency.linearRampToValueAtTime(640 * P(o), t + 0.12);
    f.frequency.linearRampToValueAtTime(470 * P(o), t + 0.25);
    var src = A.noise('pink', f);
    var end = A.env(g, t, 0.05, 0.22, 0.5);
    src.start(t, Math.random());
    A.stopAt(src, end + 0.05);
    return end;
  };
  R.snap = function (ctx, out, o, t) {
    noiseBurst(out, 'white', 'highpass', 2200, 0, 0.7, t, 0.001, 0.05, 0.5);
    return ks(out, 'ks165', t, 0.5, 1.15 * P(o), 0.6 * P(o));
  };
  R.escape = function (ctx, out, o, t) { return tone(out, 'triangle', 600 * P(o), 200 * P(o), t, 0.02, 0.5, 0.22, 0.5); };
  R.catch = function (ctx, out, o, t) {
    var notes = [72, 76, 79, 84], end = t;
    notes.forEach(function (n, i) { end = Math.max(end, pluck(out, M(n) * P(o), t + i * 0.085, 0.24, 0.7)); });
    return end;
  };
  R.newSpecies = function (ctx, out, o, t) {
    var notes = [72, 74, 79, 81, 86], end = t;
    notes.forEach(function (n, i) { end = Math.max(end, pluck(out, M(n) * P(o), t + i * 0.07, 0.18, 0.6)); });
    return Math.max(end, bell(out, M(91) * P(o), t + 0.4, 0.14, 3));
  };
  R.rare = function (ctx, out, o, t) {
    var g = A.gain(0.0001, out);
    var trem = A.gain(0.5, g);
    var lfo = A.osc('sine', 9, null);
    var lfoG = A.gain(0.5);
    lfo.connect(lfoG);
    lfoG.connect(trem.gain);
    var oscs = [2093, 2637, 3136].map(function (f, i) {
      var os = A.osc('sine', f * P(o) * (1 + i * 0.002), trem);
      os.start(t + i * 0.06);
      return os;
    });
    var end = A.env(g, t, 0.08, 1.3, 0.12);
    lfo.start(t);
    oscs.forEach(function (os) { A.stopAt(os, end + 0.05); });
    A.stopAt(lfo, end + 0.05);
    return end;
  };
  R.legendary = function (ctx, out, o, t) {
    var base = 98 * P(o), end = t;
    [[1, 0.4], [2.41, 0.22], [3.93, 0.14], [5.4, 0.08], [6.79, 0.05]].forEach(function (pp, i) {
      end = Math.max(end, tone(out, 'sine', base * pp[0], 0, t, 0.006, 4.2 - i * 0.5, pp[1]));
    });
    var g = A.gain(0.0001, out);
    var lp = A.filter('lowpass', 260, 0.5, g);
    var pad = A.osc('sawtooth', 49 * P(o), lp);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.12, t + 1.4);
    g.gain.linearRampToValueAtTime(0.0001, t + 4.5);
    pad.start(t);
    A.stopAt(pad, t + 4.6);
    return Math.max(end, t + 4.6);
  };
  R.coin = function (ctx, out, o, t) {
    tone(out, 'triangle', 1318 * P(o), 0, t, 0.002, 0.12, 0.2);
    return tone(out, 'triangle', 1760 * P(o), 0, t + 0.06, 0.002, 0.3, 0.2);
  };
  R.pearl = function (ctx, out, o, t) {
    var end = bell(out, 1568 * P(o), t, 0.12, 1.4);
    return Math.max(end, bell(out, 2349 * P(o), t + 0.09, 0.08, 1.2));
  };
  R.feed = function (ctx, out, o, t) {
    var end = t;
    for (var i = 0; i < 5; i++) end = Math.max(end, tone(out, 'sine', (2200 + Math.random() * 1600) * P(o), 0, t + i * 0.055 + Math.random() * 0.02, 0.001, 0.025, 0.12));
    return end;
  };
  R.bubble = function (ctx, out, o, t) { return tone(out, 'sine', 480 * P(o), 1150 * P(o), t, 0.004, 0.07, 0.22, 0.06); };
  R.buy = function (ctx, out, o, t) {
    noiseBurst(out, 'white', 'bandpass', 1800, 900, 2, t, 0.002, 0.05, 0.25);
    tone(out, 'triangle', 1568 * P(o), 0, t + 0.05, 0.002, 0.18, 0.2);
    return tone(out, 'triangle', 2093 * P(o), 0, t + 0.12, 0.002, 0.45, 0.2);
  };
  R.goal = function (ctx, out, o, t) {
    pluck(out, M(67) * P(o), t, 0.22, 0.4);
    pluck(out, M(72) * P(o), t + 0.12, 0.22, 0.4);
    return pluck(out, M(76) * P(o), t + 0.24, 0.26, 1.1);
  };
  R.uiTap = function (ctx, out, o, t) { return tone(out, 'sine', 1800 * P(o), 0, t, 0.001, 0.012, 0.07); };
  R.uiBack = function (ctx, out, o, t) { return tone(out, 'sine', 900 * P(o), 700 * P(o), t, 0.001, 0.03, 0.08); };
  R.uiOpen = function (ctx, out, o, t) {
    tone(out, 'sine', 1200 * P(o), 0, t, 0.001, 0.02, 0.06);
    return tone(out, 'sine', 1600 * P(o), 0, t + 0.035, 0.001, 0.03, 0.06);
  };
  R.error = function (ctx, out, o, t) {
    var g = A.gain(0.0001, out);
    var lp = A.filter('lowpass', 700, 0.8, g);
    var os = A.osc('sawtooth', 110 * P(o), lp);
    var end = A.env(g, t, 0.005, 0.08, 0.22);
    os.start(t);
    A.stopAt(os, end + 0.05);
    return end;
  };

  // ---- fight tells (§4.8 audio column; internal names)
  R.tellRun = function (ctx, out, o, t) {
    var g = A.gain(0.0001, out);
    var bp = A.filter('bandpass', 900, 3, g);
    var os = A.osc('sawtooth', 70 * P(o), bp);
    os.frequency.linearRampToValueAtTime(150 * P(o), t + 0.45);
    var lfo = A.osc('square', 28, null), lg = A.gain(0.4);
    lfo.connect(lg); lg.connect(g.gain);
    var end = A.env(g, t, 0.05, 0.45, 0.2);
    os.start(t); lfo.start(t);
    A.stopAt(os, end + 0.05); A.stopAt(lfo, end + 0.05);
    return end;
  };
  R.tellDive = function (ctx, out, o, t) { return tone(out, 'sine', 75 * P(o), 38, t, 0.004, 0.24, 0.6, 0.2); };
  R.tellJump = function (ctx, out, o, t) { return noiseBurst(out, 'pink', 'lowpass', 300, 1800, 1, t, 0.25, 0.3, 0.35); };
  R.tellShake = function (ctx, out, o, t) {
    var end = t;
    for (var i = 0; i < 6; i++) end = Math.max(end, noiseBurst(out, 'white', 'bandpass', 2600 * P(o), 0, 4, t + i * 0.045, 0.001, 0.012, 0.3));
    return end;
  };
  R.tellBurrow = function (ctx, out, o, t) {
    var g = A.gain(0.0001, out);
    var bp = A.filter('bandpass', 1300, 1.2, g);
    var src = A.noise('white', bp);
    var p = g.gain;
    p.setValueAtTime(0.0001, t);
    for (var i = 0; i < 8; i++) p.linearRampToValueAtTime(0.05 + Math.random() * 0.18, t + 0.02 + i * 0.045);
    p.linearRampToValueAtTime(0.0001, t + 0.42);
    src.start(t, Math.random());
    A.stopAt(src, t + 0.45);
    return t + 0.45;
  };
  R.tellGrip = function (ctx, out, o, t) {
    var g = A.gain(0.0001, out);
    var bp = A.filter('bandpass', 480, 12, g);
    var os = A.osc('sawtooth', 58 * P(o), bp);
    bp.frequency.linearRampToValueAtTime(620, t + 0.2);
    bp.frequency.linearRampToValueAtTime(430, t + 0.4);
    var end = A.env(g, t, 0.06, 0.38, 0.5);
    os.start(t);
    A.stopAt(os, end + 0.05);
    return end;
  };
  R.tellInk = function (ctx, out, o, t) {
    noiseBurst(out, 'pink', 'lowpass', 420, 160, 0.7, t, 0.004, 0.2, 0.5);
    return tone(out, 'sine', 120 * P(o), 60, t, 0.003, 0.14, 0.35);
  };
  // ambience bloop (also used by music.js)
  R.bloop = function (ctx, out, o, t) {
    var f = (300 + Math.random() * 600) * P(o);
    return tone(out, 'sine', f, f * 0.55, t, 0.003, 0.045, (o && o.peak) || 0.1, 0.04);
  };
})(window.AQ);
