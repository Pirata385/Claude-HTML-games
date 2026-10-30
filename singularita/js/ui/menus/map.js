// Map: the current zone with fog of war, the layers of the Hollow Deep, the isles and the Core.
import { h } from '../dom.js';
import { ZONES, ZONE_ORDER, HAZARDS } from '../../data/zones.js';
import { BOSSES } from '../../data/bosses.js';
import { MATERIALS } from '../../data/materials.js';
import { count } from '../../systems/inventory.js';
import { canEnter } from '../../systems/travel.js';

export function mapTab(g, root) {
  const cv = h('canvas', { class: 'fullmap', width: 720, height: 720 });
  const p = g.profile;
  const layers = ZONE_ORDER.map((id) => ZONES[id]).map((z) => {
    const visited = !!p.zones[z.id];
    const gate = canEnter(p, z.id);
    const locked = !gate.ok;
    const why = locked ? (p.level < z.levelReq ? ' (locked)' : ' (sealed)') : '';
    const guardian = z.type === 'isle' ? Object.values(BOSSES).find((b) => b.zone === z.id) : null;
    const sigil = guardian?.rewards.find((r) => r.once)?.material;
    const effects = [...(z.hazards || []), ...(z.phenomena || [])];
    return h('li', { class: `${visited ? 'visited' : ''}${locked ? ' locked' : ''}${g.zone.id === z.id ? ' here' : ''}` },
      h('b', {}, z.name), h('small', {}, `${z.subtitle} · from Lv ${z.levelReq}${why}${g.zone.id === z.id ? ' · you are here' : visited ? ' · visited' : ''}`),
      guardian ? h('small', {}, `${count(p.inv, sigil) ? '✦' : '·'} ${guardian.name} keeps the ${MATERIALS[sigil].name}${z.type === 'isle' ? '. Sail from the Wayshrine in camp.' : ''}`) : null,
      z.requires && locked ? h('small', {}, 'Below the Diamond Throat. The four sigils of the isles open the way.') : null,
      effects.length ? h('small', { class: 'hz' }, `Hazards: ${effects.map((x) => HAZARDS[x].name).join(', ')}`) : null);
  });
  root.append(h('div', { class: 'map-layout' }, h('div', { class: 'map-wrap' }, cv, h('p', { class: 'muted small' }, '✦ camp / return stone · ▼ way down · ▲ way up · ◆ Echo Stone · ◎ arena · ☠ boss · ↑ updraft')), h('div', {}, h('h4', {}, 'Regions'), h('ul', { class: 'layers' }, layers))));
  requestAnimationFrame(() => g.ui.minimap.drawFull(cv));
}
