// Água-Tinta — scene manager (owner A).
// def: { enter(params), exit(), update(dt), drawBg?(grid, t), draw(t), resize?(metrics), onPause?(), onResume?() }
(function (AQ) {
  'use strict';

  var defs = Object.create(null);
  var pending = Promise.resolve();
  var errCount = Object.create(null);

  function noop() {}

  // Calls def[fn] guarded: one failing scene hook never kills the loop.
  function safeCall(name, def, fn, a, b) {
    if (!def || typeof def[fn] !== 'function') return undefined;
    try { return def[fn](a, b); } catch (e) {
      var key = name + '.' + fn;
      errCount[key] = (errCount[key] || 0) + 1;
      if (errCount[key] <= 3) console.error('[AQ.scenes] ' + key + ' failed:', e);
      if (errCount[key] === 1 && AQ.debug && AQ.ui && AQ.ui.toast) {
        try { AQ.ui.toast({ key: 'debug.error', vars: { where: key } }, { kind: 'warn' }); } catch (e2) { /* ignore */ }
      }
      return undefined;
    }
  }

  var S = AQ.scenes = {
    current: null,     // scene name
    def: null,         // current scene definition
    params: null,
    paused: false,
    transitioning: false,

    register: function (name, def) {
      var d = def || {};
      ['enter', 'exit', 'update', 'draw'].forEach(function (k) { if (typeof d[k] !== 'function') d[k] = noop; });
      defs[name] = d;
      return d;
    },
    has: function (name) { return !!defs[name]; },
    get: function (name) { return defs[name] || null; },

    // go(name, params?, {transition:'ink'|'fade'|'none'}='ink') → Promise (resolves after the reveal).
    go: function (name, params, opts) {
      var transition = (opts && opts.transition) || 'ink';
      pending = pending.then(function () { return run(name, params, transition); }, function () { return run(name, params, transition); });
      return pending;
    },

    pause: function () {
      if (S.paused) return;
      S.paused = true;
      safeCall(S.current, S.def, 'onPause');
      AQ.events.emit('pause:changed', { paused: true });
    },
    resume: function () {
      if (!S.paused) return;
      S.paused = false;
      safeCall(S.current, S.def, 'onResume');
      AQ.events.emit('pause:changed', { paused: false });
    },

    // Used by AQ.loop / AQ.display.
    update: function (dt) { safeCall(S.current, S.def, 'update', dt); },
    drawBg: function (grid, t) { if (S.def && S.def.drawBg) safeCall(S.current, S.def, 'drawBg', grid, t); },
    draw: function (t) { safeCall(S.current, S.def, 'draw', t); },
    resizeCurrent: function (m) { if (S.def && S.def.resize) safeCall(S.current, S.def, 'resize', m); }
  };

  function run(name, params, transition) {
    var def = defs[name];
    if (!def) {
      console.error('[AQ.scenes] unknown scene "' + name + '"');
      return Promise.resolve(false);
    }
    var from = S.current;
    var wipe = transition === 'none' ? null : (transition === 'fade' || AQ.fx.motion() < 1 ? 'fade' : 'ink');
    // Paper theme: the old view turns away like a notebook page instead of the ink wipe.
    var turn = !!(from && wipe && AQ.pageturn && AQ.pageturn.enabled() && AQ.pageturn.capture());
    if (turn) wipe = null;
    S.transitioning = true;
    var cover = (from && wipe) ? AQ.fx.inkWipe('out', wipe === 'fade' ? 0.2 : 0.4) : Promise.resolve();
    return cover.then(function () {
      if (from) safeCall(from, S.def, 'exit');
      if (S.paused) { S.paused = false; AQ.events.emit('pause:changed', { paused: false }); }
      S.current = name;
      S.def = def;
      S.params = params || null;
      AQ.fx.clear();
      AQ.render.cam.set(0, 0);
      AQ.render.invalidate();
      safeCall(name, def, 'enter', params || {});
      if (def.resize) safeCall(name, def, 'resize', AQ.display.metrics());
      AQ.events.emit('scene:changed', { from: from, to: name, params: params || null });
      if (turn) { AQ.fx.covered = false; return AQ.pageturn.play().then(function () { return true; }); }
      if (!wipe) { AQ.fx.covered = false; return true; }
      return AQ.fx.inkWipe('in', wipe === 'fade' ? 0.2 : 0.4).then(function () { return true; });
    }).then(function (r) { S.transitioning = false; return r; }, function (e) {
      S.transitioning = false;
      console.error('[AQ.scenes] transition failed:', e);
      return false;
    });
  }
})(window.AQ);
