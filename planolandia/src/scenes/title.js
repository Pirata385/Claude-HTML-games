/* Planolândia — tela de título: um cubo girando, visto como uma fatia que se transforma; menus e espaços de salvamento. */
(function (root) {
  'use strict';
  const PL = root.PL || (root.PL = {});
  const G3 = PL.G3, M = PL.M;

  class TitleScene extends Phaser.Scene {
    constructor() { super('Title'); }

    create() {
      const W = this.scale.width, H = this.scale.height;
      this.t = 0;
      this.bg = new PL.Background(this);
      this.bg.setRegion('borda', W, H);
      this.cam = this.cameras.main;
      this.g = this.add.graphics().setDepth(10);
      this.cube = G3.cuboid(0, 0, 0, 96, 96, 96);
      this.base = G3.cuboidVerts(96, 96, 96);
      this.s = G3.newShape();
      this.titleT = this.add.bitmapText(0, 0, 'pxo', 'PLANOLÂNDIA').setScale(3).setDepth(20).setTint(0xf6d55c);
      this.subT = this.add.bitmapText(0, 0, 'pxo', 'F O R A   D O   P L A N O').setDepth(20).setTint(0xc4b5ea);
      this.pressT = this.add.bitmapText(0, 0, 'pxo', '').setDepth(20).setTint(0xf3e7cf);
      this.verT = this.add.bitmapText(0, 0, 'pxo', 'Marco 1 · v' + PL.VERSION).setDepth(20).setTint(0x6a5aa8);
      this.menu = null;
      this.state = 'press';
      this.delMode = false;
      PL.Input.gameMouse = false;
      this.input.on('pointerdown', () => { if (this.state === 'press') this.begin(); });
      this.layout();
      this.scale.on('resize', this.onResize, this);
      this.events.once('shutdown', () => { this.scale.off('resize', this.onResize, this); if (this.menu) this.menu.destroy(); this.bg.destroy(); });
      PL.Audio.music('title');
    }
    onResize() { this.bg.resize(this.scale.width, this.scale.height); this.layout(); if (this.menu) this.reopen(); }
    layout() {
      const W = this.scale.width, H = this.scale.height;
      this.titleT.setPosition(Math.round(W / 2 - this.titleT.width / 2), 22);
      this.subT.setPosition(Math.round(W / 2 - this.subT.width / 2), 60);
      this.verT.setPosition(W - this.verT.width - 6, H - 14);
    }

    begin() {
      PL.Audio.init();
      PL.Audio.music('title');
      PL.Audio.sfx('ok');
      this.state = 'main';
      this.pressT.setText('');
      this.openMain();
    }
    reopen() { const st = this.state; if (st === 'main') this.openMain(); else if (st === 'slots') this.openSlots(); else if (st === 'settings') this.openSettings(); }
    clearMenu() { if (this.menu) { this.menu.destroy(); this.menu = null; } if (this.extra) { this.extra.forEach((t) => t.destroy()); this.extra = null; } }

    lastSlot() {
      const S = PL.Save.settings();
      if (S.lastSlot !== undefined && PL.Save.load(S.lastSlot)) return S.lastSlot;
      for (let i = 0; i < PL.Save.SLOTS; i++) if (PL.Save.load(i)) return i;
      return -1;
    }

    openMain() {
      this.clearMenu();
      this.state = 'main';
      const W = this.scale.width, H = this.scale.height;
      const last = this.lastSlot();
      const items = [];
      if (last >= 0) items.push({ label: 'Continuar', select: () => this.startSlot(last), hint: 'Espaço ' + (last + 1) });
      items.push(
        { label: 'Jogar', select: () => this.openSlots() },
        { label: 'Configurações', select: () => this.openSettings() },
        { label: 'Controles', select: () => this.openControls() },
        { label: 'Tela cheia', select: () => { if (this.scale.isFullscreen) this.scale.stopFullscreen(); else this.scale.startFullscreen(); } },
        { label: 'Voltar à coleção', select: () => { root.location.href = '../index.html'; } },
      );
      this.menu = new PL.UI.Menu(this, { x: W / 2, y: Math.round(H * 0.56), w: 150, items, depth: 30 });
    }

    openSlots() {
      this.clearMenu();
      this.state = 'slots';
      const W = this.scale.width, H = this.scale.height;
      const items = [];
      for (let i = 0; i < PL.Save.SLOTS; i++) {
        const s = PL.Save.summary(i);
        const label = s ? `Espaço ${i + 1} · ${s.region} · ${PL.Save.fmtTime(s.time)} · ◆${s.vert}` : `Espaço ${i + 1} · vazio`;
        items.push({
          label: (this.delMode && s ? '× ' : '') + label,
          select: () => {
            if (this.delMode) { if (s) this.confirmDelete(i); return; }
            if (s) this.startSlot(i); else this.newGame(i);
          },
          hint: s ? (this.delMode ? 'apagar este espaço' : 'continuar de onde parou') : 'começar uma nova jornada',
        });
      }
      items.push({ label: this.delMode ? 'Cancelar apagar' : 'Apagar um espaço', select: () => { this.delMode = !this.delMode; this.openSlots(); } });
      items.push({ label: 'Voltar', select: () => { this.delMode = false; this.openMain(); } });
      this.menu = new PL.UI.Menu(this, { x: W / 2, y: Math.round(H * 0.5), w: Math.min(W - 40, 330), items, title: this.delMode ? 'APAGAR QUAL?' : 'ESPAÇOS DE SALVAMENTO', depth: 30, onBack: () => { this.delMode = false; this.openMain(); } });
    }
    confirmDelete(i) {
      this.clearMenu();
      const W = this.scale.width, H = this.scale.height;
      this.menu = new PL.UI.Menu(this, {
        x: W / 2, y: Math.round(H * 0.55), w: 160, title: 'APAGAR ESPAÇO ' + (i + 1) + '?', depth: 30, sel: 1,
        items: [
          { label: 'Sim, apagar', select: () => { PL.Save.remove(i); this.delMode = false; PL.Audio.sfx('kill'); this.openSlots(); } },
          { label: 'Não', select: () => { this.delMode = false; this.openSlots(); } },
        ],
        onBack: () => { this.delMode = false; this.openSlots(); },
      });
    }
    openSettings() {
      this.clearMenu();
      this.state = 'settings';
      const W = this.scale.width;
      this.menu = new PL.UI.Menu(this, { x: W / 2, y: 86, w: 260, title: 'CONFIGURAÇÕES', depth: 30, items: PL.UI.settingsItems(() => this.openMain(), null), onBack: () => this.openMain() });
    }
    openControls() {
      this.clearMenu();
      this.state = 'controls';
      const W = this.scale.width;
      const rows = PL.UI.controlsText();
      this.extra = [];
      rows.forEach((r, i) => {
        const y = 92 + i * 14;
        this.extra.push(this.add.bitmapText(Math.round(W / 2 - 200), y, 'pxo', r[0]).setTint(0xc4b5ea).setDepth(30));
        this.extra.push(this.add.bitmapText(Math.round(W / 2 - 40), y, 'pxo', r[1]).setTint(0xf6d55c).setDepth(30));
        this.extra.push(this.add.bitmapText(Math.round(W / 2 + 80), y, 'pxo', r[2]).setTint(0x98e0d2).setDepth(30));
      });
      this.menu = new PL.UI.Menu(this, { x: W / 2, y: 92 + rows.length * 14 + 16, w: 80, items: [{ label: 'Voltar', select: () => this.openMain() }], depth: 30, onBack: () => this.openMain() });
    }

    startSlot(i) {
      const save = PL.Save.load(i);
      if (!save) return this.newGame(i);
      const S = PL.Save.settings(); S.lastSlot = i; PL.Save.saveSettings(S);
      this.clearMenu();
      this.cameras.main.fadeOut(300, 7, 4, 15);
      this.time.delayedCall(320, () => this.scene.start('Game', { slot: i, save }));
    }
    newGame(i) {
      const S = PL.Save.settings(); S.lastSlot = i; PL.Save.saveSettings(S);
      const save = PL.Save.fresh();
      PL.Save.write(i, save);
      this.clearMenu();
      this.cameras.main.fadeOut(300, 7, 4, 15);
      this.time.delayedCall(320, () => this.scene.start('Intro', { slot: i, save }));
    }

    update(time, delta) {
      const dt = Math.min(delta / 1000, 1 / 20);
      this.t += dt;
      PL.Input.update();
      const I = PL.Input;
      if (this.state === 'press') {
        this.pressT.setText(PL.Input.last === 'toque' || ('ontouchstart' in root) ? 'toque para começar' : 'pressione qualquer tecla').setAlpha(0.5 + 0.5 * Math.sin(this.t * 4));
        this.pressT.setPosition(Math.round(this.scale.width / 2 - this.pressT.width / 2), Math.round(this.scale.height * 0.82));
        for (const a of I.ACTIONS) if (I.pressed[a]) { this.begin(); break; }
      } else if (this.menu) this.menu.update();
      this.drawCube(dt);
      this.bg.update(this.t * 20, 0, Math.sin(this.t * 0.4) * 40, this.t);
    }

    // o cubo gira em 3D e o plano de corte passeia: a fatia vira quadrado, hexágono, triângulo…
    drawCube() {
      const g = this.g, W = this.scale.width, H = this.scale.height;
      g.clear();
      const cx = W / 2, cy = H * 0.5 - (this.state === 'press' ? -6 : 36);
      const m = G3.rotMatrix(this.t * 0.5, this.t * 0.37, this.t * 0.23);
      G3.setHull(this.cube, this.base, m, cx, cy, 0);
      const zc = Math.sin(this.t * 0.6) * 60;
      const R = PL.REGIONS.borda;
      // fatias fantasmas à frente e atrás
      for (let k = -3; k <= 3; k++) {
        if (!k) continue;
        if (G3.sliceInto(this.cube, zc + k * 14, this.s)) PL.Slices.dotted(g, this.s, k > 0 ? R.ghostFront : R.ghostBack, 0.5 - Math.abs(k) * 0.12, 2);
      }
      if (G3.sliceInto(this.cube, zc, this.s)) PL.Slices.drawSolid(g, { mat: 'lilas', seed: 1 }, this.s, zc, { speck: false, deco: false });
      // o Quadrado olhando, pequeno, ao lado
      const qx = Math.round(cx + 84), qy = Math.round(cy + 46 + Math.sin(this.t * 3) * 1.5);
      g.fillStyle(0x2a1e3b, 1); g.fillRect(qx - 6, qy - 6, 12, 12);
      g.fillStyle(0xf6d55c, 1); g.fillRect(qx - 5, qy - 5, 10, 10);
      g.fillStyle(0xffffff, 1); g.fillRect(qx - 4, qy - 3, 2, 3); g.fillRect(qx, qy - 3, 2, 3);
      g.fillStyle(0x2a1e3b, 1); g.fillRect(qx - 4, qy - 2, 1, 2); g.fillRect(qx, qy - 2, 1, 2);
    }
  }

  PL.TitleScene = TitleScene;
})(typeof globalThis !== 'undefined' ? globalThis : this);
