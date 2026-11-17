/* Mutatrix: estado inicial, preços, loja, consertos, Mutapédia e marcos. Lógica pura. */
(function (root) {
  'use strict';
  const MX = root.MX || (root.MX = {});
  const { Data, Genetics } = MX;

  const VERSION = 1;

  function newState() {
    return {
      v: VERSION,
      credits: 150,
      rep: 0,
      unlocked: {
        capsids: Data.CAPSIDS.filter((c) => c.start).map((c) => c.id),
        themes: Data.THEMES.filter((t) => t.start).map((t) => t.id),
        slots: 3, analyzer: 1, armored: false, shelf: 4, decor: [],
      },
      stabilizers: 1,
      bought: [],
      subject: null,
      design: Genetics.emptyDesign('GENE5'),
      contracts: [],
      seq: { subject: 0, contract: 0 },
      catalog: { arch: {}, syn: {}, col: {}, ev: {} },
      milestones: [],
      shelf: [],
      strains: [],
      damage: { total: 0, decals: [] },
      tentacleUntil: 0,
      stats: { synth: 0, inject: 0, reject: 0, mutations: 0, collapses: 0, delivered: 0, shelved: 0, retired: 0, events: 0, earned: 0 },
      hints: {},
      started: false,
    };
  }

  function hostCost(hostId) { return Data.HOST[hostId].cost; }

  function synthCost(design) {
    let c = 2;
    for (const s of design.slots) if (s) c += 2 + (s.pot - 1);
    return c;
  }

  function repairCost(state) {
    return Math.round(state.damage.total * (state.unlocked.armored ? 0.5 : 1));
  }

  function isOwned(state, item) {
    const e = item.effect, u = state.unlocked;
    switch (e.type) {
      case 'slots': return u.slots >= e.value;
      case 'analyzer': return u.analyzer >= e.value;
      case 'armored': return !!u.armored;
      case 'capsid': return u.capsids.includes(e.value);
      case 'theme': return u.themes.includes(e.value);
      case 'shelf': return u.shelf >= e.value;
      case 'decor': return u.decor.includes(e.value);
      case 'stabilizer': return false;
      default: return false;
    }
  }

  function canBuy(state, item) {
    if (isOwned(state, item)) return { ok: false, reason: 'Adquirido' };
    if (item.need && !isOwned(state, Data.SHOP_ITEM[item.need])) return { ok: false, reason: 'Requer ' + Data.SHOP_ITEM[item.need].name };
    if (state.rep < item.rep) return { ok: false, reason: 'Reputação ' + item.rep };
    if (state.credits < item.price) return { ok: false, reason: 'Créditos insuficientes' };
    return { ok: true, reason: '' };
  }

  function applyEffect(state, e) {
    const u = state.unlocked;
    switch (e.type) {
      case 'slots': u.slots = Math.max(u.slots, e.value); break;
      case 'analyzer': u.analyzer = Math.max(u.analyzer, e.value); break;
      case 'armored': u.armored = true; break;
      case 'capsid': if (!u.capsids.includes(e.value)) u.capsids.push(e.value); break;
      case 'theme': if (!u.themes.includes(e.value)) u.themes.push(e.value); break;
      case 'shelf': u.shelf = Math.max(u.shelf, e.value); break;
      case 'decor': if (!u.decor.includes(e.value)) u.decor.push(e.value); break;
      case 'stabilizer': state.stabilizers += e.value; break;
      default: break;
    }
  }

  function buy(state, itemId) {
    const item = Data.SHOP_ITEM[itemId];
    if (!item) return { ok: false, reason: 'Item desconhecido' };
    const chk = canBuy(state, item);
    if (!chk.ok) return chk;
    state.credits -= item.price;
    applyEffect(state, item.effect);
    if (!item.repeat && !state.bought.includes(item.id)) state.bought.push(item.id);
    return { ok: true, item };
  }

  function spend(state, amount) {
    if (state.credits < amount) return false;
    state.credits -= amount;
    return true;
  }

  function earn(state, amount) {
    state.credits += amount;
    state.stats.earned += amount;
  }

  // ---------------------------------------------------------------- Mutapédia
  function discover(state, kind, key, info) {
    const book = state.catalog[kind];
    if (book[key]) { book[key].count++; return false; }
    book[key] = Object.assign({ count: 1 }, info || {});
    return true;
  }

  function catalogCount(state) {
    const c = state.catalog;
    return Object.keys(c.arch).length + Object.keys(c.syn).length + Object.keys(c.col).length + Object.keys(c.ev).length;
  }

  function catalogTotal() {
    return Data.ARCH.length * Data.HOSTS.length + Data.SYNERGIES.length + Data.COLLAPSES.length + Object.keys(Data.EVENTS).length;
  }

  // Aplica marcos ainda não recebidos e devolve a lista dos novos.
  function checkMilestones(state) {
    const n = catalogCount(state);
    const got = [];
    for (const m of Data.MILESTONES) {
      if (n >= m.n && !state.milestones.includes(m.n)) {
        state.milestones.push(m.n);
        if (m.credits) earn(state, m.credits);
        if (m.stabilizers) state.stabilizers += m.stabilizers;
        if (m.decor && !state.unlocked.decor.includes(m.decor)) state.unlocked.decor.push(m.decor);
        got.push(m);
      }
    }
    return got;
  }

  function addDamage(state, amount, decal) {
    state.damage.total += amount;
    if (decal) {
      state.damage.decals.push(decal);
      if (state.damage.decals.length > 28) state.damage.decals.shift();
    }
  }

  function repair(state) {
    const cost = repairCost(state);
    if (cost <= 0) return { ok: false, reason: 'Nada para consertar' };
    if (state.credits < cost) return { ok: false, reason: 'Créditos insuficientes' };
    state.credits -= cost;
    state.damage.total = 0;
    state.damage.decals = [];
    return { ok: true, cost };
  }

  MX.Economy = {
    VERSION, newState, hostCost, synthCost, repairCost, isOwned, canBuy, buy, applyEffect, spend, earn,
    discover, catalogCount, catalogTotal, checkMilestones, addDamage, repair,
  };
  if (typeof module === 'object' && module.exports) module.exports = MX.Economy;
})(typeof window !== 'undefined' ? window : globalThis);
