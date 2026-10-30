// Materials of Milestone 1. Main materials form the progression chain;
// drops come from creatures and bosses and are needed by recipes.

export const RARITY = {
  common: { name: 'Common', color: '#c8c3b8', rank: 0 },
  uncommon: { name: 'Uncommon', color: '#6fd67a', rank: 1 },
  rare: { name: 'Rare', color: '#57a8ff', rank: 2 },
  epic: { name: 'Epic', color: '#c07bff', rank: 3 },
  legendary: { name: 'Legendary', color: '#ffb347', rank: 4 },
};

// Recipe level for each main tier (index = tier).
export const TIER_RECIPE_LEVEL = [1, 3, 8, 16, 26, 38, 50, 64, 100];

// Material traits: what crafting with a material does beyond raw numbers.
export const TRAITS = {
  light: { name: 'Light', desc: 'Faster attacks.' },
  heavy: { name: 'Heavy', desc: 'Hits knock foes back harder; armour resists stagger.' },
  conductive: { name: 'Conductive', desc: 'Hits may arc lightning to two nearby foes.' },
  gilded: { name: 'Gilded', desc: 'Boosts Intelligence and Spirituality scaling and drop luck, but softer armour.' },
  tempered: { name: 'Tempered', desc: 'Pierces armour; armour is tougher.' },
  dense: { name: 'Dense', desc: 'Crushing knockback and status resistance, at a little speed.' },
  featherweight: { name: 'Featherweight', desc: 'Faster attacks and movement, shorter dodge cooldown.' },
  verdant: { name: 'Verdant', desc: 'Life steal on hits; armour regenerates health.' },
  ember: { name: 'Ember', desc: 'Hits may set foes ablaze; fire skills burn hotter.' },
  rime: { name: 'Rime', desc: 'Hits may chill foes; armour speeds resource regeneration.' },
  prismatic: { name: 'Prismatic', desc: 'More critical hits. Critical hits split projectiles or release a shockwave.' },
  radiant: { name: 'Radiant', desc: 'Hits may blind foes and every kill restores health; armour wards off afflictions and strengthens healing.' },
  umbral: { name: 'Umbral', desc: 'Critical hits drink the life of their target and strike far harder; armour quickens your dodge.' },
};

const M = (id, o) => ({ id, ...o });

