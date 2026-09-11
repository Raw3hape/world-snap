# World Snap — light look (shipped)

Paper studio. Full sphere on `#F4F1EA`. No HDR, fog, table, lamp, contact shadow, or HUD slab.

**Tokens** paper `#F4F1EA` · ink `#1C1914` · mute `#7A746A` · land `#E6DFD4` · ocean `#D0D8DC` · line `#C6BFB4` · hint `#3D7A8C` · miss `#9A5A58`.

**Camera** fov `34`. `R=1`. `OCEAN_R=0.998`. `GLOBE_Y=0`. `CAM_DIR = normalize([0, 0.06, 1])`. Look-at origin. Play canvas lives in `.stage` between a 72px paper HUD and a 120px tray, so the globe is centered in that window. Title stage is full-bleed.

**Zoom** distTitle `4.8` · distOut `4.55` · distIn `1.95` · distComplete `5.1`. Play idle: sphere ~72% of the stage. Zoom-in stays a curved sphere.

**Scene** opaque paper clear every frame. Hemisphere `#F7F6F3` / `#E6E2DC` `0.85`. Key `[0.35, 2.1, 2.5]` `#FFFDF8` `1.15`. Fill `[−1.4, 0.9, −0.7]` `#EEF1F3` `0.32`. ACES, exposure `1.05`. Ocean `OCEAN_R`, roughness `0.58`, no transmission. HUD is type only.

**HUD** wordmark + count. Live-region: miss / snap / complete. Tray: paper, hairline `--line`.
