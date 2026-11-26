# Água-Tinta — ASCII fishing & aquarium

A quiet, two-colour ASCII game about fishing and keeping an aquarium. Your grandmother Iara left you her old
aquarium — the tanks are empty and the sea is full. Fish five waters from a shallow bay down to the abyss, keep the
best catches, sell or release the rest, grow an aquarium that pays for better tackle, fill your field notebook,
and, on a stormy night in the abyss, meet the Ink Squid.

Everything on screen is drawn with text characters in two colours (ink on night, or ink on paper once you finish
the story). It runs offline from `file://`, on desktop and on phones (portrait or landscape), in English.

## How to play

1. **Cast.** Drag back from anywhere and let go (slingshot), or hold Space and release. The bait arcs out and sinks.
2. **Stop the bait** at the depth of the fish you can see: click, tap or press Space while it sinks.
3. **Wait.** Fish notice the bait, circle, and **nibble** (the line twitches) — do not strike yet.
4. **Strike** when the big **`!`** appears over the hook: click, tap or Space. Too early or too late and it flees.
5. **Fight.** Hold to reel. Watch the **tension** bar: keep it in the middle. When the fish runs to one side,
   **pull the rod the other way**. Each fight style has a tell you can see — a jumper shows `^` (ease off), a shaker
   rattles (keep the pressure), a runner shows `<<<` (counter-steer), a burrower heads for cover (steer it away).
6. **Land it** and choose on the catch card: **Keep** (goes to a tank), **Sell** (coins), or **Release**
   (+5 % luck in this water until you leave).
7. **Aquarium.** Kept fish earn ticket money over time. Feed the tank, set the light each species likes, add decor,
   and collect the **Tickets** button. Happy fish breed. Tap a fish for its card (name it, move it, sell it).
8. **Shop.** Better rods, lines, reels and hooks catch bigger fish; boats and a lantern open new waters.
9. **Goals** guide you (three at a time); the **Notebook** lists every species, where and when it bites, and the
   messages in bottles you snag along the way.

Time of day and weather change what bites. On the map, *Wait until…* skips to another part of the day.

## Controls

| Action | Mouse | Touch | Keyboard | Gamepad |
|---|---|---|---|---|
| Aim and cast | press, drag back, release | same | ← → side, hold **Space**, release | stick + hold A |
| Stop the sinking bait | click | tap | Space | A |
| Move a lure / resume sinking | hold to reel slowly / click | hold (@) / tap | hold Space / S or ↓ | RT / A |
| Strike | click | tap | Space | A |
| Reel in (fight) | hold left button | hold the **(@)** button | hold Space | RT |
| Rod angle (fight) | mouse left/right of the boat | drag sideways anywhere | A / D or ← / → | left stick |
| Fast retrieve | **R** or [Retrieve] | [Retrieve] | R | Y |
| Choose bait | [Bait] | [Bait] | B | X |
| Catch card: keep / sell / release | buttons | buttons | 1 / 2 / 3 | — |
| Switch tank | [<] [>] | swipe the tank | Q / E | — |
| Feed the tank | [Feed] | [Feed] | F | — |
| Pick a fish in the tank | click it | tap it | **,** / **.** then Space | — |
| Menus | click | tap | arrows, Enter, Esc | d-pad, A, B |
| Pause | [ ‖ ] | [ ‖ ] | Esc or P | Start |

The reel button sits on your dominant-hand side (Settings → Hand).

## Settings

All settings apply immediately and are saved in the browser.

- **Sound:** master, music, effects and ambience volumes; **Sound engine** (Auto / Web Audio / Compatible —
  Compatible plays through the browser's media player, for devices where Web Audio stays silent; Auto switches
  to it by itself when the Web Audio clock does not move).
- **Display:** quality (auto / high / medium / low — auto steps down on slow devices), motion (fluid or classic
  grid), reduce motion, glyph size, interface scale, theme (Paper unlocks when you finish the story), high
  contrast, show FPS, fullscreen (also a **Fullscreen** button on the title screen, hidden where the browser
  has no fullscreen support, such as Safari on iPhone).
- **Controls:** hand (reel button side), vibration, control hints, **Auto rod** (the rod steers itself during
  fights), **Wide windows** (a longer strike window).
- **Save:** export / import a save code, and reset (asks twice).

## Tips

- Sight-fish: sink the bait to the depth of a fish you can see, then let it come to you.
- Nibbles are not bites. Wait for the `!`.
- A screaming tension bar means stop reeling for a moment; a slack line lets the fish shake free.
- Releasing fresh catches builds luck in that water (up to 25 %) — useful when hunting a rare.
- Match each tank's light and decor to what its fish like; a happy tank earns more and breeds.
- Some fish only come out at night, at dawn, or in rain. The map shows a weather forecast.
- Messages in bottles hint at the legendary fish.

