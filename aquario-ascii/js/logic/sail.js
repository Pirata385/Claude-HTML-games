// Água-Tinta — boat sailing kinematics (owner C). Pure: no DOM, no AQ.state, no randomness.
// The boat moves along the surface (world x, 1 unit = 1 column). Thrust spools up (ease in), water drag and a little
// friction bring it to rest (ease out); the top speed is reached when thrust balances drag.
//   create(x) → boat {x, vx, thrust, nudge, nudgeDir}
//   nudge(b, dir)              a tap: thrust toward dir for at least CONST.NUDGE seconds
//   step(b, input, dt, opts?)  input −1..1 (held thrust; analog allowed); opts {anchor: true} = not allowed to sail
//                              (line out, fight): no thrust and a strong drag. → b
//   moving(b) → bool,  speedFrac(b) → 0..1
(function (AQ) {
  'use strict';

  var CONST = {
    MAX: 12,         // top speed (columns / s), reached with full thrust
    DRAG: 1.6,       // water drag (1 / s)
    FRICTION: 1.5,   // constant deceleration (columns / s²) so the boat really comes to rest
    SPOOL: 7,        // thrust follows the input at this rate (1 / s): acceleration starts soft
    NUDGE: 0.3,      // a tap thrusts at least this long (s) → ~2 columns
    ANCHOR: 7,       // extra drag (1 / s) while sailing is not allowed
    LIMIT: 100000    // |x| clamp (the world is endless; this only keeps floats sane)
  };
  // full thrust balances drag + friction exactly at MAX
  CONST.ACCEL = CONST.MAX * CONST.DRAG + CONST.FRICTION;

  function create(x) { return { x: +x || 0, vx: 0, thrust: 0, nudge: 0, nudgeDir: 0 }; }

  function nudge(b, dir) {
    if (!dir) return b;
    b.nudge = CONST.NUDGE;
    b.nudgeDir = dir > 0 ? 1 : -1;
    return b;
  }

  function step(b, input, dt, opts) {
    var C = CONST;
    if (!(dt > 0)) return b;
    if (dt > 0.1) dt = 0.1;
    var anchor = !!(opts && opts.anchor);
    var u = +input || 0;
    if (u > 1) u = 1; else if (u < -1) u = -1;
    if (anchor) { u = 0; b.nudge = 0; b.thrust = 0; }
    if (!u && b.nudge > 0) u = b.nudgeDir;
    if (b.nudge > 0) b.nudge = Math.max(0, b.nudge - dt);
    // thrust spool (exact exponential approach, frame-rate independent)
    b.thrust += (u - b.thrust) * (1 - Math.exp(-C.SPOOL * dt));
    if (Math.abs(b.thrust) < 1e-3 && !u) b.thrust = 0;
    var v = b.vx;
    var drag = C.DRAG + (anchor ? C.ANCHOR : 0);
    var a = C.ACCEL * b.thrust - drag * v;
    var fr = v > 0 ? -C.FRICTION : v < 0 ? C.FRICTION : 0;
    var nv = v + (a + fr) * dt;
    // friction never reverses the motion by itself
    if (!b.thrust && ((v > 0 && nv < 0) || (v < 0 && nv > 0) || Math.abs(nv) < 1e-3)) nv = 0;
    if (nv > C.MAX) nv = C.MAX; else if (nv < -C.MAX) nv = -C.MAX;
    b.x += (v + nv) * 0.5 * dt;
    b.vx = nv;
    if (b.x > C.LIMIT) { b.x = C.LIMIT; b.vx = Math.min(0, b.vx); }
    else if (b.x < -C.LIMIT) { b.x = -C.LIMIT; b.vx = Math.max(0, b.vx); }
    return b;
  }

  function moving(b) { return !!b && (b.vx !== 0 || b.thrust !== 0); }
  function speedFrac(b) { return b ? Math.min(1, Math.abs(b.vx) / CONST.MAX) : 0; }

  AQ.sail = { CONST: CONST, create: create, nudge: nudge, step: step, moving: moving, speedFrac: speedFrac };
})(window.AQ);
