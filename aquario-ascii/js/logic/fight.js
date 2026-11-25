// Água-Tinta — fight model (owner C). Pure and deterministic: fixed dt (1/60), all randomness from opts.rng.
// §4.7 (model, constants, failures, autopilot) and §4.8 (styles, tells, boss phases, specials).
//
// Coordinates: (x, y) are relative to the ORIGIN = the point on the water surface below the rod tip
// (x right, y down, y = 0 is the surface). floorY(x) receives WORLD x (origin.x + x) and returns world y;
// covers are world rects. opts.origin defaults to {x:0, y:0} (then fight space == world space).
//
// step() returns an events array that is REUSED between calls (copy what you keep). Event objects are new.
(function (AQ) {
  'use strict';

  var DT = 1 / 60;

  var CONST = {
    ZONE_LO: 0.35, ZONE_HI: 0.85, SLACK: 0.12, IDLE_LOAD: 0.4, STEER_T: 0.3, STEER_DRAIN: 0.8,
    ROD_PULL: 2.5, FALL_RATE: 4, GAIN_DIV: 1.6, GAIN_MIN: 0.1, FRESH_GAIN: 0.45,
    DRAIN_LOW: 0.3, DRAIN_HIGH: 0.6, REST_DRAIN: 0.6, RECOVER: 0.25,
    SLACK_BASE: 0.8, SLACK_HOLD: 0.6, THROW_BASE: 0.55, THROW_HOLD: 0.25, THROW_TIME: 0.15, TEAR_TIME: 0.4,
    AIR_TIME: 0.8, AIR_PM_REEL: 0.9, AIR_PM_IDLE: 0.375, LAND_DIST: 3, LOOSE_TIME: 20,
    FRAY_RATE: 0.6, FRAY_DECAY: 0.2, COVER_DIST: 3, SLIP_CHANCE: 0.15,
    // extensions (documented in notes/C.md)
    T_MAX: 1.6,          // hard ceiling for T (§15.11: T stays in [0, 1.6])
    JUMP_HEIGHT: 4,      // airborne arc height (u above the surface)
    LAND_Y: 3,           // depth after a jump splash-down
    PHASE_HI: 0.66, PHASE_LO: 0.33, BOSS_TELL_MUL: 0.85,
    BURROW_ARRIVE: 8,    // a burrowing fish slows down as it reaches its cover: speed × min(1, d / 8)
    SOFT_DRAG: 0.7,      // soft bodies (special.tear): reeling itself adds SOFT_DRAG × gain to the target tension
    BOSS_HOLD: 12        // bosses cannot be reeled closer than ~12 u before their last phase
  };

  // shake adds .35·sin(2π·5t) at run time.
  var PULL_MUL = {
    rest: 0.25, pull: 0.75, run: 1, dive: 1.1, rise: 0.4, jump: 0.2, shake: 0.6,
    burrow: 0.9, grip: 1.3, drift: 0.3, tell: 0.5, inflate: 1.6, roll: 0.15
  };

  // Durations in seconds [min, max] (§4.8). jump has no fixed duration (rise → airborne → splash).
  var DUR = {
    rest: [1.2, 2.2], pull: [1.5, 3], run: [1.5, 3.5], dive: [1.5, 3], rise: [1, 2], shake: [1.5, 3],
    burrow: [1.5, 3], grip: [2, 4], drift: [1.5, 3], roll: [1.5, 2.5], inflate: [4, 4], jump: [0, 0]
  };
  // States that are announced by a tell first (§4.8 tells table).
  var NEEDS_TELL = { run: 1, dive: 1, jump: 1, shake: 1, burrow: 1, grip: 1 };

  // State weights as ordered pairs (deterministic iteration).
  var STYLES = {
    puller: { w: [['pull', 0.55], ['rest', 0.30], ['run', 0.15]] },
    runner: { w: [['run', 0.55], ['rest', 0.25], ['pull', 0.20]], flip: 0.7 },
    diver: { w: [['dive', 0.45], ['rise', 0.25], ['rest', 0.30]] },
    jumper: { w: [['run', 0.35], ['jump', 0.30], ['rest', 0.35]] },
    shaker: { w: [['shake', 0.50], ['pull', 0.25], ['rest', 0.25]] },
    burrower: { w: [['burrow', 0.50], ['pull', 0.25], ['rest', 0.25]] },
    deadweight: { w: [['pull', 0.50], ['grip', 0.20], ['rest', 0.30]] },
    drifter: { w: [['drift', 0.70], ['rest', 0.30]] },
    inflater: { w: [['pull', 0.55], ['rest', 0.30], ['run', 0.15]], inflate: true },
    inker: { w: [['run', 0.50], ['rest', 0.30], ['pull', 0.20]], ink: true },
    // boss-only phase styles
    frenzy: { w: [['run', 0.45], ['jump', 0.35], ['rest', 0.20]], flip: 0.7 },
    tentacles: { w: [['shake', 0.45], ['grip', 0.35], ['rest', 0.20]] },
    boss: { w: [['pull', 0.55], ['rest', 0.30], ['run', 0.15]] } // fallback; real bosses use BOSSES
  };

  // Boss phase tables (switch at S thresholds .66 / .33; tells × .85 in the last phase).
  var BOSSES = {
    marlim: { phases: [{ style: 'runner' }, { style: 'jumper' }, { style: 'frenzy' }] },
    celacanto: { riseMul: 0.8, phases: [{ style: 'diver' }, { style: 'deadweight', grip: true }, { style: 'runner', vMul: 0.7 }] },
    tinteira: {
      phases: [{ style: 'diver' }, { style: 'inker', inkChance: 1, inkRadius: 18 }, { style: 'tentacles', tentacles: 3 }],
      riseBelow: 0.1
    },
    _default: { phases: [{ style: 'puller' }, { style: 'runner' }, { style: 'frenzy' }] }
  };

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function sgn(v) { return v > 0 ? 1 : v < 0 ? -1 : 0; }

  function fightParams(species) {
    var f = (species && species.fight) || {};
    return {
      style: f.style || 'puller',
      P: f.power !== undefined ? f.power : 1,
      stam: f.stamina !== undefined ? f.stamina : 10,
      V: f.speed !== undefined ? f.speed : 5,
      tell: f.tell !== undefined ? f.tell : 0.55,
      special: f.special || {}
    };
  }

  function gearOf(g) {
    g = g || {};
    return {
      Ls: g.Ls || 1, maxLen: g.maxLen || 90, snapGrace: g.snapGrace !== undefined ? g.snapGrace : 0.25,
      reelSpeed: g.reelSpeed || 7, riseRate: g.riseRate || 7, St: g.St !== undefined ? g.St : 0.55,
      H: g.H || 0, hookClass: g.hookClass || 1
    };
  }

  // ---------------------------------------------------------------- create
  // create(species, specimen, gear, opts:{rng, start:{x,y}, floorY:(x)→y, covers, script?, origin?, viewCols?})
  function create(species, specimen, gear, opts) {
    var o = opts || {};
    var fp = fightParams(species);
    var sc = o.script || null;
    var q = specimen && typeof specimen.q === 'number' ? specimen.q : 0.5;
    var start = o.start || { x: 10, y: 10 };
    var rng = o.rng || AQ.rng.create('fight:' + (species && species.id));
    var g = gearOf(gear);
    var bossDef = fp.style === 'boss' ? (BOSSES[species && species.id] || BOSSES._default) : null;
    var fs = {
      t: 0, state: 'rest', next: null, tellKind: null, dirX: sgn(start.x) || 1,
      x: +start.x || 0, y: Math.max(0, +start.y || 0), L: 0, T: 0, S: 1, fray: 0,
      airborne: false, inflated: false, phase: 0, result: null,
      species: species || null, specimen: specimen || null,
      // parameters
      sz: 0.75 + 0.5 * q,
      P: sc && sc.power !== undefined ? sc.power : fp.P,
      stam: sc && sc.stamina !== undefined ? sc.stamina : fp.stam,
      V: fp.V, tell: fp.tell, special: fp.special, baseStyle: fp.style,
      style: bossDef ? bossDef.phases[0].style : (STYLES[fp.style] ? fp.style : 'puller'),
      boss: bossDef, vMul: 1, inkChance: fp.special.inkChance || 0, inkRadius: fp.special.inkRadius || 8,
      tear: fp.special.tear || 0, tentacles: 0, gripSpecial: !!fp.special.grip,
      gear: g, riseRate: g.riseRate * (bossDef && bossDef.riseMul ? bossDef.riseMul : 1),
      slipRisk: !!(species && species.hookMin && g.hookClass < species.hookMin),
      noEscape: !!(sc && sc.noEscape),
      runs: normRuns(sc && sc.runs), runIdx: 0,
      rng: rng, origin: { x: (o.origin && o.origin.x) || 0, y: (o.origin && o.origin.y) || 0 },
      floorY: typeof o.floorY === 'function' ? o.floorY : null,
      covers: o.covers || [], viewCols: o.viewCols || 100,
      // timers and internals
      stateT: 0, stateDur: 0, snapT: 0, slackT: 0, throwT: 0, tearT: 0, reelIdle: 0,
      ink: false, inkT: 0, inflateDone: false, rising: false,
      jumpPhase: 0, airT: 0, steerDir: 0, coverX: 0, coverY: 0, coverDist: Infinity, hasCover: false,
      driftX: 0, driftY: 0, burrowDir: 0, lastFray10: 0, counter: 0, F: 0, reel: false, rod: 0, tells: 0,
      _ev: []
    };
    fs.L = Math.sqrt(fs.x * fs.x + fs.y * fs.y);
    pickNext(fs, fs._ev, true);
    fs._ev.length = 0;
    return fs;
  }

  function normRuns(runs) {
    if (!runs || !runs.length) return [];
    var out = [];
    for (var i = 0; i < runs.length; i++) {
      var r = runs[i];
      out.push(typeof r === 'number' ? { at: r, dir: 0 } : { at: +r.at || 0, dir: sgn(r.dir || 0) });
    }
    out.sort(function (a, b) { return a.at - b.at; });
    return out;
  }

  // ---------------------------------------------------------------- state machine
  function weightsFor(fs) {
    var st = STYLES[fs.style] || STYLES.puller, w = st.w;
    var bump = null;
    if (fs.gripSpecial && fs.style !== 'deadweight' && fs.style !== 'tentacles') {
      // grip special: arraia only near the floor; others (polvo) anywhere.
      if (fs.baseStyle !== 'puller' || nearFloor(fs, 8)) bump = 'grip';
    }
    if (fs.special.roll) bump = 'roll';
    if (!bump) return w;
    var out = fs._w || (fs._w = []);
    out.length = 0;
    for (var i = 0; i < w.length; i++) out.push(w[i]);
    out.push(bump === 'roll' ? ROLL_W : GRIP_W);
    return out;
  }
  var ROLL_W = ['roll', 0.2], GRIP_W = ['grip', 0.15];

  function nearFloor(fs, d) {
    if (!fs.floorY) return false;
    return floorAt(fs, fs.x) - fs.y < d;
  }
  function floorAt(fs, x) {
    if (!fs.floorY) return Infinity;
    var f = fs.floorY(fs.origin.x + x);
    return typeof f === 'number' && f === f ? f - fs.origin.y : Infinity;
  }

  // The hookset makes the fish bolt: the first state is never a rest, a burrow or a grip (a fish hooked at
  // its own hole would otherwise fray before the player can react).
  var NOT_FIRST = { rest: 1, burrow: 1, grip: 1 };
  function pickWeighted(fs, w, first) {
    var total = 0, i;
    for (i = 0; i < w.length; i++) if (!(first && NOT_FIRST[w[i][0]])) total += w[i][1];
    if (!(total > 0)) return first ? 'pull' : 'rest';
    var r = fs.rng.next() * total;
    for (i = 0; i < w.length; i++) {
      if (first && NOT_FIRST[w[i][0]]) continue;
      r -= w[i][1];
      if (r < 0) return w[i][0];
    }
    for (i = w.length - 1; i >= 0; i--) if (!(first && NOT_FIRST[w[i][0]])) return w[i][0];
    return 'rest';
  }

  function tellTime(fs) {
    return fs.tell * (fs.boss && fs.phase === 2 ? CONST.BOSS_TELL_MUL : 1);
  }

  function pickNext(fs, ev, first) {
    var k;
    if (fs.rising) k = 'rise';
    else k = pickWeighted(fs, weightsFor(fs), first);
    begin(fs, k, ev);
  }

  // begin(state): announces with a tell when needed, otherwise enters directly.
  function begin(fs, k, ev, forcedDir) {
    if (NEEDS_TELL[k] && tellTime(fs) > 0) {
      fs.state = 'tell'; fs.next = k; fs.tellKind = k;
      fs.stateT = fs.stateDur = tellTime(fs);
      fs._forcedDir = forcedDir || 0;
      fs.tells++;
      ev.push({ type: 'state', state: 'tell' });
      ev.push({ type: 'tell', kind: k });
      if (fs.slipRisk && !fs.noEscape && fs.rng.next() < CONST.SLIP_CHANCE) end(fs, 'slip', ev);
      return;
    }
    enter(fs, k, ev, forcedDir);
  }

  function enter(fs, k, ev, forcedDir) {
    var st = STYLES[fs.style] || STYLES.puller;
    fs.state = k; fs.next = null; fs.tellKind = null;
    var d = DUR[k] || DUR.rest;
    fs.stateT = fs.stateDur = d[0] === d[1] ? d[0] : fs.rng.range(d[0], d[1]);
    if (k === 'run') {
      if (forcedDir) fs.dirX = forcedDir;
      else if (fs.rng.next() < (st.flip !== undefined ? st.flip : 0.5)) fs.dirX = -fs.dirX;
      if (st.ink && fs.inkChance > 0 && fs.rng.next() < fs.inkChance) {
        fs.ink = true; fs.inkT = 2.5;
        ev.push({ type: 'ink', on: true });
      }
    } else if (k === 'drift') {
      var a = fs.rng.next() * Math.PI * 2;
      fs.driftX = Math.cos(a); fs.driftY = Math.sin(a);
    } else if (k === 'jump') {
      fs.jumpPhase = 0; fs.airT = 0;
      fs.stateT = fs.stateDur = 1e9;
    } else if (k === 'burrow') {
      findCover(fs);
      fs.burrowDir = sgn(fs.coverX - fs.x) || fs.dirX;
    } else if (k === 'inflate') {
      fs.inflated = true;
      ev.push({ type: 'inflate', on: true });
    }
    ev.push({ type: 'state', state: k });
  }

  function leave(fs, ev) {
    if (fs.state === 'inflate') { fs.inflated = false; ev.push({ type: 'inflate', on: false }); }
  }

  function end(fs, result, ev) {
    if (fs.result) return;
    if (fs.state === 'inflate') { fs.inflated = false; ev.push({ type: 'inflate', on: false }); }
    if (fs.ink) { fs.ink = false; ev.push({ type: 'ink', on: false }); }
    fs.airborne = false;
    fs.result = result;
    ev.push({ type: 'end', result: result });
  }

  // Nearest cover point (closest point of each cover rect, in fight coordinates). Without covers a virtual
  // cover sits 12 u to the side (dirX) and 6 u deeper than the hook site, so burrowers still threaten to fray.
  function findCover(fs) {
    var best = Infinity, bx = 0, by = 0, cv = fs.covers, ox = fs.origin.x, oy = fs.origin.y;
    for (var i = 0; cv && i < cv.length; i++) {
      var c = cv[i];
      var px = clamp(fs.x, c.x0 - ox, c.x1 - ox), py = clamp(fs.y, c.y0 - oy, c.y1 - oy);
      var dx = px - fs.x, dy = py - fs.y, d = dx * dx + dy * dy;
      if (d < best) { best = d; bx = px; by = py; }
    }
    if (best === Infinity) {
      bx = fs.x + fs.dirX * 12;
      by = Math.min(fs.y + 6, floorAt(fs, bx) - 1);
      if (!(by === by) || by < 0) by = fs.y + 6;
    }
    fs.hasCover = true; fs.coverX = bx; fs.coverY = by;
  }

  function steerDirOf(fs) {
    if (fs.state === 'run') return fs.dirX;
    if (fs.state === 'burrow') {
      // sign(cover.x − x) with a little hysteresis so the rod does not flicker when the fish sits on the cover
      var d = fs.coverX - fs.x;
      if (d > 0.5 || d < -0.5) fs.burrowDir = d > 0 ? 1 : -1;
      return fs.burrowDir || sgn(d) || fs.dirX;
    }
    return 0;
  }

  function checkPhase(fs, ev) {
    var target = fs.S > CONST.PHASE_HI ? 0 : fs.S > CONST.PHASE_LO ? 1 : 2;
    if (target <= fs.phase) return; // phases only advance
    while (fs.phase < target) {
      fs.phase++;
      var ph = fs.boss.phases[fs.phase] || fs.boss.phases[fs.boss.phases.length - 1];
      fs.style = ph.style;
      fs.vMul = ph.vMul || 1;
      if (ph.inkChance !== undefined) fs.inkChance = ph.inkChance;
      if (ph.inkRadius !== undefined) fs.inkRadius = ph.inkRadius;
      fs.gripSpecial = !!ph.grip;
      fs.tentacles = ph.tentacles || 0;
      ev.push({ type: 'phase', phase: fs.phase });
    }
    // The change is felt soon: cut the current (non-airborne) state short.
    if (fs.state !== 'tell' && fs.state !== 'jump' && fs.stateT > 0.5) fs.stateT = 0.5;
  }

  // ---------------------------------------------------------------- step
  function step(fs, input, dt) {
    var ev = fs._ev;
    ev.length = 0;
    if (!fs || fs.result) return ev;
    dt = dt || DT;
    var C = CONST, g = fs.gear;
    var reel = !!(input && input.reel);
    var rod = clamp(+(input && input.rod) || 0, -1, 1);
    if (rod !== rod) rod = 0;
    fs.reel = reel; fs.rod = rod;
    fs.t += dt;
    fs.reelIdle = reel ? 0 : fs.reelIdle + dt;

    // ---- boss phases, inflate, rise
    if (fs.boss) {
      checkPhase(fs, ev);
      if (fs.boss.riseBelow && !fs.rising && fs.S < fs.boss.riseBelow) {
        fs.rising = true;
        if (fs.state !== 'jump') { leave(fs, ev); enter(fs, 'rise', ev); }
      }
    }
    var style = STYLES[fs.style] || STYLES.puller;
    if (style.inflate && !fs.inflateDone && fs.S < (fs.special.inflateAt || 0.7) && fs.state !== 'jump') {
      fs.inflateDone = true;
      leave(fs, ev);
      enter(fs, 'inflate', ev);
    }
    // ---- scripted runs (tutorial)
    if (fs.runIdx < fs.runs.length && fs.t >= fs.runs[fs.runIdx].at && fs.state !== 'jump' && fs.state !== 'tell') {
      var sr = fs.runs[fs.runIdx++];
      leave(fs, ev);
      begin(fs, 'run', ev, sr.dir || -fs.dirX);
    }
    // ---- ink timer
    if (fs.ink) {
      fs.inkT -= dt;
      if (fs.inkT <= 0) { fs.ink = false; ev.push({ type: 'ink', on: false }); }
    }
    // ---- state timer
    if (fs.state !== 'jump') {
      fs.stateT -= dt;
      if (fs.stateT <= 0) {
        if (fs.state === 'tell') enter(fs, fs.next || 'rest', ev, fs._forcedDir);
        else { leave(fs, ev); pickNext(fs, ev, false); }
      }
    }
    if (fs.result) return ev; // slip on a tell

    // ---- kinematics
    var S = fs.S, L = fs.L > 1e-6 ? fs.L : 1e-6;
    var ux = fs.x / L, uy = fs.y / L;
    var v = fs.V * (0.4 + 0.6 * S) * fs.vMul;
    var vx = 0, vy = 0, k = fs.state;
    var t = fs.t;
    switch (k) {
      case 'run': vx = fs.dirX * v; vy = uy * 0.3 * v; break;
      case 'dive': vy = v; break;
      case 'rise': vy = -0.5 * v; break;
      case 'pull': vx = ux * 0.6 * v; vy = uy * 0.6 * v; break;
      case 'burrow': {
        var bdx = fs.coverX - fs.x, bdy = fs.coverY - fs.y, bd = Math.sqrt(bdx * bdx + bdy * bdy);
        if (bd > 1e-6) {
          var arrive = Math.min(1, bd / CONST.BURROW_ARRIVE);
          vx = bdx / bd * 0.6 * v * arrive; vy = bdy / bd * 0.6 * v * arrive;
        }
        break;
      }
      case 'rest': case 'tell': vx = ux * 0.15 * v; vy = uy * 0.15 * v; break;
      case 'inflate': vx = ux * 0.1 * v; vy = uy * 0.1 * v; break;
      case 'drift': vx = fs.driftX * 0.2 * v; vy = fs.driftY * 0.2 * v; break;
      case 'shake': vx = Math.sin(30 * t) * 2; break;
      case 'jump':
        if (fs.jumpPhase === 0) { vx = fs.dirX * 0.3 * v; vy = -2 * v; }
        else vx = fs.dirX * 0.6 * v;
        break;
      default: break; // grip, roll
    }

    // ---- force and tension
    var pm;
    if (fs.airborne) pm = reel ? C.AIR_PM_REEL : C.AIR_PM_IDLE;
    else if (k === 'shake') pm = PULL_MUL.shake + 0.35 * Math.sin(Math.PI * 2 * 5 * t);
    else pm = PULL_MUL[k] !== undefined ? PULL_MUL[k] : 0.25;
    var F = fs.P * fs.sz * pm * (fs.airborne ? 1 : (0.35 + 0.65 * S));
    fs.F = F;
    var steerDir = steerDirOf(fs);
    fs.steerDir = steerDir;
    var counter = clamp(-rod * steerDir, -1, 1);
    fs.counter = counter;
    var steerMul = 1 - C.STEER_T * counter * g.St;
    var gain = reel ? clamp(1 - F / (g.Ls * C.GAIN_DIV), C.GAIN_MIN, 1) * (C.FRESH_GAIN + (1 - C.FRESH_GAIN) * (1 - S)) : 0;
    if (fs.boss && fs.phase < 2) gain *= clamp((fs.L - C.BOSS_HOLD) / 10, 0, 1);
    var targetT = F * (reel ? 1 : C.IDLE_LOAD) * steerMul / g.Ls + (fs.tear ? C.SOFT_DRAG * gain : 0);
    var rate = targetT > fs.T ? fs.riseRate : C.FALL_RATE;
    fs.T += (targetT - fs.T) * (1 - Math.exp(-dt * rate));
    if (fs.T < 0) fs.T = 0; else if (fs.T > C.T_MAX) fs.T = C.T_MAX;
    if (!reel && F < 0.2) {
      var vr = vx * ux + vy * uy;
      if (vr > 0) { vx -= ux * vr; vy -= uy * vr; }
    }
    var reelV = g.reelSpeed * gain;

    // ---- integrate
    if (fs.airborne) {
      fs.x += (vx - ux * reelV + rod * C.ROD_PULL * g.St) * dt;
      fs.airT += dt;
      var ph = clamp(fs.airT / C.AIR_TIME, 0, 1);
      fs.y = -C.JUMP_HEIGHT * Math.sin(Math.PI * ph);
    } else {
      fs.x += (vx - ux * reelV + rod * C.ROD_PULL * g.St) * dt;
      fs.y += (vy - uy * reelV) * dt;
    }
    var lim = 1.5 * fs.viewCols;
    if (fs.x > lim) fs.x = lim; else if (fs.x < -lim) fs.x = -lim;
    var floor = floorAt(fs, fs.x);
    if (fs.airborne) { if (fs.y < -C.JUMP_HEIGHT) fs.y = -C.JUMP_HEIGHT; }
    else if (fs.y < 0) fs.y = 0;
    if (fs.y > floor) fs.y = floor;

    // ---- jump sub-phases
    if (k === 'jump') {
      if (fs.jumpPhase === 0 && fs.y <= 0.5) {
        fs.jumpPhase = 1; fs.airborne = true; fs.airT = 0;
        ev.push({ type: 'air', on: true });
      } else if (fs.jumpPhase === 1 && fs.airT >= C.AIR_TIME) {
        fs.airborne = false; fs.y = C.LAND_Y; fs.jumpPhase = 0;
        ev.push({ type: 'air', on: false });
        enter(fs, 'rest', ev);
      }
    }
    fs.L = Math.sqrt(fs.x * fs.x + fs.y * fs.y);

    // ---- burrow cover distance and fray
    if (k === 'burrow') {
      var cdx = fs.coverX - fs.x, cdy = fs.coverY - fs.y;
      fs.coverDist = Math.sqrt(cdx * cdx + cdy * cdy);
    } else fs.coverDist = Infinity;
    if (k === 'burrow' && fs.coverDist < C.COVER_DIST) fs.fray += C.FRAY_RATE * dt;
    else if (fs.fray > 0) fs.fray = Math.max(0, fs.fray - C.FRAY_DECAY * dt);
    var f10 = Math.floor(fs.fray * 10);
    if (f10 !== fs.lastFray10) { fs.lastFray10 = f10; ev.push({ type: 'fray', value: Math.round(fs.fray * 100) / 100 }); }

    // ---- stamina
    var T = fs.T;
    if (T < C.SLACK) fs.S = Math.min(1, S + C.RECOVER / fs.stam * dt);
    else {
      var band = (T >= C.ZONE_LO && T <= C.ZONE_HI) ? 1 : T < C.ZONE_LO ? C.DRAIN_LOW : C.DRAIN_HIGH;
      fs.S = Math.max(0, S - band * (1 + C.STEER_DRAIN * Math.max(0, counter) * g.St) *
        (k === 'rest' ? C.REST_DRAIN : 1) / fs.stam * dt);
    }

    // ---- failures
    if (T >= 1) fs.snapT += dt; else fs.snapT = Math.max(0, fs.snapT - 2 * dt);
    if ((k === 'run' || k === 'shake' || k === 'pull') && T < C.SLACK) fs.slackT += dt; else fs.slackT = 0;
    if (fs.airborne && T > C.THROW_BASE + C.THROW_HOLD * g.H) fs.throwT += dt; else fs.throwT = 0;
    if (fs.tear && T > fs.tear) fs.tearT += dt; else fs.tearT = 0;
    if (!fs.noEscape) {
      if (fs.snapT > g.snapGrace) end(fs, 'snap', ev);
      else if (fs.slackT > C.SLACK_BASE + C.SLACK_HOLD * g.H) end(fs, 'slack', ev);
      else if (fs.throwT > C.THROW_TIME) end(fs, 'thrown', ev);
      else if (fs.tear && fs.tearT > C.TEAR_TIME) end(fs, 'tear', ev);
      else if (fs.fray >= 1) end(fs, 'fray', ev);
      else if (fs.L > g.maxLen) end(fs, 'spooled', ev);
      else if (fs.reelIdle > C.LOOSE_TIME) end(fs, 'loose', ev);
    } else {
      // tutorial: nothing can go wrong; keep the fish inside the line
      if (fs.snapT > g.snapGrace * 0.8) fs.snapT = g.snapGrace * 0.8;
      if (fs.fray > 0.9) fs.fray = 0.9;
      if (fs.L > g.maxLen - 2) { var s = (g.maxLen - 2) / fs.L; fs.x *= s; fs.y *= s; fs.L = g.maxLen - 2; }
    }
    if (!fs.result && fs.L < C.LAND_DIST && reel) end(fs, 'landed', ev);
    return ev;
  }

  // ---------------------------------------------------------------- autopilot (§4.7)
  function autopilot(fs, out) {
    var o = out || { reel: false, rod: 0 };
    if (!fs || fs.result) { o.reel = false; o.rod = 0; return o; }
    var k = fs.state === 'tell' ? fs.next : fs.state;
    var strong = k === 'run' || k === 'dive' || k === 'grip' || k === 'burrow';
    o.reel = fs.T < (strong ? 0.55 : 0.72) && k !== 'jump' && !fs.airborne && !(fs.tear && fs.T > fs.tear - 0.15);
    o.rod = (fs.state === 'run' || fs.state === 'burrow') ? -steerDirOf(fs) : 0;
    return o;
  }

  // Danger summary for HUD/audio: 0..1 (how close the active failure timers are to ending the fight).
  function danger(fs) {
    if (!fs || fs.result) return 0;
    var C = CONST, g = fs.gear, d = 0;
    d = Math.max(d, fs.snapT / Math.max(0.01, g.snapGrace));
    d = Math.max(d, fs.slackT / (C.SLACK_BASE + C.SLACK_HOLD * g.H));
    d = Math.max(d, fs.throwT / C.THROW_TIME);
    if (fs.tear) d = Math.max(d, fs.tearT / C.TEAR_TIME);
    d = Math.max(d, fs.fray);
    d = Math.max(d, fs.L / g.maxLen > 0.85 ? (fs.L / g.maxLen - 0.85) / 0.15 : 0);
    return clamp(d, 0, 1);
  }

  AQ.fight = {
    DT: DT,
    CONST: CONST,
    STYLES: STYLES,
    PULL_MUL: PULL_MUL,
    DUR: DUR,
    BOSSES: BOSSES,
    NEEDS_TELL: NEEDS_TELL,
    create: create,
    step: step,
    autopilot: autopilot,
    danger: danger
  };
})(window.AQ);
