/* Livestock: bought at the ranch (never drawn), fed with hay, petted, producing every few days. */
(function (root) {
  'use strict';
  const PA = root.PA = root.PA || {};
  const C = PA.C;
  const KINDS = { chicken: { home: 'coop', product: 'egg', every: 1 }, cow: { home: 'barn', product: 'milk', every: 1 }, goat: { home: 'barn', product: 'goat_milk', every: 2 }, sheep: { home: 'barn', product: 'wool', every: 3 } };
  const Animals = PA.Animals = {
    KINDS,
    /** One night for one animal; returns the product id or null. */
    overnight(a) {
      const k = KINDS[a.kind];
      a.happy = PA.U.clamp(a.happy + (a.fed ? 6 : -18) + (a.petted ? 8 : -4), 0, 100);
      a.age = (a.age || 0) + 1;
      a.since = (a.since || 0) + 1;
      let out = null;
      if (a.fed && a.age >= 2 && a.since >= k.every) { out = k.product; a.since = 0; }
      a.fed = false; a.petted = false;
      return out;
    },
    newDay(game) {
      const s = game.state;
      s.flags.hay = s.flags.hay || 0;
      s.flags.products = s.flags.products || [];
      for (const a of s.animals) {
        const home = KINDS[a.kind].home;
        if (s.flags[home] !== true) continue;
        if (s.flags.hay > 0) { s.flags.hay--; a.fed = true; }
        const out = Animals.overnight(a);
        if (out) s.flags.products.push({ map: home, id: out, x: 3 + Math.floor(Math.random() * 16), q: a.happy > 70 ? 'good' : 'normal' });
      }
    },
    /** In the coop/barn: pet the nearest animal, fill the feeder, pick up products. */
    interact(game) {
      const s = game.state, p = game.player, cx = Math.floor(p.x / C.CELL_W);
      if (game.map.id !== 'coop' && game.map.id !== 'barn') return false;
      const prods = (s.flags.products || []);
      const prod = prods.find((q) => q.map === game.map.id && Math.abs(q.x - cx) <= 2);
      if (prod) { if (game.inv.add(prod.id, 1) === 0) { prods.splice(prods.indexOf(prod), 1); PA.UI.toast('+1 ' + PA.Items.get(prod.id).name); PA.Bus.emit('pickup'); } return true; }
      const sel = game.inv.slots[game.hot];
      if (sel && sel.id === 'hay' && cx < 8) { const n = sel.n; game.inv.takeAt(game.hot, n); s.flags.hay = (s.flags.hay || 0) + n; PA.UI.toast('Feeder: ' + s.flags.hay + ' hay'); return true; }
      const a = (game.animalActors || []).find((q) => Math.abs(q.x - p.x) < 30);
      if (a) { if (!a.rec.petted) { a.rec.petted = true; a.rec.happy = Math.min(100, a.rec.happy + 3); PA.UI.toast(a.rec.name + ' looks happy. (' + a.rec.happy + '% happy)'); PA.Bus.emit('pet', { kind: a.rec.kind }); } else PA.UI.toast(a.rec.name + ' already got pets today.'); return true; }
      if (cx < 8) { PA.UI.toast('Feeder: ' + (s.flags.hay || 0) + ' hay. Hold hay and act here to fill it.'); return true; }
      return false;
    },
    /** Kinematic wanderers inside their building. */
    actors(game) {
      const s = game.state, id = game.map.id;
      if (id !== 'coop' && id !== 'barn') { game.animalActors = []; return; }
      if (!game.animalActors || game.animalActors.map !== id) {
        game.animalActors = s.animals.filter((a) => KINDS[a.kind].home === id).map((rec, i) => ({ rec, x: (4 + i * 3.3) * C.CELL_W, vx: 0, t: Math.random() * 3, z: i % 2 }));
        game.animalActors.map = id;
      }
    },
    step(game, dt) {
      for (const a of game.animalActors || []) {
        a.t -= dt / 1000;
        if (a.t <= 0) { a.t = 1.5 + Math.random() * 3; a.vx = Math.random() < 0.5 ? 0 : (Math.random() - 0.5) * 0.8; }
        a.x = PA.U.clamp(a.x + a.vx * dt / 16.7, 2 * C.CELL_W, (game.map.grid.w - 3) * C.CELL_W);
        if (a.vx) a.facing = Math.sign(a.vx);
      }
    },
    draw(R, z, p, st, game) {
      if (p.level < 0) return;
      const ctx = R.ctx, s = game.state;
      R.use(p);
      ctx.lineWidth = st.lw; ctx.strokeStyle = st.ink; ctx.fillStyle = st.paper; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      const b = PA.Gen.FY * C.CELL_H - 1.6;
      for (const a of game.animalActors || []) {
        if (a.z !== z) continue;
        ctx.save(); ctx.translate(a.x, b); ctx.scale(a.facing || 1, 1);
        Animals.shape(ctx, a.rec.kind, (game.simTime || 0) / 300 + a.x);
        ctx.restore();
      }
      if (z === 0) for (const q of s.flags.products || []) {
        if (q.map !== game.map.id) continue;
        ctx.beginPath(); const x = (q.x + 0.5) * C.CELL_W;
        if (q.id === 'egg') ctx.ellipse(x, b - 5, 4, 5, 0, 0, Math.PI * 2); else if (q.id === 'wool') { ctx.arc(x, b - 6, 6, 0, Math.PI * 2); ctx.moveTo(x - 3, b - 6); ctx.arc(x - 3, b - 8, 3, 0, Math.PI * 2); } else { ctx.rect(x - 5, b - 14, 10, 14); ctx.moveTo(x - 6, b - 14); ctx.lineTo(x + 6, b - 14); }
        ctx.fill(); ctx.stroke();
      }
    },
    /** Outline drawings of each animal (facing right, feet on y=0). */
    shape(ctx, kind, t) {
      const step = Math.sin(t) * 2;
      ctx.beginPath();
      if (kind === 'chicken') {
        ctx.ellipse(0, -10, 8, 6, 0, 0, Math.PI * 2); ctx.moveTo(10, -18); ctx.arc(7, -18, 3, 0, Math.PI * 2);
        ctx.moveTo(10, -18); ctx.lineTo(13, -17); ctx.moveTo(-2, -4); ctx.lineTo(-2 + step * 0.5, 0); ctx.moveTo(2, -4); ctx.lineTo(2 - step * 0.5, 0); ctx.moveTo(-8, -12); ctx.lineTo(-12, -16);
      } else {
        const big = kind === 'cow' ? 1.3 : 1;
        ctx.ellipse(0, -18 * big, 16 * big, 8 * big, 0, 0, Math.PI * 2);
        ctx.moveTo(14 * big, -24 * big); ctx.lineTo(22 * big, -26 * big); ctx.lineTo(22 * big, -18 * big); ctx.lineTo(14 * big, -18 * big);
        for (const lx of [-10, -5, 6, 11]) { ctx.moveTo(lx * big, -11 * big); ctx.lineTo(lx * big + (lx % 2 ? step : -step) * 0.6, 0); }
        if (kind === 'goat') { ctx.moveTo(20, -26); ctx.lineTo(16, -32); ctx.moveTo(22, -18); ctx.lineTo(22, -14); }
        if (kind === 'sheep') { for (const [x, y] of [[-8, -24], [0, -26], [8, -24]]) { ctx.moveTo(x + 4, y); ctx.arc(x, y, 4, Math.PI, Math.PI * 2); } }
        if (kind === 'cow') { ctx.moveTo(18 * big, -26 * big); ctx.lineTo(16 * big, -30 * big); ctx.moveTo(-4, -22); ctx.ellipse(-5, -20, 4, 3, 0, 0, Math.PI * 2); }
      }
      ctx.fill(); ctx.stroke();
    },
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = Animals;
})(typeof window !== 'undefined' ? window : globalThis);
