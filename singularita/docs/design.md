# Singularita — design

This document records the design of the full game, which Milestones 1 to 3 implement. The original brief (in Portuguese) asked for a 3D web RPG in the progression-and-crafting genre. Hades, Genshin Impact and Minecraft were to inform the art direction only, never the mechanics.

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
| Isles of Air, Water, Fire, Earth | 2 | Exclusive materials and sigils, each with its own phenomena. Guardians: Ronin of the East Wind, Tears of Poseidon, the Magma Vector, Allele of the Divine Golem |
| The Dawn and Dusk Hollows (layer 8) | 2 | Beyond the Sealed Core Gate: tier 8 Dawndosite and Escuresite; ends at the Heart Seal |
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

## Systems (Milestone 2)

- **Travel.** The Wayshrine in camp is placed on the generated island at load time, so the island's snapshot does not change. `systems/travel.js` holds the rules: isles open by level; layer 8 needs the four sigils set into the gate (`flags.gateOpen`). Sigils are key items and stay in the bag.
- **Isle generators** (`js/world/gen/isles.js`). They return the same shape as the island and the caves; `validateIsle` checks reachability, counting updrafts as links.
  - **Spires:** plateaus over a void, joined by a spanning tree of bridges, or updraft pairs where a bridge would be too steep.
  - **Atoll:** radial bands; three sandbars to the temple; tidal cells between SEA−2 and SEA+1.
  - **Volcano:** a cone, a caldera ringed by basalt with two gaps, and lava rivers that run downhill; paths cross lava on basalt.
  - **Mesas:** terraces three blocks tall, with the Worldroot ridge and ramps.
  - Node placement only uses cells reachable from the landing.
- **Phenomena** (`js/world/phenomena.js`):
  - **Updrafts:** a scripted arc from `world/updraft.js`; the player is "carried", so physics pauses.
  - **Gales:** they push you, but never off a spire, because the void blocks movement.
  - **The tide:** `world/tide.js`, a 98 s cycle that reflags the tidal cells and moves the water plane.
  - **Lava:** burns on contact.
  - **Eruptions and quakes:** telegraphed circles around the player.
- **Populations.** Isles and caves keep a living population at their zone's fixed band; elites have a constant chance. Guardians are resident: one spawns on entry unless it fell less than 600 s of play time ago (`world.guardians`).
- **Rewards.** `systems/rewards.js` rolls boss loot; `once` rewards (the sigils) are skipped when already carried.
- **Objectives.** `reach` accepts alternatives (`a|b`). New types: `sigil` (progress follows the sigils carried) and `gate`.

## Systems (Milestone 3)

- **Emblems and runs.** An Emblem is a consumable whose effect opens a portal in front of the player. Using it is refused inside a dimension, in water or arenas, or when the dimension's level is not reached.
  - Entering starts a run (`systems/run.js`): the run seed comes from `WORLD_SEED`, the dimension and the run counter; the start position is remembered; the dimension's zone state is reset.
  - `getZone` keeps only the current dimension zone, generated from the run seed (and floor).
  - Runs end with `complete` (the ruler fell), `leave` (the way back or a stair out) or `fail` (death, recall). Records are kept per dimension: runs, clears, best floor.
- **Dimension generators** (`js/world/gen/dimensions.js`). Every layout is checked by `validateDimension` over many seeds; gates count as open.
  - **floors:** random rooms, a spanning tree of corridors, a far stair room or the Jailer's block.
  - **lanes:** two lanes, gel gates and the levers that open them.
  - **castle:** four rooms in a row with corruption blobs and braziers.
  - **mirror:** chambers mirrored across a glass line, plates and right-only walls, plus the reflection's own reachability map.
  - **peaks:** a spiral of plateaus joined by ramps whose height follows each cell's projection along the link.
- **Rules** (`js/world/dimrules.js`): twin pairs and revivals; the corruption meter; the Reflection (mirrored target, own collision, plates); dragon breath with rock shelter, and nests. Keys, stairs and levers live in `interact.js`.
- **Rulers.** They are scripted bosses in their arenas. The Jailer appears on boss floors and his level follows the run. Each ruler's `once` reward is its Fracture Shard; its fall opens a portal home.
- **Tiers 9 and 10.**
  - **Chromantite:** its stats `chromatic` and `afflictedBonus` cycle afflictions and reward them.
  - **Singularita:** pieces carry `memory: 2` and `collapse`. `systems/memory.js` adds the two remembered traits' modifiers for the piece's slot when stats are computed. Choices are stored per item in the save and are only changed at the Forge.
  - **Collapse:** every 12 hits (8 with a full set) a pull and a burst.

