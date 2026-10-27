// Procedural maps: reproducible from the seed, coherent, navigable and with a fair start.
const W = UB.World;
const SEEDS = ['teste', 'alfa', 'beta', 'gama', '12345'];

function mapHash(S) {
  let h = 2166136261;
  const mix = (v) => { h ^= v; h = Math.imul(h, 16777619) >>> 0; };
  for (const k of ['terrain', 'feature', 'famt']) for (const v of S.map[k]) mix(v);
  for (const p of S.pois) { mix(p.tx); mix(p.ty); mix(p.w); mix(UB.hashStr(p.type)); }
  return h >>> 0;
}

function reachable(S) {
  const N = S.map.w;
  const hq = W.hq(S);
  const start = W.nearestOpen(S, hq.tx + 1, hq.ty + 3, false, 4);
  const seen = new Uint8Array(N * N);
  const q = [start.y * N + start.x];
  seen[q[0]] = 1;
  while (q.length) {
    const i = q.pop();
    const x = i % N, y = (i / N) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const xx = x + dx, yy = y + dy;
      if (xx < 0 || yy < 0 || xx >= N || yy >= N) continue;
      const j = yy * N + xx;
      if (seen[j] || S._blockU[j]) continue;
      seen[j] = 1; q.push(j);
    }
  }
  return seen;
}

test('same seed produces the same map; different seeds differ', () => {
  const a = UB.Game.newGame({ seed: 'repro' });
  const b = UB.Game.newGame({ seed: 'repro' });
  const c = UB.Game.newGame({ seed: 'outra' });
  assert.strictEqual(mapHash(a), mapHash(b));
  assert.notStrictEqual(mapHash(a), mapHash(c));
  assert.strictEqual(a.zombies.length, b.zombies.length);
});

test('every POI entrance and horde spawn is reachable from the base', () => {
  for (const seed of SEEDS) {
    const S = UB.Game.newGame({ seed });
    const seen = reachable(S);
    const N = S.map.w;
    for (const p of S.pois) assert.ok(seen[p.ey * N + p.ex], `${seed}: ${p.type} at ${p.ex},${p.ey} unreachable`);
    assert.ok(S.spawns.length >= 4, `${seed}: too few spawns`);
    for (const sp of S.spawns) assert.ok(seen[sp.y * N + sp.x], `${seed}: spawn ${sp.x},${sp.y} unreachable`);
  }
});

test('key places exist and dangerous ones are far from the base', () => {
  for (const seed of SEEDS) {
    const S = UB.Game.newGame({ seed });
    const types = new Set(S.pois.map((p) => p.type));
    for (const t of ['hospital', 'police', 'gas', 'nest', 'house', 'warehouse', 'camp']) assert.ok(types.has(t), `${seed}: missing ${t}`);
    for (const p of S.pois) {
      const d = Math.hypot(p.tx + p.w / 2 - S.base.x, p.ty + p.h / 2 - S.base.y);
      if (UB.DEF.POIS[p.type].danger >= 4) assert.ok(d >= 24, `${seed}: ${p.type} too close (${d.toFixed(1)})`);
      assert.ok(d >= 10, `${seed}: ${p.type} inside the base area`);
    }
  }
});

test('balanced start: wood, scrap and houses near the base, no zombies on top of it', () => {
  const F = UB.DEF.F;
  for (const seed of SEEDS) {
    const S = UB.Game.newGame({ seed });
    const N = S.map.w;
    let wood = 0, scrap = 0;
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      if (Math.hypot(x - S.base.x, y - S.base.y) > 14) continue;
      const f = S.map.feature[y * N + x];
      if (f === F.TREE || f === F.PINE || f === F.DEADTREE) wood++;
      if (f === F.CAR || f === F.DEBRIS || f === F.CONTAINER) scrap++;
    }
    assert.ok(wood >= 12, `${seed}: only ${wood} trees near base`);
    assert.ok(scrap >= 3, `${seed}: only ${scrap} scrap sources near base`);
    const houses = S.pois.filter((p) => p.type === 'house' && Math.hypot(p.tx - S.base.x, p.ty - S.base.y) < 24).length;
    assert.ok(houses >= 2, `${seed}: only ${houses} houses near base`);
    const close = S.zombies.filter((z) => Math.hypot(z.x - S.base.x, z.y - S.base.y) < 14).length;
    assert.strictEqual(close, 0, `${seed}: zombies spawned inside the safe radius`);
    assert.strictEqual(S.units.length, 4);
  }
});
