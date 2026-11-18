/* Ink economy: pencil (graphite lead, temporary drawings) and pen (ink, permanent). 1 item refills 10 units. */
(function (root) {
  'use strict';
  const PA = root.PA = root.PA || {};
  const KEY = (medium) => (medium === 'pen' ? 'ink' : 'graphite');
  const length = (strokes) => { let L = 0; for (const s of strokes) for (let i = 1; i < s.length; i++) L += Math.hypot(s[i].x - s[i - 1].x, s[i].y - s[i - 1].y); return L; };
  PA.Ink = {
    length,
    valid(strokes) { return !!strokes && strokes.length > 0 && length(strokes) >= 12; },
    cost(strokes, wordId) {
      if (!PA.Ink.valid(strokes)) return 0;
      const w = PA.Words.get(wordId), mult = w ? w.mult : 1;
      return Math.max(1, Math.round(length(strokes) / PA.C.CELL_W * 0.5 * mult));
    },
    available(state, inv, medium) { const k = KEY(medium); return state.ink[k] + (inv ? inv.count(k) * 10 : 0); },
    charge(state, inv, cost, medium) {
      const k = KEY(medium);
      let have = state.ink[k];
      if (have < cost) {
        const need = Math.ceil((cost - have) / 10);
        if (!inv || inv.count(k) < need) return false;
        inv.remove(k, need);
        have += need * 10;
      }
      state.ink[k] = have - cost;
      return true;
    },
    refund(state, obj) { const k = KEY(obj.medium); state.ink[k] += Math.floor((obj.cost || 0) / 2); },
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = PA.Ink;
})(typeof window !== 'undefined' ? window : globalThis);
