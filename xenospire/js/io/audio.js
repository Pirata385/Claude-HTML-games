// Everything audible is synthesised with WebAudio: power sounds from each
// power's recipe, voxel crunches, creature voices, the Curator's blip-speak and
// a generative soundtrack per floor theme. Starts on the first user gesture.
(function (XS) {
  'use strict';

  const MODES = {
    major: [0, 2, 4, 5, 7, 9, 11], lydian: [0, 2, 4, 6, 7, 9, 11], dorian: [0, 2, 3, 5, 7, 9, 10],
    phrygian: [0, 1, 3, 5, 7, 8, 10], aeolian: [0, 2, 3, 5, 7, 8, 10], mixolydian: [0, 2, 4, 5, 7, 9, 10],
  };
  const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);

  // A signature layer per form on top of the element's tone.
  const FORM_SFX = {
    sniper: (a) => { a.noiseHit({ type: 'highpass', f0: 5200, f1: 2600, dur: 0.06, vol: 0.2 }); a.tone({ wave: 'square', f0: 2400, f1: 900, dur: 0.1, vol: 0.06, cutoff: 6000 }); },
    shotgun: (a) => a.noiseHit({ f0: 3000, f1: 300, dur: 0.18, vol: 0.26 }),
    grenade: (a) => a.tone({ wave: 'triangle', f0: 180, f1: 320, dur: 0.12, vol: 0.12 }),
    mine: (a) => a.tone({ wave: 'triangle', f0: 200, f1: 360, dur: 0.1, vol: 0.1 }),
    field: (a) => a.tone({ wave: 'triangle', f0: 220, f1: 380, dur: 0.12, vol: 0.1 }),
    singularity: (a) => a.tone({ wave: 'sine', f0: 400, f1: 60, dur: 0.9, vol: 0.14, vib: 10 }),
    meteor: (a) => a.tone({ wave: 'sine', f0: 2200, f1: 260, dur: 1.2, vol: 0.08, vib: 4 }),
    quake: (a) => { a.noiseHit({ f0: 400, f1: 40, dur: 0.6, vol: 0.32 }); a.tone({ wave: 'sine', f0: 70, f1: 30, dur: 0.5, vol: 0.3 }); },
    wave: (a) => a.noiseHit({ type: 'bandpass', f0: 300, f1: 2400, dur: 0.5, vol: 0.16, q: 1.2 }),
    eruption: (a) => { for (let i = 0; i < 4; i++) a.noiseHit({ f0: 1400, f1: 200, dur: 0.07, vol: 0.12, when: a.ctx.currentTime + i * 0.07 }); },
    tornado: (a) => a.noiseHit({ type: 'bandpass', f0: 500, f1: 1400, dur: 1.2, vol: 0.12, q: 3 }),
    drill: (a) => a.tone({ wave: 'square', f0: 140, f1: 120, dur: 0.6, vol: 0.06, cutoff: 1200, vib: 40 }),
  };

  class Sound {
    constructor(settings) {
      this.settings = settings;
      this.ctx = null;
      this.music = null;
      this.lastPlay = Object.create(null);
    }

    // Must be called from a user gesture.
    unlock() {
      if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      const ctx = this.ctx = new AC();
      this.master = ctx.createGain();
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14; comp.ratio.value = 4;
      this.master.connect(comp); comp.connect(ctx.destination);
      this.sfxBus = ctx.createGain(); this.sfxBus.connect(this.master);
      this.musicBus = ctx.createGain(); this.musicBus.connect(this.master);
      const len = ctx.sampleRate * 1.5;
      this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.applyVolumes();
      if (this.pendingMusic) { const p = this.pendingMusic; this.pendingMusic = null; this.startMusic(p.theme, p.opts); }
    }

    applyVolumes() {
      if (!this.ctx) return;
      const s = this.settings;
      this.master.gain.value = s.master;
      this.sfxBus.gain.value = s.sfx;
      this.musicBus.gain.value = s.music * 0.55;
    }

    suspend(v) { if (this.ctx) (v ? this.ctx.suspend() : this.ctx.resume()).catch(() => {}); }

    ok(name, gap = 0.03) {
      if (!this.ctx || this.settings.master <= 0 || this.settings.sfx <= 0) return false;
      const t = this.ctx.currentTime;
      if (this.lastPlay[name] && t - this.lastPlay[name] < gap) return false;
      this.lastPlay[name] = t;
      return true;
    }

    // ---- primitives ----
    tone(o) {
      const ctx = this.ctx, t = (o.when || ctx.currentTime) + 0.005;
      const osc = ctx.createOscillator();
      osc.type = o.wave || 'square';
      osc.frequency.setValueAtTime(Math.max(20, o.f0), t);
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.f1 || o.f0), t + o.dur);
      if (o.vib) {
        const lfo = ctx.createOscillator(), lg = ctx.createGain();
        lfo.frequency.value = o.vib; lg.gain.value = o.f0 * 0.05;
        lfo.connect(lg); lg.connect(osc.frequency); lfo.start(t); lfo.stop(t + o.dur + 0.05);
      }
      const g = ctx.createGain();
      const vol = o.vol || 0.2;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + (o.attack || 0.005));
      g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
      let node = osc;
      if (o.cutoff) {
        const f = ctx.createBiquadFilter();
        f.type = 'lowpass'; f.frequency.value = o.cutoff; f.Q.value = o.q || 1;
        osc.connect(f); node = f;
      }
      node.connect(g); g.connect(o.bus || this.sfxBus);
      osc.start(t); osc.stop(t + o.dur + 0.05);
    }

    noiseHit(o) {
      const ctx = this.ctx, t = (o.when || ctx.currentTime) + 0.005;
      const src = ctx.createBufferSource();
      src.buffer = this.noise;
      src.playbackRate.value = o.rate || 1;
      const f = ctx.createBiquadFilter();
      f.type = o.type || 'lowpass';
      f.frequency.setValueAtTime(o.f0 || 2000, t);
      if (o.f1) f.frequency.exponentialRampToValueAtTime(o.f1, t + o.dur);
      f.Q.value = o.q || 0.8;
      const g = ctx.createGain();
      g.gain.setValueAtTime(o.vol || 0.2, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
      src.connect(f); f.connect(g); g.connect(o.bus || this.sfxBus);
      src.start(t, Math.random() * 0.5); src.stop(t + o.dur + 0.05);
    }

    // ---- named effects ----
    play(name, opts = {}) {
      if (!this.ok(name, opts.gap)) return;
      const r = () => 0.9 + Math.random() * 0.2;
      switch (name) {
        case 'ui': this.tone({ wave: 'square', f0: 660 * r(), f1: 880, dur: 0.06, vol: 0.08, cutoff: 3000 }); break;
        case 'select': this.tone({ wave: 'square', f0: 520, f1: 1040, dur: 0.12, vol: 0.1, cutoff: 3500 }); this.tone({ wave: 'triangle', f0: 1040, dur: 0.15, vol: 0.06, when: this.ctx.currentTime + 0.06 }); break;
        case 'back': this.tone({ wave: 'square', f0: 500, f1: 300, dur: 0.08, vol: 0.07, cutoff: 2500 }); break;
        case 'hit': this.noiseHit({ f0: 2600 * r(), f1: 500, dur: 0.09, vol: 0.22 }); this.tone({ wave: 'square', f0: 220 * r(), f1: 90, dur: 0.07, vol: 0.12, cutoff: 1500 }); break;
        case 'hitBig': this.noiseHit({ f0: 1800, f1: 200, dur: 0.22, vol: 0.32 }); this.tone({ wave: 'sawtooth', f0: 140, f1: 40, dur: 0.2, vol: 0.2, cutoff: 900 }); break;
        case 'hurt': this.tone({ wave: 'square', f0: 300, f1: 120, dur: 0.12, vol: 0.14, cutoff: 1800 }); break;
        case 'swing': this.noiseHit({ type: 'bandpass', f0: 900 * r(), f1: 3000, dur: 0.09, vol: 0.1, q: 2 }); break;
        case 'spit': this.tone({ wave: 'triangle', f0: 400 * r(), f1: 700, dur: 0.06, vol: 0.08 }); break;
        case 'dodge': this.noiseHit({ type: 'bandpass', f0: 600, f1: 2200, dur: 0.16, vol: 0.12, q: 1.5 }); break;
        case 'break': {
          const pitch = opts.pitch || 1;
          this.noiseHit({ f0: 1400 * pitch * r(), f1: 300, dur: 0.07, vol: 0.09, rate: pitch });
          break;
        }
        case 'explosion': this.noiseHit({ f0: 1200, f1: 60, dur: 0.6, vol: 0.4 }); this.tone({ wave: 'sine', f0: 110, f1: 35, dur: 0.45, vol: 0.35 }); break;
        case 'thud': {
          const k = opts.size || 0.5;
          this.noiseHit({ f0: 500 + 400 * (1 - k), f1: 50, dur: 0.25 + k * 0.4, vol: 0.18 + k * 0.25 });
          this.tone({ wave: 'sine', f0: 90 - k * 30, f1: 30, dur: 0.3 + k * 0.3, vol: 0.2 + k * 0.2 });
          break;
        }
        case 'crack': this.noiseHit({ type: 'highpass', f0: 3200 * r(), f1: 1200, dur: 0.12, vol: 0.12 }); break;
        case 'fall': this.tone({ wave: 'triangle', f0: 800, f1: 90, dur: 0.6, vol: 0.18 }); break;
        case 'ko': this.tone({ wave: 'sawtooth', f0: 400, f1: 50, dur: 0.7, vol: 0.2, cutoff: 1600 }); this.noiseHit({ f0: 2500, f1: 100, dur: 0.5, vol: 0.25 }); break;
        case 'freeze': this.tone({ wave: 'triangle', f0: 1800, f1: 2600, dur: 0.25, vol: 0.1, vib: 30 }); break;
        case 'heal': this.tone({ wave: 'sine', f0: 600, f1: 900, dur: 0.18, vol: 0.08 }); break;
        case 'cooldown': this.tone({ wave: 'sine', f0: 1320, dur: 0.05, vol: 0.04 }); break;
        case 'victory': [0, 4, 7, 12].forEach((s, i) => this.tone({ wave: 'square', f0: midi(72 + s), dur: 0.22, vol: 0.09, cutoff: 3000, when: this.ctx.currentTime + i * 0.11 })); break;
        case 'defeat': [7, 3, 0, -5].forEach((s, i) => this.tone({ wave: 'triangle', f0: midi(62 + s), dur: 0.35, vol: 0.12, when: this.ctx.currentTime + i * 0.2 })); break;
        case 'loom': [0, 7, 12, 19, 24].forEach((s, i) => this.tone({ wave: 'sine', f0: midi(67 + s), dur: 0.5, vol: 0.05, when: this.ctx.currentTime + i * 0.07 })); break;
        case 'combo': [0, 7, 12].forEach((k, i) => this.tone({ wave: 'triangle', f0: midi(84 + k), dur: 0.12, vol: 0.05, when: this.ctx.currentTime + i * 0.05 })); break;
        case 'portal': this.tone({ wave: 'sine', f0: 200, f1: 1200, dur: 0.5, vol: 0.12, vib: 8 }); break;
      }
    }

    power(def) {
      if (!this.ok('pow' + def.form, 0.05)) return;
      const s = def.sfx;
      this.tone({ wave: s.wave, f0: s.f0, f1: s.f1, dur: s.dur, vol: 0.13, cutoff: s.cutoff, vib: s.vib > 6 ? s.vib : 0 });
      if (s.noise > 0.2) this.noiseHit({ f0: s.cutoff, f1: Math.max(80, s.cutoff * 0.3), dur: s.dur * 0.8, vol: 0.12 * s.noise });
      const layer = FORM_SFX[def.form];
      if (layer) layer(this, s);
    }

    // Creature grunts from the genome's voice.
    voice(g, kind) {
      if (!this.ok('voice' + kind, 0.12)) return;
      const v = g.voice, base = 190 * v.pitch;
      const plan = { hurt: [[1.1, 0.7]], attack: [[1, 1.2]], ko: [[1.2, 0.4], [0.8, 0.3]], win: [[1, 1.3], [1.3, 1.6]], taunt: [[1, 1.4], [1.2, 0.9]] }[kind] || [[1, 1]];
      plan.forEach(([a, b], i) => this.tone({ wave: v.wave, f0: base * a, f1: base * b, dur: 0.13, vol: 0.07, cutoff: 2200, vib: v.wobble, when: this.ctx.currentTime + i * 0.12 }));
    }

    // Animal-Crossing-like blips for the Curator's lines.
    curator(text) {
      if (!this.ctx || this.settings.master <= 0 || this.settings.sfx <= 0) return;
      const letters = String(text).replace(/[^A-Za-zÀ-ú]/g, '');
      const scale = [0, 2, 4, 7, 9, 12];
      let t = this.ctx.currentTime + 0.02;
      for (let i = 0; i < Math.min(28, Math.floor(letters.length / 2)); i++) {
        const c = letters.charCodeAt(i * 2);
        this.tone({ wave: 'square', f0: midi(69 + scale[c % scale.length]), dur: 0.05, vol: 0.035, cutoff: 2400, when: t });
        t += 0.055;
      }
    }

    // ---- generative music ----
    startMusic(theme, opts = {}) {
      this.musicId = theme.id || 'menu';
      if (!this.ctx) { this.pendingMusic = { theme, opts }; return; }
      this.stopMusic();
      if (this.settings.music <= 0 || this.settings.master <= 0) return;
      const mus = theme.music || { root: 57, mode: 'dorian', bpm: 84 };
      const rng = new XS.RNG(XS.hash(theme.id || 'menu', 'music'));
      const scale = MODES[mus.mode] || MODES.dorian;
      const degreesPool = [[0, 5, 3, 4], [0, 3, 4, 0], [0, 6, 5, 4], [0, 2, 5, 4], [0, 4, 5, 3]];
      const prog = rng.pick(degreesPool);
      const note = (deg, oct = 0) => mus.root + scale[((deg % 7) + 7) % 7] + 12 * (Math.floor(deg / 7) + oct);
      const arpShape = rng.pick([[0, 2, 4, 2], [0, 4, 2, 4], [4, 2, 0, 2], [0, 2, 4, 7]]);
      const bassSteps = rng.pick([[0, 6, 8, 14], [0, 3, 8, 11], [0, 8, 10], [0, 4, 8, 12]]);
      const m = this.music = { step: 0, next: this.ctx.currentTime + 0.1, intensity: opts.intensity || 0, calm: !!opts.calm, timer: null };
      const stepDur = 60 / mus.bpm / 4;
      const tick = () => {
        if (!this.ctx || this.music !== m) return;
        while (m.next < this.ctx.currentTime + 0.15) {
          const s = m.step % 16, bar = Math.floor(m.step / 16) % 4;
          const chord = prog[bar];
          const bus = this.musicBus, t = m.next;
          if (m.calm) {
            if (s === 0) [0, 2, 4].forEach((k) => this.tone({ wave: 'sine', f0: midi(note(chord + k, 0)), dur: stepDur * 15, vol: 0.05, attack: 0.4, bus, when: t }));
            if (s % 4 === 2 && rng.chance(0.6)) this.tone({ wave: 'triangle', f0: midi(note(chord + arpShape[(s >> 2) % 4], 1)), dur: stepDur * 3, vol: 0.035, bus, when: t });
          } else {
            if (bassSteps.includes(s)) this.tone({ wave: 'triangle', f0: midi(note(chord, -2)), dur: stepDur * 2.5, vol: 0.13, bus, when: t });
            if (s % 2 === 0 || m.intensity > 0) {
              const k = arpShape[(s >> (m.intensity > 0 ? 0 : 1)) % 4];
              this.tone({ wave: 'square', f0: midi(note(chord + k, 1)), dur: stepDur * 0.9, vol: 0.03, cutoff: 1800 + m.intensity * 1500, bus, when: t });
            }
            if (s === 0 || s === 8 || (m.intensity > 0 && s === 10)) this.tone({ wave: 'sine', f0: 120, f1: 40, dur: 0.18, vol: 0.22, bus, when: t });
            if (s === 4 || s === 12) this.noiseHit({ f0: 2500, f1: 800, dur: 0.12, vol: 0.06, bus, when: t });
            if (m.intensity > 0 && s % 2 === 1) this.noiseHit({ type: 'highpass', f0: 7000, dur: 0.03, vol: 0.025, bus, when: t });
            if (s === 0 && bar === 0) this.tone({ wave: 'sine', f0: midi(note(chord + 4, 0)), dur: stepDur * 14, vol: 0.03, attack: 0.3, bus, when: t });
          }
          m.step++;
          m.next += stepDur;
        }
      };
      m.timer = setInterval(tick, 30);
      tick();
    }
    setIntensity(x) { if (this.music) this.music.intensity = x; }
    stopMusic() { if (this.music) { clearInterval(this.music.timer); this.music = null; } }
  }

  XS.Sound = Sound;
})(globalThis.XS = globalThis.XS || {});
