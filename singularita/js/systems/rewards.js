// Boss rewards: what a victory gives. Sigils are 'once' rewards: never twice for the same bag.
import { count } from './inventory.js';

// Returns [{ material, n } | { item }].
export function rollRewards(def, profile, rng, first) {
  const out = [];
  for (const r of def.rewards) {
    if (r.material) {
      if (r.once && count(profile.inv, r.material) > 0) continue;
      if ((r.chance ?? 1) < 1 && rng.next() >= r.chance) continue;
      out.push({ material: r.material, n: rng.int(r.min, r.max) });
    } else if (r.item && ((r.firstKill && first) || rng.next() < r.chance)) out.push({ item: r.item });
  }
  return out;
}
