# World Snap — visual spec

Cartographer’s night atelier. One warm lamp, one porcelain globe, bone-china pieces on walnut. Russian UI.

This file is the look. Do not invent a second palette, a second type pair, or a second signature moment.

**Signature:** the flag soaks into the country like wet pigment into unglazed porcelain. Not a sticker. Not a flash.

**Type stays:** Cormorant Garamond (display) + Outfit (UI). Cormorant has ink-quill terminals without Playfair’s fashion bounce. Outfit is a geometric grotesque that sits on porcelain without becoming Inter or Space Grotesk. A cartographic swap would drift toward broadsheet. Don’t.

---

## 1. Color tokens

CSS and three.js share these eight. No other named brand colors.

| Token | Hex | Use |
|---|---|---|
| `--porcelain` | `#E6E2DA` | Unglazed bone china. Globe land, raw pieces, HUD type. Cooler than ivory so it never reads cream-editorial. |
| `--ink` | `#0B1220` | Room, clearcoat, fog, HUD ground. Prussian night, not pure black. |
| `--brass` | `#C4A15C` | Lamp joints, focus ring, rare metal catch. Aged, not jewellery gold. |
| `--lamp` | `#FFC89A` | 2700K tungsten. Light `color`, shade `emissive`. Never a fill for meshes. |
| `--walnut` | `#1C1410` | Table, cradle. Oiled wood in shadow. |
| `--ocean-ghost` | `#C5CFD4` | Faint sea wash on the globe. Mix ~12% over porcelain, never a painted ocean. |
| `--hint-glow` | `#A9C7D4` | Target-country rim when a piece is held. Moonlight on damp bisque. Cool on purpose, against the lamp. |
| `--miss` | `#8A4E56` | Pigment that beaded and failed. Rim flash + HUD line. Not traffic-light red. |

Derived, not tokens: porcelain-wet `#D4CFC6` (soak darkening), brass-dim `#8A6A32`, lamp inner shade `#2A2420`, moon rim light `#8AA4B8`. Mix in code. Do not add them to the palette.

Contrast: porcelain on ink is ~12:1. Hint-glow is a 3D cue, never the only one.

---

## 2. Globe — MeshPhysicalMaterial

World unit: globe radius `1`. One unit ≈ 15 cm. Renderer: `ACESFilmicToneMapping`, exposure `0.92`, `outputColorSpace = SRGBColorSpace`.

The globe is a sphere of country meshes (land) plus an ocean shell. No baked political poster.

### Unpainted (bisque)

Land countries, ocean shell, and raw table pieces share this recipe. Ocean only tints `color`.

```
color:              #E6E2DA          // ocean: mix porcelain 88% + ocean-ghost 12%
roughness:          0.62             // ocean: 0.68
metalness:          0
clearcoat:          0.18
clearcoatRoughness: 0.55
sheen:              1.0
sheenColor:         #EDE8E0
sheenRoughness:     0.75
envMapIntensity:    0.40
ior:                1.5
specularIntensity:  0.35
specularColor:      #F5F0E8
transmission:       0
iridescence:        0
emissive:           #000000
```

Sheen is the bisque. Without it the globe is plastic. Clearcoat stays low: unglazed, not a showroom glaze.

Coast: a shallow engraved groove in the ocean-shell normal or a baked AO map, 2k, contrast tiny. No drawn hairline, no graticule, no country stroke.

### Painted (pigment soaked)

Assigned to a country mesh after a successful snap. `map` is the flag texture with the UV strategy in §3.

```
color:              #FFFFFF          // let the flag speak
map:                flagTexture      // color space sRGB, anisotropy 8
roughness:          0.30
metalness:          0
clearcoat:          0.45
clearcoatRoughness: 0.28
sheen:              0.35
sheenColor:         #F2EDE6
sheenRoughness:     0.55
envMapIntensity:    0.70
ior:                1.5
specularIntensity:  0.50
specularColor:      #F5F0E8
```

During the soak only, mix unpainted → painted with the wet-edge treatment in §7. Do not swap materials in one frame.

---

## 3. Flags cover the silhouette

