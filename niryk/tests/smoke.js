// Niryk — browser smoke test: drives the real game in headless Chromium (Playwright) through the menus,
// every ability with every passive, a full run of 3 worlds × 3 levels with the three bosses, a death,
// and a phone-sized touch session. Fails on any page error.
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
  for (const m of ['codex', 'achievements', 'upgrades', 'loadout', 'runStart', 'help', 'pause']) {
    await ev((m) => NirykDebug.G.openMenu(m, { id: 'sylvar' }), m); await sleep(120);
    if (m === 'codex') for (const tab of ['q', 'm', 'b']) { await ev((t) => { NirykDebug.G.menu.tab = t; }, tab); await sleep(80); }
  }
  await ev(() => NirykDebug.G.openMenu('hero', { id: 'haldor' })); await sleep(120);
  await ev(() => { NirykDebug.N.save.crystals = 999; NirykDebug.G.openMenu('upgrades'); }); await sleep(100);
  await page.mouse.click(640, 560); await sleep(100); // buy button area
  await ev(() => NirykDebug.G.closeMenu());
  step('menus');

  // ---- every ability × passive in the training ground
  await ev(() => NirykDebug.setupTraining()); await sleep(300);
  await ev(() => { const { G, N } = NirykDebug; for (const id of Object.keys(N.ENEMIES)) N.save.codex.m[id] = 1; G.openMenu('training'); });
  await sleep(150); await ev(() => NirykDebug.G.openMenu('rack')); await sleep(150); await ev(() => NirykDebug.G.closeMenu());
  await ev(() => { NirykDebug.G.speed = 2; NirykDebug.G.godMode = true; });
  for (const hero of ['emberian', 'sylvar', 'kestrus', 'haldor']) {
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
    // the hero's weapons
    for (const w of await ev(() => Object.keys(NirykDebug.N.WEAPONS))) { await ev((w) => { const { G, N } = NirykDebug; G.p.form = null; G.p.weapons[G.p.wi] = w; G.p.atkCd = 0; N.attack(G.p); }, w); await sleep(40); }
    step('abilities ' + hero);
  }

  // ---- a full run
  await ev(() => { const { G, N } = NirykDebug; N.save.char = 'kestrus'; G.setupLobbyForTest = true; G.startRun(); });
  await sleep(900);
  await ev(() => { const G = NirykDebug.G; G.speed = 4; G.godMode = true; });
  for (let lvl = 0; lvl < 9; lvl++) {
    const info = await ev(() => { const G = NirykDebug.G; return { n: G.map.rooms.length, w: G.run.world, l: G.run.level }; });
    for (let i = 0; i < info.n; i++) {
      const t = await ev((i) => { const G = NirykDebug.G, r = G.map.rooms[i]; NirykDebug.teleportTo(r); G.p.y += 8; return r.type; }, i);
      if (t === 'enemy' || t === 'boss') {
        for (let k = 0; k < 80; k++) {
          await sleep(150);
          const st = await ev((i) => { const G = NirykDebug.G, r = G.map.rooms[i]; return { cleared: r.cleared, boss: !!G.boss, p2: G.boss && G.boss.p2 }; }, i);
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
    step(`level ${info.w + 1}-${info.l + 1} (${info.n} rooms)`);
    let done = 'no-portal';
    for (let k = 0; k < 40 && done === 'no-portal'; k++) {
      done = await ev(() => { const G = NirykDebug.G; if (G.menu && G.menu.type === 'result') return true; const p = G.portal; if (!p) return 'no-portal'; G.p.x = p.x; G.p.y = p.y; p.use(); return false; });
      if (done === 'no-portal') await sleep(100);
    }
    if (done === 'no-portal') { errors.push('no portal on level ' + lvl); break; }
    await sleep(900);
  }
  const res = await ev(() => { const G = NirykDebug.G; return G.menu && G.menu.type === 'result' ? G.menu.win : null; });
  if (res !== true) errors.push('run did not end in victory: ' + res);
  step('victory screen');
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
