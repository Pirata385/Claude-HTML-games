// Água-Tinta — audio render tool: synth core (moved here from the game's old js/audio/audio.js).
// The game no longer synthesises anything at runtime; this code only runs inside render.html, driven by an
// OfflineAudioContext, to record the sound files in ../../audio/. Same voices as before: 2-op FM (Mega Drive),
// detuned pulse through a lowpass (SNES), noise buffers, Karplus-Strong plucks and a ping-pong "SNES echo".
// Math.random is replaced by a seeded generator so every render is reproducible (and loops repeat exactly).
(function (G) {
  'use strict';

  var A = G.SYN = G.SYN || {};
  A.ctx = null;
  A.bus = null;
  A.buffers = {};
  A.recipes = A.recipes || {};

  // ---------------------------------------------------------------- seeded randomness
  var seed = 1;
  A.seed = function (s) { seed = ((s >>> 0) % 2147483646) + 1; };
  A.rand = function () { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  A.hash = function (str) {
    var h = 2166136261;
    str = String(str);
    for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  };

  // ---------------------------------------------------------------- shared helpers
  A.ramp = function (param, value, tc, at) {
    var t0 = at || 0;
    try { param.setTargetAtTime(value, t0, tc || 0.05); } catch (e) { param.value = value; }
  };
  A.env = function (g, t0, a, d, peak) {
    var p = g.gain;
    p.setValueAtTime(0.0001, t0);
    p.linearRampToValueAtTime(Math.max(0.0002, peak), t0 + Math.max(0.002, a));
    p.exponentialRampToValueAtTime(0.0001, t0 + a + Math.max(0.01, d));
    return t0 + a + d;
  };
  A.gain = function (v, dest) {
    var g = A.ctx.createGain();
    g.gain.value = v === undefined ? 1 : v;
    if (dest) g.connect(dest);
    return g;
  };
  A.osc = function (type, freq, dest) {
    var o = A.ctx.createOscillator();
    o.type = type || 'sine';
    o.frequency.value = freq || 440;
    if (dest) o.connect(dest);
    return o;
  };
  A.filter = function (type, freq, q, dest) {
    var f = A.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    if (q !== undefined) f.Q.value = q;
    if (dest) f.connect(dest);
    return f;
  };
  A.noise = function (kind, dest, loop) {
    var src = A.ctx.createBufferSource();
    src.buffer = A.buffers[kind] || A.buffers.white;
    src.loop = !!loop;
    if (dest) src.connect(dest);
    return src;
  };
  A.mtof = function (m) { return 440 * Math.pow(2, (m - 69) / 12); };

  // ---------------------------------------------------------------- 16-bit voices
  var waves = {};
  A.wave = function (duty) {
    var k = Math.round(duty * 1000);
    if (waves[k]) return waves[k];
    var N = 48, re = new Float32Array(N), im = new Float32Array(N);
    for (var n = 1; n < N; n++) im[n] = (2 / (n * Math.PI)) * Math.sin(n * Math.PI * duty);
    waves[k] = A.ctx.createPeriodicWave(re, im);
    return waves[k];
  };
  // 2-operator FM voice. o: r mod ratio, i0 → i1 index over id s, wave, a, peak, d (percussive) or dur+rel+sus,
  // bend (start pitch ratio) over bt. Returns the end time.
  A.fm = function (dest, f, t, o) {
    var c = A.ctx, a = o.a || 0.003, pk = Math.max(0.0003, o.peak || 0.2), r = o.r || 1;
    var g = c.createGain(); g.connect(dest);
    var car = c.createOscillator(); car.type = o.wave || 'sine'; car.frequency.value = f; car.connect(g);
    var mod = c.createOscillator(); mod.frequency.value = f * r;
    var mg = c.createGain(); mod.connect(mg); mg.connect(car.frequency);
    var i0 = (o.i0 === undefined ? 2 : o.i0) * f * r, i1 = Math.max(0.01, (o.i1 === undefined ? 0.3 : o.i1)) * f * r;
    mg.gain.setValueAtTime(Math.max(0.01, i0), t);
    if (i1 > i0) mg.gain.linearRampToValueAtTime(i1, t + (o.id || 0.1));
    else mg.gain.exponentialRampToValueAtTime(i1, t + (o.id || 0.1));
    if (o.bend) {
      car.frequency.setValueAtTime(f * o.bend, t); car.frequency.exponentialRampToValueAtTime(f, t + (o.bt || 0.05));
      mod.frequency.setValueAtTime(f * r * o.bend, t); mod.frequency.exponentialRampToValueAtTime(f * r, t + (o.bt || 0.05));
    }
    var end;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(pk, t + a);
    if (o.dur) {
      var rel = o.rel || 0.12;
      g.gain.setTargetAtTime(pk * (o.sus === undefined ? 0.7 : o.sus), t + a, (o.d || 0.3) / 3);
      g.gain.setTargetAtTime(0.0001, t + o.dur, rel / 3);
      end = t + o.dur + rel * 1.6;
    } else {
      g.gain.exponentialRampToValueAtTime(0.0001, t + a + (o.d || 0.4));
      end = t + a + (o.d || 0.4);
    }
    car.start(t); mod.start(t);
    car.stop(end + 0.02); mod.stop(end + 0.02);
    return end;
  };
  // Two detuned pulse (or other) oscillators through a lowpass with a filter envelope.
  A.pulse = function (dest, f, t, dur, o) {
    var c = A.ctx, a = o.a || 0.006, pk = Math.max(0.0003, o.peak || 0.15), det = o.det === undefined ? 6 : o.det;
    var g = c.createGain(); g.connect(dest);
    var lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = o.q || 0.6; lp.connect(g);
    var cut = o.cut || 3000;
    lp.frequency.setValueAtTime(Math.min(12000, cut * (o.cutEnv || 1)), t);
    if (o.cutEnv && o.cutEnv !== 1) lp.frequency.exponentialRampToValueAtTime(cut, t + (o.cutDecay || 0.15));
    var end, oscs = [], k;
    var wv = o.type ? null : A.wave(o.duty || 0.25);
    // vibrato (±7 cents, 5.3 Hz): one LFO per note, started with it, so its phase repeats exactly in a loop
    var vibG = null;
    if (o.vib) {
      var lfo = c.createOscillator(); lfo.frequency.value = 5.3;
      vibG = c.createGain(); vibG.gain.value = 7; lfo.connect(vibG);
      oscs.lfo = lfo;
    }
    for (k = 0; k < 2; k++) {
      var os = c.createOscillator();
      if (wv) os.setPeriodicWave(wv); else os.type = o.type;
      os.frequency.value = f;
      os.detune.value = (k ? det : -det);
      os.connect(lp);
      if (vibG) vibG.connect(os.detune);
      oscs.push(os);
    }
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(pk, t + a);
    if (o.perc) {
      g.gain.exponentialRampToValueAtTime(0.0001, t + a + o.perc);
      end = t + a + o.perc;
    } else {
      var rel = o.rel || 0.08;
      g.gain.setTargetAtTime(pk * (o.sus === undefined ? 0.75 : o.sus), t + a, 0.08);
      g.gain.setTargetAtTime(0.0001, t + dur, rel / 3);
      end = t + dur + rel * 1.6;
    }
    for (k = 0; k < 2; k++) { oscs[k].start(t); oscs[k].stop(end + 0.02); }
    if (oscs.lfo) { oscs.lfo.start(t); oscs.lfo.stop(end + 0.02); }
    return end;
  };
  // Echo hop time (SNES-style, 180–320 ms), usually derived from the music tempo.
  A.setEcho = function (sec, fb) {
    var h = sec;
    while (h > 0.32) h /= 2;
    while (h < 0.18) h *= 2;
    A.bus.echo.dL.delayTime.value = h;
    A.bus.echo.dR.delayTime.value = h;
    if (fb !== undefined) { A.bus.echo.fbL.gain.value = fb; A.bus.echo.fbR.gain.value = fb; }
  };

  function makeBuffers() {
    var sr = A.ctx.sampleRate;
    function buf(sec, fill) {
      var b = A.ctx.createBuffer(1, Math.floor(sr * sec), sr);
      fill(b.getChannelData(0), sr);
      return b;
    }
    var s = 22222;
    function rnd() { s = (s * 16807) % 2147483647; return s / 2147483647 * 2 - 1; }
    A.buffers = {};
    A.buffers.white = buf(2, function (d) { for (var i = 0; i < d.length; i++) d[i] = rnd(); });
    A.buffers.brown = buf(4, function (d) {
      var last = 0;
      for (var i = 0; i < d.length; i++) { last = (last + 0.02 * rnd()) / 1.02; d[i] = last * 3.5; }
      var n = Math.floor(sr * 0.05);
      for (var j = 0; j < n; j++) { var k = j / n; d[d.length - n + j] = d[d.length - n + j] * (1 - k) + d[j] * k; }
    });
    A.buffers.pink = buf(3, function (d) {
      var b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (var i = 0; i < d.length; i++) {
        var w = rnd();
        b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.96900 * b2 + w * 0.1538520;
        b3 = 0.86650 * b3 + w * 0.3104856; b4 = 0.55000 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.0168980;
        d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
        b6 = w * 0.115926;
      }
    });
    // reel click: noise tick with a short 2.4 kHz ring
    var len = Math.floor(sr * 0.02), rc = A.ctx.createBuffer(1, len, sr), d = rc.getChannelData(0);
    for (var i = 0; i < len; i++) { var e = Math.exp(-i / (sr * 0.0035)); d[i] = rnd() * 0.7 * e + Math.sin(2 * Math.PI * 2400 * i / sr) * 0.5 * e; }
    A.buffers.reelClick = rc;
  }

  // Cyclic noise buffer of exactly `frames` samples (its end flows into its start), for seamless ambience loops.
  // kind: 'white' | 'brown'.
  A.cyclicNoise = function (kind, frames, seedStr) {
    var sr = A.ctx.sampleRate, b = A.ctx.createBuffer(1, frames, sr), d = b.getChannelData(0);
    A.seed(A.hash(seedStr || kind));
    var w = new Float32Array(frames), i;
    for (i = 0; i < frames; i++) w[i] = A.rand() * 2 - 1;
    if (kind === 'brown') {
      var last = 0, pass;
      for (pass = 0; pass < 2; pass++) for (i = 0; i < frames; i++) { last = (last + 0.02 * w[i]) / 1.02; if (pass) d[i] = last * 3.5; }
    } else d.set(w);
    return b;
  };

  // setup(ctx) — builds the bus graph on an (offline) context. Every bus ends in A.bus.out → destination
  // with no compressor: the game's runtime mixer (compressor + limiter) processes the mix of the recorded files.
  A.setup = function (ctx) {
    A.ctx = ctx;
    waves = {};
    var out = A.gain(1, ctx.destination);
    var echoIn = A.gain(1);
    var echoOut = A.gain(0.9, out);
    var dL = ctx.createDelay(1.0), dR = ctx.createDelay(1.0);
    dL.delayTime.value = 0.24; dR.delayTime.value = 0.24;
    var lpL = A.filter('lowpass', 2600, 0.5), lpR = A.filter('lowpass', 2600, 0.5);
    var fbL = A.gain(0.42), fbR = A.gain(0.42);
    var pL = ctx.createStereoPanner(), pR = ctx.createStereoPanner();
    echoIn.connect(dL);
    dL.connect(lpL); lpL.connect(fbL); fbL.connect(dR);
    dR.connect(lpR); lpR.connect(fbR); fbR.connect(dL);
    pL.pan.value = -0.65; pR.pan.value = 0.65; lpL.connect(pL); lpR.connect(pR); pL.connect(echoOut); pR.connect(echoOut);
    var sfx = A.gain(1, out);
    sfx.connect(A.gain(0.2, echoIn));
    A.bus = {
      out: out,
      music: A.gain(1, out),
      musicSend: A.gain(1, echoIn),
      sfx: sfx,
      ambience: A.gain(1, out),
      echoIn: echoIn,
      echo: { dL: dL, dR: dR, fbL: fbL, fbR: fbR, lpL: lpL, lpR: lpR }
    };
    makeBuffers();
    return A.bus;
  };
})(window);
