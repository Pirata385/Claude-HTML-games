import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spiritCanCast, spiritPay, spiritRegen } from '../js/combat/spirit.js';
import { CLASSES } from '../js/data/classes.js';
import { SKILLS } from '../js/data/skills.js';
import * as stats from '../js/systems/stats.js';

test('Spirit refills all the time, with the Astral out or not, and never drains on its own', () => {
  const st = { res: 20, exhausted: false };
  spiritRegen(st, 1, 100, 14);
  assert.equal(st.res, 34);
  spiritRegen(st, 100, 100, 14);
  assert.equal(st.res, 100, 'capped at the maximum');
  assert.equal(CLASSES.stardust.resource.drain, undefined, 'no drain while manifested');
});

test('any Spirit left pays for a skill; spending the last of it leaves you exhausted', () => {
  const st = { res: 30, exhausted: false };
  assert.equal(spiritCanCast(st), null);
  spiritPay(st, 15);
  assert.equal(st.res, 15); assert.equal(st.exhausted, false);
  // A dearer skill than what is left still goes off, and empties the Spirit.
  assert.equal(spiritCanCast(st), null);
  spiritPay(st, 40);
  assert.equal(st.res, 0); assert.equal(st.exhausted, true);
});

test('exhausted, only the basic attack is left until the Spirit is full again', () => {
  const st = { res: 0, exhausted: true };
  assert.match(spiritCanCast(st), /only basic attacks/i);
  spiritRegen(st, 5, 100, 14);
  assert.equal(st.exhausted, true, 'still exhausted at 70');
  assert.match(spiritCanCast(st), /only basic attacks/i);
  spiritRegen(st, 5, 100, 14);
  assert.equal(st.res, 100); assert.equal(st.exhausted, false, 'full again: free');
  assert.equal(spiritCanCast(st), null);
});

test('the Astral no longer breaks: its blows are no longer counted', () => {
  assert.equal(stats.astralHits, undefined);
  assert.doesNotMatch(SKILLS.sd_manifest.desc, /drain/i);
  assert.match(SKILLS.sd_manifest.desc, /any time/i);
});
