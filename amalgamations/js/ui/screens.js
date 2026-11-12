// Amalgamations — menus and screens. A small stack-based UI: open(name, opts), back(), closeAll().
// Any screen opened during play pauses the simulation.
(function (root) {
  'use strict';
  const AM = root.AM;
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const U = { stack: [], screens: {} };
  let G;

  U.init = function (g) {
    G = g;
    U.el = document.getElementById('ui');
    U.el.addEventListener('click', onClick);
    U.el.addEventListener('input', onInput);
    U.el.addEventListener('change', onInput);
    document.getElementById('hud').addEventListener('click', (e) => {
      const b = e.target.closest('[data-open]');
      if (b) { G.audio.sfx('ui'); if (b.dataset.open === 'fullscreen') G.toggleFullscreen(); else U.open(b.dataset.open); }
    });
  };
  U.top = () => (U.stack.length ? U.stack[U.stack.length - 1].name : null);
  U.open = function (name, opts) {
    const scr = U.screens[name];
    if (!scr) return;
    if (U.top() === name && !opts) return;
    U.stack.push({ name, opts: opts || {}, state: {} });
    U.render();
    if (G.mode === 'play' || G.mode === 'interior') { G.paused = true; G.input.reset(); }
  };
  U.back = function () {
    const cur = U.stack.pop();
    if (cur && U.screens[cur.name].onClose) U.screens[cur.name].onClose(cur);
    if (!U.stack.length && (G.mode === 'title')) { U.open('title'); return; }
    U.render();
    if (!U.stack.length) { G.paused = false; G.input.reset(); }
  };
  U.closeAll = function () { while (U.stack.length) { const c = U.stack.pop(); if (U.screens[c.name].onClose) U.screens[c.name].onClose(c); } U.render(); G.paused = false; };
  U.replace = function (name, opts) { const c = U.stack.pop(); if (c && U.screens[c.name].onClose) U.screens[c.name].onClose(c); U.open(name, opts); };
  U.cur = () => U.stack[U.stack.length - 1];
  U.render = function () {
    const cur = U.cur();
    if (!cur) { U.el.innerHTML = ''; U.el.className = ''; return; }
    const scr = U.screens[cur.name];
    U.el.className = 'open ' + (scr.cls || '');
    U.el.innerHTML = scr.render(cur.opts, cur.state);
    if (scr.after) scr.after(cur.opts, cur.state, U.el);
  };
  U.refresh = () => U.render();
  function onClick(e) {
    const t = e.target.closest('[data-do]');
    if (!t) return;
    const cur = U.cur();
    if (!cur) return;
    const act = t.dataset.do;
    G.audio.sfx('ui');
    if (act === 'back') { U.back(); return; }
    if (act === 'fullscreen') { G.toggleFullscreen(); return; }
    const scr = U.screens[cur.name];
    if (scr.actions && scr.actions[act]) scr.actions[act](t, cur.opts, cur.state, e);
  }
  function onInput(e) {
    const cur = U.cur();
    if (!cur) return;
    const scr = U.screens[cur.name];
    if (scr.onInput) scr.onInput(e.target, cur.opts, cur.state, e);
  }
  const head = (title, sub) => `<div class="phead"><h2>${title}</h2>${sub ? `<span class="sub">${sub}</span>` : ''}<button class="x" data-do="back" aria-label="Close">✕</button></div>`;
  const tabs = (list, cur) => `<div class="tabs">${list.map(([id, label]) => `<button class="tab ${id === cur ? 'on' : ''}" data-do="tab" data-tab="${id}">${label}</button>`).join('')}</div>`;
  U.confirm = function (text, yes) { U.open('confirm', { text, yes }); };

  // ---------- icons ----------
  const iconCache = new Map();
  function itemIcon(slot, base, rarity) {
    const key = slot + base + rarity;
    if (iconCache.has(key)) return iconCache.get(key);
    const cv = document.createElement('canvas'); cv.width = cv.height = 48;
    const c = cv.getContext('2d');
    const col = AM.RARITY[rarity] ? AM.RARITY[rarity].color : '#ccc';
    const metal = AM.R.RARITY_METAL[rarity] || '#9aa3ad';
    c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(0, 0, 48, 48);
    c.lineCap = 'round'; c.lineJoin = 'round';
    const L = (x1, y1, x2, y2, w, s) => { c.strokeStyle = s; c.lineWidth = w; c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke(); };
    const t = slot === 'weapon' ? base : slot;
    switch (t) {
      case 'sword': L(12, 36, 36, 12, 6, '#e8eef4'); L(14, 28, 20, 34, 4, metal); L(9, 39, 14, 34, 4, '#6a4a2e'); break;
      case 'greataxe': L(12, 38, 34, 14, 4, '#6a4a2e'); c.fillStyle = '#dfe6ee'; c.beginPath(); c.moveTo(28, 8); c.lineTo(42, 18); c.lineTo(32, 26); c.closePath(); c.fill(); break;
      case 'hammer': L(14, 38, 30, 18, 4, '#6a4a2e'); c.fillStyle = metal; c.save(); c.translate(32, 15); c.rotate(-0.8); c.fillRect(-10, -6, 20, 12); c.restore(); break;
      case 'spear': L(8, 40, 36, 12, 3, '#6a4a2e'); c.fillStyle = '#e8eef4'; c.beginPath(); c.moveTo(42, 6); c.lineTo(32, 12); c.lineTo(36, 16); c.closePath(); c.fill(); break;
      case 'daggers': L(10, 34, 26, 18, 4, '#e8eef4'); L(22, 38, 38, 22, 4, '#e8eef4'); break;
      case 'bow': c.strokeStyle = '#9a6a3a'; c.lineWidth = 4; c.beginPath(); c.arc(16, 24, 18, -1.1, 1.1); c.stroke(); L(24, 8, 24, 40, 1.5, '#eee'); break;
      case 'staff': L(14, 40, 30, 12, 4, '#6a4a2e'); c.fillStyle = col; c.beginPath(); c.arc(32, 10, 6, 0, 7); c.fill(); break;
      case 'claws': for (let i = 0; i < 3; i++) L(14 + i * 8, 36, 20 + i * 8, 12, 3, '#e8eef4'); break;
      case 'helmet': c.fillStyle = metal; c.beginPath(); c.arc(24, 28, 14, Math.PI, 0); c.fill(); c.fillRect(10, 27, 28, 6); c.fillStyle = '#222'; c.fillRect(20, 27, 8, 8); break;
      case 'armor': c.fillStyle = metal; c.beginPath(); c.moveTo(12, 12); c.lineTo(36, 12); c.lineTo(38, 38); c.lineTo(10, 38); c.closePath(); c.fill(); c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(22, 14, 4, 22); break;
      case 'charm': L(24, 6, 24, 16, 2, '#ddd'); c.fillStyle = col; c.beginPath(); c.moveTo(24, 16); c.lineTo(34, 28); c.lineTo(24, 40); c.lineTo(14, 28); c.closePath(); c.fill(); break;
      case 'ring': c.strokeStyle = '#f2c14e'; c.lineWidth = 5; c.beginPath(); c.arc(24, 28, 10, 0, 7); c.stroke(); c.fillStyle = col; c.beginPath(); c.arc(24, 16, 5, 0, 7); c.fill(); break;
      default: c.fillStyle = col; c.fillRect(14, 14, 20, 20);
    }
    c.strokeStyle = col; c.lineWidth = 3; c.strokeRect(1.5, 1.5, 45, 45);
    const url = cv.toDataURL();
    iconCache.set(key, url);
    return url;
  }
  const iconOf = (it) => itemIcon(it.slot, it.base || '', it.rarity);
  const gem = (color) => `<span class="gem" style="background:${color}"></span>`;
  U.itemIcon = itemIcon;

  function itemDetail(it, opts) {
    if (!it) return '<div class="detail empty">Select an item.</div>';
    const R = AM.RARITY[it.rarity];
    const eq = G.state.equipment[it.slot];
    let cmp = '';
    if (eq && eq !== it) {
      const d = AM.itemScore(it) - AM.itemScore(eq);
      cmp = `<div class="cmp ${d >= 0 ? 'up' : 'down'}">${d >= 0 ? '▲' : '▼'} ${Math.abs(Math.round(d))} vs equipped ${esc(AM.displayName(eq))}</div>`;
    }
    const lines = AM.itemLines(it).map((l) => `<li>${esc(l)}</li>`).join('');
    const isEq = G.state.equipment[it.slot] === it;
    const btns = [];
    if (isEq) btns.push('<button data-do="unequip">Unequip</button>');
    else btns.push('<button class="pri" data-do="equip">Equip</button>');
    if (!isEq) {
      if (opts && opts.shop) btns.push(`<button data-do="sell">Sell (${AM.sellValue(it)}g)</button>`);
      btns.push('<button data-do="salvage">Salvage</button>');
      btns.push(`<button data-do="fav">${it.fav ? '★ Unfavourite' : '☆ Favourite'}</button>`);
    }
    return `<div class="detail"><div class="dh"><img src="${iconOf(it)}" alt=""><div><b style="color:${R.color}">${esc(AM.displayName(it))}</b><br><small>${R.name} ${AM.typeName(it)} · item level ${it.ilvl}</small></div></div>${cmp}<ul>${lines}</ul><div class="btns">${btns.join('')}</div></div>`;
  }
  function statsSummary() {
    const S = G.player.stats;
    const pct = (v) => Math.round(v * 100) + '%';
    return `<div class="stats">
      <div><span>Health</span><b>${AM.fmt(S.maxHp)}</b></div><div><span>Attack</span><b>${AM.fmt(S.atk)}</b></div>
      <div><span>Defence</span><b>${AM.fmt(S.def)}</b></div><div><span>Speed</span><b>${S.speed.toFixed(1)}</b></div>
      <div><span>Hit damage</span><b>${AM.fmt(AM.basicDamage(S))}</b></div><div><span>Crit</span><b>${pct(S.critChance)} ×${S.critDmg.toFixed(2)}</b></div>
      <div><span>Energy</span><b>${S.maxEnergy}</b></div><div><span>Cooldowns</span><b>-${pct(S.cdr)}</b></div>
      ${S.lifesteal ? `<div><span>Lifesteal</span><b>${pct(S.lifesteal)}</b></div>` : ''}${S.evade ? `<div><span>Evasion</span><b>${pct(S.evade)}</b></div>` : ''}
      ${S.thorns ? `<div><span>Thorns</span><b>${pct(S.thorns)}</b></div>` : ''}${S.dr ? `<div><span>Damage taken</span><b>-${pct(S.dr)}</b></div>` : ''}
    </div>`;
  }
  function traitsHtml(g) {
    const t = g.traits.map((x) => { const T = AM.TRAITS[x.id]; return `<div class="trait"><b>${T.name}</b> <small>${Math.round(x.str * 100)}%</small><br><span>${T.desc}</span></div>`; }).join('');
    const syn = g.synergy ? AM.SYNERGIES.find((s) => s.id === g.synergy) : null;
    return t + (syn ? `<div class="trait syn"><b>★ ${syn.name}</b><br><span>${syn.desc}</span></div>` : '');
  }

  // =============== TITLE ===============
  U.screens.title = {
    cls: 'title',
    render() {
      const saves = AM.slotSummaries();
      const last = saves.filter((s) => !s.empty).sort((a, b) => b.saved - a.saved)[0];
      return `<div class="titlebox">
        <h1>AMALGAMATIONS</h1>
        <p class="tagline">Fuse two creatures into one. Explore an endless world. Fuse your powers too.</p>
        <div class="menu">
          ${last ? `<button class="pri big" data-do="continue" data-slot="${last.slot}">Continue<small>${esc(last.name)} · Lv ${last.level} · ${AM.fmtTime(last.playtime)}</small></button>` : ''}
          <button class="${last ? '' : 'pri big'}" data-do="new">New game</button>
          <button data-do="load">Load game</button>
          <button data-do="settings">Settings</button>
          <button data-do="howto">How to play</button>
          <button data-do="fullscreen">Fullscreen</button>
        </div>
        <p class="foot">Mouse & keyboard, touch or gamepad · progress saves automatically</p>
      </div>`;
    },
    actions: {
      continue(t) { const s = AM.loadSlot(+t.dataset.slot); if (s) { U.closeAll(); G.startGame(s); } },
      new() { U.open('newgame'); },
      load() { U.open('load'); },
      settings() { U.open('settings'); },
      howto() { U.open('howto'); },
    },
  };

  // =============== NEW GAME / LOAD ===============
  U.screens.newgame = {
    render(o, st) {
      const saves = AM.slotSummaries();
      if (st.slot == null) st.slot = (saves.find((s) => s.empty) || saves[0]).slot;
      if (!st.seed) st.seed = String(Math.floor(Math.random() * 1e9));
      return `<div class="panel narrow">${head('New game')}
        <p>Choose a save slot.</p>
        <div class="slots">${saves.map((s) => `<button class="slot ${st.slot === s.slot ? 'on' : ''}" data-do="slot" data-slot="${s.slot}">Slot ${s.slot + 1}<small>${s.empty ? 'Empty' : `${esc(s.name)} · Lv ${s.level} (will be overwritten)`}</small></button>`).join('')}</div>
        <label class="row">World seed <input id="seed" value="${esc(st.seed)}" maxlength="12"> <button data-do="reseed">🎲</button></label>
        <div class="btns"><button class="pri big" data-do="next">Choose your parents →</button></div></div>`;
    },
    onInput(t, o, st) { if (t.id === 'seed') st.seed = t.value.replace(/[^0-9a-zA-Z]/g, ''); },
    actions: {
      slot(t, o, st) { st.slot = +t.dataset.slot; U.refresh(); },
      reseed(t, o, st) { st.seed = String(Math.floor(Math.random() * 1e9)); U.refresh(); },
      next(t, o, st) { const seed = /^\d+$/.test(st.seed) ? (+st.seed >>> 0) : AM.hashStr(st.seed || 'x'); U.open('lab', { newGame: true, slot: st.slot, seed }); },
    },
  };
  U.screens.load = {
    render() {
      const saves = AM.slotSummaries();
      return `<div class="panel narrow">${head('Load game')}
        <div class="slots">${saves.map((s) => s.empty ? `<div class="slot empty">Slot ${s.slot + 1}<small>Empty</small></div>` :
        `<div class="slot">Slot ${s.slot + 1}<small>${esc(s.name)} · Lv ${s.level} · ${AM.fmtTime(s.playtime)} · seed ${s.seed}</small>
          <div class="btns"><button class="pri" data-do="load" data-slot="${s.slot}">Load</button><button data-do="export" data-slot="${s.slot}">Export</button><button class="danger" data-do="del" data-slot="${s.slot}">Delete</button></div></div>`).join('')}</div>
        <h3>Import a save code</h3><textarea id="imp" placeholder="AMG1:..."></textarea>
        <div class="btns"><button data-do="import">Import into an empty slot</button></div></div>`;
    },
    actions: {
      load(t) { const s = AM.loadSlot(+t.dataset.slot); if (s) { U.closeAll(); G.startGame(s); } },
      del(t) { const slot = +t.dataset.slot; U.confirm('Delete this save forever?', () => { AM.deleteSlot(slot); U.back(); U.refresh(); }); },
      export(t) { const s = AM.loadSlot(+t.dataset.slot); if (!s) return; U.open('text', { title: 'Save code', text: AM.exportCode(s) }); },
      import() {
        const code = document.getElementById('imp').value;
        try {
          const s = AM.importCode(code);
          const free = AM.slotSummaries().find((x) => x.empty);
          if (!free) { G.hud.toast('No empty slot', 'bad'); return; }
          s.slot = free.slot; AM.saveSlot(free.slot, s); U.refresh(); G.hud.toast('Save imported', 'gold');
        } catch (e) { G.hud.toast('That code is not valid', 'bad'); }
      },
    },
  };
  U.screens.text = {
    render(o) { return `<div class="panel narrow">${head(o.title)}<textarea readonly id="txt">${esc(o.text)}</textarea><div class="btns"><button class="pri" data-do="copy">Copy</button></div></div>`; },
    after() { const t = document.getElementById('txt'); if (t) t.select(); },
    actions: { copy() { const t = document.getElementById('txt'); t.select(); try { navigator.clipboard.writeText(t.value); G.hud.toast('Copied', 'info'); } catch (e) { document.execCommand('copy'); } } },
  };
  U.screens.confirm = {
    render(o) { return `<div class="panel narrow confirm"><p>${esc(o.text)}</p><div class="btns"><button data-do="back">Cancel</button><button class="pri" data-do="yes">Yes</button></div></div>`; },
    actions: { yes(t, o) { U.back(); o.yes(); } },
  };

  // =============== FUSION LAB ===============
  function labGenome(st) { return AM.fuse(st.m, st.f, st.v); }
  U.screens.lab = {
    cls: 'lab',
    render(o, st) {
      const unlocked = o.newGame ? new Set(AM.BASE_IDS.filter((id) => AM.BASES[id].unlocked)) : G.state.unlocked;
      if (!st.m) {
        if (o.newGame) { const u = [...unlocked]; st.m = u[Math.floor(Math.random() * u.length)]; st.f = u[Math.floor(Math.random() * u.length)]; if (st.f === st.m) st.f = u[(u.indexOf(st.m) + 1) % u.length]; st.v = 0; }
        else { st.m = G.state.form.mother; st.f = G.state.form.father; st.v = G.state.form.variant; }
        st.pick = 'm'; st.tab = st.tab || 'form';
      }
      if (!o.newGame && st.tab !== 'form') return labTabs(o, st);
      const g = labGenome(st);
      if (st.shown !== g.key) { st.shown = g.key; G.previewGenome(g); }
      const dna = o.newGame ? {} : G.state.inv.dna;
      const card = (id) => {
        const B = AM.BASES[id], un = unlocked.has(id);
        const sel = (st.m === id ? 'm' : '') + (st.f === id ? 'f' : '');
        return `<button class="base ${un ? '' : 'locked'} ${sel ? 'sel-' + sel : ''}" data-do="base" data-id="${id}" ${un ? '' : 'title="Locked"'}>
          <span class="bn">${un ? B.name : '???'}</span><small>${un ? B.cat : `${dna[id] || 0}/${B.dna} DNA`}</small>${st.m === id ? '<i class="mk m">♀</i>' : ''}${st.f === id ? '<i class="mk f">♂</i>' : ''}</button>`;
      };
      const mb = AM.BASES[st.m], fb = AM.BASES[st.f];
      const bar = (k, max) => { const v = g.stats[k]; return `<div class="sbar"><span>${k.toUpperCase()}</span><i style="width:${Math.min(100, v / max * 100)}%"></i><b>${k === 'spd' ? v.toFixed(2) : v}</b></div>`; };
      return `${o.newGame ? '' : `<div class="labtabs">${tabs([['form', 'Form'], ['powers', 'Fuse powers'], ['respec', 'Respec']], 'form')}</div>`}
      <div class="labside left">
        <div class="phead"><h2>Fusion Lab</h2><button class="x" data-do="back">✕</button></div>
        <p class="hint">Pick a <b class="m">mother ♀</b> and a <b class="f">father ♂</b>. The order matters, and each mutation is a different blend.</p>
        <div class="pickrow"><button class="${st.pick === 'm' ? 'on m' : ''}" data-do="pick" data-p="m">♀ ${mb.name}</button><button class="${st.pick === 'f' ? 'on f' : ''}" data-do="pick" data-p="f">♂ ${fb.name}</button></div>
        <div class="bases">${AM.BASE_IDS.map(card).join('')}</div>
      </div>
      <div class="labside right">
        <h2 class="fname">${esc(g.name)}</h2><p class="fsub">${esc(g.subtitle)} · mutation ${st.v + 1}</p>
        <div class="btns"><button data-do="vprev">‹</button><button data-do="reroll">🎲 Mutate</button><button data-do="vnext">›</button><button data-do="swap">⇄ Swap</button></div>
        <div class="bars">${bar('hp', 170)}${bar('atk', 18)}${bar('def', 16)}${bar('spd', 1.4)}${bar('energy', 160)}</div>
        <p class="small">Attack: <b>${AM.ATTACKS[g.attack].name}</b> · ${g.posture} · ${g.legs ? g.legs.count + ' legs' : 'no legs'}${g.wings ? ' · wings' : ''}</p>
        <div class="traits">${traitsHtml(g)}</div>
        <p class="small inh">Body ${AM.BASES[g.from.body].name} · Head ${AM.BASES[g.from.head].name} · Colours ${AM.BASES[g.from.color].name}</p>
        <div class="btns"><button class="pri big" data-do="confirm">${o.newGame ? 'Become this creature →' : 'Take this form'}</button></div>
      </div>`;
    },
    after() { if (G.preview) G.preview.spin = true; },
    onClose(c) { if (!c.opts.newGame && G.preview && G.preview.rig) { AM.R.disposeCreature(G.preview.rig); G.preview.rig = null; } if (c.opts.newGame && G.mode === 'title') G.showcase(); },
    actions: {
      tab(t, o, st) { st.tab = t.dataset.tab; if (st.tab === 'form') st.shown = null; U.refresh(); },
      pick(t, o, st) { st.pick = t.dataset.p; U.refresh(); },
      base(t, o, st) {
        const id = t.dataset.id;
        const unlocked = o.newGame ? AM.BASES[id].unlocked : G.state.unlocked.has(id);
        if (!unlocked) { G.hud.toast(`Locked: collect ${AM.BASES[id].dna} ${AM.BASES[id].name} DNA from wild creatures.`, 'bad'); return; }
        st[st.pick] = id; st.v = 0; st.pick = st.pick === 'm' ? 'f' : 'm'; U.refresh();
      },
      vprev(t, o, st) { st.v = Math.max(0, st.v - 1); U.refresh(); },
      vnext(t, o, st) { st.v++; U.refresh(); },
      reroll(t, o, st) { st.v = Math.floor(Math.random() * 50); U.refresh(); },
      swap(t, o, st) { const m = st.m; st.m = st.f; st.f = m; U.refresh(); },
      confirm(t, o, st) {
        const form = { mother: st.m, father: st.f, variant: st.v };
        if (o.newGame) { U.open('path', { slot: o.slot, seed: o.seed, form }); return; }
        const changed = form.mother !== G.state.form.mother || form.father !== G.state.form.father || form.variant !== G.state.form.variant;
        G.state.form = form;
        if (changed) { G.prog.stat('reforms', 1); G.state.stats.fusions++; }
        G.refreshPlayer();
        G.fx.burst(G.player.x, 1, G.player.z, '#d07bff', 30, 4, 0.18, 0.8);
        G.audio.sfx('fuse');
        G.hud.toast(`You are now ${G.state.formName}!`, 'gold');
        U.back();
      },
      // power fusion tab
      pa(t, o, st) { st.pa = t.dataset.id; if (st.pb === st.pa) st.pb = null; st.slotPick = 'b'; U.refresh(); },
      pb(t, o, st) { st.pb = t.dataset.id; U.refresh(); },
      pswap(t, o, st) { const a = st.pa; st.pa = st.pb; st.pb = a; U.refresh(); },
      dofuse(t, o, st) { const r = G.prog.fusePowers(st.pa, st.pb); if (!r.ok) G.hud.toast(r.reason, 'bad'); else { st.pa = st.pb = null; } U.refresh(); },
      unfuse(t) { G.prog.unfuse(t.dataset.id); U.refresh(); },
      respec() { const c = G.prog.respecCost(); if (!G.prog.respec()) G.hud.toast(`Respec costs ${c} gold`, 'bad'); else G.hud.toast('Skill points refunded', 'gold'); U.refresh(); },
    },
  };
  function labTabs(o, st) {
    if (G.preview && G.preview.rig) { AM.R.disposeCreature(G.preview.rig); G.preview.rig = null; st.shown = null; }
    const learned = G.state.powers.learned.filter((id) => !id.includes('+'));
    const fused = G.state.powers.learned.filter((id) => id.includes('+'));
    let body = '';
    if (st.tab === 'powers') {
      const pw = (id, act, sel) => `<button class="pw ${sel ? 'on' : ''}" data-do="${act}" data-id="${id}"><canvas width="44" height="44" data-icon="${id}"></canvas><span>${esc(AM.powerSpec(id).name)}</span></button>`;
      let prev = '<p class="hint">Pick a delivery power (A) and a payload power (B). A decides how it travels; B triggers where it lands. Order matters!</p>';
      if (st.pa && st.pb) {
        const s = AM.fusePowers(st.pa, st.pb);
        const cost = AM.powerFusionCost(st.pa, st.pb);
        const have = G.state.inv.mats.essence || 0;
        const known = G.state.powers.learned.includes(s.id);
        prev = `<div class="fprev"><canvas width="64" height="64" data-icon="${s.id}"></canvas><div><b style="color:${s.color}">${esc(s.name)}</b><br><small>${s.combo} · ${s.shape} · ${s.energy} energy · ${s.cd}s cooldown</small><p>${esc(s.desc)}</p></div></div>
          <div class="btns"><button data-do="pswap">⇄ Swap A/B</button><button class="pri" data-do="dofuse" ${known ? 'disabled' : ''}>${known ? 'Already known' : `Fuse (${cost} essence, you have ${have})`}</button></div>`;
      }
      body = `<div class="cols2"><div><h3>A · delivery</h3><div class="pwgrid">${learned.map((id) => pw(id, 'pa', st.pa === id)).join('')}</div></div>
        <div><h3>B · payload</h3><div class="pwgrid">${learned.filter((id) => id !== st.pa).map((id) => pw(id, 'pb', st.pb === id)).join('')}</div></div></div>${prev}
        ${fused.length ? `<h3>Your fused powers</h3><div class="pwlist">${fused.map((id) => `<div class="pwrow"><canvas width="36" height="36" data-icon="${id}"></canvas><span>${esc(AM.powerSpec(id).name)}</span><button data-do="unfuse" data-id="${id}">Unfuse (+50% essence)</button></div>`).join('')}</div>` : ''}`;
    } else {
      body = `<p>Reset your skill tree and get every point back (your starting path is kept).</p><p>Cost: <b>${G.prog.respecCost()} gold</b> (you have ${AM.fmt(G.state.gold)}).</p><div class="btns"><button class="pri" data-do="respec">Respec</button></div>`;
    }
    return `<div class="panel wide">${head('Lab Keeper')}${tabs([['form', 'Form'], ['powers', 'Fuse powers'], ['respec', 'Respec']], st.tab)}${body}</div>`;
  }
  function paintIcons(el) { for (const cv of el.querySelectorAll('canvas[data-icon]')) G.hud.drawPowerIcon(cv, cv.dataset.icon); }
  const oldAfter = U.screens.lab.after;
  U.screens.lab.after = function (o, st, el) { oldAfter(); paintIcons(el); };

  // =============== PATH ===============
  U.screens.path = {
    render() {
      return `<div class="panel wide">${head('Choose your path', 'Your first branch of the skill tree and your two starting powers')}
        <div class="paths">${AM.SKILL_BRANCHES.map((b) => `<button class="path" data-do="go" data-id="${b.id}" style="--c:${b.color}">
          <b>${b.name}</b><span>${b.blurb}</span><div class="pp"><canvas width="40" height="40" data-icon="${b.power}"></canvas><small>${AM.POWERS[b.power].name}</small><canvas width="40" height="40" data-icon="${AM.PATH_SECOND[b.id]}"></canvas><small>${AM.POWERS[AM.PATH_SECOND[b.id]].name}</small></div></button>`).join('')}</div>
        <p class="hint">Every other branch stays open: you can grow into any of them later.</p></div>`;
    },
    after(o, st, el) { paintIcons(el); },
    actions: { go(t, o) { const state = AM.newState(o.seed, o.slot, o.form, t.dataset.id); U.closeAll(); G.startGame(state); G.hud.toast('Welcome to Hearthmoor! Talk to the Elder for quests.', 'gold'); } },
  };

  // =============== PAUSE ===============
  U.screens.pause = {
    render() {
      const st = G.state;
      return `<div class="panel narrow">${head('Paused', `${esc(st.formName)} · Level ${st.level} · ${AM.fmtTime(st.playtime)}`)}
        <div class="menu">
          <button class="pri" data-do="back">Resume</button>
          <button data-do="go" data-s="inventory">Inventory</button><button data-do="go" data-s="powers">Powers</button>
          <button data-do="go" data-s="skills">Skills ${st.points ? `(${st.points})` : ''}</button><button data-do="go" data-s="map">Map</button>
          <button data-do="go" data-s="quests">Quests & goals</button><button data-do="go" data-s="settings">Settings</button>
          <button data-do="go" data-s="howto">How to play</button><button data-do="fullscreen">Fullscreen</button>
          <button data-do="save">Save now</button><button class="danger" data-do="quit">Save & quit to title</button>
        </div></div>`;
    },
    actions: {
      go(t) { U.open(t.dataset.s); },
      save() { G.hud.toast(G.save() ? 'Game saved' : 'Saving failed', 'info'); },
      quit() { G.save(); U.closeAll(); G.toTitle(); },
    },
  };

  // =============== INVENTORY ===============
  U.screens.inventory = {
    render(o, st) {
      st.tab = st.tab || 'items';
      const S = G.state;
      let body = '';
      if (st.tab === 'items') {
        const items = S.inv.items;
        const sel = st.sel != null ? (st.selEq ? S.equipment[st.sel] : items[st.sel]) : null;
        const slots = AM.GEAR_SLOTS.map((k) => { const it = S.equipment[k]; return `<button class="eq ${st.selEq && st.sel === k ? 'on' : ''}" data-do="seleq" data-k="${k}">${it ? `<img src="${iconOf(it)}" alt="">` : `<span>${k}</span>`}</button>`; }).join('');
        const grid = [];
        for (let i = 0; i < AM.INV_SIZE; i++) { const it = items[i]; grid.push(it ? `<button class="cell ${!st.selEq && st.sel === i ? 'on' : ''} ${it.fav ? 'fav' : ''}" data-do="sel" data-i="${i}"><img src="${iconOf(it)}" alt="">${it.plus ? `<i>+${it.plus}</i>` : ''}</button>` : '<div class="cell"></div>'); }
        const cons = Object.keys(AM.CONSUMABLES).filter((k) => S.inv.cons[k] > 0).map((k) => `<button class="con" data-do="use" data-id="${k}">${gem(AM.CONSUMABLES[k].color)}${AM.CONSUMABLES[k].name} ×${S.inv.cons[k]}</button>`).join('') || '<small>No consumables.</small>';
        body = `<div class="invgrid"><div class="eqcol"><div class="eqs">${slots}</div>${statsSummary()}</div>
          <div class="maincol"><div class="toolbar"><span>${items.length}/${AM.INV_SIZE}</span><button data-do="sort">Sort</button><button data-do="salvageall">Salvage commons</button></div>
          <div class="cells">${grid.join('')}</div><h3>Consumables</h3><div class="cons">${cons}</div></div>
          <div class="detcol">${itemDetail(sel, o)}</div></div>`;
      } else if (st.tab === 'craft') {
        body = craftList(false);
      } else {
        const mats = Object.keys(AM.MATERIALS).map((k) => `<div class="mat">${gem(AM.MATERIALS[k].color)}<b>${AM.MATERIALS[k].name}</b><span>${S.inv.mats[k] || 0}</span><small>${AM.MATERIALS[k].desc}</small></div>`).join('');
        const dna = AM.BASE_IDS.filter((id) => !AM.BASES[id].unlocked).map((id) => `<div class="mat">${gem(S.unlocked.has(id) ? '#5fd068' : '#ff6ad5')}<b>${AM.BASES[id].name} DNA</b><span>${S.inv.dna[id] || 0}/${AM.BASES[id].dna}</span><small>${S.unlocked.has(id) ? 'Unlocked' : 'Collect to unlock this base'}</small></div>`).join('');
        body = `<div class="mats">${mats}</div><h3>DNA</h3><div class="mats">${dna}</div>`;
      }
      return `<div class="panel wide">${head('Inventory', `${AM.fmt(S.gold)} gold`)}${tabs([['items', 'Items'], ['craft', 'Crafting'], ['mats', 'Materials & DNA']], st.tab)}${body}</div>`;
    },
    actions: Object.assign({
      tab(t, o, st) { st.tab = t.dataset.tab; st.sel = null; U.refresh(); },
      sel(t, o, st) { st.sel = +t.dataset.i; st.selEq = false; U.refresh(); },
      seleq(t, o, st) { if (G.state.equipment[t.dataset.k]) { st.sel = t.dataset.k; st.selEq = true; } U.refresh(); },
      equip(t, o, st) { const it = st.selEq ? G.state.equipment[st.sel] : G.state.inv.items[st.sel]; if (it) G.prog.equip(it); st.sel = null; U.refresh(); },
      unequip(t, o, st) { G.prog.unequip(st.sel); st.sel = null; st.selEq = false; U.refresh(); },
      salvage(t, o, st) { const it = G.state.inv.items[st.sel]; if (!it) return; const doIt = () => { const y = G.prog.salvage(it); G.hud.toast('Salvaged: ' + Object.entries(y).map(([k, v]) => `${v} ${AM.MATERIALS[k].name}`).join(', '), 'info'); st.sel = null; U.refresh(); }; if (AM.RARITY[it.rarity].tier >= 3) U.confirm(`Salvage ${it.name}?`, doIt); else doIt(); },
      sell(t, o, st) { const it = G.state.inv.items[st.sel]; if (!it) return; const v = G.prog.sell(it); G.hud.toast(`Sold for ${v} gold`, 'info'); st.sel = null; U.refresh(); },
      fav(t, o, st) { const it = G.state.inv.items[st.sel]; if (it) it.fav = !it.fav; U.refresh(); },
      sort() { G.state.inv.items.sort((a, b) => AM.GEAR_SLOTS.indexOf(a.slot) - AM.GEAR_SLOTS.indexOf(b.slot) || AM.RARITY[b.rarity].tier - AM.RARITY[a.rarity].tier || AM.itemScore(b) - AM.itemScore(a)); U.refresh(); },
      salvageall() { const r = G.prog.salvageCommons(); G.hud.toast(r.n ? `Salvaged ${r.n} common items` : 'No unfavourited common items', 'info'); U.refresh(); },
      use(t) { G.prog.useCon(t.dataset.id); U.refresh(); },
    }, craftActions()),
  };
  function craftList(smith) {
    const S = G.state;
    const rows = AM.RECIPES.filter((r) => smith ? r.smith : !r.smith).map((r) => {
      const name = r.out.con ? `${AM.CONSUMABLES[r.out.con].name} ×${r.out.n}` : r.out.base ? `${AM.WEAPONS[r.out.base].name} (Lv ${S.level})` : `${AM.ARMOR[r.out.gear].name} (Lv ${S.level})`;
      const cost = Object.entries(r.cost).map(([k, v]) => `<span class="${(S.inv.mats[k] || 0) >= v ? 'ok' : 'no'}">${gem(AM.MATERIALS[k].color)}${v} ${AM.MATERIALS[k].name} (${S.inv.mats[k] || 0})</span>`).join('') + (r.gold ? `<span class="${S.gold >= r.gold ? 'ok' : 'no'}">${r.gold} gold</span>` : '');
      const can = AM.hasMats(S.inv, r.cost) && S.gold >= (r.gold || 0);
      return `<div class="recipe"><b>${name}</b><div class="cost">${cost}</div><button class="${can ? 'pri' : ''}" data-do="craft" data-id="${r.id}" ${can ? '' : 'disabled'}>Craft</button></div>`;
    }).join('');
    return `<p class="hint">${smith ? 'Forged gear is made at your level and is never common.' : 'Gear is forged by village Blacksmiths.'}</p><div class="recipes">${rows}</div>`;
  }
  function craftActions() {
    return {
      craft(t) {
        const r = AM.RECIPES.find((x) => x.id === t.dataset.id);
        const res = AM.craft(G.state.inv, r, { gold: G.state.gold, level: G.state.level, findPct: G.player.stats.findPct }, AM.makeRng((Math.random() * 1e9) | 0));
        if (!res.ok) { G.hud.toast(res.reason, 'bad'); return; }
        G.state.gold -= res.gold;
        G.hud.toast('Crafted ' + (res.made.con ? AM.CONSUMABLES[res.made.con].name : res.made.name), 'gold');
        G.audio.sfx('equip');
        U.refresh();
      },
    };
  }

  // =============== POWERS ===============
  U.screens.powers = {
    render(o, st) {
      const S = G.state, slots = G.player.stats.powerSlots;
      const learned = S.powers.learned;
      const sel = st.sel || S.powers.equipped[0] || learned[0];
      st.sel = sel;
      const spec = sel ? AM.powerSpec(sel) : null;
      const eq = [0, 1, 2, 3].map((i) => `<button class="pslot ${i >= slots ? 'locked' : ''} ${st.slot === i ? 'on' : ''}" data-do="slot" data-i="${i}"><small>${i + 1}</small>${S.powers.equipped[i] ? `<canvas width="52" height="52" data-icon="${S.powers.equipped[i]}"></canvas>` : i >= slots ? '<span>🔒</span>' : '<span>+</span>'}</button>`).join('');
      const list = learned.map((id) => `<button class="pw ${sel === id ? 'on' : ''}" data-do="sel" data-id="${id}"><canvas width="44" height="44" data-icon="${id}"></canvas><span>${esc(AM.powerSpec(id).name)}</span></button>`).join('');
      const fx = spec ? spec.effects.map((e) => AM.POWER_EFFECT_TEXT[e.type]).join(', ') : '';
      const det = spec ? `<div class="pdet"><canvas width="72" height="72" data-icon="${sel}"></canvas><div><b style="color:${spec.color}">${esc(spec.name)}</b><br><small>${spec.fused ? `Fusion · ${spec.combo}` : AM.ELEMENTS[spec.element].name} · ${spec.shape}</small></div></div>
        <p>${esc(spec.desc)}</p><div class="stats"><div><span>Damage</span><b>${spec.dmg ? AM.fmt(AM.powerDamage(G.player.stats, spec)) : '—'}</b></div><div><span>Energy</span><b>${spec.energy}</b></div><div><span>Cooldown</span><b>${(spec.cd * (1 - G.player.stats.cdr)).toFixed(1)}s</b></div><div><span>Effects</span><b>${fx || '—'}</b></div></div>
        <div class="btns">${[0, 1, 2, 3].filter((i) => i < slots).map((i) => `<button data-do="equip" data-i="${i}">Slot ${i + 1}</button>`).join('')}</div>` : '';
      return `<div class="panel wide">${head('Powers', `${learned.length} known · fuse powers at a Lab Keeper`)}
        <div class="pslots">${eq}</div><div class="cols2"><div class="pwgrid">${list}</div><div>${det}</div></div>
        <p class="hint">New powers come from skill-tree roots, quests, boss chests and Power Tomes. Slot 3 opens at level 5; slot 4 comes from the Overflow keystone or the Hollow Crown.</p></div>`;
    },
    after(o, st, el) { paintIcons(el); },
    actions: {
      sel(t, o, st) { st.sel = t.dataset.id; if (st.slot != null) { G.prog.equipPower(st.sel, st.slot); st.slot = null; } U.refresh(); },
      slot(t, o, st) { const i = +t.dataset.i; if (i >= G.player.stats.powerSlots) return; st.slot = st.slot === i ? null : i; U.refresh(); },
      equip(t, o, st) { G.prog.equipPower(st.sel, +t.dataset.i); U.refresh(); },
    },
  };

  // =============== SKILLS ===============
  U.screens.skills = {
    cls: 'full',
    render(o, st) {
      return `<div class="panel full">${head('Skill tree', `${G.state.points} point${G.state.points === 1 ? '' : 's'} to spend`)}
        <div class="treewrap"><canvas id="tree"></canvas><div id="nodeinfo" class="nodeinfo"></div></div>
        <p class="hint">Drag to pan, scroll or pinch to zoom. Buy a root to start a branch, then nodes connected to ones you own.</p></div>`;
    },
    after(o, st) { setupTree(st); },
    actions: {
      buy(t, o, st) { if (G.prog.buySkill(t.dataset.id)) { G.hud.toast('Learned ' + AM.SKILL_NODES[t.dataset.id].name, 'gold'); } else G.hud.toast('Not available', 'bad'); st.keepView = true; U.refresh(); },
    },
  };
  function setupTree(st) {
    const cv = document.getElementById('tree');
    const wrap = cv.parentElement;
    const W = wrap.clientWidth, H = wrap.clientHeight;
    const dpr = Math.min(2, root.devicePixelRatio || 1);
    cv.width = W * dpr; cv.height = H * dpr; cv.style.width = W + 'px'; cv.style.height = H + 'px';
    const ctx = cv.getContext('2d');
    if (!st.view || !st.keepView) st.view = { x: 0, y: 0, z: Math.min(W, H) / 900 };
    st.keepView = false;
    const v = st.view;
    const owned = G.state.nodes;
    const toS = (n) => [W / 2 + (n.x + v.x) * v.z, H / 2 + (n.y + v.y) * v.z];
    function draw() {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      ctx.lineWidth = 3;
      for (const [a, b] of AM.SKILL_EDGES) {
        const A = AM.SKILL_NODES[a], B = AM.SKILL_NODES[b];
        const [x1, y1] = toS(A), [x2, y2] = toS(B);
        ctx.strokeStyle = owned.has(a) && owned.has(b) ? '#ffe08a' : owned.has(a) || owned.has(b) ? 'rgba(255,224,138,0.45)' : 'rgba(255,255,255,0.14)';
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      }
      for (const B of AM.SKILL_BRANCHES) {
        const r = AM.SKILL_NODES[B.id + '.key'];
        const [x, y] = toS({ x: r.x * 1.13, y: r.y * 1.13 + 5 });
        ctx.fillStyle = B.color; ctx.font = `bold ${Math.max(10, 15 * v.z * 1.2)}px sans-serif`; ctx.textAlign = 'center'; ctx.fillText(B.name, x, y);
      }
      for (const n of Object.values(AM.SKILL_NODES)) {
        const [x, y] = toS(n);
        const r = (n.kind === 'keystone' ? 17 : n.kind === 'notable' ? 13 : n.kind === 'root' ? 15 : 9) * Math.max(0.7, v.z * 1.4);
        const can = AM.canBuySkill(owned, n.id, G.state.points);
        ctx.beginPath();
        if (n.kind === 'keystone') { for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); } ctx.closePath(); }
        else if (n.kind === 'notable') { ctx.moveTo(x, y - r); ctx.lineTo(x + r, y); ctx.lineTo(x, y + r); ctx.lineTo(x - r, y); ctx.closePath(); }
        else ctx.arc(x, y, r, 0, 7);
        ctx.fillStyle = owned.has(n.id) ? n.color : can ? AM.shade(n.color, -0.25) : '#2a2e3c';
        ctx.fill();
        ctx.lineWidth = st.selNode === n.id ? 4 : 2;
        ctx.strokeStyle = st.selNode === n.id ? '#fff' : can ? '#ffe08a' : 'rgba(255,255,255,0.3)';
        ctx.stroke();
      }
    }
    draw();
    const info = document.getElementById('nodeinfo');
    const showInfo = (id) => {
      if (!id) { info.style.display = 'none'; return; }
      const n = AM.SKILL_NODES[id];
      const modsText = n.desc || Object.entries(n.mods).map(([k, val]) => `${val > 0 ? '+' : ''}${Math.abs(val) < 1 && !['def', 'maxEnergy', 'powerSlots', 'dodgeCharges'].includes(k) ? Math.round(val * 100) + '%' : val} ${k.replace(/([A-Z])/g, ' $1').toLowerCase()}`).join(', ');
      const owns = owned.has(id), can = AM.canBuySkill(owned, id, G.state.points);
      info.innerHTML = `<b style="color:${n.color}">${n.name}</b> <small>${n.kind}${n.cost > 1 ? ` · ${n.cost} points` : ''}</small><p>${esc(modsText)}${n.power ? `<br>Grants the power <b>${AM.POWERS[n.power].name}</b>.` : ''}</p>${owns ? '<small>Owned</small>' : `<button class="${can ? 'pri' : ''}" data-do="buy" data-id="${id}" ${can ? '' : 'disabled'}>${can ? 'Learn' : G.state.points < n.cost ? 'Not enough points' : 'Not connected'}</button>`}`;
      info.style.display = 'block';
    };
    showInfo(st.selNode);
    let drag = null, pinchD = 0;
    const pick = (mx, my) => { let best = null, bd = 22; for (const n of Object.values(AM.SKILL_NODES)) { const [x, y] = toS(n); const d = Math.hypot(x - mx, y - my); if (d < bd) { bd = d; best = n.id; } } return best; };
    cv.onpointerdown = (e) => { cv.setPointerCapture(e.pointerId); drag = { x: e.clientX, y: e.clientY, moved: 0 }; };
    cv.onpointermove = (e) => { if (!drag) return; const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.moved += Math.abs(dx) + Math.abs(dy); v.x += dx / v.z; v.y += dy / v.z; drag.x = e.clientX; drag.y = e.clientY; draw(); };
    cv.onpointerup = (e) => { if (drag && drag.moved < 8) { const r = cv.getBoundingClientRect(); st.selNode = pick(e.clientX - r.left, e.clientY - r.top); showInfo(st.selNode); draw(); } drag = null; };
    cv.onwheel = (e) => { e.preventDefault(); v.z = AM.clamp(v.z * (e.deltaY > 0 ? 0.9 : 1.1), 0.3, 2.5); draw(); };
    cv.ontouchmove = (e) => { if (e.touches.length === 2) { drag = null; const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY); if (pinchD) { v.z = AM.clamp(v.z * d / pinchD, 0.3, 2.5); draw(); } pinchD = d; e.preventDefault(); } };
    cv.ontouchend = () => { pinchD = 0; };
  }

  // =============== MAP ===============
  U.screens.map = {
    cls: 'full',
    render(o, st) {
      const S = G.state;
      const wps = [...S.waypoints].map((id) => G.findStructure(id)).filter(Boolean);
      const cost = (s) => (o.teleport ? 0 : Math.round(10 * AM.LV(S.level) + AM.dist(s.x, s.z, G.player.x, G.player.z) / 40));
      return `<div class="panel full">${head(o.teleport ? 'Waypoint' : 'Map', o.teleport ? 'Teleport for free from a waypoint' : 'Teleporting from here costs gold')}
        <div class="mapwrap"><canvas id="map"></canvas><div class="wplist"><h3>Waypoints</h3>${wps.map((s) => `<button data-do="tp" data-id="${s.id}" ${G.mode === 'interior' && !o.teleport ? 'disabled' : ''}>${esc(s.name || 'Shrine')} <small>${Math.round(AM.dist(s.x, s.z, G.player.x, G.player.z))}m · ${cost(s) ? cost(s) + 'g' : 'free'}</small></button>`).join('') || '<small>Find villages and shrines to unlock waypoints.</small>'}
        <h3>Legend</h3><div class="legend"><span style="--c:#ffe08a">Village</span><span style="--c:#6fe3ff">Shrine</span><span style="--c:#ff5a5a">Dungeon</span><span style="--c:#aaa">Cave</span><span style="--c:#c8c0b0">Ruin</span><span style="--c:#d08a4a">Camp</span><span style="--c:#ffd23f">Quest</span></div></div></div></div>`;
    },
    after(o, st) { setupMap(o, st); },
    actions: {
      tp(t, o) {
        const s = G.findStructure(t.dataset.id);
        const c = o.teleport ? 0 : Math.round(10 * AM.LV(G.state.level) + AM.dist(s.x, s.z, G.player.x, G.player.z) / 40);
        if (G.state.gold < c) { G.hud.toast(`Teleporting costs ${c} gold`, 'bad'); return; }
        G.state.gold -= c;
        U.closeAll();
        G.teleportTo(s.id);
      },
    },
  };
  function setupMap(o, st) {
    const cv = document.getElementById('map');
    const wrap = cv.parentElement;
    const W = Math.max(200, wrap.clientWidth - (root.innerWidth > 700 ? 230 : 0)), H = wrap.clientHeight;
    const dpr = Math.min(2, root.devicePixelRatio || 1);
    cv.width = W * dpr; cv.height = H * dpr; cv.style.width = W + 'px'; cv.style.height = H + 'px';
    const ctx = cv.getContext('2d');
    const p = G.player, S = G.state;
    if (!st.view) st.view = { x: p.x, z: p.z, s: 1.4 };
    const v = st.view;
    const biomeCol = {};
    function draw() {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = '#0e1220'; ctx.fillRect(0, 0, W, H);
      const C = AM.CHUNK, s = v.s;
      const minCx = Math.floor((v.x - W / 2 / s) / C) - 1, maxCx = Math.floor((v.x + W / 2 / s) / C) + 1;
      const minCz = Math.floor((v.z - H / 2 / s) / C) - 1, maxCz = Math.floor((v.z + H / 2 / s) / C) + 1;
      const cell = C * s / 4;
      for (let cz = minCz; cz <= maxCz; cz++) for (let cx = minCx; cx <= maxCx; cx++) {
        if (!S.explored.has(cx + ',' + cz)) continue;
        for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) {
          const wx = cx * C + (i + 0.5) * C / 4, wz = cz * C + (j + 0.5) * C / 4;
          const key = Math.round(wx) + ',' + Math.round(wz);
          let col = biomeCol[key];
          if (!col) { const w = G.world.rawWater(wx, wz); const b = AM.BIOMES[G.world.biomeAt(wx, wz)]; col = w === 2 ? (b.id === 'volcanic' ? '#ff6a1f' : '#2a6aa8') : w === 1 ? '#5aa8d0' : b.ground[0]; biomeCol[key] = col; }
          ctx.fillStyle = col;
          ctx.fillRect(W / 2 + (cx * C + i * C / 4 - v.x) * s, H / 2 + (cz * C + j * C / 4 - v.z) * s, cell + 0.6, cell + 0.6);
        }
      }
      const R = Math.max(W, H) / s;
      for (const st2 of G.world.structuresNear(v.x, v.z, R)) {
        if (!S.discovered.has(st2.id)) continue;
        const col = { village: '#ffe08a', ruin: '#c8c0b0', cave: '#aaaaaa', dungeon: S.cleared.has(st2.id) ? '#7a5050' : '#ff5a5a', camp: '#d08a4a', chest: '#f2c14e', shrine: '#6fe3ff' }[st2.type];
        const x = W / 2 + (st2.x - v.x) * s, y = H / 2 + (st2.z - v.z) * s;
        ctx.fillStyle = '#000'; ctx.fillRect(x - 5, y - 5, 10, 10); ctx.fillStyle = col; ctx.fillRect(x - 4, y - 4, 8, 8);
        if (st2.type === 'village' || st2.type === 'dungeon') { ctx.fillStyle = '#fff'; ctx.font = '12px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(st2.name + (st2.type === 'dungeon' ? ` (${st2.level})` : ''), x, y - 9); }
      }
      for (const q of S.quests.active) if (q.x != null && !q.done) { const x = W / 2 + (q.x - v.x) * s, y = H / 2 + (q.z - v.z) * s; ctx.fillStyle = '#ffd23f'; ctx.beginPath(); ctx.arc(x, y, 7, 0, 7); ctx.fill(); ctx.strokeStyle = '#000'; ctx.lineWidth = 2; ctx.stroke(); }
      const px = W / 2 + (p.x - v.x) * s, py = H / 2 + (p.z - v.z) * s;
      ctx.save(); ctx.translate(px, py); ctx.rotate(Math.PI - p.yaw);
      ctx.fillStyle = '#fff'; ctx.strokeStyle = '#000'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, -10); ctx.lineTo(7, 7); ctx.lineTo(0, 3); ctx.lineTo(-7, 7); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
      ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.font = '11px sans-serif'; ctx.textAlign = 'left'; ctx.fillText('N ↑   (map is north-up)', 8, H - 10);
    }
    draw();
    let drag = null, pinchD = 0;
    cv.onpointerdown = (e) => { cv.setPointerCapture(e.pointerId); drag = { x: e.clientX, y: e.clientY }; };
    cv.onpointermove = (e) => { if (!drag) return; v.x -= (e.clientX - drag.x) / v.s; v.z -= (e.clientY - drag.y) / v.s; drag.x = e.clientX; drag.y = e.clientY; draw(); };
    cv.onpointerup = () => { drag = null; };
    cv.onwheel = (e) => { e.preventDefault(); v.s = AM.clamp(v.s * (e.deltaY > 0 ? 0.85 : 1.15), 0.15, 5); draw(); };
    cv.ontouchmove = (e) => { if (e.touches.length === 2) { drag = null; const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY); if (pinchD) { v.s = AM.clamp(v.s * d / pinchD, 0.15, 5); draw(); } pinchD = d; e.preventDefault(); } };
    cv.ontouchend = () => { pinchD = 0; };
  }

  // =============== QUESTS ===============
  function questRow(q, btns) {
    const r = q.reward;
    return `<div class="quest ${q.done ? 'done' : ''}"><div><b>${esc(q.title)}</b> <small>${esc(q.villageName || '')}</small><p>${esc(q.desc)}</p>
      <small>Reward: ${r.xp} XP · ${r.gold} gold · ${r.essence} essence${r.dna ? ' · DNA' : ''}${r.item ? ' · item' : ''}</small></div>
      <div class="qside"><span>${q.done ? '✔ Done' : `${q.have}/${q.need}`}</span>${btns || ''}</div></div>`;
  }
  U.screens.quests = {
    render(o, st) {
      st.tab = st.tab || 'quests';
      const S = G.state;
      let body;
      if (st.tab === 'quests') body = S.quests.active.length ? S.quests.active.map((q, i) => questRow(q, `<button data-do="track" data-i="${i}">${q.tracked ? '★ Tracked' : 'Track'}</button><button class="danger" data-do="abandon" data-i="${i}">Abandon</button>`)).join('') : '<p>No quests. Village Elders offer new ones every day.</p>';
      else body = `<div class="goals">${AM.GOALS.map((g) => `<div class="goal ${S.goalsDone.has(g.id) ? 'done' : ''}"><b>${S.goalsDone.has(g.id) ? '✔' : '○'} ${g.title}</b>${g.hint ? `<small>${g.hint}</small>` : ''}</div>`).join('')}</div>`;
      return `<div class="panel wide">${head('Quests')}${tabs([['quests', `Active (${S.quests.active.length}/5)`], ['goals', `Goals (${S.goalsDone.size}/${AM.GOALS.length})`]], st.tab)}${body}</div>`;
    },
    actions: {
      tab(t, o, st) { st.tab = t.dataset.tab; U.refresh(); },
      track(t) { const qs = G.state.quests.active; qs.forEach((q, i) => { q.tracked = i === +t.dataset.i; }); U.refresh(); },
      abandon(t) { const q = G.state.quests.active[+t.dataset.i]; U.confirm(`Abandon "${q.title}"?`, () => { G.prog.abandon(q); U.refresh(); }); },
    },
  };

  // =============== ELDER ===============
  U.screens.elder = {
    render(o) {
      const S = G.state, v = o.village;
      const locked = AM.BASE_IDS.filter((id) => !S.unlocked.has(id));
      const offers = AM.villageQuests(G.world, v, S.day, S.level, locked).filter((q) => !S.quests.done.has(q.id) && !S.quests.active.some((a) => a.id === q.id));
      const done = S.quests.active.filter((q) => q.done);
      return `<div class="panel wide">${head(`Elder of ${esc(v.name)}`, `Village level ${v.level}`)}
        <p class="npc">"${esc(elderLine(v))}"</p>
        ${done.length ? `<h3>Completed</h3>${done.map((q) => questRow(q, `<button class="pri" data-do="turnin" data-id="${q.id}">Claim reward</button>`)).join('')}` : ''}
        <h3>Today's requests</h3>${offers.length ? offers.map((q) => questRow(q, `<button class="pri" data-do="accept" data-id="${q.id}">Accept</button>`)).join('') : '<p>Nothing more today. Come back tomorrow.</p>'}</div>`;
    },
    actions: {
      accept(t, o) { const S = G.state; const q = AM.villageQuests(G.world, o.village, S.day, S.level, AM.BASE_IDS.filter((id) => !S.unlocked.has(id))).find((x) => x.id === t.dataset.id); if (q) G.prog.acceptQuest(q); U.refresh(); },
      turnin(t) { const q = G.state.quests.active.find((x) => x.id === t.dataset.id); if (q) G.prog.turnIn(q); U.refresh(); },
    },
  };
  function elderLine(v) {
    const lines = ['The wilds grow stranger the farther you roam from here.', 'Creatures out there are fused like you, but they lost their minds in the blending.', 'Bring back DNA and the Lab Keeper can give you a new body.', 'Dungeons hold the strongest beasts, and the richest chests.', 'At night the wild ones grow bolder. Carry a light if you can.'];
    return lines[AM.hashStr(v.id + G.state.day) % lines.length];
  }

  // =============== SHOP ===============
  function shopStock(v) {
    const S = G.state;
    const rng = AM.makeRng(AM.hash2(v.seed, S.day, 0x5409));
    const items = [];
    for (let i = 0; i < 6; i++) items.push(AM.rollItem(rng, { ilvl: Math.max(v.level, S.level - 1), minTier: i < 2 ? 1 : 0 }));
    return items;
  }
  U.screens.shop = {
    render(o, st) {
      st.tab = st.tab || 'buy';
      const S = G.state, v = o.village;
      const disc = 1 - (G.player.stats.shopDiscount || 0);
      let body;
      if (st.tab === 'buy') {
        if (!st.stock || st.day !== S.day) { st.stock = shopStock(v); st.day = S.day; st.bought = new Set(); }
        const cons = ['potion', 'tonic', 'tea', 'haste', 'recall', 'tome'].map((k) => { const C = AM.CONSUMABLES[k]; const price = Math.round(C.value * AM.LV(Math.max(1, v.level * 0.5)) * disc); return `<div class="recipe"><b>${gem(C.color)}${C.name}</b><small>${C.desc}</small><button data-do="buycon" data-id="${k}" data-p="${price}">${price}g</button></div>`; }).join('');
        const gear = st.stock.map((it, i) => st.bought.has(i) ? '' : `<div class="recipe"><img src="${iconOf(it)}" alt=""><b style="color:${AM.RARITY[it.rarity].color}">${esc(it.name)}</b><small>${AM.itemLines(it).slice(0, 3).join(' · ')}</small><button data-do="buyitem" data-i="${i}">${Math.round(AM.buyValue(it) * disc)}g</button></div>`).join('');
        body = `<h3>Supplies</h3><div class="recipes">${cons}</div><h3>Gear (changes every day)</h3><div class="recipes">${gear || '<p>Sold out.</p>'}</div>`;
      } else {
        const items = S.inv.items;
        body = `<div class="toolbar"><button data-do="selljunk">Sell all unfavourited commons</button></div><div class="recipes">${items.map((it, i) => `<div class="recipe"><img src="${iconOf(it)}" alt=""><b style="color:${AM.RARITY[it.rarity].color}">${it.fav ? '★ ' : ''}${esc(AM.displayName(it))}</b><small>${AM.itemLines(it).slice(0, 2).join(' · ')}</small><button data-do="sellitem" data-i="${i}">${AM.sellValue(it)}g</button></div>`).join('') || '<p>Nothing to sell.</p>'}</div>`;
      }
      return `<div class="panel wide">${head(`Merchant of ${esc(v.name)}`, `${AM.fmt(S.gold)} gold`)}${tabs([['buy', 'Buy'], ['sell', 'Sell']], st.tab)}${body}</div>`;
    },
    actions: {
      tab(t, o, st) { st.tab = t.dataset.tab; U.refresh(); },
      buycon(t) { const p = +t.dataset.p; if (G.state.gold < p) { G.hud.toast('Not enough gold', 'bad'); return; } G.state.gold -= p; G.state.inv.cons[t.dataset.id] = (G.state.inv.cons[t.dataset.id] || 0) + 1; G.audio.sfx('coin'); U.refresh(); },
      buyitem(t, o, st) { const i = +t.dataset.i, it = st.stock[i]; const p = Math.round(AM.buyValue(it) * (1 - (G.player.stats.shopDiscount || 0))); if (G.state.gold < p) { G.hud.toast('Not enough gold', 'bad'); return; } if (!AM.addItem(G.state.inv, it)) { G.hud.toast('Inventory full', 'bad'); return; } G.state.gold -= p; st.bought.add(i); G.audio.sfx('coin'); U.refresh(); },
      sellitem(t) { const it = G.state.inv.items[+t.dataset.i]; if (!it) return; const doIt = () => { G.prog.sell(it); U.refresh(); }; if (AM.RARITY[it.rarity].tier >= 3 || it.fav) U.confirm(`Sell ${it.name}?`, doIt); else doIt(); },
      selljunk() { let g = 0; for (const it of G.state.inv.items.filter((x) => x.rarity === 'common' && !x.fav)) g += G.prog.sell(it); G.hud.toast(g ? `Sold for ${g} gold` : 'Nothing to sell', 'info'); U.refresh(); },
    },
  };

  // =============== SMITH ===============
  U.screens.smith = {
    render(o, st) {
      st.tab = st.tab || 'craft';
      const S = G.state;
      let body;
      if (st.tab === 'craft') body = craftList(true);
      else {
        const all = AM.GEAR_SLOTS.map((k) => S.equipment[k]).filter(Boolean).concat(S.inv.items);
        const sel = all.find((x) => x.uid === st.sel);
        let up = '<p class="hint">Select an item to upgrade (equipped items are listed first).</p>';
        if (sel) {
          const c = AM.upgradeCost(sel);
          const can = (sel.plus || 0) < AM.MAX_PLUS && AM.hasMats(S.inv, c.mats) && S.gold >= c.gold;
          up = `${itemDetail(sel).replace(/<div class="btns">[\s\S]*?<\/div><\/div>$/, '</div>')}<p>Upgrade to +${(sel.plus || 0) + 1}: ${Object.entries(c.mats).map(([k, v]) => `${gem(AM.MATERIALS[k].color)}${v} ${AM.MATERIALS[k].name} (${S.inv.mats[k] || 0})`).join(' · ')} · ${c.gold} gold</p>
            <div class="btns"><button class="${can ? 'pri' : ''}" data-do="upgrade" ${can ? '' : 'disabled'}>${(sel.plus || 0) >= AM.MAX_PLUS ? 'Maximum level' : 'Upgrade (+8% stats)'}</button></div>`;
        }
        body = `<div class="cols2"><div class="recipes">${all.map((it) => `<button class="recipe sel ${st.sel === it.uid ? 'on' : ''}" data-do="pick" data-uid="${it.uid}"><img src="${iconOf(it)}" alt=""><b style="color:${AM.RARITY[it.rarity].color}">${esc(AM.displayName(it))}</b>${S.equipment[it.slot] === it ? '<small>equipped</small>' : ''}</button>`).join('')}</div><div>${up}</div></div>`;
      }
      return `<div class="panel wide">${head('Blacksmith', `${AM.fmt(S.gold)} gold`)}${tabs([['craft', 'Forge'], ['upgrade', 'Upgrade']], st.tab)}${body}</div>`;
    },
    actions: Object.assign({
      tab(t, o, st) { st.tab = t.dataset.tab; U.refresh(); },
      pick(t, o, st) { st.sel = t.dataset.uid; U.refresh(); },
      upgrade(t, o, st) {
        const S = G.state;
        const all = AM.GEAR_SLOTS.map((k) => S.equipment[k]).filter(Boolean).concat(S.inv.items);
        const it = all.find((x) => x.uid === st.sel);
        if (!it) return;
        const c = AM.upgradeCost(it);
        if (!AM.hasMats(S.inv, c.mats) || S.gold < c.gold || (it.plus || 0) >= AM.MAX_PLUS) return;
        AM.takeMats(S.inv, c.mats); S.gold -= c.gold; it.plus = (it.plus || 0) + 1;
        G.refreshPlayer(); G.audio.sfx('equip'); G.hud.toast(`${it.name} is now +${it.plus}`, 'gold');
        U.refresh();
      },
    }, craftActions()),
  };

  // =============== SETTINGS ===============
  const SET_DEFS = {
    graphics: [
      ['preset', 'Quality preset', 'select', ['auto', 'low', 'medium', 'high', 'ultra']],
      ['renderScale', 'Render scale', 'range', [0.5, 1, 0.05]],
      ['dynRes', 'Dynamic resolution (keeps FPS steady)', 'check'],
      ['shadows', 'Shadows', 'select', ['off', 'low', 'high'], true],
      ['viewDist', 'View distance (chunks)', 'select', [2, 3, 4, 5], true],
      ['particles', 'Particles', 'select', ['low', 'medium', 'high', 'ultra'], true],
      ['maxCreatures', 'Max wild creatures', 'range', [8, 50, 1]],
      ['antialias', 'Antialiasing', 'check', null, true],
      ['dprCap', 'Pixel density cap', 'select', [1, 1.25, 1.5, 2], false],
      ['fpsCap', 'FPS limit', 'select', [30, 60, 120, 0]],
      ['showFps', 'Show FPS and draw calls', 'check'],
    ],
    audio: [['volMaster', 'Master volume', 'range', [0, 1, 0.05]], ['volMusic', 'Music', 'range', [0, 1, 0.05]], ['volSfx', 'Effects', 'range', [0, 1, 0.05]]],
    gameplay: [
      ['autoAim', 'Auto-aim on touch and gamepad', 'check'], ['autoLoot', 'Auto-loot (pickups fly to you from farther)', 'check'],
      ['damageNumbers', 'Damage numbers', 'check'], ['shake', 'Screen shake', 'check'], ['camRotate', 'Allow camera rotation (Z/X)', 'check'],
      ['uiScale', 'Interface size', 'range', [0.75, 1.4, 0.05]], ['touchControls', 'Touch controls', 'select', ['auto', 'on', 'off']],
      ['leftHanded', 'Left-handed touch layout', 'check'], ['btnSize', 'Touch button size', 'range', [0.7, 1.4, 0.05]], ['btnOpacity', 'Touch button opacity', 'range', [0.3, 1, 0.05]],
    ],
  };
  U.screens.settings = {
    render(o, st) {
      st.tab = st.tab || 'graphics';
      const s = G.settings;
      let body;
      if (st.tab === 'controls') {
        body = `<div class="controls"><div><h3>Keyboard & mouse</h3><ul>
          <li><b>WASD / arrows</b> move</li><li><b>Left click / L</b> attack (hold to keep attacking)</li><li><b>Mouse</b> aim</li>
          <li><b>Space / Shift / right click</b> dodge roll</li><li><b>1–4 or Q E R T</b> powers</li><li><b>F</b> interact · <b>H</b> potion</li>
          <li><b>Z / X</b> rotate camera · <b>wheel / − =</b> zoom</li><li><b>I</b> inventory · <b>P</b> powers · <b>K</b> skills · <b>M / Tab</b> map · <b>J</b> quests · <b>Esc</b> pause</li></ul></div>
          <div><h3>Touch</h3><ul><li>Left side: floating joystick</li><li>Big button: attack (hold)</li><li>Power buttons: tap to auto-aim, or drag to aim and release</li><li>Pinch to zoom</li></ul>
          <h3>Gamepad</h3><ul><li>Left stick move · right stick aim</li><li>A attack · B dodge · X interact · Y potion</li><li>LB RB LT RT powers · Start pause · Back map · D-pad camera/zoom</li></ul></div></div>`;
      } else if (st.tab === 'saves') {
        body = G.state ? `<p>Your game saves automatically every minute, when you level up, enter or leave places, and when you leave the tab.</p>
          <div class="btns"><button class="pri" data-do="savenow">Save now</button><button data-do="export">Export save code</button></div>` : '<p>Load or start a game to manage its save. Saves can also be exported from the Load screen.</p>';
      } else {
        body = SET_DEFS[st.tab].map(([k, label, type, arg, restart]) => {
          const val = s[k];
          let ctl;
          if (type === 'check') ctl = `<input type="checkbox" data-k="${k}" ${val ? 'checked' : ''}>`;
          else if (type === 'range') ctl = `<input type="range" data-k="${k}" min="${arg[0]}" max="${arg[1]}" step="${arg[2]}" value="${val}"><output>${typeof val === 'number' && val <= 2 ? Math.round(val * 100) + '%' : val}</output>`;
          else ctl = `<select data-k="${k}">${arg.map((x) => `<option value="${x}" ${String(x) === String(val) ? 'selected' : ''}>${x === 0 ? 'unlimited' : x}</option>`).join('')}</select>`;
          return `<label class="set">${label}${restart ? ' <small>(restart)</small>' : ''}${ctl}</label>`;
        }).join('');
        if (st.tab === 'graphics') body += `<p class="hint">Settings marked "restart" apply after reloading. ${st.dirty ? '<button class="pri" data-do="reload">Save & reload now</button>' : ''}</p>`;
      }
      return `<div class="panel wide">${head('Settings')}${tabs([['graphics', 'Graphics'], ['audio', 'Audio'], ['gameplay', 'Gameplay'], ['controls', 'Controls'], ['saves', 'Saves']], st.tab)}<div class="sets">${body}</div></div>`;
    },
    onInput(t, o, st) {
      const k = t.dataset.k;
      if (!k) return;
      const s = G.settings;
      let v = t.type === 'checkbox' ? t.checked : t.type === 'range' ? parseFloat(t.value) : t.value;
      if (typeof s[k] === 'number' && t.tagName === 'SELECT') v = parseFloat(v);
      if (k === 'preset') {
        s.preset = v;
        const p = v === 'auto' ? G.PRESETS[(G.isMobile() ? 'low' : 'high')] : G.PRESETS[v];
        Object.assign(s, p);
        st.dirty = true;
      } else {
        s[k] = v;
        const def = SET_DEFS[st.tab].find((d) => d[0] === k);
        if (def && def[4]) st.dirty = true;
        if (k !== 'preset' && st.tab === 'graphics') s.preset = 'custom';
      }
      if (k === 'particles') G.fx.setMul(v === 'low' ? 0.5 : v === 'medium' ? 0.8 : 1);
      G.applySettings();
      if (t.type === 'range' && t.nextElementSibling) t.nextElementSibling.textContent = v <= 2 ? Math.round(v * 100) + '%' : v;
      if (t.type !== 'range') U.refresh();
    },
    actions: {
      tab(t, o, st) { st.tab = t.dataset.tab; U.refresh(); },
      reload() { if (G.state) { G.save(); try { sessionStorage.setItem('amalgamations.resume', String(G.state.slot)); } catch (e) { /* ignore */ } } location.reload(); },
      savenow() { G.hud.toast(G.save() ? 'Game saved' : 'Saving failed', 'info'); },
      export() { G.save(); U.open('text', { title: 'Save code', text: AM.exportCode(G.state) }); },
    },
  };

  // =============== MISC ===============
  U.screens.death = {
    render() { return `<div class="panel narrow death"><h2>You fell</h2><p>Your amalgam dissolves… and reforms in the last village you visited. You will lose 10% of your gold.</p><div class="btns"><button class="pri big" data-do="respawn">Rise again</button></div></div>`; },
    actions: { respawn() { U.closeAll(); G.respawn(); } },
  };
  const LORE = [
    'Before the Blending, every creature had one shape. Then the Rift opened and the world began to stitch itself together.',
    'The Lab Keepers learned to guide the Blending. Wild amalgams were not so lucky.',
    'They say a fusion of every base exists somewhere far beyond the volcanic wastes.',
    'The first fused power was born when a frightened child threw fire and frost at once.',
    'Dungeons are wounds where the Rift still bleeds. The beasts inside grow strong on it.',
    'Waypoint crystals hum to each other across any distance. Touch one and you can follow the song.',
    'A Treasure Chest that bites is still a treasure chest, the merchants insist.',
    'Stay near the light. At night, the wild ones remember what they were.',
  ];
  U.screens.lore = {
    render(o) { return `<div class="panel narrow">${head('Ancient tablet')}<p class="lore">"${LORE[o.seed % LORE.length]}"</p></div>`; },
  };
  U.screens.howto = {
    render() {
      return `<div class="panel wide">${head('How to play')}
        <div class="cols2"><div><h3>Become an amalgam</h3><p>Choose a mother and a father in the Fusion Lab: you play as their fusion, with both their traits. Wild creatures drop <b>DNA</b>: collect enough to unlock new bases, then take a new form at any village <b>Lab Keeper</b>.</p>
        <h3>Fight</h3><p>Attack, dodge-roll through attacks (you are untouchable while rolling) and cast up to four powers. Red markings on the ground show where enemies are about to strike.</p>
        <h3>Fuse powers</h3><p>At a Lab Keeper, fuse two powers: the first decides how it travels, the second what happens when it lands. Their elements combine too (fire + frost = Steam).</p></div>
        <div><h3>Grow</h3><p>Levels give skill points for the six-branch tree. Gear drops with random bonuses; Blacksmiths forge and upgrade it.</p>
        <h3>Explore</h3><p>The world never ends. The farther from Hearthmoor, the higher the danger level and the better the loot. Villages have waypoints, caves have ore and treasure, dungeons have bosses.</p>
        <h3>Tips</h3><ul><li>Night makes creatures one level stronger.</li><li>Elites (★) and bosses drop the most DNA.</li><li>Hover creatures can fly over deep water.</li><li>Use Settings → Graphics if the game runs slowly.</li></ul></div></div></div>`;
    },
  };

  AM.UI = U;
})(typeof window !== 'undefined' ? window : globalThis);