## Run

Open `index.html` in a browser (Chrome, Firefox or Safari). It works offline from `file://`; no server or build
step. The game saves to `localStorage` automatically. Add `?debug=1` to the URL for the `AQ.debug` console helpers
(`AQ.debug.help()`), and `?autostart=1` to skip the start tap (automated tests; audio then unlocks on the first
tap).

## Audio

Every sound is a recorded MP3 in `audio/` (`music/`, `sfx/`, `jingles/`, `ambience/`; about 7.5 MB): 9 themes, a
night take of each of the five waters (also used in storms), a fight stem per water (drums + bass, same tempo, its
loop divides the theme's so it plays in sync and follows the line tension), the reel loop, three ambience loops and
38 effects / jingles. `js/data/audio-manifest.js` lists them (file, kind, level, exact loop points, tempo).

- **Loading screen.** At boot the game fetches the files (the short ones and the title theme are decoded, the
  other music is decoded when needed) with a progress bar, then shows **[ Tap to start ]**. That tap starts audio
  (mobile browsers only allow it inside a tap) and opens the title. A failed file or a load stuck for 15 s never
  blocks: you can start without some sounds.
- **Playback.** Web Audio sample player (`js/audio/`): buses for music, effects and ambience, a compressor and
  limiter, gapless loops (`loopStart`/`loopEnd` skip the MP3 padding), crossfades between moods.
  From `file://` (where browsers block `fetch`) it falls back to plain `<audio>` elements with simpler mixing.
- **Re-rendering.** The sounds are made by the game's original 16-bit synth (FM / pulse voices, SNES-style echo),
  kept in `tools/audio-render/`. `node aquario-ascii/tools/audio-render/render.js [id …]` renders them on an
  OfflineAudioContext in headless Chromium (Playwright), encodes with ffmpeg, checks every loop seam after decoding
  and rewrites the manifest. Edit the themes / recipes in `synth-music.js` / `synth-sfx.js`.

**Android:** `android/` builds an installable APK of the game (`ANDROID_HOME=… android/build.sh`); see
`android/README.md`.

## Tests

```sh
node aquario-ascii/tests/run.js              # all tests (exits non-zero on failure)
node aquario-ascii/tests/run.js store rng    # only files whose name contains a filter
node aquario-ascii/tests/balance-report.js   # fight balance per species + the pacing simulation (not a test)
node aquario-ascii/tests/balance-pacing.js 10 210   # 10 pacing bots for 210 minutes
```

Tests load the pure modules (`js/core`, `js/data`, `js/logic`) in Node through `tests/loader.js`, in the script
order of `index.html`.

## Files

| Path | What lives there |
|---|---|
| `index.html` | the page; classic scripts in a fixed order (no modules, so it works on `file://`) |
| `css/` | page and overlay styles (only the two theme colours, as variables) |
| `fonts/` | JetBrains Mono NL (woff2) and its licence |
| `js/core/` | namespace, utilities, seeded RNG, event bus, i18n, save store |
| `js/data/` | strings, sprites and art, species, zones, items, goals |
| `js/logic/` | pure game logic: world clock and weather, spawning, creatures, line, bite, fight, economy, aquarium, progress, game state |
| `js/engine/` | display, glyph atlas, renderer, effects, input, scenes, performance, loop, debug |
| `js/audio/`, `js/platform/` | sample player (music, effects, ambience), haptics |
| `audio/` | the recorded sounds (MP3), listed in `js/data/audio-manifest.js` |
| `tools/audio-render/` | the synth and the script that records `audio/` (not loaded by the game) |
| `js/ui/` | DOM overlay: loading screen, HUD, modals, menus, shop, notebook, cards, goals, tutorial |
| `js/scenes/` | title, map, fishing, aquarium, ending |
| `tests/` | Node test runner, tests and balance tools |
| `android/` | Android wrapper (WebView app) and its build script for the APK |
| `DESIGN.md` | the full design document |

## Credits

Design and code: built for this collection with Claude.
Font: [JetBrains Mono](https://www.jetbrains.com/lp/mono/) NL, © The JetBrains Mono Project Authors, used under
the SIL Open Font License 1.1 — see [`fonts/LICENSE-JetBrainsMono.txt`](fonts/LICENSE-JetBrainsMono.txt).
Music and sound: synthesised for this game (`tools/audio-render/`) and recorded to `audio/`.
