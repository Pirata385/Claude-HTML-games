// Newer content: landmines, flamethrowers, canteen, training yard, sawmill, lab, the crawler,
// leaper and plaguer zombies, and the tutorial's clock hold.
const W = UB.World;

function fresh(seed) {
  const S = UB.Game.newGame({ seed: seed || 'novidades' });
  for (const z of S.zombies) z.dead = true;
  UB.Game.tick(S);
  return S;
}
function build(S, type, r0, r1) {
  for (const k of UB.DEF.RES) S.res[k] = Math.max(S.res[k], 140);
  const p = UB.Bot.spotFor(S, type, r0 || 4, r1 || 10);
  assert.ok(p, 'no place for ' + type);
  const r = UB.Buildings.place(S, type, p.x, p.y);
  assert.ok(r.ok, r.reason);
  UB.Buildings.addBuild(S, r.b, 1e6);
  return r.b;
}
// Keeps the survivors out of the fights the tests set up.
function bench(S) { for (const u of S.units) { u.weapon = 'bat'; u.ammo = 0; UB.Units.order(S, u, { type: 'hold', x: u.x, y: u.y }); } }
function run(S, n) { for (let k = 0; k < n; k++) UB.Game.tick(S); }

test('every new building and zombie is defined, ordered and named', () => {
  for (const t of ['mine', 'flamer', 'canteen', 'training', 'sawmill', 'lab']) {
    assert.ok(UB.DEF.BUILDINGS[t], t);
    assert.ok(UB.DEF.BUILD_ORDER.includes(t), t + ' missing from the build menu');
  }
  const cats = new Set(['mine', 'flamer', 'canteen', 'training', 'sawmill', 'lab'].map((t) => UB.DEF.BUILDINGS[t].cat));
  assert.deepStrictEqual([...cats].sort(), ['base', 'defense', 'prod']);
  for (const z of ['crawler', 'leaper', 'toxic']) assert.ok(UB.DEF.ZOMBIES[z], z);
  // Build-menu keys stay unique.
  const keys = Object.values(UB.DEF.BUILDINGS).map((b) => b.key).filter(Boolean);
  assert.strictEqual(new Set(keys).size, keys.length);
});

test('a landmine blows up under a zombie and spares nearby walls', () => {
  const S = fresh();
  bench(S);
  const mine = build(S, 'mine', 5, 8);
  const wall = UB.Buildings.place(S, 'wall', mine.tx + 1, mine.ty);
  if (wall.ok) UB.Buildings.addBuild(S, wall.b, 1e6);
  const z = UB.Zombies.spawn(S, 'brute', mine.tx + 0.5, mine.ty + 0.5, { state: 'idle' });
  const hp0 = z.hp;
  run(S, 3);
  assert.ok(mine.dead, 'mine did not go off');
  assert.ok(z.dead || z.hp < hp0 - 60, 'mine did not hurt the zombie');
  if (wall.ok) assert.strictEqual(wall.b.hp, wall.b.maxHp, 'mine damaged a wall');
  const hq = W.hq(S), hp = hq.hp;
  UB.Combat.explode(S, hq.tx + 1.5, hq.ty + 1.5, 2, 200, null, { structures: false });
  assert.strictEqual(hq.hp, hp, 'landmine blast hurt a structure');
});

test('a flamethrower burns several zombies and uses fuel', () => {
  const S = fresh();
  S.unlocked.bp_flamer = true;
  bench(S);
  const f = build(S, 'flamer', 5, 8);
  S.res.fuel = 20;
  const zs = [0, 1, 2].map((k) => UB.Zombies.spawn(S, 'armored', f.tx + 2.5, f.ty + 0.2 + k * 0.3, { state: 'idle' }));
  const hp0 = zs.map((z) => z.hp);
  run(S, 120);
  assert.ok(zs.filter((z, i) => z.dead || z.hp < hp0[i]).length >= 2, 'flames did not spread over the group');
  assert.ok(S.res.fuel < 20, 'flamethrower did not burn fuel');
  // Without fuel it stops and warns.
  S.res.fuel = 0;
  const z = UB.Zombies.spawn(S, 'walker', f.tx + 2.5, f.ty + 0.5, { state: 'idle' });
  const h = z.hp;
  run(S, 40);
  assert.strictEqual(z.hp, h);
  assert.ok(S.log.some((m) => m.k === 'msg.flamerNoFuel'));
});