The country **is** the mesh. The flag is albedo. If a rectangle is ever visible, the UV failed.

### UV strategy (cover + clip)

For each country mesh:

1. Centroid on the sphere. Tangent frame: `normal`, `east`, `north` (world-up projected onto the tangent plane).
2. Project vertices into that plane. Take the AABB.
3. Fit the flag with CSS-style **cover**: preserve flag aspect, scale until the AABB is filled, center on the centroid. Extra flag is cropped by the mesh. `wrapS` / `wrapT` = `ClampToEdge`.
4. Islands and exclaves share the mainland’s tangent frame and scale, so the flag continues across water. Do not stamp each island.

Result: France is a cropped tricolor filling France. Chile is a cropped star-and-bar filling Chile. Nothing floats.

### Distortion limits

Measure triangle stretch: world-area / uv-area. `anisotropy = max/min`.

| Fail | Switch |
|---|---|
| Anisotropy > 3, or country solid angle > ~0.4 sr (RU, US, CA, CN, BR, AU) | Rebuild UVs in a local azimuthal (tangent) projection, then the same cover fit. |
| Long-thin countries (CL, NO, VN, GW) **and** the flag is a 2–3 band tricolor (detect: >70% of rows or columns are flat stripes) | **Band mode:** principal axis of the silhouette becomes the flag’s stripe axis. Still clipped to the mesh. |
| Complex flags on long-thin countries (US on a weird strip, etc.) | Keep cover-crop, anchor the flag’s visual center (canton / emblem) on the centroid, not the AABB center. |

Never: spherical lat/long UVs for a single country (poles smear). Never: one global flag atlas with a scissor rect in screen space.

### Fallback if UV fails

Detect: NaN UVs, fewer than 3 unique UVs, inverted winding, or >40% of area with UVs outside 0–1 after cover.

1. **Field:** dominant flag color (k-means, k=1) as unmapped albedo. Still the country mesh. This is on-brand — pigment, not a picture.
2. **Emblem (optional):** if the flag has a center or canton device, decal it at the centroid with a soft circular mask, radius `0.35 * min(aabb)`. Clip to the mesh.
3. Never a billboard, never a pole, never an HTML `<img>` over the globe, never emoji.

Flag files are real flags (sRGB). No generated stand-ins except the field fallback.

---

## 4. Pieces

Thin bone-china / vellum silhouettes on the walnut table. Same country contours as the globe, flattened.

| Property | Value |
|---|---|
| Thickness | `0.012` (≈ 1.8 mm) |
| Bevel | `0.15 × thickness`, smooth. Rim slightly warmer `#D4C8B8`, not a dark outline. |
| Plan size | Flattened country × `1.5`, minimum screen pick `48×48` px |
| Raw material | Unpainted globe recipe + `transmission: 0.10`, `thickness: 0.4`, `attenuationColor: #E8DCC8`. If transmission is too expensive: skip it, keep sheen, add a faint back-face `#EDE8E0`. |
| Painted (collection only) | Painted globe recipe, no transmission. |
| Rest pose | On table, normal `+Y`, yaw scattered `±8°`. Not a grid, not a circle. |
| Shadow | `ContactShadows` on the table: `opacity 0.45`, `blur 2.2`, `color #1A100C`, `far 0.6`. Tight. No huge blobs. |
| Hover / lift | Y `+0.08`, tilt toward camera `5°`, roughness `0.62 → 0.48`, 180 ms. Cursor `grab`. |
| Selected / drag | Y `+0.14`, follows pointer, contact shadow darkens to `0.65`, yaw eases toward drag velocity (damped). Cursor `grabbing`. |

Pieces never get a drop-shadow sprite, a white stroke, or a glass material.

---

## 5. Table, lamp, studio

The room is a void the lamp cannot fill. Model only what the camera can love: table, cradle, globe, lamp, pieces.

### Table

Ellipse in XZ, major axis toward camera. Radius ~`2.4 × 1.8`. Y of top face `-1.22` (globe sits just above).

```
color:              #1C1410
roughness:          0.55
metalness:          0.04
clearcoat:          0.30
clearcoatRoughness: 0.40
envMapIntensity:    0.25
```

