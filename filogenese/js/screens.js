/* Filogênese — telas: menu, novo jogo, saves, configurações, pausa, objetivos, Filopédia, mapa, ajuda, morte, final e conquistas. */
(function (FG) {
  'use strict';
  const U = FG.U, G = FG.Game, UI = FG.UI, Parts = FG.Parts, S = FG.Settings, Draw = FG.Draw;
  const T = (k, a, b) => FG.T(k, a, b);
  const ic = UI.ic, esc = UI.esc;
  const SLOTS = 3;
  const btn = (act, label, cls, icon, attr) => `<button class="btn ${cls || ''}" data-act="${act}" type="button" ${attr || ''}>${icon ? ic(icon) : ''}<span>${esc(label)}</span></button>`;
  const dietIcon = (d) => (d === 'H' ? 'leaf' : d === 'C' ? 'meat' : 'mouth');
  const dietTag = (d) => `<span class="tag ${d}">${ic(dietIcon(d))}${esc(T('diet.' + d))}</span>`;

  function latestSlot() {
    let best = -1, bt = 0;
    for (let i = 0; i < SLOTS; i++) { const s = G.slotInfo(i); if (s && (s.saved || 1) > bt) { bt = s.saved || 1; best = i; } }
    return best;
  }
  function randName() {
    const a = ['Nu', 'Oka', 'Vel', 'Tari', 'Mo', 'Zu', 'Ae', 'Kip', 'Lor', 'Sy', 'Bra', 'Ix', 'Yum', 'Qua', 'Dre', 'Fen'], b = ['va', 'ri', 'lo', 'me', 'tu', 'xi', 'na', 'ko', 'la', ''], c = ['lis', 'rus', 'dax', 'nix', 'mon', 'tor', 'pha', 'lia', 'ops', 'ura'];
    const p = (x) => x[(Math.random() * x.length) | 0];
    return p(a) + p(b) + p(c);
  }
  function slotLine(s) {
    return s ? `${T('ui.level')} ${s.level} · ${T('ui.gen')} ${s.gen} · ${U.fmtTime(s.time || 0)}${s.won ? ' · ★' : ''}` : T('ui.empty');
  }
  function drawSlotPortrait(cv, s) {
    if (!s || !s.genome) return;
    try { Draw.portrait(cv, FG.Species.makePlayer(s.name, s.genome, s.level), { angle: -0.6, fit: 0.9 }); } catch (e) { /* save antigo */ }
  }

  // ---------- menu ----------
  UI.register('menu', {
    dismiss: false, cls: 'clear',
    build(root) {
      const li = latestSlot(), last = li >= 0 ? G.slotInfo(li) : null;
      root.innerHTML = `<div class="menu-wrap">
        <h1 class="logo">Filo<i>gênese</i></h1>
        <p class="tagline">${esc(T('m.tagline'))}</p>
        <div class="menu-btns">
          ${last ? btn('cont', T('m.continue') + ' · ' + last.name, 'mint', 'play') : ''}
          ${btn('new', T('m.new'), last ? 'ghost' : '', 'egg')}
          ${last ? btn('load', T('m.load'), 'ghost', 'book') : ''}
          ${btn('settings', T('m.settings'), 'ghost', 'gear')}
          ${btn('ach', T('m.ach'), 'ghost', 'trophy')}
          ${btn('help', T('m.help'), 'ghost', 'info')}
        </div>
        <div class="menu-foot">
          <button class="chip" data-act="lang" type="button">${FG.lang === 'pt' ? 'Português' : 'English'}</button>
          <button class="chip" data-act="full" type="button" title="${esc(T('ui.fullscreen'))}">${ic('full')}</button>
          <a href="../index.html">${esc(T('m.back'))}</a>
        </div></div><span class="ver">v1.0</span>`;
      UI.acts(root, {
        cont: () => FG.Main.loadSlot(li),
        new: () => UI.open('newgame'),
        load: () => UI.open('load'),
        settings: () => UI.open('settings'),
        ach: () => UI.open('ach'),
        help: () => UI.open('help'),
        lang: () => { FG.setLang(FG.lang === 'pt' ? 'en' : 'pt'); S.set('lang', FG.lang); UI.applyLang(); UI.refresh('menu'); },
        full: () => FG.Main.fullscreen(),
      });
    },
  });

  // ---------- novo jogo ----------
  UI.register('newgame', {
    build(root, d) {
      if (d.slot == null) { d.slot = 0; for (let i = 0; i < SLOTS; i++) if (!G.slotInfo(i)) { d.slot = i; break; } d.name = randName(); d.diet = 'O'; d.diff = 'normal'; d.seed = (Math.random() * 999999) | 0; }
      let slots = '';
      for (let i = 0; i < SLOTS; i++) { const s = G.slotInfo(i); slots += `<button class="chip ${d.slot === i ? 'on' : ''}" data-act="slot" data-i="${i}" type="button">${i + 1} · ${s ? esc(s.name) : esc(T('ui.empty'))}</button>`; }
      const diets = ['H', 'O', 'C'].map((k) => `<button class="diet ${d.diet === k ? 'on' : ''}" data-act="diet" data-k="${k}" type="button"><canvas width="220" height="170" data-diet="${k}"></canvas><b>${esc(T('diet.' + k))}</b><small>${esc(T('diet.' + k + '.d'))}</small></button>`).join('');
      const diffs = ['easy', 'normal', 'hard'].map((k) => `<button class="chip ${d.diff === k ? 'on' : ''}" data-act="diff" data-k="${k}" type="button">${esc(T('diff.' + k))}</button>`).join('');
      root.innerHTML = UI.card(T('m.new'), `
        <div class="field"><span>${esc(T('ng.slot'))}</span><div class="chips">${slots}</div></div>
        <div class="field"><span>${esc(T('ng.name'))}</span><div style="display:flex;gap:8px"><input type="text" id="ngName" maxlength="18" value="${esc(d.name)}" autocomplete="off" spellcheck="false">${btn('rname', T('ng.random'), 'ghost small')}</div></div>
        <div class="field"><span>${esc(T('ng.diet'))}</span><div class="diets">${diets}</div></div>
        <div class="field"><span>${esc(T('ng.diff'))}</span><div class="chips">${diffs}</div><small class="dim">${esc(T('diff.' + d.diff + '.d'))}</small></div>
        <div class="field"><span>${esc(T('ng.seed'))}</span><div style="display:flex;gap:8px"><input type="number" id="ngSeed" value="${d.seed}" min="0" max="999999999">${btn('rseed', T('ng.random'), 'ghost small')}</div><small class="dim">${esc(T('ng.seed.d'))}</small></div>`,
        btn('close', T('ui.back'), 'ghost') + btn('go', T('ng.create'), 'mint', 'dna'));
      root.querySelectorAll('canvas[data-diet]').forEach((cv) => Draw.portrait(cv, FG.Species.makePlayer('x', Parts.starterGenome(cv.dataset.diet, d.seed + 3), 1), { angle: -0.5, fit: 1.25 }));
      const sync = () => { d.name = root.querySelector('#ngName').value.trim().slice(0, 18) || randName(); d.seed = Math.abs(parseInt(root.querySelector('#ngSeed').value, 10) || 0) % 1000000000; };
      root.querySelector('#ngName').addEventListener('input', sync); root.querySelector('#ngSeed').addEventListener('input', sync);
      const re = () => UI.refresh('newgame');
      UI.acts(root, {
        slot: (b) => { sync(); d.slot = +b.dataset.i; re(); },
        diet: (b) => { sync(); d.diet = b.dataset.k; re(); },
        diff: (b) => { sync(); d.diff = b.dataset.k; re(); },
        rname: () => { d.name = randName(); re(); },
        rseed: () => { sync(); d.seed = (Math.random() * 999999) | 0; re(); },
        go: () => {
          sync();
          const go = () => UI.fade(() => UI.open('editor', { mode: 'create', genome: Parts.starterGenome(d.diet, d.seed + 3), name: d.name, budget: 30, setup: d }));
          if (G.slotInfo(d.slot)) UI.open('confirm', { text: T('ng.overwrite'), yes: go }); else go();
        },
      });
    },
  });

  // ---------- carregar ----------
  UI.register('load', {
    build(root) {
      let h = '';
      for (let i = 0; i < SLOTS; i++) {
        const s = G.slotInfo(i);
        h += `<div class="slot ${s ? '' : 'empty'}"><canvas width="144" height="144" data-slot="${i}"></canvas><div class="inf"><b>${s ? esc(s.name) : esc(T('ui.slot') + ' ' + (i + 1))}</b><span>${esc(slotLine(s))}</span>${s && s.saved ? `<br><span>${new Date(s.saved).toLocaleString(FG.lang === 'pt' ? 'pt-BR' : 'en')}</span>` : ''}</div>
          <div class="acts">${s ? btn('play', T('ui.play'), 'mint small', 'play', `data-i="${i}"`) + btn('del', T('ui.delete'), 'ghost small', null, `data-i="${i}"`) : ''}</div></div>`;
      }
      root.innerHTML = UI.card(T('m.load'), h, btn('close', T('ui.back'), 'ghost'));
      root.querySelectorAll('canvas[data-slot]').forEach((cv) => drawSlotPortrait(cv, G.slotInfo(+cv.dataset.slot)));
      UI.acts(root, {
        play: (b) => FG.Main.loadSlot(+b.dataset.i),
        del: (b) => UI.open('confirm', { text: T('ui.deleteQ'), yes: () => { G.deleteSlot(+b.dataset.i); UI.refresh('load'); UI.refresh('menu'); } }),
      });
    },
  });

  // ---------- configurações ----------
  UI.register('settings', {
    build(root) {
      const d = S.data;
      const row = (k, ctl, sub) => `<div class="set-row"><label>${esc(T('s.' + k))}${sub ? `<small>${esc(T('s.' + k + '.d'))}</small>` : ''}</label><div class="ctl">${ctl}</div></div>`;
      const sl = (k, min, max, step) => row(k, `<input type="range" data-k="${k}" min="${min}" max="${max}" step="${step}" value="${d[k]}" aria-label="${esc(T('s.' + k))}">`);
      const tg = (k, sub) => row(k, `<button class="tog ${d[k] ? 'on' : ''}" data-tog="${k}" type="button" role="switch" aria-checked="${!!d[k]}" aria-label="${esc(T('s.' + k))}"></button>`, sub);
      const sel = (k, opts, sub) => row(k, `<select data-k="${k}" aria-label="${esc(T('s.' + k))}">${opts.map((o) => `<option value="${o}" ${String(d[k]) === o ? 'selected' : ''}>${esc(T('s.' + k + '.' + o))}</option>`).join('')}</select>`, sub);
      root.innerHTML = UI.card(T('m.settings'), `
        <h3>${esc(T('s.h.audio'))}</h3>${sl('master', 0, 1, 0.05)}${sl('music', 0, 1, 0.05)}${sl('sfx', 0, 1, 0.05)}${sl('ambience', 0, 1, 0.05)}
        <h3>${esc(T('s.h.video'))}</h3>${sel('quality', ['auto', 'low', 'medium', 'high'], true)}${sl('zoom', 0.6, 1.6, 0.05)}${tg('particles')}${tg('shadows')}${tg('weather')}${tg('shake')}${tg('showFps')}
        <h3>${esc(T('s.h.controls'))}</h3>${sel('touchUi', ['auto', 'on', 'off'])}${sel('joySide', ['left', 'right'])}${sl('btnScale', 0.75, 1.4, 0.05)}${tg('holdSprint', true)}${tg('autoTarget', true)}${tg('vibration')}
        <h3>${esc(T('s.h.ui'))}</h3>${sel('lang', ['auto', 'pt', 'en'])}${sl('uiScale', 0.8, 1.35, 0.05)}${tg('hints', true)}${tg('dmgNumbers')}${tg('colorblind', true)}
        <h3>${esc(T('s.h.game'))}</h3>${tg('autosave', true)}`,
        btn('reset', T('s.reset'), 'ghost') + btn('close', T('ui.done'), 'mint'));
      root.addEventListener('input', (e) => { const k = e.target.dataset.k; if (k && e.target.type === 'range') S.set(k, +e.target.value); });
      root.addEventListener('change', (e) => {
        const k = e.target.dataset.k;
        if (!k || e.target.tagName !== 'SELECT') return;
        S.set(k, e.target.value);
        if (k === 'lang') { FG.setLang(e.target.value); UI.applyLang(); for (const s of UI.stack.slice()) UI.refresh(s.name); }
      });
      root.addEventListener('click', (e) => {
        const b = e.target.closest('[data-tog]');
        if (!b) return;
        const k = b.dataset.tog; S.set(k, !S.data[k]); b.classList.toggle('on', S.data[k]); b.setAttribute('aria-checked', S.data[k]);
        if (FG.Audio) FG.Audio.sfx('ui');
      });
      UI.acts(root, { reset: () => { S.reset(); FG.setLang(S.data.lang); UI.applyLang(); UI.refresh('settings'); } });
    },
  });

  // ---------- pausa ----------
  function statBlock(st, base) {
    const row = (k, cls) => `<div class="stat"><span>${ic(k)}${esc(T('ab.' + k))}</span>${UI.pips(st[k], cls, base ? base[k] : null)}</div>`;
    return `<div class="stat-grid">${Parts.SOCIAL.map((k) => row(k, '')).join('')}${Parts.COMBAT.map((k) => row(k, 'cmb')).join('')}${['speed', 'jump', 'swim', 'sense', 'stealth', 'glide'].map((k) => row(k, 'mov')).join('')}</div>`;
  }
  UI.statBlock = statBlock;
  UI.register('pause', {
    needGame: true,
    build(root) {
      const sp = G.playerSp, st = sp.stats;
      root.innerHTML = UI.card(T('ui.paused'), `
        <div class="sp-head"><canvas width="360" height="240" id="pzCv"></canvas><div style="flex:1;min-width:180px">
          <h3 class="serif">${esc(FG.spName(sp))}</h3>
          <div class="tags">${dietTag(st.diet)}<span class="tag">${esc(T('n.' + sp.niche))}</span><span class="tag">${ic('brain')}${T('ui.level')} ${G.level}</span><span class="tag">${ic('egg')}${T('ui.gen')} ${G.gen}</span></div>
          <div class="tags"><span class="tag">${ic('heart')}${st.hp}</span><span class="tag">${ic('dna')}${G.dna}</span><span class="tag">${ic('sun')}${U.fmtTime(G.stats.play)}</span><span class="tag">${esc(T('diff.' + G.diff))}</span></div>
        </div></div>${statBlock(st)}`,
        btn('menu', T('ui.toMenu'), 'ghost') + btn('help', T('m.help'), 'ghost', 'info') + btn('ach', T('m.ach'), 'ghost', 'trophy') + btn('settings', T('m.settings'), 'ghost', 'gear') + btn('save', T('ui.save'), 'ghost', 'check') + btn('close', T('ui.resume'), 'mint', 'play'));
      Draw.portrait(root.querySelector('#pzCv'), sp, { angle: -0.4 });
      UI.acts(root, {
        settings: () => UI.open('settings'), help: () => UI.open('help'), ach: () => UI.open('ach'),
        save: () => { UI.toast(G.save() ? T('t.saved') : T('t.saveFail'), 'good', 'check'); UI.close('pause'); },
        menu: () => UI.open('confirm', { text: T('ui.toMenuQ'), yes: () => FG.Main.toMenu() }),
      });
    },
  });

  // ---------- objetivos ----------
  UI.register('goals', {
    needGame: true,
    build(root) {
      let h = '';
      G.OBJ.forEach((o, i) => {
        if (i > G.objIdx + 2) return;
        const done = i < G.objIdx, cur = i === G.objIdx, p = cur && o.prog ? o.prog(G) : null;
        h += `<div class="ach ${done || cur ? 'got' : ''}" style="${cur ? 'border-color:var(--mint)' : ''}">${ic(done ? 'check' : cur ? 'target' : 'lock')}<div><b>${esc(T('o.' + o.id))}${p ? ` (${Math.min(p[0], p[1])}/${p[1]})` : ''}</b><small>${o.dna ? '+' + o.dna + ' DNA' : ''}</small></div></div>`;
      });
      root.innerHTML = UI.card(T('hud.objective'), `<p class="dim">${esc(T('g.intro'))}</p><div class="ach-grid" style="grid-template-columns:1fr">${h}</div>`, btn('close', T('ui.done'), 'mint'), 'narrow');
      UI.acts(root, {});
    },
  });

  // ---------- Filopédia ----------
  function relLine(sp) {
    if (sp.isPlayer) return ic('nest') + ' ' + esc(T('ui.yourSpecies'));
    const rel = G.rel(sp);
    if (rel.status === 'ally') return `<span style="color:var(--soc)">${ic('heart')} ${esc(T('ui.allyS'))}</span>`;
    if (rel.status === 'extinct') return `<span class="dim">${ic('skull')} ${esc(T('ui.extinctS'))}</span>`;
    return `${ic('heart')} ${esc(T('b.friends'))} ${rel.friends}/${sp.needFriends} &nbsp;·&nbsp; ${ic('skull')} ${esc(T('b.kills'))} ${rel.kills}/${sp.needKills}`;
  }
  UI.register('book', {
    needGame: true,
    build(root, d) {
      if (!d.sel) d.sel = G.target && !G.target.sp.isPlayer && G.rel(G.target.sp).seen ? G.target.sp.id : 'player';
      const fauna = G.fauna, seen = (sp) => sp.isPlayer || G.rel(sp).seen;
      const total = fauna.list.length, nSeen = fauna.list.filter(seen).length;
      let list = `<div class="fam"><h4>${esc(T('b.yours'))}</h4><button class="sp-item ${d.sel === 'player' ? 'on' : ''}" data-act="sel" data-id="player" type="button"><canvas width="92" height="68" data-sp="player"></canvas><span>${esc(FG.spName(G.playerSp))}</span></button></div>`;
      for (const f of fauna.families) {
        const sps = f.species.map((id) => fauna.byId[id]), k = sps.filter(seen).length;
        list += `<div class="fam"><h4>${k ? esc(f.name[FG.lang]) : '???'}<small>${k}/${sps.length}</small></h4>`;
        for (const sp of sps) {
          const s = seen(sp);
          list += `<button class="sp-item ${d.sel === sp.id ? 'on' : ''} ${s ? '' : 'unseen'}" data-act="sel" data-id="${sp.id}" type="button"><canvas width="92" height="68" data-sp="${sp.id}"></canvas><span>${s ? esc(FG.spName(sp)) : esc(T('b.unknown'))}</span>${s ? `<i class="rel ${G.rel(sp).status === 'ally' ? 'ally' : G.rel(sp).status === 'extinct' ? 'extinct' : ''}"></i>` : ''}</button>`;
        }
        list += '</div>';
      }
      const sp = G.spById(d.sel) || G.playerSp, ok = seen(sp), st = sp.stats;
      let det;
      if (!ok) det = `<div class="sp-head"><canvas width="450" height="300" id="bkCv"></canvas><div><h3 class="serif">${esc(T('b.unknown'))}</h3><p class="dim">${esc(T('b.unknown.d'))}</p></div></div>`;
      else {
        const fam = fauna.families.find((f) => f.id === sp.fam);
        const parts = Object.values(sp.genome.parts).filter(Boolean).map((id) => { const have = G.unlocked.has(id); return `<span class="tag ${have ? 'have' : 'lock'}">${ic(have ? 'check' : 'lock')}${esc(T('p.' + id))}</span>`; }).join('');
        det = `<div class="sp-head"><canvas width="450" height="300" id="bkCv"></canvas><div style="flex:1;min-width:200px">
            <h3 class="serif">${esc(FG.spName(sp))}</h3><em>${esc(sp.sci)}</em>
            <div class="tags">${dietTag(sp.diet)}<span class="tag">${esc(T('n.' + sp.niche))}</span>${sp.isPlayer ? '' : `<span class="tag">${esc(T('biome.' + sp.biome))}</span>`}${sp.nocturnal ? `<span class="tag">${ic('moon')}${esc(T('b.nocturnal'))}</span>` : ''}${sp.isTitan ? `<span class="tag C">${ic('alert')}${esc(T('b.titan'))}</span>` : ''}</div>
            <div class="tags"><span class="tag">${ic('heart')}${st.hp}</span><span class="tag">${ic('bolt')}${st.moveSpeed}</span>${sp.isPlayer ? '' : `<span class="tag">${esc(T('b.danger'))} ${'●'.repeat(sp.tier + 1)}${'○'.repeat(4 - sp.tier)}</span>`}</div>
          </div></div>
          <p><b>${esc(fam ? T('b.family') + ': ' + fam.name[FG.lang] : T('b.yours'))}</b> — ${esc(T('n.' + sp.niche + '.d'))}</p>
          <div class="prog"><span>${relLine(sp)}</span>${sp.isPlayer ? `<span>${ic('egg')} ${T('ui.gen')} ${G.gen} · ${ic('brain')} ${T('ui.level')} ${G.level}</span>` : `<span class="dim">${esc(T('react.' + FG.Species.NICHES[sp.niche].react))}</span>`}</div>
          ${statBlock(st)}
          <h3>${esc(T('b.parts'))}</h3><div class="partlist">${parts}</div>${sp.isPlayer ? '' : `<p class="dim" style="margin-top:8px">${esc(T('b.parts.d'))}</p>`}`;
      }
      root.innerHTML = `<div class="card wide"><header><h2>${esc(T('ui.book'))}</h2><span class="tag">${nSeen}/${total}</span><button class="x" data-act="close" type="button">${ic('close')}</button></header><div class="book"><div class="book-list">${list}</div><div class="book-detail">${det}</div></div></div>`;
      root.querySelectorAll('canvas[data-sp]').forEach((cv) => { const s = G.spById(cv.dataset.sp); Draw.portrait(cv, s, seen(s) ? { angle: 0, shadow: false, fit: 0.92 } : { angle: 0, silhouette: 'rgba(255,255,255,0.18)', fit: 0.92 }); });
      Draw.portrait(root.querySelector('#bkCv'), sp, ok ? { angle: -0.35 } : { angle: -0.35, silhouette: 'rgba(255,255,255,0.14)' });
      const keep = root.querySelector('.book-list');
      if (d.scroll) keep.scrollTop = d.scroll;
      UI.acts(root, { sel: (b) => { d.sel = b.dataset.id; d.scroll = root.querySelector('.book-list').scrollTop; UI.refresh('book'); } });
    },
  });

  // ---------- mapa ----------
  UI.register('map', {
    needGame: true,
    build(root, d) {
      const SZ = 720;
      root.innerHTML = `<div class="card wide"><header><h2>${esc(T('ui.map'))}</h2><span class="tag">${esc(T('map.seed'))} ${G.seed}</span><button class="x" data-act="close" type="button">${ic('close')}</button></header>
        <div class="body" style="overflow:hidden"><div class="map-wrap"><canvas id="mapCv" width="${SZ}" height="${SZ}"></canvas><div class="map-side">
        <div class="legend">
          <span><i class="dot" style="background:#fff"></i>${esc(T('map.home'))}</span><span><i class="dot" style="background:var(--soc)"></i>${esc(T('map.ally'))}</span>
          <span><i class="dot" style="background:#ffd76a"></i>${esc(T('map.neutral'))}</span><span><i class="dot" style="background:var(--cmb)"></i>${esc(T('map.hunter'))}</span>
          <span><i class="dot" style="background:#9aa0a8"></i>${esc(T('map.extinct'))}</span><span><i class="dot" style="background:#fff3c4;border-radius:2px"></i>${esc(T('map.fossil'))}</span>
        </div><div id="mapInfo" class="prog"><span class="dim">${esc(T('map.hint'))}</span></div></div></div></div></div>`;
      const cv = root.querySelector('#mapCv'), info = root.querySelector('#mapInfo');
      const pts = FG.Render.worldMap(cv.getContext('2d'), SZ);
      cv.addEventListener('click', (e) => {
        const r = cv.getBoundingClientRect(), s = Math.min(r.width, r.height), ox = (r.width - s) / 2, oy = (r.height - s) / 2;
        const x = (e.clientX - r.left - ox) / s * SZ, y = (e.clientY - r.top - oy) / s * SZ;
        let best = null, bd = 26 * 26;
        for (const p of pts) { const q = U.dist2(x, y, p.px, p.py); if (q < bd) { bd = q; best = p; } }
        if (!best) return;
        d.pick = best;
        const name = best.kind === 'home' ? T('map.home') : FG.spName(best.sp);
        const P = G.player, busy = G.time - P.combatT < 8 || G.enc;
        const tx = best.kind === 'home' ? G.homeNest : best.nest;
        info.innerHTML = `<b>${esc(name)}</b>${best.sp ? `<span>${relLine(best.sp)}</span>` : ''}${best.travel && tx ? (busy ? `<span class="dim">${esc(T('map.busy'))}</span>` : btn('travel', T('map.travel'), 'mint small', 'bolt')) : best.kind === 'nest' ? `<span class="dim">${esc(T('map.travel.d'))}</span>` : ''}${best.sp ? btn('book', T('ui.book'), 'ghost small', 'book') : ''}`;
      });
      UI.acts(root, {
        travel: () => { const p = d.pick, n = p.kind === 'home' ? G.homeNest : p.nest; UI.close('map'); UI.fade(() => G.travelTo(n.x + 60, n.y + 40)); },
        book: () => { const id = d.pick.sp.id; UI.close('map'); UI.open('book', { sel: G.rel(d.pick.sp).seen ? id : 'player' }); },
      });
    },
  });

  // ---------- ajuda ----------
  UI.register('help', {
    build(root) {
      const k = (a, b) => `<kbd>${a}</kbd><span>${esc(T(b))}</span>`;
      const tp = (a, b) => `<span>${ic(a)}</span><span>${esc(T(b))}</span>`;
      root.innerHTML = UI.card(T('m.help'), `<div class="help-grid">
        <div><h3>${esc(T('h.goal'))}</h3><p>${esc(T('h.goal.d'))}</p><h3>${esc(T('h.social'))}</h3><p>${esc(T('h.social.d'))}</p><h3>${esc(T('h.combat'))}</h3><p>${esc(T('h.combat.d'))}</p></div>
        <div><h3>${esc(T('h.evolve'))}</h3><p>${esc(T('h.evolve.d'))}</p><h3>${esc(T('h.survive'))}</h3><p>${esc(T('h.survive.d'))}</p><h3>${esc(T('h.pack'))}</h3><p>${esc(T('h.pack.d'))}</p></div>
        <div><h3>${esc(T('h.keys'))}</h3><div class="keys">${k('W A S D', 'k.move')}${k('Shift', 'k.sprint')}${k(esc(T('k.kSpace')), 'k.jump')}${k('C', 'k.sneak')}${k('Q / Tab', 'k.stance')}${k('1 – 4', 'k.abil')}${k('E', 'k.interact')}${k(esc(T('k.kClick')), 'k.target')}${k('R / X', 'k.next')}${k('M · B · Esc', 'k.menus')}${k(esc(T('k.kWheel')), 'k.zoom')}</div></div>
        <div><h3>${esc(T('h.touch'))}</h3><div class="keys">${tp('hand', 'k.t.move')}${tp('target', 'k.t.target')}${tp('heart', 'k.t.stance')}${tp('bolt', 'k.t.sprint')}${tp('jump', 'k.jump')}${tp('sneak', 'k.sneak')}${tp('map', 'k.t.pinch')}</div><p class="dim" style="margin-top:10px">${esc(T('h.pad'))}</p></div></div>`,
        btn('close', T('ui.done'), 'mint'), 'wide');
      root.querySelector('.card').style.height = 'auto';
      UI.acts(root, {});
    },
  });

  // ---------- conquistas ----------
  UI.register('ach', {
    build(root) {
      const h = G.ACH.map((a) => { const got = G.achieved.has(a.id); return `<div class="ach ${got ? 'got' : ''}">${ic(got ? 'trophy' : 'lock')}<div><b>${esc(T('ach.' + a.id))}</b><small>${esc(T('ach.' + a.id + '.d'))}</small></div></div>`; }).join('');
      root.innerHTML = UI.card(T('m.ach') + ' · ' + G.achieved.size + '/' + G.ACH.length, `<div class="ach-grid">${h}</div>`, btn('close', T('ui.done'), 'mint'));
      UI.acts(root, {});
    },
  });

  // ---------- confirmação ----------
  UI.register('confirm', {
    build(root, d) {
      root.innerHTML = `<div class="card narrow"><div class="body center"><p style="font-size:1.1em;margin:12px 0">${esc(d.text)}</p></div><footer>${btn('no', T('ui.no'), 'ghost')}${btn('yes', T('ui.yes'), 'mint')}</footer></div>`;
      UI.acts(root, { no: () => UI.close('confirm'), yes: () => { UI.close('confirm'); d.yes(); } });
    },
  });

  // ---------- morte ----------
  UI.register('death', {
    needGame: true, dismiss: false,
    build(root, d) {
      const lose = G.DIFF[G.diff].lose, lost = Math.floor(G.dna * lose);
      root.innerHTML = `<div class="card narrow"><div class="body center"><div style="color:var(--cmb);font-size:2.4em">${ic('skull')}</div>
        <h2 class="serif" style="margin:6px 0">${esc(T('d.title'))}</h2>
        <p>${esc(d.sp ? T('d.by', FG.spName(d.sp)) : T('d.other'))}</p>
        <p class="dim">${esc(lost ? T('d.lose', lost) : T('d.keep'))}</p></div><footer style="justify-content:center">${btn('go', T('d.respawn'), 'mint', 'egg')}</footer></div>`;
      UI.acts(root, { go: () => { UI.close('death'); UI.fade(() => G.respawn()); } });
    },
  });

  // ---------- final ----------
  UI.register('ending', {
    needGame: true, dismiss: false,
    build(root) {
      const s = G.stats, path = G.pathTitle();
      const row = (k, v) => `<span>${esc(T(k))}</span><span>${v}</span>`;
      root.innerHTML = `<div class="card"><div class="body center"><div style="color:#ffc6e0;font-size:2.6em">${ic('brain')}</div>
        <h2 class="serif" style="font-size:1.9em;margin:4px 0">${esc(T('e.title'))}</h2>
        <p class="serif" style="font-size:1.15em;font-style:italic">${esc(T('e.path.' + path, FG.spName(G.playerSp)))}</p>
        <p>${esc(T('e.text'))}</p>
        <div class="stats-t">${row('e.time', U.fmtTime(s.play))}${row('e.gens', G.gen)}${row('e.allies', s.allies)}${row('e.extinct', s.extinct)}${row('e.friends', s.friends)}${row('e.kills', s.kills)}${row('e.fossils', s.fossils)}${row('e.species', s.speciesSeen + '/' + G.fauna.list.length)}${row('e.deaths', s.deaths)}</div>
        </div><footer style="justify-content:center">${btn('menu', T('ui.toMenu'), 'ghost')}${btn('go', T('e.continue'), 'mint', 'play')}</footer></div>`;
      UI.acts(root, { go: () => UI.close('ending'), menu: () => FG.Main.toMenu() });
    },
  });
})(window.FG = window.FG || {});
