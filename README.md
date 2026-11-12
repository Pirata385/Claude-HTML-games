# Claude HTML Games

A collection of self-contained browser games. Open **`index.html`** at the repository root to reach the game menu, pick a game, and it starts running.

> **Working rule for AI assistants and contributors:** work only on the game folder that the current task is about. Ignore every folder unrelated to that project, and don't read, refactor or "tidy" other games. Update an existing game only when the user specifically asks for it. This keeps each task focused and avoids spending tokens on unrelated code. More detail is in [`CLAUDE.md`](CLAUDE.md).

## Games

| Game | Folder | Description |
| --- | --- | --- |
| Procedural Marine Bestiary | [`procedural-marine-bestiary/`](procedural-marine-bestiary/) | An infinite procedural ocean to explore. |
| Procedural Creature Explorer | [`procedural-creature-explorer/`](procedural-creature-explorer/) | An isometric pixel-art world with procedurally evolved creatures to discover, analyse, name and catalogue. |
| Xenospire — A Torre Infinita | [`xenospire/`](xenospire/) | A mobile-first isometric pixel-art arena fighter (in Portuguese): procedural beings with Spore-style animation climb an infinite space tower, drafting procedurally generated powers on destructible voxel floors. |
| Descents | [`descents/`](descents/) | A first-person 3D exploration game about descending into a vast, procedurally generated abyss of layers, caves, ruins, creatures and artifacts. |
| Procedurality-3D | [`procedurality-3d/`](procedurality-3d/) | An open-universe 3D observatory: drift through a seeded galaxy of stars, planets and ecosystems, and civilizations that rise, trade and war on their own. |
| Intergalactic Life | [`intergalactic-life/`](intergalactic-life/) | A 2.5D procedural space exploration, combat, trading and colonization game in a living galaxy of factions and aliens. |
| Peões & Perdição | [`chess-roguelike/`](chess-roguelike/) | A dark chess roguelike with 3D pieces drawn as fine pixel art, playable in isometric or top-down view (in Portuguese): a permadeath army, branching maps, piece mutations, amulets and three bosses. |
| Última Barricada (Last Barricade) | [`ultima-barricada/`](ultima-barricada/) | A zombie-survival RTS in isometric voxel pixel art, in Portuguese and English: scavenge seeded procedural cities, build and upgrade a base on a grid, manage food, ammo and fuel, and hold off ever larger night hordes. Endless with a score; mouse, keyboard and touch. |
| Singularita — The Broken Isles | [`singularita/`](singularita/) | A third-person 3D voxel RPG of exploration, combat and crafting: a seeded starter island with an endless day/night horde, a seven-layer cave from wood to diamond, five distinct classes, crafting with filters, four elemental isles with their own phenomena and guardians, five dimensions played as runs opened by crafted Emblems, twelve bosses, Chromantite and shape-shifting Singularita gear, a final fight with two endings and New Game+ (Ascension), saves; mouse, keyboard and touch (full screen on phones). |
| Niryk — Lendas do Planeta Partido | [`niryk/`](niryk/) | A 2.5D pixel-art roguelike in canvas 2D (in Portuguese) with Otherworld Legends style art (cel shading, dark scenes lit by lanterns and torches, chibi heroes) and Soul Knight / Binding of Isaac style rooms: five heroes with 4 abilities each (take 2 per run, with one of 3 passives or the base version; hold the button to aim), six procedurally generated worlds of 7–10 rooms (three per run) with 6 enemies each and a boss, four difficulties unlocked by winning, 25 weapons, 30 pieces of equipment, and a camp with codex, achievements, training ground and permanent upgrades; mouse, keyboard and touch, fullscreen and settings. |
| Filogênese — Sobrevivência Evolutiva | [`filogenese/`](filogenese/) | A top-down survival and evolution game in canvas 2D (in Portuguese and English): come ashore as a small creature, eat, befriend other species by singing and dancing or hunt them, collect DNA and reshape your body in a creature editor with 71 parts. Seeded procedural worlds (biomes, rivers, day/night, rain), 8 families and about 30 species per world across 12 ecological niches, fully procedural creature animation, packs, titans, migrations, objectives, achievements and an ending; synthesised sound, settings, three save slots; mouse, keyboard, touch and gamepad. |
| Amalgamations | [`amalgamations/`](amalgamations/) | An isometric 3D action RPG of fusion in square low-poly 3D (three.js, in English): pick a mother and a father from 23 animals, objects and weird things and play as their fusion (a dominance- and anatomy-aware blending algorithm, 506 ordered pairs plus mutations). An endless seeded world of 8 biomes with villages, ruins, camps, caves and dungeons with three-phase bosses, danger rising with distance; real-time combat with dodge rolls, telegraphed attacks, elites and statuses; 19 powers that fuse two at a time (342 combinations across 66 element combos); bound weapons, armour, rarities and legendaries, crafting and upgrades; levels, a 66-node skill tree with six starting roots, daily quests and goals. Mouse, keyboard, touch and gamepad; graphics presets, dynamic resolution, fullscreen and save slots. |

