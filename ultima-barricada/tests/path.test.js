// Pathfinding and the horde flow field interact with structures the way the design says.
const W = UB.World;

// A flat, empty test arena: all grass, everything explored, HQ in the middle.
function arena() {
  const S = UB.Game.newGame({ seed: 'arena' });
  const N = S.map.w;
  S.map.terrain.fill(UB.DEF.T.GRASS);
  S.map.feature.fill(0);
  S.map.famt.fill(0);
  S.map.explored.fill(1);
  for (const p of S.pois) p.dead = true;
  S.pois = [];
  S.zombies = [];
  const hq = W.hq(S);
  W.rebuild(S);
  UB.Game.initTransient(S);
  UB.Path.updateFlow(S, true);
  return { S, N, hq };
}
function wall(S, type, x, y) {
  const b = UB.Buildings.create(S, type, x, y, { built: true });
  return b;
}

test('A* walks around a wall and never through it', () => {
  const { S, hq } = arena();
  const cx = hq.tx + 1, cy = hq.ty + 1;
  for (let y = cy - 6; y <= cy + 6; y++) wall(S, 'wall', cx + 6, y);
  const p = UB.Path.find(S, cx + 4, cy, cx + 9, cy, {});
  assert.ok(p && p.length > 5, 'no path');
  const N = S.map.w;
  for (const i of p) assert.strictEqual(S._blockU[i], 0, 'path crosses a blocked tile');
  // Detour: longer than the straight 5-tile line.
  assert.ok(p.length > 8);
  assert.strictEqual(p[p.length - 1], cy * N + cx + 9);
});

test('gates let survivors through but not zombies', () => {
  const { S, hq } = arena();
  const cx = hq.tx + 1, cy = hq.ty + 1;
  // Closed ring of walls around the HQ with one gate.
  const r = 5;
  for (let d = -r; d <= r; d++) {
    for (const [x, y] of [[cx + d, cy - r], [cx + d, cy + r], [cx - r, cy + d], [cx + r, cy + d]]) {
      if (S._occ[W.idx(S, x, y)]) continue;
      wall(S, x === cx && y === cy + r ? 'gate' : 'wall', x, y);
    }
  }
  const outside = [cx, cy + r + 3];
  const pu = UB.Path.find(S, outside[0], outside[1], cx, cy - 2, {});
  assert.ok(pu, 'survivor cannot get in through the gate');
  const pz = UB.Path.find(S, outside[0], outside[1], cx, cy - 2, { zombie: true, limit: 20000 });
  assert.strictEqual(pz, null, 'zombie walked through the gate');
});

test('flow field: hordes use a gap when there is one and break walls when there is none', () => {
  const { S, hq } = arena();
  const N = S.map.w;
  const cx = hq.tx + 1, cy = hq.ty + 1, r = 5;
  const ring = [];
  for (let d = -r; d <= r; d++) for (const [x, y] of [[cx + d, cy - r], [cx + d, cy + r], [cx - r, cy + d], [cx + r, cy + d]]) {
    if (!S._occ[W.idx(S, x, y)]) ring.push(wall(S, 'wall', x, y));
  }
  // Follow the flow from outside; record whether a structure is hit before reaching the HQ.
  const walk = () => {
    UB.Path.updateFlow(S, true);
    let x = cx + 0.5, y = cy + r + 8.5, hitStruct = false;
    for (let k = 0; k < 200; k++) {
      const next = UB.Path.flowNext(S, x, y);
      if (next < 0) break;
      if (S._struct[next]) {
        const b = W.get(S, S._struct[next]);
        if (b.type === 'hq') break;
        hitStruct = true; break;
      }
      x = (next % N) + 0.5; y = ((next / N) | 0) + 0.5;
    }
    return hitStruct;
  };
  assert.strictEqual(walk(), true, 'closed base: the horde should have to attack a wall');
  // Open a gap on the far side: the horde should walk around to it instead.
  const gap = ring.find((b) => b.tx === cx && b.ty === cy - r);
  UB.Buildings.remove(S, gap);
  assert.strictEqual(walk(), false, 'with a gap, the horde should go around through it');
});
