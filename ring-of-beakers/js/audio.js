// audio.js — sound effects and bird voices, synthesised with WebAudio: voices are shaped by their
// voice genes and their kind of call. The music is recorded (music/*.mp3) and played by music.js.
(function () {
  'use strict';
  const RB = globalThis.RB;
  const audio = { sfx: 0.8, music: 0.5, tune: null };
  let ac = null, sfxG = null, noiseBuf = null;

  function ensure() {
    if (ac) { if (ac.state === 'suspended') ac.resume(); return true; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    try { ac = new AC(); } catch (e) { return false; }
    sfxG = ac.createGain(); sfxG.gain.value = audio.sfx * 0.5; sfxG.connect(ac.destination);
    noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return true;
  }
  audio.unlock = ensure;
  audio.setVolumes = function (sfx, music) { audio.sfx = sfx; audio.music = music; if (ac) sfxG.gain.value = sfx * 0.5; };
  audio.setTune = () => {}; // until music.js takes over

  // One note. o: { type, vol, to (slide to this frequency), at (delay), out (gain node), attack,
  //   vib: [rate Hz, depth as a fraction of the pitch] (a warble), bp: [freq, q] (a nasal filter),
  //   bp2: a second filter in parallel (two formants make a vowel) }
  function tone(f, dur, o) {
    o = o || {};
    const t = ac.currentTime + (o.at || 0), osc = ac.createOscillator(), g = ac.createGain();
    osc.type = o.type || 'triangle';
    osc.frequency.setValueAtTime(Math.max(20, f), t);
    if (o.to) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.to), t + dur);
    const v = o.vol === undefined ? 0.3 : o.vol;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + (o.attack || 0.008)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    if (o.vib) {
      const lfo = ac.createOscillator(), lg = ac.createGain();
      lfo.frequency.value = o.vib[0]; lg.gain.value = f * o.vib[1];
      lfo.connect(lg); lg.connect(osc.frequency); lfo.start(t); lfo.stop(t + dur + 0.02);
    }
    const out = o.out || sfxG;
    if (o.bp) {
      for (const b of [o.bp, o.bp2]) {
        if (!b) continue;
        const bf = ac.createBiquadFilter();
        bf.type = 'bandpass'; bf.frequency.value = b[0]; bf.Q.value = b[1] || 4;
        osc.connect(bf); bf.connect(g);
      }
    } else osc.connect(g);
    g.connect(out);
    osc.start(t); osc.stop(t + dur + 0.02);
  }
  function noise(dur, o) {
    o = o || {};
    const t = ac.currentTime + (o.at || 0), src = ac.createBufferSource(), g = ac.createGain(), f = ac.createBiquadFilter();
    src.buffer = noiseBuf; src.loop = true;
    f.type = o.band ? 'bandpass' : o.high ? 'highpass' : 'lowpass'; f.frequency.setValueAtTime(o.freq || 1200, t); f.Q.value = o.q || 0.8;
    if (o.to) f.frequency.exponentialRampToValueAtTime(o.to, t + dur);
    const v = o.vol === undefined ? 0.3 : o.vol;
    g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(o.out || sfxG);
    src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.02);
  }

  const SFX = {
    click: () => tone(660, 0.05, { type: 'square', vol: 0.12 }),
    coin: () => { tone(988, 0.07, { type: 'square', vol: 0.14 }); tone(1319, 0.16, { type: 'square', vol: 0.14, at: 0.06 }); },
    buy: () => { tone(523, 0.07, { vol: 0.2 }); tone(784, 0.14, { vol: 0.2, at: 0.06 }); },
    error: () => { tone(196, 0.14, { type: 'sawtooth', vol: 0.14 }); tone(147, 0.2, { type: 'sawtooth', vol: 0.14, at: 0.1 }); },
    peck: () => { noise(0.05, { freq: 2600, vol: 0.3, band: true }); tone(420, 0.06, { type: 'square', vol: 0.12, to: 180 }); },
    kick: () => { noise(0.1, { freq: 900, vol: 0.45 }); tone(160, 0.14, { vol: 0.35, to: 60 }); },
    thud: () => { noise(0.14, { freq: 400, vol: 0.5 }); tone(90, 0.2, { vol: 0.4, to: 40 }); },
    crit: () => { noise(0.12, { freq: 3200, vol: 0.4, band: true }); tone(880, 0.1, { type: 'square', vol: 0.18, to: 220 }); tone(120, 0.2, { vol: 0.4, to: 50 }); },
    whoosh: () => noise(0.22, { freq: 500, to: 2400, vol: 0.22, band: true, q: 1.5 }),
    net: () => { noise(0.3, { freq: 700, to: 2600, vol: 0.2, band: true, q: 2 }); },
    catch: () => { tone(392, 0.08, { vol: 0.22 }); tone(523, 0.08, { vol: 0.22, at: 0.07 }); tone(659, 0.2, { vol: 0.22, at: 0.14 }); },
    dig: () => { noise(0.16, { freq: 1500, to: 300, vol: 0.35 }); noise(0.12, { freq: 900, to: 250, vol: 0.25, at: 0.22 }); },
    found: () => { tone(659, 0.08, { type: 'square', vol: 0.13 }); tone(880, 0.08, { type: 'square', vol: 0.13, at: 0.08 }); tone(1319, 0.25, { type: 'square', vol: 0.13, at: 0.16 }); },
    poof: () => noise(0.35, { freq: 2200, to: 200, vol: 0.3 }),
    bell: () => { tone(1568, 0.7, { type: 'sine', vol: 0.3 }); tone(2349, 0.5, { type: 'sine', vol: 0.12 }); },
    cheer: () => { noise(1.2, { freq: 1100, vol: 0.2, band: true, q: 0.5 }); noise(0.9, { freq: 2200, vol: 0.1, band: true, q: 0.6, at: 0.1 }); },
    boo: () => { tone(155, 0.6, { type: 'sawtooth', vol: 0.08, to: 110 }); noise(0.7, { freq: 300, vol: 0.14 }); },
    whistle: () => { tone(2100, 0.12, { type: 'sine', vol: 0.2, to: 2600 }); tone(2600, 0.25, { type: 'sine', vol: 0.2, at: 0.12, to: 2300 }); },
    hatch: () => { noise(0.06, { freq: 3000, vol: 0.3, band: true }); noise(0.06, { freq: 2400, vol: 0.3, band: true, at: 0.12 }); tone(1400, 0.1, { vol: 0.15, at: 0.25, to: 1900 }); },
    sleep: () => { tone(523, 0.3, { type: 'sine', vol: 0.18 }); tone(392, 0.3, { type: 'sine', vol: 0.18, at: 0.25 }); tone(330, 0.6, { type: 'sine', vol: 0.18, at: 0.5 }); },
    win: () => { [523, 659, 784, 1047].forEach((f, i) => tone(f, i === 3 ? 0.5 : 0.12, { type: 'square', vol: 0.14, at: i * 0.12 })); },
    lose: () => { [392, 349, 311, 262].forEach((f, i) => tone(f, i === 3 ? 0.5 : 0.16, { type: 'triangle', vol: 0.2, at: i * 0.16 })); },
    tick: () => tone(1200, 0.03, { type: 'square', vol: 0.08 }),
    good: () => { tone(880, 0.06, { vol: 0.2 }); tone(1175, 0.12, { vol: 0.2, at: 0.05 }); },
    bad: () => { tone(220, 0.18, { type: 'sawtooth', vol: 0.15, to: 140 }); },
    horn: () => { tone(311, 0.25, { type: 'sawtooth', vol: 0.14 }); tone(392, 0.25, { type: 'sawtooth', vol: 0.14 }); },
    siren: () => { tone(700, 0.25, { type: 'square', vol: 0.08, to: 1000 }); tone(1000, 0.25, { type: 'square', vol: 0.08, to: 700, at: 0.25 }); },
    splash: () => noise(0.4, { freq: 2600, to: 500, vol: 0.3 }),
    step: () => noise(0.03, { freq: 700, vol: 0.06 }),
    zap: () => { tone(1800, 0.2, { type: 'sawtooth', vol: 0.1, to: 200 }); noise(0.15, { freq: 4000, vol: 0.12, band: true }); },
  };
  audio.play = function (name) { if (audio.sfx <= 0 || !ensure()) return; const f = SFX[name]; if (f) f(); };

  // ---- voices
  // Which family of calls each kind makes. A cross has the calls of both of its kinds.
  const STYLE = {
    chicken: 'fowl', bantam: 'fowl', gamecock: 'fowl', pheasant: 'pheasant', quail: 'quail', turkey: 'turkey', duck: 'duck', goose: 'honk', swan: 'honk',
    flamingo: 'gabble', peafowl: 'peacock', ostrich: 'boom', emu: 'boom', cassowary: 'boom', moa: 'boom', kiwi: 'whistle', falcon: 'kee', eagle: 'scream',
    secretary: 'croak', heron: 'croak', toucan: 'frog', vulture: 'hiss', condor: 'hiss', harpy: 'wail', owl: 'hoot', pelican: 'grunt', gull: 'laugh',
    penguin: 'bray', parrot: 'parrot', raven: 'caw', hummingbird: 'chirp', archaeo: 'chirp', roadrunner: 'coo', dodo: 'coo', terror: 'roar', raptor: 'roar', human: 'human',
    nightjar: 'churr', potoo: 'lament', kakapo: 'boom', thickknee: 'curlee', shoebill: 'clatter', elephant: 'boom',
    albatross: 'clatter', frigatebird: 'frog', puffin: 'grunt', haast: 'scream', auk: 'grunt', pelagornis: 'laugh', trex: 'roar',
    frogmouth: 'hoot', oilbird: 'scream', boatbill: 'croak', crane: 'honk', kookaburra: 'laugh', marabou: 'clatter', cormorant: 'grunt', booby: 'whistle', tropicbird: 'kee',
    gastornis: 'boom', gallimimus: 'honk', pteranodon: 'hiss',
  };
  const rnd = (a, b) => a + Math.random() * (b - a);
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  // Each family: cluck (chatter), crow (a big call: morning, victory), squawk (alarm, pain).
  // p is the pitch in Hz, w the waveform the rasp gene picks, r the rasp, L the call length (0..1).
  const CALLS = {
    fowl: {
      cluck: (p, w, r, L) => {
        if (Math.random() < 0.22) { // buk-buk-buk-BAWK
          for (let i = 0; i < 3; i++) tone(p * rnd(0.85, 0.95), 0.06, { type: w, vol: 0.09, at: i * 0.11, to: p * 1.15 });
          tone(p * 1.3, 0.22 + 0.1 * L, { type: w, vol: 0.11, at: 0.36, to: p * 1.7 });
        } else { const n = 1 + Math.floor(Math.random() * 3); for (let i = 0; i < n; i++) tone(p * rnd(0.85, 1), 0.05 + 0.04 * L, { type: w, vol: 0.09, at: i * 0.13, to: p * 1.25 }); }
        if (r > 0.4) noise(0.04, { freq: p * 2.5, vol: 0.05, band: true });
      },
      crow: (p, w, r, L) => {
        const n = 3 + Math.round(L * 2), base = 0.11 + 0.05 * L;
        for (let i = 0; i < n; i++) { const last = i === n - 1; tone(p * (last ? 1.5 : 1.15 + 0.1 * (i % 2)), last ? base * 3.2 : base, { type: w, vol: 0.1, at: i * base * 1.15, to: last ? p * 0.9 : p * 1.3 }); }
      },
      squawk: (p, w) => { for (let i = 0; i < 5; i++) tone(p * (i % 2 ? 1.9 : 1.5) * rnd(0.95, 1.05), 0.07, { type: 'sawtooth', vol: 0.11, at: i * 0.075, to: p * 1.2 }); noise(0.3, { freq: p * 3, vol: 0.06, band: true }); void w; },
    },
    pheasant: {
      cluck: (p, w) => { tone(p * 0.9, 0.08, { type: w, vol: 0.1, to: p * 0.7 }); tone(p * 0.8, 0.07, { type: w, vol: 0.08, at: 0.12, to: p * 0.6 }); },
      crow: (p) => { tone(p * 1.4, 0.16, { type: 'sawtooth', vol: 0.13, to: p * 1.1 }); tone(p * 1.3, 0.14, { type: 'sawtooth', vol: 0.11, at: 0.2, to: p }); noise(0.5, { freq: 300, vol: 0.18, at: 0.36 }); },
      squawk: (p) => { for (let i = 0; i < 4; i++) tone(p * 1.3, 0.06, { type: 'sawtooth', vol: 0.1, at: i * 0.09, to: p * 0.9 }); noise(0.4, { freq: 400, vol: 0.15 }); },
    },
    quail: {
      cluck: (p) => { const q = p * 1.6; tone(q, 0.07, { type: 'sine', vol: 0.12, to: q * 1.3 }); tone(q * 1.3, 0.05, { type: 'sine', vol: 0.1, at: 0.16 }); tone(q * 1.2, 0.1, { type: 'sine', vol: 0.12, at: 0.26, to: q * 1.5 }); },
      crow: (p) => { const q = p * 1.6; for (let k = 0; k < 2; k++) { tone(q, 0.08, { type: 'sine', vol: 0.12, at: k * 0.6, to: q * 1.4 }); tone(q * 1.3, 0.06, { type: 'sine', vol: 0.1, at: k * 0.6 + 0.16 }); tone(q * 1.25, 0.12, { type: 'sine', vol: 0.12, at: k * 0.6 + 0.27, to: q * 1.6 }); } },
      squawk: (p) => { tone(p * 2, 0.08, { type: 'square', vol: 0.09, to: p * 3 }); noise(0.15, { freq: 1800, vol: 0.12 }); },
    },
    turkey: {
      cluck: (p, w) => tone(p * 0.8, 0.05, { type: w, vol: 0.1, to: p * 0.55 }),
      crow: (p) => tone(p * 1.1, 0.5 + 0.3 * Math.random(), { type: 'square', vol: 0.11, to: p * 0.75, vib: [26, 0.28] }), // the gobble
      squawk: (p) => { for (let i = 0; i < 4; i++) tone(p * (1.4 - i * 0.08), 0.1, { type: 'square', vol: 0.1, at: i * 0.15, to: p * 0.9 }); },
    },
    duck: {
      cluck: (p) => { const n = 1 + Math.floor(Math.random() * 2); for (let i = 0; i < n; i++) tone(p * 0.7 * rnd(0.95, 1.05), 0.12, { type: 'square', vol: 0.18, at: i * 0.18, to: p * 0.55, bp: [p * 1.8, 3] }); },
      crow: (p) => { for (let i = 0; i < 5; i++) tone(p * (0.8 - i * 0.04), 0.14, { type: 'square', vol: 0.2, at: i * 0.17, to: p * 0.55, bp: [p * 1.8, 3] }); }, // a laughing run of quacks
      squawk: (p) => { tone(p * 0.9, 0.25, { type: 'sawtooth', vol: 0.2, to: p * 0.6, bp: [p * 2, 2.5] }); noise(0.15, { freq: p * 3, vol: 0.06, band: true }); },
    },
    honk: {
      cluck: (p) => tone(p * 0.8, 0.12, { type: 'square', vol: 0.16, to: p * 0.75, bp: [p * 2.2, 3] }),
      crow: (p) => { tone(p * 0.8, 0.32, { type: 'square', vol: 0.2, to: p * 0.9, bp: [p * 2.2, 3] }); tone(p * 0.95, 0.4, { type: 'square', vol: 0.2, at: 0.36, to: p * 0.7, bp: [p * 2.2, 3] }); },
      squawk: (p) => { noise(0.45, { freq: 3500, vol: 0.2, high: true }); tone(p, 0.2, { type: 'square', vol: 0.12, at: 0.3, to: p * 0.8, bp: [p * 2.2, 3] }); }, // a hiss, then a honk
    },
    gabble: {
      cluck: (p) => { for (let i = 0; i < 3; i++) tone(p * rnd(0.8, 1), 0.07, { type: 'square', vol: 0.13, at: i * 0.09, bp: [p * 2, 3] }); },
      crow: (p) => { for (let i = 0; i < 7; i++) tone(p * rnd(0.75, 1.05), 0.08, { type: 'square', vol: 0.14, at: i * 0.1, bp: [p * 2, 3] }); },
      squawk: (p) => tone(p * 1.1, 0.25, { type: 'square', vol: 0.18, to: p * 0.8, bp: [p * 2, 3] }),
    },
    peacock: {
      cluck: (p) => tone(p * 0.9, 0.18, { type: 'sawtooth', vol: 0.08, to: p * 0.8 }),
      crow: (p) => { tone(p * 1.6, 0.18, { type: 'sawtooth', vol: 0.12, to: p * 2.4 }); tone(p * 2.4, 0.5, { type: 'sawtooth', vol: 0.13, at: 0.18, to: p * 1.3, vib: [6, 0.03] }); }, // "may-AWW"
      squawk: (p) => { for (let i = 0; i < 3; i++) tone(p * 2.2, 0.12, { type: 'sawtooth', vol: 0.12, at: i * 0.16, to: p * 1.5 }); },
    },
    boom: {
      cluck: (p) => tone(Math.max(55, p * 0.35), 0.18, { type: 'sine', vol: 0.3, to: Math.max(45, p * 0.28) }),
      crow: (p) => { const b = Math.max(50, p * 0.32); for (let i = 0; i < 4; i++) tone(b, 0.28, { type: 'sine', vol: 0.35, at: i * 0.34, to: b * 0.85 }); noise(1.4, { freq: 180, vol: 0.12 }); }, // drumming
      squawk: (p) => { noise(0.4, { freq: 3000, vol: 0.18, high: true }); tone(Math.max(60, p * 0.4), 0.25, { type: 'sawtooth', vol: 0.12, to: 50 }); },
    },
    whistle: {
      cluck: (p) => tone(p * 2, 0.12, { type: 'sine', vol: 0.12, to: p * 2.6 }),
      crow: (p) => { const n = 4 + Math.floor(Math.random() * 3); for (let i = 0; i < n; i++) tone(p * 2, 0.16, { type: 'sine', vol: 0.12, at: i * 0.24, to: p * 3 }); },
      squawk: (p) => { tone(p * 2.5, 0.2, { type: 'sine', vol: 0.12, to: p * 1.8 }); noise(0.2, { freq: 1500, vol: 0.12 }); },
    },
    kee: {
      cluck: (p) => tone(p * 2.2, 0.06, { type: 'sawtooth', vol: 0.08, to: p * 1.8 }),
      crow: (p) => { const n = 4 + Math.floor(Math.random() * 4); for (let i = 0; i < n; i++) tone(p * 2.3, 0.09, { type: 'sawtooth', vol: 0.1, at: i * 0.13, to: p * 1.9 }); }, // kee-kee-kee
      squawk: (p) => { for (let i = 0; i < 3; i++) tone(p * 2.6, 0.12, { type: 'sawtooth', vol: 0.11, at: i * 0.14, to: p * 1.6 }); },
    },
    scream: {
      cluck: (p) => { for (let i = 0; i < 3; i++) tone(p * rnd(1.8, 2.2), 0.05, { type: 'triangle', vol: 0.1, at: i * 0.08 }); },
      crow: (p) => tone(p * 2.6, 0.9, { type: 'sawtooth', vol: 0.11, to: p * 1.5, vib: [11, 0.04] }),
      squawk: (p) => tone(p * 2.8, 0.4, { type: 'sawtooth', vol: 0.12, to: p * 1.6 }),
    },
    wail: { // the harpy: a long, thin, rising and falling wail
      cluck: (p) => { tone(p * 1.6, 0.08, { type: 'sine', vol: 0.1, to: p * 1.9 }); tone(p * 1.7, 0.08, { type: 'sine', vol: 0.08, at: 0.12, to: p * 2 }); },
      crow: (p) => { tone(p * 1.5, 0.5, { type: 'sine', vol: 0.15, to: p * 2.3, attack: 0.08 }); tone(p * 2.3, 0.9, { type: 'sine', vol: 0.15, at: 0.5, to: p * 1.6, vib: [5, 0.02] }); },
      squawk: (p) => { tone(p * 2.4, 0.45, { type: 'triangle', vol: 0.14, to: p * 1.7, vib: [8, 0.03] }); noise(0.2, { freq: 2600, vol: 0.06, band: true }); },
    },
    croak: {
      cluck: (p) => tone(Math.max(80, p * 0.6), 0.12, { type: 'sawtooth', vol: 0.12, to: Math.max(70, p * 0.5) }),
      crow: (p) => { tone(Math.max(90, p * 0.7), 0.45, { type: 'sawtooth', vol: 0.14, to: Math.max(70, p * 0.5), vib: [30, 0.08] }); noise(0.4, { freq: 900, vol: 0.1, band: true }); }, // fraaank
      squawk: (p) => { tone(p * 0.9, 0.3, { type: 'sawtooth', vol: 0.15, to: p * 0.6 }); noise(0.3, { freq: 1400, vol: 0.12, band: true }); },
    },
    frog: { // the toucan's croaking
      cluck: (p) => tone(Math.max(90, p * 0.5), 0.08, { type: 'sawtooth', vol: 0.12, vib: [40, 0.1] }),
      crow: (p) => { for (let i = 0; i < 5; i++) tone(Math.max(90, p * 0.55), 0.12, { type: 'sawtooth', vol: 0.12, at: i * 0.2, vib: [40, 0.12] }); },
      squawk: (p) => tone(p * 0.9, 0.25, { type: 'sawtooth', vol: 0.14, to: p * 0.6, vib: [30, 0.1] }),
    },
    hiss: { // vultures and condors: no song, just hisses and grunts
      cluck: (p) => tone(Math.max(60, p * 0.4), 0.12, { type: 'sawtooth', vol: 0.08, to: 50, bp: [400, 2] }),
      crow: (p) => { noise(0.7, { freq: 3800, vol: 0.2, high: true }); for (let i = 0; i < 3; i++) tone(Math.max(60, p * 0.45), 0.1, { type: 'sawtooth', vol: 0.08, at: 0.75 + i * 0.16, to: 50, bp: [400, 2] }); },
      squawk: () => noise(0.5, { freq: 4500, vol: 0.24, high: true }),
    },
    hoot: {
      cluck: (p) => tone(Math.max(140, p * 0.55), 0.3, { type: 'sine', vol: 0.18, attack: 0.05 }),
      crow: (p) => { const h = Math.max(140, p * 0.55); tone(h, 0.35, { type: 'sine', vol: 0.18, attack: 0.05 }); tone(h, 0.18, { type: 'sine', vol: 0.15, at: 0.6, attack: 0.03 }); tone(h, 0.18, { type: 'sine', vol: 0.15, at: 0.85, attack: 0.03 }); tone(h * 0.95, 0.5, { type: 'sine', vol: 0.17, at: 1.1, attack: 0.05 }); },
      squawk: () => noise(0.8, { freq: 2600, vol: 0.2, band: true, q: 1.2 }), // a screech
    },
    grunt: {
      cluck: (p) => tone(Math.max(60, p * 0.4), 0.1, { type: 'sawtooth', vol: 0.1, to: 50, bp: [300, 2] }),
      crow: (p) => { for (let i = 0; i < 3; i++) tone(Math.max(60, p * 0.42), 0.14, { type: 'sawtooth', vol: 0.11, at: i * 0.22, to: 50, bp: [300, 2] }); noise(0.05, { freq: 2000, vol: 0.2, band: true, at: 0.75 }); },
      squawk: () => { for (let i = 0; i < 4; i++) noise(0.04, { freq: 1800, vol: 0.25, band: true, at: i * 0.07 }); }, // a bill clap
    },
    laugh: {
      cluck: (p) => tone(p * 1.4, 0.14, { type: 'sawtooth', vol: 0.1, to: p * 1.1, bp: [p * 3, 2] }), // kyow
      crow: (p) => { for (let i = 0; i < 6; i++) tone(p * (1.2 + 0.08 * Math.min(i, 3) - 0.06 * Math.max(0, i - 3)), 0.11, { type: 'sawtooth', vol: 0.11, at: i * 0.15, to: p * 1.0, bp: [p * 3, 2] }); },
      squawk: (p) => { tone(p * 1.8, 0.1, { type: 'sawtooth', vol: 0.12, to: p * 1.2 }); tone(p * 1.8, 0.1, { type: 'sawtooth', vol: 0.12, at: 0.12, to: p * 1.2 }); },
    },
    bray: { // the penguin's donkey bray
      cluck: (p) => tone(p * 0.8, 0.1, { type: 'sawtooth', vol: 0.1, to: p * 0.7 }),
      crow: (p) => { for (let i = 0; i < 6; i++) tone(p * (i % 2 ? 1.4 : 0.75) * (1 + i * 0.04), 0.16, { type: 'sawtooth', vol: 0.12, at: i * 0.18, to: p * (i % 2 ? 1.1 : 0.9) }); },
      squawk: (p) => tone(p * 1.3, 0.3, { type: 'sawtooth', vol: 0.13, to: p * 0.8 }),
    },
    parrot: {
      cluck: (p) => { if (Math.random() < 0.5) { tone(p * 1.6, 0.18, { type: 'sine', vol: 0.12, to: p * 2.6 }); tone(p * 1.8, 0.3, { type: 'sine', vol: 0.12, at: 0.26, to: p * 2.8 }); } else { tone(p * 1.3, 0.12, { type: 'square', vol: 0.07 }); tone(p * 1.7, 0.18, { type: 'square', vol: 0.07, at: 0.14 }); } }, // a wolf whistle, or "hel-lo"
      crow: (p) => { for (let i = 0; i < 5; i++) tone(p * pick([1.5, 1.8, 2, 2.25, 2.7]), 0.12, { type: 'sine', vol: 0.12, at: i * 0.14 }); },
      squawk: (p) => { tone(p * 2, 0.35, { type: 'sawtooth', vol: 0.12, to: p * 1.4 }); noise(0.35, { freq: 2800, vol: 0.14, band: true }); },
    },
    caw: {
      cluck: (p) => { for (let i = 0; i < 2; i++) tone(p * 0.6, 0.06, { type: 'square', vol: 0.08, at: i * 0.08, bp: [800, 2] }); }, // knocks
      crow: (p) => { const n = 2 + Math.floor(Math.random() * 3); for (let i = 0; i < n; i++) { tone(p * 0.9, 0.2, { type: 'sawtooth', vol: 0.12, at: i * 0.3, to: p * 0.7 }); noise(0.2, { freq: 1300, vol: 0.08, band: true, at: i * 0.3 }); } },
      squawk: (p) => { tone(p * 1.1, 0.3, { type: 'sawtooth', vol: 0.14, to: p * 0.7 }); noise(0.3, { freq: 1500, vol: 0.12, band: true }); },
    },
    chirp: {
      cluck: (p) => { const n = 2 + Math.floor(Math.random() * 3); for (let i = 0; i < n; i++) tone(p * rnd(1.8, 2.6), 0.03, { type: 'sine', vol: 0.1, at: i * 0.06 }); },
      crow: (p) => { for (let i = 0; i < 10; i++) tone(p * rnd(2, 3), 0.035, { type: 'sine', vol: 0.1, at: i * 0.05, to: p * 2.5 }); }, // a trill
      squawk: (p) => tone(p * 2.6, 0.2, { type: 'square', vol: 0.07, vib: [45, 0.1] }),
    },
    coo: {
      cluck: (p) => tone(Math.max(120, p * 0.6), 0.2, { type: 'sine', vol: 0.15, to: Math.max(110, p * 0.5), attack: 0.04 }),
      crow: (p) => { const c = Math.max(120, p * 0.65); for (let i = 0; i < 5; i++) tone(c * (1 - i * 0.05), 0.22, { type: 'sine', vol: 0.15, at: i * 0.3, to: c * (0.9 - i * 0.05), attack: 0.04 }); },
      squawk: (p) => tone(p, 0.2, { type: 'triangle', vol: 0.12, to: p * 0.6 }),
    },
    roar: { // things that should have stayed fossils
      cluck: (p) => tone(Math.max(60, p * 0.4), 0.3, { type: 'sawtooth', vol: 0.1, to: 50, vib: [18, 0.08], bp: [500, 1.5] }),
      crow: (p) => { tone(Math.max(70, p * 0.5), 0.9, { type: 'sawtooth', vol: 0.14, to: 55, vib: [14, 0.1] }); noise(0.9, { freq: 600, vol: 0.12 }); tone(p * 2, 0.3, { type: 'sawtooth', vol: 0.08, at: 0.7, to: p * 1.3 }); },
      squawk: (p) => { tone(p * 2.4, 0.3, { type: 'sawtooth', vol: 0.12, to: p * 1.5 }); noise(0.3, { freq: 2000, vol: 0.1, band: true }); },
    },
    churr: { // the nightjar's long mechanical trill
      cluck: (p) => tone(p * 1.4, 0.1, { type: 'sine', vol: 0.12, to: p * 1.8 }),
      crow: (p) => tone(p * 1.2, 1.6 + Math.random(), { type: 'square', vol: 0.06, vib: [38, 0.06], bp: [p * 2.4, 3], attack: 0.1 }),
      squawk: (p) => { tone(p * 1.8, 0.12, { type: 'sine', vol: 0.12, to: p * 1.2 }); noise(0.3, { freq: 3000, vol: 0.12, high: true, at: 0.1 }); },
    },
    lament: { // the potoo's falling, crying notes
      cluck: (p) => tone(p * 0.9, 0.3, { type: 'sine', vol: 0.15, to: p * 0.75, attack: 0.05 }),
      crow: (p) => { for (let i = 0; i < 5; i++) tone(p * (1.3 - i * 0.12), 0.4, { type: 'sine', vol: 0.15, at: i * 0.48, to: p * (1.2 - i * 0.12), attack: 0.06, vib: [5, 0.015] }); },
      squawk: (p) => { tone(p * 1.4, 0.35, { type: 'triangle', vol: 0.14, to: p * 0.8 }); noise(0.25, { freq: 900, vol: 0.08 }); },
    },
    curlee: { // the thick-knee's wild wailing whistle
      cluck: (p) => tone(p * 1.6, 0.14, { type: 'sine', vol: 0.12, to: p * 2 }),
      crow: (p) => { for (let i = 0; i < 4; i++) { tone(p * 1.5, 0.22, { type: 'sine', vol: 0.13, at: i * 0.42, to: p * 2.3 }); tone(p * 2.3, 0.18, { type: 'sine', vol: 0.11, at: i * 0.42 + 0.22, to: p * 1.7 }); } },
      squawk: (p) => tone(p * 2.4, 0.3, { type: 'triangle', vol: 0.13, to: p * 1.4 }),
    },
    clatter: { // the shoebill does not sing: it clatters its huge bill like a machine gun
      cluck: () => { for (let i = 0; i < 3; i++) noise(0.03, { freq: 1500, vol: 0.25, band: true, at: i * 0.06 }); },
      crow: () => { for (let i = 0; i < 18; i++) noise(0.03, { freq: 1300 + (i % 3) * 200, vol: 0.28, band: true, at: i * 0.055 }); },
      squawk: (p) => { tone(Math.max(60, p * 0.4), 0.3, { type: 'sawtooth', vol: 0.1, to: 50, bp: [350, 2] }); for (let i = 0; i < 6; i++) noise(0.03, { freq: 1500, vol: 0.25, band: true, at: 0.3 + i * 0.05 }); },
    },
    human: { // two formants make a vowel: "hm?", "woo-hoo!", "ow!"
      cluck: (p) => tone(rnd(110, 160), 0.25, { type: 'sawtooth', vol: 0.5, to: rnd(150, 200), bp: [300, 6], bp2: [900, 8] }),
      crow: () => { const f = rnd(140, 220); tone(f, 0.25, { type: 'sawtooth', vol: 0.5, to: f * 1.4, bp: [350, 6], bp2: [800, 8] }); tone(f * 1.2, 0.4, { type: 'sawtooth', vol: 0.5, at: 0.3, to: f * 1.8, bp: [350, 6], bp2: [800, 8] }); },
      squawk: () => { const f = rnd(180, 300); tone(f * 1.5, 0.3, { type: 'sawtooth', vol: 0.55, to: f, bp: [750, 6], bp2: [1200, 8] }); },
    },
  };
  // A creature's voice. kind: 'cluck' | 'crow' | 'squawk'. v = phenotype.voice { pitch, rasp, len, kind, kind2 }.
  // No two calls are quite the same: pitch and timing wander a little every time.
  audio.voice = function (v, kind) {
    if (audio.sfx <= 0 || !ensure()) return;
    const k = v.kind2 && Math.random() < 0.5 ? v.kind2 : v.kind;
    const calls = CALLS[STYLE[k]] || CALLS.fowl, f = calls[kind] || calls.cluck;
    f(v.pitch * rnd(0.94, 1.06), v.rasp > 0.55 ? 'sawtooth' : 'square', v.rasp, v.len);
  };
  audio.STYLE = STYLE;

  // ---- music: the recorded tracks, played by music.js (audio.setTune comes from there)

  RB.audio = audio;
})();
