// npc.js — the people: shopkeepers, villagers who want a bird, breeders, collectors, rival
// trainers and the sheriff. People carry the same genome as everything else, so a netted person
// is just another creature in the cage. No DOM.
(function () {
  'use strict';
  const RB = globalThis.RB;
  const { Rng, clamp01, hashStr } = RB.core;

  const FIRST_M = ['Ze', 'Tonho', 'Juca', 'Chico', 'Tiao', 'Zeca', 'Nando', 'Raimundo', 'Gil', 'Bento', 'Quito', 'Dito', 'Valdo', 'Nico'];
  const FIRST_F = ['Bia', 'Neide', 'Lurdes', 'Dirce', 'Marlene', 'Jurema', 'Ivete', 'Odila', 'Rosa', 'Nair', 'Cleide', 'Socorro', 'Zilda', 'Dalva'];
  const SHIRTS = ['#2a9d8f', '#e76f51', '#e9b44c', '#6d4c7d', '#7fb069', '#3d6fa5', '#b5523b', '#d98cab', '#f2efe6'];
  const PANTS = ['#23314a', '#4a3b32', '#5a6472', '#2f4a3a', '#6b4a2e'];
  const darker = (hex) => '#' + [1, 3, 5].map((i) => Math.round(parseInt(hex.slice(i, i + 2), 16) * 0.8).toString(16).padStart(2, '0')).join('');
  // Fixed people at the sites: [site, name, sex, hat]
  const KEEPERS = [['feed', 'Dona Cida', 'F', null], ['tools', 'Seu Juca', 'M', 'cowboy'], ['garage', 'Biu', 'M', 'bandana'], ['hatter', 'Madame Odete', 'F', 'tophat'], ['vet', 'Dr. Ivo', 'M', null],
    ['bank', 'Big Wattle', 'M', 'tophat'], ['lab', 'Prof. Bequer', 'F', null], ['market', 'Zarolho', 'M', 'bandana'], ['carnival', 'Mestre Pipoca', 'M', 'party'],
    ['backyard', 'Old Bira', 'M', 'cowboy'], ['county', 'Dona Zefa', 'F', null], ['city', 'Dr. Quill', 'M', 'tophat'], ['cellar', 'The Butcher', 'M', 'bandana'], ['grand', 'Madame Plume', 'F', 'crown']];
  const HOUSE_ROLES = ['villager', 'breeder', 'trainer', 'villager', 'collector', 'trainer', 'breeder', 'villager', 'villager', 'collector', 'trainer', 'breeder'];

  function personGenome(r, sex) {
    const t = Object.assign({}, RB.species.SPECIES.human.t, { size: r.range(2.05, 2.5), bodyDepth: r.range(0.8, 1.25), bodyLen: r.range(0.88, 1.02), hue: r.range(0.04, 0.09), sat: r.range(0.3, 0.6),
      lit: r.range(0.3, 0.8), litHead: r.range(-0.3, 0.25), hueHead: r.range(-0.03, 0.06), crest: sex === 'F' ? r.range(0.5, 1) : r.range(0, 0.8), muscle: r.range(0.8, 1.25), courage: r.range(0.15, 0.7), aggression: r.range(0.2, 0.7) });
    return RB.genome.fromTargets(t, ['arms', 'bare', 'knee'], r, { sex, variation: 0.3, colorVar: 0.05, carrier: 0, carriers: { melanic: 0, leucistic: 0 } });
  }
  function clothes(r, hat) { const shirt = r.pick(SHIRTS), pants = r.pick(PANTS); return { shirt, shirtDark: darker(shirt), pants, pantsDark: darker(pants), hat: hat || null }; }

  // ---- Coronel Galo, who runs BFC: a rooster of a man. Rooster head (comb, wattles, beak), white
  // feathers, a man's height and stance, arms; a white suit, a string tie, a planter's hat and a cane.
  function colonelGenome(r) {
    const t = Object.assign({}, RB.species.SPECIES.human.t, {
      size: r.range(2.1, 2.3), posture: 0.95, bodyDepth: r.range(1.0, 1.15), neckLen: 0.55, neckThick: 1.2, headSize: 1.15, eyeSize: 0.9,
      beakLen: 0.95, beakDepth: 1.15, beakHook: 0.25, comb: 1.45, combType: 0.5, wattle: 1.0, crest: 0, bareHead: 0,
      wingSize: 0.25, tailLen: 0.9, tailFan: 0.6, tailUp: 0.7, spur: 0.7, talon: 0.3, armLen: 1.05,
      hue: 0.1, sat: 0.08, lit: 0.93, litHead: 0, hueHead: 0, litWing: -0.03, litTail: -0.05, beakTone: 0.6, legTone: 0.6, combHue: 0, pattern: 0.5, patContrast: 0, belly: 0,
      lifespan: 22, courage: 0.8, aggression: 0.55, focus: 0.7, cunning: 0.8 });
    return RB.genome.fromTargets(t, ['arms', 'knee'], r, { sex: 'M', variation: 0.15, colorVar: 0.02, carrier: 0, carriers: { melanic: 0, leucistic: 0 } });
  }
  const colonelClothes = () => ({ shirt: '#f4f1e8', shirtDark: '#d9d3c2', pants: '#f4f1e8', pantsDark: '#d9d3c2', hat: 'planter', cane: true, tie: true });
  const COLONEL_TITLES = ['Coronel Galo', 'Coronel Galo Jr.', 'Coronel Galo III', 'Coronel Galo IV', 'Coronel Galo V'];
  const colonelName = (gen) => COLONEL_TITLES[gen] || 'Coronel Galo ' + (gen + 1);
  // Made from his own seed (not the world's shared stream), so every other person stays who they were.
  function colonel(world) {
    const r = new Rng((world.seed ^ hashStr('coronel-galo')) >>> 0);
    return { id: 'k_bfc', name: colonelName(0), role: 'keeper', site: 'bfc', sex: 'M', g: colonelGenome(r), clothes: colonelClothes(), wealth: 2.2, seed: r.int(1, 2e9), colonel: true, kindName: 'Rooster-man' };
  }

  // One person, drawn from r.
  const make = (r, id, name, role, site, sex, hat) => ({ id, name, role, site, sex, g: personGenome(r, sex), clothes: clothes(r, hat), wealth: +r.range(0.7, 1.6).toFixed(2), seed: r.int(1, 2e9) });
  // All the people of a world. Called by world.generate with the world's own rng.
  function populate(world, r) {
    const list = [];
    const add = (id, name, role, site, sex, hat) => { const npc = make(r, id, name, role, site, sex, hat); list.push(npc); return npc; };
    for (const k of KEEPERS) add('k_' + k[0], k[1], 'keeper', k[0], k[2], k[3]);
    const usedM = FIRST_M.slice(), usedF = FIRST_F.slice();
    r.shuffle(usedM); r.shuffle(usedF);
    HOUSE_ROLES.forEach((role, i) => {
      const sex = r.chance(0.5) ? 'M' : 'F', name = (sex === 'M' ? usedM : usedF).pop() || 'Neighbour';
      const npc = add('h_' + i, name, role, 'house' + i, sex, r.chance(0.3) ? r.pick(['cowboy', 'bandana']) : null);
      if (role === 'collector') npc.wealth = +(npc.wealth * 1.6).toFixed(2);
    });
    const sh = add('sheriff', 'Sheriff Tavares', 'sheriff', 'bank', 'M', 'star');
    sh.clothes.shirt = '#8a7a52'; sh.clothes.shirtDark = '#6e6142';
    if (world.site && world.site.bfc) list.push(colonel(world));
    return list;
  }

  // Who lives in a house now: the original neighbour, or a newcomer after the last one was sold.
  const SURNAMES = ['Moura', 'Queiroz', 'Bastos', 'Freitas', 'Lacerda', 'Pimentel', 'Saraiva', 'Teles'];
  const newcomers = new Map(), subs = new Map();
  function current(S, npc) {
    const sub = S.npc[npc.id] && S.npc[npc.id].sub;
    if (sub) return standIn(npc, sub);
    const gen = (S.npc[npc.id] && S.npc[npc.id].gen) || 0;
    if (!gen) return npc;
    const key = npc.id + ':' + gen;
    let n = newcomers.get(key);
    if (!n) {
      const r = new Rng((npc.seed ^ Math.imul(gen, 2654435761)) >>> 0), sex = r.chance(0.5) ? 'M' : 'F';
      if (npc.colonel) { // BFC passes from father to son: another rooster-man in the same white suit
        n = Object.assign({}, npc, { name: colonelName(gen), g: colonelGenome(r), clothes: colonelClothes(), seed: r.int(1, 2e9) });
        newcomers.set(key, n);
        return n;
      }
      const name = npc.role === 'sheriff' ? 'Sheriff ' + r.pick(SURNAMES) : r.pick(sex === 'M' ? FIRST_M : FIRST_F);
      n = Object.assign({}, npc, { name, sex, g: personGenome(r, sex), clothes: clothes(r, npc.role === 'sheriff' ? 'star' : r.chance(0.3) ? r.pick(['cowboy', 'bandana']) : null), seed: r.int(1, 2e9) });
      if (npc.role === 'sheriff') { n.clothes.shirt = '#8a7a52'; n.clothes.shirtDark = '#6e6142'; }
      newcomers.set(key, n);
    }
    return n;
  }

  // Whoever you put in charge of a place (state.installKeeper): a person you netted, or a bird that
  // woke up sentient. They keep the place's role and trade, under their own name and face.
  function standIn(npc, sub) {
    const key = npc.id + ':' + sub.id + ':' + sub.name;
    let n = subs.get(key);
    if (!n) {
      const g = RB.genome.deserialize(sub.g);
      n = Object.assign({}, npc, { name: sub.name, sex: g.sex, g, clothes: sub.clothes || null, hat: sub.hat || null, seed: (npc.seed ^ hashStr(key)) >>> 0, sub: true, bird: !sub.person, was: npc.name });
      subs.set(key, n);
    }
    return n;
  }

  // ---- wishes: what a buyer is after, and how well a creature fits (0..1)
  const WISHES = [
    { id: 'tall', text: 'something tall', score: (P) => clamp01((P.LLv + P.NL + P.TL * 0.5 - 60) / 140) },
    { id: 'tiny', text: 'something tiny', score: (P) => clamp01((1.0 - P.S) / 0.55) },
    { id: 'legs', text: 'long legs', score: (P) => clamp01((P.t.legLen - 1) / 1.3) },
    { id: 'neck', text: 'a long neck', score: (P) => clamp01((P.t.neckLen - 1) / 1.2) },
    { id: 'beak', text: 'a big beak', score: (P) => clamp01((P.t.beakLen * P.t.beakDepth - 1) / 2) },
    { id: 'bright', text: 'bright colours', score: (P) => clamp01((P.t.sat - 0.45) / 0.45) },
    { id: 'white', text: 'a white bird', score: (P) => clamp01((P.t.lit - 0.6) / 0.3) * clamp01(1.3 - P.t.sat * 1.5) },
    { id: 'black', text: 'a black bird', score: (P) => clamp01((0.35 - P.t.lit) / 0.22) },
    { id: 'tail', text: 'a showy tail', score: (P) => clamp01(P.t.tailLen * (0.4 + P.t.tailFan) / 2.2) },
    { id: 'crest', text: 'a fancy crest', score: (P) => clamp01((P.crest - 0.3) / 0.6) },
    { id: 'fast', text: 'a fast runner', score: (P) => P.rate.speed / 100 },
    { id: 'tough', text: 'a tough one', score: (P) => clamp01(P.rate.tough / 100) },
    { id: 'mean', text: 'a mean fighter', score: (P, c) => clamp01(P.rate.fury / 100 * 0.6 + c.wins * 0.15) },
    { id: 'champ', text: 'a proven winner', score: (P, c) => clamp01(c.wins / 4) },
    { id: 'odd', text: 'something strange', score: (P) => clamp01(P.odd.length / 2 + (P.species.pure ? 0 : 0.4)) },
    { id: 'chick', text: 'a chick to raise', score: (P) => (P.stage === 'chick' ? 1 : P.stage === 'young' ? 0.5 : 0) },
    { id: 'layer', text: 'a good laying hen', score: (P) => (P.sex === 'F' ? clamp01((P.t.fertility - 0.6) / 0.5) : 0) },
  ];
  const WISH_SPECIES = ['duck', 'goose', 'turkey', 'peafowl', 'pheasant', 'quail', 'swan', 'parrot', 'toucan', 'owl', 'falcon', 'flamingo', 'penguin', 'heron', 'ostrich'];
  // Per-person state in the save. `sold` is a breeder's record of which birds of the current stock
  // are gone; `soldOff` marks a netted person who went to BFC (their house stands empty a while).
  function info(S, id) {
    const st = (S.npc[id] = S.npc[id] || { rel: 0, gone: false, n: 0, sold: {}, fought: 0, met: false });
    // saves from one earlier build used `sold` for the BFC flag too: move it out of the way
    if (typeof st.sold !== 'object' || st.sold === null) { if (st.sold === true) { st.soldOff = true; if (st.soldDay === undefined) st.soldDay = S.day; } st.sold = {}; }
    return st;
  }
  // Why a place has nobody to talk to: 'sold' (house empty until a newcomer), 'away' (netted, held
  // somewhere), or '' (open as usual).
  function vacancy(S, npc) {
    if (!npc) return '';
    const st = info(S, npc.id);
    return st.sub ? '' : st.soldOff ? 'sold' : st.gone ? 'away' : '';
  }
  const period = (S) => Math.floor((S.day - 1) / 3);

  function wishOf(S, npc) {
    const st = info(S, npc.id);
    const r = new Rng((npc.seed ^ Math.imul(period(S) + 1, 7919) ^ Math.imul(st.n + 1, 104729)) >>> 0);
    if (npc.role === 'collector' || npc.role === 'exotic') return WISHES.find((w) => w.id === 'odd');
    if (r.chance(0.3)) {
      const id = r.pick(WISH_SPECIES), s = RB.species.SPECIES[id], name = RB.species.nameOf(s, 'F').toLowerCase();
      return { id: 'sp:' + id, text: (/^[aeiou]/.test(name) ? 'an ' : 'a ') + name, score: (P) => (P.species.id === id ? (P.species.pure ? 1 : 0.6) : 0) };
    }
    return r.pick(WISHES);
  }
  // What this person pays for a creature today.
  function offer(S, npc, c) {
    if (c.person) return 0;
    const P = RB.state.pheno(c), st = info(S, npc.id), m = wishOf(S, npc).score(P, c);
    const k = npc.role === 'collector' || npc.role === 'exotic' ? 0.5 + 2.6 * m : 0.85 + 1.9 * m;
    return Math.max(3, Math.round(RB.economy.value(c) * k * npc.wealth * (1 + st.rel / 250)));
  }
  const fitText = (m) => (m > 0.8 ? 'Exactly what I wanted!' : m > 0.45 ? 'That would do nicely.' : m > 0.15 ? 'Not quite what I had in mind.' : 'Not what I am after, but I will take it off your hands.');

  // Every neighbour has a few birds for sale each period: [{ key, g, price, name, P, mom, dad, momKey, dadKey }]
  // Breeders keep more and sell cheaper; the exotic dealer sells the strangest birds there are.
  const STOCK_N = { breeder: 3, exotic: 5 };
  const blank = (g) => ({ g, age: 3, train: { muscle: 0, lungs: 0, reflex: 0, courage: 0 }, cond: 1, wins: 0, hp: 1, _P: null });
  function stockOf(S, world, npc) {
    const st = info(S, npc.id), site = world.site[npc.site], out = [];
    st.sold = st.sold || {};
    const fauna = RB.world.faunaAt(world, site.x, site.y);
    for (let i = 0; i < (STOCK_N[npc.role] || 2); i++) {
      const key = period(S) + ':' + i;
      if (st.sold[key]) continue;
      const r = new Rng((npc.seed ^ Math.imul(period(S) + 3, 15485863) ^ i) >>> 0);
      const e = npc.role === 'exotic' ? exotic(r) : { g: RB.species.make(r.weighted(fauna, (x) => x[1])[0], r, { sport: 0.25 }) };
      const c = blank(e.g), k = npc.role === 'exotic' ? 2.6 : npc.role === 'breeder' ? 1.7 : 1.9;
      out.push(Object.assign({ key, name: r.pick(RB.state.BIRD_NAMES), price: Math.round(RB.economy.value(c) * k * (1 - st.rel / 400)), P: RB.state.pheno(c) }, e));
    }
    return out;
  }
  // A bizarre bird: a cross of two kinds that have no business together (now and then one of them
  // long extinct), with a handful of oddities switched on and its genes stirred.
  function exotic(r) {
    const ids = RB.species.IDS.filter((id) => !RB.species.SPECIES[id].person), live = ids.filter((id) => !RB.species.SPECIES[id].extinct);
    const a = r.pick(r.chance(0.2) ? ids : live);
    let b = r.pick(live); while (b === a) b = r.pick(live);
    const g = RB.genome.breed(RB.species.make(a, r, { sex: 'F', sport: 0 }), RB.species.make(b, r, { sex: 'M', sport: 0 }), r);
    // two or three of the strangest switches, on in both copies so they always show
    const GN = RB.genome, odd = r.shuffle(['teeth', 'arms', 'twoHeads', 'glow', 'tailBone', 'gigas', 'cyclops', 'legsExtra', 'earTuft', 'fluff', 'bare']).slice(0, r.int(2, 3));
    for (const id of odd) for (const sw of id === 'twoHeads' ? ['twoHeadsA', 'twoHeadsB'] : [id]) for (const gi of GN.TRAITS[sw].genes) GN.setGeneBases(g, gi, [3, 3, 3, 3], 'both');
    GN.sport(g, r, r.int(1, 3));
    GN.mutate(g, r, r.int(4, 12));
    return { g, mom: RB.species.generic(a), dad: RB.species.generic(b), momKey: a, dadKey: b };
  }
  // A rival trainer's challenge for today, or null if already fought.
  function challengeOf(S, npc) {
    const st = info(S, npc.id);
    if (st.fought === S.day) return null;
    // rivals match how far you have come: one tier up for each arena boss beaten
    const tier = Math.min(RB.economy.ARENAS.length - 1, RB.economy.ARENAS.filter((a) => RB.economy.everWon(S, a.id)).length);
    const arena = RB.economy.ARENAS[tier], r = new Rng((npc.seed ^ Math.imul(S.day, 6151)) >>> 0);
    const wc = r.pick(arena.classes), stake = Math.round(30 * (1 + tier) * (1 + tier) * npc.wealth / 5) * 5;
    const opp = RB.economy.makeOpponent((npc.seed + S.day * 31) >>> 0, wc, tier, arena.id === 'cellar');
    opp.trainer = npc.name;
    return { key: 'duel:' + npc.id + ':' + S.day, wc, mode: 'pit', open: arena.id === 'cellar', fee: stake, purse: stake * 2, tier, duel: npc.id, opp };
  }

  const GREET = { villager: ['Morning! I am looking for {w}.', 'You catch birds, right? I want {w}.', 'If you ever find {w}, think of me.'],
    breeder: ['Fresh from my own yard. Have a look.', 'Good stock, fair prices.'], collector: ['I collect the strange and the old. Show me {w}.', 'Bones, relics, oddities. What have you dug up?'],
    trainer: ['My bird would flatten yours. Care to prove me wrong?', 'Put your money where your beak is.'],
    exotic: ['Two heads? Teeth? A glow in the dark? I have them all. Nobody else does.', 'Step inside. Mind the one with arms.', 'Rare, strange and impossible. Prices to match.'] };
  function greeting(S, npc) {
    const r = new Rng((npc.seed ^ S.day) >>> 0), list = GREET[npc.role] || ['Hello.'];
    return chirp(npc, r) + r.pick(list).replace('{w}', wishOf(S, npc).text);
  }
  // a bird in charge still sounds like one now and then
  const CHIRPS = ['Squawk! ', 'Caw. Ahem. ', 'Cluck cluck. I mean: ', '*ruffles feathers* ', 'Prrrt. ', 'Kraa! Sorry. '];
  function chirp(npc, r) { return npc && npc.bird ? (r || new Rng(npc.seed)).pick(CHIRPS) : ''; }
  const SCREAMS = ['Hey! HEY!', 'Not the net!', 'I have a family!', 'This is a kidnapping!', 'Put me down!', 'My back!'];

  const randomName = (r, sex) => r.pick(sex === 'M' ? FIRST_M : FIRST_F);
  RB.npc = { chirp, populate, make, colonel, colonelGenome, colonelName, exotic, randomName, personGenome, clothes, current, WISHES, info, vacancy, wishOf, offer, fitText, stockOf, challengeOf, greeting, SCREAMS, period, hashStr };
})();
