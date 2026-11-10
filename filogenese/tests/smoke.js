/* Filogênese — teste de fumaça no navegador (Playwright). Uso: node tests/smoke.js
   Percorre menu → novo jogo → editor → jogo no desktop e num celular com toque, e falha se houver erro no console. */
'use strict';
const path = require('path');
const { chromium } = require('playwright');
const URL = 'file://' + path.join(__dirname, '..', 'index.html');
let failed = 0;
const ok = (cond, msg) => { if (!cond) { failed++; console.log('  FALHOU: ' + msg); } };

async function session(browser, name, opts, fn) {
  console.log('• ' + name);
  const ctx = await browser.newContext(Object.assign({ deviceScaleFactor: 1, locale: 'pt-BR' }, opts));
  const page = await ctx.newPage();
  const errs = [];
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(URL);
  await page.waitForTimeout(700);
  await fn(page, ctx);
  ok(errs.length === 0, 'erros no console: ' + errs.slice(0, 5).join(' | '));
  await ctx.close();
}
const ev = (page, fn, a) => page.evaluate(fn, a);

(async () => {
  const browser = await chromium.launch();

  await session(browser, 'desktop: campanha do menu ao jogo, telas e teclado', { viewport: { width: 1280, height: 720 } }, async (page) => {
    ok(await page.locator('#scr-menu .logo').isVisible(), 'menu visível');
    ok(await ev(page, () => FG.lang) === 'pt', 'idioma detectado: português');
    await page.locator('[data-act="new"]').click();
    await page.locator('[data-act="diet"][data-k="H"]').click();
    await page.locator('#ngName').fill('Smokius');
    await page.locator('#ngSeed').fill('7');   // mundo fixo: o teste não depende da sorte
    await page.locator('[data-act="go"]').click();
    await page.waitForSelector('#scr-editor', { timeout: 5000 });
    await page.waitForTimeout(500);
    await page.locator('[data-act="tab"][data-t="adorn"]').click();
    await page.locator('.part[data-id="d_topete"]').click();
    ok(await ev(page, () => document.querySelector('#edDna').textContent.includes('20')), 'orçamento desconta a parte (30 − 10)');
    await page.locator('.part.locked').first().click();   // parte bloqueada não equipa
    await page.locator('[data-act="tab"][data-t="skin"]').click();
    await page.locator('[data-act="rskin"]').click();
    await page.locator('[data-act="ok"]').click();
    await page.waitForFunction(() => window.FG && FG.Game.active && FG.UI.stack.length === 0, null, { timeout: 8000 });
    await page.waitForTimeout(900);
    const st = await ev(page, () => ({ name: FG.spName(FG.Game.playerSp), diet: FG.Game.playerSp.diet, adorn: FG.Game.playerSp.genome.parts.adorn, dna: FG.Game.dna, hud: !document.getElementById('hud').hidden, charm: FG.Game.player.stats.charm }));
    ok(st.name === 'Smokius' && st.diet === 'H' && st.adorn === 'd_topete' && st.dna === 20 && st.hud && st.charm === 1, 'criatura criada como no editor: ' + JSON.stringify(st));
    // andar
    const x0 = await ev(page, () => FG.Game.player.x);
    await page.keyboard.down('d'); await page.waitForTimeout(900); await page.keyboard.up('d');
    ok(await ev(page, () => FG.Game.player.x) > x0 + 40, 'andou com o teclado');
    // postura e habilidades
    await page.keyboard.press('q');
    ok(await ev(page, () => FG.Game.stance) === 'combat', 'trocou de postura');
    await page.keyboard.press('q');
    await page.keyboard.press('1'); await page.waitForTimeout(200);
    ok(await ev(page, () => FG.Game.player.anim && FG.Game.player.anim.name) === 'sing', 'cantou');
    // telas
    for (const [key, id] of [['m', 'map'], ['b', 'book'], ['h', 'help']]) {
      await page.keyboard.press(key); await page.waitForTimeout(250);
      ok(await page.locator('#scr-' + id).isVisible(), 'abriu ' + id);
      await page.keyboard.press('Escape'); await page.waitForTimeout(150);
    }
    await page.keyboard.press('Escape'); await page.waitForTimeout(250);
    ok(await page.locator('#scr-pause').isVisible(), 'pausa');
    const t0 = await ev(page, () => FG.Game.time);
    await page.waitForTimeout(400);
    ok(await ev(page, () => FG.Game.time) === t0, 'jogo parado durante a pausa');
    await page.locator('#scr-pause [data-act="settings"]').click();
    await page.locator('#scr-settings select[data-k="lang"]').selectOption('en');
    ok(await ev(page, () => FG.lang) === 'en' && (await page.locator('#scr-settings h2').textContent()) === 'Settings', 'troca de idioma ao vivo');
    await page.locator('#scr-settings select[data-k="lang"]').selectOption('pt');
    await page.locator('#scr-settings [data-tog="showFps"]').click();
    ok(await ev(page, () => FG.Settings.data.showFps && !document.getElementById('fps').hidden), 'alternância de configuração aplicada');
    await page.locator('#scr-settings [data-tog="showFps"]').click();
    await page.keyboard.press('Escape'); await page.keyboard.press('Escape'); await page.waitForTimeout(200);
    // clique para mirar
    const p = await ev(page, () => { const G = FG.Game, c = G.creatures.find((q) => !q.isPlayer && !q.dead && q.vis); if (!c) return null; const s = FG.Render.toScreen(c.x, c.y); return { x: s.x, y: s.y }; });
    if (p) { await page.mouse.click(p.x, p.y); await page.waitForTimeout(250); ok(await ev(page, () => !!FG.Game.target), 'clique mira uma criatura'); }
    // salvar e voltar ao menu
    await page.keyboard.press('Escape'); await page.locator('#scr-pause [data-act="save"]').click(); await page.waitForTimeout(200);
    ok(await ev(page, () => !!FG.Game.slotInfo(0)), 'save gravado');
    await page.keyboard.press('Escape'); await page.locator('#scr-pause [data-act="menu"]').click(); await page.locator('#scr-confirm [data-act="yes"]').click();
    await page.waitForSelector('#scr-menu [data-act="cont"]', { timeout: 5000 });
    await page.locator('#scr-menu [data-act="cont"]').click();
    await page.waitForFunction(() => FG.Game.active && FG.UI.stack.length === 0, null, { timeout: 8000 });
    ok(await ev(page, () => FG.spName(FG.Game.playerSp)) === 'Smokius', 'continuar carrega o save');
  });

  await session(browser, 'celular (toque, paisagem): direcional, botões e alvo', { viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true }, async (page, ctx) => {
    await page.locator('[data-act="new"]').tap();
    await page.locator('#ngSeed').fill('7');
    await page.locator('[data-act="go"]').tap();
    await page.waitForSelector('#scr-editor', { timeout: 5000 });
    await page.waitForTimeout(400);
    await page.locator('[data-act="ok"]').tap();
    await page.waitForFunction(() => window.FG && FG.Game.active && FG.UI.stack.length === 0, null, { timeout: 8000 });
    await page.waitForTimeout(900);
    ok(await ev(page, () => document.body.classList.contains('touch') && FG.Render.quality !== 'high'), 'modo toque e qualidade móvel');
    // direcional virtual por eventos de toque reais (CDP)
    const cdp = await ctx.newCDPSession(page);
    const x0 = await ev(page, () => FG.Game.player.x);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 120, y: 280, id: 1 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 190, y: 280, id: 1 }] });
    await page.waitForTimeout(900);
    ok(await ev(page, () => !document.getElementById('joy').hidden), 'direcional aparece');
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.waitForTimeout(100);
    ok(await ev(page, () => FG.Game.player.x) > x0 + 40, 'direcional move a criatura');
    ok(await ev(page, () => document.getElementById('joy').hidden), 'direcional some ao soltar');
    // botões de ação
    await page.locator('#btnStance').tap(); await page.waitForTimeout(100);
    ok(await ev(page, () => FG.Game.stance) === 'combat', 'botão de postura');
    await page.locator('#btnStance').tap();
    await page.locator('#abRow .ab').nth(1).tap(); await page.waitForTimeout(150);
    // dança na hora ou, havendo alguém ao alcance, anda até ele para dançar
    ok(await ev(page, () => (FG.Game.player.anim && FG.Game.player.anim.name === 'dance') || !!FG.Game.auto), 'botão de habilidade');
    await page.locator('#btnSneak').tap();
    ok(await ev(page, () => FG.Input.sneakTog), 'botão de agachar');
    await page.locator('#btnSneak').tap();
    // toque numa criatura mira
    const p = await ev(page, () => { const G = FG.Game, c = G.creatures.find((q) => !q.isPlayer && !q.dead && q.vis); if (!c) return null; const s = FG.Render.toScreen(c.x, c.y); return { x: s.x, y: s.y }; });
    if (p && p.x > 40 && p.x < 640 && p.y > 60 && p.y < 330) { await page.touchscreen.tap(p.x, p.y); await page.waitForTimeout(250); ok(await ev(page, () => !!FG.Game.target), 'toque mira uma criatura'); }
    await page.locator('#btnPause').tap(); await page.waitForTimeout(200);
    ok(await page.locator('#scr-pause').isVisible(), 'pausa pelo botão');
  });

  await browser.close();
  console.log(failed ? `\n${failed} falha(s)` : '\ntudo certo');
  process.exit(failed ? 1 : 0);
})();
