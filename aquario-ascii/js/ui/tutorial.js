// Água-Tinta — diegetic tutorial (owner E), §10. Steps (state.tutorial.step):
// 0 intro · 1 cast · 2 sink · 3 nibble · 4 strike · 5 reel · 6 steer · 7 keep · 8 free · 9 goAquarium · 10 card ·
// 11 feed · 12 till · 13 done. Emits 'tutorial:step' {step}. C's fishing scene is scripted through AQ.fishing.script().
(function (AQ) {
  'use strict';

  var ui = AQ.ui;
  var D = ui.dom;
  var STEPS = AQ.ENUM.TUTORIAL;
  var DONE = STEPS.indexOf('done');
  var timers = [];
  var idleT = 0, idleTimer = 0;
  var freeCatches = 0;
  var steerTimer = 0;

  function tstate() {
    var s = AQ.state;
    if (!s.tutorial) s.tutorial = { step: 0, done: false, notes: {}, hints: {} };
    return s.tutorial;
  }
  function later(fn, ms) { var id = setTimeout(fn, ms); timers.push(id); return id; }
  function clearTimers() { timers.forEach(clearTimeout); timers = []; }
  function hint(id, key, anchor, extra) {
    var o = { key: key, anchor: anchor };
    if (extra) for (var k in extra) o[k] = extra[k];
    ui.hint('tut:' + id, o);
  }
  function clear(id) { ui.clearHint('tut:' + id); }
  function clearAll() {
    ['cast', 'sink', 'nibble', 'strike', 'reel', 'tension', 'steer', 'go', 'card', 'feed', 'till', 'idle'].forEach(clear);
    if (ui.hud && ui.hud.pulse) { ui.hud.pulse('reel', false); ui.hud.pulse('feed', false); ui.hud.pulse('till', false); ui.hud.pulse('nav:aquarium', false); ui.hud.pulse('back', false); }
  }
  function inFishing() { return AQ.scenes && AQ.scenes.current === 'fishing'; }
  function anchorReel() { return document.querySelector('.aq-ui.is-touch') ? 'reel' : 'bottom'; }

  function setStep(n) {
    var ts = tstate();
    n = Math.max(0, Math.min(DONE, n | 0));
    T.step = n;
    ts.step = n;
    if (n >= DONE) { ts.done = true; T.active = false; }
    if (AQ.store) AQ.store.markDirty();
    AQ.events.emit('tutorial:step', { step: n, id: STEPS[n] });
    render();
  }

  // Shows the hints of the current step (idempotent).
  function render() {
    if (!T.active) { clearAll(); return; }
    var n = T.step;
    var scene = AQ.scenes && AQ.scenes.current;
    clearAll();
    if (scene === 'fishing') {
      if (n === 1) hint('cast', 'tut.cast', 'boat');
      else if (n === 2) hint('sink', 'tut.sink', 'hook');
      else if (n === 3) hint('nibble', 'tut.nibble', 'hook');
      else if (n === 4) hint('strike', 'tut.strike', 'hook', { big: true });
      else if (n === 5) { hint('reel', 'tut.reel', anchorReel()); hint('tension', 'tut.tension', 'tension'); ui.hud.pulse('reel', true); }
      else if (n === 6) { hint('steer', 'tut.steer', 'fish', { big: true }); hint('tension', 'tut.tension', 'tension'); }
      else if (n === 9) { hint('go', 'tut.goAquarium', 'back'); ui.hud.pulse('back', true); }
    } else if (scene === 'map') {
      if (n === 9) { hint('go', 'tut.goAquariumMap', 'nav:aquarium'); ui.hud.pulse('nav:aquarium', true); }
    } else if (scene === 'aquarium') {
      if (n === 10) hint('card', 'tut.card', 'center');
      else if (n === 11) { hint('feed', 'tut.feed', 'feed'); ui.hud.pulse('feed', true); }
      else if (n === 12) { hint('till', 'tut.till', 'till'); ui.hud.pulse('till', true); }
    }
  }

  function scriptFishing() {
    if (!AQ.fishing || typeof AQ.fishing.script !== 'function') return;
    var school = [];
    for (var i = 0; i < 6; i++) school.push({ sp: 'manjuba', x: 8 + i * 1.2, depthFrac: 0.3 });
    D.safe(function () {
      AQ.fishing.script({ forceSpawn: school, autoStopDepth: 0.3, biteWindow: 2.0,
        fightOverride: { power: 0.35, stamina: 4, runs: 1 }, noEscape: true });
    });
  }
  function unscript() { if (AQ.fishing && AQ.fishing.script) D.safe(function () { AQ.fishing.script(null); }); }

  function enterFishing() {
    if (!T.active) return;
    if (T.step <= 7) {
      scriptFishing();
      if (T.step === 0) {
        later(function () {
          if (!T.active || !inFishing()) return;
          ui.note('intro').then(function () { if (T.active && T.step === 0) setStep(1); });
        }, 2000);
        return;
      }
      if (T.step > 1 && T.step < 7) setStep(1);
      else render();
      return;
    }
    render();
  }

  // ---------------------------------------------------------------- idle hint (free fishing, after 8 s)
  function idleTick() {
    if (!inFishing() || ui.isModal() || AQ.scenes.paused) { idleT = 0; return; }
    var phase = AQ.fishing && AQ.fishing.phase;
    var ts = tstate();
    var free = (T.active && T.step >= 8) || (!T.active && ts.done && (AQ.state.stats && AQ.state.stats.casts < 6));
    if (phase === 'idle' && free) {
      idleT += 0.5;
      if (idleT >= 8 && !ui.hasHint('tut:idle')) ui.hint('tut:idle', { key: 'tut.cast', anchor: 'boat' });
    } else {
      idleT = 0;
      if (ui.hasHint('tut:idle')) clear('idle');
    }
  }

  var T = AQ.tutorial = {
    step: 0,
    active: false,
    start: function () {
      var ts = tstate();
      ts.step = 0; ts.done = false; ts.notes = ts.notes || {}; ts.hints = ts.hints || {};
      T.step = 0;
      freeCatches = 0;
      T.active = AQ.settings.get('hints') !== false;
      if (!T.active) { ts.done = true; ts.step = DONE; T.step = DONE; }
      AQ.events.emit('tutorial:step', { step: T.step, id: STEPS[T.step] });
    },
    resume: function () {
      var ts = tstate();
      if (ts.done) { T.active = false; T.step = DONE; return; }
      T.step = ts.step || 0;
      T.active = true;
    },
    skip: function () {
      clearTimers();
      clearAll();
      unscript();
      var was = T.active;
      T.active = false;
      setStep(DONE);
      if (was) ui.toast({ key: 'ui.toast.tutorialSkipped' });
    },
    next: function () { setStep(T.step + 1); },
    // Called by E's own HUD and cards.
    onAction: function (kind) {
      if (!T.active) return;
      if (kind === 'fishCard' && T.step === 10) setStep(11);
      else if (kind === 'feed' && T.step === 11) setStep(12);
      else if (kind === 'till' && T.step === 12) {
        setStep(DONE);
        ui.toast({ key: 'ui.toast.tutorialDone' }, { kind: 'good' });
      }
    }
  };

  ui.onInit(function () {
    var E = AQ.events;
    // restore from a loaded save
    var ts = tstate();
    T.step = ts.step || 0;
    T.active = false; // becomes active on start()/resume()
    idleTimer = setInterval(idleTick, 500);

    E.on('scene:changed', function (p) {
      clearTimers();
      if (!T.active) { clearAll(); return; }
      if (p.to === 'fishing') enterFishing();
      else if (p.to === 'aquarium') {
        if (T.step === 9 || T.step === 8) {
          var hasFish = (AQ.state.aquarium.fish || []).length > 0;
          setStep(hasFish ? 10 : 11);
          if (!ui.noteSeen('aquarium')) later(function () { ui.note('aquarium'); }, 900);
        } else render();
      } else if (p.to === 'title' || p.to === 'ending') clearAll();
      else render();
    });
    E.on('save:reset', function () { T.active = false; T.step = 0; clearAll(); });
    E.on('settings:changed', function (p) { if (p.key === 'hints' && p.value === false && T.active) T.skip(); });

    E.on('fish:cast', function () {
      if (!T.active) return;
      if (T.step === 1 || T.step === 0) setStep(2);
    });
    E.on('fish:stop', function () {
      if (T.active && T.step === 2) hint('sink', 'tut.wait', 'hook');
    });
    E.on('bite:nibble', function () {
      if (T.active && T.step === 2) setStep(3);
    });
    E.on('bite:strike', function () {
      if (T.active && T.step >= 1 && T.step <= 3) setStep(4);
    });
    E.on('bite:miss', function () {
      if (T.active && T.step >= 2 && T.step <= 4) setStep(1);
    });
    E.on('fight:start', function () {
      if (T.active && T.step >= 1 && T.step <= 4) setStep(5);
    });
    E.on('fight:tell', function (p) {
      if (!T.active || T.step !== 5 || !p || (p.kind !== 'run')) return;
      setStep(6);
      clearTimeout(steerTimer);
      steerTimer = setTimeout(function () { if (T.active && T.step === 6) { clear('steer'); } }, 4500);
    });
    E.on('fight:end', function (p) {
      if (!T.active) return;
      clear('steer'); clear('reel'); clear('tension');
      if (ui.hud && ui.hud.pulse) ui.hud.pulse('reel', false);
      if (p && p.result && p.result !== 'landed' && T.step >= 5 && T.step <= 6) setStep(1);
    });
    E.on('catch:landed', function () {
      if (T.active && T.step >= 4 && T.step <= 6) setStep(7);
    });
    E.on('catch:resolved', function () {
      if (!T.active) return;
      if (T.step === 7) {
        unscript();
        setStep(8);
        freeCatches = 0;
        later(function () {
          ui.note('firstCatch').then(function () { if (ui.goalsPeek) ui.goalsPeek([]); });
        }, 400);
      } else if (T.step === 8) {
        freeCatches++;
        if (freeCatches >= 1) later(function () { if (T.active && T.step === 8) setStep(9); }, 1500);
      }
    });
    E.on('ui:open', function (p) {
      if (T.active && p.screen === 'catchCard') clearAll();
    });
  });
})(window.AQ);
