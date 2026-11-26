# ÁGUA-TINTA — Design Document (`aquario-ascii/DESIGN.md`)

> Folder: `aquario-ascii/` · Title: **Água-Tinta** · Subtitle: *pesca e aquário em ASCII* · Design v1.0 · UI language: pt-BR by default, English as an option.

> **Scope change (binding, overrides everything below): the game is ENGLISH ONLY.** All UI text is English, registered with `AQ.i18n.add('en', …)`. There are no pt-BR tables, no language setting, and test-i18n checks only the English table. pt-BR strings quoted in this document are examples to render in English. The title *Água-Tinta* is kept as a proper name.
> Audience: the build team (agents A–E, QA, critic). Everything here is binding unless marked *(tunable)*. If you change a contract, update this file in the same commit and tell the other agents.

---

## 0. Pitch

You inherit Vó Iara's old seaside aquarium: empty tanks, and a notebook with missing pages. The sea outside is drawn in ink: warm beige glyphs on near-black. You fish five waters, reading the line and the fish you can actually see. Each catch is a choice: keep it in a living tank that pays you, breeds and makes pearls; sell it for gear; or release it for luck. At the bottom of the Abyss, on a stormy night, the creature that "wrote the sea" is waiting. A session can be two minutes long (collect the till, feed the fish, land two catches) or two hours (all five waters, a 4-star aquarium and the ending).

**Title.** *Água-tinta* is Portuguese for *aquatint*, the printmaking technique that makes tonal areas from acid-bitten ink. That is exactly how this game shades: through ink density and alpha, never through hue. Read literally it means "water-ink". The alternative title is *Linha d'Água* ("waterline"; *linha* means both a fishing line and a line of text). We chose Água-Tinta.

## 1. Design pillars (every feature must serve at least one)

1. **Ink on the dark.** Two colours only. Light, depth and emphasis come from glyph choice, density and alpha.
2. **Read the water.** Fish are visible, so you aim at the one you want. In a fight, the fish, the line and the glyph tells tell you what to do. It is never a blind timing bar.
3. **Every catch is a choice.** Keep (ongoing income and collection), sell (coins now) or release (luck).
4. **A living tank.** The aquarium is a small system with its own outputs, not a trophy shelf.
5. **Two minutes or two hours.** There is always something worthwhile to do within 120 s, and a clear long arc.

---

## 2. Visual language

### 2.1 Palette (the only colour literals allowed in the codebase)

| Theme | Background | Ink |
|---|---|---|
| `noite` (default) | `#0e0d0b` | `#e9dfc7` |
| `noite` + high contrast | `#050504` | `#f7f0de` |
| `papel` (unlocked by the ending) | `#e9dfc7` | `#0e0d0b` |
| `papel` + high contrast | `#f7f0de` | `#050504` |

Rules:
- Canvas and CSS use only `AQ.theme.bg` and `AQ.theme.ink`, plus alpha. CSS reads them through variables `--bg`, `--ink`, `--bg-rgb` and `--ink-rgb`, which A sets on `:root`. Alpha is written as `rgb(var(--ink-rgb) / .5)`.
- The only "highlight" is **inversion**: ink background with bg-coloured text (focused buttons, the selected tab, the reel button while held).
- QA greps for `#[0-9a-f]{3,6}` and `rgb(`. Matches are allowed only in `js/core/ns.js` (the theme table) and `css/style.css` fallbacks.

### 2.2 Ink tones: 16 quantised alpha levels

Every draw call takes an integer **level** from 0 to 15, never a raw alpha. Levels map to alpha through `AQ.render.ALPHA`.

| Level | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| alpha | 0 | .06 | .10 | .14 | .19 | .24 | .30 | .36 | .43 | .50 | .58 | .66 | .75 | .84 | .92 | 1 |

| Band | Levels | Used for |
|---|---|---|
| Névoa (fog) | 1–3 | water texture, distant light rays, marine snow, silhouettes |
| Meia-tinta (half-ink) | 4–7 | terrain, plants, far creatures, inactive UI |
| Tinta (ink) | 8–11 | lit creatures, the line, decor |
| Tinta cheia (full ink) | 12–15 | the hooked fish, tells, HUD text, cursor |

Hard rules: background textures never go above 5. A lit creature is at 9 or higher. HUD text is at 12 or higher.

**High contrast** remaps every level: `l' = l === 0 ? 0 : min(15, round(4 + l * 11 / 15))`. It also disables pure-decoration texture layers (rays, snow).

### 2.3 Glyph set

- **Sprites and textures:** printable ASCII (0x20–0x7E) plus this Latin-1 whitelist: `° · ´ ¨ ¯ ¸ × ÷ « » ¦ ø º ¬`.
- **Text:** the above, plus pt-BR letters `ÁÂÃÀÇÉÊÍÓÔÕÚÜáâãàçéêíóôõúü` and `ª ¿ ¡ © §`.
- No box-drawing or block characters (U+2500+). They break the ASCII feel and font coverage. Frames use `+ - | _ . ' \``.

Ramps (exact strings in `AQ.render.RAMPS`; index 0 is the "empty" end):

| Name | String | Use |
|---|---|---|
| `density` | `" .·:-=+*#%@"` | general shading, ink clouds, coral |
| `water` | `" .-~="` | surface and turbulence |
| `wave` | `"_.-~^'"` | the surface line, chosen by slope and height |
| `light` | `" .·:"` | caustics, light |
| `sand` | `" .,:;"` | sea floor |
| `bubble` | `"·°oO"` | bubbles, grown as they rise |
| `foam` | `".,'\"*"` | splash and foam |
| `ink` | `" .:*#%@"` | octopus and squid ink |
| `snow` | `" .·'"` | marine snow |
| `rain` | `"\|'/,"` | rain streaks |

### 2.4 The fluidity decision

We combine four techniques. Each solves a different problem.

1. **Environment = luminance fields rasterised to ramps, strictly on the grid.** Water, light, sand, fog and rain are continuous functions sampled per cell at `bgHz` (12–30 Hz). Glyph = `ramp[floor(v·(n-1))]`. Level = `base · (0.75 + 0.25·frac)`, where `frac` is the fractional part of `v·(n-1)`, so a cell brightens smoothly before it switches glyph. This is the ASCII "page": it never moves off-grid.
2. **Living things = "movable type".** Creatures, the hook, the line and particles keep continuous world positions and are drawn at the exact (device-pixel-rounded) position. Logically every sprite glyph still belongs to a cell: occlusion, hit tests and knockout use cells. Visually each glyph is offset from that cell by the sub-cell remainder plus a per-glyph deform: body wave, bell pulse, plant sway, line jitter. At 60 fps with integer device-pixel steps this reads as true motion. Per-glyph deform is what makes the ASCII feel alive: a fish's tail lags its head, kelp tips sway while the base stays put.
3. **Knockout.** Before a sprite's glyphs are drawn, the cells it covers are painted in bg colour at alpha .92 (one rect per row span). Water glyphs never collide with fish glyphs, and fish read as dark silhouettes cut out of the water texture.
4. **Sub-row camera on the bg layer.** When the fishing camera scrolls vertically, the bg grid is drawn with a row-snapped camera, and the fractional remainder is applied as a CSS `translate3d` on the bg canvas, which is 2 rows taller than the view. Scrolling is GPU-smooth and costs nothing per cell.

A **"Grade clássica"** setting (`motionStyle: 'grid'`) snaps every sprite to cells and disables deform, giving the asciiquarium look for purists. Gameplay is identical.

Why not a fine grid? Smaller glyphs make sprites unreadable on phones and multiply the cell count. Why not rasterise creatures as luminance too? It destroys hand-made ASCII art, which is the soul of the bestiary.

### 2.5 Composition rules

- Depth fog: creature and terrain level × `fog = 1 − 0.55·depthFrac` in lit water.
- Darkness (night, or the abyss): visibility comes from the lantern radius and from glow cells. Unlit non-glowing things drop to level 1. See §5.4.
- Sprites face right in the data. Left-facing is the mirrored version (§6.6). Glyphs are never rotated.
- Rare creatures shimmer: one random glyph shows as `*` for 0.1 s every 0.6–1.2 s. Dense variants are drawn **bold** with densified glyphs. Legendaries have a halo of `.` glyphs at level 2.

---

## 3. Game structure

### 3.1 Core loop

```
  +------------------+   choose water, time, bait    +-----------------+
  |  MAP (hub)       | ----------------------------> |  FISH           |
  |  zones/forecast  |                               |  aim-cast-sink  |
  +------------------+                               |  bite-strike    |
        ^      ^                                     |  fight-land     |
        |      | coins, pearls, bait (shrimp)        +--------+--------+
        |      |                                              | specimen
  +-----+------+-----+    keep  (capacity!)          +--------v--------+
  |  AQUARIUM        | <---------------------------- |  CATCH CARD     |
  |  income, breed,  |                               |  keep/sell/rel. |
  |  pearls, stars   | ---- stars unlock decor, ---> +--------+--------+
  +------------------+      Black Pearl                  sell | release (luck)
        |                                                     v
        +------------> SHOP: gear (reach / fight), boats (zones), tanks
```

### 3.2 Session loops

- **Two minutes.** On load, a "while you were away" card shows offline till and pearls. Collect the till (one tap with a coin shower), feed one or two tanks (one tap each), fish 2–3 catches (30–50 s each), keep or sell, buy one thing. Autosave.
- **Twenty minutes.** Unlock a zone, chase a rare under the right time or weather (check the forecast, use "Esperar até…"), redecorate a tank to raise happiness, finish 2–3 goals.
- **Two hours.** Five waters, 42 species and 3 sightings, aquarium stars 1→4, legendaries, the Lula-Tinteira and the ending. Post-game: 100% notebook, Tinta Densa variants, ★5, records.

### 3.3 Long arc and ending

1. **Shallows** (0–12 min): learn cast, bite, fight, keep. First tank.
2. **Reef** (12–35): side pressure (runners), line length (bottom species), decor and happiness.
3. **Kelp** (35–70): cover-seeking burrowers, divers, night fishing, second tank, breeding.
4. **Open Sea** (70–115): big runners and jumpers, weather, sightings, the Marlin, frenzies.
5. **Abyss** (115–150): darkness and the lantern, glow creatures, the Coelacanth. Reaching ★4 lets the shop sell the **Pérola Negra** bait.
6. **Ending.** Abyss, at night, in a storm, with the Pérola Negra bait: the **Lula-Tinteira** boss. Once landed she cannot be kept. She is released, the sea fills with ink, the screen inverts (paper theme) for the credits, and your caught species drift by. Vó Iara's last note: *"Toda tinta volta para o mar. Obrigada por devolver a minha. — I."* This unlocks the **Papel** theme. The game continues.

### 3.4 Why each mechanic exists

| Mechanic | Earns its place because |
|---|---|
| Visible fish (sight fishing) | Removes passive waiting; adds aim and target choice |
| Bait affinities | A cheap, readable decision before each cast |
| Fight styles + tells | Skill expression; species feel different; avoids a QTE |
| Line length | Turns gear into "reach" (deep species) as well as power |
| Lantern | Makes darkness a mechanic, done purely with alpha |
| Time and weather | Gives the map a reason; anticipation; forecast planning |
| Keep / sell / release | The central economic choice; capacity makes it bite |
| Tank happiness (food, space, decor, light, harmony, filter) | Gives decor, tank layout and light a purpose |
| Income and till | Return incentive, idle reward, and money for the next zone |
| Breeding | A long-term collection path (dense variants) and baby fish (charm) |
| Pearls (oyster decor, firsts, goals) | Ties the aquarium to special baits and the ending |
| Stars | A visible aquarium goal that gates decor and the ending |
| Bottles and messages | Diegetic hints for rare conditions, plus story, at low cost |
| Frenzy | A burst of excitement inside 2-minute sessions |
| Sightings | Awe moments, ethical non-catchables, completion % |
| Goals chain (3 visible) | Constant direction without a quest log |

---

## 4. Fishing

### 4.1 Scene layout (world units, see §15.6)

- The world is a vertical slice. Width equals the view in columns (`cols`); height is the zone depth (`zone.depth`, 70–320 u). `y = 0` is the mean water surface. Sky is negative y.
- The boat sits on the surface at `x = 0.5·cols` in portrait and `0.3·cols` in landscape. You can cast left or right.
- The camera follows the hook vertically with a critically damped spring (`damp λ = 6`), clamped to `[−skyRows·2, zone.depth − viewHeight + 4]`. There is no horizontal scroll.
- On a resize or orientation change mid-scene, x positions scale by `newCols/oldCols`. Never reset state.

### 4.2 Phases and controls

| Phase | Mouse | Touch | Keyboard | Gamepad | Effect |
|---|---|---|---|---|---|
| `idle` → `aiming` | press on canvas, drag **back**, release | same | ←/→ pick side, hold **Space** to charge (0→1 in 1.2 s), release | stick sets direction, hold A | slingshot aim, then cast |
| `flying` | — | — | — | — | hook arcs out, line pays out |
| `sinking` | click | tap canvas or the (@) button | Space | A | stop the hook (hold depth) |
| `waiting` | **hold** LMB = reel slowly (moves a lure); click = resume sinking | hold (@) = reel; tap = resume sinking | hold Space = reel; S/↓ = sink | RT/A | position the bait; animate the lure |
| `nibble` / `bite` | click | tap canvas or (@) | Space | A | **strike** (see §4.6) |
| `fight` | hold LMB = reel; **mouse x relative to the boat = rod angle** | hold (@) = reel; **drag horizontally on the canvas = rod** (relative) | hold Space = reel; A/D or ←/→ = rod | RT = reel; left stick x = rod | §4.7 |
| any but `fight` | R or [Recolher] | [Recolher] | R | Y | fast retrieve (3× reel speed) |
| `idle` | B or [Isca] | [Isca] | B | X | bait picker |
| any | Esc or [‖] | [‖] | Esc / P | Start | pause |

- Touch "drag" in a fight: `rod += dx / (0.3 · viewWidthPx)`, clamped to ±1. The rod holds its value when the finger lifts.
- Keyboard: the rod moves toward ±1 at 3/s while a key is held and returns to 0 at 1.5/s when released.
- Mouse: `rod = clamp((mouseX − boatX)/(0.3·viewWidthPx), −1, 1)`.
- The (@) reel button is an E-owned HTML button (≥ 88 px, bottom corner on the dominant-hand side). It drives `AQ.input.virtual.press/release('primary')`.

### 4.3 Cast

- Slingshot: `power = clamp(|drag| / (0.35·min(viewW, viewH)), 0, 1)`. Direction is opposite to the drag. A drag shorter than 12 px cancels.
- Preview: dotted arc `. · .` at level 6 showing the landing point, plus a power ring around the boat built from the `density` ramp.
- Landing x = `boatX ± (6 + power·(castMax − 6))`, clamped inside the view with a 3-column margin. `castMax` comes from the rod (§8.2).
- Flight: ballistic from the rod tip, launch angle 50°, gravity 60 u/s². Flight time is about 0.6–1.2 s. The line pays out as a verlet rope.
- Splash: `fx.emit('splash')`, a surface ripple impulse, `fish:splash` audio, and a light haptic.

### 4.4 Sink and depth

- Sink speed ramps from 10 u/s to 30 u/s over 1.5 s (terminal). Lures sink at 0.8×.
- The hook stops at the zone floor (`floorY(x)`), at line length `maxLen − 4`, or when the player stops it.
- The depth ruler on the right edge shows metres: `depthM = y · zone.mPerUnit`.
- First-cast tutorial assist: the hook stops automatically at the scripted school's depth.

### 4.5 Baits, lures and attraction

| id | Kind | Notes |
|---|---|---|
| `massa` | bait, **infinite** | weak; plankton eaters love it (manta) |
| `minhoca` | bait | generalist |
| `camarao` | bait | reef and small predators; also produced by kept shrimp |
| `lula` | bait | big fish, eels, night predators |
| `luminosa` | bait | glows: ×1.5 notice radius in darkness; abyss favourite |
| `colher` | lure (permanent) | predators; bites only while **moving** (reeling) |
| `jig` | lure (permanent) | deep predators; moving; the Coelacanth |
| `papel` | special bait | for the Typefish only; unlocked by message m3 |
| `perola` | special bait (Pérola Negra) | for the Lula-Tinteira only; unlocked at ★4 |

Hook glyph `J`, with a bait glyph drawn beside it: `massa o`, `minhoca ~`, `camarao ,`, `lula =`, `luminosa *` (pulsing level), `colher <>` (flashes while moving), `jig >=`, `papel #`, `perola @`.

**Notice model** (B, in `creatures.update`):
```
affinity      = species.baits[bait] || 0            // 0 → ignores hook
staticLurePen = (isLure && !hook.moving) ? 0.2 : 1  // predators want motion
radius        = SENSE[behavior] * affinity * (hook.moving&&isLure ? 1.6 : 1)
                * (env.dark && bait==='luminosa' ? 1.5 : 1) * (frenzy ? 2 : 1)
SENSE = {school:10, dart:12, cruise:14, lurk:6, drift:4, crawl:6, burrow:5, hover:5, leap:10, ambient:0}
per second inside radius: P(notice) = min(.95, .6 * affinity * staticLurePen)
```
A noticing fish switches to `investigate`: it approaches at 0.6× speed and circles for 0.5–1.5 s. It then nibbles `n = rng.int(wariness+1)` times, 0.6–1.2 s apart, then bites. Only one fish can be engaged at a time. Others keep circling.

### 4.6 Bites

- **Nibble** (`bite:nibble`): the hook jitters by ±0.3 cell, the line shows one `'` twitch, a soft tick plays, and a 10 ms haptic fires. **Striking on a nibble** counts as early: the fish is spooked (flees, ignores hooks for 8 s), and its school is spooked for 4 s.
- **Bite** (`bite:strike`): the fish lunges onto the hook. The line snaps taut, a bold `!` appears above the hook for the whole window, a deep "tok" plays, and a 30 ms haptic fires. Window = `species.biteWindow + gear.window`, ×1.5 with `wideWindows`. The tutorial sets it to 2.0 s.
- Strike inside the window → `hooked`. Strike late, or never → the fish leaves; a non-infinite bait is consumed with p = .5.
- Hook class: if `gear.hookClass < species.hookMin`, the fight runs with **slip risk** (each tell has a 15% chance of escape `slip`). A warning appears in the card: "Anzol pequeno demais".

### 4.7 Fight model (pure, deterministic, `js/logic/fight.js`, fixed `dt = 1/60`)

