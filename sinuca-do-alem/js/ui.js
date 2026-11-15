/* Sinuca do Além — interface em DOM: HUD da mesa, balcão, portas, comanda, menus e configurações. */
(function (g) {
  'use strict';
  const SA = g.SA, D = SA.Data, G = SA.Game, Rn = SA.Render, Au = SA.Audio;
  const UI = (SA.UI = { overlay: null, base: null, shownScore: 0 });
  const $ = (id) => document.getElementById(id);
  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const SCREENS = ['menu', 'new', 'cleared', 'shop', 'doors', 'over', 'pause', 'settings', 'how', 'almanac', 'bag'];
  let bannerT = 0, toastT = 0, newCue = 'boteco', newDiff = 'normal', almTab = 'r', bagSel = -1, lastRelKey = '', lastChalkKey = '';

  // ---------- navegação ----------
  function render() {
    for (const s of SCREENS) $('s-' + s).classList.toggle('hidden', s !== (UI.overlay || UI.base));
    const inTable = !UI.base && !!G.run && !!G.T;
    $('hud').classList.toggle('hidden', !inTable);
    G.paused = !!UI.overlay && inTable;
    closePop(); $('spinpad').classList.add('hidden');
  }
  UI.setBase = function (id) { UI.base = id; UI.overlay = null; render(); };
  UI.open = function (id) { UI.overlay = id; render(); Au.ui(); };
  UI.back = function () { UI.overlay = null; render(); Au.ui(); if (UI.base === 'shop') UI.showShop(); };

  UI.banner = function (title, sub, kind, ms) {
    const b = $('banner');
    b.className = kind === 'boss' ? 'boss' : '';
    b.querySelector('h2').textContent = title;
    const p = b.querySelector('p'); p.textContent = sub || ''; p.style.display = sub ? '' : 'none';
    clearTimeout(bannerT);
    bannerT = setTimeout(() => { b.classList.add('out'); bannerT = setTimeout(() => b.classList.add('hidden'), 360); }, ms || 1800);
  };
  UI.toast = function (text) {
    const t = $('toast');
    t.textContent = text; t.classList.remove('hidden');
    t.style.animation = 'none'; void t.offsetWidth; t.style.animation = '';
    clearTimeout(toastT); toastT = setTimeout(() => t.classList.add('hidden'), 2400);
  };

  // ---------- popover de informação ----------
  function closePop() { $('pop').classList.add('hidden'); }
  UI.closePop = closePop;
  function pop(o) {
    const p = $('pop');
    p.innerHTML = '<h4>' + esc(o.title) + '</h4>' + (o.rar ? '<div class="rar">' + esc(o.rar) + '</div>' : '') + '<p>' + esc(o.desc) + '</p>';
    if (o.actions && o.actions.length) {
      const row = el('div', 'row end wrap');
      for (const a of o.actions) { const b = el('button', 'btn ' + (a.cls || ''), esc(a.label)); b.onclick = (e) => { e.stopPropagation(); closePop(); a.fn(); }; row.appendChild(b); }
      p.appendChild(row);
    }
    p.classList.remove('hidden');
  }
  document.addEventListener('pointerdown', (e) => {
    if (!$('pop').classList.contains('hidden') && !e.target.closest('#pop') && !e.target.closest('.coaster,.giz')) closePop();
    if (!$('spinpad').classList.contains('hidden') && !e.target.closest('#spinpad') && !e.target.closest('#btn-spin')) $('spinpad').classList.add('hidden');
  }, true);

  function relicCoaster(rel, onTap) {
    const d = D.RELICS[rel.id], c = el('button', 'coaster r' + d.rar, d.icon);
    c.title = d.name; c.onclick = (e) => { e.stopPropagation(); onTap(); };
    return c;
  }
  function chalkEl(id, onTap) {
    const d = D.CHALKS[id], c = el('button', 'giz', d.icon);
    c.style.background = d.color; c.title = d.name;
    if (onTap) c.onclick = (e) => { e.stopPropagation(); onTap(); };
    return c;
  }
  function relicDesc(rel) { const d = D.RELICS[rel.id]; return d.desc + (d.info ? ' (' + d.info(rel) + ')' : ''); }

  // ---------- HUD ----------
  UI.showTable = function () { UI.setBase(null); UI.shownScore = G.T.score; $('score').textContent = SA.fmt(G.T.score); lastRelKey = lastChalkKey = ''; $('tally').classList.add('hidden'); UI.hud(); };
  UI.hud = function () {
    const run = G.run, T = G.T;
    if (!run || !T || T.target == null) return;
    $('target').textContent = SA.fmt(T.target);
    $('bar-fill').style.width = Math.min(100, (T.score / T.target) * 100) + '%';
    $('bar-fill').classList.toggle('done', T.score >= T.target);
    $('coin-n').textContent = run.coins;
    $('tname').innerHTML = (run.act >= 3 ? 'Além ∞' : 'Ato ' + (T.act + 1)) + ' · Mesa ' + (T.idx + 1) + '/3<br>' + esc(T.name);
    const sh = $('shots'), n = Math.max(T.shotsMax, T.shotsLeft);
    sh.innerHTML = '';
    for (let i = 0; i < n; i++) { const s = el('i'); if (i >= T.shotsLeft) s.className = 'used'; else if (T.shotsLeft === 1) s.className = 'last'; sh.appendChild(s); }
    sh.title = T.shotsLeft + ' tacadas';
    // amuletos
    const rk = run.relics.map((r) => r.id).join(',');
    if (rk !== lastRelKey) {
      lastRelKey = rk;
      const box = $('relics'); box.innerHTML = '';
      run.relics.forEach((rel) => box.appendChild(relicCoaster(rel, () => pop({ title: D.RELICS[rel.id].name, rar: 'Amuleto · ' + D.RAR_NAME[D.RELICS[rel.id].rar], desc: relicDesc(rel) }))));
      for (let i = run.relics.length; i < 6; i++) box.appendChild(el('div', 'coaster empty'));
    }
    const ck = run.chalks.join(',') + '|' + G.armed;
    if (ck !== lastChalkKey) {
      lastChalkKey = ck;
      const box = $('chalks'); box.innerHTML = '';
      run.chalks.forEach((id, i) => {
        const d = D.CHALKS[id], c = chalkEl(id, () => {
          if (d.instant) pop({ title: d.name, rar: 'Giz · uso imediato', desc: d.desc, actions: [{ label: 'Usar agora', cls: 'gold', fn: () => G.useChalk(i) }] });
          else { G.useChalk(i); if (G.armed === i) pop({ title: d.name, rar: 'Giz · pronto para a próxima tacada', desc: d.desc, actions: [{ label: 'Desarmar', fn: () => G.useChalk(i) }] }); else closePop(); }
        });
        if (G.armed === i) c.classList.add('armed');
        box.appendChild(c);
      });
      for (let i = run.chalks.length; i < 3; i++) box.appendChild(el('div', 'giz empty'));
    }
    // avisos
    const st = $('status'); st.innerHTML = '';
    const add = (t, cls) => st.appendChild(el('span', cls, t));
    const boss = T.boss ? D.BOSSES[T.boss] : null;
    if (boss) add(boss.icon + ' ' + esc(boss.name), 'boss');
    if (T.streak > 0) add('🔥 Sequência ' + T.streak, 'hot');
    if (T.windNow) {
      const a = Rn.project(0, 0, 0), b = Rn.project(T.windNow.x, T.windNow.y, 0), deg = (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI;
      add('🌬️ <b style="display:inline-block;transform:rotate(' + deg.toFixed(0) + 'deg)">➜</b>');
    }
    if (T.wager) add('🎲 Aposta');
    $('power').classList.toggle('hidden', G.settings.control !== 'classic');
    $('btn-fast').classList.toggle('on', G.fast);
    const hint = $('hint');
    if (run.stats.shots < 2 && G.state === 'aim') { hint.textContent = G.settings.control === 'sling' ? 'Toque em qualquer lugar, arraste para trás e solte' : 'Arraste para mirar · puxe a barra de força e solte'; hint.style.opacity = 0.9; } else hint.style.opacity = 0;
    UI.spinDot();
  };
  UI.spinDot = function () {
    const A = G.aim;
    $('spin-dot').style.transform = 'translate(' + A.spinX * 13 + 'px,' + -A.spinY * 13 + 'px)';
    $('spin-mark').style.transform = 'translate(' + A.spinX * 64 + 'px,' + -A.spinY * 64 + 'px)';
  };
  UI.tally = function (shot) {
    const t = $('tally');
    t.classList.remove('hidden', 'final', 'foul');
    $('t-chips').textContent = SA.fmt(shot.chips);
    $('t-mult').textContent = SA.fmtMult(shot.mult * shot.xmult);
    $('t-total').textContent = '';
    t.classList.remove('bump'); void t.offsetWidth; t.classList.add('bump');
    t.style.opacity = shot.chips > 0 || shot.pocketed.length ? 1 : 0;
  };
  UI.tallyDone = function (shot, total) {
    const t = $('tally');
    if (total <= 0 && !shot.scratch) { t.classList.add('hidden'); return; }
    $('t-chips').textContent = SA.fmt(shot.chips); $('t-mult').textContent = SA.fmtMult(shot.mult * shot.xmult);
    $('t-total').textContent = '= ' + SA.fmt(total) + (shot.scratch ? ' (falta ÷2)' : '');
    t.style.opacity = 1;
    t.classList.toggle('foul', !!shot.scratch);
    t.classList.remove('bump', 'final'); void t.offsetWidth; t.classList.add('final');
    if (shot.notes.length) UI.toast(shot.notes.join(' · '));
    setTimeout(() => { if (G.state !== 'sim') t.classList.add('hidden'); }, 1500);
  };
  UI.frame = function (dt) {
    const T = G.T;
    if (!T || T.score == null) return;
    if (UI.shownScore !== T.score) {
      const d = T.score - UI.shownScore;
      UI.shownScore = Math.abs(d) < 1 ? T.score : UI.shownScore + d * Math.min(1, dt * 7);
      $('score').textContent = SA.fmt(UI.shownScore);
    } else if ($('score').textContent === '') $('score').textContent = SA.fmt(T.score);
    if (G.settings.control === 'classic') {
      const p = G.aim.power * 100;
      $('power-fill').style.height = p + '%'; $('power-knob').style.top = p + '%';
    }
  };

  // ---------- menu ----------
  UI.showMenu = function () {
    $('m-continue').classList.toggle('hidden', !G.saved);
    const m = G.meta;
    $('m-stats').textContent = m.runs ? 'Noites: ' + m.runs + ' · Vitórias: ' + m.wins + ' · Melhor tacada: ' + SA.fmt(m.bestShot) + ' · Mais fundo: ' + m.deepest + ' mesas' : 'Primeira vez por aqui? A casa explica tudo na primeira mesa.';
    $('m-fs').classList.toggle('hidden', !SA.canFullscreen());
    UI.setBase('menu');
  };
  function showNew() {
    const list = $('cue-list'); list.innerHTML = '';
    for (const id of D.CUE_IDS) {
      const c = D.CUES[id], locked = c.need && G.meta.unlock < c.need;
      const card = el('button', 'card' + (id === newCue ? ' sel' : '') + (locked ? ' locked' : ''),
        '<div class="top"><div class="coaster">' + (locked ? '🔒' : c.icon) + '</div><h4>' + esc(c.name) + '</h4></div><p>' + esc(locked ? c.lock : c.desc) + '</p><p><b>' + esc(locked ? '' : c.perk) + '</b></p>');
      card.onclick = () => { if (locked) { Au.nope(); UI.toast(c.lock); return; } newCue = id; Au.ui(); showNew(); };
      list.appendChild(card);
    }
    const dl = $('diff-list'); dl.innerHTML = '';
    for (const id in D.DIFFS) { const b = el('button', id === newDiff ? 'on' : '', esc(D.DIFFS[id].name)); b.title = D.DIFFS[id].desc; b.onclick = () => { newDiff = id; Au.ui(); showNew(); }; dl.appendChild(b); }
    UI.setBase('new');
  }

  // ---------- comanda (mesa vencida) ----------
  UI.showCleared = function (pay) {
    $('cl-title').textContent = pay.finale ? 'A NOITE É SUA!' : pay.boss ? 'Chefe derrotado!' : 'Mesa vencida!';
    $('cl-sub').textContent = 'Você fez ' + SA.fmt(pay.score) + ' de ' + SA.fmt(pay.target) + ' pontos.' + (pay.finale ? ' O Além inteiro ficou te devendo uma.' : '');
    const box = $('cl-lines'); box.innerHTML = '';
    for (const l of pay.lines) box.appendChild(el('div', '', '<span>' + esc(l[0]) + '</span><b>+' + l[1] + ' 🪙</b>'));
    $('cl-total').innerHTML = '<span>TOTAL</span><span>+' + pay.total + ' 🪙</span>';
    $('cl-extra').textContent = pay.extra.length ? 'Prêmio: ' + pay.extra.join(', ') : '';
    const btns = $('cl-btns'); btns.innerHTML = '';
    const mk = (label, cls, fn) => { const b = el('button', 'btn ' + cls, label); b.onclick = fn; btns.appendChild(b); };
    if (pay.finale) { mk('Encerrar a noite', 'ghost', () => G.endVictory()); mk('Seguir no Além ∞', 'big gold', () => G.goEndless()); } else mk('Ir ao balcão →', 'big gold', () => { G.state = 'shop'; UI.showShop(); });
    setTimeout(() => UI.setBase('cleared'), 900);
  };

  // ---------- balcão ----------
  UI.showShop = function () {
    const run = G.run;
    if (!run.shop) return;
    $('shop-coins').textContent = run.coins;
    const box = $('shop-items'); box.innerHTML = '';
    run.shop.items.forEach((it, i) => {
      let head, kind, name, desc, kcls = '';
      if (it.kind === 'relic') { const d = D.RELICS[it.id]; head = '<div class="coaster r' + d.rar + '">' + d.icon + '</div>'; kind = 'Amuleto · ' + D.RAR_NAME[d.rar]; kcls = ' r' + d.rar; name = d.name; desc = d.desc; } else if (it.kind === 'ball') { const d = D.SPECIAL[it.id]; head = '<span class="bi"></span>'; kind = 'Bola · ' + d.pts + ' pts'; name = d.name; desc = d.desc; } else { const d = D.CHALKS[it.id]; head = '<div class="giz" style="background:' + d.color + '">' + d.icon + '</div>'; kind = 'Giz · uso único'; name = d.name; desc = d.desc; }
      const price = G.price(it.price);
      const card = el('div', 'card' + (it.sold ? ' sold' : ''), '<div class="top">' + head + '<div><div class="kind' + kcls + '">' + esc(kind) + '</div><h4>' + esc(name) + '</h4></div></div><p>' + esc(desc) + '</p>');
      if (it.kind === 'ball') { const d = D.SPECIAL[it.id]; card.querySelector('.bi').replaceWith(Rn.ballIcon({ color: d.color, glyph: d.glyph }, 46)); }
      const b = el('button', 'btn buy' + (run.coins < price && !it.sold ? ' off' : ''), it.sold ? 'Levado' : '🪙 ' + price);
      b.disabled = it.sold;
      b.onclick = () => { const err = G.buy(i); if (err && err !== 'x') UI.toast(err); UI.showShop(); };
      card.appendChild(b);
      box.appendChild(card);
    });
    $('shop-rel-n').textContent = '(' + run.relics.length + '/6 — toque para ver ou vender)';
    const rb = $('shop-relics'); rb.innerHTML = '';
    run.relics.forEach((rel, i) => {
      const d = D.RELICS[rel.id], val = Math.floor(D.RELIC_PRICE[d.rar] / 2);
      rb.appendChild(relicCoaster(rel, () => pop({ title: d.name, rar: 'Amuleto · ' + D.RAR_NAME[d.rar], desc: relicDesc(rel), actions: [{ label: 'Vender (+' + val + ' 🪙)', cls: 'danger', fn: () => { G.sellRelic(i); UI.showShop(); } }] })));
    });
    if (!run.relics.length) rb.appendChild(el('span', 'small', 'Nenhum ainda.'));
    const cb = $('shop-chalks'); cb.innerHTML = '';
    run.chalks.forEach((id) => { const d = D.CHALKS[id]; cb.appendChild(chalkEl(id, () => pop({ title: d.name, rar: 'Giz', desc: d.desc }))); });
    if (!run.chalks.length) cb.appendChild(el('span', 'small', 'Bolso vazio (cabem 3).'));
    const rc = G.rerollCost();
    $('shop-reroll').textContent = '🔄 Trocar (🪙 ' + rc + ')';
    $('shop-reroll').classList.toggle('off', run.coins < rc);
    if (UI.base !== 'shop' || UI.overlay) UI.setBase('shop');
  };

  // ---------- saco de bolas ----------
  function showBag() {
    const run = G.run, inShop = G.state === 'shop';
    $('bag-n').textContent = '(' + run.bag.length + '/21)';
    $('bag-sub').textContent = inShop ? 'Toque numa bola para polir (+20 pontos) ou tirar do saco.' : 'Todas entram na mesa a cada leva.';
    const list = $('bag-list'); list.innerHTML = '';
    const order = run.bag.map((b, i) => i).sort((a, b) => (run.bag[a].t === 'n' ? run.bag[a].num : 100) - (run.bag[b].t === 'n' ? run.bag[b].num : 100));
    for (const i of order) {
      const e = run.bag[i], s = e.t === 'n' ? null : D.SPECIAL[e.t];
      const b = el('button', 'bball' + (i === bagSel ? ' sel' : ''));
      b.appendChild(Rn.ballIcon(s ? { color: s.color, glyph: s.glyph } : { color: D.BALL_COLORS[e.num], num: e.num }, 44));
      b.appendChild(el('span', '', e.pts + ' pts'));
      b.onclick = () => {
        bagSel = bagSel === i ? -1 : i; Au.ui();
        showBag();
      };
      list.appendChild(b);
    }
    const act = $('bag-actions'); act.innerHTML = '';
    if (bagSel >= 0 && run.bag[bagSel]) {
      const e = run.bag[bagSel], s = e.t === 'n' ? null : D.SPECIAL[e.t];
      act.appendChild(el('span', 'small', '<b>' + esc(s ? s.name : 'Bola ' + e.num) + '</b> — ' + esc(s ? s.desc : 'Bola comum. Vale ' + e.pts + ' pontos.')));
      if (inShop) {
        const c = G.price(3);
        const p = el('button', 'btn', '✨ Polir +20 pts (🪙 ' + c + ')'); p.onclick = () => { const err = G.polishBall(bagSel); if (err) UI.toast(err); showBag(); };
        const r = el('button', 'btn danger', '🗑️ Tirar do saco (🪙 ' + c + ')'); r.onclick = () => { const err = G.removeBall(bagSel); if (err) UI.toast(err); else bagSel = -1; showBag(); };
        act.appendChild(p); act.appendChild(r);
      }
    }
    if (UI.overlay !== 'bag') UI.open('bag');
  }

  // ---------- portas ----------
  UI.showDoors = function () {
    const run = G.run, list = $('door-list'); list.innerHTML = '';
    const boss = run.doors.length === 1 && run.doors[0].boss;
    $('doors-title').textContent = boss ? 'A mesa do chefe' : 'Qual mesa?';
    $('doors-sub').textContent = (run.act >= 3 ? 'Além ∞' : D.ACTS[run.act].name) + ' · mesa ' + (run.idx + 1) + ' de 3' + (boss ? '' : ' — mesas mais esquisitas pagam melhor.');
    run.doors.forEach((d, i) => {
      const b = d.boss ? D.BOSSES[d.boss] : null;
      let html = '<h4>' + (b ? b.icon + ' ' + esc(b.name) : d.mods.length ? 'Mesa esquisita' : 'Mesa clássica') + '</h4>';
      if (b) html += '<div class="kind">' + esc(b.title) + '</div>';
      html += '<ul>';
      if (b) html += '<li>' + esc(b.desc) + '</li>';
      else for (const m of d.mods) html += '<li>' + D.MODS[m].icon + ' <b>' + esc(D.MODS[m].name) + '</b> — ' + esc(D.MODS[m].desc) + '</li>';
      if (d.wager) html += '<li>🎲 <b>Aposta</b> — meta 40% maior, moedas da mesa em dobro.</li>';
      html += '</ul><div class="meta">Meta: <b>' + SA.fmt(d.target) + '</b>';
      const rw = d.reward;
      if (rw && rw.type === 'coins' && rw.n) html += ' · Prêmio: +' + rw.n + ' 🪙';
      if (rw && rw.type === 'chalk') html += ' · Prêmio: ' + D.CHALKS[rw.id].icon + ' ' + esc(D.CHALKS[rw.id].name);
      if (rw && rw.type === 'relic') html += ' · Prêmio: ' + D.RELICS[rw.id].icon + ' ' + esc(D.RELICS[rw.id].name);
      html += '</div>';
      const card = el('div', 'card door' + (b ? ' boss' : ''), html);
      const go = el('button', 'btn buy gold', 'Entrar'); go.onclick = () => { Au.buy(); G.pickDoor(i); };
      card.appendChild(go);
      list.appendChild(card);
    });
    UI.setBase('doors');
  };

  // ---------- fim de noite ----------
  UI.showOver = function (last) {
    $('ov-title').textContent = last.win ? 'Noite vencida!' : 'A conta chegou.';
    const T = last.T;
    $('ov-sub').textContent = last.win ? 'Você fechou todas as mesas e saiu assobiando.' : T ? 'Faltaram ' + SA.fmt(Math.max(0, T.target - T.score)) + ' pontos na ' + T.name + '.' : '';
    const s = last.stats, box = $('ov-stats'); box.innerHTML = '';
    const rows = [['Mesas vencidas', s.tables], ['Tacadas', s.shots], ['Bolas encaçapadas', s.pocketed], ['Melhor tacada', SA.fmt(s.bestShot)], ['Pontos na noite', SA.fmt(s.total)], ['Moedas ganhas', s.coins], ['Semente', last.seed]];
    for (const r of rows) box.appendChild(el('div', '', '<span>' + esc(r[0]) + '</span><b>' + esc(r[1]) + '</b>'));
    if (last.relics.length) box.appendChild(el('div', '', '<span>Amuletos</span><b>' + last.relics.map((r) => D.RELICS[r.id].icon).join(' ') + '</b>'));
    UI.setBase('over');
  };

  // ---------- almanaque ----------
  function showAlmanac() {
    const list = $('alm-list'); list.innerHTML = '';
    for (const b of $('alm-tabs').children) b.classList.toggle('on', b.dataset.v === almTab);
    const seen = G.meta.seen;
    const add = (head, kind, name, desc, known, kcls) => list.appendChild(el('div', 'card' + (known ? '' : ' unseen'), '<div class="top">' + head + '<div><div class="kind ' + (kcls || '') + '">' + esc(kind) + '</div><h4>' + esc(known ? name : '???') + '</h4></div></div><p>' + esc(known ? desc : 'Ainda não apareceu nas suas noites.') + '</p>'));
    if (almTab === 'r') for (const id of D.RELIC_IDS) { const d = D.RELICS[id], k = !!seen.r[id]; add('<div class="coaster r' + d.rar + '">' + (k ? d.icon : '?') + '</div>', D.RAR_NAME[d.rar], d.name, d.desc, k, 'r' + d.rar); }
    if (almTab === 'b') for (const id of D.SPECIAL_IDS) { const d = D.SPECIAL[id], k = !!seen.b[id]; add('<div class="coaster">' + (k ? d.glyph : '?') + '</div>', d.pts + ' pts', d.name, d.desc, k); }
    if (almTab === 'c') for (const id of D.CHALK_IDS) { const d = D.CHALKS[id], k = !!seen.c[id]; add('<div class="giz" style="background:' + (k ? d.color : '#555') + '">' + (k ? d.icon : '?') + '</div>', d.instant ? 'Uso imediato' : 'Na próxima tacada', d.name, d.desc, k); }
    if (almTab === 'm') {
      for (const id in D.MODS) { const d = D.MODS[id]; add('<div class="coaster">' + d.icon + '</div>', 'Esquisitice', d.name, d.desc, true); }
      for (const id in D.BOSSES) { const d = D.BOSSES[id]; add('<div class="coaster r2">' + d.icon + '</div>', 'Chefe · Ato ' + (d.act + 1), d.name + ', ' + d.title, d.desc, true); }
    }
    if (UI.overlay !== 'almanac') UI.open('almanac');
  }

  // ---------- configurações ----------
  function showSettings() {
    const s = G.settings;
    $('set-master').value = s.master; $('set-music').value = s.music; $('set-sfx').value = s.sfx;
    for (const b of $('set-control').children) b.classList.toggle('on', b.dataset.v === s.control);
    for (const b of $('set-quality').children) b.classList.toggle('on', b.dataset.v === s.quality);
    $('set-guide').classList.toggle('on', s.guideOn); $('set-shake').classList.toggle('on', s.shake);
    $('set-vibrate').classList.toggle('on', s.vibrate); $('set-lefty').classList.toggle('on', s.lefty);
    $('set-fs').classList.toggle('hidden', !SA.canFullscreen());
    if (UI.overlay !== 'settings') UI.open('settings');
  }
  function applySettings(relayout) {
    const s = G.settings;
    Au.vol.master = s.master; Au.vol.music = s.music; Au.vol.sfx = s.sfx; Au.applyVolume();
    G.persist();
    if (relayout) SA.relayout();
    if (G.run && G.T) UI.hud();
  }
  UI.pause = function () {
    if (!G.run || UI.base) return;
    if (UI.overlay) { UI.back(); return; }
    const r = G.run;
    $('pause-info').textContent = (r.act >= 3 ? 'Além ∞' : D.ACTS[r.act].name) + ' · ' + D.CUES[r.cue].name + ' · ' + D.DIFFS[r.diff].name + ' · semente ' + r.seed;
    UI.open('pause');
  };

  UI.bind = function () {
    document.querySelectorAll('[data-close]').forEach((b) => { b.onclick = () => { if (b.dataset.close === 'menu') { Au.ui(); UI.showMenu(); } else UI.back(); }; });
    $('m-new').onclick = () => { Au.init(); Au.ui(); showNew(); };
    $('m-continue').onclick = () => { Au.init(); Au.ui(); if (!G.resume()) UI.showMenu(); };
    $('m-almanac').onclick = () => { Au.init(); showAlmanac(); };
    $('m-how').onclick = () => { Au.init(); UI.open('how'); };
    $('m-settings').onclick = () => { Au.init(); showSettings(); };
    $('m-fs').onclick = () => SA.toggleFullscreen();
    $('new-go').onclick = () => {
      Au.init(); Au.buy();
      const first = !G.meta.tutorial;
      G.newRun({ cue: newCue, diff: newDiff, seed: $('seed-in').value });
      if (first) { G.meta.tutorial = true; G.persist(); UI.open('how'); }
    };
    $('shop-next').onclick = () => { Au.ui(); G.leaveShop(); };
    document.querySelectorAll('[data-exit]').forEach((b) => { b.onclick = () => { Au.ui(); G.saveRun(); G.toMenu(); }; });
    $('shop-reroll').onclick = () => { if (!G.reroll()) UI.toast('Faltam moedas.'); UI.showShop(); };
    $('shop-bag').onclick = () => { bagSel = -1; showBag(); };
    $('btn-bag').onclick = () => { bagSel = -1; showBag(); };
    $('ov-menu').onclick = () => G.toMenu();
    $('seed-day').onclick = () => { const d = new Date(); $('seed-in').value = 'dia-' + d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); Au.ui(); UI.toast('Semente do dia: todo mundo joga a mesma noite.'); };
    $('ov-copy').onclick = () => {
      const l = G.lastRun; if (!l) return;
      const txt = 'Sinuca do Além — ' + (l.win ? 'noite vencida' : 'caí na mesa ' + (l.depth + 1)) + ' · ' + l.stats.tables + ' mesas · melhor tacada ' + SA.fmt(l.stats.bestShot) + ' · semente ' + l.seed;
      const done = () => UI.toast('Resultado copiado.');
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(done, () => UI.toast(txt)); else UI.toast(txt);
    };
    $('ov-again').onclick = () => showNew();
    $('btn-pause').onclick = () => UI.pause();
    $('p-how').onclick = () => UI.open('how');
    $('p-settings').onclick = () => showSettings();
    $('p-menu').onclick = () => { if (G.state === 'aim') G.saveRun('table'); UI.overlay = null; G.toMenu(); };
    $('p-quit').onclick = () => { if ($('p-quit').dataset.sure) { delete $('p-quit').dataset.sure; $('p-quit').textContent = 'Desistir da noite'; UI.overlay = null; G.abandon(); } else { $('p-quit').dataset.sure = 1; $('p-quit').textContent = 'Tem certeza? Toque de novo'; } };
    $('btn-fast').onclick = () => { G.fast = !G.fast; $('btn-fast').classList.toggle('on', G.fast); Au.ui(); };
    $('btn-fs').onclick = () => SA.toggleFullscreen();
    $('btn-spin').onclick = () => { $('spinpad').classList.toggle('hidden'); Au.ui(); };
    const sb = $('spin-ball');
    const spinAt = (e) => {
      const r = sb.getBoundingClientRect();
      let x = (e.clientX - r.left - r.width / 2) / (r.width / 2), y = (e.clientY - r.top - r.height / 2) / (r.height / 2);
      const d = Math.hypot(x, y); if (d > 0.8) { x *= 0.8 / d; y *= 0.8 / d; }
      if (d < 0.12) { x = 0; y = 0; }
      G.aim.spinX = x / 0.8; G.aim.spinY = -y / 0.8; UI.spinDot();
    };
    sb.addEventListener('pointerdown', (e) => { sb.setPointerCapture(e.pointerId); spinAt(e); });
    sb.addEventListener('pointermove', (e) => { if (e.buttons || e.pointerType === 'touch') spinAt(e); });
    // configurações
    const s = G.settings;
    $('set-master').oninput = (e) => { s.master = +e.target.value; applySettings(); };
    $('set-music').oninput = (e) => { s.music = +e.target.value; applySettings(); };
    $('set-sfx').oninput = (e) => { s.sfx = +e.target.value; applySettings(); Au.clack(900); };
    for (const b of $('set-control').children) b.onclick = () => { s.control = b.dataset.v; applySettings(true); showSettings(); };
    for (const b of $('set-quality').children) b.onclick = () => { s.quality = b.dataset.v; applySettings(true); showSettings(); };
    const tog = (id, key, relayout) => { $(id).onclick = () => { s[key] = !s[key]; applySettings(relayout); showSettings(); Au.ui(); }; };
    tog('set-guide', 'guideOn'); tog('set-shake', 'shake'); tog('set-vibrate', 'vibrate'); tog('set-lefty', 'lefty', true);
    $('set-fs').onclick = () => SA.toggleFullscreen();
    $('set-reset').onclick = () => {
      const b = $('set-reset');
      if (!b.dataset.sure) { b.dataset.sure = 1; b.textContent = 'Apagar tudo mesmo? Toque de novo'; return; }
      delete b.dataset.sure; b.textContent = 'Apagar progresso';
      G.meta = { runs: 0, wins: 0, bestShot: 0, bestTable: 0, deepest: 0, unlock: 0, seen: { r: {}, b: {}, c: {} }, tutorial: false };
      G.run = null; G.saved = null; G.persist(); UI.toast('Progresso apagado.'); G.toMenu();
    };
    for (const b of $('alm-tabs').children) b.onclick = () => { almTab = b.dataset.v; Au.ui(); showAlmanac(); };
  };
})(window);
