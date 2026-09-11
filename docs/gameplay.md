# World Snap — v0 gameplay spec

Source of truth for the playable prototype. Player-facing copy is Russian. Technical rules are English. Product decisions in this file are locked.

Related: [`gameplay-agents.md`](gameplay-agents.md) (short agent brief).

---

## 0. Locked product

- Web 3D, Three.js, fastest playable test.
- Porcelain-white globe. No map, no borders, no graticule, no ocean tint. Unplaced world is one ceramic sphere.
- Correct snap paints that country with its real flag, clipped to the real silhouette.
- Pieces are 2D country silhouettes on a table in front of the globe. Drag onto the globe. Magnetic snap + ceramic click.
- Painting a table piece with its flag is optional, never a gate. Unpainted pieces still receive the flag on the globe at snap.
- v0 pack `iconic-8`: Italy, Japan, Brazil, Australia, India, Madagascar, Egypt, United Kingdom.
- Start: empty globe. Player chooses the first country from 3 distinctive pieces (Italy, Japan, Brazil). That piece is the tutorial. Then the remaining 7 scatter onto the table.
- Hints fade inside the same pack by **placement index** (0–7), not by country identity.
- Completed pack saves into Collection. Locked cards preview future packs: Europe, Continents, States/Provinces.
- UI language: Russian. Country names: Russian primary, English secondary when a name is shown.

Do not add modes, scores, timers-on-screen, wrong-flag quizzes, or extra packs in v0.

---

## 1. Identifiers and pack data

Use ISO 3166-1 alpha-3. Normalize source geo (`GB`, `GBR`, `-99`) to these ids at load.

| id  | nameRu            | nameEn            | First-pick pool | Notes |
|-----|-------------------|-------------------|-----------------|-------|
| ITA | Италия            | Italy             | yes             | boot |
| JPN | Япония            | Japan             | yes             | archipelago |
| BRA | Бразилия          | Brazil            | yes             | large |
| AUS | Австралия         | Australia         | no              | |
| IND | Индия             | India             | no              | |
| MDG | Мадагаскар        | Madagascar        | no              | |
| EGY | Египет            | Egypt             | no              | |
| GBR | Великобритания    | United Kingdom    | no              | archipelago |

Pack definition (runtime constant, also `public/data/pack-iconic-8.json`):

```json
{
  "id": "iconic-8",
  "titleRu": "Восемь стран",
  "pieceIds": ["ITA", "JPN", "BRA", "AUS", "IND", "MDG", "EGY", "GBR"],
  "firstPickPool": ["ITA", "JPN", "BRA"]
}
```

Locked collection previews (not playable):

| id                 | titleRu                | status |
|--------------------|------------------------|--------|
| europe             | Европа                 | locked |
| continents         | Континенты             | locked |
| states-provinces   | Штаты и провинции      | locked |

Runtime per country, derived from GeoJSON:

- `feature`: MultiPolygon / Polygon
- `centroid`: `d3.geoCentroid(feature)` → `[lon, lat]`
- `angularRadiusR`: max great-circle distance in **degrees** from centroid to any polygon vertex (sample holes ignored; use exterior rings)
- Globe mesh: spherical tessellation of the polygon, used for ghost + painted patch
- Table mesh: 2D shape, atlas-style (equirectangular or Mercator around centroid), Y-up on the table, recognizable silhouette

Flag files: `public/flags/{id}.svg` (ITA.svg … GBR.svg).

Geo: `public/data/iconic-8.geojson`, one Feature per id, property `id` = alpha-3.

---

## 2. State machine

