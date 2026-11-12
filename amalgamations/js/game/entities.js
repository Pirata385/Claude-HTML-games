// Amalgamations — entities: player, wild creatures, bosses, villagers, summons and pickups.
// Movement with static collisions (world or interior), soft separation, wild AI, spawning and despawning.
(function (root) {
  'use strict';
  const AM = root.AM || (root.AM = {});
  const R = AM.R;
  const genomeCache = new Map();
  function genomeFor(m, f, v) {
    const k = m + '|' + f + '|' + v;
    if (!genomeCache.has(k)) genomeCache.set(k, AM.fuse(m, f, v));
    return genomeCache.get(k);
  }
  // Each base has an element affinity used to give wild creatures fitting powers.
  const AFFINITY = {
    wolf: ['galedash', 'battleroar'], shark: ['tidalwave', 'boomerang'], elephant: ['quakeslam', 'tidalwave'], eagle: ['galedash', 'chainlightning'],
    turtle: ['ironskin', 'tidalwave'], scorpion: ['venomspit', 'thornsnare'], octopus: ['venomspit', 'blackhole'], frog: ['venomspit', 'tidalwave'],
    rhino: ['quakeslam', 'galedash'], bat: ['shadowstep', 'chainlightning'], chameleon: ['shadowstep', 'venomspit'], toaster: ['fireball', 'boomerang'],
    teapot: ['tidalwave', 'healingbloom'], chest: ['boomerang', 'ironskin'], rocket: ['fireball', 'galedash'], lantern: ['sunbeam', 'fireball'],
    cactus: ['thornsnare', 'boomerang'], mushroom: ['venomspit', 'healingbloom'], ghost: ['shadowstep', 'blackhole'], golem: ['quakeslam', 'ironskin'],
    dragon: ['fireball', 'starfall'], slime: ['healingbloom', 'venomspit'], eye: ['sunbeam', 'arcanemissiles'],
  };

  let nextId = 1;
  class Entity {
    constructor(G, o) {
      this.G = G;
      this.id = nextId++;
      this.kind = o.kind;                         // player | wild | boss | npc | summon
      this.team = o.team != null ? o.team : (o.kind === 'player' || o.kind === 'summon' || o.kind === 'npc' ? 0 : 1);
      this.genome = o.genome;
      this.level = o.level || 1;
      this.rank = o.rank || 'normal';
      this.affix = o.affix || null;
      this.name = o.name || o.genome.name;
      this.x = o.x; this.z = o.z; this.y = 0;
      this.yaw = o.yaw || Math.random() * Math.PI * 2;
      this.vx = 0; this.vz = 0;
      this.scale = o.scale || (this.rank === 'boss' ? 2.1 : this.rank === 'elite' ? 1.35 : 1);
      this.radius = this.genome.radius * this.scale;
      this.flying = this.genome.posture === 'hover';
      this.status = {};
      this.cd = { attack: 0, dodge: 0, power: 2 + Math.random() * 3, powers: {} };
      this.dodgeCharges = 1;
      this.ai = { state: 'idle', t: Math.random() * 2, tx: o.x, tz: o.z, homeX: o.x, homeZ: o.z };
      this.guard = !!o.guard; // dungeon/cave inhabitants and bosses defend their lair
      this.attackT = -1; this.attackKind = null;
      this.dead = false; this.deathT = 0; this.hitT = 0; this.iframes = 0; this.shield = 0; this.shieldT = 0;
      this.buffs = {};
      this.powers = o.powers || [];
      this.quest = o.quest || null;
      this.role = o.role || null;
      this.lastHit = 0;
      this.animTick = 0;
      this.recompute();
      this.hp = this.maxHp; this.energy = this.stats.maxEnergy || 100;
      this.makeRig(o.look);
    }
    makeRig(look) {
      if (this.rig) R.disposeCreature(this.rig);
      const opts = { look, shadow: this.G.settings.shadows !== 'off' && (this.kind === 'player' || this.kind === 'boss' || this.G.settings.shadows === 'high') };
      if (this.kind === 'summon') opts.material = R.materials().set.map((m, i) => (i === 0 ? R.summonMat() : m));
      this.rig = R.createCreature(this.genome, opts);
      this.rig.holder.scale.setScalar(this.scale);
      this.rig.holder.position.set(this.x, 0, this.z);
      this.G.scene.add(this.rig.holder);
      if (this.rank === 'elite' || this.rank === 'boss') {
        this.aura = this.G.fx.decal('ring', this.x, this.z, this.radius * 1.6, this.rank === 'boss' ? '#ff4a4a' : '#ffb020', 0.55);
      }
    }
    recompute() {
      if (this.kind === 'player') {
        const st = this.G.state;
        this.stats = AM.computeStats({ genome: this.genome, level: st.level, nodes: st.nodes, equipment: st.equipment, buffs: this.buffSums() });
      } else if (this.kind === 'summon') {
        const ps = this.G.player.stats;
        this.stats = Object.assign({}, ps, { maxHp: Math.round(ps.maxHp * (this.summonHp || 0.4)), speed: ps.speed * 1.05, critChance: 0.05, lifesteal: 0, thorns: 0, evade: 0 });
      } else {
        const ms = AM.monsterStats(this.genome, this.level, this.rank === 'boss' ? 'boss' : this.rank === 'elite' ? 'elite' : 'normal');
        if (this.kind === 'npc') { ms.maxHp = 99999; }
        if (this.affix && this.affix.id === 'swift') ms.speed *= 1.3;
        ms.dr = this.affix && this.affix.id === 'armoured' ? 0.4 : 0;
        ms.evade = this.genome.traits.some((t) => t.id === 'phase') ? 0.08 : 0;
        ms.thorns = this.genome.traits.some((t) => t.id === 'thorns') ? 0.15 : 0;
        ms.lifesteal = this.affix && this.affix.id === 'vampiric' ? 0.25 : 0;
        ms.maxEnergy = 100; ms.atkSpeed = this.affix && this.affix.id === 'swift' ? 1.3 : 1;
        const bs = this.buffSums();
        if (bs.atk) ms.atk *= 1 + bs.atk;
        if (bs.haste) ms.speed *= 1 + bs.haste;
        if (bs.thorns) ms.thorns += bs.thorns;
        ms.attack = this.genome.attack; ms.attackElement = this.genome.attackElement || null;
        ms.elem = {}; ms.powerDmg = 0; ms.dmgPct = 0; ms.fusedDmg = 0; ms.weaponDmg = 0;
        this.stats = ms;
      }
      const old = this.maxHp;
      this.maxHp = this.stats.maxHp;
      if (old && this.hp) this.hp = Math.min(this.maxHp, this.hp * (this.maxHp / old));
    }
    buffSums() {
      const out = {};
      for (const k in this.buffs) { const b = this.buffs[k]; if (b.t > 0) for (const s in b.mods) out[s] = (out[s] || 0) + b.mods[s]; }
      return out;
    }
    addBuff(id, mods, t) { this.buffs[id] = { mods, t }; this.recompute(); }
    get alive() { return !this.dead; }
    canAct() { const s = this.status; return !this.dead && !(s.stun && s.stun.t > 0) && !(s.freeze && s.freeze.t > 0); }
    speedMul() {
      const s = this.status;
      let m = 1;
      if (s.slow && s.slow.t > 0) m *= 1 - s.slow.p;
      if (s.root && s.root.t > 0) m = 0;
      if (s.freeze && s.freeze.t > 0) m = 0;
      if (s.stun && s.stun.t > 0) m = 0;
      return m;
    }
    dispose() {
      R.disposeCreature(this.rig);
      if (this.aura) { this.aura.remove(); this.aura = null; }
      if (this.bubble) { this.bubble.remove(); this.bubble = null; }
      if (this.tag) { this.tag.remove(); this.tag = null; }
    }
  }

  // ---------- movement ----------
  function moveEntity(G, e, dx, dz) {
    const L = G.level;
    let nx = e.x + dx, nz = e.z + dz;
    if (!e.flying || G.mode === 'interior') {
      if (L.waterAt(nx, nz) === 2) {
        if (L.waterAt(nx, e.z) !== 2) nz = e.z;
        else if (L.waterAt(e.x, nz) !== 2) nx = e.x;
        else { nx = e.x; nz = e.z; }
      }
    }
    const r = L.resolve(nx, nz, e.radius * 0.8);
    e.x = r[0]; e.z = r[1];
  }
  function separate(G, list) {
    const fixed = (e) => e.kind === 'npc' || e.rank === 'boss';
    for (let i = 0; i < list.length; i++) {
      const a = list[i];
      if (a.dead) continue;
      for (let j = i + 1; j < list.length; j++) {
        const b = list[j];
        if (b.dead) continue;
        const dx = b.x - a.x, dz = b.z - a.z, rr = (a.radius + b.radius) * 0.75;
        const d2 = dx * dx + dz * dz;
        if (d2 >= rr * rr || d2 < 1e-6) continue;
        const ma = fixed(a) ? 0 : 1, mb = fixed(b) ? 0 : 1;
        if (!ma && !mb) continue;
        const d = Math.sqrt(d2), over = rr - d, ux = dx / d, uz = dz / d;
        const ka = (over * ma) / (ma + mb), kb = (over * mb) / (ma + mb);
        a.x -= ux * ka; a.z -= uz * ka; b.x += ux * kb; b.z += uz * kb;
      }
    }
  }

  // ---------- spawning ----------
  function spawnWild(G, x, z, roll, extra) {
    const g = genomeFor(roll.mother, roll.father, roll.variant);
    const powers = [];
    if (roll.level >= 4 || roll.rank !== 'normal') powers.push(AM.makeRng(AM.hashStr(g.key)).pick(AFFINITY[roll.mother]));
    if (roll.level >= 14 || roll.rank === 'boss') powers.push(AFFINITY[roll.father][1]);
    const e = new Entity(G, Object.assign({ kind: roll.rank === 'boss' ? 'boss' : 'wild', genome: g, level: roll.level, rank: roll.rank, affix: roll.affix, x, z, powers: powers.filter(Boolean), guard: roll.rank === 'boss' }, extra || {}));
    e.biome = extra && extra.biome;
    e.coward = roll.rank === 'normal' && Math.random() < 0.3;
    if (extra && extra.noLoot) e.noLoot = true;
    G.entities.push(e);
    return e;
  }
  function spawnNpc(G, npc, village) {
    const rng = AM.makeRng(AM.hashStr(village.id + npc.role));
    const pool = ['turtle', 'frog', 'eagle', 'mushroom', 'teapot', 'toaster', 'cactus', 'elephant', 'chameleon', 'lantern'];
    const m = rng.pick(pool), f = rng.pick(pool);
    const g = genomeFor(m, f, rng.int(0, 3));
    const e = new Entity(G, { kind: 'npc', team: 0, genome: g, level: village.level, x: npc.x, z: npc.z, name: npc.name, role: npc.role, scale: 0.9 });
    e.village = village;
    e.yaw = Math.atan2(village.x - npc.x, village.z - npc.z);
    G.entities.push(e);
    return e;
  }
  function spawnAround(G, dt) {
    G.spawnT -= dt;
    if (G.spawnT > 0 || G.mode !== 'play') return;
    G.spawnT = 0.6;
    const p = G.player;
    let wild = 0;
    for (const e of G.entities) if (e.kind === 'wild' && !e.dead) wild++;
    const cap = G.settings.maxCreatures;
    // despawn far creatures
    for (const e of G.entities) {
      if (e.kind !== 'wild' || e.dead || e.quest || e.campId) continue;
      if (AM.dist(e.x, e.z, p.x, p.z) > 58 && e.ai.state !== 'chase') { e.dead = true; e.remove = true; }
    }
    if (wild >= cap) return;
    for (let tries = 0; tries < 3; tries++) {
      const a = Math.random() * Math.PI * 2, d = 24 + Math.random() * 14;
      const x = p.x + Math.cos(a) * d, z = p.z + Math.sin(a) * d;
      if (G.world.waterAt(x, z) === 2) continue;
      const s = G.world.structureAt(x, z, 6);
      if (s && (s.type === 'village' || s.type === 'shrine')) continue;
      if (G.world.structuresNear(x, z, 30).some((v) => v.type === 'village' && AM.dist(v.x, v.z, x, z) < 40)) continue;
      const biome = G.world.biomeAt(x, z);
      const lvl = G.world.dangerAt(x, z) + (G.isNight ? 1 : 0);
      const roll = G.world.rollWild(AM.makeRng((Math.random() * 1e9) | 0), biome, lvl);
      spawnWild(G, x, z, roll, { biome: AM.BIOMES[biome].id });
      break;
    }
  }

  // ---------- wild AI ----------
  // Bosses change phase at 66% (call minions) and 33% health (enrage and telegraphed ground slams).
  function bossPhases(G, e, dt) {
    const k = e.hp / e.maxHp;
    e.phase = e.phase || 1;
    if (e.phase === 1 && k < 0.66) {
      e.phase = 2;
      G.hud.toast(`${e.name} calls for help!`, 'bad');
      for (let i = 0; i < 2; i++) {
        const m = spawnWild(G, e.x + (i ? 2 : -2), e.z + 1.5, { mother: e.genome.parents[0], father: e.genome.parents[1], variant: e.genome.variant, level: Math.max(1, e.level - 2), rank: 'normal' }, { scale: 0.7, noLoot: true, biome: e.biome });
        m.ai.state = 'chase'; m.interior = e.interior; m.minionOf = e; m.guard = true;
      }
      G.fx.ringBurst(e.x, e.z, 4, '#ff5a5a', 20);
    }
    if (e.phase === 2 && k < 0.33) {
      e.phase = 3;
      G.hud.toast(`${e.name} is enraged!`, 'bad');
      e.addBuff('enrage', { atk: 0.3, haste: 0.25 }, 9999);
      e.slamT = 2;
      G.shake(0.3);
    }
    if (e.phase === 3 && e.ai.state === 'chase' && e.attackT < 0) {
      e.slamT -= dt;
      if (e.slamT <= 0) {
        e.slamT = 6;
        const x = e.x, z = e.z, r = 5.5;
        const d = G.fx.decal('circle', x, z, r, '#ff2a2a', 0.3);
        G.hud.emote(e, 'Ground Slam!');
        AM.Combat.after(G, 1.0, () => {
          d.remove();
          if (e.dead) return;
          G.fx.ringBurst(x, z, r, '#ff7a4a', 26); G.fx.pulse(x, z, r, '#ff7a4a', 0.5); G.shake(0.35); G.audio.sfx('boom');
          AM.Combat.aoe(G, e, x, z, r, e.stats.atk * 1.6, [{ type: 'knock', power: 5 }], { kind: 'power', knock: 5, fromX: x, fromZ: z });
        });
      }
    }
  }

  function aiUpdate(G, e, dt) {
    const p = G.player, ai = e.ai;
    const s = e.status;
    e.cd.attack -= dt; e.cd.power -= dt;
    if (e.rank === 'boss' && !e.dead) bossPhases(G, e, dt);
    if (!e.canAct()) { e.move = 0; return; }
    const target = pickTarget(G, e);
    const tx = target ? target.x : p.x, tz = target ? target.z : p.z;
    const d = AM.dist(e.x, e.z, tx, tz);
    const A = AM.ATTACKS[e.genome.attack] || AM.ATTACKS.bite;
    const reach = (A.kind === 'ranged' ? Math.min(A.reach, 7.5) : A.reach * Math.max(1, e.scale * 0.8)) + e.radius * 0.5;
    const sp = e.stats.speed * e.speedMul();
    const stealth = p.stats.stealth || 0;
    const aggro = (e.rank === 'boss' ? 16 : 10) * (1 - stealth) * (G.isNight ? 1.15 : 1);
    let mv = 0, wantX = 0, wantZ = 0;
    if (s.fear && s.fear.t > 0) { ai.state = 'flee'; ai.t = Math.max(ai.t, s.fear.t); }
    if (e.attackT >= 0) {
      // winding up or striking: stand still, keep facing the target
      e.attackT += dt / e.windup;
      if (e.attackT < 1) e.yaw = AM.approachAngle(e.yaw, Math.atan2(tx - e.x, tz - e.z), dt * 3);
      if (e.attackT >= 1 && !e.struck) { e.struck = true; AM.Combat.wildStrike(G, e); }
      if (e.attackT >= 1.6) { e.attackT = -1; e.struck = false; if (e.tele) { e.tele.remove(); e.tele = null; } }
      e.move = 0;
      return;
    }
    switch (ai.state) {
      case 'idle': {
        ai.t -= dt;
        if (ai.t <= 0) { ai.t = 2 + Math.random() * 4; const a = Math.random() * 6.28, r = Math.random() * 7; ai.tx = ai.homeX + Math.cos(a) * r; ai.tz = ai.homeZ + Math.sin(a) * r; }
        const dd = AM.dist(e.x, e.z, ai.tx, ai.tz);
        if (dd > 0.6) { wantX = (ai.tx - e.x) / dd; wantZ = (ai.tz - e.z) / dd; mv = 0.35; }
        // Only provoked creatures, lair guards and much stronger creatures come after you.
        if (target && !p.dead && (e.provoked || (AM.wildIsHostile(e, G.state.level) && d < aggro))) { ai.state = 'chase'; G.hud.emote(e, '!'); }
        break;
      }
      case 'chase': {
        if (!target || p.dead || !AM.wildIsHostile(e, G.state.level)) { ai.state = 'return'; break; }
        const fromHome = AM.dist(e.x, e.z, ai.homeX, ai.homeZ);
        if ((fromHome > 42 || d > 30) && !e.quest && e.rank !== 'boss' && !e.interior) { ai.state = 'return'; break; }
        if (e.hp < e.maxHp * 0.18 && e.coward && !ai.fled) { ai.state = 'flee'; ai.t = 3; ai.fled = true; break; }
        // powers
        if (e.powers.length && e.cd.power <= 0 && d < 10) {
          const pid = e.powers[(Math.random() * e.powers.length) | 0];
          const spec = AM.powerSpec(pid);
          AM.Combat.enemyCast(G, e, spec, tx, tz);
          e.cd.power = (spec.cd * 1.6 + 2) * (e.affix && e.affix.id === 'arcane' ? 0.5 : 1) * (e.rank === 'boss' ? 0.6 : 1);
          break;
        }
        if (A.kind === 'ranged') {
          if (d > reach * 0.9) { wantX = (tx - e.x) / d; wantZ = (tz - e.z) / d; mv = 1; }
          else if (d < reach * 0.45) { wantX = -(tx - e.x) / d; wantZ = -(tz - e.z) / d; mv = 0.7; }
          else { const a = Math.atan2(tx - e.x, tz - e.z) + Math.PI / 2 * (e.id % 2 ? 1 : -1); wantX = Math.sin(a); wantZ = Math.cos(a); mv = 0.4; }
          if (d <= reach && e.cd.attack <= 0) beginAttack(G, e, A, tx, tz);
        } else {
          if (d > reach * 0.85) { wantX = (tx - e.x) / d; wantZ = (tz - e.z) / d; mv = 1; }
          else if (e.cd.attack <= 0) beginAttack(G, e, A, tx, tz);
        }
        break;
      }
      case 'flee': {
        ai.t -= dt;
        const dd = Math.max(0.1, d);
        wantX = -(tx - e.x) / dd; wantZ = -(tz - e.z) / dd; mv = 1;
        if (ai.t <= 0) ai.state = 'chase';
        break;
      }
      case 'return': {
        const dd = AM.dist(e.x, e.z, ai.homeX, ai.homeZ);
        e.hp = Math.min(e.maxHp, e.hp + e.maxHp * 0.2 * dt);
        if (dd < 1.5) { ai.state = 'idle'; e.provoked = false; break; }
        wantX = (ai.homeX - e.x) / dd; wantZ = (ai.homeZ - e.z) / dd; mv = 1;
        break;
      }
    }
    if (mv > 0) {
      const v = sp * mv * (G.level.waterAt(e.x, e.z) === 1 && !e.flying ? 0.65 : 1);
      moveEntity(G, e, wantX * v * dt, wantZ * v * dt);
      e.yaw = AM.approachAngle(e.yaw, Math.atan2(wantX, wantZ), dt * 8);
    }
    e.move = mv * e.speedMul();
  }
  function pickTarget(G, e) {
    let best = G.player.dead ? null : G.player, bd = best ? AM.dist(e.x, e.z, best.x, best.z) : 1e9;
    for (const o of G.summons) { if (o.dead) continue; const d = AM.dist(e.x, e.z, o.x, o.z); if (d < bd - 2) { bd = d; best = o; } }
    return best;
  }
  function beginAttack(G, e, A, tx, tz) {
    e.attackT = 0;
    e.struck = false;
    e.attackKind = e.genome.attack;
    e.windup = (e.rank === 'boss' ? 0.75 : e.rank === 'elite' ? 0.42 : 0.5) / (e.stats.atkSpeed || 1);
    e.cd.attack = (A.cd * 2.2 + 0.6) / (e.stats.atkSpeed || 1);
    e.yaw = Math.atan2(tx - e.x, tz - e.z);
    e.aimX = tx; e.aimZ = tz;
    const reach = (A.kind === 'ranged' ? Math.min(A.reach, 7.5) : A.reach * Math.max(1, e.scale * 0.8)) + e.radius * 0.5;
    if (A.kind === 'ranged') e.tele = G.fx.decal('rect', e.x, e.z, reach, '#ff4040', 0.22, { yaw: e.yaw, width: 0.6 });
    else e.tele = G.fx.decal('cone', e.x, e.z, reach, '#ff4040', 0.25, { yaw: e.yaw, angle: Math.min(A.arc, 3.0) });
  }

  // Provoke a creature and its pack: same camp, same boss, or the same kind of creature close by.
  function provoke(G, e) {
    if (!e.ai || e.dead) return;
    const first = !e.provoked;
    e.provoked = true;
    if (e.ai.state === 'idle' || e.ai.state === 'return') { e.ai.state = 'chase'; if (first) G.hud.emote(e, '!'); }
    if (!first) return;
    for (const o of G.entities) {
      if (o === e || o.dead || !o.ai || o.provoked || o.team !== e.team) continue;
      const near = AM.dist(o.x, o.z, e.x, e.z);
      const pack = (e.campId && o.campId === e.campId) || (o.minionOf && (o.minionOf === e || o.minionOf === e.minionOf)) || e.minionOf === o
        || (near < 8 && o.genome.key === e.genome.key);
      if (pack && near < 24) { o.provoked = true; if (o.ai.state === 'idle' || o.ai.state === 'return') { o.ai.state = 'chase'; G.hud.emote(o, '!'); } }
    }
  }

  // ---------- summons ----------
  function summonUpdate(G, e, dt) {
    e.life -= dt;
    if (e.life <= 0) { e.dead = true; e.remove = true; G.fx.burst(e.x, 0.6, e.z, '#d07bff', 10, 3); return; }
    e.cd.attack -= dt;
    let best = null, bd = 12;
    for (const o of G.entities) {
      if (o.team === 0 || o.dead || o.kind === 'npc') continue;
      if (o.ai && o.ai.state !== 'chase' && !o.provoked) continue; // leave peaceful creatures alone
      const d = AM.dist(e.x, e.z, o.x, o.z); if (d < bd) { bd = d; best = o; }
    }
    const p = G.player;
    let wx = 0, wz = 0, mv = 0;
    if (best) {
      if (bd > 1.6) { wx = (best.x - e.x) / bd; wz = (best.z - e.z) / bd; mv = 1; }
      else if (e.cd.attack <= 0) {
        e.cd.attack = 0.8; e.attackT = 0; e.attackKind = 'bite';
        const dmg = AM.basicDamage(p.stats) * (e.summonDmg || 0.5);
        AM.Combat.damage(G, e, best, dmg, { kind: 'melee', element: e.payload ? e.payload.element : null });
        if (e.payload && Math.random() < 0.4) AM.Combat.triggerPayload(G, p, e.payload, best.x, best.z, e.yaw, e.spec);
      }
      e.yaw = Math.atan2(best.x - e.x, best.z - e.z);
    } else {
      const d = AM.dist(e.x, e.z, p.x, p.z);
      if (d > 3) { wx = (p.x - e.x) / d; wz = (p.z - e.z) / d; mv = d > 8 ? 1.3 : 0.8; e.yaw = Math.atan2(wx, wz); }
    }
    if (e.attackT >= 0) { e.attackT += dt * 3; if (e.attackT > 1) e.attackT = -1; }
    if (mv) moveEntity(G, e, wx * e.stats.speed * mv * dt, wz * e.stats.speed * mv * dt);
    e.move = mv;
  }

  // ---------- pickups ----------
  function dropPickup(G, x, z, kind, data) {
    const color = kind === 'gold' ? '#f2c14e' : kind === 'item' ? AM.RARITY[data.rarity].color : kind === 'dna' ? '#ff6ad5' : kind === 'cons' ? AM.CONSUMABLES[data.id].color : (AM.MATERIALS[data.id] || {}).color || '#ffffff';
    const size = kind === 'item' ? 0.42 : kind === 'gold' ? 0.26 : 0.3;
    const orb = G.fx.orb(color, size);
    const a = Math.random() * 6.28, sp = 1.5 + Math.random() * 2;
    const pk = { kind, data, x, z, y: 0.6, vx: Math.cos(a) * sp, vz: Math.sin(a) * sp, vy: 4, orb, t: 0, color };
    G.pickups.push(pk);
    if (kind === 'item' && AM.RARITY[data.rarity].tier >= 3) pk.beam = G.fx.beam(x, 0, z, x, 4, z, color, 0.12, 0);
    return pk;
  }
  function updatePickups(G, dt) {
    const p = G.player;
    const magnet = G.settings.autoLoot ? 6 : 2.2;
    for (let i = G.pickups.length - 1; i >= 0; i--) {
      const k = G.pickups[i];
      k.t += dt;
      if (k.y > 0.35 || k.vy > 0) { k.vy -= 14 * dt; k.y = Math.max(0.35, k.y + k.vy * dt); k.x += k.vx * dt; k.z += k.vz * dt; if (k.y <= 0.35) { k.vx *= 0.3; k.vz *= 0.3; k.vy = 0; } }
      const d = AM.dist(k.x, k.z, p.x, p.z);
      if (!p.dead && k.t > 0.45 && d < magnet) {
        const sp = 9 + (magnet - d) * 3;
        k.x += ((p.x - k.x) / d) * sp * dt; k.z += ((p.z - k.z) / d) * sp * dt;
        if (d < 0.7) {
          if (G.prog.collect(k)) { k.orb.remove(); if (k.beam) k.beam.remove(); G.pickups.splice(i, 1); continue; }
          k.t = -2; // inventory full: stop magnet for a while
        }
      }
      k.orb.set(k.x, k.y + Math.sin(k.t * 4) * 0.08, k.z);
      if (k.beam) k.beam.set(k.x, 0, k.z, k.x, 4, k.z);
      if (k.t > 240) { k.orb.remove(); if (k.beam) k.beam.remove(); G.pickups.splice(i, 1); }
    }
  }

  AM.Ent = { Entity, genomeFor, moveEntity, separate, spawnWild, spawnNpc, spawnAround, aiUpdate, summonUpdate, dropPickup, updatePickups, provoke, AFFINITY };
})(typeof window !== 'undefined' ? window : globalThis);
