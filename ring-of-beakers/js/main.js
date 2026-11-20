// main.js — the canvas, the frame loop and the scene switcher. Loaded last.
// The UI is drawn in "points": the canvas is scaled so the short side of the screen is about
// 400 points on a phone and at most 1.8 px per point on a desktop.
(function () {
  'use strict';
  const RB = globalThis.RB;
  const ui = RB.ui, input = RB.input;
  const canvas = document.getElementById('game'), ctx = canvas.getContext('2d');
  const view = { w: 800, h: 450, s: 1, dpr: 1, portrait: false };
  const game = (RB.game = { S: null, world: null, slot: 0, scene: null, name: '', pending: null, fade: 1, view, settings: RB.save.settings(), t: 0, canvas });
  RB.scenes = RB.scenes || {};

  function resize() {
    const cw = window.innerWidth, ch = window.innerHeight, dpr = Math.min(2, window.devicePixelRatio || 1);
    const pw = Math.round(cw * dpr), ph = Math.round(ch * dpr);
    if (canvas.width !== pw || canvas.height !== ph) { canvas.width = pw; canvas.height = ph; }
    view.s = RB.core.clamp(Math.min(cw, ch) / 400, 0.8, 1.8);
    view.w = cw / view.s; view.h = ch / view.s; view.dpr = dpr; view.portrait = ch > cw;
  }
  game.go = function (name, args) { game.pending = { name, args: args || {} }; };
  // opts: { sandbox } (see state.create)
  game.newGame = function (slot, seed, opts) {
    game.slot = slot; game.S = RB.state.create(seed === undefined ? (Date.now() ^ (Math.random() * 1e9)) >>> 0 : seed, opts);
    game.world = RB.world.generate(game.S.seed); game.save();
  };
  game.load = function (slot) {
    const S = RB.save.load(slot);
    if (!S) return false;
    game.slot = slot; game.S = S; game.world = RB.world.generate(S.seed);
    return true;
  };
  // Save to the slot. If the browser will not keep it (its storage full, or blocked), say so once,
  // rather than carry on as if it had worked.
  game.save = function () {
    if (!game.S || game.slot < 0) return true;
    const ok = RB.save.save(game.slot, game.S);
    if (!ok && !game.saveFailed && RB.ui && RB.ui.toast) RB.ui.toast('Could not save: the browser will not store any more. Free space by deleting an old save slot.', RB.pal.coral);
    game.saveFailed = !ok;
    return ok;
  };
  game.applySettings = function () { RB.audio.setVolumes(game.settings.sfx, game.settings.music); RB.save.setSettings(game.settings); };
  game.fullscreen = function () {
    const d = document, el = d.documentElement;
    if (d.fullscreenElement || d.webkitFullscreenElement) (d.exitFullscreen || d.webkitExitFullscreen).call(d);
    else if (el.requestFullscreen || el.webkitRequestFullscreen) { const p = (el.requestFullscreen || el.webkitRequestFullscreen).call(el); if (p && p.catch) p.catch(() => {}); }
  };

  let last = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, Math.max(0.001, (now - last) / 1000 || 0.016));
    last = now;
    resize();
    game.t += dt;
    if (game.pending) {
      game.fade = Math.min(1, game.fade + dt * 6);
      if (game.fade >= 1) {
        const p = game.pending; game.pending = null;
        if (game.scene && game.scene.exit) game.scene.exit();
        ui.closeAll();
        game.scene = RB.scenes[p.name]; game.name = p.name;
        game.scene.enter(p.args);
      }
    } else game.fade = Math.max(0, game.fade - dt * 5);
    ctx.setTransform(view.dpr * view.s, 0, 0, view.dpr * view.s, 0, 0);
    ui.begin(ctx, view, dt);
    if (game.scene) {
      if (!ui.modals.length && !game.pending) game.scene.update(dt);
      game.scene.draw(ctx, dt);
    }
    ui.drawModals(dt);
    ui.drawToasts(dt);
    if (game.fade > 0) { ctx.fillStyle = 'rgba(35,49,74,' + game.fade + ')'; ctx.fillRect(0, 0, view.w, view.h); }
    input.endFrame();
  }

  resize();
  input.attach(canvas, view);
  input.onFirst = () => { RB.audio.unlock(); };
  game.applySettings();
  window.addEventListener('pagehide', () => game.save());
  document.addEventListener('visibilitychange', () => { if (document.hidden) game.save(); });
  // ?scene=coop&seed=7 jumps straight into a throwaway game (used by the automated checks)
  const q = new URLSearchParams(location.search);
  if (q.get('scene')) { game.slot = -1; game.S = RB.state.create(+(q.get('seed') || 7)); game.world = RB.world.generate(game.S.seed); game.go(q.get('scene')); }
  else game.go('title');
  requestAnimationFrame(frame);
})();