**Inputs** each step: `{reel: boolean, rod: number in [−1, 1]}`.
**Gear**: `Ls` line strength, `maxLen`, `snapGrace`, `reelSpeed`, `riseRate`, `St` steer, `H` hook hold (§8.2).
**Fish**: `P` power, `stam` stamina in seconds, `V` speed in u/s, `tell` in seconds, `style`, `special`, and `sz = 0.75 + 0.5·q` (q is the specimen's size quality).
**State**: position `(x, y)` relative to the rod tip (y down), `S` stamina (1 → 0), `T` tension (0..~1.5), `state`, `next`, `dirX`, timers.

```
CONST = { ZONE_LO:.35, ZONE_HI:.85, SLACK:.12, IDLE_LOAD:.4, STEER_T:.3, STEER_DRAIN:.8,
  ROD_PULL:2.5, FALL_RATE:4, GAIN_DIV:1.6, GAIN_MIN:.1, FRESH_GAIN:.45,
  DRAIN_LOW:.3, DRAIN_HIGH:.6, REST_DRAIN:.6, RECOVER:.25,
  SLACK_BASE:.8, SLACK_HOLD:.6, THROW_BASE:.55, THROW_HOLD:.25, THROW_TIME:.15, TEAR_TIME:.4,
  AIR_TIME:.8, AIR_PM_REEL:.9, AIR_PM_IDLE:.375, LAND_DIST:3, LOOSE_TIME:20,
  FRAY_RATE:.6, FRAY_DECAY:.2, COVER_DIST:3, SLIP_CHANCE:.15 }

PULL_MUL = { rest:.25, pull:.75, run:1, dive:1.1, rise:.4, jump:.2, shake:.6(+.35·sin(2π·5t)),
             burrow:.9, grip:1.3, drift:.3, tell:.5, inflate:1.6, roll:.15 }

step(fs, inp, dt):
  advance state machine (§4.8); a state needing a tell first enters 'tell' for species.tell s
  v  = V * (0.4 + 0.6*S)                                   // tired fish are slow
  velocity by state: run → (dirX·v, uy·0.3v) | dive → (0, v) | rise → (0, −.5v)
     pull/burrow → radial out 0.6v (burrow: toward nearest cover point instead)
     rest → radial out .15v | drift → random ±.2v | shake → (sin(30t)·2, 0) | grip/roll → 0
     jump → rise at −2v to y≤.5, then airborne AIR_TIME (sprite above the surface), then y=3 → rest
  pm = PULL_MUL[state]; if airborne: pm = inp.reel ? AIR_PM_REEL : AIR_PM_IDLE
  F  = P * sz * pm * (airborne ? 1 : (0.35 + 0.65*S))
  steerDir = state∈{run} ? dirX : state∈{burrow} ? sign(cover.x − x) : 0
  counter  = clamp(−inp.rod * steerDir, −1, 1)              // +1 = rod opposes the fish
  steerMul = 1 − STEER_T * counter * St
  targetT  = F * (inp.reel ? 1 : IDLE_LOAD) * steerMul / Ls
  T += (targetT − T) * (1 − exp(−dt * (targetT > T ? riseRate : FALL_RATE)))
  gain = inp.reel ? clamp(1 − F/(Ls*GAIN_DIV), GAIN_MIN, 1) * (FRESH_GAIN + (1−FRESH_GAIN)*(1−S)) : 0
  if !inp.reel && F < .2: remove the outward radial velocity component (drag holds a weak fish)
  pos += (vel − û·reelSpeed·gain + (inp.rod·ROD_PULL·St, 0)) * dt
  clamp y to [airborne ? −4 : 0, floorY(x_world)];  clamp |x| to 1.5·viewCols
  L = |pos|
  stamina: if T < SLACK: S += RECOVER/stam*dt
           else S −= (T in [ZONE_LO,ZONE_HI] ? 1 : T<ZONE_LO ? DRAIN_LOW : DRAIN_HIGH)
                     * (1 + STEER_DRAIN*max(0,counter)*St) * (state==='rest' ? REST_DRAIN : 1) / stam * dt
  failures (first to trigger ends the fight with event {type:'end', result}):
    T ≥ 1 accumulates snapT (decays 2·dt otherwise); snapT > snapGrace          → 'snap'
    state∈{run,shake,pull} && T < SLACK for > SLACK_BASE + SLACK_HOLD·H     → 'slack'
    airborne && T > THROW_BASE + THROW_HOLD·H for > THROW_TIME              → 'thrown'
    special.tear && T > tear for > TEAR_TIME                                → 'tear'
    burrow within COVER_DIST of cover: fray += FRAY_RATE·dt (else −FRAY_DECAY); fray ≥ 1 → 'fray'
    L > maxLen                                                              → 'spooled'
    no reel input for LOOSE_TIME s                                          → 'loose'
    slip risk: on each tell, rng < SLIP_CHANCE                              → 'slip'
  success: L < LAND_DIST && inp.reel                                        → 'landed'
```

**Autopilot** (used by tests, by `autoSteer` for the rod only, and by `AQ.debug`):
```
k = state==='tell' ? next : state
strong = k ∈ {run, dive, grip, burrow}
reel = T < (strong ? .55 : .72) && k !== 'jump' && !airborne && !(tear && T > tear − .15)
rod  = (state ∈ {run, burrow}) ? −steerDir : 0
```

**Reference results.** The designer prototyped this model with the constants above, 200 seeds each:
- Autopilot with recommended gear lands 100% of commons (about 10 s), uncommons (13–25 s), rares (25–35 s) and legendaries (Marlin about 40 s, Coelacanth about 63 s, Tinteira about 83 s).
- "Always reel, rod 0" snaps or throws 20–100% of uncommon and better fish.
- "Never reel" never lands.
- One gear tier below recommended still lands most fish in range, but slower, and spools deep ones (line too short). Gear helps; skill compensates.

### 4.8 Fight styles and tells

| Style | State weights (picked when a state ends) | Durations (s) | Correct response | Species |
|---|---|---|---|---|
| `puller` | pull .55, rest .30, run .15 | pull 1.5–3, rest 1.2–2.2, run 1.5–3.5 | reel in rests, ease off in pulls | arraia, papagaio, sargo, manta, diabo |
| `runner` | run .55, rest .25, pull .20 | run 1.5–3.5 (dir flips 70%) | **rod opposite**, don't reel on fresh runs | agulha, cirurgiao, cavalinha, atum, martelo, vibora |
| `diver` | dive .45, rise .25, rest .30 | dive 1.5–3, rise 1–2 | release on dives, reel on rises | congro, pelicano |
| `jumper` | run .35, jump .30, rest .35 | jump airborne 0.8 | **release while airborne** | tainha, voador, dourado |
| `shaker` | shake .50, pull .25, rest .25 | shake 1.5–3 | **keep tension** (pulse reel) | manjuba, palhaco, leao, machado |
| `burrower` | burrow .50, pull .25, rest .25 | burrow 1.5–3 | steer away from cover, reel hard | moreia, escorpiao, garoupa |
| `deadweight` | pull .50, grip .20, rest .30 | grip 2–4 | wait out grips, steady reel | siri, lagosta, aranha, isopode, lua, ermitao |
| `drifter` | drift .70, rest .30 | drift 1.5–3 | **gentle** (T below the tear limit) | camarao, cavalo, aguaviva, caravela, atolla |
| `inflater` | as puller + one `inflate` (4 s) when S < .7 | | reel slowly while inflated | baiacu |
| `inker` | run .50, rest .30, pull .20; ink on entering a run (p = special.inkChance) | ink 2.5 s | steer by the line angle and meter | polvo, lula, vampira |
| `boss` | phase table below | | mix | marlim, celacanto, tinteira |

Boss phases (switch at S thresholds; tells ×0.85 in the last phase):
- `marlim`: S > .66 runner → .66–.33 jumper → < .33 *frenzy* (run .45, jump .35, rest .20).
- `celacanto`: diver → deadweight with grip → runner (V × 0.7). riseRate × 0.8 (slow and steady).
- `tinteira`: diver → inker (inkChance 1, ink radius 18 u, covers about 40% of the view) → *tentacles* (shake .45, grip .35, rest .20, plus 3 tentacle sprites gripping the line). Under 10%, she rises; landing triggers the ending.

Specials: `inflateAt:.7` (baiacu); `grip:true` (arraia near the floor, polvo, ermitao, aranha); `roll:true` (isopode: occasional `roll` state, an easy reel); `inkChance` (polvo .4, lula .5, vampira .5 with `glowInk` that sparkles `*` instead of a dark cloud); `tear` (camarao .6, cavalo .5, aguaviva .5, caravela .35, atolla .45); `scramble:true` (tipografo: on each shake its letters scatter; cosmetic); `alarm:true` (atolla: a ring flash when hooked; cosmetic).

**Tells (shown for `tell` seconds before the state starts)**

| Kind | Visual (glyphs at level 13–15) | Audio | Haptic |
|---|---|---|---|
| run | `!` above the fish; then `<<<` or `>>>` streaks behind it; the line swings | drag "zzz" rising | 20 ms |
| dive | bubbles `°o` rising from the fish; the line goes `\|` | low thump | 30 ms |
| jump | surface bulge `^^` and a ripple ring above the fish; `!` | water swell | 2 × 15 ms |
| shake | `)))` / `(((` alternating along the line near the fish | rapid ticks | 10 ms ×3 |
| burrow | the target cover pulses (level oscillates 5↔10) | gravel scrape | 20 ms |
| grip | `#` dust puff at the floor; the fish freezes | creak | 40 ms |
| ink | (no tell) ink cloud blooms | muffled pop | 25 ms |

Tell durations: C .7 s, U .55 s, R .45 s, L .40 s. Reduced motion keeps every tell; tells are glyphs, not motion.

**In-canvas fight HUD** (C):
- `TENSÃO [......::::::=========####!!!]` with a `^` marker. The `=` span is the good zone; `!!!` marks danger.
- `FÔLEGO` stamina shown as a row of `)`, from 10 down to 0.
- Rod indicator under the boat: `<--[|]-->`.
- When T > .85 the line and meter go bold and vibrate (deform `jitter`, amplitude ∝ T − .85).

### 4.9 Escapes

On any escape: the line goes slack (`~` and `,` glyphs), an `x` appears where it broke for a `snap` or `fray`, and the fish swims off at 2× speed. A short sentence tells you why, e.g. "A linha partiu — tensão alta demais." or "Ele se soltou no salto — solte o molinete quando ele pular." The bait is consumed. Every escape reason has a dedicated teaching string (`fish.escape.<reason>`).

### 4.10 Landing and the catch card

Landing animation (1.2 s): the fish is lifted above the surface, droplets `'` fall, and the angler plays `cheer`. Then:
- Legendary `tinteira` skips the card and goes to the ending (§9.6).
- Otherwise `AQ.ui.catchCard(specimen, {canKeep, tanks, isNew, isRecord})` → `{choice, tankId}` → `AQ.game.resolveCatch(...)`.

The card shows: a big sprite (DOM `<pre>`, 2× font size), name, rarity `*`…`****`, length and weight, Troféu / Tinta Densa / NOVO! / Recorde badges, the flavour line and value. Buttons: **Guardar** (shows target tank and usage `8/12`, disabled if nothing fits), **Vender $46**, **Soltar** (+5% luck). Keyboard shortcuts: 1/2/3.

### 4.11 Special events

- **Trophy:** q ≥ 0.9, value × 1.25.
- **Tinta Densa:** chance 1/64 × (1 + 2·luck). Value × 4, bold, densified glyphs, extra shimmer.
- **Legendary presence:** when `AQ.spawn.legendaryReady(zone, ctx)` returns an id (conditions met and the right bait equipped), C force-spawns it 20–60 s later at its depth band. C emits `legendary:near`; the water at that depth thickens, a huge level-2 silhouette passes, and a low drone plays. One legendary at a time. If it escapes, it returns after 60 s while conditions hold.
- **Bottles** (`garrafa`): every 300–480 s a bottle sprite drifts across the surface (max 1 at a time). A splash within 2.5 u of it, or a hook shallower than 2 u that touches it, snags it: no fight, it retrieves and opens the next unread message (§9.4). After all 8 are found: every 15 min, "Garrafa vazia — com moedas dentro" worth $50 × zone order.
- **Frenzy** (all zones except the abyss): every 4–7 min, 30 s. Birds `v ^v^` dive at a spot, the surface boils (`*'.`), a school of 6–10 matching species spawns, notice radius doubles, and there are no nibbles (bites are immediate). Emits `frenzy:start` / `frenzy:end`.
- **Sightings:** non-catchable ambient events (§6.5). Each counts once it has been fully on screen for 2 s.

### 4.12 Assists (settings)

`autoSteer` (the rod follows the autopilot at 70% strength; one-handed play), `wideWindows` (bite window × 1.5). Neither changes rewards.

---

## 5. Waters, time and weather

### 5.1 Zones (`js/data/zones.js`, owner B)

| id | pt-BR | Depth (u) | m/u (max m) | Floor | Features (C draws) | Dark | popFactor | Unlock (D) |
|---|---|---|---|---|---|---|---|---|
| `baia` | Baía Rasa | 70 | .17 (12 m) | sand | seagrass, small rocks, caustics | night below 50% | 1.0 | start |
| `recife` | Recife | 100 | .25 (25 m) | coral | coral heads `#%&@Y*`, anemones, rock holes | night below 50% | 1.1 | Barco II + 5 Baía species |
| `kelp` | Floresta de Kelp | 140 | .29 (40 m) | rocks | kelp stalks (sway), boulders, caves | night below 40% | 0.9 | Barco III + 5 Recife species |
| `mar` | Mar Aberto | 220 | .9 (200 m) | far / dark | open water, schools, big waves | always below 70%; night below 30% | 0.7 | Barco IV + Linha III + 5 Kelp species |
| `abismo` | Abismo | 320 | 5 (1600 m) | vents | cliffs, vents with bubbles, marine snow | always below 15% | 0.6 | Barco V + Lanterna I + 6 Mar species |

`floorProfile`: `floorY(x) = depth·(base + amp·fbm(x·freq))`, with base .92, amp .06, freq .05 (abismo amp .08). Covers for burrowers are rectangles around rocks, coral and kelp; C exposes them as `env.covers`.

### 5.2 Clock (`js/logic/world.js`, owner B)

- 1 real second = 1 game minute (one day is 24 real minutes). The clock runs only while the map, fishing or aquarium scene is active and not paused. It does not advance offline.
- Phases: `amanhecer` 05:00–07:00, `dia` 07:00–17:00, `entardecer` 17:00–19:00, `noite` 19:00–05:00.
- New game starts at day 0, 05:30, weather `limpo`.
- "Esperar até…" (map) jumps to the next start of the chosen phase. Weather slots advance by the skipped time. Income does **not** accrue from skipping; income is real-time only.

### 5.3 Weather (Markov, slots of 180–360 game minutes; forecast of the next 3 slots pre-rolled from `fork('weather')`)

| from \ to | limpo | nublado | chuva | tempestade |
|---|---|---|---|---|
| limpo | .45 | .40 | .15 | 0 |
| nublado | .35 | .25 | .30 | .10 |
| chuva | .15 | .35 | .25 | .25 |
| tempestade | .10 | .30 | .45 | .15 |

Visuals (C):
- `nublado`: drifting `~~` cloud clusters at level 2; rays ×0.5.
- `chuva`: rain ramp streaks with wind slant, surface ring dots.
- `tempestade`: waves ×2, foam on crests, lightning. Lightning is a top-layer veil at level 3 for 120 ms, at most once every 4 s, disabled under reduced motion (replaced by a level-1 dim pulse).

Spawn multipliers: `limpo` ×1.2 for `light:'day'` species; `chuva` ×1.3 for predators and surface species; `tempestade` ×1.5 for rares. Hard weather requirements are per species.

### 5.4 Darkness and light

`AQ.world.light(state, zoneId, depthFrac)` returns ambient light from 0 to 1: day 1.0, dawn/dusk .6, night .25, × weather (nublado .8, chuva .7, tempestade .55), × depth fog. A cell is **dark** when ambient < .3 or the zone's dark rule applies.

In the dark:
- Creature visibility = `max(lanternFalloff, glow ? .6 : .08)`, where `lanternFalloff = smoothstep(r, .5r, dist(hook))` and `r` = lantern radius (none 6, I 14, II 22, III 30 u).
- Glow cells (`sprite.glow`) are drawn at level 11 with a slow pulse.
- A species counts as **seen** when its visibility ≥ .5 and it is on screen for 1 s (C calls `AQ.game.markSeen`).

### 5.5 Spawning

- Live population in the fishing scene: `N = round(maxCreatures(quality) · zone.popFactor · clamp(sqrt(cols/60), .8, 1.4))`. A school counts as its members (`schoolSize` 4–8 for `school` behaviour; 3–5 for M+ and 3–4 for sprites ≥ 10 cols wide).
- Creatures spawn off-screen left or right, inside their depth band, and despawn 20 u past the edge unless engaged.
- `weight = RARITY_W[rarity] · timeOK · weatherOK · weatherMul · (1 + .5·affinity(bait)) · (rarity ≥ R ? 1 + luck : 1)`, with `RARITY_W = {C:100, U:35, R:8, L:0}`. Legendaries spawn only through `legendaryReady`.

---

## 6. Creatures

### 6.1 Roster: identity (42 catchable)

Abbreviations. Phases: A amanhecer, D dia, E entardecer, N noite, any. Weather: li limpo, nu nublado, ch chuva, te tempestade. Sizes: XS, S, M, L, XL, XXL.

| # | id | pt-BR | English | Zone | Rarity | Size | Kind | Behaviour |
|---|---|---|---|---|---|---|---|---|
| 1 | manjuba | Manjuba | Anchovy | baia | C | XS | fish | school |
| 2 | tainha | Tainha | Mullet | baia | C | S | fish | school |
| 3 | siri | Siri-azul | Blue crab | baia | C | S | crustacean | crawl |
| 4 | camarao | Camarão | Shrimp | baia | C | XS | crustacean | hover |
| 5 | baiacu | Baiacu | Pufferfish | baia | U | S | fish | dart |
| 6 | arraia | Arraia | Stingray | baia | U | M | ray | burrow |
| 7 | agulha | Peixe-agulha | Needlefish | baia | U | S | fish | dart |
| 8 | cavalo | Cavalo-marinho | Seahorse | baia | R | XS | fish | hover |
| 9 | ermitao | Ermitão-de-garrafa | Bottle hermit crab | baia | R | S | odd | crawl |
| 10 | tipografo | Peixe-tipógrafo | Typefish | baia | L | M | odd | cruise |
| 11 | palhaco | Peixe-palhaço | Clownfish | recife | C | XS | fish | hover |
| 12 | cirurgiao | Peixe-cirurgião | Surgeonfish | recife | C | S | fish | school |
| 13 | papagaio | Peixe-papagaio | Parrotfish | recife | U | M | fish | cruise |
| 14 | moreia | Moreia | Moray eel | recife | U | M | eel | lurk |
| 15 | lagosta | Lagosta | Spiny lobster | recife | U | M | crustacean | crawl |
| 16 | leao | Peixe-leão | Lionfish | recife | R | S | fish | hover |
| 17 | polvo | Polvo | Octopus | recife | R | M | cephalopod | crawl |
| 18 | sargo | Sargo | Sheepshead bream | kelp | C | S | fish | school |
| 19 | cavalinha | Cavalinha | Mackerel | kelp | C | S | fish | school |
| 20 | lula | Lula | Squid | kelp | U | S | cephalopod | dart |
| 21 | escorpiao | Peixe-escorpião | Scorpionfish | kelp | U | S | fish | lurk |
| 22 | congro | Congro | Conger eel | kelp | U | M | eel | lurk |
| 23 | garoupa | Garoupa | Grouper | kelp | R | L | fish | lurk |
| 24 | aranha | Caranguejo-aranha | Spider crab | kelp | R | M | crustacean | crawl |
| 25 | aguaviva | Água-viva | Moon jelly | mar | C | S | jelly | drift |
| 26 | voador | Peixe-voador | Flying fish | mar | U | S | fish | leap |
| 27 | dourado | Dourado | Mahi-mahi | mar | U | L | fish | cruise |
| 28 | atum | Atum | Tuna | mar | U | L | fish | school |
| 29 | caravela | Caravela-portuguesa | Portuguese man o' war | mar | R | S | jelly | drift |
| 30 | lua | Peixe-lua | Ocean sunfish | mar | R | L | fish | drift |
| 31 | manta | Raia-manta | Manta ray | mar | R | XL | ray | drift |
| 32 | martelo | Tubarão-martelo | Hammerhead shark | mar | R | L | shark | cruise |
| 33 | marlim | Marlim-azul | Blue marlin | mar | L | XL | fish | cruise |
| 34 | machado | Peixe-machado | Hatchetfish | abismo | C | XS | fish | school |
| 35 | vibora | Peixe-víbora | Viperfish | abismo | U | S | fish | lurk |
| 36 | isopode | Isópode-gigante | Giant isopod | abismo | U | M | crustacean | crawl |
| 37 | diabo | Peixe-diabo | Anglerfish | abismo | R | S | fish | lurk |
| 38 | vampira | Lula-vampira | Vampire squid | abismo | R | S | cephalopod | drift |
| 39 | atolla | Água-viva-atolla | Atolla jellyfish | abismo | R | M | jelly | drift |
| 40 | pelicano | Enguia-pelicano | Gulper eel | abismo | R | L | eel | drift |
| 41 | celacanto | Celacanto | Coelacanth | abismo | L | L | fish | hover |
| 42 | tinteira | Lula-Tinteira | Inkwell Squid | abismo | L | XXL | cephalopod | ambient (boss) |

Totals: 10 C, 14 U, 14 R, 4 L. Kinds: fish 25, crustacean 6, cephalopod 4, jelly 3, eel 3, ray 2, shark 1, odd 2 (counted with their nearest kind for tank rules).

### 6.2 Roster: fishing parameters

`gT` is the recommended gear tier; it is also the tier tests use. P is absolute power. Depth is the normalised band within the zone.

| id | Fight style | P | stam s | V u/s | Depth | Time | Weather | Baits (affinity) | Wariness / window s | hookMin | gT |
|---|---|---|---|---|---|---|---|---|---|---|---|
| manjuba | shaker | .60 | 5 | 5 | 0–.45 | any | – | massa 1.2, minhoca 1 | 1 / .9 | 1 | 1 |
| tainha | jumper | .80 | 8 | 6 | 0–.3 | A,D | – | massa 1, minhoca 1 | 1 / .9 | 1 | 1 |
| siri | deadweight | .75 | 6 | 3 | .88–1 | any (N ×2) | – | massa .8, minhoca 1, lula 1.2 | 1 / .9 | 1 | 1 |
| camarao | drifter (tear .6) | .40 | 4 | 4 | .6–1 | A,E,N | – | massa 1 | 1 / .9 | 1 | 1 |
| baiacu | inflater | 1.00 | 10 | 5 | .3–.8 | any | – | minhoca 1, camarao 1.5 | 2 / .75 | 1 | 1 |
| arraia | puller (grip) | 1.05 | 11 | 5 | .85–1 | D,E | – | minhoca 1, camarao 1.3 | 2 / .75 | 2 | 2 |
| agulha | runner | 1.05 | 9 | 9 | 0–.15 | D | – | colher 1.5, camarao 1 | 2 / .75 | 1 | 1 |
| cavalo | drifter (tear .5) | .40 | 5 | 2 | .5–.9 | A | li,nu | camarao 1.5 | 3 / .6 | 1 | 1 |
| ermitao | deadweight (grip) | .90 | 9 | 2 | .95–1 | N | – | massa 1.5 | 3 / .6 | 1 | 1 |
| tipografo | shaker (scramble) | 1.90 | 120 | 9 | .2–.6 | A | – | papel 1 | 3 / .55 | 2 | 2 |
| palhaco | shaker | .80 | 6 | 5 | .45–.85 | any | – | massa 1, camarao 1.2 | 1 / .9 | 1 | 2 |
| cirurgiao | runner | 1.10 | 10 | 8 | .2–.6 | D | – | minhoca 1, camarao 1.2 | 1 / .9 | 1 | 2 |
| papagaio | puller | 1.30 | 13 | 6 | .3–.9 | A,D,E | – | camarao 1.2, lula 1 | 2 / .75 | 2 | 2 |
| moreia | burrower | 1.45 | 14 | 7 | .7–1 | E,N | – | lula 1.5, camarao .8 | 2 / .75 | 2 | 2 |
| lagosta | deadweight (grip) | 1.30 | 13 | 3 | .85–1 | N | – | lula 1.3, minhoca .8 | 2 / .75 | 2 | 2 |
| leao | shaker | 1.45 | 15 | 4 | .4–.9 | any | – | camarao 1.3, lula 1 | 3 / .6 | 1 | 2 |
| polvo | inker (grip, ink .4) | 1.60 | 18 | 8 | .8–1 | E,N | – | lula 1.5, camarao 1 | 3 / .6 | 2 | 2 |
| sargo | puller | 1.15 | 8 | 6 | .2–.7 | any | – | minhoca 1, camarao 1.2 | 1 / .9 | 1 | 3 |
| cavalinha | runner | 1.25 | 8 | 10 | 0–.5 | A,D | – | colher 1.5, minhoca 1 | 1 / .9 | 1 | 3 |
| lula | inker (ink .5) | 1.55 | 12 | 10 | .2–.6 | E,N | – | jig 1.5, luminosa 1.3 | 2 / .75 | 1 | 3 |
| escorpiao | burrower | 1.55 | 12 | 6 | .75–1 | any | – | camarao 1.3, lula 1 | 2 / .75 | 1 | 3 |
| congro | diver | 1.70 | 15 | 8 | .7–1 | N | – | lula 1.5 | 2 / .75 | 2 | 3 |
| garoupa | burrower | 2.00 | 24 | 8 | .6–1 | E,N | – | lula 1.5 | 3 / .6 | 3 | 3 |
| aranha | deadweight (grip) | 1.80 | 18 | 2 | .9–1 | N | – | lula 1.2, massa 1 | 3 / .6 | 2 | 3 |
| aguaviva | drifter (tear .5) | .55 | 6 | 2 | 0–.6 | any (N glows) | – | massa 1, luminosa 1.3 | 1 / .9 | 1 | 4 |
| voador | jumper | 1.40 | 10 | 11 | 0–.15 | D | – | massa 1, minhoca 1 | 2 / .75 | 1 | 4 |
| dourado | jumper | 2.00 | 22 | 11 | 0–.3 | D | – | colher 1.5, lula 1.2 | 2 / .75 | 3 | 4 |
| atum | runner | 2.30 | 22 | 13 | .2–.7 | A,D | – | lula 1.3, colher 1.2 | 2 / .75 | 3 | 4 |
| caravela | drifter (tear .35) | .60 | 6 | 2 | 0–.06 | any | ch,te | luminosa 1.5 | 3 / .6 | 1 | 4 |
| lua | deadweight | 2.20 | 26 | 3 | 0–.3 | D | li | lula 1, luminosa .8 | 3 / .6 | 3 | 4 |
| manta | puller | 2.40 | 28 | 7 | .1–.5 | D | li,nu | massa 1.5 | 3 / .6 | 4 | 4 |
| martelo | runner | 2.50 | 28 | 12 | .3–.9 | E,N | – | lula 1.5 | 3 / .6 | 3 | 4 |
| marlim | boss | 2.90 | 70 | 15 | .1–.5 | E | li | colher 1.5, lula 1 | 3 / .55 | 4 | 5 |
| machado | shaker | 1.40 | 7 | 6 | 0–.45 | any | – | massa 1, luminosa 1.3 | 1 / .9 | 1 | 5 |
| vibora | runner | 2.40 | 14 | 11 | .2–.7 | any | – | luminosa 1.5 | 2 / .75 | 1 | 5 |
| isopode | deadweight (roll) | 2.30 | 16 | 2 | .95–1 | any | – | lula 1.3, massa 1 | 2 / .75 | 2 | 5 |
| diabo | puller | 2.60 | 18 | 4 | .6–1 | any | – | luminosa 1.6 | 3 / .6 | 1 | 5 |
| vampira | inker (glowInk, .5) | 2.50 | 16 | 7 | .4–.9 | any | – | luminosa 1.5 | 3 / .6 | 1 | 5 |
| atolla | drifter (tear .45, alarm) | .70 | 9 | 2 | .3–.8 | any | – | luminosa 1.5 | 3 / .6 | 2 | 5 |
| pelicano | diver | 2.60 | 20 | 9 | .5–1 | any | – | lula 1.4 | 3 / .6 | 3 | 5 |
| celacanto | boss | 3.10 | 45 | 7 | .85–1 | N | – | jig 1.5 | 3 / .55 | 3 | 5 |
| tinteira | boss | 3.40 | 60 | 12 | .9–1 | N | te | perola 1 | 0 / .55 | 4 | 5 |

Tells by rarity: C .7, U .55, R .45, L .4. Every zone has at least one common in every phase (test-enforced).

### 6.3 Roster: biology, value and aquarium parameters

`kg = kgMax · (len/lenMax)³`. Habitat tags: sand, plants, rocks, coral, cave, open. Light preference: day / dim / night. Diet: prey, grazer, filter, predator. `glow` = bioluminescent. `breeds` = can breed in the tank.

| id | Value $ | len cm | kgMax | Habitat | Light | Diet | glow | breeds | Notes |
|---|---|---|---|---|---|---|---|---|---|
| manjuba | 9 | 6–12 | .02 | open | day | prey | – | ✓ | |
| tainha | 16 | 30–60 | 3.5 | sand, open | day | grazer | – | ✓ | |
| siri | 14 | 8–18 | .45 | sand, rocks | night | grazer | – | ✓ | |
| camarao | 9 | 5–15 | .03 | plants, sand | dim | prey | – | ✓ | produces 2 `camarao` bait / 10 min if happy ≥ 60 |
| baiacu | 42 | 15–35 | 1.2 | rocks, plants | day | prey | – | ✓ | extra frame `inflate` |
| arraia | 64 | 40–100 | 20 | sand | dim | predator | – | ✓ | half-buried: only eyes `°°` + tail visible while lurking |
| agulha | 50 | 40–90 | .9 | open | day | predator | – | ✓ | |
| cavalo | 240 | 8–18 | .02 | plants | dim | prey | – | ✓ | |
| ermitao | 300 | 6–14 | .25 | sand, rocks | night | grazer | – | ✗ | extra `hide` (inside the bottle) |
| tipografo | 1500 | 20–40 | 1.0 | open, plants | dim | grazer | – | ✗ | `scramble` glyphMap |
| palhaco | 28 | 6–11 | .03 | coral | day | prey | – | ✓ | |
| cirurgiao | 34 | 15–35 | 1.0 | coral, rocks | day | grazer | – | ✓ | |
| papagaio | 96 | 30–70 | 6 | coral | day | grazer | – | ✓ | |
| moreia | 120 | 60–150 | 12 | rocks, cave | night | predator | – | ✓ | |
| lagosta | 140 | 20–45 | 3.5 | rocks, cave | night | grazer | – | ✓ | |
| leao | 360 | 20–38 | 1.3 | coral, rocks | dim | predator | – | ✓ | |
| polvo | 420 | 40–110 | 10 | rocks, cave | night | predator | – | ✗ | extra `ink` (jet pose) |
| sargo | 55 | 20–40 | 1.5 | rocks, plants | day | grazer | – | ✓ | |
| cavalinha | 50 | 25–45 | 1.0 | open | day | predator | – | ✓ | |
| lula | 150 | 20–50 | 1.5 | open | night | predator | – | ✓ | extra `jet` |
| escorpiao | 170 | 15–40 | 1.8 | rocks | dim | predator | – | ✓ | camouflage: level 3 until within 8 u of the hook |
| congro | 210 | 60–160 | 15 | rocks, cave, plants | night | predator | – | ✓ | |
| garoupa | 800 | 50–120 | 30 | cave, rocks | dim | predator | – | ✓ | |
| aranha | 600 | 20–40 | 4 | rocks, plants | night | grazer | – | ✓ | |
| aguaviva | 70 | 10–40 | .5 | open | dim | filter | ✓ | ✓ | |
| voador | 110 | 20–35 | .4 | open | day | grazer | – | ✓ | glides over the surface |
| dourado | 320 | 60–150 | 25 | open | day | predator | – | ✓ | |
| atum | 420 | 80–200 | 120 | open | day | predator | – | ✓ | |
| caravela | 520 | 20–30 | .6 | open | day | predator | – | ✗ | float on the surface + long tentacles |
| lua | 900 | 100–250 | 1000 | open | day | filter | – | ✓ | |
| manta | 1500 | 300–600 | 1400 | open | day | filter | – | ✓ | |
| martelo | 1350 | 150–350 | 230 | open | dim | predator | – | ✓ | |
| marlim | 4500 | 200–450 | 600 | open | day | predator | – | ✗ | |
| machado | 110 | 3–8 | .02 | open | night | prey | ✓ | ✓ | |
| vibora | 360 | 20–35 | .4 | open | night | predator | ✓ | ✓ | |
| isopode | 560 | 20–45 | 1.7 | sand, rocks | night | grazer | – | ✓ | extra `roll` |
| diabo | 880 | 15–60 | 10 | open, rocks | night | predator | ✓ (lure cell) | ✓ | lure light is visible from far away |
| vampira | 1050 | 15–30 | .5 | open | night | filter | ✓ | ✓ | |
| atolla | 1300 | 10–20 | .4 | open | night | filter | ✓ | ✓ | |
| pelicano | 1250 | 50–100 | 3 | open | night | predator | ✓ (tail tip) | ✓ | |
| celacanto | 6000 | 120–200 | 90 | cave, rocks | night | predator | – | ✗ | |
| tinteira | 0 | 1200–1800 | 900 | – | night | – | – | ✗ | `keep:false`, release only |

### 6.4 Flavour lines (pt-BR; B also writes English versions)

| id | pt-BR flavour |
|---|---|
| manjuba | Mil manjubas, um só pensamento: virar à esquerda. |
| tainha | Pula fora d'água só para conferir se o céu ainda está lá. |
| siri | Anda de lado para nunca dar as costas a ninguém. |
| camarao | Nada para trás com muita convicção. |
| baiacu | Quando contrariado, vira uma bola de opiniões espinhosas. |
| arraia | Enterra-se na areia e deixa só os olhos de fora. A cauda fica de lembrete. |
| agulha | Uma agulha com pressa e nenhuma linha. |
| cavalo | Quem carrega os filhotes é o pai. Ele não reclama — muito. |
| ermitao | Trocou a concha por uma garrafa. Diz que a vista é melhor. |
| tipografo | Escrito por alguém, em algum lugar. Ainda procura o fim da frase. |
| palhaco | Mora numa anêmona e paga o aluguel com piadas. |
| cirurgiao | Leva um bisturi na cauda e nenhum diploma na parede. |
| papagaio | Come coral e devolve areia. A praia agradece. |
| moreia | Abre e fecha a boca o dia inteiro. É só respiração. Quase sempre. |
| lagosta | Armadura completa, antenas de radar e nenhum senso de humor. |
| leao | Lindo, venenoso e convidado por ninguém. |
| polvo | Oito braços, três corações e zero paciência para anzóis. |
| sargo | Tem dentes de gente e sorri para ninguém. |
| cavalinha | Listras de tigre, coragem de sardinha. |
| lula | Some numa nuvem de tinta quando a conversa fica séria. |
| escorpiao | Parece uma pedra. Pense duas vezes antes de sentar. |
| congro | Uma enguia que levou a sério a vida noturna. |
| garoupa | Vive décadas na mesma toca e conhece cada anzol pelo nome. |
| aranha | Pernas para dar e vender. Ela não vende. |
| aguaviva | Noventa e cinco por cento água, cinco por cento mistério. |
| voador | Achou o mar pequeno demais e resolveu tentar o céu. |
| dourado | Brilha como moeda nova e briga como troco errado. |
| atum | Nunca para de nadar. Nem para pensar. |
| caravela | Não é uma água-viva: é uma república inteira navegando junta. |
| lua | Pesa uma tonelada e passa o dia tomando sol de lado. |
| manta | Voa debaixo d'água sem pedir licença à gravidade. |
| martelo | Enxerga em panorâmica. Você com certeza está no quadro. |
| marlim | O velho do mar ainda conta essa história — e ela cresce a cada vez. |
| machado | Acende a barriga para não fazer sombra. Esconde-se acendendo a luz. |
| vibora | Dentes grandes demais para a própria boca. Ele não liga. |
| isopode | Um tatuzinho de jardim que levou a dieta muito a sério. |
| diabo | Leva a própria lanterna. Quem chega perto para ver a luz vira jantar. |
| vampira | Não suga sangue. Só tem uma capa e uma péssima reputação. |
| atolla | Quando atacada, acende um alarme — e algo maior sempre vem ver. |
| pelicano | Uma boca enorme com um rabo pendurado. |
| celacanto | Dado como extinto há 66 milhões de anos. Ninguém avisou a ele. |
| tinteira | Dizem que foi ela quem escreveu o mar. Cada onda é uma linha da sua letra. |

### 6.5 Sightings (non-catchable; they count toward completion; owner B for data and art, C for spawning)

| id | pt-BR | English | Zones | When | Chance | Art | Flavour |
|---|---|---|---|---|---|---|---|
| baleia | Baleia-jubarte | Humpback whale | mar | li, nu, D or E | 3% per minute | XXL (≤ 48×12) slow pass at depth .3–.5; tail flick | Canta músicas que duram meia hora. Ninguém tem coragem de interromper. |
| golfinhos | Golfinhos | Dolphins | baia, mar | D | 4% per minute | M, leaping arcs, 3 individuals | Acompanham o barco só para ver se você sabe pescar. |
| tartaruga | Tartaruga-verde | Green turtle | recife | any | 4% per minute | M | Já atravessou o oceano duas vezes. Hoje está só de passagem. |

Bestiary total = 42 + 3 = **45 entries**.

### 6.6 Sprite format (owner B: `js/data/sprites.js` for creatures, `js/data/art.js` for everything else)

```js
AQ.sprites.baiacu = {
  frames: [ [ '  .---. ', '><(  °)=', '  `---´ ' ],      // frame 0, facing RIGHT
            [ '  .---. ', '-<(  °)=', '  `---´ ' ] ],    // frame 1 (tail flick)
  extra:  { inflate: [ [ " \\ ' | ' / ", '-(    °  )=', ' / , | , \\ ' ] ] },
  masks:  null,                 // or one mask per frame (see below); null = auto row-span
  fps: 4,                       // frame cycle at cruise speed (scaled by speed)
  deform: 'swim',               // 'swim' | 'pulse' | 'sway' | 'crawl' | 'none'
  amp: 1,                       // deform amplitude multiplier
  glow: null,                   // [[c, r], ...] glow cells, in right-facing frame coordinates
  scramble: false               // letters rearranged by glyphMap (tipografo)
};
```

Rules (test-enforced):
- Every species has a sprite with ≥ 2 frames. All frames of a sprite share the same width and height. Every line is padded with spaces to the full width. The bounding box is tight: no fully blank first or last row or column.
- `extra` frames may differ in size and are drawn centred on the same anchor.
- Characters come only from the sprite charset (§2.3). No tabs.
- Size-class maximum bounding boxes (cols × rows): **XS 6×2, S 12×4, M 18×5, L 26×7, XL 34×9, XXL 48×14**.
- **Mirror map** (A implements in `AQ.textart.MIRROR`): `( ↔ )`, `[ ↔ ]`, `{ ↔ }`, `< ↔ >`, `/ ↔ \`, `` ` ↔ ´ ``, `d ↔ b`, `p ↔ q`, `« ↔ »`. Every other character maps to itself. Flipping = reverse each padded line, then map each character. `mirror(mirror(x)) === x` must hold. Avoid directional letters (`c e s z S Z J L`) in sprites.
- **Masks:** strings of `x` (knockout) and `.` (no knockout), same dimensions as the frame. The default auto mask knocks out each row from its first to its last non-space character. Use explicit masks for gaps that should show the water: jelly tentacles, crab legs.
- The head faces right and the tail is at column 0, because the `swim` deform amplitude grows toward the tail. The eye is `°` (or `o`, or `@` for big eyes). A `x` eye is forbidden (it reads as death).
- Juveniles use `AQ.sprites._alevino` (XS, 2 frames) until `growth ≥ .5`, then the species sprite.

