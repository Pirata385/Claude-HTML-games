// Água-Tinta — audio render tool: 16-bit music engine (moved here from the game's old js/audio/music.js).
// Each mood has a composed 8-bar theme (progression + melody in scale degrees) played by FM / pulse voices with a
// bass line, light noise percussion and the ping-pong echo. Variation is generative (ornaments, inversions,
// harmony passes, fills); for the recordings the generator runs over a 16-bar loop — pass 0 plain, then pass 3
// (harmony + octave lift) — with a seed per bar/step, so every repetition of the loop is sample-identical.
// Night = sparser/softer/minor colour at the same tempo (so the fight stems stay in sync). Fight stems are the
// old tension layer (driving bass + kick/snare/hats) rendered on their own, one chord cycle (8 bars) long.
(function (G) {
  'use strict';

  var A = G.SYN;

  var MODES = {
    major: [0, 2, 4, 5, 7, 9, 11], mixo: [0, 2, 4, 5, 7, 9, 10], dorian: [0, 2, 3, 5, 7, 9, 10],
    minor: [0, 2, 3, 5, 7, 8, 10], lydian: [0, 2, 4, 6, 7, 9, 11], phryg: [0, 1, 3, 5, 7, 8, 10]
  };
  var NIGHT_MODE = { major: 'minor', mixo: 'dorian', lydian: 'dorian', dorian: 'minor', minor: 'phryg', phryg: 'phryg' };
  var STORM_MODE = { major: 'minor', mixo: 'minor', lydian: 'minor', dorian: 'phryg', minor: 'phryg', phryg: 'phryg' };

  // step patterns (16 sixteenths). bass: r root, 5 fifth, 8 octave, 3 third, a approach. comp: 0-3 arp tone, c stab.
  var BASS = {
    slap: 'r..8..r.r..5.8.a', slap2: 'r..r.5..r..8..3.', root: 'r.......r.......', root2: 'r.....r.r.....5.',
    eighths: 'r.r.r.r.r.r.r.r.', pad: 'r...............', walk: 'r...3...5...3..a', sync: 'r..r..8.r..5..3.'
  };
  var COMP = {
    arp: '0.1.2.3.2.1.2.1.', stab: '..c...c...c...c.', box: '0.1.2.1.3.1.2.1.', slow: '0...1...2...3...', arp2: '0.12.3.1.2.3.2.1'
  };

  // lead: pulse | tri | mari | bell | brass | ep | music ; comp: ep | bell | pluck | music ; bass: slap | soft | brass
  var THEMES = {
    title: {
      bpm: 96, key: 60, mode: 'major', lead: 'pulse', comp: 'ep', compPat: 'arp', pad: false, bass: 'slap', bassPat: 'slap', echo: 0.4,
      dr: { k: 'x.......x...x...', s: '....x.......x...', h: 'x.o.x.o.x.o.x.o.', r: '' },
      prog: '0 4 5 2 3 0 3 4',
      mel: '4/4 2/2 4/2 7/4 4/4|6/4 4/2 6/2 8/6 r/2|9/4 7/2 5/2 7/4 5/4|4/2 6/2 9/4 8/4 6/4|5/4 7/2 8/2 9/4 7/4|7/6 4/2 2/4 4/4|5/4 7/4 9/4 8/2 7/2|6/4 8/4 7/2 6/2 4/2 r/2'
    },
    map: {
      lg: 1.1, bpm: 84, key: 62, mode: 'mixo', lead: 'mari', comp: 'ep', compPat: 'stab', pad: true, bass: 'soft', bassPat: 'root2', echo: 0.45,
      dr: { k: 'x...............', s: '', h: '', r: '..........x.....', sh: 'x.x.x.x.x.x.x.x.' },
      prog: '0 6 3 0 1 6 4 0',
      mel: '4/3 r/1 4/2 5/2 7/4 5/2 4/2|6/4 4/2 2/2 4/6 r/2|5/4 7/2 5/2 3/4 5/4|7/6 4/2 2/4 0/4|8/4 7/2 5/2 8/4 7/4|9/4 8/2 6/2 8/4 6/4|7/4 6/2 4/2 6/4 7/4|7/8 r/2 4/2 2/2 4/2'
    },
    baia: {
      bpm: 104, key: 55, mode: 'major', lead: 'pulse', comp: 'ep', compPat: 'stab', pad: false, bass: 'slap', bassPat: 'slap2', echo: 0.38,
      dr: { k: 'x.......x.....x.', s: '', h: '', r: '....x.......x...', sh: 'x.x.x.x.x.x.x.x.' },
      prog: '0 3 0 4 5 3 1 4',
      mel: '2/2 4/2 7/4 4/2 2/2 4/4|5/2 7/2 8/4 7/2 5/2 3/4|4/2 2/2 4/2 7/2 9/4 7/4|8/4 6/2 4/2 6/4 r/4|9/2 7/2 5/4 7/2 9/2 8/4|7/4 5/2 3/2 5/4 7/4|6/2 8/2 9/4 8/2 6/2 4/4|4/2 6/2 8/4 6/4 4/2 r/2'
    },
    recife: {
      lg: 1.1, bpm: 92, key: 57, mode: 'lydian', lead: 'mari', comp: 'bell', compPat: 'box', pad: false, bass: 'slap', bassPat: 'sync', echo: 0.45,
      dr: { k: 'x.......x.......', s: '', h: '', r: '....x.......x...', sh: 'x.x.x.x.x.x.x.x.' },
      prog: '0 1 0 1 4 5 1 0',
      mel: '4/3 7/1 9/4 7/2 4/2 7/4|8/4 6/2 8/2 10/4 8/4|9/2 7/2 4/4 7/2 9/2 11/4|10/6 8/2 6/4 8/4|11/4 9/2 7/2 9/4 11/4|9/4 7/2 5/2 7/4 9/4|8/2 10/2 12/4 10/2 8/2 6/4|7/6 4/2 7/2 9/2 7/4'
    },
    kelp: {
      bpm: 80, key: 57, mode: 'dorian', lead: 'pulse', comp: 'ep', compPat: 'slow', pad: true, bass: 'soft', bassPat: 'eighths', echo: 0.5, duty: 0.125,
      dr: { k: 'x.......x.......', s: '', h: '', r: '..........x.....', sh: '..x...x...x...x.' },
      prog: '0 3 0 6 2 3 6 4',
      mel: '4/4 2/2 0/2 2/4 4/4|5/4 3/2 5/2 7/6 r/2|4/2 2/2 0/4 2/2 4/2 7/4|6/6 4/2 2/4 r/4|4/4 6/2 7/2 6/4 4/4|5/2 7/2 9/4 7/2 5/2 3/4|6/4 4/2 6/2 8/4 6/4|7/4 6/2 4/2 2/4 4/2 r/2'
    },
    mar: {
      lg: 0.6, bpm: 88, key: 53, mode: 'major', lead: 'brass', comp: 'bell', compPat: 'slow', pad: true, bass: 'soft', bassPat: 'root', echo: 0.5,
      dr: { k: 'x.......x.......', s: '', h: '', r: '', sh: 'x...x...x...x...' },
      prog: '0 4 5 3 0 4 3 4',
      mel: '4/8 7/4 4/4|6/8 8/4 6/4|7/6 5/2 7/4 9/4|8/8 7/4 5/4|9/6 7/2 4/4 7/4|8/4 6/4 4/4 6/4|5/4 7/4 8/4 9/2 8/2|6/8 4/4 r/4'
    },
    abismo: {
      lg: 0.5, leadOct: 12, bpm: 72, key: 50, mode: 'phryg', lead: 'bell', comp: 'ep', compPat: 'slow', pad: true, bass: 'brass', bassPat: 'pad', echo: 0.62,
      dr: { k: '', s: '', h: '', r: '', sh: '' },
      prog: '0 1 0 5 6 1 5 0',
      mel: '0/6 r/2 1/4 0/4|2/4 1/2 0/2 -1/8|4/6 r/2 3/4 2/4|5/8 3/4 2/4|4/4 3/4 2/6 r/2|1/4 2/4 3/6 r/2|5/6 4/2 3/4 2/4|0/12 r/4'
    },
    aquarium: {
      lg: 1.4, bpm: 76, key: 53, mode: 'major', lead: 'music', comp: 'ep', compPat: 'box', pad: false, bass: 'soft', bassPat: 'root', echo: 0.5, leadOct: 12,
      dr: { k: '', s: '', h: '', r: '', sh: '' },
      prog: '0 5 3 4 0 5 1 4',
      mel: '4/2 7/2 9/2 7/2 4/4 2/2 4/2|5/2 7/2 9/2 7/2 5/4 4/2 5/2|5/2 7/2 8/2 7/2 5/4 3/2 5/2|6/2 8/2 9/4 8/2 6/2 4/4|7/2 9/2 11/2 9/2 7/4 4/2 7/2|8/2 7/2 5/2 7/2 9/4 8/2 7/2|6/2 8/2 9/2 8/2 6/4 5/2 6/2|4/6 6/2 4/4 r/4'
    },
    ending: {
      lg: 0.5, bpm: 76, key: 60, mode: 'major', lead: 'ep', comp: 'bell', compPat: 'slow', pad: true, bass: 'soft', bassPat: 'root', echo: 0.55,
      dr: { k: '', s: '', h: '', r: '', sh: 'x...x...x...x...' },
      prog: '0 4 5 2 3 0 1 4',
      mel: '7/6 4/2 7/4 9/4|8/6 6/2 8/4 11/4|9/6 7/2 5/4 7/4|9/4 8/2 6/2 4/8|8/6 7/2 5/4 7/4|7/4 9/4 11/4 9/4|10/6 9/2 8/4 6/4|8/8 6/4 4/2 r/2'
    }
  };

  // compile the DSL once
  Object.keys(THEMES).forEach(function (k) {
    var th = THEMES[k];
    th.chords = th.prog.split(/\s+/).map(function (x) { return parseInt(x, 10); });
    th.bars = th.mel.split('|').map(function (bar) {
      var s = 0, evs = [];
      bar.trim().split(/\s+/).forEach(function (tok) {
        var p = tok.split('/'), l = parseInt(p[1], 10) || 1;
        if (p[0] !== 'r' && s < 16) evs.push({ s: s, d: parseInt(p[0], 10), l: Math.min(l, 16 - s) });
        s += l;
      });
      return evs;
    });
    th.nBars = th.bars.length;
  });


  var M = A.music = {};
  var theme = null, themeName = '', night = false, storm = false, rainy = false;
  var tSm = 0, fightOn = false, boss = false, frenzy = false;
  var bar = 0, step = 0, pass = 0, vnow = 0;
  var cur = null, active = [], nodes = null;
  var CAP = 18;                    // the old 'high' quality voice cap (musicVoices 6 × 3)

  function rnd() { return A.rand(); }
  function room(prio) {
    var k = 0;
    for (var i = 0; i < active.length; i++) if (active[i] > vnow) active[k++] = active[i];
    active.length = k;
    return prio >= 2 || k < CAP;
  }
  function reg(end) { active.push(end); }

  function buildNodes() {
    var n = {};
    n.duck = A.gain(1, A.bus.music);
    function sub(vol, send) {
      var g = A.gain(vol, n.duck);
      var s = A.gain(send, A.bus.musicSend);
      g.connect(s);
      return { g: g, s: s };
    }
    n.lead = sub(1, 0.4); n.comp = sub(0.8, 0.35); n.bass = sub(0.95, 0.0); n.drum = sub(0.85, 0.1);
    nodes = n;
  }

  // ---------------------------------------------------------------- percussion (noise + short tones)
  function nzHit(dest, t, ftype, f, q, a, d, peak) {
    var g = A.gain(0.0001, dest);
    var fl = A.filter(ftype, f, q, g);
    var src = A.noise('white', fl, false);
    var end = A.env(g, t, a, d, peak);
    src.start(t, rnd() * 1.5);
    src.stop(end + 0.02);
    src.onended = function () { try { g.disconnect(); fl.disconnect(); } catch (e) { /* ignore */ } };
    return end;
  }
  function tnHit(dest, t, type, f0, f1, d, peak) {
    var g = A.gain(0.0001, dest);
    var o = A.ctx.createOscillator();
    if (typeof type === 'string') o.type = type; else o.setPeriodicWave(type);
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + d * 0.6);
    o.connect(g);
    var end = A.env(g, t, 0.002, d, peak);
    o.start(t); o.stop(end + 0.02);
    o.onended = function () { try { g.disconnect(); } catch (e) { /* ignore */ } };
    return end;
  }
  function kick(t, v) {
    if (!room(1)) return;
    reg(tnHit(nodes.drum.g, t, 'sine', 190, 48, 0.2, 0.55 * v));
    nzHit(nodes.drum.g, t, 'bandpass', 1800, 0.8, 0.001, 0.025, 0.22 * v);
  }
  function snare(t, v) {
    if (!room(1)) return;
    reg(nzHit(nodes.drum.g, t, 'bandpass', 1900, 0.7, 0.001, 0.15, 0.3 * v));
    tnHit(nodes.drum.g, t, 'triangle', 280, 170, 0.1, 0.18 * v);
  }
  function rim(t, v) {
    if (!room(0)) return;
    reg(tnHit(nodes.drum.g, t, A.wave(0.25), 860, 800, 0.04, 0.13 * v));
    nzHit(nodes.drum.g, t, 'highpass', 3200, 0.7, 0.001, 0.02, 0.1 * v);
  }
  function hat(t, v, open) {
    if (!room(0)) return;
    reg(nzHit(nodes.drum.g, t, 'highpass', 6800, 0.7, 0.001, open ? 0.14 : 0.035, 0.1 * v));
  }
  function shaker(t, v) {
    if (!room(0)) return;
    reg(nzHit(nodes.drum.g, t, 'bandpass', 5600, 1.1, 0.012, 0.07, 0.11 * v));
  }
  function tom(t, v, f) {
    if (!room(1)) return;
    reg(tnHit(nodes.drum.g, t, 'sine', f * 1.5, f, 0.2, 0.4 * v));
    nzHit(nodes.drum.g, t, 'bandpass', 1500, 1, 0.001, 0.03, 0.12 * v);
  }

  // ---------------------------------------------------------------- pitch helpers
  function modeName() {
    var m = theme.mode;
    if (storm) return STORM_MODE[m] || 'minor';
    if (night) return NIGHT_MODE[m] || 'minor';
    return m;
  }
  function degMidi(d, key, scale) {
    var o = Math.floor(d / 7), i = ((d % 7) + 7) % 7;
    return key + o * 12 + scale[i];
  }

  // ---------------------------------------------------------------- voices
  function leadNote(t, midi, len, sd, vel) {
    if (!room(2)) return;
    var f = A.mtof(midi), dur = Math.max(0.06, len * sd * 0.94), pk = 0.19 * vel * (theme.lg || 1) * (rainy ? 0.85 : 1), d = nodes.lead.g, end;
    switch (theme.lead) {
      case 'pulse': end = A.pulse(d, f, t, dur, { duty: theme.duty || 0.25, det: 6, cut: night ? 2200 : 3400, cutEnv: 2, cutDecay: 0.18, a: 0.01, sus: 0.7, rel: 0.1, peak: pk, vib: true }); break;
      case 'tri': end = A.pulse(d, f, t, dur, { type: 'triangle', det: 5, cut: 2800, a: 0.012, sus: 0.8, rel: 0.12, peak: pk * 1.2, vib: true }); break;
      case 'mari': end = A.fm(d, f, t, { r: 4, i0: 1.7, i1: 0.05, id: 0.06, d: Math.min(0.7, 0.2 + dur), peak: pk * 1.15 }); break;
      case 'bell': end = A.fm(d, f, t, { r: 3.5, i0: 1.8, i1: 0.15, id: 0.4, d: Math.min(1.8, 0.6 + dur * 1.5), peak: pk }); break;
      case 'brass': end = A.fm(d, f, t, { r: 1, i0: 0.4, i1: 1.6, id: 0.1, a: 0.05, dur: dur, sus: 0.85, rel: 0.18, d: 0.5, peak: pk * 0.9 }); break;
      case 'music': end = A.fm(d, f, t, { r: 3, i0: 1.3, i1: 0.08, id: 0.25, d: Math.min(1.4, 0.5 + dur), peak: pk * 0.95 }); break;
      default: end = A.fm(d, f, t, { r: 1, i0: 1.8, i1: 0.25, id: 0.45, d: Math.min(1.3, 0.4 + dur), peak: pk }); break;
    }
    reg(end);
  }
  function compNote(t, midi, vel, len) {
    if (!room(0)) return;
    var f = A.mtof(midi), pk = 0.1 * vel * (night ? 0.8 : 1), d = nodes.comp.g, end;
    switch (theme.comp) {
      case 'bell': end = A.fm(d, f, t, { r: 3.5, i0: 1.4, i1: 0.1, id: 0.3, d: 1.1, peak: pk * 1.1 }); break;
      case 'pluck': end = A.pulse(d, f, t, 0, { duty: 0.25, cut: 1400, cutEnv: 3, cutDecay: 0.1, perc: 0.35, peak: pk * 1.3 }); break;
      case 'music': end = A.fm(d, f, t, { r: 3, i0: 1.2, i1: 0.08, id: 0.2, d: 0.9, peak: pk }); break;
      default: end = A.fm(d, f, t, { r: 1, i0: 1.6, i1: 0.2, id: 0.35, d: Math.min(1.1, 0.35 + len * 0.1), peak: pk * 1.2 }); break;
    }
    reg(end);
  }
  function padNote(t, midi, dur, pk) {
    if (!room(1)) return;
    reg(A.fm(nodes.comp.g, A.mtof(midi), t, { r: 1, i0: 0.7, i1: 1.0, id: 0.5, a: 0.35, dur: dur, sus: 0.9, rel: 0.5, d: 0.4, peak: pk }));
  }
  function bassNote(t, midi, dur, vel) {
    if (!room(2)) return;
    var f = A.mtof(midi), d = nodes.bass.g, pk = 0.3 * vel, end;
    if (theme.bass === 'slap') end = A.fm(d, f, t, { r: 1, i0: 3.8, i1: 1.2, id: 0.14, d: 0.32, peak: pk });
    else if (theme.bass === 'brass') end = A.fm(d, f * 2, t, { r: 1, i0: 0.8, i1: 2.2, id: 0.2, a: 0.04, dur: dur, sus: 0.9, rel: 0.15, d: 0.5, peak: pk * 0.4 });
    else end = A.fm(d, f, t, { r: 1, i0: 2.4, i1: 0.8, id: 0.2, d: 0.5, peak: pk * 0.85 });
    reg(end);
  }

  // ---------------------------------------------------------------- bar planning (generative variation)
  function planBar(t, sd) {
    var th = theme, scale = MODES[modeName()], key = th.key;
    var cd = th.chords[bar % th.chords.length];
    var degs = [cd, cd + 2, cd + 4].map(function (x) { return x % 7; });
    if (frenzy || rnd() < 0.2) degs.push((cd + 6) % 7);
    var inv = Math.floor(rnd() * 3);
    degs.sort(function (a, b) { return a - b; });
    for (var i = 0; i < inv; i++) degs[i] += 7;
    degs.sort(function (a, b) { return a - b; });
    var tones = degs.map(function (d) { return degMidi(d, key + (th.leadOct ? 12 : 0), scale); });
    // bass root, kept in a phone-audible octave
    var br = degMidi(cd % 7, key - 12, scale);
    while (br < 38) br += 12;
    while (br > 50) br -= 12;
    var fifth = br + 7, third = br + (scale[2] === 4 ? 4 : 3);
    // melody with ornaments / night sparsity / harmony pass
    var src = th.bars[bar % th.nBars], mel = {}, harm = pass % 2 === 1 && rnd() < 0.6 && !night;
    var oct = (th.leadOct || 0) + 12 + (bar === th.nBars - 1 && pass % 4 === 3 && rnd() < 0.4 ? 12 : 0);
    src.forEach(function (e) {
      if (night && e.s % 4 && e.l <= 2 && rnd() < 0.45) return;
      var m = degMidi(e.d, key + oct, scale);
      if (e.l >= 4 && !night && rnd() < 0.3) {
        var nb = degMidi(e.d + (rnd() < 0.5 ? 1 : -1), key + oct, scale);
        mel[e.s] = { m: m, l: e.l - 2 };
        mel[e.s + e.l - 2] = { m: nb, l: 1, v: 0.7 };
        mel[e.s + e.l - 1] = { m: m, l: 1, v: 0.75 };
      } else mel[e.s] = { m: m, l: e.l };
      if (harm && e.l >= 2) mel[e.s].h = degMidi(e.d - 2, key + oct, scale);
    });
    var fill = (bar % 4 === 3) && rnd() < (bar === th.nBars - 1 ? 0.65 : 0.35);
    cur = { tones: tones, br: br, fifth: fifth, third: third, mel: mel, root: cd % 7, fill: fill, scale: scale, key: key, nextRoot: degMidi(th.chords[(bar + 1) % th.chords.length] % 7, key - 12, scale) };
    while (cur.nextRoot < 38) cur.nextRoot += 12;
    while (cur.nextRoot > 50) cur.nextRoot -= 12;
  }

  // ---------------------------------------------------------------- one 16th step
  function playStep(t, sd) {
    var th = theme, s = step, T = tSm, fight = T > 0.2;
    var vol = night ? 0.88 : 1;
    // lead
    var e = cur.mel[s];
    if (e) {
      leadNote(t, e.m, e.l, sd, (e.v || 1) * vol * (fightOn ? 0.9 : 1));
      if (e.h) leadNote(t, e.h, e.l, sd, 0.45 * vol);
    }
    // comp
    var cp = COMP[th.compPat].charAt(s), tn = cur.tones;
    if (th.pad && s === 0) { padNote(t, tn[0], sd * 16, night ? 0.025 : 0.032); padNote(t, tn[1], sd * 16, 0.02); }
    if (cp === 'c') { compNote(t, tn[0], 0.8, 2); compNote(t, tn[1], 0.8, 2); compNote(t, tn[2], 0.7, 2); }
    else if (cp >= '0' && cp <= '3') {
      var idx = +cp, m = idx < tn.length ? tn[idx] : tn[0] + 12;
      if (night && s % 4 && rnd() < 0.4) m = 0;
      if (m) compNote(t + (s % 4 === 2 && th.swing ? sd * 0.2 : 0), m, 0.85, 2);
    }
    // bass: theme line, or the driving fight line once tension rises; storm adds an 8th drive
    var bp = th.bassPat, bv = 1;
    if (night) bp = BASS.root;
    if (storm && !fight) bp = BASS.eighths;
    if (T > 0.3) { bp = T > 0.8 ? 'rr8.rr8.rr8.rr8.' : BASS.eighths; bv = 0.95; }
    if (bp) {
      var bstr = BASS[bp] || bp, bc = bstr.charAt(s);
      if (bc && bc !== '.') {
        var bm = cur.br;
        if (bc === '5') bm = cur.fifth; else if (bc === '8') bm = cur.br + 12; else if (bc === '3') bm = cur.third;
        else if (bc === 'a') bm = cur.nextRoot + (cur.nextRoot > cur.br ? -2 : 2);
        bassNote(t, bm, sd * (bstr === BASS.pad || th.bass === 'brass' ? 16 : 2), bv * (night ? 0.8 : 1) * (storm ? 1.1 : 1));
      }
    }
    if (boss && fightOn && s % 8 === 0 && room(2)) {
      reg(A.fm(nodes.bass.g, A.mtof(cur.br + (s ? 6 : 0)), t, { r: 1, i0: 0.8, i1: 2.5, id: 0.3, a: 0.06, dur: sd * 7, sus: 0.9, rel: 0.2, d: 0.5, peak: 0.16 }));
    }
    // drums: theme pattern at rest (day only), fight pattern overlaid by tension
    var dr = th.dr, kk, ss, hh, rr = dr.r ? dr.r.charAt(s) : '', sh = dr.sh ? dr.sh.charAt(s) : '';
    if (night) { rr = ''; sh = dr.sh ? (s % 4 === 0 ? 'x' : '') : ''; }
    kk = dr.k ? dr.k.charAt(s) : ''; ss = dr.s ? dr.s.charAt(s) : ''; hh = dr.h ? dr.h.charAt(s) : '';
    if (night) { kk = s === 0 ? 'o' : ''; ss = ''; hh = ''; }
    if (fight) {
      kk = (T > 0.75 ? 'x...x...x...x...' : T > 0.5 ? 'x.......x...x...' : 'x.......x.......').charAt(s);
      ss = T > 0.85 ? '..o.x..o....x.o.'.charAt(s) : T > 0.55 ? '....x.......x...'.charAt(s) : '';
      hh = T > 0.8 ? 'xoxoxoxoxoxoxoxo'.charAt(s) : T > 0.4 ? 'x.o.x.o.x.o.x.o.'.charAt(s) : '';
      rr = ''; sh = '';
    }
    if (frenzy) sh = s % 2 ? 'o' : 'x';
    var sv = night ? 0.7 : 1;
    if (kk === 'x') kick(t, 1 * sv); else if (kk === 'o') kick(t, 0.6 * sv);
    if (ss === 'x') snare(t, 1 * sv); else if (ss === 'o') snare(t, 0.45);
    if (rr === 'x') rim(t, 1 * sv);
    if (hh === 'x') hat(t, 1, false); else if (hh === 'o') hat(t, 0.55, false);
    if (sh === 'x') shaker(t, 1 * sv); else if (sh === 'o') shaker(t, 0.55);
    // fast arp over the top when the fight is intense
    if (T > 0.9 && s % 2 === 0 && room(0)) {
      reg(A.pulse(nodes.comp.g, A.mtof(tn[(s >> 1) % tn.length] + 12), t, 0, { duty: 0.125, cut: 2800, cutEnv: 1.5, cutDecay: 0.05, perc: 0.1, peak: 0.07 }));
    }
    // fills on phrase ends
    if (cur.fill && s >= 12) {
      if (th.dr.k && !night || fight) {
        if (s === 12 || s === 14 || s === 15) tom(t, 0.5, s === 12 ? 160 : s === 14 ? 130 : 110);
      } else if (s % 1 === 0 && room(0)) {
        var up = degMidi(cur.root + (s - 12) * 2 + 7, cur.key + 12, cur.scale);
        reg(A.fm(nodes.comp.g, A.mtof(up), t, { r: 3.5, i0: 1.2, i1: 0.1, id: 0.2, d: 0.7, peak: 0.07 }));
      }
    }
  }


  // ---------------------------------------------------------------- fight layer (one step), for the stems
  function fightStep(t, sd, T) {
    var s = step;
    var bp = T > 0.8 ? 'rr8.rr8.rr8.rr8.' : BASS.eighths, bc = bp.charAt(s);
    // short notes even for the brass bass (the abyss): sustained eighths would pile up into a wall of sound
    if (bc && bc !== '.') bassNote(t, bc === '8' ? cur.br + 12 : cur.br, sd * 2, 0.95);
    var kk = (T > 0.75 ? 'x...x...x...x...' : T > 0.5 ? 'x.......x...x...' : 'x.......x.......').charAt(s);
    var ss = T > 0.85 ? '..o.x..o....x.o.'.charAt(s) : T > 0.55 ? '....x.......x...'.charAt(s) : '';
    var hh = T > 0.8 ? 'xoxoxoxoxoxoxoxo'.charAt(s) : T > 0.4 ? 'x.o.x.o.x.o.x.o.'.charAt(s) : '';
    if (kk === 'x') kick(t, 1);
    if (ss === 'x') snare(t, 1); else if (ss === 'o') snare(t, 0.45);
    if (hh === 'x') hat(t, 1, false); else if (hh === 'o') hat(t, 0.55, false);
    if (cur.fill && s >= 12 && (s === 12 || s === 14 || s === 15)) tom(t, 0.5, s === 12 ? 160 : s === 14 ? 130 : 110);
  }

  function applyMix() {
    var e = theme.echo * (night ? 1.35 : 1);
    nodes.lead.s.gain.value = Math.min(0.9, e);
    nodes.comp.s.gain.value = Math.min(0.85, e * 0.85);
    nodes.drum.s.gain.value = night ? 0.05 : 0.1;
    A.setEcho(60 / theme.bpm / 2, night ? 0.5 : 0.42);
  }

  // Step length in whole samples, so a loop is an exact number of frames.
  M.stepFrames = function (name, sr) { return Math.round(sr * 60 / THEMES[name].bpm / 4); };

  // schedule(name, o{night, fight (T level or 0), bars, sr, until}) — schedules every step that starts before
  // o.until (seconds) of a loop of o.bars bars repeated from t = 0. Returns {sd, loopSec, bars}.
  M.schedule = function (name, o) {
    theme = THEMES[name]; themeName = name; night = !!o.night;
    var bars = o.bars || 16, sr = o.sr, sdF = M.stepFrames(name, sr), sd = sdF / sr, T = o.fight || 0;
    active = []; cur = null;
    buildNodes();
    applyMix();
    if (T) { nodes.bass.s.gain.value = 0; nodes.drum.s.gain.value = 0; }   // stems are dry (mono)
    var tag = name + '|' + (night ? 'n' : 'd') + '|' + (T ? 'f' : 't');
    for (var k = 0; ; k++) {
      // step times sit a quarter frame after a whole sample so every repetition rounds to the same frame
      var t = (k * sdF + 0.25) / sr;
      if (t >= o.until) break;
      var barAbs = Math.floor(k / 16) % bars;
      step = k % 16;
      vnow = t;
      if (step === 0) {
        bar = barAbs % theme.nBars;
        pass = barAbs < theme.nBars ? 0 : 3;
        A.seed(A.hash(tag + '|' + barAbs));
        planBar(t, sd);
      }
      A.seed(A.hash(tag + '|' + barAbs + '|' + step));
      if (T) fightStep(t, sd, T); else playStep(t, sd);
    }
    return { sd: sd, loopSec: bars * 16 * sd, bars: bars, bpm: 60 / (sd * 4) };
  };

  // Do night and day give a different bass root on any chord of this theme? (then the fight stem needs a night take)
  M.nightBassDiffers = function (name) {
    var th = THEMES[name], a = MODES[th.mode], b = MODES[NIGHT_MODE[th.mode] || 'minor'];
    return th.chords.some(function (cd) { return a[cd % 7] !== b[cd % 7]; });
  };

  // legendary nearby: low brass swell on a tritone with bells (the old M.omen), on the given key
  M.omen = function (t, key) {
    theme = THEMES.abismo; night = false;
    buildNodes(); applyMix();
    var b = (key || theme.key) - 12;
    while (b < 40) b += 12;
    [0, 6].forEach(function (x, i) {
      A.fm(nodes.comp.g, A.mtof(b + x), t + i * 0.2, { r: 1, i0: 0.3, i1: 1.9, id: 1.2, a: 0.8, dur: 2.6, sus: 0.85, rel: 1.2, d: 1, peak: 0.12 });
    });
    return A.fm(nodes.comp.g, A.mtof(b + 31), t + 1.2, { r: 3.5, i0: 1.6, i1: 0.1, id: 0.4, d: 2.5, peak: 0.1 });
  };

  M.THEMES = THEMES;
  M.MODES = MODES;
})(window);
