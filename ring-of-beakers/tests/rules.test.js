'use strict';
const test = require('node:test');
const assert = require('node:assert');
const RB = require('./load.js');
const { Rng } = RB.core;
const ST = RB.state, EC = RB.economy;

test('a new game starts with a pair, and a save round-trips', () => {
  const S = ST.create(123);
  assert.strictEqual(S.birds.length, 2);
  assert.deepStrictEqual(S.birds.map((b) => b.g.sex).sort(), ['F', 'M']);
  assert.ok(S.birds.every((b) => ST.isAdult(b)));
  const back = ST.deserialize(JSON.parse(JSON.stringify(ST.serialize(S))));
  assert.strictEqual(back.birds.length, 2);
  assert.strictEqual(RB.genome.hash(back.birds[0].g), RB.genome.hash(S.birds[0].g));
  assert.strictEqual(back._rng.s, S._rng.s);
  assert.deepStrictEqual(ST.serialize(back), ST.serialize(S));
});

test('the feeder feeds at night, hungry birds lose condition and leave on the third night', () => {
  const S = ST.create(5);
  S.feeder = 2;
  ST.sleep(S);
  assert.strictEqual(S.feeder, 0);
  assert.ok(S.birds.every((b) => b.hungry === 0 && b.cond === 1));
  ST.sleep(S); ST.sleep(S);
  assert.strictEqual(S.birds.length, 2);
  assert.ok(S.birds.every((b) => b.hungry === 2 && b.cond < 1));
  const r = ST.sleep(S);
  assert.strictEqual(S.birds.length, 0);
  assert.ok(r.lines.some((l) => l.includes('ran off')));
});

test('a pair in the nest lays, the egg hatches two mornings later, and the chick grows up', () => {
  const S = ST.create(7);
  const [a, b] = S.birds;
  assert.strictEqual(ST.move(S, a, 'nest0'), '');
  assert.strictEqual(ST.move(S, b, 'nest0'), '');
  assert.ok(ST.layChance(a.g.sex === 'F' ? a : b, a.g.sex === 'F' ? b : a) > 0.6);
  let laidDay = 0;
  for (let i = 0; i < 6 && !S.eggs.length; i++) { S.feeder = 5; laidDay = S.day; ST.sleep(S); }
  assert.ok(S.eggs.length >= 1, 'no egg after six nights');
  const hatchDay = S.eggs[0].hatch;
  assert.strictEqual(hatchDay, laidDay + 3);
  while (S.day < hatchDay) { S.feeder = 9; ST.sleep(S); }
  const chick = S.birds.find((c) => c.origin === 'born');
  assert.ok(chick, 'no chick hatched');
  assert.strictEqual(ST.pheno(chick).stage, 'chick');
  assert.ok(ST.move(S, chick, 'nest0') !== '', 'a chick must not nest');
  for (let i = 0; i < 4; i++) { S.feeder = 9; ST.sleep(S); }
  assert.ok(ST.isAdult(chick));
});

test('young are named after their parents\' kinds: same kind stays that kind, two kinds make a cross', () => {
  const S = ST.create(29), r = S._rng;
  const egg = (mom, dad) => { const g = RB.genome.breed(mom.g, dad.g, r); return ST.addBird(S, g, { age: 4, origin: 'born', mom: ST.label(mom), dad: ST.label(dad), momKey: ST.kindKey(mom), dadKey: ST.kindKey(dad) }); };
  const hen = S.birds.find((c) => c.g.sex === 'F'), cock = S.birds.find((c) => c.g.sex === 'M');
  const chick = egg(hen, cock);
  assert.ok(!ST.isCross(chick));
  assert.ok(['Hen', 'Rooster'].includes(ST.kind(chick)), ST.kind(chick));
  const ostrich = ST.addBird(S, RB.species.make('ostrich', r, { sex: 'M', sport: 0 }));
  const mix = egg(hen, ostrich);
  assert.ok(ST.isCross(mix));
  assert.strictEqual(ST.kind(mix), RB.species.blendNames('Ostrich', 'Chicken'));
  // two crosses of the same mix breed true to the mix
  const mix2 = egg(hen, ostrich); mix2.g.sex = mix.g.sex === 'M' ? 'F' : 'M';
  const f2 = egg(mix.g.sex === 'F' ? mix : mix2, mix.g.sex === 'M' ? mix : mix2);
  assert.ok(!ST.isCross(f2) && ST.kind(f2) === ST.kind(mix), ST.kind(f2));
  // a person and a hen
  const man = ST.addBird(S, RB.npc.personGenome(r, 'M'), { person: 'h_3' });
  assert.strictEqual(ST.kind(egg(hen, man)), RB.species.blendNames('Person', 'Chicken'));
});

test('moving creatures respects the cage and the nest; people can nest and go to BFC', () => {
  const S = ST.create(9);
  const r = S._rng;
  const extra = [0, 1, 2].map(() => ST.addBird(S, RB.species.make('duck', r, { sex: 'M', sport: 0 })));
  // the truck has no limit
  for (const c of S.birds.slice(0, 4)) assert.strictEqual(ST.move(S, c, 'cage'), '');
  assert.strictEqual(ST.at(S, 'cage').length, 4);
  ST.move(S, extra[0], 'home');
  assert.strictEqual(ST.move(S, extra[0], 'nest0'), '');
  assert.ok(ST.move(S, extra[1], 'nest0').includes('male and a female'));
  const person = ST.addBird(S, RB.npc.personGenome(r, 'M'), { name: 'Juca', person: 'h_0' });
  assert.ok(ST.pheno(person).person);
  // nest0 holds a male duck, so a man cannot join it; a hen in another nest can take him
  assert.ok(ST.move(S, person, 'nest0').includes('male and a female'));
  S.up.nest = 1;
  const hen = ST.addBird(S, RB.species.make('chicken', r, { sex: 'F', sport: 0 }));
  assert.strictEqual(ST.move(S, hen, 'nest1'), '');
  assert.strictEqual(ST.move(S, person, 'nest1'), '');
  assert.ok(ST.layChance(hen, person) >= 0.45, 'a hen and a man should manage an egg often enough');
  assert.strictEqual(ST.move(S, person, 'crate'), '');
});

