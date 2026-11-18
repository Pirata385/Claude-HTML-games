/* Save slots in localStorage (paperacres.slot1..3), plus JSON export/import. Never throws. */
(function (root) {
  'use strict';
  const PA = root.PA = root.PA || {};
  const KEY = (n) => 'paperacres.slot' + n;
  const ls = () => { try { return root.localStorage || null; } catch (e) { return null; } };
  const valid = (s) => !!(s && typeof s === 'object' && s.v >= 1 && typeof s.seed === 'number' && typeof s.day === 'number' && s.farm);
  PA.Save = {
    SLOTS: 3,
    write(slot, state) {
      try { const st = ls(); if (!st) return false; st.setItem(KEY(slot), JSON.stringify(state)); return true; } catch (e) { return false; }
    },
    read(slot) {
      try {
        const st = ls(); if (!st) return null;
        const raw = st.getItem(KEY(slot)); if (!raw) return null;
        const s = JSON.parse(raw);
        return valid(s) ? s : null;
      } catch (e) { return null; }
    },
    remove(slot) { try { const st = ls(); if (st) st.removeItem(KEY(slot)); } catch (e) { /* ignore */ } },
    list() {
      const out = [];
      for (let i = 1; i <= this.SLOTS; i++) {
        const s = this.read(i);
        if (s) out.push({ slot: i, summary: `${s.farm} - ${s.name} - ${PA.SEASONS ? PA.SEASONS[s.season] : ''} ${s.day}, Y${s.year} - ${s.gold}g` });
      }
      return out;
    },
    exportJSON(slot) { const s = this.read(slot); return s ? JSON.stringify(s) : null; },
    importJSON(slot, json) {
      try { const s = JSON.parse(json); if (!valid(s)) return false; return this.write(slot, s); } catch (e) { return false; }
    },
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = PA.Save;
})(typeof window !== 'undefined' ? window : globalThis);
