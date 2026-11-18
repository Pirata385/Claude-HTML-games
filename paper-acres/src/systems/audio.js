/* Audio: generative music (seeded, per mood) and synthesised sound effects. WebAudio only, no files. */
(function (root) {
  'use strict';
  const PA = root.PA = root.PA || {};
  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
  const SCALES = { major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10], dorian: [0, 2, 3, 5, 7, 9, 10], mixo: [0, 2, 4, 5, 7, 9, 10], penta: [0, 2, 4, 7, 9], minpenta: [0, 3, 5, 7, 10] };
  // theme: root midi, scale, bpm, progression (scale degrees), lead instrument, density, bass, pad, perc
  const THEMES = {
    title: { root: 60, scale: 'major', bpm: 76, prog: [0, 5, 3, 4], lead: 'kalimba', dens: 0.45, bass: true, pad: true },
    spring: { root: 62, scale: 'major', bpm: 92, prog: [0, 3, 4, 0, 5, 3, 1, 4], lead: 'kalimba', dens: 0.6, bass: true, pad: false },
    summer: { root: 64, scale: 'mixo', bpm: 100, prog: [0, 6, 3, 0], lead: 'pluck', dens: 0.65, bass: true, pad: false },
    fall: { root: 57, scale: 'dorian', bpm: 84, prog: [0, 3, 6, 4], lead: 'keys', dens: 0.5, bass: true, pad: true },
    winter: { root: 65, scale: 'major', bpm: 70, prog: [0, 4, 5, 3], lead: 'kalimba', dens: 0.32, bass: false, pad: true },
    night: { root: 57, scale: 'minpenta', bpm: 60, prog: [0, 3, 0, 4], lead: 'keys', dens: 0.25, bass: false, pad: true },
    town: { root: 65, scale: 'major', bpm: 108, prog: [0, 4, 5, 3, 0, 4, 3, 4], lead: 'pluck', dens: 0.7, bass: true, pad: false },
    indoor: { root: 60, scale: 'penta', bpm: 80, prog: [0, 2, 3, 2], lead: 'keys', dens: 0.35, bass: true, pad: false },
    mine: { root: 50, scale: 'minor', bpm: 78, prog: [0, 0, 5, 4], lead: 'pluck', dens: 0.3, bass: true, pad: true, perc: 'low' },
    boss: { root: 52, scale: 'minor', bpm: 138, prog: [0, 5, 3, 4], lead: 'pluck', dens: 0.8, bass: true, pad: false, perc: 'drive' },
    festival: { root: 67, scale: 'major', bpm: 116, prog: [0, 3, 4, 0], lead: 'kalimba', dens: 0.75, bass: true, pad: false, perc: 'light' },
  };

  const A = PA.Audio = {
    ctx: null, theme: null, bar: 0, nextT: 0, step: 0,
    init() {
      if (A.ctx) { if (A.ctx.state === 'suspended') A.ctx.resume(); return; }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      const c = A.ctx = new AC();
      A.master = c.createGain(); A.master.connect(c.destination);
      A.comp = c.createDynamicsCompressor(); A.comp.connect(A.master);
      A.music = c.createGain(); A.music.connect(A.comp);
      A.musicFade = c.createGain(); A.musicFade.connect(A.music);
      A.sfxBus = c.createGain(); A.sfxBus.connect(A.comp);
      // a soft room reverb from a generated impulse
      A.verb = c.createConvolver(); const len = c.sampleRate * 1.6, buf = c.createBuffer(2, len, c.sampleRate);
      for (let ch = 0; ch < 2; ch++) { const d = buf.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3); }
      A.verb.buffer = buf; A.verbGain = c.createGain(); A.verbGain.gain.value = 0.22; A.verb.connect(A.verbGain); A.verbGain.connect(A.comp);
      A.noiseBuf = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
      const nd = A.noiseBuf.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
      A.ks = new Map();
      A.applyVolumes();
      A.nextT = c.currentTime + 0.1;
      setInterval(A.schedule, 90);
      A.hookEvents();
    },
    applyVolumes() {
      if (!A.ctx) return;
      const s = PA.settings, t = A.ctx.currentTime;
      A.master.gain.setTargetAtTime(s.master, t, 0.05);
      A.music.gain.setTargetAtTime(s.music * 0.55, t, 0.05);
      A.sfxBus.gain.setTargetAtTime(s.sfx * 0.8, t, 0.05);
    },
    /* ---------------- instruments ---------------- */
    env(g, t, a, peak, d) { g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); },
    ksBuffer(midi) {
      let b = A.ks.get(midi); if (b) return b;
      const c = A.ctx, sr = c.sampleRate, n = Math.floor(sr * 1.6), out = c.createBuffer(1, n, sr), d = out.getChannelData(0);
      const P = Math.max(2, Math.round(sr / mtof(midi))), line = new Float32Array(P);
      for (let i = 0; i < P; i++) line[i] = Math.random() * 2 - 1;
      let idx = 0;
      for (let i = 0; i < n; i++) { const nx = (idx + 1) % P; const v = (line[idx] + line[nx]) * 0.4985; d[i] = line[idx]; line[idx] = v; idx = nx; }
      A.ks.set(midi, out); return out;
    },
    voice(type, midi, t, dur, vel, dest) {
      const c = A.ctx, out = dest || A.musicFade, g = c.createGain();
      g.connect(out); g.connect(A.verb);
      const f = mtof(midi);
      if (type === 'pluck') {
        const s = c.createBufferSource(); s.buffer = A.ksBuffer(midi);
        const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3200;
        s.connect(lp); lp.connect(g); g.gain.value = vel * 0.55; s.start(t); s.stop(t + 1.6);
      } else if (type === 'kalimba') {
        for (const [mul, a] of [[1, 1], [4.07, 0.25], [6.9, 0.08]]) { const o = c.createOscillator(); o.type = 'sine'; o.frequency.value = f * mul; const og = c.createGain(); A.env(og, t, 0.004, vel * 0.32 * a, mul > 1 ? 0.25 : 1.2); o.connect(og); og.connect(g); o.start(t); o.stop(t + 1.4); }
      } else if (type === 'keys') {
        const o = c.createOscillator(); o.type = 'triangle'; o.frequency.value = f;
        const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1600;
        o.connect(lp); lp.connect(g); A.env(g, t, 0.01, vel * 0.22, dur + 0.6); o.start(t); o.stop(t + dur + 0.8);
      } else if (type === 'bass') {
        const o = c.createOscillator(); o.type = 'triangle'; o.frequency.value = f;
        o.connect(g); A.env(g, t, 0.01, vel * 0.3, dur); o.start(t); o.stop(t + dur + 0.1);
      } else if (type === 'pad') {
        for (const det of [-7, 7]) { const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = det; const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 700; const og = c.createGain(); og.gain.setValueAtTime(0.0001, t); og.gain.linearRampToValueAtTime(vel * 0.035, t + dur * 0.4); og.gain.linearRampToValueAtTime(0.0001, t + dur); o.connect(lp); lp.connect(og); og.connect(g); o.start(t); o.stop(t + dur + 0.05); }
      }
    },
    noise(t, dur, freq, q, vel, type, dest) {
      const c = A.ctx, s = c.createBufferSource(); s.buffer = A.noiseBuf;
      const f = c.createBiquadFilter(); f.type = type || 'bandpass'; f.frequency.value = freq; f.Q.value = q || 1;
      const g = c.createGain(); s.connect(f); f.connect(g); g.connect(dest || A.sfxBus);
      A.env(g, t, 0.003, vel, dur); s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.05);
      return { s, f, g };
    },
    tone(t, f0, f1, dur, vel, type, dest) {
      const c = A.ctx, o = c.createOscillator(); o.type = type || 'sine';
      o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
      const g = c.createGain(); o.connect(g); g.connect(dest || A.sfxBus); A.env(g, t, 0.004, vel, dur); o.start(t); o.stop(t + dur + 0.05);
    },
    /* ---------------- music ---------------- */
    setTheme(name) {
      if (!A.ctx || A.theme === name) return;
      const t = A.ctx.currentTime;
      A.musicFade.gain.setTargetAtTime(0.0001, t, 0.4);
      setTimeout(() => { A.theme = name; A.bar = 0; A.step = 0; A.nextT = A.ctx.currentTime + 0.05; A.musicFade.gain.setTargetAtTime(1, A.ctx.currentTime, 0.6); }, 900);
      if (!A.theme) { A.theme = name; A.musicFade.gain.setTargetAtTime(1, t, 0.5); }
    },
    schedule() {
      const c = A.ctx; if (!c || !A.theme || PA.settings.music <= 0.001) return;
      const th = THEMES[A.theme], spb = 60 / th.bpm / 2; // eighth notes
      const scale = SCALES[th.scale];
      const deg = (d, oct) => th.root + 12 * (oct || 0) + scale[((d % scale.length) + scale.length) % scale.length] + 12 * Math.floor(d / scale.length);
      while (A.nextT < c.currentTime + 0.35) {
        const t = A.nextT, st = A.step % 8, chordDeg = th.prog[A.bar % th.prog.length];
        const r = PA.RNG.mulberry32(PA.RNG.hash3(A.bar, st, A.theme.length, 4242));
        const quiet = PA.scene && PA.scene.state && (PA.scene.state.weather === 'rain' || PA.scene.state.weather === 'storm') ? 0.6 : 1;
        if (st === 0 && th.pad) for (const k of [0, 2, 4]) A.voice('pad', deg(chordDeg + k, -1), t, spb * 8, 1);
        if (th.bass && (st === 0 || (st === 4 && r() < 0.7) || (th.perc === 'drive' && st % 2 === 0))) A.voice('bass', deg(chordDeg, -2), t, spb * (st === 0 ? 3 : 2), 0.9);
        if (r() < th.dens * quiet && !(st === 7 && r() < 0.5)) {
          const lastDeg = A.lastDeg != null ? A.lastDeg : chordDeg + 7;
          let d = r() < 0.55 ? chordDeg + [0, 2, 4][Math.floor(r() * 3)] + 7 : lastDeg + Math.floor(r() * 5) - 2;
          d = PA.U.clamp(d, chordDeg + 3, chordDeg + 12);
          A.lastDeg = d;
          A.voice(th.lead, deg(d), t, spb * (r() < 0.3 ? 2 : 1), 0.7 + r() * 0.3);
        }
        if (th.perc === 'low' && st === 0) A.noise(t, 0.4, 90, 0.7, 0.35, 'lowpass', A.musicFade);
        if (th.perc === 'drive') { if (st % 4 === 0) A.tone(t, 120, 45, 0.25, 0.6, 'sine', A.musicFade); if (st % 2 === 1) A.noise(t, 0.05, 7000, 1, 0.12, 'highpass', A.musicFade); }
        if (th.perc === 'light' && st % 2 === 1) A.noise(t, 0.04, 8000, 1, 0.07, 'highpass', A.musicFade);
        A.nextT += spb; A.step++;
        if (A.step % 8 === 0) A.bar++;
      }
      A.ambient();
    },
    /** Pick the mood from where you are and when. */
    pickTheme(game) {
      if (!A.ctx) return;
      if (!game || game.mode === 'title' || !game.state) return A.setTheme('title');
      const s = game.state, m = game.map;
      if (m.kind === 'mine') return A.setTheme(PA.Enemies && PA.Enemies.list.some((e) => e.boss) ? 'boss' : 'mine');
      if (m.kind === 'interior') return A.setTheme('indoor');
      const f = PA.Festivals.today(s);
      if (f && s.time >= f.from - 30 && s.time <= f.to) return A.setTheme('festival');
      if (s.time >= 20 * 60) return A.setTheme('night');
      const zone = (m.zones.find((z) => game.player.x / PA.C.CELL_W >= z.x0 && game.player.x / PA.C.CELL_W < z.x1) || {}).name;
      if (zone === 'town') return A.setTheme('town');
      return A.setTheme(PA.SEASONS[s.season]);
    },
    ambient() {
      const g = PA.scene, c = A.ctx;
      const rain = g && g.state && g.map && g.map.kind === 'overworld' && (g.state.weather === 'rain' || g.state.weather === 'storm');
      if (rain && !A.rainNode) {
        const s = c.createBufferSource(); s.buffer = A.noiseBuf; s.loop = true;
        const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 2400; f.Q.value = 0.4;
        const gg = c.createGain(); gg.gain.value = 0.0001; gg.gain.setTargetAtTime(g.state.weather === 'storm' ? 0.16 : 0.09, c.currentTime, 1.2);
        s.connect(f); f.connect(gg); gg.connect(A.sfxBus); s.start(); A.rainNode = { s, gg };
      } else if (!rain && A.rainNode) { const r = A.rainNode; r.gg.gain.setTargetAtTime(0.0001, c.currentTime, 0.8); setTimeout(() => r.s.stop(), 3000); A.rainNode = null; }
    },
    /* ---------------- effects ---------------- */
    sfx(name, o) {
      const c = A.ctx; if (!c || !A.sfxBus || PA.settings.sfx <= 0.001) return;
      const t = c.currentTime, r = Math.random;
      switch (name) {
        case 'step': A.noise(t, 0.05, 1800 + r() * 900, 2, 0.05); break;
        case 'jump': A.tone(t, 260, 520, 0.12, 0.12, 'triangle'); A.noise(t, 0.06, 2500, 1, 0.05); break;
        case 'land': A.noise(t, 0.09, 600, 0.8, 0.12 * Math.min(1, (o && o.speed || 6) / 8), 'lowpass'); break;
        case 'swing': A.noise(t, 0.12, o && o.tool === 'weapon' ? 1400 : 900, 0.8, 0.09); break;
        case 'tool': A.tone(t, o && o.did ? 180 : 140, 70, 0.1, 0.18); A.noise(t, 0.07, 700, 1, 0.08); break;
        case 'plant': A.tone(t, 520, 700, 0.08, 0.08, 'triangle'); break;
        case 'harvest': case 'pickup': A.tone(t, 660, 990, 0.09, 0.09, 'triangle'); A.tone(t + 0.07, 990, 1320, 0.08, 0.07, 'triangle'); break;
        case 'coins': for (let i = 0; i < 3; i++) A.tone(t + i * 0.05, 1800 + i * 260, 1600 + i * 260, 0.07, 0.05, 'square'); break;
        case 'page': A.noise(t, 0.22, 3200, 0.6, 0.08, 'highpass'); A.noise(t + 0.08, 0.15, 1800, 0.6, 0.05); break;
        case 'pencil': if (o && o.on) A.noise(t, 0.07, 3600 + r() * 1200, 3, Math.min(0.09, 0.02 + (o.speed || 2) * 0.008)); break;
        case 'erase': A.noise(t, 0.25, 900, 0.5, 0.1); break;
        case 'drawn': for (const [i, m] of [[0, 72], [1, 76], [2, 79], [3, 84]]) A.voice('kalimba', m, t + i * 0.06, 0.2, 0.9, A.sfxBus); break;
        case 'boing': A.tone(t, 180, 720, 0.3, 0.2, 'triangle'); break;
        case 'settle': A.tone(t, 120, 60, 0.12, 0.15); break;
        case 'explode': A.noise(t, 0.8, 200, 0.6, 0.5, 'lowpass'); A.tone(t, 90, 30, 0.6, 0.4); break;
        case 'hit': A.tone(t, 220, 90, 0.09, 0.22, 'square'); A.noise(t, 0.08, 1200, 1, 0.14); break;
        case 'hurt': A.tone(t, 300, 120, 0.25, 0.22, 'sawtooth'); break;
        case 'kill': A.noise(t, 0.3, 500, 0.8, 0.22, 'lowpass'); A.tone(t, 400, 80, 0.3, 0.12); break;
        case 'block': A.tone(t, 800, 600, 0.08, 0.15, 'square'); break;
        case 'cast': A.noise(t, 0.3, 1200, 0.5, 0.08); break;
        case 'bite': A.tone(t, 900, 1300, 0.08, 0.18, 'square'); A.tone(t + 0.1, 900, 1300, 0.08, 0.18, 'square'); break;
        case 'catch': A.noise(t, 0.35, 900, 0.6, 0.16); A.tone(t + 0.1, 520, 1040, 0.2, 0.12, 'triangle'); break;
        case 'flap': for (let i = 0; i < 3; i++) A.noise(t + i * 0.06, 0.04, 1500, 1.5, 0.05); break;
        case 'talk': for (let i = 0; i < 4; i++) A.tone(t + i * 0.07, 300 + r() * 220, 280 + r() * 200, 0.05, 0.05, 'square'); break;
        case 'gift': A.voice('kalimba', o && o.taste === 'love' ? 84 : o && (o.taste === 'hate' || o.taste === 'dislike') ? 60 : 76, t, 0.3, 1, A.sfxBus); break;
        case 'door': A.sfx('page'); break;
        case 'slice': A.noise(t, 0.16, 2000, 0.7, 0.05); break;
        case 'bump': A.tone(t, 110, 70, 0.1, 0.12); break;
        case 'break': A.noise(t, 0.2, 1600, 1.2, 0.18); A.tone(t, 300, 80, 0.15, 0.12, 'square'); break;
        case 'chip': A.noise(t, 0.05, 2600, 2, 0.1); break;
        case 'craft': case 'machine': case 'bundle': A.voice('pluck', 67, t, 0.2, 1, A.sfxBus); A.voice('pluck', 74, t + 0.08, 0.2, 1, A.sfxBus); break;
        case 'eat': for (let i = 0; i < 3; i++) A.noise(t + i * 0.09, 0.05, 1100, 1.5, 0.08); break;
        case 'pet': A.tone(t, 600, 700, 0.15, 0.06, 'sine'); break;
        case 'full': A.tone(t, 180, 160, 0.25, 0.12, 'square'); break;
        default:
      }
    },
    hookEvents() {
      const on = (ev, name, f) => PA.Bus.on(ev, (o) => A.sfx(name, f ? f(o) : o));
      on('jump', 'jump'); on('land', 'land'); on('swing', 'swing'); on('tool-hit', 'tool'); on('plant', 'plant'); on('harvest', 'harvest'); on('pickup', 'pickup');
      on('coins', 'coins'); on('ship', 'coins'); on('door', 'door'); on('pencil', 'pencil'); on('erase', 'erase'); on('drawn', 'drawn'); on('boing', 'boing'); on('settle', 'settle');
      on('explode', 'explode'); on('hit', 'hit'); on('hurt', 'hurt'); on('kill', 'kill'); on('block', 'block'); on('cast', 'cast'); on('bite', 'bite'); on('catch', 'catch');
      on('flap', 'flap'); on('talk', 'talk'); on('gift', 'gift'); on('slice-step', 'slice'); on('slice-blocked', 'bump'); on('break', 'break'); on('chip', 'chip');
      on('craft', 'craft'); on('machine', 'machine'); on('bundle', 'bundle'); on('eat', 'eat'); on('pet', 'pet'); on('inv-full', 'full'); on('page', 'drawn');
      document.addEventListener('click', (e) => { if (e.target.closest && e.target.closest('button')) A.sfx('page'); }, true);
    },
  };
  // the first gesture unlocks audio (browser policy)
  const unlock = () => { try { A.init(); } catch (e) { /* no audio */ } };
  window.addEventListener('pointerdown', unlock, { passive: true });
  window.addEventListener('keydown', unlock);
})(typeof window !== 'undefined' ? window : globalThis);