**Style reference sprites** (match this density and line language):

```
manjuba (XS 4×1)     f0: ><°>        f1: -<°>

baiacu (S 8×3)            inflate (extra, 11×3)
  .---.                   \ ' | ' /
><(  °)=                 -(    °  )=
  `---´                   / , | , \

polvo (M 10×4)       f0             f1
                       .--.           .--.
                      ( °  )         ( °  )
                      /)||(\         (\||/)
                     ( (  ) )        ) )( (

atum (L 21×5)
        __/\__
 \\  _.-'      '-._
  >=(    )))    ° >
 //  '-.__    __.-'
        \/  \/

aguaviva (S 8×4, deform 'pulse', explicit mask)
 f0          mask f0      f1
 .-~~-.     .xxxxxx.      .--.
(  ''  )    xxxxxxxx     ( '' )
 ;:;;:;     ........     :;:;;:
 ' ', '     ........      ' ,'
```
(Pad all lines to equal width in the data file; the blocks above are trimmed for display. Mirrored atum: `\\`↔`//`, `>=(`→`)=<`, `°  >`→`<  °`.)

Other art B owns (`AQ.art`):
- `logo.wide` (64×5, below) and `logo.tall` (two blocks: "ÁGUA" 27 wide, "TINTA" 32 wide)
- `boat` (2 bob frames)
- `angler` {idle, windup, cast, reel: [bent0, bent1, bent2], cheer}
- `bottle` (2 frames)
- `birds` (2 frames)
- `decor.<id>` (12 items, each ≤ 10×6; sway deform for plants)
- `visitors` (4 variants × 2 walk frames, 3 rows tall)
- `map` {aquarium, shop, lighthouse, pier}
- `lamp`, `filter`
- `tentacle` (Tinteira grip phase)
- `baitGlyph` map (§4.5)

```
    ´
   _     ___  _   _    _         _____  ___  _  _  _____    _
  /_\   / __|| | | |  /_\   ___ |_   _||_ _|| \| ||_   _|  /_\
 / _ \ | (_ || |_| | / _ \ |___|  | |   | | | .` |  | |   / _ \
