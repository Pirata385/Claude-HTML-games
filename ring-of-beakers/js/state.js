// state.js — the save: money, day, creatures, eggs, inventory, upgrades, and the rules that move
// it forward (feeding, training, nesting, sleeping). No DOM; scenes only call into this.
(function () {
  'use strict';
  const RB = globalThis.RB;
  const { Rng, clamp } = RB.core;
  const GN = RB.genome;

  const BIRD_NAMES = ['Pepper', 'Biscuit', 'Farofa', 'Pimenta', 'Trovao', 'Pipoca', 'Fuba', 'Quindim', 'Pacoca', 'Cuscuz', 'Jilo', 'Faisca', 'Brasa', 'Ticao',
    'Banze', 'Fuzue', 'Muvuca', 'Xodo', 'Caju', 'Dende', 'Mandioca', 'Rapadura', 'Canjica', 'Tapioca', 'Moqueca', 'Sabia', 'Zangado', 'Relampago', 'Ventania',
    'Capitao', 'Baronesa', 'Duque', 'Marques', 'Comadre', 'Valente', 'Mimoso', 'Furacao', 'Chuvisco', 'Garoa', 'Poeira', 'Carvao', 'Ferrugem', 'Canela', 'Cravo',
    'Mostarda', 'Pequi', 'Jabuti', 'Tucupi', 'Feijao', 'Torresmo', 'Bolacha', 'Cocada', 'Brigadeiro', 'Goiabada', 'Catuaba', 'Bambu', 'Graveto', 'Pedrita'];

  function create(seed) {
    const S = {
      v: 1, seed: seed >>> 0, rs: (seed ^ 0x51ab) >>> 0, day: 1, time: 6, money: 150, debt: 15000, heat: 0, nextId: 1,
      birds: [], eggs: [],
      inv: { net: 3, shovel: 10, grain: 8 }, equip: {}, up: { cage: 0, engine: 0, tires: 0, coop: 0, nest: 0, incubator: 0, dummy: 0 },
      feeder: 0, pos: null, dug: {}, npc: {}, league: {}, bets: {},
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
    return S;
  }

  function freeName(S, r) {
    const used = new Set(S.birds.map((b) => b.name));
    for (let i = 0; i < 30; i++) { const n = r.pick(BIRD_NAMES); if (!used.has(n)) return n; }
    return r.pick(BIRD_NAMES) + ' ' + (2 + r.int(0, 97));
  }

  // o: { name, age, bond, origin, at, person (npc id), clothes, mom, dad (species labels of the parents) }
  function addBird(S, genome, o) {
    o = o || {};
    const c = { id: S.nextId++, name: o.name || freeName(S, S._rng), g: genome, age: 0, bond: o.bond === undefined ? 0.1 : o.bond, at: o.at || 'home', origin: o.origin || 'wild',
      train: { muscle: 0, lungs: 0, reflex: 0, courage: 0 }, cond: 1, hp: 1, rest: 0, tired: false, fed: false, hungry: 0, bouts: 0, trained: false, wins: 0, losses: 0,
      hat: null, gear: null, buff: null, love: false, person: o.person || null, clothes: o.clothes || null, mom: o.mom || null, dad: o.dad || null, momKey: o.momKey || null, dadKey: o.dadKey || null, inj: 0 };
    c.age = o.age === undefined ? pheno(c).growDays + 1 : o.age;
    c._P = null;
    S.birds.push(c);
    return c;
  }

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

  const byId = (S, id) => S.birds.find((b) => b.id === id) || null;
  const at = (S, where) => S.birds.filter((b) => b.at === where);
  const atHome = (S) => S.birds.filter((b) => b.at !== 'cage');
  const cageCap = () => Infinity; // the truck has no limit
  const coopCap = (S) => RB.items.COOP[S.up.coop];
  const nestCount = (S) => 1 + S.up.nest;
  const count = (S, item) => S.inv[item] || 0;
  function give(S, item, n) { S.inv[item] = (S.inv[item] || 0) + (n === undefined ? 1 : n); }
  function take(S, item, n) { n = n === undefined ? 1 : n; if (count(S, item) < n) return false; S.inv[item] -= n; if (S.inv[item] <= 0) delete S.inv[item]; return true; }
  function removeBird(S, c) { const i = S.birds.indexOf(c); if (i >= 0) S.birds.splice(i, 1); }

  // Move a creature: 'home', 'cage', 'crate' (BFC pick-up box) or 'nestN'. Returns '' or why not.
  function move(S, c, to) {
    if (c.at === to) return '';
    if (to === 'cage') { /* the truck takes everyone */ }
    else if (to === 'home') { if (c.at === 'cage' && atHome(S).length >= coopCap(S)) return 'The coop is full.'; }
    else if (to.startsWith('nest')) {
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
    if (c.trained) return c.name + ' has trained enough for today.';
    if (!isAdult(c)) return c.name + ' is too young to train.';
    if (c.train[stat] >= 0.15) return c.name + ' cannot improve that any further.';
    c.trained = true;
    c.train[stat] = Math.min(0.15, +(c.train[stat] + 0.02 * (c.gear === 'anklets' ? 1.5 : 1)).toFixed(3));
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
      if (pair.length !== 2 || pair[0].g.sex === pair[1].g.sex) continue;
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
    let held = 0;
    for (const c of S.birds.slice()) {
      c.fed = false; c.bouts = 0; c.trained = false; c.tired = false;
      if (c.rest > 0) c.rest--;
      // wounds do not heal on their own: that is the vet's job
      if (c.person) { held++; continue; }
      if (c.hatched === S.day) continue; // hatched this morning: not a day old yet
      const was = pheno(c).stage;
      c.age++; dirty(c);
      const P = pheno(c);
      if (c.age >= P.lifespan) { removeBird(S, c); lines.push(c.name + ' grew old and flew off to the great roost.'); }
      else if (was !== 'adult' && P.stage === 'adult') lines.push(c.name + ' is all grown up.');
      else if (was !== 'elder' && P.stage === 'elder') lines.push(c.name + ' is getting old.');
    }
    S.heat = clamp(S.heat - 6 + held * 4, 0, 100);
    // a house left empty gets a new owner after three nights
    for (const id of Object.keys(S.npc)) {
      const st = RB.npc.info(S, id);
      if (st.soldOff && S.day - st.soldDay >= 3) {
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

  // ---- saving
  function serialize(S) {
    const o = {};
    for (const k of Object.keys(S)) if (k[0] !== '_') o[k] = S[k];
    o.rs = S._rng.s;
    o.birds = S.birds.map((c) => { const b = {}; for (const k of Object.keys(c)) if (k[0] !== '_') b[k] = c[k]; b.g = GN.serialize(c.g); return b; });
    o.eggs = S.eggs.map((e) => Object.assign({}, e, { g: GN.serialize(e.g) }));
    o.lab = Object.assign({}, S.lab);
    return JSON.parse(JSON.stringify(o));
  }
  function deserialize(o) {
    const S = JSON.parse(JSON.stringify(o));
    S._rng = new Rng(S.rs);
    for (const c of S.birds) { c.g = GN.deserialize(c.g); c._P = null; }
    for (const e of S.eggs) e.g = GN.deserialize(e.g);
    return S;
  }

  RB.state = { create, addBird, removeBird, pheno, dirty, kind, isAdult, byId, at, atHome, cageCap, coopCap, nestCount, count, give, take, move, feed, train, TRAIN,
    layChance, sleep, serialize, deserialize, freeName, BIRD_NAMES, eat, soldPerson, kindKey, isCross, label };
})();
