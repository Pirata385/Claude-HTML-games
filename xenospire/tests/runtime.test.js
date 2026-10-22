'use strict';
// Power runtime: every form, every Épico payload and the new modifiers work in
// a live battle against a stationary target on a flat floor.
const test = require('node:test');
const assert = require('node:assert/strict');
const XS = require('./load.js');

const BASE = XS.Arena.BASE;

// A flat arena (props removed) so line powers have a clear shot.
function flatArena() {
  const arena = XS.Arena.generate(5, 3, { fighters: 2 });
  const w = arena.world;
  for (let z = BASE; z < w.H; z++) for (let y = 0; y < w.D; y++) for (let x = 0; x < w.W; x++) if (w.get(x, y, z)) w.set(x, y, z, 0);
  return arena;
}

// Caster at the centre, a target `dist` voxels east, both standing still.
function duel(def, dist) {
  const arena = flatArena();
  const b = new XS.Battle({
    arena, seed: 5, floor: 3,
    fighters: [{ genome: XS.Creature.generate(1), powers: [def], team: 0 }, { genome: XS.Creature.generate(2), powers: [], team: 1, hpMult: 20 }],
  });
  const [a, e] = b.fighters;
  const c = arena.center;
  const z = arena.world.topAt(c.x, c.y);
  Object.assign(a, { x: c.x, y: c.y, z, inv: 0 });
  Object.assign(e, { x: c.x + dist, y: c.y, z: arena.world.topAt(c.x + dist, c.y), inv: 0 });
  a.powers[0].cd = 0;
  return { b, a, e };
}

const DIST = { self: 1.8, cone: 2.6, dash: 4.5 };

test('every form hurts a target it is aimed at', () => {
  for (const form of Object.keys(XS.Power.FORMS)) {
    for (const tier of [0, 1, 2]) {
      const def = XS.Power.generate(XS.hash('rt', form, tier), 3, { tier, forms: [form] });
      const { b, a, e } = duel(def, form === 'aura' ? 1.5 : DIST[def.aim] || 5);
      const hp0 = e.hp;
      a.ctrl.cast = 0; a.ctrl.castAngle = 0; a.ctrl.castDist = Math.hypot(e.x - a.x, e.y - a.y); a.ctrl.castCharge = 1;
      let errors = 0;
      for (let s = 0; s < 60 * 6; s++) {
        try { b.step(1 / 60); } catch (err) { errors++; throw new Error(`${form} t${tier}: ${err.stack}`); }
        if (form !== 'wall') e.x += (a.x + (DIST[def.aim] || 5) - e.x) * 0.2; // stay put despite knockback
      }
      assert.equal(errors, 0);
      assert.equal(a.stats.casts[0], 1, `${form} t${tier} was cast`);
      assert.ok(e.hp < hp0, `${form} t${tier} (${def.mods.join(',') || 'no mods'}${def.combo ? ' + ' + def.combo.form : ''}) did damage`);
      for (const f of b.fighters) assert.ok(Number.isFinite(f.x + f.y + f.z + f.hp), `${form} NaN`);
    }
  }
});

test('every Épico payload goes off, whatever triggers it', () => {
  const primaries = { impact: 'bolt', end: 'boomerang', cast: 'cone' };
  for (const sub of Object.keys(XS.Power.SUBS)) {
    for (const [trigger, form] of Object.entries(primaries)) {
      let def = null;
      for (let k = 0; k < 800 && !def; k++) {
        const d = XS.Power.generate(XS.hash('combo', sub, form, k), 4, { tier: 2, forms: [form] });
        if (d.combo.form === sub) def = d;
      }
      assert.ok(def, `found a ${form} with ${sub}`);
      assert.equal(def.combo.trigger, trigger);
      const { b, a, e } = duel(def, form === 'cone' ? 2.6 : 5);
      let fired = 0;
      b.events.on('combo', (ev) => { if (ev.f === a) fired++; });
      a.ctrl.cast = 0; a.ctrl.castAngle = 0; a.ctrl.castDist = 5;
      for (let s = 0; s < 60 * 6; s++) b.step(1 / 60);
      assert.equal(fired, 1, `${form} + ${sub} fired once`);
      void e;
    }
  }
});

test('lobbed shells fly over walls and land on the far side', () => {
  const def = XS.Power.generate(XS.hash('lob'), 3, { tier: 0, forms: ['grenade'] });
  const { b, a, e } = duel(def, 7);
  const w = b.world;
  // A 3-high wall halfway between them.
  const mx = Math.floor(a.x + 3.5);
  for (let y = Math.floor(a.y) - 3; y <= Math.floor(a.y) + 3; y++) for (let h = 0; h < 3; h++) w.set(mx, y, a.z + h, 1);
  const hp0 = e.hp;
  a.ctrl.cast = 0; a.ctrl.castAngle = 0; a.ctrl.castDist = 7;
  for (let s = 0; s < 60 * 2; s++) b.step(1 / 60);
  assert.ok(e.hp < hp0, 'grenade cleared the wall');
});

test('charging raises damage', () => {
  let def = null;
  for (let k = 0; k < 400 && !def; k++) {
    const d = XS.Power.generate(XS.hash('charge', k), 3, { tier: 1, forms: ['bolt'] });
    if (d.mods.length === 1 && d.mods[0] === 'charge') def = d;
  }
  assert.ok(def);
  const dmg = (charge) => {
    const { b, a, e } = duel(def, 5);
    const hp0 = e.hp;
    a.ctrl.cast = 0; a.ctrl.castAngle = 0; a.ctrl.castDist = 5; a.ctrl.castCharge = charge;
    for (let s = 0; s < 60; s++) b.step(1 / 60);
    return hp0 - e.hp;
  };
  const low = dmg(0), high = dmg(1);
  assert.ok(low > 0 && high > low * 1.4, `charged ${high} vs ${low}`);
});

test('navigation finds a way around a wall', () => {
  const arena = flatArena();
  const w = arena.world, c = arena.center;
  const cx = Math.floor(c.x), cy = Math.floor(c.y), z = w.topAt(cx, cy);
  for (let y = cy - 6; y <= cy + 6; y++) for (let h = 0; h < 3; h++) w.set(cx + 2, y, z + h, 1);
  const nav = new XS.NavField(w);
  nav.build(cx + 5, cy);
  assert.ok(nav.distAt(cx, cy) > 7, 'path goes around');
  let x = cx + 0.5, y = cy + 0.5;
  for (let i = 0; i < 60; i++) {
    const d = nav.dirFrom(x, y);
    if (!d) break;
    x += d.x * 0.5; y += d.y * 0.5;
    assert.ok(!w.blockedSpan(x, y, z, z + 1), 'never walks into the wall');
  }
  assert.ok(Math.hypot(x - (cx + 5.5), y - (cy + 0.5)) < 1.5, `reached the goal (${x.toFixed(1)}, ${y.toFixed(1)})`);
});
