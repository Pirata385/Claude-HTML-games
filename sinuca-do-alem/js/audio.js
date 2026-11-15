/* Sinuca do Além — som sintetizado (Web Audio): batidas, caçapas, efeitos e uma bossa de boteco generativa. */
(function (g) {
  'use strict';
  const SA = (g.SA = g.SA || {});
  const A = (SA.Audio = { vol: { master: 0.8, sfx: 0.9, music: 0.5 } });
  let ctx = null, master = null, sfx = null, music = null, noiseBuf = null, lastHit = 0;

  A.init = function () {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = g.AudioContext || g.webkitAudioContext;
    if (!AC) return;
    try { ctx = new AC(); } catch (e) { return; }
    master = ctx.createGain(); sfx = ctx.createGain(); music = ctx.createGain();
    const comp = ctx.createDynamicsCompressor();
    sfx.connect(master); music.connect(master); master.connect(comp); comp.connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    A.applyVolume();
    startMusic();
  };
  A.applyVolume = function () {
    if (!ctx) return;
    master.gain.value = A.vol.master; sfx.gain.value = A.vol.sfx; music.gain.value = A.vol.music * 0.5;
  };
  A.suspend = function (on) { if (ctx) { if (on) ctx.suspend(); else ctx.resume(); } };

  function tone(freq, dur, type, vol, opts) {
    if (!ctx) return;
    opts = opts || {};
    const t = ctx.currentTime + (opts.delay || 0);
    const o = ctx.createOscillator(), gn = ctx.createGain();
    o.type = type || 'sine'; o.frequency.setValueAtTime(freq, t);
    if (opts.to) o.frequency.exponentialRampToValueAtTime(Math.max(20, opts.to), t + dur);
    gn.gain.setValueAtTime(0.0001, t);
    gn.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t + (opts.attack || 0.004));
    gn.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(gn); gn.connect(opts.out || sfx);
    o.start(t); o.stop(t + dur + 0.03);
  }
  function noise(dur, vol, freq, q, opts) {
    if (!ctx) return;
    opts = opts || {};
    const t = ctx.currentTime + (opts.delay || 0);
    const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), gn = ctx.createGain();
    s.buffer = noiseBuf; s.loop = true;
    f.type = opts.type || 'bandpass'; f.frequency.setValueAtTime(freq, t); f.Q.value = q || 1;
    if (opts.to) f.frequency.exponentialRampToValueAtTime(opts.to, t + dur);
    gn.gain.setValueAtTime(Math.max(0.0002, vol), t);
    gn.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(gn); gn.connect(opts.out || sfx);
    s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.03);
  }

  A.clack = function (v) {
    if (!ctx) return;
    const now = ctx.currentTime;
    if (now - lastHit < 0.012) return;
    lastHit = now;
    const k = Math.min(1, v / 1400), vol = 0.05 + k * 0.5;
    tone(2100 + Math.random() * 500, 0.035 + k * 0.03, 'sine', vol * 0.7);
    tone(1150 + Math.random() * 200, 0.05, 'triangle', vol * 0.5);
    noise(0.025, vol * 0.6, 3800, 0.8);
  };
  A.cushion = function (v) { const k = Math.min(1, v / 1400); noise(0.09, 0.06 + k * 0.4, 240, 0.9, { type: 'lowpass' }); tone(110, 0.07, 'sine', 0.05 + k * 0.25, { to: 60 }); };
  A.cue = function (p) { tone(820, 0.05, 'triangle', 0.2 + p * 0.4, { to: 300 }); noise(0.04, 0.2 + p * 0.3, 2200, 0.7); };
  A.pocket = function () {
    tone(150, 0.2, 'sine', 0.5, { to: 55 });
    for (let i = 0; i < 4; i++) noise(0.03, 0.18 - i * 0.03, 900 + Math.random() * 500, 2, { delay: 0.05 + i * 0.045 });
  };
  A.bumper = function () { tone(480, 0.12, 'square', 0.16, { to: 1100 }); tone(960, 0.1, 'sine', 0.2, { to: 1800 }); };
  A.portal = function () { tone(300, 0.3, 'sine', 0.22, { to: 1400 }); tone(1400, 0.3, 'sine', 0.12, { to: 300, delay: 0.05 }); };
  A.boom = function () { noise(0.6, 0.9, 900, 0.5, { type: 'lowpass', to: 60 }); tone(90, 0.45, 'sine', 0.8, { to: 30 }); };
  A.zap = function () { noise(0.2, 0.5, 5200, 3, { to: 900 }); tone(1800, 0.15, 'sawtooth', 0.14, { to: 200 }); };
  A.fire = function () { noise(0.3, 0.2, 700, 0.6, { to: 2400 }); };
  A.ui = function () { tone(660, 0.05, 'triangle', 0.14); };
  A.tick = function (i) { tone(520 + (i || 0) * 40, 0.045, 'triangle', 0.12); };
  A.coin = function () { tone(1320, 0.07, 'square', 0.1); tone(1760, 0.16, 'square', 0.1, { delay: 0.06 }); };
  A.buy = function () { tone(520, 0.08, 'triangle', 0.2); tone(780, 0.14, 'triangle', 0.2, { delay: 0.07 }); };
  A.nope = function () { tone(180, 0.16, 'sawtooth', 0.12, { to: 120 }); };
  A.foul = function () { tone(320, 0.2, 'sawtooth', 0.15, { to: 150 }); tone(240, 0.3, 'sawtooth', 0.15, { to: 90, delay: 0.15 }); };
  A.bonus = function (n) { tone(660 * Math.pow(1.122, Math.min(12, n || 0)), 0.12, 'triangle', 0.2); };
  A.win = function () { [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.25, 'triangle', 0.25, { delay: i * 0.09 })); };
  A.lose = function () { [392, 349, 294, 220].forEach((f, i) => tone(f, 0.4, 'sawtooth', 0.14, { delay: i * 0.2 })); };
  A.quake = function () { noise(0.9, 0.7, 160, 0.6, { type: 'lowpass' }); tone(55, 0.8, 'sine', 0.6, { to: 35 }); };
  A.rewind = function () { tone(200, 0.5, 'sine', 0.25, { to: 1600 }); noise(0.5, 0.15, 500, 2, { to: 4000 }); };

  // ---------- Música: bossa lenta gerada na hora ----------
  let musicOn = false, timer = null, nextT = 0, step = 0, tempo = 96, keyShift = 0;
  const PROG = [[2, 5, 9, 12], [7, 11, 14, 17], [0, 4, 7, 11], [9, 13, 16, 19]]; // Dm7 G7 Cmaj7 A7
  const BASS = [2, 7, 0, 9];
  const BOSSA = [1, 0, 0, 1, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 0, 0];
  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
  function sched() {
    if (!ctx || !musicOn) return;
    const spb = 60 / tempo / 4;
    while (nextT < ctx.currentTime + 0.25) {
      const bar = Math.floor(step / 16) % 4, s = step % 16, d = nextT - ctx.currentTime;
      const ch = PROG[bar];
      if (s === 0 || s === 6 || s === 8 || s === 14) tone(mtof(36 + keyShift + BASS[bar] + (s === 6 || s === 14 ? 7 : 0)), spb * 3.2, 'triangle', 0.35, { delay: d, out: music, attack: 0.01 });
      if (BOSSA[s]) for (let i = 0; i < ch.length; i++) tone(mtof(60 + keyShift + ch[i]), spb * 2.2, 'sine', 0.07, { delay: d + i * 0.006, out: music, attack: 0.012 });
      if (s % 2 === 0) noise(0.03, s % 4 === 2 ? 0.07 : 0.035, 7000, 1.5, { delay: d, out: music, type: 'highpass' });
      if (s === 4 || s === 12) noise(0.05, 0.05, 1800, 3, { delay: d, out: music });
      if (bar % 2 === 1 && s === 10 && Math.random() < 0.6) tone(mtof(72 + keyShift + ch[(Math.random() * 4) | 0]), spb * 5, 'triangle', 0.08, { delay: d, out: music, attack: 0.02 });
      nextT += spb; step++;
    }
  }
  function startMusic() {
    if (musicOn && ctx && !timer) { nextT = ctx.currentTime + 0.1; step = 0; timer = setInterval(sched, 80); }
  }
  A.music = function (on, t, shift) {
    if (t) tempo = t;
    if (shift != null) keyShift = shift;
    musicOn = on;
    if (!on && timer) { clearInterval(timer); timer = null; }
    startMusic();
  };
})(typeof window !== 'undefined' ? window : globalThis);
