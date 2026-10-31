// Balance playtests: a bot plays real dimension runs in the browser and reports how they went.
// It uses the player's own controls (move, aim, attack, skills, dodge, tonics), reacts to the
// warnings drawn on the ground after a human-like delay, and rests between fights when hurt. Puzzles (levers, mirrored plates) are
// solved for it; the fighting, hazards and bosses are played for real.
// Run from the singularita folder:
//   node tests/playtest.js [--classes=swordsman,mage] [--dims=dim_twins,dim_king] [--skill=casual|skilled]
//                          [--offset=0] [--runs=1] [--bosses] [--out=file.json]
// --offset adds levels above each dimension's entry level; --bosses fights only the rulers;
// --focus keeps hitting the nearest body of a many-bodied boss instead of the healthiest.
// Other zones (cave_3, isle_air, cave_8...) can be listed in --dims as references: the bot roams them.
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

const args = Object.fromEntries(process.argv.slice(2).map((a) => { const [k, v] = a.replace(/^--/, '').split('='); return [k, v ?? true]; }));
const CLASSES = (args.classes || 'swordsman,archer,mage,assassin,stardust').split(',');
const DIMS = (args.dims || 'dim_dungeon,dim_twins,dim_king,dim_mirror,dim_dragons').split(',');
const SKILL = args.skill || 'casual';
const OFFSET = Number(args.offset || 0);
const RUNS = Number(args.runs || 1);
const BOSS_ONLY = !!args.bosses; // skip to each ruler's arena, with its creatures cleared
const FOCUS = !!args.focus; // against bosses of several bodies, keep hitting the nearest instead of the healthiest

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
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
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });

// What a player brings to each dimension: its entry level, plus the gear and skills of that level.
const ENTRY = { dim_dungeon: 100, dim_twins: 110, dim_king: 125, dim_mirror: 140, dim_dragons: 160, cave_9: 200,
  // Reference zones from earlier milestones, at a level a player meets them.
  cave_1: 3, cave_2: 10, cave_3: 18, cave_4: 28, cave_5: 40, cave_6: 52, cave_7: 66, isle_air: 75, isle_fire: 90, cave_8: 105,
  'boss:slime_prince': 8, 'boss:silverback_emperor': 14 };
const HOTBAR = {
  swordsman: ['sw_sunder', 'sw_earth', 'sw_dance', 'sw_warcry'],
  archer: ['ar_volley', 'ar_blast', 'ar_rain', 'ar_hawk'],
  mage: ['mg_flame', 'mg_nova', 'mg_barrier', 'mg_lance'],
  assassin: ['as_fan', 'as_venom', 'as_exec', 'as_dashcut'],
  stardust: ['sd_gravity', 'sd_sentinel', 'sd_starfall', 'sd_link'],
};
const SKILLS = {
  casual: { reaction: 0.45, notice: 0.75, dodge: 0.6, proj: 0.25, tonicAt: 0.35, restAt: 0.4 },
  skilled: { reaction: 0.25, notice: 0.95, dodge: 0.9, proj: 0.6, tonicAt: 0.45, restAt: 0.6 },
};

