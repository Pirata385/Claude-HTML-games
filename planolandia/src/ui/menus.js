/* Planolândia — menus em pixel art (teclado, gamepad e toque), tela de configurações, controles e mapa. */
(function (root) {
  'use strict';
  const PL = root.PL || (root.PL = {});

  const C = { text: 0xf3e7cf, dim: 0x8f86b8, sel: 0xf6d55c, panel: 0x150f29, edge: 0x6a5aa8, accent: 0xff5fa2 };

  // troca [ação] pelo nome da tecla/botão atual
  function keys(text) {
    return String(text).replace(/\[(\w+)\]/g, (m, a) => {
      const L = PL.Input.label(a);
      return L ? L : m;
    });
  }

  class Menu {
    // items: [{ label, get?: () => string, left?, right?, select? , hint? }]
    constructor(scene, opts) {
      this.scene = scene;
      this.items = opts.items;
      this.x = opts.x; this.y = opts.y;
      this.w = opts.w || 220;
      this.lineH = opts.lineH || 15;
      this.title = opts.title || null;
      this.sel = opts.sel || 0;
      this.depth = opts.depth || 200;
      this.center = opts.center !== false;
      this.onBack = opts.onBack || null;
      this.texts = [];
      this.g = scene.add.graphics().setDepth(this.depth).setScrollFactor(0);
      if (this.title) this.titleT = scene.add.bitmapText(0, 0, 'pxo', this.title).setTint(C.accent).setDepth(this.depth + 1).setScrollFactor(0);
      for (let i = 0; i < this.items.length; i++) {
        const t = scene.add.bitmapText(0, 0, 'pxo', '').setDepth(this.depth + 1).setScrollFactor(0);
        this.texts.push(t);
      }
      this.hintT = scene.add.bitmapText(0, 0, 'pxo', '').setTint(C.dim).setDepth(this.depth + 1).setScrollFactor(0);
      this.bindPointer();
      this.layout();
    }
    bindPointer() {
      this.onDown = (p) => {
        for (let i = 0; i < this.texts.length; i++) {
          const r = this.rowRect(i);
          if (p.x >= r[0] && p.x <= r[0] + r[2] && p.y >= r[1] && p.y <= r[1] + r[3]) {
            const it = this.items[i];
            if (it.disabled) return;
            this.sel = i;
            PL.Input.last = p.wasTouch ? 'toque' : PL.Input.last;
            // toque na metade esquerda/direita de itens com valor ajusta o valor
            if ((it.left || it.right) && !it.select) {
              if (p.x < r[0] + r[2] / 2) it.left && it.left(); else it.right && it.right();
              PL.Audio.sfx('menu');
            } else if (it.select) { PL.Audio.sfx('ok'); it.select(); }
            this.layout();
            return;
          }
        }
      };
      this.scene.input.on('pointerdown', this.onDown);
    }
    rowRect(i) {
      const y = this.y + (this.title ? 18 : 0) + i * this.lineH;
      const x = this.center ? this.x - this.w / 2 : this.x;
      return [x - 6, y - 3, this.w + 12, this.lineH];
    }
    layout() {
      const g = this.g;
      g.clear();
      const n = this.items.length;
      const top = this.y - 8, h = n * this.lineH + (this.title ? 18 : 0) + 12;
      const x0 = (this.center ? this.x - this.w / 2 : this.x) - 10;
      g.fillStyle(C.panel, 0.92); g.fillRect(x0, top, this.w + 20, h);
      g.lineStyle(1, C.edge, 1); g.strokeRect(x0 + 0.5, top + 0.5, this.w + 19, h - 1);
      g.fillStyle(C.edge, 1); g.fillRect(x0 + 2, top + 2, 2, 2); g.fillRect(x0 + this.w + 16, top + 2, 2, 2);
      if (this.titleT) {
        this.titleT.setPosition(Math.round(this.center ? this.x - this.titleT.width / 2 : this.x), this.y - 2);
      }
      for (let i = 0; i < n; i++) {
        const it = this.items[i], t = this.texts[i];
        const val = it.get ? '  ' + it.get() : '';
        const arrows = (it.left || it.right) && i === this.sel ? '◄ ' : '';
        t.setText((i === this.sel ? '► ' : '  ') + it.label + val + (arrows ? ' ►' : ''));
        t.setTint(it.disabled ? 0x5a527a : i === this.sel ? C.sel : C.text);
        const r = this.rowRect(i);
        t.setPosition(Math.round(this.center ? this.x - this.w / 2 : this.x), r[1] + 3);
        if (i === this.sel) { g.fillStyle(0xffffff, 0.06); g.fillRect(r[0] + 2, r[1], r[2] - 4, r[3] - 1); }
      }
      const hint = this.items[this.sel] && this.items[this.sel].hint;
      this.hintT.setText(hint ? keys(hint) : '');
      this.hintT.setPosition(Math.round(this.x - this.hintT.width / 2 * (this.center ? 1 : 0)), top + h + 4);
    }
    update() {
      const I = PL.Input;
      let moved = false;
      if (I.pressed.up) { this.sel = (this.sel + this.items.length - 1) % this.items.length; moved = true; }
      if (I.pressed.down) { this.sel = (this.sel + 1) % this.items.length; moved = true; }
      let guard = 0;
      while (this.items[this.sel].disabled && guard++ < 10) this.sel = (this.sel + (I.pressed.up ? this.items.length - 1 : 1)) % this.items.length;
      const it = this.items[this.sel];
      if (I.pressed.left && it.left) { it.left(); moved = true; }
      if (I.pressed.right && it.right) { it.right(); moved = true; }
      if (moved) PL.Audio.sfx('menu');
      if ((I.pressed.confirm || I.pressed.jump) && it.select) { I.eat('confirm'); I.eat('jump'); PL.Audio.sfx('ok'); it.select(); }
      else if (I.pressed.back && this.onBack) { I.eat('back'); I.eat('pause'); this.onBack(); }
      if (!this.dead) this.layout();
    }
    destroy() {
      this.dead = true;
      this.scene.input.off('pointerdown', this.onDown);
      this.g.destroy();
      for (const t of this.texts) t.destroy();
      if (this.titleT) this.titleT.destroy();
      this.hintT.destroy();
    }
  }

  // itens da tela de configurações (compartilhados entre título e pausa)
  function settingsItems(onBack, game) {
    const S = PL.Save.settings();
    const save = () => {
      PL.Save.saveSettings(S);
      PL.Audio.setVolumes(S.music, S.sfx);
      PL.Input.setPreset(S.preset);
      if (game) {
        game.settings = S;
        game.fx.scale = S.economy ? 0.5 : 1;
        game.slices.dens = S.economy ? 0.5 : 1;
        game.slices.key = '';
      }
      if (PL.onSettings) PL.onSettings(S);
    };
    const bar = (v) => '■'.repeat(0) + '[' + '#'.repeat(Math.round(v * 10)).padEnd(10, '.') + ']';
    const yn = (b) => (b ? 'Sim' : 'Não');
    const step = (k, d) => () => { S[k] = Math.round(Math.min(1, Math.max(0, S[k] + d)) * 10) / 10; save(); };
    return [
      { label: 'Música', get: () => bar(S.music), left: step('music', -0.1), right: step('music', 0.1) },
      { label: 'Efeitos', get: () => bar(S.sfx), left: step('sfx', -0.1), right: step('sfx', 0.1) },
      { label: 'Teclas', get: () => (S.preset === 'wasd' ? 'WASD + Q/E' : 'Setas + A/S'), left: () => { S.preset = S.preset === 'wasd' ? 'setas' : 'wasd'; save(); }, right: () => { S.preset = S.preset === 'wasd' ? 'setas' : 'wasd'; save(); } },
      { label: 'Tremor de tela', get: () => yn(S.shake), left: () => { S.shake = !S.shake; save(); }, right: () => { S.shake = !S.shake; save(); } },
      { label: 'Clarões', get: () => yn(S.flashes), left: () => { S.flashes = !S.flashes; save(); }, right: () => { S.flashes = !S.flashes; save(); } },
      { label: 'Toque: profundidade', get: () => (S.touchDepth === 'joystick' ? 'joystick ↑↓' : 'botões'), left: () => { S.touchDepth = S.touchDepth === 'joystick' ? 'botoes' : 'joystick'; save(); }, right: () => { S.touchDepth = S.touchDepth === 'joystick' ? 'botoes' : 'joystick'; save(); }, hint: 'joystick: ↑↓ desliza; mire golpes arrastando o botão GOLPE' },
      { label: 'Toque: opacidade', get: () => bar(S.touchOpacity), left: step('touchOpacity', -0.1), right: step('touchOpacity', 0.1) },
      { label: 'Toque: tamanho', get: () => Math.round(S.touchScale * 100) + '%', left: () => { S.touchScale = Math.max(0.7, Math.round((S.touchScale - 0.1) * 10) / 10); save(); }, right: () => { S.touchScale = Math.min(1.5, Math.round((S.touchScale + 0.1) * 10) / 10); save(); } },
      { label: 'Modo economia', get: () => yn(S.economy), left: () => { S.economy = !S.economy; save(); }, right: () => { S.economy = !S.economy; save(); }, hint: 'menos partículas e detalhes, para aparelhos mais fracos' },
      { label: 'Mostrar FPS', get: () => yn(S.showFps), left: () => { S.showFps = !S.showFps; save(); }, right: () => { S.showFps = !S.showFps; save(); } },
      { label: 'Voltar', select: onBack },
    ];
  }

  function controlsText() {
    const p = PL.Input.preset === 'wasd' ? 'wasd' : 'setas';
    const L = PL.Input.LABELS[p], P = PL.Input.LABELS.pad;
    const rows = [
      ['Andar', `${L.left} ${L.right}`, `${P.left} ${P.right}`],
      ['Mirar / interagir', `${L.up} ${L.down}`, `${P.up} ${P.down}`],
      ['Profundidade trás/frente', `${L.zb} / ${L.zf}`, 'LB/RB · analógico dir.'],
      ['Pular', L.jump, P.jump],
      ['Golpe de Aresta', L.attack + (p === 'wasd' ? ' · clique' : ''), P.attack],
      ['Investida', L.dash, P.dash],
      ['Foco (curar)', L.focus + (p === 'wasd' ? ' · botão dir.' : ''), P.focus],
      ['Mapa · Pausa', `${L.map} · ${L.pause}`, `${P.map} · ${P.pause}`],
    ];
    return rows;
  }

  // ---------- mapa: salas visitadas, Pontos Fixos, passagens de profundidade ----------
  const benchCache = {};
  function drawMap(g, scene, game, W, H, texts) {
    const st = game.save, defs = PL.World.defs;
    const region = game.room.def.region;
    const mapa = st.mapas && st.mapas[region];
    const rooms = Object.values(defs).filter((d) => d.region === region && (st.visited[d.id] || mapa));
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const d of rooms) { x0 = Math.min(x0, d.pos[0]); y0 = Math.min(y0, d.pos[1]); x1 = Math.max(x1, d.pos[0] + d.size[0]); y1 = Math.max(y1, d.pos[1] + d.size[1]); }
    const mw = W - 60, mh = H - 80;
    const sc = Math.min(mw / Math.max(1, x1 - x0), mh / Math.max(1, y1 - y0), 0.12);
    const ox = (W - (x1 - x0) * sc) / 2, oy = 40 + (mh - (y1 - y0) * sc) / 2;
    const X = (x) => Math.round(ox + (x - x0) * sc), Y = (y) => Math.round(oy + (y - y0) * sc);
    g.fillStyle(0x07040f, 0.88); g.fillRect(0, 0, W, H);
    // papel quadriculado
    g.fillStyle(0x1b1433, 1);
    for (let x = 0; x < W; x += 12) g.fillRect(x, 0, 1, H);
    for (let y = 0; y < H; y += 12) g.fillRect(0, y, W, 1);
    for (const d of rooms) {
      const cur = d.id === game.room.id;
      if (!st.visited[d.id]) {
        // sala conhecida pelo mapa comprado, ainda não visitada: só o contorno
        const ux = X(d.pos[0]), uy = Y(d.pos[1]), uw = Math.max(3, Math.round(d.size[0] * sc)), uh = Math.max(3, Math.round(d.size[1] * sc));
        g.lineStyle(1, 0x4b3e86, 1); g.strokeRect(ux + 0.5, uy + 0.5, uw - 1, uh - 1);
        continue;
      }
      const rx = X(d.pos[0]), ry = Y(d.pos[1]), rw = Math.max(3, Math.round(d.size[0] * sc)), rh = Math.max(3, Math.round(d.size[1] * sc));
      // espessura de profundidade: sombra oblíqua proporcional a d
      const dk = Math.max(1, Math.round(d.size[2] * sc * 0.25));
      g.fillStyle(0x2c2350, 1); g.fillRect(rx + dk, ry - dk, rw, rh);
      g.fillStyle(cur ? 0x4b3e86 : 0x2f2552, 1); g.fillRect(rx, ry, rw, rh);
      g.lineStyle(1, cur ? 0xf6d55c : 0xc4b5ea, 1); g.strokeRect(rx + 0.5, ry + 0.5, rw - 1, rh - 1);
      for (const e of d.exits) {
        if (e.side === 'near' || e.side === 'far') {
          if (e.sealed || !st.visited[e.to]) continue;
          const cx = X(d.pos[0] + (e.range[0] + e.range[1]) / 2), cy = Y(d.pos[1] + (e.yr[0] + e.yr[1]) / 2);
          g.lineStyle(1, 0xffa65c, 1); g.strokeCircle(cx, cy, 3); g.fillStyle(0xffa65c, 1); g.fillRect(cx, cy, 1, 1);
        } else if (e.sealed) {
          const ex = e.side === 'left' ? rx : e.side === 'right' ? rx + rw - 1 : rx + Math.round((e.range[0] + e.range[1]) / 2 * sc);
          const ey = e.side === 'left' || e.side === 'right' ? ry + Math.round((e.range[0] + e.range[1]) / 2 * sc) : e.side === 'top' ? ry : ry + rh - 1;
          g.fillStyle(0xff5fa2, 1); g.fillRect(ex - 1, ey - 2, 3, 5);
        }
      }
      if (!benchCache[d.id]) benchCache[d.id] = new PL.World.Room(d, PL.Save.fresh()).ents.filter((en) => en.type === 'bench').map((en) => [en.x, en.y]);
      for (const [ex, ey] of benchCache[d.id]) { const bx = X(d.pos[0] + ex), by = Y(d.pos[1] + ey); g.fillStyle(0x6fb6ff, 1); g.fillRect(bx - 1, by - 4, 3, 3); }
    }
    // jogador
    const P = game.player, r = game.room;
    const px = X(r.pos.x + P.x), py = Y(r.pos.y + P.y);
    if (Math.floor(game.t * 3) % 2 === 0) { g.fillStyle(0xf6d55c, 1); g.fillRect(px - 2, py - 2, 4, 4); }
    g.lineStyle(1, 0x2a1e3b, 1); g.strokeRect(px - 2.5, py - 2.5, 5, 5);
    const c = st.contorno;
    if (c && defs[c.room] && defs[c.room].region === region) { const cx = X(defs[c.room].pos[0] + c.x), cy = Y(defs[c.room].pos[1] + c.y); g.lineStyle(1, 0xffffff, 1); g.strokeRect(cx - 2.5, cy - 2.5, 5, 5); }
    texts.title.setText(PL.REGIONS[region].nome.toUpperCase()).setPosition(Math.round(W / 2 - texts.title.width / 2), 12);
    texts.legend.setText('■ você   ■ Ponto Fixo   ○ passagem pela profundidade   ▮ fenda instável').setPosition(Math.round(W / 2 - texts.legend.width / 2), H - 30);
    texts.close.setText(keys('[map] ou [pause] fecha')).setPosition(Math.round(W / 2 - texts.close.width / 2), H - 16);
  }

  PL.UI = { Menu, settingsItems, controlsText, drawMap, keys, C };

  if (typeof module !== 'undefined' && module.exports) module.exports = PL;
})(typeof globalThis !== 'undefined' ? globalThis : this);
