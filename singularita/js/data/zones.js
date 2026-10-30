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

export const ZONE_ORDER = ['island', 'cave_1', 'cave_2', 'cave_3', 'cave_4', 'cave_5', 'cave_6', 'cave_7'];
export const caveZone = (layer) => ZONES[`cave_${layer}`];

// Cave hazard descriptions, for tooltips and the map.
export const HAZARDS = {
  stalactite: { name: 'Falling stalactites', desc: 'Watch for shadows on the floor.' },
  gas_vent: { name: 'Gas vents', desc: 'Poison clouds. An Antidote keeps you safe.' },
  heat_vent: { name: 'Heat vents', desc: 'Bursts of fire on the hot side of the rift.' },
  frost_vent: { name: 'Frost vents', desc: 'Freezing gusts on the cold side of the rift.' },
  resonance: { name: 'Crystal resonance', desc: 'Mining gems may wake crystal sentries.' },
  darkness: { name: 'Deep dark', desc: 'Light barely reaches here. Lurkers hunt in it.' },
};
