// Niryk — core: math helpers, seeded RNG, input (keyboard, mouse, touch), audio (synth SFX + music) and save data.
'use strict';
(function () {
  const root = typeof window !== 'undefined' ? window : globalThis;
  const N = root.N = root.N || {};

  // ------------------------------------------------------------ math
  N.TS = 16; // tile size in world pixels
  N.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  N.lerp = (a, b, t) => a + (b - a) * t;
  N.dist = (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay);
  N.ang = (ax, ay, bx, by) => Math.atan2(by - ay, bx - ax);
  N.angDiff = (a, b) => { let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; };
  N.rand = (a, b) => a + Math.random() * (b - a);
  N.randi = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  N.pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  N.chance = (p) => Math.random() < p;
  N.shuffle = (arr, r = Math.random) => { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; };
  N.makeRng = (seed) => {
    let s = (seed >>> 0) || 0x9e3779b9;
    const f = () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
    f.int = (a, b) => a + Math.floor(f() * (b - a + 1));
    f.pick = (a) => a[Math.floor(f() * a.length)];
    f.chance = (p) => f() < p;
    return f;
  };
  // Pick from a list using a weight function.
  N.weighted = (items, wfn, r = Math.random) => {
    let tot = 0; for (const it of items) tot += wfn(it);
    let x = r() * tot;
    for (const it of items) { x -= wfn(it); if (x <= 0) return it; }
    return items[items.length - 1];
  };
  N.hash2 = (x, y) => { let h = (x * 374761393 + y * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177 | 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

  if (typeof window === 'undefined') return; // the rest needs a browser

  // ------------------------------------------------------------ input
  const I = N.input = {
    keys: {}, mx: 0, my: 0, mdown: false, mclick: false, rdown: false, rclick: false, wheel: 0,
    act: {}, prev: {}, hit: {}, pressed: {}, anyKey: false, touches: new Map(), usingTouch: false,
    vmove: { x: 0, y: 0 }, vbtn: {}, typed: [], abAim: [null, null], tdown: false,
  };
  const BIND = {
    up: ['KeyW', 'ArrowUp'], down: ['KeyS', 'ArrowDown'], left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'],
    attack: ['KeyJ'], dash: ['Space', 'ShiftLeft', 'ShiftRight', 'KeyK'], ab1: ['KeyQ', 'KeyU'], ab2: ['KeyE', 'KeyI'],
    interact: ['KeyF', 'Enter'], swap: ['KeyR', 'Tab'], pause: ['Escape', 'KeyP'], map: ['KeyM'],
  };
  I.BIND = BIND;
  addEventListener('keydown', (e) => {
    if (['Space', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
    if (!I.keys[e.code]) { I.anyKey = true; I.pressed[e.code] = true; }
    I.keys[e.code] = true; I.usingTouch = false;
    I.typed.push(e.code);
    N.audio.init();
  });
  addEventListener('keyup', (e) => { I.keys[e.code] = false; });
  addEventListener('blur', () => { I.keys = {}; I.mdown = false; I.rdown = false; });
  const cssPos = (e) => [e.clientX, e.clientY];
  addEventListener('mousemove', (e) => { [I.mx, I.my] = cssPos(e); });
  addEventListener('mousedown', (e) => {
    [I.mx, I.my] = cssPos(e); I.usingTouch = false; N.audio.init();
    if (e.button === 0) { I.mdown = true; I.mclick = true; }
    if (e.button === 2) { I.rdown = true; I.rclick = true; }
  });
  addEventListener('mouseup', (e) => { if (e.button === 0) I.mdown = false; if (e.button === 2) I.rdown = false; });
  addEventListener('contextmenu', (e) => e.preventDefault());
  addEventListener('wheel', (e) => { I.wheel += Math.sign(e.deltaY); }, { passive: true });
  const onTouch = (e) => {
    e.preventDefault(); I.usingTouch = true; N.audio.init();
    for (const t of e.changedTouches) {
      if (e.type === 'touchstart') I.touches.set(t.identifier, { id: t.identifier, x: t.clientX, y: t.clientY, x0: t.clientX, y0: t.clientY, fresh: true, ended: false, claim: null });
      else {
        const tt = I.touches.get(t.identifier); if (!tt) continue;
        tt.x = t.clientX; tt.y = t.clientY;
        if (e.type === 'touchend' || e.type === 'touchcancel') tt.ended = true;
      }
    }
  };
  for (const ev of ['touchstart', 'touchmove', 'touchend', 'touchcancel']) addEventListener(ev, onTouch, { passive: false });

  I.key = (code) => !!I.keys[code];
  // Called once per frame after the UI has processed touches.
  I.update = () => {
    const a = {};
    for (const k in BIND) a[k] = BIND[k].some((c) => I.keys[c] || I.pressed[c]);
    a.attack = a.attack || I.mdown || I.mclick || !!I.vbtn.attack;
    a.dash = a.dash || I.rdown || I.rclick || !!I.vbtn.dash;
    for (const k of ['ab1', 'ab2', 'interact', 'swap', 'pause']) a[k] = a[k] || !!I.vbtn[k];
    I.hit = {};
    for (const k in a) I.hit[k] = a[k] && !I.prev[k];
    I.prev = a; I.act = a;
  };
  I.endFrame = () => {
    I.mclick = false; I.rclick = false; I.wheel = 0; I.anyKey = false; I.typed.length = 0; I.pressed = {};
    for (const [id, t] of I.touches) { t.fresh = false; if (t.ended) I.touches.delete(id); }
    for (const k in I.vbtn) if (I.vbtn[k] === 'tap') I.vbtn[k] = false;
  };
  I.moveVec = () => {
    let x = (I.act.right ? 1 : 0) - (I.act.left ? 1 : 0), y = (I.act.down ? 1 : 0) - (I.act.up ? 1 : 0);
    if (I.vmove.x || I.vmove.y) { x = I.vmove.x; y = I.vmove.y; }
    const l = Math.hypot(x, y);
    return l > 1 ? { x: x / l, y: y / l } : { x, y };
  };

  // ------------------------------------------------------------ audio
  const A = N.audio = { ctx: null, master: null, sfxGain: null, musGain: null, last: {} };
  A.init = () => {
    try {
      if (!A.ctx) {
        A.ctx = new (window.AudioContext || window.webkitAudioContext)();
        A.master = A.ctx.createGain(); A.master.gain.value = 0.7; A.master.connect(A.ctx.destination);
        A.sfxGain = A.ctx.createGain(); A.sfxGain.connect(A.master);
        A.musGain = A.ctx.createGain(); A.musGain.gain.value = 0.32; A.musGain.connect(A.master);
        A.applyOpts();
        const len = A.ctx.sampleRate;
        A.noiseBuf = A.ctx.createBuffer(1, len, A.ctx.sampleRate);
        const d = A.noiseBuf.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      }
      if (A.ctx.state === 'suspended') A.ctx.resume();
    } catch (err) { A.ctx = null; }
  };
  A.applyOpts = () => {
    if (!A.ctx) return;
    const o = (N.save && N.save.opts) || {};
    A.sfxGain.gain.value = o.sfx === false ? 0 : (o.sfxVol === undefined ? 0.8 : o.sfxVol);
    A.musGain.gain.value = o.music === false ? 0 : (o.musicVol === undefined ? 0.7 : o.musicVol) * 1.1;
  };
  A.tone = (f, dur, type = 'square', vol = 0.15, slide = 0, delay = 0, out) => {
    if (!A.ctx) return;
    const t = A.ctx.currentTime + delay, o = A.ctx.createOscillator(), g = A.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, f + slide), t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(out || A.sfxGain); o.start(t); o.stop(t + dur + 0.02);
  };
  A.noise = (dur, vol = 0.2, freq = 1200, delay = 0, q = 0.8) => {
    if (!A.ctx) return;
    const t = A.ctx.currentTime + delay, s = A.ctx.createBufferSource(), f = A.ctx.createBiquadFilter(), g = A.ctx.createGain();
    s.buffer = A.noiseBuf; f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f); f.connect(g); g.connect(A.sfxGain); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
  };
  const SFX = {
    swing: () => { A.noise(0.09, 0.12, 2400, 0, 1.5); },
    heavy: () => { A.noise(0.16, 0.2, 700, 0, 1); A.tone(110, 0.12, 'triangle', 0.12, -50); },
    shoot: () => { A.tone(620, 0.07, 'square', 0.05, -300); },
    arrow: () => { A.noise(0.06, 0.1, 3800, 0, 3); A.tone(900, 0.05, 'triangle', 0.04, -400); },
    magic: () => { A.tone(500, 0.12, 'sine', 0.08, 500); A.tone(760, 0.1, 'triangle', 0.04, 300, 0.03); },
    gun: () => { A.noise(0.14, 0.25, 900, 0, 0.7); A.tone(160, 0.1, 'square', 0.08, -90); },
    hit: () => { A.tone(220, 0.06, 'square', 0.07, -120); A.noise(0.05, 0.08, 1800); },
    crit: () => { A.tone(880, 0.08, 'square', 0.07, -400); A.noise(0.07, 0.12, 3000); },
    kill: () => { A.noise(0.18, 0.14, 900, 0, 0.6); A.tone(300, 0.15, 'triangle', 0.08, -220); },
    hurt: () => { A.tone(180, 0.22, 'sawtooth', 0.14, -120); A.noise(0.15, 0.15, 500); },
    shield: () => { A.tone(900, 0.1, 'triangle', 0.08, -500); A.noise(0.08, 0.1, 4000); },
    dash: () => { A.noise(0.14, 0.12, 1400, 0, 0.6); },
    coin: () => { A.tone(988, 0.06, 'square', 0.05); A.tone(1319, 0.12, 'square', 0.05, 0, 0.05); },
    crystal: () => { A.tone(1568, 0.08, 'sine', 0.08); A.tone(2093, 0.16, 'sine', 0.06, 0, 0.06); },
    pickup: () => { A.tone(523, 0.08, 'square', 0.06); A.tone(784, 0.14, 'square', 0.06, 0, 0.07); },
    heal: () => { [523, 659, 784].forEach((f, i) => A.tone(f, 0.16, 'sine', 0.08, 0, i * 0.07)); },
    door: () => { A.tone(90, 0.25, 'sawtooth', 0.1, 40); A.noise(0.2, 0.1, 300); },
    explode: () => { A.noise(0.45, 0.32, 260, 0, 0.5); A.tone(80, 0.35, 'sine', 0.2, -50); },
    zap: () => { A.tone(1200, 0.1, 'sawtooth', 0.05, -900); A.noise(0.06, 0.08, 5000, 0, 2); },
    ability: () => { A.tone(330, 0.2, 'triangle', 0.1, 330); A.noise(0.18, 0.08, 2000, 0, 0.5); },
    roar: () => { A.tone(90, 0.6, 'sawtooth', 0.18, -40); A.noise(0.5, 0.22, 400, 0, 0.4); },
    slam: () => { A.noise(0.35, 0.3, 180, 0, 0.6); A.tone(60, 0.3, 'sine', 0.22, -30); },
    charge: () => { A.tone(200, 0.3, 'sawtooth', 0.06, 400); },
    spawn: () => { A.tone(300, 0.2, 'sine', 0.05, -200); },
    ui: () => { A.tone(660, 0.05, 'square', 0.05); },
    buy: () => { [784, 988, 1319].forEach((f, i) => A.tone(f, 0.1, 'square', 0.05, 0, i * 0.06)); },
    deny: () => { A.tone(160, 0.18, 'square', 0.07); },
    portal: () => { [262, 330, 392, 523, 659].forEach((f, i) => A.tone(f, 0.25, 'sine', 0.07, 0, i * 0.06)); },
    levelup: () => { [523, 659, 784, 1047].forEach((f, i) => A.tone(f, 0.18, 'square', 0.06, 0, i * 0.08)); },
    boss: () => { A.tone(55, 1.2, 'sawtooth', 0.2, 20); A.tone(82, 1.2, 'sawtooth', 0.12, -10, 0.2); A.noise(1, 0.15, 200, 0, 0.3); },
    win: () => { [523, 659, 784, 1047, 1319].forEach((f, i) => A.tone(f, 0.35, 'triangle', 0.09, 0, i * 0.12)); },
    lose: () => { [392, 330, 262, 196].forEach((f, i) => A.tone(f, 0.4, 'triangle', 0.09, 0, i * 0.18)); },
    ehit: () => { A.tone(140, 0.05, 'square', 0.04, -60); },
    eshoot: () => { A.tone(420, 0.06, 'triangle', 0.035, -200); },
  };
  N.sfx = (name) => {
    if (!A.ctx || !SFX[name]) return;
    const now = performance.now();
    if (A.last[name] && now - A.last[name] < 45) return;
    A.last[name] = now; SFX[name]();
  };

  // Tiny procedural music: a bass line and an arpeggio built from a scale, one theme per area.
  const THEMES = {
    lobby: { root: 220, scale: [0, 2, 4, 7, 9], bpm: 88, wave: 'triangle', seed: 3 },
    overworld: { root: 196, scale: [0, 2, 4, 5, 7, 9, 11], bpm: 112, wave: 'square', seed: 11 },
    reverso: { root: 174.6, scale: [0, 2, 3, 6, 7, 8, 11], bpm: 100, wave: 'triangle', seed: 23 },
    wasteland: { root: 164.8, scale: [0, 1, 4, 5, 7, 8, 10], bpm: 108, wave: 'sawtooth', seed: 41 },
    boss: { root: 146.8, scale: [0, 1, 3, 5, 7, 8, 10], bpm: 140, wave: 'sawtooth', seed: 7 },
    pantano: { root: 155.6, scale: [0, 2, 3, 5, 7, 9, 10], bpm: 92, wave: 'triangle', seed: 53 },
    gelo: { root: 233.1, scale: [0, 2, 4, 6, 7, 9, 11], bpm: 96, wave: 'sine', seed: 61 },
    caldeira: { root: 138.6, scale: [0, 1, 4, 5, 7, 8, 11], bpm: 124, wave: 'sawtooth', seed: 67 },
    victory: { root: 261.6, scale: [0, 2, 4, 7, 9], bpm: 96, wave: 'triangle', seed: 5 },
  };
  const M = N.music = { theme: null, step: 0, next: 0, timer: null, pat: null };
  M.play = (name) => {
    if (M.theme === name) return;
    M.theme = name; M.step = 0;
    const th = THEMES[name]; if (!th) return;
    const r = N.makeRng(th.seed), len = 32;
    M.pat = { bass: [], lead: [] };
    let deg = 0;
    for (let i = 0; i < len; i++) {
      M.pat.bass.push(i % 8 === 0 ? r.pick([0, 0, 3, 4, 5]) : i % 4 === 0 ? -1 : null);
      if (r() < 0.55) { deg = N.clamp(deg + r.int(-2, 2), -2, 9); M.pat.lead.push(deg); } else M.pat.lead.push(null);
    }
    if (!M.timer) M.timer = setInterval(M.tick, 30);
  };
  M.stop = () => { M.theme = null; };
  M.tick = () => {
    if (!A.ctx || !M.theme || !M.pat) return;
    const th = THEMES[M.theme], spb = 60 / th.bpm / 2;
    if (M.next < A.ctx.currentTime) M.next = A.ctx.currentTime + 0.05;
    while (M.next < A.ctx.currentTime + 0.15) {
      const i = M.step % 32, delay = M.next - A.ctx.currentTime;
      const note = (d, oct) => th.root * Math.pow(2, (th.scale[((d % th.scale.length) + th.scale.length) % th.scale.length] + 12 * (Math.floor(d / th.scale.length) + oct)) / 12);
      if (i % 8 === 0) M.bassDeg = M.pat.bass[i];
      const b = M.pat.bass[i];
      if (b !== null && b !== undefined) A.tone(note(b === -1 ? (M.bassDeg || 0) : b, -1), spb * 1.8, 'triangle', 0.24, 0, delay, A.musGain);
      const l = M.pat.lead[i];
      if (l !== null) A.tone(note(l, 0), spb * 0.9, th.wave, th.wave === 'sawtooth' ? 0.055 : th.wave === 'sine' ? 0.11 : 0.08, 0, delay, A.musGain);
      if (i % 8 === 4 && M.pat.lead[i] !== null) A.tone(note((M.bassDeg || 0) + 4, 0), spb * 3, 'sine', 0.05, 0, delay, A.musGain);
      if (M.theme === 'boss' || M.theme === 'wasteland' || M.theme === 'caldeira') { if (i % 4 === 0) { const t = A.ctx.currentTime + delay, s = A.ctx.createBufferSource(), g = A.ctx.createGain(), f = A.ctx.createBiquadFilter(); s.buffer = A.noiseBuf; f.type = 'lowpass'; f.frequency.value = 180; g.gain.setValueAtTime(0.25, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.12); s.connect(f); f.connect(g); g.connect(A.musGain); s.start(t); s.stop(t + 0.15); } }
      M.step++; M.next += spb;
    }
  };

  // ------------------------------------------------------------ save
  const SAVE_KEY = 'niryk.save.v1';
  N.defaultSave = () => ({
    crystals: 0, upg: {}, ach: {}, codex: { w: {}, q: {}, m: {}, b: {} },
    stats: { kills: 0, runs: 0, wins: 0, deaths: 0, dragonKills: 0, best: 0, winsBy: {}, bossKills: {}, crystalsTotal: 0, winsDiff: {} },
    loadout: {}, mods: {}, char: 'emberian', seenIntro: false, diff: 0, lastDiff: 0, worldsSeen: {},
    opts: { music: true, sfx: true, shake: true, musicVol: 0.7, sfxVol: 0.8, dmgNums: true, camLead: true, fps: false, blurPause: true, autoAim: true },
  });
  N.loadSave = () => {
    let s = null;
    try { s = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); } catch (e) { s = null; }
    const d = N.defaultSave();
    if (!s || typeof s !== 'object') return d;
    for (const k in d) if (s[k] === undefined) s[k] = d[k];
    for (const k in d.stats) if (s.stats[k] === undefined) s.stats[k] = d.stats[k];
    for (const k in d.codex) if (!s.codex[k]) s.codex[k] = {};
    for (const k in d.opts) if (s.opts[k] === undefined) s.opts[k] = d.opts[k];
    return s;
  };
  // Fullscreen (where the browser allows it).
  N.isFullscreen = () => !!(document.fullscreenElement || document.webkitFullscreenElement);
  N.toggleFullscreen = () => {
    const el = document.documentElement;
    try {
      if (N.isFullscreen()) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
      else { const r = (el.requestFullscreen || el.webkitRequestFullscreen).call(el); if (r && r.catch) r.catch(() => {}); }
    } catch (e) { /* not supported (e.g. iPhone Safari) */ }
  };
  N.writeSave = () => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(N.save)); } catch (e) { /* storage blocked: progress lives only in memory */ } };
  N.save = N.loadSave();
})();