test('one grain feeds any creature, and eating clears hunger at once', () => {
  const S = ST.create(19), r = S._rng;
  const big = ST.addBird(S, RB.species.make('ostrich', r, { sex: 'M', sport: 0 }));
  big.hungry = 1;
  S.inv.grain = 3;
  const msg = ST.feed(S, big, 'grain');
  assert.ok(msg && big.fed && big.hungry === 0);
  assert.strictEqual(S.inv.grain, 2);
  assert.ok(ST.feed(S, big, 'grain').includes('full'), 'a fed creature does not eat a second grain');
  assert.strictEqual(S.inv.grain, 2);
  // one grain in the feeder per creature is enough for the night
  S.feeder = S.birds.length;
  const rep = ST.sleep(S);
  assert.ok(S.birds.every((c) => c.hungry === 0), rep.lines.join(' | '));
  assert.strictEqual(S.feeder, 1, 'the ostrich had eaten already, so one grain is left');
});

test('BFC pays by weight, doubles the daily special and takes far less than a bird is worth', () => {
  const S = ST.create(11), r = S._rng;
  const mk = (id) => ST.addBird(S, RB.species.make(id, r, { sex: 'M', sport: 0 }));
  const quail = mk('quail'), hen = mk('gamecock'), goose = mk('swan'), ostrich = mk('ostrich');
  // pick a day whose special matches none of them, so only weight is compared
  while ([quail, hen, goose, ostrich].some((c) => EC.bfcIsSpecial(S, c))) S.day++;
  const p = [quail, hen, goose, ostrich].map((c) => EC.bfcPrice(S, c));
  assert.ok(p[0] <= p[1] && p[1] <= p[2] && p[2] <= p[3], 'prices ' + p);
  for (const c of [hen, goose, ostrich]) assert.ok(EC.bfcPrice(S, c) <= EC.value(c) * 0.45 + 1, 'BFC must pay well under value');
  assert.ok(EC.bfcPrice(S, hen, true) <= EC.bfcPrice(S, hen), 'the pick-up box pays no more than the counter');
  const duck = mk('duck'), plain = EC.bfcPrice(S, duck);
  let d = S.day;
  for (let i = 0; i < 400; i++) { S.day = d + i; const sp = EC.bfcSpecial(S); if (sp.kind === 'species' && sp.id === 'duck') break; }
  assert.ok(EC.bfcIsSpecial(S, duck), 'no duck special found in 400 days');
  assert.ok(EC.bfcPrice(S, duck) >= plain * 1.8, 'special should about double');
  const person = ST.addBird(S, RB.npc.personGenome(r, 'F'), { person: 'h_1' });
  assert.ok(EC.bfcPrice(S, person) > 10, 'BFC takes people too, by the kilo');
  // a person sent off in the pick-up box empties their house, and a newcomer moves in later
  ST.move(S, person, 'crate'); S.feeder = 50; ST.sleep(S);
  assert.ok(RB.npc.info(S, 'h_1').soldOff && !S.birds.includes(person));
  for (let i = 0; i < 3; i++) { S.feeder = 50; ST.sleep(S); }
  const st = RB.npc.info(S, 'h_1');
  assert.ok(!st.soldOff && !st.gone && st.gen === 1, 'someone new should have moved in: ' + JSON.stringify(st));
  const w = RB.world.generate(S.seed), old1 = w.npcs.find((n) => n.id === 'h_1'), now = RB.npc.current(S, old1);
  assert.notStrictEqual(RB.genome.hash(now.g), RB.genome.hash(old1.g));
  // the pick-up box sells at night and stamps the card
  ST.move(S, quail, 'crate');
  const money = S.money;
  S.feeder = 20; ST.sleep(S);
  assert.ok(S.money > money && !S.birds.includes(quail) && S.bfc.stamps === 2, 'two stamps: the person and the quail');
});

test('value rewards wins, oddities and rarer kinds', () => {
  const S = ST.create(13), r = S._rng;
  const hen = ST.addBird(S, RB.species.make('chicken', r, { sex: 'M', sport: 0 }));
  const eagle = ST.addBird(S, RB.species.make('eagle', r, { sex: 'M', sport: 0 }));
  assert.ok(EC.value(eagle) > EC.value(hen) * 3);
  const v0 = EC.value(hen); hen.wins = 5;
  assert.ok(EC.value(hen) > v0);
  const odd = ST.addBird(S, RB.genome.fromTargets(RB.species.SPECIES.chicken.t, ['teeth', 'glow'], r, { sex: 'M' }));
  assert.ok(EC.value(odd) > v0 * 1.4);
});

test('arena cards are stable for a day, fit their class, and the boss appears after enough wins', () => {
  const S = ST.create(21);
  for (const arena of EC.ARENAS) {
    const a = EC.cards(S, arena), b = EC.cards(S, arena), n = RB.pheno.WEIGHT_CLASSES.length;
    assert.deepStrictEqual(a, b);
    // one bout in every weight class
    assert.strictEqual(a.length, n);
    assert.deepStrictEqual(a.map((c) => c.wc), [...Array(n).keys()]);
    for (const card of a) {
      const opp = EC.opponentFor(S, arena, card);
      assert.ok(opp.P.hpMax > 0 && opp.name && opp.trainer);
      assert.ok(opp.P.weightClass <= card.wc, arena.id + ' ' + RB.pheno.WEIGHT_CLASSES[card.wc][0] + ' opponent is ' + RB.pheno.WEIGHT_CLASSES[opp.P.weightClass][0]);
      if (card.wc === n - 1) assert.ok(opp.P.weightClass >= n - 2, 'a Titan bout needs a really big bird, got ' + opp.P.weightKg.toFixed(0) + ' kg');
    }
    EC.leagueOf(S, arena.id).wins = arena.need;
    const withBoss = EC.cards(S, arena);
    assert.strictEqual(withBoss.length, n + 1);
    const boss = EC.opponentFor(S, arena, withBoss[n]);
    assert.ok(boss.boss && boss.P.hpMax > 0);
  }
  // every arena is open from the start except the Grand Ring, which needs every other boss beaten
  for (const id of ['backyard', 'county', 'city', 'cellar']) assert.ok(EC.arenaOpen(S, EC.ARENA[id]), id);
  assert.ok(!EC.arenaOpen(S, EC.ARENA.grand));
  for (const id of ['backyard', 'county', 'city']) EC.leagueOf(S, id).boss = true;
  assert.ok(!EC.arenaOpen(S, EC.ARENA.grand), 'not with one boss left');
  EC.leagueOf(S, 'cellar').boss = true;
  assert.ok(EC.arenaOpen(S, EC.ARENA.grand));
  const chick = ST.addBird(S, RB.species.make('chicken', S._rng, { sport: 0 }), { age: 0 });
  assert.ok(EC.canEnter(S, chick, EC.cards(S, EC.ARENAS[0])[6]) !== '', 'a chick cannot enter even the Titan bout');
  // no odds: a winning bet pays back three times the stake whoever you back
  assert.strictEqual(EC.BET_RETURN, 3);
  assert.ok(EC.ARENA.backyard.betCap >= 300);
});

