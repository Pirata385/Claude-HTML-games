// Água-Tinta — cards (owner E): catch card, fish card, zone card, bait / decor / tank pickers, offline summary.
(function (AQ) {
  'use strict';

  var ui = AQ.ui = AQ.ui || {};
  var D = ui.dom, t = D.t, el = D.el, N = ui.names, F = ui.fmt;

  function st() { return AQ.state; }
  function sp(id) { return D.safe(function () { return AQ.species.get(id); }, null); }
  function tanks() { return (st().aquarium && st().aquarium.tanks) || []; }
  function tankById(id) { var l = tanks(); for (var i = 0; i < l.length; i++) if (l[i].id === id) return l[i]; return null; }
  function usage(tank) { return D.safe(function () { return AQ.aquarium.tankUsage(tank, st()); }, null) || { used: 0, cap: 0 }; }
  function canFit(x, tank) { return !!D.safe(function () { return AQ.aquarium.canFit(x, tank, st()); }, false); }
  function sfx(n, o) { if (AQ.audio) D.safe(function () { AQ.audio.sfx(n, o); }); }
  function badge(text, cls) { return el('span.aq-badge', { text: text, cls: cls }); }
  function stars(r) { return el('span.aq-stars', { text: N.stars(r), 'aria-label': N.rarity(r) }); }

  // ================================================================ catch card
  // catchCard(specimen, {canKeep, tanks, isNew, isRecord}) → Promise<{choice, tankId?}>
  var catchKeys = null;
  ui.register('catchCard', {
    modal: true,
    closable: false,
    cls: 'is-catch',
    build: function (inst) {
      var spec = inst.params.specimen || {};
      var o = inst.params.opts || {};
      var s = sp(spec.sp) || {};
      var isNew = !!o.isNew, isRecord = !!o.isRecord;
      var title = isNew ? t('ui.catch.new') : t('ui.catch.title');
      var p = D.panel({ title: title, cls: 'aq-catch' + (isNew ? ' is-new' : '') });
      var art = D.spriteOf(spec.sp);
      var pre = D.sprite(art || ['><>'], { scale: 2, dense: !!spec.dense, cls: 'aq-catch-art' });
      p.body.appendChild(el('div.aq-catch-stage', null, pre));
      var nameRow = el('div.aq-catch-name', null, [
        el('span.aq-name', { text: N.species(spec.sp).toUpperCase() }), stars(s.rarity || 'C'), el('span.aq-dim', { text: N.rarity(s.rarity || 'C') })
      ]);
      p.body.appendChild(nameRow);
      var badges = el('div.aq-badges');
      if (isNew) badges.appendChild(badge(t('ui.catch.new'), 'is-inv'));
      if (spec.trophy) badges.appendChild(badge(t('ui.catch.trophy')));
      if (spec.dense) badges.appendChild(badge(t('ui.catch.dense'), 'is-inv'));
      if (isRecord && !isNew) badges.appendChild(badge(t('ui.catch.recordNew')));
      if (badges.childNodes.length) p.body.appendChild(badges);
      var meas = el('div.aq-catch-meas', null, [el('span', { text: t('ui.catch.measures', { len: F.len(spec.len), kg: F.kg(spec.kg) }) })]);
      var be = st().bestiary && st().bestiary[spec.sp];
      if (be && be.bestLen && !isNew) meas.appendChild(el('span.aq-dim', { text: t('ui.catch.record', { len: F.len(Math.max(be.bestLen, isRecord ? spec.len : 0)) }) }));
      p.body.appendChild(meas);
      var fl = N.flavor(spec.sp);
      if (fl) p.body.appendChild(el('p.aq-flavor', { text: '"' + fl + '"' }));

      // choices
      var value = D.safe(function () { return AQ.economy.specimenValue(spec); }, 0) || 0;
      var keepable = o.canKeep !== false && s.keep !== false;
      var tankId = inst.state.tankId || null;
      if (!tankId && keepable) tankId = D.safe(function () { return AQ.aquarium.bestTankFor(spec, st()); }, null);
      if (tankId && !canFit(spec, tankById(tankId) || {})) tankId = D.safe(function () { return AQ.aquarium.bestTankFor(spec, st()); }, null);
      inst.state.tankId = tankId;
      var tk = tankById(tankId);
      var keepSub;
      if (!keepable) keepSub = t('ui.catch.keepNo');
      else if (!tk) keepSub = t('ui.catch.keepNone');
      else { var u = usage(tk); keepSub = t('ui.catch.keepSub', { tank: N.tankShort(tk), used: u.used, cap: u.cap }); }
      var tut = AQ.tutorial && AQ.tutorial.active && AQ.tutorial.step === 7;
      var keep = D.btn(t('ui.catch.keep'), function () { choose(inst, 'keep'); }, { key: '1', sub: keepSub, fid: 'keep', disabled: !tk, def: !!tk, primary: tut, cls: 'aq-choice' });
      var sell = D.btn(t('ui.catch.sell'), function () { choose(inst, 'sell'); }, { key: '2', sub: AQ.i18n.money(value), fid: 'sell', def: !tk, sfx: false, cls: 'aq-choice' + (tut ? ' is-dimmed' : '') });
      var rel = D.btn(t('ui.catch.release'), function () { choose(inst, 'release'); }, { key: '3', sub: t('ui.catch.releaseSub'), fid: 'release', cls: 'aq-choice' + (tut ? ' is-dimmed' : '') });
      if (tut && tk) keep.classList.add('is-pulse');
      var row = el('div.aq-choices', null, [keep, sell, rel]);
      p.foot.appendChild(row);
      var fitting = keepable ? tanks().filter(function (x) { return canFit(spec, x); }) : [];
      if (fitting.length > 1) {
        var other = el('button.aq-linkbtn', { type: 'button', 'data-fid': 'other' }, el('span', { text: t('ui.catch.otherTank') }));
        other.addEventListener('click', function () {
          D.feedback('uiTap');
          ui.show('tankPicker', { specimen: spec, current: tankId }).then(function (id) { if (id) { inst.state.tankId = id; inst.rerender(); } });
        });
        p.foot.appendChild(el('div.aq-catch-more', null, other));
      }
      return p.el;
    },
    onOpen: function () {
      catchKeys = function (e) {
        if (ui.top() !== 'catchCard' || e.repeat) return;
        var m = { '1': 'keep', '2': 'sell', '3': 'release' }[e.key];
        if (!m) return;
        var b = document.querySelector('[data-screen="catchCard"] [data-fid="' + m + '"]');
        if (b && !b.disabled) { e.preventDefault(); b.click(); }
      };
      window.addEventListener('keydown', catchKeys);
    },
    onClose: function () { if (catchKeys) window.removeEventListener('keydown', catchKeys); catchKeys = null; }
  });
  function choose(inst, choice) {
    if (choice === 'sell') sfx('coin');
    inst.close({ choice: choice, tankId: choice === 'keep' ? inst.state.tankId : undefined });
  }
  ui.catchCard = function (specimen, opts) {
    return ui.show('catchCard', { specimen: specimen, opts: opts || {} }).then(function (r) {
      if (!r || !r.choice) return { choice: 'sell' };
      if (r.choice === 'keep' && !r.tankId) return { choice: 'sell' };
      return r;
    });
  };

  // ================================================================ fish card
  ui.register('fishCard', {
    modal: true,
    cls: 'is-fishcard',
    build: function (inst) {
      var uid = inst.params.uid;
      var fish = null;
      (st().aquarium.fish || []).forEach(function (f) { if (f.uid === uid) fish = f; });
      var p = D.panel({ title: t('ui.fish.title'), onClose: function () { inst.close(null); }, cls: 'aq-fishcard' });
      if (!fish) { p.body.appendChild(el('p.aq-p', { text: t('ui.fish.gone') })); return p.el; }
      var s = sp(fish.sp) || {};
      var tank = tankById(fish.tank);
      var top = el('div.aq-fish-top');
      top.appendChild(el('div.aq-fish-art', null, D.sprite(D.spriteOf(fish.sp) || ['><>'], { scale: 1.6, dense: !!fish.dense })));
      var info = el('div.aq-fish-info');
      var title = fish.name ? fish.name : N.species(fish.sp);
      info.appendChild(el('div.aq-fish-name', null, [el('span.aq-name', { text: title }), stars(s.rarity || 'C')]));
      if (fish.name) info.appendChild(el('div.aq-dim', { text: N.species(fish.sp) }));
      info.appendChild(el('div', { text: t('ui.catch.measures', { len: F.len(fish.len), kg: F.kg(fish.kg) }) }));
      var bl = el('div.aq-badges');
      if (fish.dense) bl.appendChild(badge(t('ui.fish.dense'), 'is-inv'));
      if (fish.trophy) bl.appendChild(badge(t('ui.fish.trophy')));
      if (typeof fish.growth === 'number' && fish.growth < 1) bl.appendChild(badge(t('ui.fish.juvenile', { pct: AQ.i18n.pct(fish.growth) })));
      if (bl.childNodes.length) info.appendChild(bl);
      var origin = fish.bred ? t('ui.fish.born', { date: AQ.i18n.date(fish.at || Date.now()) })
        : t('ui.fish.origin', { zone: N.zone(fish.zone || 'baia'), date: AQ.i18n.date(fish.at || Date.now()) });
      info.appendChild(el('div.aq-dim', { text: origin }));
      top.appendChild(info);
      p.body.appendChild(top);

      // happiness
      var hap = tank ? D.safe(function () { return AQ.aquarium.fishHappiness(fish, tank, st()); }, null) : null;
      if (hap) {
        var hv = Math.round(hap.value || 0);
        var face = D.safe(function () { return AQ.aquarium.face(hv); }, ':|');
        var hb = el('div.aq-happy');
        hb.appendChild(el('div.aq-happy-h', null, [el('span', { text: t('ui.fish.happy') }), el('span.aq-happy-v', { text: face + ' ' + AQ.i18n.pct(hv / 100) })]));
        var grid = el('div.aq-factors');
        ['food', 'space', 'habitat', 'light', 'harmony', 'quality'].forEach(function (k) {
          var v = hap.factors && typeof hap.factors[k] === 'number' ? hap.factors[k] : 1;
          var n = Math.round(Math.max(0, Math.min(1, v)) * 8);
          grid.appendChild(el('div.aq-factor', { cls: v < 0.8 ? 'is-low' : '' }, [
            el('span.aq-factor-l', { text: t('ui.fish.factor.' + k) }),
            el('span.aq-factor-bar', { text: new Array(n + 1).join('|') + new Array(9 - n).join('.'), 'aria-label': AQ.i18n.pct(v) })
          ]));
        });
        hb.appendChild(grid);
        p.body.appendChild(hb);
      }
      var likes = [];
      (s.habitat || []).forEach(function (h) { likes.push(t('ui.fish.habitat.' + h)); });
      if (s.light) likes.push(t('ui.fish.light.' + s.light));
      if (likes.length) p.body.appendChild(el('p.aq-p', { text: t('ui.fish.likes', { list: F.list(likes) }) }));
      var value = D.safe(function () { return AQ.economy.fishSellValue(fish); }, 0) || 0;
      p.body.appendChild(el('p.aq-p.aq-dim', { text: t('ui.fish.value', { price: AQ.i18n.money(value) }) }));

      // rename
      if (inst.state.renaming) {
        var inp = el('input.aq-input', { type: 'text', maxlength: '16', 'aria-label': t('ui.fish.renameLabel'), placeholder: t('ui.fish.renameLabel'), 'data-fid': 'nameInput' });
        inp.value = fish.name || '';
        var save = function () {
          var v = inp.value.replace(/[^\x20-\x7EÀ-ü]/g, '').trim().slice(0, 16);
          D.safe(function () { AQ.game.renameFish(uid, v || null); });
          if (v) ui.toast({ key: 'ui.toast.renamed', vars: { name: v } });
          inst.state.renaming = false;
          inst.rerender();
        };
        inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); save(); } if (e.key === 'Escape') { inst.state.renaming = false; inst.rerender(); } });
        p.body.appendChild(el('div.aq-rename', null, [inp, D.btn(t('ui.fish.renameSave'), save, { fid: 'nameSave' })]));
        setTimeout(function () { try { inp.focus(); } catch (e) { /* ignore */ } }, 40);
      }

      var name = fish.name || N.species(fish.sp);
      p.foot.appendChild(D.btn(t('ui.fish.move'), function () {
        ui.show('tankPicker', { uid: uid, current: fish.tank }).then(function (id) {
          if (!id || id === fish.tank) return;
          var ok = D.safe(function () { return AQ.game.moveFish(uid, id); }, false);
          if (ok) ui.toast({ key: 'ui.toast.moved', vars: { name: name, tank: N.tank(id) } }, { kind: 'good' });
          else ui.toast({ key: 'ui.toast.noFit' }, { kind: 'warn' });
          inst.rerender();
        });
      }, { fid: 'move', disabled: tanks().length < 2 }));
      p.foot.appendChild(D.btn(t('ui.fish.rename'), function () { inst.state.renaming = !inst.state.renaming; inst.rerender(); }, { fid: 'rename' }));
      p.foot.appendChild(D.btn(t('ui.fish.sell'), function () {
        ui.confirm({ titleKey: 'ui.fish.sellTitle', bodyKey: 'ui.fish.sellBody', vars: { name: name, price: AQ.i18n.money(value) } }).then(function (ok) {
          if (!ok) return;
          var got = D.safe(function () { return AQ.game.sellFish(uid); }, 0);
          if (got) { sfx('coin'); ui.toast({ key: 'ui.toast.sold', vars: { name: name, amount: AQ.i18n.money(got) } }, { kind: 'good' }); inst.close('sold'); }
          else ui.toast({ key: 'ui.toast.sellNo' }, { kind: 'warn' });
        });
      }, { fid: 'sell', sub: AQ.i18n.money(value) }));
      p.foot.appendChild(D.btn(t('ui.fish.release'), function () {
        ui.confirm({ titleKey: 'ui.fish.releaseTitle', bodyKey: 'ui.fish.releaseBody', vars: { name: name }, danger: true }).then(function (ok) {
          if (!ok) return;
          if (D.safe(function () { return AQ.game.releaseFish(uid); }, false)) { sfx('splashSmall'); inst.close('released'); }
        });
      }, { fid: 'release' }));
      return p.el;
    },
    onClose: function () { if (AQ.tutorial && AQ.tutorial.onAction) AQ.tutorial.onAction('fishCard'); }
  });
  ui.fishCard = function (uid) { return ui.show('fishCard', { uid: uid }).then(function () { return undefined; }); };

  // ================================================================ tank picker
  // show('tankPicker', {specimen?, uid?, current?}) → tankId | null
  ui.register('tankPicker', {
    modal: true,
    cls: 'is-picker',
    build: function (inst) {
      var o = inst.params;
      var p = D.panel({ title: t('ui.tank.title'), onClose: function () { inst.close(null); }, cls: 'aq-narrow' });
      var subject = o.specimen || null;
      var fish = null;
      if (o.uid) (st().aquarium.fish || []).forEach(function (f) { if (f.uid === o.uid) fish = f; });
      var list = el('div.aq-list');
      tanks().forEach(function (tk, i) {
        var u = usage(tk);
        var fits = subject ? canFit(subject, tk) : fish ? (tk.id === fish.tank || canFit(fish.sp ? sp(fish.sp) || fish : fish, tk)) : true;
        var cur = o.current === tk.id;
        var count = (st().aquarium.fish || []).filter(function (f) { return f.tank === tk.id; }).length;
        var sub = t('ui.tank.usage', { used: u.used, cap: u.cap }) + ' · ' + AQ.i18n.tn('ui.tank.fishCount', count) +
          (cur ? ' · ' + t('ui.tank.current') : fits ? '' : ' · ' + t('ui.tank.full'));
        list.appendChild(D.btn(t('ui.tank.name', { n: i + 1 }), function () { inst.close(tk.id); },
          { sub: sub, disabled: !fits && !cur, fid: 't:' + tk.id, def: cur, cls: 'aq-wide aq-listbtn' }));
      });
      p.body.appendChild(list);
      return p.el;
    }
  });

  // ================================================================ bait picker
  ui.register('baitPicker', {
    modal: true,
    cls: 'is-picker',
    build: function (inst) {
      var p = D.panel({ title: t('ui.bait.title'), onClose: function () { inst.close(null); }, cls: 'aq-narrow aq-baits' });
      var pl = st().player;
      var list = el('div.aq-list');
      var any = false;
      AQ.ENUM.BAITS.forEach(function (id) {
        var lure = AQ.ENUM.LURES.indexOf(id) >= 0;
        var n = lure ? (pl.lures && pl.lures[id] ? -1 : 0) : (pl.baits && pl.baits[id] !== undefined ? pl.baits[id] : 0);
        if ((id === 'papel' || id === 'perola') && !n) return;
        if (lure && !n) return;
        var glyph = (AQ.items && AQ.items.BAITS && AQ.items.BAITS[id] && AQ.items.BAITS[id].glyph) || (AQ.art && AQ.art.baitGlyph && AQ.art.baitGlyph[id]) || 'o';
        var cur = pl.bait === id;
        var sub = lure ? t('ui.bait.lure') : n < 0 ? t('ui.bait.infinite') : n > 0 ? t('ui.bait.count', { n: n }) : t('ui.bait.none');
        if (cur) sub += ' · ' + t('ui.bait.inUse');
        var b = D.btn(N.bait(id), function () {
          var ok = D.safe(function () { return AQ.game.equipBait(id); }, false);
          if (ok !== false) ui.toast({ key: 'ui.toast.baitEquipped', vars: { name: N.bait(id) } });
          inst.close(id);
        }, { sub: sub, disabled: n === 0, fid: 'b:' + id, def: cur, cls: 'aq-wide aq-listbtn' + (cur ? ' is-current' : '') });
        b.insertBefore(el('span.aq-glyph', { text: 'J' + glyph, 'aria-hidden': 'true' }), b.firstChild);
        list.appendChild(b);
        any = true;
      });
      p.body.appendChild(list);
      if (!any || (pl.baits && !pl.baits.minhoca && !pl.baits.camarao)) p.body.appendChild(el('p.aq-p.aq-dim', { text: t('ui.bait.buyHint') }));
      return p.el;
    }
  });

  // ================================================================ decor picker
  function decorArt(id) {
    var a = AQ.art && AQ.art.decor && AQ.art.decor[id];
    if (a && a.frames) return a;
    if (Array.isArray(a)) return a;
    return null;
  }
  ui.register('decorPicker', {
    modal: true,
    cls: 'is-picker',
    build: function (inst) {
      var tankId = inst.params.tankId;
      var tk = tankById(tankId) || tanks()[0];
      var p = D.panel({ title: t('ui.decor.title', { tank: N.tank(tk) }), onClose: function () { inst.close(null); }, cls: 'aq-decor' });
      if (!tk) return p.el;
      var sel = typeof inst.state.slot === 'number' ? inst.state.slot : -1;
      p.body.appendChild(el('p.aq-p.aq-dim', { text: t('ui.decor.pick') }));
      var slots = el('div.aq-slots');
      (tk.decor || []).forEach(function (d, i) {
        var b = el('button.aq-slot', { type: 'button', 'data-fid': 's:' + i, 'aria-pressed': i === sel ? 'true' : 'false' });
        if (i === sel) b.classList.add('is-on');
        b.appendChild(el('span.aq-slot-n', { text: t('ui.decor.slot', { n: i + 1 }) }));
        if (d) {
          var art = decorArt(d);
          b.appendChild(art ? D.sprite(art, { animate: false, cls: 'aq-slot-art' }) : el('span.aq-slot-art', { text: '[#]' }));
          b.appendChild(el('span.aq-slot-l', { text: N.decor(d) }));
        } else b.appendChild(el('span.aq-slot-l.aq-dim', { text: t('ui.decor.empty') }));
        b.addEventListener('click', function () { D.feedback('uiTap'); inst.state.slot = i; inst.rerender(); });
        slots.appendChild(b);
      });
      p.body.appendChild(slots);
      if (sel >= 0) {
        var owned = AQ.ENUM.DECOR.filter(function (id) { return st().player.decor && st().player.decor[id] > 0; });
        var list = el('div.aq-decor-list');
        if (tk.decor[sel]) {
          list.appendChild(D.btn(t('ui.decor.remove'), function () {
            D.safe(function () { AQ.game.placeDecor(tk.id, sel, null); });
            inst.rerender();
          }, { fid: 'remove', cls: 'aq-wide' }));
        }
        if (!owned.length) list.appendChild(el('p.aq-p.aq-dim', { text: t('ui.decor.none') }));
        owned.forEach(function (id) {
          var def = (AQ.items && AQ.items.DECOR && AQ.items.DECOR[id]) || { tags: [], attract: 0 };
          var tags = (def.tags || []).map(function (x) { return t('ui.decor.tags.' + x); });
          var sub = t('ui.decor.owned', { n: st().player.decor[id] }) + ' · ' + t('ui.decor.attract', { pct: AQ.i18n.pct(def.attract || 0) }) + (tags.length ? ' · ' + F.list(tags) : '');
          var b = D.btn(N.decor(id), function () {
            var ok = D.safe(function () { return AQ.game.placeDecor(tk.id, sel, id); }, false);
            if (ok) sfx('bubble');
            inst.rerender();
          }, { sub: sub, fid: 'd:' + id, cls: 'aq-wide aq-listbtn' });
          var art = decorArt(id);
          if (art) b.insertBefore(D.sprite(art, { animate: false, cls: 'aq-mini-art' }), b.firstChild);
          list.appendChild(b);
        });
        p.body.appendChild(list);
      }
      return p.el;
    }
  });

  // ================================================================ zone card
  function zoneOf(id) { return D.safe(function () { return AQ.zones.get(id); }, null); }
  function band(depth) {
    var mid = ((depth && depth[0]) || 0) * 0.5 + ((depth && depth[1]) || 0) * 0.5;
    return mid < 0.25 ? 'surface' : mid > 0.7 ? 'bottom' : 'mid';
  }
  ui.speciesBand = band;
  ui.register('zoneCard', {
    modal: true,
    cls: 'is-zone',
    build: function (inst) {
      var id = inst.params.zone || inst.params.id || 'baia';
      var z = zoneOf(id) || { id: id, depth: 70, mPerUnit: 0.17 };
      var s = st();
      var unlocked = D.safe(function () { return AQ.progress.zoneUnlocked(id, s); }, id === 'baia');
      if (!unlocked && s.progress && s.progress.zones && s.progress.zones.indexOf(id) >= 0) unlocked = true;
      var p = D.panel({ title: N.zone(id), onClose: function () { inst.close(null); }, cls: 'aq-zone' });
      var now = D.worldNow();
      var maxM = Math.round((z.depth || 0) * (z.mPerUnit || 0));
      p.body.appendChild(el('p.aq-p', { text: t('ui.zone.depth', { max: F.m(maxM) }) }));
      p.body.appendChild(el('p.aq-p', { text: t('ui.zone.now', { time: F.clock(now.minutes), phase: N.phase(now.phase), weather: N.weather(now.weather) }) }));
      var fc = D.safe(function () { return AQ.world.forecast(s, 3); }, []) || [];
      if (fc.length) p.body.appendChild(el('p.aq-p.aq-dim', { text: t('ui.zone.forecast', { list: fc.map(N.weather).join(' > ') }) }));
      var list = (D.safe(function () { return AQ.species.inZone(id); }, []) || []);
      var caught = list.filter(function (x) { var b = s.bestiary && s.bestiary[x.id]; return b && b.caught > 0; }).length;
      p.body.appendChild(el('p.aq-p', { text: t('ui.zone.species', { n: caught, total: list.length }) }));

      if (unlocked) {
        var luck = D.safe(function () { return AQ.game.luck(id); }, 0) || 0;
        if (luck > 0) p.body.appendChild(el('p.aq-p.aq-dim', { text: t('ui.zone.luck', { pct: AQ.i18n.pct(luck) }) }));
        var ctx = { phase: now.phase, weather: now.weather, bait: s.player.bait, luck: luck, lantern: (s.player.gear && s.player.gear.lantern) || 0, frenzy: false };
        var best = list.filter(function (x) {
          var b = s.bestiary && s.bestiary[x.id];
          if (!b || !(b.caught > 0 || b.seen)) return false;
          if (x.rarity === 'L') return false;
          return D.safe(function () { return AQ.spawn.conditionsMet(x, ctx); }, false);
        });
        p.body.appendChild(el('h3.aq-sec', { text: t('ui.zone.bestNow') }));
        if (!best.length) p.body.appendChild(el('p.aq-p.aq-dim', { text: t('ui.zone.bestNone') }));
        else {
          var bl = el('div.aq-best');
          best.slice(0, 8).forEach(function (x) {
            bl.appendChild(el('span.aq-chip', null, [el('span.aq-stars', { text: N.stars(x.rarity) }), el('span', { text: ' ' + N.species(x.id) })]));
          });
          p.body.appendChild(bl);
        }
        var waitOpen = !!inst.state.wait;
        if (waitOpen) {
          var wl = el('div.aq-wait');
          wl.appendChild(el('span.aq-dim', { text: t('ui.zone.waitTitle') }));
          AQ.ENUM.PHASES.forEach(function (ph) {
            wl.appendChild(D.btn(N.phase(ph), function () {
              var mins = D.safe(function () { return AQ.game.wait(ph); }, 0) || 0;
              var n2 = D.worldNow();
              ui.toast({ key: 'ui.toast.waited', vars: { time: F.clock(n2.minutes), phase: N.phase(n2.phase) } });
              void mins;
              inst.state.wait = false;
              inst.rerender();
            }, { fid: 'w:' + ph, disabled: ph === now.phase }));
          });
          p.body.appendChild(wl);
        }
        p.foot.appendChild(D.btn(t('ui.zone.wait'), function () { inst.state.wait = !inst.state.wait; inst.rerender(); }, { fid: 'wait' }));
        p.foot.appendChild(D.btn(t('ui.zone.fish'), function () {
          inst.close({ action: 'fish', zone: id });
          ui.hideTransient();
          AQ.scenes.go('fishing', { zone: id });
        }, { fid: 'fish', def: true, primary: true }));
      } else {
        p.body.appendChild(el('h3.aq-sec', { text: t('ui.zone.requires') }));
        var req = D.safe(function () { return AQ.progress.zoneRequirements(id, s); }, null) || { items: [] };
        var rl = el('ul.aq-reqs');
        (req.items || []).forEach(function (it) {
          rl.appendChild(el('li', { cls: it.ok ? 'is-ok' : '' }, [el('span.aq-check', { text: it.ok ? '[x]' : '[ ]', 'aria-hidden': 'true' }), el('span', { text: ' ' + t(it.key, it.vars) })]));
        });
        if (!req.items || !req.items.length) rl.appendChild(el('li', { text: t('ui.zone.locked') }));
        p.body.appendChild(rl);
        p.foot.appendChild(D.btn(t('hud.shop'), function () { inst.close(null); ui.show('shop', { tab: 'boat' }); }, { fid: 'shop', def: true }));
      }
      return p.el;
    }
  });

  // ================================================================ offline summary
  ui.register('offline', {
    modal: true,
    cls: 'is-offline',
    build: function (inst) {
      var o = inst.params || {};
      var p = D.panel({ title: t('ui.offline.title'), onClose: function () { inst.close(null); }, cls: 'aq-narrow aq-offline' });
      p.body.appendChild(el('p.aq-p.aq-dim', { text: t('ui.offline.away', { time: F.duration(o.awayMs || 0) }) }));
      var any = false;
      if (o.coins > 0) { any = true; p.body.appendChild(el('p.aq-big', { text: t('ui.offline.coins', { amount: AQ.i18n.money(o.coins) }) })); }
      if (o.pearls > 0) { any = true; p.body.appendChild(el('p.aq-big', { text: t('ui.offline.pearls', { n: AQ.i18n.num(o.pearls) }) })); }
      if (!any) p.body.appendChild(el('p.aq-p', { text: t('ui.offline.nothing') }));
      if (o.capped) p.body.appendChild(el('p.aq-p.aq-dim', { text: t('ui.offline.capped') }));
      p.body.appendChild(el('p.aq-p.aq-dim', { text: t('ui.offline.calm') }));
      if (AQ.scenes.current !== 'aquarium') p.foot.appendChild(D.btn(t('ui.offline.goAquarium'), function () { inst.close('aquarium'); AQ.scenes.go('aquarium'); }, { fid: 'aq' }));
      p.foot.appendChild(D.btn(t('ui.offline.ok'), function () { inst.close(null); }, { fid: 'ok', def: true }));
      return p.el;
    },
    onOpen: function () { sfx('coin'); }
  });
})(window.AQ);

