/* Notebook menus (DOM, two colours): hotbar, tabbed notebook (items, craft, words, map, calendar, friends,
 * journal, settings, save), shipping bin and chests. */
(function (root) {
  'use strict';
  const PA = root.PA = root.PA || {};
  PA.UI = PA.UI || {};
  const esc = (s) => PA.U.esc(s);
  const ui = () => document.getElementById('ui');
  const block = (v) => { PA.Input.blocked = v; if (v) PA.Input.clearAll(); };

  /* ---------------- hotbar ---------------- */
  PA.UI.Hotbar = {
    init() {
      const el = document.createElement('div');
      el.id = 'hotbar';
      el.innerHTML = '<div class="hb-name"></div><div class="hb-slots"></div>';
      ui().appendChild(el);
      this.el = el; this.slots = el.querySelector('.hb-slots'); this.name = el.querySelector('.hb-name');
      for (let i = 0; i < 9; i++) {
        const b = document.createElement('button');
        b.className = 'hb'; b.dataset.i = i;
        b.onpointerdown = (e) => { e.preventDefault(); e.stopPropagation(); PA.scene.selectHot(i); };
        this.slots.appendChild(b);
      }
      PA.Bus.on('inv', () => this.render());
    },
    show(v) { this.el.classList.toggle('hidden', !v); },
    render() {
      const g = PA.scene; if (!g || !g.inv) return;
      [...this.slots.children].forEach((b, i) => {
        const s = g.inv.slots[i];
        b.classList.toggle('sel', i === g.hot);
        b.innerHTML = `<span class="k">${i + 1}</span><span class="ic">${esc(PA.Items.icon(s) || ' ')}</span>${s && s.n > 1 ? `<span class="n">${s.n}</span>` : ''}${s && s.extra && s.extra.water != null ? `<span class="n">${s.extra.water}</span>` : ''}`;
      });
      const cur = g.inv.slots[g.hot];
      this.name.textContent = cur ? PA.Items.label(cur) : '';
    },
  };

  /* ---------------- notebook ---------------- */
  const TABS = [['items', 'items'], ['craft', 'craft'], ['words', 'words'], ['map', 'map'], ['calendar', 'calendar'], ['friends', 'friends'], ['journal', 'journal'], ['settings', 'settings'], ['save', 'save']];
  const NB = PA.UI.Notebook = {
    tab: 'items', sel: -1,
    init() {
      const el = document.createElement('div');
      el.id = 'notebook'; el.className = 'hidden';
      el.innerHTML = `<div class="nb"><div class="nb-tabs">${TABS.map(([k, n]) => `<button data-t="${k}">${n}</button>`).join('')}<button class="nb-x" data-x>x</button></div><div class="nb-body"></div></div>`;
      ui().appendChild(el);
      this.el = el; this.body = el.querySelector('.nb-body');
      el.querySelectorAll('[data-t]').forEach((b) => { b.onclick = () => this.show(b.dataset.t); });
      el.querySelector('[data-x]').onclick = () => this.close();
      window.addEventListener('keydown', (e) => {
        if (this.el.classList.contains('hidden')) return;
        if (e.code === 'Escape' || e.code === 'Tab' || e.code === 'KeyI') { e.preventDefault(); e.stopPropagation(); this.close(); }
      }, true);
      PA.Bus.on('inv', () => { if (this.open && this.tab === 'items') this.render(); });
    },
    get open() { return !this.el.classList.contains('hidden'); },
    show(tab) {
      if (tab) this.tab = tab;
      this.el.classList.remove('hidden'); block(true);
      this.el.querySelectorAll('[data-t]').forEach((b) => b.classList.toggle('on', b.dataset.t === this.tab));
      this.render();
    },
    close() { this.el.classList.add('hidden'); block(false); this.sel = -1; },
    render() { const f = this['r_' + this.tab]; this.body.innerHTML = ''; if (f) f.call(this, this.body); },
    r_items(el) {
      const g = PA.scene, inv = g.inv;
      el.innerHTML = `<div class="grid">${inv.slots.map((s, i) => `<button class="cell${i === this.sel ? ' sel' : ''}${i < 9 ? ' hot' : ''}" data-i="${i}" title="${esc(PA.Items.label(s))}"><span class="ic">${esc(PA.Items.icon(s) || '')}</span>${s && s.n > 1 ? `<span class="n">${s.n}</span>` : ''}</button>`).join('')}</div>
        <div class="info"></div><div class="row"><button data-a="sort">sort</button><button data-a="trash">throw away</button><button data-a="eat">use / eat</button></div>`;
      const info = el.querySelector('.info');
      const showInfo = (i) => {
        const s = inv.slots[i];
        if (!s) { info.textContent = 'Empty slot. Tap an item, then another slot to move it.'; return; }
        const it = PA.Items.get(s.id);
        info.innerHTML = `<b>${esc(PA.Items.label(s))}</b> x${s.n} - ${esc(it.cat)}${it.price ? ' - sells for ' + PA.Items.sellPrice(s.id, s.extra) + 'g' : ''}${it.energy ? ' - +' + it.energy + ' energy' : ''}${it.seasons && it.cat === 'seed' ? ' - grows in ' + it.seasons.map((q) => PA.SEASONS[q]).join(', ') : ''}`;
      };
      el.querySelectorAll('.cell').forEach((b) => {
        b.onclick = () => {
          const i = +b.dataset.i;
          if (this.sel >= 0 && this.sel !== i) { inv.swap(this.sel, i); this.sel = -1; this.render(); return; }
          this.sel = this.sel === i ? -1 : i;
          el.querySelectorAll('.cell').forEach((c) => c.classList.toggle('sel', +c.dataset.i === this.sel));
          showInfo(i);
        };
      });
      showInfo(this.sel >= 0 ? this.sel : g.hot);
      el.querySelector('[data-a=sort]').onclick = () => { inv.sort(); this.render(); };
      el.querySelector('[data-a=trash]').onclick = async () => {
        if (this.sel < 0 || !inv.slots[this.sel]) return;
        const s = inv.slots[this.sel];
        if (PA.Items.get(s.id).cat === 'tool') { PA.UI.toast('Better keep your tools.'); return; }
        if (await PA.UI.confirm('Throw away ' + s.n + ' ' + PA.Items.label(s) + '?', ['Throw away', 'Keep']) === 0) { inv.slots[this.sel] = null; this.sel = -1; PA.Bus.emit('inv'); }
        block(true);
      };
      el.querySelector('[data-a=eat]').onclick = () => { if (this.sel < 0) return; const prev = g.hot; g.hot = this.sel; PA.Farm.useSelected(g); g.hot = prev; this.render(); };
    },
    r_craft(el) {
      const g = PA.scene;
      el.innerHTML = '<p class="muted">Crafted at your notebook. Place machines with the use button.</p>' + PA.Craft.RECIPES.map(([id, req], i) => {
        const ok = PA.Craft.canCraft(g.inv, req);
        return `<div class="recipe"><span class="ic">${esc(PA.Items.get(id).icon)}</span><b>${esc(PA.Items.get(id).name)}</b><span class="req">${Object.entries(req).map(([k, v]) => `${g.inv.count(k)}/${v} ${esc(PA.Items.get(k).name)}`).join(', ')}</span><button data-c="${i}" ${ok ? '' : 'disabled'}>craft</button></div>`;
      }).join('');
      el.querySelectorAll('[data-c]').forEach((b) => { b.onclick = () => { PA.Craft.craft(g, +b.dataset.c); this.render(); }; });
    },
    r_words(el) { if (PA.UI.Words) PA.UI.Words.render(el); else el.textContent = 'Words you can draw will be listed here.'; },
    r_map(el) {
      const g = PA.scene, map = g.maps.overworld, gr = map.grid;
      const cols = 96, step = gr.w / cols, rows = [];
      for (let z = gr.d - 1; z >= 0; z--) {
        let r = '';
        for (let c = 0; c < cols; c++) {
          const x = Math.floor(c * step);
          const b = map.props.find((p) => p.type === 'building' && p.z === z && x >= p.x0 && x < p.x0 + p.w);
          const water = gr.def(x, gr.surfaceY(x, z) - 1, z).water || gr.def(x, PA.Gen.GY, z).water;
          let ch = b ? '#' : water ? '~' : map.props.some((p) => p.type === 'tree' && p.z === z && Math.abs(p.x - x) < step) ? 't' : gr.surfaceY(x, z) < PA.Gen.GY - 3 ? '^' : '.';
          if (g.map === map && g.player.z === z && Math.floor(g.player.x / PA.C.CELL_W / step) === c) ch = '@';
          r += ch;
        }
        rows.push(r);
      }
      el.innerHTML = `<p class="muted">Seen from above: each row is a slice of the page (top = toward the horizon). @ you, # buildings, ~ water, t trees, ^ hills.</p><pre class="map">${esc(rows.join('\n'))}</pre><p class="muted">${map.zones.map((z) => `${esc(z.name)}: columns ${Math.floor(z.x0 / step)}-${Math.floor(z.x1 / step)}`).join(' | ')}</p>`;
    },
    r_calendar(el) {
      const s = PA.scene.state;
      let h = `<p><b>${esc(PA.Time.dateText(s))}</b> - tomorrow: ${esc({ sun: 'sunny', rain: 'rain', storm: 'storm', snow: 'snow', wind: 'windy' }[s.tomorrow] || 'sunny')}</p><div class="cal">`;
      for (let d = 1; d <= s.seasonDays; d++) {
        const ev = PA.Festivals ? PA.Festivals.on(s.season, d, s.seasonDays) : null;
        const bd = PA.NPCs ? PA.NPCs.birthdayOn(s.season, d) : null;
        h += `<div class="day${d === s.day ? ' today' : ''}"><b>${d}</b>${ev ? '<i>' + esc(ev) + '</i>' : ''}${bd ? '<i>' + esc(bd) + "'s bday</i>" : ''}</div>`;
      }
      el.innerHTML = h + '</div>';
    },
    r_friends(el) { if (PA.UI.Friends) PA.UI.Friends.render(el); else el.textContent = 'Nobody in Marginton knows you yet.'; },
    r_journal(el) { if (PA.UI.Journal) PA.UI.Journal.render(el); else el.textContent = 'No requests yet.'; },
    r_settings(el) { PA.UI.Settings.render(el); },
    r_save(el) {
      const g = PA.scene;
      el.innerHTML = `<p>Your notebook saves itself every morning. Slot ${g.slot}.</p><div class="row"><button data-a="save">save now</button><button data-a="export">export save</button><button data-a="quit">save and quit to title</button></div>`;
      el.querySelector('[data-a=save]').onclick = () => { PA.UI.toast(g.save() ? 'Saved.' : 'Could not save (storage blocked?)'); };
      el.querySelector('[data-a=export]').onclick = () => { g.save(); const j = PA.Save.exportJSON(g.slot); if (!j) return; const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([j], { type: 'application/json' })); a.download = 'paper-acres.json'; a.click(); };
      el.querySelector('[data-a=quit]').onclick = () => { g.save(); this.close(); g.quitToTitle(); };
    },
  };

  /* ---------------- settings panel (title + notebook) ---------------- */
  PA.UI.Settings = {
    render(el) {
      const s = PA.settings;
      const rng = (k, label, min, max, step) => `<label>${label}<input type="range" data-k="${k}" min="${min}" max="${max}" step="${step}" value="${s[k]}"></label>`;
      const sel = (k, label, opts) => `<label>${label}<select data-k="${k}">${opts.map(([v, n]) => `<option value="${v}" ${String(s[k]) === String(v) ? 'selected' : ''}>${n}</option>`).join('')}</select></label>`;
      const chk = (k, label) => `<label>${label}<input type="checkbox" data-k="${k}" ${s[k] ? 'checked' : ''}></label>`;
      const md = PA.Stick.MODELS[(PA.scene && PA.scene.state && PA.scene.state.model != null ? PA.scene.state.model : s.model) | 0];
      el.innerHTML = `<div class="settings"><label>your stickman<button type="button" data-gal>${PA.U.esc(md.name)} (${PA.U.esc(md.body)}) - choose</button></label>
        ${rng('master', 'volume', 0, 1, 0.05)}${rng('music', 'music', 0, 1, 0.05)}${rng('sfx', 'sound effects', 0, 1, 0.05)}
        ${sel('dayLength', 'day length', [[450, 'short (9 min)'], [700, 'normal (14 min)'], [1000, 'long (20 min)'], [1500, 'relaxed (30 min)']])}
        ${sel('slices', 'slices drawn ahead', [[2, '2 (fastest)'], [3, '3'], [4, '4'], [5, '5'], [6, '6 (deepest)']])}
        ${sel('uiScale', 'text size', [[0.85, 'small'], [1, 'normal'], [1.2, 'large'], [1.4, 'huge']])}
        ${sel('dprCap', 'sharpness', [[1, 'low (fast)'], [1.5, 'medium'], [2, 'high'], [3, 'max']])}
        ${sel('touch', 'touch controls', [['auto', 'automatic'], ['on', 'always on'], ['off', 'off']])}
        ${sel('touchSize', 'touch button size', [[0.85, 'small'], [1, 'normal'], [1.2, 'big']])}
        ${chk('leftHanded', 'left-handed touch')}${chk('boil', 'wobbly pencil lines')}${chk('shake', 'screen shake')}
        ${chk('autoQuality', 'automatic quality')}${chk('hints', 'show hints')}${chk('reducedMotion', 'reduce motion')}${chk('pauseOnBlur', 'pause when the tab is hidden')}
      </div>`;
      el.querySelector('[data-gal]').onclick = () => { if (PA.UI.Notebook.open) PA.UI.Notebook.close(); PA.scene.openGallery(); };
      el.querySelectorAll('[data-k]').forEach((i) => {
        i.onchange = i.oninput = () => {
          const k = i.dataset.k;
          let v = i.type === 'checkbox' ? i.checked : i.value;
          if (i.type === 'range' || ['dayLength', 'slices', 'uiScale', 'dprCap', 'touchSize'].includes(k)) v = +v;
          PA.Settings.set(k, v);
          if (k === 'dprCap' && PA.refreshSize) PA.refreshSize();
        };
      });
    },
  };

  /* ---------------- shipping bin ---------------- */
  PA.UI.Ship = {
    open(game) {
      const s = game.state;
      s.ship = s.ship || [];
      const el = document.createElement('div');
      el.className = 'modal';
      document.getElementById('ui').appendChild(el);
      block(true);
      const render = () => {
        const total = s.ship.reduce((a, e) => a + PA.Items.sellPrice(e.id, e.extra) * e.n, 0);
        el.innerHTML = `<div class="card wide"><p>Shipping bin - paid tomorrow morning. In the bin: ${total}g</p><div class="grid">${game.inv.slots.map((sl, i) => { const it = sl && PA.Items.get(sl.id); const ok = it && it.price > 0 && it.cat !== 'tool' && sl.id !== 'drawn'; return `<button class="cell" data-i="${i}" ${ok ? '' : 'disabled'} title="${esc(PA.Items.label(sl))}"><span class="ic">${esc(PA.Items.icon(sl) || '')}</span>${sl && sl.n > 1 ? `<span class="n">${sl.n}</span>` : ''}</button>`; }).join('')}</div><p class="muted">Tap: ship the whole stack. Long press / right click: ship one.</p><div class="row"><button data-a="undo" ${s.ship.length ? '' : 'disabled'}>take back last</button><button data-a="close">done</button></div></div>`;
        el.querySelectorAll('.cell').forEach((b) => {
          const ship = (n) => { const out = game.inv.takeAt(+b.dataset.i, n); if (out) { s.ship.push(out); PA.Bus.emit('ship'); } render(); };
          b.onclick = () => ship(999);
          b.oncontextmenu = (e) => { e.preventDefault(); ship(1); };
        });
        el.querySelector('[data-a=undo]').onclick = () => { const e = s.ship.pop(); if (e) game.inv.add(e.id, e.n, e.extra); render(); };
        el.querySelector('[data-a=close]').onclick = close;
      };
      const close = () => { el.remove(); block(false); window.removeEventListener('keydown', key, true); };
      const key = (e) => { if (e.code === 'Escape' || e.code === 'KeyE') { e.stopPropagation(); e.preventDefault(); close(); } };
      window.addEventListener('keydown', key, true);
      render();
    },
  };

  /* ---------------- chests ---------------- */
  PA.UI.Chest = {
    open(game, o) {
      o.items = o.items || [];
      const el = document.createElement('div');
      el.className = 'modal';
      document.getElementById('ui').appendChild(el);
      block(true);
      const render = () => {
        el.innerHTML = `<div class="card wide"><p>Chest (${o.items.length}/24) - tap to move items between the chest and your bag.</p><div class="grid">${o.items.map((sl, i) => `<button class="cell" data-c="${i}" title="${esc(PA.Items.label(sl))}"><span class="ic">${esc(PA.Items.icon(sl))}</span>${sl.n > 1 ? `<span class="n">${sl.n}</span>` : ''}</button>`).join('')}</div><hr><div class="grid">${game.inv.slots.map((sl, i) => `<button class="cell" data-b="${i}" ${sl ? '' : 'disabled'} title="${esc(PA.Items.label(sl))}"><span class="ic">${esc(PA.Items.icon(sl) || '')}</span>${sl && sl.n > 1 ? `<span class="n">${sl.n}</span>` : ''}</button>`).join('')}</div><div class="row"><button data-a="close">close</button></div></div>`;
        el.querySelectorAll('[data-c]').forEach((b) => { b.onclick = () => { const sl = o.items[+b.dataset.c]; const left = game.inv.add(sl.id, sl.n, sl.extra); if (left) sl.n = left; else o.items.splice(+b.dataset.c, 1); render(); }; });
        el.querySelectorAll('[data-b]').forEach((b) => { b.onclick = () => { if (o.items.length >= 24) return; const out = game.inv.takeAt(+b.dataset.b, 999); if (out) { const same = !out.extra && o.items.find((q) => q.id === out.id && !q.extra); if (same) same.n += out.n; else o.items.push(out); } render(); }; });
        el.querySelector('[data-a=close]').onclick = close;
      };
      const close = () => { el.remove(); block(false); window.removeEventListener('keydown', key, true); };
      const key = (e) => { if (e.code === 'Escape' || e.code === 'KeyE') { e.stopPropagation(); e.preventDefault(); close(); } };
      window.addEventListener('keydown', key, true);
      render();
    },
  };
})(typeof window !== 'undefined' ? window : globalThis);