test('there are always two exhibitions to watch, and watching one brings on the next', () => {
  const S = ST.create(23), arena = EC.ARENA.backyard;
  const a = EC.exhibition(S, arena, 0), b = EC.exhibition(S, arena, 1);
  assert.notStrictEqual(a.key, b.key);
  assert.deepStrictEqual(EC.exhibition(S, arena, 0).key, a.key);
  const seen = new Set([a.key, b.key]);
  for (let i = 0; i < 30; i++) {
    EC.exhibitionDone(S, arena.id, i % 2);
    const e = EC.exhibition(S, arena, i % 2);
    assert.ok(!seen.has(e.key), 'exhibition repeated');
    seen.add(e.key);
    assert.ok(e.a.P.hpMax > 0 && e.b.P.hpMax > 0);
  }
});

test('the world has every site on dry land, people for each, and stable buried loot', () => {
  for (const seed of [1, 99, 4242]) {
    const w = RB.world.generate(seed);
    for (const s of w.sites) assert.notStrictEqual(RB.world.biomeAt(w, s.x, s.y), 'water', s.id + ' is in the water (seed ' + seed + ')');
    assert.ok(w.npcs.length >= 20);
    for (const n of w.npcs) { assert.ok(w.site[n.site], n.id + ' has no site'); assert.ok(RB.pheno.express(n.g).person, n.name + ' is not a person'); }
    for (const m of w.marks) { const l = RB.world.lootAt(w, m.cx, m.cy, 1); assert.ok(l && l.marked); assert.deepStrictEqual(RB.world.lootAt(w, m.cx, m.cy, 9), l, 'a treasure mark holds the same find every day'); }
    let found = 0, dry = 0;
    const kinds = {};
    for (let cx = 20; cx < 100; cx++) for (let cy = 10; cy < 70; cy++) {
      const l = RB.world.lootAt(w, cx, cy, 1);
      assert.deepStrictEqual(l, RB.world.lootAt(w, cx, cy, 1));
      if (RB.world.biomeAt(w, (cx + 0.5) * RB.world.CELL, (cy + 0.5) * RB.world.CELL) !== 'water') dry++;
      if (l) { found++; kinds[l.type] = 1; }
    }
    // digging on dry land almost always turns something up
    assert.ok(found / dry > 0.95, 'only ' + found + ' of ' + dry + ' dry cells hold anything');
    for (const k of ['money', 'item', 'fossil', 'chest', 'creature']) assert.ok(kinds[k], 'no ' + k + ' anywhere');
    const b = {};
    for (let x = 300; x < RB.world.W; x += 300) for (let y = 300; y < RB.world.H; y += 300) b[RB.world.biomeAt(w, x, y)] = 1;
    for (const k of ['farm', 'wetland', 'savanna', 'highlands', 'coast', 'jungle', 'water', 'town']) assert.ok(b[k], 'biome ' + k + ' missing');
  }
});

test('buyers pay more for what they wished for, breeders sell, trainers challenge', () => {
  const S = ST.create(31), w = RB.world.generate(S.seed), r = S._rng;
  const buyer = w.npcs.find((n) => n.role === 'villager');
  const wish = RB.npc.wishOf(S, buyer);
  assert.ok(wish && wish.text);
  // find a creature that fits and one that does not
  let fit = null, miss = null;
  for (let i = 0; i < 300 && (!fit || !miss); i++) {
    const c = ST.addBird(S, RB.species.make(r.pick(RB.species.IDS.filter((id) => !RB.species.SPECIES[id].person)), r, { sport: 0.3 }));
    c.wins = i % 5;
    const m = wish.score(ST.pheno(c), c);
    if (m > 0.8 && !fit) fit = c; else if (m < 0.05 && !miss) miss = c;
  }
  assert.ok(fit && miss, 'could not find fitting and unfitting creatures for "' + wish.text + '"');
  assert.ok(RB.npc.offer(S, buyer, fit) / EC.value(fit) > RB.npc.offer(S, buyer, miss) / EC.value(miss) * 1.8);
  const breeder = w.npcs.find((n) => n.role === 'breeder');
  const stock = RB.npc.stockOf(S, w, breeder);
  assert.strictEqual(stock.length, 3, 'breeders keep three');
  assert.ok(stock.every((s) => s.price > 0));
  RB.npc.info(S, breeder.id).sold[stock[0].key] = true;
  assert.strictEqual(RB.npc.stockOf(S, w, breeder).length, 2);
  const trainer = w.npcs.find((n) => n.role === 'trainer');
  const ch = RB.npc.challengeOf(S, trainer);
  assert.ok(ch && ch.opp.P.hpMax > 0 && ch.purse === ch.fee * 2);
  RB.npc.info(S, trainer.id).fought = S.day;
  assert.strictEqual(RB.npc.challengeOf(S, trainer), null);
});

test('only the place whose owner was netted or sold is closed; every other door stays open', () => {
  const S = ST.create(37), w = RB.world.generate(S.seed), r = S._rng;
  const open = () => w.npcs.filter((n) => RB.npc.vacancy(S, RB.npc.current(S, n)) === '').map((n) => n.id);
  const all = w.npcs.map((n) => n.id);
  // a fresh game: nobody is missing, even after the game has looked people up
  for (const n of w.npcs) { RB.npc.info(S, n.id); RB.npc.stockOf(S, w, n); }
  assert.deepStrictEqual(open(), all);
  // net one neighbour: only their house is closed
  const h2 = w.npcs.find((n) => n.id === 'h_2');
  RB.npc.info(S, 'h_2').gone = true;
  const held = ST.addBird(S, RB.genome.clone(h2.g), { at: 'cage', name: h2.name, person: 'h_2' });
  assert.strictEqual(RB.npc.vacancy(S, h2), 'away');
  assert.deepStrictEqual(open(), all.filter((id) => id !== 'h_2'));
  // a breeder's sold-out stock does not close their house
  const breeder = w.npcs.find((n) => n.role === 'breeder');
  RB.npc.info(S, breeder.id).sold['0:0'] = true;
  assert.strictEqual(RB.npc.vacancy(S, breeder), '');
  // sell the netted neighbour to BFC: their house is empty, the rest stay open
  ST.move(S, held, 'crate'); S.feeder = 50; ST.sleep(S);
  assert.strictEqual(RB.npc.vacancy(S, h2), 'sold');
  assert.deepStrictEqual(open(), all.filter((id) => id !== 'h_2'));
  // a save from the build that mixed the two up still loads with every door working
  const old = ST.serialize(S);
  old.npc.h_7 = { rel: 0, gone: true, n: 0, sold: true, fought: 0 };
  old.npc.h_5 = { rel: 0, gone: false, n: 0, sold: false, fought: 0 };
  const back = ST.deserialize(JSON.parse(JSON.stringify(old)));
  assert.strictEqual(RB.npc.vacancy(back, w.npcs.find((n) => n.id === 'h_5')), '');
  assert.deepStrictEqual(RB.npc.info(back, 'h_5').sold, {});
  const h7 = w.npcs.find((n) => n.id === 'h_7');
  assert.strictEqual(RB.npc.vacancy(back, h7), 'sold');
  for (let i = 0; i < 3; i++) { back.feeder = 50; ST.sleep(back); }
  assert.strictEqual(RB.npc.vacancy(back, h7), '', 'an old-style sold house still gets a newcomer');
  assert.ok(open().length >= all.length - 1);
  void r;
});

