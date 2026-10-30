// Equipment and tools, generated from class templates × material properties.
// Items never need a level to equip; level gates recipes only (see recipes.js).
import { MATERIALS, MAIN_MATERIALS } from './materials.js';
import { CLASSES, CLASS_IDS } from './classes.js';
import { TOOL_POWER } from './nodes.js';

export const WEAPON_POWER = [8, 13, 20, 30, 44, 62, 86, 118, 160, 215, 290];
export const ARMOR_DEF = [4, 8, 14, 22, 33, 47, 64, 86, 114, 150, 195];
export const ARMOR_HP = [10, 25, 45, 75, 115, 165, 230, 310, 410, 540, 700];
export const ACC_ATTR = [2, 4, 7, 11, 16, 22, 30, 40, 52, 66, 84];

// Material trait → stat modifiers, per slot.
const TRAIT_MODS = {
  light: { weapon: { atkSpd: 0.06 }, armor: { moveSpd: 0.02 }, accessory: { atkSpd: 0.03 } },
  heavy: { weapon: { knockback: 0.4, atkSpd: -0.04 }, armor: { staggerRes: 0.25 }, accessory: { knockback: 0.2 } },
  conductive: { weapon: { shockChance: 0.12 }, armor: { shockChance: 0.04 }, accessory: { shockChance: 0.05 } },
  gilded: { weapon: { intScale: 0.12, spiScale: 0.12, luck: 0.1 }, armor: { defMult: -0.15, luck: 0.1 }, accessory: { luck: 0.15, intScale: 0.06, spiScale: 0.06 } },
  tempered: { weapon: { armorPen: 0.15 }, armor: { defMult: 0.1 }, accessory: { armorPen: 0.08 } },
  dense: { weapon: { knockback: 0.8, statusRes: 0.1 }, armor: { statusRes: 0.2, moveSpd: -0.05, defMult: 0.08 }, accessory: { statusRes: 0.12 } },
  featherweight: { weapon: { atkSpd: 0.1, moveSpd: 0.03 }, armor: { moveSpd: 0.06, dodgeCd: 0.2 }, accessory: { atkSpd: 0.05, dodgeCd: 0.1 } },
  verdant: { weapon: { lifesteal: 0.04 }, armor: { hpRegen: 0.006 }, accessory: { lifesteal: 0.02, hpRegen: 0.003 } },
  ember: { weapon: { burnChance: 0.25 }, armor: { statusRes: 0.1, fireBonus: 0.1 }, accessory: { burnChance: 0.1, fireBonus: 0.15 } },
  rime: { weapon: { chillChance: 0.25 }, armor: { resRegen: 0.15 }, accessory: { chillChance: 0.1, resRegen: 0.1 } },
  prismatic: { weapon: { crit: 0.08, critMult: 0.3, prismatic: 1 }, armor: { crit: 0.05, defMult: 0.05 }, accessory: { crit: 0.04, critMult: 0.15 } },
  radiant: { weapon: { blindChance: 0.15, killHeal: 0.03 }, armor: { statusRes: 0.15, healBonus: 0.15 }, accessory: { killHeal: 0.02, blindChance: 0.08 } },
  umbral: { weapon: { critMult: 0.4, critLifesteal: 0.15 }, armor: { dodgeCd: 0.15, crit: 0.04 }, accessory: { critMult: 0.2, critLifesteal: 0.06 } },
  chromatic: { weapon: { chromatic: 1, afflictedBonus: 0.2 }, armor: { statusRes: 0.25, afflictedBonus: 0.06 }, accessory: { chromatic: 1, afflictedBonus: 0.1 } },
  // Singularita's own trait is its Collapse; the two remembered traits are added from the save (see systems/memory.js).
  singular: { weapon: { collapse: 1 }, armor: { collapse: 0.5 }, accessory: { collapse: 0.5 } },
};

// Each class's accessory has its own perk on top of its attribute bonus.
const ACC_PERK = {
  swordsman: (t) => ({ resRegen: 0.08 + 0.01 * t }),
  archer: (t) => ({ crit: 0.02 + 0.005 * t }),
  mage: (t) => ({ cdr: 0.03 + 0.005 * t }),
  assassin: (t) => ({ critMult: 0.1 + 0.03 * t }),
  stardust: (t) => ({ resMax: 10 + 4 * t }),
};

const cap = (s) => s[0].toUpperCase() + s.slice(1);
const add = (into, mods) => { for (const [k, v] of Object.entries(mods || {})) into[k] = (into[k] || 0) + v; return into; };

