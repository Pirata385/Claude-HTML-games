/* Planolândia — áudio 100% sintetizado (WebAudio): efeitos curtos e música generativa por região. */
(function (root) {
  'use strict';
  const PL = root.PL || (root.PL = {});

  let ctx = null, master = null, musicBus = null, sfxBus = null, noiseBuf = null, comp = null;
  let musicVol = 0.6, sfxVol = 0.8;
  let track = null, wanted = null, nextT = 0, step = 0, timer = null, fading = false;
  const lastPlay = {};

  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return true; }
    const AC = root.AudioContext || root.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 4;
    master = ctx.createGain(); master.gain.value = 0.9;
    master.connect(comp); comp.connect(ctx.destination);
    musicBus = ctx.createGain(); musicBus.gain.value = musicVol * 0.5; musicBus.connect(master);
    sfxBus = ctx.createGain(); sfxBus.gain.value = sfxVol; sfxBus.connect(master);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    timer = setInterval(tick, 50);
    return true;
  }

  // ---------- blocos ----------
  function env(g, t, a, peak, dec, sus, rel) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0001, peak * (sus || 0.0001)), t + a + dec);
    if (rel) g.gain.exponentialRampToValueAtTime(0.0001, t + a + dec + rel);
  }
  function tone(type, f0, f1, t, dur, vol, bus, filt) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    env(g, t, Math.min(0.01, dur * 0.2), vol, dur, 0.0001);
    let node = o;
    if (filt) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = filt; o.connect(f); node = f; }
    node.connect(g); g.connect(bus || sfxBus);
    o.start(t); o.stop(t + dur + 0.05);
    return o;
  }
  function noise(t, dur, vol, type, f0, f1, bus, q) {
    const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = noiseBuf;
    f.type = type || 'lowpass';
    f.frequency.setValueAtTime(f0 || 1000, t);
    if (f1) f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    f.Q.value = q || 1;
    env(g, t, 0.004, vol, dur, 0.0001);
    s.connect(f); f.connect(g); g.connect(bus || sfxBus);
    s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
  }

  const SFX = {
    jump: (t) => tone('square', 280, 560, t, 0.09, 0.07, null, 2400),
    land: (t, k) => noise(t, 0.07, 0.12 * (k || 0.5) + 0.04, 'lowpass', 500, 120),
    slash: (t) => { noise(t, 0.1, 0.16, 'bandpass', 3200, 700, null, 2); tone('triangle', 900, 300, t, 0.07, 0.03); },
    hit: (t) => { tone('sine', 200, 55, t, 0.12, 0.3); noise(t, 0.04, 0.12, 'highpass', 2500); },
    clink: (t) => { tone('triangle', 1250, 1150, t, 0.06, 0.08); tone('triangle', 1880, 1800, t, 0.05, 0.05); },
    clank: (t) => { tone('square', 230, 180, t, 0.12, 0.07, null, 1500); noise(t, 0.06, 0.1, 'bandpass', 1800); },
    kill: (t) => { tone('square', 640, 160, t, 0.22, 0.08, null, 2000); noise(t, 0.18, 0.12, 'lowpass', 1800, 200); },
    hurt: (t) => { tone('sawtooth', 420, 110, t, 0.28, 0.12, null, 1800); noise(t, 0.12, 0.14, 'lowpass', 2000, 300); },
    death: (t) => { [520, 390, 290, 196].forEach((f, i) => tone('square', f, f * 0.98, t + i * 0.12, 0.16, 0.08, null, 1600)); },
    coin: (t) => { tone('sine', 1320, 1320, t, 0.05, 0.06); tone('sine', 1760, 1760, t + 0.045, 0.07, 0.06); },
    dash: (t) => { noise(t, 0.16, 0.13, 'highpass', 800, 4000); tone('sine', 200, 700, t, 0.12, 0.05); },
    focus: (t) => tone('sine', 300, 620, t, 0.8, 0.04),
    heal: (t) => { [523, 659, 784].forEach((f, i) => tone('sine', f, f, t + i * 0.03, 0.35, 0.06)); },
    bench: (t) => { [294, 370, 440, 587].forEach((f, i) => tone('triangle', f, f, t + i * 0.08, 0.9, 0.05)); },
    item: (t) => { [523, 659, 784, 1047, 1319].forEach((f, i) => tone('triangle', f, f, t + i * 0.07, 0.25, 0.07)); },
    door: (t) => noise(t, 0.28, 0.07, 'lowpass', 600, 150),
    block: (t) => tone('square', 95, 80, t, 0.06, 0.05, null, 600),
    alert: (t) => { tone('square', 880, 880, t, 0.05, 0.04, null, 3000); tone('square', 1175, 1175, t + 0.07, 0.05, 0.04, null, 3000); },
    thud: (t) => { tone('sine', 95, 38, t, 0.22, 0.32); noise(t, 0.1, 0.1, 'lowpass', 400); },
    stab: (t) => { noise(t, 0.06, 0.08, 'highpass', 3000); tone('sine', 1000, 600, t, 0.06, 0.04); },
    slam: (t) => { tone('sine', 80, 28, t, 0.5, 0.5); noise(t, 0.45, 0.25, 'lowpass', 900, 80); },
    spin: (t) => tone('sawtooth', 120, 480, t, 0.7, 0.06, null, 1200),
    ram: (t) => { noise(t, 0.6, 0.12, 'bandpass', 300, 2400, null, 1.5); tone('sawtooth', 70, 140, t, 0.6, 0.06, null, 500); },
    roar: (t) => { const o = tone('sawtooth', 90, 60, t, 0.9, 0.12, null, 700); const l = ctx.createOscillator(), lg = ctx.createGain(); l.frequency.value = 14; lg.gain.value = 18; l.connect(lg); lg.connect(o.frequency); l.start(t); l.stop(t + 1); },
    core: (t) => { tone('triangle', 880, 860, t, 0.3, 0.1); tone('sine', 1320, 1300, t, 0.25, 0.06); tone('sine', 220, 110, t, 0.15, 0.2); },
    crack: (t) => noise(t, 0.12, 0.16, 'bandpass', 1600, 600, null, 3),
    gate: (t) => noise(t, 0.7, 0.12, 'lowpass', 260, 90),
    unfold: (t) => { [262, 330, 392, 523, 659, 784].forEach((f, i) => tone('triangle', f, f, t + i * 0.12, 0.4, 0.07)); },
    menu: (t) => tone('sine', 660, 660, t, 0.03, 0.04),
    ok: (t) => { tone('sine', 880, 880, t, 0.05, 0.05); tone('sine', 1320, 1320, t + 0.05, 0.06, 0.04); },
    type: (t) => tone('square', 1200 + Math.random() * 200, 1200, t, 0.012, 0.012, null, 3000),
    boing: (t) => { tone('sine', 180, 620, t, 0.18, 0.18); tone('triangle', 360, 900, t + 0.02, 0.14, 0.05); },
    garra: (t) => { noise(t, 0.06, 0.1, 'bandpass', 2600, 1800, null, 3); tone('triangle', 700, 600, t, 0.04, 0.04); },
    walljump: (t) => { tone('square', 330, 700, t, 0.08, 0.06, null, 2400); noise(t, 0.05, 0.08, 'highpass', 2000); },
    spore: (t) => { [0, 0.05, 0.1].forEach((d) => { noise(t + d, 0.05, 0.06, 'bandpass', 1400, 900, null, 4); tone('sine', 500, 300, t + d, 0.05, 0.04); }); },
    buy: (t) => { [784, 988, 1175, 1568].forEach((f, i) => tone('triangle', f, f, t + i * 0.05, 0.12, 0.06)); },
    talk: (t) => { tone('triangle', 520, 580, t, 0.06, 0.05); tone('triangle', 660, 620, t + 0.07, 0.06, 0.04); },
  };

  // ---------- música generativa ----------
  const NOTE = (n) => 440 * Math.pow(2, (n - 69) / 12);
  const TRACKS = {
    title: { bpm: 70, root: 50, scale: [0, 2, 4, 6, 7, 9, 11], prog: [0, 5, 3, 4], pad: 0.05, arp: 0.25, bass: 0.10, drums: false, bell: true },
    borda: { bpm: 84, root: 50, scale: [0, 2, 4, 6, 7, 9, 11], prog: [0, 4, 5, 3], pad: 0.045, arp: 0.45, bass: 0.12, drums: false, bell: false },
    bosque: { bpm: 78, root: 45, scale: [0, 3, 5, 7, 10, 12, 15], prog: [0, 3, 4, 2], pad: 0.04, arp: 0.5, bass: 0.11, drums: false, bell: false, flute: true, wood: true },
    boss2: { bpm: 150, root: 42, scale: [0, 2, 3, 5, 7, 8, 11], prog: [0, 5, 3, 4], pad: 0.03, arp: 0.65, bass: 0.15, drums: true, bell: false, waltz: true },
    boss: { bpm: 138, root: 45, scale: [0, 1, 3, 5, 7, 8, 10], prog: [0, 0, 5, 6], pad: 0.03, arp: 0.7, bass: 0.16, drums: true, bell: false },
  };
  function chord(T, bar) {
    const deg = T.prog[bar % T.prog.length];
    const s = T.scale;
    return [0, 2, 4].map((k) => T.root + s[(deg + k) % 7] + 12 * Math.floor((deg + k) / 7));
  }
  function schedStep(T, t, i) {
    const bar = Math.floor(i / 16), pos = i % 16;
    const ch = chord(T, bar);
    const spb = 60 / T.bpm / 4;
    if (pos === 0 && bar % 2 === 0) {
      // pad: tríade com triângulos desafinados, ataque lento
      for (const n of ch) for (const det of [-6, 6]) {
        const o = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter();
        o.type = 'triangle'; o.frequency.value = NOTE(n + 12); o.detune.value = det;
        f.type = 'lowpass'; f.frequency.value = 1100;
        const dur = spb * 32;
        g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(T.pad, t + dur * 0.3); g.gain.linearRampToValueAtTime(0.0001, t + dur);
        o.connect(f); f.connect(g); g.connect(musicBus);
        o.start(t); o.stop(t + dur + 0.1);
      }
    }
    if (T.bass && (pos === 0 || (T.drums && pos % 4 === 2) || (!T.drums && pos === 10 && Math.random() < 0.5))) {
      const n = ch[0] - 12 + (T.drums && pos % 8 === 6 ? 7 : 0);
      if (T.drums) tone('sawtooth', NOTE(n), NOTE(n), t, spb * 1.8, T.bass * 0.7, musicBus, 500);
      else tone('sine', NOTE(n), NOTE(n), t, spb * 6, T.bass, musicBus);
    }
    const arpP = T.drums ? (pos % 2 === 0 ? T.arp : 0.15) : (pos % 2 === 0 ? T.arp : 0.08);
    if (Math.random() < arpP) {
      const n = ch[(Math.random() * 3) | 0] + 24 + (Math.random() < 0.25 ? 12 : 0);
      if (T.flute) {
        // "flauta": triângulo com vibrato leve
        const o = tone('triangle', NOTE(n), NOTE(n), t, spb * 3.5, 0.045, musicBus, 3500);
        const l = ctx.createOscillator(), lg = ctx.createGain(); l.frequency.value = 5.5; lg.gain.value = NOTE(n) * 0.006; l.connect(lg); lg.connect(o.frequency); l.start(t); l.stop(t + spb * 3.6);
      } else tone(T.drums ? 'square' : 'sine', NOTE(n), NOTE(n), t, T.drums ? spb * 0.9 : spb * 3, T.drums ? 0.025 : 0.04, musicBus, T.drums ? 2200 : 5000);
    }
    if (T.wood && (pos === 4 || pos === 12 || (pos === 14 && Math.random() < 0.4))) noise(t, 0.04, 0.05, 'bandpass', 900, 700, musicBus, 8);
    if (T.bell && pos === 0 && Math.random() < 0.6) tone('triangle', NOTE(ch[2] + 36), NOTE(ch[2] + 36), t + spb * 4, 1.2, 0.03, musicBus);
    if (T.drums && T.waltz) {
      // 6/8: bumbo no 1 e no 4 de cada grupo de 6 colcheias (aproximado nas semicolcheias)
      const p6 = i % 12;
      if (p6 === 0) tone('sine', 140, 40, t, 0.18, 0.35, musicBus);
      if (p6 === 6) noise(t, 0.1, 0.1, 'bandpass', 1600, 900, musicBus);
      if (p6 % 2 === 0) noise(t, 0.03, 0.03, 'highpass', 7000, null, musicBus);
    } else if (T.drums) {
      if (pos % 4 === 0) { tone('sine', 140, 40, t, 0.18, 0.35, musicBus); }
      if (pos % 8 === 4) noise(t, 0.12, 0.12, 'bandpass', 1800, 900, musicBus);
      if (pos % 2 === 0) noise(t, 0.03, 0.035, 'highpass', 7000, null, musicBus);
    } else if (pos === 8 && Math.random() < 0.2) {
      noise(t, 0.05, 0.02, 'highpass', 5000, null, musicBus);
    }
  }
  function tick() {
    if (!ctx || ctx.state !== 'running') return;
    if (wanted !== track && !fading) {
      fading = true;
      const now = ctx.currentTime;
      musicBus.gain.cancelScheduledValues(now);
      musicBus.gain.setValueAtTime(musicBus.gain.value, now);
      musicBus.gain.linearRampToValueAtTime(0.0001, now + 0.6);
      setTimeout(() => {
        track = wanted; step = 0; nextT = ctx.currentTime + 0.05; fading = false;
        const n2 = ctx.currentTime;
        musicBus.gain.cancelScheduledValues(n2);
        musicBus.gain.setValueAtTime(0.0001, n2);
        musicBus.gain.linearRampToValueAtTime(musicVol * 0.5, n2 + 0.8);
      }, 650);
    }
    if (!track || fading) return;
    const T = TRACKS[track];
    const spb = 60 / T.bpm / 4;
    while (nextT < ctx.currentTime + 0.25) {
      schedStep(T, nextT, step);
      nextT += spb; step++;
    }
  }

  PL.Audio = {
    init,
    get ready() { return !!ctx && ctx.state === 'running'; },
    sfx(name, k) {
      if (!ctx || ctx.state !== 'running' || sfxVol <= 0) return;
      const f = SFX[name];
      if (!f) return;
      const now = ctx.currentTime;
      if (lastPlay[name] && now - lastPlay[name] < 0.025) return;
      lastPlay[name] = now;
      try { f(now + 0.005, k); } catch (e) { /* ignora */ }
    },
    music(name) { wanted = name || null; },
    setVolumes(m, s) {
      musicVol = m; sfxVol = s;
      if (ctx) { musicBus.gain.setValueAtTime(musicVol * 0.5, ctx.currentTime); sfxBus.gain.setValueAtTime(sfxVol, ctx.currentTime); }
    },
    suspend() { if (ctx && ctx.state === 'running') ctx.suspend(); },
    resume() { if (ctx && ctx.state === 'suspended') ctx.resume(); },
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = PL;
})(typeof globalThis !== 'undefined' ? globalThis : this);
