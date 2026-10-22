// Xenospire boot: the app state machine (title -> arrival -> draft -> versus ->
// battle -> victory -> loom -> ...), the main loop, player control mapping,
// audio/haptic hooks, tutorial tips and the attract-mode fight behind menus.
(function (XS) {
  'use strict';

  const STEP = 1 / 60;
  const MENU_MUSIC = { id: 'menu', music: { root: 57, mode: 'dorian', bpm: 76 } };
  const canvas = document.getElementById('view');
  const uiRoot = document.getElementById('ui');
  const screenLayer = XS.Cards.el('div', 'screen-layer');
  const modalLayer = XS.Cards.el('div', 'modal-layer hidden');
  const toastEl = XS.Cards.el('div', 'toast hidden');
  uiRoot.append(screenLayer, modalLayer, toastEl);

  const app = XS.app = {
    settings: XS.Settings.load(),
    meta: XS.Run.meta(),
    state: 'boot',
    run: null, plan: null, battle: null, scene: null,
    running: false, paused: false, countdown: 0, slowmo: 0, overHandled: false,
  };
  app.screen = new XS.Screen(canvas);
  app.sound = new XS.Sound(app.settings);
  app.input = new XS.Input(canvas, app.settings);
  app.hud = new XS.HUD(uiRoot, app.settings);
  app.input.bindTouch(app.hud.els);
  app.hud.els.pause.addEventListener('click', () => app.pauseMenu(false));

  // ------------------------------------------------------------ helpers
  function resize() {
    // Portrait screens are narrow: zoom out a bit so more of the arena fits.
    // Big screens (tablets, desktops) show a little more of the arena too.
    const portrait = window.innerHeight > window.innerWidth * 1.15;
    const big = Math.min(window.innerWidth, window.innerHeight) > 560;
    // Low quality renders fewer, bigger pixels.
    const lowRes = app.settings.quality === 0 ? 0.8 : 1;
    const short = (XS.Settings.PIXEL_SHORT[app.settings.pixel] || 330) * (portrait ? 1.3 : 1) * (big ? 1.15 : 1) * lowRes;
    app.screen.resize(window.innerWidth, window.innerHeight, short);
    if (app.scene) app.scene.resize();
  }
  function applyAccessibility() {
    document.documentElement.classList.toggle('big-text', !!app.settings.bigText);
    document.documentElement.classList.toggle('reduce-motion', !!app.settings.reduceMotion);
  }
  function toast(text, ms = 2200) {
    toastEl.textContent = text;
    toastEl.classList.remove('hidden');
    clearTimeout(toast.t);
    toast.t = setTimeout(() => toastEl.classList.add('hidden'), ms);
  }
  const unlock = () => app.sound.unlock();
  window.addEventListener('pointerdown', unlock, { passive: true });
  window.addEventListener('keydown', unlock);
  document.addEventListener('click', (e) => { if (e.target.closest && e.target.closest('button')) app.sound.play('ui', { gap: 0.02 }); });

  app.openModal = (node) => {
    modalLayer.innerHTML = '';
    modalLayer.appendChild(node);
    modalLayer.classList.remove('hidden');
  };
  app.closeModal = () => {
    modalLayer.classList.add('hidden');
    modalLayer.innerHTML = '';
    if (app.state === 'battle' && app.paused) { app.paused = false; app.input.reset(); }
  };
  app.showPower = (def) => app.openModal(XS.Screens.powerInfo(app, def));

  // ---------------------------------------------------------- scenes
  function setScene(scene) {
    if (app.scene && app.scene !== scene) app.scene.dispose();
    app.scene = scene;
  }

  // AI-vs-AI sparring behind the menus.
  function attract() {
    const seed = XS.randomSeed();
    const floor = 1 + (seed % 9);
    const arena = XS.Arena.generate(seed, floor, { fighters: 2 });
    const fighters = [0, 1].map((i) => ({
      genome: XS.Creature.generate(XS.hash(seed, 'g', i)),
      powers: [0, 1, 2].map((k) => XS.Power.generate(XS.hash(seed, 'p', i, k), floor + 3)),
      team: i, hpMult: 2.5,
    }));
    const battle = new XS.Battle({ arena, seed, floor, fighters });
    for (const f of battle.fighters) f.ai = new XS.AI(f, { skill: 0.75 });
    const scene = new XS.Scene(app.screen, arena, { seed, settings: Object.assign({}, app.settings, { damageNumbers: false, shake: 0.3 }) });
    scene.setBattle(battle);
    scene.showBars = false;
    app.attractBattle = battle;
    setScene(scene);
    if (app.sound.musicId !== 'menu' || !(app.sound.music || app.sound.pendingMusic)) app.sound.startMusic(MENU_MUSIC, { calm: true });
  }

  // ------------------------------------------------------------ states
  app.go = (state, data) => {
    app.closeModal();
    const prev = app.state;
    app.state = state;
    screenLayer.innerHTML = '';
    screenLayer.className = 'screen-layer state-' + state;
    if (state !== 'battle') { app.hud.hide(); app.input.enabled = false; app.running = false; }
    const menuStates = ['title', 'intro', 'arrival', 'draft', 'codex', 'gameover'];
    if (menuStates.includes(state) && (!app.attractBattle || !menuStates.includes(prev))) attract();
    if (['title', 'codex'].includes(state)) app.prevMenu = state === 'codex' ? app.prevMenu : 'title';
    let node = null;
    switch (state) {
      case 'title': app.meta = XS.Run.meta(); node = XS.Screens.title(app); break;
      case 'intro': node = XS.Screens.intro(app, data); break;
      case 'arrival': node = XS.Screens.arrival(app); break;
      case 'draft': node = XS.Screens.draft(app); break;
      case 'versus': node = enterVersus(); break;
      case 'battle': enterBattle(); break;
      case 'victory': node = XS.Screens.victory(app, data); break;
      case 'loom': node = XS.Screens.loom(app); app.sound.play('loom'); break;
      case 'gameover': node = XS.Screens.gameover(app, data); break;
      case 'codex': app.meta = XS.Run.meta(); node = XS.Screens.codex(app, data); break;
    }
    if (node) {
      screenLayer.appendChild(node);
      screenLayer.scrollTop = 0;
      const first = node.querySelector('.btn.primary');
      if (first && app.input.mode !== 'touch') first.focus({ preventScroll: true });
    }
  };

  function enterVersus() {
    const run = app.run;
    run.phase = 'versus';
    XS.Run.saveRun(run);
    app.plan = XS.Run.floorPlan(run, app.settings.difficulty);
    for (const o of app.plan.opponents) {
      XS.Run.remember(app.meta, 'beings', o.genomeSeed);
      for (const d of o.powers) XS.Run.remember(app.meta, 'powers', XS.Run.specOf(d), 200);
    }
    XS.Run.saveMeta(app.meta);
    app.attractBattle = null;
    app.battle = XS.Run.stageBattle(run, app.plan, app.settings);
    const scene = new XS.Scene(app.screen, app.battle.arena, { seed: run.seed, settings: app.settings });
    scene.setBattle(app.battle, { playerHit: onPlayerHit });
    setScene(scene);
    wireBattleAudio(app.battle);
    app.sound.startMusic(app.plan.theme, { intensity: app.plan.type === 'guardian' ? 1 : 0 });
    return XS.Screens.versus(app, app.plan);
  }

  function enterBattle() {
    app.running = true;
    app.paused = false;
    app.overHandled = false;
    app.countdown = 1.2;
    app.slowmo = 0;
    app.deadT = 0;
    app.castQueue = [];
    app.input.reset();
    app.input.enabled = true;
    app.hud.show(app.battle, app.plan);
    app.hud.setMode(app.input.mode);
    app.hud.banner(XS.t('floor', { n: app.plan.floor }), app.plan.type === 'guardian' ? XS.t('guardian', { n: app.plan.floor }) : app.plan.type === 'melee' ? XS.S.melee : XS.S.duel, 1100);
    app.run.phase = 'versus';
    app.tutorial = !app.meta.tutorialDone && app.plan.floor === 1 ? { step: 0, t: 0, moved: 0 } : null;
  }

  // ------------------------------------------------------------ actions
  app.newRun = (seed) => {
    app.run = XS.Run.newRun(seed != null ? seed : XS.randomSeed());
    XS.Run.saveRun(app.run);
    if (!app.meta.introSeen) app.go('intro', { then: 'arrival' });
    else app.go('arrival');
  };
  app.introDone = (data) => {
    app.meta.introSeen = true;
    XS.Run.saveMeta(app.meta);
    app.go(data && data.replay ? 'title' : 'arrival');
  };
  app.continueRun = () => {
    const run = XS.Run.loadRun();
    if (!run) { app.go('title'); return; }
    app.run = run;
    if (!run.genomeSeed) app.go('arrival');
    else if (run.powers.length < 3 && run.floor === 1) app.go('draft');
    else if (run.phase === 'loom') app.go('loom');
    else app.go('versus');
  };
  app.setSeed = (text) => {
    const seed = XS.codeToSeed(text);
    app.run = XS.Run.newRun(seed);
    XS.Run.saveRun(app.run);
    app.go('arrival');
    toast(`${XS.S.seed}: ${XS.seedToCode(seed)}`);
  };
  app.reroll = () => {
    if (app.run.rerolls <= 0) return;
    app.run.rerolls--;
    app.run.arrivalRoll++;
    XS.Run.saveRun(app.run);
    app.sound.play('portal');
    app.go('arrival');
  };
  app.chooseBeing = (gseed) => {
    app.run.genomeSeed = gseed;
    app.run.phase = 'draft';
    XS.Run.remember(app.meta, 'beings', gseed);
    XS.Run.saveMeta(app.meta);
    XS.Run.saveRun(app.run);
    app.sound.play('select');
    app.go('draft');
  };
  app.draftPick = (def) => {
    app.run.powers.push(XS.Run.specOf(def));
    app.run.draftRound++;
    XS.Run.remember(app.meta, 'powers', XS.Run.specOf(def), 200);
    XS.Run.saveMeta(app.meta);
    XS.Run.saveRun(app.run);
    app.sound.play('select');
    app.go(app.run.draftRound >= 3 ? 'versus' : 'draft');
  };
  app.startBattle = () => { app.sound.play('select'); app.go('battle'); };
  const advanceFloor = () => {
    app.run.floor++;
    app.run.phase = 'versus';
    XS.Run.saveRun(app.run);
    app.go('versus');
  };
  app.loomTake = (def, slot) => {
    app.run.powers[slot] = XS.Run.specOf(def);
    XS.Run.remember(app.meta, 'powers', XS.Run.specOf(def), 200);
    XS.Run.saveMeta(app.meta);
    app.sound.play('select');
    advanceFloor();
  };
  app.loomReinforce = (slot) => {
    const sp = app.run.powers[slot];
    app.run.powers[slot] = { seed: sp.seed, floor: app.run.floor + 1, tier: sp.tier, reinforced: true };
    app.sound.play('select');
    advanceFloor();
  };
  app.loomUnravel = () => {
    app.run.hpFrac = Math.min(1, app.run.hpFrac + 0.25);
    app.sound.play('heal');
    advanceFloor();
  };
  app.abandon = () => {
    app.closeModal();
    finishRun(null);
  };
  app.pauseMenu = (inMenu) => {
    if (app.state === 'battle') app.paused = true;
    app.openModal(XS.Screens.pause(app, inMenu));
  };
  app.resume = () => app.closeModal();
  app.openSettings = (fromPause) => {
    if (app.state === 'battle') app.paused = true;
    app.openModal(XS.Screens.settings(app, fromPause));
  };
  app.openCodex = () => { app.prevMenu = app.state === 'gameover' ? 'title' : app.state; app.go('codex', 'beings'); };
  app.settingChanged = (key) => {
    XS.Settings.save(app.settings);
    app.sound.applyVolumes();
    if (key === 'music' || key === 'master') {
      if (app.settings.music <= 0 || app.settings.master <= 0) app.sound.stopMusic();
      else if (!app.sound.music) {
        if (app.plan && app.state !== 'title') app.sound.startMusic(app.plan.theme, {});
        else app.sound.startMusic(MENU_MUSIC, { calm: true });
      }
    }
    if (key === 'pixel') resize();
    if (key === 'quality') { if (app.scene) app.scene.fx.quality = app.settings.quality; resize(); }
    if (['bigText', 'reduceMotion'].includes(key)) applyAccessibility();
    app.hud.applySettings();
  };
  app.eraseAll = () => {
    for (const k of ['run', 'meta', 'settings']) XS.store.remove(k);
    toast(XS.S.set.erased);
    setTimeout(() => location.reload(), 600);
  };

  function finishRun(foe) {
    const run = app.run;
    const fav = XS.Run.favoritePower(run);
    const res = XS.Run.endRun(run, foe);
    app.meta = XS.Run.meta();
    app.go('gameover', { floor: run.floor, newRecord: res.newRecord, best: res.best, epitaph: res.epitaph, genomeSeed: run.genomeSeed, stats: run.stats, favorite: fav, seed: run.seed });
  }

  function onBattleOver() {
    const b = app.battle, p = b.player;
    app.running = false;
    app.input.enabled = false;
    if (p.alive) {
      XS.Run.recordVictory(app.run, b);
      XS.Run.saveRun(app.run);
      const fav = p.stats.casts.slice(0, 3).reduce((best, n, i) => (n > best.n ? { n, i } : best), { n: 0, i: -1 });
      const foe = b.fighters.find((f) => !f.isPlayer);
      const line = XS.Lore.victory(new XS.RNG(XS.hash(app.run.seed, 'win', app.plan.floor)), {
        power: fav.i >= 0 ? p.powers[fav.i].def.name : null, casts: fav.n, voxels: p.stats.voxels, world: XS.Creature.generate(app.run.genomeSeed).bio.world,
        foe: foe ? foe.name : '', time: Math.round(b.time), falls: p.stats.falls, n: app.plan.floor,
      });
      app.go('victory', { line, stats: p.stats, time: b.time });
    } else {
      // Count the floor stats of the lost fight too.
      app.run.stats.kos += p.stats.kos; app.run.stats.dmg += Math.round(p.stats.dmg); app.run.stats.voxels += p.stats.voxels;
      app.run.stats.falls += p.stats.falls; app.run.stats.time += b.time;
      const killer = p.lastHitBy || b.fighters.find((f) => !f.isPlayer);
      finishRun(killer ? killer.name : null);
    }
  }

  // ------------------------------------------------- audio/haptic hooks
  function wireBattleAudio(b) {
    const s = app.sound;
    const ev = b.events;
    ev.on('cast', (e) => { s.power(e.def); if (Math.random() < 0.3) s.voice(e.f.g, 'attack'); });
    ev.on('basic', (e) => s.play(e.f.basic.def.kind === 'spit' ? 'spit' : 'swing'));
    ev.on('hit', (e) => {
      if (e.dot || e.amount < 1) return;
      s.play(e.amount >= 25 ? 'hitBig' : 'hit', { gap: 0.04 });
      if (e.target.isPlayer && Math.random() < 0.5) s.voice(e.target.g, 'hurt');
    });
    ev.on('dodge', () => s.play('dodge'));
    ev.on('explosion', (e) => s.play(e.small ? 'hit' : 'explosion', { gap: 0.06 }));
    ev.on('fall', () => s.play('fall'));
    ev.on('quake', () => s.play('hitBig'));
    ev.on('spike', () => s.play('break', { gap: 0.05, pitch: 0.7 }));
    ev.on('ko', (e) => {
      s.play('ko');
      s.voice(e.f.g, 'ko');
      if (e.f.isPlayer && b.alive().length > 1 && new Set(b.alive().map((f) => f.team)).size > 1) {
        app.slowmo = app.settings.reduceMotion ? 0 : 1.1;
        s.play('defeat');
        app.hud.banner(XS.S.defeat, '', 1600);
      }
    });
    ev.on('status', (e) => { if (e.type === 'freeze') s.play('freeze'); });
    ev.on('heal', () => s.play('heal', { gap: 0.3 }));
    ev.on('decided', (e) => {
      app.slowmo = app.settings.reduceMotion ? 0 : 1.1;
      const won = b.player && e.winnerTeam === b.player.team;
      s.play(won ? 'victory' : 'defeat');
      if (won) { app.hud.banner(XS.S.victory, '', 1600); s.voice(b.player.g, 'win'); } else app.hud.banner(XS.S.defeat, '', 1600);
    });
    ev.on('suddenDeath', () => app.hud.banner('!', XS.Lore.SUDDEN[0], 2200));
    ev.on('enrage', (e) => app.hud.banner('FÚRIA!', e.f.name, 1300));
    b.world.events.on('chunk', () => s.play('crack', { gap: 0.08 }));
    b.world.events.on('chunkLand', (e) => s.play('thud', { gap: 0.08, size: Math.min(1, e.n / 60) }));
    b.world.events.on('break', (e) => s.play('break', { gap: 0.045, pitch: e.def && e.def.kind === 'metal' ? 0.6 : e.def && (e.def.kind === 'crystal' || e.def.kind === 'glass' || e.def.kind === 'ice') ? 1.8 : 1 }));
  }
  function onPlayerHit(e) {
    if (app.settings.vibration && navigator.vibrate) { try { navigator.vibrate(Math.min(70, 15 + e.amount)); } catch (err) { /* unsupported */ } }
  }

  // ------------------------------------------------- player controls
  function autoTarget(p, def) {
    const b = app.battle;
    const e = b.nearestEnemy(p, p.x, p.y, 16);
    if (!e) return null;
    const lead = def && def.speed ? Math.hypot(e.x - p.x, e.y - p.y) / def.speed : 0;
    const x = e.x + e.vx * lead * 0.8, y = e.y + e.vy * lead * 0.8;
    return { angle: Math.atan2(y - p.y, x - p.x), dist: Math.hypot(x - p.x, y - p.y) };
  }
  function mouseAim(p, intent) {
    const sc = app.scene;
    const { x: bx, y: by } = app.screen.toBuffer(intent.mouse.x, intent.mouse.y);
    const w = XS.screenToWorld(bx - sc.ox, by - sc.oy, p.z);
    return { angle: Math.atan2(w.y - p.y, w.x - p.x), dist: Math.hypot(w.x - p.x, w.y - p.y) };
  }
  function vectorAim(p, def, dx, dy, k) {
    const d = XS.screenDirToWorld(dx, dy);
    return { angle: Math.atan2(d.y, d.x), dist: (def ? def.range || 6 : 6) * XS.clamp(k, 0.15, 1) };
  }

  function applyIntent(intent) {
    const b = app.battle, p = b.player;
    if (!p || !p.alive) return;
    const c = p.ctrl;
    const m = Math.hypot(intent.mx, intent.my);
    if (m > 0.01) {
      const d = XS.screenDirToWorld(intent.mx, intent.my);
      c.mx = d.x * Math.min(1, m); c.my = d.y * Math.min(1, m);
    } else { c.mx = 0; c.my = 0; }
    const kb = intent.mode === 'kb';
    const base = kb && intent.mouse.moved ? mouseAim(p, intent) : (app.settings.aimAssist ? autoTarget(p, null) : null);
    c.aim = base ? base.angle : (m > 0.2 ? Math.atan2(c.my, c.mx) : p.facing);
    c.attack = intent.attack;
    // Aimed basic attack (dragged attack button): fire as soon as it's ready.
    if (intent.basicCasts.length) {
      const cst = intent.basicCasts[intent.basicCasts.length - 1];
      app.atkPending = { angle: cst.auto ? null : vectorAim(p, null, cst.dx, cst.dy, 1).angle, t: 0.6, n: p.stats.basic };
    }
    const ap = app.atkPending;
    if (ap) {
      if (p.stats.basic > ap.n || (ap.t -= STEP) <= 0) app.atkPending = null;
      else { if (ap.angle != null) c.aim = ap.angle; c.attack = true; }
    }
    if (intent.dodge) c.dodge = true;
    if (intent.pause) app.pauseMenu(false);
    // Casting.
    const queue = app.castQueue = (app.castQueue || []).concat(intent.casts);
    if (queue.length && c.cast < 0) {
      const cst = queue.shift();
      const slot = p.powers[cst.slot];
      if (slot) {
        let aim;
        if (cst.mouse) aim = mouseAim(p, intent);
        else if (cst.manual) aim = vectorAim(p, slot.def, cst.dx, cst.dy, cst.pad ? Math.hypot(cst.dx, cst.dy) : cst.dist);
        else aim = (app.settings.aimAssist && autoTarget(p, slot.def)) || { angle: c.aim, dist: slot.def.range * 0.7 };
        if (slot.cd > 0) app.sound.play('cooldown');
        c.cast = cst.slot; c.castAngle = aim.angle; c.castDist = aim.dist; c.castCharge = cst.charge || 0;
        if (app.tutorial && app.tutorial.step === 2) app.tutorial.step++;
      }
    }
    // Aim preview.
    const a = intent.aiming;
    if (a && p.powers[a.slot]) {
      const def = p.powers[a.slot].def;
      let aim;
      if (a.source === 'key') aim = mouseAim(p, intent);
      else if (a.manual) aim = vectorAim(p, def, a.dx, a.dy, Math.hypot(a.dx, a.dy) / XS.Input.DRAG_FULL);
      else aim = (app.settings.aimAssist && autoTarget(p, def)) || { angle: c.aim, dist: def.range * 0.7 };
      const charge = a.t0 && def.mods.includes('charge') ? XS.Input.chargeSince(a.t0) : 0;
      app.scene.aim = { def, angle: aim.angle, dist: aim.dist, cancel: !!a.cancel, charge };
    } else if (intent.basicAim && intent.basicAim.manual) {
      const ba = intent.basicAim, aim = vectorAim(p, null, ba.dx, ba.dy, 1);
      app.scene.aim = { def: p.basic.def, basic: true, angle: aim.angle, dist: p.basic.def.range, cancel: !!ba.cancel, charge: 0 };
    } else app.scene.aim = null;
    // Tutorial progress.
    const T = app.tutorial;
    if (T) {
      if (T.step === 0 && m > 0.3) { T.moved += STEP; if (T.moved > 0.8) T.step++; }
      if (T.step === 1 && c.attack) T.step++;
      if (T.step === 3 && intent.dodge) T.step++;
    }
  }

  function updateTutorial() {
    const T = app.tutorial;
    if (!T) return;
    const touch = app.input.mode === 'touch';
    const tips = touch ? ['move', 'attack', 'power', 'dodge'] : ['moveKeys', 'attackKeys', 'powerKeys', 'dodgeKeys'];
    if (T.step < 4) app.hud.tip(XS.t('tips.' + tips[T.step]));
    else {
      app.hud.tip(null);
      app.tutorial = null;
      app.meta.tutorialDone = true;
      XS.Run.saveMeta(app.meta);
    }
  }

  // ------------------------------------------------------------ loop
  let last = performance.now(), acc = 0, frames = 0, fpsT = 0, fps = 60, skip = false, portraitT = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    let dt = Math.min(0.1, (now - last) / 1000);
    if (app.settings.fps === 30) { skip = !skip; if (skip) return; }
    last = now;
    frames++; fpsT += dt;
    if (fpsT >= 0.5) { fps = Math.round(frames / fpsT); frames = 0; fpsT = 0; }
    const scene = app.scene;
    if (app.state === 'battle' && app.battle) {
      const b = app.battle;
      const intent = app.input.poll();
      app.hud.setMode(intent.mode);
      if (app.paused && intent.pause) app.resume();
      else if (!app.paused) {
        if (app.countdown > 0) {
          app.countdown -= dt;
          if (app.countdown <= 0) app.hud.banner(XS.S.fight, '', 700);
        } else if (app.running) {
          applyIntent(intent);
          if (!app.settings.hitstop) b.hitstop = 0;
          let scale = 1;
          if (app.slowmo > 0) { app.slowmo -= dt; scale = 0.35; }
          acc += dt * scale;
          let n = 0;
          while (acc >= STEP && n++ < 6) { b.step(STEP); acc -= STEP; }
          updateTutorial();
          const p = b.player;
          app.sound.setIntensity(app.plan.type === 'guardian' || (p && p.hp < p.maxHp * 0.35) ? 1 : 0);
          if (b.over && !app.overHandled) { app.overHandled = true; onBattleOver(); }
          // In a free-for-all the others may keep fighting after the player falls.
          if (p && !p.alive && !app.overHandled && (app.deadT += dt) > 2.2) { app.overHandled = true; onBattleOver(); }
        }
        if (scene) scene.update(dt);
      }
      app.hud.update(dt, intent.aiming, fps);
    } else if (scene) {
      if (app.attractBattle) {
        acc += dt;
        let n = 0;
        while (acc >= STEP && n++ < 4) { app.attractBattle.step(STEP); acc -= STEP; }
        if (app.attractBattle.over) attract();
      }
      scene.update(dt);
    }
    if (app.scene) app.scene.draw();
    portraitT += dt;
    if (portraitT >= 1 / 30) { XS.Cards.updatePortraits(portraitT); portraitT = 0; }
  }

  // --------------------------------------------------------- lifecycle
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (app.state === 'battle' && app.running && !app.paused) app.pauseMenu(false);
      app.sound.suspend(true);
    } else app.sound.suspend(false);
  });
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', () => setTimeout(resize, 200));

  resize();
  applyAccessibility();
  app.go('title');
  requestAnimationFrame(frame);
})(globalThis.XS);
