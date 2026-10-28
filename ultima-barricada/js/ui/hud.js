// HUD: resources, clock, stats, alerts, horde banner, squad buttons, minimap, the contextual
// selection panel and the build menu. Pure DOM over the canvas; every action goes to UB.App.
(function (UB) {
  'use strict';
  const { RES, BUILDINGS, BUILD_ORDER, POIS, WEAPONS, CRAFT, FEATURE, BAL } = UB.DEF;
  const I = UB.I18N, t = I.t;
  const H = {};
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

  // ---- pixel icons ------------------------------------------------------------------------------
  const ICON_PAL = { '#': '#15110f', r: '#c83a2a', R: '#ff6a4a', w: '#e8e4d8', g: '#9aa0a8', G: '#5a6068', b: '#8a5a32', B: '#5a3a1e', y: '#e8c050', Y: '#b88a2a', o: '#e8762a', k: '#2a2c30', l: '#7dff9a', u: '#7dc8ff', p: '#d84aa0', s: '#ffd166' };
  const ICONS = {
    food: ['........', '..####..', '.#wwww#.', '.#rrrr#.', '.#rRrr#.', '.#rrrr#.', '.#wwww#.', '..####..'],
    wood: ['........', '.##.....', '#bb#.##.', '#bB##bb#', '.##.#bB#', '.##..##.', '#bb#....', '.##.....'],
    scrap: ['...##...', '.#.gg.#.', '..gGGg..', '#gG..Gg#', '#gG..Gg#', '..gGGg..', '.#.gg.#.', '...##...'],
    ammo: ['........', '.y..y..y', '.Y..Y..Y', '.y..y..y', '.y..y..y', '.y..y..y', '.k..k..k', '........'],
    fuel: ['..##....', '.#rr###.', '#rrrrrr#', '#rRrrrr#', '#rrRrrr#', '#rrrRrr#', '#rrrrrr#', '.######.'],
    meds: ['........', '.######.', '#wwwwww#', '#www.rw#', '#wrrrrw#', '#wwwrww#', '#wwwwww#', '.######.'],
    pop: ['..##....', '.#ss#.##', '.#ss##ss', '..##.#ss', '.####.##', '#ssss###', '#ssss#ss', '........'],
    morale: ['..####..', '.#ssss#.', '#s#ss#s#', '#ssssss#', '#s#ss#s#', '#ss##ss#', '.#ssss#.', '..####..'],
    power: ['....##..', '...#s#..', '..#s#...', '.#sss##.', '..##s#..', '...#s#..', '..#s#...', '..##....'],
    score: ['...#....', '..#s#...', '###s####', '#ssssss#', '.#ssss#.', '.#s##s#.', '#s#..#s#', '##....##'],
    skull: ['.######.', '#wwwwww#', '#w##w##w', '#w##w##w', '#wwwwwww', '.#ww#ww#', '.#w#w#w.', '..#####.'],
  };
  const iconCache = {};
  function iconURL(name) {
    if (iconCache[name]) return iconCache[name];
    const rows = ICONS[name];
    const c = document.createElement('canvas');
    c.width = 8; c.height = 8;
    const x = c.getContext('2d');
    rows.forEach((r, y) => { for (let i = 0; i < r.length; i++) if (r[i] !== '.') { x.fillStyle = ICON_PAL[r[i]]; x.fillRect(i, y, 1, 1); } });
    iconCache[name] = c.toDataURL();
    return iconCache[name];
  }
  const ico = (name) => `<img class="ico" src="${iconURL(name)}" alt="">`;
  H.ico = ico;
  function costHTML(S, cost) {
    const parts = [];
    for (const k in cost) parts.push(`<span class="${S && S.res[k] < cost[k] ? 'lack' : ''}">${ico(k)}${cost[k]}</span>`);
    return `<span class="cost">${parts.join('') || `<span>${t('ui.free')}</span>`}</span>`;
  }
  H.costHTML = costHTML;

  // Copies a sprite into a small canvas element (for portraits and build cards).
  function spriteCanvas(spr, size) {
    const c = document.createElement('canvas');
    c.width = size; c.height = size;
    const x = c.getContext('2d');
    x.imageSmoothingEnabled = false;
    const k = Math.min(size / spr.w, size / spr.h, 2);
    const w = spr.w * k, h = spr.h * k;
    x.drawImage(spr.c, (size - w) / 2, (size - h) / 2, w, h);
    return c;
  }
  H.spriteCanvas = spriteCanvas;

  // ---- static DOM ------------------------------------------------------------------------------------
  function renderSquads() {
    $('squads').innerHTML = [1, 2, 3, 4].map((n) => `<button class="btn" data-sq="${n}" title="${esc(t('sq.title', { n }))}">${n}<span class="n"></span></button>`).join('') +
      `<button class="btn" data-sq="all" title="${esc(t('sq.allTitle'))}">${t('sq.all')}</button><button class="btn" data-sq="idle" title="${esc(t('sq.idleTitle'))}">${t('sq.idle')}</button>`;
  }
  H.init = function () {
    const res = $('res');
    res.innerHTML = RES.map((k) => `<div class="res" data-res="${k}" data-tip="res:${k}">${ico(k)}<b>0</b><span class="cap"></span><span class="delta"></span></div>`).join('');
    renderSquads();
    $('squads').addEventListener('click', (e) => {
      const b = e.target.closest('[data-sq]');
      if (!b) return;
      UB.App.squadButton(b.dataset.sq, e.ctrlKey || e.metaKey);
    });
    $('btnPause').onclick = () => UB.App.togglePause();
    $('btnSpeed').onclick = () => UB.App.cycleSpeed();
    $('btnMenu').onclick = () => UB.App.openPause();
    $('miniToggle').onclick = () => $('miniWrap').classList.toggle('closed');
    $('miniBox').addEventListener('pointerdown', miniPointer);
    $('miniBox').addEventListener('pointermove', (e) => { if (e.buttons) miniPointer(e); });
    // Panel and build menu: delegated actions.
    $('panel').addEventListener('click', (e) => {
      const b = e.target.closest('[data-act]');
      if (!b || b.disabled) return;
      UB.Audio.play('click');
      UB.App.action(b.dataset.act, b.dataset.arg);
    });
    $('panel').addEventListener('pointerdown', () => { H.panelHold = true; });
    window.addEventListener('pointerup', () => { H.panelHold = false; });
    // Build menu: hovering (mouse) or a first tap (touch) shows what a structure does; a click,
    // a second tap or the info card's button starts placing it.
    let lastPointer = 'mouse';
    $('bmGrid').addEventListener('pointerdown', (e) => { lastPointer = e.pointerType; });
    $('bmGrid').addEventListener('pointerover', (e) => {
      const c = e.pointerType === 'mouse' && e.target.closest('[data-build]');
      if (c && H.infoType !== c.dataset.build) { H.infoType = c.dataset.build; renderInfo(UB.App.S); }
    });
    $('bmGrid').addEventListener('click', (e) => {
      const c = e.target.closest('[data-build]');
      if (!c) return;
      UB.Audio.play('click');
      const type = c.dataset.build;
      if (lastPointer !== 'mouse' && H.infoType !== type) { H.infoType = type; renderInfo(UB.App.S); markCard(); return; }
      UB.App.startBuild(type);
    });
    $('bmInfo').addEventListener('click', (e) => {
      const b = e.target.closest('[data-build-go]');
      if (b && !b.disabled) { UB.Audio.play('click'); UB.App.startBuild(b.dataset.buildGo); }
    });
    $('bmClose').onclick = () => H.showBuild(false);
    $('bmTabs').addEventListener('click', (e) => { const b = e.target.closest('[data-tab]'); if (b) { H.buildTab = b.dataset.tab; H.renderBuild(UB.App.S); } });
    $('placeOk').onclick = () => UB.App.confirmPlace();
    $('placeCancel').onclick = () => UB.App.cancelMode();
    $('placeLine').onclick = () => UB.App.toggleLine();
    $('alerts').addEventListener('click', (e) => {
      const a = e.target.closest('.alert');
      if (a && a.dataset.x) UB.App.focus(+a.dataset.x, +a.dataset.y);
    });
    // Tooltips (mouse only).
    document.addEventListener('pointerover', (e) => {
      if (e.pointerType !== 'mouse') return;
      const t = e.target.closest('[data-tip]');
      if (!t) { $('tooltip').hidden = true; return; }
      const html = tipHTML(t.dataset.tip);
      if (!html) return;
      const tip = $('tooltip');
      tip.innerHTML = html; tip.hidden = false;
      const r = t.getBoundingClientRect();
      tip.style.left = Math.min(window.innerWidth - 290, Math.max(4, r.left)) + 'px';
      tip.style.top = (r.bottom + 6 + 120 > window.innerHeight ? r.top - tip.offsetHeight - 6 : r.bottom + 6) + 'px';
    });
    document.addEventListener('pointerout', (e) => { if (e.target.closest && e.target.closest('[data-tip]')) $('tooltip').hidden = true; });
    H.buildTab = 'defense';
  };
  // After a language change: redraw everything that holds text.
  H.refresh = function () {
    renderSquads();
    lastPanelSig = '';
    if (!$('buildMenu').hidden) H.renderBuild(UB.App.S);
    if (UB.App.inGame && UB.App.S) H.update(UB.App.S, performance.now());
  };

  function tipHTML(tip) {
    const S = UB.App.S;
    const [kind, key] = tip.split(':');
    if (kind === 'res' && S) {
      const d = H.dayDelta && H.dayDelta[key];
      return `<b>${t('res.' + key)}</b>: ${S.res[key]} / ${UB.Eco.cap(S)}<br>${t('resdesc.' + key)}${d ? `<br><span class="${d > 0 ? 'good-t' : 'bad-t'}">${t('ui.today', { d: (d > 0 ? '+' : '') + d })}</span>` : ''}`;
    }
    return '';
  }

  // One line with what a structure does at a given level (build menu and selection panel).
  function statLine(type, L) {
    switch (type) {
      case 'tower': return t('stat.garrison', { n: L.slots, r: L.range });
      case 'turret': return t('stat.turret', { r: L.range, d: L.dmg });
      case 'spotlight': return t('stat.light', { n: L.light });
      case 'spikes': return t('stat.spikes', { n: L.dps });
      case 'mine': return t('stat.mine', { d: L.dmg, r: L.r });
      case 'flamer': return t('stat.flamer', { r: L.range, d: L.dmg, n: L.fuelEvery });
      case 'shelter': return t('stat.beds', { n: L.beds });
      case 'depot': return t('stat.depot', { n: L.cap });
      case 'canteen': return t('stat.canteen', { p: Math.round(L.save * 100), m: L.morale });
      case 'training': return t('stat.training', { n: L.xp });
      case 'garden': return t('stat.garden', { n: Math.round((L.mult * 360) / BAL.gardenFoodEvery) });
      case 'workshop': return t('stat.workshop');
      case 'sawmill': return t('stat.sawmill', { n: Math.round((L.mult * 360) / BAL.sawmillWoodEvery) });
      case 'generator': return t('stat.generator', { n: L.supply, s: L.burn });
      case 'infirmary': return t('stat.infirmary', { n: L.patients, h: L.heal });
      case 'lab': return t('stat.lab', { food: BAL.labBatch.food, scrap: BAL.labBatch.scrap, s: L.cycle });
      case 'radio': return t('stat.radio', { n: Math.round(L.chance * 100) });
      default: return '';
    }
  }
  H.statLine = statLine;
  // Where a blueprint can be found (the sites whose search yields it).
  function blueprintSites(bp) {
    const out = Object.keys(POIS).filter((k) => POIS[k].special === bp);
    if (bp === 'bp_turret' || bp === 'bp_radio') out.push('police');
    return out;
  }

  // The build menu's detail card: everything about a structure before building it.
  function renderInfo(S) {
    const el = $('bmInfo');
    const type = H.infoType;
    if (!S || !type || BUILDINGS[type].cat !== H.buildTab) { el.innerHTML = `<p class="muted small">${t('info.hint')}</p>`; return; }
    const def = BUILDINGS[type], L = def.levels[0];
    const locked = def.requires && !S.unlocked[def.requires];
    const facts = [t('info.size', { n: def.size }), t('info.hp', { n: L.hp })];
    if (def.walkable) facts.push(t('info.walkable'));
    if (L.power) facts.push(t('info.power', { n: L.power }));
    if (L.workers) facts.push(t('info.workers', { n: L.workers }));
    const stat = statLine(type, L);
    el.innerHTML = `<div class="bi-head"><canvas></canvas><div class="bi-main">
        <div><b>${I.name('bld', type)}</b> ${costHTML(S, L.cost)}</div>
        <div class="p-desc">${I.desc('bld', type)}</div>
        <div class="p-row small">${facts.map((f) => `<span class="kv">${f}</span>`).join('')}${stat ? `<span class="kv good-t">${stat}</span>` : ''}</div>
        ${locked ? `<div class="small bad-t">${t('ui.locked', { bp: def.requires })} ${t('info.where', { p: blueprintSites(def.requires) })}</div>` : `<div class="small muted">${t('info.levels', { n: def.levels.length })}</div>`}
      </div>
      <button class="btn good" data-build-go="${type}"${locked ? ' disabled' : ''}>${t('place.ok')}</button></div>`;
    el.querySelector('canvas').replaceWith(spriteCanvas(UB.Render.buildIcon(type), 46));
  }
  function markCard() { for (const c of document.querySelectorAll('#bmGrid [data-build]')) c.classList.toggle('sel', c.dataset.build === H.infoType); }

  // ---- per-frame updates ------------------------------------------------------------------------------
  let lastPanelSig = '', lastPanelT = 0, lastMini = 0, lastLogId = 0, dayStart = null, dayNum = 0;
  H.reset = function (S) { lastPanelSig = ''; lastLogId = S ? S.log.reduce((m, l) => Math.max(m, l.id), 0) : 0; dayStart = null; $('alerts').innerHTML = ''; H.dayDelta = {}; };

  H.update = function (S, now) {
    const cap = UB.Eco.cap(S);
    if (dayNum !== S.day || !dayStart) { dayNum = S.day; dayStart = Object.assign({}, S.res); }
    H.dayDelta = {};
    for (const k of RES) {
      const el = document.querySelector(`.res[data-res="${k}"]`);
      const v = S.res[k];
      el.querySelector('b').textContent = v;
      el.querySelector('.cap').textContent = '/' + cap;
      const low = k === 'food' ? v < S.units.length * BAL.eatPerDay : k === 'ammo' ? v < 20 : k === 'fuel' ? v < 3 && S.buildings.some((b) => b.type === 'generator') : false;
      el.classList.toggle('low', low);
      el.classList.toggle('full', v >= cap);
      const d = v - dayStart[k];
      H.dayDelta[k] = d;
      const de = el.querySelector('.delta');
      de.textContent = d ? (d > 0 ? '+' : '') + d : '';
      de.className = 'delta ' + (d > 0 ? 'good-t' : 'bad-t');
    }
    // Clock.
    const hrs = UB.Waves.clockHours(S);
    const hh = Math.floor(hrs), mm = Math.floor((hrs - hh) * 60);
    $('clockDay').textContent = t('hud.day', { n: S.day });
    $('clockTime').textContent = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
    $('clockWx').textContent = `· ${t('weather.' + S.weather)}`;
    const L = UB.Waves.phaseLen(S, S.clock.phase);
    $('clockFill').style.width = `${Math.round((S.clock.t / L) * 100)}%`;
    $('clock').classList.toggle('night', S.clock.phase !== 'day');
    drawClockIcon(S);
    const pop = UB.Eco.population(S), beds = UB.Eco.beds(S);
    $('stPop').innerHTML = `${ico('pop')}${pop}/${beds}`;
    $('stPop').classList.toggle('bad-t', pop > beds);
    $('stMorale').innerHTML = `${ico('morale')}${Math.round(S.morale)}`;
    $('stMorale').className = 'chip ' + (S.morale < 30 ? 'bad-t' : S.morale > 80 ? 'good-t' : '');
    $('stPower').innerHTML = `${ico('power')}${S.power.used}/${S.power.supply}`;
    $('stPower').hidden = !S.buildings.some((b) => b.type === 'generator' || UB.DEF.BUILDINGS[b.type].levels[0].power);
    $('stScore').innerHTML = `${ico('score')}${UB.Game.score(S)}`;
    $('btnPause').textContent = UB.App.paused ? '▶' : '❚❚';
    $('btnSpeed').textContent = `${UB.App.speed}×`;
    // Squads.
    for (const n of [1, 2, 3, 4]) {
      const b = document.querySelector(`[data-sq="${n}"] .n`);
      const k = (S.squads[n] || []).length;
      b.textContent = k ? ` ·${k}` : '';
    }
    // Banner.
    const ban = $('banner');
    if (S.over) ban.hidden = true;
    else if (S.clock.phase === 'dusk' && S.horde) {
      ban.hidden = false;
      ban.textContent = t('banner.dusk', { sides: [...new Set(S.horde.spawns.map((s) => s.side))], s: Math.ceil(L - S.clock.t) });
    } else if (S.clock.phase === 'night' && S.horde) {
      const alive = S.zombies.filter((z) => !z.dead && (z.state === 'horde' || z.state === 'attackS' || z.wasHorde)).length + S.horde.queue.length;
      ban.hidden = alive === 0;
      ban.textContent = t(S.horde.night % 5 === 0 ? 'banner.blood' : 'banner.night', { n: S.horde.night, alive });
    } else ban.hidden = true;
    // Alerts.
    for (const m of S.log) {
      if (m.id <= lastLogId) continue;
      lastLogId = m.id;
      H.alert(m);
    }
    // Panel.
    const sig = panelSig(S);
    if (!H.panelHold && (sig !== lastPanelSig || now - lastPanelT > 600)) {
      lastPanelSig = sig; lastPanelT = now;
      renderPanel(S);
    }
    if (now - lastMini > 250) { lastMini = now; drawMini(S); }
  };

  function drawClockIcon(S) {
    const c = $('clockIcon'), x = c.getContext('2d');
    x.clearRect(0, 0, 9, 9);
    if (S.clock.phase === 'day') {
      x.fillStyle = '#ffd166'; x.fillRect(2, 2, 5, 5); x.fillRect(4, 0, 1, 9); x.fillRect(0, 4, 9, 1);
    } else {
      x.fillStyle = '#d8e0f0'; x.fillRect(2, 1, 4, 7); x.fillRect(1, 2, 1, 5); x.fillStyle = '#1c2029'; x.fillRect(4, 1, 3, 5);
    }
  }

  H.alert = function (m) {
    const box = $('alerts');
    const d = document.createElement('div');
    d.className = 'alert ' + (m.kind || 'info') + (m.tip ? ' tip' : '');
    d.textContent = I.msg(m);
    if (m.x !== undefined && m.x !== null && !Number.isNaN(m.x)) { d.dataset.x = m.x; d.dataset.y = m.y; d.title = t('hud.goThere'); }
    box.prepend(d);
    while (box.children.length > 5) box.lastChild.remove();
    const ttl = m.ttl || (m.kind === 'bad' ? 12000 : 8000);
    setTimeout(() => d.classList.add('fade'), ttl);
    setTimeout(() => d.remove(), ttl + 700);
    if (m.kind === 'bad') UB.Audio.play('bad');
  };
  H.toast = function (text, ms) {
    const t = $('toast');
    t.textContent = text; t.hidden = false;
    clearTimeout(H._toastT);
    H._toastT = setTimeout(() => { t.hidden = true; }, ms || 1800);
  };

  // ---- minimap ---------------------------------------------------------------------------------------
  let miniImg = null;
  function drawMini(S) {
    const c = $('minimap');
    if (c.closest('.closed') || $('hud').hidden) return;
    const x = c.getContext('2d');
    const N = S.map.w;
    if (!miniImg || miniImg.width !== N) miniImg = x.createImageData(N, N);
    const d = new Uint32Array(miniImg.data.buffer);
    const ter = S.map.terrain, exp = S.map.explored, vis = S._vis, feat = S.map.feature;
    for (let i = 0; i < N * N; i++) {
      if (!exp[i]) { d[i] = 0xff0a0807; continue; }
      let hex = UB.Tiles.MINI[ter[i]];
      const f = feat[i];
      if (f === 1 || f === 2 || f === 3) hex = 0x2e4a28;
      else if (f === 5 || f === 12) hex = 0x8a7a6a;
      const k = vis[i] ? 1 : 0.55;
      const r = ((hex >> 16) & 255) * k, g = ((hex >> 8) & 255) * k, b = (hex & 255) * k;
      d[i] = (255 << 24) | (b << 16) | (g << 8) | r;
    }
    const put = (px, py, col) => { if (px >= 0 && py >= 0 && px < N && py < N) d[py * N + px] = col; };
    const ABGR = (hex) => (255 << 24) | ((hex & 255) << 16) | (((hex >> 8) & 255) << 8) | ((hex >> 16) & 255);
    for (const p of S.pois) {
      if (!p.discovered) continue;
      const col = ABGR(p.searchesLeft > 0 || POIS[p.type].nest ? parseInt(UB.Render.POI_COLOR[p.type].slice(1), 16) : 0x6a6660);
      for (let yy = p.ty; yy < p.ty + p.h; yy++) for (let xx = p.tx; xx < p.tx + p.w; xx++) if (xx === p.tx || yy === p.ty || xx === p.tx + p.w - 1 || yy === p.ty + p.h - 1) put(xx, yy, col);
    }
    for (const b of S.buildings) for (let yy = b.ty; yy < b.ty + b.h; yy++) for (let xx = b.tx; xx < b.tx + b.w; xx++) put(xx, yy, ABGR(b.type === 'hq' ? 0x7dc8ff : 0x5a9ac8));
    for (const z of S.zombies) if (!z.dead && vis[Math.floor(z.y) * N + Math.floor(z.x)]) put(Math.floor(z.x), Math.floor(z.y), ABGR(0xff3a2a));
    for (const u of S.units) if (!u.dead) { const ux = Math.floor(u.x), uy = Math.floor(u.y); put(ux, uy, ABGR(0x7dff9a)); put(ux + 1, uy, ABGR(0x7dff9a)); put(ux, uy + 1, ABGR(0x7dff9a)); }
    x.putImageData(miniImg, 0, 0);
    const blink = Math.floor(performance.now() / 400) % 2;
    for (const p of S.pois) if (p.rumor && !p.discovered) { x.fillStyle = blink ? '#ffd166' : '#8a6a1e'; x.fillRect(p.tx + p.w / 2 - 1, p.ty + p.h / 2 - 1, 3, 3); }
    if (S.dropMark && S.map.feature[S.dropMark.y * N + S.dropMark.x] === UB.DEF.F.CRATE) { x.fillStyle = blink ? '#ff6a2a' : '#ffd166'; x.fillRect(S.dropMark.x - 1, S.dropMark.y - 1, 3, 3); }
    if (S.horde && S.clock.phase !== 'day') for (const sp of S.horde.spawns) { x.fillStyle = '#ff3a2a'; x.fillRect(sp.x - 2, sp.y - 2, 5, 5); }
    // Camera viewport.
    const sz = UB.Render.size();
    const pts = [UB.Render.s2w(0, 0), UB.Render.s2w(sz.W, 0), UB.Render.s2w(sz.W, sz.H), UB.Render.s2w(0, sz.H)];
    x.strokeStyle = 'rgba(255,255,255,0.8)'; x.lineWidth = 1;
    x.beginPath(); pts.forEach((p, i) => (i ? x.lineTo(p.x, p.y) : x.moveTo(p.x, p.y))); x.closePath(); x.stroke();
  }
  function miniPointer(e) {
    e.preventDefault();
    const box = $('miniBox').getBoundingClientRect();
    const dx = e.clientX - (box.left + box.width / 2), dy = (e.clientY - (box.top + box.height / 2)) * 2;
    const c = Math.SQRT1_2;
    const x = (dx * c + dy * c) / 1.03, y = (-dx * c + dy * c) / 1.03;
    const k = 128 / $('minimap').offsetWidth;
    UB.App.focus(64 + x * k, 64 + y * k);
  }

  // ---- selection panel -----------------------------------------------------------------------------------
  function panelSig(S) {
    const a = UB.App;
    const sel = a.sel;
    const parts = [sel.units.join(','), sel.bld, sel.poi, sel.feat ? sel.feat.x + ',' + sel.feat.y : '', sel.zom, a.mode ? a.mode.kind : ''];
    for (const id of sel.units.slice(0, 8)) {
      const u = UB.World.get(S, id);
      if (u) parts.push(Math.ceil(u.hp / 5), u.ammo, u.order ? u.order.type : '', u.inside, u.weapon, u.infected >= 0 ? Math.ceil(u.infected / 10) : '', UB.Units.packTotal(u), u.starving);
    }
    if (sel.bld) { const b = UB.World.get(S, sel.bld); if (b) parts.push(Math.ceil(b.hp / 10), b.level, Math.round(b.built * 20), b.workers.length, b.garrison.length, b.patients.length, b.on, b.powered, b.craft ? Math.ceil(b.craft.t) : '', JSON.stringify(S.res), S.armory.shotgun, S.armory.rifle); }
    if (sel.poi) { const p = UB.World.get(S, sel.poi); if (p) parts.push(p.searchesLeft, p.hp | 0, p.discovered); }
    if (!sel.units.length && !sel.bld && !sel.poi) parts.push(S.day, S.clock.phase, S.autoRepair, S.units.filter((u) => !u.order && !u.inside).length);
    return parts.join('|');
  }

  function hpBar(f) {
    const col = f > 0.6 ? 'var(--good)' : f > 0.3 ? '#e8c84a' : 'var(--bad)';
    return `<div class="hpbar"><div style="width:${Math.round(Math.max(0, Math.min(1, f)) * 100)}%;background:${col}"></div></div>`;
  }
  const btn = (act, label, opts) => `<button class="btn ${opts && opts.cls ? opts.cls : ''}" data-act="${act}"${opts && opts.arg !== undefined ? ` data-arg="${esc(opts.arg)}"` : ''}${opts && opts.disabled ? ' disabled' : ''}${opts && opts.title ? ` title="${esc(opts.title)}"` : ''}>${label}</button>`;
  function orderName(u, S) {
    if (u.inside) {
      const b = UB.World.get(S, u.inside);
      const k = u.insideRole === 'garrison' ? 'ord.garrisonIn' : u.insideRole === 'patient' ? 'ord.patientIn' : 'ord.workIn';
      return t(k, { b: b ? b.type : undefined });
    }
    const o = u.order;
    if (!o) {
      if (u.task) return t(I.has('task.' + u.task.type) ? 'task.' + u.task.type : 'ord.auto');
      return t(u.target ? 'ord.defending' : 'ord.autoBase');
    }
    const k = o.type === 'loot' && u.searching ? 'ord.looting' : 'ord.' + o.type;
    return I.has(k) ? t(k) : o.type;
  }

  function renderPanel(S) {
    const a = UB.App;
    const el = $('panel');
    const sel = a.sel;
    let html = '';
    const units = sel.units.map((id) => UB.World.get(S, id)).filter(Boolean);
    if (a.mode && a.mode.kind === 'build') { el.hidden = true; return; }
    el.hidden = !$('buildMenu').hidden;
    if (units.length === 1) html = unitPanel(S, units[0]);
    else if (units.length > 1) html = groupPanel(S, units);
    else if (sel.bld && UB.World.get(S, sel.bld)) html = buildingPanel(S, UB.World.get(S, sel.bld));
    else if (sel.poi && UB.World.get(S, sel.poi)) html = poiPanel(S, UB.World.get(S, sel.poi));
    else if (sel.zom && UB.World.get(S, sel.zom)) html = zombiePanel(S, UB.World.get(S, sel.zom));
    else if (sel.feat) html = featPanel(S, sel.feat);
    else html = idlePanel(S);
    el.innerHTML = html;
    const pc = el.querySelector('canvas[data-portrait]');
    if (pc) {
      const kind = pc.dataset.portrait;
      let spr = null;
      if (kind === 'unit') { const u = units[0]; spr = UB.Render.unitIcon(u.role, u.ammo > 0 || u.weapon === 'bat' ? u.weapon : 'bat'); }
      else if (kind === 'bld') spr = UB.Render.buildIcon(UB.World.get(S, sel.bld).type);
      else if (kind === 'poi') spr = UB.Render.poiIcon(UB.World.get(S, sel.poi));
      else if (kind === 'zom') spr = UB.Render.zombieIcon(UB.World.get(S, sel.zom).type);
      if (spr) { const c = spriteCanvas(spr, 44); pc.replaceWith(c); c.className = pc.className; }
    }
    for (const m of el.querySelectorAll('canvas[data-mini]')) {
      const u = UB.World.get(S, +m.dataset.mini);
      if (u) m.replaceWith(spriteCanvas(UB.Render.unitIcon(u.role, u.ammo > 0 || u.weapon === 'bat' ? u.weapon : 'bat'), 28));
    }
  }

  function unitPanel(S, u) {
    const wk = u.ammo > 0 || u.weapon === 'bat' ? u.weapon : 'bat';
    const w = WEAPONS[wk];
    const pack = Object.entries(u.pack).filter(([, v]) => v > 0).map(([k, v]) => `<span class="kv">${ico(k)}${v}</span>`).join('') + (u.carry ? `<span class="kv">${ico(u.carry.res)}${u.carry.amt}</span>` : '');
    const status = [];
    if (u.infected >= 0) status.push(`<span class="kv bad-t">${t('unit.bitten', { s: Math.ceil(u.infected) })}</span>`);
    if (u.starving) status.push(`<span class="kv warn-t">${t('unit.starving', { d: u.starving })}</span>`);
    const weapons = ['pistol', 'shotgun', 'rifle', 'bat'].map((k) => {
      const have = k === 'pistol' || k === 'bat' || S.armory[k] > 0 || u.weapon === k;
      const n = k === 'shotgun' || k === 'rifle' ? ` (${S.armory[k] || 0})` : '';
      return btn('equip', t('weapon.' + k) + (k === u.weapon ? ' ✓' : n), { arg: k, disabled: !have || k === u.weapon, cls: k === u.weapon ? 'sel' : '', title: k === 'shotgun' || k === 'rifle' ? t('unit.fromArmory') : '' });
    }).join('');
    return `<div class="p-head"><canvas data-portrait="unit"></canvas><div style="flex:1;min-width:0">
      <div class="p-title">${esc(u.name)} <span class="p-sub">${I.name('role', u.role)} · ${t('rank.' + u.rank)}${u.squad ? ` · ${t('ui.sqShort', { n: u.squad })}` : ''}</span></div>
      <div class="p-row">${hpBar(u.hp / u.maxHp)}<span class="small">${Math.ceil(u.hp)}/${u.maxHp}</span></div>
      <div class="p-row small"><span class="kv">${t('weapon.' + wk)}${w.melee ? '' : ` · ${t('unit.ammo', { n: u.ammo })}`}</span><span class="kv">${t('unit.kills', { n: u.kills })}</span><span class="kv">${orderName(u, S)}</span>${status.join('')}</div>
      ${pack ? `<div class="p-row small">${t('unit.pack')} ${pack}</div>` : ''}
    </div></div>
    <div class="p-desc">${I.desc('role', u.role)} ${a11yHint()}</div>
    <div class="p-actions">${commonUnitActions(S, [u])}</div>
    <div class="p-actions small">${weapons}</div>`;
  }
  function a11yHint() {
    return t(UB.App.touch ? 'hint.touch' : 'hint.mouse');
  }
  function commonUnitActions(S, us) {
    const anyInside = us.some((u) => u.inside);
    const amove = UB.App.mode && UB.App.mode.kind === 'amove';
    return [
      btn('amove', amove ? t('act.amovePick') : `${t('act.amove')} <small>A</small>`, { cls: amove ? 'accent' : '' }),
      btn('hold', `${t('act.hold')} <small>S</small>`),
      btn('return', `${t('act.return')} <small>H</small>`),
      btn('release', t('act.release')),
      anyInside ? btn('exit', t('act.exit')) : '',
      ...[1, 2, 3, 4].map((n) => btn('setSquad', t('ui.sqShort', { n }), { arg: n, title: t('act.setSquadTitle', { n }) })),
      btn('deselect', '✕'),
    ].join('');
  }
  function groupPanel(S, us) {
    const minis = us.slice(0, 24).map((u) => `<div class="unit-mini" data-act="pickUnit" data-arg="${u.id}"><canvas data-mini="${u.id}" width="28" height="28"></canvas>${hpBar(u.hp / u.maxHp)}<span>${esc(u.name.split(' ')[0])}</span></div>`).join('');
    return `<div class="p-row"><span class="p-title">${t('group.title', { n: us.length })}</span><span class="p-sub">${a11yHint()}</span></div>
      <div class="unit-list">${minis}</div>
      <div class="p-actions">${commonUnitActions(S, us)}</div>`;
  }

  function buildingPanel(S, b) {
    const def = BUILDINGS[b.type];
    const L = def.levels[b.level - 1];
    const lines = [];
    const actions = [];
    const kv = (s, cls) => `<span class="kv${cls ? ' ' + cls : ''}">${s}</span>`;
    if (b.built < 1) {
      lines.push(kv(t('bld.underConstruction', { p: Math.round(b.built * 100) })));
      actions.push(btn('repair', t('act.sendBuilders')));
      actions.push(btn('demolish', t('act.cancelBuild'), { cls: 'bad' }));
    } else {
      if (def.levels.length > b.level) {
        const next = def.levels[b.level];
        actions.push(btn('upgrade', `${t('act.upgrade', { n: b.level + 1 })} ${costHTML(S, next.cost)}`, { disabled: !UB.Eco.can(S, next.cost), cls: 'good' }));
      }
      if (b.hp < b.maxHp) actions.push(btn('repair', t('act.repair')));
      if (b.type !== 'hq') actions.push(btn('demolish', t(a_confirm(b.id) ? 'act.demolishConfirm' : 'act.demolish'), { cls: 'bad' }));
      const slots = UB.Buildings.slots(b);
      if (b.type === 'tower' || b.type === 'hq') {
        lines.push(kv(t('bld.garrison', { n: b.garrison.length, m: slots })) + kv(t('bld.rangeBonus', { n: L.range })));
        actions.unshift(btn('garrisonSel', t('act.garrisonSel')));
        if (b.garrison.length) actions.push(btn('evict', t('act.evictAll')));
      }
      if (L.workers) {
        lines.push(kv(t('bld.workers', { n: b.workers.length, m: slots })));
        if (b.workers.length < slots) actions.unshift(btn('assign', t('act.addWorker')));
        if (b.workers.length) actions.push(btn('evict', t('act.freeWorkers')));
        actions.push(btn('nightShift', t(b.nightShift ? 'act.nightShiftOn' : 'act.nightShiftOff'), { title: t('act.nightShiftTitle') }));
        if (b.type === 'garden') lines.push(kv(t('bld.foodDay', { n: Math.round((b.workers.length * L.mult * 360) / BAL.gardenFoodEvery) })));
        if (b.type === 'workshop') {
          lines.push(kv(t('bld.ammoDay', { n: Math.round((b.workers.length * 360) / BAL.workshopCycle) * BAL.workshopBatch.ammo, state: t(b.powered ? 'bld.withPower' : 'bld.halfSpeed') })));
          if (b.craft) lines.push(kv(t('bld.crafting', { w: b.craft.item, s: Math.ceil(b.craft.t) })));
          else for (const k of Object.keys(CRAFT)) {
            const c = CRAFT[k];
            actions.push(btn('craft', `${t('act.craft', { w: k })} ${costHTML(S, c.cost)}`, { arg: k, disabled: b.level < c.level || !UB.Eco.can(S, c.cost) || !b.workers.length, title: b.level < c.level ? t('reason.needsWorkshop', { lvl: c.level }) : !b.workers.length ? t('bld.needWorker') : '' }));
          }
          lines.push(kv(t('bld.armory', { s: S.armory.shotgun, r: S.armory.rifle })));
        }
        if (b.type === 'sawmill') lines.push(kv(t('bld.woodDay', { n: Math.round((b.workers.length * L.mult * 360) / BAL.sawmillWoodEvery) })));
        if (b.type === 'lab') lines.push(kv(t('bld.medsDay', { n: Math.round((b.workers.length * 360) / L.cycle), state: t(b.powered ? 'bld.withPower' : 'bld.needPower') })));
      }
      if (b.type === 'infirmary') {
        lines.push(kv(t('bld.patients', { n: b.patients.length, m: slots })) + kv(t(b.powered ? 'bld.powered' : 'bld.slowHeal')));
        actions.unshift(btn('patientSel', t('act.patientSel')));
      }
      if (b.type === 'generator') {
        lines.push(kv(b.on ? (b.running ? t('gen.on', { n: L.supply }) : t('gen.noFuel')) : t('gen.off')) + kv(t('gen.burn', { s: L.burn })) + kv(t('gen.power', { u: S.power.used, s: S.power.supply, d: S.power.demand })));
        actions.unshift(btn('toggle', t(b.on ? 'act.turnOff' : 'act.turnOn')));
      }
      if (L.power && b.type !== 'generator') {
        lines.push(kv(t(b.powered ? 'bld.powered' : 'bld.noPower'), b.powered ? 'good-t' : 'bad-t'));
        if (b.type === 'turret' || b.type === 'spotlight' || b.type === 'radio') actions.unshift(btn('toggle', t(b.on ? 'act.turnOff' : 'act.turnOn')));
      }
      if (b.type === 'flamer') {
        lines.push(kv(statLine('flamer', L)));
        if (S.res.fuel <= 0) lines.push(kv(t('gen.noFuel'), 'bad-t'));
        actions.unshift(btn('toggle', t(b.on ? 'act.turnOff' : 'act.turnOn')));
      }
      if (b.type === 'mine' || b.type === 'canteen') lines.push(kv(statLine(b.type, L)));
      if (b.type === 'training') lines.push(kv(statLine('training', L)) + kv(t('bld.trainees', { n: S.units.filter((u) => UB.Eco.isTrainee(S, u)).length })));
      if (b.type === 'turret') lines.push(kv(t('bld.turretStats', { r: L.range, d: L.dmg })));
      if (b.type === 'hq') {
        lines.push(kv(t('bld.storage', { n: L.cap })) + kv(t('bld.beds', { n: L.beds })) + kv(t('bld.territory', { n: L.territory })) + kv(t(S.autoRepair ? 'bld.autoRepairOn' : 'bld.autoRepairOff')));
        actions.push(btn('autoRepair', t(S.autoRepair ? 'act.autoRepairOff' : 'act.autoRepairOn')));
      }
      if (b.type === 'shelter') lines.push(kv(t('bld.beds', { n: L.beds })));
      if (b.type === 'depot') lines.push(kv(t('bld.depotCap', { n: L.cap })));
      if (b.type === 'spikes') lines.push(kv(t('bld.spikesDps', { n: L.dps })));
      if (b.type === 'radio') lines.push(kv(t('bld.radioChance', { n: Math.round(L.chance * 100) })));
    }
    actions.push(btn('deselect', '✕'));
    return `<div class="p-head"><canvas data-portrait="bld"></canvas><div style="flex:1;min-width:0">
      <div class="p-title">${I.name('bld', b.type)} <span class="p-sub">${t('bld.level', { n: b.level })}</span></div>
      <div class="p-row">${hpBar(b.hp / b.maxHp)}<span class="small">${Math.ceil(b.hp)}/${b.maxHp}</span></div>
      <div class="p-row small">${lines.join('')}</div></div></div>
      <div class="p-desc">${I.desc('bld', b.type)}</div>
      <div class="p-actions">${actions.join('')}</div>`;
  }
  function a_confirm(id) { return UB.App.confirmDemolish === id; }

  function poiPanel(S, p) {
    const def = POIS[p.type];
    if (!p.discovered) return `<div class="p-row"><span class="p-title">${t('poi.unknown')}</span></div><div class="p-desc">${t('poi.unknownDesc')}</div><div class="p-actions">${btn('deselect', '✕')}</div>`;
    const loot = def.loot.map(([k]) => ico(k)).join('');
    const extras = [];
    if (def.special === 'police') extras.push(t('poi.extraWeapons'));
    if (def.special && def.special !== 'police') extras.push(t('bp.' + def.special));
    if (def.recruit || def.recruitCamp) extras.push(t('poi.extraSurvivors'));
    const squads = [1, 2, 3, 4].filter((n) => (S.squads[n] || []).length).map((n) => btn('sendSquad', t('act.sendSquad', { n }), { arg: n })).join('');
    const status = def.nest ? `<div class="p-row">${hpBar(p.hp / p.maxHp)}<span class="small">${Math.ceil(p.hp)}/${p.maxHp}</span></div>` : `<span class="kv">${p.searchesLeft > 0 ? t('poi.searchesLeft', { n: p.searchesLeft, m: def.searches }) : t('poi.exhausted')}</span>${p.exploded ? `<span class="kv bad-t">${t('poi.exploded')}</span>` : ''}`;
    return `<div class="p-head"><canvas data-portrait="poi"></canvas><div style="flex:1;min-width:0">
      <div class="p-title">${I.name('poi', p.type)} <span class="p-sub" style="color:#ff6a5a">${'☠'.repeat(def.danger)}</span></div>
      <div class="p-row small">${status}<span class="kv">${t('poi.rewards')} ${def.nest ? t('poi.nestReward', { n: UB.DEF.BAL.score.nest }) : loot + (extras.length ? ' + ' + extras.join(', ') : '')}</span></div></div></div>
      <div class="p-desc">${I.desc('poi', p.type)} ${t(def.nest ? 'poi.nestHint' : 'poi.lootHint')}</div>
      <div class="p-actions">${squads}${btn('deselect', '✕')}</div>`;
  }
  function zombiePanel(S, z) {
    return `<div class="p-head"><canvas data-portrait="zom"></canvas><div style="flex:1;min-width:0">
      <div class="p-title">${I.name('zom', z.type)}${z.turned ? ` <span class="p-sub">${t('zom.was', { name: esc(z.turned) })}</span>` : ''}</div>
      <div class="p-row">${hpBar(z.hp / z.maxHp)}<span class="small">${Math.ceil(z.hp)}/${z.maxHp}</span></div></div></div>
      <div class="p-desc">${t(`zom.${z.type}.note`)}</div><div class="p-actions">${btn('deselect', '✕')}</div>`;
  }
  function featPanel(S, f) {
    const i = f.y * S.map.w + f.x;
    const def = FEATURE[S.map.feature[i]];
    if (!def) return idlePanel(S);
    const amt = def.res ? `<span class="kv">${ico(def.res)} ${t('feat.left', { n: S.map.famt[i] })}</span>` : '';
    return `<div class="p-row"><span class="p-title">${t('feat.' + def.key)}</span>${amt}</div>
      <div class="p-desc">${def.pickup ? t('feat.crateHint') : t('feat.gatherHint', { r: def.res })}</div>
      <div class="p-actions">${btn('gatherIdle', t('act.gatherIdle'))}${btn('deselect', '✕')}</div>`;
  }
  function idlePanel(S) {
    const free = S.units.filter((u) => !u.order && !u.inside);
    const busy = S.units.length - free.length;
    return `<div class="p-row"><span class="p-title">${t('hud.day', { n: S.day })}</span><span class="p-sub">${t('idle.summary', { n: S.units.length, free: free.length, busy, nights: S.nights })}</span></div>
      <div class="p-actions">
        ${btn('openBuild', `${t('act.build')} <small>B</small>`, { cls: 'good' })}
        ${btn('selectAll', t('act.selectAll'))}
        ${btn('idle', `${t('act.nextIdle')} <small>Tab</small>`)}
        ${btn('goBase', `${t('act.goBase')} <small>H</small>`)}
        ${S.clock.phase === 'day' ? btn('skipDay', t('act.skipDay'), { title: t('act.skipDayTitle') }) : ''}
      </div>
      ${objectivesHTML(S)}
      <div class="p-desc hint">${t(UB.App.touch ? 'idle.hintTouch' : 'idle.hintMouse')}</div>`;
  }

  function objectivesHTML(S) {
    const list = UB.Objectives.open(S, 3);
    if (!list.length) return '';
    return `<div class="p-row small objectives"><b>${t('obj.header', { n: UB.Objectives.count(S), m: UB.Objectives.LIST.length })}</b>${list.map((o) => `<span class="kv">☐ ${esc(t('obj.' + o.id))}</span>`).join('')}</div>`;
  }

  // ---- build menu -----------------------------------------------------------------------------------------
  const TABS = ['defense', 'base', 'prod'];
  H.showBuild = function (on) {
    $('buildMenu').hidden = !on;
    $('panel').hidden = on || !!(UB.App.mode && UB.App.mode.kind === 'build');
    if (on) H.renderBuild(UB.App.S);
    lastPanelSig = '';
  };
  H.renderBuild = function (S) {
    if (!S) return;
    $('bmTabs').innerHTML = TABS.map((k) => `<button class="btn ${H.buildTab === k ? 'sel' : ''}" data-tab="${k}">${t('tab.' + k)}</button>`).join('');
    renderInfo(S);
    const grid = $('bmGrid');
    grid.innerHTML = '';
    for (const type of BUILD_ORDER) {
      const def = BUILDINGS[type];
      if (def.cat !== H.buildTab) continue;
      const locked = def.requires && !S.unlocked[def.requires];
      const cost = def.levels[0].cost;
      const card = document.createElement('button');
      card.className = 'bm-card' + (locked ? ' locked' : '') + (!UB.Eco.can(S, cost) ? ' poor' : '');
      card.dataset.build = type;
      card.innerHTML = `<span class="ic"></span><span><span class="nm">${I.name('bld', type)}</span><span class="key">${def.key ? def.key.toUpperCase() : ''}</span><br>${locked ? `<span class="small bad-t">${t('build.needsBp')}</span>` : costHTML(S, cost)}</span>`;
      card.querySelector('.ic').replaceWith(spriteCanvas(UB.Render.buildIcon(type), 46));
      grid.appendChild(card);
    }
    markCard();
  };

  H.place = function (text) {
    const pb = $('placeBar');
    pb.hidden = text === null;
    if (text !== null) $('placeInfo').innerHTML = text;
  };

  UB.HUD = H;
})(globalThis.UB = globalThis.UB || {});