```
BOOT
  ├─ (session exists)            → RESUME
  ├─ (pack complete, no session) → COLLECTION
  └─ (else)                      → FIRST_PICK

FIRST_PICK  → (pointerdown on a pool piece) → TUTORIAL

TUTORIAL
  ├─ (successful snap) → SCATTER
  └─ (miss)            → stay TUTORIAL

SCATTER (transient, ~700ms) → PLAY

PLAY
  ├─ (successful snap, remaining > 0) → PLAY
  └─ (successful snap, remaining = 0) → COMPLETE

COMPLETE (save collection, clear session) → COLLECTION

COLLECTION
  ├─ (replay iconic-8) → FIRST_PICK   // fresh pack, keep collection record
  └─ (locked card)     → toast «Скоро», stay COLLECTION

RESUME
  ├─ (Продолжить) → PLAY or TUTORIAL   // restore exact phase
  └─ (Сначала)    → clear session → FIRST_PICK
```

No pause screen. No settings screen in v0. Tab hidden is not a state: cancel drag, freeze, keep current state.

### 2.1 BOOT

**On screen:** porcelain globe, studio light, no UI except a thin top wordmark `World Snap`. No spinner unless flags+geo for the first-pick pool are not ready after 300ms; then a small porcelain dash under the wordmark.

**Load order:** sphere immediately → ITA/JPN/BRA geo+flags → remaining 5 → audio.

**Read:** `localStorage` keys in §8. `prefers-reduced-motion`.

**Exit:** as the diagram. Target: first interactive frame ≤ 1.5s on a mid laptop.

### 2.2 FIRST_PICK

**On screen:**

- Globe: empty porcelain. Rotatable.
- Table: three large pieces, shuffled homes each fresh start (not shuffled mid-resume).
- Prompt: `Выбери страну.`
- No flag chips. No ghosts. No names on pieces.

**Transition:** `pointerdown` on a piece sets `firstCountry`, `placed = []`, `pieceIndex = 0`, writes session, enters TUTORIAL. Choosing is the press, not a successful snap.

### 2.3 TUTORIAL

**On screen:**

- Chosen piece moves to the tutorial home (center-front of table), sticky-selected.
- Other two pool pieces tween off the table (they come back in SCATTER).
- Flag chip for the chosen country appears.
- Prompt follows tutorial beats (§4).
- Easy-tier hints: auto-rotate + ghost + name, on select/pickup.

Player may paint, or pick up immediately, or even snap immediately. Place is required. Paint is not.

**Exit:** first successful snap of `firstCountry` → SCATTER.

### 2.4 SCATTER

**On screen:** globe with one painted country. Prompt `Остальные — на стол.` Remaining 7 pieces tween to table homes, stagger 50ms, duration 500ms each (0ms if reduced-motion).

Non-interactive except globe rotate. Then PLAY.

### 2.5 PLAY

**On screen:**

- Globe: painted countries keep flags; rest porcelain.
- Table: remaining pieces.
- Prompt: empty, except first miss in easy (§4).
- Progress HUD, top-right, small: `{placedCount} из 8`.
- Hints by `pieceIndex = placed.length` for the piece currently selected/held (§5).

**Exit:** `placed.length === 8` → COMPLETE.

### 2.6 COMPLETE

**On screen:** last snap finishes (200ms). 300ms hold. Globe slowly yaws (~12°/s) showing painted countries. Prompt `Восемь стран на месте.` Buttons: `В коллекцию` · `Ещё раз`.

Reduced-motion: no yaw; hold 800ms then same buttons.

**Side effects at enter:** write collection, clear session.

`В коллекцию` → COLLECTION. `Ещё раз` → FIRST_PICK (fresh). Auto-advance to COLLECTION after 8s if no click.

### 2.7 COLLECTION

**On screen:**

- Globe in background with all 8 flags if this pack is complete; empty porcelain if opened somehow earlier.
- Title `Коллекция`.
- Cards in one row (wrap on narrow):
  1. Восемь стран — unlocked, complete mark, tap = replay confirm
  2. Европа — locked
  3. Континенты — locked
  4. Штаты и провинции — locked
- Replay confirm: `Собрать снова?` · `Снова` · `Нет`.

Locked tap: toast `Скоро` 1.5s. No navigation.

### 2.8 RESUME

Overlay on a globe that already shows `placed` flags, remaining pieces on the table (or tutorial layout if `placed.length === 0` and `firstCountry` set).

