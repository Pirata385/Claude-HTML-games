// STUB created by A (phase 0). Owner B replaces this file entirely. Neutral returns only (§15.3 stub rule).
(function (AQ) {
  'use strict';
  AQ.world = {
    MIN_PER_SEC: 1,
    TRANSITIONS: {},
    phaseOf: function (minutes) { return 'dia'; },
    now: function (state) { return { minutes: 0, day: 0, hour: 0, minute: 0, phase: 'dia', weather: 'limpo' }; },
    tick: function (state, realSec, rng) { return []; },
    advanceTo: function (state, phase) { return 0; },
    forecast: function (state, n) { return []; },
    light: function (state, zoneId, depthFrac) { return 1; },
    isDark: function (state, zoneId, depthFrac) { return false; }
  };
})(window.AQ);
