/* Filogênese — interface: HUD, avisos, gerenciador de telas e utilitários de marcação. */
(function (FG) {
  'use strict';
  const U = FG.U, G = FG.Game, Icons = FG.Icons, Parts = FG.Parts, I = FG.Input, S = FG.Settings;
  const T = (k, a, b) => FG.T(k, a, b);
  const $ = (id) => document.getElementById(id);
  const ic = Icons.svg;
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const CD = { bite: 0.8, charge: 5.5, spit: 3.2, strike: 2.6 };
  const el = {};
  let abBtns = [], dirty = { ab: true, pack: true, obj: true, target: true }, mmT = 0, slowT = 0, lastRev = -1, fpsT = 0, fpsN = 0;
  const cache = new WeakMap();
  function setW(e, v) { v = Math.round(U.clamp(v, 0, 1) * 1000) / 10; if (cache.get(e) !== v) { cache.set(e, v); e.style.width = v + '%'; } }
  function setTxt(e, v) { if (e._t !== v) { e._t = v; e.textContent = v; } }
  function setCls(e, c, on) { if (!!e['_c' + c] !== !!on) { e['_c' + c] = !!on; e.classList.toggle(c, !!on); } }

  const UI = FG.UI = {
    stack: [], defs: {}, esc, ic, $,

    init() {
      for (const id of ['hud', 'vignette', 'portrait', 'hpFill', 'hpTxt', 'huFill', 'stFill', 'brBar', 'brFill', 'stateIcons', 'packBox', 'objBox', 'objTxt',
        'lvl', 'brainFill', 'brainTxt', 'dna', 'targetBox', 'tRel', 'tName', 'tClose', 'tHp', 'tNiche', 'tProg', 'toasts', 'minimap', 'clock',
        'btnMap', 'btnBook', 'btnPause', 'prompt', 'btnInteract', 'actionBar', 'btnStance', 'abRow', 'touchBtns', 'btnSneak', 'btnNext', 'btnJump', 'btnSprint',
        'joy', 'fps', 'saveInd', 'screens', 'fade', 'icBrain', 'icDna']) el[id] = $(id);
      el.icBrain.innerHTML = ic('brain'); el.icDna.innerHTML = ic('dna');
      el.btnMap.innerHTML = ic('map'); el.btnBook.innerHTML = ic('book'); el.btnPause.innerHTML = ic('pause'); el.tClose.innerHTML = ic('close');
      el.btnSneak.innerHTML = ic('sneak'); el.btnNext.innerHTML = ic('target'); el.btnJump.innerHTML = ic('jump'); el.btnSprint.innerHTML = ic('bolt');
      el.saveInd.innerHTML = ic('check') + '<span data-t="hud.saved"></span>';
      // botões de habilidade
      for (let i = 0; i < 4; i++) {
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'ab';
        b.innerHTML = `<span class="g"></span><b class="key">${i + 1}</b><span class="lv"></span><i class="cd"></i>`;
        tap(b, () => I.press('a' + (i + 1)));
        el.abRow.appendChild(b); abBtns.push(b);
      }
      tap(el.btnStance, () => I.press('stance'));
      tap(el.btnInteract, () => I.press('interact'));
      tap(el.btnJump, () => I.press('jump'));
      tap(el.btnNext, () => I.press('next'));
      tap(el.btnSneak, () => I.toggleSneak());
      el.btnSprint.addEventListener('pointerdown', (e) => { e.preventDefault(); if (S.data.holdSprint) I.sprintHeld = true; else I.sprintTog = !I.sprintTog; });
      for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) el.btnSprint.addEventListener(ev, () => { I.sprintHeld = false; });
      tap(el.tClose, () => I.press('clear'));
      tap(el.btnMap, () => UI.open('map'));
      tap(el.btnBook, () => UI.open('book'));
      tap(el.btnPause, () => UI.open('pause'));
      tap(el.objBox, () => UI.open('goals'));
      el.minimap.parentNode.addEventListener('click', () => UI.open('map'));
      // eventos do jogo
      const B = FG.bus;
      B.on('toast', (t, k, i) => UI.toast(t, k, i));
      B.on('stance', () => { dirty.ab = true; });
      B.on('target', () => { dirty.target = true; });
      B.on('pack', () => { dirty.pack = true; });
      B.on('progress', () => { dirty.obj = true; dirty.ab = true; dirty.target = true; });
      B.on('objective', () => { dirty.obj = true; el.objBox.classList.remove('done'); void el.objBox.offsetWidth; el.objBox.classList.add('done'); });
      B.on('gamestart', () => { dirty = { ab: true, pack: true, obj: true, target: true }; lastRev = -1; el.toasts.innerHTML = ''; });
      B.on('dna', () => { const d = el.dna.parentNode; d.classList.remove('bump'); void d.offsetWidth; d.classList.add('bump'); });
      B.on('species', (sp) => UI.toast(T('t.newSpecies', FG.spName(sp)), 'good', 'book'));
      B.on('achievement', (id) => UI.toast(T('t.achievement', T('ach.' + id)), 'big', 'trophy'));
      B.on('levelup', (lvl, parts) => {
        dirty.ab = dirty.pack = dirty.obj = true;
        UI.banner(T('t.level', lvl), T('lvl.' + lvl));
        if (parts && parts.length) UI.toast(T('t.partsNew', parts.map((p) => T('p.' + p.id)).join(', ')), 'good', 'dna');
        if (lvl >= 2 && lvl <= 4) UI.toast(T('t.packSlot', G.packMax()), 'good', 'paw');
      });
      B.on('saved', () => { el.saveInd.classList.add('on'); clearTimeout(UI._sv); UI._sv = setTimeout(() => el.saveInd.classList.remove('on'), 1600); });
      B.on('joy', (on, x, y, dx, dy) => {
        el.joy.hidden = !on;
        if (on) { el.joy.style.left = x + 'px'; el.joy.style.top = y + 'px'; el.joy.firstElementChild.style.transform = `translate(${dx}px, ${dy}px)`; }
      });
      B.on('touchmode', () => UI.applySettings());
      B.on('inputstate', () => { dirty.ab = true; });
      B.on('vibrate', (ms) => { if (S.data.vibration && navigator.vibrate) try { navigator.vibrate(ms); } catch (e) { /* sem suporte */ } });
      B.on('setting', () => UI.applySettings());
      B.on('death', (sp) => setTimeout(() => UI.open('death', { sp }), 1300));
      B.on('ending', () => setTimeout(() => UI.open('ending'), 900));
      B.on('editor', (mode) => UI.fade(() => UI.open('editor', { mode })));
      UI.applySettings();
      UI.applyLang();
    },

    applySettings() {
      const d = S.data, st = document.documentElement.style;
      st.setProperty('--ui', d.uiScale); st.setProperty('--btn', d.btnScale);
      const touch = d.touchUi === 'on' || (d.touchUi === 'auto' && I.touch);
      document.body.classList.toggle('touch', touch);
      document.body.classList.toggle('joy-right', d.joySide === 'right');
      el.fps.hidden = !d.showFps;
      if (FG.Audio) FG.Audio.setVolumes();
      dirty.ab = true;
    },
    applyLang() {
      document.documentElement.lang = FG.lang === 'pt' ? 'pt-BR' : 'en';
      document.querySelectorAll('[data-t]').forEach((e) => { e.textContent = T(e.dataset.t); });
      el.btnMap.title = T('ui.map'); el.btnBook.title = T('ui.book'); el.btnPause.title = T('ui.pause');
      el.btnSneak.title = T('ab.stealth'); el.btnJump.title = T('ab.jump'); el.btnSprint.title = T('ui.sprint'); el.btnNext.title = T('ui.nextTarget');
      dirty = { ab: true, pack: true, obj: true, target: true }; el.btnInteract._t = null;
    },

    // ---------- avisos ----------
    toast(text, kind, icon) {
      const now = performance.now();
      if (UI._lastToast === text && now - UI._lastToastT < 1500) return;
      UI._lastToast = text; UI._lastToastT = now;
      const d = document.createElement('div');
      d.className = 'toast ' + (kind || 'info');
      d.innerHTML = (icon ? ic(icon) : '') + '<span>' + esc(text) + '</span>';
      el.toasts.appendChild(d);
      while (el.toasts.children.length > 3) el.toasts.firstElementChild.remove();
      setTimeout(() => { d.classList.add('out'); setTimeout(() => d.remove(), 320); }, kind === 'big' ? 4600 : 3200);
    },
    banner(title, sub) {
      const d = document.createElement('div');
      d.className = 'banner';
      d.innerHTML = `<b>${esc(title)}</b><span>${esc(sub || '')}</span>`;
      el.hud.appendChild(d);
      setTimeout(() => d.remove(), 4200);
    },
    /** Escurece a tela, roda `fn` e clareia. `msg` aparece enquanto está escuro (ex.: gerando o mundo). */
    fade(fn, hold, msg) {
      el.fade.textContent = msg || '';
      el.fade.classList.add('on');
      setTimeout(() => { fn(); setTimeout(() => el.fade.classList.remove('on'), hold || 120); }, 360);
    },

    // ---------- telas ----------
    register(name, def) { UI.defs[name] = def; },
    open(name, data) {
      const def = UI.defs[name];
      if (!def || UI.stack.some((s) => s.name === name)) return null;
      if (def.needGame && (!G.active || !G.player)) return null;
      if (def.needGame && G.cine && name !== 'death' && name !== 'ending' && name !== 'editor') return null;
      const entry = { name, el: null, def, data: data || {} };
      UI.stack.push(entry);
      el.screens.appendChild(UI.mount(entry));
      UI.sync();
      if (FG.Audio) FG.Audio.sfx('ui');
      return entry;
    },
    close(name) {
      const i = name ? UI.stack.findIndex((s) => s.name === name) : UI.stack.length - 1;
      if (i < 0) return;
      const s = UI.stack.splice(i, 1)[0];
      if (s.def.close) s.def.close(s.data, s);
      s.el.remove();
      UI.sync();
    },
    closeAll() { while (UI.stack.length) UI.close(); },
    top() { return UI.stack[UI.stack.length - 1] || null; },
    isOpen(name) { return UI.stack.some((s) => s.name === name); },
    blocking() { return UI.stack.length > 0; },
    /** Cria o elemento de uma tela do zero (cada montagem tem seus próprios ouvintes). */
    mount(entry) {
      const def = entry.def, sec = document.createElement('section');
      sec.className = 'screen' + (def.cls ? ' ' + def.cls : ''); sec.id = 'scr-' + entry.name;
      entry.el = sec;
      def.build(sec, entry.data, entry);
      sec.addEventListener('pointerdown', (e) => { if (e.target === sec && def.dismiss !== false) UI.close(entry.name); });
      return sec;
    },
    refresh(name) {
      const s = UI.stack.find((q) => q.name === name);
      if (!s) return;
      const old = s.el, sec = UI.mount(s);
      sec.style.animation = 'none';   // remontagem não repete a animação de entrada
      old.replaceWith(sec);
    },
    sync() {
      const play = G.active && !UI.isOpen('menu');
      el.hud.hidden = !play || UI.isOpen('editor');
      I.enabled = play && UI.stack.length === 0;
      if (!I.enabled) I.clear();
      FG.bus.emit('uistate');
    },
    /** Tecla de interface (Esc, M, B, H). */
    key(k) {
      const top = UI.top();
      if (k === 'pause') {
        if (top) { if (top.def.dismiss !== false) UI.close(); return; }
        if (G.active) UI.open('pause');
        return;
      }
      if (!G.active || UI.isOpen('menu')) return;
      const name = k === 'map' ? 'map' : k === 'book' ? 'book' : 'help';
      if (top && top.name === name) return UI.close();
      if (!top) UI.open(name);
    },

    // ---------- marcação reutilizável ----------
    pips(n, cls, base) {
      let s = `<span class="pips ${cls || ''}">`;
      for (let i = 1; i <= 5; i++) s += `<b class="${i <= n ? 'on' : ''}${base != null && i > base && i <= n ? ' up' : ''}${base != null && i > n && i <= base ? ' dn' : ''}"></b>`;
      return s + '</span>';
    },
    card(title, body, foot, cls, noClose) {
      return `<div class="card ${cls || ''}"><header><h2>${esc(title)}</h2>${noClose ? '' : `<button class="x" data-act="close" type="button" aria-label="${esc(T('ui.close'))}">${ic('close')}</button>`}</header><div class="body">${body}</div>${foot ? `<footer>${foot}</footer>` : ''}</div>`;
    },
    /** Liga cliques por data-act dentro de uma tela. */
    acts(root, map) {
      root.addEventListener('click', (e) => {
        const b = e.target.closest('[data-act]');
        if (!b || !root.contains(b)) return;
        const a = b.dataset.act;
        if (FG.Audio) FG.Audio.sfx('ui');
        if (a === 'close') return UI.close(root.id.slice(4));
        if (map[a]) map[a](b, e);
      });
    },
    tap,

    // ---------- HUD por quadro ----------
    hud(dt) {
      const P = G.player;
      if (!P || el.hud.hidden) return;
      const hpF = P.hp / P.maxHp;
      setW(el.hpFill, hpF); setTxt(el.hpTxt, Math.max(0, Math.ceil(P.hp)) + ' / ' + P.maxHp);
      setW(el.huFill, G.hunger / 100); setCls(el.huFill.parentNode, 'low', G.hunger < 18);
      setW(el.stFill, P.stamina);
      const br = G.breath < 0.995;
      if (el.brBar.hidden === br) el.brBar.hidden = !br;
      if (br) setW(el.brFill, G.breath);
      setCls(el.vignette, 'low', hpF < 0.3 && !P.dead); setCls(el.vignette, 'hurt', G.hurtFlash > 0.7);
      const lp = G.levelProgress();
      setTxt(el.lvl, lp.level); setW(el.brainFill, lp.frac); setTxt(el.brainTxt, lp.cur + ' / ' + lp.need); setTxt(el.dna, G.dna);
      if (G.playerSp.rev !== lastRev) { lastRev = G.playerSp.rev; FG.Draw.portrait(el.portrait, G.playerSp, { angle: -0.7, shadow: false, fit: 0.9 }); dirty.ab = true; }
      // habilidades
      const social = G.stance === 'social', list = social ? Parts.SOCIAL : Parts.COMBAT, e = G.enc;
      if (dirty.ab) {
        dirty.ab = false;
        setCls(el.btnStance, 'combat', !social);
        el.btnStance.innerHTML = ic(social ? 'heart' : 'bite') + '<b class="key">Q</b>';
        el.btnStance.title = T(social ? 'ui.stanceS' : 'ui.stanceC');
        abBtns.forEach((b, i) => {
          const ab = list[i], lv = P.stats[ab] | 0;
          b.className = 'ab' + (social ? '' : ' combat') + (lv > 0 ? '' : ' off');
          b.querySelector('.g').innerHTML = ic(ab);
          let h = ''; for (let k = 1; k <= 5; k++) h += `<b class="${k <= lv ? 'on' : ''}"></b>`;
          b.querySelector('.lv').innerHTML = h;
          b.title = T('ab.' + ab) + ' ' + lv; b._want = false;
        });
        setCls(el.btnSneak, 'on', I.sneakTog); setCls(el.btnSprint, 'on', !S.data.holdSprint && I.sprintTog);
      }
      abBtns.forEach((b, i) => {
        const ab = list[i], f = social ? P.cd.social / 1.45 : P.cd[ab] / CD[ab];
        const hgt = Math.round(U.clamp(f, 0, 1) * 100);
        if (b._h !== hgt) { b._h = hgt; b.lastElementChild.style.height = hgt + '%'; }
        const want = social && S.data.hints && e && e.phase === 'ask' && e.want === ab;
        if (b._want !== want) { b._want = want; b.classList.toggle('want', want); }
      });
      // interação
      const it = G.interactable;
      if (!it || G.cine) { if (!el.prompt.hidden) el.prompt.hidden = true; }
      else {
        if (el.prompt.hidden) el.prompt.hidden = false;
        const key = it.type + (it.why || '');
        if (el.btnInteract._t !== key) {
          el.btnInteract._t = key;
          const icon = { fruit: 'leaf', meat: 'meat', egg: 'egg', dig: 'bone', recruit: 'paw', evolve: 'dna', awaken: 'brain', no: 'close' }[it.type];
          el.btnInteract.className = it.type === 'no' ? 'no' : '';
          el.btnInteract.innerHTML = (it.type === 'no' ? '' : '<kbd>E</kbd>') + ic(icon) + '<span>' + esc(T(it.type === 'no' ? (it.why === 'meat' ? 'i.noMeat' : 'i.noFruit') : 'i.' + it.type)) + '</span>';
        }
      }
      if ((slowT -= dt) <= 0) { slowT = 0.2; UI.slow(P); }
      if ((mmT -= dt) <= 0) { mmT = 0.12; FG.Render.minimap(el.minimap.getContext('2d'), 148); }
      if (S.data.showFps) { fpsN++; if ((fpsT += dt) >= 0.5) { setTxt(el.fps, Math.round(fpsN / fpsT) + ' fps · ' + G.creatures.length + ' · ' + FG.Render.quality); fpsT = 0; fpsN = 0; } }
    },
    /** Partes do HUD que mudam devagar. */
    slow(P) {
      // alvo
      const t = G.target;
      if (!t || t.gone) { if (!el.targetBox.hidden) el.targetBox.hidden = true; }
      else {
        if (el.targetBox.hidden) { el.targetBox.hidden = false; dirty.target = true; }
        const att = FG.Render.attitude(t), sp = t.sp, rel = G.rel(sp);
        if (dirty.target || el.tName._sp !== sp || el.tRel._a !== att) {
          dirty.target = false; el.tName._sp = sp; el.tRel._a = att;
          el.tName.textContent = FG.spName(sp) + (t.baby ? ' · ' + T('ui.baby') : '');
          el.tRel.className = 'rel ' + att; el.tHp.className = att;
          el.tNiche.innerHTML = ic(sp.diet === 'H' ? 'leaf' : sp.diet === 'C' ? 'meat' : 'mouth') + ' ' + esc(T('n.' + sp.niche)) + (sp.nocturnal ? ' · ' + ic('moon') : '');
          let pr;
          if (sp.isPlayer) pr = T('ui.yourSpecies');
          else if (t.ai && t.ai.pack) pr = T('ui.packMember');
          else if (rel.status === 'ally') pr = ic('heart') + ' ' + T('ui.allyS');
          else if (rel.status === 'extinct') pr = ic('skull') + ' ' + T('ui.extinctS');
          else pr = `${ic('heart')} ${rel.friends}/${sp.needFriends} &nbsp; ${ic('skull')} ${rel.kills}/${sp.needKills}`;
          el.tProg.innerHTML = pr;
        }
        setW(el.tHp, t.hp / t.maxHp);
      }
      // objetivo
      if (dirty.obj) {
        dirty.obj = false;
        const o = G.objective();
        el.objTxt.textContent = o ? T('o.' + o.id) : T('o.free');
      }
      const o = G.objective();
      if (o && o.prog) { const p = o.prog(G); setTxt(el.objTxt, T('o.' + o.id) + ' (' + Math.min(p[0], p[1]) + '/' + p[1] + ')'); }
      // bando
      if (dirty.pack) {
        dirty.pack = false;
        el.packBox.innerHTML = '';
        const max = G.packMax();
        for (let i = 0; i < max; i++) {
          const m = G.pack[i], d = document.createElement('button');
          d.type = 'button'; d.className = 'pk' + (m ? '' : ' empty');
          if (m) {
            const cv = document.createElement('canvas'); cv.width = cv.height = 72;
            FG.Draw.portrait(cv, m.sp, { angle: -0.7, shadow: false, fit: 0.9 });
            d.appendChild(cv); d.appendChild(document.createElement('i')); d.title = FG.spName(m.sp);
            tap(d, () => UI.open('confirm', { text: T('ui.dismissQ', FG.spName(m.sp)), yes: () => G.dismiss(m) }));
          } else { d.innerHTML = ic('paw'); d.title = T('ui.packEmpty'); }
          el.packBox.appendChild(d);
        }
      }
      G.pack.forEach((m, i) => { const d = el.packBox.children[i]; if (d && d.lastElementChild && d.lastElementChild.tagName === 'I') d.lastElementChild.style.transform = `scaleX(${U.clamp(m.hp / m.maxHp, 0, 1)})`; });
      // relógio e estados
      const hr = (6 + G.day * 24) % 24, hh = Math.floor(hr), mm = Math.floor((hr - hh) * 6) * 10, night = G.night > 0.5;
      const ck = (night ? 'n' : 'd') + hh + ':' + mm + (G.rain > 0.5 ? 'r' : '');
      if (el.clock._k !== ck) { el.clock._k = ck; el.clock.innerHTML = ic(night ? 'moon' : 'sun') + String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0') + (G.rain > 0.5 ? ic('drop') : ''); }
      const st = (G.resting ? 'r' : '') + (P.sneaking ? 's' : '') + (P.poison > 0 ? 'p' : '') + (G.hunger <= 0 ? 'h' : '');
      if (el.stateIcons._k !== st) {
        el.stateIcons._k = st;
        el.stateIcons.innerHTML = (G.resting ? `<span title="${esc(T('ui.resting'))}">${ic('nest')}</span>` : '') + (P.sneaking ? `<span>${ic('sneak')}</span>` : '') + (P.poison > 0 ? `<span style="color:#9be04a">${ic('drop')}</span>` : '') + (G.hunger <= 0 ? `<span style="color:#ffb46a">${ic('meat')}</span>` : '');
      }
    },
  };

  /** Clique que responde já no toque (sem atraso) e não vaza para o canvas. */
  function tap(b, fn) {
    b.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); fn(e); });
    b.addEventListener('click', (e) => { if (e.detail === 0) fn(e); });   // teclado (Enter/Espaço)
  }
})(window.FG = window.FG || {});
