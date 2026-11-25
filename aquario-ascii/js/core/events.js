// Água-Tinta — event bus (owner A). Pure. Listener errors are caught so one module never kills the loop.
(function (AQ) {
  'use strict';

  var map = Object.create(null);

  function on(name, fn) {
    if (typeof fn !== 'function') return function () {};
    (map[name] || (map[name] = [])).push(fn);
    return function () { off(name, fn); };
  }
  function once(name, fn) {
    var wrapper = function (payload, evName) { off(name, wrapper); return fn(payload, evName); };
    wrapper._orig = fn;
    return on(name, wrapper);
  }
  function off(name, fn) {
    var l = map[name];
    if (!l) return;
    for (var i = 0; i < l.length; i++) {
      if (l[i] === fn || l[i]._orig === fn) { l.splice(i, 1); return; }
    }
  }
  function call(fn, payload, name) {
    try { fn(payload, name); } catch (e) {
      if (typeof console !== 'undefined') console.error('[AQ.events] listener error in "' + name + '":', e);
    }
  }
  // Listeners receive (payload, name). '*' listeners receive every event.
  function emit(name, payload) {
    var l = map[name], i;
    if (l && l.length) {
      var copy = l.slice();
      for (i = 0; i < copy.length; i++) call(copy[i], payload, name);
    }
    var all = map['*'];
    if (all && all.length && name !== '*') {
      var c2 = all.slice();
      for (i = 0; i < c2.length; i++) call(c2[i], payload, name);
    }
  }
  // clear() removes everything; clear(name) removes one event's listeners.
  function clear(name) {
    if (name === undefined) map = Object.create(null);
    else delete map[name];
  }
  function count(name) { return map[name] ? map[name].length : 0; }

  AQ.events = { on: on, once: once, off: off, emit: emit, clear: clear, count: count };
})(window.AQ);
