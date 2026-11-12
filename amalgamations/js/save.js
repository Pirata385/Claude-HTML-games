// Amalgamations — save files: versioned JSON, compact explored-chunk encoding, slots, export/import.
(function (root) {
  'use strict';
  const AM = root.AM || (root.AM = {});
  const VERSION = 1;
  const PREFIX = 'amalgamations.save.';
  const SLOTS = 3;

  // Explored chunks "cx,cz" → rows "cz:a-b,c,d-e;..." (run-length encoded per row).
  function encodeChunks(set) {
    const rows = new Map();
    for (const k of set) {
      const [x, z] = k.split(',').map(Number);
      if (!rows.has(z)) rows.set(z, []);
      rows.get(z).push(x);
    }
    const out = [];
    for (const z of [...rows.keys()].sort((a, b) => a - b)) {
      const xs = rows.get(z).sort((a, b) => a - b);
      const runs = [];
      let s = xs[0], p = xs[0];
      for (let i = 1; i <= xs.length; i++) {
        if (i < xs.length && xs[i] === p + 1) { p = xs[i]; continue; }
        runs.push(s === p ? String(s) : `${s}_${p}`);
        if (i < xs.length) { s = p = xs[i]; }
      }
      out.push(`${z}:${runs.join(',')}`);
    }
    return out.join(';');
  }
  function decodeChunks(str) {
    const set = new Set();
    if (!str) return set;
    for (const row of str.split(';')) {
      const [zs, runs] = row.split(':');
      const z = Number(zs);
      for (const r of runs.split(',')) {
        const [a, b] = r.split('_').map(Number);
        for (let x = a; x <= (b == null ? a : b); x++) set.add(`${x},${z}`);
      }
    }
    return set;
  }

  function serialize(state) {
    const o = Object.assign({}, state, { version: VERSION });
    o.explored = encodeChunks(state.explored || new Set());
    return JSON.stringify(o, (k, v) => (v instanceof Set ? { __set: [...v] } : v));
  }
  function migrate(o) {
    if (!o.version) o.version = 1;
    // future versions: if (o.version < 2) { ...; o.version = 2; }
    return o;
  }
  function deserialize(str) {
    const o = JSON.parse(str, (k, v) => (v && typeof v === 'object' && Array.isArray(v.__set) ? new Set(v.__set) : v));
    o.explored = decodeChunks(o.explored);
    return migrate(o);
  }

  const b64e = (s) => (typeof btoa === 'function' ? btoa(unescape(encodeURIComponent(s))) : Buffer.from(s, 'utf8').toString('base64'));
  const b64d = (s) => (typeof atob === 'function' ? decodeURIComponent(escape(atob(s))) : Buffer.from(s, 'base64').toString('utf8'));
  const exportCode = (state) => 'AMG1:' + b64e(serialize(state));
  function importCode(code) {
    code = String(code || '').trim();
    if (!code.startsWith('AMG1:')) throw new Error('Not an Amalgamations save code');
    return deserialize(b64d(code.slice(5)));
  }

  // localStorage adapter (every call is guarded: storage can be missing or full).
  const store = {
    get(k) { try { return root.localStorage ? root.localStorage.getItem(k) : null; } catch (e) { return null; } },
    set(k, v) { try { if (root.localStorage) { root.localStorage.setItem(k, v); return true; } } catch (e) { /* quota or privacy mode */ } return false; },
    del(k) { try { if (root.localStorage) root.localStorage.removeItem(k); } catch (e) { /* ignore */ } },
  };
  function saveSlot(slot, state) { return store.set(PREFIX + slot, serialize(state)); }
  function loadSlot(slot) { const s = store.get(PREFIX + slot); if (!s) return null; try { return deserialize(s); } catch (e) { return null; } }
  function deleteSlot(slot) { store.del(PREFIX + slot); }
  function slotSummaries() {
    const out = [];
    for (let i = 0; i < SLOTS; i++) {
      const s = loadSlot(i);
      out.push(s ? { slot: i, name: s.formName || 'Creature', level: s.level, playtime: s.playtime || 0, saved: s.savedAt || 0, seed: s.seed } : { slot: i, empty: true });
    }
    return out;
  }
  function loadSettings() { try { return JSON.parse(store.get('amalgamations.settings') || 'null'); } catch (e) { return null; } }
  function saveSettings(s) { store.set('amalgamations.settings', JSON.stringify(s)); }

  Object.assign(AM, { SAVE_VERSION: VERSION, SAVE_SLOTS: SLOTS, encodeChunks, decodeChunks, serialize, deserialize, exportCode, importCode, saveSlot, loadSlot, deleteSlot, slotSummaries, loadSettings, saveSettings, store });
  if (typeof module !== 'undefined' && module.exports) module.exports = AM;
})(typeof window !== 'undefined' ? window : globalThis);
