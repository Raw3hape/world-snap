import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { DoubleSide, type CanvasTexture, type Mesh, type MeshPhysicalMaterial } from 'three'
import type { Country } from '../game/types'
import { useGame } from '../game/store'
import { buildGlobeGeometry } from '../geo/countryGeometry'
import { loadFlagTexture } from '../geo/flags'
import { painted, T } from './tokens'

export function CountrySlot({
  country,
  radius,
  reduced,
}: {
  country: Country
  radius: number
  reduced: boolean
}) {
  const placed = useGame((s) => s.placed.includes(country.id))
  const ghost = useGame((s) => s.ghostId === country.id)
  const geo = useMemo(() => buildGlobeGeometry(country, radius), [country, radius])
  const [flag, setFlag] = useState<CanvasTexture | null>(null)
  const soak = useRef(placed ? 1 : 0)
  const scale = useRef(1)
  const meshRef = useRef<Mesh>(null)
  const matRef = useRef<MeshPhysicalMaterial>(null)
  const started = useRef(placed)

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

  useEffect(() => {
    if (placed && !started.current) {
      started.current = true
      soak.current = reduced ? 1 : 0
      scale.current = reduced ? 1 : 1.016
    }
  }, [placed, reduced])

  useFrame((_, dt) => {
    if (!placed) {
      soak.current = 0
      scale.current = 1
    } else if (soak.current < 1) {
      const speed = reduced ? 8 : 1 / 0.9
      soak.current = Math.min(1, soak.current + dt * speed)
      scale.current += (1 - scale.current) * Math.min(1, dt * 4)
    }
    if (meshRef.current) meshRef.current.scale.setScalar(scale.current)
    const mat = matRef.current
    if (mat) {
      mat.opacity = soak.current
      mat.roughness = painted.roughness + (0.2 - painted.roughness) * (1 - soak.current)
      mat.transparent = soak.current < 0.999
      mat.needsUpdate = true
    }
  })

  return (
    <group>
      {placed && !flag && (
        <mesh geometry={geo} renderOrder={2}>
          <meshPhysicalMaterial {...painted} color="#E6E2DA" side={DoubleSide} />
        </mesh>
      )}
      {placed && flag && (
        <mesh ref={meshRef} geometry={geo} renderOrder={2}>
          <meshPhysicalMaterial
            ref={matRef}
            {...painted}
            map={flag}
            side={DoubleSide}
            transparent
            opacity={soak.current}
            depthWrite={false}
          />
        </mesh>
      )}
      {ghost && !placed && (
        <mesh geometry={geo} renderOrder={3} scale={1.004}>
          <meshBasicMaterial
            color={T.hint}
            transparent
            opacity={0.28}
            side={DoubleSide}
            depthWrite={false}
          />
        </mesh>
      )}
    </group>
  )
}
