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
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml' };

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
      for (let t = 0; t < 40; t++) { hold('attack', 8); if (t % 5 === 0) for (let s = 1; s <= 4; s++) tap('skill' + s); }
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
    check(hud.length === 3 && hud.every((b) => b.top), `touch ${name}: HUD buttons are on top of the touch layer`);
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
