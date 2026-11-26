// Água-Tinta — bestiary "Caderno de Campo" (owner E): tabs per zone + sightings + messages, card grid with
// silhouettes for unknown species, detail view (2-frame sprite, record, counts, hints) and completion %.
(function (AQ) {
  'use strict';

  var ui = AQ.ui = AQ.ui || {};
  var D = ui.dom, t = D.t, el = D.el, N = ui.names, F = ui.fmt;

  function st() { return AQ.state; }
  function zones() {
    var order = D.safe(function () { return AQ.zones.order; }, null);
    return order && order.length ? order : AQ.ENUM.ZONES;
  }
  function tabsList() { return zones().concat(['sightings', 'messages']); }
  function inZone(z) { return D.safe(function () { return AQ.species.inZone(z); }, []) || []; }
  function entry(id) { return (st().bestiary && st().bestiary[id]) || null; }
  function caught(id) { var e = entry(id); return !!(e && e.caught > 0); }
  function seen(id) { var e = entry(id); return !!(e && (e.seen || e.caught > 0)); }
  function hintedByMessage(spId) {
    var msgs = D.safe(function () { return AQ.goals.messages; }, []) || [];
    var found = st().messages || {};
    for (var i = 0; i < msgs.length; i++) {
      var m = msgs[i];
      var h = m.hint;
      if (found[m.id] && (h === spId || (Array.isArray(h) && h.indexOf(spId) >= 0))) return true;
    }
    return false;
  }
  function completion() {
    return D.safe(function () { return AQ.progress.completion(st()); }, null) || { caught: 0, seen: 0, total: 45, pct: 0 };
  }

  // ---------------------------------------------------------------- cards
  function speciesCard(inst, s) {
    var c = caught(s.id), v = seen(s.id), e = entry(s.id);
    var sel = inst.state.sel === s.id;
    var b = el('button.aq-card', { type: 'button', 'data-fid': 'c:' + s.id, 'aria-pressed': sel ? 'true' : 'false' });
    if (sel) b.classList.add('is-on');
    if (!c) b.classList.add('is-unknown');
    var art = D.spriteOf(s.id);
    b.appendChild(el('div.aq-card-art', null, D.sprite(art || ['???'], { silhouette: !c, animate: false, dense: c && e && e.dense > 0 && false })));
    b.appendChild(el('div.aq-card-name', { text: v ? N.species(s.id) : t('ui.bestiary.unknown') }));
    var foot = c ? t('ui.bestiary.caught', { n: e.caught }) + ' ' + N.stars(s.rarity) : (v ? t('ui.bestiary.seen') : '');
    b.appendChild(el('div.aq-card-foot', { text: foot }));
    b.addEventListener('click', function () { D.feedback('uiTap'); inst.state.sel = s.id; inst.state.sheet = true; inst.rerender(); });
    return b;
  }
  function sightingCard(inst, s) {
    var ts = st().sightings && st().sightings[s.id];
    var sel = inst.state.sel === 's:' + s.id;
    var b = el('button.aq-card', { type: 'button', 'data-fid': 'c:s:' + s.id });
    if (sel) b.classList.add('is-on');
    if (!ts) b.classList.add('is-unknown');
    var def = AQ.sprites && AQ.sprites[s.sprite || s.id];
    b.appendChild(el('div.aq-card-art', null, D.sprite(def && def.frames ? def : ['~~~'], { silhouette: !ts, animate: false })));
    b.appendChild(el('div.aq-card-name', { text: ts ? N.sighting(s.id) : t('ui.bestiary.unknown') }));
    b.appendChild(el('div.aq-card-foot', { text: ts ? AQ.i18n.date(ts) : '' }));
    b.addEventListener('click', function () { D.feedback('uiTap'); inst.state.sel = 's:' + s.id; inst.state.sheet = true; inst.rerender(); });
    return b;
  }

  // ---------------------------------------------------------------- detail
  function detail(inst) {
    var sel = inst.state.sel;
    var box = el('div.aq-detail', { 'aria-live': 'polite' });
    if (!sel) { box.appendChild(el('p.aq-p.aq-dim', { text: t('ui.bestiary.pick') })); return box; }
    if (sel.indexOf('s:') === 0) return sightingDetail(box, sel.slice(2));
    var s = D.safe(function () { return AQ.species.get(sel); }, null);
    if (!s) return box;
    var c = caught(s.id), v = seen(s.id), e = entry(s.id) || {};
    var art = D.spriteOf(s.id);
    box.appendChild(el('div.aq-detail-art', null, D.sprite(art || ['???'], { silhouette: !c, scale: 1.4, animate: c, dense: c && e.dense > 0 })));
    var head = el('div.aq-detail-head');
    head.appendChild(el('span.aq-name', { text: (v ? N.species(s.id) : t('ui.bestiary.unknown')).toUpperCase() }));
    head.appendChild(el('span.aq-stars', { text: N.stars(s.rarity) }));
    head.appendChild(el('span.aq-dim', { text: N.rarity(s.rarity) }));
    box.appendChild(head);
    if (v && AQ.i18n.lang === 'en') {
      var pt = N.speciesPt(s.id);
      if (pt) box.appendChild(el('div.aq-dim.aq-small', { text: t('ui.bestiary.alsoEn', { name: pt }) }));
    }
    var zid = (s.zones && s.zones[0]) || 'baia';
    box.appendChild(el('div', { text: t('ui.bestiary.where', { zone: N.zone(zid), band: t('ui.bestiary.band.' + ui.speciesBand(s.depth)) }) }));
    if (c) {
      var fl = N.flavor(s.id);
      if (fl) box.appendChild(el('p.aq-flavor', { text: '"' + fl + '"' }));
      if (e.bestLen) box.appendChild(el('div', { text: t('ui.bestiary.record', { len: F.len(e.bestLen), kg: F.kg(e.bestKg || 0) }) + (e.first ? ' · ' + t('ui.bestiary.recordDate', { date: AQ.i18n.date(e.recordAt || e.first) }) : '') }));
      box.appendChild(el('div.aq-small', { text: t('ui.bestiary.counts', { caught: e.caught || 0, kept: e.kept || 0, sold: e.sold || 0, released: e.released || 0 }) }));
      box.appendChild(el('div.aq-small', { text: t('ui.bestiary.dense', { v: e.dense > 0 ? t('common.yes') : t('common.no') }) }));
    }
    if (c || hintedByMessage(s.id)) {
      var hints = el('div.aq-hintsbox');
      hints.appendChild(el('div.aq-small', { text: t('ui.bestiary.hintTime', { list: s.time && s.time.length ? F.list(s.time.map(N.phase)) : t('ui.bestiary.anyTime') }) }));
      hints.appendChild(el('div.aq-small', { text: t('ui.bestiary.hintWeather', { list: s.weather && s.weather.length ? F.list(s.weather.map(N.weather)) : t('ui.bestiary.anyWeather') }) }));
      var baits = Object.keys(s.baits || {}).filter(function (b) { return s.baits[b] > 0; }).sort(function (a, b) { return s.baits[b] - s.baits[a]; });
      if (baits.length) hints.appendChild(el('div.aq-small', { text: t('ui.bestiary.hintBait', { list: F.list(baits.slice(0, 2).map(N.bait)) }) }));
      box.appendChild(hints);
    } else box.appendChild(el('p.aq-small.aq-dim', { text: t('ui.bestiary.hidden') }));
    return box;
  }
  function sightingDetail(box, id) {
    var s = D.safe(function () { return AQ.sightings.get(id); }, null) || { id: id };
    var ts = st().sightings && st().sightings[id];
    var def = AQ.sprites && AQ.sprites[s.sprite || id];
    box.appendChild(el('div.aq-detail-art', null, D.sprite(def && def.frames ? def : ['~~~'], { silhouette: !ts, scale: 1.2, animate: !!ts })));
    box.appendChild(el('div.aq-detail-head', null, [el('span.aq-name', { text: (ts ? N.sighting(id) : t('ui.bestiary.unknown')).toUpperCase() }), el('span.aq-dim', { text: t('ui.bestiary.nonCatch') })]));
    if (s.zones) box.appendChild(el('div', { text: F.list(s.zones.map(N.zone)) }));
    if (ts) {
      var d = N.sightingDesc(id);
      if (d) box.appendChild(el('p.aq-flavor', { text: '"' + d + '"' }));
      box.appendChild(el('div.aq-small', { text: t('ui.bestiary.sightingSeen', { date: AQ.i18n.date(ts) }) }));
    } else {
      box.appendChild(el('p.aq-small.aq-dim', { text: t('ui.bestiary.sightingNot') }));
      if (s.time) box.appendChild(el('div.aq-small', { text: t('ui.bestiary.hintTime', { list: F.list(s.time.map(N.phase)) }) }));
    }
    return box;
  }
  function messagesList(inst) {
    var msgs = D.safe(function () { return AQ.goals.messages; }, []) || [];
    if (!msgs.length) msgs = AQ.ENUM.MESSAGES.map(function (id) { return { id: id }; });
    var found = st().messages || {};
    var list = el('div.aq-msgs');
    msgs.forEach(function (m, i) {
      var f = found[m.id];
      var b = el('button.aq-msg', { type: 'button', 'data-fid': 'm:' + m.id, disabled: f ? null : true });
      b.appendChild(el('span.aq-msg-n', { text: (i + 1) + '.' }));
      b.appendChild(el('span.aq-msg-t', { text: f ? N.msgTitle(m.id) : t('ui.bestiary.messageNot') }));
      if (f) b.addEventListener('click', function () { D.feedback('uiTap'); ui.note('msg:' + m.id); });
      list.appendChild(b);
    });
    return list;
  }

  function tabCount(z) {
    var l = inZone(z);
    return l.filter(function (s) { return caught(s.id); }).length + '/' + l.length;
  }

  ui.register('bestiary', {
    modal: true,
    cls: 'is-bestiary',
    build: function (inst) {
      var tabs = tabsList();
      var tab = inst.state.tab || inst.params.tab;
      if (tabs.indexOf(tab) < 0) tab = (st().player && st().player.zone) || tabs[0];
      if (tabs.indexOf(tab) < 0) tab = tabs[0];
      inst.state.tab = tab;
      var comp = completion();
      var n = (comp.caught || 0) + (comp.seen || 0);
      var total = comp.total || AQ.ENUM.BESTIARY_TOTAL;
      var pct = typeof comp.pct === 'number' ? (comp.pct > 1 ? comp.pct / 100 : comp.pct) : n / total;
      var p = D.panel({ title: t('ui.bestiary.title'), extra: el('span.aq-panel-wallet', { text: t('ui.bestiary.completion', { n: n, total: total, pct: AQ.i18n.pct(pct) }) }),
        onClose: function () { inst.close(null); }, cls: 'aq-wide-panel aq-bestiary' + (inst.state.sheet ? ' is-sheet' : '') });
      var tabBar = el('div.aq-tabs.aq-tabs-scroll', { role: 'tablist', 'data-sid': 'tabs' });
      tabs.forEach(function (k) {
        var isZone = AQ.ENUM.ZONES.indexOf(k) >= 0;
        var label = isZone ? N.zoneShort(k) + ' ' + tabCount(k) : t('ui.bestiary.tab.' + k);
        var b = el('button.aq-tab', { type: 'button', role: 'tab', 'aria-selected': k === tab ? 'true' : 'false', 'data-fid': 'tab:' + k,
          title: isZone ? N.zone(k) : t('ui.bestiary.tabFull.' + k) }, el('span', { text: label }));
        if (k === tab) b.classList.add('is-on');
        b.addEventListener('click', function () { D.feedback('uiTap'); inst.state.tab = k; inst.state.sel = null; inst.state.sheet = false; inst.rerender(); });
        tabBar.appendChild(b);
      });
      p.el.insertBefore(tabBar, p.body);
      var wrap = el('div.aq-bestiary-wrap');
      if (tab === 'messages') {
        wrap.appendChild(messagesList(inst));
      } else {
        var grid = el('div.aq-grid', { 'data-sid': 'grid' });
        if (tab === 'sightings') (D.safe(function () { return AQ.sightings.list; }, []) || []).forEach(function (s) { grid.appendChild(sightingCard(inst, s)); });
        else inZone(tab).forEach(function (s) { grid.appendChild(speciesCard(inst, s)); });
        if (!grid.childNodes.length) grid.appendChild(el('p.aq-p.aq-dim', { text: t('ui.bestiary.pick') }));
        wrap.appendChild(grid);
        var det = detail(inst);
        if (inst.state.sheet) {
          var back = D.btn(t('common.back'), function () { inst.state.sheet = false; inst.rerender(); }, { cls: 'aq-sheet-back', fid: 'sheetBack', sfx: 'uiBack' });
          det.insertBefore(back, det.firstChild);
        }
        wrap.appendChild(det);
      }
      p.body.appendChild(wrap);
      return p.el;
    },
    onOpen: function (inst) {
      inst.state.offs = AQ.input && AQ.input.on ? [
        AQ.input.on('action:prev', function () { cycle(inst, -1); }),
        AQ.input.on('action:next', function () { cycle(inst, 1); })
      ] : [];
    },
    onClose: function (inst) { (inst.state.offs || []).forEach(function (off) { off(); }); },
    onBack: null
  });
  function cycle(inst, d) {
    if (ui.top() !== 'bestiary') return;
    var tabs = tabsList();
    var i = tabs.indexOf(inst.state.tab);
    inst.state.tab = tabs[(i + d + tabs.length) % tabs.length];
    inst.state.sel = null;
    inst.state.sheet = false;
    D.feedback('uiTap');
    inst.rerender();
  }
})(window.AQ);