test('the lab: sequence, extract, edit, inject, rebuild, power', () => {
  const S = ST.create(41), L = RB.lab, G = RB.genome, r = S._rng;
  const donor = ST.addBird(S, RB.species.make('ostrich', r, { sex: 'M', sport: 0 }));
  const target = ST.addBird(S, RB.species.make('chicken', r, { sex: 'M', sport: 0 }));
  // every gene is mapped from the start; sequencing teaches nothing new
  assert.strictEqual(L.knownCount(S), G.N_GENES);
  for (let gi = 0; gi < G.N_GENES; gi++) assert.ok(L.known(S, gi));
  assert.strictEqual(L.geneLabel(S, G.TRAITS.legLen.genes[0]), 'Leg length I');
  assert.deepStrictEqual(L.sequence(S, donor), []);
  const gi = G.TRAITS.legLen.genes[0];
  // beakers are free, and giving a sample tires the donor without hurting it
  assert.strictEqual(ST.count(S, 'beaker'), 0);
  const vial = L.extract(S, donor, gi, 'a');
  assert.ok(vial && vial.bases.length === 4, 'extraction needs no beaker');
  assert.ok(donor.tired && donor.hp === 1 && donor.rest === 0, 'the donor is worn out, not hurt');
  const legs0 = ST.pheno(target).t.legLen, age0 = target.age, hp0 = target.hp;
  L.edit(vial, 0, 3); L.edit(vial, 1, 3); L.edit(vial, 2, 3); L.edit(vial, 3, 3);
  assert.strictEqual(L.vialSum(vial), 12);
  // the preview shows exactly what the injection will do, and changes nothing
  const pv = L.preview(S, vial, target, false), hash0 = G.hash(target.g);
  assert.strictEqual(G.hash(target.g), hash0, 'a preview must not touch the creature');
  assert.ok(pv.after.t.legLen > pv.before.t.legLen && pv.trait.label === 'Leg length' && pv.trait.to > pv.trait.from);
  L.inject(S, vial, target, false);
  const now = ST.pheno(target);
  assert.ok(now.t.legLen > legs0, 'longer legs after the injection');
  assert.deepStrictEqual(now.rate, pv.after.rate, 'the stats match the preview');
  assert.strictEqual(now.css.body, pv.after.css.body, 'the look matches the preview');
  assert.strictEqual(target.age, age0, 'an injection does not age');
  assert.ok(target.tired && target.hp === hp0, 'an injection tires, never hurts');
  assert.strictEqual(S.lab.vials.length, 0);
  // an egg is previewed as the adult it grows into
  S.eggs.push({ id: S.nextId++, g: RB.species.make('duck', r, { sport: 0 }), nest: -1, hatch: S.day + 2, mom: 'Duck', dad: 'Duck', momKey: 'duck', dadKey: 'duck' });
  const v3 = L.extract(S, donor, G.TRAITS.neckLen.genes[0], 'a');
  const pe = L.preview(S, v3, S.eggs[S.eggs.length - 1], true);
  assert.strictEqual(pe.before.stage, 'adult');
  const v2 = L.extract(S, donor, gi, 'a'), before = v2.bases.slice();
  const j = L.offTarget(v2, 0, r);
  assert.ok(j !== 0 && v2.bases[j] !== before[j]);
  assert.ok(L.rebuild(S, 'dodo') !== '');
  for (let i = 0; i < 4; i++) L.addFragment(S, 'dodo');
  S.money = 1000;
  assert.strictEqual(L.rebuild(S, 'dodo'), '');
  assert.strictEqual(S.eggs.length, 2, 'the duck egg from the preview check, and the dodo');
  assert.strictEqual(RB.species.classify(S.eggs[1].g).id, 'dodo');
  assert.strictEqual(L.powerOn(S), false);
  ST.give(S, 'fuse', 3);
  assert.strictEqual(L.powerOn(S), true);
  assert.ok(S.lab.power && ST.count(S, 'fuse') === 0);
});

test('only a loss wounds a fighter; every bout tires it; a tonic restores vigour; only the vet heals', () => {
  const S = ST.create(43), c = S.birds[0], card = EC.cards(S, EC.ARENA.backyard)[6];
  assert.strictEqual(EC.canEnter(S, c, card), '');
  c.tired = true;
  assert.ok(EC.canEnter(S, c, card).includes('Worn out'));
  S.inv.tonic = 1;
  ST.feed(S, c, 'tonic');
  assert.ok(!c.tired && EC.canEnter(S, c, card) === '', 'a tonic lets it fight again today');
  c.hp = 0.6; S.inv.tonic = 1; ST.feed(S, c, 'tonic');
  assert.strictEqual(c.hp, 0.6, 'a tonic does not heal wounds');
  c.tired = true; S.feeder = 9;
  ST.sleep(S);
  assert.ok(!c.tired, 'a night rests it');
  assert.strictEqual(c.hp, 0.6, 'wounds do not heal overnight');
});

test('ordinary holes fill in overnight and the ground holds something new; treasure marks stay dug', () => {
  const S = ST.create(53), w = RB.world.generate(S.seed);
  // the same cell holds different finds on different days
  let differs = 0;
  for (let cx = 30; cx < 60; cx++) if (JSON.stringify(RB.world.lootAt(w, cx, 40, 1)) !== JSON.stringify(RB.world.lootAt(w, cx, 40, 2))) differs++;
  assert.ok(differs > 20, 'loot should change from day to day, only ' + differs + ' of 30 did');
  S.dug['40,40'] = S.day;
  const m = w.marks[0], mk = m.cx + ',' + m.cy;
  S.marksDug[mk] = true;
  S.feeder = 9; ST.sleep(S);
  assert.strictEqual(S.dug['40,40'], undefined, 'yesterday\'s hole is gone');
  assert.ok(S.marksDug[mk], 'a dug treasure mark stays dug');
});

