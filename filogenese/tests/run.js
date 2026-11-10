/* Filogênese — testes de lógica sem navegador. Uso: node tests/run.js */
'use strict';
const fs = require('fs'), vm = require('vm'), path = require('path');
const JS = path.join(__dirname, '..', 'js');
globalThis.window = globalThis;
const store = {};
globalThis.localStorage = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } };
const FILES = ['util', 'settings', 'i18n', 'parts', 'species', 'creaturedraw', 'creature', 'world', 'fx', 'ai', 'game', 'progress'];
for (const f of FILES) vm.runInThisContext(fs.readFileSync(path.join(JS, f + '.js'), 'utf8'), { filename: f + '.js' });
const FG = globalThis.FG, G = FG.Game, U = FG.U, Parts = FG.Parts;
FG.setLang('pt');

let pass = 0, fail = 0;
function ok(cond, msg) { if (cond) pass++; else { fail++; console.log('  FALHOU: ' + msg); } }
function section(name, fn) { console.log('• ' + name); fn(); }
const I = { mx: 0, my: 0, sprint: false, sneak: false, events: [], tap: null };
function run(sec, fn) { const dt = 1 / 30; for (let t = 0; t < sec; t += dt) { if (fn && fn(t) === false) break; G.control(I, dt); G.update(dt); } }
function newGame(seed, diet, diff) { G.start({ seed, name: 'Testus', genome: Parts.starterGenome(diet || 'O', seed + 3), diff: diff || 'normal', slot: 0 }); I.mx = I.my = 0; I.events.length = 0; }
const toasts = [];
FG.bus.on('toast', (t) => toasts.push(t));
let editorAsked = 0, deaths = 0, endings = 0;
FG.bus.on('editor', () => editorAsked++);
FG.bus.on('death', () => deaths++);
FG.bus.on('ending', () => endings++);

section('traduções: toda chave usada existe em PT e EN', () => {
  const src = fs.readdirSync(JS).map((f) => fs.readFileSync(path.join(JS, f), 'utf8')).join('\n') + fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const keys = new Set();
  for (const m of src.matchAll(/'((?:ab|ach|b|biome|cat|d|diet|diff|e|ed|fx|g|h|head|hud|i|k|lvl|m|map|n|ng|o|p|pat|react|s|t|ui)\.[A-Za-z0-9_.]+)'/g)) if (!m[1].endsWith('.')) keys.add(m[1]);
  for (const m of src.matchAll(/data-t="([^"$]+)"/g)) keys.add(m[1]);
  for (const p of Parts.defs) keys.add('p.' + p.id);
  for (const a of ['bite', 'charge', 'spit', 'strike', 'sing', 'dance', 'charm', 'pose', 'speed', 'jump', 'swim', 'sense', 'stealth', 'glide']) keys.add('ab.' + a);
  for (const n in FG.Species.NICHES) { keys.add('n.' + n); keys.add('n.' + n + '.d'); }
  for (const r of ['flee', 'neutral', 'defend', 'territorial', 'hunter']) keys.add('react.' + r);
  for (const o of G.OBJ) keys.add('o.' + o.id);
  for (const a of G.ACH) { keys.add('ach.' + a.id); keys.add('ach.' + a.id + '.d'); }
  for (const c of ['body', 'skin'].concat(Parts.CATS)) keys.add('cat.' + c);
  for (const c of Parts.CATS) keys.add('cat.' + c + '.d');
  for (let b = 2; b <= 8; b++) keys.add('biome.' + b);
  for (const d of ['H', 'C', 'O']) { keys.add('diet.' + d); keys.add('diet.' + d + '.d'); }
  for (const d of ['easy', 'normal', 'hard']) { keys.add('diff.' + d); keys.add('diff.' + d + '.d'); }
  for (const i of ['fruit', 'meat', 'egg', 'dig', 'recruit', 'evolve', 'awaken', 'noMeat', 'noFruit']) keys.add('i.' + i);
  for (const l of [2, 3, 4, 5]) keys.add('lvl.' + l);
  for (const k in FG.Settings.defaults) if (!['lang'].includes(k)) keys.add('s.' + k);
  let missing = [];
  for (const k of keys) { if (FG.L.pt[k] == null) missing.push('pt:' + k); if (FG.L.en[k] == null) missing.push('en:' + k); }
  ok(missing.length === 0, 'chaves ausentes: ' + missing.slice(0, 30).join(', '));
  const onlyPt = Object.keys(FG.L.pt).filter((k) => !(k in FG.L.en)), onlyEn = Object.keys(FG.L.en).filter((k) => !(k in FG.L.pt));
  ok(onlyPt.length === 0 && onlyEn.length === 0, 'dicionários diferentes: ' + onlyPt.concat(onlyEn).slice(0, 20).join(', '));
  console.log('  ' + keys.size + ' chaves verificadas');
});

