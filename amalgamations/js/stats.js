// Amalgamations — stat derivation, level curve and damage formulas (pure; no rendering).
(function (root) {
  'use strict';
  const AM = root.AM || (root.AM = {});

  const LV = (l) => Math.pow(1.1, Math.max(0, l - 1));
  const xpToNext = (l) => Math.round(50 * Math.pow(l, 1.6) + 20 * l);
  // XP for a kill: grows polynomially with level, scaled by the level difference.
  function killXp(mLvl, pLvl, rank) {
    const diff = AM.clamp(1 + 0.12 * (mLvl - pLvl), 0.15, 2);
    const r = rank === 'boss' ? 12 : rank === 'elite' ? 3.5 : 1;
    return Math.max(1, Math.round(10 * Math.pow(mLvl, 1.25) * diff * r));
  }

  // Item numbers (base + rarity + upgrade level + affixes).
  function itemNumbers(item) {
    const out = {};
    if (!item) return out;
    const R = AM.RARITY[item.rarity] || AM.RARITY.common;
    const k = LV(item.ilvl) * R.mult * (1 + 0.08 * (item.plus || 0));
    if (item.slot === 'weapon') {
      out.weaponDmg = 7 * k * AM.WEAPONS[item.base].dmg;
      if (AM.WEAPONS[item.base].power) out.powerDmg = AM.WEAPONS[item.base].power;
    } else {
      const A = AM.ARMOR[item.slot];
      if (A.def) out.def = A.def * k;
      if (A.hp) out.hp = A.hp * k;
      if (A.atk) out.atk = A.atk * k;
    }
    for (const a of item.affixes || []) {
      const def = AM.AFFIXES[a.id];
      if (!def) continue;
      if (a.id === 'elementDmg') { out['elem_' + a.el] = (out['elem_' + a.el] || 0) + a.v / 100; continue; }
      const v = def.flat ? a.v * (1 + 0.08 * (item.plus || 0)) : a.v / 100;
      out[a.id] = (out[a.id] || 0) + v;
    }
    if (item.unique === 'gaiamantle') { out.hpPct = (out.hpPct || 0) + 0.2; out.regen = (out.regen || 0) + 0.015; }
    if (item.unique === 'luckypaw') { out.goldPct = (out.goldPct || 0) + 0.5; out.findPct = (out.findPct || 0) + 0.5; }
    if (item.unique === 'hollowcrown') out.powerSlots = 1;
    return out;
  }

  // Sum of trait effects, respecting strength (70% normally, 100% with Chimera Heart).
  function traitTotals(genome, tree) {
    const out = {};
    const bonus = (tree.traitStr || 0);
    for (const t of genome.traits) {
      const T = AM.TRAITS[t.id];
      const str = (tree.chimera ? 1 : t.str) * (1 + bonus);
      for (const k in T) if (typeof T[k] === 'number') out[k] = (out[k] || 0) + T[k] * str;
    }
    if (genome.synergy) {
      const S = AM.SYNERGIES.find((s) => s.id === genome.synergy);
      for (const k in S) if (typeof S[k] === 'number') out[k] = (out[k] || 0) + S[k] * (1 + bonus);
    }
    return out;
  }

  // Full player stats. p = { genome, level, nodes: Set|array, equipment: {slot: item}, buffs: {} }
  function computeStats(p) {
    const g = p.genome.stats, L = p.level || 1;
    const owned = p.nodes instanceof Set ? p.nodes : new Set(p.nodes || []);
    const M = AM.treeMods(owned);
    const T = traitTotals(p.genome, M);
    const I = {};
    const eq = p.equipment || {};
    const uniques = new Set();
    for (const slot of AM.GEAR_SLOTS) {
      const it = eq[slot];
      if (!it) continue;
      if (it.unique) uniques.add(it.unique);
      const n = itemNumbers(it);
      for (const k in n) I[k] = (I[k] || 0) + n[k];
    }
    const B = p.buffs || {};
    const v = (o, k) => o[k] || 0;
    const S = {};
    S.level = L;
    S.maxHp = Math.round((g.hp * LV(L) + v(I, 'hp') + v(I, 'flatHp')) * Math.max(0.3, 1 + v(M, 'hpPct') + v(T, 'hpPct') + v(I, 'hpPct')));
    S.atk = g.atk * LV(L) + v(I, 'atk');
    S.def = (g.def * LV(L) + v(I, 'def') + v(I, 'flatDef') + v(M, 'def') * LV(L)) * Math.max(0.2, 1 + v(M, 'defPct') + v(T, 'defPct'));
    S.speed = 5.2 * g.spd * (1 + v(M, 'speedPct') + v(T, 'speed') + v(I, 'speedPct') + v(B, 'haste'));
    S.maxEnergy = Math.round(g.energy + v(M, 'maxEnergy') + v(I, 'maxEnergy'));
    S.energyRegen = 7 * (1 + v(M, 'energyRegen') + v(I, 'energyRegen'));
    S.critChance = AM.clamp(0.05 + v(M, 'critChance') + v(T, 'crit') + v(I, 'critChance'), 0, 0.85);
    S.critDmg = 1.5 + v(M, 'critDmg') + v(T, 'critDmg') + v(I, 'critDmg');
    S.atkSpeed = 1 + v(M, 'atkSpeed') + v(I, 'atkSpeed') + v(T, 'atkSpd') + v(B, 'haste');
    S.dmgPct = v(M, 'dmgPct') + v(I, 'dmgPct') + v(B, 'atk');
    S.meleeDmg = v(M, 'meleeDmg');
    S.rangedDmg = v(M, 'rangedDmg');
    S.naturalDmg = v(M, 'naturalDmg');
    S.powerDmg = v(M, 'powerDmg') + v(I, 'powerDmg');
    S.fusedDmg = v(M, 'fusedDmg');
    S.lowHpDmg = v(M, 'lowHpDmg');
    S.elem = {};
    for (const el of AM.AFFIX_ELEMENTS) S.elem[el] = v(M, 'allElem') + v(I, 'elem_' + el);
    S.elem.fire += v(T, 'fireDmg');
    S.elem.light += v(T, 'lightDmg');
    S.cdr = AM.clamp(v(M, 'cdr') + v(I, 'cdr'), 0, 0.5);
    S.lifesteal = v(M, 'lifesteal') + v(T, 'lifesteal') + v(I, 'lifesteal');
    S.dr = AM.clamp(v(T, 'dr') + v(M, 'dr'), 0, 0.6);
    S.thorns = v(T, 'thorns') + v(M, 'thorns') + v(I, 'thorns');
    S.evade = AM.clamp(v(T, 'evade') + v(M, 'evade') + v(I, 'evade'), 0, 0.5);
    S.regen = (v(T, 'regen') + v(M, 'regen') + v(I, 'regen')) * (1 + v(T, 'regenBoost'));
    S.oocRegen = v(T, 'ooc') * (1 + v(T, 'regenBoost'));
    S.goldPct = v(T, 'gold') + v(M, 'goldPct') + v(I, 'goldPct');
    S.findPct = v(T, 'find') + v(M, 'findPct') + v(I, 'findPct');
    S.xpPct = v(M, 'xpPct') + v(I, 'xpPct');
    S.dodgeCd = 1.2 * Math.max(0.4, 1 - v(T, 'dodgeCd') - v(M, 'dodgeCd'));
    S.dodgeDist = 4.6 * (1 + v(T, 'dodgeDist'));
    S.dodgeCharges = 1 + v(M, 'dodgeCharges');
    S.dodgeHit = v(T, 'dodgeHit');
    S.powerSlots = Math.min(4, 2 + (L >= 5 ? 1 : 0) + v(M, 'powerSlots') + v(I, 'powerSlots'));
    S.range = 1 + v(T, 'range') + v(M, 'range');
    // flags and misc
    for (const k of ['knock', 'stealth', 'burnImmune', 'noKnock', 'poisonOnHit', 'burnChance', 'blindChance', 'stunChance', 'execute',
      'night', 'light', 'sporeCloud', 'poisonDmg', 'burnDur', 'stunDur', 'blindVuln']) S[k] = v(T, k) + v(M, k);
    for (const k of ['mining', 'chestSense', 'shopDiscount', 'potionPow', 'shieldPow', 'ccImmune', 'statusDur']) S[k] = v(M, k);
    S.uniques = uniques;
    const w = eq.weapon;
    S.weapon = w ? w.base : null;
    S.weaponDmg = v(I, 'weaponDmg');
    S.attack = p.genome.attack;
    S.attackElement = p.genome.attackElement || null;
    return S;
  }

  // Monster stats by level and rank ('normal', 'elite', 'boss').
  function monsterStats(genome, level, rank) {
    const g = genome.stats, k = LV(level);
    const r = { normal: [0.85, 0.62, 1, 1], elite: [3.2, 0.85, 1.3, 1.08], boss: [14, 1.05, 1.6, 1.0] }[rank || 'normal'];
    return {
      level, rank: rank || 'normal',
      maxHp: Math.round(g.hp * k * r[0]), atk: g.atk * k * r[1], def: g.def * k * r[2],
      speed: 4.1 * g.spd * r[3], critChance: 0.05, critDmg: 1.5,
    };
  }

  // Raw damage of a basic attack before defence.
  function basicDamage(S) {
    const A = AM.ATTACKS[S.attack] || AM.ATTACKS.bite;
    if (S.weapon && AM.WEAPONS[S.weapon].kind !== 'natural') {
      const W = AM.WEAPONS[S.weapon];
      const kindBonus = W.kind === 'ranged' ? S.rangedDmg : S.meleeDmg;
      return (S.atk * 0.8 + S.weaponDmg) * (1 + S.dmgPct + kindBonus);
    }
    const claws = S.weapon === 'claws' ? 1 + AM.WEAPONS.claws.natural : 1;
    const kindBonus = A.kind === 'ranged' ? S.rangedDmg : S.meleeDmg;
    return (S.atk * A.mult * 1.25 * claws + S.weaponDmg * 0.6) * (1 + S.dmgPct + kindBonus + S.naturalDmg);
  }
  function basicCooldown(S) {
    const A = AM.ATTACKS[S.attack] || AM.ATTACKS.bite;
    if (S.weapon) return 0.55 / (AM.WEAPONS[S.weapon].rate * S.atkSpeed);
    return A.cd / S.atkSpeed;
  }
  function powerDamage(S, spec) {
    const base = S.atk * 0.75 + S.weaponDmg * 0.5;
    let pct = 1 + S.powerDmg + S.dmgPct + (S.elem[spec.element] || 0);
    if (spec.fused) pct += S.fusedDmg + (S.elem[spec.elements[1]] || 0) * 0.5;
    return base * spec.dmg * pct;
  }
  // Damage after the defender's defence. attackerLevel sets the defence curve.
  function mitigate(dmg, def, attackerLevel, pierce) {
    const d = def * (1 - AM.clamp(pierce || 0, 0, 1));
    return dmg * (1 - d / (d + 40 * LV(attackerLevel)));
  }

  // Wild creatures leave you alone unless they were provoked (you or an ally hurt them or their pack),
  // they guard a dungeon or cave, or they outlevel you by HOSTILE_GAP or more.
  const HOSTILE_GAP = 5;
  function wildIsHostile(e, playerLevel) {
    return !!(e.provoked || e.guard || e.level >= (playerLevel || 1) + HOSTILE_GAP);
  }

  Object.assign(AM, { HOSTILE_GAP, wildIsHostile, LV, xpToNext, killXp, itemNumbers, traitTotals, computeStats, monsterStats, basicDamage, basicCooldown, powerDamage, mitigate });
  if (typeof module !== 'undefined' && module.exports) module.exports = AM;
})(typeof window !== 'undefined' ? window : globalThis);
