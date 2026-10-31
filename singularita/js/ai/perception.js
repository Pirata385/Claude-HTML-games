// What a cave creature notices. Pure: the caller works out line of sight.
// cfg: { range, cone (cos of the half-angle), hearing, forgetDist, forgetAfter }

// True when creature `e` (x, z, yaw, aggro) becomes aware of `t` (x, z).
export function notices(e, t, los, cfg) {
  if (e.aggro) return true;
  const dx = t.x - e.x, dz = t.z - e.z, d = Math.hypot(dx, dz);
  if (d <= cfg.hearing) return true;
  if (d > cfg.range || !los) return false;
  return (dx * Math.sin(e.yaw) + dz * Math.cos(e.yaw)) / (d || 1) >= cfg.cone;
}

// True when a roused creature gives up: you are far away and it has not seen you for a while.
export const forgets = (dist, unseenFor, cfg) => dist > cfg.forgetDist && unseenFor > cfg.forgetAfter;
