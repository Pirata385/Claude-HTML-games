// The Stardust's Spirit. It always refills (the Astral costs nothing to keep out), any Spirit left
// pays for a skill, and spending the last of it leaves the Stardust exhausted: only the basic
// attack until the Spirit is full again. `st` is { res, exhausted }.

export const EXHAUSTED = 'Your Spirit is spent: only basic attacks until it refills.';

// Why a skill cannot be cast now, or null.
export function spiritCanCast(st) {
  if (st.exhausted) return EXHAUSTED;
  if (st.res <= 0) return EXHAUSTED;
  return null;
}

// Pays a skill's cost; returns true when it leaves the Stardust exhausted.
export function spiritPay(st, cost) {
  st.res = Math.max(0, st.res - cost);
  if (st.res <= 0 && !st.exhausted) { st.exhausted = true; return true; }
  return false;
}

// Refills; returns true when it ends an exhaustion.
export function spiritRegen(st, dt, max, regen) {
  st.res = Math.min(max, st.res + regen * dt);
  if (st.exhausted && st.res >= max) { st.exhausted = false; return true; }
  return false;
}
