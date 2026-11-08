// Niryk — main loop and scenes: title, the lobby camp (stations), the training ground and the run
// (levels, room waves, gift/upgrade/shop rooms, portals, bosses, results), plus world rendering.
'use strict';
(function () {
  const N = window.N, G = N.G, S = N.S, I = N.input, TS = N.TS, T = N.TILE, U = N.UI, TAU = Math.PI * 2;
  const gcv = document.getElementById('game'), ucv = document.getElementById('ui');
  const gctx = gcv.getContext('2d'), uctx = ucv.getContext('2d');
  Object.assign(G, { time: 0, camX: 0, camY: 0, props: [], toasts: [], scene: 'title', theme: 'lobby', menu: null, shakeA: 0 });

  N.R.init(gctx);
  function resize() {
    const w = innerWidth, h = innerHeight, asp = w / h;
    const z = G.viewScale || 1;
    if (asp >= 1) { G.VH = Math.round(166 * z); G.VW = Math.round(N.clamp(166 * z * asp, 220, 520)); } else { G.VW = Math.round(190 * z); G.VH = Math.round(N.clamp(190 * z / asp, 190, 520)); }
    N.R.resize(gcv);
    const dpr = Math.min(2, devicePixelRatio || 1);
    ucv.width = Math.round(w * dpr); ucv.height = Math.round(h * dpr);
    if (asp >= 1) { G.UH = 648; G.UW = Math.round(648 * G.VW / G.VH); } else { G.UW = 720; G.UH = Math.round(720 * G.VH / G.VW); }
  }
  addEventListener('resize', resize); resize();
  // Wider view for the colossal boss fight.
  const setView = (z) => { if ((G.viewScale || 1) !== z) { G.viewScale = z; resize(); } };

  // ================================================================ menus & transitions
  G.openMenu = (type, o = {}) => { G.menu = Object.assign({ type }, o); };
  G.closeMenu = () => { G.menu = null; };
  G.transition = (fn) => { if (G.fade) return; G.fade = { t: 0, fn, done: false }; };
  G.banner = null;
  const banner = (title, sub, color, life = 2.6) => { G.banner = { title, sub, color, t: 0, life }; };
  const toast = (title, sub) => G.toasts.push({ title, sub, t: 0 });

  function resetWorld() {
    G.enemies.length = 0; G.projs.length = 0; G.allies.length = 0; G.areas.length = 0; G.pickups.length = 0;
    G.fx.length = 0; G.parts.length = 0; G.texts.length = 0; G.props = [];
    G.combat = null; G.boss = null; G.portal = null; G.near = null; G.curRoom = null; G.lastRoom = null; G.flow = null; G.pendingSpawns = 0;
    setView(1);
  }
  const prop = (o) => { const pr = Object.assign({ r: 18, h: 16 }, o); G.props.push(pr); return pr; };
  const removeProp = (pr) => { G.props = G.props.filter((x) => x !== pr); if (G.near === pr) G.near = null; };
  const blockTiles = (tx, ty, w, h) => { G.map.hidden = G.map.hidden || new Set(); for (let y = ty; y < ty + h; y++) for (let x = tx; x < tx + w; x++) { const i = y * G.map.W + x; if (G.map.tiles[i] === T.FLOOR) { G.map.tiles[i] = T.BLOCK; G.map.hidden.add(i); } } };
  const sprProp = (spr) => N.R.sprProp(spr);
  const drawPortal = (ctx, pr) => N.R.drawPortal(ctx, pr), drawCampfire = (ctx, pr) => N.R.drawCampfire(ctx, pr), drawRack = (ctx, pr) => N.R.drawRack(ctx, pr);
  const heroNpcDraw = (id, i) => (ctx, pr) => { const spr = S.ch[id][Math.sin(G.time * 2 + i) > 0.5 ? 4 : 0]; N.drawShadow(ctx, pr.x, pr.y + 2, 7); ctx.save(); ctx.translate(N.snap(pr.x), N.snap(pr.y)); if (G.p && G.p.x < pr.x) ctx.scale(-1, 1); ctx.drawImage(spr, -8, -18.5); ctx.restore(); };

  // ================================================================ title
  G.goTitle = () => { G.scene = 'title'; G.run = null; G.p = null; resetWorld(); N.music.play('lobby'); };

  // ================================================================ lobby
  G.goLobby = () => G.transition(() => setupLobby());
  function setupLobby(keep) {
    const old = G.p;
    G.scene = 'lobby'; G.run = null; G.theme = 'lobby'; G.noCd = false; G.godMode = false;
    resetWorld();
    G.map = N.genSingleRoom(30, 18);
    const r = G.map.rooms[0], X = (tx) => (r.x0 + tx) * TS, Y = (ty) => (r.y0 + ty) * TS;
    G.p = N.makePlayer(N.save.char, keep && old ? old.x : X(15), keep && old ? old.y : Y(12.5), null);
    N.save.codex.w[N.CHARS[N.save.char].weapon] = 1;
    // stations (2.5D props; the tiles under them are solid)
    blockTiles(r.x0 + 1, r.y0, 3, 1);
    prop({ x: X(2.5), y: Y(1), h: 30, spr: S.misc.bookshelf, title: 'Códice', draw: sprProp(S.misc.bookshelf), label: () => 'Ler o Códice', use: () => G.openMenu('codex') });
    prop({ x: X(6.5), y: Y(1.2), h: 28, spr: S.misc.trophy, title: 'Conquistas', draw: sprProp(S.misc.trophy), label: () => 'Salão das Conquistas', use: () => G.openMenu('achievements') });
    blockTiles(r.x0 + 6, r.y0, 1, 1);
    prop({ x: X(11), y: Y(0.3), iy: Y(1), h: 34, title: 'Treinamento', draw: sprProp(S.misc.gate), label: () => 'Ir ao campo de treino', use: () => G.transition(setupTraining) });
    prop({ x: X(15), y: Y(2.8), h: 34, r: 22, title: 'Portal', titleColor: '#ffd166', draw: drawPortal, light: ['#ffd166', 70, -14, 0.8], label: () => 'Iniciar aventura', use: () => G.openMenu('runStart') });
    blockTiles(r.x0 + 14, r.y0 + 1, 2, 1);
    prop({ x: X(20.5), y: Y(2), h: 24, spr: S.misc.grimoire, title: 'Grimório', draw: sprProp(S.misc.grimoire), light: ['#ff9a40', 30, -20, 0.7], label: () => 'Escolher habilidades', use: () => G.openMenu('loadout') });
    blockTiles(r.x0 + 20, r.y0 + 1, 1, 1);
    prop({ x: X(25), y: Y(2), h: 24, r: 22, spr: S.misc.starAltar, title: 'Altar dos Ancestrais', draw: sprProp(S.misc.starAltar), light: ['#5fe3d6', 40, -16, 0.7], label: () => 'Melhorias permanentes', use: () => G.openMenu('upgrades') });
    blockTiles(r.x0 + 24, r.y0 + 1, 2, 1);
    // campfire, tents, banners, lanterns and tables
    prop({ x: X(15), y: Y(8.6), draw: drawCampfire, light: ['#ff9a40', 120, -6, 1] });
    blockTiles(r.x0 + 14, r.y0 + 8, 2, 1);
    prop({ x: X(5), y: Y(9), spr: S.misc.tent, draw: sprProp(S.misc.tent) }); blockTiles(r.x0 + 3, r.y0 + 7, 4, 2);
    prop({ x: X(25), y: Y(9), spr: S.misc.tent, draw: sprProp(S.misc.tent) }); blockTiles(r.x0 + 23, r.y0 + 7, 4, 2);
    N.CHAR_ORDER.forEach((id, i) => prop({ x: X(1.5 + i * 9), y: Y(16.8), spr: S.misc.banner(N.CHARS[id].color), draw: sprProp(S.misc.banner(N.CHARS[id].color)) }));
    for (const [tx, ty] of [[9, 6], [21, 6], [9, 15], [21, 15]]) { prop({ x: X(tx + 0.5), y: Y(ty + 1), spr: S.misc.paperLantern, draw: sprProp(S.misc.paperLantern), light: ['#ffb060', 70, -21, 0.95] }); blockTiles(r.x0 + tx, r.y0 + ty, 1, 1); }
    for (const [tx, ty] of [[1, 12], [27, 12]]) { prop({ x: X(tx + 1), y: Y(ty + 1), spr: S.deco.table, draw: sprProp(S.deco.table), light: ['#ffb060', 30, -12, 0.6] }); blockTiles(r.x0 + tx, r.y0 + ty, 2, 1); }
    // the other heroes stand around the fire
    N.CHAR_ORDER.forEach((id, i) => {
      if (id === N.save.char) return;
      const pos = [[10.5, 11], [19.5, 11], [12, 14], [18, 14]][i];
      prop({ x: X(pos[0]), y: Y(pos[1]), h: 24, hero: id, title: N.CHARS[id].name, titleColor: N.CHARS[id].color, label: () => 'Falar com ' + N.CHARS[id].name, use: () => G.openMenu('hero', { id }), draw: heroNpcDraw(id, i) });
    });
    prop({ x: X(15), y: Y(15.6), h: 20, hero: N.save.char, title: 'Você: ' + N.CHARS[N.save.char].name, titleColor: '#8a8090', label: () => 'Ver herói atual', use: () => G.openMenu('hero', { id: N.save.char }), draw: () => {} });
    N.R.dress(G.map, 'lobby', { corner: null, patches: false });
    G.map.patches.push({ x: X(15), y: Y(12.5), v: 0 });
    N.music.play('lobby');
    if (!keep) {
      banner('Acampamento Estelar', 'Fale com os heróis, escolha habilidades e entre no portal', '#ffd166');
      if (!N.save.seenIntro) { N.save.seenIntro = true; N.writeSave(); }
    }
    snapCamera();
  }
  G.switchHero = (id) => { N.save.char = id; N.writeSave(); if (G.scene === 'lobby') setupLobby(true); else if (G.scene === 'training') setupTraining(true); };
  G.refreshLoadout = () => {
    if (!G.p || G.scene === 'run') return;
    const old = G.p, w = old.weapons.slice(), wi = old.wi;
    G.p = N.makePlayer(N.save.char, old.x, old.y, null);
    if (G.scene === 'training' && old.char === N.save.char) { G.p.weapons = w; G.p.wi = wi; }
  };

  // ================================================================ training ground
  function setupTraining(keep) {
    G.scene = 'training'; G.run = null; G.theme = 'training';
    resetWorld();
    G.map = N.genSingleRoom(24, 14);
    const r = G.map.rooms[0], X = (tx) => (r.x0 + tx) * TS, Y = (ty) => (r.y0 + ty) * TS;
    G.p = N.makePlayer(N.save.char, X(4), Y(7), null);
    prop({ x: X(2), y: Y(0.3), iy: Y(1), h: 34, title: 'Acampamento', draw: sprProp(S.misc.gate), label: () => 'Voltar ao acampamento', use: () => G.transition(() => setupLobby()) });
    prop({ x: X(7), y: Y(1.8), h: 20, spr: S.misc.altar, title: 'Terminal', draw: sprProp(S.misc.altar), light: ['#c66bff', 34, -10, 0.7], label: () => 'Invocar monstros', use: () => G.openMenu('training') });
    blockTiles(r.x0 + 6, r.y0 + 1, 2, 1);
    prop({ x: X(11), y: Y(1.8), h: 22, title: 'Arsenal', draw: drawRack, label: () => 'Trocar de arma', use: () => G.openMenu('rack') });
    blockTiles(r.x0 + 10, r.y0 + 1, 2, 1);
    prop({ x: X(15.5), y: Y(1.9), h: 24, spr: S.misc.grimoire, title: 'Grimório', draw: sprProp(S.misc.grimoire), light: ['#ff9a40', 30, -20, 0.7], label: () => 'Escolher habilidades', use: () => G.openMenu('loadout') });
    blockTiles(r.x0 + 15, r.y0 + 1, 1, 1);
    N.R.dress(G.map, 'training', { patches: false });
    for (const [tx, ty] of [[16, 6], [19, 9], [16, 11]]) {
      G.enemies.push({ kind: 'enemy', id: 'dummy', dummy: true, def: { ai: 'dummy', r: 7, world: 0 }, x: X(tx), y: Y(ty), r: 7, hp: 1e9, maxHp: 1e9, vx: 0, vy: 0, kx: 0, ky: 0, face: -1, t: 0, st: {}, flash: 0, alive: true, anim: 0, dps: 0 });
    }
    N.music.play('lobby');
    if (!keep) banner('Campo de Treino', 'Teste armas, habilidades e passivas sem riscos', '#ffd166');
    snapCamera();
  }
  G.trainingSpawn = (id) => {
    const r = G.map.rooms[0], q = N.randomPoint(r, 60, G.p.x, G.p.y);
    N.spawnEnemy(id, q.x, q.y, { noDrop: true }); N.spark(q.x, q.y, '#ffffff', 10, 50); N.sfx('spawn');
  };
  G.trainingClear = () => { G.enemies = G.enemies.filter((e) => e.dummy); G.projs.length = 0; };

  // ================================================================ run
  G.startRun = () => G.transition(() => {
    G.scene = 'run';
    G.run = { world: 0, level: 0, kills: 0, crystals: 0, rooms: 0, char: N.save.char, t0: G.time, time: 0 };
    N.save.stats.runs++; N.writeSave();
    G.p = N.makePlayer(N.save.char, 0, 0, G.run);
    G.p.gold = 15 * (N.save.upg.fortuna || 0);
    if (N.save.upg.segunda) G.p.potions = 1;
    G.runHpLost = 0; G.noCd = false; G.godMode = false;
    loadLevel();
  });
  const L = () => G.run.world * 3 + G.run.level; // depth 0..8

  function loadLevel() {
    const r = G.run, w = N.WORLDS[r.world];
    resetWorld();
    G.theme = w.id; G.bulletColor = w.bullet;
    const seed = (Math.random() * 2 ** 31) >>> 0;
    G.map = N.genLevel(seed, { boss: r.level === 2 });
    G.map.locked = null;
    const st = G.map.start; st.visited = true; markSeen(st);
    G.p.x = (st.cx + 0.5) * TS; G.p.y = (st.cy + 0.5) * TS; G.p.vx = G.p.vy = 0; G.p.control = null; G.p.air = 0;
    if (G.p.form) { G.p.form = null; G.p.r = 5; }
    for (const id of G.p.weapons) if (id) N.save.codex.w[id] = 1;
    for (const room of G.map.rooms) setupRoom(room);
    N.R.dress(G.map, w.id);
    banner(`${w.name}  ${r.world + 1}-${r.level + 1}`, r.level === 2 ? 'Um chefe aguarda no fim deste nível...' : w.sub, r.level === 2 ? '#ff8a9a' : '#ffd166');
    N.music.play(w.music);
    N.writeSave();
    snapCamera();
  }
  function markSeen(room) { room.seen = true; for (const l of room.links) G.map.rooms[l].seen = true; }
  const rc = (room) => ({ x: (room.cx + 0.5) * TS, y: (room.cy + 0.5) * TS });

  // ---------------------------------------------------------------- loot tables
  const RW = [[60, 30, 9, 1], [35, 40, 20, 5], [20, 35, 32, 13]];
  function pickRarity(bias = 0) { const w = RW[G.run ? G.run.world : 0].slice(); if (bias) { w[0] *= 0.5; w[3] *= 1 + bias; w[2] *= 1 + bias; } return N.weighted([0, 1, 2, 3], (i) => w[i]); }
  function pickEquip(bias) {
    const owned = new Set(G.p.equip), onFloor = new Set(G.props.filter((p) => p.equipId).map((p) => p.equipId));
    let rar = pickRarity(bias);
    for (let k = 0; k < 4; k++) {
      const pool = Object.keys(N.EQUIPS).filter((id) => N.EQUIPS[id].rarity === rar && !owned.has(id) && !onFloor.has(id));
      if (pool.length) return N.pick(pool);
      rar = (rar + 1) % 4;
    }
    return N.pick(Object.keys(N.EQUIPS));
  }
  function pickWeapon(bias) {
    const held = new Set(G.p.weapons), onFloor = new Set(G.props.filter((p) => p.weaponId).map((p) => p.weaponId));
    let rar = pickRarity(bias);
    for (let k = 0; k < 4; k++) {
      const pool = Object.keys(N.WEAPONS).filter((id) => N.WEAPONS[id].rarity === rar && !held.has(id) && !onFloor.has(id));
      if (pool.length) return N.pick(pool);
      rar = (rar + 1) % 4;
    }
    return N.pick(Object.keys(N.WEAPONS));
  }
  const priceOf = (base) => Math.max(1, Math.round(base * (1 + 0.25 * G.run.world) * (1 - G.p.stats.discount)));

  // ---------------------------------------------------------------- floor items
  function weaponItem(id, x, y, price) {
    const w = N.WEAPONS[id];
    const pr = prop({ x, y, h: 12, weaponId: id, price, kind: 'item', t0: G.time,
      label: () => (price ? `Comprar ${w.name} — ${pr.cost()} ouro` : `Pegar ${w.name}`),
      info: () => ({ name: w.name, color: N.RARITY[w.rarity].color, tag: N.RARITY[w.rarity].name, desc: w.desc, extra: `Dano ${w.dmg}${w.count > 1 ? '×' + w.count : ''} · ${w.rate} ataques/s` }),
      cost: () => price || 0,
      use: () => {
        const p = G.p;
        if (price) { if (p.gold < pr.cost()) { N.sfx('deny'); N.text(p.x, p.y - 20, 'Ouro insuficiente', '#ff9aa8'); return; } p.gold -= pr.cost(); N.sfx('buy'); }
        else N.sfx('pickup');
        removeProp(pr);
        if (!p.weapons[1]) { p.weapons[1] = id; p.wi = 1; }
        else { const old = p.weapons[p.wi]; p.weapons[p.wi] = id; weaponItem(old, p.x, p.y + 6, 0); }
        N.save.codex.w[id] = 1; N.text(p.x, p.y - 24, w.name, N.RARITY[w.rarity].color); N.checkAch();
      },
      draw: (ctx, q) => { const spr = S.wp[id], by = Math.sin((G.time - q.t0) * 3) * 1.5; N.drawShadow(ctx, q.x, q.y + 2, 7); if (price) ctx.drawImage(S.misc.pedestal, Math.round(q.x - 8), Math.round(q.y - 6)); const yy = q.y - (price ? 12 : 6) + by; ctx.globalAlpha = 0.5; ctx.drawImage(N.silhouette(spr, N.RARITY[w.rarity].color), Math.round(q.x - spr.width / 2) - 1, Math.round(yy - spr.height / 2)); ctx.drawImage(N.silhouette(spr, N.RARITY[w.rarity].color), Math.round(q.x - spr.width / 2) + 1, Math.round(yy - spr.height / 2)); ctx.globalAlpha = 1; ctx.drawImage(spr, Math.round(q.x - spr.width / 2), Math.round(yy - spr.height / 2)); },
    });
    if (price) { pr.title = `${pr.cost()} ●`; pr.titleColor = '#ffd166'; }
    return pr;
  }
  function equipItem(id, x, y, price) {
    const q0 = N.EQUIPS[id];
    const pr = prop({ x, y, h: 14, equipId: id, price, kind: 'item', t0: G.time,
      label: () => (price ? `Comprar ${q0.name} — ${pr.cost()} ouro` : `Pegar ${q0.name}`),
      info: () => ({ name: q0.name, color: N.RARITY[q0.rarity].color, tag: 'Equipamento · ' + N.RARITY[q0.rarity].name, desc: q0.desc }),
      cost: () => price || 0,
      use: () => {
        const p = G.p;
        if (price) { if (p.gold < pr.cost()) { N.sfx('deny'); N.text(p.x, p.y - 20, 'Ouro insuficiente', '#ff9aa8'); return; } p.gold -= pr.cost(); N.sfx('buy'); }
        else N.sfx('pickup');
        removeProp(pr); p.equip.push(id); N.calcStats(p); N.save.codex.q[id] = 1;
        N.text(p.x, p.y - 24, q0.name, N.RARITY[q0.rarity].color); N.spark(p.x, p.y - 8, N.RARITY[q0.rarity].color, 12, 60); N.checkAch();
      },
      draw: (ctx, q) => { const spr = S.eq[id], by = Math.sin((G.time - q.t0) * 3) * 1.5; N.drawShadow(ctx, q.x, q.y + 2, 6); if (price) ctx.drawImage(S.misc.pedestal, Math.round(q.x - 8), Math.round(q.y - 6)); const yy = Math.round(q.y - (price ? 18 : 12) + by); const g = N.silhouette(spr, N.RARITY[q0.rarity].color); ctx.globalAlpha = 0.55 + Math.sin(G.time * 4) * 0.2; for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) ctx.drawImage(g, Math.round(q.x - spr.width / 2) + dx, yy + dy); ctx.globalAlpha = 1; ctx.drawImage(spr, Math.round(q.x - spr.width / 2), yy); },
    });
    if (price) { pr.title = `${pr.cost()} ●`; pr.titleColor = '#ffd166'; }
    return pr;
  }
  function potionItem(x, y, price) {
    const pr = prop({ x, y, h: 14, price, kind: 'item',
      label: () => `Comprar Poção de Vida — ${price} ouro`,
      info: () => ({ name: 'Poção de Vida', color: '#ff7a8a', desc: 'Recupera 3 de Vida. Com a Vida cheia, fica guardada e é bebida sozinha quando a Vida chega a 1.' }),
      use: () => { const p = G.p; if (p.gold < price) { N.sfx('deny'); N.text(p.x, p.y - 20, 'Ouro insuficiente', '#ff9aa8'); return; } p.gold -= price; N.sfx('buy'); removeProp(pr); if (p.hp >= p.maxHp) { p.potions++; N.text(p.x, p.y - 22, 'Poção guardada', '#ff9ad0'); } else N.healPlayer(3); },
      draw: (ctx, q) => { ctx.drawImage(S.misc.pedestal, Math.round(q.x - 8), Math.round(q.y - 6)); ctx.drawImage(S.misc.potion, Math.round(q.x - 5), Math.round(q.y - 19 + Math.sin(G.time * 3) * 1.5)); },
    });
    pr.title = `${price} ●`; pr.titleColor = '#ffd166';
  }
  function blessingOrb(b, x, y, group) {
    const pr = prop({ x, y, h: 16, kind: 'item', group,
      label: () => 'Aceitar ' + b.name,
      info: () => ({ name: b.name, color: b.color, tag: 'Bênção', desc: b.desc }),
      use: () => {
        const p = G.p; p.blessings.push(b); N.calcStats(p); if (b.heal) N.healPlayer(b.heal);
        N.sfx('levelup'); N.text(p.x, p.y - 24, b.name, b.color); N.spark(x, y - 8, b.color, 24, 90, 0.6, 2);
        for (const o of G.props.filter((q) => q.group === group)) { removeProp(o); if (o !== pr) N.spark(o.x, o.y - 8, '#ffffff', 8, 40); }
      },
      draw: (ctx, q) => { const yy = q.y - 10 + Math.sin(G.time * 3 + x) * 2; N.drawShadow(ctx, q.x, q.y + 2, 5); ctx.fillStyle = b.color; ctx.globalAlpha = 0.3; ctx.beginPath(); ctx.arc(q.x, yy, 9 + Math.sin(G.time * 5) * 1.5, 0, TAU); ctx.fill(); ctx.globalAlpha = 1; ctx.fillStyle = '#170f1f'; ctx.beginPath(); ctx.arc(q.x, yy, 6, 0, TAU); ctx.fill(); ctx.fillStyle = b.color; ctx.beginPath(); ctx.arc(q.x, yy, 5, 0, TAU); ctx.fill(); ctx.fillStyle = '#ffffff'; ctx.fillRect(Math.round(q.x - 2), Math.round(yy - 3), 2, 2); if (Math.random() < 0.15) N.part(q.x + N.rand(-5, 5), yy, 0, -20, b.color, 0.5, 1); },
    });
  }
  function smallChest(x, y) {
    const pr = prop({ x, y, h: 12, opened: false,
      label: () => (pr.opened ? null : 'Abrir baú'),
      use: () => {
        if (pr.opened) return; pr.opened = true; N.sfx('pickup'); N.spark(x, y - 6, '#ffd040', 12, 60);
        for (let i = 0; i < N.randi(5, 10); i++) N.dropPickup('coin', x, y - 4);
        if (Math.random() < 0.4) N.dropPickup('potion', x, y - 4);
        if (Math.random() < 0.3) { N.dropPickup('crystal', x, y - 4); N.dropPickup('crystal', x, y - 4); }
        if (Math.random() < 0.14) weaponItem(pickWeapon(), x, y + 14, 0);
      },
      draw: (ctx, q) => sprProp(S.misc.chest[q.opened ? 1 : 0])(ctx, q),
    });
  }
  function giftChest(x, y, bias = 0, extra) {
    const pr = prop({ x, y, h: 16, r: 20, opened: false,
      label: () => (pr.opened ? null : 'Abrir o Presente'),
      use: () => {
        if (pr.opened) return; pr.opened = true; N.sfx('portal'); N.shake(2); N.spark(x, y - 8, '#c66bff', 20, 80, 0.6, 2); N.spark(x, y - 8, '#ffd040', 14, 70);
        equipItem(pickEquip(bias), x - 14, y + 18, 0);
        if (extra === 'weapon' || Math.random() < 0.35) weaponItem(pickWeapon(bias), x + 14, y + 18, 0);
        for (let i = 0; i < 8; i++) N.dropPickup('coin', x, y - 6);
        if (extra) for (let i = 0; i < 3; i++) N.dropPickup('crystal', x, y - 6);
      },
      draw: (ctx, q) => sprProp(S.misc.gift[q.opened ? 1 : 0])(ctx, q),
    });
  }
  function setupRoom(room) {
    const c = rc(room);
    if (room.type === 'chest') giftChest(c.x, c.y);
    else if (room.type === 'upgrade') {
      prop({ x: c.x, y: c.y - 6, draw: sprProp(S.misc.altar) });
      G.map.tiles[room.cy * G.map.W + room.cx] = T.BLOCK; G.map.hidden = G.map.hidden || new Set(); G.map.hidden.add(room.cy * G.map.W + room.cx);
      const picks = N.shuffle(N.BLESSINGS.slice()).slice(0, 3), g = 'bless' + room.id;
      picks.forEach((b, i) => blessingOrb(b, c.x + (i - 1) * 40, c.y + 30 - (i === 1 ? 0 : 8), g));
    } else if (room.type === 'shop') {
      prop({ x: c.x, y: (room.y0 + 2.4) * TS, h: 24, title: 'Glub, o Mercador', titleColor: '#7cdc6a', label: () => 'Conversar', use: () => { N.sfx('ui'); N.text(c.x, (room.y0 + 1) * TS, N.pick(['Glub glub! Tudo nos trinques!', 'Ouro de Niryk, só aceito ouro!', 'Volte sempre, viajante.', 'Essa aí era do meu avô.']), '#7cdc6a'); },
        draw: (ctx, q) => sprProp(S.misc.merchant[Math.floor(G.time * 2) % 2])(ctx, q) });
      G.map.hidden = G.map.hidden || new Set(); const mi = (room.y0 + 1) * G.map.W + room.cx; G.map.tiles[mi] = T.BLOCK; G.map.hidden.add(mi);
      const y = c.y + 14;
      const wid = pickWeapon(0.3); weaponItem(wid, c.x - 54, y, priceOf(45 + N.WEAPONS[wid].rarity * 22));
      const e1 = pickEquip(0.2); equipItem(e1, c.x - 18, y, priceOf(40 + N.EQUIPS[e1].rarity * 22));
      const e2 = pickEquip(0.2); equipItem(e2, c.x + 18, y, priceOf(40 + N.EQUIPS[e2].rarity * 22));
      potionItem(c.x + 54, y, priceOf(18));
    }
  }
  // ---------------------------------------------------------------- room flow
  function roomLogic(dt) {
    const p = G.p, room = G.curRoom;
    if (room) {
      if (!room.visited) { room.visited = true; markSeen(room); }
      G.lastRoom = room;
      if (!room.cleared && !G.combat && (room.type === 'enemy' || room.type === 'boss')) {
        const tx = p.x / TS, ty = p.y / TS;
        if (tx > room.x0 + 0.9 && tx < room.x0 + room.w - 0.9 && ty > room.y0 + 0.9 && ty < room.y0 + room.h - 0.9) startCombat(room);
      }
    }
    if (G.combat && !G.combat.boss) {
      const c = G.combat, alive = G.enemies.some((e) => e.alive) || G.pendingSpawns > 0;
      if (!alive) {
        c.t -= dt;
        if (c.t <= 0) { if (c.wave < c.waves) { spawnWave(c); c.wave++; c.t = 0.7; } else clearRoom(c.room); }
      }
    }
    if (G.roomClear > 0) G.roomClear -= dt;
  }
  function startCombat(room) {
    G.map.locked = new Set(room.doors); N.sfx('door'); N.shake(2);
    // push allies/hero out of door tiles
    if (room.type === 'boss') return startBoss(room);
    const big = room.w * room.h >= 280;
    G.combat = { room, wave: 0, waves: big || (L() >= 5 && Math.random() < 0.5) ? 3 : 2, t: 0.35 };
  }
  function spawnWave(c) {
    const room = c.room, depth = L(), w = N.WORLDS[G.run.world];
    const n = N.clamp(3 + Math.floor(depth * 0.55) + N.randi(0, 2) - (c.wave === 0 ? 0 : 1), 3, 10);
    const counts = {};
    for (let i = 0; i < n; i++) {
      const id = N.weighted(w.enemies, (k) => { const ai = N.ENEMIES[k].ai; const base = ai === 'turret' ? 0.45 : ai === 'tank' || ai === 'slammer' ? 0.6 : 1; return (counts[k] || 0) >= (ai === 'turret' || ai === 'slammer' ? 1 : 3) ? 0.02 : base; });
      counts[id] = (counts[id] || 0) + 1;
      const q = N.randomPoint(room, 62, G.p.x, G.p.y);
      const elite = depth >= 2 && Math.random() < 0.05 + depth * 0.015;
      G.pendingSpawns++;
      N.delayed(0.75 + i * 0.05, () => { G.pendingSpawns--; if (G.combat && G.combat.room === room) { N.spawnEnemy(id, q.x, q.y, { hpMul: 1 + depth * 0.2, elite }); N.spark(q.x, q.y, '#ffffff', 8, 50); } },
        (ctx, k) => { ctx.strokeStyle = elite ? '#ffcf40' : '#ff4a5e'; ctx.globalAlpha = 0.4 + 0.6 * k; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(q.x, q.y + 2, 10 * (1 - k) + 3, (10 * (1 - k) + 3) * 0.6, 0, 0, TAU); ctx.stroke(); ctx.globalAlpha = 1; if (Math.random() < 0.3) N.part(q.x + N.rand(-4, 4), q.y, 0, -30, '#ffffff', 0.3, 1); });
    }
    N.sfx('spawn');
  }
  function clearRoom(room) {
    room.cleared = true; G.map.locked = null; G.combat = null; G.roomClear = 2;
    N.sfx('door'); G.run.rooms++;
    const c = rc(room), p = G.p;
    N.text(p.x, p.y - 26, 'Sala limpa!', '#7cf07a');
    N.dropPickup('crystal', c.x, c.y);
    if (p.stats.roomHeal && Math.random() < p.stats.roomHeal) N.healPlayer(1);
    if (room === G.map.exit && !G.map.boss) spawnPortal(room);
    else if (Math.random() < 0.28) smallChest(c.x, c.y);
    N.writeSave(); N.checkAch();
  }
  function spawnPortal(room, offY = 0) {
    const c = rc(room);
    G.portal = prop({ x: c.x, y: c.y + offY, h: 30, r: 22, room, title: 'Portal', titleColor: '#7cf07a', draw: drawPortal, label: () => 'Entrar no portal', use: () => { N.sfx('portal'); G.transition(nextLevel); } });
    N.sfx('portal'); N.spark(c.x, c.y, '#7cf07a', 30, 100, 0.8, 2);
  }
  function nextLevel() {
    const r = G.run; r.level++;
    if (r.level >= 3) { r.level = 0; r.world++; }
    if (r.world >= 3) { r.world = 2; r.level = 2; G.endRun(true); return; }
    N.save.stats.best = Math.max(N.save.stats.best, r.world * 3 + r.level);
    loadLevel();
  }
  function startBoss(room) {
    const w = N.WORLDS[G.run.world];
    G.combat = { room, boss: true };
    G.boss = N.spawnBoss(w.boss, room);
    if (w.boss === 'kharun') setView(1.3);
    G.bossHp0 = G.runHpLost;
    banner(G.boss.def.name, G.boss.def.title, '#ff8a9a', 3);
    N.sfx('boss'); N.music.play('boss'); N.shake(5);
  }
  G.onBossKilled = (e) => {
    e.alive = false; const r = G.run, p = G.p, room = G.combat ? G.combat.room : e.room;
    G.slowmo = 1.2; N.shake(10); N.sfx('explode'); N.sfx('win');
    for (let i = 0; i < 6; i++) N.delayed(i * 0.15, () => N.explosion(e.x + N.rand(-20, 20), e.y + N.rand(-20, 20), 26, i % 2 ? '#ffd040' : '#ff6a2a'));
    G.projs = G.projs.filter((b) => b.team === 'p');
    for (const m of G.enemies) if (m !== e && m.alive) { m.alive = false; N.spark(m.x, m.y, '#ffffff', 8, 50); }
    N.save.stats.bossKills[e.id] = (N.save.stats.bossKills[e.id] || 0) + 1;
    if (G.runHpLost <= G.bossHp0 + 0.001) G.flawless = true;
    const cr = [15, 25, 40][r.world];
    for (let i = 0; i < 12; i++) N.dropPickup('coin', e.x, e.y);
    for (let i = 0; i < Math.round(cr / 3); i++) N.dropPickup('crystal', e.x, e.y, { v: 3 });
    room.cleared = true; G.map.locked = null; G.combat = null; G.boss = null;
    banner(e.def.name + ' foi derrotado!', r.world < 2 ? 'Um portal se abre para o próximo mundo' : 'O caminho para o Núcleo Estelar está livre', '#7cf07a', 3);
    N.delayed(1.4, () => { giftChest(rc(room).x - 40, rc(room).y + 20, 0.6, 'weapon'); spawnPortal(room, 20); N.music.play(N.WORLDS[r.world].music); setView(1); });
    N.writeSave(); N.checkAch(); G.flawless = false;
  };
  G.onPlayerDeath = () => { if (G.scene !== 'run') { const p = G.p; p.alive = true; p.hp = p.maxHp; return; } G.dying = true; G.dyingT = 0; G.slowmo = 1.5; N.sfx('lose'); N.shake(8); N.spark(G.p.x, G.p.y - 6, '#ff4a5e', 30, 100, 0.8, 2); };
  G.endRun = (win, quit) => {
    const r = G.run; if (!r || r.ended) return;
    r.ended = true; r.time = G.time - r.t0;
    const u = N.save.upg, mult = 1 + 0.1 * (u.colheita || 0);
    const bonus = (r.world * 3 + r.level) * 3 + (win ? 100 : 0);
    const crystals = Math.round((r.crystals + bonus) * mult);
    N.save.crystals += crystals; N.save.stats.crystalsTotal += crystals;
    if (win) { N.save.stats.wins++; N.save.stats.winsBy[r.char] = (N.save.stats.winsBy[r.char] || 0) + 1; N.sfx('win'); N.music.play('victory'); }
    else if (!quit) N.save.stats.deaths++;
    N.save.stats.best = Math.max(N.save.stats.best, r.world * 3 + r.level);
    N.writeSave(); N.checkAch();
    G.openMenu('result', { win, quit, res: { char: r.char, world: r.world, level: r.level, kills: r.kills, rooms: r.rooms, equips: G.p.equip.length, time: r.time, crystals, bonus: Math.round(bonus * mult) } });
  };

  // ================================================================ achievements
  N.checkAch = () => {
    const s = N.save, st = s.stats;
    const unlock = (id) => {
      if (s.ach[id]) return; const a = N.ACHIEVEMENTS.find((x) => x.id === id); if (!a) return;
      s.ach[id] = true; s.crystals += a.reward; toast('Conquista: ' + a.name, `+${a.reward} cristais — ${a.desc}`); N.sfx('levelup'); N.writeSave();
    };
    if (st.kills >= 1) unlock('first'); if (st.kills >= 250) unlock('hunter'); if (st.kills >= 1000) unlock('slayer');
    for (const id in N.BOSSES) if (st.bossKills[id]) unlock('boss_' + id);
    if (st.wins) unlock('win');
    for (const c of N.CHAR_ORDER) if (st.winsBy[c]) unlock('win_' + c);
    if (G.run && G.p && G.p.equip.length >= 8) unlock('collector');
    if (Object.keys(N.WEAPONS).every((k) => s.codex.w[k])) unlock('arsenal');
    if (Object.keys(N.ENEMIES).every((k) => s.codex.m[k])) unlock('scholar');
    if (G.flawless) unlock('flawless');
    if (G.run && G.p && G.p.gold >= 300) unlock('tycoon');
    if (Object.values(s.upg).reduce((a, b) => a + b, 0) >= 20) unlock('ascend');
    if (st.dragonKills >= 30) unlock('dragon');
  };

  // ================================================================ update
  let achT = 0;
  const backLink = document.getElementById('back');
  function update(dt) {
    G.state = G.menu ? 'menu' : G.scene === 'title' ? 'title' : G.dying ? 'dead' : 'play';
    if (backLink) backLink.style.display = G.scene === 'title' ? '' : 'none';
    if (G.fade) { G.fade.t += dt; if (!G.fade.done && G.fade.t >= 0.32) { G.fade.done = true; G.closeMenu(); G.fade.fn(); } if (G.fade.t >= 0.64) G.fade = null; }
    if (I.hit.pause) { if (G.menu) { if (G.menu.type !== 'result') { if (G.menu.back) G.openMenu(G.menu.back); else G.closeMenu(); } } else if (G.scene !== 'title' && !G.dying) G.openMenu('pause'); }
    if (G.banner) { G.banner.t += dt; if (G.banner.t >= G.banner.life) G.banner = null; }
    for (const t of G.toasts) t.t += dt; G.toasts = G.toasts.filter((t) => t.t < 4);
    N.R.update(dt);
    if (G.scene === 'title') {
      for (const q of G.parts) { q.x += q.vx * dt; q.y += q.vy * dt; q.life -= dt; } G.parts = G.parts.filter((q) => q.life > 0);
      if (!G.menu && (I.typed.includes('Enter') || I.typed.includes('Space'))) G.goLobby(); return;
    }
    if (G.menu || !G.p) return;
    const p = G.p;
    if (G.dying) { G.dyingT += dt; if (G.dyingT > 1.8) { G.dying = false; G.endRun(false); } }
    if (p.alive && !G.dying) N.updatePlayer(p, dt);
    if (p.alive && p.potions > 0 && p.hp > 0 && p.hp <= 1) { p.potions--; N.healPlayer(3); N.text(p.x, p.y - 28, 'Poção!', '#ff9ad0'); }
    G.curRoom = N.roomOf(p.x, p.y);
    N.updateFlow();
    N.updateEnemies(dt); N.updateProjs(dt); N.updateAllies(dt); N.updatePickups(dt);
    for (const f of G.fx) { f.t += dt; if (f.update) f.update(f, dt); if (f.t >= f.life && !f.dead) { f.dead = true; if (f.done) f.done(); } }
    G.fx = G.fx.filter((f) => !f.dead);
    for (const q of G.parts) { q.x += q.vx * dt; q.y += q.vy * dt; q.vy += q.grav * dt; q.vx *= Math.pow(0.1, dt); q.vy *= Math.pow(0.1, dt); q.life -= dt; }
    G.parts = G.parts.filter((q) => q.life > 0);
    for (const t of G.texts) t.t += dt; G.texts = G.texts.filter((t) => t.t < t.life);
    // interaction
    G.near = null; let bd = 1e9;
    for (const pr of G.props) { if (!pr.use || !pr.label || !pr.label()) continue; const d = Math.hypot(p.x - pr.x, p.y - (pr.iy || pr.y)); if (d < (pr.r || 18) && d < bd) { bd = d; G.near = pr; } }
    if (I.hit.interact && G.near && p.alive && !p.control) G.near.use();
    if (G.scene === 'run' && !G.dying) roomLogic(dt);
    achT -= dt; if (achT <= 0) { achT = 1; if (G.run) N.checkAch(); }
    if (G.hurtFlash > 0) G.hurtFlash -= dt;
    updateCamera(dt);
  }
  function camTarget() {
    const p = G.p; let tx = p.x - G.VW / 2, ty = p.y - 10 - G.VH / 2;
    if (!I.usingTouch) { const m = N.mouseWorld(); tx += N.clamp((m.x - p.x) * 0.16, -28, 28); ty += N.clamp((m.y - p.y) * 0.16, -20, 20); }
    if (G.boss && G.boss.alive) {
      // frame the boss and the hero together, never pushing the hero off screen
      tx = N.clamp((p.x + G.boss.x) / 2 - G.VW / 2, p.x - G.VW + 40, p.x - 40);
      ty = N.clamp((p.y + G.boss.y - 30) / 2 - G.VH / 2, p.y - G.VH + 26, p.y - 40);
    }
    if (G.scene !== 'run') {
      const mw = G.map.W * TS, mh = G.map.H * TS;
      tx = mw <= G.VW ? (mw - G.VW) / 2 : N.clamp(tx, TS, mw - G.VW - TS);
      ty = mh <= G.VH ? (mh - G.VH) / 2 : N.clamp(ty, TS * 0.5, mh - G.VH - TS);
    }
    return [tx, ty];
  }
  function updateCamera(dt) { const [tx, ty] = camTarget(); G.camX = N.lerp(G.camX, tx, Math.min(1, dt * 7)); G.camY = N.lerp(G.camY, ty, Math.min(1, dt * 7)); G.shakeA = Math.max(0, (G.shakeA || 0) - dt * 22); }
  function snapCamera() { if (!G.p) return; const [tx, ty] = camTarget(); G.camX = tx; G.camY = ty; }

  // ================================================================ rendering
  function renderWorld() { N.R.world(gctx); }

  function renderUI() {
    uctx.setTransform(1, 0, 0, 1, 0, 0); uctx.clearRect(0, 0, ucv.width, ucv.height);
    uctx.setTransform(ucv.width / G.UW, 0, 0, ucv.height / G.UH, 0, 0);
    U.begin(uctx, G.UW, G.UH);
    if (G.scene === 'title') { if (!G.menu) U.title(); }
    else if (G.p) {
      U.labels(); U.texts();
      if (G.scene === 'training') for (const e of G.enemies) if (e.dummy) U.text(Math.round(e.dps * 0.69) + ' DPS', U.toW(e.x), U.toH(e.y - 30), { size: 16, align: 'center', color: '#ffe066' });
      U.hud(); U.drawTouch(); U.banner(); U.toasts();
    }
    if (G.menu && U.menus[G.menu.type]) U.menus[G.menu.type](G.menu);
    if (G.fade) { const k = G.fade.t < 0.32 ? G.fade.t / 0.32 : 1 - (G.fade.t - 0.32) / 0.32; uctx.fillStyle = `rgba(8,5,14,${N.clamp(k, 0, 1)})`; uctx.fillRect(0, 0, G.UW, G.UH); }
  }

  // ================================================================ loop
  let last = performance.now();
  function frame(now) {
    let dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (G.slowmo > 0) { G.slowmo -= dt; dt *= 0.35; }
    G.time += dt;
    U.begin(uctx, G.UW, G.UH);
    U.processTouch(); I.update();
    try { for (let k = 0; k < (G.speed || 1); k++) update(dt); } catch (err) { console.error(err); }
    try { renderWorld(); renderUI(); } catch (err) { console.error(err); }
    I.endFrame();
    requestAnimationFrame(frame);
  }
  N.music.play('lobby');
  requestAnimationFrame(frame);

  // Hooks for automated tests (tests/smoke.js).
  window.NirykDebug = {
    G, N,
    killAll: () => { for (const e of G.enemies) if (e.alive && !e.dummy) { if (e.boss) e.hp = 1; N.hurtEnemy(e, 1e6); } },
    teleportTo: (room) => { G.p.x = (room.cx + 0.5) * TS; G.p.y = (room.cy + 0.5) * TS; },
    nextLevel: () => nextLevel(),
    setupLobby, setupTraining,
  };
})();
