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
export const TIER_RECIPE_LEVEL = [1, 3, 8, 16, 26, 38, 50, 64];

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
};

export const MAIN_MATERIALS = Object.values(MATERIALS)
  .filter((m) => m.kind === 'main')
  .sort((a, b) => a.tier - b.tier)
  .map((m) => m.id);
