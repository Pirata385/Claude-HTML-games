// STUB created by A (phase 0). Owner C replaces this file entirely. Neutral returns only (§15.3 stub rule).
(function (AQ) {
  'use strict';
  AQ.line = {
    createRope: function (n) { return { points: [] }; },
    stepRope: function (rope, a, b, length, dt, opts) {},
    rasterize: function (rope, out, opts) { var o = out || []; o.length = 0; return o; },
    glyphFor: function (dx, dy, tension) { return '|'; },
    trajectory: function (origin, power, dir, castMax) { return { points: [], landX: 0, flightTime: 0 }; }
  };
})(window.AQ);
