// Installs the gameplay systems on a Game and connects them through the event bus.
import { FX } from './render/fx.js';
import { Overlay } from './ui/overlay.js';
import { Combat } from './combat/combat.js';
import { Enemies } from './ai/enemies.js';
import { Spawner } from './ai/spawner.js';
import { Phenomena } from './world/phenomena.js';
import { DimensionRules } from './world/dimrules.js';
import { Astral } from './entities/astral.js';
import { makeKit } from './combat/kits/index.js';
import { addXp, applyDeathPenalty, xpToNext } from './systems/progression.js';
import { count, takeStack } from './systems/inventory.js';
import { CONSUMABLES } from './data/consumables.js';
import { defaultHotbar } from './data/skills.js';
import { unlocksAt } from './data/unlocks.js';
import { endRun } from './systems/run.js';

export function installGameplay(game) {
  const r = game.r;
  game.fx = new FX(r.scene, game.settings.graphics);
  game.overlay = new Overlay(document.getElementById('overlay2d'), r.camera, game.settings);
  game.combat = new Combat(game);
  game.enemies = new Enemies(game);
  game.spawner = new Spawner(game);
  game.phenomena = new Phenomena(game);
  game.dimRules = new DimensionRules(game);
  game.lockTarget = null;
  game.stopT = 0;
  game.consumableCd = 0;
  game.player.alive = true;

  game.hitStop = (t) => { game.stopT = Math.max(game.stopT, t); };
  game.playerSide = () => (game.astral?.manifested ? [game.player, game.astral] : [game.player]);

  game.grantXp = (amount, src) => {
    const p = game.profile;
    const before = p.level;
    const res = addXp(p, amount);
    if (src && amount >= 1) game.overlay.text(game.player.x, game.player.ry + 2.6, game.player.z, `+${Math.round(amount)} XP`, 'xp');
    if (res.levelsGained) {
      game.recomputeStats();
      game.player.hp = game.stats.maxHp;
      game.player.res = game.stats.resourceMax;
      game.fx.column(game.player.x, game.player.ry, game.player.z, '#ffd166', 40, 1);
      const unlocks = [];
      for (let L = before + 1; L <= p.level; L++) unlocks.push(...unlocksAt(p.classId, L));
      game.bus.emit('levelUp', { level: p.level, from: before, unlocks });
    }
    game.bus.emit('xp', { amount, level: p.level, xp: p.xp, next: xpToNext(p.level) });
  };

  // Class setup: kit, Astral for the Stardust, hotbar.
  game.setupClass = () => {
    const p = game.profile;
    p.hotbars[p.classId] ||= defaultHotbar(p.classId);
    game.player.kit?.dispose();
    game.player.kit = makeKit(p.classId, game);
    if (game.astral) { game.astral.manifest(false); game.astral.dispose(); game.astral = null; }
    if (p.classId === 'stardust') game.astral = new Astral(game);
    game.recomputeStats();
    game.rebuildPlayerRig();
    game.player.res = Math.min(game.player.res, game.stats.resourceMax);
  };
  game.setupClass();
  game.player.res = game.stats.resourceMax;

  game.useConsumable = (id) => {
    const def = CONSUMABLES[id];
    const p = game.player;
    if (!def || count(game.profile.inv, id) < 1) return game.ui?.toast('You have none left.', 'warn');
    if (def.menuOnly) return game.ui?.toast('Use it from the Character tab.', 'warn');
    if (def.cd && game.consumableCd > 0) return game.ui?.toast(`Tonics recover in ${Math.ceil(game.consumableCd)} s.`, 'warn');
    const e = def.effect;
    if (e.summon) {
      const why = game.spawner.trySummon(e.summon);
      if (why) return game.ui?.toast(why, 'warn');
    }
    if (e.portal) {
      const why = game.interaction.openPortal(e.portal);
      if (why) return game.ui?.toast(why, 'warn');
    }
    if (e.heal) game.combat.healPlayer(game.stats.maxHp * e.heal * game.stats.tonicPotency);
    if (e.resource) p.res = Math.min(game.stats.resourceMax, p.res + game.stats.resourceMax * e.resource * game.stats.tonicPotency);
    if (e.cure) for (const s of e.cure) p.statuses.remove(s);
    if (e.status) p.statuses.apply(e.status);
    takeStack(game.profile.inv, id, 1);
    if (def.cd) game.consumableCd = def.cd;
    game.fx.column(p.x, p.ry, p.z, def.color, 14, 0.5);
    game.bus.emit('sfx', { id: 'drink' });
    game.bus.emit('consumableUsed', { id });
    return true;
  };
  game.bestTonic = () => {
    const inv = game.profile.inv, p = game.player;
    // Save the strongest draughts for when they matter; the Pearl Elixir also cures poison, burns and bleeding.
    const hurting = p.statuses.has('poison') || p.statuses.has('burn') || p.statuses.has('bleed');
    if ((p.hp < game.stats.maxHp * 0.3 || hurting) && count(inv, 'pearl_elixir')) return 'pearl_elixir';
    if (p.hp < game.stats.maxHp * 0.4 && count(inv, 'greater_healing_tonic')) return 'greater_healing_tonic';
    if (count(inv, 'healing_tonic')) return 'healing_tonic';
    if (count(inv, 'greater_healing_tonic')) return 'greater_healing_tonic';
    if (count(inv, 'pearl_elixir')) return 'pearl_elixir';
    return null;
  };

  game.respawn = () => {
    const p = game.player;
    const bed = game.zone.type === 'island' ? null : null;
    void bed;
    const z = (gz) => gz.base.stations.bed;
    // Dying in a dimension ends the run; the dimension casts you out.
    if (game.profile.run) { endRun(game.profile, 'fail'); game.ui?.toast('The dimension casts you out. The run is over.', 'warn', 5); }
    game.enterZone('island', null);
    const b = z(game.zone);
    p.x = b.x + 1.5; p.z = b.z + 1.5;
    p.y = p.ry = game.grid.height(Math.floor(p.x), Math.floor(p.z));
    p.alive = true;
    p.hp = game.stats.maxHp;
    p.res = game.stats.resourceMax;
    p.statuses.clear(); p.shield = 0;
    p.iframes = 2;
    game.inputBlocked = false;
    game.bus.emit('respawn', {});
  };

  game.bus.on('playerDeath', () => {
    const p = game.player;
    if (!p.alive) return;
    p.alive = false;
    game.inputBlocked = true;
    game.lockTarget = null;
    game.astral?.manifest(false);
    const lost = applyDeathPenalty(game.profile);
    game.profile.stats.deaths++;
    game.fx.burst(p.x, p.ry + 1, p.z, 30, { color: '#e8455a', speed: 5 });
    game.bus.emit('died', { lost });
    if (!game.ui?.deathScreen) game.combat.after(3, () => game.respawn());
  });

  game.addSystem({
    onZoneExit(g) {
      g.enemies.clear(); g.combat.clear(); g.fx.clear(); g.overlay.clear();
      g.lockTarget = null;
      g.astral?.manifest(false);
      g.spawner.onZoneExit();
      g.phenomena.onZoneExit();
      g.dimRules.onZoneExit();
      g.portal = null; g.portalOut = null;
    },
    onZoneEnter(g) { g.dimRules.onZoneEnter(); g.spawner.onZoneEnter(); g.phenomena.onZoneEnter(); },
    update(dt, g) {
      const p = g.player, inp = g.input;
      g.consumableCd = Math.max(0, g.consumableCd - dt);
      if (p.alive) {
        p.kit.update(dt, inp);
        // Status effects on the player.
        p.statuses.update(dt, (amt, id) => {
          p.hp -= amt;
          g.overlay.text(p.x, p.ry + 2, p.z, `-${Math.round(amt)}`, 'hurt');
          if (p.hp <= 0) { p.hp = 0; g.bus.emit('playerDeath', { source: id }); }
        });
        if (!p.statuses.has('shield')) p.shield = 0;
        // Regeneration.
        const st = g.stats;
        let regen = st.hpRegen;
        if (p.combatT > 5) regen += st.oocRegen;
        if (p.still > 1 && st.stillRegen) regen += st.stillRegen;
        if (regen > 0 && p.hp < st.maxHp) p.hp = Math.min(st.maxHp, p.hp + st.maxHp * regen * dt);
        // Lock-on toggle.
        if (inp.wasPressed('lock')) {
          if (g.lockTarget) g.lockTarget = null;
          else { g.lockTarget = p.kit.aimTarget(26); if (!g.lockTarget) g.ui?.toast('No target in sight.', 'warn'); }
        }
        if (g.lockTarget && (!g.lockTarget.alive || g.lockTarget.untargetable || g.lockTarget.dist2(p) > 40 * 40)) g.lockTarget = null;
        if (inp.wasPressed('tonic') && !g.inputBlocked) { const t = g.bestTonic(); if (t) g.useConsumable(t); else g.ui?.toast('No healing tonics. Craft them at the Forge.', 'warn'); }
      }
      g.enemies.update(dt);
      g.astral?.update(dt);
      g.combat.update(dt);
      g.spawner.update(dt);
      g.phenomena.update(dt);
      g.dimRules.update(dt);
      g.fx.update(dt);
    },
    render(dt, g) {
      g.enemies.render(dt);
      g.dimRules.render(dt);
      g.overlay.draw(dt);
    },
  });
  return game;
}
