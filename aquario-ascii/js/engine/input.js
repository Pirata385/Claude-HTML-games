// Água-Tinta — input (owner A): pointer (canvas), keyboard, gamepad, virtual (E's HTML touch controls).
// Raw canvas events: 'down','move','up','tap','hold','drag','wheel' — payload {x,y,dx,dy,startX,startY,dur,source}
// (CSS px relative to the stage). Actions: 'action:primary' {phase,source}, 'action:back', 'action:pause',
// 'action:prev', 'action:next', 'action:bait', 'action:retrieve', 'action:feed', 'action:nav' {dx,dy},
// 'action:confirm'. Pointer presses on the canvas are NOT 'primary' (scenes read pointer events directly).
// While blocked (a modal is open) raw canvas events, primary, bait, retrieve and feed are suppressed and
// isDown/axis read as idle; back, pause, nav, confirm, prev and next still fire (UI navigation).
(function (AQ) {
  'use strict';

  var U = AQ.util;
  var TAP_MS = 300, TAP_MOVE = 10, DRAG_MOVE = 8, HOLD_MS = 350;
  var listeners = Object.create(null);
  var stage = null, gestured = false;
  var blockers = Object.create(null), blockCount = 0;
  var keys = Object.create(null);       // logical action → pressed by keyboard
  var vpress = Object.create(null);     // virtual
  var vaxis = Object.create(null);
  var pad = { primary: false, left: false, right: false, up: false, down: false, ax: 0, ay: 0, prev: [] };
  var holdTimer = 0, holdFired = false;
  var GAMEPLAY = { primary: 1, bait: 1, retrieve: 1, feed: 1 };

  var I = AQ.input = {
    mode: 'mouse',
    pointer: { x: 0, y: 0, down: false, id: -1, startX: 0, startY: 0, dx: 0, dy: 0, downAt: 0, moved: false, type: 'mouse' },
    blocked: false,

    init: function (stageEl) {
      stage = stageEl || document.getElementById('stage');
      I.mode = AQ.display && AQ.display.isTouch ? 'touch' : 'mouse';
      stage.addEventListener('pointerdown', onDown);
      stage.addEventListener('pointermove', onMove);
      stage.addEventListener('pointerup', onUp);
      stage.addEventListener('pointercancel', onCancel);
      stage.addEventListener('wheel', onWheel, { passive: false });
      stage.addEventListener('contextmenu', function (e) { e.preventDefault(); });
      window.addEventListener('keydown', onKeyDown);
      window.addEventListener('keyup', onKeyUp);
      window.addEventListener('blur', releaseAll);
      // Any first gesture anywhere (incl. the HTML UI) unlocks audio.
      window.addEventListener('pointerdown', gesture, true);
      window.addEventListener('gamepadconnected', function () { /* polled each frame */ });
    },

    on: function (type, fn) {
      (listeners[type] || (listeners[type] = [])).push(fn);
      return function () { var l = listeners[type]; if (!l) return; var i = l.indexOf(fn); if (i >= 0) l.splice(i, 1); };
    },

    // isDown('primary'|'left'|'right'|'up'|'down')
    isDown: function (action) {
      if (I.blocked) return false;
      return !!(keys[action] || vpress[action] || pad[action]);
    },
    // axis('steer'|'aimX') → -1..1 (also 'aimY', 'navY')
    axis: function (name) {
      if (I.blocked) return 0;
      if (vaxis[name]) return U.clamp(vaxis[name], -1, 1);
      if (name === 'steer' || name === 'aimX') {
        var k = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
        if (k) return k;
        return pad.ax;
      }
      if (name === 'aimY' || name === 'navY') {
        var ky = (keys.down ? 1 : 0) - (keys.up ? 1 : 0);
        if (ky) return ky;
        return pad.ay;
      }
      return 0;
    },

    virtual: {
      press: function (action) {
        if (vpress[action]) return;
        vpress[action] = true;
        setMode(I.mode === 'gamepad' ? 'gamepad' : 'touch');
        fireAction(action, 'down', 'virtual');
      },
      release: function (action) {
        if (!vpress[action]) return;
        vpress[action] = false;
        if (action === 'primary') fireAction(action, 'up', 'virtual');
      },
      setAxis: function (name, v) { vaxis[name] = U.clamp(+v || 0, -1, 1); }
    },

    block: function (reason) {
      var r = reason || 'default';
      if (!blockers[r]) { blockers[r] = true; blockCount++; }
      I.blocked = blockCount > 0;
      if (I.pointer.down) cancelPointer();
    },
    unblock: function (reason) {
      var r = reason || 'default';
      if (blockers[r]) { delete blockers[r]; blockCount--; }
      I.blocked = blockCount > 0;
    },

    // Called by AQ.loop each frame (step 1).
    poll: function () { pollGamepad(); },

    emit: emit
  };

  function emit(type, payload) {
    var l = listeners[type];
    if (!l || !l.length) return;
    var copy = l.slice();
    for (var i = 0; i < copy.length; i++) {
      try { copy[i](payload, type); } catch (e) { console.error('[AQ.input] listener error in "' + type + '":', e); }
    }
  }

  function setMode(m) {
    if (I.mode === m) return;
    I.mode = m;
    AQ.events.emit('input:mode', { mode: m });
  }

  function gesture() {
    if (gestured) return;
    gestured = true;
    AQ.events.emit('app:gesture', {});
  }

  function fireAction(action, phase, source) {
    if (I.blocked && GAMEPLAY[action]) return;
    if (action === 'primary') emit('action:primary', { phase: phase, source: source });
    else if (phase === 'down') emit('action:' + action, { source: source });
  }

  // ---------------------------------------------------------------- pointer
  var payload = { x: 0, y: 0, dx: 0, dy: 0, startX: 0, startY: 0, dur: 0, source: 'mouse', button: 0 };
  function fill(p, e) {
    payload.x = p.x; payload.y = p.y; payload.dx = p.dx; payload.dy = p.dy;
    payload.startX = p.startX; payload.startY = p.startY;
    payload.dur = (performance.now() - p.downAt) / 1000;
    payload.source = p.type;
    payload.button = e ? e.button : 0;
    return payload;
  }
  function localXY(e) {
    var r = stage.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }
  function ptype(e) { return e.pointerType === 'mouse' ? 'mouse' : 'touch'; }

  function onDown(e) {
    gesture();
    setMode(ptype(e));
    var p = I.pointer;
    if (p.down && e.pointerId !== p.id) return; // single tracked pointer
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    var q = localXY(e);
    p.down = true; p.id = e.pointerId; p.type = ptype(e);
    p.x = p.startX = q.x; p.y = p.startY = q.y; p.dx = 0; p.dy = 0;
    p.downAt = performance.now(); p.moved = false;
    holdFired = false;
    try { stage.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    if (I.blocked) return;
    emit('down', fill(p, e));
    clearTimeout(holdTimer);
    holdTimer = setTimeout(function () {
      if (p.down && !p.moved && !I.blocked) { holdFired = true; emit('hold', fill(p)); }
    }, HOLD_MS);
  }
  function onMove(e) {
    var p = I.pointer;
    var q = localXY(e);
    if (!p.down) {
      // hover (mouse): keep position fresh for aiming/rod
      if (e.pointerType === 'mouse') { p.x = q.x; p.y = q.y; if (!I.blocked) emit('move', fill(p, e)); }
      return;
    }
    if (e.pointerId !== p.id) return;
    p.x = q.x; p.y = q.y; p.dx = q.x - p.startX; p.dy = q.y - p.startY;
    if (!p.moved && Math.hypot(p.dx, p.dy) > DRAG_MOVE) p.moved = true;
    if (I.blocked) return;
    emit('move', fill(p, e));
    if (p.moved) emit('drag', fill(p, e));
  }
  function onUp(e) {
    var p = I.pointer;
    if (!p.down || e.pointerId !== p.id) return;
    var q = localXY(e);
    p.x = q.x; p.y = q.y; p.dx = q.x - p.startX; p.dy = q.y - p.startY;
    p.down = false;
    clearTimeout(holdTimer);
    try { stage.releasePointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    if (I.blocked) return;
    var pl = fill(p, e);
    emit('up', pl);
    if (!holdFired && pl.dur * 1000 < TAP_MS && Math.hypot(p.dx, p.dy) < TAP_MOVE) emit('tap', pl);
  }
  function cancelPointer() {
    var p = I.pointer;
    if (!p.down) return;
    p.down = false;
    clearTimeout(holdTimer);
    if (!I.blocked) emit('up', fill(p));
  }
  function onCancel(e) { if (e.pointerId === I.pointer.id) cancelPointer(); }
  function onWheel(e) {
    e.preventDefault();
    if (I.blocked) return;
    var q = localXY(e);
    emit('wheel', { x: q.x, y: q.y, dx: e.deltaX, dy: e.deltaY, startX: q.x, startY: q.y, dur: 0, source: 'mouse' });
  }

  // ---------------------------------------------------------------- keyboard
  var KEYMAP = {
    ' ': ['primary'], 'Spacebar': ['primary'], 'Enter': ['primary', 'confirm'],
    'Escape': ['pause', 'back'], 'p': ['pause'], 'P': ['pause'],
    'a': ['left'], 'A': ['left'], 'ArrowLeft': ['left'],
    'd': ['right'], 'D': ['right'], 'ArrowRight': ['right'],
    'w': ['up'], 'W': ['up'], 'ArrowUp': ['up'],
    's': ['down'], 'S': ['down'], 'ArrowDown': ['down'],
    'q': ['prev'], 'Q': ['prev'], 'e': ['next'], 'E': ['next'],
    'b': ['bait'], 'B': ['bait'], 'r': ['retrieve'], 'R': ['retrieve'], 'f': ['feed'], 'F': ['feed']
  };
  var NAV = { left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1] };
  var HELD = { primary: 1, left: 1, right: 1, up: 1, down: 1 };

  function editable(t) {
    if (!t || !t.tagName) return false;
    var tag = t.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || t.isContentEditable;
  }
  function onKeyDown(e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (editable(e.target)) return;
    gesture();
    var acts = KEYMAP[e.key];
    if (!acts) return;
    // Let focused HTML buttons handle Space/Enter themselves.
    if ((e.key === ' ' || e.key === 'Enter') && e.target && e.target.tagName === 'BUTTON') return;
    setMode('keyboard');
    if (e.key === ' ' || e.key.indexOf('Arrow') === 0) e.preventDefault();
    for (var i = 0; i < acts.length; i++) {
      var a = acts[i];
      if (HELD[a]) {
        if (!keys[a]) {
          keys[a] = true;
          if (a === 'primary') fireAction('primary', 'down', 'keyboard');
          if (NAV[a]) emit('action:nav', { dx: NAV[a][0], dy: NAV[a][1], source: 'keyboard' });
        } else if (NAV[a] && e.repeat) emit('action:nav', { dx: NAV[a][0], dy: NAV[a][1], source: 'keyboard' });
      } else if (!e.repeat) fireAction(a, 'down', 'keyboard');
    }
  }
  function onKeyUp(e) {
    var acts = KEYMAP[e.key];
    if (!acts) return;
    for (var i = 0; i < acts.length; i++) {
      var a = acts[i];
      if (HELD[a] && keys[a]) {
        keys[a] = false;
        if (a === 'primary') fireAction('primary', 'up', 'keyboard');
      }
    }
  }
  function releaseAll() {
    for (var k in keys) {
      if (keys[k] && k === 'primary') fireAction('primary', 'up', 'keyboard');
      keys[k] = false;
    }
    for (var v in vpress) {
      if (vpress[v] && v === 'primary') fireAction('primary', 'up', 'virtual');
      vpress[v] = false;
    }
    cancelPointer();
  }

  // ---------------------------------------------------------------- gamepad
  // A=0 primary · B=1 back · X=2 bait · Y=3 retrieve · LB=4 prev · RB=5 next · RT=7 primary · Start=9 pause · d-pad 12-15
  var navLatchX = 0, navLatchY = 0;
  function pollGamepad() {
    if (typeof navigator === 'undefined' || !navigator.getGamepads) return;
    var pads;
    try { pads = navigator.getGamepads(); } catch (e) { return; }
    var gp = null;
    for (var i = 0; pads && i < pads.length; i++) if (pads[i] && pads[i].connected) { gp = pads[i]; break; }
    if (!gp) return;
    var b = gp.buttons, prev = pad.prev;
    function pressed(n) { return !!(b[n] && (b[n].pressed || b[n].value > 0.5)); }
    var now = [];
    for (var j = 0; j < b.length; j++) now[j] = pressed(j);
    function edge(n) { return now[n] && !prev[n]; }
    var any = now.some(function (x) { return x; });
    var ax = gp.axes[0] || 0, ay = gp.axes[1] || 0;
    if (Math.abs(ax) < 0.25) ax = 0;
    if (Math.abs(ay) < 0.25) ay = 0;
    if (any || ax || ay) { setMode('gamepad'); gesture(); }

    var prim = now[0] || now[7];
    if (prim && !pad.primary) { pad.primary = true; fireAction('primary', 'down', 'gamepad'); }
    else if (!prim && pad.primary) { pad.primary = false; fireAction('primary', 'up', 'gamepad'); }
    if (edge(1)) fireAction('back', 'down', 'gamepad');
    if (edge(2)) fireAction('bait', 'down', 'gamepad');
    if (edge(3)) fireAction('retrieve', 'down', 'gamepad');
    if (edge(4)) fireAction('prev', 'down', 'gamepad');
    if (edge(5)) fireAction('next', 'down', 'gamepad');
    if (edge(9)) fireAction('pause', 'down', 'gamepad');

    var dl = now[14], dr = now[15], du = now[12], dd = now[13];
    pad.left = dl || ax < -0.5; pad.right = dr || ax > 0.5; pad.up = du || ay < -0.5; pad.down = dd || ay > 0.5;
    pad.ax = dl ? -1 : dr ? 1 : ax;
    pad.ay = du ? -1 : dd ? 1 : ay;
    var nx = pad.left ? -1 : pad.right ? 1 : 0, ny = pad.up ? -1 : pad.down ? 1 : 0;
    if (nx !== navLatchX && nx) emit('action:nav', { dx: nx, dy: 0, source: 'gamepad' });
    if (ny !== navLatchY && ny) emit('action:nav', { dx: 0, dy: ny, source: 'gamepad' });
    navLatchX = nx; navLatchY = ny;
    pad.prev = now;
  }
})(window.AQ);
