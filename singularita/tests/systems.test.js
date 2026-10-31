import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ATTRS, computeStats, soft } from '../js/systems/stats.js';
import { xpToNext, addXp, applyDeathPenalty, killXp, MAX_LEVEL, POINTS_PER_LEVEL } from '../js/systems/progression.js';
import * as Inv from '../js/systems/inventory.js';
import { equip, canEquip, equippedDefs, compareItems, bestTool } from '../js/systems/equipment.js';
import { checkRecipe, craft } from '../js/systems/crafting.js';
import { canGather, gatherDamage, rollYield } from '../js/systems/gathering.js';
import { newProfile, serialize, deserialize, SaveStore, SAVE_VERSION, exportString, importString, migrate } from '../js/systems/save.js';
import { DEFAULT_SETTINGS, mergeSettings } from '../js/systems/settings.js';
import { Horde, BossClock, islandLevel, eliteChance } from '../js/systems/horde.js';
import { notices, forgets } from '../js/ai/perception.js';
import { DayNight, nightGlow } from '../js/systems/dayNight.js';
import { allocate, respec } from '../js/systems/attributes.js';
import { enemyHp, enemyDmg } from '../js/systems/scaling.js';
import { runLevel } from '../js/systems/run.js';
import { ZONES } from '../js/data/zones.js';
import { BOSSES } from '../js/data/bosses.js';
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

const CORE_ROLES = ['swarm', 'frontline', 'tank'];

test('the horde keeps the island populated without ever exceeding its target', () => {
  const cfg = WAVES.island;
  const h = new Horde(cfg, makeRng(3));
  let alive = 0, most = 0;
  for (let t = 0; t < 120; t += 0.25) {
    alive += h.update(0.25, { phase: 'night', alive, core: alive, cap: 40 }).length;
    most = Math.max(most, alive);
  }
  assert.equal(alive, cfg.population.night);
  assert.equal(most, cfg.population.night);
  let capped = 0;
  for (let t = 0; t < 120; t += 0.25) capped += h.update(0.25, { phase: 'day', alive: capped, core: capped, cap: 5 }).length;
  assert.equal(capped, 5, 'the enemy cap wins over the target');
});

test('horde creatures keep their island level band and elite rate forever', () => {
  const cfg = WAVES.island;
  const h = new Horde(cfg, makeRng(9));
  const windows = [[], []];
  for (let t = 0; t < 4200; t += 0.5) {
    const phase = Math.floor(t / 300) % 2 ? 'night' : 'day';
    for (const r of h.update(0.5, { phase, alive: 0, core: 5, cap: 40 })) {
      const [lo, hi] = cfg.levels[phase];
      assert.ok(r.level >= lo && r.level <= hi, `level ${r.level} in ${phase}`);
      if (t < 600) windows[0].push(r); else if (t >= 3600) windows[1].push(r);
    }
  }
  const rate = (list) => list.filter((r) => r.elite).length / list.length;
  for (const w of windows) assert.ok(Math.abs(rate(w) - cfg.elite) < 0.04, `elite rate ${rate(w)}`);
  assert.equal(islandLevel(cfg, 'day', { int: (lo) => lo }), cfg.levels.day[0]);
});

test('support creatures only join once a front line is standing', () => {
  const h = new Horde(WAVES.island, makeRng(4));
  for (let t = 0; t < 300; t += 0.5) {
    for (const r of h.update(0.5, { phase: 'night', alive: 0, core: 0, cap: 40 })) assert.ok(CORE_ROLES.includes(ENEMIES[r.id].role), r.id);
  }
});

