import { geoContains, geoDistance } from 'd3-geo'
import type { Country, HintLevel, MagnetResult } from './types'

export const HINT_BY_PLACED: HintLevel[] = [
  'full',
  'full',
  'full',
  'near',
  'near',
  'near',
  'none',
  'none',
]

/** Maps in-pack hint → feel.md Easy / Normal / Strict magnet. */
export const MAGNET = {
  full: {
    kStart: 1.85,
    kLock: 0.58,
    startMin: 9,
    startMax: 22,
    lockMin: 2.6,
    lockMax: 7,
  },
  near: {
    kStart: 1.15,
    kLock: 0.34,
    startMin: 5,
    startMax: 14,
    lockMin: 1.5,
    lockMax: 4.2,
  },
  none: {
    kStart: 0.72,
    kLock: 0.18,
    startMin: 2.6,
    startMax: 8,
    lockMin: 0.75,
    lockMax: 2.2,
  },
} as const

export function hintForIndex(placedCount: number, isTutorial: boolean): HintLevel {
  if (isTutorial) return 'full'
  if (placedCount < 12) return 'full'
  if (placedCount < 50) return 'near'
  return 'none'
}

export function polarDistanceDeg(a: [number, number], b: [number, number]) {
  return geoDistance(a, b) * (180 / Math.PI)
}

export function countryRadius(country: Country) {
  const [minLon, minLat, maxLon, maxLat] = country.bbox
  const corners: [number, number][] = [
    [minLon, minLat],
    [minLon, maxLat],
    [maxLon, minLat],
    [maxLon, maxLat],
  ]
  let r = 0
  for (const c of corners) r = Math.max(r, polarDistanceDeg(country.centroid, c))
  return Math.min(16, Math.max(2.4, r))
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n))
}

export function magnetDistances(country: Country, hint: HintLevel) {
  const r = countryRadius(country)
  const m = MAGNET[hint]
  return {
    rEff: r,
    dStart: clamp(m.kStart * r, m.startMin, m.startMax),
    dLock: clamp(m.kLock * r, m.lockMin, m.lockMax),
  }
}

export function evaluateSnap(
  country: Country,
  lon: number,
  lat: number,
  hint: HintLevel,
): MagnetResult {
  const point: [number, number] = [lon, lat]
  const contains = geoContains(
    { type: 'Feature', geometry: country.geometry, properties: {} },
    point,
  )
  const degrees = polarDistanceDeg(country.centroid, point)
  const { dStart, dLock } = magnetDistances(country, hint)
  const u = degrees >= dStart ? 0 : 1 - degrees / dStart
  const magnetT = u * u * (3 - 2 * u)
  const canSnap = contains || degrees <= dLock
  const nearGhost = hint === 'full' || (hint === 'near' && degrees <= dStart)
  return { contains, degrees, magnetT, canSnap, nearGhost }
}

export function nearestCountry(countries: Country[], lon: number, lat: number): Country | null {
  let best: Country | null = null
  let bestD = Infinity
  for (const c of countries) {
    const d = polarDistanceDeg(c.centroid, [lon, lat])
    if (d < bestD) {
      bestD = d
      best = c
    }
  }
  return best
}