Wood grain only if the texture is almost black; contrast < 8%. No orange stock PBR. No legs in frame unless the camera demands them — then stump legs, same material.

**Cradle:** three-point walnut rest under the globe, same material. No brass meridian ring (stock globe). No axis pin.

### Lamp (practical)

Left-rear of globe, in frame. One articulated silhouette: brass joints (`metalness 0.85`, `roughness 0.35`, `color #C4A15C`) + dark linen shade (`color #2A2420`, inner `emissive #FFC89A`, `emissiveIntensity 1.1`). Not ornate. Not a glowing orb.

### Lights

| Light | Spec |
|---|---|
| Key | `spotLight` from the shade, `color #FFC89A`, `intensity 12`, `angle 0.42`, `penumbra 0.7`, `distance 7`, `decay 2`, `castShadow`, map `2048`, `bias -0.0002` |
| Shade fill | `pointLight` inside the shade, `#FFC89A`, intensity `1.8`, distance `3` |
| Moon rim | `directionalLight` opposite the lamp, `#8AA4B8`, intensity `0.18` |
| Bounce | `hemisphereLight` sky `#1A2838`, ground `#1C1410`, intensity `0.22` |

No white ambient. No second warm fill.

### Environment, fog, background

```
<color attach="background" args={['#0B1220']} />
<fogExp2 attach="fog" args={['#0B1220', 0.045]} />
<Environment preset="warehouse" background={false} environmentIntensity={0.28} />
```

`warehouse` is large, cool, and empty — porcelain reads, the lamp does the warmth. If `environmentIntensity` is missing in the drei version, set `scene.environmentIntensity = 0.28` on created.

Do not use `studio` (product shot), `sunset` (terracotta), `night` as background, or an HDR visible in the clearcoat.

Camera: `fov 32`, position about `[1.65, 0.95, 2.35]`, target globe origin. Initial globe heading ~`20°E, 25°N` (Europe / North Africa as the working view). `dpr [1, 2]`. Soft shadows.

---

## 6. HUD / UI

HTML overlay, Russian, transparent canvas. No cards, no blur panels, no mix-blend tricks.

| Role | Face | Desktop | Mobile |
|---|---|---|---|
| Wordmark | Cormorant Garamond 500 italic | 30px | 22px |
| Hint, miss, complete | Outfit 400 | 14px / 22 lh | 13px |
| Collection count | Outfit 500, tabular nums | 13px | 12px |

Color: porcelain. Hint at 70% opacity. Miss uses `--miss`. Focus ring: `2px solid #C4A15C`, offset `4px`. No browser blue.

Copy (lock these, don’t get clever):

- Hint: `Положи страну на её место`
- Miss: `Не та широта`
- Complete: `Мир собран`
- Count: `12 из 197`
- Wordmark: `World Snap` (Latin, Cormorant). The object is named in Latin; the workshop speaks Russian.

The 3D table **is** the tray. Do not build a second HTML drawer of pieces.

### Desktop

