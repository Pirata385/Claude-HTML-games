// Save data: versioned, checksummed, with migrations and a backup per slot.
import { ATTRS } from './stats.js';
import { newInventory } from './inventory.js';
import { hashStr } from '../core/rng.js';
import { ITEMS } from '../data/items.js';
import { defaultHotbar } from '../data/skills.js';

export const SAVE_VERSION = 1;
export const SLOT_COUNT = 3;

export function newProfile({ name, classId, slot, seed }) {
  const inv = newInventory();
  const p = {
    version: SAVE_VERSION, slot, name, classId, seed,
    level: 1, xp: 0, attrPoints: 0, attrs: Object.fromEntries(ATTRS.map((a) => [a, 0])),
    inv, equipment: {}, hotbars: { [classId]: defaultHotbar(classId) },
    zone: 'island', pos: null,
    zones: {},
    world: { clock: 150, bossTimer: 360, bossesSeen: {} },
    objectives: { index: 0, progress: 0 },
    lore: [],
    stats: { kills: 0, killsBy: {}, crafted: {}, gathered: {}, bosses: {}, deaths: 0, maxLayer: 0, waves: 0 },
    hints: [],
    playTime: 0,
    savedAt: 0,
  };
  // A worn starter weapon from Lume, and a few tonics.
  const starter = `${classId}_weapon_wood`;
  if (ITEMS[starter]) p.equipment[classId] = { weapon: inv.items.length + 1, armor: null, acc1: null, acc2: null };
  if (ITEMS[starter]) { inv.items.push({ uid: inv.nextUid++, id: starter }); }
  inv.stacks.healing_tonic = 3;
  return p;
}

const checksum = (data) => hashStr(JSON.stringify(data));

export function serialize(profile) {
  return JSON.stringify({ v: SAVE_VERSION, data: profile, sum: checksum(profile) });
}

// Fill anything missing (fields added after the save was written) from a fresh profile.
function fillDefaults(target, defaults) {
  for (const [k, v] of Object.entries(defaults)) {
    if (!(k in target)) target[k] = structuredClone(v);
    else if (v && typeof v === 'object' && !Array.isArray(v) && target[k] && typeof target[k] === 'object') fillDefaults(target[k], v);
  }
  return target;
}

export function migrate(data) {
  const defaults = newProfile({ name: data.name || 'Wanderer', classId: data.classId || 'swordsman', slot: data.slot ?? 0, seed: data.seed ?? 1 });
  delete defaults.inv.stacks.healing_tonic;
  // The boss pity roll became a boss clock.
  if (data.world) delete data.world.bossPity;
  fillDefaults(data, { ...defaults, inv: data.inv || defaults.inv, equipment: data.equipment || {}, hotbars: data.hotbars || defaults.hotbars });
  data.version = SAVE_VERSION;
  return data;
}

export function deserialize(str, { skipChecksum = false } = {}) {
  let parsed;
  try { parsed = JSON.parse(str); } catch { return { ok: false, error: 'Unreadable save.' }; }
  if (!parsed || typeof parsed !== 'object' || !parsed.data || typeof parsed.data !== 'object') return { ok: false, error: 'Not a save.' };
  if (!skipChecksum && parsed.sum !== checksum(parsed.data)) return { ok: false, error: 'Save is corrupted.' };
  const data = parsed.data;
  if (!data.classId || !data.inv) return { ok: false, error: 'Save is incomplete.' };
  return { ok: true, profile: (data.version ?? 0) < SAVE_VERSION ? migrate(data) : data };
}

export class SaveStore {
  constructor(storage, prefix = 'singularita.slot') { this.storage = storage; this.prefix = prefix; }
  key(slot) { return `${this.prefix}${slot}`; }
  save(slot, profile) {
    profile.savedAt = Date.now();
    const k = this.key(slot);
    try {
      const prev = this.storage.getItem(k);
      if (prev && deserialize(prev).ok) this.storage.setItem(k + '.bak', prev);
      this.storage.setItem(k, serialize(profile));
      return true;
    } catch (err) {
      console.error('[save] failed', err);
      return false;
    }
  }
  load(slot) {
    const k = this.key(slot);
    let main = null, bak = null;
    try { main = this.storage.getItem(k); bak = this.storage.getItem(k + '.bak'); } catch { return { ok: false, error: 'Storage unavailable.' }; }
    if (main) { const r = deserialize(main); if (r.ok) return r; }
    if (bak) { const r = deserialize(bak); if (r.ok) return { ...r, recovered: true }; }
    return { ok: false, error: main ? 'Save is corrupted.' : 'Empty slot.' };
  }
  list() {
    const out = [];
    for (let s = 0; s < SLOT_COUNT; s++) {
      const r = this.load(s);
      out.push(r.ok ? { slot: s, name: r.profile.name, classId: r.profile.classId, level: r.profile.level, playTime: r.profile.playTime, savedAt: r.profile.savedAt, zone: r.profile.zone } : null);
    }
    return out;
  }
  remove(slot) {
    try { this.storage.removeItem(this.key(slot)); this.storage.removeItem(this.key(slot) + '.bak'); } catch { /* ignore */ }
  }
}

const toB64 = (s) => { const bytes = new TextEncoder().encode(s); let bin = ''; for (const b of bytes) bin += String.fromCharCode(b); return btoa(bin); };
const fromB64 = (s) => { const bin = atob(s.trim()); const bytes = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i); return new TextDecoder().decode(bytes); };

export const exportString = (profile) => 'SGv1:' + toB64(serialize(profile));
export function importString(str) {
  try {
    const body = str.trim().replace(/^SGv1:/, '');
    return deserialize(fromB64(body));
  } catch { return { ok: false, error: 'That is not a Singularita save code.' }; }
}
