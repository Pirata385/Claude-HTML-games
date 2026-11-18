/* Talking, shops, the request board, mail, the torn pages, the library and the friends/journal tabs. */
(function (root) {
  'use strict';
  const PA = root.PA = root.PA || {};
  PA.UI = PA.UI || {};
  const esc = (s) => PA.U.esc(s);
  const block = (v) => { PA.Input.blocked = v; PA.Input.clearAll(); };
  function modal(html, onClose) {
    const el = document.createElement('div');
    el.className = 'modal';
    el.innerHTML = html;
    document.getElementById('ui').appendChild(el);
    block(true);
    const close = () => { el.remove(); block(false); window.removeEventListener('keydown', key, true); if (onClose) onClose(); };
    const key = (e) => { if (e.code === 'Escape') { e.stopPropagation(); e.preventDefault(); close(); } };
    window.addEventListener('keydown', key, true);
    el.close = close;
    return el;
  }
  const hearts = (s, id) => { const h = PA.Dialogue.hearts(s, id); return '<3'.repeat(h) + ' -'.repeat(Math.max(0, 10 - h)); };

  /* ---------------- talking ---------------- */
  PA.UI.Talk = {
    open(game, actor) {
      const s = game.state, n = actor.n;
      const ev = PA.Dialogue.heartEvent(s, n);
      let lines = ev ? ev.lines.slice() : [PA.Dialogue.line(s, n)];
      const gained = PA.Dialogue.talk(s, n.id);
      if (ev && ev.gift) {
        if (ev.gift.word && !s.words.includes(ev.gift.word)) { s.words.push(ev.gift.word); lines.push('(You learned the word "' + PA.Words.get(ev.gift.word).name + '"!)'); }
        if (ev.gift.item) { game.inv.add(ev.gift.item, ev.gift.n || 1); lines.push('(You received ' + (ev.gift.n || 1) + ' ' + PA.Items.get(ev.gift.item).name + ')'); }
      }
      const sel = game.inv.slots[game.hot];
      const giftable = sel && !['tool', 'drawn', 'word'].includes(PA.Items.get(sel.id).cat) && sel.id !== 'torn_page';
      const req = (s.quests || []).find((q) => !q.done && q.npc === n.id && game.inv.count(q.item) >= q.n);
      const shop = actor.keeper && n.shop;
      let i = 0;
      const el = modal(`<div class="card talk"><div class="who"><b>${esc(n.name)}</b> <span>${hearts(s, n.id)}</span></div><p class="say"></p><div class="row opts"></div></div>`);
      const say = el.querySelector('.say'), opts = el.querySelector('.opts');
      const show = () => {
        say.textContent = lines[i];
        const last = i >= lines.length - 1;
        let h = '';
        if (!last) h = '<button data-a="next">...</button>';
        else {
          if (req) h += `<button data-a="req">Give ${req.n} ${esc(PA.Items.get(req.item).name)} (request)</button>`;
          if (giftable) h += `<button data-a="gift">Give ${esc(PA.Items.label(sel))}</button>`;
          if (shop) h += `<button data-a="shop">${shop === 'hall' ? 'Torn pages' : shop === 'library' ? 'Donate' : 'Shop'}</button>`;
          h += '<button data-a="bye">Bye</button>';
        }
        opts.innerHTML = h;
        const on = (a, f) => { const b = opts.querySelector(`[data-a=${a}]`); if (b) b.onclick = f; };
        on('next', () => { i++; show(); });
        on('bye', () => el.close());
        on('gift', () => {
          const r = PA.Dialogue.gift(s, n, sel.id);
          if (!r.ok) { lines = ["You've already given me something today. Thank you though!"]; i = 0; return show(); }
          game.inv.takeAt(game.hot, 1);
          lines = [PA.Dialogue.isBirthday(s, n) && r.points > 0 ? n.lines.bday : n.lines[r.taste]]; i = 0;
          PA.Bus.emit('gift', { taste: r.taste });
          show();
        });
        on('req', () => {
          game.inv.remove(req.item, req.n); req.done = true; s.gold += req.reward;
          PA.Dialogue.rel(s, n.id).pts += 150;
          lines = ['You brought it! Thank you so much. Here, ' + req.reward + 'g.']; i = 0; PA.Bus.emit('coins'); show();
        });
        on('shop', () => { el.close(); if (shop === 'hall') PA.UI.Pages.open(game); else if (shop === 'library') PA.UI.Library.open(game); else PA.UI.Shop.open(game, shop); });
      };
      show();
      if (gained) PA.Bus.emit('talk');
    },
  };

  /* ---------------- shops ---------------- */
  PA.UI.Shop = {
    open(game, shop) {
      const s = game.state;
      let tab = 'buy';
      const el = modal(`<div class="card wide shop"><p><b>${esc(PA.Shops.NAMES[shop] || shop)}</b> - <span class="gold"></span></p><div class="row"><button data-t="buy">buy</button><button data-t="sell">sell</button><button data-a="close">leave</button></div><div class="list"></div></div>`);
      const list = el.querySelector('.list');
      const render = () => {
        el.querySelector('.gold').textContent = s.gold + 'g';
        el.querySelectorAll('[data-t]').forEach((b) => b.classList.toggle('on', b.dataset.t === tab));
        if (tab === 'buy') {
          const stock = PA.Shops.stock(shop, s);
          list.innerHTML = stock.map((e, i) => {
            const it = PA.Items.get(e.id);
            const label = e.label || (it ? it.name : e.id);
            return `<div class="recipe"><span class="ic">${esc(it ? it.icon : '[+]')}</span><b>${esc(label)}</b><span class="req">${e.upgrade ? '' : e.price + 'g'}${e.needs && e.needs.wood ? ' + ' + e.needs.wood + ' wood + ' + e.needs.stone + ' stone' : ''}</span>${e.upgrade ? '<button data-u>choose tool</button>' : `<button data-b="${i}" ${s.gold < e.price ? 'disabled' : ''}>buy</button>${it && it.stack > 1 && !e.extra ? `<button data-b5="${i}" ${s.gold < e.price * 5 ? 'disabled' : ''}>x5</button>` : ''}`}</div>`;
          }).join('') || '<p class="muted">Nothing for sale right now.</p>';
          list.querySelectorAll('[data-b]').forEach((b) => { b.onclick = () => { const e = stock[+b.dataset.b]; if (PA.Shops.buy(s, game.inv, e, 1)) { PA.Bus.emit('coins'); PA.UI.toast('Bought ' + (e.label || PA.Items.get(e.id).name)); if (e.flag === 'bag48') PA.UI.Hotbar.render(); } else PA.UI.toast('Can\'t buy that right now.'); render(); }; });
          list.querySelectorAll('[data-b5]').forEach((b) => { b.onclick = () => { const e = stock[+b.dataset.b5]; if (PA.Shops.buy(s, game.inv, e, 5)) PA.Bus.emit('coins'); render(); }; });
          const u = list.querySelector('[data-u]'); if (u) u.onclick = () => this.upgrade(game, render);
        } else {
          list.innerHTML = `<div class="grid">${game.inv.slots.map((sl, i) => { const it = sl && PA.Items.get(sl.id); const ok = it && it.price > 0 && it.cat !== 'tool' && sl.id !== 'drawn'; return `<button class="cell" data-s="${i}" ${ok ? '' : 'disabled'} title="${esc(PA.Items.label(sl))}${ok ? ' - ' + PA.Items.sellPrice(sl.id, sl.extra) + 'g each' : ''}"><span class="ic">${esc(PA.Items.icon(sl) || '')}</span>${sl && sl.n > 1 ? `<span class="n">${sl.n}</span>` : ''}</button>`; }).join('')}</div><p class="muted">Tap to sell the whole stack (shops pay the same as the bin, right away).</p>`;
          list.querySelectorAll('[data-s]').forEach((b) => { b.onclick = () => { const g = PA.Shops.sell(s, game.inv, +b.dataset.s); if (g) { PA.Bus.emit('coins'); PA.UI.toast('+' + g + 'g'); } render(); }; });
        }
      };
      el.querySelectorAll('[data-t]').forEach((b) => { b.onclick = () => { tab = b.dataset.t; render(); }; });
      el.querySelector('[data-a=close]').onclick = () => el.close();
      render();
    },
    upgrade(game, done) {
      const s = game.state;
      const tools = game.inv.slots.map((sl, i) => [sl, i]).filter(([sl]) => sl && ['hoe', 'can', 'axe', 'pickaxe'].includes(sl.id));
      const el = modal(`<div class="card"><p>Which tool? (takes 2 days)</p>${tools.map(([sl, i]) => { const lv = (sl.extra && sl.extra.lvl) || 0, up = PA.Shops.UPGRADE[lv + 1]; return up ? `<div class="recipe"><b>${esc(PA.Items.label(sl))}</b><span class="req">${up[1]}g + 5 ${esc(PA.Items.get(up[0]).name)}</span><button data-i="${i}" ${s.gold >= up[1] && game.inv.count(up[0]) >= 5 ? '' : 'disabled'}>upgrade</button></div>` : ''; }).join('')}<div class="row"><button data-a="x">never mind</button></div></div>`);
      el.querySelector('[data-a=x]').onclick = () => el.close();
      el.querySelectorAll('[data-i]').forEach((b) => { b.onclick = () => {
        const i = +b.dataset.i, sl = game.inv.slots[i], lv = (sl.extra && sl.extra.lvl) || 0, up = PA.Shops.UPGRADE[lv + 1];
        s.gold -= up[1]; game.inv.remove(up[0], 5);
        s.flags.upgrade = { id: sl.id, lvl: lv + 1, extra: sl.extra }; s.flags.upgradeReady = (s.stats.days || 0) + 2;
        game.inv.slots[i] = null; PA.Bus.emit('inv');
        PA.UI.toast('Gus takes your ' + PA.Items.get(sl.id).name + '. Back in 2 days.');
        el.close(); done && done();
      }; });
    },
  };

  /* ---------------- board, mail, pages, library ---------------- */
  PA.UI.Board = {
    open(game) {
      const s = game.state, r = PA.Quests.request(s);
      const taken = (s.quests || []).find((q) => q.id === r.id);
      const n = PA.NPC_BY[r.npc];
      const el = modal(`<div class="card"><p><b>Request board</b></p><p>${esc(n.name)} needs ${r.n} ${esc(PA.Items.get(r.item).name)}. Reward: ${r.reward}g and friendship.</p><div class="row">${taken ? '<span>(accepted - see your journal)</span>' : '<button data-a="ok">accept</button>'}<button data-a="x">close</button></div></div>`);
      const ok = el.querySelector('[data-a=ok]'); if (ok) ok.onclick = () => { s.quests = s.quests || []; s.quests.push(r); PA.UI.toast('Request accepted.'); el.close(); };
      el.querySelector('[data-a=x]').onclick = () => el.close();
    },
  };
  PA.UI.Mail = {
    open(game) {
      const s = game.state;
      const unread = s.mail.filter((m) => !m.read);
      const show = unread.length ? unread : s.mail.slice(-3);
      const el = modal(`<div class="card wide"><p><b>Mailbox</b></p>${show.map((m) => `<div class="letter"><b>From ${esc(m.from)}</b><p>${esc(m.text)}</p></div>`).join('') || '<p class="muted">Empty.</p>'}<div class="row"><button data-a="x">close</button></div></div>`);
      for (const m of unread) m.read = true;
      el.querySelector('[data-a=x]').onclick = () => el.close();
    },
  };
  PA.UI.Pages = {
    open(game) {
      const s = game.state, inv = game.inv;
      const el = modal('<div class="card wide"><div class="body"></div></div>');
      const render = () => {
        el.querySelector('.body').innerHTML = `<p><b>The torn notebook of Marginton</b> - bring what each bundle asks for to mend its page.</p>` +
          PA.Quests.PAGES.map((pg, p) => `<div class="page${PA.Quests.pageDone(s, p) ? ' done' : ''}"><b>${esc(pg.name)}</b> ${PA.Quests.pageDone(s, p) ? '(mended)' : ''}<span class="muted"> - ${esc(pg.reward)}</span>${pg.bundles.map((b, i) => {
            const got = PA.Quests.progress(s, p, i), ok = b.items.every(([id, n]) => inv.count(id) >= n);
            return `<div class="recipe"><b>${esc(b.name)}</b><span class="req">${b.items.map(([id, n]) => `${got ? n : Math.min(inv.count(id), n)}/${n} ${esc(PA.Items.get(id).name)}`).join(', ')}</span>${got ? '<span>done</span>' : `<button data-p="${p}" data-b="${i}" ${ok ? '' : 'disabled'}>donate</button>`}</div>`;
          }).join('')}</div>`).join('') + '<div class="row"><button data-a="x">close</button></div>';
        el.querySelectorAll('[data-p]').forEach((b) => { b.onclick = () => {
          const p = +b.dataset.p;
          if (PA.Quests.donate(s, inv, p, +b.dataset.b)) {
            PA.Bus.emit('bundle');
            if (PA.Quests.pageDone(s, p)) { PA.UI.toast(PA.Quests.PAGES[p].name + ' is mended! ' + PA.Quests.PAGES[p].reward + '.', 5000); PA.Bus.emit('page', { p }); game.applyUnlocks && game.applyUnlocks(); }
          }
          render();
        }; });
        el.querySelector('[data-a=x]').onclick = () => el.close();
      };
      render();
    },
  };
  PA.UI.Library = {
    open(game) {
      const s = game.state, inv = game.inv;
      s.flags.donated = s.flags.donated || [];
      const el = modal('<div class="card wide"><div class="body"></div></div>');
      const render = () => {
        const can = inv.slots.map((sl, i) => [sl, i]).filter(([sl]) => sl && ['fish', 'forage'].includes(PA.Items.get(sl.id).cat) || (sl && ['quartz', 'inkstone', 'copper_ore', 'iron_ore', 'gold_ore', 'graphite'].includes(sl.id))).filter(([sl]) => !s.flags.donated.includes(sl.id));
        el.querySelector('.body').innerHTML = `<p><b>Library collection</b> - ${s.flags.donated.length} donated. Every 5 new donations, Ms. Rule gives you a word card.</p><div class="row">${can.map(([sl, i]) => `<button data-i="${i}">${esc(PA.Items.label(sl))}</button>`).join('') || '<span class="muted">Nothing new to donate.</span>'}</div><div class="row"><button data-a="x">close</button></div>`;
        el.querySelectorAll('[data-i]').forEach((b) => { b.onclick = () => {
          const sl = inv.slots[+b.dataset.i]; s.flags.donated.push(sl.id); inv.takeAt(+b.dataset.i, 1);
          if (s.flags.donated.length % 5 === 0) {
            const w = PA.Words.ALL.find((q) => !s.words.includes(q.id));
            if (w) { s.words.push(w.id); PA.UI.toast('Ms. Rule hands you a word card: ' + w.name + '!', 4000); }
          }
          render();
        }; });
        el.querySelector('[data-a=x]').onclick = () => el.close();
      };
      render();
    },
  };

  /* ---------------- notebook tabs ---------------- */
  PA.UI.Friends = {
    render(el) {
      const s = PA.scene.state;
      el.innerHTML = PA.NPC_DATA.map((n) => { const r = s.npcs[n.id]; const met = r && r.met; return `<div class="recipe"><b style="width:9em">${met ? esc(n.name) : '???'}</b><span class="req">${met ? hearts(s, n.id) : 'not met yet'}</span><span class="muted">${met ? 'birthday: ' + PA.SEASONS[n.birthday[0]] + ' ' + n.birthday[1] + (r.talked ? ' - talked today' : '') : ''}</span></div>`; }).join('');
    },
  };
  PA.UI.Journal = {
    render(el) {
      const s = PA.scene.state, q = (s.quests || []).filter((x) => !x.done);
      el.innerHTML = '<p><b>Requests</b></p>' + (q.map((r) => `<p>- ${esc(PA.NPC_BY[r.npc].name)}: ${r.n} ${esc(PA.Items.get(r.item).name)} (${r.reward}g)</p>`).join('') || '<p class="muted">None. Check the board by the town hall.</p>') +
        '<p><b>The torn notebook</b></p>' + PA.Quests.PAGES.map((pg, p) => `<p>${PA.Quests.pageDone(s, p) ? '[x]' : '[ ]'} ${esc(pg.name)} - ${esc(pg.reward)}</p>`).join('') +
        `<p><b>Stats</b></p><p class="muted">days ${s.stats.days || 0}, shipped ${s.stats.shipped || 0}g, drawings made ${s.stats.drawn || 0}, deepest mine floor ${s.mine.deepest}</p>`;
    },
  };
})(typeof window !== 'undefined' ? window : globalThis);