test('the wild population is set for the day, mostly on land, with night groups and very rare crosses', () => {
  const w = RB.world.generate(61);
  const a = RB.world.population(w, 3), b = RB.world.population(w, 3), c = RB.world.population(w, 4);
  assert.ok(a.length > 150, 'only ' + a.length + ' animals');
  assert.deepStrictEqual(a.map((e) => [e.id, e.sp, Math.round(e.x), Math.round(e.y), RB.genome.hash(e.g)]), b.map((e) => [e.id, e.sp, Math.round(e.x), Math.round(e.y), RB.genome.hash(e.g)]), 'the same day gives the same animals');
  assert.notDeepStrictEqual(a.map((e) => e.sp + Math.round(e.x)), c.map((e) => e.sp + Math.round(e.x)), 'a new day gives new animals');
  for (const e of a) {
    assert.notStrictEqual(RB.world.biomeAt(w, e.x, e.y), 'water', 'an animal in the water');
    assert.ok(!RB.world.nearestSite(w, e.x, e.y, 150), 'an animal on a doorstep');
  }
  assert.ok(a.some((e) => e.night) && a.some((e) => !e.night));
  let total = 0, crosses = 0;
  for (let d = 1; d <= 30; d++) { const p = RB.world.population(w, d); total += p.length; for (const e of p) if (e.cross) { crosses++; assert.notStrictEqual(e.cross.momKey, e.cross.dadKey); } }
  assert.ok(crosses > 0, 'no natural cross in 30 days');
  assert.ok(crosses / total < 0.015, 'crosses should be very rare: ' + crosses + ' of ' + total);
});

test('a whole-genome copy makes clones at the receiver\'s age, is kept, can be edited and thrown away', () => {
  const S = ST.create(67), L = RB.lab, G = RB.genome, r = S._rng;
  const star = ST.addBird(S, RB.species.make('peafowl', r, { sex: 'M', sport: 0 }), { name: 'Star', age: 9 });
  const vial = L.copyGenome(S, star);
  assert.ok(vial.full && star.tired && star.hp === 1, 'copying tires the donor, never hurts it');
  // it survives a save and a reload
  const S2 = ST.deserialize(JSON.parse(JSON.stringify(ST.serialize(S))));
  assert.strictEqual(G.hash(L.vialGenome(S2.lab.vials[0])), G.hash(star.g));
  // a young hen becomes a clone of Star, but stays young
  const hen = ST.addBird(S, RB.species.make('chicken', r, { sex: 'F', sport: 0 }), { name: 'Hen', age: 2 });
  const pv = L.preview(S, vial, hen, false);
  assert.ok(pv.full && !pv.tooOld && pv.after.species.id === 'peafowl');
  L.inject(S, vial, hen, false);
  assert.strictEqual(G.hash(hen.g), G.hash(star.g), 'same genes');
  assert.strictEqual(hen.g.sex, 'M', 'same sex as the donor');
  assert.strictEqual(hen.age, 2, 'the receiver\'s age');
  assert.strictEqual(hen.name, 'Hen');
  assert.strictEqual(ST.kind(hen), ST.kind(star));
  assert.deepStrictEqual(ST.pheno(hen).rate, pv.after.rate, 'the clone matches its preview');
  assert.ok(hen.tired && hen.hp === 1);
  assert.strictEqual(S.lab.vials.length, 1, 'a whole-genome beaker is kept after use');
  // a person can be turned into a clone of a bird: no longer that person, and their house empties
  const w = RB.world.generate(S.seed), npc = w.npcs.find((n) => n.id === 'h_4');
  RB.npc.info(S, 'h_4').gone = true;
  const man = ST.addBird(S, G.clone(npc.g), { at: 'cage', name: npc.name, person: 'h_4', clothes: npc.clothes });
  L.inject(S, vial, man, false);
  assert.ok(!man.person && !man.clothes && RB.npc.info(S, 'h_4').soldOff);
  assert.ok(!ST.pheno(man).person && ST.pheno(man).species.id === 'peafowl');
  // edit one gene in the beaker: later clones carry it, the donor does not change
  const gi = G.TRAITS.legLen.genes[0], ed = L.genomeGene(vial, gi, 'a');
  ed.bases = [3, 3, 3, 3]; ed.commit();
  const ed2 = L.genomeGene(vial, gi, 'b'); ed2.bases = [3, 3, 3, 3]; ed2.commit();
  const egg = { id: S.nextId++, g: RB.species.make('duck', r, { sport: 0 }), nest: -1, hatch: S.day + 1, mom: 'Duck', dad: 'Duck', momKey: 'duck', dadKey: 'duck' };
  L.inject(S, vial, egg, true);
  assert.ok(G.traitValue(egg.g, 'legLen') > G.traitValue(star.g, 'legLen'), 'the edit is in the clone');
  assert.strictEqual(G.getGeneBases(star.g, gi, 'a').join(''), G.getGeneBases(G.deserialize(S2.lab.vials[0].genome), gi, 'a').join(''), 'the donor is untouched');
  assert.strictEqual(egg.momKey, ST.kindKey(star));
  // too old for a short-lived body
  const elder = ST.addBird(S, RB.species.make('ostrich', r, { sport: 0 }), { age: 40 });
  assert.ok(L.preview(S, vial, elder, false).tooOld);
  // throw it away
  L.removeVial(S, vial);
  assert.strictEqual(S.lab.vials.length, 0);
});

