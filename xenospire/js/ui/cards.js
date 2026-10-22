// DOM building blocks: power cards, being cards with live portraits, small
// helpers. Portraits register themselves so main.js can animate them.
(function (XS) {
  'use strict';

  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const portraits = new Set();

  function el(tag, cls, html) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }

  function button(label, cls, onClick) {
    const b = el('button', 'btn ' + (cls || ''));
    b.type = 'button';
    b.innerHTML = label;
    b.addEventListener('click', (e) => { e.stopPropagation(); onClick(e); });
    return b;
  }

  function iconImg(def, cls = 'picon') {
    const img = el('img', cls);
    img.src = XS.icons.url(def, { codes: XS.app && XS.app.settings.elementCodes });
    img.alt = '';
    img.draggable = false;
    return img;
  }

  function tierTag(def) {
    return `<span class="tier t${def.tier}">${XS.S.tier[def.tier]}</span>`;
  }

  function elementTags(def) {
    return def.elements.map((e) => {
      const E = XS.Power.ELEMENTS[e];
      return `<span class="elem" style="--c:${E.ramp[2]};--d:${E.ramp[0]}">${E.name}</span>`;
    }).join('');
  }

  // Full power card. opts: { action: [label, fn], compact, compare: def }
  function powerCard(def, opts = {}) {
    const c = el('div', 'card power-card tier-' + def.tier + (opts.compact ? ' compact' : ''));
    c.style.setProperty('--glow', def.ramp[2]);
    const head = el('div', 'pc-head');
    head.appendChild(iconImg(def, 'picon big'));
    const titles = el('div', 'pc-titles', `<h4>${esc(def.name)}</h4>${def.sub ? `<div class="sub">${esc(def.sub)}</div>` : ''}<div class="tags">${tierTag(def)}${elementTags(def)}</div>`);
    head.appendChild(titles);
    c.appendChild(head);
    const body = el('div', 'pc-body');
    const lines = opts.compact ? def.desc.slice(0, 2) : def.desc;
    body.innerHTML = lines.map((l) => `<p>${esc(l)}</p>`).join('');
    c.appendChild(body);
    const stats = [`${XS.S.cooldown} <b>${XS.fmt1(def.cooldown)} s</b>`];
    if (def.range) stats.push(`${XS.S.range} <b>${XS.fmt1(def.range)}</b>`);
    stats.push(`${XS.S.damage} <b>${def.damage}</b>`);
    if (opts.compare) {
      const d = def.damage - opts.compare.damage;
      stats.push(`<span class="${d >= 0 ? 'up' : 'down'}">${d >= 0 ? '▲' : '▼'} ${Math.abs(d)}</span>`);
    }
    c.appendChild(el('div', 'pc-stats', stats.join(' · ')));
    if (!opts.compact) c.appendChild(el('div', 'flavor', esc(def.flavor)));
    if (opts.action) c.appendChild(button(opts.action[0], 'primary', opts.action[1]));
    return c;
  }

  // Live animated portrait canvas.
  // The backing store is sized to the creature, so every being fills its
  // frame whatever its size (the canvas is then shown at `size` CSS px).
  function portrait(genome, size = 64, opts = {}) {
    const cv = el('canvas', 'portrait');
    const st = genome.stats;
    const extent = Math.max(st.height * XS.ISO.VZ * 1.35, st.radius * XS.ELX * 2.8, genome.wings ? genome.wings.span * XS.PXU * 1.7 : 0) + 6;
    const backing = Math.round(XS.clamp(extent, size * 0.7, size * 2.4));
    cv.width = backing; cv.height = backing;
    cv.style.width = size + 'px'; cv.style.height = size + 'px';
    const p = new XS.Portrait(cv, genome, opts);
    p.canvas = cv;
    portraits.add(p);
    return cv;
  }
  function updatePortraits(dt) {
    for (const p of portraits) {
      if (!p.canvas.isConnected) { portraits.delete(p); continue; }
      p.update(dt);
    }
  }

  function bar(label, value, max, color) {
    return `<div class="stat"><span>${label}</span><i><b style="width:${Math.round(XS.clamp(value / max, 0.05, 1) * 100)}%;background:${color}"></b></i></div>`;
  }

  function beingCard(g, opts = {}) {
    const d = XS.Creature.describe(g);
    const c = el('div', 'card being-card');
    c.style.setProperty('--glow', g.palette.body[2]);
    const top = el('div', 'bc-top');
    top.appendChild(portrait(g, 72, { bg: '#100c1c' }));
    top.appendChild(el('div', 'bc-titles', `<h4>${esc(g.name)}</h4><div class="sub">${esc(g.epithet)}</div><div class="tags"><span class="chip">${d.archetype}</span><span class="chip">${d.personality}</span></div>`));
    c.appendChild(top);
    const st = g.stats;
    c.appendChild(el('div', 'bc-stats',
      bar(XS.S.hp, st.maxHp, 330, '#5ff0c8') + bar(XS.S.speed, st.speed, 8.5, '#ffd166') + bar(XS.S.mass, st.mass, 1.4, '#c88aff')));
    c.appendChild(el('div', 'bc-info', `
      <p><b>${XS.S.trait}:</b> ${d.trait.name} — ${d.trait.desc}</p>
      <p><b>${XS.S.basic}:</b> ${d.basic.name} · <b>${XS.S.dodge}:</b> ${d.dodge.name}</p>
      ${opts.bio === false ? '' : `<p class="bio"><b>${XS.S.homeworld}:</b> ${esc(g.bio.world)} (${esc(g.bio.habitat)}). Gosta de ${esc(g.bio.likes)}. Odeia ${esc(g.bio.hates)}.</p>`}`));
    if (opts.action) c.appendChild(button(opts.action[0], 'primary', opts.action[1]));
    return c;
  }

  // Small row of power icons (kit preview). onTap(def) optional.
  function kitRow(defs, onTap, slots = 3) {
    const r = el('div', 'kit');
    for (let i = 0; i < Math.max(slots, defs.length); i++) {
      const d = defs[i];
      const s = el('div', 'kit-slot' + (d ? '' : ' empty'));
      if (d) {
        s.appendChild(iconImg(d));
        s.title = d.name;
        if (onTap) { s.classList.add('tap'); s.addEventListener('click', () => onTap(d)); }
      }
      r.appendChild(s);
    }
    return r;
  }

  XS.Cards = { el, button, esc, powerCard, beingCard, portrait, updatePortraits, kitRow, iconImg, tierTag };
})(globalThis.XS = globalThis.XS || {});
