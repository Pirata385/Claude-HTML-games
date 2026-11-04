// Where a class's dash goes. Pure: the player entity carries it out.
// dash: { dist, time (0 = a teleport), back (no direction held: away from where you face) }

export function planDash(dash, move, facing) {
  let dx, dz;
  if (move) { dx = move.x; dz = move.z; }
  else { const s = dash.back ? -1 : 1; dx = Math.sin(facing) * s; dz = Math.cos(facing) * s; }
  const l = Math.hypot(dx, dz) || 1;
  return { dx: dx / l, dz: dz / l, dist: dash.dist, speed: dash.time > 0 ? dash.dist / dash.time : Infinity };
}