section('partes e genomas', () => {
  const ids = new Set(Parts.defs.map((d) => d.id));
  ok(ids.size === Parts.defs.length, 'ids de partes repetidos');
  for (const d of ['H', 'C', 'O']) {
    const g = Parts.starterGenome(d, 5), st = Parts.stats(g, 1);
    ok(st.diet === d, 'dieta inicial ' + d);
    ok(st.hp > 40 && st.moveSpeed > 90, 'atributos iniciais plausíveis');
    ok(Parts.cost(g) <= 30, 'criatura inicial dentro do orçamento');
  }
  const g = Parts.starterGenome('O', 1); g.legs.pairs = 0;
  ok(Parts.stats(g, 1).jump === 0 && Parts.stats(g, 1).stealth >= 2, 'sem pernas: rasteja');
  ok(Parts.stats(Parts.starterGenome('O', 1), 5).hp > Parts.stats(Parts.starterGenome('O', 1), 1).hp, 'nível cerebral aumenta a vida');
});

section('geração determinística de fauna e mundo', () => {
  for (const seed of [1, 7, 424242]) {
    const a = FG.Species.generate(seed), b = FG.Species.generate(seed);
    ok(a.list.map((s) => s.sci).join() === b.list.map((s) => s.sci).join(), 'fauna igual para a mesma semente ' + seed);
    ok(a.families.length === 8 && a.list.length >= 26 && a.titans.length === 3, 'famílias/espécies/titãs');
    ok(new Set(a.list.map((s) => s.name.pt)).size === a.list.length, 'nomes únicos');
    const niches = new Set(a.list.map((s) => s.niche));
    ok(niches.size >= 8, 'variedade de nichos: ' + niches.size);
    for (const s of a.list) for (const k in s.genome.parts) ok(!s.genome.parts[k] || Parts.byId[s.genome.parts[k]], 'parte válida em ' + s.sci);
    const w1 = new FG.World(seed), w2 = new FG.World(seed);
    w1.populate(a); w2.populate(b);
    ok(w1.nests.map((n) => (n.x | 0) + ':' + n.sp).join() === w2.nests.map((n) => (n.x | 0) + ':' + n.sp).join(), 'ninhos iguais para a mesma semente');
    ok(w1.nests.length >= 40 && w1.fossils.length >= 30 && w1.ownSites.length === 3 && w1.titanSpots.length === 3, 'conteúdo do mundo ' + w1.nests.length + '/' + w1.fossils.length);
    ok(!w1.blocked(w1.start.x, w1.start.y) && w1.wetAt(w1.start.x, w1.start.y) === 0, 'início em terra firme');
    ok(a.list.filter((s) => !s.isTitan).every((s) => s.nestCount > 0), 'toda espécie tem ninho');
    for (const n of w1.nests.slice(0, 3)) ok(FG.Species.NICHES[a.byId[n.sp].niche].react !== 'hunter', 'primeiros ninhos sem caçadores');
    for (const n of w1.nests) ok(w1.reach[w1.gi(n.x, n.y)] === 1, 'ninho alcançável a pé');
  }
});

