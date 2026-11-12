// Amalgamations — game state and progression: new games, XP and levels, loot and DNA, inventory and gear,
// powers (learn, equip, fuse), the skill tree, quests and the goal chain.
(function (root) {
  'use strict';
  const AM = root.AM || (root.AM = {});
  const PATH_SECOND = { brawler: 'galedash', ranger: 'venomspit', elementalist: 'frostnova', guardian: 'quakeslam', primal: 'healingbloom', wanderer: 'boomerang' };
  const MAX_QUESTS = 5;

  function newState(seed, slot, form, path) {
    const branch = AM.SKILL_BRANCHES.find((b) => b.id === path) || AM.SKILL_BRANCHES[0];
    const unlocked = new Set(AM.BASE_IDS.filter((id) => AM.BASES[id].unlocked));
    const g = AM.fuse(form.mother, form.father, form.variant);
    return {
      version: AM.SAVE_VERSION, seed, slot, createdAt: Date.now(), savedAt: 0, playtime: 0,
      form: Object.assign({}, form), formName: g.name, path: branch.id,
      level: 1, xp: 0, points: 0, nodes: new Set([branch.id + '.root']),
      powers: { learned: [branch.power, PATH_SECOND[branch.id]], equipped: [branch.power, PATH_SECOND[branch.id], null, null] },
      inv: AM.newInventory(), equipment: { weapon: null, helmet: null, armor: null, charm: null, ring: null },
      gold: 25, unlocked, explored: new Set(), discovered: new Set(), cleared: new Set(), opened: new Set(), mined: {}, readLore: new Set(),
      waypoints: new Set(), lastVillage: null, quests: { active: [], done: new Set() }, goalsDone: new Set(),
      stats: { kills: 0, casts: 0, distance: 0, skills: 0, gathered: 0, quests: 0, caves: 0, powerFusions: 0, reforms: 0, villages: 0, bosses: 0, elites: 0, chests: 0, legendaries: 0, bossLevel: 0, fusions: 1 },
      biomesSeen: new Set(), pos: { x: 0, z: 3 }, time: 0.08, day: 0, hp: null, energy: null,
    };
  }

  function makeProg(G) {
    const P = {};
    const S = () => G.state;
    const toast = (t, k) => G.hud && G.hud.toast(t, k);

    // ---------- xp and levels ----------
    P.gainXp = function (n) {
      const st = S();
      n = Math.round(n * (1 + (G.player ? G.player.stats.xpPct || 0 : 0)));
      st.xp += n;
      let up = false;
      while (st.xp >= AM.xpToNext(st.level)) {
        st.xp -= AM.xpToNext(st.level);
        st.level++; st.points++; up = true;
        toast(`Level ${st.level}! +1 skill point`, 'level');
        if (st.level === 5) toast('A third power slot is open.', 'gold');
      }
      if (up && G.player) {
        G.player.recompute(); G.player.hp = G.player.maxHp; G.player.energy = G.player.stats.maxEnergy;
        G.fx.ringBurst(G.player.x, G.player.z, 3, '#ffe45c', 24); G.fx.pulse(G.player.x, G.player.z, 3, '#ffe45c', 0.6);
        G.audio.sfx('levelup');
        P.stat('level', 0);
      }
      return n;
    };

    // ---------- kills and loot ----------
    P.onKill = function (e) {
      const st = S(), p = G.player;
      const xp = AM.killXp(e.level, st.level, e.rank);
      P.gainXp(xp);
      const rng = AM.makeRng((Math.random() * 1e9) | 0);
      const drops = AM.rollDrops(rng, { genome: e.genome, level: e.level, rank: e.rank, biome: e.biome }, p.stats);
      P.spawnDrops(drops, e.x, e.z);
      P.stat('kills', 1);
      if (e.rank === 'elite') P.stat('elites', 1);
      if (e.rank === 'boss') {
        P.stat('bosses', 1);
        st.stats.bossLevel = Math.max(st.stats.bossLevel, e.level); P.stat('bossLevel', 0);
        if (e.dungeon) { st.cleared.add(e.dungeon.id); toast(`${e.dungeon.name} cleared!`, 'gold'); P.questEvent('clear', e.dungeon.id); }
      }
      for (const q of st.quests.active) {
        if (q.done) continue;
        if (q.type === 'hunt' && e.level >= q.minLevel) q.have++;
        if (q.type === 'huntBase' && e.genome.parents.includes(q.base)) q.have++;
        if (q.type === 'elite' && e.quest === q.id) q.have = q.need;
        P.checkQuest(q);
      }
    };
    P.spawnDrops = function (d, x, z) {
      if (d.gold) { const n = Math.min(6, 1 + Math.floor(d.gold / 15)); for (let i = 0; i < n; i++) AM.Ent.dropPickup(G, x, z, 'gold', { n: Math.ceil(d.gold / n) }); }
      for (const k in d.mats) if (d.mats[k] > 0) AM.Ent.dropPickup(G, x, z, 'mat', { id: k, n: d.mats[k] });
      for (const k in d.cons) if (d.cons[k] > 0) AM.Ent.dropPickup(G, x, z, 'cons', { id: k, n: d.cons[k] });
      for (const k in d.dna) if (d.dna[k] > 0) AM.Ent.dropPickup(G, x, z, 'dna', { id: k, n: d.dna[k] });
      for (const it of d.items) AM.Ent.dropPickup(G, x, z, 'item', it);
    };
    // Pick up a pickup. Returns false if it cannot be taken (full inventory).
    P.collect = function (k) {
      const st = S();
      if (k.kind === 'gold') { st.gold += k.data.n; G.hud.feed(`+${k.data.n} gold`, '#f2c14e'); G.audio.sfx('coin'); return true; }
      if (k.kind === 'mat') { AM.addMats(st.inv, { [k.data.id]: k.data.n }); G.hud.feed(`+${k.data.n} ${AM.MATERIALS[k.data.id].name}`, AM.MATERIALS[k.data.id].color); P.questEvent('collect', k.data.id, k.data.n); G.audio.sfx('pickup'); return true; }
      if (k.kind === 'cons') { st.inv.cons[k.data.id] = (st.inv.cons[k.data.id] || 0) + k.data.n; G.hud.feed(`+${k.data.n} ${AM.CONSUMABLES[k.data.id].name}`, AM.CONSUMABLES[k.data.id].color); G.audio.sfx('pickup'); return true; }
      if (k.kind === 'dna') { P.addDna(k.data.id, k.data.n); G.audio.sfx('pickup'); return true; }
      if (k.kind === 'item') {
        if (!AM.addItem(st.inv, k.data)) { if (!k.warned) { toast('Inventory full', 'bad'); k.warned = true; } return false; }
        G.hud.feed(AM.displayName(k.data), AM.RARITY[k.data.rarity].color);
        if (k.data.rarity === 'legendary') { toast('Legendary! ' + k.data.name, 'gold'); P.stat('legendaries', 1); }
        G.audio.sfx(AM.RARITY[k.data.rarity].tier >= 2 ? 'rare' : 'pickup');
        return true;
      }
      return true;
    };
    P.giveDirect = function (r) {
      const st = S();
      if (!r) return;
      if (r.xp) P.gainXp(r.xp);
      if (r.gold) st.gold += r.gold;
      if (r.essence) AM.addMats(st.inv, { essence: r.essence });
      if (r.dna) for (const b in r.dna) P.addDna(b, r.dna[b]);
      if (r.item) { const it = AM.rollItem(AM.makeRng((Math.random() * 1e9) | 0), { ilvl: st.level, minTier: 1, findPct: G.player.stats.findPct }); if (!AM.addItem(st.inv, it)) AM.Ent.dropPickup(G, G.player.x, G.player.z, 'item', it); else G.hud.feed(AM.displayName(it), AM.RARITY[it.rarity].color); }
      if (r.points) st.points += r.points;
    };
    P.addDna = function (base, n) {
      const st = S();
      st.inv.dna[base] = (st.inv.dna[base] || 0) + n;
      G.hud.feed(`+${n} ${AM.BASES[base].name} DNA`, '#ff6ad5');
      const need = AM.BASES[base].dna;
      if (!st.unlocked.has(base) && st.inv.dna[base] >= need) {
        st.unlocked.add(base);
        toast(`New base unlocked: ${AM.BASES[base].name}! Visit a Lab Keeper to fuse it.`, 'gold');
        P.stat('unlocks', 0);
      }
    };

    // ---------- inventory ----------
    P.equip = function (item) {
      const st = S();
      const i = st.inv.items.indexOf(item);
      if (i < 0) return;
      const old = st.equipment[item.slot];
      st.inv.items.splice(i, 1);
      if (old) st.inv.items.push(old);
      st.equipment[item.slot] = item;
      G.refreshPlayer(); G.audio.sfx('equip');
    };
    P.unequip = function (slot) {
      const st = S();
      const it = st.equipment[slot];
      if (!it) return;
      if (st.inv.items.length >= AM.INV_SIZE) { toast('Inventory full', 'bad'); return; }
      st.equipment[slot] = null; st.inv.items.push(it);
      G.refreshPlayer();
    };
    P.sell = function (item) {
      const st = S();
      const i = st.inv.items.indexOf(item);
      if (i < 0) return 0;
      st.inv.items.splice(i, 1);
      const v = AM.sellValue(item);
      st.gold += v; G.audio.sfx('coin');
      return v;
    };
    P.salvage = function (item) {
      const st = S();
      const i = st.inv.items.indexOf(item);
      if (i < 0) return null;
      st.inv.items.splice(i, 1);
      const y = AM.salvageYield(item);
      AM.addMats(st.inv, y);
      G.audio.sfx('salvage');
      return y;
    };
    P.salvageCommons = function () {
      const st = S();
      const list = st.inv.items.filter((it) => it.rarity === 'common' && !it.fav);
      const total = {};
      for (const it of list) { const y = P.salvage(it); for (const k in y) total[k] = (total[k] || 0) + y[k]; }
      return { n: list.length, total };
    };
    P.useCon = function (id) {
      const st = S(), p = G.player;
      if (!(st.inv.cons[id] > 0) || p.dead) return false;
      if ((p.potionCd || 0) > G.time && id === 'potion') return false;
      if (id === 'potion') { if (p.hp >= p.maxHp) { toast('Health is full', 'bad'); return false; } AM.Combat.heal(G, p, p.maxHp * 0.45 * (1 + (p.stats.potionPow || 0))); p.potionCd = G.time + 1; G.fx.burst(p.x, 1, p.z, '#ff5a6a', 12, 2.5); }
      else if (id === 'tonic') { p.energy = Math.min(p.stats.maxEnergy, p.energy + p.stats.maxEnergy * 0.6); G.fx.burst(p.x, 1, p.z, '#5ab4ff', 12, 2.5); }
      else if (id === 'tea') { for (const k of ['burn', 'poison', 'bleed', 'slow', 'freeze', 'stun', 'root', 'fear', 'blind', 'vuln', 'weaken']) delete p.status[k]; p.cleanseT = G.time + 8; G.fx.burst(p.x, 1, p.z, '#c8f08a', 12, 2.5); }
      else if (id === 'haste') { p.addBuff('haste', { haste: 0.3 }, 20); G.fx.burst(p.x, 1, p.z, '#ffd166', 12, 2.5); }
      else if (id === 'recall') { if (!st.lastVillage) { toast('You have not visited a village yet', 'bad'); return false; } G.teleportTo(st.lastVillage); }
      else if (id === 'tome') { return P.readTome(); }
      st.inv.cons[id]--;
      G.audio.sfx('drink');
      return true;
    };
    P.readTome = function () {
      const st = S();
      const unknown = AM.POWER_IDS.filter((id) => !st.powers.learned.includes(id));
      if (!unknown.length) { toast('You already know every power', 'bad'); return false; }
      const id = unknown[(Math.random() * unknown.length) | 0];
      st.inv.cons.tome--;
      P.learnPower(id);
      return true;
    };

    // ---------- powers ----------
    P.learnPower = function (id) {
      const st = S();
      if (st.powers.learned.includes(id)) return false;
      st.powers.learned.push(id);
      toast(`New power: ${AM.powerSpec(id).name}`, 'gold');
      const free = st.powers.equipped.findIndex((x, i) => !x && i < G.player.stats.powerSlots);
      if (free >= 0) st.powers.equipped[free] = id;
      G.hud.refreshPowers();
      return true;
    };
    P.equipPower = function (id, slot) {
      const st = S();
      const eq = st.powers.equipped;
      const cur = eq.indexOf(id);
      if (cur >= 0) eq[cur] = eq[slot] || null;
      eq[slot] = id;
      G.hud.refreshPowers();
    };
    P.fusePowers = function (a, b) {
      const st = S();
      const cost = AM.powerFusionCost(a, b);
      const id = a + '+' + b;
      if (st.powers.learned.includes(id)) return { ok: false, reason: 'You already know this fusion' };
      if ((st.inv.mats.essence || 0) < cost) return { ok: false, reason: `Needs ${cost} essence` };
      st.inv.mats.essence -= cost;
      st.powers.learned.push(id);
      P.stat('powerFusions', 1);
      G.audio.sfx('fuse');
      toast(`Fused: ${AM.powerSpec(id).name}`, 'gold');
      return { ok: true, id };
    };
    P.unfuse = function (id) {
      const st = S();
      const parts = id.split('+');
      if (parts.length !== 2) return;
      st.powers.learned = st.powers.learned.filter((x) => x !== id);
      st.powers.equipped = st.powers.equipped.map((x) => (x === id ? null : x));
      AM.addMats(st.inv, { essence: Math.floor(AM.powerFusionCost(parts[0], parts[1]) / 2) });
      G.hud.refreshPowers();
    };

    // ---------- skill tree ----------
    P.buySkill = function (id) {
      const st = S();
      if (!AM.canBuySkill(st.nodes, id, st.points)) return false;
      const n = AM.SKILL_NODES[id];
      st.points -= n.cost;
      st.nodes.add(id);
      if (n.power) P.learnPower(n.power);
      G.refreshPlayer();
      P.stat('skills', 1);
      G.audio.sfx('skill');
      return true;
    };
    P.respecCost = () => Math.round(50 * AM.LV(S().level));
    P.respec = function () {
      const st = S();
      const cost = P.respecCost();
      if (st.gold < cost) return false;
      st.gold -= cost;
      let refund = 0;
      for (const id of st.nodes) if (id !== st.path + '.root') refund += AM.SKILL_NODES[id].cost;
      st.nodes = new Set([st.path + '.root']);
      st.points += refund;
      G.refreshPlayer();
      return true;
    };

    // ---------- quests ----------
    P.acceptQuest = function (q) {
      const st = S();
      if (st.quests.active.length >= MAX_QUESTS) { toast(`You can carry ${MAX_QUESTS} quests at once`, 'bad'); return false; }
      if (st.quests.active.some((x) => x.id === q.id) || st.quests.done.has(q.id)) return false;
      const c = AM.deepCopy(q);
      c.tracked = !st.quests.active.some((x) => x.tracked);
      st.quests.active.push(c);
      toast('Quest accepted: ' + q.title, 'info');
      return true;
    };
    P.checkQuest = function (q) {
      if (!q.done && q.have >= q.need) { q.have = q.need; q.done = true; toast(`Quest complete: ${q.title}. Return to any Elder.`, 'gold'); G.audio.sfx('quest'); }
    };
    P.questEvent = function (kind, id, n) {
      for (const q of S().quests.active) {
        if (q.done) continue;
        if (kind === 'collect' && q.type === 'collect' && q.mat === id) q.have += n || 1;
        if (kind === 'clear' && q.type === 'clear' && q.struct === id) q.have = q.need;
        if (kind === 'lore' && q.type === 'explore' && q.struct === id) q.have = q.need;
        if (kind === 'deliver' && q.type === 'deliver' && q.target === id) q.have = q.need;
        P.checkQuest(q);
      }
    };
    P.turnIn = function (q) {
      const st = S();
      if (!q.done) return false;
      st.quests.active = st.quests.active.filter((x) => x !== q);
      st.quests.done.add(q.id);
      P.giveDirect(q.reward);
      P.stat('quests', 1);
      toast(`Reward: ${q.reward.xp} XP, ${q.reward.gold} gold`, 'gold');
      return true;
    };
    P.abandon = function (q) { const st = S(); st.quests.active = st.quests.active.filter((x) => x !== q); };

    // ---------- goals ----------
    P.stat = function (name, n) {
      const st = S();
      if (n) st.stats[name] = (st.stats[name] || 0) + n;
      for (const goal of AM.GOALS) {
        if (st.goalsDone.has(goal.id)) continue;
        let v;
        if (goal.stat === 'level') v = st.level;
        else if (goal.stat === 'unlocks') v = st.unlocked.size - 6;
        else if (goal.stat === 'biomes') v = st.biomesSeen.size;
        else v = st.stats[goal.stat] || 0;
        if (v >= goal.n) {
          st.goalsDone.add(goal.id);
          P.giveDirect(goal.reward);
          toast(`Goal reached: ${goal.title}`, 'goal');
        }
      }
      if (G.hud) G.hud.refreshGoal();
    };
    P.currentGoal = function () { const st = S(); return AM.GOALS.find((g) => !st.goalsDone.has(g.id)) || null; };
    P.discover = function (s) {
      const st = S();
      if (st.discovered.has(s.id)) return;
      st.discovered.add(s.id);
      if (s.type === 'village') {
        st.waypoints.add(s.id); P.stat('villages', 1);
        toast(`Discovered ${s.name}. Waypoint unlocked.`, 'info');
        P.gainXp(Math.round(AM.xpToNext(st.level) * 0.08));
      } else if (s.type === 'shrine') { st.waypoints.add(s.id); toast('Waypoint shrine discovered', 'info'); }
      else if (s.type === 'dungeon') toast(`Discovered the ${s.name} (level ${s.level})`, 'info');
      else if (s.type === 'cave') toast(`Discovered the ${s.name}`, 'info');
      else if (s.type === 'ruin') toast('Discovered ancient ruins', 'info');
    };
    return P;
  }

  AM.newState = newState;
  AM.makeProg = makeProg;
  AM.PATH_SECOND = PATH_SECOND;
})(typeof window !== 'undefined' ? window : globalThis);
