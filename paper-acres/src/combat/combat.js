/* Physical combat: weapons are bodies swept through the air; damage comes from how hard they hit. */
(function (root) {
  'use strict';
  const PA = root.PA = root.PA || {};
  const C = PA.C;
  const WEAPONS = {
    sword: { len: 34, thick: 4, mass: 1, dur: 260, base: 7, arc: 2.6 },
    hammer: { len: 28, thick: 12, mass: 2.4, dur: 480, base: 9, arc: 2.4 },
    spear: { len: 50, thick: 3, mass: 1.2, dur: 320, base: 8, arc: 0.6, thrust: true },
    boomerang: { len: 18, thick: 6, mass: 0.8, dur: 900, base: 6, thrown: true },
  };
  const Combat = PA.Combat = {
    WEAPONS,
    /** Damage from relative impact speed (px/step) and weapon mass. */
    damage(speed, mass, base) { const v = speed - 0.8; if (v <= 0) return 0; return Math.round((base || 6) * v * 0.45 * Math.sqrt(mass)); },
    weaponOf(slot) {
      if (!slot) return null;
      if (slot.id === 'sword') return Object.assign({ lvl: (slot.extra && slot.extra.lvl) || 0 }, WEAPONS.sword);
      if (slot.id === 'drawn') { const w = slot.extra.word; if (WEAPONS[w]) return Object.assign({ drawn: true }, WEAPONS[w]); if (w === 'sword') return Object.assign({ drawn: true, base: 9 }, WEAPONS.sword); }
      return null;
    },
    aim(game) {
      const p = game.player, inp = PA.Input;
      if (inp.virt.aim != null) return inp.virt.aim;
      if (PA.Input.pointer.moved && game.proj && game.proj[p.z]) {
        const pr = game.proj[p.z], dpr = PA.dpr();
        const sx = pr.ox + p.x * pr.scale, sy = pr.oy + (p.feet - 50) * pr.scale;
        return Math.atan2(PA.Input.pointer.y * dpr - sy, PA.Input.pointer.x * dpr - sx);
      }
      return p.facing > 0 ? 0.25 : Math.PI - 0.25;
    },
    swing(game, slot) {
      const p = game.player, s = game.state;
      if (slot.id === 'drawn' && slot.extra.shield) { PA.UI.toast('Hold the shield selected: it blocks hits from the front.'); return false; }
      const w = Combat.weaponOf(slot);
      if (!w || p.action) return false;
      if (s.energy < 2) { PA.UI.toast('Too tired to swing.'); return false; }
      s.energy -= 1;
      let aim = Combat.aim(game);
      const fwd = Math.cos(aim) >= 0 ? 1 : -1;
      p.facing = fwd;
      const local = fwd > 0 ? aim : Math.PI - aim; // aim in the figure's own (right-facing) frame
      p.action = { kind: 'weapon', t: 0, dur: w.dur, progress: 0, applied: true, aim: PA.U.clamp(local, -1.4, 1.2), w };
      const M = game.matter;
      const body = M.add.rectangle(p.x, p.feet - 50, w.len, w.thick, { density: 0.004 * w.mass, frictionAir: 0, collisionFilter: PA.filters.weapon(p.z), label: 'weapon' });
      body.ignoreGravity = true; body.weapon = w; body.hitSet = new Set();
      p.action.body = body;
      if (w.thrown) { p.action.thrown = { out: true, x: p.x, y: p.feet - 50, vx: Math.cos(aim) * 7, vy: Math.sin(aim) * 7 }; }
      PA.Bus.emit('swing', { tool: 'weapon' });
      return true;
    },
    /** Called every physics step while a weapon action runs: sweep the body along the hand arc. */
    step(game, dt) {
      const p = game.player, a = p.action;
      if (!a || a.kind !== 'weapon') return;
      const M = game.matter, w = a.w, b = a.body, k = PA.Stick.SCALE;
      a.t += dt; a.progress = Math.min(1, a.t / a.dur);
      let x, y, ang;
      if (a.thrown) {
        const th = a.thrown;
        if (a.progress > 0.45) { const dx = p.x - th.x, dy = p.feet - 50 - th.y, d = Math.hypot(dx, dy) || 1; th.vx += dx / d * 0.9; th.vy += dy / d * 0.9; th.vx *= 0.96; th.vy *= 0.96; }
        th.x += th.vx * dt / 16.7; th.y += th.vy * dt / 16.7;
        x = th.x; y = th.y; ang = a.t / 40;
      } else {
        const rig = PA.Stick.rig('swing', 0, { progress: a.progress, aim: a.aim });
        const hx = p.x + rig.handR.x * k * p.facing, hy = p.feet + rig.handR.y * k;
        const base = a.aim - 2.2 + PA.U.smooth(a.progress) * 3.0;
        ang = w.thrust ? a.aim : base;
        const reach = w.thrust ? (0.3 + Math.sin(a.progress * Math.PI) * 0.9) : 1;
        const dirX = Math.cos(ang) * p.facing, dirY = Math.sin(ang);
        x = hx + dirX * w.len * 0.5 * reach; y = hy + dirY * w.len * 0.5 * reach;
        ang = Math.atan2(dirY, dirX);
      }
      let vx = (x - b.position.x), vy = (y - b.position.y);
      if (!a.placed) { a.placed = true; vx = 0; vy = 0; } // first step: just put it in the hand
      M.body.setPosition(b, { x, y }); M.body.setAngle(b, ang); M.body.setVelocity(b, { x: PA.U.clamp(vx, -14, 14), y: PA.U.clamp(vy, -14, 14) });
      a.speed = Math.hypot(vx, vy);
      if (a.progress >= 1) { M.world.remove(b); p.action = null; }
    },
    /** Weapon/enemy contacts and enemy/player contacts. */
    onPairs(game, pairs) {
      for (const pair of pairs) {
        const A = pair.bodyA.parent || pair.bodyA, B = pair.bodyB.parent || pair.bodyB;
        const wpn = A.label === 'weapon' ? A : B.label === 'weapon' ? B : null;
        const en = A.enemy ? A : B.enemy ? B : null;
        if (wpn && en && !wpn.hitSet.has(en)) {
          wpn.hitSet.add(en);
          const rel = Math.min(12, Math.hypot(wpn.velocity.x - en.velocity.x, wpn.velocity.y - en.velocity.y));
          const dmg = Combat.damage(Math.max(rel, 3), wpn.weapon.mass, wpn.weapon.base + ((wpn.weapon.lvl || 0) * 3));
          PA.Enemies.hurt(game, en.enemy, dmg, wpn.velocity.x, wpn.velocity.y);
        }
        const pl = A.label === 'player' ? A : B.label === 'player' ? B : null;
        if (pl && en && en.enemy.touch) Combat.hurtPlayer(game, en.enemy.touch, en.position.x);
      }
    },
    hurtPlayer(game, dmg, fromX) {
      const p = game.player, s = game.state;
      if (p.iframes > 0 || !s) return;
      const sel = game.inv.slots[game.hot];
      if (sel && sel.id === 'drawn' && sel.extra.shield && Math.sign(fromX - p.x) === p.facing) { dmg = Math.ceil(dmg * 0.3); PA.Bus.emit('block'); }
      s.hp = Math.max(0, s.hp - dmg);
      p.iframes = 800; p.hurtT = 500;
      p.setVel(Math.sign(p.x - fromX || 1) * 5, -4.5);
      game.shake = Math.min(1, (game.shake || 0) + dmg / 25);
      PA.Bus.emit('hurt', { dmg });
      if (s.hp <= 0) Combat.faint(game);
    },
    faint(game) {
      const s = game.state;
      if (game.fainting) return;
      game.fainting = true;
      game.pageTurn(() => {
        const lost = Math.min(5000, Math.floor(s.gold * 0.1));
        s.gold -= lost;
        let gone = 0;
        game.inv.slots.forEach((sl, i) => { if (sl && i >= 9 && PA.Items.get(sl.id).cat !== 'tool' && Math.random() < 0.15) { sl.n = Math.floor(sl.n / 2); if (!sl.n) game.inv.slots[i] = null; gone++; } });
        s.hp = Math.floor(s.maxHp * 0.5); s.energy = Math.max(s.energy, Math.floor(s.maxEnergy * 0.3));
        s.time = Math.min(PA.Time.PASS_OUT - 60, s.time + 120);
        game.loadMap('clinic', 12, 0, 1);
        game.fainting = false;
        PA.UI.toast('You fainted. Dr. Sepia patched you up (-' + lost + 'g' + (gone ? ', some items lost' : '') + ').', 4500);
        PA.Bus.emit('inv');
      });
    },
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = Combat;
})(typeof window !== 'undefined' ? window : globalThis);
