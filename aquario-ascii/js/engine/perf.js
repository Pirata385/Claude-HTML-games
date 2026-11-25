// Água-Tinta — performance presets (§15.10), auto quality with hysteresis, frame budget, FPS meter (owner A).
(function (AQ) {
  'use strict';

  var PRESETS = {
    high: { dprCap: 2, bgHz: 30, maxCreatures: 28, maxParticles: 400, deform: true, rays: true, caustics: true, knock: 'rows', densityBias: 1.0, bubbles: 1, musicVoices: 6, ropeIters: 6 },
    medium: { dprCap: 1.5, bgHz: 20, maxCreatures: 18, maxParticles: 200, deform: true, rays: true, caustics: false, knock: 'rows', densityBias: 1.08, bubbles: 0.5, musicVoices: 4, ropeIters: 4 },
    low: { dprCap: 1, bgHz: 12, maxCreatures: 10, maxParticles: 80, deform: false, rays: false, caustics: false, knock: 'bbox', densityBias: 1.2, bubbles: 0.25, musicVoices: 3, ropeIters: 3 }
  };
  var ORDER = ['low', 'medium', 'high'];
  // Auto fallback (§15.10): > 20 ms average for 3 s → one step down; < 12 ms for 20 s → one step up,
  // at most one step up per 60 s and never above the initial preset.
  var SLOW_MS = 20, SLOW_SEC = 3, FAST_MS = 12, FAST_SEC = 20, UP_COOLDOWN = 60;

  var ema = 16.7, jsEma = 0, slowT = 0, fastT = 0, lastStepUp = -1e9, clock = 0, graceT = 2;
  var fpsAcc = 0, fpsFrames = 0, fpsEl = null, fpsShow = false, lastText = '';

  var P = AQ.perf = {
    PRESETS: PRESETS,
    fps: 60,
    frameMs: 16.7,   // EMA of the interval between rendered frames
    jsMs: 0,         // EMA of the JS time spent per rendered frame
    budgetMs: 3,     // §15.10: ≤ 6 ms on a phone, ≤ 3 ms on desktop
    overBudget: false,
    current: 'high',
    initial: 'high',
    auto: true,
    steps: 0,        // automatic changes so far
    params: Object.assign({}, PRESETS.high), // identity is stable; contents change with the preset

    init: function () {
      P.initial = detectInitial();
      P.budgetMs = AQ.display && AQ.display.isTouch ? 6 : 3;
      var q = AQ.settings.get('quality');
      P.auto = q === 'auto';
      apply(P.auto ? P.initial : q, 'init', true);
      if (typeof document !== 'undefined') fpsEl = document.getElementById('fps');
      setFpsVisible(AQ.settings.get('showFps'));
    },

    preset: function () { return P.current; },

    // setPreset(p, reason): reason 'auto' marks an automatic change (E toasts on 'quality:changed').
    setPreset: function (p, reason) { apply(p, reason || 'manual', false); },

    // Ignore frame samples for a while (boot, scene change, resize, tab return): avoids false step-downs.
    grace: function (sec) { graceT = Math.max(graceT, sec || 1); slowT = 0; fastT = 0; },

    // Called once per rendered frame by AQ.loop: real interval ms and JS work ms.
    sample: function (ms, workMs) {
      if (!(ms > 0) || ms > 250) return;
      var dt = ms / 1000;
      clock += dt;
      ema += (ms - ema) * 0.05;
      P.frameMs = ema;
      if (workMs >= 0) { jsEma += (workMs - jsEma) * 0.05; P.jsMs = jsEma; P.overBudget = jsEma > P.budgetMs; }
      fpsAcc += dt; fpsFrames++;
      if (fpsAcc >= 0.5) {
        P.fps = fpsFrames / fpsAcc;
        fpsAcc = 0; fpsFrames = 0;
        if (fpsShow && fpsEl) renderMeter();
      }
      if (graceT > 0) { graceT -= dt; return; }
      if (!P.auto) return;
      if (ema > SLOW_MS) { slowT += dt; fastT = 0; }
      else if (ema < FAST_MS) { fastT += dt; slowT = 0; }
      else { slowT = Math.max(0, slowT - dt); fastT = 0; }
      var idx = ORDER.indexOf(P.current);
      if (slowT >= SLOW_SEC && idx > 0) {
        apply(ORDER[idx - 1], 'auto', false);
        P.grace(2);
      } else if (fastT >= FAST_SEC && idx < ORDER.indexOf(P.initial) && clock - lastStepUp >= UP_COOLDOWN) {
        lastStepUp = clock;
        apply(ORDER[idx + 1], 'auto', false);
        P.grace(2);
      }
    },

    // Extra lines for the FPS meter (AQ.debug adds scene / grid / particle info).
    meterExtra: null
  };

  function renderMeter() {
    var t = Math.round(P.fps) + ' fps  ' + P.current + (P.auto ? ' (auto)' : '') + '\n' +
      P.frameMs.toFixed(1) + ' ms/frame  js ' + P.jsMs.toFixed(2) + ' ms' + (P.overBudget ? ' !' : '');
    if (typeof P.meterExtra === 'function') {
      try { t += '\n' + P.meterExtra(); } catch (e) { /* ignore */ }
    }
    if (t !== lastText) { fpsEl.textContent = t; lastText = t; }
  }

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
    if (reason === 'auto' && changed) P.steps++;
    if (changed && !silent) AQ.events.emit('quality:changed', { preset: p, auto: reason === 'auto' });
  }

  function setFpsVisible(on) {
    fpsShow = !!on;
    if (fpsEl) { fpsEl.hidden = !fpsShow; if (!fpsShow) { fpsEl.textContent = ''; lastText = ''; } else renderMeter(); }
  }
  P.showMeter = setFpsVisible;

  AQ.events.on('settings:changed', function (e) {
    if (e.key === 'quality') {
      P.auto = e.value === 'auto';
      apply(P.auto ? P.initial : e.value, 'manual', false);
      P.grace(2);
    } else if (e.key === 'showFps') setFpsVisible(e.value);
  });
  AQ.events.on('scene:changed', function () { P.grace(1.5); });
  AQ.events.on('app:visible', function () { P.grace(2); });
})(window.AQ);
