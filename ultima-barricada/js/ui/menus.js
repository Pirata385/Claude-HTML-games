// Menus and persistence: main menu, new game, save/load slots (with export/import), settings,
// help, records, pause and game over. Storage failures (private mode, quota) are non-fatal.
(function (UB) {
  'use strict';
  const M = {};
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const KEY = { slot: (n) => `ub.save.${n}`, settings: 'ub.settings', records: 'ub.records' };
  const SLOTS = ['auto', '1', '2', '3'];

  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } },
    del(k) { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } },
  };
  M.store = store;

  let stack = [];
  M.show = function (id, push) {
    for (const s of document.querySelectorAll('.screen')) s.classList.toggle('show', s.id === id);
    if (push !== false) stack.push(id);
    $('tooltip').hidden = true;
  };
  M.hideAll = function () { for (const s of document.querySelectorAll('.screen')) s.classList.remove('show'); stack = []; };
  M.isOpen = () => !!document.querySelector('.screen.show');
  M.back = function () {
    stack.pop();
    const prev = stack[stack.length - 1];
    if (prev) M.show(prev, false);
    else if (UB.App.inGame) { M.hideAll(); UB.App.resumeFromMenu(); }
    else M.show('scrMain');
  };

  M.init = function () {
    for (const b of document.querySelectorAll('[data-back]')) b.onclick = () => { UB.Audio.play('click'); M.back(); };
    $('mNew').onclick = () => { openNew(); };
    $('mContinue').onclick = () => { if (load('auto')) M.hideAll(); };
    $('mLoad').onclick = () => openSlots('load');
    $('mHelp').onclick = () => M.show('scrHelp');
    $('mRecords').onclick = () => { renderRecords(); M.show('scrRecords'); };
    $('mSettings').onclick = () => { renderSettings(); M.show('scrSettings'); };
    $('pResume').onclick = () => { M.hideAll(); UB.App.resumeFromMenu(); };
    $('pSave').onclick = () => openSlots('save');
    $('pLoad').onclick = () => openSlots('load');
    $('pSettings').onclick = () => { renderSettings(); M.show('scrSettings'); };
    $('pHelp').onclick = () => M.show('scrHelp');
    $('pQuit').onclick = () => { UB.App.quitToMenu(); };
    $('oMenu').onclick = () => UB.App.quitToMenu();
    $('oSame').onclick = () => { const S = UB.App.S; M.hideAll(); UB.App.startNew(S.seed, S.difficulty); };
    $('oNew').onclick = () => openNew();
    $('nRandom').onclick = () => { $('nSeed').value = randomSeed(); };
    $('nStart').onclick = () => {
      M.hideAll();
      UB.App.startNew($('nSeed').value.trim() || randomSeed(), M.diff || 'normal');
    };
    $('importFile').onchange = (e) => {
      const f = e.target.files[0];
      if (!f) return;
      const r = new FileReader();
      r.onload = () => {
        try {
          const obj = JSON.parse(r.result);
          const data = obj.data || r.result;
          UB.App.loadState(typeof data === 'string' ? data : JSON.stringify(data));
          M.hideAll();
        } catch (err) { UB.HUD.toast('Arquivo de save inválido.'); }
      };
      r.readAsText(f);
      e.target.value = '';
    };
    $('helpBody').innerHTML = HELP;
    M.refreshMain();
  };

  M.refreshMain = function () { $('mContinue').hidden = !store.get(KEY.slot('auto')); };

  function randomSeed() {
    const words = ['cinza', 'ferrugem', 'aurora', 'abrigo', 'neblina', 'trilho', 'farol', 'vigia', 'brasa', 'eco', 'raiz', 'sereno', 'poeira', 'muralha', 'travessia'];
    return `${words[Math.floor(Math.random() * words.length)]}-${Math.floor(Math.random() * 900 + 100)}`;
  }
  function openNew() {
    $('nSeed').value = randomSeed();
    M.diff = M.diff || 'normal';
    const seg = $('nDiff');
    const descs = { easy: 'Hordas menores, mais recursos iniciais.', normal: 'A experiência pensada para o jogo.', hard: 'Hordas maiores e zumbis mais resistentes.', nightmare: 'Para quem já sobreviveu a tudo.' };
    const render = () => {
      seg.innerHTML = Object.entries(UB.DEF.DIFFICULTY).map(([k, d]) => `<button class="btn ${M.diff === k ? 'sel good' : ''}" data-d="${k}">${d.name}</button>`).join('');
      $('nDiffDesc').textContent = descs[M.diff];
    };
    seg.onclick = (e) => { const b = e.target.closest('[data-d]'); if (b) { M.diff = b.dataset.d; render(); } };
    render();
    M.show('scrNew');
  }

  // ---- save slots ---------------------------------------------------------------------------------------
  function meta(S) {
    return { day: S.day, nights: S.nights, score: UB.Game.score(S), seed: S.seed, difficulty: S.difficulty, survivors: S.units.length, date: new Date().toISOString() };
  }
  function save(slot) {
    const S = UB.App.S;
    if (!S || S.over) return false;
    const payload = JSON.stringify({ meta: meta(S), data: UB.Game.serialize(S) });
    const ok = store.set(KEY.slot(slot), payload);
    if (!ok) UB.HUD.toast('Não foi possível salvar (armazenamento indisponível).');
    M.refreshMain();
    return ok;
  }
  function load(slot) {
    const raw = store.get(KEY.slot(slot));
    if (!raw) { UB.HUD.toast('Slot vazio.'); return false; }
    try {
      const obj = JSON.parse(raw);
      UB.App.loadState(obj.data);
      return true;
    } catch (e) {
      UB.HUD.toast('Save corrompido ou de outra versão.');
      return false;
    }
  }
  M.autosave = function () { save('auto'); };
  M.quickSave = function () { if (save('1')) UB.HUD.toast('Jogo salvo no slot 1.'); };
  M.quickLoad = function () { if (load('1')) { M.hideAll(); UB.HUD.toast('Slot 1 carregado.'); } };

  function openSlots(mode) {
    $('slotTitle').textContent = mode === 'save' ? 'Salvar' : 'Carregar';
    const list = $('slotList');
    const render = () => {
      list.innerHTML = SLOTS.map((s) => {
        const raw = store.get(KEY.slot(s));
        let m = null;
        try { m = raw ? JSON.parse(raw).meta : null; } catch (e) { m = null; }
        const name = s === 'auto' ? 'Automático (todo amanhecer)' : `Slot ${s}`;
        const info = m ? `Dia ${m.day} · ${m.nights} noites · ${m.score} pts · ${m.survivors} sobreviventes<br><small>Seed “${esc(m.seed)}” · ${UB.DEF.DIFFICULTY[m.difficulty] ? UB.DEF.DIFFICULTY[m.difficulty].name : ''} · ${new Date(m.date).toLocaleString('pt-BR')}</small>` : '<small>Vazio</small>';
        const btns = [];
        if (mode === 'save' && s !== 'auto') btns.push(`<button class="btn good" data-s="save" data-slot="${s}">Salvar aqui</button>`);
        if (mode === 'load' && m) btns.push(`<button class="btn good" data-s="load" data-slot="${s}">Carregar</button>`);
        if (m) btns.push(`<button class="btn" data-s="export" data-slot="${s}" title="Baixar arquivo">Exportar</button>`, `<button class="btn bad" data-s="del" data-slot="${s}">Apagar</button>`);
        return `<div class="slot"><div class="info"><b>${name}</b><span>${info}</span></div><div class="row">${btns.join('')}</div></div>`;
      }).join('');
    };
    list.onclick = (e) => {
      const b = e.target.closest('[data-s]');
      if (!b) return;
      const slot = b.dataset.slot;
      UB.Audio.play('click');
      if (b.dataset.s === 'save') { if (save(slot)) UB.HUD.toast(`Salvo no slot ${slot}.`); render(); }
      else if (b.dataset.s === 'load') { if (load(slot)) M.hideAll(); }
      else if (b.dataset.s === 'del') { if (b.dataset.confirm) { store.del(KEY.slot(slot)); M.refreshMain(); render(); } else { b.dataset.confirm = '1'; b.textContent = 'Confirmar'; } }
      else if (b.dataset.s === 'export') {
        const raw = store.get(KEY.slot(slot));
        const blob = new Blob([raw], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `ultima-barricada-${slot}.json`;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      }
    };
    render();
    M.show('scrSlots');
  }

  // ---- settings -------------------------------------------------------------------------------------------
  const DEFAULTS = { master: 0.8, sfx: 0.8, amb: 0.5, shake: true, quality: 'high', ui: 1, edgeScroll: false, fps: false, paths: true, autopause: true, tips: true };
  M.loadSettings = function () {
    let s = {};
    try { s = JSON.parse(store.get(KEY.settings) || '{}'); } catch (e) { s = {}; }
    return Object.assign({}, DEFAULTS, s);
  };
  function saveSettings() { store.set(KEY.settings, JSON.stringify(UB.App.settings)); }
  function renderSettings() {
    const s = UB.App.settings;
    const range = (k, label) => `<div class="set-row"><span>${label}</span><input type="range" min="0" max="1" step="0.05" data-k="${k}" value="${s[k]}"></div>`;
    const toggle = (k, label) => `<div class="set-row"><span>${label}</span><button class="btn ${s[k] ? 'good' : ''}" data-t="${k}">${s[k] ? 'Ligado' : 'Desligado'}</button></div>`;
    const choice = (k, label, opts) => `<div class="set-row"><span>${label}</span><span class="row">${opts.map(([v, n]) => `<button class="btn ${s[k] === v ? 'sel good' : ''}" data-c="${k}" data-v="${v}">${n}</button>`).join('')}</span></div>`;
    $('setList').innerHTML = range('master', 'Volume geral') + range('sfx', 'Efeitos') + range('amb', 'Ambiente') +
      choice('quality', 'Qualidade', [['low', 'Baixa'], ['high', 'Alta']]) +
      choice('ui', 'Tamanho da interface', [[0.9, '90%'], [1, '100%'], [1.15, '115%'], [1.3, '130%']]) +
      toggle('tips', 'Dicas para iniciantes') + toggle('shake', 'Tremor de tela') + toggle('paths', 'Mostrar caminhos') + toggle('edgeScroll', 'Rolar pela borda (mouse)') +
      toggle('autopause', 'Pausar ao sair da aba') + toggle('fps', 'Mostrar FPS');
    const list = $('setList');
    list.oninput = (e) => { const k = e.target.dataset.k; if (k) { s[k] = +e.target.value; UB.App.applySettings(); saveSettings(); } };
    list.onclick = (e) => {
      const t = e.target.closest('[data-t]'), c = e.target.closest('[data-c]');
      if (t) s[t.dataset.t] = !s[t.dataset.t];
      else if (c) s[c.dataset.c] = c.dataset.c === 'ui' ? +c.dataset.v : c.dataset.v;
      else return;
      UB.App.applySettings(); saveSettings(); renderSettings();
    };
  }

  // ---- records & game over ---------------------------------------------------------------------------------
  function records() { try { return JSON.parse(store.get(KEY.records) || '[]'); } catch (e) { return []; } }
  M.addRecord = function (S) {
    const list = records();
    list.push({ score: S.finalScore || UB.Game.score(S), nights: S.nights, seed: S.seed, difficulty: S.difficulty, kills: S.stats.kills, date: new Date().toISOString() });
    list.sort((a, b) => b.score - a.score);
    store.set(KEY.records, JSON.stringify(list.slice(0, 12)));
    return list.findIndex((r) => r.seed === S.seed && r.score === (S.finalScore || UB.Game.score(S)));
  };
  function renderRecords() {
    const list = records();
    $('recList').innerHTML = list.length ? list.map((r, i) => `<div class="rec"><span>${i + 1}. <b>${r.score}</b> pts · ${r.nights} noites</span><span class="muted small">“${esc(r.seed)}” · ${UB.DEF.DIFFICULTY[r.difficulty] ? UB.DEF.DIFFICULTY[r.difficulty].name : ''}</span></div>`).join('') : '<p class="muted">Nenhuma partida terminada ainda.</p>';
  }
  M.gameOver = function (S) {
    if (!S.finalScore) S.finalScore = UB.Game.score(S);
    const rank = M.addRecord(S);
    store.del(KEY.slot('auto'));
    M.refreshMain();
    $('overTitle').textContent = S.over === 'hq' ? 'O QG caiu' : 'Não restou ninguém';
    const st = S.stats;
    const mem = S.memorial.length ? `<h3>Memorial</h3><ul class="memorial">${S.memorial.map((m) => `<li><b>${esc(m.name)}</b> — ${UB.DEF.ROLES[m.role] ? UB.DEF.ROLES[m.role].name : ''}, dia ${m.day}: ${esc(m.cause)}</li>`).join('')}</ul>` : '';
    $('overBody').innerHTML = `<p class="muted">Seed “${esc(S.seed)}” · ${UB.DEF.DIFFICULTY[S.difficulty].name}${rank === 0 ? ' · <span class="good-t">Novo recorde!</span>' : ''}</p>
      <div class="stat-grid">
        <div><b>${S.finalScore}</b>pontos</div><div><b>${S.nights}</b>noites sobrevividas</div><div><b>${st.kills}</b>zumbis abatidos</div>
        <div><b>${st.loots}</b>buscas feitas</div><div><b>${st.built}</b>construções</div><div><b>${st.recruits}</b>resgatados</div>
        <div><b>${st.nests || 0}</b>ninhos destruídos</div><div><b>${st.deaths}</b>mortes</div><div><b>${UB.Objectives.count(S)}</b>objetivos</div>
      </div>${mem}`;
    M.show('scrOver');
  };

  const HELP = `
    <p>Você comanda um pequeno grupo de sobreviventes. De dia, colete recursos, construa e explore. Ao anoitecer chega uma horda — cada noite maior que a anterior. A partida não tem fim: sobreviva o máximo que puder. O jogo acaba se o <b>QG</b> cair ou se todos morrerem.</p>
    <h3>Ciclo do dia</h3>
    <ul><li><b>Dia</b>: colete madeira (árvores) e sucata (carros, destroços), construa defesas e saqueie locais próximos.</li>
    <li><b>Crepúsculo</b>: um alarme indica de onde a horda virá (setas vermelhas na borda da tela e no mapa).</li>
    <li><b>Noite</b>: zumbis seguem até o QG e atacam o que estiver no caminho. Sobreviventes em modo automático sobem nas torres e defendem a base.</li>
    <li><b>Amanhecer</b>: cada sobrevivente come 3 de comida. Sem comida há fome; com fome e moral baixa, pessoas morrem ou vão embora.</li></ul>
    <h3>Ordens</h3>
    <ul><li><b>Computador</b>: clique seleciona, arraste para selecionar vários, <b>botão direito</b> dá a ordem conforme o alvo (chão = mover, zumbi = atacar, árvore/carro = coletar, local = saquear, torre = guarnecer, horta/oficina = trabalhar, obra = construir).</li>
    <li><b>Celular</b>: toque seleciona; com alguém selecionado, toque no alvo para dar a ordem. Toque longo e arraste seleciona vários. Arraste move a câmera; pinça dá zoom.</li>
    <li>Atalhos: <kbd>Espaço</kbd> pausa (dá para dar ordens pausado), <kbd>+</kbd>/<kbd>−</kbd> velocidade, <kbd>B</kbd> construir, <kbd>1</kbd>–<kbd>4</kbd> esquadrões (<kbd>Ctrl</kbd>+número define), <kbd>A</kbd> atacar-mover, <kbd>S</kbd> segurar, <kbd>H</kbd> ir à base, <kbd>Tab</kbd> próximo ocioso, <kbd>R</kbd> reparar, <kbd>U</kbd> melhorar, <kbd>Del</kbd> demolir, <kbd>WASD</kbd>/setas câmera, <kbd>F6</kbd>/<kbd>F9</kbd> salvar/carregar rápido.</li></ul>
    <h3>Base e economia</h3>
    <ul><li>Construa dentro do <b>território</b> do QG (melhore o QG para ampliá-lo). Obras são erguidas por sobreviventes livres; engenheiros são 2× mais rápidos.</li>
    <li><b>Barricadas, muros e portões</b> bloqueiam a horda. Zumbis contornam muros quando existe uma brecha e, se a base estiver fechada, atacam o ponto mais fraco — use isso para criar gargalos. Portões deixam seus sobreviventes passar.</li>
    <li><b>Torres</b> protegem e ampliam o alcance de quem está nelas. <b>Metralhadoras</b> e <b>holofotes</b> precisam de energia de um <b>gerador</b>, que queima combustível.</li>
    <li><b>Horta</b> (comida) e <b>Oficina</b> (sucata → munição, armas) precisam de trabalhadores. <b>Abrigos</b> dão camas: sem camas a moral cai e novos sobreviventes não podem entrar.</li>
    <li>Sem munição, sobreviventes lutam com tacos. Mordidas precisam de <b>remédios</b> (médico por perto ou enfermaria) — senão a pessoa vira zumbi.</li></ul>
    <h3>Exploração</h3>
    <ul><li>Cada local tem perigo (☠) e recompensas próprias: hospital (remédios), delegacia (munição, armas, projetos), posto (combustível — cuidado com tiros perto das bombas), supermercado (comida), ferragens, fábrica, fazenda, acampamentos (sobreviventes para resgatar) e ninhos (que geram zumbis até serem destruídos).</li>
    <li>Saquear leva tempo, faz barulho e pode acordar o que está lá dentro. O que é encontrado vai na mochila: volte à base para guardar. Se alguém morrer, a mochila fica no chão.</li>
    <li>Tiros atraem zumbis próximos. Chuva abafa o barulho; neblina reduz a visão.</li></ul>`;

  UB.Menus = M;
})(globalThis.UB = globalThis.UB || {});
