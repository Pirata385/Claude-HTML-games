// save.js — three save slots and the settings, in localStorage (or in memory if it is blocked).
(function () {
  'use strict';
  const RB = globalThis.RB;
  const KEY = 'ringOfBeakers.';
  const mem = {};
  let store = null;
  try { store = window.localStorage; store.getItem(KEY + 'probe'); } catch (e) { store = null; }
  const get = (k) => { try { return store ? store.getItem(KEY + k) : mem[k] || null; } catch (e) { return mem[k] || null; } };
  const set = (k, v) => { mem[k] = v; try { if (store) store.setItem(KEY + k, v); return true; } catch (e) { return false; } };
  const del = (k) => { delete mem[k]; try { if (store) store.removeItem(KEY + k); } catch (e) { /* nothing to remove */ } };

  // Returns whether the browser kept it.
  function save(slot, S) {
    try {
      const meta = { day: S.day, money: S.money, birds: S.birds.length, won: !!S.won, sandbox: !!S.sandbox };
      return set('slot' + slot, JSON.stringify({ meta, data: RB.state.serialize(S) }));
    } catch (e) { return false; }
  }
  function info(slot) { try { const o = JSON.parse(get('slot' + slot) || 'null'); return o ? o.meta : null; } catch (e) { return null; } }
  function load(slot) { try { const o = JSON.parse(get('slot' + slot) || 'null'); return o ? RB.state.deserialize(o.data) : null; } catch (e) { return null; } }
  const remove = (slot) => del('slot' + slot);
  function exportText(slot) { const raw = get('slot' + slot); return raw ? btoa(unescape(encodeURIComponent(raw))) : ''; }
  function importText(slot, text) {
    try {
      const raw = decodeURIComponent(escape(atob(text.trim()))), o = JSON.parse(raw);
      if (!o || !o.data || !o.data.birds) return false;
      RB.state.deserialize(o.data);
      return set('slot' + slot, raw);
    } catch (e) { return false; }
  }
  // crispr: play the cutting mini-game for each gene edit (off: edits apply at once)
  // goals: show the next goal as a hint at the top of the yard and the map
  // musicMode: 'always' (one track after another) or 'sometimes' (quiet stretches between the open-air tracks)
  // viewZoom: how far the road map sees, from 1 (the usual view) to 2 (twice as far)
  // impactFrames: a flying kick that lands freezes the bout for a moment with two stark black-and-white frames
  const DEFAULTS = { sfx: 0.8, music: 0.5, fast: false, crispr: true, goals: true, musicMode: 'always', viewZoom: 1, impactFrames: true };
  function settings() { try { return Object.assign({}, DEFAULTS, JSON.parse(get('settings') || '{}')); } catch (e) { return Object.assign({}, DEFAULTS); } }
  const setSettings = (o) => set('settings', JSON.stringify(o));

  RB.save = { save, info, load, remove, exportText, importText, settings, setSettings };
})();
