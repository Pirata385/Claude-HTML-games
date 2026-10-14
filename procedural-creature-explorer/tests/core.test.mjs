// Core logic tests for Procedural Creature Explorer.
// Run from the repository root:  node --test procedural-creature-explorer/tests/
// The DOM-free core section (<script id="pce-core">) is extracted from index.html
// and evaluated in an isolated VM context, exactly as the game and its workers load it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const m = html.match(/<script id="pce-core">([\s\S]*?)<\/script>/);
assert.ok(m, 'core script section present');
const ctx = { console, Math, Date };
ctx.globalThis = ctx;
vm.createContext(ctx);
vm.runInContext(m[1], ctx);
const P = ctx.PCE;
const seeds = (n, salt) => Array.from({ length: n }, (_, i) => P.hashInts(i, salt));

test('single-file layout keeps HTML, CSS and JS sections separate', () => {
  assert.match(html, /<style>[\s\S]*<\/style>/);
  for (const id of ['pce-core', 'pce-worker', 'pce-render', 'pce-game']) assert.ok(html.includes(`<script id="${id}"`), id);
  assert.ok(!/<script[^>]+src=/.test(html), 'no external scripts');
});

test('RNG and noise are deterministic and bounded', () => {
  const a = new P.RNG(42), b = new P.RNG(42);
  for (let i = 0; i < 100; i++) assert.equal(a.next(), b.next());
  const n = new P.Simplex(7);
  let mn = 1, mx = -1;
  for (let i = 0; i < 2000; i++) {
    const v = n.noise2(i * 0.37, i * 0.11), w = n.noise3(i * 0.21, i * 0.07, i * 0.13);
    mn = Math.min(mn, v, w); mx = Math.max(mx, v, w);
  }
  assert.ok(mn >= -1.001 && mx <= 1.001, `range ${mn}..${mx}`);
  assert.ok(Math.abs(n.noise2(10, 10) - n.noise2(10.001, 10)) < 0.01, 'continuous');
});

test('world generation is deterministic, seamless and varied', () => {
  const w1 = new P.World(1234), w2 = new P.World(1234);
  for (let i = 0; i < 50; i++) assert.deepEqual(w1.column(i * 13 - 300, i * 7 - 100), w2.column(i * 13 - 300, i * 7 - 100));
  const c00 = P.buildChunk(w1, 0, 0), c10 = P.buildChunk(w1, 1, 0);
  for (let z = 0; z < P.CHUNK; z++) {
    assert.equal(c00.tiles[z * P.CHUNK + 15], w1.column(15, z).h);
    assert.equal(c10.tiles[z * P.CHUNK], w1.column(16, z).h);
  }
  assert.ok(c00.terrain.nv > 0 && c00.terrain.ni % 3 === 0);
  for (let i = 0; i < c00.terrain.ni; i++) assert.ok(c00.terrain.ibuf[i] < c00.terrain.nv);
  const seen = new Set();
  for (let x = -3000; x <= 3000; x += 60) for (let z = -3000; z <= 3000; z += 60) seen.add(w1.column(x, z).b);
  assert.ok(seen.size >= 8, `biomes seen: ${seen.size}`);
  const [sx, sz] = w1.findSpawn();
  assert.ok(w1.column(Math.floor(sx), Math.floor(sz)).h >= 2, 'spawn on dry land');
});

test('every class builds valid skeletons within the bone budget', () => {
  for (const cls of P.CLASSES) {
    for (const seed of seeds(30, cls.length * 17)) {
      const sp = P.makeSpecies({ seed, cls, biome: 2 + (seed % 10) });
      const nodes = sp.body.nodes;
      assert.ok(nodes.length <= P.MAX_BONES, `${cls} bones ${nodes.length}`);
      nodes.forEach((n, i) => {
        assert.ok(n.parent < i, 'parents precede children');
        assert.ok(n.pos.every(Number.isFinite), 'finite rest pose');
      });
      assert.ok(sp.body.prims.length > 0);
      assert.ok(sp.body.standH > 0);
      for (const leg of sp.body.legs) {
        const toe = nodes[leg.nodes[leg.nodes.length - 1]].pos;
        assert.ok(toe[1] < sp.G.L * 0.25, `${cls}/${sp.G.arch} foot near ground (${toe[1].toFixed(3)})`);
      }
      assert.ok(sp.names.common.length > 2 && /^[A-Z][a-z]+ [a-z]+$/.test(sp.names.scientific), sp.names.scientific);
    }
  }
});

