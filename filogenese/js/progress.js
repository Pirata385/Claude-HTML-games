/* Filogênese — progressão: níveis cerebrais, objetivos, conquistas, evolução, cenas, morte e salvamento. */
(function (FG) {
  'use strict';
  const G = FG.Game, U = FG.U, Species = FG.Species, AI = FG.AI, FX = FG.FX, Creature = FG.Creature;
  const T = (k, a, b) => FG.T(k, a, b);
  const sfx = (n, x, y, o) => { if (FG.Audio) FG.Audio.sfx(n, x, y, o); };
  const LEVELS = G.LEVELS = [0, 90, 260, 540, 950];   // DNA total para chegar aos níveis 1..5
  G.SAPIENCE = 1500; G.DAYLEN = 420;
  const KEY = 'filogenese.save.v1.', ACH_KEY = 'filogenese.ach.v1';

  // ---------- níveis ----------
  G.checkLevel = function () {
    if (!G.playerSp) return;
    while (G.level < 5 && G.dnaTotal >= LEVELS[G.level]) {
      G.level++;
      G.playerSp.level = G.level; Species.refresh(G.playerSp);
      const P = G.player;
      if (P && !P.dead) { P.rebuild(); P.hp = P.maxHp; }
      const parts = [G.unlockRandom(G.level), G.unlockRandom(G.level)].filter(Boolean);
      if (G.level === 3) G.migrate(1); else if (G.level === 4) G.migrate(2);
      sfx('levelup');
      FG.bus.emit('levelup', G.level, parts);
      FG.bus.emit('progress');
    }
    if (G.level >= 5 && G.dnaTotal >= G.SAPIENCE && !G.flags.sapMsg && !G.won) { G.flags.sapMsg = true; G.toast(T('t.sapReady'), 'big', 'brain'); }
  };
  /** Progresso da barra cerebral: {level, frac, cur, need}. */
  G.levelProgress = function () {
    const l = G.level, a = LEVELS[l - 1], b = l < 5 ? LEVELS[l] : G.SAPIENCE;
    return { level: l, frac: U.clamp((G.dnaTotal - a) / (b - a), 0, 1), cur: G.dnaTotal, need: b };
  };
  G.migrate = function (i) {
    if (G.world.ownSites.length <= i || G.home >= i) return;
    G.setHome(i);
    G.toast(T('t.migrate'), 'big', 'nest');
    FG.bus.emit('mapdirty');
  };

  // ---------- objetivos ----------
  const sum = (g) => g.stats.allies + g.stats.extinct;
  const OBJ = G.OBJ = [
    { id: 'move', dna: 5, ok: (g) => g.stats.dist > 250 },
    { id: 'eat', dna: 8, ok: (g) => g.stats.eaten >= 1 },
    { id: 'meet', dna: 8, ok: (g) => g.stats.speciesSeen >= 1 },
    { id: 'first', dna: 12, ok: (g) => g.stats.friends + g.stats.kills >= 1 },
    { id: 'fossil', dna: 10, ok: (g) => g.stats.fossils >= 1 },
    { id: 'evolve', dna: 15, ok: (g) => g.gen >= 2 },
    { id: 'species', dna: 20, ok: (g) => sum(g) >= 1 },
    { id: 'level2', dna: 15, ok: (g) => g.level >= 2, prog: (g) => [g.dnaTotal, LEVELS[1]] },
    { id: 'pack', dna: 15, ok: (g) => g.stats.recruited >= 1 },
    { id: 'three', dna: 25, ok: (g) => sum(g) >= 3, prog: (g) => [sum(g), 3] },
    { id: 'level3', dna: 20, ok: (g) => g.level >= 3, prog: (g) => [g.dnaTotal, LEVELS[2]] },
    { id: 'migrate', dna: 20, ok: (g) => g.arrived >= 1 || g.world.ownSites.length < 2 },
    { id: 'six', dna: 35, ok: (g) => sum(g) >= 6, prog: (g) => [sum(g), 6] },
    { id: 'level4', dna: 25, ok: (g) => g.level >= 4, prog: (g) => [g.dnaTotal, LEVELS[3]] },
    { id: 'migrate2', dna: 25, ok: (g) => g.arrived >= 2 || g.world.ownSites.length < 3 },
    { id: 'level5', dna: 30, ok: (g) => g.level >= 5, prog: (g) => [g.dnaTotal, LEVELS[4]] },
    { id: 'sapience', dna: 0, ok: (g) => g.dnaTotal >= g.SAPIENCE, prog: (g) => [g.dnaTotal, g.SAPIENCE] },
    { id: 'awaken', dna: 0, ok: (g) => g.won },
  ];
  G.objective = function () { return OBJ[G.objIdx] || null; };
  G.checkObjectives = function () {
    const P = G.player;
    let n = 0;
    while (G.objIdx < OBJ.length && OBJ[G.objIdx].ok(G) && n++ < 3) {
      const o = OBJ[G.objIdx++];
      G.toast(T('t.objDone', T('o.' + o.id)), 'good', 'check');
      if (o.dna) G.addDna(o.dna, P.x, P.y - 40);
      sfx('objective');
      FG.bus.emit('objective');
    }
  };

  /** Dicas de contexto, uma vez cada, para quem está começando. */
  G.hints = function () {
    if (FG.Settings && !FG.Settings.data.hints) return;
    const f = G.flags, s = G.stats, P = G.player;
    if (P.dead || G.cine) return;
    const say = (k, text, icon) => { f[k] = true; G.toast(text, 'info', icon); };
    if (!f.hMeet && s.speciesSeen >= 1 && s.friends + s.kills === 0 && G.time > 4) say('hMeet', T('t.hintMeet'), 'heart');
    else if (!f.hEat && G.hunger < 50 && s.eaten === 0) say('hEat', T('t.hintEat.' + P.stats.diet), 'meat');
    else if (!f.hEvolve && G.gen === 1 && G.dna >= 25 && G.time > 30) say('hEvolve', T('t.hintEvolve'), 'dna');
    else if (!f.hNight && G.night > 0.7 && s.nights === 0) say('hNight', T('t.hintNight'), 'moon');
    else if (!f.hSneak && P.stats.diet === 'C' && s.speciesSeen >= 1 && s.kills === 0 && G.stance === 'combat') say('hSneak', T('t.hintSneak'), 'sneak');
  };

  // ---------- conquistas (globais, valem para todos os saves) ----------
  const ACH = G.ACH = [
    { id: 'friend1', ok: (g) => g.stats.friends >= 1 },
    { id: 'kill1', ok: (g) => g.stats.kills >= 1 },
    { id: 'ally5', ok: (g) => g.stats.allies >= 5 },
    { id: 'ext5', ok: (g) => g.stats.extinct >= 5 },
    { id: 'pacifist', ok: (g) => g.level >= 3 && g.stats.kills === 0 },
    { id: 'ruthless', ok: (g) => g.level >= 3 && g.stats.friends === 0 },
    { id: 'fossil10', ok: (g) => g.stats.fossils >= 10 },
    { id: 'titanSlay', ok: (g) => g.stats.titansSlain >= 1 },
    { id: 'titanFriend', ok: (g) => g.stats.titansFriend >= 1 },
    { id: 'pack3', ok: (g) => g.pack.length >= 3 },
    { id: 'night3', ok: (g) => g.stats.nights >= 3 },
    { id: 'gen8', ok: (g) => g.gen >= 8 },
    { id: 'parts40', ok: (g) => g.unlocked.size >= 40 },
    { id: 'seenAll', ok: (g) => g.stats.speciesSeen >= g.fauna.list.length },
    { id: 'swim', ok: (g) => g.stats.swim >= 1500 },
    { id: 'glide', ok: (g) => g.stats.glide >= 1500 },
    { id: 'migrant', ok: (g) => g.arrived >= 2 },
    { id: 'winH', ok: (g) => g.won && g.playerSp.diet === 'H' },
    { id: 'winC', ok: (g) => g.won && g.playerSp.diet === 'C' },
    { id: 'winO', ok: (g) => g.won && g.playerSp.diet === 'O' },
  ];
  G.achieved = new Set();
  G.loadAchievements = function () {
    try { const a = JSON.parse(localStorage.getItem(ACH_KEY) || '[]'); G.achieved = new Set(Array.isArray(a) ? a : []); } catch (e) { G.achieved = new Set(); }
  };
  G.checkAchievements = function () {
    let ch = false;
    for (const a of ACH) {
      if (G.achieved.has(a.id) || !a.ok(G)) continue;
      G.achieved.add(a.id); ch = true;
      FG.bus.emit('achievement', a.id);
      sfx('objective');
    }
    if (ch) try { localStorage.setItem(ACH_KEY, JSON.stringify([...G.achieved])); } catch (e) { /* ignora */ }
  };

  /** Estilo de jogo, para o título final. */
  G.pathTitle = function () {
    const s = G.stats.soc, p = G.stats.pred, r = s + p > 0 ? s / (s + p) : 0.5;
    return r > 0.7 ? 'diplomat' : r < 0.3 ? 'predator' : 'adaptable';
  };

  // ---------- cenas: acasalar/evoluir, eclosão, despertar, morte ----------
  G.startMate = function () {
    const P = G.player, H = G.homeNest;
    if (!H.spawned) G.spawnNest(H, G.playerSp);
    let mate = null, bd = 1e18;
    for (const c of H.members) { if (c.dead || (c.ai && c.ai.pack)) continue; const d = U.dist2(c.x, c.y, P.x, P.y); if (d < bd) { bd = d; mate = c; } }
    if (!mate) mate = G.addMember(H, G.playerSp, false);
    mate.sleeping = false; mate.ai.tx = P.x + 44; mate.ai.ty = P.y + 12; AI.set(mate, 'mate');
    G.endEnc(false); G.auto = null;
    G.cine = { type: 'mate', t: 0, step: 0, mate };
    P.mx = P.my = 0; P.play('call', 1.4); G.voice(P, 'call');
    FX.burst('heart', P.x, P.y - P.radius, 3);
  };
  G.updateCine = function (dt) {
    const c = G.cine, P = G.player;
    c.t += dt;
    if (c.type === 'mate') {
      const m = c.mate;
      if (c.step === 0 && c.t > 1.5) { c.step = 1; m.play('call', 1.2); G.voice(m, 'call'); FX.burst('heart', (P.x + m.x) / 2, (P.y + m.y) / 2 - 20, 6); }
      else if (c.step === 1 && c.t > 2.9) { c.step = 2; sfx('egg'); FX.add('ring', P.x, P.y, { size: 70, col: '#fff3c4' }); FX.burst('star', P.x, P.y - 10, 8); }
      else if (c.step === 2 && c.t > 3.5) { c.step = 3; AI.set(m, 'idle', 2); FG.bus.emit('editor', 'evolve'); }
    } else if (c.type === 'hatch') { if (c.t > 1.3) G.cine = null; }
    else if (c.type === 'awaken') {
      if (Math.random() < dt * 9) FX.add('star', P.x + (Math.random() - 0.5) * 260, P.y + (Math.random() - 0.5) * 200, { size: 7 + Math.random() * 6 });
      if (c.step === 0 && c.t > 1.4) {
        c.step = 1;
        for (const o of G.near(P.x, P.y, 600, [])) if (!o.dead && !o.isPlayer && (o.sp.isPlayer || (o.ai && o.ai.pack) || o.friend)) { o.play(Math.random() < 0.5 ? 'sing' : 'dance', 2.4); G.voice(o, 'sing'); }
        P.play('sing', 2.4); G.voice(P, 'sing');
      } else if (c.step === 1 && c.t > 4.4) {
        G.won = true; G.cine = null;
        FX.add('ring', P.x, P.y, { size: 320, col: '#fff3c4', life: 1.2 });
        G.checkAchievements(); G.save();
        FG.bus.emit('ending');
      }
    }
  };
  G.cancelEvolve = function () { G.cine = null; };
  /** Aplica o genoma saído do editor: nasce uma nova geração. */
  G.evolve = function (genome, name, dnaLeft) {
    const sp = G.playerSp, P = G.player;
    sp.genome = genome;
    if (name) sp.name = { pt: name, en: name };
    Species.refresh(sp);
    G.dna = Math.max(0, Math.round(dnaLeft)); G.gen++;
    P.rebuild(); P.hp = P.maxHp; G.hunger = Math.max(G.hunger, 60);
    G.cine = { type: 'hatch', t: 0 };
    P.play('happy', 1.2); G.voice(P, 'chirp'); sfx('hatch');
    FX.burst('shell', P.x, P.y, 12); FX.add('ring', P.x, P.y, { size: 90, col: '#fff3c4' }); FX.burst('star', P.x, P.y - 10, 6);
    G.toast(T('t.newGen', G.gen), 'big', 'dna');
    FG.bus.emit('progress'); FG.bus.emit('pack');
    G.save();
  };
  G.startAwaken = function () {
    const P = G.player;
    G.endEnc(false); G.auto = null;
    G.cine = { type: 'awaken', t: 0, step: 0 };
    P.mx = P.my = 0; P.play('pose', 1.4); sfx('awaken');
  };
  G.playerDied = function (att) {
    G.stats.deaths++; G.endEnc(false); G.auto = null; G.target = null; G.packTarget = null;
    G.cine = { type: 'death', t: 0 };
    sfx('death');
    FG.bus.emit('death', att && att.sp ? att.sp : null);
  };
  G.respawn = function () {
    const H = G.homeNest, D = G.DIFF[G.diff];
    const lost = Math.floor(G.dna * D.lose);
    G.dna -= lost;
    const old = G.player;
    old.isPlayer = false; old.meat = 0;
    const P = G.spawnPlayer(H.x + 40, H.y + 30);
    G.hunger = 75; G.breath = 1; G.flags.hungry = false;
    G.pack.forEach((m, i) => { m.x = P.x + 50 + i * 30; m.y = P.y + 50; m.settle(); });
    G.cine = { type: 'hatch', t: 0 };
    P.play('happy', 1.2); sfx('hatch');
    FX.burst('shell', P.x, P.y, 10); FX.add('ring', P.x, P.y, { size: 90, col: '#fff3c4' });
    G.toast(lost ? T('t.respawnLost', lost) : T('t.respawn'), 'info', 'nest');
    G.spawnTick(); G.save();
  };

  /** Viagem rápida até um ninho próprio ou aliado. */
  G.travelTo = function (x, y) {
    const P = G.player;
    if (!P || P.dead || G.cine) return;
    if (G.world.blocked(x, y)) { const p = G.world.randomNear(x, y, 30, 120, Math.random); x = p.x; y = p.y; }
    P.x = x; P.y = y; P.vx = P.vy = 0; P.settle();
    G.pack.forEach((m, i) => { m.x = x + 40 + i * 30; m.y = y + 44; m.vx = m.vy = 0; m.settle(); });
    G.target = null; G.auto = null; G.endEnc(false);
    G.day = (G.day + 0.04) % 1;
    G.spawnTick(); G.rebuildGrid();
    if (FG.Render) { FG.Render.cam.x = x; FG.Render.cam.y = y; FG.Render.first = 6; }
    G.toast(T('t.traveled'), 'info', 'bolt');
    G.save();
  };

  // ---------- salvar / carregar ----------
  function packBits(a) {
    let s = '';
    for (let i = 0; i < a.length; i += 8) { let b = 0; for (let k = 0; k < 8; k++) if (a[i + k]) b |= 1 << k; s += String.fromCharCode(b); }
    return btoa(s);
  }
  function unpackBits(str, a) {
    try { const s = atob(str); for (let i = 0; i < a.length; i++) a[i] = (s.charCodeAt(i >> 3) >> (i & 7)) & 1; } catch (e) { /* mapa começa sem explorar */ }
  }
  G.serialize = function () {
    const W = G.world, P = G.player;
    return {
      v: 1, seed: G.seed, diff: G.diff, name: G.playerSp.name.pt, genome: G.playerSp.genome,
      dna: G.dna, dnaTotal: G.dnaTotal, level: G.level, gen: G.gen, unlocked: [...G.unlocked], rels: G.rels,
      home: G.home, arrived: G.arrived, hunger: G.hunger, hp: P.dead ? 1 : P.hp / P.maxHp, x: P.x, y: P.y,
      day: G.day, time: G.time, stats: G.stats, objIdx: G.objIdx, won: G.won, stance: G.stance, sapMsg: !!G.flags.sapMsg,
      nests: W.nests.map((n) => [n.pop, n.eggs, n.found ? 1 : 0]), titans: W.titanSpots.map((t) => (t.alive ? 1 : 0)),
      fossils: W.fossils.filter((f) => f.taken).map((f) => f.id), explored: packBits(W.explored),
      pack: G.pack.filter((m) => !m.dead).map((m) => ({ sp: m.sp.id, hp: m.hp / m.maxHp })), saved: Date.now(),
    };
  };
  G.save = function () {
    if (!G.active || !G.player || (G.cine && G.cine.type === 'death')) return false;
    try { localStorage.setItem(KEY + G.slot, JSON.stringify(G.serialize())); FG.bus.emit('saved'); return true; } catch (e) { return false; }
  };
  G.slotInfo = function (slot) {
    try {
      const d = JSON.parse(localStorage.getItem(KEY + slot) || 'null');
      if (!d || d.v !== 1) return null;
      return { name: d.name, level: d.level, gen: d.gen, time: d.stats ? d.stats.play : d.time, saved: d.saved, genome: d.genome, seed: d.seed, won: d.won, diff: d.diff, dnaTotal: d.dnaTotal };
    } catch (e) { return null; }
  };
  G.deleteSlot = function (slot) { try { localStorage.removeItem(KEY + slot); } catch (e) { /* ignora */ } };
  G.load = function (slot) {
    let d;
    try { d = JSON.parse(localStorage.getItem(KEY + slot) || 'null'); } catch (e) { d = null; }
    if (!d || d.v !== 1 || !d.genome) return false;
    G.reset();
    G.seed = d.seed >>> 0; G.slot = slot; G.diff = G.DIFF[d.diff] ? d.diff : 'normal';
    G.build();
    const W = G.world;
    G.level = U.clamp(d.level | 0, 1, 5);
    G.playerSp = Species.makePlayer(d.name || 'Criatura', d.genome, G.level);
    G.dna = d.dna | 0; G.dnaTotal = d.dnaTotal | 0; G.gen = d.gen || 1;
    G.unlocked = new Set((d.unlocked || []).filter((id) => FG.Parts.byId[id]));
    for (const id of FG.Parts.starterUnlocks()) G.unlocked.add(id);
    G.rels = d.rels || {};
    for (const k in G.rels) { G.rels[k].anger = 0; if (!G.fauna.byId[k]) delete G.rels[k]; }
    Object.assign(G.stats, d.stats || {});
    G.objIdx = d.objIdx | 0; G.won = !!d.won; G.stance = d.stance === 'combat' ? 'combat' : 'social';
    G.day = +d.day || 0.12; G.time = +d.time || 0; G.hunger = d.hunger == null ? 80 : +d.hunger; G.flags.sapMsg = !!d.sapMsg;
    (d.nests || []).forEach((s, i) => { const n = W.nests[i]; if (n && s) { n.pop = s[0]; n.eggs = s[1]; n.found = !!s[2]; } });
    (d.titans || []).forEach((a, i) => { if (W.titanSpots[i]) W.titanSpots[i].alive = !!a; });
    for (const id of d.fossils || []) if (W.fossils[id]) W.fossils[id].taken = true;
    if (d.explored) unpackBits(d.explored, W.explored);
    G.arrived = d.arrived | 0;
    G.setHome(U.clamp(d.home | 0, 0, W.ownSites.length - 1));
    let x = +d.x, y = +d.y;
    if (!(x > 0) || !(y > 0) || W.blocked(x, y)) { x = G.homeNest.x + 40; y = G.homeNest.y + 30; }
    const P = G.spawnPlayer(x, y);
    P.hp = Math.max(1, Math.round(P.maxHp * U.clamp(+d.hp || 1, 0.05, 1)));
    for (const m of d.pack || []) {
      const sp = G.spById(m.sp);
      if (!sp || G.pack.length >= 3) continue;
      const c = new Creature(sp, x + 50 + G.pack.length * 34, y + 40);
      AI.init(c, { x, y }, { pack: true, slot: G.pack.length, st: 'follow' });
      c.canSwim = true; c.friend = true; c.hp = Math.max(1, c.maxHp * U.clamp(+m.hp || 1, 0.05, 1));
      G.pack.push(c); G.creatures.push(c);
    }
    G.active = true;
    G.spawnTick(); G.rebuildGrid();
    FG.bus.emit('gamestart');
    return true;
  };
})(window.FG = window.FG || {});