test('bosses roam on a random clock with a minimum gap, by their own day or night', () => {
  const cfg = WAVES.island;
  const [lo, hi] = cfg.bossCooldown;
  const clock = new BossClock(cfg, makeRng(2));
  const run = (secs, ctx) => { const out = []; for (let t = 0; t < secs; t += 1) { const id = clock.update(1, ctx); if (id) out.push(id); } return out; };
  clock.timer = clock.cooldown();
  assert.ok(clock.timer >= lo && clock.timer <= hi);
  assert.deepEqual(run(lo - 2, { phase: 'day', level: 30, bossAbroad: false }), []);
  clock.timer = clock.cooldown();
  assert.deepEqual(run(hi + 1, { phase: 'day', level: 30, bossAbroad: false }).slice(0, 1), ['slime_prince']);
  clock.timer = 0;
  assert.deepEqual(run(1, { phase: 'night', level: 30, bossAbroad: false }), ['silverback_emperor']);
  // Too low for the Emperor: nothing comes, and the clock checks again a minute later.
  clock.timer = 0;
  assert.deepEqual(run(1, { phase: 'night', level: 10, bossAbroad: false }), []);
  assert.ok(clock.timer > 0 && clock.timer <= 60);
  // While a boss is abroad the clock waits.
  clock.timer = 5;
  assert.deepEqual(run(100, { phase: 'day', level: 30, bossAbroad: true }), []);
  assert.equal(clock.timer, 5);
});

