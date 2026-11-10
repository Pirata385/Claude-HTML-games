/* Filogênese — áudio 100% sintetizado (Web Audio): efeitos, vozes das espécies, ambiente e música generativa. */
(function (FG) {
  'use strict';
  const U = FG.U;
  let ctx = null, master, comp, busSfx, busMusic, busAmb, delay, noiseBuf;
  let lx = 0, ly = 0;
  const last = {};   // limite de repetição por efeito

  const A = FG.Audio = {
    ready: false,
    /** Cria o contexto no primeiro gesto do usuário. */
    init() {
      if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      try { ctx = new AC(); } catch (e) { return; }
      comp = ctx.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 5; comp.connect(ctx.destination);
      master = ctx.createGain(); master.connect(comp);
      busSfx = ctx.createGain(); busSfx.connect(master);
      busMusic = ctx.createGain(); busMusic.connect(master);
      busAmb = ctx.createGain(); busAmb.connect(master);
      delay = ctx.createDelay(1); delay.delayTime.value = 0.34;
      const fb = ctx.createGain(); fb.gain.value = 0.32;
      const dl = ctx.createBiquadFilter(); dl.type = 'lowpass'; dl.frequency.value = 2200;
      delay.connect(dl); dl.connect(fb); fb.connect(delay); dl.connect(busMusic);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      A.ready = true;
      A.setVolumes();
      startAmbience();
    },
    setVolumes() {
      if (!A.ready) return;
      const S = FG.Settings.data, t = ctx.currentTime;
      master.gain.setTargetAtTime(S.master, t, 0.05);
      busSfx.gain.setTargetAtTime(S.sfx, t, 0.05);
      busMusic.gain.setTargetAtTime(S.music * 0.8, t, 0.05);
      busAmb.gain.setTargetAtTime(S.ambience, t, 0.05);
    },
    suspend() { if (ctx && ctx.state === 'running') ctx.suspend(); },
    resume() { if (ctx && ctx.state === 'suspended') ctx.resume(); },

    /** Efeito sonoro; com (x, y) é posicional em relação ao ouvinte (o jogador). */
    sfx(name, x, y, o) {
      if (!A.ready || ctx.state !== 'running') return;
      const fn = SFX[name];
      if (!fn) return;
      const now = ctx.currentTime, gap = GAP[name] || 0.03;
      if (last[name] && now - last[name] < gap) return;
      const dst = out(x, y, (o && o.vol) || 1);
      if (!dst) return;
      last[name] = now;
      fn(dst, now, o || {});
    },
    /** Vocalização de uma espécie. kind: sing, call, chirp, yelp, growl, die. */
    voice(v, kind, x, y, baby) {
      if (!A.ready || ctx.state !== 'running' || !v) return;
      const now = ctx.currentTime, key = 'v' + kind;
      if (last[key] && now - last[key] < 0.08) return;
      const dst = out(x, y, 1);
      if (!dst) return;
      last[key] = now;
      const f = v.f * (baby ? 1.7 : 1);
      const r = U.rng(v.mel + (kind === 'sing' ? Math.floor(now * 2) % 3 : 0));
      const PENTA = [1, 1.125, 1.25, 1.5, 1.667, 2];
      if (kind === 'sing') {
        let t = now;
        const n = 3 + v.syll;
        for (let i = 0; i < n; i++) { const d = 0.13 + r() * 0.12; vnote(dst, v, f * PENTA[(r() * PENTA.length) | 0], t, d, 0.2, v.glide); t += d * 0.92; }
      } else if (kind === 'call') { vnote(dst, v, f * 0.9, now, 0.4, 0.24, 'up'); vnote(dst, v, f * 1.2, now + 0.42, 0.55, 0.24, 'updown'); }
      else if (kind === 'chirp') { vnote(dst, v, f * 1.2, now, 0.1, 0.18, 'up'); vnote(dst, v, f * 1.5, now + 0.12, 0.14, 0.18, 'up'); }
      else if (kind === 'yelp') vnote(dst, v, f * 1.5, now, 0.16, 0.2, 'down');
      else if (kind === 'die') vnote(dst, v, f * 1.1, now, 0.7, 0.24, 'fall');
      else if (kind === 'growl') {
        const o = ctx.createOscillator(), g = ctx.createGain(), am = ctx.createOscillator(), amg = ctx.createGain(), lp = ctx.createBiquadFilter();
        o.type = 'sawtooth'; o.frequency.setValueAtTime(Math.max(45, f * 0.32), now); o.frequency.linearRampToValueAtTime(Math.max(40, f * 0.24), now + 0.5);
        am.frequency.value = 28; amg.gain.value = 0.5; am.connect(amg); amg.connect(g.gain);
        lp.type = 'lowpass'; lp.frequency.value = Math.min(1800, f * 3 + 300);
        g.gain.setValueAtTime(0, now); g.gain.linearRampToValueAtTime(0.22, now + 0.05); g.gain.linearRampToValueAtTime(0, now + 0.55);
        o.connect(lp); lp.connect(g); g.connect(dst); o.start(now); am.start(now); o.stop(now + 0.6); am.stop(now + 0.6);
        noise(dst, now, 0.45, 0.07, 'lowpass', 700, 300);
      }
    },
    /** Atualiza ouvinte, ambiente e música. env: {x, y, night, rain, shore, biome, mood} */
    update(dt, env) {
      if (!A.ready || ctx.state !== 'running') return;
      lx = env.x; ly = env.y;
      ambience(dt, env);
      music(env);
    },
  };

  // ---------- blocos básicos ----------
  function out(x, y, vol) {
    let g = vol, pan = 0;
    if (x != null) {
      const dx = x - lx, d = Math.hypot(dx, y - ly);
      if (d > 950) return null;
      g *= 1 / (1 + (d / 280) * (d / 280)); pan = U.clamp(dx / 520, -1, 1);
      if (g < 0.01) return null;
    }
    const gn = ctx.createGain(); gn.gain.value = g;
    if (ctx.createStereoPanner && pan) { const p = ctx.createStereoPanner(); p.pan.value = pan; gn.connect(p); p.connect(busSfx); } else gn.connect(busSfx);
    return gn;
  }
  function tone(dst, type, f0, f1, t0, dur, vol, attack) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t0);
    if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(vol, t0 + (attack || 0.006)); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(dst); o.start(t0); o.stop(t0 + dur + 0.03);
    return o;
  }
  function noise(dst, t0, dur, vol, ftype, f0, f1, q) {
    const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = noiseBuf; s.loop = true;
    f.type = ftype || 'lowpass'; f.frequency.setValueAtTime(f0 || 1000, t0); f.Q.value = q || 0.8;
    if (f1) f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(vol, t0 + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    s.connect(f); f.connect(g); g.connect(dst); s.start(t0, Math.random() * 1.5); s.stop(t0 + dur + 0.03);
  }
  function vnote(dst, v, f, t0, dur, vol, glide) {
    const o = ctx.createOscillator(), g = ctx.createGain(), lp = ctx.createBiquadFilter(), lfo = ctx.createOscillator(), lg = ctx.createGain();
    o.type = v.wave;
    const G = { up: [0.86, 1.1], down: [1.12, 0.84], updown: [0.9, 1.0], flat: [1, 1], chirp: [0.7, 1.25], fall: [1, 0.4] }[glide] || [1, 1];
    o.frequency.setValueAtTime(f * G[0], t0); o.frequency.exponentialRampToValueAtTime(Math.max(30, f * G[1]), t0 + dur * (glide === 'updown' ? 0.5 : 1));
    if (glide === 'updown') o.frequency.exponentialRampToValueAtTime(f * 0.92, t0 + dur);
    lfo.frequency.value = v.vib; lg.gain.value = f * v.vibDepth; lfo.connect(lg); lg.connect(o.frequency);
    lp.type = 'lowpass'; lp.frequency.value = Math.min(6000, f * 4 + 400); lp.Q.value = 2;
    const k = v.wave === 'sine' || v.wave === 'triangle' ? 1 : 0.5;
    g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(vol * k, t0 + Math.min(0.03, dur * 0.3)); g.gain.setValueAtTime(vol * k, t0 + dur * 0.7); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(lp); lp.connect(g); g.connect(dst);
    o.start(t0); lfo.start(t0); o.stop(t0 + dur + 0.03); lfo.stop(t0 + dur + 0.03);
  }
  const arp = (dst, t, type, notes, step, dur, vol) => notes.forEach((f, i) => tone(dst, type, f, f, t + i * step, dur, vol));

  // ---------- receitas de efeitos ----------
  const B = FG.B;
  const GAP = { step: 0.07, munch: 0.12, dna: 0.06, hit: 0.04, stomp: 0.2, swim: 0.3, tick: 0.02 };
  const SFX = {
    step(d, t, o) {
      if (o.wet) return noise(d, t, 0.09, 0.1, 'bandpass', 1300, 700, 2);
      const b = o.biome;
      if (b === B.TUNDRA) noise(d, t, 0.07, 0.11, 'highpass', 2600, 1800);
      else if (b === B.BEACH || b === B.DESERT) noise(d, t, 0.08, 0.09, 'bandpass', 900, 500, 0.6);
      else noise(d, t, 0.055, 0.1, 'lowpass', 800, 260);
    },
    stomp(d, t) { tone(d, 'sine', 72, 34, t, 0.28, 0.6); noise(d, t, 0.2, 0.3, 'lowpass', 260, 80); },
    bite(d, t) { noise(d, t, 0.07, 0.34, 'bandpass', 1900, 900, 1.5); tone(d, 'square', 210, 90, t, 0.08, 0.14); },
    snap(d, t) { noise(d, t, 0.04, 0.16, 'highpass', 2400); },
    hit(d, t) { noise(d, t, 0.13, 0.4, 'lowpass', 1300, 180); tone(d, 'sine', 150, 55, t, 0.12, 0.35); },
    whoosh(d, t) { noise(d, t, 0.22, 0.2, 'bandpass', 420, 1700, 1.2); },
    charge(d, t) { noise(d, t, 0.36, 0.24, 'bandpass', 300, 1300, 1); tone(d, 'sawtooth', 85, 170, t, 0.34, 0.12); },
    spit(d, t) { noise(d, t, 0.13, 0.22, 'bandpass', 2600, 800, 2); tone(d, 'sine', 720, 280, t, 0.12, 0.14); },
    munch(d, t) { for (let i = 0; i < 3; i++) noise(d, t + i * 0.11, 0.06, 0.2, 'bandpass', 1100 + i * 150, 600, 1.4); },
    dna(d, t) { arp(d, t, 'sine', [880, 1320], 0.06, 0.14, 0.11); },
    good(d, t) { arp(d, t, 'triangle', [660, 880], 0.08, 0.16, 0.18); },
    bad(d, t) { arp(d, t, 'square', [300, 220], 0.09, 0.14, 0.09); },
    friend(d, t) { arp(d, t, 'triangle', [523, 659, 784, 1047], 0.085, 0.24, 0.18); },
    ally(d, t) { arp(d, t, 'triangle', [392, 523, 659, 784, 1047, 1319], 0.1, 0.5, 0.17); tone(d, 'sine', 262, 262, t + 0.5, 0.9, 0.14, 0.1); },
    extinct(d, t) { tone(d, 'sawtooth', 110, 52, t, 0.9, 0.2, 0.05); noise(d, t, 0.8, 0.18, 'lowpass', 500, 90); tone(d, 'sine', 196, 147, t + 0.25, 0.7, 0.14); },
    levelup(d, t) { arp(d, t, 'triangle', [392, 494, 587, 784, 988, 1175, 1568], 0.085, 0.45, 0.16); arp(d, t + 0.6, 'sine', [1568, 2093], 0.12, 0.7, 0.08); },
    objective(d, t) { arp(d, t, 'sine', [1047, 1568], 0.11, 0.4, 0.14); },
    fossil(d, t) { tone(d, 'square', 180, 120, t, 0.06, 0.15); noise(d, t, 0.1, 0.2, 'lowpass', 900, 300); arp(d, t + 0.12, 'sine', [784, 1175, 1568], 0.08, 0.35, 0.12); },
    egg(d, t) { arp(d, t, 'sine', [659, 988, 1319], 0.1, 0.4, 0.14); },
    hatch(d, t) { for (let i = 0; i < 4; i++) noise(d, t + i * 0.07, 0.04, 0.22, 'highpass', 2200); arp(d, t + 0.3, 'triangle', [784, 1047, 1319], 0.08, 0.3, 0.16); },
    death(d, t) { tone(d, 'sine', 440, 110, t, 0.9, 0.22, 0.02); tone(d, 'triangle', 330, 82, t + 0.1, 1.0, 0.14, 0.02); },
    deny(d, t) { tone(d, 'square', 170, 150, t, 0.07, 0.1); tone(d, 'square', 150, 130, t + 0.1, 0.09, 0.1); },
    tick(d, t) { tone(d, 'sine', 1200, 900, t, 0.03, 0.1); },
    ui(d, t) { tone(d, 'triangle', 700, 520, t, 0.05, 0.11); },
    stanceC(d, t) { tone(d, 'sawtooth', 150, 85, t, 0.16, 0.16); noise(d, t, 0.1, 0.12, 'lowpass', 600, 200); },
    stanceS(d, t) { arp(d, t, 'sine', [700, 1050], 0.06, 0.14, 0.14); },
    jump(d, t) { tone(d, 'sine', 300, 640, t, 0.13, 0.12); },
    land(d, t) { noise(d, t, 0.09, 0.2, 'lowpass', 420, 150); },
    swim(d, t) { noise(d, t, 0.2, 0.14, 'bandpass', 900, 480, 1.4); },
    dance(d, t) { for (let i = 0; i < 4; i++) { noise(d, t + i * 0.17, 0.07, 0.24, 'lowpass', 340, 120); if (i % 2) tone(d, 'triangle', 620, 500, t + i * 0.17, 0.05, 0.08); } },
    charm(d, t) { arp(d, t, 'sine', [1568, 2093, 2637, 3136], 0.07, 0.3, 0.09); },
    pose(d, t) { const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1100; lp.connect(d); tone(lp, 'sawtooth', 196, 196, t, 0.4, 0.14, 0.04); tone(lp, 'sawtooth', 294, 294, t, 0.4, 0.1, 0.04); },
    awaken(d, t) { arp(d, t, 'triangle', [262, 330, 392, 523, 659, 784, 1047, 1319, 1568], 0.16, 1.6, 0.13); tone(d, 'sine', 131, 131, t, 3.4, 0.14, 0.5); },
  };

  // ---------- ambiente ----------
  let amb = null, ambT = 0;
  function loopNoise(type, freq, q) {
    const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = noiseBuf; s.loop = true; f.type = type; f.frequency.value = freq; f.Q.value = q || 0.7; g.gain.value = 0;
    s.connect(f); f.connect(g); g.connect(busAmb); s.start();
    return g;
  }
  function startAmbience() { amb = { wind: loopNoise('lowpass', 420), sea: loopNoise('bandpass', 520, 0.5), rain: loopNoise('highpass', 2400) }; }
  function ambience(dt, env) {
    const t = ctx.currentTime;
    amb.wind.gain.setTargetAtTime(0.035 + 0.025 * Math.sin(t * 0.21) + env.rain * 0.03, t, 0.5);
    amb.sea.gain.setTargetAtTime(env.shore * (0.09 + 0.07 * Math.sin(t * 0.55)), t, 0.4);
    amb.rain.gain.setTargetAtTime(env.rain * 0.11, t, 0.6);
    if ((ambT -= dt) > 0) return;
    const b = env.biome, g = ctx.createGain();
    g.gain.value = 0.5; g.connect(busAmb);
    if (ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = Math.random() * 1.6 - 0.8; g.disconnect(); g.connect(p); p.connect(busAmb); }
    if (env.night > 0.5) {
      ambT = 0.5 + Math.random() * 1.6;
      if (b === B.SWAMP && Math.random() < 0.5) { const f = 110 + Math.random() * 60; for (let i = 0; i < 2; i++) tone(g, 'square', f, f * 0.9, t + i * 0.22, 0.14, 0.05); }
      else if (b !== B.TUNDRA && b !== B.DESERT) { const f = 3900 + Math.random() * 700; for (let i = 0; i < 4; i++) tone(g, 'sine', f, f, t + i * 0.07, 0.035, 0.03); }
    } else if (env.rain < 0.5 && (b === B.FOREST || b === B.GRASS || b === B.SWAMP || b === B.SAVANNA || b === B.BEACH)) {
      ambT = 1.2 + Math.random() * 4;
      const f = 2300 + Math.random() * 2200, n = 2 + ((Math.random() * 4) | 0);
      for (let i = 0; i < n; i++) tone(g, 'sine', f * (1 + (Math.random() - 0.5) * 0.2), f * (1.1 + Math.random() * 0.4), t + i * 0.11, 0.07, 0.045);
    } else ambT = 2;
  }

  // ---------- música generativa ----------
  const MODES = {
    day: { bpm: 76, roots: [130.8, 110, 87.3, 98], scale: [1, 1.125, 1.25, 1.5, 1.667], chord: [1, 1.25, 1.5], pluck: 0.26, drum: 0 },
    night: { bpm: 58, roots: [110, 87.3, 73.4, 82.4], scale: [1, 1.2, 1.333, 1.5, 1.8], chord: [1, 1.2, 1.5], pluck: 0.15, drum: 0 },
    social: { bpm: 96, roots: [130.8, 146.8, 174.6, 196], scale: [1, 1.125, 1.25, 1.5, 1.667], chord: [1, 1.25, 1.5], pluck: 0.5, drum: 0.5 },
    combat: { bpm: 118, roots: [73.4, 73.4, 58.3, 65.4], scale: [1, 1.2, 1.333, 1.5, 1.8], chord: [1, 1.2, 1.5], pluck: 0.4, drum: 1 },
  };
  const mus = { next: 0, step: 0, mode: 'day', deg: 2 };
  function music(env) {
    const now = ctx.currentTime;
    if (mus.next < now - 0.5) mus.next = now + 0.05;
    while (mus.next < now + 0.25) {
      if (mus.step % 16 === 0) mus.mode = MODES[env.mood] ? env.mood : 'day';
      const M = MODES[mus.mode], st = 60 / M.bpm / 4, s = mus.step % 16, bar = Math.floor(mus.step / 16), t = mus.next;
      const root = M.roots[bar % 4];
      if (s === 0) {
        // base harmônica: acorde longo com ataque lento
        for (const iv of M.chord) for (const det of [-4, 5]) {
          const o = ctx.createOscillator(), g = ctx.createGain(), lp = ctx.createBiquadFilter();
          o.type = 'triangle'; o.frequency.value = root * 2 * iv; o.detune.value = det;
          lp.type = 'lowpass'; lp.frequency.value = mus.mode === 'combat' ? 1400 : 800;
          const dur = st * 16;
          g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.028, t + dur * 0.35); g.gain.linearRampToValueAtTime(0, t + dur * 1.05);
          o.connect(lp); lp.connect(g); g.connect(busMusic); o.start(t); o.stop(t + dur * 1.1);
        }
      }
      if (s === 0 || s === 8 || (M.drum && s === 6)) tone(busMusic, 'sine', root, root, t, st * 5, mus.mode === 'combat' ? 0.16 : 0.1, 0.02);
      if (s % 2 === 0 && Math.random() < M.pluck) {
        mus.deg = U.clamp(mus.deg + ((Math.random() * 5) | 0) - 2, 0, 9);
        const f = root * 4 * M.scale[mus.deg % 5] * (mus.deg >= 5 ? 2 : 1);
        const g = ctx.createGain(); g.gain.value = 1; g.connect(busMusic); g.connect(delay);
        tone(g, mus.mode === 'social' ? 'sine' : 'triangle', f, f, t, mus.mode === 'night' ? 0.9 : 0.45, 0.075);
      }
      if (M.drum) {
        if (s % 4 === 0) { tone(busMusic, 'sine', 120, 44, t, 0.14, 0.26 * M.drum); }
        if (s % 4 === 2) noise(busMusic, t, 0.035, 0.07 * M.drum, 'highpass', 5200);
        if (mus.mode === 'combat' && (s === 3 || s === 11 || s === 14)) tone(busMusic, 'sine', 88, 50, t, 0.12, 0.2);
      }
      mus.next += st; mus.step++;
    }
  }
})(window.FG = window.FG || {});
