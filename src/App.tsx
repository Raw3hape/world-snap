import { Canvas } from '@react-three/fiber'
import { ACESFilmicToneMapping, Color, SRGBColorSpace } from 'three'
import { Suspense, useEffect, useState } from 'react'
import { unlockAudio } from './audio/synth'
import { copy } from './game/copy'
import { useGame } from './game/store'
import type { Pack } from './game/types'
import { useReducedMotion } from './hooks/useReducedMotion'
import { loadFlagTexture } from './geo/flags'
import { CAM, T } from './scene/tokens'
import { Experience } from './scene/Experience'
import { Boot, Title } from './ui/Overlays'
import { Hud } from './ui/Hud'
import { DragGhost, Tray } from './ui/Tray'

function withContinent(p: Pack): Pack {
  return {
    ...p,
    countries: p.countries.map((c) => ({
      ...c,
      continent: c.continent || 'World',
    })),
  }
}

export default function App() {
  const [pack, setPack] = useState<Pack | null>(null)
  const [error, setError] = useState(false)
  const reduced = useReducedMotion()
  const phase = useGame((s) => s.phase)
  const hydrate = useGame((s) => s.hydrate)
  const toTable = useGame((s) => s.toTable)
  const setPackSize = useGame((s) => s.setPackSize)

  useEffect(() => {
    Object.assign(window, { __worldSnap: useGame })
    hydrate()
    let live = true
    const load = async () => {
      const urls = ['/data/pack-world.json', '/data/pack-familiar.json']
      let last: Error | null = null
      for (const url of urls) {
        try {
          const r = await fetch(url)
          if (!r.ok) throw new Error(url)
          const p = withContinent((await r.json()) as Pack)
          if (!live) return
          setPack(p)
          useGame.getState().setPackSize(p.countries.length)
          for (const country of p.countries) void loadFlagTexture(country.id)
          return
        } catch (e) {
          last = e as Error
        }
      }
      if (live) setError(Boolean(last))
    }
    void load()
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
    <div className={`app ${phase === 'title' ? 'is-title' : 'is-play'}`}>
      <div className="stage">
        <Canvas
          style={{ position: 'absolute', inset: 0, background: T.paper }}
          dpr={[1, 2]}
          camera={{ fov: CAM.fov, position: CAM.position, near: 0.1, far: 40 }}
          gl={{
            antialias: true,
            alpha: false,
            preserveDrawingBuffer: true,
            toneMapping: ACESFilmicToneMapping,
            outputColorSpace: SRGBColorSpace,
          }}
          onCreated={({ gl, scene }) => {
            gl.toneMapping = ACESFilmicToneMapping
            gl.toneMappingExposure = 1.05
            gl.outputColorSpace = SRGBColorSpace
            gl.setClearColor(T.paper, 1)
            scene.background = new Color(T.paper)
          }}
        >
          <Suspense fallback={null}>
            <Experience pack={pack} reduced={reduced} titleFrame={phase === 'title'} />
          </Suspense>
        </Canvas>
      </div>

      <Hud total={pack.countries.length} />
      <Tray countries={pack.countries} />
      <DragGhost countries={pack.countries} />

      {phase === 'title' && <Title onEnter={toTable} />}

      <h1 className="sr-only">{copy.title}</h1>
    </div>
  )
}
