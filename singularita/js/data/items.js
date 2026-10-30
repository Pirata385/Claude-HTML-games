// Equipment and tools, generated from class templates × material properties.
// Items never need a level to equip; level gates recipes only (see recipes.js).
import { MATERIALS, MAIN_MATERIALS } from './materials.js';
import { CLASSES, CLASS_IDS } from './classes.js';
import { TOOL_POWER } from './nodes.js';

export const WEAPON_POWER = [8, 13, 20, 30, 44, 62, 86, 118];
export const ARMOR_DEF = [4, 8, 14, 22, 33, 47, 64, 86];
export const ARMOR_HP = [10, 25, 45, 75, 115, 165, 230, 310];
export const ACC_ATTR = [2, 4, 7, 11, 16, 22, 30, 40];

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
};
// Stats shown as percentages.
export const PERCENT_STATS = new Set(['atkSpd', 'moveSpd', 'dodgeCd', 'crit', 'critMult', 'knockback', 'staggerRes', 'armorPen', 'statusRes',
  'lifesteal', 'hpRegen', 'resRegen', 'cdr', 'luck', 'shockChance', 'burnChance', 'chillChance', 'intScale', 'spiScale', 'fireBonus', 'hpMult', 'stillRegen', 'dmgBonus']);
