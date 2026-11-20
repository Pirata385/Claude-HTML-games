// music.js — the game's recorded music (the mp3s in music/). Each place asks for a mood with
// RB.audio.setTune(mood). The open-air moods (day, night, the open sea by day and by night) play
// their tracks one after another, or, if the player prefers ("now and then" in Settings), with long
// stretches of quiet in between, the way music drifts in and out on a long walk. Places with their
// own music (the arenas' lobby, the lab, the night shops), the menu and the fights play without a
// break. Volume follows the music setting.
//
// The music is game sound, not a music player. It plays through the Web Audio API, as the sound
// effects do, so phones mix it with whatever else is playing: it does not take over the audio (an
// <audio> element counts as media playback there, so opening the game used to stop the music app
// the player was listening to, and could show media controls). Only one track is decoded at a time
// (two while one fades into the next), in a context of its own at 32 kHz, to keep memory down.
// Opened straight from disk (file://), where the files cannot be fetched, it falls back to <audio>.
(function () {
  'use strict';
  const RB = globalThis.RB;
  const audio = RB.audio;

  const TRACKS = {
    menu: ['main_menu'], day: ['day_1', 'day_2'], night: ['night_1', 'night_2'], sea: ['ocean_1', 'ocean_2'], seanight: ['ocean_night_1'],
    arena: ['arena_menu'], fight: ['fight_1', 'fight_2', 'fight_3'], lab: ['laboratory'], nightshop: ['night_shop'],
  };
  // moods that may rest between tracks; the rest always play
  const AMBIENT = { day: true, night: true, sea: true, seanight: true };
  // older names some places still ask for
  const ALIAS = { title: 'menu', farm: 'day', map: 'day', town: 'day', roost: 'day', carnival: 'day', boss: 'fight', cellar: 'nightshop' };
  const GAP = [45, 150]; // seconds of quiet between ambient tracks, "now and then"
  const FADE_IN = 1.5, FADE_OUT = 0.9;

  const m = { mood: null, cur: null, last: {}, waitUntil: 0, fading: [], blocked: false, hidden: false };
  const now = () => performance.now() / 1000;
  const level = () => Math.max(0, Math.min(1, audio.music)) * 0.6;
  const sometimes = () => !!(RB.game && RB.game.settings && RB.game.settings.musicMode === 'sometimes');
  const clamp01 = (v) => Math.max(0, Math.min(1, v));

  // Safari: game sound that mixes with other apps' audio (and stays quiet on silent)
  try { if (navigator.audioSession) navigator.audioSession.type = 'ambient'; } catch (e) { /* not there */ }

  // ---- Web Audio: decoded tracks played from buffers
  const AC = window.AudioContext || window.webkitAudioContext;
  let useWA = !!(AC && window.fetch && location.protocol !== 'file:');
  let ctx = null;
  const cache = new Map(); // track name -> Promise<AudioBuffer>
  function context() {
    if (!ctx) {
      try { ctx = new AC({ sampleRate: 32000, latencyHint: 'playback' }); } catch (e) { ctx = new AC(); }
      if (m.hidden && ctx.suspend) ctx.suspend();
    }
    return ctx;
  }
  function load(name) {
    if (!cache.has(name)) {
      cache.set(name, fetch('music/' + name + '.mp3')
        .then((r) => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.arrayBuffer(); })
        .then((ab) => new Promise((ok, no) => { const p = context().decodeAudioData(ab, ok, no); if (p && p.then) p.then(ok, no); })));
    }
    return cache.get(name);
  }
  // keep only what is playing or fading in memory
  function forget() {
    const keep = new Set([m.cur && m.cur.name].concat(m.fading.map((f) => f.name)));
    for (const k of [...cache.keys()]) if (!keep.has(k)) cache.delete(k);
  }
  function waTrack(name, loop, onEnd) {
    const c = context(), gain = c.createGain();
    gain.gain.value = 0; gain.connect(c.destination);
    const t = { buf: null, src: null, at: 0, t0: 0, stopped: false };
    const begin = (offset) => {
      if (!t.buf || t.stopped) return;
      if (t.src) { t.src.onended = null; try { t.src.stop(); } catch (e) { /* already stopped */ } }
      const s = c.createBufferSource();
      s.buffer = t.buf; s.loop = loop; s.connect(gain);
      s.onended = () => { if (t.src === s && !t.stopped) onEnd(); };
      s.start(0, offset || 0);
      t.src = s; t.at = offset || 0; t.t0 = c.currentTime;
    };
    load(name).then((buf) => { if (t.stopped) return; t.buf = buf; begin(0); }, () => {
      // could not fetch or decode it: play the music the old way from now on
      if (t.stopped) return;
      useWA = false; cache.clear();
      if (m.cur && m.cur.track === api) { const mood = m.cur.mood; m.cur = null; start(mood); }
    });
    const api = {
      set: (v) => { gain.gain.value = clamp01(v); },
      time: () => (t.buf ? (t.at + c.currentTime - t.t0) % t.buf.duration : 0),
      playing: () => !!t.src && c.state === 'running',
      vol: () => gain.gain.value,
      toEnd: () => { if (t.buf) begin(Math.max(0, t.buf.duration - 0.4)); },
      stop: () => { t.stopped = true; if (t.src) { t.src.onended = null; try { t.src.stop(); } catch (e) { /* already stopped */ } } t.src = null; t.buf = null; try { gain.disconnect(); } catch (e) { /* gone */ } },
    };
    return api;
  }
  // the music's context waits for a tap before it may sound, and goes quiet while the game is hidden
  function waRun() {
    if (!ctx) return;
    if (m.hidden) { if (ctx.state === 'running') ctx.suspend(); return; }
    if (ctx.state !== 'running') { const p = ctx.resume(); if (p && p.catch) p.catch(() => {}); }
  }

  // ---- <audio>: only when the files cannot be fetched (opened from disk)
  function elTrack(name, loop, onEnd) {
    const el = new Audio('music/' + name + '.mp3');
    el.preload = 'auto'; el.loop = loop; el.volume = 0;
    el.addEventListener('ended', onEnd);
    const play = () => { if (m.hidden || level() <= 0) return; const p = el.play(); if (p && p.catch) p.catch(() => { m.blocked = true; }); };
    play();
    return {
      el, play,
      set: (v) => {
        el.volume = clamp01(v);
        if (level() <= 0 && !el.paused) el.pause();
        else if (level() > 0 && el.paused && !m.hidden && !m.blocked && !el.ended) play();
      },
      time: () => el.currentTime,
      playing: () => !el.paused,
      vol: () => el.volume,
      toEnd: () => { if (el.duration) el.currentTime = Math.max(0, el.duration - 0.4); },
      stop: () => { el.pause(); el.src = ''; },
    };
  }

  // a track not just heard, if the mood has more than one
  function pick(mood) {
    const list = TRACKS[mood];
    if (list.length === 1) return list[0];
    const options = list.filter((t) => t !== m.last[mood]);
    return options[Math.floor(Math.random() * options.length)];
  }
  function start(mood) {
    const name = pick(mood);
    m.last[mood] = name;
    const loop = !AMBIENT[mood] && TRACKS[mood].length === 1; // one track of its own: round and round
    const cur = { mood, name, t0: now(), gain: 0 };
    cur.track = (useWA ? waTrack : elTrack)(name, loop, () => ended(cur));
    m.cur = cur; m.waitUntil = 0;
    if (useWA) { forget(); waRun(); }
  }
  function ended(cur) {
    if (m.cur !== cur) return;
    m.cur = null;
    cur.track.stop();
    if (AMBIENT[cur.mood] && sometimes()) m.waitUntil = now() + GAP[0] + Math.random() * (GAP[1] - GAP[0]); // a while of quiet
    else start(cur.mood);
  }
  function fadeOut(cur) { if (cur) { cur.out = now(); cur.from = cur.gain; m.fading.push(cur); } }

  // A place asks for its music. The same mood carries on where it is; a new one fades in.
  audio.setTune = function (name) {
    const mood = TRACKS[name] ? name : ALIAS[name] || null;
    if (!mood || mood === m.mood) return;
    m.mood = mood;
    fadeOut(m.cur); m.cur = null;
    start(mood);
  };
  audio.musicNow = () => ({ mood: m.mood, track: m.cur ? m.cur.name : null, at: m.cur ? +m.cur.track.time().toFixed(1) : 0, playing: !!(m.cur && m.cur.track.playing()),
    volume: m.cur ? +m.cur.track.vol().toFixed(2) : 0, waiting: m.waitUntil ? Math.round(Math.max(0, m.waitUntil - now())) : 0, blocked: m.blocked || !!(useWA && ctx && ctx.state !== 'running' && !m.hidden),
    engine: useWA ? 'webaudio' : 'element' });
  // (for checks) jump to the last moment of the current track
  audio.musicToEnd = () => { if (m.cur) m.cur.track.toEnd(); };
  // the next ambient track, now (used when a quiet stretch should end early)
  audio.musicSkipQuiet = () => { if (m.mood && !m.cur) start(m.mood); };

  // fades, quiet stretches and the volume setting
  setInterval(() => {
    const t = now(), lv = level();
    if (m.cur) {
      m.cur.gain = Math.min(1, (t - m.cur.t0) / FADE_IN);
      m.cur.track.set(lv * m.cur.gain);
    } else if (m.mood && m.waitUntil && t >= m.waitUntil) start(m.mood);
    for (const f of m.fading.slice()) {
      const g = f.from * (1 - (t - f.out) / FADE_OUT);
      if (g <= 0) { f.track.stop(); m.fading.splice(m.fading.indexOf(f), 1); if (useWA) forget(); } else f.track.set(lv * g);
    }
  }, 100);

  // browsers only let music start after the player has touched something
  const retry = () => {
    if (useWA) { waRun(); return; }
    if (!m.blocked) return; m.blocked = false; if (m.cur && m.cur.track.play) m.cur.track.play();
  };
  for (const ev of ['pointerdown', 'keydown', 'touchstart']) window.addEventListener(ev, retry, { passive: true });
  // quiet while the game is hidden
  document.addEventListener('visibilitychange', () => {
    m.hidden = document.hidden;
    if (useWA) { waRun(); return; }
    if (!m.cur) return;
    if (m.hidden) m.cur.track.el.pause(); else m.cur.track.play();
  });
})();
