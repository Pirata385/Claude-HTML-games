/* Farming in the world: tools act on the cells in front of the player in the current slice. */
(function (root) {
  'use strict';
  const PA = root.PA = root.PA || {};
  const C = PA.C;
  const COST = { hoe: 2, can: 2, axe: 3, pickaxe: 3, scythe: 1, rod: 4, sword: 0, eraser: 1 };
  const TREE_HP = { oak: 10, pine: 9, birch: 8, fruit: 8 };

  const Farm = PA.Farm = {
    /** Cells in front of the player for a tool of level lvl (1, 3, 5 or 7 wide). */
    targets(game, lvl) {
      const p = game.player, n = [1, 3, 5, 7][lvl || 0] || 1;
      const x0 = Math.floor((p.x + p.facing * (p.W / 2 + 4)) / C.CELL_W);
      const out = [];
      for (let i = 0; i < n; i++) out.push(x0 + i * p.facing);
      return out;
    },
    /** Top solid row at x in slice z (ground), skipping decor. */
    groundAt(g, x, z) { return g.surfaceY(x, z); },
    canFarm(game, x, z) {
      const m = game.map;
      if (m.kind !== 'overworld') return false;
      return x >= 2 && x < 158 && z >= 1 && z <= 7 && !m.doors.some((d) => Math.abs(d.x - x) < 3 && d.z === z + 1 && false);
    },
    cropAt(state, mapId, x, z) { return state.crops.find((c) => c.map === mapId && c.x === x && c.z === z); },
    objectAt(state, mapId, x, z) { return state.objects.find((o) => o.map === mapId && x >= o.x && x < o.x + (o.w || 2) && o.z === z); },
    forageAt(state, mapId, x, z) { return state.forage.find((f) => f.map === mapId && Math.abs(f.x - x) <= 1 && f.z === z); },

    /** Start a tool swing; the effect lands mid-swing (see apply). */
    useSelected(game) {
      const s = game.state, inv = game.inv, slot = inv.slots[game.hot];
      if (!slot) return Farm.interact(game, true);
      const it = PA.Items.get(slot.id);
      if (!it) return false;
      if (it.cat === 'tool') {
        const cost = Math.max(1, (COST[slot.id] || 2) - (slot.extra && slot.extra.lvl ? Math.floor(slot.extra.lvl / 2) : 0));
        if (s.energy < cost) { PA.UI.toast('Too tired... eat something or go to bed.'); return false; }
        if (game.player.action) return false;
        if (slot.id === 'rod' && PA.Fishing) return PA.Fishing.cast(game, slot);
        if (slot.id === 'sword' && PA.Combat) return PA.Combat.swing(game, slot);
        game.player.action = { kind: slot.id, t: 0, dur: 300, progress: 0, aim: null, applied: false, lvl: (slot.extra && slot.extra.lvl) || 0, cost };
        PA.Bus.emit('swing', { tool: slot.id });
        return true;
      }
      if (it.cat === 'seed') return Farm.plant(game, slot);
      if (it.cat === 'placeable') return Farm.place(game, slot);
      if (it.edible) return Farm.eat(game, slot);
      if (slot.id === 'drawn' && PA.Drawn) return PA.Drawn.useItem(game, slot);
      return Farm.interact(game, true);
    },
    /** Called every frame while a swing runs. */
    tickAction(game, dt) {
      const a = game.player.action;
      if (!a) return;
      a.t += dt; a.progress = Math.min(1, a.t / a.dur);
      if (!a.applied && a.progress >= 0.55) { a.applied = true; Farm.apply(game, a); }
      if (a.progress >= 1) game.player.action = null;
    },
    apply(game, a) {
      const s = game.state, g = game.map.grid, z = game.player.z, T = PA.T, inv = game.inv;
      let did = false;
      const xs = Farm.targets(game, ['hoe', 'can', 'scythe'].includes(a.kind) ? a.lvl : 0);
      for (const x of xs) {
        const gy = g.surfaceY(x, z), above = g.get(x, gy - 1, z), ground = g.get(x, gy, z);
        const crop = Farm.cropAt(s, game.map.id, x, z);
        if (a.kind === 'hoe') {
          if (above === T.WEED || above === T.BRANCH || above === T.ROCK) continue;
          if (!crop && (ground === T.GRASS || ground === T.DIRT) && Farm.canFarm(game, x, z) && !Farm.objectAt(s, game.map.id, x, z)) { g.set(x, gy, z, T.SOIL); did = true; PA.Bus.emit('fx', { kind: 'dirt', x, y: gy, z }); }
        } else if (a.kind === 'can') {
          const slot = inv.slots[game.hot];
          const cap = 40 + (a.lvl || 0) * 20;
          slot.extra = slot.extra || { lvl: 0 };
          if (slot.extra.water == null) slot.extra.water = cap;
          const wet = g.def(x, gy - 1, z).water || g.def(x, gy, z).water || (game.map.spots.well && Math.abs(game.map.spots.well.x - x) <= 2 && game.map.spots.well.z === z);
          if (wet) { slot.extra.water = cap; PA.UI.toast('Watering can refilled (' + cap + ')'); did = true; break; }
          if (slot.extra.water <= 0) { PA.UI.toast('The can is empty. Fill it at the well or the creek.'); break; }
          if (ground === T.SOIL) { g.set(x, gy, z, T.SOIL_WET); slot.extra.water--; did = true; }
          if (crop && !crop.wet) { crop.wet = true; did = true; }
          if (ground === T.SOIL_WET && crop) did = true;
        } else if (a.kind === 'scythe') {
          if (above === T.WEED) { g.set(x, gy - 1, z, T.AIR); if (Math.random() < 0.6) inv.add('fiber', 1); did = true; }
          if (crop && PA.Crops.ready(crop)) { Farm.harvestCrop(game, crop); did = true; }
        } else if (a.kind === 'axe') {
          if (above === T.BRANCH) { g.set(x, gy - 1, z, T.AIR); inv.add('wood', 1 + (Math.random() < 0.5 ? 1 : 0)); did = true; break; }
          const tree = game.map.props.find((pr) => (pr.type === 'tree' || pr.type === 'stump') && pr.z === z && Math.abs(pr.x - x) <= 1);
          if (tree) { Farm.chop(game, tree, a.lvl); did = true; break; }
        } else if (a.kind === 'eraser') {
          PA.Drawn.eraseNear(game); did = true; break;
        } else if (a.kind === 'pickaxe') {
          if (above === T.ROCK) { g.set(x, gy - 1, z, T.AIR); inv.add('stone', 1 + (Math.random() < 0.4 ? 1 : 0)); did = true; break; }
          if (!crop && (ground === T.SOIL || ground === T.SOIL_WET)) { g.set(x, gy, z, T.DIRT); did = true; break; }
          if (PA.Mine && PA.Mine.dig(game, x, z, a.lvl)) { did = true; break; }
        }
      }
      if (did || a.kind !== 'can') s.energy = Math.max(0, s.energy - a.cost);
      PA.Bus.emit('tool-hit', { tool: a.kind, did });
    },
    chop(game, tree, lvl) {
      const inv = game.inv;
      tree.hp = (tree.hp == null ? (tree.type === 'stump' ? 4 : TREE_HP[tree.kind] || 8) : tree.hp) - (1 + lvl);
      tree.shake = 1;
      if (tree.hp > 0) return;
      const props = game.map.props;
      const i = props.indexOf(tree);
      if (tree.type === 'tree') {
        inv.add('wood', 6 + Math.floor(Math.random() * 5));
        if (Math.random() < 0.6) inv.add('sap', 1 + Math.floor(Math.random() * 3));
        if (tree.kind === 'oak' && Math.random() < 0.5) inv.add('hardwood', 1);
        props[i] = { type: 'stump', x: tree.x, gy: tree.gy, z: tree.z, seed: tree.seed };
        PA.UI.toast('Timber!');
      } else {
        inv.add('wood', 3); inv.add('hardwood', 1);
        props.splice(i, 1);
      }
      game.world.indexProps();
      Farm.recordProps(game);
    },
    /** Persist removed/changed props of the overworld (trees chopped). */
    recordProps(game) {
      const s = game.state, m = game.map;
      s.props = s.props || {};
      s.props[m.id] = m.props.filter((p) => p.type === 'tree' || p.type === 'stump').map((p) => [p.type, p.x, p.z, p.seed, p.kind]);
    },
    plant(game, slot) {
      const s = game.state, g = game.map.grid, z = game.player.z, it = PA.Items.get(slot.id);
      const x = Farm.targets(game, 0)[0], gy = g.surfaceY(x, z), ground = g.get(x, gy, z);
      if (ground !== PA.T.SOIL && ground !== PA.T.SOIL_WET) { PA.UI.toast('Till the soil with the hoe first.'); return false; }
      if (Farm.cropAt(s, game.map.id, x, z)) return false;
      if (!it.seasons.includes(s.season)) { PA.UI.toast(it.name + ' will not grow in ' + PA.SEASONS[s.season] + '.'); return false; }
      s.crops.push({ map: game.map.id, x, z, id: it.crop, days: 0, wet: ground === PA.T.SOIL_WET, dead: false });
      game.inv.takeAt(game.hot, 1);
      PA.Bus.emit('plant');
      return true;
    },
    harvestCrop(game, crop) {
      const s = game.state, out = PA.Crops.harvest(crop);
      if (!out) return false;
      const left = game.inv.add(out.id, out.n);
      if (left) { PA.UI.toast('Your bag is full!'); crop.days = PA.Crops.DEFS[crop.id].days; return false; }
      if (out.remove) s.crops.splice(s.crops.indexOf(crop), 1);
      PA.UI.toast('+' + out.n + ' ' + PA.Items.get(out.id).name);
      PA.Bus.emit('harvest', { id: out.id });
      return true;
    },
    eat(game, slot) {
      const s = game.state, it = PA.Items.get(slot.id);
      if (s.energy >= s.maxEnergy && s.hp >= s.maxHp) { PA.UI.toast('You are not hungry.'); return false; }
      s.energy = Math.min(s.maxEnergy, s.energy + it.energy);
      s.hp = Math.min(s.maxHp, s.hp + Math.round(it.energy * 0.45));
      game.inv.takeAt(game.hot, 1);
      PA.UI.toast('Ate ' + it.name + ' (+' + it.energy + ' energy)');
      PA.Bus.emit('eat');
      return true;
    },
    place(game, slot) {
      const s = game.state, g = game.map.grid, z = game.player.z;
      const x = Farm.targets(game, 0)[0], gy = g.surfaceY(x, z);
      if (g.get(x, gy - 1, z) !== PA.T.AIR || g.get(x + 1, gy - 1, z) !== PA.T.AIR || Farm.objectAt(s, game.map.id, x, z) || Farm.objectAt(s, game.map.id, x + 1, z) || Farm.cropAt(s, game.map.id, x, z)) { PA.UI.toast('No room here.'); return false; }
      if (g.surfaceY(x + 1, z) !== gy) { PA.UI.toast('Needs flat ground.'); return false; }
      s.objects.push({ map: game.map.id, x, z, gy, id: slot.id, w: 2, items: slot.id === 'chest' ? [] : undefined });
      game.inv.takeAt(game.hot, 1);
      PA.Bus.emit('place');
      return true;
    },
    /** Context action (E / act button): harvest, forage, machines, chests, bin, NPCs. */
    interact(game, fromUse) {
      const s = game.state, p = game.player, mid = game.map.id;
      const xs = [Math.floor(p.x / C.CELL_W), Farm.targets(game, 0)[0]];
      for (const x of xs) {
        const crop = Farm.cropAt(s, mid, x, p.z);
        if (crop && PA.Crops.ready(crop)) return Farm.harvestCrop(game, crop);
        if (crop && crop.dead) { s.crops.splice(s.crops.indexOf(crop), 1); return true; }
        const f = Farm.forageAt(s, mid, x, p.z);
        if (f) { if (game.inv.add(f.id, 1) === 0) { s.forage.splice(s.forage.indexOf(f), 1); PA.UI.toast('+1 ' + PA.Items.get(f.id).name); PA.Bus.emit('pickup'); } return true; }
        const o = Farm.objectAt(s, mid, x, p.z);
        if (o && PA.Craft) return PA.Craft.use(game, o);
      }
      if (game.map.kind === 'overworld') {
        const near = (sp, r) => sp && p.z === sp.z && Math.abs(Math.floor(p.x / C.CELL_W) - sp.x) <= (r || 2);
        const sp = game.map.spots;
        if (near(sp.bin)) { PA.UI.Ship.open(game); return true; }
        if (near(sp.mailbox)) { PA.UI.Mail.open(game); return true; }
        if (near(sp.board, 3)) { PA.UI.Board.open(game); return true; }
        const cart = game.map.props.find((q) => q.type === 'cart');
        if (cart && p.z === cart.z && Math.abs(Math.floor(p.x / C.CELL_W) - cart.x) <= 2) { game.goTo('overworld', 440, 1, 1); return true; }
      }
      if (PA.NPCs && PA.NPCs.talkNear(game)) return true;
      return false;
    },

    /* ---------------- overnight ---------------- */
    newDay(game) {
      const s = game.state, rained = s.weather === 'rain' || s.weather === 'storm';
      const ow = game.getMap('overworld'), g = ow.grid, T = PA.T;
      // sprinklers water their neighbours, including the slices in front of and behind them (3D!)
      const sprink = new Set();
      for (const o of s.objects) if (o.id === 'sprinkler' && o.map === 'overworld') for (const [dx, dz] of [[-1, 0], [2, 0], [0, -1], [1, -1], [0, 1], [1, 1]]) sprink.add((o.x + dx) + ',' + (o.z + dz));
      for (const c of s.crops) {
        if (sprink.has(c.x + ',' + c.z)) c.wet = true;
        const greenhouse = s.flags.greenhouse && c.map === 'overworld' && c.z === 2;
        PA.Crops.grow(c, greenhouse ? PA.Crops.DEFS[c.id].seasons[0] : s.season, rained);
      }
      // soil: dry overnight unless it rains; wet under sprinklers
      for (const i of [...g.edits]) {
        const { x, y, z } = g.coords(i);
        const t = g.t[i];
        if (t !== T.SOIL && t !== T.SOIL_WET) continue;
        const wet = rained || sprink.has(x + ',' + z);
        g.set(x, y, z, wet ? T.SOIL_WET : T.SOIL);
        const c = Farm.cropAt(s, 'overworld', x, z);
        if (!c && !wet && Math.random() < 0.06) g.set(x, y, z, T.GRASS); // untended soil grows over
      }
      // shipping
      let total = 0;
      for (const e of s.ship || []) total += PA.Items.sellPrice(e.id, e.extra) * e.n;
      if (total) { s.gold += total; s.stats.shipped = (s.stats.shipped || 0) + total; PA.UI.toast('Shipped goods sold for ' + total + 'g', 4200); }
      s.ship = [];
      // forage and weeds
      s.forage = (s.forage || []).filter((f) => f.days == null || f.days++ < 4);
      const r = PA.RNG.mulberry32(s.seed ^ (s.stats.days * 7919));
      const pool = PA.Items.byCat('forage').filter((it) => it.seasons.includes(s.season));
      for (let i = 0; i < 6 && s.forage.length < 18; i++) {
        const zone = r() < 0.6 ? [334, 420] : r() < 0.5 ? [160, 186] : [8, 150];
        const x = zone[0] + Math.floor(r() * (zone[1] - zone[0])), z = zone[0] === 8 ? 9 + Math.floor(r() * 3) : 1 + Math.floor(r() * 10);
        if (g.def(x, g.surfaceY(x, z) - 1, z).water || g.get(x, g.surfaceY(x, z), z) === T.WALL || g.get(x, g.surfaceY(x, z) - 1, z) !== T.AIR) continue;
        const it = zone[0] === 334 && r() < 0.3 ? PA.Items.get('inkcap') : pool[Math.floor(r() * pool.length)];
        if (it) s.forage.push({ map: 'overworld', x, z, id: it.id, days: 0 });
      }
      for (let i = 0; i < 10; i++) {
        const x = 40 + Math.floor(r() * 92), z = 2 + Math.floor(r() * 4), gy = g.surfaceY(x, z);
        if (g.get(x, gy, z) === T.GRASS && g.get(x, gy - 1, z) === T.AIR && !Farm.cropAt(s, 'overworld', x, z)) g.set(x, gy - 1, z, T.WEED);
      }
      if (PA.Craft) PA.Craft.newDay(game);
    },
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = Farm;
})(typeof window !== 'undefined' ? window : globalThis);
