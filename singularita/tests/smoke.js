// End-to-end smoke test in a real browser (Playwright + Chromium).
// Run from the singularita folder: node tests/smoke.js   (screenshots go to the OS temp folder)
// It serves the repository root itself, so the menu link and the game are tested as players reach them.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
let playwright;
try { playwright = require('playwright'); } catch { playwright = require(path.join(execSync('npm root -g').toString().trim(), 'playwright')); }
const { chromium } = playwright;

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SHOTS = fs.mkdtempSync(path.join(os.tmpdir(), 'singularita-smoke-'));
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml' };

const server = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  const file = path.join(ROOT, url.endsWith('/') ? url + 'index.html' : url);
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const BASE = `http://localhost:${server.address().port}`;

let failures = 0;
const check = (cond, msg) => { console.log(`${cond ? 'ok  ' : 'FAIL'} ${msg}`); if (!cond) failures++; };
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });

async function open(url, ctxOpts = { viewport: { width: 1280, height: 720 } }) {
  const ctx = await browser.newContext(ctxOpts);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(url);
  return { ctx, page, errors };
}
const waitGame = (page) => page.waitForFunction(() => window.__SG && window.__SG.zone && document.getElementById('loading').hidden, null, { timeout: 60000 });
// Runs `body` in the page with helpers that step the simulation directly (independent of frame rate).
const sim = (page, body) => page.evaluate(`(async () => {
  const g = window.__SG;
  const step = (n) => { for (let i = 0; i < n; i++) { g.update(1 / 30); g.input.endFrame(); } };
  const tap = (a, n = 2) => { g.input.press(a); step(n); g.input.release(a); step(1); };
  const hold = (a, n) => { g.input.press(a); step(n); g.input.release(a); step(1); };
  const goNear = (x, z) => { const p = g.player; p.x = x; p.z = z; p.y = p.ry = g.grid.height(Math.floor(x), Math.floor(z)); };
  ${body}
})()`);

