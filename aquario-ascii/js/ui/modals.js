// STUB created by A (phase 0). Owner E replaces this file entirely. Neutral returns only (§15.3 stub rule).
(function (AQ) {
  'use strict';
  var ui = AQ.ui = AQ.ui || {};
  ui.toast = function (msg, opts) {};
  ui.confirm = function (opts) { return Promise.resolve(false); };
  ui.note = function (id) { return Promise.resolve(); };
  ui.hint = function (id, opts) {};
  ui.clearHint = function (id) {};
})(window.AQ);
