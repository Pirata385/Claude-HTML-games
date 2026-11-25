// Água-Tinta — performance presets, auto quality, FPS overlay (owner A).
(function (AQ) {
  'use strict';

  var PRESETS = {
    high: { dprCap: 2, bgHz: 30, maxCreatures: 28, maxParticles: 400, deform: true, rays: true, caustics: true, knock: 'rows', densityBias: 1.0, bubbles: 1, musicVoices: 6, ropeIters: 6 },
    medium: { dprCap: 1.5, bgHz: 20, maxCreatures: 18, maxParticles: 200, deform: true, rays: true, caustics: false, knock: 'rows', densityBias: 1.08, bubbles: 0.5, musicVoices: 4, ropeIters: 4 },
    low: { dprCap: 1, bgHz: 12, maxCreatures: 10, maxParticles: 80, deform: false, rays: false, caustics: false, knock: 'bbox', densityBias: 1.2, bubbles: 0.25, musicVoices: 3, ropeIters: 3 }
  };
  var ORDER = ['low', 'medium', 'high'];

  var ema = 16.7, slowT = 0, fastT = 0, lastStepUp = -1e9, clock = 0;
  var fpsAcc = 0, fpsFrames = 0, fpsEl = null, fpsShow = false;

  var P = AQ.perf = {
    PRESETS: PRESETS,
    fps: 60,
    frameMs: 16.7,
    current: 'high',
    initial: 'high',
    auto: true,
    params: Object.assign({}, PRESETS.high), // identity is stable; contents change with the preset

    init: function () {
      P.initial = detectInitial();
      var q = AQ.settings.get('quality');
      P.auto = q === 'auto';
      apply(P.auto ? P.initial : q, 'init', true);
      if (typeof document !== 'undefined') fpsEl = document.getElementById('fps');
      setFpsVisible(AQ.settings.get('showFps'));
    },

    preset: function () { return P.current; },

    // setPreset(p, reason): reason 'auto' marks an automatic change.
    setPreset: function (p, reason) { apply(p, reason || 'manual', false); },

    // Called once per rendered frame by AQ.loop with the real elapsed ms.
    sample: function (ms) {
      if (!(ms > 0) || ms > 250) return;
      var dt = ms / 1000;
      clock += dt;
      ema += (ms - ema) * 0.05;
      P.frameMs = ema;
      fpsAcc += dt; fpsFrames++;
      if (fpsAcc >= 0.5) {
        P.fps = fpsFrames / fpsAcc;
        fpsAcc = 0; fpsFrames = 0;
        if (fpsShow && fpsEl) fpsEl.textContent = Math.round(P.fps) + ' fps · ' + P.current[0].toUpperCase() + ' · ' + ema.toFixed(1) + ' ms';
      }
      if (!P.auto) return;
      if (ema > 20) { slowT += dt; fastT = 0; } else if (ema < 12) { fastT += dt; slowT = 0; } else { slowT = 0; fastT = 0; }
      var idx = ORDER.indexOf(P.current);
      if (slowT >= 3 && idx > 0) { slowT = 0; apply(ORDER[idx - 1], 'auto', false); }
      else if (fastT >= 20 && idx < ORDER.indexOf(P.initial) && clock - lastStepUp >= 60) {
        fastT = 0; lastStepUp = clock; apply(ORDER[idx + 1], 'auto', false);
      }
    }
  };

  function detectInitial() {
    try {
      var touch = AQ.display && AQ.display.isTouch;
      var minScreen = Math.min(screen.width || 9999, screen.height || 9999);
      var hc = navigator.hardwareConcurrency || 8;
      var mem = navigator.deviceMemory || 8;
      if ((touch && minScreen < 420) || hc <= 4 || mem <= 4) return 'medium';
    } catch (e) { /* ignore */ }
    return 'high';
  }

  function apply(p, reason, silent) {
    if (!PRESETS[p]) return;
    var changed = p !== P.current;
    P.current = p;
    Object.assign(P.params, PRESETS[p]);
    slowT = 0; fastT = 0;
    if (changed && !silent) AQ.events.emit('quality:changed', { preset: p, auto: reason === 'auto' });
  }

  function setFpsVisible(on) {
    fpsShow = !!on;
    if (fpsEl) { fpsEl.hidden = !fpsShow; if (!fpsShow) fpsEl.textContent = ''; }
  }

  AQ.events.on('settings:changed', function (e) {
    if (e.key === 'quality') {
      P.auto = e.value === 'auto';
      apply(P.auto ? P.initial : e.value, 'manual', false);
    } else if (e.key === 'showFps') setFpsVisible(e.value);
  });
})(window.AQ);
