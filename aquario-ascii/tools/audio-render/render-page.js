// Água-Tinta — audio render tool: page-side driver (runs in render.html, driven by render.js through Playwright).
// AQR.list() → every sound to record; AQR.render(id) → renders it on an OfflineAudioContext (sample-accurate,
// faster than real time) and returns a 16-bit WAV (base64) plus loop points and metadata; AQR.analyse(id, mp3)
// decodes the encoded MP3 the way the game will (decodeAudioData) and measures the decoder offset, duration and
// the loop seam against the reference render.
// Loops are rendered seamlessly: the content is scheduled as a strictly periodic sequence (identical bars, same
// seeds), a warm-up period fills the echo/release tails, and the file keeps PAD seconds on both sides of the loop
// so MP3 encoder padding / decoder delay can never land inside the loop region.
(function (G) {
  'use strict';

  var S = G.SYN, M = S.music;
  var SR = 44100, PAD_SEC = 0.25, NORM = 0.891;     // −1 dBFS peak (music/ambience); the manifest gain restores the level
  var THEMES = ['title', 'map', 'baia', 'recife', 'kelp', 'mar', 'abismo', 'aquarium', 'ending'];
  var ZONES = ['baia', 'recife', 'kelp', 'mar', 'abismo'];
  var JINGLES = { catch: 0.9, newSpecies: 1.4, rare: 1.2, legendary: 2.6, goal: 1.1, omen: 3.2 };
  var DUCK = { buy: 0.5, escape: 0.8, snap: 0.5 };   // sfx that also dip the music
  var ALIAS = { 'splash-jump': 'splashBig', reelClick: 'reel' };
  var FIGHT_T = 0.8;                                 // tension level the fight stems are played at

  var refs = {};

  function list() {
    var out = [];
    Object.keys(S.recipes).forEach(function (n) {
      if (ALIAS[n]) return;
      var j = JINGLES[n] !== undefined;
      out.push({ id: n, kind: j ? 'jingle' : 'sfx', file: (j ? 'jingles/' : 'sfx/') + n + '.mp3', duck: j ? JINGLES[n] : DUCK[n] });
    });
    out.push({ id: 'omen', kind: 'jingle', file: 'jingles/omen.mp3', duck: JINGLES.omen });
    THEMES.forEach(function (t) { out.push({ id: 'theme-' + t, kind: 'music', file: 'music/' + t + '.mp3', theme: t }); });
    ZONES.forEach(function (z) { out.push({ id: 'theme-' + z + '-night', kind: 'music', file: 'music/' + z + '-night.mp3', theme: z, night: true }); });
    ZONES.forEach(function (z) {
      out.push({ id: 'fight-' + z, kind: 'stem', file: 'music/fight-' + z + '.mp3', theme: z, sync: 'theme-' + z });
      if (M.nightBassDiffers(z)) out.push({ id: 'fight-' + z + '-night', kind: 'stem', file: 'music/fight-' + z + '-night.mp3', theme: z, night: true, sync: 'theme-' + z + '-night' });
    });
    out.push({ id: 'reel-loop', kind: 'loop', file: 'sfx/reel-loop.mp3' });
    out.push({ id: 'amb-water', kind: 'ambience', file: 'ambience/water.mp3' });
    out.push({ id: 'amb-rain', kind: 'ambience', file: 'ambience/rain.mp3' });
    out.push({ id: 'amb-storm', kind: 'ambience', file: 'ambience/storm.mp3' });
    out.push({ id: 'silence', kind: 'silence', file: 'silence.mp3' });
    return out;
  }
  function find(id) { var l = list(); for (var i = 0; i < l.length; i++) if (l[i].id === id) return l[i]; return null; }

  function offline(frames, ch) { return new OfflineAudioContext(ch || 2, frames, SR); }
  function chans(buf) { var c = []; for (var i = 0; i < buf.numberOfChannels; i++) c.push(buf.getChannelData(i)); return c; }

  // ---------------------------------------------------------------- per-kind renders → {ch:[Float32Array], loop?}
  function renderSfx(spec) {
    var ctx = offline(SR * 7);
    S.setup(ctx, {});
    S.seed(S.hash('sfx|' + spec.id));
    var end;
    if (spec.id === 'omen') end = M.omen(0, 50);
    else end = S.recipes[spec.id](ctx, S.bus.sfx, spec.id === 'bloop' ? { f: 600 } : {}, 0);
    return ctx.startRendering().then(function (b) { return trim(chans(b), end); });
  }
  function trim(ch, end) {
    var peak = 0, i, c;
    for (c = 0; c < ch.length; c++) for (i = 0; i < ch[c].length; i++) peak = Math.max(peak, Math.abs(ch[c][i]));
    var thr = peak * Math.pow(10, -54 / 20), last = Math.ceil((end || 0) * SR);
    for (c = 0; c < ch.length; c++) for (i = ch[c].length - 1; i > last; i--) if (Math.abs(ch[c][i]) > thr) { last = i; break; }
    var n = Math.min(ch[0].length, last + Math.round(0.04 * SR)), fade = Math.round(0.03 * SR);
    return { ch: ch.map(function (d) {
      var o = d.slice(0, n);
      for (var k = 0; k < fade; k++) o[n - 1 - k] *= k / fade;
      return o;
    }) };
  }
  // generic loop render: schedule(ctx) builds a strictly periodic graph of period L frames starting at t = 0;
  // warm periods are rendered first; the kept slice is [W·L − PAD, (W+1)·L + PAD).
  function renderLoop(L, warm, ch, schedule) {
    var PAD = Math.round(PAD_SEC * SR), from = warm * L - PAD, to = (warm + 1) * L + PAD;
    var ctx = offline(to + 16, ch);
    schedule(ctx, to / SR + 0.05);
    return ctx.startRendering().then(function (b) {
      var all = chans(b);
      var seam = 0;
      // reference seam check: one period later the signal must repeat (render periodicity)
      all.forEach(function (d) {
        var e = 0, p = 0;
        for (var i = 0; i < PAD; i++) { var x = d[warm * L + i], y = d[(warm + 1) * L + i]; e += (x - y) * (x - y); p += x * x; }
        seam = Math.max(seam, p > 0 ? Math.sqrt(e / p) : 0);
      });
      return { ch: all.map(function (d) { return d.slice(from, to); }), loop: [PAD, PAD + L], L: L, refSeam: seam };
    });
  }
  function renderTheme(spec) {
    var bars = spec.kind === 'stem' ? 8 : 16, sdF = M.stepFrames(spec.theme, SR), L = bars * 16 * sdF;
    var info = null;
    return renderLoop(L, 1, 2, function (ctx, until) {
      S.setup(ctx);
      info = M.schedule(spec.theme, { night: !!spec.night, fight: spec.kind === 'stem' ? FIGHT_T : 0, bars: bars, sr: SR, until: until });
    }).then(function (r) { r.meta = { bpm: +info.bpm.toFixed(4), bars: bars, beats: bars * 4 }; return r; });
  }
  function renderReel() {
    var L = SR, CLICKS = 16;                         // 16 clicks per second at playbackRate 1, alternating pitch
    return renderLoop(L, 3, 2, function (ctx, until) {
      S.setup(ctx, {});
      var n = 0;
      for (var t = 0; t < until; t = ++n / CLICKS) {
        var src = ctx.createBufferSource();
        src.buffer = S.buffers.reelClick;
        src.playbackRate.value = (n % 2 ? 0.8 : 1) * 1.0;
        var g = S.gain(0.2, S.bus.sfx);
        src.connect(g);
        src.start(t);
      }
    }).then(function (r) { r.meta = { clicksPerSec: CLICKS }; return r; });
  }
  function renderAmb(spec) {
    var secs = spec.id === 'amb-water' ? 20 : spec.id === 'amb-rain' ? 8 : 24, L = secs * SR;
    return renderLoop(L, 1, 1, function (ctx, until) {
      S.setup(ctx, {});
      var src = ctx.createBufferSource();
      src.loop = true;
      var g = S.gain(1, S.bus.ambience);
      if (spec.id === 'amb-water') {
        // waves: brown noise → lowpass, slow swell (2 whole LFO cycles per loop)
        src.buffer = S.cyclicNoise('brown', L, 'water');
        src.connect(S.filter('lowpass', 1200, 0.6, g));
        var lfo = S.osc('sine', 2 / secs), dep = S.gain(0.45);
        lfo.connect(dep); dep.connect(g.gain);
        lfo.start(0);
      } else if (spec.id === 'amb-rain') {
        src.buffer = S.cyclicNoise('white', L, 'rain');
        src.connect(S.filter('bandpass', 2600, 0.6, g));
      } else {
        // storm: low rumble (brown noise → lowpass 110 Hz) with three thunder swells per loop
        src.buffer = S.cyclicNoise('brown', L, 'storm');
        src.connect(S.filter('lowpass', 110, 0.8, g));
        var sw = [[1.5, 0.55, 0.9, 4.2], [9.5, 0.75, 1.4, 4.6], [16.8, 0.45, 0.7, 3.6]];
        g.gain.setValueAtTime(0.06, 0);
        for (var k = 0; k * secs < until; k++) {
          sw.forEach(function (s) {
            var t0 = k * secs + s[0];
            g.gain.linearRampToValueAtTime(0.06, t0);
            g.gain.linearRampToValueAtTime(s[1], t0 + s[2]);
            g.gain.linearRampToValueAtTime(0.06, t0 + s[2] + s[3]);
          });
        }
      }
      src.start(0);
    });
  }
  function renderSilence() { return Promise.resolve({ ch: [new Float32Array(Math.round(0.25 * SR))], silent: true }); }

  // ---------------------------------------------------------------- WAV / base64
  function toWav(ch) {
    var n = ch[0].length, nc = ch.length, buf = new ArrayBuffer(44 + n * nc * 2), v = new DataView(buf), p = 0;
    function str(s) { for (var i = 0; i < s.length; i++) v.setUint8(p++, s.charCodeAt(i)); }
    function u32(x) { v.setUint32(p, x, true); p += 4; }
    function u16(x) { v.setUint16(p, x, true); p += 2; }
    str('RIFF'); u32(36 + n * nc * 2); str('WAVE'); str('fmt '); u32(16); u16(1); u16(nc); u32(SR); u32(SR * nc * 2); u16(nc * 2); u16(16);
    str('data'); u32(n * nc * 2);
    for (var i = 0; i < n; i++) for (var c = 0; c < nc; c++) {
      var s = Math.max(-1, Math.min(1, ch[c][i]));
      v.setInt16(p, Math.round(s * 32767), true); p += 2;
    }
    return new Uint8Array(buf);
  }
  function b64(u8) {
    var s = '', CH = 0x8000;
    for (var i = 0; i < u8.length; i += CH) s += String.fromCharCode.apply(null, u8.subarray(i, i + CH));
    return btoa(s);
  }
  function unb64(str) { var s = atob(str), u = new Uint8Array(s.length); for (var i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u; }

  // ---------------------------------------------------------------- public
  function render(id) {
    var spec = find(id);
    if (!spec) return Promise.reject(new Error('unknown sound ' + id));
    var p = spec.kind === 'music' || spec.kind === 'stem' ? renderTheme(spec)
      : spec.kind === 'loop' ? renderReel()
      : spec.kind === 'ambience' ? renderAmb(spec)
      : spec.kind === 'silence' ? renderSilence()
      : renderSfx(spec);
    return p.then(function (r) {
      var ch = r.ch;
      // mono when the channels are identical (ambience, dry fight stems)
      if (ch.length === 2) {
        var same = true;
        for (var i = 0; i < ch[0].length && same; i += 7) if (Math.abs(ch[0][i] - ch[1][i]) > 1e-6) same = false;
        if (same) ch = [ch[0]];
      }
      var peak = 0, sum = 0, c, k;
      for (c = 0; c < ch.length; c++) for (k = 0; k < ch[c].length; k++) { var a = Math.abs(ch[c][k]); if (a > peak) peak = a; sum += a * a; }
      // short percussive sounds get more headroom: MP3 overshoots on sharp transients
      var target = spec.kind === 'sfx' || spec.kind === 'jingle' || spec.kind === 'loop' ? 0.75 : NORM;
      var scale = peak > 0 ? target / peak : 1;
      ch = ch.map(function (d) { var o = new Float32Array(d.length); for (var j = 0; j < d.length; j++) o[j] = d[j] * scale; return o; });
      refs[id] = { ch: ch, loop: r.loop, L: r.L };
      return {
        id: id, spec: spec, sr: SR, channels: ch.length, frames: ch[0].length,
        gain: peak > 0 ? 1 / scale : 1, srcPeak: peak, srcRms: Math.sqrt(sum / (ch.length * ch[0].length)),
        loop: r.loop || null, refSeam: r.refSeam === undefined ? null : r.refSeam, meta: r.meta || {},
        wav: b64(toWav(ch))
      };
    });
  }

  function decode(u8) {
    var ctx = new OfflineAudioContext(2, 1, SR);
    return ctx.decodeAudioData(u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength));
  }
  // analyse(id, mp3 base64) → {offset (decoded frame − reference frame), duration, decodedPeak, seam (relative rms
  // difference across the loop seam of the decoded file), loopStart/loopEnd (s, in the decoded file)}
  function analyse(id, mp3) {
    var ref = refs[id];
    return decode(unb64(mp3)).then(function (buf) {
      var dec = chans(buf), rc = ref.ch, n = buf.length, i, c;
      var peak = 0;
      for (c = 0; c < dec.length; c++) for (i = 0; i < n; i++) peak = Math.max(peak, Math.abs(dec[c][i]));
      // offset by cross-correlation of channel 0 over a busy window
      var W = Math.min(16384, rc[0].length - 4200), start = ref.loop ? ref.loop[0] + Math.floor(ref.L / 2) - (W >> 1) : 0, best = 0, bestV = -Infinity, MAXL = 2048;
      if (W > 512) {
        for (var lag = -MAXL; lag <= MAXL; lag++) {
          var s = 0;
          for (i = 0; i < W; i += 2) {
            var di = start + i + lag;
            if (di < 0 || di >= n || start + i >= rc[0].length) continue;
            s += dec[0][di] * rc[0][start + i];
          }
          if (s > bestV) { bestV = s; best = lag; }
        }
      }
      var out = { offset: best, duration: n / SR, frames: n, decodedPeak: peak, channels: buf.numberOfChannels, seam: null };
      if (ref.loop) {
        // Splice the decoded file the way the player loops it (… up to loopEnd, then from loopStart …) and compare
        // with the continuous reference: seam = error of the splice / plain MP3 coding error at the same spot
        // (≈1 means the loop point adds nothing audible), seamRel = splice error relative to the signal.
        var ls = ref.loop[0] + best, le = ref.loop[1] + best, r0 = ref.loop[0], N = 2048, worst = 0, rel = 0;
        for (c = 0; c < dec.length; c++) {
          var d = dec[c], rr = rc[Math.min(c, rc.length - 1)], eS = 0, eC = 0, p = 0;
          for (i = -N; i < N; i++) {
            var want = rr[r0 + i], spl = i < 0 ? d[le + i] : d[ls + i], cod = d[ls + i];
            eS += (spl - want) * (spl - want); eC += (cod - want) * (cod - want); p += want * want;
          }
          worst = Math.max(worst, eC > 0 ? Math.sqrt(eS / eC) : 0);
          rel = Math.max(rel, p > 0 ? Math.sqrt(eS / p) : 0);
        }
        out.seam = worst;
        out.seamRel = rel;
        out.loopStart = ls / SR;
        out.loopEnd = le / SR;
      }
      return out;
    });
  }

  G.AQR = { list: list, render: render, analyse: analyse, SR: SR };
})(window);
