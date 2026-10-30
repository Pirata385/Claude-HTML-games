// Attributes → derived stats. Soft caps keep every attribute useful without any becoming mandatory.
import { CLASSES } from '../data/classes.js';

export const ATTRS = ['str', 'res', 'agi', 'dex', 'spi', 'int', 'rsv'];
export const ATTR_INFO = {
  str: { name: 'Strength', short: 'STR', desc: 'Melee damage, knockback and gathering speed.' },
  res: { name: 'Resistance', short: 'RES', desc: 'Maximum health, defence and stagger resistance.' },
  agi: { name: 'Agility', short: 'AGI', desc: 'Move speed, attack speed and dodge cooldown.' },
  dex: { name: 'Dexterity', short: 'DEX', desc: 'Critical chance and damage, ranged damage, projectile speed and accuracy.' },
  spi: { name: 'Spirituality', short: 'SPI', desc: 'Astral power and leash, status potency and resistance, healing received.' },
  int: { name: 'Intelligence', short: 'INT', desc: 'Magic damage, cooldown reduction and Mana.' },
  rsv: { name: 'Reserves', short: 'RSV', desc: 'Class resource pool and regeneration, health regeneration and tonic potency.' },
};

// a·k / (1 + a/S): linear at first, flattening past S.
export const soft = (a, k, S) => (a * k) / (1 + a / S);

// Total attributes: allocated points + free class growth (+1 to each growth attribute every 2 levels) + gear.
export function totalAttrs(profile, gear) {
  const cls = CLASSES[profile.classId];
  const out = {};
  for (const a of ATTRS) out[a] = profile.attrs[a] || 0;
  const grow = Math.floor((profile.level - 1) / 2);
  for (const a of cls.growth) out[a] += grow;
  for (const g of gear) for (const a of ATTRS) if (g.stats[a]) out[a] += g.stats[a];
  return out;
}

export function sumGear(gear) {
  const s = {};
  for (const g of gear) for (const [k, v] of Object.entries(g.stats)) s[k] = (s[k] || 0) + v;
  return s;
}

export function computeStats(profile, gear) {
  const cls = CLASSES[profile.classId];
  const L = profile.level;
  const a = totalAttrs(profile, gear);
  const g = sumGear(gear);
  const v = (k) => g[k] || 0;

  let dmgMult = 1 + v('dmgBonus');
  for (const [attr, w] of Object.entries(cls.scaling)) {
    let weight = w;
    if (attr === 'int') weight += v('intScale');
    if (attr === 'spi') weight += v('spiScale');
    dmgMult += soft(a[attr], 0.016 * weight, 320);
  }
  // Strength always helps physical hits a little, so it is never dead weight for casters.
  if (!cls.scaling.str) dmgMult += soft(a.str, 0.002, 200);

  const baseHp = (cls.hp + cls.hpPerLevel * (L - 1)) * (1 + soft(a.res, 0.012, 260));
  const maxHp = Math.round((baseHp + v('hp')) * (1 + v('hpMult')));
  const resourceMax = Math.round(cls.resource.max * (1 + soft(a.rsv, 0.01, 260)) + v('resMax') + (cls.resource.id === 'mana' ? soft(a.int, 0.4, 300) : 0));

  return {
    level: L,
    maxHp,
    def: cls.baseDef + v('def') + soft(a.res, 0.45, 300),
    power: v('power') || 4,
    dmgMult,
    moveSpeed: cls.moveSpeed * (1 + Math.min(0.35, soft(a.agi, 0.004, 200)) + v('moveSpd')),
    attackSpeed: 1 + soft(a.agi, 0.006, 250) + v('atkSpd'),
    dodgeCd: (1.1 / (1 + soft(a.agi, 0.004, 200))) * (1 - Math.min(0.5, v('dodgeCd'))),
    critChance: Math.min(0.75, 0.05 + soft(a.dex, 0.0035, 250) + v('crit')),
    critMult: 1.5 + soft(a.dex, 0.006, 300) + v('critMult'),
    projSpeed: 1 + soft(a.dex, 0.004, 200),
    accuracy: Math.min(0.85, soft(a.dex, 0.006, 150)),
    spiPower: 1 + soft(a.spi, 0.015, 300),
    leash: 6 + Math.min(6, soft(a.spi, 0.04, 150)),
    statusPotency: 1 + soft(a.spi, 0.006, 250),
    statusRes: Math.min(0.7, soft(a.spi, 0.004, 250) + v('statusRes')),
    healMult: 1 + soft(a.spi, 0.004, 250) + v('healBonus'),
    cdr: Math.min(0.4, soft(a.int, 0.003, 250) + v('cdr')),
    resourceMax,
    resourceRegen: cls.resource.regen * (1 + soft(a.rsv, 0.012, 250)) * (1 + v('resRegen')),
    hpRegen: v('hpRegen'),
    oocRegen: 0.012 + soft(a.rsv, 0.0002, 250),
    stillRegen: v('stillRegen'),
    tonicPotency: 1 + soft(a.rsv, 0.005, 250),
    gatherPower: 1 + soft(a.str, 0.01, 200),
    knockback: 1 + v('knockback') + soft(a.str, 0.003, 200),
    staggerRes: Math.min(0.8, v('staggerRes') + soft(a.res, 0.002, 200)),
    armorPen: Math.min(0.6, v('armorPen')),
    lifesteal: v('lifesteal'),
    luck: v('luck'),
    shockChance: v('shockChance'),
    burnChance: v('burnChance'),
    chillChance: v('chillChance'),
    fireBonus: v('fireBonus'),
    prismatic: v('prismatic') > 0 ? 1 : 0,
    blindChance: v('blindChance'),
    killHeal: v('killHeal'),
    critLifesteal: v('critLifesteal'),
    chromatic: v('chromatic'),
    afflictedBonus: v('afflictedBonus'),
    collapse: v('collapse'),
    attrs: a,
  };
}
