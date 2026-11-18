'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { load } = require('./load');
const PA = load('src/core/config.js', 'src/core/util.js', 'src/ascii/glyphs.js', 'src/ascii/matcher.js', 'src/physics/stickman.js');
const S = PA.Stick;
const len = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const KINDS = ['idle', 'walk', 'run', 'jump', 'fall', 'land', 'crouch', 'climb', 'swim', 'swing', 'hurt', 'wave', 'talk'];

test('every pose keeps bone lengths (a real skeleton, not a stamp)', () => {
  for (const k of KINDS) for (let t = 0; t < 1; t += 0.125) {
    const j = S.rig(k, t, { progress: t });
    assert.ok(Math.abs(len(j.hip, j.kneeL) - S.BONES.thigh) < 0.6, `${k} thigh`);
    assert.ok(Math.abs(len(j.kneeR, j.footR) - S.BONES.shin) < 0.6 || len(j.hip, j.footR) > S.BONES.thigh + S.BONES.shin - 1, `${k} shin`);
    assert.ok(Math.abs(len(j.chest, j.elbowL) - S.BONES.upper) < 0.6, `${k} upper arm`);
    for (const p of Object.values(j)) if (typeof p === 'object') assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y));
  }
});

test('walking: feet touch the ground at the contact phases and the body bobs', () => {
  for (const t of [0, 0.5]) {
    const j = S.rig('walk', t, {});
    assert.ok(Math.max(j.footL.y, j.footR.y) > -1.5, 'a foot is planted');
  }
  const hips = [0, 0.25, 0.5, 0.75].map((t) => S.rig('walk', t, {}).hip.y);
  assert.ok(Math.max(...hips) - Math.min(...hips) > 0.8, 'hip bob');
  const a = S.rig('walk', 0.1, {}), b = S.rig('walk', 0.35, {});
  assert.ok(Math.abs(a.handL.x - b.handL.x) > 2, 'arms swing');
});

test('the head sits above the chest and the figure is about ten character rows tall', () => {
  const j = S.rig('idle', 0, {});
  assert.ok(j.head.y < j.chest.y - 4);
  const top = (j.head.y - S.HEAD.ry) * S.SCALE;
  assert.ok(top < -95 && top > -106, 'top of the head ' + top + ' px');
});

test('blend moves joints toward the target pose', () => {
  const a = S.rig('idle', 0, {}), b = S.rig('jump', 0, {});
  const m = S.blend(a, b, 0.5);
  assert.ok(Math.abs(m.handL.y - (a.handL.y + b.handL.y) / 2) < 1e-6);
});

test('proportions follow the reference drawing: big round head, long torso, straight limbs in a V', () => {
  const j = S.rig('idle', 0, {});
  const top = j.head.y - S.HEAD.ry, H = -top;
  const headBottom = j.head.y + S.HEAD.ry;
  const near = (a, b, tol, what) => assert.ok(Math.abs(a - b) <= tol, `${what}: ${a.toFixed(3)} vs ${b}`);
  near((2 * S.HEAD.ry) / H, 0.29, 0.04, 'head height share');
  assert.ok(S.HEAD.rx / S.HEAD.ry > 1 && S.HEAD.rx / S.HEAD.ry <= 1.45, 'head a little wider than tall');
  near((j.hip.y - headBottom) / H, 0.41, 0.05, 'torso share');
  assert.ok(j.chest.y > headBottom + 3, 'arms leave the torso below the neck');
  // idle limbs are straight lines, like the drawing
  near(len(j.hip, j.footL), S.BONES.thigh + S.BONES.shin, 0.5, 'left leg straight');
  near(len(j.hip, j.footR), S.BONES.thigh + S.BONES.shin, 0.5, 'right leg straight');
  near(len(j.chest, j.handL), S.BONES.upper + S.BONES.fore, 0.6, 'left arm straight');
  near(len(j.chest, j.handR), S.BONES.upper + S.BONES.fore, 0.6, 'right arm straight');
  // legs: an upside-down V; arms: down and out, more out than down
  assert.ok(j.footL.x < -8 && j.footR.x > 8);
  for (const h of [j.handL, j.handR]) {
    assert.ok(h.y > j.chest.y, 'hands below the shoulders');
    assert.ok(Math.abs(h.x - j.chest.x) > Math.abs(h.y - j.chest.y), 'arms spread outward');
  }
});

