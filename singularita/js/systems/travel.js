// Travel rules: level gates, the sigils that open the Sealed Core Gate, and the Wayshrine's isle list.
import { ZONES, ISLES } from '../data/zones.js';
import { BOSSES } from '../data/bosses.js';
import { MATERIALS, SIGILS } from '../data/materials.js';
import { count } from './inventory.js';

export const ownedSigils = (p) => SIGILS.filter((s) => count(p.inv, s) > 0);

export function canEnter(p, zoneId) {
  const def = ZONES[zoneId];
  if (p.level < def.levelReq) return { ok: false, reason: `${def.name} requires level ${def.levelReq}.` };
  if (def.requires) {
    const missing = def.requires.filter((id) => count(p.inv, id) < 1);
    if (missing.length) return { ok: false, reason: `The gate needs ${missing.map((id) => MATERIALS[id].name).join(', ')}.`, missing };
    if (zoneId === 'cave_8' && !p.flags?.gateOpen) return { ok: false, reason: 'The Sealed Core Gate is still closed.' };
  }
  return { ok: true };
}

// Set the four sigils into the gate. They stay in your bag as proof of the deed.
export function openGate(p) {
  const missing = SIGILS.filter((s) => count(p.inv, s) < 1);
  if (missing.length) return { ok: false, missing };
  (p.flags ||= {}).gateOpen = true;
  return { ok: true, missing };
}

export function isleList(p) {
  return ISLES.map((id) => {
    const def = ZONES[id];
    const boss = Object.values(BOSSES).find((b) => b.zone === id);
    const sigil = boss.rewards.find((r) => r.once && SIGILS.includes(r.material)).material;
    const gate = canEnter(p, id);
    return { id, name: def.name, subtitle: def.subtitle, levelReq: def.levelReq, ok: gate.ok, reason: gate.reason, boss: boss.name, sigil, hasSigil: count(p.inv, sigil) > 0 };
  });
}
