/* Mutatrix: inicialização, laço de jogo, fluxo do laboratório, entrada e renderização da cena em pixel art (PixiJS). */
(function () {
  'use strict';
  const MX = window.MX;
  const { Data, Genetics, Subject, Contracts, Economy, Save, Words, RNG, Pix: X, Lab, Creature, FX, VirusArt, Audio } = MX;
  const PAL = X.PAL;
  const TAU = Math.PI * 2;
  const R = Math.round;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
  const easeOutBack = (k) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(k - 1, 3) + c1 * Math.pow(k - 1, 2); };

  const G = {
    state: null, settings: null, screen: 'title',
    virus: null, phase: 'idle', anim: null, glass: [],
    queue: [], step: null,
    machine: { synth: 0, synthDur: 0, shake: 0, flow: 0, status: 'PRONTA' },
    syr: { x: 0, y: 0, ang: -0.25, drag: false, fly: null },
    L: null, bgDirty: true,
    W: 0, H: 0, P: 3, lw: 0, lh: 0, level: 2,
    time: 0, last: 0, frames: [], fps: 60, autoT: 0,
    pointer: { x: 0, y: 0, down: false, sx: 0, sy: 0, mode: null, moved: 0, t0: 0, lastX: 0 },
    par: { x: 0, y: 0, tx: 0, ty: 0 },
    quipT: 20, saveT: 0, crate: null, puddle: null,
    titleBugs: [], reduced: false,
  };
  MX.Game = { G };
  const layers = {};

  const rand = Math.random;
  const pick = (a) => a[Math.floor(rand() * a.length)];

  // ---------------------------------------------------------------- utilidades
  function quip(kind) { const l = Words.QUIPS[kind]; if (l) MX.UI.term(pick(l)); }
  function vibrate(ms) { if (G.settings.vibrate && navigator.vibrate) try { navigator.vibrate(ms); } catch (e) { /* ignorado */ } }
  function save() { if (G.state && G.state.started) Save.save(G.state); }
  function sfx(name, ...a) { if (Audio.ready && Audio.sfx[name]) Audio.sfx[name](...a); }
  function fast() { return G.settings.fastAnim; }
  function busy() { return G.phase !== 'idle'; }

  function applySettings() {
    const s = G.settings;
    Audio.setVolumes(s.master, s.music, s.sfx);
    const mq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)').matches : false;
    G.reduced = s.reducedMotion === null ? mq : !!s.reducedMotion;
    FX.configure({ shake: s.shake && !G.reduced, flashes: s.flashes, reduced: G.reduced });
    document.documentElement.style.setProperty('--text-scale', s.textScale);
    document.documentElement.classList.toggle('reduced', G.reduced);
    G.level = s.quality === 'low' ? 0 : s.quality === 'medium' ? 1 : 2;
    X.setQuality(G.level);
    FX.setLimits(G.level);
    G.bgDirty = true;
    resize();
  }

  // ---------------------------------------------------------------- tamanho e camadas
  // A cena é desenhada em resolução baixa e ampliada por um fator inteiro (pixels nítidos).
  function resize() {
    const app = X.app;
    if (!app) return;
    const W = window.innerWidth, H = window.innerHeight;
    const portrait = H > W * 1.05 || W < 640;
    const div = G.settings.quality === 'high' ? 330 : G.settings.quality === 'low' ? 205 : 250;
    const P = portrait ? clamp(R(W / (div * 0.8)), 2, 7) : clamp(R(H / div), 2, 7);
    G.W = W; G.H = H; G.P = P;
    G.lw = Math.ceil(W / P); G.lh = Math.ceil(H / P);
    app.renderer.resize(G.lw, G.lh);
    app.canvas.style.width = G.lw * P + 'px'; app.canvas.style.height = G.lh * P + 'px';
    const rc = MX.UI ? MX.UI.sceneRect(W, H) : { x: 0, y: 0, w: W, h: H };
    G.L = Lab.layout(G.lw, G.lh, { x: R(rc.x / P), y: R(rc.y / P), w: R(rc.w / P), h: R(rc.h / P) });
    G.bgDirty = true;
    if (!G.syr.drag && !G.syr.fly) { G.syr.x = G.L.syringe.x; G.syr.y = G.L.syringe.y; }
  }

  // ---------------------------------------------------------------- cobaia
  function newAnim(sub) {
    return {
      yaw: Creature.DEF[sub.host].baseYaw, user: 0, yawVel: 0, squash: 0, blink: 0, nextBlink: 2, lx: 0, ly: 0, mouth: 0, hic: 0, reveal: 0,
      hidden: new Set(), born: new Map(), pulse: new Map(), tele: null, speech: null, collapse: null, emitPts: [],
      timers: { talk: 3 + rand() * 4, sing: 1.2, hic: 2 + rand() * 3, laser: 3 + rand() * 3, tele: 5 + rand() * 3, emit: 0 },
      danger: new Map(), pokes: 0,
    };
  }
  function creaturePos() {
    const L = G.L, a = G.anim;
    return { x: R(L.cx + G.par.x * 0.6 + (a && a.tele ? a.tele.x * L.cs : 0)), y: R(L.floorY + G.par.y * 0.6), s: L.cs };
  }

  // ---------------------------------------------------------------- ações do jogador
  const act = {};
  MX.Game.act = act;

  act.newGame = () => {
    const begin = () => {
      G.state = Economy.newState();
      G.state.started = true;
      for (let i = 0; i < 3; i++) G.state.contracts.push(newContract());
      G.state.design.seed = RNG.randomSeedString(5);
      enterLab(true);
    };
    if (Save.load()) MX.UI.confirm('Começar um laboratório novo apaga o progresso salvo. Continuar?', 'Apagar e começar', begin);
    else begin();
  };
  act.continueGame = () => {
    const s = Save.load();
    if (!s) return act.newGame();
    G.state = s;
    if (G.state.subject && !G.state.subject.alive) G.state.subject = null;
    while (G.state.contracts.length < 3) G.state.contracts.push(newContract());
    enterLab(false);
  };
  function enterLab(first) {
    Audio.unlock();
    G.screen = 'lab';
    G.virus = null; G.phase = 'idle'; G.glass = []; G.puddle = null;
    G.anim = G.state.subject ? newAnim(G.state.subject) : null;
    FX.clear();
    MX.UI.title(false);
    applySettings();
    Audio.setMood({ mode: 'lab', intensity: 0, wobble: 0 });
    Audio.startMusic();
    quip('welcome');
    if (first) setTimeout(() => hint('start'), 1200);
    MX.UI.refresh();
    save();
  }
  act.toTitle = () => {
    save();
    G.screen = 'title';
    MX.UI.closeModal();
    MX.UI.title(true, !!Save.load());
    Audio.setMood({ mode: 'title', intensity: 0, wobble: 0 });
  };
  function hint(key) {
    if (!G.settings.hints || G.state.hints[key]) return;
    G.state.hints[key] = 1;
    if (document.body.classList.contains('portrait')) MX.UI.term('Dica: ' + Words.HINTS[key]);
    else MX.UI.toast(Words.HINTS[key], 'hint', 6500);
  }
  function newContract() {
    G.state.seq.contract++;
    return Contracts.generate(RNG.make('ct:' + G.state.seq.contract + ':' + Date.now() + ':' + rand()), G.state, G.state.seq.contract);
  }

  act.pickHost = (hostId) => {
    if (busy() || (G.state.subject && G.state.subject.alive)) return;
    const cost = Economy.hostCost(hostId);
    if (!Economy.spend(G.state, cost)) { quip('noCredits'); MX.UI.toast('Créditos insuficientes para esta cobaia.', 'bad'); sfx('error'); return; }
    G.state.seq.subject++;
    G.state.hints.start = 1;
    const sub = Subject.create(hostId, RNG.randomSeedString(6), G.state.seq.subject);
    G.state.subject = sub;
    G.anim = newAnim(sub);
    G.anim.drop = G.time;
    G.glass = []; G.puddle = null; G.virus = null;
    sfx('creature', hostId); sfx('pop');
    FX.burst('poof', G.L.cx, G.L.floorY - G.L.cs * 0.5, 10, { speed: 40, size: 4, life: 0.6, drag: 0.9 });
    quip('newSubject');
    MX.UI.refresh();
    setTimeout(() => hint('compose'), 900);
    save();
  };

  act.setCapsid = (id) => { if (busy() || !G.state.unlocked.capsids.includes(id)) return; G.state.design.capsid = id; sfx('click'); designChanged(); };
  act.setSlot = (i, theme, pot) => {
    if (busy() || i >= G.state.unlocked.slots) return;
    G.state.design.slots[i] = theme ? { theme, pot: pot || 1 } : null;
    sfx(theme ? 'bubble' : 'click');
    designChanged();
  };
  act.setDial = (name, v) => { G.state.design[name] = clamp(R(v), 0, 100); designChanged(true); };
  act.setSeed = (str) => { const d = Genetics.normalizeDesign(Object.assign({}, G.state.design, { seed: str })); G.state.design.seed = d.seed; designChanged(true); };
  act.randomSeed = () => { G.state.design.seed = RNG.randomSeedString(5); sfx('tick'); designChanged(); };
  act.randomRecipe = () => {
    if (busy()) return;
    const u = G.state.unlocked, d = G.state.design;
    d.capsid = pick(u.capsids);
    const n = 1 + Math.floor(rand() * u.slots);
    for (let i = 0; i < 6; i++) d.slots[i] = i < n ? { theme: pick(u.themes), pot: 1 + Math.floor(rand() * 3) } : null;
    d.virulence = R(rand() * 100); d.chaos = R(rand() * 70);
    d.seed = RNG.randomSeedString(5);
    sfx('bubble');
    designChanged();
  };
  act.pasteCode = (code) => {
    const d = Genetics.decode(code);
    if (!d) return { ok: false, reason: 'Código inválido. Confira as letras e os números.' };
    const u = G.state.unlocked;
    const missing = [];
    if (!u.capsids.includes(d.capsid)) missing.push('capsídeo ' + Data.CAPSID[d.capsid].name);
    d.slots.forEach((s, i) => { if (s && !u.themes.includes(s.theme)) missing.push('reagente ' + Data.THEME[s.theme].name); if (s && i >= u.slots) missing.push('encaixe ' + (i + 1)); });
    if (missing.length) return { ok: false, reason: 'Falta liberar: ' + Array.from(new Set(missing)).join(', ') + '.' };
    G.state.design = d;
    designChanged();
    return { ok: true };
  };
  function designChanged(soft) {
    G.previewKey = null;
    MX.UI.refresh({ panel: !soft, soft: !!soft });
    clearTimeout(G.saveDesignT);
    G.saveDesignT = setTimeout(save, 600);
  }
  function preview() {
    const key = Genetics.designKey(Genetics.normalizeDesign(G.state.design));
    if (G.previewKey !== key) { G.previewKey = key; G.previewVirus = Genetics.synthesize(G.state.design); }
    return G.previewVirus;
  }
  MX.Game.preview = preview;

  act.synth = () => {
    if (busy() || !G.state.subject || !G.state.subject.alive) return;
    if (G.virus) { MX.UI.toast('Já há uma cepa pronta. Injete ou descarte antes.', 'bad'); return; }
    const v = Genetics.synthesize(G.state.design);
    if (!v) { MX.UI.toast('Encaixe ao menos um reagente na fita genética.', 'bad'); sfx('error'); return; }
    const cost = Economy.synthCost(G.state.design);
    if (!Economy.spend(G.state, cost)) { quip('noCredits'); MX.UI.toast('Créditos insuficientes para sintetizar.', 'bad'); sfx('error'); return; }
    G.phase = 'synth';
    const dur = fast() ? 0.9 : 2.6;
    G.machine.synth = 1; G.machine.synthDur = dur; G.machine.t0 = G.time; G.machine.status = 'SÍNTESE';
    G.pendingVirus = v;
    sfx('whir', dur);
    Audio.setMood({ intensity: 1 });
    quip('synth');
    vibrate(30);
    MX.UI.busy('Sintetizando ' + v.name + '...');
  };
  function finishSynth() {
    const v = G.pendingVirus;
    G.pendingVirus = null;
    G.virus = v;
    G.machine.synth = 0; G.machine.status = 'CEPA OK';
    G.phase = 'idle';
    G.state.stats.synth++;
    G.state.strains.unshift({ code: v.code, name: v.name, date: Date.now() });
    if (G.state.strains.length > 40) G.state.strains.length = 40;
    Audio.setMood({ intensity: 0 });
    sfx('ding');
    FX.burst('star', G.L.mach.x, G.L.mach.bottom - G.L.U(16), 10, { speed: 35, size: 2, life: 0.7, color: 0xfff3a0 });
    quip('vial');
    MX.UI.busy(null);
    MX.UI.refresh();
    hint('vial');
    save();
  }
  act.discard = () => {
    if (busy() || !G.virus) return;
    G.virus = null; G.machine.status = 'PRONTA';
    sfx('splash');
    MX.UI.refresh();
  };
  act.inject = () => {
    if (busy() || !G.virus || !G.state.subject || !G.state.subject.alive) return;
    const cp = creaturePos();
    G.syr.fly = { x0: G.syr.x, y0: G.syr.y, x1: cp.x + G.L.cs * 0.9, y1: cp.y - G.L.cs * 0.6, t: 0, dur: fast() ? 0.35 : 0.7 };
    G.syr.drag = false;
    G.phase = 'inject';
    MX.UI.busy('Injetando...');
  };

  function runInject() {
    const st = G.state, sub = st.subject, v = G.virus;
    G.virus = null; G.machine.status = 'PRONTA';
    const res = Subject.inject(sub, v);
    st.stats.inject++;
    sfx('inject'); vibrate(40);
    const cp = creaturePos();
    FX.burst('poof', cp.x, cp.y - G.L.cs * 0.5, 6, { speed: 22, size: 2, life: 0.5 });
    const Q = [];
    const a = G.anim;
    if (res.rejected) {
      st.stats.reject++;
      Q.push({ t: 'reject', dur: 1.6 });
    } else {
      for (const m of res.added) { a.hidden.add(m.uid); Q.push({ t: 'reveal', m, dur: fast() ? 0.8 : 1.5 }); st.stats.mutations++; }
      for (const m of res.intensified) Q.push({ t: 'intensify', m, dur: fast() ? 0.6 : 1.1 });
      for (const ev of res.events) { const i = Q.findIndex((q) => q.m === ev.mutation); Q.splice(i + 1, 0, { t: 'event', ev, dur: Data.EVENTS[ev.event].dur }); }
      for (const syn of res.synergies) Q.push({ t: 'synergy', syn, dur: fast() ? 0.9 : 1.5 });
      if (res.warn && !res.collapse) Q.push({ t: 'warn', level: res.warn, dur: 1.2 });
      if (res.collapse) Q.push({ t: 'collapse', c: res.collapse, dur: fast() ? 2.4 : 3.6 });
    }
    Q.push({ t: 'done', dur: 0.05 });
    for (const m of res.added) if (Economy.discover(st, 'arch', m.arch + '|' + sub.host, { theme: m.theme, name: m.name, date: Date.now() })) m.isNew = true;
    for (const syn of res.synergies) if (Economy.discover(st, 'syn', syn.id, { date: Date.now() })) syn.isNew = true;
    for (const ev of res.events) { if (Economy.discover(st, 'ev', ev.event, { date: Date.now() })) ev.isNew = true; st.stats.events++; Economy.addDamage(st, Data.EVENTS[ev.event].damage); }
    if (res.collapse) {
      if (Economy.discover(st, 'col', res.collapse.id, { date: Date.now(), host: sub.host })) res.collapse.isNew = true;
      Economy.earn(st, res.collapse.payout);
      st.stats.collapses++;
    }
    G.milestones = (G.milestones || []).concat(Economy.checkMilestones(st));
    G.lastRes = res;
    G.queue = Q;
    G.phase = 'seq';
    G.step = null;
    MX.UI.busy('Observando a cobaia...');
    save();
  }

  function startStep(q) {
    const a = G.anim, sub = G.state.subject, L = G.L;
    const cp = creaturePos();
    q.t0 = G.time;
    switch (q.t) {
      case 'reject':
        sfx('sneeze');
        a.squash = 1;
        setTimeout(() => { FX.burst('puff', cp.x + L.cs * 0.6, cp.y - L.cs * 0.8, 14, { speed: 55, size: 3, grow: 4, life: 0.8, color: 0xe2ffc0 }); FX.shake(2, 0.2); }, 380);
        quip('reject');
        MX.UI.eventCard('Rejeição', 'A cobaia espirrou o vírus de volta. Nenhuma mutação. Instabilidade +2%.', 'reject');
        break;
      case 'reveal': {
        const m = q.m;
        a.hidden.delete(m.uid); a.born.set(m.uid, G.time); a.reveal = 1; a.squash = 0.6;
        sfx('chime', m.sev);
        const th = Data.THEME[m.theme];
        FX.burst('star', cp.x, cp.y - L.cs * 0.7, 12, { speed: 50, size: 2, life: 0.7, colors: [th.color, th.color2, '#ffffff'] });
        if (m.render.part) for (let i = 0; i < 6; i++) FX.themeParticle(m.theme, cp.x + (rand() - 0.5) * L.cs, cp.y - L.cs * rand(), L.u);
        if (m.sevIdx >= 2) FX.shake(m.sevIdx === 3 ? 3 : 2, 0.3);
        MX.UI.mutCard(m, sub);
        quip(m.sev);
        if (m.render.beh === 'sing' || m.render.beh === 'talk') a.timers.sing = 0.4;
        break;
      }
      case 'intensify':
        a.pulse.set(q.m.uid, G.time); a.reveal = 0.7;
        sfx('chime', q.m.sev);
        MX.UI.mutCard(q.m, sub, true);
        break;
      case 'event': {
        const id = q.ev.event;
        MX.UI.eventCard(Data.EVENTS[id].name, Data.EVENTS[id].desc, 'event', q.ev.isNew);
        quip('event');
        sfx('alarm');
        if (id === 'terremoto' || id === 'buraco') sfx('boom');
        if (id === 'inundacao') sfx('splash');
        if (id === 'blecaute') sfx('zap');
        if (id === 'onda') { sfx('crack'); FX.flash(0xffffff, 0.2, 0.5); }
        FX.shake(3, 0.5);
        vibrate([60, 40, 60]);
        q.waiting = true;
        FX.startEvent(id, L, Data.EVENTS[id], (e) => {
          for (const d of e.decals) Economy.addDamage(G.state, 0, d);
          if (e.glass) for (let i = 0; i < 4; i++) G.glass.push({ type: 'crack', x: rand() * 1.6 - 0.8, y: 0.2 + rand() * 0.6, r: rand() * TAU });
          G.bgDirty = true;
          q.waiting = false; q.dur = 0;
          save();
        });
        break;
      }
      case 'synergy':
        sfx('synergy');
        FX.burst('ring', cp.x, cp.y - L.cs * 0.5, 3, { speed: 3, size: 6, grow: 70, life: 1, color: Data.THEME[q.syn.a].color, drag: 1 });
        MX.UI.synCard(q.syn);
        quip('synergy');
        break;
      case 'warn':
        sfx('alarm');
        quip(q.level >= 85 ? 'warn85' : 'warn60');
        MX.UI.toast(q.level >= 85 ? 'Instabilidade crítica: mais uma dose pode causar colapso.' : 'Instabilidade acima de 60%. A cobaia está tremendo.', 'warn', 4000);
        break;
      case 'collapse':
        a.collapse = { id: q.c.id, t0: G.time, p: 0, fired: {} };
        sfx('alarm');
        Audio.setMood({ mode: 'collapse', wobble: 1 });
        MX.UI.clearCards();
        quip('collapse');
        break;
      case 'done':
        finishSeq();
        break;
      default: break;
    }
  }

  function collapseFx(a, p) {
    const L = G.L, c = a.collapse, cp = creaturePos(), u = L.u;
    const once = (k, at, fn) => { if (p >= at && !c.fired[k]) { c.fired[k] = 1; fn(); } };
    const col = Data.THEME[(G.state.subject.mutations[0] || { theme: 'musical' }).theme].color;
    const cy = cp.y - L.cs * 0.6;
    switch (c.id) {
      case 'confete':
        once('a', 0.62, () => { FX.burst('confetti', cp.x, cy, 90, { speed: 150 * u, size: 2, life: 2.2, g: 140 * u, drag: 0.96, colors: [PAL.pink, PAL.yellow, PAL.cyan, PAL.orange, PAL.purple] }); FX.burst('goo', cp.x, cy, 16, { speed: 110 * u, size: 3, life: 1.6, g: 180 * u, color: col }); FX.flash(0xffffff, 0.25); FX.shake(5, 0.5); sfx('boom'); sfx('pop'); for (let i = 0; i < 6; i++) G.glass.push({ type: 'goo', x: rand() * 1.6 - 0.8, y: 0.2 + rand() * 0.6, r: rand(), c: col }); });
        break;
      case 'derretimento':
        if (rand() < 0.4) FX.spawn('drip', cp.x + (rand() - 0.5) * L.cs * 1.5, cy, { vy: 20 * u, g: 110 * u, life: 0.6, size: 2, color: col });
        once('a', 0.95, () => { G.puddle = { color: col }; sfx('slurp'); });
        break;
      case 'ascensao':
        if (rand() < 0.6) FX.spawn('star', cp.x + (rand() - 0.5) * L.cs, cy - p * p * L.cs * 6, { life: 0.8, size: 2, color: 0xfff3a0 });
        once('a', 0.05, () => sfx('ding'));
        break;
      case 'fuga':
        if (rand() < 0.15) FX.spawn('poof', cp.x, L.floorY, { life: 0.5, size: 2, grow: 4 });
        once('a', 0.9, () => { sfx('squeak'); FX.burst('poof', L.vent.x, L.vent.y, 8, { speed: 22, size: 3, life: 0.6 }); });
        break;
      case 'petrificacao':
        once('a', 0.4, () => { sfx('crack'); FX.burst('puff', cp.x, cy, 16, { speed: 45, size: 3, grow: 4, life: 1, color: 0xc9c9c0 }); FX.shake(3, 0.3); });
        break;
      case 'fusao':
        if (rand() < 0.5) FX.spawn('spark', cp.x + (L.mach.x - cp.x) * p, cy, { vx: (rand() - 0.5) * 80, vy: (rand() - 0.5) * 80, life: 0.3, size: 3, color: PAL.pink });
        once('a', 0.85, () => { sfx('servo'); sfx('ding'); G.state.tentacleUntil = Date.now() + 10 * 60 * 1000; FX.shake(3, 0.3); });
        break;
      case 'implosao':
        once('a', 0.92, () => { FX.flash(0xffffff, 0.3); FX.burst('star', cp.x, cy, 40, { speed: 130 * u, size: 2, life: 1.2, colors: [0xfff3a0, 0xc9b8ff, PAL.pink] }); sfx('boom'); FX.shake(5, 0.4); });
        break;
      case 'florescimento':
        if (rand() < 0.7) FX.spawn('petal', cp.x + (rand() - 0.5) * L.cs * 2, cy + (rand() - 0.5) * L.cs, { vx: (rand() - 0.5) * 25, vy: -30 * rand(), g: 25, life: 1.6, size: 2, vr: rand() * 4, color: pick([PAL.pink, PAL.yellow, PAL.white, PAL.orange]) });
        once('a', 0.85, () => { FX.burst('leaf', cp.x, cy, 30, { speed: 90 * u, size: 2, life: 1.6, g: 45 * u, colors: [PAL.green, PAL.lime] }); sfx('rustle'); });
        break;
      case 'curto':
        if (rand() < 0.5) FX.spawn('spark', cp.x + (rand() - 0.5) * L.cs, cy + (rand() - 0.5) * L.cs, { vx: (rand() - 0.5) * 150, vy: (rand() - 0.5) * 150, life: 0.3, size: 3, color: 0xffe066 });
        if (rand() < 0.2) sfx('zap');
        once('a', 0.7, () => { FX.burst('piece', cp.x, cy, 18, { speed: 130 * u, size: 2, life: 2, g: 220 * u, colors: [PAL.silver, PAL.slate, PAL.yellow, PAL.pink], floor: L.floorY, bounce: 0.4 }); FX.burst('smoke', cp.x, cy, 10, { speed: 20, size: 5, grow: 8, life: 2, color: 0x6d6c64 }); sfx('boom'); FX.shake(4, 0.4); });
        break;
      case 'mitose':
        once('a', 0.85, () => { FX.burst('bubble', cp.x, cy, 40, { speed: 110 * u, size: 3, life: 1.2, color: PAL.cyan }); for (let i = 0; i < 8; i++) setTimeout(() => sfx('pop'), i * 60); });
        break;
      default: break;
    }
  }

  function finishSeq() {
    const res = G.lastRes, sub = G.state.subject;
    G.phase = 'idle'; G.queue = []; G.step = null;
    MX.UI.busy(null);
    if (res && res.collapse) {
      const c = res.collapse;
      let shelved = false;
      if (c.id === 'petrificacao' && sub && G.state.shelf.length < G.state.unlocked.shelf) {
        const statue = JSON.parse(JSON.stringify(sub));
        statue.mutations.push(MX.Mutations.instantiate({ theme: 'osseo', group: 'corpo', arch: 'pedra', sev: 'inofensiva', seed: 7 }, sub.host, { uid: 999 }));
        G.state.shelf.push({ sub: statue, date: Date.now(), statue: true });
        shelved = true;
        G.bgDirty = true;
      }
      G.state.subject = null; G.anim = null; G.glass = [];
      Audio.setMood({ mode: 'lab', wobble: 0 });
      if (sub) MX.UI.obituary(c, sub, shelved);
    } else if (sub) {
      Audio.setMood({ wobble: Math.max(0, (sub.instab - 50) / 50) });
      hint('observe');
      if (G.state.stats.inject >= 2) setTimeout(() => hint('contracts'), 2500);
    }
    for (const m of (G.milestones || [])) MX.UI.toast('Marco da Mutapédia: ' + m.text, 'good', 6000);
    G.milestones = [];
    MX.UI.refresh();
    save();
  }

  act.stabilize = () => {
    const sub = G.state.subject;
    if (busy() || !sub || !sub.alive) return;
    if (G.state.stabilizers <= 0) { MX.UI.toast('Sem Estabilizadores. Compre na loja.', 'bad'); sfx('error'); return; }
    if (sub.instab <= 0) { MX.UI.toast('A cobaia já está estável.', 'info'); return; }
    G.state.stabilizers--;
    Subject.stabilize(sub);
    G.anim.squash = 0.6;
    sfx('inject'); sfx('ding');
    const cp = creaturePos();
    FX.burst('bubble', cp.x, cp.y - G.L.cs * 0.6, 14, { speed: 40, size: 2, life: 1, color: PAL.mint });
    Audio.setMood({ wobble: Math.max(0, (sub.instab - 50) / 50) });
    quip('stabilize');
    MX.UI.refresh();
    save();
  };
  act.shelve = () => {
    const sub = G.state.subject;
    if (busy() || !sub || !sub.alive) return;
    if (G.state.shelf.length >= G.state.unlocked.shelf) { MX.UI.toast('A prateleira está cheia. Compre mais espaço ou esvazie um pote na Mutapédia.', 'bad', 5000); return; }
    G.state.shelf.push({ sub: JSON.parse(JSON.stringify(sub)), date: Date.now() });
    G.state.stats.shelved++;
    G.state.subject = null; G.anim = null; G.glass = []; G.virus = null;
    G.bgDirty = true;
    sfx('pop'); sfx('ding');
    quip('shelf');
    MX.UI.refresh();
    save();
  };
  act.unshelve = (i) => { G.state.shelf.splice(i, 1); G.bgDirty = true; sfx('splash'); MX.UI.refresh(); save(); };
  act.retire = () => {
    const sub = G.state.subject;
    if (busy() || !sub || !sub.alive) return;
    MX.UI.confirm('Aposentar ' + sub.name + ' no Sítio da Vó Gertrudes? A cobaia sai do laboratório.', 'Aposentar', () => {
      G.state.subject = null; G.anim = null; G.glass = []; G.virus = null;
      G.state.stats.retired++;
      MX.UI.term(MX.Mutations.fill(pick(Words.RETIRE), { c: sub.name }));
      sfx('paper');
      MX.UI.refresh();
      save();
    });
  };
  act.deliver = (i) => {
    const c = G.state.contracts[i], sub = G.state.subject;
    if (busy() || !c || !sub) return;
    const ev = Contracts.evaluate(c, sub);
    if (!ev.ok) { MX.UI.toast('A cobaia ainda não cumpre os requisitos.', 'bad'); sfx('error'); return; }
    MX.UI.closeModal();
    G.phase = 'crate';
    G.crate = { t0: G.time, dur: fast() ? 1.2 : 2.2, c, ev, i };
    sfx('paper');
    MX.UI.busy('Embalando a encomenda...');
  };
  function finishDelivery() {
    const { c, ev, i } = G.crate;
    const sub = G.state.subject;
    G.crate = null;
    Economy.earn(G.state, ev.reward);
    G.state.rep += c.rep;
    G.state.stats.delivered++;
    G.state.contracts.splice(i, 1, newContract());
    G.state.subject = null; G.anim = null; G.glass = []; G.virus = null;
    G.phase = 'idle';
    MX.UI.busy(null);
    sfx('fanfare'); sfx('coin');
    quip('deliver');
    MX.UI.delivery(c, ev, sub);
    MX.UI.refresh();
    save();
  }
  act.reroll = (i) => {
    if (busy()) return;
    if (!Economy.spend(G.state, 15)) { MX.UI.toast('Trocar uma encomenda custa 15 créditos.', 'bad'); sfx('error'); return; }
    G.state.contracts[i] = newContract();
    sfx('paper');
    MX.UI.refresh();
    MX.UI.openContracts();
    save();
  };
  act.buy = (id) => {
    const r = Economy.buy(G.state, id);
    if (!r.ok) { MX.UI.toast(r.reason, 'bad'); sfx('error'); return; }
    sfx('coin'); sfx('ding');
    quip('buy');
    if (r.item.effect.type === 'decor' || r.item.effect.type === 'shelf') G.bgDirty = true;
    MX.UI.refresh();
    MX.UI.openShop(r.item.cat);
    save();
  };
  act.repair = () => {
    const r = Economy.repair(G.state);
    if (!r.ok) { MX.UI.toast(r.reason, 'bad'); sfx('error'); return; }
    sfx('coin'); quip('repair');
    G.bgDirty = true;
    MX.UI.refresh();
    MX.UI.openShop();
    save();
  };
  act.setSetting = (k, v) => { G.settings[k] = v; Save.saveSettings(G.settings); applySettings(); };
  act.toggleFullscreen = () => {
    const d = document, el = d.documentElement;
    const full = d.fullscreenElement || d.webkitFullscreenElement;
    try {
      if (full) (d.exitFullscreen || d.webkitExitFullscreen).call(d);
      else (el.requestFullscreen || el.webkitRequestFullscreen).call(el);
    } catch (e) { MX.UI.toast('Tela cheia indisponível neste navegador.', 'bad'); }
  };
  act.exportSave = () => Save.exportCode(G.state);
  act.importSave = (code) => {
    const s = Save.importCode(code);
    if (!s) return false;
    G.state = s; s.started = true;
    if (s.subject && !s.subject.alive) s.subject = null;
    while (s.contracts.length < 3) s.contracts.push(newContract());
    save();
    enterLab(false);
    return true;
  };
  act.wipeSave = () => { Save.wipe(); G.state = null; G.screen = 'title'; MX.UI.closeModal(); MX.UI.title(true, false); };
  act.loadStrain = (code) => {
    const r = act.pasteCode(code);
    if (!r.ok) MX.UI.toast(r.reason, 'bad', 5000);
    else { MX.UI.closeModal(); MX.UI.toast('Receita carregada na Mutatrix.', 'good'); }
  };
  act.copy = (text) => {
    const done = () => MX.UI.toast('Copiado.', 'good', 1800);
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, () => fallbackCopy(text, done));
    else fallbackCopy(text, done);
  };
  function fallbackCopy(text, done) {
    const ta = document.createElement('textarea');
    ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); done(); } catch (e) { MX.UI.toast('Não foi possível copiar.', 'bad'); }
    ta.remove();
  }

  // ---------------------------------------------------------------- ficha de espécime (renderizada pelo PixiJS)
  act.photo = () => {
    const sub = G.state && G.state.subject;
    if (!sub) { MX.UI.toast('Coloque uma cobaia na câmara para fazer a ficha.', 'info'); return; }
    const W = 180, H = 250, S = 4;
    const small = X.snapshot((g) => {
      g.rect(0, 0, W, H).fill(PAL.cream);
      g.rect(3, 3, W - 6, H - 6).stroke({ width: 2, color: PAL.ink });
      X.text(g, 'FICHA DE ESPÉCIME', W / 2, 10, PAL.ink, { align: 'center', shadow: PAL.pink });
      X.text(g, 'Nº ' + String(sub.id).padStart(4, '0'), W / 2, 23, PAL.slate, { align: 'center' });
      X.ell(g, W / 2, 104, 52, 10, 0xe8d8b8, { flat: true });
      X.scanFill(g, { t: 'ell', x: W / 2, y: 64, rx: 46, ry: 38 }, (x, y) => ((x + y) % 4 === 0 ? PAL.pink : null), 0.4);
      Creature.draw(g, sub, W / 2, 104, 26, Creature.DEF[sub.host].baseYaw, { squash: 0, blink: 0, lx: 0.3, ly: 0, mouth: 0, hic: 0, reveal: 0, hidden: new Set(), born: new Map(), pulse: new Map() }, 1.2, { still: true });
      const nm = sub.name.length > 28 ? sub.name.slice(0, 27) + '.' : sub.name;
      X.text(g, nm, W / 2, 122, PAL.ink, { align: 'center' });
      X.text(g, Data.HOST[sub.host].short, W / 2, 133, PAL.slate, { align: 'center' });
      [['DOSES', sub.doses], ['BIZ', sub.biz], ['INST', R(sub.instab) + '%']].forEach((st, i) => {
        const x = 32 + i * 58;
        X.text(g, st[0], x, 146, PAL.slate, { align: 'center' });
        X.text(g, String(st[1]), x, 156, PAL.ink, { align: 'center', scale: 1 });
      });
      let y = 172;
      sub.mutations.slice(0, 7).forEach((m) => {
        g.rect(10, y, 5, 5).fill(X.num(Data.SEVS[m.sevIdx].color));
        const t = m.name.length > 25 ? m.name.slice(0, 24) + '.' : m.name;
        X.text(g, t, 19, y - 1, PAL.ink);
        y += 10;
      });
      if (sub.mutations.length > 7) X.text(g, '+' + (sub.mutations.length - 7) + ' MUTAÇÕES', 19, y - 1, PAL.slate);
      if (!sub.mutations.length) X.text(g, 'NORMAL. AINDA.', 19, y - 1, PAL.slate);
      X.rect(g, W - 70, H - 26, 60, 15, PAL.cream, { ink: PAL.red });
      X.text(g, 'APROVADO', W - 40, H - 22, PAL.red, { align: 'center' });
    }, W, H);
    const c = document.createElement('canvas');
    c.width = W * S; c.height = H * S;
    const cx = c.getContext('2d');
    cx.imageSmoothingEnabled = false;
    cx.drawImage(small, 0, 0, W * S, H * S);
    sfx('stamp');
    MX.UI.photo(c.toDataURL('image/png'), 'mutatrix-' + sub.name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-') + '.png');
  };

  // ---------------------------------------------------------------- entrada
  function toLocal(e) { return { x: e.clientX / G.P, y: e.clientY / G.P }; }
  function nearCreature(p) {
    if (!G.anim || !G.state || !G.state.subject) return false;
    const cp = creaturePos();
    return Math.abs(p.x - cp.x) < G.L.cs * 1.5 && p.y < cp.y + 4 && p.y > cp.y - G.L.cs * 2.5;
  }
  function nearSyringe(p) { return G.virus && Math.hypot(p.x - G.syr.x, p.y - G.syr.y) < G.L.U(24); }
  function canvasEl() { return X.app.canvas; }
  function bindInput() {
    const canvas = canvasEl();
    canvas.addEventListener('pointerdown', (e) => {
      Audio.unlock();
      if (G.screen !== 'lab') return;
      const p = toLocal(e), pt = G.pointer;
      pt.down = true; pt.sx = p.x; pt.sy = p.y; pt.x = p.x; pt.y = p.y; pt.moved = 0; pt.t0 = G.time; pt.lastX = p.x;
      pt.mode = !busy() && nearSyringe(p) ? 'syringe' : nearCreature(p) || (Math.abs(p.x - G.L.cx) < G.L.R && p.y > G.L.top && p.y < G.L.floorY + 6) ? 'rotate' : 'none';
      if (pt.mode === 'syringe') { G.syr.drag = true; sfx('click'); }
      try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* ignorado */ }
    });
    canvas.addEventListener('pointermove', (e) => {
      const p = toLocal(e), pt = G.pointer;
      if (G.screen === 'lab' && !G.reduced && e.pointerType === 'mouse') { G.par.tx = (p.x / G.lw - 0.5) * -5; G.par.ty = (p.y / G.lh - 0.5) * -3; }
      pt.x = p.x; pt.y = p.y;
      if (!pt.down) { canvas.style.cursor = G.screen === 'lab' && nearSyringe(p) ? 'grab' : G.screen === 'lab' && nearCreature(p) ? 'pointer' : 'default'; return; }
      pt.moved = Math.max(pt.moved, Math.hypot(p.x - pt.sx, p.y - pt.sy));
      if (pt.mode === 'syringe') { G.syr.x = p.x; G.syr.y = p.y; G.syr.ang = -0.6; }
      else if (pt.mode === 'rotate' && G.anim) { const dx = p.x - pt.lastX; G.anim.user += dx * 0.035; G.anim.yawVel = dx * 1.8; pt.lastX = p.x; }
    });
    const endPointer = (e) => {
      const pt = G.pointer;
      if (!pt.down) return;
      pt.down = false;
      const p = toLocal(e);
      if (pt.mode === 'syringe') {
        G.syr.drag = false;
        if (nearCreature(p) && G.virus) act.inject();
        else G.syr.fly = { x0: G.syr.x, y0: G.syr.y, x1: G.L.syringe.x, y1: G.L.syringe.y, t: 0, dur: 0.3, home: true };
      } else if (pt.moved < 3 && G.time - pt.t0 < 0.5 && nearCreature(p)) poke(p);
      pt.mode = null;
    };
    canvas.addEventListener('pointerup', endPointer);
    canvas.addEventListener('pointercancel', endPointer);
    canvas.addEventListener('pointerleave', () => { G.par.tx = 0; G.par.ty = 0; });
  }
  function poke(p) {
    const a = G.anim, sub = G.state.subject;
    if (!a || !sub || !sub.alive || busy()) return;
    a.squash = 1; a.pokes++;
    sfx('creature', sub.host);
    vibrate(15);
    const has = (fn) => sub.mutations.some((m) => !a.hidden.has(m.uid) && fn(m));
    if (has((m) => m.theme === 'eletrico' && m.sevIdx >= 1)) { FX.burst('spark', p.x, p.y, 10, { speed: 90, size: 3, life: 0.3, color: 0xffe066 }); sfx('zap'); }
    else if (has((m) => m.render.part === 'spikes' || m.render.part === 'crystals')) FX.floatText(p.x, p.y - 4, 'Ai!', PAL.orange);
    else if (has((m) => m.theme === 'acucarado')) FX.burst('sprinkle', p.x, p.y, 8, { speed: 40, size: 2, life: 0.8, g: 110, colors: [PAL.pink, PAL.yellow, PAL.cyan] });
    else FX.burst('poof', p.x, p.y, 3, { speed: 14, size: 2, life: 0.4 });
    if (a.pokes % 7 === 0) a.speech = { text: pick(['Para de cutucar!', 'Isso faz cócegas.', 'Eu mordo, hein.', 'De novo não!', 'Que dedo gelado.']), t0: G.time, dur: 2.4 };
  }

  window.addEventListener('keydown', (e) => {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT')) return;
    Audio.unlock();
    if (G.screen !== 'lab') { if (e.key === 'Escape') MX.UI.closeModal(); return; }
    const k = e.key.toLowerCase();
    if (k === 'escape') { if (MX.UI.modalOpen()) MX.UI.closeModal(); else MX.UI.openPause(); e.preventDefault(); return; }
    if (MX.UI.modalOpen()) return;
    if (k === ' ' || k === 'enter') { e.preventDefault(); if (G.virus) act.inject(); else if (G.state.subject && G.state.subject.alive) act.synth(); return; }
    if (k >= '1' && k <= '6') { MX.UI.openReagent(Number(k) - 1); return; }
    if (k === 'c') MX.UI.openBook();
    else if (k === 'k') MX.UI.openContracts();
    else if (k === 'l') MX.UI.openShop();
    else if (k === 'p') act.photo();
    else if (k === 'f') act.toggleFullscreen();
    else if (k === 'e') act.stabilize();
    else if (k === 'arrowleft' && G.anim) G.anim.yawVel -= 3;
    else if (k === 'arrowright' && G.anim) G.anim.yawVel += 3;
  });
  window.addEventListener('resize', () => { clearTimeout(G.rt); G.rt = setTimeout(resize, 60); });
  window.addEventListener('orientationchange', () => setTimeout(resize, 200));
  document.addEventListener('fullscreenchange', () => { setTimeout(resize, 100); MX.UI.refresh({ panel: false }); });
  document.addEventListener('webkitfullscreenchange', () => setTimeout(resize, 100));
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { save(); Audio.suspend(); }
    else { Audio.resume(); G.last = performance.now(); }
  });
  window.addEventListener('pagehide', save);

  // ---------------------------------------------------------------- atualização
  function update(dt) {
    G.time += dt;
    const L = G.L;
    G.par.x += (G.par.tx - G.par.x) * Math.min(1, dt * 4);
    G.par.y += (G.par.ty - G.par.y) * Math.min(1, dt * 4);
    FX.update(dt, L);
    if (G.screen === 'title') { updateTitle(dt); return; }
    const m = G.machine;
    if (G.phase === 'synth') {
      m.shake = 1;
      if (G.time - m.t0 >= m.synthDur) finishSynth();
      else if (rand() < 0.3) FX.spawn('puff', L.mach.x + (rand() - 0.5) * L.mach.w * 0.5, L.mach.bottom - L.mach.h, { vy: -14, life: 1, size: 2, grow: 4, color: 0xe6e0d0 });
    } else m.shake = Math.max(0, m.shake - dt * 3);
    m.flow = G.phase === 'synth' ? 1 : 0;
    const sy = G.syr;
    if (sy.fly) {
      sy.fly.t += dt / sy.fly.dur;
      const k = easeInOut(Math.min(1, sy.fly.t));
      sy.x = sy.fly.x0 + (sy.fly.x1 - sy.fly.x0) * k; sy.y = sy.fly.y0 + (sy.fly.y1 - sy.fly.y0) * k;
      sy.ang = sy.fly.home ? -0.25 : -0.6;
      if (sy.fly.t >= 1) {
        const home = sy.fly.home;
        sy.fly = null;
        if (!home) { runInject(); sy.fly = { x0: sy.x, y0: sy.y, x1: L.syringe.x, y1: L.syringe.y, t: 0, dur: 0.5, home: true }; }
        else sy.ang = -0.25;
      }
    } else if (!sy.drag) { sy.x = L.syringe.x; sy.y = L.syringe.y; sy.ang = -0.25; }
    if (G.phase === 'seq') {
      if (!G.state.subject && G.queue.length && G.queue[0].t !== 'done') G.queue = [{ t: 'done', dur: 0 }];
      if (!G.step && G.queue.length) {
        G.step = G.queue.shift();
        try { startStep(G.step); } catch (err) { console.error(err); G.step.waiting = false; G.step.dur = 0; }
      } else if (G.step && !G.step.waiting && G.time - G.step.t0 >= G.step.dur) G.step = null;
    }
    if (G.phase === 'crate' && G.crate && G.time - G.crate.t0 >= G.crate.dur) finishDelivery();
    updateAnim(dt);
    G.quipT -= dt;
    if (G.quipT <= 0) { G.quipT = 28 + rand() * 25; if (G.phase === 'idle') quip('idle'); }
    G.saveT += dt;
    if (G.saveT > 20) { G.saveT = 0; save(); }
  }

  function updateAnim(dt) {
    const a = G.anim, sub = G.state && G.state.subject, L = G.L;
    if (!a || !sub) return;
    const u = L.u;
    const { beh } = Creature.gatherMods(sub, a);
    if (!G.pointer.down || G.pointer.mode !== 'rotate') { a.user += a.yawVel * dt; a.yawVel *= Math.pow(0.05, dt); }
    if (beh.spin) a.user += dt * 2.2 * beh.spin;
    let yaw = Creature.DEF[sub.host].baseYaw + a.user + Math.sin(G.time * 0.45) * 0.14;
    if (beh.dance) yaw += Math.sin(G.time * 4) * 0.45;
    a.yaw = yaw;
    a.squash = Math.max(0, a.squash - dt * 3);
    a.reveal = Math.max(0, a.reveal - dt * 2);
    a.mouth = Math.max(0, a.mouth - dt * 2.5);
    a.hic = Math.max(0, a.hic - dt * 3);
    a.nextBlink -= dt;
    if (a.nextBlink <= 0) { a.blink = 1; a.nextBlink = 2 + rand() * 4; }
    a.blink = Math.max(0, a.blink - dt * 7);
    const cp = creaturePos(), pt = G.pointer;
    const tx = clamp((pt.x - cp.x) / (L.cs * 4), -1, 1), ty = clamp((pt.y - (cp.y - L.cs)) / (L.cs * 4), -1, 1);
    a.lx += (tx - a.lx) * Math.min(1, dt * 5); a.ly += (ty - a.ly) * Math.min(1, dt * 5);
    if (a.speech && G.time - a.speech.t0 > a.speech.dur) a.speech = null;
    if (a.collapse) { a.collapse.p = Math.min(1, (G.time - a.collapse.t0) / (fast() ? 2.2 : 3.3)); collapseFx(a, a.collapse.p); return; }
    if (!sub.alive || G.phase === 'crate') return;
    const T = a.timers;
    const head = cp.y - L.cs * 1.2;
    if (beh.talk) { T.talk -= dt; if (T.talk <= 0) { T.talk = 7 + rand() * 6; a.speech = { text: pick(Words.SPEECH), t0: G.time, dur: 3.4 }; a.mouth = 1; sfx('talk'); } }
    if (beh.sing) { T.sing -= dt; if (T.sing <= 0) { T.sing = 1.4 + rand() * 1.4; a.mouth = 1; sfx('sing'); FX.spawn('note', cp.x + L.cs * 0.4, head, { vx: 7, vy: -18 * u, life: 1.6, color: rand() < 0.5 ? PAL.pink : PAL.purple }); } }
    if (beh.hiccup) { T.hic -= dt; if (T.hic <= 0) { T.hic = 2 + rand() * 4; a.hic = 1; sfx('hic'); FX.spawn('bubble', cp.x, head, { vy: -15 * u, life: 1.6, size: 3, color: PAL.cyan }); } }
    if (beh.teleport) {
      T.tele -= dt;
      if (T.tele <= 0) {
        T.tele = 4 + rand() * 4;
        FX.burst('poof', cp.x, cp.y - L.cs * 0.5, 8, { speed: 28, size: 3, life: 0.5 });
        a.tele = { x: (rand() - 0.5) * 1.2 };
        const np = creaturePos();
        FX.burst('star', np.x, np.y - L.cs * 0.5, 8, { speed: 35, size: 2, life: 0.5, color: 0xc9b8ff });
        sfx('pop');
      }
    }
    if (beh.laser.length) {
      T.laser -= dt;
      if (T.laser <= 0) {
        T.laser = 3.5 + rand() * 3;
        const side = rand() < 0.5 ? -1 : 1, gy = 0.25 + rand() * 0.5;
        FX.laser(cp.x + L.cs * 0.3, head + L.cs * 0.2, L.cx + side * L.R * 0.8, L.top + gy * (L.floorY - L.top), beh.laser[0]);
        G.glass.push({ type: 'scorch', x: side * (0.5 + rand() * 0.45), y: gy, r: rand() });
        if (G.glass.length > 16) G.glass.shift();
        sfx('laser');
      }
    }
    T.emit -= dt;
    if (T.emit <= 0) {
      T.emit = G.level === 0 ? 0.16 : 0.09;
      for (const em of beh.emit) if (rand() < 0.8 * em.k) FX.themeParticle(em.theme, cp.x + (rand() - 0.5) * L.cs * 1.4, cp.y - L.cs * (0.3 + rand() * 1.1), u);
      for (const ep of a.emitPts || []) {
        if (ep.kind === 'smoke' && rand() < 0.35) FX.spawn('smoke', ep.x, ep.y, { vy: -14 * u, vx: 4, life: 1.6, size: 1.5, grow: 4, color: 0xa3a7ab });
        if (ep.kind === 'note' && rand() < 0.06) FX.spawn('note', ep.x, ep.y, { vy: -16 * u, life: 1.4, color: ep.color });
        if (ep.kind === 'drip' && rand() < 0.08) FX.spawn('drip', ep.x, ep.y, { vy: 8, g: 110 * u, life: 0.8, color: ep.color });
      }
    }
    for (const m of sub.mutations) {
      if (m.sevIdx < 2 || a.hidden.has(m.uid)) continue;
      let t = a.danger.get(m.uid);
      if (t === undefined) t = 3 + rand() * 4;
      t -= dt;
      if (t <= 0) {
        t = 5 + rand() * 5;
        const side = rand() < 0.5 ? -1 : 1, gy = 0.2 + rand() * 0.6, gx = side * (0.45 + rand() * 0.5);
        const tx2 = L.cx + gx * L.R, ty2 = L.top + gy * (L.floorY - L.top);
        const type = m.render.danger || 'fireball';
        FX.projectile(type, cp.x, cp.y - L.cs * 0.7, tx2, ty2, u, () => {
          FX.burst(type === 'zap' ? 'spark' : 'puff', tx2, ty2, 6, { speed: 30, size: 2, life: 0.4, color: Data.THEME[m.theme].color });
          G.glass.push({ type: type === 'fireball' || type === 'zap' || type === 'claw' ? 'scorch' : type === 'sound' || type === 'bone' || type === 'shard' || type === 'tool' ? 'crack' : 'goo', x: gx, y: gy, r: rand() * TAU, c: Data.THEME[m.theme].color });
          if (G.glass.length > 16) G.glass.shift();
          FX.shake(1.5, 0.15);
          sfx(type === 'zap' ? 'zap' : type === 'sound' ? 'crack' : 'pop');
        });
      }
      a.danger.set(m.uid, t);
    }
  }

  // ---------------------------------------------------------------- tela de título
  function updateTitle(dt) {
    if (G.titleBugs.length < 10) {
      const slots = [{ theme: pick(Data.THEMES).id, pot: 2 }, { theme: pick(Data.THEMES).id, pot: 1 }, null, null, null, null];
      const v = Genetics.synthesize({ capsid: pick(Data.CAPSIDS).id, slots, virulence: 50, chaos: 0, seed: RNG.randomSeedString(5) });
      G.titleBugs.push({ x: rand() * G.lw, y: G.lh + 20, r: 5 + rand() * 9, vy: -(4 + rand() * 9), vx: (rand() - 0.5) * 4, vis: v.visual, ph: rand() * 10 });
    }
    for (let i = G.titleBugs.length - 1; i >= 0; i--) { const b = G.titleBugs[i]; b.x += b.vx * dt; b.y += b.vy * dt; if (b.y < -30) G.titleBugs.splice(i, 1); }
  }
  function renderTitle() {
    const g = layers.dyn, gl = layers.glow;
    const W = G.lw, H = G.lh;
    g.rect(0, 0, W, H).fill(0x1d2140);
    for (let y = 0; y < H; y += 4) if ((y / 4) % 2) g.rect(0, y, W, 2).fill({ color: 0x29366f, alpha: 0.35 });
    const rng = RNG.make('estrelas');
    for (let i = 0; i < 60; i++) { const x = R(rng.next() * W), y = R(rng.next() * H); const on = Math.sin(G.time * 2 + i) > 0.3; g.rect(x, y, 1, 1).fill(on ? PAL.white : PAL.slate); }
    for (const b of G.titleBugs) VirusArt.draw(g, R(b.x), R(b.y), b.r, b.vis, G.time + b.ph);
    gl.circle(R(W / 2), R(H * 0.42), R(Math.min(W, H) * 0.42)).fill({ color: PAL.purple, alpha: 0.08 });
  }

  // ---------------------------------------------------------------- renderização do laboratório
  function render() {
    const g = layers.dyn, gl = layers.glow, top = layers.top;
    g.clear(); gl.clear(); top.clear();
    if (G.screen === 'title') { layers.bg.visible = false; renderTitle(); return; }
    layers.bg.visible = true;
    const L = G.L, st = G.state, t = G.time;
    if (G.bgDirty) { layers.bg.clear(); Lab.drawBackground(layers.bg, L, st); G.bgDirty = false; }
    const sh = FX.shakeOffset();
    const pxr = (v) => R(v);
    layers.world.position.set(sh[0], sh[1]);
    layers.bg.position.set(pxr(G.par.x * 0.3), pxr(G.par.y * 0.3));
    Lab.windowTwinkle(g, gl, L, t);
    Lab.decorDynamic(g, gl, L, st, t, Audio.ready);
    const blackout = FX.event && FX.event.id === 'blecaute';
    Lab.lampLight(gl, L, blackout);
    // máquina
    const themes = st.design.slots.filter(Boolean).map((s) => Data.THEME[s.theme].color);
    const mach = Lab.drawMachine(g, gl, L, {
      shake: G.machine.shake, synth: G.phase === 'synth' ? 1 : 0, flow: G.machine.flow, slots: st.unlocked.slots, design: st.design,
      themes, status: G.machine.status, tentacle: st.tentacleUntil > Date.now(), flowColor: themes[0],
    }, t);
    if (G.virus) VirusArt.vial(g, mach.trayX, mach.trayY - L.U(11), L.U(22), G.virus.visual, t);
    else if (G.phase === 'synth' && G.pendingVirus) { const k = (t - G.machine.t0) / G.machine.synthDur; if (k > 0.5) VirusArt.vial(g, mach.trayX, mach.trayY - L.U(11), L.U(22) * Math.min(1, (k - 0.5) * 2), G.pendingVirus.visual, t); }
    // câmara e cobaia
    const a = G.anim, sub = st.subject;
    Lab.chamberBack(g, gl, L, t, { yaw: a ? a.yaw : 0 });
    if (G.puddle) X.ell(g, L.cx, L.floorY + 1, L.cs * 1.3, Math.max(2, L.cs * 0.2), G.puddle.color, { flat: true });
    let headPt = null;
    if (sub && a) {
      const cp = creaturePos();
      let scale = 1;
      if (G.crate) scale = 1 - easeInOut(Math.min(1, (t - G.crate.t0) / (G.crate.dur * 0.45)));
      if (a.drop !== undefined) { const k = (t - a.drop) / 0.5; if (k < 1) scale *= easeOutBack(Math.max(0.01, k)); }
      if (scale > 0.05) {
        const r = Creature.draw(g, sub, cp.x, cp.y, L.cs * scale, a.yaw, a, t, { glow: gl, ventX: L.vent.x, ventY: L.vent.y, machineX: L.mach.x, ceilY: L.top + L.U(10) });
        if (r) headPt = [r.core.head[0], r.core.head[1] - r.core.head[3] * 0.2];
      }
      if (a.collapse && a.collapse.id === 'mitose') {
        const p = a.collapse.p;
        const n = Math.min(24, Math.pow(2, Math.floor(1 + p * 5)));
        if (p > 0.25 && p < 0.86) for (let i = 0; i < n; i++) { const ang = i / n * TAU + t; const d = L.cs * (0.4 + p * 1.4); Creature.draw(g, sub, cp.x + Math.cos(ang) * d * 0.9, L.floorY - L.cs * 0.6 + Math.sin(ang) * d * 0.5, L.cs * 0.28, ang, null, t, { mini: true, noShadow: true }); }
      }
    }
    FX.draw(g, gl);
    Lab.chamberFront(g, gl, L, t, { glass: G.glass, alarm: sub && sub.alive && sub.instab >= 85, warn: sub && sub.instab >= 60, label: sub ? 'CÂMARA ' + String(sub.id).padStart(2, '0') : 'VAZIA' });
    if (G.crate) {
      const k = (t - G.crate.t0) / G.crate.dur;
      const lift = k > 0.55 ? easeInOut((k - 0.55) / 0.45) : 0;
      const cw = R(L.cs * 2.2 * Math.min(1, k * 2.5)), ch = R(cw * 0.7);
      const cx = L.cx, cy = R(L.floorY - ch / 2 - lift * (L.floorY - L.rect.y + ch));
      if (cw > 4) {
        X.rect(g, cx - cw / 2, cy - ch / 2, cw, ch, 0xc99a5f, { bevel: true });
        X.line(g, [[cx - cw / 2, cy - ch / 2], [cx + cw / 2, cy + ch / 2]], 1, PAL.brown);
        X.line(g, [[cx + cw / 2, cy - ch / 2], [cx - cw / 2, cy + ch / 2]], 1, PAL.brown);
        g.rect(R(cx - cw * 0.08), R(cy - ch / 2), Math.max(2, R(cw * 0.16)), ch).fill(PAL.red);
        if (cw > 40) X.text(g, 'FRÁGIL', cx, cy - 3, PAL.ink, { align: 'center' });
      }
    }
    const sy = G.syr;
    const col = G.virus ? G.virus.visual.color : null;
    const amount = G.virus ? 1 : sy.fly && !sy.fly.home ? 1 - sy.fly.t * 0.3 : 0;
    Lab.syringe(g, gl, sy.x, sy.y, sy.ang, L, col, amount, !!G.virus && !sy.drag, t);
    FX.drawEvent(g, gl, L, headPt);
    if (a && a.speech && headPt) FX.speech(top, R(headPt[0]), R(headPt[1] - L.cs * 0.4), a.speech.text, Math.min(110, L.rect.w * 0.6));
    FX.drawFlash(top, G.lw, G.lh);
  }

  // ---------------------------------------------------------------- laço
  function frame(ts) {
    requestAnimationFrame(frame);
    if (document.hidden) return;
    let dt = G.last ? (ts - G.last) / 1000 : 1 / 60;
    const cap = G.settings.fpsCap === 30 || MX.UI.modalOpen() ? 1 / 30 : 0;
    if (cap && dt < cap - 0.004) return;
    G.last = ts;
    dt = Math.min(dt, 0.05);
    update(dt);
    render();
    X.app.renderer.render(X.app.stage);
    MX.UI.frame(G.time);
    G.frames.push(dt);
    if (G.frames.length > 60) G.frames.shift();
    G.autoT += dt;
    if (G.autoT > 1) {
      G.autoT = 0;
      G.fps = R(G.frames.length / G.frames.reduce((x, y) => x + y, 0));
      MX.UI.fps(G.fps, G.level, G.P);
    }
  }

  // ---------------------------------------------------------------- início
  async function boot() {
    G.settings = Save.loadSettings();
    try {
      await X.init(document.getElementById('scene'));
    } catch (e) {
      console.error(e);
      const ld = document.getElementById('loading');
      if (ld) ld.textContent = 'Não foi possível iniciar os gráficos (WebGL). Tente outro navegador ou atualize o atual.';
      return;
    }
    const app = X.app;
    app.ticker.stop();
    layers.world = new PIXI.Container();
    layers.bg = new PIXI.Graphics();
    layers.dyn = new PIXI.Graphics();
    layers.glow = new PIXI.Graphics();
    layers.glow.blendMode = 'add';
    layers.top = new PIXI.Graphics();
    layers.world.addChild(layers.bg, layers.dyn, layers.glow, layers.top);
    app.stage.addChild(layers.world);
    G.level = G.settings.quality === 'low' ? 0 : G.settings.quality === 'medium' ? 1 : 2;
    X.setQuality(G.level);
    MX.UI.init();
    bindInput();
    applySettings();
    MX.UI.title(true, !!Save.load());
    Audio.setMood({ mode: 'title' });
    const startAudio = () => { Audio.unlock(); Audio.startMusic(); window.removeEventListener('pointerdown', startAudio); window.removeEventListener('keydown', startAudio); };
    window.addEventListener('pointerdown', startAudio);
    window.addEventListener('keydown', startAudio);
    const ld = document.getElementById('loading');
    if (ld) ld.remove();
    requestAnimationFrame(frame);
  }
  MX.Game.boot = boot;
  MX.Game.resize = resize;
  MX.Game.creaturePos = creaturePos;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
