/* Mend the Notebook (torn pages with bundles), the daily request board and mail. */
(function (root) {
  'use strict';
  const PA = root.PA = root.PA || {};
  const PAGES = [
    { name: 'The Spring Page', unlock: 'creekBridge', reward: 'A bridge across the creek to grandpa\'s orchard',
      bundles: [{ name: 'Spring crops', items: [['parsnip', 5], ['potato', 3], ['cauliflower', 1]] }, { name: 'Spring forage', items: [['leek', 1], ['dandelion', 1], ['horseradish', 1]] }] },
    { name: 'The Summer Page', unlock: 'elevator', reward: 'The mine elevator works again',
      bundles: [{ name: 'Summer crops', items: [['tomato', 3], ['melon', 1], ['corn', 3]] }, { name: 'River fish', items: [['trout', 1], ['perch', 1], ['minnow', 2]] }] },
    { name: 'The Autumn Page', unlock: 'greenhouse', reward: 'The front field row never withers',
      bundles: [{ name: 'Fall crops', items: [['pumpkin', 1], ['yam', 2], ['eggplant', 3]] }, { name: 'Preserves', items: [['jam', 2], ['pickles', 2]] }] },
    { name: 'The Winter Page', unlock: 'minecart', reward: 'A minecart from the farm to the mine',
      bundles: [{ name: 'Winter forage', items: [['frostberry', 2], ['snowyam', 1], ['holly', 1]] }, { name: 'Minerals', items: [['quartz', 3], ['copper_bar', 3], ['iron_bar', 2]] }] },
    { name: 'The Ink Page', unlock: 'allWords', reward: 'Every remaining word, written in',
      bundles: [{ name: 'Ink makers', items: [['inkcap', 5], ['ink', 5], ['graphite', 10]] }, { name: 'From the deep', items: [['inkstone', 3], ['inkfish', 1]] }] },
    { name: 'The Last Page', unlock: 'mended', reward: 'The notebook is whole again',
      bundles: [{ name: 'Riches', items: [['gold_bar', 3], ['cheese', 2], ['cloth', 1]] }, { name: 'Treasures', items: [['koi', 1], ['wool', 2], ['pie', 2]] }] },
  ];
  const Q = PA.Quests = {
    PAGES,
    progress(s, p, b) { s.pages[p] = s.pages[p] || []; return s.pages[p][b]; },
    donate(s, inv, p, b) {
      const page = PAGES[p], bundle = page && page.bundles[b];
      if (!bundle || Q.progress(s, p, b)) return false;
      if (!bundle.items.every(([id, n]) => inv.count(id) >= n)) return false;
      for (const [id, n] of bundle.items) inv.remove(id, n);
      s.pages[p][b] = true;
      if (Q.pageDone(s, p)) s.flags[page.unlock] = true;
      return true;
    },
    pageDone(s, p) { const arr = s.pages[p] || []; return PAGES[p].bundles.every((_, i) => arr[i]); },
    /** Today's board request (deterministic). */
    request(s) {
      const r = PA.RNG.mulberry32(s.seed ^ ((s.stats.days || 0) * 104729));
      const who = PA.NPC_DATA[Math.floor(r() * PA.NPC_DATA.length)];
      const pool = [...PA.Items.byCat('crop').filter((it) => PA.Crops && PA.Crops.DEFS[it.id] && PA.Crops.DEFS[it.id].seasons.includes(s.season)), ...PA.Items.byCat('forage').filter((it) => it.seasons.includes(s.season)), PA.Items.get('wood'), PA.Items.get('stone'), PA.Items.get('egg')];
      const it = pool[Math.floor(r() * pool.length)];
      const n = it.price < 20 ? 10 + Math.floor(r() * 20) : 1 + Math.floor(r() * 3);
      return { id: 'req' + s.stats.days, npc: who.id, item: it.id, n, reward: Math.round(it.price * n * 3 + 60), day: s.stats.days };
    },
    mailFor(s) {
      const out = [];
      const d = s.stats.days || 0;
      if (d === 0) out.push({ id: 'welcome', from: 'Mayor Quill', text: 'Welcome to Paper Acres! Your grandpa left you the farm, a few tools and a pencil. Visit Marginton to the east; the town hall has a torn notebook you might help with.' });
      if (d === 1) out.push({ id: 'ada1', from: 'Ada Inkwell', text: 'Press Q (or the draw button) to open your sketchpad. Draw a thing, name it, and it becomes real. Lead is cheap; ink is forever. - Ada' });
      if (d === 3) out.push({ id: 'rosa1', from: 'Rosa', text: 'Once you have a coop, come buy a chicken! I can\'t sell you a drawn one, ha. - Rosa' });
      if (d === 5) out.push({ id: 'gus1', from: 'Gus', text: 'Mine is open. Bring a sword. - Gus' });
      for (const k of ['coop', 'barn', 'kitchen']) if (typeof s.flags[k] === 'number' && s.flags[k] <= d) { s.flags[k] = true; out.push({ id: k + 'done', from: 'Dot & Dash', text: 'Your ' + k + ' is finished! - Dot (and Dash)' }); }
      if (s.flags.upgradeReady != null && s.flags.upgradeReady <= d) out.push({ id: 'upg' + d, from: 'Gus', text: 'Your tool is ready. Come get it.' });
      return out;
    },
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = Q;
})(typeof window !== 'undefined' ? window : globalThis);