Copy: `Продолжить сборку?` · `Продолжить` · `Сначала`.

---

## 3. Input map

Single interaction at a time. `pointerId` of the first qualifying `pointerdown` is the owner until `pointerup` / `pointercancel` / blur.

Canvas: `touch-action: none`. `setPointerCapture(ownerId)` on drag start. `preventDefault` on owner move.

### 3.1 Hit test order (top to bottom)

1. HTML UI (buttons, cards, toast)
2. Flag chip
3. Table pieces, front-to-back
4. Globe sphere
5. Empty table / background — ignore (do not rotate from empty space)

### 3.2 Globe rotate vs piece drag

| Pointer down on | Result |
|-----------------|--------|
| Table piece     | Piece drag. Globe does **not** rotate from this pointer. |
| Flag chip       | Chip click or chip drag. No globe rotate. |
| Globe (no piece)| Globe rotate. |
| UI              | UI. |

v0: a second finger/pointer is ignored while owner is active. No two-handed rotate-while-drag.

### 3.3 Piece drag

- `pointerdown` on piece: lift immediately (Y +8–12px, scale 1.05, shadow on). This is select + potential drag. No 4px gate for lift; there is a 4px gate only to distinguish a click-toggle from a drag for the **chip**.
- Move: piece follows pointer 1:1 in screen space. Over table: stay on table plane. Over globe (ray hit): hover at surface + `0.04 * globeRadius` along the outward normal.
- Unmagnetized orientation: map-up, facing camera.
- Magnetized: lie on the sphere, aligned to the target country patch (§3.7).
- `pointerup`:
  - ray misses globe → **cancel**, return to table home
  - ray hits globe, snap accept → **snap**
  - ray hits globe, almost band → **almost** then return home
  - ray hits globe, else → **miss**, return home

### 3.4 Cancel / return-to-table

Triggers: `Escape`; `pointerup` off-globe; `pointercancel`; `visibilitychange` hidden; `blur`; window `resize` that changes layout; second-button `contextmenu` (prevent default, cancel).

Return: 280ms ease-out cubic to that piece’s **home** position (not wherever it was lifted). Interactive again at end. Painted state preserved.

### 3.5 Click select (paint)

`pointerdown` + `pointerup` on the same piece with movement < 8px: keep selected, show chip, do not throw. Click empty globe: globe rotate only if moved; a click without move on globe deselects the piece (ghost hides). Click empty table: deselect.

Tutorial: selection is sticky until snap. Clicking the globe does not deselect in TUTORIAL.

### 3.6 Globe rotate

- Axes: yaw around world up from `dx`; pitch from `dy`, clamped so camera-facing point stays in lat `[-55°, +55°]`.
- Sensitivity: `0.25°` per CSS pixel.
- Inertia: multiply velocity by `0.92` per frame at 60fps; stop when `< 0.05°/frame`.
- Keyboard (when no text field focused): `ArrowLeft`/`KeyA` yaw +, `ArrowRight`/`KeyD` yaw −, `ArrowUp`/`KeyW` pitch +, `ArrowDown`/`KeyS` pitch −, `8°` per keydown repeat. `Escape` cancels drag.
- Pinch / wheel zoom: **off** in v0. Camera is fixed.
- Rotate is blocked during snap animation, scatter, and auto-rotate. Queued moves discarded.

### 3.7 Magnet while held

Each frame, raycast owner pointer onto the globe.

Let `α` = great-circle degrees from hit point to target `centroid`.
Let `R` = `angularRadiusR`.
Let `snapMax` / `magnetMax` from §5 for the current hint tier.

Bands:

- `α ≤ snapMax` **or** `geoContains(hit, target)` → **snap band** (accept on release)
- else `α ≤ magnetMax` → **almost / magnet band**
- else → no magnet

In magnet or snap band:

