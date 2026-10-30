// Zones of Milestone 1: the starter island and the seven layers of the Hollow Deep.
// Generators read `gen`; renderers read `palette`; the wave/population systems read `enemies`.
import { WAVES } from './waves.js';

const islandEnemies = [...WAVES.island.tables.day, ...WAVES.island.tables.night].map((e) => ({ id: e.id, w: e.w }));

const cave = (n, o) => ({
  id: `cave_${n}`, type: 'cave', layer: n, music: `cave${n}`, hazards: [], lore: [], ...o,
});

export const ZONES = {
  island: {
    id: 'island', type: 'island', name: 'Dawnreach', subtitle: 'The Starter Isle', levelReq: 1, band: [1, 45], music: 'island',
    gen: { size: 288, radius: 122 },
    nodes: [{ node: 'tree_oak', w: 5 }, { node: 'tree_pine', w: 3 }, { node: 'tree_birch', w: 2 }, { node: 'boulder', w: 4 }],
    enemies: islandEnemies, hazards: [],
    lore: ['lore_beacon', 'lore_first_forge', 'lore_coolant', 'lore_night_shift', 'lore_menagerie', 'lore_fracture'],
    palette: { sand: '#e8d49a', grass: '#62b85a', forest: '#3f8f4a', rock: '#8c8f96', path: '#b89a6a', dirt: '#8a5a3a', base: '#a08a6a', snow: '#e8eef2' },
  },
  cave_1: cave(1, {
    name: 'The Rootways', subtitle: 'Hollow Deep — Layer 1', levelReq: 1, band: [2, 8], population: 9,
    gen: { size: 112, fill: 0.46, steps: 5, wallHeight: 3 },
    nodes: [{ node: 'ore_stone', w: 50 }, { node: 'ore_copper', w: 25 }, { node: 'ore_gold', w: 12 }],
    enemies: [{ id: 'cave_bat', w: 5 }, { id: 'rock_crab', w: 3 }, { id: 'glow_beetle', w: 3 }],
    lore: ['lore_rootways'],
    palette: { floor: '#4a4038', wall: '#5c5048', accent: '#3fe0c0', fog: '#0f1a1a', ambient: 0.55, light: '#9ff0e0', glow: 'glowcap' },
  }),
  cave_2: cave(2, {
    name: 'The Copper Galleries', subtitle: 'Hollow Deep — Layer 2', levelReq: 8, band: [8, 15], population: 10,
    gen: { size: 116, fill: 0.47, steps: 5, wallHeight: 3 },
    nodes: [{ node: 'ore_stone', w: 30 }, { node: 'ore_copper', w: 25 }, { node: 'ore_gold', w: 15 }, { node: 'ore_iron', w: 25 }],
    enemies: [{ id: 'cave_bat', w: 4 }, { id: 'rock_crab', w: 3 }, { id: 'glow_beetle', w: 3 }, { id: 'echo_miner', w: 2 }],
    lore: ['lore_galleries'],
    palette: { floor: '#4f3e32', wall: '#6a4a36', accent: '#ff9a50', fog: '#1a120c', ambient: 0.5, light: '#ffc08a', glow: 'lantern' },
  }),
  cave_3: cave(3, {
    name: 'The Dawnforger Ironworks', subtitle: 'Hollow Deep — Layer 3', levelReq: 15, band: [15, 24], population: 11,
    gen: { size: 120, fill: 0.45, steps: 4, wallHeight: 3, rails: true },
    nodes: [{ node: 'ore_stone', w: 20 }, { node: 'ore_iron', w: 35 }, { node: 'ore_lead', w: 18 }, { node: 'ore_titanium', w: 18 }],
    enemies: [{ id: 'echo_miner', w: 5 }, { id: 'rock_crab', w: 3 }, { id: 'cave_bat', w: 3 }, { id: 'glow_beetle', w: 2 }],
    lore: ['lore_ironworks'],
    palette: { floor: '#3e3a38', wall: '#55504a', accent: '#ffb347', fog: '#141210', ambient: 0.48, light: '#ffd08a', glow: 'forge' },
  }),
  cave_4: cave(4, {
    name: 'The Whispering Depths', subtitle: 'Hollow Deep — Layer 4', levelReq: 24, band: [24, 34], population: 12,
    gen: { size: 124, fill: 0.48, steps: 5, wallHeight: 3 },
    nodes: [{ node: 'ore_stone', w: 15 }, { node: 'ore_lead', w: 25 }, { node: 'ore_titanium', w: 25 }, { node: 'ore_emerald', w: 20 }],
    enemies: [{ id: 'crystal_crawler', w: 5 }, { id: 'burrower', w: 3 }, { id: 'spore_puff', w: 3 }, { id: 'echo_miner', w: 2 }],
    hazards: ['stalactite', 'gas_vent'],
    lore: ['lore_whispers'],
    palette: { floor: '#2e3a34', wall: '#3e4a42', accent: '#b98cff', fog: '#0c1410', ambient: 0.4, light: '#c9a0ff', glow: 'fungus' },
  }),
  cave_5: cave(5, {
    name: 'The Ember & Rime Rifts', subtitle: 'Hollow Deep — Layer 5', levelReq: 34, band: [34, 46], population: 12,
    gen: { size: 128, fill: 0.46, steps: 5, wallHeight: 3, split: true },
    nodes: [{ node: 'ore_stone', w: 15 }, { node: 'ore_emerald', w: 25 }, { node: 'ore_ruby', w: 22, side: 'hot' }, { node: 'ore_sapphire', w: 22, side: 'cold' }],
    enemies: [{ id: 'magma_slug', w: 4, side: 'hot' }, { id: 'rime_wraith', w: 4, side: 'cold' }, { id: 'crystal_crawler', w: 3 }, { id: 'burrower', w: 2 }],
    hazards: ['stalactite', 'heat_vent', 'frost_vent'],
    lore: ['lore_rifts'],
    palette: { floor: '#3a2c2c', wall: '#4a3838', accent: '#ff6a2a', accent2: '#7fc8ff', fog: '#160c0c', ambient: 0.45, light: '#ffb080', glow: 'rift' },
  }),
  cave_6: cave(6, {
    name: 'The Prism Caverns', subtitle: 'Hollow Deep — Layer 6', levelReq: 46, band: [46, 58], population: 12,
    gen: { size: 128, fill: 0.47, steps: 5, wallHeight: 3 },
    nodes: [{ node: 'ore_stone', w: 15 }, { node: 'ore_emerald', w: 10 }, { node: 'ore_ruby', w: 18 }, { node: 'ore_sapphire', w: 18 }, { node: 'ore_diamond', w: 15 }],
    enemies: [{ id: 'gem_golem', w: 3 }, { id: 'lurker', w: 3 }, { id: 'crystal_crawler', w: 3 }, { id: 'rime_wraith', w: 2 }],
    hazards: ['stalactite', 'resonance'],
    lore: ['lore_prism'],
    palette: { floor: '#2a2638', wall: '#3a3450', accent: '#e8d2ff', fog: '#0e0c18', ambient: 0.42, light: '#e0c8ff', glow: 'crystal' },
  }),
  cave_7: cave(7, {
    name: 'The Diamond Throat', subtitle: 'Hollow Deep — Layer 7', levelReq: 58, band: [58, 75], population: 13,
    gen: { size: 132, fill: 0.48, steps: 5, wallHeight: 3, gate: true },
    nodes: [{ node: 'ore_stone', w: 10 }, { node: 'ore_ruby', w: 10 }, { node: 'ore_sapphire', w: 10 }, { node: 'ore_diamond', w: 30 }],
    enemies: [{ id: 'gem_golem', w: 3 }, { id: 'lurker', w: 4 }, { id: 'magma_slug', w: 2 }, { id: 'rime_wraith', w: 2 }],
    hazards: ['stalactite', 'gas_vent', 'resonance', 'darkness'],
    lore: ['lore_throat', 'lore_seal'],
    palette: { floor: '#1e1e26', wall: '#2c2c3a', accent: '#bff6ff', fog: '#08080e', ambient: 0.32, light: '#d0f8ff', glow: 'diamond' },
  }),
};

