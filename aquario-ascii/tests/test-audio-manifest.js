// Água-Tinta — audio manifest tests (owner E). The game plays recorded files only (audio/, listed in
// js/data/audio-manifest.js, rendered by tools/audio-render/). Checks: every sound id the code asks for has an entry,
// every entry's file exists and is a real MP3 whose length matches, loop points sit inside the file, fight stems
// fit their themes (same tempo, loop divides the theme loop), and the folder stays within its size budget.
'use strict';
const fs = require('fs');
const path = require('path');

module.exports = function (T) {
  const ROOT = path.resolve(__dirname, '..');
  const KINDS = ['sfx', 'jingle', 'loop', 'music', 'stem', 'ambience', 'silence'];
  const LOOPS = ['loop', 'music', 'stem', 'ambience'];

  function manifest() { return T.load().AQ.AUDIO_MANIFEST; }
  function jsFiles(dir) {
    let out = [];
    for (const f of fs.readdirSync(dir)) {
      const p = path.join(dir, f);
      if (fs.statSync(p).isDirectory()) out = out.concat(jsFiles(p));
      else if (/\.js$/.test(f) && !/audio-manifest\.js$/.test(f)) out.push(p);
    }
    return out;
  }
  // every literal sound id in the game code
  function usedIds() {
    const ids = new Set();
    for (const file of jsFiles(path.join(ROOT, 'js'))) {
      const src = fs.readFileSync(file, 'utf8');
      let m;
      // sfx(...) / feedback(...) / feedbackSound(...) first argument (literals, ternaries; comparisons dropped)
      const call = /\b(?:sfx|feedback|feedbackSound)\(([^{)]*)/g;
      while ((m = call.exec(src))) {
        const arg = m[1].split(',')[0].replace(/[!=]==?\s*'[^']*'/g, '');
        for (const q of arg.match(/'[\w-]+'/g) || []) ids.add(q.slice(1, -1));
      }
      const opt = /\bsfx(?:Open)?\s*(?::|\|\|)\s*'([\w-]+)'/g;
      while ((m = opt.exec(src))) ids.add(m[1]);
      const fb = /\b(?:o\.sfx|def\.sfxOpen)\s*\|\|\s*'([\w-]+)'/g;
      while ((m = fb.exec(src))) ids.add(m[1]);
      const play = /\bA\.(?:play|need|has)\('([\w-]+)'/g;
      while ((m = play.exec(src))) ids.add(m[1]);
      const tell = /TELL_SFX\s*=\s*\{([^}]*)\}/.exec(src);
      if (tell) for (const q of tell[1].match(/'[\w-]+'/g) || []) ids.add(q.slice(1, -1));
      const amb = /\bAMB\s*=\s*\[([^\]]*)\]/.exec(src);
      if (amb) for (const q of amb[1].match(/'[\w-]+'/g) || []) ids.add(q.slice(1, -1));
    }
    return ids;
  }
  // MP3 frame walk → {frames, seconds} (MPEG-1/2 Layer III; skips an ID3v2 tag)
  function mp3Info(buf) {
    let i = 0, frames = 0, samples = 0, sr0 = 0;
    if (buf.slice(0, 3).toString('latin1') === 'ID3') i = 10 + ((buf[6] & 0x7f) << 21 | (buf[7] & 0x7f) << 14 | (buf[8] & 0x7f) << 7 | (buf[9] & 0x7f));
    const BR1 = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320];
    const BR2 = [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160];
    const SR = { 3: [44100, 48000, 32000], 2: [22050, 24000, 16000], 0: [11025, 12000, 8000] };
    while (i + 4 <= buf.length) {
      if (buf[i] !== 0xff || (buf[i + 1] & 0xe0) !== 0xe0) { i++; continue; }
      const ver = (buf[i + 1] >> 3) & 3, layer = (buf[i + 1] >> 1) & 3, bri = buf[i + 2] >> 4, sri = (buf[i + 2] >> 2) & 3, pad = (buf[i + 2] >> 1) & 1;
      if (ver === 1 || layer !== 1 || bri === 0 || bri === 15 || sri === 3) { i++; continue; }
      const sr = SR[ver][sri], v1 = ver === 3, br = (v1 ? BR1 : BR2)[bri] * 1000;
      const len = Math.floor((v1 ? 144 : 72) * br / sr) + pad;
      if (len < 24) { i++; continue; }
      frames++; samples += v1 ? 1152 : 576; sr0 = sr;
      i += len;
    }
    return { frames, seconds: sr0 ? samples / sr0 : 0, sr: sr0 };
  }

  T.test('manifest is pure data with valid entries', () => {
    const man = manifest();
    T.ok(man && typeof man === 'object', 'AQ.AUDIO_MANIFEST defined');
    const bad = [];
    for (const id of Object.keys(man)) {
      const e = man[id];
      if (!e || typeof e.file !== 'string' || !/^audio\/.+\.mp3$/.test(e.file)) bad.push(id + ': file');
      if (KINDS.indexOf(e.kind) < 0) bad.push(id + ': kind ' + e.kind);
      if (!(e.gain > 0 && isFinite(e.gain))) bad.push(id + ': gain');
      if (!(e.duration > 0)) bad.push(id + ': duration');
      if (e.kind === 'jingle' && !(e.duck > 0)) bad.push(id + ': jingle without duck');
    }
    T.eq(bad, []);
  });

  T.test('every sound id the code uses has a manifest entry', () => {
    const man = manifest();
    const ids = usedIds();
    T.ok(ids.size >= 30, 'found the sound ids in the code (' + ids.size + ')');
    const missing = [...ids].filter((id) => !man[id]).sort();
    T.eq(missing, [], 'ids used in js/ without an entry');
    T.ok(man.silence && man.silence.kind === 'silence', 'silent clip for the iOS unlock');
    for (const id of ['reel-loop', 'amb-water', 'amb-rain', 'amb-storm', 'omen']) T.ok(man[id], id);
  });

  T.test('every mood has a theme; every water has a night take and a fight stem in sync', () => {
    const { AQ } = T.load();
    const man = manifest();
    const zones = AQ.zones.order;
    T.eq(zones.length, 5);
    const len = (e) => e.loopEnd - e.loopStart;
    const problems = [];
    for (const mood of ['title', 'map', 'aquarium', 'ending'].concat(zones)) {
      const th = man['theme-' + mood];
      if (!th || th.kind !== 'music') { problems.push('theme-' + mood); continue; }
      if (!(th.bars >= 16)) problems.push('theme-' + mood + ' shorter than 16 bars');
    }
    for (const z of zones) {
      const day = man['theme-' + z], nightT = man['theme-' + z + '-night'];
      if (!nightT) { problems.push('theme-' + z + '-night'); continue; }
      if (!day) continue;
      if (nightT.bpm !== day.bpm || Math.abs(len(nightT) - len(day)) > 1e-4) problems.push(z + ': night take differs in tempo/length');
      for (const sid of ['fight-' + z, 'fight-' + z + '-night']) {
        const st = man[sid];
        if (!st) { if (sid === 'fight-' + z) problems.push(sid); continue; }
        if (st.kind !== 'stem') problems.push(sid + ' kind');
        if (st.bpm !== day.bpm) problems.push(sid + ' tempo');
        const r = len(day) / len(st);
        if (Math.abs(r - Math.round(r)) > 0.002 || Math.round(r) < 1) problems.push(sid + ' loop does not divide the theme loop (' + r + ')');
      }
    }
    T.eq(problems, []);
  });

  T.test('every manifest file exists, is an MP3 of the stated length, loop points inside it', () => {
    const man = manifest();
    const problems = [];
    let total = 0;
    const seen = new Set();
    for (const id of Object.keys(man)) {
      const e = man[id];
      const p = path.join(ROOT, e.file);
      if (!fs.existsSync(p)) { problems.push(id + ': missing ' + e.file); continue; }
      const buf = fs.readFileSync(p);
      if (!seen.has(e.file)) { total += buf.length; seen.add(e.file); }
      const info = mp3Info(buf);
      if (info.frames < 2 || info.sr !== 44100) { problems.push(id + ': not a 44.1 kHz MP3'); continue; }
      // frame count includes the encoder delay / padding and the Xing frame (≤ ~0.1 s)
      if (info.seconds + 0.001 < e.duration || info.seconds - e.duration > 0.12) problems.push(id + ': duration ' + e.duration + ' vs file ' + info.seconds.toFixed(3));
      if (LOOPS.indexOf(e.kind) >= 0) {
        if (!(e.loopStart >= 0.05 && e.loopEnd > e.loopStart && e.loopEnd <= e.duration - 0.05)) problems.push(id + ': loop points ' + e.loopStart + '–' + e.loopEnd + ' / ' + e.duration);
        if (e.kind !== 'loop' && e.loopEnd - e.loopStart < 4) problems.push(id + ': loop too short');
      }
    }
    T.eq(problems, []);
    T.ok(total < 9.5 * 1048576, 'audio/ within budget (' + (total / 1048576).toFixed(2) + ' MB)');
  });

  T.test('no audio file is left out of the manifest', () => {
    const man = manifest();
    const listed = new Set(Object.keys(man).map((id) => man[id].file));
    const extra = [];
    (function walk(d, rel) {
      for (const f of fs.readdirSync(d)) {
        const p = path.join(d, f), r = rel + f;
        if (fs.statSync(p).isDirectory()) walk(p, r + '/');
        else if (!listed.has(r)) extra.push(r);
      }
    })(path.join(ROOT, 'audio'), 'audio/');
    T.eq(extra, []);
  });
};
