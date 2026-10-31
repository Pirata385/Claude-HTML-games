import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MATERIALS, MAIN_MATERIALS, TIER_RECIPE_LEVEL, TRAITS, RARITY } from '../js/data/materials.js';
import { NODES } from '../js/data/nodes.js';
import { CLASSES, CLASS_IDS } from '../js/data/classes.js';
import { SKILLS, skillsOf } from '../js/data/skills.js';
import { ITEMS } from '../js/data/items.js';
import { RECIPES } from '../js/data/recipes.js';
import { CONSUMABLES } from '../js/data/consumables.js';
import { ENEMIES, BEHAVIORS } from '../js/data/enemies.js';
import { BOSSES } from '../js/data/bosses.js';
import { ZONES, ZONE_ORDER } from '../js/data/zones.js';
import { WAVES } from '../js/data/waves.js';
import { STATUS } from '../js/data/status.js';
import { LORE } from '../js/data/lore.js';
import { OBJECTIVES } from '../js/data/objectives.js';
import { buildUnlocks } from '../js/data/unlocks.js';
import { findSources } from '../js/data/sources.js';

test('content stops at tier 10: Singularita is the last tier', () => {
  for (const m of Object.values(MATERIALS)) assert.ok(m.tier <= 10, m.id);
  for (const it of Object.values(ITEMS)) assert.ok(it.tier <= 10, it.id);
});

test('main material chain follows the required order', () => {
  const order = MAIN_MATERIALS.map((id) => MATERIALS[id].tier);
  for (let i = 1; i < order.length; i++) assert.ok(order[i] >= order[i - 1]);
  assert.deepEqual(MAIN_MATERIALS, ['wood', 'stone', 'copper', 'gold', 'iron', 'lead', 'titanium', 'emerald', 'ruby', 'sapphire', 'diamond', 'dawndosite', 'escuresite', 'chromantite', 'singularita']);
  for (let t = 1; t < TIER_RECIPE_LEVEL.length; t++) assert.ok(TIER_RECIPE_LEVEL[t] > TIER_RECIPE_LEVEL[t - 1]);
});

test('every main material has a trait and a rarity', () => {
  for (const id of MAIN_MATERIALS) {
    assert.ok(TRAITS[MATERIALS[id].trait], id);
    assert.ok(RARITY[MATERIALS[id].rarity], id);
  }
});

test('every class has weapon, armour and accessory in every main material', () => {
  for (const cls of CLASS_IDS) for (const mat of MAIN_MATERIALS) for (const slot of ['weapon', 'armor', 'accessory']) {
    const id = `${cls}_${slot}_${mat}`;
    assert.ok(ITEMS[id], id);
    assert.equal(ITEMS[id].class, cls);
  }
});

test('pickaxes and axes exist for every main material', () => {
  for (const mat of MAIN_MATERIALS) {
    assert.equal(ITEMS[`pickaxe_${mat}`]?.tool, 'pickaxe');
    assert.equal(ITEMS[`axe_${mat}`]?.tool, 'axe');
  }
});

test('items never carry a level requirement to equip', () => {
  for (const it of Object.values(ITEMS)) assert.equal(it.levelReq, undefined, it.id);
});

test('recipes reference real materials, items and consumables', () => {
  for (const r of Object.values(RECIPES)) {
    for (const id of Object.keys(r.inputs)) assert.ok(MATERIALS[id], `${r.id} input ${id}`);
    if (r.output.item) assert.ok(ITEMS[r.output.item], r.id);
    else assert.ok(CONSUMABLES[r.output.stack] || MATERIALS[r.output.stack], r.id);
    assert.ok(r.level >= 1 && r.level <= 300);
  }
});

test('every item is craftable or a boss drop', () => {
  const crafted = new Set(Object.values(RECIPES).map((r) => r.output.item).filter(Boolean));
  const dropped = new Set(Object.values(BOSSES).flatMap((b) => b.rewards.map((x) => x.item)).filter(Boolean));
  for (const id of Object.keys(ITEMS)) assert.ok(crafted.has(id) || dropped.has(id), id);
});

