/* Robô de chefões: joga as lutas SEM modo deus e sem teleporte, só com os comandos do jogador
 * (andar, pular, deslizar na profundidade, golpear, Foco), com tempo de reação e erros configuráveis.
 * Uso: sirva a raiz (python3 -m http.server 8765) e rode
 *   node planolandia/tests/bossbot.js [url-base] [tentativas] [chefe: cubo|mae|todos] [perfil: bom|medio|todos]
 * Saída: vitórias/derrotas, tempo, dano recebido por ataque do chefão. */
'use strict';
const { chromium } = require('playwright');

const BASE = process.argv[2] || 'http://127.0.0.1:8765';
const TRIALS = +(process.argv[3] || 4);
const WHICH = process.argv[4] || 'todos';
const PROF = process.argv[5] || 'todos';

const PROFILES = {
  bom: { react: 0.16, miss: 0.04, noise: 3, heal: true },
  medio: { react: 0.3, miss: 0.18, noise: 9, heal: true },
};
const FIGHTS = {
  cubo: { q: 'room=borda_arena&x=140&y=314&z=100', maxT: 300 },
  mae: { q: 'room=bosque_ninho&x=90&y=294&z=120&abilities=dash', maxT: 300 },
};

// ---------------- robô (roda dentro da página) ----------------
function botMain(cfg) {
  const PL = window.PL, G = PL.debug.game;
  const DT = 1 / 60;
  const bot = window.BOT = { t: 0, hurts: [], result: null, cur: null, prev: null, jumpHold: 0, prevJump: false, prevAtk: false, hes: 0, dealt: 0, maxPh: 1 };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  // ganchos: dano recebido, passos acelerados, entrada virtual
  const hurt0 = G.hurtPlayer.bind(G);
  G.hurtPlayer = function (fromX, dmg, opts) {
    const before = G.save.lados;
    hurt0(fromX, dmg, opts);
    if (G.save.lados < before) {
      const B = G.boss;
      let st = B ? B.state : '-';
      if (B && B.state === 'split') {
        const P = G.player;
        const ks = G.ents.filter((e) => e.daughter && e.alive);
        ks.sort((a, b) => Math.hypot(a.x - P.x, a.z - P.z) - Math.hypot(b.x - P.x, b.z - P.z));
        st = 'filha:' + (ks[0] ? ks[0].state : '?');
      }
      if (bot.minionNear) st += '+lacaio';
      const P2 = G.player;
      const near = G.ents.filter((e) => e.enemy && e.alive && e.visible).map((e) => `${e.type}${e.daughter ? 'F' : ''}:${e.state || ''} dx${Math.round(e.x - P2.x)} dz${Math.round(e.z - P2.z)} r${Math.round(e.s.r || (e.s.maxX - e.s.minX) / 2)} sy${Math.round(e.s.minY)}..${Math.round(e.s.maxY)}`);
      bot.hurts.push({ t: +bot.t.toFixed(1), st: (opts && opts.hazard ? 'perigo/' : '') + st, near: near.join('; '), py: Math.round(P2.y) });
    }
  };
  const step0 = G.step.bind(G);
  G.step = function (dt) {
    for (let i = 0; i < cfg.speed && !bot.result; i++) {
      if (i > 0) PL.Input.update();
      step0(DT);
      bot.t += DT;
      check();
    }
  };
  const upd0 = PL.Input.update;
  PL.Input.update = function () { drive(); upd0(); };

  function check() {
    const B = G.boss, P = G.player;
    if (B && B.phase) bot.maxPh = Math.max(bot.maxPh, B.phase);
    if (P.dead || G.save.lados <= 0) bot.result = 'perdeu';
    else if (B && (B.state === 'dying' || B.state === 'unfold' || B.state === 'dead') && (B.hp <= 0 || B.state === 'dead' || (B.phase === 2 && !B.daughter))) bot.result = 'venceu';
    else if (bot.t > cfg.maxT) bot.result = 'tempo';
  }

  const away = (room, px, x, d) => {
    const l = x - d, r = x + d;
    if (l < 40) return r;
    if (r > room.w - 40) return l;
    return Math.abs(px - l) <= Math.abs(px - r) ? l : r;
  };

  // ---- estratégia contra o Cubo Carcereiro ----
  function planCubo(B, s, P) {
    const room = G.room, px = P.x, pz = P.z, FY = B.FY;
    const core = { x: B.core[0], y: B.core[1], z: B.core[2] };
    const p = { gx: px, gz: pz, jump: false, jumpT: 0.25, atk: null, face: 0, focus: false };
    switch (s) {
      case 'intro': case 'sleep': p.gx = px + 30; break;
      case 'slamRise': case 'slamFall': p.gx = away(room, px, B.x, 72); p.gz = clamp(core.z, 5, room.d - 5); break;
      case 'slamLand': {
        const side = px < B.x ? -1 : 1;
        p.gx = B.x + side * 50; p.gz = core.z; p.face = -side; p.atk = 'side';
        break;
      }
      // o giro persegue a sua profundidade até disparar: espere no meio e só deslize quando ele começar a girar
      case 'spinPrep': p.gz = clamp(pz, 60, room.d - 60); p.gx = B.x > room.w / 2 ? Math.min(px, room.w / 2 - 40) : Math.max(px, room.w / 2 + 40); break;
      case 'spin': p.gz = B.z > room.d / 2 ? 4 : room.d - 4; break;
      case 'ramOut': p.gz = pz; break;
      case 'ramAim': case 'ram': p.gx = away(room, px, B.lockX, 82); break;
      case 'stun': {
        const side = px < core.x ? -1 : 1;
        p.gz = core.z; p.face = -side;
        if (core.y < P.y - 16) { p.gx = core.x + side * 2; p.atk = 'up'; p.jump = true; p.jumpT = 0.06; }
        else { p.gx = core.x + side * 22; p.atk = 'side'; }
        break;
      }
      default: { // idle, return
        p.gz = core.z;
        const side = px < core.x ? -1 : 1;
        p.gx = core.x + side * 3;
        if (B.coreVis && Math.abs(core.x - px) < 12 && Math.abs(pz - core.z) < 6) { p.jump = true; p.jumpT = 0.07; if (P.y < 300) p.atk = 'up'; }
        // descanso seguro: chefe longe ou saindo do plano
        if (cfg.heal && G.save.lados <= G.save.maxLados - 2 && G.save.geo >= 33 && Math.abs(B.x - px) > 110) { p.focus = true; p.gx = px; }
      }
    }
    if ((s === 'ramOut' || s === 'return') && cfg.heal && G.save.lados < G.save.maxLados && G.save.geo >= 33) p.focus = true;
    // não encostar no cubo (exceto quando atordoado)
    if (B.visible && s !== 'stun') {
      const S = B.s;
      if (S.maxY > P.y - 14 && S.minX - 10 < px + 6 && S.maxX + 10 > px - 6 && !(s === 'idle' && S.maxY < P.y - 6)) {
        p.gx = px < (S.minX + S.maxX) / 2 ? S.minX - 22 : S.maxX + 22;
        p.atk = null; p.jump = false; p.focus = false;
      }
    }
    // ondas de choque: pula
    for (const w of B.waves) if (Math.abs(pz - w.z) < 46 && (w.x - px) * w.dir < 0 && Math.abs(w.x - px) < 40) { p.jump = true; p.jumpT = 0.2; p.focus = false; }
    // fase 2: ladrilhos que vão cair embaixo de mim
    const bad = (z, x) => room.prims.some((q) => q.tile && (q.warnT > 0 || q.fallT > 0) && z >= q.zMin - 3 && z <= q.zMax + 3 && x + 6 > q.xMin && x - 6 < q.xMax);
    if (bad(pz, px) || bad(p.gz, px)) {
      let best = null;
      for (let z = 5; z <= room.d - 5; z += 5) if (!bad(z, px) && (best === null || Math.abs(z - pz) < Math.abs(best - pz))) best = z;
      if (best !== null) { p.gz = best; p.focus = false; }
    }
    return p;
  }

  // ---- estratégia contra a Mãe-Esfera (e as Filhas) ----
  function planMae(B, s, P) {
    const room = G.room, px = P.x, pz = P.z;
    let T = B, ts = s;
    if (B.state === 'split') {
      const kids = G.ents.filter((e) => e.daughter && e.alive && e.state !== 'dying');
      if (!kids.length) return { gx: px, gz: pz };
      kids.sort((a, b) => Math.abs(a.x - px) + Math.abs(a.z - pz) - Math.abs(b.x - px) - Math.abs(b.z - pz));
      T = kids[0]; ts = T.state;
      // a outra filha atacando com quique/passagem também exige desvio
      for (const k of kids.slice(1)) if (k.state === 'bounce' || k.state === 'bounceAim' || k.state === 'pass' || k.state === 'passAim') { T = k; ts = k.state; break; }
    }
    const R = T.R;
    const p = { gx: px, gz: pz, jump: false, jumpT: 0.25, atk: null, face: 0, focus: false };
    switch (ts) {
      case 'intro': case 'sleep': p.gx = away(room, px, T.x, R + 40); break;
      case 'passOut': p.gz = pz; break;
      case 'passAim': case 'pass': p.gx = away(room, px, T.lockX, R + 22); break;
      case 'bounceAim': case 'bounce': {
        const need = R * 0.75 + 4;
        p.gz = T.bz > room.d / 2 ? clamp(T.bz - need - 8, 4, room.d - 4) : clamp(T.bz + need + 8, 4, room.d - 4);
        if (Math.abs(p.gz - T.bz) < need) p.gz = T.bz > room.d / 2 ? 4 : room.d - 4;
        break;
      }
      default: { // idle, return, spawn: ficar ao lado, no plano do equador, e golpear a borda
        const side = px < T.x ? -1 : 1;
        const sweet = R * 0.72 + 12;
        p.gx = clamp(T.x + side * sweet, 30, room.w - 30);
        // só entra no plano dela quando já está na distância certa (senão, encosta)
        p.gz = Math.abs(T.x - px) > sweet - 8 ? clamp(T.z, 3, room.d - 3) : (Math.abs(pz - T.z) < R ? (T.z > room.d / 2 ? T.z - R - 6 : T.z + R + 6) : pz);
        p.face = -side;
        if (Math.abs(pz - T.z) < 14 && T.visible) {
          const hb = 6 + 22;
          const edge = Math.abs(T.x - px) - (T.s.r ? Math.sqrt(Math.max(0, T.s.r * T.s.r - Math.pow(P.y - T.s.cy, 2))) : 0);
          if (edge < hb + 2) p.atk = 'side';
        }
        if (cfg.heal && G.save.lados <= G.save.maxLados - 2 && G.save.geo >= 33 && (ts === 'passOut' || Math.abs(T.x - px) > 140)) p.focus = true;
      }
    }
    if (ts === 'passOut' && cfg.heal && G.save.lados < G.save.maxLados && G.save.geo >= 33) p.focus = true;
    // evitar contato com QUALQUER esfera visível (mãe ou filhas): para o lado, ou pela profundidade se cercado
    const spheres = G.ents.filter((e) => (e === B || e.daughter) && e.alive && e.visible && e.state !== 'dying');
    const danger = [];
    for (const e of spheres) {
      const S = e.s;
      const hw = S.r > 0 ? Math.sqrt(Math.max(0, S.r * S.r - Math.pow(P.y - S.cy, 2))) : 0;
      if (Math.abs(e.x - px) < hw + 14) danger.push({ e, hw });
    }
    if (danger.length) {
      p.atk = null; p.focus = false;
      const left = danger.some((d) => d.e.x < px), right = danger.some((d) => d.e.x >= px);
      if ((left && right) || px < 60 || px > room.w - 60) {
        const zs = danger.map((d) => d.e.z);
        const mz = zs.reduce((a, b) => a + b, 0) / zs.length;
        p.gz = mz > room.d / 2 ? 3 : room.d - 3;
      } else {
        const d0 = danger[0];
        p.gx = away(room, px, d0.e.x, d0.hw + 24);
      }
    }
    return p;
  }

  function drive() {
    const v = PL.Input.virt, P = G.player, B = G.boss;
    v.active = true; v.buttons = {}; v.axisX = 0; v.axisY = 0; v.axisZ = 0;
    if (bot.result) return;
    if (G.dialogOpen) { bot.tog = !bot.tog; if (bot.tog) v.buttons.confirm = true; return; }
    if (!B || P.dead || G.busy) return;
    if (B.state !== bot.cur) { bot.prev = bot.cur; bot.cur = B.state; }
    const s = B.stT < cfg.react && bot.prev ? bot.prev : B.state;
    const plan = cfg.boss === 'cubo' ? planCubo(B, s, P) : planMae(B, s, P);
    // lacaios / esférulas por perto: golpeia (desvios de ataque têm prioridade)
    bot.minionNear = false;
    const dodging = ['slamRise', 'slamFall', 'spinPrep', 'spin', 'ramAim', 'ram', 'passAim', 'pass', 'bounceAim', 'bounce'].includes(s) || (B.state === 'split' && G.ents.some((k) => k.daughter && k.alive && ['passAim', 'pass', 'bounceAim', 'bounce'].includes(k.state)));
    for (const e of G.ents) {
      if (dodging && !(e.esferula && e.visible && Math.abs(e.s.cx - P.x) < 30)) continue;
      if (!e.enemy || e.boss || e.daughter || !e.alive || !e.visible) continue;
      const dx = e.s.cx - P.x;
      if (Math.abs(dx) < 46 && Math.abs(e.s.cy - P.y) < 30) { bot.minionNear = true; plan.face = Math.sign(dx) || 1; plan.atk = 'side'; if (Math.abs(dx) < 22 && !dodging) plan.gx = P.x - Math.sign(dx) * 30; }
    }
    // ruído de posicionamento (mãos humanas)
    if (!bot.noiseT || bot.noiseT <= 0) { bot.nx = (Math.random() - 0.5) * 2 * cfg.noise; bot.nz = (Math.random() - 0.5) * 2 * cfg.noise; bot.noiseT = 0.6; }
    bot.noiseT -= DT;
    const gx = clamp(plan.gx + bot.nx, 14, G.room.w - 14), gz = clamp(plan.gz + bot.nz * 0.5, 1, G.room.d - 1);
    if (cfg.trace && ((bot.tr = (bot.tr || 0) + 1) % 6 === 0)) (bot.trace = bot.trace || []).push(`${bot.t.toFixed(1)} ${s} P(${P.x.toFixed(0)},${P.z.toFixed(0)}) B(${B.x.toFixed(0)},${B.z.toFixed(0)} r${B.visible ? B.s.r.toFixed(0) : '-'}) goal(${gx.toFixed(0)},${gz.toFixed(0)}) atk:${plan.atk || '-'} L${G.save.lados}`);
    if (plan.focus && P.b.grounded) { v.buttons.focus = true; bot.prevJump = false; bot.prevAtk = false; return; }
    const dx = gx - P.x;
    if (Math.abs(dx) > 3) v.axisX = Math.sign(dx);
    else if (plan.face && P.facing !== plan.face && plan.atk === 'side') v.axisX = plan.face;
    const dz = gz - P.z;
    if (Math.abs(dz) > 2) v.axisZ = Math.sign(dz);
    // pulo (com borda de subida)
    if (plan.jump && P.b.grounded && bot.jumpHold <= 0 && !bot.prevJump) bot.jumpHold = plan.jumpT;
    const jumpNow = bot.jumpHold > 0;
    if (jumpNow) { v.buttons.jump = true; bot.jumpHold -= DT; }
    bot.prevJump = jumpNow;
    // golpe (com hesitação aleatória)
    bot.hes -= DT;
    if (plan.atk && bot.hes <= 0 && Math.random() < cfg.miss * 0.1) bot.hes = 0.35;
    const canAtk = plan.atk && bot.hes <= 0 && P.atkCd <= 0 && P.atkT <= 0 && !bot.prevAtk;
    const facingOk = plan.atk !== 'side' || !plan.face || P.facing === plan.face;
    if (canAtk && facingOk) {
      v.buttons.attack = true;
      if (plan.atk === 'up') v.buttons.up = true;
      if (plan.atk === 'down') v.buttons.down = true;
      bot.prevAtk = true;
    } else bot.prevAtk = false;
    if (B.hp !== undefined) { if (bot.lastHp !== undefined && B.hp < bot.lastHp) bot.dealt += bot.lastHp - B.hp; bot.lastHp = B.hp; }
  }
}

