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

test('moving creatures respects the cage, the nest and what BFC accepts', () => {
  const S = ST.create(9);
  const r = S._rng;
  const extra = [0, 1, 2].map(() => ST.addBird(S, RB.species.make('duck', r, { sex: 'M', sport: 0 })));
  assert.strictEqual(ST.move(S, S.birds[0], 'cage'), '');
  assert.strictEqual(ST.move(S, S.birds[1], 'cage'), '');
  assert.ok(ST.move(S, extra[0], 'cage').includes('full'));
  assert.strictEqual(ST.move(S, extra[0], 'nest0'), '');
  assert.ok(ST.move(S, extra[1], 'nest0').includes('male and a female'));
  const person = ST.addBird(S, RB.npc.personGenome(r, 'M'), { name: 'Juca', person: 'h_0' });
  assert.ok(ST.pheno(person).person);
  assert.ok(ST.move(S, person, 'crate').includes('only takes birds'));
  assert.ok(ST.move(S, person, 'nest0') !== '');
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
  assert.strictEqual(EC.bfcPrice(S, person), 0);
  // the pick-up box sells at night and stamps the card
  ST.move(S, quail, 'crate');
  const money = S.money;
  S.feeder = 20; ST.sleep(S);
  assert.ok(S.money > money && !S.birds.includes(quail) && S.bfc.stamps === 1);
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
    const a = EC.cards(S, arena), b = EC.cards(S, arena);
    assert.deepStrictEqual(a, b);
    assert.strictEqual(a.length, 3);
    for (const card of a) {
      const opp = EC.opponentFor(S, arena, card);
      assert.ok(opp.P.hpMax > 0 && opp.name && opp.trainer);
      if (!card.open) assert.ok(opp.P.weightClass <= card.wc + 1, arena.id + ' opponent far too heavy');
    }
    EC.leagueOf(S, arena.id).wins = arena.need;
    const withBoss = EC.cards(S, arena);
    assert.strictEqual(withBoss.length, 4);
    const boss = EC.opponentFor(S, arena, withBoss[3]);
    assert.ok(boss.boss && boss.P.hpMax > 0);
  }
  assert.ok(EC.arenaOpen(S, EC.ARENA.backyard));
  assert.ok(!EC.arenaOpen(S, EC.ARENA.county));
  EC.leagueOf(S, 'backyard').boss = true;
  assert.ok(EC.arenaOpen(S, EC.ARENA.county));
  const chick = ST.addBird(S, RB.species.make('chicken', S._rng, { sport: 0 }), { age: 0 });
  assert.ok(EC.canEnter(S, chick, EC.cards(S, EC.ARENAS[0])[0]) !== '');
  assert.ok(EC.odds(0.5) > 0.8 && EC.odds(0.5) < 1 && EC.odds(0.9) < EC.odds(0.2));
});

test('the world has every site on dry land, people for each, and stable buried loot', () => {
  for (const seed of [1, 99, 4242]) {
    const w = RB.world.generate(seed);
    for (const s of w.sites) assert.notStrictEqual(RB.world.biomeAt(w, s.x, s.y), 'water', s.id + ' is in the water (seed ' + seed + ')');
    assert.ok(w.npcs.length >= 20);
    for (const n of w.npcs) { assert.ok(w.site[n.site], n.id + ' has no site'); assert.ok(RB.pheno.express(n.g).person, n.name + ' is not a person'); }
    for (const m of w.marks) { const l = RB.world.lootAt(w, m.cx, m.cy); assert.ok(l && l.marked); }
    let found = 0;
    const kinds = {};
    for (let cx = 20; cx < 100; cx++) for (let cy = 10; cy < 70; cy++) {
      const l = RB.world.lootAt(w, cx, cy);
      assert.deepStrictEqual(l, RB.world.lootAt(w, cx, cy));
      if (l) { found++; kinds[l.type] = 1; }
    }
    assert.ok(found > 800 && found < 2400, 'loot density ' + found);
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
  assert.strictEqual(stock.length, 2);
  assert.ok(stock.every((s) => s.price > 0));
  RB.npc.info(S, breeder.id).sold[stock[0].key] = true;
  assert.strictEqual(RB.npc.stockOf(S, w, breeder).length, 1);
  const trainer = w.npcs.find((n) => n.role === 'trainer');
  const ch = RB.npc.challengeOf(S, trainer);
  assert.ok(ch && ch.opp.P.hpMax > 0 && ch.purse === ch.fee * 2);
  RB.npc.info(S, trainer.id).fought = S.day;
  assert.strictEqual(RB.npc.challengeOf(S, trainer), null);
});

test('the lab: sequence, extract, edit, inject, rebuild, power', () => {
  const S = ST.create(41), L = RB.lab, G = RB.genome, r = S._rng;
  const donor = ST.addBird(S, RB.species.make('ostrich', r, { sex: 'M', sport: 0 }));
  const target = ST.addBird(S, RB.species.make('chicken', r, { sex: 'M', sport: 0 }));
  const learned = L.sequence(S, donor);
  assert.ok(learned.length >= 5);
  assert.strictEqual(L.sequence(S, donor).length, 0, 'a second read teaches nothing');
  assert.strictEqual(L.knownCount(S), learned.length);
  const gi = G.TRAITS.legLen.genes[0];
  assert.strictEqual(typeof L.extract(S, donor, gi, 'a'), 'string', 'no beaker, no extraction');
  ST.give(S, 'beaker', 2);
  const vial = L.extract(S, donor, gi, 'a');
  assert.ok(vial.bases.length === 4 && donor.rest >= 1 && donor.hp < 1);
  const legs0 = ST.pheno(target).t.legLen, age0 = target.age;
  L.edit(vial, 0, 3); L.edit(vial, 1, 3); L.edit(vial, 2, 3); L.edit(vial, 3, 3);
  assert.strictEqual(L.vialSum(vial), 12);
  L.inject(S, vial, target, false);
  assert.ok(ST.pheno(target).t.legLen > legs0, 'longer legs after the injection');
  assert.strictEqual(target.age, age0 + 1);
  assert.strictEqual(S.lab.vials.length, 0);
  const v2 = L.extract(S, donor, gi, 'a'), before = v2.bases.slice();
  const j = L.offTarget(v2, 0, r);
  assert.ok(j !== 0 && v2.bases[j] !== before[j]);
  assert.ok(L.rebuild(S, 'dodo') !== '');
  for (let i = 0; i < 4; i++) L.addFragment(S, 'dodo');
  S.money = 1000;
  assert.strictEqual(L.rebuild(S, 'dodo'), '');
  assert.strictEqual(S.eggs.length, 1);
  assert.strictEqual(RB.species.classify(S.eggs[0].g).id, 'dodo');
  assert.strictEqual(L.powerOn(S), false);
  ST.give(S, 'fuse', 3);
  assert.strictEqual(L.powerOn(S), true);
  assert.ok(S.lab.power && ST.count(S, 'fuse') === 0);
});
