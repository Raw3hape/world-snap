# Live audit — 2026-09-11

Read: App, store, snap, copy, save, Experience, Piece, CountrySlot, FlagChip, Table, Lamp, tokens, Hud, Overlays, geo/*, pack ids, `public/flags/*.svg`, playtest-v0. Snap frame in Experience **does** `worldToLocal` (frame.test.ts). Flags exist for IT JP BR AU IN MG EG GB.

## P1 — second-row pieces sit outside / on the FOV lip
**File:** `src/scene/Experience.tsx` Rig + `tokens.ts` CAM.fov 34, `countryGeometry.ts` `pieceTableLayout`
**Wrong:** Play camera `[0.22, 2.48, 4.15]` lookAt `(0, -0.52, 0.28)`, vertical FOV 34° (half ~17°). After first snap, 7 homes use 4+3 rows, row 1 at `z ≈ 1.70`. That point is ~18° off the optical axis, so Madagascar / Egypt / UK sit on or under the bottom of the canvas.
**Prove:** First-pick Italy, snap it. Count table silhouettes. Resize to 16:9. The nearer row is flush with the window bottom; grab targets clip.

## P1 — flag UV V is inverted (IN, EG, AU, MG)
**File:** `src/geo/countryGeometry.ts` `buildGlobeGeometry` UVs; `src/geo/flags.ts` CanvasTexture (flipY default true)
**Wrong:** d3-geo y grows down (north → negative y). UVs use that y as v. With flipY, north samples the **bottom** of the flag. Horizontal tricolors soak upside down. Pieces use the same projected shape, so a painted table India/Egypt is inverted too.
**Prove:** Snap Egypt or India. Red / saffron should be the north of the country; it reads south. Compare to Wikipedia.

## P1 — flag chip click starts a drag
**File:** `src/scene/Piece.tsx` invisible `sphereGeometry` r=0.34; `FlagChip.tsx` at `home.x + 0.42`
**Wrong:** Tutorial chip overlaps the pick sphere (0.42 − 0.14 < 0.34). Inner half of the flag ray-hits the piece, so pointer-down calls `pickup` / `chooseFirst`, not `paint`.
**Prove:** Choose Italy. Click the half of the chip nearest the boot. Piece lifts; paint copy never fires.

## P1 — Коллекция covers the table mid-play
**File:** `src/ui/Hud.tsx` always-on button; `Overlays.tsx` Collection; `index.css` `.overlay` `align-items: flex-end`, `pointer-events: none` except children
**Wrong:** Opening collection hides the HUD and parks cards on the table (where remaining pieces are). The dim/gradient does not eat canvas events, so globe spin / leftover piece drags still run under the UI.
**Prove:** Place one country, click «Коллекция». Pieces vanish under cards. Drag in the top half: globe still turns.

## P2 — complete reload is not stuck, but «К столу» lies
**File:** `src/game/store.ts` hydrate/replay; `App.tsx`; `Overlays.tsx` Collection `onClose`
**Wrong:** Save `phase: 'complete'` reopens Complete. «Ещё раз» works (replay → choose-first). Collection header «К столу» only `openCollection(false)`, so you bounce to «Мир собран», not the table. No resume prompt (`copy.resume` unused).
**Prove:** Finish the pack, reload. Complete shows. «В коллекцию» → «К столу» → Complete again. «Ещё раз» is the only exit.

## P2 — later misses do not update HUD
**File:** `src/ui/Hud.tsx`; `copy.ts` `miss`
**Wrong:** `copy.miss` («Не та широта») is never read. Miss line only if `placed === 0`. After scatter, a globe miss still `flashMiss` + thud, HUD stays on hint / empty / last snap.
**Prove:** Place Italy, drop Japan on the ocean. Count stays, no miss sentence.

## P2 — placed flag mesh is missing until (and unless) the texture loads
**File:** `src/scene/CountrySlot.tsx` `{placed && flag && <mesh… depthWrite={false} transparent>}`
**Wrong:** No unpainted land fallback. AU/BR/IN SVGs are xlink-heavy; `loadFlagTexture` catch is empty. Failed raster → snap “succeeds” on a still-white globe. `depthWrite={false}` also lets the soak sort against the ocean.
**Prove:** Block `/flags/in.svg` in DevTools, snap India. Globe stays porcelain. Network OK: watch 0.9s fade; grazing angle can z-fight.

## P2 — collection progress is always «0 из 8»
**File:** `src/ui/Overlays.tsx` `copy.count(0, p.pieceCount)` unless `collection.familiar`
**Prove:** Mid-pack open collection. Familiar card says 0 из 8 while HUD says 3 из 8.
