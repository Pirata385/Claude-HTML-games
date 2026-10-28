// Economy, construction, combat and the day cycle work as connected systems.
const W = UB.World;

function fresh(seed) {
  const S = UB.Game.newGame({ seed: seed || 'sistemas' });
  // Remove wandering zombies so the tests control every fight.
  for (const z of S.zombies) z.dead = true;
  UB.Game.tick(S);
  return S;
}
function spotNear(S, type) {
  const p = UB.Bot.spotFor(S, type, 4, 10);
  assert.ok(p, 'no place to build ' + type);
  return p;
}

test('dawn: survivors eat; shortages cause hunger and lower morale', () => {
  const S = fresh();
  S.res.food = 100;
  UB.Eco.dawn(S);
  assert.strictEqual(S.res.food, 100 - S.units.length * UB.DEF.BAL.eatPerDay);
  assert.ok(S.units.every((u) => u.starving === 0));
  S.res.food = 3;
  const m0 = S.morale;
  UB.Eco.dawn(S);
  assert.strictEqual(S.units.filter((u) => u.starving > 0).length, S.units.length - 1);
  assert.ok(S.morale < m0);
});

test('storage is capped by the HQ and depots', () => {
  const S = fresh();
  const cap = UB.Eco.cap(S);
  S.res.wood = cap - 5;
  assert.strictEqual(UB.Eco.add(S, 'wood', 20), 5);
  assert.strictEqual(S.res.wood, cap);
  const p = spotNear(S, 'depot');
  S.res.wood = 0; S.res.scrap = 100; UB.Eco.add(S, 'wood', 60);
  const b = UB.Buildings.place(S, 'depot', p.x, p.y).b;
  UB.Buildings.addBuild(S, b, 1e6);
  assert.strictEqual(UB.Eco.cap(S), cap + UB.DEF.BUILDINGS.depot.levels[0].cap);
});

test('construction: cost paid, blueprint passable until built, demolish refunds', () => {
  const S = fresh();
  S.res.wood = 100; S.res.scrap = 100;
  const p = spotNear(S, 'wall');
  const r = UB.Game.command(S, { type: 'build', build: 'wall', x: p.x, y: p.y });
  assert.ok(r.ok, r.reason);
  assert.strictEqual(S.res.wood, 90);
  assert.strictEqual(S.res.scrap, 85);
  const i = W.idx(S, p.x, p.y);
  assert.strictEqual(S._blockU[i], 0, 'blueprint should not block yet');
  const b = W.get(S, r.id);
  UB.Buildings.addBuild(S, b, 1e6);
  assert.strictEqual(b.built, 1);
  assert.strictEqual(S._blockU[i], 1);
  assert.strictEqual(S._blockZ[i], 1);
  // Occupied tile and unexplored/out-of-territory tiles are rejected.
  assert.ok(!UB.Buildings.canPlace(S, 'wall', p.x, p.y).ok);
  assert.ok(!UB.Buildings.canPlace(S, 'wall', 2, 2).ok);
  UB.Game.command(S, { type: 'demolish', id: b.id });
  assert.strictEqual(S.res.wood, 95);
  assert.strictEqual(S.res.scrap, 92);
  assert.strictEqual(S._blockU[i], 0);
});

test('upgrade raises level and hit points; repairs cost resources', () => {
  const S = fresh();
  S.res.wood = 150; S.res.scrap = 150;
  const p = spotNear(S, 'barricade');
  const b = UB.Buildings.place(S, 'barricade', p.x, p.y).b;
  UB.Buildings.addBuild(S, b, 1e6);
  const hp1 = b.maxHp;
  assert.ok(UB.Game.command(S, { type: 'upgrade', id: b.id }).ok);
  assert.strictEqual(b.level, 2);
  assert.ok(b.maxHp > hp1);
  UB.Buildings.damage(S, b, 200);
  const hpLow = b.hp, wood0 = S.res.wood;
  for (let k = 0; k < 400; k++) UB.Buildings.repair(S, b, 1);
  assert.ok(b.hp > hpLow);
  assert.ok(S.res.wood < wood0, 'repair should cost wood');
  // Out of resources: repairing stops.
  UB.Buildings.damage(S, b, 200);
  S.res.wood = 0;
  let ok = true;
  for (let k = 0; k < 200 && ok; k++) ok = UB.Buildings.repair(S, b, 1);
  assert.strictEqual(ok, false);
});