test('every recipe input can be obtained at or below the recipe level', () => {
  for (const r of Object.values(RECIPES)) {
    for (const id of Object.keys(r.inputs)) {
      const src = findSources(id);
      assert.ok(src.length > 0, `${id} has no source`);
      const earliest = Math.min(...src.map((s) => s.level));
      assert.ok(earliest <= r.level, `${r.id}: ${id} first available at ${earliest} > ${r.level}`);
    }
  }
});

test('progression sim: from bare hands the pickaxe chain reaches Singularita by its recipe level', () => {
  // Greedy player: at each level, mine everything minable in reachable zones, craft the best pickaxe.
  // Zones behind sigils or shards open once their bosses are within reach; dimensions open once
  // their emblem can be crafted.
  let pickTier = -1; // hands
  const have = new Set(['wood', 'slime_gel', 'zombie_sinew']);
  const emblemReady = (z, L) => { const r = RECIPES[`craft_${z.emblem}`]; return r.level <= L && Object.keys(r.inputs).every((id) => have.has(id)); };
  const open = (z, L) => z.levelReq <= L && (z.requires || []).every((id) => have.has(id)) && (z.type !== 'dimension' || emblemReady(z, L));
  for (let L = 1; L <= 300; L++) {
    for (const b of Object.values(BOSSES)) if (b.minLevel <= L && open(ZONES[b.zone || 'island'], L)) for (const r of b.rewards) if (r.material) have.add(r.material);
    for (const z of ZONE_ORDER.map((id) => ZONES[id]).filter((z) => open(z, L))) {
      for (const n of z.nodes) {
        const nd = NODES[n.node];
        if (nd.tool === 'axe' || pickTier + 1 >= nd.tier) have.add(nd.material);
      }
      for (const e of z.enemies) for (const d of ENEMIES[e.id].drops) have.add(d.id);
    }
    for (const r of Object.values(RECIPES)) {
      const it = r.output.item && ITEMS[r.output.item];
      if (!it || it.tool !== 'pickaxe' || r.level > L) continue;
      if (Object.keys(r.inputs).every((id) => have.has(id))) pickTier = Math.max(pickTier, it.tier);
    }
  }
  for (const id of MAIN_MATERIALS) assert.ok(have.has(id), `${id} reachable`);
  assert.ok(pickTier >= 10, `best pickaxe tier ${pickTier}`);
});

const DIMENSIONS = () => Object.values(ZONES).filter((z) => z.type === 'dimension');
const MAIN_WORLD_BOSS_MATS = new Set(Object.values(BOSSES).filter((b) => ['island', 'isle'].includes(ZONES[b.zone || 'island'].type)).flatMap((b) => b.rewards.map((r) => r.material)).filter(Boolean));

test('five dimensions, each opened by its own craftable emblem made from main-world boss materials', () => {
  const dims = DIMENSIONS();
  assert.equal(dims.length, 5);
  const emblems = new Set();
  for (const z of dims) {
    const em = CONSUMABLES[z.emblem];
    assert.ok(em && em.effect.portal === z.id, `${z.id} emblem`);
    emblems.add(z.emblem);
    const r = RECIPES[`craft_${z.emblem}`];
    assert.ok(r, `${z.emblem} recipe`);
    assert.ok(Object.keys(r.inputs).some((id) => MAIN_WORLD_BOSS_MATS.has(id)), `${z.emblem} uses a main-world boss material`);
    assert.ok(r.level >= z.levelReq - 5 && r.level <= z.levelReq, `${z.emblem} recipe at ${r.level} for ${z.levelReq}`);
  }
  assert.equal(emblems.size, 5);
});