section('partida: andar, descobrir, socializar até virar aliado', () => {
  newGame(7, 'O');
  const P = () => G.player;
  ok(G.creatures.length > 1, 'ninho próprio povoado');
  const n0 = G.world.nests[0];
  run(60, () => { const d = U.dist(P().x, P().y, n0.x, n0.y); if (d > 190) { const a = Math.atan2(n0.y - P().y, n0.x - P().x); I.mx = Math.cos(a); I.my = Math.sin(a); } else { I.mx = I.my = 0; return false; } });
  ok(U.dist(P().x, P().y, n0.x, n0.y) < 260, 'chegou ao ninho vizinho');
  ok(G.stats.speciesSeen >= 1, 'descobriu uma espécie');
  ok(G.objIdx >= 1, 'objetivo de explorar concluído');
  run(120, () => {
    if (G.stats.allies >= 1) return false;
    if (G.enc) { if (G.enc.phase === 'ask' && P().cd.social <= 0) I.events.push('a' + (Parts.SOCIAL.indexOf(G.enc.want) + 1)); }
    else if (P().cd.social <= 0 && !G.auto) I.events.push('a1');
  });
  ok(G.stats.friends >= 1, 'fez amigos: ' + G.stats.friends);
  ok(G.stats.allies >= 1, 'aliou-se a uma espécie');
  ok(G.dna > 20, 'ganhou DNA: ' + G.dna);
  // come um fruto no arbusto mais próximo
  const b = G.world.findBush(P().x, P().y, 1500);
  ok(!!b, 'há arbusto com frutos por perto');
  P().x = b.x + 30; P().y = b.y; P().settle(); G.hunger = 40; G.setTarget(null);
  run(2);
  ok(G.interactable && G.interactable.type === 'fruit', 'interação de comer fruto: ' + (G.interactable && G.interactable.type));
  const f0 = G.interactable && G.interactable.b ? G.interactable.b.fruit : -1, bb = G.interactable && G.interactable.b;
  I.events.push('interact'); run(1.5);
  ok(G.stats.fruit === 1 && G.hunger > 55 && bb && bb.fruit === f0 - 1, 'comeu o fruto: ' + G.stats.fruit + ' fome ' + (G.hunger | 0) + ' anim ' + (P().anim && P().anim.name));
});

section('salvar e carregar', () => {
  const before = { dna: G.dna, total: G.dnaTotal, x: G.player.x | 0, friends: G.stats.friends, un: G.unlocked.size, rel: JSON.stringify(G.rels) };
  ok(G.save(), 'salvou');
  ok(G.slotInfo(0) && G.slotInfo(0).name === 'Testus', 'resumo do save');
  ok(G.load(0), 'carregou');
  ok(G.dna === before.dna && G.dnaTotal === before.total && (G.player.x | 0) === before.x && G.stats.friends === before.friends && G.unlocked.size === before.un, 'estado restaurado');
  ok(JSON.stringify(G.rels) === before.rel, 'relações restauradas');
  ok(!G.load(2), 'slot vazio não carrega');
  run(3);
});

section('evoluir no ninho pelo editor', () => {
  const P = G.player, H = G.homeNest;
  P.x = H.x + 30; P.y = H.y + 20; P.settle();
  run(0.5);
  ok(G.interactable && G.interactable.type === 'evolve', 'interação de evoluir disponível');
  I.events.push('interact');
  run(5);
  ok(editorAsked === 1 && G.cine && G.cine.type === 'mate', 'cena de acasalamento chama o editor');
  const g = Parts.cloneGenome(G.playerSp.genome);
  g.segs = 10; g.parts.voice = 'v_papo';
  const left = G.dna + Parts.cost(G.playerSp.genome) - Parts.cost(g);
  G.evolve(g, 'Novus', left);
  run(2);
  ok(G.gen === 2 && G.player.bp.n === 10 && G.playerSp.stats.sing >= 2 && FG.spName(G.playerSp) === 'Novus', 'nova geração aplicada');
  ok(!G.cine, 'cena encerrada');
});

section('combate, morte e renascimento', () => {
  G.setStance('combat');
  const P = G.player;
  // encontra a criatura não aliada mais próxima e ataca até abatê-la
  let foe = null;
  const n = G.world.nests.find((q) => G.rel(G.fauna.byId[q.sp]).status === 'neutral' && q.pop > 0);
  P.x = n.x + 120; P.y = n.y; P.settle(); G.spawnTick(); run(1);
  P.maxHp = 9999; P.hp = 9999;
  run(90, () => {
    if (G.stats.kills >= 1) return false;
    if (!foe || foe.dead || foe.gone) { foe = G.creatures.find((c) => !c.dead && !c.sp.isPlayer && c.sp.id === n.sp && !c.baby); if (foe) G.setTarget(foe); }
    if (foe) { P.x = foe.x - 30; P.y = foe.y; if (P.cd.bite <= 0) I.events.push('a1'); }
  });
  ok(G.stats.kills >= 1, 'abateu uma criatura');
  ok(G.rel(G.fauna.byId[n.sp]).kills >= 1, 'abate contado na espécie');
  const car = G.creatures.find((c) => c.dead && c.meat > 0);
  ok(!!car, 'carcaça deixada');
  // extinção
  const sp = G.fauna.byId[n.sp];
  G.rel(sp).kills = sp.needKills - 1;
  const v = G.creatures.find((c) => !c.dead && c.sp === sp && !c.baby) || G.addMember(n, sp, false);
  G.hit(P, v, 99999, { kind: 'bite' });
  ok(G.rel(sp).status === 'extinct' && G.stats.extinct === 1, 'espécie extinta');
  // morte
  const dna0 = G.dna;
  G.kill(P, null);
  ok(deaths === 1 && G.cine && G.cine.type === 'death', 'morte registrada');
  run(1);
  G.respawn();
  ok(!G.player.dead && G.player !== P && G.player.isPlayer && G.dna === dna0, 'renasceu no ninho sem perder DNA (normal)');
  run(2);
});

