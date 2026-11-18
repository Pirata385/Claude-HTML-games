/* Shops: what each one sells today, buying and selling. */
(function (root) {
  'use strict';
  const PA = root.PA = root.PA || {};
  const item = (id, price) => ({ id, price: price != null ? price : (PA.Items.get(id).buy || PA.Items.get(id).price * 2) });
  const WORD_PRICE = { structure: 120, physics: 180, tool: 250, combat: 320, home: 90 };
  const Shops = PA.Shops = {
    NAMES: { store: "Clem's Seeds & Goods", stationer: 'Ink & Paper', smith: 'Smithy', cafe: 'Café', clinic: 'Clinic', carpenter: 'Carpentry', ranch: 'Ranch', hut: 'Bait & Tackle', inn: "Wren's Rare Words", library: 'Library', hall: 'Town Hall' },
    stock(shop, s) {
      const season = s.season, out = [];
      if (shop === 'store') {
        for (const it of PA.Items.byCat('seed')) if (it.seasons.includes(season)) out.push(item(it.id, it.buy));
        out.push(item('fertilizer', 20), item('bread', 120), item('hay', 60), item('chest', 300));
        if (!s.flags.bag48) out.push({ id: 'bag48', label: 'Bigger backpack (48 slots)', price: 2000, flag: 'bag48' });
      } else if (shop === 'stationer') {
        out.push(item('graphite', 30), item('ink', 60));
        const unknown = PA.Words.ALL.filter((w) => !s.words.includes(w.id) && !['bomb', 'balloon', 'rope', 'spring', 'hammer', 'boat', 'seesaw'].includes(w.id));
        for (const w of unknown.slice(0, 6 + Math.min(6, Math.floor((s.stats.days || 0) / 7)))) out.push({ id: 'word', word: w.id, label: 'Word card: ' + w.name, price: WORD_PRICE[w.cat] });
        if (!s.flags.padBig) out.push({ id: 'padBig', label: 'Big sketchpad (24 x 14)', price: 1500, flag: 'padBig' });
      } else if (shop === 'smith') {
        out.push(item('copper_ore', 75), item('iron_ore', 150), item('charcoal', 40), { id: 'sword', label: 'Sword', price: 400, extra: { lvl: 0 } });
        out.push({ id: 'upgrade', label: 'Upgrade a tool (bring bars)', price: 0, upgrade: true });
      } else if (shop === 'cafe') {
        for (const id of ['coffee', 'bread', 'omelet', 'salad', 'soup', 'pie']) out.push(item(id));
      } else if (shop === 'clinic') {
        out.push(item('salad', 220), item('soup', 300));
      } else if (shop === 'carpenter') {
        out.push(item('wood', 10), item('stone', 20), item('hardwood', 60));
        for (const [b, price, wood, stone] of [['coop', 4000, 300, 100], ['barn', 6000, 350, 150], ['kitchen', 10000, 450, 0]]) if (!s.flags[b]) out.push({ id: b, label: 'Build: ' + b, price, flag: b, needs: { wood, stone } });
      } else if (shop === 'ranch') {
        out.push(item('hay', 50));
        for (const [a, price, need] of [['chicken', 800, 'coop'], ['cow', 1500, 'barn'], ['goat', 4000, 'barn'], ['sheep', 8000, 'barn']]) out.push({ id: 'animal', animal: a, label: 'Buy a ' + a + (s.flags[need] ? '' : ' (needs a ' + need + ')'), price, needs: { flag: need } });
      } else if (shop === 'hut') {
        out.push(item('bait', 5), { id: 'rod', label: 'Fishing Rod', price: 500, extra: { lvl: 0 } });
      } else if (shop === 'inn') {
        for (const id of ['bomb', 'balloon', 'rope', 'spring', 'hammer', 'boat', 'seesaw']) if (!s.words.includes(id)) out.push({ id: 'word', word: id, label: 'Rare word: ' + PA.Words.get(id).name, price: 900 });
      }
      return out;
    },
    /** Buy n of a stock entry. Returns true on success. */
    buy(s, inv, e, n = 1) {
      if (e.upgrade) return false;
      const total = e.price * n;
      if (s.gold < total) return false;
      if (e.needs && e.needs.flag && !s.flags[e.needs.flag]) return false;
      if (e.needs && (e.needs.wood || e.needs.stone) && (inv.count('wood') < (e.needs.wood || 0) || inv.count('stone') < (e.needs.stone || 0))) return false;
      if (e.word) { if (s.words.includes(e.word)) return false; s.words.push(e.word); s.gold -= total; return true; }
      if (e.flag) {
        if (e.needs) { if (e.needs.wood) inv.remove('wood', e.needs.wood); if (e.needs.stone) inv.remove('stone', e.needs.stone); }
        s.flags[e.flag] = e.flag === 'coop' || e.flag === 'barn' || e.flag === 'kitchen' ? (s.stats.days || 0) + 2 : true;
        s.gold -= total;
        if (e.flag === 'bag48') inv.grow(48);
        return true;
      }
      if (e.id === 'animal') { s.animals.push({ kind: e.animal, name: e.animal[0].toUpperCase() + e.animal.slice(1) + ' ' + (s.animals.length + 1), happy: 50, fed: true, petted: false, age: 0 }); s.gold -= total; return true; }
      if (inv.add(e.id, n, e.extra ? Object.assign({}, e.extra) : undefined) !== 0) return false;
      s.gold -= total;
      return true;
    },
    sell(s, inv, slotIndex, n) {
      const sl = inv.slots[slotIndex]; if (!sl) return 0;
      const it = PA.Items.get(sl.id); if (!it || it.cat === 'tool' || !it.price) return 0;
      const out = inv.takeAt(slotIndex, n || sl.n);
      const g = PA.Items.sellPrice(out.id, out.extra) * out.n;
      s.gold += g;
      return g;
    },
    /** Tool upgrade at Gus: [bars, gold] by target level. */
    UPGRADE: [null, ['copper_bar', 2000], ['iron_bar', 5000], ['gold_bar', 10000]],
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = Shops;
})(typeof window !== 'undefined' ? window : globalThis);
