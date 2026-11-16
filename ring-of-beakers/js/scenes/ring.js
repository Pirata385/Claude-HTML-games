// scenes/ring.js — a bout on screen: the arena, the two ragdolls, health and wind, the three
// trainer commands, the bell and the purse. The fight itself is fight.js; this draws it, feeds it
// your commands and settles the money afterwards.
(function () {
  'use strict';
  const RB = globalThis.RB;
  const { Rng, clamp, lerp, TAU, hashStr } = RB.core;
  const ui = RB.ui, pal = RB.pal, input = RB.input, ST = RB.state, common = RB.common, EC = RB.economy;
  const HOW = { ko: 'by knockout', fled: 'the other one ran', ringout: 'by ring-out', decision: 'on points', towel: 'the towel came in' };
  const CMD = [['sic', 'Sic \'em!', 'bolt', pal.coral, 'Digit1'], ['back', 'Back off!', 'shield', pal.teal, 'Digit2'], ['whistle', 'Whistle', 'whistle', pal.mustard, 'Digit3']];
  const CROWD = ['#e76f51', '#2a9d8f', '#e9b44c', '#6d4c7d', '#7fb069', '#3d6fa5', '#d98cab', '#f2efe6'];

  let A, fight, phase, pt, cam, parts, flash, seen, mine, speed, shake, bubbles, rng, settled, lines, cheer;

  function boom(x, y, n, col, kind) {
    for (let i = 0; i < n; i++) { const a = rng.range(0, TAU), s = rng.range(40, 260); parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 90, life: rng.range(0.5, 1.1), col, kind: kind || 'feather', rot: rng.range(0, TAU), vr: rng.range(-8, 8), size: rng.range(0.7, 1.3) }); }
  }
  function text(x, y, str, col, size) { parts.push({ x, y, vx: rng.range(-20, 20), vy: -70, life: 1.1, kind: 'text', str, col, size: size || 1 }); }

  // Apply the result to the save. Returns lines for the result panel.
  function settle() {
    const S = RB.game.S, r = fight.result, out = [], card = A.card || {};
    S.time = Math.min(25.9, S.time + 1);
    if (mine) {
      const c = A.a.c, won = r.winner === 0;
      // every bout tires a bird out for the day (a tonic perks it up); only a loss leaves wounds,
      // and wounds stay until the vet sees to them
      S.stats.fights++; c.bouts++; c.tired = true;
      if (r.winner !== 0) {
        const before = c.hp;
        c.hp = clamp(Math.min(r.hp[0], before - 0.08), 0.15, 1);
        out.push([c.name + ' is wounded (' + Math.round(c.hp * 100) + '%). Only the vet can heal that.', 0]);
      }
      out.push([c.name + ' is worn out for today. A tonic would perk it up.', 0]);
      if (c.buff === 'chili') c.buff = null;
      if (won) {
        c.wins++; S.stats.wins++; c.bond = Math.min(1, c.bond + 0.05);
        if (card.purse) { S.money += card.purse; S.stats.earned += card.purse; out.push(['Purse', card.purse]); }
        if (A.arena) {
          const lg = RB.economy.leagueOf(S, A.arena.id);
          if (card.boss) {
            lg.boss = true;
            out.push([A.arena.name + ' is yours!', 0]);
            A.prizes = ST.bossPrizes(S); // the first two bosses hand over a tool that never wears out
            for (const id of A.prizes) out.push(['Prize: the ' + RB.items.ITEMS[id].name.toLowerCase() + '!', 0]);
            if (A.arena.boss.final) S.won = true;
          } else { lg.wins++; out.push(['Wins here: ' + lg.wins + (lg.wins >= A.arena.need ? ' (the boss will see you)' : ' of ' + A.arena.need), 0]); }
        }
      } else {
        c.losses++;
      }
      if (card.duel) RB.npc.info(S, card.duel).fought = S.day;
      ST.dirty(c);
    }
    if (A.bet && A.bet.amount > 0) {
      if (A.bet.side === r.winner) { const pay = Math.round(A.bet.amount * (1 + A.bet.mult)); S.money += pay; S.stats.earned += pay - A.bet.amount; out.push(['Bet won', pay]); }
      else out.push(['Bet lost', -A.bet.amount]);
    }
    if (card.exh) EC.exhibitionDone(S, card.exh.arena, card.exh.slot);
    else if (card.key) S.bets[card.key] = S.day;
    common.checkAch(S);
    RB.game.save();
    return out;
  }

  RB.scenes.ring = {
    // args: { a: { c } | { P, name }, b: { P, name, trainer, gear }, card, arena, bet: { side, amount, mult }, back, backArgs }
    enter(args) {
      A = args;
      const S = RB.game.S;
      mine = !!(A.a && A.a.c);
      const card = A.card || {};
      rng = new Rng(hashStr(String(card.key || 'x')) ^ S.seed ^ (S.stats.fights * 7919));
      const a = mine ? { P: ST.pheno(A.a.c), name: A.a.c.name, auto: false, bond: A.a.c.bond, gear: A.a.c.gear ? { [A.a.c.gear]: true } : {}, hpFrac: A.a.c.hp, fired: A.a.c.buff === 'chili' } : { P: A.a.P, name: A.a.name, gear: A.a.gear || {} };
      const b = { P: A.b.P, name: A.b.name, gear: A.b.gear || {} };
      fight = new RB.fight.Fight({ a, b, mode: card.mode || 'pit', seed: rng.int(1, 2e9), timeLimit: 60 });
      phase = 'intro'; pt = 0; parts = []; flash = [0, 0]; seen = 0; shake = 0; bubbles = []; settled = false; lines = []; cheer = 0;
      speed = RB.game.settings.fast ? 2 : 1;
      cam = { x: 0, z: 0.5 };
      RB.audio.setTune(A.card && A.card.boss ? 'boss' : 'fight');
    },
    update(dt) {
      pt += dt; shake = Math.max(0, shake - dt * 5); cheer = Math.max(0, cheer - dt);
      for (let s = 0; s < 2; s++) flash[s] = Math.max(0, flash[s] - dt * 5);
      if (phase === 'intro') { if (pt > 1.7) { phase = 'fight'; pt = 0; RB.audio.play('bell'); } }
      else if (phase === 'fight') {
        for (let i = 0; i < speed; i++) fight.update(dt);
        if (mine && !fight.over) {
          for (const c of CMD) if (input.hit(c[4])) fight.command(0, c[0]);
        }
        if (fight.done) { phase = 'end'; pt = 0; lines = settle(); settled = true; RB.audio.play(!mine || fight.result.winner === 0 ? 'win' : 'lose'); }
      }
      // new events from the simulation
      for (; seen < fight.events.length; seen++) {
        const e = fight.events[seen], F = fight.fighters;
        if (e.type === 'hit') {
          const def = F[1 - e.side];
          flash[1 - e.side] = 1; shake = Math.min(1, shake + e.dmg / def.hpMax * 4);
          boom(e.x, e.y, 3 + Math.round(e.dmg / def.hpMax * 30), def.P.css.body);
          if (e.crit) boom(e.x, e.y, 5, pal.mustard, 'star');
          text(e.x, e.y - 10, String(Math.max(1, Math.round(e.dmg))), e.crit ? pal.coral : pal.ink, e.crit ? 1.5 : 1);
          RB.audio.play(e.crit ? 'crit' : e.weapon === 'beak' ? 'peck' : e.weapon === 'body' || e.weapon === 'wing' ? 'thud' : 'kick');
          cheer = 0.5;
        } else if (e.type === 'down') { const r = F[e.side].rag; boom(r.midX(), 0, 8, '#d9c39a', 'dust'); RB.audio.play('thud'); }
        else if (e.type === 'dodge') { const r = F[e.side].rag; text(r.head.x, r.head.y - 20, 'dodge!', pal.teal); RB.audio.play('whoosh'); }
        else if (e.type === 'flee') { const r = F[e.side].rag; text(r.head.x, r.head.y - 24, 'chickens out!', pal.coral, 1.2); RB.audio.voice(F[e.side].P.voice, 'squawk'); }
        else if (e.type === 'cmd') { bubbles.push({ side: e.side, str: e.obey ? CMD.find((c) => c[0] === e.cmd)[1] : '...ignored', t: 1.4, ok: e.obey }); if (e.cmd === 'whistle') RB.audio.play('whistle'); }
        else if (e.type === 'swing') { if (rng.chance(0.3)) RB.audio.voice(F[e.side].P.voice, 'cluck'); }
        else if (e.type === 'end') { RB.audio.play('bell'); RB.audio.play('cheer'); cheer = 2.5; const w = F[e.winner]; RB.audio.voice(w.P.voice, 'crow'); }
      }
      for (const p of parts) { p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; if (p.kind !== 'text') { p.vy += 500 * dt; p.vx *= 0.98; p.rot += p.vr * dt; if (p.y > -2 && p.vy > 0) { p.y = -2; p.vy = 0; p.vx *= 0.8; } } }
      parts = parts.filter((p) => p.life > 0);
      for (const b of bubbles) b.t -= dt;
      bubbles = bubbles.filter((b) => b.t > 0);
      // camera
      const v = ui.view, R0 = fight.fighters[0].rag, R1 = fight.fighters[1].rag, gy = v.h * 0.76;
      const cx = (R0.midX() + R1.midX()) / 2, span = Math.abs(R0.midX() - R1.midX()) + fight.L * 2.6;
      const top = -Math.min(R0.head.y, R1.head.y, -fight.L * 1.1) + fight.L * 0.6;
      const zt = clamp(Math.min(v.w / span, (gy - 74) / top), 0.08, 4);
      cam.z += (zt - cam.z) * Math.min(1, dt * 3); cam.x += (cx - cam.x) * Math.min(1, dt * 4);
      if (phase === 'intro' && pt < 0.05) { cam.z = zt; cam.x = cx; }
    },

    draw(ctx) {
      const v = ui.view, S = RB.game.S, F = fight.fighters, L = fight.L, gy = v.h * 0.76, z = cam.z, mode = fight.mode;
      const dark = A.arena && A.arena.id === 'cellar';
      ctx.fillStyle = dark ? '#3a3350' : A.arena && A.arena.id === 'grand' ? '#f3d9a4' : '#cfe8e2'; ctx.fillRect(0, 0, v.w, v.h);
      ctx.save();
      ctx.translate(v.w / 2 - cam.x * z + (rng.next() - 0.5) * shake * 6, gy + (rng.next() - 0.5) * shake * 6); ctx.scale(z, z);
      const W = fight.W, X0 = -W * 4, XW = W * 8;
      // the crowd
      const cr = L * 0.16, rows = 3;
      for (let row = rows - 1; row >= 0; row--) {
        const y0 = -L * (1.15 + row * 0.3);
        ctx.fillStyle = dark ? '#2c2740' : row % 2 ? '#bcd9d2' : '#aecfc8';
        ctx.fillRect(X0, y0 + cr, XW, L * 0.4);
        for (let i = 0, x = -W * 2.2 + (row % 2) * cr * 1.3; x < W * 2.2; x += cr * 2.6, i++) {
          const hop = cheer > 0 ? Math.abs(Math.sin(pt * 9 + i * 1.7 + row)) * cr * 0.7 : Math.sin(pt * 2 + i) * cr * 0.08;
          ctx.fillStyle = CROWD[(i * 7 + row * 3) % CROWD.length];
          ctx.beginPath(); ctx.arc(x, y0 - hop, cr, 0, TAU); ctx.fill();
          ctx.fillRect(x - cr * 0.9, y0 + cr * 0.6 - hop, cr * 1.8, cr * 1.2);
        }
      }
      // the arena
      const board = dark ? '#5a4a3a' : '#b98a5a', boardD = dark ? '#4a3c30' : '#96693f', sand = dark ? '#8a7a66' : '#e3c98a', sandD = dark ? '#77695a' : '#d4b976';
      ctx.fillStyle = board; ctx.fillRect(X0, -L * 0.72, XW, L * 0.72);
      ctx.fillStyle = boardD; for (let x = -W * 2.4; x < W * 2.4; x += L * 0.5) ctx.fillRect(x, -L * 0.72, L * 0.05, L * 0.72);
      if (mode === 'pit') {
        ctx.fillStyle = sand; ctx.fillRect(X0, 0, XW, L * 6);
        ctx.fillStyle = sandD; ctx.fillRect(X0, L * 0.12, XW, L * 6);
        ctx.fillStyle = boardD; ctx.fillRect(-W - L * 0.16, -L * 1.5, L * 0.16, L * 1.5); ctx.fillRect(W, -L * 1.5, L * 0.16, L * 1.5);
      } else {
        const D = fight.drop;
        ctx.fillStyle = mode === 'aerial' ? '#6fc3d6' : sandD; ctx.fillRect(X0, D, XW, L * 6);
        if (mode === 'aerial') { ctx.fillStyle = '#8fd5e4'; for (let x = -W * 2.4; x < W * 2.4; x += L * 0.7) { ctx.beginPath(); ctx.ellipse(x + Math.sin(pt * 1.5 + x) * L * 0.1, D + L * 0.06, L * 0.2, L * 0.04, 0, 0, TAU); ctx.fill(); } }
        for (const b of fight.platforms) {
          const h = mode === 'aerial' ? b.y1 - b.y0 : D;
          ctx.fillStyle = board; ctx.fillRect(b.x0, b.y0, b.x1 - b.x0, h);
          ctx.fillStyle = pal.coral; ctx.fillRect(b.x0, b.y0, b.x1 - b.x0, L * 0.06);
          if (mode === 'aerial') { ctx.fillStyle = boardD; ctx.fillRect(b.x0 + (b.x1 - b.x0) * 0.2, b.y1, L * 0.1, D - b.y1); ctx.fillRect(b.x0 + (b.x1 - b.x0) * 0.75, b.y1, L * 0.1, D - b.y1); }
          else { ctx.fillStyle = boardD; for (let x = b.x0 + L * 0.3; x < b.x1; x += L * 0.6) ctx.fillRect(x, b.y0 + L * 0.06, L * 0.05, h); }
        }
      }
      // fighters, then the bits that fly off them
      for (let s = 0; s < 2; s++) {
        const f = F[s], rag = f.rag, c = s === 0 && mine ? A.a.c : null;
        const surf = fight.world.surfaceAt(rag.midX(), rag.midY() - 1);
        if (surf !== null) RB.art.drawShadow(ctx, rag.midX(), surf + 1, f.P.TL * 0.55);
        const o = c ? common.drawOpts(c) : { hat: A['ab'[s]] && A['ab'[s]].hat, clothes: A['ab'[s]] && A['ab'[s]].clothes };
        o.flash = flash[s] * 0.8;
        RB.art.drawCreature(ctx, f.P, rag.getPose(), o);
        if (rag.state === 'ko' || (rag.state === 'down' && f.hp < f.hpMax * 0.3)) {
          for (let i = 0; i < 3; i++) { const a = pt * 5 + i * TAU / 3; ctx.save(); ctx.translate(rag.head.x + Math.cos(a) * f.P.HR * 2.2, rag.head.y - f.P.HR * 1.8 + Math.sin(a) * f.P.HR * 0.6); ctx.scale(f.P.HR / 6, f.P.HR / 6); ctx.fillStyle = pal.mustard; ctx.beginPath(); for (let k = 0; k < 10; k++) { const r = k % 2 ? 2.2 : 5, b = k * Math.PI / 5; ctx.lineTo(Math.cos(b) * r, Math.sin(b) * r); } ctx.closePath(); ctx.fill(); ctx.restore(); }
        }
      }
      const fs = L * 0.07;
      for (const p of parts) {
        ctx.globalAlpha = clamp(p.life * 2, 0, 1);
        if (p.kind === 'text') { RB.props.label(ctx, p.str, p.x, p.y, 15 * p.size / z, p.col); continue; }
        ctx.fillStyle = p.col;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        if (p.kind === 'feather') { ctx.beginPath(); ctx.ellipse(0, 0, fs * 1.5 * p.size, fs * 0.5 * p.size, 0, 0, TAU); ctx.fill(); }
        else if (p.kind === 'star') { ctx.beginPath(); for (let k = 0; k < 10; k++) { const r = (k % 2 ? 0.45 : 1) * fs * 1.6, b = k * Math.PI / 5; ctx.lineTo(Math.cos(b) * r, Math.sin(b) * r); } ctx.closePath(); ctx.fill(); }
        else { ctx.beginPath(); ctx.arc(0, 0, fs * 1.4 * p.size * p.life, 0, TAU); ctx.fill(); }
        ctx.restore();
      }
      ctx.globalAlpha = 1;
      ctx.restore();

      // ---- health, wind and nerve for each corner
      const bw = Math.min(250, (v.w - 90) / 2);
      for (let s = 0; s < 2; s++) {
        const f = F[s], x = s ? v.w - 8 - bw : 8, al = s ? 'right' : 'left', tx = s ? x + bw - 8 : x + 8;
        ui.panel(x, 6, bw, 62, { r: 10 });
        ui.text(f.name, tx, 22, { size: 14, align: al, maxW: bw - 16 });
        ui.bar(x + 8, 28, bw - 16, 11, f.hp / f.hpMax, pal.coral);
        ui.bar(x + 8, 43, bw - 16, 7, f.stam / f.stamMax, pal.teal);
        ui.bar(x + 8, 54, bw - 16, 5, f.morale / 100, pal.mustard);
        for (const b of bubbles) if (b.side === s) { const w = ui.width(b.str, 13) + 20, bx = s ? v.w - 8 - w : 8; ui.rect(bx, 74, w, 26, b.ok ? pal.ink : pal.grey, 13); ui.text(b.str, bx + w / 2, 87.5, { size: 13, color: pal.white, align: 'center', base: 'middle' }); }
      }
      const left = Math.max(0, Math.ceil(fight.timeLimit - fight.t));
      ui.rect(v.w / 2 - 26, 8, 52, 30, pal.ink, 10); ui.text(String(left), v.w / 2, 23.5, { size: 17, color: pal.white, align: 'center', base: 'middle' });
      const modeName = { pit: 'Pit fight', push: 'Push-out', aerial: 'Aerial bout' }[mode];
      ui.text(modeName, v.w / 2, 52, { size: 11, align: 'center', color: dark ? pal.white : pal.ink });
      if (phase !== 'end' && ui.btn(v.w / 2 - 26, 58, 52, 26, 'x' + speed, { fill: pal.grey, size: 12, flat: true })) { speed = speed === 1 ? 2 : speed === 2 ? 4 : 1; RB.game.settings.fast = speed > 1; RB.save.setSettings(RB.game.settings); }

      if (phase === 'intro') {
        const k = clamp(pt * 3, 0, 1), y = v.h * 0.42;
        ui.rect(0, y - 44, v.w, 88, 'rgba(35,49,74,' + 0.85 * k + ')');
        ui.text(F[0].name, v.w / 2 - 34 - (1 - k) * 200, y + 8, { size: 24, color: pal.white, align: 'right', maxW: v.w / 2 - 50 });
        ui.text('vs', v.w / 2, y + 6, { size: 18, color: pal.mustard, align: 'center' });
        ui.text(F[1].name, v.w / 2 + 34 + (1 - k) * 200, y + 8, { size: 24, color: pal.white, maxW: v.w / 2 - 50 });
        if (A.b.trainer) ui.text('trained by ' + A.b.trainer, v.w / 2 + 34, y + 28, { size: 11, color: pal.sand, bold: false });
      } else if (phase === 'fight' && mine && !fight.over) {
        // the three commands, with their cooldowns
        const me = F[0], n = CMD.length, cw = Math.min(118, (v.w - 78) / n), x0 = (v.w - (cw * n + (n - 1) * 6) - 52) / 2, y = v.h - 58;
        CMD.forEach((c, i) => {
          const cd = me.cmdCd[c[0]], x = x0 + i * (cw + 6);
          if (ui.btn(x, y, cw, 50, c[1], { icon: c[2], fill: c[3], color: c[0] === 'whistle' ? pal.ink : pal.white, disabled: cd > 0, size: 13 })) fight.command(0, c[0]);
          if (cd > 0) ui.bar(x + 6, y + 42, cw - 12, 4, 1 - cd / RB.fight.CMD_CD[c[0]], pal.ink);
        });
        if (ui.btn(x0 + n * (cw + 6), y, 46, 50, '', { icon: 'flag', fill: pal.paper, iconCol: pal.ink })) ui.confirm('Throw in the towel?', 'You lose the bout, but ' + me.name + ' walks away without a daze.', 'Give up', () => fight.command(0, 'towel'));
        if (pt < 6) ui.text('Your bird fights on its own. Shout when it helps.', v.w / 2, v.h - 68, { size: 11, align: 'center', color: dark ? pal.white : pal.ink });
      } else if (phase === 'fight' && !mine) {
        if (ui.btn(v.w - 96, v.h - 50, 88, 40, 'Skip', { fill: pal.grey })) { fight.run(); fight.done = true; }
      } else if (phase === 'end') {
        const r = fight.result, w = F[r.winner], won = mine && r.winner === 0;
        const box = ui.window(w.name + ' wins', 340, 150 + lines.length * 24, { close: false, head: !mine ? pal.ink : won ? pal.teal : pal.brick });
        ui.text(HOW[r.how] + ', in ' + Math.round(r.t) + ' s', box.x, box.y + 12, { size: 13, bold: false });
        lines.forEach((ln, i) => {
          const y = box.y + 38 + i * 24;
          ui.text(ln[0], box.x, y, { size: 13 });
          if (ln[1]) ui.text((ln[1] > 0 ? '+$' : '-$') + Math.abs(ln[1]), box.x + box.w, y, { size: 14, align: 'right', color: ln[1] > 0 ? pal.teal : pal.coral });
        });
        if (ui.btn(box.x + box.w / 2 - 80, box.y + box.h - 42, 160, 42, 'Continue', { key: 'Enter' })) {
          const card = A.card || {};
          const prize = (A.prizes || [])[0], PRIZE_TEXT = {
            silvernet: 'Old Bira takes a net off his belt, silver and worn smooth. "Never lost a bird with this, never lost the net either. It always finds its way back." It holds just like a plain net, and it never runs out.',
            goldshovel: 'Dona Zefa hands over a golden shovel. "My grandfather dug half this county with it." It digs ten holes a day, every day, and never wears out. Your other shovels take over when it is done for the day.',
          };
          if (prize) ui.message(RB.items.ITEMS[prize].name, PRIZE_TEXT[prize], () => RB.game.go(A.back || 'coop', A.backArgs), { head: pal.mustard });
          else if (mine && card.boss && r.winner === 0 && A.arena.boss.final) ui.message('Champion!', 'Madame Plume hands over the belt without a word. ' + F[0].name + ' crows until the lights go out.\n\nThe Grand Ring is yours. If Big Wattle still has his hand out, the bank is open. Either way the map, the lab and every strange egg are still there.', () => RB.game.go(A.back || 'coop', A.backArgs), { head: pal.mustard });
          else RB.game.go(A.back || 'coop', A.backArgs);
        }
      }
      void S; void lerp;
    },
    debug() { return { fight, phase }; },
  };
})();
