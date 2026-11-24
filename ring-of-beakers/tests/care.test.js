'use strict';
// Looking after birds: eternal vigor and retirement, training, the numbers on the card, families,
// the sandbox editor, the BFC island contract, the lab's fees and the Bird town feat.
const test = require('node:test');
const assert = require('node:assert');
const RB = require('./load.js');
const { Rng } = RB.core;
const ST = RB.state;

const bird = (S, id, o) => ST.addBird(S, RB.species.make(id, new Rng((o && o.seed) || 3), { sport: 0 }), Object.assign({ at: 'home' }, o || {}));
const retiredLines = (lines, name) => lines.filter((l) => l.includes(name) && /has retired/.test(l)).length;

test('a bird on eternal vigor retires once at most: no new retirement every morning, in the report or its story', () => {
  for (const sandbox of [false, true]) {
    const S = ST.create(4, { sandbox }); S.inv.vigor = 1;
    const c = bird(S, 'gamecock', { name: 'Velho' }); c.wins = 12;
    c.age = ST.pheno(c).lifespan - 1; c._P = null;
    assert.ok(ST.feed(S, c, 'vigor'));
    let said = 0;
    for (let d = 0; d < 6; d++) { c.fed = true; said += retiredLines([].concat(ST.sleep(S).lines || []), 'Velho'); }
    const notes = (c.log || []).filter((n) => /^retired after/.test(n.t)).length;
    if (sandbox) { assert.strictEqual(said, 0, 'a sandbox eternal never retires'); assert.strictEqual(notes, 0); assert.ok(!ST.isRetired(c) && c.age > ST.pheno(c).lifespan); }
    else { assert.strictEqual(said, 1, 'retires once'); assert.strictEqual(notes, 1); assert.ok(ST.isRetired(c)); }
  }
  // a save from before the fix drops the repeated retirements (in the bird's story and in the Hall's)
  const S = ST.create(5, { sandbox: true }), c = bird(S, 'chicken', { name: 'Eterna' });
  c.eternal = 2; c.log = [{ d: 2, t: 'drank the tonic of eternal vigor' }, { d: 3, t: 'retired after 16 days, with 0 wins' }, { d: 4, t: 'retired after 17 days, with 0 wins' }];
  S.fame = [{ id: c.id, log: c.log.slice(), titles: [] }];
  const back = ST.deserialize(JSON.parse(JSON.stringify(ST.serialize(S))));
  assert.deepStrictEqual(back.birds.find((b) => b.id === c.id).log.map((n) => n.t), ['drank the tonic of eternal vigor']);
  assert.strictEqual(back.fame[0].log.length, 1);
});

test('training: up to 35%, 3% a session (4.5% in training weights), and a tonic adds two sessions once a day', () => {
  const S = ST.create(6); S.inv.tonic = 3; S.inv.anklets = 1;
  const c = bird(S, 'gamecock'); c.age = 8;
  assert.strictEqual(ST.TRAIN_MAX, 0.35);
  const p0 = ST.pheno(c).rate.power;
  assert.strictEqual(ST.train(S, c, 'muscle'), '');
  assert.strictEqual(c.train.muscle, 0.03);
  assert.ok(ST.pheno(c).rate.power > p0, 'a session shows in the numbers');
  assert.match(ST.train(S, c, 'muscle'), /enough for today/);
  ST.feed(S, c, 'tonic');
  assert.strictEqual(ST.sessionsLeft(S, c), 2);
  ST.feed(S, c, 'tonic'); // a second tonic the same day adds nothing more
  assert.strictEqual(ST.sessionsLeft(S, c), 2);
  ST.wear(S, c, 'anklets');
  assert.strictEqual(ST.train(S, c, 'muscle'), ''); assert.strictEqual(c.train.muscle, 0.075);
  assert.strictEqual(ST.train(S, c, 'muscle'), ''); assert.strictEqual(ST.sessionsLeft(S, c), 0);
  assert.match(ST.train(S, c, 'muscle'), /enough for today/);
  c.fed = true; ST.sleep(S);
  assert.strictEqual(ST.sessionsLeft(S, c), 1, 'one session the next day, until another tonic');
  c.train.muscle = 0.34; assert.strictEqual(ST.trainPreview(c, 'muscle').to, 0.35);
  // an old sandbox bird on eternal vigor, long since trained to the old limit, still gains
  const Z = ST.create(7, { sandbox: true }); Z.inv.vigor = 1;
  const e = bird(Z, 'gamecock'); e.age = ST.pheno(e).lifespan + 20; e._P = null; ST.feed(Z, e, 'vigor');
  e.train = { muscle: 0.15, lungs: 0.15, reflex: 0.15, courage: 0.15 };
  const before = ST.pheno(e).rate.power;
  assert.strictEqual(ST.train(Z, e, 'muscle'), '');
  assert.ok(ST.pheno(e).rate.power > before, 'eternal birds gain from training in a sandbox');
});