test('old saves lose the boss pity and gain the boss clock', () => {
  const old = fresh();
  delete old.world.bossTimer;
  old.world.bossPity = { slime_prince: 3 };
  const m = migrate(JSON.parse(JSON.stringify(old)));
  assert.equal(m.world.bossPity, undefined);
  assert.ok(m.world.bossTimer > 0);
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

test('tier 8 traits bring their new stats', () => {
  const p = fresh('mage'); p.level = 100;
  const dawn = computeStats(p, [ITEMS.mage_weapon_dawndosite, ITEMS.mage_armor_dawndosite]);
  assert.ok(dawn.blindChance > 0 && dawn.killHeal > 0 && dawn.healMult > computeStats(p, []).healMult);
  const dusk = computeStats(p, [ITEMS.mage_weapon_escuresite]);
  assert.ok(dusk.critLifesteal > 0 && dusk.critMult > computeStats(p, []).critMult);
});

test('balance: a same-level standard enemy takes a few hits; the player survives several', () => {
  // Expected gear for the level: best tier whose recipe level is reached.
  const tierFor = (L) => [1, 3, 8, 16, 26, 38, 50, 64, 100, 180, 240].filter((x) => x <= L).length - 1;
  const mats = ['wood', 'stone', 'copper', 'iron', 'titanium', 'emerald', 'ruby', 'diamond', 'dawndosite', 'chromantite', 'singularita'];
  for (const L of [1, 10, 20, 35, 50, 65, 80, 95, 100, 115, 140, 170, 179, 200, 239, 260, 300]) {
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

test('balance: the Core and the dimensions are fair to a player who just reached them', () => {
  // The player enters at the zone's level with the best gear that level can craft; creatures are
  // at the level the zone spawns them. Tough roles may take longer, but none should be a wall.
  const tiers = [1, 3, 8, 16, 26, 38, 50, 64, 100, 180, 240];
  const mats = ['wood', 'stone', 'copper', 'iron', 'titanium', 'emerald', 'ruby', 'diamond', 'dawndosite', 'chromantite', 'singularita'];
  // [most hits to kill, fewest hits to die]: dimensions come in packs, so each creature hits softly.
  const BOUNDS = { tank: [30, 8], frontline: [16, 11], bomber: [12, 5] };
  for (const id of ['cave_8', 'dim_dungeon', 'dim_twins', 'dim_king', 'dim_mirror', 'dim_dragons', 'cave_9']) {
    const z = ZONES[id], L = z.levelReq;
    const foeLevel = z.type === 'dimension' ? runLevel(z, { floor: 1 }) : Math.round((z.band[0] + z.band[1]) / 2);
    const p = fresh('swordsman'); p.level = L; p.attrs.str = (L - 1) * 2; p.attrs.res = L - 1;
    const m = mats[tiers.filter((x) => x <= L).length - 1];
    const s = computeStats(p, [ITEMS[`swordsman_weapon_${m}`], ITEMS[`swordsman_armor_${m}`]]);
    const hit = s.power * s.dmgMult;
    for (const { id: eid } of z.enemies) {
      const e = ENEMIES[eid], [maxHits, minHits] = BOUNDS[e.role] || [12, 16];
      // Most blows land from the front, where armoured creatures turn part of them aside.
      const hitsToKill = enemyHp(e.hp, foeLevel) / (hit * (1 - (e.frontArmor || 0)));
      const hitsToDie = s.maxHp / (enemyDmg(e.dmg, foeLevel) * 100 / (100 + s.def));
      assert.ok(hitsToKill >= 1.5 && hitsToKill <= maxHits, `${id} ${eid} L${foeLevel}: hitsToKill ${hitsToKill.toFixed(1)}`);
      assert.ok(hitsToDie >= minHits, `${id} ${eid} L${foeLevel}: hitsToDie ${hitsToDie.toFixed(1)}`);
    }
  }
});

test('balance: the rulers of the dimensions are long fights, not walls', () => {
  // Each ruler against a player at the dimension's entry level, with that level's gear. The Jailer
  // is met on floor 5; deeper Jailers grow with the gaol on purpose.
  const RULERS = { dim_dungeon: 'iron_jailer', dim_twins: 'siamese', dim_king: 'adamite_king', dim_mirror: 'you', dim_dragons: 'ragnarok' };
  const tiers = [1, 3, 8, 16, 26, 38, 50, 64, 100, 180, 240];
  const mats = ['wood', 'stone', 'copper', 'iron', 'titanium', 'emerald', 'ruby', 'diamond', 'dawndosite', 'chromantite', 'singularita'];
  let last = 0;
  for (const [dim, id] of Object.entries(RULERS)) {
    const z = ZONES[dim], b = BOSSES[id], L = z.levelReq, bl = runLevel(z, { floor: 5 }) + b.levelOffset;
    const p = fresh('swordsman'); p.level = L; p.attrs.str = (L - 1) * 2; p.attrs.res = L - 1;
    const m = mats[tiers.filter((x) => x <= L).length - 1];
    const s = computeStats(p, [ITEMS[`swordsman_weapon_${m}`], ITEMS[`swordsman_armor_${m}`]]);
    const hitsToKill = (enemyHp(b.hp, bl) * (b.members || 1)) / (s.power * s.dmgMult);
    const hitsToDie = s.maxHp / (enemyDmg(b.dmg, bl) * 100 / (100 + s.def));
    assert.ok(hitsToKill >= 150 && hitsToKill <= 320, `${id}: hitsToKill ${hitsToKill.toFixed(0)}`);
    assert.ok(hitsToKill >= last * 0.95, `${id} should not be quicker than the ruler before it`);
    assert.ok(hitsToDie >= 6.5, `${id}: hitsToDie ${hitsToDie.toFixed(1)}`);
    last = hitsToKill;
  }
});

test('balance: endgame experience comes at a steady pace', () => {
  // A ruler or a guardian is worth a level or two, not ten; dimension creatures take a few dozen
  // kills per level for a player at the entry level.
  const RULERS = { dim_dungeon: 'iron_jailer', dim_twins: 'siamese', dim_king: 'adamite_king', dim_mirror: 'you', dim_dragons: 'ragnarok' };
  for (const [dim, id] of Object.entries(RULERS)) {
    const z = ZONES[dim], b = BOSSES[id], bl = runLevel(z, { floor: 5 }) + b.levelOffset;
    const levels = (b.xp * (1 + 0.08 * bl)) / xpToNext(z.levelReq);
    assert.ok(levels >= 1 && levels <= 2.5, `${id}: ${levels.toFixed(1)} levels`);
    for (const { id: eid } of z.enemies) {
      const kills = xpToNext(z.levelReq) / killXp(ENEMIES[eid].xp, runLevel(z, { floor: 1 }), z.levelReq);
      assert.ok(kills >= (ENEMIES[eid].role === 'tank' ? 4 : 8) && kills <= 80, `${dim} ${eid}: ${kills.toFixed(0)} kills per level`);
    }
  }
  for (const id of ['ronin_east_wind', 'tears_of_poseidon', 'magma_vector', 'allele_golem']) {
    const b = BOSSES[id], bl = b.minLevel + b.levelOffset;
    const levels = (b.xp * (1 + 0.08 * bl)) / xpToNext(b.minLevel);
    assert.ok(levels <= 1.5, `${id}: ${levels.toFixed(1)} levels, and guardians return every ten minutes`);
  }
});

test('elite chance: deeper caves bring more elites; the Heart and the dimensions keep their own', () => {
  assert.ok(Math.abs(eliteChance(ZONES.cave_1, { type: 'cave', layer: 1 }, WAVES) - 0.075) < 1e-9);
  assert.ok(Math.abs(eliteChance(ZONES.cave_7, { type: 'cave', layer: 7 }, WAVES) - 0.225) < 1e-9);
  // The Singular Heart is crowded enough without a quarter of it being elite.
  assert.equal(eliteChance(ZONES.cave_9, { type: 'cave', layer: 9 }, WAVES), ZONES.cave_9.elite);
  assert.ok(ZONES.cave_9.elite <= 0.15);
  assert.equal(eliteChance(ZONES.dim_twins, { type: 'dimension' }, WAVES), WAVES.isle.elite.base);
  assert.equal(eliteChance(ZONES.dim_dungeon, { type: 'dimension', modifier: 'elite' }, WAVES), 0.35);
});

test('night glow: none by day, rising through dusk, full at midnight', () => {
  assert.equal(nightGlow(1), 0);
  assert.equal(nightGlow(0.3), 0);
  assert.equal(nightGlow(-1), 1);
  assert.ok(nightGlow(-0.35) >= 0.95);
  let last = -1;
  for (let s = 1; s >= -1; s -= 0.05) { const v = nightGlow(s); assert.ok(v >= last - 1e-9 && v >= 0 && v <= 1, `sun ${s.toFixed(2)}: ${v}`); last = v; }
  // A real island night is dark the whole way through, not only at midnight.
  const dn = new DayNight({ dayLen: 600, nightLen: 300 }, 600 + 30);
  assert.ok(nightGlow(dn.sun) > 0.5);
});

test('cave sight: a creature notices you in front of it, not behind or through rock', () => {
  const cfg = WAVES.cave.sight;
  const e = { x: 0, z: 0, yaw: 0, aggro: false }; // facing +z
  const at = (x, z) => ({ x, z });
  assert.equal(notices(e, at(0, 8), true, cfg), true, 'in front, in the open');
  assert.equal(notices(e, at(0, 8), false, cfg), false, 'in front, behind rock');
  assert.equal(notices(e, at(0, -8), true, cfg), false, 'behind it');
  assert.equal(notices(e, at(9, 2), true, cfg), false, 'far to the side');
  assert.equal(notices(e, at(0, cfg.range + 2), true, cfg), false, 'too far');
  assert.equal(notices(e, at(0, -(cfg.hearing - 0.5)), false, cfg), true, 'close enough to hear');
  assert.equal(notices({ ...e, aggro: true }, at(0, -12), false, cfg), true, 'it was struck');
  // Once roused, it gives up only when you are far away and out of sight for a while.
  assert.equal(forgets(10, 20, cfg), false);
  assert.equal(forgets(cfg.forgetDist + 2, 1, cfg), false);
  assert.equal(forgets(cfg.forgetDist + 2, cfg.forgetAfter + 1, cfg), true);
});

test('caves are not crowded: smaller populations, slower refills, smaller tremors', () => {
  for (let n = 1; n <= 9; n++) assert.ok(ZONES[`cave_${n}`].population <= 8, `cave_${n}: ${ZONES[`cave_${n}`].population}`);
  assert.ok(WAVES.cave.respawnDelay >= 10);
  assert.ok(WAVES.cave.tremor.size[1] <= 4);
  assert.equal(WAVES.dimension.respawnDelay, 6, 'dimension runs keep their pace');
});