// Água-Tinta — gameplay feedback (owner E): toasts and story notes driven by C/D events (§15.9).
(function (AQ) {
  'use strict';

  var ui = AQ.ui;
  var D = ui.dom, N = ui.names, F = ui.fmt;
  var lastBait = null;

  function tk(id) { return N.tank(id); }
  function toastKey(cands, vars, kind, ms) {
    for (var i = 0; i < cands.length; i++) {
      if (D.has(cands[i])) { ui.toast({ key: cands[i], vars: vars }, { kind: kind, ms: ms }); return; }
    }
  }

  ui.onInit(function () {
    var E = AQ.events;
    E.on('catch:resolved', function (p) {
      if (!p || !p.specimen) return;
      var name = N.species(p.specimen.sp);
      if (p.choice === 'sell') ui.toast({ key: 'ui.toast.sold', vars: { name: name, amount: AQ.i18n.money(p.value || 0) } }, { kind: 'good' });
      else if (p.choice === 'keep') {
        var fish = p.fish || (p.result && p.result.fish);
        ui.toast({ key: 'ui.toast.kept', vars: { name: name, tank: fish ? tk(fish.tank) : N.tank((AQ.state.aquarium.tanks[0] || {}).id) } }, { kind: 'good' });
      } else if (p.choice === 'release' && p.specimen.sp !== 'tinteira') ui.toast({ key: 'ui.toast.released', vars: { name: name } }, { kind: 'good' });
      if (p.isRecord && !p.isNew) ui.toast({ key: 'ui.toast.record', vars: { name: name, len: F.len(p.specimen.len) } }, { kind: 'rare' });
    });
    E.on('species:new', function (p) {
      if (!p) return;
      ui.toast({ key: 'ui.toast.newSpecies', vars: { name: N.species(p.sp) } }, { kind: 'rare', ms: 3200 });
    });
    E.on('species:seen', function (p) {
      if (!p) return;
      ui.toast({ key: 'ui.toast.seen', vars: { name: N.species(p.sp) } }, { kind: 'info', ms: 2200 });
    });
    E.on('sighting:new', function (p) { if (p) ui.toast({ key: 'ui.toast.sighting', vars: { name: N.sighting(p.id) } }, { kind: 'rare', ms: 3600 }); });
    E.on('message:found', function (p) {
      if (!p || !p.id) return;
      setTimeout(function () { ui.note('msg:' + p.id); }, 500);
    });
    E.on('frenzy:start', function () { ui.toast({ key: 'ui.toast.frenzy' }, { kind: 'rare', ms: 3000 }); });
    E.on('frenzy:end', function () { ui.toast({ key: 'ui.toast.frenzyEnd' }, { ms: 2000 }); });
    E.on('legendary:near', function () { ui.toast({ key: 'ui.toast.legendary' }, { kind: 'rare', ms: 4200 }); });
    E.on('zone:unlocked', function (p) {
      if (!p) return;
      ui.toast({ key: 'ui.toast.zoneUnlocked', vars: { zone: N.zone(p.zone) } }, { kind: 'rare', ms: 3600 });
      if (AQ.audio) AQ.audio.sfx('goal');
    });
    E.on('stars:changed', function (p) {
      if (!p || !(p.stars > p.prev)) return;
      ui.toast({ key: 'ui.toast.stars', vars: { stars: new Array(p.stars + 1).join('*') } }, { kind: 'rare', ms: 3600 });
      if (AQ.audio) AQ.audio.sfx('goal');
      if (p.stars >= 4 && p.prev < 4 && !ui.noteSeen('stars4')) setTimeout(function () { ui.note('stars4'); }, 1200);
    });
    E.on('aquarium:collected', function (p) {
      if (p && p.amount > 0) ui.toast({ key: 'ui.toast.collected', vars: { amount: AQ.i18n.money(p.amount) } }, { kind: 'good' });
    });
    E.on('aquarium:fed', function (p) { if (p) ui.toast({ key: 'ui.toast.fed', vars: { tank: tk(p.tankId) } }, { kind: 'good', ms: 1600 }); });
    E.on('aquarium:bred', function (p) { if (p) ui.toast({ key: 'ui.toast.bred', vars: { name: N.species(p.sp) } }, { kind: 'rare', ms: 3200 }); });
    E.on('aquarium:produced', function (p) {
      if (!p) return;
      if (p.item === 'pearl' || p.item === 'pearls' || p.item === 'perola') ui.toast({ key: 'ui.toast.producedPearl', vars: { n: p.qty || 1 } }, { kind: 'good' });
      else ui.toast({ key: 'ui.toast.producedBait', vars: { n: p.qty || 1 } }, { kind: 'good' });
    });
    E.on('aquarium:warning', function (p) {
      if (!p) return;
      var vars = { tank: tk(p.tankId), predator: p.predator ? N.species(p.predator) : '', prey: p.sp ? N.species(p.sp) : (p.prey ? N.species(p.prey) : ''), sp: p.sp ? N.species(p.sp) : '' };
      var k = p.kind || 'hungry';
      toastKey(['aq.warning.' + k, 'aq.warn.' + k, k === 'predator' || k === 'predation' ? 'ui.toast.predatorWarn' : 'ui.toast.hungry'], vars, 'warn', 4200);
    });
    E.on('aquarium:predation', function (p) {
      if (!p) return;
      ui.toast({ key: 'ui.toast.predation', vars: { tank: tk(p.tankId), predator: N.species(p.predator && p.predator.sp || p.predator), prey: N.species(p.prey && p.prey.sp || p.prey) } }, { kind: 'warn', ms: 5000 });
    });
    E.on('bite:miss', function (p) {
      if (!p || (AQ.tutorial && AQ.tutorial.active && AQ.tutorial.step < 8)) return;
      ui.toast({ key: p.reason === 'early' ? 'ui.toast.early' : 'ui.toast.late' }, { kind: 'warn', ms: 2000 });
    });
    E.on('fight:end', function (p) {
      if (!p || !p.result || p.result === 'landed') return;
      var cands = ['fish.escape.' + p.result, 'fish.escape.' + p.result + '.text'];
      var shown = false;
      for (var i = 0; i < cands.length; i++) if (D.has(cands[i])) { ui.toast({ key: cands[i] }, { kind: 'warn', ms: 4200 }); shown = true; break; }
      if (!shown) ui.toast({ key: 'ui.toast.escape' }, { kind: 'warn' });
      var sp = p.sp && D.safe(function () { return AQ.species.get(p.sp); }, null);
      if (sp && sp.rarity === 'L') setTimeout(function () { ui.toast({ key: 'ui.toast.legendaryEscaped' }, { ms: 3000 }); }, 1200);
    });
    E.on('inventory:changed', function () {
      var b = AQ.state.player && AQ.state.player.bait;
      if (lastBait && b !== lastBait && b === 'massa') {
        var n = AQ.state.player.baits ? AQ.state.player.baits[lastBait] : 1;
        if (n === 0) ui.toast({ key: 'ui.toast.baitOut', vars: { name: N.bait('massa') } }, { kind: 'warn' });
      }
      lastBait = b;
    });
    E.on('scene:changed', function (p) {
      lastBait = AQ.state.player && AQ.state.player.bait;
      if (p.to !== 'fishing') return;
      var z = (p.params && p.params.zone) || (AQ.state.player && AQ.state.player.zone);
      if (['recife', 'kelp', 'mar', 'abismo'].indexOf(z) >= 0 && !ui.noteSeen(z) && !(AQ.tutorial && AQ.tutorial.active && AQ.tutorial.step < 8)) {
        setTimeout(function () { if (AQ.scenes.current === 'fishing') ui.note(z); }, 1600);
      }
    });
  });
})(window.AQ);
