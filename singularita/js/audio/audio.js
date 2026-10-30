// Synthesised audio: separate buses for music, effects, ambience and interface, a library of
// procedural sound effects, and generative music that follows the zone, time of day and combat.
const NOTE = (n) => 440 * 2 ** ((n - 69) / 12);

export class AudioEngine {
  constructor(settings) {
    this.settings = settings;
    this.ctx = null;
    this.started = false;
    this.mood = 'island_day';
    this.intensity = 0;
    this.listener = { x: 0, z: 0, yaw: 0 };
    const unlock = () => this.start();
    window.addEventListener('pointerdown', unlock, { once: true, capture: true });
    window.addEventListener('keydown', unlock, { once: true, capture: true });
    window.addEventListener('touchstart', unlock, { once: true, capture: true });
  }

  start() {
    if (this.started) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
    } catch { return; }
    this.started = true;
    const c = this.ctx;
    this.master = c.createGain(); this.master.connect(c.destination);
    const comp = c.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4;
    this.master.disconnect(); this.master.connect(comp); comp.connect(c.destination);
    this.bus = {};
    for (const k of ['music', 'sfx', 'ambient', 'ui']) { this.bus[k] = c.createGain(); this.bus[k].connect(this.master); }
    this.noise = this.makeNoise();
    this.applyVolumes();
    this.startAmbient();
    this.nextBeat = c.currentTime + 0.1;
    this.step = 0;
  }

  applyVolumes() {
    if (!this.started) return;
    const a = this.settings.audio;
    this.master.gain.value = a.master;
    this.bus.music.gain.value = a.music * 0.5;
    this.bus.sfx.gain.value = a.sfx;
    this.bus.ambient.gain.value = a.ambient * 0.5;
    this.bus.ui.gain.value = a.ui * 0.6;
  }

  makeNoise() {
    const c = this.ctx, len = c.sampleRate * 1.5;
    const buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  // --------------------------------------------------------------- building blocks
  env(g, t, a, peak, decay, sus = 0) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0001, sus || 0.0001), t + a + decay);
  }
  tone(bus, { type = 'sine', f = 440, f2 = null, t = 0, a = 0.005, d = 0.2, v = 0.3, pan = 0, detune = 0 }) {
    const c = this.ctx, now = c.currentTime + t;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f, now); o.detune.value = detune;
    if (f2) o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), now + a + d);
    this.env(g, now, a, v, d);
    let node = g;
    if (pan && c.createStereoPanner) { const p = c.createStereoPanner(); p.pan.value = pan; g.connect(p); node = p; }
    o.connect(g); node.connect(bus);
    o.start(now); o.stop(now + a + d + 0.05);
  }
  burst(bus, { t = 0, d = 0.2, v = 0.3, f = 1200, q = 1, type = 'bandpass', f2 = null, pan = 0 }) {
    const c = this.ctx, now = c.currentTime + t;
    const s = c.createBufferSource(); s.buffer = this.noise;
    const fl = c.createBiquadFilter(); fl.type = type; fl.frequency.setValueAtTime(f, now); fl.Q.value = q;
    if (f2) fl.frequency.exponentialRampToValueAtTime(f2, now + d);
    const g = c.createGain(); this.env(g, now, 0.004, v, d);
    let node = g;
    if (pan && c.createStereoPanner) { const p = c.createStereoPanner(); p.pan.value = pan; g.connect(p); node = p; }
    s.connect(fl); fl.connect(g); node.connect(bus);
    s.start(now, Math.random() * 0.5); s.stop(now + d + 0.05);
  }

  // Volume and pan from the listener for world sounds.
  spatial(x, z) {
    if (x == null) return { v: 1, pan: 0 };
    const dx = x - this.listener.x, dz = z - this.listener.z, d = Math.hypot(dx, dz);
    const v = Math.max(0, 1 - d / 40);
    const ang = Math.atan2(dx, dz) - this.listener.yaw;
    return { v: v * v, pan: Math.max(-0.8, Math.min(0.8, -Math.sin(ang) * Math.min(1, d / 6))) };
  }

  // --------------------------------------------------------------- effects library
  play(id, x, z) {
    if (!this.started || this.ctx.state !== 'running') { if (this.ctx?.state === 'suspended') this.ctx.resume(); if (!this.started) return; }
    const s = this.bus.sfx, u = this.bus.ui;
    const sp = this.spatial(x, z);
    if (sp.v < 0.02) return;
    const k = sp.v, pan = sp.pan;
    const r = (a, b) => a + Math.random() * (b - a);
    switch (id) {
      case 'swing': this.burst(s, { d: 0.12, v: 0.12 * k, f: r(1500, 2200), q: 0.8, f2: 600, pan }); break;
      case 'hit': this.burst(s, { d: 0.08, v: 0.22 * k, f: 900, q: 1.2, pan }); this.tone(s, { type: 'square', f: r(140, 180), f2: 60, d: 0.1, v: 0.12 * k, pan }); break;
      case 'stab': this.burst(s, { d: 0.06, v: 0.18 * k, f: 2500, q: 2, pan }); this.tone(s, { type: 'triangle', f: 320, f2: 120, d: 0.06, v: 0.1 * k, pan }); break;
      case 'heavy': this.tone(s, { type: 'sawtooth', f: 120, f2: 40, d: 0.25, v: 0.25 * k, pan }); this.burst(s, { d: 0.2, v: 0.25 * k, f: 500, pan }); break;
      case 'bow': this.tone(s, { type: 'triangle', f: 220, f2: 520, d: 0.08, v: 0.15 * k, pan }); this.burst(s, { d: 0.1, v: 0.08 * k, f: 3000, q: 3, pan }); break;
      case 'bolt': case 'mote': this.tone(s, { type: 'sine', f: r(700, 900), f2: 1500, d: 0.15, v: 0.12 * k, pan }); this.tone(s, { type: 'triangle', f: 1200, f2: 600, t: 0.03, d: 0.1, v: 0.06 * k, pan }); break;
      case 'fire': this.burst(s, { d: 0.5, v: 0.3 * k, f: 400, q: 0.6, f2: 150, type: 'lowpass', pan }); this.tone(s, { type: 'sawtooth', f: 90, f2: 50, d: 0.4, v: 0.12 * k, pan }); break;
      case 'frost': this.burst(s, { d: 0.4, v: 0.2 * k, f: 5000, q: 4, f2: 2000, pan }); this.tone(s, { type: 'sine', f: 1600, f2: 2400, d: 0.3, v: 0.06 * k, pan }); break;
      case 'zap': for (let i = 0; i < 4; i++) this.tone(s, { type: 'square', f: r(400, 1200), t: i * 0.03, d: 0.04, v: 0.08 * k, pan }); this.burst(s, { d: 0.15, v: 0.15 * k, f: 3500, q: 1, pan }); break;
      case 'blink': case 'comet': this.tone(s, { type: 'sine', f: 300, f2: 1400, d: 0.18, v: 0.14 * k, pan }); break;
      case 'boom': case 'explode': this.burst(s, { d: 0.7, v: 0.45 * k, f: 300, q: 0.5, f2: 60, type: 'lowpass', pan }); this.tone(s, { type: 'sine', f: 80, f2: 30, d: 0.6, v: 0.4 * k, pan }); break;
      case 'slam': case 'slimeLand': this.tone(s, { type: 'sine', f: id === 'slimeLand' ? 120 : 70, f2: 35, d: 0.35, v: 0.35 * k, pan }); this.burst(s, { d: 0.25, v: 0.2 * k, f: 300, type: 'lowpass', pan }); break;
      case 'enemySwing': this.burst(s, { d: 0.12, v: 0.1 * k, f: 900, q: 0.8, f2: 400, pan }); break;
      case 'enemyShoot': this.tone(s, { type: 'triangle', f: 500, f2: 250, d: 0.14, v: 0.08 * k, pan }); break;
      case 'scream': this.tone(s, { type: 'sawtooth', f: 700, f2: 300, d: 0.6, v: 0.12 * k, pan, detune: 30 }); this.tone(s, { type: 'sawtooth', f: 690, f2: 320, d: 0.6, v: 0.1 * k, pan, detune: -40 }); break;
      case 'screech': this.tone(s, { type: 'square', f: 1800, f2: 900, d: 0.15, v: 0.05 * k, pan }); break;
      case 'heal': this.tone(s, { type: 'sine', f: 660, f2: 990, d: 0.3, v: 0.08 * k, pan }); break;
      case 'chop': this.burst(s, { d: 0.09, v: 0.25 * k, f: 700, q: 2, pan }); this.tone(s, { type: 'triangle', f: 180, f2: 120, d: 0.08, v: 0.15 * k, pan }); break;
      case 'pick': this.tone(s, { type: 'square', f: r(1300, 1700), f2: 900, d: 0.06, v: 0.12 * k, pan }); this.burst(s, { d: 0.07, v: 0.15 * k, f: 3000, q: 3, pan }); break;
      case 'parry': this.tone(s, { type: 'square', f: 1760, f2: 1500, d: 0.25, v: 0.15 }); this.tone(s, { type: 'sine', f: 2640, d: 0.4, v: 0.1 }); break;
      case 'block': this.tone(s, { type: 'square', f: 600, f2: 400, d: 0.1, v: 0.12 }); break;
      case 'guard': this.burst(s, { d: 0.06, v: 0.08, f: 2000 }); break;
      case 'hurt': this.tone(s, { type: 'sawtooth', f: 220, f2: 110, d: 0.18, v: 0.18 }); break;
      case 'dodge': case 'dash': case 'smoke': this.burst(s, { d: 0.18, v: 0.12, f: 1200, q: 0.6, f2: 400 }); break;
      case 'jump': this.tone(s, { type: 'sine', f: 300, f2: 500, d: 0.1, v: 0.05 }); break;
      case 'pickup': this.tone(u, { type: 'triangle', f: 880, d: 0.08, v: 0.15 }); this.tone(u, { type: 'triangle', f: 1320, t: 0.06, d: 0.1, v: 0.12 }); break;
      case 'craft': [523, 659, 784, 1046].forEach((f, i) => this.tone(u, { type: 'triangle', f, t: i * 0.07, d: 0.25, v: 0.16 })); this.burst(s, { d: 0.12, v: 0.2, f: 2500, q: 3 }); break;
      case 'levelup': [523, 659, 784, 1046, 1318].forEach((f, i) => this.tone(u, { type: 'triangle', f, t: i * 0.09, d: 0.5, v: 0.18 })); break;
      case 'ui': this.tone(u, { type: 'sine', f: 700, d: 0.05, v: 0.1 }); break;
      case 'uiClose': this.tone(u, { type: 'sine', f: 520, d: 0.05, v: 0.08 }); break;
      case 'denied': this.tone(u, { type: 'square', f: 180, d: 0.12, v: 0.08 }); break;
      case 'horn': this.tone(s, { type: 'sawtooth', f: 110, d: 1.4, a: 0.25, v: 0.22 }); this.tone(s, { type: 'sawtooth', f: 165, d: 1.4, a: 0.3, v: 0.12 }); break;
      case 'fanfare': case 'bossIntro': [196, 247, 294, 392].forEach((f, i) => this.tone(s, { type: 'sawtooth', f, t: i * 0.12, d: 0.6, v: 0.12 })); break;
      case 'roar': case 'roarShort': this.burst(s, { d: id === 'roar' ? 1.2 : 0.5, v: 0.4 * k, f: 250, q: 0.7, f2: 120, type: 'lowpass', pan }); this.tone(s, { type: 'sawtooth', f: 90, f2: 60, d: 1.0, v: 0.2 * k, pan }); break;
      case 'tremor': this.tone(s, { type: 'sine', f: 40, d: 1.8, a: 0.3, v: 0.4 }); this.burst(s, { d: 1.6, v: 0.2, f: 120, type: 'lowpass' }); break;
      case 'creak': this.tone(s, { type: 'triangle', f: 160, f2: 120, d: 0.5, v: 0.08 * k, pan }); break;
      case 'rockfall': this.burst(s, { d: 0.5, v: 0.35 * k, f: 500, type: 'lowpass', f2: 100, pan }); break;
      case 'lore': [392, 523, 659].forEach((f, i) => this.tone(u, { type: 'sine', f, t: i * 0.12, d: 0.9, v: 0.1 })); break;
      case 'drink': this.burst(s, { d: 0.25, v: 0.12, f: 800, q: 4, f2: 1600 }); this.tone(u, { type: 'sine', f: 660, f2: 880, t: 0.1, d: 0.2, v: 0.08 }); break;
      case 'manifest': [330, 494, 659, 988].forEach((f, i) => this.tone(s, { type: 'sine', f, t: i * 0.05, d: 0.5, v: 0.08 })); break;
      case 'astralHit': this.tone(s, { type: 'triangle', f: r(900, 1200), f2: 500, d: 0.08, v: 0.1 * k, pan }); break;
      case 'star': this.tone(s, { type: 'sine', f: r(1200, 1800), f2: 300, d: 0.3, v: 0.12 * k, pan }); this.burst(s, { d: 0.2, v: 0.12 * k, f: 600, type: 'lowpass', pan }); break;
      case 'gravity': this.tone(s, { type: 'sine', f: 200, f2: 60, d: 1.2, v: 0.15 }); break;
      case 'break': this.burst(s, { d: 0.5, v: 0.3, f: 4000, q: 1, f2: 800 }); break;
      case 'knives': for (let i = 0; i < 3; i++) this.burst(s, { t: i * 0.03, d: 0.06, v: 0.12, f: 3000, q: 2 }); break;
      case 'mark': this.tone(u, { type: 'square', f: 1100, d: 0.05, v: 0.06 }); break;
      case 'resonance': [880, 1108, 1320].forEach((f, i) => this.tone(s, { type: 'sine', f, t: i * 0.1, d: 1.2, v: 0.08 })); break;
      case 'recall': this.tone(u, { type: 'sine', f: 440, f2: 880, d: 1.0, v: 0.08 }); break;
      case 'rest': [392, 330, 262].forEach((f, i) => this.tone(u, { type: 'sine', f, t: i * 0.2, d: 0.8, v: 0.1 })); break;
      case 'death': this.tone(s, { type: 'sawtooth', f: 220, f2: 55, d: 1.4, v: 0.25 }); break;
      case 'victory': [392, 494, 587, 784, 988].forEach((f, i) => this.tone(u, { type: 'triangle', f, t: i * 0.1, d: 0.7, v: 0.15 })); break;
      default: break;
    }
  }

  // --------------------------------------------------------------- ambience
  startAmbient() {
    const c = this.ctx;
    this.amb = {};
    const src = c.createBufferSource(); src.buffer = this.noise; src.loop = true;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 400;
    const g = c.createGain(); g.gain.value = 0.0;
    src.connect(lp); lp.connect(g); g.connect(this.bus.ambient);
    src.start();
    this.amb = { src, lp, g };
  }
  setAmbient(kind) {
    if (!this.started) return;
    const { lp, g } = this.amb, t = this.ctx.currentTime;
    // Island and isles: surf and wind (the spires are all wind). Caves: a low rumble that deepens with depth.
    const conf = kind === 'island' ? { f: 520, v: 0.25 } : kind === 'isle_air' || kind === 'dim_dragons' ? { f: 900, v: 0.3 } : String(kind).startsWith('isle') ? { f: 460, v: 0.25 }
      : typeof kind === 'number' ? { f: 110 + Math.max(0, 8 - kind) * 15, v: 0.35 } : { f: 160, v: 0.3 };
    lp.frequency.setTargetAtTime(conf.f, t, 0.5);
    g.gain.setTargetAtTime(conf.v, t, 0.8);
  }

  // --------------------------------------------------------------- music
  // Moods: scale, tempo and instrument colour. A small sequencer schedules notes ahead of time.
  setMood(mood) { this.mood = mood; }
  setIntensity(x) { this.intensity += (x - this.intensity) * 0.05; }

  tick() {
    if (!this.started || this.ctx.state !== 'running') return;
    const c = this.ctx;
    const M = MOODS[this.mood] || MOODS.island_day;
    const spb = 60 / M.bpm / 2;
    while (this.nextBeat < c.currentTime + 0.25) {
      const t = this.nextBeat - c.currentTime;
      const st = this.step++;
      const bar = Math.floor(st / 16) % M.prog.length;
      const root = M.root + M.prog[bar];
      const b = this.bus.music;
      if (st % 16 === 0) for (const iv of [0, M.scale[2], M.scale[4]]) this.tone(b, { type: M.pad, f: NOTE(root + iv - 12), t, a: 0.6, d: spb * 15, v: 0.05 });
      if (st % 4 === 0 && M.bass) this.tone(b, { type: 'triangle', f: NOTE(root - 24), t, a: 0.01, d: spb * 3, v: 0.09 });
      if (Math.random() < M.density) {
        const deg = M.scale[Math.floor(Math.random() * M.scale.length)];
        this.tone(b, { type: M.lead, f: NOTE(root + deg + (Math.random() < 0.3 ? 12 : 0)), t, a: 0.01, d: spb * 2.2, v: 0.045 });
      }
      // Combat layer: drums fade in with the number of nearby foes.
      if (this.intensity > 0.15) {
        const iv = Math.min(1, this.intensity);
        if (st % 4 === 0) { this.tone(b, { type: 'sine', f: 90, f2: 40, t, d: 0.18, v: 0.16 * iv }); }
        if (st % 8 === 4) this.burst(b, { t, d: 0.12, v: 0.08 * iv, f: 1800, q: 0.7 });
        if (iv > 0.6 && st % 2 === 1) this.burst(b, { t, d: 0.04, v: 0.03 * iv, f: 6000, q: 1, type: 'highpass' });
      }
      this.nextBeat += spb;
    }
  }
}

