// Pure damage maths, shared by every hit in the game.
export const defenseFactor = (def, pen) => 100 / (100 + Math.max(0, def) * (1 - pen));

// o: { power, dmgMult, mult, critChance, critMult, forceCrit, def, pen, defMult, vuln, rng }
export function computeHit(o) {
  const crit = o.forceCrit || o.rng.next() < o.critChance;
  let dmg = o.power * o.dmgMult * o.mult;
  if (crit) dmg *= o.critMult;
  dmg *= o.vuln ?? 1;
  dmg *= defenseFactor((o.def ?? 0) * (o.defMult ?? 1), o.pen ?? 0);
  dmg *= 0.95 + o.rng.next() * 0.1;
  return { dmg: Math.max(1, Math.round(dmg)), crit };
}

// True when `attacker` stands behind `target` (outside its 120° front cone).
export function isBehind(target, attacker) {
  const fx = Math.sin(target.yaw), fz = Math.cos(target.yaw);
  const dx = attacker.x - target.x, dz = attacker.z - target.z;
  const l = Math.hypot(dx, dz) || 1;
  return (fx * dx + fz * dz) / l < -0.5;
}
// True when the attacker is in front (inside a 120° cone): used by frontal armour and guards.
export function isInFront(target, attacker) {
  const fx = Math.sin(target.yaw), fz = Math.cos(target.yaw);
  const dx = attacker.x - target.x, dz = attacker.z - target.z;
  const l = Math.hypot(dx, dz) || 1;
  return (fx * dx + fz * dz) / l > 0.5;
}
