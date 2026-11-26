// Água-Tinta — generative music, ambience beds and the fight layer (owner E), §13.
// A 50 ms scheduler with 0.25 s lookahead places notes on the Web Audio clock. Music: triangle plucks + sine pad
// through a feedback-delay "room"; Markov melody per zone scale; night = octave down and slower. Ambience: brown
// noise waves (LFO), lowpass falling with depth, rain/storm beds, random bloops. Fight: ostinato rate ∝ tension,
// tremolo above .85, low pad for bosses. Reel ticks and tension creaks are scheduled here too.
(function (AQ) {
  'use strict';

  var A = AQ.audio = AQ.audio || {};

  var MOODS = {
    title: { root: 60, scale: [0, 2, 4, 7, 9], bpm: 62, p: 0.3, step: [-2, -1, 1, 2], lo: 0, hi: 12 },
    map: { root: 60, scale: [0, 2, 4, 7, 9], bpm: 66, p: 0.33, step: [-2, -1, 1, 2], lo: 0, hi: 14 },
    baia: { root: 60, scale: [0, 2, 4, 7, 9], bpm: 70, p: 0.35, step: [-2, -1, 1, 2], lo: 2, hi: 16 },
    recife: { root: 62, scale: [0, 2, 4, 6, 7, 9, 11], bpm: 68, p: 0.35, step: [-2, -1, 1, 2], lo: 0, hi: 14 },
    kelp: { root: 57, scale: [0, 2, 3, 5, 7, 9, 10], bpm: 64, p: 0.33, step: [-2, -1, 1, 2], lo: 0, hi: 14 },
    mar: { root: 64, scale: [0, 2, 4, 5, 7, 9, 10], bpm: 66, p: 0.3, step: [-3, -2, 2, 3], lo: -2, hi: 14 },
    abismo: { root: 50, scale: [0, 1, 3, 5, 7, 8, 10], bpm: 60, p: 0.18, step: [-2, -1, 1, 2], lo: -3, hi: 9, drone: true },
    aquarium: { root: 65, scale: [0, 2, 4, 7, 9], bpm: 62, p: 0.3, step: [-2, -1, 1], lo: 0, hi: 12 },
    ending: { root: 60, scale: [0, 2, 4, 5, 7, 9, 11], bpm: 58, p: 0.4, step: [-1, 1, 2], lo: 0, hi: 14 }
  };

  var M = A.music = {};
  var started = false, timer = 0;
  var nodes = null;
  var mood = MOODS.title, moodName = 'title', night = false;
  var nextStep = 0, stepIdx = 0, degree = 4;
  var voices = [];               // end times of active plucks
  var tension = null, fightOn = false, boss = false, frenzy = false;
  var nextOst = 0, ostFlip = false;
  var reelOn = false, reelSpeed = 0, nextReel = 0;
  var nextBloop = 0, nextRumble = 0, nextCreak = 0;
  var amb = { zone: 'baia', underwater: 0, weather: 'limpo', phase: 'dia', scene: 'title' };

  function ctx() { return A.ctx; }
  function cap() { var p = AQ.perf && AQ.perf.params; return (p && p.musicVoices) || 4; }

  function buildNodes() {
    var c = ctx();
    var n = {};
    // music: dry + room (feedback delay with lowpass)
    n.music = A.gain(1, A.bus.music);
    n.room = c.createDelay(1.0);
    n.room.delayTime.value = 0.38;
    n.fb = A.gain(0.35);
    n.roomLp = A.filter('lowpass', 2000, 0.5);
    n.roomOut = A.gain(0.55, A.bus.music);
    n.send = A.gain(0.5, n.room);
    n.music.connect(n.send);
    n.room.connect(n.roomLp);
    n.roomLp.connect(n.fb);
    n.fb.connect(n.room);
    n.roomLp.connect(n.roomOut);

    // ambience: waves
    n.ambOut = A.gain(1, A.bus.ambience);
    n.waveLp = A.filter('lowpass', 900, 0.6, null);
    n.waveG = A.gain(0.0001, n.ambOut);
    n.waveLfoDepth = A.gain(0.18);
    n.waveLfo = A.osc('sine', 0.11, n.waveLfoDepth);
    n.waveLfoDepth.connect(n.waveG.gain);
    n.waveLp.connect(n.waveG);
    n.wave = A.noise('brown', n.waveLp, true);
    n.wave.start();
    n.waveLfo.start();
    // rain
    n.rainBp = A.filter('bandpass', 2600, 0.6, null);
    n.rainG = A.gain(0.0001, n.ambOut);
    n.rainBp.connect(n.rainG);
    n.rain = A.noise('white', n.rainBp, true);
    n.rain.start();
    // rumble
    n.rumbleLp = A.filter('lowpass', 110, 0.8, null);
    n.rumbleG = A.gain(0.0001, n.ambOut);
    n.rumbleLp.connect(n.rumbleG);
    n.rumble = A.noise('brown', n.rumbleLp, true);
    n.rumble.start(0, 1.3);
    // abyss / ending drone (music bus)
    n.droneG = A.gain(0.0001, A.bus.music);
    n.droneLp = A.filter('lowpass', 320, 0.7, n.droneG);
    n.drone1 = A.osc('sine', A.mtof(38), n.droneLp);
    n.drone2 = A.osc('triangle', A.mtof(45) * 1.003, n.droneLp);
    n.drone1.start(); n.drone2.start();

    // fight layer
    n.fightG = A.gain(0.0001, A.bus.music);
    n.tremG = A.gain(0.0001, A.bus.music);
    n.tremAmp = A.gain(0.5, n.tremG);
    n.trem = A.osc('sine', A.mtof(84), n.tremAmp);
    n.tremLfo = A.osc('sine', 11, null);
    n.tremLfoG = A.gain(0.5);
    n.tremLfo.connect(n.tremLfoG);
    n.tremLfoG.connect(n.tremAmp.gain);
    n.trem.start(); n.tremLfo.start();
    n.bossG = A.gain(0.0001, A.bus.music);
    n.bossLp = A.filter('lowpass', 220, 0.8, n.bossG);
    n.boss = A.osc('sawtooth', A.mtof(31), n.bossLp);
    n.boss.start();
    nodes = n;
  }

  // ---------------------------------------------------------------- voices
  function pluck(midi, t, peak) {
    var now = ctx().currentTime;
    voices = voices.filter(function (e) { return e > now; });
    if (voices.length >= cap()) return;
    var g = A.gain(0.0001, nodes.music);
    var lp = A.filter('lowpass', 2600, 0.6, g);
    var o = A.osc('triangle', A.mtof(midi), lp);
    var end = A.env(g, t, 0.005, 1.2, peak || 0.11);
    o.start(t);
    A.stopAt(o, end + 0.05);
    voices.push(end);
  }
  function pad(midi, t, dur, peak) {
    var g = A.gain(0.0001, nodes.music);
    var o1 = A.osc('sine', A.mtof(midi), g);
    var o2 = A.osc('sine', A.mtof(midi + 7) * 1.002, g);
    var p = g.gain;
    p.setValueAtTime(0.0001, t);
    p.linearRampToValueAtTime(peak || 0.035, t + dur * 0.45);
    p.linearRampToValueAtTime(0.0001, t + dur);
    o1.start(t); o2.start(t);
    A.stopAt(o1, t + dur + 0.05); A.stopAt(o2, t + dur + 0.05);
  }
  function degToMidi(d) {
    var sc = mood.scale, n = sc.length;
    var oct = Math.floor(d / n), idx = ((d % n) + n) % n;
    return mood.root + (night ? -12 : 0) + oct * 12 + sc[idx];
  }

  // ---------------------------------------------------------------- scheduler
  function schedule() {
    if (!A.ready || !nodes) return;
    var c = ctx();
    if (c.state !== 'running') return;
    var now = c.currentTime, ahead = now + 0.25;
    var bpm = mood.bpm * (night ? 0.85 : 1);
    var stepDur = 60 / bpm / 2;
    if (nextStep < now) nextStep = now + 0.05;
    while (nextStep < ahead) {
      var t = nextStep;
      var p = mood.p * (fightOn ? 0.55 : 1) * (frenzy ? 1.4 : 1);
      if (stepIdx % 16 === 0) pad(degToMidi(0) - 12, t, 8, mood.drone ? 0.025 : 0.03);
      if (stepIdx % 16 === 8 && Math.random() < 0.5) pad(degToMidi(mood.scale.length > 5 ? 4 : 3) - 12, t, 7, 0.02);
      if (Math.random() < p && Math.random() > 0.3) {
        var s = mood.step[Math.floor(Math.random() * mood.step.length)];
        degree += s;
        if (degree < mood.lo) degree = mood.lo + 1;
        if (degree > mood.hi) degree = mood.hi - 1;
        pluck(degToMidi(degree), t + (Math.random() - 0.5) * 0.012, 0.09 + Math.random() * 0.04);
      }
      stepIdx++;
      nextStep += stepDur;
    }
    // fight ostinato
    if (fightOn) {
      var T = tension === null ? 0.3 : tension;
      var rate = 2 + 6 * Math.min(1, T);
      if (nextOst < now) nextOst = now + 0.03;
      while (nextOst < ahead) {
        var m = degToMidi(0) - (night ? 12 : 24) + (ostFlip ? 7 : 0);
        ostFlip = !ostFlip;
        var g = A.gain(0.0001, nodes.fightG);
        var o = A.osc('triangle', A.mtof(Math.max(28, m)), g);
        var e = A.env(g, nextOst, 0.006, Math.min(0.3, 0.9 / rate), 0.5);
        o.start(nextOst);
        A.stopAt(o, e + 0.05);
        nextOst += 1 / rate;
      }
      if (T > 0.7 && now > nextCreak) {
        if (Math.random() < (T - 0.6) * 0.9) A.sfx('tension', { vol: 0.35 + (T - 0.7) });
        nextCreak = now + 0.35 + Math.random() * 0.6;
      }
    }
    // reel ticks
    if (reelOn) {
      var rr = 8 + 32 * reelSpeed;
      if (nextReel < now) nextReel = now + 0.01;
      while (nextReel < ahead) {
        var g2 = A.gain(0.0001, A.bus.sfx);
        var hp = A.filter('highpass', 3200, 0.7, g2);
        var src = A.noise('white', hp);
        var e2 = A.env(g2, nextReel, 0.0008, 0.004, 0.12);
        src.start(nextReel, Math.random());
        A.stopAt(src, e2 + 0.01);
        nextReel += 1 / rr;
      }
    }
    // ambience bloops
    if (now > nextBloop) {
      var under = amb.underwater || 0;
      var rateB = amb.scene === 'aquarium' ? 1.4 : (0.25 + under * 0.8);
      if (amb.scene !== 'title' || Math.random() < 0.5) A.sfx('bloop', { vol: 0.35 + under * 0.4, peak: 0.08 });
      nextBloop = now + (1.5 + Math.random() * 4.5) / rateB;
    }
    // storm rumbles
    if (amb.weather === 'tempestade' && amb.scene !== 'aquarium' && now > nextRumble) {
      var rg = nodes.rumbleG.gain;
      rg.cancelScheduledValues(now);
      rg.setValueAtTime(Math.max(0.0001, rg.value), now);
      rg.linearRampToValueAtTime(0.35 + Math.random() * 0.35, now + 0.6 + Math.random());
      rg.linearRampToValueAtTime(0.06, now + 3 + Math.random() * 2);
      nextRumble = now + 5 + Math.random() * 7;
    }
  }

  function applyAmbience() {
    if (!nodes) return;
    var under = Math.max(0, Math.min(1, amb.underwater || 0));
    var cut = 1200 - under * 900;
    if (amb.scene === 'map') cut = 1100;
    A.ramp(nodes.waveLp.frequency, cut, 0.3);
    var waveLvl = amb.scene === 'aquarium' ? 0.14 : amb.scene === 'title' ? 0.32 : amb.scene === 'ending' ? 0.18 : 0.42;
    if (amb.weather === 'tempestade') waveLvl *= 1.5;
    A.ramp(nodes.waveG.gain, waveLvl, 0.8);
    A.ramp(nodes.waveLfoDepth.gain, waveLvl * 0.45, 0.8);
    A.ramp(nodes.waveLfo.frequency, amb.weather === 'tempestade' ? 0.2 : 0.11, 1);
    var rain = amb.scene === 'aquarium' || amb.scene === 'title' || amb.scene === 'ending' ? 0 : amb.weather === 'chuva' ? 0.12 : amb.weather === 'tempestade' ? 0.2 : 0;
    A.ramp(nodes.rainG.gain, Math.max(0.0001, rain * (1 - under * 0.7)), 1.2);
    A.ramp(nodes.rainBp.frequency, 2600 - under * 1800, 0.5);
    if (amb.weather !== 'tempestade') A.ramp(nodes.rumbleG.gain, 0.0001, 1.5);
  }
  function applyMood() {
    if (!nodes) return;
    var droneOn = mood.drone || moodName === 'ending';
    A.ramp(nodes.droneG.gain, droneOn ? (moodName === 'ending' ? 0.05 : 0.08) : 0.0001, 2);
    if (droneOn) {
      var r = mood.root - 24;
      A.ramp(nodes.drone1.frequency, A.mtof(r), 0.5);
      A.ramp(nodes.drone2.frequency, A.mtof(r + 7) * 1.003, 0.5);
    }
  }
  function applyFight() {
    if (!nodes) return;
    var T = tension === null ? 0.3 : tension;
    A.ramp(nodes.fightG.gain, fightOn ? 0.28 : 0.0001, fightOn ? 0.3 : 0.8);
    A.ramp(nodes.tremG.gain, fightOn && T > 0.85 ? 0.05 + Math.min(0.06, (T - 0.85) * 0.2) : 0.0001, 0.12);
    A.ramp(nodes.bossG.gain, fightOn && boss ? 0.07 : 0.0001, 1.2);
  }

  // ---------------------------------------------------------------- API used by audio.js
  M.start = function () {
    if (started || !A.ctx) return;
    started = true;
    buildNodes();
    applyMood();
    applyAmbience();
    applyFight();
    timer = setInterval(function () { try { schedule(); } catch (e) { /* audio never throws */ } }, 50);
  };
  M.setMood = function (name) {
    var next = MOODS[name] || MOODS.baia;
    if (next !== mood) { mood = next; moodName = name; degree = Math.floor((mood.lo + mood.hi) / 2); stepIdx = 0; }
    M.refresh();
  };
  M.refresh = function () {
    var ph = AQ.ui && AQ.ui.dom ? AQ.ui.dom.worldNow().phase : 'dia';
    night = ph === 'noite' && moodName !== 'title' && moodName !== 'ending' && moodName !== 'aquarium';
    applyMood();
    applyAmbience();
  };
  M.setAmbience = function (a) {
    for (var k in a) amb[k] = a[k];
    applyAmbience();
  };
  M.setTension = function (v) { tension = v; applyFight(); };
  M.setReel = function (on, speed) { reelOn = on; reelSpeed = speed; };
  M.fight = function (on, isBoss) { fightOn = !!on; boss = !!isBoss && on; applyFight(); };
  M.frenzy = function (on) { frenzy = !!on; };
  M.omen = function () {
    if (!nodes) return;
    var t = ctx().currentTime;
    pad(degToMidi(0) - 24, t, 9, 0.06);
  };
  M.stop = function () { clearInterval(timer); timer = 0; started = false; };
  M.MOODS = MOODS;
})(window.AQ);
