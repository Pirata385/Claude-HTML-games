// Map: the current zone with fog of war, and the layers of the Hollow Deep.
import { h } from '../dom.js';
import { ZONES, ZONE_ORDER, HAZARDS } from '../../data/zones.js';

export function mapTab(g, root) {
  const cv = h('canvas', { class: 'fullmap', width: 720, height: 720 });
  const p = g.profile;
  const layers = ZONE_ORDER.map((id) => ZONES[id]).map((z) => {
    const visited = !!p.zones[z.id];
    const locked = p.level < z.levelReq;
    return h('li', { class: `${visited ? 'visited' : ''}${locked ? ' locked' : ''}${g.zone.id === z.id ? ' here' : ''}` },
      h('b', {}, z.name), h('small', {}, `${z.subtitle} · from Lv ${z.levelReq}${locked ? ' (locked)' : ''}${g.zone.id === z.id ? ' · you are here' : visited ? ' · visited' : ''}`),
      z.hazards.length ? h('small', { class: 'hz' }, `Hazards: ${z.hazards.map((x) => HAZARDS[x].name).join(', ')}`) : null);
  });
  layers.push(h('li', { class: 'locked' }, h('b', {}, 'The Sealed Core'), h('small', {}, 'Below the Diamond Throat. Four sigils from the elemental isles are needed.')));
  root.append(h('div', { class: 'map-layout' }, h('div', { class: 'map-wrap' }, cv, h('p', { class: 'muted small' }, '✦ camp · ▼ way down · ▲ way up · ◆ Echo Stone · ◎ arena · ☠ boss')), h('div', {}, h('h4', {}, 'Regions'), h('ul', { class: 'layers' }, layers))));
  requestAnimationFrame(() => g.ui.minimap.drawFull(cv));
}