test('thin rule: body lines are one character thick, without gaps', () => {
  const check = (x0, y0, x1, y1) => {
    const cells = S.cellLine(x0, y0, x1, y1);
    const steep = Math.abs(y1 - y0) >= Math.abs(x1 - x0);
    const major = cells.map((q) => (steep ? q[1] : q[0]));
    assert.strictEqual(new Set(major).size, cells.length, 'one cell per row (steep) or per column (shallow)');
    // ends in the rows (or columns) of its end points, at most one cell to the side
    const ends = [[cells[0], x0, y0], [cells[cells.length - 1], x1, y1]];
    for (const [q, x, y] of ends) {
      assert.strictEqual(steep ? q[1] : q[0], Math.floor(steep ? y : x), 'end row');
      assert.ok(Math.abs((steep ? q[0] : q[1]) - Math.floor(steep ? x : y)) <= 1, 'end column');
    }
    for (let i = 1; i < cells.length; i++) {
      assert.ok(Math.abs(cells[i][0] - cells[i - 1][0]) <= 1 && Math.abs(cells[i][1] - cells[i - 1][1]) <= 1, 'no gaps');
    }
  };
  check(5.5, 2.2, 5.5, 9.8);   // torso: a straight column
  check(5.5, 9.8, 2.7, 12.9);  // a leg
  check(5.5, 4.5, 9.6, 5.9);   // an arm
  check(5.5, 4.5, 1.4, 5.9);
  check(0.1, 0.9, 3.95, 3.05); // almost diagonal
  check(3.3, 3.3, 3.6, 3.4);   // a single cell
});

test('stickman models: the chosen rungs plus solid squares and solid spheres, all the same figure', () => {
  const M = S.MODELS, G = PA.Glyphs;
  assert.deepStrictEqual(M.map((m) => m.body), ['\u2261', '\u25A0', '\u25CF']);
  for (const m of M) {
    assert.strictEqual([...m.body].length, 1, m.name + ' body is one character');
    assert.ok(!/[\p{L}\p{N}]/u.test(m.body), m.name + ' body is not a letter or a digit');
    assert.notStrictEqual(G.code(m.body), G.code('?'), m.name + ' body is in the glyph atlas');
    assert.strictEqual(typeof G.CUSTOM[m.body], 'function', m.name + ' body is drawn by hand (same on every platform)');
    assert.ok(m.name && m.name.length <= 10);
  }
});

test('a model chosen in an older version falls back to the first one', () => {
  assert.strictEqual(S.model(2), 2);
  assert.strictEqual(S.model(14), 0);
  assert.strictEqual(S.model(-1), 0);
  assert.strictEqual(S.model(undefined), 0);
});

test('the hollow head converts to a clean round outline on the character grid', () => {
  const M = PA.Matcher, keys = new Map();
  // samples are relative to the centre of the head's middle cell, which is sample (2, 3) of that cell
  for (const [x, y] of S.headSamples()) {
    const sx = x + 2 + 3 * M.SX, sy = y + 3 + M.SY, c = Math.floor(sx / M.SX), r = Math.floor(sy / M.SY);
    assert.ok(c >= 0 && c < 7 && r >= 0 && r < 3, 'the outline stays inside 7x3 cells');
    const k = r * 7 + c, bit = 1 << ((sy - r * M.SY) * M.SX + (sx - c * M.SX));
    keys.set(k, ((keys.get(k) || 0) | bit) >>> 0);
  }
  const rows = [0, 1, 2].map((r) => [0, 1, 2, 3, 4, 5, 6].map((c) => (keys.has(r * 7 + c) ? M.classify(keys.get(r * 7 + c)) : ' ')).join(''));
  assert.deepStrictEqual(rows, [' .---. ', '(     )', " '---' "]);
});
