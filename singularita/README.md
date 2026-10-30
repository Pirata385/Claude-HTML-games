# Singularita — The Broken Isles

A third-person 3D voxel RPG of exploration, combat and crafting for the browser, on desktop and mobile. Hold the starter isle of **Dawnreach** against slimes by day and the Echoes of dead miners by night, mine down through the seven layers of **the Hollow Deep** from wood to diamond, craft gear for five very different classes, and face the **Slime Prince** and the **Silverback Zombie Emperor**.

> **Status — Milestone 1 of the full design.** This milestone covers the starter island, the Hollow Deep, all five classes, crafting, levels (cap 300), saving, mobile support and the first two bosses. The four elemental isles (Air, Water, Fire, Earth), the five dimensions, the remaining nine bosses and the last material tiers (Dawndosite and Escuresite, Chromantite, Singularita) come in later milestones. The world already points to them: the cave ends at the Sealed Core Gate, which needs a sigil from each elemental isle. Nothing in this build is a placeholder. Every recipe can be crafted and every area can be reached.

## Running

The game uses ES modules, so it must be served over HTTP (opening the file directly will not work):

```
npx serve .          # from the repository root, then open /singularita/
```

Open the root `index.html` menu and pick **Singularita**. Progress is saved in the browser (three slots), and saves can be exported as a text code from the System tab or the title screen.

## Controls

| Action | Keyboard & mouse | Touch |
| --- | --- | --- |
| Move / look | WASD / mouse (click the view to capture it) | Left side: floating stick · right side: drag |
| Attack | Left click (hold to repeat, or to charge as Archer) | Big button |
| Alternate (guard, aim, channel, mark, manifest) | Right click | Button left of attack |
| Skills | 1–4 | Four skill buttons |
| Dodge / jump | Shift / Space | Dodge / Jump |
| Interact, gather (hold) | F | Tap the prompt |
| Lock on | Q | Lock button, or a quick tap on the view |
| Healing tonic | R | ❤ button |
| Return to camp | B (6 s channel) | — |
| Menus | Tab/I inventory · C crafting · K character · L skills · M map · J journal · Esc | ☰ ⌖ ⚒ buttons |

All key bindings can be changed in Settings.

## How it plays

- **Camp.** The beacon keeps creatures out. Craft at the **Forge** (you can browse recipes anywhere). Change class at the **Altar of Paths**; each class keeps its own gear. Rest and save at the **bed**. Talk to **Lume**, the beacon keeper.
- **Day and night.** A 20-minute cycle. Slimes come by day: hoppers, Great Slimes that split, Spitters, and Menders that heal the others (kill them first). Echoes come by night: Walkers, fast Runners, Brutes, Screamers that hasten their friends, and Bloaters that burst into poison. The island is never quiet: one endless horde keeps coming a few creatures at a time, with no waves to announce and no growth in strength. Island creatures have fixed levels (slimes 1–10 by day, Echoes 4–14 by night), so you outgrow them; the cave is where the challenge grows. Healers, Screamers and Bloaters only show up behind a front line, and some creatures are elites with an affix (Swift, Armoured, Vampiric, Volatile, Shielding).
- **Gathering.** Trees need no tool; axes are just faster. A pickaxe of tier T mines veins up to tier T + 1. Your best tools are used automatically, Strength speeds gathering, and nodes grow back over time.
- **The Hollow Deep.** Seven seeded cave layers, each with its own palette, creatures and ores. Each layer needs a minimum level (1, 8, 15, 24, 34, 46, 58). From layer 4 the cave fights back: falling stalactites with shadow warnings, poison gas vents (carry Antidotes), heat and frost vents in the split Ember & Rime Rift, tremors that bring burrowers, crystal resonance that wakes sentries when you mine gems, and the deep dark of the Diamond Throat.
- **Bosses.** Bosses roam Dawnreach at random, 8 to 14 minutes apart: the Slime Prince holds court in the Sunlit Glade by day, the Silverback Emperor waits in Bone Ridge Crater by night. A banner tells you when one appears. You can also summon them with a crafted Royal Jelly Bait or Echo Horn.
  - **The Slime Prince** lands in shockwave rings you must jump or dodge. He slams his crown down and absorbs his golden guards to heal unless you kill them first, then splits in two.
  - **The Silverback Emperor** leaps, throws boulders and roars up Echoes. His charge stuns him for a few seconds if you bait him into a pillar.
- **Lore.** Echo Stones on the island and in every layer tell the story of the Dawnforgers, Singularita and the Fracture. Lume, item descriptions and the bosses fill in the rest. The Journal collects everything you have found.

## Classes

