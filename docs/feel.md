# World Snap — game feel

Numbers and curves for juice. Implementers should not invent timings, distances, or envelopes.

Material metaphor: a ceramic country tile on a wooden table, seated onto a museum globe. Quiet, dense, slightly expensive. Not a cartoon puzzle. Not a phone-game bounce.

If `prefers-reduced-motion: reduce`, skip every animation in this file and use [§9](#9-reduced-motion). Magnet distances still apply: they are rules, not decoration.

---

## 0. Units and space

| Symbol | Meaning |
|---|---|
| `R` | Globe radius. Treat as `1.0` world unit. Scale the whole scene; do not retune feel per pixel size. |
| `°` | Geodesic angle on the sphere, `acos(clamp(dot(a, b), -1, 1)) * 180/π`. |
| `r` | Country angular radius: geodesic bounding radius of the playable polygon (archipelagos = combined group). |
| `r_eff` | `clamp(r, 2.4°, 16°)`. Stops Luxembourg from being unhittable and Russia from snapping off Africa. |
| `δ` | Geodesic degrees between piece centroid and true country centroid. |
| `ψ` | Yaw error in the local tangent plane, degrees. `0` = geographic north aligned. |
| `t` | Normalized magnet closeness, `0` at `d_start`, `1` at the target. |
| `p` | Pack completion, `placed / total`, `[0, 1]`. |
| `τ` | Exponential smoothing time constant. `alpha = 1 - exp(-dt / τ)`. |
| `ω, ζ` | Spring frequency (Hz) and damping ratio. Critically damped ≈ `0.85–1.0`. |

Centroids are spherical means, not average lon/lat. Antimeridian countries (Russia, Fiji, USA) must use the 3D unit-vector mean, then normalize.

Piece local axes: `+Y` = geographic north on the tile, `+Z` = outward (globe normal when hovering).

Pointer ray: mouse from camera through cursor; touch from camera through contact, then apply [touch lift offset](#21-pointer-offset).

---

## 1. Snap magnet

Two zones while the piece is held over the globe and the pointer ray hits the sphere.

| Zone | What it does |
|---|---|
| Suggest (`δ < d_start`) | Soft pull toward the true pose. Player can still drag out. |
| Seat (`δ < d_lock` and `ψ < ψ_lock`) | Firm pull. Pointer-up commits the snap. |

Magnet is **assist, not autoplay**. Snap commits on pointer-up inside the seat zone. Easy may auto-commit if held in seat for `lock_dwell`.

### 1.1 Distances (degrees)

All distances scale with `r_eff`. Hint level picks the coefficients. Intra-pack fade slightly tightens them ([§1.5](#15-hint-fade-over-the-pack)).

```
d_start = k_start * r_eff
d_lock  = k_lock  * r_eff
ψ_lock  = yaw_lock          // not scaled; orientation is a compass, not a size
```

Then clamp so tiny/huge countries stay in a human range:

```
d_start = clamp(d_start, d_start_min, d_start_max)
d_lock  = clamp(d_lock,  d_lock_min,  d_lock_max)
```

| | Easy | Normal | Strict |
|---|---:|---:|---:|
| `k_start` | 1.85 | 1.15 | 0.72 |
| `k_lock` | 0.58 | 0.34 | 0.18 |
| `d_start_min` | 9.0° | 5.0° | 2.6° |
| `d_start_max` | 22° | 14° | 8.0° |
| `d_lock_min` | 2.6° | 1.5° | 0.75° |
| `d_lock_max` | 7.0° | 4.2° | 2.2° |
| `yaw_lock` | 18° | 11° | 6° |
| `lock_dwell` | 140 ms | off | off |

Worked examples, Normal, before pack fade:

| Country | `r` | `r_eff` | `d_start` | `d_lock` |
|---|---:|---:|---:|---:|
| Luxembourg | ~0.4° | 2.4° | 5.0° (min) | 1.5° (min) |
| Poland | ~4.5° | 4.5° | 5.2° | 1.5° (min) |
| Türkiye | ~8° | 8° | 9.2° | 2.7° |
| Australia | ~18° | 16° | 14° (max) | 4.2° (max) |
| Russia | ~40° | 16° | 14° (max) | 4.2° (max) |

A piece never magnets toward the wrong country. If two seat zones overlap (rare, microstates), pick the smaller `δ / d_lock`.

### 1.2 Strength curve

While held, `δ < d_start`:

```
u = 1 - (δ / d_start)                         // 0 at rim, 1 at target
t = u * u * (3 - 2 * u)                       // smoothstep
pull = t ^ k_curve                            // k_curve below
```

Great-circle lerp of the piece centroid toward the true centroid, and slerp of yaw toward geographic north:

```
pos  = slerp_arc(pos,  target,  1 - exp(-dt / τ_pos))
yaw  = lerp_angle(yaw, 0,       1 - exp(-dt / τ_yaw))
```

`τ` shortens as the piece seats (stronger magnet feels like a tighter spring):

```
τ_pos = lerp(τ_far, τ_near, pull)
τ_yaw = lerp(τ_yaw_far, τ_yaw_near, pull)
```

| | Easy | Normal | Strict |
|---|---:|---:|---:|
| `k_curve` | 1.15 | 1.45 | 1.80 |
| `τ_far` | 90 ms | 120 ms | 160 ms |
| `τ_near` | 28 ms | 38 ms | 55 ms |
| `τ_yaw_far` | 110 ms | 140 ms | 180 ms |
| `τ_yaw_near` | 40 ms | 55 ms | 80 ms |

`k_curve > 1` keeps the outer ring polite. The last third of the zone does most of the seating.

Do not add a second physics force. This lerp is the magnet.

### 1.3 Enter / leave

| Event | Visual | Audio | Haptic |
|---|---|---|---|
| Cross into suggest | Piece gains 4% scale, 80 ms easeOutCubic. Optional 1 px rim light, opacity `0.18 * pull`. | Magnet hum fades in ([§5.2](#52-magnet-hum)) | `[4]` once |
| Leave suggest | Scale back to hover scale, 120 ms. Hum fades out 40 ms. | — | none |
| Enter seat | Rim light opacity 0.28. No extra bounce. | Hum at full for this `t` | none extra |
| Pointer-up in seat | Snap animation ([§3](#3-snap-animation)) | ceramic click | snap pattern |
| Pointer-up outside seat | Miss ([§4](#4-miss)) | thud | miss pattern |

Hysteresis: leaving suggest requires `δ > d_start + 1.2°` so the rim does not flicker.

### 1.4 Commit rules

On pointer-up, snap if **all** are true:

1. Piece state is `hover` or `magnet` (ray hit the globe this frame or last 50 ms).
2. `δ ≤ d_lock`.
3. `ψ ≤ yaw_lock`.
4. The piece is the one being dragged (no double-commit).

Easy only: if those are true for `lock_dwell` continuous milliseconds while held, commit without waiting for pointer-up.

If the ray leaves the globe during a hold, magnet dies in 80 ms (`τ` doubles every 20 ms until pull = 0).

### 1.5 Hint fade over the pack

Hints are a level preset plus a fade as the pack fills. Fade affects **visual ghosts and magnet size**, never the ceramic click.

```
fade = pow(p, fade_exp)                       // 0 at first piece, 1 at last
k_start_now = lerp(k_start, k_start * mag_end, fade)
k_lock_now  = lerp(k_lock,  k_lock  * mag_end, fade)
ghost = ghost0 * pow(1 - p, ghost_exp)
```

| | Easy | Normal | Strict |
|---|---:|---:|---:|
| `ghost0` (opacity) | 0.40 | 0.26 | 0.00 |
| `ghost_exp` | 0.45 | 1.20 | — |
| `fade_exp` | 0.80 | 1.00 | 1.00 |
| `mag_end` | 0.92 | 0.80 | 0.70 |
| Mercy ghost after 2 misses on the same piece | opacity 0.22 for 700 ms | opacity 0.14 for 500 ms | none |

Ghost is a 1.25 px country outline plus a 6% fill of the flag’s first color, drawn on the globe, under the piece. It never pulses, never dashes.

At `p = 1` the last piece on Easy still has a readable ghost (~0.22). On Normal the ghost is ~0.04 and can be skipped. Strict never draws one.

---

## 2. Pointer follow

States: `idle` → `pickup` → `drag` (over table / empty space) → `hover` (ray hits globe) → `magnet` → `snap` or `miss`.

### 2.1 Pickup

Duration `90 ms`, easeOutCubic.

| Channel | Idle | Picked |
|---|---:|---:|
| Height above table | `0` | `0.070 R` |
| Scale | `1.00` | `1.035` |
| Shadow opacity | `0.22` | `0.10` |
| Shadow blur | `0.012 R` | `0.028 R` |
| Shadow offset | `0.006 R` | `0.018 R` toward camera-down |

Pickup is interruptible: if the pointer is released before 90 ms, play pickup in reverse at 1.4× speed and do not count a miss.

### 2.2 Pointer offset

The piece does not sit under the finger.

| Input | Aim point vs contact |
|---|---|
| Mouse | Piece centroid `8 px` above the cursor (screen space). |
| Touch | Piece centroid `44 px` above the contact, clamped to `0.12 R` world. |

Offset eases in over the pickup 90 ms so the tile does not jump.

### 2.3 Lag (mass)

Do not parent the piece to the pointer. Follow with a damped spring.

| | Mouse | Touch |
|---|---:|---:|
| `ω` (Hz) | 17 | 13 |
| `ζ` | 0.78 | 0.84 |
| Max catch-up speed | `6.5 R/s` | `5.0 R/s` |
| Fallback `τ` if no spring | `55 ms` | `72 ms` |

Semi-implicit Euler:

```
accel = ω² * (target - pos) - 2 ζ ω * vel
vel  += accel * dt
pos  += vel * dt
```

Clamp `vel` to max catch-up so a fast swipe does not slingshot around the globe.

### 2.4 Rotation onto the globe

When the pointer ray hits the sphere, the tile leaves table-flat and lies on the tangent plane.

| | Enter hover | Leave hover |
|---|---:|---:|
| Duration | `120 ms` | `160 ms` |
| Curve | easeOutCubic | easeInOutCubic |
| `+Z` | slerp to globe normal at the hit point | slerp to table `+Z` |
| Yaw | slerp to geographic north at the hit point | slerp to table north (screen-up) |
| Height | `0.045 R` above the surface (clearance) | back to `0.070 R` table lift |

During magnet, the alignment target blends from hit-point → true country frame by `pull`:

```
normal_target = slerp(hit_normal, country_normal, pull)
yaw_target    = lerp_angle(geo_north_at_hit, 0, pull)
```

Clearance shrinks as it seats: `height = lerp(0.045 R, 0.008 R, pull)`.

The player does not twist the piece. Orientation is geographic. The puzzle is *where*, not *which way is Italy*.

### 2.5 Globe rotation while dragging

A drag that starts on empty globe (not on a piece) orbits the camera/globe as usual.

A drag that starts on a piece never orbits. If the piece is dragged off the globe onto the table, globe rotation stays frozen until pointer-up.

Flick inertia on the globe (no piece): `ω` decays with `τ = 740 ms`. Stop dead on next pointer-down.

---

## 3. Snap animation

Triggered at commit. The piece is no longer parented to the pointer.

Total `200 ms`. Do not wait on bloom or audio; they overlay.

### 3.1 Pose settle

From current magnet pose to the exact country frame.

| t (ms) | Pose |
|---|---|
| 0–160 | Great-circle + yaw slerp, easeOutCubic. |
| 0–200 | Height `current → 0` (flush with globe surface). |

No overshoot past the target pose. The scale punch below is the “click into the slot.”

### 3.2 Scale punch

Piece uniform scale, multiplied on top of any hover scale (which should already be back toward `1.0`).

| t (ms) | Scale | Curve |
|---|---:|---|
| 0 | 1.000 | — |
| 40 | 1.055 | easeOutQuad |
| 110 | 0.978 | easeInOutCubic |
| 200 | 1.000 | easeOutCubic |

Globe surface under that country only: displace along normal `0 → 0.010 R` at 50 ms, back to `0` at 180 ms, easeOutCubic. Neighbor countries do not move.

### 3.3 Globe micro-impulse

A nod, not a spin.

```
axis = normalize(cross(globe_up, country_centroid))
angle_peak = 0.32°
```

Spring: `ω = 11 Hz`, `ζ = 0.58`, settle by ~280 ms. Peak at ~45 ms. If another snap happens during the spring, add the new impulse (cap stacked amplitude at `0.55°`).

Reduced-motion: skip.

### 3.4 Flag pigment bloom

Starts at commit `+ 30 ms` (after the click is heard). Masked **strictly** to the country polygon. Ocean stays ocean. Softness lives *inside* the border.

Treat the country as wet paper. Three layers, all UV’d on the globe:

| Layer | Origin | Motion | Look |
|---|---|---|---|
| 1 Wet darken | centroid | geodesic radius `0 → 1.05 r` in 180 ms, easeOutCubic | multiply RGB by `0.92`, alpha 0.35 → 0 |
| 2 Pigment | centroid | geodesic radius `0 → 1.00 r` in 420 ms, easeOutCubic | flag colors, alpha 0 → 1 |
| 3 Capillary rim | polygon inward 0.35° | opacity 0 → 0.22 at 220–480 ms | multiply `0.86`, 1.2 px |

Pigment mapping:

- 2-color flags (Poland, Ukraine): half-and-half along the flag’s real division, projected onto the polygon.
- 3-color tricolors: three bands, same.
- Complex flags (USA, UK, Mexico): sample the flag texture, but *soak* it — see diffusion. Do not blit a crisp decal on frame 1.
- Start extra-saturated (`hsv.s * 1.12`, `hsv.v * 0.96`), ease to authored flag color over 500 ms.

Diffusion (the watercolor): 5 Jacobi relaxations of the pigment buffer, one per 16 ms, kernel confined by the polygon mask. Edge cells have zero outward flux. Result: pooled color, slightly darker valleys, no sparkles, no noise grain above 2%.

Centroid is the spherical mean. For extreme shapes (Chile, Norway, Indonesia) also spawn 2 secondary soaks at 30% and 70% along the major axis, delayed 40 ms and 70 ms, each at 0.55× the primary radius. This stops a long country from looking like a stain that never reaches the tips.

Last piece of a pack: bloom duration `× 1.15`, rim opacity `0.28`.

Bloom is done at 520 ms. After that the country is a static flag material plus a 3% gloss from the globe lighting.

### 3.5 After snap

- Piece collider dies. Cannot pick it up again.
- Table slot for that piece fades out in 180 ms (opacity 1 → 0, no motion).
- Next idle piece does **not** auto-lift.

---

## 4. Miss

Pointer-up while held, over globe or table, but commit rules fail. This must feel like a tile that didn’t catch, not a fail state.

### 4.1 Path

Cubic Bézier in world space, duration `320 ms`.

| Point | Position |
|---|---|
| P0 | pose at release |
| P1 | P0 + `up * 0.10 R` + `away_from_globe * 0.035 R` |
| P2 | slot + `up * 0.15 R` + `0.02 R` along (slot − P0) |
| P3 | table slot, table-flat, scale 1 |

`up` is world up, not globe normal. The tile hops off the sphere then drops into its tray.

Arc parameter: `s = easeInCubic(t)` so the last 80 ms is the drop. Rotation slerps to table-flat over the first `200 ms`, easeOutCubic.

### 4.2 Squash on land

At `t = 320 ms` (contact with table):

| t from land | Scale XYZ |
|---|---|
| 0 | `(1.08, 0.88, 1.08)` |
| 50 ms | `(1.03, 0.96, 1.03)` easeOutQuad |
| 140 ms | `(1.00, 1.00, 1.00)` easeOutBack overshoot `1.12` |

Shadow snaps tighter on land (opacity 0.10 → 0.22 in 60 ms).

### 4.3 Cooldown (so it is not punishing)

| Rule | Value |
|---|---|
| Ungrabbable window | `80 ms` from miss start (lets the hop begin). After that, pointer-down **cancels** the rest of the path and starts pickup from the current pose. |
| Full settle | 320 + 140 = `460 ms` if uninterrupted. |
| Miss sound rate limit | `180 ms` between thud onsets. Extra misses in that window are silent. |
| Haptic rate limit | same 180 ms. |
| No extra penalty | no camera shake, no greying, no score, no slot bounce, no “wrong” flash on the globe. |
| Mercy ghost | Easy / Normal only, after 2 consecutive misses of the **same** piece. See [§1.5](#15-hint-fade-over-the-pack). Consecutive counter resets on pickup of a different piece or on a snap. |

If the player drops the piece on the table without ever hitting the globe, still use this miss path (shorter hop: P1 height `0.06 R`, duration `260 ms`). Same thud, quieter: gain `× 0.75`.

---

## 5. Audio palette

Web Audio only. Synthesize first. One optional sample: a 40 ms mono ceramic tap, used only if the snap click still reads as a UI blip after tuning. Peak-normalize that sample to **−18 LUFS**, high-pass 200 Hz.

Tone: quiet room, wood and glaze, close-mic. No chiptune, no major-chord fanfare, no whoosh, no pitch-up “success.”

Master SFX bus gain `0.32`. Hard limiter at `−1 dBTP`. Resume `AudioContext` on first `pointerdown`. Honour OS mute. If context creation fails, play silently; do not throw.

All envelopes below are linear ramps unless marked `exp`. Times are milliseconds. Gains are bus-relative (already under the 0.32 master).

### 5.1 Pickup

Duration 55 ms.

| Voice | Type | Pitch | Filter | Gain envelope |
|---|---|---|---|---|
| Scrape | buffer noise, 40 ms | playbackRate 1.0 | bandpass 780 Hz, Q 1.1 | 0 → 0.040 @ 4 ms → 0 @ 40 ms |
| Body | triangle osc | 175 Hz → 88 Hz over 50 ms | lowpass 380 Hz, Q 0.7 | 0 → 0.018 @ 6 ms → 0 @ 55 ms |

Pan: 0. No delay. Very small.

### 5.2 Magnet hum

Very subtle. If you can hum along, it is too loud.

Starts when `pull > 0.25`. Stops on snap, miss, or leaving suggest (40 ms fade).

| Voice | Type | Pitch | Filter | Gain |
|---|---|---|---|---|
| Fundamental | sine | 92 Hz | lowpass 220 Hz | `0.010 * pull` |
| Octave | sine | 184 Hz | lowpass 220 Hz | `0.003 * pull` |

No vibrato. No pulse. Do not retrigger: keep two oscillators for the hold, set gain. Never layer a new hum per frame.

### 5.3 Snap click (ceramic)

Duration 40 ms. This is the money sound.

| Voice | Type | Pitch | Filter | Gain envelope |
|---|---|---|---|---|
| Transient | noise, 6 ms | — | bandpass 3200 Hz, Q 4.0 | 0 → 0.090 @ 1 ms → 0 @ 6 ms |
| Ring A | sine | 2450 Hz, exp decay τ 9 ms | — | 0.060 → 0 @ 28 ms exp |
| Ring B | sine | 4100 Hz, exp decay τ 5 ms | — | 0.032 → 0 @ 16 ms exp |
| Body | sine | 520 Hz, exp decay τ 8 ms | lowpass 1200 Hz | 0.022 → 0 @ 22 ms exp |

Series highpass 180 Hz on the sum, Q 0.7. No compressor on this voice.

If it still sounds like a notification bell: lower Ring A to 2100 Hz and cut Ring B gain to 0.018. If it sounds dull: raise transient Q to 5 and add 1 ms.

Optional sample: mix under the synth at 0.5, never instead of Ring A.

### 5.4 Paint soak

Duration 500 ms. Wet paper, not a splash.

| Voice | Type | Pitch / sweep | Filter | Gain envelope |
|---|---|---|---|---|
| Soak | brown noise (octaves −3 dB/oct) | — | bandpass 400 Hz → 170 Hz over 420 ms, Q 0.7 | 0 → 0.028 @ 80 ms → 0 @ 500 ms |
| Tick | noise, 8 ms, delayed 30 ms | — | highpass 2.4 kHz, Q 0.5 | 0 → 0.012 @ 2 ms → 0 @ 8 ms |

Stereo: right channel delayed 7 ms, gain 0.85 of left. If mono output, skip the delay.

Last piece of a pack: gain `× 1.1`, duration 580 ms.

### 5.5 Miss

Duration 110 ms. Soft wood/ceramic thud. No high ping.

| Voice | Type | Pitch | Filter | Gain envelope |
|---|---|---|---|---|
| Thud | triangle | 140 Hz → 68 Hz over 90 ms | lowpass 480 Hz, Q 0.8 | 0 → 0.038 @ 4 ms → 0 @ 110 ms |
| Dust | noise, 18 ms | — | bandpass 420 Hz, Q 1.8 | 0 → 0.048 @ 2 ms → 0 @ 18 ms |

No ring above 1 kHz. Rate limit 180 ms.

### 5.6 Pack complete

Starts `80 ms` after the last snap click. Quiet resolved interval, not a jingle.

| Voice | Type | Pitch | Envelope | Gain |
|---|---|---|---|---|
| Low | sine | 392 Hz (G4) | attack 40, hold 200, release 700 | 0.030 |
| High | sine | 588 Hz (D5) | same, high delayed 18 ms | 0.022 |
| Wood | triangle | 196 Hz | attack 10, release 220 | 0.016 |

Lowpass the sum at 2.8 kHz, −12 dB/oct. Highshelf −4 dB above 6 kHz.

Do not arpeggiate. Do not add a third note. Do not duck the globe ambience (there is none).

### 5.7 Mixing rules

- One pickup, one hum, one click, one soak, one miss may overlap. Clicks never overlap: if two snaps somehow collide, play one.
- Hum always yields to click: hum gain → 0 in 12 ms on commit.
- No music in v1.
- Debug: a `?feel=1` overlay may print `δ`, `pull`, `p`. It must not make sound.

---

## 6. Haptics

`navigator.vibrate` if it exists and `prefers-reduced-motion` is not `reduce`. If the call no-ops (desktop, iOS Safari), ignore. Never polyfill with audio.

Patterns are millisecond arrays. Amplitude is not controllable; keep them short so they stay light.

| Event | Pattern | Notes |
|---|---|---|
| Pickup | `[8]` | once |
| Magnet enter suggest | `[4]` | once per enter, hysteresis from [§1.3](#13-enter--leave) |
| Snap | `[12, 20, 8]` | strong seat, gap, lighter settle |
| Miss | `[7]` | rate-limited with the thud |
| Pack complete | `[10, 40, 10, 40, 18]` | two taps then a hold |

No haptic on bloom, camera, hover, or ghost. No looping vibration for the hum.

---

## 7. Camera

Globe FOV `32°`. Camera distance at play is `2.35 R` from globe center. Globe occupies ~62% of the short viewport side. Table occupies the lower ~28%.

Never ease FOV. Distance and orbit only.

### 7.1 Tutorial auto-frame

First piece of the first pack, once per profile.

Goal pose:

- Yaw/pitch so the target country sits in the upper-middle of the globe, `16°` off screen center, on the side toward the table.
- Distance `2.35 R` (unchanged).
- Duration `800 ms`, easeInOutCubic.
- Starts `200 ms` after the first piece is idle and visible.

Abort if the player orbits or picks up a piece during the ease: leave the camera where it is.

Do not auto-frame later packs. Do not auto-frame every country.

### 7.2 Play orbit

| | Value |
|---|---|
| Yaw sensitivity mouse | `0.18° / px` |
| Yaw sensitivity touch | `0.22° / px` |
| Pitch clamp | `−72° … +72°` from equator |
| Pitch sensitivity | `0.14° / px` mouse, `0.18°` touch |
| Inertia τ | `740 ms` |
| Idle auto-rotate | `2.4°/s` yaw, starts after `1.8 s` of no pointer. Stops on any pointer-down. |

### 7.3 Completion pullback

After the last snap of a pack, delay `250 ms`, then:

| Channel | From | To |
|---|---:|---:|
| Distance | `2.35 R` | `2.85 R` |
| Pitch | current | `lerp(current, 18°, 0.55)` toward a slight equatorial view |
| Yaw | current | hold |

Duration `1100 ms`, easeInOutQuart. Bloom of the last country is still running; do not wait for it.

After pullback, idle auto-rotate at `1.6°/s` (slower, trophy turntable). First pointer-down returns control; do not animate back to play distance until the next pack loads.

### 7.4 Reduced-motion camera

| Shot | Alternative |
|---|---|
| Tutorial auto-frame | Instant cut to the goal pose. If the globe+table are already visible, **no move**. |
| Completion pullback | Instant cut to the pullback pose. Or no move if `prefers-reduced-motion` and the player has been orbiting (respect their frame). |
| Idle auto-rotate | Off. |
| Globe micro-impulse | Off. |
| Inertia | Off; orbit stops on pointer-up. |

---

## 8. Tuning table (hint levels)

Easy / Normal / Strict are the three hint levels. Default: **Normal**. First-ever session may start Easy for the tutorial pack only, then offer Normal.

| | Easy | Normal | Strict |
|---|---|---|---|
| Who it is for | First pack, kids, geography-anxious | Default | People who want the map test |
| Visual ghost | Always, fades slowly | Fades out by ~80% pack | None |
| Mercy ghost after 2 misses | Yes, 700 ms | Yes, 500 ms | No |
| Magnet start | Generous, ~1.85 × country | Honest, ~1.15 × | Tight, ~0.72 × |
| Magnet lock | Large seat, 140 ms auto-commit | Seat on release only | Small seat, release only |
| Magnet pull | Noticeable | Polite then firm | Almost off until very close |
| Pack fade of magnet | −8% by the last piece | −20% | −30% (already small) |
| Camera tutorial | Yes | Yes, first pack | Skip |
| Audio / haptics | Full | Full | Full (not a hint) |

Copy-paste constants:

```
# Easy
k_start 1.85  k_lock 0.58
d_start_min 9.0  d_start_max 22  d_lock_min 2.6  d_lock_max 7.0
yaw_lock 18  lock_dwell 140
k_curve 1.15  τ_far 90  τ_near 28  τ_yaw_far 110  τ_yaw_near 40
ghost0 0.40  ghost_exp 0.45  fade_exp 0.80  mag_end 0.92

# Normal
k_start 1.15  k_lock 0.34
d_start_min 5.0  d_start_max 14  d_lock_min 1.5  d_lock_max 4.2
yaw_lock 11  lock_dwell off
k_curve 1.45  τ_far 120  τ_near 38  τ_yaw_far 140  τ_yaw_near 55
ghost0 0.26  ghost_exp 1.20  fade_exp 1.00  mag_end 0.80

# Strict
k_start 0.72  k_lock 0.18
d_start_min 2.6  d_start_max 8.0  d_lock_min 0.75  d_lock_max 2.2
yaw_lock 6  lock_dwell off
k_curve 1.80  τ_far 160  τ_near 55  τ_yaw_far 180  τ_yaw_near 80
ghost0 0.00  ghost_exp —  fade_exp 1.00  mag_end 0.70
```

Shared (not hint-scaled):

```
pickup 90 ms
hover align 120 ms
snap 200 ms
punch 1.055 / 0.978
impulse 0.32°
bloom 420 ms pigment, +30 ms delay
miss path 320 ms + squash 140 ms
ungrabbable 80 ms
SFX master 0.32
FOV 32°
play distance 2.35 R
pullback 2.85 R in 1100 ms
```

---

## 9. Reduced motion

When `prefers-reduced-motion: reduce`:

| Keep | Cut |
|---|---|
| Magnet distances and pull (gameplay) | All scale punches, squash, globe impulse |
| Instant pose to target on commit | 200 ms snap ease — cut to seated pose in 1 frame |
| Instant flag fill, still masked to polygon | Bloom, wet darken, diffusion, capillary anim |
| Instant return to slot on miss | Bézier hop |
| Snap click + miss thud | Hum, soak, pack-complete swell |
| — | All haptics |
| — | Camera moves and auto-rotate ([§7.4](#74-reduced-motion-camera)) |
| Pickup offset (so touch can see the tile) | Pickup scale/shadow animation |

Do not slow animations to 0 duration one by one and miss a case. Branch once at the start of each event.

---

## 10. Feel tests (done when these read true)

1. Dragging a tile feels like a physical object with a little mass, not a cursor sticker.
2. Over the globe the tile lies down onto the curvature instead of floating screen-flat.
3. Magnet is a suggestion at the edge, a seat in the last third. It never yanks a piece across an ocean.
4. Correct snap: one ceramic click, a tiny nod of the globe, pigment soaks from the middle. Quiet enough to play at night.
5. Miss: a wood thud, a short hop home, and you can grab it again before it lands. No scold.
6. Strict is a geography test. Easy is a toy. Normal sits between, and late-pack Normal has almost no ghost.
7. Last country of a pack: slightly longer soak, camera steps back, two quiet notes. No confetti.
8. Touch: the tile sits above the finger. Mouse: almost under the cursor.
9. Reduced motion: still playable, still magnetic, no motion sickness extras.
10. Nothing sparkles. Nothing shakes the whole screen. Nothing goes “ta-da.”

### Anti-goals

No screen shake, particle sparkles, cartoon triple-bounce, UI ding, confetti, slow-mo, rainbow trails, vibrating hum loops, bloom that paints ocean, magnet that autoplays the pack, ungrabbable miss longer than 80 ms, fanfare on complete.

---

## 11. Curves reference

```
easeOutCubic(x)     = 1 - pow(1 - x, 3)
easeInCubic(x)      = x * x * x
easeOutQuad(x)      = 1 - (1 - x) * (1 - x)
easeInOutCubic(x)   = x < 0.5 ? 4*x*x*x : 1 - pow(-2*x + 2, 3) / 2
easeInOutQuart(x)   = x < 0.5 ? 8*x*x*x*x : 1 - pow(-2*x + 2, 4) / 2
easeOutBack(x, s=1.12) = 1 + (s+1)*pow(x-1,3) + s*pow(x-1,2)
smoothstep(x)       = x * x * (3 - 2 * x)
expDecay(g0, τ, t)  = g0 * exp(-t / τ)
slerp_arc           = rotate around normalize(cross(a, b)) by lerp(0, angle, a)
```

Frame dt: clamp to `1/30 s` before springs so a hitch does not explode the magnet.

---

*World Snap feel spec. Locked verbs: drag a country onto a globe, magnetic snap, ceramic click, flag soak, wood miss, synthesized audio, hints that fade over the pack, mouse and touch.*
