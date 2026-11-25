// STUB created by A (phase 0). Owner D replaces this file entirely. Neutral returns only (§15.3 stub rule).
(function (AQ) {
  'use strict';
  AQ.economy = {
    gear: function (state) { return {}; },
    specimenValue: function (specimen) { return 0; },
    fishSellValue: function (fish) { return 0; },
    priceOf: function (itemId, state, opts) { return null; },
    requirementsMet: function (itemId, state, opts) { return { ok: false, missing: [] }; },
    canAfford: function (price, state) { return false; },
    incomePerMinute: function (state) { return 0; },
    offlineEarnings: function (state, awayMs) { return { coins: 0, pearls: 0, capped: false }; },
    feedCost: function (tank, state) { return 0; }
  };
})(window.AQ);