| Class | Resource | Style | Weakness |
| --- | --- | --- | --- |
| Swordsman | Stamina | Three-hit combos, guard and a 0.25 s perfect parry, Lunge, Whirlwind, Sunder, War Cry, Earthsplitter, Blade Dance | No ranged options |
| Archer | Focus | Hold to charge (a full charge pierces), Steady Aim, Volley, Roll Shot, Pinning Arrow, Blast Arrow, Arrow Rain, Hawk Eye | Fragile; weaker at point blank |
| Mage | Mana | Homing bolts, Channel, fire, frost and lightning that combine (shatter and steam), Blink, Barrier, Meteor | Cast times, low health, mana |
| Assassin | Energy | Fast stabs, double damage from behind, Mark, Shadowstep, Smoke Veil, Fan of Knives, Venom Edge, Execution, Dash Cut | Lowest health, weak against crowds |
| Stardust | Spirit | Manifests an **Astral**, a constellation spirit generated from your character's seed. It fights inside a leash, guards in orbit, can be posted as a Sentinel, and casts Comet Dive, Gravity Well, Starfall and Constellation Link | Spirit drains while the Astral is out; 30% of its wounds echo to you, and if it breaks it cannot return for 6 s |

Skills unlock at levels 1, 4, 10, 18, 28 and 40. Four of the six go on the hotbar, chosen in the Skills tab.

## Attributes

You get 3 points per level, plus free growth in your class's two main attributes. Every attribute has soft caps, so no single one is mandatory:
- **Strength:** melee damage, knockback and gathering speed.
- **Resistance:** health, defence and stagger resistance.
- **Agility:** move and attack speed, dodge cooldown.
- **Dexterity:** critical hits, projectile speed and accuracy.
- **Spirituality:** Astral power and leash, status potency and resistance, healing received.
- **Intelligence:** magic damage, cooldown reduction and Mana.
- **Reserves:** class resource and its regeneration, regeneration at rest, and tonic strength.

A Reset Crystal refunds all your spent points.

## Materials and progression

| Tier | Material | Found | Mine with | Recipes from | Trait |
| --- | --- | --- | --- | --- | --- |
| 0 | Wood | Island trees | Hands / axes | Lv 1 | Light: faster attacks |
| 1 | Stone | Boulders, Layer 1 | Wood pickaxe | Lv 3 | Heavy: knockback, stagger resist |
| 2 | Copper · Gold | Layers 1–2 | Stone pickaxe | Lv 8 | Conductive (shock arcs) · Gilded (INT/SPI scaling, luck) |
| 3 | Iron | Layers 2–3 | Copper/Gold pickaxe | Lv 16 | Tempered: armour pierce |
| 4 | Lead · Titanium | Layers 3–4 | Iron pickaxe | Lv 26 | Dense (crushing knockback) · Featherweight (speed) |
| 5 | Emerald | Layers 4–5 | Lead/Titanium pickaxe | Lv 38 | Verdant: life steal and regeneration |
| 6 | Ruby · Sapphire | Layers 5–6 | Emerald pickaxe | Lv 50 | Ember (burn) · Rime (chill, resource regen) |
| 7 | Diamond | Layers 6–7 | Ruby/Sapphire pickaxe | Lv 64 | Prismatic: crits split arrows or send shockwaves |

- **Gear.** Every class has a weapon, an armour and an accessory in every material, plus pickaxes, axes and boss uniques.
- **Level.** Level gates recipes and areas, never equipping.
- **Recipes.** They also need creature drops (Slime Gel, Echo Sinew, Bat Leather, Crawler Chitin, Ember Cores, Rime Shards, Prism Dust) and, from tier 3 accessories up, boss materials.
- **Crafting menu.** It filters by class, item type, material and availability. It shows what you have against what you need, and **where to find** every missing material.

## Code layout

```
index.html            entry page (import map for the vendored three.js)
lib/three/            three.js 0.180 (MIT)
css/                  base, HUD, menus, touch
js/main.js            boot, title screen, main loop
js/game.js            the running game: zone, player, camera, systems
js/gameplay.js        combat, creatures, kit, Astral, XP, death and respawn
js/session.js         objectives, saving, settings, audio routing, UI
js/core/              rng, noise, events, pools, math, input
js/data/              all content: materials, nodes, classes, skills, items, recipes, creatures, bosses, zones, waves, lore, objectives
js/systems/           pure rules: stats, progression, inventory, equipment, crafting, gathering, saves, settings, day/night, the horde and boss clock, objectives, fog
js/world/             grid, physics, interaction, generators and validators (gen/)
js/render/            renderer, terrain mesher, props, sky, water, rigs and instancing, models, FX, camera
js/combat/            formulas, statuses, combat system, class kits
js/ai/                behaviours, flow field, creature manager, spawner, bosses
js/ui/                HUD, minimap, menus, touch controls, overlay, title screens
tests/                unit tests (node --test) and a Playwright smoke test
docs/design.md        the design of the full game and of this milestone
```

The world uses a fixed seed (`WORLD_SEED` in `js/world/gen/index.js`), so Dawnreach and the Hollow Deep are the same on every load. The tests pin a hash of every generated zone.

## Tests

From this folder:

```
npm test              # unit tests: data integrity, systems, world generation rules, combat maths, objectives, fog
npm run smoke         # browser smoke test (Playwright + Chromium): plays the opening loop, caves, both bosses, every class and touch
```

The smoke test serves the repository itself and prints the folder where it saved its screenshots. For debugging, add `?debug` to the URL to expose the running game as `window.__SG`, and `?quickstart=<class>` to skip the title screen with a test character.
