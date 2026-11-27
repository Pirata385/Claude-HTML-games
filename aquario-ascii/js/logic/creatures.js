// Água-Tinta — creature behaviour, steering and drawing (owner B). Pure at load time (§6.8, §4.5, §15.5).
//
// Positions are the CENTRE of the sprite box in world units (as AQ.render.sprite). Creatures face right in sprite
// data; dir = -1 draws the mirrored frame. update() never allocates in the steady state (scratch values live in
// module variables; per-creature state lives in c.data, created once in create()).
//
// States (c.state): 'swim' (behaviour), 'buried' (burrow), 'investigate', 'nibble', 'bite', 'hooked', 'flee',
// 'fading', 'gone'. Poses (c.pose, set by C/D; or automatic): keys of sprite.extra ('inflate', 'jet', 'ink', 'hide',
// 'roll'). update() removes creatures that left the scene ('gone') from the list after onEvent('leave', c,
// {reason:'despawn'}). Engagement: onEvent('notice'|'nibble'|'bite'|'leave'|'eat'|'splash', c, data).
(function (AQ) {
  'use strict';

  var U = AQ.util, ASPECT = AQ.ASPECT;
  var SENSE = { school: 10, dart: 12, cruise: 14, lurk: 6, drift: 4, crawl: 6, burrow: 5, hover: 5, leap: 10, ambient: 0 };
  var SPEED = { school: 1, dart: 0.7, cruise: 0.9, lurk: 0.5, drift: 0.32, crawl: 0.5, burrow: 0.6, hover: 0.35, leap: 1.1, ambient: 1 };
  var LURES = { colher: 1, jig: 1 };
  var SIZE_I = { XS: 0, S: 1, M: 2, L: 3, XL: 4, XXL: 5 };
  var G_LEAP = 30;          // u/s² gravity for leapers (glide uses less)
  var BITE_HOLD = 6;        // s a biting fish waits on the hook before giving up (C normally resolves sooner)
  var FADE = 0.4;           // s dissolve on spawn / fade-out removal
  var DESPAWN = 20;         // u past the view edge
  var LETTERS = 'AaHIiMmNnOoTUuVvWwXxYoAiT';

  var uidSeq = 0, schoolSeq = 0;

  // scratch (no per-frame allocation)
  var TX = 0, TY = 0, TK = 1;
  var EATEN = [];
  var DEF_BOUNDS = { x0: 0, y0: 0, x1: 80, y1: 60 };

  function spOf(id) { return AQ.species.get(id) || (AQ.sightings && AQ.sightings.get(id)) || null; }
  function rr(d, a, b) { return a + d.rng.next() * (b - a); }
  function call(env, type, c, data) {
    if (env && env.onEvent) { try { env.onEvent(type, c, data); } catch (e) { if (typeof console !== 'undefined') console.error(e); } }
  }

  function cruiseSpeed(sp, beh) {
    var V = sp ? (sp.fight ? sp.fight.speed : (sp.speed || 3)) : 3;
    if (beh === 'ambient') return sp && sp.speed ? sp.speed : U.clamp(0.25 * V, 1, 4);
    return U.clamp(1 + 0.35 * V, 1, 7) * (SPEED[beh] || 1);
  }

  // ------------------------------------------------------------------------------------------------ create
  // create(id, opts:{x, y, dir, mode:'wild'|'tank'|'title', specimen?, fish?, juvenile?, school?, buried?}, rng)
  function create(id, opts, rng) {
    var o = opts || {}, r = rng || AQ.rng.global;
    var sp = spOf(id);
    var isSight = !!(sp && !AQ.species.get(id));
    var beh = isSight ? 'ambient' : (sp ? sp.behavior : 'cruise');
    var mode = o.mode || 'wild';
    if (mode !== 'wild' && beh === 'leap') beh = 'cruise';
    if (mode === 'tank' && beh === 'ambient') beh = 'cruise';
    var juvenile = !!(o.juvenile || (o.fish && typeof o.fish.growth === 'number' && o.fish.growth < 0.5));
    var sd = AQ.sprites.get(juvenile ? '_alevino' : (sp ? sp.sprite : id));
    var f0 = sd.frames[0];
    var dir = o.dir === -1 ? -1 : o.dir === 1 ? 1 : (r.next() < 0.5 ? -1 : 1);
    var c = {
      uid: ++uidSeq, sp: id, x: o.x || 0, y: o.y || 0, vx: 0, vy: 0, dir: dir,
      w: f0.length ? f0[0].length : 1, h: f0.length || 1, frame: 0, t: r.next() * 20, state: 'swim', alpha: 1,
      specimen: o.specimen || null, fishUid: o.fish ? o.fish.uid : null, hooked: false, pose: null,
      data: null
    };
    var cs = cruiseSpeed(sp, beh) * (juvenile ? 0.8 : 1);
    var d = c.data = {
      species: sp, sd: sd, beh: beh, mode: mode, juvenile: juvenile, cs: cs, sight: isSight,
      rng: r, seed: r.next() * 1000, age: 0,
      sense: beh === 'ambient' && !isSight ? 14 : (SENSE[beh] || 0),
      hdx: dir, hdy: 0, turnT: r.range(6, 15),
      homeX: c.x, homeY: c.y, homeT: 0, anchored: false,
      burstT: 0, nextBurst: r.range(1, 3), bvx: 0, bvy: 0,
      walking: true, walkT: r.range(2, 5), hideIdle: false,
      buryT: r.range(5, 10),
      leapT: r.range(3, 8), leaping: false, above: false,
      travel: dir, leaveAt: r.range(25, 70),
      ignoreT: 0, noticeCool: 0, fleeT: 0, fleeX: c.x,
      invT: 0, circA: 0, circDir: r.next() < 0.5 ? -1 : 1, loseT: 0, nibLeft: 0, nibGap: 0, biteT: 0, bitten: false,
      engDir: 1, staticT: 0,
      flipT: 0, fAcc: r.next() * 4, fadeT: 0,
      shimT: r.range(0.6, 1.2), shimOn: 0, shimC: -1, shimR: -1,
      school: null, eatCool: r.range(0, 1.5), alarmT: 0, scramble: 0,
      lastX: c.x, lastY: c.y, autoPose: null,
      path: sp && sp.path ? sp.path : 'pass', vis: 1, speed: 0
    };
    if (beh === 'school') {
      var s = o.school || { id: ++schoolSeq, members: [] };
      s.members.push(c);
      d.school = s;
    }
    if (beh === 'burrow' && o.buried) c.state = 'buried';
    if (beh === 'ambient' && isSight) d.leaveAt = 0;
    if (mode !== 'wild') d.leaveAt = Infinity;
    if (beh === 'ambient') { d.homeY = c.y; }
    return c;
  }

  // createSchool(id, n, opts, rng) → Creature[] sharing one school (spread around opts.x/opts.y)
  function createSchool(id, n, opts, rng) {
    var o = opts || {}, r = rng || AQ.rng.global, out = [];
    var school = { id: ++schoolSeq, members: [] };
    var dir = o.dir === -1 ? -1 : o.dir === 1 ? 1 : (r.next() < 0.5 ? -1 : 1);
    for (var i = 0; i < n; i++) {
      var oo = {};
      for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) oo[k] = o[k];
      oo.school = school; oo.dir = dir;
      oo.x = (o.x || 0) + r.range(-1, 1) * Math.max(2, n * 0.8) - dir * i * 0.6;
      oo.y = (o.y || 0) + r.range(-1, 1) * Math.max(3, n * 1.1);
      out.push(create(id, oo, r));
    }
    return out;
  }

  function setJuvenile(c, on) {
    var d = c.data, sp = d.species;
    if (d.juvenile === !!on) return;
    d.juvenile = !!on;
    d.sd = AQ.sprites.get(on ? '_alevino' : (sp ? sp.sprite : c.sp));
    var f0 = d.sd.frames[0];
    c.w = f0[0].length; c.h = f0.length;
    d.cs = cruiseSpeed(sp, d.beh) * (on ? 0.8 : 1);
  }

  // ------------------------------------------------------------------------------------------------ helpers
  function bandOf(c, d, env, B, out) {
    var sp = d.species, top = env.surfaceY !== undefined ? env.surfaceY : B.y0;
    var H = env.depth || (B.y1 - top);
    var d0 = sp && sp.depth ? sp.depth[0] : 0.2, d1 = sp && sp.depth ? sp.depth[1] : 0.8;
    if (d.mode !== 'wild') { d0 = Math.max(0, d0 - 0.2); d1 = Math.min(1, d1 + 0.2); }
    var hw = c.h * ASPECT / 2;
    var y0 = top + d0 * H + hw + 0.3, y1 = top + d1 * H - hw;
    if (y1 < y0) { var m = (y0 + y1) / 2; y0 = m; y1 = m; }
    out[0] = y0; out[1] = y1;
    return out;
  }
  var BAND = [0, 0];

  function floorAt(env, B, x) { return env.floorY ? env.floorY(x) : B.y1; }

  function edgeTurn(c, d, B) {
    if (d.mode === 'title') return;
    if (d.mode === 'wild' && d.age >= d.leaveAt) { d.hdx = d.travel; return; }
    var m = c.w / 2 + 2;
    if (c.x < B.x0 + m && d.hdx < 0) d.hdx = 1;
    else if (c.x > B.x1 - m && d.hdx > 0) d.hdx = -1;
  }

  function pickAnchor(c, d, env, B) {
    var covers = env.covers, best = null, bestD = Infinity, want = d.beh === 'hover' ? 'plants' : null;
    var lurkTank = d.mode === 'tank' && d.beh === 'lurk';
    if (covers && covers.length) {
      for (var i = 0; i < covers.length; i++) {
        var cv = covers[i];
        if (lurkTank && !coverHas(cv, 'rocks') && !coverHas(cv, 'cave')) continue;
        if (want && d.mode === 'tank' && !coverHas(cv, want) && !coverHas(cv, 'coral')) continue;
        var cx = (cv.x0 + cv.x1) / 2, cy = (cv.y0 + cv.y1) / 2;
        var dd = Math.abs(cx - c.x) + Math.abs(cy - c.y) * 0.5 + d.rng.next() * 12;
        if (dd < bestD) { bestD = dd; best = cv; }
      }
    }
    bandOf(c, d, env, B, BAND);
    if (best) {
      d.homeX = U.clamp(best.x0 + d.rng.next() * (best.x1 - best.x0), B.x0 + c.w / 2, B.x1 - c.w / 2);
      d.homeY = U.clamp((best.y0 + best.y1) / 2 + rr(d, -2, 1), BAND[0], BAND[1]);
    } else {
      d.homeX = U.clamp(c.x + rr(d, -10, 10), B.x0 + c.w / 2 + 1, B.x1 - c.w / 2 - 1);
      d.homeY = d.beh === 'lurk' ? BAND[1] - rr(d, 0, 2) : rr(d, BAND[0], BAND[1]);
    }
    d.anchored = true;
    d.homeT = rr(d, 15, 35);
  }
  function coverHas(cv, tag) {
    if (cv.kind === tag) return true;
    var t = cv.tags;
    return !!(t && t.indexOf && t.indexOf(tag) >= 0);
  }

  function mouthX(c) { return c.x + c.dir * (c.w / 2 - 0.3); }

  // mouth(c, out?) → {x, y}: where the hook sits on the fish (right edge when facing right)
  function mouth(c, out) {
    var o = out || {};
    o.x = mouthX(c); o.y = c.y;
    return o;
  }

  // ------------------------------------------------------------------------------------------------ behaviours
  function wander(c, d, dt, cs) {
    d.turnT -= dt;
    if (d.turnT <= 0) { d.turnT = rr(d, 6, 15); if (d.rng.next() < 0.35) d.hdx = -d.hdx; }
    d.hdy = (U.noise1(d.seed + c.t * 0.15) - 0.5) * 0.8;
    TX = d.hdx * cs; TY = d.hdy * cs * 0.5; TK = 1.2;
  }

  function stSchool(c, d, dt, cs, env, B) {
    var s = d.school, mem = s ? s.members : null;
    if (!mem || mem.length < 2 || mem[0] === c) { edgeTurn(c, d, B); wander(c, d, dt, cs); TK = 1; return; }
    var leader = mem[0], n = 0, avx = 0, avy = 0, px = 0, py = 0, sx = 0, sy = 0;
    // QA: box-shaped separation (sprites are wide and short), so schools spread in layers instead of piling up
    var rx = Math.max(2.5, c.w * 1.1), ry = Math.max(2.5, c.h * ASPECT * 1.2);
    for (var i = 0; i < mem.length; i++) {
      var o = mem[i];
      if (o === c) continue;
      var dx = c.x - o.x, dy = c.y - o.y, adx = dx < 0 ? -dx : dx, ady = dy < 0 ? -dy : dy;
      if (adx < rx && ady < ry) {
        var ox = 1 - adx / rx, oy = 1 - ady / ry;
        var syn = ady > 1e-3 ? (dy > 0 ? 1 : -1) : ((c.uid & 1) ? 1 : -1);
        sy += syn * oy * (adx < rx * 0.8 ? 1.6 : 0.6);
        sx += (adx > 1e-3 ? (dx > 0 ? 1 : -1) : ((c.uid & 2) ? 1 : -1)) * ox * 1.1;
      }
      if (n >= 7) continue;
      n++;
      avx += o.vx; avy += o.vy; px += o.x; py += o.y;
    }
    avx /= n; avy /= n; px /= n; py /= n;
    var loose = d.mode === 'tank' ? 0.45 : 1;
    TX = avx * 0.6 + (px - c.x) * 0.3 * loose + sx * cs * 2 + (leader.x - c.x) * 0.1 * loose + leader.vx * 0.3;
    TY = avy * 0.6 + (py - c.y) * 0.3 * loose + sy * cs * 2 + (leader.y - c.y) * 0.1 * loose;
    var m = Math.sqrt(TX * TX + TY * TY), cap = cs * 1.5;
    if (m > cap) { TX *= cap / m; TY *= cap / m; }
    TK = 2.2;
  }

  function stDart(c, d, dt, cs, env, B) {
    d.burstT -= dt; d.nextBurst -= dt;
    if (d.burstT > 0) { TX = d.bvx; TY = d.bvy; TK = 9; d.autoPose = 'jet'; return; }
    d.autoPose = null;
    if (d.nextBurst <= 0) {
      d.nextBurst = rr(d, 1, 3); d.burstT = 0.3;
      if (d.rng.next() < 0.25) d.hdx = -d.hdx;
      edgeTurn(c, d, B);
      var a = (d.rng.next() - 0.5) * 0.9;
      d.bvx = d.hdx * Math.cos(a) * cs * 3; d.bvy = Math.sin(a) * cs * 1.5;
    }
    edgeTurn(c, d, B);
    TX = d.hdx * cs * 0.3; TY = (U.noise1(d.seed + c.t * 0.3) - 0.5) * cs * 0.4; TK = 0.9;
  }

  function stCruise(c, d, dt, cs, env, B) {
    edgeTurn(c, d, B);
    wander(c, d, dt, cs);
    if (d.mode === 'tank') { // laps: hold course until the glass, then a wide turn
      var m = c.w / 2 + 4;
      if (c.x < B.x0 + m && d.hdx < 0) d.hdx = 1; else if (c.x > B.x1 - m && d.hdx > 0) d.hdx = -1;
      d.turnT = 99;
    }
  }

  function stLurk(c, d, dt, cs, env, B) {
    if (d.mode === 'wild' && d.age >= d.leaveAt) { edgeTurn(c, d, B); wander(c, d, dt, cs); return; }
    d.homeT -= dt;
    if (!d.anchored || d.homeT <= 0) pickAnchor(c, d, env, B);
    var dx = d.homeX - c.x, dy = d.homeY + Math.sin(c.t * 0.7 + d.seed) * 0.4 - c.y;
    TX = U.clamp(dx * 0.7, -cs, cs); TY = U.clamp(dy * 0.7, -cs, cs); TK = 1.4;
    if (Math.abs(dx) < 1.5) d.hdx = c.dir;
  }

  function stDrift(c, d, dt, cs, env, B) {
    var sp = d.species;
    var cur = env.current !== undefined ? env.current : (U.noise1(d.seed * 0.1 + c.t * 0.05) - 0.5) * 0.7 + d.travel * 0.4;
    if (d.mode === 'tank') {
      cur = (U.noise1(d.seed * 0.1 + c.t * 0.07) - 0.5) * 1.6;
      var m = c.w / 2 + 1;
      if (c.x < B.x0 + m) cur = Math.abs(cur) + 0.3; else if (c.x > B.x1 - m) cur = -Math.abs(cur) - 0.3;
    } else if (d.mode === 'wild' && d.age >= d.leaveAt) cur = d.travel;
    TX = cur * cs;
    TY = Math.sin(c.t * 1.3 + d.seed) * cs * 0.7;
    TK = 1.1;
    if (sp && sp.floats && d.mode === 'wild') TY = 0;
    d.hdx = TX >= 0 ? 1 : -1;
  }

  function stCrawl(c, d, dt, cs, env, B) {
    d.walkT -= dt;
    if (d.walkT <= 0) {
      d.walking = !d.walking;
      d.walkT = d.walking ? rr(d, 2, 5) : rr(d, 1, 3.5);
      if (d.walking && d.rng.next() < 0.4) d.hdx = -d.hdx;
      d.hideIdle = !d.walking && d.rng.next() < 0.5;
    }
    edgeTurn(c, d, B);
    if (d.mode === 'wild' && d.age >= d.leaveAt) d.walking = true;
    TX = d.walking ? d.hdx * cs : 0; TY = 0; TK = 4;
    d.autoPose = d.hideIdle && d.sd.extra.hide ? 'hide' : null;
  }

  function stBurrow(c, d, dt, cs, env, B) {
    if (c.state === 'buried') {
      TX = 0; TY = 0; TK = 6;
      d.buryT -= dt;
      if (d.buryT <= 0 || (d.mode === 'wild' && d.age >= d.leaveAt)) { c.state = 'swim'; d.buryT = rr(d, 4, 9); }
      return;
    }
    edgeTurn(c, d, B);
    wander(c, d, dt, cs * 0.8);
    var fy = floorAt(env, B, c.x) - c.h * ASPECT / 2 - 1.5;
    TY = (fy - c.y) * 0.8;
    d.buryT -= dt;
    if (d.buryT <= 0 && c.state === 'swim' && !(d.mode === 'wild' && d.age >= d.leaveAt) && Math.abs(fy - c.y) < 2) {
      c.state = 'buried'; d.buryT = rr(d, 6, 15);
    }
  }

  function stHover(c, d, dt, cs, env, B) {
    d.homeT -= dt;
    if (!d.anchored || d.homeT <= 0) {
      if (d.mode === 'tank' && env.covers && env.covers.length) pickAnchor(c, d, env, B);
      else {
        bandOf(c, d, env, B, BAND);
        d.homeX = d.anchored ? U.clamp(c.x + rr(d, -8, 8), B.x0 + c.w, B.x1 - c.w) : c.x;
        d.homeY = d.anchored ? rr(d, BAND[0], BAND[1]) : U.clamp(c.y, BAND[0], BAND[1]);
        d.anchored = true; d.homeT = rr(d, 12, 30);
      }
    }
    if (d.mode === 'wild' && d.age >= d.leaveAt) d.homeX += d.travel * cs * 0.8 * dt;
    else if (d.mode === 'wild' && (d.homeX < B.x0 + 2 || d.homeX > B.x1 - 2)) d.homeX = U.clamp(d.homeX, B.x0 + c.w, B.x1 - c.w);
    var vert = d.species && d.species.id === 'cavalo';
    var dx = d.homeX + Math.sin(c.t * 0.45 + d.seed) * (vert ? 0.8 : 2.2) - c.x;
    var dy = d.homeY + Math.sin(c.t * (vert ? 1.1 : 0.8) + d.seed) * (vert ? 1.6 : 1) - c.y;
    TX = U.clamp(dx * 0.7, -cs * 1.5, cs * 1.5); TY = U.clamp(dy * 0.7, -cs * 1.5, cs * 1.5); TK = 1.6;
  }

  function stLeap(c, d, dt, cs, env, B) {
    var top = env.surfaceY !== undefined ? env.surfaceY : B.y0;
    if (d.leaping) { TK = 0; return; }
    edgeTurn(c, d, B);
    wander(c, d, dt, cs);
    TY = (top + c.h * ASPECT / 2 + 2 + Math.sin(c.t * 0.6 + d.seed) - c.y) * 0.8;
    d.leapT -= dt;
    if (d.leapT <= 0 && c.y < top + 8 && c.state === 'swim') {
      d.leapT = rr(d, 4, 9);
      d.leaping = true;
      var hAir = rr(d, 4, 7), drop = Math.max(0, c.y - top);
      c.vy = -Math.sqrt(2 * G_LEAP * (hAir + drop));
      c.vx = d.hdx * cs * 1.6;
    }
  }

  function stAmbient(c, d, dt, cs, env, B) {
    var top = env.surfaceY !== undefined ? env.surfaceY : B.y0;
    TX = d.hdx * cs; TK = 1;
    if (d.path === 'leap' && d.mode === 'wild') {
      // dolphins: scripted arcs over the surface
      var P = 2.4, ph = U.wrap(c.t / P + d.seed, 1), base = top + c.h * ASPECT / 2 + 2;
      var ty = ph < 0.45 ? base - Math.sin(ph / 0.45 * Math.PI) * (6 + c.h) : base + Math.sin((ph - 0.45) / 0.55 * Math.PI) * 2.5;
      var wasAbove = d.above;
      d.above = ty - c.h * ASPECT / 2 < top;
      if (d.above !== wasAbove) call(env, 'splash', c, { x: c.x, y: top, up: d.above });
      TY = (ty - c.y) * 10; TK = 12;
      return;
    }
    TY = (d.homeY + Math.sin(c.t * 0.4 + d.seed) * 1.5 - c.y) * 0.8;
  }

  var STEER = { school: stSchool, dart: stDart, cruise: stCruise, lurk: stLurk, drift: stDrift, crawl: stCrawl,
    burrow: stBurrow, hover: stHover, leap: stLeap, ambient: stAmbient };

  // ------------------------------------------------------------------------------------------------ hook logic
  function noticeRadius(c, hook, env) {
    var d = c.data, sp = d.species;
    if (!sp || !sp.baits || !hook) return 0;
    var aff = sp.baits[hook.bait] || 0;
    if (!aff) return 0;
    var isLure = !!LURES[hook.bait];
    var dark = false;
    if (hook.bait === 'luminosa') dark = env.dark !== undefined ? !!env.dark : (env.isDark ? !!env.isDark(c.x, c.y) : false);
    return d.sense * aff * (hook.moving && isLure ? 1.6 : 1) * (dark ? 1.5 : 1) * (env.frenzy ? 2 : 1);
  }

  function tryNotice(c, d, dt, hook, env) {
    if (d.ignoreT > 0 || d.noticeCool > 0 || d.leaping) return false;
    var r = noticeRadius(c, hook, env);
    if (r <= 0) return false;
    var dx = hook.x - mouthX(c), dy = hook.y - c.y;
    if (dx * dx + dy * dy > r * r) return false;
    var aff = d.species.baits[hook.bait] || 0;
    var pen = LURES[hook.bait] && !hook.moving ? 0.2 : 1;
    var p = Math.min(0.95, 0.6 * aff * pen);
    if (d.rng.next() >= 1 - Math.pow(1 - p, dt)) return false;
    c.state = 'investigate';
    d.invT = rr(d, 0.5, 1.5); d.loseT = 0; d.staticT = 0;
    d.circA = Math.atan2(c.y - hook.y, c.x - hook.x);
    d.autoPose = null;
    call(env, 'notice', c, { sp: c.sp });
    return true;
  }

  function disengage(c, d, env, reason) {
    c.state = 'swim';
    d.noticeCool = rr(d, 2, 4);
    d.hdx = c.dir;
    if (reason) call(env, 'leave', c, { reason: reason, sp: c.sp });
  }

  // Steering while engaged with the hook. Returns true when it set TX/TY/TK.
  function stEngaged(c, d, dt, cs, hook, env, engaged) {
    var isLure = !!LURES[hook.bait];
    var still = isLure && !hook.moving;
    var crawl = d.beh === 'crawl';
    if (c.state === 'investigate') {
      if (still) d.staticT += dt; else d.staticT = 0;
      var rC = 3 + Math.min(4, c.w * 0.25) + c.w * 0.3;
      d.circA += d.circDir * (cs * 0.6 / rC) * dt;
      var tx = hook.x + Math.cos(d.circA) * rC, ty = hook.y + Math.sin(d.circA) * rC * 0.6;
      var sp6 = cs * (d.beh === 'lurk' ? 1.6 : 0.6) + 0.5;
      TX = U.clamp((tx - c.x) * 1.2, -sp6 * 2, sp6 * 2); TY = crawl ? 0 : U.clamp((ty - c.y) * 1.2, -sp6 * 2, sp6 * 2); TK = 2.5;
      if (!still) d.invT -= dt;
      if (engaged && engaged !== c) d.loseT += dt;
      if (d.loseT > 5 || d.staticT > 3) { disengage(c, d, env, null); return true; }
      if (d.invT <= 0 && !engaged) {
        c.state = 'nibble';
        d.nibLeft = env.frenzy ? 0 : Math.max(env.minNibbles || 0, d.rng.int((d.species.wariness || 0) + 1));
        d.nibGap = 0; d.biteT = 0; d.bitten = false;
        d.engDir = c.x < hook.x ? 1 : -1;
      }
      return true;
    }
    // nibble / bite: approach so the mouth meets the hook
    var mo = c.w / 2 - 0.3;
    var dir = d.engDir;
    var far = Math.abs(hook.x - c.x) > c.w / 2 + 10 || Math.abs(hook.y - c.y) > 10;
    if (far || (crawl && Math.abs(hook.y - c.y) > 6)) { disengage(c, d, env, 'lost'); return true; }
    c.dir = dir; d.flipT = 0;
    var txm = hook.x - dir * mo, tym = crawl ? c.y : hook.y;
    if (c.state === 'nibble') {
      if (d.nibGap > 0) {
        if (!still) d.nibGap -= dt;
        txm -= dir * 2;
        TX = (txm - c.x) * 3; TY = (tym - c.y) * 3; TK = 5;
        return true;
      }
      TX = (txm - c.x) * 4; TY = (tym - c.y) * 4; TK = 6;
      if (Math.abs(txm - c.x) < 0.7 && Math.abs(tym - c.y) < 1.2 && !still) {
        if (d.nibLeft > 0) {
          d.nibLeft--;
          d.nibGap = rr(d, 0.6, 1.2);
          call(env, 'nibble', c, { sp: c.sp, left: d.nibLeft });
        } else {
          c.state = 'bite';
          d.biteT = 0;
        }
      }
      return true;
    }
    // bite
    TX = (txm - c.x) * 8; TY = (tym - c.y) * 8; TK = 12;
    if (!d.bitten && Math.abs(txm - c.x) < 0.8 && Math.abs(tym - c.y) < 1.2) {
      d.bitten = true;
      call(env, 'bite', c, { sp: c.sp });
    }
    d.biteT += dt;
    if (d.biteT > BITE_HOLD) { disengage(c, d, env, 'timeout'); d.ignoreT = 3; }
    return true;
  }

  // ------------------------------------------------------------------------------------------------ update
  function update(list, dt, env) {
    if (!list || !list.length) return;
    var e = env || {};
    if (!(dt > 0)) return;
    if (dt > 0.05) dt = 0.05;
    var B = e.bounds || DEF_BOUNDS;
    var mode = e.mode || 'wild';
    var hook = e.hook && e.hook.active !== false ? e.hook : null;
    var top = e.surfaceY !== undefined ? e.surfaceY : B.y0;
    var tankNight = mode === 'tank' && (e.light === 'night' || (!e.light && e.phase === 'noite'));
    var food = mode === 'tank' && e.food && e.food.length ? e.food : null;
    var i, c, d, n = list.length;
    EATEN.length = 0;

    // the engaged creature (only one at a time)
    var engaged = null;
    for (i = 0; i < n; i++) { c = list[i]; if (c.hooked || c.state === 'nibble' || c.state === 'bite') { engaged = c; break; } }
    if (engaged && !hook && !engaged.hooked) { disengage(engaged, engaged.data, e, 'lost'); engaged = null; }

    for (i = 0; i < n; i++) {
      c = list[i]; d = c.data;
      c.t += dt; d.age += dt;
      if (d.ignoreT > 0) d.ignoreT -= dt;
      if (d.noticeCool > 0) d.noticeCool -= dt;
      if (d.eatCool > 0) d.eatCool -= dt;
      if (d.alarmT > 0) d.alarmT -= dt;
      if (d.scramble > 0) d.scramble = Math.max(0, d.scramble - dt * 0.5);
      shimmer(c, d, dt);

      if (c.state === 'gone') continue;
      if (c.state === 'fading') {
        d.fadeT -= dt;
        if (d.fadeT <= 0) c.state = 'gone';
        continue;
      }
      if (c.hooked) { updateHooked(c, d, dt); continue; }

      var cs = d.cs;
      // tank: diurnal fish rest low at night
      var resting = tankNight && d.species && d.species.light === 'day' && d.beh !== 'crawl';

      STEER[d.beh] ? STEER[d.beh](c, d, dt, cs, e, B) : stCruise(c, d, dt, cs, e, B);

      // wild hook engagement
      if (mode === 'wild' && !d.sight) {
        if (hook) {
          if (c.state === 'swim' || c.state === 'buried') tryNotice(c, d, dt, hook, e);
          if (c.state === 'investigate' || c.state === 'nibble' || c.state === 'bite') {
            stEngaged(c, d, dt, cs, hook, e, engaged);
            if ((c.state === 'nibble' || c.state === 'bite') && !engaged) engaged = c;
          }
        } else if (c.state === 'investigate') disengage(c, d, e, null);
      }

      // flee
      if (c.state === 'flee') {
        d.fleeT -= dt;
        var away = c.x >= d.fleeX ? 1 : -1;
        TX = away * cs * 2.2; TY = (U.noise1(d.seed + c.t) - 0.5) * cs; TK = 5;
        d.hdx = away; d.travel = away;
        if (d.sd.extra.inflate) d.autoPose = 'inflate';
        else if (d.sd.extra.ink) d.autoPose = 'ink';
        else if (d.sd.extra.jet) d.autoPose = 'jet';
        else if (d.sd.extra.roll) d.autoPose = 'roll';
        else if (d.sd.extra.hide) d.autoPose = 'hide';
        if (d.fleeT <= 0) { c.state = 'swim'; d.autoPose = null; }
      }

      // tank food
      if (food && d.eatCool <= 0 && c.state === 'swim') seekFood(c, d, cs, food, e, B);

      if (resting) {
        TX *= 0.25;
        TY = (B.y1 - c.h * ASPECT / 2 - 2 - c.y) * 0.5;
        TK = Math.min(TK, 1);
      }

      // depth band spring
      var scripted = d.leaping || (d.beh === 'ambient') || d.beh === 'crawl' || c.state === 'buried';
      if (!scripted && c.state !== 'nibble' && c.state !== 'bite' && !resting) {
        bandOf(c, d, e, B, BAND);
        if (c.y < BAND[0]) TY += (BAND[0] - c.y) * 1.2;
        else if (c.y > BAND[1]) TY -= (c.y - BAND[1]) * 1.2;
      }

      if (TK > 0) {
        var k = 1 - Math.exp(-TK * dt);
        c.vx += (TX - c.vx) * k;
        c.vy += (TY - c.vy) * k;
      }
    }

    separate(list, n, dt, mode);

    for (i = 0; i < n; i++) {
      c = list[i]; d = c.data;
      if (c.hooked || c.state === 'gone' || c.state === 'fading') continue;
      integrate(c, d, dt, e, B, top, mode);
    }

    // remove creatures that left
    var w = 0;
    for (i = 0; i < list.length; i++) {
      c = list[i];
      if (c.state === 'gone') {
        if (c.data.fadeT <= 0 && !c.data.silentGone) call(e, 'leave', c, { reason: 'despawn', sp: c.sp });
        leaveSchool(c);
        continue;
      }
      list[w++] = c;
    }
    list.length = w;
  }

  function leaveSchool(c) {
    var s = c.data.school;
    if (!s) return;
    var k = s.members.indexOf(c);
    if (k >= 0) s.members.splice(k, 1);
    c.data.school = null;
  }

  function shimmer(c, d, dt) {
    var sp = d.species;
    if (!sp || (sp.rarity !== 'R' && sp.rarity !== 'L' && !(c.specimen && c.specimen.dense))) return;
    if (d.shimOn > 0) { d.shimOn -= dt; if (d.shimOn <= 0) d.shimC = -1; return; }
    d.shimT -= dt;
    if (d.shimT > 0) return;
    var slow = AQ.fx && AQ.fx.motion && AQ.fx.motion() < 1;
    d.shimT = slow ? 2 : rr(d, 0.6, 1.2) * (c.specimen && c.specimen.dense ? 0.5 : 1);
    d.shimOn = 0.1;
    var f = d.sd.frames[0];
    for (var tries = 0; tries < 6; tries++) {
      var r = d.rng.int(f.length), col = d.rng.int(f[0].length);
      if (f[r][col] !== ' ') { d.shimC = col; d.shimR = r; return; }
    }
    d.shimC = -1;
  }

  function seekFood(c, d, cs, food, env, B) {
    var best = -1, bd = 900, mx = mouthX(c);
    var crawl = d.beh === 'crawl' || d.beh === 'burrow';
    for (var j = 0; j < food.length; j++) {
      var f = food[j];
      if (EATEN.indexOf(f.id) >= 0) continue;
      if (crawl && f.y < floorAt(env, B, f.x) - 5) continue;
      var dx = f.x - mx, dy = f.y - c.y, d2 = dx * dx + dy * dy;
      if (d2 < bd) { bd = d2; best = j; }
    }
    if (best < 0) return;
    var fd = food[best];
    var dxm = fd.x - mx, dym = fd.y - c.y;
    if (dxm * dxm + dym * dym < 1.7) {
      EATEN.push(fd.id);
      d.eatCool = rr(d, 2.5, 5);
      call(env, 'eat', c, { id: fd.id, sp: c.sp });
      return;
    }
    var sp = cs * 1.8 + 1;
    TX = U.clamp((fd.x - c.x) * 2, -sp, sp);
    TY = crawl ? 0 : U.clamp(dym * 2, -sp, sp);
    TK = 3;
    if (c.state === 'buried') c.state = 'swim';
  }

  // Cheap O(n²) separation (n ≤ ~64 on screen): fish nudge apart vertically; crawlers horizontally.
  // Cosmetic predator chase: small prey near a much bigger predator get a flee nudge.
  function separate(list, n, dt, mode) {
    for (var i = 0; i < n; i++) {
      var a = list[i], da = a.data;
      if (a.hooked || a.state === 'gone' || a.state === 'buried' || a.state === 'nibble' || a.state === 'bite' || da.beh === 'ambient' || da.leaping) continue;
      for (var j = i + 1; j < n; j++) {
        var b = list[j], db = b.data;
        if (b.hooked || b.state === 'gone' || b.state === 'buried' || b.state === 'nibble' || b.state === 'bite' || db.beh === 'ambient' || db.leaping) continue;
        var same = da.school && da.school === db.school;
        var dx = b.x - a.x, dy = b.y - a.y;
        // schoolmates steer apart in stSchool; here only heavy overlaps get the hard nudge
        var rx = (a.w + b.w) * (same ? 0.3 : 0.42), ry = (a.h + b.h) * ASPECT * (same ? 0.3 : 0.42);
        var adx = dx < 0 ? -dx : dx, ady = dy < 0 ? -dy : dy;
        if (adx < rx && ady < ry) {
          var ox = (rx - adx) / rx, oy = (ry - ady) / ry, f = Math.min(ox, oy) * 6 * dt;
          var aCrawl = da.beh === 'crawl', bCrawl = db.beh === 'crawl';
          if (aCrawl || bCrawl) {
            var sx = dx >= 0 ? 1 : -1;
            if (aCrawl && bCrawl) { a.vx -= sx * f * 2; b.vx += sx * f * 2; }
          } else {
            var sy = dy >= 0 ? 1 : -1;
            a.vy -= sy * f * 3; b.vy += sy * f * 3;
            a.vx -= (dx >= 0 ? 1 : -1) * f; b.vx += (dx >= 0 ? 1 : -1) * f;
          }
        }
        if (mode === 'wild' && adx < 10 && ady < 8) chase(a, b, dx, dy, dt);
      }
    }
  }
  function chase(a, b, dx, dy, dt) {
    var sa = a.data.species, sb = b.data.species;
    if (!sa || !sb || !sa.size || !sb.size) return;
    var big = SIZE_I[sa.size] - SIZE_I[sb.size];
    var pred = null, prey = null, s = 1;
    if (big >= 2 && sa.diet === 'predator') { pred = a; prey = b; s = 1; }
    else if (big <= -2 && sb.diet === 'predator') { pred = b; prey = a; s = -1; }
    if (!pred || prey.state !== 'swim' || pred.state !== 'swim') return;
    prey.vx += s * (dx >= 0 ? 1 : -1) * prey.data.cs * 2.5 * dt;
    prey.vy += s * (dy >= 0 ? 1 : -1) * prey.data.cs * 1.2 * dt;
    pred.vx += s * (dx >= 0 ? 1 : -1) * pred.data.cs * 0.6 * dt;
  }

  function integrate(c, d, dt, env, B, top, mode) {
    var hw = c.h * ASPECT / 2;
    if (d.leaping) {
      var g = G_LEAP;
      if (d.sd.key === 'voador' && c.vy > 0 && c.y < top) g = G_LEAP * 0.18; // flying fish glide
      c.vy += g * dt;
    }
    c.x += c.vx * dt;
    c.y += c.vy * dt;
    var fy = floorAt(env, B, c.x);
    var sp = d.species;
    if (d.beh === 'crawl') c.y = fy - hw;
    else if (c.state === 'buried') c.y = fy - hw + 1;
    else if (sp && sp.floats && mode === 'wild' && c.state !== 'flee') c.y = top + hw - ASPECT;
    else {
      if (d.leaping) {
        var wasAbove = d.above;
        d.above = c.y - hw < top;
        if (d.above !== wasAbove) call(env, 'splash', c, { x: c.x, y: top, up: d.above });
        if (!d.above && c.vy > 0 && c.y > top + hw + 1) { d.leaping = false; d.above = false; }
      } else if (d.beh !== 'ambient' || d.path !== 'leap') {
        var minY = top + hw + (mode === 'tank' ? 0.2 : 0.5);
        if (c.y < minY) { c.y = minY; if (c.vy < 0) c.vy = 0; }
      }
      if (c.y > fy - hw) { c.y = fy - hw; if (c.vy > 0) c.vy = 0; }
    }
    if (mode === 'tank') {
      var x0 = B.x0 + c.w / 2, x1 = B.x1 - c.w / 2;
      if (c.x < x0) { c.x = x0; if (c.vx < 0) c.vx = -c.vx * 0.3; }
      else if (c.x > x1) { c.x = x1; if (c.vx > 0) c.vx = -c.vx * 0.3; }
    }

    // facing with hysteresis
    var engagedFace = c.state === 'nibble' || c.state === 'bite';
    if (!engagedFace) {
      if (c.vx * c.dir < -0.25) { d.flipT += dt; if (d.flipT > 0.12) { c.dir = -c.dir; d.flipT = 0; } }
      else d.flipT = 0;
    }

    // frame rate ∝ speed
    var spd = Math.sqrt(c.vx * c.vx + c.vy * c.vy);
    d.speed = spd;
    var fr = d.sd.fps * (0.35 + 0.65 * Math.min(1.6, spd / (d.cs || 1)));
    if (d.beh === 'crawl') fr = spd > 0.2 ? d.sd.fps * Math.min(1.6, spd / (d.cs || 1)) : 0;
    if (c.state === 'buried') fr = 0;
    d.fAcc += fr * dt;
    var nf = d.sd.frames.length;
    c.frame = nf ? Math.floor(d.fAcc) % nf : 0;

    // leave the scene
    var ox = c.w / 2;
    if (mode === 'wild') {
      var out = c.x < B.x0 - DESPAWN - ox || c.x > B.x1 + DESPAWN + ox;
      if (d.beh === 'ambient') out = (c.x < B.x0 - ox - 4 && d.hdx < 0) || (c.x > B.x1 + ox + 4 && d.hdx > 0);
      var leaving = d.age >= d.leaveAt || c.state === 'flee' || d.beh === 'ambient';
      if (d.school && d.school.members[0] !== c && d.school.members.length > 1) leaving = true;
      if (out && leaving && c.state !== 'nibble' && c.state !== 'bite') c.state = 'gone';
    } else if (mode === 'title') {
      if (c.x < B.x0 - ox - 6 && c.vx < 0) c.x = B.x1 + ox + 4;
      else if (c.x > B.x1 + ox + 6 && c.vx > 0) c.x = B.x0 - ox - 4;
    }
  }

  function updateHooked(c, d, dt) {
    var vx = (c.x - d.lastX) / dt, vy = (c.y - d.lastY) / dt;
    d.lastX = c.x; d.lastY = c.y;
    c.vx = U.lerp(c.vx, vx, 0.3); c.vy = U.lerp(c.vy, vy, 0.3);
    if (!c.data.faceLock) {
      if (c.vx * c.dir < -0.8) { d.flipT += dt; if (d.flipT > 0.15) { c.dir = -c.dir; d.flipT = 0; } }
      else d.flipT = 0;
    } else c.dir = c.data.faceLock;
    d.fAcc += d.sd.fps * 1.8 * dt;
    var nf = d.sd.frames.length;
    c.frame = nf ? Math.floor(d.fAcc) % nf : 0;
  }

  // ------------------------------------------------------------------------------------------------ control
  function setHooked(c, on) {
    var d = c.data;
    c.hooked = !!on;
    if (on) {
      c.state = 'hooked';
      d.lastX = c.x; d.lastY = c.y;
      d.autoPose = null;
      if (d.species && d.species.fight && d.species.fight.special && d.species.fight.special.alarm) d.alarmT = 1.6;
    } else {
      c.state = 'flee';
      d.fleeT = 2.5; d.ignoreT = Math.max(d.ignoreT, 8);
      d.fleeX = c.x - c.dir * 3;
      d.leaveAt = Math.min(d.leaveAt, d.age);
    }
  }

  // spook(c, sec): flee from the hook and ignore hooks for `sec` s; schoolmates are spooked for sec/2.
  function spook(c, sec, noSchool) {
    var d = c.data, s = sec === undefined ? 8 : sec;
    if (c.hooked) return;
    d.ignoreT = Math.max(d.ignoreT, s);
    d.fleeT = Math.min(2.5, Math.max(0.8, s * 0.3));
    d.fleeX = c.x - c.dir * 2;
    if (c.state !== 'gone' && c.state !== 'fading') c.state = 'flee';
    if (!noSchool && d.school) {
      var m = d.school.members;
      for (var i = 0; i < m.length; i++) if (m[i] !== c) spook(m[i], s / 2, true);
    }
  }

  // remove(list, c, fade?): immediate splice, or (fade) dissolve for 0.4 s then removed by update().
  function remove(list, c, fade) {
    if (fade && c.state !== 'gone') {
      c.state = 'fading'; c.data.fadeT = FADE; c.data.silentGone = true;
      return;
    }
    leaveSchool(c);
    var i = list.indexOf(c);
    if (i >= 0) list.splice(i, 1);
  }

  function hitTest(c, wx, wy) {
    return Math.abs(wx - c.x) <= c.w / 2 + 0.5 && Math.abs(wy - c.y) <= c.h * ASPECT / 2 + 0.75;
  }
  function bounds(c, out) {
    var o = out || {};
    o.x0 = c.x - c.w / 2; o.x1 = c.x + c.w / 2;
    o.y0 = c.y - c.h * ASPECT / 2; o.y1 = c.y + c.h * ASPECT / 2;
    return o;
  }
  // engaged(list) → the creature nibbling/biting the hook, or null
  function engaged(list) {
    for (var i = 0; i < list.length; i++) if (list[i].hooked || list[i].state === 'nibble' || list[i].state === 'bite') return list[i];
    return null;
  }

  // ------------------------------------------------------------------------------------------------ drawing
  var SO = { flip: false, level: 12, bold: false, deform: 'none', amp: 1, t: 0, knock: true,
    glyphMap: undefined, levelMap: undefined, dissolve: 0, seed: 0 };
  var GC = null, GD = null, G_W = 0, G_BUR = null, G_GLOW = null, G_GLV = 0, G_DENSE = false, G_SCR = 0, G_T = 0,
    G_CAMO = 0, G_ALARM = false, G_SHIM = false;
  var DENS = null;

  function gridOf(sd, cells, name) {
    if (!cells) return null;
    var key = '_' + name + 'Grid';
    if (sd[key]) return sd[key];
    var f = sd.frames[0], w = f[0].length, g = new Uint8Array(w * f.length);
    for (var i = 0; i < cells.length; i++) {
      var cc = cells[i][0], rr2 = cells[i][1];
      if (cc >= 0 && cc < w && rr2 >= 0 && rr2 < f.length) g[rr2 * w + cc] = 1;
    }
    sd[key] = g;
    return g;
  }

  function isLetter(ch) { return (ch >= 'A' && ch <= 'Z') || (ch >= 'a' && ch <= 'z'); }

  function glyphMapFn(ch, col, row) {
    if (G_BUR) return G_BUR[row * G_W + col] ? ch : null;
    if (G_SHIM && col === GD.shimC && row === GD.shimR) return '*';
    if (G_SCR > 0 && isLetter(ch)) {
      var h = ((col * 73856093) ^ (row * 19349663)) >>> 0;
      if ((h % 100) / 100 < G_SCR) return LETTERS[(h + Math.floor(G_T * (2 + G_SCR * 10))) % LETTERS.length];
    }
    if (G_DENSE) { var dn = DENS[ch]; if (dn !== undefined) return dn; }
    return ch;
  }
  function levelMapFn(col, row, level) {
    if (G_GLOW && G_GLOW[row * G_W + col]) {
      if (G_ALARM) return (Math.floor(G_T * 8) & 1) ? 15 : 8;
      return G_GLV > level ? G_GLV : level;
    }
    return G_CAMO && level > G_CAMO ? G_CAMO : level;
  }

  function tintMapFn(col, row, tint) { return G_GLOW && G_GLOW[row * G_W + col] && (G_GLV || G_ALARM) ? 'glow' : tint; }

  function draw(c, env) {
    var R = AQ.render;
    if (!R || !R.sprite || c.state === 'gone') return;
    var e = env || {}, d = c.data, sd = d.sd, sp = d.species;
    var pose = c.pose || d.autoPose, frames = sd.frames, masks = sd.masks, isExtra = false;
    if (pose && sd.extra && sd.extra[pose]) {
      frames = sd.extra[pose]; masks = sd.extraMasks ? sd.extraMasks[pose] : null; isExtra = true;
    }
    var fi = isExtra ? Math.floor(d.fAcc) % frames.length : (c.frame % frames.length);
    var lines = frames[fi];
    var frame = R.compile(lines, masks ? masks[fi] : null);

    var vis = e.visibility ? e.visibility(c.x, c.y, c) : 1;
    d.vis = vis;
    var base = c.hooked ? 14 : (e.level || 12);
    var lvl = Math.round(base * vis);
    if (lvl < 1) lvl = 1;

    // camouflage (escorpiao): level 3 until the hook comes within 8 u
    G_CAMO = 0;
    if (sp && sp.camo && !c.hooked && e.mode !== 'tank') {
      var hk = e.hook;
      var near = hk && Math.abs(hk.x - c.x) + Math.abs(hk.y - c.y) < sp.camo.dist;
      if (!near) G_CAMO = sp.camo.level;
    }

    // glow cells: drawn at 10–12 (slow pulse) when the creature is hard to see, or in a dark tank
    G_GLOW = null; G_GLV = 0; G_ALARM = false;
    var tankNight = e.mode === 'tank' && (e.light === 'night' || e.light === 'dim');
    if (sd.glow && !isExtra && (!sp || !sp.glowAt || e.phase === sp.glowAt || tankNight || vis < 0.5)) {
      G_GLOW = gridOf(sd, sd.glow, 'glow');
      G_GLV = (vis < 0.5 || tankNight) ? 11 + Math.round(Math.sin(c.t * 1.3 + d.seed)) : 0;
      if (d.alarmT > 0) G_ALARM = true;
    }

    GC = c; GD = d; G_W = lines[0].length; G_T = c.t;
    G_BUR = c.state === 'buried' && sd.buried && !isExtra ? gridOf(sd, sd.buried, 'bur') : null;
    G_DENSE = !!(c.specimen && c.specimen.dense);
    if (G_DENSE && !DENS) DENS = AQ.textart.DENSIFY;
    G_SHIM = d.shimC >= 0 && !isExtra;
    G_SCR = sd.scramble ? Math.max(0.12, d.scramble) : 0;

    var motion = AQ.fx && AQ.fx.motion ? AQ.fx.motion() : 1;
    var ampMul = sd.deform === 'swim' ? 0.45 + 0.55 * Math.min(1.4, d.speed / (d.cs || 1)) : 1;
    if (c.hooked) ampMul = 1.6;
    var dissolve = 0;
    if (d.age < FADE) dissolve = 1 - d.age / FADE;
    if (c.state === 'fading') dissolve = Math.max(dissolve, 1 - d.fadeT / FADE);

    SO.flip = c.dir < 0;
    SO.level = lvl;
    SO.bold = G_DENSE;
    SO.deform = sd.deform || 'none';
    SO.amp = (sd.amp === undefined ? 1 : sd.amp) * motion * ampMul;
    SO.t = c.t;
    SO.knock = G_BUR ? false : true;
    SO.dissolve = dissolve;
    SO.seed = c.uid;
    SO.glyphMap = (G_BUR || G_SHIM || G_SCR > 0 || G_DENSE) ? glyphMapFn : undefined;
    SO.levelMap = (G_GLOW || G_CAMO) ? levelMapFn : undefined;
    SO.tintMap = G_GLOW ? tintMapFn : undefined; // Colourful theme: lit photophores glow in their own colour

    if (sp && sp.rarity === 'L' && !G_BUR) halo(c, d, R, vis);
    R.sprite(frame, c.x, c.y, SO);
    GC = null; GD = null;
  }

  var HALO_N = 14, dotCode = 0;
  function halo(c, d, R, vis) {
    if (!dotCode) dotCode = R.code('.');
    var rx = c.w / 2 + 2, ry = c.h * ASPECT / 2 + 1.5, rot = c.t * 0.15;
    for (var i = 0; i < HALO_N; i++) {
      var a = rot + i * (Math.PI * 2 / HALO_N);
      if (((i + Math.floor(c.t * 2)) % 3) === 0) continue;
      R.glyphW(dotCode, c.x + Math.cos(a) * rx, c.y + Math.sin(a) * ry, vis < 0.3 ? 1 : 2);
    }
  }

  // drawList(list, env): every creature, the hooked one last (on top).
  function drawList(list, env) {
    if (!list) return;
    var i;
    for (i = 0; i < list.length; i++) if (!list[i].hooked) draw(list[i], env);
    for (i = 0; i < list.length; i++) if (list[i].hooked) draw(list[i], env);
  }

  AQ.creatures = {
    SENSE: SENSE,
    SPEED: SPEED,
    create: create,
    createSchool: createSchool,
    setJuvenile: setJuvenile,
    update: update,
    draw: draw,
    drawList: drawList,
    hitTest: hitTest,
    bounds: bounds,
    mouth: mouth,
    engaged: engaged,
    noticeRadius: noticeRadius,
    cruiseSpeed: cruiseSpeed,
    setHooked: setHooked,
    spook: spook,
    remove: remove
  };
})(window.AQ);
