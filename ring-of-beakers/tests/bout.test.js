'use strict';
// Bouts: their length, the Grand Ring's rounds, sportsmanship, the flying kick's slam into the wall,
// weight-class limits on the numbers, and the neighbours who come to watch.
const test = require('node:test');
const assert = require('node:assert');
const RB = require('./load.js');
const { Rng } = RB.core;

const mk = (id, r) => RB.pheno.express(RB.species.make(id, r, { sport: 0 }));

test('a bout lasts about twenty-five seconds on average, light birds and heavy alike', () => {
  const r = new Rng(31), ids = Object.keys(RB.species.SPECIES).filter((id) => id !== 'human');
  const pool = ids.map((id) => ({ id, wc: mk(id, r).weightClass }));
  const modes = ['pit', 'pit', 'pit', 'grain', 'mud', 'wind', 'dark', 'rounds'];
  let sum = 0; const N = 64;
  for (let i = 0; i < N; i++) {
    const a = r.pick(pool), same = pool.filter((q) => q.wc === a.wc), b = r.chance(0.4) ? a : r.pick(same);
    const res = new RB.fight.Fight({ a: { P: mk(a.id, r) }, b: { P: mk(b.id, r) }, mode: modes[i % modes.length], seed: 500 + i, timeLimit: 60 }).run();
    assert.ok(res, 'every bout ends');
    sum += res.t;
  }
  const avg = sum / N;
  assert.ok(avg > 19 && avg < 34, 'average bout ' + avg.toFixed(1) + 's');
  // the pace is the same for both birds: the same pair fights at the same pace whichever corner each is in
  const A = mk('gamecock', r), B = mk('goose', r);
  assert.strictEqual(new RB.fight.Fight({ a: { P: A }, b: { P: B }, seed: 1 }).pace, new RB.fight.Fight({ a: { P: B }, b: { P: A }, seed: 1 }).pace);
});

test('the Grand Ring goes on after the first round: a knockout takes a round, best of three', () => {
  const r = new Rng(8);
  let second = 0, longer = 0;
  for (let i = 0; i < 12; i++) {
    const f = new RB.fight.Fight({ a: { P: mk('gamecock', r) }, b: { P: mk('gamecock', r) }, mode: 'rounds', seed: 70 + i });
    const res = f.run();
    assert.ok(res, 'a bout of rounds always ends (also when run headless, as Skip does)');
    const rounds = f.events.filter((e) => e.type === 'round');
    if (rounds.some((e) => e.n === 2)) second++;
    if (rounds.length) longer++;
    const won = f.roundsWon[0] + f.roundsWon[1];
    assert.ok(won >= 1 && won <= 3, 'rounds won ' + f.roundsWon);
    if (res.how === 'ko' || res.how === 'rounds') assert.ok(Math.max(...f.roundsWon) >= 2 || won === 3, 'the winner took the rounds: ' + f.roundsWon + ' ' + res.how);
  }
  assert.ok(second >= 6, 'most bouts reach a second round: ' + second + '/12');
  assert.ok(longer === second);
});

test('a downed bird is given room to get up, unless its foe is ordered in', () => {
  const r = new Rng(12), proto = RB.fight.Fight.prototype, onHit = proto.onHit;
  let downs = 0, late = 0;
  proto.onHit = function (att, def, ...rest) {
    if ((def.rag.state === 'down' || def.rag.state === 'rise') && !(att.frenzy > 0)) late++;
    return onHit.call(this, att, def, ...rest);
  };
  try {
    for (let i = 0; i < 16; i++) {
      const f = new RB.fight.Fight({ a: { P: mk('gamecock', r) }, b: { P: mk('turkey', r) }, seed: 300 + i });
      f.run();
      downs += f.result.downs[0] + f.result.downs[1];
    }
  } finally { proto.onHit = onHit; }
  assert.ok(downs >= 8, 'birds go down: ' + downs);
  assert.ok(late <= Math.max(2, downs * 0.08), late + ' hits on a downed bird in ' + downs + ' knockdowns');
});

