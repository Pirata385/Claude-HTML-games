// Água-Tinta — goals & achievements (owner E): the Metas screen (active goals with progress, completed chain,
// achievement badges) and the "goals peek" panel that slides in when a goal is completed.
(function (AQ) {
  'use strict';

  var ui = AQ.ui = AQ.ui || {};
  var D = ui.dom, t = D.t, el = D.el, N = ui.names, F = ui.fmt;

  // Badge glyphs (drawn in UI, §9.3).
  var BADGE = {
    primeira_fisgada: ' J! ', linha_partida: '-x- ', paciencia: '(..)', coracao_mole: ' <3 ', comerciante: ' $$ ',
    tinta_densa: ' %@ ', colecionador: '[50]', enciclopedia: '[##]', gigante: '><XX>', noite_adentro: ' (* ',
    tempestade_perfeita: ' /!/', mao_leve: '~(o)~', tipografia: ' Aa ', ermitao: '[@]>', tres_coracoes: '<3<3',
    fazendeiro_do_mar: ' °o ', bilheteria_cheia: '[$$]', abissal: ' vvv', frenesi: 'v^v^', fim_da_tinta: ' ~@~'
  };

  function st() { return AQ.state; }
  function goalVars(g) {
    var p = (g && g.params) || {};
    var v = {};
    for (var k in p) v[k] = p[k];
    if (p.zone) v.zone = N.zone(p.zone);
    if (p.sp) v.sp = N.species(p.sp);
    if (p.phase) v.phase = N.phase(p.phase);
    if (p.weather) v.weather = N.weather(p.weather);
    if (p.rarity) v.rarity = N.rarity(p.rarity);
    if (p.id && g.type === 'sighting') v.id = N.sighting(p.id);
    if (p.pct !== undefined) v.pct = p.pct + '%';
    return v;
  }
  function goalText(g) { return N.goal(g, goalVars(g)); }
  function rewardText(r) {
    if (!r) return '';
    var parts = [];
    if (r.coins) parts.push(AQ.i18n.money(r.coins));
    if (r.pearls) parts.push(AQ.i18n.pearls(r.pearls));
    if (r.unlock) parts.push(D.tFirst(['ui.goals.unlock.' + r.unlock], null, D.prettify(r.unlock)));
    return F.list(parts);
  }
  function progressOf(g) { return D.safe(function () { return AQ.progress.goalProgress(g, st()); }, null) || { cur: 0, max: 1 }; }
  function bar(cur, max, w) {
    var n = max > 0 ? Math.round(Math.max(0, Math.min(1, cur / max)) * w) : 0;
    return '[' + new Array(n + 1).join('=') + new Array(w - n + 1).join('-') + ']';
  }
  function goalRow(g, done) {
    var r = el('div.aq-goal', { cls: done ? 'is-done' : '' });
    r.appendChild(el('span.aq-check', { text: done ? '[x]' : '[ ]', 'aria-hidden': 'true' }));
    var mid = el('div.aq-goal-mid');
    mid.appendChild(el('div.aq-goal-t', { text: goalText(g) }));
    var sub = t('ui.goals.reward', { list: rewardText(g.reward) });
    if (!done) {
      var pr = progressOf(g);
      var max = pr.max || 1;
      var cur = Math.min(pr.cur || 0, max);
      mid.appendChild(el('div.aq-goal-bar', null, [el('span.aq-bar', { text: bar(cur, max, 12), 'aria-hidden': 'true' }), el('span.aq-dim', { text: ' ' + t('ui.goals.progress', { cur: AQ.i18n.num(cur), max: AQ.i18n.num(max) }) })]));
    }
    mid.appendChild(el('div.aq-small.aq-dim', { text: sub }));
    r.appendChild(mid);
    return r;
  }

  ui.register('goals', {
    modal: true,
    cls: 'is-goals',
    build: function (inst) {
      var tab = inst.state.tab || inst.params.tab || 'goals';
      inst.state.tab = tab;
      var s = st();
      var chain = D.safe(function () { return AQ.goals.chain; }, []) || [];
      var doneMap = (s.progress && s.progress.goalsDone) || {};
      var achAll = D.safe(function () { return AQ.goals.achievements; }, []) || [];
      var achMap = (s.progress && s.progress.ach) || {};
      var achN = achAll.filter(function (a) { return achMap[a.id]; }).length;
      var doneN = chain.filter(function (g) { return doneMap[g.id]; }).length;
      var extra = el('span.aq-panel-wallet', { text: tab === 'goals' ? t('ui.goals.count', { n: doneN, total: chain.length || AQ.ENUM.GOALS.length }) : t('ui.goals.count', { n: achN, total: achAll.length || AQ.ENUM.ACHIEVEMENTS.length }) });
      var p = D.panel({ title: t('ui.goals.title'), extra: extra, onClose: function () { inst.close(null); }, cls: 'aq-goals' });
      var tabs = el('div.aq-tabs', { role: 'tablist' });
      [['goals', 'ui.goals.tabGoals'], ['ach', 'ui.goals.tabAch']].forEach(function (x) {
        var b = el('button.aq-tab', { type: 'button', role: 'tab', 'aria-selected': x[0] === tab ? 'true' : 'false', 'data-fid': 'tab:' + x[0] }, el('span', { text: t(x[1]) }));
        if (x[0] === tab) b.classList.add('is-on');
        b.addEventListener('click', function () { D.feedback('uiTap'); inst.state.tab = x[0]; inst.rerender(); });
        tabs.appendChild(b);
      });
      p.el.insertBefore(tabs, p.body);
      if (tab === 'goals') {
        var active = D.safe(function () { return AQ.progress.activeGoals(s); }, []) || [];
        p.body.appendChild(el('h3.aq-sec', { text: t('ui.goals.active') }));
        if (!active.length) p.body.appendChild(el('p.aq-p.aq-dim', { text: t('ui.goals.allDone') }));
        active.forEach(function (g) { if (g) p.body.appendChild(goalRow(g, false)); });
        var done = chain.filter(function (g) { return doneMap[g.id]; });
        if (done.length) {
          p.body.appendChild(el('h3.aq-sec', { text: t('ui.goals.done') }));
          done.slice().reverse().forEach(function (g) { p.body.appendChild(goalRow(g, true)); });
        }
      } else {
        var grid = el('div.aq-achs');
        var list = achAll.length ? achAll : AQ.ENUM.ACHIEVEMENTS.map(function (id) { return { id: id }; });
        list.forEach(function (a) {
          var got = !!achMap[a.id];
          var c = el('div.aq-ach', { cls: got ? 'is-got' : '' });
          c.appendChild(el('pre.aq-ach-g', { text: got ? (BADGE[a.id] || ' ** ') : ' ?? ', 'aria-hidden': 'true' }));
          c.appendChild(el('div.aq-ach-n', { text: got ? N.ach(a.id) : t('ui.goals.locked') }));
          var desc = N.achDesc(a.id);
          if (desc) c.appendChild(el('div.aq-small.aq-dim', { text: desc }));
          if (a.reward && a.reward.pearls) c.appendChild(el('div.aq-small.aq-dim', { text: AQ.i18n.pearls(a.reward.pearls) }));
          grid.appendChild(c);
        });
        p.body.appendChild(grid);
      }
      return p.el;
    }
  });

  // ---------------------------------------------------------------- goals chip (QA: was an auto-opening panel)
  // A small "[*] Goals 3/28" chip, shown for a few seconds after a goal completes (fishing only; deferred while a
  // bite or fight is on). It opens the Goals screen only when tapped. On the map / aquarium the nav's Goals button
  // already carries the count, so it just pulses there instead of covering the tank.
  var peek = null, peekTimer = 0, peekWait = 0;
  function busyFishing() {
    var ph = AQ.fishing && AQ.fishing.phase;
    return ph === 'nibble' || ph === 'bite' || ph === 'fight' || ph === 'landing' || ui.isModal();
  }
  function showPeek(justDone) {
    var L = ui.layer('hud');
    if (!L) return;
    var scene = AQ.scenes && AQ.scenes.current;
    if (scene === 'map' || scene === 'aquarium') {
      if (ui.hud && ui.hud.pulse) { ui.hud.pulse('nav:goals', true); setTimeout(function () { ui.hud.pulse('nav:goals', false); }, 4000); }
      return;
    }
    if (scene !== 'fishing') return;
    clearTimeout(peekWait);
    if (busyFishing()) { peekWait = setTimeout(function () { showPeek(justDone); }, 1000); return; }
    if (!peek) {
      peek = el('button.aq-peek', { type: 'button', 'aria-live': 'polite', 'data-fid': 'goalsChip' });
      peek.addEventListener('click', function () { D.feedback('uiTap'); peek.classList.remove('is-in'); ui.show('goals'); });
      L.appendChild(peek);
    }
    var chain = D.safe(function () { return AQ.goals.chain; }, []) || [];
    var doneMap = (st().progress && st().progress.goalsDone) || {};
    var doneN = chain.filter(function (g) { return doneMap[g.id]; }).length;
    D.clear(peek);
    peek.appendChild(el('span.aq-peek-g', { text: '[*] ', 'aria-hidden': 'true' }));
    peek.appendChild(el('span', { text: t('ui.goals.title') + ' ' + t('ui.goals.count', { n: doneN, total: chain.length || AQ.ENUM.GOALS.length }) }));
    if (justDone && justDone.length) peek.appendChild(el('span.aq-peek-new', { text: ' +' + justDone.length }));
    var ins = ui.hudInsets();
    peek.style.top = (ins.top + 8) + 'px';
    peek.classList.remove('is-in');
    void peek.offsetWidth;
    peek.classList.add('is-in');
    clearTimeout(peekTimer);
    peekTimer = setTimeout(function () { if (peek) peek.classList.remove('is-in'); }, 6000);
  }
  ui.goalsPeek = showPeek;
  ui.onInit(function () {
    AQ.events.on('scene:changed', function () { clearTimeout(peekWait); if (peek) peek.classList.remove('is-in'); });
  });

  var pendingDone = [], peekDebounce = 0;
  ui.onInit(function () {
    AQ.events.on('goal:done', function (p) {
      if (!p) return;
      var g = (D.safe(function () { return AQ.goals.chain; }, []) || []).filter(function (x) { return x.id === p.id; })[0] || { id: p.id };
      ui.toast({ key: 'ui.toast.goal', vars: { name: goalText(g) } }, { kind: 'good', ms: 3200 });
      if (AQ.audio) AQ.audio.sfx('goal');
      pendingDone.push(p.id);
      clearTimeout(peekDebounce);
      peekDebounce = setTimeout(function () {
        if (AQ.scenes.current === 'title' || AQ.scenes.current === 'ending') { pendingDone = []; return; }
        showPeek(pendingDone.slice(-2));
        pendingDone = [];
      }, 700);
      if (p.reward && p.reward.unlock === 'paperTheme') { /* the ending scene toasts it */ }
    });
    AQ.events.on('achievement:unlocked', function (p) {
      if (!p) return;
      ui.toast({ key: 'ui.toast.achievement', vars: { name: N.ach(p.id) } }, { kind: 'rare', ms: 3600 });
      if (AQ.audio) AQ.audio.sfx('rare');
    });
  });
})(window.AQ);
