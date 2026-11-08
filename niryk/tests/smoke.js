// Niryk — browser smoke test: drives the real game in headless Chromium (Playwright) through the menus and
// settings, every ability of the five heroes with every passive, hold-to-aim, two full runs (3 layers × 3 levels
// each) that together visit all six worlds and six bosses on the lowest and the highest difficulty, the difficulty
// unlock, a death, and a phone-sized touch session. Fails on any page error.
// Run: node niryk/tests/smoke.js   (needs the `playwright` package and its Chromium)
'use strict';
const path = require('path');
const { chromium } = require('playwright');
const URL = 'file://' + path.join(__dirname, '..', 'index.html');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const browser = await chromium.launch();
  const errors = [];
  const watch = (page) => { page.on('pageerror', (e) => errors.push(e.message)); page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); }); };
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  watch(page);
  await page.goto(URL);
  await page.evaluate(() => localStorage.clear());
  await page.reload(); await sleep(400);
  const ev = (fn, arg) => page.evaluate(fn, arg);
  const step = (label) => console.log('•', label, errors.length ? `(${errors.length} errors)` : '');

  // ---- menus
  await page.keyboard.press('Enter'); await sleep(900);
  step('lobby');
  for (const m of ['codex', 'achievements', 'upgrades', 'loadout', 'runStart', 'help', 'pause', 'settings', 'stats']) {
    await ev((m) => NirykDebug.G.openMenu(m, { id: 'sylvar' }), m); await sleep(120);
    if (m === 'codex') for (const tab of ['q', 'm', 'b']) { await ev((t) => { NirykDebug.G.menu.tab = t; }, tab); await sleep(80); }
  }
  for (const h of ['haldor', 'kazan']) { await ev((h) => NirykDebug.G.openMenu('hero', { id: h }), h); await sleep(120); }
  await ev(() => { NirykDebug.N.save.crystals = 999; NirykDebug.G.openMenu('upgrades'); }); await sleep(100);
  await page.mouse.click(640, 560); await sleep(100); // buy button area
  // settings: every row is clickable, and fullscreen must not throw
  await ev(() => NirykDebug.G.openMenu('settings')); await sleep(100);
  for (let y = 200; y < 640; y += 24) { await page.mouse.click(640, y); await sleep(30); }
  await ev(() => { NirykDebug.N.toggleFullscreen(); NirykDebug.G.closeMenu(); });
  const opts = await ev(() => NirykDebug.N.save.opts);
  if (typeof opts.musicVol !== 'number' || typeof opts.sfxVol !== 'number') errors.push('settings lost the volume options');
  await ev(() => { Object.assign(NirykDebug.N.save.opts, { music: true, sfx: true, musicVol: 0.7, sfxVol: 0.8, dmgNums: true, camLead: true, fps: true, autoAim: true }); NirykDebug.N.applyOpts && NirykDebug.N.applyOpts(); });
  step('menus + settings');

  // ---- every ability × passive in the training ground
  await ev(() => NirykDebug.setupTraining()); await sleep(300);
  await ev(() => { const { G, N } = NirykDebug; for (const id of Object.keys(N.ENEMIES)) N.save.codex.m[id] = 1; G.openMenu('training'); });
  await sleep(150); await ev(() => NirykDebug.G.openMenu('rack')); await sleep(150); await ev(() => NirykDebug.G.closeMenu());
  await ev(() => { NirykDebug.G.speed = 2; NirykDebug.G.godMode = true; });
  const heroes = await ev(() => Object.keys(NirykDebug.N.CHARS));
  if (heroes.length !== 5) errors.push('expected 5 heroes, got ' + heroes.length);
  for (const hero of heroes) {
    const abil = await ev((h) => NirykDebug.N.CHARS[h].abilities, hero);
    for (const a of abil) for (let mod = -1; mod <= 2; mod++) {
      await ev(([h, a, mod]) => {
        const { G, N } = NirykDebug;
        N.save.char = h; N.save.loadout[h] = [a, N.CHARS[h].abilities.find((x) => x !== a)]; N.save.mods[a] = mod;
        G.refreshLoadout(); G.godMode = true; G.noCd = true;
        if (G.enemies.filter((e) => !e.dummy).length < 3) for (const id of ['gosmo', 'olho', 'cavaleiro']) G.trainingSpawn(id);
        N.castAbility(G.p, 0);
      }, [hero, a, mod]);
      await sleep(250);
      await ev(() => { const { G, N } = NirykDebug; N.castAbility(G.p, 0); G.p.atkCd = 0; N.attack(G.p); });
      await sleep(350);
    }
    // every weapon
    for (const w of await ev(() => Object.keys(NirykDebug.N.WEAPONS))) { await ev((w) => { const { G, N } = NirykDebug; G.p.form = null; G.p.weapons[G.p.wi] = w; G.p.atkCd = 0; N.attack(G.p); }, w); await sleep(40); }
    step('abilities ' + hero);
  }

  // ---- hold-to-aim: a quick tap casts at once; holding shows the aim and casts where the mouse is on release
  await ev(() => { const { G, N } = NirykDebug; G.speed = 1; N.save.char = 'sylvar'; N.save.loadout.sylvar = ['chuva', 'raizes']; N.save.mods.chuva = -1; G.refreshLoadout(); G.noCd = false; G.p.control = null; G.p.form = null; for (const s of G.p.abil) { s.cd = 0; s.charges = s.max || 1; s.hold = null; } });
  await sleep(200);
  await page.mouse.move(900, 300);
  await page.keyboard.down('KeyQ'); await sleep(450);
  const holding = await ev(() => { const s = NirykDebug.G.p.abil[0]; return !!(s.hold && s.hold.aim) && s.cd <= 0; });
  await page.keyboard.up('KeyQ'); await sleep(150);
  const casted = await ev(() => NirykDebug.G.p.abil[0].cd > 0);
  if (!holding) errors.push('holding the ability key did not show the aim');
  if (!casted) errors.push('releasing the held ability did not cast it');
  await ev(() => { const s = NirykDebug.G.p.abil[1]; s.cd = 0; s.charges = s.max || 1; });
  await page.keyboard.press('KeyE'); await sleep(150);
  if (!(await ev(() => NirykDebug.G.p.abil[1].cd > 0))) errors.push('tapping the ability key did not cast it');
  step('hold-to-aim');

  // ---- two full runs covering the six worlds; the first unlocks the next difficulty
  const plans = [{ hero: 'kestrus', diff: 0, worlds: [0, 1, 2] }, { hero: 'kazan', diff: 3, worlds: [3, 4, 5] }];
  for (const plan of plans) {
    await ev(() => { const G = NirykDebug.G; G.closeMenu(); G.speed = 1; }); await sleep(300);
    await ev((plan) => { const { G, N } = NirykDebug; N.save.char = plan.hero; if (plan.diff > N.save.diff) N.save.diff = plan.diff; N.save.lastDiff = plan.diff; G.startRun(plan.worlds[0]); }, plan);
    await sleep(900);
    await ev(() => { const G = NirykDebug.G; G.speed = 4; G.godMode = true; });
    const seen = [];
    for (let lvl = 0; lvl < 9; lvl++) {
      const info = await ev(() => { const G = NirykDebug.G; return { n: G.map.rooms.length, w: G.run.world, l: G.run.level, id: G.curWorld().id, diff: G.diff.id }; });
      if (info.l === 0) seen.push(info.id);
      const nonBoss = info.n - (info.l === 2 ? 1 : 0) - 1; // without the entrance and the boss room
      if (nonBoss < 7 || nonBoss > 10) errors.push(`level ${info.w + 1}-${info.l + 1} has ${nonBoss} rooms (expected 7–10)`);
      for (let i = 0; i < info.n; i++) {
        const t = await ev((i) => { const G = NirykDebug.G, r = G.map.rooms[i]; NirykDebug.teleportTo(r); G.p.y += 8; return r.type; }, i);
        if (t === 'enemy' || t === 'boss') {
          for (let k = 0; k < 80; k++) {
            await sleep(150);
            const st = await ev((i) => { const G = NirykDebug.G, r = G.map.rooms[i]; return { cleared: r.cleared, boss: !!G.boss }; }, i);
            if (st.cleared) break;
            if (st.boss) { // watch the boss fight a little in both phases
              if (k < 20) continue;
              if (k < 40) { await ev(() => { const b = NirykDebug.G.boss; if (b) b.hp = Math.min(b.hp, b.maxHp * 0.45); }); continue; }
            }
            if (k % 2 === 0) await ev(() => NirykDebug.killAll());
          }
        }
        // use every prop in reach (items, chests, blessings, shop)
        await ev(() => { const { G } = NirykDebug; G.p.gold = 999; for (const pr of G.props.slice()) if (pr.kind === 'item' || pr.label && /baú|Presente/.test(pr.label() || '')) { G.p.x = pr.x; G.p.y = pr.iy || pr.y; pr.use(); } });
        await sleep(60);
      }
      step(`level ${info.w + 1}-${info.l + 1} ${info.id} [${info.diff}] (${info.n} rooms)`);
      let done = 'no-portal';
      for (let k = 0; k < 40 && done === 'no-portal'; k++) {
        done = await ev((want) => {
          const G = NirykDebug.G; if (G.menu && G.menu.type === 'result') return true;
          const p = (want !== null && G.props.find((q) => q.next === want && q.use)) || G.portal; if (!p) return 'no-portal';
          G.p.x = p.x; G.p.y = p.y; p.use(); return false;
        }, info.l === 2 && info.w < 2 ? plan.worlds[info.w + 1] : null);
        if (done === 'no-portal') await sleep(100);
      }
      if (done === 'no-portal') { errors.push('no portal on level ' + lvl); break; }
      await sleep(900);
    }
    const want = await ev((ws) => ws.map((w) => NirykDebug.N.WORLDS[w].id), plan.worlds);
    if (seen.join() !== want.join()) errors.push(`run visited ${seen.join()} instead of ${want.join()}`);
    const res = await ev(() => { const G = NirykDebug.G; return G.menu && G.menu.type === 'result' ? G.menu.win : null; });
    if (res !== true) errors.push('run did not end in victory: ' + res);
    step(`victory (${plan.hero}, ${seen.join(' → ')})`);
    if (plan.diff === 0 && (await ev(() => NirykDebug.N.save.diff)) < 1) errors.push('beating Normal did not unlock the next difficulty');
  }

  // ---- death
  await ev(() => { const G = NirykDebug.G; G.closeMenu(); G.speed = 1; }); await sleep(800);
  await ev(() => NirykDebug.G.startRun()); await sleep(900);
  await ev(() => { const { G, N } = NirykDebug; G.godMode = false; G.p.inv = 0; G.p.shield = 0; G.p.hp = 0.5; N.hurtPlayer(1); });
  await sleep(4500);
  const dead = await ev(() => { const G = NirykDebug.G; return G.menu && G.menu.type === 'result' && !G.menu.win; });
  if (!dead) errors.push('death did not show the result screen');
  step('death');

  // ---- phone with touch
  const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true });
  const mob = await ctx.newPage(); watch(mob);
  await mob.goto(URL); await sleep(500);
  await mob.touchscreen.tap(422, 140); await sleep(900);
  await mob.evaluate(() => NirykDebug.G.startRun()); await sleep(900);
  await mob.touchscreen.tap(780, 330); await sleep(300);
  step('touch');

  await browser.close();
  if (errors.length) { console.error('FAILED with errors:\n' + [...new Set(errors)].slice(0, 20).join('\n')); process.exit(1); }
  console.log('smoke test passed');
})().catch((e) => { console.error(e); process.exit(1); });
