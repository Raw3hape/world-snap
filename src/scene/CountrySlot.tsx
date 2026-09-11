import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { DoubleSide, type CanvasTexture, type Mesh, type MeshPhysicalMaterial } from 'three'
import type { Country } from '../game/types'
import { useGame } from '../game/store'
import { buildGlobeGeometry } from '../geo/countryGeometry'
import { loadFlagTexture } from '../geo/flags'
import { landMat, painted, T } from './tokens'

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
    }
  }, [placed, reduced])

  useFrame((_, dt) => {
    if (!placed) soak.current = 0
    else if (soak.current < 1) soak.current = Math.min(1, soak.current + dt * (reduced ? 8 : 1 / 0.7))
    const mat = matRef.current
    if (mat) {
      mat.opacity = soak.current
      mat.transparent = soak.current < 0.999
      mat.depthWrite = soak.current > 0.8
    }
  })

  return (
    <group scale={1}>
      {!placed && (
        <mesh geometry={geo} renderOrder={1} scale={1}>
          <meshPhysicalMaterial
            {...landMat}
            side={DoubleSide}
            polygonOffset
            polygonOffsetFactor={-1}
            polygonOffsetUnits={-1}
          />
        </mesh>
      )}
      {placed && flag && (
        <mesh ref={meshRef} geometry={geo} renderOrder={2} scale={1}>
          <meshPhysicalMaterial
            ref={matRef}
            {...painted}
            map={flag}
            side={DoubleSide}
            transparent
            opacity={soak.current}
            polygonOffset
            polygonOffsetFactor={-1}
            polygonOffsetUnits={-1}
          />
        </mesh>
      )}
      {placed && !flag && (
        <mesh geometry={geo} renderOrder={2} scale={1}>
          <meshPhysicalMaterial
            {...painted}
            color={T.land}
            side={DoubleSide}
            polygonOffset
            polygonOffsetFactor={-1}
            polygonOffsetUnits={-1}
          />
        </mesh>
      )}
      {ghost && !placed && (
        <mesh geometry={geo} renderOrder={3} scale={1}>
          <meshBasicMaterial
            color={T.hint}
            transparent
            opacity={0.35}
            side={DoubleSide}
            depthWrite={false}
            polygonOffset
            polygonOffsetFactor={-1}
            polygonOffsetUnits={-1}
          />
        </mesh>
      )}
    </group>
  )
}
