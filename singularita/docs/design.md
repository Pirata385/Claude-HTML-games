# Singularita — design

This document records the design of the full game and what Milestone 1 implements. The original brief (in Portuguese) asked for a 3D web RPG in the progression-and-crafting genre. Hades, Genshin Impact and Minecraft were to inform the art direction only, never the mechanics.

## Pillars

1. **Explore, fight, gather, craft, grow, unlock.** Every system feeds the next. Creatures drop materials that recipes need. Gathering needs tools that crafting makes. Levels unlock recipes and deeper places.
2. **Freedom to choose the route.** Holding the surface or mining the cave, any unlocked recipe in any order, class changes at the Altar. Level never limits equipment.
3. **Readable danger.** Every heavy attack is telegraphed (ground circles, lines, arcs, beams), and bosses are won by recognising patterns.
4. **Honest content.** Nothing shown in the game is a placeholder. What is not built yet is simply not in the data.

## The world

**Lore.** Vael was one land above the Core. The Dawnforgers mined down and found **Singularita**, matter that remembers every shape it could have been. Their king tried to forge a Singularita crown, and that caused **the Fracture**:
- Vael broke into isles.
- "Dimensions" folded into being.
- The Core was sealed behind a gate keyed to four elemental sigils.

What the player meets on Dawnreach comes from that story:
- The slimes are the forges' coolant gel gone feral.
- The zombies are *Echoes*: miners caught mid-shift by the ringing left when reality broke.
- The Silverback Emperor was the king's war-ape, still loyal.
- Lume, a beacon-keeper construct, finds the castaway player.

**Regions.**

| Region | Milestone | Role |
| --- | --- | --- |
| Dawnreach (starter isle) | 1 | Base camp, the endless day/night horde, two boss arenas, ruins with Echo Stones, the cave mouth |
| The Hollow Deep, layers 1–7 | 1 | Main material chain from stone to diamond; cave hazards from layer 4; ends at the Sealed Core Gate |
| Isles of Air, Water, Fire, Earth | 2 | Exclusive materials and sigils. Bosses: Ronin of the East Wind, Allele of the Divine Golem, the Magma Vector, Tears of Poseidon |
| Dimensions: Endless Dungeon, King Corrupted by Purple Adamite, Mirrored, Twin Slimes, Dragons | 3 | Dungeons with their own rules and the last materials. Bosses: Iron-Hand Jailer, the Adamite King, "You?", the Siamese, Ragnarok the Dragon God |
| The Sealed Core | 3 | Singularita, the final tier |

**Procedural generation with a fixed seed.** `WORLD_SEED` and `GEN_VERSION` derive one seed per zone. Generators must satisfy rules that are checked in tests (`js/world/gen/validate.js`):
- Every point of interest is reachable from camp without jumping.
- Feature footprints do not overlap, and arenas are flat and clear.
- Nodes never block paths or corridors.
- A cave's way down is at least 60% of the cave's diameter from its stairs, and every ore vein is reachable.

## Systems (Milestone 1)

- **Materials.** Wood → Stone → Copper/Gold → Iron → Lead/Titanium → Emerald → Ruby/Sapphire → Diamond. Parallel materials are alternative playstyles, set by each material's trait.
  - Gear is generated per class, slot and material, and each material's trait is applied according to the slot.
  - Recipes combine the main material with creature drops; boss materials go into accessories from tier 3.
  - "Where to find" is derived from the zone and creature data, so it always matches the game.
- **Classes.** Five kits, each with a basic attack, an alternate action, six skills (unlocked at levels 1, 4, 10, 18, 28 and 40), a dodge and its own resource and limitations. The Stardust's Astral is an entity of its own: leash, orbit guard, sentinel post, a damage echo to its bearer, and a break lockout.
- **Attributes.** Seven, each with soft caps: `f(a) = a·k / (1 + a/S)`. A test checks that every attribute changes some stat for every class.
- **Levels.** The cap is 300; `xpToNext(L) = 45·L^1.55 + 80`. Death costs 15% of the current level's progress but never a level. The roadmap in the Journal is derived from the data.
- **The horde.** Dawnreach has no waves (`js/systems/horde.js`, configured in `js/data/waves.js`). A steady stream keeps the population near a target (8 by day, 11 by night), 1–2 creatures every 2.5 s, out of sight. Levels are fixed per phase (1–10 day, 4–14 night) and the elite chance is a constant 6%, so nothing grows over time. Support and bomber roles only join behind three front-liners. Creatures left far behind wander off, so the horde follows the player. Caves keep a living population too, with tremors from layer 4.
- **Bosses.** Scripted state machines with phases, arena engagement and a leash reset, telegraphs, first-kill uniques, and a boss clock: one roams the island every 8–14 minutes of island time (the clock pauses while a boss is abroad), respecting its day or night, plus summon items. Bosses have fixed levels.
- **Optimisation.**
  - Creatures are drawn through one InstancedMesh per rig part, so a crowd costs a handful of draw calls.
  - Creatures run in activity tiers: full within 55 m, 5 Hz to 95 m, frozen beyond. Long-dormant regular creatures are recalled only when the population is over the cap.
  - Particles, projectiles and decals are pooled. Terrain is chunked and culled by distance.
  - Each zone is fully disposed on exit; the smoke test checks the geometry count.
  - Dynamic resolution, and Low/Medium/High presets.
- **Saves.** Versioned, checksummed JSON in localStorage with a backup per slot, migrations that fill new fields, export/import codes and autosave.

## Extending (next milestones)

- **A new zone:** add it to `js/data/zones.js` and write a generator in `js/world/gen/` returning the same shape (grid, spawn, nodes, points of interest). Add its validator rules and pin its snapshot hash.
- **A new material tier:** add it to `js/data/materials.js` and `TIER_RECIPE_LEVEL`, give it a node (`js/data/nodes.js`) and sources (zones or creatures). Items and recipes generate automatically. The data tests reject any recipe whose inputs cannot be obtained by its level.
- **A new boss:** add data to `js/data/bosses.js` and a class extending `ai/bosses/base.js`, then register it in `ai/spawner.js`.
- **A new creature:** add a data entry using an existing behaviour, or add a behaviour in `ai/behaviors.js` and a rig in `render/rigs.js`.