```
┌─────────────────────────────────────────────────────────────┐
│  World Snap                                      12 из 197  │
│  Положи страну на её место                                  │
│                                                             │
│                 [ lamp ]                                    │
│                    ╭─────────╮                              │
│                    │  globe  │                              │
│                    ╰─────────╯                              │
│              ── walnut table ──                             │
│         ·  ·   china pieces   ·   ·                         │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

Wordmark + hint top-left. Count top-right. Dead margin `24px`. Canvas is the rest. No bottom bar.

### Mobile

```
┌─────────────────────┐
│ World Snap    12/197│
│ Положи страну       │
│ на её место         │
│                     │
│      ╭─────╮        │
│      │globe│        │
│      ╰─────╯        │
│   ── table ──       │
│  · pieces ·         │
│                     │
└─────────────────────┘
```

Same overlay, margins `16px`. Camera pulls back slightly (`z +0.35`) so pieces remain hittable. Count may shorten to `12/197` under `400px`. Portrait only as first ship; landscape is the desktop wire with tighter margins.

Hint line is an `aria-live="polite"` region. Title is the document title too: `World Snap`.

---

## 7. Motion

All easings are the common names (`easeOutCubic`, not cubic-bezier essays). Clock is milliseconds.

| Motion | Duration | Easing | What |
|---|---|---|---|
| Idle globe drift | 180 s / rev | linear Y | Yaw only. Pitch sine `±0.4°`, period 12 s. Stops while dragging. |
| Piece hover lift | 180 | easeOutCubic | See §4. |
| Piece put-down | 200 | easeOutCubic | Reverse of lift. |
| Magnet | 220 | easeInOutCubic | When angular error to target `< 12°`, piece eases toward the slot. Hands still own it until snap. |
| **Snap bloom** | **900** | see below | The product. |
| Miss spring | 280 | easeOutBack | Two yaw shakes `±6°`, rim flashes `--miss` 180 ms, piece stays in hand. |
| Completion camera | 1400 | easeInOutQuart | Dolly back and up, reveal the whole painted globe under the lamp. Then a slow orbit `8°` over 8 s, linear. |

### Snap bloom (lock this sequence)

Impact point = where the piece touched the country.

| t | Event |
|---|---|
| 0–80 | Magnet seats. Country scale `1.00 → 1.016` (easeOutCubic). |
| 80–520 | Soak front grows from impact. Shader mask: radial + low-frequency noise, amplitude `0.08`. Behind the front: painted flag. On the front (width `0.04` UV): multiply color `0.82`, roughness `0.20` (wet edge). Unpainted ahead of the front. Piece on the table: scale `1 → 0.4`, opacity `1 → 0`, 350 ms easeInCubic — the shard becomes pigment. |
| 520–900 | Wetness dries: roughness `0.20 → 0.30`, clearcoat `0.60 → 0.45`, scale `1.016 → 1.00`. Flag at full opacity. |

No flash to white. No particle burst. No screen shake.

### Miss

Spring the piece, miss-color the rim only, HUD swaps to `Не та широта` for 1.6 s, then back to the hint. The globe country does not redden.

---

## 8. What not to add

Cut these even if they feel “atelier”:

- Stars, atmosphere, clouds, day/night, water animation
- Graticule, gold meridians, compass rose, sextant, stacked maps, ink blots, paper grain overlays
- Flagpoles, floating flag rectangles, emoji flags
- Cream parchment cards, terracotta pins, wax seals, serif hairline frames
- Acid-green correct state, red/green traffic lights, confetti, sparkles, lens flare
- Bookshelves, window HDR, ornate lamp, globe meridian ring
- Orbit-control gizmo, axis helper, grid
- Labels on countries (a hover name in the hint line is enough)
- A second UI tray of pieces
- Mix-blend HUD, glassmorphism, noise overlays on the page

If it does not serve the lamp, the porcelain, or the soak, it is out.

---

## 9. Accessibility

- **Contrast:** HUD type is porcelain on ink. Do not fade hint below 70% (`#E6E2DA` at 0.7 on `#0B1220` still > 7:1 for 14px).
- **Not color alone:** hint-glow is paired with a 1.04 scale pulse on the target (120 ms). Miss is rim + copy + spring.
- **Reduced motion** (`prefers-reduced-motion: reduce`): idle drift off; lift/put-down 1 frame; snap bloom becomes a 200 ms opacity+roughness crossfade, no scale, no soak noise; miss is a 150 ms rim without shake; completion camera does not move.
- **Focus:** Tab cycles pieces (then collection is not focusable). Focus ring brass, as above. Enter/space lifts; arrows nudge a held piece; Esc puts down.
- **Hits:** 44 px minimum, including the inflated pick hull on small countries.
- **Live region:** hint / miss / complete. Country names in Russian on snap (`Франция легла на место` is too much — keep the three locked lines, put the name in `aria-label` on the piece).
- **Tone map:** never push exposure so porcelain clips; low-vision users still need the globe edge against ink (ocean-ghost exists so the limb reads).

---

## Units cheat sheet

```
globe radius          1.00
piece thickness       0.012
piece hover Y         +0.08
piece selected Y      +0.14
table top Y           -1.22
fog density           0.045
env intensity         0.28
exposure              0.92
fov                   32
```
