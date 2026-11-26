// Água-Tinta — modals (owner E): toast, confirm, note (story notes and bottle messages), hint layer.
(function (AQ) {
  'use strict';

  var ui = AQ.ui = AQ.ui || {};
  var D = ui.dom, t = D.t, el = D.el;

  // ================================================================ toasts
  var toastBox = null, toasts = [];
  var MAX_TOASTS = 2;
  function toastLayer() {
    if (!toastBox) {
      var L = ui.layer('toast');
      if (!L) return null;
      toastBox = el('div.aq-toasts', { role: 'status', 'aria-live': 'polite' });
      L.appendChild(toastBox);
    }
    return toastBox;
  }
  // toast(msg:string|{key,vars}, opts?{kind:'info'|'good'|'warn'|'rare', ms=2600, now})
  // QA: toasts are queued and shown one at a time (stacks of 3 covered the scene); while a nibble, bite or fight is
  // on they wait until it ends. opts.now shows at once (fight tips, line warnings).
  var queue = [], pumpTimer = 0;
  function busy() {
    var ph = AQ.fishing && AQ.fishing.phase;
    if (ui.top && ui.top() === 'catchCard') return true; // never cover the card's choices
    return AQ.scenes && AQ.scenes.current === 'fishing' && (ph === 'nibble' || ph === 'bite' || ph === 'fight');
  }
  function live() { return toasts.filter(function (x) { return !x.gone; }); }
  function toast(msg, opts) {
    var o = opts || {};
    var text = typeof msg === 'string' ? msg : (msg && msg.key ? t(msg.key, msg.vars) : '');
    if (!text) return;
    // de-dupe identical toasts that are still visible or waiting
    for (var i = 0; i < toasts.length; i++) {
      if (toasts[i].text === text && !toasts[i].gone) { restart(toasts[i], o.ms); return; }
    }
    for (var j = 0; j < queue.length; j++) if (queue[j].text === text) return;
    if (o.now) { showToast(text, o); return; }
    queue.push({ text: text, o: o });
    // keep the backlog short: drop the oldest plain info toast
    if (queue.length > 6) {
      for (var k = 0; k < queue.length; k++) if ((queue[k].o.kind || 'info') === 'info') { queue.splice(k, 1); break; }
      if (queue.length > 6) queue.shift();
    }
    pump();
  }
  function pump() {
    clearTimeout(pumpTimer);
    pumpTimer = 0;
    if (!queue.length) return;
    if (busy() || toasts.length >= 1) { pumpTimer = setTimeout(pump, 300); return; } // wait for the fade-out too
    var q = queue.shift(), o = {};
    for (var k in q.o) o[k] = q.o[k];
    var ms = o.ms || 2600;
    if (queue.length >= 2) ms = Math.min(ms, 1800);
    o.ms = ms;
    showToast(q.text, o);
  }
  function showToast(text, o) {
    var box = toastLayer();
    if (!box) return;
    var kind = o.kind || 'info';
    var glyph = { good: '+', warn: '!', rare: '*', info: '·' }[kind] || '·';
    var node = el('div.aq-toast.is-' + kind, null, [el('span.aq-toast-g', { text: glyph, 'aria-hidden': 'true' }), el('span.aq-toast-t', { text: text })]);
    var item = { node: node, text: text, timer: 0, gone: false };
    node.addEventListener('pointerdown', function () { dismiss(item); });
    box.appendChild(node);
    toasts.push(item);
    while (live().length > MAX_TOASTS) dismiss(live()[0]);
    requestAnimationFrame(function () { node.classList.add('is-in'); });
    restart(item, o.ms);
    positionToasts();
  }
  function restart(item, ms) {
    clearTimeout(item.timer);
    item.timer = setTimeout(function () { dismiss(item); }, ms || 2600);
  }
  function dismiss(item) {
    if (!item || item.gone) return;
    item.gone = true;
    clearTimeout(item.timer);
    item.node.classList.remove('is-in');
    item.node.classList.add('is-out');
    setTimeout(function () {
      if (item.node.parentNode) item.node.parentNode.removeChild(item.node);
      toasts.splice(toasts.indexOf(item), 1);
      if (queue.length && !pumpTimer) pump();
    }, 260);
  }
  function positionToasts() {
    if (!toastBox) return;
    var ins = ui.hudInsets(), top = Math.max(0, ins.top);
    // QA: while fishing, keep toasts off the boat and angler: just below the waterline when it is on screen
    if (AQ.scenes && AQ.scenes.current === 'fishing' && AQ.fishing && AQ.fishing.anchor) {
      var p = D.safe(function () { return AQ.fishing.anchor('surface'); }, null);
      var stage = document.getElementById('stage');
      var sr = stage ? stage.getBoundingClientRect() : { top: 0 };
      if (p && p.y + sr.top > top && p.y + sr.top < window.innerHeight * 0.5) top = Math.round(p.y + sr.top + 4);
    }
    toastBox.style.top = top + 'px';
  }

  // ================================================================ confirm
  // confirm({titleKey, bodyKey, vars, okKey, cancelKey, danger, delayMs, title, body}) → Promise<bool>
  ui.register('confirm', {
    modal: true,
    layer: 'top',
    cls: 'is-confirm',
    build: function (inst) {
      var o = inst.params;
      var p = D.panel({ title: o.title || (o.titleKey ? t(o.titleKey, o.vars) : ''), onClose: function () { inst.close(false); }, cls: o.danger ? 'is-danger aq-narrow' : 'aq-narrow' });
      if (o.body || o.bodyKey) p.body.appendChild(el('p.aq-p', { text: o.body || t(o.bodyKey, o.vars) }));
      var okLabel = o.okKey ? t(o.okKey, o.vars) : t('common.ok');
      var ok = D.btn(okLabel, function () { inst.close(true); }, { cls: o.danger ? 'is-danger' : '', fid: 'ok', def: !o.delayMs && !o.danger });
      var cancel = D.btn(o.cancelKey ? t(o.cancelKey) : t('common.cancel'), function () { inst.close(false); }, { fid: 'cancel', def: !!(o.danger || o.delayMs), sfx: 'uiBack' });
      if (o.delayMs && !inst.state.armed) {
        ok.disabled = true;
        ok.setAttribute('aria-disabled', 'true');
        var left = Math.ceil(o.delayMs / 500) / 2;
        var lab = ok.querySelector('.aq-btn-l');
        var started = inst.state.started || (inst.state.started = performance.now());
        var tick = function () {
          if (!ok.isConnected) return;
          var remain = Math.max(0, o.delayMs - (performance.now() - started));
          if (remain <= 0) {
            inst.state.armed = true;
            ok.disabled = false;
            ok.removeAttribute('aria-disabled');
            lab.textContent = okLabel;
            return;
          }
          lab.textContent = t('ui.confirm.wait', { n: AQ.i18n.num(Math.ceil(remain / 100) / 10, 1) });
          setTimeout(tick, 100);
        };
        void left;
        tick();
      }
      p.foot.appendChild(cancel);
      p.foot.appendChild(ok);
      return p.el;
    }
  });
  ui.confirm = function (opts) {
    return ui.show('confirm', opts || {}).then(function (r) { return r === true; });
  };

  // ================================================================ note (story notes and bottle messages)
  // note(id) → Promise<void>. id = a §9.5 note id, or 'msg:<m#>' for a bottle message.
  // Story notes auto-dismiss after max(4.5 s, reading time); messages wait for a tap.
  var noteQueue = Promise.resolve();
  ui.register('note', {
    modal: true,
    layer: 'top',
    cls: 'is-note',
    backdropClose: true,
    build: function (inst) {
      var id = String(inst.params.id || '');
      var isMsg = id.indexOf('msg:') === 0;
      var mid = isMsg ? id.slice(4) : '';
      var card = el('div.aq-note', { role: 'dialog', 'aria-modal': 'true' });
      var head = isMsg ? t('ui.note.message') : t('ui.note.story');
      card.appendChild(el('div.aq-note-head', null, [el('span', { text: '~ ' + head + ' ~' })]));
      if (isMsg) card.appendChild(el('h2.aq-note-title', { text: ui.names.msgTitle(mid) }));
      var body = isMsg ? ui.names.msgBody(mid) : t('note.' + id);
      card.appendChild(el('p.aq-note-body', { text: body }));
      if (!isMsg) {
        var sign = (id === 'ending') ? t('note.sign.i') : (id === 'firstCatch' ? '' : t('note.sign.iara'));
        if (sign) card.appendChild(el('p.aq-note-sign', { text: sign }));
      }
      var ok = el('button.aq-note-tap', { type: 'button', 'data-default': '1', 'data-fid': 'ok' }, el('span', { text: t('ui.note.tap') }));
      ok.addEventListener('click', function () { D.feedback('uiTap'); inst.close(true); });
      card.appendChild(ok);
      card.addEventListener('click', function (e) { if (e.target === card || e.target.tagName === 'P') inst.close(true); });
      return card;
    },
    onOpen: function (inst) {
      var id = String(inst.params.id || '');
      if (id.indexOf('msg:') === 0 || inst.params.sticky) return;
      var text = t('note.' + id);
      var ms = Math.max(4500, Math.min(11000, text.length * 70));
      if (inst.params.ms) ms = inst.params.ms;
      inst.state.timer = setTimeout(function () { inst.close(true); }, ms);
    },
    onClose: function (inst) { clearTimeout(inst.state.timer); }
  });
  ui.note = function (id, opts) {
    var o = opts || {};
    var p = noteQueue.then(function () {
      var tut = AQ.state && AQ.state.tutorial;
      if (tut && id && String(id).indexOf('msg:') !== 0) {
        if (!tut.notes) tut.notes = {};
        tut.notes[id] = 1;
        if (AQ.store) AQ.store.markDirty();
      }
      return ui.show('note', { id: id, ms: o.ms, sticky: o.sticky });
    }).then(function () { return undefined; });
    noteQueue = p.catch(function () { /* keep the queue alive */ });
    return p;
  };
  ui.noteSeen = function (id) {
    var tut = AQ.state && AQ.state.tutorial;
    return !!(tut && tut.notes && tut.notes[id]);
  };

  // ================================================================ hints
  // hint(id, {key, vars, anchor:'reel'|'center'|'bottom'|{x,y}|<anchor name>, big, ms}); clearHint(id)
  // key.<inputMode> (touch|mouse|keyboard|gamepad) is preferred when it exists.
  var hints = Object.create(null);
  var hintBox = null, hintTimer = 0;
  function hintLayer() {
    if (!hintBox) {
      var L = ui.layer('hud');
      if (!L) return null;
      hintBox = el('div.aq-hints', { 'aria-live': 'polite' });
      L.appendChild(hintBox);
    }
    return hintBox;
  }
  function hintText(h) {
    var mode = (AQ.input && AQ.input.mode) || 'mouse';
    var k = h.key;
    if (D.has(k + '.' + mode)) return t(k + '.' + mode, h.vars);
    if (mode === 'gamepad' && D.has(k + '.keyboard')) return t(k + '.keyboard', h.vars);
    if (D.has(k)) return t(k, h.vars);
    if (D.has(k + '.mouse')) return t(k + '.mouse', h.vars);
    return t(k, h.vars);
  }
  function anchorPoint(a) {
    var W = window.innerWidth, H = window.innerHeight;
    var ins = ui.hudInsets();
    if (a && typeof a === 'object' && typeof a.x === 'number') return { x: a.x, y: a.y, below: !!a.below };
    if (a === 'center' || !a) return { x: W / 2, y: H * 0.42 };
    if (a === 'bottom') return { x: W / 2, y: H - ins.bottom - 12 };
    if (a === 'top') return { x: W / 2, y: ins.top + 12, below: true };
    var dom = ui.root() && ui.root().querySelector('[data-anchor="' + a + '"]');
    if (dom && !dom.closest('.is-hidden')) {
      var r = dom.getBoundingClientRect();
      if (r.width && r.height) {
        if (r.top < H * 0.3) return { x: r.left + r.width / 2, y: r.bottom + 6, below: true };
        return { x: r.left + r.width / 2, y: r.top - 6 };
      }
    }
    if (AQ.fishing && AQ.fishing.anchor) {
      var p = D.safe(function () { return AQ.fishing.anchor(a === 'reel' ? 'reel' : a); }, null);
      if (p && typeof p.x === 'number') {
        var stage = document.getElementById('stage');
        var sr = stage ? stage.getBoundingClientRect() : { left: 0, top: 0 };
        var py = p.y + sr.top;
        // QA: scene anchors in the top 45 % put the bubble below the point (it covered the boat on short screens)
        if (py < H * 0.45) return { x: p.x + sr.left, y: Math.max(py + 18, ins.top + 10), below: true };
        return { x: p.x + sr.left, y: py - 10 };
      }
    }
    return { x: W / 2, y: H * 0.42 };
  }
  function placeHint(h) {
    var p = anchorPoint(h.anchor);
    var n = h.node;
    var W = window.innerWidth, H = window.innerHeight;
    var w = n.offsetWidth, hh = n.offsetHeight;
    var x = Math.max(8, Math.min(W - w - 8, p.x - w / 2));
    var y = p.below ? p.y : p.y - hh;
    y = Math.max(8, Math.min(H - hh - 8, y));
    n.style.transform = 'translate(' + Math.round(x) + 'px,' + Math.round(y) + 'px)';
    n.classList.toggle('is-below', !!p.below);
    var caret = n.querySelector('.aq-hint-caret');
    if (caret) caret.style.left = Math.round(Math.max(10, Math.min(w - 10, p.x - x))) + 'px';
  }
  function hintsOn() { return AQ.settings.get('hints') !== false; }
  function hint(id, opts) {
    var o = opts || {};
    if (!id) return;
    if (!hintsOn() && !o.force) return;
    var box = hintLayer();
    if (!box) return;
    var h = hints[id];
    if (!h) {
      h = hints[id] = { id: id, node: el('div.aq-hint', { 'data-hint': id }), key: '', vars: null, anchor: null };
      h.text = el('span.aq-hint-t');
      h.node.appendChild(h.text);
      h.node.appendChild(el('span.aq-hint-caret', { text: 'v', 'aria-hidden': 'true' }));
      box.appendChild(h.node);
      requestAnimationFrame(function () { h.node.classList.add('is-in'); });
    }
    h.key = o.key || id;
    h.vars = o.vars || null;
    h.anchor = o.anchor || 'center';
    h.node.classList.toggle('is-big', !!o.big);
    h.node.classList.toggle('no-caret', o.anchor === 'center' || !o.anchor);
    D.setText(h.text, hintText(h));
    clearTimeout(h.timer);
    if (o.ms) h.timer = setTimeout(function () { clearHint(id); }, o.ms);
    placeHint(h);
    if (!hintTimer) hintTimer = setInterval(tickHints, 100);
  }
  function clearHint(id) {
    var h = hints[id];
    if (!h) return;
    delete hints[id];
    clearTimeout(h.timer);
    h.node.classList.remove('is-in');
    h.node.classList.add('is-out');
    setTimeout(function () { if (h.node.parentNode) h.node.parentNode.removeChild(h.node); }, 220);
  }
  function clearAllHints() { Object.keys(hints).forEach(clearHint); }
  function tickHints() {
    var any = false;
    for (var id in hints) { any = true; placeHint(hints[id]); }
    if (!any) { clearInterval(hintTimer); hintTimer = 0; }
  }
  function refreshHintTexts() { for (var id in hints) D.setText(hints[id].text, hintText(hints[id])); }

  ui.toast = toast;
  ui.hint = hint;
  ui.clearHint = clearHint;
  ui.clearAllHints = clearAllHints;
  ui.hasHint = function (id) { return !!hints[id]; };

  ui.onInit(function () {
    AQ.events.on('lang:changed', refreshHintTexts);
    AQ.events.on('input:mode', refreshHintTexts);
    AQ.events.on('display:resize', positionToasts);
    AQ.events.on('scene:changed', function () { setTimeout(positionToasts, 50); });
    AQ.events.on('settings:changed', function (p) { if (p.key === 'hints' && !p.value) clearAllHints(); });
  });
})(window.AQ);
