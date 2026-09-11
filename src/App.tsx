import { Canvas } from '@react-three/fiber'
import { ACESFilmicToneMapping, SRGBColorSpace } from 'three'
import { Suspense, useEffect, useState } from 'react'
import { unlockAudio } from './audio/synth'
import { copy } from './game/copy'
import { useGame } from './game/store'
import type { CollectionFile, Pack } from './game/types'
import { useReducedMotion } from './hooks/useReducedMotion'
import { loadFlagTexture } from './geo/flags'
import { CAM, T } from './scene/tokens'
import { Experience } from './scene/Experience'
import { Boot, Collection, Complete, Title } from './ui/Overlays'
import { Hud } from './ui/Hud'

export default function App() {
  const [pack, setPack] = useState<Pack | null>(null)
  const [collection, setCollection] = useState<CollectionFile | null>(null)
  const [error, setError] = useState(false)
  const reduced = useReducedMotion()
  const phase = useGame((s) => s.phase)
  const collectionOpen = useGame((s) => s.collectionOpen)
  const hydrate = useGame((s) => s.hydrate)
  const toTable = useGame((s) => s.toTable)
  const replay = useGame((s) => s.replay)
  const openCollection = useGame((s) => s.openCollection)
  const setPackSize = useGame((s) => s.setPackSize)

  useEffect(() => {
    Object.assign(window, { __worldSnap: useGame })
    hydrate()
    let live = true
    Promise.all([
      fetch('/data/pack-familiar.json').then((r) => {
        if (!r.ok) throw new Error('pack')
        return r.json() as Promise<Pack>
      }),
      fetch('/data/collection.json')
        .then((r) => (r.ok ? (r.json() as Promise<CollectionFile>) : null))
        .catch(() => null),
    ])
      .then(([p, c]) => {
        if (!live) return
        setPack(p)
        setCollection(c)
        useGame.getState().setPackSize(p.countries.length)
        for (const country of p.countries) void loadFlagTexture(country.id)
      })
      .catch(() => {
        if (live) setError(true)
      })
    return () => {
      live = false
    }
  }, [hydrate, setPackSize])

  useEffect(() => {
    const onFirst = () => unlockAudio()
    window.addEventListener('pointerdown', onFirst, { once: true })
    return () => window.removeEventListener('pointerdown', onFirst)
  }, [])

  if (!pack) return <Boot error={error} />

  return (
    <div className="app">
      <Canvas
        shadows
        dpr={[1, 2]}
        camera={{ fov: CAM.fov, position: CAM.position, near: 0.1, far: 40 }}
        gl={{
          antialias: true,
          preserveDrawingBuffer: true,
          toneMapping: ACESFilmicToneMapping,
          outputColorSpace: SRGBColorSpace,
        }}
        onCreated={({ gl }) => {
          gl.toneMappingExposure = 0.92
        }}
      >
        <Suspense fallback={null}>
          <Experience pack={pack} reduced={reduced} />
        </Suspense>
      </Canvas>

      <Hud total={pack.countries.length} />

      {phase === 'title' && <Title onEnter={toTable} />}
      {phase === 'complete' && !collectionOpen && (
        <Complete onCollection={() => openCollection(true)} onReplay={replay} />
      )}
      {collectionOpen && (
        <Collection file={collection} onClose={() => openCollection(false)} onReplay={replay} />
      )}

      <h1 className="sr-only">{copy.title}</h1>
      <style>{`canvas { background: ${T.ink}; }`}</style>
    </div>
  )
}