export const MATERIALS = {
  // Main chain ------------------------------------------------------------
  wood: M('wood', { name: 'Wood', tier: 0, kind: 'main', rarity: 'common', trait: 'light', color: '#9a6a3c',
    desc: 'Dawnreach oak. The Dawnforgers burned it in their first forges, before they found hotter fuel.' }),
  stone: M('stone', { name: 'Stone', tier: 1, kind: 'main', rarity: 'common', trait: 'heavy', color: '#8f949c',
    desc: 'Grey island stone, veined faintly with violet where it once touched the Core.' }),
  copper: M('copper', { name: 'Copper', tier: 2, kind: 'main', rarity: 'uncommon', trait: 'conductive', color: '#d9824b',
    desc: 'The Dawnforgers wired their lanterns with it. It still hums when lightning is near.' }),
  gold: M('gold', { name: 'Gold', tier: 2, kind: 'main', rarity: 'uncommon', trait: 'gilded', color: '#f2c94c',
    desc: 'Soft and generous. Old miners swore gold listened when you spoke to it.' }),
  iron: M('iron', { name: 'Iron', tier: 3, kind: 'main', rarity: 'uncommon', trait: 'tempered', color: '#b9b2a8',
    desc: 'The metal of the Ironworks. Every rail in the Hollow Deep was forged from it.' }),
  lead: M('lead', { name: 'Lead', tier: 4, kind: 'main', rarity: 'rare', trait: 'dense', color: '#6d7487',
    desc: 'Heavy and patient. The Dawnforgers lined their Core shafts with it to hush the Echo.' }),
  titanium: M('titanium', { name: 'Titanium', tier: 4, kind: 'main', rarity: 'rare', trait: 'featherweight', color: '#c9dbe8',
    desc: 'Pale, light and stubborn. Scouts of the old empire wore nothing else.' }),
  emerald: M('emerald', { name: 'Emerald', tier: 5, kind: 'main', rarity: 'rare', trait: 'verdant', color: '#3fd17f',
    desc: 'Grows where the fungal depths breathe. Cut emeralds slowly mend what holds them.' }),
  ruby: M('ruby', { name: 'Ruby', tier: 6, kind: 'main', rarity: 'epic', trait: 'ember', color: '#ff4d5e',
    desc: 'Crystallised heat from the Ember Rift. Warm to the touch, even in the dark.' }),
  sapphire: M('sapphire', { name: 'Sapphire', tier: 6, kind: 'main', rarity: 'epic', trait: 'rime', color: '#4f8dff',
    desc: 'Frozen light from the Rime Rift. Frost gathers on whatever it touches.' }),
  diamond: M('diamond', { name: 'Diamond', tier: 7, kind: 'main', rarity: 'epic', trait: 'prismatic', color: '#bff6ff',
    desc: 'Pressed into being beside the Sealed Core. It splits every light into all of its possibilities.' }),

  dawndosite: M('dawndosite', { name: 'Dawndosite', tier: 8, kind: 'main', rarity: 'legendary', trait: 'radiant', color: '#ffe9a8',
    desc: 'Singularita\'s memory of a morning that never ended. It glows warm in the hand and hums when the sun rises somewhere far above.' }),
  escuresite: M('escuresite', { name: 'Escuresite', tier: 8, kind: 'main', rarity: 'legendary', trait: 'umbral', color: '#6a3aa8',
    desc: 'Singularita\'s memory of a night with no dawn. It drinks lamplight, and shadows lean toward it.' }),

  // Elemental isles (exclusive) ----------------------------------------------
  skyglass: M('skyglass', { name: 'Skyglass', tier: 7, kind: 'isle', rarity: 'rare', color: '#bfe6ff',
    desc: 'Glass the wind blew into shape on the Galeforge Spires. It weighs less than the air it displaces.' }),
  zephyr_feather: M('zephyr_feather', { name: 'Zephyr Feather', tier: 7, kind: 'drop', rarity: 'rare', color: '#eef6ff',
    desc: 'A gale harpy\'s flight feather. Dropped from a height, it never quite lands.' }),
  abyssal_pearl: M('abyssal_pearl', { name: 'Abyssal Pearl', tier: 7, kind: 'isle', rarity: 'rare', color: '#d8f0ff',
    desc: 'Pearls from the drowned palace\'s beds, reachable only at low tide. Each one holds a drop of the old sea.' }),
  tide_silk: M('tide_silk', { name: 'Tide Silk', tier: 7, kind: 'drop', rarity: 'rare', color: '#6fd6e0',
    desc: 'Threads spun by the reef\'s creatures from water itself. Cool, strong and always slightly damp.' }),
  obsidian: M('obsidian', { name: 'Obsidian', tier: 7, kind: 'isle', rarity: 'rare', color: '#2a2030',
    desc: 'Volcanic glass from Cinderspine\'s lava fields. The Dawnforgers ground it into the edges of their first crowns.' }),
  salamander_scale: M('salamander_scale', { name: 'Salamander Scale', tier: 7, kind: 'drop', rarity: 'rare', color: '#ff7a3d',
    desc: 'A scale shed by Cinderspine\'s fire creatures, still warm a week later.' }),
  living_amber: M('living_amber', { name: 'Living Amber', tier: 7, kind: 'isle', rarity: 'rare', color: '#ffb030',
    desc: 'Sap of the Worldroot, hardened around a heartbeat. It is slightly warm, and it slowly mends cracks.' }),
  golem_shard: M('golem_shard', { name: 'Golem Shard', tier: 7, kind: 'drop', rarity: 'rare', color: '#a8987a',
    desc: 'A chip of the stone creatures of the Rootdeep Mesas, veined with roots that still grow.' }),

  // Creature drops --------------------------------------------------------
  slime_gel: M('slime_gel', { name: 'Slime Gel', tier: 0, kind: 'drop', rarity: 'common', color: '#7ee07e',
    desc: 'Coolant gel from the old forges, gone feral. Sticky, cool and oddly cheerful.' }),
  zombie_sinew: M('zombie_sinew', { name: 'Echo Sinew', tier: 1, kind: 'drop', rarity: 'common', color: '#a3876b',
    desc: 'Taut cords left behind when a night-walking Echo fades at dawn. Makes fine bowstrings and grips.' }),
  bat_leather: M('bat_leather', { name: 'Bat Leather', tier: 2, kind: 'drop', rarity: 'common', color: '#5a4a5e',
    desc: 'Thin, tough wing-leather from the Rootways bats.' }),
  crawler_chitin: M('crawler_chitin', { name: 'Crawler Chitin', tier: 4, kind: 'drop', rarity: 'uncommon', color: '#58c7b2',
    desc: 'Shell plates of the crystal crawlers of the fungal depths, hard as tile and half as heavy.' }),
  ember_core: M('ember_core', { name: 'Ember Core', tier: 6, kind: 'drop', rarity: 'rare', color: '#ff8a3d',
    desc: 'The still-beating heart of a magma slug.' }),
  rime_shard: M('rime_shard', { name: 'Rime Shard', tier: 6, kind: 'drop', rarity: 'rare', color: '#9fd8ff',
    desc: 'A sliver of a rime wraith, cold enough to bite through gloves.' }),
  prism_dust: M('prism_dust', { name: 'Prism Dust', tier: 7, kind: 'drop', rarity: 'rare', color: '#e8d2ff',
    desc: 'Ground from the crystal bodies of gem golems and lurkers. It glitters in colours that do not exist.' }),
  royal_jelly: M('royal_jelly', { name: 'Royal Jelly', tier: 3, kind: 'boss', rarity: 'epic', color: '#ffd166',
    desc: 'The Slime Prince\'s golden gel. It wobbles with a dignity it has not earned.' }),
  silver_mane: M('silver_mane', { name: 'Silver Mane', tier: 4, kind: 'boss', rarity: 'epic', color: '#d8dde6',
    desc: 'A lock of the Silverback Emperor\'s mane, still bristling with the Echo that raised him.' }),
  eastwind_silk: M('eastwind_silk', { name: 'Eastwind Silk', tier: 7, kind: 'boss', rarity: 'epic', color: '#cfe8ff',
    desc: 'A strip of the Ronin\'s sash. Even folded in a pack, it streams eastward.' }),
  poseidon_tear: M('poseidon_tear', { name: "Poseidon's Tear", tier: 7, kind: 'boss', rarity: 'epic', color: '#7fe0ff',
    desc: 'A tear of grief, crystallised. Hold it to your ear and you hear the palace bells under the sea.' }),
  vector_core: M('vector_core', { name: 'Vector Core', tier: 7, kind: 'boss', rarity: 'epic', color: '#ff9a3a',
    desc: 'The still heart of the Magma Vector. It points, always, in the direction you are about to move.' }),
  allele_seed: M('allele_seed', { name: 'Allele Seed', tier: 7, kind: 'boss', rarity: 'epic', color: '#8ad06a',
    desc: 'A seed of the Divine Golem. Plant it and it would grow a different creature every time.' }),

  // Sigils: key items that open the Sealed Core Gate --------------------------
  sigil_wind: M('sigil_wind', { name: 'Sigil of Wind', tier: 7, kind: 'key', rarity: 'legendary', color: '#9fe0ff',
    desc: 'One of the four keys to the Sealed Core Gate, kept by the Ronin of the East Wind.' }),
  sigil_tide: M('sigil_tide', { name: 'Sigil of Tide', tier: 7, kind: 'key', rarity: 'legendary', color: '#5fb0ff',
    desc: 'One of the four keys to the Sealed Core Gate, wept out by the Tears of Poseidon.' }),
  sigil_flame: M('sigil_flame', { name: 'Sigil of Flame', tier: 7, kind: 'key', rarity: 'legendary', color: '#ff7a3d',
    desc: 'One of the four keys to the Sealed Core Gate, burning at the heart of the Magma Vector.' }),
  sigil_stone: M('sigil_stone', { name: 'Sigil of Stone', tier: 7, kind: 'key', rarity: 'legendary', color: '#8ad06a',
    desc: 'One of the four keys to the Sealed Core Gate, grown inside the Allele of the Divine Golem.' }),
};
export const SIGILS = ['sigil_wind', 'sigil_tide', 'sigil_flame', 'sigil_stone'];

export const MAIN_MATERIALS = Object.values(MATERIALS)
  .filter((m) => m.kind === 'main')
  .sort((a, b) => a.tier - b.tier)
  .map((m) => m.id);
