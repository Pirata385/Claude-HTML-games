/* Crops: growth rules (pure) and their little vector drawings. */
(function (root) {
  'use strict';
  const PA = root.PA = root.PA || {};
  const DEFS = {};
  for (const c of PA.CROP_TABLE) DEFS[c[0]] = { id: c[0], seasons: c[3], days: c[4], regrow: c[5], shape: SHAPE(c[0]) };
  function SHAPE(id) {
    if (['parsnip', 'potato', 'yam', 'kale', 'frostlettuce'].includes(id)) return 'root';
    if (['corn'].includes(id)) return 'tall';
    if (['strawberry', 'blueberry', 'cranberry', 'snowpea'].includes(id)) return 'berry';
    if (['melon', 'pumpkin', 'wintersquash', 'cauliflower'].includes(id)) return 'big';
    return 'vine'; // tomato, eggplant
  }
  const Crops = PA.Crops = {
    DEFS,
    /** One night: grow if watered (or rained), wither out of season, soil dries unless it rained. */
    grow(c, season, rained) {
      const d = DEFS[c.id];
      if (!d || c.dead) return;
      if (!d.seasons.includes(season)) { c.dead = true; return; }
      if (rained) c.wet = true;
      if (c.wet && !Crops.ready(c)) c.days++;
      c.wet = !!rained;
    },
    ready(c) { const d = DEFS[c.id]; return !!d && !c.dead && c.days >= (c.regrown ? d.regrow : d.days); },
    stage(c) { const d = DEFS[c.id]; if (!d) return 0; if (c.dead) return -1; const need = c.regrown ? d.regrow : d.days; return Crops.ready(c) ? 4 : Math.min(3, Math.floor(c.days / need * 4)); },
    /** Returns {id, n, remove} or null when not ready. Regrowing crops stay in the ground. */
    harvest(c) {
      if (!Crops.ready(c)) return null;
      const d = DEFS[c.id];
      const n = d.shape === 'berry' ? 2 + (c.days % 2) : 1;
      if (d.regrow) { c.days = 0; c.regrown = true; return { id: c.id, n, remove: false }; }
      return { id: c.id, n, remove: true };
    },
    /** Draw a crop standing on the ground line at world (bx, by). */
    draw(ctx, c, bx, by, st) {
      const d = DEFS[c.id], s = Crops.stage(c);
      ctx.lineWidth = st.lw; ctx.strokeStyle = st.ink; ctx.fillStyle = st.paper; ctx.lineCap = 'round';
      ctx.beginPath();
      if (s < 0) { ctx.moveTo(bx - 4, by); ctx.lineTo(bx + 2, by - 6); ctx.lineTo(bx + 6, by - 3); ctx.stroke(); return; }
      if (s === 0) { ctx.moveTo(bx + 1.5, by - 2); ctx.arc(bx, by - 2, 1.5, 0, Math.PI * 2); ctx.stroke(); return; }
      const h = [0, 7, 13, 18, 22][s] * (d.shape === 'tall' ? 1.8 : d.shape === 'vine' ? 1.3 : 1);
      ctx.moveTo(bx, by); ctx.lineTo(bx, by - h);
      ctx.moveTo(bx, by - h * 0.45); ctx.quadraticCurveTo(bx - 6, by - h * 0.75, bx - 8, by - h * 0.5);
      ctx.moveTo(bx, by - h * 0.6); ctx.quadraticCurveTo(bx + 6, by - h * 0.95, bx + 8, by - h * 0.7);
      if (s >= 3) { ctx.moveTo(bx, by - h * 0.85); ctx.quadraticCurveTo(bx - 5, by - h * 1.1, bx - 6, by - h * 0.9); }
      ctx.stroke();
      if (s === 4) {
        ctx.beginPath();
        if (d.shape === 'root') { ctx.moveTo(bx - 5, by); ctx.quadraticCurveTo(bx, by - 8, bx + 5, by); }
        else if (d.shape === 'big') { ctx.moveTo(bx + 18, by - 7); ctx.ellipse(bx + 9, by - 7, 9, 7, 0, 0, Math.PI * 2); }
        else if (d.shape === 'berry') { for (const [ox, oy] of [[-6, -10], [5, -13], [-2, -16]]) { ctx.moveTo(bx + ox + 2.2, by + oy); ctx.arc(bx + ox, by + oy, 2.2, 0, Math.PI * 2); } }
        else if (d.shape === 'tall') { ctx.moveTo(bx + 3, by - h * 0.55); ctx.ellipse(bx + 5, by - h * 0.65, 3, 7, 0.3, 0, Math.PI * 2); }
        else { ctx.moveTo(bx + 9, by - h * 0.6); ctx.arc(bx + 5, by - h * 0.6, 4, 0, Math.PI * 2); ctx.moveTo(bx - 3, by - h * 0.35); ctx.arc(bx - 7, by - h * 0.35, 4, 0, Math.PI * 2); }
        ctx.fill(); ctx.stroke();
      }
    },
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = Crops;
})(typeof window !== 'undefined' ? window : globalThis);
