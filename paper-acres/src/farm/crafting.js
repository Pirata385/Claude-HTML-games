/* Machines, chests and workbench recipes, plus the vector drawings of placed objects. */
(function (root) {
  'use strict';
  const PA = root.PA = root.PA || {};
  const C = PA.C;
  const now = (s) => (s.stats.days || 0) * 1440 + s.time;
  // machine: [inputs {id: n}, output id, n, minutes]
  const MACHINES = {
    kiln: [[{ wood: 10 }, 'charcoal', 1, 60], [{ charcoal: 2 }, 'graphite', 3, 120]],
    inkpress: [[{ inkcap: 1 }, 'ink', 1, 90], [{ blueberry: 5 }, 'ink', 1, 120], [{ blackberry: 6 }, 'ink', 1, 120], [{ cranberry: 5 }, 'ink', 1, 120]],
    furnace: [[{ copper_ore: 5, charcoal: 1 }, 'copper_bar', 1, 180], [{ iron_ore: 5, charcoal: 1 }, 'iron_bar', 1, 240], [{ gold_ore: 5, charcoal: 1 }, 'gold_bar', 1, 300]],
  };
  const FRUIT = ['strawberry', 'melon', 'blueberry', 'cranberry', 'grape', 'spiceberry', 'blackberry', 'frostberry', 'tomato'];
  const RECIPES = [
    ['chest', { wood: 50 }], ['kiln', { stone: 30, wood: 10 }], ['furnace', { stone: 25, copper_ore: 10 }],
    ['inkpress', { wood: 30, stone: 10, copper_bar: 1 }], ['jar', { wood: 50, stone: 40, charcoal: 4 }],
    ['scarecrow', { wood: 50, fiber: 20, charcoal: 1 }], ['sprinkler', { copper_bar: 1, iron_bar: 1 }],
    ['lantern_post', { wood: 5, charcoal: 1 }], ['bait', { fiber: 5 }], ['fertilizer', { sap: 2, fiber: 2 }],
  ];

  const Craft = PA.Craft = {
    MACHINES, RECIPES, now,
    canCraft(inv, req) { return Object.keys(req).every((k) => inv.count(k) >= req[k]); },
    craft(game, i) {
      const [id, req] = RECIPES[i], inv = game.inv;
      if (!Craft.canCraft(inv, req)) return false;
      if (inv.free() === 0 && !inv.has(id)) { PA.UI.toast('Your bag is full.'); return false; }
      for (const k in req) inv.remove(k, req[k]);
      inv.add(id, id === 'bait' ? 5 : 1);
      PA.UI.toast('Crafted ' + PA.Items.get(id).name);
      PA.Bus.emit('craft');
      return true;
    },
    /** Interact with a placed object: collect, load, or open. */
    use(game, o) {
      const s = game.state, inv = game.inv;
      if (o.id === 'chest') { PA.UI.Chest.open(game, o); return true; }
      if (o.out) {
        if (o.readyAt > now(s)) { PA.UI.toast('Working... ready at ' + PA.U.fmtTime(o.readyAt % 1440 || 0) + (o.readyAt - now(s) > 1440 - s.time ? ' tomorrow' : '')); return true; }
        if (inv.add(o.out.id, o.out.n, o.out.extra) === 0) { PA.UI.toast('+' + o.out.n + ' ' + PA.Items.label(o.out)); o.out = null; PA.Bus.emit('pickup'); }
        else PA.UI.toast('Your bag is full.');
        return true;
      }
      const slot = inv.slots[game.hot];
      if (o.id === 'jar') {
        const it = slot && PA.Items.get(slot.id);
        if (!it || (it.cat !== 'crop' && it.cat !== 'forage') || !it.edible) { PA.UI.toast('Put a fruit or vegetable in the jar.'); return true; }
        inv.takeAt(game.hot, 1);
        o.out = { id: FRUIT.includes(it.id) ? 'jam' : 'pickles', n: 1, extra: { from: it.id } }; o.readyAt = now(s) + 2 * 1440;
        PA.UI.toast('The jar is preserving your ' + it.name + '.');
        return true;
      }
      const list = MACHINES[o.id];
      if (!list) return false;
      for (const [req, out, n, min] of list) {
        if (!slot || !(slot.id in req)) continue;
        if (!Craft.canCraft(inv, req)) { PA.UI.toast('Needs ' + Object.entries(req).map(([k, v]) => v + ' ' + PA.Items.get(k).name).join(' + ')); return true; }
        for (const k in req) inv.remove(k, req[k]);
        o.out = { id: out, n }; o.readyAt = now(s) + min;
        PA.UI.toast(PA.Items.get(o.id).name + ' started (' + min + ' min)');
        PA.Bus.emit('machine');
        return true;
      }
      PA.UI.toast(PA.Items.get(o.id).name + ': ' + list.map(([req, out]) => Object.keys(req).map((k) => PA.Items.get(k).name).join('+') + ' -> ' + PA.Items.get(out).name).join(', '));
      return true;
    },
    newDay() { /* machines run on the absolute clock; nothing to do */ },

    /** Draw a placed object with ctx in its slice (world px). */
    draw(ctx, o, st, s) {
      const x = o.x * C.CELL_W, b = (o.gy != null ? o.gy : PA.Gen.GY) * C.CELL_H - 1.6, w = (o.w || 2) * C.CELL_W;
      ctx.lineWidth = st.lw; ctx.strokeStyle = st.ink; ctx.fillStyle = st.paper; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      const box = (x0, y0, ww, hh) => { ctx.beginPath(); ctx.rect(x0, y0, ww, hh); ctx.fill(); ctx.stroke(); };
      ctx.beginPath();
      switch (o.id) {
        case 'chest': box(x + 2, b - 18, w - 4, 18); ctx.beginPath(); ctx.moveTo(x + 2, b - 12); ctx.lineTo(x + w - 2, b - 12); ctx.rect(x + w / 2 - 2, b - 14, 4, 5); ctx.stroke(); break;
        case 'kiln': ctx.moveTo(x + 2, b); ctx.quadraticCurveTo(x + w / 2, b - 50, x + w - 2, b); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.beginPath(); ctx.rect(x + w / 2 - 5, b - 10, 10, 10); ctx.moveTo(x + w / 2 + 3, b - 30); ctx.lineTo(x + w / 2 + 3, b - 42); ctx.stroke(); break;
        case 'furnace': box(x + 2, b - 30, w - 4, 30); ctx.beginPath(); ctx.moveTo(x + 6, b - 30); ctx.lineTo(x + 10, b - 42); ctx.lineTo(x + w - 10, b - 42); ctx.lineTo(x + w - 6, b - 30); ctx.rect(x + 8, b - 14, w - 16, 9); ctx.stroke(); break;
        case 'inkpress': box(x + 3, b - 22, w - 6, 22); ctx.beginPath(); ctx.moveTo(x + w / 2, b - 22); ctx.lineTo(x + w / 2, b - 40); ctx.moveTo(x + w / 2 - 9, b - 40); ctx.lineTo(x + w / 2 + 9, b - 40); ctx.stroke(); break;
        case 'jar': ctx.moveTo(x + 6, b); ctx.lineTo(x + 5, b - 20); ctx.lineTo(x + w - 5, b - 20); ctx.lineTo(x + w - 6, b); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.beginPath(); ctx.rect(x + 7, b - 25, w - 14, 5); ctx.stroke(); break;
        case 'sprinkler': ctx.moveTo(x + w / 2, b); ctx.lineTo(x + w / 2, b - 10); ctx.moveTo(x + w / 2 - 7, b - 10); ctx.lineTo(x + w / 2 + 7, b - 10); ctx.moveTo(x + w / 2 - 4, b - 15); ctx.lineTo(x + w / 2 + 4, b - 6); ctx.moveTo(x + w / 2 + 4, b - 15); ctx.lineTo(x + w / 2 - 4, b - 6); ctx.stroke(); break;
        case 'scarecrow': { const cx = x + w / 2; ctx.moveTo(cx, b); ctx.lineTo(cx, b - 48); ctx.moveTo(cx - 16, b - 36); ctx.lineTo(cx + 16, b - 36); ctx.moveTo(cx + 7, b - 52); ctx.arc(cx, b - 52, 7, 0, Math.PI * 2); ctx.moveTo(cx - 11, b - 58); ctx.lineTo(cx + 11, b - 58); ctx.moveTo(cx - 6, b - 58); ctx.lineTo(cx - 4, b - 66); ctx.lineTo(cx + 4, b - 66); ctx.lineTo(cx + 6, b - 58); ctx.stroke(); break; }
        case 'lantern_post': { const cx = x + w / 2; ctx.moveTo(cx, b); ctx.lineTo(cx, b - 44); ctx.lineTo(cx + 10, b - 44); ctx.stroke(); box(cx + 6, b - 42, 8, 10); break; }
        default: box(x + 2, b - 16, w - 4, 16);
      }
      // a finished machine shows a little flag
      if (o.out && s && o.readyAt <= now(s)) { ctx.beginPath(); ctx.moveTo(x + w / 2, b - 52); ctx.lineTo(x + w / 2, b - 70); ctx.lineTo(x + w / 2 + 10, b - 66); ctx.lineTo(x + w / 2, b - 62); ctx.stroke(); }
    },
    /** Forage: a small drawn plant or mushroom with a hint mark. */
    drawForage(ctx, f, st, g) {
      const x = (f.x + 0.5) * C.CELL_W, b = g.surfaceY(f.x, f.z) * C.CELL_H - 1.6;
      ctx.lineWidth = st.lw; ctx.strokeStyle = st.ink; ctx.fillStyle = st.paper;
      ctx.beginPath();
      if (f.id === 'inkcap' || f.id === 'mushroom') { ctx.moveTo(x, b); ctx.lineTo(x, b - 8); ctx.moveTo(x - 7, b - 8); ctx.quadraticCurveTo(x, b - 20, x + 7, b - 8); ctx.closePath(); ctx.fill(); }
      else if (['grape', 'blackberry', 'spiceberry', 'frostberry', 'hazelnut'].includes(f.id)) { ctx.moveTo(x, b); ctx.lineTo(x - 4, b - 12); ctx.moveTo(x, b); ctx.lineTo(x + 5, b - 10); for (const [ox, oy] of [[-4, -14], [5, -12], [1, -17]]) { ctx.moveTo(x + ox + 2, b + oy); ctx.arc(x + ox, b + oy, 2, 0, Math.PI * 2); } }
      else { ctx.moveTo(x, b); ctx.lineTo(x, b - 14); ctx.moveTo(x, b - 6); ctx.lineTo(x - 6, b - 12); ctx.moveTo(x, b - 8); ctx.lineTo(x + 6, b - 14); ctx.moveTo(x + 3, b - 16); ctx.arc(x, b - 16, 3, 0, Math.PI * 2); }
      ctx.stroke();
      // sparkle so it reads as "pick me"
      ctx.beginPath(); ctx.moveTo(x + 9, b - 22); ctx.lineTo(x + 9, b - 16); ctx.moveTo(x + 6, b - 19); ctx.lineTo(x + 12, b - 19); ctx.stroke();
    },
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = Craft;
})(typeof window !== 'undefined' ? window : globalThis);
