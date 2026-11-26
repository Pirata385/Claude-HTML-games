// Água-Tinta — HUD (owner E): top bar (wallet, clock, zone, pause), bottom navigation, aquarium toolbar,
// fishing controls (reel (@) button, bait, retrieve, sail < >). Modes: none | hub | fishing | aquarium (from scene:changed).
// DOM text is set only on change; update() runs at 10 Hz.
(function (AQ) {
  'use strict';

  var ui = AQ.ui = AQ.ui || {};
  var D = ui.dom, t = D.t, el = D.el, N = ui.names, F = ui.fmt;

  var mode = 'none';
  var nodes = {};
  var cache = {};
  var tankIndex = 0;
  var timer = 0;
  var contemplating = false;
  var reelHeld = false;
  var sailRelease = [];


  function st() { return AQ.state; }
  function set(node, key, s) {
    if (cache[key] === s) return;
    cache[key] = s;
    node.textContent = s;
  }
  function setAttr(node, key, attr, s) {
    if (cache[key] === s) return;
    cache[key] = s;
    node.setAttribute(attr, s);
  }
  function show(node, on) { if (node) node.classList.toggle('is-hidden', !on); }

  // ---------------------------------------------------------------- current tank (shared with D's aquarium scene)
  function tanks() { return (st().aquarium && st().aquarium.tanks) || []; }
  function currentTank() {
    var list = tanks();
    var def = AQ.scenes && AQ.scenes.get ? AQ.scenes.get('aquarium') : null;
    var id = def && (typeof def.tankId === 'string' ? def.tankId : (def.tank && def.tank.id));
    if (!id && AQ.aquariumView && AQ.aquariumView.tankId) id = AQ.aquariumView.tankId;
    if (id) for (var i = 0; i < list.length; i++) if (list[i].id === id) { tankIndex = i; return list[i]; }
    if (tankIndex >= list.length) tankIndex = Math.max(0, list.length - 1);
    return list[tankIndex] || null;
  }
  function switchTank(dir) {
    var list = tanks();
    if (list.length < 2) return;
    var def = AQ.scenes.get ? AQ.scenes.get('aquarium') : null;
    currentTank();
    tankIndex = (tankIndex + dir + list.length) % list.length;
    var id = list[tankIndex].id;
    if (def && typeof def.setTank === 'function') D.safe(function () { def.setTank(id); });
    else if (def && dir > 0 && typeof def.next === 'function') D.safe(function () { def.next(); });
    else if (def && dir < 0 && typeof def.prev === 'function') D.safe(function () { def.prev(); });
    AQ.events.emit('ui:tank', { tankId: id, index: tankIndex });
    update(true);
  }

  // ---------------------------------------------------------------- build
  function navBtn(id, labelKey, glyph, onClick) {
    var b = el('button.aq-nav-b', { type: 'button', 'data-nav': id, 'data-anchor': 'nav:' + id, 'data-fid': 'nav:' + id });
    b.appendChild(el('span.aq-nav-g', { text: glyph, 'aria-hidden': 'true' }));
    var lab = el('span.aq-nav-l', { 'data-i18n': labelKey, text: t(labelKey) });
    b.appendChild(lab);
    var badge = el('span.aq-nav-badge');
    b.appendChild(badge);
    b.addEventListener('click', function () { D.feedback('uiTap'); onClick(); });
    nodes['nav_' + id] = b;
    nodes['badge_' + id] = badge;
    return b;
  }

  function build() {
    var L = ui.layer('hud');
    // top bar
    var back = D.btn(t('hud.back'), function () { goScene('map'); }, { cls: 'aq-hud-back', anchor: 'back', sfx: 'uiBack' });
    back.querySelector('.aq-btn-l').setAttribute('data-i18n', 'hud.back');
    back.insertBefore(el('span.aq-back-arrow', { text: '<', 'aria-hidden': 'true' }), back.firstChild);
    nodes.back = back;
    nodes.coins = el('span.aq-wallet-v');
    nodes.pearls = el('span.aq-wallet-v');
    nodes.wallet = el('div.aq-wallet', null, [
      el('span.aq-wallet-i.is-coins', null, [el('span.aq-wallet-g', { text: '$', 'aria-hidden': 'true' }), nodes.coins]),
      el('span.aq-wallet-i.is-pearls', null, [el('span.aq-wallet-g', { text: '@', 'aria-hidden': 'true' }), nodes.pearls])
    ]);
    nodes.where = el('span.aq-where');
    nodes.clock = el('span.aq-clock');
    nodes.clockShort = el('span.aq-clock-short', { 'aria-hidden': 'true' });
    nodes.center = el('div.aq-top-center', null, [nodes.where, nodes.clock, nodes.clockShort]);
    nodes.pause = D.btn('||', function () { ui.openPause(); }, { cls: 'aq-hud-pause', aria: t('hud.pause'), anchor: 'pause' });
    nodes.pause.setAttribute('data-i18n-aria', 'hud.pause');
    nodes.saved = el('span.aq-saved', { 'data-i18n': 'hud.saved', text: t('hud.saved'), 'aria-hidden': 'true' });
    nodes.top = el('div.aq-top', null, [back, nodes.wallet, nodes.center, nodes.saved, nodes.pause]);
    nodes.sub = el('div.aq-top-sub');
    nodes.topWrap = el('div.aq-top-wrap', { 'data-inset': 'top' }, [nodes.top, nodes.sub]);
    L.appendChild(nodes.topWrap);

    // bottom navigation
    nodes.nav = el('nav.aq-nav', { 'data-inset': 'bottom' }, [
      navBtn('map', 'hud.map', '~^~', function () { goScene('map'); }),
      navBtn('aquarium', 'hud.aquarium', '><>', function () { goScene('aquarium'); }),
      navBtn('shop', 'hud.shop', '$', function () { ui.show('shop'); }),
      navBtn('bestiary', 'hud.bestiary', '[§]', function () { ui.show('bestiary'); }),
      navBtn('goals', 'hud.goals', '[*]', function () { ui.show('goals'); })
    ]);
    L.appendChild(nodes.nav);

    // aquarium toolbar + tank arrows
    nodes.feed = D.btn(t('hud.feed'), onFeed, { anchor: 'feed', cls: 'aq-tool' });
    nodes.feedPrice = el('span.aq-btn-sub');
    nodes.feed.appendChild(nodes.feedPrice);
    nodes.decor = D.btn(t('hud.decorate'), function () { var tk = currentTank(); if (tk) ui.show('decorPicker', { tankId: tk.id }); }, { anchor: 'decor', cls: 'aq-tool' });
    nodes.light = D.btn('', onLight, { anchor: 'light', cls: 'aq-tool' });
    nodes.contemplate = D.btn(t('hud.contemplate'), function () { setContemplate(true); }, { anchor: 'contemplate', cls: 'aq-tool aq-tool-cont' });
    nodes.till = D.btn(t('hud.till'), onTill, { anchor: 'till', cls: 'aq-tool aq-tool-till' });
    nodes.tillAmt = el('span.aq-btn-sub');
    nodes.till.appendChild(nodes.tillAmt);
    nodes.prevTankS = D.btn('<', function () { switchTank(-1); }, { cls: 'aq-tool aq-tank-arrow-s', aria: t('hud.prevTank') });
    nodes.nextTankS = D.btn('>', function () { switchTank(1); }, { cls: 'aq-tool aq-tank-arrow-s', aria: t('hud.nextTank') });
    nodes.tool = el('div.aq-toolbar', { 'data-inset': 'bottom' }, [nodes.feed, nodes.decor, nodes.light, nodes.contemplate,
      el('span.aq-toolbar-break'), nodes.prevTankS, nodes.till, nodes.nextTankS]);
    L.appendChild(nodes.tool);
    nodes.prevTank = D.btn('<', function () { switchTank(-1); }, { cls: 'aq-tank-arrow is-prev', aria: t('hud.prevTank') });
    nodes.nextTank = D.btn('>', function () { switchTank(1); }, { cls: 'aq-tank-arrow is-next', aria: t('hud.nextTank') });
    L.appendChild(nodes.prevTank);
    L.appendChild(nodes.nextTank);
    nodes.contExit = el('button.aq-contemplate-exit', { type: 'button' }, el('span', { 'data-i18n': 'hud.contemplateExit', text: t('hud.contemplateExit') }));
    nodes.contExit.addEventListener('click', function () { setContemplate(false); });
    L.appendChild(nodes.contExit);

    // fishing controls
    nodes.bait = D.btn('', function () { ui.show('baitPicker'); }, { cls: 'aq-fish-bait', anchor: 'bait' });
    nodes.retrieve = D.btn(t('hud.retrieve'), function () {
      if (AQ.input && AQ.input.virtual) { AQ.input.virtual.press('retrieve'); AQ.input.virtual.release('retrieve'); }
    }, { cls: 'aq-fish-retrieve', anchor: 'retrieve' });
    nodes.sail = buildSail();
    nodes.fishRow = el('div.aq-fishrow', { 'data-inset': 'bottom' }, [nodes.sail, nodes.bait, nodes.retrieve]);
    L.appendChild(nodes.fishRow);
    nodes.reel = buildReel();
    L.appendChild(nodes.reel);
  }

  function buildReel() {
    var b = el('button.aq-reel', { type: 'button', 'data-anchor': 'reel', 'aria-label': t('hud.reel'), 'data-i18n-aria': 'hud.reel' });
    b.appendChild(el('pre.aq-reel-art', { 'aria-hidden': 'true', text: " .-----.\n ( (@) )\n '-----'" }));
    function press(e) {
      if (e) { e.preventDefault(); try { b.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ } }
      if (reelHeld) return;
      reelHeld = true;
      b.classList.add('is-held');
      if (AQ.input && AQ.input.virtual) AQ.input.virtual.press('primary');
      if (AQ.haptics) D.safe(function () { AQ.haptics.pulse('tap'); });
    }
    function release() {
      if (!reelHeld) return;
      reelHeld = false;
      b.classList.remove('is-held');
      if (AQ.input && AQ.input.virtual) AQ.input.virtual.release('primary');
    }
    b.addEventListener('pointerdown', press);
    b.addEventListener('pointerup', release);
    b.addEventListener('pointercancel', release);
    b.addEventListener('lostpointercapture', release);
    b.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    b.addEventListener('keydown', function (e) { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); press(); } });
    b.addEventListener('keyup', function (e) { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); release(); } });
    b.addEventListener('blur', release);
    return b;
  }

  // Sail buttons [<] [>] (C's AQ.fishing.sailPress/sailRelease): hold to sail, tap for a short nudge. They talk to
  // the scene directly (not through virtual input) so a mouse click does not flip the input mode to touch.
  function buildSail() {
    var wrap = el('div.aq-sail', { role: 'group', 'aria-label': t('fish.sail.group'), 'data-i18n-aria': 'fish.sail.group' });
    [-1, 1].forEach(function (dir) {
      var key = dir < 0 ? 'fish.sail.left' : 'fish.sail.right';
      var b = el('button.aq-btn.aq-sail-b', { type: 'button', 'aria-label': t(key), 'data-i18n-aria': key, 'data-anchor': dir < 0 ? 'sail:left' : 'sail:right' });
      b.appendChild(el('span.aq-btn-l', { text: dir < 0 ? '<' : '>', 'aria-hidden': 'true' }));
      var held = false;
      function press(e) {
        if (e) {
          if (e.button > 0) return;
          e.preventDefault();
          try { b.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
        }
        if (held) return;
        held = true;
        b.classList.add('is-held');
        var did = D.safe(function () { return AQ.fishing && AQ.fishing.sailPress(dir); }, false);
        if (did && AQ.haptics) D.safe(function () { AQ.haptics.pulse('tap'); });
      }
      function release() {
        if (!held) return;
        held = false;
        b.classList.remove('is-held');
        D.safe(function () { if (AQ.fishing) AQ.fishing.sailRelease(dir); });
      }
      b.addEventListener('pointerdown', press);
      b.addEventListener('pointerup', release);
      b.addEventListener('pointercancel', release);
      b.addEventListener('lostpointercapture', release);
      b.addEventListener('contextmenu', function (e) { e.preventDefault(); });
      b.addEventListener('keydown', function (e) { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) { e.preventDefault(); e.stopPropagation(); press(); } });
      b.addEventListener('keyup', function (e) { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); release(); } });
      b.addEventListener('blur', release);
      sailRelease.push(release);
      wrap.appendChild(b);
    });
    return wrap;
  }

  function goScene(name) {
    if (!AQ.scenes || AQ.scenes.current === name) return;
    if (AQ.scenes.transitioning) return;
    ui.hideTransient();
    AQ.scenes.go(name);
  }

  // ---------------------------------------------------------------- aquarium actions
  function onFeed() {
    var tk = currentTank();
    if (!tk) return;
    var ok = D.safe(function () { return AQ.game.feedTank(tk.id); }, false);
    if (!ok) { ui.toast({ key: 'ui.toast.feedNo' }, { kind: 'warn' }); if (AQ.audio) AQ.audio.sfx('error'); }
    if (AQ.tutorial && AQ.tutorial.onAction) AQ.tutorial.onAction('feed', ok);
    update(true);
  }
  function onLight() {
    var tk = currentTank();
    if (!tk) return;
    var order = AQ.ENUM.LIGHT;
    var next = order[(order.indexOf(tk.light) + 1) % order.length];
    D.safe(function () { AQ.game.setTankLight(tk.id, next); });
    update(true);
  }
  function onTill() {
    var amount = D.safe(function () { return AQ.game.collectTill(); }, 0) || 0;
    if (amount <= 0) ui.toast({ key: 'ui.toast.tillEmpty' });
    if (AQ.tutorial && AQ.tutorial.onAction) AQ.tutorial.onAction('till', amount);
    update(true);
  }
  function setContemplate(on) {
    contemplating = !!on;
    var r = ui.root();
    if (r) r.classList.toggle('is-contemplate', contemplating);
    show(nodes.contExit, contemplating);
    AQ.events.emit('ui:contemplate', { on: contemplating });
  }

  // ---------------------------------------------------------------- mode & update
  function setMode(m) {
    if (AQ.ENUM.HUD_MODES.indexOf(m) < 0) m = 'none';
    mode = m;
    if (contemplating && m !== 'aquarium') setContemplate(false);
    var r = ui.root();
    if (r) r.setAttribute('data-hud', m);
    var hub = m === 'hub' || m === 'aquarium';
    show(nodes.topWrap, m !== 'none');
    show(nodes.back, m === 'fishing');
    show(nodes.nav, hub);
    show(nodes.tool, m === 'aquarium');
    show(nodes.prevTank, m === 'aquarium');
    show(nodes.nextTank, m === 'aquarium');
    show(nodes.fishRow, m === 'fishing');
    show(nodes.reel, m === 'fishing');
    show(nodes.contExit, false);
    if (m !== 'fishing' && reelHeld) { reelHeld = false; nodes.reel.classList.remove('is-held'); if (AQ.input) AQ.input.virtual.release('primary'); }
    if (m !== 'fishing') sailRelease.forEach(function (fn) { fn(); });
    cache = {};
    update(true);
  }

  function walletTxt(n) { return AQ.i18n.num(Math.floor(n || 0)); }

  function update(force) {
    if (!nodes.top || mode === 'none') return;
    var s = st();
    if (!s || !s.player) return;
    if (force) cache = {};
    var p = s.player;
    set(nodes.coins, 'coins', walletTxt(p.coins));
    set(nodes.pearls, 'pearls', walletTxt(p.pearls));
    setAttr(nodes.wallet, 'walletAria', 'aria-label', t('hud.wallet', { coins: walletTxt(p.coins), pearls: walletTxt(p.pearls) }));

    var now = D.worldNow();
    var time = F.clock(now.minutes);
    var clockFull = t('hud.clock', { time: time, phase: N.phase(now.phase), weather: N.weather(now.weather) });
    set(nodes.clock, 'clock', clockFull);
    // QA: words instead of the cryptic '^ *' glyphs (phase and weather names are short in English)
    // (the narrow top bar shows time + phase; the weather word moves to the zone sub-line while fishing)
    set(nodes.clockShort, 'clockShort', time + ' ' + N.phase(now.phase));
    if (nodes.center.title !== clockFull) nodes.center.title = clockFull;

    var where = '', sub = '';
    if (mode === 'fishing') {
      var z = (AQ.scenes.params && AQ.scenes.params.zone) || p.zone || 'baia';
      where = N.zone(z).toUpperCase();
      sub = where + ' · ' + N.weather(now.weather);
    } else if (mode === 'aquarium') {
      var tk = currentTank();
      var list = tanks();
      var parts = [t('hud.aquariumTitle'), t('hud.tank', { n: tankIndex + 1, total: list.length })];
      var stars = D.safe(function () { return AQ.aquarium.stars(s); }, 1) || 1;
      parts.push(new Array(stars + 1).join('*'));
      if (tk) {
        var h = D.safe(function () { return AQ.aquarium.tankHappiness(tk, s); }, 0) || 0;
        var u = D.safe(function () { return AQ.aquarium.tankUsage(tk, s); }, null) || { used: 0, cap: 0 };
        parts.push(t('hud.happy', { face: D.safe(function () { return AQ.aquarium.face(h); }, ':|'), pct: AQ.i18n.pct(h / 100) }));
        parts.push(t('hud.usage', { used: u.used, cap: u.cap }));
      }
      where = parts.join(' · ');
      sub = where;
    }
    set(nodes.where, 'where', where);
    set(nodes.sub, 'sub', sub);
    show(nodes.sub, !!sub);

    if (mode === 'hub' || mode === 'aquarium') updateNav(s);
    if (mode === 'aquarium') updateTools(s);
    if (mode === 'fishing') updateFishing(s);
  }

  function updateNav(s) {
    var cur = AQ.scenes.current;
    ['map', 'aquarium', 'shop', 'bestiary', 'goals'].forEach(function (id) {
      var on = (id === cur) || (id === 'shop' && ui.isOpen('shop')) || (id === 'bestiary' && ui.isOpen('bestiary')) || (id === 'goals' && ui.isOpen('goals'));
      var b = nodes['nav_' + id];
      if (cache['navOn_' + id] !== on) { cache['navOn_' + id] = on; b.classList.toggle('is-on', on); b.setAttribute('aria-current', on ? 'page' : 'false'); }
    });
    var till = Math.floor((s.aquarium && s.aquarium.till) || 0);
    set(nodes.badge_aquarium, 'bAq', till > 0 ? '$+' + AQ.i18n.num(till) : '');
    var comp = D.safe(function () { return AQ.progress.completion(s); }, null) || { caught: 0, seen: 0, total: 45 };
    set(nodes.badge_bestiary, 'bBe', ((comp.caught || 0) + (comp.seen || 0)) + '/' + (comp.total || 45));
    var done = 0, total = AQ.ENUM.GOALS.length;
    var gd = (s.progress && s.progress.goalsDone) || {};
    for (var k in gd) if (gd[k]) done++;
    set(nodes.badge_goals, 'bGo', done + '/' + total);
  }

  function updateTools(s) {
    var tk = currentTank();
    var list = tanks();
    var multi = list.length > 1;
    if (cache.multi !== multi) {
      cache.multi = multi;
      [nodes.prevTank, nodes.nextTank, nodes.prevTankS, nodes.nextTankS].forEach(function (n) { n.classList.toggle('is-single', !multi); });
    }
    if (!tk) return;
    var cost = D.safe(function () { return AQ.economy.feedCost(tk, s); }, 0) || 0;
    var free = !!(AQ.tutorial && AQ.tutorial.active && (s.stats && !s.stats.fed));
    set(nodes.feedPrice, 'feedP', free || cost === 0 ? t('hud.feedFree') : AQ.i18n.money(cost));
    var lab = nodes.light.querySelector('.aq-btn-l');
    set(lab, 'light', t('hud.light', { mode: t('hud.lightMode.' + (tk.light || 'day')) }));
    var till = Math.floor((s.aquarium && s.aquarium.till) || 0);
    set(nodes.tillAmt, 'till', AQ.i18n.money(till));
    var full = till > 0;
    if (cache.tillFull !== full) { cache.tillFull = full; nodes.till.classList.toggle('is-ready', full); }
  }

  function baitCount(id) {
    var p = st().player;
    if (AQ.ENUM.LURES.indexOf(id) >= 0) return p.lures && p.lures[id] ? -1 : 0;
    var n = p.baits ? p.baits[id] : 0;
    return n === undefined ? 0 : n;
  }
  function updateFishing(s) {
    var phase = (AQ.fishing && AQ.fishing.phase) || 'idle';
    var bait = s.player.bait || 'massa';
    var n = baitCount(bait);
    var lab = nodes.bait.querySelector('.aq-btn-l');
    var portrait = AQ.display && AQ.display.orientation === 'portrait';
    var txt = n < 0 ? t('hud.baitInf', { name: N.bait(bait) }) : t(portrait ? 'hud.baitShort' : 'hud.bait', { name: N.bait(bait), n: n });
    set(lab, 'bait', txt);
    var idle = phase === 'idle';
    nodes.bait.disabled = !idle;
    var canRetrieve = phase === 'sinking' || phase === 'waiting' || phase === 'nibble' || phase === 'flying' || phase === 'bite';
    if (cache.retr !== canRetrieve) {
      cache.retr = canRetrieve;
      nodes.retrieve.disabled = !canRetrieve;
      nodes.retrieve.classList.toggle('is-off', !canRetrieve);
    }
    var fight = phase === 'fight';
    if (cache.fight !== fight) { cache.fight = fight; nodes.reel.classList.toggle('is-fight', fight); }
    // sail buttons: hidden in the fight, landing and cards, and during the tutorial's first catch
    var sail = !!D.safe(function () { return AQ.fishing && AQ.fishing.sailShown && AQ.fishing.sailShown(); }, false) && !ui.isModal();
    if (cache.sail !== sail) {
      cache.sail = sail;
      show(nodes.sail, sail);
      if (!sail) sailRelease.forEach(function (fn) { fn(); });
    }
  }

  ui.hud = {
    mode: setMode,
    update: update,
    get current() { return mode; },
    currentTank: currentTank,
    switchTank: switchTank,
    contemplate: setContemplate,
    pulse: function (anchor, on) {
      var n = ui.root() && ui.root().querySelector('[data-anchor="' + anchor + '"]');
      if (n) n.classList.toggle('is-pulse', on !== false);
    },
    flashSaved: function () {
      if (!nodes.saved) return;
      nodes.saved.classList.remove('is-on');
      void nodes.saved.offsetWidth;
      nodes.saved.classList.add('is-on');
    }
  };

  var HUD_FOR = { title: 'none', map: 'hub', aquarium: 'aquarium', fishing: 'fishing', ending: 'none' };

  ui.onInit(function () {
    build();
    setMode('none');
    timer = setInterval(function () { D.safe(function () { update(false); }); }, 100);
    AQ.events.on('scene:changed', function (p) { setMode(HUD_FOR[p.to] || 'none'); });
    AQ.events.on('wallet:changed', function (p) {
      update(true);
      if (p && (p.dCoins || p.dPearls)) {
        var w = p.dCoins ? nodes.coins : nodes.pearls;
        w.classList.remove('is-bump');
        void w.offsetWidth;
        w.classList.add('is-bump');
      }
    });
    ['inventory:changed', 'aquarium:changed', 'aquarium:till', 'aquarium:fed', 'aquarium:collected', 'goal:done',
      'species:new', 'world:phase', 'world:weather', 'stars:changed', 'lang:changed', 'ui:close', 'ui:open'].forEach(function (ev) {
      AQ.events.on(ev, function () { update(true); });
    });
    AQ.events.on('aquarium:view', function (p) {
      var list = tanks();
      for (var i = 0; i < list.length; i++) if (p && list[i].id === p.tankId) tankIndex = i;
      update(true);
    });
    AQ.events.on('save:written', function (p) { if (p && p.reason !== 'auto') ui.hud.flashSaved(); });
    if (AQ.input && AQ.input.on) {
      AQ.input.on('action:prev', function () { if (mode === 'aquarium' && !ui.isModal()) switchTank(-1); });
      AQ.input.on('action:next', function () { if (mode === 'aquarium' && !ui.isModal()) switchTank(1); });
      AQ.input.on('action:bait', function () { if (mode === 'fishing' && !ui.isModal() && (!AQ.fishing || AQ.fishing.phase === 'idle')) ui.show('baitPicker'); });
      AQ.input.on('action:feed', function () { if (mode === 'aquarium' && !ui.isModal()) onFeed(); });
      AQ.input.on('tap', function () { if (contemplating) setContemplate(false); });
    }
  });
})(window.AQ);
