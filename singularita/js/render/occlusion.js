// Which trees to hide so their canopies never block the view of the player: trees standing
// between the camera and the player (from about a metre behind the player, where the line of
// sight runs at canopy height) and trees wrapping the camera itself. Trees in front of the
// player or beside them, like the one you walk up to and chop, always stay visible.
export function occludes(cx, cz, px, pz, nx, nz) {
  const dx = px - cx, dz = pz - cz, len = Math.hypot(dx, dz) || 1;
  const ux = dx / len, uz = dz / len;
  const along = (nx - cx) * ux + (nz - cz) * uz;
  if (along < -1.6 || along > len - 0.9) return false;
  return Math.abs((nx - cx) * uz - (nz - cz) * ux) <= 1.8;
}
