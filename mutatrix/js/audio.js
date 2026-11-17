/* Mutatrix: trilha generativa de bossa-lounge de laboratório e efeitos sonoros, tudo sintetizado em WebAudio. */
(function (root) {
  'use strict';
  const MX = root.MX || (root.MX = {});

  let ctx = null, master = null, musicBus = null, sfxBus = null, noiseBuf = null, comp = null;
  const vol = { master: 0.8, music: 0.5, sfx: 0.8 };
  const mood = { intensity: 0, wobble: 0, mode: 'lab' };
  let running = false, timer = null;
  let nextTime = 0, step = 0, bpm = 92;
  let curChord = null, prog = null, progBar = 0;
  const motif = [];

  const KEY = 62; // Ré
  const QUAL = { maj7: [0, 4, 7, 11], maj9: [0, 4, 7, 11, 14], m7: [0, 3, 7, 10], m9: [0, 3, 7, 10, 14], 7: [0, 4, 7, 10], 13: [0, 4, 10, 14, 21], 69: [0, 4, 7, 9, 14], m6: [0, 3, 7, 9] };
  const PROGS = [
    [[0, 'maj9'], [9, 'm7'], [2, 'm9'], [7, '13']],
    [[0, 'maj7'], [5, 'maj9'], [4, 'm7'], [9, '7']],
    [[2, 'm9'], [7, '13'], [0, 'maj9'], [0, '69']],
    [[5, 'maj7'], [5, 'm6'], [0, 'maj9'], [9, '7']],
  ];
  const MINOR = [[-3, 'm9'], [2, 'm7'], [5, '7'], [-4, 'maj7']];

  function mtof(m) { return 440 * Math.pow(2, (m - 69) / 12); }
  function voicing(rootOff, q) {
    const base = KEY + rootOff;
    return QUAL[q].map((iv) => { let n = base + iv; while (n > 74) n -= 12; while (n < 55) n += 12; return n; }).sort((a, b) => a - b);
  }

  function ensure() {
    if (ctx) return true;
    const AC = root.AudioContext || root.webkitAudioContext;
    if (!AC) return false;
    try { ctx = new AC(); } catch (e) { return false; }
    comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18; comp.ratio.value = 3;
    master = ctx.createGain(); musicBus = ctx.createGain(); sfxBus = ctx.createGain();
    musicBus.connect(master); sfxBus.connect(master); master.connect(comp); comp.connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    applyVolumes();
    return true;
  }
  function unlock() {
    if (!ensure()) return;
    if (ctx.state === 'suspended') ctx.resume();
  }
  function applyVolumes() {
    if (!ctx) return;
    const t = ctx.currentTime;
    master.gain.setTargetAtTime(vol.master, t, 0.05);
    musicBus.gain.setTargetAtTime(vol.music * 0.55, t, 0.05);
    sfxBus.gain.setTargetAtTime(vol.sfx * 0.9, t, 0.05);
  }
  function setVolumes(m, mu, s) { vol.master = m; vol.music = mu; vol.sfx = s; applyVolumes(); }
  function suspend() { if (ctx && ctx.state === 'running') ctx.suspend(); }
  function resume() { if (ctx && ctx.state === 'suspended') ctx.resume(); }

  // ---------------------------------------------------------------- vozes
  function env(g, t, a, peak, decay, sus, rel, dur) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + a);
    g.gain.setTargetAtTime(peak * sus, t + a, decay);
    g.gain.setTargetAtTime(0.0001, t + dur, rel);
  }
  function detune() { return mood.wobble > 0 ? (Math.random() - 0.5) * mood.wobble * 50 : 0; }

  function ep(t, m, dur, vel, bus) {
    const f = mtof(m);
    const car = ctx.createOscillator(), mod = ctx.createOscillator(), mg = ctx.createGain(), g = ctx.createGain(), lp = ctx.createBiquadFilter();
    car.frequency.value = f; mod.frequency.value = f;
    car.detune.value = detune();
    mg.gain.setValueAtTime(f * 1.6, t); mg.gain.setTargetAtTime(f * 0.25, t, 0.12);
    mod.connect(mg); mg.connect(car.frequency);
    lp.type = 'lowpass'; lp.frequency.value = 2600;
    car.connect(lp); lp.connect(g); g.connect(bus || musicBus);
    env(g, t, 0.006, 0.07 * vel, 0.35, 0.35, 0.2, dur);
    const tine = ctx.createOscillator(), tg = ctx.createGain();
    tine.frequency.value = f * 4; tine.connect(tg); tg.connect(g);
    tg.gain.setValueAtTime(0.25, t); tg.gain.setTargetAtTime(0.0001, t, 0.05);
    for (const o of [car, mod, tine]) { o.start(t); o.stop(t + dur + 1.2); }
  }
  function bass(t, m, dur, vel) {
    const o = ctx.createOscillator(), g = ctx.createGain(), lp = ctx.createBiquadFilter();
    o.type = 'triangle'; o.frequency.value = mtof(m);
    lp.type = 'lowpass'; lp.frequency.value = 520;
    o.connect(lp); lp.connect(g); g.connect(musicBus);
    env(g, t, 0.01, 0.26 * vel, 0.25, 0.5, 0.08, dur);
    o.start(t); o.stop(t + dur + 0.6);
  }
  function vibes(t, m, dur, vel, bus) {
    const f = mtof(m);
    const o = ctx.createOscillator(), o2 = ctx.createOscillator(), g = ctx.createGain(), g2 = ctx.createGain(), trem = ctx.createOscillator(), tg = ctx.createGain(), out = ctx.createGain();
    o.frequency.value = f; o2.frequency.value = f * 4; o.detune.value = detune();
    g2.gain.value = 0.12;
    o.connect(g); o2.connect(g2); g2.connect(g); g.connect(out); out.connect(bus || musicBus);
    trem.frequency.value = 5.2; tg.gain.value = 0.3; trem.connect(tg); tg.connect(out.gain);
    out.gain.value = 0.7;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.06 * vel, t + 0.004); g.gain.setTargetAtTime(0.0001, t + 0.01, Math.max(0.15, dur * 0.45));
    for (const x of [o, o2, trem]) { x.start(t); x.stop(t + dur + 1.5); }
  }
  function noise(t, dur, type, freq, q, gain, bus) {
    const src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = noiseBuf; src.loop = true;
    f.type = type; f.frequency.value = freq; f.Q.value = q || 1;
    src.connect(f); f.connect(g); g.connect(bus || musicBus);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(gain, t + 0.006); g.gain.setTargetAtTime(0.0001, t + 0.01, dur * 0.4);
    src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.3);
    return { f, g };
  }
  function kick(t, vel) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.setValueAtTime(95, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.14);
    o.connect(g); g.connect(musicBus);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.32 * vel, t + 0.005); g.gain.setTargetAtTime(0.0001, t + 0.02, 0.07);
    o.start(t); o.stop(t + 0.4);
  }

  // ---------------------------------------------------------------- sequenciador
  function pickProg() { prog = mood.mode === 'collapse' ? MINOR : PROGS[Math.floor(Math.random() * PROGS.length)]; progBar = 0; }
  function scheduleStep(t, st) {
    const s16 = st % 16; // um compasso = 16 semicolcheias
    const bar = Math.floor(st / 16);
    const sixteenth = 60 / bpm / 4;
    if (s16 === 0) {
      if (!prog || progBar >= 4 * 2) pickProg();
      const c = prog[Math.floor(progBar / 2) % prog.length];
      curChord = { root: c[0], q: c[1], notes: voicing(c[0], c[1]) };
      progBar++;
    }
    if (!curChord) return;
    const sparse = mood.mode === 'title' ? 0.5 : 1;
    // baixo bossa: 1, 2e, 3, 4e
    const bassRoot = KEY - 24 + curChord.root + (curChord.root > 6 ? -12 : 0);
    if (s16 === 0) bass(t, bassRoot, sixteenth * 5, 1);
    if (s16 === 6) bass(t, bassRoot + 7, sixteenth * 2, 0.8);
    if (s16 === 8) bass(t, bassRoot, sixteenth * 5, 0.9);
    if (s16 === 14) bass(t, bassRoot + 7, sixteenth * 2, 0.8);
    // acordes sincopados
    const comp = bar % 2 === 0 ? [0, 6, 12] : [2, 8, 14];
    if (comp.includes(s16)) for (const n of curChord.notes) ep(t + Math.random() * 0.012, n, sixteenth * (s16 === 0 ? 4 : 2.5), 0.9 * sparse);
    // vassourinha, aro e bumbo
    if (mood.mode !== 'title' || s16 % 4 === 0) noise(t, sixteenth * (s16 % 4 === 0 ? 1.6 : 0.8), 'bandpass', 4200, 0.7, (s16 % 4 === 2 ? 0.05 : 0.025) * (1 + mood.intensity * 1.5));
    const clave = (bar % 2 === 0 ? [0, 6, 12] : [4, 8]);
    if (clave.includes(s16)) noise(t, 0.03, 'highpass', 2600, 2, 0.06 * sparse);
    if (s16 === 0 || s16 === 10) kick(t, 0.7 * sparse);
    if (mood.intensity > 0.3 && s16 % 2 === 1) noise(t, 0.04, 'highpass', 7000, 1, 0.035 * mood.intensity);
    // vibrafone improvisando
    if (s16 % 2 === 0 && Math.random() < 0.26 * sparse) {
      let m;
      if (motif.length >= 4 && Math.random() < 0.45) m = motif[Math.floor(Math.random() * motif.length)];
      else {
        const scale = [0, 2, 4, 7, 9].map((x) => KEY + 12 + x);
        const pool = curChord.notes.map((n) => n + 12).concat(scale, scale.map((x) => x + 12));
        m = pool[Math.floor(Math.random() * pool.length)];
        motif.push(m); if (motif.length > 6) motif.shift();
      }
      vibes(t, m, sixteenth * (2 + Math.floor(Math.random() * 4)), 0.8);
    }
  }
  function tick() {
    if (!ctx) return;
    const sixteenth = 60 / bpm / 4;
    while (nextTime < ctx.currentTime + 0.14) {
      scheduleStep(nextTime, step);
      nextTime += sixteenth * (step % 2 === 0 ? 1.04 : 0.96); // balanço leve
      step++;
    }
  }
  function startMusic() {
    if (!ensure() || running) return;
    running = true;
    nextTime = ctx.currentTime + 0.1; step = 0; prog = null;
    timer = setInterval(tick, 25);
  }
  function stopMusic() { running = false; if (timer) clearInterval(timer); timer = null; }
  function setMood(o) {
    const prevMode = mood.mode;
    Object.assign(mood, o);
    bpm = mood.mode === 'title' ? 84 : mood.mode === 'collapse' ? 76 : 92;
    if (prevMode !== mood.mode) prog = null;
  }
  function beatPhase() { if (!ctx || !running) return (performance.now() / 1000 * bpm / 60) % 1; return (ctx.currentTime * bpm / 60) % 1; }

  // ---------------------------------------------------------------- efeitos
  function osc(type, f0, f1, dur, gain, t0, bus) {
    if (!ensure()) return null;
    const t = (t0 || ctx.currentTime) + 0.005;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t);
    if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    o.connect(g); g.connect(bus || sfxBus);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(gain, t + 0.008); g.gain.setTargetAtTime(0.0001, t + dur * 0.6, dur * 0.3);
    o.start(t); o.stop(t + dur + 0.3);
    return o;
  }
  function nz(type, freq, dur, gain, q, t0) {
    if (!ensure()) return null;
    return noise((t0 || ctx.currentTime) + 0.005, dur, type, freq, q, gain, sfxBus);
  }
  const SFX = {
    click() { osc('sine', 880, 660, 0.05, 0.09); },
    toggle() { osc('triangle', 520, 780, 0.06, 0.08); },
    tick() { osc('square', 1400, 1400, 0.012, 0.025); },
    bubble() { osc('sine', 280 + Math.random() * 200, 900 + Math.random() * 300, 0.09, 0.12); },
    beep(ok) { osc('square', ok === false ? 330 : 660, ok === false ? 220 : 990, 0.12, 0.05); },
    error() { osc('square', 220, 160, 0.18, 0.06); },
    whir(dur) {
      if (!ensure()) return;
      const t = ctx.currentTime + 0.01;
      const o = ctx.createOscillator(), lp = ctx.createBiquadFilter(), g = ctx.createGain(), lfo = ctx.createOscillator(), lg = ctx.createGain();
      o.type = 'sawtooth'; o.frequency.setValueAtTime(70, t); o.frequency.linearRampToValueAtTime(160, t + dur * 0.7); o.frequency.linearRampToValueAtTime(90, t + dur);
      lp.type = 'lowpass'; lp.frequency.value = 700;
      lfo.frequency.value = 11; lg.gain.value = 8; lfo.connect(lg); lg.connect(o.frequency);
      o.connect(lp); lp.connect(g); g.connect(sfxBus);
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.09, t + 0.15); g.gain.setValueAtTime(0.09, t + dur - 0.2); g.gain.linearRampToValueAtTime(0.0001, t + dur);
      o.start(t); lfo.start(t); o.stop(t + dur + 0.1); lfo.stop(t + dur + 0.1);
      for (let i = 0; i < 8; i++) osc('sine', 300 + Math.random() * 300, 900, 0.08, 0.05, t + Math.random() * dur);
    },
    ding() { if (!ensure()) return; const t = ctx.currentTime; vibes(t, 86, 0.8, 1.4, sfxBus); vibes(t + 0.09, 90, 0.8, 1.2, sfxBus); },
    inject() { nz('bandpass', 6000, 0.35, 0.08, 1.5); osc('sine', 500, 180, 0.12, 0.08, ctx && ctx.currentTime + 0.25); },
    squeak() { osc('sine', 1800, 2700, 0.09, 0.07); osc('sine', 2600, 1500, 0.1, 0.06, ctx && ctx.currentTime + 0.09); },
    servo() { osc('sawtooth', 180, 420, 0.22, 0.04); },
    rustle() { nz('bandpass', 2600, 0.3, 0.06, 0.8); },
    slurp() { osc('sine', 700, 140, 0.28, 0.1); },
    pop() { osc('sine', 700, 180, 0.09, 0.13); nz('highpass', 3000, 0.04, 0.05); },
    zap() { if (!ensure()) return; const t = ctx.currentTime; for (let i = 0; i < 5; i++) osc('sawtooth', 200 + Math.random() * 1200, 100 + Math.random() * 600, 0.04, 0.04, t + i * 0.035); },
    boom() { nz('lowpass', 380, 1.0, 0.35, 0.7); osc('sine', 70, 28, 0.7, 0.3); },
    splash() { nz('bandpass', 1300, 0.6, 0.18, 0.6); },
    crack() { nz('highpass', 2200, 0.08, 0.2, 1); osc('square', 1800, 600, 0.04, 0.05); },
    coin() { osc('sine', 1320, 1320, 0.07, 0.08); osc('sine', 1760, 1760, 0.16, 0.08, ctx && ctx.currentTime + 0.07); },
    alarm() { if (!ensure()) return; const t = ctx.currentTime; for (let i = 0; i < 4; i++) osc('square', i % 2 ? 660 : 880, i % 2 ? 660 : 880, 0.14, 0.04, t + i * 0.16); },
    sneeze() { osc('sine', 300, 520, 0.35, 0.06); nz('bandpass', 2400, 0.25, 0.22, 0.8, ctx && ctx.currentTime + 0.38); },
    stamp() { nz('lowpass', 500, 0.12, 0.25, 1); },
    paper() { nz('highpass', 4000, 0.12, 0.06, 0.7); },
    hic() { osc('sine', 500, 1100, 0.07, 0.1); },
    laser() { osc('sine', 1600, 240, 0.32, 0.07); osc('square', 1200, 200, 0.3, 0.02); },
    talk() { if (!ensure()) return; const t = ctx.currentTime; const n = 5 + Math.floor(Math.random() * 5); for (let i = 0; i < n; i++) { const f = 280 + Math.random() * 380; osc('square', f, f * 1.1, 0.05, 0.025, t + i * 0.07); } },
    chime(sev) {
      if (!ensure()) return;
      const t = ctx.currentTime;
      const sets = { inofensiva: [74, 78, 81, 86], bizarra: [74, 80, 83, 89], perigosa: [74, 77, 80, 83], destrutiva: [62, 63, 68, 69] };
      (sets[sev] || sets.inofensiva).forEach((m, i) => vibes(t + i * 0.08, m, 0.7, 1.4, sfxBus));
      if (sev === 'destrutiva') osc('sawtooth', 110, 55, 0.6, 0.08);
    },
    synergy() { if (!ensure()) return; const t = ctx.currentTime; [74, 78, 81, 85, 88].forEach((m, i) => vibes(t + i * 0.06, m, 0.9, 1.5, sfxBus)); },
    fanfare() { if (!ensure()) return; const t = ctx.currentTime; [62, 66, 69, 74].forEach((m, i) => ep(t + i * 0.09, m, 0.5, 2.2, sfxBus)); [74, 78].forEach((m) => ep(t + 0.4, m, 0.9, 2, sfxBus)); },
    sting() { if (!ensure()) return; const t = ctx.currentTime; [74, 70, 67, 62, 58].forEach((m, i) => ep(t + i * 0.13, m, 0.6, 2.4, sfxBus)); },
    page() { nz('bandpass', 3000, 0.18, 0.08, 0.5); },
    creature(host) { if (host === 'rato') SFX.squeak(); else if (host === 'robo') SFX.servo(); else if (host === 'planta') SFX.rustle(); else SFX.slurp(); },
    sing() {
      if (!ensure() || !curChord) { osc('triangle', 660, 660, 0.4, 0.05); return; }
      const t = ctx.currentTime;
      const m = curChord.notes[Math.floor(Math.random() * curChord.notes.length)] + 12;
      const o = ctx.createOscillator(), g = ctx.createGain(), vib = ctx.createOscillator(), vg = ctx.createGain();
      o.type = 'triangle'; o.frequency.value = mtof(m);
      vib.frequency.value = 6; vg.gain.value = mtof(m) * 0.012; vib.connect(vg); vg.connect(o.frequency);
      o.connect(g); g.connect(sfxBus);
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.06, t + 0.06); g.gain.setTargetAtTime(0.0001, t + 0.4, 0.12);
      o.start(t); vib.start(t); o.stop(t + 0.9); vib.stop(t + 0.9);
    },
  };

  MX.Audio = { unlock, setVolumes, suspend, resume, startMusic, stopMusic, setMood, beatPhase, sfx: SFX, get ready() { return !!ctx; } };
})(typeof window !== 'undefined' ? window : globalThis);
