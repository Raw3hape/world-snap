# Playtest v0 — 2026-09-11

Judged from locked docs + `src/` + live headless pass (title → Italy pick → miss copy → collection flags, no JS errors, snap tests green). Pack: 8 Natural Earth countries, flags in `public/flags/*.svg`.

## 1. What is actually playable end-to-end

Cold load: porcelain globe, title `World Snap` / `Собери мир из стран` / `К столу` (`Overlays.tsx` Title).

`К столу` → three table silhouettes (IT boot, JP, BR) and `Выбери страну.` Pointer-down on one is the first-country choose (`store.chooseFirst`); the other two leave; a 3D flag chip appears (`FlagChip.tsx`). Drag onto the globe; magnet pulls; release on/near the country paints the flag clipped to the mesh (`CountrySlot.tsx`). First miss shows `Ближе к контуру.`

After the first snap the other seven appear on the table. HUD count `{n} из 8`. Hints thin by placement index (`snap.HINT_BY_PLACED`: full / near / none). Eighth snap → complete overlay + collection: `Восемь стран` done, `Европа` / `Континенты` / `Штаты и провинции` show `Скоро`. Replay from collection clears the table, keeps the pack mark.

Loop is: pick → optional first paint → snap eight → collection. Audio synth + haptics fire. Reduced-motion is read live (`useReducedMotion.ts`).

## 2. Gaps vs locked specs

**Copy** (`copy.ts` + `Hud.tsx` vs `gameplay.md` §4 / §13)

- HUD default in PLAY is `Положи страну на её место` (visual leftover). Spec: empty after tutorial.
- First lift uses `Теперь на глобус.` (`copy.place`). Spec beat 3: `Поставь на контур.`
- `Есть.` and `Остальные — на стол.` exist in `copy.ts` and are never shown.
- Complete headline is `Мир собран`; spec prompt is `Восемь стран на месте.`
- Later misses use `Не та широта`. Spec: no nag after the first tutorial miss.
- Resume / replay confirm strings exist (`Продолжить сборку?`, `Сначала`, `Собрать снова?`, `Снова`, `Нет`) and have no UI.
- Names are a single HUD line `Италия  Italy` while dragging, not a RU/EN plate on the ghost.

**Snap numbers** (`snap.ts` vs `gameplay.md` §5.2)

- Uses feel.md `k_start` / `k_lock` clamps, not `snapMax = max(8|5|2.5, k·R)` / `magnetMax = max(14|9|5, k·R)`.
- `R` is bbox-corner distance, not max vertex great-circle from centroid.
- No 350 ms easy hold-assist. No almost-band (90 ms nudge → 280 ms home). No yaw lock. Magnet `τ` is 120→38 ms, not 80 / 53 ms.

**Paint** (`FlagChip.tsx`, `store.paint`)

- Chip only for the unpainted tutorial piece, not every selected remaining piece.
- Tap-on only; no chip-drag onto the piece; `paint()` cannot undo. Chip vanishes after paint.

**Hints** (`Experience.tsx` useFrame)

- Easy ghost + auto-rotate only while the piece is held over the globe, not on select/lift. Auto-rotate is a 280 ms slerp during drag, not an 800 ms tween on select (skip if error < 8°).
- No strict rescue (8 misses / 45 s → name only). No miss counter.

**Save keys** (`save.ts`, `store.ts` vs `gameplay.md` §8.2)

- One blob `world-snap-v1`, not `worldsnap.v0.collection` + `worldsnap.v0.session`.
- Pack id `familiar`, not `iconic-8`. Collection is `{ completedAt }` only (no `firstCompletedAt`, `placedOrder`, `durationMs`, `missCount`, `playCount`).
- Session is not cleared on complete. No RESUME overlay. Boot is Title, not FIRST_PICK / COLLECTION / RESUME.
- Country ids are alpha-2 (`IT`); spec table is alpha-3. Mapped 1:1 in `AGENTS.md` / `data.md`.

**State machine:** no TUTORIAL / SCATTER / RESUME phases. `chooseFirst` jumps to `play`. Scatter tween (700 ms, 50 ms stagger) is missing — the seven just appear. Complete has no 8 s auto-advance to collection. HUD `Коллекция` is always on during play.

## 3. Severity (designer-noticeable)

**P1 — the globe is already a map.** Fixed after this report: unplaced country meshes are no longer drawn. The sphere stays unmarked porcelain until snap; ghost only while the matching piece is held.

**P1 — first-country teaching is a skip.** Chip is easy to miss; lift skips paint copy into `Теперь на глобус.`; there is no `Поставь на контур.`, no name plate at rest, no globe turn-to-Italy on press. First snap can happen without knowing it was a tutorial.

**P1 — miss / almost / wrong-country all feel the same.** `Experience.tsx` `up()`: over globe and `!canSnap` → `flashMiss` + thud + lerp home (`τ ≈ 90 ms`). Off-globe is a silent home (good cancel, no miss++). No 4 px / 80 ms shake on wrong country, no almost tick, no 280 ms ease-out cubic. HUD then scolds `Не та широта` for 1.6 s on every later miss.

**P2 — snap has no click-in.** On accept the table piece opacity drops to 0 the same frame; soak is a 0.9 s opacity fade on the globe mesh. Spec: 200 ms seat, ceramic click at 140 ms, pigment from the contact. Camera also flies (`Rig` to `[0.32, 2.7, 4.55]`, fov 34, look at table) instead of the locked play camera `(0, 0.38, 2.45)` fov 40.

**P2 — globe fight.** Idle yaw never stops (`360° / 180 s` even in PLAY). Drag-rotate has no inertia `0.92`, no pitch clamp ±55°. Auto-rotate fights the player during an easy drag. No `setPointerCapture`; no explicit second-pointer ignore.

**P2 — paint is a one-shot prop.** Cannot unpaint; cannot paint pieces 2–8; chip is a 0.28×0.18 table plane, not a 44 px docked chip.

**P2 — collection / resume are a drawer, not a save.** Mid-pack `Коллекция` opens the overlay (`Hud.tsx`). Reload does not ask `Продолжить сборку?`. Locked cards are inert labels (`Скоро` in meta), no 1.5 s toast. Replay is `Ещё раз` with no `Собрать снова?`. Closing collection after complete returns to `Мир собран`.

**P3 — table / pieces.** Homes are a simple arc (`pieceTableLayout`), not shuffled first-pick slots / two-row PLAY reflow. Piece follow is exponential lerp, not 1:1 (touch lift 44 px is present). No 1.6 Hz almost pulse. Extra unused `toggleMute` in the store.

Live: Italy / Japan / Brazil flags do clip to silhouettes. That part of the signature works.
