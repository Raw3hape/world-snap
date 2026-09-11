# Geography data

Offline world pack for World Snap.

Re-run:

```
node scripts/prepare-data.mjs
```

Requires Node 18+ (global `fetch`). Writes:

- `public/data/pack-world.json`
- `public/flags/{iso}.svg` (lowercase ISO A2)

This run: **204 countries**, **204 flags**, **2 skipped** (no ISO), **0 flags missing**.

## Sources

### Countries — Natural Earth admin 0

110m (every feature with a real ISO A2):

https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson

50m (tiny sovereign states missing at 110m):

https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_0_countries.geojson

Used this run:

- 110m: https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson
- 50m: https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_0_countries.geojson

Upstream: [Natural Earth](https://www.naturalearthdata.com/). License: **public domain** ([terms of use](https://www.naturalearthdata.com/about/terms-of-use/)).

ISO: `ISO_A2`, else `ISO_A2_EH`, else `WB_A2`. Must be two letters. `-99` is skipped (no flag path). United Kingdom is `GB`, Kosovo is `XK`.

Coordinates stay as published. No extra simplification. Mainland and nearby islands that belong to the country stay (Sicily, Sardinia, Tasmania, Hainan, Sakhalin, Crete, French Guiana, Cabinda, Kaliningrad).

### Russian names

1. Natural Earth `NAME_RU`
2. [umpirsky/country-list](https://github.com/umpirsky/country-list) `ru_RU` (ISO A2 → Russian)
3. `NAME_EN`

Used this run: https://raw.githubusercontent.com/umpirsky/country-list/master/data/ru_RU/country.json

### Flags — country-flags (Wikimedia SVGs)

https://cdn.jsdelivr.net/gh/hampusborgos/country-flags@main/svg/{code}.svg

Repo: [hampusborgos/country-flags](https://github.com/hampusborgos/country-flags) (collection MIT). Drawings from Wikimedia Commons. Stored as `public/flags/{code}.svg`.

A missing flag does **not** drop the country.

## Pack `world` (204)

`id`: `world`. `titleRu`: Мир. `titleEn`: World.

Sorted by continent (Europe → Asia → Africa → North America → South America → Oceania → Antarctica), then `nameRu`.

| Continent | Count |
| --- | ---: |
| Europe | 45 |
| Asia | 49 |
| Africa | 55 |
| North America | 25 |
| South America | 13 |
| Oceania | 15 |
| Antarctica | 2 |

### Europe (45)

AT AL AD BY BE BG BA VA GB HU DE GR DK IE IS ES IT LV LT LI LU MT MD MC NL NO PL PT XK RU RO SM MK RS SK SI UA FI FR HR ME CZ CH SE EE

### Asia (49)

AZ AM AF BD BH BN BT TL VN GE IL IN ID JO IQ IR YE KZ KH QA CY KG CN KP KW LA LB MY MV MN MM NP AE OM PK PS KR SA SG SY TJ TH TW TM TR UZ PH LK JP

### Africa (55)

DZ AO BJ BW BF BI GA GM GH GN GW CD DJ EG ZM EH ZW CV CM KE KM CI LS LR LY MU MR MG MW ML MA MZ NA NE NG CG RW ST SC SN SO SD SL TZ TG TN UG CF TD GQ ER SZ ET ZA SS

### North America (25)

AG BS BB BZ GT HN GD GL DM DO CA CR CU MX NI PA PR HT SV VC KN LC US TT JM

### South America (13)

AR BO BR VE GY CO PY PE SR UY FK CL EC

### Oceania (15)

AU VU KI MH FM NR NZ NC PW PG WS SB TO TV FJ

### Antarctica (2)

AQ TF

Centroids are area-weighted in lon/lat, unwrapped around the largest ring so Fiji / Russia do not jump across the antimeridian. Degenerate area falls back to bbox center. BBox is unwrapped the same way (max lon may exceed 180).

Tiny distant overseas scraps (area &lt; 0.4% of the largest ring **and** more than 18° from already-kept land) are dropped. Distance is to the nearest vertex of kept land, not the main centroid — so a far-from-centroid island that still sits next to the mainland is kept. A scrap within 5° of another country is kept so the continent puzzle has no hole. Antarctica is never pruned.

Dropped this run:

- US polygon 1 (Hawaii) at [-155.5, 19.6]: area 0.11% of largest ring, 33.5° from main land
- US polygon 2 (Hawaii) at [-156.4, 20.8]: area 0.02% of largest ring, 33.3° from main land
- US polygon 3 (Hawaii) at [-157.0, 21.1]: area 0.01% of largest ring, 33.6° from main land
- US polygon 4 (Hawaii) at [-158.0, 21.5]: area 0.02% of largest ring, 34.1° from main land
- US polygon 5 (Hawaii) at [-159.5, 22.1]: area 0.01% of largest ring, 34.8° from main land

## Tiny states from 50m (29)

Sovereign countries that exist at 50m but not at 110m. Geometry is the 50m feature, unpruned.

- AD Andorra / Андорра (Europe)
- AG Antigua and Barbuda / Антигуа и Барбуда (North America)
- BB Barbados / Барбадос (North America)
- BH Bahrain / Бахрейн (Asia)
- CV Cape Verde / Кабо-Верде (Africa)
- DM Dominica / Доминика (North America)
- FM Federated States of Micronesia / Микронезия (Oceania)
- GD Grenada / Гренада (North America)
- KI Kiribati / Кирибати (Oceania)
- KM Comoros / Коморы (Africa)
- KN Saint Kitts and Nevis / Сент-Китс и Невис (North America)
- LC Saint Lucia / Сент-Люсия (North America)
- LI Liechtenstein / Лихтенштейн (Europe)
- MC Monaco / Монако (Europe)
- MH Marshall Islands / Маршалловы Острова (Oceania)
- MT Malta / Мальта (Europe)
- MU Mauritius / Маврикий (Africa)
- MV Maldives / Мальдивы (Asia)
- NR Nauru / Науру (Oceania)
- PW Palau / Палау (Oceania)
- SC Seychelles / Сейшельские Острова (Africa)
- SG Singapore / Сингапур (Asia)
- SM San Marino / Сан-Марино (Europe)
- ST São Tomé and Príncipe / Сан-Томе и Принсипи (Africa)
- TO Tonga / Тонга (Oceania)
- TV Tuvalu / Тувалу (Oceania)
- VA Vatican City / Ватикан (Europe)
- VC Saint Vincent and the Grenadines / Сент-Винсент и Гренадины (North America)
- WS Samoa / Самоа (Oceania)

## Skipped (no ISO A2)

- N. Cyprus (ISO_A2=-99, ADM0_A3=CYN) — no ISO A2, skipped
- Somaliland (ISO_A2=-99, ADM0_A3=SOL) — no ISO A2, skipped

## Flags missing

Countries still in the pack, no SVG written:

- None. Every packed country has `public/flags/{iso}.svg`.

## Special cases

- US: CONUS + Alaska + Aleutians kept (5 polygons). Hawaii dropped as tiny distant overseas scraps.
- RU: Kaliningrad, Crimea (as drawn by Natural Earth), Sakhalin and Arctic islands are kept.
- FR: 110m feature is metropolitan France + Corsica + French Guiana. French Guiana is kept (South America hole otherwise).
- AU: Tasmania is present in the 110m feature and was kept.
- GB: Natural Earth feature is United Kingdom (Great Britain + Northern Ireland). Ireland is IE.
- XK: Kosovo uses ISO_A2_EH (ISO_A2 is -99).
- Territories / indeterminate units kept because they have ISO A2: AQ Antarctica, EH Western Sahara, FK Falkland Islands, GL Greenland, NC New Caledonia, PR Puerto Rico, PS Palestine, TF French Southern and Antarctic Lands.

## License short

- Natural Earth geometries: public domain.
- Flag SVGs: public-domain flag designs, via Wikimedia Commons / country-flags.
