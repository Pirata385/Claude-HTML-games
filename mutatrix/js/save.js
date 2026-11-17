/* Mutatrix: salvamento em localStorage com versão, migração, exportação e importação. */
(function (root) {
  'use strict';
  const MX = root.MX || (root.MX = {});
  const { Economy, Genetics } = MX;

  const KEY = 'mutatrix.save.v1';
  const SETTINGS_KEY = 'mutatrix.settings.v1';
  const PREFIX = 'MUTATRIX1:';

  const SETTINGS_DEFAULTS = {
    quality: 'auto', fpsCap: 60, showFps: false,
    shake: true, flashes: true, reducedMotion: null, textScale: 1, fastAnim: false,
    master: 0.8, music: 0.5, sfx: 0.8, vibrate: true, hints: true,
  };

  function defaultStorage() {
    try { return root.localStorage || null; } catch (e) { return null; }
  }

  function isObj(v) { return v && typeof v === 'object' && !Array.isArray(v); }

  // Preenche campos ausentes com os padrões, sem apagar dados extras.
  function deepFill(target, defs) {
    for (const k of Object.keys(defs)) {
      if (target[k] === undefined || target[k] === null && defs[k] !== null) target[k] = clone(defs[k]);
      else if (isObj(defs[k]) && isObj(target[k]) && k !== 'arch' && k !== 'syn' && k !== 'col' && k !== 'ev') deepFill(target[k], defs[k]);
    }
    return target;
  }
  function clone(v) { return v === undefined ? v : JSON.parse(JSON.stringify(v)); }

  function migrate(obj) {
    if (!isObj(obj)) return Economy.newState();
    const def = Economy.newState();
    deepFill(obj, def);
    obj.v = Economy.VERSION;
    obj.design = Genetics.normalizeDesign(obj.design);
    if (!Array.isArray(obj.contracts)) obj.contracts = [];
    if (!Array.isArray(obj.shelf)) obj.shelf = [];
    if (!Array.isArray(obj.strains)) obj.strains = [];
    if (typeof obj.credits !== 'number' || !isFinite(obj.credits)) obj.credits = def.credits;
    if (obj.subject && (!obj.subject.host || !Array.isArray(obj.subject.mutations))) obj.subject = null;
    return obj;
  }

  function load(storage) {
    const st = storage === undefined ? defaultStorage() : storage;
    if (!st) return null;
    try {
      const raw = st.getItem(KEY);
      if (!raw) return null;
      return migrate(JSON.parse(raw));
    } catch (e) { return null; }
  }

  function save(state, storage) {
    const st = storage === undefined ? defaultStorage() : storage;
    if (!st) return false;
    try { st.setItem(KEY, JSON.stringify(state)); return true; } catch (e) { return false; }
  }

  function wipe(storage) {
    const st = storage === undefined ? defaultStorage() : storage;
    try { if (st) st.removeItem(KEY); } catch (e) { /* sem armazenamento */ }
  }

  function toB64(str) {
    if (typeof Buffer !== 'undefined') return Buffer.from(str, 'utf8').toString('base64');
    return root.btoa(unescape(encodeURIComponent(str)));
  }
  function fromB64(b64) {
    if (typeof Buffer !== 'undefined') return Buffer.from(b64, 'base64').toString('utf8');
    return decodeURIComponent(escape(root.atob(b64)));
  }

  function exportCode(state) { return PREFIX + toB64(JSON.stringify(state)); }

  function importCode(text) {
    try {
      const t = String(text || '').trim();
      if (!t.startsWith(PREFIX)) return null;
      const obj = JSON.parse(fromB64(t.slice(PREFIX.length)));
      if (!isObj(obj) || typeof obj.credits !== 'number') return null;
      return migrate(obj);
    } catch (e) { return null; }
  }

  function loadSettings(storage) {
    const st = storage === undefined ? defaultStorage() : storage;
    let s = {};
    try { s = JSON.parse((st && st.getItem(SETTINGS_KEY)) || '{}') || {}; } catch (e) { s = {}; }
    return deepFill(isObj(s) ? s : {}, SETTINGS_DEFAULTS);
  }

  function saveSettings(settings, storage) {
    const st = storage === undefined ? defaultStorage() : storage;
    try { if (st) st.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch (e) { /* sem armazenamento */ }
  }

  MX.Save = { KEY, SETTINGS_KEY, SETTINGS_DEFAULTS, migrate, load, save, wipe, exportCode, importCode, loadSettings, saveSettings };
  if (typeof module === 'object' && module.exports) module.exports = MX.Save;
})(typeof window !== 'undefined' ? window : globalThis);
