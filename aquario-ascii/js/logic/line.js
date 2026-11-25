// Água-Tinta — fishing line (owner C). Pure. Verlet rope, rope → glyph rasterising, cast trajectory (§4.3, §2.4).
// World units: x right, y down, 1 u = 1 column, one row = AQ.ASPECT (2) u — so world units are visually square
// and slopes are measured in them.
(function (AQ) {
  'use strict';

  var ASPECT = AQ.ASPECT || 2;
  var LAUNCH = 50 * Math.PI / 180, GRAV = 60, MIN_CAST = 6;

  // ---------------------------------------------------------------- rope
  function createRope(n) {
    var k = Math.max(3, n | 0 || 24);
    return {
      n: k,
      px: new Float64Array(k), py: new Float64Array(k),
      ox: new Float64Array(k), oy: new Float64Array(k),
      length: 0, seg: 0, waterY: 0, init: false
    };
  }

  // Lays the rope straight from a to b (call after teleports, e.g. a new cast).
  function resetRope(rope, a, b) {
    var n = rope.n;
    for (var i = 0; i < n; i++) {
      var t = i / (n - 1);
      rope.px[i] = rope.ox[i] = a.x + (b.x - a.x) * t;
      rope.py[i] = rope.oy[i] = a.y + (b.y - a.y) * t;
    }
    rope.init = true;
  }

  // stepRope(rope, a, b, length, dt, opts:{gravity=30, iterations=4, waterY=0, waterGravity=.3, airDamp=.985,
  //   waterDamp=.9}). a = rod tip, b = hook (both pinned). length < |b − a| is treated as taut (straight).
  function stepRope(rope, a, b, length, dt, opts) {
    var o = opts || {};
    var n = rope.n, px = rope.px, py = rope.py, ox = rope.ox, oy = rope.oy;
    if (!rope.init) resetRope(rope, a, b);
    var g = o.gravity === undefined ? 30 : o.gravity;
    var wg = g * (o.waterGravity === undefined ? 0.3 : o.waterGravity);
    var airD = o.airDamp === undefined ? 0.985 : o.airDamp;
    var watD = o.waterDamp === undefined ? 0.9 : o.waterDamp;
    var waterY = o.waterY === undefined ? 0 : o.waterY;
    var iters = Math.max(1, o.iterations | 0 || 4);
    var h = Math.min(dt || 1 / 60, 1 / 30), h2 = h * h;
    rope.waterY = waterY;

    var dx = b.x - a.x, dy = b.y - a.y, dist = Math.sqrt(dx * dx + dy * dy);
    var L = Math.max(length || 0, dist);
    rope.length = L;
    var seg = rope.seg = L / (n - 1);

    // verlet integrate the free points
    for (var i = 1; i < n - 1; i++) {
      var x = px[i], y = py[i], under = y > waterY;
      var d = under ? watD : airD;
      var vx = (x - ox[i]) * d, vy = (y - oy[i]) * d;
      ox[i] = x; oy[i] = y;
      px[i] = x + vx;
      py[i] = y + vy + (under ? wg : g) * h2;
    }
    px[0] = ox[0] = a.x; py[0] = oy[0] = a.y;
    px[n - 1] = ox[n - 1] = b.x; py[n - 1] = oy[n - 1] = b.y;

    // distance constraints (alternating sweep directions converge faster)
    for (var it = 0; it < iters; it++) {
      var fwd = (it & 1) === 0;
      for (var s = 0; s < n - 1; s++) {
        var j = fwd ? s : n - 2 - s;
        var x0 = px[j], y0 = py[j], x1 = px[j + 1], y1 = py[j + 1];
        var ex = x1 - x0, ey = y1 - y0, el = Math.sqrt(ex * ex + ey * ey);
        if (el < 1e-9) continue;
        var diff = (el - seg) / el;
        var w0 = j === 0 ? 0 : (j + 1 === n - 1 ? 1 : 0.5);
        var w1 = j + 1 === n - 1 ? 0 : (j === 0 ? 1 : 0.5);
        px[j] += ex * diff * w0; py[j] += ey * diff * w0;
        px[j + 1] -= ex * diff * w1; py[j + 1] -= ey * diff * w1;
      }
    }
    // when taut, blend toward the straight line (removes residual sag in one frame)
    if (length <= dist * 1.001) {
      for (var k = 1; k < n - 1; k++) {
        var t = k / (n - 1);
        px[k] += (a.x + dx * t - px[k]) * 0.5;
        py[k] += (a.y + dy * t - py[k]) * 0.5;
      }
    }
  }

  // ---------------------------------------------------------------- glyphs
  // glyphFor(dx, dy, tension) → '|' '/' '\' '-' '_' '~' '.' "'" ','   (dx, dy in world units, y down)
  function glyphFor(dx, dy, tension) {
    var ax = dx < 0 ? -dx : dx, ay = dy < 0 ? -dy : dy;
    var slack = tension !== undefined && tension < 0.05;
    if (ax < 1e-9 && ay < 1e-9) return '.';
    // tan(22.5°) = .414, tan(67.5°) = 2.414
    if (ay < ax * 0.414) return slack ? '~' : '-';
    if (ay > ax * 2.414) return slack ? ',' : '|';
    return (dx > 0) === (dy > 0) ? '\\' : '/';
  }

  // rasterize(rope, out, opts:{tension, underwaterLevelMul=1, level=10, boldAbove=.85}) → out
  // out holds cells {wx, wy, ch, level, bold, c, r}: glyph centres on the rope, one cell apart (Chebyshev, in
  // cell units), so consecutive cells are 8-connected with no gaps and no repeats. Cell objects are pooled.
  function rasterize(rope, out, opts) {
    var o = opts || {};
    var res = out || [];
    var pool = res._pool || (res._pool = []);
    var count = 0;
    var n = rope.n, px = rope.px, py = rope.py;
    var tension = o.tension === undefined ? 0.5 : o.tension;
    var base = o.level === undefined ? 10 : o.level;
    var mul = o.underwaterLevelMul === undefined ? 1 : o.underwaterLevelMul;
    var bold = tension > (o.boldAbove === undefined ? 0.85 : o.boldAbove);
    var lvTop = bold ? Math.max(base, 13) : base;
    var waterY = rope.waterY || 0;
    if (!rope.init || n < 2) { res.length = 0; return res; }

    // cell-space walk: cx = wx, cy = wy / ASPECT
    var sx = px[0], sy = py[0] / ASPECT;     // last emitted sample (cell space)
    var lc = Math.floor(sx), lr = Math.floor(sy);
    count = emit(res, pool, count, px[0], py[0], lc, lr, px[1] - px[0], py[1] - py[0]);
    for (var i = 0; i < n - 1; i++) {
      var ax0 = px[i], ay0 = py[i] / ASPECT, ax1 = px[i + 1], ay1 = py[i + 1] / ASPECT;
      var ddx = ax1 - ax0, ddy = ay1 - ay0;
      var t = 0;
      for (var guard = 0; guard < 4096; guard++) {
        // smallest t' > t where max(|x(t') − sx|, |y(t') − sy|) reaches 1
        var tn = 2;
        if (ddx > 1e-12) tn = Math.min(tn, (sx + 1 - ax0) / ddx);
        else if (ddx < -1e-12) tn = Math.min(tn, (sx - 1 - ax0) / ddx);
        if (ddy > 1e-12) tn = Math.min(tn, (sy + 1 - ay0) / ddy);
        else if (ddy < -1e-12) tn = Math.min(tn, (sy - 1 - ay0) / ddy);
        if (!(tn > t) || tn > 1) break;
        t = tn;
        sx = ax0 + ddx * t; sy = ay0 + ddy * t;
        var c = Math.floor(sx + 1e-9 * (ddx > 0 ? 1 : -1)), r = Math.floor(sy + 1e-9 * (ddy > 0 ? 1 : -1));
        // fill if float error skipped a cell (keeps 8-connectivity), skip repeats
        while (Math.abs(c - lc) > 1 || Math.abs(r - lr) > 1) {
          lc += c > lc ? 1 : c < lc ? -1 : 0;
          lr += r > lr ? 1 : r < lr ? -1 : 0;
          count = emit(res, pool, count, lc + 0.5, (lr + 0.5) * ASPECT, lc, lr, ddx, ddy * ASPECT);
        }
        if (c === lc && r === lr) continue;
        lc = c; lr = r;
        count = emit(res, pool, count, sx, sy * ASPECT, c, r, ddx, ddy * ASPECT);
      }
    }
    // levels and glyphs
    res.length = count;
    for (var k = 0; k < count; k++) {
      var cell = res[k];
      cell.ch = glyphFor(cell._dx, cell._dy, tension);
      cell.bold = bold;
      cell.level = cell.wy > waterY ? Math.max(1, Math.round(lvTop * mul)) : lvTop;
    }
    return res;
  }

  function emit(res, pool, count, wx, wy, c, r, dx, dy) {
    var cell = pool[count];
    if (!cell) cell = pool[count] = { wx: 0, wy: 0, ch: '|', level: 10, bold: false, c: 0, r: 0, _dx: 0, _dy: 0 };
    cell.wx = wx; cell.wy = wy; cell.c = c; cell.r = r; cell._dx = dx; cell._dy = dy;
    res[count] = cell;
    return count + 1;
  }

  // ---------------------------------------------------------------- cast trajectory
  // trajectory(origin {x,y} (rod tip, y < 0 above water), power 0..1, dir ±1, castMax, opts?{minX, maxX, out, n})
  //   → {points:[{x,y}], landX, flightTime, vx, vy, g, x0, y0, dir}
  // Landing x = origin.x ± (6 + power·(castMax − 6)), clamped to [minX, maxX] when given. Ballistic, launch 50°,
  // gravity 60 u/s², landing on y = 0. Pass opts.out to refill an existing result without allocating.
  function trajectory(origin, power, dir, castMax, opts) {
    var o = opts || {};
    var p = power < 0 ? 0 : power > 1 ? 1 : (power || 0);
    var d = dir < 0 ? -1 : 1;
    var cm = Math.max(MIN_CAST, castMax || 26);
    var dist = MIN_CAST + p * (cm - MIN_CAST);
    var landX = origin.x + d * dist;
    if (o.minX !== undefined && landX < o.minX) landX = o.minX;
    if (o.maxX !== undefined && landX > o.maxX) landX = o.maxX;
    dist = Math.abs(landX - origin.x);
    if (dist < 0.5) dist = 0.5;
    var y0 = Math.min(origin.y, -0.5), c = Math.cos(LAUNCH), tn = Math.tan(LAUNCH);
    // y(x) = y0 − x·tan + g x² / (2 v² cos²) = 0  →  v² = g x² / (2 cos² (x tan − y0))
    var v = Math.sqrt(GRAV * dist * dist / (2 * c * c * (dist * tn - y0)));
    var vx = v * c, vy = v * Math.sin(LAUNCH);
    var T = dist / vx;
    var res = o.out || { points: [] };
    var np = o.n || 24, pts = res.points || (res.points = []);
    for (var i = 0; i < np; i++) {
      var t = T * i / (np - 1);
      var pt = pts[i] || (pts[i] = { x: 0, y: 0 });
      pt.x = origin.x + d * vx * t;
      pt.y = y0 - vy * t + 0.5 * GRAV * t * t;
    }
    pts.length = np;
    pts[np - 1].y = 0;
    res.landX = origin.x + d * dist;
    res.flightTime = T;
    res.vx = vx; res.vy = vy; res.g = GRAV; res.x0 = origin.x; res.y0 = y0; res.dir = d;
    return res;
  }

  // Position on a trajectory at time t (s) → out {x, y}.
  function pointAt(traj, t, out) {
    var o = out || { x: 0, y: 0 };
    var tt = t < 0 ? 0 : t > traj.flightTime ? traj.flightTime : t;
    o.x = traj.x0 + traj.dir * traj.vx * tt;
    o.y = traj.y0 - traj.vy * tt + 0.5 * traj.g * tt * tt;
    return o;
  }

  AQ.line = {
    LAUNCH: LAUNCH, GRAVITY: GRAV, MIN_CAST: MIN_CAST,
    createRope: createRope,
    resetRope: resetRope,
    stepRope: stepRope,
    rasterize: rasterize,
    glyphFor: glyphFor,
    trajectory: trajectory,
    pointAt: pointAt
  };
})(window.AQ);
