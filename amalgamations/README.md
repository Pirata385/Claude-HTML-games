# Amalgamations

An isometric 3D action RPG about fusion, played in the browser on desktop and mobile, with an optional third-person camera. You pick a **mother** and a **father** and play as their fusion. You explore an endless, seeded open world, fight in real time, and fuse your powers too. The game takes its core mechanics from creature-fusion games like Hybrid Animals; the name, creatures, art and interface are all its own.

Open `index.html` directly or through any static server. Everything runs locally: there is no build step and no network access (the UI font comes from Google Fonts and falls back to the system font offline).

## How to play

1. **New game:** choose a save slot and a world seed (random by default).
2. **Fusion Lab:** pick a mother ♀ and a father ♂ from the unlocked bases. The order matters, and each **mutation** (‹ › or 🎲) is a different blend of the same pair.
3. **Path:** choose one of the six skill-tree branches. It grants your first two powers.
4. Leave Hearthmoor, fight wild amalgams, collect loot and **DNA**, and unlock new bases. You can change form at any village **Lab Keeper**.

The farther you go from spawn, the higher the **danger level** (shown under the minimap), and the stronger the creatures, dungeons and loot.

### Controls

| | Keyboard & mouse | Touch | Gamepad |
| --- | --- | --- | --- |
| Move | WASD / arrows | floating joystick (left half) | left stick |
| Aim | mouse | auto-aim, or drag a power button | right stick |
| Attack | left click / L (hold) | big button (hold) | A |
| Dodge roll (untouchable) | Space / Shift / right click | dodge button | B |
| Powers | 1–4 or Q E R T | power buttons | LB RB LT RT |
| Interact | F | contextual button | X |
| Potion | H | potion button | Y |
| Camera | Z / X rotate · wheel or − = zoom · **V** isometric ↔ third person | pinch to zoom · camera button | D-pad |
| Orbit (third person) | drag with the right or middle mouse button (a right click without dragging still dodges) | drag one finger on the right side | right stick |
| Menus | I inventory · P powers · K skills · M/Tab map · J quests · Esc pause | side buttons | Start / Back |

## Systems

- **Creature fusion** (`js/fusion.js`): 23 bases: 11 animals, 6 objects and plants, 6 weird things. They all share one genome schema (body, head, eyes, legs, arms, tail, wings, extras on anchor slots, palette, pattern, material, stats, trait and attack), so any two of them fuse.
  - Each slot is chosen by **dominance** with jitter. No fixed rule decides it (never "head from the father").
  - Proportions blend with a U-shaped mix in log space, so a feature usually leans clearly towards one parent. An **anatomy pass** then clamps the ratios.
  - Extras fill anchor slots without clutter.
  - A **readability rule** makes every fusion recognisably both parents: each parent contributes enough signature features, plus a body part or the colours.
  - Colours mix in OKLab with a contrast fix. Both parent traits apply at 70%, and 12 special pairs grant a named synergy.
  - The attack follows the anatomy, and the name is a syllable-aware portmanteau.
  - Fusion is deterministic: A×B differs from B×A, and every variant is a new mutation.
- **Powers** (`js/data/powers.js`, `js/powerfusion.js`): 19 powers across 16 delivery shapes (projectile, nova, chain, cone, dash, heal zone, blink, beam, meteor, summon, shield, vortex, trap, boomerang, roar, storm) and 12 elements.
  - **Fusing A + B**: A is the delivery and B becomes a payload that triggers where A lands or ends. The two elements combine through a 66-entry table (fire + frost = Steam, storm + water = Conductive, shadow + light = Twilight…).
  - Some shape pairs have special results: multishot, meteor shower, double nova and others. That makes 342 ordered fusions.
- **Combat** (`js/game/combat.js`) is real time, with crits, defence, lifesteal and thorns.
  - **Statuses:** burn, poison, bleed, slow, freeze, stun, shock, soak, blind, root, fear, knockback, pull, vulnerability, weaken, execute and spread.
  - **Enemy warnings:** enemies telegraph attacks and powers with red ground markings.
  - **Elites** have affixes (Vampiric, Explosive, Swift, Armoured, Frenzied, Arcane). **Bosses** have three phases: they call minions at 66% and enrage with ground slams at 33%.