test('a flying kick knocks the foe flat and slams it into the wall (the damage is the kick\'s own)', () => {
  let slams = 0, kicks = 0;
  for (let s = 1; s < 30 && slams < 2; s++) {
    const f = new RB.fight.Fight({ a: { P: mk('heron', new Rng(s)) }, b: { P: mk('chicken', new Rng(s + 500)) }, seed: s });
    f.run();
    const ev = f.events;
    ev.forEach((e, i) => {
      if (e.type !== 'hit' || !e.fly) return;
      kicks++;
      assert.ok(ev.slice(i, i + 3).some((d) => d.type === 'down' && d.side === 1 - e.side) || ev.slice(Math.max(0, i - 40), i).some((d) => d.type === 'down' && d.side === 1 - e.side), 'the kicked bird goes down');
      const wall = ev.slice(i + 1).find((d) => d.type === 'wall' && d.side === 1 - e.side);
      if (wall) { slams++; assert.ok(Math.abs(Math.abs(wall.x) - f.edge) < 1e-6 && Math.sign(wall.x) === wall.dir); }
    });
  }
  assert.ok(kicks > 0 && slams > 0, kicks + ' flying kicks, ' + slams + ' slams');
});

test('each weight class has its own limit on the physical numbers (75 for the lightest, 300 for the heaviest); speed stays within 100', () => {
  const r = new Rng(5), cap = RB.pheno.PHYS_CAP;
  assert.strictEqual(cap[0], 75); assert.strictEqual(cap[cap.length - 1], 300);
  for (let i = 1; i < cap.length; i++) assert.ok(cap[i] > cap[i - 1]);
  let over100 = 0;
  for (const id of Object.keys(RB.species.SPECIES)) {
    for (let k = 0; k < 3; k++) {
      const P = mk(id, r), c = cap[P.weightClass];
      for (const s of ['power', 'tough', 'stamina']) { assert.ok(P.rate[s] >= 0 && P.rate[s] <= c, id + ' ' + s + ' ' + P.rate[s] + ' > ' + c); assert.strictEqual(P.rateCap[s], c); }
      for (const s of ['speed', 'guts', 'wits', 'fury']) { assert.ok(P.rate[s] <= 100, id + ' ' + s); assert.strictEqual(P.rateCap[s], 100); }
      if (P.rate.power > 100 || P.rate.tough > 100) over100++;
    }
  }
  assert.ok(over100 > 0, 'the heavy classes go past 100');
  assert.ok(mk('trex', r).rate.tough > 100);
  // the market reads the numbers up to 100 in every class, as it always has
  const S = RB.state.create(3), c = RB.state.addBird(S, RB.species.make('trex', new Rng(2), { sport: 0 }), { at: 'cage' }); c.age = 6;
  const keep = RB.game; RB.game = { S };
  try { assert.ok(RB.economy.value(c) > 0); } finally { RB.game = keep; }
});

test('eight neighbours come to watch, four outside each wall, and root for the bird on their side', () => {
  const S = RB.state.create(7), world = RB.world.generate(7), W = 300, L = 70;
  const cr = RB.crowd.make(9, W, L, S, world);
  assert.strictEqual(cr.people.length, 8);
  for (const sd of [-1, 1]) {
    const side = cr.people.filter((p) => p.side === sd);
    assert.strictEqual(side.length, 4);
    for (const p of side) { assert.ok(p.x * sd > W, 'outside the wall'); assert.strictEqual(p.fan, sd < 0 ? 0 : 1); assert.strictEqual(p.f, -sd, 'facing the pit'); assert.ok(p.P.armL > 0, p.name + ' has arms to wave'); }
  }
  const names = new Set(RB.state.mainlanders(world).map((n) => n.name));
  assert.ok(cr.people.every((p) => names.has(p.name)), 'the game\'s own neighbours');
  // someone in your truck stays in your truck
  const base = RB.state.mainlanders(world).find((n) => n.name === cr.people[0].name);
  RB.state.netKeeper(S, base);
  for (let s = 1; s < 6; s++) assert.ok(!RB.crowd.make(s, W, L, S, world).people.some((p) => p.name === base.name), 'netted: ' + base.name);
  // a bird goes down: the other side cheers, its own side holds its head
  const fight = { fighters: [{ hpMax: 100 }, { hpMax: 100 }] };
  RB.crowd.react(cr, { type: 'down', side: 0 }, fight);
  for (const p of cr.people) assert.strictEqual(p.act, p.fan === 1 ? 'cheer' : 'groan');
  for (let i = 0; i < 300; i++) RB.crowd.update(cr, 1 / 60, 1);
  assert.ok(cr.people.every((p) => p.act === 'idle' || p.act === 'pump' || p.act === 'clap'), 'and they settle down again');
  RB.crowd.react(cr, { type: 'end', winner: 1 }, fight);
  assert.ok(cr.people.filter((p) => p.fan === 1).every((p) => p.act === 'cheer'));
  // with no world at hand, strangers fill the places
  assert.strictEqual(RB.crowd.make(3, W, L).people.length, 8);
});
