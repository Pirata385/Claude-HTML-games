// Amalgamations — real-time combat: damage, crits, defence, statuses, basic attacks, the 16 power shapes,
// fused-power payloads, projectiles, zones, traps, channels and timed events. Shared by player and enemies.
(function (root) {
  'use strict';
  const AM = root.AM || (root.AM = {});
  const PI = Math.PI;
  const elColor = (el) => (el && AM.ELEMENTS[el] ? AM.ELEMENTS[el].color : '#ffffff');
  const CC = new Set(['stun', 'freeze', 'root', 'fear']);

  const C = {};
  let castCounter = 1;

  C.enemiesOf = function (G, src) {
    const out = [];
    for (const e of G.entities) if (!e.dead && e.team !== src.team && e.kind !== 'npc') out.push(e);
    return out;
  };
  C.alliesOf = function (G, src) {
    const out = [];
    for (const e of G.entities) if (!e.dead && e.team === src.team && e.kind !== 'npc') out.push(e);
    return out;
  };
  function nearestEnemy(G, src, x, z, maxD, exclude) {
    let best = null, bd = maxD;
    for (const e of C.enemiesOf(G, src)) {
      if (exclude && exclude.has(e)) continue;
      const d = AM.dist(e.x, e.z, x, z) - e.radius;
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }
  C.nearestEnemy = nearestEnemy;
  function srcLevel(G, src) { return src ? (src.kind === 'player' || src.kind === 'summon' ? G.state.level : src.level) : 1; }
  function heal(G, e, amt) {
    if (!e || e.dead || amt <= 0) return;
    const before = e.hp;
    e.hp = Math.min(e.maxHp, e.hp + amt);
    const got = e.hp - before;
    if (got >= 1 && (e.kind === 'player' || e.team === 0)) G.hud.number(e.x, 1.6 * e.scale, e.z, '+' + AM.fmt(got), 'heal');
  }
  C.heal = heal;
  function knock(G, tgt, fx, fz, force) {
    if (!tgt || tgt.dead || tgt.rank === 'boss' || tgt.kind === 'npc') return;
    if (tgt.stats.noKnock && force > 0) return;
    const dx = tgt.x - fx, dz = tgt.z - fz, d = Math.hypot(dx, dz) || 1;
    tgt.kb = { vx: (dx / d) * force * 4, vz: (dz / d) * force * 4, t: 0.18 };
  }
  C.knock = knock;

  // ---------- damage ----------
  C.damage = function (G, src, tgt, amt, o) {
    o = o || {};
    if (!tgt || tgt.dead || tgt.kind === 'npc') return 0;
    if (tgt.iframes > 0 && o.kind !== 'dot') { if (tgt.kind === 'player') G.hud.number(tgt.x, 1.8, tgt.z, 'Dodge', 'miss'); return 0; }
    const ss = src && !src.dead ? src.stats : src ? src.stats : null;
    const dot = o.kind === 'dot';
    if (!dot && src && src.status.blind && src.status.blind.t > 0 && Math.random() < 0.5) { G.hud.number(tgt.x, 1.6 * tgt.scale, tgt.z, 'Miss', 'miss'); return 0; }
    if (!dot && tgt.stats.evade && Math.random() < tgt.stats.evade) { G.hud.number(tgt.x, 1.6 * tgt.scale, tgt.z, 'Evade', 'miss'); return 0; }
    let dmg = dot ? amt : amt * (0.92 + Math.random() * 0.16);
    let crit = false;
    let pierce = o.pierce || 0, critBonus = 0;
    if (o.effects) for (const e of o.effects) { if (e.type === 'pierce') pierce = Math.max(pierce, e.power); if (e.type === 'crit') critBonus += e.power; }
    if (!dot && ss && o.kind !== 'true') {
      let cc = (ss.critChance || 0) + critBonus;
      if (src.kind === 'player' && ss.stealth && tgt.ai && tgt.ai.state === 'idle') cc = 1;
      if (o.forceCrit) cc = 1;
      if (Math.random() < cc) { crit = true; dmg *= ss.critDmg || 1.5; }
    }
    if (ss) {
      if (ss.execute && tgt.hp < tgt.maxHp * 0.5) dmg *= 1 + ss.execute;
      if (ss.lowHpDmg && src.hp < src.maxHp * 0.5) dmg *= 1 + ss.lowHpDmg;
      if (ss.night && G.isNight) dmg *= 1 + ss.night;
    }
    if (src && src.affix && src.affix.id === 'frenzied') dmg *= 1 + (1 - src.hp / src.maxHp) * 0.6;
    if (src && src.status.weaken && src.status.weaken.t > 0) dmg *= 1 - src.status.weaken.p;
    if (tgt.status.vuln && tgt.status.vuln.t > 0) dmg *= 1 + tgt.status.vuln.p;
    if (o.element === 'storm' && tgt.status.soak && tgt.status.soak.t > 0) dmg *= 1.35;
    if (ss && ss.blindVuln && tgt.status.blind && tgt.status.blind.t > 0) dmg *= 1 + ss.blindVuln;
    if (!dot && o.kind !== 'true') dmg = AM.mitigate(dmg, tgt.stats.def, srcLevel(G, src), pierce);
    dmg *= 1 - (tgt.stats.dr || 0);
    if (tgt.shield > 0) { const a = Math.min(tgt.shield, dmg); tgt.shield -= a; dmg -= a; if (a > 0 && dmg <= 0) { G.hud.number(tgt.x, 1.6 * tgt.scale, tgt.z, 'Absorbed', 'miss'); } }
    if (dmg <= 0) return 0;
    dmg = Math.max(dot ? 0.5 : 1, dmg);
    tgt.hp -= dmg;
    tgt.lastHit = G.time;
    // feedback
    const type = tgt.kind === 'player' || tgt.kind === 'summon' ? 'hurt' : crit ? 'crit' : dot ? 'dot' : 'dmg';
    if (G.settings.damageNumbers || type === 'hurt') G.hud.number(tgt.x, (tgt.genome.height + 0.4) * tgt.scale, tgt.z, AM.fmt(dmg), type, o.element);
    if (!dot) {
      AM.R.flashCreature(tgt.rig, tgt.kind === 'player');
      if (src && src.kind === 'player') { G.hitStop = Math.max(G.hitStop, crit ? 0.07 : 0.03); if (crit) G.shake(0.12); G.audio.sfx(crit ? 'crit' : 'hit'); }
      if (tgt.kind === 'player') { G.shake(0.18); G.audio.sfx('hurt'); }
      G.fx.burst(tgt.x, 0.8 * tgt.scale, tgt.z, crit ? '#ffe45c' : elColor(o.element), crit ? 8 : 4, 3, 0.12, 0.4);
    }
    if (tgt.ai && src && src.team !== tgt.team) AM.Ent.provoke(G, tgt);
    if (o.knock && src) knock(G, tgt, o.fromX != null ? o.fromX : src.x, o.fromZ != null ? o.fromZ : src.z, o.knock);
    if (ss && ss.lifesteal && !dot && src && !src.dead) heal(G, src, dmg * ss.lifesteal);
    if (o.kind === 'melee' && tgt.stats.thorns && src && !src.dead && !o.noThorns) C.damage(G, tgt, src, dmg * tgt.stats.thorns, { kind: 'true', noThorns: true });
    if (ss && !dot && o.kind !== 'true') {
      if (ss.poisonOnHit) C.applyEffect(G, src, tgt, { type: 'poison', dur: 3, power: 0.2 * ss.poisonOnHit }, dmg);
      if (ss.burnChance && Math.random() < ss.burnChance) C.applyEffect(G, src, tgt, { type: 'burn', dur: 3, power: 0.2 }, dmg);
      if (ss.blindChance && Math.random() < ss.blindChance) C.applyEffect(G, src, tgt, { type: 'blind', dur: 2 }, dmg);
      if (ss.stunChance && Math.random() < ss.stunChance) C.applyEffect(G, src, tgt, { type: 'stun', dur: 1 * (1 + (ss.stunDur || 0)) }, dmg);
      if (o.basic && ss.uniques && ss.uniques.has('emberfang')) C.applyEffect(G, src, tgt, { type: 'burn', dur: 3, power: 0.3 }, dmg);
    }
    if (tgt.stats.sporeCloud && (tgt.sporeCd || 0) <= G.time && Math.random() < 0.3) {
      tgt.sporeCd = G.time + 3;
      C.addZone(G, { src: tgt, x: tgt.x, z: tgt.z, radius: 2.4, dur: 3, tick: 0.5, kind: 'damage', dmg: tgt.stats.atk * 0.25, effects: [{ type: 'poison', dur: 2, power: 0.3 }], color: '#8fdc3c' });
    }
    if (o.effects) for (const e of o.effects) C.applyEffect(G, src, tgt, e, dmg, o.castId);
    if (src && src.affix && src.affix.id === 'vampiric') heal(G, src, dmg * 0.25);
    if (tgt.hp <= 0) C.kill(G, tgt, src, o);
    return dmg;
  };

  C.applyEffect = function (G, src, tgt, eff, hit, castId) {
    if (!tgt || tgt.dead) return;
    if (Math.random() > (eff.chance == null ? 1 : eff.chance)) return;
    const ss = src ? src.stats : {};
    if (CC.has(eff.type) && tgt.kind === 'player' && tgt.stats.ccImmune) return;
    const boss = tgt.rank === 'boss';
    const dm = (1 + (ss.statusDur || 0)) * (boss ? 0.45 : 1);
    const s = tgt.status;
    const dur = (eff.dur || 2) * dm;
    const setT = (k, extra, d) => { const dd = d || dur; const cur = s[k]; if (!cur || cur.t < dd) s[k] = Object.assign({ t: dd }, extra || {}); else if (extra) Object.assign(cur, extra); };
    switch (eff.type) {
      case 'burn': if (tgt.stats.burnImmune) return; setT('burn', { dps: Math.max((s.burn && s.burn.dps) || 0, hit * (eff.power || 0.2)), src }, dur * (1 + (ss.burnDur || 0))); break;
      case 'poison': setT('poison', { dps: Math.max((s.poison && s.poison.dps) || 0, hit * (eff.power || 0.25) * (1 + (ss.poisonDmg || 0))), src }); break;
      case 'bleed': setT('bleed', { dps: Math.max((s.bleed && s.bleed.dps) || 0, hit * (eff.power || 0.2)), src }); break;
      case 'slow': setT('slow', { p: Math.min(0.8, eff.power || 0.4) }); break;
      case 'freeze': if (boss) setT('slow', { p: 0.5 }); else setT('freeze'); break;
      case 'stun': if (boss && s.stunImmune > G.time) return; setT('stun'); if (boss) s.stunImmune = G.time + 4; break;
      case 'shock': if (!boss) setT('stun'); break;
      case 'soak': setT('soak'); break;
      case 'blind': setT('blind'); break;
      case 'root': setT('root'); break;
      case 'fear': if (boss) return; setT('fear', { fromX: src ? src.x : tgt.x, fromZ: src ? src.z : tgt.z }); if (tgt.ai) { tgt.ai.state = 'flee'; tgt.ai.t = dur; } break;
      case 'knock': if (src) knock(G, tgt, src.x, src.z, eff.power || 3); break;
      case 'pull': if (src) knock(G, tgt, src.x, src.z, -(eff.power || 4) * 0.6); break;
      case 'vuln': setT('vuln', { p: eff.power || 0.2 }); break;
      case 'weaken': setT('weaken', { p: eff.power || 0.2 }); break;
      case 'lifesteal': heal(G, src, hit * (eff.power || 0.2)); break;
      case 'heal': heal(G, src, hit * (eff.power || 0.1) * 1.5); break;
      case 'refund': if (src && castId && src._refunded !== castId) { src._refunded = castId; src.energy = Math.min(src.stats.maxEnergy || 100, src.energy + (src.stats.maxEnergy || 100) * (eff.power || 0.3) * 0.25); } break;
      case 'spread': tgt.spread = true; break;
      case 'haste': if (src && src.addBuff) src.addBuff('haste_fx', { haste: eff.power || 0.25 }, eff.dur || 3); break;
      case 'execute': if (!boss && tgt.hp > 0 && tgt.hp < tgt.maxHp * (eff.power || 0.25)) { tgt.hp = 0; G.hud.number(tgt.x, 2, tgt.z, 'Execute!', 'crit'); C.kill(G, tgt, src, {}); } break;
      default: break;
    }
  };

  C.updateStatus = function (G, e, dt) {
    const s = e.status;
    e.dotT = (e.dotT || 0) + dt;
    const tickNow = e.dotT >= 0.5;
    for (const k in s) {
      const st = s[k];
      if (!st || typeof st !== 'object' || st.t == null) continue;
      st.t -= dt;
      if (st.dps && tickNow && st.t > -0.01) C.damage(G, st.src && !st.src.dead ? st.src : null, e, st.dps * 0.5, { kind: 'dot', element: k === 'burn' ? 'fire' : k === 'poison' ? 'venom' : null });
      if (st.t <= 0) delete s[k];
    }
    if (tickNow) e.dotT = 0;
    if (e.dead) return;
    // status visuals
    if (Math.random() < dt * 8) {
      const y = (e.genome.height + 0.2) * e.scale;
      if (s.burn) G.fx.trail(e.x + (Math.random() - 0.5) * e.radius, y * 0.6, e.z + (Math.random() - 0.5) * e.radius, '#ff8a2f', 0.14);
      if (s.poison) G.fx.trail(e.x + (Math.random() - 0.5) * e.radius, y * 0.5, e.z, '#8fdc3c', 0.12);
      if (s.bleed) G.fx.trail(e.x, y * 0.5, e.z + (Math.random() - 0.5) * e.radius, '#c0203a', 0.1);
      if (s.freeze || s.slow) G.fx.trail(e.x + (Math.random() - 0.5) * e.radius, y * 0.4, e.z, '#9fe8ff', 0.1);
      if (s.stun) G.fx.trail(e.x + Math.cos(G.time * 8) * 0.4, y + 0.2, e.z + Math.sin(G.time * 8) * 0.4, '#ffe45c', 0.1);
      if (s.blind) G.fx.trail(e.x, y + 0.1, e.z, '#3a3a4a', 0.12);
    }
    // buffs
    let changed = false;
    for (const k in e.buffs) { e.buffs[k].t -= dt; if (e.buffs[k].t <= 0) { delete e.buffs[k]; changed = true; } }
    if (changed && e.recompute) e.recompute();
    if (e.shieldT > 0) { e.shieldT -= dt; if (e.shieldT <= 0) e.shield = 0; }
    if (e.shield > 0) { if (!e.bubble) e.bubble = G.fx.bubble('#c9d1dc'); e.bubble.set(e.x, e.genome.height * 0.5 * e.scale, e.z, Math.max(e.genome.height, e.radius * 2) * 0.75 * e.scale); }
    else if (e.bubble) { e.bubble.remove(); e.bubble = null; }
    // regeneration
    const S = e.stats;
    if (S.regen) e.hp = Math.min(e.maxHp, e.hp + e.maxHp * S.regen * dt);
    if (S.oocRegen && G.time - e.lastHit > 4) e.hp = Math.min(e.maxHp, e.hp + e.maxHp * S.oocRegen * dt);
    // knockback motion
    if (e.kb) { e.kb.t -= dt; AM.Ent.moveEntity(G, e, e.kb.vx * dt, e.kb.vz * dt); if (e.kb.t <= 0) e.kb = null; }
  };

  C.kill = function (G, tgt, src, o) {
    if (tgt.dead) return;
    tgt.dead = true; tgt.deathT = 0; tgt.hp = 0;
    if (tgt.tele) { tgt.tele.remove(); tgt.tele = null; }
    if (tgt.channel) C.endChannel(G, tgt);
    G.fx.burst(tgt.x, 0.6 * tgt.scale, tgt.z, tgt.genome.palette.primary, 14 * (tgt.rank === 'boss' ? 3 : 1), 4.5, 0.18, 0.8);
    G.fx.burst(tgt.x, 0.6 * tgt.scale, tgt.z, tgt.genome.palette.secondary, 8, 3.5, 0.14, 0.7);
    if (tgt.kind === 'player') { G.onPlayerDeath(); return; }
    if (tgt.kind === 'summon') return;
    G.audio.sfx(tgt.rank === 'boss' ? 'bossdie' : 'die');
    const byPlayer = src && (src.kind === 'player' || src.kind === 'summon' || src.team === 0);
    if (tgt.team === 1 && byPlayer && !tgt.noLoot) G.prog.onKill(tgt);
    if (tgt.affix && tgt.affix.id === 'explosive') {
      const d = G.fx.decal('circle', tgt.x, tgt.z, 3.2, '#ff5a3a', 0.35);
      C.after(G, 0.7, () => { d.remove(); G.fx.ringBurst(tgt.x, tgt.z, 3.2, '#ff8a3a', 18); C.aoe(G, tgt, tgt.x, tgt.z, 3.2, tgt.stats.atk * 1.8, [{ type: 'burn', dur: 2, power: 0.2 }], { kind: 'power', element: 'fire' }); G.shake(0.25); });
    }
    if (tgt.spread) {
      const st = Object.assign({}, tgt.status);
      for (const e of C.alliesOf(G, tgt)) if (AM.dist(e.x, e.z, tgt.x, tgt.z) < 5) for (const k of ['burn', 'poison', 'bleed', 'slow', 'vuln', 'weaken']) if (st[k]) e.status[k] = Object.assign({}, st[k]);
    }
  };

  C.aoe = function (G, src, x, z, r, dmg, effects, o) {
    let n = 0;
    for (const e of C.enemiesOf(G, src)) {
      if (AM.dist(e.x, e.z, x, z) <= r + e.radius * 0.7) { C.damage(G, src, e, dmg, Object.assign({ effects, fromX: x, fromZ: z }, o || {})); n++; }
    }
    return n;
  };
  C.after = function (G, t, fn) { G.timers.push({ t, fn }); };

  // ---------- basic attacks ----------
  C.playerAttack = function (G, ax, az) {
    const p = G.player, S = p.stats;
    if (p.cd.attack > 0 || !p.canAct() || p.channel || p.dash) return;
    const W = S.weapon ? AM.WEAPONS[S.weapon] : null;
    const A = AM.ATTACKS[S.attack] || AM.ATTACKS.bite;
    const ranged = W ? W.kind === 'ranged' : A.kind === 'ranged';
    const yaw = Math.atan2(ax - p.x, az - p.z);
    p.yaw = yaw;
    p.cd.attack = AM.basicCooldown(S);
    let dmg = AM.basicDamage(S);
    p.attackT = 0; p.attackKind = W && W.kind !== 'natural' ? 'weapon' : S.attack;
    if (G.weaponSwing) G.weaponSwing(ranged);
    p.hits = (p.hits || 0) + 1;
    if (ranged) {
      const el = W ? (S.weapon === 'staff' ? (S.attackElement || 'arcane') : null) : S.attackElement;
      const n = S.uniques.has('quiver') && S.weapon === 'bow' ? 3 : 1;
      const range = (W ? W.range : A.reach) * (S.range || 1);
      const speed = W ? W.speed : A.speed;
      for (let i = 0; i < n; i++) {
        const a = yaw + (n > 1 ? (i - 1) * 0.16 : 0);
        C.spawnProjectile(G, {
          src: p, x: p.x + Math.sin(a) * 0.6, z: p.z + Math.cos(a) * 0.6, y: 0.8, dx: Math.sin(a), dz: Math.cos(a), speed, range, hit: 0.45,
          dmg, element: el, color: el ? elColor(el) : W ? '#fff6d8' : '#e8f0ff', size: S.weapon === 'bow' ? 0.18 : 0.26, kind: 'ranged', basic: true,
          chainExtra: S.uniques.has('stormcaller') ? 2 : 0,
        });
      }
      G.audio.sfx(S.weapon === 'bow' ? 'shoot' : 'zap');
      return;
    }
    let reach = (W ? W.reach : A.reach) + p.radius * 0.5, arc = W ? W.arc : A.arc;
    // light aim assist: snap to an enemy just outside the aimed arc
    {
      let best = null, bd = 1e9;
      for (const e of C.enemiesOf(G, p)) {
        const dx = e.x - p.x, dz = e.z - p.z, d = Math.hypot(dx, dz);
        if (d > reach + e.radius + 0.6) continue;
        const da = Math.abs(AM.wrapAngle(Math.atan2(dx, dz) - p.yaw));
        if (da < 0.9 && d + da * 2 < bd) { bd = d + da * 2; best = e; }
      }
      if (best) p.yaw = Math.atan2(best.x - p.x, best.z - p.z);
    }
    const ayaw = p.yaw;
    if (S.weapon === 'sword') { p.combo = ((p.combo || 0) + 1) % 3; if (p.combo === 2) { dmg *= 1.5; arc *= 1.3; } }
    const effects = [];
    if (A.poison && (!W || W.kind === 'natural')) effects.push({ type: 'poison', dur: 3, power: 0.3 });
    if (W && W.stun) effects.push({ type: 'stun', chance: W.stun, dur: 0.8 });
    const knockF = (S.knock ? 2.5 : 0) + (A.knock && (!W || W.kind === 'natural') ? A.knock : 0) + (S.weapon === 'hammer' ? 1.5 : 0);
    let hitAny = false;
    for (const e of C.enemiesOf(G, p)) {
      const dx = e.x - p.x, dz = e.z - p.z, d = Math.hypot(dx, dz);
      if (d > reach + e.radius) continue;
      const da = Math.abs(AM.wrapAngle(Math.atan2(dx, dz) - ayaw));
      if (da > arc / 2 + Math.atan2(e.radius, Math.max(0.1, d))) continue;
      C.damage(G, p, e, dmg, { kind: 'melee', knock: knockF, effects, basic: true, element: S.attackElement });
      hitAny = true;
    }
    if (S.uniques.has('worldsplitter') && p.hits % 4 === 0) {
      G.fx.ringBurst(p.x, p.z, 4, '#c0905a', 20); G.fx.pulse(p.x, p.z, 4, '#c0905a', 0.4); G.shake(0.2);
      C.aoe(G, p, p.x, p.z, 4, dmg * 1.2, [{ type: 'stun', dur: 0.8 }], { kind: 'power', element: 'earth' });
    }
    // swing visuals
    const col = W ? '#ffffff' : AM.shade(p.genome.palette.accent, 0.2);
    for (let i = 0; i < 6; i++) {
      const a = ayaw - arc / 2 + (arc * i) / 5;
      G.fx.spawn(p.x + Math.sin(a) * reach * 0.8, 0.7, p.z + Math.cos(a) * reach * 0.8, Math.sin(a) * 2, 0.5, Math.cos(a) * 2, 0.22, 0.13, col, 0);
    }
    G.audio.sfx(hitAny ? 'swingHit' : 'swing');
  };

  C.wildStrike = function (G, e) {
    const A = AM.ATTACKS[e.genome.attack] || AM.ATTACKS.bite;
    const dmg = e.stats.atk * A.mult * (e.rank === 'boss' ? 1.25 : 1);
    if (e.tele) { e.tele.remove(); e.tele = null; }
    if (A.kind === 'ranged') {
      const el = e.genome.attackElement;
      const a = e.yaw;
      C.spawnProjectile(G, { src: e, x: e.x + Math.sin(a) * e.radius, z: e.z + Math.cos(a) * e.radius, y: 0.8 * e.scale, dx: Math.sin(a), dz: Math.cos(a), speed: A.speed * 0.75, range: Math.min(A.reach, 7.5) + 2, hit: 0.5, dmg, element: el, color: el ? elColor(el) : '#ffb8b8', size: 0.3, kind: 'ranged' });
      G.audio.sfx('enemyShoot');
      return;
    }
    const reach = A.reach * Math.max(1, e.scale * 0.8) + e.radius * 0.5;
    const effects = [];
    if (A.poison || e.genome.traits.some((t) => t.id === 'venom')) effects.push({ type: 'poison', dur: 3, power: 0.25 });
    for (const t of C.enemiesOf(G, e)) {
      const dx = t.x - e.x, dz = t.z - e.z, d = Math.hypot(dx, dz);
      if (d > reach + t.radius * 0.8) continue;
      const da = Math.abs(AM.wrapAngle(Math.atan2(dx, dz) - e.yaw));
      if (da > Math.min(A.arc, 3) / 2 + 0.25) continue;
      C.damage(G, e, t, dmg, { kind: 'melee', knock: A.knock || (e.rank === 'boss' ? 3 : 0), effects });
    }
    G.audio.sfx('enemySwing');
  };

  // ---------- projectiles ----------
  C.spawnProjectile = function (G, o) {
    o.traveled = 0; o.hitSet = new Set(); o.orb = G.fx.orb(o.color || '#ffffff', o.size || 0.3); o.y = o.y || 0.8;
    o.ox = o.x; o.oz = o.z;
    G.projectiles.push(o);
    return o;
  };
  function endProjectile(G, pr, x, z) {
    pr.dead = true;
    pr.orb.remove();
    if (pr.explode) { G.fx.ringBurst(x, z, pr.explode, pr.color, 14); G.fx.pulse(x, z, pr.explode, pr.color); C.aoe(G, pr.src, x, z, pr.explode, pr.dmg * 0.6, pr.effects, { kind: 'power', element: pr.element, castId: pr.castId }); }
    if (pr.puddle) C.addZone(G, { src: pr.src, x, z, radius: pr.puddle, dur: pr.puddleDur || 4, tick: 0.5, kind: 'damage', dmg: pr.dmg * 0.18, effects: pr.effects, color: pr.color, element: pr.element });
    if (pr.payload && !pr.noPayload) C.triggerPayload(G, pr.src, pr.payload, x, z, Math.atan2(pr.dx, pr.dz), pr.spec);
    if (pr.onEnd) pr.onEnd(x, z);
  }
  function updateProjectiles(G, dt) {
    for (const pr of G.projectiles) {
      if (pr.dead) continue;
      if (pr.src.dead && pr.src.kind !== 'player') { /* keep flying */ }
      if (pr.homing) {
        const t = nearestEnemy(G, pr.src, pr.x, pr.z, 9, pr.hitSet);
        if (t) { const dx = t.x - pr.x, dz = t.z - pr.z, d = Math.hypot(dx, dz) || 1; pr.dx = AM.lerp(pr.dx, dx / d, Math.min(1, dt * 6)); pr.dz = AM.lerp(pr.dz, dz / d, Math.min(1, dt * 6)); const n = Math.hypot(pr.dx, pr.dz) || 1; pr.dx /= n; pr.dz /= n; }
      }
      const step = pr.speed * dt;
      pr.x += pr.dx * step; pr.z += pr.dz * step; pr.traveled += step;
      pr.orb.set(pr.x, pr.y, pr.z);
      if (Math.random() < 0.6) G.fx.trail(pr.x, pr.y, pr.z, pr.color, (pr.size || 0.3) * 0.5);
      // hits
      let ended = false;
      for (const e of C.enemiesOf(G, pr.src)) {
        if (pr.hitSet.has(e)) continue;
        if (AM.dist(e.x, e.z, pr.x, pr.z) < pr.hit + e.radius) {
          pr.hitSet.add(e);
          C.damage(G, pr.src, e, pr.dmg, { kind: pr.kind || 'power', element: pr.element, effects: pr.explode ? null : pr.effects, basic: pr.basic, castId: pr.castId, knock: pr.knock });
          if (pr.chainExtra) C.chainFrom(G, pr.src, e, pr.chainExtra, 5, pr.dmg * 0.6, null, pr.color || '#ffe45c', pr.element);
          if (!pr.pierce) { endProjectile(G, pr, pr.x, pr.z); ended = true; break; }
        }
      }
      if (ended) continue;
      if (G.level.pointBlocked(pr.x, pr.z)) { endProjectile(G, pr, pr.x - pr.dx * 0.3, pr.z - pr.dz * 0.3); continue; }
      if (pr.traveled >= pr.range) {
        if (pr.boomerang && !pr.returning) {
          pr.returning = true; pr.traveled = 0; pr.hitSet.clear();
          if (pr.payload) C.triggerPayload(G, pr.src, pr.payload, pr.x, pr.z, Math.atan2(pr.dx, pr.dz), pr.spec);
          pr.payload = null;
        } else if (!pr.boomerang) { endProjectile(G, pr, pr.x, pr.z); continue; }
      }
      if (pr.returning) {
        const tx = pr.returnTo ? pr.returnTo[0] : pr.src.x, tz = pr.returnTo ? pr.returnTo[1] : pr.src.z;
        const dx = tx - pr.x, dz = tz - pr.z, d = Math.hypot(dx, dz);
        if (d < 0.8) { pr.dead = true; pr.orb.remove(); continue; }
        pr.dx = dx / d; pr.dz = dz / d; pr.traveled = 0; pr.range = 1e9;
        pr.orb.spin = 18;
      }
    }
    G.projectiles = G.projectiles.filter((p) => !p.dead);
  }

  // ---------- zones (puddles, vortices, storms, heal beds, traps) ----------
  C.addZone = function (G, z) {
    z.t = 0; z.tickT = 0; z.color = z.color || '#ffffff';
    const op = z.kind === 'trap' ? 0.18 : z.kind === 'heal' ? 0.3 : 0.26;
    z.decal = G.fx.decal('circle', z.x, z.z, z.radius, z.color, op);
    z.ring = G.fx.decal('ring', z.x, z.z, z.radius, z.color, 0.7, { lift: 0.01 });
    G.zones.push(z);
    return z;
  };
  function updateZones(G, dt) {
    for (const z of G.zones) {
      if (z.dead) continue;
      z.t += dt; z.tickT -= dt;
      const k = z.t / z.dur;
      if (z.kind === 'pull') {
        for (const e of C.enemiesOf(G, z.src)) {
          const dx = z.x - e.x, dz = z.z - e.z, d = Math.hypot(dx, dz);
          if (d < z.radius + 1.5 && d > 0.4 && e.rank !== 'boss') AM.Ent.moveEntity(G, e, (dx / d) * (z.pull || 5) * dt, (dz / d) * (z.pull || 5) * dt);
        }
        if (Math.random() < dt * 30) { const a = Math.random() * 6.28, r = z.radius * (0.4 + Math.random() * 0.6); G.fx.spawn(z.x + Math.cos(a) * r, 0.3, z.z + Math.sin(a) * r, -Math.cos(a) * r * 2, 0.6, -Math.sin(a) * r * 2, 0.4, 0.14, z.color, 0); }
        z.decal.d.mesh.rotation.y += dt * 3;
      }
      if (z.kind === 'heal' && Math.random() < dt * 10) G.fx.spawn(z.x + (Math.random() - 0.5) * z.radius * 1.6, 0.1, z.z + (Math.random() - 0.5) * z.radius * 1.6, 0, 1.6, 0, 0.7, 0.12, '#9cff9c', 0);
      if (z.kind === 'storm' && Math.random() < dt * 6) G.fx.spawn(z.x + (Math.random() - 0.5) * z.radius * 2, 6, z.z + (Math.random() - 0.5) * z.radius * 2, 0, -2, 0, 0.6, 0.35, '#5a6a8a', 0);
      if (z.kind === 'trap') {
        if (z.t >= (z.arm || 0.4) && !z.sprung) {
          const victims = C.enemiesOf(G, z.src).filter((e) => AM.dist(e.x, e.z, z.x, z.z) < z.radius + e.radius * 0.5);
          if (victims.length) {
            z.sprung = true;
            G.fx.ringBurst(z.x, z.z, z.radius, z.color, 16);
            for (let i = 0; i < 8; i++) G.fx.spawn(z.x + (Math.random() - 0.5) * z.radius, 0.1, z.z + (Math.random() - 0.5) * z.radius, 0, 5, 0, 0.4, 0.2, '#6a8a3a', 10);
            for (const e of victims) C.damage(G, z.src, e, z.dmg, { kind: 'power', element: z.element, effects: z.effects, castId: z.castId });
            if (z.payload) C.triggerPayload(G, z.src, z.payload, z.x, z.z, 0, z.spec);
            z.t = z.dur;
          }
        }
      } else if (z.tickT <= 0) {
        z.tickT = z.tick || 0.5;
        if (z.kind === 'heal') {
          for (const a of C.alliesOf(G, z.src)) if (AM.dist(a.x, a.z, z.x, z.z) < z.radius + a.radius) heal(G, a, a.maxHp * z.heal * (z.tick || 0.5));
        } else if (z.kind === 'storm') {
          const vs = C.enemiesOf(G, z.src).filter((e) => AM.dist(e.x, e.z, z.x, z.z) < z.radius + e.radius);
          if (vs.length) {
            const v = vs[(Math.random() * vs.length) | 0];
            G.fx.lightning(v.x, 9, v.z, v.x, 0.3, v.z, '#fff27a');
            G.fx.flashDisc(v.x, v.z, 1.2, '#fff27a', 0.2);
            C.damage(G, z.src, v, z.dmg, { kind: 'power', element: 'storm', effects: z.effects, castId: z.castId });
            if (z.payload && Math.random() < 0.35) C.triggerPayload(G, z.src, z.payload, v.x, v.z, 0, z.spec);
            G.audio.sfx('thunder');
          }
        } else if (z.dmg) {
          for (const e of C.enemiesOf(G, z.src)) if (AM.dist(e.x, e.z, z.x, z.z) < z.radius + e.radius * 0.6) C.damage(G, z.src, e, z.dmg, { kind: z.kind === 'damage' ? 'dot' : 'power', element: z.element, effects: z.effects, castId: z.castId });
        }
      }
      const fade = k > 0.85 ? (1 - k) / 0.15 : 1;
      z.decal.opacity((z.kind === 'trap' ? (z.t < (z.arm || 0.4) ? 0.35 : 0.14) : 0.26) * fade);
      z.ring.opacity(0.7 * fade);
      if (z.t >= z.dur) {
        z.dead = true; z.decal.remove(); z.ring.remove();
        if (z.payload && z.kind !== 'trap' && z.kind !== 'storm') C.triggerPayload(G, z.src, z.payload, z.x, z.z, 0, z.spec);
      }
    }
    G.zones = G.zones.filter((z) => !z.dead);
  }

  // ---------- chains ----------
  C.chainFrom = function (G, src, first, jumps, jumpRange, dmg, effects, color, element, castId, onLast) {
    const hit = new Set([first]);
    let cur = first;
    let i = 0;
    const hop = () => {
      if (i++ >= jumps) { if (onLast) onLast(cur); return; }
      const next = nearestEnemy(G, src, cur.x, cur.z, jumpRange, hit);
      if (!next) { if (onLast) onLast(cur); return; }
      hit.add(next);
      G.fx.lightning(cur.x, 0.9, cur.z, next.x, 0.9, next.z, color);
      C.damage(G, src, next, dmg, { kind: 'power', element, effects, castId });
      cur = next;
      C.after(G, 0.08, hop);
    };
    C.after(G, 0.08, hop);
  };

  // ---------- power casting ----------
  function powerDmg(G, src, spec) {
    if (src.kind === 'player') return AM.powerDamage(src.stats, spec);
    if (src.kind === 'summon') return AM.powerDamage(G.player.stats, spec) * 0.5;
    return src.stats.atk * spec.dmg * 0.85;
  }
  function clampRange(src, x, z, r) {
    const dx = x - src.x, dz = z - src.z, d = Math.hypot(dx, dz);
    if (d <= r || d < 0.01) return [x, z];
    return [src.x + (dx / d) * r, src.z + (dz / d) * r];
  }
  C.cast = function (G, src, spec, ax, az, noEcho) {
    const p = spec.params;
    const yaw = Math.atan2(ax - src.x, az - src.z);
    if (src.kind === 'player' || src.kind === 'summon') src.yaw = yaw;
    const dmg = powerDmg(G, src, spec);
    const castId = castCounter++;
    const color = spec.color, el = spec.element, fx = spec.effects, pl = spec.payload;
    src.attackT = 0; src.attackKind = 'cast';
    G.audio.sfx('cast_' + el);
    switch (spec.shape) {
      case 'projectile': {
        const n = p.count || 1, spread = p.spread || 0;
        for (let i = 0; i < n; i++) {
          const a = yaw + (n > 1 ? (i / (n - 1) - 0.5) * spread : 0);
          C.spawnProjectile(G, {
            src, x: src.x + Math.sin(a) * 0.7, z: src.z + Math.cos(a) * 0.7, y: 0.9 * src.scale, dx: Math.sin(a), dz: Math.cos(a), speed: p.speed, range: p.range * (src.stats.range || 1),
            hit: p.hit || 0.5, dmg: n > 1 ? dmg : dmg, element: el, effects: fx, color, size: n > 2 ? 0.26 : 0.42, explode: p.explode, puddle: p.puddle, puddleDur: p.puddleDur,
            homing: p.homing, payload: pl, noPayload: n > 2 && i > 0, spec, castId, kind: 'power',
          });
        }
        break;
      }
      case 'nova': {
        const r = p.radius;
        const go = (rr, k) => { G.fx.ringBurst(src.x, src.z, rr, color, 22); G.fx.pulse(src.x, src.z, rr, color, 0.4); G.fx.flashDisc(src.x, src.z, rr, color, 0.3); C.aoe(G, src, src.x, src.z, rr, dmg * k, fx, { kind: 'power', element: el, castId }); G.shake(0.12); };
        if (p.delay) { src.lift = 0.4; C.after(G, p.delay, () => { src.lift = 0; go(r, 1); }); } else go(r, 1);
        if (p.pulses > 1) C.after(G, (p.delay || 0) + 0.45, () => go(r * 1.3, 0.6));
        if (pl) C.after(G, (p.delay || 0) + 0.3, () => C.triggerPayload(G, src, pl, src.x, src.z, yaw, spec));
        break;
      }
      case 'chain': {
        let first = nearestEnemy(G, src, ax, az, 4, null);
        if (!first || AM.dist(first.x, first.z, src.x, src.z) > p.range + 2) first = nearestEnemy(G, src, src.x + Math.sin(yaw) * p.range * 0.5, src.z + Math.cos(yaw) * p.range * 0.5, p.range * 0.6, null);
        if (!first) { const [tx, tz] = clampRange(src, ax, az, p.range); G.fx.lightning(src.x, 0.9, src.z, tx, 0.2, tz, color); if (pl) C.triggerPayload(G, src, pl, tx, tz, yaw, spec); break; }
        G.fx.lightning(src.x, 0.9 * src.scale, src.z, first.x, 0.9, first.z, color);
        C.damage(G, src, first, dmg, { kind: 'power', element: el, effects: fx, castId });
        const extra = fx.filter((e) => e.type === 'chain').reduce((a, e) => a + e.power, 0);
        C.chainFrom(G, src, first, (p.jumps || 3) + extra, p.jumpRange || 5, dmg * 0.85, fx, color, el, castId, (last) => { if (pl) C.triggerPayload(G, src, pl, last.x, last.z, yaw, spec); });
        break;
      }
      case 'cone': {
        const range = p.range, ang = p.angle;
        const coneFx = G.fx.decal('cone', src.x, src.z, range, color, 0.4, { yaw, angle: ang });
        C.after(G, 0.25, () => coneFx.remove());
        for (let i = 0; i < 18; i++) { const a = yaw - ang / 2 + (ang * Math.random()); const s = 6 + Math.random() * 6; G.fx.spawn(src.x + Math.sin(a), 0.4, src.z + Math.cos(a), Math.sin(a) * s, 1 + Math.random(), Math.cos(a) * s, 0.45, 0.2, color, 4); }
        for (const e of C.enemiesOf(G, src)) {
          const dx = e.x - src.x, dz = e.z - src.z, d = Math.hypot(dx, dz);
          if (d > range + e.radius) continue;
          if (Math.abs(AM.wrapAngle(Math.atan2(dx, dz) - yaw)) > ang / 2 + 0.15) continue;
          C.damage(G, src, e, dmg, { kind: 'power', element: el, effects: fx, castId });
        }
        if (pl) C.triggerPayload(G, src, pl, src.x + Math.sin(yaw) * range * 0.8, src.z + Math.cos(yaw) * range * 0.8, yaw, spec);
        break;
      }
      case 'dash': {
        src.dash = { dx: Math.sin(yaw), dz: Math.cos(yaw), left: p.distance, speed: p.distance / 0.24, width: p.width || 1.4, hit: new Set(), dmg, fx, el, color, pl, spec, castId, yaw };
        src.iframes = Math.max(src.iframes, 0.3);
        break;
      }
      case 'heal': {
        C.addZone(G, { src, x: src.x, z: src.z, radius: p.radius, dur: p.dur, tick: 0.5, kind: 'heal', heal: p.heal, color, payload: pl, spec, castId });
        G.audio.sfx('heal');
        break;
      }
      case 'blink': {
        const range = p.range;
        let t = nearestEnemy(G, src, ax, az, 4, null);
        if (t && AM.dist(t.x, t.z, src.x, src.z) > range + 1) t = null;
        let dx, dz;
        if (t) { const vx = t.x - src.x, vz = t.z - src.z, d = Math.hypot(vx, vz) || 1; dx = t.x + (vx / d) * (t.radius + src.radius + 0.3); dz = t.z + (vz / d) * (t.radius + src.radius + 0.3); }
        else [dx, dz] = clampRange(src, ax, az, range);
        G.fx.burst(src.x, 0.7, src.z, color, 14, 3, 0.16, 0.5);
        teleport(G, src, dx, dz);
        G.fx.burst(src.x, 0.7, src.z, color, 14, 3, 0.16, 0.5);
        if (t) { src.yaw = Math.atan2(t.x - src.x, t.z - src.z); C.damage(G, src, t, dmg, { kind: 'power', element: el, effects: fx, forceCrit: fx.some((e) => e.type === 'crit'), castId }); }
        if (pl) C.triggerPayload(G, src, pl, src.x, src.z, src.yaw, spec);
        break;
      }
      case 'beam': {
        src.channel = { spec, t: 0, dur: p.dur, tickT: 0, plT: 0.5, dmg, fx, el, color, pl, castId, yaw, beam: G.fx.beam(src.x, 1, src.z, src.x, 1, src.z, color, 0.5, 0) };
        break;
      }
      case 'meteor': {
        const n = p.count || 1;
        for (let i = 0; i < n; i++) {
          let [tx, tz] = clampRange(src, ax, az, p.range);
          if (n > 1) { const a = Math.random() * 6.28, r = Math.random() * p.radius * 1.6; tx += Math.cos(a) * r; tz += Math.sin(a) * r; }
          const delay = p.delay + i * 0.18;
          const d = G.fx.decal('circle', tx, tz, p.radius, color, 0.25);
          const orb = G.fx.orb(color, 0.9);
          const t0 = G.time;
          G.anims.push({ until: t0 + delay, fn: (now) => { const k = AM.clamp((now - t0) / delay, 0, 1); orb.set(tx - (1 - k) * 3, 14 * (1 - k) + 0.4, tz - (1 - k) * 3); } });
          C.after(G, delay, () => {
            d.remove(); orb.remove();
            G.fx.ringBurst(tx, tz, p.radius, color, 20); G.fx.burst(tx, 0.4, tz, '#5a4a3a', 10, 5, 0.25, 0.8); G.fx.pulse(tx, tz, p.radius, color, 0.4);
            C.aoe(G, src, tx, tz, p.radius, dmg, fx, { kind: 'power', element: el, castId });
            G.shake(0.2); G.audio.sfx('boom');
            if (pl && i === 0) C.triggerPayload(G, src, pl, tx, tz, yaw, spec);
          });
        }
        break;
      }
      case 'summon': {
        if (src.kind === 'player') {
          for (let i = 0; i < (p.count || 2); i++) C.summonSpirit(G, src, p.dur, p.hp, spec.dmg, pl, spec, i);
        } else if (src.team === 1 && G.entities.filter((e) => e.minionOf === src && !e.dead).length < 3) {
          for (let i = 0; i < 2; i++) {
            const m = AM.Ent.spawnWild(G, src.x + (i ? 1.5 : -1.5), src.z + 1, { mother: src.genome.parents[0], father: src.genome.parents[1], variant: src.genome.variant, level: Math.max(1, src.level - 2), rank: 'normal' }, { scale: 0.65, noLoot: true });
            m.minionOf = src; m.life = p.dur; m.noLoot = true; m.ai.state = 'chase'; m.provoked = true;
          }
        }
        G.fx.burst(src.x, 0.8, src.z, color, 16, 3.5, 0.15, 0.6);
        break;
      }
      case 'shield': {
        src.shield = src.maxHp * p.shield * (1 + (src.stats.shieldPow || 0)); src.shieldT = p.dur;
        src.addBuff('ironskin', { thorns: p.thorns || 0 }, p.dur);
        if (pl) src.aura = { t: p.dur, every: 1.5, next: 1.5, pl, spec };
        G.fx.burst(src.x, 1, src.z, color, 16, 3, 0.14, 0.5);
        break;
      }
      case 'zone': {
        const [tx, tz] = clampRange(src, ax, az, p.range);
        C.addZone(G, { src, x: tx, z: tz, radius: p.radius, dur: p.dur, tick: p.tick, kind: 'pull', pull: p.pull, dmg, effects: fx, color, payload: pl, spec, castId, element: el });
        break;
      }
      case 'trap': {
        const [tx, tz] = clampRange(src, ax, az, p.range);
        const mine = G.zones.filter((z) => z.kind === 'trap' && z.src === src);
        if (mine.length >= 3) { mine[0].t = mine[0].dur; }
        C.addZone(G, { src, x: tx, z: tz, radius: p.radius, dur: p.dur, arm: p.arm, kind: 'trap', dmg, effects: fx, color, payload: pl, spec, castId, element: el });
        break;
      }
      case 'boomerang': {
        C.spawnProjectile(G, { src, x: src.x + Math.sin(yaw) * 0.7, z: src.z + Math.cos(yaw) * 0.7, y: 0.9, dx: Math.sin(yaw), dz: Math.cos(yaw), speed: p.speed, range: p.range, hit: p.hit || 0.8, dmg, element: el, effects: fx, color, size: 0.55, pierce: true, boomerang: true, payload: pl, spec, castId, kind: 'power' });
        break;
      }
      case 'buff': {
        if (src.addBuff) src.addBuff('roar', { atk: p.atk }, p.dur);
        G.fx.ringBurst(src.x, src.z, p.radius, color, 20); G.fx.pulse(src.x, src.z, p.radius, color, 0.5);
        for (const e of C.enemiesOf(G, src)) if (AM.dist(e.x, e.z, src.x, src.z) < p.radius + e.radius) for (const f of fx) C.applyEffect(G, src, e, f, dmg, castId);
        if (pl) src.aura = { t: p.dur, every: 1.5, next: 1.5, pl, spec };
        G.audio.sfx('roar');
        break;
      }
      case 'storm': {
        const [tx, tz] = clampRange(src, ax, az, p.range);
        C.addZone(G, { src, x: tx, z: tz, radius: p.radius, dur: p.dur, tick: p.tick, kind: 'storm', dmg, effects: fx, color: '#6a7aa8', payload: pl, spec, castId });
        break;
      }
      default: break;
    }
    if (!noEcho && src.kind === 'player' && src.stats.uniques && src.stats.uniques.has('echoring') && Math.random() < 0.2) {
      C.after(G, 0.35, () => { if (!src.dead) { G.hud.number(src.x, 2.2, src.z, 'Echo!', 'crit'); C.cast(G, src, spec, ax, az, true); } });
    }
  };

  function teleport(G, e, x, z) {
    if (G.level.waterAt(x, z) === 2 && !e.flying) return;
    const r = G.level.resolve(x, z, e.radius * 0.8);
    if (G.level.pointBlocked(r[0], r[1])) return;
    e.x = r[0]; e.z = r[1];
  }

  C.summonSpirit = function (G, src, dur, hp, dmgMul, payload, spec, i) {
    const e = new AM.Ent.Entity(G, { kind: 'summon', team: 0, genome: src.genome, level: G.state.level, x: src.x + (i ? 1.2 : -1.2), z: src.z - 0.8, scale: 0.62 });
    e.summonHp = hp || 0.4; e.recompute(); e.hp = e.maxHp;
    e.life = dur || 10; e.summonDmg = dmgMul || 0.5; e.payload = payload; e.spec = spec;
    G.entities.push(e); G.summons.push(e);
    return e;
  };

  // A smaller version of a power, triggered where the delivery lands or ends.
  C.triggerPayload = function (G, src, pl, x, z, yaw, spec) {
    if (!pl || !src) return;
    const p = pl.params, color = elColor(pl.element), el = pl.element, fx = pl.effects;
    const base = src.kind === 'player' || src.kind === 'summon' ? AM.powerDamage(G.player.stats, { dmg: 1, element: el, elements: [el], fused: true }) : src.stats.atk * 0.85;
    const dmg = base * Math.max(pl.dmg, 0.2);
    switch (pl.shape) {
      case 'projectile': {
        for (let i = 0; i < 6; i++) { const a = (i / 6) * PI * 2 + yaw; C.spawnProjectile(G, { src, x, z, y: 0.7, dx: Math.sin(a), dz: Math.cos(a), speed: 11, range: p.range || 5, hit: 0.4, dmg, element: el, effects: fx, color, size: 0.22, kind: 'power' }); }
        break;
      }
      case 'nova': case 'buff': {
        const r = p.radius || 3;
        G.fx.ringBurst(x, z, r, color, 14); G.fx.pulse(x, z, r, color, 0.3);
        C.aoe(G, src, x, z, r, pl.shape === 'buff' ? dmg * 0.5 : dmg, fx, { kind: 'power', element: el });
        if (pl.shape === 'buff' && src.addBuff) src.addBuff('miniroar', { atk: (p.atk || 0.2) * 0.5 }, 3);
        break;
      }
      case 'chain': {
        const first = nearestEnemy(G, src, x, z, 5, null);
        if (first) { G.fx.lightning(x, 0.8, z, first.x, 0.8, first.z, color); C.damage(G, src, first, dmg, { kind: 'power', element: el, effects: fx }); C.chainFrom(G, src, first, p.jumps || 2, 5, dmg * 0.8, fx, color, el); }
        break;
      }
      case 'cone': {
        for (const e of C.enemiesOf(G, src)) {
          const dx = e.x - x, dz = e.z - z, d = Math.hypot(dx, dz);
          if (d > (p.range || 5) + e.radius || Math.abs(AM.wrapAngle(Math.atan2(dx, dz) - yaw)) > (p.angle || 1.2) / 2 + 0.2) continue;
          C.damage(G, src, e, dmg, { kind: 'power', element: el, effects: fx, fromX: x, fromZ: z });
        }
        for (let i = 0; i < 10; i++) { const a = yaw - 0.6 + Math.random() * 1.2; G.fx.spawn(x, 0.4, z, Math.sin(a) * 8, 1, Math.cos(a) * 8, 0.4, 0.18, color, 3); }
        break;
      }
      case 'dash': {
        G.fx.ringBurst(x, z, 2.6, color, 14);
        C.aoe(G, src, x, z, 2.6, dmg, (fx || []).concat([{ type: 'knock', power: 5 }]), { kind: 'power', element: el, knock: 5, fromX: x, fromZ: z });
        break;
      }
      case 'heal': C.addZone(G, { src, x, z, radius: p.radius || 2.5, dur: p.dur || 3, tick: 0.5, kind: 'heal', heal: p.heal || 0.025, color }); break;
      case 'blink': teleport(G, src, x, z); G.fx.burst(src.x, 0.7, src.z, color, 10, 3); break;
      case 'beam': {
        const ex = x + Math.sin(yaw) * (p.range || 7), ez = z + Math.cos(yaw) * (p.range || 7);
        G.fx.beam(x, 0.8, z, ex, 0.8, ez, color, 0.35, 0.3);
        for (const e of C.enemiesOf(G, src)) if (distToSeg(e.x, e.z, x, z, ex, ez) < (p.width || 0.8) + e.radius) C.damage(G, src, e, dmg * 2, { kind: 'power', element: el, effects: fx });
        break;
      }
      case 'meteor': {
        const r = p.radius || 1.8;
        const d = G.fx.decal('circle', x, z, r, color, 0.25);
        C.after(G, 0.6, () => { d.remove(); G.fx.ringBurst(x, z, r, color, 14); C.aoe(G, src, x, z, r, dmg * 1.4, fx, { kind: 'power', element: el }); G.shake(0.1); });
        break;
      }
      case 'summon': if (src.kind === 'player' || src.kind === 'summon') C.summonSpirit(G, G.player, 6, 0.25, 0.4, null, null, 0); break;
      case 'shield': src.shield = Math.max(src.shield || 0, src.maxHp * (p.shield || 0.12)); src.shieldT = Math.max(src.shieldT || 0, 3); break;
      case 'zone': C.addZone(G, { src, x, z, radius: p.radius || 2.5, dur: p.dur || 1.8, tick: 0.5, kind: 'pull', pull: p.pull || 4, dmg: dmg * 0.5, effects: fx, color, element: el }); break;
      case 'storm': C.addZone(G, { src, x, z, radius: p.radius || 3, dur: p.dur || 3, tick: 0.6, kind: 'storm', dmg, effects: fx, color: '#6a7aa8' }); break;
      case 'trap': C.addZone(G, { src, x, z, radius: p.radius || 1.6, dur: p.dur || 5, arm: 0.3, kind: 'trap', dmg: dmg * 1.5, effects: fx, color, element: el }); break;
      case 'boomerang': C.spawnProjectile(G, { src, x, z, y: 0.8, dx: Math.sin(yaw), dz: Math.cos(yaw), speed: 14, range: p.range || 6, hit: 0.7, dmg, element: el, effects: fx, color, size: 0.4, pierce: true, boomerang: true, returnTo: [x, z], kind: 'power' }); break;
      default: break;
    }
  };
  function distToSeg(px, pz, ax, az, bx, bz) {
    const vx = bx - ax, vz = bz - az, wx = px - ax, wz = pz - az;
    const t = AM.clamp((wx * vx + wz * vz) / (vx * vx + vz * vz || 1), 0, 1);
    return Math.hypot(px - (ax + vx * t), pz - (az + vz * t));
  }

  // Enemies telegraph their powers first so the player can react.
  C.enemyCast = function (G, e, spec, tx, tz) {
    const p = spec.params;
    const self = /nova|buff|shield|heal|summon/.test(spec.shape);
    let tele;
    const r = self ? (p.radius || 3) : p.radius || p.explode || 1.6;
    if (self) tele = G.fx.decal('circle', e.x, e.z, r, '#ff3a3a', 0.25);
    else if (spec.shape === 'cone') tele = G.fx.decal('cone', e.x, e.z, p.range, '#ff3a3a', 0.25, { yaw: Math.atan2(tx - e.x, tz - e.z), angle: p.angle });
    else if (spec.shape === 'projectile' || spec.shape === 'beam' || spec.shape === 'dash' || spec.shape === 'boomerang' || spec.shape === 'chain' || spec.shape === 'blink') tele = G.fx.decal('rect', e.x, e.z, Math.min(p.range || p.distance || 8, 10), '#ff3a3a', 0.22, { yaw: Math.atan2(tx - e.x, tz - e.z), width: 0.9 });
    else tele = G.fx.decal('circle', tx, tz, r, '#ff3a3a', 0.25);
    e.attackT = -1;
    e.casting = 0.65;
    e.cd.attack = Math.max(e.cd.attack, 1);
    G.hud.emote(e, spec.name);
    C.after(G, e.rank === 'boss' ? 0.8 : 0.65, () => {
      tele.remove();
      e.casting = 0;
      if (e.dead || !e.canAct()) return;
      C.cast(G, e, spec, tx, tz);
    });
  };

  // ---------- per-frame: dashes, channels, auras, timers ----------
  C.updateActor = function (G, e, dt) {
    if (e.dash) {
      const d = e.dash;
      const step = Math.min(d.left, d.speed * dt);
      AM.Ent.moveEntity(G, e, d.dx * step, d.dz * step);
      d.left -= step;
      e.yaw = d.yaw;
      G.fx.trail(e.x, 0.6, e.z, d.color, 0.25);
      for (const t of C.enemiesOf(G, e)) {
        if (d.hit.has(t)) continue;
        if (AM.dist(t.x, t.z, e.x, e.z) < d.width + t.radius) { d.hit.add(t); C.damage(G, e, t, d.dmg, { kind: 'power', element: d.el, effects: d.fx, castId: d.castId }); }
      }
      if (d.left <= 0.01) { e.dash = null; if (d.pl) C.triggerPayload(G, e, d.pl, e.x, e.z, d.yaw, d.spec); }
    }
    if (e.channel) {
      const c = e.channel;
      c.t += dt; c.tickT -= dt; c.plT -= dt;
      if (e.kind === 'player' && G.aimWorld) c.yaw = AM.approachAngle(c.yaw, Math.atan2(G.aimWorld.x - e.x, G.aimWorld.z - e.z), dt * 3);
      e.yaw = c.yaw;
      const range = c.spec.params.range, w = c.spec.params.width;
      let ex = e.x + Math.sin(c.yaw) * range, ez = e.z + Math.cos(c.yaw) * range;
      for (let s = 1; s <= 10; s++) { const k = s / 10; const qx = e.x + (ex - e.x) * k, qz = e.z + (ez - e.z) * k; if (G.level.pointBlocked(qx, qz)) { ex = qx; ez = qz; break; } }
      c.beam.set(e.x + Math.sin(c.yaw) * 0.6, 0.9 * e.scale, e.z + Math.cos(c.yaw) * 0.6, ex, 0.7, ez);
      c.beam.b.mesh.scale.x = c.beam.b.mesh.scale.y = w * (0.8 + Math.sin(G.time * 30) * 0.15);
      if (c.tickT <= 0) {
        c.tickT = c.spec.params.tick || 0.2;
        for (const t of C.enemiesOf(G, e)) if (distToSeg(t.x, t.z, e.x, e.z, ex, ez) < w + t.radius * 0.7) C.damage(G, e, t, c.dmg, { kind: 'power', element: c.el, effects: c.fx, castId: c.castId });
        G.fx.burst(ex, 0.6, ez, c.color, 3, 3, 0.12, 0.3);
      }
      if (c.pl && c.plT <= 0) { c.plT = 0.5; C.triggerPayload(G, e, c.pl, ex, ez, c.yaw, c.spec); }
      if (c.t >= c.dur || !e.canAct()) C.endChannel(G, e);
    }
    if (e.aura) {
      e.aura.t -= dt; e.aura.next -= dt;
      if (e.aura.next <= 0) { e.aura.next = e.aura.every; C.triggerPayload(G, e, e.aura.pl, e.x, e.z, e.yaw, e.aura.spec); }
      if (e.aura.t <= 0) e.aura = null;
    }
    if (e.iframes > 0) e.iframes -= dt;
    if (e.attackT >= 0 && e.kind !== 'wild' && e.kind !== 'boss') { e.attackT += dt * 3.5; if (e.attackT > 1) e.attackT = -1; }
  };
  C.endChannel = function (G, e) { if (e.channel) { e.channel.beam.remove(); e.channel = null; } };

  C.update = function (G, dt) {
    for (let i = G.timers.length - 1; i >= 0; i--) { const t = G.timers[i]; t.t -= dt; if (t.t <= 0) { G.timers.splice(i, 1); t.fn(); } }
    for (let i = G.anims.length - 1; i >= 0; i--) { const a = G.anims[i]; a.fn(G.time); if (G.time >= a.until) G.anims.splice(i, 1); }
    updateProjectiles(G, dt);
    updateZones(G, dt);
  };
  C.clearAll = function (G) {
    for (const p of G.projectiles) p.orb.remove();
    for (const z of G.zones) { z.decal.remove(); z.ring.remove(); }
    G.projectiles = []; G.zones = []; G.timers = []; G.anims = [];
  };

  AM.Combat = C;
})(typeof window !== 'undefined' ? window : globalThis);
