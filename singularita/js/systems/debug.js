// Debug mode: a character named exactly "DeBug" gets the developer menu (ui/menus/debug.js).
// The pure parts live here: who is in debug mode, levels, items, where bosses live, teleport spots.
import { MAX_LEVEL, POINTS_PER_LEVEL } from './progression.js';
import { addStack, addItem } from './inventory.js';
import { ATTRS } from './stats.js';
import { MATERIALS } from '../data/materials.js';
import { CONSUMABLES } from '../data/consumables.js';
import { ITEMS } from '../data/items.js';
import { BOSSES } from '../data/bosses.js';
import { ZONES } from '../data/zones.js';
import { F } from '../world/grid.js';

export const DEBUG_NAME = 'DeBug';
export const isDebug = (p) => p?.name === DEBUG_NAME;

// Sets the level (1 to the cap) with an empty bar, and the attribute points that level grants.
export function setLevel(p, L) {
  const lv = Math.max(1, Math.min(MAX_LEVEL, Math.round(Number(L)) || 1));
  const spent = ATTRS.reduce((a, k) => a + (p.attrs[k] || 0), 0);
  p.level = lv;
  p.xp = 0;
  p.attrPoints = Math.max(0, (lv - 1) * POINTS_PER_LEVEL - spent);
  return lv;
}

// Materials and consumables stack; gear and tools come as separate pieces.
export function giveItem(p, id, n = 1) {
  n = Math.floor(n);
  if (!(n > 0)) return false;
  if (MATERIALS[id] || CONSUMABLES[id]) { addStack(p.inv, id, n); return true; }
  if (ITEMS[id]) { for (let k = 0; k < n; k++) addItem(p.inv, id); return true; }
  return false;
}

const CATALOG = [
  ...Object.values(MATERIALS).map((m) => ({ id: m.id, name: m.name, kind: 'material', tier: m.tier ?? null })),
  ...Object.values(CONSUMABLES).map((c) => ({ id: c.id, name: c.name, kind: 'consumable', tier: null })),
  ...Object.values(ITEMS).map((i) => ({ id: i.id, name: i.name, kind: i.kind, tier: i.tier ?? null, cls: i.class })),
];

export function searchItems(q = '', limit = 40) {
  const s = q.trim().toLowerCase();
  const out = [];
  for (const r of CATALOG) {
    if (s && !r.name.toLowerCase().includes(s) && !r.id.includes(s)) continue;
    out.push(r);
    if (out.length >= limit) break;
  }
  return out;
}

// Where each boss can be fought: Dawnreach's arenas, an isle, or a dimension run (the Jailer on floor 5).
export function bossHome(id) {
  const b = BOSSES[id];
  if (!b) return null;
  const zone = b.zone || 'island';
  const type = ZONES[zone]?.type;
  if (type === 'dimension') return id === 'iron_jailer' ? { zone, kind: 'dimension', floor: 5 } : { zone, kind: 'dimension' };
  return { zone, kind: type === 'isle' ? 'isle' : 'island' };
}

// The nearest open cell to (x, z), avoiding hazards when it can.
export function openCellNear(grid, x, z, maxR = 10) {
  const i0 = Math.floor(x), j0 = Math.floor(z);
  for (const avoid of [true, false]) {
    for (let r = 0; r <= maxR; r++) for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) {
      if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue;
      const i = i0 + di, j = j0 + dj;
      if (!grid.walkable(i, j)) continue;
      if (avoid && grid.has(i, j, F.HAZARD)) continue;
      return { x: i + 0.5, z: j + 0.5 };
    }
  }
  return null;
}

// Named places in a zone to jump to.
export function teleportSpots(z) {
  const raw = [];
  const add = (label, p) => { if (p && p.x != null) raw.push({ label, x: p.x, z: p.z }); };
  add('Arrival', z.spawn);
  if (z.type === 'island') {
    add('Camp', z.base);
    if (z.base?.wayshrine) add('Wayshrine', z.base.wayshrine);
    add('Cave mouth', z.caveMouth);
    for (const a of Object.values(z.arenas || {})) add(a.name || 'Arena', a);
  } else if (z.type === 'cave') {
    add('Stairs up', z.entry);
    add(z.exit.type === 'shaft' ? 'Way down' : 'The gate / seal', z.exit);
  } else {
    add('Landing', z.landing || z.entry);
    if (z.exit) add('Exit', z.exit);
    if (z.arena) add('Arena', z.arena);
  }
  const out = [];
  for (const s of raw) {
    const c = openCellNear(z.grid, s.x, s.z);
    if (c) out.push({ label: s.label, ...c });
  }
  return out;
}
