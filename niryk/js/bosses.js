// Niryk — the three world bosses: Mãe-Musgo (Overworld), Nyx'ara (Mundo Reverso) and Kharun (Wasteland dos Colossos).
// Each picks attacks from a pool and gains new patterns below half health.
'use strict';
(function () {
  const N = window.N, S = N.S, TS = N.TS, G = N.G, TAU = Math.PI * 2;

  N.spawnBoss = (id, room) => {
    const def = N.BOSSES[id], dm = G.run && G.diff ? 1 + (G.diff.hp - 1) * 0.8 : 1;
    const e = {
      kind: 'enemy', boss: true, id, def: Object.assign({ ai: 'boss' }, def), x: (room.cx + 0.5) * TS, y: (room.y0 + room.h * 0.35) * TS, r: def.r,
      hp: def.hp * dm, maxHp: def.hp * dm, vx: 0, vy: 0, kx: 0, ky: 0, face: -1, t: 0, st: {}, mode: 'intro', mt: 1.6, cd: 0, flash: 0, fly: true,
      alive: true, anim: 0, room, last: '', p2: false, minions: [],
    };
    if (id === 'kharun') {
      e.x = (room.x0 + room.w / 2) * TS; e.y = (room.y0 + 4.6) * TS; e.r = 26;
      e.fists = [-1, 1].map((s) => ({ s, hx: e.x + s * 78, hy: e.y + 26, x: e.x + s * 78, y: e.y + 26, z: 0, mode: 'home', mt: 0 }));
    }
    if (G.run && G.diff && G.diff.furious) e.p2 = true;
    G.enemies.push(e);
    N.save.codex.b[id] = 1;
    return e;
  };

  function choose(e, list) {
    const opts = list.filter((m) => m !== e.last);
    const m = N.pick(opts.length ? opts : list); e.last = m; return m;
  }
  function minionsAlive(e) { e.minions = e.minions.filter((m) => m.alive); return e.minions.length; }
  function summon(e, ids, max) {
    const room = e.room;
    for (const id of ids) {
      if (minionsAlive(e) >= max) break;
      const q = N.randomPoint(room, 50, G.p.x, G.p.y);
      N.delayed(0.7, () => { const m = N.spawnEnemy(id, q.x, q.y, { hpMul: 1, minion: true }); e.minions.push(m); N.spark(q.x, q.y, '#ffffff', 8, 40); },
        (ctx, k) => { ctx.strokeStyle = '#ff4a5e'; ctx.globalAlpha = 0.5 + k * 0.5; ctx.beginPath(); ctx.arc(q.x, q.y, 10 * (1 - k) + 3, 0, TAU); ctx.stroke(); ctx.globalAlpha = 1; });
    }
  }
  function phaseCheck(e) {
    if (!e.p2 && e.hp < e.maxHp * 0.5) {
      e.p2 = true; N.text(e.x, e.y - 40, 'FÚRIA!', '#ff4a5e', true); N.sfx('roar'); N.shake(6);
      N.ring(e.x, e.y, 24, 90, 0); e.mode = 'idle'; e.mt = 1;
    }
  }
  const telegraphCircle = (x, y, r) => (ctx, k) => { ctx.strokeStyle = 'rgba(255,74,94,' + (0.4 + 0.6 * k) + ')'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke(); ctx.fillStyle = 'rgba(255,74,94,0.18)'; ctx.beginPath(); ctx.arc(x, y, r * k, 0, TAU); ctx.fill(); };

  const B = {};
  // ---------------------------------------------------------------- Mãe-Musgo
  B.musgo = (e, dt) => {
    const p = G.p; phaseCheck(e); e.mt -= dt;
    const a = Math.atan2(p.y - e.y, p.x - e.x); e.face = Math.cos(a) >= 0 ? 1 : -1;
    switch (e.mode) {
      case 'intro': if (e.mt <= 0) { e.mode = 'idle'; e.mt = 1; } break;
      case 'idle':
        N.steer(e, p.x, p.y, e.p2 ? 26 : 16, dt);
        if (Math.hypot(p.x - e.x, p.y - e.y) < e.r + p.r) N.hurtPlayer(1, 'boss');
        if (e.mt <= 0) {
          e.mode = choose(e, e.p2 ? ['slam', 'seeds', 'vines', 'roll', 'summon', 'slam'] : ['slam', 'seeds', 'summon', 'seeds', 'slam']);
          e.mt = { slam: 0.85, seeds: 2.2, summon: 0.6, vines: 0.7, roll: 0.6 }[e.mode]; e.k = 0; e.sa = Math.random() * TAU;
        }
        break;
      case 'slam':
        e.wind = true;
        if (e.mt <= 0) {
          e.wind = false; N.sfx('slam'); N.shake(7); N.shockwave(e.x, e.y + 10, 130, 1, '#a8c878', 130);
          N.ring(e.x, e.y, e.p2 ? 26 : 18, 85, Math.random());
          if (e.p2) N.delayed(0.35, () => N.ring(e.x, e.y, 26, 70, Math.random()));
          e.mode = 'rest'; e.mt = 0.9;
        }
        break;
      case 'seeds':
        e.k -= dt;
        if (e.k <= 0) { e.k = e.p2 ? 0.06 : 0.08; e.sa += 0.37; const n = e.p2 ? 3 : 2; for (let i = 0; i < n; i++) N.eshoot(e.x, e.y - 8, e.sa + i * TAU / n, 80, { color: '#c8a050', silent: i > 0 }); }
        if (e.mt <= 0) { e.mode = 'rest'; e.mt = 0.7; }
        break;
      case 'summon':
        if (e.mt <= 0) { summon(e, ['gosmo', 'gosmo', 'gosmo', e.p2 ? 'cogumelo' : 'gosmo'], 6); N.sfx('roar'); e.mode = 'rest'; e.mt = 0.8; }
        break;
      case 'vines':
        if (e.mt <= 0) {
          for (const off of [-0.45, 0, 0.45]) {
            const la = a + off;
            for (let i = 1; i < 13; i++) {
              const x = e.x + Math.cos(la) * i * 15, y = e.y + Math.sin(la) * i * 15;
              if (N.solidPx(x, y)) break;
              N.delayed(0.55 + i * 0.05, () => { N.spark(x, y, '#5a9a3e', 6, 50); if (Math.hypot(p.x - x, p.y - y) < 10) N.hurtPlayer(1, 'vine'); N.addFx({ life: 0.5, draw: (ctx, k) => { ctx.globalAlpha = 1 - k; ctx.fillStyle = '#4f9a3c'; ctx.beginPath(); ctx.moveTo(x - 4, y + 2); ctx.lineTo(x, y - 12); ctx.lineTo(x + 4, y + 2); ctx.fill(); ctx.globalAlpha = 1; } }); }, telegraphCircle(x, y, 8));
            }
          }
          e.mode = 'rest'; e.mt = 1.4;
        }
        break;
      case 'roll':
        if (!e.rolling) { e.wind = true; if (e.mt <= 0) { e.rolling = true; e.wind = false; e.ra = a; e.mt = 1.4; N.sfx('charge'); } }
        else {
          const r = N.moveEnt(e, Math.cos(e.ra) * 170 * dt, Math.sin(e.ra) * 170 * dt);
          if (r) { if (r.hx) e.ra = Math.PI - e.ra; if (r.hy) e.ra = -e.ra; N.shake(3); N.ring(e.x, e.y, 8, 70, Math.random()); }
          if (Math.hypot(p.x - e.x, p.y - e.y) < e.r + p.r) N.hurtPlayer(2, 'boss');
          if (e.mt <= 0) { e.rolling = false; e.mode = 'rest'; e.mt = 0.8; }
        }
        break;
      case 'rest': if (e.mt <= 0) { e.mode = 'idle'; e.mt = e.p2 ? 0.8 : 1.3; } break;
    }
  };

  // ---------------------------------------------------------------- Nyx'ara
  B.nyxara = (e, dt) => {
    const p = G.p; phaseCheck(e); e.mt -= dt;
    const a = Math.atan2(p.y - e.y, p.x - e.x);
    switch (e.mode) {
      case 'intro': if (e.mt <= 0) { e.mode = 'idle'; e.mt = 0.8; } break;
      case 'idle':
        N.moveEnt(e, Math.cos(e.t * 0.9) * 25 * dt, Math.sin(e.t * 1.3) * 18 * dt);
        if (e.mt <= 0) {
          e.mode = choose(e, e.p2 ? ['tele', 'fan', 'laser', 'clones', 'shards', 'laser'] : ['tele', 'fan', 'laser', 'clones', 'shards']);
          e.mt = { tele: 0.9, fan: 0.4, laser: 1, clones: 0.8, shards: 0.5 }[e.mode]; e.k = 0; e.n = 0;
          if (e.mode === 'laser') { e.la = a; e.beams = e.p2 ? [-0.7, 0, 0.7] : [0]; }
        }
        break;
      case 'tele':
        e.alpha = Math.abs(e.mt - 0.45) / 0.45; e.intangible = e.mt < 0.6 && e.mt > 0.3;
        if (!e.moved && e.mt < 0.45) { const q = N.randomPoint(e.room, 100, p.x, p.y); e.x = q.x; e.y = q.y; e.moved = true; N.spark(e.x, e.y, '#d05aff', 14, 70); N.sfx('magic'); }
        if (e.mt <= 0) { e.alpha = 1; e.intangible = false; e.moved = false; e.mode = 'fan'; e.mt = 0.3; e.n = 0; }
        break;
      case 'fan':
        if (e.mt <= 0) { const n = e.p2 ? 9 : 7; N.fan(e, a, n, 0.5, 105, { color: '#d05aff' }); e.n++; e.mt = 0.38; if (e.n >= (e.p2 ? 5 : 3)) { e.mode = 'rest'; e.mt = 0.7; } }
        break;
      case 'laser':
        if (e.mt > 0) { e.la += N.clamp(N.angDiff(e.la, a), -0.6 * dt, 0.6 * dt); e.laserOn = false; }
        else {
          e.laserOn = true; e.la += (e.p2 ? 0.5 : 0.25) * dt * (e.sweepDir || (e.sweepDir = Math.random() < 0.5 ? 1 : -1));
          for (const off of e.beams) { const ang = e.la + off, ex = e.x + Math.cos(ang) * 400, ey = e.y + Math.sin(ang) * 400; if (N.segDist(p.x, p.y - 4, e.x, e.y, ex, ey) < 7) N.hurtPlayer(1, 'laser'); }
          if (e.mt < -0.9) { e.laserOn = false; e.sweepDir = 0; e.mode = 'rest'; e.mt = 0.6; }
        }
        break;
      case 'clones':
        if (e.mt <= 0) {
          const n = e.p2 ? 3 : 2;
          for (let i = 0; i < n; i++) {
            if (minionsAlive(e) >= 4) break;
            const q = N.randomPoint(e.room, 70, p.x, p.y);
            const c = { kind: 'enemy', id: 'nyxclone', def: { ai: 'clone', r: 10, touch: 0, world: 1, name: 'Reflexo' }, x: q.x, y: q.y, r: 10, hp: 45, maxHp: 45, vx: 0, vy: 0, kx: 0, ky: 0, face: 1, t: 0, st: {}, mode: 'idle', mt: 9, cd: 1 + i * 0.4, flash: 0, fly: true, alive: true, anim: 0, minion: true, noDrop: true, spd: 20 };
            c.draw = drawClone; G.enemies.push(c); e.minions.push(c); N.spark(q.x, q.y, '#d05aff', 12, 60);
          }
          N.sfx('magic'); e.mode = 'rest'; e.mt = 0.6;
        }
        break;
      case 'shards':
        if (e.mt <= 0) {
          for (const dir of e.p2 ? [1, -1] : [1]) for (let i = 0; i < 14; i++) N.eshoot(e.x, e.y, i / 14 * TAU + (dir < 0 ? 0.2 : 0), 95, { color: '#f0a8ff', curve: 0.9 * dir, life: 5, spr: S.misc.shard, round: false, r: 3 });
          e.mode = 'rest'; e.mt = 1.1;
        }
        break;
      case 'rest': if (e.mt <= 0) { e.mode = 'idle'; e.mt = e.p2 ? 0.5 : 0.9; } break;
    }
  };
  N.AI.clone = (c, t, dt) => {
    c.mt -= dt; c.alpha = Math.min(1, c.mt);
    N.moveEnt(c, Math.cos(c.t * 1.5 + c.x) * 20 * dt, Math.sin(c.t * 1.1) * 20 * dt);
    c.cd -= dt;
    if (c.cd <= 0) { c.cd = 1.7; N.fan(c, Math.atan2(t.y - c.y, t.x - c.x), 5, 0.4, 90, { color: '#f0a8ff' }); }
    if (c.mt <= 0) { c.alive = false; N.spark(c.x, c.y, '#d05aff', 10, 50); }
  };
  function drawClone(ctx, c) {
    const spr = S.boss.nyxara[0];
    ctx.save(); ctx.globalAlpha = 0.55 * (c.alpha === undefined ? 1 : Math.max(0, c.alpha)); ctx.translate(Math.round(c.x), Math.round(c.y + Math.sin(c.t * 3) * 2));
    ctx.drawImage(spr, -spr.W / 4, -spr.H / 2 - 4, spr.W / 2, spr.H / 2);
    if (c.flash > 0) ctx.drawImage(N.silhouette(spr, '#ffffff'), -spr.W / 4, -spr.H / 2 - 4, spr.W / 2, spr.H / 2);
    ctx.restore();
  }

  // ---------------------------------------------------------------- Kharun
  B.kharun = (e, dt) => {
    const p = G.p; phaseCheck(e); e.mt -= dt;
    for (const f of e.fists) updateFist(e, f, dt);
    switch (e.mode) {
      case 'intro': if (e.mt <= 0) { e.mode = 'idle'; e.mt = 1; } break;
      case 'idle':
        if (e.mt <= 0) {
          e.mode = choose(e, e.p2 ? ['fist', 'laser', 'rain', 'spiral', 'summon', 'fist'] : ['fist', 'laser', 'rain', 'fist']);
          e.mt = { fist: 0.1, laser: 1.1, rain: 0.4, spiral: 3.2, summon: 0.6 }[e.mode]; e.n = 0; e.k = 0; e.sa = Math.random() * TAU;
        }
        break;
      case 'fist':
        if (e.mt <= 0 && e.fists.every((f) => f.mode === 'home')) {
          if (e.n >= (e.p2 ? 3 : 2)) { e.mode = 'rest'; e.mt = 0.6; break; }
          const f = e.fists[e.n % 2]; f.mode = 'track'; f.mt = e.p2 ? 0.8 : 1.05; e.n++; e.mt = 0.15;
        }
        break;
      case 'laser':
        if (e.mt > 0) { e.charging = true; if (Math.random() < 0.8) { const ang = Math.random() * TAU; N.part(e.x + Math.cos(ang) * 30, e.y + Math.sin(ang) * 30, -Math.cos(ang) * 60, -Math.sin(ang) * 60, '#ffb02e', 0.5, 2); } e.la = e.sweep0 = e.p2 && e.n % 2 ? Math.PI - 0.25 : 0.25; }
        else {
          e.charging = false; e.laserOn = true;
          const dir = e.sweep0 > 1 ? -1 : 1; e.la += dir * (Math.PI - 0.5) / 2.3 * dt;
          const ex = e.x + Math.cos(e.la) * 420, ey = e.y + Math.sin(e.la) * 420;
          if (N.segDist(p.x, p.y - 4, e.x, e.y, ex, ey) < 9) N.hurtPlayer(1, 'laser');
          if (e.mt < -2.3) { e.laserOn = false; e.n++; if (e.p2 && e.n < 2) e.mt = 0.5; else { e.mode = 'rest'; e.mt = 0.8; } }
        }
        break;
      case 'rain':
        if (e.mt <= 0) {
          const n = e.p2 ? 16 : 10;
          for (let i = 0; i < n; i++) {
            const x = i === 0 ? p.x : p.x + N.rand(-95, 95), y = i === 0 ? p.y : p.y + N.rand(-70, 70);
            if (N.solidPx(x, y)) continue;
            N.delayed(0.9 + i * 0.07, () => { N.explosion(x, y, 12, '#a88a62'); N.sfx('slam'); if (Math.hypot(p.x - x, p.y - y) < 13) N.hurtPlayer(1, 'rock'); if (e.p2) N.ring(x, y, 4, 70, Math.random(), { silent: true }); },
              (ctx, k) => { telegraphCircle(x, y, 13)(ctx, k); ctx.globalAlpha = k; ctx.drawImage(S.misc.rock, x - 6, y - 6 - (1 - k) * 120); ctx.globalAlpha = 1; });
          }
          N.shake(3); N.sfx('roar'); e.mode = 'rest'; e.mt = 1.6;
        }
        break;
      case 'spiral':
        e.k -= dt;
        if (e.k <= 0) { e.k = 0.09; e.sa += 0.21; for (let i = 0; i < 3; i++) N.eshoot(e.x, e.y + 4, e.sa + i * TAU / 3, 90, { color: '#ff3a5a', silent: i > 0 }); }
        if (e.mt <= 0) { e.mode = 'rest'; e.mt = 0.8; }
        break;
      case 'summon':
        if (e.mt <= 0) { summon(e, ['poeira', 'poeira', 'escorpiao'], 4); N.sfx('roar'); e.mode = 'rest'; e.mt = 0.6; }
        break;
      case 'rest': if (e.mt <= 0) { e.mode = 'idle'; e.mt = e.p2 ? 0.5 : 0.9; } break;
    }
  };
  function updateFist(e, f, dt) {
    const p = G.p; f.mt -= dt;
    if (f.mode === 'home') { f.x = N.lerp(f.x, f.hx, dt * 4); f.y = N.lerp(f.y, f.hy + Math.sin(e.t * 2 + f.s) * 3, dt * 4); f.z = N.lerp(f.z, 0, dt * 4); }
    else if (f.mode === 'track') { f.x = N.lerp(f.x, p.x, dt * 6); f.y = N.lerp(f.y, p.y, dt * 6); f.z = N.lerp(f.z, 60, dt * 6); if (f.mt <= 0) { f.mode = 'drop'; f.mt = 0.16; f.tx = f.x; f.ty = f.y; } }
    else if (f.mode === 'drop') { f.z = Math.max(0, f.z - 420 * dt); if (f.mt <= 0) { f.z = 0; f.mode = 'ground'; f.mt = 0.55; N.sfx('slam'); N.shake(6); N.explosion(f.x, f.y, 16, '#c8a878'); if (Math.hypot(p.x - f.x, p.y - f.y) < 24) N.hurtPlayer(1, 'fist'); N.shockwave(f.x, f.y, 70, 1, '#e8c890'); N.ring(f.x, f.y, e.p2 ? 12 : 8, 80, Math.random(), { silent: true }); } }
    else if (f.mode === 'ground') { if (f.mt <= 0) f.mode = 'home'; }
  }

  // ---------------------------------------------------------------- Gorgulho, the Toad King
  const poisonPuddle = (x, y, r = 14, life = 4) => G.areas.push({ x, y, r, life, max: life, team: 'e', dmg: 1, tick: 0.6, kind: 'poison' });
  B.gorgulho = (e, dt) => {
    const p = G.p; phaseCheck(e); e.mt -= dt;
    const a = Math.atan2(p.y - e.y, p.x - e.x); if (!e.leaping) e.face = Math.cos(a) >= 0 ? 1 : -1;
    switch (e.mode) {
      case 'intro': if (e.mt <= 0) { e.mode = 'idle'; e.mt = 1; } break;
      case 'idle':
        N.steer(e, p.x, p.y, e.p2 ? 22 : 14, dt);
        if (Math.hypot(p.x - e.x, p.y - e.y) < e.r + p.r) N.hurtPlayer(1, 'boss');
        if (e.mt <= 0) { e.mode = choose(e, e.p2 ? ['leap', 'tongue', 'bubbles', 'rain', 'leap', 'summon'] : ['leap', 'tongue', 'bubbles', 'summon']); e.mt = { leap: 0.6, tongue: 0.8, bubbles: 0.5, rain: 0.5, summon: 0.6 }[e.mode]; e.n = 0; e.la = a; }
        break;
      case 'leap':
        if (!e.leaping) { e.wind = true; if (e.mt <= 0) { e.wind = false; e.leaping = true; e.lt = 0; e.jx0 = e.x; e.jy0 = e.y; e.jx1 = p.x; e.jy1 = p.y; } }
        else {
          e.lt += dt; const k = Math.min(1, e.lt / 0.8);
          e.x = N.lerp(e.jx0, e.jx1, k); e.y = N.lerp(e.jy0, e.jy1, k); e.air = Math.sin(k * Math.PI) * 60; e.intangible = k < 0.85;
          if (k >= 1) {
            e.leaping = false; e.air = 0; e.intangible = false; N.sfx('slam'); N.shake(8); N.shockwave(e.x, e.y + 6, 120, 1, '#9aff4a', 130);
            N.ring(e.x, e.y, e.p2 ? 20 : 14, 80, Math.random(), { color: '#9aff4a' });
            if (Math.hypot(p.x - e.x, p.y - e.y) < e.r + 8) N.hurtPlayer(2, 'boss');
            e.n++; if (e.p2 && e.n < 2) { e.mt = 0.35; } else { e.mode = 'rest'; e.mt = 0.9; }
          }
        }
        break;
      case 'tongue':
        if (e.mt > 0) { e.la += N.clamp(N.angDiff(e.la, a), -1.2 * dt, 1.2 * dt); e.tele = true; }
        else {
          e.tele = false; e.tongue = 0.32; N.sfx('swing');
          const ex = e.x + Math.cos(e.la) * 170, ey = e.y - 6 + Math.sin(e.la) * 170;
          if (N.segDist(p.x, p.y - 4, e.x, e.y - 6, ex, ey) < 9) N.hurtPlayer(1, 'tongue');
          e.n++; if (e.n < (e.p2 ? 3 : 2)) { e.mt = 0.55; } else { e.mode = 'rest'; e.mt = 0.7; }
        }
        break;
      case 'bubbles':
        if (e.mt <= 0) {
          const n = e.p2 ? 9 : 6;
          for (let i = 0; i < n; i++) N.eshoot(e.x, e.y - 10, a + (i / (n - 1) - 0.5) * 1.6, N.rand(50, 75), { color: '#9aff4a', r: 5, life: 1.6, onEnd: (b) => poisonPuddle(b.x, b.y) });
          e.mode = 'rest'; e.mt = 1;
        }
        break;
      case 'rain':
        if (e.mt <= 0) {
          for (let i = 0; i < 10; i++) { const x = p.x + N.rand(-90, 90), y = p.y + N.rand(-70, 70); if (N.solidPx(x, y)) continue; N.delayed(0.9 + i * 0.06, () => { N.spark(x, y, '#9aff4a', 8, 50); poisonPuddle(x, y, 13, 3.5); if (Math.hypot(p.x - x, p.y - y) < 13) N.hurtPlayer(1, 'bubble'); }, telegraphCircle(x, y, 13)); }
          N.sfx('roar'); e.mode = 'rest'; e.mt = 1.2;
        }
        break;
      case 'summon':
        if (e.mt <= 0) { summon(e, ['sapo', 'sapo', e.p2 ? 'mosquito' : 'sapo'], 5); N.sfx('roar'); e.mode = 'rest'; e.mt = 0.8; }
        break;
      case 'rest': if (e.mt <= 0) { e.mode = 'idle'; e.mt = e.p2 ? 0.7 : 1.1; } break;
    }
    if (e.tongue > 0) e.tongue -= dt;
  };

  // ---------------------------------------------------------------- Glacia, the Winter Queen
  B.glacia = (e, dt) => {
    const p = G.p; phaseCheck(e); e.mt -= dt;
    const a = Math.atan2(p.y - e.y, p.x - e.x);
    switch (e.mode) {
      case 'intro': if (e.mt <= 0) { e.mode = 'idle'; e.mt = 0.8; } break;
      case 'idle':
        N.moveEnt(e, Math.cos(e.t * 0.8) * 22 * dt, Math.sin(e.t * 1.1) * 16 * dt);
        if (e.mt <= 0) { e.mode = choose(e, e.p2 ? ['spikes', 'flake', 'freeze', 'blizzard', 'tele', 'summon'] : ['spikes', 'flake', 'freeze', 'tele']); e.mt = { spikes: 0.7, flake: 2.4, freeze: 0.2, blizzard: 4, tele: 0.9, summon: 0.6 }[e.mode]; e.n = 0; e.k = 0; e.sa = Math.random() * TAU; }
        break;
      case 'spikes':
        if (e.mt <= 0) {
          const offs = e.p2 ? [-0.7, -0.35, 0, 0.35, 0.7] : [-0.4, 0, 0.4];
          for (const off of offs) for (let i = 1; i < 12; i++) {
            const x = e.x + Math.cos(a + off) * i * 15, y = e.y + Math.sin(a + off) * i * 15; if (N.solidPx(x, y)) break;
            N.delayed(0.5 + i * 0.05, () => { N.spark(x, y, '#bfe8ff', 6, 50); if (Math.hypot(p.x - x, p.y - y) < 10) { N.hurtPlayer(1, 'ice'); p.buffs.slow = 1.2; } N.addFx({ life: 0.6, draw: (ctx, k) => { ctx.globalAlpha = 1 - k * k; ctx.drawImage(S.misc.iceSpike, x - 4, y - 12); ctx.globalAlpha = 1; } }); }, telegraphCircle(x, y, 8));
          }
          N.sfx('magic'); e.mode = 'rest'; e.mt = 1.3;
        }
        break;
      case 'flake':
        e.k -= dt;
        if (e.k <= 0) { e.k = e.p2 ? 0.1 : 0.13; e.sa += 0.18; for (let i = 0; i < 6; i++) N.eshoot(e.x, e.y, e.sa + i * TAU / 6, 80, { color: '#bfe8ff', silent: i > 0 }); }
        if (e.mt <= 0) { e.mode = 'rest'; e.mt = 0.7; }
        break;
      case 'freeze':
        if (e.mt <= 0) {
          for (let i = 0; i < (e.p2 ? 4 : 3); i++) N.delayed(i * 0.45, () => { const x = p.x, y = p.y; N.delayed(0.8, () => { N.explosion(x, y, 20, '#bfe8ff'); N.sfx('shield'); if (Math.hypot(p.x - x, p.y - y) < 20) { N.hurtPlayer(1, 'ice'); p.buffs.slow = 2; } N.ring(x, y, 6, 70, Math.random(), { color: '#bfe8ff', silent: true }); }, telegraphCircle(x, y, 20)); });
          e.mode = 'rest'; e.mt = 2;
        }
        break;
      case 'blizzard': {
        e.k -= dt; const room = e.room;
        if (e.k <= 0) { e.k = 0.12; const x = (room.x0 + Math.random() * room.w) * TS, y = room.y0 * TS + 4; N.eshoot(x, y, Math.PI / 2 + N.rand(-0.35, 0.35), N.rand(45, 70), { color: '#ffffff', r: 2.5, silent: true, life: 7 }); }
        if (e.mt <= 0) { e.mode = 'rest'; e.mt = 0.6; }
        break;
      }
      case 'tele':
        e.alpha = Math.abs(e.mt - 0.45) / 0.45; e.intangible = e.mt < 0.6 && e.mt > 0.3;
        if (!e.moved && e.mt < 0.45) { const q = N.randomPoint(e.room, 100, p.x, p.y); e.x = q.x; e.y = q.y; e.moved = true; N.spark(e.x, e.y, '#bfe8ff', 14, 70); N.sfx('magic'); }
        if (e.mt <= 0) { e.alpha = 1; e.intangible = false; e.moved = false; e.mode = 'flake'; e.mt = 1.4; e.k = 0; }
        break;
      case 'summon':
        if (e.mt <= 0) { summon(e, ['nevasca', 'morcego_gelo', 'morcego_gelo'], 4); N.sfx('magic'); e.mode = 'rest'; e.mt = 0.6; }
        break;
      case 'rest': if (e.mt <= 0) { e.mode = 'idle'; e.mt = e.p2 ? 0.5 : 0.9; } break;
    }
  };

  // ---------------------------------------------------------------- Ignavar, the Magma Dragon
  B.ignavar = (e, dt) => {
    const p = G.p; phaseCheck(e); e.mt -= dt;
    const a = Math.atan2(p.y - e.y, p.x - e.x); if (!e.charging2) e.face = Math.cos(a) >= 0 ? 1 : -1;
    switch (e.mode) {
      case 'intro': if (e.mt <= 0) { e.mode = 'idle'; e.mt = 1; } break;
      case 'idle':
        N.steer(e, p.x + Math.cos(e.t) * 60, p.y - 50, 30, dt);
        if (e.mt <= 0) { e.mode = choose(e, e.p2 ? ['breath', 'meteors', 'charge', 'rings', 'lava', 'breath'] : ['breath', 'meteors', 'charge', 'rings']); e.mt = { breath: 0.7, meteors: 0.4, charge: 0.7, rings: 0.3, lava: 0.5 }[e.mode]; e.n = 0; e.k = 0; e.la = a; }
        break;
      case 'breath':
        if (e.mt > 0) { e.wind = true; e.la += N.clamp(N.angDiff(e.la, a), -1.5 * dt, 1.5 * dt); }
        else {
          e.wind = false; e.breathing = true; e.k -= dt; e.la += Math.sin(-e.mt * 2.4) * 0.9 * dt;
          if (e.k <= 0) { e.k = 0.05; const mx = e.x + e.face * 24, my = e.y - 14; for (let i = 0; i < 2; i++) N.eshoot(mx, my, e.la + N.rand(-0.25, 0.25), N.rand(110, 150), { color: '#ff8a2a', r: 3, life: 1.2, silent: true }); }
          if (e.mt < -1.5) { e.breathing = false; e.mode = 'rest'; e.mt = 0.8; }
        }
        break;
      case 'meteors':
        if (e.mt <= 0) {
          const n = e.p2 ? 14 : 9;
          for (let i = 0; i < n; i++) {
            const x = i === 0 ? p.x : p.x + N.rand(-100, 100), y = i === 0 ? p.y : p.y + N.rand(-70, 70); if (N.solidPx(x, y)) continue;
            N.delayed(0.9 + i * 0.07, () => { N.explosion(x, y, 14, '#ff8a2a'); N.sfx('explode'); if (Math.hypot(p.x - x, p.y - y) < 14) N.hurtPlayer(1, 'meteor'); G.areas.push({ x, y, r: 9, life: 2.5, max: 2.5, team: 'e', dmg: 1, tick: 0.6, kind: 'fire' }); },
              (ctx, k) => { telegraphCircle(x, y, 14)(ctx, k); ctx.globalAlpha = k; ctx.drawImage(S.misc.meteor, x - 4 + (1 - k) * 60, y - 4 - (1 - k) * 120); ctx.globalAlpha = 1; });
          }
          N.shake(3); N.sfx('roar'); e.mode = 'rest'; e.mt = 1.5;
        }
        break;
      case 'charge':
        if (!e.charging2) { e.wind = true; if (e.mt <= 0) { e.wind = false; e.charging2 = true; e.ca = a; e.mt = 1.1; e.bounced = 0; N.sfx('charge'); e.face = Math.cos(a) >= 0 ? 1 : -1; } }
        else {
          const r = N.moveEnt(e, Math.cos(e.ca) * 230 * dt, Math.sin(e.ca) * 230 * dt);
          if (Math.random() < 0.5) G.areas.push({ x: e.x, y: e.y + 10, r: 9, life: 2.2, max: 2.2, team: 'e', dmg: 1, tick: 0.6, kind: 'fire' });
          if (Math.hypot(p.x - e.x, p.y - e.y) < e.r + p.r) N.hurtPlayer(2, 'boss');
          if (r) { N.shake(5); N.ring(e.x, e.y, 10, 80, Math.random(), { color: '#ff8a2a' }); if (r.hx) e.ca = Math.PI - e.ca; if (r.hy) e.ca = -e.ca; e.bounced++; e.face = Math.cos(e.ca) >= 0 ? 1 : -1; }
          if (e.mt <= 0 || e.bounced > (e.p2 ? 2 : 1)) { e.charging2 = false; e.mode = 'rest'; e.mt = 0.9; }
        }
        break;
      case 'rings':
        if (e.mt <= 0) { N.ring(e.x, e.y, e.p2 ? 22 : 16, 80, e.n * 0.15, { color: '#ffb02e' }); N.sfx('explode'); e.n++; e.mt = 0.45; if (e.n >= 3) { e.mode = 'rest'; e.mt = 0.8; } }
        break;
      case 'lava':
        if (e.mt <= 0) { for (let i = 0; i < 6; i++) { const q = N.randomPoint(e.room, 40, p.x, p.y); N.delayed(0.6, () => G.areas.push({ x: q.x, y: q.y, r: 22, life: 6, max: 6, team: 'e', dmg: 1, tick: 0.6, kind: 'fire' }), telegraphCircle(q.x, q.y, 22)); } e.mode = 'rest'; e.mt = 0.8; }
        break;
      case 'rest': if (e.mt <= 0) { e.mode = 'idle'; e.mt = e.p2 ? 0.5 : 0.9; } break;
    }
  };

  N.updateBoss = (e, dt) => {
    if (G.p && G.p.alive) B[e.id](e, dt);
  };

  N.drawBoss = (ctx, e) => {
    const spr = S.boss[e.id][e.wind || e.charging || e.laserOn ? 1 : Math.floor(e.anim * 2) % 2 && e.id !== 'musgo' ? 1 : 0];
    if (e.id === 'kharun') {
      for (const f of e.fists) { N.drawShadow(ctx, f.x, f.y + 6, 12 + f.z * 0.05); if (f.mode === 'track') { ctx.strokeStyle = 'rgba(255,74,94,0.7)'; ctx.beginPath(); ctx.arc(f.x, f.y + 4, 22, 0, TAU); ctx.stroke(); } }
      if (e.laserOn) drawBeam(ctx, e.x, e.y, e.la, '#ffb02e', 7);
      ctx.drawImage(spr, Math.round(e.x - spr.W / 2), Math.round(e.y - spr.H / 2 + Math.sin(e.t * 1.5) * 2));
      if (e.flash > 0) ctx.drawImage(N.silhouette(spr, '#ffffff'), Math.round(e.x - spr.W / 2), Math.round(e.y - spr.H / 2 + Math.sin(e.t * 1.5) * 2));
      for (const f of e.fists) { const fs = S.boss.fist[f.mode === 'ground' ? 1 : 0]; ctx.save(); ctx.translate(Math.round(f.x), Math.round(f.y - f.z)); if (f.s > 0) ctx.scale(-1, 1); ctx.drawImage(fs, -fs.W / 2, -fs.H + 6); ctx.restore(); }
      return;
    }
    if (e.id === 'nyxara') {
      if (e.mode === 'laser') { if (e.laserOn) for (const off of e.beams) drawBeam(ctx, e.x, e.y, e.la + off, '#ff4ad0', 5); else for (const off of e.beams) { ctx.strokeStyle = 'rgba(255,74,208,0.5)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.lineTo(e.x + Math.cos(e.la + off) * 400, e.y + Math.sin(e.la + off) * 400); ctx.stroke(); } }
      N.drawShadow(ctx, e.x, e.y + 26, 14);
      ctx.globalAlpha = e.alpha === undefined ? 1 : N.clamp(e.alpha, 0, 1);
      const y = Math.round(e.y + Math.sin(e.t * 2) * 3);
      ctx.drawImage(spr, Math.round(e.x - spr.W / 2), y - spr.H / 2);
      if (e.flash > 0) ctx.drawImage(N.silhouette(spr, '#ffffff'), Math.round(e.x - spr.W / 2), y - spr.H / 2);
      for (let i = 0; i < 6; i++) { const a = e.t * 1.2 + i * TAU / 6; ctx.drawImage(S.misc.shard, Math.round(e.x + Math.cos(a) * 32 - 5), Math.round(y + Math.sin(a) * 26 - 7)); }
      ctx.globalAlpha = 1;
      return;
    }
    if (e.id === 'glacia') {
      N.drawShadow(ctx, e.x, e.y + 24, 14);
      ctx.globalAlpha = e.alpha === undefined ? 1 : N.clamp(e.alpha, 0, 1);
      const y = e.y + Math.sin(e.t * 2) * 3;
      ctx.drawImage(spr, e.x - spr.W / 2, y - spr.H / 2);
      if (e.flash > 0) ctx.drawImage(N.silhouette(spr, '#ffffff'), e.x - spr.W / 2, y - spr.H / 2);
      for (let i = 0; i < 6; i++) { const a = -e.t * 1.4 + i * TAU / 6; ctx.drawImage(S.misc.iceSpike, e.x + Math.cos(a) * 30 - 4, y + Math.sin(a) * 22 - 6, 8, 13); }
      ctx.globalAlpha = 1; return;
    }
    if (e.id === 'gorgulho') {
      N.drawShadow(ctx, e.x, e.y + 6, 26 - (e.air || 0) * 0.15);
      if (e.leaping) { const k = Math.min(1, e.lt / 0.8); ctx.strokeStyle = 'rgba(255,74,94,0.8)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(e.jx1, e.jy1, 26 * (1 - k * 0.3), 0, TAU); ctx.stroke(); }
      if (e.tele) { ctx.strokeStyle = 'rgba(255,120,160,0.6)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(e.x, e.y - 6); ctx.lineTo(e.x + Math.cos(e.la) * 170, e.y - 6 + Math.sin(e.la) * 170); ctx.stroke(); }
      if (e.tongue > 0) { ctx.strokeStyle = '#e87ac0'; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(e.x, e.y - 6); ctx.lineTo(e.x + Math.cos(e.la) * 170 * Math.min(1, (0.32 - e.tongue) * 8 + 0.3), e.y - 6 + Math.sin(e.la) * 170 * Math.min(1, (0.32 - e.tongue) * 8 + 0.3)); ctx.stroke(); ctx.lineCap = 'butt'; }
      const fr = S.boss.gorgulho[e.wind || e.tongue > 0 || e.mode === 'bubbles' ? 1 : 0];
      ctx.save(); ctx.translate(N.snap(e.x + (e.wind ? Math.sin(e.t * 50) : 0)), N.snap(e.y + 8 - (e.air || 0))); if (e.face < 0) ctx.scale(-1, 1);
      if (e.wind) ctx.scale(1.06, 0.92);
      ctx.drawImage(fr, -fr.W / 2, -fr.H + 4); if (e.flash > 0) ctx.drawImage(N.silhouette(fr, '#ffffff'), -fr.W / 2, -fr.H + 4);
      ctx.restore(); return;
    }
    if (e.id === 'ignavar') {
      N.drawShadow(ctx, e.x, e.y + 20, 28);
      const fr = S.boss.ignavar[e.breathing || e.wind ? 1 : 0], hov = Math.sin(e.t * 2.5) * 3;
      ctx.save(); ctx.translate(N.snap(e.x), N.snap(e.y + 18 + hov)); if (e.face < 0) ctx.scale(-1, 1);
      ctx.drawImage(fr, -fr.W / 2, -fr.H + 4); if (e.flash > 0) ctx.drawImage(N.silhouette(fr, '#ffffff'), -fr.W / 2, -fr.H + 4);
      ctx.restore(); return;
    }
    // musgo
    N.drawShadow(ctx, e.x, e.y + 4, 24);
    const sx = e.wind ? Math.sin(e.t * 50) : 0;
    ctx.save(); ctx.translate(Math.round(e.x + sx), Math.round(e.y + 6)); if (e.face < 0) ctx.scale(-1, 1);
    if (e.rolling) ctx.rotate(e.t * 10);
    ctx.drawImage(spr, -spr.W / 2, -spr.H + 4);
    if (e.flash > 0) ctx.drawImage(N.silhouette(spr, '#ffffff'), -spr.W / 2, -spr.H + 4);
    ctx.restore();
  };
  function drawBeam(ctx, x, y, a, c, w) {
    const ex = x + Math.cos(a) * 420, ey = y + Math.sin(a) * 420;
    ctx.lineCap = 'round';
    ctx.strokeStyle = c; ctx.globalAlpha = 0.5; ctx.lineWidth = w + 4 + Math.sin(G.time * 40) * 1.5; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(ex, ey); ctx.stroke();
    ctx.globalAlpha = 1; ctx.lineWidth = w; ctx.stroke(); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.stroke(); ctx.lineCap = 'butt';
    if (Math.random() < 0.7) N.spark(x + Math.cos(a) * N.rand(20, 200), y + Math.sin(a) * N.rand(20, 200), c, 1, 40);
  }
})();