(async () => {
  const browser = await chromium.launch();
  const bosses = WHICH === 'todos' ? Object.keys(FIGHTS) : [WHICH];
  const profs = PROF === 'todos' ? Object.keys(PROFILES) : [PROF];
  const summary = [];
  for (const boss of bosses) for (const prof of profs) {
    const runs = [];
    for (let i = 0; i < TRIALS; i++) {
      const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
      const errs = [];
      page.on('pageerror', (e) => errs.push(e.message));
      await page.goto(`${BASE}/planolandia/index.html?${FIGHTS[boss].q}`);
      await page.waitForFunction(() => window.PL && PL.debug && PL.debug.game && PL.debug.game.player, null, { timeout: 15000 });
      await page.evaluate(botMain, Object.assign({ boss, speed: 3, maxT: FIGHTS[boss].maxT, trace: !!process.env.TRACE }, PROFILES[prof]));
      const t0 = Date.now();
      let r = null;
      while (Date.now() - t0 < 200000) {
        await new Promise((res) => setTimeout(res, 500));
        if (process.env.TRACE && r && r.result) break;
        r = await page.evaluate(() => {
          const g = PL.debug.game, b = window.BOT, B = g.boss;
          return { result: b.result, t: +b.t.toFixed(1), hurts: b.hurts, lados: g.save.lados, bossHp: B ? B.hp : null, bossState: B ? B.state : null, phase: b.maxPh, dealt: b.dealt };
        });
        if (r.result) break;
      }
      r.errs = errs;
      runs.push(r);
      const byState = {};
      for (const h of r.hurts) byState[h.st] = (byState[h.st] || 0) + 1;
      if (process.env.DETALHE) for (const h of r.hurts) console.log('    ', h.t, h.st, 'y' + h.py, h.near);
      if (process.env.TRACE) { const tr = await page.evaluate(() => window.BOT.trace || []); console.log(tr.slice(0, +process.env.TRACE).join('\n')); }
      console.log(`${boss} · ${prof} · #${i + 1}: ${r.result} em ${r.t}s · lados ${r.lados} · fase ${r.phase} · dano no chefão ${r.dealt} · golpes recebidos ${r.hurts.length} ${JSON.stringify(byState)}${errs.length ? ' · ERROS ' + errs.join(' | ') : ''}`);
      await page.close();
    }
    const wins = runs.filter((r) => r.result === 'venceu');
    summary.push(`${boss} · ${prof}: ${wins.length}/${runs.length} vitórias · tempo médio da vitória ${wins.length ? (wins.reduce((s, r) => s + r.t, 0) / wins.length).toFixed(0) + 's' : '-'} · golpes recebidos (média) ${(runs.reduce((s, r) => s + r.hurts.length, 0) / runs.length).toFixed(1)}`);
  }
  console.log('\n' + summary.join('\n'));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(2); });
