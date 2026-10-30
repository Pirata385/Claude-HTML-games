import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ATTRS, computeStats, soft } from '../js/systems/stats.js';
import { xpToNext, addXp, applyDeathPenalty, killXp, MAX_LEVEL, POINTS_PER_LEVEL } from '../js/systems/progression.js';
import * as Inv from '../js/systems/inventory.js';
import { equip, canEquip, equippedDefs, compareItems, bestTool } from '../js/systems/equipment.js';
import { checkRecipe, craft } from '../js/systems/crafting.js';
import { canGather, gatherDamage, rollYield } from '../js/systems/gathering.js';
import { newProfile, serialize, deserialize, SaveStore, SAVE_VERSION, exportString, importString } from '../js/systems/save.js';
import { DEFAULT_SETTINGS, mergeSettings } from '../js/systems/settings.js';
import { WaveDirector, composeWave } from '../js/systems/waveDirector.js';
import { DayNight } from '../js/systems/dayNight.js';
import { allocate, respec } from '../js/systems/attributes.js';
import { enemyHp, enemyDmg } from '../js/systems/scaling.js';
import { RECIPES } from '../js/data/recipes.js';
import { ITEMS } from '../js/data/items.js';
import { NODES } from '../js/data/nodes.js';
import { WAVES } from '../js/data/waves.js';
import { ENEMIES } from '../js/data/enemies.js';
import { CLASS_IDS } from '../js/data/classes.js';
import { makeRng } from '../js/core/rng.js';

const fresh = (classId = 'swordsman') => newProfile({ name: 'Tess', classId, slot: 0, seed: 77 });

test('soft cap grows monotonically with diminishing returns', () => {
  assert.ok(soft(100, 0.01, 200) > soft(50, 0.01, 200));
  assert.ok(soft(200, 0.01, 200) - soft(100, 0.01, 200) < soft(100, 0.01, 200) - soft(0, 0.01, 200));
});

test('every attribute changes at least one derived stat for every class', () => {
  for (const cls of CLASS_IDS) {
    const p = fresh(cls);
    const base = computeStats(p, []);
    for (const a of ATTRS) {
      const q = fresh(cls); q.attrs[a] += 50;
      const s = computeStats(q, []);
      const changed = Object.keys(base).some((k) => typeof base[k] === 'number' && Math.abs(s[k] - base[k]) > 1e-9);
      assert.ok(changed, `${cls}: ${a} does nothing`);
    }
  }
});

test('gear adds power and defense', () => {
  const p = fresh();
  const bare = computeStats(p, []);
  const s = computeStats(p, [ITEMS.swordsman_weapon_iron, ITEMS.swordsman_armor_iron]);
  assert.ok(s.power > bare.power && s.def > bare.def && s.maxHp > bare.maxHp);
});

test('xp curve: increasing, capped at 300', () => {
  for (let L = 1; L < MAX_LEVEL - 1; L++) assert.ok(xpToNext(L + 1) > xpToNext(L));
  assert.equal(xpToNext(MAX_LEVEL), Infinity);
  assert.equal(MAX_LEVEL, 300);
});

test('addXp levels up and grants attribute points', () => {
  const p = fresh();
  const res = addXp(p, xpToNext(1) + xpToNext(2) + 5);
  assert.equal(res.levelsGained, 2);
  assert.equal(p.level, 3);
  assert.equal(p.attrPoints, 2 * POINTS_PER_LEVEL);
  assert.equal(p.xp, 5);
});

test('addXp never exceeds the level cap', () => {
  const p = fresh(); p.level = 299;
  addXp(p, 1e12);
  assert.equal(p.level, 300);
  assert.equal(p.xp, 0);
});

test('death penalty loses part of the level progress, never a level', () => {
  const p = fresh(); p.level = 10; p.xp = 10;
  applyDeathPenalty(p);
  assert.equal(p.level, 10);
  assert.equal(p.xp, 0);
  p.xp = xpToNext(10) - 1;
  applyDeathPenalty(p);
  assert.ok(p.xp < xpToNext(10) - 1 && p.xp > 0);
});

test('kill xp favours equal or higher level enemies', () => {
  assert.ok(killXp(10, 20, 20) > killXp(10, 5, 20));
  assert.ok(killXp(10, 25, 20) >= killXp(10, 20, 20));
  assert.ok(killXp(10, 1, 60) > 0);
});

test('attribute allocation and respec', () => {
  const p = fresh(); p.attrPoints = 5;
  assert.equal(allocate(p, 'str', 3), true);
  assert.equal(p.attrs.str, 3);
  assert.equal(p.attrPoints, 2);
  assert.equal(allocate(p, 'str', 3), false);
  respec(p);
  assert.equal(p.attrs.str, 0);
  assert.equal(p.attrPoints, 5);
});

