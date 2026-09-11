import { CanvasTexture, ClampToEdgeWrapping, SRGBColorSpace } from 'three'

const cache = new Map<string, Promise<CanvasTexture>>()

function loadImage(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`flag image failed: ${url}`))
    img.src = url
  })
}

function ensureSvgSize(svg: string) {
  if (/\swidth\s*=/.test(svg) && /\sheight\s*=/.test(svg)) return svg
  return svg.replace('<svg', '<svg width="900" height="600"')
}

export function flagUrl(iso: string) {
  return `/flags/${iso.toLowerCase()}.svg`
}

export function loadFlagTexture(iso: string) {
  const key = iso.toUpperCase()
  const hit = cache.get(key)
  if (hit) return hit
  const promise = (async () => {
    const res = await fetch(flagUrl(key))
    if (!res.ok) throw new Error(`flag ${key} ${res.status}`)
    let svg = await res.text()
    svg = ensureSvgSize(svg)
    const blob = new Blob([svg], { type: 'image/svg+xml' })
    const url = URL.createObjectURL(blob)
    try {
      const img = await loadImage(url)
      const canvas = document.createElement('canvas')
      canvas.width = 1024
      canvas.height = 682
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('no 2d context')
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      const tex = new CanvasTexture(canvas)
      tex.colorSpace = SRGBColorSpace
      tex.anisotropy = 8
      tex.wrapS = ClampToEdgeWrapping
      tex.wrapT = ClampToEdgeWrapping
      tex.needsUpdate = true
      return tex
    } finally {
      URL.revokeObjectURL(url)
    }
  })()
  cache.set(key, promise)
  return promise
}
