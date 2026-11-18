'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { load } = require('./load');
const PA = load('src/core/config.js', 'src/core/util.js', 'src/physics/stickman.js');
const C = PA.C;

test('figure fits a 3x3 character box standing on the feet line', () => {
  for (const kind of ['idle', 'walk', 'run', 'jump', 'fall', 'climb', 'swim', 'swing', 'hurt']) {
    for (let t = 0; t < 1; t += 0.25) {
      const f = PA.Stick.figure(kind, t, { progress: t });
      for (const s of f.segs) for (const [x, y] of [[s[0], s[1]], [s[2], s[3]]]) {
        assert.ok(Math.abs(x) <= 1.5 * C.CELL_W + 4, `${kind} x ${x}`);
        assert.ok(y <= 1 && y >= -3 * C.CELL_H - (kind === 'jump' || kind === 'climb' ? 6 : 0), `${kind} y ${y}`);
      }
      assert.ok(f.head.y < -2 * C.CELL_H && f.head.y > -3 * C.CELL_H, `${kind} head row`);
    }
  }
});

test('idle: arms reach the side cells, legs spread to the side cells', () => {
  const f = PA.Stick.figure('idle', 0, {});
  const xs = f.segs.flatMap((s) => [s[0], s[2]]);
  assert.ok(Math.min(...xs) <= -C.CELL_W + 1 && Math.max(...xs) >= C.CELL_W - 1);
});

test('facing left mirrors x', () => {
  const r = PA.Stick.figure('swing', 0.5, { progress: 0.5 }, 1), l = PA.Stick.figure('swing', 0.5, { progress: 0.5 }, -1);
  assert.strictEqual(l.segs[0][0], -r.segs[0][0]);
});