- Piece position lerps toward the target patch hover point (centroid projected, or closest point on polygon if contains).
- Lerp time constant `τ = 80ms` (`p += (target-p) * (1 - exp(-dt/τ))`).
- In almost band, `τ = 80ms / 1.5 ≈ 53ms` (stronger magnet) and scale pulses `1.00–1.03` at 1.6Hz.
- Ghost opacity +0.15 if a ghost is allowed this tier.

On release in almost band: nudge 12% closer to the slot over 90ms, then spring home 280ms. Soft tick, not the ceramic click. No flag on globe.

Easy-tier hold assist: if the pointer stays in the magnet band for **350ms** continuously, treat as snap band (auto-settle). Normal and strict: no hold assist.

### 3.8 Keyboard besides rotate

| Key | Action |
|-----|--------|
| Escape | Cancel drag / close replay confirm / close resume by staying (do not clear session) |
| Enter | Activate focused HTML button |
| Space | No-op in v0 |

No keyboard piece move in v0.

---

## 4. Tutorial beats (first country)

First country = whichever of ITA / JPN / BRA the player pressed. Beats are prompts, not modal locks. Doing the action always wins. Prompts fade on the next beat or after 4s.

`{nameRu}` = Russian name of the chosen country.

| Beat | Trigger | Copy | Visible | Required action |
|------|---------|------|---------|-----------------|
| 0 | Enter FIRST_PICK | `Выбери страну.` | 3 pieces | Press a piece |
| 1 | Piece chosen, still unpainted, not yet lifted | `Флаг — по желанию.` | Chip + piece at tutorial home | None |
| 2 | Paint applied in tutorial | `Теперь на глобус.` | Painted piece | Lift or drag |
| 3 | Select or lift (painted or not) | `Поставь на контур.` | Auto-rotate, ghost, name | Snap |
| 3m | First miss in TUTORIAL only | `Ближе к контуру.` | Same | Retry |
| 4 | Successful snap | `Есть.` | Flag on globe | None |
| 5 | 400ms after snap | `Остальные — на стол.` | Scatter | None |

Skip rules:

- Lift or drag before painting → skip beat 1–2 copy, go to beat 3.
- Snap on the first drag from FIRST_PICK (speed path) → skip 1–2, run 3 during the drag if time allows, then 4–5. Legal.
- Further misses in tutorial: no new copy (do not nag).
- Never say “tutorial”, “молодец”, “правильно”, or use “!”.

Name plate during beat 3 (easy): `{nameRu}` with `{nameEn}` under it, smaller, 70% opacity. Example:

```
Италия
Italy
```

---

## 5. Hint schedule and snap numbers

`pieceIndex = placed.length` at the moment the piece is selected (tutorial is always 0). Hints belong to the **held/selected** piece’s target only. Never show ghosts for every remaining country.

### 5.1 Tiers

| Tier   | pieceIndex | Auto-rotate | Ghost | Name (RU + EN) | Snap / magnet |
|--------|------------|-------------|-------|----------------|---------------|
| Easy   | 0, 1, 2    | Yes, on select/lift | Always while selected or held | Always while selected or held | Easy |
| Normal | 3, 4, 5    | No | Only while held **and** `α ≤ magnetMax` | Always while selected or held | Normal |
| Strict | 6, 7       | No | No | No | Strict |

Ghost: target country mesh, porcelain/white, opacity `0.28` (easy) or `0.36` when near (normal), `depthWrite: false`, `raycast` off. Fades 200ms.

Name plate: anchored above the ghost if ghost is visible; otherwise above the held piece. Strict: nothing.

### 5.2 Thresholds (degrees)

`R = angularRadiusR`. `max(floor, k*R)` keeps tiny countries (GBR) playable and large ones (BRA, AUS) from accepting half a hemisphere.

| Tier   | Snap accept `snapMax`     | Magnet start `magnetMax`  | Hold assist |
|--------|---------------------------|---------------------------|-------------|
| Easy   | `max(8.0°,  0.70 * R)`    | `max(14.0°, 1.40 * R)`    | 350ms in magnet → accept |
| Normal | `max(5.0°,  0.45 * R)`    | `max(9.0°,  0.90 * R)`    | no |
| Strict | `max(2.5°,  0.25 * R)`    | `max(5.0°,  0.50 * R)`    | no |