test('inventory stacks and items', () => {
  const p = fresh();
  Inv.addStack(p.inv, 'wood', 5);
  assert.equal(Inv.count(p.inv, 'wood'), 5);
  assert.equal(Inv.takeStack(p.inv, 'wood', 6), false);
  assert.equal(Inv.takeStack(p.inv, 'wood', 2), true);
  assert.equal(Inv.count(p.inv, 'wood'), 3);
  const uid = Inv.addItem(p.inv, 'pickaxe_wood');
  assert.ok(Inv.findItem(p.inv, uid));
  Inv.removeItem(p.inv, uid);
  assert.equal(Inv.findItem(p.inv, uid), undefined);
});

test('equip: class items need the current class, but never a level', () => {
  const p = fresh('mage'); p.level = 1;
  const staff = Inv.addItem(p.inv, 'mage_weapon_diamond');
  const sword = Inv.addItem(p.inv, 'swordsman_weapon_wood');
  assert.equal(canEquip(p, ITEMS.mage_weapon_diamond).ok, true);
  assert.equal(equip(p, staff).ok, true);
  assert.equal(equip(p, sword).ok, false);
  assert.equal(equippedDefs(p)[0].id, 'mage_weapon_diamond');
});

test('equip: two accessory slots, boss uniques fit any class', () => {
  const p = fresh('archer');
  const a = Inv.addItem(p.inv, 'archer_accessory_wood');
  const b = Inv.addItem(p.inv, 'princes_crown');
  assert.equal(equip(p, a).ok, true);
  assert.equal(equip(p, b).ok, true);
  assert.equal(equippedDefs(p).filter((d) => d.slot === 'accessory').length, 2);
});

test('compareItems reports stat deltas', () => {
  const d = compareItems(ITEMS.swordsman_weapon_iron, ITEMS.swordsman_weapon_wood);
  const pw = d.find((x) => x.stat === 'power');
  assert.ok(pw.delta > 0);
});

test('bestTool picks the highest tier owned', () => {
  const p = fresh();
  Inv.addItem(p.inv, 'pickaxe_wood'); Inv.addItem(p.inv, 'pickaxe_iron'); Inv.addItem(p.inv, 'axe_stone');
  assert.equal(bestTool(p.inv, 'pickaxe').id, 'pickaxe_iron');
  assert.equal(bestTool(p.inv, 'axe').id, 'axe_stone');
});

test('crafting needs level and materials, and consumes them', () => {
  const p = fresh();
  const r = RECIPES.craft_pickaxe_stone;
  let c = checkRecipe(p, r);
  assert.equal(c.craftable, false);
  assert.ok(c.missing.length > 0);
  for (const [id, n] of Object.entries(r.inputs)) Inv.addStack(p.inv, id, n);
  p.level = r.level - 1;
  c = checkRecipe(p, r);
  assert.equal(c.levelOk, r.level <= 1);
  p.level = r.level;
  c = checkRecipe(p, r);
  assert.equal(c.craftable, true);
  const out = craft(p, r);
  assert.equal(out.ok, true);
  assert.equal(out.firstTime, true);
  for (const id of Object.keys(r.inputs)) assert.equal(Inv.count(p.inv, id), 0);
  assert.ok(Inv.findItem(p.inv, out.uid));
  for (const [id, n] of Object.entries(r.inputs)) Inv.addStack(p.inv, id, n);
  assert.equal(craft(p, r).firstTime, false);
});

test('crafting a consumable adds to its stack', () => {
  const p = fresh();
  const r = RECIPES.craft_healing_tonic;
  for (const [id, n] of Object.entries(r.inputs)) Inv.addStack(p.inv, id, n);
  const before = Inv.count(p.inv, 'healing_tonic');
  assert.equal(craft(p, r).ok, true);
  assert.equal(Inv.count(p.inv, 'healing_tonic'), before + r.output.count);
});

test('gathering requires the right tool tier', () => {
  const p = fresh();
  assert.equal(canGather(p.inv, NODES.tree_oak).ok, true); // hands
  assert.equal(canGather(p.inv, NODES.boulder).ok, false);
  Inv.addItem(p.inv, 'pickaxe_wood');
  assert.equal(canGather(p.inv, NODES.boulder).ok, true);
  const iron = canGather(p.inv, NODES.ore_iron);
  assert.equal(iron.ok, false);
  assert.match(iron.reason, /Copper|Gold/);
  Inv.addItem(p.inv, 'pickaxe_gold');
  assert.equal(canGather(p.inv, NODES.ore_iron).ok, true);
});

test('gather damage scales with tool and strength', () => {
  assert.ok(gatherDamage(ITEMS.axe_iron, 1) > gatherDamage(null, 1));
  assert.ok(gatherDamage(null, 1.5) > gatherDamage(null, 1));
});

test('rollYield stays within the node range (plus luck bonus)', () => {
  const rng = makeRng(3);
  for (let i = 0; i < 100; i++) {
    const y = rollYield(NODES.ore_copper, 0, rng);
    assert.ok(y >= NODES.ore_copper.yield[0] && y <= NODES.ore_copper.yield[1]);
  }
});

test('save round-trip keeps the profile', () => {
  const p = fresh(); p.level = 12; p.attrs.dex = 7; Inv.addStack(p.inv, 'iron', 4);
  const back = deserialize(serialize(p));
  assert.equal(back.ok, true);
  assert.deepEqual(back.profile, p);
});