test('an ordinary wild bird shows about half of its weight class\'s cap; prices still read the even scale', () => {
  const r = new Rng(9), ids = Object.keys(RB.species.SPECIES).filter((id) => id !== 'human'), by = {};
  for (const id of ids) for (let k = 0; k < 4; k++) { const P = RB.pheno.express(RB.species.make(id, r, { sport: 0 })); (by[P.weightClass] = by[P.weightClass] || []).push(P); }
  for (const [wc, list] of Object.entries(by)) {
    for (const k of ['power', 'tough', 'stamina']) {
      const v = list.map((P) => P.rate[k] / P.rateCap[k]).sort((a, b) => a - b), med = v[v.length >> 1];
      assert.ok(med > 0.3 && med < 0.6, RB.pheno.WEIGHT_CLASSES[wc][0] + ' ' + k + ' median ' + med.toFixed(2));
    }
  }
  // the market's value is worked out on the even 0..100 scale, as it always was
  const S = ST.create(3), c = bird(S, 'goose'); c.age = 8;
  const P = ST.pheno(c);
  assert.ok(P.base.power <= 100 && P.base.tough <= 100 && P.rate.tough > P.base.tough);
  assert.ok(RB.economy.value(c) > 0);
});

test('a chick remembers who its parents were, and the card finds them and their young', () => {
  const S = ST.create(7);
  const [a, b] = S.birds;
  ST.move(S, a, 'nest0'); ST.move(S, b, 'nest0');
  for (let i = 0; i < 12 && !S.birds.some((c) => c.origin === 'born'); i++) { S.feeder = 9; ST.sleep(S); }
  const chick = S.birds.find((c) => c.origin === 'born');
  assert.ok(chick, 'a chick hatched');
  const mom = a.g.sex === 'F' ? a : b, dad = mom === a ? b : a;
  assert.deepStrictEqual(chick.ma, { id: mom.id, name: mom.name, sex: 'F' });
  assert.deepStrictEqual(chick.pa, { id: dad.id, name: dad.name, sex: 'M' });
  const fam = ST.family(S, chick);
  assert.strictEqual(fam.mother.c, mom); assert.strictEqual(fam.father.c, dad);
  assert.ok(ST.family(S, mom).young.includes(chick));
  // a starter bird has no parents on record
  assert.strictEqual(ST.family(S, a).mother, null);
});

test('sandbox: any number can be set by hand, within the caps, and it is real in a bout', () => {
  const S = ST.create(4, { sandbox: true }), c = bird(S, 'gamecock'); c.age = 8;
  const cap = ST.pheno(c).rateCap.power;
  c.edit = { power: cap, tough: cap, stamina: cap, speed: 100, guts: 100, wits: 100, fury: 100 };
  const P = ST.pheno(c);
  for (const k of RB.pheno.EDITABLE) assert.strictEqual(P.rate[k], c.edit[k], k);
  c.edit = { power: 9999 }; assert.strictEqual(ST.pheno(c).rate.power, cap, 'never past the cap');
  c.edit = { power: cap, tough: cap, stamina: cap, speed: 100, guts: 100, wits: 100, fury: 100 };
  const foe = RB.pheno.express(RB.species.make('gamecock', new Rng(9), { sport: 0 }));
  let w = 0;
  for (let i = 0; i < 6; i++) if (new RB.fight.Fight({ a: { P: ST.pheno(c) }, b: { P: foe }, seed: i }).run().winner === 0) w++;
  assert.ok(w >= 5, 'a bird set to the caps wins: ' + w + '/6');
  delete c.edit; c._P = null;
  assert.ok(ST.pheno(c).rate.power < cap, 'reset gives back what its genes give');
});

