'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { load } = require('./load');
const PA = load('src/core/config.js', 'src/core/util.js', 'src/physics/stickman.js');
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

test('the head sits above the chest and the figure is about three cells tall', () => {
  const j = S.rig('idle', 0, {});
  assert.ok(j.head.y < j.chest.y - 4);
  assert.ok(j.head.y - S.HEAD_R > -66 && j.head.y - S.HEAD_R < -56);
});

test('blend moves joints toward the target pose', () => {
  const a = S.rig('idle', 0, {}), b = S.rig('jump', 0, {});
  const m = S.blend(a, b, 0.5);
  assert.ok(Math.abs(m.handL.y - (a.handL.y + b.handL.y) / 2) < 1e-6);
});

test('solid body: limbs one character wide, torso two, a round head bigger than half the torso', () => {
  const half = PA.C.CELL_W / 2; // one character at two characters per world cell
  assert.ok(Math.abs(S.SHAPE.limb * S.SCALE - half) < 0.01);
  assert.ok(Math.abs(S.SHAPE.torso * S.SCALE - 2 * half) < 0.01);
  assert.ok(S.SHAPE.head > S.SHAPE.torso / 2);
  assert.strictEqual(S.HEAD_R, S.SHAPE.head);
});

test('20 stickman models: every one has its own body character and a hollow head shape', () => {
  const M = S.MODELS;
  assert.strictEqual(M.length, 20);
  const chars = new Set(M.map((m) => m.body));
  assert.strictEqual(chars.size, 20, 'all body characters differ');
  for (const m of M) {
    assert.ok(/^[\x21-\x7e]$/.test(m.body), m.name + ' body is one printable ASCII character');
    assert.ok(!'|-/\\_.\',`:;~^'.includes(m.body), m.name + ' body is not a stroke character');
    assert.ok(['round', 'oval', 'square', 'diamond', 'onion'].includes(m.head), m.name);
    assert.ok(m.rx >= 5 && m.ry >= 5 && m.rx <= 12 && m.ry <= 12, m.name + ' head size');
    assert.ok(m.name && m.name.length <= 10);
  }
});