test('each dimension has its own rule, look, creatures, boss, exclusive material and lore', () => {
  const rules = new Set(), kinds = new Set();
  for (const z of DIMENSIONS()) {
    assert.ok(z.rule && z.ruleDesc, `${z.id} rule`); rules.add(z.rule);
    kinds.add(z.gen.kind);
    assert.ok(z.palette && z.enemies.length >= 3, z.id);
    const boss = BOSSES[z.boss];
    assert.ok(boss && boss.zone === z.id && boss.phases.length >= 3 && boss.intro && boss.defeat && boss.lore, `${z.id} boss`);
    assert.ok(z.exclusive.length >= 1, z.id);
    for (const m of z.exclusive) {
      const zonesWith = findSources(m).map((s) => s.zone);
      assert.ok(zonesWith.length && zonesWith.every((id) => id === z.id), `${m} only in ${z.id}: ${zonesWith}`);
    }
    assert.ok(z.lore.length >= 2, `${z.id} lore`);
    for (const e of z.enemies) assert.ok(ENEMIES[e.id].family !== 'slime' || z.id === 'dim_twins', `${z.id} has its own creatures`);
  }
  assert.equal(rules.size, 5, 'five different rules');
  assert.equal(kinds.size, 5, 'five different layouts');
});

test('the five dimension bosses from the brief are present, each with a Fracture Shard', () => {
  const names = Object.values(BOSSES).map((b) => b.name);
  for (const n of ['The Iron-Hand Jailer', 'The Adamite King', 'You?', 'The Siamese', 'Ragnarok, the Dragon God']) assert.ok(names.includes(n), n);
  const shards = Object.values(MATERIALS).filter((m) => m.kind === 'key' && m.id.startsWith('shard_')).map((m) => m.id);
  assert.equal(shards.length, 5);
  for (const id of shards) {
    const b = Object.values(BOSSES).find((x) => x.rewards.some((r) => r.material === id && r.once));
    assert.ok(b && ZONES[b.zone].type === 'dimension', id);
  }
  assert.deepEqual([...ZONES.cave_9.requires].sort(), [...shards].sort());
  assert.ok(ZONES.cave_9.levelReq >= 200);
});

test('Singularita is indispensable for the last two tiers, and the last tier is built on it', () => {
  for (const r of Object.values(RECIPES)) {
    const it = r.output.item && ITEMS[r.output.item];
    if (!it || it.tier < 9 || !it.material) continue;
    assert.ok(r.inputs.singularita || r.inputs.singularita_shard, `${r.id} needs Singularita`);
    if (it.tier === 10) assert.equal(it.material, 'singularita');
  }
  for (const cls of CLASS_IDS) for (const slot of ['weapon', 'armor', 'accessory']) {
    const it = ITEMS[`${cls}_${slot}_singularita`];
    assert.equal(it.memory, 2, `${it.id} remembers two traits`);
    assert.ok(it.collapse, `${it.id} collapses`);
  }
  assert.ok(TRAITS.chromatic && TRAITS.singular, 'new traits');
});

test('tier 9 and 10 gear draws on at least two dimensions', () => {
  const dimOf = (m) => DIMENSIONS().find((z) => z.exclusive.includes(m))?.id;
  for (const r of Object.values(RECIPES)) {
    const it = r.output.item && ITEMS[r.output.item];
    if (!it || it.tier < 9 || it.kind === 'tool' || !it.material) continue;
    const dims = new Set(Object.keys(r.inputs).map(dimOf).filter(Boolean));
    assert.ok(dims.size >= 2, `${r.id} uses ${[...dims]}`);
  }
});

test('four elemental isles, each with exclusive materials found nowhere else', () => {
  const isles = Object.values(ZONES).filter((z) => z.type === 'isle');
  assert.deepEqual(isles.map((z) => z.element).sort(), ['air', 'earth', 'fire', 'water']);
  for (const z of isles) {
    assert.ok(z.exclusive.length >= 2, z.id);
    for (const m of z.exclusive) {
      assert.ok(MATERIALS[m], m);
      const zonesWith = findSources(m).map((s) => s.zone);
      assert.ok(zonesWith.length && zonesWith.every((id) => id === z.id), `${m} only on ${z.id}: ${zonesWith}`);
    }
    assert.ok(z.lore.length >= 2, `${z.id} lore`);
  }
});

