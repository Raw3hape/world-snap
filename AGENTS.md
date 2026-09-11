# World Snap

Porcelain globe puzzle. Drag country silhouettes onto a white globe. Correct snap soaks the real flag into the silhouette.

## Playable

Pack `world` — 204 countries with flags. Light paper studio, globe + tray only.
Fallback pack `familiar` — 8 countries: IT JP BR AU IN MG EG GB.

## Canonical docs

- `docs/gameplay.md` — loop, input, copy
- `docs/gameplay-agents.md` — implementer cheat sheet
- `docs/visual.md` — tokens, materials, motion
- `docs/feel.md` — magnet numbers, audio
- `docs/data.md` — Natural Earth + flags

IDs in this repo are ISO 3166-1 **alpha-2** (`IT`, not `ITA`) because Natural Earth and flag files use A2. Gameplay spec’s alpha-3 names map 1:1.

## Commands

```
npm install
npm run data      # refresh pack + flags
npm run dev       # http://localhost:5173
npm test
npm run build
```

## Do not

Second HTML tray, scores, timers, extra packs, flagpoles, graticule, confetti.
