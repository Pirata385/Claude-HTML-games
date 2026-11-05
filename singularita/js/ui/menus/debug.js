// Dev: the developer menu of a character named "DeBug" (systems/debug.js). Level, items, bosses,
// teleports, flight, invincibility and a few world switches. Every control carries data-dbg for tests.
import { h } from '../dom.js';
import { isDebug, setLevel, giveItem, searchItems, bossHome, teleportSpots, openCellNear } from '../../systems/debug.js';
import { startRun, endRun } from '../../systems/run.js';
import { MAX_LEVEL } from '../../systems/progression.js';
import { BOSSES } from '../../data/bosses.js';
import { ZONES, ZONE_ORDER } from '../../data/zones.js';
import { SIGILS, SHARDS } from '../../data/materials.js';

const btn = (key, label, onclick, cls = '') => h('button', { class: `btn small ${cls}`, 'data-dbg': key, onclick }, label);

// Full health and resource, stats recomputed for the new level or gear.
function refresh(g) {
  g.recomputeStats();
  g.player.hp = g.stats.maxHp;
  g.player.res = g.stats.resourceMax;
}

function teleport(g, x, z) {
  const c = openCellNear(g.grid, x, z) || { x, z };
  const p = g.player;
  p.x = c.x; p.z = c.z;
  p.y = p.ry = g.grid.height(Math.floor(c.x), Math.floor(c.z));
  p.vx = p.vz = p.vy = 0;
  p.grounded = !g.debug.fly;
}

// Leaves any run without its rewards, then goes. Dimensions start a run of their own.
function goTo(g, zoneId, floor = 1) {
  if (g.profile.run) endRun(g.profile, 'leave');
  g.interaction?.closePortal?.();
  if (ZONES[zoneId].type === 'dimension') {
    const from = g.zone.type === 'dimension' ? { zone: 'island' } : { zone: g.zone.id, x: g.player.x, z: g.player.z };
    startRun(g.profile, zoneId, from);
    g.profile.run.floor = floor;
  }
  g.enterZone(zoneId);
}

function clearBoss(g) {
  const b = g.spawner.boss;
  if (!b) return;
  for (const m of b.members || []) { m.alive = false; m.dyingT = 0; }
  g.spawner.boss = null;
}

// Takes you to a boss's home and puts it in front of you.
export function fightBoss(g, id) {
  const home = bossHome(id), def = BOSSES[id];
  if (!home) return;
  clearBoss(g);
  if (home.kind === 'isle') (g.profile.world.guardians ||= {})[id] = 0;
  goTo(g, home.zone, home.floor || 1);
  if (home.kind === 'island') { clearBoss(g); g.spawner.spawnBoss(id, false); }
  const ar = g.zone.arenas ? g.zone.arenas[def.arena] : g.zone.arena;
  if (ar) teleport(g, ar.x, ar.z + ar.r - 3);
}

