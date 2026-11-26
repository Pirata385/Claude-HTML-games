# Notes from D (aquarium & economy)

Everything in §15.5 for D exists with the documented signature. Below: clarifications and **backward-compatible
extensions** (nothing removed or renamed). Tests: `test-economy`, `test-aquarium`, `test-progress`, `test-game`.

## AQ.game — what C and E should call
- **Catch flow (C):** `info = AQ.game.catchInfo(specimen)` → `{isNew, isRecord, value, keepable, canKeep, tankId (best),
  tanks:[{id, index, used, cap, fits}], size, cost}`. Pass `{canKeep: info.canKeep, tanks: info.tanks, isNew, isRecord}`
  to `AQ.ui.catchCard`, then `AQ.game.resolveCatch(specimen, {choice, tankId})`.
  - Result adds `choice` (the one applied) and `pearls`. **keep** that does not fit falls back to **sell**.
  - Species with `keep:false` (tinteira) are always released; tinteira sets `progress.ending`, `unlocks.paperTheme`
    and emits `ending:start` **after** `catch:resolved`.
  - Release of a fresh catch adds +5% luck to `specimen.zone` (cap 25%). First catch of an R: +2 @, L: +10 @.
- **Stats from the bus — C must NOT also call `AQ.game.stat` for these:** `fish:cast` → casts; `bite:miss {reason}` →
  early/late; `fight:start` → bites (hooksets, achievement *primeira_fisgada*); `fight:end {result, sec}` → escapes
  (result ∈ `ENUM.ESCAPE`), snaps (`'snap'`), longestFight; `fish:stop {depthM}` → `progress.maxDepthM`;
  `frenzy:start/end` → frenzy catch counter (*frenesi*). Night/storm catches, trophies, rares, jellies, legendaries
  are counted inside `resolveCatch` from `AQ.world.now()`.
- `consumeBait()` returns the bait **used for this cast** (before an auto-switch). At 0 the equipped bait becomes
  `massa` and `inventory:changed {kind:'bait', id:'massa', prev, reason:'empty'}` is emitted (E toasts it).
