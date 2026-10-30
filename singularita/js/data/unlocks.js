// The level roadmap: derived from recipes, zones, skills and bosses, so it never lies.
import { RECIPES } from './recipes.js';
import { ITEMS } from './items.js';
import { MATERIALS } from './materials.js';
import { CONSUMABLES } from './consumables.js';
import { ZONES, ZONE_ORDER } from './zones.js';
import { skillsOf } from './skills.js';
import { BOSSES } from './bosses.js';

export function buildUnlocks(classId) {
  const byLevel = new Map();
  const push = (level, entry) => {
    if (!byLevel.has(level)) byLevel.set(level, []);
    const list = byLevel.get(level);
    if (!list.some((e) => e.label === entry.label)) list.push(entry);
  };
  for (const r of Object.values(RECIPES)) {
    if (r.output.item) {
      const it = ITEMS[r.output.item];
      if (it.class !== classId && it.class !== 'any') continue;
      const what = it.kind === 'tool' ? 'tools' : it.slot === 'accessory' ? 'accessories' : it.slot === 'armor' ? 'armour' : 'weapons';
      push(r.level, { type: 'recipe', label: it.material ? `${MATERIALS[it.material].name} ${what}` : it.name });
    } else {
      push(r.level, { type: 'recipe', label: CONSUMABLES[r.output.stack].name });
    }
  }
  for (const id of ZONE_ORDER) { const z = ZONES[id]; if (z.levelReq > 1) push(z.levelReq, { type: 'zone', label: z.name }); }
  for (const s of skillsOf(classId)) if (s.kind === 'skill') push(s.unlock, { type: 'skill', label: s.name });
  for (const b of Object.values(BOSSES)) push(b.minLevel, { type: 'boss', label: `${b.name} may appear` });
  return [...byLevel.entries()].sort((a, b) => a[0] - b[0]).map(([level, entries]) => ({ level, entries }));
}

export function unlocksAt(classId, level) {
  return buildUnlocks(classId).find((u) => u.level === level)?.entries || [];
}
export function nextUnlock(classId, level) {
  return buildUnlocks(classId).find((u) => u.level > level) || null;
}