export function debugTab(g, root, opts, rerender) {
  if (!isDebug(g.profile)) return;
  const p = g.profile, pl = g.player;
  const state = (g.ui.debugState ||= { q: '' });
  const toast = (t) => g.ui.toast(t, 'good');
  const toggle = (key, label, on, set) => btn(key, `${on ? '■' : '□'} ${label}`, () => { set(!on); rerender(); }, on ? 'primary' : '');

  // Player.
  const level = h('input', { class: 'dbg-input', type: 'number', min: 1, max: MAX_LEVEL, value: p.level, 'data-dbg': 'level' });
  const applyLevel = (L) => { const lv = setLevel(p, L); refresh(g); g.bus.emit('levelUp', { level: lv, from: lv, unlocks: [] }); toast(`Level ${lv}.`); rerender(); };
  const player = h('section', { class: 'dbg-sec' }, h('h4', {}, 'Player'),
    h('div', { class: 'row' }, h('label', { class: 'dbg-lbl' }, 'Level'), level,
      btn('level-set', 'Set', () => applyLevel(level.value)), btn('level-up1', '+1', () => applyLevel(p.level + 1)),
      btn('level-up10', '+10', () => applyLevel(p.level + 10)), btn('level-max', 'Max', () => applyLevel(MAX_LEVEL))),
    h('div', { class: 'row' },
      toggle('god', 'Invincible', !!g.godMode, (v) => { g.godMode = v; }),
      toggle('fly', 'Fly (jump climbs, dash descends)', !!g.debug.fly, (v) => { g.debug.fly = v; if (!v) { pl.grounded = false; pl.vy = 0; } })),
    h('div', { class: 'row' }, h('label', { class: 'dbg-lbl' }, 'Speed'),
      ...[1, 2, 4].map((k) => btn(`speed-${k}`, `×${k}`, () => { g.debug.speed = k; rerender(); }, g.debug.speed === k ? 'primary' : ''))),
    h('div', { class: 'row' },
      btn('heal', 'Full heal', () => { refresh(g); pl.statuses?.clear?.(); toast('Healed.'); }),
      btn('cooldowns', 'Reset cooldowns', () => { for (const k of Object.keys(pl.kit?.cd || {})) pl.kit.cd[k] = 0; pl.dodgeCd = 0; toast('Cooldowns reset.'); }),
      btn('kill', 'Defeat nearby creatures', () => { let n = 0; for (const e of g.enemies.list) if (e.alive && !e.boss && Math.hypot(e.x - pl.x, e.z - pl.z) < 40) { e.alive = false; e.dyingT = 0; n++; } toast(`${n} creatures removed.`); }),
      btn('day', g.dayNight.phase === 'day' ? 'Make it night' : 'Make it day', () => { g.dayNight.clock = g.dayNight.phase === 'day' ? g.dayNight.dayLen : 0; rerender(); })));

  // Items.
  const results = h('div', { class: 'dbg-results' });
  const search = h('input', { class: 'dbg-input wide', type: 'search', placeholder: 'Search items: diamond, emblem, staff…', value: state.q, 'data-dbg': 'item-search' });
  const give = (id, n) => { if (giveItem(p, id, n)) toast(`+${n} ${id}`); };
  const list = () => {
    results.replaceChildren(...searchItems(state.q, 30).map((r) => {
      const amounts = r.kind === 'gear' || r.kind === 'tool' ? [1] : [1, 10, 100];
      return h('div', { class: 'dbg-item' },
        h('span', { class: 'dbg-name' }, r.name, h('small', {}, ` ${r.kind}${r.tier != null ? ` · T${r.tier}` : ''}${r.cls && r.cls !== 'any' ? ` · ${r.cls}` : ''}`)),
        ...amounts.map((n) => btn(`give-${r.id}-${n}`, `+${n}`, () => give(r.id, n))));
    }));
  };
  search.addEventListener('input', () => { state.q = search.value; list(); });
  list();
  const items = h('section', { class: 'dbg-sec' }, h('h4', {}, 'Items'),
    h('div', { class: 'row' },
      btn('kit-sigils', 'All sigils', () => { for (const s of SIGILS) give(s, 1); }),
      btn('kit-shards', 'All Fracture Shards', () => { for (const s of SHARDS) give(s, 1); }),
      btn('kit-emblems', 'Emblems ×3', () => { for (const d of Object.values(ZONES)) if (d.emblem) give(d.emblem, 3); }),
      btn('kit-tonics', 'Tonics ×20', () => give('healing_tonic', 20)),
      btn('kit-gate', 'Open the Core Gate', () => { (p.flags ||= {}).gateOpen = true; toast('The gate is open.'); })),
    search, results);

  // Bosses.
  const bosses = h('section', { class: 'dbg-sec' }, h('h4', {}, 'Bosses'),
    h('div', { class: 'dbg-grid' }, Object.values(BOSSES).map((b) => btn(`boss-${b.id}`, `${b.name} · ${ZONES[bossHome(b.id).zone].name}`, () => { g.ui.closeMenu(); fightBoss(g, b.id); }))),
    h('div', { class: 'row' }, btn('boss-clear', 'Remove the current boss', () => { clearBoss(g); toast('Boss removed.'); })));

  // Teleport.
  const spots = teleportSpots(g.zone);
  const zones = ZONE_ORDER.filter((id) => ZONES[id]);
  const tp = h('section', { class: 'dbg-sec' }, h('h4', {}, `Teleport · ${ZONES[g.zone.id]?.name || g.zone.id}`),
    h('div', { class: 'row' }, spots.map((s) => btn(`spot-${s.label}`, s.label, () => { g.ui.closeMenu(); teleport(g, s.x, s.z); }))),
    h('h4', {}, 'Go to zone'),
    h('div', { class: 'dbg-grid' }, zones.map((id) => btn(`zone-${id}`, `${ZONES[id].name}${ZONES[id].type === 'dimension' ? ' (run)' : ''}`, () => { g.ui.closeMenu(); goTo(g, id); }, g.zone.id === id ? 'primary' : ''))));

  root.append(h('div', { class: 'dbg' },
    h('p', { class: 'muted small' }, 'Developer options for the DeBug character. Changes are saved like any other progress.'),
    player, items, bosses, tp));
}
