/* One festival per season, held at the plaza. */
(function (root) {
  'use strict';
  const PA = root.PA = root.PA || {};
  const LIST = [
    { season: 0, day: 13, name: 'Doodle Fair', from: 540, to: 840, kind: 'draw' },
    { season: 1, day: 20, name: 'Lantern Night', from: 1200, to: 1380, kind: 'lanterns' },
    { season: 2, day: 16, name: 'Harvest Weigh-in', from: 540, to: 840, kind: 'weigh' },
    { season: 3, day: 25, name: 'Snow Sketch', from: 540, to: 840, kind: 'draw' },
  ];
  const dayOf = (f, seasonDays) => (seasonDays === 14 ? Math.ceil(f.day / 2) : f.day);
  PA.Festivals = {
    LIST,
    today(s) { return LIST.find((f) => f.season === s.season && dayOf(f, s.seasonDays) === s.day) || null; },
    on(season, day, seasonDays) { const f = LIST.find((q) => q.season === season && dayOf(q, seasonDays || 28) === day); return f ? f.name : null; },
    active(ctx, t) { const f = LIST.find((q) => q.season === ctx.season && dayOf(q, ctx.seasonDays) === ctx.day); return !!f && t >= f.from - 30 && t <= f.to; },
    spot(ctx, n) { const i = PA.NPC_DATA.indexOf(n); return { map: 'overworld', x: (ctx.season === 1 ? 352 : 252) + (i % 7) * 4, z: ctx.season === 1 ? 3 : 7 }; },
    /** Score a drawing for the contest: more strokes, more closed shapes, bigger, more varied. */
    judge(strokes) {
      const f = PA.Shapes.features(strokes);
      const L = PA.Ink.length(strokes);
      return Math.round(Math.min(40, strokes.length * 3) + Math.min(30, L / 25) + (f.closed ? 10 : 0) + Math.round((1 - Math.max(f.H, f.V, f.D)) * 20));
    },
  };
})(typeof window !== 'undefined' ? window : globalThis);
