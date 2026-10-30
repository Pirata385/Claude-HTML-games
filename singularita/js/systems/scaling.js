// Level scaling for creatures. Tuned together with item tiers (see the balance test).
// Past level 100 the tiers grow further apart, so creature health grows more slowly there.
const hpLevel = (L) => (L <= 100 ? L : 100 + (L - 100) * 0.6);
export const enemyHp = (base, L) => base * 0.62 * (1 + 0.1 * (hpLevel(L) - 1)) ** 1.8;
export const enemyDmg = (base, L) => base * (1 + 0.1 * (L - 1)) ** 1.6;
export const enemyXp = (base, L) => base * (1 + 0.15 * (L - 1)) ** 1.75;