test('the canteen stretches food and lifts morale when everyone eats', () => {
  const S = fresh();
  build(S, 'canteen', 4, 10);
  const n = S.units.length;
  S.res.food = 100; S.morale = 50;
  UB.Eco.dawn(S);
  const per = UB.DEF.BAL.eatPerDay * (1 - UB.DEF.BUILDINGS.canteen.levels[0].save);
  assert.strictEqual(S.res.food, 100 - Math.ceil(n * per));
  assert.ok(S.morale > 50, 'no morale bonus');
});

test('the training yard ranks up idle survivors', () => {
  const S = fresh();
  build(S, 'training', 4, 10);
  const u = S.units.find((x) => UB.Eco.isTrainee(S, x)) || S.units[0];
  UB.Units.order(S, u, null);
  u.x = W.hq(S).tx + 1.5; u.y = W.hq(S).ty + 4.5;
  const xp0 = u.xp;
  run(S, 20 * 60);
  assert.ok(u.xp > xp0 + 1, 'no experience gained: ' + (u.xp - xp0));
});

test('the sawmill makes wood and the lab turns food and scrap into meds', () => {
  const S = fresh();
  S.unlocked.bp_lab = true;
  const saw = build(S, 'sawmill', 4, 10);
  build(S, 'generator', 4, 10);
  const lab = build(S, 'lab', 4, 10);
  S.res.fuel = 30;
  UB.Eco.updatePower(S);
  assert.ok(lab.powered, 'lab has no power');
  const [a, b] = S.units;
  UB.Units.enterBuilding(S, a, saw, 'work');
  UB.Units.enterBuilding(S, b, lab, 'work');
  S.res.wood = 0; S.res.meds = 0; S.res.food = 60; S.res.scrap = 60;
  run(S, 20 * 60);
  assert.ok(S.res.wood >= 3, 'sawmill made ' + S.res.wood + ' wood');
  assert.ok(S.res.meds >= 1, 'lab made no meds');
  assert.ok(S.res.food < 60 && S.res.scrap < 60, 'lab did not use its inputs');
});

test('new blueprints come from the gas station and the hospital', () => {
  const S = fresh();
  const u = S.units[0];
  for (const [type, bp] of [['gas', 'bp_flamer'], ['hospital', 'bp_lab']]) {
    const p = S.pois.find((q) => q.type === type);
    assert.ok(p, 'no ' + type + ' on the map');
    UB.Explore.searchComplete(S, p, u);
    assert.ok(S.unlocked[bp], bp + ' not unlocked');
  }
});

test('crawlers are harder to shoot', () => {
  const S = fresh();
  const u = S.units[0];
  const w = UB.DEF.WEAPONS.pistol;
  const walker = UB.Zombies.spawn(S, 'walker', u.x + 3, u.y, { state: 'idle' });
  const crawler = UB.Zombies.spawn(S, 'crawler', u.x + 3, u.y, { state: 'idle' });
  const pw = UB.Combat.hitChance(S, u, w, u.x + 3, u.y, false, walker);
  const pc = UB.Combat.hitChance(S, u, w, u.x + 3, u.y, false, crawler);
  assert.ok(pc < pw * 0.8, `crawler ${pc} vs walker ${pw}`);
});

