'use strict';
const test = require('node:test');
const assert = require('node:assert');
const RB = require('./load.js');
const { Rng } = RB.core;
const DT = RB.fight.DT;

function standWorld(P) {
  const w = new RB.physics.World();
  w.box(-1e5, 0, 1e5, 500);
  return { w, rag: new RB.creature.Rag(w, P, 0, 0, 1) };
}
function run(w, rag, seconds, each) {
  for (let i = 0; i < seconds / DT; i++) { if (each) each(i * DT); rag.control(DT); w.step(DT); rag.post(); }
}
const finite = (w) => w.ps.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y));

test('every species stands still, then walks about as far as its top speed says', () => {
  const rng = new Rng(9);
  for (const id of RB.species.IDS) {
    const P = RB.pheno.express(RB.species.make(id, rng, { sex: 'M', sport: 0 }));
    const { w, rag } = standWorld(P);
    run(w, rag, 4);
    assert.ok(finite(w), id + ' went non-finite standing');
    assert.strictEqual(rag.state, 'stand', id + ' fell over standing');
    assert.ok(Math.abs(rag.midX()) < P.TL, id + ' drifted ' + rag.midX().toFixed(1));
    assert.ok(Math.abs(rag.pitchErr()) < 0.2, id + ' lost its posture');
    const x0 = rag.midX();
    run(w, rag, 3, () => { rag.vxDes = P.speedMax * 0.7; });
    const walked = rag.midX() - x0, expect = P.speedMax * 0.7 * 3;
    assert.ok(finite(w), id + ' went non-finite walking');
    assert.strictEqual(rag.state, 'stand', id + ' fell over walking');
    assert.ok(walked > expect * 0.8 && walked < expect * 1.2, id + ' walked ' + walked.toFixed(0) + ' of ' + expect.toFixed(0));
  }
});

test('a knocked-down bird gets up again, and a hop lands on its feet', () => {
  const rng = new Rng(2);
  for (const id of ['chicken', 'ostrich', 'penguin', 'heron', 'human']) {
    const P = RB.pheno.express(RB.species.make(id, rng, { sex: 'M', sport: 0 }));
    const { w, rag } = standWorld(P);
    run(w, rag, 0.5);
    rag.knockdown(0.6);
    run(w, rag, 0.3);
    assert.strictEqual(rag.state, 'down');
    run(w, rag, 3);
    assert.ok(finite(w), id + ' went non-finite');
    assert.strictEqual(rag.state, 'stand', id + ' did not get up');
    rag.hop(0, -P.jumpV * 0.8);
    run(w, rag, 3);
    assert.strictEqual(rag.state, 'stand', id + ' did not land');
  }
});

test('a bout is deterministic for a seed and always ends', () => {
  const rng = new Rng(5);
  const mk = (id) => RB.pheno.express(RB.species.make(id, rng, { sex: 'M', sport: 0 }));
  const pairs = [['chicken', 'gamecock', 'pit'], ['goose', 'eagle', 'pit'], ['duck', 'chicken', 'push'], ['ostrich', 'moa', 'push'], ['falcon', 'raven', 'aerial'], ['human', 'cassowary', 'pit']];
  for (const [a, b, mode] of pairs) {
    const A = mk(a), B = mk(b);
    const f1 = new RB.fight.Fight({ a: { P: A }, b: { P: B }, mode, seed: 42 }), r1 = f1.run();
    const r2 = new RB.fight.Fight({ a: { P: A }, b: { P: B }, mode, seed: 42 }).run();
    assert.ok(r1, a + ' v ' + b + ' did not end');
    assert.ok(r1.t <= 60.01, 'ran past the time limit');
    assert.deepStrictEqual(r1, r2);
    assert.ok(finite(f1.world), a + ' v ' + b + ' went non-finite');
    assert.ok(['ko', 'fled', 'ringout', 'decision'].includes(r1.how));
  }
});

test('weapons matter: long spurs and talons beat bare heels', () => {
  const rng = new Rng(8);
  const base = RB.species.SPECIES.chicken.t;
  const armed = Object.assign({}, base, { spur: 1, talon: 1 }), bare = Object.assign({}, base, { spur: 0, talon: 0 });
  let wins = 0;
  const n = 24;
  for (let i = 0; i < n; i++) {
    const A = RB.pheno.express(RB.genome.fromTargets(armed, [], rng, { sex: 'M', variation: 0.3 }));
    const B = RB.pheno.express(RB.genome.fromTargets(bare, [], rng, { sex: 'M', variation: 0.3 }));
    // alternate corners so the side cannot matter
    const r = i % 2 ? new RB.fight.Fight({ a: { P: B }, b: { P: A }, seed: 300 + i }).run() : new RB.fight.Fight({ a: { P: A }, b: { P: B }, seed: 300 + i }).run();
    if ((r.winner === 0) === (i % 2 === 0)) wins++;
  }
  assert.ok(wins >= n * 0.65, 'armed birds won only ' + wins + ' of ' + n);
});

test('corners are fair: mirrored bouts between clones split about evenly', () => {
  const rng = new Rng(12);
  const P = RB.pheno.express(RB.species.make('chicken', rng, { sex: 'M', sport: 0 }));
  let left = 0;
  const n = 40;
  for (let i = 0; i < n; i++) if (new RB.fight.Fight({ a: { P }, b: { P }, seed: 900 + i }).run().winner === 0) left++;
  assert.ok(left >= n * 0.3 && left <= n * 0.7, 'left corner won ' + left + ' of ' + n);
});

test('commands change a fighter and odds come out as a probability', () => {
  const rng = new Rng(3);
  const A = RB.pheno.express(RB.species.make('gamecock', rng, { sex: 'M', sport: 0 })), B = RB.pheno.express(RB.species.make('duck', rng, { sex: 'M', sport: 0 }));
  const f = new RB.fight.Fight({ a: { P: A, auto: false, bond: 1 }, b: { P: B }, seed: 6 });
  assert.strictEqual(f.command(0, 'sic'), true);
  assert.strictEqual(f.command(0, 'sic'), false, 'cooldown should block a repeat');
  f.command(0, 'towel');
  assert.strictEqual(f.result.how, 'towel');
  assert.strictEqual(f.result.winner, 1);
  const p = RB.fight.estimate({ P: A }, { P: B }, 'pit', 8, 1);
  assert.ok(p > 0.5 && p <= 1, 'a gamecock should be favoured over a duck, got ' + p);
});