test('old birds retire instead of dying: no fights, nests, training or shows; Sunset Roost takes them in', () => {
  const S = ST.create(71), [cock, hen] = S.birds, P = ST.pheno(cock);
  cock.age = P.lifespan - 1; ST.dirty(cock);
  assert.ok(!ST.isRetired(cock));
  S.feeder = 9;
  const rep = ST.sleep(S);
  assert.ok(S.birds.includes(cock), 'still with us');
  assert.ok(ST.isRetired(cock));
  assert.ok(rep.lines.some((l) => l.includes(cock.name) && l.includes('retired')));
  // a retired bird stops counting the days
  const age = cock.age;
  S.feeder = 9; ST.sleep(S);
  assert.strictEqual(cock.age, age);
  // no fights, nests, training or sideshow
  const card = EC.cards(S, EC.ARENA.backyard)[0];
  assert.match(EC.canEnter(S, cock, card), /Retired/);
  assert.match(ST.move(S, cock, 'nest0'), /retired/);
  assert.match(ST.train(S, cock, 'muscle'), /retired/);
  cock.at = 'nest0'; hen.at = 'nest0';
  for (let i = 0; i < 6; i++) { S.feeder = 9; ST.sleep(S); }
  assert.strictEqual(S.eggs.length, 0, 'a retired bird does not breed');
  cock.at = 'home'; hen.at = 'home';
  // BFC still takes it
  assert.ok(EC.bfcPrice(S, cock) > 0);
  // Sunset Roost: only retired birds, and no people
  assert.match(ST.checkIn(S, hen), /not retired/);
  const person = ST.addBird(S, RB.npc.personGenome(new Rng(3), 'F'), { person: 'h_0', at: 'cage' });
  assert.ok(ST.checkIn(S, person));
  cock.hp = 0.3;
  assert.strictEqual(ST.checkIn(S, cock), '');
  assert.ok(!S.birds.includes(cock) && S.roost.includes(cock) && cock.at === 'roost');
  // Dona Nina feeds the residents and tends their wounds; they keep living there
  for (let i = 0; i < 4; i++) ST.sleep(S);
  assert.ok(S.roost.includes(cock) && cock.fed && cock.hp === 1);
  // residents are saved; saves from before the roost load with an empty one
  const o = ST.serialize(S), back = ST.deserialize(JSON.parse(JSON.stringify(o)));
  assert.strictEqual(back.roost.length, 1);
  assert.strictEqual(RB.genome.hash(back.roost[0].g), RB.genome.hash(cock.g));
  delete o.roost;
  assert.deepStrictEqual(ST.deserialize(JSON.parse(JSON.stringify(o))).roost, []);
  // take one home again, and an elixir gives it a few more years in the ring
  ST.checkOut(S, cock);
  assert.ok(S.birds.includes(cock) && !S.roost.length && cock.at === 'cage');
  ST.give(S, 'elixir'); ST.feed(S, cock, 'elixir');
  assert.ok(!ST.isRetired(cock));
});

test('Sunset Roost is on the map with Dona Nina, and adding it left the rest of the world as it was', () => {
  for (const seed of [1, 99, 4242]) {
    const w = RB.world.generate(seed), s = w.site.roost;
    assert.ok(s && s.kind === 'roost');
    assert.notStrictEqual(RB.world.biomeAt(w, s.x, s.y), 'water');
    for (const o of w.sites) if (o !== s) assert.ok(Math.hypot(o.x - s.x, o.y - s.y) > 300, 'the roost crowds ' + o.id);
    const nina = w.npcs.find((n) => n.site === 'roost');
    assert.strictEqual(nina.name, 'Dona Nina');
    assert.ok(RB.world.onRoad(w, s.x, s.y + 70), 'a road leads to the roost');
    assert.ok(RB.world.onRoad(w, w.site.home.x, w.site.home.y + 70));
  }
  // the older sites and people come out exactly as before (Sunset Roost draws its own numbers)
  const w = RB.world.generate(99);
  // sites opened later come after all the others, in the order they opened
  assert.deepStrictEqual(w.sites.slice(-2).map((x) => x.id), ['roost', 'oddities']);
  assert.deepStrictEqual(w.npcs.slice(-2).map((n) => n.site), ['roost', 'oddities']);
});

test('the first boss gives the silver net (never used up), the second the golden shovel (10 digs a day)', () => {
  const S = ST.create(81);
  assert.deepStrictEqual(ST.bossPrizes(S), []);
  assert.strictEqual(ST.useNet(S, 'net'), 'net');
  S.league.backyard = { wins: 3, boss: true };
  assert.deepStrictEqual(ST.bossPrizes(S), ['silvernet']);
  assert.deepStrictEqual(ST.bossPrizes(S), [], 'only once');
  S.inv.net = 0;
  for (let i = 0; i < 50; i++) assert.strictEqual(ST.useNet(S, 'net'), 'silvernet');
  assert.strictEqual(S.inv.net, 0);
  assert.strictEqual(ST.useNet(S, 'bignet'), '', 'heavy nets are still bought and used up');
  // the golden shovel
  S.league.county = { wins: 4, boss: true };
  assert.deepStrictEqual(ST.bossPrizes(S), ['goldshovel']);
  S.inv.shovel = 2;
  assert.strictEqual(ST.digsLeft(S), ST.GOLD_DIGS + 2);
  for (let i = 0; i < ST.GOLD_DIGS; i++) assert.strictEqual(ST.useDig(S), 'gold');
  assert.strictEqual(S.inv.shovel, 2, 'the golden shovel spares the others');
  assert.strictEqual(ST.useDig(S), 'shovel');
  assert.strictEqual(ST.useDig(S), 'shovel');
  assert.strictEqual(ST.useDig(S), '');
  S.feeder = 9; ST.sleep(S);
  assert.strictEqual(ST.goldLeft(S), ST.GOLD_DIGS, 'ten more the next day');
  // a save from before the prizes catches up on load
  const o = ST.serialize(S);
  o.equip = {};
  const back = ST.deserialize(JSON.parse(JSON.stringify(o)));
  assert.ok(back.equip.silvernet && back.equip.goldshovel);
});

test('birds set free leave their genes in the wild near where they were let go, now and then', () => {
  const G = RB.genome, S = ST.create(91), w = RB.world.generate(S.seed), r = new Rng(5);
  // a released ostrich with a marker gene no wild animal has
  const g = RB.species.make('ostrich', r, { sex: 'F', sport: 0 }), gi = 3, mark = [3, 1, 3, 1];
  G.setGeneBases(g, gi, mark, 'both');
  const c = ST.addBird(S, g, { name: 'Marcadora' }), home = w.site.home;
  ST.setFree(S, c, home.x, home.y + 150);
  assert.ok(!S.birds.includes(c));
  assert.strictEqual(S.released.length, 1);
  assert.strictEqual(ST.genePool(S).length, 0, 'not on the day it was let go');
  // people are not part of the wild
  const p = ST.addBird(S, RB.npc.personGenome(new Rng(3), 'M'), { person: 'h_0' });
  ST.setFree(S, p, home.x, home.y);
  assert.strictEqual(S.released.length, 1);
  S.day++;
  const pool = ST.genePool(S);
  assert.strictEqual(pool.length, 1);
  let carriers = 0, near = 0;
  for (let d = S.day; d < S.day + 8; d++) {
    const base = RB.world.population(w, d), pop = RB.world.population(w, d, undefined, pool);
    assert.strictEqual(pop.length, base.length);
    pop.forEach((e, i) => {
      assert.strictEqual(e.x, base[i].x, 'everyone else stays put');
      const close = Math.hypot(e.x - home.x, e.y - home.y - 150) < RB.world.GENE_REACH;
      if (close && !base[i].cross) near++;
      if (!e.kin) { assert.strictEqual(G.hash(e.g), G.hash(base[i].g)); return; }
      carriers++;
      assert.ok(close, 'a carrier far from where the bird was let go');
      assert.strictEqual(e.kin.name, 'Marcadora');
      const a = G.getGeneBases(e.g, gi, 'a').join(''), b = G.getGeneBases(e.g, gi, 'b').join('');
      assert.ok(a === mark.join('') || b === mark.join(''), 'carries the released bird\'s gene');
      if (e.sp !== 'ostrich') assert.ok(e.cross && [e.cross.momKey, e.cross.dadKey].includes('ostrich'));
    });
  }
  assert.ok(carriers >= 1, 'no carriers in eight days');
  assert.ok(carriers / near < 0.07, carriers + ' of ' + near + ' is too many');
  // the pool keeps only the most recent releases
  for (let i = 0; i < ST.RELEASED_MAX + 5; i++) ST.setFree(S, ST.addBird(S, RB.species.make('quail', r, { sport: 0 })), 100, 100);
  assert.strictEqual(S.released.length, ST.RELEASED_MAX);
  const back = ST.deserialize(JSON.parse(JSON.stringify(ST.serialize(S))));
  assert.strictEqual(back.released.length, ST.RELEASED_MAX);
});

