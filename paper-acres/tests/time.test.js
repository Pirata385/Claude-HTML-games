'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { load } = require('./load');
const PA = load('src/core/config.js', 'src/core/util.js', 'src/core/rng.js', 'src/systems/state.js', 'src/systems/time.js');
const T = PA.Time;

test('a new game starts on spring 1, 6:00am, sunny', () => {
  const s = PA.newState(1, {});
  assert.strictEqual(s.season, 0); assert.strictEqual(s.day, 1); assert.strictEqual(s.time, 360); assert.strictEqual(s.weather, 'sun');
});
test('tick advances game minutes from real milliseconds', () => {
  const s = PA.newState(1, {});
  T.tick(s, 7000, 700);
  assert.strictEqual(Math.floor(s.time), 370);
});
test('2am triggers the pass-out flag', () => {
  const s = PA.newState(1, {});
  s.time = 1559; const ev = T.tick(s, 1400, 700);
  assert.ok(ev.passOut);
  assert.ok(s.time <= 1560);
});
test('new day rolls seasons and years', () => {
  const s = PA.newState(1, { seasonDays: 14 });
  s.day = 14; let r = T.newDay(s);
  assert.strictEqual(s.day, 1); assert.strictEqual(s.season, 1); assert.ok(r.seasonChanged);
  s.season = 3; s.day = 14; T.newDay(s);
  assert.strictEqual(s.year, 2); assert.strictEqual(s.season, 0);
  assert.strictEqual(s.time, 360);
});
test('weather is deterministic, snow replaces rain in winter, first day of a season is sunny', () => {
  for (let d = 1; d <= 28; d++) assert.strictEqual(T.weatherFor(5, 1, 0, d), T.weatherFor(5, 1, 0, d));
  assert.strictEqual(T.weatherFor(5, 1, 2, 1), 'sun');
  for (let d = 2; d <= 28; d++) assert.ok(!['rain', 'storm'].includes(T.weatherFor(5, 1, 3, d)));
  const kinds = new Set(); for (let d = 2; d <= 28; d++) kinds.add(T.weatherFor(5, 1, 0, d));
  assert.ok(kinds.has('rain') && kinds.has('sun'));
});
test('darkness ramps up in the evening', () => {
  assert.strictEqual(T.darkness(12 * 60), 0);
  assert.ok(T.darkness(19 * 60) > 0 && T.darkness(19 * 60) < 1);
  assert.strictEqual(T.darkness(22 * 60), 1);
});