function classItem(cls, slot, matId) {
  const c = CLASSES[cls], m = MATERIALS[matId], t = m.tier;
  const stats = {};
  let name;
  if (slot === 'weapon') {
    stats.power = Math.round(WEAPON_POWER[t] * c.mults.power);
    name = `${m.name} ${c.weapon}`;
  } else if (slot === 'armor') {
    stats.def = Math.round(ARMOR_DEF[t] * c.mults.def);
    stats.hp = Math.round(ARMOR_HP[t] * c.mults.hp);
    name = `${m.name} ${c.armor}`;
  } else {
    stats[c.growth[0]] = ACC_ATTR[t];
    stats[c.growth[1]] = Math.round(ACC_ATTR[t] / 2);
    add(stats, ACC_PERK[cls](t));
    name = `${m.name} ${c.accessory}`;
  }
  add(stats, TRAIT_MODS[m.trait][slot]);
  if (stats.defMult) { stats.def = Math.round((stats.def || 0) * (1 + stats.defMult)); delete stats.defMult; }
  return {
    id: `${cls}_${slot}_${matId}`, name, kind: 'gear', slot, class: cls, material: matId, tier: t,
    rarity: m.rarity, trait: m.trait, stats,
    ...(m.trait === 'singular' ? { memory: 2, collapse: true } : {}),
    desc: `${c.name} ${slot === 'accessory' ? 'accessory' : slot}. ${m.desc}`,
  };
}

function tool(kind, matId) {
  const m = MATERIALS[matId];
  return {
    id: `${kind}_${matId}`, name: `${m.name} ${cap(kind)}`, kind: 'tool', tool: kind, class: 'any', material: matId,
    tier: m.tier, rarity: m.rarity, stats: { toolPower: TOOL_POWER[m.tier] },
    desc: kind === 'pickaxe'
      ? `Mines veins up to one tier above ${m.name}. Better pickaxes also mine faster.`
      : 'Chops trees faster than bare hands.',
  };
}

const list = [];
for (const cls of CLASS_IDS) for (const mat of MAIN_MATERIALS) for (const slot of ['weapon', 'armor', 'accessory']) list.push(classItem(cls, slot, mat));
for (const mat of MAIN_MATERIALS) { list.push(tool('pickaxe', mat)); list.push(tool('axe', mat)); }

// Boss uniques (dropped, never crafted). Any class can wear them.
list.push({
  id: 'princes_crown', name: "Prince's Crown", kind: 'gear', slot: 'accessory', class: 'any', tier: 3, rarity: 'epic', unique: true,
  stats: { hpMult: 0.1, stillRegen: 0.02 },
  desc: 'A crown of hardened royal gel. While you stand still, it mends 2% of your health each second. It still smells faintly of sulking.',
});
list.push({
  id: 'emperors_knuckle', name: "Emperor's Knuckle", kind: 'gear', slot: 'accessory', class: 'any', tier: 4, rarity: 'epic', unique: true,
  stats: { dmgBonus: 0.12, knockback: 0.4, staggerRes: 0.2 },
  desc: 'A silver knuckle-plate from the war-ape of the Dawnforger king. +12% damage and a heavier hand.',
});

// Elemental isle accessories (crafted from isle materials) and isle boss uniques. Any class.
const anyAcc = (id, name, tier, rarity, stats, desc, unique = false) => list.push({ id, name, kind: 'gear', slot: 'accessory', class: 'any', tier, rarity, stats, desc, unique });
anyAcc('zephyr_charm', 'Zephyr Charm', 7, 'epic', { moveSpd: 0.08, dodgeCd: 0.15, agi: 12 }, 'Skyglass threaded on harpy feathers. Your feet forget how heavy they are.');
anyAcc('tidecaller_pendant', 'Tidecaller Pendant', 7, 'epic', { resRegen: 0.2, healBonus: 0.15, rsv: 12 }, 'An abyssal pearl in tide silk. It rises and falls with your breath.');
anyAcc('cinder_brand', 'Cinder Brand', 7, 'epic', { fireBonus: 0.15, burnChance: 0.12, str: 12 }, 'An obsidian brand bound in salamander scale, warm as a coal.');
anyAcc('rootbound_torc', 'Rootbound Torc', 7, 'epic', { hpMult: 0.12, staggerRes: 0.2, res: 12 }, 'Living amber set in a torc of root. It tightens when you are hit.');
anyAcc('ronin_sash', "Ronin's Sash", 8, 'legendary', { atkSpd: 0.12, crit: 0.06, dodgeCd: 0.15 }, 'The Ronin of the East Wind wore it for a thousand years of guard duty. It still streams in a wind that is not there.', true);
anyAcc('tearstone_pendant', 'Tearstone Pendant', 8, 'legendary', { hpRegen: 0.006, healBonus: 0.25, resMax: 25 }, 'A tear of the sea god set in coral. Grief, it turns out, is a kind of healing.', true);
anyAcc('vector_ring', 'Vector Ring', 8, 'legendary', { dmgBonus: 0.1, moveSpd: 0.05, armorPen: 0.1 }, 'A ring cut from the Magma Vector\'s path. It pulls your hand straight toward its target.', true);
anyAcc('allele_crest', 'Allele Crest', 8, 'legendary', { hpMult: 0.08, dmgBonus: 0.06, statusRes: 0.15 }, 'A crest grown, not forged. Each time you look at it, it is a slightly different shape.', true);

