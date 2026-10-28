// Sound: everything is synthesised with WebAudio (no audio files). Positional sounds are
// panned and attenuated by distance from the camera; ambience follows weather and night.
(function (UB) {
  'use strict';
  const A = {};
  let ac = null, master, sfx, amb, noiseBuf;
  let vol = { master: 0.8, sfx: 0.8, amb: 0.5 };
  const last = {};
  let wind = null, rain = null, drone = null;

  A.init = function () {
    if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    ac = new Ctx();
    master = ac.createGain(); master.connect(ac.destination);
    sfx = ac.createGain(); sfx.connect(master);
    amb = ac.createGain(); amb.connect(master);
    noiseBuf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    A.setVolumes(vol);
    startAmbience();
  };
  A.setVolumes = function (v) {
    vol = Object.assign(vol, v);
    if (!ac) return;
    master.gain.value = vol.master;
    sfx.gain.value = vol.sfx;
    amb.gain.value = vol.amb;
  };

  function noise(t, dur, type, freq, q, gain, dest, sweepTo) {
    const src = ac.createBufferSource();
    src.buffer = noiseBuf;
    src.loop = true;
    const f = ac.createBiquadFilter();
    f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q || 1;
    if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
    const g = ac.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f); f.connect(g); g.connect(dest);
    src.start(t, Math.random()); src.stop(t + dur + 0.05);
  }
  function tone(t, dur, type, f0, f1, gain, dest, attack) {
    const o = ac.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + (attack || 0.005));
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(dest);
    o.start(t); o.stop(t + dur + 0.05);
  }
  // Output node for a positional sound: pan + distance attenuation.
  function out(gain, pan) {
    const g = ac.createGain();
    g.gain.value = gain;
    if (ac.createStereoPanner) {
      const p = ac.createStereoPanner();
      p.pan.value = Math.max(-1, Math.min(1, pan || 0));
      g.connect(p); p.connect(sfx);
    } else g.connect(sfx);
    return g;
  }
  function throttle(key, ms) {
    const now = performance.now();
    if (last[key] && now - last[key] < ms) return false;
    last[key] = now;
    return true;
  }

  // name: sound id; pos: {x, y} world tiles (optional) for panning/attenuation.
  A.play = function (name, pos, extra) {
    if (!ac || ac.state !== 'running' || vol.master <= 0) return;
    let gain = 1, pan = 0;
    if (pos && UB.Render) {
      const c = UB.Render.camTile();
      const d = Math.hypot(pos.x - c.x, pos.y - c.y);
      gain = Math.max(0, 1 - d / (34 / Math.max(1, UB.Render.getScale() / 2.5)));
      if (gain < 0.04) return;
      const sz = UB.Render.size();
      pan = ((UB.Render.w2s(pos.x, pos.y).x - sz.W / 2) / (sz.W / 2)) * 0.8;
    }
    const t = ac.currentTime;
    switch (name) {
      case 'pistol': if (!throttle('pistol', 35)) return; noise(t, 0.12, 'bandpass', 1900, 1.2, 0.5, out(gain, pan)); tone(t, 0.06, 'square', 220, 90, 0.08, out(gain, pan)); break;
      case 'shotgun': if (!throttle('shotgun', 60)) return; noise(t, 0.28, 'lowpass', 2400, 0.8, 0.7, out(gain, pan), 300); tone(t, 0.12, 'sine', 120, 50, 0.3, out(gain, pan)); break;
      case 'rifle': if (!throttle('rifle', 60)) return; noise(t, 0.2, 'highpass', 1400, 0.7, 0.55, out(gain, pan)); tone(t, 0.15, 'sine', 160, 45, 0.35, out(gain, pan)); break;
      case 'turret': if (!throttle('turret', 45)) return; noise(t, 0.07, 'bandpass', 2600, 2, 0.35, out(gain, pan)); break;
      case 'flame': if (!throttle('flame', 120)) return; noise(t, 0.35, 'lowpass', 900, 0.7, 0.45, out(gain, pan), 200); break;
      case 'leap': if (!throttle('leap', 150)) return; tone(t, 0.18, 'triangle', 180, 420, 0.12, out(gain, pan)); break;
      case 'melee': if (!throttle('melee', 80)) return; noise(t, 0.08, 'lowpass', 700, 1, 0.5, out(gain, pan)); tone(t, 0.08, 'sine', 140, 70, 0.25, out(gain, pan)); break;
      case 'groan': {
        if (!throttle('groan', 700)) return;
        const o = out(gain * 0.5, pan);
        const f = 70 + Math.random() * 60;
        const osc = ac.createOscillator(); osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(f, t); osc.frequency.linearRampToValueAtTime(f * 0.7, t + 0.9);
        const lfo = ac.createOscillator(); lfo.frequency.value = 6 + Math.random() * 4;
        const lg = ac.createGain(); lg.gain.value = 8; lfo.connect(lg); lg.connect(osc.frequency);
        const fl = ac.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = 520; fl.Q.value = 6;
        const g = ac.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.25, t + 0.15); g.gain.exponentialRampToValueAtTime(0.001, t + 0.95);
        osc.connect(fl); fl.connect(g); g.connect(o);
        osc.start(t); lfo.start(t); osc.stop(t + 1); lfo.stop(t + 1);
        break;
      }
      case 'splat': if (!throttle('splat', 60)) return; noise(t, 0.14, 'lowpass', 500, 2, 0.4, out(gain, pan), 150); break;
      case 'udie': noise(t, 0.4, 'lowpass', 400, 1, 0.5, out(gain, pan), 80); tone(t, 0.6, 'triangle', 330, 110, 0.15, out(gain, pan)); break;
      case 'explode': if (!throttle('explode', 120)) return; noise(t, 1.2, 'lowpass', 1600, 0.7, 1.1, out(gain, pan), 60); tone(t, 0.8, 'sine', 70, 30, 0.6, out(gain, pan)); break;
      case 'collapse': noise(t, 1.0, 'lowpass', 900, 0.8, 0.7, out(gain, pan), 80); break;
      case 'hammer': if (!throttle('hammer', 240)) return; tone(t, 0.04, 'square', 900, 600, 0.08, out(gain * 0.7, pan)); tone(t + 0.09, 0.04, 'square', 800, 500, 0.06, out(gain * 0.7, pan)); break;
      case 'built': tone(t, 0.12, 'triangle', 523, 0, 0.12, sfx); tone(t + 0.1, 0.18, 'triangle', 784, 0, 0.12, sfx); break;
      case 'scream': if (!throttle('scream', 500)) return; tone(t, 0.9, 'sawtooth', 900, 380, 0.2, out(gain, pan), 0.05); noise(t, 0.9, 'bandpass', 1200, 3, 0.2, out(gain, pan)); break;
      case 'spit': if (!throttle('spit', 120)) return; noise(t, 0.15, 'highpass', 2500, 1, 0.25, out(gain, pan)); break;
      case 'acid': noise(t, 0.25, 'bandpass', 3200, 4, 0.2, out(gain, pan)); break;
      case 'alarm': for (let k = 0; k < 3; k++) { tone(t + k * 0.6, 0.3, 'square', 620, 0, 0.12, sfx, 0.02); tone(t + k * 0.6 + 0.3, 0.3, 'square', 820, 0, 0.12, sfx, 0.02); } break;
      case 'dawn': [392, 494, 587, 784].forEach((f, k) => tone(t + k * 0.14, 0.6, 'sine', f, 0, 0.12, sfx, 0.02)); break;
      case 'loot': [660, 880, 1100].forEach((f, k) => tone(t + k * 0.06, 0.12, 'square', f, 0, 0.05, sfx)); break;
      case 'recruit': [440, 554, 659, 880].forEach((f, k) => tone(t + k * 0.08, 0.2, 'triangle', f, 0, 0.12, sfx)); break;
      case 'click': tone(t, 0.04, 'square', 1200, 0, 0.04, sfx); break;
      case 'order': tone(t, 0.06, 'square', 700, 900, 0.05, sfx); break;
      case 'error': tone(t, 0.18, 'square', 160, 120, 0.08, sfx); break;
      case 'radio': noise(t, 0.6, 'bandpass', 1800, 6, 0.12, out(gain, pan)); break;
      case 'bad': tone(t, 0.25, 'triangle', 300, 200, 0.12, sfx); break;
      case 'gameover': [392, 330, 262, 196].forEach((f, k) => tone(t + k * 0.35, 0.9, 'triangle', f, 0, 0.15, sfx, 0.03)); break;
      default: break;
    }
  };

  function loopNoise(type, freq, q) {
    const src = ac.createBufferSource();
    src.buffer = noiseBuf; src.loop = true;
    const f = ac.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q || 0.7;
    const g = ac.createGain(); g.gain.value = 0;
    src.connect(f); f.connect(g); g.connect(amb);
    src.start();
    return { g, f };
  }
  function startAmbience() {
    wind = loopNoise('lowpass', 380, 0.5);
    rain = loopNoise('highpass', 2600, 0.3);
    const o1 = ac.createOscillator(), o2 = ac.createOscillator();
    o1.type = 'sine'; o1.frequency.value = 55; o2.type = 'triangle'; o2.frequency.value = 82.4;
    const g = ac.createGain(); g.gain.value = 0;
    o1.connect(g); o2.connect(g); g.connect(amb);
    o1.start(); o2.start();
    drone = { g };
  }
  // Called a few times per second with the game state.
  A.ambience = function (S, inGame) {
    if (!ac) return;
    const t = ac.currentTime;
    const night = inGame && S ? 1 - UB.Waves.daylight(S) : 0.3;
    const w = 0.12 + 0.06 * Math.sin(t * 0.3) + night * 0.06;
    wind.g.gain.setTargetAtTime(w, t, 1.5);
    wind.f.frequency.setTargetAtTime(300 + 200 * Math.sin(t * 0.17), t, 2);
    rain.g.gain.setTargetAtTime(inGame && S && S.weather === 'rain' ? 0.09 : 0, t, 2);
    drone.g.gain.setTargetAtTime(inGame ? night * 0.05 : 0.025, t, 3);
  };

  // Map simulation events to sounds.
  A.onEvent = function (e) {
    switch (e.t) {
      case 'shot': A.play(e.w === 'turret' ? 'turret' : e.w === 'bat' ? 'melee' : e.w, { x: e.x0, y: e.y0 }); if (e.hit && Math.random() < 0.3) A.play('splat', { x: e.x1, y: e.y1 }); break;
      case 'melee': A.play('melee', e); break;
      case 'zdie': A.play('splat', e); if (Math.random() < 0.2) A.play('groan', e); break;
      case 'udie': A.play('udie', e); break;
      case 'explode': A.play('explode', e); break;
      case 'collapse': A.play('collapse', e); break;
      case 'built': A.play('built'); break;
      case 'scream': A.play('scream', e); break;
      case 'spit': A.play('spit', e); break;
      case 'flame': A.play('flame', e); break;
      case 'leap': A.play('leap', { x: e.x1, y: e.y1 }); break;
      case 'cloud': A.play('acid', e); break;
      case 'acid': A.play('acid', e); break;
      case 'alarm': A.play('alarm'); break;
      case 'dawn': A.play('dawn'); break;
      case 'loot': A.play('loot'); break;
      case 'recruit': A.play('recruit'); break;
      case 'objective': A.play('recruit'); break;
      case 'radio': A.play('radio', e); break;
      case 'bang': A.play('melee', e); break;
      case 'gameover': A.play('gameover'); break;
      default: break;
    }
  };
  A.groans = function (S) {
    // Occasional groans from visible zombies near the camera.
    if (!ac || Math.random() > 0.08) return;
    const N = S.map.w;
    const z = S.zombies[Math.floor(Math.random() * S.zombies.length)];
    if (z && !z.dead && S._vis[Math.floor(z.y) * N + Math.floor(z.x)]) A.play('groan', z);
  };

  UB.Audio = A;
})(globalThis.UB = globalThis.UB || {});
