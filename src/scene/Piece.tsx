import { useEffect, useMemo, useRef, useState } from 'react'
import { DoubleSide, Quaternion, Vector3, type CanvasTexture, type Group } from 'three'
import type { ThreeEvent } from '@react-three/fiber'
import { useFrame } from '@react-three/fiber'
import type { Country } from '../game/types'
import { useGame } from '../game/store'
import { buildPieceGeometry } from '../geo/countryGeometry'
import { loadFlagTexture } from '../geo/flags'
import { bisque, painted } from './tokens'

export type PiecePose = {
  position: Vector3
  quaternion: Quaternion
  scale: number
  opacity: number
}

export function Piece({
  country,
  pose,
  onPickup,
}: {
  country: Country
  pose: PiecePose
  onPickup: (id: string, e: ThreeEvent<PointerEvent>) => void
}) {
  const paintedOn = useGame((s) => s.painted.includes(country.id))
  const dragging = useGame((s) => s.draggingId === country.id)
  const geo = useMemo(() => buildPieceGeometry(country, 0.016), [country])
  const group = useRef<Group>(null)
  const [flag, setFlag] = useState<CanvasTexture | null>(null)
  const hover = useRef(0)

  useEffect(() => {
    let live = true
    loadFlagTexture(country.id)
      .then((t) => {
        if (live) setFlag(t)
      })
      .catch(() => undefined)
    return () => {
      live = false
    }
  }, [country.id])

  useFrame((_, dt) => {
    const g = group.current
    if (!g) return
    g.position.copy(pose.position)
    g.quaternion.copy(pose.quaternion)
    hover.current += ((dragging ? 1 : 0) - hover.current) * Math.min(1, dt * 10)
    g.scale.setScalar(pose.scale * (1 + 0.035 * hover.current))
    const mat = (g.children[0] as { material?: { opacity: number; transparent: boolean } } | undefined)
      ?.material
    if (mat) {
      mat.transparent = pose.opacity < 0.999
      mat.opacity = pose.opacity
    }
  })

  return (
    <group
      ref={group}
      position={pose.position.toArray()}
      quaternion={pose.quaternion.toArray() as [number, number, number, number]}
      scale={pose.scale}
      onPointerDown={(e) => {
        e.stopPropagation()
        onPickup(country.id, e)
      }}
      onPointerOver={(e) => {
        e.stopPropagation()
        hover.current = 1
        document.body.style.cursor = 'grab'
      }}
      onPointerOut={() => {
        hover.current = 0
        document.body.style.cursor = ''
      }}
    >
      <mesh geometry={geo} castShadow>
        <meshPhysicalMaterial
          {...(paintedOn ? painted : bisque)}
          map={paintedOn ? flag : null}
          side={DoubleSide}
        />
      </mesh>
      <mesh>
        <sphereGeometry args={[0.2, 10, 8]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  )
}
