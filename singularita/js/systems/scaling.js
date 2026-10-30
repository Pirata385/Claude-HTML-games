// Level scaling for creatures. Tuned together with item tiers (see the balance test).
export const enemyHp = (base, L) => base * 0.62 * (1 + 0.1 * (L - 1)) ** 1.8;
export const enemyDmg = (base, L) => base * (1 + 0.1 * (L - 1)) ** 1.6;
export const enemyXp = (base, L) => base * (1 + 0.15 * (L - 1)) ** 1.75;