### 5.3 Accept predicate (pointerup on globe)

Accept if **any**:

1. `geoContains(hitPoint, targetFeature)` — any ring of that country (Japan/UK: any island is enough).
2. `α ≤ snapMax` (centroid fallback, also covers drops in gulfs / between islands).
3. Easy hold assist fired (§3.7).

Do **not** test “which country is this”. Only the dragged piece’s target. v0 countries do not share borders; still write the rule.

Reject (miss) if the ray hits the globe and accept is false.

- If `geoContains(hitPoint, any other loaded country)` → **wrong-country miss**: spring home + 4px / 80ms shake. No name of the other country.
- Else → **ocean miss**: spring home, no shake.
- Ray misses globe → **cancel**, spring home, no shake, no miss count.

Miss count (session) increments on wrong-country and ocean, not on cancel.

### 5.4 Rescue (stuck player)

If the **same** remaining piece records **8** misses **or** is held/selected for **45s** wall time in strict: fade in name only (RU + EN), still no ghost, still no auto-rotate. One-shot per piece. Not shown in easy/normal (they already have names).

### 5.5 Already placed

Placed pieces are not on the table. Painted globe patches are not draggable; they rotate the globe. Dropping another piece onto an already-painted country is a wrong-country miss unless that country is the target (impossible).

---

## 6. Auto-rotate and camera

### 6.1 Rig (v0 fixed)

- Globe radius `1.0` at origin.
- Camera: position `(0, 0.38, 2.45)`, look at `(0, 0, 0)`, FOV `40°`, no user zoom.
- Table plane: `y = -1.18`, pushed toward camera so pieces sit in the lower ~28% of the viewport.
- Lighting: one soft key, faint rim; ceramic, not earth-from-space.

Camera never moves for hints. The **globe mesh** yaws/pitches.

### 6.2 When the globe turns for you

Only Easy (`pieceIndex` 0–2), on the event `piece becomes selected` (includes lift).

Target: centroid faces the camera. Pitch so the centroid sits ~12% above globe screen center. Duration **800ms**, ease-in-out cubic.

Skip the tween if the remaining angular error is `< 8°`.

Do **not** auto-rotate when:

- Normal or strict
- Reduced-motion (see §6.4)
- A drag is already in flight **and** this would interrupt aiming — exception: the rotate starts first, then the player drags. If they selected and auto-rotate is running, piece drag is allowed; globe rotation continues to finish; pointer move does not add manual rotate (owner is the piece).
- PLAY after the player has started a **manual** globe rotate since the last select: if they select the same piece again, auto-rotate **does** fire again (re-orient). If they only rotate without reselecting, leave it.

During auto-rotate, inertia from previous manual spin is killed.

### 6.3 When it does not

Player always rotates by hand in normal/strict. After easy auto-rotate finishes, they may still adjust. Snap animation does not turn the globe except a 2° settle toward the patch (skip if reduced-motion).

SCATTER / COMPLETE: COMPLETE yaws slowly; SCATTER does not.

### 6.4 Reduced-motion

`matchMedia('(prefers-reduced-motion: reduce)')`, live (not only at boot).

| Motion | Fallback |
|--------|----------|
| Easy auto-rotate | Instant orientation (0ms), no tween |
| Scatter | Pieces appear on homes |
| Snap fly | 120ms fade: table piece out, globe flag in. Click at 0ms of this fade |
| Spring home | Instant |
| Almost nudge | Skip nudge, instant home |
| Complete yaw | Skip, static globe |
| Magnet pulse scale | Off; position magnet still on (it is aiming, not decoration) |

---

## 7. Paint flow

Paint is ritual, not a quiz. Only the matching flag chip is offered. There is no wrong flag.

### 7.1 Chip

