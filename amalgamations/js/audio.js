// Amalgamations — synthesised sound (WebAudio): effects per action and element, and a soft generative
// ambient track that follows the biome and time of day. Starts on the first user gesture.
(function (root) {
  'use strict';
  const AM = root.AM || (root.AM = {});
  const A = { ctx: null, master: null, sfxGain: null, musicGain: null, enabled: true, last: {}, noiseBuf: null, music: { t: 0, step: 0, mood: 0 } };

  A.init = function () {
    if (A.ctx) { if (A.ctx.state === 'suspended') A.ctx.resume(); return; }
    const Ctx = root.AudioContext || root.webkitAudioContext;
    if (!Ctx) { A.enabled = false; return; }
    A.ctx = new Ctx();
    A.master = A.ctx.createGain(); A.master.connect(A.ctx.destination);
    A.sfxGain = A.ctx.createGain(); A.sfxGain.connect(A.master);
    A.musicGain = A.ctx.createGain(); A.musicGain.connect(A.master);
    const n = A.ctx.sampleRate;
    A.noiseBuf = A.ctx.createBuffer(1, n, n);
    const d = A.noiseBuf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    A.setVolumes(AM.settings || {});
  };
  A.setVolumes = function (s) {
    if (!A.ctx) return;
    A.master.gain.value = (s.volMaster == null ? 0.8 : s.volMaster);
    A.sfxGain.gain.value = (s.volSfx == null ? 0.8 : s.volSfx) * 0.6;
    A.musicGain.gain.value = (s.volMusic == null ? 0.5 : s.volMusic) * 0.22;
  };

  function tone(type, f0, f1, dur, vol, when, dest) {
    const c = A.ctx, t = c.currentTime + (when || 0);
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t);
    if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest || A.sfxGain); o.start(t); o.stop(t + dur + 0.02);
  }
  function noise(dur, vol, freq, q, type, when, sweep) {
    const c = A.ctx, t = c.currentTime + (when || 0);
    const s = c.createBufferSource(); s.buffer = A.noiseBuf;
    const f = c.createBiquadFilter(); f.type = type || 'bandpass'; f.frequency.setValueAtTime(freq || 1200, t); f.Q.value = q || 1;
    if (sweep) f.frequency.exponentialRampToValueAtTime(sweep, t + dur);
    const g = c.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(A.sfxGain); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
  }
  const SFX = {
    hit: () => { noise(0.08, 0.35, 900, 1.2); tone('square', 180, 90, 0.07, 0.08); },
    crit: () => { noise(0.12, 0.45, 1400, 1); tone('sawtooth', 420, 120, 0.12, 0.12); },
    hurt: () => { tone('square', 220, 110, 0.15, 0.14); noise(0.1, 0.25, 500, 1); },
    swing: () => noise(0.12, 0.18, 1800, 0.8, 'bandpass', 0, 600),
    swingHit: () => { noise(0.1, 0.25, 1600, 0.8, 'bandpass', 0, 500); },
    shoot: () => { noise(0.08, 0.2, 2500, 2, 'highpass'); tone('triangle', 700, 300, 0.08, 0.06); },
    zap: () => tone('sawtooth', 900, 300, 0.12, 0.08),
    enemyShoot: () => tone('triangle', 500, 250, 0.12, 0.06),
    enemySwing: () => noise(0.1, 0.12, 1200, 0.8, 'bandpass', 0, 400),
    dodge: () => noise(0.18, 0.2, 800, 0.7, 'bandpass', 0, 2400),
    die: () => { tone('square', 300, 60, 0.3, 0.1); noise(0.25, 0.2, 600, 0.8); },
    bossdie: () => { tone('sawtooth', 200, 30, 1.2, 0.18); noise(1.0, 0.35, 300, 0.6); },
    levelup: () => { [523, 659, 784, 1046].forEach((f, i) => tone('triangle', f, f, 0.25, 0.12, i * 0.09)); },
    quest: () => { [659, 880, 1175].forEach((f, i) => tone('triangle', f, f, 0.22, 0.1, i * 0.08)); },
    pickup: () => tone('triangle', 880, 1320, 0.07, 0.06),
    rare: () => { tone('triangle', 988, 1480, 0.18, 0.1); tone('sine', 1480, 1976, 0.2, 0.06, 0.08); },
    coin: () => { tone('square', 1320, 1320, 0.05, 0.04); tone('square', 1760, 1760, 0.08, 0.04, 0.05); },
    chest: () => { tone('triangle', 330, 660, 0.25, 0.1); [784, 988, 1175].forEach((f, i) => tone('sine', f, f, 0.2, 0.06, 0.15 + i * 0.07)); },
    mine: () => { noise(0.06, 0.3, 2400, 3); tone('square', 600, 500, 0.04, 0.05); },
    ui: () => tone('triangle', 660, 660, 0.04, 0.05),
    error: () => tone('square', 200, 160, 0.12, 0.06),
    equip: () => { noise(0.08, 0.2, 3000, 2); tone('triangle', 440, 660, 0.08, 0.06); },
    salvage: () => noise(0.2, 0.25, 700, 1, 'bandpass', 0, 200),
    drink: () => { tone('sine', 400, 800, 0.15, 0.08); tone('sine', 500, 900, 0.12, 0.06, 0.1); },
    fuse: () => { tone('sine', 220, 880, 0.6, 0.12); tone('triangle', 330, 1320, 0.6, 0.08, 0.1); },
    skill: () => { tone('triangle', 523, 784, 0.18, 0.1); },
    door: () => { noise(0.8, 0.3, 200, 0.6, 'lowpass'); tone('sawtooth', 60, 40, 0.8, 0.08); },
    teleport: () => { tone('sine', 300, 1600, 0.5, 0.1); noise(0.5, 0.15, 3000, 1, 'highpass'); },
    heal: () => { [523, 659, 784].forEach((f, i) => tone('sine', f, f * 1.01, 0.3, 0.06, i * 0.06)); },
    roar: () => { noise(0.5, 0.35, 300, 0.8, 'bandpass', 0, 120); tone('sawtooth', 120, 70, 0.5, 0.12); },
    thunder: () => { noise(0.4, 0.35, 400, 0.5, 'lowpass', 0, 80); },
    boom: () => { noise(0.5, 0.45, 300, 0.6, 'lowpass', 0, 60); tone('sine', 90, 40, 0.4, 0.2); },
    cast_fire: () => noise(0.3, 0.3, 700, 0.8, 'bandpass', 0, 2000),
    cast_frost: () => { tone('sine', 1800, 2400, 0.2, 0.05); noise(0.25, 0.15, 5000, 2, 'highpass'); },
    cast_storm: () => { noise(0.2, 0.3, 3000, 1.5, 'highpass'); tone('sawtooth', 1200, 200, 0.15, 0.06); },
    cast_venom: () => noise(0.25, 0.25, 500, 3, 'bandpass', 0, 250),
    cast_earth: () => { noise(0.35, 0.35, 180, 0.7, 'lowpass'); tone('sine', 80, 50, 0.3, 0.15); },
    cast_water: () => noise(0.4, 0.25, 900, 0.6, 'bandpass', 0, 300),
    cast_wind: () => noise(0.35, 0.22, 600, 0.6, 'bandpass', 0, 2600),
    cast_life: () => { tone('sine', 660, 990, 0.3, 0.07); tone('sine', 880, 1320, 0.3, 0.05, 0.05); },
    cast_shadow: () => { tone('sawtooth', 200, 80, 0.35, 0.08); noise(0.3, 0.12, 300, 1, 'lowpass'); },
    cast_light: () => { tone('sine', 1320, 1760, 0.3, 0.07); tone('triangle', 1760, 2200, 0.25, 0.04, 0.05); },
    cast_arcane: () => { tone('triangle', 600, 1200, 0.25, 0.07); tone('sine', 900, 1800, 0.25, 0.05, 0.06); },
    cast_metal: () => { tone('square', 1800, 1400, 0.12, 0.05); noise(0.1, 0.2, 4000, 3); },
  };
  A.sfx = function (name) {
    if (!A.ctx || !A.enabled || A.ctx.state !== 'running') return;
    const now = A.ctx.currentTime;
    if (A.last[name] && now - A.last[name] < 0.045) return;
    A.last[name] = now;
    const fn = SFX[name];
    if (fn) try { fn(); } catch (e) { /* ignore audio errors */ }
  };

  // Generative ambient: a pad chord plus a slow pentatonic melody; minor at night and in dark biomes.
  const SCALES = { major: [0, 2, 4, 7, 9], minor: [0, 3, 5, 7, 10] };
  A.updateMusic = function (dt, biome, night, combat) {
    if (!A.ctx || A.ctx.state !== 'running' || !A.musicGain || A.musicGain.gain.value < 0.001) return;
    const m = A.music;
    m.t -= dt;
    if (m.t > 0) return;
    const minor = night || biome === 'volcanic' || biome === 'swamp' || biome === 'grove';
    const scale = minor ? SCALES.minor : SCALES.major;
    const root = { meadow: 57, forest: 55, desert: 52, tundra: 60, swamp: 50, grove: 53, crystal: 62, volcanic: 45, interior: 48 }[biome] || 57;
    const beat = combat ? 0.32 : 0.55;
    m.t = beat;
    m.step++;
    const f = (n) => 440 * Math.pow(2, (n - 69) / 12);
    if (m.step % 16 === 1) {
      for (const k of [0, 2, 4]) {
        const n = root - 12 + scale[k];
        const c = A.ctx, t = c.currentTime;
        const o = c.createOscillator(), g = c.createGain();
        o.type = 'sine'; o.frequency.value = f(n);
        g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.18, t + 1.5); g.gain.linearRampToValueAtTime(0.0001, t + beat * 16);
        o.connect(g); g.connect(A.musicGain); o.start(t); o.stop(t + beat * 16 + 0.1);
      }
    }
    if (Math.random() < (combat ? 0.55 : 0.35)) {
      const n = root + scale[(Math.random() * scale.length) | 0] + (Math.random() < 0.3 ? 12 : 0);
      tone('triangle', f(n), f(n), beat * 2.2, combat ? 0.12 : 0.09, 0, A.musicGain);
    }
    if (combat && m.step % 2 === 0) { const c = A.ctx, t = c.currentTime; const o = c.createOscillator(), g = c.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.15); g.gain.setValueAtTime(0.25, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18); o.connect(g); g.connect(A.musicGain); o.start(t); o.stop(t + 0.2); }
  };
  A.suspend = function () { if (A.ctx && A.ctx.state === 'running') A.ctx.suspend(); };
  A.resume = function () { if (A.ctx && A.ctx.state === 'suspended') A.ctx.resume(); };

  AM.Audio = A;
})(typeof window !== 'undefined' ? window : globalThis);
