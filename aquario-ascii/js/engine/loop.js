// Água-Tinta — main loop (owner A). Frame order (§15.5): gamepad → dt → update → world tick (1 s) →
// bg grid at bgHz → main draw → top layer → perf sample. Main capped at 60 fps.
(function (AQ) {
  'use strict';

  var raf = 0, last = 0, bgAcc = 1, worldAcc = 0;
  var CLOCK_SCENES = { map: 1, fishing: 1, aquarium: 1 };

  var L = AQ.loop = {
    running: false,
    time: 0,        // seconds of unpaused time
    frame: 0,
    start: function () {
      if (L.running) return;
      L.running = true;
      last = 0;
      bgAcc = 1;
      raf = requestAnimationFrame(frame);
    },
    stop: function () {
      L.running = false;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    }
  };

  function guard(label, fn) {
    try { fn(); } catch (e) { console.error('[AQ.loop] ' + label + ' failed:', e); }
  }

  function frame(ts) {
    if (!L.running) return;
    raf = requestAnimationFrame(frame);
    var elapsed = last ? ts - last : 16.7;
    if (last && elapsed < 15.5) return; // 60 fps cap
    last = ts;
    L.frame++;
    var S = AQ.scenes, R = AQ.render;

    // 1. gamepad
    guard('input.poll', AQ.input.poll);
    // 2. dt
    var dt = Math.min(Math.max(elapsed / 1000, 0), 0.05);
    // 3. update (unless paused)
    if (!S.paused) {
      L.time += dt;
      S.update(dt);
      AQ.fx.update(dt);
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
    // 5. bg grid at bgHz
    var bgHz = (AQ.perf.params && AQ.perf.params.bgHz) || 30;
    bgAcc += elapsed / 1000;
    if (bgAcc >= 1 / bgHz) {
      bgAcc = bgAcc % (1 / bgHz);
      R.grid.clear();
      S.drawBg(R.grid, L.time);
      guard('grid.commit', function () { R.grid.commit(); });
    }
    // 6. main
    R.beginFrame();
    S.draw(L.time);
    // 7. top layer
    R.beginTop();
    guard('fx.drawTop', function () { AQ.fx.drawTop(elapsed / 1000); });
    R.endFrame();
    // 8. perf
    AQ.perf.sample(elapsed);
  }
})(window.AQ);