// The Dawn and Dusk Hollows: the first chamber beyond the Sealed Core Gate.
ZONES.cave_8 = cave(8, {
  name: 'The Dawn and Dusk Hollows', subtitle: 'Beyond the Sealed Core Gate', levelReq: 100, band: [100, 125], population: 12,
  requires: ['sigil_wind', 'sigil_tide', 'sigil_flame', 'sigil_stone'],
  gen: { size: 128, fill: 0.46, steps: 5, wallHeight: 3, split: true, sides: ['dawn', 'dusk'], heart: true },
  nodes: [{ node: 'ore_stone', w: 10 }, { node: 'ore_diamond', w: 12 }, { node: 'ore_dawndosite', w: 30, side: 'dawn' }, { node: 'ore_escuresite', w: 30, side: 'dusk' }],
  enemies: [{ id: 'dawn_sentinel', w: 3, side: 'dawn' }, { id: 'dusk_stalker', w: 4, side: 'dusk' }, { id: 'echo_knight', w: 4 }, { id: 'gem_golem', w: 2 }],
  hazards: ['stalactite', 'radiance', 'umbral'],
  lore: ['lore_dawn_dusk', 'lore_singular_heart'],
  palette: { floor: '#2a2630', wall: '#3a3448', accent: '#ffe9a8', accent2: '#8a5aff', fog: '#0c0a14', ambient: 0.42, light: '#f0e0ff', glow: 'crystal',
    sides: ['#6a5a3a', '#2e2440'], sideWalls: ['#8a7a5a', '#3a2a5a'], sideGlow: ['#ffe9a8', '#a87aff'] },
});

