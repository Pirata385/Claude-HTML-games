// Água-Tinta — shop "Venda do Seu Zé" (owner E): tabs (gear, bait, boat, aquarium, decor), stat deltas,
// requirements, denied states. Buying goes through AQ.game.buy; prices/requirements through AQ.economy.
(function (AQ) {
  'use strict';

  var ui = AQ.ui = AQ.ui || {};
  var D = ui.dom, t = D.t, el = D.el, N = ui.names, F = ui.fmt;
  var TABS = ['gear', 'bait', 'boat', 'aquarium', 'decor'];
  var GEAR_ICON = { rod: '/|', line: '-~-', reel: '(@)', hook: ' J', lantern: '[*]', boat: '\\_/' };
  var AQUA_ICON = { tank: '[~~]', tankcap: '[==]', filter: '[oo]', feeder: '[\\/]', cofre: '[$]' };
  var STAT_ORDER = { rod: ['cast', 'window', 'St'], line: ['Ls', 'maxLen', 'snapGrace'], reel: ['reelSpeed', 'riseRate'],
    hook: ['hookClass'], lantern: ['radius'] };

  function st() { return AQ.state; }
  function items(cat) { return D.safe(function () { return AQ.items.byCat(cat); }, []) || []; }
  function priceOf(id, opts) { return D.safe(function () { return AQ.economy.priceOf(id, st(), opts); }, null); }
  function reqOf(id, opts) { return D.safe(function () { return AQ.economy.requirementsMet(id, st(), opts); }, null) || { ok: true, missing: [] }; }
  function afford(price) { return !!D.safe(function () { return AQ.economy.canAfford(price, st()); }, false); }
  function gearAt(slot, tier) { return D.safe(function () { return AQ.items.gearAt(slot, tier); }, null); }

  function fmtStat(k, v) {
    if (typeof v !== 'number') return String(v);
    if (k === 'window') return '+' + AQ.i18n.num(v, 2) + ' s';
    if (k === 'snapGrace') return AQ.i18n.num(v, 2) + ' s';
    if (k === 'St' || k === 'Ls') return AQ.i18n.num(v, 2);
    if (k === 'maxLen') return AQ.i18n.num(v) + ' u';
    if (k === 'riseRate') return AQ.i18n.num(v, 1);
    return AQ.i18n.num(v, v % 1 ? 1 : 0);
  }
  function deltas(slot, cur, next) {
    var out = [];
    var a = gearAt(slot, cur), b = gearAt(slot, next);
    if (!b) return out;
    (STAT_ORDER[slot] || []).forEach(function (k) {
      var va = a && a.stats ? a.stats[k] : undefined, vb = b.stats ? b.stats[k] : undefined;
      if (vb === undefined) return;
      out.push(t('ui.shop.stat.' + k) + ' ' + (va !== undefined ? fmtStat(k, va) + ' → ' : '') + fmtStat(k, vb));
    });
    return out;
  }

  function rowEl(o) {
    // o: {icon, iconArt, name, desc, lines[], req[], price, priceNull, onBuy, id, denied, note}
    var r = el('div.aq-item', { 'data-item': o.id });
    if (o.denied) r.classList.add('is-denied');
    var ic = el('div.aq-item-icon', { 'aria-hidden': 'true' });
    if (o.iconArt) ic.appendChild(o.iconArt); else ic.textContent = o.icon || '';
    r.appendChild(ic);
    var mid = el('div.aq-item-mid');
    mid.appendChild(el('div.aq-item-name', { text: o.name }));
    if (o.desc) mid.appendChild(el('div.aq-item-desc', { text: o.desc }));
    (o.lines || []).forEach(function (l) { mid.appendChild(el('div.aq-item-line', { text: l })); });
    if (o.req && o.req.length) mid.appendChild(el('div.aq-item-req', { text: t('ui.shop.requires', { list: F.list(o.req) }) }));
    if (o.denied) mid.appendChild(el('div.aq-item-deny', { role: 'alert', text: t('ui.shop.deny.' + o.denied) }));
    r.appendChild(mid);
    var act = el('div.aq-item-act');
    if (o.priceNull) act.appendChild(el('span.aq-dim.aq-item-max', { text: o.maxLabel || t('ui.shop.maxed') }));
    else {
      var can = o.reqOk && afford(o.price);
      var b = D.btn(F.price(o.price), o.onBuy, { fid: 'buy:' + o.id + (o.fidSuffix || ''), cls: 'aq-buy' + (can ? '' : ' is-cant'), sfx: false, aria: t('ui.shop.buy') + ' ' + o.name });
      act.appendChild(b);
    }
    r.appendChild(act);
    return r;
  }

  function buy(inst, id, opts, name) {
    var r = D.safe(function () { return AQ.game.buy(id, opts); }, { ok: false, reason: 'req' }) || { ok: false, reason: 'req' };
    var key = id + (opts && opts.tankId ? '@' + opts.tankId : '');
    if (r.ok) {
      inst.state.denied = {};
      if (AQ.audio) AQ.audio.sfx('buy');
      ui.toast({ key: 'ui.toast.bought', vars: { name: name } }, { kind: 'good' });
    } else {
      inst.state.denied = {};
      inst.state.denied[key] = r.reason || 'req';
      if (AQ.audio) AQ.audio.sfx('error');
      if (AQ.haptics) AQ.haptics.pulse('snap');
    }
    inst.rerender();
  }

  function deniedOf(inst, id, tankId) { return (inst.state.denied || {})[id + (tankId ? '@' + tankId : '')] || null; }
  function missing(req) { return (req.missing || []).map(function (m) { return t(m.key, m.vars); }); }

  // ---------------------------------------------------------------- tabs
  function gearTab(inst, body) {
    var pl = st().player;
    ['rod', 'line', 'reel', 'hook', 'lantern'].forEach(function (slot) {
      var cur = (pl.gear && pl.gear[slot]) || 0;
      var next = cur + 1;
      var price = priceOf(slot);
      var req = reqOf(slot);
      var nextDef = gearAt(slot, next);
      var curName = cur > 0 || slot !== 'lantern' ? N.item(slot, cur) : '';
      var name = nextDef ? N.item(slot, next) : N.item(slot, cur);
      var lines = nextDef ? deltas(slot, cur, next) : [];
      if (curName && nextDef) lines.unshift(t('ui.shop.current', { name: curName }));
      body.appendChild(rowEl({ id: slot, icon: GEAR_ICON[slot], name: name, desc: N.itemDesc(slot, nextDef ? next : cur),
        lines: lines, req: req.ok ? [] : missing(req), reqOk: req.ok, price: price, priceNull: !price || !nextDef, denied: deniedOf(inst, slot),
        onBuy: function () { buy(inst, slot, null, name); } }));
    });
  }
  function baitTab(inst, body) {
    var pl = st().player;
    items('bait').concat(items('lure')).forEach(function (it) {
      var price = priceOf(it.id);
      var req = reqOf(it.id);
      var hidden = (it.id === 'bait_papel' || it.id === 'bait_perola') && !req.ok && !(pl.unlocks && (pl.unlocks.papel || pl.unlocks.perola));
      var lure = it.cat === 'lure';
      var owned = lure ? !!(pl.lures && pl.lures[it.bait]) : false;
      var have = lure ? '' : t('ui.shop.have', { n: (pl.baits && pl.baits[it.bait]) || 0 });
      var name = D.tFirst([it.name, 'item.' + it.id + '.name'], null, N.bait(it.bait));
      var glyph = (AQ.items.BAITS && AQ.items.BAITS[it.bait] && AQ.items.BAITS[it.bait].glyph) || 'o';
      var lines = [lure ? t('ui.shop.permanent') : t('ui.shop.pack', { n: it.qty || 1 }) + ' · ' + have];
      body.appendChild(rowEl({ id: it.id, icon: 'J' + glyph, name: hidden ? t('common.unknown') : name, desc: hidden ? '' : N.itemDesc(it.id),
        lines: hidden ? [] : lines, req: req.ok ? [] : missing(req), reqOk: req.ok, price: price || it.price,
        priceNull: owned || !price, maxLabel: owned ? t('ui.shop.owned') : undefined, denied: deniedOf(inst, it.id),
        onBuy: function () { buy(inst, it.id, null, name); } }));
    });
  }
  function boatTab(inst, body) {
    var pl = st().player;
    var cur = (pl.gear && pl.gear.boat) || 1;
    var next = cur + 1;
    var nextDef = gearAt('boat', next);
    var price = priceOf('boat');
    var req = reqOf('boat');
    var name = nextDef ? N.item('boat', next) : N.item('boat', cur);
    var lines = [t('ui.shop.current', { name: N.item('boat', cur) })];
    if (nextDef && nextDef.stats && nextDef.stats.zone) lines.push(t('ui.shop.unlocks', { zone: N.zone(nextDef.stats.zone) }));
    body.appendChild(rowEl({ id: 'boat', icon: GEAR_ICON.boat, name: name, desc: N.itemDesc('boat', nextDef ? next : cur), lines: lines,
      req: req.ok ? [] : missing(req), reqOk: req.ok, price: price, priceNull: !price || !nextDef, denied: deniedOf(inst, 'boat'),
      onBuy: function () { buy(inst, 'boat', null, name); } }));
  }
  function aquaTab(inst, body) {
    var s = st();
    var tanks = s.aquarium.tanks || [];
    var tankId = inst.state.tankId && tanks.some(function (x) { return x.id === inst.state.tankId; }) ? inst.state.tankId : (tanks[0] && tanks[0].id);
    inst.state.tankId = tankId;
    // whole-aquarium items
    ['tank', 'cofre'].forEach(function (id) {
      var it = D.safe(function () { return AQ.items.get(id); }, null);
      if (!it) return;
      var price = priceOf(id);
      var req = reqOf(id);
      var name = id === 'tank' ? t('ui.shop.tankNew', { n: tanks.length + 1 }) : D.tFirst([it.name], null, N.item(id));
      var lines = [];
      if (id === 'cofre') {
        var hrs = (AQ.items.COFRE_HOURS || [2, 4, 8]);
        var c = s.player.cofre || 1;
        lines.push(t('ui.shop.stat.hours') + ' ' + t('ui.shop.hoursVal', { n: hrs[c - 1] }) + (hrs[c] ? ' → ' + t('ui.shop.hoursVal', { n: hrs[c] }) : ''));
      }
      body.appendChild(rowEl({ id: id, icon: AQUA_ICON[id], name: name, desc: N.itemDesc(id), lines: lines, req: req.ok ? [] : missing(req),
        reqOk: req.ok, price: price, priceNull: !price, denied: deniedOf(inst, id), onBuy: function () { buy(inst, id, null, name); } }));
    });
    // per-tank items with a tank selector
    if (tanks.length) {
      var chips = el('div.aq-chips', { role: 'radiogroup', 'aria-label': t('ui.shop.forTank') });
      chips.appendChild(el('span.aq-dim', { text: t('ui.shop.forTank') }));
      tanks.forEach(function (tk, i) {
        var on = tk.id === tankId;
        var b = el('button.aq-seg-b', { type: 'button', role: 'radio', 'aria-checked': on ? 'true' : 'false', 'data-fid': 'tk:' + tk.id }, el('span', { text: t('ui.tank.name', { n: i + 1 }) }));
        if (on) b.classList.add('is-on');
        b.addEventListener('click', function () { D.feedback('uiTap'); inst.state.tankId = tk.id; inst.rerender(); });
        chips.appendChild(b);
      });
      body.appendChild(chips);
    }
    var tk = tanks.filter(function (x) { return x.id === tankId; })[0];
    ['tankcap', 'filter', 'feeder'].forEach(function (id) {
      var it = D.safe(function () { return AQ.items.get(id); }, null);
      if (!it || !tk) return;
      var opts = { tankId: tk.id };
      var price = priceOf(id, opts);
      var req = reqOf(id, opts);
      var name = D.tFirst([it.name], null, N.item(id));
      var lines = [];
      if (id === 'tankcap') {
        var caps = AQ.ENUM.TANK_CAP;
        lines.push(t('ui.shop.stat.cap') + ' ' + caps[(tk.cap || 1) - 1] + (caps[tk.cap || 1] ? ' → ' + caps[tk.cap || 1] : ''));
      } else if (id === 'filter') {
        var fl = AQ.ENUM.TANK_FILTER;
        lines.push(t('ui.shop.stat.filter') + ' ' + fl[(tk.filter || 1) - 1] + (fl[tk.filter || 1] ? ' → ' + fl[tk.filter || 1] : ''));
      }
      var owned = id === 'feeder' && tk.feeder;
      body.appendChild(rowEl({ id: id, fidSuffix: '@' + tk.id, icon: AQUA_ICON[id], name: name, desc: N.itemDesc(id), lines: lines,
        req: req.ok ? [] : missing(req), reqOk: req.ok, price: price, priceNull: !price || owned, maxLabel: owned ? t('ui.shop.owned') : undefined,
        denied: deniedOf(inst, id, tk.id), onBuy: function () { buy(inst, id, opts, name); } }));
    });
  }
  function decorTab(inst, body) {
    var pl = st().player;
    items('decor').forEach(function (it) {
      var price = priceOf(it.id);
      var req = reqOf(it.id);
      var def = (AQ.items.DECOR && AQ.items.DECOR[it.id]) || {};
      var name = N.decor(it.id);
      var tags = (def.tags || []).map(function (x) { return t('ui.decor.tags.' + x); });
      var lines = [t('ui.decor.attract', { pct: AQ.i18n.pct(def.attract || 0) }) + (tags.length ? ' · ' + F.list(tags) : '') + ' · ' + '*' + new Array(def.stars || 1).join('*')];
      var stored = pl.decor && pl.decor[it.id];
      if (stored) lines.push(t('ui.shop.stored', { n: stored }));
      var art = AQ.art && AQ.art.decor && AQ.art.decor[it.id];
      body.appendChild(rowEl({ id: it.id, icon: '[#]', iconArt: art && (art.frames || Array.isArray(art)) ? D.sprite(art, { animate: false, cls: 'aq-mini-art' }) : null,
        name: name, desc: N.itemDesc(it.id), lines: lines, req: req.ok ? [] : missing(req), reqOk: req.ok, price: price || it.price,
        priceNull: !price, denied: deniedOf(inst, it.id), onBuy: function () { buy(inst, it.id, null, name); } }));
    });
  }

  ui.register('shop', {
    modal: true,
    cls: 'is-shop',
    build: function (inst) {
      var tab = inst.state.tab || inst.params.tab || 'gear';
      if (TABS.indexOf(tab) < 0) tab = 'gear';
      inst.state.tab = tab;
      if (!inst.state.denied) inst.state.denied = {};
      var pl = st().player;
      var wallet = el('span.aq-panel-wallet', { text: AQ.i18n.money(pl.coins) + '  ' + AQ.i18n.pearls(pl.pearls) });
      var p = D.panel({ title: t('ui.shop.title'), extra: wallet, onClose: function () { inst.close(null); }, cls: 'aq-wide-panel aq-shop' });
      var tabs = el('div.aq-tabs.aq-tabs-scroll', { role: 'tablist', 'data-sid': 'tabs' });
      TABS.forEach(function (k) {
        var b = el('button.aq-tab', { type: 'button', role: 'tab', 'aria-selected': k === tab ? 'true' : 'false', 'data-fid': 'tab:' + k }, el('span', { text: t('ui.shop.tab.' + k) }));
        if (k === tab) b.classList.add('is-on');
        b.addEventListener('click', function () { D.feedback('uiTap'); inst.state.tab = k; inst.state.denied = {}; inst.rerender(); });
        tabs.appendChild(b);
      });
      p.el.insertBefore(tabs, p.body);
      var list = el('div.aq-items');
      if (tab === 'gear') gearTab(inst, list);
      else if (tab === 'bait') baitTab(inst, list);
      else if (tab === 'boat') boatTab(inst, list);
      else if (tab === 'aquarium') aquaTab(inst, list);
      else decorTab(inst, list);
      if (!list.childNodes.length) list.appendChild(el('p.aq-p.aq-dim', { text: t('ui.shop.empty') }));
      p.body.appendChild(list);
      return p.el;
    },
    onOpen: function (inst) {
      inst.state.offs = [
        AQ.events.on('wallet:changed', function () { inst.rerender(); }),
        AQ.input && AQ.input.on ? AQ.input.on('action:prev', function () { cycle(inst, -1); }) : null,
        AQ.input && AQ.input.on ? AQ.input.on('action:next', function () { cycle(inst, 1); }) : null
      ];
    },
    onClose: function (inst) { (inst.state.offs || []).forEach(function (off) { if (off) off(); }); }
  });
  function cycle(inst, d) {
    if (ui.top() !== 'shop') return;
    var i = TABS.indexOf(inst.state.tab || 'gear');
    inst.state.tab = TABS[(i + d + TABS.length) % TABS.length];
    inst.state.denied = {};
    D.feedback('uiTap');
    inst.rerender();
  }
})(window.AQ);