// ---------------------------------------------------------------------------------------- the bot
// Runs in the page. Installs window.__BOT with setup(), play() and helpers.
function installBot({ hotbars, skill }) {
  const g = window.__SG;
  const BLOCK = 1 | 256 | 512 | 4096 | 8192; // wall, obstacle, deep, void, lava
  const REACH = { swordsman: 1.3, assassin: 1.1 };
  const RANGE = { archer: 9, mage: 8, stardust: 6 };
  const tele = [];
  let playerCast = false;
  // Every filling warning on the ground (telegraphs, rings) that the player did not cast.
  const fxDecal = g.fx.decal.bind(g.fx);
  g.fx.decal = (o) => {
    const d = fxDecal(o);
    if (!playerCast && o.fill !== false && !o.persist && (o.t ?? 1) > 0.3 && o.color !== '#c48cff') tele.push({ o: { ...o, shape: o.shape === 'ring' ? 'circle' : o.shape }, t0: g.time, dur: o.t ?? 1, seen: Math.random() < skill.notice });
    return d;
  };
  // Wind-up arcs (a creature or boss about to swing) are warnings too.
  const fxSlash = g.fx.slash.bind(g.fx);
  g.fx.slash = (x, y, z, yaw, range, arcDeg, color, life = 0.16) => {
    const d = fxSlash(x, y, z, yaw, range, arcDeg, color, life);
    if (!playerCast && life > 0.2) tele.push({ o: { shape: 'cone', x, z, yaw, r: range, arc: (arcDeg * Math.PI) / 360 }, t0: g.time, dur: life, seen: Math.random() < skill.notice });
    return d;
  };
  const wrapKit = () => {
    const k = g.player.kit;
    if (k.__botWrapped) return;
    const ku = k.update.bind(k);
    k.update = (dt, inp) => { playerCast = true; try { ku(dt, inp); } finally { playerCast = false; } };
    k.__botWrapped = true;
  };

  const M = { reset() { Object.assign(this, { t: 0, dealt: 0, bossDealt: 0, resets: 0, astralBreaks: 0, taken: { boss: 0, enemy: 0, hazard: 0, other: 0 }, tonics: 0, kills: 0, dodges: 0, deaths: 0, cause: null, bossT: 0, bossHp: null, bossPhases: [], xp: 0, levels: 0 }); } };
  M.reset();
  let hurtThisFrame = 0;
  g.bus.on('playerHurt', ({ dmg, source }) => {
    hurtThisFrame += dmg;
    const k = source?.boss ? 'boss' : source?.def ? 'enemy' : 'hazard';
    M.taken[k] += dmg;
  });
  g.bus.on('kill', () => M.kills++);
  const hit0 = g.combat.hit.bind(g.combat);
  g.combat.hit = (t, spec) => { const r = hit0(t, spec); if (r) { M.dealt += r.dmg; if (t.boss) M.bossDealt += r.dmg; } return r; };
  g.bus.on('bossReset', () => M.resets++);
  g.bus.on('sfx', (e) => { if (e.id === 'break') M.astralBreaks++; });
  g.bus.on('dodge', () => M.dodges++);
  g.bus.on('playerDeath', ({ source }) => { M.deaths++; M.cause = source?.def?.id || source?.def?.name || (typeof source === 'string' ? source : 'hazard'); });
  g.bus.on('bossPhase', (e) => { if (!M.bossPhases.includes(e.phase.name)) M.bossPhases.push(e.phase.name); });

  // ------------------------------------------------------------------ navigation
  // Breadth-first distances to a goal over the whole grid; a step may climb one block.
  const fields = new Map();
  function field(tx, tz) {
    const G = g.grid, W = G.w, D = G.d;
    const ti = Math.max(0, Math.min(W - 1, Math.floor(tx))), tj = Math.max(0, Math.min(D - 1, Math.floor(tz)));
    const key = `${G.w}:${ti}:${tj}:${g.zone.id}:${g.profile.run?.floor}`;
    const c = fields.get(key);
    if (c && g.time - c.t < 3) return c.dist;
    const dist = new Int32Array(W * D).fill(-1), q = new Int32Array(W * D);
    let head = 0, tail = 0;
    const s = tj * W + ti;
    dist[s] = 0; q[tail++] = s;
    while (head < tail) {
      const k = q[head++], i = k % W, j = (k - i) / W, h0 = G.h[k];
      for (let n = 0; n < 4; n++) {
        const ni = i + (n === 0 ? 1 : n === 1 ? -1 : 0), nj = j + (n === 2 ? 1 : n === 3 ? -1 : 0);
        if (ni < 0 || nj < 0 || ni >= W || nj >= D) continue;
        const nk = nj * W + ni;
        if (dist[nk] !== -1 || (G.flags[nk] & BLOCK)) continue;
        if (h0 - G.h[nk] > 1) continue; // walking from nk to k climbs at most one block
        dist[nk] = dist[k] + 1; q[tail++] = nk;
      }
    }
    if (fields.size > 12) fields.clear();
    fields.set(key, { t: g.time, dist });
    return dist;
  }
  function stepAlong(dist, x, z) {
    const G = g.grid, W = G.w, i = Math.floor(x), j = Math.floor(z);
    const d0 = G.inside(i, j) ? dist[j * W + i] : -1;
    if (d0 <= 0) return null;
    let bi = 0, bj = 0, best = d0;
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      if (!di && !dj) continue;
      const ni = i + di, nj = j + dj;
      if (!G.inside(ni, nj)) continue;
      const d = dist[nj * W + ni];
      if (d < 0 || d >= best) continue;
      if (di && dj && (dist[j * W + ni] < 0 || dist[nj * W + i] < 0)) continue;
      best = d; bi = di; bj = dj;
    }
    if (!bi && !bj) return null;
    const tx = i + bi + 0.5 - x, tz = j + bj + 0.5 - z, l = Math.hypot(tx, tz) || 1;
    return { x: tx / l, z: tz / l };
  }
  function clearWalk(x0, z0, x1, z1) {
    const G = g.grid, l = Math.hypot(x1 - x0, z1 - z0), n = Math.ceil(l / 0.5);
    let h = G.height(Math.floor(x0), Math.floor(z0));
    for (let s = 1; s <= n; s++) {
      const x = x0 + ((x1 - x0) * s) / n, z = z0 + ((z1 - z0) * s) / n, i = Math.floor(x), j = Math.floor(z);
      if (!G.inside(i, j) || (G.flags[G.idx(i, j)] & BLOCK)) return false;
      const hh = G.height(i, j);
      if (hh - h > 1) return false;
      h = hh;
    }
    return true;
  }
  function towards(tx, tz) {
    const p = g.player;
    if (clearWalk(p.x, p.z, tx, tz)) { const dx = tx - p.x, dz = tz - p.z, l = Math.hypot(dx, dz) || 1; return { x: dx / l, z: dz / l }; }
    return stepAlong(field(tx, tz), p.x, p.z) || (() => { const dx = tx - p.x, dz = tz - p.z, l = Math.hypot(dx, dz) || 1; return { x: dx / l, z: dz / l }; })();
  }
  // While a boss is engaged, a player keeps inside its arena's ring.
  const fightArena = () => { const b = g.spawner.boss; return b?.engaged && !b.defeated ? b.members[0]?.arena : null; };
  const okCell = (x, z) => {
    const G = g.grid, i = Math.floor(x), j = Math.floor(z), a = fightArena();
    if (a && Math.hypot(x - a.x, z - a.z) > a.r - 1) return false;
    return G.inside(i, j) && !(G.flags[G.idx(i, j)] & BLOCK) && Math.abs(G.height(i, j) - g.player.y) <= 1.2;
  };
  // A direction near `d` that leads onto safe, walkable ground.
  function freeDir(d) {
    const p = g.player;
    for (const a of [0, 0.5, -0.5, 1, -1, 1.5, -1.5, 2.2, -2.2]) {
      const c = Math.cos(a), s = Math.sin(a), x = d.x * c - d.z * s, z = d.x * s + d.z * c;
      if (okCell(p.x + x * 1.4, p.z + z * 1.4) && okCell(p.x + x * 0.7, p.z + z * 0.7)) return { x, z };
    }
    return d;
  }

  // ------------------------------------------------------------------ danger
  function inShape(o, x, z, m) {
    const cx = o.follow ? o.follow.x : o.x, cz = o.follow ? o.follow.z : o.z;
    if (o.shape === 'line') {
      const l = Math.hypot(o.dx, o.dz) || 1, dx = o.dx / l, dz = o.dz / l;
      const along = (x - cx) * dx + (z - cz) * dz, lat = -(x - cx) * dz + (z - cz) * dx;
      if (along < -m || along > o.len + m || Math.abs(lat) > o.width / 2 + m) return null;
      return { x: -dz * Math.sign(lat || 1), z: dx * Math.sign(lat || 1) };
    }
    const dx = x - cx, dz = z - cz, d = Math.hypot(dx, dz);
    if (d > o.r + m) return null;
    if (o.shape === 'cone') {
      const a = Math.atan2(dx, dz) - o.yaw, off = Math.atan2(Math.sin(a), Math.cos(a));
      if (d > 1 && Math.abs(off) > o.arc + 0.2) return null;
      // Step out sideways, away from the swing's centre line.
      const side = Math.sign(off) || 1, sx = Math.cos(o.yaw) * side, sz = -Math.sin(o.yaw) * side;
      return { x: sx * 0.7 + (dx / (d || 1)) * 0.3, z: sz * 0.7 + (dz / (d || 1)) * 0.3 };
    }
    return d < 0.05 ? { x: 1, z: 0 } : { x: dx / d, z: dz / d };
  }
  function danger() {
    const p = g.player, now = g.time;
    let ex = 0, ez = 0, urgent = Infinity, any = false;
    for (let i = tele.length - 1; i >= 0; i--) {
      const t = tele[i], left = t.t0 + t.dur - now;
      if (left < -0.1) { tele.splice(i, 1); continue; }
      if (!t.seen || now - t.t0 < skill.reaction) continue;
      const e = inShape(t.o, p.x, p.z, p.radius + 0.5);
      if (!e) continue;
      any = true; ex += e.x; ez += e.z; urgent = Math.min(urgent, left);
    }
    for (const zn of g.combat.zones) {
      if (zn.team !== 'enemy') continue;
      const e = inShape({ shape: 'circle', x: zn.x, z: zn.z, r: zn.r }, p.x, p.z, p.radius + 0.3);
      if (e) { any = true; ex += e.x * 0.5; ez += e.z * 0.5; }
    }
    for (const pr of g.combat.projectiles) {
      if (pr.team !== 'enemy' || pr.botIgnore) continue;
      if (pr.botSeen === undefined) pr.botSeen = Math.random() < skill.proj;
      if (!pr.botSeen) continue;
      const rx = pr.x - p.x, rz = pr.z - p.z, v2 = pr.vx * pr.vx + pr.vz * pr.vz;
      if (v2 < 1) continue;
      const tc = -(rx * pr.vx + rz * pr.vz) / v2;
      if (tc < 0 || tc > 0.8) continue;
      const cx = rx + pr.vx * tc, cz = rz + pr.vz * tc;
      if (Math.hypot(cx, cz) > pr.radius + p.radius + 0.5) continue;
      const v = Math.sqrt(v2), side = Math.sign(-rx * pr.vz + rz * pr.vx) || 1;
      any = true; ex += (-pr.vz / v) * -side; ez += (pr.vx / v) * -side; urgent = Math.min(urgent, tc);
    }
    if (!any) return null;
    const l = Math.hypot(ex, ez) || 1;
    return { x: ex / l, z: ez / l, urgent };
  }

  // ------------------------------------------------------------------ choosing a target
  function bossMembers() { const b = g.spawner.boss; return b && !b.defeated ? b.members.filter((m) => m.alive && !m.untargetable) : []; }
  function pickTarget(range) {
    const p = g.player;
    const melee = !!REACH[g.profile.classId];
    let near = null, nd = Infinity;
    for (const e of g.enemies.active) {
      if (!e.alive || e.untargetable || e.boss || e.spawnT > 0.2) continue;
      const d = Math.hypot(e.x - p.x, e.z - p.z);
      if (d < nd && Math.abs(e.y - p.y) < 4) { nd = d; near = e; }
    }
    const boss = bossMembers().filter((m) => m.engaged || Math.hypot(m.x - p.x, m.z - p.z) < 16);
    if (boss.length) {
      if (near && nd < (melee ? 2.6 : 4)) return near;
      const byDist = (a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z);
      if (skill.focus) return boss.sort(byDist)[0];
      // Keep twin halves even: hit the healthier one.
      return boss.sort((a, b) => b.hp / b.maxHp - a.hp / a.maxHp || byDist(a, b))[0];
    }
    if (near && (nd < range || (near.hitT < 2 && nd < range + 6))) return near;
    return null;
  }

  // ------------------------------------------------------------------ one frame of play
  const S = { resting: false, archT: 0, castT: 0, strafe: 1, strafeT: 0, stuckT: 0, sx: 0, sz: 0, jumpT: 0, kick: null, kickT: 0, readT: 0, lastTonic: -9 };
  const down = new Set();
  function setKeys(want) {
    const inp = g.input;
    for (const a of ['attack', 'alt', 'dodge', 'tonic', 'skill1', 'skill2', 'skill3', 'skill4', 'jump', 'interact']) {
      if (want.has(a)) { if (!down.has(a)) { inp.press(a); down.add(a); } } else if (down.has(a)) { inp.release(a); down.delete(a); }
    }
  }
  function frame(goal) {
    const p = g.player, cls = g.profile.classId, kit = p.kit, inp = g.input;
    wrapKit();
    const want = new Set();
    let move = null, face = null;
    if (g.ui.dialogOpen) { S.readT += 1 / 30; if (S.readT > 1.2) { g.ui.closeDialog?.(); S.readT = 0; } }
    const hp0 = p.hp;
    if (p.alive && !g.inputBlocked) {
      const melee = !!REACH[cls];
      // Just hit by something: look further for whoever did it.
      const target = pickTarget((melee ? 9 : 12) + (S.alertT > 0 ? 8 : 0));
      if (target) { g.lockTarget = target; } else g.lockTarget = null;
      // Heal.
      if (p.hp < g.stats.maxHp * skill.tonicAt && g.consumableCd <= 0 && g.bestTonic() && g.time - S.lastTonic > 1) { want.add('tonic'); S.lastTonic = g.time; M.tonics++; }
      // Keep the Astral out.
      if (cls === 'stardust' && g.astral && !g.astral.manifested && p.res > 40 && Math.floor(g.time * 2) % 2 === 0 && !down.has('alt')) want.add('alt');
      // Hurt and with nothing near: stop and let health come back, as a player would.
      if (!target && !bossMembers().some((m) => m.engaged) && p.hp < g.stats.maxHp * skill.restAt) S.resting = true;
      const dz = danger();
      if (dz) {
        move = freeDir(dz);
        if (dz.urgent < 0.32 && p.dodgeCd <= 0 && Math.random() < skill.dodge) want.add('dodge');
      } else if (cls === 'mage' && p.res < 18 && (!target || Math.hypot(target.x - p.x, target.z - p.z) > 7)) {
        want.add('alt'); // channel mana, standing still
      } else if (p.corruption > 65 && g.zone.braziers?.length) {
        // The brazier that costs the least detour on the way to where we are going.
        const gx = goal?.x ?? p.x, gz = goal?.z ?? p.z, cost = (b) => Math.hypot(b.x - p.x, b.z - p.z) + Math.hypot(gx - b.x, gz - b.z);
        const b = g.zone.braziers.slice().sort((a, c) => cost(a) - cost(c))[0];
        if (Math.hypot(b.x - p.x, b.z - p.z) > 1.5) move = towards(b.x, b.z);
      } else if (S.resting && !target) {
        // Catching our breath: out of combat, health comes back quickly.
        if (p.hp > g.stats.maxHp * 0.9) S.resting = false;
      } else if (target) {
        const d = Math.hypot(target.x - p.x, target.z - p.z);
        const want0 = melee ? target.radius + p.radius + REACH[cls] : RANGE[cls];
        if (d > want0 + 0.3) move = towards(target.x, target.z);
        else if (!melee && d < want0 * 0.55) move = freeDir({ x: (p.x - target.x) / (d || 1), z: (p.z - target.z) / (d || 1) });
        else if (!melee) {
          S.strafeT -= 1 / 30; if (S.strafeT <= 0) { S.strafeT = 1.5 + Math.random() * 2; S.strafe = -S.strafe; }
          const tx = (target.x - p.x) / (d || 1), tz = (target.z - p.z) / (d || 1);
          move = freeDir({ x: -tz * S.strafe, z: tx * S.strafe });
          move = { x: move.x * 0.6, z: move.z * 0.6 };
        }
      } else if (goal) {
        if (Math.hypot(goal.x - p.x, goal.z - p.z) > (goal.r ?? 1)) move = towards(goal.x, goal.z);
      }
      // Attack and cast.
      if (target) {
        const d = Math.hypot(target.x - p.x, target.z - p.z) - target.radius;
        face = Math.atan2(target.x - p.x, target.z - p.z);
        const inReach = melee ? d < REACH[cls] + p.radius + 0.6 : d < 15;
        if (inReach) {
          if (cls === 'archer') { S.archT += 1 / 30; if (S.archT < 0.5) want.add('attack'); else S.archT = 0; }
          else want.add('attack');
          if (cls === 'assassin' && (kit.cd.as_mark || 0) <= 0 && !down.has('alt') && Math.random() < 0.1) want.add('alt');
        }
        if (d < (melee ? 5 : 13) && g.time - S.castT > 0.35) {
          const hb = g.profile.hotbars[cls];
          // Skills centred on the player (Frost Nova, Whirlwind...) only when foes are close.
          const closeOnly = { mg_nova: 4.5, sw_whirl: 3.5 };
          for (let k = 0; k < 4; k++) if (hb[k] && kit.canCast(hb[k]) === null && !down.has(`skill${k + 1}`) && !(closeOnly[hb[k]] && d > closeOnly[hb[k]])) { want.add(`skill${k + 1}`); S.castT = g.time; break; }
        }
      }
      // Unstick: if walking but not getting anywhere, jump and try a side step.
      S.stuckT += 1 / 30;
      if (S.stuckT > 2) {
        if (move && Math.hypot(p.x - S.sx, p.z - S.sz) < 0.8) { S.kick = { x: -move.z * (Math.random() < 0.5 ? 1 : -1), z: move.x }; S.kickT = 0.6; want.add('jump'); }
        S.stuckT = 0; S.sx = p.x; S.sz = p.z;
      }
      if (S.kickT > 0) { S.kickT -= 1 / 30; move = S.kick; }
    }
    // Controls are camera-relative: face the camera where we look, then push the stick.
    const yaw = face ?? (move ? Math.atan2(move.x, move.z) : g.cam.yaw);
    g.cam.yaw = yaw;
    const f = g.cam.forward, r = g.cam.right;
    inp.stick.x = move ? move.x * r.x + move.z * r.z : 0;
    inp.stick.y = move ? move.x * f.x + move.z * f.z : 0;
    setKeys(want);
    hurtThisFrame = 0;
    g.update(1 / 30);
    inp.endFrame();
    S.alertT = Math.max(0, (S.alertT || 0) - 1 / 30);
    if (hurtThisFrame > 0) { S.alertT = 3; S.resting = false; }
    const lost = hp0 - p.hp - hurtThisFrame;
    if (lost > 0.5 && p.alive) M.taken.other += lost; // burns, poison and other lingering harm
    M.t += 1 / 30;
  }

  // ------------------------------------------------------------------ setting up a character
  async function setup({ level, cls }) {
    const tiers = [1, 3, 8, 16, 26, 38, 50, 64, 100, 180, 240];
    const mats = ['wood', 'stone', 'copper', 'iron', 'titanium', 'emerald', 'ruby', 'diamond', 'dawndosite', 'chromantite', 'singularita'];
    const tier = tiers.filter((x) => x <= level).length - 1;
    const { CLASSES } = await import('./js/data/classes.js');
    const { equip } = await import('./js/systems/equipment.js');
    const pr = g.profile, gw = CLASSES[cls].growth;
    pr.level = level; pr.xp = 0;
    for (const a of Object.keys(pr.attrs)) pr.attrs[a] = 0;
    pr.attrs[gw[0]] = (level - 1) * 2; pr.attrs[gw[1]] += level - 1; pr.attrPoints = 0;
    pr.inv.items = pr.inv.items.filter((it) => !/_weapon_|_armor_|_accessory_/.test(it.id));
    const m = mats[tier], m2 = tier === 8 ? 'escuresite' : m;
    for (const [id, slot] of [[`${cls}_weapon_${m}`, 'weapon'], [`${cls}_armor_${m}`, 'armor'], [`${cls}_accessory_${m}`, 'acc1'], [`${cls}_accessory_${m2}`, 'acc2']]) {
      const uid = pr.inv.nextUid++;
      pr.inv.items.push({ uid, id });
      equip(pr, uid, slot);
    }
    pr.hotbars[cls] = hotbars[cls].slice();
    pr.inv.stacks.healing_tonic = 0;
    pr.inv.stacks.greater_healing_tonic = 6;
    g.recomputeStats(); g.rebuildPlayerRig?.();
    const p = g.player;
    p.hp = g.stats.maxHp; p.res = g.stats.resourceMax; p.statuses.clear();
    g.godMode = false;
    return { tier: m, hp: Math.round(g.stats.maxHp), def: Math.round(g.stats.def), power: Math.round(g.stats.power) };
  }

  // Plays up to `secs` simulated seconds toward a goal. until(): a string ends the play with that outcome.
  function play({ secs, goal, until }) {
    const p = g.player;
    for (let n = 0; n < secs * 30; n++) {
      frame(typeof goal === 'function' ? goal() : goal);
      if (!p.alive) return 'died';
      const u = until?.();
      if (u) return u;
    }
    return 'timeout';
  }

  window.__BOT = { setup, play, frame, M, bossMembers, tele };
}

