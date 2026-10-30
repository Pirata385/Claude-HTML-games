// Experience and levels. The cap is 300; level gates recipes and areas, never equipment.
import { enemyXp } from './scaling.js';

export const MAX_LEVEL = 300;
export const POINTS_PER_LEVEL = 3;
export const DEATH_XP_LOSS = 0.15;

export const xpToNext = (L) => (L >= MAX_LEVEL ? Infinity : Math.round(45 * L ** 1.55 + 80));

export function addXp(profile, amount) {
  let levelsGained = 0;
  if (profile.level >= MAX_LEVEL) return { levelsGained, level: profile.level };
  profile.xp += Math.max(0, Math.round(amount));
  while (profile.level < MAX_LEVEL && profile.xp >= xpToNext(profile.level)) {
    profile.xp -= xpToNext(profile.level);
    profile.level++;
    profile.attrPoints += POINTS_PER_LEVEL;
    levelsGained++;
  }
  if (profile.level >= MAX_LEVEL) profile.xp = 0;
  return { levelsGained, level: profile.level };
}

export function applyDeathPenalty(profile) {
  const loss = Math.round(xpToNext(profile.level) * DEATH_XP_LOSS);
  const lost = Math.min(profile.xp, loss);
  profile.xp -= lost;
  return lost;
}

// Kills of much weaker creatures give less; tougher ones give a bonus.
export function killXp(baseXp, enemyLevel, playerLevel) {
  const gap = enemyLevel - playerLevel;
  const mod = gap >= 0 ? Math.min(1.5, 1 + gap * 0.05) : Math.max(0.2, 1 + gap * 0.06);
  return Math.max(1, Math.round(enemyXp(baseXp, enemyLevel) * mod));
}

export const gatherXp = (nodeXp, playerLevel) => Math.max(1, Math.round(nodeXp * (1 + playerLevel * 0.04)));
export const craftXp = (recipeLevel) => Math.round(20 * recipeLevel ** 1.3);
