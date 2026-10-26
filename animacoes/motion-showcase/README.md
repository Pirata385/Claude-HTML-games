# Motion Showcase

A looping motion design demo drawn on a single `<canvas>`. Nine scenes run for 7 seconds each, and each one wipes into the next with a different transition (iris, diagonal wipe, blinds, pixel dissolve, clock wipe and split).

| # | Style | What it shows |
| --- | --- | --- |
| 1 | Bauhaus | Primary shapes and kinetic type driven by elastic, back, bounce and expo easing |
| 2 | Fluxo Generativo | Particles following a vector field, with additive blending and fading trails |
| 3 | Pixel Art 8-bit | A 192×108 scene upscaled without smoothing: parallax, a 4-frame run cycle, coins and a CRT effect |
| 4 | Sumi-e | Ink brush strokes drawn progressively, plum blossoms opening, falling petals and a seal stamp |
| 5 | Synthwave | A perspective grid, a striped sun, neon glow and chrome lettering |
| 6 | Recorte de Papel | Layered paper cut-outs with drop shadows, animated "on twos" at 12 fps |
| 7 | Gooey / Metaballs | A scalar field rendered at low resolution and thresholded into lava-lamp blobs |
| 8 | Princípios Clássicos | Squash and stretch, anticipation and follow-through |
| 9 | Harmonógrafo | Damped Lissajous curves traced progressively |

## Controls

- **◀ / ▶** or the arrow keys jump between scenes. **Space**, the pause button or a click on the canvas pauses.
- Click the progress bar to seek. The controls fade out when the pointer is idle.
- **← Menu** goes back to the root menu, on the Animações tab.

## Code

Everything is in `index.html`. Each entry of the `SCENES` array has a `draw(ctx, t, w, h, dt)` function, where `t` is the scene's local time in seconds. `maskPath` holds the transition shapes.
