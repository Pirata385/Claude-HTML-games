// Água-Tinta — bite timing (owner C). Pure. §4.6.
// A BiteState follows one engaged fish: idle (approaching/circling) → nibble(s) → open (the bite window) → done.
// Times are in seconds on any monotonic clock the caller chooses (the scene uses its own scene time).
(function (AQ) {
  'use strict';

  var WIDE_MUL = 1.5;

  function wideOn(settings) {
    if (!settings) return false;
    if (typeof settings.get === 'function') return !!settings.get('wideWindows');
    return !!settings.wideWindows;
  }

  // window(species, gear, settings) → seconds = species.biteWindow + gear.window (× 1.5 with wideWindows).
  // settings may be AQ.settings or a plain {wideWindows, biteWindow?}; biteWindow overrides the species window
  // (tutorial: 2.0 s).
  function window(species, gear, settings) {
    var base = settings && typeof settings.biteWindow === 'number' ? settings.biteWindow
      : (species && typeof species.biteWindow === 'number' ? species.biteWindow : 0.75);
    var w = base + (settings && typeof settings.biteWindow === 'number' ? 0 : ((gear && gear.window) || 0));
    return w * (wideOn(settings) ? WIDE_MUL : 1);
  }

  function create(species, gear, settings) {
    return {
      sp: species ? species.id : null,
      window: window(species, gear, settings),
      state: 'idle',      // 'idle' | 'nibble' | 'open' | 'done'
      nibbles: 0,
      lastNibble: -1,
      openAt: -1,
      closeAt: -1,
      result: null        // 'hooked' | 'early' | 'late' once resolved
    };
  }

  function nibble(bs, now) {
    if (!bs || bs.state === 'open' || bs.state === 'done') return;
    bs.state = 'nibble';
    bs.nibbles++;
    bs.lastNibble = now;
  }

  function open(bs, now) {
    if (!bs || bs.state === 'done') return;
    bs.state = 'open';
    bs.openAt = now;
    bs.closeAt = now + bs.window;
  }

  // strike(bs, now) → 'hooked' (inside the window) | 'early' (before the bite: idle or nibbling) | 'late'.
  function strike(bs, now) {
    if (!bs) return 'late';
    var r;
    if (bs.state === 'open') r = now <= bs.closeAt ? 'hooked' : 'late';
    else if (bs.state === 'done') r = bs.result === 'hooked' ? 'hooked' : 'late';
    else r = 'early';
    bs.state = 'done';
    bs.result = r;
    return r;
  }

  // expired(bs, now) → true once the window has closed without a strike.
  function expired(bs, now) {
    return !!bs && bs.state === 'open' && now > bs.closeAt;
  }

  // remaining(bs, now) → 0..1 of the window left (HUD).
  function remaining(bs, now) {
    if (!bs || bs.state !== 'open' || !(bs.window > 0)) return 0;
    var r = (bs.closeAt - now) / bs.window;
    return r < 0 ? 0 : r > 1 ? 1 : r;
  }

  AQ.bite = {
    WIDE_MUL: WIDE_MUL,
    window: window,
    create: create,
    nibble: nibble,
    open: open,
    strike: strike,
    expired: expired,
    remaining: remaining
  };
})(window.AQ);
