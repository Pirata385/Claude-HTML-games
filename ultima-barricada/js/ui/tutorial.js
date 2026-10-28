// First-run tutorial: a short, skippable sequence of cards. Some steps wait for the player to do
// the thing (select, gather, open the build menu, place a tower); the day clock is held while it
// runs (the 'tutorial' command) so nobody loses daylight reading.
(function (UB) {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const tr = (k, p) => UB.I18N.t(k, p);
  const touch = () => UB.App.touch;

  // key: text (or a function choosing by input type); done: condition that advances the step;
  // glow: element to highlight.
  const STEPS = [
    { id: 'welcome', key: 'tut.welcome' },
    { id: 'camera', key: () => (touch() ? 'tut.cameraTouch' : 'tut.cameraMouse'), glow: '#miniWrap' },
    { id: 'select', key: () => (touch() ? 'tut.selectTouch' : 'tut.selectMouse'), glow: '[data-sq="all"]', done: (S, A) => A.sel.units.length > 0 },
    { id: 'gather', key: () => (touch() ? 'tut.gatherTouch' : 'tut.gatherMouse'), done: (S) => S.units.some((u) => u.order && u.order.type === 'gather') },
    { id: 'build', key: 'tut.build', glow: '[data-act="openBuild"]', done: () => !$('buildMenu').hidden },
    { id: 'tower', key: 'tut.tower', glow: '[data-build="tower"], [data-tab="defense"]', done: (S) => S.buildings.some((b) => b.type === 'tower') },
    { id: 'loot', key: 'tut.loot' },
    { id: 'night', key: 'tut.night', glow: '#clock' },
    { id: 'end', key: 'tut.end' },
  ];

  const T = { active: false, step: 0, STEPS };

  function cmd(on) { if (UB.App.S) UB.Game.command(UB.App.S, { type: 'tutorial', on }); }

  T.start = function () {
    T.active = true;
    T.step = 0;
    cmd(true);
    $('hud').classList.add('tut-on');
    render();
  };
  // finished: the player completed or skipped it (it will not show again).
  T.stop = function (finished) {
    if (!T.active) return;
    T.active = false;
    cmd(false);
    $('tutorial').hidden = true;
    $('hud').classList.remove('tut-on');
    glow(null);
    const S = UB.App.S;
    // The beginner tips that the tutorial already covered stay quiet.
    if (S) { S.tips = S.tips || {}; for (const id of ['select', 'tower', 'loot', 'dusk']) S.tips[id] = true; }
    if (finished) UB.Menus.setSetting('tutorialDone', true);
  };
  T.next = function () {
    if (T.step >= STEPS.length - 1) { T.stop(true); return; }
    T.step++;
    UB.Audio.play('click');
    render();
  };

  function glow(sel) {
    for (const el of document.querySelectorAll('.tut-glow')) el.classList.remove('tut-glow');
    if (sel) for (const el of document.querySelectorAll(sel)) el.classList.add('tut-glow');
  }

  function render() {
    const s = STEPS[T.step];
    const box = $('tutorial');
    box.hidden = false;
    const key = typeof s.key === 'function' ? s.key() : s.key;
    const last = T.step === STEPS.length - 1;
    box.innerHTML = `<div class="tut-head"><b>${tr('tut.title')}</b><span class="muted small">${tr('tut.step', { n: T.step + 1, m: STEPS.length })}</span></div>
      <p>${tr(key)}</p>
      ${s.done ? `<p class="tut-wait small">${tr('tut.waiting')}</p>` : ''}
      ${T.step === 0 ? `<p class="muted small">${tr('tut.paused')}</p>` : ''}
      <div class="row end">
        ${last ? '' : `<button class="btn ghost" data-tut="skip">${tr('tut.skip')}</button>`}
        ${s.done ? '' : `<button class="btn good" data-tut="next">${tr(last ? 'tut.done' : 'tut.next')}</button>`}
      </div>`;
    glow(s.glow);
  }

  // Called a few times per second from the game loop.
  T.update = function (S) {
    if (!T.active) return;
    if (S.over) { T.stop(false); return; }
    const s = STEPS[T.step];
    if (s.done && s.done(S, UB.App)) { T.next(); return; }
    // Panels are redrawn often; keep the highlight on the current element.
    if (s.glow && !document.querySelector('.tut-glow')) glow(s.glow);
  };
  T.refresh = function () { if (T.active) render(); };

  T.init = function () {
    $('tutorial').addEventListener('click', (e) => {
      const b = e.target.closest('[data-tut]');
      if (!b) return;
      if (b.dataset.tut === 'skip') { UB.Audio.play('click'); T.stop(true); } else T.next();
    });
  };

  UB.Tutorial = T;
})(globalThis.UB = globalThis.UB || {});
