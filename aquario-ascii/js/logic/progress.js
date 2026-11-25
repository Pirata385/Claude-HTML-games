// STUB created by A (phase 0). Owner D replaces this file entirely. Neutral returns only (§15.3 stub rule).
(function (AQ) {
  'use strict';
  AQ.progress = {
    zoneUnlocked: function (zoneId, state) { return false; },
    zoneRequirements: function (zoneId, state) { return { ok: false, items: [] }; },
    activeGoals: function (state) { return []; },
    goalProgress: function (goal, state) { return { cur: 0, max: 0 }; },
    check: function (state) { return []; },
    completion: function (state) { return { caught: 0, seen: 0, total: 45, pct: 0 }; }
  };
})(window.AQ);
