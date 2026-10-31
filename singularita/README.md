# Singularita — The Broken Isles

A third-person 3D voxel RPG of exploration, combat and crafting for the browser, on desktop and mobile. Hold the starter isle of **Dawnreach** against slimes by day and the Echoes of dead miners by night, mine down through the seven layers of **the Hollow Deep** from wood to diamond, craft gear for five very different classes, and face the **Slime Prince** and the **Silverback Zombie Emperor**.

> **Status — the full design (Milestones 1 to 3).**
> - **Milestone 1:** the starter island, the Hollow Deep, all five classes, crafting, levels (cap 300), saving, mobile support and the first two bosses.
> - **Milestone 2:** the four elemental isles (Air, Water, Fire, Earth) with their phenomena, creatures and guardians; the four sigils that open the Sealed Core Gate; the eighth layer beyond it, with Dawndosite and Escuresite.
> - **Milestone 3:** the five dimensions, opened with Emblems and played as runs, each with its own rule and ruler; the five Fracture Shards that open the Singular Heart; and the last two tiers, Chromantite and Singularita.
>
> All eleven bosses of the brief are in. Nothing in this build is a placeholder: every recipe can be crafted and every area can be reached.

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
| Free the mouse (to click the HUD buttons) | Alt | — |
| Full screen | F11 (browser) | Automatic on the first tap (Settings → Touch), or the ⛶ button |
| Menus | Tab/I inventory · C crafting · K character · L skills · M map · J journal · Esc | ☰ ⌖ ⚒ buttons |

All key bindings can be changed in Settings.

On phones and tablets the game goes full screen on the first tap; the ⛶ button (HUD and title screen) switches it at any time, and Settings → Touch turns the automatic switch off. Browsers that cannot hide their bars (iPhone Safari) can use **Share → Add to Home Screen**: the game then opens full screen as an app.

## How it plays

- **Camp.** The beacon keeps creatures out. Craft at the **Forge** (you can browse recipes anywhere). Change class at the **Altar of Paths**; each class keeps its own gear. Rest and save at the **bed**. Talk to **Lume**, the beacon keeper.
- **Day and night.** A 20-minute cycle. Slimes come by day: hoppers, Great Slimes that split, Spitters, and Menders that heal the others (kill them first). Echoes come by night: Walkers, fast Runners, Brutes, Screamers that hasten their friends, and Bloaters that burst into poison. The island is never quiet: one endless horde keeps coming a few creatures at a time, with no waves to announce and no growth in strength. Island creatures have fixed levels (slimes 1–10 by day, Echoes 4–14 by night), so you outgrow them; the cave is where the challenge grows. Healers, Screamers and Bloaters only show up behind a front line, and some creatures are elites with an affix (Swift, Armoured, Vampiric, Volatile, Shielding).
- **Gathering.** Trees need no tool; axes are just faster. A pickaxe of tier T mines veins up to tier T + 1. Your best tools are used automatically, Strength speeds gathering, and nodes grow back over time.
- **The Hollow Deep.** Seven seeded cave layers, each with its own palette, creatures and ores. Each layer needs a minimum level (1, 8, 15, 24, 34, 46, 58). From layer 4 the cave fights back: falling stalactites with shadow warnings, poison gas vents (carry Antidotes), heat and frost vents in the split Ember & Rime Rift, tremors that bring burrowers, crystal resonance that wakes sentries when you mine gems, and the deep dark of the Diamond Throat.
- **Bosses.** Bosses roam Dawnreach at random, 8 to 14 minutes apart: the Slime Prince holds court in the Sunlit Glade by day, the Silverback Emperor waits in Bone Ridge Crater by night. A banner tells you when one appears. You can also summon them with a crafted Royal Jelly Bait or Echo Horn.
  - **The Slime Prince** lands in shockwave rings you must jump or dodge. He slams his crown down and absorbs his golden guards to heal unless you kill them first, then splits in two.
  - **The Silverback Emperor** leaps, throws boulders and roars up Echoes. His charge stuns him for a few seconds if you bait him into a pillar.
- **The elemental isles** (from level 66 and 80). The **Wayshrine** in camp carries you to each isle's landing; a return stone there brings you back. Each isle has its own creatures at fixed levels, exclusive materials, two Echo Stones and a guardian who keeps a sigil.
  - **The Galeforge Spires (Air, Lv 66).** Plateaus over a cloud sea, linked by plank bridges and updraft vents that carry you from spire to spire; gales push everything across the summits. Harpies dive and knock you back, Kite Serpents shoot lightning, Cloud Sprites shield their kin, Storm Wisps burst. Skyglass spires and Cloud Pines.
  - **Tidecrown Atoll (Water, Lv 66).** A ring of land around a lagoon and a temple islet. The tide runs on a cycle: at low water sandbars lead to the temple and pearl beds can be gathered; at high water they flood, and the current drags you ashore. Reef Crabs, Sirens, Drowned Sailors and Glass Jellies.
  - **Cinderspine (Fire, Lv 80).** A volcano with lava rivers (paths cross them on basalt) and eruptions that rain burning rock. Lava Hounds, Obsidian Golems, Fire Imps and Ash Shamans, all fireproof. Obsidian grows by the lava.
  - **The Rootdeep Mesas (Earth, Lv 80).** Terraced mesas crossed by the Worldroot, whose flanks grow Living Amber; quakes raise stone spikes. Mossback Tortoises, Root Lashers that whip from the ground, Burrowing Moles and Stone Wisps.
