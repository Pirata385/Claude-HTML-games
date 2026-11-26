// Água-Tinta — audio hub (owner E), §13. Web Audio only, no files.
// Graph: buses music / sfx / ambience → master → DynamicsCompressor → destination. The context is created on the
// first gesture (app:gesture), suspended on app:hidden, resumed on app:visible. Every gain change is ramped
// (setTargetAtTime) so nothing clicks. Recipes live in sfx.js, music + ambience in music.js.
(function (AQ) {
  'use strict';

  var Ctor = (typeof window !== 'undefined') && (window.AudioContext || window.webkitAudioContext);
  var duckOn = false;
  var lastSfx = Object.create(null);
  // stingers that briefly dip the music so they stand clear (seconds)
  var JINGLE = { catch: 0.9, newSpecies: 1.4, rare: 1.2, legendary: 2.6, goal: 1.1, buy: 0.5, escape: 0.8, snap: 0.5 };

  var A = AQ.audio = AQ.audio || {};
  A.ready = false;
  A.ctx = null;
  A.bus = null;
  A.recipes = A.recipes || {};
  A.buffers = {};
  A.state = { mood: 'title', amb: { zone: 'baia', underwater: 0, weather: 'limpo', phase: 'dia', scene: 'title' }, tension: null, reel: false, reelSpeed: 0 };

  function vol(k) { var v = AQ.settings && AQ.settings.get(k); return typeof v === 'number' ? v : 0.6; }
  function now() { return A.ctx ? A.ctx.currentTime : 0; }

  // ---------------------------------------------------------------- shared helpers (used by sfx.js / music.js)
  A.ramp = function (param, value, tc, at) {
    if (!param || !A.ctx) return;
    var t0 = at || A.ctx.currentTime;
    try {
      param.cancelScheduledValues(t0);
      param.setValueAtTime(param.value, t0);
      param.setTargetAtTime(value, t0, tc || 0.05);
    } catch (e) { param.value = value; }
  };
  // Percussive envelope on a GainNode's gain: 0 → peak in a, exponential decay to silence over d.
  A.env = function (g, t0, a, d, peak) {
    var p = g.gain;
    p.cancelScheduledValues(t0);
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
    if (loop) src.loopStart = 0;
    if (dest) src.connect(dest);
    return src;
  };
  A.stopAt = function (node, t) { try { node.stop(t); } catch (e) { /* ignore */ } };
  A.mtof = function (m) { return 440 * Math.pow(2, (m - 69) / 12); };

  // ---------------------------------------------------------------- 16-bit voice helpers (sfx.js / music.js)
  var waves = {};
  // PeriodicWave for a pulse wave of the given duty cycle (SNES/NES-style), cached.
  A.wave = function (duty) {
    var k = Math.round(duty * 1000);
    if (waves[k]) return waves[k];
    var N = 48, re = new Float32Array(N), im = new Float32Array(N);
    for (var n = 1; n < N; n++) im[n] = (2 / (n * Math.PI)) * Math.sin(n * Math.PI * duty);
    waves[k] = A.ctx.createPeriodicWave(re, im);
    return waves[k];
  };
  // 2-operator FM voice (Mega Drive style). o: r mod ratio, i0 → i1 modulation index over id seconds, wave,
  // a attack, peak, d decay (percussive) or dur+rel (sustained, with sus level), bend (start pitch ratio).
  // Returns the end time; nodes are stopped and disconnected after it.
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
    if (o.bend) { car.frequency.setValueAtTime(f * o.bend, t); car.frequency.exponentialRampToValueAtTime(f, t + (o.bt || 0.05)); mod.frequency.setValueAtTime(f * r * o.bend, t); mod.frequency.exponentialRampToValueAtTime(f * r, t + (o.bt || 0.05)); }
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
    car.onended = function () { try { g.disconnect(); mg.disconnect(); } catch (e) { /* ignore */ } };
    return end;
  };
  // Two detuned pulse (or other) oscillators through a lowpass with a filter envelope — SNES-ish lead/pluck.
  // o: duty, type (instead of pulse), det cents, cut, cutEnv (start multiplier), cutDecay, a, peak, sus, rel, perc (decay), vib.
  A.pulse = function (dest, f, t, dur, o) {
    var c = A.ctx, a = o.a || 0.006, pk = Math.max(0.0003, o.peak || 0.15), det = o.det === undefined ? 6 : o.det;
    var g = c.createGain(); g.connect(dest);
    var lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = o.q || 0.6; lp.connect(g);
    var cut = o.cut || 3000;
    lp.frequency.setValueAtTime(Math.min(12000, cut * (o.cutEnv || 1)), t);
    if (o.cutEnv && o.cutEnv !== 1) lp.frequency.exponentialRampToValueAtTime(cut, t + (o.cutDecay || 0.15));
    var end, oscs = [], k;
    var wv = o.type ? null : A.wave(o.duty || 0.25);
    for (k = 0; k < 2; k++) {
      var os = c.createOscillator();
      if (wv) os.setPeriodicWave(wv); else os.type = o.type;
      os.frequency.value = f;
      os.detune.value = (k ? det : -det);
      os.connect(lp);
      if (o.vib && A.vibG) A.vibG.connect(os.detune);
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
    oscs[0].onended = function () {
      try {
        g.disconnect(); lp.disconnect();
        if (o.vib && A.vibG) for (var j = 0; j < 2; j++) { try { A.vibG.disconnect(oscs[j].detune); } catch (e2) { /* ignore */ } }
      } catch (e) { /* ignore */ }
    };
    return end;
  };
  // Echo hop time (SNES-style, 180–320 ms), usually derived from the music tempo.
  A.setEcho = function (sec) {
    if (!A.bus || !A.bus.echo) return;
    var h = sec;
    while (h > 0.32) h /= 2;
    while (h < 0.18) h *= 2;
    A.bus.echo.dL.delayTime.setTargetAtTime(h, A.ctx.currentTime, 0.25);
    A.bus.echo.dR.delayTime.setTargetAtTime(h, A.ctx.currentTime, 0.25);
  };

  function makeBuffers() {
    var sr = A.ctx.sampleRate;
    function buf(sec, fill) {
      var b = A.ctx.createBuffer(1, Math.floor(sr * sec), sr);
      fill(b.getChannelData(0), sr);
      return b;
    }
    var seed = 22222;
    function rnd() { seed = (seed * 16807) % 2147483647; return seed / 2147483647 * 2 - 1; }
    A.buffers.white = buf(2, function (d) { for (var i = 0; i < d.length; i++) d[i] = rnd(); });
    A.buffers.brown = buf(4, function (d) {
      var last = 0;
      for (var i = 0; i < d.length; i++) { last = (last + 0.02 * rnd()) / 1.02; d[i] = last * 3.5; }
      // smooth the loop seam
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
    // Karplus-Strong plucks (precomputed): 220 Hz twang for 'hook', 165 Hz for 'snap'.
    function ks(freq, sec, damp) {
      return buf(sec, function (d, rate) {
        var N = Math.max(2, Math.round(rate / freq));
        var ring = new Float32Array(N);
        for (var i = 0; i < N; i++) ring[i] = rnd() * 0.8;
        var idx = 0;
        for (var j = 0; j < d.length; j++) {
          var nx = (idx + 1) % N;
          var v = (ring[idx] + ring[nx]) * 0.5 * damp;
          d[j] = ring[idx];
          ring[idx] = v;
          idx = nx;
        }
        var fade = Math.floor(rate * 0.02);
        for (var k = 0; k < fade; k++) d[d.length - 1 - k] *= k / fade;
      });
    }
    A.buffers.ks220 = ks(220, 1.2, 0.996);
    A.buffers.ks165 = ks(165, 0.9, 0.993);
  }

  function build() {
    var ctx = A.ctx;
    // master → compressor (glue) → brickwall-ish limiter → out: peaks never clip
    var limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -2; limiter.knee.value = 0; limiter.ratio.value = 20; limiter.attack.value = 0.001; limiter.release.value = 0.08;
    limiter.connect(ctx.destination);
    // make-up gain after the glue compressor (+2.5 dB) so the mix reads on phone speakers (~-19 dB mean out);
    // the limiter after it keeps peaks from clipping
    var makeup = A.gain(1.33, limiter);
    var comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16; comp.knee.value = 10; comp.ratio.value = 3.5; comp.attack.value = 0.005; comp.release.value = 0.2;
    comp.connect(makeup);
    var master = A.gain(0.0001, comp);
    // SNES-style echo: ping-pong feedback delay through lowpass filters, returns into master
    var echoIn = A.gain(1);
    var echoOut = A.gain(0.9, master);
    var dL = ctx.createDelay(1.0), dR = ctx.createDelay(1.0);
    dL.delayTime.value = 0.24; dR.delayTime.value = 0.24;
    var lpL = A.filter('lowpass', 2600, 0.5), lpR = A.filter('lowpass', 2600, 0.5);
    var fbL = A.gain(0.42), fbR = A.gain(0.42);
    var pL = ctx.createStereoPanner ? ctx.createStereoPanner() : null, pR = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    echoIn.connect(dL);
    dL.connect(lpL);
    lpL.connect(fbL); fbL.connect(dR);
    dR.connect(lpR);
    lpR.connect(fbR); fbR.connect(dL);
    if (pL && pR) { pL.pan.value = -0.65; pR.pan.value = 0.65; lpL.connect(pL); lpR.connect(pR); pL.connect(echoOut); pR.connect(echoOut); }
    else { lpL.connect(echoOut); lpR.connect(echoOut); }
    var sfx = A.gain(0, master);
    var sfxSend = A.gain(0.2, echoIn);
    sfx.connect(sfxSend);
    A.bus = {
      master: master,
      comp: comp,
      limiter: limiter,
      music: A.gain(0, master),
      musicSend: A.gain(0, echoIn),   // music echo sends feed this; it follows the music volume (and ducking)
      sfx: sfx,
      ambience: A.gain(0, master),
      echoIn: echoIn,
      echo: { dL: dL, dR: dR, fbL: fbL, fbR: fbR, lpL: lpL, lpR: lpR }
    };
    // shared vibrato LFO for pulse leads (±cents)
    var vib = A.osc('sine', 5.3, null);
    A.vibG = A.gain(7);
    vib.connect(A.vibG);
    vib.start();
    makeBuffers();
  }

  // ---------------------------------------------------------------- public API (§15.5)
  A.init = function () {
    var E = AQ.events;
    E.on('app:gesture', function () { A.unlock(); });
    armUnlock();
    E.on('app:hidden', function () { A.suspend(); });
    E.on('app:visible', function () { A.resume(); });
    E.on('settings:changed', function (p) { if (p && /^vol/.test(p.key)) A.applyVolumes(); });
    E.on('pause:changed', function (p) { A.duck(!!(p && p.paused)); });
    E.on('scene:changed', function (p) { onScene(p.to, p.params || {}); });
    E.on('world:phase', function () { refreshWorld(); });
    E.on('world:weather', function () { refreshWorld(); });
    wireSfx(E);
    onScene((AQ.scenes && AQ.scenes.current) || 'title', {});
  };

  // Mobile browsers (iOS/WebKit above all) only let audio start inside touchend / click / keydown — not
  // inside a touch pointerdown, which is where the first app:gesture fires. So keep a set of capture
  // listeners for activation-type events and retry unlock() on each until the context really runs; re-arm
  // when the system interrupts or suspends it (phone call, Siri, other app took the audio).
  var UNLOCK_EVENTS = ['pointerup', 'touchend', 'click', 'keydown', 'mousedown'];
  var armed = false;
  function tryUnlock() {
    A.unlock().then(function () { if (A.ctx && A.ctx.state === 'running') disarmUnlock(); });
  }
  function armUnlock() {
    if (armed || typeof window === 'undefined' || !window.addEventListener) return;
    armed = true;
    for (var i = 0; i < UNLOCK_EVENTS.length; i++) window.addEventListener(UNLOCK_EVENTS[i], tryUnlock, true);
  }
  function disarmUnlock() {
    if (!armed) return;
    armed = false;
    for (var i = 0; i < UNLOCK_EVENTS.length; i++) window.removeEventListener(UNLOCK_EVENTS[i], tryUnlock, true);
  }

  // unlock() → Promise. Creates/resumes the context; must run inside a user gesture the first time.
  A.unlock = function () {
    if (!Ctor) return Promise.resolve(false);
    try {
      if (!A.ctx) {
        // iOS 16.4+: play through the silent switch, like a game should (Web Audio is muted by it otherwise).
        try { if (typeof navigator !== 'undefined' && navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e0) { /* optional */ }
        A.ctx = new Ctor({ latencyHint: 'interactive' });
        A.ctx.onstatechange = function () {
          if (A.ctx.state !== 'running' && A.ctx.state !== 'closed' && !(typeof document !== 'undefined' && document.hidden)) armUnlock();
        };
        build();
        A.ready = true;
        if (A.music && A.music.start) A.music.start();
        A.applyVolumes(true);
      }
      var hidden = typeof document !== 'undefined' && document.hidden;
      // 'interrupted' is WebKit's state after a call/Siri; it needs resume() just like 'suspended'
      var p = A.ctx.state !== 'running' && A.ctx.state !== 'closed' && !hidden ? A.ctx.resume() : Promise.resolve();
      if (!hidden) {
        // classic iOS kick: a 1-sample silent buffer started inside the gesture opens the output
        try { var kick = A.ctx.createBufferSource(); kick.buffer = A.ctx.createBuffer(1, 1, 22050); kick.connect(A.ctx.destination); kick.start(0); } catch (e1) { /* ignore */ }
      }
      return Promise.resolve(p).then(function () { return true; }, function () { return false; });
    } catch (e) {
      console.warn('[AQ.audio] unlock failed:', e);
      return Promise.resolve(false);
    }
  };

  A.applyVolumes = function (fadeIn) {
    if (!A.ready) return;
    var d = duckOn ? 0.35 : 1;
    A.ramp(A.bus.master.gain, Math.max(0.0001, vol('volMaster')), fadeIn ? 0.6 : 0.05);
    A.ramp(A.bus.music.gain, vol('volMusic') * 1.1 * d, 0.15);
    A.ramp(A.bus.musicSend.gain, vol('volMusic') * 1.1 * d, 0.15);
    A.ramp(A.bus.sfx.gain, vol('volSfx'), 0.05);
    A.ramp(A.bus.ambience.gain, vol('volAmbience') * 0.9 * (duckOn ? 0.5 : 1), 0.15);
  };
  A.duck = function (on) { duckOn = !!on; A.applyVolumes(); };

  A.suspend = function () {
    if (!A.ctx || A.ctx.state !== 'running') return;
    A.ramp(A.bus.master.gain, 0.0001, 0.02);
    var c = A.ctx;
    setTimeout(function () { if (typeof document === 'undefined' || document.hidden) c.suspend().catch(function () {}); }, 90);
  };
  A.resume = function () {
    if (!A.ctx) return;
    A.ctx.resume().then(function () { A.applyVolumes(true); }, function () { armUnlock(); });
  };

  // sfx(name, opts?{vol, pitch, pan})
  A.sfx = function (name, opts) {
    if (!A.ready || !A.ctx || A.ctx.state !== 'running') return;
    var r = A.recipes[name];
    if (!r) return;
    var t = A.ctx.currentTime;
    var minGap = name === 'uiTap' ? 0.03 : name === 'coin' ? 0.07 : 0.04;
    if (lastSfx[name] && t - lastSfx[name] < minGap) return;
    lastSfx[name] = t;
    var o = opts || {};
    if (JINGLE[name] && A.music && A.music.duck) A.music.duck(JINGLE[name]);
    try {
      var out = A.gain(o.vol === undefined ? 1 : o.vol, A.bus.sfx);
      var dest = out;
      if (o.pan && A.ctx.createStereoPanner) {
        var pn = A.ctx.createStereoPanner();
        pn.pan.value = Math.max(-1, Math.min(1, o.pan));
        pn.connect(out);
        dest = pn;
      }
      var end = r(A.ctx, dest, o, t + 0.005) || (t + 1);
      setTimeout(function () { try { out.disconnect(); } catch (e) { /* ignore */ } }, Math.max(200, (end - t + 0.3) * 1000));
    } catch (e) { /* never throw from audio */ }
  };

  A.setMood = function (mood) {
    A.state.mood = mood || 'title';
    if (A.music && A.music.setMood) A.music.setMood(A.state.mood);
  };
  // setAmbience({zone, underwater, weather, phase}) — partial updates allowed.
  A.setAmbience = function (o) {
    if (!o) return;
    var a = A.state.amb;
    for (var k in o) if (o[k] !== undefined) a[k] = o[k];
    if (A.music && A.music.setAmbience) A.music.setAmbience(a);
  };
  A.setTension = function (v) {
    A.state.tension = (v === null || v === undefined) ? null : Math.max(0, Math.min(1.6, +v || 0));
    if (A.music && A.music.setTension) A.music.setTension(A.state.tension);
  };
  // reel(on, speed 0..1): ticks at a rate ∝ speed.
  A.reel = function (on, speed) {
    A.state.reel = !!on;
    A.state.reelSpeed = Math.max(0, Math.min(1, speed === undefined ? 0.6 : +speed || 0));
    if (A.music && A.music.setReel) A.music.setReel(A.state.reel, A.state.reelSpeed);
  };

  // ---------------------------------------------------------------- scene / world → mood + ambience
  function worldBits() {
    var n = AQ.ui && AQ.ui.dom ? AQ.ui.dom.worldNow() : { phase: 'dia', weather: 'limpo' };
    return { phase: n.phase, weather: n.weather };
  }
  function onScene(scene, params) {
    var w = worldBits();
    var zone = params.zone || (AQ.state && AQ.state.player && AQ.state.player.zone) || 'baia';
    if (scene === 'fishing') { A.setMood(zone); A.setAmbience({ scene: scene, zone: zone, underwater: 0, weather: w.weather, phase: w.phase }); }
    else if (scene === 'map') { A.setMood('map'); A.setAmbience({ scene: scene, zone: 'baia', underwater: 0, weather: w.weather, phase: w.phase }); }
    else if (scene === 'aquarium') { A.setMood('aquarium'); A.setAmbience({ scene: scene, zone: 'aquarium', underwater: 0.55, weather: 'limpo', phase: w.phase }); }
    else if (scene === 'ending') { A.setMood('ending'); A.setAmbience({ scene: scene, zone: 'abismo', underwater: 0.2, weather: 'limpo', phase: 'noite' }); }
    else { A.setMood('title'); A.setAmbience({ scene: 'title', zone: 'baia', underwater: 0, weather: 'limpo', phase: 'dia' }); }
    if (scene !== 'fishing') { A.setTension(null); A.reel(false); }
  }
  function refreshWorld() {
    var w = worldBits();
    var sc = AQ.scenes && AQ.scenes.current;
    if (sc === 'aquarium') A.setAmbience({ phase: w.phase });
    else if (sc === 'fishing' || sc === 'map') A.setAmbience({ phase: w.phase, weather: w.weather });
    if (A.music && A.music.refresh) A.music.refresh();
  }

  // ---------------------------------------------------------------- gameplay events → sfx (§15.9)
  var TELL_SFX = { run: 'tellRun', dive: 'tellDive', jump: 'tellJump', shake: 'tellShake', burrow: 'tellBurrow', grip: 'tellGrip', ink: 'tellInk' };
  function wireSfx(E) {
    E.on('fish:cast', function () { A.sfx('cast'); });
    E.on('fish:splash', function (p) {
      var pan = 0;
      if (p && typeof p.wx === 'number' && AQ.display && AQ.display.cols) pan = (p.wx / AQ.display.cols) * 2 - 1;
      A.sfx(p && p.big ? 'splashBig' : 'splashSmall', { pan: pan * 0.6 });
    });
    E.on('bite:nibble', function () { A.sfx('nibble'); });
    E.on('bite:strike', function () { A.sfx('bite'); });
    E.on('fight:start', function (p) {
      A.sfx('hook');
      if (A.music && A.music.fight) A.music.fight(true, p && p.rarity === 'L');
    });
    E.on('fight:tell', function (p) { if (p && TELL_SFX[p.kind]) A.sfx(TELL_SFX[p.kind]); });
    E.on('fight:phase', function () { A.sfx('tellDive', { vol: 0.8 }); });
    E.on('fight:end', function (p) {
      if (A.music && A.music.fight) A.music.fight(false);
      A.setTension(null);
      A.reel(false);
      if (!p || p.result === 'landed') return;
      A.sfx(p.result === 'snap' || p.result === 'fray' ? 'snap' : 'escape');
    });
    E.on('catch:landed', function (p) {
      var sp = p && p.specimen && AQ.species && AQ.species.get ? AQ.species.get(p.specimen.sp) : null;
      A.sfx('catch');
      if (sp && sp.rarity === 'L') setTimeout(function () { A.sfx('legendary'); }, 350);
      else if ((sp && sp.rarity === 'R') || (p && p.specimen && p.specimen.dense)) setTimeout(function () { A.sfx('rare'); }, 350);
    });
    E.on('species:new', function () { setTimeout(function () { A.sfx('newSpecies'); }, 200); });
    E.on('sighting:new', function () { A.sfx('rare'); });
    E.on('legendary:near', function () { A.sfx('legendary', { vol: 0.7 }); if (A.music && A.music.omen) A.music.omen(); });
    E.on('message:found', function () { A.sfx('pearl'); });
    E.on('wallet:changed', function (p) {
      if (!p) return;
      if (p.dCoins > 0 && p.reason !== 'buy' && p.reason !== 'debug') A.sfx('coin');
      if (p.dPearls > 0) setTimeout(function () { A.sfx('pearl'); }, 90);
    });
    E.on('aquarium:fed', function () { A.sfx('feed'); });
    E.on('aquarium:bred', function () { A.sfx('bubble'); setTimeout(function () { A.sfx('bubble', { pitch: 1.3 }); }, 120); });
    E.on('achievement:unlocked', function () { /* goals.js plays 'rare' */ });
    E.on('frenzy:start', function () { A.sfx('splashBig', { vol: 0.6 }); if (A.music && A.music.frenzy) A.music.frenzy(true); });
    E.on('frenzy:end', function () { if (A.music && A.music.frenzy) A.music.frenzy(false); });
    E.on('shop:denied', function () { if (!(AQ.ui && AQ.ui.isOpen && AQ.ui.isOpen('shop'))) A.sfx('error'); });
  }
})(window.AQ);
