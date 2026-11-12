// Amalgamations — boot, renderer, isometric camera, game loop, player control, interactions,
// structure-driven spawns, day/night, death, teleport, saving and the quality manager.
(function (root) {
  'use strict';
  const AM = root.AM;
  const R = AM.R, C = AM.Combat, E = AM.Ent;
  const DAY_LENGTH = 720; // seconds per in-game day

  const DEFAULTS = {
    preset: 'auto', renderScale: 1, dynRes: true, shadows: 'low', viewDist: 2, particles: 'medium', antialias: true, fpsCap: 60, showFps: false,
    maxCreatures: 22, volMaster: 0.8, volMusic: 0.5, volSfx: 0.8, shake: true, damageNumbers: true, autoAim: true, autoLoot: true, uiScale: 1,
    leftHanded: false, touchControls: 'auto', btnOpacity: 0.85, btnSize: 1, camRotate: true, dprCap: 1.5,
  };
  const PRESETS = {
    low: { renderScale: 0.65, shadows: 'off', viewDist: 2, particles: 'low', antialias: false, maxCreatures: 14, dprCap: 1 },
    medium: { renderScale: 0.85, shadows: 'low', viewDist: 2, particles: 'medium', antialias: false, maxCreatures: 20, dprCap: 1.25 },
    high: { renderScale: 1, shadows: 'high', viewDist: 3, particles: 'high', antialias: true, maxCreatures: 28, dprCap: 1.5 },
    ultra: { renderScale: 1, shadows: 'high', viewDist: 4, particles: 'ultra', antialias: true, maxCreatures: 38, dprCap: 2 },
  };
  const PARTICLES = { low: 250, medium: 500, high: 900, ultra: 1400 };
  const isMobile = () => /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || (('ontouchstart' in root) && Math.min(screen.width, screen.height) < 820);
  function autoPreset() {
    if (isMobile()) return (navigator.hardwareConcurrency || 4) >= 8 ? 'medium' : 'low';
    return (navigator.hardwareConcurrency || 4) >= 8 ? 'high' : 'medium';
  }
  function loadSettings() {
    const s = Object.assign({}, DEFAULTS, AM.loadSettings() || {});
    if (!AM.loadSettings()) { const p = autoPreset(); Object.assign(s, PRESETS[p]); s.preset = 'auto'; }
    return s;
  }

  const G = AM.G = {
    entities: [], summons: [], projectiles: [], zones: [], timers: [], anims: [], pickups: [],
    mode: 'boot', paused: false, camYaw: Math.PI / 4, camYawTarget: Math.PI / 4, camZoom: 1, shakeT: 0, hitStop: 0, time: 0,
    renderScale: 1, spawnT: 0, discoverT: 0, autosaveT: 60, isNight: false, PRESETS, DEFAULTS, PARTICLES, isMobile,
  };

  // ---------- boot ----------
  function boot() {
    G.settings = AM.settings = loadSettings();
    const canvas = document.getElementById('game');
    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: !!G.settings.antialias, powerPreference: 'high-performance' });
    } catch (e) {
      document.getElementById('loading').innerHTML = '<p>WebGL is not available on this device or browser.</p>';
      return;
    }
    G.renderer = renderer;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = G.settings.shadows !== 'off';
    renderer.shadowMap.type = G.settings.shadows === 'high' ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
    G.scene = new THREE.Scene();
    G.camera = new THREE.OrthographicCamera(-10, 10, 10, -10, 0.5, 200);
    G.sky = new R.Sky(G.scene, G.settings.shadows !== 'off', G.settings.shadows === 'high' ? 2048 : 1024);
    G.fx = new R.FX(G.scene, { particles: PARTICLES[G.settings.particles] || 500 });
    G.audio = AM.Audio;
    G.hud = AM.HUD; G.hud.init(G);
    G.input = AM.Input; G.input.init(canvas, document.getElementById('touch'));
    G.input.onAction = onAction;
    G.ui = AM.UI; G.ui.init(G);
    G.raycaster = new THREE.Raycaster(); G.plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0); G.v3 = new THREE.Vector3(); G.v2 = new THREE.Vector2();
    G.renderScale = G.settings.renderScale;
    G.dyn = { t: 0, frames: 0, scale: G.settings.renderScale };
    resize();
    root.addEventListener('resize', resize);
    root.addEventListener('orientationchange', () => setTimeout(resize, 200));
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) { if (G.state && (G.mode === 'play' || G.mode === 'interior')) { G.save(); if (!G.paused) G.ui.open('pause'); } G.audio.suspend(); }
      else G.audio.resume();
    });
    const unlockAudio = () => { G.audio.init(); };
    root.addEventListener('pointerdown', unlockAudio, { capture: true });
    root.addEventListener('keydown', unlockAudio, { capture: true });
    G.applySettings();
    document.getElementById('loading').style.display = 'none';
    G.toTitle();
    let resume = null;
    try { resume = sessionStorage.getItem('amalgamations.resume'); sessionStorage.removeItem('amalgamations.resume'); } catch (e) { /* ignore */ }
    if (resume != null) { const s = AM.loadSlot(+resume); if (s) { G.ui.closeAll(); G.startGame(s); } }
    G.last = performance.now();
    requestAnimationFrame(frame);
  }

  function resize() {
    const w = root.innerWidth, h = root.innerHeight;
    const dpr = Math.min(root.devicePixelRatio || 1, G.settings.dprCap || 1.5);
    G.renderer.setPixelRatio(dpr * G.renderScale);
    G.renderer.setSize(w, h, false);
    G.aspect = w / h;
    updateCameraFrustum();
    if (G.preview) { G.preview.camera.aspect = w / h; G.preview.camera.updateProjectionMatrix(); }
    document.body.classList.toggle('portrait', h > w);
  }
  function updateCameraFrustum() {
    const base = G.aspect < 1 ? 6.0 / Math.max(0.55, G.aspect) * 0.62 : 6.2;
    const hh = base / G.camZoom;
    const cam = G.camera;
    cam.left = -hh * G.aspect; cam.right = hh * G.aspect; cam.top = hh; cam.bottom = -hh;
    cam.updateProjectionMatrix();
  }
  G.setRenderScale = function (s) { G.renderScale = AM.clamp(s, 0.4, 1); resize(); };

  G.applySettings = function () {
    const s = G.settings;
    AM.saveSettings(s);
    G.audio.setVolumes(s);
    G.setRenderScale(s.dynRes ? Math.min(G.renderScale, s.renderScale) : s.renderScale);
    G.dyn.scale = s.renderScale;
    G.fx.setMul(s.particles === 'low' ? 0.5 : s.particles === 'medium' ? 0.8 : 1);
    document.documentElement.style.setProperty('--ui', s.uiScale);
    document.documentElement.style.setProperty('--btn-op', s.btnOpacity);
    document.documentElement.style.setProperty('--btn-size', s.btnSize);
    document.body.classList.toggle('lefty', !!s.leftHanded);
    G.updateTouchMode();
  };
  G.updateTouchMode = function () {
    const s = G.settings;
    const touch = s.touchControls === 'on' || (s.touchControls === 'auto' && (G.input.touchUsed || isMobile()));
    G.hud.setTouch(touch);
  };

  // ---------- modes ----------
  G.toTitle = function () {
    G.clearWorld();
    G.mode = 'title'; G.paused = false;
    G.hud.show(false);
    G.ui.open('title');
    G.showcase();
  };
  // Showcase scene used by the title screen and the Fusion Lab.
  G.ensurePreview = function () {
    if (G.preview) return G.preview;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#1b2236');
    scene.fog = new THREE.Fog('#1b2236', 12, 30);
    scene.add(new THREE.HemisphereLight(0xdfe8ff, 0x3a3050, 1.1));
    const sun = new THREE.DirectionalLight(0xffffff, 1.8); sun.position.set(4, 8, 6); scene.add(sun);
    const rim = new THREE.DirectionalLight(0x9a7aff, 0.9); rim.position.set(-6, 3, -5); scene.add(rim);
    const gb = new R.GeoBuilder(false);
    gb.box({ w: 5, h: 0.5, l: 5, c: 0.5, col: '#4f8f44', m: R.mat([0, -0.25, 0]) });
    gb.box({ w: 4.4, h: 0.9, l: 4.4, c: 0.6, tt: 0.6, col: '#6a5040', m: R.mat([0, -0.95, 0]) });
    for (let i = 0; i < 9; i++) { const a = i * 0.7; gb.box({ w: 0.14, h: 0.3, l: 0.06, tt: 0.2, col: '#6faa4a', m: R.mat([Math.cos(a) * 2.1, 0.12, Math.sin(a) * 2.1]) }); }
    gb.box({ w: 0.6, h: 0.4, l: 0.5, c: 0.12, col: '#8d939b', m: R.mat([1.6, 0.15, -1.3]) });
    const island = new THREE.Mesh(gb.build(), R.materials().set);
    scene.add(island);
    const camera = new THREE.PerspectiveCamera(32, G.aspect, 0.1, 100);
    camera.position.set(0, 2.6, 7.2); camera.lookAt(0, 0.7, 0);
    G.preview = { scene, camera, rig: null, island, t: 0, spin: true };
    return G.preview;
  };
  G.previewGenome = function (g) {
    const P = G.ensurePreview();
    if (P.rig) R.disposeCreature(P.rig);
    P.rig = R.createCreature(g, { shadow: false });
    const s = 1.7 / Math.max(1.1, g.height, g.body.l * 0.9, (g.wings ? g.wings.span * 0.45 : 0));
    P.rig.holder.scale.setScalar(s);
    P.rig.holder.rotation.y = 0.5;
    P.scene.add(P.rig.holder);
    P.genome = g;
  };
  G.showcase = function () {
    const ids = AM.BASE_IDS;
    const a = ids[(Math.random() * ids.length) | 0], b = ids[(Math.random() * ids.length) | 0];
    G.previewGenome(AM.fuse(a, b, (Math.random() * 4) | 0));
    G.showcaseT = 6;
  };

  // Start a new game or continue a save.
  G.startGame = function (state) {
    G.clearWorld();
    G.state = state;
    G.world = AM.createWorld(state.seed);
    G.prog = AM.makeProg(G);
    const removed = new Set();
    for (const id in state.mined) removed.add(id);
    G.view = new R.WorldView(G.scene, G.world, { radius: G.settings.viewDist, shadows: G.settings.shadows !== 'off', removed });
    G.view.onStructure = onStructure;
    G.view.onChunk = (c, loaded) => { if (!loaded) onChunkUnload(c); };
    G.level = G.view;
    G.mode = 'play';
    G.paused = false;
    const g = AM.fuse(state.form.mother, state.form.father, state.form.variant);
    const pos = state.pos || { x: 0, z: 3 };
    G.player = new E.Entity(G, { kind: 'player', genome: g, x: pos.x, z: pos.z, look: lookOf(state) });
    G.entities.push(G.player);
    if (state.hp != null) G.player.hp = Math.min(G.player.maxHp, state.hp);
    if (state.energy != null) G.player.energy = state.energy;
    G.player.dodgeCharges = G.player.stats.dodgeCharges;
    G.makeWeapon();
    G.view.loadAllNow(G.player.x, G.player.z);
    G.camTarget = { x: G.player.x, z: G.player.z };
    G.hud.show(true);
    G.hud.refreshPowers();
    G.hud.refreshGoal();
    G.ui.closeAll();
    G.updateTouchMode();
    if (G.preview && G.preview.rig) { R.disposeCreature(G.preview.rig); G.preview.rig = null; }
    if (state.inInterior) { const s = G.findStructure(state.inInterior); delete state.inInterior; if (s) G.enterInterior(s, true); }
    G.save();
  };
  function lookOf(st) {
    return { helmet: st.equipment.helmet ? st.equipment.helmet.rarity : null, armor: st.equipment.armor ? st.equipment.armor.rarity : null };
  }
  G.refreshPlayer = function () {
    const p = G.player;
    if (!p) return;
    const st = G.state;
    const g = AM.fuse(st.form.mother, st.form.father, st.form.variant);
    const lookKey = JSON.stringify(lookOf(st));
    if (g.key !== p.genome.key || lookKey !== p.lookKey) {
      p.genome = g; p.radius = g.radius; p.flying = g.posture === 'hover';
      p.makeRig(lookOf(st)); p.lookKey = lookKey;
      st.formName = g.name;
    }
    p.recompute();
    p.dodgeCharges = Math.min(p.dodgeCharges, p.stats.dodgeCharges);
    G.makeWeapon();
    G.hud.refreshPowers();
  };
  // Floating "bound" weapon beside the player.
  G.makeWeapon = function () {
    const p = G.player;
    if (G.weaponMesh) { G.weaponMesh.parent && G.weaponMesh.parent.remove(G.weaponMesh); G.weaponMesh = null; }
    const it = G.state.equipment.weapon;
    if (!it || it.base === 'claws') return;
    const mesh = new THREE.Mesh(R.weaponGeo(it.base, it.rarity), R.materials().set);
    mesh.castShadow = G.settings.shadows !== 'off';
    G.weaponMesh = mesh;
    G.scene.add(mesh);
    G.weaponAnim = { t: 0, swing: 0, ranged: false };
    void p;
  };
  G.weaponSwing = function (ranged) { if (G.weaponAnim) { G.weaponAnim.swing = 1; G.weaponAnim.ranged = ranged; G.weaponAnim.dir = (G.weaponAnim.dir || 1) * -1; } };

  G.clearWorld = function () {
    for (const e of G.entities) e.dispose();
    G.entities = []; G.summons = []; G.player = null;
    for (const k of G.pickups) { k.orb.remove(); if (k.beam) k.beam.remove(); }
    G.pickups = [];
    if (G.fx) G.fx.clear();
    C.clearAll(G);
    if (G.interior) { G.interior.dispose(); G.interior = null; }
    if (G.view) { G.view.dispose(); G.view = null; }
    if (G.weaponMesh) { G.scene.remove(G.weaponMesh); G.weaponMesh = null; }
    G.chestMeshes = new Map();
    G.spawnedFor = new Set();
    G.gather = null; G.focus = null;
  };

  // ---------- structures: NPCs, camps, guardians, chests ----------
  function onStructure(sm) {
    const s = sm.s;
    if (s.type === 'village') {
      if (G.spawnedFor.has(s.id)) return;
      G.spawnedFor.add(s.id);
      for (const n of sm.layout.npcs) { const e = E.spawnNpc(G, n, s); e.structId = s.id; }
    } else if (s.type === 'camp') {
      if (G.spawnedFor.has(s.id)) return;
      G.spawnedFor.add(s.id);
      const L = sm.layout;
      const biome = AM.BIOME_INDEX[s.biome];
      const rng = AM.makeRng(AM.hash2(s.seed, G.state.day, 7));
      for (let i = 0; i < L.pack; i++) {
        const a = (i / L.pack) * 6.28;
        const roll = G.world.rollWild(rng, biome, s.level);
        if (i === 0 && L.elite) { roll.rank = 'elite'; roll.affix = rng.pick(AM.ELITE_AFFIXES); }
        const e = E.spawnWild(G, s.x + Math.cos(a) * 3, s.z + Math.sin(a) * 3, roll, { biome: s.biome });
        e.structId = s.id; e.campId = s.id; e.aggressive = true;
      }
    } else if (s.type === 'ruin') {
      if (!G.state.opened.has(sm.layout.chest.id) && !G.spawnedFor.has(s.id)) {
        G.spawnedFor.add(s.id);
        const rng = AM.makeRng(s.seed);
        const roll = G.world.rollWild(rng, AM.BIOME_INDEX[s.biome], s.level + 1);
        roll.rank = 'elite'; roll.affix = rng.pick(AM.ELITE_AFFIXES);
        const e = E.spawnWild(G, s.x + 2, s.z - 2, roll, { biome: s.biome });
        e.structId = s.id; e.campId = s.id; e.name = 'Guardian ' + e.genome.name;
      }
    }
    // chest meshes
    for (const it of G.view.interactables.values()) {
      if (it.type !== 'chest' || it.struct !== s || G.chestMeshes.has(it.id)) continue;
      const opened = G.state.opened.has(it.id);
      const mesh = new THREE.Mesh(R.objectGeo(opened ? 'chestOpen' : 'chest'), R.materials().set);
      mesh.position.set(it.x, 0, it.z); mesh.rotation.y = (s.seed % 6);
      mesh.castShadow = G.settings.shadows !== 'off';
      G.view.dyn.add(mesh); sm.objs.push(mesh);
      G.chestMeshes.set(it.id, mesh);
      if (opened) G.view.interactables.delete(it.id);
    }
  }
  function onChunkUnload(c) {
    const k = c.data.cx + ',' + c.data.cz;
    for (const s of c.data.structs) {
      if (Math.floor(s.x / AM.CHUNK) + ',' + Math.floor(s.z / AM.CHUNK) !== k) continue;
      G.spawnedFor.delete(s.id);
      for (const e of G.entities) if (e.structId === s.id && !e.dead) { e.dead = true; e.remove = true; }
      for (const [id, m] of G.chestMeshes) if (id.endsWith(s.id)) G.chestMeshes.delete(id);
    }
  }
  G.findStructure = function (id) {
    const parts = id.split(':');
    const list = G.world.region(+parts[1], +parts[2]);
    return list.find((s) => s.id === id) || null;
  };

  // ---------- interiors ----------
  G.enterInterior = function (s, silent) {
    for (const e of G.entities) if (e !== G.player) { e.dead = true; e.remove = true; }
    G.returnPos = { x: s.x, z: s.z + (s.type === 'cave' ? 3.4 : 3.2) };
    G.view.setVisible(false);
    C.clearAll(G);
    for (const k of G.pickups) { k.orb.remove(); if (k.beam) k.beam.remove(); } G.pickups = [];
    G.interior = new AM.Interior(G, s);
    G.level = G.interior;
    G.mode = 'interior';
    G.player.x = G.interior.exit.x; G.player.z = G.interior.exit.z;
    { const r = G.interior.resolve(G.player.x, G.player.z, G.player.radius); G.player.x = r[0]; G.player.z = r[1]; }
    G.camTarget = { x: G.player.x, z: G.player.z };
    G.interior.spawn();
    if (!silent) { G.hud.toast(`Entered ${s.name} (level ${s.level})`, 'info'); G.audio.sfx('door'); }
    if (s.level > G.state.level + 4) G.hud.toast('Danger! The creatures here are far stronger than you.', 'bad');
    G.save();
  };
  G.leaveInterior = function () {
    if (!G.interior) return;
    for (const e of G.entities) if (e !== G.player && !e.dead) { e.dead = true; e.remove = true; }
    C.clearAll(G);
    for (const k of G.pickups) { k.orb.remove(); if (k.beam) k.beam.remove(); } G.pickups = [];
    G.interior.dispose(); G.interior = null;
    G.view.setVisible(true);
    G.level = G.view;
    G.mode = 'play';
    G.player.x = G.returnPos.x; G.player.z = G.returnPos.z;
    G.camTarget = { x: G.player.x, z: G.player.z };
    G.spawnedFor = new Set();
    for (const sm of G.view.structMeshes.values()) onStructure(sm);
    G.save();
  };

  // ---------- teleport, death ----------
  G.teleportTo = function (structId) {
    const s = G.findStructure(structId);
    if (!s) return;
    if (G.mode === 'interior') { G.returnPos = { x: s.x, z: s.z }; G.leaveInterior(); }
    for (const e of G.entities) if (e !== G.player && e.kind !== 'npc') { e.dead = true; e.remove = true; }
    let x = s.x, z = s.z;
    if (s.type === 'village') { const L = G.world.villageLayout(s); x = L.obelisk.x - 1.5; z = L.obelisk.z + 2; } else { z += 2.5; }
    G.player.x = x; G.player.z = z;
    G.view.loadAllNow(x, z);
    G.camTarget = { x, z };
    G.fx.burst(x, 1, z, '#6fe3ff', 30, 4, 0.18, 0.8);
    G.audio.sfx('teleport');
    if (s.type === 'village') G.state.lastVillage = s.id;
  };
  G.onPlayerDeath = function () {
    G.audio.sfx('die');
    G.player.attackT = -1;
    setTimeout(() => G.ui.open('death'), 1100);
  };
  G.respawn = function () {
    const st = G.state, p = G.player;
    const lost = Math.floor(st.gold * 0.1);
    st.gold -= lost;
    if (G.mode === 'interior') { G.interior.dispose(); G.interior = null; G.view.setVisible(true); G.level = G.view; G.mode = 'play'; C.clearAll(G); }
    for (const e of G.entities) if (e !== p && e.kind !== 'npc') { e.dead = true; e.remove = true; }
    p.dead = false; p.deathT = 0; p.status = {}; p.hp = p.maxHp; p.energy = p.stats.maxEnergy; p.iframes = 2;
    p.rig.holder.rotation.z = 0; p.rig.mesh.scale.setScalar(1);
    let x = 0, z = 3;
    if (st.lastVillage) { const s = G.findStructure(st.lastVillage); if (s) { x = s.x + 2; z = s.z + 3; } }
    p.x = x; p.z = z;
    G.view.loadAllNow(x, z);
    G.spawnedFor = new Set();
    for (const sm of G.view.structMeshes.values()) onStructure(sm);
    G.camTarget = { x, z };
    G.hud.toast(lost ? `You lost ${lost} gold.` : 'You wake up in the village.', 'bad');
    G.save();
  };

  // ---------- saving ----------
  G.save = function () {
    const st = G.state, p = G.player;
    if (!st || !p) return false;
    if (G.mode === 'interior' && G.returnPos) { st.pos = { x: G.returnPos.x, z: G.returnPos.z }; st.inInterior = G.interior ? G.interior.s.id : null; }
    else { st.pos = { x: p.x, z: p.z }; delete st.inInterior; }
    st.hp = p.dead ? p.maxHp : p.hp; st.energy = p.energy; st.savedAt = Date.now();
    const ok = AM.saveSlot(st.slot, st);
    if (!ok && !G.warnedSave) { G.warnedSave = true; G.hud.toast('Could not save (storage unavailable). Use Export in Settings.', 'bad'); }
    return ok;
  };
  G.isMined = function (id) { const t = G.state.mined[id]; if (t == null) return false; if (G.state.playtime >= t) { delete G.state.mined[id]; return false; } return true; };

  // ---------- interactions ----------
  G.interactLabel = function (it) {
    switch (it.type) {
      case 'npc': return 'Talk to ' + it.e.name;
      case 'chest': return it.locked ? 'Locked (defeat the boss)' : 'Open';
      case 'mine': return 'Mine ' + (AM.MATERIALS[it.ore] || {}).name;
      case 'herb': return 'Pick herbs';
      case 'wood': return 'Chop wood';
      case 'cave': return 'Enter ' + it.struct.name;
      case 'dungeon': return `Enter ${it.struct.name} (Lv ${it.struct.level})`;
      case 'obelisk': return 'Waypoint';
      case 'lore': return G.state.readLore.has(it.id) ? 'Read again' : 'Read';
      case 'exit': return 'Leave';
      default: return 'Use';
    }
  };
  function findFocus() {
    const p = G.player;
    let best = G.level.nearestInteractable(p.x, p.z, 2.6);
    let bd = best ? AM.dist(best.x, best.z, p.x, p.z) : 3.2;
    for (const e of G.entities) {
      if (e.kind !== 'npc' || e.dead) continue;
      const d = AM.dist(e.x, e.z, p.x, p.z);
      if (d < 3.2 && d < bd) { bd = d; best = { type: 'npc', e, x: e.x, z: e.z }; }
    }
    return best;
  }
  G.interact = function (it) {
    if (!it || G.player.dead) return;
    const st = G.state;
    switch (it.type) {
      case 'npc': {
        const role = it.e.role, v = it.e.village;
        if (role === 'elder' || role === 'merchant' || role === 'smith' || role === 'lab') st.lastVillage = v.id;
        if (role === 'elder') { G.prog.questEvent('deliver', v.id); G.ui.open('elder', { village: v }); }
        else if (role === 'merchant') G.ui.open('shop', { village: v });
        else if (role === 'smith') G.ui.open('smith', { village: v });
        else if (role === 'lab') G.ui.open('lab', { village: v });
        G.audio.sfx('ui');
        break;
      }
      case 'chest': {
        if (it.locked) { G.hud.toast('This chest is sealed until the boss falls.', 'bad'); return; }
        st.opened.add(it.id);
        const level = it.level || G.world.dangerAt(it.x, it.z);
        const drops = AM.rollChest(AM.makeRng((Math.random() * 1e9) | 0), level, G.player.stats, it.big);
        G.prog.spawnDrops(drops, it.x, it.z);
        G.prog.stat('chests', 1);
        G.fx.burst(it.x, 0.8, it.z, '#f2c14e', 20, 4);
        G.audio.sfx('chest');
        if (it.interior) {
          G.interior.openChest(it.id);
          if (G.interior.kind === 'cave' && !st.cleared.has(G.interior.s.id)) { st.cleared.add(G.interior.s.id); G.prog.stat('caves', 1); G.prog.questEvent('clear', G.interior.s.id); }
        } else {
          G.level.interactables.delete(it.id);
          const m = G.chestMeshes.get(it.id); if (m) m.geometry = R.objectGeo('chestOpen');
        }
        break;
      }
      case 'mine': case 'herb': case 'wood':
        G.gather = { it, t: 0, need: (it.type === 'mine' ? 1.3 : 0.8) * (1 - Math.min(0.6, G.player.stats.mining * 0.5)), x: G.player.x, z: G.player.z };
        break;
      case 'cave': case 'dungeon': G.enterInterior(it.struct); break;
      case 'exit': G.leaveInterior(); break;
      case 'obelisk': {
        const s = it.struct;
        if (s) { st.waypoints.add(s.id); if (s.type === 'village') st.lastVillage = s.id; }
        G.ui.open('map', { teleport: true });
        break;
      }
      case 'lore': {
        const first = !st.readLore.has(it.id);
        st.readLore.add(it.id);
        G.ui.open('lore', { seed: AM.hashStr(it.id) });
        if (first) { G.prog.gainXp(Math.round(AM.xpToNext(st.level) * 0.15)); G.prog.questEvent('lore', it.struct.id); }
        break;
      }
      default: break;
    }
  };
  function finishGather() {
    const it = G.gather.it, st = G.state;
    G.gather = null;
    const rng = Math.random;
    let mats = {};
    if (it.type === 'mine') { mats[it.ore] = it.ore === 'stone' ? 3 : 1 + (rng() < 0.4 ? 1 : 0); if (it.ore !== 'stone') mats.stone = 1; }
    else if (it.type === 'herb') mats.herb = 1 + Math.floor(rng() * 3);
    else mats.wood = 2 + Math.floor(rng() * 2);
    for (const k in mats) AM.Ent.dropPickup(G, it.x, it.z, 'mat', { id: k, n: mats[k] });
    st.mined[it.id] = st.playtime + 300;
    if (it.interior) G.interior.removeOre(it.id); else G.view.removeProp(it.id);
    G.prog.gainXp(3 + st.level);
    G.prog.stat('gathered', 1);
    G.fx.burst(it.x, 0.6, it.z, it.type === 'mine' ? (R.ORE_COL[it.ore] || '#aaa') : it.type === 'herb' ? '#5fd068' : '#9a6a3a', 14, 3);
  }

  // ---------- input actions ----------
  function onAction(a) {
    if (a === 'pause') { if (G.ui.top()) G.ui.back(); else if (G.mode === 'play' || G.mode === 'interior') G.ui.open('pause'); return; }
    if (G.mode !== 'play' && G.mode !== 'interior') return;
    if (G.ui.top() && G.ui.top() !== 'hud') {
      const map = { inventory: 'inventory', powers: 'powers', skills: 'skills', map: 'map', quests: 'quests' };
      if (map[a] && G.ui.top() === map[a]) G.ui.back();
      return;
    }
    if (a === 'inventory') G.ui.open('inventory');
    else if (a === 'powers') G.ui.open('powers');
    else if (a === 'skills') G.ui.open('skills');
    else if (a === 'map') G.ui.open('map');
    else if (a === 'quests') G.ui.open('quests');
    else if (a === 'camL' && G.settings.camRotate) G.camYawTarget -= Math.PI / 4;
    else if (a === 'camR' && G.settings.camRotate) G.camYawTarget += Math.PI / 4;
    else if (a === 'zoomIn') { G.camZoom = AM.clamp(G.camZoom * 1.12, 0.6, 1.7); updateCameraFrustum(); }
    else if (a === 'zoomOut') { G.camZoom = AM.clamp(G.camZoom / 1.12, 0.6, 1.7); updateCameraFrustum(); }
  }

  // ---------- aiming ----------
  const screenToWorldDir = (mx, my) => {
    const c = G.camYaw;
    return [mx * Math.cos(c) - my * Math.sin(c), -mx * Math.sin(c) - my * Math.cos(c)];
  };
  function computeAim() {
    const p = G.player, I = G.input;
    if (I.device === 'kb' && I.hasMouse) {
      G.v2.set((I.mouse.x / root.innerWidth) * 2 - 1, -(I.mouse.y / root.innerHeight) * 2 + 1);
      G.raycaster.setFromCamera(G.v2, G.camera);
      if (G.raycaster.ray.intersectPlane(G.plane, G.v3)) return { x: G.v3.x, z: G.v3.z, manual: true };
    }
    if (I.padAim) { const [wx, wz] = screenToWorldDir(I.padAim.x, -I.padAim.y); return { x: p.x + wx * 6, z: p.z + wz * 6, manual: true }; }
    return autoAim(8);
  }
  function autoAim(range) {
    const p = G.player;
    const fx = Math.sin(p.yaw), fz = Math.cos(p.yaw);
    let best = null, bs = -1e9;
    if (G.settings.autoAim) {
      for (const e of C.enemiesOf(G, p)) {
        const dx = e.x - p.x, dz = e.z - p.z, d = Math.hypot(dx, dz);
        if (d > range) continue;
        const facing = (dx * fx + dz * fz) / (d || 1);
        const sc = -d + facing * 3 + (e.rank !== 'normal' ? 1 : 0);
        if (sc > bs) { bs = sc; best = e; }
      }
    }
    if (best) return { x: best.x, z: best.z, target: best };
    return { x: p.x + fx * 5, z: p.z + fz * 5 };
  }

  // ---------- player ----------
  function updatePlayer(dt) {
    const p = G.player, I = G.input, S = p.stats, st = G.state;
    if (p.dead) return;
    p.energy = Math.min(S.maxEnergy, p.energy + S.energyRegen * dt);
    p.cd.attack -= dt;
    for (const k in p.cd.powers) p.cd.powers[k] -= dt;
    if (p.dodgeCharges < S.dodgeCharges) { p.dodgeRe = (p.dodgeRe || S.dodgeCd) - dt; if (p.dodgeRe <= 0) { p.dodgeCharges++; p.dodgeRe = S.dodgeCd; } }
    if (p.cleanseT > G.time) for (const k of ['burn', 'poison', 'bleed', 'slow', 'freeze', 'stun', 'root', 'fear', 'blind']) delete p.status[k];
    const aim = computeAim();
    G.aimWorld = aim;
    G.focus = findFocus();
    let mv = 0;
    if (p.roll) {
      const r = p.roll;
      const step = r.speed * dt;
      E.moveEntity(G, p, r.dx * step, r.dz * step);
      r.t -= dt;
      p.yaw = Math.atan2(r.dx, r.dz);
      if (S.dodgeHit) for (const e of C.enemiesOf(G, p)) if (!r.hit.has(e) && AM.dist(e.x, e.z, p.x, p.z) < e.radius + p.radius) { r.hit.add(e); C.damage(G, p, e, S.atk * S.dodgeHit, { kind: 'melee', knock: 4 }); }
      if (Math.random() < 0.7) G.fx.trail(p.x, 0.3, p.z, '#e8e0d0', 0.18);
      if (r.t <= 0) p.roll = null;
      mv = 1;
    } else if (p.canAct() && !p.dash && !p.channel) {
      const [wx, wz] = screenToWorldDir(I.move.x, I.move.y);
      const len = Math.hypot(wx, wz);
      const shallow = G.level.waterAt(p.x, p.z) === 1 && !p.flying ? 0.72 : 1;
      if (len > 0.05) {
        const sp = S.speed * p.speedMul() * shallow * Math.min(1, len);
        E.moveEntity(G, p, wx / len * sp * dt, wz / len * sp * dt);
        if ((p.faceT || 0) <= 0) p.yaw = AM.approachAngle(p.yaw, Math.atan2(wx, wz), dt * 12);
        mv = Math.min(1, len) * p.speedMul();
        st.stats.distance += sp * dt;
        if (G.gather && AM.dist(p.x, p.z, G.gather.x, G.gather.z) > 0.6) G.gather = null;
      }
      if (p.faceT > 0) { p.faceT -= dt; p.yaw = AM.approachAngle(p.yaw, Math.atan2(aim.x - p.x, aim.z - p.z), dt * 14); }
      if (I.attackHeld) {
        C.playerAttack(G, aim.x, aim.z);
        p.faceT = 0.35;
        G.gather = null;
      }
      if (I.pressed.has('dodge') && p.dodgeCharges > 0) {
        let dx = wx, dz = wz;
        if (Math.hypot(dx, dz) < 0.1) { dx = Math.sin(p.yaw); dz = Math.cos(p.yaw); }
        const l = Math.hypot(dx, dz);
        p.roll = { dx: dx / l, dz: dz / l, t: 0.28, speed: S.dodgeDist / 0.28, hit: new Set() };
        p.iframes = 0.34; p.dodgeCharges--; if (p.dodgeCharges < S.dodgeCharges && !p.dodgeRe) p.dodgeRe = S.dodgeCd;
        G.audio.sfx('dodge');
        G.gather = null;
      }
      for (let i = 0; i < 4; i++) {
        if (!I.pressed.has('p' + i)) continue;
        if (i >= S.powerSlots) continue;
        const id = st.powers.equipped[i];
        if (!id) { G.hud.toast('Empty power slot: equip powers in Powers (P)', 'bad'); continue; }
        const spec = AM.powerSpec(id);
        if ((p.cd.powers[id] || 0) > 0) { G.audio.sfx('error'); continue; }
        if (p.energy < spec.energy) { G.hud.toast('Not enough energy', 'bad'); G.audio.sfx('error'); continue; }
        let ax = aim.x, az = aim.z;
        if (I.castAim) { const [dx, dz] = screenToWorldDir(I.castAim.dx, -I.castAim.dy); const l = Math.hypot(dx, dz) || 1; const r = spec.params.range || spec.params.distance || 7; ax = p.x + dx / l * Math.min(r, 3 + Math.hypot(I.castAim.dx, I.castAim.dy) / 18); az = p.z + dz / l * Math.min(r, 3 + Math.hypot(I.castAim.dx, I.castAim.dy) / 18); }
        else if (!aim.manual && !aim.target) { const t = autoAim(spec.params.range || 10); ax = t.x; az = t.z; }
        p.energy -= spec.energy;
        p.cd.powers[id] = spec.cd * (1 - S.cdr);
        p.faceT = 0.4;
        C.cast(G, p, spec, ax, az);
        G.prog.stat('casts', 1);
        G.gather = null;
      }
      if (I.pressed.has('interact') && G.focus) G.interact(G.focus);
      if (I.pressed.has('potion')) G.prog.useCon('potion');
    }
    if (G.gather) {
      G.gather.t += dt;
      if (Math.random() < dt * 10) G.fx.trail(G.gather.it.x, 0.8, G.gather.it.z, '#ffffff', 0.12);
      if (Math.random() < dt * 4) G.audio.sfx('mine');
      if (G.gather.t >= G.gather.need) finishGather();
    }
    p.move = mv;
  }

  // ---------- world bookkeeping ----------
  function worldTick(dt) {
    const st = G.state, p = G.player;
    st.playtime += dt;
    const before = st.time;
    st.time = (st.time + dt / DAY_LENGTH) % 1;
    if (st.time < before) { st.day++; G.hud.toast(`Day ${st.day + 1} dawns. Shops and quests refresh.`, 'info'); }
    G.isNight = st.time > 0.53 && st.time < 0.97;
    if (G.mode !== 'play') return;
    G.discoverT -= dt;
    if (G.discoverT <= 0) {
      G.discoverT = 0.5;
      const cx = Math.floor(p.x / AM.CHUNK), cz = Math.floor(p.z / AM.CHUNK);
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) st.explored.add((cx + dx) + ',' + (cz + dz));
      for (const s of G.world.structuresNear(p.x, p.z, 26)) G.prog.discover(s);
      if (!st.goalsDone.has('move')) G.prog.stat('distance', 0);
      const b = AM.BIOMES[G.view.biomeAt(p.x, p.z)].id;
      if (!st.biomesSeen.has(b)) { st.biomesSeen.add(b); if (st.biomesSeen.size > 1) G.hud.toast(`New biome: ${AM.BIOMES[AM.BIOME_INDEX[b]].name}`, 'info'); G.prog.stat('biomes', 0); }
      // quest elites
      for (const q of st.quests.active) {
        if (q.type !== 'elite' || q.done || G.entities.some((e) => e.quest === q.id && !e.dead)) continue;
        if (AM.dist(p.x, p.z, q.x, q.z) < 45) {
          const e = E.spawnWild(G, q.x, q.z, { mother: q.pair[0], father: q.pair[1], variant: 1, level: q.eliteLevel, rank: 'elite', affix: AM.ELITE_AFFIXES[AM.hashStr(q.id) % AM.ELITE_AFFIXES.length] }, { biome: AM.BIOMES[G.world.biomeAt(q.x, q.z)].id });
          e.quest = q.id; e.name = q.eliteName;
        }
      }
      // respawn harvested props
      for (const id in st.mined) if (st.playtime >= st.mined[id]) { delete st.mined[id]; if (G.view.removed.has(id)) G.view.restoreProp(id); }
    }
    E.spawnAround(G, dt);
  }

  // ---------- main update ----------
  function update(dt) {
    G.time += dt;
    worldTick(dt);
    updatePlayer(dt);
    const p = G.player;
    for (const e of G.entities) {
      if (e.dead) continue;
      C.updateStatus(G, e, dt);
      if (e.dead) continue;
      C.updateActor(G, e, dt);
      if (e.kind === 'wild' || e.kind === 'boss') {
        E.aiUpdate(G, e, dt);
        if (e.life != null) { e.life -= dt; if (e.life <= 0) { e.dead = true; e.remove = true; G.fx.burst(e.x, 0.5, e.z, '#aaaaaa', 8, 2); } }
      } else if (e.kind === 'summon') E.summonUpdate(G, e, dt);
      else if (e.kind === 'npc') {
        const d = AM.dist(e.x, e.z, p.x, p.z);
        if (d < 6) e.yaw = AM.approachAngle(e.yaw, Math.atan2(p.x - e.x, p.z - e.z), dt * 4);
        e.move = 0;
      }
    }
    E.separate(G, G.entities);
    C.update(G, dt);
    E.updatePickups(G, dt);
    if (G.interior) G.interior.update(dt);
    if (G.mode === 'play') G.view.update(p.x, p.z, 1);
    // remove finished entities
    for (let i = G.entities.length - 1; i >= 0; i--) {
      const e = G.entities[i];
      if (!e.dead || e === p) continue;
      e.deathT += dt;
      if (e.remove || e.deathT > 1.3) { e.dispose(); G.entities.splice(i, 1); }
    }
    G.summons = G.summons.filter((s) => !s.dead);
    G.autosaveT -= dt;
    if (G.autosaveT <= 0) { G.autosaveT = 60; G.save(); }
    const combat = G.entities.some((e) => e.team === 1 && !e.dead && e.ai && e.ai.state === 'chase');
    const biomeId = G.mode === 'interior' ? 'interior' : AM.BIOMES[G.view.biomeAt(p.x, p.z)].id;
    G.audio.updateMusic(dt, biomeId, G.isNight, combat);
  }

  // ---------- render helpers ----------
  function animateEntities(dt) {
    const p = G.player;
    G.animFrame = (G.animFrame || 0) + 1;
    for (const e of G.entities) {
      const rig = e.rig;
      const d = AM.dist(e.x, e.z, p.x, p.z);
      const far = d > 24;
      e.animAcc = (e.animAcc || 0) + dt;
      if (!far || (G.animFrame + e.id) % 3 === 0 || e.dead) {
        const frozen = e.status.freeze && e.status.freeze.t > 0;
        R.animateCreature(rig, { move: frozen ? 0 : e.move || 0, attack: e.attackT, attackKind: e.attackKind === 'weapon' || e.attackKind === 'cast' ? 'slam' : e.attackKind, dead: e.dead ? e.deathT : 0, lift: e.lift || 0 }, frozen ? 0 : e.animAcc);
        e.animAcc = 0;
      }
      rig.holder.position.set(e.x, e.flying && G.mode !== 'interior' && G.level.waterAt(e.x, e.z) ? 0.05 : 0, e.z);
      rig.holder.rotation.y = e.yaw;
      rig.holder.visible = d < 60;
      if (e.aura) { e.aura.set(e.x, e.z); e.aura.d.mesh.rotation.y += dt; }
      if (e.tele) e.tele.set(e.x, e.z);
    }
    // bound weapon
    if (G.weaponMesh && p) {
      const a = G.weaponAnim; a.t += dt; a.swing = Math.max(0, a.swing - dt * 4);
      const side = p.radius + 0.35;
      const yaw = p.yaw + (a.swing > 0 && !a.ranged ? (1 - a.swing) * 2.4 * (a.dir || 1) - 1.2 * (a.dir || 1) : 0);
      const ox = Math.sin(yaw + Math.PI / 2) * side, oz = Math.cos(yaw + Math.PI / 2) * side;
      G.weaponMesh.position.set(p.x + ox, p.genome.height * 0.6 + 0.3 + Math.sin(a.t * 2) * 0.08, p.z + oz);
      G.weaponMesh.rotation.set(a.swing > 0 && !a.ranged ? -1.2 * a.swing : 0, yaw, a.ranged ? 0 : 0.25);
      G.weaponMesh.visible = !p.dead;
    }
  }
  function updateCamera(dt) {
    const p = G.player;
    G.camYaw += (G.camYawTarget - G.camYaw) * Math.min(1, dt * 8);
    const k = Math.min(1, dt * 7);
    G.camTarget.x += (p.x - G.camTarget.x) * k; G.camTarget.z += (p.z - G.camTarget.z) * k;
    const pitch = 0.68, D = 48;
    let sx = 0, sy = 0;
    if (G.shakeT > 0 && G.settings.shake) { G.shakeT -= dt; sx = (Math.random() - 0.5) * G.shakeT * 1.2; sy = (Math.random() - 0.5) * G.shakeT * 1.2; }
    const tx = G.camTarget.x + sx, tz = G.camTarget.z + sy;
    G.camera.position.set(tx + Math.sin(G.camYaw) * Math.cos(pitch) * D, Math.sin(pitch) * D + 0.8, tz + Math.cos(G.camYaw) * Math.cos(pitch) * D);
    G.camera.lookAt(tx, 0.8, tz);
    if (G.input.zoomDelta) { G.camZoom = AM.clamp(G.camZoom * (G.input.zoomDelta > 0 ? 1.1 : 1 / 1.1), 0.6, 1.7); updateCameraFrustum(); }
  }
  G.shake = function (v) { G.shakeT = Math.max(G.shakeT, v); };

  function lighting() {
    if (G.mode === 'interior') {
      const T = AM.INTERIOR_THEMES[G.interior.kind];
      G.sky.hemi.intensity = 0.55; G.sky.hemi.color.set(0x8a8aa8); G.sky.sun.intensity = 0.55;
      G.sky.sun.position.set(G.player.x + 6, 30, G.player.z + 10); G.sky.sun.target.position.set(G.player.x, 0, G.player.z);
      G.scene.fog.color.set(T.fog); G.scene.background.set(T.fog); G.scene.fog.near = 52; G.scene.fog.far = 90;
      G.sky.night.position.set(G.player.x, 3, G.player.z); G.sky.night.intensity = 2.6; G.sky.night.distance = 16;
      return;
    }
    const p = G.player;
    const fog = AM.BIOMES[G.view.biomeAt(p.x, p.z)].fog;
    G.sky.night.distance = 14;
    G.sky.update(G.state.time, p.x, p.z, fog, 48, p.stats.light > 0);
  }

  // ---------- frame ----------
  function frame(now) {
    requestAnimationFrame(frame);
    const cap = G.settings.fpsCap;
    if (cap && cap < 200 && now - (G.lastRender || 0) < 1000 / cap - 2) return;
    let dt = Math.min(0.066, (now - G.last) / 1000);
    G.last = now; G.lastRender = now;
    G.input.update();
    if ((G.mode === 'play' || G.mode === 'interior') && G.player) {
      if (!G.paused) {
        let sdt = dt;
        if (G.hitStop > 0) { G.hitStop -= dt; sdt *= 0.2; }
        update(sdt);
        animateEntities(sdt);
        G.fx.update(sdt);
      }
      updateCamera(dt);
      lighting();
      G.hud.update(G, G.paused ? 0 : dt);
      const labOpen = G.ui.top() === 'lab' && G.preview && G.preview.rig;
      if (labOpen) { const P = G.preview; P.t += dt; P.rig.holder.rotation.y += dt * 0.5; P.island.rotation.y = P.rig.holder.rotation.y; R.animateCreature(P.rig, { move: 0 }, dt); G.renderer.render(P.scene, P.camera); }
      else G.renderer.render(G.scene, G.camera);
    } else if (G.preview) {
      const P = G.preview;
      P.t += dt;
      if (P.rig) {
        if (P.spin) P.rig.holder.rotation.y += dt * 0.5;
        R.animateCreature(P.rig, { move: P.walk ? 0.6 : 0 }, dt);
      }
      P.island.rotation.y = P.rig ? P.rig.holder.rotation.y : 0;
      if (G.mode === 'title') { G.showcaseT -= dt; if (G.showcaseT <= 0) G.showcase(); }
      G.renderer.render(P.scene, P.camera);
    }
    G.input.endFrame();
    dynamicResolution(dt);
  }
  function dynamicResolution(dt) {
    const s = G.settings;
    if (!s.dynRes || G.paused) return;
    const D = G.dyn;
    D.t += dt; D.frames++;
    if (D.t < 2) return;
    const fps = D.frames / D.t;
    D.t = 0; D.frames = 0;
    const target = Math.min(s.fpsCap || 60, 60);
    if (fps < target * 0.82 && G.renderScale > 0.5) G.setRenderScale(G.renderScale - 0.1);
    else if (fps > target * 0.97 && G.renderScale < s.renderScale - 0.01) G.setRenderScale(Math.min(s.renderScale, G.renderScale + 0.05));
  }

  // ---------- fullscreen ----------
  G.toggleFullscreen = function () {
    const d = document, el = d.documentElement;
    const fs = d.fullscreenElement || d.webkitFullscreenElement;
    if (!fs) {
      const req = el.requestFullscreen || el.webkitRequestFullscreen;
      if (req) {
        const pr = req.call(el, { navigationUI: 'hide' });
        if (pr && pr.then) pr.then(() => { if (screen.orientation && screen.orientation.lock && isMobile()) screen.orientation.lock('landscape').catch(() => {}); }).catch(() => G.hud.toast('Fullscreen is not available here', 'bad'));
      } else G.hud.toast('Fullscreen is not available here', 'bad');
    } else (d.exitFullscreen || d.webkitExitFullscreen).call(d);
  };

  root.addEventListener('DOMContentLoaded', boot);
})(typeof window !== 'undefined' ? window : globalThis);