- **World** (`js/worldgen.js`, `js/render/world.js`): infinite and flat, streamed in 32 m chunks.
  - **Biomes (8):** Meadow, Forest, Desert, Tundra, Swamp, Mushroom Grove, Crystal Fields and Volcanic Wastes, with lakes, rivers and lava.
  - **Structures (per 256 m region):** villages (Elder, Merchant, Blacksmith, Lab Keeper and a waypoint), ruins with guardians and lore, creature camps, lone chests and waypoint shrines.
  - **Interiors:** caves (cellular-automata layouts with ore, `js/dungeongen.js`) and dungeons (rooms, corridors and spike traps, with a boss room that stays sealed until the other rooms are cleared).
  - A day/night cycle makes creatures one level stronger at night.
- **Items** (`js/data/items.js`, `js/loot.js`):
  - **Gear:** 8 weapon types float beside your creature as "bound weapons", so every body plan can wield one. There are 4 armour slots, 5 rarities, 20 affixes and 8 legendaries with unique effects.
  - **Materials and crafting:** materials come from mining, herbs and logs. You can craft potions anywhere; Blacksmiths forge gear and upgrade it from +1 to +10. Salvage turns gear back into materials, and the Merchant's stock changes daily.
- **Progression** (`js/stats.js`, `js/data/skilltree.js`, `js/quests.js`): levels have no cap. The skill tree has 66 nodes on a radial graph with **6 roots** (Brawler, Ranger, Elementalist, Guardian, Primal, Wanderer), plus notables and keystones (Chimera Heart, Overflow, Glass Cannon…). Elders give procedural daily quests, and a 21-step goal chain doubles as the tutorial and achievements.

## Cameras

The game starts in the **isometric** view: a fixed-angle orthographic camera that rotates in 45° steps. Press **V**, tap the camera button, or pick it in Settings → Gameplay to switch to the **third-person** camera. It is a perspective camera behind your creature, close to the ground with the horizon in view:

- **Orbit and zoom:** drag to orbit (mouse right/middle button, one finger on the right half of the screen, or the right stick) and scroll or pinch to zoom.
- **Follow:** while you run, the camera drifts back behind you. You can turn this off in Settings, where you can also set the orbit sensitivity.
- **Distance and aim:** the view reaches at least 3 chunks, with fog hiding the edge, and mouse aim is limited to 22 m.
- **Gamepad:** the right stick orbits the camera, and powers use auto-aim.

## Performance and options

Settings has presets (Auto / Low / Medium / High / Ultra) and individual controls:

- render scale and **dynamic resolution**
- shadows, view distance and particles
- maximum wild creatures, antialiasing, pixel-density cap, FPS limit, and an FPS and draw-call counter
- audio volumes
- gameplay: auto-aim, auto-loot, damage numbers, screen shake and camera rotation
- touch layout: auto, left-handed, button size and opacity
- interface size
- save export/import

Optimisations built in:

- **Creatures:** one rigidly skinned mesh each, with geometry shared between creatures of the same kind.
- **World geometry:** one merged ground mesh per chunk (with water banks), global `InstancedMesh` props and merged structures. A typical frame needs about 25–40 draw calls.
- **Pooling:** particles and projectiles each use a single pooled `InstancedMesh`.
- **Simulation and loading:** animation LOD for distant creatures, a creature cap, and incremental chunk loading.
- **Background behaviour:** the game pauses and autosaves when the tab is hidden.

## Files

```
index.html             HUD, touch controls, menus (CSS) and script order
vendor/three.min.js    three.js r158 (MIT, see vendor/LICENSE-three.txt), its deprecation warning removed
js/core.js             seeded RNG, hashing, simplex noise, OKLab colour, helpers
js/data/*.js           bases, powers and element combos, items, skill tree
js/fusion.js           creature fusion
js/powerfusion.js      power fusion
js/stats.js            stats, level curve, damage formulas
js/loot.js             item rolls, crafting, drops
js/worldgen.js         biomes, chunks, structures, wild spawns
js/dungeongen.js       cave and dungeon layouts
js/quests.js           village quests and goals
js/save.js             save slots, run-length encoded exploration, export codes
js/render/*.js         geometry builder, creature models and animation, props, world view, effects
js/game/*.js           entities and AI, combat, interiors, progression state
js/ui/*.js             input, HUD, screens
js/audio.js            synthesised sound and generative music
js/main.js             boot, loop, camera, player control, quality manager
tests/*.test.js        Node tests for the pure modules
```

## Tests

```
node --test amalgamations/tests/*.test.js
```

The tests check every ordered pair of bases (valid, readable, varied and deterministic), all 342 power fusions, the stat and loot formulas, world determinism, danger scaling, structure placement and biome coverage, cave and dungeon connectivity, the skill-tree graph, quests and save round-trips.
