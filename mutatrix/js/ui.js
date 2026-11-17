/* Mutatrix: interface em DOM (painel da máquina, cartões, contratos, loja, Mutapédia, ajustes, avisos). */
(function () {
  'use strict';
  const MX = window.MX;
  const { Data, Genetics, Subject, Contracts, Economy, Save, Words, Pix: X, Creature, VirusArt } = MX;
  const PAL = X.PAL;

  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const G = () => MX.Game.G;
  const act = () => MX.Game.act;

  // ---------------------------------------------------------------- ícones e miniaturas em pixel art (gerados pelo PixiJS)
  const icon = (n) => '<img class="ic" src="' + X.icon(n) + '" alt="" aria-hidden="true">';
  const thumbs = new Map();
  function thumb(key, fn, w, h) {
    let u = thumbs.get(key);
    if (!u) { u = X.snapshotURL(fn, w, h); thumbs.set(key, u); if (thumbs.size > 200) thumbs.delete(thumbs.keys().next().value); }
    return u;
  }
  function capsidThumb(id) {
    const vis = { capsid: id, color: '#41a6f6', color2: '#ff77a8', accent: '#ffcd75', spikes: 8, spikeLen: 0.35, wobble: 1, dots: 4, rot: 0.3, seed: 1 };
    return thumb('cap:' + id, (g) => VirusArt.draw(g, 15, 15, 7, vis, 0.6), 30, 30);
  }
  const hostPreview = {};
  function hostThumb(id) {
    if (!hostPreview[id]) hostPreview[id] = Subject.create(id, 'vitrine', 0);
    return thumb('host:' + id, (g) => {
      g.rect(0, 0, 76, 50).fill(0x3a4670);
      g.rect(0, 38, 76, 12).fill(0x6f8aa6);
      g.rect(0, 38, 76, 1).fill(0x566c86);
      Creature.portrait(g, hostPreview[id], 38, 43, id === 'robo' || id === 'planta' ? 15 : 13, 1);
    }, 76, 50);
  }
  function vialThumb(v) { return thumb('vial:' + v.key, (g) => VirusArt.vial(g, 17, 25, 44, v.visual, 0.5), 34, 50); }
  function clientThumb(seed) {
    return thumb('cli:' + seed, (g) => {
      const r = MX.RNG.make(seed);
      g.rect(0, 0, 26, 26).fill(r.pick([0x9fe2bf, 0xffcd75, 0xc9b8ff, 0xffaad4, 0x73eff7]));
      const skin = r.pick([0xf1c9a5, 0xd9a07a, 0xa8714f, 0x7a4b31, 0xf6dcc4]);
      const hair = r.pick([PAL.ink, PAL.brown, PAL.red, PAL.white, PAL.yellow, PAL.purple]);
      X.rect(g, 4, 21, 18, 6, r.pick([PAL.orange, PAL.teal, PAL.purple, PAL.blue]));
      const style = r.int(0, 3);
      if (style === 1) X.circ(g, 13, 12, 9, hair, { flat: true });
      X.ell(g, 13, 13, 7, 8, skin, { noHi: true });
      if (style === 0) X.rect(g, 6, 4, 14, 4, hair, { noOutline: true });
      if (style === 2) X.rect(g, 6, 5, 14, 3, hair);
      if (style === 3) { X.rect(g, 4, 6, 18, 2, PAL.ink); X.rect(g, 8, 1, 10, 5, PAL.ink); }
      g.rect(10, 12, 1, 2).fill(PAL.ink); g.rect(15, 12, 1, 2).fill(PAL.ink);
      if (r.chance(0.45)) { g.rect(8, 11, 4, 1).fill(PAL.ink); g.rect(14, 11, 4, 1).fill(PAL.ink); g.rect(12, 11, 2, 1).fill(PAL.ink); }
      if (r.chance(0.35)) g.rect(10, 16, 6, 1).fill(hair);
      g.rect(11, 17, 4, 1).fill(PAL.ink);
      g.rect(9, 15, 1, 1).fill(0xff77a8); g.rect(16, 15, 1, 1).fill(0xff77a8);
    }, 26, 26);
  }

  let els = {};
  let typeTarget = '', typeShown = 0, typeT = 0;
  let busyText = null;
  let subjectOpen = true;
  let modalKind = null;
  let panelCollapsed = false;

  function init() {
    els = {
      hud: $('#hud'), title: $('#title'), top: $('#topbar'), panel: $('#panel'), body: $('#panel-body'), subj: $('#subject-card'),
      term: $('#term-text'), cards: $('#cards'), toasts: $('#toasts'), modal: $('#modal'), fps: $('#fps'), handle: $('#drawer-handle'),
    };
    for (const el of $$('[data-icon]')) el.outerHTML = icon(el.dataset.icon);
    // logotipo em pixel art gerado pelo PixiJS
    const logo = $('#logo-img');
    if (logo) {
      const word = 'MUTATRIX', w = X.measure(word) + 8, h = 15;
      logo.src = X.snapshotURL((g) => {
        for (const oy of [0, 1]) for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, 1], [-1, 1], [1, -1]]) X.text(g, word, 3 + dx, 3 + oy + dy, PAL.ink);
        X.text(g, word, 3, 4, PAL.pink);
        X.text(g, word, 3, 3, PAL.yellow);
      }, w + 2, h);
    }
    document.addEventListener('click', onClick);
    document.addEventListener('input', onInput);
    document.addEventListener('change', onChange);
    els.handle.addEventListener('click', () => { panelCollapsed = !panelCollapsed; els.panel.classList.toggle('collapsed', panelCollapsed); setTimeout(() => MX.Game.resize(), 260); });
    const fsOk = document.fullscreenEnabled || document.webkitFullscreenEnabled;
    if (!fsOk) $$('[data-act="fullscreen"]').forEach((b) => (b.hidden = true));
    updateOrientation();
    subjectOpen = !(document.body.classList.contains('portrait') || document.body.classList.contains('compact'));
    window.addEventListener('resize', updateOrientation);
    // tooltips simples (desktop)
    document.addEventListener('pointerover', (e) => {
      const el = e.target.closest && e.target.closest('[data-tip]');
      if (!el || e.pointerType !== 'mouse') return;
      showTip(el);
    });
    document.addEventListener('pointerout', (e) => { const el = e.target.closest && e.target.closest('[data-tip]'); if (el) hideTip(); });
  }
  function updateOrientation() {
    const portrait = window.innerHeight > window.innerWidth * 1.05 || window.innerWidth < 640;
    document.body.classList.toggle('portrait', portrait);
    document.body.classList.toggle('compact', window.innerHeight < 520);
  }

  let tipEl = null;
  function showTip(el) {
    if (!tipEl) { tipEl = document.createElement('div'); tipEl.className = 'tip'; document.body.appendChild(tipEl); }
    tipEl.textContent = el.dataset.tip;
    const r = el.getBoundingClientRect();
    tipEl.style.display = 'block';
    const tw = tipEl.offsetWidth;
    tipEl.style.left = Math.max(6, Math.min(window.innerWidth - tw - 6, r.left + r.width / 2 - tw / 2)) + 'px';
    tipEl.style.top = (r.bottom + 8) + 'px';
  }
  function hideTip() { if (tipEl) tipEl.style.display = 'none'; }

  // ---------------------------------------------------------------- eventos
  function onClick(e) {
    const el = e.target.closest('[data-act]');
    if (!el || el.disabled) return;
    const a = el.dataset.act;
    const d = el.dataset;
    const A = act();
    MX.Audio.unlock();
    hideTip();
    switch (a) {
      case 'newGame': A.newGame(); break;
      case 'continue': A.continueGame(); break;
      case 'pickHost': A.pickHost(d.id); break;
      case 'capsid': A.setCapsid(d.id); break;
      case 'slot': openReagent(Number(d.i)); break;
      case 'reagent': A.setSlot(Number(d.i), d.theme, reagentPot); closeModal(); break;
      case 'pot': reagentPot = Number(d.p); { const s = G().state.design.slots[Number(d.i)]; if (s) A.setSlot(Number(d.i), s.theme, reagentPot); } openReagent(Number(d.i)); break;
      case 'clearSlot': A.setSlot(Number(d.i), null); closeModal(); break;
      case 'randomSeed': A.randomSeed(); break;
      case 'randomRecipe': A.randomRecipe(); break;
      case 'pasteCode': openCodeInput(); break;
      case 'applyCode': {
        const v = $('#code-input').value;
        const r = A.pasteCode(v);
        if (r.ok) { closeModal(); toast('Receita carregada.', 'good'); }
        else $('#code-err').textContent = r.reason;
        break;
      }
      case 'synth': A.synth(); break;
      case 'inject': A.inject(); break;
      case 'discard': A.discard(); break;
      case 'stabilize': A.stabilize(); break;
      case 'shelve': A.shelve(); break;
      case 'retire': A.retire(); break;
      case 'contracts': openContracts(); break;
      case 'deliver': A.deliver(Number(d.i)); break;
      case 'reroll': A.reroll(Number(d.i)); break;
      case 'shop': openShop(); break;
      case 'shopTab': openShop(d.cat); break;
      case 'buy': A.buy(d.id); break;
      case 'repair': A.repair(); break;
      case 'book': openBook(); break;
      case 'bookTab': openBook(d.tab); break;
      case 'unshelve': confirm('Esvaziar este pote? A cobaia conservada será descartada.', 'Esvaziar', () => { A.unshelve(Number(d.i)); openBook('prateleira'); }); break;
      case 'loadStrain': A.loadStrain(d.code); break;
      case 'copy': A.copy(d.text); break;
      case 'photo': A.photo(); break;
      case 'fullscreen': A.toggleFullscreen(); break;
      case 'pause': openPause(); break;
      case 'settings': openSettings(); break;
      case 'help': openHelp(); break;
      case 'toTitle': A.toTitle(); break;
      case 'close': closeModal(); break;
      case 'toggleSubject': subjectOpen = !subjectOpen; renderSubject(); MX.Game.resize(); break;
      case 'exportSave': { const ta = $('#save-code'); ta.value = A.exportSave(); ta.select(); A.copy(ta.value); break; }
      case 'importSave': { const ok = A.importSave($('#save-code').value); if (!ok) toast('Código de salvamento inválido.', 'bad'); else { closeModal(); toast('Laboratório importado.', 'good'); } break; }
      case 'wipeSave': confirm('Apagar todo o progresso salvo neste navegador? Não há como desfazer.', 'Apagar tudo', () => A.wipeSave()); break;
      case 'confirmYes': { const fn = confirmFn; confirmFn = null; closeModal(); if (fn) fn(); break; }
      case 'card': el.remove(); break;
      default: break;
    }
  }
  function onInput(e) {
    const el = e.target;
    const k = el.dataset && el.dataset.input;
    if (!k) return;
    if (k === 'virulence' || k === 'chaos') { act().setDial(k, Number(el.value)); const out = $('#v-' + k); if (out) out.textContent = el.value; }
    else if (k === 'seed') act().setSeed(el.value);
    else if (k.startsWith('set:')) {
      const key = k.slice(4);
      const v = el.type === 'checkbox' ? el.checked : el.type === 'range' ? Number(el.value) : el.value;
      act().setSetting(key, v);
      const out = el.parentElement.querySelector('output');
      if (out && el.type === 'range') out.textContent = Math.round(v * 100) + '%';
    }
  }
  function onChange(e) {
    const el = e.target;
    const k = el.dataset && el.dataset.input;
    if (k && k.startsWith('set:') && el.tagName === 'SELECT') {
      const key = k.slice(4);
      let v = el.value;
      if (key === 'fpsCap') v = Number(v);
      if (key === 'textScale') v = Number(v);
      if (key === 'reducedMotion') v = v === 'auto' ? null : v === 'sim';
      act().setSetting(key, v);
    }
  }

  // ---------------------------------------------------------------- tela de título
  function title(show, hasSave) {
    els.title.hidden = !show;
    els.hud.hidden = show;
    const c = $('#t-continue');
    if (c) c.hidden = !hasSave;
    if (show) closeModal();
    MX.Game.resize();
  }

  // ---------------------------------------------------------------- HUD
  function refresh(o) {
    o = o || {};
    const st = G().state;
    if (!st) return;
    $('#st-credits b').textContent = st.credits;
    $('#st-rep b').textContent = st.rep;
    $('#st-stab b').textContent = st.stabilizers;
    const sub = st.subject;
    const ready = sub ? st.contracts.filter((c) => Contracts.evaluate(c, sub).ok).length : 0;
    const badge = $('#btn-contracts .badge');
    badge.hidden = !ready; badge.textContent = ready;
    $('#btn-shop').classList.toggle('alert', st.damage.total > 0);
    renderSubject();
    if (o.soft) softPanel();
    else if (o.panel !== false) renderPanel();
    if (modalKind === 'contracts' && !o.soft) openContracts();
  }

  function sevChip(sevIdx) { const s = Data.SEVS[sevIdx]; return '<span class="sev sev-' + s.id + '">' + s.name + '</span>'; }
  function themeDot(themeId) { const t = Data.THEME[themeId]; return '<i class="dot" style="--c:' + t.color + '"></i>'; }

  let lastSubjShape = '';
  function renderSubject() {
    const st = G().state, sub = st && st.subject, a = G().anim;
    const shape = (sub ? 'v' : 'h') + subjectOpen;
    if (shape !== lastSubjShape) { lastSubjShape = shape; requestAnimationFrame(() => MX.Game.resize()); }
    if (!sub) { els.subj.hidden = true; return; }
    els.subj.hidden = false;
    els.subj.classList.toggle('closed', !subjectOpen);
    const vis = sub.mutations.filter((m) => !(a && a.hidden.has(m.uid)));
    const instab = Math.min(100, Math.round(sub.instab));
    const shownInstab = G().phase === 'seq' && G().lastRes && !G().lastRes.rejected ? Math.round(G().lastRes.instabBefore) : instab;
    const cls = shownInstab >= 85 ? 'crit' : shownInstab >= 60 ? 'warn' : '';
    els.subj.innerHTML = '<div class="sc-head"><div class="sc-id"><b>' + esc(sub.name) + '</b><small>' + esc(Data.HOST[sub.host].name) + ', ' + esc(sub.trait) + '</small></div>' +
      '<button class="icon-btn sm photo-btn" data-act="photo" aria-label="Ficha de espécime" data-tip="Ficha de espécime (P)">' + icon('camera') + '</button>' +
      '<button class="icon-btn sm tog" data-act="toggleSubject" aria-label="Mostrar ou esconder detalhes">' + icon('chevron') + '</button></div>' +
      '<div class="meter ' + cls + '"><div class="fill" style="width:' + shownInstab + '%"></div><span>Instabilidade ' + shownInstab + '%</span></div>' +
      '<div class="sc-stats"><span>Doses <b>' + sub.doses + '</b></span><span>Bizarrice <b>' + sub.biz + '</b></span><span>Mutações <b>' + vis.length + '</b></span></div>' +
      (vis.length ? '<ul class="mut-list">' + vis.map((m) => '<li title="' + esc(m.desc) + '">' + themeDot(m.theme) + '<span>' + esc(m.name) + (m.level > 1 ? ' <em>x' + m.level + '</em>' : '') + '</span>' + sevChip(m.sevIdx) + '</li>').join('') + '</ul>' : '<p class="empty">Ainda normal. Por enquanto.</p>') +
      (sub.synergies.length ? '<div class="syn-list">' + sub.synergies.map((id) => '<span class="syn">' + esc(Data.SYNERGY[id].name) + '</span>').join('') + '</div>' : '');
  }

  // ---------------------------------------------------------------- painel
  function renderPanel() {
    const g = G(), st = g.state;
    if (!st) return;
    const sub = st.subject;
    let html;
    if (!sub || !sub.alive) html = hostPicker();
    else if (g.virus) html = vialView();
    else html = composer();
    els.body.innerHTML = html + (busyText ? '<div class="busy"><div class="spinner"></div><p>' + esc(busyText) + '</p></div>' : '');
    drawPanelCanvases();
  }
  function softPanel() {
    const an = $('#analyzer');
    if (an) an.innerHTML = analyzerHTML(MX.Game.preview());
    const cost = $('#synth-cost');
    if (cost) cost.textContent = Economy.synthCost(G().state.design) + ' cr';
    const seed = $('[data-input="seed"]');
    if (seed && document.activeElement !== seed) seed.value = G().state.design.seed;
  }

  function hostPicker() {
    const st = G().state;
    const aff = (list) => list.map((t) => '<span class="tchip">' + themeDot(t) + Data.THEME[t].name + '</span>').join('');
    return '<div class="pnl"><h3 class="sec">Escolha a próxima cobaia</h3><p class="lead">Cada espécie adora alguns temas e detesta outros. Temas detestados pesam mais na instabilidade e podem ser rejeitados.</p><div class="host-grid">' +
      Data.HOSTS.map((h) => {
        const tol = h.tol <= 0.85 ? 'alta' : h.tol <= 1.05 ? 'média' : h.tol <= 1.15 ? 'baixa' : 'muito baixa';
        const poor = st.credits < h.cost;
        return '<button class="host' + (poor ? ' poor' : '') + '" data-act="pickHost" data-id="' + h.id + '"><img class="px" src="' + hostThumb(h.id) + '" alt="">' +
          '<div class="host-info"><b>' + h.name + '</b><span class="price">' + icon('coin') + h.cost + '</span></div>' +
          '<small>' + esc(h.desc) + '</small><small class="tol">Tolerância ' + tol + '</small>' +
          '<div class="aff"><span>Adora</span>' + aff(h.likes) + '</div><div class="aff no"><span>Detesta</span>' + aff(h.dislikes) + '</div></button>';
      }).join('') + '</div></div>';
  }

  function subjectActions() {
    const st = G().state;
    return '<div class="sub-actions">' +
      '<button class="btn sm" data-act="stabilize" data-tip="Reduz 25 pontos de instabilidade (E)"' + (st.stabilizers ? '' : ' disabled') + '>' + icon('pill') + 'Estabilizar <em>' + st.stabilizers + '</em></button>' +
      '<button class="btn sm" data-act="contracts" data-tip="Ver contratos e entregar (K)">' + icon('letter') + 'Entregar</button>' +
      '<button class="btn sm" data-act="shelve" data-tip="Conservar num pote da prateleira">' + icon('jar') + 'Conservar</button>' +
      '<button class="btn sm" data-act="retire" data-tip="Mandar para o sítio">' + icon('house') + 'Aposentar</button></div>';
  }

  function composer() {
    const st = G().state, d = st.design, u = st.unlocked;
    const cap = Data.CAPSID[d.capsid];
    const filled = d.slots.filter(Boolean).length;
    let html = '<div class="pnl">' + subjectActions();
    html += '<h3 class="sec">Capsídeo</h3><div class="capsids">' + Data.CAPSIDS.map((c) => {
      const locked = !u.capsids.includes(c.id);
      return '<button class="cap' + (c.id === d.capsid ? ' sel' : '') + (locked ? ' locked' : '') + '" data-act="capsid" data-id="' + c.id + '"' + (locked ? ' disabled data-tip="Disponível na loja"' : ' data-tip="' + esc(c.desc) + '"') + '><img class="px" src="' + capsidThumb(c.id) + '" alt=""><span>' + c.name + '</span>' + (locked ? icon('lock') : '') + '</button>';
    }).join('') + '</div><p class="cap-desc"><b>' + cap.name + ':</b> ' + esc(cap.desc) + '</p>';
    html += '<h3 class="sec">Fita genética <small>' + filled + ' de ' + u.slots + ' encaixes</small></h3><div class="tape">';
    for (let i = 0; i < 6; i++) {
      const s = d.slots[i];
      if (i >= u.slots) { html += '<button class="slot locked" disabled data-tip="Compre mais encaixes na loja">' + icon('lock') + '</button>'; continue; }
      if (!s) { html += '<button class="slot empty" data-act="slot" data-i="' + i + '" aria-label="Encaixe ' + (i + 1) + ' vazio"><b>+</b><small>' + (i + 1) + '</small></button>'; continue; }
      const t = Data.THEME[s.theme];
      html += '<button class="slot" data-act="slot" data-i="' + i + '" style="--c:' + t.color + '" aria-label="Encaixe ' + (i + 1) + ': ' + t.name + ' potência ' + s.pot + '"><span class="tn"><span class="full">' + t.name + '</span><span class="abbr">' + t.name.slice(0, 3).toUpperCase() + '</span></span><span class="pot">' + '<i></i>'.repeat(s.pot) + '</span></button>';
    }
    html += '</div>';
    html += '<h3 class="sec">Mostradores</h3>' +
      '<label class="dial"><span>Virulência</span><b id="v-virulence">' + d.virulence + '</b><input type="range" min="0" max="100" step="1" value="' + d.virulence + '" data-input="virulence" aria-label="Virulência"></label>' +
      '<label class="dial"><span>Caos</span><b id="v-chaos">' + d.chaos + '</b><input type="range" min="0" max="100" step="1" value="' + d.chaos + '" data-input="chaos" aria-label="Caos"></label>';
    html += '<div class="seed-row"><label class="seed"><span>Semente</span><input data-input="seed" maxlength="5" autocomplete="off" spellcheck="false" value="' + esc(d.seed) + '" aria-label="Semente"></label>' +
      '<button class="icon-btn" data-act="randomSeed" data-tip="Nova semente">' + icon('dice') + '</button>' +
      '<button class="btn sm" data-act="pasteCode" data-tip="Colar o código de uma cepa">' + icon('paste') + 'Código</button>' +
      '<button class="btn sm" data-act="randomRecipe" data-tip="Receita aleatória">' + icon('shuffle') + 'Surpresa</button></div>';
    html += '<div class="analyzer" id="analyzer">' + analyzerHTML(MX.Game.preview()) + '</div>';
    html += '<div class="synth-bar"><button class="btn primary big" data-act="synth"' + (filled ? '' : ' disabled') + '>' + icon('spark') + 'Sintetizar <span id="synth-cost">' + Economy.synthCost(d) + ' cr</span></button></div></div>';
    return html;
  }

  function analyzerHTML(v) {
    const st = G().state, sub = st.subject;
    const lvl = st.unlocked.analyzer;
    if (!v) return '<h4>Analisador <small>nível ' + lvl + '</small></h4><p class="empty">Encaixe reagentes para ver a previsão.</p>';
    const pr = Genetics.predict(v, lvl);
    let html = '<h4>Analisador <small>nível ' + lvl + '</small></h4><ul class="pred">';
    for (const p of pr) {
      html += '<li>' + (p.theme ? themeDot(p.theme.id) : '<i class="dot unknown"></i>') + '<span>' + (p.arch ? esc(p.arch) + ' <small>' + esc(p.themeName) + '</small>' : esc(p.themeName) + (p.group ? ' <small>' + esc(p.group) + '</small>' : ' <small>?</small>')) + '</span>' + (p.sev ? '<span class="sev sev-' + p.sev.id + '">' + p.sev.name + '</span>' : '<span class="sev unknown">?</span>') + '</li>';
    }
    html += '</ul>';
    if (sub && sub.alive) {
      const rej = Math.round(Subject.rejectChance(sub, v) * 100);
      const est = lvl >= 2 ? '+' + Subject.estimate(sub, v) + '%' : '?';
      html += '<div class="pred-foot"><span>Instabilidade estimada <b>' + est + '</b></span><span>Rejeição <b>' + rej + '%</b></span></div>';
    }
    if (lvl < 2) html += '<p class="hint">Um analisador melhor (loja) revela a classe de cada mutação.</p>';
    return html;
  }

  function vialView() {
    const v = G().virus;
    return '<div class="pnl vial">' + subjectActions() + '<div class="vial-box"><img class="px vial-img" src="' + vialThumb(v) + '" alt=""><div><h3 class="strain">' + esc(v.name) + '</h3>' +
      '<div class="code"><code>' + v.code + '</code><button class="icon-btn sm" data-act="copy" data-text="' + v.code + '" data-tip="Copiar código">' + icon('copy') + '</button></div>' +
      '<p class="lead">Capsídeo ' + Data.CAPSID[v.capsid].name + ', ' + v.mutations.length + (v.mutations.length > 1 ? ' mutações previstas.' : ' mutação prevista.') + '</p></div></div>' +
      '<div class="analyzer">' + analyzerHTML(v) + '</div>' +
      '<div class="synth-bar two"><button class="btn primary big" data-act="inject">' + icon('syringe') + 'Injetar</button><button class="btn" data-act="discard">' + icon('trash') + 'Descartar</button></div>' +
      '<p class="hint">Dica: arraste a seringa da bancada até a cobaia.</p></div>';
  }

  function drawPanelCanvases() { /* as miniaturas são imagens geradas pelo PixiJS */ }

  function frame(t) {
    // máquina de escrever do terminal
    if (typeShown < typeTarget.length) {
      typeT += 1;
      typeShown = Math.min(typeTarget.length, typeShown + (G().settings.fastAnim ? 4 : 2));
      els.term.textContent = typeTarget.slice(0, typeShown);
    }
  }
  function term(text) { typeTarget = text; typeShown = 0; }
  function fps(f, lvl, scale) {
    els.fps.hidden = !G().settings.showFps;
    if (!els.fps.hidden) els.fps.textContent = f + ' fps  q' + lvl + '  pixel x' + scale;
  }
  function busy(text) {
    busyText = text;
    document.body.classList.toggle('is-busy', !!text);
    renderPanel();
  }

  // ---------------------------------------------------------------- cartões e avisos
  function pushCard(html, cls, life) {
    const el = document.createElement('div');
    el.className = 'mcard ' + (cls || '');
    el.dataset.act = 'card';
    el.innerHTML = html;
    els.cards.appendChild(el);
    while (els.cards.children.length > 3) els.cards.firstChild.remove();
    const ms = (life || 6500) * (G().settings.fastAnim ? 0.6 : 1);
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 400); }, ms);
  }
  function mutCard(m, sub, intens) {
    const t = Data.THEME[m.theme];
    pushCard('<header><span class="sev sev-' + m.sev + '">' + Data.SEVS[m.sevIdx].name + '</span>' + (m.isNew ? '<span class="new">Nova na Mutapédia</span>' : '') + '</header>' +
      '<h4>' + esc(m.name) + (intens ? ' <small>intensificada, nível ' + m.level + '</small>' : '') + '</h4>' +
      '<p>' + esc(intens ? 'A mutação já existente ficou mais forte.' : m.desc) + '</p>' +
      '<footer>' + themeDot(m.theme) + t.name + ' · ' + Data.GROUP_NAME[m.group] + (m.wild ? ' · fora da receita' : '') + '</footer>', 'k-' + m.sev);
  }
  function synCard(syn) {
    pushCard('<header><span class="sev syn">Sinergia</span>' + (syn.isNew ? '<span class="new">Nova na Mutapédia</span>' : '') + '</header><h4>' + esc(syn.name) + '</h4><p>' + esc(syn.desc) + '</p><footer>' + themeDot(syn.a) + Data.THEME[syn.a].name + ' + ' + themeDot(syn.b) + Data.THEME[syn.b].name + ' · Instabilidade ' + (syn.instab > 0 ? '+' : '') + syn.instab + '%</footer>', 'syn');
  }
  function eventCard(title, desc, kind, isNew) {
    pushCard('<header><span class="sev ' + (kind === 'event' ? 'sev-destrutiva' : 'sev-inofensiva') + '">' + (kind === 'event' ? 'Desastre' : 'Rejeição') + '</span>' + (isNew ? '<span class="new">Novo na Mutapédia</span>' : '') + '</header><h4>' + esc(title) + '</h4><p>' + esc(desc) + '</p>', kind);
  }
  function clearCards() { els.cards.innerHTML = ''; }
  function toast(text, kind, ms) {
    const el = document.createElement('div');
    el.className = 'toast ' + (kind || '');
    el.textContent = text;
    els.toasts.appendChild(el);
    while (els.toasts.children.length > 3) els.toasts.firstChild.remove();
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 350); }, ms || 3000);
  }

  // ---------------------------------------------------------------- modais
  function modal(kind, titleText, html, foot, cls) {
    modalKind = kind;
    const m = els.modal;
    m.hidden = false;
    m.className = 'modal ' + (cls || '');
    $('.sheet h2', m).textContent = titleText;
    $('.content', m).innerHTML = html;
    const f = $('.sheet > footer', m);
    f.innerHTML = foot || '';
    f.hidden = !foot;
    $('.content', m).scrollTop = 0;
    if (MX.Audio.ready) MX.Audio.sfx.page();
  }
  function closeModal() {
    if (!els.modal) return;
    els.modal.hidden = true; modalKind = null;
    if (pendingRefresh) { pendingRefresh = false; refresh(); }
  }
  let pendingRefresh = false;
  function modalOpen() { return !!modalKind; }

  let confirmFn = null;
  function confirm(text, yes, fn) {
    confirmFn = fn;
    modal('confirm', 'Confirmação', '<p class="lead">' + esc(text) + '</p>', '<button class="btn" data-act="close">Cancelar</button><button class="btn primary" data-act="confirmYes">' + esc(yes || 'Confirmar') + '</button>', 'small');
  }

  let reagentPot = 2;
  function openReagent(i) {
    const st = G().state;
    if (!st || !st.subject || !st.subject.alive || G().phase !== 'idle' || G().virus) return;
    if (i >= st.unlocked.slots) { toast('Encaixe bloqueado. Compre mais encaixes na loja.', 'info'); return; }
    const cur = st.design.slots[i];
    if (cur) reagentPot = cur.pot;
    const host = Data.HOST[st.subject.host];
    let html = '<p class="lead">Escolha o reagente do encaixe ' + (i + 1) + '. A potência aumenta o peso do tema na mistura.</p>';
    html += '<div class="pot-row"><span>Potência</span>' + [1, 2, 3].map((p) => '<button class="seg' + (p === reagentPot ? ' sel' : '') + '" data-act="pot" data-p="' + p + '" data-i="' + i + '">' + '<i></i>'.repeat(p) + '</button>').join('') + '</div>';
    html += '<div class="reagents">' + Data.THEMES.map((t) => {
      const ok = st.unlocked.themes.includes(t.id);
      const tag = host.likes.includes(t.id) ? '<em class="like">adora</em>' : host.dislikes.includes(t.id) ? '<em class="hate">detesta</em>' : '';
      return '<button class="reagent' + (cur && cur.theme === t.id ? ' sel' : '') + (ok ? '' : ' locked') + '" style="--c:' + t.color + ';--c2:' + t.color2 + '" ' + (ok ? 'data-act="reagent" data-i="' + i + '" data-theme="' + t.id + '"' : 'disabled') + '><i class="blob"></i><b>' + t.name + '</b>' + (ok ? tag : '<em>loja</em>') + '</button>';
    }).join('') + '</div>';
    modal('reagent', 'Encaixe ' + (i + 1), html, (cur ? '<button class="btn" data-act="clearSlot" data-i="' + i + '">' + icon('trash') + 'Esvaziar</button>' : '') + '<button class="btn primary" data-act="close">Pronto</button>', 'small');
  }

  function openCodeInput() {
    modal('code', 'Colar código de cepa', '<p class="lead">Cole um código no formato MX-XXXXXX-XXXXXX-XXXXXX. A receita inteira é restaurada na máquina.</p><input id="code-input" class="text" autocomplete="off" spellcheck="false" placeholder="MX-..."><p id="code-err" class="err"></p>', '<button class="btn" data-act="close">Cancelar</button><button class="btn primary" data-act="applyCode">Carregar</button>', 'small');
    setTimeout(() => { const i = $('#code-input'); if (i) i.focus(); }, 50);
  }

  function openContracts() {
    const st = G().state;
    if (!st) return;
    const sub = st.subject;
    let html = '<p class="lead">' + (sub && sub.alive ? 'Requisitos conferidos com ' + esc(sub.name) + '. Quando todos ficarem verdes, é só entregar.' : 'Nenhuma cobaia viva na câmara. Os requisitos serão conferidos com a próxima.') + ' Reputação atual: ' + st.rep + ' (nível ' + Contracts.tierFor(st.rep) + ').</p><div class="contracts">';
    st.contracts.forEach((c, i) => {
      const ev = Contracts.evaluate(c, sub && sub.alive ? sub : null);
      html += '<article class="contract"><header><img class="px" src="' + clientThumb(c.client.seed) + '" alt=""><div><b>' + esc(c.client.name) + '</b><small>' + esc(c.client.title) + '</small></div><span class="stamp">Nível ' + c.tier + '</span></header>' +
        '<p class="letter">' + esc(c.letter) + '</p><ul class="reqs">' + ev.reqs.map((r) => '<li class="' + (r.ok ? 'ok' : 'no') + '">' + icon(r.ok ? 'check' : 'close') + esc(r.text) + '</li>').join('') + '</ul>' +
        (ev.bonus.length ? '<h5>Bônus</h5><ul class="reqs bonus">' + ev.bonus.map((r) => '<li class="' + (r.ok ? 'ok' : 'no') + '">' + icon(r.ok ? 'check' : 'close') + esc(r.text) + ' <em>+' + r.reward + '</em></li>').join('') + '</ul>' : '') +
        '<footer><span class="reward">' + icon('coin') + c.reward + (ev.bonus.length ? ' + bônus' : '') + ' · ' + icon('medal') + '+' + c.rep + '</span><div class="row"><button class="btn sm" data-act="reroll" data-i="' + i + '" data-tip="Trocar por outra encomenda">' + icon('shuffle') + '15</button><button class="btn primary sm" data-act="deliver" data-i="' + i + '"' + (ev.ok ? '' : ' disabled') + '>' + icon('letter') + 'Entregar</button></div></footer></article>';
    });
    html += '</div>';
    modal('contracts', 'Contratos', html, null, 'wide');
  }

  let shopCat = 'maquina';
  function openShop(cat) {
    const st = G().state;
    if (!st) return;
    if (cat) shopCat = cat;
    const rc = Economy.repairCost(st);
    let html = '';
    if (rc > 0) html += '<div class="repair">' + icon('wrench') + '<div><b>Danos no laboratório</b><small>Rachaduras, queimaduras e outras lembranças dos desastres. O conserto é opcional.</small></div><button class="btn primary sm" data-act="repair">Consertar · ' + rc + ' cr</button></div>';
    html += '<div class="tabs">' + Data.SHOP_CATS.map((c) => '<button class="tab' + (c.id === shopCat ? ' sel' : '') + '" data-act="shopTab" data-cat="' + c.id + '">' + c.name + '</button>').join('') + '</div><div class="shop-grid">';
    for (const it of Data.SHOP.filter((x) => x.cat === shopCat)) {
      const chk = Economy.canBuy(st, it);
      const owned = Economy.isOwned(st, it);
      html += '<article class="item' + (owned ? ' owned' : '') + '"><h5>' + esc(it.name) + '</h5><p>' + esc(it.desc) + '</p><footer><span class="price">' + icon('coin') + it.price + (it.rep ? ' <small>' + icon('medal') + it.rep + '</small>' : '') + '</span>' +
        (owned ? '<span class="stamp ok">Adquirido</span>' : '<button class="btn sm' + (chk.ok ? ' primary' : '') + '" data-act="buy" data-id="' + it.id + '"' + (chk.ok ? '' : ' disabled') + '>' + (chk.ok ? 'Comprar' : esc(chk.reason)) + '</button>') + '</footer></article>';
    }
    html += '</div>';
    modal('shop', 'Loja do Laboratório', html, '<span class="wallet">' + icon('coin') + st.credits + ' créditos · ' + icon('medal') + 'reputação ' + st.rep + ' · ' + icon('pill') + st.stabilizers + '</span>', 'wide');
  }

  let bookTab = 'mutacoes';
  function openBook(tab) {
    const st = G().state;
    if (!st) return;
    if (tab) bookTab = tab;
    const n = Economy.catalogCount(st), total = Economy.catalogTotal();
    const next = Data.MILESTONES.find((m) => !st.milestones.includes(m.n));
    let html = '<div class="progress"><div class="meter"><div class="fill" style="width:' + (n / total * 100).toFixed(1) + '%"></div><span>' + n + ' de ' + total + ' descobertas</span></div>' + (next ? '<small>Próximo marco: ' + esc(next.text) + '</small>' : '<small>Todos os marcos alcançados.</small>') + '</div>';
    const tabs = [['mutacoes', 'Mutações'], ['sinergias', 'Sinergias'], ['colapsos', 'Colapsos'], ['desastres', 'Desastres'], ['cepas', 'Cepas'], ['prateleira', 'Prateleira'], ['estatisticas', 'Números']];
    html += '<div class="tabs">' + tabs.map(([id, name]) => '<button class="tab' + (id === bookTab ? ' sel' : '') + '" data-act="bookTab" data-tab="' + id + '">' + name + '</button>').join('') + '</div>';
    if (bookTab === 'mutacoes') {
      html += '<table class="dex"><thead><tr><th>Mutação</th>' + Data.HOSTS.map((h) => '<th>' + h.short + '</th>').join('') + '</tr></thead><tbody>';
      let group = '';
      for (const a of Data.ARCH) {
        if (a.group !== group) { group = a.group; html += '<tr class="grp"><td colspan="5">' + Data.GROUP_NAME[group] + '</td></tr>'; }
        html += '<tr><td>' + esc(a.noun) + '</td>' + Data.HOSTS.map((h) => {
          const e = st.catalog.arch[a.id + '|' + h.id];
          return e ? '<td class="got" title="' + esc(e.name) + ' (' + e.count + 'x)">' + themeDot(e.theme) + '</td>' : '<td class="no">?</td>';
        }).join('') + '</tr>';
      }
      html += '</tbody></table>';
    } else if (bookTab === 'sinergias') {
      html += '<div class="entries">' + Data.SYNERGIES.map((s) => { const e = st.catalog.syn[s.id]; return '<article class="entry' + (e ? '' : ' unknown') + '"><h5>' + (e ? esc(s.name) : '???') + '</h5><p>' + themeDot(s.a) + Data.THEME[s.a].name + ' + ' + themeDot(s.b) + Data.THEME[s.b].name + '</p>' + (e ? '<p>' + esc(s.desc) + '</p>' : '<p>Combine estes dois temas na mesma cobaia.</p>') + '</article>'; }).join('') + '</div>';
    } else if (bookTab === 'colapsos') {
      html += '<div class="entries">' + Data.COLLAPSES.map((c) => { const e = st.catalog.col[c.id]; return '<article class="entry' + (e ? '' : ' unknown') + '"><h5>' + (e ? esc(c.name) : '???') + '</h5><p>' + (e ? esc(MX.Mutations.fill(c.desc, { c: 'A cobaia' })) : 'Leve uma cobaia além dos 100% de instabilidade para descobrir.') + '</p></article>'; }).join('') + '</div>';
    } else if (bookTab === 'desastres') {
      html += '<div class="entries">' + Data.THEMES.map((t) => { const ev = Data.EVENTS[t.event]; const e = st.catalog.ev[t.event]; return '<article class="entry' + (e ? '' : ' unknown') + '"><h5>' + (e ? esc(ev.name) : '???') + '</h5><p>' + themeDot(t.id) + 'Mutação Destrutiva de tema ' + t.name + '</p>' + (e ? '<p>' + esc(ev.desc) + '</p>' : '') + '</article>'; }).join('') + '</div>';
    } else if (bookTab === 'cepas') {
      html += st.strains.length ? '<ul class="strains">' + st.strains.map((s) => '<li><div><b>' + esc(s.name) + '</b><code>' + s.code + '</code></div><div class="row"><button class="icon-btn sm" data-act="copy" data-text="' + s.code + '" data-tip="Copiar">' + icon('copy') + '</button><button class="btn sm" data-act="loadStrain" data-code="' + s.code + '">Carregar</button></div></li>').join('') + '</ul>' : '<p class="empty">Nenhuma cepa sintetizada ainda.</p>';
    } else if (bookTab === 'prateleira') {
      html += '<p class="lead">' + st.shelf.length + ' de ' + st.unlocked.shelf + ' potes ocupados.</p>';
      html += st.shelf.length ? '<ul class="strains">' + st.shelf.map((e, i) => '<li><div><b>' + esc(e.sub.name) + (e.statue ? ' <small>(estátua)</small>' : '') + '</b><small>' + esc(Data.HOST[e.sub.host].name) + ', ' + e.sub.mutations.length + ' mutações, bizarrice ' + e.sub.biz + '</small></div><button class="btn sm" data-act="unshelve" data-i="' + i + '">' + icon('trash') + 'Esvaziar</button></li>').join('') + '</ul>' : '<p class="empty">Nenhuma cobaia conservada.</p>';
    } else {
      const s = st.stats;
      const rows = [['Cepas sintetizadas', s.synth], ['Injeções', s.inject], ['Rejeições', s.reject], ['Mutações provocadas', s.mutations], ['Colapsos', s.collapses], ['Desastres', s.events], ['Encomendas entregues', s.delivered], ['Cobaias conservadas', s.shelved], ['Aposentadorias', s.retired], ['Créditos ganhos', s.earned]];
      html += '<table class="stats">' + rows.map((r) => '<tr><td>' + r[0] + '</td><td>' + r[1] + '</td></tr>').join('') + '</table>';
    }
    modal('book', 'Mutapédia', html, null, 'wide');
  }

  function openSettings() {
    const s = G().settings;
    const sel = (key, opts, cur) => '<select data-input="set:' + key + '">' + opts.map(([v, l]) => '<option value="' + v + '"' + (String(v) === String(cur) ? ' selected' : '') + '>' + l + '</option>').join('') + '</select>';
    const sw = (key, label, desc) => '<label class="switch"><input type="checkbox" data-input="set:' + key + '"' + (s[key] ? ' checked' : '') + '><span class="knob"></span><div><b>' + label + '</b>' + (desc ? '<small>' + desc + '</small>' : '') + '</div></label>';
    const rng = (key, label) => '<label class="range"><span>' + label + '</span><input type="range" min="0" max="1" step="0.05" value="' + s[key] + '" data-input="set:' + key + '"><output>' + Math.round(s[key] * 100) + '%</output></label>';
    const inLab = G().screen === 'lab' && G().state;
    const html = '<section class="set"><h4>Gráficos</h4>' +
      '<label class="row-set"><span>Detalhe dos pixels</span>' + sel('quality', [['auto', 'Automático'], ['high', 'Alto (pixels menores)'], ['medium', 'Médio'], ['low', 'Baixo (pixels maiores, menos partículas)']], s.quality) + '</label>' +
      '<label class="row-set"><span>Limite de quadros</span>' + sel('fpsCap', [[60, '60 por segundo'], [30, '30 por segundo (economia)']], s.fpsCap) + '</label>' +
      sw('showFps', 'Mostrar FPS') + '</section>' +
      '<section class="set"><h4>Acessibilidade</h4>' + sw('shake', 'Tremor de tela', 'Desastres e explosões balançam a câmera.') + sw('flashes', 'Clarões', 'Explosões e implosões piscam a tela.') +
      '<label class="row-set"><span>Movimento reduzido</span>' + sel('reducedMotion', [['auto', 'Seguir o sistema'], ['sim', 'Ligado'], ['nao', 'Desligado']], s.reducedMotion === null ? 'auto' : s.reducedMotion ? 'sim' : 'nao') + '</label>' +
      '<label class="row-set"><span>Tamanho do texto</span>' + sel('textScale', [[1, '100%'], [1.15, '115%'], [1.3, '130%']], s.textScale) + '</label>' +
      sw('fastAnim', 'Animações rápidas', 'Síntese, revelações e colapsos mais curtos.') + sw('hints', 'Dicas', 'Mostra dicas nas primeiras jogadas.') + '</section>' +
      '<section class="set"><h4>Áudio</h4>' + rng('master', 'Volume geral') + rng('music', 'Música') + rng('sfx', 'Efeitos') + sw('vibrate', 'Vibração', 'Em celulares compatíveis.') + '</section>' +
      (inLab ? '<section class="set"><h4>Dados</h4><p class="lead">O jogo salva sozinho neste navegador. Para levar o laboratório para outro aparelho, exporte o código e importe lá.</p><textarea id="save-code" class="text" rows="3" spellcheck="false" placeholder="Código de salvamento"></textarea><div class="row"><button class="btn sm" data-act="exportSave">' + icon('copy') + 'Exportar</button><button class="btn sm" data-act="importSave">' + icon('paste') + 'Importar</button><button class="btn sm danger" data-act="wipeSave">' + icon('trash') + 'Apagar tudo</button></div></section>' : '') +
      '<section class="set"><h4>Atalhos</h4><p class="lead">Espaço: sintetizar ou injetar · 1 a 6: encaixes · E: estabilizar · K: contratos · L: loja · C: Mutapédia · P: ficha · F: tela cheia · Esc: pausa · setas: girar a cobaia.</p></section>';
    modal('settings', 'Configurações', html, '<button class="btn primary" data-act="close">Fechar</button>');
  }

  function openHelp() {
    modal('help', 'Como jogar', Words.HELP.map((h) => '<section class="help"><h4>' + esc(h.t) + '</h4><p>' + esc(h.p) + '</p></section>').join(''), '<button class="btn primary" data-act="close">Entendi</button>');
  }

  function openPause() {
    modal('pause', 'Pausa', '<div class="pause-menu"><button class="btn big primary" data-act="close">' + icon('play') + 'Continuar</button><button class="btn" data-act="settings">Configurações</button><button class="btn" data-act="help">Como jogar</button><button class="btn" data-act="toTitle">Tela inicial</button><a class="btn ghost" href="../index.html">Voltar à coleção</a></div>', null, 'small');
  }

  function obituary(c, sub, shelved) {
    pendingRefresh = true;
    modal('obituary', 'Relatório de Colapso', '<div class="obit"><span class="stamp big">' + esc(c.name) + '</span>' + (c.isNew ? '<span class="new">Novo na Mutapédia</span>' : '') +
      '<p class="lead">' + esc(c.desc) + '</p><table class="stats"><tr><td>Cobaia</td><td>' + esc(sub.name) + '</td></tr><tr><td>Mutações</td><td>' + sub.mutations.length + '</td></tr><tr><td>Doses</td><td>' + sub.doses + '</td></tr><tr><td>Bizarrice</td><td>' + sub.biz + '</td></tr><tr><td>Bolsa de pesquisa</td><td>+' + c.payout + ' cr</td></tr></table>' +
      (shelved ? '<p class="hint">A estátua foi para a prateleira.</p>' : '') + '</div>', '<button class="btn primary" data-act="close">Nova cobaia</button>', 'small');
  }
  function delivery(c, ev, sub) {
    const happy = ev.allBonus;
    const line = happy ? Words.DELIVERY_HAPPY[Math.floor(Math.random() * Words.DELIVERY_HAPPY.length)] : Words.DELIVERY_OK[Math.floor(Math.random() * Words.DELIVERY_OK.length)];
    modal('delivery', 'Encomenda entregue', '<div class="obit"><img class="px client-big" src="' + clientThumb(c.client.seed) + '" alt=""><p class="letter">"' + esc(line) + '"<br><small>' + esc(c.client.name) + ', ' + esc(c.client.title) + '</small></p>' +
      '<table class="stats"><tr><td>Pagamento</td><td>+' + c.reward + ' cr</td></tr>' + ev.bonus.map((b) => '<tr><td>' + esc(b.text) + '</td><td>' + (b.ok ? '+' + b.reward + ' cr' : '-') + '</td></tr>').join('') + '<tr><td>Reputação</td><td>+' + c.rep + '</td></tr><tr class="tot"><td>Total</td><td>+' + ev.reward + ' cr</td></tr></table></div>', '<button class="btn primary" data-act="close">Próxima cobaia</button>', 'small');
  }
  function photo(url, name) {
    modal('photo', 'Ficha de espécime', '<img class="photo" src="' + url + '" alt="Ficha de espécime">', '<button class="btn" data-act="close">Fechar</button><a class="btn primary" href="' + url + '" download="' + esc(name) + '">' + icon('download') + 'Baixar PNG</a>', 'small');
  }

  // Área da cena livre do painel e da barra superior (para posicionar câmara e máquina).
  function sceneRect(W, H) {
    if (!els.hud || els.hud.hidden) return { x: 0, y: 0, w: W, h: H };
    const top = els.top.getBoundingClientRect().bottom + 4;
    const pr = els.panel.getBoundingClientRect();
    let r;
    if (document.body.classList.contains('portrait')) {
      const sc = els.subj && !els.subj.hidden ? els.subj.getBoundingClientRect().bottom + 2 : top + 46;
      const y = Math.max(top, Math.min(sc, top + 140));
      r = { x: 0, y, w: W, h: Math.max(160, pr.top - y - 36) };
    } else r = { x: 0, y: top, w: Math.max(240, pr.left - 6), h: H - top - 44 };
    const root = document.documentElement.style;
    root.setProperty('--scene-x', r.x + 'px'); root.setProperty('--scene-y', r.y + 'px');
    root.setProperty('--scene-w', r.w + 'px'); root.setProperty('--scene-h', r.h + 'px');
    root.setProperty('--panel-top', pr.top + 'px');
    return r;
  }

  MX.UI = {
    init, title, refresh, renderPanel, term, toast, mutCard, synCard, eventCard, clearCards, busy, frame, fps,
    confirm, openReagent, openContracts, openShop, openBook, openSettings, openHelp, openPause, obituary, delivery, photo,
    closeModal, modalOpen, sceneRect, icon,
  };
})();
