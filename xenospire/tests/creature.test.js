'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const XS = require('./load.js');

test('genomes are valid, varied and deterministic', () => {
  const seen = new Set();
  for (let s = 1; s <= 600; s++) {
    const g = XS.Creature.generate(s * 2654435761);
    seen.add(g.archetype);
    assert.ok(XS.Creature.ARCHETYPES[g.archetype]);
    assert.ok(g.name.length >= 3 && /^[A-Z]/.test(g.name), g.name);
    assert.ok(g.bio.world && g.epithet);
    const st = g.stats;
    for (const k of ['maxHp', 'speed', 'mass', 'radius', 'height']) assert.ok(Number.isFinite(st[k]) && st[k] > 0, k);
    assert.ok(st.maxHp >= 120 && st.maxHp <= 240, `hp ${st.maxHp}`);
    assert.ok(st.speed >= 4.5 && st.speed <= 8.5, `speed ${st.speed}`);
    assert.ok(XS.Creature.TRAITS[g.trait] && XS.Creature.BASICS[g.basic] && XS.Creature.DODGES[g.dodge]);
    assert.equal(g.spine.radii.length, g.spine.n);
  }
  assert.equal(seen.size, Object.keys(XS.Creature.ARCHETYPES).length, 'every archetype appears');
  assert.deepEqual(XS.Creature.generate(77), XS.Creature.generate(77));
});

test('IK keeps bone lengths', () => {
  for (const [tx, ty, tz] of [[1, 0.5, -1], [3, 0, 0], [0.1, 0, 0.1]]) {
    const knee = XS.ik2({ x: 0, y: 0, z: 0 }, { x: tx, y: ty, z: tz }, 1, 1.2, { x: 0, y: 0, z: 1 });
    assert.ok(Math.abs(Math.hypot(knee.x, knee.y, knee.z) - 1) < 1e-6);
  }
});

test('rigs animate without NaN while walking, dodging and getting hit', () => {
  for (let s = 1; s <= 60; s++) {
    const g = XS.Creature.generate(s * 977);
    const rig = new XS.Rig(g);
    let a = 0;
    for (let f = 0; f < 600; f++) {
      const dt = 1 / 60;
      a += dt * 0.5;
      const st = { x: 10 + Math.cos(a) * 5, y: 10 + Math.sin(a) * 5, z: 3, facing: a + Math.PI / 2, vx: -Math.sin(a) * 2.5, vy: Math.cos(a) * 2.5, aimAngle: a, airborne: f % 200 > 190 };
      if (f === 100) rig.cast(1);
      if (f === 200) rig.melee();
      if (f === 300) rig.hurt(1, 0);
      if (f === 400) rig.dodge(g.dodge, 0.3);
      rig.update(dt, st);
      for (let i = 0; i < rig.primCount; i++) {
        const p = rig.prims[i];
        assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z), `NaN prim (seed ${s}, ${g.archetype})`);
      }
    }
    for (const leg of rig.legs) {
      const d = Math.hypot(leg.knee.x - leg.hip.x, leg.knee.y - leg.hip.y, leg.knee.z - leg.hip.z);
      assert.ok(Math.abs(d - leg.a) < 1e-6);
    }
  }
});