## Patches after Milestone 3

- **Melee trails** (`fx.slash`): the arc is laid flat facing +Z, the way a yaw of 0 faces, so trails show on the side the blow lands.
- **Night lights:** `nightGlow(sun)` (0 by day, 1 at night) drives the player's lantern on Dawnreach and two lights that follow the nearest bosses.
- **Cave perception** (`ai/perception.js`, `WAVES.cave.sight`): cave creatures notice the player in a 120° cone up to 13 cells with line of sight, within 3 cells, or when struck. They forget after 6 s out of sight beyond 26 cells. Unaware creatures look about and stroll. Caves hold 6–8 creatures and refill every 12 s.
- **The Astral** breaks after `astralHits(spi)` blows (4 + SPI/12, up to 20), whatever their damage. Ground zones and `hazard` hits pass through it. Its model is a stand whose arms pivot at the shoulders for punches.
- **The Mage** is crowd control: bursting bolts, knock-back, freezes, stuns, a blink with sure evasion, a barrier that shatters into frost, and the Arcane Lance (single target, 10× a bolt). Save version 2 swaps Meteor for the Lance on hotbars.

## Balance

The numbers are held by unit tests in `tests/systems.test.js` and checked in play with the bot in `tests/playtest.js` (`npm run playtest`).

- **Scaling.** Past level 100 the tiers are far apart (100, 180, 240), so creature health grows at 60% of the level there (`hpLevel` in `systems/scaling.js`). Damage keeps its curve: armour and health from the tiers already keep up with it.
- **Creatures** are tested against a Swordsman who just reached the zone, at the level the zone spawns them. Hits to kill (counting frontal armour, since most blows land in front): common creatures 12 at most, frontliners 16, heavies 30. Hits to die: 16, 11 and 8, because dimension creatures come in packs. Their experience is about a tenth of their base health, a few dozen kills per level.
- **Dimension levels** sit about eight levels above each emblem's level; the Endless Dungeon adds four per floor. A run's creatures are finite (`WAVES.dimension`): after the first ones, a reserve of three times the population (one and a half per gaol floor), then quiet. That leaves room to rest, and one emblem cannot be farmed forever. The Singular Heart spawns at 200 to 220, with fewer elites than its depth would give.
- **Rulers** take 150 to 320 hits, each harder than the one before, and kill in no fewer than about seven blows. A ruler is worth one to two and a half levels; an isle guardian, who returns every ten minutes, at most one and a half.
- **Bosses hold their arenas.** They never follow the player out, so kiting does not drag a fight past the leash and reset it. While a ruler is engaged, its dimension sends no more creatures into the fight.
- **The Siamese** are two twins with their own lives. When one falls, or both are worn to half, they merge for good into one slime with half their joined health; a reset parts them again. Either way of fighting them (one at a time, or evenly) costs about the same, and their gel globs reach players who keep their distance.
- **Warnings.** Boss attacks that hurt have a tell a player can read: a telegraph on the ground, a filling ring, or a wind-up arc. "You?" takes aim with a visible line before its volley.
- **Playtests** (bot, after tuning; it rests between fights when hurt). A careless player at each dimension's entry level wins about half of the ruler fights, and a careful one ten levels higher wins most. For reference, the careless bot beats the Slime Prince at its level and loses to the Silverback. The Stardust is the slowest class against bosses (its Astral breaks in lingering hazards), but it often survives where others fall.

## Extending (next milestones)

- **A new zone:** add it to `js/data/zones.js` and write a generator in `js/world/gen/` returning the same shape (grid, spawn, nodes, points of interest). Add its validator rules and pin its snapshot hash.
- **A new material tier:** add it to `js/data/materials.js` and `TIER_RECIPE_LEVEL`, give it a node (`js/data/nodes.js`) and sources (zones or creatures). Items and recipes generate automatically. The data tests reject any recipe whose inputs cannot be obtained by its level.
- **A new boss:** add data to `js/data/bosses.js` and a class extending `ai/bosses/base.js`, then register it in `ai/spawner.js`.
- **A new creature:** add a data entry using an existing behaviour, or add a behaviour in `ai/behaviors.js` and a rig in `render/rigs.js`.