// The four elemental isles, reached from the Wayshrine in camp.
const isle = (element, o) => ({ id: `isle_${element}`, type: 'isle', element, music: `isle_${element}`, hazards: [], ...o });
ZONES.isle_air = isle('air', {
  name: 'The Galeforge Spires', subtitle: 'Isle of Air', levelReq: 66, band: [66, 90], population: 11,
  gen: { size: 200, kind: 'spires' },
  nodes: [{ node: 'tree_cloudpine', w: 5 }, { node: 'node_skyglass', w: 3 }, { node: 'ore_diamond', w: 1 }],
  enemies: [{ id: 'gale_harpy', w: 5 }, { id: 'kite_serpent', w: 3 }, { id: 'cloud_sprite', w: 2 }, { id: 'storm_wisp', w: 2 }],
  exclusive: ['skyglass', 'zephyr_feather'], phenomena: ['gusts', 'updrafts'],
  lore: ['lore_eastgate', 'lore_galeforge'],
  palette: { sky: '#7fc4ff', horizon: '#e8f6ff', fog: '#d8ecff', ground: '#c8e0b0', grass: '#a8d890', rock: '#b8c0cc', sun: '#fff8e8', hemi: '#e0f0ff', hemiG: '#8a9aaa' },
});
ZONES.isle_water = isle('water', {
  name: 'Tidecrown Atoll', subtitle: 'Isle of Water', levelReq: 66, band: [66, 90], population: 11,
  gen: { size: 200, kind: 'atoll' },
  nodes: [{ node: 'tree_palm', w: 5 }, { node: 'pearl_bed', w: 3, low: true }, { node: 'ore_sapphire', w: 1 }],
  enemies: [{ id: 'reef_crab', w: 4 }, { id: 'siren', w: 3 }, { id: 'drowned_sailor', w: 3 }, { id: 'glass_jelly', w: 3 }],
  exclusive: ['abyssal_pearl', 'tide_silk'], phenomena: ['tide'],
  lore: ['lore_drowned_palace', 'lore_tidecrown'],
  palette: { sky: '#5ab8e8', horizon: '#f4e8c8', fog: '#cfeaf0', sea: '#1fb0c8', sand: '#f0e0b0', grass: '#7ccf6a', rock: '#a8a090', sun: '#fff0d0', hemi: '#d0f0ff', hemiG: '#8a7a5a' },
});
ZONES.isle_fire = isle('fire', {
  name: 'Cinderspine', subtitle: 'Isle of Fire', levelReq: 80, band: [80, 105], population: 12,
  gen: { size: 200, kind: 'volcano' },
  nodes: [{ node: 'tree_charred', w: 4 }, { node: 'ore_obsidian', w: 4 }, { node: 'ore_ruby', w: 1 }],
  enemies: [{ id: 'lava_hound', w: 5 }, { id: 'obsidian_golem', w: 2 }, { id: 'fire_imp', w: 4 }, { id: 'ash_shaman', w: 2 }],
  exclusive: ['obsidian', 'salamander_scale'], phenomena: ['lava', 'eruptions'],
  lore: ['lore_cinder_forge', 'lore_vector'],
  palette: { sky: '#7a3e34', horizon: '#ffa060', fog: '#7a4434', sea: '#3a2420', ground: '#7a5444', ash: '#8a7a72', rock: '#5a4a4c', sun: '#ffc890', hemi: '#ffb890', hemiG: '#4a2a22' },
});
ZONES.isle_earth = isle('earth', {
  name: 'The Rootdeep Mesas', subtitle: 'Isle of Earth', levelReq: 80, band: [80, 105], population: 12,
  gen: { size: 200, kind: 'mesas' },
  nodes: [{ node: 'tree_mossoak', w: 5 }, { node: 'amber_root', w: 3 }, { node: 'ore_emerald', w: 1 }],
  enemies: [{ id: 'mossback_tortoise', w: 2 }, { id: 'root_lasher', w: 3 }, { id: 'burrowing_mole', w: 3 }, { id: 'stone_wisp', w: 4 }],
  exclusive: ['living_amber', 'golem_shard'], phenomena: ['quakes'],
  lore: ['lore_worldroot', 'lore_divine_golem'],
  palette: { sky: '#e8b878', horizon: '#ffe0a8', fog: '#e8c898', sea: '#3a6a5a', ground: '#b8784a', mesa: '#c8885a', grass: '#7a9a4a', rock: '#9a6a4a', sun: '#fff0c8', hemi: '#ffe8c0', hemiG: '#6a4a2a' },
});