try {
  // 1. The root menu lists the game.
  {
    const { ctx, page, errors } = await open(`${BASE}/index.html`);
    const card = await page.locator('a.card[href="singularita/index.html"]').count();
    check(card === 1, 'root menu has the Singularita card');
    check(!errors.length, `root menu loads without errors ${errors.join(' | ')}`);
    await ctx.close();
  }

  // 2. Create a character through the title screen and play the opening loop.
  {
    const { ctx, page, errors } = await open(`${BASE}/singularita/index.html?debug`);
    await page.locator('.title-buttons .btn', { hasText: 'New Character' }).click();
    await page.fill('.name-input', 'Smoke');
    await page.locator('.class-card[data-cls="archer"]').click();
    await page.locator('.btn', { hasText: 'Begin' }).click();
    await waitGame(page);
    await page.screenshot({ path: path.join(SHOTS, 'island_day.png') });
    const r = await sim(page, `
      g.ui.closeDialog && g.ui.closeDialog();
      const z = g.zone, p = g.player, out = {};
      g.godMode = true; // this run checks systems, not survival
      out.objective0 = g.objectives.current.id;
      const nearest = (f) => z.nodes.filter((n) => f(n) && !g.profile.zones.island.nodes[n.id]).sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z))[0];
      for (let k = 0; k < 20 && (g.profile.inv.stacks.wood || 0) < 8; k++) { const n = nearest((n) => n.node.startsWith('tree')); goNear(n.x + 1.3, n.z); p.yaw = Math.atan2(n.x - p.x, n.z - p.z); for (let s = 0; s < 12; s++) { tap('interact'); step(14); } }
      out.wood = g.profile.inv.stacks.wood;
      const f = z.base.stations.forge; goNear(f.x + 2, f.z + 1.5); step(3);
      g.ui.openMenu('craft', { atForge: true }); g.ui.craftState.cat = 'tools'; g.ui.renderMenu();
      [...document.querySelectorAll('.recipe')].find((x) => x.textContent.includes('Wood Pickaxe')).click();
      [...document.querySelectorAll('.detail .btn.primary')].find((b) => b.textContent === 'Craft').click();
      out.pickaxe = g.profile.inv.items.some((i) => i.id === 'pickaxe_wood');
      g.ui.closeMenu();
      for (let k = 0; k < 12 && (g.profile.inv.stacks.stone || 0) < 8; k++) { const n = nearest((n) => n.node === 'boulder'); goNear(n.x + 1.3, n.z); p.yaw = Math.atan2(n.x - p.x, n.z - p.z); for (let s = 0; s < 10; s++) { tap('interact'); step(14); } }
      out.stone = g.profile.inv.stacks.stone;
      out.objective = g.objectives.current.id;
      // Fight: spawn a group in front and shoot.
      g.profile.level = 12; g.recomputeStats(); g.player.hp = g.stats.maxHp;
      goNear(z.base.x, z.base.z + 26); g.cam.snapBehind(0); p.yaw = 0;
      let kills = 0; g.bus.on('kill', () => kills++);
      for (const [k, id] of ['slime', 'slime', 'spitter_slime'].entries()) g.enemies.spawn(id, p.x - 1 + k, p.z + 5, { level: 3, noIntro: true });
      for (let t = 0; t < 40; t++) { hold('attack', 10); if (t % 8 === 0) tap('skill1'); }
      out.kills = kills;
      // Attributes.
      const pts = g.profile.attrPoints;
      g.ui.openMenu('character'); document.querySelector('.attr .btn.small').click(); g.ui.closeMenu();
      out.spent = pts - g.profile.attrPoints;
      // Two simulated minutes of the endless horde: no waves, fixed levels, within the cap.
      let waveEvents = 0; g.bus.on('waveStart', () => waveEvents++);
      g.profile.playTime = Math.max(g.profile.playTime, 300);
      let most = 0;
      for (let k = 0; k < 120; k++) { step(30); most = Math.max(most, g.enemies.count((e) => e.horde)); }
      const band = (e) => { const [lo, hi] = WAVES_LEVELS[e.def.family === 'zombie' ? 'night' : 'day']; return e.level >= lo && e.level <= hi; };
      out.horde = { waveEvents, most, target: Math.max(8, 11), levelsOk: g.enemies.list.filter((e) => e.horde).every(band), n: g.enemies.count((e) => e.horde) };
      out.enemies = g.enemies.count(); out.cap = g.enemies.cap;
      out.stats = g.r.stats();
      // The boss clock: when it runs out, the boss of the current phase appears, and the clock restarts.
      const lvl = g.profile.level; g.profile.level = 20;
      g.spawner.bossClock.timer = 0.5; step(30);
      const boss = g.spawner.boss;
      out.boss = { id: boss?.def.id, period: boss?.def.period, phase: g.dayNight.phase, timer: g.spawner.bossClock.timer, level: boss?.members[0].level };
      step(30 * 20);
      out.boss.paused = g.spawner.bossClock.timer === out.boss.timer;
      if (boss) { for (const m of boss.members) { m.alive = false; m.dyingT = 0; } g.spawner.boss = null; }
      g.profile.level = lvl;
      return out;`.replace('WAVES_LEVELS', JSON.stringify({ day: [1, 10], night: [4, 14] })));
    check(r.objective0 === 'o_wood', 'tutorial starts with gathering wood');
    check(r.wood >= 6, `chopping trees gives wood (${r.wood})`);
    check(r.pickaxe, 'Wood Pickaxe crafted through the Forge menu');
    check(r.stone >= 8, `mining boulders gives stone (${r.stone})`);
    check(r.objective === 'o_weapon', `objectives advance (${r.objective})`);
    check(r.kills >= 2, `combat kills creatures (${r.kills})`);
    check(r.spent === 1, 'attribute points can be spent');
    check(r.enemies <= r.cap, `creature count within cap (${r.enemies}/${r.cap})`);
    check(r.horde.waveEvents === 0 && r.horde.n > 0 && r.horde.most <= r.horde.target, `endless horde: no waves, ${r.horde.n} creatures, never above ${r.horde.target} (${r.horde.most})`);
    check(r.horde.levelsOk, 'horde creatures keep the fixed island levels');
    check(r.boss.id && r.boss.period === r.boss.phase && r.boss.timer >= 480, `boss clock spawns the ${r.boss.phase} boss and restarts (${r.boss.id}, next in ${Math.round(r.boss.timer)} s, level ${r.boss.level})`);
    check(r.boss.paused, 'the boss clock waits while a boss is abroad');
    check(r.stats.calls < 250 && r.stats.triangles < 400000, `render budget (calls ${r.stats.calls}, triangles ${r.stats.triangles})`);
    await page.screenshot({ path: path.join(SHOTS, 'island_combat.png') });

    // 3. Caves, layer gates, transitions and saving.
    const c = await sim(page, `
      const out = {};
      g.player.hp = g.stats.maxHp;
      const geo0 = g.r.stats().geometries;
      const cm = g.zone.caveMouth; goNear(cm.x + 1, cm.z + 1); step(3);
      tap('interact'); await new Promise((r) => setTimeout(r, 900)); step(3);
      out.zone1 = g.zone.id;
      const ex = g.zone.exit; goNear(ex.x + 0.6, ex.z); step(3);
      g.profile.level = 5; tap('interact'); await new Promise((r) => setTimeout(r, 900)); step(3);
      out.gated = g.zone.id;
      g.profile.level = 8; goNear(ex.x + 0.6, ex.z); step(3); tap('interact'); await new Promise((r) => setTimeout(r, 900)); step(3);
      out.zone2 = g.zone.id;
      step(30 * 20);
      out.caveEnemies = g.enemies.count();
      g.enterZone('cave_4'); step(30 * 10); out.hazards = g.zone.hazards.length;
      g.enterZone('island'); g.enterZone('cave_1'); g.enterZone('island');
      out.geo = [geo0, g.r.stats().geometries];
      g.enterZone('cave_2');
      const poi = g.zone.pois[0]; goNear(poi.x + 1.2, poi.z); step(3); tap('interact'); step(2);
      g.ui.closeDialog && g.ui.closeDialog();
      out.lore = g.profile.lore.slice();
      out.saved = g.save('smoke');
      return out;`);
    check(c.zone1 === 'cave_1', 'cave mouth leads to layer 1');
    check(c.gated === 'cave_1', 'layer 2 is gated by level');
    check(c.zone2 === 'cave_2', 'layer 2 opens at level 8');
    check(c.caveEnemies > 0, `caves are populated (${c.caveEnemies})`);
    check(c.geo[1] <= c.geo[0] + 2, `no geometry leak across zone changes (${c.geo.join(' → ')})`);
    check(c.lore.length >= 1, 'Echo Stones record lore');
    check(c.saved, 'game saves');
    await page.screenshot({ path: path.join(SHOTS, 'cave.png') });

    // 4. Bosses: phases, the split, the pillar stun and rewards.
    const b = await sim(page, `
      g.enterZone('island'); g.godMode = true; g.profile.level = 30; g.recomputeStats();
      const out = {}, ev = [];
      for (const e of ['bossPhase', 'bossDefeated']) g.bus.on(e, (x) => ev.push(e + ':' + (x.phase ? x.phase.name : x.def.id)));
      for (const [id, clock, arena] of [['slime_prince', 100, 'glade'], ['silverback_emperor', 800, 'crater']]) {
        g.dayNight.clock = clock;
        const a = g.zone.arenas[arena]; goNear(a.x + 5, a.z);
        const boss = g.spawner.spawnBoss(id, false); step(20);
        for (let n = 0; n < 5000 && boss.group.members.some((m) => m.alive); n++) {
          if (n % 15 === 0) for (const m of boss.group.members) if (m.alive) g.combat.hit(m, { mult: 40 });
          if (n % 30 === 0) for (const e of g.enemies.active) if (e.alive && !e.boss) g.combat.hit(e, { mult: 40 });
          step(1);
        }
        out[id] = boss.group.defeated;
      }
      g.godMode = false;
      out.events = ev; out.items = g.profile.inv.items.map((i) => i.id);
      return out;`);
    check(b.slime_prince && b.silverback_emperor, 'both bosses can be defeated');
    check(b.events.includes('bossPhase:Royal Division') && b.events.includes('bossPhase:Enraged'), 'boss phases trigger');
    check(b.items.includes('princes_crown') && b.items.includes('emperors_knuckle'), 'first kills drop the boss uniques');
    check(!errors.length, `no console errors in play ${errors.slice(0, 3).join(' | ')}`);

    // 5. Reload the page (same browser storage): Continue restores the saved game.
    await page.goto(`${BASE}/singularita/index.html?debug`);
    await page.locator('.title-buttons .btn.primary', { hasText: 'Continue' }).click();
    await waitGame(page);
    const back = await sim(page, `return { zone: g.zone.id, lore: g.profile.lore.length, name: g.profile.name, pick: g.profile.inv.items.some((i) => i.id === 'pickaxe_wood'), bosses: Object.keys(g.profile.stats.bosses).length };`);
    check(back.name === 'Smoke' && back.pick && back.lore >= 1 && back.bosses === 2, `Continue restores the save (${JSON.stringify(back)})`);
    check(!errors.length, 'reload without errors');
    await ctx.close();
  }

  // 5b. Regressions: the Prince resets whole after a split, hit flashes wear off, the Altar arms a new class.
  {
    const { ctx, page, errors } = await open(`${BASE}/singularita/index.html?quickstart=swordsman&debug`);
    await waitGame(page);
    const r = await sim(page, `
      g.ui.closeDialog && g.ui.closeDialog();
      g.godMode = true; g.profile.level = 30; g.recomputeStats(); g.dayNight.clock = 100;
      const a = g.zone.arenas.glade; goNear(a.x + 4, a.z);
      const b = g.spawner.spawnBoss('slime_prince', false); step(20);
      const full = b.maxHp;
      for (let n = 0; n < 3000 && b.group.members.length < 2; n++) { if (n % 15 === 0) g.combat.hit(b, { mult: 30 }); step(1); }
      const split = b.group.members.length;
      goNear(g.zone.base.x, g.zone.base.z); step(30 * 10);
      const out = { split, members: b.group.members.filter((m) => m.alive).length, hpFull: b.alive && b.hp === full && b.maxHp === full };
      b.flash = 1; step(30); g.render(0.1);
      out.flashCleared = b.rig.parts.every((pp) => pp.mesh.material === pp.mesh.userData.baseMat);
      const before = g.profile.classId;
      g.ui.altar();
      [...document.querySelectorAll('#dialog .btn')].find((x) => x.textContent === 'Become Mage').click();
      out.mageArmed = g.profile.classId === 'mage' && g.profile.equipment.mage && g.profile.equipment.mage.weapon != null;
      // Teleports must never leave anyone stuck inside a tree or a wall.
      const tree = g.zone.nodes.find((n) => n.node.startsWith('tree'));
      g.player.x = tree.x; g.player.z = tree.z; step(5);
      const F = 256;
      out.playerFree = !g.grid.has(Math.floor(g.player.x), Math.floor(g.player.z), F);
      const e = g.enemies.spawn('zombie_walker', tree.x + 3, tree.z, { level: 1, noIntro: true });
      e.x = tree.x; e.z = tree.z; step(5);
      out.enemyFree = !g.grid.has(Math.floor(e.x), Math.floor(e.z), F);
      // First-time hints are recorded once.
      g.dayNight.clock = 719.9; step(10);
      out.hints = g.profile.hints.slice();
      return out;`);
    check(r.split === 2 && r.members === 1 && r.hpFull, `Prince resets whole after a split (${JSON.stringify(r)})`);
    check(r.flashCleared, 'boss hit flash wears off');
    check(r.mageArmed, 'switching class at the Altar arms the new class');
    check(r.playerFree && r.enemyFree, `nobody stays stuck inside an obstacle (${r.playerFree}, ${r.enemyFree})`);
    check(r.hints.includes('night'), `first-time hints are shown and recorded (${r.hints.join(',')})`);
    check(!errors.length, `regressions: no errors ${errors.slice(0, 2).join(' | ')}`);
    await ctx.close();
    const t = await open(`${BASE}/singularita/index.html`);
    await t.page.locator('.title-buttons .btn', { hasText: 'Settings' }).click();
    await t.page.locator('.binds .btn.key').first().click();
    await t.page.keyboard.press('KeyZ');
    const bound = await t.page.locator('.binds .btn.key').first().textContent();
    check(bound === 'KeyZ', `key rebinding works from the title screen (${bound})`);
    await t.ctx.close();
  }

  // 6. Every class can fight with every skill.
  for (const cls of ['swordsman', 'archer', 'mage', 'assassin', 'stardust']) {
    const { ctx, page, errors } = await open(`${BASE}/singularita/index.html?quickstart=${cls}&debug`);
    await waitGame(page);
    const r = await sim(page, `
      g.ui.closeDialog && g.ui.closeDialog();
      g.profile.level = 45; g.setupClass(); g.player.hp = g.stats.maxHp; g.player.res = g.stats.resourceMax;
      // This checks the class kit, so the island horde stays out of the fight.
      g.spawner.horde.timer = 1e9; g.enemies.clear();
      const p = g.player; goNear(g.zone.base.x, g.zone.base.z + 26); g.cam.snapBehind(0); p.yaw = 0;
      let kills = 0; g.bus.on('kill', () => kills++);
      const used = new Set(); g.bus.on('skill', (e) => used.add(e.id));
      for (let k = 0; k < 5; k++) g.enemies.spawn(['slime', 'zombie_walker', 'great_slime', 'zombie_runner', 'mender_slime'][k], p.x - 2 + k, p.z + 3 + (k % 2) * 2, { level: 8, noIntro: true });
      if (g.profile.classId === 'stardust') tap('alt');
      const hb = g.profile.hotbars[g.profile.classId];
      for (let t = 0; t < 60; t++) { hold('attack', 8); if (t % 5 === 0) for (let s = 1; s <= 4; s++) tap('skill' + s); }
      return { kills, used: [...used], hp: p.hp > 0 };`);
    check(r.kills >= 2 && r.used.length >= 4, `${cls}: fights (kills ${r.kills}, skills ${r.used.join(',')})`);
    check(!errors.length, `${cls}: no errors ${errors.slice(0, 2).join(' | ')}`);
    await page.screenshot({ path: path.join(SHOTS, `class_${cls}.png`) });
    await ctx.close();
  }

  // 7. Touch: portrait and landscape.
  for (const [name, viewport] of [['portrait', { width: 390, height: 844 }], ['landscape', { width: 844, height: 390 }]]) {
    const { ctx, page, errors } = await open(`${BASE}/singularita/index.html?quickstart=mage&debug`, { viewport, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
    await waitGame(page);
    const r = await page.evaluate(() => {
      const g = window.__SG;
      g.ui.closeDialog && g.ui.closeDialog();
      const root = document.getElementById('touch');
      const fire = (type, x, y, id, target) => { const t = new Touch({ identifier: id, target, clientX: x, clientY: y }); target.dispatchEvent(new TouchEvent(type, { touches: type === 'touchend' ? [] : [t], changedTouches: [t], bubbles: true, cancelable: true })); };
      const x0 = g.player.x, z0 = g.player.z, mz = root.querySelector('.t-move');
      fire('touchstart', 60, innerHeight - 100, 1, mz); fire('touchmove', 60, innerHeight - 170, 1, mz);
      for (let i = 0; i < 40; i++) { g.update(1 / 30); g.input.endFrame(); }
      fire('touchend', 60, innerHeight - 170, 1, mz);
      const atk = root.querySelector('.tb.atk'), b = atk.getBoundingClientRect();
      fire('touchstart', b.x + 8, b.y + 8, 2, atk); const pressed = g.input.isDown('attack'); fire('touchend', b.x + 8, b.y + 8, 2, atk);
      return { visible: !root.hidden, moved: Math.hypot(g.player.x - x0, g.player.z - z0), pressed, inView: b.right <= innerWidth && b.bottom <= innerHeight };
    });
    check(r.visible && r.moved > 2 && r.pressed && r.inView, `touch ${name}: stick moves (${r.moved.toFixed(1)} m) and buttons work`);
    // Real taps hit-test like a finger: the HUD buttons and the gather prompt must sit above the touch layer.
    const hud = await page.evaluate(() => [...document.querySelectorAll('#hud .hbtn')].map((b) => {
      const q = b.getBoundingClientRect(), x = q.x + q.width / 2, y = q.y + q.height / 2;
      return { x, y, top: document.elementFromPoint(x, y) === b, title: b.title };
    }));
    check(hud.length === 4 && hud.every((b) => b.top), `touch ${name}: HUD buttons are on top of the touch layer`);
    // Full screen: the ⛶ button flips it either way (the first tap may already have entered it).
    const isFs = () => page.evaluate(() => !!document.fullscreenElement);
    // Measured before each tap: the layout can shift when the browser bars go away.
    const tapFs = async () => {
      const b = await page.evaluate(() => { const q = document.querySelector('#hud .hbtn.fs').getBoundingClientRect(); return { x: q.x + q.width / 2, y: q.y + q.height / 2 }; });
      await page.touchscreen.tap(b.x, b.y);
      await page.waitForTimeout(400);
    };
    // Let the first-tap automatic full screen (if any) settle before measuring.
    await page.waitForTimeout(500);
    const fs0 = await isFs();
    await tapFs();
    const fs1 = await isFs();
    await tapFs();
    const fs2 = await isFs();
    check(fs1 !== fs0 && fs2 === fs0, `touch ${name}: the ⛶ button toggles full screen (${fs0} → ${fs1} → ${fs2})`);
    const setText = await page.evaluate(() => { const g = window.__SG; g.ui.openMenu('settings'); const t = document.getElementById('menu').innerText; g.ui.closeMenu(); return t; });
    check(/Full screen on phones and tablets/.test(setText), `touch ${name}: full screen can be set in Settings`);
    for (const [prefix, tab] of [['Crafting', 'craft'], ['Menu', 'inventory']]) {
      const b = hud.find((x) => x.title.startsWith(prefix));
      await page.touchscreen.tap(b.x, b.y);
      const m = await page.evaluate(() => { const g = window.__SG; const o = { open: g.ui.menuOpen, lock: !!g.lockTarget }; g.ui.closeMenu(); return o; });
      check(m.open === tab && !m.lock, `touch ${name}: tapping ${prefix} opens it (${m.open})`);
    }
    const tree = await page.evaluate(() => {
      const g = window.__SG, p = g.player;
      g.godMode = true;
      const st = g.profile.zones[g.zone.id].nodes;
      let best = null, bd = Infinity;
      g.zone.nodes.forEach((n, i) => { if (!n.node.startsWith('tree') || st[n.id]) return; const d = Math.hypot(n.x - p.x, n.z - p.z); if (d < bd && g.grid.walkable(n.i - 2, n.j) && g.grid.walkable(n.i - 1, n.j)) { bd = d; best = i; } });
      const n = g.zone.nodes[best];
      p.x = n.x - 1.5; p.z = n.z; p.y = p.ry = g.grid.height(Math.floor(p.x), Math.floor(p.z));
      p.yaw = Math.atan2(n.x - p.x, n.z - p.z); g.cam.snapBehind(p.yaw);
      for (let i = 0; i < 6; i++) { g.update(1 / 30); g.render(1 / 30); g.input.endFrame(); }
      const q = document.querySelector('#hud .prompt').getBoundingClientRect();
      return { index: best, x: q.x + q.width / 2, y: q.y + q.height / 2, label: document.querySelector('#hud .prompt').textContent, hidden: g.view.nodes.hidden.has(best), wood: g.profile.inv.stacks.wood || 0 };
    });
    check(!tree.hidden, `touch ${name}: the tree in front of you stays visible`);
    const back = await page.evaluate((i) => {
      const g = window.__SG, nv = g.view.nodes, n = g.zone.nodes[i], p = g.player;
      const scaleOf = () => { const [m, k] = nv.slots[i].parts[0]; const a = nv.meshes[m].instanceMatrix.array; return Math.hypot(a[k * 16], a[k * 16 + 1], a[k * 16 + 2]); };
      nv.occlude(n.x - (p.x - n.x) * 2, n.z - (p.z - n.z) * 2, p.x, p.z); // the camera swings round: the tree is in the way
      const hidden = scaleOf();
      nv.occlude(p.x - (n.x - p.x) * 4, p.z - (n.z - p.z) * 4, p.x, p.z); // and back behind the player
      return { hidden, back: scaleOf() };
    }, tree.index);
    check(back.hidden === 0 && back.back > 0, `touch ${name}: a tree hidden for the camera comes back (${back.hidden} → ${back.back.toFixed(2)})`);
    for (let k = 0; k < 14; k++) { await page.touchscreen.tap(tree.x, tree.y); await page.waitForTimeout(450); }
    const wood = await page.evaluate(() => window.__SG.profile.inv.stacks.wood || 0);
    check(wood > tree.wood, `touch ${name}: tapping the prompt (${tree.label}) chops wood (${tree.wood} → ${wood})`);
    check(!errors.length, `touch ${name}: no errors`);
    await page.screenshot({ path: path.join(SHOTS, `touch_${name}.png`) });
    await ctx.close();
  }

  // 8. Milestone 2: the four isles, their phenomena, the Core gate and the Core layer.
  {
    const { ctx, page, errors } = await open(`${BASE}/singularita/index.html?quickstart=swordsman&debug`);
    await waitGame(page);
    const settle = () => page.evaluate(() => { const g = window.__SG; g.cam.snapBehind(g.player.yaw); for (let i = 0; i < 60; i++) g.render(1 / 30); });
    for (const id of ['isle_air', 'isle_water', 'isle_fire', 'isle_earth']) {
      const r = await sim(page, `
        g.ui.closeDialog && g.ui.closeDialog(); g.godMode = true;
        g.profile.level = 90; g.recomputeStats();
        g.enterZone('${id}'); step(60);
        return { id: g.zone.id, alive: g.player.alive };`);
      await settle();
      const stats = await page.evaluate(() => window.__SG.r.stats());
      await page.screenshot({ path: path.join(SHOTS, `${id}.png`) });
      check(r.id === id && r.alive, `${id}: loads and plays`);
      check(stats.calls < 250 && stats.triangles < 400000, `${id}: render budget (calls ${stats.calls}, triangles ${stats.triangles})`);
    }
    const ph = await sim(page, `
      const out = {}, p = g.player;
      // An updraft vent carries you to its partner.
      g.enterZone('isle_air');
      const u = g.zone.updrafts[0];
      goNear(u.x, u.z); p.grounded = true; step(3);
      out.flying = !!p.carried;
      step(30 * 3);
      out.landed = Math.hypot(p.x - u.to.x, p.z - u.to.z); out.grounded = p.grounded && !p.carried;
      // The tide: high water floods the sandbars and drags you ashore; pearl beds wait for low water.
      g.enterZone('isle_water');
      const z = g.zone, gr = g.grid, F = { WATER: 2, DEEP: 512 };
      g.profile.playTime = 0; step(20);
      const bar = z.tidal.find((k) => gr.h[k] === 2 && gr.walkable(k % gr.w, Math.floor(k / gr.w)) && !(gr.flags[k] & F.WATER));
      goNear((bar % gr.w) + 0.5, Math.floor(bar / gr.w) + 0.5);
      g.profile.playTime = 62; step(20);
      out.barFlooded = !!(gr.flags[bar] & F.DEEP);
      out.dragged = !gr.has(Math.floor(p.x), Math.floor(p.z), F.DEEP) && Math.hypot(p.x - ((bar % gr.w) + 0.5), p.z - (Math.floor(bar / gr.w) + 0.5)) > 0.5;
      out.waterHigh = g.zone.tideLevel;
      const pearl = z.nodes.find((n) => n.node === 'pearl_bed');
      goNear(pearl.x + 1.2, pearl.z); p.yaw = Math.atan2(pearl.x - p.x, pearl.z - p.z);
      out.pearlHigh = g.interaction.scan()?.label;
      g.profile.playTime = 0; step(20);
      goNear(pearl.x + 1.2, pearl.z); p.yaw = Math.atan2(pearl.x - p.x, pearl.z - p.z);
      out.pearlLow = g.interaction.scan()?.label;
      // Lava burns.
      g.enterZone('isle_fire');
      const lk = g.grid.flags.findIndex((f) => f & 8192);
      goNear((lk % g.grid.w) + 0.5, Math.floor(lk / g.grid.w) + 0.5); p.grounded = true;
      g.godMode = false; p.hp = g.stats.maxHp; step(30);
      out.lavaHurts = p.hp < g.stats.maxHp; out.burning = p.statuses.has('burn');
      g.godMode = true; p.hp = g.stats.maxHp; p.statuses.clear();
      return out;`);
    check(ph.flying && ph.landed < 1.5 && ph.grounded, `air: an updraft carries you to the partner vent (${ph.landed.toFixed(2)} m off)`);
    check(ph.barFlooded && ph.dragged, `water: high tide floods the sandbar and drags you ashore (level ${ph.waterHigh})`);
    check(/tide/i.test(ph.pearlHigh || '') && !/tide/i.test(ph.pearlLow || 'x'), `water: pearl beds wait for low tide (${ph.pearlHigh} / ${ph.pearlLow})`);
    check(ph.lavaHurts && ph.burning, 'fire: lava burns');
    const core = await sim(page, `
      const out = {};
      g.profile.level = 110; g.recomputeStats();
      for (const s of ['sigil_wind', 'sigil_tide', 'sigil_flame', 'sigil_stone']) g.profile.inv.stacks[s] = 1;
      g.enterZone('cave_7');
      const ex = g.zone.exit; goNear(ex.x + 3, ex.z); step(3);
      g.interaction.readGate();
      document.querySelector('#dialog .btn.primary').click();
      out.open = !!g.profile.flags.gateOpen;
      g.interaction.readGate();
      await new Promise((r) => setTimeout(r, 1200)); step(3);
      out.zone = g.zone.id; out.exit = g.zone.exit.type;
      step(30 * 10);
      out.alive = g.player.alive; out.enemies = g.enemies.count();
      return out;`);
    await settle();
    await page.screenshot({ path: path.join(SHOTS, 'cave_8.png') });
    check(core.open && core.zone === 'cave_8' && core.exit === 'heart', `the sigils open the gate to the Core (${core.zone})`);
    check(core.enemies > 0, `the Core is populated (${core.enemies})`);
    const menus = await page.evaluate(() => {
      const g = window.__SG, out = {};
      g.ui.openMenu('map'); out.map = document.getElementById('menu').innerText;
      g.ui.openMenu('journal'); [...document.querySelectorAll('#menu .stab')].find((b) => b.textContent === 'Bosses').click(); out.journal = document.getElementById('menu').innerText;
      g.ui.openMenu('inventory'); [...document.querySelectorAll('#menu .stab')].find((b) => b.textContent === 'Materials').click(); out.inv = document.getElementById('menu').innerText;
      g.ui.closeMenu();
      return out;
    });
    check(/Galeforge Spires/.test(menus.map) && /Ronin of the East Wind keeps/.test(menus.map) && /Dawn and Dusk Hollows/.test(menus.map), 'the map lists the isles, their guardians and the Core');
    check(/Guards The Galeforge Spires/.test(menus.journal), 'the journal knows where the guardians wait');
    check(/Key items/.test(menus.inv) && /Sigil of Wind/.test(menus.inv), 'sigils show as key items');
    const horizon = await sim(page, `g.enterZone('island'); step(3); return !!g.view.horizon;`);
    await settle();
    await page.screenshot({ path: path.join(SHOTS, 'horizon.png') });
    check(horizon, 'Dawnreach shows the isles on the horizon');
    check(!errors.length, `isles: no errors ${errors.slice(0, 3).join(' | ')}`);
    await ctx.close();
  }

  // 9. Milestone 2 creatures and the isle guardians.
  {
    const { ctx, page, errors } = await open(`${BASE}/singularita/index.html?quickstart=swordsman&debug`);
    await waitGame(page);
    const settle = () => page.evaluate(() => { const g = window.__SG; clearTimeout(g.ui.combatDialog); g.ui.closeDialog && g.ui.closeDialog(); g.cam.snapBehind(g.player.yaw); for (let i = 0; i < 90; i++) g.render(1 / 30); });
    const cr = await sim(page, `
      g.ui.closeDialog && g.ui.closeDialog(); g.godMode = true;
      g.profile.level = 100; g.recomputeStats();
      g.enterZone('isle_earth'); step(30 * 20);
      // The isle keeps its own creatures, at its own levels.
      const table = g.zoneDef.enemies.map((e) => e.id), band = g.zoneDef.band;
      const pop = g.enemies.list.filter((e) => e.alive && !e.boss && !e.summoned);
      const out = { pop: pop.length, own: pop.every((e) => table.includes(e.def.id)), levels: pop.every((e) => e.level >= band[0] && e.level <= band[1]) };
      // Every new creature spawns, moves, fights and renders.
      g.enemies.clear(); g.spawner.boss = null; g.spawner.popT = 1e9;
      const ids = ['gale_harpy', 'kite_serpent', 'cloud_sprite', 'storm_wisp', 'reef_crab', 'siren', 'drowned_sailor', 'glass_jelly', 'lava_hound', 'obsidian_golem',
        'fire_imp', 'ash_shaman', 'mossback_tortoise', 'root_lasher', 'burrowing_mole', 'stone_wisp', 'dawn_sentinel', 'dusk_stalker', 'echo_knight'];
      const p = g.player; let n = 0;
      ids.forEach((id, k) => { const a = (k / ids.length) * Math.PI * 2; if (g.enemies.spawn(id, p.x + Math.cos(a) * 7, p.z + Math.sin(a) * 7, { level: 85, noIntro: true })) n++; });
      const shot = []; g.bus.on('sfx', (e) => { if (e.id === 'enemyShoot') shot.push(1); });
      for (let k = 0; k < 10; k++) { step(30); g.render(1 / 30); }
      out.spawned = n; out.total = ids.length; out.shots = shot.length;
      return out;`);
    await settle();
    await page.screenshot({ path: path.join(SHOTS, 'm2_creatures.png') });
    check(cr.pop > 0 && cr.own && cr.levels, `isles keep their own creatures at their own levels (${cr.pop})`);
    check(cr.spawned === cr.total && cr.shots > 0, `every new creature spawns and fights (${cr.spawned}/${cr.total}, ${cr.shots} shots)`);
    for (const [isle, id, sigil] of [['isle_air', 'ronin_east_wind', 'sigil_wind'], ['isle_water', 'tears_of_poseidon', 'sigil_tide'], ['isle_fire', 'magma_vector', 'sigil_flame'], ['isle_earth', 'allele_golem', 'sigil_stone']]) {
      const a = await sim(page, `
        g.ui.closeDialog && g.ui.closeDialog();
        const out = {}, p = g.player;
        g.profile.world.guardians = {};
        delete g.profile.inv.stacks['${sigil}'];
        g.profile.playTime = Math.max(g.profile.playTime, 1000);
        g.enterZone('${isle}'); step(3);
        const boss = g.spawner.boss;
        out.present = !!boss && boss.def.id === '${id}';
        if (!boss) return out;
        const ar = g.zone.arena; goNear(ar.x, ar.z + 4); p.grounded = true; p.yaw = Math.PI; step(30 * 3);
        out.engaged = boss.engaged;
        return out;`);
      await settle();
      await page.screenshot({ path: path.join(SHOTS, `guardian_${id}.png`) });
      check(a.present && a.engaged, `${id}: waits in its arena and engages`);
      if (!a.present) continue;
      const r = await sim(page, `
        const out = {}, p = g.player, boss = g.spawner.boss;
        const phases = []; g.bus.on('bossPhase', (e) => { if (e.def.id === '${id}') phases.push(e.phase.name); });
        for (let k = 0; k < 90 && boss.members.some((m) => m.alive); k++) {
          for (const m of boss.members) if (m.alive) g.combat.applyRaw(m, m.maxHp * 0.035, 'dmg');
          step(12); p.hp = g.stats.maxHp;
        }
        out.defeated = boss.defeated; out.phases = phases;
        out.sigil = g.profile.inv.stacks['${sigil}'] || 0;
        // Once the guardian returns, a second victory does not give the sigil again.
        step(30 * 3); g.ui.closeDialog && g.ui.closeDialog();
        g.profile.playTime += 601;
        g.enterZone('island'); g.enterZone('${isle}'); step(3);
        const again = g.spawner.boss; out.returns = !!again && again.def.id === '${id}';
        if (again) for (let k = 0; k < 90 && again.members.some((m) => m.alive); k++) { for (const m of again.members) if (m.alive) g.combat.applyRaw(m, m.maxHp * 0.12, 'dmg'); step(6); p.hp = g.stats.maxHp; }
        out.sigilAfter = g.profile.inv.stacks['${sigil}'] || 0;
        step(30 * 3); g.ui.closeDialog && g.ui.closeDialog();
        return out;`);
      check(r.defeated && r.phases.length >= 2, `${id}: fights through its phases (${(r.phases || []).join(', ')})`);
      check(r.sigil === 1 && r.returns && r.sigilAfter === 1, `${id}: the sigil comes once (${r.sigil} then ${r.sigilAfter}) and the guardian returns`);
    }
    check(!errors.length, `creatures and guardians: no errors ${errors.slice(0, 3).join(' | ')}`);
    await ctx.close();
  }

  // 10. Milestone 3: emblems, portals and dimension runs.
  {
    const { ctx, page, errors } = await open(`${BASE}/singularita/index.html?quickstart=swordsman&debug`);
    await waitGame(page);
    const settle = () => page.evaluate(() => { const g = window.__SG; clearTimeout(g.ui.combatDialog); g.ui.closeDialog && g.ui.closeDialog(); g.cam.snapBehind(g.player.yaw); for (let i = 0; i < 90; i++) g.render(1 / 30); });
    const r = await sim(page, `
      g.ui.closeDialog && g.ui.closeDialog(); g.godMode = true;
      g.profile.level = 200; g.recomputeStats();
      const out = {}, p = g.player;
      // An emblem opens a portal in front of you; stepping through starts a run.
      for (const id of ['emblem_dungeon', 'emblem_twins', 'emblem_king', 'emblem_mirror', 'emblem_dragons']) g.profile.inv.stacks[id] = 2;
      const home = { x: p.x, z: p.z };
      g.useConsumable('emblem_dungeon'); step(3);
      out.portal = !!g.portal && g.portal.dim === 'dim_dungeon';
      out.emblemUsed = g.profile.inv.stacks.emblem_dungeon === 1;
      g.interaction.enterPortal(); await new Promise((r) => setTimeout(r, 1200)); step(3);
      out.inDungeon = g.zone.id === 'dim_dungeon' && !!g.profile.run && g.profile.run.floor === 1;
      out.stairLocked = g.zone.exit.locked === true;
      out.warden = g.enemies.list.some((e) => e.alive && e.def.keyCarrier);
      // The Warden carries the key; with it, the stair leads down.
      const w = g.enemies.list.find((e) => e.alive && e.def.keyCarrier);
      if (w) g.combat.applyRaw(w, w.maxHp * 2, 'dmg');
      step(10);
      out.unlocked = g.zone.exit.locked === false;
      g.interaction.descend(); await new Promise((r) => setTimeout(r, 1200)); step(3);
      out.floor2 = g.profile.run?.floor === 2 && g.zone.floor === 2;
      // Leaving by the stair banks the run and brings you home.
      g.zone.exit.locked = false;
      g.interaction.leaveRun('leave'); await new Promise((r) => setTimeout(r, 1200)); step(3);
      out.home = g.zone.id === 'island' && Math.hypot(p.x - home.x, p.z - home.z) < 6 && !g.profile.run;
      out.best = g.profile.dims.dim_dungeon.bestFloor;
      return out;`);
    check(r.portal && r.emblemUsed, 'an emblem opens a portal and is used up');
    check(r.inDungeon && r.stairLocked && r.warden, 'the portal starts a run in the Endless Dungeon, stair locked, Warden waiting');
    check(r.unlocked && r.floor2, 'the Warden\'s key opens the stair to floor 2');
    check(r.home && r.best === 2, `leaving brings you home and keeps the best floor (${r.best})`);
    for (const dim of ['dim_twins', 'dim_king', 'dim_mirror', 'dim_dragons']) {
      const d = await sim(page, `
        const out = {};
        g.useConsumable('${dim.replace('dim_', 'emblem_')}'); step(3);
        g.interaction.enterPortal(); await new Promise((r) => setTimeout(r, 1200)); step(30 * 3);
        out.zone = g.zone.id; out.enemies = g.enemies.count(); out.alive = g.player.alive;
        if ('${dim}' === 'dim_twins') {
          const lever = g.zone.levers[0], gate = g.zone.gates.find((x) => x.id === lever.gate);
          g.interaction.pullLever(lever); step(3);
          out.gateOpen = gate.open && !g.grid.has(gate.cells[0] % g.grid.w, Math.floor(gate.cells[0] / g.grid.w), 256);
        }
        return out;`);
      await settle();
      await page.screenshot({ path: path.join(SHOTS, `${dim}.png`) });
      check(d.zone === dim && d.alive && d.enemies > 0, `${dim}: the portal leads there and it is populated (${d.enemies})`);
      if (dim === 'dim_twins') check(d.gateOpen, 'twins: a lever opens a gate in the other lane');
      // Dying ends the run.
      const f = await sim(page, `g.godMode = false; g.combat.hurt(g.player, 1e9, null, { type: 'hazard' }); step(30 * 2); const dead = !g.player.alive; g.respawn(); step(3); g.godMode = true; g.ui.closeDialog && g.ui.closeDialog(); document.querySelector('.death')?.setAttribute('hidden', ''); return { dead, zone: g.zone.id, run: g.profile.run };`);
      check(f.dead && f.zone === 'island' && !f.run, `${dim}: dying ends the run`);
    }
    // Each dimension's own rule.
    const rules = await sim(page, `
      const out = {}, p = g.player;
      const enter = async (dim) => { g.useConsumable(dim.replace('dim_', 'emblem_')); step(3); g.interaction.enterPortal(); await new Promise((r) => setTimeout(r, 1200)); step(3); };
      const leave = async () => { g.interaction.leaveRun('leave'); await new Promise((r) => setTimeout(r, 1200)); step(3); };
      // Twins: kill one of a pair alone and it comes back; kill both together and they stay down.
      await enter('dim_twins');
      g.enemies.clear(); g.spawner.boss = null; g.spawner.popT = 1e9;
      const a = g.enemies.spawn('twin_slime', p.x + 4, p.z, { level: 115, noIntro: true });
      const b = a && g.dimRules.twinOf(a);
      out.paired = !!b && g.dimRules.twinOf(b) === a;
      g.combat.applyRaw(a, a.maxHp * 2, 'dmg'); step(30 * 4);
      out.revived = g.enemies.list.filter((e) => e.alive && e.def.id === 'twin_slime').length === 2;
      const [c1, c2] = g.enemies.list.filter((e) => e.alive && e.def.id === 'twin_slime');
      g.combat.applyRaw(c1, c1.maxHp * 2, 'dmg'); g.combat.applyRaw(c2, c2.maxHp * 2, 'dmg'); step(30 * 4);
      out.stayDown = g.enemies.list.filter((e) => e.alive && e.def.id === 'twin_slime').length === 0;
      await leave();
      // King: corrupted ground fills the meter; a brazier cleanses it.
      await enter('dim_king');
      const gr = g.grid;
      const ck = gr.flags.findIndex((f, k) => (f & 32768) && gr.walkable(k % gr.w, Math.floor(k / gr.w)));
      goNear((ck % gr.w) + 0.5, Math.floor(ck / gr.w) + 0.5); step(30 * 4);
      out.corrupted = p.corruption > 30;
      const br = g.zone.braziers[0]; goNear(br.x + 1.5, br.z); step(30 * 3);
      out.cleansed = p.corruption < 5;
      await leave();
      // Mirrored: the reflection follows your mirrored steps; both on the plates open the gate.
      await enter('dim_mirror');
      const z = g.zone, N = gr.w, pl = z.plates[0];
      out.reflection = !!g.dimRules.reflection;
      goNear(pl.left.x, pl.left.z); step(30 * 4);
      const rf = g.dimRules.reflection;
      out.mirrored = rf && Math.abs(rf.x - (g.grid.w - p.x)) < 1.2 && Math.abs(rf.z - p.z) < 1.2;
      out.gate = z.gates.find((x) => x.id === pl.gate).open;
      await leave();
      // Roost: the breath burns the open plateau, but not behind a rock.
      await enter('dim_dragons');
      g.enemies.clear(); g.spawner.boss = null; g.spawner.popT = 1e9; g.dimRules.breathT = 1e9;
      g.godMode = false;
      const rock = g.zone.rocks[0];
      p.hp = g.stats.maxHp; goNear(rock.x - 2.5, rock.z); g.dimRules.breathAt(rock.x + 12, rock.z); step(30 * 3);
      out.sheltered = p.hp === g.stats.maxHp;
      p.hp = g.stats.maxHp; goNear(rock.x - 2.5, rock.z); g.dimRules.breathAt(rock.x - 2.5, rock.z + 12); step(30 * 3);
      out.burned = p.alive && p.hp < g.stats.maxHp;
      g.godMode = true; p.hp = g.stats.maxHp;
      await leave();
      // The five Fracture Shards open the Heart Seal into the Singular Heart.
      for (const s of ['shard_gaol', 'shard_twins', 'shard_crown', 'shard_mirror', 'shard_dragon']) g.profile.inv.stacks[s] = 1;
      g.profile.flags.gateOpen = true; g.profile.level = 220;
      g.enterZone('cave_8'); step(3);
      g.interaction.readHeart();
      document.querySelector('#dialog .btn.primary').click();
      await new Promise((r) => setTimeout(r, 1200)); step(30 * 2);
      out.heart = g.zone.id === 'cave_9' && g.zone.exit.type === 'core' && g.zone.nodes.some((n) => n.node === 'ore_singularita');
      return out;`);
    check(rules.paired && rules.revived && rules.stayDown, `twins: a lone kill revives, a pair kill stays down (${JSON.stringify(rules)})`);
    check(rules.corrupted && rules.cleansed, 'king: corruption builds on adamite and a brazier cleanses it');
    check(rules.reflection && rules.mirrored && rules.gate, 'mirrored: the reflection mirrors you, and both plates open the gate');
    check(rules.sheltered && rules.burned, 'roost: dragon breath burns the open, not behind a rock');
    check(rules.heart, 'the five shards open the Heart Seal into the Singular Heart, where Singularita grows');
    await settle();
    await page.screenshot({ path: path.join(SHOTS, 'cave_9.png') });
    check(!errors.length, `dimensions: no errors ${errors.slice(0, 3).join(' | ')}`);
    await ctx.close();
  }

  // 11. Milestone 3: the five rulers of the dimensions.
  {
    const { ctx, page, errors } = await open(`${BASE}/singularita/index.html?quickstart=swordsman&debug`);
    await waitGame(page);
    const settle = () => page.evaluate(() => { const g = window.__SG; clearTimeout(g.ui.combatDialog); g.ui.closeDialog && g.ui.closeDialog(); g.cam.snapBehind(g.player.yaw); for (let i = 0; i < 90; i++) g.render(1 / 30); });
    await sim(page, `g.ui.closeDialog && g.ui.closeDialog(); g.godMode = true; g.profile.level = 220; g.recomputeStats(); for (const id of ['emblem_dungeon', 'emblem_twins', 'emblem_king', 'emblem_mirror', 'emblem_dragons']) g.profile.inv.stacks[id] = 3; return 1;`);
    for (const [dim, boss, shard] of [['dim_dungeon', 'iron_jailer', 'shard_gaol'], ['dim_twins', 'siamese', 'shard_twins'], ['dim_king', 'adamite_king', 'shard_crown'], ['dim_mirror', 'you', 'shard_mirror'], ['dim_dragons', 'ragnarok', 'shard_dragon']]) {
      const a = await sim(page, `
        g.ui.closeDialog && g.ui.closeDialog();
        const out = {}, p = g.player;
        delete g.profile.inv.stacks['${shard}'];
        // Open each portal from the camp's arrival point, facing open ground.
        g.enterZone('island'); step(3); p.yaw = g.zone.spawnYaw ?? Math.PI;
        g.useConsumable('${dim.replace('dim_', 'emblem_')}'); step(3);
        out.portal = !!g.portal;
        g.interaction.enterPortal(); await new Promise((r) => setTimeout(r, 1200)); step(3);
        // The Jailer waits on the fifth floor.
        if ('${dim}' === 'dim_dungeon') { g.profile.run.floor = 5; g.enterZone('dim_dungeon'); step(3); }
        const boss = g.spawner.boss;
        out.present = !!boss && boss.def.id === '${boss}';
        if (!boss) return out;
        g.enemies.list.filter((e) => !e.boss).forEach((e) => { e.alive = false; e.dyingT = 0; }); g.spawner.popT = 1e9;
        const ar = g.zone.arena; goNear(ar.x, ar.z + 5); p.grounded = true; p.yaw = Math.PI; step(30 * 3);
        out.engaged = boss.engaged;
        // Step just outside the arena: the ruler keeps to its arena instead of following you out.
        const fx = ar.x + ar.r + 6, fz = ar.z;
        if (g.grid.walkable(Math.floor(fx), Math.floor(fz))) {
          let far = 0;
          for (let k = 0; k < 30 * 4; k++) { goNear(fx, fz); step(1); for (const m of boss.members) far = Math.max(far, Math.hypot(m.x - ar.x, m.z - ar.z) - ar.r); }
          out.staysIn = far <= 0.5;
          goNear(ar.x, ar.z + 5); step(3);
        } else out.staysIn = true;
        return out;`);
      await settle();
      await page.screenshot({ path: path.join(SHOTS, `ruler_${boss}.png`) });
      check(a.present && a.engaged, `${boss}: rules its dimension and engages (${JSON.stringify(a)})`);
      check(a.staysIn, `${boss}: keeps to its arena when you step out`);
      if (!a.present) { await sim(page, `g.interaction.leaveRun('leave'); await new Promise((r) => setTimeout(r, 1200)); return 1;`); continue; }
      const r = await sim(page, `
        const out = {}, p = g.player, boss = g.spawner.boss;
        const phases = []; g.bus.on('bossPhase', (e) => { if (e.def.id === '${boss}' && !phases.includes(e.phase.name)) phases.push(e.phase.name); });
        for (let k = 0; k < 120 && boss.members.some((m) => m.alive); k++) {
          for (const m of boss.members) if (m.alive) g.combat.applyRaw(m, m.maxHp * 0.03, 'dmg');
          step(12); p.hp = g.stats.maxHp; p.corruption = 0;
        }
        out.defeated = boss.defeated; out.phases = phases;
        out.shard = g.profile.inv.stacks['${shard}'] || 0;
        out.exit = !!g.portalOut;
        step(30 * 2); g.ui.closeDialog && g.ui.closeDialog();
        g.interaction.leaveRun('complete'); await new Promise((r) => setTimeout(r, 1200)); step(3);
        out.home = g.zone.type !== 'dimension' && !g.profile.run;
        out.cleared = g.profile.dims['${dim}'].cleared;
        return out;`);
      check(r.defeated && r.phases.length >= 2, `${boss}: fights through its phases (${(r.phases || []).join(', ')})`);
      check(r.shard === 1 && r.exit && r.home && r.cleared >= 1, `${boss}: gives its Fracture Shard, opens the way home and clears the run`);
    }
    // The Siamese merge for good when one twin falls, or when both are worn to half; that form must fall.
    {
      const m = await sim(page, `
        g.ui.closeDialog && g.ui.closeDialog();
        const out = {}, p = g.player;
        const fresh = async () => {
          if (g.profile.run) { g.interaction.leaveRun('leave'); await new Promise((r) => setTimeout(r, 1200)); }
          g.enterZone('island'); step(3); p.yaw = g.zone.spawnYaw ?? Math.PI;
          g.useConsumable('emblem_twins'); step(3);
          g.interaction.enterPortal(); await new Promise((r) => setTimeout(r, 1200)); step(3);
          g.enemies.list.filter((e) => !e.boss).forEach((e) => { e.alive = false; e.dyingT = 0; }); g.spawner.popT = 1e9;
          const ar = g.zone.arena; goNear(ar.x, ar.z + 5); p.grounded = true; step(30);
          return g.spawner.boss;
        };
        let b = await fresh();
        // While a ruler is engaged, the dimension sends no more creatures into the fight.
        g.spawner.popT = 0; step(30 * 20);
        out.calm = g.enemies.count((e) => !e.boss && e.alive) === 0;
        const sum = b.members.reduce((a, t) => a + t.maxHp, 0);
        g.combat.applyRaw(b.members[0], b.members[0].maxHp * 2, 'dmg'); step(10);
        let u = b.members.filter((x) => x.alive);
        out.oneFell = { n: u.length, merged: !!u[0]?.merged, half: Math.abs((u[0]?.maxHp || 0) - sum * 0.5) < 2, defeated: b.defeated };
        g.combat.applyRaw(u[0], u[0].maxHp * 2, 'dmg'); step(10);
        out.won = b.defeated && (g.profile.inv.stacks.shard_twins || 0) > 0;
        g.interaction.leaveRun('complete'); await new Promise((r) => setTimeout(r, 1200));
        b = await fresh();
        for (const t of b.members.slice()) g.combat.applyRaw(t, t.maxHp * 0.55, 'dmg');
        step(10);
        u = b.members.filter((x) => x.alive);
        out.bothHalf = { n: u.length, merged: !!u[0]?.merged, defeated: b.defeated };
        // Walk far off: the fight resets and the twins stand apart again, whole.
        const ar = g.zone.arena;
        for (let k = 0; k < 30 * 10; k++) { goNear(g.zone.spawn.x, g.zone.spawn.z); step(1); }
        u = b.members.filter((x) => x.alive);
        out.reset = { n: u.length, merged: u.some((x) => x.merged), full: u.every((x) => x.hp === x.maxHp), far: Math.hypot(g.zone.spawn.x - ar.x, g.zone.spawn.z - ar.z) > ar.r + 14 };
        g.interaction.leaveRun('leave'); await new Promise((r) => setTimeout(r, 1200));
        return out;`);
      check(m.oneFell.n === 1 && m.oneFell.merged && m.oneFell.half && !m.oneFell.defeated, `siamese: when one twin falls they merge into one, at half their joined health (${JSON.stringify(m.oneFell)})`);
      check(m.won, 'siamese: bringing down the merged form wins the fight');
      check(m.calm, 'rulers: no creatures join while a ruler is engaged');
      check(m.bothHalf.n === 1 && m.bothHalf.merged && !m.bothHalf.defeated, `siamese: both worn to half, they merge (${JSON.stringify(m.bothHalf)})`);
      check(m.reset.n === 2 && !m.reset.merged && m.reset.full && m.reset.far, `siamese: a reset parts them again, whole (${JSON.stringify(m.reset)})`);
    }
    check(!errors.length, `rulers: no errors ${errors.slice(0, 3).join(' | ')}`);
    await ctx.close();
  }

  // 12. Milestone 3: Singularita's shape memory, the Collapse and Chromantite.
  {
    const { ctx, page, errors } = await open(`${BASE}/singularita/index.html?quickstart=swordsman&debug`);
    await waitGame(page);
    const r = await page.evaluate(async () => {
      const g = window.__SG, p = g.player, out = {};
      g.ui.closeDialog && g.ui.closeDialog(); g.godMode = true;
      g.profile.level = 260; g.recomputeStats();
      // A Singularita blade, at the Forge.
      const f = g.zone.base.stations.forge;
      p.x = f.x + 1.5; p.z = f.z + 1.5;
      const uid = g.profile.inv.nextUid++;
      g.profile.inv.items.push({ uid, id: 'swordsman_weapon_singularita' });
      g.ui.openMenu('inventory');
      [...document.querySelectorAll('#menu .cell')].find((c) => c.textContent.includes('Singularita'))?.click();
      const sel = [...document.querySelectorAll('#menu .memory select')];
      out.panel = sel.length === 2;
      document.querySelector('#menu .btn.primary')?.click(); // Equip
      [...document.querySelectorAll('#menu .cell')].find((c) => c.textContent.includes('Singularita'))?.click();
      const sel2 = [...document.querySelectorAll('#menu .memory select')];
      sel2[0].value = 'ember'; sel2[0].dispatchEvent(new Event('change'));
      sel2[1].value = 'rime'; sel2[1].dispatchEvent(new Event('change'));
      document.querySelector('#menu .memory .btn').click();
      out.memory = g.profile.memory.swordsman_weapon_singularita?.join(',');
      out.burn = g.stats.burnChance > 0 && g.stats.chillChance > 0;
      out.collapse = g.stats.collapse;
      g.ui.closeMenu();
      // Twelve hits make a Collapse.
      let collapses = 0; const orig = g.combat.collapseAt.bind(g.combat); g.combat.collapseAt = (...a) => { collapses++; return orig(...a); };
      const e = g.enemies.spawn('gel_knight', p.x + 2, p.z, { level: 200, noIntro: true });
      e.hp = e.maxHp = 1e9;
      for (let k = 0; k < 13; k++) g.combat.hit(e, { mult: 1, from: p });
      out.collapses = collapses;
      // A Chromantite blade colours its hits in turn.
      g.profile.memory = {};
      const uid2 = g.profile.inv.nextUid++;
      g.profile.inv.items.push({ uid: uid2, id: 'swordsman_weapon_chromantite' });
      g.profile.equipment.swordsman.weapon = uid2; g.recomputeStats();
      e.statuses.clear();
      for (let k = 0; k < 40; k++) g.combat.hit(e, { mult: 1, from: p });
      out.chroma = ['burn', 'chill', 'poison'].filter((id) => e.statuses.has(id)).length;
      return out;
    });
    check(r.panel && r.memory === 'ember,rime' && r.burn, `Singularita remembers what you choose at the Forge (${r.memory})`);
    check(r.collapse >= 1 && r.collapses === 1, `every twelfth hit collapses (${r.collapses})`);
    check(r.chroma >= 2, `Chromantite hits cycle through afflictions (${r.chroma} kinds)`);
    check(!errors.length, `shape memory: no errors ${errors.slice(0, 3).join(' | ')}`);
    await ctx.close();
  }
} catch (err) {
  failures++;
  console.error('FAIL smoke test crashed:', err);
} finally {
  await browser.close();
  server.close();
}
console.log(`\nScreenshots: ${SHOTS}`);
console.log(failures ? `${failures} check(s) failed` : 'All smoke checks passed');
process.exit(failures ? 1 : 0);
