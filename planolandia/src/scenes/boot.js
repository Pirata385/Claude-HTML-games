/* Planolândia — cena de inicialização: fonte, configurações, entrada; atalhos de depuração pela URL. */
(function (root) {
  'use strict';
  const PL = root.PL || (root.PL = {});

  // ?room=borda_arena&x=..&y=..&z=..&god=1&debug=1&abilities=all&slot=0
  function params() {
    const q = new URLSearchParams(root.location ? root.location.search : '');
    const o = {};
    for (const [k, v] of q) o[k] = v;
    return o;
  }

  class BootScene extends Phaser.Scene {
    constructor() { super('Boot'); }
    create() {
      PL.Font.build(this);
      const S = PL.Save.settings();
      if (!PL.Input._inited) { PL.Input.init(root); PL.Input._inited = true; }
      PL.Input.setPreset(S.preset);
      PL.Audio.setVolumes(S.music, S.sfx);
      const q = params();
      PL.params = q;
      if (q.room && PL.World.defs[q.room]) {
        const save = PL.Save.fresh();
        if (q.abilities === 'all') for (const k in save.abilities) save.abilities[k] = true;
        else if (q.abilities) for (const k of q.abilities.split(',')) save.abilities[k] = true;
        const def = PL.World.defs[q.room];
        const sp = def.spawn || { x: 60, y: def.size[1] - 80, z: def.size[2] / 2 };
        const spawn = { room: q.room, x: q.x ? +q.x : sp.x, y: q.y ? +q.y : sp.y, z: q.z ? +q.z : sp.z };
        this.scene.start('Game', { slot: q.slot !== undefined ? +q.slot : -1, save, spawn, debug: { god: q.god === '1', overlay: q.debug === '1' } });
        return;
      }
      this.scene.start('Title');
    }
  }

  PL.BootScene = BootScene;
})(typeof globalThis !== 'undefined' ? globalThis : this);
