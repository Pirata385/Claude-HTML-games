/* Planolândia — cena do HUD (por cima do jogo): Lados, Geometria, Vértices, Régua de Profundidade,
 * faixas de nome, avisos, diálogos, dicas, pausa, mapa e controles de toque. */
(function (root) {
  'use strict';
  const PL = root.PL || (root.PL = {});
  const M = PL.M;
  const UI = () => PL.UI;

  class HudScene extends Phaser.Scene {
    constructor() { super('Hud'); }

    init(data) { this.game_ = data.game; }

    create() {
      const G = this.game_;
      G.hud = this;
      this.g = this.add.graphics().setDepth(10);
      this.fg = this.add.graphics().setDepth(120);
      this.t = 0;
      this.pulses = { lados: 0, vert: 0 };
      this.flashA = 0; this.flashC = 0xffffff;
      const T = (font) => this.add.bitmapText(0, 0, font || 'pxo', '').setDepth(20);
      this.vertT = T();
      this.bannerT = T().setScale(2);
      this.bannerS = T();
      this.toastT = T();
      this.promptT = T();
      this.hintT = T().setTint(0xf3e7cf);
      this.fpsT = T().setTint(0x98e0d2);
      this.zT = T().setTint(0xc4b5ea);
      this.dlgTitle = T().setDepth(131).setTint(0xff5fa2);
      this.dlgText = T().setDepth(131);
      this.dlgMore = T().setDepth(131).setTint(0xf6d55c);
      this.mapTexts = { title: T().setDepth(131).setTint(0xff5fa2), legend: T().setDepth(131).setTint(0x8f86b8), close: T().setDepth(131).setTint(0x8f86b8) };
      this.banner_ = null;
      this.toasts = [];
      this.dlg = null;
      this.menu = null;
      this.mode = 'play';
      this.ctrlTexts = [];
      this.touch = new PL.Touch(this);
      this.scale.on('resize', () => this.touch.layout());
      PL.onSettings = (S) => { this.touch.layout(); };
      this.events.once('shutdown', () => { PL.onSettings = null; });
    }

    // ---------- API usada pelo jogo ----------
    banner(title, sub, boss) { this.banner_ = { title: String(title).toUpperCase(), sub: sub || '', t: 0, dur: boss ? 3.4 : 2.8, boss }; }
    toast(text) { this.toasts.push({ text: UI().keys(text), t: 0, dur: 3.2 }); if (this.toasts.length > 3) this.toasts.shift(); }
    pulse(k) { this.pulses[k] = 0.4; }
    flash(c) { if (!this.game_.settings.flashes) return; this.flashA = 0.5; this.flashC = c || 0xffffff; }
    dialog(pages, title) {
      this.dlg = { pages: pages.map((p) => UI().keys(p)), title: title || null, i: 0, shown: 0 };
      this.game_.dialogOpen = true;
      if (!title && this.dlg.pages.length > 1 && this.dlg.pages[0].length < 40) { this.dlg.title = this.dlg.pages.shift(); }
      PL.Input.clearAll();
    }
    dialogOpen() { return !!this.dlg; }
    advanceDialog() {
      const d = this.dlg;
      if (!d) return;
      const full = d.pages[d.i];
      if (d.shown < full.length) { d.shown = full.length; return; }
      d.i++; d.shown = 0;
      PL.Audio.sfx('menu');
      if (d.i >= d.pages.length) { this.dlg = null; this.game_.dialogOpen = false; PL.Input.clearAll(); }
    }
    menuOpen() { return this.mode !== 'play'; }

    togglePause() {
      if (this.mode === 'play') this.openPause();
      else this.closeMenus();
    }
    toggleMap() {
      if (this.mode === 'map') this.closeMenus();
      else { this.closeMenus(); this.mode = 'map'; this.game_.paused = true; PL.Audio.sfx('menu'); }
    }
    openPause(sel) {
      this.closeMenus(true);
      this.mode = 'pause';
      this.game_.paused = true;
      const W = this.scale.width, H = this.scale.height;
      this.menu = new (UI().Menu)(this, {
        x: W / 2, y: H / 2 - 48, w: 170, title: 'PAUSA', sel: sel || 0, depth: 140,
        onBack: () => this.closeMenus(),
        items: [
          { label: 'Continuar', select: () => this.closeMenus() },
          { label: 'Mapa', select: () => this.toggleMap() },
          { label: 'Configurações', select: () => this.openSettings() },
          { label: 'Controles', select: () => this.openControls() },
          { label: 'Tela cheia', select: () => { if (this.scale.isFullscreen) this.scale.stopFullscreen(); else this.scale.startFullscreen(); } },
          { label: 'Sair para o título', select: () => this.quit() },
        ],
      });
      PL.Audio.sfx('menu');
    }
    openSettings() {
      this.closeMenus(true);
      this.mode = 'settings';
      this.game_.paused = true;
      const W = this.scale.width, H = this.scale.height;
      this.menu = new (UI().Menu)(this, { x: W / 2, y: 30, w: 260, lineH: 15, title: 'CONFIGURAÇÕES', depth: 140, onBack: () => this.openPause(2), items: UI().settingsItems(() => this.openPause(2), this.game_) });
    }
    openControls() {
      this.closeMenus(true);
      this.mode = 'controls';
      this.game_.paused = true;
      const W = this.scale.width;
      const rows = UI().controlsText();
      const head = this.add.bitmapText(0, 0, 'pxo', 'CONTROLES').setTint(0xff5fa2).setDepth(141);
      head.setPosition(Math.round(W / 2 - head.width / 2), 26);
      this.ctrlTexts.push(head);
      rows.forEach((r, i) => {
        const y = 48 + i * 15;
        this.ctrlTexts.push(this.add.bitmapText(Math.round(W / 2 - 200), y, 'pxo', r[0]).setTint(0xc4b5ea).setDepth(141));
        this.ctrlTexts.push(this.add.bitmapText(Math.round(W / 2 - 40), y, 'pxo', r[1]).setTint(0xf6d55c).setDepth(141));
        this.ctrlTexts.push(this.add.bitmapText(Math.round(W / 2 + 80), y, 'pxo', r[2]).setTint(0x98e0d2).setDepth(141));
      });
      const tip = this.add.bitmapText(0, 0, 'pxo', 'Toque: joystick à esquerda · arraste GOLPE para mirar · ▲ interage').setTint(0x8f86b8).setDepth(141);
      tip.setPosition(Math.round(W / 2 - tip.width / 2), 48 + rows.length * 15 + 8);
      const back = this.add.bitmapText(0, 0, 'pxo', UI().keys('[pause] volta')).setTint(0x8f86b8).setDepth(141);
      back.setPosition(Math.round(W / 2 - back.width / 2), 48 + rows.length * 15 + 26);
      this.ctrlTexts.push(tip, back);
      this.ctrlBack = () => this.openPause(3);
      back.setInteractive().on('pointerdown', () => this.openPause(3));
    }
    closeMenus(keepPaused) {
      if (this.menu) { this.menu.destroy(); this.menu = null; }
      for (const t of this.ctrlTexts) t.destroy();
      this.ctrlTexts = [];
      for (const k in this.mapTexts) this.mapTexts[k].setText('');
      this.mode = 'play';
      if (!keepPaused) { this.game_.paused = false; PL.Input.clearAll(); }
    }
    quit() {
      this.closeMenus();
      const G = this.game_;
      if (G.slot >= 0) PL.Save.write(G.slot, G.save);
      PL.Audio.music('title');
      this.scene.stop('Game');
      this.scene.start('Title');
    }

    // ---------- laço ----------
    update(time, delta) {
      const dt = Math.min(delta / 1000, 1 / 20);
      this.t += dt;
      const G = this.game_, I = PL.Input;
      this.touch.showContext = !!G.promptEnt && this.mode === 'play' && !this.dlg;
      this.touch.update();
      // atalhos
      if (this.dlg) {
        if (I.pressed.confirm || I.pressed.jump || I.pressed.attack || I.pressed.up || I.pressed.back) this.advanceDialog();
        this.dlg && (this.dlg.shown = Math.min(this.dlg.pages[this.dlg.i].length, this.dlg.shown + dt * 70));
        if (this.dlg && Math.random() < 0.3 && this.dlg.shown < this.dlg.pages[this.dlg.i].length) PL.Audio.sfx('type');
      } else if (this.mode === 'play') {
        if (I.pressed.pause) { I.eat('pause'); I.eat('back'); this.openPause(); }
        else if (I.pressed.map) { I.eat('map'); this.toggleMap(); }
      } else if (this.mode === 'map') {
        if (I.pressed.map || I.pressed.pause || I.pressed.back) { I.eat('pause'); I.eat('back'); this.closeMenus(); }
      } else if (this.mode === 'controls') {
        if (I.pressed.pause || I.pressed.back || I.pressed.confirm) { I.eat('pause'); I.eat('back'); this.openPause(3); }
      } else if (this.menu) {
        this.menu.update();
      }
      this.draw(dt);
    }

    draw(dt) {
      const G = this.game_, st = G.save, g = this.g, W = this.scale.width, H = this.scale.height;
      g.clear();
      for (const k in this.pulses) this.pulses[k] = Math.max(0, this.pulses[k] - dt);
      // ----- Lados (vida): quadradinhos -----
      const lp = this.pulses.lados > 0 ? 1 : 0;
      for (let i = 0; i < st.maxLados; i++) {
        const x = 12 + i * 13, y = 10 - (lp && i === st.lados - 1 ? 2 : 0);
        const full = i < st.lados;
        g.fillStyle(0x0d0a18, 1); g.fillRect(x - 1, y - 1, 12, 12);
        if (full) {
          g.fillStyle(0xf6d55c, 1); g.fillRect(x, y, 10, 10);
          g.fillStyle(0xfff1a8, 1); g.fillRect(x, y, 10, 1); g.fillRect(x, y, 1, 10);
          g.fillStyle(0xd9a441, 1); g.fillRect(x + 1, y + 9, 9, 1); g.fillRect(x + 9, y + 1, 1, 9);
        } else {
          g.lineStyle(1, 0x6a5aa8, 1); g.strokeRect(x + 0.5, y + 0.5, 9, 9);
        }
      }
      // ----- Geometria: hexágono que se enche -----
      const gx = 12, gy = 26, gr = 9;
      const fill = st.geo / 99;
      g.fillStyle(0x0d0a18, 1); this.hex(g, gx + gr, gy + gr, gr + 1.5);
      g.fillStyle(0x2c2350, 1); this.hex(g, gx + gr, gy + gr, gr);
      if (fill > 0) {
        const h = Math.round(gr * 2 * fill);
        for (let yy = 0; yy < h; yy++) {
          const ry = gy + gr * 2 - yy - 1;
          const dy = Math.abs(ry + 0.5 - (gy + gr));
          const hw = Math.max(0, gr - dy * 0.58);
          g.fillStyle(st.geo >= 33 ? 0xffffff : 0xc4b5ea, 1);
          g.fillRect(Math.round(gx + gr - hw), ry, Math.round(hw * 2), 1);
        }
      }
      if (st.geo >= 33 && st.lados < st.maxLados) { g.lineStyle(1, 0xfff1a8, 0.4 + 0.4 * Math.sin(this.t * 6)); g.strokeCircle(gx + gr, gy + gr, gr + 3); }
      // ----- Vértices -----
      const vp = this.pulses.vert > 0;
      this.vertT.setText('◆ ' + st.vert).setTint(vp ? 0xffffff : 0xffe08a).setPosition(36, 30);
      // ----- Régua de profundidade -----
      this.drawRuler(g, G, 14, 58, 84);
      // ----- faixa com o nome da área -----
      const b = this.banner_;
      if (b) {
        b.t += dt;
        const k = b.t < 0.4 ? b.t / 0.4 : b.t > b.dur - 0.5 ? (b.dur - b.t) / 0.5 : 1;
        if (b.t > b.dur) { this.banner_ = null; this.bannerT.setText(''); this.bannerS.setText(''); }
        else {
          this.bannerT.setText(b.title).setAlpha(k).setTint(b.boss ? 0xff5fa2 : 0xf3e7cf);
          this.bannerT.setPosition(Math.round(W / 2 - this.bannerT.width / 2), Math.round(H * 0.24));
          this.bannerS.setText(b.sub).setAlpha(k).setTint(0xc4b5ea);
          this.bannerS.setPosition(Math.round(W / 2 - this.bannerS.width / 2), Math.round(H * 0.24) + 26);
          const lw = Math.round((this.bannerT.width + 30) * k);
          g.fillStyle(b.boss ? 0xff5fa2 : 0xc4b5ea, k * 0.8);
          g.fillRect(Math.round(W / 2 - lw / 2), Math.round(H * 0.24) - 5, lw, 1);
          g.fillRect(Math.round(W / 2 - lw / 2), Math.round(H * 0.24) + 41, lw, 1);
        }
      }
      // ----- avisos -----
      let ty = 10;
      for (let i = this.toasts.length - 1; i >= 0; i--) {
        const t = this.toasts[i];
        t.t += dt;
        if (t.t > t.dur) this.toasts.splice(i, 1);
      }
      const tt = this.toasts[this.toasts.length - 1];
      if (tt) {
        const lines = PL.Font.wrap(tt.text, Math.min(320, W - 140));
        const a = Math.min(1, (tt.dur - tt.t) * 3, tt.t * 6);
        this.toastT.setText(lines.join('\n')).setAlpha(a).setTint(0xf3e7cf);
        const tw = this.toastT.width;
        g.fillStyle(0x150f29, 0.85 * a); g.fillRect(Math.round(W / 2 - tw / 2 - 6), ty - 3, tw + 12, lines.length * 14 + 4);
        this.toastT.setPosition(Math.round(W / 2 - tw / 2), ty);
      } else this.toastT.setText('');
      // ----- interação -----
      const pe = G.promptEnt;
      if (pe && this.mode === 'play' && !this.dlg) {
        const label = (PL.Input.last === 'toque' ? '▲ ' : PL.Input.label('up') + ' ') + pe.prompt;
        this.promptT.setText(label).setTint(0xf6d55c).setAlpha(0.7 + 0.3 * Math.sin(this.t * 5));
        const sx = pe.x - G.cam.x, sy = (pe.y !== undefined ? pe.y : G.player.y) - G.cam.y - 38;
        this.promptT.setPosition(Math.round(sx - this.promptT.width / 2), Math.round(sy));
      } else this.promptT.setText('');
      // ----- dica -----
      const h = G.activeHint;
      if (h && this.mode === 'play' && !this.dlg) {
        const lines = PL.Font.wrap(UI().keys(h.text), Math.min(340, W - 180));
        this.hintT.setText(lines.join('\n'));
        const hw = this.hintT.width, hh = lines.length * 14;
        const y = this.toasts.length ? 52 : 10;
        g.fillStyle(0x150f29, 0.7); g.fillRect(Math.round(W / 2 - hw / 2 - 6), y - 3, hw + 12, hh + 4);
        this.hintT.setPosition(Math.round(W / 2 - hw / 2), y);
      } else this.hintT.setText('');
      // ----- FPS / depuração -----
      if (G.settings.showFps || G.debug.overlay) {
        const fps = Math.round(this.game.loop.actualFps);
        let s = fps + ' fps';
        if (G.debug.overlay) s += `  ${G.room.id}  x${G.player.x.toFixed(0)} y${G.player.y.toFixed(0)} z${G.player.z.toFixed(1)}`;
        this.fpsT.setText(s).setPosition(W - this.fpsT.width - 6, H - 14);
      } else this.fpsT.setText('');
      // ----- clarão -----
      const fg = this.fg;
      fg.clear();
      if (this.flashA > 0) { fg.fillStyle(this.flashC, this.flashA); fg.fillRect(0, 0, W, H); this.flashA = Math.max(0, this.flashA - dt * 3); }
      // ----- mapa / menus / diálogo -----
      if (this.mode === 'map') UI().drawMap(fg, this, G, W, H, this.mapTexts);
      else if (this.mode === 'pause' || this.mode === 'settings' || this.mode === 'controls') { fg.fillStyle(0x07040f, 0.6); fg.fillRect(0, 0, W, H); }
      this.drawDialog(fg, W, H);
      this.touch.draw();
    }

    hex(g, cx, cy, r) {
      g.beginPath();
      for (let i = 0; i < 6; i++) { const a = Math.PI / 6 + (i * Math.PI) / 3; const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r; if (i) g.lineTo(x, y); else g.moveTo(x, y); }
      g.closePath(); g.fillPath();
    }

    drawRuler(g, G, x, y, h) {
      const d = G.room.d, P = G.player;
      const Z = (z) => Math.round(y + h - (z / d) * h);
      g.fillStyle(0x0d0a18, 0.8); g.fillRect(x - 4, y - 4, 13, h + 8);
      g.fillStyle(0x2c2350, 1); g.fillRect(x, y, 5, h);
      for (let i = 0; i <= 8; i++) { const yy = Math.round(y + (h * i) / 8); g.fillStyle(0x6a5aa8, 1); g.fillRect(x + (i % 4 === 0 ? -2 : 0), yy, i % 4 === 0 ? 9 : 5, 1); }
      for (const m of G.rulerMarks()) {
        if (m.band) { g.fillStyle(m.color, 0.6 + 0.4 * Math.sin(this.t * 20)); g.fillRect(x, Z(m.band[1]), 5, Math.max(1, Z(m.band[0]) - Z(m.band[1]))); continue; }
        const yy = M.clamp(Z(m.z), y - 2, y + h + 1);
        if (m.exit) { g.fillStyle(m.color, 1); g.fillRect(x + 6, yy - 1, 3, 3); g.fillRect(x + 9, yy, 2, 1); }
        else { g.fillStyle(m.color, 1); g.fillRect(x - 2, yy - 1, 9, 2); }
      }
      const py = Z(P.z);
      g.fillStyle(0x0d0a18, 1); g.fillRect(x - 3, py - 3, 11, 6);
      g.fillStyle(0xf6d55c, 1); g.fillRect(x - 2, py - 2, 9, 4);
      g.fillStyle(0xffa65c, 1); g.fillRect(x + 1, y - 8, 3, 2);
      g.fillStyle(0x6fb6ff, 1); g.fillRect(x + 1, y + h + 6, 3, 2);
      this.zT.setText('').setPosition(0, 0);
    }

    drawDialog(g, W, H) {
      const d = this.dlg;
      if (!d) { this.dlgTitle.setText(''); this.dlgText.setText(''); this.dlgMore.setText(''); return; }
      const bw = Math.min(420, W - 24), bx = Math.round(W / 2 - bw / 2);
      const lines = PL.Font.wrap(d.pages[d.i], bw - 20);
      const bh = Math.max(56, lines.length * 13 + (d.title ? 30 : 18));
      const by = Math.round(H - bh - (this.touch.enabled ? 96 : 14));
      g.fillStyle(0x07040f, 0.35); g.fillRect(0, 0, W, H);
      g.fillStyle(0x150f29, 0.96); g.fillRect(bx, by, bw, bh);
      g.lineStyle(1, 0xc4b5ea, 1); g.strokeRect(bx + 0.5, by + 0.5, bw - 1, bh - 1);
      g.fillStyle(0xf6d55c, 1); g.fillRect(bx + 3, by + 3, 2, 2); g.fillRect(bx + bw - 5, by + 3, 2, 2); g.fillRect(bx + 3, by + bh - 5, 2, 2); g.fillRect(bx + bw - 5, by + bh - 5, 2, 2);
      let ty = by + 8;
      if (d.title) { this.dlgTitle.setText(d.title.toUpperCase()).setPosition(bx + 10, ty); ty += 16; } else this.dlgTitle.setText('');
      // máquina de escrever
      let left = Math.floor(d.shown);
      const vis = lines.map((l) => { const s = l.slice(0, Math.max(0, left)); left -= l.length + 1; return s; });
      this.dlgText.setText(vis.join('\n')).setTint(0xf3e7cf).setPosition(bx + 10, ty);
      const done = d.shown >= d.pages[d.i].length;
      this.dlgMore.setText(done ? (d.i < d.pages.length - 1 ? '▼' : '■') : '').setAlpha(0.5 + 0.5 * Math.sin(this.t * 8)).setPosition(bx + bw - 14, by + bh - 14);
    }
  }

  PL.HudScene = HudScene;
})(typeof globalThis !== 'undefined' ? globalThis : this);