test('save detects corruption', () => {
  const s = serialize(fresh());
  const bad = s.replace('"Tess"', '"Tesz"');
  assert.equal(deserialize(bad).ok, false);
  assert.equal(deserialize('garbage').ok, false);
});

test('save migrates older versions', () => {
  const p = fresh();
  const old = JSON.parse(serialize(p));
  old.data.version = 0; delete old.data.hints;
  const res = deserialize(JSON.stringify({ v: 0, data: old.data, sum: undefined }), { skipChecksum: true });
  assert.equal(res.ok, true);
  assert.equal(res.profile.version, SAVE_VERSION);
  assert.ok(Array.isArray(res.profile.hints));
});

test('SaveStore uses slots and falls back to the backup on corruption', () => {
  const mem = new Map();
  const storage = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) };
  const store = new SaveStore(storage);
  const p = fresh(); p.level = 3;
  store.save(0, p);
  p.level = 4;
  store.save(0, p);
  assert.equal(store.load(0).profile.level, 4);
  mem.set(store.key(0), '{"broken":');
  const res = store.load(0);
  assert.equal(res.ok, true);
  assert.equal(res.profile.level, 3);
  assert.equal(res.recovered, true);
  assert.equal(store.list().filter(Boolean).length, 1);
  store.remove(0);
  assert.equal(store.load(0).ok, false);
});

test('export/import string round-trip', () => {
  const p = fresh(); p.level = 9;
  const back = importString(exportString(p));
  assert.equal(back.ok, true);
  assert.equal(back.profile.level, 9);
});

test('settings merge keeps defaults and rejects junk', () => {
  const s = mergeSettings({ audio: { music: 0.2, bogus: 3 }, graphics: { preset: 'nope' } });
  assert.equal(s.audio.music, 0.2);
  assert.equal(s.audio.master, DEFAULT_SETTINGS.audio.master);
  assert.equal(s.graphics.preset, DEFAULT_SETTINGS.graphics.preset);
  assert.equal(s.audio.bogus, undefined);
});

test('composeWave spends its budget and unlocks roles over waves', () => {
  const rng = makeRng(11);
  const cfg = WAVES.island;
  const early = composeWave(cfg, 'night', 0, 10, rng);
  const late = composeWave(cfg, 'night', 6, 30, rng);
  const roles = (list) => new Set(list.map((id) => ENEMIES[id].role));
  assert.ok(early.length > 0 && late.length > early.length);
  assert.ok(!roles(early).has('support'));
  assert.ok(roles(late).has('support') || roles(late).has('tank'));
  assert.ok(early.every((id) => ENEMIES[id].family === 'zombie'));
});

test('WaveDirector alternates calm and wave and requests spawns', () => {
  const wd = new WaveDirector(WAVES.island, makeRng(5));
  let spawned = 0, waves = 0;
  wd.onWaveStart = () => waves++;
  for (let t = 0; t < 400; t += 0.5) {
    const req = wd.update(0.5, { phase: 'day', playerLevel: 5, alive: 0 });
    spawned += req.length;
  }
  assert.ok(waves >= 2, `waves ${waves}`);
  assert.ok(spawned > 10);
});

test('DayNight cycles day then night', () => {
  const dn = new DayNight({ dayLen: 10, nightLen: 5 }, 0);
  assert.equal(dn.phase, 'day');
  dn.advance(11);
  assert.equal(dn.phase, 'night');
  dn.advance(5);
  assert.equal(dn.phase, 'day');
  assert.ok(dn.sun >= -1 && dn.sun <= 1);
});

test('balance: a same-level standard enemy takes a few hits; the player survives several', () => {
  // Expected gear for the level: best tier whose recipe level is reached.
  const tierFor = (L) => [1, 3, 8, 16, 26, 38, 50, 64].filter((x) => x <= L).length - 1;
  const mats = ['wood', 'stone', 'copper', 'iron', 'titanium', 'emerald', 'ruby', 'diamond'];
  for (const L of [1, 10, 20, 35, 50, 65, 80]) {
    const p = fresh('swordsman'); p.level = L; p.attrs.str = Math.floor((L - 1) * 2); p.attrs.res = (L - 1);
    const m = mats[tierFor(L)];
    const s = computeStats(p, [ITEMS[`swordsman_weapon_${m}`], ITEMS[`swordsman_armor_${m}`]]);
    const hit = s.power * s.dmgMult;
    const hitsToKill = enemyHp(ENEMIES.zombie_walker.hp, L) / hit;
    const taken = enemyDmg(ENEMIES.zombie_walker.dmg, L) * 100 / (100 + s.def);
    const hitsToDie = s.maxHp / taken;
    assert.ok(hitsToKill >= 1.5 && hitsToKill <= 9, `L${L} hitsToKill ${hitsToKill.toFixed(1)}`);
    assert.ok(hitsToDie >= 6 && hitsToDie <= 40, `L${L} hitsToDie ${hitsToDie.toFixed(1)}`);
  }
});