test('species are reproducible from their saved spec alone', () => {
  const spec = { seed: 987654321, cls: 'chimerid', biome: 11 };
  const a = P.makeSpecies(spec), b = P.makeSpecies(JSON.parse(JSON.stringify(spec)));
  assert.equal(JSON.stringify(a.G), JSON.stringify(b.G));
  assert.equal(a.names.scientific, b.names.scientific);
  assert.equal(a.body.nodes.length, b.body.nodes.length);
});

test('anatomy differs profoundly, not only in size and colour', () => {
  const insects = seeds(160, 5).map((seed) => P.makeSpecies({ seed, cls: 'insect', biome: 3 }));
  const archs = new Set(insects.map((s) => s.G.arch));
  const legs = new Set(insects.map((s) => s.stats.legs));
  const segs = insects.map((s) => s.stats.segments);
  assert.ok(archs.size >= 8, `insect body plans: ${[...archs]}`);
  assert.ok(legs.size >= 5, `insect leg counts: ${[...legs]}`);
  assert.ok(Math.max(...segs) >= 14 && Math.min(...segs) <= 4, `segments ${Math.min(...segs)}..${Math.max(...segs)}`);
  assert.ok(insects.some((s) => s.stats.legs !== 6 && s.G.arch !== 'myriapod' && s.G.arch !== 'larva'), 'plausible leg-count exceptions occur');
  const chim = seeds(40, 9).map((seed) => P.makeSpecies({ seed, cls: 'chimerid', biome: 11 }));
  for (const c of chim) assert.ok(new Set(Object.values(c.G.donors)).size >= 1);
  assert.ok(chim.filter((c) => new Set(Object.values(c.G.donors)).size >= 3).length > 10, 'chimerids mix several classes');
  const mam = seeds(80, 13).map((seed) => P.makeSpecies({ seed, cls: 'mammal', biome: 2 }));
  assert.ok(new Set(mam.map((s) => s.G.arch)).size >= 8);
  assert.ok(new Set(mam.map((s) => s.stats.legs)).size >= 2, 'bipeds and quadrupeds');
});

test('creature meshes are valid, weighted and outward facing', () => {
  for (const cls of P.CLASSES) {
    const sp = P.makeSpecies({ seed: P.hashInts(3, cls.length), cls, biome: 3 });
    const mesh = P.meshBodySync(sp.body);
    assert.ok(mesh.nv > 200, `${cls} vertices ${mesh.nv}`);
    assert.equal(mesh.ni % 3, 0);
    const f32 = new Float32Array(mesh.vbuf.buffer, mesh.vbuf.byteOffset, mesh.nv * 7);
    const i8 = new Int8Array(mesh.vbuf.buffer, mesh.vbuf.byteOffset, mesh.nv * 28);
    const u16 = new Uint16Array(mesh.vbuf.buffer, mesh.vbuf.byteOffset, mesh.nv * 14);
    const u8 = new Uint8Array(mesh.vbuf.buffer, mesh.vbuf.byteOffset, mesh.nv * 28);
    for (let v = 0; v < mesh.nv; v++) {
      assert.ok(Number.isFinite(f32[v * 7]) && Number.isFinite(f32[v * 7 + 1]) && Number.isFinite(f32[v * 7 + 2]));
      assert.ok(u16[v * 14 + 10] < sp.body.nodes.length && u16[v * 14 + 11] < sp.body.nodes.length, 'bone index range');
      assert.ok(u8[v * 28 + 24] >= 127, 'primary weight >= 0.5');
    }
    let out = 0, tot = 0;
    for (let t = 0; t < mesh.ni; t += 3) {
      const [a, b, c] = [mesh.ibuf[t], mesh.ibuf[t + 1], mesh.ibuf[t + 2]];
      assert.ok(a < mesh.nv && b < mesh.nv && c < mesh.nv);
      const p = (i) => [f32[i * 7], f32[i * 7 + 1], f32[i * 7 + 2]];
      const n = P.vCross(P.vSub(p(b), p(a)), P.vSub(p(c), p(a)));
      const vn = [i8[a * 28 + 12], i8[a * 28 + 13], i8[a * 28 + 14]];
      if (P.vLen(n) < 1e-9) continue;
      tot++;
      if (P.vDot(n, vn) > 0) out++;
    }
    assert.ok(out / tot > 0.9, `${cls} outward winding ${(out / tot).toFixed(3)}`);
  }
});

