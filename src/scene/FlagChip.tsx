import { useEffect, useState } from 'react'
import { DoubleSide, type CanvasTexture } from 'three'
import { loadFlagTexture } from '../geo/flags'
import { T, TABLE_Y } from './tokens'
import { useGame } from '../game/store'
import { playPaint, haptic } from '../audio/synth'

export function FlagChip({
  iso,
  position,
}: {
  iso: string
  position: [number, number, number]
}) {
  const paint = useGame((s) => s.paint)
  const painted = useGame((s) => s.painted.includes(iso))
  const muted = useGame((s) => s.muted)
  const [flag, setFlag] = useState<CanvasTexture | null>(null)

  useEffect(() => {
    let live = true
    loadFlagTexture(iso)
      .then((t) => {
        if (live) setFlag(t)
      })
      .catch(() => undefined)
    return () => {
      live = false
    }
  }, [iso])

  return (
    <mesh
      position={[position[0], TABLE_Y + 0.03, position[2]]}
      rotation={[-Math.PI / 2, 0, 0.12]}
      onPointerDown={(e) => {
        e.stopPropagation()
        paint(iso)
        playPaint(muted)
        haptic(8)
      }}
      castShadow
      scale={painted ? 0.86 : 1}
    >
      <planeGeometry args={[0.28, 0.18]} />
      <meshBasicMaterial
        map={flag ?? undefined}
        color={flag ? '#ffffff' : T.brass}
        toneMapped={false}
        side={DoubleSide}
        opacity={painted ? 0.7 : 1}
        transparent={painted || !flag}
      />
    </mesh>
  )
}