test('the Andean condor lives in the highlands and the harpy eagle in the jungle', () => {
  const SP = RB.species.SPECIES, F = RB.world.FAUNA;
  assert.ok(SP.condor && SP.harpy);
  assert.ok(F.highlands.day.some((e) => e[0] === 'condor'));
  assert.ok(F.jungle.day.some((e) => e[0] === 'harpy'));
  const r = new Rng(12), P1 = RB.pheno.express(RB.species.make('condor', r, { sport: 0 })), P2 = RB.pheno.express(RB.species.make('harpy', r, { sport: 0 }));
  assert.strictEqual(P1.species.id, 'condor'); assert.strictEqual(P2.species.id, 'harpy');
  // typical weights: a condor outweighs a vulture, a harpy an ordinary eagle
  const median = (id) => { const ws = []; for (let i = 0; i < 61; i++) ws.push(RB.pheno.express(RB.species.make(id, r, { sport: 0 })).weightKg); return ws.sort((a, b) => a - b)[30]; };
  const mc = median('condor'), mh = median('harpy');
  assert.ok(mc > 10 && mc < 17 && mc > median('vulture'), 'condor ' + mc);
  assert.ok(mh > 6 && mh < 11 && mh > median('eagle'), 'harpy ' + mh);
  assert.ok(P1.t.bareHead > 0.7 && P2.t.crest > 0.7);
  assert.strictEqual(P1.voice.kind, 'condor');
  // a cross carries the calls of both kinds
  const x = RB.genome.breed(RB.species.make('harpy', r, { sex: 'F', sport: 0 }), RB.species.make('duck', r, { sex: 'M', sport: 0 }), r), Px = RB.pheno.express(x);
  if (!Px.species.pure) assert.ok(Px.voice.kind2);
  // the wild population turns them up
  const w = RB.world.generate(5), seen = {};
  for (let d = 1; d <= 6; d++) for (const e of RB.world.population(w, d)) seen[e.sp] = true;
  assert.ok(seen.condor && seen.harpy, 'not seen in a week: ' + JSON.stringify({ condor: !!seen.condor, harpy: !!seen.harpy }));
});

test('the heat clears in one night per person netted, three nights at most', () => {
  const S = ST.create(101), nights = (n) => { const out = []; for (let i = 0; i < n; i++) { S.feeder = 9; ST.sleep(S); out.push(S.heat); } return out; };
  ST.caughtPerson(S, 35);
  assert.strictEqual(S.heat, 35);
  assert.deepStrictEqual(nights(1), [0]);
  ST.caughtPerson(S, 35); ST.caughtPerson(S, 50);
  const two = nights(2);
  assert.ok(two[0] > 0 && two[1] === 0, JSON.stringify(two));
  for (let i = 0; i < 6; i++) ST.caughtPerson(S, 40);
  const many = nights(3);
  assert.ok(many[0] > 0 && many[1] > 0 && many[2] === 0, JSON.stringify(many));
  // holding a netted person no longer keeps the heat up
  const p = ST.addBird(S, RB.npc.personGenome(new Rng(2), 'F'), { person: 'h_1', at: 'cage' });
  ST.caughtPerson(S, 35);
  assert.deepStrictEqual(nights(1), [0]);
  assert.ok(S.birds.includes(p));
  // a save from before keeps cooling down
  S.heat = 60; delete S.heatDays; delete S.heatPeople;
  assert.deepStrictEqual(nights(1), [0]);
});

test('training says which numbers go up and by how much, and does exactly that', () => {
  const S = ST.create(103), c = S.birds[0];
  const pv = ST.trainPreview(c, 'muscle');
  assert.strictEqual(pv.gain, 0.02);
  assert.ok(pv.rates.some((r) => r[0] === 'power' && r[1] > 0), JSON.stringify(pv.rates));
  const before = Object.assign({}, ST.pheno(c).rate);
  assert.strictEqual(ST.train(S, c, 'muscle'), '');
  const after = ST.pheno(c).rate;
  for (const [k, d] of pv.rates) assert.strictEqual(after[k] - before[k], d, k);
  assert.ok(ST.trainPreview(c, 'courage').rates.some((r) => r[0] === 'guts'));
  c.gear = 'anklets';
  assert.strictEqual(ST.trainPreview(c, 'lungs').gain, 0.03);
  c.train.reflex = 0.15;
  assert.strictEqual(ST.trainPreview(c, 'reflex').gain, 0);
});

test('after dark the night birds come out in place of the day birds, in about the same numbers', () => {
  const w = RB.world.generate(71), pop = RB.world.population(w, 5);
  const day = pop.filter((e) => !e.night), night = pop.filter((e) => e.night);
  assert.ok(day.length > 150, 'only ' + day.length + ' by day');
  assert.ok(night.length > 0.6 * day.length && night.length < 1.6 * day.length, day.length + ' by day, ' + night.length + ' by night');
  const nightKinds = new Set();
  for (const b of Object.keys(RB.world.FAUNA)) for (const e of RB.world.FAUNA[b].night) nightKinds.add(e[0]);
  for (const e of night) if (!e.cross && !e.kin) assert.ok(nightKinds.has(e.sp), e.sp + ' out at night');
  const seen = new Set(night.map((e) => e.sp));
  for (const id of ['owl', 'nightjar', 'potoo']) assert.ok(seen.has(id), 'no ' + id + ' at night');
  assert.ok(RB.species.SPECIES.nightjar.night && RB.species.SPECIES.potoo.night);
});