test('generator powers turrets only while it is on and fuelled', () => {
  const S = fresh();
  S.unlocked.bp_turret = true;
  S.res.wood = 150; S.res.scrap = 150; S.res.fuel = 5;
  const g = UB.Buildings.place(S, 'generator', ...Object.values(spotNear(S, 'generator'))).b;
  UB.Buildings.addBuild(S, g, 1e6);
  const t = UB.Buildings.place(S, 'turret', ...Object.values(spotNear(S, 'turret'))).b;
  UB.Buildings.addBuild(S, t, 1e6);
  UB.Eco.updatePower(S);
  assert.strictEqual(t.powered, true);
  UB.Game.command(S, { type: 'toggle', id: g.id });
  assert.strictEqual(t.powered, false);
  UB.Game.command(S, { type: 'toggle', id: g.id });
  S.res.fuel = 0; g.burnT = 0;
  UB.Eco.updatePower(S);
  assert.strictEqual(t.powered, false);
});

test('survivors spend ammo shooting and switch to melee when it runs out', () => {
  const S = fresh();
  const u = S.units.find((x) => x.weapon === 'pistol');
  for (const o of S.units) if (o !== u) o.dead = true;
  UB.Game.tick(S);
  S.res.ammo = 0;
  const z = UB.Zombies.spawn(S, 'walker', u.x + 3, u.y, { state: 'idle' });
  z.hp = 500; z.maxHp = 500;
  const a0 = u.ammo;
  UB.Units.order(S, u, { type: 'hold', x: u.x, y: u.y });
  for (let k = 0; k < 60; k++) UB.Game.tick(S);
  assert.ok(u.ammo < a0, 'no shots fired');
  u.ammo = 0;
  z.hp = 20; z.x = u.x + 0.6; z.y = u.y; z.state = 'idle';
  let killed = false;
  for (let k = 0; k < 200 && !killed; k++) { UB.Game.tick(S); killed = z.dead; }
  assert.ok(killed, 'melee did not kill the zombie');
  assert.strictEqual(u.ammo, 0);
});

test('untreated bites kill the survivor, who rises as a zombie', () => {
  const S = fresh();
  const u = S.units.find((x) => x.role !== 'medic');
  S.res.meds = 0;
  u.infected = 0.2;
  const z0 = S.zombies.length;
  for (let k = 0; k < 10; k++) UB.Game.tick(S);
  assert.ok(!S.units.includes(u));
  // The body rises (and may be shot down at once by the others).
  assert.ok(S.zombies.length > z0 || S.stats.kills > 0);
  assert.ok(S.log.some((m) => m.k === 'msg.turned' && m.p.name === u.name));
  assert.ok(S.memorial.some((m) => m.name === u.name));
});

test('horde budget grows every night and compositions respect unlock nights', () => {
  let prev = 0;
  for (let n = 1; n <= 40; n++) {
    const b = UB.Waves.budget(n, 'normal');
    if (n % 5 !== 1) assert.ok(b > prev, `budget dropped at night ${n}`);
    prev = b;
  }
  const S = fresh();
  const w1 = UB.Waves.compose(S, 1);
  assert.ok(w1.every((t) => t === 'walker'));
  const w12 = UB.Waves.compose(S, 12);
  assert.ok(w12.length > w1.length * 3);
  assert.ok(UB.Waves.compose(S, 10).includes('colossus'));
  assert.ok(!UB.Waves.compose(S, 5).includes('colossus'));
  assert.ok(UB.Waves.budget(10, 'nightmare') > UB.Waves.budget(10, 'easy'));
});

test('looting fills the backpack, which is deposited at the base', () => {
  const S = fresh();
  const u = S.units.find((x) => x.role === 'scout');
  const p = S.pois.find((q) => q.type === 'market');
  const food0 = S.res.food;
  u.x = p.ex + 0.5; u.y = p.ey + 0.5;
  UB.Game.command(S, { type: 'loot', ids: [u.id], id: p.id });
  for (let k = 0; k < 20 * 30 && p.searchesLeft === UB.DEF.POIS.market.searches; k++) { UB.Game.tick(S); u.hp = u.maxHp; }
  assert.ok(p.searchesLeft < UB.DEF.POIS.market.searches, 'search never completed');
  assert.ok(UB.Units.packTotal(u) > 0);
  UB.Game.command(S, { type: 'return', ids: [u.id] });
  for (let k = 0; k < 20 * 120 && UB.Units.packTotal(u) > 0; k++) { UB.Game.tick(S); u.hp = u.maxHp; }
  assert.strictEqual(UB.Units.packTotal(u), 0);
  assert.ok(S.res.food > food0 - 1);
});

test('the first horde reaches and attacks the base if nobody stops it', () => {
  const S = fresh('horda');
  for (const u of S.units) { u.ammo = 0; u.weapon = 'bat'; }
  const hq = W.hq(S);
  while (S.clock.phase !== 'night') UB.Game.tick(S);
  for (let k = 0; k < 20 * 220 && hq.hp >= hq.maxHp; k++) UB.Game.tick(S);
  assert.ok(hq.hp < hq.maxHp || S.stats.kills > 5, 'the horde never arrived');
});
