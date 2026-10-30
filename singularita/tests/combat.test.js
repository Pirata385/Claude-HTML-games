import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeHit, defenseFactor, isBehind } from '../js/combat/formulas.js';
import { StatusSet } from '../js/combat/statusRuntime.js';
import { makeRng } from '../js/core/rng.js';

const base = { power: 20, dmgMult: 1.5, mult: 1, critChance: 0, critMult: 1.5, def: 0, pen: 0, defMult: 1, vuln: 1 };

test('damage = power × class scaling × skill multiplier, within ±5%', () => {
  const rng = makeRng(1);
  for (let i = 0; i < 50; i++) {
    const { dmg, crit } = computeHit({ ...base, rng });
    assert.equal(crit, false);
    assert.ok(dmg >= 30 * 0.95 - 1 && dmg <= 30 * 1.05 + 1, String(dmg));
  }
});

test('defence reduces damage and armour pierce restores it', () => {
  assert.equal(defenseFactor(0, 0), 1);
  assert.ok(Math.abs(defenseFactor(100, 0) - 0.5) < 1e-9);
  assert.ok(defenseFactor(100, 0.5) > defenseFactor(100, 0));
});

test('crits multiply damage; forced crits always land', () => {
  const rng = makeRng(2);
  const normal = computeHit({ ...base, rng: makeRng(9) }).dmg;
  const c = computeHit({ ...base, forceCrit: true, rng });
  assert.equal(c.crit, true);
  assert.ok(c.dmg > normal * 1.3);
});

test('vulnerability and sunder raise damage', () => {
  const a = computeHit({ ...base, def: 50, rng: makeRng(3) }).dmg;
  const b = computeHit({ ...base, def: 50, defMult: 0.5, vuln: 1.3, rng: makeRng(3) }).dmg;
  assert.ok(b > a * 1.3);
});

test('damage is never below 1', () => {
  assert.ok(computeHit({ ...base, power: 0.1, def: 9999, rng: makeRng(4) }).dmg >= 1);
});

test('isBehind detects backstabs', () => {
  // Target at origin facing +z (yaw 0); attacker behind it at z = -2.
  assert.equal(isBehind({ x: 0, z: 0, yaw: 0 }, { x: 0, z: -2 }), true);
  assert.equal(isBehind({ x: 0, z: 0, yaw: 0 }, { x: 0, z: 2 }), false);
});

test('status set: stacks, chill slows, two chills can be turned into a freeze by the caller', () => {
  const s = new StatusSet();
  s.apply('chill');
  assert.ok(s.slowMult < 1);
  s.apply('chill');
  assert.equal(s.get('chill').stacks, 2);
  s.apply('poison', { power: 100 });
  let dot = 0;
  s.update(1.0, (amt) => { dot += amt; });
  assert.ok(dot > 0);
  s.update(10, () => {});
  assert.equal(s.has('chill'), false);
});

test('status set: marked only boosts its source', () => {
  const s = new StatusSet();
  s.apply('marked', { src: 'me' });
  assert.ok(s.vulnFrom('me') > 1);
  assert.equal(s.vulnFrom('someone'), 1);
});
