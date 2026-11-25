// STUB created by A (phase 0). Owner C replaces this file entirely. Neutral returns only (§15.3 stub rule).
(function (AQ) {
  'use strict';
  var F = AQ.fishing = AQ.fishing || {};
  F.phase = 'idle';
  F.script = function (opts) {};
  F.anchor = function (name) { return null; };
  F.debugSpawn = function (id) {};
  F.debugLand = function (id) { return Promise.resolve(); };
  AQ.scenes.register('fishing', {
    enter: function (params) {},
    exit: function () {},
    update: function (dt) {},
    draw: function (t) {}
  });
})(window.AQ);
