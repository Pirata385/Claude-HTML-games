// Teste de fumaça: abre o jogo, cria um laboratório, escolhe uma cobaia, sintetiza, injeta e confere o console.
// Uso: node mutatrix/tests/smoke.mjs http://localhost:8765/mutatrix/index.html
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const url = process.argv[2] || 'http://localhost:8765/mutatrix/index.html';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 760 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(url);
await page.waitForTimeout(800);
await page.click('text=Novo laboratório');
await page.waitForTimeout(400);
await page.click('[data-act="pickHost"][data-id="rato"]');
await page.waitForTimeout(600);
for (const [i, theme] of [[0, 'igneo'], [1, 'musical']]) {
  await page.click(`[data-act="slot"][data-i="${i}"]`);
  await page.click(`[data-act="reagent"][data-theme="${theme}"]`);
}
await page.click('[data-act="synth"]');
await page.waitForTimeout(3200);
await page.click('[data-act="inject"]');
let phase = 'seq';
for (let k = 0; k < 60 && phase !== 'idle'; k++) { await page.waitForTimeout(500); phase = await page.evaluate(() => window.MX.Game.G.phase); }
const state = await page.evaluate(() => ({ doses: window.MX.Game.G.state.stats.inject, alive: !!window.MX.Game.G.state.subject }));
await browser.close();
if (errors.length || phase !== 'idle' || state.doses !== 1) {
  console.error('FALHOU', { phase, state, errors });
  process.exit(1);
}
console.log('ok', state);