test('each isle boss guards its sigil, and the four sigils open the Core', () => {
  const sigils = ['sigil_wind', 'sigil_tide', 'sigil_flame', 'sigil_stone'];
  for (const id of sigils) {
    assert.equal(MATERIALS[id]?.kind, 'key', id);
    const b = Object.values(BOSSES).find((x) => x.rewards.some((r) => r.material === id));
    assert.ok(b && ZONES[b.zone]?.type === 'isle', `${id} boss`);
    assert.ok(b.phases.length >= 3 && b.intro && b.defeat && b.lore, b.id);
  }
  assert.deepEqual([...ZONES.cave_8.requires].sort(), [...sigils].sort());
  assert.ok(ZONES.cave_8.levelReq >= 95);
});

test('tier 8 gear needs materials from at least two different isles', () => {
  const isleOf = (m) => Object.values(ZONES).find((z) => z.type === 'isle' && z.exclusive.includes(m))?.id;
  for (const r of Object.values(RECIPES)) {
    const it = r.output.item && ITEMS[r.output.item];
    if (!it || it.tier !== 8 || it.kind === 'tool') continue;
    const isles = new Set(Object.keys(r.inputs).map(isleOf).filter(Boolean));
    assert.ok(isles.size >= 2, `${r.id} uses ${[...isles]}`);
  }
});

test('the four isle bosses from the brief are present by name', () => {
  const names = Object.values(BOSSES).map((b) => b.name);
  for (const n of ['Ronin of the East Wind', 'Allele of the Divine Golem', 'The Magma Vector', 'Tears of Poseidon']) assert.ok(names.includes(n), n);
});

test('class skills: basic, alt and six skills at the planned levels', () => {
  for (const cls of CLASS_IDS) {
    const list = skillsOf(cls);
    assert.equal(list.filter((s) => s.kind === 'basic').length, 1, cls);
    assert.equal(list.filter((s) => s.kind === 'alt').length, 1, cls);
    const skills = list.filter((s) => s.kind === 'skill');
    assert.deepEqual(skills.map((s) => s.unlock), [1, 4, 10, 18, 28, 40], cls);
    for (const s of list) assert.ok(s.name && s.desc && s.icon, s.id);
    assert.ok(CLASSES[cls].resource && CLASSES[cls].weapon);
  }
  assert.equal(Object.keys(SKILLS).length, CLASS_IDS.length * 8);
});

test('enemies use known behaviours and real drops; zones use real enemies and nodes', () => {
  for (const e of Object.values(ENEMIES)) {
    assert.ok(BEHAVIORS.includes(e.behavior), `${e.id} behaviour ${e.behavior}`);
    for (const d of e.drops) assert.ok(MATERIALS[d.id], `${e.id} drop ${d.id}`);
  }
  for (const z of Object.values(ZONES)) {
    for (const e of z.enemies) assert.ok(ENEMIES[e.id], `${z.id} enemy ${e.id}`);
    for (const n of z.nodes) assert.ok(NODES[n.node], `${z.id} node ${n.node}`);
  }
  for (const phase of ['day', 'night']) for (const e of WAVES.island.tables[phase]) assert.ok(ENEMIES[e.id], e.id);
});

test('day spawns are mostly slimes and night spawns mostly zombies', () => {
  const sum = (arr, f) => arr.filter(f).reduce((a, e) => a + e.w, 0);
  const day = WAVES.island.tables.day, night = WAVES.island.tables.night;
  assert.ok(sum(day, (e) => ENEMIES[e.id].family === 'slime') / sum(day, () => true) >= 0.8);
  assert.ok(sum(night, (e) => ENEMIES[e.id].family === 'zombie') / sum(night, () => true) >= 0.8);
});

