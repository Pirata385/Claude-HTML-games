/* Mine creatures and bosses: Matter bodies with small brains, drawn as outlines (the renderer makes them ASCII). */
(function (root) {
  'use strict';
  const PA = root.PA = root.PA || {};
  const C = PA.C;
  const DEFS = {
    smudge: { shape: 'circle', r: 10, hp: 20, touch: 8, drop: [['ink', 0.25], ['graphite', 0.3]] },
    bat: { shape: 'circle', r: 7, hp: 12, touch: 6, fly: true, drop: [['graphite', 0.2]] },
    spider: { shape: 'rect', w: 22, h: 10, hp: 26, touch: 8, drop: [['fiber', 0.5], ['quartz', 0.1]] },
    mite: { shape: 'rect', w: 14, h: 8, hp: 16, touch: 5, drop: [['graphite', 0.5]] },
    crumple: { shape: 'circle', r: 12, hp: 30, touch: 10, drop: [['fiber', 0.4], ['ink', 0.15]] },
    golem: { shape: 'rect', w: 28, h: 44, hp: 85, touch: 16, heavy: true, drop: [['inkstone', 0.4], ['iron_ore', 0.6]] },
    coffee: { shape: 'circle', r: 40, hp: 320, touch: 14, boss: 'Coffee Stain', drop: [['gold_bar', 1], ['quartz', 1]] },
    scissors: { shape: 'rect', w: 36, h: 46, hp: 420, touch: 18, boss: 'Scissor Knight', drop: [['gold_bar', 1], ['inkstone', 1]] },
    eraser: { shape: 'rect', w: 56, h: 34, hp: 600, touch: 20, boss: 'The Eraser', drop: [['gold_bar', 1], ['torn_page', 1]] },
  };
  const E = PA.Enemies = {
    DEFS, list: [], fx: [],
    clear(game) { for (const e of E.list) if (e.body) game.matter.world.remove(e.body); E.list = []; E.fx = []; },
    load(game, map) { E.clear(game); for (const d of map.enemies) E.spawn(game, d.kind, (d.x + 0.5) * C.CELL_W, d.z, d.boss); },
    spawn(game, kind, x, z, boss) {
      const D = DEFS[kind], M = game.matter, g = game.map.grid;
      const y = g.surfaceY(Math.floor(x / C.CELL_W), z) * C.CELL_H - (D.r || D.h / 2) - 4 - (D.fly ? 50 : 0);
      const opts = { friction: 0.3, frictionAir: D.fly ? 0.05 : 0.01, restitution: kind === 'crumple' ? 0.6 : 0.1, density: D.heavy || D.boss ? 0.006 : 0.0018, collisionFilter: PA.filters.enemy(z), label: 'enemy' };
      const body = D.shape === 'circle' ? M.add.circle(x, y, D.r, opts) : M.add.rectangle(x, y, D.w, D.h, Object.assign({ inertia: kind === 'golem' || D.boss ? Infinity : undefined }, opts));
      if (D.fly) body.ignoreGravity = true;
      const e = { kind, D, hp: D.hp, maxHp: D.hp, body, z, t: Math.random() * 3, cool: 1, touch: D.touch, flash: 0, boss: !!boss, facing: -1 };
      body.enemy = e;
      E.list.push(e);
      return e;
    },
    setZ(e, z) { e.z = z; e.body.collisionFilter = PA.filters.enemy(z); },
    step(game, dt) {
      if (!E.list.length && !E.fx.length) return;
      const p = game.player, M = game.matter, g = game.map.grid, sec = dt / 1000;
      for (const e of [...E.list]) {
        const b = e.body, D = e.D;
        e.t += sec; e.cool -= sec; e.flash = Math.max(0, e.flash - sec);
        const dx = p.x - b.position.x, dy = (p.feet - 40) - b.position.y, dist = Math.hypot(dx, dy);
        e.facing = Math.sign(dx) || e.facing;
        const same = e.z === p.z, aware = dist < (D.boss ? 900 : 360);
        // step into the player's slice when close (creatures of the page move in depth too)
        if (!same && aware && Math.abs(dx) < 120 && e.cool < 0 && !D.fly) { const nz = e.z + Math.sign(p.z - e.z), cx = Math.floor(b.position.x / C.CELL_W); if (Math.abs(g.surfaceY(cx, nz) - g.surfaceY(cx, e.z)) <= 1) { E.setZ(e, nz); e.cool = 1.5; } }
        if (D.fly && !same && aware && e.cool < 0) { E.setZ(e, p.z); e.cool = 2; }
        const v = b.velocity;
        switch (e.kind) {
          case 'smudge': if (aware && e.cool < 0 && same) { M.body.setVelocity(b, { x: Math.sign(dx) * 3.2, y: -6.5 }); e.cool = 1.2 + Math.random(); } break;
          case 'bat': if (aware) { const tx = dx + Math.sin(e.t * 4) * 40, ty = dy - 20 + Math.cos(e.t * 3) * 25; M.body.setVelocity(b, { x: PA.U.clamp(v.x + Math.sign(tx) * 0.12, -2.6, 2.6), y: PA.U.clamp(v.y + Math.sign(ty) * 0.12, -2.2, 2.2) }); } else M.body.setVelocity(b, { x: Math.sin(e.t) * 0.6, y: Math.cos(e.t * 1.3) * 0.4 }); break;
          case 'spider': if (aware && same) { M.body.setVelocity(b, { x: Math.sign(dx) * 1.8, y: v.y }); if (e.cool < 0 && Math.abs(dx) < 90) { M.body.setVelocity(b, { x: Math.sign(dx) * 4, y: -7 }); e.cool = 2; } } break;
          case 'mite': {
            const prey = PA.Drawn.live.find((d) => d.rec.z === e.z && d.body && Math.abs(d.body.position.x - b.position.x) < 400);
            const tx = prey ? prey.body.position.x - b.position.x : dx;
            M.body.setVelocity(b, { x: Math.sign(tx) * 2.2, y: v.y });
            if (prey && Math.hypot(prey.body.position.x - b.position.x, prey.body.position.y - b.position.y) < Math.max(prey.rec.w, prey.rec.h) / 2 + 12 && prey.rec.medium !== 'pen') { PA.Drawn.remove(game, prey); PA.UI.toast('An eraser mite ate your drawing!'); }
            break;
          }
          case 'crumple': if (aware && same) M.body.setAngularVelocity(b, PA.U.clamp(b.angularVelocity + Math.sign(dx) * 0.01, -0.25, 0.25)); break;
          case 'golem': if (aware && same) { M.body.setVelocity(b, { x: Math.sign(dx) * 0.9, y: v.y }); if (Math.abs(dx) < 50 && e.cool < 0) { E.punch(game, e); e.cool = 1.8; } } break;
          case 'coffee':
            if (e.cool < 0) { M.body.setVelocity(b, { x: Math.sign(dx) * 4.5, y: -9 }); e.cool = 1.6; }
            if (e.hp < e.maxHp * 0.5 && !e.split) { e.split = true; for (let i = 0; i < 4; i++) E.spawn(game, 'smudge', b.position.x + (i - 1.5) * 30, e.z); PA.UI.toast('The Coffee Stain splashes apart!'); }
            break;
          case 'scissors':
            if (e.cool < 0) { if (Math.random() < 0.35 && game.map.grid.d > 1) { E.setZ(e, PA.U.clamp(p.z + (Math.random() < 0.5 ? -1 : 1), 0, g.d - 1)); } M.body.setVelocity(b, { x: Math.sign(dx) * 8, y: -2 }); e.cool = 1.4; e.snap = 0.3; }
            if (e.snap > 0) e.snap -= sec;
            if (!same && e.cool < 0.6) E.setZ(e, p.z);
            break;
          case 'eraser':
            M.body.setVelocity(b, { x: Math.sign(dx) * 1.3, y: v.y });
            if (e.cool < 0) { E.erase(game, e); e.cool = 3.2; }
            break;
          default:
        }
        if (b.position.y > g.h * C.CELL_H + 200) { M.world.remove(b); E.list.splice(E.list.indexOf(e), 1); }
      }
      for (const f of E.fx) { f.t -= sec; f.y += f.vy * dt / 16.7; f.vy += 0.2; f.x += f.vx * dt / 16.7; }
      E.fx = E.fx.filter((f) => f.t > 0);
    },
    punch(game, e) {
      const p = game.player;
      if (p.z === e.z && Math.abs(p.x - e.body.position.x) < 60) PA.Combat.hurtPlayer(game, e.D.touch, e.body.position.x);
      game.shake = 0.6;
    },
    /** The Eraser rubs out the ground near you (draw platforms to survive). */
    erase(game, e) {
      const g = game.map.grid, p = game.player, cx = Math.floor(p.x / C.CELL_W), z = p.z;
      const fy = g.surfaceY(cx, z);
      for (let x = cx - 3; x <= cx + 3; x++) for (let y = fy; y < fy + 3; y++) if (y < g.h - 2 && g.get(x, y, z) !== PA.T.BEDROCK) g.set(x, y, z, PA.T.AIR);
      for (const d of [...PA.Drawn.live]) if (d.rec.z === z && d.body && Math.abs(d.body.position.x - p.x) < 140 && d.rec.medium !== 'pen') PA.Drawn.remove(game, d);
      PA.UI.toast('The Eraser rubs out the floor!');
      PA.Bus.emit('erase'); game.shake = 1;
    },
    hurt(game, e, dmg, vx, vy) {
      if (dmg <= 0 || e.dead) return;
      e.hp -= dmg; e.flash = 0.25;
      const M = game.matter, b = e.body, push = e.boss ? 0.25 : e.D.heavy ? 0.5 : 1;
      M.body.setVelocity(b, { x: b.velocity.x + PA.U.clamp(vx, -9, 9) * push, y: b.velocity.y + PA.U.clamp(vy, -9, 9) * push - 2 * push });
      E.fx.push({ txt: String(dmg), x: b.position.x, y: b.position.y - 20, vx: 0, vy: -1.2, t: 0.7, z: e.z });
      PA.Bus.emit('hit', { dmg, boss: e.boss });
      if (e.hp <= 0) E.kill(game, e);
    },
    kill(game, e) {
      e.dead = true;
      const b = e.body, s = game.state;
      game.matter.world.remove(b);
      E.list.splice(E.list.indexOf(e), 1);
      for (let i = 0; i < 8; i++) E.fx.push({ dot: true, x: b.position.x, y: b.position.y, vx: (Math.random() - 0.5) * 6, vy: -Math.random() * 5, t: 0.8, z: e.z });
      for (const [id, ch] of e.D.drop) if (Math.random() < ch) game.inv.add(id, 1);
      PA.Bus.emit('kill', { kind: e.kind, boss: e.boss });
      if (e.boss) {
        game.map.bossDead = true;
        s.flags['boss_' + e.kind] = true;
        s.gold += 1000 * (game.map.floor / 10);
        const w = { coffee: 'shield', scissors: 'spear', eraser: 'boomerang' }[e.kind];
        if (w && !s.words.includes(w)) s.words.push(w);
        PA.UI.toast(e.D.boss + ' is defeated! +' + 1000 * (game.map.floor / 10) + 'g' + (w ? ', new word: ' + PA.Words.get(w).name : ''), 5000);
        if (game.map.floor < 30) game.map.props.push({ type: 'mineLadder', x: game.map.spots.down.x, z: 2, gy: game.map.grid.surfaceY(game.map.spots.down.x, 2), up: false });
        game.world.indexProps();
      }
    },
    explode(game, x, y, z) {
      for (const e of [...E.list]) if (e.z === z && Math.hypot(e.body.position.x - x, e.body.position.y - y) < 90) E.hurt(game, e, 45, (e.body.position.x - x) / 6, -6);
    },
    draw(R, z, p, st) {
      if (p.level < 0 || (!E.list.length && !E.fx.length)) return;
      const ctx = R.ctx;
      R.use(p);
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      for (const e of E.list) {
        if (e.z !== z) continue;
        const b = e.body, D = e.D;
        ctx.save(); ctx.translate(b.position.x, b.position.y); ctx.rotate(e.kind === 'crumple' ? b.angle : 0); ctx.scale(e.facing || 1, 1);
        ctx.lineWidth = st.lw * (e.flash > 0 ? 2 : 1); ctx.strokeStyle = st.ink; ctx.fillStyle = st.paper;
        ctx.beginPath();
        const r = D.r || 10, t = e.t;
        switch (e.kind) {
          case 'smudge': case 'coffee': {
            for (let i = 0; i <= 16; i++) { const a = i / 16 * Math.PI * 2, rr = r * (1 + Math.sin(a * 5 + t * 3) * 0.08); i ? ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr * 0.85) : ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr * 0.85); }
            ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.beginPath();
            ctx.moveTo(r * 0.35 + 2, -r * 0.2); ctx.arc(r * 0.35, -r * 0.2, 2, 0, Math.PI * 2); ctx.moveTo(r * 0.05 + 2, -r * 0.2); ctx.arc(r * 0.05, -r * 0.2, 2, 0, Math.PI * 2);
            if (e.kind === 'coffee') { ctx.moveTo(-r * 0.6, r * 0.4); ctx.lineTo(-r * 0.62, r * 1.1); ctx.moveTo(r * 0.2, r * 0.5); ctx.lineTo(r * 0.18, r * 1.0); }
            break;
          }
          case 'bat': { const f = Math.sin(t * 16) * 6; ctx.ellipse(0, 0, 5, 4, 0, 0, Math.PI * 2); ctx.moveTo(-4, 0); ctx.lineTo(-14, -6 + f); ctx.lineTo(-8, 2); ctx.moveTo(4, 0); ctx.lineTo(14, -6 + f); ctx.lineTo(8, 2); break; }
          case 'spider': { ctx.ellipse(0, 0, 9, 5, 0, 0, Math.PI * 2); for (let i = -2; i <= 2; i++) { if (!i) continue; const k = Math.sin(t * 10 + i) * 2; ctx.moveTo(i * 3, 2); ctx.lineTo(i * 7, -4 + k); ctx.lineTo(i * 10, 6); } break; }
          case 'mite': { ctx.rect(-7, -4, 14, 8); ctx.moveTo(7, -2); ctx.lineTo(10, 0); ctx.lineTo(7, 2); for (const lx of [-5, 0, 5]) { ctx.moveTo(lx, 4); ctx.lineTo(lx + Math.sin(t * 14 + lx) * 2, 7); } break; }
          case 'crumple': { for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2, rr = r * (i % 2 ? 0.8 : 1.05); i ? ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); } ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.beginPath(); ctx.moveTo(-6, -2); ctx.lineTo(3, 4); ctx.moveTo(-2, -7); ctx.lineTo(4, -1); break; }
          case 'golem': { ctx.rect(-12, -22, 24, 26); ctx.rect(-8, -34, 16, 12); ctx.moveTo(-12, -16); ctx.lineTo(-18, 2); ctx.moveTo(12, -16); ctx.lineTo(18, 2); ctx.moveTo(-6, 4); ctx.lineTo(-6, 22); ctx.moveTo(6, 4); ctx.lineTo(6, 22); ctx.fill(); ctx.stroke(); ctx.beginPath(); ctx.moveTo(4, -28); ctx.lineTo(7, -28); break; }
          case 'scissors': { const o = e.snap > 0 ? 0.1 : 0.5 + Math.sin(t * 3) * 0.2; ctx.save(); ctx.rotate(-o); ctx.moveTo(0, 0); ctx.lineTo(30, -4); ctx.lineTo(0, 4); ctx.restore(); ctx.save(); ctx.rotate(o); ctx.moveTo(0, 0); ctx.lineTo(30, 4); ctx.lineTo(0, -4); ctx.restore(); ctx.moveTo(-6, 0); ctx.arc(-12, -8, 6, 0, Math.PI * 2); ctx.moveTo(-6, 12); ctx.arc(-12, 8, 6, 0, Math.PI * 2); break; }
          case 'eraser': { ctx.rect(-28, -17, 56, 34); ctx.moveTo(-28, 0); ctx.lineTo(28, 0); ctx.fill(); ctx.stroke(); ctx.beginPath(); ctx.moveTo(10, -8); ctx.arc(8, -8, 3, 0, Math.PI * 2); ctx.moveTo(22, -8); ctx.arc(20, -8, 3, 0, Math.PI * 2); ctx.moveTo(4, 8); ctx.lineTo(24, 8); break; }
          default:
        }
        ctx.stroke(); ctx.restore();
        if (e.boss && p.level === 0) {
          const k = Math.round(e.hp / e.maxHp * 20);
          R.stampText(R.cellW * 4, R.cellH * 5, D.boss + ' [' + '#'.repeat(Math.max(0, k)) + '-'.repeat(20 - Math.max(0, k)) + ']', { style: 1, pri: 6 });
        }
      }
      for (const f of E.fx) {
        if (f.z !== z) continue;
        if (f.dot) { ctx.beginPath(); ctx.arc(f.x, f.y, 2, 0, Math.PI * 2); ctx.fillStyle = st.ink; ctx.fill(); }
        else R.stampText(p.ox + f.x * p.scale, p.oy + f.y * p.scale, f.txt, { style: 1, pri: 6 });
      }
    },
  };
})(typeof window !== 'undefined' ? window : globalThis);
