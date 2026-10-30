// Creatures. hp/dmg are level-1 bases; js/systems/scaling.js scales them by level.
// `role` drives wave composition, `behavior` picks the AI in js/ai/behaviors.js.

export const BEHAVIORS = ['hopper', 'melee', 'ranged', 'support_heal', 'support_buff', 'bomber', 'swoop', 'burrow', 'lurker', 'golem', 'sentry', 'aura', 'lasher'];
export const ROLE_COST = { swarm: 1, frontline: 2, ranged: 2, bomber: 2, support: 3, tank: 4 };

const E = (id, o) => ({ id, drops: [], radius: 0.5, scale: 1, range: 1.6, atkCd: 1.4, windup: 0.45, flags: [], ...o });
const drop = (id, chance, min = 1, max = min) => ({ id, chance, min, max });

export const ENEMIES = {
  // Dawnreach, by day — slimes, the forges' coolant gone feral.
  slime: E('slime', { name: 'Slime', family: 'slime', role: 'swarm', behavior: 'hopper', hp: 30, dmg: 6, speed: 2.8, xp: 10, radius: 0.55,
    model: 'slime', color: '#7ee07e', drops: [drop('slime_gel', 0.7, 1, 2)] }),
  great_slime: E('great_slime', { name: 'Great Slime', family: 'slime', role: 'frontline', behavior: 'hopper', hp: 95, dmg: 10, speed: 2.2, xp: 28, radius: 1.0, scale: 1.8,
    model: 'slime', color: '#47b85f', split: { into: 'slime', count: 3 }, drops: [drop('slime_gel', 0.9, 2, 4)] }),
  spitter_slime: E('spitter_slime', { name: 'Spitter', family: 'slime', role: 'ranged', behavior: 'ranged', hp: 28, dmg: 7, speed: 2.4, xp: 16,
    model: 'slime', color: '#c4e05a', proj: 'acid', range: 11, atkCd: 2.2, windup: 0.6, drops: [drop('slime_gel', 0.8, 1, 2)] }),
  mender_slime: E('mender_slime', { name: 'Mender Slime', family: 'slime', role: 'support', behavior: 'support_heal', hp: 40, dmg: 3, speed: 2.4, xp: 22,
    model: 'slime', color: '#ff9ad5', heal: 0.12, auraRadius: 7, atkCd: 3, drops: [drop('slime_gel', 0.9, 2, 3)] }),
  royal_guard: E('royal_guard', { name: 'Royal Guard', family: 'slime', role: 'frontline', behavior: 'hopper', hp: 70, dmg: 9, speed: 3.0, xp: 6, radius: 0.7, scale: 1.3,
    model: 'slime', color: '#ffd166', flags: ['guard'] }),

  // Dawnreach, by night — Echoes of the old miners, still working the night shift.
  zombie_walker: E('zombie_walker', { name: 'Echo Walker', family: 'zombie', role: 'frontline', behavior: 'melee', hp: 55, dmg: 9, speed: 2.1, xp: 14,
    model: 'zombie', color: '#7fa36a', cloth: '#5a6b8a', drops: [drop('zombie_sinew', 0.6, 1, 2)] }),
  zombie_runner: E('zombie_runner', { name: 'Echo Runner', family: 'zombie', role: 'swarm', behavior: 'melee', hp: 32, dmg: 6, speed: 4.6, xp: 11, atkCd: 1.0, windup: 0.3,
    model: 'zombie', color: '#93b07a', cloth: '#8a5a4a', scale: 0.9, drops: [drop('zombie_sinew', 0.4)] }),
  zombie_brute: E('zombie_brute', { name: 'Echo Brute', family: 'zombie', role: 'tank', behavior: 'melee', hp: 170, dmg: 18, speed: 1.9, xp: 45, radius: 0.8, scale: 1.5,
    range: 2.4, atkCd: 2.4, windup: 0.8, slam: 2.6, model: 'zombie', color: '#6a8a5a', cloth: '#4a3a2a', drops: [drop('zombie_sinew', 0.9, 2, 3)] }),
  zombie_screamer: E('zombie_screamer', { name: 'Echo Screamer', family: 'zombie', role: 'support', behavior: 'support_buff', hp: 45, dmg: 5, speed: 2.5, xp: 24,
    auraRadius: 9, atkCd: 6, model: 'zombie', color: '#a3b58a', cloth: '#6a3a6a', drops: [drop('zombie_sinew', 0.6, 1, 2)] }),
  zombie_bloater: E('zombie_bloater', { name: 'Echo Bloater', family: 'zombie', role: 'bomber', behavior: 'bomber', hp: 60, dmg: 22, speed: 1.7, xp: 20, radius: 0.75, scale: 1.3,
    explode: 3.2, cloud: 'poison', model: 'zombie', color: '#8faa5a', cloth: '#5a5a3a', drops: [drop('zombie_sinew', 0.7, 1, 2)] }),

  // The Hollow Deep, layers 1–3.
  cave_bat: E('cave_bat', { name: 'Rootways Bat', family: 'beast', role: 'swarm', behavior: 'swoop', hp: 24, dmg: 6, speed: 6, xp: 10, radius: 0.45,
    model: 'bat', color: '#5a4a5e', flags: ['flying'], drops: [drop('bat_leather', 0.55)] }),
  rock_crab: E('rock_crab', { name: 'Rock Crab', family: 'beast', role: 'frontline', behavior: 'melee', hp: 85, dmg: 11, speed: 2.0, xp: 22, radius: 0.75,
    frontArmor: 0.7, model: 'crab', color: '#8f949c', drops: [drop('stone', 0.8, 1, 3), drop('copper', 0.2)] }),
  glow_beetle: E('glow_beetle', { name: 'Glow Beetle', family: 'beast', role: 'ranged', behavior: 'ranged', hp: 35, dmg: 7, speed: 2.4, xp: 14,
    proj: 'glob', range: 10, atkCd: 2.0, model: 'beetle', color: '#3fd1b0', drops: [drop('slime_gel', 0.5)] }),
  echo_miner: E('echo_miner', { name: 'Echo Miner', family: 'zombie', role: 'frontline', behavior: 'melee', hp: 75, dmg: 11, speed: 2.3, xp: 20,
    model: 'zombie', color: '#8a9a7a', cloth: '#a07a3a', helmet: true, drops: [drop('zombie_sinew', 0.6), drop('iron', 0.25)] }),

  // Layers 4–5.
  crystal_crawler: E('crystal_crawler', { name: 'Crystal Crawler', family: 'beast', role: 'swarm', behavior: 'melee', hp: 42, dmg: 8, speed: 4.4, xp: 14, atkCd: 1.0,
    model: 'crawler', color: '#58c7b2', drops: [drop('crawler_chitin', 0.5)] }),
  burrower: E('burrower', { name: 'Burrower', family: 'beast', role: 'frontline', behavior: 'burrow', hp: 95, dmg: 14, speed: 3.2, xp: 30, radius: 0.8,
    model: 'crawler', color: '#8a6a4a', scale: 1.4, drops: [drop('crawler_chitin', 0.8, 1, 2)] }),
  spore_puff: E('spore_puff', { name: 'Spore Puff', family: 'fungus', role: 'bomber', behavior: 'bomber', hp: 40, dmg: 12, speed: 1.6, xp: 16,
    explode: 3.0, cloud: 'poison', model: 'puff', color: '#c9a0ff', drops: [drop('slime_gel', 0.5), drop('crawler_chitin', 0.2)] }),
  magma_slug: E('magma_slug', { name: 'Magma Slug', family: 'elemental', role: 'frontline', behavior: 'melee', hp: 150, dmg: 14, speed: 1.6, xp: 38, radius: 0.8,
    onHit: 'burn', trail: 'burn', model: 'slug', color: '#ff6a2a', drops: [drop('ember_core', 0.45)] }),
  rime_wraith: E('rime_wraith', { name: 'Rime Wraith', family: 'elemental', role: 'ranged', behavior: 'ranged', hp: 65, dmg: 11, speed: 3.0, xp: 30,
    proj: 'frost', onHit: 'chill', range: 12, atkCd: 2.0, model: 'wraith', color: '#9fd8ff', flags: ['flying'], drops: [drop('rime_shard', 0.45)] }),

  // Layers 6–7.
  gem_golem: E('gem_golem', { name: 'Gem Golem', family: 'construct', role: 'tank', behavior: 'golem', hp: 280, dmg: 24, speed: 1.5, xp: 80, radius: 1.0, scale: 1.6,
    range: 2.6, atkCd: 2.8, windup: 0.9, slam: 3.4, model: 'golem', color: '#b78cff', drops: [drop('prism_dust', 0.7, 1, 2)] }),
  lurker: E('lurker', { name: 'Lurker', family: 'beast', role: 'frontline', behavior: 'lurker', hp: 75, dmg: 20, speed: 4.0, xp: 40,
    model: 'lurker', color: '#2a2440', drops: [drop('prism_dust', 0.45)] }),
  crystal_sentry: E('crystal_sentry', { name: 'Crystal Sentry', family: 'construct', role: 'ranged', behavior: 'sentry', hp: 90, dmg: 12, speed: 0, xp: 25,
    proj: 'beam', range: 13, atkCd: 1.8, model: 'sentry', color: '#e8d2ff', drops: [drop('prism_dust', 0.4)] }),

  // Isle of Air — the Galeforge Spires.
  gale_harpy: E('gale_harpy', { name: 'Gale Harpy', family: 'sky', role: 'swarm', behavior: 'swoop', hp: 70, dmg: 16, speed: 7, xp: 40, radius: 0.55,
    gust: 7, model: 'harpy', color: '#e8eef8', flags: ['flying'], drops: [drop('zephyr_feather', 0.5)] }),
  kite_serpent: E('kite_serpent', { name: 'Kite Serpent', family: 'sky', role: 'ranged', behavior: 'ranged', hp: 80, dmg: 14, speed: 4, xp: 45,
    proj: 'bolt', onHit: 'shock', range: 13, atkCd: 2.0, model: 'serpent', color: '#7fb3ff', flags: ['flying'], drops: [drop('zephyr_feather', 0.35)] }),
  cloud_sprite: E('cloud_sprite', { name: 'Cloud Sprite', family: 'sky', role: 'support', behavior: 'support_buff', hp: 60, dmg: 6, speed: 3.5, xp: 50,
    buff: 'shield', auraRadius: 9, atkCd: 7, model: 'puff', color: '#f4f8ff', flags: ['flying'], drops: [drop('zephyr_feather', 0.3)] }),
  storm_wisp: E('storm_wisp', { name: 'Storm Wisp', family: 'sky', role: 'bomber', behavior: 'bomber', hp: 55, dmg: 30, speed: 3.2, xp: 38,
    explode: 3.2, model: 'wisp', color: '#ffe066', flags: ['flying'], drops: [drop('zephyr_feather', 0.25)] }),

  // Isle of Water — Tidecrown Atoll.
  reef_crab: E('reef_crab', { name: 'Reef Crab', family: 'reef', role: 'frontline', behavior: 'melee', hp: 150, dmg: 16, speed: 2.2, xp: 48, radius: 0.8,
    frontArmor: 0.7, model: 'crab', color: '#ff8a6a', drops: [drop('tide_silk', 0.3)] }),
  siren: E('siren', { name: 'Siren', family: 'reef', role: 'ranged', behavior: 'ranged', hp: 85, dmg: 15, speed: 3.2, xp: 46,
    proj: 'glob', onHit: 'slow', range: 12, atkCd: 2.2, model: 'wraith', color: '#6fd6e0', flags: ['flying'], drops: [drop('tide_silk', 0.5)] }),
  drowned_sailor: E('drowned_sailor', { name: 'Drowned Sailor', family: 'reef', role: 'frontline', behavior: 'melee', hp: 120, dmg: 18, speed: 2.4, xp: 42,
    model: 'zombie', color: '#8aa0a0', cloth: '#2a4a6a', helmet: true, drops: [drop('tide_silk', 0.4)] }),
  glass_jelly: E('glass_jelly', { name: 'Glass Jelly', family: 'reef', role: 'swarm', behavior: 'aura', hp: 70, dmg: 9, speed: 2.0, xp: 34,
    auraRadius: 2.4, atkCd: 1.0, onHit: 'shock', model: 'jelly', color: '#c9a0ff', flags: ['flying'], drops: [drop('tide_silk', 0.4)] }),

  // Isle of Fire — Cinderspine.
  lava_hound: E('lava_hound', { name: 'Lava Hound', family: 'cinder', role: 'swarm', behavior: 'melee', hp: 110, dmg: 18, speed: 5.5, xp: 46, atkCd: 1.1, windup: 0.35,
    onHit: 'burn', model: 'hound', color: '#ff6a2a', fireproof: true, drops: [drop('salamander_scale', 0.35)] }),
  obsidian_golem: E('obsidian_golem', { name: 'Obsidian Golem', family: 'cinder', role: 'tank', behavior: 'golem', hp: 420, dmg: 34, speed: 1.5, xp: 110, radius: 1.0, scale: 1.6,
    range: 2.6, atkCd: 2.8, windup: 0.9, slam: 3.4, model: 'golem', color: '#ff7a3d', fireproof: true, drops: [drop('salamander_scale', 0.5, 1, 2)] }),
  fire_imp: E('fire_imp', { name: 'Fire Imp', family: 'cinder', role: 'ranged', behavior: 'ranged', hp: 80, dmg: 16, speed: 3.6, xp: 44,
    proj: 'fireball', onHit: 'burn', range: 12, atkCd: 2.0, model: 'imp', color: '#ff4a3a', fireproof: true, drops: [drop('salamander_scale', 0.4)] }),
  ash_shaman: E('ash_shaman', { name: 'Ash Shaman', family: 'cinder', role: 'support', behavior: 'support_buff', hp: 100, dmg: 10, speed: 2.6, xp: 55,
    buff: 'haste', auraRadius: 9, atkCd: 6, model: 'wraith', color: '#8a6a5a', fireproof: true, drops: [drop('salamander_scale', 0.4)] }),

  // Isle of Earth — the Rootdeep Mesas.
  mossback_tortoise: E('mossback_tortoise', { name: 'Mossback Tortoise', family: 'root', role: 'tank', behavior: 'melee', hp: 380, dmg: 26, speed: 1.4, xp: 100, radius: 1.1,
    frontArmor: 0.8, range: 2.4, atkCd: 2.4, windup: 0.8, slam: 2.8, model: 'tortoise', color: '#6a8a4a', drops: [drop('golem_shard', 0.4, 1, 2)] }),
  root_lasher: E('root_lasher', { name: 'Root Lasher', family: 'root', role: 'frontline', behavior: 'lasher', hp: 160, dmg: 22, speed: 0, xp: 50,
    range: 6.5, atkCd: 2.2, windup: 0.7, model: 'lasher', color: '#7a5a3a', drops: [drop('golem_shard', 0.4)] }),
  burrowing_mole: E('burrowing_mole', { name: 'Burrowing Mole', family: 'root', role: 'frontline', behavior: 'burrow', hp: 140, dmg: 22, speed: 3.4, xp: 50, radius: 0.8,
    model: 'crawler', color: '#8a6a4a', scale: 1.3, drops: [drop('golem_shard', 0.45)] }),
  stone_wisp: E('stone_wisp', { name: 'Stone Wisp', family: 'root', role: 'ranged', behavior: 'ranged', hp: 90, dmg: 15, speed: 3.0, xp: 44,
    proj: 'pebble', range: 11, atkCd: 1.8, model: 'wisp', color: '#b8a98a', flags: ['flying'], drops: [drop('golem_shard', 0.45)] }),

  // The Dawn and Dusk Hollows (Core layer 8).
  dawn_sentinel: E('dawn_sentinel', { name: 'Dawnbound Sentinel', family: 'construct', role: 'ranged', behavior: 'sentry', hp: 260, dmg: 30, speed: 0, xp: 90,
    proj: 'beam', onHit: 'blind', range: 14, atkCd: 1.6, model: 'sentry', color: '#ffe9a8', drops: [drop('prism_dust', 0.5, 1, 2)] }),
  dusk_stalker: E('dusk_stalker', { name: 'Duskstalker', family: 'beast', role: 'frontline', behavior: 'lurker', hp: 220, dmg: 40, speed: 4.4, xp: 95,
    model: 'lurker', color: '#5a2a8a', drops: [drop('prism_dust', 0.5, 1, 2)] }),
  echo_knight: E('echo_knight', { name: 'Echo Knight', family: 'zombie', role: 'frontline', behavior: 'melee', hp: 320, dmg: 36, speed: 2.4, xp: 100, radius: 0.7, scale: 1.4,
    frontArmor: 0.5, range: 2.2, model: 'zombie', color: '#c9ced8', cloth: '#3a3a5a', helmet: true, drops: [drop('zombie_sinew', 0.6, 1, 2), drop('prism_dust', 0.3)] }),
};

// Elite affixes: rolled on wave and cave spawns as the pressure rises.
export const ELITE_AFFIXES = {
  swift: { name: 'Swift', color: '#ffe17a', speed: 1.45 },
  armoured: { name: 'Armoured', color: '#b9b2a8', dr: 0.35 },
  vampiric: { name: 'Vampiric', color: '#e0314f', lifesteal: 0.3 },
  volatile: { name: 'Volatile', color: '#ff8a3d', explodeOnDeath: 3 },
  shielding: { name: 'Shielding', color: '#7fb3ff', shieldAllies: 0.15 },
};
export const ELITE = { hp: 2.6, dmg: 1.3, xp: 3, dropBonus: 0.25, scale: 1.25 };