- **The guardians** wait in their arenas and return 10 minutes after a defeat. Each gives its sigil once.
  - **Ronin of the East Wind:** iai dashes along a line he shows first, wind crescents, a blue counter stance (do not strike it), then Gale Steps and tornadoes.
  - **Tears of Poseidon:** three spirits; while all three live the temple floods (stand on the raised stones), then whirlpools and sweeping waves.
  - **The Magma Vector:** dashes along shown vectors and leaves lava; its core cools after each dash, which is the time to strike. Later its vectors reflect off the rim and cross.
  - **Allele of the Divine Golem:** expresses alleles: Granite (armoured in front), Quartz (fast combos), Moss (seedlings that heal it until cut); later two at once, then mutating fast.
- **The Sealed Core Gate and the Dawn and Dusk Hollows (Lv 100).** Bring the four sigils to the gate at the bottom of the Diamond Throat. Beyond it, the eighth layer is split into a dawn half (Dawndosite, radiance crystals that blind) and a dusk half (Escuresite, umbral pools that slow and drain), and ends at the Heart Seal.
- **The dimensions (from level 100).** Each dimension is opened with its own **Emblem**, crafted at the Forge from the materials of the bosses of Dawnreach and the isles. Using an Emblem opens a portal in front of you for a minute. Every visit is a **run** with a fresh layout: it ends at the dimension's ruler, whose fall opens a portal home. Leaving by the way back, dying or recalling ends the run, and you return to where you opened the portal.
  - **The Endless Dungeon (Lv 100, Iron Key Emblem).** Floor after floor of cells and corridors. Each floor's stair is locked until you kill the Gaol Warden who carries the key. Some floors are Dark, Swarming, Elite or Trapped. Every fifth floor the **Iron-Hand Jailer** waits (chain hook, iron fist, cages, a prisoners' riot), stronger the deeper you go. Leave by any stair to keep what you found; your deepest floor is remembered.
  - **The Twin Slimes (Lv 110, Twin Gel Emblem).** Two lanes; each lane's gates open from levers in the other. Twin-bound creatures revive each other unless both fall within three seconds. **The Siamese**, fire and ice monarchs, fight side by side; when one falls, or both are worn to half, they merge for good into one slime of fire and ice, and that one must fall.
  - **The Corrupted King (Lv 125, Amethyst Crown Emblem).** A castle overgrown with Purple Adamite. Standing on it fills your corruption, which eats your health at full. Braziers and broken adamite cleanse it. **The Adamite King** raises corrupting pillars, throws his crown's shards, and in the end corrupts the whole throne room.
  - **The Mirrored (Lv 140, Looking-Glass Emblem).** Your Reflection walks the far side of a glass line. Gates open only while both of you stand on mirrored plates, and its side has walls yours does not. **You?** fights like your own class, splits into a decoy without a shadow, and casts your last skill back at you.
  - **The Dragons' Roost (Lv 160, Dragonfire Emblem).** A climb of plateaus over the void. Dragon breath sweeps the paths: hide behind the standing rocks. Nests hatch whelps if you linger. **Ragnarok, the Dragon God** strafes from the sky, then fights on the ground, then calls meteors and a closing ring of fire.
- **The Singular Heart (Lv 200).** Each ruler keeps one of five **Fracture Shards**. With all five, the Heart Seal at the bottom of the Dawn and Dusk Hollows opens into layer 9, where Singularita grows.
- **Lore.** Echo Stones on the island and in every layer tell the story of the Dawnforgers, Singularita and the Fracture. Lume, item descriptions and the bosses fill in the rest. The Journal collects everything you have found.

## Classes

