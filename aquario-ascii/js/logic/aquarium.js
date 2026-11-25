// STUB created by A (phase 0). Owner D replaces this file entirely. Neutral returns only (§15.3 stub rule).
(function (AQ) {
  'use strict';
  AQ.aquarium = {
    tankUsage: function (tank, state) { return { used: 0, cap: 0, bioload: 0, filterCap: 0 }; },
    canFit: function (spOrSpecimen, tank, state) { return false; },
    bestTankFor: function (specimen, state) { return null; },
    fishHappiness: function (fish, tank, state) { return { value: 0, factors: {} }; },
    tankHappiness: function (tank, state) { return 0; },
    tankAttraction: function (tank, state) { return 0; },
    attraction: function (state) { return 0; },
    stars: function (state) { return 1; },
    face: function (h) { return ':|'; },
    tick: function (state, dtSec, rng, opts) { return []; }
  };
})(window.AQ);
