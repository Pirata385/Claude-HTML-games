/* Filogênese — IA das criaturas: rotina (vagar, pastar, dormir), fuga, caça, território, bando. */
(function (FG) {
  'use strict';
  const U = FG.U;
  const rnd = Math.random;
  const AI = FG.AI = {};
  let G = null;
  const NICHES = FG.Species.NICHES;

  AI.init = function (c, home, o) {
    c.ai = {
      st: 'idle', t: 0, dur: 0.5 + rnd() * 3, next: rnd() * 0.5, tx: c.x, ty: c.y,
      home: { x: home.x, y: home.y, r: home.r || 240 }, leash: home.leash || 1000,
      tgt: null, flee: null, hunger: 15 + rnd() * 70, pack: false, slot: 0,
      avoidT: 0, avoidA: 0, stuck: 0, fails: 0, lx: c.x, ly: c.y, food: null, bush: null, parent: null, greetT: 4 + rnd() * 10,
    };
    if (o) Object.assign(c.ai, o);
    return c.ai;
  };

  function set(c, st, dur) {
    const ai = c.ai;
    ai.st = st; ai.t = 0; ai.dur = dur || 0; ai.fails = 0;
    c.sleeping = st === 'sleep';
  }
  AI.set = set;
  function startFight(c, t) {
    const ai = c.ai;
    if (ai.st !== 'fight' || ai.tgt !== t) { if (ai.st !== 'fight') G.voice(c, 'growl'); ai.tgt = t; set(c, 'fight'); }
  }
  function startFlee(c, t) {
    const ai = c.ai;
    if (ai.st !== 'flee') { G.voice(c, 'yelp'); set(c, 'flee'); }
    ai.flee = t;
  }
  function goHome(c) { if (c.ai.st !== 'return') set(c, 'return'); }
  function shouldSleep(sp) { return !sp.isPlayer && (G.night > 0.6) !== !!sp.nocturnal; }
  AI.shouldSleep = (sp) => { G = FG.Game; return shouldSleep(sp); };

  /** Reação a um golpe. */
  AI.onHit = function (c, att, g) {
    G = g;
    const ai = c.ai;
    if (!ai || c.dead || !att || att.dead) return;
    c.sleeping = false;
    if (ai.pack) { if (!att.isPlayer && !(att.ai && att.ai.pack)) G.packTarget = att; return; }
    const N = NICHES[c.sp.niche];
    if (c.baby || N.react === 'flee' || (c.hp < c.maxHp * 0.3 && N.fear > 0.3)) startFlee(c, att);
    else if (ai.st !== 'fight' || rnd() < 0.35) startFight(c, att);
  };

  AI.update = function (c, g, dt) {
    G = g;
    const ai = c.ai;
    if (!ai || c.dead) { c.mx = c.my = 0; return; }
    ai.t += dt;
    if ((ai.next -= dt) <= 0) { ai.next = 0.22 + rnd() * 0.2; if (ai.pack) decidePack(c); else decide(c); }
    act(c, dt);
  };

  function decide(c) {
    const ai = c.ai, sp = c.sp, N = NICHES[sp.niche], P = G.player, st = ai.st;
    if (st === 'social' || st === 'mate' || st === 'eat') return;
    const rel = G.rel(sp), ally = rel.status === 'ally' || sp.isPlayer, angry = rel.anger > 0 && !sp.isPlayer;
    const pOK = !P.dead && !G.cine;
    const dP = pOK ? U.dist(c.x, c.y, P.x, P.y) : 1e9;
    const dHome = U.dist(c.x, c.y, ai.home.x, ai.home.y);
    let sense = (230 + 42 * sp.stats.sense) * (sp.isTitan ? 1.3 : 1);
    if ((G.night > 0.6) !== !!sp.nocturnal) sense *= 0.72;
    const pSense = sense * (P.sneaking ? Math.max(0.2, 0.52 - 0.06 * P.stats.stealth) : 1) * (P.wet >= 2 ? 0.6 : 1);

    if (st === 'fight') {
      const t = ai.tgt;
      if (!t || t.dead || (t.isPlayer && !pOK) || U.dist(c.x, c.y, t.x, t.y) > 760 || dHome > ai.leash || (t.wet >= 2 && !c.canSwim)) { ai.tgt = null; goHome(c); }
      else if (c.hp < c.maxHp * 0.25 && N.fear > 0.3) startFlee(c, t);
      return;
    }
    if (st === 'flee') {
      const f = ai.flee;
      if (!f || f.dead || ai.t > 8 || U.dist(c.x, c.y, f.x, f.y) > 660) { ai.flee = null; goHome(c); }
      return;
    }
    if (st === 'sleep') {
      if (shouldSleep(sp) && !angry && !(pOK && dP < 105 && !P.sneaking && !ally)) return;
      set(c, 'idle', 0.6);
    }
    if (c.baby) {
      if (pOK && !ally && dP < 180 && (G.stance === 'combat' || P.sprinting || angry)) return startFlee(c, P);
      if (st === 'idle' && ai.t > ai.dur) {
        const par = ai.parent && !ai.parent.dead ? ai.parent : null;
        const base = par || ai.home, p = G.world.randomNear(base.x, base.y, 20, par ? 70 : 120, rnd, c);
        ai.tx = p.x; ai.ty = p.y; set(c, 'wander');
      }
      return;
    }

    // ---- vizinhança: ameaças, presas e sinais do grupo ----
    let threat = null, prey = null, td = 1e9, pd = 1e9, joinT = null;
    const list = G.near(c.x, c.y, sense), hunter = N.react === 'hunter';
    for (let i = 0; i < list.length; i++) {
      const o = list[i];
      if (o === c || o.dead || o.isPlayer) continue;
      const d = U.dist(c.x, c.y, o.x, o.y);
      if (o.sp === sp) {
        const oa = o.ai;
        if (oa && d < 420) {
          if (oa.st === 'fight' && oa.tgt && !oa.tgt.dead) joinT = oa.tgt;
          else if (oa.st === 'flee' && oa.flee && N.react === 'flee' && d < 300 && !threat) { threat = oa.flee; td = d; }
        }
        continue;
      }
      if (o.ai && o.ai.pack) { if (!ally && hunter && d < pd && !G.tooStrong(c)) { prey = o; pd = d; } continue; }
      if (o.baby) { if (hunter && ai.hunger <= 0 && d < pd) { prey = o; pd = d; } continue; }
      const oN = NICHES[o.sp.niche];
      if (oN.react === 'hunter' || o.sp.isTitan) {
        if (!hunter && !sp.isTitan && o.sp.stats.bulk > sp.stats.bulk * 0.6 && (d < 190 || (o.ai && o.ai.tgt === c)) && d < td) { threat = o; td = d; }
      } else if (hunter && ai.hunger <= 0 && !o.sp.isTitan && !o.sp.isPlayer && o.sp.stats.bulk < sp.stats.bulk * 1.7 && d < pd) { prey = o; pd = d; }
    }

    // ---- o jogador ----
    if (pOK && dP < pSense && (!ally || angry)) {
      const r = N.react;
      if (angry) { if (N.fear > 0.55 || c.hp < c.maxHp * 0.3) return startFlee(c, P); return startFight(c, P); }
      if (r === 'hunter' && dP < pSense * 0.85 && !G.tooStrong(c) && !c.friend) return startFight(c, P);
      if (r === 'territorial' && !c.friend) {
        const dn = U.dist(P.x, P.y, ai.home.x, ai.home.y);
        if (dn < ai.home.r + 80 || dP < 150) {
          if (st !== 'warn') { set(c, 'warn', 2.6); c.play('roar', 1.1); G.voice(c, 'growl'); FG.FX.add('anger', c.x, c.y - c.radius - 14); G.warned(c); }
          return;
        }
      }
      if (r === 'flee' && !c.friend) {
        if ((G.stance === 'combat' || P.sprinting) && dP < 250 && !P.sneaking) return startFlee(c, P);
        if (dP < 190 && st !== 'watch' && st !== 'graze') { set(c, 'watch', 1.5 + rnd() * 2); return; }
      }
    }
    if (joinT && N.react !== 'flee' && !(joinT.isPlayer && ally && !angry) && !(joinT.ai && joinT.ai.pack && ally)) return startFight(c, joinT);
    if (threat) { if (N.react === 'defend' || N.react === 'territorial') return startFight(c, threat); return startFlee(c, threat); }
    if (prey) return startFight(c, prey);
    if (st === 'warn') return;
    if (st === 'watch') { if (ai.t > ai.dur) set(c, 'idle', 1); return; }

    // ---- rotina ----
    if (shouldSleep(sp)) {
      if (dHome < 130) { if (st !== 'sleep') set(c, 'sleep'); }
      else goHome(c);
      return;
    }
    if (dHome > ai.leash * 0.8 && st !== 'prowl') return goHome(c);
    if (st === 'idle' && ai.t > ai.dur) routine(c);
  }

  function routine(c) {
    const ai = c.ai, sp = c.sp, diet = sp.diet;
    // caçador com fome sai para rondar o ninho de presas mais próximo
    if (NICHES[sp.niche].react === 'hunter' && ai.hunger <= 0) {
      const n = (ai.prowls | 0) < 3 ? G.preyNest(c) : null;
      if (n) { const p = G.world.randomNear(n.x, n.y, 60, 200, rnd, c); ai.tx = p.x; ai.ty = p.y; ai.prowls = (ai.prowls | 0) + 1; return set(c, 'prowl'); }
      ai.hunger = 40 + rnd() * 40; ai.prowls = 0;
    }
    if (ally(sp) && (ai.greetT -= 1) < 0) ai.greetT = 8 + rnd() * 10;
    if (diet !== 'H' && rnd() < 0.5) {
      const car = G.findCarcass(c.x, c.y, 430, c);
      if (car) { ai.food = car; ai.tx = car.x; ai.ty = car.y; return set(c, 'scavenge'); }
    }
    if (diet !== 'C' && rnd() < 0.4) {
      const b = G.world.findBush(c.x, c.y, 360);
      if (b && U.dist(b.x, b.y, ai.home.x, ai.home.y) < ai.leash * 0.7) { ai.bush = b; ai.tx = b.x; ai.ty = b.y; return set(c, 'graze'); }
    }
    const lead = c.nest && c.nest.members && c.nest.members[0];
    const follow = lead && lead !== c && !lead.dead && lead.ai && rnd() < 0.6;
    const p = follow ? G.world.randomNear(lead.ai.tx, lead.ai.ty, 20, 110, rnd, c) : G.world.randomNear(ai.home.x, ai.home.y, 30, ai.home.r, rnd, c);
    ai.tx = p.x; ai.ty = p.y; set(c, 'wander');
  }
  function ally(sp) { return sp.isPlayer || G.rel(sp).status === 'ally'; }

  function decidePack(c) {
    const ai = c.ai, P = G.player;
    if (ai.st === 'social') return;
    const pt = G.packTarget;
    if (pt && !pt.dead && !P.dead && U.dist(P.x, P.y, pt.x, pt.y) < 640 && pt !== c) { if (ai.st !== 'fight' || ai.tgt !== pt) { ai.tgt = pt; set(c, 'fight'); } return; }
    ai.tgt = null;
    if (ai.st !== 'follow') set(c, 'follow');
  }

  /** Anda até (x, y) contornando obstáculos; devolve true ao chegar (ou desistir). */
  function go(c, x, y, tol, dt) {
    const ai = c.ai, dx = x - c.x, dy = y - c.y, d = Math.hypot(dx, dy);
    if (d < tol) return true;
    let a = Math.atan2(dy, dx);
    if (c.bumped) { c.bumped = false; ai.avoidT = 0.7; ai.avoidA = (rnd() < 0.5 ? 1 : -1) * 1.3; ai.fails++; }
    ai.stuck += dt;
    if (ai.stuck > 1) {
      if (U.dist(c.x, c.y, ai.lx, ai.ly) < 10 && !c.anim && c.stun <= 0) { ai.avoidT = 0.8; ai.avoidA = (rnd() < 0.5 ? 1 : -1) * 1.5; ai.fails++; }
      ai.lx = c.x; ai.ly = c.y; ai.stuck = 0;
    }
    if (ai.fails >= 4 && ai.st !== 'fight' && ai.st !== 'follow') { ai.fails = 0; return true; }
    if (ai.avoidT > 0) { ai.avoidT -= dt; a += ai.avoidA; }
    c.mx = Math.cos(a); c.my = Math.sin(a);
    return false;
  }

  function fight(c, dt) {
    const ai = c.ai, t = ai.tgt;
    if (!t || t.dead) return;
    const dx = t.x - c.x, dy = t.y - c.y, d = Math.hypot(dx, dy), st = c.stats;
    const range = c.reach + t.radius * 0.9;
    c.lookAt = t;
    if (c.dash > 0 || c.stun > 0) return;
    const busy = !!c.anim;
    if (!busy && st.spit > 0 && c.cd.spit <= 0 && d < 340 && d > 70) G.useAbility(c, 'spit', t);
    else if (!busy && st.charge > 0 && c.cd.charge <= 0 && d > 120 && d < 330) G.useAbility(c, 'charge', t);
    if (d > range * 0.8) { go(c, t.x, t.y, 0, dt); c.sprint = d > 150; }
    else c.faceT = Math.atan2(dy, dx);
    if (d < range * 1.05 && !c.anim) {
      if (st.strike > 0 && c.cd.strike <= 0) G.useAbility(c, 'strike', t);
      else if (c.cd.bite <= 0) G.useAbility(c, 'bite', t);
    }
  }

  function follow(c, dt) {
    const ai = c.ai, P = G.player;
    const a = P.angle + Math.PI + (ai.slot - (G.pack.length - 1) / 2) * 0.85;
    const rr = 54 + P.radius + c.radius;
    const tx = P.x + Math.cos(a) * rr, ty = P.y + Math.sin(a) * rr;
    const d = U.dist(c.x, c.y, tx, ty);
    if (d > 1300) { c.x = tx; c.y = ty; c.vx = c.vy = 0; c.settle(); return; }
    if (d > 26) {
      go(c, tx, ty, 0, dt);
      c.sprint = d > 190 || P.sprinting; c.speedMul = d > 90 ? 1.12 : 0.6;
      if (P.jz > 10 && c.jz <= 0 && d > 60 && c.stats.jump > 1) c.jump();
    } else if (G.target) c.lookAt = G.target;
    c.sneaking = P.sneaking;
  }

  function act(c, dt) {
    const ai = c.ai, P = G.player;
    c.mx = c.my = 0; c.sprint = false; c.speedMul = 1; c.lookAt = null; c.faceT = null; c.sneaking = false;
    if (ai.hunger > 0) ai.hunger -= dt;
    switch (ai.st) {
      case 'idle': c.wagA = c.friend ? 0.5 : 0.22; break;
      case 'sleep': break;
      case 'watch': c.lookAt = P; c.faceT = Math.atan2(P.y - c.y, P.x - c.x); c.wagA = 0.08; break;
      case 'social': c.lookAt = P; c.faceT = Math.atan2(P.y - c.y, P.x - c.x); c.wagA = 0.5; break;
      case 'mate': c.lookAt = P; if (!go(c, ai.tx, ai.ty, 26, dt)) c.speedMul = 0.8; else c.faceT = Math.atan2(P.y - c.y, P.x - c.x); break;
      case 'warn':
        c.lookAt = P; c.faceT = Math.atan2(P.y - c.y, P.x - c.x);
        if (ai.t > ai.dur) {
          const near = U.dist(P.x, P.y, ai.home.x, ai.home.y) < ai.home.r + 80 || U.dist(c.x, c.y, P.x, P.y) < 150;
          if (near && !P.dead && !G.cine && G.rel(c.sp).status !== 'ally') startFight(c, P); else set(c, 'idle', 1);
        }
        break;
      case 'wander': c.speedMul = 0.5; if (go(c, ai.tx, ai.ty, 16, dt)) set(c, 'idle', 1.5 + rnd() * 4); break;
      case 'prowl': c.speedMul = 0.72; if (go(c, ai.tx, ai.ty, 50, dt)) set(c, 'idle', 1 + rnd() * 2); break;
      case 'return': c.speedMul = 0.9; if (go(c, ai.home.x, ai.home.y, 90, dt)) set(c, 'idle', 0.8 + rnd() * 2); break;
      case 'graze':
        c.speedMul = 0.6;
        if (go(c, ai.tx, ai.ty, 34 + c.radius, dt)) { if (ai.bush) { c.faceT = Math.atan2(ai.bush.y - c.y, ai.bush.x - c.x); c.play('eat', 1.6); G.npcAte(c, ai.bush); } set(c, 'eat', 1.7); }
        break;
      case 'scavenge': {
        const f = ai.food;
        if (!f || f.gone || f.meat <= 0) { set(c, 'idle', 1); break; }
        c.speedMul = 0.75;
        if (go(c, f.x, f.y, c.reach + f.radius * 0.7, dt)) { c.faceT = Math.atan2(f.y - c.y, f.x - c.x); c.play('eat', 1.6); f.meat -= 0.5; ai.hunger = 60 + rnd() * 70; ai.prowls = 0; G.npcAte(c, null, f); set(c, 'eat', 1.7); }
        break;
      }
      case 'eat': if (ai.t > ai.dur) set(c, 'idle', 1 + rnd() * 2); break;
      case 'flee': {
        const f = ai.flee;
        if (f) {
          const a = Math.atan2(c.y - f.y, c.x - f.x) + Math.sin(c.time * 2 + c.id) * 0.35;
          go(c, c.x + Math.cos(a) * 200, c.y + Math.sin(a) * 200, 0, dt);
          c.sprint = true;
        }
        break;
      }
      case 'fight': fight(c, dt); break;
      case 'follow': follow(c, dt); break;
    }
  }
})(window.FG = window.FG || {});
