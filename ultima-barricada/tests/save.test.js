// Save/load round trips and determinism; a long headless run stays healthy.

function digest(S) {
  const r = (v) => Math.round(v * 1000);
  const parts = [S.tick, S.day, S.clock.phase, JSON.stringify(S.res), S.morale, S.stats.kills, S.rng.s];
  for (const u of S.units) parts.push(u.id, r(u.x), r(u.y), r(u.hp), u.ammo, u.order ? u.order.type : '-');
  for (const z of S.zombies) parts.push(z.id, r(z.x), r(z.y), r(z.hp), z.state);
  for (const b of S.buildings) parts.push(b.id, b.type, r(b.hp), b.level, r(b.built));
  return UB.hashStr(parts.join('|'));
}

test('save and load restore the full game state', () => {
  const S = UB.Game.newGame({ seed: 'salvar', difficulty: 'hard' });
  UB.Bot.run(S, UB.Bot.active, 9, 1500);
  const json = UB.Game.serialize(S);
  assert.ok(json.length < 1500000, 'save too large: ' + json.length);
  const L = UB.Game.deserialize(json);
  assert.strictEqual(L.seed, 'salvar');
  assert.strictEqual(L.difficulty, 'hard');
  assert.strictEqual(L.units.length, S.units.length);
  assert.strictEqual(L.zombies.length, S.zombies.length);
  assert.strictEqual(L.buildings.length, S.buildings.length);
  assert.deepStrictEqual(Array.from(L.map.feature), Array.from(S.map.feature));
  assert.deepStrictEqual(Array.from(L.map.explored), Array.from(S.map.explored));
  assert.strictEqual(JSON.stringify(L.res), JSON.stringify(S.res));
  assert.strictEqual(UB.World.hq(L).id, UB.World.hq(S).id);
  assert.throws(() => UB.Game.deserialize('{"version":999}'));
});

test('a loaded game continues exactly like the original (determinism)', () => {
  const S = UB.Game.newGame({ seed: 'determinismo' });
  for (let k = 0; k < 2000; k++) { UB.Bot.active(S); UB.Game.tick(S); }
  UB.Path.updateFlow(S, true);
  UB.Buildings.computeLights(S);
  const L = UB.Game.deserialize(UB.Game.serialize(S));
  for (let k = 0; k < 1500; k++) {
    UB.Bot.active(S); UB.Game.tick(S);
    UB.Bot.active(L); UB.Game.tick(L);
  }
  assert.strictEqual(digest(L), digest(S));
});

test('headless: five days of play without errors or broken state', () => {
  const S = UB.Game.newGame({ seed: 'maratona' });
  UB.Bot.run(S, UB.Bot.active, 5);
  assert.ok(S.day >= 3 || S.over, 'game stalled');
  assert.ok(S.zombies.length <= UB.DEF.BAL.maxZombies);
  for (const e of [...S.units, ...S.zombies]) {
    assert.ok(Number.isFinite(e.x) && Number.isFinite(e.y), 'NaN position');
    assert.ok(e.x >= 0 && e.y >= 0 && e.x <= S.map.w && e.y <= S.map.h, 'entity left the map');
  }
  for (const k of UB.DEF.RES) assert.ok(S.res[k] >= 0 && Number.isFinite(S.res[k]), 'bad resource ' + k);
  assert.ok(S.stats.kills > 10);
  assert.ok(UB.Game.score(S) > 0);
});
