// Água-Tinta — the aquarium scene (owner D, §7, §11.5). One tank at a time, drawn in ink: glass frame, water,
// swaying decor, sand, the lamp, the filter's bubbles, kept fish (B's creatures in tank mode), food flakes, emotes,
// visitors and the till's coin shower. E draws the HUD and the toolbar; they talk to this scene through the scene
// definition (tankId, setTank, next, prev) and the bus. Browser only (registered on AQ.scenes).
(function (AQ) {
  'use strict';

  var U = AQ.util, R = AQ.render, D = AQ.display, ASPECT = AQ.ASPECT;
  var MAX_W = 112, MAX_ROWS = 26, MIN_W = 20, MIN_ROWS = 7;
  var FOOD_MAX = 32, EMOTE_MAX = 10, VIS_MAX = 8;
  var TAU = Math.PI * 2;

  // Fallback art (used only while AQ.art does not provide its own; B owns the real art).
  var DECOR_ART = {
    pedras: { f: ['   __   ', ' _(  )_ ', '(__)(__)'] },
    algas: { f: [' )  ( ', '(  ) )', ' ) (( ', '(  ) )'], deform: 'sway', amp: 0.8 },
    coral: { f: ['\\ | /', 'Y\\|/Y', ' \\|/ ', ' _|_ '] },
    anemona: { f: [' ,;;;, ', ';)|||(;', ' \\|||/ ', '  ~~~  '], deform: 'sway', amp: 0.4 },
    kelp: { f: [' )( ', '(  )', ' )( ', '(  )', ' )( ', '(  )'], deform: 'sway', amp: 1 },
    gruta: { f: ['   ____   ', ' _/    \\_ ', '/  .--.  \\', '| /    \\ |'] },
    castelo: { f: ['|^| |^|', '| |_| |', '|  _  |', '|_| |_|'] },
    ostra: { f: [' .--. ', '(_@__)'] },
    bau: { f: [' .----. ', ' |[##]| ', " '----' "] },
    naufragio: { f: ['    |\\    ', '    | \\   ', ' ___|__\\_ ', ' \\_o__o_/ '] },
    ruina: { f: [' _____ ', ' | | | ', ' | | | ', '_|_|_|_'] },
    farol: { f: [' /\\ ', ' [] ', ' || ', '/__\\'] }
  };
  var LAMP_ART = [' | ', '/_\\'];
  var FILTER_ART = ['[=]', '|_|'];
  var VISITOR_ART = [
    [[' o ', '/|\\', '/ \\'], [' o ', '/|\\', ' |\\']],
    [[' o ', '/|\\', '/_\\'], [' o ', '(|)', '/_\\']],
    [[' o ', '/^\\'], [' o ', '|^|']],
    [['.o.', ' | ', '/ \\'], ['.o.', ' | ', ' |\\']]
  ];

  // ---------------------------------------------------------------- module state
  var S = null;                  // AQ.state
  var tankIdx = 0, tankId = 't1';
  var L = {                      // layout (grid cells)
    ok: false, c0: 0, W: 0, rT: 0, rB: 0, rows: 0, sandRows: 2, sandTop: 0, visRow: -1, floorRow: -1,
    floorY: 0, sandY: 0, insetsKey: ''
  };
  var list = [];                 // creatures in the shown tank
  var byUid = Object.create(null);
  var rng = null;
  var time = 0, insetT = 0, visT = 0, emoteT = 3, bubbleT = 0, chestT = 2, hintT = 0;
  var contemplating = false, contOffAt = -1, cardsOpened = 0;
  var offs = [];
  var dout = [0, 0];

  var env = {
    mode: 'tank', t: 0, rng: null, bounds: { x0: 0, y0: 0, x1: 40, y1: 30 }, surfaceY: 2, depth: 28,
    floorY: function () { return L.floorY; }, covers: [], hook: null, food: [], visibility: null,
    phase: 'dia', light: 'day', level: 12, frenzy: false, onEvent: onCreatureEvent
  };

  // food flakes (pooled)
  var foodPool = [], foodSeq = 0;
  for (var fi = 0; fi < FOOD_MAX; fi++) foodPool.push({ alive: false, id: 0, x: 0, y: 0, vy: 0, wob: 0, t: 0, settled: 0, ch: 0 });
  // emotes (pooled)
  var emotes = [];
  for (var ei = 0; ei < EMOTE_MAX; ei++) emotes.push({ alive: false, text: '', uid: 0, x: 0, y: 0, t: 0, life: 0, level: 10 });
  // visitors (pooled)
  var visitors = [];
  for (var vi = 0; vi < VIS_MAX; vi++) visitors.push({ alive: false, x: 0, vx: 0, dir: 1, kind: 0, fAcc: 0, state: 'walk', stopT: 0, nextStop: 0, mark: 0, leaving: false });
  var visTarget = 0;

  var codes = null;
  function C() {
    if (!codes) {
      codes = {
        dot: R.code('·'), deg: R.code('°'), comma: R.code(','), pipe: R.code('|'), plus: R.code('+'), dash: R.code('-'),
        under: R.code('_'), star: R.code('*'), o: R.code('o'), bang: R.code('!'), at: R.code('@'), period: R.code('.'),
        quote: R.code("'"), colon: R.code(':')
      };
    }
    return codes;
  }

  // ---------------------------------------------------------------- helpers
  function tanks() { return (S && S.aquarium && S.aquarium.tanks) || []; }
  function curTank() {
    var t = tanks();
    if (!t.length) return null;
    if (tankIdx >= t.length || tankIdx < 0) tankIdx = 0;
    if (t[tankIdx].id !== tankId) {
      for (var i = 0; i < t.length; i++) if (t[i].id === tankId) { tankIdx = i; break; }
      if (t[tankIdx].id !== tankId) tankId = t[tankIdx].id;
    }
    def.tankId = tankId;
    def.tank = t[tankIdx];
    return t[tankIdx];
  }
  function species(id) { return AQ.species && AQ.species.get ? AQ.species.get(id) : null; }
  function lightOf() { var tk = curTank(); return (tk && tk.light) || 'day'; }
  function motion() { return AQ.fx && AQ.fx.motion ? AQ.fx.motion() : 1; }
  function rowY(r) { return (r - (L.rT + 1)) * ASPECT; } // world y of the top of screen row r

  function decorArt(id) {
    var a = AQ.art && AQ.art.decor && AQ.art.decor[id];
    if (a) {
      if (Array.isArray(a)) return { frames: [a], deform: 'none', amp: 1, fps: 0 };
      if (a.frames && a.frames.length) return { frames: a.frames, deform: a.deform || 'none', amp: a.amp === undefined ? 1 : a.amp, fps: a.fps || 0 };
    }
    var f = DECOR_ART[id];
    if (!f) return null;
    return { frames: [f.f], deform: f.deform || 'none', amp: f.amp === undefined ? 1 : f.amp, fps: 0 };
  }
  function artLines(key, fallback) {
    var a = AQ.art && AQ.art[key];
    if (a) {
      if (Array.isArray(a) && typeof a[0] === 'string') return a;
      if (a.frames && a.frames.length) return a.frames[0];
      if (Array.isArray(a) && Array.isArray(a[0])) return a[0];
    }
    return fallback;
  }
  function visitorFrames(kind) {
    var v = AQ.art && AQ.art.visitors;
    if (v && v.length) {
      var e = v[kind % v.length];
      if (e && e.frames && e.frames.length) return e.frames;
      if (Array.isArray(e) && Array.isArray(e[0])) return e;
    }
    return VISITOR_ART[kind % VISITOR_ART.length];
  }

  // ---------------------------------------------------------------- layout
  function insets() {
    var ins = { top: 0, bottom: 0, left: 0, right: 0 };
    try { if (AQ.ui && AQ.ui.hudInsets) ins = AQ.ui.hudInsets() || ins; } catch (e) { /* ignore */ }
    return ins;
  }
  function relayout(force) {
    if (!D.cols || !D.rows) { L.ok = false; return; }
    var ins = insets();
    var key = D.cols + 'x' + D.rows + ':' + ins.top + ':' + ins.bottom + ':' + ins.left + ':' + ins.right;
    if (!force && key === L.insetsKey && L.ok) return;
    L.insetsKey = key;
    var cols = D.cols, rows = D.rows, cw = D.cellW, chh = D.cellH;
    var gridBottom = D.originY + rows * chh;
    var topRows = Math.max(0, Math.ceil((ins.top - D.originY) / chh));
    var botRows = Math.max(0, Math.ceil((ins.bottom - (D.height - gridBottom)) / chh));
    // Sanity: an unstyled or oversized HUD must never squash the tank.
    if (topRows > rows * 0.25) topRows = Math.min(3, Math.floor(rows * 0.1));
    if (botRows > rows * 0.4) botRows = Math.min(D.width > D.height ? 5 : 7, Math.floor(rows * 0.2));
    var leftCols = Math.max(0, Math.ceil((ins.left - D.originX) / cw));
    var rightCols = Math.max(0, Math.ceil((ins.right - (D.width - (D.originX + cols * cw))) / cw));
    var landscape = D.width > D.height;
    var side = landscape ? Math.max(5, Math.round(cols * 0.04)) : 1;
    var avail0 = topRows + (topRows ? 1 : 0), avail1 = rows - botRows - 1; // inclusive
    var avail = avail1 - avail0 + 1;
    var visRows = avail >= 16 ? 3 : 0;
    var floorRow = avail >= 18 ? 1 : 0;
    var tankRows = Math.min(MAX_ROWS + 2, avail - visRows - floorRow);
    if (tankRows < MIN_ROWS + 2) { tankRows = Math.max(4, avail); visRows = 0; floorRow = 0; }
    var block = tankRows + visRows + floorRow;
    var top = avail0 + Math.max(0, Math.floor((avail - block) / 2));
    var W = Math.min(MAX_W, cols - 2 - 2 * side - leftCols - rightCols);
    if (W < MIN_W) W = Math.max(8, cols - 2);
    L.W = W;
    L.c0 = leftCols + Math.floor((cols - leftCols - rightCols - (W + 2)) / 2) + 1;
    L.rT = top;
    L.rB = top + tankRows - 1;
    L.rows = L.rB - L.rT - 1;                       // inner rows (surface row included)
    L.sandRows = L.rows >= 10 ? 2 : 1;
    L.sandTop = L.rB - L.sandRows;
    L.visRow = visRows ? L.rB + 1 : -1;
    L.floorRow = floorRow ? L.rB + 1 + visRows : -1;
    L.sandY = rowY(L.sandTop);
    L.floorY = L.sandY + 1;
    L.ok = L.rows >= 4;
    // camera: world (0,0) = inner left glass, top of the surface row
    R.cam.set(-L.c0, -(L.rT + 1) * ASPECT);
    env.bounds.x0 = 0; env.bounds.x1 = W; env.bounds.y0 = 0; env.bounds.y1 = L.floorY;
    env.surfaceY = 2;
    env.depth = L.floorY - env.surfaceY;
    buildCovers();
    clampCreatures();
    if (R.invalidate) R.invalidate();
  }

  // ---------------------------------------------------------------- decor geometry (5 slots along the sand)
  var slotX = [0, 0, 0, 0, 0];
  var coverPool = [];
  function slotCenter(i) { return L.W * (i + 0.5) / AQ.ENUM.TANK_SLOTS; }
  function buildCovers() {
    var tk = curTank();
    env.covers.length = 0;
    if (!tk) return;
    for (var i = 0; i < AQ.ENUM.TANK_SLOTS; i++) {
      slotX[i] = slotCenter(i);
      var id = tk.decor && tk.decor[i];
      if (!id) continue;
      var dd = AQ.items.DECOR[id], art = decorArt(id);
      if (!dd || !art || !dd.tags.length) continue;
      var f = art.frames[0], w = f[0].length, h = f.length;
      var cv = coverPool[i] || (coverPool[i] = { x0: 0, y0: 0, x1: 0, y1: 0, kind: '', tags: null });
      cv.x0 = slotX[i] - w / 2; cv.x1 = slotX[i] + w / 2;
      cv.y0 = L.sandY - h * ASPECT + 2; cv.y1 = L.sandY + 2;
      cv.kind = dd.tags[0]; cv.tags = dd.tags;
      env.covers.push(cv);
    }
  }

  // ---------------------------------------------------------------- creatures
  function clearCreatures() {
    list.length = 0;
    byUid = Object.create(null);
  }
  function placeFor(c) {
    var w = c.w || 4;
    c.x = U.clamp(1 + w / 2 + rng.next() * Math.max(1, L.W - w - 2), w / 2, L.W - w / 2);
    c.y = U.clamp(4 + rng.next() * Math.max(1, L.floorY - 8), env.surfaceY + 2, Math.max(env.surfaceY + 2, L.floorY - 2));
  }
  function sync() {
    if (!AQ.creatures || !AQ.creatures.create) return;
    var tk = curTank(), fish = S.aquarium.fish, seen = Object.create(null), i;
    if (!tk) { clearCreatures(); return; }
    for (i = 0; i < fish.length; i++) {
      var f = fish[i];
      if (f.tank !== tk.id) continue;
      seen[f.uid] = 1;
      var c = byUid[f.uid];
      var juv = typeof f.growth === 'number' && f.growth < 0.5;
      if (!c) {
        try {
          c = AQ.creatures.create(f.sp, { x: L.W / 2, y: L.floorY / 2, mode: 'tank', fish: f, specimen: f, juvenile: juv }, rng);
        } catch (e) { c = null; }
        if (!c) continue;
        placeFor(c);
        list.push(c);
        byUid[f.uid] = c;
      } else {
        c.specimen = f;
        if (c.data && c.data.juvenile !== juv && AQ.creatures.setJuvenile) AQ.creatures.setJuvenile(c, juv);
      }
    }
    for (i = list.length - 1; i >= 0; i--) {
      var cr = list[i];
      if (!seen[cr.fishUid]) {
        delete byUid[cr.fishUid];
        list.splice(i, 1);
      }
    }
  }
  function clampCreatures() {
    for (var i = 0; i < list.length; i++) {
      var c = list[i];
      c.x = U.clamp(c.x, c.w / 2, Math.max(c.w / 2, L.W - c.w / 2));
      c.y = U.clamp(c.y, env.surfaceY + 1, Math.max(env.surfaceY + 1, L.floorY - 1));
    }
  }
  function creatureOf(uid) { return byUid[uid] || null; }

  function onCreatureEvent(type, c, data) {
    if (type === 'eat') {
      var id = data && data.id;
      for (var i = 0; i < env.food.length; i++) {
        if (env.food[i].id === id) { env.food[i].alive = false; env.food.splice(i, 1); break; }
      }
      if (rng.next() < 0.45) emote(c, '<3', 12, 1.6);
    }
  }

  // ---------------------------------------------------------------- food
  function spawnFood(n) {
    var m = motion();
    for (var k = 0; k < n; k++) {
      var p = null;
      for (var j = 0; j < FOOD_MAX; j++) if (!foodPool[j].alive) { p = foodPool[j]; break; }
      if (!p) break;
      p.alive = true; p.id = ++foodSeq;
      p.x = L.W * (0.15 + 0.7 * rng.next());
      p.y = 1 + rng.next() * 1.2;
      p.vy = (1.4 + rng.next() * 1.4) * (m < 1 ? 0.8 : 1);
      p.wob = rng.next() * TAU; p.t = -k * 0.08; p.settled = 0;
      var r3 = rng.next();
      p.ch = r3 < 0.55 ? C().dot : r3 < 0.85 ? C().deg : C().comma;
      env.food.push(p);
    }
  }
  function updateFood(dt) {
    var m = motion();
    for (var i = env.food.length - 1; i >= 0; i--) {
      var p = env.food[i];
      p.t += dt;
      if (p.t < 0) continue;
      if (p.y < L.floorY - 0.6) {
        p.y += p.vy * dt;
        p.x += Math.sin(p.t * 2.2 + p.wob) * 0.6 * dt * m;
      } else {
        p.settled += dt;
        if (p.settled > 12) { p.alive = false; env.food.splice(i, 1); }
      }
    }
  }
  function drawFood() {
    for (var i = 0; i < env.food.length; i++) {
      var p = env.food[i];
      if (p.t < 0) continue;
      var lvl = p.settled > 9 ? Math.max(2, Math.round(10 * (12 - p.settled) / 3)) : 10;
      R.glyphW(p.ch, p.x, p.y, lvl);
    }
  }

  // ---------------------------------------------------------------- emotes
  function emote(c, text, level, life) {
    if (!c) return;
    for (var i = 0; i < EMOTE_MAX; i++) if (emotes[i].alive && emotes[i].uid === c.uid) return;
    for (var j = 0; j < EMOTE_MAX; j++) {
      var e = emotes[j];
      if (e.alive) continue;
      e.alive = true; e.text = text; e.uid = c.uid; e.c = c; e.t = 0; e.life = life || 2; e.level = level || 10;
      return;
    }
  }
  function updateEmotes(dt) {
    for (var i = 0; i < EMOTE_MAX; i++) {
      var e = emotes[i];
      if (!e.alive) continue;
      e.t += dt;
      if (e.t >= e.life || list.indexOf(e.c) < 0) { e.alive = false; e.c = null; }
    }
    emoteT -= dt;
    if (emoteT > 0 || !list.length) return;
    emoteT = 3.5 + rng.next() * 4;
    var tk = curTank();
    if (!tk) return;
    var c = list[rng.int(list.length)], f = c.specimen;
    if (!f) return;
    if (tk.food < 0.3) { emote(c, '?', 10, 2.2); return; }
    var h = AQ.aquarium.fishHappiness(f, tk, S).value;
    if (h < 40) emote(c, '...', 8, 2.4);
  }
  function drawEmotes() {
    var m = motion();
    for (var i = 0; i < EMOTE_MAX; i++) {
      var e = emotes[i];
      if (!e.alive || !e.c) continue;
      var a = e.t / e.life;
      var lvl = Math.max(1, Math.round(e.level * (a < 0.15 ? a / 0.15 : a > 0.75 ? (1 - a) / 0.25 : 1)));
      var rise = m < 1 ? 0 : a * 1.2;
      R.textW(e.text, e.c.x, e.c.y - e.c.h * ASPECT / 2 - 1 - rise, lvl, { align: 'center' });
    }
  }

  // ---------------------------------------------------------------- visitors (walk along the bottom edge)
  function visitorCount() {
    if (L.visRow < 0) return 0;
    var n = AQ.aquarium.visitors ? AQ.aquarium.visitors(S) : Math.min(8, Math.floor(AQ.aquarium.attraction(S) / 40));
    return Math.min(n, VIS_MAX, Math.floor(D.cols / 9));
  }
  function spawnVisitor(v, fromEdge) {
    var minX = -L.c0 - 3, maxX = D.cols - L.c0 + 3;
    v.alive = true; v.leaving = false;
    v.kind = rng.int(4);
    v.dir = rng.next() < 0.5 ? -1 : 1;
    v.x = fromEdge ? (v.dir > 0 ? minX : maxX) : minX + rng.next() * (maxX - minX);
    v.vx = (2 + rng.next() * 1.6) * v.dir;
    v.fAcc = rng.next() * 2; v.state = 'walk'; v.stopT = 0; v.nextStop = 2 + rng.next() * 8; v.mark = 0;
  }
  function updateVisitors(dt, initial) {
    if (L.visRow < 0) { for (var q = 0; q < VIS_MAX; q++) visitors[q].alive = false; return; }
    visT -= dt;
    if (visT <= 0) { visT = 2; visTarget = visitorCount(); }
    var alive = 0, i;
    for (i = 0; i < VIS_MAX; i++) if (visitors[i].alive && !visitors[i].leaving) alive++;
    if (alive < visTarget) {
      for (i = 0; i < VIS_MAX && alive < visTarget; i++) if (!visitors[i].alive) { spawnVisitor(visitors[i], !initial); alive++; if (!initial) break; }
    } else if (alive > visTarget) {
      for (i = 0; i < VIS_MAX && alive > visTarget; i++) if (visitors[i].alive && !visitors[i].leaving) { visitors[i].leaving = true; alive--; }
    }
    var minX = -L.c0 - 4, maxX = D.cols - L.c0 + 4, m = motion();
    for (i = 0; i < VIS_MAX; i++) {
      var v = visitors[i];
      if (!v.alive) continue;
      if (v.state === 'look') {
        v.stopT -= dt;
        if (v.stopT <= 0) {
          v.state = 'walk';
          v.nextStop = 6 + rng.next() * 10;
          if (AQ.fx) AQ.fx.emit('coin', v.x, rowY(L.visRow) - 0.5, { n: 1, level: v.mark ? 12 : 9 });
          v.mark = 0;
        }
        continue;
      }
      v.x += v.vx * dt * (m < 1 ? 0.7 : 1);
      v.fAcc += Math.abs(v.vx) * dt * 0.9;
      v.nextStop -= dt;
      var inFront = v.x > 2 && v.x < L.W - 2;
      if (!v.leaving && inFront && v.nextStop <= 0 && !crowded(v)) {
        v.state = 'look'; v.stopT = 2.5 + rng.next() * 2; v.mark = rareNear(v.x) ? 1 : 0;
      }
      if (v.x < minX || v.x > maxX) {
        if (v.leaving) { v.alive = false; continue; }
        v.dir = -v.dir; v.vx = -v.vx;
        if (rng.next() < 0.3) v.kind = rng.int(4);
      }
    }
  }
  function crowded(v) {
    for (var i = 0; i < VIS_MAX; i++) {
      var o = visitors[i];
      if (o !== v && o.alive && Math.abs(o.x - v.x) < 6) return true;
    }
    return false;
  }
  function rareNear(x) {
    for (var i = 0; i < list.length; i++) {
      var c = list[i], sp = species(c.sp);
      if (Math.abs(c.x - x) > 10) continue;
      if ((sp && (sp.rarity === 'R' || sp.rarity === 'L')) || (c.specimen && c.specimen.dense)) return true;
    }
    return false;
  }
  var VO = { flip: false, level: 8, knock: false, deform: 'none' };
  function drawVisitors() {
    if (L.visRow < 0) return;
    for (var i = 0; i < VIS_MAX; i++) {
      var v = visitors[i];
      if (!v.alive) continue;
      var frames = visitorFrames(v.kind);
      var fr = v.state === 'look' ? frames[0] : frames[Math.floor(v.fAcc) % frames.length];
      var h = fr.length;
      var yTop = rowY(L.visRow + (3 - h));
      VO.flip = v.dir < 0;
      VO.level = v.state === 'look' ? 9 : 7;
      R.sprite(fr, v.x, yTop + h * ASPECT / 2, VO);
      if (v.state === 'look' && v.mark) R.glyphW(C().bang, v.x + 2, yTop + 1, 13);
    }
  }

  // ---------------------------------------------------------------- bg (bgHz): frame, water, surface, rays, sand
  function drawBg(grid, t) {
    if (!S) return;
    if (!L.ok) relayout(true);
    if (!L.ok) return;
    var tk = curTank();
    var light = (tk && tk.light) || 'day';
    var cA = C();
    var c0 = L.c0, c1 = L.c0 + L.W - 1, rT = L.rT, rB = L.rB;
    var frameLv = 7, motionK = motion();
    var tt = t * (motionK < 1 ? 0.35 : 1);
    // frame
    grid.putCode(c0 - 1, rT, cA.plus, frameLv); grid.putCode(c1 + 1, rT, cA.plus, frameLv);
    grid.putCode(c0 - 1, rB, cA.plus, frameLv); grid.putCode(c1 + 1, rB, cA.plus, frameLv);
    for (var c = c0; c <= c1; c++) { grid.putCode(c, rT, cA.dash, frameLv - 1); grid.putCode(c, rB, cA.dash, frameLv); }
    for (var r = rT + 1; r < rB; r++) { grid.putCode(c0 - 1, r, cA.pipe, frameLv); grid.putCode(c1 + 1, r, cA.pipe, frameLv); }
    // floor line under the visitors
    if (L.floorRow >= 0) for (c = 0; c < D.cols; c++) if ((c * 7 + 3) % 5) grid.putCode(c, L.floorRow, cA.under, 2);

    var waterBase = light === 'day' ? 2.6 : light === 'dim' ? 2 : 1;
    var rays = light === 'day' && R.decorTextures !== false && (!AQ.perf || AQ.perf.params.rays !== false);
    var caustics = light === 'day' && R.decorTextures !== false && (!AQ.perf || AQ.perf.params.caustics !== false);
    var surfLv = light === 'day' ? 4 : light === 'dim' ? 3 : 2;
    var sandRamp = R.RAMPS.sand;
    var innerRows = L.sandTop - (rT + 2);
    // surface row
    var rs = rT + 1;
    for (c = c0; c <= c1; c++) {
      var x = c - c0;
      var v = 0.6 * Math.sin(0.27 * x - 0.8 * tt) + 0.4 * Math.sin(0.63 * x + 1.1 * tt + 1.7);
      grid.put(c, rs, v < -0.45 ? '.' : v < 0.2 ? '-' : '~', v > 0.75 ? surfLv + 1 : surfLv);
    }
    // water
    for (r = rT + 2; r < L.sandTop; r++) {
      var depthF = innerRows > 0 ? (r - rT - 2) / innerRows : 0;
      for (c = c0; c <= c1; c++) {
        var xx = c - c0;
        var n = U.noise3(xx * 0.13, r * 0.34, tt * 0.12);
        var lv = 0, ch = 0;
        if (n > 0.7) {
          var k = (n - 0.7) / 0.3;
          ch = k > 0.6 ? '-' : '.';
          lv = Math.max(1, Math.round(waterBase * (0.5 + 0.4 * k) * (1 - 0.35 * depthF)));
        }
        if (rays && depthF < 0.8) {
          var band = Math.sin((xx - (r - rT) * 1.25) * 0.21 + tt * 0.18);
          if (band > 0.9) {
            var rl = Math.max(1, Math.round(3 * (1 - depthF) * (band - 0.9) * 10));
            if (rl > lv) { lv = Math.min(3, rl); ch = (r + xx) % 3 ? '.' : '·'; }
          }
        }
        if (lv > 0 && ch) grid.put(c, r, ch, Math.min(lv, 5));
      }
    }
    // sand
    for (r = L.sandTop; r < rB; r++) {
      var top = r === L.sandTop;
      for (c = c0; c <= c1; c++) {
        var xs = c - c0;
        var s = U.noise2(xs * 0.41 + 7.3, r * 1.37);
        var idx = top ? 1 + Math.floor(s * 3) : 2 + Math.floor(s * 3);
        idx = U.clamp(idx, 1, sandRamp.length - 1);
        var sl = light === 'night' ? 2 : top ? 4 : 3;
        var schar = sandRamp.charAt(idx);
        if (caustics && top) {
          var cz = U.noise3(xs * 0.23, 3.1, tt * 0.5);
          if (cz > 0.7) { schar = ':'; sl = 5; }
        }
        grid.put(c, r, schar, sl);
      }
    }
  }

  // ---------------------------------------------------------------- main draw
  var DO = { flip: false, level: 8, deform: 'none', amp: 1, t: 0, knock: true, seed: 0 };
  function drawDecor(t) {
    var tk = curTank();
    if (!tk) return;
    var light = tk.light || 'day', m = motion();
    var lvl = light === 'night' ? 6 : light === 'dim' ? 7 : 9;
    for (var i = 0; i < AQ.ENUM.TANK_SLOTS; i++) {
      var id = tk.decor && tk.decor[i];
      if (!id) continue;
      var art = decorArt(id);
      if (!art) continue;
      var fr = art.frames.length > 1 && art.fps ? art.frames[Math.floor(t * art.fps) % art.frames.length] : art.frames[0];
      var h = fr.length;
      DO.level = lvl; DO.deform = art.deform; DO.amp = art.amp * m; DO.t = t + i * 1.7; DO.seed = i + 1;
      R.sprite(fr, slotX[i], L.sandY - h + 2, DO);
      if (id === 'farol') {
        var on = Math.sin(t * 2.4) > 0;
        R.glyphW(on ? C().star : C().period, slotX[i], L.sandY - h * ASPECT + 3, on ? 13 : 6);
      } else if (id === 'ostra' && (Math.floor(t * 0.7 + i) % 5) === 0) {
        R.glyphW(C().star, slotX[i] - 0.2, L.sandY + 1, 12);
      }
    }
  }
  var LO = { flip: false, level: 10, knock: true, deform: 'none' };
  function drawFixtures(t) {
    var light = lightOf();
    // lamp
    var lamp = artLines('lamp', LAMP_ART);
    LO.level = light === 'day' ? 12 : light === 'dim' ? 8 : 4;
    var lx = Math.max(3, Math.round(L.W * 0.16));
    R.sprite(lamp, lx, lamp.length * ASPECT / 2, LO);
    // filter (top right) + air line + airstone
    var flt = artLines('filter', FILTER_ART);
    var fx0 = L.W - 3;
    LO.level = light === 'night' ? 5 : 8;
    R.sprite(flt, fx0, flt.length * ASPECT / 2, LO);
    var lineLv = light === 'night' ? 2 : 3;
    for (var y = flt.length * ASPECT + 1; y < L.floorY - 1; y += ASPECT) R.glyphW(C().pipe, fx0, y, lineLv);
    R.glyphW(C().o, fx0, L.floorY - 1, light === 'night' ? 3 : 6);
  }
  function drawHints() {
    var tk = curTank();
    if (!tk) return;
    var cx = L.W / 2, cy = L.floorY / 2;
    if (!list.length) {
      R.textW(AQ.i18n.t('aq.empty'), cx, cy - 1, 9, { align: 'center' });
      R.textW(AQ.i18n.t('aq.emptyHint'), cx, cy + 1.5, 6, { align: 'center' });
      return;
    }
    if (hintT > 0 && !cardsOpened) {
      var lvl = Math.max(1, Math.round(8 * Math.min(1, hintT / 1.5)));
      R.text(' ' + AQ.i18n.t('aq.tapHint') + ' ', L.c0 + Math.floor(L.W / 2), L.rB, lvl, { align: 'center', knock: 0.96 });
    }
  }

  function draw(t) {
    if (!S || !L.ok) return;
    drawFixtures(t);
    drawDecor(t);
    if (AQ.creatures && AQ.creatures.drawList) {
      try { AQ.creatures.drawList(list, env); } catch (e) { if (!draw._err) { draw._err = 1; console.error(e); } }
    }
    drawFood();
    drawEmotes();
    drawVisitors();
    if (AQ.fx) AQ.fx.draw();
    if (!contemplating) drawHints();
  }

  // ---------------------------------------------------------------- update
  function update(dt) {
    if (!S) return;
    time += dt;
    insetT -= dt;
    if (insetT <= 0) { insetT = 0.5; relayout(false); }
    if (!L.ok) return;
    var tk = curTank();
    env.t = time;
    env.light = (tk && tk.light) || 'day';
    env.level = env.light === 'night' ? 9 : env.light === 'dim' ? 11 : 12;
    try { env.phase = AQ.world.now(S).phase || 'dia'; } catch (e) { env.phase = 'dia'; }
    if (AQ.creatures && AQ.creatures.update && list.length) {
      try { AQ.creatures.update(list, dt, env); } catch (e) { if (!update._err) { update._err = 1; console.error(e); } }
    }
    updateFood(dt);
    updateEmotes(dt);
    updateVisitors(dt, false);
    if (hintT > 0) hintT -= dt;
    // filter bubbles
    var bub = (AQ.perf && AQ.perf.params && AQ.perf.params.bubbles) || 1;
    bubbleT -= dt;
    if (bubbleT <= 0 && AQ.fx) {
      bubbleT = (0.28 + rng.next() * 0.3) / Math.max(0.25, bub);
      AQ.fx.emit('bubble', L.W - 3, L.floorY - 1.5, { n: 1, surfaceY: 2.2, life: (L.floorY - 2) / 5.2, level: env.light === 'night' ? 5 : 8 });
    }
    // treasure chest bursts
    if (tk && tk.decor && tk.decor.indexOf('bau') >= 0) {
      chestT -= dt;
      if (chestT <= 0 && AQ.fx) {
        chestT = 2.5 + rng.next() * 3;
        var si = tk.decor.indexOf('bau');
        AQ.fx.emit('bubble', slotX[si], L.sandY - 1, { n: 3, surfaceY: 2.2, life: (L.floorY - 2) / 5, level: 8 });
      }
    }
  }

  // ---------------------------------------------------------------- input
  var tmpW = { x: 0, y: 0 };
  function onTap(p) {
    if (AQ.scenes.current !== 'aquarium' || !L.ok) return;
    if (contemplating || (contOffAt >= 0 && time - contOffAt < 0.3)) return;
    if (AQ.ui && AQ.ui.isModal && AQ.ui.isModal()) return;
    R.screenToWorld(p.x, p.y, tmpW);
    var best = null, bd = Infinity;
    for (var i = 0; i < list.length; i++) {
      var c = list[i];
      var dx = Math.max(0, Math.abs(tmpW.x - c.x) - c.w / 2) * D.cellW;
      var dy = Math.max(0, Math.abs(tmpW.y - c.y) - c.h * ASPECT / 2) / ASPECT * D.cellH;
      var dd = Math.sqrt(dx * dx + dy * dy);
      if (dd < bd) { bd = dd; best = c; }
    }
    var tol = Math.max(16, D.cellH * 1.2);
    if (best && bd <= tol && best.fishUid) {
      cardsOpened++;
      if (AQ.ui && AQ.ui.fishCard) AQ.ui.fishCard(best.fishUid);
      return;
    }
    // tapping the glass startles nearby fish
    if (tmpW.x >= 0 && tmpW.x <= L.W && tmpW.y >= 0 && tmpW.y <= L.floorY + 2) {
      if (AQ.fx) AQ.fx.emit('bubble', tmpW.x, Math.min(tmpW.y, L.floorY - 1), { n: 2, surfaceY: 2.2, life: 1.2, level: 7 });
      for (var j = 0; j < list.length; j++) {
        var cc = list[j];
        if (Math.abs(cc.x - tmpW.x) < 8 && Math.abs(cc.y - tmpW.y) < 8 && AQ.creatures.spook) AQ.creatures.spook(cc, 0.6);
      }
    }
  }
  function onSwipe(p) {
    if (AQ.scenes.current !== 'aquarium' || contemplating) return;
    if (p.dir === 'left') next();
    else if (p.dir === 'right') prev();
  }

  // ---------------------------------------------------------------- tank switching
  function setTank(id) {
    var t = tanks();
    for (var i = 0; i < t.length; i++) {
      if (t[i].id !== id) continue;
      if (i === tankIdx && id === tankId && list.length) return true;
      tankIdx = i; tankId = id;
      def.tankId = id; def.tank = t[i];
      AQ.aquariumView.tankId = id; AQ.aquariumView.index = i;
      clearCreatures();
      for (var k = 0; k < FOOD_MAX; k++) foodPool[k].alive = false;
      env.food.length = 0;
      for (var e = 0; e < EMOTE_MAX; e++) emotes[e].alive = false;
      buildCovers();
      sync();
      AQ.events.emit('aquarium:view', { tankId: id, index: i, total: t.length });
      return true;
    }
    return false;
  }
  function next() { var t = tanks(); if (t.length > 1) setTank(t[(tankIdx + 1) % t.length].id); }
  function prev() { var t = tanks(); if (t.length > 1) setTank(t[(tankIdx - 1 + t.length) % t.length].id); }

  // ---------------------------------------------------------------- bus
  function listen() {
    var ev = AQ.events;
    offs.push(ev.on('aquarium:changed', function (p) {
      curTank();
      if (!p || !p.tankId || p.tankId === tankId) { buildCovers(); sync(); }
    }));
    offs.push(ev.on('aquarium:fed', function (p) {
      if (p && p.tankId === tankId) spawnFood(Math.min(FOOD_MAX, 8 + Math.min(10, list.length * 2)));
    }));
    offs.push(ev.on('aquarium:collected', function (p) {
      if (!AQ.fx || !L.ok) return;
      var amount = (p && p.amount) || 0;
      var n = U.clamp(Math.round(amount / 12), 6, 28), bursts = Math.min(5, 1 + Math.floor(n / 6));
      for (var b = 0; b < bursts; b++) {
        AQ.fx.emit('coin', L.W * (0.2 + 0.6 * (bursts > 1 ? b / (bursts - 1) : 0.5)), L.floorY - 1, { n: Math.ceil(n / bursts), power: 1.1 });
      }
      for (var i = 0; i < list.length; i++) if (rng.next() < 0.3) emote(list[i], '$', 12, 1.2);
    }));
    offs.push(ev.on('aquarium:bred', function (p) {
      if (!p || p.tankId !== tankId) return;
      sync();
      var c = creatureOf(p.uid);
      if (c) {
        for (var i = 0; i < list.length; i++) {
          if (list[i] !== c && list[i].sp === c.sp) { c.x = list[i].x; c.y = list[i].y; emote(list[i], '<3', 13, 2.5); break; }
        }
        if (AQ.fx) AQ.fx.emit('bloom', c.x, c.y, { n: 10, power: 0.5, level: 9 });
      }
    }));
    offs.push(ev.on('aquarium:predation', function (p) { if (p && p.tankId === tankId) sync(); }));
    offs.push(ev.on('stars:changed', function () {
      if (!AQ.fx || !L.ok) return;
      for (var k = 0; k < 3; k++) AQ.fx.emit('bloom', L.W * (0.25 + 0.25 * k), L.floorY * 0.35, { n: 12, power: 0.8, level: 12 });
    }));
    offs.push(ev.on('ui:contemplate', function (p) {
      contemplating = !!(p && p.on);
      if (!contemplating) contOffAt = time;
      insetT = 0.05;
    }));
    offs.push(ev.on('scene:changed', function (p) { if (p && p.to === 'aquarium') { insetT = 0.05; relayout(true); } }));
    offs.push(ev.on('lang:changed', function () { /* labels are read every frame */ }));
    offs.push(ev.on('theme:changed', function () { codes = null; }));
    if (AQ.input && AQ.input.on) {
      offs.push(AQ.input.on('tap', onTap));
      offs.push(AQ.input.on('swipe', onSwipe));
    }
  }
  function unlisten() { offs.forEach(function (off) { try { off(); } catch (e) { /* ignore */ } }); offs = []; }

  // ---------------------------------------------------------------- scene hooks
  function enter(params) {
    S = AQ.state;
    rng = AQ.rng.create('aqscene:' + ((S.meta && S.meta.seed) || 1) + ':' + Math.floor(U.now() / 1000));
    env.rng = rng;
    codes = null;
    time = 0; insetT = 0.3; visT = 0; emoteT = 3; bubbleT = 0.2; hintT = 7;
    contemplating = false; contOffAt = -1;
    var t = tanks();
    if (params && params.tankId) tankId = params.tankId;
    var found = false;
    for (var i = 0; i < t.length; i++) if (t[i].id === tankId) { tankIdx = i; found = true; }
    if (!found) { tankIdx = 0; tankId = t[0] ? t[0].id : 't1'; }
    def.tankId = tankId; def.tank = t[tankIdx] || null;
    AQ.aquariumView.tankId = tankId; AQ.aquariumView.index = tankIdx;
    for (var k = 0; k < FOOD_MAX; k++) foodPool[k].alive = false;
    env.food.length = 0;
    for (var e = 0; e < EMOTE_MAX; e++) emotes[e].alive = false;
    for (var v = 0; v < VIS_MAX; v++) visitors[v].alive = false;
    clearCreatures();
    L.insetsKey = '';
    relayout(true);
    sync();
    visTarget = visitorCount();
    updateVisitors(0, true);
    unlisten();
    listen();
  }
  function exit() {
    unlisten();
    clearCreatures();
    env.food.length = 0;
  }
  function resize() { relayout(true); }

  AQ.aquariumView = { tankId: 't1', index: 0 };

  var def = {
    tankId: 't1',
    tank: null,
    enter: enter,
    exit: exit,
    update: update,
    drawBg: drawBg,
    draw: draw,
    resize: resize,
    setTank: setTank,
    next: next,
    prev: prev,
    // debug / tests
    _layout: L,
    _creatures: list,
    feedFx: function () { spawnFood(14); }
  };
  AQ.scenes.register('aquarium', def);
})(window.AQ);
