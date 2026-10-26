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

## Animações

The menu has a second tab, **Animações**, for animations rather than games. They live under [`animacoes/`](animacoes/), one folder each.

| Animation | Folder | Description |
| --- | --- | --- |
| Motion Showcase | [`animacoes/motion-showcase/`](animacoes/motion-showcase/) | A motion design demo that cycles through nine art styles (Bauhaus, generative flow, pixel art, sumi-e, synthwave, paper cut-out, metaballs, animation principles, harmonograph). |
| Operação Vermelho | [`animacoes/bloons-sniper/`](animacoes/bloons-sniper/) | A one-minute Bloons TD6 fan short (in Portuguese): a tense rooftop sniper scene whose one perfect shot ends at a birthday party. |
| Raio × Sangue | [`animacoes/stickman-duel/`](animacoes/stickman-duel/) | A 90-second stickman fight (in Portuguese) between an electric fighter and a blood bender, with impact frames, hit-stop and synthesised sound effects. |

## Structure

```
index.html                      menu with Jogos and Animações tabs (GAMES and ANIMATIONS registries)
README.md                       this file
CLAUDE.md                       instructions for AI assistants working in this repo
<game-folder>/
  index.html                    the game (self-contained: HTML, CSS and JS)
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

To add an animation, follow the same steps inside `animacoes/`, register it in the `ANIMATIONS` array instead of `GAMES`, and add it to the **Animações** tables (here and in `animacoes/README.md`).
