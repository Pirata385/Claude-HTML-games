// Persistence (settings, current run, codex). Storage can be unavailable
// (private mode, file://, quota), so every access is guarded and the game keeps
// working with in-memory state.
(function (XS) {
  'use strict';

  const PREFIX = 'xenospire.';
  const memory = Object.create(null);

  function backend() {
    try {
      if (typeof localStorage !== 'undefined') return localStorage;
    } catch (e) { /* blocked */ }
    return null;
  }

  function load(key, fallback) {
    let raw = null;
    try {
      const ls = backend();
      raw = ls ? ls.getItem(PREFIX + key) : memory[key];
    } catch (e) { raw = memory[key]; }
    if (raw == null) return fallback;
    try { return JSON.parse(raw); } catch (e) { return fallback; }
  }

  function save(key, value) {
    const raw = JSON.stringify(value);
    memory[key] = raw;
    try {
      const ls = backend();
      if (ls) ls.setItem(PREFIX + key, raw);
    } catch (e) { /* quota or blocked: memory copy still works this session */ }
  }

  function remove(key) {
    delete memory[key];
    try {
      const ls = backend();
      if (ls) ls.removeItem(PREFIX + key);
    } catch (e) { /* ignore */ }
  }

  XS.store = { load, save, remove };
})(globalThis.XS = globalThis.XS || {});
