/* Planolândia — cena da partida: cria o controlador PL.Game, lança o HUD e expõe ganchos de depuração. */
(function (root) {
  'use strict';
  const PL = root.PL || (root.PL = {});

  class GameScene extends Phaser.Scene {
    constructor() { super('Game'); }
    init(data) { this.data_ = data || {}; }
    create() {
      PL.Audio.init();
      PL.Input.gameMouse = true;
      PL.Input.clearAll();
      this.cameras.main.setBackgroundColor('#07040f');
      const G = this.G = new PL.Game(this, this.data_);
      this.scene.launch('Hud', { game: G });
      this.scale.on('resize', this.onResize, this);
      this.onVis = () => { if (document.hidden) { PL.Audio.suspend(); if (G.hud && G.hud.mode === 'play' && !G.dialogOpen) G.hud.openPause(); } else PL.Audio.resume(); };
      document.addEventListener('visibilitychange', this.onVis);
      this.events.once('shutdown', () => {
        this.scale.off('resize', this.onResize, this);
        document.removeEventListener('visibilitychange', this.onVis);
        PL.Input.gameMouse = false;
        G.destroy();
        this.scene.stop('Hud');
      });
      // primeira chegada: faixa da região e dica
      this.time.delayedCall(60, () => { if (G.hud) G.hud.banner(PL.REGIONS[G.room.def.region].nome, G.room.def.name); });
      this.installDebug(G);
    }
    onResize() { this.G.resize(); }
    update(time, delta) {
      const dt = Math.min(delta / 1000, 1 / 30);
      PL.Input.update();
      this.G.step(dt);
      this.G.render(dt);
    }
    installDebug(G) {
      const scene = this;
      PL.debug = {
        get game() { return scene.G; },
        state() {
          const g = scene.G, P = g.player;
          return {
            room: g.room.id, x: P.x, y: P.y, z: P.z, grounded: P.b.grounded, dead: P.dead,
            lados: g.save.lados, geo: g.save.geo, vert: g.save.vert, abilities: Object.assign({}, g.save.abilities),
            enemies: g.ents.filter((e) => e.enemy && e.alive).length, visibleEnemies: g.ents.filter((e) => e.enemy && e.visible).length,
            boss: g.boss ? { hp: g.boss.hp, state: g.boss.state, phase: g.boss.phase } : null,
            fps: Math.round(scene.game.loop.actualFps), sliceKey: g.slices.key, busy: g.busy, mode: g.hud ? g.hud.mode : null, dialog: !!g.dialogOpen,
          };
        },
        teleport(room, x, y, z) { scene.G.loadRoom(room, { x, y, z }); scene.G.snapCamera(); },
        setPos(x, y, z) { const b = scene.G.player.b; if (x !== undefined) b.x = x; if (y !== undefined) b.y = y; if (z !== undefined) b.z = z; },
        give(ab) { scene.G.save.abilities[ab] = true; },
        god(on) { scene.G.god = on !== false; },
        closeDialog() { const h = scene.G.hud; while (h && h.dlg) { h.dlg.shown = 1e9; h.advanceDialog(); } },
      };
    }
  }

  PL.GameScene = GameScene;
})(typeof globalThis !== 'undefined' ? globalThis : this);
