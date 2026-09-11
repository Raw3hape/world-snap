# World Snap — agent brief (v0)

Canonical rules: [`gameplay.md`](gameplay.md). Do not reopen product decisions there. This file is the implementer cheat sheet.

## Locked

Web / Three.js. Porcelain globe, no map until snap. Flag clipped to real silhouette on snap. Table silhouettes, drag, magnet + ceramic click. Paint optional. Pack `iconic-8`. First pick from ITA/JPN/BRA = tutorial. Hints fade by **placement index**. Collection + three locked cards. UI RU, names RU + EN secondary.

## Pack

`ITA JPN BRA AUS IND MDG EGY GBR`  
First-pick pool: `ITA JPN BRA`  
`public/data/pack-iconic-8.json`  
`public/data/iconic-8.geojson` (property `id`)  
`public/flags/{id}.svg`  
Normalize geo codes to alpha-3 (`GB` → `GBR`).

`R` = max great-circle deg from `d3.geoCentroid(feature)` to vertices.

## States

`BOOT → FIRST_PICK | RESUME | COLLECTION`  
`FIRST_PICK → TUTORIAL` (pointerdown on pool piece = choose)  
`TUTORIAL → SCATTER → PLAY → COMPLETE → COLLECTION`  
Replay: `COLLECTION → FIRST_PICK` (keep collection).  
`Сначала`: clear session → `FIRST_PICK`.

On screen: see gameplay.md §2. No pause, no settings.

## Storage

| key | when |
|-----|------|
| `worldsnap.v0.collection` | pack complete only |
| `worldsnap.v0.session` | choose / paint / snap / miss |

Collection pack object: `id, status:"complete", firstCompletedAt, lastCompletedAt, firstCountry, placedOrder[], durationMs, missCount, playCount`. Replay updates last* and playCount; never wipe `firstCompletedAt`.

Session: `packId, phase: first_pick|tutorial|play, firstCountry, placed[], remaining[], paintedOnTable[], pieceIndex, missCount, startedAt, updatedAt`. Inner `version: 1`. Corrupt → ignore.

Boot: session → RESUME; else complete collection → COLLECTION; else FIRST_PICK.

## Input (one owner `pointerId`)

Hit: UI → chip → pieces → globe.  
Piece down = lift + drag, globe does not rotate. Globe down = yaw/pitch (`0.25°/px`, pitch lat clamp ±55°, inertia 0.92). Second pointer ignored.  
Cancel home 280ms: Escape, pointerup off-globe, pointercancel, blur/hide, layout resize, contextmenu.  
Capture on drag. `touch-action: none`. No zoom.

## Snap (`pieceIndex = placed.length`)

Accept on pointerup if `geoContains(hit, target)` OR `α ≤ snapMax` OR (easy && 350ms in magnet). Test **target only**.

| Index | Tier | Auto-rotate | Ghost | Name | snapMax | magnetMax |
|------:|------|-------------|-------|------|---------|-----------|
| 0–2 | Easy | yes on select/lift, 800ms (instant if reduced-motion) | while selected/held | RU+EN | `max(8, 0.70R)` | `max(14, 1.40R)` |
| 3–5 | Normal | no | held AND `α ≤ magnetMax` | RU+EN | `max(5, 0.45R)` | `max(9, 0.90R)` |
| 6–7 | Strict | no | no | no | `max(2.5, 0.25R)` | `max(5, 0.50R)` |

Magnet `τ=80ms`; almost `τ=53ms`. Release in almost: 90ms nudge then 280ms home, no paint. Ocean miss: home. Wrong country: home + 8px/80ms shake. Off-globe: cancel, no miss++. Strict rescue: 8 misses or 45s on same piece → name only.

Snap motion 200ms, click at 140ms. Reduced-motion: 120ms fade, click at 0.

## Paint

Chip on selected piece only, matching flag. Tap = toggle. Drag chip onto piece = on. Undo = tap again. Never a gate. Globe still gets flag on snap.

## Camera

Fixed: globe r=1 origin, camera `(0, 0.38, 2.45)` FOV 40°, table `y=-1.18`. Rotate globe, not camera. Auto-rotate only easy. Skip tween if error < 8°.

## Copy (exact)

`Выбери страну.` · `Флаг — по желанию.` · `Теперь на глобус.` · `Поставь на контур.` · `Ближе к контуру.` (first tutorial miss only) · `Есть.` · `Остальные — на стол.` · `{n} из 8` · `Восемь стран на месте.` · `В коллекцию` · `Ещё раз` · `Коллекция` · `Восемь стран` · `Европа` · `Континенты` · `Штаты и провинции` · `Скоро` · `Продолжить сборку?` · `Продолжить` · `Сначала` · `Собрать снова?` · `Снова` · `Нет` · `Не загрузилось.`

Names: Италия/Italy, Япония/Japan, Бразилия/Brazil, Австралия/Australia, Индия/India, Мадагаскар/Madagascar, Египет/Egypt, Великобритания/United Kingdom.

Beats skip if the player just acts. No “!”, no “tutorial” in UI.

## Feel

First snap ≤ 30s. Magnet τ 80ms. Snap 200ms. Home 280ms. Auto-rotate 800ms.

## Do not build in v0

Score, timer HUD, zoom, two-hand drag+rotate, extra packs, wrong-flag quiz, outlines before snap, settings, i18n beyond this copy.

## Done when

Checklist in gameplay.md §14 (30 items). Especially: optional paint, hint fade by index, collection keys, clip-to-silhouette flags, reduced-motion fallbacks.
