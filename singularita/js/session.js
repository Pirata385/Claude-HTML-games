// Session glue: objectives, saving, settings, audio routing, and the callbacks menus use.
import { ObjectiveTracker } from './systems/objectives.js';
import { nextUnlock } from './data/unlocks.js';
import { equippedIn } from './systems/equipment.js';
import { ITEMS } from './data/items.js';
import { CONSUMABLES } from './data/consumables.js';
import { UI } from './ui/ui.js';
import { Interaction } from './world/interact.js';
import { LUME_LINES } from './data/lore.js';

export function installSession(game, { audio }) {
  const p = game.profile, bus = game.bus;
  game.audio = audio;
  game.objectives = new ObjectiveTracker(p);
  game.nextUnlock = () => nextUnlock(p.classId, p.level);
  game.isAtForge = () => game.zone.type === 'island' && Math.hypot(game.player.x - game.zone.base.stations.forge.x, game.player.z - game.zone.base.stations.forge.z) < 4.5;

  // ---------------------------------------------------------------- objectives
  const progress = (ev) => {
    const done = game.objectives.handle(ev);
    if (done) completed(done);
  };
  const completed = (o) => {
    game.ui.toast(`Objective complete: ${o.text}`, 'good', 4);
    game.grantXp(o.xp, null);
    bus.emit('sfx', { id: 'victory' });
    const w = equippedIn(p, 'weapon');
    for (const d of game.objectives.checkImmediate({ weaponTier: w ? w.tier : -1 })) completed(d);
  };
  bus.on('gathered', (e) => progress({ type: 'gathered', material: e.material, n: e.n }));
  bus.on('kill', () => progress({ type: 'kill' }));
  bus.on('waveEnd', (e) => { if (e.cleared) progress({ type: 'waveCleared' }); });
  bus.on('zoneEnter', ({ id }) => { const layer = game.zone.layer || 0; p.stats.maxLayer = Math.max(p.stats.maxLayer, layer); progress({ type: 'zone', id }); });
  bus.on('bossDefeated', () => progress({ type: 'boss' }));
  bus.on('lore', ({ id }) => progress({ type: 'lore', id }));

  // ---------------------------------------------------------------- callbacks used by menus
  game.onGearChanged = (def) => {
    game.recomputeStats();
    game.rebuildPlayerRig();
    const w = equippedIn(p, 'weapon');
    if (def?.slot === 'weapon' || def == null) progress({ type: 'equipped', slot: 'weapon', tier: w ? w.tier : -1 });
    bus.emit('sfx', { id: 'ui' });
  };
  game.onCrafted = (recipe) => {
    const out = recipe.output.item ? ITEMS[recipe.output.item] : CONSUMABLES[recipe.output.stack];
    game.ui.toast(`Crafted ${out.name}${recipe.output.count > 1 ? ` ×${recipe.output.count}` : ''}`, 'good');
    bus.emit('sfx', { id: 'craft' });
    game.fx.burst(game.player.x, game.player.ry + 1.2, game.player.z, 18, { color: '#ffd166', speed: 3, up: 3 });
    progress({ type: 'crafted', item: recipe.output.item || recipe.output.stack });
    game.save('craft');
  };
  game.onAttributesChanged = () => { game.recomputeStats(); progress({ type: 'allocate' }); };
  game.applySettings = () => {
    const s = game.settings;
    game.r.applyQuality(s.graphics);
    game.cam.baseFov = s.graphics.fov;
    game.input.setBindings(s.controls.bindings);
    audio.applyVolumes();
    game.ui.touch.applyLayout();
    if (game.view) game.view.viewDistance = s.graphics.viewDistance;
    if (game.zone.type === 'island') game.r.scene.fog.far = s.graphics.viewDistance;
    game.hooks.saveSettings();
  };

  // ---------------------------------------------------------------- saving
  game.save = () => {
    const pl = game.player;
    if (pl.alive) { p.pos = [Math.round(pl.x * 10) / 10, Math.round(pl.z * 10) / 10]; }
    p.zone = game.zone.id;
    p.world.clock = game.dayNight.clock;
    game.ui?.minimap.saveFog();
    const ok = game.store.save(p.slot, p);
    if (ok) game.ui?.flashSaved();
    return ok;
  };
  game.hooks.save = game.save;
  let autoT = 60;
  bus.on('levelUp', () => game.save('level'));
  bus.on('bossDefeated', () => game.save('boss'));
  const onHide = () => { if (document.visibilityState === 'hidden') game.save('hidden'); };
  const onUnload = () => game.save('unload');
  document.addEventListener('visibilitychange', onHide);
  window.addEventListener('beforeunload', onUnload);

  // ---------------------------------------------------------------- audio routing
  bus.on('sfx', (e) => audio.play(e.id, e.x, e.z));
  bus.on('playerHurt', (e) => { if (e.dmg > 0) audio.play('hurt'); });
  bus.on('dodge', () => audio.play('dodge'));
  bus.on('jump', () => audio.play('jump'));
  bus.on('levelUp', () => audio.play('levelup'));
  bus.on('waveStart', () => audio.play('horn'));
  bus.on('itemGained', (e) => { if (e.source !== 'gather') audio.play('pickup'); });
  bus.on('gathered', () => audio.play('pickup'));
  bus.on('died', () => audio.play('death'));
  bus.on('bossDefeated', () => audio.play('victory'));
  bus.on('zoneEnter', () => audio.setAmbient(game.zone.type === 'island' ? 'island' : game.zone.layer));

  // First arrival: Lume introduces the island.
  bus.on('started', ({ first }) => {
    if (!first) { game.ui.toast(`Welcome back, ${p.name}.`, 'good'); return; }
    (p.flags ||= {}).metLume = true;
    game.ui.dialog({ title: 'Lume, the Beacon Keeper', portrait: 'lume', text: `${LUME_LINES.first}

${game.input.isTouch ? 'Move with the left side of the screen, look by dragging on the right, and fight with the buttons.' : 'WASD to move, click the view to steer with the mouse, left click to attack, F to gather and interact.'} Your goals appear on the right.` });
  });

  game.ui = new UI(game);
  game.interaction = new Interaction(game);

  game.addSystem({
    onZoneEnter(g) { g.interaction.onZoneEnter(); },
    update(dt, g) {
      autoT -= dt;
      if (autoT <= 0) { autoT = 60; g.save('auto'); }
      g.interaction.update(dt);
    },
  });

  // Runs every frame, paused or not: interface, touch and music.
  game.afterFrame = (dt) => {
    game.ui.update(dt);
    game.ui.touch.update();
    const pl = game.player;
    audio.listener.x = pl.x; audio.listener.z = pl.z; audio.listener.yaw = game.cam.yaw;
    const bossOn = game.enemies.list.some((e) => e.boss && e.alive && e.group.engaged);
    audio.setMood(bossOn ? 'boss' : game.zone.type === 'island' ? (game.dayNight.phase === 'day' ? 'island_day' : 'island_night') : `cave${game.zone.layer}`);
    let near = 0;
    for (const e of game.enemies.active) if (e.alive && e.dist2(pl) < 400) near++;
    audio.setIntensity(bossOn ? 1 : Math.min(1, near / 6));
    audio.tick();
  };

  game.dispose = () => {
    document.removeEventListener('visibilitychange', onHide);
    window.removeEventListener('beforeunload', onUnload);
    game.ui.closeMenu?.();
    game.enemies.clear(); game.combat.clear(); game.combat.dispose(); game.fx.dispose(); game.overlay.clear(); game.overlay.draw(0);
    game.astral?.dispose();
    game.view?.dispose(); game.view = null;
    game.player.rig?.dispose();
    game.sky.dispose();
    game.bus.clear();
    for (const id of ['hud', 'touch', 'menu', 'dialog']) { const el = document.getElementById(id); el.hidden = true; el.replaceChildren(); }
    game.input.releasePointer();
    game.input.clear();
    game.disposed = true;
  };
  return game;
}
