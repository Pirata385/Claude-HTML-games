// Água-Tinta — UI core (owner E): DOM helpers, name/format helpers, screen manager (show/hide/stack, focus,
// keyboard/gamepad navigation, input blocking), hudInsets, applyI18n and the boot of the overlay (ui.init).
// Two colours only: every style comes from css/ui.css (theme variables + alpha). No colour literals here.
(function (AQ) {
  'use strict';

  var ui = AQ.ui = AQ.ui || {};
  ui.screens = ['title', 'pause', 'settings', 'saveIO', 'credits', 'shop', 'bestiary', 'goals', 'zoneCard', 'catchCard',
    'fishCard', 'decorPicker', 'tankPicker', 'baitPicker', 'offline', 'note', 'confirm'];

  var root = null;
  var layers = {};
  var defs = Object.create(null);
  var stack = [];            // open screen instances, top = last
  var initHooks = [];        // other ui files register init work here
  var handledAt = 0;         // de-dupes Esc (emits pause + back in the same tick)

  // ================================================================ tiny helpers
  function t(key, vars) { return AQ.i18n.t(key, vars); }
  function has(key) { return AQ.i18n.has(key); }
  // first existing key among candidates → translated; else fallback (string) or a prettified last candidate.
  function tFirst(cands, vars, fallback) {
    for (var i = 0; i < cands.length; i++) if (cands[i] && has(cands[i])) return t(cands[i], vars);
    return fallback !== undefined ? fallback : prettify(cands[cands.length - 1] || '');
  }
  function prettify(key) {
    var s = String(key).split('.');
    s = s[s.length - 1] === 'name' && s.length > 1 ? s[s.length - 2] : s[s.length - 1];
    s = s.replace(/[_-]+/g, ' ');
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
  function safe(fn, fallback) {
    try { var v = fn(); return v === undefined ? fallback : v; } catch (e) { return fallback; }
  }
  function st() { return AQ.state || {}; }

  // el('button.aq-btn.big', {text, on:{click}, attrs...}, children)
  function el(spec, attrs, kids) {
    var parts = String(spec).split('.');
    var node = document.createElement(parts[0] || 'div');
    for (var i = 1; i < parts.length; i++) if (parts[i]) node.classList.add(parts[i]);
    if (attrs) {
      for (var k in attrs) {
        if (!Object.prototype.hasOwnProperty.call(attrs, k)) continue;
        var v = attrs[k];
        if (v === undefined || v === null || v === false) continue;
        if (k === 'text') node.textContent = String(v);
        else if (k === 'on') { for (var ev in v) node.addEventListener(ev, v[ev]); }
        else if (k === 'cls') String(v).split(/\s+/).forEach(function (c) { if (c) node.classList.add(c); });
        else if (k === 'style') { for (var sk in v) node.style.setProperty(sk, v[sk]); }
        else if (k === 'props') { for (var pk in v) node[pk] = v[pk]; }
        else if (v === true) node.setAttribute(k, '');
        else node.setAttribute(k, String(v));
      }
    }
    if (kids !== undefined && kids !== null) append(node, kids);
    return node;
  }
  function append(node, kids) {
    if (!Array.isArray(kids)) kids = [kids];
    for (var i = 0; i < kids.length; i++) {
      var c = kids[i];
      if (c === null || c === undefined || c === false) continue;
      if (Array.isArray(c)) { append(node, c); continue; }
      node.appendChild(typeof c === 'object' ? c : document.createTextNode(String(c)));
    }
    return node;
  }
  function clear(node) { while (node && node.firstChild) node.removeChild(node.firstChild); return node; }
  function setText(node, s) { if (node && node.textContent !== s) node.textContent = s; }

  function feedback(kind) {
    if (AQ.audio && AQ.audio.sfx) safe(function () { AQ.audio.sfx(kind || 'uiTap'); });
    if (AQ.haptics && AQ.haptics.pulse) safe(function () { AQ.haptics.pulse('tap'); });
  }

  // btn(label, onClick, opts{cls, disabled, sfx, aria, key, sub, fid, title, primary, def})
  function btn(label, onClick, opts) {
    var o = opts || {};
    var b = el('button.aq-btn', { type: 'button', cls: o.cls, 'aria-label': o.aria, title: o.title, 'data-fid': o.fid,
      'data-default': o.def ? '1' : null, 'data-anchor': o.anchor });
    if (o.primary) b.classList.add('is-primary');
    if (o.key) b.appendChild(el('span.aq-btn-key', { text: o.key }));
    var lab = el('span.aq-btn-l', { text: label });
    b.appendChild(lab);
    if (o.sub) b.appendChild(el('span.aq-btn-sub', { text: o.sub }));
    if (o.disabled) { b.disabled = true; b.setAttribute('aria-disabled', 'true'); }
    b.addEventListener('click', function (e) {
      if (b.disabled) return;
      if (o.sfx !== false) feedback(o.sfx || 'uiTap');
      if (onClick) onClick(e, b);
    });
    return b;
  }
  // segmented control: options [{value, label, disabled}] → element; onPick(value)
  function seg(options, current, onPick, opts) {
    var o = opts || {};
    var wrap = el('div.aq-seg', { role: 'radiogroup', 'aria-label': o.aria });
    options.forEach(function (op) {
      var on = op.value === current;
      var b = el('button.aq-seg-b', { type: 'button', role: 'radio', 'aria-checked': on ? 'true' : 'false',
        'data-fid': (o.fid || 'seg') + ':' + op.value, title: op.title }, el('span', { text: op.label }));
      if (on) b.classList.add('is-on');
      if (op.disabled) { b.disabled = true; b.setAttribute('aria-disabled', 'true'); }
      b.addEventListener('click', function () {
        if (b.disabled) return;
        feedback('uiTap');
        onPick(op.value);
      });
      wrap.appendChild(b);
    });
    return wrap;
  }
  // checkbox toggle "[x] Label"
  function toggle(label, on, onChange, opts) {
    var o = opts || {};
    var b = el('button.aq-toggle', { type: 'button', role: 'switch', 'aria-checked': on ? 'true' : 'false',
      'data-fid': o.fid }, [el('span.aq-toggle-box', { text: on ? '[x]' : '[ ]', 'aria-hidden': 'true' }),
      el('span.aq-toggle-l', { text: label })]);
    if (o.disabled) { b.disabled = true; b.setAttribute('aria-disabled', 'true'); }
    b.addEventListener('click', function () {
      if (b.disabled) return;
      feedback('uiTap');
      onChange(!on);
    });
    return b;
  }
  // ASCII slider "[========--] 80%": value 0..1, step .05; keyboard ←/→, pointer drag.
  function slider(label, value, onChange, opts) {
    var o = opts || {};
    var SEG = o.segments || 12;
    var cur = Math.max(0, Math.min(1, +value || 0));
    var bar = el('span.aq-slider-bar', { 'aria-hidden': 'true' });
    var pct = el('span.aq-slider-pct');
    var s = el('div.aq-slider', { role: 'slider', tabindex: '0', 'aria-label': label, 'aria-valuemin': '0',
      'aria-valuemax': '100', 'data-fid': o.fid }, [bar, pct]);
    function paint() {
      var n = Math.round(cur * SEG);
      bar.textContent = '[' + new Array(n + 1).join('=') + new Array(SEG - n + 1).join('-') + ']';
      pct.textContent = AQ.i18n.pct(cur);
      s.setAttribute('aria-valuenow', String(Math.round(cur * 100)));
    }
    function setV(v, commit) {
      v = Math.round(Math.max(0, Math.min(1, v)) * 20) / 20;
      if (v === cur && !commit) return;
      cur = v;
      paint();
      onChange(cur);
    }
    function fromX(x) {
      var r = bar.getBoundingClientRect();
      var cw = r.width / (SEG + 2);
      return (x - r.left - cw) / (r.width - 2 * cw);
    }
    var dragging = false;
    s.addEventListener('pointerdown', function (e) {
      dragging = true;
      try { s.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      setV(fromX(e.clientX));
      e.preventDefault();
    });
    s.addEventListener('pointermove', function (e) { if (dragging) setV(fromX(e.clientX)); });
    s.addEventListener('pointerup', function () { if (dragging) { dragging = false; feedback('uiTap'); } });
    s.addEventListener('pointercancel', function () { dragging = false; });
    s.addEventListener('keydown', function (e) {
      var d = 0;
      if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') d = -0.05;
      else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') d = 0.05;
      else if (e.key === 'Home') d = -1;
      else if (e.key === 'End') d = 1;
      if (!d) return;
      e.preventDefault();
      e.stopPropagation();
      setV(cur + d);
      feedback('uiTap');
    });
    paint();
    return s;
  }

  // Panel: the framed box with the title inset in the top border and [x] on the right.
  // panel({title, extra, onClose, cls}) → {el, head, body, foot}
  function panel(o) {
    o = o || {};
    var id = 'aq-p-' + Math.floor(Math.random() * 1e9).toString(36);
    var p = el('section.aq-panel', { role: 'dialog', 'aria-modal': o.modal === false ? null : 'true', 'aria-labelledby': o.title ? id : null, cls: o.cls });
    ['tl', 'tr', 'bl', 'br'].forEach(function (c) { p.appendChild(el('span.aq-corner.' + c, { text: '+', 'aria-hidden': 'true' })); });
    var head = el('header.aq-panel-head');
    if (o.title) head.appendChild(el('h2.aq-panel-title', { id: id, text: o.title }));
    head.appendChild(el('span.aq-panel-fill'));
    if (o.extra) head.appendChild(el('span.aq-panel-extra', null, o.extra));
    if (o.onClose) {
      var x = el('button.aq-x', { type: 'button', 'aria-label': t('common.close'), 'data-fid': 'x' }, el('span', { text: '[x]' }));
      x.addEventListener('click', function () { feedback('uiBack'); o.onClose(); });
      head.appendChild(x);
    }
    p.appendChild(head);
    var body = el('div.aq-panel-body.aq-scroll', { 'data-sid': 'body' });
    p.appendChild(body);
    var foot = el('footer.aq-panel-foot');
    p.appendChild(foot);
    return { el: p, head: head, body: body, foot: foot };
  }

  // ---------------------------------------------------------------- DOM sprites (<pre>)
  var anims = [];
  var animTimer = 0;
  function animTick() {
    var keep = [];
    for (var i = 0; i < anims.length; i++) {
      var a = anims[i];
      if (!a.node.isConnected) continue;
      a.acc += 1;
      if (a.acc >= a.every) {
        a.acc = 0;
        a.idx = (a.idx + 1) % a.frames.length;
        a.node.textContent = a.frames[a.idx];
      }
      keep.push(a);
    }
    anims = keep;
    if (!anims.length) { clearInterval(animTimer); animTimer = 0; }
  }
  // sprite(def|lines, opts{silhouette, dense, scale, frame, animate, cls, flip}) → <pre>
  function sprite(src, opts) {
    var o = opts || {};
    var frames = [];
    if (Array.isArray(src)) frames = Array.isArray(src[0]) ? src : [src];
    else if (src && src.frames) frames = src.frames;
    frames = frames.filter(function (f) { return Array.isArray(f) && f.length; });
    var TA = AQ.textart;
    var texts = frames.map(function (f) {
      var lines = f.slice();
      if (TA) {
        try {
          lines = TA.pad(lines);
          if (o.flip) lines = TA.mirror(lines);
          if (o.silhouette) lines = TA.silhouette(lines, '·');
          else if (o.dense) lines = TA.densify(lines);
        } catch (e) { /* keep raw */ }
      }
      return lines.join('\n');
    });
    if (!texts.length) texts = [o.silhouette ? '···' : '?'];
    var pre = el('pre.aq-sprite', { 'aria-hidden': 'true', cls: o.cls });
    if (o.silhouette) pre.classList.add('is-sil');
    if (o.dense) pre.classList.add('is-dense');
    if (o.scale) pre.style.setProperty('--sprite-scale', String(o.scale));
    var start = (o.frame || 0) % texts.length;
    pre.textContent = texts[start];
    var fps = (src && src.fps) || 2;
    if (o.animate !== false && texts.length > 1 && !(AQ.fx && AQ.fx.motion && AQ.fx.motion() < 1 && o.animate !== true)) {
      anims.push({ node: pre, frames: texts, idx: start, acc: 0, every: Math.max(1, Math.round(4 / Math.max(0.5, fps))) });
      if (!animTimer) animTimer = setInterval(animTick, 250);
    }
    return pre;
  }
  function spriteOf(spId) {
    var sp = AQ.species && AQ.species.get ? safe(function () { return AQ.species.get(spId); }, null) : null;
    var key = (sp && sp.sprite) || spId;
    var def = AQ.sprites && AQ.sprites[key];
    if (def && def.frames) return def;
    return null;
  }

  // ================================================================ names & formats (other owners' keys)
  var names = {
    species: function (id) { return tFirst(['sp.' + id + '.name', 'sp.' + id], null, prettify(id)); },
    speciesEn: function (id) {
      var d = AQ.i18n._dicts && AQ.i18n._dicts.en;
      return (d && (d['sp.' + id + '.name'] || d['sp.' + id])) || '';
    },
    speciesPt: function (id) {
      var d = AQ.i18n._dicts && AQ.i18n._dicts['pt-BR'];
      return (d && (d['sp.' + id + '.name'] || d['sp.' + id])) || '';
    },
    flavor: function (id) { return tFirst(['sp.' + id + '.flavor', 'sp.' + id + '.flavour'], null, ''); },
    sighting: function (id) { return tFirst(['sighting.' + id + '.name', 'sighting.' + id], null, prettify(id)); },
    sightingDesc: function (id) { return tFirst(['sighting.' + id + '.flavor', 'sighting.' + id + '.desc', 'sighting.' + id + '.flavour'], null, ''); },
    zone: function (id) { return tFirst(['zone.' + id + '.name', 'zone.' + id], null, prettify(id)); },
    zoneShort: function (id) { return tFirst(['zone.' + id + '.short', 'zone.' + id + '.name', 'zone.' + id], null, prettify(id)); },
    phase: function (p) { return tFirst(['phase.' + p + '.name', 'phase.' + p], null, prettify(p)); },
    weather: function (w) { return tFirst(['weather.' + w + '.name', 'weather.' + w], null, prettify(w)); },
    bait: function (id) {
      return tFirst(['item.bait.' + id, 'item.bait_' + id + '.short', 'bait.' + id, 'fish.bait.' + id, 'item.' + id + '.name',
        'item.lure_' + id + '.name', 'item.bait_' + id + '.name', 'ui.bait.name.' + id], null, prettify(id));
    },
    item: function (id, tier) {
      var c = [];
      if (tier !== undefined && tier !== null) {
        c.push('item.' + id + '.' + tier + '.name', 'item.' + id + '.t' + tier, 'item.' + id + '.' + tier, 'item.' + id + '.name.' + tier,
          'item.gear.' + id + '.' + tier);
      }
      c.push('item.' + id + '.name', 'item.' + id);
      var fb;
      var G = AQ.items && AQ.items.GEAR && AQ.items.GEAR[id];
      if (G && tier !== undefined && G[tier - (G.length > 5 ? 0 : 1)] && G[tier - (G.length > 5 ? 0 : 1)].name) fb = G[tier - (G.length > 5 ? 0 : 1)].name;
      if (fb && has(fb)) return t(fb);
      return tFirst(c, null, fb || prettify(id));
    },
    itemDesc: function (id, tier) {
      var c = [];
      if (tier !== undefined && tier !== null) c.push('item.' + id + '.' + tier + '.desc', 'item.' + id + '.t' + tier + '.desc', 'item.' + id + '.desc.' + tier);
      c.push('item.' + id + '.desc', 'item.' + id + '.flavor');
      return tFirst(c, null, '');
    },
    decor: function (id) { return tFirst(['item.decor.' + id, 'item.' + id + '.name', 'item.decor_' + id + '.name', 'aq.decor.' + id, 'item.' + id], null, prettify(id)); },
    goal: function (g, vars) {
      var id = typeof g === 'string' ? g : g && g.id;
      return tFirst(['goal.' + id + '.name', 'goal.' + id + '.title', 'goal.' + id + '.desc', 'goal.' + id], vars || (g && g.params) || null, prettify(id));
    },
    ach: function (id) { return tFirst(['ach.' + id + '.name', 'ach.' + id + '.title', 'ach.' + id], null, prettify(id)); },
    achDesc: function (id) { return tFirst(['ach.' + id + '.desc', 'ach.' + id + '.description'], null, ''); },
    msgTitle: function (id) { return tFirst(['msg.' + id + '.title', 'msg.' + id + '.name'], null, prettify(id)); },
    msgBody: function (id) { return tFirst(['msg.' + id + '.body', 'msg.' + id + '.text', 'msg.' + id], null, ''); },
    tank: function (tankOrId) {
      var tanks = (st().aquarium && st().aquarium.tanks) || [];
      var idx = -1;
      for (var i = 0; i < tanks.length; i++) if (tanks[i] === tankOrId || tanks[i].id === tankOrId) idx = i;
      return t('ui.tank.name', { n: idx >= 0 ? idx + 1 : '?' });
    },
    tankShort: function (tankOrId) {
      var tanks = (st().aquarium && st().aquarium.tanks) || [];
      var idx = -1;
      for (var i = 0; i < tanks.length; i++) if (tanks[i] === tankOrId || tanks[i].id === tankOrId) idx = i;
      return t('ui.tank.short', { n: idx >= 0 ? idx + 1 : '?' });
    },
    rarity: function (r) { return t('rarity.' + r); },
    stars: function (r) { var n = Math.max(1, AQ.ENUM.RARITY.indexOf(r) + 1); return new Array(n + 1).join('*'); }
  };

  var fmt = {
    len: function (cm) { return t('ui.unit.cm', { n: AQ.i18n.num(+cm || 0, 1) }); },
    kg: function (kg) { kg = +kg || 0; return t('ui.unit.kg', { n: AQ.i18n.num(kg, kg < 10 ? 2 : 1) }); },
    m: function (m) { return t('ui.unit.m', { n: AQ.i18n.num(Math.round(+m || 0)) }); },
    money: function (n) { return AQ.i18n.money(n); },
    pearls: function (n) { return AQ.i18n.pearls(n); },
    price: function (p) {
      if (!p) return '';
      var parts = [];
      if (p.coins) parts.push(AQ.i18n.money(p.coins));
      if (p.pearls) parts.push(AQ.i18n.pearls(p.pearls));
      return parts.join(' + ') || t('ui.shop.free');
    },
    duration: function (ms) {
      var s = Math.max(0, Math.round((+ms || 0) / 1000));
      var d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
      if (d > 0) return t('ui.time.dh', { d: d, h: h });
      if (h > 0) return t('ui.time.hm', { h: h, m: m });
      if (m > 0) return t('ui.time.m', { m: m });
      return t('ui.time.s', { s: s });
    },
    clock: function (minutes) {
      var m = Math.floor(+minutes || 0) % 1440;
      if (AQ.util && AQ.util.fmtClock) return AQ.util.fmtClock(m);
      var h = Math.floor(m / 60), mm = m % 60;
      return (h < 10 ? '0' : '') + h + ':' + (mm < 10 ? '0' : '') + mm;
    },
    list: function (arr) { return arr.filter(Boolean).join(t('ui.listSep')); }
  };

  function worldNow() {
    var n = safe(function () { return AQ.world.now(AQ.state); }, null);
    if (!n || typeof n !== 'object') n = {};
    var w = st().world || {};
    var minutes = typeof n.minutes === 'number' ? n.minutes : (w.minutes || 0);
    var phase = n.phase || safe(function () { return AQ.world.phaseOf(minutes % 1440); }, 'dia') || 'dia';
    return { minutes: minutes, day: n.day || Math.floor(minutes / 1440), phase: phase, weather: n.weather || w.weather || 'limpo' };
  }

  // ================================================================ screen manager
  // register(name, def): def = { modal=true, closable=true, layer:'modal'|'base'|'top', pauses=false,
  //   backdropClose=closable, build(inst) → element, onOpen(inst), onClose(inst, result), cls, sfxOpen='uiOpen' }
  function register(name, def) { defs[name] = def; return def; }

  function find(name) {
    for (var i = stack.length - 1; i >= 0; i--) if (stack[i].name === name) return stack[i];
    return null;
  }
  function top(filterFn) {
    for (var i = stack.length - 1; i >= 0; i--) if (!filterFn || filterFn(stack[i])) return stack[i];
    return null;
  }
  function topModal() { return top(function (s) { return s.def.modal !== false; }); }

  function updateBlock() {
    var any = !!topModal();
    if (!AQ.input || !AQ.input.block) return;
    if (any) AQ.input.block('ui');
    else AQ.input.unblock('ui');
    if (root) root.classList.toggle('has-modal', any);
  }

  function render(inst) {
    var def = inst.def;
    var prevFid = null, scrolls = {};
    if (inst.el) {
      var ae = document.activeElement;
      if (ae && inst.el.contains(ae)) prevFid = ae.getAttribute('data-fid');
      inst.el.querySelectorAll('[data-sid]').forEach(function (n) { scrolls[n.getAttribute('data-sid')] = n.scrollTop; });
    }
    var node = null;
    try { node = def.build(inst); } catch (e) { console.error('[AQ.ui] build ' + inst.name + ' failed:', e); }
    if (!node) node = el('div');
    if (!inst.el) {
      inst.el = el('div.aq-screen', { 'data-screen': inst.name, cls: def.cls });
      if (def.modal !== false) inst.el.classList.add('is-modal');
      inst.el.addEventListener('pointerdown', function (e) {
        if (e.target === inst.el && inst.def.modal !== false) {
          var bc = inst.def.backdropClose;
          if (bc === undefined) bc = inst.def.closable !== false;
          if (bc) { feedback('uiBack'); close(inst, null); }
        }
      });
    }
    clear(inst.el).appendChild(node);
    inst.el.querySelectorAll('[data-sid]').forEach(function (n) {
      var k = n.getAttribute('data-sid');
      if (scrolls[k]) n.scrollTop = scrolls[k];
    });
    if (prevFid) {
      var f = inst.el.querySelector('[data-fid="' + cssEsc(prevFid) + '"]');
      if (f && !f.disabled) focusNode(f);
      else focusFirst(inst);
    }
    return inst.el;
  }
  function cssEsc(s) { return String(s).replace(/["\\]/g, '\\$&'); }

  // show(name, params?) → Promise<result>
  function show(name, params) {
    var def = defs[name];
    if (!def) return Promise.resolve(null);
    var existing = find(name);
    if (existing) close(existing, null, true);
    return new Promise(function (resolve) {
      var inst = { name: name, def: def, params: params || {}, state: {}, resolve: resolve, el: null,
        prevFocus: document.activeElement, opened: performance.now() };
      inst.close = function (result) { close(inst, result); };
      inst.rerender = function () { if (inst.el) render(inst); };
      stack.push(inst);
      render(inst);
      var layer = layers[def.layer || 'modal'] || layers.modal;
      layer.appendChild(inst.el);
      // enter animation
      inst.el.classList.add('is-enter');
      requestAnimationFrame(function () { requestAnimationFrame(function () { if (inst.el) inst.el.classList.remove('is-enter'); }); });
      updateBlock();
      if (def.sfxOpen !== false && def.modal !== false) feedbackSound(def.sfxOpen || 'uiOpen');
      if (def.onOpen) safe(function () { def.onOpen(inst); });
      if (def.autofocus !== false) setTimeout(function () { if (stack.indexOf(inst) >= 0 && inst === top()) focusFirst(inst); }, 30);
      AQ.events.emit('ui:open', { screen: name });
    });
  }
  function feedbackSound(k) { if (AQ.audio && AQ.audio.sfx) safe(function () { AQ.audio.sfx(k); }); }

  function close(inst, result, silent) {
    var i = stack.indexOf(inst);
    if (i < 0) return;
    stack.splice(i, 1);
    if (inst.def.onClose) safe(function () { inst.def.onClose(inst, result); });
    var node = inst.el;
    inst.el = null;
    if (node) {
      node.classList.add('is-leave');
      node.style.pointerEvents = 'none';
      setTimeout(function () { if (node.parentNode) node.parentNode.removeChild(node); }, AQ.fx && AQ.fx.motion() < 1 ? 60 : 160);
    }
    updateBlock();
    // restore focus
    var pf = inst.prevFocus;
    if (pf && pf.isConnected && typeof pf.focus === 'function' && !silent) { try { pf.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }
    else if (!silent) { var tp = top(); if (tp) focusFirst(tp); }
    AQ.events.emit('ui:close', { screen: inst.name, result: result === undefined ? null : result });
    try { inst.resolve(result === undefined ? null : result); } catch (e) { /* ignore */ }
  }

  function hide(name) {
    var inst = find(name);
    if (inst) close(inst, null);
  }
  function isOpen(name) {
    if (name) return !!find(name);
    return stack.some(function (s) { return s.def.layer !== 'base'; });
  }
  function isModal() { return !!topModal(); }

  // ---------------------------------------------------------------- focus & navigation
  var FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';
  function focusables(container) {
    if (!container) return [];
    return Array.prototype.filter.call(container.querySelectorAll(FOCUSABLE), function (n) {
      if (n.closest('[hidden]') || n.closest('.is-hidden')) return false;
      var r = n.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    });
  }
  function focusNode(n) { try { n.focus({ preventScroll: false }); } catch (e) { /* ignore */ } }
  function focusFirst(inst) {
    if (!inst || !inst.el) return;
    var n = inst.el.querySelector('[data-default]:not([disabled])') || focusables(inst.el)[0];
    if (n) focusNode(n);
  }
  function navScope() {
    var m = topModal();
    if (m) return m.el;
    var ae = document.activeElement;
    if (root && ae && root.contains(ae)) {
      var scr = ae.closest('.aq-screen');
      return scr || root;
    }
    var base = top();
    if (base && base.def.layer === 'base') return base.el;
    return null;
  }
  // Spatial navigation: nearest focusable in direction (dx, dy).
  function navigate(dx, dy) {
    var scope = navScope();
    if (!scope) return false;
    var list = focusables(scope);
    if (!list.length) return false;
    var cur = document.activeElement;
    if (!cur || list.indexOf(cur) < 0) { focusNode(list[0]); return true; }
    var r0 = cur.getBoundingClientRect();
    var cx = r0.left + r0.width / 2, cy = r0.top + r0.height / 2;
    var best = null, bestScore = Infinity;
    for (var i = 0; i < list.length; i++) {
      var n = list[i];
      if (n === cur) continue;
      var r = n.getBoundingClientRect();
      var x = r.left + r.width / 2, y = r.top + r.height / 2;
      var ddx = x - cx, ddy = y - cy;
      var along = dx ? ddx * dx : ddy * dy;
      if (along <= 2) continue;
      var across = dx ? Math.abs(ddy) : Math.abs(ddx);
      var score = along + across * 2.2;
      if (score < bestScore) { bestScore = score; best = n; }
    }
    if (!best) {
      // wrap linearly
      var idx = list.indexOf(cur);
      var step = (dx || dy) > 0 ? 1 : -1;
      best = list[(idx + step + list.length) % list.length];
    }
    if (best) { focusNode(best); feedbackSound('uiTap'); }
    return !!best;
  }

  function onBack() {
    var now = performance.now();
    if (now - handledAt < 80) return;
    handledAt = now;
    var inst = top(function (s) { return s.def.layer !== 'base'; });
    if (inst) {
      if (inst.def.closable === false) {
        if (inst.def.onBack) safe(function () { inst.def.onBack(inst); });
        return;
      }
      feedback('uiBack');
      close(inst, null);
      return;
    }
    if (ui._onBackEmpty) ui._onBackEmpty();
  }
  function onPause() {
    var now = performance.now();
    if (now - handledAt < 80) return;
    var inst = top(function (s) { return s.def.layer !== 'base'; });
    if (inst) { onBack(); return; }
    handledAt = now;
    if (ui._onPauseEmpty) ui._onPauseEmpty();
  }
  function onConfirm() {
    var scope = navScope();
    if (!scope) return;
    var ae = document.activeElement;
    if (ae && scope.contains(ae) && ae.tagName === 'BUTTON') return; // the DOM handles it
    var d = scope.querySelector('[data-default]:not([disabled])');
    if (d) d.click();
  }

  // Tab trap inside the top modal.
  function onKeyDown(e) {
    if (e.key !== 'Tab') return;
    var m = topModal();
    var scope = m ? m.el : null;
    if (!scope) return;
    var list = focusables(scope);
    if (!list.length) return;
    var i = list.indexOf(document.activeElement);
    e.preventDefault();
    var n = e.shiftKey ? (i <= 0 ? list.length - 1 : i - 1) : (i < 0 || i >= list.length - 1 ? 0 : i + 1);
    focusNode(list[n]);
  }

  // Gamepad A / B inside modals (input suppresses 'primary' while blocked).
  var padPrev = [], padRaf = 0;
  function padLoop() {
    padRaf = 0;
    if (!topModal() && !(top() && top().def.layer === 'base')) { padPrev = []; return; }
    var pads = safe(function () { return navigator.getGamepads ? navigator.getGamepads() : []; }, []);
    var gp = null;
    for (var i = 0; pads && i < pads.length; i++) if (pads[i] && pads[i].connected) { gp = pads[i]; break; }
    if (gp) {
      var a = !!(gp.buttons[0] && gp.buttons[0].pressed);
      if (a && !padPrev[0]) {
        var ae = document.activeElement;
        var scope = navScope();
        if (ae && scope && scope.contains(ae) && typeof ae.click === 'function') ae.click();
        else onConfirm();
      }
      padPrev = [a];
    }
    padRaf = requestAnimationFrame(padLoop);
  }
  function ensurePadLoop() { if (!padRaf && typeof navigator !== 'undefined' && navigator.getGamepads) padRaf = requestAnimationFrame(padLoop); }

  // ---------------------------------------------------------------- insets / i18n
  function hudInsets() {
    var out = { top: 0, bottom: 0, left: 0, right: 0 };
    if (!root) return out;
    var H = root.clientHeight || window.innerHeight;
    root.querySelectorAll('[data-inset]').forEach(function (n) {
      if (n.closest('.is-hidden') || n.hidden) return;
      var r = n.getBoundingClientRect();
      if (!r.width || !r.height) return;
      var side = n.getAttribute('data-inset');
      if (side === 'top') out.top = Math.max(out.top, r.bottom);
      else if (side === 'bottom') out.bottom = Math.max(out.bottom, H - r.top);
      else if (side === 'left') out.left = Math.max(out.left, r.right);
      else if (side === 'right') out.right = Math.max(out.right, (root.clientWidth || window.innerWidth) - r.left);
    });
    out.top = Math.round(out.top); out.bottom = Math.round(out.bottom);
    out.left = Math.round(out.left); out.right = Math.round(out.right);
    return out;
  }
  function applyI18n(container) {
    var c = container || root;
    if (!c) return;
    c.querySelectorAll('[data-i18n]').forEach(function (n) { n.textContent = t(n.getAttribute('data-i18n')); });
    c.querySelectorAll('[data-i18n-aria]').forEach(function (n) { n.setAttribute('aria-label', t(n.getAttribute('data-i18n-aria'))); });
    c.querySelectorAll('[data-i18n-title]').forEach(function (n) { n.setAttribute('title', t(n.getAttribute('data-i18n-title'))); });
  }
  function rerenderAll() {
    stack.slice().forEach(function (inst) { inst.rerender(); });
    applyI18n(root);
  }

  // ---------------------------------------------------------------- root flags
  function syncFlags() {
    if (!root) return;
    var S = AQ.settings;
    root.classList.toggle('is-left', S.get('handedness') === 'left');
    root.classList.toggle('is-reduced', !!(AQ.fx && AQ.fx.motion && AQ.fx.motion() < 1));
    var touch = (AQ.input && AQ.input.mode === 'touch') || (AQ.display && AQ.display.isTouch && (!AQ.input || AQ.input.mode !== 'mouse' && AQ.input.mode !== 'keyboard'));
    root.classList.toggle('is-touch', !!touch);
    root.classList.toggle('is-portrait', !!(AQ.display && AQ.display.orientation === 'portrait'));
    root.classList.toggle('is-short', (root.clientHeight || window.innerHeight) < 480);
    root.setAttribute('data-input', (AQ.input && AQ.input.mode) || 'mouse');
  }

  // ================================================================ init
  function init(rootEl) {
    root = rootEl || document.getElementById('ui');
    clear(root);
    root.classList.add('aq-ui');
    ['base', 'hud', 'modal', 'top', 'toast'].forEach(function (k) {
      layers[k] = el('div.aq-layer.aq-layer-' + k);
      root.appendChild(layers[k]);
    });
    syncFlags();
    if (AQ.input && AQ.input.on) {
      AQ.input.on('action:back', onBack);
      AQ.input.on('action:pause', onPause);
      AQ.input.on('action:confirm', onConfirm);
      AQ.input.on('action:nav', function (p) {
        if (!navScope()) return;
        if (AQ.scenes && AQ.scenes.current === 'fishing' && !topModal()) return;
        navigate(p.dx, p.dy);
      });
    }
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('resize', function () { syncFlags(); });
    AQ.events.on('lang:changed', rerenderAll);
    AQ.events.on('settings:changed', function (p) {
      syncFlags();
      if (p.key === 'handedness' || p.key === 'uiScale' || p.key === 'reducedMotion') rerenderAll();
    });
    AQ.events.on('input:mode', function () { syncFlags(); });
    AQ.events.on('display:resize', function () { syncFlags(); });
    AQ.events.on('ui:open', ensurePadLoop);
    AQ.events.on('input:mode', function (p) { if (p.mode === 'gamepad') ensurePadLoop(); });
    // prevent page zoom gestures (iOS) on the overlay
    root.addEventListener('gesturestart', function (e) { e.preventDefault(); });
    root.addEventListener('dblclick', function (e) { e.preventDefault(); });
    initHooks.forEach(function (fn) { safe(fn); });
    ui.ready = true;
  }

  // ================================================================ exports
  ui.init = init;
  ui.onInit = function (fn) { if (ui.ready) safe(fn); else initHooks.push(fn); };
  ui.register = register;
  ui.show = show;
  ui.hide = hide;
  ui.isOpen = isOpen;
  ui.isModal = isModal;
  ui.hudInsets = hudInsets;
  ui.applyI18n = applyI18n;
  ui.rerenderAll = rerenderAll;
  ui.top = function () { var s = top(); return s ? s.name : null; };
  ui.openList = function () { return stack.map(function (s) { return s.name; }); };
  ui.layer = function (k) { return layers[k]; };
  ui.root = function () { return root; };
  ui.syncFlags = syncFlags;
  ui.navigate = navigate;
  ui.dom = {
    el: el, append: append, clear: clear, setText: setText, btn: btn, seg: seg, toggle: toggle, slider: slider,
    panel: panel, sprite: sprite, spriteOf: spriteOf, t: t, has: has, tFirst: tFirst, prettify: prettify, safe: safe,
    feedback: feedback, focusFirst: focusFirst, focusables: focusables, worldNow: worldNow
  };
  ui.names = names;
  ui.fmt = fmt;
})(window.AQ);