test('the BFC contract takes island birds of the age you set, from the islands you tick, and leaves a pair', () => {
  const S = ST.create(4);
  const mk = (name) => ({ id: name, name, birds: [], gen: 0, rad: 0, born: 0, size: 2 });
  S.isles = [mk('A'), mk('B')];
  for (const I of S.isles) for (let k = 0; k < 8; k++) { const c = ST.makeBird(S, RB.species.make('chicken', new Rng(k + 1), { sport: 0, sex: k % 2 ? 'M' : 'F' }), { at: 'isle', age: 6 + k * 3 }); c.isle = I.id; I.birds.push(c); }
  S.isles[0].birds.push(ST.makeBird(S, RB.npc.personGenome(new Rng(2), 'F'), { at: 'isle', person: 'h_1', age: 40 }));
  const k = ST.contract(S), lines = [];
  ST.contractNight(S, lines); assert.strictEqual(lines.length, 0, 'nothing until it is signed');
  k.on = true; k.minAge = 15; k.isles.A = 1;
  const m0 = S.money;
  ST.contractNight(S, lines);
  const A = S.isles[0], B = S.isles[1];
  assert.strictEqual(B.birds.length, 8, 'only islands on the list');
  assert.ok(A.birds.some((c) => c.person), 'people stay put');
  const left = A.birds.filter((c) => !c.person);
  assert.ok(left.every((c) => c.age < 15 || left.filter((o) => o.g.sex === c.g.sex && ST.pheno(o).grow >= 1).length <= 1), 'only the young, and the last grown bird of each sex');
  assert.ok(S.money > m0 && lines.length === 1 && /BFC van called at A/.test(lines[0]));
});

test('the lab charges for reading genomes, edits and injections in a normal game; a sandbox pays nothing', () => {
  const L = RB.lab, S = ST.create(4); S.money = 500;
  assert.strictEqual(L.pay(S, 'edit'), ''); assert.strictEqual(S.money, 485);
  assert.strictEqual(L.pay(S, 'inject'), ''); assert.strictEqual(S.money, 435);
  assert.strictEqual(L.pay(S, 'clone'), ''); assert.strictEqual(S.money, 185);
  assert.match(L.pay(S, 'clone'), /costs \$250/); assert.strictEqual(S.money, 185);
  const Z = ST.create(4, { sandbox: true }), z = bird(Z, 'chicken'); Z.money = 0;
  assert.ok(L.sequenced(Z, z)); assert.strictEqual(L.pay(Z, 'clone'), ''); assert.strictEqual(Z.money, 0);
  // an older save: the creatures it already has were read when reading was free
  const O = ST.create(5), old = bird(O, 'duck'); delete O.lab.feesV;
  const back = ST.deserialize(JSON.parse(JSON.stringify(ST.serialize(O))));
  assert.ok(L.sequenced(back, back.birds.find((c) => c.id === old.id)));
  const fresh = ST.addBird(back, RB.species.make('duck', new Rng(8), { sport: 0 }));
  assert.ok(!L.sequenced(back, fresh), 'newcomers still need reading');
});

test('Bird town: a feat for putting a bird in charge of every house and business on the mainland', () => {
  const S = ST.create(7), world = RB.world.generate(7), main = ST.mainlanders(world);
  assert.strictEqual(ST.birdTown(S, world), 0);
  for (const n of main) { const st = RB.npc.info(S, n.id); st.gone = true; st.sub = ST.serBird(bird(S, 'chicken', { name: 'Boss ' + n.id })); }
  assert.strictEqual(ST.birdTown(S, world), main.length);
  // a person put in charge does not count
  const one = RB.npc.info(S, main[0].id); one.sub = Object.assign({}, one.sub, { person: 'h_9' });
  assert.strictEqual(ST.birdTown(S, world), main.length - 1);
});
