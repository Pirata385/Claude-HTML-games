/* Tiny event bus. */
(function (root) {
  'use strict';
  const PA = root.PA = root.PA || {};
  const map = new Map();
  PA.Bus = {
    on(ev, fn) { if (!map.has(ev)) map.set(ev, new Set()); map.get(ev).add(fn); return () => PA.Bus.off(ev, fn); },
    off(ev, fn) { const s = map.get(ev); if (s) s.delete(fn); },
    emit(ev, data) { const s = map.get(ev); if (s) for (const fn of [...s]) fn(data); },
    clear() { map.clear(); },
  };
})(typeof window !== 'undefined' ? window : globalThis);
