// Amalgamations — procedural village quests and the goal chain (tutorial + achievements). Pure.
(function (root) {
  'use strict';
  const AM = root.AM || (root.AM = {});

  const ELITE_NAMES = ['Grimjaw', 'Old Smoulder', 'Mirefang', 'Hollowgaze', 'Rustclaw', 'Frostmaw', 'Thornback', 'Gloomwing', 'Bramblehide', 'Cinderhorn', 'Stoneskull', 'Wraithtail'];
  const COLLECT = ['wood', 'stone', 'herb', 'iron', 'hide', 'gel'];

  // Three quests offered by a village's Elder. They change every in-game day.
  function villageQuests(world, village, day, playerLevel, lockedBases) {
    const rng = AM.makeRng(AM.hash2(village.seed, day, 0x9e57));
    const L = Math.max(village.level, 1);
    const near = world.structuresNear(village.x, village.z, 420).filter((s) => s.id !== village.id);
    const out = [];
    const types = rng.shuffle(['hunt', 'collect', 'clear', 'explore', 'elite', 'deliver', 'huntBase']);
    for (const type of types) {
      if (out.length >= 3) break;
      const q = { id: `q:${village.id}:${day}:${type}`, type, village: village.id, villageName: village.name, have: 0, done: false, level: L };
      if (type === 'hunt') {
        q.need = 5 + rng.int(0, 5); q.minLevel = Math.max(1, L - 2);
        q.title = `Thin the herd`; q.desc = `Defeat ${q.need} wild creatures of level ${q.minLevel} or higher.`;
      } else if (type === 'huntBase') {
        const base = rng.pick(Object.keys(AM.BIOMES[AM.BIOME_INDEX[village.biome]].spawns));
        q.need = 3 + rng.int(0, 3); q.base = base;
        q.title = `${AM.BASES[base].name} trouble`; q.desc = `Defeat ${q.need} creatures with ${AM.BASES[base].name} blood.`;
      } else if (type === 'collect') {
        q.mat = rng.pick(COLLECT); q.need = 4 + rng.int(0, 5);
        q.title = 'Supplies'; q.desc = `Bring ${q.need} ${AM.MATERIALS[q.mat].name} (gathered after accepting).`;
      } else if (type === 'clear') {
        const t = near.filter((s) => s.type === 'cave' || s.type === 'dungeon');
        if (!t.length) continue;
        const s = t.sort((a, b) => Math.hypot(a.x - village.x, a.z - village.z) - Math.hypot(b.x - village.x, b.z - village.z))[rng.int(0, Math.min(1, t.length - 1))];
        q.struct = s.id; q.x = s.x; q.z = s.z; q.need = 1;
        q.title = s.type === 'dungeon' ? `Purge the ${s.name}` : `Clear the ${s.name}`;
        q.desc = s.type === 'dungeon' ? `Defeat the boss of the ${s.name} (level ${s.level}).` : `Open the treasure chest at the end of the ${s.name}.`;
      } else if (type === 'explore') {
        const t = near.filter((s) => s.type === 'ruin');
        if (!t.length) continue;
        const s = rng.pick(t);
        q.struct = s.id; q.x = s.x; q.z = s.z; q.need = 1;
        q.title = 'Lost history'; q.desc = 'Read the lore stone in the marked ruins.';
      } else if (type === 'elite') {
        const a = rng.next() * Math.PI * 2, d = 90 + rng.next() * 140;
        q.x = village.x + Math.cos(a) * d; q.z = village.z + Math.sin(a) * d;
        if (world.waterAt(q.x, q.z)) continue;
        q.eliteName = rng.pick(ELITE_NAMES);
        q.pair = [rng.pick(AM.BASE_IDS), rng.pick(AM.BASE_IDS)];
        q.eliteLevel = world.dangerAt(q.x, q.z) + 1; q.need = 1;
        q.title = `Hunt ${q.eliteName}`; q.desc = `A dangerous ${AM.BASES[q.pair[0]].name}-${AM.BASES[q.pair[1]].name} called ${q.eliteName} prowls nearby (level ${q.eliteLevel}).`;
      } else if (type === 'deliver') {
        const vs = near.filter((s) => s.type === 'village');
        if (!vs.length) continue;
        const v = rng.pick(vs);
        q.target = v.id; q.x = v.x; q.z = v.z; q.need = 1;
        q.title = 'Special delivery'; q.desc = `Take a parcel to the Elder of ${v.name}.`;
      }
      const tier = { hunt: 1, huntBase: 1, collect: 0.8, clear: 1.6, explore: 1.1, elite: 1.8, deliver: 1.2 }[type];
      q.reward = { xp: Math.round(AM.xpToNext(Math.max(playerLevel, L)) * 0.3 * tier), gold: Math.round(35 * AM.LV(L) * tier), essence: Math.round(3 * tier) };
      if (lockedBases && lockedBases.length && rng.chance(0.6)) q.reward.dna = { [rng.pick(lockedBases)]: 2 };
      if (rng.chance(0.4 * tier)) q.reward.item = true;
      out.push(q);
    }
    return out;
  }

  // Goal chain: the first ones teach the game, the rest are long-term achievements.
  const GOALS = [
    { id: 'move', title: 'Take your first steps', hint: 'Move with WASD / the joystick.', stat: 'distance', n: 30, reward: { xp: 20 } },
    { id: 'kill1', title: 'Defeat a wild creature', hint: 'Attack with left click / the attack button.', stat: 'kills', n: 1, reward: { xp: 30, gold: 20 } },
    { id: 'power1', title: 'Use a power', hint: 'Press 1 or tap a power button.', stat: 'casts', n: 1, reward: { xp: 30 } },
    { id: 'skill1', title: 'Spend a skill point', hint: 'Open Skills (K) after levelling up.', stat: 'skills', n: 1, reward: { gold: 40 } },
    { id: 'mine1', title: 'Gather materials', hint: 'Mine ore, pick herbs or chop logs with the action button (F).', stat: 'gathered', n: 3, reward: { xp: 30 } },
    { id: 'quest1', title: 'Finish a village quest', hint: 'Talk to the Elder in Hearthmoor.', stat: 'quests', n: 1, reward: { xp: 60, essence: 5 } },
    { id: 'cave1', title: 'Explore a cave', hint: 'Caves are marked on the map. Open the chest at the end.', stat: 'caves', n: 1, reward: { xp: 80, essence: 5 } },
    { id: 'pfuse1', title: 'Fuse two powers', hint: 'At a Lab Keeper, fuse two powers into one.', stat: 'powerFusions', n: 1, reward: { essence: 10 } },
    { id: 'reform', title: 'Take a new form', hint: 'Collect DNA, then fuse a new body at a Lab Keeper.', stat: 'reforms', n: 1, reward: { xp: 60 } },
    { id: 'village2', title: 'Find another village', hint: 'Travel. Villages have waypoints you can teleport to.', stat: 'villages', n: 2, reward: { xp: 100, gold: 80 } },
    { id: 'dungeon1', title: 'Defeat a dungeon boss', hint: 'Dungeons are dangerous: clear every room to open the boss door.', stat: 'bosses', n: 1, reward: { xp: 200, essence: 15 } },
    { id: 'lvl10', title: 'Reach level 10', stat: 'level', n: 10, reward: { gold: 300 } },
    { id: 'unlock3', title: 'Unlock 3 new bases', hint: 'Collect DNA from wild creatures.', stat: 'unlocks', n: 3, reward: { essence: 20 } },
    { id: 'elite5', title: 'Defeat 5 elites', stat: 'elites', n: 5, reward: { gold: 400 } },
    { id: 'biomes', title: 'Visit all 8 biomes', stat: 'biomes', n: 8, reward: { xp: 600, essence: 30 } },
    { id: 'chests20', title: 'Open 20 chests', stat: 'chests', n: 20, reward: { gold: 800 } },
    { id: 'lvl25', title: 'Reach level 25', stat: 'level', n: 25, reward: { gold: 2500, essence: 40 } },
    { id: 'legend', title: 'Find a legendary item', stat: 'legendaries', n: 1, reward: { essence: 50 } },
    { id: 'boss30', title: 'Defeat a level 30 boss', stat: 'bossLevel', n: 30, reward: { essence: 80 } },
    { id: 'unlockall', title: 'Unlock every base', stat: 'unlocks', n: 17, reward: { essence: 200 } },
    { id: 'lvl50', title: 'Reach level 50', stat: 'level', n: 50, reward: { essence: 300 } },
  ];

  Object.assign(AM, { villageQuests, GOALS, ELITE_NAMES });
  if (typeof module !== 'undefined' && module.exports) module.exports = AM;
})(typeof window !== 'undefined' ? window : globalThis);