- `setZone(zoneId)` (new): stores `player.zone`; changing zone resets luck. `luck(zoneId)` is 0 for other zones.
- `bottleCoins(zoneId)` = $50 × (index in `ENUM.ZONES` + 1) (B's `zone.order` is 0-based). `allMessagesFound()` (new).
- `markSeen(id)` → bool (new), `markSighting(id)` → bool.
- `buy(itemId, {tankId})` → `{ok, reason?, tier?, tankId?, price}`; per-tank items without `tankId` go to the first tank
  where the item is not maxed. Emits `shop:bought {itemId, tankId, tier}` or `shop:denied {itemId, reason}`.
- `feedTank` denied for coins emits `shop:denied {itemId:'feed', reason:'coins', tankId}`. The **first feed of a save is
  free** (`feedCost` returns 0 while `stats.fed === 0`; tutorial step 11).
- `setTankLight(tankId, light?)` cycles day → dim → night when `light` is omitted; returns the new light.
- `renameFish`: trims, strips control chars and `<>`, max 16 chars; empty → `null`. Named fish are never eaten.
- `applyOffline(nowMs)` → `{awayMs, coins (added to the TILL, not the wallet), pearls, capped, feedCost, events}` |
  null (< 60 s). D calls it itself on `app:ready` and `app:visible`; the last summary stays in `AQ.game.lastOffline`
  (E can show the offline card later, e.g. once the map opens). Emits `offline:summary` with the same object.
- `newGame()` replaces `AQ.state` in place with `store.fresh()`, backs up and saves **without** emitting `save:reset`.
- Other helpers: `fishByUid, tankById, fishIn(tankId), ownsBait(id), check() (progress check + events), inFrenzy()`.

## Data / economy
- `AQ.items.GEAR[slot][i]` = `{slot, tier, name (i18n key 'item.<slot>.<tier>'), price, stats}`; lantern starts at tier
  0. Use `AQ.items.gearAt(slot, tier)` / `gearMax(slot)` / `GEAR_MIN`. Shop item ids: gear = slot id (`rod`…`boat`),
  `bait_*`, `lure_*`, `tank`, `tankcap`, `filter`, `feeder`, `cofre`, decor = decor id. Each item has `name`/`desc` keys.
  Tiered items have `tiered:true` and `price` as an array; always ask `AQ.economy.priceOf` for the current price.
- **Buying a boat requires the species count of the previous zone** (5/5/5/6, `item.req.species`); zone unlock
  (`AQ.progress.zoneRequirements`) = boat tier + species + Linha III (mar) / Lanterna I (abismo). Zones unlock
  automatically in `progress.check` (`zone:unlocked`).
- `economy.gear(state)` adds `lanternTier`, `boat` and `tiers`; **`lantern` is the radius in u** (6/14/22/30).
- `requirementsMet().missing[].key` ∈ `item.req.{zone,stars,message,species,gear,tank,unlock,unknown}`; vars are
  display-ready (`zone` = translated name, `id` = raw id).
- `fishSellValue` and fish appeal scale juveniles by `0.4 + 0.6·growth` (D addition, avoids breed-and-sell farming).
- `offlineEarnings(state, ms)` → `{coins, pearls, capped, effSec, raw}`; rates are taken at the start of the absence.

## Aquarium rules (decisions where §7 was open)
- `state.progress.stars` = **best stars ever reached** (decor tiers, Pérola Negra, goals). `AQ.aquarium.stars(state)`
  is the current value (HUD). `stars:changed` fires only when the best increases. ★4 sets `unlocks.perola`.
- Juveniles take their full size cost; juvenile predators do not stress or eat.
- The auto-feeder also works offline, but only within the cofre window. Juveniles grow offline.
- Warnings (`aquarium:warning {tankId, kind:'predator'|'hungry', sp, prey}`) fire when food crosses .3 and .15.
- `produces.minHappy` (B's species field) is honoured; default 60.
- Extras: `AQ.aquarium.K` (all tunables), `appeal(fish, state)`, `visitors(state)`, `hasOyster`, `predationPair`,
  `tankTags`, `starsFor(attr)`, `keepable(sp)`, `sizeCost(spId)`.

## Progress
- `completion(state)` → `{caught, seen, total:45, pct (0..100, floored), frac (0..1)}` — use `i18n.pct(frac)`.
- Goals: active = first 3 not done. Counter goals (catch, keep, feed, buy, collectTill, catchRarity, catchAt, breed,
  trophy, catchIn) count from activation (`goalBase`); others are absolute. `catchRarity R` counts R and L.
- New stats keys (missing in old saves → treated as 0): `trophies, rareCatches, stormRares, denseCatches, gearBought,
  tillCollects, legendaries` (existing), `jelliesClean` (landed jellies). Achievements give pearls (`reward.pearls`).
- Extras: `achProgress(ach, state)`, `nextZone(state)`, `ZONE_REQ`, `AQ.goals.get/ach/msg(id)`.

## Strings (strings-economy.js, English only since the scope change) for E
`item.<id>.name/.desc`, `item.<slot>.<tier>`, `item.stat.*`, `item.hookClass.<n>`, `item.req.*`, `item.tag.<habitat>`,
`goal.<id>` (vars = goal params, e.g. `{n}`), `goal.reward.*`, `ach.<id>.name/.desc`, `msg.<id>.title/.body`,
`aq.*` (scene labels, `aq.factor.*` for the fish-card breakdown, `aq.pref` + `item.tag.*` + `aq.prefLight.*` for
"Gosta de", `aq.warn.predator {pred, prey, tank}`, `aq.predation`, `aq.bredToast {sp, tank}`, `aq.produced`, `aq.pearl`…).

## Aquarium scene (`js/scenes/aquarium.js`) ↔ E
- The scene definition exposes **`tankId`** (string, kept current), `tank`, **`setTank(id)`**, **`next()`**, **`prev()`**;
  `AQ.aquariumView = {tankId, index}` mirrors it. Switching (E's arrows, Q/E, or a canvas swipe) emits
  **`aquarium:view` {tankId, index, total}** (new event). `enter({tankId})` opens a given tank.
- Canvas taps open `AQ.ui.fishCard(uid)` (generous hit box, ≥ 16 px); tapping water startles nearby fish. Taps are
  ignored while contemplating (`ui:contemplate`) and for 0.3 s after it ends.
- Layout reads `AQ.ui.hudInsets()` every 0.5 s (ignores absurd insets), so contemplate mode enlarges the tank.
- Visuals listen to `aquarium:fed` (flakes sink, fish rise to eat, `<3`), `aquarium:collected` (`$` fountains),
  `aquarium:bred` (juvenile appears by a parent, bloom), `aquarium:predation`, `stars:changed` (blooms).
- Uses `AQ.art.decor/lamp/filter/visitors` when present (fallback art inside the scene otherwise).
- Suggestion for E: in portrait the tank arrows sit over the glass; hide them with one tank or move them to the
  toolbar row on narrow screens.

## Pacing (tests/balance-pacing.js) — tuning applied
Bot: one attempt / 45 s in the newest water, aims at an undiscovered fish among 5 in view (else value-weighted),
landing odds from the gear-tier gap, keeps one of each species (+ rares/dense, pairs when roomy, tanks ≤ 75% full),
feeds, collects, sets each tank's light to the majority preference, buys zone gear → next boat → aquarium capacity →
matching decor. Changes vs §8 (all in `items.js` / `economy.js K`):
- `INCOME_K` .06 → **.12**.
- Boats 400/1600/5000/12000 → **300/1200/3500/5000**; rod III–V → 600/2000/8000; line III–V → 450/1800/6500;
  reel III–V → 700/2200/8000; hook III–IV → 500/2000; lantern I–III → 1000/4000/10000.
- Tank 2nd/3rd/4th → 500/2500/8000; capacity → 250/1200/4500; filter → 300/2000.
Result (5 bots, median): Recife 0:12 (target 0:12), Kelp 0:37 (0:35), Linha III 0:44 (0:50), Mar 1:15 (1:10),
★3 1:47 (1:30), Abismo 2:22 (1:55), ★4 ~2:50 (2:20); till share 9% first 30 min (≈15%), 30% last hour (30–45%).
The late game stays ~25 min behind with this conservative bot (55–85% landing, no frenzies); the ending is not
reached by the bot in 3 h (needs ★4 + storm night + tier-5 gear). Re-run after C's fight tuning.
