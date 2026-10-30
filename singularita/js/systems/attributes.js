import { ATTRS } from './stats.js';

export function allocate(profile, attr, n = 1) {
  if (!ATTRS.includes(attr) || n < 1 || profile.attrPoints < n) return false;
  profile.attrs[attr] += n;
  profile.attrPoints -= n;
  return true;
}

export function respec(profile) {
  let total = 0;
  for (const a of ATTRS) { total += profile.attrs[a]; profile.attrs[a] = 0; }
  profile.attrPoints += total;
  return total;
}
