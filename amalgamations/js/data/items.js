// Amalgamations — item data: weapons, armour, rarities, affixes, legendaries, materials, consumables, recipes.
(function (root) {
  'use strict';
  const AM = root.AM || (root.AM = {});

  const RARITIES = [
    { id: 'common', name: 'Common', color: '#c9ced6', affixes: 0, mult: 1.0, weight: 60, sell: 1 },
    { id: 'uncommon', name: 'Uncommon', color: '#5fd068', affixes: 1, mult: 1.12, weight: 25, sell: 2 },
    { id: 'rare', name: 'Rare', color: '#4aa3ff', affixes: 2, mult: 1.28, weight: 11, sell: 4 },
    { id: 'epic', name: 'Epic', color: '#b45cff', affixes: 3, mult: 1.48, weight: 3.5, sell: 8 },
    { id: 'legendary', name: 'Legendary', color: '#ffb020', affixes: 3, mult: 1.72, weight: 0.5, sell: 16 },
  ];
  const RARITY = {};
  RARITIES.forEach((r, i) => { r.tier = i; RARITY[r.id] = r; });

  // Weapons float beside the creature ("bound weapons") so any body plan can use them.
  // dmg: damage multiplier, rate: attacks per second multiplier, reach/arc for melee, range for ranged.
  const WEAPONS = {
    sword:    { name: 'Sword', kind: 'melee', dmg: 1.0, rate: 1.0, reach: 2.0, arc: 2.2, combo: 3, icon: 'sword' },
    greataxe: { name: 'Greataxe', kind: 'melee', dmg: 1.65, rate: 0.62, reach: 2.3, arc: 3.2, icon: 'axe' },
    hammer:   { name: 'Hammer', kind: 'melee', dmg: 1.5, rate: 0.7, reach: 2.0, arc: 2.0, stun: 0.15, icon: 'hammer' },
    spear:    { name: 'Spear', kind: 'melee', dmg: 1.1, rate: 0.9, reach: 3.0, arc: 0.7, icon: 'spear' },
    daggers:  { name: 'Daggers', kind: 'melee', dmg: 0.58, rate: 1.85, reach: 1.7, arc: 1.6, icon: 'dagger' },
    bow:      { name: 'Bow', kind: 'ranged', dmg: 0.95, rate: 0.9, range: 15, speed: 24, icon: 'bow' },
    staff:    { name: 'Staff', kind: 'ranged', dmg: 0.8, rate: 0.85, range: 12, speed: 15, power: 0.15, icon: 'staff' },
    claws:    { name: 'Claws', kind: 'natural', dmg: 0.75, rate: 1.35, natural: 0.35, icon: 'claw' },
  };
  const ARMOR = {
    helmet: { name: 'Helmet', def: 3, hp: 10, icon: 'helmet' },
    armor:  { name: 'Armour', def: 6, hp: 22, icon: 'armor' },
    charm:  { name: 'Charm', def: 0, hp: 8, icon: 'charm' },
    ring:   { name: 'Ring', def: 0, hp: 0, atk: 2, icon: 'ring' },
  };
  const SLOTS = ['weapon', 'helmet', 'armor', 'charm', 'ring'];

  // Affixes. pct affixes roll a value in [lo, hi] scaled by rarity; flat ones also scale with item level.
  const AFFIXES = {
    dmgPct:      { name: 'Damage', fmt: '+{v}% damage', lo: 4, hi: 10, slots: ['weapon', 'ring'], adj: 'Brutal' },
    critChance:  { name: 'Crit chance', fmt: '+{v}% critical chance', lo: 2, hi: 5, slots: ['weapon', 'ring', 'charm'], adj: 'Keen' },
    critDmg:     { name: 'Crit damage', fmt: '+{v}% critical damage', lo: 8, hi: 20, slots: ['weapon', 'ring'], adj: 'Cruel' },
    atkSpeed:    { name: 'Attack speed', fmt: '+{v}% attack speed', lo: 4, hi: 9, slots: ['weapon', 'ring'], adj: 'Quick' },
    lifesteal:   { name: 'Lifesteal', fmt: '+{v}% lifesteal', lo: 1, hi: 3, slots: ['weapon', 'ring'], adj: 'Vampiric' },
    powerDmg:    { name: 'Power damage', fmt: '+{v}% power damage', lo: 5, hi: 12, slots: ['weapon', 'ring', 'helmet'], adj: 'Arcane' },
    elementDmg:  { name: 'Element damage', fmt: '+{v}% {el} damage', lo: 8, hi: 18, slots: ['weapon', 'ring', 'charm'], adj: 'Elemental' },
    hpPct:       { name: 'Health', fmt: '+{v}% health', lo: 4, hi: 9, slots: ['helmet', 'armor', 'charm'], adj: 'Hale' },
    flatHp:      { name: 'Health', fmt: '+{v} health', lo: 12, hi: 30, flat: true, slots: ['helmet', 'armor'], adj: 'Sturdy' },
    flatDef:     { name: 'Defence', fmt: '+{v} defence', lo: 2, hi: 5, flat: true, slots: ['helmet', 'armor'], adj: 'Guarding' },
    thorns:      { name: 'Thorns', fmt: '+{v}% thorns', lo: 5, hi: 12, slots: ['armor'], adj: 'Barbed' },
    regen:       { name: 'Regeneration', fmt: '+{v}% health/s', lo: 0.2, hi: 0.5, dec: 1, slots: ['armor', 'helmet', 'charm'], adj: 'Mending' },
    cdr:         { name: 'Cooldowns', fmt: '-{v}% cooldowns', lo: 3, hi: 7, slots: ['helmet', 'charm'], adj: 'Focused' },
    maxEnergy:   { name: 'Energy', fmt: '+{v} max energy', lo: 8, hi: 20, slots: ['helmet', 'charm'], adj: 'Charged' },
    energyRegen: { name: 'Energy regen', fmt: '+{v}% energy regen', lo: 8, hi: 18, slots: ['charm', 'helmet'], adj: 'Flowing' },
    speedPct:    { name: 'Speed', fmt: '+{v}% movement speed', lo: 3, hi: 7, slots: ['charm', 'armor'], adj: 'Swift' },
    evade:       { name: 'Evasion', fmt: '+{v}% evasion', lo: 2, hi: 4, slots: ['charm'], adj: 'Elusive' },
    xpPct:       { name: 'Experience', fmt: '+{v}% experience', lo: 5, hi: 12, slots: ['charm', 'helmet'], adj: 'Wise' },
    goldPct:     { name: 'Gold', fmt: '+{v}% gold', lo: 8, hi: 20, slots: ['charm', 'ring'], adj: 'Gilded' },
    findPct:     { name: 'Item find', fmt: '+{v}% item find', lo: 5, hi: 12, slots: ['charm', 'ring'], adj: 'Lucky' },
  };
  const AFFIX_ELEMENTS = ['fire', 'frost', 'storm', 'venom', 'earth', 'water', 'wind', 'life', 'shadow', 'light', 'arcane', 'metal'];

  // Eight legendaries with unique effects (handled by stats.js and combat.js).
  const LEGENDARIES = {
    emberfang:     { name: 'Emberfang', slot: 'weapon', base: 'sword', desc: 'Every hit sets the target on fire.' },
    worldsplitter: { name: 'Worldsplitter', slot: 'weapon', base: 'hammer', desc: 'Every fourth hit splits the earth around you.' },
    stormcaller:   { name: 'Stormcaller', slot: 'weapon', base: 'staff', desc: 'Basic attacks arc to two more enemies.' },
    quiver:        { name: 'Quiver of Plenty', slot: 'weapon', base: 'bow', desc: 'Fires three arrows at once.' },
    hollowcrown:   { name: 'Hollow Crown', slot: 'helmet', desc: 'Grants one extra power slot.' },
    gaiamantle:    { name: "Gaia's Mantle", slot: 'armor', desc: '+20% health and regenerate 1.5% health per second.' },
    luckypaw:      { name: 'Lucky Paw', slot: 'charm', desc: '+50% gold and +50% item find.' },
    echoring:      { name: 'Ring of Echoes', slot: 'ring', desc: 'Powers have a 20% chance to cast twice.' },
  };

  const MATERIALS = {
    wood:       { name: 'Wood', color: '#9a6a3a', value: 2, desc: 'Gathered from fallen logs.' },
    stone:      { name: 'Stone', color: '#9aa0a8', value: 2, desc: 'Mined from rocks and ore veins.' },
    iron:       { name: 'Iron Ore', color: '#b8b0a8', value: 4, desc: 'Mined from iron veins. Used to forge gear.' },
    goldore:    { name: 'Gold Ore', color: '#f2c14e', value: 8, desc: 'Mined from gold veins. Used for rings and charms.' },
    crystal:    { name: 'Crystal', color: '#6fe3ff', value: 8, desc: 'Found in caves and crystal fields.' },
    frostshard: { name: 'Frost Shard', color: '#bfefff', value: 6, desc: 'Dropped by tundra creatures.' },
    embercore:  { name: 'Ember Core', color: '#ff7a2f', value: 7, desc: 'Dropped by volcanic creatures.' },
    gel:        { name: 'Gel', color: '#7fe07a', value: 3, desc: 'Dropped by gooey creatures.' },
    hide:       { name: 'Hide', color: '#a8774a', value: 3, desc: 'Dropped by furry and scaly creatures.' },
    herb:       { name: 'Herb', color: '#5fd068', value: 2, desc: 'Picked from herb bushes.' },
    essence:    { name: 'Essence', color: '#d07bff', value: 5, desc: 'The spark left by fallen creatures. Fuses powers and upgrades gear.' },
  };

  const CONSUMABLES = {
    potion: { name: 'Health Potion', color: '#ff5a6a', value: 15, desc: 'Restores 45% of your health.' },
    tonic:  { name: 'Energy Tonic', color: '#5ab4ff', value: 15, desc: 'Restores 60% of your energy.' },
    tea:    { name: 'Cleansing Tea', color: '#c8f08a', value: 20, desc: 'Removes harmful effects and protects from them for 8 s.' },
    haste:  { name: 'Haste Elixir', color: '#ffd166', value: 25, desc: '+30% movement and attack speed for 20 s.' },
    recall: { name: 'Recall Stone', color: '#a98aff', value: 30, desc: 'Teleports you to the last village you visited.' },
    tome:   { name: 'Power Tome', color: '#ffb020', value: 120, desc: 'Teaches a new power.' },
  };

  // Recipes. "level" items are made at the player's level.
  const RECIPES = [
    { id: 'potion', out: { con: 'potion', n: 2 }, cost: { herb: 2, gel: 1 }, gold: 0 },
    { id: 'tonic', out: { con: 'tonic', n: 2 }, cost: { herb: 2, crystal: 1 }, gold: 0 },
    { id: 'tea', out: { con: 'tea', n: 1 }, cost: { herb: 3, wood: 1 }, gold: 0 },
    { id: 'haste', out: { con: 'haste', n: 1 }, cost: { herb: 2, embercore: 1 }, gold: 0 },
    { id: 'recall', out: { con: 'recall', n: 1 }, cost: { stone: 3, crystal: 1 }, gold: 0 },
    { id: 'w_sword', out: { gear: 'weapon', base: 'sword' }, cost: { iron: 4, wood: 2, essence: 2 }, gold: 30, smith: true },
    { id: 'w_greataxe', out: { gear: 'weapon', base: 'greataxe' }, cost: { iron: 5, wood: 3, essence: 2 }, gold: 35, smith: true },
    { id: 'w_hammer', out: { gear: 'weapon', base: 'hammer' }, cost: { iron: 5, stone: 4, essence: 2 }, gold: 35, smith: true },
    { id: 'w_spear', out: { gear: 'weapon', base: 'spear' }, cost: { iron: 3, wood: 4, essence: 2 }, gold: 30, smith: true },
    { id: 'w_daggers', out: { gear: 'weapon', base: 'daggers' }, cost: { iron: 4, hide: 2, essence: 2 }, gold: 30, smith: true },
    { id: 'w_bow', out: { gear: 'weapon', base: 'bow' }, cost: { wood: 5, hide: 2, essence: 2 }, gold: 30, smith: true },
    { id: 'w_staff', out: { gear: 'weapon', base: 'staff' }, cost: { wood: 4, crystal: 2, essence: 3 }, gold: 40, smith: true },
    { id: 'w_claws', out: { gear: 'weapon', base: 'claws' }, cost: { iron: 3, hide: 3, essence: 2 }, gold: 30, smith: true },
    { id: 'a_helmet', out: { gear: 'helmet' }, cost: { iron: 4, hide: 2 }, gold: 25, smith: true },
    { id: 'a_armor', out: { gear: 'armor' }, cost: { iron: 6, hide: 4 }, gold: 35, smith: true },
    { id: 'a_charm', out: { gear: 'charm' }, cost: { goldore: 2, crystal: 1, hide: 1 }, gold: 30, smith: true },
    { id: 'a_ring', out: { gear: 'ring' }, cost: { goldore: 3, crystal: 2 }, gold: 40, smith: true },
  ];

  Object.assign(AM, { RARITIES, RARITY, WEAPONS, ARMOR, GEAR_SLOTS: SLOTS, AFFIXES, AFFIX_ELEMENTS, LEGENDARIES, MATERIALS, CONSUMABLES, RECIPES });
  if (typeof module !== 'undefined' && module.exports) module.exports = AM;
})(typeof window !== 'undefined' ? window : globalThis);
