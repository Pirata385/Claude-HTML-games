// Água-Tinta — audio hub (owner E), §13. Sample player: every sound is a recorded MP3 in audio/ listed in
// AQ.AUDIO_MANIFEST (js/data/audio-manifest.js), rendered offline by tools/audio-render/. Nothing is synthesised here.
// Web Audio (http/https, the Android app): the loading screen fetches every file and decodes the short ones; long
// music is decoded on demand from the fetched bytes (small LRU of decoded tracks). Graph: voices → buses music /
// sfx / ambience → master → glue compressor → make-up → limiter → soft clip → destination. Loops use the exact
// loopStart/loopEnd of the manifest. From file:// (fetch is blocked) it falls back to HTMLAudioElements with
// simpler mixing (per-element volume, no sync). The context is created inside the loading screen's start tap.
(function (AQ) {
  'use strict';

  var W = typeof window !== 'undefined' ? window : {};
  var Ctor = W.AudioContext || W.webkitAudioContext;
  var OffCtor = W.OfflineAudioContext || W.webkitOfflineAudioContext;
  var MAN = AQ.AUDIO_MANIFEST || {};
  var duckOn = false;

  var A = AQ.audio = AQ.audio || {};
  A.ready = false;      // output graph built and playing allowed (after the start tap)
  A.started = false;    // AQ.audio.start() ran (the loading screen's user activation)
  A.ctx = null;
  A.bus = null;
  A.manifest = MAN;
  A.state = { mood: 'title', amb: { zone: 'baia', underwater: 0, weather: 'limpo', phase: 'dia', scene: 'title' }, tension: null, reel: false, reelSpeed: 0 };
  A.mode = pickMode();

  function pickMode() {
    var forced = '';
    try { forced = (/[?&]audio=(html|webaudio|off)\b/.exec(W.location.search) || [])[1] || ''; } catch (e) { forced = ''; }
    if (forced === 'off') return 'none';
    // Settings → Sound engine: 'compat' plays through <audio> elements (for devices where Web Audio is silent)
    if (!forced && engine() === 'compat') forced = 'html';
    var file = false;
    try { file = W.location.protocol === 'file:'; } catch (e) { file = false; }
    if (forced !== 'html' && !file && Ctor && OffCtor && W.fetch) return 'webaudio';
    if (typeof W.Audio === 'function') return 'html';
    return Ctor && OffCtor && W.fetch ? 'webaudio' : 'none';
  }
  function vol(k) { var v = AQ.settings && AQ.settings.get(k); return typeof v === 'number' ? v : 0.6; }
  function engine() { try { return (AQ.settings && AQ.settings.get && AQ.settings.get('audioEngine')) || 'auto'; } catch (e) { return 'auto'; } }

  // Auto engine: on some devices the Web Audio output never renders (the context says 'running' but its clock
  // does not move). Check the clock once it runs; if it is stuck, switch to the compatible <audio> engine.
  var clockWatch = false;
  function watchClock() {
    var c = A.ctx;
    if (clockWatch || !c || c.state !== 'running') return;
    clockWatch = true;
    var t0 = c.currentTime, w0 = Date.now();
    setTimeout(function () {
      if (A.ctx !== c) return;
      if (c.state !== 'running') { clockWatch = false; return; }
      var adv = c.currentTime - t0, wall = (Date.now() - w0) / 1000;
      A.clockOk = adv > wall * 0.5;
      if (!A.clockOk && engine() === 'auto') fallbackToCompat();
    }, 1200);
  }
  function fallbackToCompat() {
    try { AQ.settings.set('audioEngine', 'compat'); } catch (e) { /* ignore */ }
    try { if (AQ.ui && AQ.ui.toast) AQ.ui.toast({ key: 'ui.toast.audioCompat' }, { kind: 'warn' }); } catch (e2) { /* ignore */ }
    try { if (AQ.store && AQ.store.flush) AQ.store.flush('audio-engine'); } catch (e3) { /* ignore */ }
    setTimeout(function () { try { W.location.reload(); } catch (e4) { /* ignore */ } }, 1800);
  }
  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
  A.now = function () { return A.ctx ? A.ctx.currentTime : Date.now() / 1000; };
  A.webaudio = function () { return A.mode === 'webaudio' && !!A.ctx && !!A.bus; };

  // Ramp an AudioParam without clicks.
  A.ramp = function (param, value, tc, at) {
    if (!param || !A.ctx) return;
    var t0 = at || A.ctx.currentTime;
    try {
      param.cancelScheduledValues(t0);
      param.setValueAtTime(param.value, t0);
      param.setTargetAtTime(value, t0, tc || 0.05);
    } catch (e) { param.value = value; }
  };

  // ================================================================ loading (fetch → arrayBuffer → decodeAudioData)
  var bytes = {};       // file → compressed ArrayBuffer, kept for music so it can be (re)decoded on demand
  var decoded = {};     // file → AudioBuffer
  var decoding = {};    // file → Promise<AudioBuffer>
  var lastUse = {};     // file → timestamp (LRU for music)
  var inUse = {};       // file → live voices
  var html = {};        // file → preloaded HTMLAudioElement (html mode)
  var loadPromise = null, dctx = null;
  var MUSIC_BUDGET_SEC = 150;   // decoded music kept in memory (≈50 MB of float PCM), what is playing aside

  function isLong(e) { return e.kind === 'music' || e.kind === 'stem'; }
  function eager(id, e) { return !isLong(e) || id === 'theme-title'; }
  function fileEntries() {
    var seen = {}, out = [];
    Object.keys(MAN).forEach(function (id) {
      var e = MAN[id];
      if (!e || !e.file || seen[e.file]) return;
      seen[e.file] = 1;
      out.push({ id: id, file: e.file, entry: e, eager: eager(id, e) });
    });
    // short sounds first, then the title theme, then the rest of the music
    var rank = function (x) { return !isLong(x.entry) ? 0 : x.id === 'theme-title' ? 1 : x.id === 'theme-map' ? 2 : 3; };
    out.sort(function (a, b) { return rank(a) - rank(b); });
    return out;
  }
  function decodeCtx() {
    if (!dctx) { try { dctx = new OffCtor(1, 1, 44100); } catch (e) { dctx = null; } }
    return dctx;
  }
  // decodeAudioData, promise or (old WebKit) callback form
  function decode(ab) {
    return new Promise(function (resolve, reject) {
      var c = decodeCtx(), done = false;
      if (!c) { reject(new Error('no decoder')); return; }
      function ok(b) { if (!done) { done = true; resolve(b); } }
      function ko(e) { if (!done) { done = true; reject(e || new Error('decode failed')); } }
      try {
        var p = c.decodeAudioData(ab, ok, ko);
        if (p && typeof p.then === 'function') p.then(ok, ko);
      } catch (e) { ko(e); }
    });
  }
  function fetchBytes(file) {
    if (bytes[file]) return Promise.resolve(bytes[file]);
    return W.fetch(file).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status + ' ' + file);
      return r.arrayBuffer();
    }).then(function (ab) { bytes[file] = ab; return ab; });
  }
  function decodeFile(file, keepBytes) {
    if (decoded[file]) return Promise.resolve(decoded[file]);
    if (decoding[file]) return decoding[file];
    var p = fetchBytes(file).then(function (ab) {
      // decodeAudioData detaches its input: hand it a copy when the bytes must stay for a later re-decode
      return decode(keepBytes ? ab.slice(0) : ab);
    }).then(function (b) {
      decoded[file] = b;
      delete decoding[file];
      if (!keepBytes) delete bytes[file];
      trimCache();
      return b;
    }, function (err) { delete decoding[file]; throw err; });
    decoding[file] = p;
    return p;
  }
  function trimCache() {
    var keep = MAN['theme-title'] ? MAN['theme-title'].file : '';
    var files = Object.keys(decoded).filter(function (f) { return longFile[f] && !inUse[f] && f !== keep; });
    var total = 0;
    Object.keys(decoded).forEach(function (f) { if (longFile[f]) total += decoded[f].duration; });
    files.sort(function (a, b) { return (lastUse[a] || 0) - (lastUse[b] || 0); });
    while (total > MUSIC_BUDGET_SEC && files.length) {
      var f = files.shift();
      total -= decoded[f].duration;
      delete decoded[f];
    }
  }
  var longFile = {};
  Object.keys(MAN).forEach(function (id) { if (MAN[id] && isLong(MAN[id])) longFile[MAN[id].file] = true; });

  // need(id) → Promise: resolves when the sound can play now (decoded / element ready)
  A.need = function (id) {
    var e = MAN[id];
    if (!e) return Promise.reject(new Error('no sound ' + id));
    lastUse[e.file] = Date.now();
    if (A.mode === 'html') return html[e.file] ? Promise.resolve(html[e.file]) : Promise.reject(new Error('not loaded'));
    if (A.mode !== 'webaudio') return Promise.reject(new Error('no audio'));
    return decodeFile(e.file, isLong(e));
  };
  A.has = function (id) {
    var e = MAN[id];
    if (!e) return false;
    return A.mode === 'html' ? !!html[e.file] : !!decoded[e.file];
  };

  function loadHtml(file) {
    return new Promise(function (resolve, reject) {
      var el, done = false, tm = 0;
      function fin(ok) {
        if (done) return;
        done = true;
        clearTimeout(tm);
        el.removeEventListener('canplaythrough', yes); el.removeEventListener('loadeddata', yes); el.removeEventListener('error', no);
        if (ok) { html[file] = el; resolve(el); } else reject(new Error('cannot load ' + file));
      }
      function yes() { fin(true); }
      function no() { fin(false); }
      try {
        el = new W.Audio();
        el.preload = 'auto';
        el.addEventListener('canplaythrough', yes);
        el.addEventListener('loadeddata', yes);
        el.addEventListener('error', no);
        el.src = file;
        if (el.load) el.load();
        // some browsers never preload media until played: count it as ready after a moment
        tm = setTimeout(function () { fin(!el.error); }, 5000);
      } catch (e) { reject(e); }
    });
  }

  // load(onProgress) → Promise<{total, ok, failed}>. onProgress({done, total, ok, failed}) after each file.
  // Fetches every file (decoding the short ones and the title theme) in web audio mode; preloads elements in html mode.
  A.loadStats = { total: 0, ok: 0, failed: 0, firstError: '' };
  A.load = function (onProgress) {
    if (loadPromise) return loadPromise;
    var list = fileEntries(), total = list.length, ok = 0, failed = 0, next = 0;
    A.loadStats.total = total;
    function report() { if (onProgress) { try { onProgress({ done: ok + failed, total: total, ok: ok, failed: failed }); } catch (e) { /* ui */ } } }
    loadPromise = new Promise(function (resolve) {
      if (A.mode === 'none' || !total) { failed = total; report(); resolve({ total: total, ok: 0, failed: total }); return; }
      var running = 0, CONC = 4;
      function pump() {
        if (ok + failed >= total) { resolve({ total: total, ok: ok, failed: failed }); return; }
        while (running < CONC && next < total) {
          var it = list[next++];
          running++;
          var p = A.mode === 'html' ? loadHtml(it.file)
            : it.eager ? decodeFile(it.file, isLong(it.entry)) : fetchBytes(it.file);
          p.then(function () { ok++; }, function (err) {
            failed++;
            var msg = (err && err.message ? err.message : String(err));
            if (!A.loadStats.firstError) A.loadStats.firstError = msg;
            if (W.console) console.warn('[AQ.audio] ' + msg);
          }).then(function () { running--; A.loadStats.ok = ok; A.loadStats.failed = failed; report(); pump(); });
        }
      }
      report();
      pump();
    });
    return loadPromise;
  };

  // ================================================================ output graph (web audio)
  function softClipCurve() {
    var n = 2048, c = new Float32Array(n), knee = 0.85, room = 0.14;
    for (var i = 0; i < n; i++) {
      var x = i / (n - 1) * 2 - 1, a = Math.abs(x);
      var y = a < knee ? a : knee + room * Math.tanh((a - knee) / room);
      c[i] = x < 0 ? -y : y;
    }
    return c;
  }
  function gainNode(v, dest) {
    var g = A.ctx.createGain();
    g.gain.value = v;
    if (dest) g.connect(dest);
    return g;
  }
  function build() {
    var ctx = A.ctx;
    // soft clip after the limiter: transparent below 0.85, never reaches 1.0 (no clipping on any device)
    var clip = ctx.createWaveShaper();
    clip.curve = softClipCurve();
    clip.connect(ctx.destination);
    var limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -2; limiter.knee.value = 0; limiter.ratio.value = 20; limiter.attack.value = 0.001; limiter.release.value = 0.08;
    limiter.connect(clip);
    // make-up gain after the glue compressor (+2.5 dB) so the mix reads on phone speakers
    var makeup = gainNode(1.33, limiter);
    var comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16; comp.knee.value = 10; comp.ratio.value = 3.5; comp.attack.value = 0.005; comp.release.value = 0.2;
    comp.connect(makeup);
    var master = gainNode(0.0001, comp);
    var music = gainNode(0, master);
    var ambience = gainNode(0, master);
    var ambLp = ctx.createBiquadFilter();
    ambLp.type = 'lowpass'; ambLp.frequency.value = 20000; ambLp.Q.value = 0.5;
    ambLp.connect(ambience);
    A.bus = {
      master: master, comp: comp, makeup: makeup, limiter: limiter, clip: clip, out: clip,
      music: music,
      musicDuck: gainNode(1, music),   // jingles dip the music here
      sfx: gainNode(0, master),
      ambience: ambience,
      ambLp: ambLp                     // follows "underwater"
    };
  }
  function busNode(name) {
    if (!A.bus) return null;
    if (name && typeof name === 'object') return name;
    return name === 'music' ? A.bus.musicDuck : name === 'amb' ? A.bus.ambLp : A.bus.sfx;
  }

  // ================================================================ voices
  // play(id, o) → voice | null. o: {bus: 'music'|'sfx'|'amb'|AudioNode, loop, gain (× manifest gain), rate, pan,
  // at (context time), offset (s into the file; loops default to loopStart), fade (s fade-in)}.
  // voice: {id, entry, t0, setGain(mult, tc), setRate(r), stop(fade), phase(t), ended}
  A.play = function (id, o) {
    o = o || {};
    if (A.mode === 'webaudio') return playWA(id, o);
    if (A.mode === 'html') return playHtml(id, o);
    return null;
  };
  function loopLen(e, dur) { return (e.loopEnd || dur) - (e.loopStart || 0); }

  function playWA(id, o) {
    var e = MAN[id];
    if (!e || !A.webaudio()) return null;
    var b = decoded[e.file];
    if (!b) return null;
    var c = A.ctx, dest = busNode(o.bus);
    if (!dest) return null;
    var t = Math.max(c.currentTime, o.at || 0), rate = o.rate || 1;
    var src = c.createBufferSource();
    src.buffer = b;
    var ls = e.loopStart || 0;
    if (o.loop) { src.loop = true; src.loopStart = ls; src.loopEnd = e.loopEnd || b.duration; }
    if (rate !== 1) src.playbackRate.value = rate;
    var base = (e.gain || 1), mult = o.gain === undefined ? 1 : o.gain;
    var g = c.createGain(), node = src, pn = null;
    if (o.pan && c.createStereoPanner) {
      pn = c.createStereoPanner();
      pn.pan.value = clamp(o.pan, -1, 1);
      src.connect(pn);
      node = pn;
    }
    node.connect(g);
    g.connect(dest);
    if (o.fade) { g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(base * mult, t + o.fade); }
    else g.gain.value = base * mult;
    var off = o.offset !== undefined ? o.offset : (o.loop ? ls : 0);
    if (o.loop && (off < 0 || off >= (e.loopEnd || b.duration))) off = ls;
    var v = {
      id: id, entry: e, ended: false, t0: t - (off - ls), started: t,
      setGain: function (m, tc) { if (!v.ended) A.ramp(g.gain, Math.max(0.0001, base * m), tc || 0.1); },
      setRate: function (r, tc) { if (!v.ended) A.ramp(src.playbackRate, r, tc || 0.05); },
      stop: function (fade) {
        if (v.ended || v.stopping) return;
        v.stopping = true;
        var t1 = c.currentTime, f = Math.max(0.01, fade || 0.02);
        try {
          g.gain.cancelScheduledValues(t1);
          g.gain.setValueAtTime(g.gain.value, t1);
          g.gain.linearRampToValueAtTime(0.0001, t1 + f);
          src.stop(t1 + f + 0.02);
        } catch (err) { /* already stopped */ }
      },
      // loop position (s from loopStart) at context time tt, for rate-1 loops
      phase: function (tt) { var L = loopLen(e, b.duration), p = (tt - v.t0) % L; return p < 0 ? p + L : p; }
    };
    inUse[e.file] = (inUse[e.file] || 0) + 1;
    src.onended = function () {
      if (v.ended) return;
      v.ended = true;
      inUse[e.file] = Math.max(0, (inUse[e.file] || 1) - 1);
      try { src.disconnect(); if (pn) pn.disconnect(); g.disconnect(); } catch (err) { /* ignore */ }
    };
    try { src.start(t, off); } catch (err) { src.onended(); return null; }
    return v;
  }

  // ---------------------------------------------------------------- html fallback voices (file://)
  var H = { master: 0.8, music: 0.6, sfx: 0.8, amb: 0.5, duckUntil: 0, voices: [], pools: {}, timer: 0, paused: [] };
  var HTML_CAP = 16;
  function htmlBusGain(bus) {
    var b = bus === 'music' ? H.music * (Date.now() < H.duckUntil ? 0.4 : 1) : bus === 'amb' ? H.amb : H.sfx;
    return H.master * b * 1.33;
  }
  function htmlApply(v) {
    try { v.el.volume = clamp(htmlBusGain(v.bus) * v.base * v.mult * v.cur, 0, 1); } catch (e) { /* ignore */ }
  }
  function htmlTick() {
    var live = 0;
    for (var i = H.voices.length - 1; i >= 0; i--) {
      var v = H.voices[i];
      if (v.ended) { H.voices.splice(i, 1); continue; }
      v.cur += (v.target - v.cur) * v.k;
      if (Math.abs(v.target - v.cur) < 0.005) v.cur = v.target;
      if (v.stopping && v.cur <= 0.01) { htmlRelease(v); H.voices.splice(i, 1); continue; }
      htmlApply(v);
      live++;
    }
    if (!live && H.timer) { clearInterval(H.timer); H.timer = 0; }
  }
  function htmlEl(file, max) {
    var pool = H.pools[file] || (H.pools[file] = []);
    for (var i = 0; i < pool.length; i++) if (!pool[i].busy) return pool[i];
    if (pool.length >= max) return null;
    var base = html[file];
    if (!base) return null;
    var el = pool.length === 0 ? base : base.cloneNode(true);
    var slot = { el: el, busy: false };
    pool.push(slot);
    return slot;
  }
  function htmlRelease(v) {
    if (v.released) return;
    v.released = true;
    v.ended = true;
    try { v.el.pause(); } catch (e) { /* ignore */ }
    v.slot.busy = false;
  }
  function playHtml(id, o) {
    var e = MAN[id];
    if (!e || !A.started) return null;
    var busy = 0;
    for (var i = 0; i < H.voices.length; i++) if (!H.voices[i].ended) busy++;
    if (busy >= HTML_CAP && !o.loop) return null;
    var slot = htmlEl(e.file, o.loop ? 2 : 3);
    if (!slot) return null;
    slot.busy = true;
    var el = slot.el, rate = o.rate || 1;
    var v = {
      id: id, entry: e, el: el, slot: slot, bus: typeof o.bus === 'string' ? o.bus : 'music', ended: false,
      base: e.gain || 1, mult: o.gain === undefined ? 1 : o.gain, cur: o.fade ? 0 : 1, target: 1, k: o.fade ? 0.12 : 1,
      t0: Date.now() / 1000,
      setGain: function (m, tc) { v.mult = m; v.k = tc && tc > 0.1 ? 0.25 : 1; v.target = 1; ensureTimer(); },
      setRate: function (r) { try { el.playbackRate = r; } catch (err) { /* ignore */ } },
      stop: function (fade) {
        if (v.ended) return;
        v.stopping = true; v.target = 0; v.k = fade && fade > 0.1 ? 0.15 : 1;
        ensureTimer();
      },
      phase: function () { return 0; }
    };
    try {
      el.loop = !!o.loop;
      try { el.preservesPitch = false; el.mozPreservesPitch = false; el.webkitPreservesPitch = false; } catch (err) { /* optional */ }
      el.playbackRate = rate;
      el.currentTime = o.offset !== undefined ? o.offset : (o.loop ? (e.loopStart || 0) : 0);
      el.onended = function () { if (!el.loop) { htmlRelease(v); } };
      htmlApply(v);
      var p = el.play();
      if (p && p.catch) p.catch(function () { htmlRelease(v); });
    } catch (err) { htmlRelease(v); return null; }
    H.voices.push(v);
    ensureTimer();
    return v;
  }
  function ensureTimer() { if (!H.timer) H.timer = setInterval(htmlTick, 50); }
  A.htmlDuck = function (sec) { H.duckUntil = Date.now() + (sec || 0.8) * 1000; ensureTimer(); H.voices.forEach(htmlApply); };

  // ================================================================ start / unlock (mobile policy)
  // Mobile browsers (iOS/WebKit above all) only let audio start inside touchend / click / keydown. The loading
  // screen's start tap calls start(); if the context still is not running (or the system interrupts it later:
  // phone call, Siri, another app), capture listeners keep retrying unlock() on every activation-type event.
  var UNLOCK_EVENTS = ['pointerup', 'touchend', 'click', 'keydown', 'mousedown'];
  var armed = false;
  function tryUnlock() {
    A.unlock().then(function () { if (A.mode !== 'webaudio' || (A.ctx && A.ctx.state === 'running')) disarmUnlock(); });
  }
  function armUnlock() {
    if (armed || !W.addEventListener) return;
    armed = true;
    for (var i = 0; i < UNLOCK_EVENTS.length; i++) W.addEventListener(UNLOCK_EVENTS[i], tryUnlock, true);
  }
  function disarmUnlock() {
    if (!armed) return;
    armed = false;
    for (var i = 0; i < UNLOCK_EVENTS.length; i++) W.removeEventListener(UNLOCK_EVENTS[i], tryUnlock, true);
  }

  // iOS: playing a (silent) HTML media element inside the gesture moves the page to the "playback" audio session,
  // so the ring/silent switch does not mute Web Audio.
  function silentKick() {
    var e = MAN.silence;
    if (!e || typeof W.Audio !== 'function') return;
    try {
      var el = new W.Audio();
      el.setAttribute('playsinline', '');
      el.setAttribute('x-webkit-airplay', 'deny');
      el.preload = 'auto';
      el.src = e.file;
      var p = el.play();
      if (p && p.catch) p.catch(function () { /* not allowed: Web Audio still works with the switch off */ });
    } catch (err) { /* optional */ }
  }

  // start() — call from inside a real user activation (the loading screen's start tap/click/key).
  A.start = function () {
    if (A.started) return A.unlock();
    A.started = true;
    try { if (typeof navigator !== 'undefined' && navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e0) { /* optional */ }
    silentKick();
    var p = A.unlock();
    armUnlock();
    return p;
  };

  // unlock() → Promise<boolean>. Creates / resumes the context; must run inside a user gesture the first time.
  A.unlock = function () {
    if (!A.started) return Promise.resolve(false);
    if (A.mode === 'html') {
      if (!A.ready) { A.ready = true; A.applyVolumes(true); if (A.music && A.music.start) A.music.start(); }
      return Promise.resolve(true);
    }
    if (A.mode !== 'webaudio') return Promise.resolve(false);
    try {
      if (!A.ctx) {
        A.ctx = new Ctor({ latencyHint: 'interactive' });
        A.ctx.onstatechange = function () {
          if (A.ctx.state === 'running') watchClock();
          if (A.ctx.state !== 'running' && A.ctx.state !== 'closed' && !(typeof document !== 'undefined' && document.hidden)) armUnlock();
        };
        build();
        A.ready = true;
        A.applyVolumes(true);
        setTimeout(watchClock, 50);
        if (A.music && A.music.start) A.music.start();
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
    var d = duckOn ? 0.35 : 1;
    var m = Math.max(0.0001, vol('volMaster')), mu = vol('volMusic') * 1.1 * d, sf = vol('volSfx'), am = vol('volAmbience') * 0.9 * (duckOn ? 0.5 : 1);
    H.master = m; H.music = mu; H.sfx = sf; H.amb = am;
    if (A.mode === 'html') { H.voices.forEach(htmlApply); return; }
    if (!A.webaudio()) return;
    A.ramp(A.bus.master.gain, m, fadeIn ? 0.6 : 0.05);
    A.ramp(A.bus.music.gain, mu, 0.15);
    A.ramp(A.bus.sfx.gain, sf, 0.05);
    A.ramp(A.bus.ambience.gain, am, 0.15);
  };
  A.duck = function (on) { duckOn = !!on; A.applyVolumes(); };

  A.suspend = function () {
    if (A.mode === 'html') {
      H.paused = H.voices.filter(function (v) { return !v.ended && v.el && !v.el.paused; });
      H.paused.forEach(function (v) { try { v.el.pause(); } catch (e) { /* ignore */ } });
      return;
    }
    if (!A.ctx || A.ctx.state !== 'running') return;
    A.ramp(A.bus.master.gain, 0.0001, 0.02);
    var c = A.ctx;
    setTimeout(function () { if (typeof document === 'undefined' || document.hidden) c.suspend().catch(function () {}); }, 90);
  };
  A.resume = function () {
    if (A.mode === 'html') {
      H.paused.forEach(function (v) { if (!v.ended) { var p = v.el.play(); if (p && p.catch) p.catch(function () {}); } });
      H.paused = [];
      return;
    }
    if (!A.ctx) return;
    A.ctx.resume().then(function () { A.applyVolumes(true); }, function () { armUnlock(); });
  };

  // ================================================================ public API (§15.5)
  A.init = function () {
    A.mode = pickMode();
    var E = AQ.events;
    E.on('app:gesture', function () { if (A.started) A.unlock(); });
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
  // reel(on, speed 0..1): the reel loop plays faster with speed.
  A.reel = function (on, speed) {
    A.state.reel = !!on;
    A.state.reelSpeed = Math.max(0, Math.min(1, speed === undefined ? 0.6 : +speed || 0));
    if (A.music && A.music.setReel) A.music.setReel(A.state.reel, A.state.reelSpeed);
  };
  A.setReel = A.reel;

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
    E.on('frenzy:start', function () { A.sfx('splashBig', { vol: 0.6 }); if (A.music && A.music.frenzy) A.music.frenzy(true); });
    E.on('frenzy:end', function () { if (A.music && A.music.frenzy) A.music.frenzy(false); });
    E.on('shop:denied', function () { if (!(AQ.ui && AQ.ui.isOpen && AQ.ui.isOpen('shop'))) A.sfx('error'); });
  }
})(window.AQ);