// Dimension rulers' uniques.
anyAcc('jailers_grip', "Jailer's Grip", 9, 'legendary', { knockback: 0.6, staggerRes: 0.3, dmgBonus: 0.1 }, 'An iron hand that never let go of a key. Foes you strike are dragged a step closer.', true);
anyAcc('siamese_locket', 'Siamese Locket', 9, 'legendary', { lifesteal: 0.04, hpRegen: 0.005, resMax: 30 }, 'Two hearts in a locket. When one of you is hurt, the other mends it.', true);
anyAcc('adamite_signet', 'Adamite Signet', 9, 'legendary', { armorPen: 0.2, crit: 0.06, statusRes: 0.15 }, 'The Adamite King\'s ring, cleansed. It no longer whispers, but it still commands.', true);
anyAcc('looking_glass', 'Looking-Glass', 10, 'legendary', { crit: 0.08, critMult: 0.3, dodgeCd: 0.15 }, 'A hand mirror from the Mirrored. The one in it moves first; follow it.', true);
anyAcc('ragnarok_fang', "Ragnarok's Fang", 10, 'legendary', { dmgBonus: 0.15, fireBonus: 0.25, burnChance: 0.15 }, 'A fang of the Dragon God. It is still hungry.', true);

export const ITEMS = Object.fromEntries(list.map((i) => [i.id, i]));

// Human-readable stat labels, used by tooltips and comparisons.
export const STAT_LABELS = {
  power: 'Power', def: 'Defence', hp: 'Health', toolPower: 'Tool power',
  str: 'Strength', res: 'Resistance', agi: 'Agility', dex: 'Dexterity', spi: 'Spirituality', int: 'Intelligence', rsv: 'Reserves',
  atkSpd: 'Attack speed', moveSpd: 'Move speed', dodgeCd: 'Dodge cooldown', crit: 'Crit chance', critMult: 'Crit damage',
  knockback: 'Knockback', staggerRes: 'Stagger resist', armorPen: 'Armour pierce', statusRes: 'Status resist',
  lifesteal: 'Life steal', hpRegen: 'Health regen', resRegen: 'Resource regen', resMax: 'Resource max', cdr: 'Cooldown reduction',
  luck: 'Drop luck', shockChance: 'Shock chance', burnChance: 'Burn chance', chillChance: 'Chill chance', prismatic: 'Prismatic',
  intScale: 'INT scaling', spiScale: 'SPI scaling', fireBonus: 'Fire bonus', hpMult: 'Max health', stillRegen: 'Regen when still', dmgBonus: 'Damage',
  blindChance: 'Blind chance', killHeal: 'Heal on kill', critLifesteal: 'Crit life drain', healBonus: 'Healing received',
  chromatic: 'Chromatic hits', afflictedBonus: 'Damage to afflicted', collapse: 'Collapse',
};
// Stats shown as percentages.
export const PERCENT_STATS = new Set(['atkSpd', 'moveSpd', 'dodgeCd', 'crit', 'critMult', 'knockback', 'staggerRes', 'armorPen', 'statusRes',
  'lifesteal', 'hpRegen', 'resRegen', 'cdr', 'luck', 'shockChance', 'burnChance', 'chillChance', 'intScale', 'spiScale', 'fireBonus', 'hpMult', 'stillRegen', 'dmgBonus',
  'blindChance', 'killHeal', 'critLifesteal', 'healBonus', 'afflictedBonus']);
