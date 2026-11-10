/* Filogênese — inicialização e laço principal. */
(function (FG) {
  'use strict';
  const U = FG.U, G = FG.Game, UI = FG.UI, R = FG.Render, I = FG.Input, S = FG.Settings, A = FG.Audio;
  const T = (k, a, b) => FG.T(k, a, b);
  let last = 0, pausedFrames = 0;
  const env = { x: 0, y: 0, night: 0, rain: 0, shore: 0, biome: 0, mood: 'day' };

  const Main = FG.Main = {
    state: 'menu',

    boot() {
      S.load();
      FG.setLang(S.data.lang);
      G.loadAchievements();
      const canvas = document.getElementById('game');
      I.init(canvas); R.init(canvas); UI.init();
      I.onUi = (k) => UI.key(k);
      FG.Sprites.build(1);
      R.menuInit((Math.random() * 1e6) | 0);
      const q = new URLSearchParams(location.search);
      if (q.get('quick')) {   // atalho de desenvolvimento: ?quick=H|C|O&seed=123
        const seed = +(q.get('seed') || 7), diet = q.get('quick');
        G.start({ seed, name: 'Testus', genome: FG.Parts.starterGenome('HCO'.includes(diet) ? diet : 'O', seed + 3), diff: 'normal', slot: 9 });   // espaço fora dos três do menu
        Main.state = 'play'; UI.sync();
      } else UI.open('menu');
      window.addEventListener('resize', () => R.resize());
      window.addEventListener('orientationchange', () => setTimeout(() => R.resize(), 200));
      const unlock = () => { A.init(); };
      for (const ev of ['pointerdown', 'keydown', 'touchend']) window.addEventListener(ev, unlock, { passive: true });
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
          if (G.active && Main.state === 'play') { G.save(); if (!UI.blocking() && !G.cine) UI.open('pause'); }
          A.suspend();
        } else { A.resume(); last = performance.now(); }
      });
      window.addEventListener('pagehide', () => { if (G.active && Main.state === 'play') G.save(); });
      // evita rolagem/zoom do navegador durante o jogo
      document.addEventListener('gesturestart', (e) => e.preventDefault());
      document.addEventListener('dblclick', (e) => { if (e.target.tagName !== 'INPUT') e.preventDefault(); });
      last = performance.now();
      requestAnimationFrame(loop);
    },

    startNew(o) {
      UI.fade(() => {
        UI.closeAll();
        G.start(o);
        Main.state = 'play'; UI.sync();
        G.save();
        UI.banner(FG.spName(G.playerSp), T('t.intro'));
        setTimeout(() => UI.toast(T(I.touch ? 't.howTouch' : 't.howKeys'), 'info', 'info'), 2600);
      }, 300, T('t.generating'));
    },
    loadSlot(i) {
      UI.fade(() => {
        UI.closeAll();
        if (G.load(i)) { Main.state = 'play'; UI.sync(); UI.toast(T('t.loaded'), 'good', 'check'); }
        else { Main.state = 'menu'; UI.open('menu'); UI.toast(T('t.loadFail'), 'bad', 'alert'); }
      }, 300, T('t.generating'));
    },
    toMenu() {
      if (G.active) G.save();
      UI.fade(() => {
        UI.closeAll();
        G.active = false; Main.state = 'menu';
        R.menuInit((Math.random() * 1e6) | 0);
        UI.open('menu');
      });
    },
    fullscreen() {
      const d = document, e = d.documentElement;
      try {
        if (d.fullscreenElement || d.webkitFullscreenElement) (d.exitFullscreen || d.webkitExitFullscreen).call(d);
        else (e.requestFullscreen || e.webkitRequestFullscreen).call(e);
      } catch (err) { /* tela cheia indisponível */ }
    },
  };

  function loop(now) {
    requestAnimationFrame(loop);
    const dt = Math.min(0.05, Math.max(0.001, (now - last) / 1000));
    last = now;
    if (G.active && Main.state === 'play') {
      const paused = UI.blocking();
      if (!paused) {
        pausedFrames = 0;
        I.update(); G.control(I, dt); G.update(dt);
        R.frame(dt); UI.hud(dt);
        const P = G.player;
        env.x = P.x; env.y = P.y; env.night = G.night; env.rain = FG.Settings.data.weather ? G.rain : 0; env.biome = P.biome;
        env.shore = U.sstep(0.44, 0.33, G.world.hAt(P.x, P.y));
        env.mood = !P.dead && G.time - P.combatT < 5 ? 'combat' : G.enc ? 'social' : G.night > 0.5 ? 'night' : 'day';
        A.update(dt, env);
      } else if (!UI.isOpen('editor') && (pausedFrames++ < 2 || pausedFrames % 20 === 0)) R.frame(0);
    } else {
      R.menuFrame(dt);
      env.x = env.y = 0; env.night = 0; env.rain = 0; env.shore = 0.2; env.biome = FG.B.GRASS; env.mood = 'day';
      A.update(dt, env);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', Main.boot); else Main.boot();
})(window.FG = window.FG || {});
