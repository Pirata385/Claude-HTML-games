/* Sinuca do Além — regras: a noite (run), as mesas, a pontuação, o balcão, as portas e o salvamento. */
(function (g) {
  'use strict';
  const SA = g.SA, P = SA.Phys, D = SA.Data, Rn = SA.Render, Au = SA.Audio;
  const G = (SA.Game = {
    state: 'boot', run: null, T: null, world: null, cueBall: null, shot: null, guide: null, undo: null,
    aim: { angle: 0, power: 0, pull: 0, show: false, strike: 0, spinX: 0, spinY: 0 },
    armed: -1, fast: false, slow: 0, resolveT: 0, mods: {}, time: 0, acc: 0, idleT: 0,
    settings: { master: 0.8, sfx: 0.9, music: 0.5, vibrate: true, quality: 'auto', control: 'sling', shake: true, guideOn: true, lefty: false, fastDefault: false },
    meta: { runs: 0, wins: 0, bestShot: 0, bestTable: 0, deepest: 0, unlock: 0, seen: { r: {}, b: {}, c: {} }, tutorial: false },
  });
  const UI = () => SA.UI;
  G.fxRng = Math.random;
  const STEP = 1 / 120;

  // ---------- persistência ----------
  G.loadStore = function () {
    const s = SA.store.load();
    if (s.settings) Object.assign(G.settings, s.settings);
    if (s.meta) { Object.assign(G.meta, s.meta); G.meta.seen = Object.assign({ r: {}, b: {}, c: {} }, s.meta.seen); }
    G.saved = s.run || null;
  };
  G.persist = function () { SA.store.save({ settings: G.settings, meta: G.meta, run: G.saved }); };
  const serBall = (b) => ({ id: b.id, kind: b.kind, type: b.type, num: b.num, pts: b.pts, color: b.color, glyph: b.glyph, x: b.x, y: b.y, r: b.r, m: b.m, burning: b.burning, ghost: b.ghost });
  function snapTable() {
    return JSON.stringify({ T: G.T, balls: G.world.balls.filter((b) => b.alive && !b.sink && !b.clone).map(serBall), ang: G.world.geom.spinner ? G.world.geom.spinner.ang : 0, coins: G.run.coins });
  }
  G.saveRun = function (phase) {
    if (!G.run) { G.saved = null; G.persist(); return; }
    G.run.phase = phase || G.run.phase;
    G.run.rs = G.rng.s;
    const o = { run: G.run };
    if (G.run.phase === 'table' && G.T) o.table = snapTable();
    G.saved = JSON.parse(JSON.stringify(o));
    G.persist();
  };

  // ---------- modificadores vindos dos amuletos ----------
  G.calcMods = function () {
    const m = { shots: 0, power: 1, friction: 1, pocket: 1, guide: 0, discount: 0, bankMult: 0.5, kissMult: 0.5, streakMult: 1, burnPts: 15, chalkKeep: 0 };
    if (G.run) {
      for (const rel of G.run.relics) {
        const d = D.RELICS[rel.id].mods;
        if (!d) continue;
        for (const k in d) {
          if (k === 'power' || k === 'friction' || k === 'pocket') m[k] *= d[k];
          else if (k === 'shots' || k === 'guide' || k === 'discount' || k === 'chalkKeep') m[k] += d[k];
          else m[k] = d[k];
        }
      }
    }
    G.mods = m;
    return m;
  };
  const hasRelic = (id) => G.run.relics.some((r) => r.id === id);
  const cueDef = () => D.CUES[G.run ? G.run.cue : 'boteco'];
  const actTheme = (a) => D.ACTS[a % D.ACTS.length];
  const bossDef = () => (G.T && G.T.boss ? D.BOSSES[G.T.boss] : null);
  function vibrate(ms) { if (G.settings.vibrate && navigator.vibrate) { try { navigator.vibrate(ms); } catch (e) { /* sem vibração */ } } }
  function shake(a) { if (G.settings.shake) Rn.shake(a); }
  function see(kind, id) { if (!G.meta.seen[kind][id]) { G.meta.seen[kind][id] = 1; } }

  // ---------- nova noite ----------
  G.newRun = function (opts) {
    const seedStr = opts.seed && String(opts.seed).trim() ? String(opts.seed).trim() : String(Math.floor(Math.random() * 1e9));
    G.rng = SA.makeRng(SA.hashStr(seedStr));
    const cue = D.CUES[opts.cue] || D.CUES.boteco;
    const run = (G.run = {
      seed: seedStr, diff: opts.diff || 'normal', cue: opts.cue || 'boteco', act: 0, idx: 0, depth: 0, endless: false,
      coins: 4 + (cue.coins || 0), relics: [], chalks: [], bag: [], phase: 'table', saideiraUsed: false,
      stats: { shots: 0, pocketed: 0, bestShot: 0, total: 0, scratches: 0, coins: 0, tables: 0 },
    });
    for (let n = 1; n <= 10; n++) run.bag.push({ t: 'n', num: n, pts: D.ptsFor(n) });
    run.chalks.push(G.rng.pick(['fogo', 'fantasma', 'trovao', 'triplo', 'fome', 'gigante']));
    if (cue.cursed) {
      const rares = D.RELIC_IDS.filter((id) => D.RELICS[id].rar === 2 && id !== 'saideira');
      run.relics.push({ id: G.rng.pick(rares) });
      run.bag.push({ t: 'maldita', pts: D.SPECIAL.maldita.pts });
    }
    for (const r of run.relics) see('r', r.id);
    G.meta.runs++;
    G.calcMods();
    G.startTable({ mods: [], boss: null, wager: false, reward: null });
  };

  G.resume = function () {
    const s = G.saved;
    if (!s || !s.run) return false;
    G.run = JSON.parse(JSON.stringify(s.run));
    G.rng = SA.makeRng(0); G.rng.s = G.run.rs | 0;
    G.calcMods();
    if (G.run.phase === 'table' && s.table) {
      const t = JSON.parse(s.table);
      restoreTable(t);
      UI().showTable();
      beginAim(true);
    } else if (G.run.phase === 'doors') {
      demoBackdrop(); G.state = 'doors'; UI().showDoors();
    } else {
      demoBackdrop(); G.state = 'shop'; UI().showShop();
    }
    return true;
  };

  // ---------- mesa ----------
  function targetFor(spec) {
    const n = G.run.act * 3 + G.run.idx;
    let base = n < D.TARGETS.length ? D.TARGETS[n] : D.TARGETS[D.TARGETS.length - 1] * Math.pow(1.55, n - D.TARGETS.length + 1);
    base *= D.DIFFS[G.run.diff].mul * (cueDef().target || 1) * (spec.wager ? 1.4 : 1) * (spec.boss && D.BOSSES[spec.boss].target ? D.BOSSES[spec.boss].target : 1);
    return Math.max(10, Math.round(base / 10) * 10);
  }
  G.targetFor = targetFor;

  function genFeatures(T, r) {
    const f = { bumpers: [], portals: null, patches: [], walls: [], spinner: null, well: null, tilt: null };
    const has = (m) => T.mods.indexOf(m) >= 0;
    if (has('pinball')) for (const p of [[-130, -120], [40, 130], [160, -105]]) f.bumpers.push({ x: p[0] + r.range(-20, 20), y: p[1] + r.range(-16, 16) });
    if (has('portais')) { const s = r() < 0.5 ? 1 : -1; f.portals = [{ x: r.range(-390, -300), y: s * r.range(120, 170), r: 30 }, { x: r.range(255, 330), y: -s * r.range(150, 180), r: 30 }]; }
    if (has('lama')) for (let i = 0; i < 3; i++) f.patches.push({ x: r.range(-360, 180), y: r.range(-170, 170), r: r.range(58, 86), mul: 3.6 });
    if (has('paredes')) {
      const presets = [
        [[-90, -195, -90, -95], [-90, 95, -90, 195]],
        [[-205, -165, -125, -85], [120, 85, 200, 165]],
        [[-70, -112, 70, -112], [-70, 112, 70, 112]],
      ];
      const ps = r.pick(presets), sx = r() < 0.5 ? 1 : -1;
      for (const w of ps) f.walls.push({ x1: w[0], y1: w[1] * sx, x2: w[2], y2: w[3] * sx });
    }
    if (has('helice')) f.spinner = { x: 0, y: -110, len: 170, ang: r() * 3, w: r() < 0.5 ? 1.7 : -1.7 };
    if (has('buraco')) f.well = { x: 0, y: 95, r: 24, range: 150, k: 720 };
    if (has('inclinada')) { const a = r.int(8) * (Math.PI / 4); f.tilt = { x: Math.cos(a) * 45, y: Math.sin(a) * 45 }; }
    return f;
  }

  function buildWorld(T) {
    const m = G.mods, has = (id) => T.mods.indexOf(id) >= 0;
    const geom = P.buildGeom({
      pocketScale: (has('miudas') ? 0.8 : 1) * (m.pocket || 1),
      friction: (has('gelo') ? 0.36 : 1) * (m.friction || 1),
      electric: !!m.electric,
    });
    const f = T.features;
    for (const b of f.bumpers) geom.circles.push({ x: b.x, y: b.y, r: 24, e: 0.9, kick: 560, hot: 0 });
    for (const w of f.walls) geom.segs.push({ x1: w.x1, y1: w.y1, x2: w.x2, y2: w.y2, wall: true });
    geom.hasWalls = f.walls.length > 0;
    geom.portals = f.portals; geom.patches = f.patches; geom.well = f.well; geom.tilt = f.tilt;
    geom.spinner = f.spinner ? Object.assign({}, f.spinner) : null;
    geom.dark = has('escuro');
    G.world = P.makeWorld(geom);
    G.tview = { geom, features: f, mods: T.mods };
    Rn.setTable(G.tview, actTheme(T.act));
    return G.world;
  }

  function ballFromBag(e, x, y) {
    if (e.t === 'n') return P.makeBall({ kind: 'obj', type: 'n', num: e.num, pts: e.pts, color: D.BALL_COLORS[e.num] || '#bbb', x, y });
    const s = D.SPECIAL[e.t];
    return P.makeBall({ kind: 'obj', type: e.t, num: s.glyph, glyph: s.glyph, pts: e.pts, color: s.color, m: s.mass || 1, x, y });
  }
  function rack(bag, r) {
    const list = bag.slice();
    r.shuffle(list);
    if (list.length > 21) list.length = 21;
    const d = P.R * 2 + 0.6, out = [];
    let row = 0, col = 0;
    const rows = Math.ceil((Math.sqrt(8 * list.length + 1) - 1) / 2);
    for (let i = 0; i < list.length; i++) {
      const inRow = row + 1, n = Math.min(inRow, list.length - (i - col));
      const x = 250 - (rows - 4) * 8 + row * d * 0.868, y = (col - (n - 1) / 2) * d;
      out.push(ballFromBag(list[i], x, y));
      col++;
      if (col >= inRow) { row++; col = 0; }
    }
    return out;
  }
  function placeCue() {
    const w = G.world;
    let cb = G.cueBall;
    if (!cb || !cb.alive) { cb = G.cueBall = P.makeBall({ kind: 'cue', type: 'cue', color: '#f4eede', x: -250, y: 0 }); w.balls.push(cb); }
    cb.r = P.R; cb.m = 1; cb.sink = null; cb.vx = cb.vy = cb.vz = 0; cb.z = 0; cb.burning = false; cb.fire = false; cb.plow = 0; cb.phase = 0; cb.passed = null; cb.ghost = false;
    // procura um ponto livre perto da cabeceira
    const spots = [[-250, 0]];
    for (let k = 1; k < 9; k++) for (const s of [1, -1]) { spots.push([-250, s * k * 28]); spots.push([-250 - k * 26, s * k * 14]); }
    for (const sp of spots) {
      let ok = Math.abs(sp[0]) < P.HW - 20 && Math.abs(sp[1]) < P.HH - 20;
      for (const b of w.balls) if (ok && b !== cb && b.alive && Math.hypot(b.x - sp[0], b.y - sp[1]) < b.r + cb.r + 2) ok = false;
      for (const c of w.geom.circles) if (ok && Math.hypot(c.x - sp[0], c.y - sp[1]) < c.r + cb.r + 2) ok = false;
      if (ok) { cb.x = sp[0]; cb.y = sp[1]; return; }
    }
    cb.x = -250; cb.y = 0;
  }

  G.startTable = function (spec) {
    const run = G.run, r = G.rng;
    const cue = cueDef();
    const T = (G.T = {
      act: run.act, idx: run.idx, name: spec.boss ? 'Mesa de ' + D.BOSSES[spec.boss].name : r.pick(D.TABLE_NAMES),
      mods: spec.mods.slice(), boss: spec.boss || null, wager: !!spec.wager, reward: spec.reward || null,
      target: targetFor(spec), score: 0, shotsMax: 0, shotsLeft: 0, streak: 0, shotNo: 0, echoUsed: false,
      golden: -1, windNow: null, lastPts: 0, racks: 0, closed: [],
    });
    T.features = genFeatures(T, r);
    T.shotsMax = T.shotsLeft = cue.shots + G.mods.shots;
    buildWorld(T);
    const bag = run.bag.slice();
    if (G.mods.xerox && bag.length) bag.push(Object.assign({}, r.pick(bag)));
    G.world.balls = rack(bag, r);
    G.cueBall = null; placeCue();
    G.undo = null; G.armed = -1;
    Rn.clearFx();
    UI().showTable();
    if (T.boss) { const b = D.BOSSES[T.boss]; UI().banner(b.icon + ' ' + b.name, b.title + ' — ' + b.desc, 'boss', 3200); } else UI().banner(T.name, T.mods.length ? T.mods.map((m) => D.MODS[m].icon + ' ' + D.MODS[m].name).join('  ·  ') : 'Mesa clássica', 'table', 1900);
    Au.music(true, actTheme(T.act).tempo, [0, -2, 3][T.act % 3]);
    beginAim(false);
  };

  function restoreTable(t) {
    G.T = t.T;
    buildWorld(G.T);
    if (G.world.geom.spinner) G.world.geom.spinner.ang = t.ang || 0;
    G.world.balls = t.balls.map((s) => { const b = P.makeBall(s); b.burning = !!s.burning; b.ghost = !!s.ghost; return b; });
    G.cueBall = G.world.balls.find((b) => b.kind === 'cue') || null;
    if (!G.cueBall) placeCue();
    Au.music(true, actTheme(G.T.act).tempo, [0, -2, 3][G.T.act % 3]);
  }

  function applyLids() {
    const geom = G.world.geom, T = G.T;
    geom.circles = geom.circles.filter((c) => !c.lid);
    geom.pockets.forEach((p, i) => { p.closed = T.closed.indexOf(i) >= 0; if (p.closed) geom.circles.push({ x: p.x, y: p.y, r: p.r + 12, e: 0.6, kick: 0, lid: true }); });
  }
  function beginAim(restored) {
    const T = G.T, r = G.rng, has = (id) => T.mods.indexOf(id) >= 0, boss = bossDef();
    if (!restored) {
      if (has('tampas')) { const n = boss && boss.lids ? boss.lids : 2; T.closed = r.shuffle([0, 1, 2, 3, 4, 5]).slice(0, n); } else T.closed = [];
      if (has('dourada')) { const open = [0, 1, 2, 3, 4, 5].filter((i) => T.closed.indexOf(i) < 0); T.golden = r.pick(open); } else T.golden = -1;
      if (has('vento')) { const a = r() * Math.PI * 2, k = 60 * (boss && boss.wind ? boss.wind : 1); T.windNow = { x: Math.cos(a) * k, y: Math.sin(a) * k }; } else T.windNow = null;
    }
    applyLids();
    G.world.geom.wind = T.windNow;
    G.world.spin = false;
    G.state = 'aim'; G.shot = null; G.idleT = 0;
    const cb = G.cueBall;
    // aponta para a bola mais próxima como ponto de partida
    let best = null, bd = 1e9;
    for (const b of G.world.balls) if (b.alive && b.kind === 'obj') { const d = Math.hypot(b.x - cb.x, b.y - cb.y); if (d < bd) { bd = d; best = b; } }
    if (best) G.aim.angle = Math.atan2(best.y - cb.y, best.x - cb.x);
    G.aim.power = 0; G.aim.pull = 0; G.aim.show = true; G.aim.strike = 0; G.aim.spinX = 0; G.aim.spinY = 0;
    UI().hud();
    if (!restored) G.saveRun('table');
  }

  // ---------- guia de mira ----------
  function computeGuide() {
    const cb = G.cueBall;
    if (!cb || !cb.alive || !G.settings.guideOn) { G.guide = null; return; }
    const lvl = SA.clamp(1 + G.mods.guide + (cueDef().guide || 0), 0, 3);
    const dx = Math.cos(G.aim.angle), dy = Math.sin(G.aim.angle);
    const armed = G.armed >= 0 ? G.run.chalks[G.armed] : null, r = armed === 'gigante' ? 27 : cb.r;
    const gd = { segs: [], ghost: null, target: null, deflect: null };
    let hit = P.castRay(G.world, cb.x, cb.y, dx, dy, r, cb.id);
    gd.segs.push([cb.x, cb.y, hit.x, hit.y]);
    let ddx = dx, ddy = dy;
    if (hit.type !== 'ball' && hit.type !== 'none' && lvl >= 2) {
      const dn = dx * hit.nx + dy * hit.ny;
      ddx = dx - 2 * dn * hit.nx; ddy = dy - 2 * dn * hit.ny;
      const h2 = P.castRay(G.world, hit.x + ddx * 0.5, hit.y + ddy * 0.5, ddx, ddy, r, cb.id);
      const maxL = lvl >= 3 ? 900 : 420, t = Math.min(h2.t, maxL);
      gd.segs.push([hit.x, hit.y, hit.x + ddx * t, hit.y + ddy * t]);
      if (h2.t <= maxL) hit = h2; else hit = { type: 'none', x: hit.x + ddx * t, y: hit.y + ddy * t };
    }
    gd.ghost = { x: hit.x, y: hit.y, r };
    if (hit.type === 'ball') {
      const b = hit.ball, L = [46, 95, 210, 430][lvl];
      let t = L;
      if (lvl >= 2) { const h3 = P.castRay(G.world, b.x, b.y, hit.nx, hit.ny, b.r, b.id); t = Math.min(L, h3.t); }
      gd.target = [b.x, b.y, b.x + hit.nx * t, b.y + hit.ny * t];
      const dn = ddx * hit.nx + ddy * hit.ny, tx = ddx - dn * hit.nx, ty = ddy - dn * hit.ny, tl = Math.hypot(tx, ty);
      if (tl > 0.08) { const dl = (26 + lvl * 26) * tl; gd.deflect = [hit.x, hit.y, hit.x + (tx / tl) * dl, hit.y + (ty / tl) * dl]; }
    }
    G.guide = gd;
  }

  // ---------- tacada ----------
  function newShot(free) {
    const T = G.T, m = G.mods, cue = cueDef();
    const s = {
      chips: 0, mult: 1 + 0.5 * T.streak * m.streakMult, xmult: cue.xmult || 1, pocketed: [], notes: [], coins: 0,
      isBreak: T.shotNo === 0 && !free, isLast: T.shotsLeft === 1 && !free, scratch: false, cueCush: 0, firstTouch: null,
      bumps: 0, t: 0, exploded: {}, curse: 0, free: !!free, lowestId: -1, soproDone: false, decisive: false, gold: false,
    };
    let low = 1e9;
    for (const b of G.world.balls) if (b.alive && b.kind === 'obj' && typeof b.num === 'number' && b.num < low) { low = b.num; s.lowestId = b.id; }
    if (T.streak > 0) s.notes.push('Sequência ' + T.streak + ' (+' + SA.fmtMult(0.5 * T.streak * m.streakMult) + ')');
    for (const rel of G.run.relics) { const d = D.RELICS[rel.id]; if (d.start) d.start(G, s, rel); }
    return s;
  }

  G.shoot = function () {
    if (G.state !== 'aim' || G.aim.power < 0.03) return false;
    G.state = 'strike'; G.aim.strike = 0.0001; G.guide = null;
    return true;
  };

  function launch() {
    const T = G.T, cb = G.cueBall, A = G.aim, m = G.mods, cue = cueDef(), run = G.run;
    G.undo = snapTable();
    const shot = (G.shot = newShot(false));
    let speed = (280 + 2620 * A.power) * m.power * (cue.power || 1);
    const chalk = G.armed >= 0 ? run.chalks[G.armed] : null;
    cb.firstHit = false; cb.follow = A.spinY; cb.side = A.spinX; cb.plow = 0; cb.phase = 0; cb.passed = null; cb.fire = false;
    if (chalk) {
      if (chalk === 'fogo') { cb.fire = true; cb.burning = true; cb.plow = 0.62; Au.fire(); }
      if (chalk === 'fantasma') { cb.phase = 1; cb.passed = []; cb.ghostFx = true; }
      if (chalk === 'trovao') { speed *= 1.8; Au.zap(); Rn.flash('#fff7a8', 0.35); shake(10); }
      if (chalk === 'pulo') { cb.vz = 210; cb.z = 27; }
      if (chalk === 'fome') G.world.geom.hungry = true;
      if (chalk === 'ouro') shot.gold = true;
      if (chalk === 'gigante') { cb.r = 27; cb.m = 3; }
      if (chalk === 'triplo') {
        for (const da of [-0.2, 0.2]) {
          const c = P.makeBall({ kind: 'cue', type: 'clone', color: '#bfe6ff', x: cb.x, y: cb.y, ghost: false });
          c.clone = true; c.vx = Math.cos(A.angle + da) * speed; c.vy = Math.sin(A.angle + da) * speed; c.firstHit = true;
          G.world.balls.push(c);
        }
      }
      if (!(m.chalkKeep && G.fxRng() < m.chalkKeep)) run.chalks.splice(G.armed, 1); else UI().toast('♾️ Giz Eterno: o giz não gastou!');
      G.armed = -1;
    }
    cb.vx = Math.cos(A.angle) * speed; cb.vy = Math.sin(A.angle) * speed;
    G.world.spin = true;
    T.shotNo++; run.stats.shots++;
    A.show = false; A.pull = 0;
    Au.cue(A.power); vibrate(12 + A.power * 20);
    if (A.power > 0.8) shake(5);
    Rn.burst(cb.x, cb.y, cb.r, '#9fd0ff', 5, 90, { type: 'dust', life: 0.35, grav: 0, size: 3 });
    G.state = 'sim'; G.acc = 0;
    UI().hud(); UI().tally(shot);
  }

  G.useChalk = function (i) {
    const run = G.run, id = run.chalks[i];
    if (!id || G.state !== 'aim') return;
    const def = D.CHALKS[id];
    if (!def.instant) { G.armed = G.armed === i ? -1 : i; Au.ui(); UI().hud(); return; }
    if (id === 'tempo') {
      if (!G.undo) { UI().toast('Ainda não há tacada para desfazer.'); Au.nope(); return; }
      const t = JSON.parse(G.undo);
      run.chalks.splice(i, 1);
      run.coins = t.coins;
      restoreTable(t);
      G.undo = null; G.armed = -1;
      Au.rewind(); Rn.flash('#7ab8ff', 0.45);
      UI().toast('⏪ O tempo voltou.');
      beginAim(true); G.saveRun('table');
      return;
    }
    if (id === 'terremoto') {
      run.chalks.splice(i, 1); G.armed = -1;
      G.undo = snapTable();
      G.shot = newShot(true);
      for (const b of G.world.balls) {
        if (!b.alive) continue;
        const a = Math.random() * Math.PI * 2, s = 380 + Math.random() * 520;
        b.vx = (Math.cos(a) * s) / b.m; b.vy = (Math.sin(a) * s) / b.m; b.vz = 160 + Math.random() * 180; b.z = 1;
      }
      Au.quake(); shake(26); vibrate(180);
      G.aim.show = false; G.guide = null; G.world.spin = true;
      G.state = 'sim'; G.acc = 0;
      UI().hud(); UI().tally(G.shot);
    }
  };

  // ---------- efeitos especiais ----------
  function ignite(b) {
    if (b.burning || b.kind !== 'obj') return;
    b.burning = true; Au.fire();
    Rn.burst(b.x, b.y, b.r, '#ff9a2e', 8, 110, { life: 0.5, size: 3.5 });
  }
  function explode(x, y, power, src) {
    for (const b of G.world.balls) {
      if (!b.alive || b.sink) continue;
      const dx = b.x - x, dy = b.y - y, d = Math.hypot(dx, dy);
      if (d > 210) continue;
      const k = 1 - d / 210;
      let nx, ny;
      if (d < 2) { const a = Math.random() * 6.283; nx = Math.cos(a); ny = Math.sin(a); } else { nx = dx / d; ny = dy / d; }
      const kk = b === src ? 0.35 : k;
      b.vx += (nx * power * kk) / b.m; b.vy += (ny * power * kk) / b.m;
      b.vz += 330 * k; if (b.z < 1) b.z = 1;
    }
    Rn.burst(x, y, 16, '#ffb03a', 26, 420, { life: 0.7, size: 5 });
    Rn.burst(x, y, 16, '#5a524c', 12, 160, { type: 'smoke', life: 0.9, size: 9, grav: -60 });
    Rn.ring(x, y, '#fff1c0', 210, 0.45);
    Rn.flash('#ffd9a0', 0.4); shake(20); Au.boom(); vibrate(90);
  }
  function splitAmeba(b) {
    b.alive = false;
    const sp = Math.hypot(b.vx, b.vy) || 1, nx = -b.vy / sp, ny = b.vx / sp, s = D.SPECIAL.amebinha;
    for (const k of [1, -1]) {
      const c = P.makeBall({ kind: 'obj', type: 'amebinha', num: s.glyph, glyph: s.glyph, pts: s.pts, color: s.color, r: 12, m: 0.6, x: b.x + nx * 13 * k, y: b.y + ny * 13 * k });
      c.vx = b.vx * 0.8 + nx * 240 * k; c.vy = b.vy * 0.8 + ny * 240 * k; c.burning = b.burning; c.lastHit = b.lastHit;
      G.world.balls.push(c);
    }
    Rn.burst(b.x, b.y, 14, '#9bd765', 14, 200, { life: 0.5, size: 4 });
    Rn.float(b.x, b.y, 'Mitose!', '#b9f08a', 18);
  }
  function lightning(px, py) {
    const pool = G.world.balls.filter((b) => b.alive && !b.sink && b.kind === 'obj');
    if (!pool.length) return;
    const t = pool[(Math.random() * pool.length) | 0], a = Math.random() * 6.283;
    t.vx = Math.cos(a) * 1350; t.vy = Math.sin(a) * 1350; t.vz = 220; t.z = 1; t.lastHit = 'obj';
    Rn.bolt(px, py, t.x, t.y); Rn.burst(t.x, t.y, 14, '#fff7a8', 16, 300, { life: 0.4 });
    Rn.flash('#fffbe0', 0.5); shake(12); Au.zap(); vibrate(40);
  }

  function shotTotal(s) { return Math.round(s.chips * s.mult * s.xmult); }

  function onPocket(e) {
    const b = e.b, pk = e.pk, T = G.T, shot = G.shot, m = G.mods;
    const px = b.sink.x, py = b.sink.y;
    Au.pocket(); vibrate(25);
    Rn.burst(px, py, 10, '#d9cdb8', 6, 90, { type: 'dust', life: 0.45, grav: 0, size: 4 });
    if (!shot) return;
    if (b.kind === 'cue') {
      if (b.clone) return;
      if (m.kamikaze) { shot.chips += 60; Rn.float(px, py, 'Kamikaze +60', '#9fe8ff', 20); Au.bonus(3); } else { shot.scratch = true; Rn.float(px, py, 'FALTA!', '#ff5a4a', 26); Au.foul(); shake(8); G.run.stats.scratches++; }
      UI().tally(shot);
      return;
    }
    const acc = { chips: b.pts + (b.bonus || 0), mult: 0, x: 1, coins: 0, labels: [] };
    if (b.type === 'camaleao') { acc.chips = T.lastPts * 2; acc.labels.push('Camaleão'); }
    if (shot.pocketed.length >= 1) { acc.mult += 1; acc.labels.push('Combo +1'); }
    if (b.cush > 0) { acc.mult += m.bankMult; acc.labels.push('Tabela +' + SA.fmtMult(m.bankMult)); }
    if (b.lastHit === 'obj') { acc.mult += m.kissMult; acc.labels.push('Carambola +' + SA.fmtMult(m.kissMult)); }
    if (b.burning) { acc.chips += m.burnPts; acc.labels.push('Em chamas +' + m.burnPts); }
    if (pk === -1) { acc.mult += 0.5; acc.labels.push('Singularidade +0,5'); }
    if (pk >= 0 && T.golden === pk) { acc.chips *= 2; acc.labels.push('Caçapa dourada: pontos ×2'); }
    if (b.type === 'ouro') acc.coins += 3;
    if (b.type === 'cristal') { acc.mult += 1; acc.labels.push('Cristal +1'); }
    if (b.type === 'maldita') {
      const others = G.world.balls.some((o) => o !== b && o.alive && !o.sink && o.kind === 'obj');
      if (others) { shot.curse++; acc.labels.push('Maldição! −1 tacada'); Rn.flash('#a0101c', 0.35); } else { acc.x *= 3; acc.labels.push('Maldita por último ×3'); }
    }
    const boss = bossDef();
    if (boss && boss.noEven && typeof b.num === 'number' && b.num % 2 === 0) { acc.chips = 0; acc.labels = ['Luto: par não pontua']; }
    for (const rel of G.run.relics) { const d = D.RELICS[rel.id]; if (d.pocket) d.pocket(G, shot, b, pk, acc, rel); }
    if (boss && boss.halfFirst && shot.pocketed.length === 0) { acc.chips = 0; acc.labels = ['Reflexo: a primeira vale zero']; }
    if (shot.gold) acc.coins += 2;
    shot.chips += acc.chips; shot.mult += acc.mult; shot.xmult *= acc.x;
    if (acc.coins) { shot.coins += acc.coins; G.run.coins += acc.coins; G.run.stats.coins += acc.coins; Rn.float(px, py, '+' + acc.coins + ' 🪙', '#ffd766', 18, 78); Au.coin(); }
    shot.pocketed.push(b);
    if (b.type !== 'camaleao') T.lastPts = b.pts;
    G.run.stats.pocketed++;
    Rn.float(px, py, '+' + acc.chips, '#ffffff', 24, 34);
    acc.labels.slice(0, 3).forEach((l, i) => Rn.float(px, py, l, '#ffd766', 15, 56 + i * 20));
    Rn.burst(px, py, 14, b.color, 10, 220, { life: 0.6, size: 3.5 });
    Au.bonus(shot.pocketed.length);
    if (b.type === 'raio') lightning(px, py);
    if (shot.pocketed.length >= 2) G.slow = Math.max(G.slow, 0.35);
    if (!shot.decisive && T.score + shotTotal(shot) >= T.target) { shot.decisive = true; G.slow = Math.max(G.slow, 0.7); Rn.flash('#fff3c4', 0.3); Rn.float(0, 0, 'CONTA FECHADA!', '#ffd766', 34, 120); }
    UI().tally(shot);
  }

  function onEvent(e) {
    const shot = G.shot;
    if (G.state !== 'sim') { if (e.t === 'bumper') e.c.hot = 0.18; return; }
    switch (e.t) {
      case 'hit': {
        Au.clack(e.v);
        const a = e.a, b = e.b;
        if (a.kind === 'obj') { a.lastHit = b.kind === 'cue' ? 'cue' : 'obj'; a.cush = 0; }
        if (b.kind === 'obj') { b.lastHit = a.kind === 'cue' ? 'cue' : 'obj'; b.cush = 0; }
        if (e.v > 520) Rn.burst(e.x, e.y, 14, '#ffffff', 3, 110, { type: 'dust', life: 0.3, grav: 0, size: 2.5 });
        if (e.v > 900) vibrate(8);
        if (!shot) break;
        if (e.cue) {
          if (e.first && !e.cue.clone) { shot.firstTouch = e.other; if (G.mods.igniteFirst) ignite(e.other); }
          if (e.cue.fire) ignite(e.other);
        }
        if (a.type === 'fogo') ignite(b); if (b.type === 'fogo') ignite(a);
        for (const x of [a, b]) {
          if (x.type === 'bomba' && !shot.exploded[x.id] && e.v > 140) { shot.exploded[x.id] = 1; explode(x.x, x.y, 1500, x); }
          if (x.type === 'ameba' && x.alive && e.v > 160) splitAmeba(x);
        }
        if (G.mods.polvora && e.v > 950 && G.fxRng() < 0.2) explode(e.x, e.y, 1100, null);
        break;
      }
      case 'cushion':
        Au.cushion(e.v);
        if (!e.jaw && !e.spinner) {
          e.b.cush++;
          if (e.b.type === 'borracha' && shot) { e.b.bonus += 15; Rn.float(e.x, e.y, '+15', '#ff9ac8', 15); }
          if (e.b.kind === 'cue' && shot) shot.cueCush++;
        }
        if (G.world.geom.electric && !e.wall && e.v > 160) { Rn.burst(e.x, e.y, 12, '#bfe9ff', 6, 240, { life: 0.3, size: 2.5 }); if (e.v > 400) Au.zap(); }
        break;
      case 'bumper':
        Au.bumper(); e.c.hot = 0.18;
        Rn.burst(e.c.x, e.c.y, 24, '#ffe07a', 6, 200, { life: 0.35 });
        if (shot) { shot.chips += 5; shot.bumps++; Rn.float(e.c.x, e.c.y, '+5', '#ffe07a', 15, 50); UI().tally(shot); }
        break;
      case 'lid': Au.cushion(e.v); Rn.burst(e.b.x, e.b.y, 14, '#d0d4dc', 4, 120, { life: 0.3 }); break;
      case 'portal':
        Au.portal();
        Rn.burst(e.from.x, e.from.y, 8, '#ff9a3c', 10, 180, { life: 0.4 }); Rn.burst(e.to.x, e.to.y, 8, '#4aa8ff', 10, 180, { life: 0.4 });
        break;
      case 'phase': Rn.float(e.o.x, e.o.y, 'Uuuh!', '#cfe0ff', 16); Au.portal(); break;
      case 'land': Au.cushion(e.v * 0.5); Rn.burst(e.b.x, e.b.y, 2, '#e8e0d0', 4, 80, { type: 'dust', life: 0.3, grav: 0 }); break;
      case 'pocket': onPocket(e); break;
    }
  }

  function settle() {
    const shot = G.shot, T = G.T, m = G.mods, w = G.world;
    for (const b of w.balls) { b.vx = b.vy = b.vz = 0; b.z = 0; }
    if (m.sopro && !shot.soproDone) {
      shot.soproDone = true;
      let any = false;
      for (const b of w.balls) {
        if (!b.alive || b.sink || b.kind !== 'obj') continue;
        for (let k = 0; k < 6; k++) {
          const p = w.geom.pockets[k];
          if (p.closed) continue;
          if (Math.hypot(b.x - p.x, b.y - p.y) < p.r + 30) { b.sink = { t: 0, x: p.x, y: p.y, pk: k, sx: b.x, sy: b.y }; w.events.push({ t: 'pocket', b, pk: k, v: 0 }); any = true; break; }
        }
      }
      if (any) { Rn.float(0, 0, '🌬️ Sopro do Além', '#cfe9ff', 20, 60); return false; }
    }
    return true;
  }

  function finishShot() {
    const shot = G.shot, T = G.T, m = G.mods, w = G.world, run = G.run;
    w.spin = false; w.geom.hungry = false;
    for (const rel of run.relics) { const d = D.RELICS[rel.id]; if (d.end) d.end(G, shot, rel); }
    const n = shot.pocketed.length;
    let total = shotTotal(shot);
    if (shot.scratch) total = Math.floor(total / 2);
    shot.total = total;
    if (n > 0 && !shot.scratch) T.streak++; else if (!shot.free) T.streak = 0;
    const boss = bossDef();
    if (boss && boss.debt && n === 0 && !shot.free) { T.target = Math.ceil((T.target * (1 + boss.debt)) / 10) * 10; UI().toast('😈 Dívida: a meta subiu para ' + SA.fmt(T.target)); }
    T.score += total;
    run.stats.total += total;
    if (total > run.stats.bestShot) run.stats.bestShot = total;
    if (total > G.meta.bestShot) G.meta.bestShot = total;
    const refund = m.refund2 && n >= 2;
    if (!shot.free && !refund) T.shotsLeft--;
    if (refund && !shot.free) UI().toast('🫳 Mão Boba: tacada devolvida!');
    T.shotsLeft = Math.max(0, T.shotsLeft - shot.curse);
    w.balls = w.balls.filter((b) => b.alive && !b.clone);
    if (!G.cueBall.alive || w.balls.indexOf(G.cueBall) < 0) { G.cueBall = null; }
    placeCueKeep();
    G.state = 'resolve';
    G.resolveT = total > 0 ? 1.15 : 0.45;
    UI().tallyDone(shot, total);
    UI().hud();
  }
  function placeCueKeep() {
    const cb = G.cueBall;
    if (cb && cb.alive) { cb.r = P.R; cb.m = 1; cb.burning = false; cb.fire = false; cb.plow = 0; cb.phase = 0; cb.passed = null; cb.ghostFx = false; return; }
    placeCue();
  }

  function afterShot() {
    const T = G.T, run = G.run;
    if (T.score >= T.target) { winTable(); return; }
    if (T.shotsLeft <= 0) {
      const i = run.relics.findIndex((r) => r.id === 'saideira');
      if (i >= 0) {
        run.relics.splice(i, 1); G.calcMods();
        T.shotsLeft = 3; UI().banner('🍻 Saideira!', 'Mais três tacadas por conta da casa.', 'table', 1800); Au.win();
      } else { lose(); return; }
    }
    if (!G.world.balls.some((b) => b.alive && b.kind === 'obj')) {
      T.racks++;
      const bag = run.bag.slice();
      G.world.balls = G.world.balls.filter((b) => b.kind === 'cue');
      for (const b of rack(bag, G.rng)) G.world.balls.push(b);
      if (G.cueBall.x > 150) { G.cueBall.alive = false; G.world.balls = G.world.balls.filter((b) => b.kind !== 'cue'); G.cueBall = null; placeCue(); }
      run.coins += 2;
      UI().banner('Mesa limpa!', 'Nova leva de bolas na mesa. +2 moedas', 'table', 1700);
    }
    beginAim(false);
  }

  function winTable() {
    const T = G.T, run = G.run, boss = bossDef();
    G.state = 'cleared';
    const pay = { lines: [['Mesa vencida', 4], ['Tacadas que sobraram', T.shotsLeft]], left: T.shotsLeft, extra: [] };
    if (boss) pay.lines.push(['Chefe derrotado', 4]);
    for (const rel of run.relics) { const d = D.RELICS[rel.id]; if (d.win) d.win(G, pay, rel); }
    if (T.wager) { const s = pay.lines.reduce((a, l) => a + l[1], 0); pay.lines.push(['Aposta dobrada', s]); }
    if (T.reward) {
      if (T.reward.type === 'coins') pay.lines.push(['Prêmio da mesa', T.reward.n]);
      if (T.reward.type === 'chalk') { if (run.chalks.length < 3) { run.chalks.push(T.reward.id); see('c', T.reward.id); pay.extra.push(D.CHALKS[T.reward.id].icon + ' ' + D.CHALKS[T.reward.id].name); } else pay.lines.push(['Giz trocado por moedas', 2]); }
      if (T.reward.type === 'relic') { if (run.relics.length < 6 && !hasRelic(T.reward.id)) { run.relics.push({ id: T.reward.id }); see('r', T.reward.id); G.calcMods(); pay.extra.push(D.RELICS[T.reward.id].icon + ' ' + D.RELICS[T.reward.id].name); } else pay.lines.push(['Amuleto trocado por moedas', 4]); }
    }
    pay.total = pay.lines.reduce((a, l) => a + l[1], 0);
    run.coins += pay.total; run.stats.coins += pay.total; run.stats.tables++;
    if (T.score > G.meta.bestTable) G.meta.bestTable = T.score;
    pay.score = T.score; pay.target = T.target; pay.boss = !!boss;
    run.depth++; run.idx++;
    let finale = false;
    if (run.idx > 2) {
      run.idx = 0; run.act++;
      if (run.act > G.meta.unlock) G.meta.unlock = Math.min(3, run.act);
      if (run.act === 3 && !run.endless) { finale = true; G.meta.wins++; }
    }
    if (run.depth > G.meta.deepest) G.meta.deepest = run.depth;
    pay.finale = finale;
    Au.win(); vibrate(120);
    for (let i = 0; i < 5; i++) Rn.burst((Math.random() - 0.5) * 700, (Math.random() - 0.5) * 300, 60, ['#ffd766', '#ff6b6b', '#7ad7ff', '#9be38a'][i % 4], 16, 380, { type: 'conf', life: 1.5, size: 5, grav: 500 });
    G.pay = pay;
    genShop();
    G.saveRun('shop');
    UI().showCleared(pay);
  }

  function lose() {
    G.state = 'over';
    Au.lose(); Au.music(false);
    const run = G.run;
    G.lastRun = { win: false, stats: run.stats, act: run.act, idx: run.idx, depth: run.depth, seed: run.seed, T: G.T, relics: run.relics.slice() };
    G.run = null; G.saved = null; G.persist();
    UI().showOver(G.lastRun);
  }
  G.abandon = function () {
    if (!G.run) return;
    const run = G.run;
    G.lastRun = { win: false, stats: run.stats, act: run.act, idx: run.idx, depth: run.depth, seed: run.seed, T: G.T, relics: run.relics.slice(), quit: true };
    G.run = null; G.saved = null; G.persist(); Au.music(false);
    G.toMenu();
  };
  G.goEndless = function () { G.run.endless = true; G.saveRun('shop'); G.state = 'shop'; UI().showShop(); };
  G.endVictory = function () {
    const run = G.run;
    G.lastRun = { win: true, stats: run.stats, act: run.act, idx: run.idx, depth: run.depth, seed: run.seed, relics: run.relics.slice() };
    G.run = null; G.saved = null; G.persist();
    UI().showOver(G.lastRun);
  };

  // ---------- balcão (loja) ----------
  G.price = function (p) { return Math.max(1, Math.ceil(p * (1 - (G.mods.discount || 0)))); };
  function rollRelic(exclude) {
    const r = G.rng, act = G.run.act;
    const w = [Math.max(35, 62 - act * 9), 30 + act * 4, 8 + act * 5];
    for (let tries = 0; tries < 40; tries++) {
      let x = r() * (w[0] + w[1] + w[2]), rar = x < w[0] ? 0 : x < w[0] + w[1] ? 1 : 2;
      const pool = D.RELIC_IDS.filter((id) => D.RELICS[id].rar === rar && !hasRelic(id) && exclude.indexOf(id) < 0 && !(id === 'saideira' && G.run.saideiraUsed));
      if (pool.length) return r.pick(pool);
    }
    return null;
  }
  function genShop(keepRerolls) {
    const r = G.rng, run = G.run, items = [], ex = [];
    for (let i = 0; i < 3; i++) { const id = rollRelic(ex); if (id) { ex.push(id); items.push({ kind: 'relic', id, price: D.RELIC_PRICE[D.RELICS[id].rar], sold: false }); } }
    const balls = r.shuffle(D.SPECIAL_IDS.slice()).slice(0, 2);
    for (const id of balls) items.push({ kind: 'ball', id, price: D.SPECIAL[id].price, sold: false });
    const chalks = r.shuffle(D.CHALK_IDS.slice()).slice(0, 2);
    for (const id of chalks) items.push({ kind: 'chalk', id, price: D.CHALK_PRICE, sold: false });
    run.shop = { items, rerolls: keepRerolls ? run.shop.rerolls : 0 };
  }
  G.rerollCost = () => 2 + (G.run.shop ? G.run.shop.rerolls : 0);
  G.reroll = function () {
    const c = G.rerollCost();
    if (G.run.coins < c) { Au.nope(); return false; }
    G.run.coins -= c; G.run.shop.rerolls++;
    genShop(true); Au.buy(); G.saveRun('shop');
    return true;
  };
  G.buy = function (i) {
    const run = G.run, it = run.shop.items[i];
    if (!it || it.sold) return 'x';
    const price = G.price(it.price);
    if (run.coins < price) { Au.nope(); return 'Faltam moedas.'; }
    if (it.kind === 'relic') { if (run.relics.length >= 6) { Au.nope(); return 'Sem espaço: venda um amuleto (máx. 6).'; } run.relics.push({ id: it.id }); see('r', it.id); G.calcMods(); }
    if (it.kind === 'chalk') { if (run.chalks.length >= 3) { Au.nope(); return 'Só cabem 3 gizes no bolso.'; } run.chalks.push(it.id); see('c', it.id); }
    if (it.kind === 'ball') { if (run.bag.length >= 21) { Au.nope(); return 'O saco está cheio (21 bolas).'; } run.bag.push({ t: it.id, pts: D.SPECIAL[it.id].pts }); see('b', it.id); }
    run.coins -= price; it.sold = true;
    Au.buy(); G.saveRun('shop');
    return null;
  };
  G.sellRelic = function (i) {
    const run = G.run, rel = run.relics[i];
    if (!rel) return;
    run.coins += Math.floor(D.RELIC_PRICE[D.RELICS[rel.id].rar] / 2);
    run.relics.splice(i, 1); G.calcMods(); Au.coin(); G.saveRun();
  };
  G.polishBall = function (i) {
    const run = G.run, c = G.price(3);
    if (run.coins < c) { Au.nope(); return 'Faltam moedas.'; }
    run.coins -= c; run.bag[i].pts += 20; Au.buy(); G.saveRun();
    return null;
  };
  G.removeBall = function (i) {
    const run = G.run, c = G.price(3);
    if (run.bag.length <= 6) { Au.nope(); return 'O saco precisa de pelo menos 6 bolas.'; }
    if (run.coins < c) { Au.nope(); return 'Faltam moedas.'; }
    run.coins -= c; run.bag.splice(i, 1); Au.buy(); G.saveRun();
    return null;
  };

  // ---------- portas (escolha da próxima mesa) ----------
  function pickMods(k) {
    const r = G.rng, out = [];
    const pool = r.shuffle(D.MOD_POOL.slice());
    for (const m of pool) {
      if (out.length >= k) break;
      const solid = ['pinball', 'helice', 'buraco'];
      if (m === 'paredes' && out.some((o) => solid.indexOf(o) >= 0)) continue;
      if (solid.indexOf(m) >= 0 && out.indexOf('paredes') >= 0) continue;
      if (m === 'helice' && out.indexOf('buraco') >= 0) continue;
      if (m === 'buraco' && out.indexOf('helice') >= 0) continue;
      if (m === 'gelo' && out.indexOf('lama') >= 0) continue;
      if (m === 'lama' && out.indexOf('gelo') >= 0) continue;
      out.push(m);
    }
    return out;
  }
  function rewardFor(h) {
    const r = G.rng;
    if (h <= 0) return { type: 'coins', n: 1 };
    if (h === 1) return { type: 'coins', n: 3 };
    if (h === 2) return r() < 0.5 ? { type: 'chalk', id: r.pick(D.CHALK_IDS) } : { type: 'coins', n: 5 };
    const id = rollRelic([]);
    return id && r() < 0.7 ? { type: 'relic', id } : { type: 'coins', n: 7 };
  }
  G.genDoors = function () {
    const run = G.run, r = G.rng, doors = [];
    if (run.idx === 2) {
      let pool = Object.keys(D.BOSSES).filter((b) => D.BOSSES[b].act === run.act % 3);
      if (run.act >= 3) pool = Object.keys(D.BOSSES);
      const id = r.pick(pool), b = D.BOSSES[id];
      doors.push({ boss: id, mods: b.mods.slice(), wager: false, reward: { type: 'coins', n: 0 } });
    } else {
      const base = run.act >= 3 ? 2 : run.act >= 2 ? 2 : 1;
      for (let i = 0; i < 2; i++) {
        const mods = pickMods(base + i), wager = i === 1 && r() < 0.4;
        const h = Math.max(i, mods.reduce((a, m) => a + D.MODS[m].hard, 0) + i);
        doors.push({ boss: null, mods, wager, reward: rewardFor(h) });
      }
    }
    for (const d of doors) d.target = targetFor(d);
    run.doors = doors;
  };
  G.leaveShop = function () { G.genDoors(); G.state = 'doors'; G.saveRun('doors'); UI().showDoors(); };
  G.pickDoor = function (i) { const d = G.run.doors[i]; G.run.doors = null; G.run.shop = null; G.startTable(d); };

  // ---------- menu / pano de fundo ----------
  function demoBackdrop() {
    const act = G.run ? G.run.act : 0;
    const T = { act, mods: [], features: { bumpers: [], portals: null, patches: [], walls: [], spinner: null, well: null, tilt: null }, golden: -1, windNow: null, closed: [] };
    G.T = T;
    const mods = G.mods; G.mods = { pocket: 1, friction: 1 };
    buildWorld(T);
    G.mods = mods;
    const r = SA.makeRng((Math.random() * 1e9) | 0), bag = [];
    for (let n = 1; n <= 10; n++) bag.push({ t: 'n', num: n, pts: 0 });
    for (const s of ['ouro', 'fantasma', 'fogo', 'cristal', 'bomba']) bag.push({ t: s, pts: 0 });
    G.world.balls = rack(bag, r);
    for (const b of G.world.balls) { b.x = r.range(-430, 430); b.y = r.range(-200, 200); }
    G.cueBall = null; placeCue();
    G.aim.show = false; G.guide = null; G.shot = null;
  }
  G.toMenu = function () {
    G.run = null;
    G.calcMods();
    demoBackdrop();
    G.state = 'menu'; G.idleT = 0;
    Au.music(true, 92, 0);
    UI().showMenu();
  };

  // ---------- laço principal ----------
  G.update = function (dt) {
    G.time += dt;
    const w = G.world;
    if (!w) return;
    if (G.state === 'aim') {
      computeGuide();
      G.aim.pull = G.aim.power * 150;
    } else if (G.state === 'strike') {
      G.aim.strike += dt / 0.085;
      if (G.aim.strike >= 1) launch();
    } else if (G.state === 'sim' || G.state === 'menu' || G.state === 'shop' || G.state === 'doors' || G.state === 'cleared' || G.state === 'over') {
      const sim = G.state === 'sim';
      let scale = sim ? (G.fast ? 3.2 : 1) : 0.8;
      if (sim && G.slow > 0) { G.slow -= dt; scale *= 0.32; }
      G.acc += dt * scale;
      let steps = 0;
      while (G.acc >= STEP && steps < 14) {
        G.acc -= STEP; steps++;
        P.step(w, STEP);
        if (sim) {
          G.shot.t += STEP;
          if (G.shot.t > 11) for (const b of w.balls) { b.vx *= 0.93; b.vy *= 0.93; }
        }
        if (w.events.length) { const ev = w.events; w.events = []; for (let i = 0; i < ev.length; i++) onEvent(ev[i]); }
        if (sim && G.state !== 'sim') break;
      }
      if (G.acc > STEP * 14) G.acc = 0;
      if (sim && G.state === 'sim') {
        if (P.atRest(w) || G.shot.t > 15) { if (settle()) finishShot(); }
        // chamas e rastros
        for (const b of w.balls) {
          if (!b.alive || b.sink) continue;
          if ((b.burning || b.type === 'fogo') && Math.random() < 0.3) Rn.burst(b.x, b.y, b.z + b.r * 1.6, Math.random() < 0.5 ? '#ffb03a' : '#ff5a2a', 1, 26, { life: 0.4, size: 3, grav: -260, up: 1.4 });
          if (b.type === 'bomba' && Math.random() < 0.12) Rn.burst(b.x, b.y, b.z + b.r * 2, '#ffe07a', 1, 30, { life: 0.25, size: 2, grav: 200 });
          if (b.kind === 'cue' && b.ghostFx && Math.random() < 0.3) Rn.burst(b.x, b.y, b.z + b.r, '#cfe0ff', 1, 20, { type: 'dust', life: 0.4, size: 4, grav: 0 });
        }
      } else if (!sim) {
        // mesa de enfeite: de vez em quando, uma tacada sozinha
        w.spin = true;
        if (P.atRest(w)) {
          G.idleT += dt;
          if (G.idleT > 1.6) {
            G.idleT = 0;
            const objs = w.balls.filter((b) => b.alive && b.kind === 'obj');
            if (objs.length < 5 || !G.cueBall || !G.cueBall.alive) demoBackdrop();
            else { const t = objs[(Math.random() * objs.length) | 0], cb = G.cueBall, a = Math.atan2(t.y - cb.y, t.x - cb.x) + (Math.random() - 0.5) * 0.1, s = 900 + Math.random() * 1100; cb.vx = Math.cos(a) * s; cb.vy = Math.sin(a) * s; cb.firstHit = true; }
          }
        }
        w.balls = w.balls.filter((b) => b.alive);
        if (G.cueBall && !G.cueBall.alive) G.cueBall = null;
      }
    } else if (G.state === 'resolve') {
      G.resolveT -= dt * (G.fast ? 2.5 : 1);
      if (G.resolveT <= 0) afterShot();
    }
  };

  Object.defineProperty(G, 'cueColors', { get() { return cueDef().colors; } });
  // usado pelos testes e pela interface
  G._internals = { rack, pickMods, genFeatures };
})(window);
