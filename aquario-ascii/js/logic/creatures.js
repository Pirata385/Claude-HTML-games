// STUB created by A (phase 0). Owner B replaces this file entirely. Neutral returns only (§15.3 stub rule).
(function (AQ) {
  'use strict';
  var uid = 0;
  AQ.creatures = {
    create: function (id, opts, rng) {
      var o = opts || {};
      return { uid: ++uid, sp: id, x: o.x || 0, y: o.y || 0, vx: 0, vy: 0, dir: o.dir || 1, w: 1, h: 1, frame: 0, t: 0,
               state: 'idle', alpha: 1, specimen: o.specimen || null, fishUid: o.fish ? o.fish.uid : null, hooked: false, data: {} };
    },
    update: function (list, dt, env) {},
    draw: function (c, env) {},
    drawList: function (list, env) {},
    hitTest: function (c, wx, wy) { return false; },
    bounds: function (c) { return { x0: c.x, y0: c.y, x1: c.x, y1: c.y }; },
    setHooked: function (c, on) { c.hooked = !!on; },
    spook: function (c, sec) {},
    remove: function (list, c) { var i = list.indexOf(c); if (i >= 0) list.splice(i, 1); }
  };
})(window.AQ);