test('procedural gait keeps feet planted and bones rigid', () => {
  for (const [cls, salt] of [['mammal', 1], ['insect', 2], ['reptile', 3], ['bird', 4]]) {
    const sp = P.makeSpecies({ seed: P.hashInts(salt, 77), cls, biome: 3 });
    const pose = new P.Pose(sp.rig, 1);
    const c = { t: 0, x: 0, z: 0, y: 0, groundY: 0, yaw: 0.3, speed: sp.rig.walkSpeed, turnRate: 0, pitch: 0, roll: 0, crouch: 0, lookYaw: 0, lookPitch: 0, headDown: 0, jawOpen: 0, wingOpen: 0, rear: 0, display: 0, tailRaise: 0, excite: 0, headTilt: 0, strike: 0, flying: false, swim: false, glide: 0, wiggle: 0 };
    let planted = 0, samples = 0;
    for (let f = 0; f < 240; f++) {
      c.t += 1 / 60; c.x += Math.sin(c.yaw) * c.speed / 60; c.z += Math.cos(c.yaw) * c.speed / 60;
      pose.update(c, 1 / 60, () => 0);
      assert.ok(pose.mats.every(Number.isFinite), 'finite skinning matrices');
      for (const f2 of pose.feet) { samples++; if (!f2.swing && Math.abs(f2.cur[1]) < 1e-6) planted++; }
    }
    if (sp.rig.legs.length) assert.ok(planted / samples > 0.4, `${cls} stance ratio ${(planted / samples).toFixed(2)}`);
    // bone lengths preserved by the hierarchical solve
    for (let i = 1; i < sp.rig.n; i++) {
      const pp = sp.rig.parent[i];
      const rest = Math.hypot(sp.rig.restOff[i * 3], sp.rig.restOff[i * 3 + 1], sp.rig.restOff[i * 3 + 2]);
      assert.ok(Math.abs(P.vDist(pose.P[i], pose.P[pp]) - rest) < 1e-3, 'bone length preserved');
    }
  }
});

test('creatures behave without numerical blow-ups', () => {
  const env = {
    ground: (x, z) => Math.floor(Math.sin(x * 0.2) * 2) * P.STEP, water: () => 0, walkable: () => true,
    push: () => [0, 0], player: { x: 3, z: 3, y: 0 }, night: 0, creatures: [], playerMoving: true,
  };
  for (const cls of P.CLASSES) {
    const sp = P.makeSpecies({ seed: P.hashInts(11, cls.length), cls, biome: 4 });
    const c = new P.Creature(sp, 0, 0, 0, 1, env);
    env.creatures = [c];
    c.react('whistle', 3, 3, env);
    for (let i = 0; i < 600; i++) c.update(1 / 30, env);
    assert.ok(Number.isFinite(c.x) && Number.isFinite(c.z) && Number.isFinite(c.y), cls);
    assert.ok(c.pose.mats.every(Number.isFinite));
  }
});

test('ecology pools and save data round-trip', () => {
  const pool = P.speciesPool(555, 100, 200, P.B.FOREST);
  assert.equal(pool.length, 5);
  assert.deepEqual(pool, P.speciesPool(555, 100, 200, P.B.FOREST));
  for (const s of pool) assert.ok(P.CLASSES.includes(s.cls));
  const sv = P.newSave(77);
  const sp = P.makeSpecies(pool[0]);
  sv.bestiary[sp.key] = { spec: sp.spec, name: 'Test Critter', sightings: 2 };
  sv.bestiary.bogus = { spec: { seed: 1, cls: 'dragon' } };
  const back = P.sanitizeSave(JSON.parse(JSON.stringify(sv)));
  assert.equal(Object.keys(back.bestiary).length, 1);
  assert.equal(P.makeSpecies(back.bestiary[sp.key].spec).names.scientific, sp.names.scientific);
  assert.equal(P.rankFor(0), 'Greenhorn');
  assert.match(P.genomeCode(sp.spec), /^[A-Z]{2}-[0-9A-F]+-[0-9A-F]+$/);
});