// ---------------------------------------------------------------------------------- the runner
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function newPage(cls) {
  const ctx = await browser.newContext({ viewport: { width: 640, height: 360 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(`${BASE}/singularita/index.html?quickstart=${cls}&debug`);
  await page.waitForFunction(() => window.__SG && window.__SG.zone && document.getElementById('loading').hidden, null, { timeout: 60000 });
  await page.evaluate(installBot, { hotbars: HOTBAR, skill: { ...SKILLS[SKILL], focus: FOCUS } });
  return { ctx, page, errors };
}

// One run of a dimension, start to finish (or death). Returns what happened.
async function playRun(page, cls, dim, level) {
  const gear = await page.evaluate(async ({ cls, level, dim }) => {
    const g = window.__SG, B = window.__BOT;
    g.ui.closeDialog?.();
    if (g.zone.id !== 'island') { g.enterZone('island'); }
    const out = await B.setup({ cls, level });
    g.profile.flags.gateOpen = true;
    for (const s of ['shard_gaol', 'shard_twins', 'shard_crown', 'shard_mirror', 'shard_dragon']) g.profile.inv.stacks[s] = 1;
    B.M.reset(); B.M.xp = g.profile.xp; B.M.level0 = g.profile.level;
    B.M.inv0 = { ...g.profile.inv.stacks };
    B.arena = null;
    if (dim.startsWith('boss:')) {
      const id = dim.slice(5), { BOSSES } = await import('./js/data/bosses.js'), a = g.zone.arenas[BOSSES[id].arena];
      g.enterZone('island');
      const p = g.player; p.x = a.x; p.z = a.z + a.r - 3; p.y = p.ry = g.grid.height(Math.floor(p.x), Math.floor(p.z));
      for (const e of g.enemies.list) { e.alive = false; e.dyingT = 0; }
      g.spawner.spawnBoss(id, true);
      B.arena = a;
      return out;
    }
    if (!dim.startsWith('dim_')) { g.enterZone(dim); return out; }
    g.profile.inv.stacks[dim.replace('dim_', 'emblem_')] = 1;
    const p = g.player; g.enterZone('island'); p.yaw = g.zone.spawnYaw ?? Math.PI;
    const why = g.interaction.openPortal(dim);
    if (why) return { ...out, error: why };
    g.interaction.enterPortal();
    return out;
  }, { cls, level, dim });
  if (gear.error) return { error: gear.error };
  // The portal fades in; wait until the run's first floor is built.
  if (!dim.startsWith('boss:')) await page.waitForFunction((dim) => window.__SG.zone.id === dim, dim, { timeout: 15000 }).catch(() => {});
  await sleep(300);
  if (BOSS_ONLY) {
    if (dim === 'dim_dungeon') {
      await page.evaluate(() => { const g = window.__SG; g.profile.run.floor = 5; g.enterZone('dim_dungeon'); });
    }
    await page.evaluate(() => {
      const g = window.__SG, p = g.player, ar = g.zone.arena;
      g.ui.closeDialog?.();
      if (!ar) return;
      g.enemies.list.filter((e) => !e.boss).forEach((e) => { e.alive = false; e.dyingT = 0; });
      g.spawner.popT = 1e9;
      p.x = ar.x; p.z = ar.z + ar.r - 3; p.y = p.ry = g.grid.height(Math.floor(p.x), Math.floor(p.z)); p.grounded = true;
    });
  }
  const floors = [];
  let outcome = null;
  for (let floor = 1; floor <= 12 && !outcome; floor++) {
    const r = await page.evaluate(({ dim, bossOnly }) => {
      const g = window.__SG, B = window.__BOT, z = g.zone, ar = z.arena || B.arena;
      g.ui.closeDialog?.();
      // Puzzles are solved for the bot: every gate opens.
      for (const gt of z.gates || []) { if (gt.open) continue; gt.open = true; for (const k of gt.cells) z.grid.flags[k] &= ~256; }
      for (const l of z.levers || []) l.pulled = true;
      g.enemies.flow.valid = false; g.view.rebuildStructures?.();
      const t0 = B.M.t;
      // Outside dimensions: wander between far reachable points and fight what comes.
      const wander = () => {
        const G = g.grid, p = g.player;
        for (let t = 0; t < 60; t++) {
          const i = Math.floor(Math.random() * G.w), j = Math.floor(Math.random() * G.d);
          if (!G.walkable(i, j) || Math.hypot(i - p.x, j - p.z) < 20 || Math.hypot(i - p.x, j - p.z) > 45) continue;
          return { x: i + 0.5, z: j + 0.5, r: 3 };
        }
        return null;
      };
      let roam = null;
      const rooms = (z.rooms || []).slice(1);
      let room = 0;
      const exitOpen = () => z.exit && !z.exit.locked;
      const goal = () => {
        if (z.type !== 'dimension' && !(bossOnly && ar)) { if (!roam || Math.hypot(roam.x - g.player.x, roam.z - g.player.z) < 3.5 || Math.random() < 0.002) roam = wander(); return roam; }
        if (ar) return { x: ar.x, z: ar.z, r: 2 };
        if (exitOpen()) return { x: z.exit.x, z: z.exit.z, r: 0.8 };
        // Look for the Warden: go where it was last seen, else search room by room.
        const w = g.enemies.list.find((e) => e.alive && e.def.keyCarrier);
        const p = g.player;
        if (w && Math.hypot(w.x - p.x, w.z - p.z) < 18) return { x: w.x, z: w.z, r: 2 };
        while (room < rooms.length) {
          const r = rooms[room], cx = r.x + r.w / 2, cz = r.z + r.d / 2;
          if (Math.hypot(cx - p.x, cz - p.z) < 3) { room++; continue; }
          return { x: cx, z: cz, r: 2.5 };
        }
        return w ? { x: w.x, z: w.z, r: 2 } : null;
      };
      let bossSeen = false, bg = null;
      const res = B.play({ secs: z.type === 'dimension' || bossOnly ? 900 : 240, goal, until: () => {
        const b = (bg ||= g.spawner.boss);
        if (b?.engaged && !bossSeen) { bossSeen = true; B.M.bossT0 = B.M.t; }
        if (b?.defeated) return 'cleared';
        // Island bosses are measured alone: the horde stays out of it.
        if (z.type === 'island' && bossOnly) for (const e of g.enemies.list) if (e.horde && e.alive) { e.alive = false; e.dyingT = 0; }
        if (exitOpen() && Math.hypot(z.exit.x - g.player.x, z.exit.z - g.player.z) < 1.4) return 'stair';
        return null;
      } });
      const b = bg;
      if (bossSeen) { B.M.bossT = B.M.t - B.M.bossT0; B.M.bossHp = b ? b.members.reduce((s, m) => s + Math.max(0, m.hp), 0) / b.members.reduce((s, m) => s + m.maxHp, 0) : 0; }
      return { res, floor: g.profile.run?.floor, t: Math.round(B.M.t - t0), hp: Math.round(100 * g.player.hp / g.stats.maxHp) };
    }, { dim, bossOnly: BOSS_ONLY });
    floors.push(r);
    if (r.res === 'stair') {
      const next = await page.evaluate(() => { const g = window.__SG; g.interaction.descend(); return g.profile.run.floor; });
      await page.waitForFunction((n) => window.__SG.zone.floor === n, next, { timeout: 15000 }).catch(() => {});
      await sleep(300);
      continue;
    }
    outcome = r.res;
  }
  // Leave (or be cast out) and read the books.
  const sum = await page.evaluate(async ({ outcome }) => {
    const g = window.__SG, B = window.__BOT;
    const M = B.M;
    if (outcome === 'cleared') {
      B.play({ secs: 3 });
      g.ui.closeDialog?.();
      if (g.profile.run) g.interaction.leaveRun('complete');
    } else if (outcome === 'died') {
      g.respawn();
    } else if (g.profile.run) g.interaction.leaveRun('fail');
    await new Promise((r) => setTimeout(r, 1300));
    g.ui.closeDialog?.();
    const gained = {};
    for (const [k, v] of Object.entries(g.profile.inv.stacks)) { const d = v - (M.inv0[k] || 0); if (d > 0 && !/emblem|tonic/.test(k)) gained[k] = d; }
    return { t: Math.round(M.t), dps: Math.round(M.dealt / Math.max(1, M.t)), bossDps: Math.round(M.bossDealt / Math.max(1, M.bossT)), resets: M.resets, astralBreaks: M.astralBreaks, bossT: Math.round(M.bossT), bossHp: M.bossHp == null ? null : Math.round(M.bossHp * 100), phases: M.bossPhases, deaths: M.deaths, cause: M.cause,
      tonics: M.tonics, kills: M.kills, dodges: M.dodges, taken: Object.fromEntries(Object.entries(M.taken).map(([k, v]) => [k, Math.round(v)])),
      maxHp: Math.round(g.stats.maxHp), xp: Math.round(g.profile.xp - M.xp), levels: g.profile.level - M.level0, gained };
  }, { outcome });
  return { outcome, floors, gear, ...sum };
}

const results = [];
try {
  for (const cls of CLASSES) {
    const { ctx, page, errors } = await newPage(cls);
    for (const dim of DIMS) {
      for (let run = 0; run < RUNS; run++) {
        const level = ENTRY[dim] + OFFSET;
        const t0 = Date.now();
        let r;
        try { r = await playRun(page, cls, dim, level); } catch (e) { r = { error: e.message.split('\n')[0] }; }
        r = { cls, dim, level, skill: SKILL, wall: Math.round((Date.now() - t0) / 1000), ...r };
        results.push(r);
        const tk = r.taken ? `boss ${r.taken.boss} enemy ${r.taken.enemy} hazard ${r.taken.hazard + r.taken.other}` : '';
        const perMin = r.t ? ` kpm ${(r.kills * 60 / r.t).toFixed(1)} dmg/min ${Math.round(Object.values(r.taken || {}).reduce((a, b) => a + b, 0) * 6000 / r.t / r.maxHp)}%hp dps ${r.dps}` : '';
        console.log(`${cls.padEnd(9)} ${dim.padEnd(11)} L${level} ${String(r.outcome || r.error).padEnd(8)}${perMin} t ${r.t}s boss ${r.bossT}s left ${r.bossHp ?? '-'}% bossDps ${r.bossDps} resets ${r.resets}${r.cls === 'stardust' ? ` astral breaks ${r.astralBreaks}` : ''} deaths ${r.deaths} cause ${r.cause || '-'} tonics ${r.tonics} kills ${r.kills} | taken ${tk} of ${r.maxHp} | floors ${(r.floors || []).map((f) => `${f.floor}:${f.res}/${f.t}s`).join(' ')} | xp ${r.xp} +${r.levels}L | ${JSON.stringify(r.gained)} (${r.wall}s)`);
      }
    }
    if (errors.length) console.log(`  page errors (${cls}): ${errors.slice(0, 3).join(' | ')}`);
    await ctx.close();
  }
} finally {
  const out = args.out || path.join(os.tmpdir(), `singularita-playtest-${Date.now()}.json`);
  fs.writeFileSync(out, JSON.stringify(results, null, 1));
  console.log(`Results: ${out}`);
  await browser.close();
  server.close();
}
