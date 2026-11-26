// Água-Tinta — haptics (owner E): navigator.vibrate behind the 'haptics' setting. Patterns from §4.6 / §4.8.
// pulse(kind, opts?{kind: tellKind}) — kind: tap | nibble | bite | hook | tell | snap | catch | coin.
// tension(v): a light periodic buzz while the line is in the danger zone (> .85).
(function (AQ) {
  'use strict';

  var PATTERNS = {
    tap: 8, nibble: 10, bite: 30, hook: [20, 30, 20], tell: 20, snap: [60, 40, 90], catch: [20, 40, 20, 40, 60], coin: 8
  };
  var TELL = { run: 20, dive: 30, jump: [15, 40, 15], shake: [10, 30, 10, 30, 10], burrow: 20, grip: 40, ink: 25 };
  var last = 0, lastTension = 0;

  function can() {
    return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function' &&
      AQ.settings && AQ.settings.get('haptics') !== false;
  }
  function vibrate(p) {
    if (!can()) return false;
    try { return navigator.vibrate(p); } catch (e) { return false; }
  }

  var H = AQ.haptics = {
    PATTERNS: PATTERNS,
    supported: function () { return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function'; },
    pulse: function (kind, opts) {
      var now = Date.now();
      if (kind === 'tap' && now - last < 40) return;
      last = now;
      var p = kind === 'tell' && opts && TELL[opts.kind] !== undefined ? TELL[opts.kind] : PATTERNS[kind];
      if (p === undefined) return;
      vibrate(p);
    },
    tension: function (v) {
      if (v === null || v === undefined || v <= 0.85) return;
      var now = Date.now();
      var gap = 380 - Math.min(1, (v - 0.85) / 0.5) * 220;
      if (now - lastTension < gap) return;
      lastTension = now;
      vibrate(12);
    }
  };

  AQ.events.on('fish:splash', function () { H.pulse('tap'); });
  AQ.events.on('bite:nibble', function () { H.pulse('nibble'); });
  AQ.events.on('bite:strike', function () { H.pulse('bite'); });
  AQ.events.on('fight:start', function () { H.pulse('hook'); });
  AQ.events.on('fight:tell', function (p) { H.pulse('tell', { kind: p && p.kind }); });
  AQ.events.on('fight:end', function (p) { if (p && (p.result === 'snap' || p.result === 'fray')) H.pulse('snap'); });
  AQ.events.on('catch:landed', function () { H.pulse('catch'); });
  AQ.events.on('aquarium:collected', function () { H.pulse('coin'); });
  AQ.events.on('settings:changed', function (p) { if (p && p.key === 'haptics' && p.value) vibrate(15); });
})(window.AQ);
