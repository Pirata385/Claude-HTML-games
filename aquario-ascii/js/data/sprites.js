// STUB created by A (phase 0). Owner B replaces this file entirely. Neutral returns only (§15.3 stub rule).
(function (AQ) {
  'use strict';
  var warned = {};
  var PLACEHOLDER = { frames: [['?'], ['?']], extra: {}, masks: null, fps: 1, deform: 'none', amp: 1, glow: null, scramble: false };
  AQ.sprites = {
    // get(key) → SpriteDef (missing → '?' placeholder + console.warn)
    get: function (key) {
      var s = AQ.sprites[key];
      if (s && s.frames) return s;
      if (!warned[key]) { warned[key] = 1; console.warn('[AQ.sprites] missing sprite: ' + key); }
      return PLACEHOLDER;
    }
  };
})(window.AQ);