// Scales as semitone offsets; progressions as root shifts per bar.
const PENT = [0, 2, 4, 7, 9], MINOR = [0, 2, 3, 5, 7, 8, 10], DORIAN = [0, 2, 3, 5, 7, 9, 10], PHRYG = [0, 1, 3, 5, 7, 8, 10];
const MOODS = {
  island_day: { root: 62, bpm: 92, scale: PENT, prog: [0, 5, -3, 7], pad: 'triangle', lead: 'triangle', density: 0.35, bass: true },
  island_night: { root: 57, bpm: 76, scale: MINOR, prog: [0, -4, -2, -5], pad: 'sine', lead: 'sine', density: 0.18, bass: true },
  cave1: { root: 50, bpm: 70, scale: DORIAN, prog: [0, -2], pad: 'sine', lead: 'triangle', density: 0.14, bass: true },
  cave2: { root: 49, bpm: 68, scale: DORIAN, prog: [0, 3, -2], pad: 'sine', lead: 'triangle', density: 0.13, bass: true },
  cave3: { root: 48, bpm: 72, scale: MINOR, prog: [0, -4], pad: 'sawtooth', lead: 'square', density: 0.12, bass: true },
  cave4: { root: 47, bpm: 64, scale: PHRYG, prog: [0, 1], pad: 'sine', lead: 'sine', density: 0.1, bass: true },
  cave5: { root: 46, bpm: 74, scale: PHRYG, prog: [0, 1, -2], pad: 'sawtooth', lead: 'triangle', density: 0.12, bass: true },
  cave6: { root: 52, bpm: 66, scale: [0, 2, 4, 6, 7, 9, 11], prog: [0, 2], pad: 'sine', lead: 'sine', density: 0.2, bass: false },
  cave7: { root: 45, bpm: 60, scale: PHRYG, prog: [0, 1, 0, 6], pad: 'sine', lead: 'sine', density: 0.08, bass: true },
  cave8: { root: 44, bpm: 58, scale: [0, 2, 4, 6, 7, 9, 11], prog: [0, 6, 0, -1], pad: 'sine', lead: 'triangle', density: 0.12, bass: true },
  // The isles: wind in fourths over the spires, a lilting tide, a heavy forge beat, an old slow song of the roots.
  isle_air: { root: 64, bpm: 84, scale: [0, 2, 5, 7, 9], prog: [0, 5, 2, 7], pad: 'triangle', lead: 'sine', density: 0.28, bass: false },
  isle_water: { root: 60, bpm: 78, scale: [0, 2, 4, 7, 9, 11], prog: [0, -3, 5, -1], pad: 'sine', lead: 'triangle', density: 0.3, bass: true },
  isle_fire: { root: 52, bpm: 104, scale: PHRYG, prog: [0, 1, -2, 1], pad: 'sawtooth', lead: 'square', density: 0.3, bass: true },
  isle_earth: { root: 55, bpm: 70, scale: DORIAN, prog: [0, -2, 3, -5], pad: 'triangle', lead: 'triangle', density: 0.24, bass: true },
  // The dimensions: a gaol's slow march, a lilting duet, a crooked court, a mirrored canon, a dragon's chant.
  dim_dungeon: { root: 43, bpm: 66, scale: MINOR, prog: [0, -2, 1, -2], pad: 'sawtooth', lead: 'square', density: 0.12, bass: true },
  dim_twins: { root: 62, bpm: 96, scale: [0, 2, 4, 7, 9], prog: [0, 0, 5, 5], pad: 'triangle', lead: 'triangle', density: 0.32, bass: true },
  dim_king: { root: 46, bpm: 72, scale: PHRYG, prog: [0, 1, 6, 1], pad: 'sawtooth', lead: 'sine', density: 0.16, bass: true },
  dim_mirror: { root: 57, bpm: 80, scale: [0, 2, 3, 6, 7, 9, 10], prog: [0, -1, 0, 1], pad: 'sine', lead: 'triangle', density: 0.22, bass: false },
  dim_dragons: { root: 45, bpm: 88, scale: DORIAN, prog: [0, 5, 3, -2], pad: 'sawtooth', lead: 'square', density: 0.3, bass: true },
  cave9: { root: 48, bpm: 54, scale: [0, 2, 4, 6, 8, 10], prog: [0, 2, 4, 2], pad: 'sine', lead: 'sine', density: 0.14, bass: true },
  boss: { root: 50, bpm: 132, scale: PHRYG, prog: [0, 1, 0, -2], pad: 'sawtooth', lead: 'square', density: 0.5, bass: true },
};
