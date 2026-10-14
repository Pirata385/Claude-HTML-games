# Claude HTML Games

A collection of self-contained browser games. Open **`index.html`** at the repository root to reach the game menu, pick a game, and it starts running.

> **Working rule for AI assistants and contributors:** work only on the game folder that the current task is about. Ignore every folder unrelated to that project, and don't read, refactor or "tidy" other games. Update an existing game only when the user specifically asks for it. This keeps each task focused and avoids spending tokens on unrelated code. More detail is in [`CLAUDE.md`](CLAUDE.md).

## Games

| Game | Folder | Description |
| --- | --- | --- |
| Procedural Marine Bestiary | [`procedural-marine-bestiary/`](procedural-marine-bestiary/) | An infinite procedural ocean to explore. |
| Procedural Creature Explorer | [`procedural-creature-explorer/`](procedural-creature-explorer/) | An isometric pixel-art world with procedurally evolved creatures to discover, analyse, name and catalogue. |

## Structure

```
index.html                      game menu (add new games to its GAMES registry)
README.md                       this file
CLAUDE.md                       instructions for AI assistants working in this repo
<game-folder>/
  index.html                    the game (self-contained: HTML, CSS and JS)
  README.md                     the game's own documentation
  tests/                        optional automated tests for the game's logic
```

Each game lives in its own dedicated folder, together with its code, assets and documentation.

## Playing locally

Open `index.html` directly in a modern browser, or serve the repository root with any static file server, for example `npx serve .`, and visit the printed address.

## Adding a game

1. Create a new folder named after the game, with an `index.html` entry point and a `README.md`.
2. Add an entry to the `GAMES` array in the root `index.html` so it appears on the menu.
3. Add a row to the **Games** table above.
