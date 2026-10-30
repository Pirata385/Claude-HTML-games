import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FogMap } from '../js/systems/fog.js';

test('reveal marks cells around a point and only those', () => {
  const f = new FogMap(64, 64);
  assert.equal(f.seenAt(10, 10), false);
  f.reveal(10, 10, 6);
  assert.equal(f.seenAt(10, 10), true);
  assert.equal(f.seenAt(14, 10), true);
  assert.equal(f.seenAt(40, 40), false);
});

test('fog survives encode/decode', () => {
  const f = new FogMap(288, 288);
  f.reveal(100, 120, 20);
  const g = FogMap.decode(288, 288, f.encode());
  assert.equal(g.seenAt(100, 120), true);
  assert.equal(g.seenAt(5, 5), false);
  assert.ok(f.encode().length < 2000);
});

test('decode tolerates bad data', () => {
  const g = FogMap.decode(64, 64, 'not base64!!');
  assert.equal(g.seenAt(1, 1), false);
});
