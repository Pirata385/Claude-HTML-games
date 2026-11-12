const test = require('node:test');
const assert = require('node:assert');
const AM = require('./load.js');

const ids = AM.BASE_IDS;
const pairs = [];
for (const a of ids) for (const b of ids) if (a !== b) pairs.push([a, b]);

test('there are at least 16 bases, 6 unlocked at the start', () => {
  assert.ok(ids.length >= 16, `${ids.length} bases`);
  assert.strictEqual(ids.filter((id) => AM.BASES[id].unlocked).length, 6);
  const cats = new Set(ids.map((id) => AM.BASES[id].cat));
  assert.deepStrictEqual([...cats].sort(), ['animal', 'object', 'weird']);
});

test('fusion is deterministic', () => {
  for (const [a, b] of pairs.slice(0, 60)) assert.deepStrictEqual(AM.fuse(a, b, 3), AM.fuse(a, b, 3));
});

test('every ordered pair gives a valid genome', () => {
  for (const [a, b] of pairs) {
    const g = AM.fuse(a, b, 0);
    const where = `${a}×${b}`;
    assert.ok(['quadruped', 'biped', 'hover', 'hop'].includes(g.posture), where + ' posture');
    for (const k of ['w', 'h', 'l']) assert.ok(g.body[k] >= 0.28 && g.body[k] <= 1.45, `${where} body.${k}=${g.body[k]}`);
    const mx = Math.max(g.body.w, g.body.h, g.body.l), mn = Math.min(g.body.w, g.body.h, g.body.l);
    assert.ok(mx / mn <= 3.45, where + ' body ratio');
    if (g.head.shape !== 'none' && g.head.shape !== 'lid') assert.ok(Math.max(g.head.w, g.head.h, g.head.l) <= mx * 0.86 + 1e-9, where + ' head too big');
    if (g.legs) {
      assert.ok([2, 4, 6, 8].includes(g.legs.count), `${where} legs ${g.legs.count}`);
      if (g.posture === 'biped') assert.strictEqual(g.legs.count, 2);
      if (g.posture === 'quadruped') assert.ok(g.legs.count >= 4);
      assert.ok(g.legs.len > 0 && g.legs.thick > 0);
    } else assert.ok(g.posture === 'hover' || g.posture === 'hop', where + ' legless walker');
    const anchors = {};
    for (const e of g.extras) anchors[e.anchor] = (anchors[e.anchor] || 0) + 1;
    for (const k in anchors) assert.ok(anchors[k] <= 1, `${where} anchor ${k} over capacity`);
    assert.ok(g.extras.length <= 3, where + ' too many extras');
    for (const c of Object.values(g.palette)) assert.ok(AM.isHex(c), `${where} colour ${c}`);
    assert.ok(Math.abs(AM.lightness(g.palette.primary) - AM.lightness(g.palette.secondary)) >= 0.1, where + ' contrast');
    for (const k of ['hp', 'atk', 'def', 'energy', 'spd']) assert.ok(Number.isFinite(g.stats[k]) && g.stats[k] > 0, where + ' stat ' + k);
    assert.ok(AM.ATTACKS[g.attack], where + ' attack');
    assert.strictEqual(g.traits.length, 2);
    assert.ok(/^[A-Z][a-z]{3,11}$/.test(g.name), `${where} name "${g.name}"`);
  }
});

test('every fusion reads as both parents', () => {
  for (const [a, b] of pairs) {
    const g = AM.fuse(a, b, 0);
    const vals = Object.values(g.from);
    assert.ok(vals.includes(a) && vals.includes(b), `${a}×${b} misses a parent`);
    const fromA = g.extras.some((e) => e.src === 0) || ['body', 'head', 'legs', 'tail', 'wings', 'arms', 'color'].some((k) => g.from[k] === a);
    const fromB = g.extras.some((e) => e.src === 1) || ['body', 'head', 'legs', 'tail', 'wings', 'arms', 'color'].some((k) => g.from[k] === b);
    assert.ok(fromA && fromB, `${a}×${b} not readable`);
  }
});

test('no obvious rule: slots come from both mother and father across pairs', () => {
  for (const slot of ['body', 'head', 'legs', 'color']) {
    let m = 0;
    for (const [a, b] of pairs) if (AM.fuse(a, b, 0).from[slot] === a) m++;
    const share = m / pairs.length;
    assert.ok(share > 0.3 && share < 0.7, `${slot} from mother ${share.toFixed(2)}`);
  }
});

test('variants differ and order matters', () => {
  let diffVariant = 0, diffOrder = 0;
  for (const [a, b] of pairs.slice(0, 120)) {
    const g0 = AM.fuse(a, b, 0), g1 = AM.fuse(a, b, 1), r = AM.fuse(b, a, 0);
    if (JSON.stringify(g0.from) !== JSON.stringify(g1.from) || g0.palette.primary !== g1.palette.primary) diffVariant++;
    if (JSON.stringify(g0.body) !== JSON.stringify(r.body) || g0.name !== r.name) diffOrder++;
  }
  assert.ok(diffVariant > 100, `variants differ in ${diffVariant}/120`);
  assert.ok(diffOrder > 110, `order differs in ${diffOrder}/120`);
});

test('pure creatures keep their parent', () => {
  for (const id of ids) {
    const g = AM.fuse(id, id, 0);
    assert.strictEqual(g.name, AM.BASES[id].name);
    assert.strictEqual(g.traits[0].str, 1);
  }
});
