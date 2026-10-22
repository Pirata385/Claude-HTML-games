'use strict';
// Headless AI-vs-AI fights: the whole combat stack (voxels, physics, powers,
// statuses, AI) must run without errors, end, and stay in a sane duration.
const test = require('node:test');
const assert = require('node:assert/strict');
const XS = require('./load.js');

function fight(seed, floor, n) {
  const arena = XS.Arena.generate(seed, floor, { fighters: n });
  const fighters = [];
  for (let i = 0; i < n; i++) {
    fighters.push({
      genome: XS.Creature.generate(XS.hash(seed, 'g', i)),
      powers: [0, 1, 2].map((k) => XS.Power.generate(XS.hash(seed, 'p', i, k), floor)),
      team: i, hpMult: 1 + 0.06 * (floor - 1),
    });
  }
  const b = new XS.Battle({ arena, seed, floor, fighters });
  for (const f of b.fighters) f.ai = new XS.AI(f, { skill: 0.6 });
  let steps = 0;
  while (!b.over && steps < 60 * 240) {
    b.step(1 / 60);
    steps++;
    if (steps % 120 === 0) {
      for (const f of b.fighters) {
        assert.ok(Number.isFinite(f.x) && Number.isFinite(f.y) && Number.isFinite(f.z) && Number.isFinite(f.hp), `NaN fighter (seed ${seed})`);
      }
    }
  }
  return b;
}

for (const floor of [1, 10, 30]) {
  test(`duels on floor ${floor} finish in a sane time`, () => {
    const times = [];
    for (let i = 0; i < 24; i++) {
      const b = fight(31000 + i * 101 + floor, floor, 2);
      assert.ok(b.over, 'fight ended');
      times.push(b.time);
    }
    times.sort((a, b) => a - b);
    const median = times[times.length >> 1];
    assert.ok(median > 15 && median < 90, `median ${median.toFixed(1)}s`);
  });
}

test('free-for-all with three and four beings ends', () => {
  for (let i = 0; i < 8; i++) {
    const b = fight(77000 + i, 5 + i, 3 + (i % 2));
    assert.ok(b.over);
    assert.ok(b.alive().length <= 1);
  }
});

test('every power form can be cast in a live battle', () => {
  const forms = Object.keys(XS.Power.FORMS);
  const arena = XS.Arena.generate(5, 3, { fighters: 2 });
  for (const form of forms) {
    for (const tier of [0, 3]) {
      const def = XS.Power.generate(XS.hash(form, tier), 3, { tier, forms: [form] });
      assert.equal(def.form, form);
      const b = new XS.Battle({
        arena: XS.Arena.generate(5, 3, { fighters: 2 }), seed: 5, floor: 3,
        fighters: [{ genome: XS.Creature.generate(1), powers: [def], team: 0 }, { genome: XS.Creature.generate(2), powers: [], team: 1 }],
      });
      const [a, e] = b.fighters;
      a.powers[0].cd = 0;
      a.inv = 0; e.inv = 0;
      const ang = Math.atan2(e.y - a.y, e.x - a.x);
      a.ctrl.cast = 0; a.ctrl.castAngle = ang; a.ctrl.castDist = Math.hypot(e.x - a.x, e.y - a.y);
      for (let s = 0; s < 60 * 8; s++) b.step(1 / 60);
      assert.equal(a.stats.casts[0], 1, `${form} t${tier} was cast`);
    }
  }
  void arena;
});

test('AIs find each other on the big arenas (nobody stays stuck)', () => {
  for (let i = 0; i < 6; i++) {
    const seed = 52000 + i * 13, floor = 3 + i * 4, n = 2 + (i % 3);
    const arena = XS.Arena.generate(seed, floor, { fighters: n });
    const fighters = [];
    for (let k = 0; k < n; k++) fighters.push({ genome: XS.Creature.generate(XS.hash(seed, 'g', k)), powers: [0, 1, 2].map((j) => XS.Power.generate(XS.hash(seed, 'p', k, j), floor)), team: k });
    const b = new XS.Battle({ arena, seed, floor, fighters });
    for (const f of b.fighters) f.ai = new XS.AI(f, { skill: 0.6 });
    const anchor = b.fighters.map((f) => ({ x: f.x, y: f.y, t: 0 }));
    for (let s = 0; s < 60 * 90 && !b.over; s++) {
      b.step(1 / 60);
      if (s % 30) continue;
      b.fighters.forEach((f, k) => {
        if (!f.alive) return;
        const far = b.enemiesOf(f).every((e) => Math.hypot(e.x - f.x, e.y - f.y) > 12);
        if (!far || Math.hypot(f.x - anchor[k].x, f.y - anchor[k].y) > 1.5) { anchor[k] = { x: f.x, y: f.y, t: b.time }; return; }
        assert.ok(b.time - anchor[k].t < 12, `fighter ${k} stuck at (${f.x.toFixed(1)}, ${f.y.toFixed(1)}) on seed ${seed}`);
      });
    }
  }
});