## Apps

The **Apps** tab holds tools rather than games. Each app has its own folder at the repository root, like a game.

| App | Folder | Description |
| --- | --- | --- |
| Cripta — Embaralhador de Imagens | [`cripta/`](cripta/) | A deterministic image scrambler (in Portuguese): shuffles pixels, tiles, rows and colours from a seed and an optional password, and restores the image pixel-perfect from the key (copied, saved as .txt or embedded in the PNG). Five styles, advanced options, verification and local history, on desktop and mobile. |
| Hexel — Pixels em Hexágonos | [`hexel/`](hexel/) | An image tool (in Portuguese) that turns the pixels of your photos into hexagons: 10 styles, palettes with dithering, colour controls, presets, before/after comparison and PNG/JPG/WebP/SVG export, all processed locally on desktop or mobile. |

## Animações

The menu has a third tab, **Animações**, for animations rather than games. They live under [`animacoes/`](animacoes/), one folder each.

| Animation | Folder | Description |
| --- | --- | --- |
| Motion Showcase | [`animacoes/motion-showcase/`](animacoes/motion-showcase/) | A motion design demo that cycles through nine art styles (Bauhaus, generative flow, pixel art, sumi-e, synthwave, paper cut-out, metaballs, animation principles, harmonograph). |
| Operação Vermelho | [`animacoes/bloons-sniper/`](animacoes/bloons-sniper/) | A one-minute Bloons TD6 fan short (in Portuguese): a tense rooftop sniper scene whose one perfect shot ends at a birthday party. |
| Raio × Sangue | [`animacoes/stickman-duel/`](animacoes/stickman-duel/) | A 90-second stickman fight (in Portuguese) between an electric fighter and a blood bender, with impact frames, hit-stop and synthesised sound effects. |
| Tico e a Geladeira | [`animacoes/rato-geladeira/`](animacoes/rato-geladeira/) | A comic and tragic cartoon short (in Portuguese): a rat fails to open a fridge in ever more ingenious ways, gets in at last, and is shut inside with a slice of cheesecake. |

## Structure

```
index.html                      menu with Jogos, Apps and Animações tabs (GAMES, APPS and ANIMATIONS registries)
README.md                       this file
CLAUDE.md                       instructions for AI assistants working in this repo
<game-or-app-folder>/
  index.html                    the game or app (self-contained: HTML, CSS and JS)
  README.md                     the game's own documentation
  tests/                        optional automated tests for the game's logic
animacoes/
  README.md                     list of animations
  <animation-folder>/
    index.html                  the animation (self-contained)
    README.md                   its documentation
```

Each game lives in its own dedicated folder, together with its code, assets and documentation.

## Playing locally

Open `index.html` directly in a modern browser, or serve the repository root with any static file server, for example `npx serve .`, and visit the printed address.

## Adding a game

1. Create a new folder named after the game, with an `index.html` entry point and a `README.md`.
2. Add an entry to the `GAMES` array in the root `index.html` so it appears on the menu.
3. Add a row to the **Games** table above.

To add an app, follow the same steps but register it in the `APPS` array instead of `GAMES` and add a row to the **Apps** table.

To add an animation, follow the same steps inside `animacoes/`, register it in the `ANIMATIONS` array instead of `GAMES`, and add it to the **Animações** tables (here and in `animacoes/README.md`).
