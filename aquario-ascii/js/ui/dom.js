// STUB created by A (phase 0). Owner E replaces this file entirely. Neutral returns only (§15.3 stub rule).
(function (AQ) {
  'use strict';
  var ui = AQ.ui = AQ.ui || {};
  ui.screens = ['title', 'pause', 'settings', 'saveIO', 'credits', 'shop', 'bestiary', 'goals', 'zoneCard', 'catchCard',
                'fishCard', 'decorPicker', 'tankPicker', 'baitPicker', 'offline', 'note', 'confirm'];
  ui.init = function (rootEl) {};
  ui.show = function (name, params) { return Promise.resolve(null); };
  ui.hide = function (name) {};
  ui.isOpen = function (name) { return false; };
  ui.isModal = function () { return false; };
  ui.hudInsets = function () { return { top: 0, bottom: 0, left: 0, right: 0 }; };
  ui.applyI18n = function (root) {};
})(window.AQ);
