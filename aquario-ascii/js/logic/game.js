// STUB created by A (phase 0). Owner D replaces this file entirely. Neutral returns only (§15.3 stub rule).
(function (AQ) {
  'use strict';
  AQ.game = {
    newGame: function () { return AQ.state; },
    resolveCatch: function (specimen, opts) { return { value: 0, isNew: false, isRecord: false, fish: null }; },
    markSeen: function (spId) {},
    markSighting: function (id) { return false; },
    foundMessage: function () { return null; },
    bottleCoins: function (zoneId) { return 0; },
    buy: function (itemId, opts) { return { ok: false, reason: 'req' }; },
    equipBait: function (baitId) { return false; },
    consumeBait: function () { return AQ.state.player.bait; },
    addBait: function (baitId, n) {},
    sellFish: function (uid) { return 0; },
    releaseFish: function (uid) { return false; },
    moveFish: function (uid, tankId) { return false; },
    renameFish: function (uid, name) { return false; },
    feedTank: function (tankId) { return false; },
    collectTill: function () { return 0; },
    placeDecor: function (tankId, slot, decorId) { return false; },
    setTankLight: function (tankId, light) {},
    tick: function (dtSec) {},
    applyOffline: function (nowMs) { return null; },
    stat: function (name, delta) {},
    wait: function (phase) { return 0; },
    luck: function (zoneId) { return 0; },
    addLuck: function (zoneId, v) {},
    resetLuck: function () {}
  };
})(window.AQ);
