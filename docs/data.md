# Geography data (v0)

Offline pack for World Snap.

Re-run:

```
node scripts/prepare-data.mjs
```

Requires Node 18+ (global `fetch`). The script downloads Natural Earth + flag SVGs and writes:

- `public/data/pack-familiar.json`
- `public/data/collection.json`
- `public/flags/{iso}.svg` (lowercase ISO A2)

## Sources

### Countries — Natural Earth 110m admin 0

Primary:

https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson

Fallback:

https://raw.githubusercontent.com/martynafford/natural-earth-geojson/master/110m/cultural/ne_110m_admin_0_countries.json

Used this run: https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson

Upstream: [Natural Earth](https://www.naturalearthdata.com/). License: **public domain** ([terms of use](https://www.naturalearthdata.com/about/terms-of-use/)). Attribution is appreciated, not required.

ISO field: `ISO_A2` (United Kingdom is `GB`, not `UK`). If `ISO_A2` is missing or `-99`, the script tries `ISO_A2_EH`, then `WB_A2`, then `ADM0_A3`.

Scale is 1:110 million. Coordinates are kept as published. No extra simplification.

### Flags — country-flags (Wikimedia SVGs)

https://cdn.jsdelivr.net/gh/hampusborgos/country-flags@main/svg/{code}.svg

Repo: [hampusborgos/country-flags](https://github.com/hampusborgos/country-flags) (collection MIT). Paths are lowercase ISO A2 (`it.svg`, `gb.svg`).

The drawings come from Wikimedia Commons. The eight pack flags are **national flags in the public domain** (state symbols; not subject to copyright). Stored as `public/flags/{code}.svg`.

## Pack `familiar` (8)

| ISO A2 | nameRu | nameEn | geometry at 110m |
| --- | --- | --- | --- |
| IT | Италия | Italy | MultiPolygon: mainland + Sicily + Sardinia |
| JP | Япония | Japan | MultiPolygon: main islands. Okinawa is not in 110m |
| BR | Бразилия | Brazil | Polygon |
| AU | Австралия | Australia | MultiPolygon: mainland + Tasmania (kept) |
| IN | Индия | India | Polygon. Sri Lanka is `LK`, not included |
| MG | Мадагаскар | Madagascar | Polygon |
| EG | Египет | Egypt | Polygon |
| GB | Великобритания | United Kingdom | MultiPolygon: Great Britain + Northern Ireland |

Centroids are area-weighted in lon/lat. Degenerate area falls back to bbox center.

Tiny distant scraps (area &lt; 0.5% of the largest ring **and** more than 12° from it) are dropped so a puzzle piece stays readable.

Dropped this run:

- None dropped in this pack.

## Collection stub

`public/data/collection.json` lists four packs. Only `familiar` is playable.

## Special cases

- AU: Tasmania is present in the 110m feature and was kept.
- GB: Natural Earth feature is United Kingdom (Great Britain + Northern Ireland). Ireland is a separate IE feature and is not included.

## License short

- Natural Earth geometries: public domain.
- Flag SVGs: public-domain flag designs, via Wikimedia Commons / country-flags.
