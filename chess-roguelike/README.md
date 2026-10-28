# Peões & Perdição

Chess as a roguelike. The pieces are real 3D models drawn as fine pixel art: the scene renders at low resolution, then gets a pixel outline, a limited desaturated palette and ordered dithering. The tone is dark and quiet, and the UI is in Portuguese.

Open `index.html` in a browser (or pick the game from the root menu). There is no build step and no image assets. Every piece, board, icon and effect is generated in code. The 3D engine ([Three.js](https://threejs.org) 0.160.0) loads from the jsDelivr CDN, so the first load needs an internet connection.

## How a run works

- **Pick a King.** Each one starts with a different army and amulet: *Rei Barrigudo* (the King has a shield), *Rei Mercador* (more gold) or *Rei Louco* (hopping pawns that promote at the middle of the board).
- **Three acts.** Each act is a branching map of about 7 floors with battles, elites, shops, events and campfires, and it ends in a boss:
  - Act I: **Torre Viva** summons a pawn every 3 turns.
  - Act II: **Rei Fantasma** has a King that can also jump like a Knight and starts with a shield.
  - Act III: **Rainha Vermelha** moves twice per turn.
- **Battles.** Turn-based chess on 6×6 to 8×8 boards with obstacles and pits. Before the fight you rearrange your troops on the marked rows, and pieces that don't fit wait on the bench. **Capturing the enemy King wins.** There is no check: if your King is captured, the run is over.
- **Permadeath.** Captured pieces leave your army for good. Promoted pawns stay promoted.
- **Rewards.** After each win you get gold and pick 1 of 3 rewards: a new piece, a mutation or an amulet.
- **Mutations** show as coloured bands on a piece's base: Saltitante, Marcha-ré, Passo Reto, Passo Torto, Galope, Escudo (a wireframe bubble), Explosivo, Vampiro.
- **Amulets** change the rules: Coroa de Ferro, Pergaminho da Ascensão, Pena de Fênix, Bolsa Gulosa, Trevo de 4 Folhas, Tambor de Guerra, Saqueador.

The run saves to `localStorage` at every map step. If you reload during a battle, that battle starts over.

## Controls

- Tap or click a piece to see its moves, then tap where it should go. Tapping an enemy piece shows its reach in amber.
- **Vista** in the battle HUD, or the **V** key, switches between the isometric camera and the **top-down view**. You can play fully from either one. In the top view the 3D models are hidden and every piece is shown as a flat pixel token with its silhouette (bone for yours, iron and red for the enemy); a blue-grey rim marks a shield and small coloured squares mark mutations.
- **Rotate the board** in the isometric view to any of 8 angles (front, back, both sides and the four diagonals) with the two arrow buttons in the HUD, the **Q** / **E** keys, or a horizontal drag on the board.
- **Menu** opens the pause menu: army, help, view, sound and abandon run.

## Files

| File | What it holds |
| --- | --- |
| `index.html` | Three.js scene (board, lathe/extruded pieces, lights, particles), pixel post-process shader, rotating camera and top view with pixel tokens, raycast input, pixel-sprite UI and all screens |
| `logic.js` | Pure game logic: move generation, mutations, boss rules, minimax AI, map/encounter/reward generation, seeded RNG |
| `tests/logic.test.js` | Logic tests: `node --test chess-roguelike/tests/*.test.js` |