/_/ \_\ \___| \___/ /_/ \_\       |_|  |___||_|\_|  |_|  /_/ \_\
```

### 6.7 Specimen roll (`AQ.spawn.rollSpecimen`, owner B)

```
qExp = bait==='lula' ? 1.2 : 1.6            // big bait → bigger fish
q    = rng.next() ** qExp                   // skewed small; P(q ≥ .9) ≈ 6% at 1.6
len  = round1(lenMin + q·(lenMax − lenMin))
kg   = round2(kgMax · (len/lenMax)^3)       // 3 significant digits shown
dense = rng.chance((1/64)·(1 + 2·luck))
trophy = q ≥ .9
specimen = { sp, len, kg, q, dense, trophy, zone, at: AQ.util.now() }
```
Bred juveniles: `len = clamp(avg(parents.len)·normal(1, .08), lenMin, lenMax)`. Bred fish never set records.

### 6.8 Behaviour archetypes (B, `js/logic/creatures.js`)

| Behaviour | Wild motion | Tank motion |
|---|---|---|
| school | boids (sep 2.5 u, align, cohere, max neighbours 7), wander leader | same, looser |
| dart | glide, then burst (×3 speed for 0.3 s) every 1–3 s | same |
| cruise | steady wander, wide turns | laps the tank |
| lurk | holds near a cover point; ambush lunge at food or hook | near decor with rocks/cave tags |
| drift | slow sinusoidal vertical pulse; follows "current" | bobs in open water |
| crawl | stays on `floorY(x)`, alternates frames as legs | along the sand |
| burrow | rests half-buried (draws only flagged cells); emerges to investigate | same on sand |
| hover | near-stationary, slight sway; seahorse vertical | near plants |
| leap | near the surface; periodic arcs above the surface (sprite crosses the surface line, splash on entry and exit) | not in the tank (behaves as cruise) |
| ambient | scripted path (sightings, the legendary pass) | – |

Common steering: separation from other creatures (cheap grid buckets), edge avoidance, depth-band spring (pulled back inside the band), facing = sign(vx) with hysteresis (no flicker), frame rate ∝ |v|. Predators chase small prey cosmetically in the wild (no eating).

---

## 7. The aquarium

### 7.1 Tanks

- Up to **4 tanks**. Each has 5 decor slots along the bottom, a capacity tier, a filter tier, an optional auto-feeder, a light mode (`day`/`dim`/`night`, cycled for free) and a food level.
- Capacity is counted in units; size cost XS 1, S 2, M 4, L 8, XL 16 (XXL cannot be kept).
- Capacity tiers: **12 / 20 / 32 / 48**. Filter tiers: **14 / 28 / 56** bioload (bioload = sum of size costs).
- One tank is shown at a time. ◄ ► (Q/E, swipe, or nav buttons) switches tanks. Fish positions are transient (not saved).

### 7.2 Happiness (per fish, 0–100)

```
foodF    = 0.3 + 0.7·tank.food                      // food 0..1
spaceF   = u ≤ .75 ? 1 : 1 − 2·(u − .75)             // u = used/cap → .5 when full
habitatF = species.habitat ∩ tankTags ≠ ∅ ? 1 : .6   // tankTags = sand (always) ∪ decor tags ∪ ('open' if ≤ 2 slots used)
lightF   = exact 1 | adjacent (day–dim, dim–night) .85 | opposite .7
harmonyF = stressed ? .6 : 1     // a predator in the tank ≥ 2 size classes larger than this fish
qualityF = min(1, filterCap/bioload) ^ .7
happy = round(100 · foodF^.6 · spaceF · habitatF · lightF · harmonyF · qualityF)
```
Tank happiness = mean over fish (100 if empty). Faces: ≥ 80 `:D`, ≥ 60 `:)`, ≥ 40 `:|`, < 40 `:(`. Card breakdown: "Comida · Espaço · Habitat · Luz · Convivência · Água".

### 7.3 Food

- `food` decays by 1/45 per real minute, online and offline. The offline floor is .2.
- **Alimentar** costs `max(3, ceil(.5·bioload))` coins and sets food to 1. Flakes `· °` fall and fish swim to eat them (`env.food`).
- The auto-feeder refills when food < .3, paying from coins; it skips if coins are short.

### 7.4 Income ("Bilheteria")

```
appeal(f)   = value^.75 · (0.8 + 0.5·q) · (dense ? 3 : 1) · (bred ? .7 : 1) · happy/100
tankAttr    = Σ appeal · (1 + .04·distinctSpecies) · (1 + Σ decor.attract)
attraction  = Σ tankAttr
incomePerMin = .06 · attraction
```
- The till (`aquarium.till`) accrues every second while playing. Offline it accrues at **50%** for at most `cofre` hours (2 / 4 / 8 h).
- Collecting is a tap on **Bilheteria**: a `$` glyph shower and a coin sound.
- Visitors walk along the bottom edge: `min(8, floor(attraction/40))` at once. They stop at rare fish with `!` and pay with a `$` that floats up.

### 7.5 Stars (attraction thresholds)

★1 ≥ 0 · ★2 ≥ 100 · ★3 ≥ 600 · ★4 ≥ 1 500 · ★5 ≥ 5 000 *(QA pass; was 2 500 / 7 000)*. Stars unlock decor tiers (§8.4). ★4 also unlocks the **Pérola Negra** bait and Vó Iara's note.

### 7.6 Breeding

- Checked every 8 real minutes, **online only**.
- For each breedable species with ≥ 2 adults (growth = 1) in a tank with happiness ≥ 70 and free capacity ≥ its size cost: chance .30 → one juvenile (growth .2, `bred: true`).
- Juveniles grow by +1/20 per minute to 1.
- Dense chance: 25% if a parent is dense, else 1/48.
- Bred fish sell for × .6 and never set records.

### 7.7 Production

- **Ostra perlífera** decor: +1 pearl every 12 min while the tank's happiness ≥ 60. Offline it runs at 50% within the cofre cap. Maximum one oyster per tank.
- **Camarão** (species): each happy (≥ 60) shrimp yields +2 `camarao` bait every 10 min, online only.

### 7.8 Predation (rare, telegraphed, avoidable)

- Predators stress smaller fish (harmonyF).
- If tank food < .15 for **5 continuous online minutes**, one predator eats one eligible prey: size ≤ predator − 2 classes, rarity C or U only, never dense, never named fish.
- Warnings: food < .3 → toast "A moreia está de olho nos camarões do Tanque 1…". Never offline.

### 7.9 Interactions

- Tap a fish → **fish card**: sprite, name (nickname editable), length and weight, origin (zone and date, or "nascido aqui"), happiness with breakdown, preferences ("Gosta de: pedras, luz fraca"), sale value. Actions: **Mover** (tank picker with usage), **Vender**, **Soltar** (confirm), **Renomear**.
- **Decorar** opens slot picking: tap a slot, then pick from owned decor or "remover". Items return to inventory.
- **Luz** cycles day → dim → night: night darkens the tank, glow species pulse, diurnal fish rest low.
- **Contemplar** hides the HUD; tap to exit.

---

## 8. Economy and upgrades (first balance pass; tunable)

### 8.1 Currencies

- **Moedas** `$`: from selling, the till, goals and bottles.
- **Pérolas** `@`: from oysters, first catch of each rare (+2) and legendary (+10), goals and achievements.
- Start: $50, 0 pearls, infinite `massa`, 10 `minhoca`, gear tier 1 everywhere (lantern 0), 1 tank (cap 12, filter 14), boat I.

### 8.2 Gear (single shop item per slot; buying gives the next tier)

| Slot (id) | Tier | Name (pt-BR) | Price $ | Stats |
|---|---|---|---|---|
| rod | I–V | Vara de bambu / de fibra / de carbono / de mar / de Iara | 0 / 120 / 800 / 3 500 / 12 000 | castMax 26/34/44/56/70 u · window +0/.05/.10/.15/.20 s · St .55/.65/.75/.88/1.0 |
| line | I–V | Linha de algodão / de náilon / trançada / de aço fino / Fio de seda-do-mar | 0 / 75 / 600 / 3 000 / 10 000 | Ls 1.0/1.25/1.55/1.9/2.3 · maxLen 90/130/180/250/360 u · snapGrace .25/.30/.35/.40/.45 s |
| reel | I–V | Carretilha velha / Molinete simples / de rolamento / de oceano / abissal | 0 / 150 / 1 000 / 4 000 / 12 000 | reelSpeed 7/9/11/13/16 u/s · riseRate 7/6.5/6/5.5/5 |
| hook | I–IV | Anzol nº 12 / nº 6 / 2/0 / 8/0 | 0 / 100 / 700 / 3 500 | hookClass 1–4 (XS-S / M / L / XL) · H 0/.25/.5/.75 |
| lantern | 0–III | — / Lanterna de vidro / de mergulho / de plâncton | — / 2 000 / 6 000 / 15 000 | radius 6/14/22/30 u |
| boat | I–V | Canoa / Jangada / Bote a motor / Saveiro / Traineira de profundidade | 0 / 400 / 1 600 / 5 000 / 12 000 | unlocks baia/recife/kelp/mar/abismo (plus species requirements, §5.1) |

> **Current prices (QA balance pass; `js/data/items.js` is the source of truth):** rod 0 / 120 / 600 / 1 800 / 4 500 · line 0 / 75 / 450 / 1 500 / 4 000 · reel 0 / 150 / 700 / 1 800 / 4 500 · hook 0 / 100 / 500 / 1 400 · lantern — / 800 / 2 800 / 7 000 · boat 0 / 300 / 1 200 / 2 800 / 3 500. With these, all 5 pacing bots reach the ending (median ≈ 2:47 for the conservative bot, which lands 55–85 % and ignores frenzies).

### 8.3 Baits and lures

| id | Item | Price | Requirement |
|---|---|---|---|
| bait_minhoca | 10 minhocas | $10 | – |
| bait_camarao | 10 camarões | $30 | – |
| bait_lula | 10 tiras de lula | $80 | Recife unlocked |
| bait_luminosa | 5 iscas luminosas | $150 | Mar unlocked |
| lure_colher | Colher (permanent) | $250 | – |
| lure_jig | Jig profundo (permanent) | $1 500 | Kelp unlocked |
| bait_papel | 3 iscas de papel | 5 @ | message m3 found |
| bait_perola | 2 Pérola Negra | 20 @ | ★4 |

When the equipped bait reaches 0, it auto-switches to `massa` with a toast.

### 8.4 Aquarium items

| id | Item | Price | Notes |
|---|---|---|---|
| tank | New tank (2nd / 3rd / 4th) | $500 / $3 000 / $10 000 | new tanks start at cap 12 and filter 14 |
| tankcap | Capacity (per tank) 20 / 32 / 48 | $250 / $1 500 / $6 000 | `opts.tankId` |
| filter | Filter (per tank) 28 / 56 | $300 / $2 500 | |
| feeder | Auto-feeder (per tank) | $1 200 | |
| cofre | Offline cap 4 h / 8 h | $2 000 / $8 000 | |

Decor (each takes one slot):

| id | pt-BR | Tags | Attraction | Price | Stars |
|---|---|---|---|---|---|
| pedras | Pedras | rocks | +2% | $60 | ★1 |
| algas | Algas | plants | +2% | $80 | ★1 |
| coral | Coral | coral | +4% | $300 | ★2 |
| anemona | Anêmona | coral | +4% | $450 | ★2 |
| kelp | Kelp alto | plants | +4% | $400 | ★2 |
| gruta | Gruta | cave, rocks | +3% | $500 | ★2 |
| castelo | Castelo | cave | +6% | $900 | ★3 |
| ostra | Ostra perlífera | sand | +2% | $1 200 | ★3, produces pearls |
| bau | Baú do tesouro | – | +8% (bubbles) | $1 800 | ★3 |
| naufragio | Naufrágio | cave, rocks | +10% | $2 500 | ★4 |
| ruina | Ruína | rocks, cave | +8% | 15 @ | ★4 |
| farol | Farol em miniatura | – | +12% (lights) | 30 @ | ★4 |

### 8.5 Pacing targets (verify with `tests/balance-report.js`)

| Time | Expected milestone |
|---|---|
| 0:03 | first purchase (Linha II or minhocas); ~5 catches |
| 0:08 | Anzol II / Vara II; first uncommon |
| 0:12 | Recife (Barco II + 5 Baía species) |
| 0:20 | tank capacity 20; first rare |
| 0:30 | 2nd tank |
| 0:35 | Kelp |
| 0:50 | Linha III, Molinete III, first breeding |
| 1:10 | Mar Aberto |
| 1:30 | Linha IV, Anzol IV, ★3, 3rd tank |
| 1:55 | Abismo (Barco V + Lanterna I) |
| 2:20 | Linha V, Lanterna II, ★4 |
| 2:30–3:00 | Lula-Tinteira, ending |

Average sale value per catch by zone (expected-value check): Baía ≈ $25, Recife ≈ $72, Kelp ≈ $115, Mar ≈ $270, Abismo ≈ $360. Aquarium income ≈ 15% of total early, 30–45% late.

**Sale value:** `round(value · (0.7 + 0.6q) · (dense ? 4 : 1) · (trophy ? 1.25 : 1) · (bred ? .6 : 1))`.
**Luck:** each release of a fresh catch gives +5% to the current zone, capped at 25%. It is session-only and resets when you change zone.

---

## 9. Bestiary, goals, achievements, messages, story

### 9.1 Bestiary ("Caderno de Campo")

- Tabs: one per zone, plus Avistamentos and Mensagens. Grid of cards with a detail panel.
- Card states: **unknown** = silhouette (every non-space glyph replaced by `·` at level 4) plus `???`. **Seen** = silhouette plus name. **Caught** = full sprite, name, count, record.
- Detail: sprite (with a 2-frame animation in DOM), names (pt-BR and English shown in small text when the UI language is English), flavour, record (length and weight, date), counts (caught, kept, sold, released), Tinta Densa caught yes or no, and **hints**. Hints are always: zone and depth band in words ("fundo", "meia-água", "superfície"); revealed after the first catch or a bottle message: time, weather, best bait.
- Completion % = (caught species + seen sightings) / 45.

### 9.2 Goals (sequential chain; 3 active at once; owner D, `js/data/goals.js`)

| id | Condition (type, params) | Reward |
|---|---|---|
| g01 | catch n=1 | $20 |
| g02 | keep n=1 | $15 |
| g03 | feed n=1 | $10 |
| g04 | buy cat=gear n=1 | 1 @ |
| g05 | discover n=5 | $50 |
| g06 | collectTill n=1 | $20 |
| g07 | unlockZone recife | 2 @ |
| g08 | catchRarity R n=1 | $100 |
| g09 | decorTank n=3 (in one tank) | $80 |
| g10 | fishInAquarium n=10 | $150 |
| g11 | catchAt noite n=1 | $60 |
| g12 | unlockZone kelp | 3 @ |
| g13 | tanks n=2 | $200 |
| g14 | breed n=1 | 2 @ |
| g15 | trophy n=1 | $250 |
| g16 | stars n=3 | 3 @ |
| g17 | unlockZone mar | 5 @ |
| g18 | catchIn tempestade n=1 | $400 |
| g19 | messages n=3 | 3 @ |
| g20 | sighting baleia | $500 |
| g21 | catchSpecies marlim | 5 @ |
| g22 | unlockZone abismo | 5 @ |
| g23 | catchSpecies celacanto | 10 @ |
| g24 | stars n=4 | unlocks Pérola Negra |
| g25 | ending | Tema Papel |
| g26 | completion pct=100 | 20 @ |
| g27 | dense n=5 | 10 @ |
| g28 | stars n=5 | 25 @ |

### 9.3 Achievements (owner D; badge glyphs drawn in UI)

`primeira_fisgada` (first hookset) · `linha_partida` (first snap) · `paciencia` (fight > 60 s) · `coracao_mole` (release 10) · `comerciante` (sell 50) · `tinta_densa` (first dense) · `colecionador` (50% notebook) · `enciclopedia` (100%) · `gigante` (catch XL) · `noite_adentro` (10 night catches) · `tempestade_perfeita` (rare in a storm) · `mao_leve` (5 jellies without tearing) · `tipografia` (Typefish) · `ermitao` (Bottle crab) · `tres_coracoes` (Octopus) · `fazendeiro_do_mar` (breed 10) · `bilheteria_cheia` (collect $10 000 total) · `abissal` (reach 1 500 m) · `frenesi` (3 catches in one frenzy) · `fim_da_tinta` (ending).

### 9.4 Bottle messages (8; owner D strings)

| id | Title | Body (pt-BR) | Effect |
|---|---|---|---|
| m1 | Sobre cavalos-marinhos | Ao amanhecer, com o mar calmo, procure entre o capim-marinho da Baía. Camarão é o que eles aceitam. | hint: cavalo |
| m2 | Garrafas que andam | Algumas garrafas têm pernas. De noite, no fundo da Baía, até massa serve. | hint: ermitao |
| m3 | Isca de papel | Um peixe feito de letras só morde palavras. O Seu Zé vende papel bom. | unlocks `bait_papel`; hint: tipografo |
| m4 | O velho do mar | No Mar Aberto, ao entardecer de céu limpo, um marlim persegue colheres que brilham. | hint: marlim |
| m5 | Fóssil vivo | No fundo do Abismo, à noite, algo antigo segue o jig. Leve uma lanterna forte. | hint: celacanto |
| m6 | Repúblicas à deriva | Quando chove no Mar Aberto, caravelas sobem à superfície. Isca luminosa, mão leve. | hint: caravela |
| m7 | A Lula-Tinteira (I) | "Ela escreveu o mar e está ficando sem tinta. Por isso tudo anda tão pálido." — I. | lore |
| m8 | A Lula-Tinteira (II) | "Numa noite de tempestade, no fundo do Abismo, ofereça-lhe uma pérola negra. Depois, deixe-a ir." — I. | hint: tinteira |

### 9.5 Story notes (owner E; short, diegetic; shown with `AQ.ui.note(id)`)

- `intro`: "Querida, o aquário é seu agora. Os tanques estão vazios — e o mar, cheio. — Vó Iara"
- `firstCatch`: "Todo aquário começa com um peixe pequeno."
- `aquarium`: feeding, light and decor matter.
- `recife`, `kelp`, `mar`, `abismo`: one line each, on first arrival.
- `stars4`: Vó Iara gives you the Pérola Negra recipe.
- `ending`: "Toda tinta volta para o mar. Obrigada por devolver a minha. — I."

### 9.6 Ending flow

1. C lands `tinteira` and calls `AQ.game.resolveCatch(spec, {choice:'release'})`.
2. D records the bestiary entry, sets `progress.ending = true`, emits `ending:start`.
3. E's `ending` scene, about 45 s:
   - ink blooms from the squid (`fx` ink field fills the screen);
   - `AQ.theme.apply('papel', {persist:false})`;
   - credits scroll as canvas text, with caught species parading by;
   - final note;
   - the theme reverts;
   - go to `map`; toast "Tema Papel desbloqueado".

---

## 10. Onboarding: the first 60 seconds

| t (s) | What happens | Owner |
|---|---|---|
| 0 | Title screen: animated logo (per-row sine offset ±0.4 cell), fish swimming behind. Tap or click **Novo jogo** (this first gesture unlocks audio) | E |
| 0–2 | Ink wipe to Baía Rasa, 05:30, calm. Ambience fades in; the boat glides from the left to its anchor | A / C |
| 2–6 | Note card slides up: Vó Iara's `intro`. Dismissed by tap or after 4.5 s | E |
| 6 | A scripted school of 6 manjubas swims in 8–14 u from the boat at depth .3. Hint (input-specific): touch "Arraste para trás e solte para lançar" / mouse "Clique, arraste para trás e solte" / keys "← → para mirar, segure Espaço" + dotted preview | C / E |
| ~9 | Player casts. Splash, ripple. Hint: "A isca afunda…" | C |
| ~11 | Auto-stop at the school's depth (tutorial assist). A manjuba notices and approaches | C / B |
| ~13 | One nibble. Hint: "Ainda não… espere a mordida." | E |
| ~15 | Bite: `!`. Hint: **"AGORA! Toque."** (window 2.0 s) | C / E |
| 16–30 | Tutorial fight (manjuba P .35, stam 4, cannot escape). At 16 s hint "Segure para recolher" (reel button pulses on touch). At ~20 s the scripted run left with tell: hint "Puxe a vara para o outro lado!" plus an arrow (touch: drag right; mouse: move right; keys: D). The tension meter shows the label "mantenha no meio" | C / E |
| ~30 | Landed. Catch card: Manjuba, NOVO!. Only **Guardar** is highlighted (Vender and Soltar are enabled but dim). Note `firstCatch` | C / E |
| ~34 | Toast "+1 espécie no Caderno". A compact "[*] Goals n/28" chip slides in (tap to open the Goals screen; never auto-opens a panel — QA change) | E / D |
| 36–60 | Free fishing; hints only after 8 s idle. The next bite uses normal rules (likely tainha or siri) | C |
| after 2nd catch | Hint pointing at **Aquário**: "Seu peixe está esperando." Aquarium tutorial: tap fish → card; tap **Alimentar** (first feed free); tap **Bilheteria** | E / D |

Tutorial step ids (`state.tutorial.step`): `0 intro`, `1 cast`, `2 sink`, `3 nibble`, `4 strike`, `5 reel`, `6 steer`, `7 keep`, `8 free`, `9 goAquarium`, `10 card`, `11 feed`, `12 till`, `13 done`. Skippable from Settings ("Pular tutorial") and by `hints: false`.

---

## 11. Screens and flow

```
            +---------+   Continuar/Novo   +--------+  zone card "Pescar"  +---------+
 load ----> |  TITLE  | -----------------> |  MAP   | -------------------> | FISHING |
            +---------+                    | (hub)  | <------------------- |         |
                 ^  Configurações/Créditos +--------+   [< Mapa]           +---------+
                 |                         |  ^   ^                               | catch
                 |                [Aquário]|  |   |[Mapa]                         v
                 |                         v  |   |                         CATCH CARD (modal)
                 |                    +----------+
                 |                    | AQUARIUM |-- fish card / decor picker / tank picker
                 |                    +----------+
   overlays from any hub scene: SHOP · CADERNO (bestiary) · METAS (goals/achievements)
   PAUSE (Esc/[||]) → Settings · Caderno · Voltar ao mapa · Menu de jogos (../index.html)
   ENDING (scene) → MAP
```

HUD modes are set by E from `scene:changed`: `title` → none, `map` → hub, `aquarium` → hub + aquarium toolbar, `fishing` → fishing, `ending` → none.

### 11.1 Title

Desktop (landscape):
```
+------------------------------------------------------------------------+
|   .        '              .                 '            .        '    |
|                                ´                                        |
|        _     ___  _   _    _         _____  ___  _  _  _____    _       |
|       /_\   / __|| | | |  /_\   ___ |_   _||_ _|| \| ||_   _|  /_\      |
|      / _ \ | (_ || |_| | / _ \ |___|  | |   | | | .` |  | |   / _ \     |
|     /_/ \_\ \___| \___/ /_/ \_\       |_|  |___||_|\_|  |_|  /_/ \_\    |
|  ~-~~-~~-~~   p e s c a   e   a q u á r i o   e m   a s c i i   ~~-~~  |
|      ><°>            [ Continuar ]                                      |
|               ><°>   [ Novo jogo ]                  .---.               |
|   ><°>               [ Configurações ]            ><(  °)=              |
|                      [ Créditos ]                   `---´               |
|     )(        ,;,                 )(        ,;,                )(       |
|  ,.;)(;:,..,;:;:;,.,;:,.;:,..,;:;)(:;,.,;:;:;,.,;:,..,;:;:,.,;)(;:,.   |
|  < Menu de jogos                                  PT | EN       v1.0    |
+------------------------------------------------------------------------+
```
Phone portrait:
```
+------------------------------+
|  .      '        .     '     |
|   (logo.tall: ÁGUA / TINTA)  |
|   pesca e aquário em ascii   |
|  ><°>        ><°>            |
|     [    Continuar     ]     |
|     [    Novo jogo     ]     |
|     [  Configurações   ]     |
|     [     Créditos     ]     |
|  )(    ,;,     )(   ,;,  )(  |
| ,)(;:,.,;:;,.,;)(,.;:;:,.)(, |
|  < Menu      PT | EN   v1.0  |
+------------------------------+
```
Phone landscape uses the desktop layout with `logo.wide` if cols ≥ 70, else `logo.tall` on the left and buttons on the right.

### 11.2 Map (hub)

Landscape: coast on the left, deeper water to the right.
```
+------------------------------------------------------------------------+
| $ 1.250   @ 12           06:40 · Amanhecer · Nublado            [ || ]  |
+------------------------------------------------------------------------+
|  _____   ~    ~     ~      ~       ~        ~        ~         ~       |
| |AQUÁ-| ~ BAÍA RASA ~  RECIFE   ~  FLORESTA  ~   MAR      ~  ?????     |
| | RIO |    9/10   ~   #%# 6/7 ~   DE KELP  ~   ABERTO   ~  ABISMO     |
| |_[]__| ~  ~  ~  ~  ~  ~  ~  ~   )()( 2/7 ~   [Barco IV] ~ [Barco V]   |
|  ____  ===|==== cais  ~   ~   ~   ~  ~   ~   ~   ~   ~   ~   ~   ~     |
| |LOJA|   \o_/~~   ~   ~    ~   ~    ~    ~     ~     ~     ~           |
|   Previsão: Nublado > Chuva > Limpo            [ Esperar até... ]       |
+------------------------------------------------------------------------+
| [ Mapa ]  [ Aquário  $+340 ]  [ Loja ]  [ Caderno 23/45 ]  [ Metas 2/3 ] |
+------------------------------------------------------------------------+
```
Portrait: coast at the bottom, deeper water upward.
```
+------------------------------+
|$1.250 @12  06:40 ^ ~   [||]  |
+------------------------------+
| ~  ?????  ABISMO     ~   ~   |
|    (requer Barco V)     ~    |
| ~  MAR ABERTO 4/9    ~   ~   |
|   ~   ~    ~    ~   ~   ~    |
| ~ FLORESTA DE KELP 2/7  ~    |
|   )()(   ~    ~   )()(       |
| ~  RECIFE 6/7  #%#   ~   ~   |
| ~  BAÍA RASA 9/10   ~   ~    |
| ~~~~~~~~~~ \o_/ ~~~~~~~~~~~  |
| _____  ===|=== cais   ____   |
||AQUÁ-|  Previsão:    |LOJA|  |
||_RIO_|  ~ > ' > o    |____|  |
+------------------------------+
|[Mapa][Aquário][Loja][Cad][Me]|
+------------------------------+
```
Tapping a zone opens the **zone card** (E): name, depth range, current time and weather and forecast, species `n/total`, best-now list (discovered species whose conditions are met now), and buttons [ Pescar ] [ Esperar até ▾ ] [ x ]. Locked zones show their requirements with progress ("5 espécies da Baía (3/5)", "Barco II $400").

### 11.3 Fishing

Desktop (waiting, then fight):
```
| < Mapa  $ 1.250  @ 12    BAÍA RASA · 06:40 Amanhecer · Limpo     [ || ] |
|                    .                       o                            |
|         \o                                                              |
|  _______/|\___                                                          |
| ~\____________/~~~-~~~~^~~~~~~-~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~  0m |
|    /  /    /   '  \        .                \           \          -   |
|   /  /    /    ><°>  \ ><°>                                        -   |
|  /         ><°>   ><°>\           !                               5m   |
|        .        .     \__  <<< ><(  °)=                           -    |
|   ,;,  )(        .     ,;,       )(           ,;,  )(           < 8m   |
| _,;:;,_)(__..,,;;:,,.._,;:;,.__.,)(__,.,;:;,..__,;:;,..__.,_,.__  12m  |
|  VARA <--[|]-->     FÔLEGO )))))))---    TENSÃO [....::::====##!!]     |
|  [Isca: minhoca x8]                       ^                [Recolher]  |
```
Phone portrait:
```
|< $1.250 @12  06:40 ^   [||] |
|        BAÍA RASA            |
|            \o               |
|      _____/|\____           |
| ~~~~\__________/~~~~~~~~ 0m |
|   /   /   /  \       /    - |
|      ><°>     \            - |
|  ><°>    ><°>  \  !      5m |
|                 \__ <<<     |
|          ><(  °)=          - |
|  )(  ,;,       )(  ,;,  8m< |
| _)(_,;:;,.__.,,)(_,;:;,_12m |
|  FÔLEGO  )))))))---         |
|  TENSÃO [..:::===##!!]      |
|  VARA <--[|]-->             |
| [minhoca x8]    .-----.     |
| [Recolher]      ( (@) )     |
|                 '-----'     |
```
Phone landscape: the same as desktop. The meters sit in one bottom row, and the (@) button overlaps the bottom-right corner (bottom-left for left-handed players).

### 11.4 Catch card (modal)
```
+-- NOVO! -----------------------------------------+
|                .---.                             |
|             ><(  °)=          (2× <pre>)         |
|                `---´                             |
|   BAIACU   **   Incomum      Troféu!             |
|   27,4 cm · 0,58 kg           Recorde: 27,4 cm   |
|   "Quando contrariado, vira uma bola de          |
|    opiniões espinhosas."                         |
|  [1 Guardar (T1 8/12)] [2 Vender $46] [3 Soltar] |
+--------------------------------------------------+
```
Portrait: the same content stacked, with buttons full-width, one per row.

### 11.5 Aquarium

Desktop:
```
| $ 1.250  @ 12     AQUÁRIO · Tanque 1/2 · ***    :) 78% · 8/12   [ || ] |
|  [<] +------------------------------------------------------+ [>]      |
|      |  \|/ (lamp)          °                    o          |          |
|      |              ><°>          ><°>           °    )(    |          |
|      |   ><(  °)=                     .---.      o    )(    |          |
|      |  )(     ,-.        ><°>      ><(  °)=          )(    |          |
|      |__)(____(   )_,.;:;,..,;:.,_,;:;,.__[#]___/^\___)(____|          |
|      +------------------------------------------------------+          |
|        o     o              o                      o                   |
|       /|\   /|\   !        /|\                    /|\                  |
|  [Alimentar $6] [Decorar] [Luz: Dia] [Contemplar]  [Bilheteria $340]   |
| [ Mapa ]  [ Aquário ]  [ Loja ]  [ Caderno ]  [ Metas ]                 |
```
Portrait:
```
|$1.250 @12  Tanque 1/2  [||] |
|  ***  :) 78%  8/12          |
|+---------------------------+|
||  \|/        °             ||
||   ><°>    ><°>     o      ||
||       .---.        °  )(  ||
||    ><(  °)=           )(  ||
||  )(   ,-.     ><°>    )(  ||
||__)(__(   )_,.;:;,.[#]_)(__||
|+---------------------------+|
|   o     o          o        |
|  /|\   /|\  !     /|\       |
|[Alimentar $6][Decorar][Luz] |
|[<] [Bilheteria $340] [>]    |
|[Mapa][Aquário][Loja][Cad][Me]|
```

### 11.6 Shop ("Venda do Seu Zé")

Desktop:
```
+-- Venda do Seu Zé ------------------------------------------- [x] --+
| [Equipamento] [Iscas] [Barco] [Aquário] [Decoração]    $ 1.250  @ 12 |
|---------------------------------------------------------------------|
|  /|    Vara de fibra (II)       Arremesso 26 → 34                    |
|  /     "Flexível e honesta."   Fisgada +0,05 s     [ $ 120 Comprar ] |
|  (@)   Molinete de rolamento    Recolhe 9 → 11                       |
|        Requer: Molinete II                         [ $ 1.000     ]   |
|  ---   Linha trançada (III)     Força 1,25 → 1,55  Alcance 130→180 m |
+---------------------------------------------------------------------+
```
Portrait: tabs become a horizontally scrolling row; each item is a stacked card (icon, name, stat deltas, price button full-width).

### 11.7 Bestiary
```
+-- Caderno de Campo --------------------------- 23/45 (51%) --- [x] -+
| [Baía 8/10] [Recife 5/7] [Kelp 3/7] [Mar 4/9] [Abismo 0/9] [Avist.] [Msg]|
|  +--------+ +--------+ +--------+ +--------+ +--------+             |
|  |  ><°>  | | .---.  | | ·····  | | ·····  | |  ····  |             |
|  |Manjuba | |Baiacu  | |  ???   | |Arraia  | |  ???   |             |
|  |  x14   | |  x3  * | |        | | (vista)| |        |             |
|  +--------+ +--------+ +--------+ +--------+ +--------+             |
|  > BAIACU  ** Incomum · Baía Rasa · meia-água                        |
|    Recorde 27,4 cm · Pescados 3 · Guardados 1 · Isca: camarão        |
+---------------------------------------------------------------------+
```
Portrait: two-column card grid; detail opens as a full-screen sheet.

### 11.8 Settings (portrait shows one control per row, scrolling)
```
+-- Configurações -------------------------------------------- [x] -+
| Idioma               [ Português (BR) | English ]                  |
| Volume geral         [========--] 80%                              |
| Música / Efeitos / Ambiente   (three sliders)                      |
| Qualidade            [ Auto | Alta | Média | Baixa ]               |
| Movimento            [ Fluido | Grade clássica ]                   |
| Reduzir movimento    [ Auto | Sim | Não ]                          |
| Tamanho do glifo     [ Auto | 12 | 14 | 16 | 18 | 20 ]             |
| Escala da interface  [ 85% | 100% | 115% | 130% ]                  |
| Alto contraste [ ]   Tema [ Noite | Papel (termine a história) ]   |
| Vibração [x]   Mostrar FPS [ ]   Dicas de controle [x]             |
| Mão [ Destra | Canhota ]   Assist.: [ ] Vara automática [ ] Janelas |
| Tela cheia [ Entrar ]      Tutorial [ Pular ]                      |
| Save  [ Exportar ] [ Importar ] [ Apagar save... ]                 |
+-------------------------------------------------------------------+
```

### 11.9 Pause
```
+-- Pausa ---------------+
|  [ Continuar        ]  |
|  [ Configurações    ]  |
|  [ Caderno          ]  |
|  [ Voltar ao mapa   ]  |
|  [ Menu de jogos    ]  |
+------------------------+
```

UI component look (E, `css/ui.css`):
- Panels have a 1 px ink border at 45% with `+` corner marks; the title is inset in the top border (`+-- Loja ----+`).
- Buttons read `[ Texto ]` (brackets via pseudo-elements). Hover and focus invert colours; pressed adds a 1 px inset; disabled is ink at 35%.
- Tap targets ≥ 48 px. Toasts are top-centre, monospace, inverted for "rare".

---

## 12. Game feel (juice) and reduced motion

| Effect | Normal | Reduced motion |
|---|---|---|
| Surface waves | 1D height field (3 sines + impulse ripples, damping .985), `wave` ramp by slope | amplitude × .4, no impulses |
| Light rays | diagonal `/` or `\` bands at levels 1–3, drifting at .2 u/s, by sun angle | static |
| Caustics | animated value noise thresholded on shallow floors, `light` ramp | static pattern |
| Bubbles | rise with sine wobble, grow `·°oO`, pop `*` + small ripple | straight rise |
| Splash | 8–20 `foam` particles in arcs + ripple ring `( )` growing | 4 particles, no ring |
| Body deform | swim / pulse / sway | amplitude × .3 |
| Line tension | jitter ∝ T > .85, bold glyphs | bold only |
| Camera | boat bob ±.3 row; shake 2–4 px on bite and snap | no bob, no shake |
| Catch | fish lifted, droplets, angler cheer, "NOVO!" ink bloom (radial `*` → `.`) | bloom as a 200 ms fade |
| Coins | `$` floats up and fades (sale, till) | fade in place |
| Transitions | ink wipe: columns sweep the `density` ramp, 400 ms | 200 ms cross-fade |
| Lightning | top veil, level 3, 120 ms, at most every 4 s | level-1 dim pulse |
| Tank emotes | `<3` over happy fish after feeding; `?` hungry; `...` sad | same (static) |
| Rare shimmer | `*` blink | slower (every 2 s) |
| Logo | per-row sine offset ripple | static |

Reduced motion follows `settings.reducedMotion`: `auto` honours `prefers-reduced-motion`. `AQ.fx.motion()` returns 1 or .3, and every owner multiplies amplitudes by it.

---

## 13. Audio (owner E; Web Audio only, no files)

Graph: `master → DynamicsCompressor → destination`, with buses `music`, `sfx` and `ambience`, each a GainNode driven by settings. The context is created on `app:gesture`, suspended on `app:hidden`, resumed on `app:visible`.

- **Ambience.** Brown noise through a lowpass at 600–1 200 Hz with a slow LFO (waves), plus random "bloop" bubbles (sine 300–900 Hz, 40 ms, pitch drop). Underwater mix: lowpass cutoff falls with hook depth (1 200 Hz → 300 Hz). Rain adds band-passed white noise; storms add low rumbles.
- **Generative music.** 60–72 BPM. Two voices: a soft triangle pluck (attack 5 ms, decay 1.2 s) and a sine pad (8 s swells). A feedback-delay "room" (0.38 s, feedback .35, lowpass 2 kHz). Each step plays with probability .35; the melody is a Markov walk (steps ±1–2 scale degrees, a rest 30% of the time). Mood per zone and phase:
  - baia: C major pentatonic, bright register
  - recife: D lydian
  - kelp: A dorian
  - mar: E mixolydian, wider intervals
  - abismo: low drones in D phrygian, sparse
  - night: the zone scale an octave down with a slower tempo
- **Fight layer.** A low ostinato whose rate tracks tension (`setTension`); danger above .85 adds a high tremolo. Bosses add a sustained low pad. `quality.musicVoices` caps polyphony (6/4/3).
- **SFX recipes** (`AQ.audio.sfx(name)`):

| Name | Recipe |
|---|---|
| cast | noise sweep, bandpass 400 → 2 000 Hz, 300 ms |
| splashSmall / splashBig | noise burst + lowpass sweep, 120 / 300 ms |
| reel | 4 ms ticks at a rate ∝ reel speed |
| nibble | sine 1.2 kHz, 15 ms |
| bite | sine 140 → 90 Hz, 120 ms ("tok") |
| hook | plucked twang (Karplus-Strong, 220 Hz) |
| tension | soft creak, filtered noise |
| snap | twang + noise crack, descending |
| escape | glide 600 → 200 Hz |
| catch | 4-note arpeggio up |
| newSpecies | arpeggio + bell (2 detuned sines, 3 s decay) |
| rare | shimmer (high sines with tremolo) |
| legendary | gong (inharmonic partials) + low pad |
| coin | two-tone ding |
| pearl | glassy bell |
| feed | sprinkle (5 tiny ticks) |
| bubble | blip |
| buy | cash ding |
| goal | 3-note fanfare |
| uiTap / uiBack / uiOpen | short ticks |
| error | low buzz, 80 ms |
| splash-jump | splashBig panned to the fish's x |

---

## 14. Settings (persisted in `localStorage['aquario-ascii.settings']`)

| Key | Default | Values | Effect (who applies it) |
|---|---|---|---|
| `lang` | `'pt-BR'` | `'pt-BR'`, `'en'` | i18n (A), live re-render (E) |
| `volMaster` / `volMusic` / `volSfx` / `volAmbience` | .8 / .55 / .8 / .6 | 0–1 | audio buses (E) |
| `quality` | `'auto'` | auto, high, medium, low | perf params (A) |
| `reducedMotion` | `'auto'` | auto, on, off | `AQ.fx.motion()` (A) |
| `motionStyle` | `'fluid'` | fluid, grid | render snapping and deform (A) |
| `glyphSize` | `'auto'` | auto, 11, 12, 14, 16, 18, 20 | canvas font px (A) |
| `uiScale` | 1 | .85, 1, 1.15, 1.3 | CSS `--ui-scale` (A sets the var, E uses it) |
| `highContrast` | false | bool | theme + level remap (A) |
| `theme` | `'noite'` | noite, papel (needs `player.unlocks.paperTheme`) | theme (A) |
| `haptics` | true | bool | haptics (E) |
| `showFps` | false | bool | perf overlay (A) |
| `hints` | true | bool | control hints and tutorial hints (E) |
| `handedness` | `'right'` | right, left | reel button and fishing HUD side (E) |
| `autoSteer` | false | bool | fight rod assist (C) |
| `wideWindows` | false | bool | bite window × 1.5 (C) |

"Apagar save" opens a confirm dialog (danger style), then a second confirm whose button only enables after 1.5 s. It resets the save but keeps settings.

---

## 15. Technical architecture

### 15.1 File tree and ownership (disjoint)

```
aquario-ascii/
  index.html                         A
  README.md                          QA (A creates a stub)
  DESIGN.md                          lead (this file)
  css/style.css                      A   reset, theme vars, @font-face, stage/canvas stack, safe areas, #boot, #fps
  css/ui.css                         E   every overlay component
  fonts/JetBrainsMonoNL-Regular.woff2   A (vendored)
  fonts/JetBrainsMonoNL-Bold.woff2      A (vendored)
  fonts/LICENSE-JetBrainsMono.txt       A (copy of the package LICENSE; font is SIL OFL 1.1)
  js/core/ns.js                      A   AQ root, VERSION, ENUM, themes, charset, storage keys
  js/core/util.js                    A   math, noise, deepMerge, AQ.textart
  js/core/rng.js                     A
  js/core/events.js                  A
  js/core/i18n.js                    A
  js/core/store.js                   A   AQ.store (save), AQ.settings, AQ.state
  js/data/strings-ui.js              E   ui.* hud.* settings.* tut.* note.* credits.* rarity.* size.* common.*
  js/data/strings-world.js           B   sp.* sighting.* zone.* phase.* weather.* kind.* behavior.*
  js/data/strings-fishing.js         C   fish.* (HUD labels, escape reasons, tips, map)
  js/data/strings-economy.js         D   item.* goal.* ach.* msg.* aq.* (aquarium scene labels)
  js/data/sprites.js                 B
  js/data/art.js                     B
  js/data/species.js                 B
  js/data/zones.js                   B
  js/data/items.js                   D
  js/data/goals.js                   D   goals chain, achievements, messages
  js/logic/world.js                  B
  js/logic/spawn.js                  B
  js/logic/creatures.js              B
  js/logic/line.js                   C
  js/logic/bite.js                   C
  js/logic/fight.js                  C
  js/logic/economy.js                D
  js/logic/aquarium.js               D
  js/logic/progress.js               D
  js/logic/game.js                   D   AQ.game (all player-state mutations)
  js/engine/theme.js                 A
  js/engine/display.js               A
  js/engine/atlas.js                 A
  js/engine/render.js                A
  js/engine/fx.js                    A
  js/engine/input.js                 A
  js/engine/scenes.js                A
  js/engine/perf.js                  A
  js/engine/loop.js                  A
  js/engine/debug.js                 A
  js/audio/audio.js                  E
  js/audio/sfx.js                    E
  js/audio/music.js                  E
  js/platform/haptics.js             E
  js/ui/dom.js                       E
  js/ui/hud.js                       E
  js/ui/modals.js                    E   confirm, toast, note, hint layer
  js/ui/menus.js                     E   title menu, pause, settings, save IO, credits
  js/ui/shop.js                      E
  js/ui/bestiary.js                  E
  js/ui/cards.js                     E   catch card, fish card, zone card, decor/tank/bait pickers, offline summary
  js/ui/goals.js                     E
  js/ui/tutorial.js                  E
  js/scenes/title.js                 E
  js/scenes/ending.js                E
  js/scenes/map.js                   C
  js/scenes/fishing-bg.js            C
  js/scenes/fishing-hud.js           C
  js/scenes/fishing.js               C
  js/scenes/aquarium.js              D
  js/main.js                         A
  tests/loader.js                    A
  tests/run.js                       A
  tests/test-rng.js                  A
  tests/test-store.js                A
  tests/test-contracts.js            A
  tests/test-species.js              B
  tests/test-sprites.js              B
  tests/test-spawn.js                B
  tests/test-world.js                B
  tests/test-fight.js                C
  tests/test-line.js                 C
  tests/test-bite.js                 C
  tests/balance-report.js            C (fights) + D (pacing section)
  tests/test-economy.js              D
  tests/test-aquarium.js             D
  tests/test-progress.js             D
  tests/test-game.js                 D
  tests/test-i18n.js                 E
```

**Font vendoring** (A, in the scratch directory, never inside the repo): `npm pack jetbrains-mono@1.0.6`, then extract `package/fonts/webfonts/JetBrainsMonoNL-Regular.woff2`, `JetBrainsMonoNL-Bold.woff2` and `package/LICENSE` (about 50 KB each). Use the **NL** (no ligatures) files so `->` and `<=` never merge in HTML. If vendoring fails, fall back to the system stack `ui-monospace, "SFMono-Regular", Menlo, Consolas, "Liberation Mono", monospace`. The atlas fits any glyph to the cell, so fallback fonts cannot break the grid.

### 15.2 index.html and script order (classic scripts, no modules, works on file://)

```html
<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">
<meta name="theme-color" content="#0e0d0b">
<title>Água-Tinta — Aquário ASCII</title>
<link rel="stylesheet" href="css/style.css">
<link rel="stylesheet" href="css/ui.css">
</head>
<body>
<div id="app">
  <div id="stage"><canvas id="cv-bg"></canvas><canvas id="cv-main"></canvas><canvas id="cv-top"></canvas></div>
  <div id="ui"></div>
  <div id="boot">Água-Tinta · carregando…</div>
  <div id="fps" hidden></div>
</div>
<noscript>Este jogo precisa de JavaScript.</noscript>
<!-- core -->
<script src="js/core/ns.js"></script>
<script src="js/core/util.js"></script>
<script src="js/core/rng.js"></script>
<script src="js/core/events.js"></script>
<script src="js/core/i18n.js"></script>
<script src="js/core/store.js"></script>
<!-- data -->
<script src="js/data/strings-ui.js"></script>
<script src="js/data/strings-world.js"></script>
<script src="js/data/strings-fishing.js"></script>
<script src="js/data/strings-economy.js"></script>
<script src="js/data/sprites.js"></script>
<script src="js/data/art.js"></script>
<script src="js/data/species.js"></script>
<script src="js/data/zones.js"></script>
<script src="js/data/items.js"></script>
<script src="js/data/goals.js"></script>
<!-- logic (pure) -->
<script src="js/logic/world.js"></script>
<script src="js/logic/spawn.js"></script>
<script src="js/logic/creatures.js"></script>
<script src="js/logic/line.js"></script>
<script src="js/logic/bite.js"></script>
<script src="js/logic/fight.js"></script>
<script src="js/logic/economy.js"></script>
<script src="js/logic/aquarium.js"></script>
<script src="js/logic/progress.js"></script>
<script src="js/logic/game.js"></script>
<!-- engine -->
<script src="js/engine/theme.js"></script>
<script src="js/engine/display.js"></script>
<script src="js/engine/atlas.js"></script>
<script src="js/engine/render.js"></script>
<script src="js/engine/fx.js"></script>
<script src="js/engine/input.js"></script>
<script src="js/engine/scenes.js"></script>
<script src="js/engine/perf.js"></script>
<script src="js/engine/loop.js"></script>
<script src="js/engine/debug.js"></script>
<!-- audio / platform -->
<script src="js/audio/audio.js"></script>
<script src="js/audio/sfx.js"></script>
<script src="js/audio/music.js"></script>
<script src="js/platform/haptics.js"></script>
<!-- ui -->
<script src="js/ui/dom.js"></script>
<script src="js/ui/hud.js"></script>
<script src="js/ui/modals.js"></script>
<script src="js/ui/menus.js"></script>
<script src="js/ui/shop.js"></script>
<script src="js/ui/bestiary.js"></script>
<script src="js/ui/cards.js"></script>
<script src="js/ui/goals.js"></script>
<script src="js/ui/tutorial.js"></script>
<!-- scenes -->
<script src="js/scenes/title.js"></script>
<script src="js/scenes/map.js"></script>
<script src="js/scenes/fishing-bg.js"></script>
<script src="js/scenes/fishing-hud.js"></script>
<script src="js/scenes/fishing.js"></script>
<script src="js/scenes/aquarium.js"></script>
<script src="js/scenes/ending.js"></script>
<!-- boot -->
<script src="js/main.js"></script>
</body>
</html>
```

### 15.3 Code conventions (all agents)

- Each file is one IIFE: `(function (AQ) { 'use strict'; … })(window.AQ);`. No other globals. No top-level `let`/`const` outside the IIFE.
- ES2020 maximum: optional chaining is OK. Not allowed: `??=`, private `#fields`, top-level await, ES modules, `import`.
- **Pure files** (`js/core`, `js/data`, `js/logic`) must not touch `document`, `navigator`, `localStorage`, `requestAnimationFrame` or `AudioContext` **at load time**. At call time they use guarded accessors (`AQ.store` backend, `AQ.util.now()`). They must run in Node through `tests/loader.js`.
- Data files call `AQ.i18n.add('pt-BR', {...})` and `AQ.i18n.add('en', {...})` for their own keys. **No user-visible string literal outside the string files**, except debug output.
- No per-frame allocation in hot paths: reuse arrays, pool particles, and pass `out` arrays to deformers.
- Errors in one module must not kill the loop: `AQ.events` catches listener errors, and scenes wrap update and draw in try/catch in debug mode, with a toast.
- **Stub rule:** on day one A creates every file above that **does not already exist** (never overwrite). Each stub defines its namespace and every contract function from §15.5 returning a neutral value (`null`, `0`, `false`, `[]`, `{}`, `''`, or `Promise.resolve()`), and registers no-op scenes for `title/map/fishing/aquarium/ending`. Owners replace their stubs entirely. B publishes `manjuba` and `baiacu` (data + sprite) first so C and D can integrate early.

### 15.4 Namespace layout and enums (`js/core/ns.js`, A)

```js
AQ.VERSION = '1.0.0'; AQ.SAVE_VERSION = 1; AQ.ASPECT = 2;   // world units per grid row
AQ.STORAGE_KEYS = { save: 'aquario-ascii.save', backup: 'aquario-ascii.save.bak', settings: 'aquario-ascii.settings' };
AQ.THEMES = { noite: {bg:'#0e0d0b', ink:'#e9dfc7'}, noiteHC: {bg:'#050504', ink:'#f7f0de'},
              papel: {bg:'#e9dfc7', ink:'#0e0d0b'}, papelHC: {bg:'#f7f0de', ink:'#050504'} };
AQ.CHARSET = { sprite: '<printable ASCII>' + '°·´¨¯¸×÷«»¦øº¬', textExtra: 'ÁÂÃÀÇÉÊÍÓÔÕÚÜáâãàçéêíóôõúüª¿¡©§' };
AQ.ENUM = {
  RARITY:['C','U','R','L'], RARITY_W:{C:100,U:35,R:8,L:0},
  SIZE:['XS','S','M','L','XL','XXL'], SIZE_COST:{XS:1,S:2,M:4,L:8,XL:16,XXL:Infinity},
  SIZE_MAX:{XS:[6,2],S:[12,4],M:[18,5],L:[26,7],XL:[34,9],XXL:[48,14]},
  ZONES:['baia','recife','kelp','mar','abismo'], PHASES:['amanhecer','dia','entardecer','noite'],
  WEATHER:['limpo','nublado','chuva','tempestade'],
  BAITS:['massa','minhoca','camarao','lula','luminosa','colher','jig','papel','perola'], LURES:['colher','jig'],
  HABITAT:['sand','plants','rocks','coral','cave','open'], LIGHT:['day','dim','night'],
  DIET:['prey','grazer','filter','predator'],
  KIND:['fish','crustacean','cephalopod','jelly','eel','ray','shark','odd'],
  BEHAVIOR:['school','dart','cruise','lurk','drift','crawl','burrow','hover','leap','ambient'],
  FIGHT:['puller','runner','diver','jumper','shaker','burrower','deadweight','drifter','inflater','inker','boss'],
  GEAR:['rod','line','reel','hook','lantern','boat'],
  ESCAPE:['snap','slack','thrown','tear','fray','spooled','loose','slip'],
  SIGHTINGS:['baleia','golfinhos','tartaruga'], QUALITY:['high','medium','low'],
  SCENES:['title','map','fishing','aquarium','ending'],
};
```

### 15.5 Module APIs (the contracts)

Notation: `name(arg: type) → return`. "u" = world units. Every mutator of save state lives in `AQ.game` (D), except: `state.world` (B via `AQ.world`), `state.meta` and settings (A), and `state.tutorial` (E). Mutators call `AQ.store.markDirty()`.

#### A — core

```
AQ.util
  clamp(v,a,b), lerp(a,b,t), invLerp(a,b,v), smoothstep(e0,e1,x), damp(cur,target,lambda,dt) → number
  wrap(v,n), sign(v), easeOutCubic(t), easeInOutSine(t)
  noise1(x), noise2(x,y), noise3(x,y,z) → [0,1] value noise (fixed seed); fbm2(x,y,octaves=3) → [0,1]
  deepClone(o), deepMerge(target, defaults) → target  // fills missing keys only, recursively
  now() → ms (Date.now; tests may override AQ.util.now)
  fmtClock(minutesOfDay) → 'HH:MM'
  fixedStep(acc:{t:number}, dt, step, fn:(step)→void) → steps run   // accumulator, max 8 per call
AQ.textart
  MIRROR: object; mirrorLine(s) → s; mirror(lines) → lines; pad(lines) → lines; width(lines); height(lines)
  silhouette(lines, ch='·') → lines; densify(lines) → lines   // . → :  , → ;  - → =  ' → "  ` → "  ~ → =  o → O
  autoMask(lines) → mask lines; badChars(lines, charset) → string[]
AQ.rng
  hash(str) → uint32 (FNV-1a 32); create(seed: uint32|string) → Rng (mulberry32); global: Rng (cosmetic only)
  Rng: next() → [0,1); int(n); irange(a,b); range(a,b); chance(p) → bool; pick(arr); weighted(arr, wFn) → item;
       normal(mu=0, sd=1); shuffle(arr); fork(label) → Rng; getState() → uint32; setState(s)
AQ.events
  on(name, fn) → off(); once(name, fn) → off(); off(name, fn); emit(name, payload); clear()
AQ.i18n
  LANGS: ['pt-BR','en']; lang; add(lang, dict); t(key, vars?) → string   // missing → pt-BR → '[key]'; {var} interpolation
  tn(key, n, vars?) → string   // uses key + '.one'/'.other' via Intl.PluralRules; vars.n = formatted n
  has(key, lang?) → bool; keys(lang) → string[]; setLang(lang) (emits 'lang:changed')
  num(n, decimals=0) → '1.250,5'; money(n) → '$ 1.250'; pearls(n) → '@ 12'; pct(x) → '78%'; date(ts) → locale short date
AQ.store
  defaults() → SaveState (v1, §15.8); load() → SaveState (sets AQ.state; migrates; corrupt → .bak + defaults)
  save(reason?) → bool; markDirty(); reset() → SaveState (keeps settings; emits 'save:reset')
  migrate(obj) → obj (pure, sequential MIGRATIONS[v+1]); MIGRATIONS: {[toVersion]: fn(obj) → obj}
  exportString() → 'AT1:' + base64(utf8 JSON) + ':' + crc32hex; importString(str) → {ok, error?}
  backend: {getItem,setItem,removeItem} (localStorage, or an in-memory fallback in Node or when blocked)
  autosave: every 15 s when dirty; also on 'app:hidden' and 'pagehide'
AQ.settings
  DEFAULTS; get(key); set(key, value) (validates/clamps; persists; emits 'settings:changed'); all() → copy; reset()
AQ.state   // the live SaveState object (read freely; mutate only through owners)
```

#### A — engine

```
AQ.theme
  name, bg, ink, bgRgb:'14 13 11', inkRgb; apply(name?, {persist=true}) // from settings theme+highContrast; sets CSS vars,
  rebuilds the atlas, invalidates the bg grid; emits 'theme:changed'
AQ.display
  init(stageEl) → Promise   // waits document.fonts.load('16px ATMono') (timeout 1500 ms), sizes canvases, builds the atlas
  cols, rows, cellW, cellH (CSS px), cellWd, cellHd (device px), dpr, fontPx, originX, originY (CSS px)
  width, height (CSS px), orientation:'portrait'|'landscape', isTouch, safe:{top,right,bottom,left} (CSS px)
  canvases:{bg,main,top}, ctx:{bg,main,top}; metrics() → plain snapshot; refresh()
AQ.atlas
  build(fontPx, dpr, inkCss, family); code(ch, bold=false) → int (lazy add; bit 9 = bold); draw(ctx, code, xDev, yDev)
  count; capacity (256 per weight)
AQ.render
  ALPHA: Float32Array(16); lv(a 0..1) → level; RAMPS; ramp(name, v) → ch; code(ch, bold?) → int
  grid: { cols, rows, clear(), put(c,r,ch,level,bold?), putCode(c,r,code,level), putMax(c,r,code,level),
          get(c,r) → {code, level}, text(c,r,str,level,opts?), fill(c0,r0,w,h,ch,level) }
  cam: { x, y, set(x,y), shake: {x,y} (read-only, from fx) }
  worldToScreen(wx,wy) → {x,y}; screenToWorld(px,py) → {x,y}; worldToCell(wx,wy) → {c,r}; cellToScreen(c,r) → {x,y}
  glyph(code, x, y, level)          // CSS px, top-left of the cell box (main layer)
  glyphW(code, wx, wy, level)       // world
  glyphC(code, c, r, level)         // grid cell
  text(str, c, r, level, opts?{bold, align:'left'|'center'|'right', knock:false}) → cols drawn   // main layer
  textW(str, wx, wy, level, opts?)
  compile(lines, mask?) → Frame {w, h, lines, codes:Uint16Array, mask:Uint8Array, flipped():Frame}  (cached by array identity)
  sprite(frame, wx, wy, opts?) // (wx, wy) = CENTER of the sprite box in world units
      opts: {flip=false, level=12, bold=false, deform='none', amp=1, t=0, knock=true|'bbox'|false,
             glyphMap:(ch,c,r)→ch|null, levelMap:(c,r,level)→level, dissolve=0..1}
  knock(x,y,w,h,alpha=.92) (CSS px); knockC(c,r,w,h,alpha)
  DEFORMERS: { swim, pulse, sway, crawl, jitter, none }  // (c, r, w, h, t, amp, out:[dx,dy]) in cells
```
Deformers:
- `swim`: `dy = .12·amp·sin(2π·1.6t − .5c)·((w−c)/w)^1.5`, `dx = .05·amp·sin(…)`.
- `pulse`: `dy = .15·amp·sin(2π·.8t − .8r)·r/h`, `dx = (c − w/2)·.04·amp·sin(2π·.8t)` for bell rows (r < h/2).
- `sway`: `dx = .35·amp·sin(2π·.4t + c·.3)·((h−r)/h)^1.3`.
- `crawl`: `dy = .06·amp·|sin(2π·2t)|`.
- `jitter`: `dx, dy = amp·(noise − .5)·.3`.
In grid motion style, `sprite()` snaps the centre to the cell grid and ignores deform.

```
AQ.fx
  emit(kind, wx, wy, opts?) // kinds: splash, drop, bubble, spark, ink, coin, flake, dust, pop, ripple, text
                            // opts: {n, power, dir, text, level, life}
  update(dt); draw(); clear(); count
  shake(px, sec); flash(level, sec); inkWipe(dir:'in'|'out', sec) → Promise; motion() → 1 | .3
AQ.input
  init(stageEl); mode:'mouse'|'touch'|'keyboard'|'gamepad'; pointer:{x,y,down,id,startX,startY,dx,dy,downAt,moved,type}
  on(type, fn) → off()
     raw canvas types: 'down','move','up','tap','hold','drag','wheel' — payload {x,y,dx,dy,startX,startY,dur,source}
     actions: 'action:primary' {phase:'down'|'up', source}, 'action:back', 'action:pause', 'action:prev',
              'action:next', 'action:bait', 'action:retrieve', 'action:feed', 'action:nav' {dx,dy}, 'action:confirm'
  isDown(action) → bool ('primary','left','right','up','down'); axis('steer'|'aimX') → −1..1
  virtual: { press(action), release(action), setAxis(name, v) }   // for E's HTML touch controls
  block(reason), unblock(reason), blocked → bool    // E blocks gameplay input while a modal is open
```
Keyboard bindings: Space/Enter = primary · Esc/P = pause (Esc also emits `back`) · A/D/←/→ = steer and left/right · W/S/↑/↓ = up/down and nav · Q/E = prev/next · B = bait · R = retrieve · F = feed · 1/2/3 = card choices (E handles).
Gamepad: A = primary · B = back · X = bait · Y = retrieve · Start = pause · LB/RB = prev/next · left stick = steer and nav · RT = primary.
The first pointerdown or keydown emits `app:gesture` once.

```
AQ.scenes
  register(name, def); go(name, params?, {transition:'ink'|'fade'|'none'}='ink') → Promise; current; has(name)
  pause(); resume(); paused
  def: { enter(params), exit(), update(dt), drawBg?(grid, t), draw(t), resize?(metrics), onPause?(), onResume?() }
AQ.perf
  fps, frameMs, preset() → 'high'|'medium'|'low', params → {dprCap, bgHz, maxCreatures, maxParticles, deform,
  rays, caustics, knock, densityBias, bubbles, musicVoices, ropeIters}, setPreset(p, reason)
AQ.loop   start(); stop(); running; time (s, excludes pause)
AQ.debug  (only with ?debug=1) give(coins, pearls), unlockAll(), setTime(phase), setWeather(w), spawn(id), land(id),
          catchAll() → Promise<report>, spawnStats(zone, n) → table, checkContracts() → missing[], fight(id, tier) → result
```

Frame order (`AQ.loop`):
1. Poll the gamepad.
2. `dt = clamp(elapsed, 0, .05)`.
3. Unless paused: `scene.update(dt)`.
4. Every 1 s of unpaused time in map, fishing or aquarium: `AQ.world.tick(state, 1)` and `AQ.game.tick(1)`.
5. If ≥ 1/bgHz since the last bg tick: `grid.clear()`, `scene.drawBg(grid, t)`, commit the diff.
6. Clear main, then `scene.draw(t)`.
7. Top layer (transitions, flash, FPS).
8. `perf.sample()`.

Main is capped at 60 fps: frames are skipped when < 15.5 ms have elapsed.

#### B — creatures, world, spawn, art

```
AQ.sprites[key]: SpriteDef (§6.6); AQ.sprites.get(key) → SpriteDef (missing → '?' placeholder + console.warn)
AQ.art: { logo:{wide,tall}, boat, angler, bottle, birds, decor:{[id]:SpriteDef}, visitors:[SpriteDef],
          map:{aquarium,shop,lighthouse,pier}, lamp, filter, tentacle, baitGlyph:{[bait]:string} }
AQ.species: { list: Species[], get(id) → Species|null, inZone(zoneId) → Species[], ids() → string[] }
Species = { id, zones:[zoneId], rarity, size, kind, behavior,
            fight:{style, power, stamina, speed, tell, special:{} },
            depth:[d0,d1], time: phase[]|null, weather: weather[]|null, baits:{[bait]:affinity},
            wariness, biteWindow, len:[min,max], kgMax, value, habitat:[], light, diet, glow:0|1,
            breeds:bool, produces:null|{item, qty, everyMin}, keep:bool, hookMin, gearTier, sprite: key }
AQ.sightings: { list: [{id, zones, time, weather, chancePerMin, sprite}], get(id) }
AQ.zones: { list: Zone[], get(id), order:[ids] }
Zone = { id, order, depth, mPerUnit, dark:{always:bool, below:number, nightBelow:number}, bottom, features:[],
         floorProfile:{base, amp, freq}, popFactor, music, ambience, sightings:[ids], frenzy:bool }
AQ.world
  MIN_PER_SEC: 1; TRANSITIONS; phaseOf(minutes) → phase; now(state) → {minutes, day, hour, minute, phase, weather}
  tick(state, realSec, rng?) → events[] ({type:'phase'|'weather'|'hour', ...}) // mutates state.world; emits world:* events
  advanceTo(state, phase) → minutesAdvanced; forecast(state, n=3) → weather[]
  light(state, zoneId, depthFrac) → 0..1; isDark(state, zoneId, depthFrac) → bool
AQ.spawn
  conditionsMet(species, ctx) → bool; weightOf(species, ctx) → number; table(zoneId, ctx) → [{id, w}]
  pick(zoneId, ctx, rng) → id|null; legendaryReady(zoneId, ctx) → id|null; schoolSize(species, rng) → int
  rollSpecimen(id, ctx, rng) → Specimen
  ctx = {phase, weather, bait, luck=0, lantern=0, frenzy=false}
AQ.creatures
  create(id, opts:{x, y, dir, mode:'wild'|'tank'|'title', specimen?, fish?, juvenile?}, rng) → Creature
  update(list, dt, env) ; draw(c, env) ; drawList(list, env) ; hitTest(c, wx, wy) → bool ; bounds(c) → {x0,y0,x1,y1}
  setHooked(c, on:bool) ; spook(c, sec) ; remove(list, c)
Creature = { uid, sp, x, y, vx, vy, dir:±1, w, h (cells), frame, t, state, alpha, specimen?, fishUid?, hooked:bool, data:{} }
env = { mode, t, rng, bounds:{x0,y0,x1,y1}, surfaceY, floorY:(x)→y, covers:[{x0,y0,x1,y1,kind}],
        hook:null|{x, y, bait, moving, active}, food:[{x,y,id}], visibility:(wx,wy,c)→0..1,
        phase, frenzy:bool, onEvent:(type:'notice'|'nibble'|'bite'|'eat'|'leave', c, data)→void }
```
`creatures.draw` applies: the frame, flip by `dir`, the deform from the sprite def (scaled by `AQ.fx.motion()` and `perf.params.deform`), level = 12 × visibility (glow cells at ≥ 11 when visible < .5), shimmer and halo by rarity, dense (bold + `densify` via glyphMap), juveniles (`_alevino`), and `dissolve` on spawn and despawn (0.4 s).

#### C — fishing

```
AQ.line
  createRope(n=24) → Rope; stepRope(rope, a:{x,y}, b:{x,y}, length, dt, opts:{gravity, iterations, waterY}) → void
  rasterize(rope, out:Array, opts:{tension, underwaterLevelMul}) → cells [{wx, wy, ch, level}] (8-connected, no gaps)
  glyphFor(dx, dy, tension) → '|'|'/'|'\'|'-'|'_'|'~'|'.'|"'"|','
  trajectory(origin, power, dir, castMax) → {points:[{x,y}], landX, flightTime}
AQ.bite
  window(species, gear, settings) → seconds
  create(species, gear, settings) → BiteState; nibble(bs, now); open(bs, now)
  strike(bs, now) → 'hooked'|'early'|'late'; expired(bs, now) → bool
AQ.fight
  CONST; STYLES; PULL_MUL
  create(species, specimen, gear, opts:{rng, start:{x,y}, floorY:(x)→y, covers, script?}) → FightState
  step(fs, input:{reel:bool, rod:number}, dt=1/60) → events[] ({type:'tell',kind}|{type:'state',state}|
       {type:'phase',phase}|{type:'ink',on}|{type:'inflate',on}|{type:'fray',value}|{type:'end',result})
  autopilot(fs) → {reel, rod}
  FightState = {t, state, next, tellKind, dirX, x, y, L, T, S, fray, airborne, inflated, phase, result, species, specimen}
AQ.fishing   (only exists in the browser; defined in scenes/fishing.js)
  phase; script(opts:{forceSpawn:[{sp, x, depthFrac}], autoStopDepth, biteWindow, fightOverride:{power, stamina, runs},
                      noEscape:bool}|null)
  anchor(name:'boat'|'hook'|'fish'|'tension'|'reel') → {x,y} CSS px | null
  debugSpawn(id); debugLand(id) → Promise
```

#### D — economy and aquarium

```
AQ.items
  list; get(id); byCat(cat:'gear'|'bait'|'lure'|'tank'|'decor'|'misc') → Item[]
  GEAR: {rod:[{name,price,stats}], line:[...], reel:[...], hook:[...], lantern:[...], boat:[...]}
  BAITS: {[baitId]: {packItem, glyph}}; DECOR: {[id]: {tags, attract, price, stars}}
  Item = {id, cat, price:{coins, pearls} | tiers[], req:{...}, per:'tank'|null, icon: artKey}
AQ.goals: { chain: Goal[], achievements: Ach[], messages: Msg[] }
   Goal = {id, type, params:{}, reward:{coins?, pearls?, unlock?}}; Ach = {id, type, params}; Msg = {id, unlock?, hint?}
AQ.economy
  gear(state) → {cast, window, St, Ls, maxLen, snapGrace, reelSpeed, riseRate, hookClass, H, lantern}
  specimenValue(specimen) → int; fishSellValue(fish) → int
  priceOf(itemId, state, opts?{tankId}) → {coins, pearls} | null   // null = maxed or unavailable
  requirementsMet(itemId, state, opts?) → {ok, missing:[{key, vars}]}; canAfford(price, state) → bool
  incomePerMinute(state) → number; offlineEarnings(state, awayMs) → {coins, pearls, capped}
  feedCost(tank, state) → int
AQ.aquarium
  tankUsage(tank, state) → {used, cap, bioload, filterCap}; canFit(spOrSpecimen, tank, state) → bool
  bestTankFor(specimen, state) → tankId|null
  fishHappiness(fish, tank, state) → {value, factors:{food,space,habitat,light,harmony,quality}}
  tankHappiness(tank, state) → 0..100; tankAttraction(tank, state) → number; attraction(state) → number
  stars(state) → 1..5; face(h) → ':D'|':)'|':|'|':('
  tick(state, dtSec, rng, opts:{offline:bool}) → events[]   // food, growth, breeding, production, predation, till
AQ.progress
  zoneUnlocked(zoneId, state) → bool; zoneRequirements(zoneId, state) → {ok, items:[{key, vars, ok}]}
  activeGoals(state) → Goal[3]; goalProgress(goal, state) → {cur, max}; check(state) → events[] (grants rewards)
  completion(state) → {caught, seen, total:45, pct}
AQ.game   (all mutate AQ.state, emit events, markDirty)
  newGame() → SaveState; resolveCatch(specimen, {choice, tankId?}) → {value, isNew, isRecord, fish?}
  markSeen(spId); markSighting(id) → bool(new); foundMessage() → msgId|null; bottleCoins(zoneId) → int
  buy(itemId, opts?{tankId}) → {ok, reason?:'coins'|'pearls'|'req'|'maxed'}
  equipBait(baitId) → bool; consumeBait() → equippedBaitId; addBait(baitId, n)
  sellFish(uid) → int; releaseFish(uid) → bool; moveFish(uid, tankId) → bool; renameFish(uid, name) → bool
  feedTank(tankId) → bool; collectTill() → int; placeDecor(tankId, slot, decorId|null) → bool; setTankLight(tankId, light)
  tick(dtSec) ; applyOffline(nowMs) → summary|null ; stat(name, delta=1) ; wait(phase) → minutes ; luck(zoneId) → 0..0.25
  addLuck(zoneId, v) ; resetLuck()
```

#### E — UI, audio and haptics

```
AQ.ui
  init(rootEl); show(name, params?) → Promise<result>; hide(name); isOpen(name?) → bool; isModal() → bool
  toast(msg:string|{key,vars}, opts?{kind:'info'|'good'|'warn'|'rare', ms=2600})
  hud: { mode('none'|'hub'|'fishing'|'aquarium'), update() }
  catchCard(specimen, opts:{canKeep, tanks, isNew, isRecord}) → Promise<{choice:'keep'|'sell'|'release', tankId?}>
  fishCard(uid) → Promise<void>; note(id) → Promise<void>; confirm(opts:{titleKey,bodyKey,vars,okKey,cancelKey,danger}) → Promise<bool>
  hint(id, opts:{key, vars, anchor:'reel'|'center'|'bottom'|{x,y}}); clearHint(id)
  hudInsets() → {top,bottom,left,right} CSS px currently covered by HUD; applyI18n(root)
  screens: 'title','pause','settings','saveIO','credits','shop','bestiary','goals','zoneCard','catchCard','fishCard',
           'decorPicker','tankPicker','baitPicker','offline','note','confirm'
AQ.audio
  init(); unlock() → Promise; ready; sfx(name, opts?{vol, pitch, pan}); setMood(mood); setAmbience({zone, underwater, weather, phase})
  setTension(v|null); reel(on, speed); applyVolumes(); suspend(); resume()
AQ.haptics   pulse(kind:'tap'|'nibble'|'bite'|'hook'|'tell'|'snap'|'catch'|'coin'); tension(v)
AQ.tutorial  start(); step; active; skip(); next()
```

### 15.6 Renderer model (summary for A, used by everyone)

- **Coordinates.**
  - World units: x right, y down; 1 u = 1 column width; one row = `AQ.ASPECT` = 2 u.
  - Fishing: x = 0 at the left of the view, y = 0 at the surface.
  - Tank: x = 0 at the inner left glass, y = 0 at the water top.
  - Map and title: grid cells.
  - Grid: `c = floor(wx − cam.x)`, `r = floor((wy − cam.y)/2)`.
  - CSS px: `x = originX + (wx − cam.x)·cellW + shakeX`, `y = originY + (wy − cam.y)/2·cellH + shakeY`.
  - Device px: CSS × dpr, rounded when drawing.
- **Grid size.**
  - `fontPx = glyphSize==='auto' ? clamp(floor(min(W/31.2, H/36))·densityBias, 11, 20) : glyphSize`. Then `cellWd = round(fontPx·adv·dpr)`, where `adv` = measured advance/fontPx (≈ .6), and `cellHd = round(fontPx·1.2·dpr)`.
  - `cols = floor(Wd/cellWd)`, `rows = floor(Hd/cellHd)`; the grid is centred.
  - If cols < 40 or rows < 22, step fontPx down, to a minimum of 9.
  - Typical results: phone portrait 390×844 → 54×58; phone landscape 844×390 → 127×29; desktop 1920×1080 → 177×50.
- **Layers.**
  - `cv-bg`: opaque, cell-diffed, updated at `bgHz`. 2 rows taller than the view, with the sub-row CSS translate.
  - `cv-main`: transparent, cleared every frame. Swaying plants, creatures, the line, particles, in-canvas HUD.
  - `cv-top`: transparent. Transitions, flashes, FPS.
  - The HTML `#ui` sits above all three.
- **Atlas.** One canvas per weight (regular, bold), a 16×16 slot grid (256 glyphs), each slot `cellWd × cellHd` device px.
  - Each glyph is drawn in the ink colour at full opacity, centred, and scaled horizontally if it is wider than the cell (fallback fonts), clipped to its slot.
  - ASCII, the whitelist and pt-BR letters are preloaded; others are added lazily. On overflow, fall back to `fillText` with a single warning.
  - Alpha is **not** baked: it is applied with `globalAlpha` from the 16-level table. A bakes in-memory 16× copies would cost about 30 MB on phones. Quantising keeps the tones consistent, lets the bg diff compare small ints, and lets A skip redundant `globalAlpha` sets.
- **bg diff.** Back and front buffers: `Uint16Array code`, `Uint8Array level`. On commit, changed cells are cleared with one `fillStyle` pass, then drawn grouped by level (one `globalAlpha` per level). Any theme, resize or scene change invalidates the front buffer. Optional optimisation: on a whole-row camera move, self-blit the canvas by ±cellHd and shift the buffers.
- **Knockout.** `fillRect` in bg colour at .92 per row span (per bbox on low quality), drawn just before the sprite's glyphs. The line knocks out per cell at .6.

### 15.7 Fishing-scene composition (C)

`drawBg`:
1. Sky: stars at night (twinkling `.` and `'` at levels 1–3); sun `o` or moon `(` positioned by the clock.
2. Clouds and rain.
3. The water texture field: noise × light → `water` and `snow` ramps at levels 1–3.
4. Rays and caustics.
5. Static terrain: precomputed per zone on enter and resize from `floorProfile` and features with `rng.fork(zoneId)`, blitted.
6. The surface line, from the wave field and `wave` ramp, at level 8.

`draw`:
1. Swaying plants.
2. Creatures (`drawList`).
3. The boat and angler, riding the wave height at the boat's x.
4. The line (rope rasterised).
5. Hook and bait glyph.
6. Tells.
7. Particles (`AQ.fx.draw`).
8. The HUD (`fishing-hud.js`): depth ruler, tension and stamina meters, rod indicator.

### 15.8 Save state schema v1 (`localStorage['aquario-ascii.save']`)

```js
{
  v: 1,
  meta: { created: 0, lastSaved: 0, lastActive: 0, playSec: 0, seed: 0, build: '1.0.0' },
  player: {
    coins: 50, pearls: 0,
    gear: { rod: 1, line: 1, reel: 1, hook: 1, lantern: 0, boat: 1 },
    baits: { massa: -1, minhoca: 10, camarao: 0, lula: 0, luminosa: 0, papel: 0, perola: 0 },   // -1 = infinite
    lures: { colher: false, jig: false },
    bait: 'massa',
    decor: { pedras: 0, algas: 0, coral: 0, anemona: 0, kelp: 0, gruta: 0, castelo: 0, ostra: 0,
             bau: 0, naufragio: 0, ruina: 0, farol: 0 },                                       // owned, unplaced
    unlocks: { papel: false, perola: false, paperTheme: false },
    cofre: 1,                                                                                  // 1..3 → 2/4/8 h
    zone: 'baia'
  },
  world: { minutes: 330, weather: 'limpo', slotEnd: 600, forecast: ['limpo','nublado','limpo'], rng: 0 },
  aquarium: {
    tanks: [ { id: 't1', cap: 1, filter: 1, feeder: false, light: 'day', food: 1,
               decor: [null, null, null, null, null], foodLowSec: 0, breedSec: 0, produceSec: 0, pearlSec: 0 } ],
    fish: [],              // Fish[]
    till: 0, tillCarry: 0, nextUid: 1
  },
  bestiary: {},            // { [spId]: { seen:true, caught:0, kept:0, sold:0, released:0, bestLen:0, bestKg:0, first:0, dense:0 } }
  sightings: {},           // { [id]: ts }
  messages: {},            // { [id]: ts }
  progress: { zones: ['baia'], goal: 0, goalsDone: {}, goalBase: {}, ach: {}, stars: 1, ending: false, endingAt: 0, maxDepthM: 0 },
  stats: { casts:0, bites:0, early:0, late:0, catches:0, escapes:0, snaps:0, kept:0, sold:0, released:0,
           coinsEarned:0, coinsSpent:0, tillCollected:0, fed:0, bred:0, legendaries:0, longestFight:0,
           nightCatches:0, stormCatches:0, frenzyBest:0, jelliesClean:0 },
  tutorial: { step: 0, done: false, notes: {}, hints: {} }
}
// Fish     = { uid:'f12', sp, len, kg, q, dense, trophy, bred, growth, tank:'t1', name:null, at, zone }
// Specimen = { sp, len, kg, q, dense, trophy, zone, at }
```
Load rules:
- `deepMerge` with `defaults()` fills fields missing from older saves. Unknown keys are preserved.
- Before any migration, the raw string is copied to `.bak`.
- Invalid JSON, or `v` > `SAVE_VERSION`: keep `.bak`, start fresh, toast "Save inválido — um backup foi guardado."
- `goalBase` stores counter snapshots when a goal becomes active, so "catch N" goals count from activation.

Settings schema v1: as §14 plus `{v: 1}`. Unknown keys are dropped; values are validated.

### 15.9 Event bus

| Event | Payload | Emitter | Listeners |
|---|---|---|---|
| `app:ready` | {} | A main | E (title), D (offline summary) |
| `app:gesture` | {} | A input | E audio unlock |
| `app:hidden` / `app:visible` | {} / {awayMs} | A | E audio, A store, D applyOffline (if away > 60 s) |
| `display:resize` | metrics | A | scenes (also `def.resize`), E layout |
| `settings:changed` | {key, value} | A | A (theme, display, perf, fx), E (audio, ui, haptics), C (assists) |
| `lang:changed` | {lang} | A | E re-render, C/D in-canvas labels |
| `theme:changed` | {name, bg, ink} | A | E (pre previews), scenes |
| `quality:changed` | {preset, auto} | A | B, C, D (caps), E toast "Qualidade ajustada: Média" |
| `input:mode` | {mode} | A | E hints and touch controls |
| `scene:changed` | {from, to, params} | A | E (HUD mode, music mood, tutorial) |
| `pause:changed` | {paused} | A | E (pause menu, audio duck), C |
| `save:written` / `save:reset` | {reason} / {} | A | E (save tick / reload to title) |
| `world:phase` | {phase, prev} | B | C, E (music, HUD) |
| `world:weather` | {weather, prev} | B | C, E |
| `fish:cast` | {power, dir} | C | E (sfx, haptic), D stats |
| `fish:splash` | {wx, wy, big} | C | E |
| `fish:stop` | {depthM} | C | E tutorial |
| `bite:nibble` | {sp} | C | E (sfx, haptic, tutorial) |
| `bite:strike` | {sp, window} | C | E |
| `bite:miss` | {sp, reason:'early'|'late'} | C | E, D stats |
| `fight:start` | {sp, rarity, size} | C | E (music layer), D stats |
| `fight:tell` | {kind} | C | E (sfx, haptic) |
| `fight:phase` | {phase} | C | E |
| `fight:end` | {sp, result, sec} | C | E (sfx, toast reason), D (stats, achievements) |
| `catch:landed` | {specimen} | C | E (fanfare) |
| `catch:resolved` | {specimen, choice, value, isNew, isRecord} | D | E (toasts, sfx), D progress |
| `species:new` / `species:seen` | {sp} | D | E |
| `sighting:new` | {id} | D | E |
| `message:found` | {id} | D | E (note card) |
| `frenzy:start` / `frenzy:end` | {zone} | C | E |
| `legendary:near` | {sp} | C | E (drone, toast) |
| `wallet:changed` | {coins, pearls, dCoins, dPearls, reason} | D | E HUD and coin fx |
| `inventory:changed` | {kind, id} | D | E HUD, C bait and gear refresh |
| `shop:bought` / `shop:denied` | {itemId} / {itemId, reason} | D | E, C |
| `zone:unlocked` | {zone} | D | E (toast, note), C map |
| `aquarium:changed` | {tankId} | D | D scene, E cards |
| `aquarium:fed` / `aquarium:collected` | {tankId} / {amount} | D | E |
| `aquarium:till` | {till} | D | E (nav badge) |
| `aquarium:bred` | {tankId, uid, sp} | D | E |
| `aquarium:produced` | {tankId, item, qty} | D | E |
| `aquarium:warning` | {tankId, kind, sp?} | D | E toast |
| `aquarium:predation` | {tankId, predator, prey} | D | E toast |
| `stars:changed` | {stars, prev} | D | E (toast, note `stars4`) |
| `goal:done` | {id, reward} | D | E |
| `achievement:unlocked` | {id} | D | E |
| `offline:summary` | {awayMs, coins, pearls, events} | D | E (offline card) |
| `ending:start` | {} | D | E (go to `ending`) |
| `ui:open` / `ui:close` | {screen} / {screen, result} | E | C, D (ignore canvas input) |
| `tutorial:step` | {step} | E | C (script hooks) |

### 15.10 Performance budgets and quality presets

Target: 60 fps on a mid-range phone (Snapdragon 7-series or Apple A13, 4× CPU throttle in DevTools as a proxy).

JS budget per frame: ≤ 6 ms on a phone, ≤ 3 ms on desktop.
- Simulation (creatures + fight + rope): ≤ 1.5 ms
- bg commit: ≤ 2 ms per bg tick, amortised
- main draw: ≤ 2.5 ms
- DOM HUD: ≤ 0.3 ms (throttled to 10 Hz; text set only on change)

| Param | high | medium | low |
|---|---|---|---|
| dprCap | 2 | 1.5 | 1 |
| bgHz | 30 | 20 | 12 |
| maxCreatures (fishing) | 28 | 18 | 10 |
| maxParticles | 400 | 200 | 80 |
| per-glyph deform | yes | yes | no |
| rays / caustics | yes / yes | yes / no | no / no |
| knockout | row spans | row spans | bbox |
| densityBias (auto font) | 1.0 | 1.08 | 1.2 |
| bubbles | 1× | .5× | .25× |
| musicVoices | 6 | 4 | 3 |
| ropeIters | 6 | 4 | 3 |

- **Initial auto preset:** medium if `isTouch && min(screen) < 420`, or `hardwareConcurrency ≤ 4`, or `deviceMemory ≤ 4`; otherwise high.
- **Auto fallback:** frame-time EMA. More than 20 ms average for 3 s steps down one level. Less than 12 ms for 20 s steps up at most one level per 60 s, never above the initial preset. Toast on change.
- Pause RAF on `document.hidden`. Debounce resize by 120 ms. Rebuild the atlas only when fontPx, dpr or theme changes.
- Canvas contexts: `getContext('2d', {alpha:false})` for bg; `imageSmoothingEnabled = false` everywhere.

### 15.11 Testing (`node aquario-ascii/tests/run.js`, exits non-zero on failure)

- `tests/loader.js` parses `index.html`, keeps the `<script src>` entries under `js/core|data|logic`, and evaluates them in order in a `vm` context `{window, console, Math, Date, JSON, Intl}`. `window.localStorage` is in-memory and `document` is absent. It returns `{AQ, window}`; each test file gets a fresh context.
- Harness: each `test-*.js` exports `function (T) { T.test(name, fn) }` with `T.eq`, `T.ok`, `T.near(a, b, eps)`, `T.throws`, `T.load()`, `T.state()` (fresh defaults).

| File | Owner | Asserts |
|---|---|---|
| test-rng | A | same seed → same 1 000 values; [0,1) range; int bounds; `weighted` frequencies within ±3% over 100k; `fork` deterministic and independent; get/set state round trip |
| test-store | A | defaults v1 with all keys; save → load deep-equal; corrupt JSON → defaults + `.bak`; deepMerge fills missing nested keys without overwriting; a test migration chain 1→2→3 runs in order and sets `v`; export → import round trip; bad checksum rejected; settings validation and clamping |
| test-contracts | A | every function in §15.5 for pure namespaces (`util`, `textart`, `rng`, `events`, `i18n`, `store`, `settings`, `species`, `zones`, `sightings`, `sprites`, `world`, `spawn`, `creatures`, `line`, `bite`, `fight`, `items`, `goals`, `economy`, `aquarium`, `progress`, `game`) exists with the right type; loading pure files with no `document` never throws; no pure file defines globals other than `AQ` |
| test-species | B | 42 species + 3 sightings; unique ids; all enums valid against `AQ.ENUM`; zones exist; baits ∈ ENUM.BAITS with ≥ 1 affinity > 0; `len[0] < len[1]`; `value > 0` except tinteira; depth ordered within [0,1]; `hookMin` matches size (XS/S→1, M→2, L→3, XL+→4, overrides allowed upward); gearTier 1–5; pt-BR and en name and flavour keys present; every zone has ≥ 1 common per phase; every species has ≥ 1 (phase, weather, bait) combination where `conditionsMet` is true and its depth band is reachable with Linha V (`d0·zone.depth ≤ 350`) |
| test-sprites | B | every species, sighting and art item has a sprite; frames ≥ 2 (creatures); equal width and height across frames; lines padded; tight bbox; within `SIZE_MAX` for the species size; charset whitelist; `mirror(mirror) === original`; masks have equal dimensions and only `x`/`.`; logo widths 64 and 27/32 |
| test-spawn | B | `pick` only returns valid species for zone and conditions; rarity ratios within ±15% of the weights over 50k picks; legendaries never picked by `pick`; `legendaryReady` only with the required bait, time and weather; `rollSpecimen` length in range, kg formula, `trophy ⇔ q ≥ .9`, dense rate ≈ 1/64 ±20% over 200k; deterministic with a seed |
| test-world | B | phase boundaries at 05:00, 07:00, 17:00, 19:00; tick adds `realSec` minutes; never `limpo → tempestade` directly; deterministic forecast; long-run storm share 8–18%; `advanceTo('noite')` lands at the next 19:00 |
| test-fight | C | for every species: autopilot with gear tier = `gearTier` lands ≥ 90% of 100 seeds within 120 s (bosses 300 s); median fight time per rarity within C 6–20 s, U 10–35, R 18–60, L 35–180; "always reel, rod 0" at the same tier fails ≥ 40% for species with P/Ls ≥ 1.15 (runners, jumpers, bosses); "never reel" lands 0%; drifters "always reel" tear ≥ 70% when tear < .5; T stays in [0, 1.6]; S non-increasing unless T < SLACK; same seed and inputs → identical event log; boss phases fire at .66 and .33 |
| test-line | C | landing x is monotonic in power and within [boat + 6, boat + castMax]; rope segment lengths within 5% after settling; raster glyphs ⊂ the allowed set; consecutive cells 8-connected |
| test-bite | C | strike during a nibble → early; inside the window → hooked; after → late; window = biteWindow + rod bonus (×1.5 with wideWindows) |
| test-economy | D | `specimenValue` exact on fixtures; tier prices increase; `priceOf` returns null when maxed; boat requirements enforce species counts; empty aquarium income is 0; offline = 50% × rate × min(away, cap); `feedCost` formula; no NaN across all species × q ∈ {0, .5, 1} × dense |
| test-aquarium | D | happiness factor fixtures; `canFit` with size costs; light adjacency; predator stress; breeding needs ≥ 2 adults, happiness ≥ 70 and space (seeded rate ≈ .30); growth over 20 min; pearls with oyster at happiness ≥ 60; predation only after 5 min food < .15, never on rare, dense or named fish; offline tick has no predation, no breeding and a .2 food floor |
| test-progress | D | zone requirements; goal chain advances with simulated actions; `goalBase` counting from activation; achievements fire once; star thresholds; completion = (caught + seen sightings)/45 |
| test-game | D | `resolveCatch` keep/sell/release mutate the state correctly; new species and record flags; bait consumption and fallback to massa; buy deducts or is denied with a reason; `moveFish` respects capacity; tinteira → ending and never kept |
| test-i18n | E | identical key sets for pt-BR and en across all string files; no empty strings; `{placeholders}` match between languages; every `sp.<id>.name/flavor`, `item.*`, `goal.*`, `ach.*`, `msg.*`, `zone.*`, `fish.escape.<reason>` key exists for each id in data |

`tests/balance-report.js` (not a test) prints autopilot land rates and median times per species × gear tier, plus a pacing simulation of coins over 3 h using a simple bot (catch every 45 s, keep the best, buy the cheapest required upgrade).

### 15.12 Build plan

1. **Hour 0 (A, solo, ~30 min):** folder, `index.html`, CSS base, fonts, `ns.js` enums, all stubs (never overwrite), the loader, `run.js`, `test-contracts`. Commit.
2. **Parallel (A–E):** A finishes the engine. B publishes manjuba and baiacu first, then everything else. C works with stub creatures until B lands. D builds the logic first (tests), then the aquarium scene. E builds strings, audio and UI shells, then wires events.
3. **Integration (QA):** run tests; play every flow on 3 viewports; fix contract drift; README; menu registration.
4. **Critic pass:** go through §16 and §17; tuning via `balance-report.js`.

---

## 16. Definition of done (QA checklist)

**Platforms**
- [ ] Opens via `file://` in Chrome and Firefox (Safari if available) and offline; zero console errors or warnings in a 10-minute session (except browser autoplay notices before the first gesture).
- [ ] Desktop 1920×1080 and 1366×768; phone portrait 390×844 and 360×640; phone landscape 844×390; tablet 820×1180 (DevTools touch emulation): layout correct, nothing under the notch (safe-area emulation), no page scroll, pinch or double-tap zoom, no text selection or callouts, tap targets ≥ 48 px, the reel button ≥ 88 px and on the correct side for handedness.
- [ ] Every screen is reachable with mouse only, keyboard only (focus visible), touch only, and gamepad for fishing basics.

**Flows**
- [ ] Title → New game → tutorial completes in ≤ 90 s → map → each unlocked zone → aquarium (all tanks) → shop (all tabs, buy, denied states) → bestiary (all tabs, detail, silhouettes) → goals and achievements → settings → pause → back to the games menu link (`../index.html`).
- [ ] Every species is catchable: `node tests/run.js` is green (test-fight covers all 42); in the browser with `?debug=1`, `AQ.debug.catchAll()` resolves without errors and the bestiary shows 42/42; `AQ.debug.spawnStats(zone, 10000)` lists every zone species (legendaries via `legendaryReady`).
- [ ] Each fight style was felt at least once by hand, with its tell visible; each escape reason shows its teaching message.
- [ ] Sightings, bottles (all 8 messages), frenzy and the legendary cue were each observed (debug time and weather allowed).
- [ ] The ending is reachable (debug), the credits roll, the Papel theme unlocks and persists as an option.

**State**
- [ ] Save round trip: play 3 min, reload → coins, pearls, gear, fish (incl. names and juveniles), tanks, decor, bestiary, goals, world clock and settings are identical.
- [ ] Offline: set `lastActive` back 3 h → the offline card shows a coins and pearls credit capped at the cofre limit; no predation or deaths.
- [ ] Export → reset → import restores; a corrupt import is rejected with a message; a corrupt localStorage save → fresh game + `.bak` kept.

**Settings (each applies live)**
- [ ] Language (no raw keys visible in either language; pt-BR accents render); volumes; quality; reduced motion (no shake or flash, slower waves); motion style grid; glyph size (grid rebuild without state loss); UI scale; high contrast; haptics (mobile vibrate); FPS display; control hints; handedness; assists; fullscreen; reset save with double confirmation.

**Performance and quality**
- [ ] ≥ 58 fps average on desktop (high); ≥ 50 fps with 4× CPU throttle (medium); 6× throttle triggers an auto step-down and toast.
- [ ] No memory growth over 10 min (heap roughly flat); the loop stops when the tab is hidden and audio suspends.
- [ ] Two-colour audit: no colour literals outside the theme table; overlays use only theme colours and alpha.
- [ ] Audio starts only after the first gesture; no clicks or pops on start and stop; music and ambience change per zone and phase; every listed SFX plays.
- [ ] Root `index.html` has the GAMES entry and the card opens the game; root `README.md` has the table row; `aquario-ascii/README.md` describes the game, controls, settings and how to run the tests.

---

## 17. Critique: risks and counter-measures

| # | Risk | Why it is real | Counter-measure in this design |
|---|---|---|---|
| 1 | **ASCII becomes unreadable mush** | Many glyphs overlapping in two colours | Strict level bands (bg ≤ 5, creatures ≥ 9); knockout under sprites; fog by depth; size-class limits; test-enforced tight sprites; a silhouette-first art brief; high contrast drops texture layers |
| 2 | **Waiting is boring** | Classic fishing-game dead air | Fish are visible and approach the bait; sink to the fish you see; nibbles are short (≤ 3); frenzies; bottles to snag; retrieve at 3×; the fishing round trip is about 30–60 s |
| 3 | **Fights feel like a QTE** | Tension bars often are | Two continuous axes (reel, rod); the fish's position and motion matter; each style demands an *opposite* response (jump = release, shake = keep pressure, run = counter-steer); the tells are diegetic glyphs, not prompts |
| 4 | **Touch controls are clumsy** | Two simultaneous inputs | Reel button + drag anywhere for the rod (two thumbs); autoSteer for one-handed play; wide windows; handedness; relative drag (no jump on press); the slingshot cast is natural on touch |
| 5 | **Grind between Mar and Abismo** | Prices climb fast | Aquarium income grows to 30–45%; frenzies; goals pay out; bottles; Esperar até… removes time-gating frustration; the pacing sim in `balance-report.js` |
| 6 | **The aquarium becomes a chore** | Idle games love decay timers | Only food decays, slowly (45 min), with an offline floor and an auto-feeder; fish never die; predation is rare, warned and avoidable, never on rares or named fish |
| 7 | **Legendaries are pure RNG** | Rarest-of-rare frustration | Legendaries are deterministic once conditions plus bait are met (spawn within 20–60 s); hints from bottles; a forecast for weather |
| 8 | **Performance on phones** | Thousands of glyph draws | Atlas blits; cell diff at 12–30 Hz; sub-row CSS scroll; quality presets plus auto fallback; DPR cap; fixed particle pools; no per-frame allocations |
| 9 | **Parallel-build contract drift** | Five agents, one global namespace | Stubs with neutral returns from hour 0; `test-contracts`; one owner per file; all state mutation through `AQ.game`; every string in per-owner string files with a parity test |
| 10 | **Font or glyph coverage on file://** | Webfonts and canvas timing | Vendored woff2 in a subfolder (allowed by Firefox's file:// rule); wait for `document.fonts.load` with a timeout; the atlas fits any fallback glyph to the cell and rebuilds on late font load; the charset is restricted to ASCII and Latin-1 |
| 11 | **pt-BR strings overflow** | Portuguese runs about 20% longer | Flex layouts, ellipsis on cards, a 360 px viewport check in QA, short labels in the HUD |
| 12 | **Scope** | 42 species, 5 zones, 2 scenes of systems | Two frames per species, with deformers supplying the motion; procedural backgrounds; slot-based decor (no free placement); a priority list (below) |

**Cut on purpose:** multiplayer and leaderboards; crafting; free-form decor placement; fish rotation or tilt; per-pixel lighting; boat movement; cloud saves; weather rain in the tank; fish death and disease; multiple save slots (export and import covers this).

## 18. Priorities (if time runs short, cut from the bottom)

- **P0:** engine, renderer, input, save and settings; 5 zones; ≥ 30 species fully playable (all 42 data entries, art for at least 30); cast, sink, bite, fight, catch card; aquarium (tanks, keep/sell/release, feed, happiness, income, basic decor); shop (gear, baits, boats, tank upgrades); bestiary; goals; title, pause, settings; core SFX and ambience; both languages; tutorial; ending (simple version).
- **P1:** the remaining 12 sprites; generative music and fight layer; frenzy; bottles and messages; sightings; breeding; visitors; achievements; auto quality; export and import; per-tank light; predation; offline summary card.
- **P2:** gamepad; Papel theme; nicknames; contemplate mode; row-scroll blit optimisation; detailed haptic patterns; fullscreen button.

## 19. Menu registration (integration agent; the only cross-project edit)

Root `index.html`, `GAMES` array:
```js
{
  path: 'aquario-ascii/index.html',
  title: 'Água-Tinta — Aquário ASCII',
  desc: 'A minimalist ASCII fishing and aquarium game in two colours, beige ink on near-black: cast, read the line and fight 42 species across five waters with time of day and weather, then keep your catch in a living aquarium that earns, breeds and makes pearls. In Portuguese and English; mouse, keyboard and touch; settings, saves and offline play.',
  tags: ['ASCII', 'fishing', 'aquarium', 'mobile'],
  palette: ['#0e0d0b', '#2a2620', '#6b6253', '#b9ad93', '#e9dfc7'],
  scene: 'aquario',
},
```
Optional `drawArt` branch for `scene === 'aquario'`: fill with `P[0]`; draw a `~` wave row and two `><°>` fish using `ctx.fillText` in 7 px monospace with `P[4]` at alpha .9 / .4.

Root `README.md` games table row:
`| Água-Tinta — Aquário ASCII | [`aquario-ascii/`](aquario-ascii/) | A minimalist two-colour ASCII fishing and aquarium game (pt-BR/EN): sight-fish 42 species across five waters with time and weather, skill-based fights per species, and a living aquarium that earns, breeds and makes pearls. Mouse, keyboard and touch. |`

---

### Critical files for implementation
- `/home/user/Claude-HTML-games/aquario-ascii/index.html` (script order is the shared contract; the Node loader parses it)
- `/home/user/Claude-HTML-games/aquario-ascii/js/core/ns.js` (enums, themes, charset: single source of ids)
- `/home/user/Claude-HTML-games/aquario-ascii/js/engine/render.js` (glyph atlas, layers, sprite, knockout, deform)
- `/home/user/Claude-HTML-games/aquario-ascii/js/logic/fight.js` (the fight model in §4.7, validated by `test-fight`)
- `/home/user/Claude-HTML-games/aquario-ascii/js/logic/game.js` (every player-state mutation and the event hub)
- `/home/user/Claude-HTML-games/aquario-ascii/js/data/species.js` (the 42-species roster that B, C, D and E all read)

Repository files read: `/home/user/Claude-HTML-games/CLAUDE.md`, plus the root `index.html` `GAMES` / `drawArt` format and the root `README.md` table format, for §19. No other game folder was opened. I checked the vendored font source by listing the npm tarball `jetbrains-mono@1.0.6` (it contains `fonts/webfonts/JetBrainsMonoNL-Regular.woff2` and `-Bold.woff2`, about 50 KB each). I verified the logo widths, the example sprite widths and the mirror symmetry, and the fight constants in §4.7, with throwaway Node one-liners that wrote no files.
