/* Filogênese — núcleo do jogo: estado, criaturas ativas, combate, socialização, interações e sobrevivência. */
(function (FG) {
  'use strict';
  const U = FG.U, TAU = U.TAU, Parts = FG.Parts, Species = FG.Species, AI = FG.AI, FX = FG.FX, Creature = FG.Creature;
  const NICHES = Species.NICHES, SOCIAL = Parts.SOCIAL, COMBAT = Parts.COMBAT;
  const T = (k, a, b) => FG.T(k, a, b);
  const sfx = (n, x, y, o) => { if (FG.Audio) FG.Audio.sfx(n, x, y, o); };
  const rnd = Math.random;
  const GRID = 256;
  const DIFF = {
    easy: { out: 1.25, inn: 0.6, hunger: 0.7, lose: 0, ask: 6 },
    normal: { out: 1, inn: 1, hunger: 1, lose: 0, ask: 5 },
    hard: { out: 0.9, inn: 1.35, hunger: 1.3, lose: 0.25, ask: 4 },
  };
  const OWN_REL = { status: 'ally', friends: 0, kills: 0, anger: 0, seen: true };
  const NEAR = [], NEAR2 = [];

  const G = FG.Game = {
    DIFF, active: false,

    reset() {
      G.active = false; G.creatures = []; G.projectiles = []; G.grid = new Map();
      G.time = 0; G.day = 0.12; G.night = 0; G.rain = 0; G.rainT = 120 + rnd() * 200;
      G.dna = 0; G.dnaTotal = 0; G.level = 1; G.gen = 1; G.unlocked = new Set(); G.rels = {};
      G.stance = 'social'; G.target = null; G.enc = null; G.pack = []; G.packTarget = null;
      G.home = 0; G.arrived = 0; G.hunger = 80; G.breath = 1; G.cine = null; G.auto = null; G.won = false;
      G.interactable = null; G.resting = false; G.hurtFlash = 0; G.shake = 0;
      G.stats = { dist: 0, eaten: 0, fruit: 0, meat: 0, friends: 0, kills: 0, allies: 0, extinct: 0, fossils: 0, deaths: 0, recruited: 0,
        speciesSeen: 0, titansSlain: 0, titansFriend: 0, nights: 0, glide: 0, swim: 0, soc: 0, pred: 0, eggs: 0, play: 0 };
      G.objIdx = 0; G.tick = { spawn: 0, scan: 0, obj: 0, save: 0, slow: 0 }; G.flags = {};
      G.player = null; G.playerSp = null; G.world = null; G.fauna = null; G.homeNest = null;
      FX.clear();
    },

    /** Começa um mundo novo. o: {seed, name, genome, diff, slot} */
    start(o) {
      G.reset();
      G.seed = o.seed >>> 0; G.slot = o.slot || 0; G.diff = o.diff || 'normal';
      G.build();
      G.playerSp = Species.makePlayer(o.name, o.genome, 1);
      G.unlocked = new Set(Parts.starterUnlocks());
      for (const k in o.genome.parts) if (o.genome.parts[k]) G.unlocked.add(o.genome.parts[k]);
      G.dna = o.dna || 0;
      G.setHome(0);
      const s = G.world.ownSites[0];
      G.spawnPlayer(s.x + 46, s.y + 34);
      G.active = true;
      G.spawnTick(); G.rebuildGrid();
      FG.bus.emit('gamestart');
    },
    build() {
      G.world = new FG.World(G.seed);
      G.fauna = Species.generate(G.seed);
      G.world.populate(G.fauna);
      if (FG.Settings && FG.Render) G.world.setQuality(FG.Render.quality);
    },
    setHome(i) {
      const s = G.world.ownSites[Math.min(i, G.world.ownSites.length - 1)];
      if (G.homeNest && G.homeNest.spawned) G.despawnNest(G.homeNest);
      G.home = i;
      G.homeNest = { id: 'home', own: true, x: s.x, y: s.y, sp: 'player', tier: 0, max: 3, pop: 3, eggs: 2, spawned: false, found: true, regen: 0 };
    },
    spawnPlayer(x, y) {
      const p = new Creature(G.playerSp, x, y, { angle: -Math.PI / 2 });
      p.isPlayer = true; p.canSwim = true;
      G.player = p; G.creatures.push(p);
      return p;
    },

    spById(id) { return id === 'player' ? G.playerSp : G.fauna.byId[id]; },
    rel(sp) { return sp.isPlayer ? OWN_REL : (G.rels[sp.id] || (G.rels[sp.id] = { status: 'neutral', friends: 0, kills: 0, anger: 0, seen: false })); },
    packMax() { return Math.min(3, G.level - 1); },
    isSide(c) { return c.isPlayer || !!(c.ai && c.ai.pack); },
    tooStrong(c) { const P = G.player; return P.maxHp * (P.stats.combat + 2) > c.maxHp * (c.stats.combat + 2) * 3.2; },
    voice(c, kind) { if (FG.Audio) FG.Audio.voice(c.sp.voice, kind, c.x, c.y, c.baby); },
    toast(text, kind, icon) { FG.bus.emit('toast', text, kind || 'info', icon); },
    warned(c) { if (!G.flags.warned) { G.flags.warned = true; G.toast(T('t.territory'), 'warn', 'alert'); } },

    // ---------- grade espacial ----------
    rebuildGrid() {
      const g = G.grid; g.clear();
      const L = G.creatures;
      for (let i = 0; i < L.length; i++) {
        const c = L[i], k = ((c.x / GRID) | 0) * 1024 + ((c.y / GRID) | 0);
        const a = g.get(k); if (a) a.push(c); else g.set(k, [c]);
      }
    },
    /** Criaturas (vivas ou mortas) num raio. O array devolvido é reutilizado: copie se for guardar. */
    near(x, y, r, out) {
      out = out || NEAR; out.length = 0;
      const x0 = ((x - r) / GRID) | 0, x1 = ((x + r) / GRID) | 0, y0 = ((y - r) / GRID) | 0, y1 = ((y + r) / GRID) | 0, r2 = r * r;
      for (let gx = x0; gx <= x1; gx++) for (let gy = y0; gy <= y1; gy++) {
        const a = G.grid.get(gx * 1024 + gy);
        if (!a) continue;
        for (let i = 0; i < a.length; i++) { const c = a[i]; if (!c.gone && U.dist2(x, y, c.x, c.y) <= r2) out.push(c); }
      }
      return out;
    },
    /** Ninho de presas ativo mais próximo do território de um caçador. */
    preyNest(c) {
      const h = c.ai.home, lim = c.ai.leash * 0.85;
      let best = null, bd = lim * lim;
      for (const n of G.world.nests) {
        if (!n.spawned || n.pop <= 0) continue;
        const sp = G.fauna.byId[n.sp];
        if (sp === c.sp || NICHES[sp.niche].react === 'hunter' || sp.stats.bulk > c.sp.stats.bulk * 1.7) continue;
        const d = U.dist2(h.x, h.y, n.x, n.y);
        if (d < bd) { bd = d; best = n; }
      }
      return best;
    },
    findCarcass(x, y, r, self) {
      let best = null, bd = r * r;
      const L = G.creatures;
      for (let i = 0; i < L.length; i++) { const c = L[i]; if (!c.dead || c.meat <= 0 || c.gone || (self && c.sp === self.sp)) continue; const d = U.dist2(x, y, c.x, c.y); if (d < bd) { bd = d; best = c; } }
      return best;
    },

    // ---------- ninhos: aparecer e sumir conforme a distância ----------
    spawnTick() {
      const P = G.player, W = G.world;
      const each = (n, sp) => {
        const d = U.dist(P.x, P.y, n.x, n.y), rel = G.rel(sp);
        if (!n.spawned) { if (d < 1500 && rel.status !== 'extinct' && n.pop > 0) G.spawnNest(n, sp); }
        else if (d > 1950) G.despawnNest(n);
        if (!n.found && d < 430) { n.found = true; FG.bus.emit('mapdirty'); }
        if (n.pop < n.max && rel.status !== 'extinct' && (n.regen += 0.5) > 80) {
          n.regen = 0; n.pop++;
          if (n.spawned && d > 520) G.addMember(n, sp, false);
        }
      };
      for (const n of W.nests) each(n, G.fauna.byId[n.sp]);
      each(G.homeNest, G.playerSp);
      for (const t of W.titanSpots) {
        if (!t.alive) continue;
        const d = U.dist(P.x, P.y, t.x, t.y);
        if (!t.c && d < 1700) {
          const sp = G.fauna.byId[t.sp], c = new Creature(sp, t.x, t.y);
          AI.init(c, { x: t.x, y: t.y, r: 420, leash: 1500 }); c.titanSpot = t; t.c = c; G.creatures.push(c);
          if (G.rel(sp).status === 'ally') c.friend = true;
        } else if (t.c && (d > 2300 || t.c.gone)) { if (!t.c.dead) t.c.gone = true; t.c = null; }
      }
    },
    addMember(n, sp, baby) {
      const W = G.world, p = W.randomNear(n.x, n.y, 30, 150, rnd);
      const c = new Creature(sp, p.x, p.y, { baby, nest: baby ? null : n });
      const hunter = NICHES[sp.niche].react === 'hunter';
      AI.init(c, { x: n.x, y: n.y, r: n.own ? 150 : 230, leash: hunter ? 1900 : 900 });
      c.homeNest = n;
      if (baby) { c.ai.parent = n.members[0] || null; n.babies.push(c); }
      else {
        const rel = G.rel(sp);
        if (rel.status === 'ally' || n.members.length < rel.friends) c.friend = true;
        n.members.push(c);
      }
      if (AI.shouldSleep(sp)) { c.ai.st = 'sleep'; c.sleeping = true; }
      G.creatures.push(c);
      return c;
    },
    spawnNest(n, sp) {
      n.members = []; n.babies = []; n.spawned = true;
      for (let i = 0; i < n.pop; i++) G.addMember(n, sp, false);
      const nb = n.own ? 1 : n.max >= 3 ? 1 + (rnd() < 0.4 ? 1 : 0) : 0;
      for (let i = 0; i < nb; i++) G.addMember(n, sp, true);
    },
    despawnNest(n) {
      for (const c of n.members) if (!c.dead && !(c.ai && c.ai.pack)) c.gone = true;
      for (const c of n.babies) if (!c.dead) c.gone = true;
      n.spawned = false; n.members = null; n.babies = null;
    },

    // ---------- habilidades ----------
    dmg(c, ab) {
      const l = c.stats[ab], p = c.stats.power;
      if (ab === 'bite') return (6 + 5 * l) * p;
      if (ab === 'strike') return (9 + 6.5 * l) * p;
      if (ab === 'charge') return (9 + 7 * l) * p;
      return (4 + 3.5 * l) * p;
    },
    canHit(att, vic) {
      if (att === vic || vic.dead || vic.gone || vic.jz > 16) return false;
      const pa = G.isSide(att), pv = G.isSide(vic);
      if (pa && pv) return false;
      if (att.sp === vic.sp) return false;
      if (pa && vic.sp.isPlayer) return false;
      return true;
    },
    /** Usa uma habilidade (social ou de combate). Devolve true se começou. */
    useAbility(c, ab, tgt) {
      const st = c.stats;
      if (c.dead || c.stun > 0 || !(st[ab] > 0) || c.jz > 6 || c.wet >= 2) return false;
      if (SOCIAL.includes(ab)) {
        if (c.cd.social > 0) return false;
        c.cd.social = 1.45;
        const dur = ab === 'dance' ? 1.4 : 1.25;
        c.play(ab, dur);
        const hx = c.rs[0], hy = c.rs[1];
        if (ab === 'sing') { G.voice(c, 'sing'); FX.burst('note', hx, hy - 6, 3, { col: c.bp.col.accL }); }
        else if (ab === 'dance') { sfx('dance', c.x, c.y); FX.burst('dust', c.x, c.y, 4); }
        else if (ab === 'charm') { sfx('charm', c.x, c.y); FX.burst('star', hx, hy - 6, 3); }
        else { G.voice(c, 'growl'); sfx('pose', c.x, c.y); FX.add('ring', c.x, c.y, { size: c.radius * 3, col: c.bp.col.accL }); }
        if (c.isPlayer) G.playerSocial(ab);
        return true;
      }
      if (c.cd[ab] > 0) return false;
      if (c.anim && (c.anim.name === 'bite' || c.anim.name === 'strike' || c.anim.name === 'spit' || c.anim.name === 'charge')) return false;
      const m = c.isPlayer ? 1 : 1.4;
      c.combatT = G.time;
      if (ab === 'bite') { c.cd.bite = 0.8 * m; c.play('bite', 0.32, { hitAt: 0.42, tgt }); }
      else if (ab === 'strike') { c.cd.strike = 2.6 * m; c.play('strike', 0.46, { hitAt: 0.45, tgt, dir: rnd() < 0.5 ? 1 : -1 }); sfx('whoosh', c.x, c.y); }
      else if (ab === 'spit') { c.cd.spit = 3.2 * m; c.play('spit', 0.4, { hitAt: 0.5, tgt }); }
      else if (ab === 'charge') {
        c.cd.charge = 5.5 * m;
        const a = tgt && !tgt.dead ? Math.atan2(tgt.y - c.y, tgt.x - c.x) : c.angle, s = 470 + 35 * st.charge;
        c.dash = 0.44; c.dashX = Math.cos(a) * s; c.dashY = Math.sin(a) * s; c.angle = a;
        c.play('charge', 0.44, { tgt });
        sfx('charge', c.x, c.y); FX.burst('dust', c.x, c.y, 6);
      }
      return true;
    },
    pickFront(c, range) {
      const L = G.near(c.x, c.y, range + 70, NEAR2);
      let best = null, bd = 1e9;
      for (let i = 0; i < L.length; i++) {
        const o = L[i];
        if (!G.canHit(c, o)) continue;
        if (c.isPlayer && G.rel(o.sp).status === 'ally') continue;
        const d = U.dist(c.x, c.y, o.x, o.y);
        if (d > range + o.radius || Math.abs(U.angDiff(c.headA, Math.atan2(o.y - c.y, o.x - c.x))) > 1.1) continue;
        if (d < bd) { bd = d; best = o; }
      }
      return best;
    },
    /** Momento do impacto de uma animação de ataque. */
    resolve(c, A) {
      if (A.name === 'bite') {
        const range = c.reach + 12;
        let t = A.tgt;
        if (!t || t.dead || t.gone || !G.canHit(c, t) || U.dist(c.x, c.y, t.x, t.y) > range + t.radius * 1.15) t = G.pickFront(c, range);
        if (t) G.hit(c, t, G.dmg(c, 'bite'), { kind: 'bite' });
        else sfx('snap', c.x, c.y);
      } else if (A.name === 'strike') {
        const hx = c.x + Math.cos(c.angle) * c.reach * 0.6, hy = c.y + Math.sin(c.angle) * c.reach * 0.6, R = c.reach * 1.2 + 16 * c.bp.size;
        FX.add('ring', hx, hy, { size: R * 1.1, col: 'rgba(255,255,255,0.7)', life: 0.3 });
        const L = G.near(hx, hy, R + 70, []), pa = G.isSide(c);
        for (const o of L) {
          if (!G.canHit(c, o) || U.dist(hx, hy, o.x, o.y) > R + o.radius) continue;
          if (pa && o !== A.tgt && G.rel(o.sp).status === 'ally') continue;
          if (!pa && !G.isSide(o) && o !== A.tgt) continue;
          G.hit(c, o, G.dmg(c, 'strike'), { kind: 'strike', knock: 300 });
        }
      } else if (A.name === 'spit') {
        const l = c.stats.spit, sx = c.rs[0], sy = c.rs[1], sp = 540, t = A.tgt;
        let a = c.headA;
        if (t && !t.dead) { const d = U.dist(sx, sy, t.x, t.y), lead = d / sp * 0.7; a = Math.atan2(t.y + t.vy * lead - sy, t.x + t.vx * lead - sx); }
        G.projectiles.push({ x: sx, y: sy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: (400 + 40 * l) / sp, src: c, dmg: G.dmg(c, 'spit'), pdps: (2 + 1.5 * l) * c.stats.power, r: 4 + l });
        sfx('spit', c.x, c.y);
      }
    },
    chargeCheck(c, A) {
      const L = G.near(c.x, c.y, c.radius + 90, NEAR2), pa = G.isSide(c);
      for (let i = 0; i < L.length; i++) {
        const o = L[i];
        if (!G.canHit(c, o) || U.dist(c.x, c.y, o.x, o.y) > c.radius + o.radius + 8) continue;
        if (pa ? (o !== A.tgt && G.rel(o.sp).status === 'ally') : (o !== A.tgt && !G.isSide(o))) continue;
        A.done = true; c.dash = 0; c.vx *= 0.15; c.vy *= 0.15;
        G.hit(c, o, G.dmg(c, 'charge'), { kind: 'charge', knock: 460, stun: 0.5 + 0.12 * c.stats.charge });
        if (o.isPlayer || c.isPlayer) G.addShake(7);
        return;
      }
    },
    addShake(v) { G.shake = Math.min(14, G.shake + v); },

    /** Aplica dano de `att` em `vic`. */
    hit(att, vic, dmg, o) {
      o = o || {};
      if (vic.dead) return;
      const pa = att && G.isSide(att), pv = G.isSide(vic), D = DIFF[G.diff];
      if (pa) dmg *= D.out; else dmg *= 0.8;
      if (pv && !pa) dmg *= D.inn;
      let crit = false;
      if (att && att.sneaking && vic.ai && vic.ai.st !== 'fight' && vic.ai.st !== 'flee') { dmg *= 2; crit = true; }
      if (vic.sleeping) { dmg *= 1.5; crit = true; }
      dmg = Math.max(1, Math.round(dmg));
      vic.hp -= dmg; vic.flash = 1; vic.combatT = G.time;
      if (att) {
        att.combatT = G.time;
        if (o.kind !== 'spit') vic.knock(vic.x - att.x, vic.y - att.y, o.knock || 130);
        if (o.kind !== 'spit' && o.kind !== 'poison' && vic.stats.thorns > 0 && !att.dead) {
          att.hp -= vic.stats.thorns * 3; att.flash = 0.6;
          FX.burst('hit', att.x, att.y, 3, { col: '#efe6cf' });
          if (att.hp <= 0) G.kill(att, vic);
        }
      }
      if (o.stun) vic.stun = Math.max(vic.stun, o.stun);
      if (o.pdps) { vic.poison = 3; vic.poisonDps = o.pdps; vic.poisonSrc = att; }
      const a = att ? Math.atan2(vic.y - att.y, vic.x - att.x) : 0;
      for (let i = 0; i < 5; i++) FX.add('hit', vic.x, vic.y, { a: a + (rnd() - 0.5) * 1.6, col: o.kind === 'spit' ? '#9be04a' : '#ffd9a0' });
      if (!FG.Settings || FG.Settings.data.dmgNumbers) FX.text(vic.x + (rnd() - 0.5) * 16, vic.y - vic.radius - 10, (crit ? '★' : '') + dmg, pv ? '#ff7a6a' : crit ? '#ffd24a' : '#ffeec2', crit ? 19 : 15);
      if (crit && pa) FX.text(vic.x, vic.y - vic.radius - 30, T('fx.ambush'), '#ffd24a', 13);
      sfx(o.kind === 'bite' ? 'bite' : 'hit', vic.x, vic.y);
      if (vic.isPlayer) { G.addShake(5); G.hurtFlash = 1; FG.bus.emit('vibrate', 40); }
      else if (vic.hp > 0 && rnd() < 0.4) G.voice(vic, 'yelp');
      if (pa && !vic.sp.isPlayer) G.provoke(vic.sp);
      if (att) {
        if (pv && !pa && !att.dead) G.packTarget = att;
        if (att.isPlayer) G.packTarget = vic;
      }
      if (G.enc && (G.enc.c === vic || vic.isPlayer)) G.endEnc(false);
      if (vic.hp <= 0) G.kill(vic, att);
      else if (vic.ai) AI.onHit(vic, att, G);
    },
    provoke(sp) {
      const rel = G.rel(sp);
      if (rel.status === 'extinct') return;
      if (rel.status === 'ally') {
        rel.status = 'neutral'; rel.friends = 0;
        G.toast(T('t.allyLost', FG.spName(sp)), 'bad', 'alert');
        for (const c of G.creatures) if (c.sp === sp) c.friend = false;
        FG.bus.emit('mapdirty');
      }
      rel.anger = 50;
    },
    kill(vic, att) {
      if (vic.dead) return;
      vic.dead = true; vic.hp = 0; vic.deadT = 0; vic.anim = null; vic.mx = vic.my = 0; vic.vx = vic.vy = 0; vic.dash = 0;
      vic.sleeping = false; vic.poison = 0; vic.blink = 1; vic.jz = 0; vic.z = 0; vic.scaleMul = 1; vic.sprinting = false;
      vic.meat = vic.sp.isTitan ? 14 : U.clamp(Math.round(vic.stats.bulk * 3 * (vic.baby ? 0.4 : 1)), 1, 8);
      G.voice(vic, 'die');
      FX.burst('dust', vic.x, vic.y, 8);
      const n = vic.nest;
      if (n) { if (n.members) { const i = n.members.indexOf(vic); if (i >= 0) n.members.splice(i, 1); } n.pop = Math.max(0, n.pop - 1); }
      if (vic.isPlayer) return G.playerDied(att);
      if (vic.ai && vic.ai.pack) { G.removeFromPack(vic); G.toast(T('t.packLost', FG.spName(vic.sp)), 'bad', 'paw'); }
      if (G.target === vic) G.target = null;
      if (G.packTarget === vic) G.packTarget = null;
      if (G.enc && G.enc.c === vic) G.enc = null;
      const pa = att && G.isSide(att), sp = vic.sp;
      if (pa && !sp.isPlayer) {
        const rel = G.rel(sp);
        if (!vic.baby) {
          rel.kills++; G.stats.kills++; G.stats.pred++;
          G.addDna(4 + 3 * sp.tier, vic.x, vic.y);
          if (sp.isTitan) { if (vic.titanSpot) { vic.titanSpot.alive = false; vic.titanSpot.c = null; } G.stats.titansSlain++; G.addDna(150, vic.x, vic.y); G.addShake(12); }
          if (rel.kills >= sp.needKills && rel.status !== 'extinct') G.extinct(sp);
          else if (!sp.isTitan) FX.text(vic.x, vic.y - vic.radius - 34, rel.kills + '/' + sp.needKills, '#ffb0a0', 13);
        }
        FG.bus.emit('progress');
      } else if (att && att.ai && !pa && att.sp.diet !== 'H') {
        att.ai.food = vic; att.ai.tx = vic.x; att.ai.ty = vic.y; AI.set(att, 'scavenge'); att.ai.tgt = null;
        // a refeição é do grupo: os companheiros de caça também ficam saciados por um tempo
        for (const o of G.near(vic.x, vic.y, 600, [])) if (o !== att && o.sp === att.sp && o.ai && !o.dead) { o.ai.hunger = 70 + rnd() * 70; o.ai.prowls = 0; if (o.ai.tgt === vic) { o.ai.tgt = null; o.ai.food = vic; AI.set(o, 'scavenge'); } }
      }
    },
    extinct(sp) {
      const rel = G.rel(sp);
      rel.status = 'extinct'; rel.anger = 0; G.stats.extinct++;
      const P = G.player;
      G.addDna(25 + 15 * sp.tier, P.x, P.y - 30);
      const part = G.unlockFrom(sp);
      G.toast(T('t.extinct', FG.spName(sp)) + (part ? ' ' + T('t.partGot', T('p.' + part.id)) : ''), 'big', 'skull');
      sfx('extinct');
      for (const n of G.world.nests) if (n.sp === sp.id) n.pop = 0;
      for (const c of G.creatures) if (c.sp === sp && !c.dead) c.exile = true;
      FG.bus.emit('mapdirty'); FG.bus.emit('progress');
    },

    // ---------- socialização ----------
    encValid(c) { return c && !c.dead && !c.gone && c.ai && !c.ai.pack && !c.sp.isPlayer && !c.baby && !c.exile; },
    playerSocial(ab) {
      const P = G.player;
      for (const m of G.pack) if (!m.dead && !m.anim && U.dist(m.x, m.y, P.x, P.y) < 360 && m.ai.st !== 'fight') { m.play(ab, 1.25); m.mimic = G.time; }
      if (G.enc) return G.respond(ab);
      let t = G.target;
      if (!G.encValid(t) || t.friend || U.dist(P.x, P.y, t.x, t.y) > 300) {
        const keep = G.encValid(t) && t.friend && U.dist(P.x, P.y, t.x, t.y) <= 300 ? t : null;
        t = null; let bd = 260;
        for (const o of G.near(P.x, P.y, 260, NEAR2)) { if (!G.encValid(o) || o.friend) continue; const d = U.dist(P.x, P.y, o.x, o.y); if (d < bd) { bd = d; t = o; } }
        if (t) G.target = t; else t = keep;
      }
      if (t) G.startEnc(t, ab);
    },
    startEnc(t, ab) {
      const P = G.player, sp = t.sp, rel = G.rel(sp);
      if (t.friend) { t.play('happy', 0.8); FX.add('heart', t.x, t.y - t.radius - 10); G.voice(t, 'chirp'); return; }
      if (rel.status === 'extinct') return;
      if (t.ai.st === 'fight' || rel.anger > 0) {
        // furioso: só se acalma se a exibição impressionar
        if (P.stats[ab] >= Math.min(5, sp.tier + 2) && rnd() < 0.7) { rel.anger = 0; t.ai.tgt = null; FX.add('q', t.x, t.y - t.radius - 12); }
        else { FX.add('anger', t.x, t.y - t.radius - 12); if (!G.flags.furious) { G.flags.furious = true; G.toast(T('t.furious'), 'warn', 'alert'); } return; }
      }
      if (t.sleeping) { t.sleeping = false; }
      AI.set(t, 'social');
      G.enc = { c: t, want: null, phase: 'wait', wait: 1.0, timer: 0, tmax: DIFF[G.diff].ask, misses: 0, last: null };
      t.friendMeter = Math.max(t.friendMeter, 0.06);
      G.voice(t, 'chirp');
      FG.bus.emit('enc');
    },
    endEnc(ok) {
      const e = G.enc;
      if (!e) return;
      G.enc = null;
      const t = e.c;
      if (t && !t.dead && t.ai && t.ai.st === 'social') AI.set(t, 'idle', ok ? 3 : 1);
      FG.bus.emit('enc');
    },
    updateEnc(dt) {
      const e = G.enc, P = G.player, t = e.c;
      if (!G.encValid(t) || P.dead || t.ai.st !== 'social') return G.endEnc(false);
      if (U.dist(P.x, P.y, t.x, t.y) > 400) { G.endEnc(false); return; }
      if (e.phase === 'wait') {
        if ((e.wait -= dt) <= 0) {
          // pede de preferência algo que o jogador sabe fazer; sem nada em comum, pede o que ela sabe
          let opts = SOCIAL.filter((a) => t.stats[a] > 0 && P.stats[a] > 0);
          if (!opts.length) opts = SOCIAL.filter((a) => t.stats[a] > 0);
          if (opts.length > 1) opts = opts.filter((a) => a !== e.last || rnd() < 0.3);
          e.want = e.last = opts.length ? opts[(rnd() * opts.length) | 0] : 'sing';
          e.phase = 'ask'; e.timer = e.tmax;
          t.cd.social = 0; G.useAbility(t, e.want);
        }
      } else if ((e.timer -= dt) <= 0) {
        e.misses++; t.friendMeter = Math.max(0, t.friendMeter - 0.06);
        FX.add('q', t.x, t.y - t.radius - 12);
        if (e.misses >= 3) { G.toast(T('t.encFail'), 'info', 'note'); G.endEnc(false); }
        else { e.phase = 'wait'; e.wait = 0.7; e.want = null; }
      }
    },
    respond(ab) {
      const e = G.enc, t = e.c, P = G.player;
      if (e.phase !== 'ask') return;
      const N = NICHES[t.sp.niche];
      if (ab === e.want) {
        const d = P.stats[ab] - t.stats[ab];
        let gain = d >= 1 ? 0.5 : d === 0 ? 0.34 : d === -1 ? 0.2 : 0.1;
        let mates = 0;
        for (const m of G.pack) if (m.mimic === G.time) mates++;
        // espécies muito mais vistosas que você demoram mais a se impressionar
        gain = (gain + mates * 0.05) * N.soc * U.clamp(0.45 + 0.55 * P.stats.social / Math.max(1, t.stats.social), 0.45, 1.15);
        t.friendMeter += gain;
        FX.burst('heart', t.x, t.y - t.radius - 8, 2);
        FX.text(t.x, t.y - t.radius - 30, d >= 1 ? T('fx.great') : d === 0 ? T('fx.good') : T('fx.weak'), d >= 0 ? '#9df0a8' : '#ffd76a', 14);
        sfx('good', t.x, t.y);
        t.play('happy', 0.7);
      } else {
        t.friendMeter = Math.max(0, t.friendMeter - 0.08); e.misses++;
        FX.add('q', t.x, t.y - t.radius - 12); sfx('bad', t.x, t.y);
        if (e.misses >= 3) { G.toast(T('t.encFail'), 'info', 'note'); return G.endEnc(false); }
      }
      if (t.friendMeter >= 1) return G.befriend(t);
      e.phase = 'wait'; e.wait = 1.25; e.want = null;
    },
    befriend(t) {
      const sp = t.sp, rel = G.rel(sp);
      t.friend = true; t.friendMeter = 1; rel.friends++; rel.anger = 0;
      G.stats.friends++; G.stats.soc++;
      G.endEnc(true);
      t.play('happy', 1.2); G.voice(t, 'chirp');
      FX.burst('heart', t.x, t.y - t.radius, 6); FX.add('ring', t.x, t.y, { size: 60, col: '#9df0a8' });
      sfx('friend', t.x, t.y);
      G.addDna(6 + 3 * sp.tier, t.x, t.y);
      if (rel.status !== 'ally') {
        if (rel.friends >= sp.needFriends) G.ally(sp);
        else FX.text(t.x, t.y - t.radius - 48, rel.friends + '/' + sp.needFriends, '#9df0a8', 14);
      }
      FG.bus.emit('progress');
    },
    ally(sp) {
      const rel = G.rel(sp), P = G.player;
      rel.status = 'ally'; rel.anger = 0; G.stats.allies++;
      if (sp.isTitan) G.stats.titansFriend++;
      G.addDna(25 + 15 * sp.tier + (sp.isTitan ? 150 : 0), P.x, P.y - 30);
      const part = G.unlockFrom(sp);
      G.toast(T('t.ally', FG.spName(sp)) + (part ? ' ' + T('t.partGot', T('p.' + part.id)) : ''), 'big', 'heart');
      sfx('ally');
      for (const c of G.creatures) if (c.sp === sp && !c.dead) { c.friend = true; if (!c.anim) c.play('happy', 1); }
      FG.bus.emit('mapdirty'); FG.bus.emit('progress');
    },

    // ---------- bando ----------
    recruit(c) {
      if (G.pack.length >= G.packMax() || c.dead || c.baby || (c.ai && c.ai.pack)) return false;
      const n = c.nest;
      if (n) { if (n.members) { const i = n.members.indexOf(c); if (i >= 0) n.members.splice(i, 1); } n.pop = Math.max(0, n.pop - 1); c.nest = null; }
      c.ai.pack = true; c.ai.slot = G.pack.length; c.canSwim = true; c.friend = true; AI.set(c, 'follow');
      G.pack.push(c); G.stats.recruited++;
      c.play('happy', 1); G.voice(c, 'chirp'); FX.burst('star', c.x, c.y - c.radius, 5); sfx('friend', c.x, c.y);
      G.toast(T('t.recruited', FG.spName(c.sp)), 'good', 'paw');
      FG.bus.emit('pack'); FG.bus.emit('progress');
      return true;
    },
    removeFromPack(c) {
      const i = G.pack.indexOf(c);
      if (i < 0) return;
      G.pack.splice(i, 1);
      G.pack.forEach((m, k) => { m.ai.slot = k; });
      c.ai.pack = false;
      FG.bus.emit('pack');
    },
    dismiss(c) {
      if (!c || !c.ai || !c.ai.pack) return;
      G.removeFromPack(c);
      c.canSwim = false; c.exile = true; AI.set(c, 'idle', 1);
      G.toast(T('t.dismissed', FG.spName(c.sp)), 'info', 'paw');
    },

    // ---------- DNA e desbloqueios ----------
    addDna(n, x, y) {
      n = Math.round(n);
      if (n <= 0) return;
      G.dna += n; G.dnaTotal += n;
      if (x != null) { FX.text(x, y - 20, '+' + n + ' DNA', '#7cf0c0', 16); FX.burst('dna', x, y, Math.min(10, 3 + (n / 6 | 0))); }
      sfx('dna');
      FG.bus.emit('dna', n);
      G.checkLevel();
    },
    /** Desbloqueia uma parte que a espécie tem (ou uma compatível com o nível dela). */
    unlockFrom(sp) {
      const own = Object.values(sp.genome.parts).filter((id) => id && !G.unlocked.has(id)).map(Parts.get).sort((a, b) => b.tier - a.tier);
      let p = own[0];
      if (!p) { const pool = Parts.defs.filter((d) => !G.unlocked.has(d.id) && d.tier <= sp.tier + 1); p = pool[(rnd() * pool.length) | 0]; }
      if (!p) { G.dna += 10; G.dnaTotal += 10; return null; }
      G.unlocked.add(p.id);
      return p;
    },
    unlockRandom(maxTier) {
      let pool = Parts.defs.filter((d) => !G.unlocked.has(d.id) && d.tier <= maxTier);
      if (!pool.length) pool = Parts.defs.filter((d) => !G.unlocked.has(d.id));
      if (!pool.length) return null;
      const lo = Math.min(...pool.map((d) => d.tier)), hi = Math.max(...pool.map((d) => d.tier));
      const want = rnd() < 0.6 ? hi : lo, sel = pool.filter((d) => d.tier === want);
      const p = sel[(rnd() * sel.length) | 0];
      G.unlocked.add(p.id);
      return p;
    },

    // ---------- interação contextual ----------
    scanInteract() {
      const P = G.player, W = G.world, diet = P.stats.diet;
      let it = null;
      const H = G.homeNest;
      if (P.dead || G.cine) return (G.interactable = null);
      for (const f of W.fossils) if (!f.taken && U.dist2(P.x, P.y, f.x, f.y) < 62 * 62) { it = { type: 'dig', f, x: f.x, y: f.y }; break; }
      if (!it && U.dist2(P.x, P.y, H.x, H.y) < 80 * 80) {
        if (!G.won && G.level >= 5 && G.dnaTotal >= G.SAPIENCE) it = { type: 'awaken', x: H.x, y: H.y };
        else it = { type: 'evolve', x: H.x, y: H.y };
      }
      if (!it) {
        let bd = 1e9, blocked = null;
        // carcaças
        for (const c of G.near(P.x, P.y, 140, NEAR2)) {
          if (!c.dead || c.meat <= 0) continue;
          const d = U.dist(P.x, P.y, c.x, c.y) - c.radius;
          if (d > P.reach + 22) continue;
          if (diet === 'H') { blocked = { type: 'no', why: 'meat', x: c.x, y: c.y }; continue; }
          if (d < bd) { bd = d; it = { type: 'meat', c, x: c.x, y: c.y }; }
        }
        // arbustos com fruto
        const b = W.findBush(P.x, P.y, P.reach + 34);
        if (b) { if (diet === 'C') blocked = blocked || { type: 'no', why: 'fruit', x: b.x, y: b.y }; else { const d = U.dist(P.x, P.y, b.x, b.y) - 20; if (d < bd) { bd = d; it = { type: 'fruit', b, x: b.x, y: b.y }; } } }
        // ovos de outras espécies
        if (!it && diet !== 'H') for (const n of W.nests) {
          if (n.eggs <= 0 || U.dist2(P.x, P.y, n.x, n.y) > 58 * 58 || G.rel(G.fauna.byId[n.sp]).status !== 'neutral') continue;
          it = { type: 'egg', n, x: n.x, y: n.y }; break;
        }
        // recrutar
        if (!it && G.pack.length < G.packMax()) for (const c of G.near(P.x, P.y, 110, NEAR2)) {
          if (c.dead || c.isPlayer || c.baby || !c.ai || c.ai.pack || c.exile || c.sp.isTitan) continue;
          if (!(c.sp.isPlayer || (c.friend && G.rel(c.sp).status === 'ally'))) continue;
          const d = U.dist(P.x, P.y, c.x, c.y);
          if (d < bd) { bd = d; it = { type: 'recruit', c, x: c.x, y: c.y }; }
        }
        if (!it) it = blocked;
      }
      G.interactable = it;
      return it;
    },
    interact() {
      const P = G.player, it = G.scanInteract();
      if (!it || P.anim || P.jz > 0) return false;
      const face = () => { P.angle = U.angTo(P.angle, Math.atan2(it.y - P.y, it.x - P.x), 1.2); P.lookAt = it; };
      switch (it.type) {
        case 'no': G.toast(T(it.why === 'meat' ? 't.noMeat' : 't.noFruit'), 'warn', 'mouth'); sfx('deny'); return false;
        case 'fruit':
          if (!G.world.takeFruit(it.b)) return false;
          face(); P.play('eat', 0.9); G.eat(22, 'fruit', it.x, it.y, '#e85d75'); return true;
        case 'meat':
          face(); P.play('eat', 0.9); it.c.meat -= 1; G.eat(26, 'meat', it.x, it.y, '#c9463c'); return true;
        case 'egg': {
          const sp = G.fauna.byId[it.n.sp];
          face(); P.play('eat', 0.9); it.n.eggs--; G.stats.eggs++; G.eat(34, 'meat', it.x, it.y, '#f3ead2');
          FX.burst('shell', it.x, it.y, 6); G.provoke(sp);
          return true;
        }
        case 'dig': {
          const f = it.f;
          face(); P.play('eat', 1.1); f.taken = true; G.stats.fossils++;
          FX.burst('dust', f.x, f.y, 10); FX.burst('shell', f.x, f.y, 6);
          const part = G.unlockRandom(f.tier + 2);
          G.addDna(12, f.x, f.y);
          G.toast(part ? T('t.fossil', T('p.' + part.id)) : T('t.fossilNone'), 'good', 'bone');
          sfx('fossil'); FG.bus.emit('mapdirty'); FG.bus.emit('progress');
          return true;
        }
        case 'recruit': return G.recruit(it.c);
        case 'evolve': G.startMate(); return true;
        case 'awaken': G.startAwaken(); return true;
      }
      return false;
    },
    eat(amount, kind, x, y, col) {
      G.hunger = Math.min(100, G.hunger + amount);
      G.stats.eaten++; G.stats[kind]++;
      const P = G.player;
      P.hp = Math.min(P.maxHp, P.hp + P.maxHp * 0.04);
      FX.burst('crumb', P.rs[0], P.rs[1], 6, { col });
      sfx('munch', P.x, P.y);
      FG.bus.emit('progress');
    },
    npcAte(c, bush, carcass) {
      FX.burst('crumb', c.rs[0], c.rs[1], 4, { col: carcass ? '#c9463c' : '#e85d75' });
      if (bush && rnd() < 0.5) G.world.takeFruit(bush);
      sfx('munch', c.x, c.y, { vol: 0.5 });
    },

    // ---------- controle do jogador ----------
    setStance(s) {
      if (G.stance === s) return;
      G.stance = s; G.auto = null;
      // ao entrar em combate, solta o alvo amigo para não atacar aliados sem querer
      if (s === 'combat' && G.target && (G.target.friend || G.rel(G.target.sp).status === 'ally')) G.target = null;
      if (s === 'combat' && G.enc) G.endEnc(false);
      sfx(s === 'combat' ? 'stanceC' : 'stanceS');
      FG.bus.emit('stance');
    },
    setTarget(c) { G.target = c; G.auto = null; FG.bus.emit('target'); },
    /** Alvo sob um ponto do mundo (toque/clique). */
    tapAt(x, y) {
      let best = null, bd = 1e9;
      for (const c of G.near(x, y, 220, NEAR2)) {
        if (c.isPlayer || c.gone) continue;
        const d = U.dist(x, y, c.x, c.y) - c.radius * 1.3 - 16;
        if (d < 0 && d < bd) { bd = d; best = c; }
      }
      if (best) { G.setTarget(best === G.target ? null : best); sfx('tick'); return true; }
      return false;
    },
    cycleTarget() {
      const P = G.player, L = G.near(P.x, P.y, 520, []).filter((c) => !c.isPlayer && !c.dead && !(c.ai && c.ai.pack)).sort((a, b) => U.dist2(P.x, P.y, a.x, a.y) - U.dist2(P.x, P.y, b.x, b.y));
      if (!L.length) return G.setTarget(null);
      const i = L.indexOf(G.target);
      G.setTarget(L[(i + 1) % L.length]); sfx('tick');
    },
    autoTarget(social) {
      const P = G.player;
      let best = null, bs = 1e9;
      for (const c of G.near(P.x, P.y, 430, NEAR2)) {
        if (c.isPlayer || c.dead || c.gone || (c.ai && c.ai.pack) || c.sp.isPlayer) continue;
        const rel = G.rel(c.sp);
        if (social ? (c.friend || c.baby || rel.status === 'extinct') : rel.status === 'ally') continue;
        const d = U.dist(P.x, P.y, c.x, c.y), front = Math.abs(U.angDiff(P.angle, Math.atan2(c.y - P.y, c.x - P.x)));
        const sc = d + front * 60 - (!social && c.ai && c.ai.tgt === P ? 200 : 0);
        if (sc < bs) { bs = sc; best = c; }
      }
      return best;
    },
    /** Botão de habilidade i (0..3) na postura atual. */
    ability(i) {
      const P = G.player;
      if (!P || P.dead || G.cine) return;
      const social = G.stance === 'social', ab = (social ? SOCIAL : COMBAT)[i];
      if (!(P.stats[ab] > 0)) { G.toast(T('t.noAbility', T('ab.' + ab)), 'warn', ab); sfx('deny'); return; }
      const auto = !FG.Settings || FG.Settings.data.autoTarget;
      let t = G.target;
      if (t && (t.dead || t.gone)) t = G.target = null;
      if (social) {
        if (!G.enc && (!t || !G.encValid(t) || t.friend) && auto) { const n = G.autoTarget(true); if (n) t = G.target = n; }
        if (t && !G.enc && G.encValid(t) && !t.friend && U.dist(P.x, P.y, t.x, t.y) > 230) { G.auto = { ab, t, social: true }; return; }
        G.useAbility(P, ab, t);
        return;
      }
      if ((!t || !G.canHit(P, t)) && auto) { t = G.autoTarget(false); if (t) G.target = t; }
      if (t && !G.canHit(P, t)) t = null;
      if (t && (ab === 'bite' || ab === 'strike')) {
        const range = P.reach + t.radius * 0.9;
        if (U.dist(P.x, P.y, t.x, t.y) > range && U.dist(P.x, P.y, t.x, t.y) < 520) { G.auto = { ab, t }; return; }
      }
      if (t && ab !== 'charge') P.angle = U.angTo(P.angle, Math.atan2(t.y - P.y, t.x - P.x), 0.9);
      G.useAbility(P, ab, t);
    },
    /** Converte a entrada (FG.Input) em intenção do jogador. */
    control(I, dt) {
      const P = G.player;
      if (!P) return;
      if (P.dead || G.cine) { P.mx = P.my = 0; P.sprint = false; I.events.length = 0; I.tap = null; return; }
      let mx = I.mx, my = I.my;
      const moving = mx !== 0 || my !== 0;
      if (moving) G.auto = null;
      P.sprint = I.sprint; P.sneaking = I.sneak && !I.sprint;
      let t = G.target;
      if (t && (t.dead && t.meat <= 0 || t.gone || U.dist2(P.x, P.y, t.x, t.y) > 950 * 950)) { t = G.target = null; FG.bus.emit('target'); }
      P.lookAt = t || (G.interactable && G.interactable.type !== 'evolve' ? G.interactable : null);
      P.faceT = null;
      const A = G.auto;
      if (A) {
        if (A.t.dead || A.t.gone || U.dist(P.x, P.y, A.t.x, A.t.y) > 700) G.auto = null;
        else {
          const d = U.dist(P.x, P.y, A.t.x, A.t.y), range = A.social ? 180 : P.reach + A.t.radius * 0.85;
          if (d > range) { const a = Math.atan2(A.t.y - P.y, A.t.x - P.x); mx = Math.cos(a); my = Math.sin(a); P.sprint = !A.social && d > 140; if (A.social) P.sprint = false; }
          else { G.auto = null; P.angle = U.angTo(P.angle, Math.atan2(A.t.y - P.y, A.t.x - P.x), 1.2); G.useAbility(P, A.ab, A.t); }
        }
      } else if (!moving && t && !t.dead && (G.enc || (G.stance === 'combat' && G.time - P.combatT < 3)) && U.dist2(P.x, P.y, t.x, t.y) < 320 * 320) P.faceT = Math.atan2(t.y - P.y, t.x - P.x);
      P.mx = mx; P.my = my;
      for (let i = 0; i < I.events.length; i++) {
        const ev = I.events[i];
        if (ev === 'a1') G.ability(0); else if (ev === 'a2') G.ability(1); else if (ev === 'a3') G.ability(2); else if (ev === 'a4') G.ability(3);
        else if (ev === 'stance') G.setStance(G.stance === 'social' ? 'combat' : 'social');
        else if (ev === 'interact') G.interact();
        else if (ev === 'jump') { if (P.jump()) sfx('jump', P.x, P.y); }
        else if (ev === 'next') G.cycleTarget();
        else if (ev === 'clear') G.setTarget(null);
      }
      I.events.length = 0;
      if (I.tap) { G.tapAt(I.tap.x, I.tap.y); I.tap = null; }
    },

    // ---------- laço principal ----------
    update(dt) {
      if (!G.active) return;
      const P = G.player, W = G.world, L = G.creatures, tk = G.tick;
      G.time += dt; G.stats.play += dt; W.now = G.time; W.frame++;
      const d0 = G.day;
      G.day = (G.day + dt / G.DAYLEN) % 1;
      G.night = U.sstep(0.62, 0.72, G.day) * (1 - U.sstep(0.93, 1, G.day));
      if (d0 < 0.95 && G.day >= 0.95 && !P.dead) { G.stats.nights++; FG.bus.emit('progress'); }
      if ((G.rainT -= dt) <= 0) { G.raining = !G.raining; G.rainT = G.raining ? 50 + rnd() * 70 : 160 + rnd() * 260; }
      G.rain = U.approach(G.rain, G.raining ? 1 : 0, dt * 0.2);
      if (G.cine) G.updateCine(dt);
      G.rebuildGrid();
      for (let i = 0; i < L.length; i++) {
        const c = L[i];
        if (c.gone) continue;
        if (c.dead) {
          c.deadT += dt; if (c.flash > 0) c.flash = Math.max(0, c.flash - dt * 4);
          if (c.meat <= 0 || c.deadT > 75) { c.alpha -= dt * 0.7; if (c.alpha <= 0) c.gone = true; }
          continue;
        }
        if (c.exile) { c.alpha -= dt * 0.35; if (c.alpha <= 0) { c.gone = true; continue; } }
        if (c.ai) AI.update(c, G, dt);
        c.update(dt, W);
        G.postUpdate(c, dt);
      }
      G.separate();
      G.updateProjectiles(dt);
      if (G.enc) G.updateEnc(dt);
      for (const k in G.rels) { const r = G.rels[k]; if (r.anger > 0) r.anger -= dt; }
      if (G.packTarget && (G.packTarget.dead || G.packTarget.gone)) G.packTarget = null;
      if (!P.dead) G.survive(dt);
      if (G.shake > 0) G.shake = Math.max(0, G.shake - dt * 26);
      if (G.hurtFlash > 0) G.hurtFlash = Math.max(0, G.hurtFlash - dt * 2.2);
      if ((tk.scan -= dt) <= 0) { tk.scan = 0.12; G.scanInteract(); }
      if ((tk.spawn -= dt) <= 0) { tk.spawn = 0.5; G.spawnTick(); G.discover(); }
      if ((tk.obj -= dt) <= 0) { tk.obj = 0.6; G.checkObjectives(); G.hints(); }
      if ((tk.slow -= dt) <= 0) { tk.slow = 5; W.prune(); G.checkAchievements(); }
      if ((tk.save += dt) > 45 && !G.cine && !P.dead && (!FG.Settings || FG.Settings.data.autosave)) { tk.save = 0; G.save(); }
      FX.update(dt);
      // remove quem saiu de cena
      let w = 0;
      for (let i = 0; i < L.length; i++) { const c = L[i]; if (c.gone) { if (c.ai && c.ai.pack) G.removeFromPack(c); if (G.target === c) G.target = null; continue; } L[w++] = c; }
      L.length = w;
    },
    postUpdate(c, dt) {
      const A = c.anim;
      if (A) {
        if (A.hitAt != null && !A.done && A.t >= A.dur * A.hitAt) { A.done = true; G.resolve(c, A); }
        else if (A.name === 'charge' && !A.done && c.dash > 0) G.chargeCheck(c, A);
      }
      if (c.poison > 0) {
        c.poison -= dt; c.hp -= c.poisonDps * dt;
        if (c.hp <= 0) { G.kill(c, c.poisonSrc); return; }
      }
      if (c.stepEv) {
        c.stepEv = 0;
        if (c.isPlayer) sfx('step', c.x, c.y, { biome: c.biome, wet: c.wet });
        else if (c.sp.isTitan) { sfx('stomp', c.x, c.y); const d = U.dist(c.x, c.y, G.player.x, G.player.y); if (d < 600) G.addShake(3 * (1 - d / 600)); }
        if (c.sprinting && c.wet === 0 && rnd() < 0.5) FX.add('dust', c.x, c.y);
      }
      if (c.wet && c.speed > 25 && (c.ripT = (c.ripT || 0) - dt) <= 0) { c.ripT = 0.28; FX.add('ripple', c.x, c.y, { size: c.radius * 0.9 }); if (c.wet >= 2 && c.isPlayer) sfx('swim', c.x, c.y); }
      if (c.landed) { FX.burst(c.wet ? 'splash' : 'dust', c.x, c.y, 6); if (c.isPlayer) sfx('land', c.x, c.y); }
      if (c.sleeping && (c.zT = (c.zT || 0) - dt) <= 0) { c.zT = 1.7; FX.add('zzz', c.rs[0] + 8, c.rs[1] - 10); }
      if (c.ai && c.ai.pack && c.hp < c.maxHp && G.time - c.combatT > 6) c.hp = Math.min(c.maxHp, c.hp + c.maxHp * 0.012 * dt);
    },
    separate() {
      const L = G.creatures;
      for (let i = 0; i < L.length; i++) {
        const c = L[i];
        if (c.dead || c.gone || c.jz > 10) continue;
        const N = G.near(c.x, c.y, c.radius + 70, NEAR2);
        for (let j = 0; j < N.length; j++) {
          const o = N[j];
          if (o.id <= c.id || o.dead || o.jz > 10) continue;
          const dx = o.x - c.x, dy = o.y - c.y, min = (c.radius + o.radius) * 0.9, d2 = dx * dx + dy * dy;
          if (d2 >= min * min || d2 < 0.01) continue;
          const d = Math.sqrt(d2), p = (min - d) / d, mc = c.stats.bulk * (c.baby ? 0.3 : 1), mo = o.stats.bulk * (o.baby ? 0.3 : 1), f = mo / (mc + mo);
          c.x -= dx * p * f; c.y -= dy * p * f; o.x += dx * p * (1 - f); o.y += dy * p * (1 - f);
        }
      }
    },
    updateProjectiles(dt) {
      const Pj = G.projectiles;
      for (let i = Pj.length - 1; i >= 0; i--) {
        const p = Pj[i];
        p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt;
        let dead = p.life <= 0;
        if (!dead) {
          const N = G.near(p.x, p.y, 90, NEAR2), pa = G.isSide(p.src);
          for (let j = 0; j < N.length; j++) {
            const o = N[j];
            if (!G.canHit(p.src, o) || U.dist(p.x, p.y, o.x, o.y) > o.radius + p.r) continue;
            if (pa && o !== G.target && G.rel(o.sp).status === 'ally') continue;
            G.hit(p.src, o, p.dmg, { kind: 'spit', pdps: p.pdps }); dead = true; break;
          }
        }
        if (dead) { FX.burst('splash', p.x, p.y, 5, { col: '#9be04a' }); Pj.splice(i, 1); }
      }
    },
    /** Fome, fôlego, regeneração e descanso do jogador. */
    survive(dt) {
      const P = G.player, D = DIFF[G.diff], H = G.homeNest;
      G.stats.dist += P.speed * dt;
      if (P.jz > 10) G.stats.glide += P.speed * dt;
      if (P.wet >= 2) G.stats.swim += P.speed * dt;
      G.hunger = Math.max(0, G.hunger - dt * (100 / 420) * D.hunger * (P.sprinting ? 1.5 : 1));
      if (G.hunger <= 0) { P.hp -= P.maxHp * 0.012 * dt; if (P.hp <= 0) return G.kill(P, null); }
      if (G.hunger < 18 && !G.flags.hungry) { G.flags.hungry = true; G.toast(T('t.hungry'), 'warn', 'meat'); }
      else if (G.hunger > 40) G.flags.hungry = false;
      // descanso: no próprio ninho ou em ninho aliado
      let rest = U.dist2(P.x, P.y, H.x, H.y) < 170 * 170;
      if (!rest) for (const n of G.world.nests) if (n.spawned && U.dist2(P.x, P.y, n.x, n.y) < 150 * 150 && G.rel(G.fauna.byId[n.sp]).status === 'ally') { rest = true; break; }
      G.resting = rest;
      if (P.hp < P.maxHp && G.hunger > 30 && G.time - P.combatT > 5) P.hp = Math.min(P.maxHp, P.hp + P.maxHp * (rest ? 0.07 : 0.014) * dt);
      if (P.wet >= 2 && P.jz <= 0) {
        G.breath = Math.max(0, G.breath - dt / (6 + 5 * P.stats.swim));
        if (G.breath <= 0) { P.hp -= P.maxHp * 0.07 * dt; if (!G.flags.drown) { G.flags.drown = true; G.toast(T('t.drown'), 'warn', 'drop'); } if (P.hp <= 0) return G.kill(P, null); }
      } else { G.breath = Math.min(1, G.breath + dt / 3); G.flags.drown = false; }
      // migração: chegada ao novo ninho
      if (G.arrived < G.home && U.dist2(P.x, P.y, H.x, H.y) < 220 * 220) {
        G.arrived = G.home; G.addDna(30, P.x, P.y); G.toast(T('t.arrived'), 'big', 'nest'); sfx('ally'); FG.bus.emit('progress'); G.save();
      }
      if (G.world.reveal(P.x, P.y, 620 + 60 * P.stats.sense)) FG.bus.emit('mapdirty');
    },
    discover() {
      const P = G.player;
      for (const c of G.near(P.x, P.y, 400, NEAR2)) {
        if (c.sp.isPlayer) continue;
        const rel = G.rel(c.sp);
        if (rel.seen) continue;
        rel.seen = true; G.stats.speciesSeen++;
        G.addDna(3, c.x, c.y);
        FG.bus.emit('species', c.sp);
        FG.bus.emit('progress');
      }
    },
    /** Marcadores para a bússola do HUD. */
    markers() {
      const out = [], H = G.homeNest;
      out.push({ x: H.x, y: H.y, kind: 'home' });
      const o = G.objective();
      if (o && o.id === 'fossil') { let b = null, bd = 1e18; for (const f of G.world.fossils) { if (f.taken) continue; const d = U.dist2(G.player.x, G.player.y, f.x, f.y); if (d < bd) { bd = d; b = f; } } if (b) out.push({ x: b.x, y: b.y, kind: 'fossil' }); }
      if (o && (o.id === 'meet' || o.id === 'first' || o.id === 'species')) { let b = null, bd = 1e18; for (const n of G.world.nests) { const st = G.rel(G.fauna.byId[n.sp]).status; if (st !== 'neutral' || n.pop <= 0) continue; const d = U.dist2(G.player.x, G.player.y, n.x, n.y); if (d < bd) { bd = d; b = n; } } if (b) out.push({ x: b.x, y: b.y, kind: 'nest' }); }
      return out;
    },
  };
})(window.FG = window.FG || {});