section('níveis, bando, migração, viagem e despertar', () => {
  G.setStance('social');
  G.addDna(100, null);
  ok(G.level === 2 && G.packMax() === 1, 'nível 2 libera o bando');
  const H = G.homeNest, P = G.player;
  if (!H.spawned) G.spawnNest(H, G.playerSp);
  const m = H.members[0];
  ok(G.recruit(m) && G.pack.length === 1 && m.ai.pack, 'recrutou um membro');
  run(3);
  G.dismiss(m);
  ok(G.pack.length === 0, 'dispensou');
  G.addDna(200, null);
  ok(G.level === 3 && G.home === 1, 'nível 3 dispara a migração');
  const s1 = G.world.ownSites[1];
  G.travelTo(s1.x + 40, s1.y + 30);
  run(1);
  ok(G.arrived === 1, 'chegada ao novo ninho reconhecida');
  G.addDna(1300, null);
  ok(G.level === 5 && G.home === 2, 'nível 5 e segunda migração');
  const s2 = G.world.ownSites[2];
  G.travelTo(s2.x + 30, s2.y + 20);
  run(1);
  ok(G.dnaTotal >= G.SAPIENCE && G.interactable && G.interactable.type === 'awaken', 'despertar disponível');
  I.events.push('interact');
  run(8);
  ok(G.won && endings === 1, 'final alcançado');
  ok(G.objIdx >= 4, 'objetivos avançaram: ' + G.objIdx);
  ok(['diplomat', 'predator', 'adaptable'].includes(G.pathTitle()), 'título do final');
  ok(G.save() && G.load(0) && G.won && G.home === 2 && G.level === 5, 'save pós-final');
});

section('habilidades de combate, salto e ovos', () => {
  newGame(7, 'C');
  let P = G.player;
  Object.assign(G.playerSp.genome.parts, { horn: 'h_ariete', gland: 'g_acida', arms: 'a_garra', feet: 'f_mola', back: 'b_asas' });
  FG.Species.refresh(G.playerSp); P.rebuild();
  ok(P.stats.charge === 4 && P.stats.spit === 3 && P.stats.strike === 2 && P.stats.jump >= 4 && P.stats.glide === 3, 'partes dão as habilidades esperadas');
  G.setStance('combat');
  const sp = G.fauna.list.find((q) => !q.isTitan && FG.Species.NICHES[q.niche].react === 'neutral');
  const dummy = (dx) => { const c = new FG.Creature(sp, P.x + dx, P.y); FG.AI.init(c, { x: c.x, y: c.y }); c.maxHp = c.hp = 5000; G.creatures.push(c); return c; };
  const keep = () => { P.hp = P.maxHp; G.hunger = 90; };
  // cuspe à distância, com veneno
  let t = dummy(210); G.setTarget(t);
  I.events.push('a3'); run(1.2, keep);
  ok(t.hp < 5000 && t.poison > 0, 'cuspe acerta e envenena');
  ok(G.rel(sp).anger > 0, 'atacar irrita a espécie');
  // investida: avança, acerta e atordoa
  t.x = P.x + 230; t.y = P.y; t.vx = t.vy = 0; t.stun = 0; t.ai.st = 'idle';
  const hp1 = t.hp, x1 = P.x;
  P.cd.charge = 0; I.events.push('a2'); run(0.15, keep);
  ok(P.dash > 0 || P.x > x1 + 20, 'investida dispara para o alvo');
  run(0.8, keep);
  ok(t.hp < hp1 - 20, 'investida causa dano');
  // golpe em área atinge quem está colado
  t.x = P.x + P.reach * 0.8; t.y = P.y; P.angle = 0; t.stun = 5;
  const hp2 = t.hp; P.cd.strike = 0; P.anim = null;
  G.useAbility(P, 'strike', t); run(0.6, keep);
  ok(t.hp < hp2, 'golpe atinge o alvo');
  // espinhos devolvem dano
  const thorny = G.fauna.list.find((q) => q.stats.thorns > 0);
  if (thorny) { const c = new FG.Creature(thorny, P.x + 20, P.y); FG.AI.init(c, { x: c.x, y: c.y }); G.creatures.push(c); const h0 = P.hp = P.maxHp; G.hit(P, c, 5, { kind: 'bite' }); ok(P.hp < h0, 'espinhos ferem quem morde'); c.gone = true; }
  t.gone = true; G.setTarget(null); run(0.2, keep);
  // salto e planeio
  I.events.push('jump'); run(0.2, keep);
  ok(P.jz > 5, 'saltou');
  let air = 0; run(4, () => { keep(); if (P.jz > 0) air += 1 / 30; else return false; });
  ok(P.jz === 0 && air > 0.5, 'planou e pousou (' + air.toFixed(2) + ' s no ar)');
  // comer ovo de outra espécie irrita os donos
  const n = G.world.nests.find((q) => q.eggs > 0 && G.rel(G.fauna.byId[q.sp]).status === 'neutral' && G.fauna.byId[q.sp] !== sp);
  G.rel(G.fauna.byId[n.sp]).anger = 0;
  P.x = n.x + 10; P.y = n.y; P.settle(); P.anim = null; G.hunger = 20; run(0.4, () => { P.hp = P.maxHp; });
  const e0 = n.eggs, it = G.scanInteract();
  ok(it && (it.type === 'egg' || it.type === 'meat' || it.type === 'dig'), 'interação no ninho alheio: ' + (it && it.type));
  if (it && it.type === 'egg') { G.interact(); ok(n.eggs === e0 - 1 && G.hunger > 40 && G.rel(G.fauna.byId[n.sp]).anger > 0, 'comeu o ovo e irritou a espécie'); }
});

