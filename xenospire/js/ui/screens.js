// Menu screens and modals. Each builder returns a DOM node; main.js mounts it
// and provides the `app` object with the actions buttons call.
(function (XS) {
  'use strict';

  const { el, button, esc, powerCard, beingCard, portrait, kitRow, iconImg } = XS.Cards;
  const S = XS.S;

  // Typewriter + blip voice for the Curator's lines.
  function curatorLine(app, text) {
    const box = el('div', 'curator', '<div class="cur-face"><i></i><i></i></div><p></p>');
    const p = box.querySelector('p');
    let i = 0;
    const step = () => {
      if (!p.isConnected && i > 0) return;
      i = Math.min(text.length, i + 2);
      p.textContent = text.slice(0, i);
      if (i < text.length) setTimeout(step, 22);
    };
    setTimeout(step, 60);
    box.addEventListener('click', () => { i = text.length; p.textContent = text; });
    app.sound.curator(text);
    return box;
  }

  function header(title, sub) {
    return el('header', 'scr-head', `<h2>${title}</h2>${sub ? `<p>${sub}</p>` : ''}`);
  }

  // ---------------------------------------------------------------- title
  function title(app) {
    const m = app.meta;
    const s = el('div', 'screen title-screen');
    s.innerHTML = `<div class="logo"><h1>${S.title}</h1><p>${S.subtitle}</p></div>`;
    const menu = el('nav', 'menu');
    const saved = XS.Run.loadRun();
    if (saved) menu.appendChild(button(`${S.continue} <small>${XS.t('floor', { n: saved.floor })}</small>`, 'primary', () => app.continueRun()));
    menu.appendChild(button(S.newRun, saved ? '' : 'primary', () => app.newRun()));
    menu.appendChild(button('🧪 ' + S.lab.menu, '', () => app.enterLab()));
    menu.appendChild(button(S.codex, '', () => app.openCodex()));
    menu.appendChild(button(S.settings, '', () => app.openSettings()));
    menu.appendChild(button(S.lore, 'ghost', () => app.go('intro', { replay: true })));
    s.appendChild(menu);
    const rng = new XS.RNG(Date.now() & 0xffff);
    s.appendChild(el('footer', 'title-foot', `${m.best ? `<span>${XS.t('record', { n: m.best })}</span>` : ''}<span class="tipline">${esc(rng.pick(XS.Lore.TITLE_TIPS))}</span><a href="../index.html">← Coleção de jogos</a>`));
    return s;
  }

  // ---------------------------------------------------------------- intro
  function intro(app, data) {
    const s = el('div', 'screen intro-screen');
    let i = 0;
    const slide = el('div', 'intro-slide');
    const next = () => {
      if (i >= XS.Lore.INTRO.length) { app.introDone(data); return; }
      slide.innerHTML = '';
      slide.appendChild(curatorLine(app, XS.Lore.INTRO[i]));
      slide.appendChild(el('div', 'dots', XS.Lore.INTRO.map((_, k) => `<i class="${k === i ? 'on' : ''}"></i>`).join('')));
      i++;
    };
    s.appendChild(slide);
    const bar = el('div', 'row');
    bar.appendChild(button(S.skip, 'ghost', () => { i = XS.Lore.INTRO.length; next(); }));
    bar.appendChild(button(S.next + ' ▶', 'primary', next));
    s.appendChild(bar);
    next();
    return s;
  }

  // -------------------------------------------------------------- arrival
  function arrival(app) {
    const run = app.run;
    const s = el('div', 'screen arrival-screen');
    s.appendChild(header(S.arrivalTitle, S.arrivalText));
    const seedRow = el('div', 'seed-row');
    seedRow.innerHTML = `<label>${S.seed} <input type="text" maxlength="24" spellcheck="false" autocomplete="off" value="${XS.seedToCode(run.seed)}" aria-label="${S.seed}" title="${S.seedHint}"></label>`;
    const input = seedRow.querySelector('input');
    input.addEventListener('change', () => app.setSeed(input.value));
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') input.blur(); });
    seedRow.appendChild(button(XS.t('reroll', { n: run.rerolls }), 'small', () => app.reroll()));
    if (!run.rerolls) seedRow.lastChild.disabled = true;
    s.appendChild(seedRow);
    const row = el('div', 'cards three');
    for (const gseed of XS.Run.arrivalOptions(run)) {
      const g = XS.Creature.generate(gseed);
      row.appendChild(beingCard(g, { action: [S.choose, () => app.chooseBeing(gseed)] }));
    }
    s.appendChild(row);
    s.appendChild(button('← ' + S.back, 'ghost back', () => app.go('title')));
    return s;
  }

  // ---------------------------------------------------------------- draft
  function draft(app) {
    const run = app.run;
    const s = el('div', 'screen draft-screen');
    s.appendChild(header(`${S.draftTitle} · ${XS.t('draftRound', { n: run.draftRound + 1 })}`, S.draftText));
    const row = el('div', 'cards three');
    for (const def of XS.Run.draftOptions(run)) row.appendChild(powerCard(def, { action: [S.choose, () => app.draftPick(def)] }));
    s.appendChild(row);
    s.appendChild(kitRow(run.powers.map(XS.Run.powerOf), (d) => app.showPower(d)));
    return s;
  }

  // --------------------------------------------------------------- versus
  function versus(app, plan) {
    const run = app.run;
    const s = el('div', 'screen versus-screen');
    const type = plan.type === 'guardian' ? XS.t('guardian', { n: plan.floor }) : plan.type === 'melee' ? S.melee : S.duel;
    s.appendChild(header(`${XS.t('floor', { n: plan.floor })} · ${esc(type)}`, esc(plan.theme.name)));
    const grid = el('div', 'vs-grid');
    const me = XS.Creature.generate(run.genomeSeed);
    const left = el('div', 'vs-side me');
    left.appendChild(portrait(me, 72, { facing: 0.6, bg: '#0e1a1c' }));
    left.appendChild(el('h4', '', esc(me.name)));
    left.appendChild(kitRow(run.powers.map(XS.Run.powerOf), (d) => app.showPower(d)));
    const hpNow = Math.round(run.hpFrac * 100);
    left.appendChild(el('div', 'hpnote', `${S.hp}: ${hpNow}%`));
    grid.appendChild(left);
    grid.appendChild(el('div', 'vs-mark', 'VS'));
    const right = el('div', 'vs-side foes');
    for (const o of plan.opponents) {
      const box = el('div', 'foe-box' + (o.guardian ? ' guardian' : ''));
      const top = el('div', 'foe-top');
      top.appendChild(portrait(o.genome, 64, { facing: 2.4, bg: '#1c0e14' }));
      const d = XS.Creature.describe(o.genome);
      top.appendChild(el('div', '', `<h4>${esc(o.guardian ? XS.t('guardian', { n: plan.floor }) : o.genome.name)}</h4><div class="sub">${esc(o.genome.epithet)} · ${esc(o.genome.bio.world)}</div><div class="tags"><span class="chip">${d.archetype}</span><span class="chip">${d.personality}</span></div>`));
      box.appendChild(top);
      const picks = el('div', 'picks');
      for (const dr of o.drafts) {
        const line = el('div', 'pick-line');
        const chosen = iconImg(dr.pick, 'picon chosen');
        chosen.addEventListener('click', () => app.showPower(dr.pick));
        line.appendChild(chosen);
        const txt = el('span', '', `${S.chose} <b>${esc(dr.pick.name)}</b> ${S.among}`);
        line.appendChild(txt);
        for (const alt of dr.offer) {
          if (alt === dr.pick) continue;
          const im = iconImg(alt, 'picon alt');
          im.addEventListener('click', () => app.showPower(alt));
          line.appendChild(im);
        }
        picks.appendChild(line);
      }
      box.appendChild(picks);
      right.appendChild(box);
    }
    grid.appendChild(right);
    s.appendChild(grid);
    s.appendChild(curatorLine(app, plan.line));
    const row = el('div', 'row');
    row.appendChild(button('☰', 'ghost', () => app.pauseMenu(true)));
    row.appendChild(button(S.fight, 'primary big', () => app.startBattle()));
    s.appendChild(row);
    return s;
  }

  // -------------------------------------------------------------- victory
  function victory(app, info) {
    const s = el('div', 'screen result-screen win');
    s.appendChild(el('h2', 'result-title', S.victory));
    s.appendChild(curatorLine(app, info.line));
    s.appendChild(el('div', 'statgrid', [
      [S.stats.damage, XS.fmtInt(info.stats.dmg)], [S.stats.voxels, info.stats.voxels], [S.stats.time, Math.round(info.time) + ' s'], [S.stats.falls, info.stats.falls],
    ].map(([k, v]) => `<div><span>${k}</span><b>${v}</b></div>`).join('')));
    s.appendChild(button('O Tear ▶', 'primary big', () => app.go('loom')));
    return s;
  }

  // ----------------------------------------------------------------- loom
  function loom(app) {
    const run = app.run;
    const s = el('div', 'screen loom-screen');
    s.appendChild(header(S.draftTitle, S.loomText));
    s.appendChild(curatorLine(app, XS.Lore.loom(new XS.RNG(XS.hash(run.seed, 'loomline', run.floor)))));
    const kit = run.powers.map(XS.Run.powerOf);
    const row = el('div', 'cards three');
    for (const def of XS.Run.loomOptions(run)) {
      row.appendChild(powerCard(def, { action: [S.take, () => slotPicker(app, S.replaceWhich, kit, (slot) => app.loomTake(def, slot), def)] }));
    }
    s.appendChild(row);
    const extra = el('div', 'row');
    extra.appendChild(button(`${S.reinforce} <small>${S.reinforceHint}</small>`, '', () => {
      const boosted = run.powers.map((sp) => XS.Power.generate(sp.seed, run.floor + 1, { tier: sp.tier, reinforced: true }));
      slotPicker(app, S.reinforceWhich, kit, (slot) => app.loomReinforce(slot), null, boosted);
    }));
    extra.appendChild(button(`${S.unravel} <small>${XS.t('unravelHint', { n: 25 })}</small>`, '', () => app.loomUnravel()));
    s.appendChild(extra);
    return s;
  }

  // Modal asking which of the three slots to replace / reinforce.
  function slotPicker(app, title, kit, onPick, incoming, boosted) {
    const m = el('div', 'modal-card');
    m.appendChild(el('h3', '', title));
    const list = el('div', 'slot-list');
    kit.forEach((def, i) => {
      const card = powerCard(boosted ? boosted[i] : def, { compact: true, compare: boosted ? def : null });
      if (incoming) card.appendChild(el('div', 'delta', `${S.damage}: ${def.damage} → ${incoming.damage} · ${S.cooldown}: ${XS.fmt1(def.cooldown)} → ${XS.fmt1(incoming.cooldown)} s`));
      card.appendChild(button(boosted ? S.reinforce : S.choose, 'primary', () => { app.closeModal(); onPick(i); }));
      list.appendChild(card);
    });
    m.appendChild(list);
    m.appendChild(button(S.cancel, 'ghost', () => app.closeModal()));
    app.openModal(m);
  }

  // ------------------------------------------------------------- gameover
  function gameover(app, info) {
    const s = el('div', 'screen result-screen lose');
    s.appendChild(el('h2', 'result-title', S.runOver));
    s.appendChild(el('p', 'reached', `${XS.t('reachedFloor', { n: info.floor })} · ${info.newRecord ? `<b class="rec">${S.newRecord}</b>` : XS.t('record', { n: info.best })}`));
    const g = XS.Creature.generate(info.genomeSeed);
    const box = el('div', 'epitaph');
    box.appendChild(portrait(g, 64, { bg: '#140c18' }));
    box.appendChild(el('p', '', `“${esc(info.epitaph)}”`));
    s.appendChild(box);
    const fav = info.favorite ? `<div class="fav"><span>${S.stats.favorite}</span><b>${esc(info.favorite.def.name)}</b> <small>×${info.favorite.casts}</small></div>` : '';
    s.appendChild(el('div', 'statgrid', [
      [S.stats.kos, info.stats.kos], [S.stats.damage, XS.fmtInt(info.stats.dmg)], [S.stats.voxels, info.stats.voxels], [S.stats.time, Math.round(info.stats.time) + ' s'], [S.stats.falls, info.stats.falls],
    ].map(([k, v]) => `<div><span>${k}</span><b>${v}</b></div>`).join('') + fav));
    s.appendChild(el('p', 'seedline', `${S.seed}: <b>${XS.seedToCode(info.seed)}</b>`));
    const row = el('div', 'row wrap');
    row.appendChild(button(S.newRun, 'primary', () => app.newRun()));
    row.appendChild(button(S.sameSeed, '', () => app.newRun(info.seed)));
    row.appendChild(button(S.codex, '', () => app.openCodex()));
    row.appendChild(button('Menu', 'ghost', () => app.go('title')));
    s.appendChild(row);
    return s;
  }

  // ---------------------------------------------------------------- codex
  function codex(app, tab = 'beings') {
    const m = app.meta;
    const s = el('div', 'screen codex-screen');
    s.appendChild(header(S.codex, `${m.beings.length} seres · ${m.powers.length} poderes · ${m.runs.length} escaladas`));
    const tabs = el('div', 'tabs');
    for (const [id, label] of [['beings', S.codexBeings], ['powers', S.codexPowers], ['runs', S.codexRuns]]) {
      const b = button(label, id === tab ? 'on' : '', () => app.go('codex', id));
      tabs.appendChild(b);
    }
    s.appendChild(tabs);
    const body = el('div', 'codex-body');
    if (tab === 'beings') {
      if (!m.beings.length) body.appendChild(el('p', 'empty', S.codexEmpty));
      for (const seed of m.beings.slice(0, 60)) {
        const g = XS.Creature.generate(seed);
        const c = el('div', 'codex-being');
        c.appendChild(portrait(g, 48, { bg: '#120e20' }));
        c.appendChild(el('span', '', esc(g.name)));
        c.addEventListener('click', () => { const mm = el('div', 'modal-card'); mm.appendChild(beingCard(g)); mm.appendChild(button(S.close, 'ghost', () => app.closeModal())); app.openModal(mm); });
        body.appendChild(c);
      }
    } else if (tab === 'powers') {
      if (!m.powers.length) body.appendChild(el('p', 'empty', S.codexEmpty));
      for (const spec of m.powers.slice(0, 120)) {
        const def = XS.Run.powerOf(spec);
        const c = el('div', 'codex-power');
        c.appendChild(iconImg(def));
        c.appendChild(el('span', '', esc(def.name)));
        c.addEventListener('click', () => app.showPower(def));
        body.appendChild(c);
      }
    } else {
      if (!m.runs.length) body.appendChild(el('p', 'empty', S.codexEmpty));
      for (const r of m.runs) {
        const c = el('div', 'codex-run', `<b>${XS.t('floor', { n: r.floor })}</b> · ${esc(r.name)} <small>${new Date(r.date).toLocaleDateString('pt-BR')}</small><p>“${esc(r.epitaph)}”</p>`);
        c.appendChild(button(`${S.sameSeed} (${XS.seedToCode(r.seed)})`, 'small', () => app.newRun(r.seed)));
        body.appendChild(c);
      }
    }
    s.appendChild(body);
    s.appendChild(button('← ' + S.back, 'ghost back', () => app.go(app.prevMenu || 'title')));
    return s;
  }

  // --------------------------------------------------------------- modals
  function pause(app, inMenu) {
    const m = el('div', 'modal-card pause');
    m.appendChild(el('h3', '', S.pause));
    if (app.mode !== 'run' && app.lab) {
      m.appendChild(el('p', 'muted', 'Seus poderes'));
      const list = el('div', 'pause-powers');
      for (const def of app.lab.kit.map(XS.Lab.powerOf)) list.appendChild(powerCard(def, { compact: true }));
      m.appendChild(list);
      const row = el('div', 'row wrap');
      row.appendChild(button(S.resume, 'primary', () => app.resume()));
      row.appendChild(button(S.settings, '', () => app.openSettings(true)));
      if (app.mode === 'labtest') row.appendChild(button(S.lab.back, '', () => { app.closeModal(); app.go('lab'); }));
      row.appendChild(button(S.lab.leave, 'danger', () => { app.closeModal(); app.go('title'); }));
      m.appendChild(row);
      return m;
    }
    if (app.run && app.run.powers.length) {
      m.appendChild(el('p', 'muted', 'Seus poderes'));
      const list = el('div', 'pause-powers');
      for (const def of app.run.powers.map(XS.Run.powerOf)) list.appendChild(powerCard(def, { compact: true }));
      m.appendChild(list);
    }
    const row = el('div', 'row wrap');
    row.appendChild(button(S.resume, 'primary', () => app.resume()));
    row.appendChild(button(S.settings, '', () => app.openSettings(true)));
    if (!inMenu) row.appendChild(button(S.abandon, 'danger', () => confirm(app, S.abandonConfirm, () => app.abandon())));
    else row.appendChild(button('Menu', 'ghost', () => { app.closeModal(); app.go('title'); }));
    m.appendChild(row);
    return m;
  }

  function settings(app, fromPause) {
    const m = el('div', 'modal-card wide');
    m.appendChild(el('h3', '', S.settings));
    m.appendChild(XS.Settings.panel(app.settings, (k) => app.settingChanged(k), () => confirm(app, S.set.eraseConfirm, () => app.eraseAll())));
    m.appendChild(button(S.close, 'primary', () => (fromPause ? app.pauseMenu(app.state !== 'battle') : app.closeModal())));
    return m;
  }

  function confirm(app, text, onYes) {
    const m = el('div', 'modal-card small');
    m.appendChild(el('p', '', esc(text)));
    const row = el('div', 'row');
    row.appendChild(button(S.cancel, 'ghost', () => app.closeModal()));
    row.appendChild(button(S.confirm, 'danger', () => { app.closeModal(); onYes(); }));
    m.appendChild(row);
    app.openModal(m);
  }

  function powerInfo(app, def) {
    const m = el('div', 'modal-card');
    m.appendChild(powerCard(def));
    m.appendChild(button(S.close, 'ghost', () => app.closeModal()));
    return m;
  }

  XS.Screens = { title, intro, arrival, draft, versus, victory, loom, gameover, codex, pause, settings, confirm, powerInfo, curatorLine };
})(globalThis.XS = globalThis.XS || {});
