/* Teste de fumaça no navegador (Playwright + Chromium).
 * Uso: sirva a raiz do repositório (python3 -m http.server 8765) e rode: node planolandia/tests/smoke.js [url-base] [pasta-capturas]
 * Verifica: sem erros no console, título, novo jogo, andar, pular, deslizar na profundidade, golpear, chefão e toque. */
'use strict';
const { chromium, devices } = require('playwright');
const path = require('path');
const fs = require('fs');

const BASE = process.argv[2] || 'http://127.0.0.1:8765';
const OUT = process.argv[3] || path.join(__dirname, '..', '..', '.smoke');
fs.mkdirSync(OUT, { recursive: true });

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let failures = 0;
function check(cond, msg) { console.log((cond ? '  ok  ' : '  FALHOU ') + msg); if (!cond) failures++; }

async function hold(page, key, ms) { await page.keyboard.down(key); await wait(ms); await page.keyboard.up(key); }
const st = (page) => page.evaluate(() => PL.debug && PL.debug.state());

(async () => {
  const browser = await chromium.launch();
  const errors = [];
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

  console.log('menu da coleção');
  await page.goto(BASE + '/index.html');
  const card = await page.$('a.card[href="planolandia/index.html"]');
  check(!!card, 'card da Planolândia no menu da raiz');
  await page.screenshot({ path: path.join(OUT, '00-menu.png') });

  console.log('título');
  await page.goto(BASE + '/planolandia/index.html');
  await wait(1200);
  await page.screenshot({ path: path.join(OUT, '01-titulo.png') });
  await page.keyboard.press('Enter');
  await wait(400);
  await page.screenshot({ path: path.join(OUT, '02-titulo-menu.png') });

  console.log('nova partida (pela URL, direto na Chegada)');
  await page.goto(BASE + '/planolandia/index.html?room=borda_chegada');
  await wait(1500);
  let s = await st(page);
  check(s && s.room === 'borda_chegada', 'jogo carregou na Chegada');
  await page.screenshot({ path: path.join(OUT, '03-chegada.png') });
  const x0 = s.x;
  await hold(page, 'KeyD', 900);
  s = await st(page);
  check(s.x > x0 + 60, `andou para a direita (${x0.toFixed(0)} → ${s.x.toFixed(0)})`);
  await page.keyboard.down('Space'); await wait(120);
  const sj = await st(page);
  await page.keyboard.up('Space');
  check(sj.y < s.y - 5, 'pulou');
  await wait(600);
  const z0 = (await st(page)).z;
  const key0 = (await st(page)).sliceKey;
  await hold(page, 'KeyE', 600);
  s = await st(page);
  check(s.z > z0 + 20, `deslizou na profundidade (z ${z0.toFixed(0)} → ${s.z.toFixed(0)})`);
  check(s.sliceKey !== key0, 'a fatia desenhada mudou');
  await page.screenshot({ path: path.join(OUT, '04-profundidade.png') });

  console.log('esfera: passagem pela profundidade');
  await page.evaluate(() => PL.debug.setPos(470, 330, 80));
  await wait(200);
  await hold(page, 'KeyD', 1200);
  s = await st(page);
  check(s.x < 520, `a esfera bloqueia em z=80 (x=${s.x.toFixed(0)})`);
  await hold(page, 'KeyE', 1000);
  await hold(page, 'KeyD', 2000);
  s = await st(page);
  check(s.x > 700, `passou pela esfera mudando de fatia (x=${s.x.toFixed(0)}, z=${s.z.toFixed(0)})`);

  console.log('combate no Campo');
  await page.goto(BASE + '/planolandia/index.html?room=borda_campo&x=200&y=390&z=80&god=1');
  await wait(1200);
  const e0 = (await st(page)).enemies;
  for (let i = 0; i < 14; i++) { await hold(page, 'KeyD', 120); await page.keyboard.press('KeyJ'); await wait(120); }
  s = await st(page);
  check(s.enemies < e0 || s.geo > 0, `golpes acertaram (inimigos ${e0} → ${s.enemies}, geometria ${s.geo})`);
  await page.screenshot({ path: path.join(OUT, '05-campo.png') });

  console.log('chefão');
  await page.goto(BASE + '/planolandia/index.html?room=borda_arena&x=260&y=314&z=100&god=1');
  await wait(1000);
  await page.evaluate(() => PL.debug.closeDialog());
  await hold(page, 'KeyD', 400);
  await wait(2800);
  s = await st(page);
  check(s.boss && s.boss.state !== 'sleep', 'o Carcereiro acordou (' + (s.boss && s.boss.state) + ')');
  await page.screenshot({ path: path.join(OUT, '06-chefao.png') });
  const hp0 = s.boss.hp;
  for (let i = 0; i < 40; i++) {
    const b = await page.evaluate(() => { const g = PL.debug.game; return { x: g.boss.x, z: g.boss.core[2], px: g.player.x }; });
    await page.evaluate((b) => PL.debug.setPos(undefined, undefined, b.z), b);
    await page.keyboard.down(b.x > b.px ? 'KeyD' : 'KeyA'); await wait(60); await page.keyboard.up(b.x > b.px ? 'KeyD' : 'KeyA');
    await page.keyboard.down('KeyW'); await page.keyboard.press('Space'); await wait(120); await page.keyboard.press('KeyJ'); await page.keyboard.up('KeyW');
    await wait(120);
  }
  s = await st(page);
  check(s.boss && s.boss.hp < hp0, `o Carcereiro levou dano (${hp0} → ${s.boss && s.boss.hp})`);
  await page.screenshot({ path: path.join(OUT, '07-chefao-luta.png') });
  // derrota forçada para ver a planificação
  await page.evaluate(() => { const b = PL.debug.game.boss; b.hp = 1; b.invuln = false; b.hit(PL.debug.game, 5, 1, 0, {}); });
  await wait(5200);
  s = await st(page);
  await page.screenshot({ path: path.join(OUT, '08-planificado.png') });
  check(PL_flag(await page.evaluate(() => PL.debug.game.save.flags.boss_cubo)), 'chefão derrotado marcado no salvamento');

  const fps = (await st(page)).fps;
  check(fps >= 30, 'fps no desktop: ' + fps);

  console.log('celular (paisagem, toque)');
  const phone = await browser.newContext({ ...devices['iPhone 13 landscape'] });
  const mp = await phone.newPage();
  mp.on('pageerror', (e) => errors.push('mobile pageerror: ' + e.message));
  await mp.goto(BASE + '/planolandia/index.html?room=borda_degraus');
  await wait(1500);
  await mp.touchscreen.tap(300, 200);
  await wait(400);
  await mp.screenshot({ path: path.join(OUT, '09-celular.png') });
  const touchOn = await mp.evaluate(() => PL.Input.virt.active);
  check(touchOn, 'controles de toque ativos');

  check(errors.length === 0, 'sem erros no console' + (errors.length ? ':\n    ' + errors.slice(0, 8).join('\n    ') : ''));
  await browser.close();
  console.log(failures ? `\n${failures} verificação(ões) falharam` : '\ntudo certo');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });

function PL_flag(v) { return v === true; }