export const ZONE_ORDER = ['island', 'cave_1', 'cave_2', 'cave_3', 'cave_4', 'cave_5', 'cave_6', 'cave_7', 'isle_air', 'isle_water', 'isle_fire', 'isle_earth', 'cave_8'];
export const ISLES = ['isle_air', 'isle_water', 'isle_fire', 'isle_earth'];
export const caveZone = (layer) => ZONES[`cave_${layer}`];

// Cave hazard descriptions, for tooltips and the map.
export const HAZARDS = {
  stalactite: { name: 'Falling stalactites', desc: 'Watch for shadows on the floor.' },
  gas_vent: { name: 'Gas vents', desc: 'Poison clouds. An Antidote keeps you safe.' },
  heat_vent: { name: 'Heat vents', desc: 'Bursts of fire on the hot side of the rift.' },
  frost_vent: { name: 'Frost vents', desc: 'Freezing gusts on the cold side of the rift.' },
  resonance: { name: 'Crystal resonance', desc: 'Mining gems may wake crystal sentries.' },
  darkness: { name: 'Deep dark', desc: 'Light barely reaches here. Lurkers hunt in it.' },
  radiance: { name: 'Radiance pulses', desc: 'Bursts of dawn light that blind, on the dawn side.' },
  umbral: { name: 'Umbral pools', desc: 'Pools of dusk that slow and drain, on the dusk side.' },
  gusts: { name: 'Gales', desc: 'Winds sweep the spires and push everything with them.' },
  updrafts: { name: 'Updrafts', desc: 'Step on a wind vent to be carried to a higher spire.' },
  tide: { name: 'The tide', desc: 'Low tide uncovers sandbars and pearl beds; high tide swallows them.' },
  lava: { name: 'Lava', desc: 'Lava rivers burn anything that steps in them.' },
  eruptions: { name: 'Eruptions', desc: 'The volcano throws burning rock. Watch for the circles.' },
  quakes: { name: 'Quakes', desc: 'The ground heaves and stone spikes burst up.' },
};