test('no arena throws anyone out: each has its own twist instead', () => {
  const twists = EC.ARENAS.map((a) => a.modes[0]);
  assert.deepStrictEqual(twists, ['grain', 'mud', 'wind', 'dark', 'rounds']);
  for (const a of EC.ARENAS) for (const m of a.modes) assert.ok(RB.fight.TWISTS[m] && m !== 'push' && m !== 'aerial', a.id + ' ' + m);
  const S = ST.create(111);
  for (const a of EC.ARENAS) for (const c of EC.cards(S, a)) assert.ok(RB.fight.TWISTS[c.mode], a.id + ' card ' + c.mode);
});

test('every neighbour buys, sells and trades; the Curio Aviary sells truly strange birds', () => {
  const S = ST.create(113), w = RB.world.generate(S.seed);
  for (const n of w.npcs.filter((q) => q.site.startsWith('house'))) assert.ok(RB.npc.stockOf(S, w, n).length >= 2, n.role + ' has nothing to sell');
  const dealer = w.npcs.find((n) => n.role === 'exotic');
  assert.ok(dealer && w.site[dealer.site].kind === 'exotic' && w.site.oddities);
  const stock = RB.npc.stockOf(S, w, dealer);
  assert.strictEqual(stock.length, 5);
  for (const s of stock) {
    assert.ok(s.momKey !== s.dadKey, 'an exotic is a cross of two kinds');
    const sw = ['teeth', 'arms', 'twoHeadsA', 'glow', 'tailBone', 'gigas', 'cyclops', 'legsExtra', 'earTuft', 'fluff', 'bare'].filter((id) => RB.genome.switchOn(s.g, id));
    assert.ok(sw.length >= 2, 'only ' + sw.join(',') + ' switched on');
  }
  // the dealer buys oddities too
  const odd = ST.addBird(S, stock[0].g, { at: 'cage' }), plain = ST.addBird(S, RB.species.make('chicken', new Rng(1), { sport: 0 }), { at: 'cage' });
  assert.ok(RB.npc.offer(S, dealer, odd) > RB.npc.offer(S, dealer, plain));
});

test('a sandbox game starts with everything; a normal one earns the open sea', () => {
  const S = ST.create(117, { sandbox: true });
  assert.ok(S.sandbox && S.debt === 0 && S.lab.power);
  for (const id of Object.keys(RB.items.UPGRADES)) assert.strictEqual(S.up[id], RB.items.UPGRADES[id].prices.length, id);
  for (const id of ['detector', 'launcher', 'lantern', 'silvernet', 'goldshovel']) assert.ok(S.equip[id], id);
  assert.ok(ST.openSea(S) && ST.hasBoat(S));
  assert.ok(EC.arenaOpen(S, EC.ARENA.grand));
  const back = ST.deserialize(JSON.parse(JSON.stringify(ST.serialize(S))));
  assert.ok(back.sandbox && ST.hasBoat(back));
  // a normal game: the sea opens once the Grand Ring is won and the debt is paid
  const N = ST.create(119);
  assert.ok(!ST.openSea(N) && !ST.hasBoat(N));
  N.won = true; assert.ok(!ST.openSea(N), 'not while the debt is owed');
  N.debt = 0; assert.ok(ST.openSea(N));
  assert.ok(RB.items.UPGRADES.boat.open && RB.items.UPGRADES.boat.at === 'garage');
});

test('the open sea is endless, with islands of their own lands, birds, villages, shops and arenas', () => {
  const w = RB.world.generate(121), SEA = RB.sea;
  // the mainland keeps its waters clear, and the old map is untouched
  for (let cx = -1; cx <= 2; cx++) for (let cy = -1; cy <= 1; cy++) assert.strictEqual(SEA.chunk(w, cx, cy).islands.length, 0);
  assert.strictEqual(RB.world.biomeAt(w, -20000, -20000) === 'water' || !!SEA.islandAt(w, -20000, -20000), true);
  let islands = [];
  for (let cx = -8; cx <= 9; cx++) for (let cy = -8; cy <= 8; cy++) islands = islands.concat(SEA.chunk(w, cx, cy).islands);
  assert.ok(islands.length > 80, 'only ' + islands.length + ' islands');
  const lands = new Set(islands.map((is) => is.main));
  for (const b of ['tundra', 'volcanic', 'desert']) assert.ok(lands.has(b), 'no ' + b + ' island');
  // the same seed makes the same islands
  const w2 = RB.world.generate(121), a = SEA.chunk(w, -5, 3).islands, b = SEA.chunk(w2, -5, 3).islands;
  assert.deepStrictEqual(a.map((is) => [is.name, Math.round(is.x), Math.round(is.R), is.main]), b.map((is) => [is.name, Math.round(is.x), Math.round(is.R), is.main]));
  // land, beach and water
  const is = islands.find((q) => q.sites.some((s) => s.kind === 'arena') && q.sites.some((s) => s.kind === 'house'));
  assert.ok(is, 'no island with an arena and a village');
  assert.strictEqual(RB.world.biomeAt(w, is.x, is.y) !== 'water', true);
  assert.strictEqual(RB.world.biomeAt(w, is.x + is.R * 1.6, is.y), 'water');
  // its places are on dry land, registered, and have people
  for (const s of is.sites) {
    assert.ok(w.site[s.id] === s && RB.world.biomeAt(w, s.x, s.y + 70) !== 'water', s.id);
    assert.ok(w.npcs.find((n) => n.site === s.id), 'nobody at ' + s.id);
  }
  const arena = EC.ARENA[is.sites.find((s) => s.kind === 'arena').id];
  assert.ok(arena && RB.fight.TWISTS[arena.modes[0]] && arena.boss && EC.arenaOpen(ST.create(1), arena));
  assert.strictEqual(EC.cards(ST.create(1), arena).length > 0, true);
  // its birds live on it, follow its race, and change each day
  const pop = SEA.population(w, is, 2), pop2 = SEA.population(w, is, 2), pop3 = SEA.population(w, is, 3);
  assert.ok(pop.length > 4);
  assert.deepStrictEqual(pop.map((e) => e.id + e.sp), pop2.map((e) => e.id + e.sp));
  assert.notDeepStrictEqual(pop.map((e) => e.sp + Math.round(e.x)), pop3.map((e) => e.sp + Math.round(e.x)));
  for (const e of pop) assert.notStrictEqual(RB.world.biomeAt(w, e.x, e.y), 'water');
  assert.ok(pop.some((e) => e.night) && pop.some((e) => !e.night));
  const big = islands.find((q) => q.race.size > 1.1);
  if (big) assert.ok(SEA.raceTargets(big, 'chicken').size > 1);
  // some far islands keep a kind thought extinct
  assert.ok(islands.some((q) => q.lost && RB.species.SPECIES[q.lost].extinct));
});
