// Água-Tinta — the map / hub scene (owner C, §11.2). Coast with the aquarium, the shop and the pier; the five waters
// get deeper away from the coast (to the right in landscape, upward in portrait). Each water shows its name, the
// species caught (n/total), a hint of its features, or its lock state and first requirement. Tap a water → zone card
// (E). Keyboard/gamepad: ← → (↑ ↓ in portrait) choose, Enter opens. Water texture on the bg grid; labels on main.
(function (AQ) {
  'use strict';

  var U = AQ.util;
  var ROMAN = ['', 'I', 'II', 'III', 'IV', 'V'];
  var FEAT = { baia: ',;,  )(', recife: '#%#  &@', kelp: ')()(  )(', mar: '~^~   ~^~', abismo: '.:.  ^ .' };

  var m = {
    regions: [], sel: 0, hover: -1, t: 0, portrait: false,
    top: 1, bot: 20, cols: 80, rows: 24, coastW: 14, coastH: 6, layoutKey: ''
  };
  var tmpC = { c: 0, r: 0 };

  function t(k, v) { return AQ.i18n.t(k, v); }
  function S() { return AQ.state; }
  function safe(fn, fb) { try { var v = fn(); return v === undefined ? fb : v; } catch (e) { return fb; } }
  function zones() { return safe(function () { return AQ.zones.order; }, null) || AQ.ENUM.ZONES; }
  function unlocked(id) {
    var s = S();
    var u = safe(function () { return AQ.progress.zoneUnlocked(id, s); }, false);
    return u || (s && s.progress && s.progress.zones && s.progress.zones.indexOf(id) >= 0) || id === 'baia';
  }
  function counts(id) {
    var list = safe(function () { return AQ.species.inZone(id); }, []) || [];
    var s = S(), n = 0;
    for (var i = 0; i < list.length; i++) { var b = s.bestiary && s.bestiary[list[i].id]; if (b && b.caught > 0) n++; }
    return { n: n, total: list.length };
  }
  function reqLabel(id) {
    var z = safe(function () { return AQ.zones.get(id); }, null);
    var boat = z && z.req && z.req.boat;
    var have = (S().player.gear && S().player.gear.boat) || 1;
    if (boat && have < boat) return t('fish.map.requires', { item: t('fish.map.boat', { n: ROMAN[boat] || boat }) });
    var r = safe(function () { return AQ.progress.zoneRequirements(id, S()); }, null);
    if (r && r.items) for (var i = 0; i < r.items.length; i++) if (!r.items[i].ok) {
      var it = r.items[i];
      var s = t(it.key, it.vars);
      return s.length > 18 ? '' : '[' + s + ']';
    }
    return '';
  }

  // ---------------------------------------------------------------- layout
  function layout() {
    var D = AQ.display;
    var ins = safe(function () { return AQ.ui.hudInsets(); }, null) || { top: 0, bottom: 0 };
    var ch = D.cellH || 20;
    var key = D.cols + 'x' + D.rows + ':' + Math.round(ins.top) + ':' + Math.round(ins.bottom);
    if (key === m.layoutKey) return;
    m.layoutKey = key;
    m.cols = D.cols; m.rows = D.rows;
    m.portrait = D.orientation === 'portrait';
    m.top = Math.min(D.rows - 10, Math.ceil(Math.max(0, ins.top - D.originY) / ch) + 1);
    m.bot = Math.max(m.top + 10, D.rows - 1 - Math.ceil(Math.max(0, ins.bottom - D.originY) / ch) - 1);
    var ids = zones(), regs = [];
    if (!m.portrait) {
      m.coastW = Math.max(12, Math.min(18, Math.floor(m.cols * 0.16)));
      var x0 = m.coastW + 1, w = Math.floor((m.cols - x0 - 1) / ids.length);
      for (var i = 0; i < ids.length; i++) {
        regs.push({ kind: 'zone', id: ids[i], c0: x0 + i * w, c1: x0 + (i + 1) * w - 1, r0: m.top, r1: m.bot - 2 });
      }
      regs.push({ kind: 'aquarium', c0: 1, c1: 8, r0: m.top + 1, r1: m.top + 4 });
      regs.push({ kind: 'shop', c0: 1, c1: 7, r0: m.top + 8, r1: m.top + 10 });
    } else {
      m.coastH = 6;
      var yTop = m.top, yBot = m.bot - m.coastH - 1, h = Math.max(2, Math.floor((yBot - yTop + 1) / ids.length));
      for (var j = 0; j < ids.length; j++) { // baia nearest the coast (bottom), abismo at the top
        var rb = yBot - j * h;
        regs.push({ kind: 'zone', id: ids[j], c0: 1, c1: m.cols - 2, r0: rb - h + 1, r1: rb });
      }
      regs.push({ kind: 'aquarium', c0: 1, c1: 8, r0: m.bot - 3, r1: m.bot });
      regs.push({ kind: 'shop', c0: m.cols - 8, c1: m.cols - 2, r0: m.bot - 2, r1: m.bot });
    }
    m.regions = regs;
    if (m.sel >= ids.length) m.sel = 0;
  }

  function regionAt(c, r) {
    for (var i = 0; i < m.regions.length; i++) {
      var g = m.regions[i];
      if (c >= g.c0 && c <= g.c1 && r >= g.r0 && r <= g.r1) return i;
    }
    return -1;
  }

  // ---------------------------------------------------------------- bg: water, coast, pier
  function drawBg(grid, time) {
    layout();
    var R = AQ.render, ids = zones();
    var motion = AQ.fx.motion();
    var tt = motion < 1 ? time * 0.3 : time;
    var regs = m.regions;
    for (var i = 0; i < ids.length; i++) {
      var g = regs[i], open = unlocked(g.id), depthK = i / (ids.length - 1);
      for (var r = g.r0; r <= g.r1; r++) for (var c = g.c0; c <= g.c1; c++) {
        var n = U.noise2(c * 0.21 - tt * 0.35, r * 0.6 + tt * 0.08);
        var thr = 0.66 - depthK * 0.12;
        if (n > thr) {
          var v = (n - thr) / (1 - thr);
          grid.putCode(c, r, R.rampCode('water', 0.3 + v * 0.7), open ? 2 + Math.round(v * 2) : 1);
        }
      }
      // separators between waters: a faint wave column / row
      if (!m.portrait && i > 0) for (var rr = g.r0; rr <= g.r1; rr += 2) grid.put(g.c0 - 1, rr + ((Math.floor(tt) + i) & 1), '~', 3);
    }
    // coast
    var lab1 = t('fish.map.aquarium'), lab2 = t('fish.map.aquarium2'), shopL = t('fish.map.shop');
    var aq = regs[ids.length], sh = regs[ids.length + 1];
    var aw = Math.max(lab1.length, lab2.length) + 2;
    boxArt(grid, aq.c0, aq.r0, aw, [lab1, lab2], 7);
    boxArt(grid, sh.c0, sh.r0, shopL.length + 2, [shopL], 7);
    // pier + boat
    var pr, pc;
    if (!m.portrait) { pr = m.top + 6; pc = 1; }
    else { pr = aq.r0 - 2; pc = 2; }
    var pier = '===|====';
    grid.text(pc, pr, pier, 6);
    grid.text(pc + pier.length + 1, pr, t('fish.map.pier'), 4);
    var bob = motion < 1 ? 0 : (Math.sin(time * 1.5) > 0.3 ? 1 : 0);
    grid.text(pc + 3, pr + 1, '\\o_/', 8);
    grid.text(pc + 7 + bob, pr + 1, '~~', 3);
    // sand / coastline
    if (!m.portrait) {
      for (var r2 = m.top; r2 <= m.bot - 2; r2++) grid.put(m.coastW, r2, (r2 + Math.floor(tt * 0.5)) % 3 ? ')' : '(', 3);
    } else {
      for (var c2 = 0; c2 < m.cols; c2++) grid.put(c2, aq.r0 - 3, (c2 + Math.floor(tt * 2)) % 4 === 0 ? '-' : '~', 4);
    }
  }

  function boxArt(grid, c0, r0, w, lines, level) {
    var top = ' ' + new Array(w - 1).join('_');
    grid.text(c0, r0, top, level);
    for (var i = 0; i < lines.length; i++) {
      var s = lines[i], padL = Math.floor((w - 2 - s.length) / 2), body = '';
      for (var k = 0; k < w - 2; k++) body += k >= padL && k < padL + s.length ? s[k - padL] : ' ';
      grid.text(c0, r0 + 1 + i, '|' + body + '|', level);
    }
    grid.text(c0, r0 + 1 + lines.length, '|' + new Array(w - 1).join('_') + '|', level);
  }

  // ---------------------------------------------------------------- main: labels, selection, forecast
  function draw(time) {
    layout();
    var R = AQ.render, ids = zones(), regs = m.regions;
    for (var i = 0; i < ids.length; i++) {
      var g = regs[i], id = g.id, open = unlocked(id);
      var w = g.c1 - g.c0 + 1;
      var name = safe(function () { return AQ.zones.name(id); }, id) || id;
      if (name.length > w - 2) name = t('zone.' + id + '.short');
      name = name.toUpperCase();
      var cc = Math.floor((g.c0 + g.c1) / 2);
      var mid = Math.floor((g.r0 + g.r1) / 2);
      var selected = i === m.sel && (AQ.input.mode === 'keyboard' || AQ.input.mode === 'gamepad');
      var hot = selected || i === m.hover;
      var r0 = m.portrait ? g.r0 + Math.max(0, Math.floor((g.r1 - g.r0 - 1) / 2)) : mid - 2;
      if (!open) {
        R.text(t('fish.map.locked'), cc, r0, hot ? 12 : 7, { align: 'center', knock: 0.8, invert: hot });
        R.text(name, cc, r0 + 1, hot ? 10 : 6, { align: 'center', knock: 0.8 });
        var rq = reqLabel(id);
        if (rq && !m.portrait) R.text(rq, cc, r0 + 2, 8, { align: 'center', knock: 0.8 });
        if (rq && m.portrait) R.text(rq, g.c1, r0, 8, { align: 'right', knock: 0.8 });
        continue;
      }
      var cnt = counts(id);
      var label = m.portrait ? name + '  ' + t('fish.map.species', { n: cnt.n, total: cnt.total }) : name;
      R.text(label, cc, r0, 14, { align: 'center', knock: 0.85, invert: hot, bold: hot });
      if (!m.portrait) R.text(t('fish.map.species', { n: cnt.n, total: cnt.total }), cc, r0 + 1, 11, { align: 'center', knock: 0.8 });
      var feat = FEAT[id] || '';
      if (feat && (m.portrait ? g.r1 > r0 : true)) R.text(feat, cc, m.portrait ? Math.min(g.r1, r0 + 1) : r0 + 3, 7, { align: 'center' });
    }
    // aquarium / shop hover
    var aq = regs[ids.length], sh = regs[ids.length + 1];
    var till = Math.floor((S().aquarium && S().aquarium.till) || 0);
    if (till > 0) R.text('$+' + AQ.i18n.num(till), aq.c0 + 1, aq.r1 + 1, 12, { knock: 0.8 });
    if (m.hover === ids.length) R.rectC(aq.c0, aq.r0 + 1, aq.c1 - aq.c0 + 1, 3, 2);
    if (m.hover === ids.length + 1) R.rectC(sh.c0, sh.r0 + 1, sh.c1 - sh.c0 + 1, 2, 2);
    // forecast + hint
    var fc = safe(function () { return AQ.world.forecast(S(), 3); }, []) || [];
    var list = fc.map(function (w) { return t('weather.' + w); }).join(' > ');
    var fr = m.bot;
    if (list) R.text(t('fish.map.forecast', { list: list }), m.portrait ? 10 : 2, m.portrait ? fr : fr, 10, { knock: 0.8 });
    var hint = AQ.input.mode === 'keyboard' || AQ.input.mode === 'gamepad' ? t('fish.map.hintKeys') : t('fish.map.hint');
    if (!m.portrait) R.text(hint, m.cols - 2, fr, 7, { align: 'right' });
    else R.text(hint, Math.floor(m.cols / 2), m.top, 7, { align: 'center' });
  }

  // ---------------------------------------------------------------- input
  function inMap() { return AQ.scenes.current === 'map' && !AQ.scenes.paused && !safe(function () { return AQ.ui.isModal(); }, false); }
  function open(i) {
    var g = m.regions[i];
    if (!g) return;
    if (g.kind === 'zone') safe(function () { AQ.ui.show('zoneCard', { zone: g.id }); });
    else if (g.kind === 'aquarium') AQ.scenes.go('aquarium');
    else if (g.kind === 'shop') safe(function () { AQ.ui.show('shop'); });
  }
  AQ.input.on('tap', function (p) {
    if (!inMap()) return;
    AQ.render.screenToCell(p.x, p.y, tmpC);
    var i = regionAt(tmpC.c, tmpC.r);
    if (i >= 0) { if (i < zones().length) m.sel = i; open(i); }
  });
  AQ.input.on('move', function (p) {
    if (AQ.scenes.current !== 'map') return;
    AQ.render.screenToCell(p.x, p.y, tmpC);
    m.hover = regionAt(tmpC.c, tmpC.r);
  });
  AQ.input.on('action:nav', function (e) {
    if (!inMap()) return;
    var n = zones().length;
    var d = m.portrait ? -e.dy : e.dx;
    if (!d) d = m.portrait ? e.dx : -e.dy;
    if (d) m.sel = (m.sel + (d > 0 ? 1 : -1) + n) % n;
  });
  AQ.input.on('action:confirm', function () { if (inMap()) open(m.sel); });

  AQ.scenes.register('map', {
    enter: function () {
      m.layoutKey = ''; m.hover = -1;
      var z = S() && S().player && S().player.zone;
      var i = zones().indexOf(z);
      m.sel = i >= 0 ? i : 0;
      AQ.render.cam.set(0, 0);
    },
    exit: function () {},
    update: function (dt) { m.t += dt; },
    drawBg: drawBg,
    draw: draw,
    resize: function () { m.layoutKey = ''; }
  });
  AQ.events.on('lang:changed', function () { m.layoutKey = ''; });
})(window.AQ);