Visible only for the selected remaining piece. Size ≥ 44×44 CSS px hit area; flag face ~40×28 with a ceramic bezel, to the right of the piece (flip to the left if it would clip the viewport).

### 7.2 Apply

- Tap chip: toggle paint on the selected piece.
- Drag chip onto its piece: paint on, chip returns to dock.
- Drag chip onto globe / void: cancel, chip returns, no paint change.

No “apply all”. No paint-on-globe without snap.

### 7.3 Look

| State | Table piece |
|-------|-------------|
| Unpainted | Porcelain `#F4F1EA`, roughness ~0.3, same family as the globe, sharp silhouette, no flag UV |
| Painted | Flag texture, UVs from 2D bbox, clipped to silhouette, same roughness, slight clearcoat |
| Held | Either of the above, lifted |
| Placed | Disposed from table |

Globe country: always unpainted porcelain-invisible (no outline) until snap; then flag clipped to spherical silhouette, hairline contact with surrounding porcelain. Unpainted table pieces **do** paint the globe on snap.

### 7.4 Undo

Tap chip again while selected → unpaint. No undo after snap. Session stores `paintedOnTable: string[]` of remaining painted ids.

---

## 8. Completion, collection, replay

### 8.1 Celebration

See COMPLETE in §2.6. Audio: ceramic click on last snap, then a short low complete chime (optional asset; skip if missing). No confetti, no particle burst, no score.

### 8.2 localStorage

Schema `version` inside JSON is `1`. Keys are v0 product keys.

**Collection** — `worldsnap.v0.collection`

```json
{
  "version": 1,
  "packs": {
    "iconic-8": {
      "id": "iconic-8",
      "status": "complete",
      "firstCompletedAt": "2026-09-11T12:00:00.000Z",
      "lastCompletedAt": "2026-09-11T12:00:00.000Z",
      "firstCountry": "ITA",
      "placedOrder": ["ITA", "JPN", "BRA", "AUS", "IND", "MDG", "EGY", "GBR"],
      "durationMs": 184000,
      "missCount": 6,
      "playCount": 1
    }
  }
}
```

Write **only** on pack complete. Replay increments `playCount`, updates `lastCompletedAt`, `placedOrder`, `durationMs`, `missCount`, `firstCountry` of the new run. Never delete `firstCompletedAt`.

**Session** (in-progress) — `worldsnap.v0.session`

```json
{
  "version": 1,
  "packId": "iconic-8",
  "phase": "tutorial",
  "firstCountry": "JPN",
  "placed": ["JPN"],
  "remaining": ["ITA", "BRA", "AUS", "IND", "MDG", "EGY", "GBR"],
  "paintedOnTable": ["BRA"],
  "pieceIndex": 1,
  "missCount": 2,
  "startedAt": "2026-09-11T12:00:00.000Z",
  "updatedAt": "2026-09-11T12:03:00.000Z"
}
```

`phase`: `"first_pick"` | `"tutorial"` | `"play"`.

Write on: choose first country, paint toggle, successful snap, each miss. Clear on pack complete and on `Сначала`.

Corrupt JSON / wrong `version`: ignore, treat as empty. Do not crash.

### 8.3 Replay and what is locked

- Replay = new FIRST_PICK, empty globe, new session. Collection record stays.
- Locked packs cannot start. No store, no waitlist, no dates.
- There is no delete-collection UI in v0.

### 8.4 First visit vs returning

| Storage | Boot target |
|---------|-------------|
| No keys | FIRST_PICK |
| Session present | RESUME (even if collection also complete from an earlier run) |
| Collection has `iconic-8.status === "complete"`, no session | COLLECTION |
| Collection present but pack not complete (should not happen) | FIRST_PICK |

---

## 9. Edge cases

