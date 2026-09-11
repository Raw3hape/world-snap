import { describe, expect, it } from 'vitest'
import { countryRadius, evaluateSnap, hintForIndex, polarDistanceDeg } from './snap'
import type { Country } from './types'

const square = (lon: number, lat: number, half = 2): Country => ({
  id: 'XX',
  nameRu: 'Тест',
  nameEn: 'Test',
  isoA2: 'XX',
  centroid: [lon, lat],
  bbox: [lon - half, lat - half, lon + half, lat + half],
  geometry: {
    type: 'Polygon',
    coordinates: [[
      [lon - half, lat - half],
      [lon - half, lat + half],
      [lon + half, lat + half],
      [lon + half, lat - half],
      [lon - half, lat - half],
    ]],
  },
})

describe('snap', () => {
  it('accepts a point inside the country', () => {
    const c = square(12, 42)
    const r = evaluateSnap(c, 12.2, 42.1, 'none')
    expect(r.contains).toBe(true)
    expect(r.canSnap).toBe(true)
  })

  it('rejects a far ocean drop', () => {
    const c = square(12, 42)
    const r = evaluateSnap(c, -40, 0, 'none')
    expect(r.canSnap).toBe(false)
    expect(r.magnetT).toBe(0)
  })

  it('pulls sooner with tutorial hints than with none', () => {
    const c = square(12, 42, 4)
    const full = evaluateSnap(c, 12, 50, 'full')
    const none = evaluateSnap(c, 12, 50, 'none')
    expect(full.magnetT).toBeGreaterThan(none.magnetT)
  })

  it('clamps tiny countries to a hittable radius', () => {
    expect(countryRadius(square(6, 50, 0.2))).toBe(2.4)
  })

  it('fades hints over the pack', () => {
    expect(hintForIndex(0, true)).toBe('full')
    expect(hintForIndex(3, false)).toBe('near')
    expect(hintForIndex(7, false)).toBe('none')
  })

  it('measures polar distance in degrees', () => {
    expect(polarDistanceDeg([0, 0], [0, 0])).toBeCloseTo(0, 5)
    expect(polarDistanceDeg([0, 0], [90, 0])).toBeCloseTo(90, 0)
  })
})