| Class | Resource | Style | Weakness |
| --- | --- | --- | --- |
| Swordsman | Stamina | Three-hit combos, guard and a 0.25 s perfect parry, Lunge, Whirlwind, Sunder, War Cry, Earthsplitter, Blade Dance | No ranged options |
| Archer | Focus | Hold to charge (a full charge pierces), Steady Aim, Volley, Roll Shot, Pinning Arrow, Blast Arrow, Arrow Rain, Hawk Eye | Fragile; weaker at point blank |
| Mage | Mana | **Crowd control.** Homing bolts that burst over the pack and slow it, Channel, Flame Burst that throws foes back, Frost Nova that freezes a whole pack, Chain Lightning that stuns, Blink with a moment of sure evasion, an Arcane Barrier that shatters into ice, and the **Arcane Lance**, one enormous blow to a single foe | Cast times, low health, mana |
| Assassin | Energy | Fast stabs, double damage from behind, Mark, Shadowstep, Smoke Veil, Fan of Knives, Venom Edge, Execution, Dash Cut | Lowest health, weak against crowds |
| Stardust | Spirit | Manifests an **Astral**, a stand of starlight generated from your character's seed. It fights inside a leash, guards in orbit, can be posted as a Sentinel, and casts Comet Dive, Gravity Well, Starfall and Constellation Link | Spirit drains while the Astral is out. It breaks after a number of blows (4, plus one per 12 Spirituality, up to 20) whatever their strength; puddles on the ground pass through it. 30% of its wounds echo to you, and if it breaks it cannot return for 6 s |

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
| 8 | Dawndosite · Escuresite | Layer 8 (dawn · dusk) | Diamond pickaxe | Lv 100 | Radiant (blinding hits, healing on kills) · Umbral (crit damage, life steal on crits) |
| 9 | Chromantite | The dimensions' final chambers | Dawndosite/Escuresite pickaxe | Lv 180 | Chromatic: hits cycle burn, chill, shock and poison; afflicted foes take more |
| 10 | Singularita | The Singular Heart (layer 9) | Chromantite pickaxe | Lv 240 | Singular: **shape memory** and **Collapse** (see below) |

- **Gear.** Every class has a weapon, an armour and an accessory in every material, plus pickaxes, axes and boss uniques.
- **Level.** Level gates recipes and areas, never equipping.
- **Recipes.** They also need creature drops (Slime Gel, Echo Sinew, Bat Leather, Crawler Chitin, Ember Cores, Rime Shards, Prism Dust) and, from tier 3 accessories up, boss materials. Tier 8 gear needs materials from several isles: Skyglass, Abyssal Pearls, Obsidian and Living Amber, the isle creatures' drops and the guardians' materials. The isles also have their own accessories, and the Pearl Elixir cures poison, burns and bleeding.
- **Chromantite and Singularita.** Every Chromantite recipe needs Singularita Shards from the dimension rulers. Singularita gear is made of Singularita bound with the materials of every dimension. Each Singularita piece **remembers two traits** of any lower material (for example Ember and Rime, or Umbral and Featherweight). You choose them in the item's panel at the Forge and change them whenever you like. Every twelfth hit **collapses** into a small singularity that pulls foes in and bursts; a full Singularita set collapses every eighth hit.
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
js/systems/           pure rules: stats, progression, inventory, equipment, crafting, gathering, saves, settings, day/night, the horde and boss clock, travel, dimension runs, boss rewards, shape memory, objectives, fog
js/world/             grid, physics, interaction, isle phenomena, dimension rules, the tide, generators and validators (gen/)
js/render/            renderer, terrain mesher, props, sky, water, rigs and instancing, models, FX, camera
js/combat/            formulas, statuses, combat system, class kits
js/ai/                behaviours, flow field, creature manager, spawner, bosses
js/ui/                HUD, minimap, menus, touch controls, overlay, title screens
tests/                unit tests (node --test), a Playwright smoke test and the balance playtest bot
docs/design.md        the design of the full game and of this milestone
```

The world uses a fixed seed (`WORLD_SEED` in `js/world/gen/index.js`), so Dawnreach and the Hollow Deep are the same on every load. The tests pin a hash of every generated zone.

## Tests

From this folder:

```
npm test              # unit tests: data integrity, systems, world generation rules, combat maths, objectives, fog
npm run smoke         # browser smoke test (Playwright + Chromium): plays the opening loop, caves, both bosses, every class and touch
npm run playtest      # balance playtests: a bot plays every class through every dimension and reports how it went
```

The smoke test serves the repository itself and prints the folder where it saved its screenshots.

The playtest bot plays the real game with the player's own controls: it moves, locks on, attacks, casts its hotbar, drinks tonics and reacts to the warnings drawn on the ground after a human-like delay. Puzzles are solved for it; fights, hazards and rulers are played for real. Options: `--classes=archer,mage`, `--dims=dim_king,cave_9` (earlier zones such as `cave_3` or `isle_air`, and island bosses such as `boss:silverback_emperor`, work as references), `--skill=casual|skilled`, `--offset=10` (levels above each zone's entry level), `--bosses` (only the rulers) and `--runs=3`. It prints one line per run (outcome, time, damage taken by source, kills, XP and loot) and writes the details to a JSON file. For debugging, add `?debug` to the URL to expose the running game as `window.__SG`, and `?quickstart=<class>` to skip the title screen with a test character.
