// Água-Tinta — main loop (owner A). Frame order (§15.5): gamepad → dt → update → world tick (1 s) →
// bg grid (at bgHz, or at once when the camera crossed a row) → main draw → top layer → perf sample.
// Main is capped at 60 fps with a target-time scheduler (works on 60/75/90/120/144 Hz displays).
// The loop stops while the tab is hidden (main.js) and never runs two rAF chains.
(function (AQ) {
  'use strict';

  var raf = 0, last = 0, nextAt = 0, bgAcc = 1, worldAcc = 0;
  var FRAME = 1000 / 60;
  var CLOCK_SCENES = { map: 1, fishing: 1, aquarium: 1 };
  var now = (typeof performance !== 'undefined' && performance.now) ? function () { return performance.now(); } : Date.now;

  var L = AQ.loop = {
    running: false,
    time: 0,        // seconds of unpaused time
    realTime: 0,    // seconds rendered (incl. pause)
    frame: 0,
    dt: 0,
    start: function () {
      if (L.running) return;
      L.running = true;
      last = 0; nextAt = 0;
      bgAcc = 1;
      raf = requestAnimationFrame(frame);
    },
    stop: function () {
      L.running = false;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    },
    // Runs one frame immediately (tests, debug stepping while stopped).
    step: function (ms) { frame((last || now()) + (ms || FRAME), true); }
  };

  function guard(label, fn) {
    try { fn(); } catch (e) { console.error('[AQ.loop] ' + label + ' failed:', e); }
  }

  function frame(ts, manual) {
    if (!manual) {
      if (!L.running) return;
      raf = requestAnimationFrame(frame);
      if (last && ts < nextAt - 1) return; // 60 fps cap
      nextAt = Math.max(nextAt + FRAME, ts);
      if (nextAt > ts + FRAME) nextAt = ts + FRAME;
    }
    var elapsed = last ? ts - last : FRAME;
    last = ts;
    var t0 = now();
    L.frame++;
    var S = AQ.scenes, R = AQ.render;

    // 1. gamepad
    guard('input.poll', AQ.input.poll);
    // 2. dt
    var dt = Math.min(Math.max(elapsed / 1000, 0), 0.05);
    L.dt = dt;
    L.realTime += dt;
    // 3. update (unless paused)
    if (!S.paused) {
      L.time += dt;
      S.update(dt);
      guard('fx.update', function () { AQ.fx.update(dt); });
      // 4. world clock: 1 s of unpaused time in map / fishing / aquarium
      if (CLOCK_SCENES[S.current] && !S.transitioning) {
        worldAcc += dt;
        while (worldAcc >= 1) {
          worldAcc -= 1;
          guard('world.tick', function () { AQ.world.tick(AQ.state, 1); });
          guard('game.tick', function () { AQ.game.tick(1); });
          if (AQ.state && AQ.state.meta) AQ.state.meta.playSec += 1;
          AQ.store.markDirty();
        }
      }
    }
    // 5. bg grid at bgHz, or immediately when the row-snapped camera moved (keeps the sub-row scroll exact)
    var bgHz = (AQ.perf.params && AQ.perf.params.bgHz) || 30;
    bgAcc += elapsed / 1000;
    if (bgAcc >= 1 / bgHz || R.grid.camMoved()) {
      bgAcc = bgAcc >= 1 / bgHz ? bgAcc % (1 / bgHz) : bgAcc;
      R.grid.clear();
      S.drawBg(R.grid, L.time);
      guard('grid.commit', function () { R.grid.commit(); });
    }
    // 6. main
    R.beginFrame();
    S.draw(L.time);
    // 7. top layer (transitions, flash)
    R.beginTop();
    guard('fx.drawTop', function () { AQ.fx.drawTop(Math.min(elapsed / 1000, 0.1)); });
    R.endFrame();
    // 8. perf
    AQ.perf.sample(elapsed, now() - t0);
  }
})(window.AQ);
