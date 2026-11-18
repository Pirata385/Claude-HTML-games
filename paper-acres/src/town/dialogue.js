/* Friendship maths, schedules and line picking (pure logic). */
(function (root) {
  'use strict';
  const PA = root.PA = root.PA || {};
  const PTS_PER_HEART = 250, MAX = 2500;
  const rel = (s, id) => (s.npcs[id] = s.npcs[id] || { pts: 0, talked: false, giftedToday: false, giftsWeek: 0, met: false, seen: {} });
  const D = PA.Dialogue = {
    PTS_PER_HEART,
    rel,
    hearts(s, id) { return Math.floor(rel(s, id).pts / PTS_PER_HEART); },
    /** Daily chat: +20 once per day. Returns points gained. */
    talk(s, id) { const r = rel(s, id); if (r.talked) return 0; r.talked = true; r.met = true; r.pts = Math.min(MAX, r.pts + 20); return 20; },
    taste(n, itemId) { if (n.loves.includes(itemId)) return 'love'; if (n.likes.includes(itemId)) return 'like'; if (n.hates.includes(itemId)) return 'hate'; const it = PA.Items.get(itemId); if (it && (it.cat === 'material' && itemId !== 'quartz' && itemId !== 'inkstone')) return 'dislike'; return 'neutral'; },
    isBirthday(s, n) { return s.season === n.birthday[0] && s.day === n.birthday[1]; },
    /** Give a gift: one per day, two per week. Returns {points, taste, ok}. */
    gift(s, n, itemId) {
      const r = rel(s, n.id);
      if (r.giftedToday || (r.giftsWeek >= 2 && !D.isBirthday(s, n))) return { points: 0, ok: false };
      const t = D.taste(n, itemId);
      let pts = { love: 80, like: 45, neutral: 20, dislike: -20, hate: -40 }[t];
      if (D.isBirthday(s, n)) pts *= 8;
      r.pts = PA.U.clamp(r.pts + pts, 0, MAX);
      r.giftedToday = true; r.giftsWeek++; r.met = true;
      return { points: pts, taste: t, ok: true };
    },
    newDay(s) { for (const id in s.npcs) { const r = s.npcs[id]; r.talked = false; r.giftedToday = false; if ((s.day - 1) % 7 === 0) r.giftsWeek = 0; } },
    /** Where an NPC is at game minute t (festivals and rain override). */
    whereAt(n, t, ctx) {
      if (ctx && PA.Festivals && PA.Festivals.active(ctx, t)) { const f = PA.Festivals.spot(ctx, n); if (f) return f; }
      let cur = n.sched[0][1];
      for (const [time, loc] of n.sched) if (t >= time) cur = loc;
      if (ctx && (ctx.weather === 'rain' || ctx.weather === 'storm') && cur.map === 'overworld' && n.id !== 'bram') cur = n.sched.find((q) => q[1].map !== 'overworld')[1];
      if (cur.keeper) {
        const room = PA.Gen && PA.Gen.ROOMS ? PA.Gen.ROOMS[cur.map] : null;
        return { map: cur.map, x: room && room.keeper != null ? room.keeper : 10, z: 1, keeper: true };
      }
      return cur;
    },
    /** Pick what an NPC says now. */
    line(s, n) {
      const r = rel(s, n.id), L = n.lines, h = D.hearts(s, n.id);
      if (!r.met) { r.met = true; return L.intro; }
      if (D.isBirthday(s, n)) return 'It is my birthday today!';
      const fest = PA.Festivals && PA.Festivals.on(s.season, s.day, s.seasonDays);
      if (fest && Math.random() < 0.5) return L[PA.SEASONS[s.season]];
      if ((s.weather === 'rain' || s.weather === 'storm') && Math.random() < 0.4) return L.rain[0];
      if (Math.random() < 0.15) return L[PA.SEASONS[s.season]];
      const pool = h >= 6 ? L.l2 : h >= 3 ? L.l1 : L.l0;
      return pool[(s.day + s.season * 7 + n.id.length) % pool.length];
    },
    /** Heart events at 3 and 6 hearts (once). Returns {lines, gift} or null. */
    heartEvent(s, n) {
      const r = rel(s, n.id), h = D.hearts(s, n.id);
      for (const k of [3, 6]) if (h >= k && !r.seen['h' + k]) { r.seen['h' + k] = true; return { lines: n.lines['h' + k], gift: n.lines['h' + k + 'gift'] }; }
      return null;
    },
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = D;
})(typeof window !== 'undefined' ? window : globalThis);