| Case | Rule |
|------|------|
| Drop off-globe | Cancel, 280ms home, no miss |
| Drop on ocean | Miss, home, no shake |
| Drop on wrong country | Miss, home, 80ms 4px shake |
| Drop on correct country, sloppy | Accept via `geoContains` or centroid `snapMax` |
| Almost-correct release | Nudge then home, soft tick, no paint |
| Overlapping polygons | Only target feature is tested |
| Archipelago (JPN, GBR) | Any island `geoContains` accepts; centroid fallback covers water between islands |
| Piece already placed | Not on table; globe patch rotates globe |
| Drag a second piece | Impossible; other pointers ignored |
| Double pointer / palm | Owner `pointerId` captured; others ignored |
| Tab blur / hide mid-drag | Cancel, home, release capture |
| `pointercancel` (iOS gesture, DevTools) | Same as blur |
| Resize / rotate device | Debounce 100ms, reflow homes, cancel drag if any |
| First visit | FIRST_PICK |
| Returning, incomplete | RESUME |
| Returning, complete | COLLECTION |
| Choose in FIRST_PICK then miss | Stay TUTORIAL with that country; do not return to 3-pick |
| Paint then refresh | Session restores paint on remaining pieces |
| Missing flag file | Snap still accepts; globe/table use a flat fallback color `#C4C4C4` and `console.warn`. Do not block play |
| Missing geo for a country | Exclude from pack at boot, show `Не загрузилось.` and a retry. Do not start a 7-country pack silently |
| `localStorage` throws (private mode) | Play works, collection/session no-op, no banner |
| Rapid double snap | Piece unpickable from `pointerup` accept; ignore extra events |
| Drop on another table piece | Treat as off-globe cancel (home), no swap |
| Context menu | `preventDefault` on canvas, cancel drag |

---

## 10. Feel targets

| Beat | Target |
|------|--------|
| Time to first snap (new player, follows prompts) | ≤ **25s** typical, **30s** acceptance max |
| Piece follow | 1:1 pointer, 0 lag |
| Magnet lerp `τ` | **80ms** (almost: **53ms**) |
| Snap animation | **200ms**; ceramic click at **140ms**; globe flag visible at click |
| Spring home | **280ms** ease-out cubic |
| Auto-rotate | **800ms** |
| Ghost fade | **200ms** |
| Scatter | **500ms** + **50ms** stagger |
| Chip toggle | Instant material swap, optional 80ms rustle |
| Lift height | `0.04–0.06` world units on table |
| Ceramic click | 40–80ms, dry, not a UI “pop”; volume ~0.4 |
| Miss | Dull tick, quieter; never a buzzer |

If a frame of magnet/snap work exceeds 8ms, simplify tessellation, not the rules.

---

## 11. Layout of table homes

- FIRST_PICK: 3 pieces, max width `min(28vw, 220px)`, shuffled among 3 slots on an arc.
- PLAY: remaining pieces, max width `min(18vw, 140px)`, min gap 16px, one or two rows in the table band. Reflow on resize.
- Tutorial home: center slot, slightly larger (`min(24vw, 180px)`).
- Pieces must not cover the globe disc. If viewport is short (`height < 640px`), scale the table band down, keep globe dominant.

---

## 12. Audio (optional assets)

| File | When |
|------|------|
| `public/audio/ceramic-click.wav` | Snap, at 140ms (or 0ms if reduced-motion fade) |
| `public/audio/miss.wav` | Ocean / wrong-country miss |
| `public/audio/almost.wav` | Almost release |
| `public/audio/paint.wav` | Paint on |
| `public/audio/complete.wav` | COMPLETE enter |

Missing file = silent, not an error. No mute UI in v0; respect OS mute.

---

## 13. Copy sheet (all player-facing strings)

Use exactly these. No extras in v0.

| id | ru |
|----|----|
| pick | Выбери страну. |
| paint_optional | Флаг — по желанию. |
| after_paint | Теперь на глобус. |
| place | Поставь на контур. |
| first_miss | Ближе к контуру. |
| snapped | Есть. |
| scatter | Остальные — на стол. |
| complete | Восемь стран на месте. |
| to_collection | В коллекцию |
| again | Ещё раз |
| collection | Коллекция |
| pack_iconic | Восемь стран |
| pack_europe | Европа |
| pack_continents | Континенты |
| pack_states | Штаты и провинции |
| soon | Скоро |
| resume | Продолжить сборку? |
| continue | Продолжить |
| start_over | Сначала |
| replay_q | Собрать снова? |
| replay_yes | Снова |
| replay_no | Нет |
| load_fail | Не загрузилось. |
| retry | Ещё раз |
| progress | {n} из 8 |

