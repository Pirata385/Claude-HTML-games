#!/usr/bin/env node
// Browser check with Playwright (Chromium): loads the game from a local static server, plays
// through menus on desktop, phone portrait and phone landscape, simulates mouse and touch
// input, saves and reloads, switches language (PT/EN), runs and skips the first-run tutorial,
// checks the build menu's detail card and fullscreen, measures frame rate with a big horde and
// fails on console errors.
//   node tests/visual.js [outDir]      screenshots go to outDir (default: tests/screens)
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..', '..');
const OUT = path.resolve(process.argv[2] || path.join(__dirname, 'screens'));
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png' };

function serve() {
  const server = http.createServer((req, res) => {
    const url = decodeURIComponent(req.url.split('?')[0]);
    const file = path.join(ROOT, url.endsWith('/') ? url + 'index.html' : url);
    if (!file.startsWith(ROOT) || !fs.existsSync(file)) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((ok) => server.listen(0, () => ok(server)));
}

async function run() {
  fs.mkdirSync(OUT, { recursive: true });
  const server = await serve();
  const base = `http://localhost:${server.address().port}/ultima-barricada/index.html`;
  const browser = await chromium.launch();
  const errors = [];
  const results = {};

  async function open(name, opts) {
    const ctx = await browser.newContext(opts);
    const page = await ctx.newPage();
    page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.g/.test(m.text() + ((m.location() || {}).url || ''))) errors.push(`[${name}] ${m.text()}`); });
    page.on('pageerror', (e) => errors.push(`[${name}] ${e.message}`));
    await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
    await page.goto(base);
    await page.waitForSelector('#scrMain.show', { timeout: 30000 });
    return { ctx, page };
  }
  const shot = (page, n) => page.screenshot({ path: path.join(OUT, n + '.png') });
  // Starts a game; the first-run tutorial is skipped unless keepTutorial is set.
  async function startGame(page, seed, keepTutorial) {
    await page.click('#mNew');
    await page.fill('#nSeed', seed);
    await page.click('#nStart');
    await page.waitForFunction(() => window.UB && UB.App.inGame && !document.getElementById('hud').hidden, null, { timeout: 30000 });
    if (!keepTutorial) await skipTutorial(page);
    await page.waitForTimeout(600);
  }
  async function skipTutorial(page) {
    if (await page.isVisible('#tutorial [data-tut="skip"]')) await page.click('#tutorial [data-tut="skip"]');
  }
  // Fast-forward the simulation (as if time passed) without waiting in real time.
  const advance = (page, ticks) => page.evaluate((n) => { for (let i = 0; i < n; i++) UB.Game.tick(UB.App.S); }, ticks);

  // ---------- desktop ----------
  {
    const { ctx, page } = await open('desktop', { viewport: { width: 1280, height: 800 }, locale: 'pt-BR' });
    results.detectPt = (await page.textContent('#mNew')) === 'Novo jogo';
    await shot(page, '01-menu-desktop');
    await startGame(page, 'visual');
    await shot(page, '02-day-desktop');
    // Select a survivor by clicking on it, then right-click a tree to gather.
    const target = await page.evaluate(() => {
      const S = UB.App.S;
      const u = S.units[0];
      const p = UB.Render.w2s(u.x, u.y);
      const sz = UB.Render.size();
      const k = sz.scale / sz.dpr;
      const i = UB.Units.findNode(S, Math.floor(u.x), Math.floor(u.y), 'wood', 14);
      const tx = i % S.map.w, ty = (i / S.map.w) | 0;
      const q = UB.Render.w2s(tx + 0.5, ty + 0.5);
      return { ux: p.x * k, uy: (p.y - 10) * k, tx: q.x * k, ty: (q.y - 6) * k, id: u.id };
    });
    await page.mouse.click(target.ux, target.uy);
    results.selectedByClick = await page.evaluate(() => UB.App.sel.units.length);
    await page.mouse.click(target.tx, target.ty, { button: 'right' });
    results.orderAfterRightClick = await page.evaluate((id) => { const u = UB.World.get(UB.App.S, id); return u.order && u.order.type; }, target.id);
    // Build a wall line with the mouse (drag) through the build menu.
    await page.keyboard.press('b');
    await page.waitForSelector('#buildMenu:not([hidden])');
    await shot(page, '03-buildmenu-desktop');
    await page.click('[data-build="barricade"]');
    const line = await page.evaluate(() => {
      const S = UB.App.S, hq = UB.World.hq(S);
      const sz = UB.Render.size(), k = sz.scale / sz.dpr;
      const a = UB.Render.w2s(hq.tx - 3 + 0.5, hq.ty + 6 + 0.5), b = UB.Render.w2s(hq.tx + 4 + 0.5, hq.ty + 6 + 0.5);
      return { ax: a.x * k, ay: a.y * k, bx: b.x * k, by: b.y * k };
    });
    const before = await page.evaluate(() => UB.App.S.buildings.length);
    await page.mouse.move(line.ax, line.ay);
    await page.mouse.down();
    await page.mouse.move(line.bx, line.by, { steps: 8 });
    await page.mouse.up();
    results.barricadesPlaced = (await page.evaluate(() => UB.App.S.buildings.length)) - before;
    await page.mouse.click(line.bx, line.by, { button: 'right' });
    await advance(page, 400);
    await page.waitForTimeout(300);
    await shot(page, '04-building-desktop');
    // Night: skip the day and let the horde arrive.
    await page.evaluate(() => UB.Game.command(UB.App.S, { type: 'skipDay' }));
    await advance(page, 20 * 30 + 20 * 70);
    await page.waitForTimeout(400);
    await shot(page, '05-night-desktop');
    results.nightZombies = await page.evaluate(() => UB.App.S.zombies.length);
    // Save, reload the page, continue from the autosave/slot.
    await page.click('#btnMenu');
    await page.waitForSelector('#scrPause.show');
    await page.click('#pSave');
    await page.click('[data-s="save"][data-slot="2"]');
    const saved = await page.evaluate(() => ({ day: UB.App.S.day, tick: UB.App.S.tick, units: UB.App.S.units.length }));
    await page.reload();
    await page.waitForSelector('#scrMain.show', { timeout: 30000 });
    await page.click('#mLoad');
    await page.click('[data-s="load"][data-slot="2"]');
    await page.waitForFunction(() => UB.App.inGame);
    const loaded = await page.evaluate(() => ({ day: UB.App.S.day, tick: UB.App.S.tick, units: UB.App.S.units.length }));
    results.reloadMatches = loaded.day === saved.day && loaded.tick >= saved.tick && loaded.tick - saved.tick < 400 && loaded.units === saved.units;
    // Stress: hundreds of zombies on screen, measure frame rate.
    await page.evaluate(() => {
      const S = UB.App.S, hq = UB.World.hq(S);
      for (let i = 0; i < 350; i++) {
        const a = Math.random() * Math.PI * 2, r = 9 + Math.random() * 10;
        const x = hq.tx + 1.5 + Math.cos(a) * r, y = hq.ty + 1.5 + Math.sin(a) * r;
        const ix = UB.World.idx(S, Math.floor(x), Math.floor(y));
        if (!S._blockZ[ix]) UB.Zombies.spawn(S, i % 5 ? 'walker' : 'runner', x, y, { state: 'horde' });
      }
      S.map.explored.fill(1);
      UB.App.speed = 1;
    });
    results.fps = await page.evaluate(() => new Promise((ok) => {
      let n = 0; const t0 = performance.now();
      const f = () => { n++; if (performance.now() - t0 < 3000) requestAnimationFrame(f); else ok(Math.round(n / ((performance.now() - t0) / 1000))); };
      requestAnimationFrame(f);
    }));
    results.stressZombies = await page.evaluate(() => UB.App.S.zombies.length);
    await shot(page, '06-horde-desktop');
    await ctx.close();
  }

  // ---------- first-run tutorial, build details and fullscreen ----------
  {
    const { ctx, page } = await open('tutorial', { viewport: { width: 1280, height: 800 }, locale: 'pt-BR' });
    results.fullscreenButton = await page.isVisible('#mFull');
    await page.click('#mFull');
    await page.waitForTimeout(300);
    results.fullscreenOn = await page.evaluate(() => !!document.fullscreenElement && /Sair/.test(document.getElementById('mFull').textContent));
    await page.click('#mFull');
    await startGame(page, 'tutorial', true);
    const tut = () => page.evaluate(() => ({ on: UB.Tutorial.active, step: UB.Tutorial.STEPS[UB.Tutorial.step].id, t: UB.App.S.clock.t }));
    const t0 = await tut();
    await page.waitForTimeout(1200);
    const t1 = await tut();
    results.tutorialHoldsClock = t0.on && t0.step === 'welcome' && t1.t === t0.t;
    await shot(page, '02d-tutorial');
    await page.click('#tutorial [data-tut="next"]');
    await page.click('#tutorial [data-tut="next"]');
    // select -> gather -> build -> tower, each advancing on its own.
    await page.evaluate(() => UB.App.selectUnits([UB.App.S.units[0].id]));
    await page.waitForFunction(() => UB.Tutorial.STEPS[UB.Tutorial.step].id === 'gather');
    await page.evaluate(() => {
      const S = UB.App.S, u = S.units[0];
      const i = UB.Units.findNode(S, Math.floor(u.x), Math.floor(u.y), 'wood', 16);
      UB.Game.command(S, { type: 'gather', ids: [u.id], x: i % S.map.w, y: (i / S.map.w) | 0 });
    });
    await page.waitForFunction(() => UB.Tutorial.STEPS[UB.Tutorial.step].id === 'build');
    await page.keyboard.press('b');
    await page.waitForFunction(() => UB.Tutorial.STEPS[UB.Tutorial.step].id === 'tower');
    // Hovering a card shows its details before building.
    await page.hover('[data-build="mine"]');
    results.buildInfo = await page.evaluate(() => {
      const t = document.getElementById('bmInfo').innerText;
      return t.includes(UB.I18N.name('bld', 'mine')) && t.includes(UB.I18N.desc('bld', 'mine').slice(0, 20)) ? true : t;
    });
    await shot(page, '03b-build-info');
    await page.evaluate(() => {
      const S = UB.App.S, hq = UB.World.hq(S);
      for (let r = 3; r < 8; r++) for (let dx = -r; dx <= r; dx++) for (const dy of [-r, r]) {
        if (UB.Game.command(S, { type: 'build', build: 'tower', x: hq.tx + 1 + dx, y: hq.ty + 1 + dy }).ok) return;
      }
    });
    await page.waitForFunction(() => UB.Tutorial.STEPS[UB.Tutorial.step].id === 'loot');
    await page.click('#tutorial [data-tut="next"]');
    await page.click('#tutorial [data-tut="next"]');
    await page.click('#tutorial [data-tut="next"]');
    await page.waitForTimeout(800);
    const t2 = await tut();
    results.tutorialDone = !t2.on && t2.t > t1.t && (await page.evaluate(() => UB.App.settings.tutorialDone && !UB.App.S.tutorial));
    // A second game does not show it again.
    await page.click('#btnMenu');
    await page.click('#pQuit');
    await page.waitForSelector('#scrMain.show');
    await startGame(page, 'segunda', true);
    results.tutorialOnce = !(await page.evaluate(() => UB.Tutorial.active));
    await ctx.close();
  }

  // ---------- language: detection, switch, persistence, in-game text ----------
  {
    const { ctx, page } = await open('language', { viewport: { width: 1280, height: 800 }, locale: 'en-US' });
    results.detectEn = await page.evaluate(() => document.getElementById('mNew').textContent === 'New game' && document.title === 'Last Barricade' &&
      document.querySelector('#scrMain .title').innerText.replace(/\s+/g, ' ') === 'LAST BARRICADE');
    await shot(page, '01b-menu-english');
    await page.click('#mLang [data-lang="pt"]');
    results.switchPt = await page.evaluate(() => document.getElementById('mNew').textContent === 'Novo jogo' && document.documentElement.lang === 'pt-BR');
    await page.reload();
    await page.waitForSelector('#scrMain.show', { timeout: 30000 });
    results.persisted = (await page.textContent('#mNew')) === 'Novo jogo';
    await page.click('#mSettings');
    await page.click('[data-c="lang"][data-v="en"]');
    results.settingsEn = (await page.textContent('#scrSettings h2')) === 'Settings';
    await page.click('#scrSettings [data-back]');
    await startGame(page, 'english');
    await page.keyboard.press('b');
    await page.waitForSelector('#buildMenu:not([hidden])');
    await shot(page, '02b-build-english');
    await page.click('#bmClose');
    await page.evaluate(() => UB.App.selectUnits([UB.App.S.units[0].id]));
    await page.waitForTimeout(800);
    await shot(page, '02c-unit-english');
    results.hudEn = await page.evaluate(() => {
      const txt = document.getElementById('hud').innerText;
      return document.getElementById('clockDay').textContent === 'Day 1' && txt.includes('Return to base') &&
        !/Construir|sobreviventes|Voltar|Segurar|Esquadr|Todos|Ocioso|Dia \d/.test(txt) ? true : txt.slice(0, 400);
    });
    // Switching language mid-game redraws the HUD at once.
    await page.click('#btnMenu');
    await page.click('#pSettings');
    await page.click('[data-c="lang"][data-v="pt"]');
    results.midGamePt = await page.evaluate(() => ({ clock: document.getElementById('clockDay').textContent, all: document.querySelector('[data-sq="all"]').textContent }));
    results.midGamePt = results.midGamePt.clock === 'Dia 1' && results.midGamePt.all === 'Todos' ? true : results.midGamePt;
    await ctx.close();
  }

  // ---------- phone portrait (touch, English) ----------
  {
    const { ctx, page } = await open('portrait', { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true, locale: 'en-US' });
    await shot(page, '07-menu-portrait');
    await page.tap('#mNew');
    await page.fill('#nSeed', 'toque');
    await page.tap('#nStart');
    await page.waitForFunction(() => UB.App.inGame && !document.getElementById('hud').hidden, null, { timeout: 30000 });
    await page.waitForTimeout(500);
    await shot(page, '07b-tutorial-portrait');
    results.touchTutorialSkipped = await page.isVisible('#tutorial [data-tut="skip"]');
    await page.tap('#tutorial [data-tut="skip"]');
    results.touchTutorialSkipped = results.touchTutorialSkipped && !(await page.isVisible('#tutorial')) && (await page.evaluate(() => !UB.App.S.tutorial && UB.App.settings.tutorialDone));
    await shot(page, '08-day-portrait');
    // Tap a survivor, then tap the ground: a move order.
    const t = await page.evaluate(() => {
      const S = UB.App.S, u = S.units[1];
      const sz = UB.Render.size(), k = sz.scale / sz.dpr;
      const p = UB.Render.w2s(u.x, u.y), q = UB.Render.w2s(u.x + 2, u.y + 2);
      return { ux: p.x * k, uy: (p.y - 10) * k, gx: q.x * k, gy: q.y * k, id: u.id };
    });
    await page.touchscreen.tap(t.ux, t.uy);
    results.touchSelected = await page.evaluate(() => UB.App.sel.units.length);
    await shot(page, '09-selected-portrait');
    await page.touchscreen.tap(t.gx, t.gy);
    results.touchOrder = await page.evaluate((id) => { const u = UB.World.get(UB.App.S, id); return u.order && u.order.type; }, t.id);
    // Build via the panel, tap to place the ghost, confirm with ✓.
    await page.tap('[data-act="deselect"]');
    await page.tap('[data-act="openBuild"]');
    await page.tap('[data-tab="base"]');
    // First tap shows the details; the card's button starts placing it.
    await page.tap('[data-build="shelter"]');
    results.touchBuildInfo = await page.evaluate(() => document.getElementById('bmInfo').innerText.includes(UB.I18N.name('bld', 'shelter')) && !UB.App.mode);
    await shot(page, '09b-build-info-portrait');
    await page.tap('[data-build-go="shelter"]');
    const spot = await page.evaluate(() => {
      const S = UB.App.S, hq = UB.World.hq(S);
      const sz = UB.Render.size(), k = sz.scale / sz.dpr;
      for (let r = 4; r < 9; r++) for (let dx = -r; dx <= r; dx++) for (const dy of [-r, r]) {
        if (UB.Buildings.canPlace(S, 'shelter', hq.tx + 1 + dx, hq.ty + 1 + dy).ok) { const q = UB.Render.w2s(hq.tx + 1 + dx + 0.5, hq.ty + 1 + dy + 0.5); return { x: q.x * k, y: q.y * k }; }
      }
      return null;
    });
    const nb = await page.evaluate(() => UB.App.S.buildings.length);
    if (spot) { await page.touchscreen.tap(spot.x, spot.y); await shot(page, '10-place-portrait'); await page.tap('#placeOk'); }
    results.touchBuilt = (await page.evaluate(() => UB.App.S.buildings.length)) - nb;
    await advance(page, 300);
    await page.waitForTimeout(300);
    await shot(page, '11-after-portrait');
    await ctx.close();
  }

  // ---------- phone landscape ----------
  {
    const { ctx, page } = await open('landscape', { viewport: { width: 844, height: 390 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true, locale: 'pt-BR' });
    await page.tap('#mNew');
    await page.tap('#nStart');
    await page.waitForFunction(() => UB.App.inGame && !document.getElementById('hud').hidden, null, { timeout: 30000 });
    await page.waitForTimeout(300);
    await shot(page, '12a-tutorial-landscape');
    await page.tap('#tutorial [data-tut="skip"]');
    await page.evaluate(() => { const S = UB.App.S; UB.App.selectUnits(S.units.map((u) => u.id)); });
    await page.waitForTimeout(500);
    await shot(page, '12-landscape');
    await page.evaluate(() => UB.Game.command(UB.App.S, { type: 'skipDay' }));
    await advance(page, 20 * 40);
    await page.waitForTimeout(400);
    await shot(page, '13-dusk-landscape');
    await ctx.close();
  }

  // ---------- root menu card ----------
  {
    const ctx = await browser.newContext({ viewport: { width: 1100, height: 900 } });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(`[root] ${e.message}`));
    await page.goto(`http://localhost:${server.address().port}/index.html`);
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(OUT, '14-root-menu.png'), fullPage: true });
    await ctx.close();
  }

  await browser.close();
  server.close();
  console.log(JSON.stringify(results, null, 2));
  if (errors.length) { console.log('Console errors:\n' + errors.join('\n')); process.exit(1); }
  const fails = [];
  if (results.selectedByClick !== 1) fails.push('click did not select a survivor');
  if (results.orderAfterRightClick !== 'gather') fails.push('right-click on a tree did not order gathering');
  if (!(results.barricadesPlaced > 2)) fails.push('drag did not place a barricade line');
  if (!results.reloadMatches) fails.push('save/reload mismatch');
  if (results.touchSelected !== 1) fails.push('tap did not select');
  if (results.touchOrder !== 'move') fails.push('tap did not order a move');
  if (results.touchBuilt !== 1) fails.push('touch placement failed');
  if (!results.detectPt || !results.detectEn) fails.push('browser language not detected');
  if (!results.switchPt || !results.persisted || !results.settingsEn) fails.push('language switch or persistence failed');
  if (results.hudEn !== true) fails.push('HUD not in English: ' + results.hudEn);
  if (!results.fullscreenButton) fails.push('no fullscreen button');
  if (!results.tutorialHoldsClock) fails.push('tutorial did not start or hold the clock');
  if (!results.tutorialDone || !results.tutorialOnce) fails.push('tutorial did not finish properly or showed twice');
  if (results.buildInfo !== true) fails.push('build menu details missing: ' + results.buildInfo);
  if (!results.touchTutorialSkipped) fails.push('tutorial could not be skipped on touch');
  if (!results.touchBuildInfo) fails.push('first tap on a build card did not show its details');
  if (results.midGamePt !== true) fails.push('mid-game language switch did not redraw the HUD: ' + JSON.stringify(results.midGamePt));
  if (fails.length) { console.log('FAIL: ' + fails.join('; ')); process.exit(1); }
  console.log('Browser checks passed. Screenshots in ' + OUT);
}

run().catch((e) => { console.error(e); process.exit(1); });
