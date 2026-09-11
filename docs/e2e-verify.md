# E2E verify

**Verdict: PASS**

Playwright’s 3 greens (display, loop, miss) match what the shots show. The game renders. The first snap is a real pointer drag, not `store.place`. Snap uses `globe.worldToLocal` in `src/scene/Experience.tsx` (~240) before `evaluateSnap`.

## Screenshots (`e2e/output/`)

- `01-title.png` — title, cream globe, «Собери мир из стран», «К столу». Not a black void.
- `02-choose.png` — «Выбери страну.», **0 из 8**, three blank pieces on the table.
- `03-painted.png` — «Теперь на глобус.», Italy piece + flag card, still **0 из 8**.
- `04-italy-snapped.png` — Italy flag on the globe, **1 из 8**, «Остальные — на стол.», remaining blanks on the table. This is the real snap.
- `05-complete.png` — «Мир собран», **8 из 8**, several flags on the globe, «В коллекцию».
- `06-collection.png` — overlay «Коллекция / Восемь стран / Скоро», globe still there.
- `miss.png` — Brazil painted on the globe, **6 из 8**, two blanks left (Egypt + UK). Matches the miss setup.

## Cheats (not the first snap)

- **loop.spec** first Italy: `pointerDragPieceToCountry('IT','IT')`. Does **not** call `place` for that snap. Then it **does** `placeCountry` for JP, BR, AU, IN, MG, EG, GB. Complete/collection/replay are store-fed after one real snap. Weak assert: chroma **or** `placed.length === 1` (shot 04 still shows Italy on the globe).
- **chooseFirst** / **paintCountry** go through the store, not clicks. Display does not paint before the Italy drag.
- **miss.spec** `placeCountry`s IT, JP, BR, AU, IN, MG, then drags EG onto Brazil. Asserts only `placed` lacks EG — no miss HUD / `missAt`. Shot has no miss hint, but Brazil + 6/8 + two pieces is correct.
- **display.spec** Italy drag is real; collection overlay is `openCollection(true)`.
- Bridge `faceCountry` turns the globe before every drag.

The loop is proven as: title → table → one real snap → store-complete the pack → collection → replay. Not eight pointer snaps.
