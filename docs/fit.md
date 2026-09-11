# Fit — one globe, one source

Every country lives on one sphere. Neighbors share a radius. Tray silhouettes use the same projector as the slot.

## Radii (`R = 1`)

| Mesh | Radius | Role |
|---|---|---|
| Ocean | `0.998` | Hit target. Inset so coasts read and land does not z-fight. Owned by Experience. |
| Land (all slots) | `1` | Unplaced and painted. Same sphere, so borders meet. |
| Spin hull | unchanged | Invisible. Not this owner. |

Land vertices: `latLonToVector3(lat, lon, radius)` with the radius passed in. `CountrySlot` uses `R = 1`. Vertex length `1 ± 1e-5`. Mesh scale stays `1` (no `1.004` bloom). `LAND_R` is unused here.

**Unplaced land is visible** (`landMat` + `polygonOffset`). Hiding a slot punches an ocean hole between neighbors. Ghost = same mesh + tint, scale `1`. Soak = flag/opacity only.

Land materials (unplaced, painted, ghost):

```
polygonOffset: true
polygonOffsetFactor: -1
polygonOffsetUnits: -1
```

## One source

`countryRings(country)`: `makeProjector(centroid)` + wound rings `{lon,lat,x,y}`. Globe earcut and tray SVG consume this. Do not project twice.

- Globe: earcut on `x,y`, positions from `lat,lon` at the given radius.
- Tray / `pieceFit`: `x,y` only.

Shipped: **204 / 204** packed countries build a globe mesh (position count > 3, no NaN), including 50m extras `VA MC SM AD SG MT`.

## Tessellation

Same radius, shared rings. Neighbors meet on the sphere; seas do not.

| Pair | min vertex distance | Notes |
|---|---|---|
| FR–DE | `0` | Shared border vertices. |
| US–CA | `0` | Shared border vertices. |
| AU–NZ | `0.235` | Tasman Sea. Must stay apart (`> 0.04`). |

## `pieceFit(country, cohort, maxPx = 52)`

`cohort` = pack countries with the same `continent` (even on tab `all`). Include placed so sizes stay put after a snap.

- True aspect: keep projected `w/h`. Never squash.
- `longest = max(w,h)`, `cohortMax = max(longest in cohort)`.
- `px = clamp(maxPx * longest / cohortMax, 20, maxPx)`.
- `scale = px / longest`.

Button CSS min 44×44 lives in `index.css` (not this owner). SVG itself uses `px`.

Europe cohort (shipped):

| Country | `px` | longest |
|---|---|---|
| Russia | `52` | `1.247` (cohort max) |
| France | `44.61` | `1.070` |
| Italy | `20` | `0.182` (clamped) |
| Vatican | `20` | `0.00015` (clamped) |

Italy is smaller than Russia in the tray. They are not both 52 px.

## Tray SVG

`silhouetteSVG(country, cohort)` uses `pieceFit` — not `maxSize / longest` per country.

```
x = (p.x - minX) * scale + pad
y = (maxY - p.y) * scale + pad     // north up (d3 y is south)
pad = 2
```

`M/L … Z` per ring (holes as extra subpaths, `fill-rule: evenodd`). `viewBox = 0 0 (w*s+2pad) (h*s+2pad)` so the path aspect matches the projection. Inner aspect equals projected bounds aspect.

`Tray` passes the continent cohort (including placed). `DragGhost` uses the same cohort at `maxPx = 72`.

Hidden when `phase === 'title'`. Dragged piece stays `hidden`. Buttons keep `data-iso={id}`. Tabs + search stay.

## Snap (leave the rule)

Ray vs **ocean**. `globe.worldToLocal(hit)` → `vector3ToLatLon` → `evaluateSnap` / `geoContains`. Lat/lon is direction-only, so ocean `0.998` does not shift the test.

## Do not

Second projector. Per-piece normalize to 52 px. Slot scale blooms. Hiding unplaced land. Country strokes. Editing snap.ts / tokens / pack JSON.
