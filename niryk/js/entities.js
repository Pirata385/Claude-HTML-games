// Niryk — entities: collision, the player, weapons, projectiles, enemies and their AI, damage,
// status effects, drops, visual effects, summons and damage zones.
'use strict';
(function () {
  const N = window.N, S = N.S, TS = N.TS;
  const G = N.G = N.G || {};
  const TAU = Math.PI * 2;

  // ================================================================ world helpers
  N.solidPx = (x, y, fly) => N.isSolid(G.map, Math.floor(x / TS), Math.floor(y / TS), fly);
  N.hitsWall = (x, y, r, fly) => N.solidPx(x - r, y - r, fly) || N.solidPx(x + r, y - r, fly) || N.solidPx(x - r, y + r, fly) || N.solidPx(x + r, y + r, fly);
  N.moveEnt = (e, dx, dy) => {
    const steps = Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / 3) || 1, sx = dx / steps, sy = dy / steps, fly = !!(e.fly || e.air > 0);
    let hx = false, hy = false;
    for (let i = 0; i < steps; i++) {
      if (sx) { e.x += sx; if (N.hitsWall(e.x, e.y, e.r * 0.8, fly)) { e.x -= sx; hx = true; } }
      if (sy) { e.y += sy; if (N.hitsWall(e.x, e.y, e.r * 0.8, fly)) { e.y -= sy; hy = true; } }
    }
    return hx || hy ? { hx, hy } : null;
  };
  // Push an entity out of walls/obstacles (e.g. after landing from a jump over an obstacle).
  N.unstick = (e) => {
    for (let r = 2; r <= 64; r += 2) for (let k = 0; k < 16; k++) {
      const a = k / 16 * Math.PI * 2, x = e.x + Math.cos(a) * r, y = e.y + Math.sin(a) * r;
      if (!N.hitsWall(x, y, e.r * 0.8, false)) { e.x = x; e.y = y; return; }
    }
  };
  N.los = (x0, y0, x1, y1, fly) => {
    const d = Math.hypot(x1 - x0, y1 - y0), n = Math.ceil(d / 6);
    for (let i = 1; i < n; i++) { const t = i / n; if (N.solidPx(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, fly)) return false; }
    return true;
  };
  N.roomOf = (x, y) => { const i = Math.floor(y / TS) * G.map.W + Math.floor(x / TS); const r = G.map.roomIdx[i]; return r >= 0 ? G.map.rooms[r] : null; };
  // A random walkable point of a room, optionally far from (fx, fy).
  N.randomPoint = (room, minDist = 0, fx = 0, fy = 0, tries = 40) => {
    for (let i = 0; i < tries; i++) {
      const x = (room.x0 + 1 + Math.random() * (room.w - 2)) * TS, y = (room.y0 + 1 + Math.random() * (room.h - 2)) * TS;
      if (!N.hitsWall(x, y, 6) && Math.hypot(x - fx, y - fy) >= minDist) return { x, y };
    }
    return { x: (room.cx + 0.5) * TS, y: (room.cy + 0.5) * TS };
  };

  // Flow field (BFS distance to the player's tile inside the current room).
  N.updateFlow = () => {
    const room = G.curRoom, p = G.p; if (!room || !p) { G.flow = null; return; }
    const tx = Math.floor(p.x / TS), ty = Math.floor(p.y / TS);
    if (G.flow && G.flow.room === room && G.flow.tx === tx && G.flow.ty === ty) return;
    const w = room.w, h = room.h, dist = new Int16Array(w * h).fill(-1), q = [];
    const lx = N.clamp(tx - room.x0, 0, w - 1), ly = N.clamp(ty - room.y0, 0, h - 1);
    dist[ly * w + lx] = 0; q.push(ly * w + lx);
    for (let qi = 0; qi < q.length; qi++) {
      const i = q[qi], x = i % w, y = (i / w) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const j = ny * w + nx; if (dist[j] >= 0) continue;
        if (G.map.tiles[(ny + room.y0) * G.map.W + nx + room.x0] !== N.TILE.FLOOR) continue;
        dist[j] = dist[i] + 1; q.push(j);
      }
    }
    G.flow = { room, tx, ty, dist, w, h };
  };
  N.flowAngle = (e) => {
    const f = G.flow; if (!f) return null;
    const x = Math.floor(e.x / TS) - f.room.x0, y = Math.floor(e.y / TS) - f.room.y0;
    if (x < 0 || y < 0 || x >= f.w || y >= f.h) return null;
    let best = f.dist[y * f.w + x], bx = 0, by = 0;
    if (best < 0) best = 9999;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= f.w || ny >= f.h) continue;
      const d = f.dist[ny * f.w + nx];
      if (d >= 0 && d < best) {
        if (dx && dy && (f.dist[y * f.w + nx] < 0 || f.dist[ny * f.w + x] < 0)) continue; // no corner cutting
        best = d; bx = dx; by = dy;
      }
    }
    if (!bx && !by) return null;
    const cx = (x + f.room.x0 + 0.5 + bx) * TS, cy = (y + f.room.y0 + 0.5 + by) * TS;
    return Math.atan2(cy - e.y, cx - e.x);
  };

  // ================================================================ effects
  G.fx = []; G.parts = []; G.texts = [];
  N.addFx = (o) => { o.t = 0; G.fx.push(o); return o; };
  N.part = (x, y, vx, vy, c, life = 0.5, size = 1, grav = 0) => { if (G.parts.length < 900) G.parts.push({ x, y, vx, vy, c, life, max: life, size, grav }); };
  N.spark = (x, y, c, n = 6, sp = 60, life = 0.35, size = 1) => { for (let i = 0; i < n; i++) { const a = Math.random() * TAU, s = sp * (0.4 + Math.random() * 0.8); N.part(x, y, Math.cos(a) * s, Math.sin(a) * s, c, life * (0.6 + Math.random() * 0.6), size); } };
  N.text = (x, y, txt, c = '#ffffff', big = false) => { G.texts.push({ x: x + N.rand(-3, 3), y, txt: String(txt), c, big, t: 0, life: big ? 0.9 : 0.7 }); };
  N.shake = (a) => { if (N.save.opts.shake !== false) G.shakeA = Math.max(G.shakeA || 0, a); };
  N.ringFx = (x, y, r, c, life = 0.35, w = 2) => N.addFx({ life, draw: (ctx, k) => { ctx.globalAlpha = 1 - k; ctx.strokeStyle = c; ctx.lineWidth = w * (1 - k) + 0.5; ctx.beginPath(); ctx.arc(x, y, r * (0.3 + 0.7 * Math.sqrt(k)), 0, TAU); ctx.stroke(); ctx.globalAlpha = 1; } });
  // Sweeping crescent slash: a bright edge fading into the weapon colour, added on top of the lit scene.
  N.slashFx = (x, y, ang, arc, range, c) => N.addFx({ life: 0.2, draw: (ctx, k) => {
    const a0 = ang - arc / 2, sweep = arc * Math.min(1, k * 2.4), a1 = a0 + sweep, fade = 1 - Math.max(0, (k - 0.35) / 0.65);
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.95 * fade;
    const g = ctx.createRadialGradient(x, y, range * 0.35, x, y, range * 1.05);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.42, c); g.addColorStop(0.9, '#ffffff'); g.addColorStop(1, 'rgba(255,255,255,0.2)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, range * 1.05, a0, a1); ctx.arc(x, y, range * (0.45 + 0.2 * k), a1, a0, true); ctx.fill();
    ctx.globalAlpha = fade; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(x, y, range, Math.max(a0, a1 - 0.6), a1); ctx.stroke();
    ctx.restore();
  } });
  // Little impact star where hits land.
  N.impact = (x, y, c = '#ffffff', s = 7) => N.addFx({ life: 0.14, draw: (ctx, k) => {
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 1 - k; ctx.strokeStyle = c; ctx.lineWidth = 1.4;
    const r = s * (0.5 + k); ctx.beginPath(); for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + 0.4; ctx.moveTo(x + Math.cos(a) * r * 0.3, y + Math.sin(a) * r * 0.3); ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); } ctx.stroke(); ctx.restore();
  } });
  N.lightning = (x0, y0, x1, y1, c = '#ffe066') => {
    const pts = [[x0, y0]], n = Math.max(3, Math.floor(Math.hypot(x1 - x0, y1 - y0) / 10));
    for (let i = 1; i < n; i++) pts.push([x0 + (x1 - x0) * i / n + N.rand(-5, 5), y0 + (y1 - y0) * i / n + N.rand(-5, 5)]);
    pts.push([x1, y1]);
    N.addFx({ life: 0.18, draw: (ctx, k) => { ctx.globalAlpha = 1 - k; ctx.strokeStyle = c; ctx.lineWidth = 2; ctx.beginPath(); pts.forEach(([a, b], i) => (i ? ctx.lineTo(a, b) : ctx.moveTo(a, b))); ctx.stroke(); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1; ctx.stroke(); ctx.globalAlpha = 1; } });
  };
  N.explosion = (x, y, r, c = '#ff8a3a') => {
    N.addFx({ life: 0.3, draw: (ctx, k) => { ctx.globalAlpha = 1 - k; ctx.fillStyle = k < 0.25 ? '#ffffff' : c; ctx.beginPath(); ctx.arc(x, y, r * (0.4 + 0.6 * k), 0, TAU); ctx.fill(); ctx.globalAlpha = 1; } });
    N.spark(x, y, c, 14, r * 3, 0.45, 2); N.spark(x, y, '#3a2a2a', 6, r * 1.5, 0.6, 2);
    if (N.flash) N.flash(x, y, r * 3, c, 0.35);
  };
  // Run fn after `delay` seconds while drawing a telegraph.
  N.delayed = (delay, fn, draw) => N.addFx({ life: delay, draw: draw || null, done: fn });

  // ================================================================ player
  N.calcStats = (p) => {
    const c = N.CHARS[p.char], u = N.save.upg, s = {
      maxHp: c.hp + (u.vigor || 0), maxShield: c.shield + (u.carapaca || 0), speed: 1 + 0.04 * (u.agilidade || 0),
      dmg: 1 + 0.06 * (u.furia || 0), melee: 1, ranged: 1, abilDmg: 1, crit: c.crit + 0.03 * (u.precisao || 0),
      atkSpeed: 1, cdr: 0.05 * (u.foco || 0), gold: 1, discount: 0, pierce: 0, projSpeed: 1,
      burnChance: 0, freezeChance: 0, chainChance: 0, thorns: 0, spiritChance: 0, vampEvery: 0, revive: 0,
      dashCdr: 0, dashBomb: 0, magnet: 0, roomHeal: 0,
    };
    const addFx = (fx) => { for (const k in fx) {
      if (k === 'melee' || k === 'ranged' || k === 'dmg' || k === 'abilDmg' || k === 'atkSpeed' || k === 'speed' || k === 'gold' || k === 'projSpeed') s[k] += fx[k];
      else s[k] = (s[k] || 0) + fx[k];
    } };
    for (const id of p.equip) addFx(N.EQUIPS[id].fx);
    for (const b of p.blessings) if (b.fx) addFx(b.fx);
    s.cdr = Math.min(0.6, s.cdr); s.discount = Math.min(0.5, s.discount); s.maxShield = Math.max(0, s.maxShield); s.dodge = Math.min(0.5, s.dodge || 0);
    p.stats = s;
    const dh = s.maxHp - p.maxHp, ds = s.maxShield - p.maxShield;
    p.maxHp = s.maxHp; p.maxShield = s.maxShield;
    if (dh > 0) p.hp += dh; if (ds > 0) p.shield += ds;
    p.hp = Math.min(p.hp, p.maxHp); p.shield = Math.min(p.shield, p.maxShield);
  };
  N.makePlayer = (charId, x, y, run) => {
    const c = N.CHARS[charId], lo = N.getLoadout(charId);
    const p = {
      kind: 'player', char: charId, x, y, r: 5, vx: 0, vy: 0, face: 1, aim: 0, hp: 0, maxHp: 0, shield: 0, maxShield: 0,
      shieldT: 0, inv: 0, dashT: 0, dashCd: 0, dashDx: 0, dashDy: 0, weapons: [c.weapon, null], wi: 0, atkCd: 0, swing: null,
      abil: lo.map(([id, mod]) => ({ id, mod, cd: 0, cdMax: 1, charges: 1, max: 1, st: {} })),
      equip: [], blessings: [], gold: 0, potions: 0, buffs: {}, form: null, formT: 0, air: 0, anim: 0, moving: false, alive: true,
      kills: 0, vampN: 0, revived: false, hpLost: 0, run,
    };
    N.calcStats(p);
    p.hp = p.maxHp; p.shield = p.maxShield;
    for (const s of p.abil) { const imp = N.ABIL_IMPL[s.id]; s.max = imp && imp.charges ? imp.charges(s) : 1; s.charges = s.max; }
    return p;
  };
  // Loadout: two of the hero's four abilities (Q and E); the passive chosen for each ability is kept per ability.
  N.getLoadout = (charId) => {
    const c = N.CHARS[charId]; let lo = N.save.loadout[charId];
    if (!Array.isArray(lo) || lo.length !== 2 || lo[0] === lo[1] || !lo.every((id) => typeof id === 'string' && c.abilities.includes(id))) lo = [c.abilities[0], c.abilities[1]];
    const mods = N.save.mods || {};
    return lo.map((id) => [id, mods[id] === undefined ? -1 : mods[id]]);
  };
  N.weaponOf = (p) => N.WEAPONS[p.weapons[p.wi]];

  N.playerDmg = (base, kind) => {
    const p = G.p, s = p.stats;
    let m = s.dmg * (kind === 'melee' ? s.melee : kind === 'ranged' ? s.ranged : s.abilDmg);
    if (p.buffs.war > 0) m *= 1.4;
    let crit = s.crit + (p.buffs.hawk > 0 ? 0.4 : 0);
    const isCrit = Math.random() < crit;
    const cm = p.buffs.hawk > 0 && p.buffs.hawkFocus ? 3 : 2;
    return { dmg: base * m * (isCrit ? cm : 1), crit: isCrit };
  };
  N.atkRate = (p) => {
    let r = p.stats.atkSpeed; if (p.buffs.war > 0) r += 0.3; if (p.buffs.tail > 0) r += 0.4; return r;
  };

  N.hurtPlayer = (dmg, src, bullet) => {
    const p = G.p;
    if (!p || !p.alive || p.inv > 0 || p.dashT > 0 || p.air > 0 || p.buffs.invuln > 0 || G.state !== 'play' || G.godMode) return false;
    if (p.stance && p.stance.t > 0) { N.ABIL_IMPL.postura.counter(p, p.stance.s, bullet); return false; }
    if (p.stats.dodge && Math.random() < p.stats.dodge) { p.inv = 0.45; N.text(p.x, p.y - 22, 'Esquivou!', '#cfe2ff'); N.sfx('dash'); return false; }
    if (G.run && G.diff) dmg *= G.diff.dmg;
    if (p.form === 'dragon') dmg *= 0.6;
    const a = Math.min(p.shield, dmg); p.shield -= a; dmg -= a;
    if (dmg > 0.001) { p.hp -= dmg; p.hpLost += dmg; G.runHpLost = (G.runHpLost || 0) + dmg; N.sfx('hurt'); G.hurtFlash = 0.25; N.shake(4); }
    else { N.sfx('shield'); N.shake(2); }
    p.inv = 0.9; p.shieldT = 0;
    N.spark(p.x, p.y - 6, dmg > 0 ? '#ff4a5e' : '#9fd0ff', 8, 70);
    if (p.stats.thorns) for (let i = 0; i < p.stats.thorns; i++) { const a2 = i / p.stats.thorns * TAU; N.shoot({ x: p.x, y: p.y, a: a2, speed: 200, dmg: 4, team: 'p', spr: S.proj.seedP, life: 0.5, pierce: 1 }); }
    if (p.hp <= 0.001) {
      if (p.stats.revive && !p.revived) {
        p.revived = true; p.hp = Math.ceil(p.maxHp / 2); p.inv = 2;
        const i = p.equip.indexOf('fenix'); if (i >= 0) p.equip.splice(i, 1);
        N.calcStats(p); N.explosion(p.x, p.y, 40, '#ff8a3a'); N.sfx('portal'); N.text(p.x, p.y - 20, 'Renascida!', '#ffb03a', true);
        for (const e of G.enemies) if (e.alive && Math.hypot(e.x - p.x, e.y - p.y) < 70) N.hurtEnemy(e, 30, { knock: 200, ax: p.x, ay: p.y });
      } else { p.hp = 0; p.alive = false; G.onPlayerDeath && G.onPlayerDeath(); }
    }
    return true;
  };
  N.healPlayer = (n) => { const p = G.p; const before = p.hp; p.hp = Math.min(p.maxHp, p.hp + n); if (p.hp > before) { N.text(p.x, p.y - 18, '+' + Math.round(p.hp - before), '#7cf07a'); N.sfx('heal'); N.spark(p.x, p.y - 6, '#7cf07a', 10, 40); } };

  N.updatePlayer = (p, dt) => {
    const I = N.input;
    p.anim += dt;
    for (const k in p.buffs) if (typeof p.buffs[k] === 'number' && p.buffs[k] > 0) p.buffs[k] -= dt;
    p.inv = Math.max(0, p.inv - dt); p.dashCd = Math.max(0, p.dashCd - dt); p.atkCd -= dt;
    // shield regen
    p.shieldT += dt;
    if (p.shieldT > 3.5 && p.shield < p.maxShield) { p.shield = Math.min(p.maxShield, p.shield + 1); p.shieldT = 2.6; N.sfx('shield'); }
    // aim
    const wp = N.mouseWorld();
    if (I.usingTouch) {
      const t = N.save.opts.autoAim !== false ? N.nearestEnemy(p.x, p.y, 170, true) : null;
      if (t) p.aim = Math.atan2(t.y - p.y, t.x - p.x);
      else if (I.vmove.x || I.vmove.y) p.aim = Math.atan2(I.vmove.y, I.vmove.x);
    } else p.aim = Math.atan2(wp.y - (p.y - 5), wp.x - p.x);
    if (!p.swing) p.face = Math.cos(p.aim) >= 0 ? 1 : -1;
    // abilities
    N.updateAbilities(p, dt);
    if (G.state === 'play' && p.alive) { N.abilityInput(p, 0, dt); N.abilityInput(p, 1, dt); }
    if (p.stats.stormOrb && G.state === 'play') {
      p.stormT = (p.stormT || 3) - dt;
      if (p.stormT <= 0) { p.stormT = 3; const e = N.nearestEnemy(p.x, p.y, 150); if (e) { N.lightning(e.x + N.rand(-6, 6), e.y - 70, e.x, e.y - 4, '#9ad8ff'); N.hurtEnemy(e, 10 * p.stats.dmg, { color: '#9ad8ff' }); N.sfx('zap'); N.flash && N.flash(e.x, e.y, 40, '#9ad8ff', 0.2); } }
    }
    if (p.control) { p.control(dt); return; } // an ability is steering the hero
    if (!p.air && N.hitsWall(p.x, p.y, p.r * 0.8, false)) N.unstick(p);
    // movement
    const mv = I.moveVec();
    let sp = 84 * (N.CHARS[p.char].speed / 62) * p.stats.speed;
    if (p.form === 'dragon') sp *= 1.25;
    if (p.buffs.gallop > 0) sp *= 2;
    if (p.buffs.tail > 0) sp *= 1.4;
    if (p.buffs.slow > 0) sp *= 0.6;
    if (p.dashT > 0) {
      p.dashT -= dt; N.moveEnt(p, p.dashDx * 270 * dt, p.dashDy * 270 * dt);
      if (Math.random() < 0.6) N.part(p.x + N.rand(-3, 3), p.y + N.rand(-6, 2), 0, 0, 'rgba(255,255,255,0.5)', 0.25, 2);
    } else {
      p.vx = N.lerp(p.vx, mv.x * sp, Math.min(1, dt * 18)); p.vy = N.lerp(p.vy, mv.y * sp, Math.min(1, dt * 18));
      N.moveEnt(p, p.vx * dt, p.vy * dt);
      if (I.hit.dash && p.dashCd <= 0 && p.alive) {
        const dx = mv.x || mv.y ? mv.x : Math.cos(p.aim), dy = mv.x || mv.y ? mv.y : Math.sin(p.aim), l = Math.hypot(dx, dy) || 1;
        p.dashDx = dx / l; p.dashDy = dy / l; p.dashT = 0.17 * (1 + (p.stats.dashLen || 0)); p.dashCd = 0.85 * (1 - p.stats.dashCdr); N.sfx('dash');
        if (p.stats.dashWind) { N.ringFx(p.x, p.y - 4, 40, '#cfe2ff', 0.3, 2); for (const b of G.projs) if (b.team === 'e' && Math.hypot(b.x - p.x, b.y - p.y) < 42) { b.dead = true; N.spark(b.x, b.y, '#e8f4ff', 3, 40); } N.areaDamage(p.x, p.y, 40, 2 * p.stats.dmg, { knock: 200 }); }
        if (p.stats.dashBomb) { const bx = p.x, by = p.y; N.delayed(0.6, () => { N.explosion(bx, by, 26, '#a070ff'); N.areaDamage(bx, by, 28, 10 * p.stats.dmg, { knock: 120 }); N.sfx('explode'); }, (ctx, k) => { ctx.globalAlpha = 0.5; ctx.drawImage(N.silhouette(N.heroSprite(p), '#3a2a5a'), bx - 11, by - 19); ctx.globalAlpha = 1; }); }
      }
    }
    p.moving = Math.hypot(p.vx, p.vy) > 10 || p.dashT > 0;
    // weapons
    if (I.hit.swap && p.weapons[1]) { p.wi = 1 - p.wi; N.sfx('ui'); N.text(p.x, p.y - 24, N.weaponOf(p).name, N.RARITY[N.weaponOf(p).rarity].color); }
    if (p.swing) { p.swing.t += dt; if (p.swing.t >= p.swing.dur) p.swing = null; }
    if (I.act.attack && p.atkCd <= 0 && p.alive && G.state === 'play' && !G.noAttack) N.attack(p);
  };
  N.heroSprite = (p) => {
    const fr = p.form === 'dragon' ? S.ch.dragon : S.ch[p.char];
    const f = p.moving ? 1 + (Math.floor(p.anim * 10) % 4) : (Math.sin(p.anim * 2.5) > 0.6 ? 4 : 0);
    return fr[f];
  };
  N.mouseWorld = () => {
    const I = N.input, sx = I.mx / innerWidth * G.VW, sy = I.my / innerHeight * G.VH;
    return { x: sx + G.camX, y: sy + G.camY };
  };
  N.nearestEnemy = (x, y, maxD = 9999, needLos = false) => {
    let best = null, bd = maxD;
    for (const e of G.enemies) {
      if (!e.alive || e.intangible) continue;
      const d = Math.hypot(e.x - x, e.y - y);
      if (d < bd && (!needLos || N.los(x, y, e.x, e.y, true))) { bd = d; best = e; }
    }
    return best;
  };

  // ---------------------------------------------------------------- attacks
  N.attack = (p) => {
    if (p.form === 'dragon') return N.dragonAttack(p);
    const w = N.weaponOf(p), rate = w.rate * N.atkRate(p);
    p.atkCd = 1 / rate;
    const hp = N.handPos(p), hx = hp.x, hy = hp.y, a = p.aim;
    N.sfx(w.sfx || 'shoot');
    if (w.kind === 'melee') {
      p.swing = { t: 0, dur: Math.min(0.22, 0.8 / rate), arc: w.arc };
      N.meleeArc(hx, hy, a, w.arc, w.range, w.dmg, w.knock, w.fx || '#ffffff', w.id === 'tronco' || w.id === 'machado' || w.id === 'martelo' || w.id === 'foice', 'melee', w.burnChance && Math.random() < w.burnChance ? { burn: true } : {});
      if (w.shock) { const sx = hx + Math.cos(a) * w.range * 0.8, sy = hy + Math.sin(a) * w.range * 0.8; N.ringFx(sx, sy, 24, '#ff9a4a'); N.areaDamage(sx, sy, 24, N.playerDmg(w.dmg * 0.5, 'melee').dmg, { knock: 90 }); }
      if (w.wave) N.shoot({ x: hx, y: hy, a, speed: 230, dmg: w.dmg * 0.6, kind: 'melee', team: 'p', spr: S.proj.wave, life: 0.45, pierce: 99, proc: true, r: 6 });
    } else if (w.kind === 'thrust') {
      p.swing = { t: 0, dur: 0.16, thrust: true };
      const ex = hx + Math.cos(a) * w.range, ey = hy + Math.sin(a) * w.range;
      N.addFx({ life: 0.14, draw: (ctx, k) => { ctx.globalAlpha = 1 - k; ctx.strokeStyle = w.fx; ctx.lineWidth = 3 * (1 - k) + 1; ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(ex, ey); ctx.stroke(); ctx.globalAlpha = 1; } });
      for (const e of G.enemies) {
        if (!e.alive || e.intangible) continue;
        if (N.segDist(e.x, e.y, hx, hy, ex, ey) < w.width + e.r) {
          const r = N.playerDmg(w.dmg, 'melee'); N.hurtEnemy(e, r.dmg, { crit: r.crit, knock: w.knock, ax: p.x, ay: p.y, proc: true });
          if (Math.random() < w.zap) N.chainLightning(e, 2, 5);
        }
      }
      N.deflect(hx, hy, a, 0.5, w.range);
    } else if (w.kind === 'cast') {
      const wp = I_aimPoint(p, 120);
      const r0 = N.playerDmg(w.dmg, 'ranged');
      N.addFx({ life: 0.4, draw: (ctx, k) => { ctx.globalAlpha = 1 - k; ctx.fillStyle = '#7ed05a'; for (let i = 0; i < 7; i++) { const aa = i / 7 * TAU, rr = w.radius * 0.6; const sx = wp.x + Math.cos(aa) * rr, sy = wp.y + Math.sin(aa) * rr; ctx.beginPath(); ctx.moveTo(sx - 2, sy + 2); ctx.lineTo(sx, sy - 8 * Math.min(1, k * 4)); ctx.lineTo(sx + 2, sy + 2); ctx.fill(); } ctx.globalAlpha = 1; } });
      for (const e of G.enemies) if (e.alive && !e.intangible && Math.hypot(e.x - wp.x, e.y - wp.y) < w.radius + e.r) {
        N.hurtEnemy(e, r0.dmg, { crit: r0.crit, proc: true });
        if (Math.random() < w.root) e.st.root = 1.4;
      }
    } else {
      const n = w.count || 1, sp = (w.speed || 200) * p.stats.projSpeed * (p.buffs.hawk > 0 ? 1.3 : 1);
      const fire = (k0, aa) => {
        const h2 = N.handPos(p);
        for (let i = 0; i < n; i++) {
          const off = n > 1 ? (i / (n - 1) - 0.5) * w.spread : (Math.random() - 0.5) * (w.spread || 0.02);
          const r0 = N.playerDmg(w.dmg, 'ranged');
          N.shoot({
            x: h2.x + Math.cos(aa) * 6, y: h2.y + Math.sin(aa) * 6, a: aa + off, speed: sp * (1 + (w.speedVar ? N.rand(-w.speedVar, w.speedVar) : 0)), dmg: r0.dmg, crit: r0.crit,
            team: 'p', spr: S.proj[w.proj] || S.proj.stone, life: w.life || 1.3, pierce: (w.pierce || 0) + p.stats.pierce, bounce: w.bounce || 0,
            homing: w.homing || 0, explode: w.explode || 0, burn: w.burn, slow: w.slow, proc: true, kind: 'ranged', knock: w.knock, boomerang: w.boomerang || 0, owner: p, spin: w.boomerang ? 16 : w.proj === 'chakram' ? 20 : 0,
          });
        }
      };
      fire(0, a);
      if (w.burst) for (let k = 1; k < w.burst; k++) N.delayed(k * 0.08, () => { if (p.alive) { fire(k, p.aim); N.sfx(w.sfx || 'shoot'); } });
      p.kick = 2;
    }
  };
  function I_aimPoint(p, maxD) {
    const I = N.input;
    let tx, ty;
    if (p.forcedAim) { tx = p.forcedAim.x; ty = p.forcedAim.y; }
    else if (I.usingTouch) { const e = N.save.opts.autoAim !== false ? N.nearestEnemy(p.x, p.y, 170, true) : null; if (e) { tx = e.x; ty = e.y; } else { tx = p.x + Math.cos(p.aim) * 60; ty = p.y + Math.sin(p.aim) * 60; } }
    else { const m = N.mouseWorld(); tx = m.x; ty = m.y; }
    const d = Math.hypot(tx - p.x, ty - p.y);
    if (d > maxD) { tx = p.x + (tx - p.x) / d * maxD; ty = p.y + (ty - p.y) / d * maxD; }
    return { x: tx, y: ty };
  }
  N.aimPoint = I_aimPoint;
  N.segDist = (px, py, ax, ay, bx, by) => {
    const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy || 1;
    const t = N.clamp(((px - ax) * dx + (py - ay) * dy) / l2, 0, 1);
    return Math.hypot(px - (ax + dx * t), py - (ay + dy * t));
  };
  N.meleeArc = (x, y, a, arc, range, base, knock, color, heavy, kind = 'melee', extra = {}) => {
    N.slashFx(x, y, a, arc, range, color);
    let hits = 0;
    for (const e of G.enemies) {
      if (!e.alive || e.intangible) continue;
      const d = Math.hypot(e.x - x, e.y - y);
      if (d > range + e.r) continue;
      if (Math.abs(N.angDiff(a, Math.atan2(e.y - y, e.x - x))) > arc / 2 + 0.25 && d > e.r + 4) continue;
      const r = N.playerDmg(base, kind); N.hurtEnemy(e, r.dmg, Object.assign({ crit: r.crit, knock, ax: x, ay: y, proc: true }, extra)); hits++;
    }
    N.deflect(x, y, a, arc, range);
    if (hits && heavy) N.shake(2);
    return hits;
  };
  // Melee swings cut enemy projectiles out of the air.
  N.deflect = (x, y, a, arc, range) => {
    for (const b of G.projs) {
      if (b.team !== 'e' || b.dead) continue;
      const d = Math.hypot(b.x - x, b.y - y);
      if (d < range + 3 && Math.abs(N.angDiff(a, Math.atan2(b.y - y, b.x - x))) < arc / 2 + 0.3) { b.dead = true; N.spark(b.x, b.y, '#ffffff', 3, 40); }
    }
  };
  N.areaDamage = (x, y, r, dmg, o = {}) => {
    let n = 0;
    for (const e of G.enemies) if (e.alive && !e.intangible && Math.hypot(e.x - x, e.y - y) < r + e.r) { N.hurtEnemy(e, dmg, Object.assign({ ax: x, ay: y }, o)); n++; if (o.each) o.each(e); }
    return n;
  };
  N.chainLightning = (from, n, dmg) => {
    let cur = from; const hit = new Set([from]);
    for (let i = 0; i < n; i++) {
      let best = null, bd = 80;
      for (const e of G.enemies) { if (!e.alive || hit.has(e) || e.intangible) continue; const d = Math.hypot(e.x - cur.x, e.y - cur.y); if (d < bd) { bd = d; best = e; } }
      if (!best) break;
      N.lightning(cur.x, cur.y - 4, best.x, best.y - 4); N.hurtEnemy(best, dmg * G.p.stats.dmg, { color: '#ffe066' }); hit.add(best); cur = best;
    }
    N.sfx('zap');
  };

  // ================================================================ projectiles
  G.projs = [];
  N.shoot = (o) => {
    const b = Object.assign({ r: 3, life: 1.5, pierce: 0, bounce: 0, homing: 0, t: 0, hit: new Set(), dead: false }, o);
    b.vx = Math.cos(o.a) * o.speed; b.vy = Math.sin(o.a) * o.speed;
    G.projs.push(b); return b;
  };
  N.eshoot = (x, y, a, speed, o = {}) => {
    const col = o.color || G.bulletColor || '#ff6a3a', r = o.r || 3;
    if (!o.silent) N.sfx('eshoot');
    const k = G.run && G.diff ? G.diff.shot : 1;
    return N.shoot(Object.assign({ x, y, a, speed: speed * k, dmg: 1, team: 'e', spr: N.bulletSprite(col, r), r, life: 6, round: true, glow: col }, o));
  };
  N.updateProjs = (dt) => {
    const p = G.p;
    for (const b of G.projs) {
      if (b.dead) continue;
      b.t += dt; b.life -= dt;
      if (b.life <= 0) { N.projEnd(b); continue; }
      if (b.homing) {
        const tgt = b.team === 'p' ? N.nearestEnemy(b.x, b.y, 140) : p;
        if (tgt) { const want = Math.atan2(tgt.y - b.y, tgt.x - b.x), cur = Math.atan2(b.vy, b.vx), sp = Math.hypot(b.vx, b.vy); const na = cur + N.clamp(N.angDiff(cur, want), -b.homing * dt, b.homing * dt); b.vx = Math.cos(na) * sp; b.vy = Math.sin(na) * sp; }
      }
      if (b.curve) { const cur = Math.atan2(b.vy, b.vx) + b.curve * dt, sp = Math.hypot(b.vx, b.vy); b.vx = Math.cos(cur) * sp; b.vy = Math.sin(cur) * sp; }
      if (b.accel) { const sp = Math.hypot(b.vx, b.vy), ns = Math.max(10, sp + b.accel * dt); b.vx *= ns / sp; b.vy *= ns / sp; }
      if (b.boomerang) {
        if (b.t > b.boomerang && !b.back) { b.back = true; b.hit.clear(); }
        if (b.back) { const o = b.owner || p, a = Math.atan2(o.y - b.y, o.x - b.x), sp = Math.hypot(b.vx, b.vy); b.vx = N.lerp(b.vx, Math.cos(a) * sp, dt * 6); b.vy = N.lerp(b.vy, Math.sin(a) * sp, dt * 6); if (Math.hypot(o.x - b.x, o.y - b.y) < 8) { b.dead = true; continue; } }
      }
      if (b.update) b.update(b, dt);
      const nx = b.x + b.vx * dt, ny = b.y + b.vy * dt;
      if (!b.ghost && N.solidPx(nx, ny, b.overBlocks)) {
        if (b.bounce > 0 || b.boomerang) {
          b.bounce--;
          if (N.solidPx(nx, b.y, b.overBlocks)) b.vx = -b.vx; else b.vy = -b.vy;
          if (b.boomerang) { b.back = true; }
          N.sfx('ehit');
        } else { N.projEnd(b, true); continue; }
      } else { b.x = nx; b.y = ny; }
      if (b.trail && Math.random() < 0.6) N.part(b.x, b.y, 0, 0, b.trail, 0.25, 2);
      if (b.team === 'p') {
        for (const e of G.enemies) {
          if (!e.alive || e.intangible || b.hit.has(e)) continue;
          if (Math.hypot(e.x - b.x, e.y - b.y) < e.r + b.r) {
            b.hit.add(e);
            N.hurtEnemy(e, b.dmg, { crit: b.crit, knock: b.knock || 30, ax: b.x - b.vx, ay: b.y - b.vy, burn: b.burn, slow: b.slow, proc: b.proc, bleed: b.bleed, kind: b.kind });
            if (b.onHit) b.onHit(b, e);
            if (b.explode) { N.projEnd(b); break; }
            if (--b.pierce < 0) { b.dead = true; break; }
          }
        }
      } else if (p && p.alive) {
        let blocked = false;
        for (const a of G.allies) {
          if (a.hp > 0 && a.taunt && Math.hypot(a.x - b.x, a.y - b.y) < (a.r || 6) + b.r) { a.hp -= b.dmg * 8; b.dead = true; blocked = true; N.spark(b.x, b.y, '#ffffff', 3, 40); break; }
        }
        if (!blocked && b.team === 'e' && Math.hypot(p.x - b.x, p.y - 4 - b.y) < p.r + b.r - 1) { if (N.hurtPlayer(b.dmg, 'bullet', b)) b.dead = true; }
      }
    }
    G.projs = G.projs.filter((b) => !b.dead);
  };
  N.projEnd = (b, wall) => {
    b.dead = true;
    if (b.explode) { N.explosion(b.x, b.y, b.explode, '#ff8a3a'); N.areaDamage(b.x, b.y, b.explode, b.dmg, { burn: b.burn, knock: 80, proc: true }); N.sfx('explode'); }
    else if (wall) N.spark(b.x, b.y, b.team === 'e' ? (G.bulletColor || '#ff6a3a') : '#ffffff', 3, 30, 0.25);
    if (b.onEnd) b.onEnd(b);
  };

  // ================================================================ enemies
  G.enemies = [];
  N.spawnEnemy = (id, x, y, o = {}) => {
    const def = N.ENEMIES[id];
    const hpMul = (o.hpMul || 1) * (o.elite ? 2.2 : 1);
    const e = {
      kind: 'enemy', id, def, x, y, r: def.r, hp: def.hp * hpMul, maxHp: def.hp * hpMul, vx: 0, vy: 0, kx: 0, ky: 0, face: 1, faceA: 0,
      t: Math.random() * 2, st: {}, mode: 'idle', mt: N.rand(0.3, 1.2), cd: N.rand(0.5, 1.6), flash: 0, fly: !!def.fly, elite: !!o.elite, alive: true,
      anim: Math.random() * 3, spd: def.speed * (o.elite ? 1.1 : 1), dmgMul: o.elite ? 1 : 1, minion: !!o.minion, noDrop: !!o.noDrop, hpMul, small: !!o.small,
    };
    if (o.small) { e.r = Math.max(4, def.r * 0.6); e.spd *= 1.25; }
    G.enemies.push(e);
    N.save.codex.m[id] = N.save.codex.m[id] || 1;
    return e;
  };
  N.hurtEnemy = (e, dmg, o = {}) => {
    if (!e.alive || e.intangible || e.invuln) return 0;
    if (e.st.mark > 0) dmg *= 2;
    if (e.boss && e.armor) dmg *= e.armor;
    e.hp -= dmg; e.flash = 0.09; G.dmgDealt = (G.dmgDealt || 0) + dmg;
    if (e.dummy) e.dps = (e.dps || 0) + dmg;
    const kb = (o.knock || 0) * (e.boss ? 0 : e.def && (e.def.ai === 'tank' || e.def.ai === 'slammer' || e.def.ai === 'turret') ? 0.25 : 1);
    if (kb && o.ax !== undefined) { const a = Math.atan2(e.y - o.ay, e.x - o.ax); e.kx += Math.cos(a) * kb; e.ky += Math.sin(a) * kb; if (o.wallBonus) e.wallBonus = o.wallBonus; }
    N.text(e.x, e.y - e.r - 10, Math.max(1, Math.round(dmg)), o.crit ? '#ffb02e' : o.color || '#ffffff', o.crit);
    N.sfx(o.crit ? 'crit' : 'hit');
    N.spark(e.x, e.y - 3, o.crit ? '#ffe066' : '#ffffff', o.crit ? 6 : 3, 50, 0.25);
    N.impact(e.x + N.rand(-3, 3), e.y - e.r - N.rand(0, 4), o.crit ? '#ffcf5a' : '#ffffff', o.crit ? 11 : 7);
    if (o.burn) e.st.burn = Math.max(e.st.burn || 0, 4);
    if (o.slow) e.st.slow = Math.max(e.st.slow || 0, typeof o.slow === 'number' ? o.slow : 2);
    if (o.bleed) e.st.bleed = 3;
    if (o.stun) e.st.stun = Math.max(e.st.stun || 0, o.stun);
    if (o.poison) e.st.poison = Math.max(e.st.poison || 0, o.poison);
    if (o.proc && G.p) {
      const s = G.p.stats;
      if (s.burnChance && Math.random() < s.burnChance) e.st.burn = 4;
      if (s.freezeChance && Math.random() < s.freezeChance) { e.st.freeze = 1; N.spark(e.x, e.y, '#9fe8ff', 5, 40); }
      if (s.chainChance && Math.random() < s.chainChance) N.chainLightning(e, 3, 6);
      if (s.poisonChance && Math.random() < s.poisonChance) e.st.poison = Math.max(e.st.poison || 0, 3);
      if (s.critShield && o.crit && G.time > (G.p.critShT || 0) && G.p.shield < G.p.maxShield) { G.p.shield += 1; G.p.critShT = G.time + 2; N.text(G.p.x, G.p.y - 22, '+1 escudo', '#9fd0ff'); }
    }
    if (e.hp <= 0) N.killEnemy(e, o);
    return dmg;
  };
  N.killEnemy = (e, o = {}) => {
    if (!e.alive) return;
    if (e.dummy) { e.hp = e.maxHp; return; }
    e.alive = false; e.deadT = 0;
    N.sfx('kill'); N.spark(e.x, e.y - 3, '#ffffff', 10, 80, 0.4, 2);
    const col = { 0: '#7cd05a', 1: '#c08aff', 2: '#e8b070' }[e.def ? e.def.world : 0] || '#ffffff';
    N.spark(e.x, e.y - 3, col, 12, 60, 0.6, 2);
    if (e.boss) return G.onBossKilled && G.onBossKilled(e);
    if (e.onDeath) e.onDeath(e);
    if (e.def && e.def.split && !e.small) for (const dx of [-6, 6]) { const m = N.spawnEnemy(e.id, e.x + dx, e.y, { hpMul: e.hpMul * 0.4, small: true, noDrop: true }); m.kx = dx * 18; }
    const p = G.p;
    if (!e.noDrop && !e.minion) {
      const coins = N.randi(1, 2) + (e.elite ? 4 : 0);
      for (let i = 0; i < coins; i++) N.dropPickup('coin', e.x, e.y);
      if (Math.random() < (e.elite ? 0.5 : 0.07)) N.dropPickup('crystal', e.x, e.y);
      if (Math.random() < 0.025) N.dropPickup('potion', e.x, e.y);
    }
    if (G.run && p) {
      G.run.kills++; p.kills++; N.save.stats.kills++;
      N.save.codex.m[e.id] = 2;
      if (p.form === 'dragon') N.save.stats.dragonKills++;
      for (const s of p.abil) { const imp = N.ABIL_IMPL[s.id]; if (imp && imp.onKill) imp.onKill(p, s, e); }
      if (p.stats.spiritChance && Math.random() < p.stats.spiritChance) N.shoot({ x: e.x, y: e.y, a: Math.random() * TAU, speed: 110, dmg: 8 * p.stats.dmg, team: 'p', spr: S.misc.spirit, life: 3, homing: 7, r: 4, pierce: 0 });
      if (p.stats.vampEvery) { p.vampN++; if (p.vampN >= p.stats.vampEvery) { p.vampN = 0; N.healPlayer(1); } }
      N.checkAch && N.checkAch();
    }
  };
  N.dropPickup = (type, x, y, o = {}) => {
    const a = Math.random() * TAU, s = N.rand(30, 80);
    G.pickups.push(Object.assign({ type, x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, t: 0, z: 0, vz: N.rand(40, 80) }, o));
  };
  G.pickups = [];
  N.updatePickups = (dt) => {
    const p = G.p;
    for (const k of G.pickups) {
      k.t += dt;
      k.vz -= 260 * dt; k.z = Math.max(0, k.z + k.vz * dt); if (k.z === 0) k.vz = 0;
      k.vx *= Math.pow(0.02, dt); k.vy *= Math.pow(0.02, dt);
      N.moveEnt(Object.assign(k, { r: 2 }), k.vx * dt, k.vy * dt);
      if (!p || !p.alive || k.t < 0.35) continue;
      const d = Math.hypot(p.x - k.x, p.y - k.y), mag = (p.stats.magnet ? 110 : 34) * (G.roomClear ? 3 : 1);
      if (k.type !== 'potion' && d < mag) { const a = Math.atan2(p.y - k.y, p.x - k.x), s = 260 * (1 - d / mag) + 60; k.x += Math.cos(a) * s * dt; k.y += Math.sin(a) * s * dt; }
      if (d < 9) {
        k.dead = true;
        if (k.type === 'coin') { const v = Math.max(1, Math.round((k.v || 1) * p.stats.gold)); p.gold += v; N.sfx('coin'); }
        else if (k.type === 'crystal') { const v = k.v || 1; G.run.crystals += v; N.sfx('crystal'); N.text(p.x, p.y - 18, '+' + v + ' ✦', '#5fe3d6'); }
        else if (k.type === 'potion') { if (p.hp >= p.maxHp) { k.dead = false; continue; } N.healPlayer(2); }
      }
    }
    G.pickups = G.pickups.filter((k) => !k.dead);
  };

  // Who the enemies chase: decoys and the Ent taunt within range.
  N.enemyTarget = (e) => {
    let best = G.p, bd = 150;
    for (const a of G.allies) if (a.taunt && a.hp > 0) { const d = Math.hypot(a.x - e.x, a.y - e.y); if (d < bd) { bd = d; best = a; } }
    return best;
  };
  function steer(e, tx, ty, speed, dt) {
    let a = Math.atan2(ty - e.y, tx - e.x);
    if (!e.fly && !N.los(e.x, e.y, tx, ty, false)) { const fa = N.flowAngle(e); if (fa !== null) a = fa; }
    const r = N.moveEnt(e, Math.cos(a) * speed * dt, Math.sin(a) * speed * dt);
    if (Math.cos(a) !== 0) e.face = Math.cos(a) >= 0 ? 1 : -1;
    return r;
  }
  N.steer = steer;
  function contact(e) {
    const p = G.p;
    if (e.def.touch && !e.intangible && !e.air && Math.hypot(p.x - e.x, p.y - e.y) < e.r + p.r) N.hurtPlayer(e.def.touch, 'touch');
  }
  const aimAt = (e, t) => Math.atan2(t.y - e.y, t.x - e.x);
  function fan(e, a, n, spread, speed, o) { for (let i = 0; i < n; i++) N.eshoot(e.x, e.y - 3, a + (n > 1 ? (i / (n - 1) - 0.5) * spread * 2 : 0), speed, o); }
  function ring(x, y, n, speed, off = 0, o) { for (let i = 0; i < n; i++) N.eshoot(x, y, off + i / n * TAU, speed, o); }
  N.ring = ring; N.fan = fan;

  const AI = {
    hopper(e, t, dt) {
      e.mt -= dt;
      if (e.mode === 'hop') { N.moveEnt(e, e.vx * dt, e.vy * dt); if (e.mt <= 0) { e.mode = 'idle'; e.mt = N.rand(0.35, 0.8); } }
      else if (e.mt <= 0) { const a = aimAt(e, t) + N.rand(-0.3, 0.3), s = e.spd * 3.2; e.vx = Math.cos(a) * s; e.vy = Math.sin(a) * s; e.face = Math.cos(a) >= 0 ? 1 : -1; e.mode = 'hop'; e.mt = 0.32; }
    },
    shooter(e, t, dt) {
      const d = Math.hypot(t.x - e.x, t.y - e.y);
      if (d > 110) steer(e, t.x, t.y, e.spd, dt);
      e.cd -= dt;
      if (e.cd < 0.3) e.squish = 1;
      if (e.cd <= 0) { e.cd = e.def.shot.cd * N.rand(0.8, 1.2); e.squish = 0; fan(e, aimAt(e, t), e.def.shot.n + (e.elite ? 2 : 0), e.def.shot.spread, e.def.shot.speed); }
    },
    charger(e, t, dt) {
      if (e.mode === 'wind') { e.mt -= dt; e.shakeX = Math.sin(e.t * 60); if (e.mt <= 0) { e.mode = 'charge'; e.mt = 0.85; N.sfx('charge'); } return; }
      if (e.mode === 'charge') {
        e.mt -= dt; const r = N.moveEnt(e, Math.cos(e.ca) * 175 * dt, Math.sin(e.ca) * 175 * dt);
        if (Math.random() < 0.5) N.part(e.x, e.y + 3, 0, 0, '#c8b898', 0.3, 2);
        if (r) { e.mode = 'idle'; e.st.stun = 0.7; N.shake(1); N.spark(e.x, e.y, '#ffffff', 5, 50); }
        else if (e.mt <= 0) { e.mode = 'idle'; e.cd = N.rand(1.4, 2.4); }
        return;
      }
      e.cd -= dt; steer(e, t.x, t.y, e.spd, dt);
      if (e.cd <= 0 && Math.hypot(t.x - e.x, t.y - e.y) < 130 && N.los(e.x, e.y, t.x, t.y)) { e.mode = 'wind'; e.mt = 0.55; e.ca = aimAt(e, t); e.face = Math.cos(e.ca) >= 0 ? 1 : -1; }
    },
    lunger(e, t, dt) {
      e.mt -= dt;
      if (e.mode === 'lunge') { N.moveEnt(e, e.vx * dt, e.vy * dt); if (e.mt <= 0) { e.mode = 'rest'; e.mt = 0.45; } return; }
      if (e.mode === 'rest') { if (e.mt <= 0) { e.mode = 'circle'; e.mt = N.rand(1, 2); } return; }
      const d = Math.hypot(t.x - e.x, t.y - e.y), a = aimAt(e, t), dir = e.dir || (e.dir = Math.random() < 0.5 ? 1 : -1);
      if (d > 90 || !N.los(e.x, e.y, t.x, t.y)) steer(e, t.x, t.y, e.spd, dt);
      else { const ta = a + dir * Math.PI / 2, rad = (d - 50) * 0.04; const r = N.moveEnt(e, (Math.cos(ta) + Math.cos(a) * rad) * e.spd * dt, (Math.sin(ta) + Math.sin(a) * rad) * e.spd * dt); if (r) e.dir = -dir; e.face = Math.cos(a) >= 0 ? 1 : -1; }
      if (e.mt <= 0 && d < 110) { e.mode = 'lunge'; e.mt = 0.3; e.vx = Math.cos(a) * 210; e.vy = Math.sin(a) * 210; N.sfx('dash'); }
    },
    kiter(e, t, dt) {
      const d = Math.hypot(t.x - e.x, t.y - e.y), a = aimAt(e, t);
      if (d < 80) N.moveEnt(e, -Math.cos(a) * e.spd * dt, -Math.sin(a) * e.spd * dt);
      else if (d > 140 || !N.los(e.x, e.y, t.x, t.y)) steer(e, t.x, t.y, e.spd, dt);
      else { const ta = a + Math.PI / 2 * (e.dir || 1); if (N.moveEnt(e, Math.cos(ta) * e.spd * 0.5 * dt, Math.sin(ta) * e.spd * 0.5 * dt)) e.dir = -(e.dir || 1); }
      e.face = Math.cos(a) >= 0 ? 1 : -1;
      e.cd -= dt;
      if (e.cd <= 0 && N.los(e.x, e.y, t.x, t.y)) { e.cd = e.def.shot.cd * N.rand(0.8, 1.2); N.eshoot(e.x, e.y - 3, a, e.def.shot.speed, { r: 2.5 }); if (e.elite) { N.eshoot(e.x, e.y - 3, a + 0.2, e.def.shot.speed, { r: 2.5 }); N.eshoot(e.x, e.y - 3, a - 0.2, e.def.shot.speed, { r: 2.5 }); } }
    },
    tank(e, t, dt) {
      steer(e, t.x, t.y, e.spd, dt);
      e.cd -= dt;
      if (e.cd <= 0) { e.cd = e.def.shot.cd; ring(e.x, e.y - 3, e.def.shot.n + (e.elite ? 4 : 0), e.def.shot.speed, Math.random()); }
    },
    blinker(e, t, dt) {
      e.mt -= dt;
      if (e.mode === 'vanish') { e.intangible = true; if (e.mt <= 0) { const a = Math.random() * TAU; let x = t.x + Math.cos(a) * 28, y = t.y + Math.sin(a) * 28; if (N.hitsWall(x, y, 6)) { x = e.x; y = e.y; } e.x = x; e.y = y; e.mode = 'appear'; e.mt = 0.45; e.intangible = false; N.spark(e.x, e.y, '#8a3ad0', 10, 50); } return; }
      if (e.mode === 'appear') { if (e.mt <= 0) { const a = aimAt(e, t); e.vx = Math.cos(a) * 190; e.vy = Math.sin(a) * 190; e.mode = 'slash'; e.mt = 0.22; } return; }
      if (e.mode === 'slash') { N.moveEnt(e, e.vx * dt, e.vy * dt); if (e.mt <= 0) { e.mode = 'idle'; e.mt = N.rand(2, 3.2); } return; }
      steer(e, t.x, t.y, e.spd, dt);
      if (e.mt <= 0) { e.mode = 'vanish'; e.mt = 0.5; N.spark(e.x, e.y, '#3a2050', 10, 50); }
    },
    floater(e, t, dt) {
      const d = Math.hypot(t.x - e.x, t.y - e.y), a = aimAt(e, t);
      const want = d > 110 ? 1 : d < 70 ? -1 : 0;
      N.moveEnt(e, (Math.cos(a) * want + Math.cos(e.t * 1.3) * 0.6) * e.spd * dt, (Math.sin(a) * want + Math.sin(e.t * 1.7) * 0.6) * e.spd * dt);
      e.face = Math.cos(a) >= 0 ? 1 : -1;
      e.cd -= dt;
      if (e.cd <= 0) { e.cd = e.def.shot.cd; e.burst = e.def.shot.burst; e.bt = 0; }
      if (e.burst > 0) { e.bt -= dt; if (e.bt <= 0) { e.bt = 0.13; e.burst--; N.eshoot(e.x, e.y, a, e.def.shot.speed, { r: 3 }); if (e.elite) fan(e, a, 2, 0.25, e.def.shot.speed); } }
    },
    knight(e, t, dt) {
      const a = aimAt(e, t); e.faceA = a;
      if (e.mode === 'wind') { e.mt -= dt; if (e.mt <= 0) { e.mode = 'charge'; e.mt = 0.55; } return; }
      if (e.mode === 'charge') { e.mt -= dt; if (N.moveEnt(e, Math.cos(e.ca) * 150 * dt, Math.sin(e.ca) * 150 * dt) || e.mt <= 0) { e.mode = 'idle'; e.cd = N.rand(2.5, 4); } return; }
      steer(e, t.x, t.y, e.spd, dt); e.cd -= dt;
      if (e.cd <= 0 && Math.hypot(t.x - e.x, t.y - e.y) < 110) { e.mode = 'wind'; e.mt = 0.5; e.ca = a; }
    },
    bat(e, t, dt) {
      const a = aimAt(e, t) + Math.sin(e.t * 5 + e.anim) * 1.1;
      N.moveEnt(e, Math.cos(a) * e.spd * dt, Math.sin(a) * e.spd * dt); e.face = Math.cos(a) >= 0 ? 1 : -1;
    },
    caster(e, t, dt) {
      const d = Math.hypot(t.x - e.x, t.y - e.y), a = aimAt(e, t);
      if (d > 130) steer(e, t.x, t.y, e.spd, dt); else if (d < 70) N.moveEnt(e, -Math.cos(a) * e.spd * dt, -Math.sin(a) * e.spd * dt);
      e.face = Math.cos(a) >= 0 ? 1 : -1;
      e.cd -= dt; e.tp = (e.tp || 0) - dt;
      if (d < 40 && e.tp <= 0 && G.curRoom) { const q = N.randomPoint(G.curRoom, 90, t.x, t.y); N.spark(e.x, e.y, '#2a8a8a', 10, 50); e.x = q.x; e.y = q.y; e.tp = 4; N.spark(e.x, e.y, '#2a8a8a', 10, 50); }
      if (e.cd <= 0) { e.cd = e.def.shot.cd; e.spin = 1.1; e.sa = Math.random() * TAU; e.sk = 0; }
      if (e.spin > 0) { e.spin -= dt; e.sk -= dt; if (e.sk <= 0) { e.sk = 0.09; e.sa += 0.5; N.eshoot(e.x, e.y - 5, e.sa, e.def.shot.speed, { r: 3, silent: true }); N.eshoot(e.x, e.y - 5, e.sa + Math.PI, e.def.shot.speed, { r: 3, silent: true }); } }
    },
    jumper(e, t, dt) {
      e.mt -= dt;
      if (e.mode === 'jump') {
        const k = 1 - e.mt / 0.6; e.x = N.lerp(e.jx0, e.jx1, k); e.y = N.lerp(e.jy0, e.jy1, k); e.air = Math.sin(k * Math.PI) * 26;
        if (e.mt <= 0) { e.air = 0; e.mode = 'idle'; e.mt = N.rand(1, 1.8); ring(e.x, e.y, e.def.shot.n + (e.elite ? 4 : 0), e.def.shot.speed, Math.random(), { color: '#9fe8ff' }); N.shake(1); }
        return;
      }
      steer(e, t.x, t.y, e.spd * 0.6, dt);
      if (e.mt <= 0) { let tx = t.x + N.rand(-12, 12), ty = t.y + N.rand(-12, 12); if (N.hitsWall(tx, ty, 6)) { tx = e.x; ty = e.y; } e.mode = 'jump'; e.mt = 0.6; e.jx0 = e.x; e.jy0 = e.y; e.jx1 = tx; e.jy1 = ty; }
    },
    scorpion(e, t, dt) {
      if (e.mode === 'aim') { e.mt -= dt; if (e.mt <= 0) { e.mode = 'idle'; fan(e, aimAt(e, t), e.def.shot.n + (e.elite ? 2 : 0), e.def.shot.spread, e.def.shot.speed, { color: '#9aff4a' }); } return; }
      steer(e, t.x, t.y, e.spd, dt); e.cd -= dt;
      if (e.cd <= 0) { e.cd = e.def.shot.cd; e.mode = 'aim'; e.mt = 0.4; }
    },
    burrower(e, t, dt) {
      e.mt -= dt;
      if (e.mode === 'idle') { e.mode = 'under'; e.mt = N.rand(1.6, 2.6); }
      if (e.mode === 'under') { e.intangible = true; steer(e, t.x, t.y, e.spd * 1.3, dt); if (Math.random() < 0.3) N.part(e.x + N.rand(-5, 5), e.y, N.rand(-20, 20), -30, '#c08c52', 0.4, 2, 100); if (e.mt <= 0) { e.mode = 'rise'; e.mt = 0.5; } return; }
      if (e.mode === 'rise') { if (e.mt <= 0) { e.mode = 'up'; e.mt = 1.6; e.intangible = false; ring(e.x, e.y, e.def.shot.n + (e.elite ? 4 : 0), e.def.shot.speed, Math.random(), { color: '#e8c890' }); N.shake(2); N.sfx('slam'); } return; }
      if (e.mode === 'up') { if (e.mt <= 0) { e.mode = 'under'; e.mt = N.rand(1.6, 2.6); } }
    },
    slammer(e, t, dt) {
      if (e.mode === 'wind') { e.mt -= dt; if (e.mt <= 0) { e.mode = 'rest'; e.mt = 1; N.sfx('slam'); N.shake(4); N.shockwave(e.x, e.y + 4, 70, 1, '#e8c890'); } return; }
      if (e.mode === 'rest') { e.mt -= dt; if (e.mt <= 0) e.mode = 'idle'; return; }
      steer(e, t.x, t.y, e.spd, dt); e.cd -= dt;
      if (e.cd <= 0 && Math.hypot(t.x - e.x, t.y - e.y) < 60) { e.mode = 'wind'; e.mt = 0.75; e.cd = 2.5; }
    },
    kamikaze(e, t, dt) {
      if (e.mode === 'fuse') { e.mt -= dt; if (e.mt <= 0) { e.alive = false; N.explosion(e.x, e.y, 26, '#e8c890'); N.sfx('explode'); if (Math.hypot(G.p.x - e.x, G.p.y - e.y) < 30) N.hurtPlayer(2, 'boom'); N.areaDamage(e.x, e.y, 26, 20); } return; }
      const a = aimAt(e, t) + Math.sin(e.t * 4) * 0.4; N.moveEnt(e, Math.cos(a) * e.spd * dt, Math.sin(a) * e.spd * dt); e.face = Math.cos(a) >= 0 ? 1 : -1;
      if (Math.hypot(t.x - e.x, t.y - e.y) < 20) { e.mode = 'fuse'; e.mt = 0.5; }
    },
    bomber(e, t, dt) {
      e.ang = (e.ang || Math.random() * TAU) + dt * 0.9;
      const tx = t.x + Math.cos(e.ang) * 60, ty = t.y + Math.sin(e.ang) * 45;
      N.moveEnt(e, N.clamp(tx - e.x, -1, 1) * e.spd * dt, N.clamp(ty - e.y, -1, 1) * e.spd * dt); e.face = tx > e.x ? 1 : -1;
      e.cd -= dt;
      if (e.cd <= 0) {
        e.cd = N.rand(1.8, 2.6); const bx = t.x + N.rand(-8, 8), by = t.y + N.rand(-8, 8), sx = e.x, sy = e.y;
        N.delayed(0.9, () => { N.explosion(bx, by, 18, '#e8dcc8'); N.sfx('explode'); if (Math.hypot(G.p.x - bx, G.p.y - by) < 18) N.hurtPlayer(1, 'bomb'); if (e.elite) ring(bx, by, 6, 80); },
          (ctx, k) => { ctx.strokeStyle = 'rgba(255,80,60,' + (0.4 + k * 0.5) + ')'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(bx, by, 18, 0, TAU); ctx.stroke(); ctx.fillStyle = 'rgba(255,80,60,0.15)'; ctx.beginPath(); ctx.arc(bx, by, 18 * k, 0, TAU); ctx.fill(); ctx.drawImage(S.misc.bone, N.lerp(sx, bx, k) - 5, N.lerp(sy - 20, by, k * k) - 3); });
      }
    },
    toad(e, t, dt) {
      e.mt -= dt;
      if (e.mode === 'hop') {
        N.moveEnt(e, e.vx * dt, e.vy * dt); e.air = Math.sin(N.clamp(1 - e.mt / 0.45, 0, 1) * Math.PI) * 10;
        if (e.mt <= 0) { e.air = 0; e.mode = 'idle'; e.mt = N.rand(0.6, 1.1); fan(e, aimAt(e, t), e.def.shot.n + (e.elite ? 2 : 0), e.def.shot.spread, e.def.shot.speed, { color: '#9aff4a' }); }
      } else if (e.mt <= 0) { const a = aimAt(e, t) + N.rand(-0.25, 0.25), sp = e.spd * 2.6; e.vx = Math.cos(a) * sp; e.vy = Math.sin(a) * sp; e.face = Math.cos(a) >= 0 ? 1 : -1; e.mode = 'hop'; e.mt = 0.45; }
    },
    witch(e, t, dt) {
      const d = Math.hypot(t.x - e.x, t.y - e.y), a = aimAt(e, t);
      if (d > 130) steer(e, t.x, t.y, e.spd, dt); else if (d < 70) N.moveEnt(e, -Math.cos(a) * e.spd * dt, -Math.sin(a) * e.spd * dt);
      e.face = Math.cos(a) >= 0 ? 1 : -1; e.cd -= dt;
      if (e.cd <= 0) {
        e.cd = e.def.shot.cd * N.rand(0.9, 1.2); e.casts = (e.casts || 0) + 1;
        fan(e, a, e.def.shot.n + (e.elite ? 2 : 0), e.def.shot.spread, e.def.shot.speed, { color: '#9aff4a' });
        if (e.casts % 2 === 0) { const px = t.x, py = t.y; N.delayed(0.9, () => G.areas.push({ x: px, y: py, r: 16, life: 4, max: 4, team: 'e', dmg: 1, tick: 0.6, kind: 'poison' }), (ctx, k) => { ctx.strokeStyle = 'rgba(154,255,74,' + (0.4 + k * 0.6) + ')'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(px, py, 16, 0, TAU); ctx.stroke(); }); }
      }
    },
    mortar(e, t, dt) {
      e.cd -= dt; e.face = t.x > e.x ? 1 : -1;
      if (e.cd <= 0) {
        e.cd = e.def.shot.cd * N.rand(0.85, 1.15); N.sfx('eshoot');
        for (let i = 0; i < (e.elite ? 3 : 1); i++) {
          const bx = t.x + (i ? N.rand(-34, 34) : 0), by = t.y + (i ? N.rand(-34, 34) : 0), sx = e.x, sy = e.y - 16;
          N.delayed(1.05, () => { N.explosion(bx, by, 16, '#ff8a2a'); N.sfx('explode'); if (Math.hypot(G.p.x - bx, G.p.y - by) < 17) N.hurtPlayer(1, 'bomb'); G.areas.push({ x: bx, y: by, r: 9, life: 2.5, max: 2.5, team: 'e', dmg: 1, tick: 0.6, kind: 'fire' }); },
            (ctx, k) => { ctx.strokeStyle = 'rgba(255,120,40,' + (0.4 + k * 0.6) + ')'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(bx, by, 16, 0, TAU); ctx.stroke(); const x = N.lerp(sx, bx, k), y = N.lerp(sy, by, k) - Math.sin(k * Math.PI) * 60; ctx.drawImage(S.misc.lavaBomb, x - 4, y - 4); });
        }
      }
    },
    turret(e, t, dt) {
      e.sa = (e.sa || 0) + dt * 1.3; e.cd -= dt; e.mt -= dt;
      if (e.mt <= 0) { e.on = !e.on; e.mt = e.on ? 2.2 : 1.5; }
      if (e.on && e.cd <= 0) { e.cd = e.def.shot.cd; for (let i = 0; i < e.def.shot.n + (e.elite ? 1 : 0); i++) N.eshoot(e.x, e.y - 8, e.sa + i / (e.def.shot.n + (e.elite ? 1 : 0)) * TAU, e.def.shot.speed, { r: 2.5, silent: true, color: '#5fe3d6' }); }
    },
  };
  N.AI = AI;

  N.shockwave = (x, y, maxR, dmg, color, speed = 120, o = {}) => {
    let hitP = false;
    N.addFx({ life: maxR / speed, update: (f) => {
      const r = (f.t / f.life) * maxR, p = G.p, d = Math.hypot(p.x - x, p.y - y);
      if (!hitP && Math.abs(d - r) < 6 && !p.air) { hitP = true; N.hurtPlayer(dmg, 'wave'); }
    }, draw: (ctx, k) => { ctx.globalAlpha = 1 - k * 0.7; ctx.strokeStyle = color; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(x, y, maxR * k, maxR * k * 0.75, 0, 0, TAU); ctx.stroke(); ctx.globalAlpha = 1; } });
  };

  N.updateEnemies = (dt) => {
    for (const e of G.enemies) {
      if (!e.alive) continue;
      e.t += dt; e.anim += dt; e.flash = Math.max(0, e.flash - dt);
      const s = e.st;
      for (const k in s) if (s[k] > 0) s[k] -= dt;
      // damage over time
      e.dot = (e.dot || 0) + dt;
      if (e.dot >= 0.5) {
        e.dot = 0;
        if (s.burn > 0) { N.hurtEnemy(e, 1.5 * (G.p ? G.p.stats.dmg : 1), { color: '#ff8a3a' }); N.part(e.x, e.y - 6, 0, -30, '#ff8a3a', 0.4, 2); }
        if (s.poison > 0 && e.alive) N.hurtEnemy(e, 2 * (G.p ? G.p.stats.dmg : 1), { color: '#9aff4a' });
        if (s.bleed > 0 && e.alive) N.hurtEnemy(e, 1.2, { color: '#ff3a4a' });
        if (s.rootDot > 0 && e.alive) N.hurtEnemy(e, 1, { color: '#7ed05a' });
        if (!e.alive) continue;
      }
      // knockback
      if (Math.abs(e.kx) + Math.abs(e.ky) > 1) {
        const r = N.moveEnt(e, e.kx * dt, e.ky * dt);
        if (r && e.wallBonus && Math.hypot(e.kx, e.ky) > 80) { N.hurtEnemy(e, e.wallBonus, { color: '#ffb03a' }); N.shake(2); e.wallBonus = 0; }
        e.kx *= Math.pow(0.002, dt); e.ky *= Math.pow(0.002, dt);
        if (Math.hypot(e.kx, e.ky) < 20) e.wallBonus = 0;
      }
      if (!e.alive) continue;
      if (e.boss) { N.updateBoss(e, dt); continue; }
      if (e.dummy) { e.dps = (e.dps || 0) * Math.pow(0.5, dt); continue; }
      if (s.stun > 0 || s.freeze > 0) continue;
      const t = N.enemyTarget(e);
      const slow = (s.slow > 0 ? 0.5 : 1) * (s.root > 0 ? 0 : 1);
      if (s.fear > 0) { const a = Math.atan2(e.y - t.y, e.x - t.x); N.moveEnt(e, Math.cos(a) * e.def.speed * 1.2 * dt, Math.sin(a) * e.def.speed * 1.2 * dt); continue; }
      const sp0 = e.spd; e.spd = sp0 * slow;
      if (s.root > 0 && !['shooter', 'kiter', 'tank', 'floater', 'caster', 'turret', 'scorpion'].includes(e.def.ai)) { e.spd = sp0; continue; }
      AI[e.def.ai](e, t, dt * (s.slow > 0 ? 0.7 : 1) * (G.run && G.diff ? G.diff.tempo : 1));
      e.spd = sp0;
      if (e.def.trail) { if (e.lx === undefined) { e.lx = e.x; e.ly = e.y; } if (Math.hypot(e.x - e.lx, e.y - e.ly) > 12) { e.lx = e.x; e.ly = e.y; G.areas.push({ x: e.x, y: e.y + 2, r: 7, life: 2, max: 2, team: 'e', dmg: 1, tick: 0.6, kind: 'fire' }); } }
      if (e.alive) contact(e);
    }
    // corpses fade
    G.enemies = G.enemies.filter((e) => e.alive);
  };

  // ================================================================ allies (summons) and damage zones
  G.allies = []; G.areas = [];
  N.updateAllies = (dt) => {
    for (const a of G.allies) { a.t = (a.t || 0) + dt; a.life -= dt; if (a.upd) a.upd(a, dt); if (a.life <= 0 || a.hp <= 0) { a.dead = true; if (a.onEnd) a.onEnd(a); } }
    G.allies = G.allies.filter((a) => !a.dead);
    for (const z of G.areas) {
      z.t = (z.t || 0) + dt; z.life -= dt; z.tt = (z.tt || 0) - dt;
      if (z.tt <= 0) { z.tt = z.tick || 0.4; if (z.team === 'e') { if (Math.hypot(G.p.x - z.x, G.p.y - z.y) < z.r) N.hurtPlayer(z.dmg || 1, 'zone'); } else for (const e of G.enemies) if (e.alive && !e.intangible && Math.hypot(e.x - z.x, e.y - z.y) < z.r + e.r) z.onTick(e, z); }
      if (z.life <= 0) z.dead = true;
    }
    G.areas = G.areas.filter((z) => !z.dead);
  };
  N.fireZone = (x, y, r = 9, life = 3) => G.areas.push({ x, y, r, life, max: life, tick: 0.45, onTick: (e) => N.hurtEnemy(e, 2 * G.p.stats.dmg * G.p.stats.abilDmg, { burn: true, color: '#ff8a3a' }), kind: 'fire' });

  // ================================================================ drawing
  N.snap = (v) => Math.round(v * N.RS) / N.RS;
  N.drawShadow = (ctx, x, y, w) => { ctx.globalAlpha = 0.55; ctx.drawImage(N.shadowTex, x - w * 1.25, y - w * 0.5, w * 2.5, w); ctx.globalAlpha = 1; };
  N.handPos = (p) => { const h = S.hero[p.char]; return { x: p.x + p.face * (h.hand[0] / N.RS - h.ox), y: p.y - h.oy + h.hand[1] / N.RS - (p.bob || 0) }; };
  N.drawWeapon = (ctx, p) => {
    const w = N.weaponOf(p); if (!w || p.form === 'dragon' || p.air > 6) return;
    const spr = S.wp[w.id], hp = N.handPos(p), hx = hp.x, hy = hp.y;
    let a = p.aim;
    if (p.swing && !p.swing.thrust) { const k = p.swing.t / p.swing.dur; a += (k - 0.5) * p.swing.arc * p.face * (p.face > 0 ? 1 : 1); }
    ctx.save(); ctx.translate(hx, hy); ctx.rotate(a);
    if (Math.cos(a) < 0) ctx.scale(1, -1);
    let ox = 0; if (p.swing && p.swing.thrust) ox = Math.sin(p.swing.t / p.swing.dur * Math.PI) * 10; if (p.kick) { ox -= p.kick; p.kick = Math.max(0, p.kick - 0.5); }
    ctx.drawImage(spr, -spr.grip[0] / N.RS + ox, -spr.grip[1] / N.RS, spr.W, spr.H);
    ctx.restore();
  };
  N.drawPlayer = (ctx, p) => {
    const drag = p.form === 'dragon';
    const spr = N.heroSprite(p);
    p.bob = !p.moving && Math.sin(p.anim * 3) > 0.3 ? 1 : 0;
    N.drawShadow(ctx, p.x, p.y + 2, drag ? 12 : 7 - Math.min(4, p.air / 10));
    if (p.inv > 0 && Math.floor(p.inv * 20) % 2 === 0) ctx.globalAlpha = 0.45;
    if (p.buffs.invuln > 0) ctx.globalAlpha = 0.7;
    const behind = Math.sin(p.aim) < -0.2;
    if (behind) N.drawWeapon(ctx, p);
    if (p.stance && p.stance.t > 0) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.5 + Math.sin(G.time * 20) * 0.2; ctx.strokeStyle = '#ffb03a'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(p.x, p.y - 8, 13, 15, 0, 0, TAU); ctx.stroke(); ctx.restore(); }
    ctx.save();
    const hm = S.hero[drag ? 'dragon' : p.char], ox = hm.ox, oy = hm.oy;
    ctx.translate(N.snap(p.x), N.snap(p.y - p.air + p.bob));
    if (p.face < 0) ctx.scale(-1, 1);
    ctx.drawImage(spr, -ox, -oy);
    if (p.hitTint) { ctx.globalAlpha = 0.5; ctx.drawImage(N.silhouette(spr, p.hitTint), -ox, -oy); }
    ctx.restore();
    if (!behind) N.drawWeapon(ctx, p);
    ctx.globalAlpha = 1;
    if (p.buffs.war > 0 || p.buffs.hawk > 0 || p.buffs.tail > 0) { if (Math.random() < 0.3) N.part(p.x + N.rand(-6, 6), p.y - N.rand(0, 14), 0, -25, p.buffs.war > 0 ? '#ffb03a' : p.buffs.hawk > 0 ? '#ffe066' : '#cfe2ff', 0.4, 1); }
  };
  N.enemySprite = (e) => {
    if (e.id === 'verme' && (e.mode === 'under' || e.mode === 'rise')) return S.en.verme_mound[Math.floor(e.anim * 8) % 2];
    const fr = S.en[e.id];
    let f = Math.floor(e.anim * (e.def.fly ? 8 : 5)) % 2;
    if (e.mode === 'wind' || e.squish) f = 1;
    return fr[f];
  };
  N.drawEnemy = (ctx, e) => {
    if (e.draw) return e.draw(ctx, e);
    if (e.boss) return N.drawBoss(ctx, e);
    const spr = e.dummy ? S.misc.dummy[e.flash > 0 ? 1 : 0] : N.enemySprite(e);
    const fly = e.def && e.def.fly, hover = fly ? 6 + Math.sin(e.anim * 4) * 2 : 0, air = e.air || 0;
    if (!(e.mode === 'under' || e.mode === 'rise')) N.drawShadow(ctx, e.x, e.y + 2, e.r);
    if (e.intangible && e.id !== 'verme') return;
    let x = N.snap(e.x + (e.mode === 'wind' ? Math.sin(e.t * 50) * 0.5 : 0)), y = N.snap(e.y - hover - air);
    if (e.mode === 'rise') x += Math.round(Math.sin(e.t * 60));
    ctx.save(); ctx.translate(x, y + 3); if (e.face < 0) ctx.scale(-1, 1); if (e.small) ctx.scale(0.62, 0.62);
    const w = spr.W, h = spr.H;
    if (e.elite) { const g = N.silhouette(spr, '#ffcf40'); for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) ctx.drawImage(g, -w / 2 + dx, -h + dy); }
    if (e.mode === 'fuse' && Math.floor(e.t * 16) % 2) ctx.drawImage(N.silhouette(spr, '#ff4a3a'), -w / 2, -h);
    else ctx.drawImage(spr, -w / 2, -h);
    if (e.flash > 0) ctx.drawImage(N.silhouette(spr, '#ffffff'), -w / 2, -h);
    else if (e.st.freeze > 0) { ctx.globalAlpha = 0.55; ctx.drawImage(N.silhouette(spr, '#9fe8ff'), -w / 2, -h); ctx.globalAlpha = 1; }
    else if (e.st.slow > 0) { ctx.globalAlpha = 0.3; ctx.drawImage(N.silhouette(spr, '#9fe8ff'), -w / 2, -h); ctx.globalAlpha = 1; }
    else if (e.st.poison > 0) { ctx.globalAlpha = 0.3; ctx.drawImage(N.silhouette(spr, '#9aff4a'), -w / 2, -h); ctx.globalAlpha = 1; }
    ctx.restore();
    N.drawStatus(ctx, e, y - spr.H + 3);
    if (e.dummy) return;
    if (e.hp < e.maxHp && !e.minionNoBar) { const bw = Math.max(10, e.r * 2); ctx.fillStyle = '#170f1f'; ctx.fillRect(Math.round(e.x - bw / 2) - 1, y + 5, bw + 2, 3); ctx.fillStyle = e.elite ? '#ffcf40' : '#ff4a5e'; ctx.fillRect(Math.round(e.x - bw / 2), y + 6, Math.ceil(bw * e.hp / e.maxHp), 1); }
  };
  N.drawStatus = (ctx, e, topY) => {
    const s = e.st;
    if (s.stun > 0) for (let i = 0; i < 3; i++) { const a = e.t * 5 + i * 2.1; ctx.fillStyle = '#ffe066'; ctx.fillRect(Math.round(e.x + Math.cos(a) * 6), Math.round(topY - 2 + Math.sin(a) * 2), 2, 2); }
    if (s.root > 0) { ctx.strokeStyle = '#5a9a3e'; ctx.lineWidth = 1; for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(e.x + i * 4, e.y + 3); ctx.quadraticCurveTo(e.x + i * 7, e.y - 4, e.x + i * 2, e.y - 7); ctx.stroke(); } }
    if (s.mark > 0) { ctx.strokeStyle = '#ff4a5e'; ctx.lineWidth = 1; const r = e.r + 4 + Math.sin(e.t * 6); ctx.beginPath(); ctx.arc(e.x, e.y - e.r, r, 0, TAU); ctx.moveTo(e.x - r - 3, e.y - e.r); ctx.lineTo(e.x + r + 3, e.y - e.r); ctx.moveTo(e.x, e.y - e.r - r - 3); ctx.lineTo(e.x, e.y - e.r + r + 3); ctx.stroke(); }
    if (s.burn > 0 && Math.random() < 0.3) N.part(e.x + N.rand(-4, 4), e.y - N.rand(2, 10), 0, -30, Math.random() < 0.5 ? '#ff8a3a' : '#ffe066', 0.35, 1);
    if (s.fear > 0) { ctx.fillStyle = '#c66bff'; ctx.fillRect(Math.round(e.x) - 1, Math.round(topY - 6), 2, 4); ctx.fillRect(Math.round(e.x) - 1, Math.round(topY - 1), 2, 1); }
  };
  N.drawProj = (ctx, b) => {
    const spr = b.spr; if (!spr) return;
    if (b.round) { ctx.drawImage(spr, N.snap(b.x - spr.W / 2), N.snap(b.y - spr.H / 2)); return; }
    ctx.save(); ctx.translate(N.snap(b.x), N.snap(b.y)); ctx.rotate(b.spin ? b.t * b.spin : Math.atan2(b.vy, b.vx));
    if (b.alpha) ctx.globalAlpha = b.alpha;
    ctx.drawImage(spr, -spr.W / 2, -spr.H / 2); ctx.restore();
  };
})();
