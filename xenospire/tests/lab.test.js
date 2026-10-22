'use strict';
// Test Room: the room never ends a fight, dummies never die and report DPS,
// the Tear honours its filters and test battles use the room's kit.
const test = require('node:test');
const assert = require('node:assert/strict');
const XS = require('./load.js');

test('the room is closed and every pad can be reached', () => {
  const a = XS.Lab.arena();
  const seen = XS.Arena.reachableFrom(a.world, a.spawns[0].x, a.spawns[0].y);
  for (const p of a.lab.pads) assert.ok(seen[Math.floor(p.x) + Math.floor(p.y) * a.world.W], `pad ${p.kind} reachable`);
  for (const k of ['tear', 'portal', 'terminal']) {
    const q = a.lab[k];
    let near = false;
    for (let oy = -4; oy <= 4; oy++) for (let ox = -4; ox <= 4; ox++) if (seen[Math.floor(q.x) + ox + (Math.floor(q.y) + oy) * a.world.W]) near = true;
    assert.ok(near, `${k} reachable`);
  }
});

test('lab battles never end, dummies never die and log DPS', () => {
  const lab = XS.Lab.defaults();
  lab.kit = [0, 1, 2].map((k) => XS.Lab.specOf(XS.Power.generate(XS.hash('labt', k), 20, { tier: 2, forms: ['bolt', 'nova', 'grenade'] })));
  const b = XS.Lab.stage(lab);
  assert.equal(b.fighters.length, 5);
  const p = b.player;
  p.ai = new XS.AI(p, { skill: 1 });
  lab.noCd = true; lab.invuln = true;
  for (let s = 0; s < 60 * 40; s++) { b.step(1 / 60); XS.Lab.tick(lab, b); }
  assert.ok(!b.over);
  for (const f of b.fighters) assert.ok(f.alive, `${f.name} alive`);
  assert.equal(p.hp, p.maxHp, 'invulnerable');
  const total = b.fighters.filter((f) => f.dummy).reduce((s, f) => s + (f.dps ? f.dps.length / 2 : 0), 0);
  assert.ok(total > 3, `dummies were hit (${total})`);
  const d = b.fighters.find((f) => f.dummy && f.dps && f.dps.length);
  assert.ok(XS.Lab.dps(d, b.time) >= 0 && Number.isFinite(XS.Lab.dps(d, b.time)));
  for (const f of b.fighters.filter((x) => x.dummy)) assert.ok(Math.hypot(f.x - f.ai.home.x, f.y - f.ai.home.y) < 9, `${f.dummy} stays near its pad`);
});

test('the Tear honours tier, form and element filters', () => {
  const lab = XS.Lab.defaults();
  lab.tear = { tier: 2, forms: ['meteor', 'wave'], elements: ['light'], floor: 30, seed: '' };
  for (let k = 0; k < 10; k++) {
    for (const d of XS.Lab.weave(lab)) {
      assert.equal(d.tier, 2);
      assert.ok(['meteor', 'wave'].includes(d.form));
      assert.equal(d.elements[0], 'light');
      assert.equal(d.floor, 30);
      // Specs regenerate the same power.
      assert.deepEqual(XS.Lab.powerOf(XS.Lab.specOf(d, lab.tear)), d);
    }
  }
});

test('test battles use the room kit and end', () => {
  const lab = XS.Lab.defaults();
  lab.test = { foes: 2, floor: 8, difficulty: 1 };
  const { battle, plan } = XS.Lab.testBattle(lab, {});
  assert.equal(plan.opponents.length, 2);
  assert.deepEqual(battle.player.powers.map((s) => s.def.seed), lab.kit.map((s) => s.seed));
  for (const f of battle.fighters) if (!f.isPlayer) assert.ok(f.ai);
  battle.player.ai = new XS.AI(battle.player, { skill: 0.9 });
  for (let s = 0; s < 60 * 240 && !battle.over; s++) battle.step(1 / 60);
  assert.ok(battle.over);
});
