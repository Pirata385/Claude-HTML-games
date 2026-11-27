// Água-Tinta — the fishing scene (owner C). §4 (aim, cast, fly, sink, wait, nibble, bite, fight, land), §5.4
// (darkness, lantern), §4.11 (frenzy, bottles, sightings, legendary presence), §12 (game feel), §15.7 (composition).
// Every save-state mutation goes through AQ.game (D); cards, hints and toasts through AQ.ui (E).
(function (AQ) {
  'use strict';

  var U = AQ.util, ASPECT = AQ.ASPECT;
  var F = AQ.fishing = AQ.fishing || {};
  var BG = F.bg, HUD = F.hud;
  var DT = 1 / 60;

  var BAIT_GLYPH = { massa: 'o', minhoca: '~', camarao: ',', lula: '=', luminosa: '*', colher: '<>', jig: '>=', papel: '#', perola: '@' };
  var BOAT_ART = ['______________', '\\____________/'];
  var ANGLER_ART = {
    idle: [' o ', '/|\\', '/ \\'],
    windup: [' o_', '/| ', '/ \\'],
    cast: ['_o ', ' |\\', '/ \\'],
    reel: [[' o ', '/|>', '/ \\'], [' o ', '/|=', '/ \\'], [' o/', '/| ', '/ \\']],
    cheer: ['\\o/', ' | ', '/ \\']
  };
  var BIRD = ['v', '^v^'];

  // ---------------------------------------------------------------- scene state
  var st = {
    zone: null, zoneId: 'baia', depth: 70, cols: 80, t: 0, rng: null, fx: null,
    phase: 'idle', phaseT: 0,
    boat: { x: 0, y: 0 }, tip: { x: 3, y: -6 }, dir: 1,
    // sailing: the boat moves along an endless, world-deterministic coast (AQ.sail kinematics, world x)
    sail: null, sailBtn: { l: false, r: false }, sailKeyPrev: 0, sailLatch: false, sailQueue: 0, fastRetrieve: false,
    wake: [], wakeT: 0, rippleT: 0, waitT: 0,
    hook: { x: 27, y: -5, bait: 'massa', moving: false, active: false, engagedUid: 0 },
    hookV: 0, sinkT: 0, lineShortShown: false,
    rope: null, cells: [], ropeLen: 0,
    traj: { points: [] }, flyT: 0, power: 0,
    aim: { on: false, sx: 0, sy: 0, x: 0, y: 0, key: false, power: 0 },
    press: { on: false, at: 0, x: 0, y: 0, moved: false, type: 'mouse', lastX: 0 },
    list: [], spawnT: 0, stubCreatures: false,
    engaged: null, bs: null, nibbleT: 0, twitchT: 0,
    fs: null, fish: null, fightAcc: { t: 0 }, fightT0: 0, specimen: null, species: null, tellVis: { kind: null, t: 0 },
    rod: 0, rodKey: 0, autoRod: 0, reel: false, inkOn: false,
    landing: null, escape: null, cardOpen: false,
    cam: { x: 0, vx: 0, dirS: 1, y: 0, vy: 0 }, skyRows: 4,
    frenzy: { on: false, t: 0, next: 0, x: 0 },
    bottle: { on: false, x: 0, vx: 0, next: 0, coinT: -1e9, held: false, snagged: false },
    sights: [], sightNext: 0,
    legend: { state: 'none', id: null, at: 0, x: 0, y: 0, dir: 1, returnAt: 0, sil: null, checkT: 0 },
    seen: {}, tipsShown: {}, darkTipShown: false,
    script: null, scripted: false, tutorial: false,
    audioT: 0, debugAuto: false, debugResolve: null, debugFast: 1,
    gear: null
  };

  var inpOut = { reel: false, rod: 0 }, fightInp = { reel: false, rod: 0 };
  var tmpP = { x: 0, y: 0 }, tmpQ = { x: 0, y: 0 };

  function S() { return AQ.state; }
  function gear() {
    var g = null;
    try { g = AQ.economy.gear(S()); } catch (e) { g = null; }
    if (!g || !(g.Ls > 0)) g = { cast: 26, window: 0, St: 0.55, Ls: 1, maxLen: 90, snapGrace: 0.25, reelSpeed: 7, riseRate: 7, hookClass: 1, H: 0, lantern: 6 };
    if (!(g.lantern > 0)) g.lantern = 6;
    return g;
  }
  function setting(k) { try { return AQ.settings.get(k); } catch (e) { return undefined; } }
  function safe(fn, fb) { try { var v = fn(); return v === undefined ? fb : v; } catch (e) { return fb; } }
  function emit(n, p) { AQ.events.emit(n, p); }
  function worldNow() { return safe(function () { return AQ.world.now(S()); }, { minutes: 720, phase: 'dia', weather: 'limpo' }); }
  function bait() { return (S() && S().player && S().player.bait) || 'massa'; }
  function isLure(b) { return b === 'colher' || b === 'jig'; }
  function spDef(id) { return safe(function () { return AQ.species.get(id); }, null); }
  function toast(key, vars, kind, later) { safe(function () { AQ.ui.toast({ key: key, vars: vars }, { kind: kind || 'info', now: !later }); }); }

  // Reel sound while the lure is reeled in during 'waiting' (the fight drives its own reel sound each frame).
  // Remember whether it is on, so letting go, going back to idle or any phase change turns it off.
  function reelSound(on, v) {
    if (on) { st.reelSnd = true; safe(function () { AQ.audio.reel(true, v); }); }
    else if (st.reelSnd) { st.reelSnd = false; safe(function () { AQ.audio.reel(false, 0); }); }
  }
  function setPhase(p) {
    if (st.phase === p) return;
    if (p !== 'fight') reelSound(false);
    st.phase = p; st.phaseT = 0;
    F.phase = p;
  }

  // ---------------------------------------------------------------- geometry
  // The view is one screen wide; the camera follows the boat horizontally (world x is endless).
  function layoutBoat() {
    var D = AQ.display;
    st.cols = Math.max(20, D.cols || 80);
    var lay = HUD.layout(true);
    st.skyRows = Math.max(5, Math.min(12, (lay.insetT || 0) + (D.orientation === 'portrait' ? 8 : 7)));
  }
  function viewX0() { return st.cam.x; }
  function viewX1() { return st.cam.x + st.cols; }
  // where the boat sits on screen (fraction of the width) when it faces dir: landscape keeps room ahead of the bow
  function anchorFrac(dir) { return AQ.display.orientation === 'portrait' ? 0.5 - 0.08 * dir : 0.5 - 0.2 * dir; }
  // the camera x it settles at for the boat facing dir (cast clamps use it so the landing ends up on screen)
  function camTargetFor(dir) { return st.boat.x - anchorFrac(dir) * st.cols; }
  function floorY(x) { return BG.floorY(x); }
  function surfY(x) { return AQ.fx.surface.height(x); }
  // ---- boat + angler geometry (B's art: AQ.art.boats[tier] and AQ.art.angler poses with `tip`)
  var geo = { boat: null, bh: 2, bw: 14, deck: 0, by: 0, pose: null, poseKey: 'idle', ax: 0, ay: 0, art: false };
  function boatArt() {
    var tier = (st.gear && st.gear.tiers && st.gear.tiers.boat) || safe(function () { return S().player.gear.boat; }, 1) || 1;
    var a = AQ.art && ((AQ.art.boats && AQ.art.boats[tier]) || AQ.art.boat);
    return a && a.frames ? a : null;
  }
  function deckRow(fr) {
    for (var r = 0; r < fr.length; r++) if (String(fr[r]).indexOf('._') >= 0) return r;
    return 0;
  }
  function anglerPose() {
    var an = AQ.art && AQ.art.angler;
    var fsT = st.fs ? st.fs.T : 0, key = 'idle', idx = -1, src;
    if (st.phase === 'landing') key = 'cheer';
    else if (st.phase === 'aiming') key = 'windup';
    else if (st.phase === 'flying' && st.flyT < 0.3) key = 'cast';
    else if (st.phase === 'fight') key = 'reel';
    src = (an && an[key]) || ANGLER_ART[key];
    if (key === 'reel') { idx = Math.min(src.length - 1, Math.floor(U.clamp(fsT, 0, 1.2) * src.length / 1.1)); src = src[idx]; }
    if (src && src.frames) src = src.frames[0];
    geo.pose = src; geo.poseKey = key;
    geo.art = !!(an && an.tip && an[key]);
    var tip = null;
    if (geo.art) { tip = an.tip[key]; if (idx >= 0 && tip) tip = tip[idx]; }
    return tip;
  }
  // computes geo (boat box, angler box) and st.tip; called every update and before drawing
  function placeBoat(t) {
    var a = boatArt();
    var bfr = a ? a.frames[Math.floor((t || 0) * (a.fps || 1)) % a.frames.length] : BOAT_ART;
    var lines = bfr.lines || bfr;
    geo.boat = bfr; geo.bh = lines.length; geo.deck = deckRow(lines);
    var dl = String(lines[geo.deck] || ''); geo.bw = dl.replace(/\s+$/, '').length || 14;
    var sf = st.sail ? AQ.sail.speedFrac(st.sail) : 0;
    var bob = AQ.fx.motion() < 1 ? 0 : Math.sin((t || 0) * 1.4) * 0.3 + Math.sin((t || 0) * (3 + 3 * sf)) * 0.22 * sf;
    geo.by = st.boat.y + bob - geo.bh * ASPECT / 2 + 1;
    var tip = anglerPose();
    var ah = geo.pose.length, aw = 9;
    var deckTop = geo.by - geo.bh * ASPECT / 2 + geo.deck * ASPECT;
    // stand toward the bow (the side we cast to) so cabins and sails stay clear
    var off = geo.art ? Math.max(1, geo.bw / 2 - 3.5) : 1;
    geo.ax = st.boat.x + st.dir * off;
    geo.ay = deckTop - ah * ASPECT / 2 + 0.5;
    if (geo.art) {
      if (!tip) tip = geo.lastTip || AQ.art.angler.tip.idle;
      geo.lastTip = tip;
      var c = tip[0], r = tip[1];
      var cx = st.dir < 0 ? (aw - 1 - c) : c;
      st.tip.x = geo.ax - aw / 2 + cx + 0.5;
      st.tip.y = geo.ay - ah * ASPECT / 2 + (r + 0.5) * ASPECT;
    } else {
      var T = st.fs ? st.fs.T : 0;
      var bend = st.phase === 'fight' ? U.clamp(T, 0, 1.2) : 0;
      var aimLift = st.phase === 'aiming' ? -1 : 0;
      st.tip.x = st.boat.x + st.dir * (4 - bend * 1.2);
      st.tip.y = st.boat.y - 7 + bend * 2.2 + aimLift;
    }
  }
  function rodHand() {
    tmpQ.x = geo.art ? geo.ax - st.dir * 0.5 : st.boat.x + st.dir * 1;
    tmpQ.y = geo.art ? geo.ay + 1 : st.boat.y - 4;
    return tmpQ;
  }
  function updateTip() { placeBoat(st.t); }
  function viewH() { return AQ.display.rows * ASPECT; }

  // ---------------------------------------------------------------- environment for B's creatures
  var env = {
    mode: 'wild', t: 0, rng: null, bounds: { x0: -20, y0: 0, x1: 100, y1: 70 }, surfaceY: 0,
    floorY: floorY, covers: [], hook: null, food: [], visibility: null, phase: 'dia', frenzy: false, onEvent: null,
    zone: 'baia', dark: false, lantern: 6, luck: 0, depth: 70, isDark: null
  };
  function lightAt(df) { return safe(function () { return AQ.world.light(S(), st.zoneId, df); }, 1); }
  function darkAt(df) { return safe(function () { return AQ.world.isDark(S(), st.zoneId, df); }, false); }
  env.visibility = function (wx, wy, c) {
    var df = U.clamp(wy / st.depth, 0, 1);
    if (!darkAt(df)) return 1 - 0.55 * df;
    var lantern = st.gear ? st.gear.lantern : 6;
    var h = st.hook, d = h.active ? Math.sqrt((wx - h.x) * (wx - h.x) + (wy - h.y) * (wy - h.y)) : 1e9;
    var lf = U.smoothstep(lantern, lantern * 0.5, d);
    var sp = c && spDef(c.sp);
    return Math.max(lf, sp && sp.glow ? 0.6 : 0.17); // QA: .08 left dark fish at level 1 (invisible)
  };
  env.isDark = function (x, y) { return darkAt(U.clamp(y / st.depth, 0, 1)); };
  env.onEvent = function (type, c, data) {
    if (!c) return;
    if (type === 'splash') { // leapers / dolphins crossing the surface
      var sx = data && typeof data.x === 'number' ? data.x : c.x;
      AQ.fx.emit('splash', sx, surfY(sx), { power: 0.5, surfaceY: surfY(sx), n: 8 });
      return;
    }
    if (type === 'notice') {
      if (st.engaged || st.phase === 'fight' || st.phase === 'landing') return;
      engage(c);
    } else if (type === 'nibble') {
      if (st.engaged !== c) engage(c);
      if (st.engaged === c) onNibble(c);
    } else if (type === 'bite') {
      if (st.engaged !== c) engage(c);
      if (st.engaged === c) onBite(c);
    } else if (type === 'leave') {
      if (st.engaged === c) disengage(st.phase === 'bite' ? 'late' : null);
    }
  };

  function ctxSpawn() {
    var now = worldNow();
    var g = st.gear || gear();
    return { phase: now.phase, weather: now.weather, bait: bait(), luck: safe(function () { return AQ.game.luck(st.zoneId); }, 0),
      lantern: (S().player.gear && S().player.gear.lantern) || 0, frenzy: frenzyHere(), zone: st.zoneId, lanternR: g.lantern };
  }
  // the frenzy happens at a world x: it counts while the boat is in that stretch of water
  function frenzyHere() { return st.frenzy.on && Math.abs(st.boat.x - st.frenzy.x) < Math.max(30, st.cols * 0.9); }

  // ---------------------------------------------------------------- creatures: spawning, fallback behaviour
  function targetPop() {
    var mc = (AQ.perf.params && AQ.perf.params.maxCreatures) || 18;
    var pf = (st.zone && st.zone.popFactor) || 1;
    return Math.round(mc * pf * U.clamp(Math.sqrt(st.cols / 60), 0.8, 1.4));
  }
  function bandY(sp, rng) {
    var d0 = sp.depth ? sp.depth[0] : 0.2, d1 = sp.depth ? sp.depth[1] : 0.6;
    var y = st.depth * rng.range(d0, d1);
    return y;
  }
  function makeCreature(id, x, y, dir, opts) {
    var c = safe(function () { return AQ.creatures.create(id, { x: x, y: y, dir: dir, mode: 'wild', specimen: opts && opts.specimen }, st.rng); }, null);
    if (!c) return null;
    c.x = x; c.y = y;
    if (!c.data) c.data = {};
    if (opts && opts.legend) c.data.legend = true;
    st.list.push(c);
    return c;
  }
  function spawnGroup(id, onScreen, xAt, nForce) {
    var sp = spDef(id);
    if (!sp) return 0;
    var rng = st.rng;
    var n = nForce || safe(function () { return AQ.spawn.schoolSize(sp, rng); }, 1) || 1;
    if (!nForce && n > 1) n = Math.min(n, Math.max(3, Math.floor(st.cols / 9)));
    // off-screen spawns come in from a view edge, mostly the one ahead while sailing (despawns happen far behind)
    var v = st.sail ? st.sail.vx : 0, ahead = Math.abs(v) > 1.5 ? (v > 0 ? 1 : -1) : 0;
    var side = ahead && rng.next() < 0.8 ? ahead : (rng.next() < 0.5 ? 1 : -1);
    var dir = ahead && rng.next() < 0.35 ? side : -side;
    var lead = 8 + rng.next() * 6 + Math.abs(v) * 0.5;
    var x = xAt !== undefined ? xAt : onScreen ? viewX0() + rng.range(3, st.cols - 3) : (side < 0 ? viewX0() - lead : viewX1() + lead);
    var y = bandY(sp, rng);
    if (n > 1 && sp.behavior === 'school' && AQ.creatures.createSchool && !st.stubCreatures) {
      var yy0 = U.clamp(y, 1.5, floorY(x) - 1.5);
      var made = safe(function () { return AQ.creatures.createSchool(id, n, { x: x, y: yy0, dir: dir, mode: 'wild' }, rng); }, null);
      if (made && made.length) { for (var m2 = 0; m2 < made.length; m2++) { if (!made[m2].data) made[m2].data = {}; st.list.push(made[m2]); } return made.length; }
    }
    for (var i = 0; i < n; i++) {
      var yy = U.clamp(y + rng.range(-3, 3), 1.5, floorY(x) - 1.5);
      if (sp.behavior === 'crawl' || sp.behavior === 'burrow') yy = floorY(x) - 1;
      var mc = makeCreature(id, x + rng.range(-4, 4), yy, dir);
      if (mc && n > 1) mc.data.schoolKey = 'g' + st.t.toFixed(3) + id;
    }
    return n;
  }
  // Schools are big on narrow screens: at most ceil(cols / 45) + 1 schools at a time (re-picks otherwise).
  function schoolCount() {
    var seen = {}, n = 0;
    for (var i = 0; i < st.list.length; i++) {
      var c = st.list[i], d = c.data || {}, key = d.school && d.school.id ? 's' + d.school.id : (d.schoolKey || null);
      if (key && !seen[key]) { seen[key] = 1; n++; }
    }
    return n;
  }
  function spawnTick(dt, initial) {
    st.spawnT -= dt;
    if (!initial && st.spawnT > 0) return;
    st.spawnT = st.rng.range(1, 3) * (st.sail && Math.abs(st.sail.vx) > 2 ? 0.35 : 1);
    if (st.list.length >= targetPop()) return;
    var ctx = ctxSpawn(), id = null;
    for (var k = 0; k < 4 && !id; k++) {
      id = safe(function () { return AQ.spawn.pick(st.zoneId, ctx, st.rng); }, null);
      var sp = id && spDef(id);
      if (sp && sp.behavior === 'school' && schoolCount() >= Math.ceil(st.cols / 45) + 1) id = null;
    }
    // initial population is spread a little beyond the view so it does not all start on screen
    if (id) spawnGroup(id, false, initial ? viewX0() + st.rng.range(-0.3 * st.cols, 1.3 * st.cols) : undefined);
  }
  function despawnMargin() { return Math.max(30, st.cols * 0.5); }
  // Creatures patrol / hover / lurk inside env.bounds (B turns them at its edges and clamps hover homes into it).
  // At rest the bounds are the view ± 12. While sailing they stretch: ahead over the water being reached (spawns
  // there are at home), and they keep the water behind until it is out of reach — so the fish left behind stay
  // where they live (and despawn far behind) instead of being dragged along with the camera.
  function territory(dt) {
    var B = env.bounds, moving = st.sail && Math.abs(st.sail.vx) > 0.5, m = despawnMargin();
    st.restT = moving ? 0 : (st.restT || 0) + dt;
    if (st.restT > 0.8 || !(B.x1 > B.x0)) { B.x0 = viewX0() - 12; B.x1 = viewX1() + 12; return; }
    B.x0 = Math.max(Math.min(B.x0, viewX0() - 12), viewX0() - m - 24);
    B.x1 = Math.min(Math.max(B.x1, viewX1() + 36), viewX1() + m + 24);
    if (st.sail.vx > 0) B.x1 = viewX1() + 36; else if (st.sail.vx < 0) B.x0 = viewX0() - 36;
  }
  function despawn() {
    var m = despawnMargin(), x0 = viewX0() - m, x1 = viewX1() + m;
    for (var i = st.list.length - 1; i >= 0; i--) {
      var c = st.list[i];
      if (c === st.engaged || c.hooked) continue;
      if (c.x < x0 || c.x > x1 || c.y > st.depth + 10 || c._gone) {
        if (c.data && c.data.legend && st.legend.state === 'spawned') { st.legend.state = 'none'; st.legend.returnAt = st.t + 60; }
        st.list.splice(i, 1);
      }
    }
  }

  // Minimal stand-in used only while B's creatures.js is still a stub (empty update): swim in band, notice,
  // investigate, nibble n = int(wariness + 1) times, bite. Follows the §4.5 notice model.
  var SENSE = { school: 10, dart: 12, cruise: 14, lurk: 6, drift: 4, crawl: 6, burrow: 5, hover: 5, leap: 10, ambient: 0 };
  function fbUpdate(list, dt, e) {
    var h = e.hook;
    for (var i = 0; i < list.length; i++) {
      var c = list[i], d = c.data, sp = spDef(c.sp);
      if (!sp) continue;
      if (!d.fb) { d.fb = 1; d.spd = Math.max(1, sp.fight.speed * 0.25); d.mode = 'swim'; d.spook = 0; d.k = 0; c.dir = c.dir || 1; d.y0 = c.y; }
      c.t += dt; d.spook -= dt;
      if (d.mode === 'swim') {
        c.vx = c.dir * d.spd; c.vy = Math.sin(c.t * 0.7 + c.uid) * 0.4;
        if (h && h.active && d.spook <= 0 && !st.engaged && st.phase !== 'fight') {
          var aff = (sp.baits && sp.baits[h.bait]) || 0;
          var lure = isLure(h.bait);
          var rad = (SENSE[sp.behavior] || 6) * aff * (h.moving && lure ? 1.6 : 1) * (e.frenzy ? 2 : 1);
          var dx = h.x - c.x, dy = h.y - c.y;
          if (aff > 0 && dx * dx + dy * dy < rad * rad && st.rng.next() < Math.min(0.95, 0.6 * aff * (lure && !h.moving ? 0.2 : 1)) * dt) {
            d.mode = 'inv'; d.k = st.rng.range(0.5, 1.5); d.n = e.frenzy ? 0 : st.rng.int((sp.wariness || 0) + 1);
            e.onEvent('notice', c);
          }
        }
      } else if (d.mode === 'inv') {
        if (!h || !h.active || st.engaged !== c) { d.mode = 'swim'; continue; }
        var ax = h.x - c.dir * 2 - c.x, ay = h.y - c.y;
        c.vx = ax * 1.2; c.vy = ay * 1.2;
        if (Math.abs(ax) > 0.3) c.dir = ax > 0 ? 1 : -1;
        d.k -= dt;
        if (d.k <= 0) {
          if (d.n > 0) { d.n--; d.k = st.rng.range(0.6, 1.2); e.onEvent('nibble', c); }
          else { d.mode = 'bite'; e.onEvent('bite', c); }
        }
      } else if (d.mode === 'bite') {
        if (!h || st.engaged !== c) { d.mode = 'swim'; continue; }
        c.vx = (h.x - c.dir * 1.5 - c.x) * 4; c.vy = (h.y - c.y) * 4;
      } else if (d.mode === 'flee') {
        c.vx = c.dir * d.spd * 3; c.vy = 0;
        if (d.spook <= 0) d.mode = 'swim';
      }
      c.x += c.vx * dt; c.y += c.vy * dt;
      var fl = e.floorY(c.x) - 1;
      if (c.y > fl) c.y = fl;
      if (c.y < 1) c.y = 1;
      c.frame = Math.floor(c.t * 4) % 2;
    }
  }
  function fbSpook(c, sec) {
    if (!c || !c.data) return;
    c.data.mode = 'flee'; c.data.spook = sec; c.dir = c.x < st.hook.x ? -1 : 1;
  }
  function fbDraw(list, e) {
    var R = AQ.render;
    for (var i = 0; i < list.length; i++) {
      var c = list[i], sd = AQ.sprites.get(c.sp);
      var fr = sd.frames[(c.frame || 0) % sd.frames.length];
      var v = e.visibility(c.x, c.y, c);
      R.sprite(fr, c.x, c.y, { flip: c.dir < 0, level: Math.max(1, Math.round(12 * v)), deform: sd.deform, amp: (sd.amp || 1) * AQ.fx.motion(), t: c.t });
    }
  }
  function updCreatures(dt) {
    env.t = st.t; env.hook = st.hook.active ? st.hook : null; env.frenzy = frenzyHere();
    env.minNibbles = (st.script && st.script.nibbles) || 0;
    if (st.stubCreatures) fbUpdate(st.list, dt, env);
    else safe(function () { AQ.creatures.update(st.list, dt, env); });
  }
  function drawCreatures() {
    if (st.stubCreatures) fbDraw(st.list, env);
    else safe(function () { AQ.creatures.drawList(st.list, env); });
  }
  function spook(c, sec) {
    if (st.stubCreatures) fbSpook(c, sec);
    else safe(function () { AQ.creatures.spook(c, sec); });
  }

  // ---------------------------------------------------------------- engagement and bites
  function engage(c) {
    st.engaged = c;
    st.hook.engagedUid = c.uid;
    var sp = spDef(c.sp);
    var setts = { wideWindows: !!setting('wideWindows') };
    if (st.script && st.script.biteWindow) setts.biteWindow = st.script.biteWindow;
    st.bs = AQ.bite.create(sp || { id: c.sp, biteWindow: 0.75 }, st.gear, setts);
  }
  function disengage(missReason) {
    var c = st.engaged;
    if (missReason && c) emit('bite:miss', { sp: c.sp, reason: missReason });
    if (missReason === 'late' && Math.random() < 0.5) safe(function () { AQ.game.consumeBait(); });
    st.engaged = null; st.bs = null; st.hook.engagedUid = 0;
    if (st.phase === 'nibble' || st.phase === 'bite') setPhase('waiting');
  }
  function onNibble(c) {
    if (st.phase !== 'waiting' && st.phase !== 'sinking' && st.phase !== 'nibble') return;
    if (st.phase === 'sinking') stopHook('fish');
    AQ.bite.nibble(st.bs, st.t);
    setPhase('nibble');
    st.nibbleT = 0.15; st.twitchT = 0.25;
    emit('bite:nibble', { sp: c.sp });
  }
  function onBite(c) {
    if (st.phase !== 'waiting' && st.phase !== 'sinking' && st.phase !== 'nibble') return;
    if (st.phase === 'sinking') stopHook('fish');
    AQ.bite.open(st.bs, st.t);
    setPhase('bite');
    AQ.fx.shake(2, 0.15);
    emit('bite:strike', { sp: c.sp, window: st.bs.window });
  }
  function strike() {
    var c = st.engaged;
    if (!c || !st.bs) return;
    var r = AQ.bite.strike(st.bs, st.t);
    if (r === 'hooked') { startFight(c); return; }
    if (r === 'early') {
      spook(c, 8);
      for (var i = 0; i < st.list.length; i++) {
        var o = st.list[i];
        if (o !== c && o.sp === c.sp && Math.abs(o.x - c.x) < 10 && Math.abs(o.y - c.y) < 10) spook(o, 4);
      }
    } else spook(c, 4);
    disengage(r);
  }

  // ---------------------------------------------------------------- sailing
  // The boat sails while the line is in (idle). Asking to sail with the line out (no fish hooked) reels it in fast
  // first, then sails. Never during the fight, the landing or a card; not during the scripted tutorial catch.
  var LINE_OUT = { flying: 1, sinking: 1, waiting: 1, nibble: 1, bite: 1, retrieve: 1 };
  function sailLocked() {
    var T = AQ.tutorial;
    if (T && T.active && T.step < 8) return true; // first (scripted) catch of the tutorial
    return !!(st.tutorial && st.scripted);
  }
  // 'on' sail now · 'line' a press reels in first · 'off' not now
  function sailMode() {
    if (!st.sail || st.cardOpen || sailLocked()) return 'off';
    if (st.phase === 'idle') return 'on';
    if (LINE_OUT[st.phase]) return 'line';
    return 'off';
  }
  // a press (button, key, d-pad, bumper): nudge now, or reel in fast and sail when the line is in
  function sailEdge(dir) {
    var mode = sailMode();
    if (mode === 'off') return false;
    if (mode === 'line') {
      st.sailQueue = dir; st.fastRetrieve = true;
      if (st.phase === 'flying') { st.hook.active = false; setPhase('retrieve'); }
      else if (st.phase !== 'retrieve') retrieve();
      return true;
    }
    st.dir = dir;
    AQ.sail.nudge(st.sail, dir);
    st.sailUsed = true;
    return true;
  }
  function sailHeld(dir) {
    return dir > 0 ? (st.sailBtn.r || (!st.sailLatch && AQ.input.isDown('right'))) : (st.sailBtn.l || (!st.sailLatch && AQ.input.isDown('left')));
  }
  function sailTick(dt) {
    var mode = sailMode();
    var kx = (AQ.input.isDown('right') ? 1 : 0) - (AQ.input.isDown('left') ? 1 : 0);
    // fight steering (A/D, arrows, d-pad) must not turn into sailing once the fish is in: wait for a release
    if (st.phase === 'fight' || st.phase === 'landing') { if (kx) st.sailLatch = true; }
    else if (st.sailLatch && !kx) st.sailLatch = false;
    var keyDir = st.sailLatch ? 0 : kx;
    // key edges act like a button press (while aiming with the keyboard, ←/→ still pick the side)
    if (keyDir && keyDir !== st.sailKeyPrev && st.phase !== 'aiming') sailEdge(keyDir);
    st.sailKeyPrev = keyDir;
    var u = 0;
    if (mode === 'on') {
      u = (st.sailBtn.r ? 1 : 0) - (st.sailBtn.l ? 1 : 0) || keyDir;
      if (!u && !st.sailLatch && AQ.input.mode === 'gamepad') {
        var ax = AQ.input.axis('steer');
        if (Math.abs(ax) > 0.3) u = U.clamp(ax, -1, 1);
      }
      if (u) { st.dir = u > 0 ? 1 : -1; st.sailUsed = true; }
      else if (st.sail.nudge > 0) st.dir = st.sail.nudgeDir;
    }
    // the boat drifts to a stop while aiming and drops anchor (strong drag) once the line is out
    AQ.sail.step(st.sail, u, dt, { anchor: st.phase !== 'idle' && st.phase !== 'aiming' });
    st.boat.x = st.sail.x;
    wakeTick(dt);
  }
  // wake: ~ - . , glyphs left on the water behind the stern, and a ripple at the stern (toned down: reduced motion)
  function wakeTick(dt) {
    var w = st.wake, i;
    for (i = w.length - 1; i >= 0; i--) { var p = w[i]; p.t += dt; p.x += p.vx * dt; if (p.t >= p.life) w.splice(i, 1); }
    var sf = AQ.sail.speedFrac(st.sail), red = AQ.fx.motion() < 1;
    if (sf < 0.06) { st.wakeT = 0; return; }
    var sd = st.sail.vx > 0 ? 1 : -1, g = AQ.rng.global;
    var stern = st.boat.x - sd * (geo.bw / 2 + 0.5);
    st.wakeT -= dt * (red ? 4 : 16) * sf;
    while (st.wakeT <= 0) {
      st.wakeT += 1;
      if (w.length >= (red ? 16 : 56)) continue;
      w.push({ x: stern - sd * g.next() * 1.5, vx: -sd * (0.4 + g.next() * 0.9), t: 0, life: (red ? 0.6 : 1.1) + g.next() * (0.4 + 0.8 * sf),
        row: g.next() < (red ? 0 : 0.3) ? 1 : 0 });
    }
    st.rippleT -= dt;
    if (!red && st.rippleT <= 0) {
      st.rippleT = 0.75 - 0.4 * sf;
      AQ.fx.emit('ripple', stern, surfY(stern) + 1, { n: 1, level: 6 + Math.round(3 * sf), impulse: false });
      AQ.fx.surface.impulse(stern, 0.05 + 0.1 * sf);
    }
  }
  // the tip toast for players who wait a long time without a bite (once per session, hints on)
  function sailTipTick(dt) {
    if (st.phase === 'waiting' && !st.engaged) st.waitT += dt; else if (st.phase !== 'waiting') st.waitT = 0;
    if (st.waitT < 25 || st.tipsShown.sail || st.sailUsed || setting('hints') === false || sailMode() === 'off') return;
    st.tipsShown.sail = true;
    var m = AQ.input.mode;
    toast('fish.sail.tip.' + (m === 'keyboard' || m === 'gamepad' || m === 'touch' ? m : 'mouse'), null, 'info');
  }

  // ---------------------------------------------------------------- cast, sink, wait
  function beginAim(px, py, keyboard) {
    setPhase('aiming');
    st.aim.on = true; st.aim.key = !!keyboard; st.aim.power = 0;
    st.aim.sx = px; st.aim.sy = py; st.aim.x = px; st.aim.y = py;
  }
  function aimPower() {
    if (st.aim.key) return st.aim.power;
    var D = AQ.display;
    var dx = st.aim.x - st.aim.sx, dy = st.aim.y - st.aim.sy;
    return U.clamp(Math.sqrt(dx * dx + dy * dy) / (0.35 * Math.min(D.width, D.height)), 0, 1);
  }
  function aimDir() {
    if (st.aim.key) return st.dir;
    var dx = st.aim.x - st.aim.sx;
    if (Math.abs(dx) < 4) return st.dir;
    return dx > 0 ? -1 : 1;
  }
  function trajFor(power, dir) {
    updateTip();
    var cx = camTargetFor(dir); // the view the camera settles on for this side
    return AQ.line.trajectory(st.tip, power, dir, st.gear.cast || 26, { minX: cx + 3, maxX: cx + st.cols - 3, out: st.traj });
  }
  function cast() {
    var power = aimPower(), dir = aimDir();
    st.aim.on = false;
    if (!st.aim.key) {
      var dx = st.aim.x - st.aim.sx, dy = st.aim.y - st.aim.sy;
      if (Math.sqrt(dx * dx + dy * dy) < 12) { setPhase('idle'); return; }
    }
    st.dir = dir;
    st.power = power;
    trajFor(power, dir);
    st.flyT = 0;
    st.hook.active = false; st.hook.bait = bait();
    st.lineShortShown = false;
    AQ.line.resetRope(st.rope, st.tip, st.tip);
    setPhase('flying');
    emit('fish:cast', { power: power, dir: dir });
  }
  function landSplash() {
    var x = st.hook.x;
    st.hook.y = Math.max(0.5, surfY(x) + 0.5);
    AQ.fx.emit('splash', x, surfY(x), { power: 0.5 + st.power * 0.5, surfaceY: surfY(x) });
    emit('fish:splash', { wx: x, wy: 0, big: false });
    st.hook.active = true;
    st.sinkT = 0;
    // a splash within 2.5 u snags the drifting bottle
    if (st.bottle.on && Math.abs(st.bottle.x - x) < 2.5) snagBottle();
    setPhase('sinking');
  }
  function stopHook(reason) {
    if (st.phase !== 'sinking') return;
    setPhase('waiting');
    emit('fish:stop', { depthM: Math.round(st.hook.y * ((st.zone && st.zone.mPerUnit) || 0.2) * 10) / 10, reason: reason || 'player' });
  }
  function hookDist() {
    var dx = st.hook.x - st.tip.x, dy = st.hook.y - st.tip.y;
    return Math.sqrt(dx * dx + dy * dy);
  }
  function retrieve() {
    if (st.phase === 'sinking' || st.phase === 'waiting' || st.phase === 'nibble' || st.phase === 'bite') {
      if (st.engaged) { spook(st.engaged, 3); disengage(null); }
      setPhase('retrieve');
    }
  }

  // ---------------------------------------------------------------- fight
  function startFight(c) {
    var sp = spDef(c.sp) || { id: c.sp, fight: { style: 'puller', power: 1, stamina: 8, speed: 5, tell: 0.55, special: {} }, rarity: 'C', size: 'S', hookMin: 1, depth: [0, 1] };
    var spec = c.specimen || safe(function () { return AQ.spawn.rollSpecimen(c.sp, ctxSpawn(), st.rng); }, null) ||
      { sp: c.sp, len: 10, kg: 0.1, q: 0.5, dense: false, trophy: false, zone: st.zoneId, at: U.now() };
    spec.zone = spec.zone || st.zoneId;
    safe(function () { AQ.creatures.setHooked(c, true); });
    if (st.stubCreatures) { var idx = st.list.indexOf(c); if (idx >= 0) st.list.splice(idx, 1); }
    st.engaged = null; st.bs = null; st.hook.engagedUid = 0;
    var origin = { x: st.tip.x, y: 0 };
    var script = null;
    if (st.script && st.script.fightOverride) {
      var fo = st.script.fightOverride;
      script = { power: fo.power, stamina: fo.stamina, runs: fo.runs, noEscape: !!st.script.noEscape };
    } else if (st.script && st.script.noEscape) script = { noEscape: true };
    st.fs = AQ.fight.create(sp, spec, st.gear, {
      rng: st.rng.fork('fight:' + st.t.toFixed(3)), start: { x: c.x - origin.x, y: c.y }, floorY: floorY,
      covers: BG.covers(), origin: origin, viewCols: st.cols, script: script
    });
    st.fish = { sp: c.sp, x: c.x, y: c.y, dir: c.dir || 1, t: 0, frame: 0, lastX: c.x, w: 4, specimen: spec, legend: c.data && c.data.legend,
      c: st.stubCreatures ? null : c };
    var sd = AQ.sprites.get(c.sp);
    st.fish.w = sd.frames[0] && sd.frames[0][0] ? sd.frames[0][0].length : 4;
    st.specimen = spec; st.species = sp;
    st.fightAcc.t = 0; st.fightT0 = st.t;
    st.rod = 0; st.rodKey = 0; st.tellVis.kind = null; st.inkOn = false;
    setPhase('fight');
    AQ.fx.shake(3, 0.2);
    emit('fight:start', { sp: sp.id, rarity: sp.rarity, size: sp.size });
    if (st.fs.slipRisk) toast('fish.hookSmall', null, 'warn');
    if (sp.fight && sp.fight.special && sp.fight.special.tear) tip('soft');
    if (sp.fight && sp.fight.special && sp.fight.special.alarm) AQ.fx.emit('ripple', c.x, c.y, { n: 2, level: 12, impulse: false });
  }

  function tip(kind) {
    if (st.tipsShown[kind] || setting('hints') === false || st.tutorial) return;
    st.tipsShown[kind] = true;
    toast('fish.tip.' + kind, null, 'info');
  }

  function readRod(dt) {
    var mode = AQ.input.mode;
    var D = AQ.display;
    var kx = (AQ.input.isDown('right') ? 1 : 0) - (AQ.input.isDown('left') ? 1 : 0);
    var ax = AQ.input.axis ? AQ.input.axis('steer') : 0;
    if (mode === 'keyboard' || kx) {
      if (kx) st.rodKey = U.clamp(st.rodKey + kx * 3 * dt, -1, 1);
      else if (st.rodKey > 0) st.rodKey = Math.max(0, st.rodKey - 1.5 * dt);
      else if (st.rodKey < 0) st.rodKey = Math.min(0, st.rodKey + 1.5 * dt);
      st.rod = st.rodKey;
    } else if (mode === 'gamepad') {
      st.rod = U.clamp(ax, -1, 1);
    } else if (mode === 'mouse') {
      var p = AQ.input.pointer;
      R0.worldToScreen(st.boat.x, 0, tmpP);
      st.rod = U.clamp((p.x - tmpP.x) / (0.3 * D.width), -1, 1);
    }
    // touch: relative horizontal drag (handled in onMove); the rod holds its value when the finger lifts
    var auto = AQ.fight.autopilot(st.fs, inpOut);
    st.autoRod = auto.rod;
    if (setting('autoSteer') || st.debugAuto) return U.clamp(st.debugAuto ? auto.rod : 0.7 * auto.rod + 0.3 * st.rod, -1, 1);
    return st.rod;
  }
  var R0 = AQ.render;

  function fightUpdate(dt) {
    var fs = st.fs;
    if (!fs) return;
    var rod = readRod(dt);
    var reel;
    if (st.debugAuto) reel = AQ.fight.autopilot(fs, inpOut).reel;
    else reel = AQ.input.isDown('primary') || (st.press.on && st.press.type === 'mouse');
    st.reel = reel;
    var inp = fightInp;
    inp.reel = reel; inp.rod = rod;
    var steps = 0;
    st.fightAcc.t += dt * st.debugFast;
    while (st.fightAcc.t >= DT && steps < 8 * st.debugFast && !fs.result) {
      st.fightAcc.t -= DT; steps++;
      if (st.debugAuto) { AQ.fight.autopilot(fs, inpOut); inp.reel = inpOut.reel; inp.rod = inpOut.rod; }
      var evs = AQ.fight.step(fs, inp, DT);
      for (var i = 0; i < evs.length; i++) fightEvent(evs[i]);
    }
    if (st.fightAcc.t > DT * 8) st.fightAcc.t = 0;
    // fish pose
    var f = st.fish;
    var nx = fs.origin.x + fs.x, ny = fs.y;
    var vx = (nx - f.x) / Math.max(dt, 1e-3);
    f.x = nx; f.y = ny; f.t += dt;
    if (fs.state === 'run' || (fs.state === 'tell' && fs.next === 'run')) f.dir = fs.dirX;
    else if (Math.abs(vx) > 1.5) f.dir = vx > 0 ? 1 : -1;
    // the hook sits at the fish's mouth
    st.hook.x = f.x + f.dir * f.w * 0.5; st.hook.y = f.y;
    if (f.c) syncCreature(f, fs);
    if (st.tellVis.kind) st.tellVis.t += dt;
    // audio / haptics (throttled)
    st.audioT -= dt;
    if (st.audioT <= 0) {
      st.audioT = 0.1;
      safe(function () { AQ.audio.setTension(fs.T); AQ.audio.reel(reel, st.gear.reelSpeed); });
      safe(function () { AQ.haptics.tension(fs.T); });
    }
    // dive bubbles / grip dust while the state lasts
    if (fs.state === 'dive' && AQ.rng.global.next() < dt * 6) AQ.fx.emit('bubble', f.x, f.y - 1, { n: 1, surfaceY: surfY(f.x) });
  }

  // B draws the hooked creature: C writes its position, pose, facing and scramble (notes/B.md).
  function syncCreature(f, fs) {
    var c = f.c;
    c.x = f.x; c.y = f.y;
    if (!c.data) c.data = {};
    var running = fs && (fs.state === 'run' || (fs.state === 'tell' && fs.next === 'run'));
    c.data.faceLock = running ? fs.dirX : 0;
    var sp = st.species || {};
    c.pose = fs && fs.inflated ? 'inflate' : (st.inkOn ? (sp.id === 'lula' ? 'jet' : 'ink') : (fs && fs.state === 'roll' ? 'roll' : null));
    if (fs && fs.state === 'shake' && sp.fight && sp.fight.special && sp.fight.special.scramble) c.data.scramble = 1;
    if (AQ.creatures.mouth) { var mo = AQ.creatures.mouth(c, tmpM); if (mo) { st.hook.x = mo.x; st.hook.y = mo.y; } }
  }
  var tmpM = { x: 0, y: 0 };

  function fightEvent(e) {
    var fs = st.fs, f = st.fish;
    switch (e.type) {
      case 'tell':
        st.tellVis.kind = e.kind; st.tellVis.t = 0;
        emit('fight:tell', { kind: e.kind });
        tip(e.kind);
        if (e.kind === 'dive') AQ.fx.emit('bubble', f.x, f.y - 1, { n: 3, surfaceY: surfY(f.x) });
        if (e.kind === 'grip') AQ.fx.emit('dust', f.x, Math.min(floorY(f.x) - 0.5, f.y + 1), { n: 8 });
        if (e.kind === 'jump') AQ.fx.emit('ripple', f.x, surfY(f.x), { n: 2, level: 12 });
        break;
      case 'state':
        if (e.state !== 'tell' && st.tellVis.kind && st.tellVis.kind !== e.state) st.tellVis.kind = null;
        if (e.state === 'rise' && fs.rising && st.species && st.species.id === 'tinteira') toast('fish.tinteira.rises', null, 'rare');
        break;
      case 'phase':
        emit('fight:phase', { phase: e.phase });
        if (fs.tentacles) toast('fish.tinteira.tentacles', null, 'rare');
        AQ.fx.shake(4, 0.3);
        break;
      case 'ink':
        st.inkOn = e.on;
        if (e.on) {
          var sp = st.species, glow = !!(sp && sp.fight && sp.fight.special && sp.fight.special.glowInk);
          AQ.fx.emit('ink', f.x, f.y, { radius: fs.inkRadius || 8, glow: glow, life: 2.5 });
          emit('fight:tell', { kind: 'ink' });
          tip('ink');
        }
        break;
      case 'inflate':
        if (e.on) tip('inflate');
        break;
      case 'air':
        AQ.fx.emit('splash', f.x, surfY(f.x), { power: 1, surfaceY: surfY(f.x), dir: f.dir });
        emit('fish:splash', { wx: f.x, wy: 0, big: true });
        break;
      case 'end':
        endFight(e.result);
        break;
      default: break;
    }
  }

  function endFight(result) {
    var fs = st.fs, f = st.fish, sec = Math.round((st.t - st.fightT0) * 10) / 10;
    safe(function () { AQ.audio.setTension(null); AQ.audio.reel(false, 0); });
    safe(function () { AQ.haptics.tension(0); });
    emit('fight:end', { sp: f.sp, result: result, sec: sec });
    if (st.inkOn) st.inkOn = false;
    if (result === 'landed') {
      st.landing = { t: 0, x0: f.x, y0: f.y, x: f.x, y: f.y, dropT: 0 };
      setPhase('landing');
      emit('catch:landed', { specimen: st.specimen });
      return;
    }
    // escape: slack line, x at the break, the fish swims off at 2× speed; the bait is consumed
    safe(function () { AQ.game.consumeBait(); });
    var breaks = result === 'snap' || result === 'fray';
    var sp = st.species;
    st.escape = { t: 0, reason: result, x: st.hook.x, y: st.hook.y, breaks: breaks,
      fish: f.c ? null : { sp: f.sp, x: f.x, y: Math.max(1, f.y), dir: f.dir, v: 2 * ((sp && sp.fight && sp.fight.speed) || 5), t: 0 } };
    if (f.c) { f.c.pose = null; if (f.c.data) f.c.data.faceLock = 0; safe(function () { AQ.creatures.setHooked(f.c, false); }); }
    if (result === 'snap') AQ.fx.shake(4, 0.25);
    if (f.legend) { st.legend.state = 'none'; st.legend.returnAt = st.t + 60; }
    st.fs = null;
    setPhase('retrieve');
    st.hook.active = false;
    if (breaks) { st.hook.x = st.tip.x; st.hook.y = st.tip.y + 1; }
  }

  function resolveLanding() {
    var spec = st.specimen, sp = st.species;
    if (st.fish && st.fish.c) { var ci = st.list.indexOf(st.fish.c); if (ci >= 0) st.list.splice(ci, 1); }
    st.fish = null; st.landing = null;
    if (st.script) { st.script = null; st.scripted = false; }
    safe(function () { AQ.game.consumeBait(); });
    var endingCatch = !!(sp && sp.keep === false);
    if (st.debugAuto && st.debugResolve) {
      var res0 = safe(function () { return AQ.game.resolveCatch(spec, { choice: endingCatch ? 'release' : (st.debugChoice || 'sell') }); }, null);
      var done = st.debugResolve; st.debugResolve = null; st.debugAuto = false; st.debugFast = 1;
      backToIdle();
      done(res0);
      return;
    }
    if (endingCatch) { // Lula-Tinteira: no card, straight to the ending (D emits ending:start, E runs it)
      safe(function () { AQ.game.resolveCatch(spec, { choice: 'release' }); });
      backToIdle();
      return;
    }
    var info = safe(function () { return AQ.game.catchInfo ? AQ.game.catchInfo(spec) : null; }, null) || {};
    var opts = { canKeep: info.canKeep !== undefined ? info.canKeep : true, tanks: info.tanks || [], isNew: !!info.isNew, isRecord: !!info.isRecord };
    st.cardOpen = true;
    setPhase('landing');
    var p = safe(function () { return AQ.ui.catchCard(spec, opts); }, null) || Promise.resolve({ choice: 'sell' });
    Promise.resolve(p).then(function (r) {
      var choice = (r && r.choice) || 'sell';
      safe(function () { AQ.game.resolveCatch(spec, { choice: choice, tankId: r && r.tankId }); });
    }, function () {
      safe(function () { AQ.game.resolveCatch(spec, { choice: 'sell' }); });
    }).then(function () {
      st.cardOpen = false;
      if (AQ.scenes.current === 'fishing') backToIdle();
    });
  }

  function backToIdle() {
    st.fs = null; st.fish = null; st.escape = null; st.landing = null;
    st.hook.active = false; st.engaged = null; st.bs = null;
    st.fastRetrieve = false;
    var q = st.sailQueue;
    st.sailQueue = 0;
    if (q && !st.cardOpen && !sailLocked()) st.dir = q; // the line is in: now sail where the player asked
    updateTip();
    st.hook.x = st.tip.x; st.hook.y = st.tip.y + 2;
    AQ.line.resetRope(st.rope, st.tip, st.hook);
    setPhase('idle');
    if (q && sailMode() === 'on' && !sailHeld(q)) AQ.sail.nudge(st.sail, q); // a tap while the line was out
  }

  // ---------------------------------------------------------------- special events
  function frenzyTick(dt) {
    var fz = st.frenzy;
    if (!st.zone || !st.zone.frenzy) return;
    if (fz.on) {
      fz.t -= dt;
      if (fz.t <= 0) { fz.on = false; fz.next = st.t + st.rng.range(240, 420); emit('frenzy:end', { zone: st.zoneId }); }
      return;
    }
    if (st.t >= fz.next && st.phase !== 'fight' && st.phase !== 'landing' && !st.tutorial) {
      fz.on = true; fz.t = 30; fz.x = viewX0() + st.rng.range(0.2, 0.8) * st.cols; // a place: sail away and it stays there
      var id = safe(function () { return AQ.spawn.pick(st.zoneId, ctxSpawn(), st.rng); }, null);
      if (id) {
        var sp = spDef(id);
        var n = st.rng.irange(6, 10);
        for (var i = 0; i < n; i++) {
          var y = U.clamp(st.depth * Math.min(sp.depth[1], sp.depth[0] + 0.15) + st.rng.range(0, 6), 2, floorY(fz.x) - 2);
          makeCreature(id, fz.x + st.rng.range(-6, 6), y, st.rng.next() < 0.5 ? 1 : -1);
        }
      }
      emit('frenzy:start', { zone: st.zoneId });
    }
  }

  function bottleTick(dt) {
    var b = st.bottle;
    if (b.on) {
      if (b.held) return;
      b.x += b.vx * dt;
      if (b.x < viewX0() - 30 || b.x > viewX1() + 30) { b.on = false; b.next = st.t + st.rng.range(300, 480); }
      // a shallow hook touching it snags it
      if (st.hook.active && st.hook.y < 2 && Math.abs(st.hook.x - b.x) < 1.5 && (st.phase === 'sinking' || st.phase === 'waiting' || st.phase === 'retrieve')) snagBottle();
      return;
    }
    if (st.t < b.next || st.tutorial) return;
    var all = safe(function () { return AQ.game.allMessagesFound ? AQ.game.allMessagesFound() : false; }, false);
    if (all && st.t - b.coinT < 900) { b.next = st.t + 60; return; }
    b.on = true; b.held = false;
    b.vx = (st.rng.next() < 0.5 ? 1 : -1) * st.rng.range(1.2, 2);
    b.x = b.vx > 0 ? viewX0() - 4 : viewX1() + 4;
    b.coins = all;
  }
  function snagBottle() {
    var b = st.bottle;
    if (!b.on || b.held) return;
    b.held = true;
    if (st.engaged) disengage(null);
    st.hook.x = b.x;
    setPhase('retrieve');
    st.hook.active = true;
  }
  function openBottle() {
    var b = st.bottle;
    b.on = false; b.held = false; b.next = st.t + st.rng.range(300, 480);
    var id = safe(function () { return AQ.game.foundMessage(); }, null);
    if (id) { toast('fish.bottle.found', null, 'good', true); return; }
    b.coinT = st.t;
    var coins = safe(function () { return AQ.game.bottleCoins(st.zoneId); }, 0);
    toast('fish.bottle.coins', { coins: AQ.i18n.money(coins) }, 'good', true);
    AQ.fx.emit('coin', st.boat.x, -6, { n: 6 });
  }

  function sightTick(dt) {
    if (st.t >= st.sightNext) {
      st.sightNext = st.t + 60;
      var list = safe(function () { return AQ.sightings.list; }, []) || [];
      var now = worldNow();
      for (var i = 0; i < list.length; i++) {
        var s = list[i];
        if (!s.zones || s.zones.indexOf(st.zoneId) < 0) continue;
        if (s.time && s.time.indexOf(now.phase) < 0) continue;
        if (s.weather && s.weather.indexOf(now.weather) < 0) continue;
        if (!AQ.sprites[s.sprite || s.id]) continue;
        if (st.rng.next() >= (s.chancePerMin || 0.03)) continue;
        var dir = st.rng.next() < 0.5 ? 1 : -1;
        var count = s.count || 1;
        var y = st.depth * st.rng.range((s.depth && s.depth[0]) || 0.3, (s.depth && s.depth[1]) || 0.5);
        for (var k = 0; k < count; k++) {
          st.sights.push({ id: s.id, key: s.sprite || s.id, x: dir > 0 ? viewX0() - 30 - k * 9 : viewX1() + 30 + k * 9, y: y, y0: y, dir: dir,
            v: s.speed || 3, t: k * 0.7, seenT: 0, leap: s.path === 'leap' });
        }
      }
    }
    for (var j = st.sights.length - 1; j >= 0; j--) {
      var o = st.sights[j];
      o.t += dt; o.x += o.dir * o.v * dt;
      if (o.leap) o.y = o.y0 - Math.max(0, Math.sin(o.t * 1.6)) * (o.y0 + 4);
      var sd = AQ.sprites.get(o.key), w = sd.frames[0][0].length;
      var on = o.x - w / 2 > viewX0() && o.x + w / 2 < viewX1() && o.y > R0.cam.y && o.y < R0.cam.y + viewH();
      if (on) {
        o.seenT += dt;
        if (o.seenT >= 2 && !o.counted) { o.counted = true; safe(function () { AQ.game.markSighting(o.id); }); }
      }
      if ((o.dir > 0 && o.x > viewX1() + 40) || (o.dir < 0 && o.x < viewX0() - 40) || o.x < viewX0() - st.cols - 80 || o.x > viewX1() + st.cols + 80) st.sights.splice(j, 1);
    }
  }

  function legendTick(dt) {
    var L = st.legend;
    if (L.state === 'none') {
      L.checkT -= dt;
      if (L.checkT > 0 || st.t < L.returnAt) return;
      L.checkT = 2;
      var id = safe(function () { return AQ.spawn.legendaryReady(st.zoneId, ctxSpawn()); }, null);
      if (!id || id === st.lastLegendLanded) return;
      L.state = 'pending'; L.id = id; L.at = st.t + st.rng.range(20, 60);
      return;
    }
    var ready = safe(function () { return AQ.spawn.legendaryReady(st.zoneId, ctxSpawn()); }, null);
    if (L.state === 'pending') {
      if (ready !== L.id) { L.state = 'none'; return; }
      if (st.t >= L.at) {
        var sp = spDef(L.id);
        L.state = 'near'; L.t = 0; L.dir = st.rng.next() < 0.5 ? 1 : -1;
        L.y = U.clamp(bandY(sp, st.rng), 4, st.depth - 4);
        L.x = L.dir > 0 ? viewX0() - 30 : viewX1() + 30;
        emit('legendary:near', { sp: L.id });
      }
    } else if (L.state === 'near') {
      L.t += dt; L.x += L.dir * 4 * dt;
      if (L.t > 9) { // the silhouette has passed: the legendary itself arrives near the hook
        var spd = spDef(L.id);
        var x = st.hook.active ? U.clamp(st.hook.x + st.rng.range(-14, 14), viewX0() + 4, viewX1() - 4) : viewX0() + st.rng.range(6, st.cols - 6);
        var left = x < viewX0() + st.cols / 2;
        var c = makeCreature(L.id, left ? viewX0() - 10 : viewX1() + 10, U.clamp(bandY(spd, st.rng), 3, floorY(x) - 3), left ? 1 : -1, { legend: true });
        L.state = c ? 'spawned' : 'none';
      }
    } else if (L.state === 'spawned') {
      if (ready !== L.id && st.phase !== 'fight') {
        for (var i = 0; i < st.list.length; i++) if (st.list[i].data && st.list[i].data.legend && st.list[i] !== st.engaged) st.list[i]._gone = true;
        L.state = 'none';
      }
    }
  }

  // ---------------------------------------------------------------- update
  function update(dt) {
    if (!st.rope) return;
    st.t += dt;
    st.phaseT += dt;
    st.gear = st.gear || gear();
    var D = AQ.display;
    if (st.cols !== D.cols && D.cols) resize(D.metrics());
    var now = worldNow();
    env.phase = now.phase; env.zone = st.zoneId; env.lantern = st.gear.lantern;
    env.luck = safe(function () { return AQ.game.luck(st.zoneId); }, 0);
    territory(dt);
    env.bounds.y1 = st.depth; env.depth = st.depth;
    AQ.fx.surface.amp = now.weather === 'tempestade' ? 2 : now.weather === 'chuva' ? 1.3 : (st.zone && st.zone.id === 'mar' ? 1.4 : 1);
    if (now.weather === 'tempestade' && AQ.rng.global.next() < dt * 0.12) AQ.fx.lightning();
    sailTick(dt);
    st.boat.y = surfY(st.boat.x) * (AQ.fx.motion() < 1 ? 0 : 0.8);
    updateTip();

    switch (st.phase) {
      case 'idle':
        st.hook.active = false;
        st.hook.x = st.tip.x; st.hook.y = st.tip.y + 2 + Math.sin(st.t * 1.5) * 0.3;
        if (sailMode() !== 'on') keyAim(dt); // tutorial: ←/→ only pick the side (otherwise they sail)
        break;
      case 'aiming':
        // a modal (note, hint card, pause) swallows the release: drop the aim instead of sticking in 'aiming'
        if (AQ.input.blocked || !inScene()) { st.aim.on = false; st.press.on = false; setPhase('idle'); break; }
        if (st.aim.key && !AQ.input.isDown('primary')) { cast(); break; }
        if (st.aim.key) {
          st.aim.power = Math.min(1, st.aim.power + dt / 1.2);
          var kx = (AQ.input.isDown('right') ? 1 : 0) - (AQ.input.isDown('left') ? 1 : 0);
          var ax = AQ.input.axis ? AQ.input.axis('aimX') : 0;
          if (kx) st.dir = kx; else if (Math.abs(ax) > 0.4) st.dir = ax > 0 ? 1 : -1;
        }
        st.hook.x = st.tip.x; st.hook.y = st.tip.y + 2;
        trajFor(aimPower(), aimDir());
        break;
      case 'flying': {
        st.flyT += dt;
        AQ.line.pointAt(st.traj, st.flyT, tmpP);
        st.hook.x = tmpP.x; st.hook.y = tmpP.y;
        if (st.flyT >= st.traj.flightTime) landSplash();
        break;
      }
      case 'sinking': {
        st.sinkT += dt;
        var sp0 = 10 + 20 * U.clamp(st.sinkT / 1.5, 0, 1);
        if (isLure(st.hook.bait)) sp0 *= 0.8;
        st.hook.y += sp0 * dt;
        st.hook.moving = true;
        var fl = floorY(st.hook.x) - 0.8;
        var auto = st.script && st.script.autoStopDepth;
        if (st.hook.y >= fl) { st.hook.y = fl; stopHook('floor'); }
        else if (hookDist() >= st.gear.maxLen - 4) {
          stopHook('line');
          if (!st.lineShortShown) { st.lineShortShown = true; toast('fish.lineShort', { m: AQ.i18n.num(st.hook.y * ((st.zone && st.zone.mPerUnit) || 0.2)) }, 'warn'); }
        } else if (auto && st.hook.y >= auto) { st.hook.y = auto; stopHook('auto'); }
        if (!st.darkTipShown && darkAt(st.hook.y / st.depth) && (S().player.gear.lantern || 0) === 0 && st.zoneId !== 'baia') { st.darkTipShown = true; tip('dark'); }
        break;
      }
      case 'waiting': case 'nibble': case 'bite': {
        var reeling = AQ.input.isDown('primary') || (st.press.on && st.t - st.press.at > 0.18 && !st.press.moved);
        st.hook.moving = reeling;
        if (reeling && st.phase === 'waiting') {
          var dx = st.tip.x - st.hook.x, dy = st.tip.y - st.hook.y, d = Math.sqrt(dx * dx + dy * dy);
          var v = st.gear.reelSpeed * 0.35;
          st.hook.x += dx / d * v * dt; st.hook.y += dy / d * v * dt;
          if (st.hook.y < 0.5 || d < 3) { if (st.engaged) disengage(null); reelSound(false); backToIdle(); break; }
          reelSound(true, v);
        } else {
          reelSound(false);   // the player let go: the reel stops turning
          if (st.phase === 'waiting' && AQ.input.isDown('down')) { setPhase('sinking'); st.sinkT = 0.5; }
        }
        if (st.nibbleT > 0) st.nibbleT -= dt;
        if (st.twitchT > 0) st.twitchT -= dt;
        if (st.phase === 'bite' && st.bs && AQ.bite.expired(st.bs, st.t)) {
          if (st.engaged) spook(st.engaged, 4);
          disengage('late');
        }
        if (st.phase === 'nibble' && st.bs && st.t - st.bs.lastNibble > 1.6 && st.bs.state === 'nibble') setPhase('waiting');
        break;
      }
      case 'fight':
        fightUpdate(dt);
        break;
      case 'landing':
        if (st.landing) {
          var L = st.landing;
          L.t += dt;
          var k = U.easeOutCubic(U.clamp(L.t / 1.2, 0, 1));
          L.x = U.lerp(L.x0, st.tip.x + st.dir * 1, k);
          L.y = U.lerp(L.y0, st.tip.y + 3, k);
          if (st.fish) { st.fish.x = L.x; st.fish.y = L.y; st.fish.t += dt; if (st.fish.c) { st.fish.c.x = L.x; st.fish.c.y = L.y; } }
          st.hook.x = L.x; st.hook.y = L.y;
          L.dropT -= dt;
          if (L.dropT <= 0 && L.y < 1) { L.dropT = 0.15; AQ.fx.emit('drop', L.x, L.y + 1, { n: 2 }); }
          if (L.t >= 1.2 && !st.cardOpen) resolveLanding();
        }
        break;
      case 'retrieve': {
        var e = st.escape;
        if (e) {
          e.t += dt;
          if (e.fish) { e.fish.x += e.fish.dir * e.fish.v * dt; e.fish.t += dt; }
          if (e.t < 1.2 && e.breaks) break; // the slack line drifts before the reel-in
        }
        var rdx = st.tip.x - st.hook.x, rdy = st.tip.y + 2 - st.hook.y, rd = Math.sqrt(rdx * rdx + rdy * rdy);
        var rv = st.gear.reelSpeed * (st.fastRetrieve ? 5 : 3);
        st.hook.moving = true;
        if (rd < 1.5 || (e && e.breaks)) {
          if (st.bottle.held) openBottle();
          backToIdle();
          break;
        }
        st.hook.x += rdx / rd * rv * dt; st.hook.y += rdy / rd * rv * dt;
        if (st.bottle.held) { st.bottle.x = st.hook.x; }
        break;
      }
      default: break;
    }

    // world simulation
    updCreatures(dt);
    spawnTick(dt, false);
    despawn();
    seenTick(dt);
    frenzyTick(dt);
    bottleTick(dt);
    sightTick(dt);
    legendTick(dt);
    ventBubbles(dt);
    sailTipTick(dt);

    // rope
    stepLine(dt);
    // camera
    updCamera(dt);
    // ambience mix (hook depth)
    st.ambT = (st.ambT || 0) - dt;
    if (st.ambT <= 0) {
      st.ambT = 0.5;
      var under = st.hook.active ? U.clamp(st.hook.y / st.depth, 0, 1) : 0;
      safe(function () { AQ.audio.setAmbience({ zone: st.zoneId, underwater: under, weather: now.weather, phase: now.phase }); });
    }
  }

  function keyAim(dt) {
    // keyboard / gamepad aim while sailing is locked (tutorial): ←/→ (or stick) pick the side in idle
    var kx = (AQ.input.isDown('right') ? 1 : 0) - (AQ.input.isDown('left') ? 1 : 0);
    if (kx) st.dir = kx;
  }

  function seenTick(dt) {
    var top = R0.cam.y, bot = R0.cam.y + viewH();
    for (var i = 0; i < st.list.length; i++) {
      var c = st.list[i];
      if (st.seen[c.sp]) continue;
      if (c.x < viewX0() || c.x > viewX1() || c.y < top || c.y > bot) continue;
      if (env.visibility(c.x, c.y, c) < 0.5) continue;
      c.data._seenT = (c.data._seenT || 0) + dt;
      if (c.data._seenT >= 1) { st.seen[c.sp] = true; safe(function () { AQ.game.markSeen(c.sp); }); }
    }
  }

  function ventBubbles(dt) {
    var v = BG.vents();
    for (var i = 0; i < v.length; i++) {
      v[i].t -= dt;
      if (v[i].t <= 0) { v[i].t = 0.4 + AQ.rng.global.next() * 1.2; AQ.fx.emit('bubble', v[i].x, v[i].y, { n: 1, surfaceY: surfY(v[i].x) }); }
    }
  }

  function stepLine(dt) {
    var a = st.tip, b = st.hook;
    var dist = Math.sqrt((b.x - a.x) * (b.x - a.x) + (b.y - a.y) * (b.y - a.y));
    var len;
    var iters = (AQ.perf.params && AQ.perf.params.ropeIters) || 4;
    if (st.phase === 'fight' && st.fs) len = dist * (1 + Math.max(0, 0.2 - st.fs.T) * 0.6);
    else if (st.phase === 'flying') len = dist * 1.02;
    else if (st.phase === 'idle' || st.phase === 'aiming' || st.phase === 'landing') len = dist * 1.05;
    else if (st.escape && st.escape.breaks) len = dist * 1.6 + 6;
    else if (st.phase === 'sinking') len = dist * 1.03;
    else len = dist * (st.hook.moving ? 1.01 : 1.12);
    var eb = st.escape && st.escape.breaks;
    if (eb) { b = tmpP; tmpP.x = st.escape.x; tmpP.y = Math.min(st.escape.y, 6 + st.escape.t * 4); }
    AQ.line.stepRope(st.rope, a, b, len, dt, { gravity: 30, iterations: iters, waterY: 0 });
    st.ropeLen = len;
  }

  function updCamera(dt) {
    // sky = HUD top inset + room for the boat and the angler (insets change after enter, so recompute)
    var lay = HUD.layout();
    var need = Math.ceil(-(geo.ay - (geo.pose ? geo.pose.length : 4) * ASPECT / 2) / ASPECT) + 1;
    st.skyRows = U.clamp((lay.insetT || 0) + Math.max(5, need), 5, 14);
    var vh = viewH();
    var lo = -st.skyRows * ASPECT, hi = Math.max(lo, st.depth - vh + 4);
    var target = lo;
    var active = st.phase !== 'idle' && st.phase !== 'aiming' && st.phase !== 'flying';
    var focusY = st.phase === 'fight' && st.fish ? st.fish.y : st.hook.y;
    if (active && focusY > vh * 0.45 + lo) target = focusY - vh * 0.45;
    if (st.phase === 'landing') target = lo;
    target = U.clamp(target, lo, hi);
    // critically damped spring (λ = 6)
    var k = 36, c = 12;
    st.cam.vy += (k * (target - st.cam.y) - c * st.cam.vy) * dt;
    st.cam.y += st.cam.vy * dt;
    st.cam.y = U.clamp(st.cam.y, lo - 2, hi + 2);
    // horizontal: the same spring follows the boat, leads the bow (or the side being aimed at), keeps the hook on screen
    var dirT = st.phase === 'aiming' ? aimDir() : st.dir;
    st.cam.dirS += (dirT - st.cam.dirS) * Math.min(1, dt * 2.5);
    var tx = camTargetX();
    st.cam.vx += (k * (tx - st.cam.x) - c * st.cam.vx) * dt;
    st.cam.x += st.cam.vx * dt;
    syncView();
  }
  function camTargetX() {
    var look = U.clamp((st.sail ? st.sail.vx : 0) * 0.45, -0.12 * st.cols, 0.12 * st.cols);
    var tx = st.boat.x - anchorFrac(st.cam.dirS) * st.cols + look;
    var fx = null;
    if (st.phase === 'fight' && st.fish) fx = st.fish.x;
    else if (st.phase !== 'landing' && (st.hook.active || st.phase === 'flying' || st.phase === 'retrieve')) fx = st.hook.x;
    if (fx !== null) tx = U.clamp(tx, fx - st.cols + 6, fx - 6);
    return tx;
  }
  // camera → renderer, terrain chunks around the view, surface ripple window
  function syncView() {
    R0.cam.set(st.cam.x, st.cam.y);
    BG.ensure(st.cam.x, st.cam.x + st.cols);
    AQ.fx.surface.follow(Math.floor(st.cam.x) - 12);
  }

  // ---------------------------------------------------------------- draw
  var bgCtx = { t: 0, lightAt: lightAt, darkAt: darkAt, hook: null, lantern: 6, phase: 'dia', minutes: 720, weather: 'limpo', thick: null, pulseCover: null, frenzyX: null };
  var thickO = { y0: 0, y1: 0 };
  function drawBg(grid, t) {
    if (!st.rope) return;
    var now = worldNow();
    bgCtx.t = t; bgCtx.hook = st.hook.active || st.phase === 'fight' ? st.hook : null;
    bgCtx.lantern = st.gear ? st.gear.lantern : 6;
    bgCtx.phase = now.phase; bgCtx.minutes = now.minutes % 1440; bgCtx.weather = now.weather;
    bgCtx.frenzyX = st.frenzy.on ? st.frenzy.x : null;
    var L = st.legend;
    if (L.state === 'near' || L.state === 'spawned') { thickO.y0 = L.y - 10; thickO.y1 = L.y + 10; bgCtx.thick = thickO; } else bgCtx.thick = null;
    var fs = st.fs;
    bgCtx.pulseCover = null;
    if (fs && ((fs.state === 'tell' && fs.next === 'burrow') || fs.state === 'burrow')) {
      bgCtx.pulseCover = BG.nearestCover(fs.origin.x + (fs.state === 'burrow' ? fs.coverX : fs.x), fs.state === 'burrow' ? fs.coverY : fs.y);
    }
    BG.drawBg(grid, t, bgCtx);
  }

  var codeCache = null;
  // Fish swimming below the view: a faint 'v' on the lowest free row above each one, brighter for bigger
  // fish, so the player can read what lives deeper before casting. Lit water only (darkness keeps its secrets).
  function drawDeepMarkers(t) {
    if (st.phase === 'fight' || st.phase === 'landing' || !st.list.length) return;
    var cd = codes(), lay = HUD.layout();
    var rowsUp = (lay.insetB || 0) + 2.5;
    var edge = st.cam.y + viewH() - rowsUp * ASPECT;
    var SZ = AQ.ENUM.SIZE || [];
    for (var i = 0; i < st.list.length; i++) {
      var c = st.list[i];
      if (c === st.engaged || c.hooked || c.y <= st.cam.y + viewH() + 1 || c.x < viewX0() + 2 || c.x > viewX1() - 2) continue;
      if (darkAt(U.clamp(c.y / st.depth, 0, 1))) continue;
      var sp = spDef(c.sp || c.id), si = sp ? Math.max(0, SZ.indexOf(sp.size)) : 1;
      var lvl = Math.min(7, 3 + Math.floor(si / 2)) + (Math.sin(t * 1.6 + i * 1.7) > 0.6 ? 1 : 0);
      R0.glyphW(cd.v, c.x, edge + Math.sin(t * 2 + i) * 0.25, lvl);
    }
  }
  function codes() {
    if (codeCache) return codeCache;
    var C = function (ch, b) { return R0.code(ch, b); };
    codeCache = { J: C('J'), JB: C('J', true), bang: C('!', true), x: C('x', true), dot: C('.'), mid: C('·'), q: C("'"), tilde: C('~'),
      comma: C(','), dash: C('-'), lt: C('<', true), gt: C('>', true), paren: C(')'), lparen: C('('), caret: C('^', true), hash: C('#'), v: C('v') };
    return codeCache;
  }

  function draw(t) {
    if (!st.rope) return;
    var R = R0, cd = codes();
    var motion = AQ.fx.motion();
    // 1. plants
    BG.drawPlants(t, bgCtx.hook ? bgCtx : drawCtxNoHook());
    // legendary silhouette (level 2, huge)
    var L = st.legend;
    if (L.state === 'near') drawSilhouette(L, t);
    // sightings
    for (var si = 0; si < st.sights.length; si++) {
      var o = st.sights[si], sd = AQ.sprites.get(o.key);
      R.sprite(sd.frames[Math.floor(o.t * (sd.fps || 2)) % sd.frames.length], o.x, o.y, { flip: o.dir < 0, level: 8, deform: sd.deform, amp: (sd.amp || 1) * motion, t: o.t });
    }
    // 2. creatures (each species draws in its own tint in the Colourful theme)
    drawCreatures();
    R.tint('surface');
    drawDeepMarkers(t);
    R.tint(0);
    // escaping fish
    if (st.escape && st.escape.fish) {
      var ef = st.escape.fish, esd = AQ.sprites.get(ef.sp);
      R.sprite(esd.frames[Math.floor(ef.t * 8) % esd.frames.length], ef.x, ef.y, { flip: ef.dir < 0, level: Math.max(1, Math.round(10 - ef.t * 4)), deform: esd.deform, amp: 1.5 * motion, t: ef.t * 2 });
    }
    // hooked fish
    if (st.fish && !st.fish.c) drawHookedFish(t);
    // bottle
    if (st.bottle.on) drawBottle(t);
    // frenzy birds
    R.tint('white');
    if (st.frenzy.on) drawBirds(t);
    // 3. wake, boat and angler
    R.tint('foam');
    drawWake(t);
    R.tint('wood');
    drawBoat(t);
    // 4. line
    R.tint('line');
    drawLine(t);
    R.tint(0);
    // 5. hook and bait
    drawHook(t);
    // aim preview
    R.tint('accent');
    if (st.phase === 'aiming') drawAim(t);
    // 6. tells
    if (st.phase === 'fight' && st.fs) drawTells(t);
    R.tint(0);
    // 7. particles
    AQ.fx.draw();
    // 8. HUD
    HUD.draw(t, hudState);
    hudState.phase = st.phase; hudState.fs = st.fs; hudState.rod = st.fs && (setting('autoSteer') || st.debugAuto) ? (0.7 * st.autoRod + 0.3 * st.rod) : st.rod;
    hudState.autoRod = setting('autoSteer') ? st.autoRod : null;
    hudState.hookY = st.hook.active || st.phase === 'fight' ? st.hook.y : null;
    hudState.zone = st.zone; hudState.middle = !!(st.script && st.phase === 'fight');
  }
  var hudState = { phase: 'idle', fs: null, rod: 0, autoRod: null, hookY: null, zone: null, middle: false };
  var noHookCtx = { lightAt: lightAt, darkAt: darkAt, hook: null, lantern: 6 };
  function drawCtxNoHook() { noHookCtx.lantern = st.gear ? st.gear.lantern : 6; return noHookCtx; }

  function drawSilhouette(L, t) {
    var sd = AQ.sprites.get(L.id), fr = sd.frames[0];
    var sil = L.sil || (L.sil = AQ.textart.silhouette(fr, '·'));
    var f = R0.compile(sil);
    // drawn twice as wide by stamping each glyph twice (huge, faint)
    var big = L.big || (L.big = R0.compile(sil.map(function (row) { var s = ''; for (var i = 0; i < row.length; i++) s += row[i] + row[i]; return s; })));
    void f;
    R0.sprite(big, L.x, L.y, { flip: L.dir < 0, level: 2, knock: false, deform: 'swim', amp: 0.6 * AQ.fx.motion(), t: t });
  }

  function drawHookedFish(t) {
    var f = st.fish, fs = st.fs, sd = AQ.sprites.get(f.sp);
    var frames = sd.frames, fr;
    if (fs && fs.inflated && sd.extra && sd.extra.inflate) fr = sd.extra.inflate[0];
    else if (sd.extra && sd.extra.jet && fs && fs.state === 'run' && st.species && st.species.kind === 'cephalopod') fr = sd.extra.jet[0];
    else fr = frames[Math.floor(f.t * (fs && (fs.state === 'run' || fs.state === 'shake') ? 10 : 5)) % frames.length];
    var spec = f.specimen || {};
    var sp = st.species || {};
    var lvl = 15;
    var vis = env.visibility(f.x, f.y, { sp: f.sp });
    if (vis < 0.5 && st.phase === 'fight') lvl = Math.max(4, Math.round(15 * Math.max(vis, 0.35)));
    if (st.inkOn) lvl = Math.max(3, Math.round(lvl * (1 - AQ.fx.inkAt(f.x, f.y) * 0.8)));
    var amp = (sd.amp || 1) * AQ.fx.motion() * (fs && fs.state === 'shake' ? 2.5 : 1);
    var glyphMap = null;
    if (sd.scramble && fs && fs.state === 'shake') glyphMap = scrambleMap;
    R0.sprite(fr, f.x, f.y, {
      flip: f.dir < 0, level: lvl, dense: !!spec.dense, deform: fs && fs.state === 'grip' ? 'none' : (fs && fs.state === 'shake' ? 'jitter' : sd.deform),
      amp: amp, t: f.t * (fs && fs.state === 'run' ? 2 : 1), shimmer: sp.rarity === 'R' || sp.rarity === 'L', halo: sp.rarity === 'L' ? 2 : false,
      glyphMap: glyphMap, seed: 7
    });
    // tinteira's tentacles grip the line (last phase)
    if (fs && fs.tentacles && AQ.art && AQ.art.tentacle) {
      var ta = AQ.art.tentacle, tf = ta.frames ? ta.frames[Math.floor(t * 3) % ta.frames.length] : ta;
      for (var k = 0; k < fs.tentacles; k++) {
        var cell = st.cells[Math.max(0, st.cells.length - 4 - k * 5)];
        if (cell) R0.sprite(tf, cell.wx + (k - 1) * 2, cell.wy + 2, { level: 12, deform: 'sway', amp: AQ.fx.motion(), t: t + k, knock: false });
      }
    }
  }
  var SCR = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  function scrambleMap(ch, c, r) {
    if (ch === ' ' || !/[A-Za-z]/.test(ch)) return ch;
    return SCR[Math.floor(R0.hash01(c, r, Math.floor(st.t * 8)) * 26)];
  }

  function drawBottle(t) {
    var b = st.bottle;
    var art = AQ.art && AQ.art.bottle;
    var fr = art && art.frames ? art.frames[Math.floor(t * 2) % art.frames.length] : ['[]=-'];
    var y = b.held ? st.hook.y : surfY(b.x) + 0.2;
    R0.sprite(fr, b.x, y, { level: 11, flip: b.vx < 0, knock: true });
  }

  function drawBirds(t) {
    var fz = st.frenzy, cd = codes();
    for (var i = 0; i < 5; i++) {
      var ph = t * 1.3 + i * 1.7;
      var dive = Math.max(0, Math.sin(ph));
      var x = fz.x + Math.sin(ph * 0.7 + i) * 8;
      var y = -st.skyRows * ASPECT + 2 + dive * (st.skyRows * ASPECT - 2) + i % 2;
      R0.textW(dive > 0.6 ? 'v' : '^v^', x, y, 10, { align: 'center' });
    }
    void cd;
  }

  function drawBoat(t) {
    var R = R0;
    placeBoat(t);
    R.sprite(geo.boat, st.boat.x, geo.by, { level: 12, flip: st.dir < 0, knock: true });
    R.sprite(geo.pose, geo.ax, geo.ay, { level: 13, flip: st.dir < 0, knock: true });
    if (geo.art) return; // B's poses already include the rod (it bends across the reel frames)
    // fallback figure: rod from the hand to the tip, bending with tension
    var hx = st.boat.x + st.dir * 1, hy = geo.ay - geo.pose.length * ASPECT / 2 + 1;
    var n = 4;
    for (var i = 1; i <= n; i++) {
      var k = i / n;
      var x = U.lerp(hx, st.tip.x, k), y = U.lerp(hy, st.tip.y, k) + (st.fs ? Math.sin(k * Math.PI) * st.fs.T * 0.8 : 0);
      var dx = st.tip.x - hx, dy = st.tip.y - hy;
      R.glyphW(R.code(AQ.line.glyphFor(dx, dy, 1), st.fs && st.fs.T > 0.85), x, y, 12);
    }
  }

  function drawWake() {
    var w = st.wake;
    if (!w.length) return;
    var cd = codes(), red = AQ.fx.motion() < 1, D = AQ.display;
    for (var i = 0; i < w.length; i++) {
      var p = w[i], k = p.t / p.life;
      var code = p.row ? (k < 0.5 ? cd.dot : cd.comma) : k < 0.25 ? cd.tilde : k < 0.5 ? cd.dash : k < 0.75 ? cd.dot : cd.comma;
      var y = surfY(p.x) + 1 + p.row * ASPECT;
      var lvl = Math.max(2, Math.round((red ? 6 : 11) * (1 - 0.75 * k) - p.row * 3));
      if (!p.row) { // replaces the wave glyph under it
        R0.worldToScreen(p.x, y, tmpP);
        R0.knock(tmpP.x - D.cellW / 2, tmpP.y - D.cellH / 2, D.cellW, D.cellH, 0.7);
      }
      R0.glyphW(code, p.x, y, lvl);
    }
  }

  function drawLine(t) {
    if (st.phase === 'idle' || st.phase === 'aiming') {
      // dangling bit from the tip to the hook
      AQ.line.rasterize(st.rope, st.cells, { tension: 0.1, underwaterLevelMul: 0.8, level: 9 });
    } else {
      var T = st.fs ? st.fs.T : (st.escape && st.escape.breaks ? 0 : st.phase === 'bite' ? 0.9 : 0.3);
      AQ.line.rasterize(st.rope, st.cells, { tension: T, underwaterLevelMul: 0.85, level: 10 });
    }
    var cells = st.cells, cd = codes();
    var T2 = st.fs ? st.fs.T : 0;
    var jit = T2 > 0.85 ? (T2 - 0.85) * 1.2 * AQ.fx.motion() : 0;
    var n = cells.length;
    var D = AQ.display;
    for (var i = 0; i < n; i++) {
      var c = cells[i];
      var code = R0.code(c.ch, c.bold);
      if (st.twitchT > 0 && i === n - 3) code = cd.q;
      if (st.escape && st.escape.breaks) code = (i & 1) ? cd.tilde : cd.comma;
      var x = c.wx, y = c.wy;
      if (jit) { x += (R0.hash01(i, Math.floor(t * 40), 3) - 0.5) * jit; y += (R0.hash01(i, Math.floor(t * 40), 9) - 0.5) * jit; }
      // the line knocks out its cell at .6 so water glyphs never collide
      R0.worldToScreen(x, y, tmpP);
      R0.knock(tmpP.x - D.cellW / 2, tmpP.y - D.cellH / 2, D.cellW, D.cellH, 0.6);
      R0.glyphW(code, x, y, c.level);
    }
    if (st.escape && st.escape.breaks && st.escape.t < 2.5) R0.glyphW(cd.x, st.escape.x, st.escape.y, 15, 'red');
  }

  function drawHook(t) {
    if (st.phase === 'fight' || (st.escape && st.escape.breaks)) return;
    var cd = codes(), h = st.hook;
    var hx = h.x, hy = h.y;
    if (st.nibbleT > 0) { hx += (AQ.rng.global.next() - 0.5) * 0.6; hy += (AQ.rng.global.next() - 0.5) * 0.6; }
    var b = bait();
    var g = (AQ.art && AQ.art.baitGlyph && AQ.art.baitGlyph[b]) || BAIT_GLYPH[b] || 'o';
    var lv = 15;
    // QA: hook + bait at full ink, with a faint pulsing halo so the eye finds them in a busy or dark sea
    if (st.phase !== 'landing' && st.phase !== 'idle' && st.phase !== 'aiming' && !st.bottle.held) {
      var hl = 3 + Math.round(2 * (0.5 + 0.5 * Math.sin(t * 3)) * AQ.fx.motion());
      R0.glyphW(cd.mid, hx - 1.6, hy, hl, 'lantern'); R0.glyphW(cd.mid, hx + 3, hy, hl, 'lantern');
      R0.glyphW(cd.mid, hx + 0.6, hy - 2.2, hl, 'lantern'); R0.glyphW(cd.mid, hx + 0.6, hy + 2.2, hl, 'lantern');
    }
    R0.worldToScreen(hx, hy, tmpP);
    R0.knock(tmpP.x - AQ.display.cellW / 2, tmpP.y - AQ.display.cellH / 2, AQ.display.cellW * (1 + g.length), AQ.display.cellH, 0.8);
    R0.glyphW(R0.code('J', true), hx, hy, lv, 'silver');
    var blv = b === 'luminosa' ? 11 + Math.round(2 + 2 * Math.sin(t * 6)) : (isLure(b) && h.moving && Math.sin(t * 14) > 0 ? 15 : 14);
    if (st.phase !== 'landing') R0.textW(g, hx + 0.8, hy, blv, { align: 'left', bold: true, tint: b === 'luminosa' ? 'glow' : isLure(b) ? 'silver' : 'coral' });
    if (st.bottle.held) return;
    // bite: a bold ! above the hook for the whole window
    if (st.phase === 'bite') {
      R0.glyphW(cd.bang, hx, hy - 3, 15, 'accent');
      var rem = st.bs ? AQ.bite.remaining(st.bs, st.t) : 0;
      if (rem > 0) R0.textW(rem > 0.66 ? '. . .' : rem > 0.33 ? '. .' : '.', hx, hy - 5, 9, { align: 'center', tint: 'accent' });
    }
  }

  function drawAim(t) {
    var pts = st.traj.points, cd = codes();
    for (var i = 1; i < pts.length; i += 1) {
      if (i % 2) continue;
      R0.glyphW((i / 2) % 2 ? cd.mid : cd.dot, pts[i].x, pts[i].y, 6);
    }
    R0.glyphW(cd.x, st.traj.landX, 0.5, 9);
    // power ring around the hand, from the density ramp
    var p = aimPower(), N = 18, hand = rodHand();
    var lit = Math.round(p * N);
    for (var k = 0; k < N; k++) {
      var a = -Math.PI / 2 + k / N * Math.PI * 2;
      var x = hand.x + Math.cos(a) * 4, y = hand.y + Math.sin(a) * 4;
      if (k < lit) R0.glyphW(R0.rampCode('density', 0.2 + 0.8 * p), x, y, 9 + Math.round(p * 4));
      else R0.glyphW(cd.dot, x, y, 3);
    }
  }

  function drawTells(t) {
    var fs = st.fs, f = st.fish, cd = codes();
    var k = fs.state === 'tell' ? fs.next : fs.state;
    var hdY = f.y - 3;
    if (fs.state === 'tell' && (k === 'run' || k === 'jump')) R0.glyphW(cd.bang, f.x, hdY, 15);
    if (fs.state === 'run') {
      var streak = fs.dirX > 0 ? '>>>' : '<<<';
      R0.textW(streak, f.x - fs.dirX * (f.w * 0.5 + 2), f.y, 14, { align: 'center', bold: true });
    }
    if (k === 'jump' && fs.state === 'tell') {
      R0.textW('^^', f.x, surfY(f.x) - 1, 14, { align: 'center', bold: true });
    }
    if (k === 'shake') {
      // ))) / ((( alternating along the line near the fish
      var n = st.cells.length, alt = Math.floor(t * 8) % 2;
      for (var i = 0; i < 3; i++) {
        var c = st.cells[n - 3 - i * 2];
        if (c) R0.glyphW(alt ^ (i & 1) ? cd.paren : cd.lparen, c.wx + 1, c.wy, 14);
      }
    }
    if (k === 'grip' && fs.state === 'grip' && Math.floor(t * 3) % 2 === 0) R0.glyphW(cd.hash, f.x, Math.min(floorY(f.x) - 0.5, f.y + 2), 13);
  }

  // ---------------------------------------------------------------- input
  function inScene() { return AQ.scenes.current === 'fishing' && !AQ.scenes.paused && !st.cardOpen; }
  function onDown(p) {
    if (!inScene()) return;
    st.press.on = true; st.press.at = st.t; st.press.x = p.x; st.press.y = p.y; st.press.moved = false; st.press.type = p.source || 'mouse'; st.press.lastX = p.x;
    if (st.phase === 'idle') beginAim(p.x, p.y, false);
    else if (st.phase === 'nibble' || st.phase === 'bite') strike();
  }
  function onMove(p) {
    if (!inScene()) return;
    if (st.press.on && Math.abs(p.x - st.press.x) + Math.abs(p.y - st.press.y) > 10) st.press.moved = true;
    if (st.phase === 'aiming' && st.aim.on && !st.aim.key) { st.aim.x = p.x; st.aim.y = p.y; }
    if (st.phase === 'fight' && st.press.on && st.press.type === 'touch') {
      var dx = p.x - st.press.lastX;
      st.rod = U.clamp(st.rod + dx / (0.3 * AQ.display.width), -1, 1);
    }
    st.press.lastX = p.x;
  }
  function onUp(p) {
    var wasOn = st.press.on;
    st.press.on = false;
    if (!inScene() || !wasOn) return;
    if (st.phase === 'aiming' && !st.aim.key) { st.aim.x = p.x; st.aim.y = p.y; cast(); return; }
    var dur = st.t - st.press.at;
    if (dur < 0.25 && !st.press.moved) {
      if (st.phase === 'sinking') stopHook('player');
      else if (st.phase === 'waiting') { setPhase('sinking'); st.sinkT = 0.5; }
    }
  }
  var primAt = 0;
  function onPrimary(e) {
    if (!inScene()) return;
    if (e.phase === 'down') {
      primAt = st.t;
      if (st.phase === 'idle') beginAim(0, 0, true);
      else if (st.phase === 'sinking') stopHook('player');
      else if (st.phase === 'nibble' || st.phase === 'bite') strike();
    } else {
      if (st.phase === 'aiming' && st.aim.key) cast();
      else if (st.phase === 'waiting' && st.t - primAt < 0.2 && st.phaseT > 0.3 && e.source !== 'virtual') { setPhase('sinking'); st.sinkT = 0.5; }
    }
  }
  AQ.input.on('down', onDown);
  AQ.input.on('move', onMove);
  AQ.input.on('up', onUp);
  AQ.input.on('action:primary', onPrimary);
  AQ.input.on('action:retrieve', function () { if (inScene()) retrieve(); });
  // LB / RB (and Q / E): a sailing nudge
  AQ.input.on('action:prev', function () { if (inScene() && !AQ.input.blocked) sailEdge(-1); });
  AQ.input.on('action:next', function () { if (inScene() && !AQ.input.blocked) sailEdge(1); });

  // ---------------------------------------------------------------- lifecycle
  function enter(params) {
    var p = params || {};
    st.zoneId = p.zone || (S() && S().player && S().player.zone) || 'baia';
    st.zone = safe(function () { return AQ.zones.get(st.zoneId); }, null) || { id: st.zoneId, depth: 70, mPerUnit: 0.17, popFactor: 1, frenzy: true, features: [] };
    st.depth = st.zone.depth;
    safe(function () { if (AQ.game.setZone) AQ.game.setZone(st.zoneId); });
    var seed = ((S() && S().meta && S().meta.seed) || 1) ^ AQ.rng.hash(st.zoneId);
    st.rng = AQ.rng.create((seed ^ (U.now() & 0xffff)) >>> 0);
    env.rng = st.rng;
    st.gear = gear();
    st.t = 0; st.list = []; st.sights = []; st.seen = {}; st.engaged = null; st.bs = null; st.fs = null; st.fish = null;
    st.escape = null; st.landing = null; st.cardOpen = false; st.debugAuto = false; st.debugFast = 1;
    st.frenzy.on = false; st.frenzy.next = st.rng.range(240, 420);
    st.bottle.on = false; st.bottle.held = false; st.bottle.next = st.rng.range(150, 300);
    st.legend.state = 'none'; st.legend.returnAt = 0; st.legend.checkT = 3; st.sightNext = 30;
    st.stubCreatures = /^function\s*\([^)]*\)\s*\{\s*\}$/.test(String(AQ.creatures.update).trim());
    st.rope = st.rope || AQ.line.createRope(24);
    layoutBoat();
    // the boat starts where it was left in this zone (this session), facing the open water
    st.sail = AQ.sail.create(F._pos && typeof F._pos[st.zoneId] === 'number' ? F._pos[st.zoneId] : 0);
    st.boat.x = st.sail.x;
    st.sailBtn.l = st.sailBtn.r = false; st.sailKeyPrev = 0; st.sailLatch = true; st.sailQueue = 0; st.fastRetrieve = false;
    st.wake = []; st.wakeT = 0; st.rippleT = 0; st.waitT = 0; st.sailUsed = false;
    st.cam.dirS = st.dir; st.cam.vx = 0; st.hook.active = false; st.phase = 'idle';
    st.cam.x = camTargetX();
    env.bounds.x0 = st.cam.x - 12; env.bounds.x1 = st.cam.x + st.cols + 12; st.restT = 1;
    st.cam.y = -st.skyRows * ASPECT; st.cam.vy = 0;
    BG.setup(st.zone, st.cols, seed, st.cam.x);
    env.covers = BG.covers();
    AQ.fx.surface.reset(st.cols);
    syncView();
    st.tutorial = !!p.tutorial;
    if (st.tutorial && !st.scripted) F.script(defaultTutorialScript());
    backToIdle();
    for (var i = 0; i < 6; i++) spawnTick(0, true);
    if (st.script && st.script.forceSpawn) forceSpawn(st.script.forceSpawn);
    st.audioT = 0; st.ambT = 0;
  }
  function exit() {
    if (st.sail) { F._pos = F._pos || {}; F._pos[st.zoneId] = Math.round(st.sail.x); }
    st.sailBtn.l = st.sailBtn.r = false; st.wake = [];
    safe(function () { AQ.audio.setTension(null); AQ.audio.reel(false, 0); });
    if (st.frenzy.on) { st.frenzy.on = false; emit('frenzy:end', { zone: st.zoneId }); }
    st.list = []; st.fs = null; st.fish = null; st.engaged = null;
    F.phase = 'idle'; st.phase = 'idle';
    if (st.debugResolve) { var d = st.debugResolve; st.debugResolve = null; d(null); }
  }
  // The world is in world columns (the seabed does not depend on the view width): a resize only re-frames the view.
  function resize(m) {
    var old = st.cols;
    layoutBoat();
    if (!old || !st.rope) return;
    if (st.fs) st.fs.viewCols = st.cols;
    if (old !== st.cols) {
      st.cam.x = camTargetX(); st.cam.vx = 0;
      AQ.fx.surface.reset(st.cols);
    }
    syncView();
    env.covers = BG.covers();
    if (st.fs) st.fs.covers = env.covers;
  }

  function defaultTutorialScript() {
    return {
      forceSpawn: [{ sp: 'manjuba', n: 6, dx: 11, depthFrac: 0.3 }],
      autoStopDepth: 0.3 * st.depth,
      biteWindow: 2.0,
      nibbles: 2, // QA: always nibble twice first, so "wait…" is taught before the strike
      fightOverride: { power: 0.55, stamina: 3.5, runs: [{ at: 2.5, dir: -1 }] },
      noEscape: true
    };
  }
  function forceSpawn(list) {
    for (var i = 0; i < list.length; i++) {
      var f = list[i];
      var n = f.n || 1;
      var x = f.x !== undefined ? f.x : st.boat.x + st.dir * (f.dx || st.rng.range(8, 14));
      var y = (f.depthFrac !== undefined ? f.depthFrac : 0.3) * st.depth;
      for (var k = 0; k < n; k++) makeCreature(f.sp, x + st.rng.range(-3, 3), y + st.rng.range(-1.5, 1.5), st.rng.next() < 0.5 ? 1 : -1);
    }
  }

  // ---------------------------------------------------------------- public API (§15.5)
  F.phase = 'idle';
  // script(opts|null): tutorial / scripted fishing. opts: {forceSpawn:[{sp, x?, dx?, n?, depthFrac}], autoStopDepth (u),
  // biteWindow (s), fightOverride:{power, stamina, runs:[{at, dir}]}, noEscape}. Cleared after the next landed catch.
  F.script = function (opts) {
    st.script = opts || null;
    st.scripted = !!opts;
    if (opts && AQ.scenes.current === 'fishing' && st.rope && opts.forceSpawn && st.t > 0) forceSpawn(opts.forceSpawn);
  };
  // anchor(name) → {x, y} CSS px (stage-relative) for hints: 'boat' | 'hook' | 'fish' | 'tension' | 'reel'
  F.anchor = function (name) {
    if (AQ.scenes.current !== 'fishing' || !st.rope) return null;
    var o = {};
    if (name === 'boat') return R0.worldToScreen(st.boat.x, -4, o);
    if (name === 'surface') return R0.worldToScreen(st.boat.x, 2.5, o);
    if (name === 'hook') return R0.worldToScreen(st.hook.x, st.hook.y, o);
    if (name === 'fish') return st.fish ? R0.worldToScreen(st.fish.x, st.fish.y - 3, o) : (st.engaged ? R0.worldToScreen(st.engaged.x, st.engaged.y, o) : null);
    if (name === 'tension') return st.phase === 'fight' ? HUD.anchorTension() : null;
    if (name === 'reel') return R0.worldToScreen(st.tip.x, st.tip.y, o);
    return null;
  };
  // debugSpawn(id): a creature of that species near the hook (or the boat).
  F.debugSpawn = function (id) {
    if (AQ.scenes.current !== 'fishing' || !spDef(id)) return null;
    var x = st.hook.active ? st.hook.x + 6 : st.boat.x + st.dir * 12;
    var sp = spDef(id);
    var y = st.hook.active ? st.hook.y : U.clamp(bandY(sp, st.rng), 3, floorY(x) - 2);
    return makeCreature(id, x, y, -st.dir);
  };
  // debugLand(id, opts?{choice}) → Promise<resolveCatch result>: hooks one at the hook and fights it on autopilot
  // (fast-forward), then resolves the catch without the card ('sell'; tinteira 'release').
  F.debugLand = function (id, opts) {
    if (AQ.scenes.current !== 'fishing' || !spDef(id)) return Promise.reject(new Error('fishing scene / species'));
    if (st.phase === 'fight' || st.phase === 'landing') return Promise.reject(new Error('busy'));
    return new Promise(function (resolve) {
      if (st.engaged) disengage(null);
      st.hook.active = true;
      if (st.phase === 'idle' || st.phase === 'aiming' || st.phase === 'flying') {
        st.hook.x = U.clamp(st.boat.x + st.dir * 14, viewX0() + 3, viewX1() - 3);
        st.hook.y = Math.min(floorY(st.hook.x) - 2, st.depth * (spDef(id).depth[0] + spDef(id).depth[1]) / 2);
        setPhase('waiting');
      }
      var c = makeCreature(id, st.hook.x, st.hook.y, -st.dir);
      st.debugAuto = true; st.debugFast = (opts && opts.fast) || 8; st.debugResolve = resolve; st.debugChoice = opts && opts.choice;
      startFight(c);
    });
  };
  // Sail buttons (E's HUD): press/release a direction (−1 left, +1 right); release(0) lets go of both.
  // A press is a nudge, a hold sails; with the line out it reels in fast first. → whether the press did something.
  F.sailPress = function (dir) {
    if (!inScene() || !st.rope) return false;
    var d = dir < 0 ? -1 : 1;
    if (d < 0) st.sailBtn.l = true; else st.sailBtn.r = true;
    return sailEdge(d);
  };
  F.sailRelease = function (dir) {
    if (!dir || dir < 0) st.sailBtn.l = false;
    if (!dir || dir > 0) st.sailBtn.r = false;
  };
  // whether the sail buttons should show: not in the fight, landing or a card, nor during the tutorial's first catch
  F.sailShown = function () {
    if (AQ.scenes.current !== 'fishing' || !st.rope || st.cardOpen || sailLocked()) return false;
    return st.phase !== 'fight' && st.phase !== 'landing';
  };
  F.state = st; // read-only view for debugging

  AQ.scenes.register('fishing', {
    enter: enter, exit: exit, update: update, drawBg: drawBg, draw: draw, resize: resize,
    onPause: function () { safe(function () { AQ.audio.reel(false, 0); }); st.press.on = false; st.sailBtn.l = st.sailBtn.r = false; }
  });
})(window.AQ);