test('leapers jump over a wall instead of breaking it', () => {
  const S = fresh();
  bench(S);
  const hq = W.hq(S);
  // A closed ring of walls around the HQ, so there is no way around.
  for (const u of S.units) u.hidden = true;
  const x0 = hq.tx - 5, y0 = hq.ty - 5, x1 = hq.tx + 7, y1 = hq.ty + 7;
  S.res.wood = 900; S.res.scrap = 900;
  UB.Buildings.placeLine(S, 'wall', x0, y0, x1, y0); UB.Buildings.placeLine(S, 'wall', x1, y0, x1, y1);
  UB.Buildings.placeLine(S, 'wall', x1, y1, x0, y1); UB.Buildings.placeLine(S, 'wall', x0, y1, x0, y0);
  for (const b of S.buildings) if (b.type === 'wall') UB.Buildings.addBuild(S, b, 1e6);
  UB.Path.updateFlow(S, true);
  const y = y1;
  const z = UB.Zombies.spawn(S, 'leaper', hq.tx + 1.5, y1 + 3.5, { state: 'horde' });
  let leapt = false;
  for (let k = 0; k < 900 && !leapt; k++) { UB.Game.tick(S); leapt = z.x > x0 && z.x < x1 + 1 && z.y > y0 && z.y < y1; }
  assert.ok(leapt, 'leaper did not cross the wall');
  assert.ok(S.fx.some((e) => e.t === 'leap'), 'crossed without leaping (walked around)');
  assert.ok(S.buildings.filter((b) => b.type === 'wall').every((b) => b.hp > b.maxHp * 0.8), 'leaper broke the wall instead');
});

test('plaguers poison nearby survivors and leave a cloud when they die', () => {
  const S = fresh();
  const u = S.units[0];
  UB.Units.order(S, u, { type: 'hold', x: u.x, y: u.y });
  u.weapon = 'bat'; u.ammo = 0;
  const z = UB.Zombies.spawn(S, 'toxic', u.x + 1, u.y, { state: 'idle' });
  z.cd = 99; // only the aura hurts
  const hp0 = u.hp;
  run(S, 40);
  assert.ok(u.hp < hp0, 'aura did no damage');
  UB.Combat.killZombie(S, z, null);
  assert.strictEqual(S.clouds.length, 1);
  const hp1 = u.hp;
  run(S, 40);
  assert.ok(u.hp < hp1, 'cloud did no damage');
  run(S, 20 * 10);
  assert.strictEqual(S.clouds.length, 0, 'cloud did not fade');
  // Poison deaths are recorded as such.
  const v = S.units[1];
  v.hp = 0.5;
  S.clouds.push({ x: v.x, y: v.y, r: 2, dps: 50, t: 2 });
  run(S, 12);
  assert.ok(S.memorial.some((m) => m.name === v.name && m.cause.k === 'cause.poison'));
});

test('new zombie types join the hordes on their nights', () => {
  const S = fresh();
  const seen = new Set();
  for (let k = 0; k < 6; k++) for (const t of UB.Waves.compose(S, 12)) seen.add(t);
  for (const t of ['crawler', 'leaper', 'toxic']) assert.ok(seen.has(t), t + ' never in a night-12 horde');
  assert.ok(!UB.Waves.compose(S, 1).some((t) => t === 'leaper' || t === 'toxic'));
});

test('the tutorial holds the day clock until it ends', () => {
  const S = fresh();
  const t0 = S.clock.t;
  assert.ok(UB.Game.command(S, { type: 'tutorial', on: true }).ok);
  run(S, 200);
  assert.strictEqual(S.clock.t, t0);
  UB.Game.command(S, { type: 'tutorial', on: false });
  run(S, 20);
  assert.ok(S.clock.t > t0);
});

test('new content survives a save and load', () => {
  const S = fresh();
  S.clouds.push({ x: 10, y: 10, r: 1.8, dps: 5, t: 4 });
  S.unlocked.bp_lab = true;
  build(S, 'sawmill', 4, 10);
  const L = UB.Game.deserialize(UB.Game.serialize(S));
  assert.strictEqual(L.clouds.length, 1);
  assert.ok(L.buildings.some((b) => b.type === 'sawmill'));
  assert.ok(L.unlocked.bp_lab);
});
