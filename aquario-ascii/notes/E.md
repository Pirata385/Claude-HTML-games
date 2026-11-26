# Notes from E (UI, audio, i18n)

All §15.5 E contracts exist with the documented signatures. Items below are **backward-compatible extensions** or
decisions; nothing was removed or renamed.

## Language
- **English only** (owner decision, overrides §14/§15): `strings-ui.js` fills only `'en'`. The Language control was
  removed from Settings and the title screen. `tests/test-i18n.js` checks the `en` table only: data-id keys
  (sp/sighting/zone/phase/weather/item + gear tiers/goal/ach/msg/fish.escape), no empty strings, plural pairs, every
  literal UI key used in E's code, canvas strings inside the atlas charset.
- `debug.error` (used by `AQ.scenes`) lives in `strings-ui.js`. Bait display names: `hud.baitName.<bait>`.

## AQ.ui
- Screen manager: `ui.register(name, def)`, `show/hide/isOpen/isModal`, extras `ui.top()`, `ui.openList()`,
  `ui.layer(k)`, `ui.onInit(fn)`, `ui.rerenderAll()`. A modal blocks gameplay input with `AQ.input.block('ui')`.
  Esc/back closes the top closable screen; with nothing open in map/fishing/aquarium it opens Pause. `pause:changed`
  from anyone opens/closes the Pause screen.
- `ui.note(id, opts?{ms, sticky})`: story notes (§9.5 ids) and bottle messages as `'msg:<m#>'` (E opens these on
  `message:found`). Notes are queued; seen ids are stored in `state.tutorial.notes` (`ui.noteSeen(id)`).
- `ui.hint(id, {key, vars, anchor, big, ms})`: `key.<inputMode>` (touch/mouse/keyboard/gamepad) is preferred when
  defined. Anchors: `'center'|'bottom'|'top'|{x,y}`, E's DOM anchors (`reel back pause bait retrieve feed decor light
  till nav:<map|aquarium|shop|bestiary|goals>`), else `AQ.fishing.anchor(name)`. Hints are suppressed when
  `settings.hints` is false. Extras: `clearAllHints()`, `hasHint(id)`.
- `ui.catchCard(spec, {canKeep, tanks, isNew, isRecord})`: E picks the target tank with `AQ.aquarium.bestTankFor`
  (player can choose another via the tank picker). A keep with no tank resolves `{choice:'sell'}`. Keys 1/2/3.
- **`zoneCard` acts itself**: [Fish] calls `AQ.scenes.go('fishing', {zone})`; [Wait until…] calls `AQ.game.wait`.
  The promise result (`{action, zone}`) is informational — do not navigate again.
- Other screens: `show('tankPicker', {specimen|uid, current}) → tankId|null`, `show('baitPicker')` (equips via
  `AQ.game.equipBait`), `show('decorPicker', {tankId})`, `show('shop', {tab})`, `show('bestiary', {tab})`,
  `show('goals', {tab:'goals'|'ach'})`, `show('saveIO', {tab:'export'|'import'})`, `show('offline', summary)`
  (queued until map/aquarium is open).
- HUD: `ui.hud.currentTank()`, `switchTank(±1)`, `contemplate(on)`, `pulse(anchor, on)`. Aquarium tank follows the
  scene's `tankId`/`setTank` and `aquarium:view` (D); [<]/[>] and Q/E switch through `setTank`. Arrows are hidden
  with one tank and move into the toolbar row on narrow screens (D's suggestion).
- Events emitted by E: `ui:open`/`ui:close`, `tutorial:step {step, id}`, `ui:tank {tankId, index}`,
  `ui:contemplate {on}`. E listens to `ending:start` and goes to the `ending` scene.

## Tutorial
- New game → `AQ.game.newGame()` → `AQ.tutorial.start()` → `scenes.go('fishing', {zone:'baia', tutorial:true})`.
  **C scripts the school itself** from that param; E does not call `AQ.fishing.script` (only `script(null)` on skip).
  Verified end to end in the browser: cast → sink → strike → reel → steer → keep → free → map → aquarium → feed → till.
- `AQ.tutorial.resume()` (Continue with an unfinished tutorial restarts the fishing part), `onAction(kind)` (E's HUD).

## Audio / haptics
- Extras: `AQ.audio.duck(on)` (pause), `recipes` (all §13 SFX + internal `tellRun/Dive/Jump/Shake/Burrow/Grip/Ink`,
  `bloop`), `music.fight(on, boss) / frenzy(on) / omen()`. `setAmbience` accepts partial objects. E plays the
  gameplay SFX from bus events (§15.9); C only needs `setTension(v)`, `reel(on, speed)` and `setAmbience({underwater})`.
- `AQ.haptics.pulse('tell', {kind})` uses the §4.8 per-tell patterns; E wires haptics to the bus events itself.

## Known gaps
- Title uses `AQ.art.logo.wide` (≥ 70 cols) or `logo.tall` (flat lines or stacked blocks); falls back to the spaced name.
- Achievement badge glyphs are E's own small ASCII marks.
