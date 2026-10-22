// The Test Room ("Sala de Testes"): a big closed room in the Curator's lab
// with the Tear at the centre, four training dummies on pads (still, walking,
// dodging, hitting back), a portal for test battles and a terminal to change
// beings. Nothing here touches a run; the room's state is saved on its own.
(function (XS) {
  'use strict';

  const THEME = {
    id: 'lab', name: 'Laboratório do Curador', pattern: 'checker', shapes: ['square'],
    sky: ['#040812', '#0a1a2e', '#14304a'], nebula: ['#1a5a7a', '#3af0ff'], stars: '#d8fbff',
    body: { type: 'ringed', color: '#ffe08a' }, tower: ['#06101a', '#102438', '#3af0ff'], light: '#9ff6ff',
    mats: {
      plating: { kind: 'plating', color: '#141a2a' }, sub: { kind: 'stone', color: '#2a3248' },
      floorA: { kind: 'tile', color: '#343c58' }, floorB: { kind: 'tile', color: '#2a3048' },
      accent: { kind: 'stone', color: '#4a5478' }, wall: { kind: 'stone', color: '#6a7498' },
      prop1: { kind: 'neon', color: '#3af0ff' }, prop2: { kind: 'neon', color: '#ff3ab8' },
      core: { kind: 'core', color: '#ffe03a' }, crate: { kind: 'wood', color: '#8a6a44' }, trunk: { kind: 'stone', color: '#4a5478' },
    },
    props: {}, music: { root: 62, mode: 'lydian', bpm: 88 },
  };

  const DUMMIES = [
    { kind: 'still', name: 'Manequim Parado' },
    { kind: 'walker', name: 'Manequim Andarilho' },
    { kind: 'dodger', name: 'Manequim Esquivo' },
    { kind: 'fighter', name: 'Manequim Brigão' },
  ];

  // ---------------------------------------------------------------- room
  function arena() {
    const BASE = XS.Arena.BASE, size = 72, W = size, D = size, H = 20;
    const world = new XS.VoxelWorld(W, D, H);
    const M = {};
    for (const key of Object.keys(THEME.mats)) M[key] = world.addMaterial(Object.assign({ key }, THEME.mats[key]));
    world.materials[M.plating].indestructible = true; // the room never opens onto the void
    M.frame = world.addMaterial({ key: 'frame', kind: 'metal', color: '#5a6288', indestructible: true });
    M.glowA = world.addMaterial({ key: 'glowA', kind: 'neon', color: '#3af0ff', indestructible: true });
    M.glowB = world.addMaterial({ key: 'glowB', kind: 'neon', color: '#ff3ab8', indestructible: true });
    M.loom = world.addMaterial({ key: 'loom', kind: 'summoned', color: '#ffe08a', indestructible: true });
    M.glass = world.addMaterial({ key: 'glass', kind: 'glass', color: '#9fe8ff' });
    const put = (x, y, z, m) => { if (world.inside(x, y, z)) { const i = world.idx(x, y, z); world.mat[i] = m; world.hp[i] = m ? 1 : 0; } };
    const column = (x, y, z0, h, m, top) => { for (let k = 0; k < h; k++) put(x, y, z0 + k, k === h - 1 && top ? top : m); };
    const cx = W / 2, cy = D / 2, lo = 2, hi = W - 3;

    // Floor with 4x4 tiles, and a frame wall all around (no falling out).
    for (let y = lo; y <= hi; y++) for (let x = lo; x <= hi; x++) {
      put(x, y, 0, M.plating);
      for (let z = 1; z < BASE - 1; z++) put(x, y, z, M.sub);
      put(x, y, BASE - 1, ((x >> 2) + (y >> 2)) & 1 ? M.floorA : M.floorB);
      if (x === lo || y === lo || x === hi || y === hi) column(x, y, BASE, 3, M.frame, (x + y) % 6 === 0 ? M.glowA : M.frame);
    }

    // The Tear: a ring of neon pillars around a golden loom on a dais.
    for (let y = cy - 2; y <= cy + 1; y++) for (let x = cx - 2; x <= cx + 1; x++) put(x, y, BASE, M.frame);
    for (let y = cy - 1; y <= cy; y++) for (let x = cx - 1; x <= cx; x++) column(x, y, BASE + 1, 3, M.loom);
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2 + 0.3;
      const x = Math.round(cx - 0.5 + Math.cos(a) * 4.6), y = Math.round(cy - 0.5 + Math.sin(a) * 4.6);
      column(x, y, BASE, 5, M.frame, k % 2 ? M.glowA : M.glowB);
    }
    const tear = { x: cx, y: cy };

    // Dummy pads (low plates with a glowing rim) in a row on the east side.
    const pads = DUMMIES.map((d, k) => ({ kind: d.kind, name: d.name, x: cx + 15.5, y: cy - 12.5 + k * 8 }));
    for (const p of pads) {
      for (let y = Math.floor(p.y) - 1; y <= Math.floor(p.y) + 1; y++) for (let x = Math.floor(p.x) - 1; x <= Math.floor(p.x) + 1; x++) {
        put(x, y, BASE, x === Math.floor(p.x) && y === Math.floor(p.y) ? M.glowA : M.accent);
      }
    }

    // Portal arch on the south side, terminal on the west side.
    const portal = { x: cx + 6.5, y: cy + 17.5 };
    for (const ox of [-2, 2]) column(Math.floor(portal.x) + ox, Math.floor(portal.y), BASE, 5, M.frame, M.glowB);
    for (let ox = -2; ox <= 2; ox++) put(Math.floor(portal.x) + ox, Math.floor(portal.y), BASE + 5, M.glowB);
    const terminal = { x: cx - 15.5, y: cy + 2.5 };
    for (let oy = 0; oy <= 1; oy++) for (let ox = 0; ox <= 1; ox++) column(Math.floor(terminal.x) + ox, Math.floor(terminal.y) + oy, BASE, 2, M.frame, ox === 0 ? M.glowA : M.frame);

    // A corner full of things to break: pillars, a glass wall, crates, a core.
    const bx = Math.floor(cx - 20), by = Math.floor(cy - 20);
    for (let k = 0; k < 3; k++) for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) column(bx + k * 5 + i, by + j, BASE, 6, M.wall, M.accent);
    for (let i = 0; i < 7; i++) column(bx + i, by + 6, BASE, 3, M.glass);
    for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) column(bx + 2 + i, by + 10 + j, BASE, 2, M.crate);
    column(bx + 8, by + 11, BASE, 1, M.core);
    column(bx + 13, by + 9, BASE, 7, M.wall, M.accent); // a tall thin pillar to topple

    world.refreshAll();
    world.needsSupport = false;
    const at = (p) => ({ x: p.x, y: p.y, z: world.topAt(p.x, p.y) });
    const spawn = { x: cx - 6.5, y: cy + 6.5, z: BASE };
    return {
      world, theme: THEME, shape: 'square', size, M, name: THEME.name,
      spawns: [spawn, ...pads.map(at)],
      center: { x: cx, y: cy, z: BASE },
      lab: { tear, portal, terminal, pads },
    };
  }

  // ------------------------------------------------------------- dummies
  // Duck-typed controllers (Battle calls ai.think every step).
  class DummyAI {
    constructor(f, kind, home) {
      this.f = f; this.kind = kind; this.home = home; this.t = 0;
      this.inner = kind === 'dodger' || kind === 'fighter' ? new XS.AI(f, { skill: kind === 'dodger' ? 1 : 0.45, salt: 7 }) : null;
    }
    think(b, dt) {
      const f = this.f, c = f.ctrl;
      this.t += dt;
      if (this.inner) this.inner.think(b, dt);
      c.cast = -1;
      const hx = this.home.x - f.x, hy = this.home.y - f.y, hd = Math.hypot(hx, hy);
      const back = hd > 0.6 ? { x: hx / hd, y: hy / hd } : { x: 0, y: 0 };
      switch (this.kind) {
        case 'still': c.mx = back.x * Math.min(1, hd); c.my = back.y * Math.min(1, hd); c.attack = false; c.dodge = false; break;
        case 'walker': {
          const ty = this.home.y + Math.sin(this.t * 0.8) * 3.5, dy = ty - f.y, dx = this.home.x - f.x;
          const l = Math.hypot(dx, dy) || 1;
          c.mx = (dx / l) * Math.min(1, l); c.my = (dy / l) * Math.min(1, l);
          c.attack = false;
          break;
        }
        case 'dodger':
          // Strafe around its pad and dodge whatever comes (the inner AI dodges).
          c.attack = false;
          if (hd > 3) { c.mx = back.x; c.my = back.y; } else { c.mx = Math.cos(this.t * 1.7) * 0.8; c.my = Math.sin(this.t * 1.3) * 0.8; }
          break;
        case 'fighter':
          // Hits back with weak basic attacks, but stays near its pad.
          if (hd > 7) { c.mx = back.x; c.my = back.y; }
          break;
      }
    }
  }

  // Damage per second over the last 5 s.
  function dps(f, now) {
    const log = f.dps;
    if (!log || !log.length) return 0;
    while (log.length && log[0] < now - 5) log.splice(0, 2);
    if (!log.length) return 0;
    let sum = 0;
    for (let i = 1; i < log.length; i += 2) sum += log[i];
    return sum / XS.clamp(now - log[0], 1, 5);
  }

  // --------------------------------------------------------------- state
  const powerOf = (spec) => XS.Power.generate(spec.seed, spec.floor, { tier: spec.tier, forms: spec.forms, elements: spec.elements });
  const specOf = (def, filters = {}) => ({ seed: def.seed, floor: def.floor, tier: def.tier, forms: filters.forms && filters.forms.length ? filters.forms.slice() : undefined, elements: filters.elements && filters.elements.length ? filters.elements.slice() : undefined });

  function load() {
    const saved = XS.store.load('lab', null);
    if (saved && saved.genomeSeed != null && Array.isArray(saved.kit)) return Object.assign(defaults(), saved);
    return defaults();
  }
  function defaults() {
    const seed = XS.randomSeed();
    return {
      genomeSeed: XS.hash(seed, 'labbeing'),
      kit: [0, 1, 2].map((k) => specOf(XS.Power.generate(XS.hash(seed, 'labkit', k), 5, { tier: 1 }))),
      noCd: false, invuln: false,
      tear: { tier: -1, forms: [], elements: [], floor: 5, seed: '' },
      test: { foes: 1, floor: 5, difficulty: 1 },
    };
  }
  const save = (lab) => XS.store.save('lab', lab);

  // Three Tear offers honouring the filters (unlimited rerolls).
  function weave(lab, seedText) {
    const t = lab.tear;
    const base = seedText ? XS.codeToSeed(seedText) : XS.randomSeed();
    const out = [];
    for (let k = 0; out.length < 3 && k < 12; k++) {
      const seed = XS.hash(base, 'tear', k);
      const def = XS.Power.generate(seed, t.floor, { tier: t.tier >= 0 ? t.tier : undefined, forms: t.forms.length ? t.forms : undefined, elements: t.elements.length ? t.elements : undefined });
      if (out.some((d) => d.form === def.form && d.elements[0] === def.elements[0]) && k < 9) continue;
      out.push(def);
    }
    return out;
  }

  // ------------------------------------------------------------- battles
  function stage(lab) {
    const arena = arena_();
    const genome = XS.Creature.generate(lab.genomeSeed);
    const fighters = [{ genome, powers: lab.kit.map(powerOf), team: 0, isPlayer: true }];
    DUMMIES.forEach((d, k) => fighters.push({ genome: XS.Creature.generate(XS.hash('manequim', k)), powers: [], team: 1, name: d.name, hpMult: 3, basicMult: d.kind === 'fighter' ? 0.35 : 1 }));
    const b = new XS.Battle({ arena, seed: 1, floor: 1, fighters, lab: true });
    b.fighters.forEach((f, i) => {
      if (i === 0) return;
      const pad = arena.lab.pads[i - 1];
      f.dummy = pad.kind;
      f.ai = new DummyAI(f, pad.kind, { x: pad.x, y: pad.y });
    });
    b.player.inv = 0;
    return b;
  }
  const arena_ = arena;

  // Per-step room rules: no cooldowns, invulnerability.
  function tick(lab, b) {
    const p = b.player;
    if (!p || !p.alive) return;
    if (lab.noCd) for (const s of p.powers) s.cd = Math.min(s.cd, 0.1);
    if (lab.invuln) { p.hp = p.maxHp; p.inv = Math.max(p.inv, 0.05); }
  }

  // A test battle with the room's kit; returns { battle, plan }.
  function testBattle(lab, settings = {}) {
    const seed = XS.randomSeed();
    const floor = XS.clamp(lab.test.floor | 0, 1, 50), n = XS.clamp(lab.test.foes | 0, 1, 3);
    const type = n > 1 ? 'melee' : 'duel';
    const theme = XS.Arena.THEMES[seed % XS.Arena.THEMES.length];
    const plan = { floor, type, theme, arenaSeed: XS.hash(seed, 'arena'), opponents: XS.Run.makeOpponents(seed, floor, type, n, lab.test.difficulty), line: '', lab: true };
    const battle = XS.Run.stageBattle({ seed, genomeSeed: lab.genomeSeed, powers: [], hpFrac: 1 }, plan, Object.assign({}, settings, { difficulty: lab.test.difficulty }));
    battle.player.powers = lab.kit.map((s) => ({ def: powerOf(s), cd: 0.5 }));
    return { battle, plan };
  }

  XS.Lab = { THEME, DUMMIES, arena, stage, tick, dps, load, save, defaults, weave, testBattle, powerOf, specOf, DummyAI };
})(globalThis.XS = globalThis.XS || {});
