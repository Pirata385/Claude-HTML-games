// Amalgamations — loot rolls, item names, crafting, upgrades, salvage and drop tables (pure).
// Inventory model: { items: [gear...], mats: {id: n}, cons: {id: n}, dna: {baseId: n} }
(function (root) {
  'use strict';
  const AM = root.AM || (root.AM = {});

  const INV_SIZE = 40;
  const NOUNS = ['of the Wolf', 'of Embers', 'of the Tide', 'of Thorns', 'of the Moon', 'of Echoes', 'of the Deep', 'of Storms', 'of the Wilds', 'of Dawn'];

  function rollRarity(rng, findPct, minTier, bonusTier) {
    const f = 1 + (findPct || 0);
    const weights = AM.RARITIES.map((r, i) => (i >= (minTier || 0) ? r.weight * (i >= 2 ? f * (1 + (bonusTier || 0)) : 1) : 0));
    let total = weights.reduce((a, b) => a + b, 0), x = rng.next() * total;
    for (let i = 0; i < weights.length; i++) { x -= weights[i]; if (x <= 0) return AM.RARITIES[i]; }
    return AM.RARITIES[AM.RARITIES.length - 1];
  }

  function rollAffix(rng, slot, rarity, ilvl, exclude) {
    const pool = Object.keys(AM.AFFIXES).filter((id) => AM.AFFIXES[id].slots.includes(slot) && !exclude.has(id));
    if (!pool.length) return null;
    const id = rng.pick(pool);
    const A = AM.AFFIXES[id];
    const q = 0.75 + rarity.tier * 0.12 + rng.next() * 0.25;
    let v = AM.lerp(A.lo, A.hi, rng.next()) * q;
    if (A.flat) v *= AM.LV(ilvl);
    v = A.dec ? Math.round(v * 10) / 10 : Math.max(1, Math.round(v));
    const a = { id, v };
    if (id === 'elementDmg') a.el = rng.pick(AM.AFFIX_ELEMENTS);
    return a;
  }

  // Roll a gear item. opts: { slot, base, ilvl, rarity, minTier, findPct, bonusTier, unique }
  function rollItem(rng, opts) {
    const slot = opts.slot || rng.pick(['weapon', 'weapon', 'helmet', 'armor', 'charm', 'ring']);
    const rarity = opts.rarity ? AM.RARITY[opts.rarity] : rollRarity(rng, opts.findPct, opts.minTier, opts.bonusTier);
    const item = { uid: AM.uid('i'), slot, rarity: rarity.id, ilvl: Math.max(1, opts.ilvl | 0), plus: 0, affixes: [] };
    if (slot === 'weapon') item.base = opts.base || rng.pick(Object.keys(AM.WEAPONS));
    if (rarity.id === 'legendary') {
      const cands = Object.keys(AM.LEGENDARIES).filter((k) => AM.LEGENDARIES[k].slot === slot && (!AM.LEGENDARIES[k].base || !opts.base || AM.LEGENDARIES[k].base === item.base));
      if (cands.length) {
        const u = opts.unique || rng.pick(cands);
        item.unique = u;
        if (AM.LEGENDARIES[u].base) item.base = AM.LEGENDARIES[u].base;
      }
    }
    const used = new Set();
    for (let i = 0; i < rarity.affixes; i++) {
      const a = rollAffix(rng, slot, rarity, item.ilvl, used);
      if (!a) break;
      used.add(a.id);
      item.affixes.push(a);
    }
    item.name = itemName(item, rng);
    return item;
  }

  function typeName(item) {
    return item.slot === 'weapon' ? AM.WEAPONS[item.base].name : AM.ARMOR[item.slot].name;
  }
  function itemName(item, rng) {
    if (item.unique) return AM.LEGENDARIES[item.unique].name;
    const tn = typeName(item);
    if (!item.affixes.length) return (item.rarity === 'common' ? 'Plain ' : '') + tn;
    const adj = AM.AFFIXES[item.affixes[0].id].adj;
    const adj2 = item.affixes[0].id === 'elementDmg' ? AM.ELEMENTS[item.affixes[0].el].intense : adj;
    let n = `${adj2} ${tn}`;
    if (item.rarity === 'epic') n += ' ' + (rng ? rng.pick(NOUNS) : NOUNS[0]);
    return n;
  }
  function displayName(item) { return item.name + (item.plus ? ` +${item.plus}` : ''); }

  function affixText(a) {
    const A = AM.AFFIXES[a.id];
    return A.fmt.replace('{v}', a.v).replace('{el}', a.el ? AM.ELEMENTS[a.el].name.toLowerCase() : '');
  }
  // Lines describing an item (for tooltips).
  function itemLines(item) {
    const n = AM.itemNumbers(item);
    const lines = [];
    if (n.weaponDmg) lines.push(`${Math.round(n.weaponDmg)} weapon damage`);
    if (n.def) lines.push(`${Math.round(n.def)} defence`);
    if (n.hp) lines.push(`${Math.round(n.hp)} health`);
    if (n.atk) lines.push(`${Math.round(n.atk)} attack`);
    if (item.slot === 'weapon') {
      const W = AM.WEAPONS[item.base];
      lines.push(W.kind === 'ranged' ? 'Ranged' : W.kind === 'natural' ? 'Boosts natural attacks' : 'Melee');
      if (W.power) lines.push(`+${W.power * 100}% power damage`);
    }
    for (const a of item.affixes) lines.push(affixText(a));
    if (item.unique) lines.push('★ ' + AM.LEGENDARIES[item.unique].desc);
    return lines;
  }
  function itemScore(item) {
    const n = AM.itemNumbers(item);
    return (n.weaponDmg || 0) * 2 + (n.def || 0) * 1.5 + (n.hp || 0) * 0.3 + (n.atk || 0) * 2 + item.affixes.length * 4 * AM.LV(item.ilvl) + (item.unique ? 20 * AM.LV(item.ilvl) : 0);
  }

  const sellValue = (item) => Math.round(6 * AM.LV(item.ilvl) * AM.RARITY[item.rarity].sell * (1 + 0.2 * (item.plus || 0)));
  const buyValue = (item) => sellValue(item) * 4;

  function salvageYield(item) {
    const t = AM.RARITY[item.rarity].tier;
    const out = { essence: 1 + t * 2 + (item.plus || 0) };
    if (item.slot === 'weapon') { out.iron = 1 + t; if (item.base === 'bow' || item.base === 'staff') out.wood = 2; }
    else if (item.slot === 'charm' || item.slot === 'ring') { out.goldore = 1 + Math.floor(t / 2); if (t >= 2) out.crystal = 1; }
    else { out.iron = 1 + Math.floor(t / 2); out.hide = 1 + Math.floor(t / 2); }
    return out;
  }
  const MAX_PLUS = 10;
  function upgradeCost(item) {
    const n = (item.plus || 0) + 1;
    return { mats: { iron: n + 1, essence: n * 2 + AM.RARITY[item.rarity].tier }, gold: Math.round(18 * n * AM.LV(item.ilvl)) };
  }

  // ---------- inventory helpers ----------
  function newInventory() { return { items: [], mats: {}, cons: { potion: 3 }, dna: {} }; }
  function hasMats(inv, cost) { for (const k in cost) if ((inv.mats[k] || 0) < cost[k]) return false; return true; }
  function takeMats(inv, cost) { for (const k in cost) inv.mats[k] = (inv.mats[k] || 0) - cost[k]; }
  function addMats(inv, mats) { for (const k in mats) inv.mats[k] = (inv.mats[k] || 0) + mats[k]; }
  function addItem(inv, item) { if (inv.items.length >= INV_SIZE) return false; inv.items.push(item); return true; }

  // Apply a recipe. Returns { ok, made, reason }.
  function craft(inv, recipe, ctx, rng) {
    if (!hasMats(inv, recipe.cost)) return { ok: false, reason: 'Not enough materials' };
    if ((ctx.gold || 0) < (recipe.gold || 0)) return { ok: false, reason: 'Not enough gold' };
    let made;
    if (recipe.out.con) {
      made = { con: recipe.out.con, n: recipe.out.n };
    } else {
      if (inv.items.length >= INV_SIZE) return { ok: false, reason: 'Inventory full' };
      made = rollItem(rng, { slot: recipe.out.gear, base: recipe.out.base, ilvl: ctx.level, minTier: 1, findPct: ctx.findPct });
    }
    takeMats(inv, recipe.cost);
    if (made.con) inv.cons[made.con] = (inv.cons[made.con] || 0) + made.n;
    else inv.items.push(made);
    return { ok: true, made, gold: recipe.gold || 0 };
  }

  // ---------- drops ----------
  const MAT_BY_MATERIAL = { fur: 'hide', scales: 'hide', goo: 'gel', metal: 'iron', plant: 'herb', stone: 'stone', crystal: 'crystal', wood: 'wood', ceramic: 'stone', ethereal: 'essence' };
  // What a fallen creature drops. c = { genome, level, rank, biome }. p = player stats (findPct, goldPct).
  function rollDrops(rng, c, p) {
    const rank = c.rank || 'normal';
    const out = { gold: 0, mats: {}, items: [], dna: {}, cons: {} };
    const rk = rank === 'boss' ? 10 : rank === 'elite' ? 3 : 1;
    out.gold = Math.round((3 + rng.next() * 4) * AM.LV(c.level) * rk * (1 + (p.goldPct || 0)));
    if (rng.chance(rank === 'normal' ? 0.55 : 1)) out.mats.essence = rank === 'boss' ? 8 : rank === 'elite' ? 3 : 1;
    const m = MAT_BY_MATERIAL[c.genome.material] || 'hide';
    if (rng.chance(0.5)) out.mats[m] = (out.mats[m] || 0) + 1 + (rank !== 'normal' ? 2 : 0);
    if (c.biome === 'tundra' && rng.chance(0.35)) out.mats.frostshard = 1;
    if (c.biome === 'volcanic' && rng.chance(0.35)) out.mats.embercore = 1;
    if (c.biome === 'crystal' && rng.chance(0.3)) out.mats.crystal = (out.mats.crystal || 0) + 1;
    // DNA of a parent unlocks new fusion bases
    const dnaChance = rank === 'boss' ? 1 : rank === 'elite' ? 0.65 : 0.2;
    if (rng.chance(dnaChance)) { const b = rng.pick(c.genome.parents); out.dna[b] = (out.dna[b] || 0) + (rank === 'boss' ? 3 : 1); }
    if (rank === 'boss') { const b = c.genome.parents[0] === c.genome.parents[1] ? null : c.genome.parents[1]; if (b) out.dna[b] = (out.dna[b] || 0) + 2; }
    const itemChance = rank === 'boss' ? 1 : rank === 'elite' ? 0.7 : 0.11 * (1 + (p.findPct || 0));
    const n = rank === 'boss' ? 2 + (rng.chance(0.5) ? 1 : 0) : 1;
    for (let i = 0; i < n; i++) {
      if (!rng.chance(itemChance)) continue;
      out.items.push(rollItem(rng, { ilvl: c.level, findPct: p.findPct, minTier: rank === 'boss' ? 2 : rank === 'elite' ? 1 : 0, bonusTier: rank === 'boss' ? 1 : 0 }));
    }
    if (rng.chance(rank === 'normal' ? 0.05 : 0.4)) out.cons.potion = 1;
    if (rank === 'boss' && rng.chance(0.5)) out.cons.tome = 1;
    return out;
  }
  function rollChest(rng, level, p, big) {
    const out = { gold: Math.round((15 + rng.next() * 20) * AM.LV(level) * (big ? 3 : 1) * (1 + (p.goldPct || 0))), mats: {}, items: [], cons: {}, dna: {} };
    const n = big ? 2 + rng.int(0, 1) : 1;
    for (let i = 0; i < n; i++) out.items.push(rollItem(rng, { ilvl: level, findPct: p.findPct, minTier: big ? 2 : 1 }));
    out.mats.essence = big ? 6 : 2;
    const extra = rng.pick(['iron', 'goldore', 'crystal', 'herb', 'wood']);
    out.mats[extra] = (out.mats[extra] || 0) + rng.int(2, 4);
    if (rng.chance(0.5)) out.cons.potion = rng.int(1, 2);
    if (big && rng.chance(0.4)) out.cons.tome = 1;
    return out;
  }

  Object.assign(AM, {
    INV_SIZE, MAX_PLUS, rollRarity, rollItem, itemName, displayName, typeName, affixText, itemLines, itemScore, sellValue, buyValue,
    salvageYield, upgradeCost, newInventory, hasMats, takeMats, addMats, addItem, craft, rollDrops, rollChest,
  });
  if (typeof module !== 'undefined' && module.exports) module.exports = AM;
})(typeof window !== 'undefined' ? window : globalThis);