section('simulação longa do ecossistema (sem exceções)', () => {
  for (const [seed, diet, diff] of [[11, 'H', 'easy'], [222, 'C', 'hard'], [3333, 'O', 'normal']]) {
    newGame(seed, diet, diff);
    const r = U.rng(seed);
    let tgt = null, hold = 0;
    const t0 = Date.now();
    run(240, (t) => {
      const P = G.player;
      if (P.dead) { if (G.cine && G.cine.type === 'death' && G.cine.t > 1) G.respawn(); return; }
      if (G.cine && G.cine.type === 'mate' && G.cine.step === 3) G.cancelEvolve();
      if ((hold -= 1 / 30) <= 0) {
        hold = 3 + r() * 6;
        const n = G.world.nests[(r() * 12) | 0];
        tgt = { x: n.x + r.range(-200, 200), y: n.y + r.range(-200, 200) };
        if (r() < 0.3) I.events.push('stance');
        I.sprint = r() < 0.3; I.sneak = r() < 0.2;
      }
      const a = Math.atan2(tgt.y - P.y, tgt.x - P.x);
      I.mx = Math.cos(a); I.my = Math.sin(a);
      if (r() < 0.05) I.events.push('a' + (1 + ((r() * 4) | 0)));
      if (r() < 0.03) I.events.push('interact');
      if (r() < 0.01) I.events.push('jump');
      if (r() < 0.01) I.events.push('next');
      if (Math.abs(t - 120) < 0.02) { G.day = 0.75; G.addDna(300, P.x, P.y); }
    });
    const bad = G.creatures.filter((c) => !isFinite(c.x) || !isFinite(c.y) || !isFinite(c.hp));
    ok(bad.length === 0, 'sem NaN nas criaturas');
    ok(isFinite(G.player.x) && isFinite(G.hunger) && isFinite(G.dna), 'estado finito');
    ok(G.creatures.length < 140, 'população ativa sob controle: ' + G.creatures.length);
    console.log(`  semente ${seed} (${diet}/${diff}): ${Date.now() - t0} ms para 240 s · criaturas ${G.creatures.length} · nível ${G.level} · amigos ${G.stats.friends} · abates ${G.stats.kills} · mortes ${G.stats.deaths} · espécies ${G.stats.speciesSeen}`);
  }
});

console.log(`\n${pass} verificações passaram, ${fail} falharam`);
process.exit(fail ? 1 : 0);