Country names: table in §1. Name plate = `nameRu` + newline + `nameEn`.

Wordmark: `World Snap` (not translated).

---

## 14. Acceptance checklist (v0 playable test)

A build passes when all of these are true on desktop Chrome and one touch Safari/iOS or Chrome Android.

1. Cold load shows a porcelain globe with no countries, borders, or map texture before any piece is placed.
2. First visit lands on three pieces only: ITA, JPN, BRA. Prompt is `Выбери страну.`
3. Pressing one of the three hides the other two and starts the tutorial for that country; session writes `firstCountry`.
4. Flag chip is visible in tutorial; snapping **without** painting still paints the globe with the correct flag.
5. Painting then unpainting (chip toggle) restores porcelain on the table piece.
6. First select/lift auto-rotates the globe to the target, shows ghost + `nameRu`/`nameEn`, within 800ms (instant if reduced-motion).
7. Dropping the tutorial piece on the correct silhouette plays a ceramic click, paints the globe clipped to the real outline, and removes the table piece.
8. A miss on ocean springs the piece home in ~280ms with no flag and no scolding copy except the first tutorial miss (`Ближе к контуру.`).
9. A miss on a wrong v0 country springs home with a short shake, no other country’s name.
10. Dropping off the globe cancels (no miss count).
11. After the first snap, seven remaining pieces scatter onto the table; prompt `Остальные — на стол.`
12. Progress HUD shows `1 из 8` then increments only on successful snaps.
13. Placement index 1 and 2 still get auto-rotate + ghost + name.
14. Placement index 3, 4, 5: globe does **not** auto-rotate; name shows; ghost appears only when the held piece is near (`α ≤ magnetMax`).
15. Placement index 6 and 7: no name, no ghost, no auto-rotate; player rotates the globe by dragging it.
16. While holding a piece, dragging does not rotate the globe.
17. Dragging the globe (no piece) rotates it; pitch is clamped; inertia decays.
18. Escape or hiding the tab mid-drag returns the piece home and releases capture.
19. Resize reflows table homes and does not leave a piece stuck in space.
20. Two fingers cannot drag two pieces; the second pointer is ignored.
21. Eighth snap enters COMPLETE with `Восемь стран на месте.`, writes `worldsnap.v0.collection`, clears `worldsnap.v0.session`.
22. Reload after complete opens COLLECTION with the iconic pack unlocked and three locked cards `Европа`, `Континенты`, `Штаты и провинции`. Locked tap shows `Скоро`.
23. Replay runs FIRST_PICK again on an empty globe and does not wipe `firstCompletedAt`.
24. Reload mid-pack shows `Продолжить сборку?`; Продолжить restores placed flags + remaining pieces + paint toggles; Сначала returns to three-pick.
25. A new player who follows prompts can snap the first country in ≤ 30s.
26. Magnet: approaching the target, the piece is pulled onto the patch before release; almost-release nudges then returns home without painting.
27. `prefers-reduced-motion: reduce` removes auto-rotate tweens, scatter motion, snap fly, and complete yaw; snap still paints.
28. Russian UI only, except wordmark `World Snap` and secondary English names on hint plates.
29. All eight flags clip to their own silhouettes on the globe (Italy is a boot, Japan is islands, UK is islands — not bounding boxes).
30. Missing optional audio does not block snaps.

---

## 15. Out of scope for v0

Scoring, on-screen clock, multiplayer, accounts, extra packs, painting with the wrong flag, visible country outlines before snap, camera zoom, two-handed drag+rotate, keyboard moving pieces, settings gear, i18n beyond RU+EN names.
