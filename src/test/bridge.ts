import { Camera, Group, Vector3, type WebGLRenderer } from 'three'
import { useGame } from '../game/store'
import type { Pack } from '../game/types'
import { latLonToVector3 } from '../geo/sphere'
import { R } from '../scene/tokens'

export type WsBridge = {
  ready: boolean
  size: { width: number; height: number }
  project: (world: [number, number, number]) => { x: number; y: number } | null
  pieceWorld: (id: string) => [number, number, number] | null
  countryWorld: (id: string) => [number, number, number] | null
  faceCountry: (id: string) => void
  canvasStats: () => { pixels: number; meanLuma: number; colorful: number }
}

const _p = new Vector3()
const _local = new Vector3()
const _cam = new Vector3()

type Handle = {
  camera: Camera
  gl: WebGLRenderer
  globe: () => Group | null
  pack: Pack
  piecePos: (id: string) => Vector3 | null
}

export function installBridge(handle: Handle) {
  const api: WsBridge = {
    get ready() {
      return Boolean(handle.globe())
    },
    get size() {
      const r = handle.gl.domElement.getBoundingClientRect()
      return { width: r.width, height: r.height }
    },
    project(world) {
      _p.set(world[0], world[1], world[2]).project(handle.camera)
      if (!Number.isFinite(_p.x) || !Number.isFinite(_p.y)) return null
      if (_p.z < -1 || _p.z > 1.1) return null
      const r = handle.gl.domElement.getBoundingClientRect()
      return {
        x: (_p.x * 0.5 + 0.5) * r.width,
        y: (-_p.y * 0.5 + 0.5) * r.height,
      }
    },
    pieceWorld(id) {
      const p = handle.piecePos(id)
      if (!p) return null
      return [p.x, p.y, p.z]
    },
    countryWorld(id) {
      const c = handle.pack.countries.find((x) => x.id === id)
      const globe = handle.globe()
      if (!c || !globe) return null
      latLonToVector3(c.centroid[1], c.centroid[0], R * 1.02, _local)
      globe.updateMatrixWorld(true)
      globe.localToWorld(_local)
      return [_local.x, _local.y, _local.z]
    },
    faceCountry(id) {
      const c = handle.pack.countries.find((x) => x.id === id)
      const globe = handle.globe()
      if (!c || !globe) return
      latLonToVector3(c.centroid[1], c.centroid[0], 1, _local)
      _cam.copy(handle.camera.position).normalize()
      globe.quaternion.setFromUnitVectors(_local, _cam)
      globe.updateMatrixWorld(true)
    },
    canvasStats() {
      const canvas = handle.gl.domElement
      const w = Math.min(canvas.width, 512)
      const h = Math.min(canvas.height, 320)
      const copy = document.createElement('canvas')
      copy.width = w
      copy.height = h
      const ctx = copy.getContext('2d')
      if (!ctx) return { pixels: 0, meanLuma: 0, colorful: 0 }
      ctx.drawImage(canvas, 0, 0, w, h)
      const data = ctx.getImageData(0, 0, w, h).data
      let luma = 0
      let colorful = 0
      const n = w * h
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i] ?? 0
        const g = data[i + 1] ?? 0
        const b = data[i + 2] ?? 0
        luma += 0.2126 * r + 0.7152 * g + 0.0722 * b
        const max = Math.max(r, g, b)
        const min = Math.min(r, g, b)
        if (max - min > 28 && max > 40) colorful += 1
      }
      return { pixels: n, meanLuma: luma / n, colorful }
    },
  }

  window.__ws = api
  window.__worldSnap = useGame
}

declare global {
  interface Window {
    __ws?: WsBridge
  }
}
