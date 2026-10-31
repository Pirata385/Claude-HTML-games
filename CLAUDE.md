# Instructions for Claude (and other AI assistants)

This repository holds a collection of HTML games shown on a menu page (`index.html` at the root). Players pick a game from the menu and it starts running.

## Rules

- **Scope:** work only on the game folder that the current request is about. Ignore all folders unrelated to the current project; don't open, analyse or modify them.
- **Updates:** change an existing game only when the user specifically asks for that game.
- **One folder per game:** each game has its own dedicated folder containing its code, assets, `README.md` and any tests.
- **Menu:** when you add a game, register it in the `GAMES` array of the root `index.html` and add it to the table in the root `README.md`. That is the only cross-project edit a new game needs.
- **Apps:** tools that are not games (for example `pulso-daw/`, `hexel/`) have their own root folder like a game and appear in the menu's **Apps** tab. Register a new one in the `APPS` array of the root `index.html` and add it to the **Apps** table in the root `README.md`. The same scope rules apply.
- **Animations:** animations live in `animacoes/<animation-folder>/` and appear in the menu's **Animações** tab. Register a new one in the `ANIMATIONS` array of the root `index.html`, and add it to the tables in the root `README.md` and `animacoes/README.md`. The same scope rules apply: work only on the animation the request is about.

## Original instructions (moved here from the README)

> hello claude, we will be using this repository to build a collection of HTML games that will be displayed on a menu page, the player will choose which game they wanna play then the game starts running, each should have its own dedicated folder containing its assets, code and such. To prevent unnecessary token usage in the future, make it clear in the main README.md file that you should ignore all folders unrelated to the current project and only update a project when the user specifically requests it.
