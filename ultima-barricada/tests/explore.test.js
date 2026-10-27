// Exploration rewards and base systems interacting in play.
const W = UB.World;

function fresh(seed) {
  const S = UB.Game.newGame({ seed: seed || 'explorar' });
  for (const z of S.zombies) z.dead = true;
  UB.Game.tick(S);
  return S;
}
function build(S, type) {
  for (const k of UB.DEF.RES) S.res[k] = Math.max(S.res[k], 120);
  const p = UB.Bot.spotFor(S, type, 4, 10);
  const r = UB.Buildings.place(S, type, p.x, p.y);
  assert.ok(r.ok, r.reason);
  UB.Buildings.addBuild(S, r.b, 1e6);
  return r.b;
}

test('the police station yields blueprints and weapons', () => {
  const S = fresh();
  const p = S.pois.find((q) => q.type === 'police');
  const u = S.units[0];
  assert.ok(!S.unlocked.bp_turret);
  assert.ok(!UB.Buildings.canPlace(S, 'turret', 0, 0).ok);
  UB.Explore.searchComplete(S, p, u);
  assert.ok(S.unlocked.bp_turret, 'turret blueprint not unlocked');
  UB.Explore.searchComplete(S, p, u);
  assert.ok(S.unlocked.bp_radio, 'radio blueprint not unlocked');
  assert.ok(UB.Units.packTotal(u) > 0);
  assert.strictEqual(p.searchesLeft, UB.DEF.POIS.police.searches - 2);
});

test('camp survivors join only when there are free beds', () => {
  const S = fresh();
  const camp = S.pois.find((q) => q.type === 'camp');
  const u = S.units[0];
  const pop = S.units.length;
  UB.Explore.searchComplete(S, camp, u);
  assert.strictEqual(S.units.length, pop, 'joined without beds');
  assert.strictEqual(camp.searchesLeft, 1, 'camp consumed without rescuing anyone');
  build(S, 'shelter');
  UB.Explore.searchComplete(S, camp, u);
  assert.ok(S.units.length > pop, 'nobody joined after building a shelter');
  assert.strictEqual(camp.searchesLeft, 0);
  const recruit = S.units[S.units.length - 1];
  assert.strictEqual(recruit.order && recruit.order.type, 'return');
});

test('at night idle shooters man the towers by themselves, and leave in the morning', () => {
  const S = fresh();
  const t = build(S, 'tower');
  for (let k = 0; k < 200; k++) UB.Game.tick(S);
  assert.strictEqual(t.garrison.length, 0);
  S.clock = { phase: 'night', t: 1 };
  for (let k = 0; k < 400 && t.garrison.length < 2; k++) UB.Game.tick(S);
  assert.strictEqual(t.garrison.length, 2, 'tower not manned at night');
  S.clock = { phase: 'day', t: 6 };
  for (let k = 0; k < 20; k++) UB.Game.tick(S);
  assert.strictEqual(t.garrison.length, 0, 'tower still manned during the day');
});

test('a powered turret shoots zombies using stockpiled ammo', () => {
  const S = fresh();
  S.unlocked.bp_turret = true;
  build(S, 'generator');
  const tur = build(S, 'turret');
  S.res.fuel = 10; S.res.ammo = 50;
  UB.Eco.updatePower(S);
  assert.ok(tur.powered);
  for (const u of S.units) { u.weapon = 'bat'; u.ammo = 0; UB.Units.order(S, u, { type: 'hold', x: u.x, y: u.y }); }
  const z = UB.Zombies.spawn(S, 'brute', tur.tx + 4.5, tur.ty + 0.5, { state: 'idle' });
  const hp0 = z.hp;
  for (let k = 0; k < 60; k++) UB.Game.tick(S);
  assert.ok(S.res.ammo < 50, 'turret did not use ammo');
  assert.ok(z.dead || z.hp < hp0, 'turret did not hurt the zombie');
});

test('destroying a nest scores and clears it from the map', () => {
  const S = fresh();
  const nest = S.pois.find((q) => q.type === 'nest');
  const i = W.idx(S, nest.tx, nest.ty);
  assert.ok(S._blockU[i]);
  UB.Combat.hurtPoi(S, nest, 1e6, S.units[0]);
  UB.Game.tick(S);
  assert.ok(!S.pois.includes(nest));
  assert.strictEqual(S.stats.nests, 1);
  assert.strictEqual(S._blockU[i], 0);
});

test('the infirmary cures bites with medicine', () => {
  const S = fresh();
  const inf = build(S, 'infirmary');
  const u = S.units.find((x) => x.role !== 'medic');
  for (const o of S.units) if (o.role === 'medic') o.dead = true;
  UB.Game.tick(S);
  u.infected = 200; u.hp = 40;
  S.res.meds = 3;
  UB.Game.command(S, { type: 'patient', ids: [u.id], id: inf.id });
  for (let k = 0; k < 600 && u.infected >= 0; k++) UB.Game.tick(S);
  assert.strictEqual(u.infected, -1, 'bite not treated');
  assert.strictEqual(S.res.meds, 2);
});

test('shots near an intact gas station can blow it up, hurting the horde', () => {
  const S = fresh('posto');
  const gas = S.pois.find((q) => q.type === 'gas');
  const cx = gas.tx + gas.w / 2, cy = gas.ty + gas.h / 2;
  const zs = [];
  for (let k = 0; k < 6; k++) zs.push(UB.Zombies.spawn(S, 'walker', cx + 2 + (k % 3) * 0.5, cy + 1 + Math.floor(k / 3), { state: 'idle' }));
  S._zgrid.rebuild(S.zombies);
  S._ugrid.rebuild(S.units);
  let n = 0;
  while (!gas.exploded && n++ < 2000) UB.Combat.gasHazard(S, cx, cy);
  assert.ok(gas.exploded, 'the station never exploded');
  assert.ok(zs.filter((z) => z.dead).length >= 4, 'the explosion should kill nearby walkers');
});
