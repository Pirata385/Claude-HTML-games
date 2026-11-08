// Niryk — the 16 hero abilities and their 48 passives. Each ability is cast(p, slot) with slot.mod:
// -1 = base ability, 0..2 = the chosen passive (only one per ability).
'use strict';
(function () {
  const N = window.N, S = N.S, G = N.G, TAU = Math.PI * 2;
  const AD = (base) => N.playerDmg(base, 'ability');
  const moveDir = (p) => { const m = N.input.moveVec(); return m.x || m.y ? Math.atan2(m.y, m.x) : p.aim; };

  // ---------------------------------------------------------------- casting & cooldowns
  N.castAbility = (p, i) => {
    const s = p.abil[i]; if (!s || G.state !== 'play') return;
    const imp = N.ABIL_IMPL[s.id];
    if (imp.recast && imp.recast(p, s)) return;
    if (s.charges <= 0 || p.control) { if (s.charges <= 0) N.sfx('deny'); return; }
    if (imp.cast(p, s) === false) return;
    s.charges--;
    s.cdMax = G.noCd ? 0.15 : N.ABILITIES[s.id].cd * (1 - p.stats.cdr);
    if (s.cd <= 0) s.cd = s.cdMax;
    s.flash = 0.25;
    G.abilUses = (G.abilUses || 0) + 1;
  };
  N.updateAbilities = (p, dt) => {
    for (const s of p.abil) {
      s.flash = Math.max(0, (s.flash || 0) - dt);
      if (s.charges < s.max) { s.cd -= dt; if (s.cd <= 0) { s.charges++; s.cd = s.charges < s.max ? s.cdMax : 0; } }
      const imp = N.ABIL_IMPL[s.id]; if (imp.update) imp.update(p, s, dt);
    }
  };
  const otherSlot = (p, s) => p.abil.find((x) => x !== s);

  // Dragon form basic attack (claws or, with Sopro Infernal, fire breath).
  N.dragonAttack = (p) => {
    const s = p.abil.find((x) => x.id === 'forma'), breath = s && s.mod === 0;
    const mx = p.x + p.face * 12, my = p.y - 10;
    if (breath) {
      p.atkCd = 1 / (9 * N.atkRate(p));
      for (let i = 0; i < 2; i++) {
        const r = N.playerDmg(2.4, 'melee');
        N.shoot({ x: mx, y: my, a: p.aim + N.rand(-0.32, 0.32), speed: N.rand(150, 210), dmg: r.dmg, crit: r.crit, team: 'p', spr: S.proj.fireball, life: 0.42, pierce: 2, burn: true, proc: true, r: 4, alpha: 0.9 });
      }
      if (Math.random() < 0.3) N.sfx('magic');
    } else {
      p.atkCd = 1 / (2.2 * N.atkRate(p));
      N.sfx('heavy');
      N.meleeArc(p.x + p.face * 6, p.y - 6, p.aim, 2.6, 34, 13, 140, '#ff8a3a', true);
    }
  };

  const I = N.ABIL_IMPL = {};

  // ================================================================ EMBERIAN
  I.forma = {
    cast(p, s) {
      if (p.form) return false;
      p.form = 'dragon'; p.formT = 7; p.r = 7;
      N.sfx('roar'); N.shake(5); N.spark(p.x, p.y - 8, '#ff8a3a', 24, 110, 0.6, 2);
      if (s.mod === 1) N.healPlayer(2);
      if (s.mod === 2) blast(p);
    },
    update(p, s, dt) {
      if (p.form !== 'dragon') return;
      p.formT -= dt;
      if (Math.random() < 0.25) N.part(p.x + N.rand(-10, 10), p.y - N.rand(4, 18), 0, -20, '#ff8a3a', 0.4, 1);
      if (p.formT <= 0) { p.form = null; p.r = 5; N.spark(p.x, p.y - 8, '#ffffff', 16, 80); N.sfx('ability'); if (s.mod === 2) blast(p); }
    },
    onKill(p, s) { if (p.form === 'dragon' && s.mod === 1) p.formT += 1; },
  };
  function blast(p) { N.explosion(p.x, p.y - 4, 50, '#ff6a2a'); N.sfx('explode'); N.shake(6); const r = AD(25); N.areaDamage(p.x, p.y, 52, r.dmg, { crit: r.crit, knock: 220, burn: true }); }

  I.rugido = {
    cast(p, s) {
      const R = s.mod === 1 ? 90 : 56;
      N.sfx('roar'); N.shake(4);
      for (let i = 0; i < 3; i++) N.delayed(i * 0.08, () => N.ringFx(p.x, p.y - 6, R, s.mod === 0 ? '#ff6a2a' : '#ffb03a', 0.4, 3));
      const r = AD(6);
      N.areaDamage(p.x, p.y, R, r.dmg, { crit: r.crit, knock: 200, stun: s.mod === 1 ? 2.5 : 1, burn: s.mod === 0 });
      if (s.mod === 2) {
        for (const b of G.projs) if (b.team === 'e' && Math.hypot(b.x - p.x, b.y - p.y) < R) { b.dead = true; N.spark(b.x, b.y, '#ffb03a', 3, 40); }
        p.shield = Math.min(p.maxShield + 2, p.shield + 2); N.sfx('shield');
      }
    },
  };

  I.investida = {
    charges: (s) => (s.mod === 1 ? 2 : 1),
    cast(p, s) {
      const a = moveDir(p), hit = new Set(); let t = 0, trail = 0;
      p.buffs.invuln = 0.32; N.sfx('dash'); p.face = Math.cos(a) >= 0 ? 1 : -1;
      p.control = (dt) => {
        t += dt; const step = 360 * dt;
        N.moveEnt(p, Math.cos(a) * step, Math.sin(a) * step);
        trail += step;
        N.part(p.x + N.rand(-4, 4), p.y - N.rand(0, 10), -Math.cos(a) * 40, -Math.sin(a) * 40, Math.random() < 0.5 ? '#ff6a2a' : '#ffe066', 0.35, 2);
        if (s.mod === 0 && trail > 10) { trail = 0; N.fireZone(p.x, p.y, 9, 3); }
        for (const e of G.enemies) if (e.alive && !e.intangible && !hit.has(e) && Math.hypot(e.x - p.x, e.y - p.y) < e.r + 10) { hit.add(e); const r = AD(9); N.hurtEnemy(e, r.dmg, { crit: r.crit, knock: 160, ax: p.x - Math.cos(a) * 10, ay: p.y - Math.sin(a) * 10, burn: true }); }
        if (t >= 0.28) {
          p.control = null;
          if (s.mod === 2) { N.explosion(p.x, p.y - 4, 38, '#ff6a2a'); N.sfx('explode'); N.shake(4); const r = AD(16); N.areaDamage(p.x, p.y, 40, r.dmg, { crit: r.crit, knock: 180, burn: true }); }
        }
      };
    },
  };

  I.pancada = {
    cast(p, s) {
      const x0 = p.x, y0 = p.y, tgt = s.mod === 2 ? N.aimPoint(p, 130) : { x: p.x, y: p.y };
      const dur = s.mod === 2 ? 0.55 : 0.4; let t = 0;
      N.sfx('dash');
      p.control = (dt) => {
        t += dt; const k = Math.min(1, t / dur);
        p.air = Math.sin(k * Math.PI) * (s.mod === 2 ? 34 : 20);
        if (s.mod === 2) { const nx = N.lerp(x0, tgt.x, k), ny = N.lerp(y0, tgt.y, k); N.moveEnt(p, nx - p.x, ny - p.y); }
        if (k >= 1) {
          p.air = 0; p.control = null;
          N.sfx('slam'); N.shake(6);
          N.ringFx(p.x, p.y, 64, '#ffcf7a', 0.4, 3); N.spark(p.x, p.y, '#c8a070', 18, 120, 0.5, 2);
          const r = AD(14); N.areaDamage(p.x, p.y, 64, r.dmg, { crit: r.crit, knock: 170 });
          if (s.mod === 0) for (let i = 1; i <= 3; i++) N.delayed(i * 0.35, () => { N.ringFx(p.x, p.y, 50, '#ffcf7a', 0.35, 2); N.shake(2); N.sfx('slam'); const r2 = AD(7); N.areaDamage(p.x, p.y, 50, r2.dmg, { knock: 80 }); });
          if (s.mod === 1) { const cx = p.x, cy = p.y; for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; for (let d = 1; d <= 7; d++) { const x = cx + Math.cos(a) * d * 12, y = cy + Math.sin(a) * d * 12; if (N.solidPx(x, y)) break; N.delayed(d * 0.04, () => N.fireZone(x, y, 8, 2.5)); } } }
        }
      };
    },
  };

  // ================================================================ SYLVAR
  I.chuva = {
    cast(p, s) {
      const c = N.aimPoint(p, 150);
      N.sfx('arrow');
      if (s.mod === 2) {
        N.delayed(0.6, () => { N.explosion(c.x, c.y, 46, '#cfe8ff'); N.sfx('explode'); N.shake(6); const r = AD(40); N.areaDamage(c.x, c.y, 48, r.dmg, { crit: r.crit, knock: 200 }); },
          (ctx, k) => { ctx.strokeStyle = '#cfe8ff'; ctx.globalAlpha = 0.6; ctx.beginPath(); ctx.arc(c.x, c.y, 46, 0, TAU); ctx.stroke(); ctx.globalAlpha = 1; ctx.save(); ctx.translate(c.x, c.y - 120 * (1 - k) - 10); ctx.rotate(Math.PI / 2); ctx.scale(3, 3); ctx.drawImage(S.proj.arrow, -10, -2); ctx.restore(); });
        return;
      }
      const R = s.mod === 1 ? 52 : 40, n = s.mod === 1 ? 28 : 14, dur = s.mod === 1 ? 2.4 : 1.2;
      N.addFx({ life: dur + 0.3, draw: (ctx, k) => { ctx.strokeStyle = 'rgba(207,232,255,0.5)'; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.arc(c.x, c.y, R, 0, TAU); ctx.stroke(); ctx.setLineDash([]); } });
      for (let i = 0; i < n; i++) {
        const a = Math.random() * TAU, d = Math.sqrt(Math.random()) * R, x = c.x + Math.cos(a) * d, y = c.y + Math.sin(a) * d;
        N.delayed(0.15 + (i / n) * dur, () => { N.spark(x, y, '#cfe8ff', 3, 40); const r = AD(4); N.areaDamage(x, y, 10, r.dmg, { crit: r.crit, slow: s.mod === 0 ? 2 : 0 }); if (s.mod === 0) N.spark(x, y, '#9fe8ff', 3, 30); },
          (ctx, k) => { ctx.save(); ctx.translate(x, y - 70 * (1 - k)); ctx.rotate(Math.PI / 2); ctx.drawImage(S.proj.arrow, -10, -2); ctx.restore(); });
      }
    },
  };

  I.espirito = {
    cast(p, s) {
      N.sfx('magic');
      if (s.mod === 0) {
        const ent = { x: p.x + Math.cos(p.aim) * 14, y: p.y + Math.sin(p.aim) * 14, life: 12, hp: 60, maxHp: 60, taunt: true, r: 7, cd: 0,
          upd: (a, dt) => { a.cd -= dt; if (a.cd <= 0) { const e = N.nearestEnemy(a.x, a.y, 160, true); if (e) { a.cd = 0.6; const r = AD(4); N.shoot({ x: a.x, y: a.y - 8, a: Math.atan2(e.y - a.y + 8, e.x - a.x), speed: 200, dmg: r.dmg, crit: r.crit, team: 'p', spr: S.proj.seedP, life: 1.2, r: 3 }); } } },
          draw: (ctx, a) => { N.drawShadow(ctx, a.x, a.y + 2, 7); const spr = S.misc.ent[Math.floor(a.t * 3) % 2]; ctx.drawImage(spr, Math.round(a.x - spr.width / 2), Math.round(a.y - spr.height + 3)); bar(ctx, a); } };
        G.allies.push(ent); N.spark(ent.x, ent.y, '#7ed05a', 12, 50);
        return;
      }
      const n = s.mod === 1 ? 3 : 1;
      for (let i = 0; i < n; i++) {
        const w = { x: p.x, y: p.y, life: 12, hp: 1, off: i * TAU / n, cd: i * 0.2, small: n > 1,
          upd: (a, dt) => {
            const ang = a.t * 2.4 + a.off; a.x = N.lerp(a.x, p.x + Math.cos(ang) * 18, dt * 8); a.y = N.lerp(a.y, p.y - 10 + Math.sin(ang) * 10, dt * 8);
            a.cd -= dt;
            if (a.cd <= 0) { const e = N.nearestEnemy(a.x, a.y, 150, true); if (e) { a.cd = a.small ? 0.6 : 0.45; const r = AD(a.small ? 2 : 3); N.shoot({ x: a.x, y: a.y, a: Math.atan2(e.y - a.y, e.x - a.x), speed: 230, dmg: r.dmg, crit: r.crit, team: 'p', spr: S.proj.orb, life: 1, r: 3, slow: s.mod === 2 ? 1.5 : 0 }); } }
            if (Math.random() < 0.2) N.part(a.x, a.y, 0, 10, '#5fe3d6', 0.4, 1);
          },
          onEnd: () => { if (s.mod === 2) N.healPlayer(1); },
          draw: (ctx, a) => { const sc = a.small ? 0.75 : 1; ctx.drawImage(S.misc.wisp, Math.round(a.x - 5 * sc), Math.round(a.y - 5 * sc), 10 * sc, 10 * sc); } };
        G.allies.push(w);
      }
    },
  };
  function bar(ctx, a) { if (a.hp < a.maxHp) { ctx.fillStyle = '#170f1f'; ctx.fillRect(Math.round(a.x - 7), Math.round(a.y + 4), 14, 3); ctx.fillStyle = '#7cf07a'; ctx.fillRect(Math.round(a.x - 6), Math.round(a.y + 5), Math.ceil(12 * Math.max(0, a.hp) / a.maxHp), 1); } }

  I.passo = {
    charges: (s) => (s.mod === 1 ? 2 : 1),
    cast(p, s) {
      const a = N.input.usingTouch ? moveDir(p) : p.aim, ox = p.x, oy = p.y;
      let x = p.x, y = p.y;
      for (let d = 0; d < 84; d += 3) { const nx = ox + Math.cos(a) * d, ny = oy + Math.sin(a) * d; if (N.hitsWall(nx, ny, p.r * 0.8)) break; x = nx; y = ny; }
      N.spark(ox, oy - 6, '#5fe3d6', 14, 60); p.x = x; p.y = y; p.inv = Math.max(p.inv, 0.45); N.spark(p.x, p.y - 6, '#c0f4d0', 14, 60); N.sfx('magic');
      N.addFx({ life: 0.25, draw: (ctx, k) => { ctx.globalAlpha = 0.6 * (1 - k); ctx.strokeStyle = '#c0f4d0'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(ox, oy - 6); ctx.lineTo(x, y - 6); ctx.stroke(); ctx.globalAlpha = 1; } });
      if (s.mod === 0) {
        const spr = N.silhouette(S.ch[p.char][0], '#7ad8c8');
        G.allies.push({ x: ox, y: oy, life: 3, hp: 30, maxHp: 30, taunt: true, r: 6,
          onEnd: (d) => { N.explosion(d.x, d.y - 4, 34, '#5fe3d6'); N.sfx('explode'); const r = AD(15); N.areaDamage(d.x, d.y, 36, r.dmg, { crit: r.crit, knock: 150 }); },
          draw: (ctx, d) => { ctx.globalAlpha = 0.65 + Math.sin(d.t * 10) * 0.15; ctx.drawImage(spr, Math.round(d.x - 11), Math.round(d.y - 19)); ctx.globalAlpha = 1; bar(ctx, d); } });
      }
      if (s.mod === 2) for (const [cx, cy] of [[ox, oy], [x, y]]) for (let i = 0; i < 10; i++) { const r = AD(4); N.shoot({ x: cx, y: cy - 4, a: i / 10 * TAU, speed: 190, dmg: r.dmg, crit: r.crit, team: 'p', spr: S.proj.leaf, life: 0.55, pierce: 1, r: 3 }); }
    },
  };

  I.raizes = {
    cast(p, s) {
      const c = N.aimPoint(p, 150), R = 44;
      N.sfx('magic'); N.spark(c.x, c.y, '#7ed05a', 16, 70);
      const life = s.mod === 1 ? 6 : 2.5;
      N.addFx({ life, draw: (ctx, k) => {
        ctx.globalAlpha = Math.min(1, (1 - k) * 4) * 0.8;
        ctx.fillStyle = 'rgba(80,140,50,0.25)'; ctx.beginPath(); ctx.arc(c.x, c.y, R, 0, TAU); ctx.fill();
        ctx.strokeStyle = s.mod === 0 ? '#9aff4a' : '#5a9a3e'; ctx.lineWidth = 2;
        for (let i = 0; i < 9; i++) { const a = i * 0.7, d = (i * 37 % 10) / 10 * R; const x = c.x + Math.cos(a) * d, y = c.y + Math.sin(a) * d; ctx.beginPath(); ctx.moveTo(x, y + 3); ctx.quadraticCurveTo(x + 4, y - 4, x - 1, y - 9 - Math.sin(G.time * 4 + i) * 2); ctx.stroke(); }
        ctx.globalAlpha = 1;
      } });
      let caught = 0;
      const grab = (e) => { e.st.root = Math.max(e.st.root || 0, s.mod === 1 ? 0.7 : 2.5); e.st.rootDot = Math.max(e.st.rootDot || 0, s.mod === 1 ? 0.7 : 2.5); if (s.mod === 0) e.st.poison = 4; };
      for (const e of G.enemies) if (e.alive && !e.intangible && !e.boss && Math.hypot(e.x - c.x, e.y - c.y) < R + e.r) { grab(e); caught++; }
      const r = AD(4); N.areaDamage(c.x, c.y, R, r.dmg, { crit: r.crit });
      if (s.mod === 1) G.areas.push({ x: c.x, y: c.y, r: R, life: 6, tick: 0.4, onTick: (e) => { if (!e.boss) grab(e); } });
      if (s.mod === 2 && caught) { const add = Math.min(3, caught); p.shield = Math.min(p.maxShield + 3, p.shield + add); N.text(p.x, p.y - 20, '+' + add + ' escudo', '#9fd0ff'); N.sfx('shield'); }
    },
  };

  // ================================================================ KESTRUS
  I.tempestade = {
    cast(p, s) {
      const waves = s.mod === 0 ? 3 : 1;
      N.sfx('arrow'); p.spinT = 0.4;
      for (let w = 0; w < waves; w++) N.delayed(w * 0.18, () => {
        N.sfx('arrow');
        for (let i = 0; i < 16; i++) {
          const r = AD(5);
          N.shoot({ x: p.x, y: p.y - 6, a: i / 16 * TAU + w * 0.2, speed: 220, dmg: r.dmg, crit: r.crit, team: 'p', spr: S.proj.feather, life: s.mod === 1 ? 1.5 : 0.8, pierce: s.mod === 2 ? 3 : 0, bleed: s.mod === 2, boomerang: s.mod === 1 ? 0.38 : 0, owner: p, r: 3, curve: s.mod === 0 ? 1.2 : 0 });
        }
      });
    },
  };

  I.mergulho = {
    recast(p, s) {
      if (s.st.hover) { s.st.dive(); return true; }
      if (s.st.again > 0 && !p.control) { s.st.again = 0; dive(p, s, N.aimPoint(p, 140)); return true; }
      return false;
    },
    update(p, s, dt) { if (s.st.again > 0) s.st.again -= dt; },
    cast(p, s) {
      let t = 0; N.sfx('dash');
      if (s.mod === 0) {
        p.control = (dt) => {
          t += dt; p.air = Math.min(40, p.air + 200 * dt);
          const m = N.input.moveVec(); N.moveEnt(Object.assign(p, {}), m.x * 110 * dt, m.y * 110 * dt);
          p.moving = !!(m.x || m.y);
          if (Math.random() < 0.3) N.part(p.x + N.rand(-6, 6), p.y - p.air, 0, 20, '#cfe2ff', 0.4, 1);
          if (t >= 2.5) s.st.dive();
        };
        s.st.hover = true;
        s.st.dive = () => { s.st.hover = false; dive(p, s, N.input.usingTouch ? { x: p.x, y: p.y } : N.aimPoint(p, 60)); };
        return;
      }
      const tgt = N.aimPoint(p, 140);
      p.control = (dt) => { t += dt; p.air = Math.min(40, t / 0.3 * 40); if (t >= 0.3) dive(p, s, tgt); };
    },
  };
  function dive(p, s, tgt) {
    const x0 = p.x, y0 = p.y, z0 = Math.max(p.air, 20); let t = 0;
    p.control = (dt) => {
      t += dt; const k = Math.min(1, t / 0.18);
      N.moveEnt(p, N.lerp(x0, tgt.x, k) - p.x, N.lerp(y0, tgt.y, k) - p.y); p.air = z0 * (1 - k);
      if (k >= 1) {
        p.air = 0; p.control = null; p.inv = Math.max(p.inv, 0.2);
        N.sfx('slam'); N.shake(5); N.ringFx(p.x, p.y, 40, '#cfe2ff', 0.35, 3); N.spark(p.x, p.y, '#6f9ae0', 16, 100, 0.4, 2);
        const r = AD(18); N.areaDamage(p.x, p.y, 40, r.dmg, { crit: r.crit, knock: 180 });
        if (s.mod === 1) { const near = N.nearestEnemy(p.x, p.y, 120); if (near) N.chainLightning({ x: p.x, y: p.y }, 5, 8); }
        if (s.mod === 2 && !s.st.second) { s.st.again = 2; s.st.second = true; } else s.st.second = false;
      }
    };
  }

  I.rajada = {
    cast(p, s) {
      const a = p.aim, R = 72, arc = 1.5;
      N.sfx('dash');
      N.addFx({ life: 0.3, draw: (ctx, k) => { ctx.globalAlpha = 0.7 * (1 - k); ctx.strokeStyle = '#e8f4ff'; ctx.lineWidth = 1; for (let i = -3; i <= 3; i++) { const aa = a + i * arc / 7, r0 = 10 + k * 20, r1 = 25 + k * R; ctx.beginPath(); ctx.moveTo(p.x + Math.cos(aa) * r0, p.y - 5 + Math.sin(aa) * r0); ctx.lineTo(p.x + Math.cos(aa) * r1, p.y - 5 + Math.sin(aa) * r1); ctx.stroke(); } ctx.globalAlpha = 1; } });
      for (const e of G.enemies) {
        if (!e.alive || e.intangible) continue;
        const d = Math.hypot(e.x - p.x, e.y - p.y); if (d > R + e.r || Math.abs(N.angDiff(a, Math.atan2(e.y - p.y, e.x - p.x))) > arc / 2) continue;
        const r = AD(4); N.hurtEnemy(e, r.dmg, { crit: r.crit, knock: 260, ax: p.x, ay: p.y });
      }
      for (const b of G.projs) {
        if (b.team !== 'e' || b.dead) continue;
        const d = Math.hypot(b.x - p.x, b.y - p.y); if (d > R + 10 || Math.abs(N.angDiff(a, Math.atan2(b.y - p.y, b.x - p.x))) > arc / 2 + 0.2) continue;
        if (s.mod === 0) { const sp = Math.hypot(b.vx, b.vy) * 1.6, na = Math.atan2(b.y - p.y, b.x - p.x); b.team = 'p'; b.vx = Math.cos(na) * sp; b.vy = Math.sin(na) * sp; b.dmg = AD(6).dmg; b.hit = new Set(); b.life = 2; b.spr = N.bulletSprite('#cfe2ff', b.r || 3); b.round = true; }
        else { b.dead = true; N.spark(b.x, b.y, '#e8f4ff', 3, 40); }
      }
      if (s.mod === 1) {
        let tt = 0;
        G.allies.push({ x: p.x + Math.cos(a) * 12, y: p.y + Math.sin(a) * 12, life: 3.2, hp: 1, vx: Math.cos(a) * 60, vy: Math.sin(a) * 60,
          upd: (o, dt) => {
            const r0 = N.moveEnt(Object.assign(o, { r: 4, fly: true }), o.vx * dt, o.vy * dt); if (r0) { if (r0.hx) o.vx = -o.vx; if (r0.hy) o.vy = -o.vy; }
            tt -= dt;
            for (const e of G.enemies) { if (!e.alive || e.boss || e.intangible) continue; const d = Math.hypot(o.x - e.x, o.y - e.y); if (d < 55 && d > 4) N.moveEnt(e, (o.x - e.x) / d * 70 * dt, (o.y - e.y) / d * 70 * dt); }
            if (tt <= 0) { tt = 0.3; const r = AD(2.5); N.areaDamage(o.x, o.y, 16, r.dmg, { crit: r.crit }); }
          },
          draw: (ctx, o) => { for (let i = 0; i < 5; i++) { const w = 4 + i * 2.2, y = o.y - i * 4; ctx.strokeStyle = i % 2 ? '#e8f4ff' : '#9cc8ff'; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(o.x + Math.sin(o.t * 12 + i) * 2, y, w, w * 0.35, 0, 0, TAU); ctx.stroke(); } } });
      }
      if (s.mod === 2) { p.buffs.tail = 4; N.text(p.x, p.y - 22, 'Vento de Cauda!', '#cfe2ff'); }
    },
  };

  I.olho = {
    cast(p, s) {
      p.buffs.hawk = 6; p.buffs.hawkFocus = s.mod === 1;
      N.sfx('ability'); N.ringFx(p.x, p.y - 8, 30, '#ffe066', 0.4, 2);
      if (s.mod === 0) {
        let best = null; for (const e of G.enemies) if (e.alive && !e.intangible && (!best || e.hp > best.hp)) best = e;
        if (best) { best.st.mark = 8; N.text(best.x, best.y - 24, 'MARCADO', '#ff4a5e'); }
      }
    },
    onKill(p, s) {
      if (s.mod === 2 && p.buffs.hawk > 0) { const o = otherSlot(p, s); if (o && o.charges < o.max) { o.cd = Math.max(0.01, o.cd - 2); N.text(p.x, p.y - 22, '-2s', '#ffe066'); } }
    },
  };

  // ================================================================ HALDOR
  I.galope = {
    cast(p, s) {
      const dur = s.mod === 2 ? 1.6 : 2.5;
      p.buffs.gallop = dur; if (s.mod === 2) p.buffs.invuln = dur;
      s.st.hit = new Map(); s.st.trail = 0; N.sfx('charge');
      if (s.mod === 0) for (const side of [-1, 1]) {
        G.allies.push({ x: p.x, y: p.y, life: dur, hp: 1, side, hitm: new Map(),
          upd: (o, dt) => {
            const m = N.input.moveVec(), a = m.x || m.y ? Math.atan2(m.y, m.x) : p.aim;
            o.x = N.lerp(o.x, p.x + Math.cos(a + Math.PI / 2) * 20 * o.side, dt * 10); o.y = N.lerp(o.y, p.y + Math.sin(a + Math.PI / 2) * 20 * o.side, dt * 10); o.face = Math.cos(a) >= 0 ? 1 : -1;
            for (const e of G.enemies) if (e.alive && !e.intangible && Math.hypot(e.x - o.x, e.y - o.y) < e.r + 8 && (o.hitm.get(e) || 0) < G.time) { o.hitm.set(e, G.time + 0.5); const r = AD(6); N.hurtEnemy(e, r.dmg, { crit: r.crit, knock: 160, ax: o.x, ay: o.y }); }
          },
          draw: (ctx, o) => { const spr = S.misc.horse[Math.floor(o.t * 10) % 2]; ctx.save(); ctx.globalAlpha = 0.7; ctx.translate(Math.round(o.x), Math.round(o.y)); if (o.face < 0) ctx.scale(-1, 1); ctx.drawImage(spr, -spr.width / 2, -spr.height + 2); ctx.restore(); } });
      }
    },
    update(p, s, dt) {
      if (!(p.buffs.gallop > 0)) return;
      if (Math.random() < 0.5) N.part(p.x + N.rand(-4, 4), p.y + 2, N.rand(-20, 20), -10, '#c8b898', 0.35, 2);
      for (const e of G.enemies) if (e.alive && !e.intangible && Math.hypot(e.x - p.x, e.y - p.y) < e.r + p.r + 4 && (s.st.hit.get(e) || 0) < G.time) { s.st.hit.set(e, G.time + 0.5); const r = AD(7); N.hurtEnemy(e, r.dmg, { crit: r.crit, knock: 220, ax: p.x, ay: p.y }); N.shake(1); }
      if (s.mod === 1) { s.st.trail += Math.hypot(p.vx, p.vy) * dt; if (s.st.trail > 11) { s.st.trail = 0; N.fireZone(p.x, p.y + 2, 9, 3); } }
    },
  };

  I.coice = {
    cast(p, s) {
      const dirs = s.mod === 1 ? [p.aim, p.aim + Math.PI] : [p.aim];
      N.sfx('heavy'); N.shake(4); p.kickT = 0.25;
      for (const a of dirs) {
        N.meleeArc(p.x, p.y - 4, a, 1.7, 36, 0, 0, '#ffe066', true, 'ability');
        for (const e of G.enemies) {
          if (!e.alive || e.intangible) continue;
          const d = Math.hypot(e.x - p.x, e.y - p.y); if (d > 36 + e.r || Math.abs(N.angDiff(a, Math.atan2(e.y - p.y, e.x - p.x))) > 1.1) continue;
          const r = AD(20); N.hurtEnemy(e, r.dmg, { crit: r.crit, knock: 340, ax: p.x, ay: p.y, wallBonus: 10 * p.stats.dmg, stun: s.mod === 2 ? 2 : 0 });
        }
        if (s.mod === 0) { const r = AD(12); N.shoot({ x: p.x, y: p.y - 4, a, speed: 260, dmg: r.dmg, crit: r.crit, team: 'p', spr: S.proj.wave, life: 0.6, pierce: 99, r: 7, knock: 120, trail: '#c8a878' }); }
      }
    },
  };

  I.relincho = {
    cast(p, s) {
      p.buffs.war = s.mod === 2 ? 9 : 6;
      N.sfx('roar'); N.shake(3); N.ringFx(p.x, p.y - 8, 40, '#ffb03a', 0.45, 3); N.text(p.x, p.y - 24, 'Relincho de Guerra!', '#ffb03a');
      if (s.mod === 0) { p.shield = Math.max(p.shield, p.maxShield); N.sfx('shield'); }
      if (s.mod === 1) for (const e of G.enemies) if (e.alive && !e.boss && Math.hypot(e.x - p.x, e.y - p.y) < 95) e.st.fear = 3;
    },
    onKill(p, s) { if (s.mod === 2 && p.buffs.war > 0) p.buffs.war = Math.min(15, p.buffs.war + 1); },
  };

  I.ferradura = {
    cast(p, s) {
      const offs = s.mod === 1 ? [-0.38, 0, 0.38] : [0];
      N.sfx('swing');
      for (const off of offs) {
        const r = AD(9);
        N.shoot({ x: p.x, y: p.y - 6, a: p.aim + off, speed: 240, dmg: r.dmg, crit: r.crit, team: 'p', spr: S.misc.horseshoe, boomerang: 0.45, life: 2.6, pierce: 99, spin: 14, r: 6, owner: p, knock: 60, zt: 0,
          update: (b, dt) => {
            if (s.mod === 0) { b.zt -= dt; if (b.zt <= 0) { b.zt = 0.25; const e = N.nearestEnemy(b.x, b.y, 55); if (e) { N.lightning(b.x, b.y, e.x, e.y - 4); N.hurtEnemy(e, AD(3).dmg, { color: '#ffe066' }); N.sfx('zap'); } } }
            if (s.mod === 2) for (const e of G.enemies) { if (!e.alive || e.boss || e.intangible) continue; const d = Math.hypot(b.x - e.x, b.y - e.y); if (d < 55 && d > 6) N.moveEnt(e, (b.x - e.x) / d * 90 * dt, (b.y - e.y) / d * 90 * dt); }
          } });
      }
    },
  };
})();
