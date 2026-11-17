// scenes/title.js — the title screen: three save slots, sound, full screen, backup.
(function () {
  'use strict';
  const RB = globalThis.RB;
  const { Rng, TAU } = RB.core;
  const ui = RB.ui, pal = RB.pal;
  let birds = [], t = 0;

  function logo(cx, y, s) {
    const ctx = ui.ctx;
    // a ring of beakers around a rooster's head
    ctx.strokeStyle = pal.mustard; ctx.lineWidth = 5 * s; ctx.beginPath(); ctx.arc(cx, y, 44 * s, 0, TAU); ctx.stroke();
    for (let i = 0; i < 8; i++) { const a = i * TAU / 8 + t * 0.25; ui.icon('beaker', cx + Math.cos(a) * 44 * s, y + Math.sin(a) * 44 * s, 20 * s, i % 2 ? pal.teal : pal.coral); }
    ctx.fillStyle = pal.coral;
    for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(cx - 8 * s + i * 9 * s, y - 20 * s - (i === 1 ? 4 * s : 0), 7 * s, 0, TAU); ctx.fill(); }
    ctx.fillStyle = pal.paper; ctx.beginPath(); ctx.arc(cx, y, 20 * s, 0, TAU); ctx.fill();
    ctx.fillStyle = pal.mustard; ctx.beginPath(); ctx.moveTo(cx + 14 * s, y - 6 * s); ctx.lineTo(cx + 36 * s, y + 3 * s); ctx.lineTo(cx + 14 * s, y + 8 * s); ctx.closePath(); ctx.fill();
    ctx.fillStyle = pal.coral; ctx.beginPath(); ctx.ellipse(cx + 12 * s, y + 20 * s, 5 * s, 10 * s, 0.2, 0, TAU); ctx.fill();
    ctx.fillStyle = pal.ink; ctx.beginPath(); ctx.arc(cx + 5 * s, y - 5 * s, 3.4 * s, 0, TAU); ctx.fill();
  }

  RB.scenes.title = {
    enter() {
      RB.audio.setTune('title');
      const r = new Rng(Date.now() >>> 0);
      birds = [];
      for (let i = 0; i < 7; i++) {
        const id = r.pick(['chicken', 'chicken', 'duck', 'goose', 'heron', 'flamingo', 'ostrich', 'parrot', 'peafowl', 'owl', 'penguin', 'turkey', 'toucan', 'secretary']);
        birds.push({ P: RB.pheno.express(RB.species.make(id, r, { sport: 0.15 })), x: r.range(-200, 1200), f: r.chance(0.5) ? 1 : -1, sp: r.range(0.3, 0.9), ph: r.next() });
      }
    },
    update(dt) {
      t += dt;
      for (const b of birds) { b.x += b.f * b.sp * b.P.speedMax * 0.55 * dt; b.ph = (b.ph + dt * b.sp * 1.6 / Math.max(0.12, b.P.swingMin * 2.6)) % 1; }
    },
    draw(ctx) {
      const v = ui.view, game = RB.game;
      const g = ctx.createLinearGradient(0, 0, 0, v.h); g.addColorStop(0, '#9fd9ea'); g.addColorStop(1, '#e6f3df');
      ctx.fillStyle = g; ctx.fillRect(0, 0, v.w, v.h);
      ctx.fillStyle = '#fbe9a8'; ctx.beginPath(); ctx.arc(v.w * 0.82, v.h * 0.2, 34, 0, TAU); ctx.fill();
      const gy = v.h * 0.8;
      ctx.fillStyle = '#b9cf7a'; ctx.beginPath(); ctx.moveTo(0, gy);
      for (let x = 0; x <= v.w; x += 20) ctx.lineTo(x, gy - 46 - Math.sin(x * 0.008 + 1) * 22 - Math.sin(x * 0.021) * 8);
      ctx.lineTo(v.w, v.h); ctx.lineTo(0, v.h); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#a6c067'; ctx.fillRect(0, gy, v.w, v.h - gy);
      // strolling birds
      const sc = 0.62, span = v.w / sc + 500;
      ctx.save(); ctx.translate(0, gy + 14); ctx.scale(sc, sc);
      for (const b of birds) {
        const x = ((b.x % span) + span) % span - 250;
        RB.art.drawShadow(ctx, x, 0, b.P.TL * 0.6);
        RB.art.drawCreature(ctx, b.P, RB.pose.animPose(b.P, { x, y: 0, f: b.f, phase: b.ph, speed: b.sp, time: t }), {});
      }
      ctx.restore();

      const tall = v.h > v.w, ls = tall ? 1 : Math.min(1, v.h / 430);
      const ly = tall ? v.h * 0.16 : 62 * ls + 6;
      logo(v.w / 2, ly, ls);
      ui.text('RING OF', v.w / 2, ly + 72 * ls, { size: 17 * ls, align: 'center', color: pal.teal });
      ui.text('BEAKERS', v.w / 2, ly + 106 * ls, { size: 38 * ls, align: 'center' });
      ui.text('Catch. Breed. Splice. Fight.', v.w / 2, ly + 126 * ls, { size: 13 * ls, align: 'center', bold: false });
      // save slots
      const sw = tall ? Math.min(320, v.w - 32) : Math.min(220, (v.w - 56) / 3), sh = tall ? 58 : 66;
      const top = tall ? ly + 150 : ly + 142 * ls, x0 = tall ? (v.w - sw) / 2 : (v.w - (sw * 3 + 20)) / 2;
      for (let i = 0; i < 3; i++) {
        const info = RB.save.info(i), x = tall ? x0 : x0 + i * (sw + 10), y = tall ? top + i * (sh + 10) : top;
        const label = info ? 'Day ' + info.day + (info.won ? ' ★' : '') : 'New game';
        const sub = info ? (info.sandbox ? 'Sandbox · ' : '') + '$' + info.money + ' · ' + info.birds + ' creature' + (info.birds === 1 ? '' : 's') : 'Slot ' + (i + 1);
        if (ui.btn(x, y, sw - (info ? 42 : 0), sh, label, { sub, fill: info ? pal.teal : pal.mustard, color: info ? pal.white : pal.ink, size: 17 })) {
          RB.audio.play('click');
          if (info && game.load(i)) game.go('coop');
          else newGameWindow(i);
        }
        if (info && ui.btn(x + sw - 36, y, 36, sh, '', { icon: 'trash', fill: pal.brick })) {
          ui.confirm('Delete save', 'Delete the game in slot ' + (i + 1) + '? This cannot be undone.', 'Delete', () => RB.save.remove(i));
        }
      }
      // footer
      const by = v.h - 48, st = game.settings;
      const icons = [[st.sfx > 0 ? 'sound' : 'mute', () => { st.sfx = st.sfx > 0 ? 0 : 0.8; game.applySettings(); }], ['music', () => { st.music = st.music > 0 ? 0 : 0.5; game.applySettings(); }, st.music > 0 ? pal.plum : pal.grey],
        ['full', () => game.fullscreen()], ['gear', () => RB.common.settings(false)], ['bag', () => backup()]];
      icons.forEach((ic, i) => { if (ui.btn(10 + i * 46, by, 40, 38, '', { icon: ic[0], fill: ic[2] || pal.plum })) { RB.audio.play('click'); ic[1](); } });
      if (ui.btn(v.w - 122, by, 112, 38, 'All games', { icon: 'left', fill: pal.ink, size: 13 })) location.href = '../index.html';
    },
  };

  // A new game: the story (start with a coop, two chickens and a debt), or a sandbox with
  // everything unlocked and the open sea from day one.
  function newGameWindow(slot) {
    const start = (sandbox) => { ui.closeAll(); RB.game.newGame(slot, undefined, { sandbox }); RB.game.go('coop', { intro: !sandbox }); };
    ui.open({ draw() {
      const box = ui.window('New game', 360, 300, {});
      if (!box) return;
      ui.para('How do you want to play?', box.x, box.y, box.w, { size: 13 });
      const bh = 100, y1 = box.y + 30, y2 = y1 + bh + 12;
      if (ui.btn(box.x, y1, box.w, bh, 'Normal', { sub: 'A coop, two chickens and a debt. Unlock everything as you go.', fill: pal.mustard, color: pal.ink, size: 18 })) { RB.audio.play('click'); start(false); }
      if (ui.btn(box.x, y2, box.w, bh, 'Sandbox', { sub: 'Every upgrade and tool, no debt, and the open sea from the start.', fill: pal.teal, size: 18 })) { RB.audio.play('click'); start(true); }
    } });
  }

  // Copy a slot out as text, or paste one in.
  function backup() {
    ui.open({ draw() {
      const box = ui.window('Backup', 340, 250, {});
      if (!box) return;
      ui.para('Export copies a save as text you can keep anywhere. Import pastes one back into a slot.', box.x, box.y, box.w, { size: 12 });
      for (let i = 0; i < 3; i++) {
        const y = box.y + 54 + i * 46, info = RB.save.info(i);
        ui.text('Slot ' + (i + 1) + (info ? ' · day ' + info.day : ' · empty'), box.x, y + 24, { size: 13 });
        if (ui.btn(box.x + box.w - 176, y, 84, 36, 'Export', { disabled: !info, size: 13 })) {
          const text = RB.save.exportText(i);
          if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(() => ui.toast('Copied to the clipboard.'), () => window.prompt('Copy this text:', text));
          else window.prompt('Copy this text:', text);
        }
        if (ui.btn(box.x + box.w - 84, y, 84, 36, 'Import', { fill: pal.mustard, color: pal.ink, size: 13 })) {
          const text = window.prompt('Paste a save exported from Ring of Beakers:');
          if (text) ui.toast(RB.save.importText(i, text) ? 'Imported into slot ' + (i + 1) + '.' : 'That text is not a save.', pal.ink);
        }
      }
    } });
  }
})();
