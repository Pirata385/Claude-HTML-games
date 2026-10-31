// The five classes. `scaling` lists which attributes feed the class's damage;
// `growth` lists the attributes the class gains for free as it levels.

export const CLASSES = {
  swordsman: {
    id: 'swordsman', name: 'Swordsman', color: '#e0614f',
    tagline: 'Close combat, combos and the perfect parry.',
    desc: 'A front-line duellist. Chains three-hit combos, guards against blows and punishes a well-timed parry. No ranged options: close the gap or die trying.',
    resource: { id: 'stamina', name: 'Stamina', color: '#f2c14e', max: 100, regen: 16 },
    hp: 125, hpPerLevel: 15, baseDef: 4, moveSpeed: 5.2,
    scaling: { str: 1.0, agi: 0.25 }, growth: ['str', 'res'],
    weapon: 'Sword', armor: 'Plate', accessory: 'Signet',
    mults: { power: 1.0, def: 1.3, hp: 1.25 },
  },
  archer: {
    id: 'archer', name: 'Archer', color: '#58c47a',
    tagline: 'Precision at range, charged shots and mobility.',
    desc: 'Charges shots for piercing power, aims for precision and keeps moving. Arrows lose bite at point blank range, and the Archer cannot take many hits.',
    resource: { id: 'focus', name: 'Focus', color: '#7ee0a0', max: 100, regen: 17 },
    hp: 95, hpPerLevel: 11, baseDef: 2, moveSpeed: 5.6,
    scaling: { dex: 1.0, agi: 0.3 }, growth: ['dex', 'agi'],
    weapon: 'Bow', armor: 'Leathers', accessory: 'Quiver Charm',
    mults: { power: 0.95, def: 0.9, hp: 0.95 },
  },
  mage: {
    id: 'mage', name: 'Mage', color: '#6f8dff',
    tagline: 'Crowd control: elements that pin whole packs, and one devastating lance.',
    desc: 'Bursting bolts, flame that throws foes back, frost that freezes a whole pack and lightning that stuns it. A barrier keeps the Mage alive and shatters into ice; the Arcane Lance ends one foe. Spells take a moment to cast, mana runs dry and robes stop little.',
    resource: { id: 'mana', name: 'Mana', color: '#6fa8ff', max: 120, regen: 9 },
    hp: 85, hpPerLevel: 10, baseDef: 1, moveSpeed: 5.2,
    scaling: { int: 1.0, spi: 0.25 }, growth: ['int', 'rsv'],
    weapon: 'Staff', armor: 'Robes', accessory: 'Focus Gem',
    mults: { power: 1.05, def: 0.7, hp: 0.85 },
  },
  assassin: {
    id: 'assassin', name: 'Assassin', color: '#d0507a',
    tagline: 'Speed, backstabs and focused burst.',
    desc: 'Fast blades that strike twice as hard from behind. Marks a single target and takes it apart. The thinnest health of all, and few answers to a crowd.',
    resource: { id: 'energy', name: 'Energy', color: '#ff6b8b', max: 60, regen: 30 },
    hp: 80, hpPerLevel: 10, baseDef: 2, moveSpeed: 6.0,
    scaling: { agi: 0.6, dex: 0.6, str: 0.2 }, growth: ['agi', 'dex'],
    weapon: 'Daggers', armor: 'Shroud', accessory: 'Talisman',
    mults: { power: 0.8, def: 0.75, hp: 0.85 },
  },
  stardust: {
    id: 'stardust', name: 'Stardust', color: '#b07bff',
    tagline: 'Manifest your Astral and fight beside it.',
    desc: 'A Starbearer who calls down their Astral, a stand of starlight unique to them. The Astral fights within a leash, guards, pulls foes together and can be posted as a sentinel. It breaks after a number of blows that grows with Spirituality (up to 20), and puddles on the ground pass through it. Manifesting drains Spirit, and wounds dealt to the Astral echo back to its bearer.',
    resource: { id: 'spirit', name: 'Spirit', color: '#c48cff', max: 100, regen: 14, drain: 5 },
    hp: 100, hpPerLevel: 12, baseDef: 3, moveSpeed: 5.4,
    scaling: { spi: 1.0, int: 0.2 }, growth: ['spi', 'res'],
    weapon: 'Star Sigil', armor: 'Mantle', accessory: 'Star Locket',
    mults: { power: 0.9, def: 0.9, hp: 1.0 },
  },
};

export const CLASS_IDS = Object.keys(CLASSES);
