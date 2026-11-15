// audio.js — everything is synthesised with WebAudio: effects, bird voices shaped by their voice
// genes, and a small generative tune per scene. Nothing loads from disk.
(function () {
  'use strict';
  const RB = globalThis.RB;
  const audio = { sfx: 0.8, music: 0.5, tune: null };
  let ac = null, sfxG = null, musG = null, noiseBuf = null, timer = null, step = 0, nextT = 0;

  function ensure() {
    if (ac) { if (ac.state === 'suspended') ac.resume(); return true; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    try { ac = new AC(); } catch (e) { return false; }
    sfxG = ac.createGain(); sfxG.gain.value = audio.sfx * 0.5; sfxG.connect(ac.destination);
    musG = ac.createGain(); musG.gain.value = audio.music * 0.16; musG.connect(ac.destination);
    noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return true;
  }
  audio.unlock = ensure;
  audio.setVolumes = function (sfx, music) { audio.sfx = sfx; audio.music = music; if (ac) { sfxG.gain.value = sfx * 0.5; musG.gain.value = music * 0.16; } };

  // One note. o: { type, vol, to (slide to this frequency), at (delay), out (gain node), attack }
  function tone(f, dur, o) {
    o = o || {};
    const t = ac.currentTime + (o.at || 0), osc = ac.createOscillator(), g = ac.createGain();
    osc.type = o.type || 'triangle';
    osc.frequency.setValueAtTime(Math.max(20, f), t);
    if (o.to) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.to), t + dur);
    const v = o.vol === undefined ? 0.3 : o.vol;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + (o.attack || 0.008)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g); g.connect(o.out || sfxG);
    osc.start(t); osc.stop(t + dur + 0.02);
  }
  function noise(dur, o) {
    o = o || {};
    const t = ac.currentTime + (o.at || 0), src = ac.createBufferSource(), g = ac.createGain(), f = ac.createBiquadFilter();
    src.buffer = noiseBuf; src.loop = true;
    f.type = o.band ? 'bandpass' : 'lowpass'; f.frequency.setValueAtTime(o.freq || 1200, t); f.Q.value = o.q || 0.8;
    if (o.to) f.frequency.exponentialRampToValueAtTime(o.to, t + dur);
    const v = o.vol === undefined ? 0.3 : o.vol;
    g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(sfxG);
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

  // A creature's voice. kind: 'cluck' | 'crow' | 'squawk'. v = phenotype.voice { pitch, rasp, len }
  audio.voice = function (v, kind) {
    if (audio.sfx <= 0 || !ensure()) return;
    const p = v.pitch, type = v.rasp > 0.55 ? 'sawtooth' : 'square', vol = 0.1;
    if (kind === 'crow') {
      const n = 3 + Math.round(v.len * 2), base = 0.11 + 0.05 * v.len;
      for (let i = 0; i < n; i++) { const last = i === n - 1; tone(p * (last ? 1.5 : 1.15 + 0.1 * (i % 2)), last ? base * 3.2 : base, { type, vol, at: i * base * 1.15, to: last ? p * 0.9 : p * 1.3 }); }
    } else if (kind === 'squawk') {
      tone(p * 1.6, 0.16 + 0.1 * v.len, { type: 'sawtooth', vol: vol * 1.2, to: p * 0.8 }); noise(0.12, { freq: p * 3, vol: 0.1 * (0.4 + v.rasp), band: true });
    } else {
      tone(p * 0.9, 0.05 + 0.04 * v.len, { type, vol, to: p * 1.25 });
      if (v.rasp > 0.4) noise(0.04, { freq: p * 2.5, vol: 0.05, band: true });
    }
  };

  // ---- music: a looping pattern of plucks over a bass, in a pentatonic scale
  const TUNES = {
    farm: { bpm: 96, root: 196, scale: [0, 2, 4, 7, 9], lead: [0, -1, 2, -1, 4, 2, -1, 3, 0, -1, 2, 4, -1, 3, 2, -1], bass: [0, -1, -1, 0, -1, -1, 3, -1, 0, -1, -1, 0, -1, 2, -1, -1] },
    map: { bpm: 112, root: 220, scale: [0, 2, 4, 7, 9], lead: [4, 2, 0, -1, 2, 4, -1, 5, 4, -1, 2, 0, -1, 2, 3, -1], bass: [0, -1, 0, -1, 2, -1, 2, -1, 3, -1, 3, -1, 2, -1, 0, -1] },
    fight: { bpm: 138, root: 147, scale: [0, 3, 5, 7, 10], lead: [0, 0, 3, -1, 0, 0, 4, -1, 0, 0, 3, 2, -1, 4, 3, 2], bass: [0, -1, 0, 0, -1, 0, -1, 0, 2, -1, 2, 2, -1, 3, -1, 2] },
    lab: { bpm: 84, root: 261, scale: [0, 2, 3, 7, 8], lead: [0, -1, 4, -1, 2, -1, 3, -1, 1, -1, 4, -1, 2, -1, 0, -1], bass: [0, -1, -1, -1, 2, -1, -1, -1, 1, -1, -1, -1, 0, -1, -1, -1] },
  };
  const noteF = (tune, deg, oct) => tune.root * Math.pow(2, (tune.scale[((deg % 5) + 5) % 5] + 12 * (Math.floor(deg / 5) + (oct || 0))) / 12);
  function schedule() {
    const tune = TUNES[audio.tune];
    if (!tune || !ac || audio.music <= 0) return;
    const spb = 60 / tune.bpm / 2;
    while (nextT < ac.currentTime + 0.25) {
      const i = step % 16, at = Math.max(0, nextT - ac.currentTime);
      if (tune.lead[i] >= 0) tone(noteF(tune, tune.lead[i], 1), spb * 1.6, { type: 'triangle', vol: 0.5, at, out: musG });
      if (tune.bass[i] >= 0) tone(noteF(tune, tune.bass[i], -1), spb * 1.9, { type: 'sine', vol: 0.8, at, out: musG });
      step++; nextT += spb;
    }
  }
  audio.setTune = function (name) {
    if (audio.tune === name) return;
    audio.tune = name; step = 0;
    if (ac) nextT = ac.currentTime + 0.1;
    if (!timer) timer = setInterval(() => { if (ac && ac.state === 'running') schedule(); }, 90);
  };

  RB.audio = audio;
})();
