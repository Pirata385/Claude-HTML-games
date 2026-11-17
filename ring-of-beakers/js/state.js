// state.js — the save: money, day, creatures, eggs, inventory, upgrades, and the rules that move
// it forward (feeding, training, nesting, sleeping). No DOM; scenes only call into this.
(function () {
  'use strict';
  const RB = globalThis.RB;
  const { Rng, clamp, hashStr } = RB.core;
  const GN = RB.genome;

  const BIRD_NAMES = ['Pepper', 'Biscuit', 'Farofa', 'Pimenta', 'Trovao', 'Pipoca', 'Fuba', 'Quindim', 'Pacoca', 'Cuscuz', 'Jilo', 'Faisca', 'Brasa', 'Ticao',
    'Banze', 'Fuzue', 'Muvuca', 'Xodo', 'Caju', 'Dende', 'Mandioca', 'Rapadura', 'Canjica', 'Tapioca', 'Moqueca', 'Sabia', 'Zangado', 'Relampago', 'Ventania',
    'Capitao', 'Baronesa', 'Duque', 'Marques', 'Comadre', 'Valente', 'Mimoso', 'Furacao', 'Chuvisco', 'Garoa', 'Poeira', 'Carvao', 'Ferrugem', 'Canela', 'Cravo',
    'Mostarda', 'Pequi', 'Jabuti', 'Tucupi', 'Feijao', 'Torresmo', 'Bolacha', 'Cocada', 'Brigadeiro', 'Goiabada', 'Catuaba', 'Bambu', 'Graveto', 'Pedrita'];

  // opts: { sandbox: everything unlocked from the start (every upgrade and tool, the lab powered,
  //   no debt, the open sea) }
  function create(seed, opts) {
    const S = {
      v: 1, seed: seed >>> 0, rs: (seed ^ 0x51ab) >>> 0, day: 1, time: 6, money: 150, debt: 15000, heat: 0, heatPeople: 0, heatDays: 0, nextId: 1,
      birds: [], eggs: [], roost: [], released: [], markers: {}, visited: {}, isles: [], netted: {},
      inv: { net: 3, shovel: 10, grain: 8 }, equip: {}, up: { cage: 0, engine: 0, tires: 0, coop: 0, nest: 0, incubator: 0, dummy: 0, boat: 0 },
      feeder: 0, pos: null, dug: {}, marksDug: {}, wildGone: null, npc: {}, league: {}, bets: {},
      lab: { power: false, fuses: 0, atlas: {}, vials: [], fossils: {}, seq: {} },
      codex: { species: {}, ach: {} }, bfc: { stamps: 0, sold: 0 },
      stats: { fights: 0, wins: 0, caught: 0, dug: 0, bred: 0, sold: 0, earned: 0, kidnapped: 0 },
      goal: 0, won: false,
    };
    S._rng = new Rng(S.rs);
    const r = S._rng;
    addBird(S, RB.species.make('chicken', r, { sex: 'M', sport: 0 }), { name: 'Capitao', bond: 0.5, origin: 'start' });
    addBird(S, RB.species.make('chicken', r, { sex: 'F', sport: 0 }), { name: 'Farofa', bond: 0.5, origin: 'start' });
    S.codex.species.chicken = true;
    if (opts && opts.sandbox) {
      S.sandbox = true; S.debt = 0; S.money = 5000;
      for (const id of Object.keys(RB.items.UPGRADES)) S.up[id] = RB.items.UPGRADES[id].prices.length;
      for (const id of ['detector', 'launcher', 'lantern', 'silvernet', 'goldshovel']) S.equip[id] = true;
      S.lab.power = true; S.inv.net = 10; S.inv.bignet = 5; S.inv.seed = 5;
    }
    return S;
  }
  // The open sea: unlocked by beating the Grand Ring and paying off the debt (or from the start in
  // a sandbox game). Reaching it takes the speedboat kit.
  const openSea = (S) => !!S.sandbox || (!!S.won && S.debt <= 0);
  const hasBoat = (S) => !!(S.up && S.up.boat);

  function freeName(S, r) {
    const used = new Set(S.birds.concat(S.roost || []).map((b) => b.name));
    for (let i = 0; i < 30; i++) { const n = r.pick(BIRD_NAMES); if (!used.has(n)) return n; }
    return r.pick(BIRD_NAMES) + ' ' + (2 + r.int(0, 97));
  }

  // o: { name, age, bond, origin, at, person (npc id), clothes, mom, dad (species labels of the parents) }
  // A new creature, not yet anywhere (addBird puts it in your flock).
  function makeBird(S, genome, o) {
    o = o || {};
    const c = { id: S.nextId++, name: o.name || freeName(S, S._rng), g: genome, age: 0, bond: o.bond === undefined ? 0.1 : o.bond, at: o.at || 'home', origin: o.origin || 'wild',
      train: { muscle: 0, lungs: 0, reflex: 0, courage: 0 }, cond: 1, hp: 1, rest: 0, tired: false, fed: false, hungry: 0, bouts: 0, trained: false, wins: 0, losses: 0,
      hat: null, gear: null, buff: null, love: false, person: o.person || null, clothes: o.clothes || null, mom: o.mom || null, dad: o.dad || null, momKey: o.momKey || null, dadKey: o.dadKey || null, inj: 0 };
    c.age = o.age === undefined ? pheno(c).growDays + 1 : o.age;
    c._P = null;
    return c;
  }
  function addBird(S, genome, o) { const c = makeBird(S, genome, o); S.birds.push(c); return c; }

  // Phenotype of a creature, cached until something that shapes it changes.
  function pheno(c) {
    const key = c.age + '|' + c.train.muscle + c.train.lungs + c.train.reflex + c.train.courage + '|' + c.cond;
    if (!c._P || c._Pk !== key) { c._P = RB.pheno.express(c.g, { age: c.age, train: c.train, cond: c.cond }); c._Pk = key; }
    return c._P;
  }
  const dirty = (c) => { c._P = null; };

  // What kind it is, as a key: a species id, 'human', or for a cross 'dadKey*momKey'. Young of two
  // parents of the same kind are of that kind; young of two different kinds are a new, mixed kind
  // that its own young carry on.
  function kindKey(c) {
    if (c.person) return 'human';
    if (c.momKey && c.dadKey) return c.momKey === c.dadKey ? c.momKey : c.dadKey + '*' + c.momKey;
    return pheno(c).species.id;
  }
  const isCross = (c) => !!(c.momKey && c.dadKey && c.momKey !== c.dadKey);
  // A sex-neutral name for a kind, used to name crosses after both parents.
  function label(c) {
    if (c.person) return 'Person';
    if (isCross(c)) return RB.species.blendNames(c.dad, c.mom);
    const id = c.momKey && RB.species.SPECIES[c.momKey] ? c.momKey : c.momKey ? null : pheno(c).species.id;
    return id ? RB.species.generic(id) : c.mom;
  }
  // What to call its kind on its card: crosses are named after their parents' kinds.
  function kind(c) {
    if (c.person) return 'Person';
    if (isCross(c)) return RB.species.blendNames(c.dad, c.mom);
    if (c.momKey && RB.species.SPECIES[c.momKey]) return RB.species.nameOf(RB.species.SPECIES[c.momKey], c.g.sex);
    if (c.momKey) return c.mom;
    return pheno(c).species.name;
  }
  const isAdult = (c) => pheno(c).grow >= 1;
  // Past its lifespan a bird does not die: it retires. A retired bird no longer fights, nests,
  // trains or goes to the sideshow; Sunset Roost will look after it, or BFC will take it.
  const isRetired = (c) => !c.person && c.age >= pheno(c).lifespan;

  const byId = (S, id) => S.birds.find((b) => b.id === id) || null;
  const at = (S, where) => S.birds.filter((b) => b.at === where);
  const atHome = (S) => S.birds.filter((b) => b.at !== 'cage');
  const cageCap = () => Infinity; // the truck has no limit
  const coopCap = (S) => RB.items.COOP[S.up.coop];
  const nestCount = (S) => 1 + S.up.nest;
  // In a sandbox game every useful item and every cosmetic is endless: tools, feed, gear, hats and
  // lab supplies (not relics, which are only worth selling, and not bundles like the grain sack).
  const ENDLESS_KINDS = ['tool', 'feed', 'gear', 'hat', 'lab'];
  const endless = (S, item) => { const it = RB.items.ITEMS[item]; return !!S.sandbox && !!it && ENDLESS_KINDS.includes(it.kind) && !it.gives; };
  const count = (S, item) => (endless(S, item) ? Infinity : S.inv[item] || 0);
  // the items you have, as ids: what is in the bag, and in a sandbox every endless one
  function owned(S) {
    const ids = Object.keys(S.inv).filter((id) => RB.items.ITEMS[id] && count(S, id) > 0);
    if (S.sandbox) for (const id of Object.keys(RB.items.ITEMS)) if (endless(S, id) && !ids.includes(id)) ids.push(id);
    return ids;
  }
  const fmtCount = (n) => (n === Infinity ? '∞' : String(n));
  function give(S, item, n) { if (endless(S, item)) return; S.inv[item] = (S.inv[item] || 0) + (n === undefined ? 1 : n); }
  function take(S, item, n) { n = n === undefined ? 1 : n; if (endless(S, item)) return true; if (count(S, item) < n) return false; S.inv[item] -= n; if (S.inv[item] <= 0) delete S.inv[item]; return true; }
  // Fast travel to an island: once you have landed on it, or any island at all in a sandbox game.
  const canSail = (S, is) => !!S.sandbox || !!(S.visited && S.visited[is.id]);
  function removeBird(S, c) { const i = S.birds.indexOf(c); if (i >= 0) S.birds.splice(i, 1); }
  // a creature as plain data for the save, and back
  function serBird(c) { const b = {}; for (const k of Object.keys(c)) if (k[0] !== '_') b[k] = c[k]; b.g = GN.serialize(c.g); return b; }
  function deBird(b) { const c = JSON.parse(JSON.stringify(b)); c.g = GN.deserialize(b.g); c._P = null; return c; }

  // Move a creature: 'home', 'cage', 'crate' (BFC pick-up box) or 'nestN'. Returns '' or why not.
  function move(S, c, to) {
    if (c.at === to) return '';
    if (to === 'cage') { /* the truck takes everyone */ }
    else if (to === 'home') { if (c.at === 'cage' && atHome(S).length >= coopCap(S)) return 'The coop is full.'; }
    else if (to.startsWith('nest')) {
      if (isRetired(c)) return c.name + ' is retired: no more nesting.';
      if (!isAdult(c)) return c.name + ' is too young to nest.';
      const there = at(S, to);
      if (there.length >= 2) return 'That nest is full.';
      if (there.length === 1 && there[0].g.sex === c.g.sex) return 'A nest needs a male and a female.';
    }
    c.at = to;
    return '';
  }

  // Hand-feed an item. Returns a short message, or null if nothing happened.
  // Eating anything is a full day's meal: one grain is enough for any creature.
  function eat(c) { c.fed = true; c.hungry = 0; }
  function feed(S, c, item) {
    if (item === 'grain' && c.fed) return c.name + ' is full already.';
    if (!take(S, item)) return null;
    const P = pheno(c), r = S._rng;
    eat(c);
    if (item === 'grain') { c.bond = Math.min(1, c.bond + 0.02); return c.name + ' pecks it up and is full.'; }
    if (item === 'worm') { c.bond = Math.min(1, c.bond + 0.08); return c.name + ' loves worms.'; }
    if (item === 'chili') { c.buff = 'chili'; return c.name + ' is fired up for the next bout.'; }
    if (item === 'tonic') { const was = c.tired || c.rest > 0; c.tired = false; c.rest = 0; return was ? c.name + ' is full of beans again and can fight today.' : c.name + ' was not tired, but enjoys it.'; }
    if (item === 'gromash') { if (P.grow < 1) { c.age++; dirty(c); return c.name + ' shoots up overnight. Well, right now.'; } return c.name + ' enjoys it, but is done growing.'; }
    if (item === 'loveseed') { c.love = true; return c.name + ' is feeling romantic.'; }
    if (item === 'mushroom') { GN.mutate(c.g, r, 4); dirty(c); return c.name + ' feels... different.'; }
    if (item === 'isotope') { GN.mutate(c.g, r, 14); if (r.chance(0.3)) GN.sport(c.g, r, 1); dirty(c); return c.name + ' hums faintly.'; }
    if (item === 'elixir') { c.age = Math.max(P.growDays, c.age - 3); dirty(c); return c.name + ' looks younger.'; }
    return null;
  }

  const TRAIN = ['muscle', 'reflex', 'lungs', 'courage'];
  function train(S, c, stat) {
    if (isRetired(c)) return c.name + ' is retired: no more training.';
    if (c.trained) return c.name + ' has trained enough for today.';
    if (!isAdult(c)) return c.name + ' is too young to train.';
    if (c.train[stat] >= 0.15) return c.name + ' cannot improve that any further.';
    c.trained = true;
    c.train[stat] = Math.min(0.15, +(c.train[stat] + trainStep(c)).toFixed(3));
    c.bond = Math.min(1, c.bond + 0.03);
    return '';
  }

  // Chance that a pair in a nest lays tonight. Any two creatures can have young together; very
  // different ones (a hummingbird and an ostrich, a hen and a person) just manage a little less often.
  function layChance(mom, dad) {
    const dist = GN.distance(mom.g, dad.g), fert = (pheno(mom).t.fertility + pheno(dad).t.fertility) / 2;
    return clamp(fert * (1.15 - 0.8 * dist) * (mom.love || dad.love ? 1.5 : 1), 0.45, 0.97);
  }

  // Night falls. Returns { lines: [...] } describing what happened.
  function sleep(S) {
    const r = S._rng, lines = [];
    // the BFC van empties the pick-up box
    for (const c of at(S, 'crate')) {
      const price = RB.economy.bfcPrice(S, c, true);
      S.money += price; S.stats.earned += price; S.bfc.sold++; S.bfc.stamps++; S.stats.sold++;
      if (c.person) soldPerson(S, c);
      removeBird(S, c);
      lines.push('The BFC van collected ' + c.name + '. $' + price + '.');
    }
    if (S.bfc.stamps >= 10) { S.bfc.stamps -= 10; give(S, 'bucket'); lines.push('Your BFC card is full: a free bucket hat!'); }
    // feeding
    for (const c of S.birds.slice()) {
      if (!c.fed && S.feeder >= 1) { S.feeder--; eat(c); }
      if (c.fed) { c.hungry = 0; if (c.cond < 1) { c.cond = Math.min(1, c.cond + 0.25); dirty(c); } }
      else {
        c.hungry++; c.cond = Math.max(0.4, c.cond - 0.2); dirty(c);
        if (c.hungry >= 3 && !c.person) { removeBird(S, c); lines.push(c.name + ' went hungry three nights and ran off.'); }
        else lines.push(c.name + ' went to sleep hungry.');
      }
    }
    // nests
    for (let n = 0; n < nestCount(S); n++) {
      const pair = at(S, 'nest' + n);
      if (pair.length !== 2 || pair[0].g.sex === pair[1].g.sex || pair.some(isRetired)) continue;
      const mom = pair[0].g.sex === 'F' ? pair[0] : pair[1], dad = mom === pair[0] ? pair[1] : pair[0];
      if (S.eggs.filter((e) => e.nest === n).length >= 2) { lines.push('Nest ' + (n + 1) + ' has no room for another egg.'); continue; }
      const p = layChance(mom, dad);
      mom.love = false; dad.love = false;
      if (r.chance(p)) {
        const g = GN.breed(mom.g, dad.g, r);
        const Pm = pheno(mom), Pd = pheno(dad);
        S.eggs.push({ id: S.nextId++, g, nest: n, hatch: S.day + 1 + (S.up.incubator ? 1 : 2), mom: label(mom), dad: label(dad), momKey: kindKey(mom), dadKey: kindKey(dad), col: Pm.css.belly, spot: Pd.css.body });
        lines.push(mom.name + ' laid an egg.');
      } else lines.push(mom.name + ' and ' + dad.name + ' did not manage an egg' + (p < 0.4 ? ' (they are very different animals).' : '.'));
    }
    S.day++; S.time = 6;
    // eggs hatch
    for (const e of S.eggs.slice()) {
      if (S.day < e.hatch) continue;
      if (atHome(S).length >= coopCap(S)) { lines.push('An egg is ready to hatch, but the coop is full.'); continue; }
      S.eggs.splice(S.eggs.indexOf(e), 1);
      const chick = addBird(S, e.g, { age: 0, bond: 0.35, origin: 'born', mom: e.mom, dad: e.dad, momKey: e.momKey, dadKey: e.dadKey });
      chick.hatched = S.day;
      S.stats.bred++;
      lines.push('An egg hatched: ' + chick.name + ', a ' + kind(chick).toLowerCase() + ' chick.');
    }
    // a day older
    for (const c of S.birds.slice()) {
      c.fed = false; c.bouts = 0; c.trained = false; c.tired = false;
      if (c.rest > 0) c.rest--;
      // wounds do not heal on their own: that is the vet's job
      if (c.person) continue;
      if (c.hatched === S.day) continue; // hatched this morning: not a day old yet
      if (isRetired(c)) continue; // retired birds stop counting the days
      const was = pheno(c).stage;
      c.age++; dirty(c);
      const P = pheno(c);
      if (c.age >= P.lifespan) {
        if (c.at.startsWith('nest')) c.at = 'home';
        lines.push(c.name + ' is too old for the ring now and has retired. Sunset Roost will take them in, or BFC will.');
      }
      else if (was !== 'adult' && P.stage === 'adult') lines.push(c.name + ' is all grown up.');
      else if (was !== 'elder' && P.stage === 'elder') lines.push(c.name + ' is getting old.');
    }
    // Dona Nina feeds the residents of Sunset Roost and tends their wounds
    for (const c of S.roost || []) { c.fed = true; c.hungry = 0; c.tired = false; c.rest = 0; c.bouts = 0; c.love = false; if (c.hp < 1) c.hp = Math.min(1, c.hp + 0.25); if (c.cond < 1) { c.cond = Math.min(1, c.cond + 0.25); dirty(c); } }
    // your islands: the colonies there live their own lives
    for (const isle of S.isles || []) { const ln = colonyNight(S, isle, r); if (ln) lines.push(ln); }
    // the heat dies down: back to nothing after one night for each person netted (three at most)
    if (S.heat > 0) {
      const n = Math.max(1, S.heatDays || 1);
      S.heat = n <= 1 ? 0 : Math.round(S.heat * (n - 1) / n);
      S.heatDays = n - 1;
    }
    if (S.heat <= 0) { S.heat = 0; S.heatPeople = 0; S.heatDays = 0; }
    // ordinary holes fill back in overnight (treasure marks stay dug)
    for (const k of Object.keys(S.dug)) if (S.dug[k] < S.day) delete S.dug[k];
    // a house left empty gets a new owner after three nights
    for (const id of Object.keys(S.npc)) {
      const st = RB.npc.info(S, id);
      if (st.soldOff && !st.sub && S.day - st.soldDay >= 3) {
        st.soldOff = false; st.gone = false; st.gen = (st.gen || 0) + 1; st.rel = 0; st.n = 0; st.sold = {}; st.credit = 0;
        lines.push(id === 'sheriff' ? 'A new sheriff has come to town.' : 'Someone new has moved into an empty house.');
      }
    }
    S.rs = r.s;
    return { lines };
  }

  // A netted person who went to BFC: gone for good, and their house stands empty for a while.
  function soldPerson(S, c) {
    const st = RB.npc.info(S, c.person);
    st.gone = true; st.soldOff = true; st.soldDay = S.day;
  }

  // ---- the heat: netting a person makes you wanted. The heat clears in one night per person netted
  // since it was last at zero, and never takes more than HEAT_DAYS nights.
  const HEAT_DAYS = 3;
  function caughtPerson(S, add) {
    S.heat = clamp(S.heat + add, 0, 100);
    S.heatPeople = (S.heatPeople || 0) + 1;
    S.heatDays = Math.min(HEAT_DAYS, S.heatPeople);
  }

  // ---- training: what a session would add, so the dummy can say so before you choose
  const trainStep = (c) => 0.02 * (c.gear === 'anklets' ? 1.5 : 1);
  // { gain (to the training bonus, 0 when maxed), from, to, rates: [[rate, +n], ...] }
  function trainPreview(c, stat) {
    const from = c.train[stat], to = Math.min(0.15, +(from + trainStep(c)).toFixed(3));
    const opts = { age: c.age, cond: c.cond };
    const A = RB.pheno.express(c.g, Object.assign({ train: c.train }, opts));
    const B = RB.pheno.express(c.g, Object.assign({ train: Object.assign({}, c.train, { [stat]: to }) }, opts));
    // which numbers this kind of training moves at all (some steps are too small to show yet)
    const Z = RB.pheno.express(c.g, Object.assign({ train: Object.assign({}, c.train, { [stat]: 0.15 }) }, opts));
    const Y = RB.pheno.express(c.g, Object.assign({ train: Object.assign({}, c.train, { [stat]: 0 }) }, opts));
    const rates = [], affects = [];
    for (const k of Object.keys(A.rate)) {
      if (B.rate[k] !== A.rate[k]) rates.push([k, B.rate[k] - A.rate[k]]);
      if (Z.rate[k] !== Y.rate[k]) affects.push(k);
    }
    return { gain: +(to - from).toFixed(3), from, to, rates, affects };
  }

  // ---- boss prizes: beating the first boss earns the silver net, the second the golden shovel
  const BOSS_PRIZES = { backyard: 'silvernet', county: 'goldshovel' };
  // Hand over any prize earned and not yet given (also catches up saves from before the prizes).
  // Returns the item ids given.
  function bossPrizes(S) {
    const got = [];
    for (const arena of Object.keys(BOSS_PRIZES)) {
      const id = BOSS_PRIZES[arena];
      if (S.league[arena] && S.league[arena].boss && !S.equip[id]) { S.equip[id] = true; got.push(id); }
    }
    return got;
  }
  // Nets: the silver net is never used up. Shovels: the golden shovel digs GOLD_DIGS holes a day,
  // then ordinary shovels take over.
  const GOLD_DIGS = 10;
  const goldLeft = (S) => (S.equip.goldshovel ? GOLD_DIGS - (S.goldDug && S.goldDug.day === S.day ? S.goldDug.n : 0) : 0);
  const digsLeft = (S) => goldLeft(S) + count(S, 'shovel');
  // Use one dig. Returns 'gold', 'shovel', or '' when there is nothing to dig with.
  function useDig(S) {
    if (goldLeft(S) > 0) { if (!S.goldDug || S.goldDug.day !== S.day) S.goldDug = { day: S.day, n: 0 }; S.goldDug.n++; return 'gold'; }
    return take(S, 'shovel') ? 'shovel' : '';
  }
  // Throw a net: the silver net stands in for plain ones and is never used up. Returns '' if none.
  function useNet(S, id) {
    if (id === 'net' && S.equip.silvernet) return 'silvernet';
    return take(S, id) ? id : '';
  }

  // ---- birds set free: their genes go back into the wild
  // Each one is remembered where it was let go (the most recent RELEASED_MAX); from the next day
  // on, a few wild animals born near there carry some of its genes (see world.population).
  const RELEASED_MAX = 30;
  function setFree(S, c, x, y) {
    removeBird(S, c);
    if (c.person) return;
    S.released = S.released || [];
    S.released.push({ g: GN.serialize(c.g), x: Math.round(x), y: Math.round(y), day: S.day, name: c.name, key: kindKey(c), label: label(c) });
    if (S.released.length > RELEASED_MAX) S.released.splice(0, S.released.length - RELEASED_MAX);
  }
  // The released genes the wild draws on today: only those let go before today, decoded.
  const gened = new Map();
  function genePool(S) {
    return (S.released || []).filter((e) => e.day < S.day).map((e) => {
      let g = gened.get(e.g);
      if (!g) { g = GN.deserialize(e.g); gened.set(e.g, g); }
      return Object.assign({}, e, { g });
    });
  }

  // ---- breeding islands: an island of your own out at sea, claimed (an empty one) or raised from
  // the water, where the birds you leave live on their own. Every night the pairs there may raise
  // young, the old ones pass away in time, and generation follows generation. Odd mushrooms and
  // isotopes left there make the place radioactive: young born while it is hot come out mutated
  // and deformed. The radiation fades slowly.
  const CLAIM_COST = 500, RAISE_COST = 2500, RAISE_R = 1300, CLEAN_COST = 300, ISLE_EXTRA = 6;
  const ISLE_ODD = ['teeth', 'arms', 'twoHeads', 'glow', 'tailBone', 'gigas', 'nana', 'cyclops', 'legsExtra', 'earTuft', 'fluff', 'bare'];
  const DOSE = { mushroom: 0.08, isotope: 0.3 };
  const isleOf = (S, id) => (S.isles || []).find((i) => i.id === id) || null;
  // how many birds an island can feed: more on a bigger island
  const isleCap = (isle) => clamp(Math.round(isle.R * isle.R / 90000), 8, 40) + ISLE_EXTRA;
  function newIsle(S, o) { const isle = Object.assign({ birds: [], rad: 0, gen: 0, since: S.day, born: 0, died: 0, odd: 0 }, o); S.isles.push(isle); S.visited[isle.id] = 1; return isle; }
  // Claim an island nobody lives on. is: an island from RB.sea. Returns the isle, or why not.
  function claimIsle(S, is) {
    if (isleOf(S, is.id)) return 'It is yours already.';
    if (is.made || is.sites.length) return 'People live there: only an empty island can be claimed.';
    if (S.money < CLAIM_COST) return 'Claiming it costs $' + CLAIM_COST + '.';
    S.money -= CLAIM_COST;
    return newIsle(S, { id: is.id, name: is.name, made: false, x: is.x, y: is.y, R: is.R, land: is.main });
  }
  // Raise a new island centred on (x, y) in open water. land: what it is made of (a biome id).
  function raiseIsle(S, world, x, y, land) {
    if (S.money < RAISE_COST) return 'Raising an island costs $' + RAISE_COST + '.';
    const why = RB.sea.raiseSpot(world, x, y, RAISE_R);
    if (why) return why;
    S.money -= RAISE_COST;
    const id = 'u' + S.nextId++, seed = (S.seed ^ hashStr(id)) >>> 0;
    return newIsle(S, { id, name: RB.sea.word(new Rng(seed)) + ' Isle', made: true, x: Math.round(x), y: Math.round(y), R: RAISE_R, land, seed });
  }
  // Leave a creature on the island (a bird, or a person you netted: they live there just the same),
  // or take one back into the truck. Return '' or why not.
  function toIsle(S, isle, c) {
    if (isle.birds.length >= isleCap(isle)) return 'The island is full.';
    removeBird(S, c);
    c.at = 'isle'; c.isle = isle.id; c.gen = c.gen || 0; c.fed = true; c.hungry = 0; c.love = false;
    isle.birds.push(c);
    return '';
  }
  function fromIsle(S, isle, c) {
    const i = isle.birds.indexOf(c);
    if (i < 0) return '';
    isle.birds.splice(i, 1);
    c.at = 'cage'; delete c.isle;
    S.birds.push(c);
    return '';
  }
  // Leave an odd mushroom or an isotope there: the place gets radioactive.
  function dose(S, isle, item) {
    if (!DOSE[item]) return 'That does nothing out there.';
    if (!take(S, item)) return 'You have no ' + RB.items.ITEMS[item].name.toLowerCase() + '.';
    isle.rad = Math.min(1, +(isle.rad + DOSE[item]).toFixed(3));
    return '';
  }
  function cleanIsle(S, isle) {
    if (S.money < CLEAN_COST) return 'A clean-up costs $' + CLEAN_COST + '.';
    S.money -= CLEAN_COST; isle.rad = 0;
    return '';
  }
  // What radiation does to a young bird's genes: the hotter, the stranger.
  function mutateYoung(g, rad, r) {
    if (rad <= 0) return;
    GN.mutate(g, r, Math.round(rad * 14));
    if (r.chance(rad * 0.6)) GN.sport(g, r, r.int(1, 3));
    if (r.chance(rad * 0.45)) {
      const id = r.pick(ISLE_ODD);
      for (const sw of id === 'twoHeads' ? ['twoHeadsA', 'twoHeadsB'] : [id]) for (const gi of GN.TRAITS[sw].genes) GN.setGeneBases(g, gi, [3, 3, 3, 3], 'both');
    }
  }
  // One night on an island. Returns a line for the morning report, or null.
  function colonyNight(S, isle, r) {
    let born = 0, died = 0, odd = 0;
    for (const c of isle.birds.slice()) {
      if (c.hatched === S.day) continue;
      c.age++; dirty(c);
      if (c.age >= pheno(c).lifespan + 2) { isle.birds.splice(isle.birds.indexOf(c), 1); died++; if (c.person) soldPerson(S, c); } // out here the old pass away
    }
    const adults = isle.birds.filter((c) => isAdult(c) && c.age < pheno(c).lifespan);
    const males = r.shuffle(adults.filter((c) => c.g.sex === 'M')), females = r.shuffle(adults.filter((c) => c.g.sex === 'F'));
    for (let i = 0; i < Math.min(males.length, females.length) && isle.birds.length < isleCap(isle); i++) {
      const mom = females[i], dad = males[i];
      if (!r.chance(layChance(mom, dad) * 0.7)) continue;
      const g = GN.breed(mom.g, dad.g, r, { mutRate: 0.003 + isle.rad * 0.02 });
      mutateYoung(g, isle.rad, r);
      const chick = makeBird(S, g, { age: 0, bond: 0.05, origin: 'born', at: 'isle', mom: label(mom), dad: label(dad), momKey: kindKey(mom), dadKey: kindKey(dad) });
      chick.isle = isle.id; chick.hatched = S.day; chick.fed = true; chick.gen = Math.max(mom.gen || 0, dad.gen || 0) + 1;
      isle.birds.push(chick); isle.gen = Math.max(isle.gen, chick.gen); born++;
      if (pheno(chick).odd.length) odd++;
    }
    isle.rad = Math.max(0, +(isle.rad - 0.02).toFixed(3));
    isle.born = (isle.born || 0) + born; isle.died = (isle.died || 0) + died; isle.odd = (isle.odd || 0) + odd;
    if (!born && !died) return null;
    return isle.name + ': ' + (born ? born + ' chick' + (born > 1 ? 's' : '') + ' hatched (generation ' + isle.gen + ')' : 'no chicks') + (died ? ', ' + died + ' old bird' + (died > 1 ? 's' : '') + ' passed away' : '') + '.' + (odd ? ' ' + odd + ' of the young came out strange.' : '');
  }

  // Camp at one of your islands for n nights in a row: each counts as a night at home (the coop
  // ages, eggs hatch, the colonies breed), and the birds at home and in the truck are fed from the
  // grain in your bag each night. Returns { lines, fromBag, short } (short: nights grain ran out).
  const STAY_MAX = 30;
  function stay(S, n) {
    n = clamp(Math.round(n), 1, STAY_MAX);
    const before = (S.isles || []).map((i) => ({ i, n: i.birds.length, born: i.born || 0, died: i.died || 0, odd: i.odd || 0 }));
    const names = new Set((S.isles || []).map((i) => i.name + ':'));
    const days = [];
    let fromBag = 0, short = 0;
    for (let d = 0; d < n; d++) {
      const need = S.birds.filter((c) => !c.fed).length - S.feeder;
      if (need > 0) { const k = Math.min(need, count(S, 'grain')); if (k) { take(S, 'grain', k); S.feeder += k; fromBag += k; } if (k < need) short++; }
      for (const l of sleep(S).lines) if (![...names].some((nm) => l.startsWith(nm))) days.push('Day ' + S.day + ': ' + l);
    }
    const lines = [];
    for (const b of before) {
      const i = b.i, born = (i.born || 0) - b.born, died = (i.died || 0) - b.died, odd = (i.odd || 0) - b.odd;
      lines.push(i.name + ': ' + (born ? born + ' hatched' : 'nobody hatched') + (died ? ', ' + died + ' passed away' : '') + (odd ? ', ' + odd + ' came out strange' : '') + '. Now ' + i.birds.length + ' living there' + (i.gen ? ', generation ' + i.gen : '') + '.');
    }
    if (fromBag) lines.push('Your birds ate ' + fromBag + ' grain from your bag.');
    if (short) lines.push('The grain ran out on ' + short + ' night' + (short > 1 ? 's' : '') + '.');
    return { lines: lines.concat(days), fromBag, short };
  }

  // ---- people in charge. Anyone minding a place can be netted, indoors too: their place stays
  // shut while they are away, or you can put someone else in charge, a person you netted or even a
  // bird, which wakes up sentient and carries on the trade. (st.sub holds whoever you put there.)
  // Net whoever minds a place, given the person from world.npcs. Returns the creature now in the truck.
  function netKeeper(S, base) {
    const st = RB.npc.info(S, base.id);
    if (st.sub) { // whoever you put in charge comes back just as they were
      const c = deBird(st.sub); st.sub = null;
      delete c.keeps; c.at = 'cage'; c.fed = false; S.birds.push(c);
      if (c.person) S.stats.kidnapped++;
      return c;
    }
    const cur = RB.npc.current(S, base);
    st.gone = true;
    S.stats.kidnapped++; S.netted = S.netted || {}; S.netted[base.id] = 1;
    return addBird(S, GN.clone(cur.g), { at: 'cage', name: cur.name, person: base.id, clothes: cur.clothes, bond: 0, origin: 'wild' });
  }
  // Put a creature from the truck in charge of a place whose person is away (or gone for good).
  // Their own person put back simply goes home. Returns '' or why not.
  function installKeeper(S, base, c) {
    const st = RB.npc.info(S, base.id);
    if (st.sub) return 'Someone already runs this place.';
    if (!st.gone && !st.soldOff) return base.name + ' still runs this place.';
    removeBird(S, c);
    if (c.person === base.id && !st.soldOff) { st.gone = false; return ''; }
    c.at = 'keeper'; c.keeps = base.id; c.fed = true; c.hungry = 0; c.love = false; c.tired = false;
    st.sub = serBird(c); st.subDay = S.day;
    st.rel = 10; st.n = 0; st.sold = {}; st.credit = 0;
    return '';
  }
  // A netted person let go: they go home and take their place back; whoever you had put in charge
  // there comes back to the truck (returned). Does not take them out of the flock: the caller does.
  function releasePerson(S, c, relLoss) {
    const st = RB.npc.info(S, c.person);
    st.gone = false; st.rel = Math.max(-100, st.rel - (relLoss || 0));
    if (!st.sub) return null;
    const back = deBird(st.sub); st.sub = null;
    delete back.keeps; back.at = 'cage'; S.birds.push(back);
    return back;
  }
  // The people of the mainland (not the islands out at sea), and whether you have netted them all.
  const mainlanders = (world) => world.npcs.filter((n) => { const s = world.site[n.site]; return s && !s.island; });
  const nettedCount = (S, world) => mainlanders(world).filter((n) => S.netted && S.netted[n.id]).length;
  const nettedAll = (S, world) => { const m = mainlanders(world); return m.length > 0 && nettedCount(S, world) === m.length; };

  // ---- Sunset Roost: a home for retired birds, looked after by Dona Nina
  // Check a retired bird in (it leaves your flock and lives at the roost). Returns '' or why not.
  function checkIn(S, c) {
    if (c.person) return 'Dona Nina looks after birds, not people.';
    if (!isRetired(c)) return c.name + ' is not retired yet.';
    removeBird(S, c);
    c.at = 'roost'; c.since = S.day; c.fed = true; c.hungry = 0; c.love = false; c.tired = false; c.rest = 0;
    S.roost.push(c);
    return '';
  }
  // Take a resident back: it rides home in the truck.
  function checkOut(S, c) {
    const i = S.roost.indexOf(c);
    if (i < 0) return '';
    S.roost.splice(i, 1);
    c.at = 'cage'; delete c.since;
    S.birds.push(c);
    return '';
  }

  // ---- saving
  function serialize(S) {
    const o = {};
    for (const k of Object.keys(S)) if (k[0] !== '_') o[k] = S[k];
    o.rs = S._rng.s;
    o.birds = S.birds.map(serBird);
    o.roost = S.roost.map(serBird);
    o.isles = (S.isles || []).map((i) => Object.assign({}, i, { birds: i.birds.map(serBird) }));
    o.eggs = S.eggs.map((e) => Object.assign({}, e, { g: GN.serialize(e.g) }));
    o.lab = Object.assign({}, S.lab);
    return JSON.parse(JSON.stringify(o));
  }
  function deserialize(o) {
    const S = JSON.parse(JSON.stringify(o));
    S._rng = new Rng(S.rs);
    for (const c of S.birds) { c.g = GN.deserialize(c.g); c._P = null; }
    S.roost = S.roost || []; // saves from before Sunset Roost opened
    S.released = S.released || [];
    S.up.boat = S.up.boat || 0;
    S.markers = S.markers || {}; S.visited = S.visited || {}; // the map's markers, and islands landed on
    S.isles = S.isles || []; // breeding islands
    // everyone ever netted (for the mainland sweep); older saves rebuild it from what they know
    if (!S.netted) {
      S.netted = {};
      for (const id of Object.keys(S.npc || {})) { const st = S.npc[id]; if (st && (st.gone || st.soldOff || st.gen)) S.netted[id] = 1; }
    }
    for (const isle of S.isles) for (const c of isle.birds) { c.g = GN.deserialize(c.g); c._P = null; }
    for (const c of S.birds.concat(...S.isles.map((i) => i.birds))) if (c.person) S.netted[c.person] = 1;
    bossPrizes(S); // saves from before the boss prizes
    for (const c of S.roost) { c.g = GN.deserialize(c.g); c._P = null; }
    for (const e of S.eggs) e.g = GN.deserialize(e.g);
    return S;
  }

  RB.state = { create, addBird, removeBird, pheno, dirty, kind, isAdult, isRetired, checkIn, checkOut, BOSS_PRIZES, bossPrizes, GOLD_DIGS, goldLeft, digsLeft, useDig, useNet,
    RELEASED_MAX, setFree, genePool, HEAT_DAYS, caughtPerson, trainPreview, openSea, hasBoat, makeBird,
    ENDLESS_KINDS, endless, owned, fmtCount, canSail, serBird, deBird, STAY_MAX, stay, netKeeper, installKeeper, releasePerson, mainlanders, nettedCount, nettedAll, ISLE_EXTRA,
    CLAIM_COST, RAISE_COST, RAISE_R, CLEAN_COST, DOSE, isleOf, isleCap, claimIsle, raiseIsle, toIsle, fromIsle, dose, cleanIsle, colonyNight, byId, at, atHome, cageCap, coopCap, nestCount, count, give, take, move, feed, train, TRAIN,
    layChance, sleep, serialize, deserialize, freeName, BIRD_NAMES, eat, soldPerson, kindKey, isCross, label };
})();