test('cave layers: 9 layers, increasing access levels, hazards from layer 4', () => {
  const caves = ZONE_ORDER.filter((id) => ZONES[id].type === 'cave').map((id) => ZONES[id]);
  assert.equal(caves.length, 9);
  for (let i = 1; i < caves.length; i++) assert.ok(caves[i].levelReq > caves[i - 1].levelReq);
  caves.forEach((c, i) => assert.equal(c.hazards.length > 0, i >= 3, c.id));
});

test('bosses: both starter bosses exist with phases, arena and rewards', () => {
  for (const id of ['slime_prince', 'silverback_emperor']) {
    const b = BOSSES[id];
    assert.ok(b && b.arena && b.phases.length >= 2 && b.rewards.length && b.intro && b.minLevel);
  }
  assert.equal(BOSSES.slime_prince.period, 'day');
  assert.equal(BOSSES.silverback_emperor.period, 'night');
});

test('status effects referenced by skills exist', () => {
  for (const s of Object.values(SKILLS)) for (const st of s.status || []) assert.ok(STATUS[st], `${s.id} ${st}`);
});

test('lore ids referenced by zones exist and are unique', () => {
  const ids = new Set();
  for (const z of Object.values(ZONES)) for (const l of z.lore) { assert.ok(LORE[l], l); assert.ok(!ids.has(l), l); ids.add(l); }
  assert.ok(ids.size >= 22);
});

test('objectives are well formed', () => {
  const ids = new Set();
  for (const o of OBJECTIVES) {
    assert.ok(o.id && o.text && o.type && o.count >= 1, o.id);
    assert.ok(!ids.has(o.id)); ids.add(o.id);
  }
});

test('unlock roadmap lists real levels and includes zones and recipes', () => {
  const u = buildUnlocks('swordsman');
  assert.ok(u.length > 5);
  for (const e of u) assert.ok(e.level >= 1 && e.level <= 300 && e.entries.length);
  const flat = u.flatMap((e) => e.entries.map((x) => x.type));
  assert.ok(flat.includes('zone') && flat.includes('recipe') && flat.includes('skill'));
});

test('findSources explains where a material comes from', () => {
  const iron = findSources('iron');
  assert.ok(iron.some((s) => s.zone === 'cave_2' && s.how.includes('Pickaxe')));
  assert.ok(findSources('slime_gel').some((s) => s.how.includes('Slime')));
});

test('the Mage controls crowds: bursting bolts, freezing frost, a ward to survive and one focused strike', () => {
  const kit = skillsOf('mage');
  const bolt = kit.find((s) => s.kind === 'basic');
  assert.ok(bolt.splash >= 2 && bolt.splashDmg > 0 && bolt.splashDmg < 1, 'the basic bolt bursts over an area');
  assert.ok(SKILLS.mg_flame.radius && SKILLS.mg_nova.radius && SKILLS.mg_chain.bounces, 'area and chaining skills');
  assert.ok(SKILLS.mg_nova.freeze >= 1.5, 'Frost Nova freezes on the first cast');
  assert.ok(SKILLS.mg_chain.stun > 0, 'Chain Lightning stuns');
  assert.ok(SKILLS.mg_barrier.shield >= 0.3 && SKILLS.mg_barrier.pulse, 'Arcane Barrier shields, then freezes foes around you');
  assert.ok(SKILLS.mg_blink.evade >= 1, 'Blink grants a moment of sure evasion');
  // The last skill is a single, devastating blow.
  const last = kit.filter((s) => s.kind !== 'basic' && s.kind !== 'alt').sort((a, b) => b.unlock - a.unlock)[0];
  assert.equal(last.id, 'mg_lance');
  assert.ok(last.dmg >= 8 && !last.radius && !last.bounces, 'focused on one target');
  assert.equal(SKILLS.mg_meteor, undefined);
  assert.match(CLASSES.mage.tagline, /crowd|control/i);
});
